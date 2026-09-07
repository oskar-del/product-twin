/**
 * Catalog-driven room composer.
 *
 * Selects real catalog rows for each role in a room, sizes them from the
 * geometry that actually ships, and emits a contract-valid twin-scene with a
 * channel-tracked commerce overlay on every shoppable element.
 *
 * Selection is DERIVED, never typed: for each role the compiler filters the
 * catalog to the role's categories (in stock, proxy available where required)
 * and picks the row whose real footprint best fits the slot the room layout
 * reserves for it. Ties break on catalog id so the same catalog always yields
 * the same room.
 */

import { rowElement, leafCategory } from "./catalog-row.mjs";
import { resolveComposition } from "../compose/attach-resolver.mjs";

/**
 * Attach slots granted to a base, by role. Mirrors the Avatar Factory
 * attach-point schema (role: base/attach/free; slots carry type + capacity).
 */
const ROLE_SLOTS = {
  sofa:        [{ slot_id: "seat_back", type: "seat_back", capacity: 3 },
                { slot_id: "seat",      type: "seat",      capacity: 1 }],
  armchair:    [{ slot_id: "seat_back", type: "seat_back", capacity: 1 },
                { slot_id: "seat",      type: "seat",      capacity: 1 }],
  low_table:   [{ slot_id: "top",       type: "top",       capacity: 2 }],
  side_table:  [{ slot_id: "top",       type: "top",       capacity: 1 }],
  media_unit:  [{ slot_id: "surface",   type: "surface",   capacity: 2 }],
  dining_table:[{ slot_id: "top",       type: "top",       capacity: 2 }]
};

/**
 * Fit score: how well a row's real footprint matches the reserved slot.
 * Lower is better. Width dominates (it decides whether the piece reads right
 * against the wall); depth is a secondary penalty; anything that physically
 * overruns the reserved envelope is rejected outright by the caller.
 */
export function fitScore(size, target) {
  if (!size || !target) return Number.POSITIVE_INFINITY;
  const dw = Math.abs(size[0] - target.width_m);
  const dd = target.depth_m ? Math.abs(size[2] - target.depth_m) * 0.5 : 0;
  return dw + dd;
}

/**
 * Choose one row per role.
 *
 * @param {object} opts
 * @param {object[]} opts.rows                catalog rows
 * @param {object[]} opts.roles               role specs
 * @param {(row) => ({assetPath, bounds}|null)} opts.resolveGeometry
 * @returns {{selected: Map<string,object>, report: object[]}}
 */
export function selectForRoles({ rows, roles, resolveGeometry }) {
  const byCategory = new Map();
  for (const row of rows) {
    const cat = leafCategory(row);
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(row);
  }

  const selected = new Map();
  const report = [];
  const used = new Set();

  for (const role of roles) {
    const pool = role.categories.flatMap(c => byCategory.get(c) ?? []);

    const scored = [];
    for (const row of pool) {
      if (used.has(row.id)) continue;
      if (role.require_in_stock !== false && row.availability !== "in_stock") continue;

      const geom = resolveGeometry(row);

      // Two independent requirements: a shipped GLB proxy, and a known size.
      // A feed can supply one without the other (vidaXL states size in the
      // title but ships no geometry), so they are never conflated.
      if (role.require_asset !== false && !geom?.assetPath) continue;

      const size = geom?.bounds?.size ?? null;
      const sizeKnown = Array.isArray(size) && size.every(v => Number.isFinite(v) && v > 0);
      if (role.require_size !== false && !sizeKnown) continue;

      // Reject anything that physically overruns the reserved envelope.
      if (sizeKnown && role.max_width_m && size[0] > role.max_width_m) continue;
      if (sizeKnown && role.max_depth_m && size[2] > role.max_depth_m) continue;

      scored.push({ row, geom, score: fitScore(sizeKnown ? size : null, role.target) });
    }

    // Deterministic: best fit, ties broken by catalog id.
    scored.sort((a, b) =>
      a.score - b.score || String(a.row.id).localeCompare(String(b.row.id))
    );

    const winner = scored[0];
    if (!winner) {
      report.push({ role: role.id, state: "NO_CANDIDATE", candidates: 0 });
      continue;
    }

    used.add(winner.row.id);
    selected.set(role.id, { ...winner, role });
    report.push({
      role: role.id,
      state: "SELECTED",
      candidates: scored.length,
      sku: winner.row.id,
      title: winner.row.title,
      fit_score: Number(winner.score.toFixed(4)),
      size_m: winner.geom?.bounds?.size?.map(v => Number(v.toFixed(3))) ?? null
    });
  }

  return { selected, report };
}

/**
 * Synthesize a twin-like record so the existing attach-resolver can position
 * decor against a catalog-selected base. Dimensions come from derived bounds.
 */
export function twinFromSelection({ row, geom, role }) {
  const size = geom?.bounds?.size ?? role.nominal_size_m ?? [0.6, 0.6, 0.6];
  const slots = ROLE_SLOTS[role.base_kind] ?? null;

  return {
    twin_id: `${String(row.source ?? "catalog").toUpperCase()}_${row.id}`,
    physical: {
      dimensions_mm: {
        width: Math.round(size[0] * 1000),
        height: Math.round(size[1] * 1000),
        depth: Math.round(size[2] * 1000)
      },
      // Seat height drives where cushions land; derived as a fraction of the
      // real height for seating, which is what the proxy encodes.
      secondary_dimensions_mm: role.base_kind === "sofa" || role.base_kind === "armchair"
        ? { seat_height: Math.round(size[1] * 1000 * 0.52) }
        : undefined
    },
    attach: slots
      ? { role: "base", slots }
      : role.attaches_to
        ? { role: "attach", accepts_slot_type: role.slot_type }
        : { role: "free" },
    __row: row,
    __geom: geom,
    __role: role
  };
}

/**
 * Compose a full room: select rows, resolve attach positions, emit elements.
 *
 * @param {object} opts
 * @param {object[]} opts.rows
 * @param {object[]} opts.roles      base roles with layout positions
 * @param {object[]} opts.decor      decor roles with attach targets
 * @param {Function} opts.resolveGeometry
 * @returns {{elements: object[], report: object[], errors: string[]}}
 */
export function composeRoom({ rows, roles, decor = [], resolveGeometry }) {
  const { selected, report } = selectForRoles({ rows, roles: [...roles, ...decor], resolveGeometry });

  const twinIndex = new Map();
  const items = [];
  const roleByTwinId = new Map();

  for (const role of roles) {
    const pick = selected.get(role.id);
    if (!pick) continue;
    const twin = twinFromSelection(pick);
    twinIndex.set(twin.twin_id, twin);
    roleByTwinId.set(twin.twin_id, role);
    items.push({
      twin_id: twin.twin_id,
      position: role.position,
      rotation_y_deg: role.rotation_y_deg ?? 0
    });
  }

  for (const d of decor) {
    const pick = selected.get(d.id);
    if (!pick) continue;
    const twin = twinFromSelection(pick);
    twinIndex.set(twin.twin_id, twin);
    roleByTwinId.set(twin.twin_id, d);

    if (d.attaches_to) {
      const baseRole = roles.find(r => r.id === d.attaches_to);
      const basePick = baseRole && selected.get(baseRole.id);
      if (!basePick) continue;
      const baseTwinId = twinFromSelection(basePick).twin_id;
      items.push({ twin_id: twin.twin_id, attach_to: baseTwinId, slot_id: d.slot_id });
    } else {
      items.push({
        twin_id: twin.twin_id,
        position: d.position ?? [0, 0, 0],
        rotation_y_deg: d.rotation_y_deg ?? 0
      });
    }
  }

  const { positioned, errors } = resolveComposition({ items, twinIndex });

  const elements = positioned.map(p => {
    const role = roleByTwinId.get(p.twin.twin_id);
    const geom = p.twin.__geom;
    return rowElement({
      row: p.twin.__row,
      id: role?.id ?? p.twin.twin_id,
      position: p.position,
      rotation_y_deg: p.rotation_y_deg,
      assetPath: geom?.assetPath ?? null,
      bounds: geom?.bounds ?? (role?.nominal_size_m ? { size: role.nominal_size_m } : null),
      type: role?.element_type ?? "FURNITURE"
    });
  });

  return { elements, report, errors };
}
