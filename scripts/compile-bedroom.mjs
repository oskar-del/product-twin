/**
 * Bedroom — look #3, across three channels.
 *
 * Kungsängen for the bed (23,822 rows, 93% WD_SOURCE_H_DEFAULT), Lampemesteren
 * for the lighting, Newport for the case goods that neither of the other two
 * carries. This is the look that proves the engine is not hard-wired to one
 * catalog, and the first one where most placed items have a REAL width and
 * depth with an INVENTED height — so the panel must say "height: category
 * default" and the chip must stay INDICATIVE.
 *
 * Kungsängen ships no leaf category on any row, so its roles select on the
 * title instead; its twins carry no GLB, so its items render as labelled boxes
 * at the twin's stated size.
 *
 *   node scripts/compile-bedroom.mjs [--out path]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseScene } from "../engine/core/scene-contract.mjs";
import { composeRoom } from "../engine/compile/catalog-room.mjs";
import { twinResolver } from "../engine/compile/twin-geometry.mjs";
import { resolveNewportGeometry, loadCatalog as loadNewport } from "./compile-newport-room.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AVATAR = path.resolve(root, "../repo-avatar-factory");

const readJsonl = f => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));

const kungsangenGeometry = twinResolver({ avatarRepo: AVATAR, prefix: "PT_KUNGSANGEN", localRoot: root });
const lampemesterenGeometry = twinResolver({ avatarRepo: AVATAR, prefix: "PT_LAMPEMESTEREN", localRoot: root });

// 4.2 x 4.4 m bedroom, bed against the north wall.
const ROLES = [
  {
    id: "BED", base_kind: null, channel: "kungsangen",
    title_match: /\bsäng\b/i, min_tier: "WD_SOURCE_H_DEFAULT",
    target: { width_m: 1.8, depth_m: 2.1 }, max_width_m: 2.1, max_depth_m: 2.3,
    position: [0, 0, 1.0], rotation_y_deg: 180, require_asset: false
  },
  {
    id: "NIGHTSTAND_L", base_kind: "side_table", channel: "newport",
    categories: ["Sidobord", "Avlastningsbord"],
    target: { width_m: 0.45, depth_m: 0.4 }, max_width_m: 0.6, max_depth_m: 0.6,
    position: [-1.25, 0, 1.7], rotation_y_deg: 0
  },
  {
    id: "NIGHTSTAND_R", base_kind: "side_table", channel: "newport",
    categories: ["Sidobord", "Avlastningsbord"],
    target: { width_m: 0.45, depth_m: 0.4 }, max_width_m: 0.6, max_depth_m: 0.6,
    position: [1.25, 0, 1.7], rotation_y_deg: 0
  },
  {
    id: "DRESSER", base_kind: "media_unit", channel: "newport",
    categories: ["Byråer", "TV-bänkar & Mediabänkar"],
    target: { width_m: 1.1, depth_m: 0.45 }, max_width_m: 1.6, max_depth_m: 0.6,
    position: [-1.75, 0, -1.4], rotation_y_deg: 90
  },
  {
    id: "ARMCHAIR", base_kind: null, channel: "newport",
    categories: ["Tygfåtöljer", "Skinnfåtöljer"],
    target: { width_m: 0.78, depth_m: 0.8 }, max_width_m: 1.0, max_depth_m: 1.0,
    position: [1.5, 0, -1.3], rotation_y_deg: -140
  }
];

const DECOR = [
  {
    id: "BEDSIDE_LAMP", channel: "lampemesteren",
    categories: ["Bordslampor"], min_tier: "WD_SOURCE_H_DEFAULT",
    attaches_to: "NIGHTSTAND_L", slot_id: "top", slot_type: "top", attaches: true,
    require_asset: false, target: { width_m: 0.28 }, max_width_m: 0.5
  },
  {
    id: "RUG", channel: "newport", categories: ["Ullmattor"],
    require_asset: false, require_size: false, nominal_size_m: [2.4, 0.012, 1.8],
    target: { width_m: 2.4 }, position: [0, 0.004, -0.2]
  }
];

/** One resolver that dispatches on the role's channel. */
function makeResolver(roleByRowId) {
  return function resolve(row) {
    if (row.source === "kungsangen") return kungsangenGeometry(row);
    if (row.source === "lampemesteren") return lampemesterenGeometry(row);
    return resolveNewportGeometry(row);
  };
}

function shell() {
  const W = 4.2, D = 4.4, H = 2.5;
  const src = ["BEDROOM_COMPILER"];
  return [
    {
      id: "ROOM_FLOOR", type: "TERRAIN", label: "Bedroom floor", evidence_class: "CONCEPT",
      geometry: {
        primitive: "GRID_SURFACE", size_m: Math.max(W, D), segments: 1,
        vertices: [[-W / 2, 0, -D / 2], [W / 2, 0, -D / 2], [-W / 2, 0, D / 2], [W / 2, 0, D / 2]],
        method: "FLAT", height_reference: "LOCAL_RELATIVE"
      },
      source_refs: src, limitations: ["Synthetic room shell for product display."]
    },
    {
      id: "ROOM_VOLUME", type: "ROOM", picking: false, label: "Bedroom", evidence_class: "CONCEPT",
      geometry: { primitive: "ROOM_VOLUME", size: [W, H, D], position: [0, H / 2, 0], rotation_y_deg: 0, intended_use: "SLEEPING" },
      source_refs: src, limitations: ["Synthetic room for product display."]
    }
  ];
}

export function buildBedroom() {
  const rows = [
    ...loadNewport(),
    ...readJsonl(path.join(AVATAR, "data/kungsangen/kungsangen-catalog.jsonl")),
    ...readJsonl(path.join(AVATAR, "data/lampemesteren/lampemesteren-catalog.jsonl"))
  ];

  const { elements, report, errors } = composeRoom({
    rows, roles: ROLES, decor: DECOR, resolveGeometry: makeResolver()
  });

  const scene = {
    scene_version: "twin-scene/v0.1",
    entity_type: "ShoppableRoomSceneExport",
    scene_id: "SCENE_SHOPPABLE_BEDROOM_V01",
    generated_at: new Date().toISOString(),
    subject: {
      label: "Bedroom — Kungsängen · Lampemesteren · Newport",
      identity_evidence_class: "CONCEPT", identity_scope: "SYNTHETIC_SHOPPABLE_ROOM"
    },
    coordinate_system: {
      frame: "LOCAL_ENU", axes: { x: "EAST", y: "UP", z: "NORTH" }, origin_wgs84: [0, 0],
      horizontal_reference: "SYNTHETIC — not a real location",
      vertical_reference: "LOCAL_RELATIVE_UNCALIBRATED", linear_units: "metre",
      evidence_class: "CONCEPT", limitations: ["Synthetic room — not a real site."]
    },
    source_bindings: [
      { path: "scripts/compile-bedroom.mjs", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "ROOM_COMPILER" },
      { path: "../repo-avatar-factory/data/kungsangen/kungsangen-catalog.jsonl", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "CHANNEL_CATALOG" },
      { path: "../repo-avatar-factory/data/lampemesteren/lampemesteren-catalog.jsonl", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "CHANNEL_CATALOG" },
      { path: "../repo-avatar-factory/data/newport/newport-catalog.jsonl", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "CHANNEL_CATALOG" }
    ],
    evidence_classes: ["AUTHORITATIVE", "INDICATIVE", "DERIVED", "REPORTED_UNVERIFIED", "CONCEPT"],
    legal_claim_policy: {
      visualisation_allowed: true, concept_design_allowed: true,
      blocked_claims: ["LEGAL_BOUNDARY", "REGISTERED_AREA", "ENTITLEMENT", "PRODUCT_DIMENSION"],
      rule: "A shoppable room claims nothing about any real site. Most items here have a width and depth the merchant stated and a height taken from a per-category default table — the panel says so per item, and no defaulted figure may be quoted as a product dimension. BUY links carry the channel's own tracking parameters verbatim."
    },
    presentation: { profiles: ["INTELLIGENCE", "REALISTIC", "SYSTEMS"], default_profile: "REALISTIC", default_stage: "ROOM" },
    navigation: [
      { id: "ROOM", label: "Bedroom", camera: [3.6, 2.8, 4.2], target: [0, 0.6, 0.2], visible_groups: ["TERRAIN", "ROOM", "FURNITURE"], cutaway: false, labels: false },
      { id: "BED", label: "The bed", camera: [1.9, 1.5, -1.6], target: [0, 0.5, 1.2], visible_groups: ["FURNITURE", "TERRAIN"], cutaway: false, labels: true }
    ],
    elements: [...shell(), ...elements]
  };

  return { scene, report, errors };
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  const outIdx = process.argv.indexOf("--out");
  const outputPath = outIdx !== -1 && process.argv[outIdx + 1]
    ? path.resolve(process.argv[outIdx + 1])
    : path.join(root, "data/scenes/shoppable-bedroom/scene-v0.1.json");

  const { scene, report, errors } = buildBedroom();
  const parsed = parseScene(scene);
  if (errors.length) console.warn(`  attach warnings: ${errors.join("; ")}`);

  const shoppable = parsed.elements.filter(e => e.commerce);
  const tracked = shoppable.filter(e => /[?&]as=/.test(e.commerce.buy_url ?? ""));
  const total = shoppable.reduce((s, e) => s + (e.commerce.price ?? 0), 0);
  const tiers = {};
  const channels = {};
  for (const e of shoppable) {
    tiers[e.commerce.dimension_tier] = (tiers[e.commerce.dimension_tier] ?? 0) + 1;
    channels[e.commerce.channel] = (channels[e.commerce.channel] ?? 0) + 1;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(scene, null, 2)}\n`);

  console.log(`wrote ${path.relative(root, outputPath)}`);
  console.log(`  elements ${parsed.elements.length} · shoppable ${shoppable.length} · tracked ${tracked.length} · ${total.toLocaleString("sv-SE")} SEK`);
  console.log(`  channels ${Object.entries(channels).map(([k, v]) => `${v} ${k}`).join(" · ")}`);
  console.log(`  tiers    ${Object.entries(tiers).map(([k, v]) => `${v} ${k}`).join(" · ")}`);
  console.log("");
  for (const r of report) {
    if (r.state === "SELECTED") {
      console.log(`  ${r.role.padEnd(14)} ${String(r.dimension_tier).padEnd(20)} of ${String(r.candidates).padStart(5)} cand · ${String(r.title).slice(0, 44)}`);
    } else {
      console.log(`  ${r.role.padEnd(14)} ${r.state}`);
    }
  }
}
