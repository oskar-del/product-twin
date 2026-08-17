#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const MEDIA_DIR = "data/media/room-lab/v0.1";

const ARTIFACTS = [
  ["SCENE_MANIFEST", "scene-manifest.json"],
  ["CAMERA_PACK", "camera-shots.json"],
  ["STORYBOARD", "storyboard.json"],
  ["ORIENTATION_EVIDENCE", "orientation-evidence.json"],
  ["RIGHTS_DISCLOSURE", "rights-disclosure.json"],
  ["RENDER_JOBS", "render-jobs.json"],
  ["GENERATIVE_JOBS", "generative-jobs.json"],
  ["OUTPUT_ASSETS", "output-assets.json"],
  ["FIDELITY_QA", "fidelity-qa.json"],
  ["COST_RECORDS", "cost-records.json"],
  ["RENDER_ENVIRONMENT", "render-environment.json"],
  ["STILLS_RUN_EVIDENCE", "outputs/room-lab-stills-run.json"],
  ["VIDEO_RUN_EVIDENCE", "outputs/room-lab-video-run.json"]
];

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function buildRoomLabMediaManifest(root = ROOT) {
  const artifacts = [];
  for (const [kind, filename] of ARTIFACTS) {
    const relativePath = path.posix.join(MEDIA_DIR, filename);
    const bytes = await readFile(path.join(root, relativePath));
    artifacts.push({ kind, path: relativePath, sha256: sha256(bytes) });
  }

  const scene = JSON.parse(await readFile(path.join(root, MEDIA_DIR, "scene-manifest.json"), "utf8"));
  const orientation = JSON.parse(await readFile(path.join(root, MEDIA_DIR, "orientation-evidence.json"), "utf8"));
  const renderJobs = JSON.parse(await readFile(path.join(root, MEDIA_DIR, "render-jobs.json"), "utf8"));
  const outputs = JSON.parse(await readFile(path.join(root, MEDIA_DIR, "output-assets.json"), "utf8"));
  const qa = JSON.parse(await readFile(path.join(root, MEDIA_DIR, "fidelity-qa.json"), "utf8"));
  const localOutputIds = new Set(renderJobs.jobs.flatMap((job) => job.output_refs));
  const rendered = renderJobs.jobs.every((job) => job.status === "SUCCEEDED") && [...localOutputIds].every((outputId) => outputs.outputs.find((output) => output.output_asset_id === outputId)?.status === "SUCCEEDED");
  const orientationVerified = orientation.status === "VERIFIED" && orientation.approval.state === "APPROVED";
  const qaApproved = qa.status === "PASS" && qa.approval_state === "APPROVED";
  const state = rendered && orientationVerified ? (qaApproved ? "OUTPUTS_VERIFIED_PUBLICATION_RIGHTS_PENDING" : "OUTPUTS_RENDERED_QA_PENDING") : "CONTRACT_READY_OUTPUTS_PENDING";
  const blockers = [];
  if (!orientationVerified) blockers.push("bound G2 orientation QA is not independently verified");
  if (!rendered) blockers.push("deterministic direct-3D outputs are pending");
  if (!qaApproved) blockers.push("independent output fidelity Verification approval is pending");
  blockers.push("public-publication and redistribution rights remain unapproved");
  blockers.push("Room Lab integration requires an explicit follow-on approval");
  const manifest = {
    schema_version: "0.1.0",
    media_manifest_id: "MEDIA_MANIFEST_ROOM_LAB_V0_1",
    scene_id: scene.scene_id,
    generated_from_commit: scene.source.commit,
    artifacts,
    hero_output_id: null,
    release: {
      state,
      room_lab_consumption_allowed: false,
      blockers
    },
    status: state
  };

  const target = path.join(root, MEDIA_DIR, "media-manifest.json");
  await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = await buildRoomLabMediaManifest();
  process.stdout.write(`${JSON.stringify({ ok: true, media_manifest_id: manifest.media_manifest_id, artifact_count: manifest.artifacts.length })}\n`);
}
