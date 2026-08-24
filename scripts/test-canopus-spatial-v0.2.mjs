import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateSpatialBundle } from "./validate-canopus-spatial-v0.2.mjs";

const sourceRoot = process.cwd();
const bundleRel = "data/sites/canopus/spatial/v0.2";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function prepare() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "canopus-spatial-v02-"));
  const bundle = path.join(root, bundleRel);
  fs.mkdirSync(path.dirname(bundle), { recursive: true });
  fs.cpSync(path.join(sourceRoot, bundleRel), bundle, { recursive: true });
  for (const name of ["project-v0.1.json", "site-twin-v0.1.json", "evidence-sources-v0.1.json"]) {
    fs.copyFileSync(path.join(sourceRoot, "data/sites/canopus", name), path.join(root, "data/sites/canopus", name));
  }
  fs.mkdirSync(path.join(root, "data/sites/canopus/design-scenarios"), { recursive: true });
  fs.copyFileSync(
    path.join(sourceRoot, "data/sites/canopus/design-scenarios/la-concha-gardens-v0.1.json"),
    path.join(root, "data/sites/canopus/design-scenarios/la-concha-gardens-v0.1.json"),
  );
  return { root, bundle };
}

const attacks = [
  ["raw/source hash tamper", "lineage mismatch", ({ bundle }) => {
    const file = path.join(bundle, "spatial-evidence-manifest-v0.2.json");
    const value = readJson(file);
    value.sources[0].sha256 = "0".repeat(64);
    writeJson(file, value);
  }],
  ["wrong parcel identifier", "exact parcel", ({ bundle }) => {
    const file = path.join(bundle, "spatial-evidence-manifest-v0.2.json");
    const value = readJson(file);
    value.sources.find((source) => source.source_id === "SRC_CATASTRO_PARCEL_GML").request_url = value.sources[0].request_url.replace("5410501UF2451S", "5410501UF2451X");
    writeJson(file, value);
  }],
  ["missing parcel CRS", "boundary CRS", ({ bundle }) => {
    const file = path.join(bundle, "boundary-epsg25830-v0.2.json");
    const value = readJson(file);
    value.source_crs = null;
    writeJson(file, value);
  }],
  ["self-intersecting parcel", "self-intersecting", ({ bundle }) => {
    const file = path.join(bundle, "boundary-epsg25830-v0.2.json");
    const value = readJson(file);
    [value.geometry.coordinates[0][10], value.geometry.coordinates[0][80]] = [value.geometry.coordinates[0][80], value.geometry.coordinates[0][10]];
    writeJson(file, value);
  }],
  ["edited parcel ring/area", "computed area changed", ({ bundle }) => {
    const file = path.join(bundle, "boundary-epsg25830-v0.2.json");
    const value = readJson(file);
    value.geometry.coordinates[0][20][0] += 20;
    writeJson(file, value);
  }],
  ["WGS84 axis swap", "swapped axes", ({ bundle }) => {
    const file = path.join(bundle, "boundary-wgs84-v0.2.geojson");
    const value = readJson(file);
    value.geometry.coordinates[0] = value.geometry.coordinates[0].map(([x, y]) => [y, x]);
    writeJson(file, value);
  }],
  ["derived artifact hash mismatch", "SHA-256 mismatch", ({ bundle }) => {
    const file = path.join(bundle, "spatial-evidence-manifest-v0.2.json");
    const value = readJson(file);
    value.derived_artifacts[0].sha256 = "f".repeat(64);
    writeJson(file, value);
  }],
  ["missing source licence", "licence name missing", ({ bundle }) => {
    const file = path.join(bundle, "spatial-evidence-manifest-v0.2.json");
    const value = readJson(file);
    value.sources[0].licence.name = "";
    writeJson(file, value);
  }],
  ["impossible retrieval date", "retrieval date", ({ bundle }) => {
    const file = path.join(bundle, "spatial-evidence-manifest-v0.2.json");
    const value = readJson(file);
    value.sources[0].retrieved_at = "2026-99-99T99:99:99+02:00";
    writeJson(file, value);
  }],
  ["terrain source hash drift", "terrain source binding mismatch", ({ bundle }) => {
    const file = path.join(bundle, "terrain-analysis-v0.2.json");
    const value = readJson(file);
    value.source_sha256 = "a".repeat(64);
    writeJson(file, value);
  }],
  ["10 m raster mislabeled as 5 m", "not a 5 m grid", ({ bundle }) => {
    const file = path.join(bundle, "terrain-analysis-v0.2.json");
    const value = readJson(file);
    value.pixel_size_m = [10, 10];
    writeJson(file, value);
  }],
  ["absent vertical datum", "vertical datum", ({ bundle }) => {
    const file = path.join(bundle, "terrain-analysis-v0.2.json");
    const value = readJson(file);
    value.vertical_datum = null;
    writeJson(file, value);
  }],
  ["slope unit swap", "slope units", ({ bundle }) => {
    const file = path.join(bundle, "terrain-analysis-v0.2.json");
    const value = readJson(file);
    value.methods.slope = "central finite differences; degrees";
    writeJson(file, value);
  }],
  ["arithmetic aspect aggregation", "aspect aggregation", ({ bundle }) => {
    const file = path.join(bundle, "terrain-analysis-v0.2.json");
    const value = readJson(file);
    value.methods.local_aspect = "arithmetic mean degrees";
    writeJson(file, value);
  }],
  ["contours mislabeled from 1 m source", "misstate source grid", ({ bundle }) => {
    const file = path.join(bundle, "contours-1m-v0.2.geojson");
    const value = readJson(file);
    value.features[0].properties.source_grid_m = 1;
    writeJson(file, value);
  }],
  ["section input-hash mismatch", "section source/boundary lineage mismatch", ({ bundle }) => {
    const file = path.join(bundle, "section-aa-v0.2.json");
    const value = readJson(file);
    value.boundary_sha256 = "b".repeat(64);
    writeJson(file, value);
  }],
  ["GLB up-axis drift", "axis convention", ({ bundle }) => {
    const file = path.join(bundle, "terrain-context-v0.2.glb");
    const bytes = fs.readFileSync(file);
    const from = Buffer.from("+X east, +Y up, -Z north");
    const to = Buffer.from("+X east, +Z up, -Y north");
    const index = bytes.indexOf(from);
    if (index < 0 || from.length !== to.length) throw new Error("test fixture GLB axis string missing");
    to.copy(bytes, index);
    fs.writeFileSync(file, bytes);
  }],
  ["access overlay claims permission", "access overlay claims permission", ({ bundle }) => {
    const file = path.join(bundle, "access-candidates-v0.2.geojson");
    const value = readJson(file);
    value.properties.permitted_access_point = value.features[0].geometry.coordinates;
    writeJson(file, value);
  }],
  ["Site Twin permitted access invented", "claims permitted access", ({ bundle }) => {
    const file = path.join(bundle, "site-twin-v0.2.json");
    const value = readJson(file);
    value.access.permitted_access_point = [-4.95, 36.49];
    writeJson(file, value);
  }],
  ["planning envelope invented", "claims planning entitlement", ({ bundle }) => {
    const file = path.join(bundle, "site-twin-v0.2.json");
    const value = readJson(file);
    value.planning.buildable_envelope = { type: "Polygon", coordinates: [] };
    writeJson(file, value);
  }],
  ["open planning gate silently closed", "stage-aware status", ({ bundle }) => {
    const file = path.join(bundle, "site-twin-v0.2.json");
    const value = readJson(file);
    value.hard_gates.find((gate) => gate.gate_id === "GATE_GOVERNING_PLAN").status = "SATISFIED";
    writeJson(file, value);
  }],
  ["scenario geometry separation violation", "separation contract", ({ bundle }) => {
    const file = path.join(bundle, "spatial-export-v0.2.json");
    const value = readJson(file);
    value.separation.scenario_geometry_imported = true;
    writeJson(file, value);
  }],
  ["La Concha ray promoted without evidence", "presented as verified geometry", ({ bundle }) => {
    const file = path.join(bundle, "spatial-export-v0.2.json");
    const value = readJson(file);
    value.controls.la_concha_sightline.status = "VERIFIED";
    value.controls.la_concha_sightline.asset = "invented.geojson";
    writeJson(file, value);
  }],
  ["immutable design scenario modified", "immutable v0.1", ({ root }) => {
    const file = path.join(root, "data/sites/canopus/design-scenarios/la-concha-gardens-v0.1.json");
    const value = readJson(file);
    value.status = "VERIFIED";
    writeJson(file, value);
  }],
];

const failures = [];
for (const [name, expectedError, mutate] of attacks) {
  const fixture = prepare();
  try {
    mutate(fixture);
    const result = validateSpatialBundle({ root: fixture.root });
    if (result.ok || !result.errors.some((error) => error.includes(expectedError))) {
      failures.push({ name, expectedError, errors: result.errors });
    }
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

if (failures.length) {
  console.error(JSON.stringify({ status: "FAIL", attacks: attacks.length, failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: "PASS", profile: "CANOPUS_SPATIAL_V0_2_MUTATIONS", attacks: attacks.length }, null, 2));
}
