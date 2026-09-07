/**
 * Newport living room — shoppable scene from the channel-tracked catalog.
 *
 * Reads the Newport catalog (13,036 rows), selects real in-stock pieces whose
 * G2 proxies fit the room layout, and emits a twin-scene where every BUY is
 * the row's affiliate_link verbatim.
 *
 *   node scripts/compile-newport-room.mjs [--out path]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseScene } from "../engine/core/scene-contract.mjs";
import { glbBounds } from "../engine/compile/glb-bounds.mjs";
import { composeRoom } from "../engine/compile/catalog-room.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AVATAR_REPO = path.resolve(root, "../repo-avatar-factory");
const CATALOG = path.join(AVATAR_REPO, "data/newport/newport-catalog.jsonl");
const AVATAR_DIR = path.join(AVATAR_REPO, "data/geometry/avatars");

export function loadCatalog(file = CATALOG) {
  return fs.readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

const boundsCache = new Map();

/** Resolve a Newport row's G2 proxy and derive its real bounds. */
export function resolveNewportGeometry(row) {
  if (boundsCache.has(row.id)) return boundsCache.get(row.id);
  const file = path.join(AVATAR_DIR, `newport-${row.id}-g2-proxy.glb`);
  let result = null;
  if (fs.existsSync(file)) {
    try {
      result = {
        assetPath: `data/geometry/avatars/newport-${row.id}-g2-proxy.glb`,
        bounds: glbBounds(fs.readFileSync(file))
      };
    } catch {
      result = null;
    }
  }
  boundsCache.set(row.id, result);
  return result;
}

// Living room 6×5 m, centred at origin. Back wall z=-2.5, left wall x=-3.
// Each role reserves an envelope; selection picks the row that best fits it.
const ROLES = [
  {
    id: "SOFA", base_kind: "sofa",
    categories: ["2-4 sitssoffor", "Modulsoffor"],
    target: { width_m: 2.1, depth_m: 0.9 }, max_width_m: 2.6, max_depth_m: 1.1,
    position: [0, 0, -1.75], rotation_y_deg: 0
  },
  {
    id: "COFFEE_TABLE", base_kind: "low_table",
    categories: ["Soffbord"],
    target: { width_m: 1.2, depth_m: 0.65 }, max_width_m: 1.6, max_depth_m: 0.9,
    position: [0, 0, -0.25], rotation_y_deg: 0
  },
  {
    id: "ARMCHAIR", base_kind: "armchair",
    categories: ["Tygfåtöljer", "Skinnfåtöljer"],
    target: { width_m: 0.8, depth_m: 0.85 }, max_width_m: 1.1, max_depth_m: 1.1,
    position: [2.05, 0, -0.95], rotation_y_deg: -34
  },
  {
    id: "SIDE_TABLE", base_kind: "side_table",
    categories: ["Sidobord", "Avlastningsbord"],
    target: { width_m: 0.5, depth_m: 0.5 }, max_width_m: 0.75, max_depth_m: 0.75,
    position: [-1.7, 0, -1.5], rotation_y_deg: 0
  },
  {
    id: "MEDIA_UNIT", base_kind: "media_unit",
    categories: ["TV-bänkar & Mediabänkar"],
    target: { width_m: 1.7, depth_m: 0.45 }, max_width_m: 2.2, max_depth_m: 0.65,
    position: [-2.65, 0, 0.4], rotation_y_deg: 90
  },
  {
    id: "FOOTSTOOL", base_kind: null,
    categories: ["Fotpallar"],
    target: { width_m: 0.6, depth_m: 0.55 }, max_width_m: 0.9, max_depth_m: 0.9,
    position: [1.15, 0, 0.35], rotation_y_deg: 12
  }
];

// Decor attaches to the bases above. Rows in these categories ship no proxy,
// so they render as labelled boxes at nominal scale — stated in limitations.
const DECOR = [
  {
    id: "CUSHION_A", categories: ["Prydnadskuddar"], attaches_to: "SOFA",
    slot_id: "seat_back", slot_type: "seat_back", attaches: true,
    require_asset: false, require_size: false, nominal_size_m: [0.5, 0.5, 0.16],
    target: { width_m: 0.5 }, element_type: "FURNITURE"
  },
  {
    id: "CUSHION_B", categories: ["Prydnadskuddar", "Kuddfodral"], attaches_to: "SOFA",
    slot_id: "seat_back", slot_type: "seat_back", attaches: true,
    require_asset: false, require_size: false, nominal_size_m: [0.45, 0.45, 0.15],
    target: { width_m: 0.45 }, element_type: "FURNITURE"
  },
  {
    id: "VASE", categories: ["Vaser"], attaches_to: "COFFEE_TABLE",
    slot_id: "top", slot_type: "top", attaches: true,
    require_asset: false, require_size: false, nominal_size_m: [0.16, 0.3, 0.16],
    target: { width_m: 0.16 }, element_type: "FURNITURE"
  },
  {
    id: "TABLE_LAMP", categories: ["Bordslampor"], attaches_to: "SIDE_TABLE",
    slot_id: "top", slot_type: "top", attaches: true,
    target: { width_m: 0.32 }, max_width_m: 0.5,
    element_type: "FURNITURE"
  },
  {
    id: "RUG", categories: ["Ullmattor"],
    require_asset: false, require_size: false, nominal_size_m: [2.6, 0.012, 1.9],
    target: { width_m: 2.6 }, position: [0, 0.004, -0.7], element_type: "FURNITURE"
  }
];

// Decor role specs need attaches_to → slot_type wiring for the resolver.
for (const d of DECOR) if (d.attaches) d.attaches_to = d.attaches_to;

function roomShell() {
  return [
    {
      id: "ROOM_FLOOR", type: "TERRAIN", label: "Room floor", evidence_class: "CONCEPT",
      geometry: { primitive: "GRID_SURFACE", size_m: 8, segments: 1, vertices: [[-4, 0, -4], [4, 0, -4], [-4, 0, 4], [4, 0, 4]], method: "FLAT", height_reference: "LOCAL_RELATIVE" },
      source_refs: ["NEWPORT_ROOM_COMPILER"],
      limitations: ["Synthetic room shell for product display."]
    },
    {
      id: "ROOM_VOLUME", type: "ROOM", label: "Living room", evidence_class: "CONCEPT",
      geometry: { primitive: "ROOM_VOLUME", size: [6, 2.7, 5], position: [0, 1.35, 0], rotation_y_deg: 0, intended_use: "LIVING" },
      source_refs: ["NEWPORT_ROOM_COMPILER"],
      limitations: ["Synthetic room for product display."]
    },
    {
      id: "ROOM_WINDOW", type: "OPENING", label: "South window", evidence_class: "CONCEPT",
      geometry: { primitive: "BOX", size: [2.4, 1.6, 0.12], position: [0, 1.7, 2.5], rotation_y_deg: 0 },
      source_refs: ["NEWPORT_ROOM_COMPILER"],
      limitations: ["Synthetic opening for light."]
    }
  ];
}

export function buildNewportRoom() {
  const rows = loadCatalog();

  const { elements, report, errors } = composeRoom({
    rows,
    roles: ROLES,
    decor: DECOR,
    resolveGeometry: resolveNewportGeometry
  });

  const scene = {
    scene_version: "twin-scene/v0.1",
    entity_type: "ShoppableRoomSceneExport",
    scene_id: "SCENE_SHOPPABLE_ROOM_NEWPORT_LIVING_V01",
    generated_at: new Date().toISOString(),
    subject: {
      label: "Newport Living Room — shoppable, channel-tracked",
      identity_evidence_class: "CONCEPT",
      identity_scope: "SYNTHETIC_SHOPPABLE_ROOM"
    },
    coordinate_system: {
      frame: "LOCAL_ENU", axes: { x: "EAST", y: "UP", z: "NORTH" }, origin_wgs84: [0, 0],
      horizontal_reference: "SYNTHETIC — not a real location",
      vertical_reference: "LOCAL_RELATIVE_UNCALIBRATED", linear_units: "metre",
      evidence_class: "CONCEPT", limitations: ["Synthetic room — not a real site."]
    },
    source_bindings: [
      { path: "scripts/compile-newport-room.mjs", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "ROOM_COMPILER" },
      { path: "../repo-avatar-factory/data/newport/newport-catalog.jsonl", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "CHANNEL_CATALOG" },
      { path: "../repo-avatar-factory/data/geometry/avatars/", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "G2_PROXY_LIBRARY" }
    ],
    evidence_classes: ["AUTHORITATIVE", "INDICATIVE", "DERIVED", "REPORTED_UNVERIFIED", "CONCEPT"],
    legal_claim_policy: {
      visualisation_allowed: true, concept_design_allowed: true,
      blocked_claims: ["LEGAL_BOUNDARY", "REGISTERED_AREA", "ENTITLEMENT"],
      rule: "A shoppable room claims nothing about any real site. Product geometry is a G2 proxy: real footprint and height, representative shape. BUY links carry the channel's own tracking parameters verbatim."
    },
    presentation: {
      profiles: ["INTELLIGENCE", "REALISTIC", "SYSTEMS"],
      default_profile: "REALISTIC", default_stage: "ROOM"
    },
    navigation: [
      { id: "ROOM", label: "Room", camera: [4.5, 3.2, 4.5], target: [0, 0.8, -0.5], visible_groups: ["TERRAIN", "ROOM", "OPENING", "FURNITURE"], cutaway: false, labels: false },
      { id: "SEATING", label: "Seating area", camera: [2.8, 1.8, 2.2], target: [0, 0.5, -1.0], visible_groups: ["FURNITURE", "TERRAIN"], cutaway: false, labels: true },
      { id: "MEDIA", label: "Media wall", camera: [-1.4, 1.6, 2.6], target: [-2.5, 0.7, 0.4], visible_groups: ["FURNITURE", "TERRAIN", "ROOM"], cutaway: false, labels: true }
    ],
    elements: [...roomShell(), ...elements]
  };

  return { scene, report, errors };
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  const outArg = process.argv.indexOf("--out");
  const outputPath = outArg !== -1 && process.argv[outArg + 1]
    ? path.resolve(process.argv[outArg + 1])
    : path.join(root, "data/scenes/shoppable-room-newport-living/scene-v0.1.json");

  const { scene, report, errors } = buildNewportRoom();
  const parsed = parseScene(scene);

  if (errors.length) console.warn(`  attach warnings: ${errors.join("; ")}`);

  const shoppable = parsed.elements.filter(e => e.commerce);
  const tracked = shoppable.filter(e => /[?&](a|as|tk)=/.test(e.commerce.buy_url ?? ""));

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(scene, null, 2)}\n`);

  console.log(`wrote ${path.relative(root, outputPath)}`);
  console.log(`  elements ${parsed.elements.length} · shoppable ${shoppable.length} · channel-tracked BUY ${tracked.length}`);
  console.log(`  stages ${parsed.stages.length} · profiles ${parsed.presentation.profiles.join(", ")}`);
  console.log("");
  for (const r of report) {
    if (r.state === "SELECTED") {
      console.log(`  ${r.role.padEnd(13)} sku ${String(r.sku).padEnd(8)} fit ${String(r.fit_score).padEnd(7)} of ${String(r.candidates).padStart(4)} cand · ${r.title.slice(0, 44)}`);
    } else {
      console.log(`  ${r.role.padEnd(13)} ${r.state}`);
    }
  }
}
