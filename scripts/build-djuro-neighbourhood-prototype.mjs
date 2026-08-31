import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "data/sites/sweden/djuro-byvag-34";
const intakePath = `${base}/intake-v0.1.json`;
const parcelPath = `${base}/property-division-derived-v0.1.json`;
const buildingsPath = `${base}/buildings-official-derived-v0.1.json`;
const terrainPath = `${base}/terrain-dem-derived-v0.1.json`;
const sunPath = `${base}/sun-path-derived-v0.1.json`;
const geomSourcesPath = `${base}/official-context-geometry-sources-v0.1.json`;
const outputPath = `${base}/neighbourhood-scene-v0.1.json`;

const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, p))).digest("hex");
const round = (n, d = 4) => Number(n.toFixed(d));

function element(id, type, label, evidence_class, geometry, source_refs = [], limitations = []) {
  return { id, type, label, evidence_class, geometry, source_refs, limitations };
}

function buildScene() {
  const intake = read(intakePath);
  const parcel = read(parcelPath);
  const buildingsDoc = read(buildingsPath);
  const terrain = read(terrainPath);
  const sun = read(sunPath);

  const [lon, lat] = [intake.geocode.wgs84.lon, intake.geocode.wgs84.lat];
  const HF = terrain.heightfield;
  const boundary = parcel.local_boundary_polygon_xz[0][0];

  function terrainY(x, z) {
    const n = HF.segments, step = HF.size_m / n, half = HF.size_m / 2;
    const fx = Math.min(n, Math.max(0, (x + half) / step)), fz = Math.min(n, Math.max(0, (z + half) / step));
    const ix = Math.min(n - 1, Math.floor(fx)), iz = Math.min(n - 1, Math.floor(fz)), tx = fx - ix, tz = fz - iz;
    const at = (cx, cz) => HF.vertices[cz * (n + 1) + cx][1];
    return round((at(ix, iz) * (1 - tx) + at(ix + 1, iz) * tx) * (1 - tz) + (at(ix, iz + 1) * (1 - tx) + at(ix + 1, iz + 1) * tx) * tz, 3);
  }

  const elements = [];

  elements.push(element(
    "TERRAIN_CONTEXT", "TERRAIN", "Authoritative local terrain (Lantmäteriet 1 m DTM)", "AUTHORITATIVE",
    { primitive: "GRID_SURFACE", size_m: HF.size_m, segments: HF.segments, vertices: HF.vertices, height_reference: "RH2000_MINUS_LOCATOR_DATUM", method: "Sampled from the receipted Lantmäteriet 1 m grid mosaic (mhm-65_7). RH2000 heights relative to the address-pin datum. Reproduce via scripts/derive_djuro_terrain.py; provenance in terrain-dem-derived-v0.1.json." },
    ["RCPT_SE_LM_TERRAIN_MHM_65_7"],
    ["Heights are official RH2000 from the receipted 1 m DTM mosaic.", "Sub-metre breaklines and any post-2026 site regrading are not captured.", "Terrain is authoritative; access, utilities and legal boundary use are not evaluated here."]
  ));

  elements.push(element(
    "PLOT_4_147", "PLOT", `${parcel.designation} registered boundary`, "AUTHORITATIVE",
    { primitive: "EXTRUDED_POLYGON", points_xz: boundary, base_y: 0.15, height: 0.18, area_m2: parcel.area_m2 },
    ["RCPT_SE_LM_FASTIGHETSINDELNING_KN0120"],
    ["Boundary is the official Lantmäteriet fastighetsindelning polygon for DJURÖ 4:147, not a listing-map trace.", "Registered geometry can lag a physical survey or recent subdivision; treat as the register's current record, not a set-out line."]
  ));

  elements.push(element(
    "ADDRESS_LOCATOR", "ANCHOR", "Djurö byväg 34 address point", "DERIVED",
    { primitive: "MARKER", position: [0, 2.5, 0] },
    ["INTAKE_SE_DJURO_GEOCODE"],
    ["Coordinate is an OSM geocode seed, cross-checked by point-in-polygon against the official parcel boundary (that match is AUTHORITATIVE) — the raw coordinate itself is a DERIVED transform, not a surveyed control point.", "Official belägenhetsadresser (address-point) data was requested but denied (HTTP 403) under the current data grant."]
  ));

  const roleColorHint = { MAIN_HOUSE: "SITE_BUILDING_MAIN", OUTBUILDING: "SITE_BUILDING_OUT" };
  for (const b of buildingsDoc.buildings_on_parcel) {
    const isMain = b.role === "MAIN_HOUSE";
    const h = isMain ? 5.2 : (b.area_m2 > 150 ? 4.2 : 3.0);
    const points = b.local_footprint_xz[0][0];
    elements.push(element(
      `SITE_BLDG_${b.fid}`, roleColorHint[b.role] || "SITE_BUILDING_OUT",
      isMain ? "Main house (Bostad)" : `Outbuilding · ${b.objekttyp}`,
      "DERIVED",
      { primitive: "EXTRUDED_POLYGON", points_xz: points, base_y: 0.05, height: h, area_m2: b.area_m2 },
      ["RCPT_SE_LM_BYGGNAD_KN0120"],
      [
        `Footprint is the official Lantmäteriet byggnad polygon (fid ${b.fid}, ${b.objekttyp}) — AUTHORITATIVE.`,
        `Height (${h} m) is an illustrative massing assumption — LM's building register carries no height field, so this is CONCEPT, not measured.`,
        b.role === "OUTBUILDING" && b.area_m2 > 150 ? "This is the largest structure on the plot, larger than the house — likely a boathouse/garage/storage building given the coastal setting, but that specific use is REPORTED, not confirmed." : null,
      ].filter(Boolean)
    ));
  }

  // Neighbour context buildings: simple box estimate around their real LM centroid, local frame.
  const originE = 710934.881, originN = 6582029.947;
  buildingsDoc.neighbour_buildings_context.forEach((b, i) => {
    const x = round(b.centroid[0] - originE, 2), z = round(b.centroid[1] - originN, 2);
    const side = Math.sqrt(b.area_m2);
    elements.push(element(
      `CTX_BLDG_${i + 1}`, "CONTEXT_BUILDING", `Neighbouring structure · ${b.objekttyp}`, "AUTHORITATIVE",
      { primitive: "BOX", position: [x, 1.5, z], size: [round(side, 1), 3, round(side, 1)], rotation_y_deg: 0 },
      ["RCPT_SE_LM_BYGGNAD_KN0120"],
      ["Footprint centroid and area are the official LM byggnad record; the box shown is a simplified square proxy of the real footprint area, not its true outline.", "Height is an illustrative massing assumption, not measured (LM byggnad carries no height field)."]
    ));
  });

  const seaArc = terrain.viewshed.sea_view_arcs_deg[0];
  const lo = seaArc.from_deg, hi = seaArc.to_deg > seaArc.from_deg ? seaArc.to_deg : seaArc.to_deg + 360;
  const midAz = ((lo + hi) / 2) % 360;
  const spread = hi - lo;
  elements.push(element(
    "VIEW_SEA", "VIEW_DIRECTION", "Derived open-water direction", "DERIVED",
    { primitive: "DIRECTION_CONE", origin: [0, 3, 0], azimuth_deg: round(midAz, 1), length_m: 140, spread_deg: round(spread, 1) },
    ["RCPT_SE_LM_TERRAIN_MHM_65_7"],
    [`Direction and spread come from a real radial line-of-sight viewshed on the receipted 1 m DEM (${terrain.viewshed.sea_view_azimuth_count}/${terrain.viewshed.rays.length} azimuths reach open water).`, "Water itself is classified by a DEM elevation/flatness heuristic (official hydrography was denied, HTTP 403) — DERIVED, not AUTHORITATIVE hydrography.", "Vegetation, the house's own structure and neighbouring building heights are not modelled — a real view may be more or less open than this bare-earth result."]
  ));

  elements.push(element(
    "SOLAR_PATH", "ENVIRONMENTAL_ANCHOR", "Derived solar path", "DERIVED",
    { primitive: "SOLAR_ARC", latitude_deg: lat, longitude_deg: lon, study_date: "2026-06-21", hours: [6, 8, 10, 12, 14, 16, 18, 20] },
    ["COORDINATE_ANCHOR", "RCPT_SE_PVGIS_V5_2"],
    ["Solar vectors are an analytical NOOA/Meeus solar-position computation from the working coordinate, self-checked against known solstice/equinox astronomy.", "Context massing and terrain occlusion by vegetation are not modelled, so shadows shown are a concept-study aid only."]
  ));

  const navigation = [
    { id: "NEIGHBOURHOOD_VIEW", label: "Overview", camera: [130, 105, 150], target: [0, 0, 0], visible_groups: ["TERRAIN", "PLOT", "CONTEXT_BUILDING", "SITE_BUILDING_MAIN", "SITE_BUILDING_OUT", "VIEW_DIRECTION"], cutaway: false },
    { id: "PARCEL_ORBIT", label: "Parcel boundary", camera: [55, 34, 60], target: [0, 1, 0], visible_groups: ["TERRAIN", "PLOT", "CONTEXT_BUILDING", "SITE_BUILDING_MAIN", "SITE_BUILDING_OUT"], cutaway: false },
    { id: "MAIN_HOUSE", label: "Main house", camera: [16, 10, 20], target: [-0.7, 2, 5], visible_groups: ["TERRAIN", "PLOT", "SITE_BUILDING_MAIN", "SITE_BUILDING_OUT"], cutaway: false, on_enter_open_element: "SITE_BLDG_106485" },
    { id: "OUTBUILDINGS", label: "Outbuildings", camera: [-55, 28, -10], target: [-33, 2, -21], visible_groups: ["TERRAIN", "PLOT", "SITE_BUILDING_MAIN", "SITE_BUILDING_OUT"], cutaway: false, on_enter_open_element: "SITE_BLDG_18178" },
    { id: "SEA_VIEW", label: "Sea view", camera: [22, 16, 55], target: [0, 2, 0], visible_groups: ["TERRAIN", "PLOT", "SITE_BUILDING_MAIN", "SITE_BUILDING_OUT", "VIEW_DIRECTION"], cutaway: false, on_enter_open_element: "VIEW_SEA" },
    { id: "TERRAIN_SLOPE", label: "Terrain & sun", camera: [-70, 55, 65], target: [0, -3, 0], visible_groups: ["TERRAIN", "PLOT", "SITE_BUILDING_MAIN", "SITE_BUILDING_OUT"], cutaway: false, on_enter_open_element: "TERRAIN_CONTEXT" },
  ];
  navigation.forEach((step) => {
    step.camera = [step.camera[0], round(step.camera[1] + terrainY(step.camera[0], step.camera[2]), 3), step.camera[2]];
    if (Math.abs(step.target[0]) <= HF.size_m / 2 && Math.abs(step.target[2]) <= HF.size_m / 2) {
      step.target = [step.target[0], round(step.target[1] + terrainY(step.target[0], step.target[2]), 3), step.target[2]];
    }
  });

  return {
    scene_version: "djuro-neighbourhood-scene/v0.1",
    entity_type: "NeighbourhoodSceneExport",
    scene_id: "SCENE_SE_VARMDO_DJURO_4_147_V01",
    generated_at: "2026-08-31T00:00:00Z",
    subject: {
      working_property_identity: parcel.designation,
      address: intake.subject_address,
      municipality: "Värmdö",
      identity_evidence_class: "AUTHORITATIVE",
      identity_scope: "GEOCODE_TO_REGISTERED_PARCEL_POINT_IN_POLYGON_MATCH",
    },
    coordinate_system: {
      frame: "LOCAL_ENU", axes: { x: "EAST", y: "UP", z: "NORTH" },
      origin_wgs84: [lon, lat], horizontal_reference: "EPSG:4326 origin", vertical_reference: "RH2000_MINUS_LOCATOR_DATUM", linear_units: "metre",
      evidence_class: "DERIVED",
      limitations: ["Origin is the address geocode point cross-checked against the parcel polygon, not a survey control mark.", "Terrain Y is real RH2000 relative to the pin datum; other elements are draped onto it."],
    },
    source_bindings: [
      { path: parcelPath, sha256: sha(parcelPath), role: "OFFICIAL_PARCEL_BOUNDARY" },
      { path: buildingsPath, sha256: sha(buildingsPath), role: "OFFICIAL_BUILDING_FOOTPRINTS" },
      { path: terrainPath, sha256: sha(terrainPath), role: "DERIVED_TERRAIN_AND_VIEWSHED" },
      { path: sunPath, sha256: sha(sunPath), role: "DERIVED_SUN_PATH" },
      { path: geomSourcesPath, sha256: sha(geomSourcesPath), role: "LM_ASSET_RECEIPTS" },
    ],
    evidence_classes: ["AUTHORITATIVE", "DERIVED", "REPORTED", "CONCEPT"],
    measurements: {
      registered_area_m2: { value: parcel.area_m2, evidence_class: "AUTHORITATIVE", source_ref: "RCPT_SE_LM_FASTIGHETSINDELNING_KN0120" },
      sea_view_azimuth_fraction: { value: terrain.viewshed.sea_view_azimuth_fraction, evidence_class: "DERIVED", method: "Radial DEM line-of-sight viewshed, see terrain-dem-derived-v0.1.json" },
    },
    legal_claim_policy: {
      visualisation_allowed: true, concept_design_allowed: false, sun_view_navigation_allowed: true,
      blocked_claims: ["LEGAL_BOUNDARY_SURVEY", "BUILDING_HEIGHT", "ENTITLEMENT", "BUILDABLE_ENVELOPE", "LEGAL_ACCESS", "UTILITY_CAPACITY", "OFFICIAL_HYDROGRAPHY", "RENOVATION_DESIGN"],
      rule: "No concept renovation design exists yet for this showcase — every building shown is the real registered structure, not a proposed design. Open items (heights, water boundary, address point) stay flagged, not silently upgraded.",
    },
    navigation,
    elements,
    studies: {
      solar: { evidence_class: "DERIVED", coordinate: [lon, lat], date: "2026-06-21", interactive_hour_range: [6, 20], limitations: ["Analytical sun direction; vegetation/building shadow occlusion not modelled."] },
      views: { evidence_class: "DERIVED", direction_id: "VIEW_SEA", limitations: ["Real DEM viewshed, not a photographed or surveyed sightline; trees and structures not modelled."] },
    },
    prototype: { viewer_path: "prototype/djuro-byvag-34/index.html", requires_http_server: true, default_step: "NEIGHBOURHOOD_VIEW" },
    project_status: { design_scenario: "SITE_INTELLIGENCE_SHOWCASE_NO_DESIGN_YET", selected_house_profile: null, source_project_status: "RENOVATION_IN_PLANNING_NOT_STARTED" },
  };
}

export function build() {
  const scene = buildScene();
  fs.writeFileSync(path.join(root, outputPath), JSON.stringify(scene, null, 2) + "\n");
  return scene;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const scene = build();
  console.log(JSON.stringify({ output: outputPath, elements: scene.elements.length, navigation_steps: scene.navigation.length, plot_area_m2: scene.measurements.registered_area_m2.value }, null, 2));
}
