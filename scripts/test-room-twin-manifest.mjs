import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalJson, exportRoomLabScene, validateRoomTwin } from "./room-twin-manifest.mjs";
import { validateRoomTwinBundle } from "./validate-room-twins.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const readJson = async (relativePath) => JSON.parse(await fs.readFile(path.join(ROOT, relativePath), "utf8"));
const clone = (value) => structuredClone(value);

const marbella = await readJson("data/room-twins/marbella-living-room-v1.json");
const canopus = await readJson("data/room-twins/canopus-deluxe-guest-room-v1.json");
const marbellaExport = await readJson("data/room-twins/exports/marbella-living-room.room-scene.v1.json");
const canopusExport = await readJson("data/room-twins/exports/canopus-deluxe-guest-room.room-scene.v1.json");

const baseline = await validateRoomTwinBundle();
if (!baseline.ok) throw new Error(`Valid Room Twin bundle failed:\n${baseline.errors.join("\n")}`);

const attacks = [];
const attack = (name, makeInvalid, expected = /./) => attacks.push({ name, makeInvalid, expected });

attack("hierarchy parent mutation", () => {
  const value = clone(marbella);
  value.coordinate_systems.building_local.parent_frame_id = "LEVEL";
  return validateRoomTwin(value);
}, /parent_frame_id/);

attack("transform populated while gate open", () => {
  const value = clone(canopus);
  value.coordinate_systems.room_local.transform = { translation_m: [0, 0, 0], yaw_rad: 0, scale: 1 };
  return validateRoomTwin(value);
}, /hard gate is not SATISFIED/);

attack("linear unit mutation", () => {
  const value = clone(marbella);
  value.coordinate_systems.linear_units = "cm";
  return validateRoomTwin(value);
}, /only metres/);

attack("missing evidence state", () => {
  const value = clone(marbella);
  delete value.evidence_records[0].state;
  return validateRoomTwin(value);
}, /state: required field is missing/);

attack("invalid evidence state", () => {
  const value = clone(canopus);
  value.evidence_records[0].state = "TRUST_ME";
  return validateRoomTwin(value);
}, /invalid evidence state/);

attack("invented geometry field", () => {
  const value = clone(canopus);
  value.spatial_geometry.fabricated_balcony = { width_m: 3 };
  return validateRoomTwin(value);
}, /unknown field/);

attack("null upstream gate violation", () => {
  const value = clone(canopus);
  value.upstream_context.buildable_envelope = { invented: true };
  return validateRoomTwin(value);
}, /must reference, not duplicate or invent/);

attack("invalid bounds ordering", () => {
  const value = clone(marbella);
  value.spatial_geometry.bounds.maxX = value.spatial_geometry.bounds.minX;
  return validateRoomTwin(value);
}, /invalid ordering/);

attack("opening references unknown surface", () => {
  const value = clone(marbella);
  value.spatial_geometry.openings[0].surface_id = "invented-wall";
  return validateRoomTwin(value);
}, /unknown surface/);

attack("opening exceeds surface span", () => {
  const value = clone(marbella);
  value.spatial_geometry.openings[0].width_m = 99;
  return validateRoomTwin(value);
}, /exceeds its surface span/);

attack("protected path outside bounds", () => {
  const value = clone(marbella);
  value.spatial_geometry.protected_paths[0].x = 50;
  return validateRoomTwin(value);
}, /outside room bounds/);

attack("assumed geometry presented as surveyed", () => {
  const value = clone(marbella);
  value.evidence_records[0].state = "SURVEYED";
  return validateRoomTwin(value);
}, /misrepresents ASSUMED_DESIGN_ROOM/);

attack("concept profile presented as surveyed room", () => {
  const value = clone(canopus);
  value.room_state = "SURVEYED_ROOM";
  return validateRoomTwin(value);
}, /misrepresents SURVEYED_ROOM/);

attack("room profile isolation mutation", async () => {
  const value = clone(canopus);
  value.room_lab_compatibility.scene_id = marbella.room_lab_compatibility.scene_id;
  return validateRoomTwinBundle({ overrides: { canopus: value } });
}, /profiles are not isolated|deterministic export differs/);

attack("unknown top-level field", () => {
  const value = clone(marbella);
  value.approval = "SURVEYED";
  return validateRoomTwin(value);
}, /unknown field/);

attack("schema version mutation", () => {
  const value = clone(canopus);
  value.manifest_version = "room-twin/v999";
  return validateRoomTwin(value);
}, /unsupported/);

attack("CANOPUS hard-gate status drift", async () => {
  const value = clone(canopus);
  const gate = value.hard_gates.find((item) => item.gate_id === "GATE_CERTIFICADO_URBANISTICO");
  gate.status = "SATISFIED";
  gate.blocker = null;
  return validateRoomTwinBundle({ overrides: { canopus: value } });
}, /exact current upstream hard-gate set/);

attack("upstream content-hash mutation", async () => {
  const value = clone(canopus);
  value.upstream_context.site_twin_ref.sha256 = "0".repeat(64);
  return validateRoomTwinBundle({ overrides: { canopus: value } });
}, /content hash mismatch/);

let passed = 0;
for (const { name, makeInvalid, expected } of attacks) {
  const result = await makeInvalid();
  if (result.ok) throw new Error(`Mutation unexpectedly passed: ${name}`);
  const messages = result.errors.join("\n");
  if (!expected.test(messages)) throw new Error(`Mutation failed for the wrong reason: ${name}\n${messages}`);
  passed += 1;
}

const generatedMarbellaA = exportRoomLabScene(marbella);
const generatedMarbellaB = exportRoomLabScene(clone(marbella));
const generatedCanopusA = exportRoomLabScene(canopus);
const generatedCanopusB = exportRoomLabScene(clone(canopus));
if (canonicalJson(generatedMarbellaA) !== canonicalJson(generatedMarbellaB)) throw new Error("Marbella export is not deterministic across clean objects");
if (canonicalJson(generatedCanopusA) !== canonicalJson(generatedCanopusB)) throw new Error("CANOPUS export is not deterministic across clean objects");
if (canonicalJson(generatedMarbellaA) !== canonicalJson(marbellaExport)) throw new Error("Marbella deterministic export does not match the committed Room Lab scene");
if (canonicalJson(generatedCanopusA) !== canonicalJson(canopusExport)) throw new Error("CANOPUS deterministic export does not match the committed Room Lab scene");

console.log(`ROOM TWIN MUTATIONS: PASS (${passed}/${attacks.length} attacks rejected)`);
console.log("Deterministic Room Lab exports: PASS (2/2 profiles, two clean runs each)");
