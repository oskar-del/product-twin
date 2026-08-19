/**
 * Measured-claims gate.
 *
 * These studies exist to replace brochure sentences with computed ones, so they are only worth
 * anything if the computation is checkable. Every assertion here is a known answer from physics
 * or from the fixture's own dimensions — not a snapshot of whatever the code returned first.
 *
 *   node scripts/test-twin-engine-studies.mjs
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {parseScene} from "../engine/core/scene-contract.mjs";
import {createGeometryIndex} from "../engine/studies/geometry-queries.mjs";
import {sightline, sightlineMatrix} from "../engine/studies/sightline.mjs";
import {sunHours} from "../engine/studies/sun-hours.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scene = parseScene(JSON.parse(fs.readFileSync(path.join(root, "data/scenes/twin-engine-conformance/scene-v0.1.json"), "utf8")));
const index = createGeometryIndex(scene);

let failures = 0;
let checks = 0;
const check = (condition, message) => { checks += 1; if (!condition) { failures += 1; console.error(`FAIL  ${message}`); } };
const near = (actual, expected, tolerance, message) =>
  check(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${message} — expected ${expected} ±${tolerance}, got ${actual}`);

// The fixture's concept house: size [11, 5.6, 8] centred at [0, 3.8, 0] → x ±5.5, z ±4,
// y from 1.0 to 6.6. Every number below is derived from those, not observed.
check(index.blockingCount > 0, "the geometry index must find blocking meshes");
check(index.targets.every(target => target.userData.element), "every blocking mesh must carry its element");

// ── sightline: known geometry ───────────────────────────────────────────────────────────────
const through = sightline({index, from: [-40, 3, 0], to: [40, 3, 0]});
check(!through.visible, "a ray at eye height straight through the house must be blocked");
check(through.blocked_by?.element_id === "HOUSE_BODY", `the blocker must be named: got ${through.blocked_by?.element_id}`);
near(through.blocked_by.at_m, 34.5, 0.01, "the blocker must be reported at the house's near face (40 − 5.5)");
near(through.distance_m, 80, 1e-6, "sightline distance");
near(through.bearing_deg, 90, 1e-6, "a ray travelling east has bearing 90°");
near(through.elevation_deg, 0, 1e-6, "a level ray has zero elevation");

const over = sightline({index, from: [-40, 30, 0], to: [40, 30, 0]});
check(over.visible, "a ray well above the roof must be clear");
check(over.blocked_by === null, "a clear sightline reports no blocker");
check(over.limitations.some(text => text.includes("not the same as a confirmed open view")),
  "a clear sightline must say that a clear MODEL is not a clear site");

const diagonal = sightline({index, from: [0, 0, 0], to: [30, 30, 40]});
near(diagonal.horizontal_distance_m, 50, 1e-6, "horizontal distance ignores height (3-4-5)");
near(diagonal.elevation_deg, 30.9638, 0.005, "elevation angle from a 30 m rise over 50 m (reported to 2 dp)");
near(diagonal.bearing_deg, 36.8699, 0.005, "bearing of a 30-east 40-north ray (reported to 2 dp)");

// Symmetry: visibility is a property of the geometry between two points, not of direction.
const observationPoints = [
  {id: "WEST", position: [-40, 3, 0]},
  {id: "EAST", position: [40, 3, 0]},
  {id: "HIGH", position: [0, 40, 0]}
];
const matrix = sightlineMatrix({index, points: observationPoints});
check(matrix.length === 6, `a 3-point matrix has 6 ordered relations, got ${matrix.length}`);
for (const relation of matrix) {
  const reverse = matrix.find(other => other.from === relation.to && other.to === relation.from);
  check(reverse.visible === relation.visible, `${relation.from}→${relation.to} and its reverse must agree on visibility`);
  near(reverse.distance_m, relation.distance_m, 1e-9, `${relation.from}→${relation.to} distance must be symmetric`);
  near(Math.abs(reverse.bearing_deg - relation.bearing_deg), 180, 0.01, `${relation.from}→${relation.to} reverse bearing must be opposite`);
}

check(index.cast !== undefined, "the index must expose a cast()");
let coincident = false;
try { sightline({index, from: [0, 0, 0], to: [0, 0, 0]}); } catch { coincident = true; }
check(coincident, "coincident endpoints must be rejected, not answered");

// ── sun hours: known physics ────────────────────────────────────────────────────────────────
// The fixture sits at the equator, where daylight is 12 h on every date of the year.
const equator = {index, latitude: 0, longitude: 0, utcOffsetHours: 0, stepMinutes: 5};
const open = sunHours({...equator, date: "2026-06-21", point: [0, 25, 60]});
near(open.daylight_hours, 12, 0.2, "daylight at the equator is 12 h");
near(open.sunlit_hours, 12, 0.2, "an unobstructed point at the equator gets a full day of sun");
near(open.sunlit_fraction_of_daylight, 1, 0.02, "an unobstructed point is lit for all of its daylight");
check(open.intervals.length === 1, "an unobstructed day is one continuous interval");

const december = sunHours({...equator, date: "2026-12-21", point: [0, 25, 60]});
near(december.daylight_hours, 12, 0.2, "the equator has 12 h of daylight in December too");

// On the June solstice the sun sits NORTH of overhead at the equator, so a point tight against
// the house's SOUTH face (−z) is in its shadow all day. This is the study's whole purpose.
const southFace = sunHours({...equator, date: "2026-06-21", point: [0, 1.5, -4.6]});
near(southFace.sunlit_hours, 0, 0.2, "a point in the building's own shadow gets no sun");
check(southFace.first_sun_local === null && southFace.last_sun_local === null, "a fully shaded point has no first or last sun");
check(southFace.intervals.length === 0, "a fully shaded point has no sunlit intervals");
check(southFace.daylight_hours > 11, "shade must not be confused with night: daylight is unchanged");

const roof = sunHours({...equator, date: "2026-06-21", point: [0, 7, 0]});
near(roof.sunlit_hours, roof.daylight_hours, 0.2, "the roof of the tallest thing around is lit all day");

// Northern latitude: midsummer must beat midwinter, by a lot.
const nordic = {index, latitude: 58.65, longitude: 16.03, utcOffsetHours: 2, stepMinutes: 10, point: [0, 25, 60]};
const midsummer = sunHours({...nordic, date: "2026-06-21"});
const midwinter = sunHours({...nordic, date: "2026-12-21"});
check(midsummer.daylight_hours > 17, `midsummer at 58.65°N is a long day, got ${midsummer.daylight_hours} h`);
check(midwinter.daylight_hours < 7, `midwinter at 58.65°N is a short day, got ${midwinter.daylight_hours} h`);
check(midsummer.sunlit_hours > midwinter.sunlit_hours * 2, "midsummer must deliver far more sun than midwinter");

check(sunHours({...equator, date: "2026-06-21", point: [0, 25, 60]}).evidence_class === "DERIVED",
  "a computed sun-hours figure is DERIVED, never AUTHORITATIVE");
check(open.limitations.length >= 4 && open.limitations.some(text => text.includes("trees")),
  "sun hours must disclose what does NOT cast shade in the model");
check(open.method.includes("NOAA"), "the method must name itself");

let rejectedSteps = 0;
for (const stepMinutes of [0, -5, 61, Number.NaN]) {
  try { sunHours({...equator, date: "2026-06-21", point: [0, 25, 60], stepMinutes}); } catch { rejectedSteps += 1; }
}
check(rejectedSteps === 4, `sun hours must reject all 4 invalid sampling steps, rejected ${rejectedSteps}`);

// A finer step must not change the answer materially — if it does, the sampling is too coarse.
const coarse = sunHours({...equator, date: "2026-06-21", point: [3, 1.5, -4.2], stepMinutes: 20});
const fine = sunHours({...equator, date: "2026-06-21", point: [3, 1.5, -4.2], stepMinutes: 2});
near(coarse.sunlit_hours, fine.sunlit_hours, 0.5, "a 20-minute step must agree with a 2-minute step to within half an hour");

// ── viewshed: known geometry ────────────────────────────────────────────────────────────────
const {viewshed} = await import("../engine/studies/viewshed.mjs");

// High above everything, far away: nothing can block, so the whole hemisphere is sky.
const clear = viewshed({index, from: [0, 60, 120], rays: 72});
near(clear.open_sky_fraction, 1, 0.001, "an unobstructed observer sees a full hemisphere of sky");
check(clear.unresolved_azimuths === 0, "an unobstructed sweep leaves no direction unresolved");
check(clear.clear_sectors.length === 8, "all eight compass sectors must read clear");
check(clear.principal_blockers.length === 0, "an unobstructed viewshed names no blockers");

// Inside the concept house (centre [0, 3.8, 0], 11 x 5.6 x 8): enclosed on every side.
const enclosed = viewshed({index, from: [0, 3.8, 0], rays: 72});
near(enclosed.open_sky_fraction, 0, 1e-9, "an enclosed observer sees no sky at all");
check(enclosed.unresolved_azimuths === 72, "every direction from inside a closed box is blocked past the search ceiling");
check(enclosed.max_horizon_is_capped, "a capped horizon must say so rather than pass as a measurement");
check(enclosed.limitations.some(text => text.includes("counted as no sky rather than guessed")),
  "an unresolved sweep must disclose that it did not look higher");
check(enclosed.clear_sectors.length === 0, "an enclosed observer has no clear sector");

// On the roof of the tallest thing around: essentially open, and strictly better than beside it.
const roofView = viewshed({index, from: [0, 7, 0], rays: 72});
const besideView = viewshed({index, from: [7, 2, -6], rays: 72});
check(roofView.open_sky_fraction > besideView.open_sky_fraction,
  "raising the observer above the obstruction must increase open sky");
check(besideView.open_sky_fraction > 0 && besideView.open_sky_fraction < 1,
  "an observer beside a building is neither enclosed nor fully open");
check(besideView.principal_blockers.length > 0, "a partly blocked view must name what blocks it");
check(besideView.principal_blockers.every(blocker => blocker.share_of_compass > 0 && blocker.share_of_compass <= 1),
  "each blocker's share of the compass must be a fraction");
near(
  besideView.principal_blockers.reduce((sum, blocker) => sum + blocker.azimuths, 0),
  besideView.horizon.filter(sample => sample.blocked_by).length,
  0,
  "blocker azimuth counts must add up to the blocked directions"
);
check(besideView.horizon.length === 72, "the sweep must return one horizon sample per ray");
check(besideView.sectors.length === 8, "the sweep must summarise eight compass sectors");
check(besideView.evidence_class === "DERIVED", "a computed viewshed is DERIVED");

// Monotonicity: a finer sweep must not change the answer much, or the sampling is too coarse.
const coarseSweep = viewshed({index, from: [7, 2, -6], rays: 36});
const fineSweep = viewshed({index, from: [7, 2, -6], rays: 144});
near(coarseSweep.open_sky_fraction, fineSweep.open_sky_fraction, 0.05,
  "a 36-ray sweep must agree with a 144-ray sweep to within 5 % of sky");

let rejectedSweeps = 0;
for (const bad of [{rays: 4}, {rays: 12.5}, {minElevationDeg: 70, maxElevationDeg: 60}]) {
  try { viewshed({index, from: [0, 10, 0], ...bad}); } catch { rejectedSweeps += 1; }
}
check(rejectedSweeps === 3, `viewshed must reject all 3 malformed sweeps, rejected ${rejectedSweeps}`);

index.dispose();
console.log(`${checks - failures}/${checks} study checks passed`);
if (failures) { console.error(`twin-engine studies gate FAILED with ${failures} failure(s)`); process.exit(1); }
console.log("twin-engine studies gate PASSED");
