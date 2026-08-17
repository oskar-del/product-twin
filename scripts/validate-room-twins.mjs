import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual, promisify } from "node:util";

import {
  ROOM_LAB_SCENE_VERSION,
  ROOM_TWIN_MANIFEST_VERSION,
  canonicalJson,
  exportRoomLabScene,
  validateRoomLabSceneV1,
  validateRoomTwin,
} from "./room-twin-manifest.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_ROOM_LAB_ROOT = path.resolve(REPO_ROOT, "../room-lab-site");

const PATHS = {
  marbella: "data/room-twins/marbella-living-room-v1.json",
  canopus: "data/room-twins/canopus-deluxe-guest-room-v1.json",
  marbellaExport: "data/room-twins/exports/marbella-living-room.room-scene.v1.json",
  canopusExport: "data/room-twins/exports/canopus-deluxe-guest-room.room-scene.v1.json",
  roomSchema: "config/room/room-twin-manifest-v1.schema.json",
  intentSchema: "config/room/spatial-intent-record-v1.schema.json",
  canopusSite: "data/sites/canopus/spatial/v0.2/site-twin-v0.2.json",
  canopusScenario: "data/sites/canopus/design-scenarios/la-concha-gardens-v0.1.json",
  canopusSpatialExport: "data/sites/canopus/spatial/v0.2/spatial-export-v0.2.json",
};

const ROOM_LAB_PATHS = {
  scene: "app/room/manifests/marbella-living-room.v1.json",
  furniture: "app/room/manifests/marbella-furniture.v1.json",
  commerce: "app/room/manifests/marbella-commerce-es-29660.v1.json",
  importer: "app/room/room-manifest.mjs",
};

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const execFileAsync = promisify(execFile);
const readJson = async (root, relativePath) => JSON.parse(await fs.readFile(path.join(root, relativePath), "utf8"));
const fileHash = async (root, relativePath) => sha256(await fs.readFile(path.join(root, relativePath)));

function makeAudit() {
  const errors = [];
  let assertions = 0;
  const check = (condition, message) => {
    assertions += 1;
    if (!condition) errors.push(message);
  };
  const addAssertions = (count) => { assertions += count; };
  return { errors, check, addAssertions, get assertions() { return assertions; } };
}

function findEvidence(manifest, evidenceId) {
  return manifest.evidence_records.find((record) => record.evidence_id === evidenceId);
}

function checkSchemaProfiles(roomSchema, intentSchema, audit) {
  audit.check(roomSchema.$schema === "https://json-schema.org/draft/2020-12/schema", "Room Twin schema must use JSON Schema 2020-12");
  audit.check(roomSchema.additionalProperties === false, "Room Twin schema must reject unknown top-level fields");
  audit.check(roomSchema.properties?.manifest_version?.const === ROOM_TWIN_MANIFEST_VERSION, "Room Twin schema version does not match the importer");
  audit.check(roomSchema.properties?.entity_type?.const === "RoomTwin", "Room Twin schema entity type is not fixed");
  audit.check(roomSchema.required?.includes("evidence_records"), "Room Twin schema must require evidence_records");
  audit.check(roomSchema.required?.includes("hard_gates"), "Room Twin schema must require hard_gates");
  audit.check(roomSchema.required?.includes("room_lab_compatibility"), "Room Twin schema must require Room Lab compatibility metadata");
  audit.check(intentSchema.$schema === "https://json-schema.org/draft/2020-12/schema", "Spatial intent schema must use JSON Schema 2020-12");
  audit.check(intentSchema.additionalProperties === false, "Spatial intent schema must reject unknown top-level fields");
  audit.check(intentSchema.$id?.endsWith("/spatial-intent-record-v1.schema.json"), "Spatial intent schema ID is not versioned");
}

function checkManifestProfile(manifest, expected, audit) {
  const validation = validateRoomTwin(manifest);
  audit.addAssertions(validation.assertions);
  for (const error of validation.errors) audit.errors.push(`${expected.label}: ${error}`);
  audit.check(manifest.room_state === expected.roomState, `${expected.label}: room state drifted`);
  audit.check(manifest.identity.room_id === expected.roomId, `${expected.label}: room ID drifted`);
  audit.check(manifest.room_lab_compatibility.scene_id === expected.sceneId, `${expected.label}: Room Lab scene ID drifted`);
  const { bounds } = manifest.spatial_geometry;
  const area = (bounds.maxX - bounds.minX) * (bounds.maxZ - bounds.minZ);
  audit.check(Math.abs(area - expected.areaM2) < 1e-9, `${expected.label}: expected ${expected.areaM2} m² room-local bounds, received ${area}`);
}

function checkCanopusBindings(canopus, siteTwin, scenario, audit) {
  audit.check(canopus.identity.project_id === siteTwin.project_id, "CANOPUS: Project ID does not match Site Twin");
  audit.check(canopus.identity.site_twin_id === siteTwin.site_twin_id, "CANOPUS: Site Twin ID does not match upstream source");
  audit.check(canopus.identity.design_scenario_id === scenario.scenario_id, "CANOPUS: Design Scenario ID does not match upstream source");
  audit.check(scenario.project_id === siteTwin.project_id && scenario.site_twin_id === siteTwin.site_twin_id, "CANOPUS: Design Scenario is not attached to the referenced Site Twin");

  const expectedGates = siteTwin.hard_gates.map(({ gate_id, status }) => ({ gate_id, status }));
  const exportedGates = canopus.hard_gates
    .filter((gate) => gate.scope === "UPSTREAM_SITE")
    .map(({ gate_id, status }) => ({ gate_id, status }));
  audit.check(isDeepStrictEqual(exportedGates, expectedGates), "CANOPUS: Room Twin does not preserve the exact current upstream hard-gate set and statuses");
  audit.check(exportedGates.filter((gate) => gate.status === "SATISFIED").length === 2, "CANOPUS: expected exactly two satisfied upstream site gates");
  audit.check(exportedGates.filter((gate) => gate.status === "OPEN").length === 9, "CANOPUS: expected exactly nine open upstream site gates");
  audit.check(siteTwin.access.permitted_access_point === null, "CANOPUS: upstream permitted access point must remain null");
  audit.check(siteTwin.planning.entitlement === null, "CANOPUS: upstream planning entitlement must remain null");
  audit.check(siteTwin.planning.buildable_envelope === null, "CANOPUS: upstream buildable envelope must remain null");
}

async function checkFileBindings(root, marbella, canopus, audit) {
  const siteRef = canopus.upstream_context.site_twin_ref;
  const scenarioRef = canopus.upstream_context.design_scenario_ref;
  audit.check(await fileHash(root, siteRef.path) === siteRef.sha256, "CANOPUS: Site Twin content hash mismatch");
  audit.check(await fileHash(root, scenarioRef.path) === scenarioRef.sha256, "CANOPUS: Design Scenario content hash mismatch");
  const siteFrameEvidence = findEvidence(canopus, "E_CANOPUS_SITE_FRAME_OFFICIAL");
  audit.check(await fileHash(root, PATHS.canopusSpatialExport) === siteFrameEvidence?.source.sha256, "CANOPUS: spatial-frame evidence hash mismatch");
  const briefEvidence = findEvidence(canopus, "E_CANOPUS_DELUXE_BRIEF_CONCEPT");
  audit.check(await fileHash(root, PATHS.canopusScenario) === briefEvidence?.source.sha256, "CANOPUS: concept-brief evidence hash mismatch");
  audit.check(marbella.upstream_context.site_twin_ref.path === null && marbella.upstream_context.site_twin_ref.sha256 === null, "Marbella: unknown Site Twin must not have a fabricated path or hash");
}

function checkExports(marbella, canopus, marbellaExport, canopusExport, audit) {
  const generatedMarbella = exportRoomLabScene(marbella);
  const generatedCanopus = exportRoomLabScene(canopus);
  for (const [label, generated, committed] of [
    ["Marbella", generatedMarbella, marbellaExport],
    ["CANOPUS", generatedCanopus, canopusExport],
  ]) {
    const sceneValidation = validateRoomLabSceneV1(generated);
    audit.addAssertions(sceneValidation.assertions);
    for (const error of sceneValidation.errors) audit.errors.push(`${label} Room Lab export: ${error}`);
    audit.check(generated.manifest_version === ROOM_LAB_SCENE_VERSION, `${label}: wrong Room Lab export version`);
    audit.check(canonicalJson(generated) === canonicalJson(committed), `${label}: deterministic export differs from its committed Room Lab scene`);
    audit.check(canonicalJson(exportRoomLabScene(label === "Marbella" ? marbella : canopus)) === canonicalJson(generated), `${label}: repeated Room Lab export is not deterministic`);
  }
  audit.check(generatedMarbella.scene.id !== generatedCanopus.scene.id, "Room Lab export profiles are not isolated by scene ID");
  audit.check(marbella.identity.room_id !== canopus.identity.room_id, "Room Twin profiles are not isolated by Room ID");
}

async function checkFrozenRoomLab(roomLabRoot, marbella, marbellaExport, canopusExport, audit) {
  const { stdout: roomLabHead } = await execFileAsync("git", ["-C", roomLabRoot, "rev-parse", "HEAD"]);
  const importerHash = await fileHash(roomLabRoot, ROOM_LAB_PATHS.importer);
  const sourceSceneHash = await fileHash(roomLabRoot, ROOM_LAB_PATHS.scene);
  audit.check(roomLabHead.trim() === marbella.room_lab_compatibility.source_commit, "Room Lab checkout is not at the frozen compatibility commit");
  audit.check(importerHash === marbella.room_lab_compatibility.source_importer_sha256, "Frozen Room Lab importer hash does not match the Room Twin binding");
  audit.check(sourceSceneHash === marbella.room_lab_compatibility.source_manifest_sha256, "Frozen Room Lab scene hash does not match the Room Twin binding");
  audit.check(canonicalJson(await readJson(roomLabRoot, ROOM_LAB_PATHS.scene)) === canonicalJson(marbellaExport), "Marbella Room Twin export does not exactly reproduce the frozen Room Lab scene");

  const importerUrl = `${pathToFileURL(path.join(roomLabRoot, ROOM_LAB_PATHS.importer)).href}?checkpoint=${importerHash}`;
  const { importRoomManifests } = await import(importerUrl);
  const furnitureManifest = await readJson(roomLabRoot, ROOM_LAB_PATHS.furniture);
  const commerceManifest = await readJson(roomLabRoot, ROOM_LAB_PATHS.commerce);
  const importedMarbella = importRoomManifests({ sceneManifest: marbellaExport, furnitureManifest, commerceManifest });
  const importedCanopus = importRoomManifests({ sceneManifest: canopusExport, furnitureManifest, commerceManifest });
  audit.check(importedMarbella.roomProfile.id === marbellaExport.scene.id, "Frozen Room Lab importer changed the Marbella profile ID");
  audit.check(isDeepStrictEqual(importedMarbella.roomProfile.bounds, marbellaExport.scene.bounds), "Frozen Room Lab importer changed the Marbella bounds");
  audit.check(importedCanopus.roomProfile.id === canopusExport.scene.id, "Frozen Room Lab importer rejected or changed the CANOPUS profile ID");
  audit.check(isDeepStrictEqual(importedCanopus.roomProfile.bounds, canopusExport.scene.bounds), "Frozen Room Lab importer changed the CANOPUS bounds");
  audit.check(importedMarbella.roomProfile.id !== importedCanopus.roomProfile.id, "Frozen Room Lab importer mixed the two room profiles");
}

export async function validateRoomTwinBundle({
  root = REPO_ROOT,
  roomLabRoot = null,
  requireRoomLab = false,
  overrides = {},
} = {}) {
  const audit = makeAudit();
  const loaded = {};
  for (const [key, relativePath] of Object.entries(PATHS)) loaded[key] = overrides[key] ?? await readJson(root, relativePath);
  const { marbella, canopus, marbellaExport, canopusExport, roomSchema, intentSchema, canopusSite, canopusScenario } = loaded;

  checkSchemaProfiles(roomSchema, intentSchema, audit);
  checkManifestProfile(marbella, {
    label: "Marbella",
    roomState: "ASSUMED_DESIGN_ROOM",
    roomId: "ROOM_MARBELLA_LIVING_ALPHA",
    sceneId: "marbella-living-room-v1",
    areaM2: 27.6,
  }, audit);
  checkManifestProfile(canopus, {
    label: "CANOPUS",
    roomState: "CONCEPT_DESIGN_ROOM",
    roomId: "ROOM_CANOPUS_DELUXE_GUEST_CONCEPT",
    sceneId: "canopus-deluxe-guest-room-concept-v1",
    areaM2: 48,
  }, audit);
  checkCanopusBindings(canopus, canopusSite, canopusScenario, audit);
  await checkFileBindings(root, marbella, canopus, audit);
  checkExports(marbella, canopus, marbellaExport, canopusExport, audit);

  if (roomLabRoot !== null) {
    try {
      await checkFrozenRoomLab(roomLabRoot, marbella, marbellaExport, canopusExport, audit);
    } catch (error) {
      audit.errors.push(`Frozen Room Lab compatibility check failed: ${error.message}`);
    }
  } else if (requireRoomLab) {
    audit.errors.push("Frozen Room Lab compatibility was required but no Room Lab root was supplied");
  }

  return {
    ok: audit.errors.length === 0,
    assertions: audit.assertions,
    errors: audit.errors,
    roomLabChecked: roomLabRoot !== null,
    gateSummary: {
      satisfied: canopus.hard_gates.filter((gate) => gate.scope === "UPSTREAM_SITE" && gate.status === "SATISFIED").length,
      open: canopus.hard_gates.filter((gate) => gate.scope === "UPSTREAM_SITE" && gate.status === "OPEN").length,
    },
  };
}

function parseArgs(argv) {
  let roomLabRoot = null;
  let requireRoomLab = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--room-lab-root") roomLabRoot = path.resolve(argv[++index]);
    else if (argv[index] === "--require-room-lab") requireRoomLab = true;
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (requireRoomLab && roomLabRoot === null) roomLabRoot = DEFAULT_ROOM_LAB_ROOT;
  return { roomLabRoot, requireRoomLab };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const options = parseArgs(process.argv.slice(2));
  const result = await validateRoomTwinBundle(options);
  if (!result.ok) {
    console.error(`ROOM TWIN CHECKPOINT: FAIL (${result.assertions} assertions)`);
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    const compatibility = result.roomLabChecked ? " · frozen Room Lab importer PASS" : "";
    console.log(`ROOM TWIN CHECKPOINT: PASS (${result.assertions} assertions${compatibility})`);
    console.log(`CANOPUS upstream hard gates: ${result.gateSummary.satisfied} SATISFIED · ${result.gateSummary.open} OPEN`);
  }
}
