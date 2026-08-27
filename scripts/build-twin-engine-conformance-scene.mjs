/**
 * Generates the twin-engine conformance fixture scene.
 *
 * The fixture exists to exercise every renderer path — all nine geometry primitives, all five
 * evidence classes, a cutaway stage, a stage that opens an element — without borrowing a real
 * site. It is deliberately anchored at null island and every element carries a limitation
 * saying it is synthetic, so no output built from it can ever be mistaken for a claim.
 *
 *   node scripts/build-twin-engine-conformance-scene.mjs
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {parseScene, evidenceProfile, PRIMITIVES} from "../engine/core/scene-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "data/scenes/twin-engine-conformance/scene-v0.1.json");

const FIXTURE_LIMITATION = "Synthetic conformance fixture. Not a claim about any real place, parcel or building.";
const SOURCE_REFS = ["ENGINE_CONFORMANCE_FIXTURE"];

const element = (id, type, label, evidenceClass, geometry, extraLimitations = []) => ({
  id,
  type,
  label,
  evidence_class: evidenceClass,
  geometry,
  source_refs: SOURCE_REFS,
  limitations: [FIXTURE_LIMITATION, ...extraLimitations]
});

function analyticTerrain({size, segments}) {
  const vertices = [];
  for (let z = 0; z <= segments; z += 1) {
    for (let x = 0; x <= segments; x += 1) {
      const px = -size / 2 + x * (size / segments);
      const pz = -size / 2 + z * (size / segments);
      // Amplitude is deliberately small: the fixture's ground datum is y = 1.0 m, and every
      // element above sits on it, so a hill must never swallow the plot outline.
      const height = 1 + Math.sin(px / 22) * 0.55 + Math.cos(pz / 18) * 0.35;
      vertices.push([px, Number(height.toFixed(4)), pz]);
    }
  }
  return {primitive: "GRID_SURFACE", size_m: size, segments, vertices, method: "ANALYTIC_SURFACE", height_reference: "LOCAL_RELATIVE"};
}

export function buildConformanceScene() {
  return {
    scene_version: "twin-scene/v0.1",
    entity_type: "ConformanceSceneExport",
    scene_id: "SCENE_TWIN_ENGINE_CONFORMANCE_V01",
    generated_at: "2026-08-19T00:00:00Z",
    subject: {
      label: "twin-engine conformance fixture",
      identity_evidence_class: "CONCEPT",
      identity_scope: "SYNTHETIC_FIXTURE_NOT_A_REAL_SUBJECT"
    },
    coordinate_system: {
      frame: "LOCAL_ENU",
      axes: {x: "EAST", y: "UP", z: "NORTH"},
      origin_wgs84: [0, 0],
      horizontal_reference: "EPSG:4326 origin (null island — deliberately not a real site)",
      vertical_reference: "LOCAL_RELATIVE_UNCALIBRATED",
      linear_units: "metre",
      evidence_class: "CONCEPT",
      limitations: ["Origin is null island so the fixture can never be mistaken for a site."]
    },
    source_bindings: [
      {path: "scripts/build-twin-engine-conformance-scene.mjs", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "FIXTURE_GENERATOR"}
    ],
    evidence_classes: ["AUTHORITATIVE", "INDICATIVE", "DERIVED", "REPORTED_UNVERIFIED", "CONCEPT"],
    legal_claim_policy: {
      visualisation_allowed: true,
      concept_design_allowed: true,
      blocked_claims: ["LEGAL_BOUNDARY", "REGISTERED_AREA", "ENTITLEMENT", "BUILDABLE_ENVELOPE", "LEGAL_ACCESS", "UTILITY_CAPACITY", "SURVEYED_TERRAIN", "FINISHED_FLOOR_LEVEL"],
      rule: "A fixture may claim nothing. It exists to exercise the renderer."
    },
    presentation: {
      profiles: ["INTELLIGENCE", "REALISTIC", "COMPARE"],
      default_profile: "INTELLIGENCE",
      default_stage: "SITE"
    },
    navigation: [
      {id: "SITE", label: "Site", camera: [52, 40, 64], target: [0, 1, 0], visible_groups: ["TERRAIN", "PLOT", "ROAD", "CONTEXT_BUILDING", "POI", "CONCEPT_BUILDING", "VIEW_DIRECTION", "ENVIRONMENTAL_ANCHOR"], cutaway: false, labels: true},
      {id: "PLOT", label: "Plot", camera: [22, 15, 26], target: [0, 2, 0], visible_groups: ["TERRAIN", "PLOT", "ROAD", "CONCEPT_BUILDING", "POI"], cutaway: false, labels: true},
      {id: "BUILDING", label: "Building", camera: [14, 9, 16], target: [0, 3.6, 0], visible_groups: ["CONCEPT_BUILDING", "OPENING", "TERRAIN"], cutaway: false, labels: false},
      {id: "ROOM", label: "Room", camera: [2.4, 2.7, 3.4], target: [0, 2.3, 0], visible_groups: ["ROOM", "OPENING", "FURNITURE"], cutaway: true, labels: false, on_enter_open_element: "ROOM_MAIN"}
    ],
    studies: {
      solar: {
        evidence_class: "DERIVED",
        coordinate: [0, 0],
        date: "2026-06-21",
        interactive_hour_range: [5, 21],
        utc_offset_hours: 0,
        limitations: ["Analytical sun direction only."]
      }
    },
    elements: [
      element("TERRAIN_FIXTURE", "TERRAIN", "Fixture terrain", "DERIVED", analyticTerrain({size: 80, segments: 4})),
      element("PLOT_FIXTURE", "PLOT", "Fixture plot outline", "INDICATIVE", {primitive: "EXTRUDED_POLYGON", points_xz: [[-16, -13], [17, -14], [18, 14], [-15, 13]], height: 0.3, base_y: 1.65, area_m2: 900}),
      element("ROAD_FIXTURE", "ROAD", "Fixture road", "INDICATIVE", {primitive: "POLYLINE_RIBBON", points: [[-40, 1.05, -19], [-6, 1.05, -17], [24, 1.05, -15], [40, 1.05, -14]], width_m: 5.5}),
      element("CONTEXT_BUILDING_A", "CONTEXT_BUILDING", "Neighbour A", "INDICATIVE", {primitive: "BOX", size: [9, 5, 7], position: [-27, 3.5, 6], rotation_y_deg: 12}),
      element("CONTEXT_BUILDING_B", "CONTEXT_BUILDING", "Neighbour B", "REPORTED_UNVERIFIED", {primitive: "BOX", size: [8, 4.5, 8], position: [28, 3.25, -2], rotation_y_deg: -8}, ["Volume reported by a third party and never checked."]),
      element("HOUSE_BODY", "CONCEPT_BUILDING", "Concept house body", "CONCEPT", {primitive: "BOX", size: [11, 5.6, 8], position: [0, 3.8, 0], rotation_y_deg: 0}),
      element("HOUSE_WING", "CONCEPT_BUILDING", "Concept house wing", "CONCEPT", {primitive: "BOX", size: [5, 3.2, 5], position: [7.4, 2.6, 2.6], rotation_y_deg: 0}),
      element("OPENING_SOUTH", "OPENING", "South glazing", "CONCEPT", {primitive: "BOX", size: [4.2, 2.1, 0.16], position: [0, 3.2, 4.02], rotation_y_deg: 0}),
      element("ROOM_MAIN", "ROOM", "Main room volume", "CONCEPT", {primitive: "ROOM_VOLUME", size: [6.5, 2.7, 5.4], position: [-1.4, 2.35, 0], rotation_y_deg: 0, intended_use: "LIVING"}),
      element("FURNITURE_SOFA", "FURNITURE", "Sofa placeholder", "CONCEPT", {primitive: "BOX", size: [2.3, 0.75, 0.95], position: [-2.1, 1.38, 1.4], rotation_y_deg: 0}),
      element("ADDRESS_ANCHOR", "ANCHOR", "Coordinate anchor", "AUTHORITATIVE", {primitive: "MARKER", position: [0, 1, 0]}, ["Marks the frame origin, nothing else."]),
      element("POI_SCHOOL", "POI", "Fixture point of interest", "DERIVED", {primitive: "DIAGRAMMATIC_MARKER", position: [-34, 1, 28], distance_m: 44, placement_method: "DIAGRAMMATIC_BEARING_AND_DISTANCE"}),
      element("VIEW_SOUTHWEST", "VIEW_DIRECTION", "Fixture view direction", "REPORTED_UNVERIFIED", {primitive: "DIRECTION_CONE", origin: [0, 4.4, 0], azimuth_deg: 225, length_m: 38, spread_deg: 26}, ["Direction only; no visibility analysis."]),
      element("SOLAR_PATH", "ENVIRONMENTAL_ANCHOR", "Fixture solar path", "DERIVED", {primitive: "SOLAR_ARC", latitude_deg: 0, longitude_deg: 0, study_date: "2026-06-21", hours: [6, 8, 10, 12, 14, 16, 18]}),
      element("AVATAR_FIXTURE", "FURNITURE", "Fixture glTF avatar", "INDICATIVE", {primitive: "GLTF_ASSET", asset_path: "data/geometry/avatars/fixture-placeholder.glb", position: [3, 1.05, -2], rotation_y_deg: 45}, ["Placeholder — no actual .glb is loaded in headless tests."])
    ]
  };
}

// Compare resolved paths, not a hand-built file:// URL: this repository lives under a path
// containing a space, which import.meta.url percent-encodes and process.argv[1] does not.
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  const scene = buildConformanceScene();
  const parsed = parseScene(scene);
  const covered = new Set(parsed.elements.map(item => item.geometry.primitive));
  const missing = PRIMITIVES.filter(name => !covered.has(name));
  if (missing.length) {
    console.error(`fixture does not exercise every primitive — missing ${missing.join(", ")}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
  fs.writeFileSync(outputPath, `${JSON.stringify(scene, null, 2)}\n`);
  console.log(`wrote ${path.relative(root, outputPath)}`);
  console.log(`  elements ${parsed.elements.length} · stages ${parsed.stages.length} · primitives ${covered.size}/${PRIMITIVES.length}`);
  console.log(`  evidence ${JSON.stringify(evidenceProfile(parsed))}`);
}
