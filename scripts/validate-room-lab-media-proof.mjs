#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { evaluateRoomLabOrientationEvidence } from "./build-room-lab-orientation-evidence.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const MEDIA_DIR = "data/media/room-lab/v0.1";
const SCENE_ID = "SCENE_ROOM_LAB_MARBELLA_LIVING_V0_1";
const SOURCE_COMMIT = "3d36f07c32e42b168a74c5bc03a263e8c63e6eab";
const RIGHTS_ID = "RIGHTS_ROOM_LAB_G2_V0_1";

const SOURCE_HASHES = new Map([
  ["app/room/room-contract.ts", "21f06ca70a098797cb174c8c73459442bc3074bf070a6c387bb136c727c3a821"],
  ["app/room/room-data.ts", "fcc9763789a2cab4f5fd9ba020e55436fe10be9d449997f1936f9b2d4015f204"],
  ["app/room/room-lab.tsx", "65a85a7ce53867fbdf9e08558d8c7775a5e2fb8b4e7b9a79eaee5d1a08b66c9e"],
  ["app/room/room-state.mjs", "5e718883c64470c3c7988a88546b85993c84cab476d41d06c78064b1912c254e"]
]);

const EXPECTED_PLACEMENTS = new Map([
  ["kivik-placement-01", ["PT_IKEA_KIVIK_49440597", "AVATAR_IKEA_KIVIK_49440597_G2_SOFA_PROXY", "data/geometry/avatars/ikea-kivik-49440597-g2-sofa-proxy.glb", "a765cb6ddf0bd6b670c0b1add8e3d6a1546bffac23ba31736f850ce98e81d392", [0, 0, -1.78], Math.PI]],
  ["poang-placement-01", ["PT_IKEA_POANG_39240787", "AVATAR_IKEA_POANG_39240787_G2_ARMCHAIR_PROXY", "data/geometry/avatars/ikea-poang-39240787-g2-armchair-proxy.glb", "7d1e5659d9f34247aefe65399859d1f7adfc2ed000e1ade9a38a0498fd93cb85", [-1.88, 0, 0.05], -Math.PI / 2]],
  ["listerby-placement-01", ["PT_IKEA_LISTERBY_30513904", "AVATAR_IKEA_LISTERBY_30513904_G2_COFFEE_TABLE_PROXY", "data/geometry/avatars/ikea-listerby-30513904-g2-coffee-table-proxy.glb", "d5294a8b83d5173179a75f54f371346b26577fe54425dfbe0f9ab2264cc8d37f", [0, 0, -0.22], 0]],
  ["lohals-placement-01", ["PT_IKEA_LOHALS_30511288", "AVATAR_IKEA_LOHALS_30511288_G2_RUG_PROXY", "data/geometry/avatars/ikea-lohals-30511288-g2-rug-proxy.glb", "f3b28a885db303121e69ac0dd2d94089cb3d5f8791d58170852ea52ef916b572", [0, 0, -0.18], 0]],
  ["gladom-placement-01", ["PT_IKEA_GLADOM_70578451", "AVATAR_IKEA_GLADOM_70578451_G2_TRAY_TABLE_PROXY", "data/geometry/avatars/ikea-gladom-70578451-g2-tray-table-proxy.glb", "36e5c3da0c1b24147f0aa777373dff3ced49badde8c2295e061d99e565e6b4c9", [1.58, 0, -1.55], 0]],
  ["lauters-placement-01", ["PT_IKEA_LAUTERS_30405042", "AVATAR_IKEA_LAUTERS_30405042_G2_FLOOR_LAMP_PROXY", "data/geometry/avatars/ikea-lauters-30405042-g2-floor-lamp-proxy.glb", "b276fc15e90b0e380a335fe965253a486a2f40d08a6e0005433f99d05bb13f3e", [-1.72, 0, -1.55], 0.2]],
  ["besta-placement-01", ["PT_IKEA_BESTA_89330691", "AVATAR_IKEA_BESTA_89330691_G2_MEDIA_UNIT_PROXY", "data/geometry/avatars/ikea-besta-89330691-g2-media-unit-proxy.glb", "71081ab6bcd0238652cdaa7b9495b2ab29041f94c2caf856da2bfacd93f3582e", [0, 0, 2.05], 0]],
  ["billy-placement-01", ["PT_IKEA_BILLY_00263850", "AVATAR_IKEA_BILLY_00263850_G2_BOOKCASE_PROXY", "data/geometry/avatars/ikea-billy-00263850-g2-bookcase-proxy.glb", "04b826a4e1f534a9a415b31402b5c46ef44e35bf503f2ed099b541ac71f54258", [2.84, 0, 1.15], Math.PI / 2]]
]);

const REQUIRED_QA_ROLES = ["QA_FRONT", "QA_REAR", "QA_LEFT", "QA_RIGHT", "QA_TOP", "QA_LOW_EYE"];
const REQUIRED_QA_CHECK_IDS = ["PLACEMENT_IDENTITY", "TRANSFORM_RETENTION", "ASSET_HASH_RETENTION", "AVATAR_ORIENTATION", "SHELL_AND_OPENING_RETENTION", "MATERIAL_AND_CLAIM_RETENTION", "DISCLOSURE_AND_RIGHTS"];
const EXPECTED_ORIENTATION_CLASSES = new Map([
  ["PT_IKEA_KIVIK_49440597", ["LANDMARK_FRONT", "DIRECTIONAL_LANDMARK", null]],
  ["PT_IKEA_POANG_39240787", ["LANDMARK_FRONT", "DIRECTIONAL_LANDMARK", null]],
  ["PT_IKEA_LISTERBY_30513904", ["TWO_FOLD_SYMMETRY", "GEOMETRIC_C2", 1e-9]],
  ["PT_IKEA_LOHALS_30511288", ["TWO_FOLD_SYMMETRY", "SEMANTIC_ENVELOPE_C2", 0.01]],
  ["PT_IKEA_GLADOM_70578451", ["FOUR_FOLD_SYMMETRY", "NODE_TRANSFORM_C4", 1e-9]],
  ["PT_IKEA_LAUTERS_30405042", ["LANDMARK_FRONT", "DIRECTIONAL_LANDMARK", null]],
  ["PT_IKEA_BESTA_89330691", ["LANDMARK_FRONT", "DIRECTIONAL_LANDMARK", null]],
  ["PT_IKEA_BILLY_00263850", ["LANDMARK_FRONT", "DIRECTIONAL_LANDMARK", null]]
]);
const COMMERCE_KEYS = new Set(["article", "article_no", "sku", "gtin", "price", "stock", "offer", "offers", "supplier", "checkout", "product_twin_id", "twin_id"]);
const EXPECTED_MEDIA_ARTIFACTS = new Set([
  "scene-manifest.json", "camera-shots.json", "storyboard.json", "orientation-evidence.json", "rights-disclosure.json", "render-jobs.json", "generative-jobs.json", "output-assets.json", "fidelity-qa.json", "cost-records.json", "render-environment.json", "outputs/room-lab-stills-run.json", "outputs/room-lab-video-run.json"
].map((name) => `${MEDIA_DIR}/${name}`));

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function readJson(root, relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

export async function loadRoomLabMediaBundle(root = ROOT) {
  const names = ["scene-manifest", "camera-shots", "storyboard", "orientation-evidence", "rights-disclosure", "render-jobs", "generative-jobs", "output-assets", "fidelity-qa", "cost-records", "media-manifest"];
  const entries = await Promise.all(names.map(async (name) => [name.replaceAll("-", "_"), await readJson(root, `${MEDIA_DIR}/${name}.json`)]));
  const bundle = Object.fromEntries(entries);
  bundle.render_environment = await readJson(root, `${MEDIA_DIR}/render-environment.json`);
  bundle.stills_run = await readJson(root, `${MEDIA_DIR}/outputs/room-lab-stills-run.json`);
  bundle.video_run = await readJson(root, `${MEDIA_DIR}/outputs/room-lab-video-run.json`);
  return bundle;
}

function walk(value, visitor, keyPath = []) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, visitor, [...keyPath, index]));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    visitor(key, entry, [...keyPath, key]);
    walk(entry, visitor, [...keyPath, key]);
  }
}

function closeEnough(actual, expected, tolerance = 1e-9) {
  return typeof actual === "number" && Math.abs(actual - expected) <= tolerance;
}

function equalVector(actual, expected, tolerance = 1e-9) {
  return Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => closeEnough(value, expected[index], tolerance));
}

function normalizedActorId(value) {
  return typeof value === "string" ? value.trim() : null;
}

function findUnclosedObjectSchemas(schema, location = "#", findings = []) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return findings;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.includes("object") && schema.additionalProperties !== false) findings.push(location);
  for (const key of ["properties", "$defs", "patternProperties", "dependentSchemas"]) {
    for (const [name, child] of Object.entries(schema[key] ?? {})) findUnclosedObjectSchemas(child, `${location}/${key}/${name}`, findings);
  }
  for (const key of ["items", "contains", "if", "then", "else", "not"] ) findUnclosedObjectSchemas(schema[key], `${location}/${key}`, findings);
  for (const key of ["allOf", "anyOf", "oneOf", "prefixItems"]) {
    (schema[key] ?? []).forEach((child, index) => findUnclosedObjectSchemas(child, `${location}/${key}/${index}`, findings));
  }
  return findings;
}

function addSchemaErrors(assert, label, validator, value) {
  if (validator(value)) return;
  for (const error of validator.errors ?? []) {
    assert(false, `schema validation failed: ${label}${error.instancePath || "/"} ${error.message}`);
  }
}

async function validateContractSchemas(root, data, assert) {
  const schemaNames = ["scene-manifest", "camera-shot", "storyboard", "orientation-evidence", "render-job", "generative-job", "output-asset", "rights-disclosure", "fidelity-qa", "cost-record", "media-manifest"];
  const schemas = new Map();
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);
  ajv.addFormat("uri", /^[a-z][a-z0-9+.-]*:/i);
  for (const name of schemaNames) {
    const schema = await readJson(root, `config/media/${name}.schema.json`);
    schemas.set(name, schema);
    assert(schema.$schema === "https://json-schema.org/draft/2020-12/schema", `schema draft mismatch: ${name}`);
    assert(schema.additionalProperties === false, `top-level schema must be closed: ${name}`);
    for (const location of findUnclosedObjectSchemas(schema)) assert(false, `object schema must be recursively closed: ${name}${location}`);
    ajv.addSchema(schema);
  }

  const ids = Object.fromEntries([...schemas].map(([name, schema]) => [name, schema.$id]));
  const schemaVersion = { type: "string", pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$" };
  const wrapperSchemas = [
    {
      $id: "https://product-twin.local/schemas/media/camera-pack.schema.json",
      type: "object", additionalProperties: false,
      required: ["schema_version", "scene_id", "scene_sha256", "camera_convention", "shots"],
      properties: {
        schema_version: schemaVersion, scene_id: { type: "string" }, scene_sha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
        camera_convention: {
          type: "object", additionalProperties: false,
          required: ["world_units", "sensor_height_mm", "perspective_vertical_fov_deg", "derived_focal_length_mm", "level_verticals_preferred", "true_north_available"],
          properties: { world_units: { type: "string" }, sensor_height_mm: { type: "number" }, perspective_vertical_fov_deg: { type: "number" }, derived_focal_length_mm: { type: "number" }, level_verticals_preferred: { type: "boolean" }, true_north_available: { type: "boolean" } }
        },
        shots: { type: "array", minItems: 1, items: { $ref: ids["camera-shot"] } }
      }
    },
    {
      $id: "https://product-twin.local/schemas/media/render-job-pack.schema.json",
      type: "object", additionalProperties: false, required: ["schema_version", "jobs"],
      properties: { schema_version: schemaVersion, jobs: { type: "array", items: { $ref: ids["render-job"] } } }
    },
    {
      $id: "https://product-twin.local/schemas/media/generative-job-pack.schema.json",
      type: "object", additionalProperties: false, required: ["schema_version", "jobs"],
      properties: { schema_version: schemaVersion, jobs: { type: "array", items: { $ref: ids["generative-job"] } } }
    },
    {
      $id: "https://product-twin.local/schemas/media/output-asset-pack.schema.json",
      type: "object", additionalProperties: false, required: ["schema_version", "outputs"],
      properties: { schema_version: schemaVersion, outputs: { type: "array", items: { $ref: ids["output-asset"] } } }
    },
    {
      $id: "https://product-twin.local/schemas/media/cost-record-pack.schema.json",
      type: "object", additionalProperties: false, required: ["schema_version", "costs"],
      properties: { schema_version: schemaVersion, costs: { type: "array", items: { $ref: ids["cost-record"] } } }
    }
  ];
  for (const schema of wrapperSchemas) ajv.addSchema(schema);

  const validations = [
    ["scene-manifest", ids["scene-manifest"], data.scene_manifest],
    ["camera-pack", wrapperSchemas[0].$id, data.camera_shots],
    ["storyboard", ids.storyboard, data.storyboard],
    ["orientation-evidence", ids["orientation-evidence"], data.orientation_evidence],
    ["rights-disclosure", ids["rights-disclosure"], data.rights_disclosure],
    ["render-job-pack", wrapperSchemas[1].$id, data.render_jobs],
    ["generative-job-pack", wrapperSchemas[2].$id, data.generative_jobs],
    ["output-asset-pack", wrapperSchemas[3].$id, data.output_assets],
    ["fidelity-qa", ids["fidelity-qa"], data.fidelity_qa],
    ["cost-record-pack", wrapperSchemas[4].$id, data.cost_records],
    ["media-manifest", ids["media-manifest"], data.media_manifest]
  ];
  for (const [label, id, value] of validations) addSchemaErrors(assert, label, ajv.getSchema(id), value);
}

export async function validateRoomLabMediaProof({ root = ROOT, bundle = null, checkManifest = true } = {}) {
  const data = bundle ?? await loadRoomLabMediaBundle(root);
  const errors = [];
  const assert = (condition, message) => { if (!condition) errors.push(message); };
  const scene = data.scene_manifest;
  const cameras = data.camera_shots;
  const storyboard = data.storyboard;
  const orientationEvidence = data.orientation_evidence;
  const rights = data.rights_disclosure;
  const renderJobs = data.render_jobs.jobs;
  const generativeJobs = data.generative_jobs.jobs;
  const outputs = data.output_assets.outputs;
  const qa = data.fidelity_qa;
  const costs = data.cost_records.costs;
  const renderEnvironment = data.render_environment;
  const stillsRun = data.stills_run;
  const videoRun = data.video_run;

  assert(scene.scene_id === SCENE_ID, "scene id must remain immutable");
  assert(scene.source.commit === SOURCE_COMMIT, "Room Lab source commit mismatch");
  assert(scene.source.repository === "room-lab-site", "source repository mismatch");
  assert(scene.source.source_files.length === SOURCE_HASHES.size, "source file binding count mismatch");
  for (const [file, expectedHash] of SOURCE_HASHES) {
    const source = scene.source.source_files.find((entry) => entry.path === file);
    assert(source?.sha256 === expectedHash, `source hash mismatch: ${file}`);
  }

  assert(scene.coordinate_frame.units === "metres", "scene units must be metres");
  assert(scene.coordinate_frame.true_north === null, "true north must remain explicitly unknown");
  assert(closeEnough(scene.shell.width_m, 6) && closeEnough(scene.shell.depth_m, 4.6) && closeEnough(scene.shell.height_m, 2.8), "assumed room bounds must remain 6.0 x 4.6 x 2.8 m");
  assert(scene.shell.evidence_state === "ASSUMED_DEMO_NOT_SURVEYED", "room shell must remain disclosed as assumed, not surveyed");
  assert(Array.isArray(scene.shell.opening_claims) && scene.shell.opening_claims.length === 0, "authoritative opening claims must remain empty");
  assert(scene.shell.visual_overlays?.length === 1, "exactly one assumed garden-window overlay is required");
  assert(scene.shell.visual_overlays?.[0]?.source_wall_remains_intact === true, "garden window must remain a visual overlay on the intact source wall");
  assert(scene.shell.floor.material.colour_hex === "#cbb99c" && scene.shell.floor.material.roughness === 0.88 && scene.shell.floor.receive_shadow === true, "source floor material/shadow contract mismatch");
  assert(scene.shell.walls.find((wall) => wall.id === "WALL_WINDOW")?.material.colour_hex === "#eee9df", "window-wall material contract mismatch");
  assert(scene.shell.walls.find((wall) => wall.id === "WALL_LEFT")?.material.colour_hex === "#e4dfd4", "left-wall material contract mismatch");
  const windowOverlay = scene.shell.visual_overlays[0];
  assert(windowOverlay.material.colour_hex === "#a9c9c4" && windowOverlay.material.transmission === 0.55 && windowOverlay.material.opacity === 0.52, "garden-window glass material contract mismatch");
  assert(windowOverlay.frame_material.colour_hex === "#4c514d" && windowOverlay.frame_bars.length === 4, "garden-window frame contract mismatch");
  const sourceSun = scene.lighting.lights.find((light) => light.id === "SUN");
  assert(sourceSun?.shadow?.map_size_px?.[0] === 2048 && sourceSun?.shadow?.camera_bounds_m?.left === -6 && sourceSun?.shadow?.camera_bounds_m?.right === 6, "source shadow contract mismatch");
  assert(scene.rendering.source_engine.resolved_contract_version === "0.185.0" && scene.rendering.media_runner_pixel_ratio === 1, "render engine/pixel-ratio contract mismatch");
  assert(scene.rendering.loader_floor_contact_contract.apply_y_rotation_before_bounds === true && scene.rendering.loader_floor_contact_contract.recenter_xz_to_world_transform === true && scene.rendering.loader_floor_contact_contract.recompute_bounds_after_each_transform_stage === true, "loader transform/floor-contact contract mismatch");
  assert(scene.rendering.loader_floor_contact_contract.avatar_up_axis === "+Y" && scene.rendering.loader_floor_contact_contract.avatar_visual_front_axis === "-Z" && scene.rendering.loader_floor_contact_contract.rotation_semantics.includes("+Y"), "avatar orientation contract mismatch");
  const orientationGate = scene.rendering.loader_floor_contact_contract.orientation_gate_status;
  assert((orientationGate === "PASS") === (scene.rendering.loader_floor_contact_contract.orientation_evidence_state === "BOUND_G2_ORIENTATION_QA_VERIFIED"), "avatar orientation evidence/gate state mismatch");

  assert(scene.placements.length === 8, "scene must contain exactly eight placements");
  assert(scene.freeze.placement_count === 8, "freeze placement count must remain eight");
  assert(scene.placements.reduce((sum, placement) => sum + placement.quantity, 0) === 8, "scene must contain exactly eight instances");
  assert(new Set(scene.placements.map((placement) => placement.placement_id)).size === 8, "placement ids must be unique");
  assert(!scene.placements.some((placement) => placement.twin_ref?.includes("VALNAS")), "VALNAS substitution is forbidden");

  for (const placement of scene.placements) {
    const expected = EXPECTED_PLACEMENTS.get(placement.placement_id);
    assert(Boolean(expected), `unexpected placement: ${placement.placement_id}`);
    if (!expected) continue;
    const [twinRef, avatarId, assetPath, assetHash, translation, rotation] = expected;
    assert(placement.source_lane === "PRODUCT_TWIN", `source lane changed: ${placement.placement_id}`);
    assert(placement.twin_ref === twinRef, `product identity changed: ${placement.placement_id}`);
    assert(placement.design_asset_ref == null, `Product Twin placement contains a Design Asset ref: ${placement.placement_id}`);
    assert(placement.avatar.avatar_id === avatarId, `avatar identity changed: ${placement.placement_id}`);
    assert(placement.avatar.level === "G2", `avatar level must remain G2: ${placement.placement_id}`);
    assert(placement.avatar.asset_path === assetPath, `avatar path changed: ${placement.placement_id}`);
    assert(placement.avatar.sha256 === assetHash, `avatar hash binding changed: ${placement.placement_id}`);
    assert(equalVector(placement.transform.translation_m, translation), `transform drift: ${placement.placement_id}`);
    assert(closeEnough(placement.transform.rotation_y_rad, rotation), `rotation drift: ${placement.placement_id}`);
    assert(equalVector(placement.transform.scale, [1, 1, 1]), `scale drift: ${placement.placement_id}`);
    assert(placement.quantity === 1, `quantity changed: ${placement.placement_id}`);
    assert(placement.fidelity_class === "G2_PLANNING_PROXY", `fidelity overclaim: ${placement.placement_id}`);
    assert(placement.disclosure_ref === RIGHTS_ID, `disclosure binding changed: ${placement.placement_id}`);

    const assetBytes = await readFile(path.join(root, assetPath));
    assert(digest(assetBytes) === assetHash, `avatar file hash mismatch: ${placement.placement_id}`);
    const twin = await readJson(root, `data/twins/${twinRef}.json`);
    assert(twin.twin_id === twinRef, `canonical twin id mismatch: ${placement.placement_id}`);
    assert(twin.geometry?.level === "G2", `canonical twin is not G2: ${placement.placement_id}`);
    assert(twin.geometry?.avatar_id === avatarId && twin.geometry?.asset_path === assetPath, `canonical twin avatar binding mismatch: ${placement.placement_id}`);
    assert(twin.geometry?.rights?.exact_likeness_claimed === false, `canonical twin exact-likeness claim is forbidden: ${placement.placement_id}`);
    assert(twin.readiness?.render === "planning_preview_only", `canonical twin render readiness overclaimed: ${placement.placement_id}`);
    assert(twin.geometry?.scale_state?.startsWith("verified ") && twin.geometry?.placement?.origin === "floor_center", `canonical twin scale/origin evidence missing: ${placement.placement_id}`);
    const evidence = scene.twin_evidence.find((entry) => entry.twin_ref === twinRef);
    assert(Boolean(evidence), `twin evidence binding missing: ${placement.placement_id}`);
    if (evidence) {
      assert(evidence.twin_record_path === `data/twins/${twinRef}.json`, `twin evidence path mismatch: ${placement.placement_id}`);
      const twinBytes = await readFile(path.join(root, evidence.twin_record_path));
      assert(digest(twinBytes) === evidence.twin_record_sha256, `twin record digest mismatch: ${placement.placement_id}`);
      assert(evidence.qa_path === twin.geometry.qa_metric, `twin QA path mismatch: ${placement.placement_id}`);
      const qaBytes = await readFile(path.join(root, evidence.qa_path));
      assert(digest(qaBytes) === evidence.qa_sha256, `twin QA digest mismatch: ${placement.placement_id}`);
      const twinQa = JSON.parse(qaBytes.toString("utf8"));
      assert(twinQa.avatar_id === avatarId && twinQa.promotion_level === "G2" && twinQa.status.includes("PASS"), `twin QA evidence is not a G2 pass: ${placement.placement_id}`);
      assert(twinQa.asset_path === assetPath && twinQa.placement?.origin === "floor_center", `twin QA floor-contact binding mismatch: ${placement.placement_id}`);
      assert(typeof twinQa.relative_error_max === "number" && twinQa.relative_error_max <= 1e-9, `twin QA envelope tolerance exceeded: ${placement.placement_id}`);
    }
  }

  for (const placement of scene.placements.filter((entry) => entry.source_lane === "DESIGN_ASSET")) {
    walk(placement, (key, _value, keyPath) => assert(!COMMERCE_KEYS.has(key.toLowerCase()), `Design Asset commerce field forbidden: ${keyPath.join(".")}`));
    assert(typeof placement.design_asset_ref === "string" && placement.twin_ref == null, `Design Asset lane binding invalid: ${placement.placement_id}`);
  }

  assert(orientationEvidence.scene_id === SCENE_ID, "orientation evidence scene binding mismatch");
  const recomputedOrientation = await evaluateRoomLabOrientationEvidence(root);
  assert(orientationEvidence.method_version === recomputedOrientation.method_version, "orientation evaluator version mismatch");
  assert(orientationEvidence.builder_sha256 === recomputedOrientation.builder_sha256, "orientation evidence builder hash mismatch");
  assert(orientationEvidence.method === recomputedOrientation.method, "orientation evidence method mismatch");
  assert(JSON.stringify(orientationEvidence.records) === JSON.stringify(recomputedOrientation.records), "orientation evidence does not match recomputed GLB observations");
  assert(orientationEvidence.approval.executor_id === recomputedOrientation.approval.executor_id && orientationEvidence.approval.executor_id === normalizedActorId(orientationEvidence.approval.executor_id), "orientation evidence executor identity mismatch");
  assert(orientationEvidence.records.length === 8 && new Set(orientationEvidence.records.map((record) => record.twin_ref)).size === 8, "orientation evidence must cover eight unique twins");
  for (const placement of scene.placements) {
    const record = orientationEvidence.records.find((entry) => entry.twin_ref === placement.twin_ref);
    assert(Boolean(record), `orientation evidence missing: ${placement.placement_id}`);
    if (!record) continue;
    assert(record.avatar_id === placement.avatar.avatar_id && record.asset_path === placement.avatar.asset_path && record.asset_sha256 === placement.avatar.sha256, `orientation evidence asset binding mismatch: ${placement.placement_id}`);
    assert(record.glb_version === 2 && record.glb_generator === "Product Twin verified G2 builder" && record.up_axis === "+Y", `orientation up-axis/GLB version mismatch: ${placement.placement_id}`);
    assert(record.automated_result === "PASS" && record.landmark_checks.length >= 2 && record.landmark_checks.every((check) => check.pass === true), `orientation landmark evidence failed: ${placement.placement_id}`);
    assert(record.up_axis_checks.length === 2 && new Set(record.up_axis_checks.map((check) => check.check_id)).size === 2 && record.up_axis_checks.every((check) => check.pass === true), `orientation floor/height evidence failed: ${placement.placement_id}`);
    const floorCheck = record.up_axis_checks.find((check) => check.check_id === "FLOOR_ORIGIN_MIN_Y");
    const heightCheck = record.up_axis_checks.find((check) => check.check_id === "VERIFIED_HEIGHT");
    assert(closeEnough(record.bounds_m.min[1], 0, 1e-6) && closeEnough(floorCheck?.observed_m, 0, 1e-6), `orientation floor origin mismatch: ${placement.placement_id}`);
    assert(closeEnough(record.bounds_m.size[1], record.verified_height_m, 1e-6) && closeEnough(heightCheck?.observed_m, record.verified_height_m, 1e-6), `orientation verified height mismatch: ${placement.placement_id}`);
    const [expectedMode, expectedClass, expectedTolerance] = EXPECTED_ORIENTATION_CLASSES.get(record.twin_ref) ?? [];
    assert(record.orientation_mode === expectedMode && record.symmetry_class === expectedClass && record.symmetry_tolerance_m === expectedTolerance, `orientation mode/symmetry class mismatch: ${placement.placement_id}`);
    if (expectedTolerance == null) assert(record.symmetry_observed_max_residual_m == null, `directional orientation must not claim a symmetry residual: ${placement.placement_id}`);
    else assert(typeof record.symmetry_observed_max_residual_m === "number" && record.symmetry_observed_max_residual_m <= expectedTolerance, `orientation symmetry residual exceeds tolerance: ${placement.placement_id}`);
    if (record.orientation_mode === "LANDMARK_FRONT") assert(record.visual_front_axis === "-Z", `orientation front-axis mismatch: ${placement.placement_id}`);
    if (record.orientation_mode.includes("SYMMETRY")) assert(record.visual_front_axis === "NOT_APPLICABLE", `symmetric avatar must not claim a front axis: ${placement.placement_id}`);
  }
  if (orientationEvidence.approval.state === "APPROVED" || orientationEvidence.status === "VERIFIED") {
    assert(orientationEvidence.approval.state === "APPROVED" && orientationEvidence.status === "VERIFIED", "orientation evidence approval/status mismatch");
    const reviewerId = normalizedActorId(orientationEvidence.approval.reviewer_id);
    assert(reviewerId && reviewerId === orientationEvidence.approval.reviewer_id && reviewerId !== normalizedActorId(orientationEvidence.approval.executor_id), "orientation evidence requires an independent reviewer");
  }
  if (orientationGate === "PASS") assert(orientationEvidence.status === "VERIFIED" && orientationEvidence.approval.state === "APPROVED", "orientation render gate requires independently verified evidence");

  assert(cameras.scene_id === SCENE_ID, "camera pack scene binding mismatch");
  const sceneBytes = await readFile(path.join(root, MEDIA_DIR, "scene-manifest.json"));
  const cameraBytes = await readFile(path.join(root, MEDIA_DIR, "camera-shots.json"));
  const storyboardBytes = await readFile(path.join(root, MEDIA_DIR, "storyboard.json"));
  const sceneHash = digest(sceneBytes);
  const cameraHash = digest(cameraBytes);
  const storyboardHash = digest(storyboardBytes);
  assert(cameras.scene_sha256 === sceneHash, "camera pack scene digest mismatch");
  for (const role of REQUIRED_QA_ROLES) {
    assert(cameras.shots.filter((shot) => shot.role === role).length === 1, `camera role must occur exactly once: ${role}`);
  }
  assert(cameras.shots.filter((shot) => shot.role === "HERO").length === 1, "exactly one hero camera is required");
  assert(cameras.shots.filter((shot) => shot.role === "CAMERA_PATH").length === 1, "exactly one camera path is required");
  for (const shot of cameras.shots) {
    assert(shot.scene_id === SCENE_ID, `shot scene binding mismatch: ${shot.shot_id}`);
    assert(shot.scene_sha256 === sceneHash, `shot scene digest mismatch: ${shot.shot_id}`);
    assert(shot.continuity?.scene_mutation_allowed === false, `shot permits scene mutation: ${shot.shot_id}`);
    assert(shot.continuity?.camera_only_change === true, `shot is not camera-only: ${shot.shot_id}`);
    if (shot.projection === "PERSPECTIVE") {
      const expectedFocal = shot.camera.sensor_height_mm / (2 * Math.tan((shot.camera.vertical_fov_deg * Math.PI / 180) / 2));
      assert(closeEnough(shot.camera.focal_length_mm, expectedFocal, 0.02), `camera focal/FOV mismatch: ${shot.shot_id}`);
      assert(closeEnough(shot.camera.near_m, 0.02) && closeEnough(shot.camera.far_m, 100), `camera clipping range mismatch: ${shot.shot_id}`);
    }
  }

  const top = cameras.shots.find((shot) => shot.role === "QA_TOP");
  assert(top?.projection === "ORTHOGRAPHIC" && closeEnough(top.camera.orthographic_height_m, 5.2), "QA_TOP must be a 5.2 m orthographic view");
  const pathShot = cameras.shots.find((shot) => shot.role === "CAMERA_PATH");
  assert(pathShot.path.duration_s >= 15 && pathShot.path.duration_s <= 30, "camera path duration must be 15-30 seconds");
  assert(pathShot.path.duration_s === 20 && pathShot.path.frame_rate_fps === 24 && pathShot.path.frame_count === 480, "control path must be exactly 20 s / 24 fps / 480 frames");
  assert(pathShot.path.keyframes[0].frame === 0 && pathShot.path.keyframes.at(-1).frame === 479, "camera path must cover frames 0-479");
  assert(pathShot.path.keyframes.every((frame, index, frames) => index === 0 || frame.frame > frames[index - 1].frame), "camera path frames must be strictly increasing");
  assert(pathShot.path.keyframes.every((frame, index, frames) => index === 0 || frame.time_s > frames[index - 1].time_s), "camera path times must be strictly increasing");
  assert(pathShot.path.keyframes.every((frame) => closeEnough(frame.time_s, frame.frame / pathShot.path.frame_rate_fps, 1e-9)), "camera path time must equal frame / fps");
  assert(pathShot.continuity.object_motion_allowed === false, "camera path must forbid object motion");

  assert(storyboard.scene_id === SCENE_ID && storyboard.duration_s === 20 && storyboard.frame_rate_fps === 24 && storyboard.frame_count === 480, "storyboard timing mismatch");
  assert(storyboard.scene_sha256 === sceneHash && storyboard.camera_pack_sha256 === cameraHash, "storyboard input digest mismatch");
  assert(storyboard.edit_policy.cuts_allowed === false && storyboard.edit_policy.generative_insert_shots_allowed === false, "storyboard must remain a continuous direct-3D proof");
  assert(storyboard.animation_policy.placement_animation.length === 0 && storyboard.animation_policy.light_animation.length === 0 && storyboard.animation_policy.material_animation.length === 0, "storyboard contains forbidden scene animation");

  assert(rights.rights_id === RIGHTS_ID && rights.scene_id === SCENE_ID, "rights record binding mismatch");
  assert(rights.maximum_claim === "G2_PLANNING_PROXY", "rights record exceeds G2 maximum claim");
  assert(rights.render_scope.state === "YES" && rights.render_scope.exact_product_claim_allowed === false, "render scope must be planning-preview only");
  assert(rights.approval.reviewer_role_required === "VERIFICATION", "rights approval must require Verification");
  assert(rights.required_disclosure.length > 0, "required disclosure is missing");
  assert(rights.source_assets.reduce((sum, source) => sum + source.asset_count, 0) === 8, "rights source coverage must account for all eight assets");
  assert(rights.source_assets.some((source) => source.source_lane === "PRODUCT_TWIN" && source.asset_count === 8), "rights coverage must retain all eight Product Twins");
  const expectedRightsEvidence = new Set(scene.placements.map((placement) => `data/twins/${placement.twin_ref}.json`));
  const actualRightsEvidence = rights.source_assets.flatMap((source) => source.evidence_refs);
  assert(actualRightsEvidence.length === 8 && new Set(actualRightsEvidence).size === 8 && actualRightsEvidence.every((ref) => expectedRightsEvidence.has(ref)) && [...expectedRightsEvidence].every((ref) => actualRightsEvidence.includes(ref)), "rights evidence refs must match the exact eight frozen Product Twins");
  if (rights.approval.state === "APPROVED") {
    assert(typeof rights.approval.reviewer_id === "string" && rights.approval.reviewer_id.length > 0, "approved rights require an independent reviewer id");
    assert(rights.approval.reviewer_id !== rights.approval.executor_id, "rights reviewer must differ from executor");
  }
  if (rights.provider_processing.state === "YES") {
    assert(rights.approval.state === "APPROVED", "provider-processing YES requires approved rights");
    assert(rights.source_assets.every((source) => source.provider_processing === "YES" && source.derivative_creation === "YES"), "provider-processing YES requires every source to permit processing and derivatives");
  }

  const allJobs = [...renderJobs, ...generativeJobs];
  const jobById = new Map(allJobs.map((job) => [job.job_id, job]));
  const shotById = new Map(cameras.shots.map((shot) => [shot.shot_id, shot]));
  const outputById = new Map(outputs.map((output) => [output.output_asset_id, output]));
  const costById = new Map(costs.map((cost) => [cost.cost_id, cost]));
  assert(jobById.size === allJobs.length, "job ids must be unique");
  assert(shotById.size === cameras.shots.length, "shot ids must be unique");
  assert(outputById.size === outputs.length, "output ids must be unique");
  assert(costById.size === costs.length, "cost ids must be unique");

  const directJob = renderJobs.find((job) => job.job_id === "RENDER_ROOM_LAB_DIRECT3D_V0_1");
  const runnerBytes = Buffer.concat(await Promise.all([
    readFile(path.join(root, "scripts/render-room-lab-media.mjs")),
    readFile(path.join(root, "scripts/media/room-lab-renderer-browser.mjs"))
  ]));
  assert(directJob?.renderer.runner_version === "ROOM_LAB_MEDIA_RUNNER_V1" && directJob?.renderer.runner_sha256 === digest(runnerBytes), "render runner source hash mismatch");
  assert(renderEnvironment.runner_version === directJob?.renderer.runner_version && renderEnvironment.runner_sha256 === directJob?.renderer.runner_sha256, "render environment runner binding mismatch");
  assert(renderEnvironment.environment?.node?.version === "v22.14.0", "render environment Node version mismatch");
  assert(renderEnvironment.environment?.chrome?.version === "Google Chrome 151.0.7922.138" && renderEnvironment.environment?.chrome?.sha256 === "ee37661755341e9fc1babf9c20ec09d6a36e50aa8713ceb08082f8bbe2d8217d", "render environment Chrome binding mismatch");
  assert(renderEnvironment.environment?.three?.version === "0.185.0" && renderEnvironment.environment?.three?.module_sha256 === "bbf5ed13fe4373f5bd38b14ea8e62e9f157327da5638edc6d3863e08b167c9c7" && renderEnvironment.environment?.three?.core_sha256 === "78b2c4218834ca8670547ed2315bfc21a00ff4dc3403bbffc8c31493d31d14de" && renderEnvironment.environment?.three?.gltf_loader_sha256 === "97642d720f16cc9a0c9844934198e4d0c023bea8e89576d0f7545d03b2d103d2", "render environment Three binding mismatch");
  assert(renderEnvironment.environment?.ffmpeg?.version_prefix === "ffmpeg version 8.1.2" && renderEnvironment.environment?.ffmpeg?.sha256 === "882dc3dcaabd4262465def19f4eb0a2968f23ab9bbaeb8f2566a61c603e4ed43" && renderEnvironment.environment?.ffprobe?.version_prefix === "ffprobe version 8.1.2" && renderEnvironment.environment?.ffprobe?.sha256 === "1f87f6c4bf4f48b25000a1e0a0eb70dca93d17d3d6628749c69cff481d13cc78", "render environment media-tool binding mismatch");
  assert(JSON.stringify(stillsRun.environment) === JSON.stringify(renderEnvironment.environment) && JSON.stringify(videoRun.environment) === JSON.stringify(renderEnvironment.environment), "run evidence environment mismatch");
  assert(stillsRun.runner_version === directJob?.renderer.runner_version && stillsRun.runner_sha256 === directJob?.renderer.runner_sha256, "stills run runner binding mismatch");
  assert(stillsRun.deterministic_duplicate_pass === true, "stills duplicate-render evidence failed");
  assert(stillsRun.network_policy === "LOOPBACK_ONLY" && stillsRun.cost_usd === 0, "stills run network/cost evidence mismatch");
  const directStillOutputs = outputs.filter((output) => output.job_id === directJob?.job_id && output.media_type === "image/png");
  assert(stillsRun.outputs.length === 7 && new Set(stillsRun.outputs.map((output) => output.output_asset_id)).size === 7, "stills run must cover seven unique outputs");
  for (const runOutput of stillsRun.outputs) {
    const output = outputById.get(runOutput.output_asset_id);
    const shot = shotById.get(runOutput.shot_id);
    assert(directStillOutputs.includes(output), `stills run references a non-still output: ${runOutput.output_asset_id}`);
    assert(runOutput.shot_id === output?.shot_id && runOutput.role === shot?.role && runOutput.uri === output?.uri && runOutput.sha256 === output?.sha256 && runOutput.bytes === output?.bytes && JSON.stringify(runOutput.dimensions_px) === JSON.stringify(output?.dimensions_px), `stills run output binding mismatch: ${runOutput.output_asset_id}`);
    assert(runOutput.duplicate_render_sha256 === runOutput.sha256 && /^[a-f0-9]{64}$/.test(runOutput.rgba_sha256), `stills duplicate/pixel hash mismatch: ${runOutput.output_asset_id}`);
    const audit = runOutput.audit;
    assert(audit?.pass === true && audit.failures?.length === 0 && audit.placement_count === 8 && audit.unique_twin_count === 8, `stills placement audit failed: ${runOutput.output_asset_id}`);
    assert(equalVector(audit?.shell_dimensions_m, [6, 4.6, 2.8]) && audit.authoritative_opening_count === 0 && audit.assumed_overlay_count === 1, `stills shell/opening audit failed: ${runOutput.output_asset_id}`);
    assert(JSON.stringify(Object.keys(audit?.mutation_counts ?? {}).sort()) === JSON.stringify(["geometry", "light", "material", "placement"]) && Object.values(audit.mutation_counts).every((count) => count === 0), `stills mutation audit failed: ${runOutput.output_asset_id}`);
    assert(audit?.placements?.length === 8 && new Set(audit.placements.map((placement) => placement.placement_id)).size === 8, `stills placement evidence coverage failed: ${runOutput.output_asset_id}`);
    for (const auditPlacement of audit?.placements ?? []) {
      const placement = scene.placements.find((entry) => entry.placement_id === auditPlacement.placement_id);
      assert(auditPlacement.twin_ref === placement?.twin_ref && auditPlacement.geometry_and_material_unchanged === true, `stills identity/material audit mismatch: ${auditPlacement.placement_id}`);
      assert(equalVector(auditPlacement.expected_translation_m, placement?.transform.translation_m ?? []) && equalVector(auditPlacement.bounds_centre_xz_m, [placement?.transform.translation_m[0], placement?.transform.translation_m[2]]) && closeEnough(auditPlacement.bounds_min_y_m, placement?.transform.translation_m[1]) && closeEnough(auditPlacement.rotation_y_rad, placement?.transform.rotation_y_rad), `stills transform audit mismatch: ${auditPlacement.placement_id}`);
    }
  }
  assert(directStillOutputs.every((output) => stillsRun.outputs.some((runOutput) => runOutput.output_asset_id === output.output_asset_id)), "stills run evidence is incomplete");

  const controlOutput = outputs.find((output) => output.output_asset_id === "OUTPUT_ROOM_CONTROL_VIDEO_V0_1");
  assert(videoRun.runner_version === directJob?.renderer.runner_version && videoRun.runner_sha256 === directJob?.renderer.runner_sha256, "video run runner binding mismatch");
  assert(videoRun.network_policy === "LOOPBACK_ONLY" && videoRun.cost_usd === 0, "video run network/cost evidence mismatch");
  assert(videoRun.output?.output_asset_id === controlOutput?.output_asset_id && videoRun.output?.uri === controlOutput?.uri && videoRun.output?.sha256 === controlOutput?.sha256 && videoRun.output?.bytes === controlOutput?.bytes && JSON.stringify(videoRun.output?.dimensions_px) === JSON.stringify(controlOutput?.dimensions_px), "video run output binding mismatch");
  assert(videoRun.deterministic_duplicate_sha256 === videoRun.output?.sha256, "video duplicate-encode evidence failed");
  assert(videoRun.output?.duration_s === 20 && videoRun.output?.frame_rate_fps === 24 && videoRun.output?.frame_count === 480, "video run timing evidence mismatch");
  assert(videoRun.frames?.length === 480 && videoRun.frames.every((frame, index) => frame.frame === index && frame.sample?.frame === index && /^[a-f0-9]{64}$/.test(frame.sha256) && /^[a-f0-9]{64}$/.test(frame.rgba_sha256)), "video frame evidence must cover frames 0-479 exactly");
  const requiredSamples = [0, 120, 240, 360, 479];
  assert(videoRun.independent_samples?.length === requiredSamples.length && requiredSamples.every((frame) => {
    const sample = videoRun.independent_samples.find((entry) => entry.frame === frame);
    const original = videoRun.frames[frame];
    return sample?.sha256 === original?.sha256 && sample?.rgba_sha256 === original?.rgba_sha256;
  }), "video independent sample evidence mismatch");
  for (const keyframe of pathShot.path.keyframes) {
    const sample = videoRun.frames[keyframe.frame]?.sample;
    assert(equalVector(sample?.position_m, keyframe.position_m, 1e-9) && equalVector(sample?.target_m, keyframe.target_m, 1e-9) && closeEnough(sample?.vertical_fov_deg, keyframe.vertical_fov_deg, 1e-9), `video keyframe sampling mismatch: ${keyframe.frame}`);
  }
  const probeStream = videoRun.probe?.streams?.find((stream) => stream.codec_type === "video");
  assert(videoRun.probe?.streams?.length === 1 && probeStream?.codec_name === "h264" && probeStream?.pix_fmt === "yuv420p" && probeStream?.width === 1920 && probeStream?.height === 1080 && probeStream?.avg_frame_rate === "24/1" && probeStream?.nb_read_frames === "480" && Number(probeStream?.duration) === 20 && Number(videoRun.probe?.format?.duration) === 20, "video probe evidence mismatch");

  assert(renderJobs.length === 1, "exactly one deterministic render job is expected");
  for (const job of renderJobs) {
    assert(job.scene_id === SCENE_ID, `render job scene binding mismatch: ${job.job_id}`);
    assert(job.deterministic === true, `render job is not deterministic: ${job.job_id}`);
    assert(job.renderer.pixel_ratio === 1 && job.renderer.engine_version === "0.185.0", `render runner is not version/fixed-pixel-ratio pinned: ${job.job_id}`);
    assert([job.mutation_policy.geometry_overrides, job.mutation_policy.material_overrides, job.mutation_policy.placement_overrides, job.mutation_policy.light_overrides].every((entries) => entries.length === 0), `render job contains scene overrides: ${job.job_id}`);
    assert(job.input_digests.scene_sha256 === sceneHash && job.input_digests.camera_pack_sha256 === cameraHash && job.input_digests.storyboard_sha256 === storyboardHash, `render job input digest mismatch: ${job.job_id}`);
    assert(job.shot_ids.every((shotId) => shotById.has(shotId)), `render job references a nonexistent shot: ${job.job_id}`);
    assert(job.output_refs.every((outputId) => outputById.has(outputId)), `render job references a nonexistent output: ${job.job_id}`);
    if (["READY", "RUNNING", "SUCCEEDED"].includes(job.status)) {
      const orientationCheck = qa.checks.find((check) => check.check_id === "AVATAR_ORIENTATION");
      assert(orientationGate === "PASS" && orientationCheck?.result === "PASS" && orientationCheck?.finding_count === 0, `render readiness requires passing bound G2 orientation QA: ${job.job_id}`);
    }
  }

  for (const cost of costs) {
    const job = jobById.get(cost.job_id);
    assert(Boolean(job), `cost record references a nonexistent job: ${cost.cost_id}`);
    assert(job?.cost_ref === cost.cost_id, `cost/job binding mismatch: ${cost.cost_id}`);
    assert(cost.estimate <= cost.experiment_cap, `estimated cost exceeds cap: ${cost.cost_id}`);
    assert(cost.actual <= cost.experiment_cap, `actual cost exceeds cap: ${cost.cost_id}`);
    if (job && ["SUCCEEDED", "FAILED"].includes(job.status)) assert(["INCURRED", "RECONCILED"].includes(cost.status), `finished provider job lacks final cost state: ${job.job_id}`);
  }

  for (const job of generativeJobs) {
    const cost = costById.get(job.cost_ref);
    assert(job.scene_id === SCENE_ID, `generative job scene binding mismatch: ${job.job_id}`);
    assert(Boolean(cost), `generative job lacks cost record: ${job.job_id}`);
    assert(cost?.job_id === job.job_id && cost?.provider === job.provider, `generative cost/job/provider binding mismatch: ${job.job_id}`);
    assert(Number.isInteger(job.seed), `generative seed missing: ${job.job_id}`);
    assert(job.output_refs.every((outputId) => outputById.has(outputId)), `generative job references a nonexistent output: ${job.job_id}`);
    for (const inputRef of job.input_refs) {
      const inputOutput = outputById.get(inputRef.split(":")[0]);
      assert(Boolean(inputOutput), `generative job references a nonexistent controlled input: ${job.job_id}`);
      if (["READY", "RUNNING", "SUCCEEDED"].includes(job.status)) assert(["SUCCEEDED", "APPROVED"].includes(inputOutput?.status) && /^[a-f0-9]{64}$/.test(inputOutput?.sha256 ?? ""), `generative controlled input is not a hashed completed artifact: ${job.job_id}`);
    }
    if (["READY", "RUNNING", "SUCCEEDED"].includes(job.status)) {
      assert(typeof job.model.version === "string" && job.model.version.length > 0, `immutable model version missing: ${job.job_id}`);
      assert(job.credential_state === "CONFIGURED", `provider credential not configured: ${job.job_id}`);
      assert(rights.provider_processing.state === "YES", `provider-processing rights are not YES: ${job.job_id}`);
      assert(rights.approval.state === "APPROVED" && rights.approval.reviewer_id, `provider-processing rights lack independent approval: ${job.job_id}`);
      assert(cost && cost.estimate <= cost.experiment_cap, `provider estimate exceeds cap: ${job.job_id}`);
    }
    if (job.status === "SUCCEEDED") assert(typeof job.provider_prediction_id === "string" && job.provider_prediction_id.length > 0, `successful provider job lacks prediction id: ${job.job_id}`);
    if (job.status === "BLOCKED") assert(job.blocked_reasons?.length > 0, `blocked job lacks reasons: ${job.job_id}`);
  }

  const qaCheckIds = qa.checks.map((check) => check.check_id);
  assert(qaCheckIds.length === REQUIRED_QA_CHECK_IDS.length && new Set(qaCheckIds).size === REQUIRED_QA_CHECK_IDS.length && REQUIRED_QA_CHECK_IDS.every((id) => qaCheckIds.includes(id)), "QA check set must contain every required check exactly once");
  const qaChecksPass = qa.checks.length === REQUIRED_QA_CHECK_IDS.length && qa.checks.every((check) => check.result === "PASS" && check.finding_count === 0);
  const qaIndependentlyApproved = qa.status === "PASS" && qa.approval_state === "APPROVED" && qaChecksPass && qa.reviewer.role === "VERIFICATION" && typeof qa.reviewer.id === "string" && qa.reviewer.id.length > 0 && qa.reviewer.id !== qa.executor.id;
  if (qa.status === "PASS") assert(qaChecksPass, "QA PASS requires every required check to pass with zero findings");
  if (qa.status === "PASS" || qa.approval_state === "APPROVED") {
    assert(qa.reviewer.role === "VERIFICATION" && qa.reviewer.id, "QA approval requires a Verification reviewer");
    assert(qa.reviewer.id !== qa.executor.id, "QA reviewer must differ from executor");
  }
  if (qa.approval_state === "APPROVED") assert(qa.status === "PASS" && qaChecksPass, "approved QA requires PASS and all checks passing");

  for (const output of outputs) {
    const job = jobById.get(output.job_id);
    const shot = shotById.get(output.shot_id);
    const cost = costById.get(output.cost_ref);
    assert(output.scene_id === SCENE_ID, `output scene binding missing: ${output.output_asset_id}`);
    assert(Boolean(job), `output references a nonexistent job: ${output.output_asset_id}`);
    assert(Boolean(shot), `output references a nonexistent shot: ${output.output_asset_id}`);
    assert(job?.scene_id === output.scene_id, `output/job scene binding mismatch: ${output.output_asset_id}`);
    assert(job?.output_refs.includes(output.output_asset_id), `job does not reference its output: ${output.output_asset_id}`);
    if (renderJobs.includes(job)) assert(job.shot_ids.includes(output.shot_id), `render output shot is outside its job: ${output.output_asset_id}`);
    assert(output.rights_ref === RIGHTS_ID && output.disclosure_ref === RIGHTS_ID, `output rights/disclosure binding missing: ${output.output_asset_id}`);
    assert(output.qa_ref === qa.qa_id, `output QA binding missing: ${output.output_asset_id}`);
    assert(Boolean(cost), `output cost binding missing: ${output.output_asset_id}`);
    assert(cost?.job_id === output.job_id, `output cost points to a different job: ${output.output_asset_id}`);
    assert(output.source_lane_summary.PRODUCT_TWIN === 8 && output.source_lane_summary.DESIGN_ASSET === 0, `output lane summary mismatch: ${output.output_asset_id}`);
    assert(output.exact_product_claim_allowed === false, `G2 exact-product claim forbidden: ${output.output_asset_id}`);
    if (output.media_type.startsWith("image/")) assert(output.duration_s === null && shot?.role !== "CAMERA_PATH", `still output media/duration/shot mismatch: ${output.output_asset_id}`);
    if (output.media_type === "video/mp4") assert(typeof output.duration_s === "number" && output.duration_s > 0 && shot?.role === "CAMERA_PATH", `video output media/duration/shot mismatch: ${output.output_asset_id}`);
    if (job?.provider === "REPLICATE") assert(output.duration_s === job.settings.duration_s, `generative output duration mismatch: ${output.output_asset_id}`);
    if (job?.deterministic === true && shot?.role === "CAMERA_PATH") assert(output.duration_s === pathShot.path.duration_s, `control video duration mismatch: ${output.output_asset_id}`);
    if (["SUCCEEDED", "APPROVED"].includes(output.status)) {
      assert(typeof output.uri === "string" && output.uri.length > 0, `completed output URI missing: ${output.output_asset_id}`);
      assert(/^[a-f0-9]{64}$/.test(output.sha256 ?? ""), `completed output hash missing: ${output.output_asset_id}`);
      assert(Number.isInteger(output.bytes) && output.bytes > 0, `completed output byte count missing: ${output.output_asset_id}`);
      const safePrefix = `${MEDIA_DIR}/outputs/`;
      assert(output.uri?.startsWith(safePrefix) && !output.uri.includes(".."), `completed output URI must be a stored bundle artifact: ${output.output_asset_id}`);
      if (output.uri?.startsWith(safePrefix) && !output.uri.includes("..")) {
        try {
          const artifactBytes = await readFile(path.join(root, output.uri));
          assert(artifactBytes.length === output.bytes, `completed output byte count does not match file: ${output.output_asset_id}`);
          assert(digest(artifactBytes) === output.sha256, `completed output hash does not match file: ${output.output_asset_id}`);
        } catch {
          assert(false, `completed output artifact does not exist: ${output.output_asset_id}`);
        }
      }
    } else if (output.status === "PLANNED") {
      assert(output.uri === null && output.sha256 === null && output.bytes === null, `planned output must not claim an artifact: ${output.output_asset_id}`);
      assert(output.publication_state === "NOT_READY", `planned output cannot be publication-ready: ${output.output_asset_id}`);
    }
    if (output.status === "APPROVED") {
      assert(job?.status === "SUCCEEDED", `approved output requires a successful job: ${output.output_asset_id}`);
      assert(qaIndependentlyApproved, `approved output requires independently approved passing QA: ${output.output_asset_id}`);
      assert(rights.approval.state === "APPROVED" && rights.approval.reviewer_id, `approved output requires independently approved rights: ${output.output_asset_id}`);
      assert(output.approval.reviewer_role_required === "VERIFICATION" && output.approval.reviewer_id === qa.reviewer.id, `approved output reviewer must match independent QA reviewer: ${output.output_asset_id}`);
    }
    if (["APPROVED_WITH_DISCLOSURE", "PUBLISHED"].includes(output.publication_state)) {
      assert(output.status === "APPROVED", `publication-ready output must be approved: ${output.output_asset_id}`);
      assert(qaIndependentlyApproved, `publication-ready output lacks approved QA: ${output.output_asset_id}`);
      assert(rights.approval.state === "APPROVED", `publication-ready output lacks approved rights: ${output.output_asset_id}`);
      assert(rights.source_assets.every((source) => source.public_publication === "YES"), `public output lacks YES publication rights: ${output.output_asset_id}`);
    }
  }

  assert(qa.expected.placement_count === 8 && qa.expected.instance_count === 8 && qa.expected.opening_claim_count === 0, "QA expected invariants mismatch");
  assert(qa.thresholds.deterministic_transform_drift_m === 0 && qa.thresholds.deterministic_rotation_drift_rad === 0, "deterministic transform tolerance must be zero");
  for (const job of allJobs) {
    const expectedOutputs = outputs.filter((output) => output.job_id === job.job_id).map((output) => output.output_asset_id).sort();
    assert(JSON.stringify([...job.output_refs].sort()) === JSON.stringify(expectedOutputs), `job/output reference graph mismatch: ${job.job_id}`);
  }

  if (checkManifest) {
    const manifest = data.media_manifest;
    assert(manifest.generated_from_commit === SOURCE_COMMIT && manifest.scene_id === SCENE_ID, "media manifest source binding mismatch");
    assert(manifest.status === manifest.release.state, "media manifest release/status mismatch");
    assert(manifest.artifacts.length === EXPECTED_MEDIA_ARTIFACTS.size, "media manifest artifact count mismatch");
    assert(new Set(manifest.artifacts.map((artifact) => artifact.path)).size === manifest.artifacts.length, "media manifest artifact paths must be unique");
    for (const artifact of manifest.artifacts) {
      assert(EXPECTED_MEDIA_ARTIFACTS.has(artifact.path), `media manifest path is outside the frozen bundle: ${artifact.path}`);
      if (!EXPECTED_MEDIA_ARTIFACTS.has(artifact.path)) continue;
      const bytes = await readFile(path.join(root, artifact.path));
      assert(digest(bytes) === artifact.sha256, `media manifest artifact hash mismatch: ${artifact.path}`);
    }
    if (manifest.hero_output_id !== null) {
      const manifestHero = outputs.find((output) => output.output_asset_id === manifest.hero_output_id);
      assert(manifestHero?.status === "APPROVED", "assigned hero output must be independently approved");
      assert(shotById.get(manifestHero?.shot_id)?.role === "HERO", "assigned hero output must use the canonical hero shot");
      assert(qa.status === "PASS" && qa.approval_state === "APPROVED", "assigned hero output requires passing QA");
      assert(manifest.release.state === "APPROVED" && manifest.release.room_lab_consumption_allowed === true, "approved hero requires an approved Room Lab release");
      assert(manifest.release.blockers.length === 0, "approved Room Lab release cannot retain blockers");
    } else {
      assert(manifest.release.room_lab_consumption_allowed === false, "Room Lab consumption cannot be enabled without an approved hero");
      assert(manifest.release.state !== "APPROVED", "approved Room Lab release requires an approved hero");
    }
  }

  await validateContractSchemas(root, data, assert);

  return {
    ok: errors.length === 0,
    scene_id: scene.scene_id,
    checked_placements: scene.placements.length,
    checked_shots: cameras.shots.length,
    checked_outputs: outputs.length,
    provider_job_status: generativeJobs.map((job) => ({ job_id: job.job_id, status: job.status })),
    errors
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await validateRoomLabMediaProof();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}
