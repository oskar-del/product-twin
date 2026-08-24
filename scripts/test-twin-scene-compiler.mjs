/**
 * Scene-compiler gate.
 *
 * The compiler turns evidence into geometry, which is the step where a wrong number stops being
 * a wrong number and becomes a picture someone believes. So: known-answer tests for the geodesy
 * and the interpolation, and mutation tests for every place the assembler could be talked into
 * emitting an unsourced or unrenderable scene.
 *
 *   node scripts/test-twin-scene-compiler.mjs
 */
import {ringAreaM2, ringCentroid, projectFeature, checkStatedArea, meanLonLat} from "../engine/compile/geo-polygons.mjs";
import {interpolateTerrainGrid, sampleHeightAt} from "../engine/compile/terrain-interpolation.mjs";
import {assembleScene, deriveNavigation, frameCamera, parcelElement, extentsOf} from "../engine/compile/scene-assembler.mjs";
import {depthSettingsFor, maxStageDistance} from "../engine/core/extents.mjs";
import {SceneContractError} from "../engine/core/scene-contract.mjs";

let failures = 0;
let checks = 0;
const check = (condition, message) => { checks += 1; if (!condition) { failures += 1; console.error(`FAIL  ${message}`); } };
const near = (actual, expected, tolerance, message) =>
  check(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${message} — expected ${expected} ±${tolerance}, got ${actual}`);

// ── geodesy: known answers ──────────────────────────────────────────────────────────────────
const square = [[0, 0], [100, 0], [100, 100], [0, 100]];
near(Math.abs(ringAreaM2(square)), 10_000, 1e-9, "a 100 m square is 10,000 m²");
const centroid = ringCentroid(square);
near(centroid[0], 50, 1e-9, "square centroid x");
near(centroid[1], 50, 1e-9, "square centroid z");
check(ringAreaM2(square) * ringAreaM2([...square].reverse()) < 0, "winding order must flip the sign of the area");
check(ringAreaM2(square) > 0, "the documented convention is positive area for this winding");
const offsetSquare = square.map(([x, z]) => [x + 1000, z - 500]);
near(ringCentroid(offsetSquare)[0], 1050, 1e-9, "centroid must follow the ring it belongs to (x)");
near(ringCentroid(offsetSquare)[1], -450, 1e-9, "centroid must follow the ring it belongs to (z)");

// A degree of latitude is ~111.13 km; a degree of longitude at 38.7°N is ~86.9 km. Project a
// one-arc-second box and check both dimensions against those, independently of any parcel data.
const origin = [0.119172, 38.700505];
const arcsecond = 1 / 3600;
const box = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [[
      [origin[0], origin[1]],
      [origin[0] + arcsecond, origin[1]],
      [origin[0] + arcsecond, origin[1] + arcsecond],
      [origin[0], origin[1] + arcsecond],
      [origin[0], origin[1]]
    ]]
  }
};
const projectedBox = projectFeature({feature: box, originWgs84: origin});
const boxRing = projectedBox.ring;
const widthM = Math.abs(boxRing[1][0] - boxRing[0][0]);
const heightM = Math.abs(boxRing[2][1] - boxRing[1][1]);
near(widthM, 111412.84 * Math.cos(38.700505 * Math.PI / 180) / 3600, 0.02, "one arcsecond of longitude at 38.7°N, metres");
near(heightM, 30.87, 0.05, "one arcsecond of latitude, metres");
near(projectedBox.area_m2, widthM * heightM, 0.5, "projected box area must equal width × height");
check(projectedBox.ring.length === 4, "the GeoJSON closing vertex must be dropped");

near(meanLonLat([[0, 0], [2, 4]])[0], 1, 1e-12, "meanLonLat longitude");
near(meanLonLat([[0, 0], [2, 4]])[1], 2, 1e-12, "meanLonLat latitude");

const areaCheck = checkStatedArea({projected: {area_m2: 943}, statedAreaM2: 1000, tolerance: 0.05});
check(areaCheck.checked && !areaCheck.within_tolerance, "a 5.7 % area disagreement must fail a 5 % tolerance");
check(checkStatedArea({projected: {area_m2: 943}, statedAreaM2: null}).checked === false, "a missing stated area must report as unchecked, not as a pass");

// ── terrain interpolation ───────────────────────────────────────────────────────────────────
const flat = [{x: -50, z: -50, elevation: 100}, {x: 50, z: -50, elevation: 100}, {x: 0, z: 50, elevation: 100}];
const flatGrid = interpolateTerrainGrid({samples: flat, size: 100, segments: 4});
check(flatGrid.geometry.vertices.every(([, y]) => Math.abs(y) < 1e-9), "equal samples must interpolate to a flat surface at the datum");
near(flatGrid.metadata.datum_m, 100, 1e-9, "datum defaults to the sample mean");
check(flatGrid.geometry.vertices.length === 25, "vertex count must be (segments+1)²");

const slope = [{x: -50, z: 0, elevation: 0}, {x: 50, z: 0, elevation: 100}];
const slopeSamples = [...slope, {x: 0, z: 50, elevation: 50}];
const slopeGrid = interpolateTerrainGrid({samples: slopeSamples, size: 100, segments: 10});
const west = slopeGrid.geometry.vertices.filter(([x]) => x < -40).map(([, y]) => y);
const east = slopeGrid.geometry.vertices.filter(([x]) => x > 40).map(([, y]) => y);
check(Math.max(...west) < Math.min(...east), "a west-low/east-high sample set must interpolate to a west-low/east-high surface");
near(sampleHeightAt({samples: flat, x: 0, z: 0}).height, 0, 1e-9, "point sampling agrees with a flat grid");
check(interpolateTerrainGrid({samples: slopeSamples, size: 400, segments: 4}).metadata.extrapolated_beyond_samples,
  "a grid wider than its samples must declare that it extrapolates");
check(flatGrid.limitations.length >= 2 && flatGrid.limitations[0].includes("interpolated"),
  "interpolated terrain must ship limitations that say so");

let rejected = 0;
for (const bad of [
  {samples: [{x: 0, z: 0, elevation: 1}], size: 10, segments: 2},
  {samples: flat, size: 0, segments: 2},
  {samples: flat, size: 10, segments: 0},
  {samples: [{x: 0, z: 0}, {x: 1, z: 1, elevation: 2}, {x: 2, z: 2, elevation: 3}], size: 10, segments: 2}
]) {
  try { interpolateTerrainGrid(bad); } catch { rejected += 1; }
}
check(rejected === 4, `terrain interpolation must reject all 4 malformed inputs, rejected ${rejected}`);

// ── camera framing ──────────────────────────────────────────────────────────────────────────
const framed = frameCamera({centre: [0, 0], radius: 100, fovDeg: 45, elevationDeg: 30, bearingDeg: 180});
const framedDistance = Math.hypot(framed[0], framed[1], framed[2]);
near(framedDistance, 100 * 1.05 / Math.tan(22.5 * Math.PI / 180), 0.01, "framing distance must fit the radius at the given field of view");
near(framed[1], framedDistance * Math.sin(30 * Math.PI / 180), 0.01, "camera elevation angle");
// bearingDeg is where the camera stands: 180° = due south of the target, and south is −z.
check(framed[2] < 0 && Math.abs(framed[0]) < 0.01, "bearing 180° must place the camera due south of the target");
const fromNorthWest = frameCamera({centre: [0, 0], radius: 100, bearingDeg: 315});
check(fromNorthWest[0] < 0 && fromNorthWest[2] > 0, "bearing 315° must place the camera to the north-west");
// Fog must not swallow the framing the compiler chose.
const depth = depthSettingsFor(100, framedDistance);
check(depth.fogNear > framedDistance, `fog must start beyond the scene's own camera (fogNear ${depth.fogNear.toFixed(0)} vs camera ${framedDistance.toFixed(0)})`);

// ── assembler ───────────────────────────────────────────────────────────────────────────────
const ring = [[-20, -20], [20, -20], [20, 20], [-20, 20]];
const baseElements = [
  {...interpolatedTerrainElement()},
  parcelElement({
    id: "PARCEL_A", label: "Parcel A", evidenceClass: "AUTHORITATIVE", ring,
    sourceRefs: ["SRC_TEST"], limitations: ["Test fixture."]
  })
];
function interpolatedTerrainElement() {
  const grid = interpolateTerrainGrid({samples: flat, size: 200, segments: 4});
  return {
    id: "TERRAIN_A", type: "TERRAIN", label: "Terrain", evidence_class: "DERIVED",
    geometry: grid.geometry, source_refs: ["SRC_TEST"], limitations: grid.limitations
  };
}
const baseInput = {
  sceneId: "SCENE_TEST",
  generatedAt: "2026-08-19T00:00:00Z",
  subject: {label: "Test", identity_evidence_class: "AUTHORITATIVE", identity_scope: "TEST"},
  originWgs84: origin,
  elements: baseElements,
  sourceBindings: [{path: "test", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "TEST"}],
  legalClaimPolicy: {blocked_claims: ["LEGAL_BOUNDARY"], rule: "Test."},
  navigationPlan: [{id: "SITE", label: "Site", types: ["TERRAIN", "PLOT"], bearing_deg: 215, elevation_deg: 32}]
};
const assembled = assembleScene(structuredClone(baseInput));
check(assembled.scene.scene_id === "SCENE_TEST", "assembler must return a parsed scene");
check(assembled.scene.stages.length === 1, "assembler must derive the planned stages");
check(assembled.document.coordinate_system.frame === "LOCAL_ENU", "assembled scenes are always local ENU");
near(extentsOf(assembled.scene.elements).radius_m, Math.hypot(200, 200) / 2, 0.01, "extents come from the widest element");
check(maxStageDistance(assembled.scene.stages) > 0, "a derived stage must stand back from its target");

const MUTATIONS = [
  ["element with no evidence class", input => { delete input.elements[1].evidence_class; }],
  ["element with an invented evidence class", input => { input.elements[1].evidence_class = "PROBABLY"; }],
  ["element with no sources", input => { input.elements[1].source_refs = []; }],
  ["element with no limitations field", input => { delete input.elements[1].limitations; }],
  ["scene with no source bindings", input => { input.sourceBindings = []; }],
  ["scene with no legal claim policy", input => { delete input.legalClaimPolicy; }],
  ["scene with no elements", input => { input.elements = []; }],
  ["scene with no origin", input => { delete input.originWgs84; }],
  ["scene with no id", input => { delete input.sceneId; }],
  ["undated scene", input => { delete input.generatedAt; }],
  ["stage naming a type no element has", input => { input.navigationPlan[0].types = ["PHANTOM"]; }],
  ["stage focusing an unknown element", input => { input.navigationPlan[0].focus_element_id = "NOPE"; }],
  ["stage opening an unknown element", input => { input.navigationPlan[0].open_element_id = "NOPE"; }],
  ["terrain whose vertices contradict its segments", input => { input.elements[0].geometry.vertices.pop(); }]
];
for (const [name, mutate] of MUTATIONS) {
  const input = structuredClone(baseInput);
  mutate(input);
  let threw = false;
  try { assembleScene(input); } catch (error) { threw = error instanceof TypeError || error instanceof RangeError || error instanceof SceneContractError; }
  check(threw, `assembler must refuse: ${name}`);
}

console.log(`${checks - failures}/${checks} compiler checks passed (${MUTATIONS.length} assembler mutations)`);
if (failures) { console.error(`twin-scene compiler gate FAILED with ${failures} failure(s)`); process.exit(1); }
console.log("twin-scene compiler gate PASSED");
