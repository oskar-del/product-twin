import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE_ID = "SITE_CANOPUS_5410501UF2451S";
const PARCEL_ID = "5410501UF2451S";
const BUNDLE_REL = "data/sites/canopus/spatial/v0.2";
const SHA256_RE = /^[a-f0-9]{64}$/;
const OFFICIAL_HOSTS = new Set([
  "ovc.catastro.meh.es",
  "api-coverages.idee.es",
  "api-features.idee.es",
  "www.idee.es",
]);
const EXPECTED_SOURCE_IDS = new Set([
  "SRC_CATASTRO_PARCEL_GML",
  "SRC_CATASTRO_REFERENCE_WGS84",
  "SRC_CATASTRO_CAPABILITIES",
  "SRC_CATASTRO_SERVICE_METADATA",
  "SRC_CATASTRO_DATASET_METADATA",
  "SRC_IGN_MDT05_COG",
  "SRC_IGN_MDT05_COLLECTION_METADATA",
  "SRC_CATASTRO_BUILDINGS_GML",
  "SRC_IDEE_ROADLINK_GEOJSON",
]);
const EXPECTED_GATES = [
  "GATE_CATASTRO_BOUNDARY",
  "GATE_IGN_TERRAIN",
  "GATE_CONTEXT_OBSTRUCTIONS",
  "GATE_CERTIFICADO_URBANISTICO",
  "GATE_GOVERNING_PLAN",
  "GATE_A7_BUILDING_LINE_AND_ACCESS",
  "GATE_PERMITTED_ACCESS",
  "GATE_ROOFTOP_RULES",
  "GATE_TITLE_AND_CHARGES",
  "GATE_FLOOD_AND_OVERLAYS",
  "GATE_UTILITY_CAPACITY",
];
const V01_IMMUTABLE = new Map([
  ["data/sites/canopus/project-v0.1.json", "9c7c95a39748d4e16eec6160887914b5e3dd032a19ad2d74b32bafc65add44f0"],
  ["data/sites/canopus/site-twin-v0.1.json", "badace1884551743bdd6dc8f0ebd0e220a9e6139456298f3d9640d293841a6bf"],
  ["data/sites/canopus/design-scenarios/la-concha-gardens-v0.1.json", "6b132d5c871a6be945519dd51d0efa1df4e151800ca0b665a23b61d792f6f6bb"],
  ["data/sites/canopus/evidence-sources-v0.1.json", "e196c6fa997620f11c4803866e18c97ae17ce7a4e54a99e45fb6dcaf4030c6b3"],
]);

function digest(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function close(a, b, tolerance) {
  return Number.isFinite(a) && Math.abs(a - b) <= tolerance;
}

function signedArea(ring) {
  let twiceArea = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    twiceArea += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return twiceArea / 2;
}

function orient(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function isSimple(ring) {
  const edgeCount = ring.length - 1;
  for (let i = 0; i < edgeCount; i += 1) {
    for (let j = i + 1; j < edgeCount; j += 1) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === edgeCount - 1)) continue;
      const [a, b, c, d] = [ring[i], ring[i + 1], ring[j], ring[j + 1]];
      if (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) return false;
    }
  }
  return true;
}

function inspectGlb(file, check) {
  const bytes = fs.readFileSync(file);
  check(bytes.subarray(0, 4).toString("ascii") === "glTF", "terrain mesh is not a GLB");
  check(bytes.readUInt32LE(4) === 2, "terrain mesh is not GLB version 2");
  check(bytes.readUInt32LE(8) === bytes.length, "terrain mesh declared length differs from bytes");
  const jsonLength = bytes.readUInt32LE(12);
  check(bytes.subarray(16, 20).toString("ascii") === "JSON", "terrain mesh has no JSON chunk");
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8"));
  check(gltf.scenes?.[0]?.nodes?.length === 1, "terrain GLB must contain exactly one root node");
  check(gltf.nodes?.length === 1 && gltf.nodes[0].name === "IGN_MDT05_TERRAIN_CONTEXT", "terrain GLB includes unexpected nodes");
  const extras = gltf.nodes?.[0]?.extras ?? {};
  check(extras.source === "IGN MDT05", "terrain GLB source is not IGN MDT05");
  check(extras.horizontal_crs === "EPSG:25830 easting/northing", "terrain GLB CRS is wrong");
  check(extras.axis_convention === "+X east, +Y up, -Z north", "terrain GLB axis convention is wrong");
  check(extras.units === "metres", "terrain GLB unit is not metres");
  check(extras.scenario_content === false, "terrain GLB contains or claims scenario content");
  check(typeof extras.vertical_datum === "string" && extras.vertical_datum.includes("Alicante"), "terrain GLB vertical datum is missing");
  const accessor = gltf.accessors?.[0];
  check(accessor?.componentType === 5126 && accessor?.type === "VEC3", "terrain GLB POSITION accessor is invalid");
  check(accessor?.count > 10_000, "terrain GLB context is unexpectedly small");
  const origin = extras.local_origin_epsg25830_m;
  if (Array.isArray(origin) && accessor?.min && accessor?.max) {
    const absoluteBounds = [origin[0] + accessor.min[0], origin[1] - accessor.max[2], origin[0] + accessor.max[0], origin[1] - accessor.min[2]];
    const parcelBounds = [325174.43, 4040737.67, 325502.6, 4041045.16];
    check(absoluteBounds[0] <= parcelBounds[0] - 95 && absoluteBounds[2] >= parcelBounds[2] + 95, "terrain GLB does not cover the east-west context buffer");
    check(absoluteBounds[1] <= parcelBounds[1] - 95 && absoluteBounds[3] >= parcelBounds[3] + 95, "terrain GLB does not cover the north-south context buffer");
  }
}

function inspectRuntimeSource(sourceId, file, check) {
  const bytes = fs.readFileSync(file);
  const text = bytes.toString("latin1");
  if (sourceId === "SRC_CATASTRO_PARCEL_GML") {
    check((text.match(/<cp:CadastralParcel\b/g) ?? []).length === 1, "runtime Catastro response does not contain exactly one parcel");
    check(text.includes(`<cp:nationalCadastralReference>${PARCEL_ID}</cp:nationalCadastralReference>`), "runtime Catastro response contains the wrong parcel");
    check(text.includes("http://www.opengis.net/def/crs/EPSG/0/25830"), "runtime Catastro response lacks source EPSG:25830");
    check(text.includes("<cp:areaValue uom=\"m2\">52733</cp:areaValue>"), "runtime Catastro authoritative area changed");
    check(text.includes("<cp:beginLifespanVersion>2010-08-05T00:00:00</cp:beginLifespanVersion>"), "runtime Catastro beginLifespanVersion changed");
  } else if (sourceId === "SRC_CATASTRO_REFERENCE_WGS84") {
    check(text.includes("<srs>EPSG:4326</srs>") && text.includes("<pc1>5410501</pc1><pc2>UF2451S</pc2>"), "runtime Catastro WGS84 reference identity/CRS is invalid");
  } else if (sourceId === "SRC_CATASTRO_CAPABILITIES") {
    check(text.includes("WFS_Capabilities") && text.includes("CadastralParcel"), "runtime Catastro capabilities signature is invalid");
  } else if (sourceId === "SRC_CATASTRO_SERVICE_METADATA") {
    check(text.includes("ES_SDGC_CP_WFS"), "runtime Catastro service metadata signature is invalid");
  } else if (sourceId === "SRC_CATASTRO_DATASET_METADATA") {
    check(text.includes("ES_SDGC_CP"), "runtime Catastro dataset metadata signature is invalid");
  } else if (sourceId === "SRC_IGN_MDT05_COG") {
    check(bytes.length > 100_000 && ["II", "MM"].includes(bytes.subarray(0, 2).toString("ascii")), "runtime IGN terrain is not a plausible GeoTIFF/COG");
  } else if (sourceId === "SRC_IGN_MDT05_COLLECTION_METADATA") {
    let value;
    try { value = JSON.parse(bytes.toString("utf8")); } catch { value = null; }
    check(value?.id === "EL.ElevationGridCoverage_25830_5_PB", "runtime IGN collection metadata identity is invalid");
  } else if (sourceId === "SRC_CATASTRO_BUILDINGS_GML") {
    check((text.match(/<bu-ext2d:Building\b/g) ?? []).length === 14, "runtime Catastro building feature count changed");
  } else if (sourceId === "SRC_IDEE_ROADLINK_GEOJSON") {
    let value;
    try { value = JSON.parse(bytes.toString("utf8")); } catch { value = null; }
    check(value?.type === "FeatureCollection" && value.numberReturned === 528 && value.features?.length === 528, "runtime RoadLink response identity/count changed");
  }
}

export function validateSpatialBundle({ root = process.cwd(), requireRuntime = false, runtimeRoot = null } = {}) {
  const errors = [];
  let assertions = 0;
  const check = (condition, message) => {
    assertions += 1;
    if (!condition) errors.push(message);
  };
  const absolute = (relative) => path.resolve(root, relative);
  const bundle = absolute(BUNDLE_REL);
  const manifest = readJson(path.join(bundle, "spatial-evidence-manifest-v0.2.json"));
  const boundary = readJson(path.join(bundle, "boundary-epsg25830-v0.2.json"));
  const boundaryWgs = readJson(path.join(bundle, "boundary-wgs84-v0.2.geojson"));
  const terrain = readJson(path.join(bundle, "terrain-analysis-v0.2.json"));
  const contours = readJson(path.join(bundle, "contours-1m-v0.2.geojson"));
  const section = readJson(path.join(bundle, "section-aa-v0.2.json"));
  const access = readJson(path.join(bundle, "access-candidates-v0.2.geojson"));
  const roads = readJson(path.join(bundle, "roads-context-v0.2.geojson"));
  const buildings = readJson(path.join(bundle, "buildings-context-v0.2.geojson"));
  const site = readJson(path.join(bundle, "site-twin-v0.2.json"));
  const exportContract = readJson(path.join(bundle, "spatial-export-v0.2.json"));

  check(manifest.schema_version === "0.2" && manifest.entity_type === "SpatialEvidenceManifest", "manifest profile is not v0.2");
  check(manifest.site_twin_id === SITE_ID, "manifest Site Twin ID is wrong");
  check(Array.isArray(manifest.sources) && manifest.sources.length === 9, "manifest must contain exactly nine source receipts");
  const sourceIds = new Set(manifest.sources.map((source) => source.source_id));
  check(sourceIds.size === 9 && [...EXPECTED_SOURCE_IDS].every((id) => sourceIds.has(id)), "manifest source set is incomplete or unexpected");
  const sourceById = new Map(manifest.sources.map((source) => [source.source_id, source]));
  for (const source of manifest.sources) {
    check(SHA256_RE.test(source.sha256), `${source.source_id}: invalid SHA-256`);
    check(Number.isInteger(source.byte_count) && source.byte_count > 0, `${source.source_id}: invalid byte count`);
    let request;
    try { request = new URL(source.request_url); } catch { request = null; }
    check(request?.protocol === "https:" && OFFICIAL_HOSTS.has(request.hostname), `${source.source_id}: request is not on an allowed official HTTPS host`);
    check(Number.isFinite(Date.parse(source.retrieved_at)) && /(Z|[+-]\d\d:\d\d)$/.test(source.retrieved_at), `${source.source_id}: retrieval date is not an ISO date-time with timezone`);
    check(source.http?.status === 200 && source.http?.content_type === source.media_type && source.http?.etag === null && source.http?.last_modified === null, `${source.source_id}: HTTP/content metadata is missing or invents uncaptured validators`);
    check(typeof source.licence?.name === "string" && source.licence.name.length >= 3, `${source.source_id}: licence name missing`);
    check(source.licence?.uri === "https://creativecommons.org/licenses/by/4.0/", `${source.source_id}: licence URI missing or unexpected`);
    check(/^\.runtime\/sites\/canopus\/raw\/[A-Za-z0-9._-]+$/.test(source.runtime_locator), `${source.source_id}: unsafe runtime locator`);
    check(typeof source.replay === "string" && source.replay.includes(source.request_url), `${source.source_id}: replay does not bind exact request URL`);
    if (requireRuntime) {
      const runtime = runtimeRoot
        ? path.resolve(runtimeRoot, path.basename(source.runtime_locator))
        : absolute(source.runtime_locator);
      check(fs.existsSync(runtime), `${source.source_id}: runtime source is absent`);
      if (fs.existsSync(runtime)) {
        check(fs.statSync(runtime).size === source.byte_count, `${source.source_id}: runtime byte count mismatch`);
        check(digest(runtime) === source.sha256, `${source.source_id}: runtime SHA-256 mismatch`);
        inspectRuntimeSource(source.source_id, runtime, check);
      }
    }
  }
  const parcelSource = sourceById.get("SRC_CATASTRO_PARCEL_GML");
  check(parcelSource?.request_url.includes(`refcat=${PARCEL_ID}`), "Catastro receipt does not request the exact parcel");
  check(parcelSource?.feature_begin_lifespan_version === "2010-08-05T00:00:00", "Catastro feature beginLifespanVersion is missing or wrong");
  check(parcelSource?.feature_end_lifespan_version === null && parcelSource?.valid_from === null && parcelSource?.valid_to === null, "Catastro absent end/validity dates must remain null");
  check(parcelSource?.survey_or_currentness_date === null, "a survey/currentness date was invented for the parcel");
  check(sourceById.get("SRC_CATASTRO_CAPABILITIES")?.terms_note?.includes("conservative"), "Catastro legacy-terms conflict is not recorded");
  check(sourceById.get("SRC_CATASTRO_SERVICE_METADATA")?.metadata_date === "2025-01-28", "Catastro service metadata date is missing");
  check(sourceById.get("SRC_CATASTRO_DATASET_METADATA")?.continuous_update_note?.includes("not a parcel survey date"), "Catastro metadata date is being treated as parcel currentness");
  check(sourceById.get("SRC_IGN_MDT05_COG")?.vertical_datum?.includes("Alicante"), "terrain receipt has no explicit vertical datum");
  check(sourceById.get("SRC_IDEE_ROADLINK_GEOJSON")?.legal_access_evidence === false, "road receipt must not claim legal access evidence");

  check(Array.isArray(manifest.derived_artifacts) && manifest.derived_artifacts.length === 10, "manifest must contain exactly ten derived artifacts");
  const terrainArtifactNames = new Set([
    "terrain-analysis-v0.2.json",
    "spot-elevations-v0.2.geojson",
    "contours-1m-v0.2.geojson",
    "section-aa-v0.2.json",
    "terrain-context-v0.2.glb",
  ]);
  for (const artifact of manifest.derived_artifacts) {
    check(artifact.path.startsWith(`${BUNDLE_REL}/`) && !artifact.path.includes(".."), `${artifact.artifact_id}: unsafe artifact path`);
    const file = absolute(artifact.path);
    check(fs.existsSync(file), `${artifact.artifact_id}: artifact absent`);
    if (fs.existsSync(file)) {
      check(fs.statSync(file).size === artifact.byte_count, `${artifact.artifact_id}: byte count mismatch`);
      check(digest(file) === artifact.sha256, `${artifact.artifact_id}: SHA-256 mismatch`);
    }
    check(artifact.deterministic === true, `${artifact.artifact_id}: artifact is not declared deterministic`);
    check(artifact.inputs?.boundary_source === parcelSource.sha256, `${artifact.artifact_id}: boundary source lineage mismatch`);
    const basename = path.basename(artifact.path);
    if (terrainArtifactNames.has(basename)) {
      check(artifact.inputs?.terrain_source === sourceById.get("SRC_IGN_MDT05_COG").sha256, `${artifact.artifact_id}: terrain source lineage mismatch`);
      check(artifact.inputs?.boundary_artifact === digest(path.join(bundle, "boundary-epsg25830-v0.2.json")), `${artifact.artifact_id}: boundary artifact lineage mismatch`);
    } else {
      check(artifact.inputs?.terrain_source === undefined, `${artifact.artifact_id}: claims an unrelated terrain input`);
    }
    if (["roads-context-v0.2.geojson", "access-candidates-v0.2.geojson"].includes(basename)) {
      check(artifact.inputs?.roads_source === sourceById.get("SRC_IDEE_ROADLINK_GEOJSON").sha256, `${artifact.artifact_id}: road source lineage mismatch`);
    }
    if (basename === "buildings-context-v0.2.geojson") {
      check(artifact.inputs?.buildings_source === sourceById.get("SRC_CATASTRO_BUILDINGS_GML").sha256, `${artifact.artifact_id}: building source lineage mismatch`);
    }
    check(artifact.toolchain?.python === "3.12.13" && artifact.toolchain?.numpy === "2.3.5" && artifact.toolchain?.Pillow === "12.3.0", `${artifact.artifact_id}: spatial toolchain is not pinned`);
  }

  check(boundary.schema_version === "0.2" && boundary.entity_type === "VerifiedBoundary", "boundary profile is wrong");
  check(boundary.site_twin_id === SITE_ID && boundary.source_sha256 === parcelSource.sha256, "boundary identity/source binding is wrong");
  check(boundary.source_crs === "http://www.opengis.net/def/crs/EPSG/0/25830" && boundary.canonical_crs === "EPSG:25830 easting,northing", "boundary CRS is missing, guessed or wrong");
  check(boundary.geometry?.type === "Polygon" && boundary.geometry.coordinates?.length === 1, "boundary must be one polygon with no invented parts or holes");
  const ring = boundary.geometry?.coordinates?.[0] ?? [];
  check(ring.length === 123, "boundary must retain all 123 source coordinates including closure");
  check(JSON.stringify(ring[0]) === JSON.stringify(ring.at(-1)), "boundary ring is open");
  check(ring.every((point) => point.length === 2 && point.every(Number.isFinite)), "boundary contains invalid coordinates");
  check(isSimple(ring), "boundary is self-intersecting");
  const area = Math.abs(signedArea(ring));
  check(close(area, 52732.1640625, 0.001), "boundary computed area changed");
  check(close(boundary.qa?.authoritative_area_m2, 52733, 0), "authoritative parcel area changed");
  check(Math.abs(area - boundary.qa?.authoritative_area_m2) <= Math.max(5, boundary.qa?.authoritative_area_m2 * 0.001), "boundary area fails the official-area tolerance");
  check(boundary.qa?.source_ring_orientation === "clockwise" && signedArea(ring) < 0, "source ring orientation was not preserved");
  check(boundary.qa?.transform_roundtrip_max_error_m <= 0.02, "coordinate transform round-trip exceeds 0.02 m");
  check(boundary.qa?.reference_service_residual_m <= 0.2, "Catastro reference-coordinate cross-check exceeds 0.2 m");
  check(boundary.version_dates?.source_feature_begin_lifespan_version === "2010-08-05T00:00:00", "boundary feature lifespan date is wrong");
  check(boundary.version_dates?.source_feature_end_lifespan_version === null && boundary.version_dates?.valid_from === null && boundary.version_dates?.valid_to === null, "absent parcel validity/end dates were not preserved");
  check(boundary.version_dates?.currentness_note?.includes("not a survey date"), "parcel currentness limitation is missing");

  const wgsRing = boundaryWgs.geometry?.coordinates?.[0] ?? [];
  check(boundaryWgs.type === "Feature" && boundaryWgs.id === PARCEL_ID && wgsRing.length === 123, "WGS84 boundary identity/vertices are wrong");
  check(wgsRing.every(([lon, lat]) => lon >= -5.2 && lon <= -4.7 && lat >= 36.3 && lat <= 36.8), "WGS84 boundary is outside the Marbella guard or has swapped axes");
  check(boundaryWgs.properties?.source_sha256 === parcelSource.sha256, "WGS84 boundary source lineage mismatch");

  check(terrain.schema_version === "0.2" && terrain.entity_type === "VerifiedTerrainAnalysis", "terrain profile is wrong");
  check(terrain.source_sha256 === sourceById.get("SRC_IGN_MDT05_COG").sha256, "terrain source binding mismatch");
  check(terrain.boundary_sha256 === digest(path.join(bundle, "boundary-epsg25830-v0.2.json")), "terrain is not pinned to the exact boundary artifact");
  check(JSON.stringify(terrain.pixel_size_m) === "[5,5]", "terrain is not a 5 m grid");
  check(terrain.vertical_datum?.includes("Alicante") && terrain.units?.vertical === "m orthometric", "terrain vertical datum/unit is absent or wrong");
  check(terrain.horizontal_crs_source_metadata?.includes("EPSG:3042") && terrain.axis_reconciliation?.includes("EPSG:25830") && terrain.axis_reconciliation?.includes("without coordinate swapping"), "terrain axis-order discrepancy is hidden or unresolved");
  check(terrain.methods?.parcel_mask?.includes("all_touched=false"), "terrain mask rule is not fixed");
  check(terrain.methods?.slope?.includes("percent rise"), "slope units/method changed");
  check(terrain.methods?.local_aspect?.includes("circular"), "aspect aggregation is not circular");
  const stats = terrain.statistics ?? {};
  check(stats.pixel_center_count === 2105 && stats.pixel_center_sample_area_m2 === 52625, "terrain parcel mask changed");
  check(close(stats.elevation_min_m, 4, 0.001) && close(stats.elevation_max_m, 14.8113212585, 0.001), "terrain min/max changed");
  check(close(stats.elevation_fall_m, 10.8113212585, 0.001), "terrain fall changed");
  check(close(stats.local_cell_slope_mean_percent, 8.230404452, 0.001), "local terrain slope changed");
  check(close(stats.local_cell_aspect_weighted_circular_mean_deg, 61.365083101, 0.001), "local terrain aspect changed");
  check(close(stats.trend_plane_gradient_percent, 2.489508134, 0.001), "trend-plane gradient no longer reproduces the dossier");
  check(close(stats.trend_plane_downslope_aspect_deg, 79.829570243, 0.001), "trend-plane aspect no longer reproduces the dossier");
  check(terrain.reported_comparison?.reported_mean_gradient_percent === 2.5 && terrain.reported_comparison?.reported_aspect_deg === 80, "reported terrain claims were overwritten");

  check(contours.type === "FeatureCollection" && contours.features?.length === 10, "1 m contour set is incomplete");
  check(contours.features.every((feature) => feature.properties?.interval_m === 1 && feature.properties?.source_grid_m === 5 && feature.properties?.accuracy_note?.includes("not 1 m")), "contours misstate source grid or accuracy");
  check(section.entity_type === "TerrainSection" && section.source_sha256 === terrain.source_sha256 && section.boundary_sha256 === terrain.boundary_sha256, "section source/boundary lineage mismatch");
  check(section.sample_interval_m === 5 && section.samples?.length > 50, "section sampling contract changed");
  inspectGlb(path.join(bundle, "terrain-context-v0.2.glb"), check);

  check(roads.type === "FeatureCollection" && roads.features?.length === 107 && roads.properties?.legal_access_status === "NOT_ESTABLISHED", "road context or legal-access status changed");
  check(buildings.type === "FeatureCollection" && buildings.features?.length === 14, "Catastro building context changed");
  const buildingPolygons = buildings.features?.flatMap((feature) => feature.geometry?.coordinates ?? []) ?? [];
  check(buildingPolygons.length === 36 && buildingPolygons.reduce((sum, polygon) => sum + polygon.length - 1, 0) === 38, "Catastro building multiparts/holes were not preserved");
  check(access.type === "FeatureCollection" && access.features?.length === 3, "access candidate overlay must contain three review candidates");
  check(access.properties?.permitted_access_point === null && access.properties?.status === "UNVERIFIED_ANALYSIS_OVERLAY", "access overlay claims permission");
  check(access.features.every((feature) => feature.properties?.status === "UNVERIFIED_PHYSICAL_PROXIMITY_ONLY" && feature.properties?.does_not_establish_legal_access === true && feature.properties?.gap_m > 0), "access candidate disclaimer or gap is invalid");

  check(site.schema_version === "0.2" && site.entity_type === "SiteTwin" && site.site_twin_id === SITE_ID, "Site Twin v0.2 identity is wrong");
  check(site.base_site_twin?.sha256 === V01_IMMUTABLE.get("data/sites/canopus/site-twin-v0.1.json"), "Site Twin does not pin the immutable v0.1 base");
  check(site.spatial_evidence_manifest?.path === `${BUNDLE_REL}/spatial-evidence-manifest-v0.2.json` && site.spatial_evidence_manifest?.sha256 === digest(path.join(bundle, "spatial-evidence-manifest-v0.2.json")), "Site Twin does not pin the exact spatial evidence manifest");
  check(site.access?.status === "UNVERIFIED_ANALYSIS_ONLY" && site.access?.permitted_access_point === null, "Site Twin claims permitted access");
  check(site.planning?.status === "UNRESOLVED_NO_COMPLIANCE_CLAIM" && site.planning?.entitlement === null && site.planning?.buildable_envelope === null, "Site Twin claims planning entitlement or buildable envelope");
  check(site.terrain?.scope_note?.includes("not a survey-grade"), "terrain scope overstates survey accuracy");
  check(Array.isArray(site.hard_gates) && site.hard_gates.length === EXPECTED_GATES.length, "Site Twin gate count changed");
  const gates = new Map(site.hard_gates.map((gate) => [gate.gate_id, gate]));
  check(gates.size === EXPECTED_GATES.length && EXPECTED_GATES.every((id) => gates.has(id)), "Site Twin gate set changed");
  for (const id of EXPECTED_GATES) {
    const gate = gates.get(id);
    const shouldSatisfy = id === "GATE_CATASTRO_BOUNDARY" || id === "GATE_IGN_TERRAIN";
    check(gate?.severity === "HARD", `${id}: severity changed`);
    check(gate?.status === (shouldSatisfy ? "SATISFIED" : "OPEN"), `${id}: stage-aware status is wrong`);
    check(shouldSatisfy ? gate?.evidence_ids?.length === 1 && gate?.satisfied_at : gate?.evidence_ids?.length === 0 && gate?.satisfied_at === null, `${id}: satisfaction evidence/history is wrong`);
  }

  for (const [relative, expected] of V01_IMMUTABLE) {
    check(fs.existsSync(absolute(relative)) && digest(absolute(relative)) === expected, `${relative}: immutable v0.1/project/scenario evidence changed`);
  }
  check(exportContract.site_twin_ref?.content_sha256 === digest(path.join(bundle, "site-twin-v0.2.json")), "export contract does not pin the exact Site Twin v0.2");
  check(exportContract.layers?.concept_massing_overlay === null && exportContract.layers?.planning_envelope === null, "export contract imports unverified concept/planning geometry");
  check(exportContract.controls?.la_concha_sightline?.status === "REPORTED_SCENARIO_OVERLAY_ONLY" && exportContract.controls?.la_concha_sightline?.asset === null, "La Concha sightline is presented as verified geometry");
  check(exportContract.controls?.seasonal_sun?.status === "PARAMETRIC_CONTROL_CONTRACT" && exportContract.controls?.seasonal_sun?.note?.includes("does not assert"), "seasonal sun control overstates rendered evidence");
  check(Object.values(exportContract.separation ?? {}).every((value) => value === false), "export separation contract was violated");

  return { ok: errors.length === 0, errors, assertions, sources: manifest.sources.length, artifacts: manifest.derived_artifacts.length, gates: site.hard_gates.length };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  const runtimeRootIndex = process.argv.indexOf("--runtime-root");
  const runtimeRoot = runtimeRootIndex >= 0 ? process.argv[runtimeRootIndex + 1] : null;
  if (runtimeRootIndex >= 0 && !runtimeRoot) throw new Error("--runtime-root requires a directory");
  const result = validateSpatialBundle({ requireRuntime: process.argv.includes("--require-runtime"), runtimeRoot });
  if (!result.ok) {
    console.error(JSON.stringify({ status: "FAIL", ...result }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ status: "PASS", profile: "CANOPUS_SPATIAL_V0_2", ...result }, null, 2));
  }
}
