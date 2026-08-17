#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const MEDIA_DIR = "data/media/room-alpha/v0.1";
const SCENE_URI = "data/media/room-lab/v0.1/scene-manifest.json";
const SCENE_SHA256 = "fc47dadcf08c4e8172d93b07397c4325851560da57d3c713f99a18065ee2b181";
const FROZEN_COMMIT = "3d36f07c32e42b168a74c5bc03a263e8c63e6eab";
const REUSED_RUNNER_SHA256 = "89efdfcf586a7cdd5bff0fbdb3a07316d45cd9fb6bf78a4d434a364b97054131";
const MANIFEST_REVISION = "0.1.0";
const EXPECTED_ENVIRONMENT = {
  node: { version: "v22.14.0" },
  chrome: { version: "Google Chrome 151.0.7922.138", path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", sha256: "ee37661755341e9fc1babf9c20ec09d6a36e50aa8713ceb08082f8bbe2d8217d" },
  three: { version: "0.185.0", module_sha256: "bbf5ed13fe4373f5bd38b14ea8e62e9f157327da5638edc6d3863e08b167c9c7", core_sha256: "78b2c4218834ca8670547ed2315bfc21a00ff4dc3403bbffc8c31493d31d14de", gltf_loader_sha256: "97642d720f16cc9a0c9844934198e4d0c023bea8e89576d0f7545d03b2d103d2" },
  ffmpeg: { version_prefix: "ffmpeg version 8.1.2", path: "/opt/homebrew/bin/ffmpeg", sha256: "882dc3dcaabd4262465def19f4eb0a2968f23ab9bbaeb8f2566a61c603e4ed43" },
  ffprobe: { version_prefix: "ffprobe version 8.1.2", path: "/opt/homebrew/bin/ffprobe", sha256: "1f87f6c4bf4f48b25000a1e0a0eb70dca93d17d3d6628749c69cff481d13cc78" }
};

const EXPECTED_SOURCE_BINDINGS = {
  room: { manifest_id: "ROOM_MANIFEST_LIVING_ROOM_ALPHA_V0_1", revision: MANIFEST_REVISION, uri: `${MEDIA_DIR}/room-manifest.json` },
  furniture: { manifest_id: "FURNITURE_MANIFEST_LIVING_ROOM_ALPHA_V0_1", revision: MANIFEST_REVISION, uri: `${MEDIA_DIR}/furniture-manifest.json` },
  market: { manifest_id: "MARKET_MANIFEST_LIVING_ROOM_ALPHA_ES_29660_V0_1", revision: MANIFEST_REVISION, uri: `${MEDIA_DIR}/es-29660-manifest.json` }
};

const EXPECTED_OUTPUTS = new Map([
  ["CAM_ROOM_ALPHA_TOP_PLAN_V0_1", { output_id: "OUTPUT_ROOM_ALPHA_TOP_PLAN_V0_1", uri: `${MEDIA_DIR}/outputs/verification/top-plan.png`, sha256: "421bd408aac3154f8bdd6c67c3b4f00f113d3d1940c6a74277df4fd2b63adbd7", bytes: 203569, dimensions_px: { width: 1600, height: 1200 }, evidence_id: "OUTPUT_ROOM_QA_TOP_V0_1", evidence_role: "QA_TOP", source_uri: "data/media/room-lab/v0.1/outputs/room-qa-top.png", native: false }],
  ["CAM_ROOM_ALPHA_WIDE_V0_1", { output_id: "OUTPUT_ROOM_ALPHA_WIDE_V0_1", uri: `${MEDIA_DIR}/outputs/verification/wide-room.png`, sha256: "3f2c266359cf0182e7f8ef45b73eaef3153072e4dda5f77748f4cdaea5de94db", bytes: 131723, dimensions_px: { width: 1600, height: 1000 }, evidence_id: "OUTPUT_ROOM_QA_FRONT_V0_1", evidence_role: "QA_FRONT", source_uri: "data/media/room-lab/v0.1/outputs/room-qa-front.png", native: false }],
  ["CAM_ROOM_ALPHA_SEATING_V0_1", { output_id: "OUTPUT_ROOM_ALPHA_SEATING_V0_1", uri: `${MEDIA_DIR}/outputs/verification/seating-relationship.png`, sha256: "323784e3a5af8f24fc64c1df80e00e60c5ef660b183ed2e4b6f46feef6dbdd06", bytes: 281772, dimensions_px: { width: 1600, height: 1000 }, evidence_id: "OUTPUT_ROOM_QA_LOW_EYE_V0_1", evidence_role: "QA_LOW_EYE", source_uri: "data/media/room-lab/v0.1/outputs/room-qa-low-eye.png", native: false }],
  ["CAM_ROOM_ALPHA_CLEARANCE_V0_1", { output_id: "OUTPUT_ROOM_ALPHA_CLEARANCE_V0_1", uri: `${MEDIA_DIR}/outputs/verification/side-clearance.png`, sha256: "88f6f060c1b0af0bdbdc782f36890b5d61722beed42b588bfe0f9448500e556e", bytes: 37204, dimensions_px: { width: 1600, height: 1000 }, evidence_role: "SIDE_CLEARANCE_VIEW", native: true }],
  ["CAM_ROOM_ALPHA_SELECTED_KIVIK_V0_1", { output_id: "OUTPUT_ROOM_ALPHA_SELECTED_KIVIK_V0_1", uri: `${MEDIA_DIR}/outputs/verification/selected-kivik.png`, sha256: "d5c9078f55fc33743ef1bc75ea03890380f86df2548d17d898b703ef5546ccfd", bytes: 152793, dimensions_px: { width: 1600, height: 1000 }, evidence_role: "SELECTED_PRODUCT_CANONICAL_INSPECTION", native: true }],
  ["CAM_ROOM_ALPHA_HERO_V0_1", { output_id: "OUTPUT_ROOM_ALPHA_HERO_V0_1", uri: `${MEDIA_DIR}/outputs/verification/hero-composition.png`, sha256: "951f5f4e2b569df08d8cee9211ccbf35bc8555ff1cd0b385622f8539d06a4042", bytes: 139712, dimensions_px: { width: 1920, height: 1200 }, evidence_id: "OUTPUT_ROOM_HERO_V0_1", evidence_role: "HERO", source_uri: "data/media/room-lab/v0.1/outputs/room-hero.png", native: false }]
]);

const EXPECTED_ROOM_FREEZE = { shell_changes_allowed: false, opening_changes_allowed: false, placement_changes_allowed: false, geometry_substitution_allowed: false, camera_logic_owned_by_media_pack: true };
const EXPECTED_FURNITURE_ADAPTER = { expected_manifest_id: "FURNITURE_AVATAR_MANIFEST_V0_1", expected_uri: "data/geometry/furniture-avatar-manifest-v0.1.json", state: "AWAITING_AVATAR_FACTORY", accepts_asset_uri_revision_and_fidelity_only: true, camera_changes_allowed: false, placement_changes_allowed: false, silent_fallback_allowed: false };
const EXPECTED_MEDIA_ADAPTER = { expected_manifest_id: "FURNITURE_AVATAR_MANIFEST_V0_1", expected_uri: "data/geometry/furniture-avatar-manifest-v0.1.json", state: "ABSENT_NOT_CONSUMED", active_adapter: "INLINE_FROZEN_SCENE_PLACEMENTS_V0_1", allowed_replacements: ["asset_uri", "asset_revision", "asset_sha256", "geometry_level", "appearance_level", "rights_ref"], forbidden_changes: ["camera", "scene", "placement_id", "transform", "product_twin_id", "source_lane"] };
const VERIFICATION_DISCLOSURE = "Internal verification visual using verified-scale G2 planning proxies; no exact product texture, finish, surveyed room, opening or publication claim.";
const CONCEPT_DISCLOSURE = "Concept visual using approximate G2 planning proxies and an assumed room; exact products, finishes, textures and surveyed geometry are not claimed.";
const CONCEPT_BLOCKERS = ["public publication rights are REVIEW", "derivative rights are REVIEW", "provider-processing rights are REVIEW", "redistribution is NO", "independent rights reviewer is absent", "visible approximation disclosure is not rendered"];
const GLOBAL_BLOCKERS = ["CONCEPT_MARKETING_RENDER rights and visible-disclosure gates are blocked", "furniture-avatar-manifest-v0.1 is absent and not consumed", "ES-29660 evidence is dated context only and must be refreshed before approval or purchase", "Room Lab integration requires Brain approval"];

const EXPECTED_PLACEMENTS = new Map([
  ["kivik-placement-01", ["LR_SOFA_01", "PT_IKEA_KIVIK_49440597", "AVATAR_IKEA_KIVIK_49440597_G2_SOFA_PROXY", "data/geometry/avatars/ikea-kivik-49440597-g2-sofa-proxy.glb", "a765cb6ddf0bd6b670c0b1add8e3d6a1546bffac23ba31736f850ce98e81d392", [0, 0, -1.78], Math.PI]],
  ["poang-placement-01", ["LR_ARMCHAIR_01", "PT_IKEA_POANG_39240787", "AVATAR_IKEA_POANG_39240787_G2_ARMCHAIR_PROXY", "data/geometry/avatars/ikea-poang-39240787-g2-armchair-proxy.glb", "7d1e5659d9f34247aefe65399859d1f7adfc2ed000e1ade9a38a0498fd93cb85", [-1.88, 0, 0.05], -Math.PI / 2]],
  ["listerby-placement-01", ["LR_COFFEE_TABLE_01", "PT_IKEA_LISTERBY_30513904", "AVATAR_IKEA_LISTERBY_30513904_G2_COFFEE_TABLE_PROXY", "data/geometry/avatars/ikea-listerby-30513904-g2-coffee-table-proxy.glb", "d5294a8b83d5173179a75f54f371346b26577fe54425dfbe0f9ab2264cc8d37f", [0, 0, -0.22], 0]],
  ["lohals-placement-01", ["LR_RUG_01", "PT_IKEA_LOHALS_30511288", "AVATAR_IKEA_LOHALS_30511288_G2_RUG_PROXY", "data/geometry/avatars/ikea-lohals-30511288-g2-rug-proxy.glb", "f3b28a885db303121e69ac0dd2d94089cb3d5f8791d58170852ea52ef916b572", [0, 0, -0.18], 0]],
  ["gladom-placement-01", ["LR_SIDE_TABLE_01", "PT_IKEA_GLADOM_70578451", "AVATAR_IKEA_GLADOM_70578451_G2_TRAY_TABLE_PROXY", "data/geometry/avatars/ikea-gladom-70578451-g2-tray-table-proxy.glb", "36e5c3da0c1b24147f0aa777373dff3ced49badde8c2295e061d99e565e6b4c9", [1.58, 0, -1.55], 0]],
  ["lauters-placement-01", ["LR_FLOOR_LAMP_01", "PT_IKEA_LAUTERS_30405042", "AVATAR_IKEA_LAUTERS_30405042_G2_FLOOR_LAMP_PROXY", "data/geometry/avatars/ikea-lauters-30405042-g2-floor-lamp-proxy.glb", "b276fc15e90b0e380a335fe965253a486a2f40d08a6e0005433f99d05bb13f3e", [-1.72, 0, -1.55], 0.2]],
  ["besta-placement-01", ["LR_MEDIA_UNIT_01", "PT_IKEA_BESTA_89330691", "AVATAR_IKEA_BESTA_89330691_G2_MEDIA_UNIT_PROXY", "data/geometry/avatars/ikea-besta-89330691-g2-media-unit-proxy.glb", "71081ab6bcd0238652cdaa7b9495b2ab29041f94c2caf856da2bfacd93f3582e", [0, 0, 2.05], 0]],
  ["billy-placement-01", ["LR_BOOKCASE_01", "PT_IKEA_BILLY_00263850", "AVATAR_IKEA_BILLY_00263850_G2_BOOKCASE_PROXY", "data/geometry/avatars/ikea-billy-00263850-g2-bookcase-proxy.glb", "04b826a4e1f534a9a415b31402b5c46ef44e35bf503f2ed099b541ac71f54258", [2.84, 0, 1.15], Math.PI / 2]]
]);

const EXPECTED_CAMERAS = new Map([
  ["CAM_ROOM_ALPHA_TOP_PLAN_V0_1", ["TOP_PLAN_PLACEMENT_CIRCULATION", "ORTHOGRAPHIC", [0, 9, 0.01], [0, 0, 0], null, null, 5.2, "4:3", [1600, 1200], "ALL_PLACEMENTS"]],
  ["CAM_ROOM_ALPHA_WIDE_V0_1", ["WIDE_ROOM_PERSPECTIVE", "PERSPECTIVE", [5.4, 3.2, 5.2], [0, 0.72, -0.15], 39, 33.88695462721, null, "16:10", [1600, 1000], "ALL_PLACEMENTS"]],
  ["CAM_ROOM_ALPHA_SEATING_V0_1", ["PRINCIPAL_SEATING_RELATIONSHIP", "PERSPECTIVE", [2.55, 1.25, 2.05], [-0.15, 0.65, -0.5], 42, 31.261068776326, null, "16:10", [1600, 1000], "ALL_PLACEMENTS"]],
  ["CAM_ROOM_ALPHA_CLEARANCE_V0_1", ["SIDE_CLEARANCE_VIEW", "ORTHOGRAPHIC", [8, 1.35, -0.85], [0, 0.65, -0.85], null, null, 3.25, "16:10", [1600, 1000], "CLEARANCE_PAIR_PLUS_SHELL"]],
  ["CAM_ROOM_ALPHA_SELECTED_KIVIK_V0_1", ["SELECTED_PRODUCT_CANONICAL_INSPECTION", "PERSPECTIVE", [0, 1.1, 1.2], [0, 0.42, -1.78], 35, 38.059137628359, null, "16:10", [1600, 1000], "SELECTED_ONLY_PLUS_SHELL"]],
  ["CAM_ROOM_ALPHA_HERO_V0_1", ["FINAL_ROOM_HERO_COMPOSITION", "PERSPECTIVE", [7.2, 5.5, 7.5], [0, 0.75, 0], 39, 33.88695462721, null, "16:10", [1920, 1200], "ALL_PLACEMENTS"]]
]);

const EXPECTED_CAMERA_DETAILS = new Map([
  ["CAM_ROOM_ALPHA_TOP_PLAN_V0_1", { source_shot_id: "SHOT_ROOM_QA_TOP_V0_1", up_vector: [0, 0, -1], near_m: 0.02, far_m: 100, orthographic_bounds_m: { left: -3.4666666667, right: 3.4666666667, top: 2.6, bottom: -2.6 }, allowed_output_classes: ["VERIFICATION_RENDER"] }],
  ["CAM_ROOM_ALPHA_WIDE_V0_1", { source_shot_id: "SHOT_ROOM_QA_FRONT_V0_1", up_vector: [0, 1, 0], near_m: 0.02, far_m: 100, orthographic_bounds_m: null, allowed_output_classes: ["VERIFICATION_RENDER"] }],
  ["CAM_ROOM_ALPHA_SEATING_V0_1", { source_shot_id: "SHOT_ROOM_QA_LOW_EYE_V0_1", up_vector: [0, 1, 0], near_m: 0.02, far_m: 100, orthographic_bounds_m: null, allowed_output_classes: ["VERIFICATION_RENDER"] }],
  ["CAM_ROOM_ALPHA_CLEARANCE_V0_1", { source_shot_id: "ALPHA_NATIVE_SIDE_CLEARANCE_V0_1", up_vector: [0, 1, 0], near_m: 0.02, far_m: 100, orthographic_bounds_m: { left: -2.6, right: 2.6, top: 1.75, bottom: -1.5 }, allowed_output_classes: ["VERIFICATION_RENDER"] }],
  ["CAM_ROOM_ALPHA_SELECTED_KIVIK_V0_1", { source_shot_id: "ALPHA_NATIVE_SELECTED_KIVIK_V0_1", up_vector: [0, 1, 0], near_m: 0.02, far_m: 100, orthographic_bounds_m: null, allowed_output_classes: ["VERIFICATION_RENDER"] }],
  ["CAM_ROOM_ALPHA_HERO_V0_1", { source_shot_id: "SHOT_ROOM_HERO_V0_1", up_vector: [0, 1, 0], near_m: 0.02, far_m: 100, orthographic_bounds_m: null, allowed_output_classes: ["VERIFICATION_RENDER", "CONCEPT_MARKETING_RENDER"] }]
]);

const GOVERNANCE = new Map([
  ["BRAIN_CONTROL_BOARD", ["ef1d52d53aa4d6c3b8cbd5f99c456c5d219a1a4c", "data/dashboard/project-control.json", "03b70508e3db9897263647f6ea24c3dfeb0124c7", "f5850d8ed3df1db60d1708e6492cc9513c7c34fbebb950d14b70a8d2126049c5"]],
  ["PERSISTENT_CHAT_TOPOLOGY", ["ef1d52d53aa4d6c3b8cbd5f99c456c5d219a1a4c", "docs/PERSISTENT-CHAT-TOPOLOGY.md", "69e07eb135371ee6192f4cfa2ba59d7f5d8d32c9", "48c334e96a9a437547e69f22503ee7d358d358ad14259a55d018430f243ecec4"]],
  ["ROOM_LAB_HANDOFF", ["eb02c51ef35fec438ef3f0da29b5a39b43ed7791", "docs/handoffs/ROOM-LAB.md", "a1e11f16db199526038dc57faa95e518a3f2b31b", "1b94bd57e0e514581cd3a9700beb328739f9f0baeff7916962ea3fee71af8419"]],
  ["AVATAR_FACTORY_HANDOFF", ["2a959d4f8e270d150b74e3f43daf624a4ed06c9c", "docs/handoffs/AVATAR-FACTORY.md", "413602ec2d057fbe284db3a9461f075c10acb3a5", "de53069107ac988e5bee22436acd488b2fe1c56c3d018a77993562c7ca3b581c"]],
  ["VERIFICATION_HANDOFF", ["d2687728ac5383bd9b621dfc354c0b53dec8929c", "docs/handoffs/VERIFICATION-EVIDENCE-MONITORING.md", "30074faf665aa51db09cc7bc0dfad585b9a3ac12", "6795fc1940b5777ed7cf2ef0b09e1668f852b3bf365e105c64e91356846d2614"]]
]);

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readJson(root, relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

export async function loadLivingRoomAlphaBundle(root = ROOT) {
  const [room_manifest, furniture_manifest, market_manifest, camera_pack, media_manifest, native_run, reused_run, render_environment, scene_manifest, source_camera_pack, client_design] = await Promise.all([
    readJson(root, `${MEDIA_DIR}/room-manifest.json`),
    readJson(root, `${MEDIA_DIR}/furniture-manifest.json`),
    readJson(root, `${MEDIA_DIR}/es-29660-manifest.json`),
    readJson(root, `${MEDIA_DIR}/camera-pack.json`),
    readJson(root, `${MEDIA_DIR}/media-manifest.example.json`),
    readJson(root, `${MEDIA_DIR}/outputs/alpha-native-stills-run.json`),
    readJson(root, "data/media/room-lab/v0.1/outputs/room-lab-stills-run.json"),
    readJson(root, `${MEDIA_DIR}/render-environment.json`),
    readJson(root, SCENE_URI),
    readJson(root, "data/media/room-lab/v0.1/camera-shots.json"),
    readJson(root, "data/showrooms/living-room-client-design-v0.1.json")
  ]);
  return { room_manifest, furniture_manifest, market_manifest, camera_pack, media_manifest, native_run, reused_run, render_environment, scene_manifest, source_camera_pack, client_design };
}

function close(a, b, tolerance = 1e-12) {
  return typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tolerance;
}

function vectorsEqual(actual, expected, tolerance = 1e-12) {
  return Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => close(value, expected[index], tolerance));
}

function jsonEqual(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function pngDimensions(bytes) {
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || bytes.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function walk(value, visitor, pathParts = []) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) return value.forEach((entry, index) => walk(entry, visitor, [...pathParts, index]));
  for (const [key, entry] of Object.entries(value)) {
    visitor(key, entry, [...pathParts, key]);
    walk(entry, visitor, [...pathParts, key]);
  }
}

function schemaValidator(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);
  return ajv.compile(schema);
}

export async function validateLivingRoomAlpha({ root = ROOT, bundle = null } = {}) {
  const data = bundle ?? await loadLivingRoomAlphaBundle(root);
  const errors = [];
  const assert = (condition, message) => { if (!condition) errors.push(message); };

  const [cameraSchema, mediaSchema] = await Promise.all([
    readJson(root, "config/media/room-alpha-camera-pack.schema.json"),
    readJson(root, "config/media/room-alpha-media-manifest.schema.json")
  ]);
  for (const [label, value, schema] of [["camera pack", data.camera_pack, cameraSchema], ["media manifest", data.media_manifest, mediaSchema]]) {
    const validate = schemaValidator(schema);
    if (!validate(value)) errors.push(`${label} schema failed: ${validate.errors.map((entry) => `${entry.instancePath || "/"} ${entry.message}`).join("; ")}`);
  }

  assert(data.room_manifest.schema_version === MANIFEST_REVISION && data.room_manifest.room_manifest_id === EXPECTED_SOURCE_BINDINGS.room.manifest_id && data.room_manifest.revision === MANIFEST_REVISION && data.room_manifest.uri === undefined, "room manifest identity mismatch");
  assert(data.room_manifest.room_lab_binding.repository === "room-lab-site" && data.room_manifest.room_lab_binding.release === "ROOM_LAB_INTERACTION_V9" && data.room_manifest.room_lab_binding.scene_manifest_uri === SCENE_URI && data.room_manifest.room_lab_binding.scene_manifest_id === "MEDIA_SCENE_ROOM_LAB_MARBELLA_V0_1" && data.room_manifest.room_lab_binding.scene_id === "SCENE_ROOM_LAB_MARBELLA_LIVING_V0_1", "room source identity mismatch");
  assert(data.room_manifest.room_lab_binding.commit === FROZEN_COMMIT, "frozen Room Lab source commit mismatch");
  assert(data.room_manifest.room_lab_binding.scene_manifest_sha256 === SCENE_SHA256, "room scene hash mismatch");
  assert(data.room_manifest.shell.width_m === 6 && data.room_manifest.shell.depth_m === 4.6 && data.room_manifest.shell.height_m === 2.8, "frozen room bounds mismatch");
  assert(data.room_manifest.shell.authoritative_opening_count === 0 && JSON.stringify(data.room_manifest.shell.assumed_overlay_ids) === JSON.stringify(["OVERLAY_GARDEN_WINDOW_ASSUMED"]), "room opening/overlay truth mismatch");
  assert(jsonEqual(data.room_manifest.freeze, EXPECTED_ROOM_FREEZE), "room freeze policy mismatch");
  assert(digest(await readFile(path.join(root, SCENE_URI))) === SCENE_SHA256, "frozen scene artifact hash mismatch");

  assert(data.furniture_manifest.schema_version === MANIFEST_REVISION && data.furniture_manifest.furniture_manifest_id === EXPECTED_SOURCE_BINDINGS.furniture.manifest_id && data.furniture_manifest.revision === MANIFEST_REVISION && data.furniture_manifest.uri === undefined, "furniture manifest identity mismatch");
  assert(jsonEqual(data.furniture_manifest.avatar_manifest_adapter, EXPECTED_FURNITURE_ADAPTER), "furniture avatar adapter policy mismatch");

  const sceneById = new Map(data.scene_manifest.placements.map((placement) => [placement.placement_id, placement]));
  const furnitureById = new Map(data.furniture_manifest.placements.map((placement) => [placement.placement_id, placement]));
  assert(sceneById.size === 8 && data.scene_manifest.placements.length === 8 && furnitureById.size === 8 && data.furniture_manifest.placements.length === 8, "exactly eight unique placements required");
  assert(data.furniture_manifest.freeze.placement_count === 8 && data.furniture_manifest.freeze.instance_count === 8 && data.furniture_manifest.freeze.substitution_count === 0, "furniture freeze counts mismatch");
  const aliases = new Set();
  for (const [placementId, expected] of EXPECTED_PLACEMENTS) {
    const [alias, twin, avatar, asset, assetSha, translation, rotation] = expected;
    const scenePlacement = sceneById.get(placementId);
    const furniture = furnitureById.get(placementId);
    assert(Boolean(scenePlacement) && Boolean(furniture), `missing placement: ${placementId}`);
    assert(scenePlacement?.twin_ref === twin && furniture?.product_twin_id === twin && furniture?.source_lane === "PRODUCT_TWIN" && furniture?.design_asset_id === null, `placement lane/twin mismatch: ${placementId}`);
    assert(furniture?.source_placement_alias === alias && !aliases.has(alias), `placement crosswalk mismatch: ${placementId}`);
    aliases.add(furniture?.source_placement_alias);
    assert(scenePlacement?.avatar.avatar_id === avatar && furniture?.asset.avatar_id === avatar && scenePlacement?.avatar.asset_path === asset && furniture?.asset.uri === asset, `avatar URI mismatch: ${placementId}`);
    assert(scenePlacement?.avatar.sha256 === assetSha && furniture?.asset.sha256 === assetSha && furniture?.asset.revision === `sha256:${assetSha}`, `asset revision/hash mismatch: ${placementId}`);
    assert(vectorsEqual(scenePlacement?.transform.translation_m, translation) && vectorsEqual(furniture?.transform.translation_m, translation), `placement transform drift: ${placementId}`);
    assert(close(scenePlacement?.transform.rotation_y_rad, rotation) && close(furniture?.transform.rotation_y_rad, rotation) && vectorsEqual(furniture?.transform.scale, [1, 1, 1]), `placement rotation/scale drift: ${placementId}`);
    assert(furniture?.asset.geometry_level === "G2" && furniture?.asset.appearance_level === "A1_COLOUR_ROUGHNESS_CUE_ONLY", `furniture fidelity promotion mismatch: ${placementId}`);
    assert(furniture?.rights.internal_render === "YES" && furniture?.rights.public_publication === "REVIEW" && furniture?.rights.provider_processing === "REVIEW" && furniture?.rights.redistribution === "NO", `furniture rights mismatch: ${placementId}`);
  }
  assert(aliases.size === 8, "placement crosswalk must be bijective");
  const designByAlias = new Map(data.client_design.placements.map((placement) => [placement.placement_id, placement]));
  for (const furniture of data.furniture_manifest.placements) {
    const design = designByAlias.get(furniture.source_placement_alias);
    assert(design?.twin_id === furniture.product_twin_id && design?.avatar_id === furniture.asset.avatar_id, `client-design crosswalk mismatch: ${furniture.placement_id}`);
  }

  assert(data.market_manifest.schema_version === MANIFEST_REVISION && data.market_manifest.market_manifest_id === EXPECTED_SOURCE_BINDINGS.market.manifest_id && data.market_manifest.revision === MANIFEST_REVISION && data.market_manifest.uri === undefined, "market manifest identity mismatch");
  assert(data.market_manifest.destination.country === "ES" && data.market_manifest.destination.postal_code === "29660", "market destination mismatch");
  assert(data.market_manifest.source_binding.uri === "data/procurement/living-room-ikea-spain-session-2026-08-17.json" && data.market_manifest.source_binding.sha256 === "72859925c42dc30f76883cbeaddd51416236b30e51e28c4f58ea646e61336538" && data.market_manifest.source_binding.session_id === "IKEA_ES_ROOM_LAB_29660_2026_08_17" && data.market_manifest.source_binding.observed_at === "2026-08-17", "ES-29660 source binding mismatch");
  assert(data.market_manifest.state === "DATED_SNAPSHOT_REFRESH_BEFORE_APPROVAL_OR_PURCHASE", "ES-29660 evidence must remain dated context only");
  assert(data.market_manifest.policy.alters_scene_or_camera === false && data.market_manifest.policy.silent_substitution_allowed === false && data.market_manifest.policy.listerby_substitution_approved === false && data.market_manifest.policy.procurement_claim_allowed === false, "market policy permits a forbidden promotion");
  const marketByPlacement = new Map(data.market_manifest.placement_supply.map((entry) => [entry.placement_id, entry]));
  assert(marketByPlacement.size === 8 && data.market_manifest.placement_supply.length === 8, "market manifest must cover eight unique placements");
  for (const [placementId, expected] of EXPECTED_PLACEMENTS) assert(marketByPlacement.get(placementId)?.product_twin_id === expected[1], `market/twin mismatch: ${placementId}`);
  assert(marketByPlacement.get("listerby-placement-01")?.destination_state === "CURRENTLY_UNAVAILABLE", "LISTERBY snapshot state must remain unavailable");
  walk(data.media_manifest, (key) => assert(!["price", "stock", "offer", "checkout", "lead_time", "landed_cost", "current"].includes(key.toLowerCase()), `forbidden commerce/current field in media manifest: ${key}`));

  assert(data.camera_pack.schema_version === MANIFEST_REVISION && data.camera_pack.camera_pack_id === "CAMERA_PACK_LIVING_ROOM_ALPHA_V0_1" && data.camera_pack.revision === MANIFEST_REVISION && data.camera_pack.room_manifest_id === EXPECTED_SOURCE_BINDINGS.room.manifest_id && data.camera_pack.scene_id === "SCENE_ROOM_LAB_MARBELLA_LIVING_V0_1" && data.camera_pack.scene_sha256 === SCENE_SHA256, "camera-pack source identity mismatch");
  assert(jsonEqual(data.camera_pack.freeze, { camera_count: 6, scene_logic_changes_allowed: false, avatar_adapter_changes_camera_logic: false }), "camera-pack freeze mismatch");
  assert(data.camera_pack.environment.environment_id === "VERIFICATION_FROZEN_ROOM_LAB_V9" && data.camera_pack.environment.engine === "THREE_WEBGL" && data.camera_pack.environment.engine_version === "0.185.0" && data.camera_pack.environment.pixel_ratio === 1 && data.camera_pack.environment.colour_space === "SRGB" && data.camera_pack.environment.tone_mapping === "ACES_FILMIC" && data.camera_pack.environment.exposure === 1.18 && data.camera_pack.environment.shadow_map === "PCF_SOFT" && jsonEqual(data.camera_pack.environment.geometry_overrides, []) && jsonEqual(data.camera_pack.environment.material_overrides, []) && jsonEqual(data.camera_pack.environment.placement_overrides, []), "camera-pack environment mismatch");
  assert(data.camera_pack.cameras.length === 6 && new Set(data.camera_pack.cameras.map((camera) => camera.camera_id)).size === 6 && new Set(data.camera_pack.cameras.map((camera) => camera.role)).size === 6, "six unique cameras and roles required");
  const cameraById = new Map(data.camera_pack.cameras.map((camera) => [camera.camera_id, camera]));
  for (const [cameraId, expected] of EXPECTED_CAMERAS) {
    const [role, projection, position, target, fov, focal, orthoHeight, aspect, resolution, visibility] = expected;
    const camera = cameraById.get(cameraId);
    const details = EXPECTED_CAMERA_DETAILS.get(cameraId);
    assert(Boolean(camera), `missing camera: ${cameraId}`);
    if (!camera) continue;
    assert(camera?.role === role && camera?.projection === projection, `camera role/projection mismatch: ${cameraId}`);
    assert(vectorsEqual(camera?.position_m, position) && vectorsEqual(camera?.target_m, target), `camera numeric drift: ${cameraId}`);
    assert(camera.source_shot_id === details.source_shot_id && vectorsEqual(camera.up_vector, details.up_vector) && close(camera.near_m, details.near_m) && close(camera.far_m, details.far_m), `camera source/frustum mismatch: ${cameraId}`);
    assert(jsonEqual(camera.orthographic_bounds_m, details.orthographic_bounds_m) && jsonEqual(camera.allowed_output_classes, details.allowed_output_classes), `camera bounds/output-class mismatch: ${cameraId}`);
    assert(camera.lighting_environment_id === "VERIFICATION_FROZEN_ROOM_LAB_V9", `camera lighting environment mismatch: ${cameraId}`);
    assert((fov === null ? camera?.vertical_fov_deg === null : close(camera?.vertical_fov_deg, fov)) && (focal === null ? camera?.focal_length_mm === null : close(camera?.focal_length_mm, focal)), `camera lens mismatch: ${cameraId}`);
    assert((orthoHeight === null ? camera?.orthographic_height_m === null : close(camera?.orthographic_height_m, orthoHeight)) && camera?.aspect_ratio === aspect && camera?.resolution_px.width === resolution[0] && camera?.resolution_px.height === resolution[1], `camera aspect/resolution mismatch: ${cameraId}`);
    assert(camera?.visibility_policy === visibility, `camera visibility policy mismatch: ${cameraId}`);
    if (projection === "PERSPECTIVE") {
      const calculated = camera.sensor_height_mm / (2 * Math.tan(camera.vertical_fov_deg * Math.PI / 360));
      assert(close(calculated, camera.focal_length_mm, 1e-9), `camera FOV/focal inconsistency: ${cameraId}`);
    } else {
      const bounds = camera.orthographic_bounds_m;
      assert(close((bounds.right - bounds.left) / (bounds.top - bounds.bottom), camera.resolution_px.width / camera.resolution_px.height, 1e-9), `orthographic aspect inconsistency: ${cameraId}`);
    }
  }
  assert(JSON.stringify(cameraById.get("CAM_ROOM_ALPHA_HERO_V0_1")) !== JSON.stringify(cameraById.get("CAM_ROOM_ALPHA_WIDE_V0_1")), "hero and wide cameras must differ");
  assert(cameraById.get("CAM_ROOM_ALPHA_SELECTED_KIVIK_V0_1")?.selected_placement_id === "kivik-placement-01", "selected-product camera must bind KIVIK");
  for (const camera of data.camera_pack.cameras) if (!["CAM_ROOM_ALPHA_CLEARANCE_V0_1", "CAM_ROOM_ALPHA_SELECTED_KIVIK_V0_1"].includes(camera.camera_id)) assert(camera.visibility_policy === "ALL_PLACEMENTS", `visibility filtering forbidden: ${camera.camera_id}`);

  const kivikTwin = await readJson(root, "data/twins/PT_IKEA_KIVIK_49440597.json");
  const listerbyTwin = await readJson(root, "data/twins/PT_IKEA_LISTERBY_30513904.json");
  const clearance = (-0.22 - listerbyTwin.physical.dimensions_mm.depth / 2000) - (-1.78 + kivikTwin.physical.dimensions_mm.depth / 2000);
  assert(close(clearance, 0.785, 1e-12) && close(cameraById.get("CAM_ROOM_ALPHA_CLEARANCE_V0_1")?.expected_clearance_m, clearance, 1e-12), "KIVIK-LISTERBY clearance must equal 0.785 m");

  const sourceHashes = {
    room_manifest_sha256: digest(await readFile(path.join(root, `${MEDIA_DIR}/room-manifest.json`))),
    furniture_manifest_sha256: digest(await readFile(path.join(root, `${MEDIA_DIR}/furniture-manifest.json`))),
    market_manifest_sha256: digest(await readFile(path.join(root, `${MEDIA_DIR}/es-29660-manifest.json`))),
    camera_pack_sha256: digest(await readFile(path.join(root, `${MEDIA_DIR}/camera-pack.json`)))
  };
  assert(data.media_manifest.schema_version === MANIFEST_REVISION && data.media_manifest.media_manifest_id === "MEDIA_MANIFEST_LIVING_ROOM_ALPHA_V0_1" && data.media_manifest.revision === MANIFEST_REVISION, "media manifest identity mismatch");
  for (const lane of ["room", "furniture", "market"]) {
    const binding = data.media_manifest.source_bindings[lane];
    const expected = EXPECTED_SOURCE_BINDINGS[lane];
    assert(binding?.manifest_id === expected.manifest_id && binding?.revision === expected.revision && binding?.uri === expected.uri, `media ${lane} source identity mismatch`);
  }
  assert(data.media_manifest.camera_pack_binding.manifest_id === "CAMERA_PACK_LIVING_ROOM_ALPHA_V0_1" && data.media_manifest.camera_pack_binding.revision === MANIFEST_REVISION && data.media_manifest.camera_pack_binding.uri === `${MEDIA_DIR}/camera-pack.json`, "media camera-pack identity mismatch");
  assert(data.media_manifest.source_bindings.room.sha256 === sourceHashes.room_manifest_sha256 && data.media_manifest.source_bindings.furniture.sha256 === sourceHashes.furniture_manifest_sha256 && data.media_manifest.source_bindings.market.sha256 === sourceHashes.market_manifest_sha256 && data.media_manifest.camera_pack_binding.sha256 === sourceHashes.camera_pack_sha256, "media source manifest hash binding mismatch");
  const placementBindings = data.furniture_manifest.placements.map((placement) => ({ placement_id: placement.placement_id, source_lane: placement.source_lane, product_twin_id: placement.product_twin_id, design_asset_id: placement.design_asset_id, translation_m: placement.transform.translation_m, rotation_y_rad: placement.transform.rotation_y_rad, scale: placement.transform.scale, asset_uri: placement.asset.uri, asset_revision: placement.asset.revision, asset_sha256: placement.asset.sha256, geometry_level: placement.asset.geometry_level, appearance_level: placement.asset.appearance_level, rights_publication_state: placement.rights.public_publication }));
  const placementSetSha = digest(Buffer.from(JSON.stringify(placementBindings)));
  assert(JSON.stringify(data.media_manifest.placement_bindings) === JSON.stringify(placementBindings) && data.media_manifest.placement_set_sha256 === placementSetSha, "media placement-set binding mismatch");

  assert(data.media_manifest.governance_bindings.length === 5 && new Set(data.media_manifest.governance_bindings.map((binding) => binding.role)).size === 5, "governance binding coverage mismatch");
  for (const binding of data.media_manifest.governance_bindings) {
    const expected = GOVERNANCE.get(binding.role);
    assert(Boolean(expected) && binding.commit === expected[0] && binding.path === expected[1] && binding.git_blob_oid === expected[2] && binding.sha256 === expected[3], `governance binding mismatch: ${binding.role}`);
    try {
      const bytes = execFileSync("git", ["show", `${binding.commit}:${binding.path}`], { cwd: root, stdio: ["ignore", "pipe", "ignore"] });
      const blob = execFileSync("git", ["rev-parse", `${binding.commit}:${binding.path}`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      assert(digest(bytes) === binding.sha256 && blob === binding.git_blob_oid, `governance object verification failed: ${binding.role}`);
    } catch {
      assert(false, `governance object unavailable: ${binding.role}`);
    }
  }

  const alphaRunnerBytes = Buffer.concat(await Promise.all([readFile(path.join(root, "scripts/render-living-room-alpha.mjs")), readFile(path.join(root, "scripts/media/living-room-alpha-renderer-browser.mjs"))]));
  const alphaRunnerSha = digest(alphaRunnerBytes);
  assert(data.render_environment.schema_version === MANIFEST_REVISION && data.render_environment.runner_version === "LIVING_ROOM_ALPHA_RENDERER_V1" && data.render_environment.runner_sha256 === alphaRunnerSha, "alpha runner source binding mismatch");
  assert(jsonEqual(data.render_environment.environment, EXPECTED_ENVIRONMENT), "alpha render environment mismatch");
  assert(data.native_run.schema_version === MANIFEST_REVISION && data.native_run.run_id === "LIVING_ROOM_ALPHA_NATIVE_STILLS_RUN_V0_1" && data.native_run.runner_sha256 === alphaRunnerSha && data.native_run.runner_version === "LIVING_ROOM_ALPHA_RENDERER_V1" && data.native_run.network_policy === "LOOPBACK_ONLY" && data.native_run.cost_usd === 0 && data.native_run.deterministic_duplicate_pass === true, "alpha native run metadata mismatch");
  assert(jsonEqual(data.native_run.environment, EXPECTED_ENVIRONMENT) && jsonEqual(data.native_run.environment, data.render_environment.environment), "alpha native environment mismatch");
  assert(data.native_run.outputs.length === 2 && new Set(data.native_run.outputs.map((output) => output.camera_id)).size === 2, "alpha native run must contain two unique outputs");
  const expectedVisible = new Map([["CAM_ROOM_ALPHA_CLEARANCE_V0_1", ["kivik-placement-01", "listerby-placement-01"]], ["CAM_ROOM_ALPHA_SELECTED_KIVIK_V0_1", ["kivik-placement-01"]]]);
  for (const runOutput of data.native_run.outputs) {
    const expected = EXPECTED_OUTPUTS.get(runOutput.camera_id);
    assert(expected?.native === true && runOutput.role === expected?.evidence_role && runOutput.visibility_policy === cameraById.get(runOutput.camera_id)?.visibility_policy && runOutput.uri === expected?.uri, `native output identity mismatch: ${runOutput.camera_id}`);
    assert(jsonEqual(runOutput.visible_placement_ids, expectedVisible.get(runOutput.camera_id)), `native visibility audit mismatch: ${runOutput.camera_id}`);
    assert(runOutput.sha256 === expected?.sha256 && runOutput.sha256 === runOutput.duplicate_render_sha256 && runOutput.bytes === expected?.bytes && jsonEqual(runOutput.dimensions_px, expected?.dimensions_px) && runOutput.camera_collision.pass === true && jsonEqual(runOutput.camera_collision.inside_placement_ids, []), `native duplicate/camera audit mismatch: ${runOutput.camera_id}`);
    try {
      const bytes = await readFile(path.join(root, expected.uri));
      const dimensions = pngDimensions(bytes);
      assert(digest(bytes) === runOutput.sha256 && bytes.length === runOutput.bytes && jsonEqual(dimensions, runOutput.dimensions_px), `native artifact binding mismatch: ${runOutput.camera_id}`);
    } catch {
      assert(false, `native artifact binding mismatch: ${runOutput.camera_id}`);
    }
    const auditByPlacement = new Map(runOutput.audit.placements.map((placement) => [placement.placement_id, placement]));
    let exactAudit = auditByPlacement.size === 8 && runOutput.audit.placements.length === 8;
    for (const [placementId, expectedPlacement] of EXPECTED_PLACEMENTS) {
      const auditPlacement = auditByPlacement.get(placementId);
      exactAudit &&= auditPlacement?.twin_ref === expectedPlacement[1] && close(auditPlacement?.rotation_y_rad, expectedPlacement[6], 1e-9) && vectorsEqual(auditPlacement?.bounds_centre_xz_m, [expectedPlacement[5][0], expectedPlacement[5][2]], 1e-9) && close(auditPlacement?.bounds_min_y_m, expectedPlacement[5][1], 1e-9) && vectorsEqual(auditPlacement?.expected_translation_m, expectedPlacement[5], 1e-9) && auditPlacement?.geometry_and_material_unchanged === true;
    }
    assert(runOutput.audit.pass === true && runOutput.audit.placement_count === 8 && runOutput.audit.unique_twin_count === 8 && exactAudit && jsonEqual(runOutput.audit.shell_dimensions_m, [6, 4.6, 2.8]) && runOutput.audit.authoritative_opening_count === 0 && runOutput.audit.assumed_overlay_count === 1 && jsonEqual(Object.keys(runOutput.audit.mutation_counts).sort(), ["geometry", "light", "material", "placement"]) && Object.values(runOutput.audit.mutation_counts).every((value) => value === 0), `native scene audit mismatch: ${runOutput.camera_id}`);
  }

  assert(data.reused_run.schema_version === MANIFEST_REVISION && data.reused_run.run_id === "ROOM_LAB_STILLS_RUN_V1" && data.reused_run.runner_version === "ROOM_LAB_MEDIA_RUNNER_V1" && data.reused_run.runner_sha256 === REUSED_RUNNER_SHA256 && data.reused_run.deterministic_duplicate_pass === true && data.reused_run.network_policy === "LOOPBACK_ONLY" && data.reused_run.cost_usd === 0 && jsonEqual(data.reused_run.environment, EXPECTED_ENVIRONMENT), "reused still-run metadata mismatch");
  for (const [cameraId, expected] of EXPECTED_OUTPUTS) {
    if (expected.native) continue;
    const evidence = data.reused_run.outputs.find((output) => output.output_asset_id === expected.evidence_id);
    assert(evidence?.shot_id === EXPECTED_CAMERA_DETAILS.get(cameraId).source_shot_id && evidence?.role === expected.evidence_role && evidence?.uri === expected.source_uri && evidence?.sha256 === expected.sha256 && evidence?.duplicate_render_sha256 === expected.sha256 && evidence?.bytes === expected.bytes && jsonEqual(evidence?.dimensions_px, expected.dimensions_px) && evidence?.audit.pass === true, `reused output evidence mismatch: ${cameraId}`);
  }

  const classByName = new Map(data.media_manifest.output_classes.map((entry) => [entry.class, entry]));
  assert(classByName.size === 2 && jsonEqual(classByName.get("VERIFICATION_RENDER"), { class: "VERIFICATION_RENDER", state: "AVAILABLE_INTERNAL_QA", allowed_channel: "INTERNAL_QA", visible_disclosure_required: false, description: "Neutral, repeatable local renders for geometry, scale, orientation, contact, collision, clearance and visual-defect review." }) && jsonEqual(classByName.get("CONCEPT_MARKETING_RENDER"), { class: "CONCEPT_MARKETING_RENDER", state: "BLOCKED_RIGHTS", allowed_channel: "NONE", visible_disclosure_required: true, description: "Presentation imagery remains unrendered until appearance, derivative and publication rights permit the target channel." }), "output classes must remain strictly separated");
  const verificationOutputs = data.media_manifest.outputs.filter((output) => output.output_class === "VERIFICATION_RENDER");
  const conceptOutputs = data.media_manifest.outputs.filter((output) => output.output_class === "CONCEPT_MARKETING_RENDER");
  assert(verificationOutputs.length === 6 && conceptOutputs.length === 1, "manifest must contain six verification outputs and one blocked concept output");
  assert(new Set(data.media_manifest.outputs.map((output) => output.output_id)).size === 7 && new Set(verificationOutputs.map((output) => output.media.uri)).size === 6 && new Set(verificationOutputs.map((output) => output.media.sha256)).size === 6, "output IDs and media mappings must be unique");
  assert(new Set(verificationOutputs.map((output) => output.camera_id)).size === 6 && verificationOutputs.every((output) => cameraById.has(output.camera_id)), "verification output camera coverage mismatch");
  for (const output of verificationOutputs) {
    const expected = EXPECTED_OUTPUTS.get(output.camera_id);
    assert(output.output_id === expected?.output_id && output.status === "AVAILABLE_INTERNAL_QA" && output.publication_state === "INTERNAL_QA_ONLY" && output.media.uri === expected?.uri && output.media.sha256 === expected?.sha256 && output.media.bytes === expected?.bytes && jsonEqual(output.media.dimensions_px, expected?.dimensions_px), `verification output identity/evidence mismatch: ${output.output_id}`);
    assert(JSON.stringify(output.input_bindings) === JSON.stringify(sourceHashes) && output.placement_set_sha256 === placementSetSha && JSON.stringify(output.placement_ids) === JSON.stringify([...EXPECTED_PLACEMENTS.keys()]), `output source/placement binding mismatch: ${output.output_id}`);
    assert(output.render_method.method === "LOCAL_DETERMINISTIC_3D" && output.render_method.engine === "THREE_WEBGL" && output.render_method.engine_version === "0.185.0" && output.render_method.model === null && output.render_method.settings.network_policy === "LOOPBACK_ONLY" && output.render_method.settings.environment_id === "VERIFICATION_FROZEN_ROOM_LAB_V9", `verification render method mismatch: ${output.output_id}`);
    assert(output.cost.expected === 0 && output.cost.actual === 0 && output.generation_date === "2026-08-17" && output.rights_publication_state === "REVIEW", `verification cost/date/rights mismatch: ${output.output_id}`);
    assert(output.disclosure.class === "G2_INTERNAL_QA_METADATA" && output.disclosure.visible_in_frame === false && output.disclosure.text === VERIFICATION_DISCLOSURE && jsonEqual(output.blockers, []), `verification disclosure mismatch: ${output.output_id}`);
    try {
      const bytes = await readFile(path.join(root, output.media.uri));
      const dimensions = pngDimensions(bytes);
      assert(digest(bytes) === output.media.sha256 && bytes.length === output.media.bytes, `verification output hash/bytes mismatch: ${output.output_id}`);
      assert(dimensions?.width === output.media.dimensions_px.width && dimensions?.height === output.media.dimensions_px.height, `verification output dimensions mismatch: ${output.output_id}`);
    } catch {
      assert(false, `verification output missing: ${output.output_id}`);
    }
    const expectedRunner = expected.native ? alphaRunnerSha : REUSED_RUNNER_SHA256;
    const expectedRunnerVersion = expected.native ? "LIVING_ROOM_ALPHA_RENDERER_V1" : "ROOM_LAB_MEDIA_RUNNER_V1";
    assert(output.render_method.runner_sha256 === expectedRunner && output.render_method.runner_version === expectedRunnerVersion, `verification runner binding mismatch: ${output.output_id}`);
    const evidence = expected.native ? data.native_run.outputs.find((entry) => entry.camera_id === output.camera_id) : data.reused_run.outputs.find((entry) => entry.output_asset_id === expected.evidence_id);
    assert(evidence?.sha256 === output.media.sha256 && evidence?.bytes === output.media.bytes && jsonEqual(evidence?.dimensions_px, output.media.dimensions_px), `output/run cross-binding mismatch: ${output.output_id}`);
  }
  const concept = conceptOutputs[0];
  assert(concept?.output_id === "OUTPUT_ROOM_ALPHA_CONCEPT_HERO_V0_1" && concept?.camera_id === "CAM_ROOM_ALPHA_HERO_V0_1" && concept?.status === "BLOCKED_RIGHTS" && concept?.publication_state === "BLOCKED_RIGHTS" && concept?.media.uri === null && concept?.media.sha256 === null && concept?.media.bytes === null && concept?.media.dimensions_px === null && concept?.generation_date === null && jsonEqual(concept?.blockers, CONCEPT_BLOCKERS), "concept marketing output must remain unrendered and rights-blocked");
  assert(concept?.disclosure.class === "G2_VISIBLE_APPROXIMATION_REQUIRED" && concept?.disclosure.visible_in_frame === false && concept?.disclosure.text === CONCEPT_DISCLOSURE, "concept disclosure state mismatch");
  assert(jsonEqual(concept?.input_bindings, sourceHashes) && concept?.placement_set_sha256 === placementSetSha && jsonEqual(concept?.placement_ids, [...EXPECTED_PLACEMENTS.keys()]), "concept source/placement binding mismatch");
  assert(data.media_manifest.cost_summary.expected === 0 && data.media_manifest.cost_summary.actual === 0 && data.media_manifest.cost_summary.provider_calls === 0, "alpha cost/provider summary mismatch");

  const contact = data.media_manifest.contact_sheet;
  assert(contact.artifact_id === "CONTACT_SHEET_LIVING_ROOM_ALPHA_V0_1" && contact.uri === `${MEDIA_DIR}/outputs/verification-contact-sheet.png` && contact.method === "FFMPEG_XSTACK_3X2_V0_1" && contact.cost.currency === "USD" && contact.cost.expected === 0 && contact.cost.actual === 0 && JSON.stringify(contact.tile_order) === JSON.stringify([...EXPECTED_CAMERAS.keys()]) && contact.input_sha256.length === 6, "contact-sheet camera order/identity mismatch");
  try {
    const bytes = await readFile(path.join(root, contact.uri));
    const dimensions = pngDimensions(bytes);
    assert(digest(bytes) === contact.sha256 && bytes.length === contact.bytes && dimensions?.width === 2400 && dimensions?.height === 1200 && contact.deterministic_duplicate_pass === true, "contact-sheet artifact mismatch");
  } catch {
    assert(false, "contact-sheet artifact missing");
  }
  const verificationByCamera = new Map(verificationOutputs.map((output) => [output.camera_id, output]));
  assert(JSON.stringify(contact.input_sha256) === JSON.stringify(contact.tile_order.map((cameraId) => verificationByCamera.get(cameraId)?.media.sha256)), "contact-sheet input hash order mismatch");

  assert(jsonEqual(data.media_manifest.avatar_manifest_adapter, EXPECTED_MEDIA_ADAPTER), "future avatar manifest adapter policy mismatch");
  try {
    await access(path.join(root, data.media_manifest.avatar_manifest_adapter.expected_uri));
    assert(false, "future avatar manifest exists but is not validated/activated");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const review = data.media_manifest.verification_handoff;
  assert(review.owner === "VISUAL_MEDIA" && review.executor_id === "CODEX_PRIMARY_EXECUTOR" && review.reviewer_role === "VERIFICATION" && review.package_uri === "docs/handoffs/LIVING-ROOM-ALPHA-VERIFICATION.md" && jsonEqual(review.required_commands, ["node scripts/test-living-room-alpha.mjs", "node scripts/validate-living-room-alpha.mjs", "git diff --check"]), "Verification handoff identity mismatch");
  if (review.review_state === "PENDING") assert(review.reviewer_id === null && data.media_manifest.status === "REVIEW_PENDING", "pending Verification state/status mismatch");
  if (review.review_state === "APPROVED") assert(data.media_manifest.status === "VERIFIED_INTERNAL_QA" && typeof review.reviewer_id === "string" && review.reviewer_id.trim().length > 0 && review.reviewer_id.trim() !== review.executor_id.trim(), "approved Verification reviewer/status must be independent");
  if (review.review_state === "REJECTED") assert(data.media_manifest.status === "BLOCKED" && typeof review.reviewer_id === "string" && review.reviewer_id.trim().length > 0 && review.reviewer_id.trim() !== review.executor_id.trim(), "rejected Verification reviewer/status must be independent");
  if (review.reviewer_id !== null) assert(review.reviewer_id.trim() !== review.executor_id.trim(), "Verification reviewer must differ from executor");
  assert(jsonEqual(data.media_manifest.blockers, GLOBAL_BLOCKERS), "global blocker set mismatch");

  return { ok: errors.length === 0, errors, checked_cameras: data.camera_pack.cameras.length, checked_placements: data.furniture_manifest.placements.length, checked_outputs: data.media_manifest.outputs.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await validateLivingRoomAlpha();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}
