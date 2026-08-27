/**
 * twin-engine mutation gate.
 *
 * A validator that only ever sees good input proves nothing. This deliberately breaks the
 * conformance fixture in ways a real scene could plausibly break, and fails if the contract
 * lets any of them through. Per AGENTS.md §2, a mutation that survives is a gate failure.
 *
 *   node scripts/test-twin-engine.mjs
 */
import {buildConformanceScene} from "./build-twin-engine-conformance-scene.mjs";
import {parseScene, SceneContractError} from "../engine/core/scene-contract.mjs";
import {compileStages, createStageMachine} from "../engine/core/stages.mjs";
import {solarPosition} from "../engine/studies/sun.mjs";
import {deriveMapView, wgs84ToLocal} from "../engine/geo/local-enu.mjs";

const clone = () => JSON.parse(JSON.stringify(buildConformanceScene()));

const MUTATIONS = [
  ["unknown geometry primitive", scene => { scene.elements[0].geometry.primitive = "NURBS_SURFACE"; }],
  ["invented evidence class", scene => { scene.elements[0].evidence_class = "PROBABLY_FINE"; }],
  ["element with no source", scene => { scene.elements[1].source_refs = []; }],
  ["duplicate element id", scene => { scene.elements[1].id = scene.elements[0].id; }],
  ["terrain vertex count contradicts segments", scene => { scene.elements[0].geometry.vertices.pop(); }],
  ["polygon collapsed to two points", scene => { scene.elements[1].geometry.points_xz = [[0, 0], [1, 1]]; }],
  ["ribbon with a single point", scene => { scene.elements[2].geometry.points = [[0, 0, 0]]; }],
  ["ribbon with zero width", scene => { scene.elements[2].geometry.width_m = 0; }],
  ["box with a negative dimension", scene => { scene.elements[3].geometry.size = [9, -5, 7]; }],
  ["non-finite position", scene => { scene.elements[3].geometry.position = [0, Number.NaN, 0]; }],
  ["stage showing a type no element has", scene => { scene.navigation[0].visible_groups.push("PHANTOM_LAYER"); }],
  ["stage with no visible groups", scene => { scene.navigation[1].visible_groups = []; }],
  ["stage camera sitting on its target", scene => { scene.navigation[1].camera = [...scene.navigation[1].target]; }],
  ["stage opening an element that does not exist", scene => { scene.navigation[3].on_enter_open_element = "ROOM_THAT_NEVER_WAS"; }],
  ["duplicate stage id", scene => { scene.navigation[1].id = scene.navigation[0].id; }],
  ["default stage pointing nowhere", scene => { scene.presentation.default_stage = "NOWHERE"; }],
  ["unknown presentation profile", scene => { scene.presentation.profiles.push("PHOTOREAL"); }],
  ["coordinate frame swapped for a projected grid", scene => { scene.coordinate_system.frame = "EPSG:3006"; }],
  ["axes relabelled so up is not up", scene => { scene.coordinate_system.axes.y = "NORTH"; }],
  ["units changed to feet", scene => { scene.coordinate_system.linear_units = "foot"; }],
  ["origin stripped", scene => { delete scene.coordinate_system.origin_wgs84; }],
  ["source bindings emptied", scene => { scene.source_bindings = []; }],
  ["legal claim policy removed", scene => { delete scene.legal_claim_policy; }],
  ["no elements at all", scene => { scene.elements = []; }],
  ["no stages at all", scene => { scene.navigation = []; }],
  ["solar arc dated with a season instead of a date", scene => {
    const arc = scene.elements.find(e => e.geometry.primitive === "SOLAR_ARC");
    arc.geometry.study_date = "summer";
  }],
  ["solar arc placed off the globe", scene => {
    const arc = scene.elements.find(e => e.geometry.primitive === "SOLAR_ARC");
    arc.geometry.latitude_deg = 118;
  }]
];

let failures = 0;

// The unmutated fixture must pass, or every mutation below proves nothing.
try {
  parseScene(clone());
  console.log("baseline  conformance fixture parses");
} catch (error) {
  failures += 1;
  console.error(`FAIL  baseline fixture must parse — ${error.message}`);
}

for (const [name, mutate] of MUTATIONS) {
  const scene = clone();
  mutate(scene);
  let caught = null;
  try {
    parseScene(scene);
  } catch (error) {
    caught = error;
  }
  if (!caught) {
    failures += 1;
    console.error(`FAIL  mutation survived: ${name}`);
  } else if (!(caught instanceof SceneContractError)) {
    failures += 1;
    console.error(`FAIL  mutation "${name}" threw ${caught.name}, not a SceneContractError — the contract must reject it deliberately`);
  }
}

// Runtime guards outside the scene document.
const guards = [
  ["stage index out of range", () => {
    const stages = compileStages(parseScene(clone()));
    createStageMachine({stages}).goTo(99);
  }],
  ["stage machine with no stages", () => createStageMachine({stages: []})],
  ["unknown stage id", () => {
    const stages = compileStages(parseScene(clone()));
    createStageMachine({stages}).goToId("NOT_A_STAGE");
  }],
  ["solar position with a nonsense date", () => solarPosition({latitude: 0, longitude: 0, date: "2026/06/21", utcHour: 12})],
  ["solar position off the globe", () => solarPosition({latitude: 118, longitude: 0, date: "2026-06-21", utcHour: 12})],
  ["map view from a degenerate camera", () => deriveMapView({originWgs84: [0, 0], camera: [1, 2, 3], target: [1, 2, 3], zoom: 15})],
  ["longitude beyond the meridian", () => wgs84ToLocal({originWgs84: [0, 0], lonLat: [999, 0]})]
];

for (const [name, run] of guards) {
  let threw = false;
  try {
    run();
  } catch {
    threw = true;
  }
  if (!threw) {
    failures += 1;
    console.error(`FAIL  runtime guard did not fire: ${name}`);
  }
}

const total = MUTATIONS.length + guards.length + 1;
console.log(`${total - failures}/${total} mutation checks passed (${MUTATIONS.length} scene mutations, ${guards.length} runtime guards)`);
if (failures) {
  console.error(`twin-engine mutation gate FAILED with ${failures} failure(s)`);
  process.exit(1);
}
console.log("twin-engine mutation gate PASSED");
