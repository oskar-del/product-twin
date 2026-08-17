#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { copyFile, mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const MEDIA_DIR = "data/media/room-alpha/v0.1";
const OUTPUT_DIR = `${MEDIA_DIR}/outputs`;
const FFMPEG = "/opt/homebrew/bin/ffmpeg";
const FFMPEG_SHA256 = "882dc3dcaabd4262465def19f4eb0a2968f23ab9bbaeb8f2566a61c603e4ed43";
const GENERATION_DATE = "2026-08-17";

const GOVERNANCE_BINDINGS = [
  { role: "BRAIN_CONTROL_BOARD", repository: "oskar-del/product-twin", commit: "ef1d52d53aa4d6c3b8cbd5f99c456c5d219a1a4c", path: "data/dashboard/project-control.json", git_blob_oid: "03b70508e3db9897263647f6ea24c3dfeb0124c7", sha256: "f5850d8ed3df1db60d1708e6492cc9513c7c34fbebb950d14b70a8d2126049c5" },
  { role: "PERSISTENT_CHAT_TOPOLOGY", repository: "oskar-del/product-twin", commit: "ef1d52d53aa4d6c3b8cbd5f99c456c5d219a1a4c", path: "docs/PERSISTENT-CHAT-TOPOLOGY.md", git_blob_oid: "69e07eb135371ee6192f4cfa2ba59d7f5d8d32c9", sha256: "48c334e96a9a437547e69f22503ee7d358d358ad14259a55d018430f243ecec4" },
  { role: "ROOM_LAB_HANDOFF", repository: "oskar-del/product-twin", commit: "eb02c51ef35fec438ef3f0da29b5a39b43ed7791", path: "docs/handoffs/ROOM-LAB.md", git_blob_oid: "a1e11f16db199526038dc57faa95e518a3f2b31b", sha256: "1b94bd57e0e514581cd3a9700beb328739f9f0baeff7916962ea3fee71af8419" },
  { role: "AVATAR_FACTORY_HANDOFF", repository: "oskar-del/product-twin", commit: "2a959d4f8e270d150b74e3f43daf624a4ed06c9c", path: "docs/handoffs/AVATAR-FACTORY.md", git_blob_oid: "413602ec2d057fbe284db3a9461f075c10acb3a5", sha256: "de53069107ac988e5bee22436acd488b2fe1c56c3d018a77993562c7ca3b581c" },
  { role: "VERIFICATION_HANDOFF", repository: "oskar-del/product-twin", commit: "d2687728ac5383bd9b621dfc354c0b53dec8929c", path: "docs/handoffs/VERIFICATION-EVIDENCE-MONITORING.md", git_blob_oid: "30074faf665aa51db09cc7bc0dfad585b9a3ac12", sha256: "6795fc1940b5777ed7cf2ef0b09e1668f852b3bf365e105c64e91356846d2614" }
];

const REUSED = [
  { camera_id: "CAM_ROOM_ALPHA_TOP_PLAN_V0_1", output_id: "OUTPUT_ROOM_ALPHA_TOP_PLAN_V0_1", source: "data/media/room-lab/v0.1/outputs/room-qa-top.png", target: `${OUTPUT_DIR}/verification/top-plan.png`, expected_sha256: "421bd408aac3154f8bdd6c67c3b4f00f113d3d1940c6a74277df4fd2b63adbd7" },
  { camera_id: "CAM_ROOM_ALPHA_WIDE_V0_1", output_id: "OUTPUT_ROOM_ALPHA_WIDE_V0_1", source: "data/media/room-lab/v0.1/outputs/room-qa-front.png", target: `${OUTPUT_DIR}/verification/wide-room.png`, expected_sha256: "3f2c266359cf0182e7f8ef45b73eaef3153072e4dda5f77748f4cdaea5de94db" },
  { camera_id: "CAM_ROOM_ALPHA_SEATING_V0_1", output_id: "OUTPUT_ROOM_ALPHA_SEATING_V0_1", source: "data/media/room-lab/v0.1/outputs/room-qa-low-eye.png", target: `${OUTPUT_DIR}/verification/seating-relationship.png`, expected_sha256: "323784e3a5af8f24fc64c1df80e00e60c5ef660b183ed2e4b6f46feef6dbdd06" },
  { camera_id: "CAM_ROOM_ALPHA_HERO_V0_1", output_id: "OUTPUT_ROOM_ALPHA_HERO_V0_1", source: "data/media/room-lab/v0.1/outputs/room-hero.png", target: `${OUTPUT_DIR}/verification/hero-composition.png`, expected_sha256: "951f5f4e2b569df08d8cee9211ccbf35bc8555ff1cd0b385622f8539d06a4042" }
];

const NATIVE = [
  { camera_id: "CAM_ROOM_ALPHA_CLEARANCE_V0_1", output_id: "OUTPUT_ROOM_ALPHA_CLEARANCE_V0_1", target: `${OUTPUT_DIR}/verification/side-clearance.png` },
  { camera_id: "CAM_ROOM_ALPHA_SELECTED_KIVIK_V0_1", output_id: "OUTPUT_ROOM_ALPHA_SELECTED_KIVIK_V0_1", target: `${OUTPUT_DIR}/verification/selected-kivik.png` }
];

const TILE_ORDER = [
  "CAM_ROOM_ALPHA_TOP_PLAN_V0_1",
  "CAM_ROOM_ALPHA_WIDE_V0_1",
  "CAM_ROOM_ALPHA_SEATING_V0_1",
  "CAM_ROOM_ALPHA_CLEARANCE_V0_1",
  "CAM_ROOM_ALPHA_SELECTED_KIVIK_V0_1",
  "CAM_ROOM_ALPHA_HERO_V0_1"
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(ROOT, relativePath), "utf8"));
}

function pngDimensions(bytes) {
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || bytes.toString("ascii", 12, 16) !== "IHDR") throw new Error("Invalid PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function command(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve(Buffer.concat(stdout).toString("utf8")) : reject(new Error(`${command} exited ${code}: ${Buffer.concat(stderr).toString("utf8")}`)));
  });
}

async function buildContactSheet(inputPaths, outputPath) {
  if (sha256(await readFile(FFMPEG)) !== FFMPEG_SHA256) throw new Error("ffmpeg hash mismatch");
  const firstLine = (await command(FFMPEG, ["-version"])).split("\n")[0];
  if (!firstLine.startsWith("ffmpeg version 8.1.2")) throw new Error("ffmpeg version mismatch");
  const temp = await mkdtemp(path.join(os.tmpdir(), "living-room-alpha-contact-"));
  try {
    const first = path.join(temp, "contact-a.png");
    const second = path.join(temp, "contact-b.png");
    const filters = inputPaths.map((_, index) => `[${index}:v]scale=800:500:force_original_aspect_ratio=decrease,pad=800:600:(ow-iw)/2:(oh-ih)/2:color=0xe9e6dc[v${index}]`).join(";");
    const stack = `[v0][v1][v2][v3][v4][v5]xstack=inputs=6:layout=0_0|800_0|1600_0|0_600|800_600|1600_600[out]`;
    const baseArgs = ["-hide_banner", "-loglevel", "error", "-y", ...inputPaths.flatMap((input) => ["-i", input]), "-filter_complex", `${filters};${stack}`, "-map", "[out]", "-frames:v", "1", "-threads", "1", "-map_metadata", "-1"];
    await command(FFMPEG, [...baseArgs, first]);
    await command(FFMPEG, [...baseArgs, second]);
    const firstBytes = await readFile(first);
    const secondBytes = await readFile(second);
    if (sha256(firstBytes) !== sha256(secondBytes)) throw new Error("Contact-sheet duplicate render mismatch");
    await writeFile(outputPath, firstBytes);
    return { bytes: firstBytes, sha256: sha256(firstBytes), dimensions_px: pngDimensions(firstBytes), deterministic_duplicate_pass: true };
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

export async function buildLivingRoomAlphaPack() {
  await mkdir(path.join(ROOT, OUTPUT_DIR, "verification"), { recursive: true });
  const [room, furniture, market, cameraPack, nativeRun, nativeEnvironment] = await Promise.all([
    readJson(`${MEDIA_DIR}/room-manifest.json`),
    readJson(`${MEDIA_DIR}/furniture-manifest.json`),
    readJson(`${MEDIA_DIR}/es-29660-manifest.json`),
    readJson(`${MEDIA_DIR}/camera-pack.json`),
    readJson(`${OUTPUT_DIR}/alpha-native-stills-run.json`),
    readJson(`${MEDIA_DIR}/render-environment.json`)
  ]);

  for (const entry of REUSED) {
    const sourceBytes = await readFile(path.join(ROOT, entry.source));
    if (sha256(sourceBytes) !== entry.expected_sha256) throw new Error(`Reused source hash mismatch: ${entry.source}`);
    await copyFile(path.join(ROOT, entry.source), path.join(ROOT, entry.target));
  }

  const allSpecs = [...REUSED, ...NATIVE];
  const cameraById = new Map(cameraPack.cameras.map((camera) => [camera.camera_id, camera]));
  const outputRecords = [];
  const placementBindings = furniture.placements.map((placement) => ({
    placement_id: placement.placement_id,
    source_lane: placement.source_lane,
    product_twin_id: placement.product_twin_id,
    design_asset_id: placement.design_asset_id,
    translation_m: placement.transform.translation_m,
    rotation_y_rad: placement.transform.rotation_y_rad,
    scale: placement.transform.scale,
    asset_uri: placement.asset.uri,
    asset_revision: placement.asset.revision,
    asset_sha256: placement.asset.sha256,
    geometry_level: placement.asset.geometry_level,
    appearance_level: placement.asset.appearance_level,
    rights_publication_state: placement.rights.public_publication
  }));
  const placementSetSha256 = sha256(Buffer.from(JSON.stringify(placementBindings)));
  const sourceHashes = {
    room_manifest_sha256: sha256(await readFile(path.join(ROOT, `${MEDIA_DIR}/room-manifest.json`))),
    furniture_manifest_sha256: sha256(await readFile(path.join(ROOT, `${MEDIA_DIR}/furniture-manifest.json`))),
    market_manifest_sha256: sha256(await readFile(path.join(ROOT, `${MEDIA_DIR}/es-29660-manifest.json`))),
    camera_pack_sha256: sha256(await readFile(path.join(ROOT, `${MEDIA_DIR}/camera-pack.json`)))
  };
  const placementIds = placementBindings.map((placement) => placement.placement_id);

  for (const spec of allSpecs) {
    const camera = cameraById.get(spec.camera_id);
    if (!camera) throw new Error(`Unknown camera ${spec.camera_id}`);
    const bytes = await readFile(path.join(ROOT, spec.target));
    const dimensions = pngDimensions(bytes);
    if (dimensions.width !== camera.resolution_px.width || dimensions.height !== camera.resolution_px.height) throw new Error(`Output dimensions mismatch: ${spec.target}`);
    const native = NATIVE.includes(spec);
    const nativeEvidence = nativeRun.outputs.find((record) => record.camera_id === spec.camera_id);
    if (native && (!nativeEvidence || nativeEvidence.sha256 !== sha256(bytes) || nativeEvidence.duplicate_render_sha256 !== nativeEvidence.sha256)) throw new Error(`Native run evidence mismatch: ${spec.camera_id}`);
    outputRecords.push({
      output_id: spec.output_id,
      output_class: "VERIFICATION_RENDER",
      status: "AVAILABLE_INTERNAL_QA",
      camera_id: spec.camera_id,
      input_bindings: sourceHashes,
      placement_ids: placementIds,
      placement_set_sha256: placementSetSha256,
      source_lane_summary: { PRODUCT_TWIN: 8, DESIGN_ASSET: 0 },
      geometry_level: "G2_PLANNING_PROXY",
      appearance_level: "A1_CUE_ONLY_NO_EXACT_TEXTURE",
      rights_publication_state: "REVIEW",
      render_method: {
        method: "LOCAL_DETERMINISTIC_3D",
        engine: "THREE_WEBGL",
        engine_version: "0.185.0",
        model: null,
        runner_version: native ? nativeEnvironment.runner_version : "ROOM_LAB_MEDIA_RUNNER_V1",
        runner_sha256: native ? nativeEnvironment.runner_sha256 : "89efdfcf586a7cdd5bff0fbdb3a07316d45cd9fb6bf78a4d434a364b97054131",
        settings: { pixel_ratio: 1, colour_space: "SRGB", tone_mapping: "ACES_FILMIC", exposure: 1.18, shadow_map: "PCF_SOFT", environment_id: "VERIFICATION_FROZEN_ROOM_LAB_V9", network_policy: "LOOPBACK_ONLY" }
      },
      media: { uri: spec.target, sha256: sha256(bytes), bytes: bytes.length, media_type: "image/png", dimensions_px: dimensions },
      disclosure: { class: "G2_INTERNAL_QA_METADATA", visible_in_frame: false, text: "Internal verification visual using verified-scale G2 planning proxies; no exact product texture, finish, surveyed room, opening or publication claim." },
      generation_date: GENERATION_DATE,
      cost: { currency: "USD", expected: 0, actual: 0 },
      publication_state: "INTERNAL_QA_ONLY",
      blockers: []
    });
  }

  outputRecords.push({
    output_id: "OUTPUT_ROOM_ALPHA_CONCEPT_HERO_V0_1",
    output_class: "CONCEPT_MARKETING_RENDER",
    status: "BLOCKED_RIGHTS",
    camera_id: "CAM_ROOM_ALPHA_HERO_V0_1",
    input_bindings: sourceHashes,
    placement_ids: placementIds,
    placement_set_sha256: placementSetSha256,
    source_lane_summary: { PRODUCT_TWIN: 8, DESIGN_ASSET: 0 },
    geometry_level: "G2_PLANNING_PROXY",
    appearance_level: "A1_CUE_ONLY_NO_EXACT_TEXTURE",
    rights_publication_state: "REVIEW",
    render_method: { method: "PLANNED_LOCAL_DETERMINISTIC_3D", engine: "THREE_WEBGL", engine_version: "0.185.0", model: null, runner_version: nativeEnvironment.runner_version, runner_sha256: nativeEnvironment.runner_sha256, settings: { pixel_ratio: 1, colour_space: "SRGB", tone_mapping: "ACES_FILMIC", exposure: 1.18, shadow_map: "PCF_SOFT", environment_id: "VERIFICATION_FROZEN_ROOM_LAB_V9", network_policy: "LOOPBACK_ONLY" } },
    media: { uri: null, sha256: null, bytes: null, media_type: "image/png", dimensions_px: null },
    disclosure: { class: "G2_VISIBLE_APPROXIMATION_REQUIRED", visible_in_frame: false, text: "Concept visual using approximate G2 planning proxies and an assumed room; exact products, finishes, textures and surveyed geometry are not claimed." },
    generation_date: null,
    cost: { currency: "USD", expected: 0, actual: 0 },
    publication_state: "BLOCKED_RIGHTS",
    blockers: ["public publication rights are REVIEW", "derivative rights are REVIEW", "provider-processing rights are REVIEW", "redistribution is NO", "independent rights reviewer is absent", "visible approximation disclosure is not rendered"]
  });

  const availableByCamera = new Map(outputRecords.filter((output) => output.status === "AVAILABLE_INTERNAL_QA").map((output) => [output.camera_id, output]));
  const contactInputs = TILE_ORDER.map((cameraId) => path.join(ROOT, availableByCamera.get(cameraId).media.uri));
  const contact = await buildContactSheet(contactInputs, path.join(ROOT, `${OUTPUT_DIR}/verification-contact-sheet.png`));

  const manifest = {
    schema_version: "0.1.0",
    media_manifest_id: "MEDIA_MANIFEST_LIVING_ROOM_ALPHA_V0_1",
    revision: "0.1.0",
    status: "REVIEW_PENDING",
    generation_date: GENERATION_DATE,
    governance_bindings: GOVERNANCE_BINDINGS,
    source_bindings: {
      room: { manifest_id: room.room_manifest_id, revision: room.revision, uri: `${MEDIA_DIR}/room-manifest.json`, sha256: sourceHashes.room_manifest_sha256 },
      furniture: { manifest_id: furniture.furniture_manifest_id, revision: furniture.revision, uri: `${MEDIA_DIR}/furniture-manifest.json`, sha256: sourceHashes.furniture_manifest_sha256 },
      market: { manifest_id: market.market_manifest_id, revision: market.revision, uri: `${MEDIA_DIR}/es-29660-manifest.json`, sha256: sourceHashes.market_manifest_sha256 }
    },
    camera_pack_binding: { manifest_id: cameraPack.camera_pack_id, revision: cameraPack.revision, uri: `${MEDIA_DIR}/camera-pack.json`, sha256: sourceHashes.camera_pack_sha256 },
    placement_bindings: placementBindings,
    placement_set_sha256: placementSetSha256,
    output_classes: [
      { class: "VERIFICATION_RENDER", state: "AVAILABLE_INTERNAL_QA", allowed_channel: "INTERNAL_QA", visible_disclosure_required: false, description: "Neutral, repeatable local renders for geometry, scale, orientation, contact, collision, clearance and visual-defect review." },
      { class: "CONCEPT_MARKETING_RENDER", state: "BLOCKED_RIGHTS", allowed_channel: "NONE", visible_disclosure_required: true, description: "Presentation imagery remains unrendered until appearance, derivative and publication rights permit the target channel." }
    ],
    outputs: outputRecords,
    contact_sheet: { artifact_id: "CONTACT_SHEET_LIVING_ROOM_ALPHA_V0_1", uri: `${OUTPUT_DIR}/verification-contact-sheet.png`, sha256: contact.sha256, bytes: contact.bytes.length, dimensions_px: contact.dimensions_px, tile_order: TILE_ORDER, input_sha256: TILE_ORDER.map((cameraId) => availableByCamera.get(cameraId).media.sha256), method: "FFMPEG_XSTACK_3X2_V0_1", deterministic_duplicate_pass: contact.deterministic_duplicate_pass, cost: { currency: "USD", expected: 0, actual: 0 } },
    cost_summary: { currency: "USD", expected: 0, actual: 0, provider_calls: 0 },
    avatar_manifest_adapter: { expected_manifest_id: "FURNITURE_AVATAR_MANIFEST_V0_1", expected_uri: "data/geometry/furniture-avatar-manifest-v0.1.json", state: "ABSENT_NOT_CONSUMED", active_adapter: "INLINE_FROZEN_SCENE_PLACEMENTS_V0_1", allowed_replacements: ["asset_uri", "asset_revision", "asset_sha256", "geometry_level", "appearance_level", "rights_ref"], forbidden_changes: ["camera", "scene", "placement_id", "transform", "product_twin_id", "source_lane"] },
    blockers: ["CONCEPT_MARKETING_RENDER rights and visible-disclosure gates are blocked", "furniture-avatar-manifest-v0.1 is absent and not consumed", "ES-29660 evidence is dated context only and must be refreshed before approval or purchase", "Room Lab integration requires Brain approval"],
    verification_handoff: { owner: "VISUAL_MEDIA", executor_id: "CODEX_PRIMARY_EXECUTOR", reviewer_role: "VERIFICATION", reviewer_id: null, review_state: "PENDING", package_uri: "docs/handoffs/LIVING-ROOM-ALPHA-VERIFICATION.md", required_commands: ["node scripts/test-living-room-alpha.mjs", "node scripts/validate-living-room-alpha.mjs", "git diff --check"] }
  };
  await writeFile(path.join(ROOT, `${MEDIA_DIR}/media-manifest.example.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = await buildLivingRoomAlphaPack();
  process.stdout.write(`${JSON.stringify({ ok: true, media_manifest_id: manifest.media_manifest_id, verification_outputs: 6, concept_outputs: 1, provider_cost_usd: 0 })}\n`);
}
