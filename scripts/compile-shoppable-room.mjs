/**
 * Shoppable room scene compiler.
 *
 * Reads twin records from data/twins/, places them in a furnished living room,
 * and emits a twin-scene/v0.1 document with commerce overlays on every element.
 * The scene is contract-valid and renders in the engine with click → product panel.
 *
 *   node scripts/compile-shoppable-room.mjs [--out path]
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {parseScene, PRIMITIVES} from "../engine/core/scene-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const twinsDir = path.join(root, "data/twins");

function loadTwin(filename) {
  return JSON.parse(fs.readFileSync(path.join(twinsDir, filename), "utf8"));
}

function dimMetres(twin) {
  const d = twin.physical?.dimensions_mm;
  if (!d) return null;
  return {w: d.width / 1000, d: d.depth / 1000, h: d.height / 1000};
}

function commerceFromTwin(twin) {
  const ei = twin.external_identities?.[0];
  const mfr = twin.identity?.manufacturer ?? "";
  const model = twin.identity?.model ?? twin.twin_id;
  return {
    product_name: `${mfr} ${model}`.trim(),
    brand: mfr || null,
    product_url: ei?.product_url ?? null,
    buy_url: ei?.affiliate_link ?? ei?.product_url ?? null,
    image_url: twin.media?.hero_image ?? null,
    price: null,
    currency: null,
    category: twin.category_id ?? null,
    color: null,
    dimensions_label: formatDimensions(twin)
  };
}

function formatDimensions(twin) {
  const d = twin.physical?.dimensions_mm;
  if (!d) return null;
  return `${d.width}×${d.depth}×${d.height} mm`;
}

const GEOMETRY_LEVEL_TO_EVIDENCE = {
  G0: "CONCEPT",
  G1: "REPORTED_UNVERIFIED",
  G2: "INDICATIVE",
  G3: "AUTHORITATIVE"
};

function twinElement(twin, placement, id) {
  const level = twin.geometry?.level ?? "G0";
  const evidenceClass = GEOMETRY_LEVEL_TO_EVIDENCE[level] ?? "CONCEPT";
  const dims = dimMetres(twin);
  const dimStr = dims ? ` (${twin.physical.dimensions_mm.width}×${twin.physical.dimensions_mm.depth}×${twin.physical.dimensions_mm.height} mm)` : "";

  return {
    id,
    type: "FURNITURE",
    label: `${twin.identity?.manufacturer ?? ""} ${twin.identity?.model ?? twin.twin_id}${dimStr}`.trim(),
    evidence_class: evidenceClass,
    geometry: {
      primitive: "GLTF_ASSET",
      asset_path: twin.geometry.asset_path,
      position: placement.position,
      rotation_y_deg: placement.rotation_y_deg ?? 0
    },
    source_refs: [`Product Twin ${twin.twin_id}`],
    limitations: [
      `Geometry level ${level}: ${twin.geometry.shape_claim ?? "proxy"}`,
      ...(twin.geometry.appearance?.exact_manufacturer_texture_or_finish_claimed === false
        ? ["Textures are representative, not manufacturer artwork."]
        : [])
    ],
    commerce: commerceFromTwin(twin)
  };
}

// Room shell: a simple box room 6×5m, 2.7m ceiling
function roomShell() {
  return [
    {
      id: "ROOM_FLOOR",
      type: "TERRAIN",
      label: "Room floor",
      evidence_class: "CONCEPT",
      geometry: {primitive: "GRID_SURFACE", size_m: 8, segments: 1, vertices: [[-4, 0, -4], [4, 0, -4], [-4, 0, 4], [4, 0, 4]], method: "FLAT", height_reference: "LOCAL_RELATIVE"},
      source_refs: ["SHOPPABLE_ROOM_COMPILER"],
      limitations: ["Synthetic room shell for product display."]
    },
    {
      id: "ROOM_VOLUME",
      type: "ROOM",
      label: "Living room",
      evidence_class: "CONCEPT",
      geometry: {primitive: "ROOM_VOLUME", size: [6, 2.7, 5], position: [0, 1.35, 0], rotation_y_deg: 0, intended_use: "LIVING"},
      source_refs: ["SHOPPABLE_ROOM_COMPILER"],
      limitations: ["Synthetic room for product display."]
    },
    {
      id: "ROOM_WINDOW",
      type: "OPENING",
      label: "South window",
      evidence_class: "CONCEPT",
      geometry: {primitive: "BOX", size: [2.4, 1.6, 0.12], position: [0, 1.7, 2.5], rotation_y_deg: 0},
      source_refs: ["SHOPPABLE_ROOM_COMPILER"],
      limitations: ["Synthetic opening for light."]
    }
  ];
}

// Furniture placement: a realistic living room layout
// Room is 6×5m centred at origin. Back wall at z=-2.5, front at z=+2.5.
// Sofa against back wall, coffee table in front, armchair to the side,
// TV bench on left wall, bookcase on right wall, rug under seating area,
// floor lamp beside armchair, side table beside sofa.
const FURNITURE_LAYOUT = [
  {file: "PT_IKEA_KIVIK_49440597.json",     id: "SOFA",        position: [0, 0, -1.8],    rotation_y_deg: 0},
  {file: "PT_IKEA_LISTERBY_30513904.json",  id: "COFFEE_TABLE", position: [0, 0, -0.2],   rotation_y_deg: 0},
  {file: "PT_IKEA_POANG_39240787.json",      id: "ARMCHAIR",    position: [2.0, 0, -1.0],  rotation_y_deg: -30},
  {file: "PT_IKEA_GLADOM_70578451.json",     id: "SIDE_TABLE",  position: [-1.6, 0, -1.5], rotation_y_deg: 0},
  {file: "PT_IKEA_BESTA_89330691.json",      id: "TV_BENCH",    position: [-2.7, 0, 0.5],  rotation_y_deg: 90},
  {file: "PT_IKEA_BILLY_00263850.json",      id: "BOOKCASE",    position: [2.7, 0, 0.8],   rotation_y_deg: -90},
  {file: "PT_IKEA_LOHALS_30511288.json",     id: "RUG",         position: [0, 0.005, -0.8], rotation_y_deg: 0},
  {file: "PT_IKEA_LAUTERS_30405042.json",    id: "FLOOR_LAMP",  position: [2.3, 0, -2.0],  rotation_y_deg: 0}
];

export function buildShoppableRoom() {
  const furnitureElements = FURNITURE_LAYOUT.map(item => {
    const twin = loadTwin(item.file);
    return twinElement(twin, {position: item.position, rotation_y_deg: item.rotation_y_deg}, item.id);
  });

  const scene = {
    scene_version: "twin-scene/v0.1",
    entity_type: "ShoppableRoomSceneExport",
    scene_id: "SCENE_SHOPPABLE_ROOM_IKEA_LIVING_V01",
    generated_at: new Date().toISOString(),
    subject: {
      label: "IKEA Living Room — shoppable product display",
      identity_evidence_class: "CONCEPT",
      identity_scope: "SYNTHETIC_SHOPPABLE_ROOM"
    },
    coordinate_system: {
      frame: "LOCAL_ENU",
      axes: {x: "EAST", y: "UP", z: "NORTH"},
      origin_wgs84: [0, 0],
      horizontal_reference: "SYNTHETIC — not a real location",
      vertical_reference: "LOCAL_RELATIVE_UNCALIBRATED",
      linear_units: "metre",
      evidence_class: "CONCEPT",
      limitations: ["Synthetic room — not a real site."]
    },
    source_bindings: [
      {path: "scripts/compile-shoppable-room.mjs", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "ROOM_COMPILER"},
      {path: "data/twins/", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "PRODUCT_TWIN_CATALOG"}
    ],
    evidence_classes: ["AUTHORITATIVE", "INDICATIVE", "DERIVED", "REPORTED_UNVERIFIED", "CONCEPT"],
    legal_claim_policy: {
      visualisation_allowed: true,
      concept_design_allowed: true,
      blocked_claims: ["LEGAL_BOUNDARY", "REGISTERED_AREA", "ENTITLEMENT"],
      rule: "A shoppable room claims nothing about any real site. Product twins carry their own evidence classes for geometry fidelity."
    },
    presentation: {
      profiles: ["INTELLIGENCE", "REALISTIC", "SYSTEMS"],
      default_profile: "REALISTIC",
      default_stage: "ROOM"
    },
    navigation: [
      {id: "ROOM", label: "Room", camera: [4.5, 3.2, 4.5], target: [0, 0.8, -0.5], visible_groups: ["TERRAIN", "ROOM", "OPENING", "FURNITURE"], cutaway: false, labels: false},
      {id: "SEATING", label: "Seating area", camera: [2.8, 1.8, 2.2], target: [0, 0.5, -1.0], visible_groups: ["FURNITURE", "TERRAIN"], cutaway: false, labels: true},
      {id: "STORAGE", label: "Storage wall", camera: [-1.5, 1.6, 2.5], target: [-2.5, 0.8, 0.5], visible_groups: ["FURNITURE", "TERRAIN", "ROOM"], cutaway: false, labels: true}
    ],
    elements: [
      ...roomShell(),
      ...furnitureElements
    ]
  };

  return scene;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  const outArg = process.argv.indexOf("--out");
  const outputPath = outArg !== -1 && process.argv[outArg + 1]
    ? path.resolve(process.argv[outArg + 1])
    : path.join(root, "data/scenes/shoppable-room-ikea-living/scene-v0.1.json");

  const scene = buildShoppableRoom();
  const parsed = parseScene(scene);

  const shoppable = parsed.elements.filter(e => e.commerce).length;
  const total = parsed.elements.length;

  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
  fs.writeFileSync(outputPath, `${JSON.stringify(scene, null, 2)}\n`);

  console.log(`wrote ${path.relative(root, outputPath)}`);
  console.log(`  elements ${total} (${shoppable} shoppable) · stages ${parsed.stages.length}`);
  console.log(`  furniture ${FURNITURE_LAYOUT.length} twins with GLB avatars`);
  console.log(`  profiles ${parsed.presentation.profiles.join(", ")}`);
}
