/**
 * Gate: OSM context-buildings compiler + merge.
 *
 * Known answers for projection, height estimation, budget clipping, and element assembly.
 * The merge module is browser-only (needs three.js WebGL), so we test the compiler's output
 * against the scene contract instead — if the elements pass parseScene, they'll render.
 */

import {compileOsmBuildings} from "../engine/compile/osm-buildings.mjs";
import {parseScene} from "../engine/core/scene-contract.mjs";
import {assembleScene} from "../engine/compile/scene-assembler.mjs";
import {interpolateTerrainGrid} from "../engine/compile/terrain-interpolation.mjs";

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { passed += 1; }
  else { failed += 1; console.error(`  FAIL: ${label}`); }
}

function assertThrows(fn, label) {
  try { fn(); failed += 1; console.error(`  FAIL (no throw): ${label}`); }
  catch { passed += 1; }
}

function near(a, b, tolerance = 0.01) {
  return Math.abs(a - b) < tolerance;
}

// ── test data ──────────────────────────────────────────────────────────────────

const ORIGIN = [-0.72, 38.0];

function makeBuilding(lon, lat, {levels, height, id} = {}) {
  const d = 0.0001;
  return {
    type: "Feature",
    properties: {
      "@id": id ?? `way/${Math.round(lon * 1e6)}`,
      ...(levels != null ? {"building:levels": String(levels)} : {}),
      ...(height != null ? {height} : {})
    },
    geometry: {
      type: "Polygon",
      coordinates: [[[lon, lat], [lon + d, lat], [lon + d, lat + d], [lon, lat + d], [lon, lat]]]
    }
  };
}

function makeCluster(count, {startLon = -0.72, startLat = 38.0, spacing = 0.0003} = {}) {
  return Array.from({length: count}, (_, i) =>
    makeBuilding(startLon + i * spacing, startLat, {id: `way/${1000 + i}`})
  );
}

// ── basic compilation ──────────────────────────────────────────────────────────

console.log("§1 basic compilation");

const basic = compileOsmBuildings({
  features: [makeBuilding(-0.7201, 38.0001, {levels: 3})],
  originWgs84: ORIGIN,
  sourceRefs: ["OSM"]
});

assert(basic.elements.length === 1, "one building → one element");
assert(basic.elements[0].type === "CONTEXT_BUILDING", "type is CONTEXT_BUILDING");
assert(basic.elements[0].evidence_class === "REPORTED_UNVERIFIED", "evidence class is REPORTED_UNVERIFIED");
assert(basic.elements[0].geometry.primitive === "EXTRUDED_POLYGON", "primitive is EXTRUDED_POLYGON");
assert(basic.elements[0].geometry.height === 9, "3 levels × 3m = 9m");
assert(basic.elements[0].geometry.points_xz.length >= 3, "at least 3 footprint points");
assert(basic.elements[0].source_refs[0] === "OSM", "source ref preserved");
assert(basic.elements[0].limitations.length > 0, "has limitations");

// ── height estimation ──────────────────────────────────────────────────────────

console.log("§2 height estimation");

const heightFromTag = compileOsmBuildings({
  features: [makeBuilding(-0.7201, 38.0001, {height: 15})],
  originWgs84: ORIGIN,
  sourceRefs: ["OSM"]
});
assert(heightFromTag.elements[0].geometry.height === 15, "height tag used directly");

const heightDefault = compileOsmBuildings({
  features: [makeBuilding(-0.7201, 38.0001)],
  originWgs84: ORIGIN,
  sourceRefs: ["OSM"]
});
assert(heightDefault.elements[0].geometry.height === 7, "default height 7m");

// ── budget clipping ────────────────────────────────────────────────────────────

console.log("§3 budget clipping");

const manyFeatures = makeCluster(100);
const clipped = compileOsmBuildings({
  features: manyFeatures,
  originWgs84: ORIGIN,
  maxBuildings: 30,
  sourceRefs: ["OSM"]
});
assert(clipped.elements.length === 30, "capped at maxBuildings");
assert(clipped.skipped === 70, "70 skipped");
assert(clipped.limitations.some(l => l.includes("70")), "limitation mentions skipped count");

// nearest-to-origin ordering
const distances = clipped.elements.map(e => {
  const c = e.geometry.points_xz;
  const cx = c.reduce((s, p) => s + p[0], 0) / c.length;
  const cz = c.reduce((s, p) => s + p[1], 0) / c.length;
  return Math.hypot(cx, cz);
});
for (let i = 1; i < distances.length; i++) {
  assert(distances[i] >= distances[i - 1] - 1, `building ${i} not closer than ${i - 1}`);
}

// ── small footprint filter ─────────────────────────────────────────────────────

console.log("§4 small footprint filter");

const tinyBuilding = {
  type: "Feature",
  properties: {"@id": "way/tiny"},
  geometry: {
    type: "Polygon",
    coordinates: [[[-0.72, 38.0], [-0.72 + 0.00001, 38.0], [-0.72 + 0.00001, 38.0 + 0.00001], [-0.72, 38.0 + 0.00001], [-0.72, 38.0]]]
  }
};
const filtered = compileOsmBuildings({
  features: [tinyBuilding],
  originWgs84: ORIGIN,
  sourceRefs: ["OSM"]
});
assert(filtered.elements.length === 0, "tiny footprint filtered out");

// ── terrain draping ────────────────────────────────────────────────────────────

console.log("§5 terrain draping");

const terrainSamples = [
  {x: 0, z: 0, elevation: 100},
  {x: 50, z: 0, elevation: 105},
  {x: 0, z: 50, elevation: 102},
  {x: 50, z: 50, elevation: 108}
];
const draped = compileOsmBuildings({
  features: [makeBuilding(-0.7201, 38.0001)],
  originWgs84: ORIGIN,
  terrainSamples,
  datum: 100,
  sourceRefs: ["OSM"]
});
assert(draped.elements[0].geometry.base_y !== 0, "base_y adjusted for terrain");
assert(draped.elements[0].limitations.some(l => l.includes("draped")), "limitation mentions draping");

// ── scene contract compliance ──────────────────────────────────────────────────

console.log("§6 scene contract compliance");

const buildings50 = compileOsmBuildings({
  features: makeCluster(50),
  originWgs84: ORIGIN,
  sourceRefs: ["OpenStreetMap contributors, ODbL"]
});

// Build a minimal scene with these context buildings + a terrain
const terrainGrid = interpolateTerrainGrid({
  samples: terrainSamples,
  size: 200,
  segments: 8
});

const allElements = [
  {
    id: "terrain",
    type: "TERRAIN",
    label: "Ground surface",
    evidence_class: "DERIVED",
    geometry: terrainGrid.geometry,
    source_refs: ["test"],
    limitations: terrainGrid.limitations
  },
  ...buildings50.elements
];

try {
  const assembled = assembleScene({
    sceneId: "osm-test/v0.1",
    generatedAt: "2026-08-21T00:00:00Z",
    subject: {label: "OSM test", identity_evidence_class: "DERIVED"},
    originWgs84: ORIGIN,
    sourceBindings: [{source: "test", role: "terrain"}, {source: "OSM", role: "context"}],
    legalClaimPolicy: {blocked_claims: ["Not a survey"]},
    elements: allElements,
    navigationPlan: [
      {id: "overview", label: "Overview", types: ["TERRAIN", "CONTEXT_BUILDING"], bearing_deg: 215, elevation_deg: 35}
    ]
  });
  assert(true, "50 OSM buildings pass scene contract");
  assert(assembled.scene.elements.length === 51, "51 elements total (terrain + 50 buildings)");
} catch (error) {
  assert(false, `scene contract failed: ${error.message}`);
}

// ── input validation ───────────────────────────────────────────────────────────

console.log("§7 input validation");

assertThrows(() => compileOsmBuildings({features: [], originWgs84: ORIGIN, sourceRefs: ["x"]}), "empty features throws");
assertThrows(() => compileOsmBuildings({features: [makeBuilding(-0.72, 38)], originWgs84: ORIGIN, sourceRefs: []}), "empty sourceRefs throws");

// ── OSM id handling ────────────────────────────────────────────────────────────

console.log("§8 OSM id handling");

const withSlash = compileOsmBuildings({
  features: [{
    type: "Feature",
    properties: {"@id": "way/12345"},
    geometry: makeBuilding(-0.7201, 38.0001).geometry
  }],
  originWgs84: ORIGIN,
  sourceRefs: ["OSM"]
});
assert(withSlash.elements[0].id === "ctx-osm-way-12345", "slash in OSM id replaced with dash");

const noId = compileOsmBuildings({
  features: [{type: "Feature", properties: {}, geometry: makeBuilding(-0.7201, 38.0001).geometry}],
  originWgs84: ORIGIN,
  sourceRefs: ["OSM"]
});
assert(noId.elements[0].id.startsWith("ctx-bldg-"), "fallback id when no OSM id");

// ── parse error tolerance ──────────────────────────────────────────────────────

console.log("§9 parse error tolerance");

const mixed = compileOsmBuildings({
  features: [
    makeBuilding(-0.7201, 38.0001),
    {type: "Feature", properties: {}, geometry: {type: "Point", coordinates: [0, 0]}},
    makeBuilding(-0.7202, 38.0001)
  ],
  originWgs84: ORIGIN,
  sourceRefs: ["OSM"]
});
assert(mixed.elements.length === 2, "unparseable features skipped");
assert(mixed.parseErrors === 1, "parse error counted");

// ── unique ids ─────────────────────────────────────────────────────────────────

console.log("§10 unique ids");

const cluster = compileOsmBuildings({
  features: makeCluster(200),
  originWgs84: ORIGIN,
  sourceRefs: ["OSM"]
});
const ids = new Set(cluster.elements.map(e => e.id));
assert(ids.size === cluster.elements.length, "all element ids unique");

// ── summary ────────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed (${passed + failed} checks)`);
if (failed > 0) process.exit(1);
