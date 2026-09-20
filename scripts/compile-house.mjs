/**
 * Vinkelhuset — the whole house as one twin-scene ("the dollhouse").
 *
 * Reads BRAGE's room-level spec live from their worktree and builds every
 * storey: 13 room volumes, walls split around their real openings, the 30°
 * gable over the bar and the 15° monopitch over the cold wing.
 *
 * READ ORDER is BRAGE's own (spec.handoff.read_order):
 *   rooms[].footprint_xz → rooms[].wall_segments → rooms[].openings → roof → wing_roof
 *
 * Two traps BRAGE flagged, both honoured here:
 *
 *  1. ROOM_GLANRUMMET keeps its v0.2 id and 7 × 7 footprint, so the room
 *     compiled by compile-room-in-house.mjs still resolves. Asserted below.
 *  2. The upper floor is heated only where headroom clears 1.9 m — 4.23 m of
 *     the 7 m structural span. This compiler extrudes the STRUCTURAL volume so
 *     the model is not a lie about what is built, but every area it reports is
 *     the spec's own figure. It never sums footprints into a floor area.
 *
 *   node scripts/compile-house.mjs [--out path]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseScene } from "../engine/core/scene-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = path.resolve(root,
  "../repo-brage/OPEN AI/Säterdalsvägen 14 - Svärtinge/04-House-Design/BRAGE/geometry/house-v0.3-geometry-spec.json");

const WALL_T = 0.25;      // external wall thickness for the model
const SLAB_T = 0.3;       // floor slab thickness
const GLASS_T = 0.08;

export function readSpec(file = SPEC) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `BRAGE spec not found at ${file}\n` +
      "The house compiler reads BRAGE's worktree live and keeps no vendored copy. " +
      "Check that ../repo-brage exists and is on a branch carrying house-v0.3-geometry-spec.json."
    );
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const bbox = footprint => {
  const xs = footprint.map(p => p[0]);
  const zs = footprint.map(p => p[1]);
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minZ: Math.min(...zs), maxZ: Math.max(...zs)
  };
};

/**
 * Merge a wall's openings into void intervals along that wall.
 *
 * BRAGE's schedule can nest one opening inside another — Glanrummet's sliding
 * door sits within the run of its fixed glazing — so cutting each opening
 * independently would punch the same hole twice and leave a sliver of wall
 * floating between them. The wall is cut once per merged void; each opening
 * still renders as its own element.
 */
export function mergeVoids(openings) {
  const intervals = openings
    .map(o => ({ t0: Math.min(o.t0, o.t1), t1: Math.max(o.t0, o.t1), sill: o.sill_m, head: o.head_m }))
    .sort((a, b) => a.t0 - b.t0);

  const voids = [];
  for (const iv of intervals) {
    const last = voids[voids.length - 1];
    if (last && iv.t0 <= last.t1 + 1e-9) {
      last.t1 = Math.max(last.t1, iv.t1);
      last.sill = Math.min(last.sill, iv.sill);   // cut the most generous extent
      last.head = Math.max(last.head, iv.head);
    } else {
      voids.push({ ...iv });
    }
  }
  return voids;
}

/**
 * Split one wall segment into the solid panels that remain once its voids are cut:
 * piers between openings, a head panel over each void, a sill panel under it.
 */
export function wallPanels(segment, voids, height) {
  const panels = [];
  const L = segment.length_m;
  let cursor = 0;

  for (const v of voids) {
    const t0 = Math.max(0, Math.min(L, v.t0));
    const t1 = Math.max(0, Math.min(L, v.t1));
    if (t0 > cursor + 1e-6) panels.push({ t0: cursor, t1: t0, y0: 0, y1: height, kind: "pier" });
    if (v.sill > 1e-6) panels.push({ t0, t1, y0: 0, y1: v.sill, kind: "sill" });
    if (height - v.head > 1e-6) panels.push({ t0, t1, y0: v.head, y1: height, kind: "head" });
    cursor = Math.max(cursor, t1);
  }
  if (cursor < L - 1e-6) panels.push({ t0: cursor, t1: L, y0: 0, y1: height, kind: "pier" });
  return panels;
}

/** Parameter of a point along a wall segment, in metres from its start. */
function along(segment, xz) {
  const [ax, az] = segment.from_xz;
  const [bx, bz] = segment.to_xz;
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  return ((xz[0] - ax) * dx + (xz[1] - az) * dz) / len;
}

/** World position + size of a panel on a wall segment. */
function panelBox(segment, panel, baseY) {
  const [ax, az] = segment.from_xz;
  const [bx, bz] = segment.to_xz;
  const len = Math.hypot(bx - ax, bz - az) || 1;
  const ux = (bx - ax) / len;
  const uz = (bz - az) / len;

  const midT = (panel.t0 + panel.t1) / 2;
  const x = ax + ux * midT;
  const z = az + uz * midT;
  const runs = panel.t1 - panel.t0;
  const horizontal = Math.abs(ux) >= Math.abs(uz);

  return {
    size: horizontal ? [runs, panel.y1 - panel.y0, WALL_T] : [runs, panel.y1 - panel.y0, WALL_T],
    position: [x, baseY + (panel.y0 + panel.y1) / 2, z],
    rotation_y_deg: horizontal ? 0 : 90
  };
}

export function buildHouse(spec = readSpec()) {
  const floorY = spec.coordinate_system.finished_floor_Y;
  const elements = [];
  const notes = [];

  // ── trap 1: the room Platform already built must still resolve ────────────
  const glan = spec.rooms.find(r => r.id === "ROOM_GLANRUMMET");
  if (!glan) throw new Error("ROOM_GLANRUMMET is missing — the room-in-house scene would stop resolving");
  const g = bbox(glan.footprint_xz);
  if (Math.abs((g.maxX - g.minX) - 7) > 1e-9 || Math.abs((g.maxZ - g.minZ) - 7) > 1e-9) {
    throw new Error(`ROOM_GLANRUMMET footprint changed from 7 × 7 to ${g.maxX - g.minX} × ${g.maxZ - g.minZ}`);
  }

  let openingCount = 0;

  for (const room of spec.rooms) {
    const base = floorY[room.storey];
    if (typeof base !== "number") throw new Error(`${room.id}: no finished_floor_Y for storey ${room.storey}`);
    const b = bbox(room.footprint_xz);
    const w = b.maxX - b.minX;
    const d = b.maxZ - b.minZ;
    const h = room.ceiling_height_m;
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const ref = [`${spec.spec_id} rooms[${room.id}]`];

    // Floor slab
    elements.push({
      id: `${room.id}_SLAB`, type: "FLOOR_SLAB",
      label: `${room.id} floor · ${room.finishes?.floor ?? "unspecified"}`,
      evidence_class: room.evidence_class ?? "CONCEPT",
      source_refs: ref,
      limitations: ["Concept geometry from BRAGE's design. Not a survey; no level is set out."],
      geometry: { primitive: "BOX", size: [w, SLAB_T, d], position: [cx, base - SLAB_T / 2, cz], rotation_y_deg: 0 }
    });

    // Room volume — the readable "dollhouse" cell
    const underPitch = room.storey === "UPPER";
    elements.push({
      id: room.id, type: "ROOM", picking: false,
      storey_under_pitch: underPitch,
      label: `${room.id.replace(/^ROOM_/, "").replace(/_/g, " ")} · ${room.floor_area_m2} m² · ${h} m clear`,
      evidence_class: room.evidence_class ?? "CONCEPT",
      source_refs: ref,
      limitations: [
        `Area ${room.floor_area_m2} m² and volume ${room.volume_m3} m³ are the spec's computed figures, not measured.`,
        room.heated ? "Heated volume." : "COLD volume — excluded from the heated area.",
        underPitch
          ? `Drawn as a flat-topped box for readability. The real ceiling follows the ${spec.roof.pitch_deg}° pitch, so this box is wider at the top than the room is; the ${spec.floor_area_m2 ?? room.floor_area_m2} m² area counts only the band clearing ${spec.upper_floor_derivation.headroom_min_m} m.`
          : null
      ].filter(Boolean),
      geometry: { primitive: "ROOM_VOLUME", size: [w, h, d], position: [cx, base + h / 2, cz], rotation_y_deg: 0, intended_use: room.use }
    });

    // ── openings in a roof plane, not a wall ────────────────────────────────
    // A rooflight states its plan extent and no sill/head: its height is whatever
    // the roof is at that Z. Deriving it from the pitch is the only honest option;
    // guessing a sill would invent a number the spec deliberately left null.
    for (const o of (room.openings ?? []).filter(x => /^ROOF/i.test(x.wall ?? ""))) {
      openingCount += 1;
      const r0 = spec.roof;
      const ridgeZ = r0.ridge_xz[0][1];
      const t = Math.tan((r0.pitch_deg * Math.PI) / 180);
      const yAt = z => r0.ridge_Y - Math.abs(z - ridgeZ) * t;
      const [ox0, oz0] = o.from_xz;
      const [ox1, oz1] = o.to_xz;
      elements.push({
        id: o.id, type: "OPENING",
        label: `${o.id} — ${String(o.type ?? "rooflight").replace(/_/g, " ").toLowerCase()} · ${o.wall}`,
        evidence_class: "CONCEPT",
        source_refs: [...ref, `openings[${o.id}]`],
        limitations: [
          `Plan extent is BRAGE's; the spec states no sill or head for a rooflight, so its height is derived from the ${r0.pitch_deg}° roof plane at that Z.`,
          "Anything visible through this opening is a VISUALIZATION. No outlook or sightline is claimed."
        ],
        geometry: {
          primitive: "GRID_SURFACE", size_m: Math.abs(ox1 - ox0), segments: 1,
          vertices: [
            [ox0, yAt(oz0) + 0.02, oz0], [ox1, yAt(oz0) + 0.02, oz0],
            [ox0, yAt(oz1) + 0.02, oz1], [ox1, yAt(oz1) + 0.02, oz1]
          ],
          method: "PLANE_FROM_SPEC", height_reference: "LOCAL_RELATIVE"
        },
        opening_schedule: {
          wall: o.wall, opening_type: o.type, sill_m: o.sill_m ?? null, head_m: o.head_m ?? null,
          length_m: o.length_m ?? null, area_m2: o.area_m2 ?? null, glazing: o.glazing ?? null,
          is_door: false, in_roof_plane: true,
          source: "BRAGE_SPEC_V03_OPENING_SCHEDULE"
        }
      });
    }

    // ── walls, cut around their openings ────────────────────────────────────
    const byWall = new Map();
    for (const o of (room.openings ?? []).filter(x => !/^ROOF/i.test(x.wall ?? ""))) {
      if (!byWall.has(o.wall)) byWall.set(o.wall, []);
      byWall.get(o.wall).push(o);
    }

    for (const seg of room.wall_segments ?? []) {
      const segOpenings = (byWall.get(seg.faces) ?? []).map(o => ({
        ...o,
        t0: along(seg, o.from_xz),
        t1: along(seg, o.to_xz)
      }));
      const voids = mergeVoids(segOpenings);
      const panels = wallPanels(seg, voids, seg.height_m);

      // Under the pitch, a wall stops where the roof starts. The spec gives every
      // upper wall the room's clear height (2.02 m) and states knee_wall_m
      // separately — taken literally the walls punch straight through the roof.
      // Each panel's top is clamped to the roof plane over its own Z extent, so
      // the eaves sides become knee walls and the gable ends follow the slope.
      const underPitchWall = room.storey === "UPPER";
      panels.forEach((panel, i) => {
        if (underPitchWall) {
          const r0 = spec.roof;
          const ridgeZ = r0.ridge_xz[0][1];
          const tp = Math.tan((r0.pitch_deg * Math.PI) / 180);
          const roofYAt = z => r0.ridge_Y - Math.abs(z - ridgeZ) * tp;
          const [pax, paz] = seg.from_xz;
          const [pbx, pbz] = seg.to_xz;
          const segLen = Math.hypot(pbx - pax, pbz - paz) || 1;
          const zAt = t => paz + ((pbz - paz) / segLen) * t;
          const lowestRoof = Math.min(roofYAt(zAt(panel.t0)), roofYAt(zAt(panel.t1)));
          const maxTop = lowestRoof - base - 0.02;
          if (maxTop <= 0.05) return;                 // no wall left under the roof here
          panel.y1 = Math.min(panel.y1, maxTop);
          if (panel.y1 <= panel.y0 + 0.02) return;
        }
        const box = panelBox(seg, panel, base);
        elements.push({
          id: `${seg.id}_P${i}`, type: "WALL",
          label: `${seg.id} ${panel.kind}`,
          evidence_class: "CONCEPT",
          source_refs: [...ref, `wall_segments[${seg.id}]`],
          limitations: [
            "Concept wall. Thickness is a model convention, not a construction build-up.",
            room.storey === "UPPER"
              ? `Top clamped to the ${spec.roof.pitch_deg}° roof plane: the spec states this wall at the room's ${seg.height_m} m clear height and gives knee_wall_m ${spec.upper_floor_derivation.knee_wall_m} separately, so the physical wall stops under the roof.`
              : null,
            voids.length ? "Cut around the openings BRAGE's schedule states for this wall." : "No opening is stated on this wall."
          ].filter(Boolean),
          geometry: { primitive: "BOX", ...box }
        });
      });

      // the openings themselves
      for (const o of segOpenings) {
        openingCount += 1;
        const [ax, az] = o.from_xz;
        const [bx, bz] = o.to_xz;
        const runX = Math.abs(bx - ax);
        const runZ = Math.abs(bz - az);
        const horizontal = runX >= runZ;
        const isDoor = /DOOR/i.test(o.type ?? "");
        elements.push({
          id: o.id, type: "OPENING",
          label: `${o.id} — ${String(o.type ?? "opening").replace(/_/g, " ").toLowerCase()} · ${o.wall}`,
          evidence_class: "CONCEPT",
          source_refs: [...ref, `openings[${o.id}]`],
          limitations: [
            `Extent, sill ${o.sill_m} m and head ${o.head_m} m are BRAGE's stated values; frame and ironmongery are not specified.`,
            o.note ? `Spec note: ${o.note}` : null,
            "Anything visible through this opening is a VISUALIZATION. No outlook or sightline is claimed or measured."
          ].filter(Boolean),
          geometry: {
            primitive: "BOX",
            size: [Math.max(runX, runZ), o.head_m - o.sill_m, GLASS_T],
            position: [(ax + bx) / 2, base + (o.sill_m + o.head_m) / 2, (az + bz) / 2],
            rotation_y_deg: horizontal ? 0 : 90
          },
          opening_schedule: {
            wall: o.wall, opening_type: o.type, sill_m: o.sill_m, head_m: o.head_m,
            length_m: o.length_m, area_m2: o.area_m2, glazing: o.glazing, is_door: isDoor,
            source: "BRAGE_SPEC_V03_OPENING_SCHEDULE"
          }
        });
      }
    }
  }

  // Every opening the spec states must have become an element. A wall face this
  // compiler does not understand (a rooflight was the first) would otherwise drop
  // out in silence and the house would quietly lose a window.
  const specOpeningIds = spec.rooms.flatMap(r => (r.openings ?? []).map(o => o.id));
  const emittedIds = new Set(elements.filter(e => e.type === "OPENING").map(e => e.id));
  const dropped = specOpeningIds.filter(id => !emittedIds.has(id));
  if (dropped.length) {
    throw new Error(
      `${dropped.length} opening(s) in the spec were not built: ${dropped.join(", ")}. ` +
      "Every opening must map to an element — check the wall face against the room's wall_segments."
    );
  }

  // ── roof (read order: roof, then wing_roof) ───────────────────────────────
  const roof = spec.roof;
  const [[rx0, rz], [rx1]] = roof.ridge_xz;
  const halfSpan = roof.span_m / 2;
  const oh = roof.eaves_overhang_m;
  const eavesY = roof.eaves_Y;
  const ridgeY = roof.ridge_Y;

  const roofPlane = (id, label, zEave) => {
    const dir = Math.sign(zEave - rz);
    const zE = rz + dir * (halfSpan + oh);
    // Eaves overhang follows the pitch, so the tip sits below the plate.
    const yE = eavesY - oh * Math.tan((roof.pitch_deg * Math.PI) / 180);
    return {
      id, type: "ROOF", label,
      evidence_class: "CONCEPT",
      source_refs: [`${spec.spec_id} roof`],
      limitations: [
        `${roof.pitch_deg}° ${roof.type.toLowerCase()}, ridge ${roof.ridge_axis.replace("_", "–").toLowerCase()} at Y ${ridgeY} m, eaves Y ${eavesY} m, ${oh} m overhang — BRAGE's stated values.`,
        `Covering ${roof.covering}. No structure, build-up, gutter or flashing is modelled.`
      ],
      geometry: {
        primitive: "GRID_SURFACE", size_m: Math.abs(rx1 - rx0), segments: 1,
        vertices: [
          [rx0 - oh, ridgeY, rz], [rx1 + oh, ridgeY, rz],
          [rx0 - oh, yE, zE], [rx1 + oh, yE, zE]
        ],
        method: "PLANE_FROM_SPEC", height_reference: "LOCAL_RELATIVE"
      }
    };
  };

  elements.push(roofPlane("ROOF_GABLE_SOUTH", "Gable roof — south plane (PV-ready)", rz - halfSpan));
  elements.push(roofPlane("ROOF_GABLE_NORTH", "Gable roof — north plane", rz + halfSpan));

  const wing = spec.wing_roof;
  const wingRooms = spec.rooms.filter(r => {
    const b = bbox(r.footprint_xz);
    return b.minZ >= rz + halfSpan - 1e-9;          // everything north of the bar
  });
  if (wingRooms.length) {
    const wx0 = Math.min(...wingRooms.map(r => bbox(r.footprint_xz).minX));
    const wx1 = Math.max(...wingRooms.map(r => bbox(r.footprint_xz).maxX));
    const wz0 = Math.min(...wingRooms.map(r => bbox(r.footprint_xz).minZ));
    const wz1 = Math.max(...wingRooms.map(r => bbox(r.footprint_xz).maxZ));
    const woh = wing.eaves_overhang_m;
    const rise = (wz1 - wz0 + woh * 2) * Math.tan((wing.pitch_deg * Math.PI) / 180);
    elements.push({
      id: "ROOF_WING_MONO", type: "ROOF",
      label: "Cold wing roof — 15° monopitch falling north",
      evidence_class: "CONCEPT",
      source_refs: [`${spec.spec_id} wing_roof`],
      limitations: [
        `${wing.pitch_deg}° monopitch falling ${wing.falls_towards.toLowerCase()}, plate Y ${wing.wall_plate_Y} m, ${woh} m overhang — BRAGE's stated values.`,
        `Covering ${wing.covering}. ${wing.note}`
      ],
      geometry: {
        primitive: "GRID_SURFACE", size_m: wx1 - wx0, segments: 1,
        vertices: [
          [wx0 - woh, wing.wall_plate_Y, wz0 - woh], [wx1 + woh, wing.wall_plate_Y, wz0 - woh],
          [wx0 - woh, wing.wall_plate_Y - rise, wz1 + woh], [wx1 + woh, wing.wall_plate_Y - rise, wz1 + woh]
        ],
        method: "PLANE_FROM_SPEC", height_reference: "LOCAL_RELATIVE"
      }
    });
    notes.push(`wing roof spans x[${wx0}, ${wx1}] z[${wz0}, ${wz1}] over ${wingRooms.length} rooms`);
  }

  // ── ground plane, for the exterior still to sit on ────────────────────────
  const allB = spec.rooms.map(r => bbox(r.footprint_xz));
  const gx0 = Math.min(...allB.map(b => b.minX)) - 8;
  const gx1 = Math.max(...allB.map(b => b.maxX)) + 8;
  const gz0 = Math.min(...allB.map(b => b.minZ)) - 8;
  const gz1 = Math.max(...allB.map(b => b.maxZ)) + 8;
  elements.unshift({
    id: "SITE_GROUND", type: "TERRAIN", label: "Ground plane", evidence_class: "CONCEPT",
    source_refs: ["HOUSE_COMPILER"],
    limitations: [
      "Flat reference plane at finished ground level. The real plot falls ~6 m to the south-west; terrain is NOT modelled here.",
      "Not a site, not a survey, and not the plot's actual ground."
    ],
    geometry: {
      primitive: "GRID_SURFACE", size_m: Math.max(gx1 - gx0, gz1 - gz0), segments: 1,
      vertices: [[gx0, 0, gz0], [gx1, 0, gz0], [gx0, 0, gz1], [gx1, 0, gz1]],
      method: "FLAT", height_reference: "LOCAL_RELATIVE"
    }
  });

  // ── clearance check: a roof must not pass through the rooms it covers ─────
  // Built from the spec as stated, then checked. Where the two disagree the
  // model keeps the spec's numbers and SAYS SO — silently re-pitching someone
  // else's roof to make a render look right would hide a real design conflict.
  const conflicts = [];
  for (const plane of elements.filter(e => e.type === "ROOF")) {
    const vs = plane.geometry.vertices;
    const zs = vs.map(v => v[2]);
    const xs = vs.map(v => v[0]);
    const planeAt = z => {
      const z0 = Math.min(...zs), z1 = Math.max(...zs);
      const y0 = vs.find(v => Math.abs(v[2] - z0) < 1e-9)[1];
      const y1 = vs.find(v => Math.abs(v[2] - z1) < 1e-9)[1];
      const t = z1 === z0 ? 0 : (z - z0) / (z1 - z0);
      return y0 + (y1 - y0) * t;
    };
    for (const room of elements.filter(e => e.type === "ROOM")) {
      const g = room.geometry;
      const rx0 = g.position[0] - g.size[0] / 2, rx1 = g.position[0] + g.size[0] / 2;
      const rz0 = g.position[2] - g.size[2] / 2, rz1 = g.position[2] + g.size[2] / 2;
      const top = g.position[1] + g.size[1] / 2;
      const overlapsX = rx1 > Math.min(...xs) + 1e-6 && rx0 < Math.max(...xs) - 1e-6;
      const overlapsZ = rz1 > Math.min(...zs) + 1e-6 && rz0 < Math.max(...zs) - 1e-6;
      if (!overlapsX || !overlapsZ) continue;

      // A room in the roof is SUPPOSED to be inside the roof: its ceiling follows
      // the pitch, and the flat-topped box this compiler draws is a simplification
      // of that, not a collision. Reporting those as spec conflicts would be
      // accusing BRAGE of a fault that belongs to the model.
      if (room.storey_under_pitch) continue;
      const lowest = Math.min(planeAt(Math.max(rz0, Math.min(...zs))), planeAt(Math.min(rz1, Math.max(...zs))));
      if (lowest < top - 1e-6) {
        conflicts.push({
          roof: plane.id, room: room.id,
          room_top_y: Number(top.toFixed(3)),
          roof_low_y: Number(lowest.toFixed(3)),
          shortfall_m: Number((top - lowest).toFixed(3))
        });
      }
    }
  }

  if (conflicts.length) {
    const byRoof = new Map();
    for (const c of conflicts) {
      if (!byRoof.has(c.roof)) byRoof.set(c.roof, []);
      byRoof.get(c.roof).push(c);
    }
    for (const [roofId, list] of byRoof) {
      const plane = elements.find(e => e.id === roofId);
      const worst = list.reduce((a, b) => (b.shortfall_m > a.shortfall_m ? b : a));
      plane.limitations.push(
        `SPEC CONFLICT — as stated, this plane passes through ${list.length} room(s) beneath it. ` +
        `Worst: ${worst.room} needs ${worst.room_top_y} m, the plane is at ${worst.roof_low_y} m (${worst.shortfall_m} m short). ` +
        "Built to the spec's stated pitch and plate; not silently re-pitched. BRAGE to resolve."
      );
      plane.evidence_class = "CONCEPT";
    }
  }

  return { elements, spec, openingCount, notes, conflicts };
}

export function houseScene(spec = readSpec()) {
  const { elements, openingCount, notes, conflicts } = buildHouse(spec);
  const area = spec.area_summary;

  return {
    conflicts,
    scene: {
      scene_version: "twin-scene/v0.1",
      entity_type: "ConceptHouseSceneExport",
      scene_id: "SCENE_HOUSE_VINKELHUSET_V03",
      generated_at: new Date().toISOString(),
      subject: {
        label: `${spec.subject?.concept_name ?? "Vinkelhuset"} — whole-house concept model`,
        identity_evidence_class: "CONCEPT",
        identity_scope: "CONCEPT_HOUSE_DESIGN"
      },
      coordinate_system: {
        frame: "LOCAL_ENU", axes: { x: "EAST", y: "UP", z: "NORTH" }, origin_wgs84: [0, 0],
        horizontal_reference: spec.coordinate_system.convention,
        vertical_reference: "LOCAL_RELATIVE_UNCALIBRATED", linear_units: "metre",
        evidence_class: "CONCEPT",
        limitations: ["House frame is BRAGE's concept scene, not a surveyed set-out."]
      },
      source_bindings: [
        { path: "scripts/compile-house.mjs", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "HOUSE_COMPILER" },
        { path: "BRAGE/geometry/house-v0.3-geometry-spec.json", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "HOUSE_GEOMETRY_SPEC" }
      ],
      evidence_classes: ["AUTHORITATIVE", "INDICATIVE", "DERIVED", "REPORTED_UNVERIFIED", "CONCEPT"],
      legal_claim_policy: {
        visualisation_allowed: true, concept_design_allowed: true,
        blocked_claims: ["LEGAL_BOUNDARY", "REGISTERED_AREA", "ENTITLEMENT", "BUILDABLE_ENVELOPE", "VIEW_OR_OUTLOOK", "FLOOR_LEVEL", "FLOOR_AREA"],
        rule: `Every element is CONCEPT: BRAGE's design proposal, with no entitlement, buildable envelope, floor level or access established. Areas are the spec's own computed figures — heated ${area.heated_m2_excl_souterrain} m² excluding the souterrain — and the upper floor counts only the band clearing ${spec.upper_floor_derivation.headroom_min_m} m headroom (${spec.upper_floor_derivation.usable_width_m} m of its ${spec.upper_floor_derivation.span_m} m structural span), which is why the model is wider than the area. Any horizon in a render is a VISUALIZATION, never a view claim. Terrain is not modelled.`
      },
      presentation: { profiles: ["INTELLIGENCE", "REALISTIC", "SYSTEMS"], default_profile: "REALISTIC", default_stage: "EXTERIOR" },
      navigation: [
        { id: "EXTERIOR", label: "The house", camera: [26, 16, -26], target: [-1, 2.4, -0.5], visible_groups: ["TERRAIN", "ROOF", "WALL", "OPENING", "FLOOR_SLAB"], cutaway: false, labels: false },
        { id: "DOLLHOUSE", label: "Dollhouse", camera: [22, 19, -20], target: [-1, 1.6, -0.5], visible_groups: ["TERRAIN", "ROOM", "WALL", "OPENING", "FLOOR_SLAB"], cutaway: true, labels: true },
        { id: "GROUND", label: "Ground floor", camera: [4, 22, 4], target: [-1, 0, -0.5], visible_groups: ["ROOM", "WALL", "OPENING", "FLOOR_SLAB"], cutaway: true, labels: true },
        { id: "APPROACH", label: "From the arrival court", camera: [16, 6, 24], target: [2, 2, 5], visible_groups: ["TERRAIN", "ROOF", "WALL", "OPENING", "FLOOR_SLAB"], cutaway: false, labels: false }
      ],
      elements,
      house_summary: {
        spec_id: spec.spec_id,
        spec_version: spec.spec_version,
        generated_at: spec.generated_at,
        rooms: spec.rooms.length,
        openings: openingCount,
        // Straight from the spec. This compiler never sums footprints into an area.
        heated_m2_excl_souterrain: area.heated_m2_excl_souterrain,
        heated_m2_incl_souterrain: area.heated_m2_incl_souterrain,
        cold_m2: area.cold_m2,
        ground_footprint_m2: area.ground_footprint_m2,
        by_storey: area.by_storey,
        upper_floor: spec.upper_floor_derivation,
        area_source: "BRAGE_SPEC_V03_AREA_SUMMARY",
        // Disclosed, not corrected: see the roof elements' limitations.
        spec_conflicts: conflicts
      }
    },
    notes
  };
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  const outIdx = process.argv.indexOf("--out");
  const outputPath = outIdx !== -1 && process.argv[outIdx + 1]
    ? path.resolve(process.argv[outIdx + 1])
    : path.join(root, "data/scenes/house-vinkelhuset/scene-v0.1.json");

  const spec = readSpec();
  const { scene, notes, conflicts } = houseScene(spec);
  const parsed = parseScene(scene);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(scene, null, 2)}\n`);

  const byType = {};
  for (const e of parsed.elements) byType[e.type] = (byType[e.type] ?? 0) + 1;
  const s = scene.house_summary;

  console.log(`wrote ${path.relative(root, outputPath)}`);
  console.log(`  spec        ${s.spec_id} · ${s.spec_version} · generated ${s.generated_at}`);
  console.log(`  elements    ${parsed.elements.length} — ${Object.entries(byType).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(" · ")}`);
  console.log(`  rooms       ${s.rooms} · openings ${s.openings}`);
  console.log(`  areas       heated ${s.heated_m2_excl_souterrain} m² excl souterrain · ${s.heated_m2_incl_souterrain} m² incl · cold ${s.cold_m2} m² (spec figures, not summed here)`);
  console.log(`  upper floor ${s.upper_floor.usable_width_m} m usable of ${s.upper_floor.span_m} m span · model extrudes the structure, area counts the band`);
  for (const n of notes) console.log(`  note        ${n}`);
  if (conflicts.length) {
    console.warn(`\n  ⚠ ${conflicts.length} SPEC CONFLICT(S) — built as stated and disclosed, not corrected:`);
    for (const c of conflicts) {
      console.warn(`      ${c.roof} passes through ${c.room}: room top ${c.room_top_y} m, roof ${c.roof_low_y} m (${c.shortfall_m} m short)`);
    }
    console.warn("      BRAGE to resolve; this compiler does not re-pitch someone else's roof.");
  }
}
