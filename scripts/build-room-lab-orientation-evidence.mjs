#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const TARGET = "data/media/room-lab/v0.1/orientation-evidence.json";

const ASSETS = [
  { twin_ref: "PT_IKEA_KIVIK_49440597", avatar_id: "AVATAR_IKEA_KIVIK_49440597_G2_SOFA_PROXY", asset_path: "data/geometry/avatars/ikea-kivik-49440597-g2-sofa-proxy.glb", mode: "LANDMARK_FRONT", front_axis: "-Z", landmarks: [["back_frame", "Z_POSITIVE"], ["seat_cushion_2", "Z_NEGATIVE"]] },
  { twin_ref: "PT_IKEA_POANG_39240787", avatar_id: "AVATAR_IKEA_POANG_39240787_G2_ARMCHAIR_PROXY", asset_path: "data/geometry/avatars/ikea-poang-39240787-g2-armchair-proxy.glb", mode: "LANDMARK_FRONT", front_axis: "-Z", landmarks: [["back_cushion", "Z_POSITIVE"], ["front_crossbar", "Z_NEGATIVE"]] },
  { twin_ref: "PT_IKEA_LISTERBY_30513904", avatar_id: "AVATAR_IKEA_LISTERBY_30513904_G2_COFFEE_TABLE_PROXY", asset_path: "data/geometry/avatars/ikea-listerby-30513904-g2-coffee-table-proxy.glb", mode: "TWO_FOLD_SYMMETRY", front_axis: "NOT_APPLICABLE", symmetry_class: "GEOMETRIC_C2", symmetry_tolerance_m: 1e-9, landmarks: [["front_rail", "HAS_OPPOSITE_Z", "rear_rail"], ["solid_oak_leg", "FOUR_QUADRANTS"]] },
  { twin_ref: "PT_IKEA_LOHALS_30511288", avatar_id: "AVATAR_IKEA_LOHALS_30511288_G2_RUG_PROXY", asset_path: "data/geometry/avatars/ikea-lohals-30511288-g2-rug-proxy.glb", mode: "TWO_FOLD_SYMMETRY", front_axis: "NOT_APPLICABLE", symmetry_class: "SEMANTIC_ENVELOPE_C2", symmetry_tolerance_m: 0.01, landmarks: [["jute_base", "LONG_AXIS_Z"], ["weft_cue_1", "HAS_OPPOSITE_Z", "weft_cue_43"]] },
  { twin_ref: "PT_IKEA_GLADOM_70578451", avatar_id: "AVATAR_IKEA_GLADOM_70578451_G2_TRAY_TABLE_PROXY", asset_path: "data/geometry/avatars/ikea-gladom-70578451-g2-tray-table-proxy.glb", mode: "FOUR_FOLD_SYMMETRY", front_axis: "NOT_APPLICABLE", symmetry_class: "NODE_TRANSFORM_C4", symmetry_tolerance_m: 1e-9, landmarks: [["removable_tray", "XZ_EQUAL"], ["lower_ring", "XZ_EQUAL"], ["slender_leg", "FOUR_QUADRANTS"]] },
  { twin_ref: "PT_IKEA_LAUTERS_30405042", avatar_id: "AVATAR_IKEA_LAUTERS_30405042_G2_FLOOR_LAMP_PROXY", asset_path: "data/geometry/avatars/ikea-lauters-30405042-g2-floor-lamp-proxy.glb", mode: "LANDMARK_FRONT", front_axis: "-Z", landmarks: [["rear_leg", "Z_POSITIVE"], ["shade", "CENTRED_XZ"]] },
  { twin_ref: "PT_IKEA_BESTA_89330691", avatar_id: "AVATAR_IKEA_BESTA_89330691_G2_MEDIA_UNIT_PROXY", asset_path: "data/geometry/avatars/ikea-besta-89330691-g2-media-unit-proxy.glb", mode: "LANDMARK_FRONT", front_axis: "-Z", landmarks: [["front_shadow", "Z_NEGATIVE"], ["front_1", "Z_NEGATIVE"]] },
  { twin_ref: "PT_IKEA_BILLY_00263850", avatar_id: "AVATAR_IKEA_BILLY_00263850_G2_BOOKCASE_PROXY", asset_path: "data/geometry/avatars/ikea-billy-00263850-g2-bookcase-proxy.glb", mode: "LANDMARK_FRONT", front_axis: "-Z", landmarks: [["back", "Z_POSITIVE"], ["shelf_1", "Z_ZERO"]] }
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseGlbJson(bytes) {
  if (bytes.toString("ascii", 0, 4) !== "glTF" || bytes.readUInt32LE(4) !== 2) throw new Error("Expected a GLB v2 asset");
  let offset = 12;
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "JSON") return JSON.parse(bytes.toString("utf8", offset + 8, offset + 8 + length).replace(/\0+$/u, ""));
    offset += 8 + length;
  }
  throw new Error("GLB JSON chunk missing");
}

async function parseGlbScene(bytes) {
  if (!globalThis.ProgressEvent) globalThis.ProgressEvent = class ProgressEvent {};
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(arrayBuffer, "", (gltf) => resolve(gltf.scene), reject));
}

function roundedVector(vector) {
  return vector.toArray().map((value) => Math.abs(value) < 1e-15 ? 0 : Number(value.toFixed(12)));
}

function nodesNamed(nodes, name) {
  return nodes.filter((node) => node.name === name);
}

function translation(node) {
  return node?.translation ?? [0, 0, 0];
}

function scale(node) {
  return node?.scale ?? [1, 1, 1];
}

function evaluateLandmark(nodes, rule) {
  const [name, check, peerName] = rule;
  const matches = nodesNamed(nodes, name);
  if (matches.length === 0) return { rule: rule.join(":"), pass: false, observed: "missing landmark" };
  let pass = false;
  let observed;
  if (check === "Z_POSITIVE") {
    observed = translation(matches[0])[2];
    pass = observed > 0;
  } else if (check === "Z_NEGATIVE") {
    observed = translation(matches[0])[2];
    pass = observed < 0;
  } else if (check === "Z_ZERO") {
    observed = translation(matches[0])[2];
    pass = Math.abs(observed) <= 1e-12;
  } else if (check === "CENTRED_XZ") {
    const [x, , z] = translation(matches[0]);
    observed = [x, z];
    pass = Math.abs(x) <= 1e-12 && Math.abs(z) <= 1e-12;
  } else if (check === "LONG_AXIS_Z") {
    const [x, , z] = scale(matches[0]);
    observed = [x, z];
    pass = z > x;
  } else if (check === "HAS_OPPOSITE_Z") {
    const peer = nodesNamed(nodes, peerName)[0];
    const z = translation(matches[0])[2];
    const peerZ = peer ? translation(peer)[2] : null;
    observed = [z, peerZ];
    pass = Boolean(peer) && Math.abs(z + peerZ) <= 1e-9;
  } else if (check === "XZ_EQUAL") {
    const [x, , z] = scale(matches[0]);
    observed = [x, z];
    pass = Math.abs(x - z) <= 1e-12;
  } else if (check === "FOUR_QUADRANTS") {
    const quadrants = new Set(matches.map((node) => {
      const [x, , z] = translation(node);
      return `${Math.sign(x)},${Math.sign(z)}`;
    }));
    observed = [...quadrants].sort();
    pass = ["-1,-1", "-1,1", "1,-1", "1,1"].every((entry) => quadrants.has(entry));
  }
  return { rule: rule.join(":"), pass, observed };
}

function rotationalNodeResidual(nodes, fold) {
  const angle = (Math.PI * 2) / fold;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const meshNodes = nodes.filter((node) => Number.isInteger(node.mesh));
  let maximum = 0;
  for (const node of meshNodes) {
    const [x, y, z] = translation(node);
    const rotated = [x * cosine + z * sine, y, -x * sine + z * cosine];
    const nodeScale = scale(node);
    const peers = meshNodes.filter((peer) => scale(peer).every((value, index) => Math.abs(value - nodeScale[index]) <= 1e-12));
    const residual = Math.min(...peers.map((peer) => {
      const peerTranslation = translation(peer);
      return Math.hypot(...rotated.map((value, index) => value - peerTranslation[index]));
    }));
    maximum = Math.max(maximum, residual);
  }
  return Number(maximum.toFixed(12));
}

export async function evaluateRoomLabOrientationEvidence(root = ROOT) {
  const builderBytes = await readFile(fileURLToPath(import.meta.url));
  const records = [];
  for (const asset of ASSETS) {
    const bytes = await readFile(path.join(root, asset.asset_path));
    const glb = parseGlbJson(bytes);
    const scene = await parseGlbScene(bytes);
    const bounds = new THREE.Box3().setFromObject(scene);
    const boundsSize = bounds.getSize(new THREE.Vector3());
    const twin = JSON.parse(await readFile(path.join(root, `data/twins/${asset.twin_ref}.json`), "utf8"));
    const twinQa = JSON.parse(await readFile(path.join(root, twin.geometry.qa_metric), "utf8"));
    const verifiedHeightM = twinQa.measured_xyz_mm.height / 1000;
    const nodes = glb.nodes ?? [];
    const landmark_checks = asset.landmarks.map((rule) => evaluateLandmark(nodes, rule));
    const symmetry_observed_max_residual_m = asset.symmetry_class ? rotationalNodeResidual(nodes, asset.mode === "FOUR_FOLD_SYMMETRY" ? 4 : 2) : null;
    const up_axis_checks = [
      { check_id: "FLOOR_ORIGIN_MIN_Y", pass: Math.abs(bounds.min.y) <= 1e-6, observed_m: Number(bounds.min.y.toFixed(12)), expected_m: 0, tolerance_m: 1e-6 },
      { check_id: "VERIFIED_HEIGHT", pass: Math.abs(boundsSize.y - verifiedHeightM) <= 1e-6, observed_m: Number(boundsSize.y.toFixed(12)), expected_m: Number(verifiedHeightM.toFixed(12)), tolerance_m: 1e-6 }
    ];
    records.push({
      twin_ref: asset.twin_ref,
      avatar_id: asset.avatar_id,
      asset_path: asset.asset_path,
      asset_sha256: sha256(bytes),
      glb_version: 2,
      glb_generator: glb.asset?.generator ?? null,
      bounds_m: { min: roundedVector(bounds.min), max: roundedVector(bounds.max), size: roundedVector(boundsSize) },
      verified_height_m: Number(verifiedHeightM.toFixed(12)),
      up_axis: "+Y",
      visual_front_axis: asset.front_axis,
      orientation_mode: asset.mode,
      symmetry_class: asset.symmetry_class ?? "DIRECTIONAL_LANDMARK",
      symmetry_tolerance_m: asset.symmetry_tolerance_m ?? null,
      symmetry_observed_max_residual_m,
      up_axis_checks,
      landmark_checks,
      automated_result: [...up_axis_checks, ...landmark_checks].every((check) => check.pass) && glb.asset?.generator === "Product Twin verified G2 builder" && (symmetry_observed_max_residual_m == null || symmetry_observed_max_residual_m <= asset.symmetry_tolerance_m) ? "PASS" : "FAIL"
    });
  }

  return {
    schema_version: "0.1.0",
    orientation_evidence_id: "ORIENTATION_ROOM_LAB_G2_V0_1",
    scene_id: "SCENE_ROOM_LAB_MARBELLA_LIVING_V0_1",
    method_version: "ROOM_LAB_ORIENTATION_EVALUATOR_V2",
    builder_sha256: sha256(builderBytes),
    method: "GLB v2 world-bounds, verified-height, JSON-node landmark and symmetry inspection; no vertex or source record is modified.",
    records,
    status: records.every((record) => record.automated_result === "PASS") ? "EVIDENCE_READY_PENDING_INDEPENDENT_VERIFICATION" : "FAIL",
    approval: {
      executor_id: "CODEX_PRIMARY_EXECUTOR",
      reviewer_role_required: "VERIFICATION",
      reviewer_id: null,
      state: "PENDING"
    }
  };
}

export async function buildRoomLabOrientationEvidence(root = ROOT) {
  const evidence = await evaluateRoomLabOrientationEvidence(root);
  await writeFile(path.join(root, TARGET), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return evidence;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const evidence = await buildRoomLabOrientationEvidence();
  process.stdout.write(`${JSON.stringify({ ok: evidence.status !== "FAIL", status: evidence.status, checked_assets: evidence.records.length })}\n`);
  if (evidence.status === "FAIL") process.exitCode = 1;
}
