/**
 * vidaXL terrace — shoppable outdoor scene from the channel-tracked catalog.
 *
 * The vidaXL outdoor feed (89,595 rows) ships no 3D proxies, so every piece is
 * a box at its REPORTED size: 12.7% of titles state their centimetre
 * dimensions, and only rows that state all three axes are eligible. Evidence
 * class is CONCEPT throughout and the limitations say why. BUY is the row's
 * affiliate_link verbatim.
 *
 *   node scripts/compile-vidaxl-terrace.mjs [--out path]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseScene } from "../engine/core/scene-contract.mjs";
import { dimensionsFromTitle } from "../engine/compile/catalog-row.mjs";
import { composeRoom } from "../engine/compile/catalog-room.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AVATAR_REPO = path.resolve(root, "../repo-avatar-factory");
const CATALOG = path.join(AVATAR_REPO, "data/vidaxl-outdoor/vidaxl-outdoor-catalog.jsonl");

export function loadCatalog(file = CATALOG) {
  return fs.readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

/**
 * vidaXL has no proxy library. Geometry is the title-stated size, and only
 * when the title gives all three axes — a two-axis span cannot be placed as a
 * solid. Returns no assetPath, so elements render as boxes at CONCEPT.
 */
export function resolveVidaxlGeometry(row) {
  const dims = dimensionsFromTitle(row.title);
  if (!dims || dims.axes !== 3) return null;
  return { assetPath: null, bounds: { size: dims.size }, dimension_source: dims.source };
}

// Terrace 7×5 m. Back wall (house facade) at z=-2.5.
const ROLES = [
  {
    id: "LOUNGE_SOFA", base_kind: "sofa",
    categories: ["Utesoffor", "Moduler till utomhussoffa"],
    require_asset: false,
    target: { width_m: 2.0, depth_m: 0.85 }, max_width_m: 2.6, max_depth_m: 1.1,
    position: [-0.9, 0, -1.6], rotation_y_deg: 0
  },
  {
    id: "LOUNGE_TABLE", base_kind: "low_table",
    categories: ["Utebord", "Trädgårdsbord"],
    require_asset: false,
    target: { width_m: 1.1, depth_m: 0.6 }, max_width_m: 1.5, max_depth_m: 0.9,
    position: [-0.9, 0, -0.35], rotation_y_deg: 0
  },
  {
    id: "TERRACE_CHAIR", base_kind: null,
    categories: ["Utestolar", "Trädgårdsstolar", "Trädgårdsfåtöljer"],
    require_asset: false,
    target: { width_m: 0.62, depth_m: 0.62 }, max_width_m: 0.9, max_depth_m: 0.9,
    position: [0.75, 0, -0.75], rotation_y_deg: -52
  },
  {
    id: "SUNBED", base_kind: null,
    categories: ["Solsängar"],
    require_asset: false,
    target: { width_m: 2.0, depth_m: 0.7 }, max_width_m: 2.4, max_depth_m: 1.0,
    position: [2.3, 0, 0.9], rotation_y_deg: 90
  },
  {
    id: "GARDEN_BENCH", base_kind: null,
    categories: ["Trädgårdsbänkar", "Bänkar"],
    require_asset: false,
    target: { width_m: 1.4, depth_m: 0.55 }, max_width_m: 2.0, max_depth_m: 0.8,
    position: [-2.6, 0, 0.6], rotation_y_deg: 90
  },
  {
    id: "PLANTER", base_kind: null,
    categories: ["Krukor & odlingslådor", "Planteringsbänkar"],
    require_asset: false,
    target: { width_m: 0.8, depth_m: 0.4 }, max_width_m: 1.6, max_depth_m: 0.8,
    position: [-2.6, 0, -1.9], rotation_y_deg: 0
  }
];

const DECOR = [
  {
    id: "SEAT_CUSHION", categories: ["Stols- & soffdynor", "Dynor"],
    attaches_to: "LOUNGE_SOFA", slot_id: "seat", slot_type: "seat", attaches: true,
    require_asset: false, require_size: false, nominal_size_m: [1.2, 0.08, 0.55],
    target: { width_m: 1.2 }, element_type: "FURNITURE"
  }
];

function terraceShell() {
  return [
    {
      id: "TERRACE_DECK", type: "TERRAIN", label: "Terrace deck", evidence_class: "CONCEPT",
      geometry: { primitive: "GRID_SURFACE", size_m: 9, segments: 1, vertices: [[-4.5, 0, -3], [4.5, 0, -3], [-4.5, 0, 3], [4.5, 0, 3]], method: "FLAT", height_reference: "LOCAL_RELATIVE" },
      source_refs: ["VIDAXL_TERRACE_COMPILER"],
      limitations: ["Synthetic terrace deck for product display."]
    },
    {
      id: "HOUSE_FACADE", type: "ROOM", label: "House facade", evidence_class: "CONCEPT",
      geometry: { primitive: "ROOM_VOLUME", size: [7, 2.8, 0.3], position: [0, 1.4, -2.75], rotation_y_deg: 0, intended_use: "OUTDOOR" },
      source_refs: ["VIDAXL_TERRACE_COMPILER"],
      limitations: ["Synthetic facade to anchor the terrace."]
    }
  ];
}

export function buildVidaxlTerrace() {
  const rows = loadCatalog();

  const { elements, report, errors } = composeRoom({
    rows,
    roles: ROLES,
    decor: DECOR,
    resolveGeometry: resolveVidaxlGeometry
  });

  const scene = {
    scene_version: "twin-scene/v0.1",
    entity_type: "ShoppableRoomSceneExport",
    scene_id: "SCENE_SHOPPABLE_TERRACE_VIDAXL_V01",
    generated_at: new Date().toISOString(),
    subject: {
      label: "vidaXL Terrace — shoppable, channel-tracked",
      identity_evidence_class: "CONCEPT",
      identity_scope: "SYNTHETIC_SHOPPABLE_TERRACE"
    },
    coordinate_system: {
      frame: "LOCAL_ENU", axes: { x: "EAST", y: "UP", z: "NORTH" }, origin_wgs84: [0, 0],
      horizontal_reference: "SYNTHETIC — not a real location",
      vertical_reference: "LOCAL_RELATIVE_UNCALIBRATED", linear_units: "metre",
      evidence_class: "CONCEPT", limitations: ["Synthetic terrace — not a real site."]
    },
    source_bindings: [
      { path: "scripts/compile-vidaxl-terrace.mjs", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "ROOM_COMPILER" },
      { path: "../repo-avatar-factory/data/vidaxl-outdoor/vidaxl-outdoor-catalog.jsonl", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "CHANNEL_CATALOG" }
    ],
    evidence_classes: ["AUTHORITATIVE", "INDICATIVE", "DERIVED", "REPORTED_UNVERIFIED", "CONCEPT"],
    legal_claim_policy: {
      visualisation_allowed: true, concept_design_allowed: true,
      blocked_claims: ["LEGAL_BOUNDARY", "REGISTERED_AREA", "ENTITLEMENT"],
      rule: "No 3D proxy exists for this channel. Every piece is a box at the size its own title states — a placement aid, not a fit claim. BUY links carry the channel's tracking parameters verbatim."
    },
    presentation: {
      profiles: ["INTELLIGENCE", "REALISTIC", "SYSTEMS"],
      default_profile: "INTELLIGENCE", default_stage: "TERRACE"
    },
    navigation: [
      { id: "TERRACE", label: "Terrace", camera: [5.2, 3.6, 5.0], target: [0, 0.6, -0.4], visible_groups: ["TERRAIN", "ROOM", "FURNITURE"], cutaway: false, labels: false },
      { id: "LOUNGE", label: "Lounge", camera: [1.6, 1.7, 2.4], target: [-0.9, 0.45, -1.1], visible_groups: ["FURNITURE", "TERRAIN"], cutaway: false, labels: true },
      { id: "SUN", label: "Sun deck", camera: [4.4, 2.0, 3.2], target: [2.2, 0.4, 0.8], visible_groups: ["FURNITURE", "TERRAIN"], cutaway: false, labels: true }
    ],
    elements: [...terraceShell(), ...elements]
  };

  return { scene, report, errors };
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  const outArg = process.argv.indexOf("--out");
  const outputPath = outArg !== -1 && process.argv[outArg + 1]
    ? path.resolve(process.argv[outArg + 1])
    : path.join(root, "data/scenes/shoppable-terrace-vidaxl/scene-v0.1.json");

  const { scene, report, errors } = buildVidaxlTerrace();
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
      console.log(`  ${r.role.padEnd(14)} sku ${String(r.sku).padEnd(9)} fit ${String(r.fit_score).padEnd(7)} of ${String(r.candidates).padStart(5)} cand · ${r.title.slice(0, 42)}`);
    } else {
      console.log(`  ${r.role.padEnd(14)} ${r.state}`);
    }
  }
}
