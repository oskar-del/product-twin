/**
 * twin-engine v0.1 deterministic gate.
 *
 * Exercises every pure module against the committed conformance fixture, and — when a real
 * scene is available in the working tree or staged under .runtime/ — cross-checks the engine
 * against production data it did not author. Exit code decides promotion; prose does not.
 *
 *   node scripts/validate-twin-engine.mjs
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

import {EVIDENCE_CLASSES, evidenceCss, evidenceHex, evidenceLegend, weakestEvidence} from "../engine/core/evidence.mjs";
import {parseScene, evidenceProfile, PRIMITIVES} from "../engine/core/scene-contract.mjs";
import {compileStages, createStageMachine, tweenPose, easeOutCubic} from "../engine/core/stages.mjs";
import {localToWgs84, wgs84ToLocal, deriveMapView} from "../engine/geo/local-enu.mjs";
import {solarPosition, solarDirection, sunLightRig, localHourToUtc} from "../engine/studies/sun.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = "data/scenes/twin-engine-conformance/scene-v0.1.json";
const SCHEMA = "config/spatial/twin-scene-v0.1.schema.json";

/** Scenes authored elsewhere that the engine must be able to read unmodified. */
const CROSS_CHECK_SCENES = [
  "data/sites/sweden/saterdalsvagen-14/neighbourhood-scene-v0.2.json",
  ".runtime/reference-data/svartinge-neighbourhood-scene-v0.2.json"
];

let failures = 0;
let checks = 0;
const skipped = [];

function check(condition, message) {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`FAIL  ${message}`);
  }
}

function near(actual, expected, tolerance, message) {
  check(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${message} — expected ${expected} ±${tolerance}, got ${actual}`);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

// ── evidence palette ────────────────────────────────────────────────────────────────────────
check(EVIDENCE_CLASSES.length === 5, "there must be exactly five evidence classes");
check(evidenceCss("AUTHORITATIVE") === "#176b52", "AUTHORITATIVE colour drifted from the published palette");
check(evidenceHex("DERIVED") === 0x497aa2, "DERIVED hex drifted from the published palette");
check(evidenceLegend().length === 5 && evidenceLegend().every(row => row.description.length > 10), "legend rows must all carry a description");
check(weakestEvidence(["AUTHORITATIVE", "CONCEPT", "DERIVED"]) === "CONCEPT", "weakestEvidence must return the softest class present");
check(new Set(EVIDENCE_CLASSES.map(evidenceCss)).size === 5, "evidence colours must be distinguishable from each other");

// ── scene contract, against the fixture ─────────────────────────────────────────────────────
const ajv = new Ajv2020({strict: false, allErrors: true});
ajv.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T/);
ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);
const validateSchema = ajv.compile(readJson(SCHEMA));

const fixtureDocument = readJson(FIXTURE);
check(validateSchema(fixtureDocument), `conformance fixture violates ${SCHEMA}: ${ajv.errorsText(validateSchema.errors)}`);

const fixture = parseScene(fixtureDocument);
const fixturePrimitives = new Set(fixture.elements.map(element => element.geometry.primitive));
check(fixturePrimitives.size === PRIMITIVES.length, `fixture must exercise all ${PRIMITIVES.length} primitives, exercises ${fixturePrimitives.size}`);
const profile = evidenceProfile(fixture);
check(EVIDENCE_CLASSES.every(name => profile[name] > 0), "fixture must exercise every evidence class");
check(fixture.elements.every(element => element.source_refs.length > 0), "every fixture element must be sourced");
check(fixture.elements.every(element => element.limitations.length > 0), "every fixture element must state its limitations");
check(fixture.presentation.default_stage === "SITE", "fixture default stage must resolve");

// ── stages ──────────────────────────────────────────────────────────────────────────────────
const stages = compileStages(fixture);
check(stages.length === 4, `fixture must compile 4 stages, compiled ${stages.length}`);
check(stages.every(stage => stage.visibleElementIds.size > 0), "no stage may render an empty scene");
check(stages.some(stage => stage.cutaway), "fixture must exercise a cutaway stage");
check(stages.at(-1).openElementId === "ROOM_MAIN", "the ROOM stage must open its element on entry");
check(stages[0].visibleElementIds.size > stages.at(-1).visibleElementIds.size, "stages must narrow as they descend from site to room");
check(!stages[2].visibleElementIds.has("PLOT_FIXTURE"), "the BUILDING stage must not leak the plot outline into the building view");

near(easeOutCubic(0), 0, 0, "ease at t=0");
near(easeOutCubic(1), 1, 0, "ease at t=1");
check(easeOutCubic(-5) === 0 && easeOutCubic(5) === 1, "ease must clamp outside 0..1");

const machine = createStageMachine({stages, durationMs: 900});
machine.goToId("ROOM", {now: 0});
const start = machine.pose(0);
check(start.camera.every((value, index) => value === stages[0].camera[index]), "a transition must start at the previous stage camera");
const settled = machine.pose(900);
check(settled.done && settled.camera.every((value, index) => value === stages[3].camera[index]), "a transition must land exactly on the target camera");
check(!machine.transitioning, "a completed transition must clear itself");
const halfway = tweenPose(stages[0], stages[3], 0.5);
check(halfway.progress > 0.5, "ease-out must be ahead of linear at the midpoint");

// A loop that misses the entire tween window — backgrounded tab, paused rAF, one long frame —
// must still land the camera on the stage it was sent to.
const missed = createStageMachine({stages, durationMs: 900});
missed.goTo(3, {now: 0});
const late = missed.pose(60_000);
check(late.apply && late.done, "a pose read after the tween window must still ask to be applied");
check(late.camera.every((value, index) => value === stages[3].camera[index]), "a missed tween must land exactly on the target camera");
check(missed.pose(60_100).apply === false, "once applied, a settled pose must stop overriding the user's camera");
const instant = createStageMachine({stages, durationMs: 900});
instant.goTo(2, {instant: true});
check(instant.pose(0).apply === true, "an instant stage change must ask to be applied");

// ── local ENU geodesy ───────────────────────────────────────────────────────────────────────
const origin = [16.0317063331, 58.6522414431];
const roundTrip = wgs84ToLocal({originWgs84: origin, lonLat: localToWgs84({originWgs84: origin, eastNorthM: [123.4, -56.7]})});
near(roundTrip[0], 123.4, 1e-6, "ENU east round-trip");
near(roundTrip[1], -56.7, 1e-6, "ENU north round-trip");
const dueNorth = deriveMapView({originWgs84: origin, camera: [0, 10, -10], target: [0, 0, 0], zoom: 15});
near(dueNorth.bearing, 0, 1e-3, "a camera due south of its target looks due north");
near(dueNorth.pitch, 45, 1e-3, "equal horizontal and vertical offset is a 45° pitch");
check(dueNorth.evidence_effect === "NONE", "a live map view must never carry evidence effect");

// ── solar study ─────────────────────────────────────────────────────────────────────────────
// Midsummer solar noon altitude must equal 90 - latitude + declination, by definition.
let peak = {altitude_deg: -90, utcHour: null};
for (let minute = 0; minute < 24 * 60; minute += 1) {
  const utcHour = minute / 60;
  const position = solarPosition({latitude: origin[1], longitude: origin[0], date: "2026-06-21", utcHour});
  if (position.altitude_deg > peak.altitude_deg) peak = {...position, utcHour};
}
near(peak.altitude_deg, 90 - origin[1] + peak.declination_deg, 0.01, "midsummer noon altitude must match the geometric identity");
near(peak.azimuth_deg, 180, 0.5, "solar noon in the northern hemisphere is due south");
near(peak.utcHour, 12 - origin[0] / 15, 0.1, "solar noon must fall at the longitude's local noon");
near(solarPosition({latitude: origin[1], longitude: origin[0], date: "2026-12-21", utcHour: 11}).altitude_deg, 7.91, 0.2, "winter solstice noon altitude");
check(solarPosition({latitude: origin[1], longitude: origin[0], date: "2026-12-21", utcHour: 1}).above_horizon === false, "the sun must be below the horizon at 01:00 in December at 58°N");
check(sunLightRig({latitude: origin[1], longitude: origin[0], date: "2026-12-21", utcHour: 1}) === null, "no light rig may be produced below the horizon");
const direction = solarDirection({latitude: origin[1], longitude: origin[0], date: "2026-06-21", utcHour: peak.utcHour});
near(Math.hypot(...direction), 1, 1e-9, "solar direction must be a unit vector");
check(direction[1] > 0, "the sun must be above the horizon at solar noon");
const offset = localHourToUtc({hour: 13, longitude: origin[0]});
check(offset.offset_source === "DERIVED_FROM_LONGITUDE" && offset.utc_offset_hours === 1, "an undeclared UTC offset must be derived from longitude and disclosed");
check(localHourToUtc({hour: 13, utcOffsetHours: 2, longitude: origin[0]}).offset_source === "SCENE_DECLARED", "a scene-declared offset must win over the derived one");

// ── scene graph invariants (built headless: no canvas textures, no sprite labels) ───────────
// three.js constructs a scene graph fine without WebGL, so the structural contract between
// elements and objects is gateable. This is what catches an element rendering as two objects
// where only one of them answers to the element's visibility.
const {createSceneBuilder} = await import("../engine/geometry/primitives.mjs");
const {createMaterialFactory} = await import("../engine/core/profiles.mjs");
const headless = createSceneBuilder({materials: createMaterialFactory({}), textures: null, labels: false});
const built = headless.build(fixture);

check(built.byId.size === fixture.elements.length, `every element must map to exactly one object — ${built.byId.size} objects for ${fixture.elements.length} elements`);
for (const element of fixture.elements) {
  const object = built.byId.get(element.id);
  check(Boolean(object), `element ${element.id} produced no object`);
}
check(built.clickable.length >= fixture.elements.length, "every element must contribute at least one pickable object");

// Every pickable object must sit UNDER the object registered for its element, or hiding the
// element leaves part of it on screen — a roof over a building that is no longer there.
const orphans = built.clickable.filter(object => {
  const owner = built.byId.get(object.userData.element.id);
  if (!owner) return true;
  for (let node = object; node; node = node.parent) if (node === owner) return false;
  return true;
});
check(orphans.length === 0, `${orphans.length} pickable object(s) are not descendants of their element's object: ${orphans.map(o => o.userData.element.id).join(", ")}`);
check(built.terrain !== null, "the fixture's GRID_SURFACE must register as the terrain mesh");
const solarGroup = built.byId.get("SOLAR_PATH");
check((solarGroup?.userData.solarMarks?.length ?? 0) > 0, "SOLAR_ARC must produce hour marks rather than being silently dropped");

// ── cross-check against a scene the engine did not author ───────────────────────────────────
const crossCheckPath = CROSS_CHECK_SCENES.find(candidate => fs.existsSync(path.join(root, candidate)));
if (!crossCheckPath) {
  skipped.push(`real-scene cross-check — none of ${CROSS_CHECK_SCENES.join(", ")} is present in this checkout`);
} else {
  const realDocument = readJson(crossCheckPath);
  check(validateSchema(realDocument), `${crossCheckPath} does not satisfy the generic twin-scene contract: ${ajv.errorsText(validateSchema.errors)}`);
  const real = parseScene(realDocument);
  const realStages = compileStages(real);
  check(realStages.every(stage => stage.visibleElementIds.size > 0), `${crossCheckPath}: every stage must render something`);
  const withLiveView = real.stages.filter(stage => stage.live_context_view);
  if (!withLiveView.length) skipped.push(`${crossCheckPath} declares no live_context_view to reproduce`);
  for (const stage of withLiveView) {
    const derived = deriveMapView({
      originWgs84: real.origin_wgs84,
      camera: stage.camera,
      target: stage.target,
      zoom: stage.live_context_view.zoom
    });
    // Bearing and pitch are pure local geometry: they must reproduce the stored values exactly.
    near(derived.bearing, stage.live_context_view.bearing, 1e-3, `${stage.id}: engine bearing must reproduce the scene's stored value`);
    near(derived.pitch, stage.live_context_view.pitch, 1e-3, `${stage.id}: engine pitch must reproduce the scene's stored value`);

    // Map CENTRE must differ, and by a precisely predictable amount. This scene's stored centres
    // were derived with flat equator constants (110540 m/deg latitude, 111320·cos φ m/deg
    // longitude); the engine uses the latitude-corrected WGS84 series. So rather than allowing a
    // vague band, PREDICT the difference from the two models and require the observed difference
    // to match it. Anything else is a projection bug wearing a model upgrade as a disguise.
    const storedCentre = stage.live_context_view.center_wgs84;
    const phi = real.origin_wgs84[1] * Math.PI / 180;
    const newLat = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi) - 0.0023 * Math.cos(6 * phi);
    const newLon = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi) + 0.118 * Math.cos(5 * phi);
    const predictedNorthM = stage.target[2] * (1 - newLat / 110540);
    const predictedEastM = stage.target[0] * (1 - newLon / (111320 * Math.cos(phi)));
    const predictedM = Math.hypot(predictedEastM, predictedNorthM);

    const observedNorthM = (derived.center_wgs84[1] - storedCentre[1]) * newLat;
    const observedEastM = (derived.center_wgs84[0] - storedCentre[0]) * newLon;
    const observedM = Math.hypot(observedEastM, observedNorthM);

    near(observedM, predictedM, 0.02,
      `${stage.id}: map-centre difference from the stored value must be exactly the geodesy-model correction (m)`);
  }
  console.log(`cross-checked against ${crossCheckPath} (${real.elements.length} elements, ${real.stages.length} stages, ${withLiveView.length} live views reproduced)`);
}

// ── report ──────────────────────────────────────────────────────────────────────────────────
for (const note of skipped) console.log(`SKIPPED  ${note}`);
console.log(`${checks - failures}/${checks} checks passed`);
if (failures) {
  console.error(`twin-engine gate FAILED with ${failures} failure(s)`);
  process.exit(1);
}
console.log("twin-engine gate PASSED");
