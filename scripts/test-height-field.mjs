/**
 * Height-field decimation gate.
 *
 * The whole point of this module is to shrink a DEM to the render budget WITHOUT lying about
 * the shape, so the tests are known answers about both halves: the geometry it produces and the
 * error it reports. A decimator that under-reports its own error is worse than no decimator.
 *
 *   node scripts/test-height-field.mjs
 */
import {
  assertHeightField, bilinearSample, segmentsForTriangleBudget, heightFieldToGrid
} from "../engine/compile/height-field.mjs";

let failures = 0;
let checks = 0;
const check = (condition, message) => { checks += 1; if (!condition) { failures += 1; console.error(`FAIL  ${message}`); } };
const near = (actual, expected, tolerance, message) =>
  check(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${message} — expected ${expected} ±${tolerance}, got ${actual}`);

const constant = (rows, cols, value) => Array.from({length: rows}, () => Array.from({length: cols}, () => value));
const ramp = (n, perCol) => Array.from({length: n}, () => Array.from({length: n}, (_, c) => c * perCol));
const bowl = (n, amp) => Array.from({length: n}, (_, r) => Array.from({length: n}, (_, c) => {
  const u = (c / (n - 1)) * 2 - 1;
  const v = (r / (n - 1)) * 2 - 1;
  return amp * (u * u + v * v);
}));

// ── budget arithmetic ─────────────────────────────────────────────────────────────────────────
near(segmentsForTriangleBudget(150_000), 273, 0, "273² × 2 = 149,058 ≤ 150,000 < 274² × 2");
check(2 * segmentsForTriangleBudget(150_000) ** 2 <= 150_000, "the chosen segment count must stay within budget");
check(2 * (segmentsForTriangleBudget(150_000) + 1) ** 2 > 150_000, "one more segment must exceed budget — it must be the largest that fits");

// ── validation ──────────────────────────────────────────────────────────────────────────────
let rejected = 0;
for (const bad of [[[1]], [[1, 2], [3]], [[1, "x"], [3, 4]], [[1, 2], [3, Number.NaN]], 42, [[1, 2]]]) {
  try { assertHeightField(bad); } catch { rejected += 1; }
}
check(rejected === 6, `assertHeightField must reject all 6 malformed inputs, rejected ${rejected}`);

// ── bilinear sampling: known answers ──────────────────────────────────────────────────────────
const quad = [[0, 10], [20, 30]];
near(bilinearSample(quad, 0, 0), 0, 1e-12, "bilinear at a corner returns that corner");
near(bilinearSample(quad, 1, 0), 10, 1e-12, "bilinear at the opposite column");
near(bilinearSample(quad, 0.5, 0.5), 15, 1e-12, "bilinear at the centre is the four-corner mean");
near(bilinearSample(quad, 5, 5), 30, 1e-12, "bilinear clamps outside the field");

// ── a plane resamples losslessly ────────────────────────────────────────────────────────────
const plane = heightFieldToGrid({heights: constant(40, 40, 100), size: 360, maxTriangles: 150_000});
check(plane.fidelity.lossless, "a flat field with no decimation must be lossless");
near(plane.fidelity.rms_error_m, 0, 1e-9, "a flat field costs zero error");
near(plane.fidelity.datum_m, 100, 1e-9, "datum defaults to the field mean");
check(plane.geometry.vertices.every(([, y]) => Math.abs(y) < 1e-9), "a flat field sits exactly on its datum");

// ── a linear ramp is exactly representable, even when decimated ───────────────────────────────
const rampField = ramp(361, 0.5);
const rampGrid = heightFieldToGrid({heights: rampField, size: 360, maxTriangles: 150_000});
check(rampGrid.fidelity.output_triangles <= 150_000, "the decimated ramp must fit the budget");
check(rampGrid.fidelity.output_triangles < rampGrid.fidelity.source_triangles, "the 361² ramp must actually be decimated");
near(rampGrid.fidelity.rms_error_m, 0, 1e-6, "bilinear resampling of a LINEAR field costs no error, even decimated");
near(rampGrid.fidelity.max_error_m, 0, 1e-6, "and no worst-case error either");
check(rampGrid.limitations[0].includes("Decimated"), "a decimated surface must say so in its limitations");
check(rampGrid.limitations.some(text => text.includes("RMS")), "the limitations must state the height error the decimation cost");

// ── a curved surface: decimation MUST cost something, and it must be reported ──────────────────
const bowlField = bowl(129, 20);
const fine = heightFieldToGrid({heights: bowlField, size: 256, segments: 128});
const coarse = heightFieldToGrid({heights: bowlField, size: 256, segments: 16});
near(fine.fidelity.rms_error_m, 0, 1e-9, "sampling a bowl at its own resolution is lossless");
check(coarse.fidelity.rms_error_m > 0, "coarsening a curved surface MUST cost error — a decimator reporting zero here is lying");
check(coarse.fidelity.max_error_m >= coarse.fidelity.rms_error_m, "max error can never be below RMS error");
check(coarse.fidelity.max_error_m < 20, "the error must stay well under the bowl's own 20 m amplitude");
// Finer resampling must reduce the error, monotonically.
const mid = heightFieldToGrid({heights: bowlField, size: 256, segments: 64});
check(mid.fidelity.rms_error_m < coarse.fidelity.rms_error_m, "a finer grid must reduce RMS error");
check(mid.fidelity.rms_error_m > fine.fidelity.rms_error_m, "and still cost more than the lossless full-resolution grid");

// ── the DEM that motivated the perf budget ─────────────────────────────────────────────────────
// A 1 m DEM over 360 m is 361×361 = 259,200 source triangles, over the 150k Twin budget.
check(fine.geometry.vertices.length === (128 + 1) ** 2, "vertex count must be (segments+1)²");
const budgeted = heightFieldToGrid({heights: bowl(361, 8), size: 360, maxTriangles: 150_000});
check(budgeted.fidelity.source_triangles > 150_000, "the 361² source must be over budget to begin with");
check(budgeted.fidelity.output_triangles <= 150_000, "the decimated output must be within the Twin triangle budget");
check(budgeted.fidelity.decimation_ratio > 1, "and the reported ratio must reflect a real reduction");

// ── the decimated grid feeds the engine unchanged ─────────────────────────────────────────────
const {parseScene} = await import("../engine/core/scene-contract.mjs");
const {assembleScene} = await import("../engine/compile/scene-assembler.mjs");
const terrainElement = {
  id: "TERRAIN_DEM", type: "TERRAIN", label: "Decimated DEM", evidence_class: "DERIVED",
  geometry: budgeted.geometry, source_refs: ["SRC_TEST_DEM"], limitations: budgeted.limitations
};
let assembled = null;
try {
  assembled = assembleScene({
    sceneId: "SCENE_DEM_TEST", generatedAt: "2026-08-20T00:00:00Z",
    subject: {label: "DEM", identity_evidence_class: "DERIVED", identity_scope: "TEST"},
    originWgs84: [0, 0], elements: [terrainElement],
    sourceBindings: [{path: "test", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "TEST"}],
    legalClaimPolicy: {blocked_claims: ["SURVEYED_TERRAIN"], rule: "Test."},
    navigationPlan: [{id: "SITE", label: "Site", types: ["TERRAIN"], bearing_deg: 215, elevation_deg: 30}]
  });
} catch (error) {
  check(false, `a decimated DEM must assemble into a valid scene — ${error.message}`);
}
check(assembled?.scene.scene_id === "SCENE_DEM_TEST", "the decimated grid must pass the scene contract unchanged");

console.log(`${checks - failures}/${checks} height-field checks passed`);
if (failures) { console.error(`height-field gate FAILED with ${failures} failure(s)`); process.exit(1); }
console.log("height-field gate PASSED");
