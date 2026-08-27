/**
 * Gate: authoritative boundary compiler.
 *
 * Known answers from the real SVÄRTINGE 54:28 LM boundary + synthetic test cases.
 */

import {compileAuthoritativeBoundary} from "../engine/compile/authoritative-boundary.mjs";
import {parseScene} from "../engine/core/scene-contract.mjs";
import {assembleScene} from "../engine/compile/scene-assembler.mjs";
import {interpolateTerrainGrid} from "../engine/compile/terrain-interpolation.mjs";
import {readFileSync} from "fs";

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

// ── real LM boundary ──────────────────────────────────────────────────────────

console.log("§1 real SVÄRTINGE 54:28 boundary");

let lmFeature;
try {
  lmFeature = JSON.parse(readFileSync(
    new URL("../../../.runtime/reference-data/lantmateriet/svartinge-54-28-lm-boundary.geojson",
      import.meta.url), "utf8"
  ));
} catch {
  // Fallback: inline the known WGS84 coordinates
  lmFeature = {
    type: "Feature",
    properties: {designation: "SVÄRTINGE 54:28"},
    geometry: {
      type: "Polygon",
      coordinates: [[[16.03231033,58.65238756],[16.03139629,58.65243100],[16.03119687,58.65212430],[16.03165819,58.65208448],[16.03206056,58.65204974],[16.03208504,58.65208267],[16.03231033,58.65238756]]]
    }
  };
}

const origin = [16.0316, 58.6522];

const result = compileAuthoritativeBoundary({
  feature: lmFeature,
  originWgs84: origin,
  designation: "SVÄRTINGE 54:28",
  statedAreaM2: 1936.8,
  registrySource: "Lantmäteriet Fastighetsindelning vektor",
  registryId: "a07b2e4d-f075-2dae-05e3-c5f46a4f67a8",
  lastUpdated: "2023-01-27T14:07Z"
});

assert(result.element.type === "PROPERTY_BOUNDARY", "type is PROPERTY_BOUNDARY");
assert(result.element.evidence_class === "AUTHORITATIVE", "evidence class is AUTHORITATIVE");
assert(result.element.id === "boundary-sv-rtinge-54-28", "id derived from designation");
assert(result.element.geometry.primitive === "EXTRUDED_POLYGON", "primitive is EXTRUDED_POLYGON");
assert(result.element.geometry.height === 0.15, "thin slab height");
assert(result.element.geometry.points_xz.length === 6, "6 boundary vertices (closed ring opened)");
assert(result.element.source_refs.includes("Lantmäteriet Fastighetsindelning vektor"), "registry source in refs");
assert(result.element.source_refs.some(r => r.includes("a07b2e4d")), "registry id in refs");
assert(result.element.limitations.some(l => l.includes("Authoritative")), "limitation says authoritative");

// Area cross-check
assert(result.areaCheck.checked === true, "area check ran");
assert(result.areaCheck.within_tolerance === true, "area within tolerance");
assert(near(result.areaCheck.drift, 0, 0.03), "drift under 3%");
console.log(`  area: computed ${result.areaCheck.computed_m2} m², stated 1936.8 m², drift ${(result.areaCheck.drift * 100).toFixed(2)}%`);

// ── scene contract compliance ──────────────────────────────────────────────────

console.log("§2 scene contract compliance");

const terrainSamples = [
  {x: 0, z: 0, elevation: 50},
  {x: 50, z: 0, elevation: 52},
  {x: 0, z: 50, elevation: 51},
  {x: 50, z: 50, elevation: 53}
];
const terrain = interpolateTerrainGrid({samples: terrainSamples, size: 200, segments: 8});

const elements = [
  {id: "terrain", type: "TERRAIN", label: "Ground", evidence_class: "DERIVED",
   geometry: terrain.geometry, source_refs: ["test"], limitations: terrain.limitations},
  result.element
];

try {
  const assembled = assembleScene({
    sceneId: "boundary-test/v0.1",
    generatedAt: "2026-08-27T00:00:00Z",
    subject: {label: "Boundary test", identity_evidence_class: "AUTHORITATIVE"},
    originWgs84: origin,
    sourceBindings: [{source: "test", role: "terrain"}, {source: "LM", role: "boundary"}],
    legalClaimPolicy: {blocked_claims: ["Not a survey"]},
    elements,
    navigationPlan: [
      {id: "overview", label: "Overview", types: ["TERRAIN", "PROPERTY_BOUNDARY"], bearing_deg: 215, elevation_deg: 35}
    ]
  });
  assert(true, "boundary element passes scene contract");
  assert(assembled.scene.elements.length === 2, "2 elements (terrain + boundary)");
} catch (error) {
  assert(false, `scene contract failed: ${error.message}`);
}

// ── terrain draping ────────────────────────────────────────────────────────────

console.log("§3 terrain draping");

const draped = compileAuthoritativeBoundary({
  feature: lmFeature,
  originWgs84: origin,
  designation: "TEST_DRAPED",
  registrySource: "test",
  terrainSamples,
  datum: 50
});
assert(draped.element.geometry.base_y !== 0, "base_y adjusted for terrain");

// ── area cross-check failure ───────────────────────────────────────────────────

console.log("§4 area cross-check failure");

const wrongArea = compileAuthoritativeBoundary({
  feature: lmFeature,
  originWgs84: origin,
  designation: "WRONG_AREA",
  statedAreaM2: 500,
  registrySource: "test"
});
assert(wrongArea.areaCheck.checked === true, "area check ran with wrong stated");
assert(wrongArea.areaCheck.within_tolerance === false, "out of tolerance");
assert(wrongArea.element.limitations.some(l => l.includes("⚠")), "warning in limitations");

// ── no stated area ─────────────────────────────────────────────────────────────

console.log("§5 no stated area");

const noArea = compileAuthoritativeBoundary({
  feature: lmFeature,
  originWgs84: origin,
  designation: "NO_AREA",
  registrySource: "test"
});
assert(noArea.areaCheck.checked === false, "area check skipped");
assert(!noArea.element.limitations.some(l => l.includes("⚠")), "no warning without stated area");

// ── input validation ───────────────────────────────────────────────────────────

console.log("§6 input validation");

assertThrows(() => compileAuthoritativeBoundary({
  feature: lmFeature, originWgs84: origin, registrySource: "test"
}), "missing designation throws");

assertThrows(() => compileAuthoritativeBoundary({
  feature: lmFeature, originWgs84: origin, designation: "X"
}), "missing registrySource throws");

// ── summary ────────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed (${passed + failed} checks)`);
if (failed > 0) process.exit(1);
