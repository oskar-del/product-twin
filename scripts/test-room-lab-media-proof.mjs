#!/usr/bin/env node

import assert from "node:assert/strict";
import { buildRoomLabMediaManifest } from "./build-room-lab-media-manifest.mjs";
import { loadRoomLabMediaBundle, validateRoomLabMediaProof } from "./validate-room-lab-media-proof.mjs";

await buildRoomLabMediaManifest();
const baseline = await loadRoomLabMediaBundle();

const exact = await validateRoomLabMediaProof({ bundle: structuredClone(baseline) });
assert.equal(exact.ok, true, exact.errors.join("\n"));

const fixtures = [
  ["one millimetre drift", (data) => { data.scene_manifest.placements[0].transform.translation_m[0] += 0.001; }, "transform drift"],
  ["ninth placement", (data) => { data.scene_manifest.placements.push(structuredClone(data.scene_manifest.placements[0])); }, "exactly eight placements"],
  ["missing placement", (data) => { data.scene_manifest.placements.pop(); }, "exactly eight placements"],
  ["asset hash changed", (data) => { data.scene_manifest.placements[0].avatar.sha256 = "0".repeat(64); }, "avatar hash binding changed"],
  ["added door", (data) => { data.scene_manifest.shell.opening_claims.push({ id: "DOOR_INVENTED" }); }, "opening claims must remain empty"],
  ["window promoted to opening", (data) => { data.scene_manifest.shell.visual_overlays[0].source_wall_remains_intact = false; }, "visual overlay"],
  ["nested Design Asset commerce", (data) => {
    const placement = data.scene_manifest.placements[0];
    placement.source_lane = "DESIGN_ASSET";
    placement.design_asset_ref = "DA_TEST";
    placement.twin_ref = null;
    placement.metadata = { offer: { sku: "FORBIDDEN" } };
  }, "Design Asset commerce field forbidden"],
  ["G2 exact product claim", (data) => { data.output_assets.outputs[0].exact_product_claim_allowed = true; }, "exact-product claim forbidden"],
  ["public output with REVIEW rights", (data) => { data.output_assets.outputs[0].publication_state = "PUBLISHED"; }, "lacks YES publication rights"],
  ["same executor and reviewer", (data) => {
    data.fidelity_qa.status = "PASS";
    data.fidelity_qa.approval_state = "APPROVED";
    data.fidelity_qa.reviewer.id = data.fidelity_qa.executor.id;
  }, "reviewer must differ"],
  ["same rights executor and reviewer", (data) => {
    data.rights_disclosure.approval.state = "APPROVED";
    data.rights_disclosure.approval.reviewer_id = data.rights_disclosure.approval.executor_id;
  }, "rights reviewer must differ"],
  ["cost over cap", (data) => { data.cost_records.costs[1].estimate = 0.2; }, "estimated cost exceeds cap"],
  ["seed missing", (data) => { delete data.generative_jobs.jobs[0].seed; }, "seed missing"],
  ["ready provider job without immutable version", (data) => {
    data.generative_jobs.jobs[0].status = "READY";
    data.generative_jobs.jobs[0].credential_state = "CONFIGURED";
  }, "immutable model version missing"],
  ["output missing QA binding", (data) => { data.output_assets.outputs[0].qa_ref = null; }, "QA binding missing"],
  ["output missing disclosure binding", (data) => { data.output_assets.outputs[0].disclosure_ref = null; }, "rights/disclosure binding missing"],
  ["output missing cost binding", (data) => { data.output_assets.outputs[0].cost_ref = null; }, "cost binding missing"],
  ["camera path too short", (data) => { data.camera_shots.shots.find((shot) => shot.role === "CAMERA_PATH").path.duration_s = 10; }, "duration must be 15-30 seconds"],
  ["completed output without artifact", (data) => {
    data.output_assets.outputs[0].status = "SUCCEEDED";
    data.output_assets.outputs[0].uri = null;
    data.output_assets.outputs[0].sha256 = null;
    data.output_assets.outputs[0].bytes = null;
  }, "completed output URI missing"],
  ["media manifest path escape", (data) => { data.media_manifest.artifacts[0].path = "package.json"; }, "outside the frozen bundle"],
  ["numeric schema version", (data) => { data.output_assets.outputs[0].schema_version = 1; }, "schema validation failed: output-asset-pack"],
  ["unknown output property", (data) => { data.output_assets.outputs[0].unexpected = true; }, "schema validation failed: output-asset-pack"],
  ["invalid media type", (data) => { data.output_assets.outputs[0].media_type = "text/html"; }, "schema validation failed: output-asset-pack"],
  ["unknown storyboard property", (data) => { data.storyboard.unexpected = true; }, "schema validation failed: storyboard"],
  ["non-hero approval without QA or rights", (data) => {
    const output = data.output_assets.outputs[0];
    output.status = "APPROVED";
    output.uri = "data/media/room-lab/v0.1/outputs/fabricated.png";
    output.sha256 = "0".repeat(64);
    output.bytes = 1;
    data.fidelity_qa.status = "NOT_RUN";
    data.fidelity_qa.approval_state = "PENDING";
    data.fidelity_qa.reviewer.id = null;
    for (const check of data.fidelity_qa.checks) {
      check.result = "NOT_RUN";
      check.finding_count = null;
    }
  }, "approved output requires independently approved passing QA"],
  ["hero approval with checks not run", (data) => {
    const output = data.output_assets.outputs.find((entry) => entry.output_asset_id === "OUTPUT_ROOM_HERO_V0_1");
    output.status = "APPROVED";
    output.uri = "data/media/room-lab/v0.1/outputs/fabricated-hero.png";
    output.sha256 = "0".repeat(64);
    output.bytes = 1;
    output.approval.reviewer_id = "VERIFIER_1";
    data.render_jobs.jobs[0].status = "SUCCEEDED";
    data.cost_records.costs[0].status = "RECONCILED";
    data.fidelity_qa.status = "PASS";
    data.fidelity_qa.approval_state = "APPROVED";
    data.fidelity_qa.reviewer.id = "VERIFIER_1";
    for (const check of data.fidelity_qa.checks) {
      check.result = "NOT_RUN";
      check.finding_count = null;
    }
    data.rights_disclosure.approval.state = "APPROVED";
    data.rights_disclosure.approval.reviewer_id = "VERIFIER_1";
  }, "QA PASS requires every required check to pass"],
  ["planned output published", (data) => {
    data.output_assets.outputs[0].status = "PLANNED";
    data.output_assets.outputs[0].uri = null;
    data.output_assets.outputs[0].sha256 = null;
    data.output_assets.outputs[0].bytes = null;
    data.output_assets.outputs[0].publication_state = "PUBLISHED";
    data.rights_disclosure.source_assets[0].public_publication = "YES";
  }, "planned output cannot be publication-ready"],
  ["output references nonexistent job", (data) => { data.output_assets.outputs[0].job_id = "NO_SUCH_JOB"; }, "output references a nonexistent job"],
  ["output references nonexistent shot", (data) => { data.output_assets.outputs[0].shot_id = "NO_SUCH_SHOT"; }, "output references a nonexistent shot"],
  ["cost contradicts job", (data) => { data.cost_records.costs[0].job_id = "GEN_ROOM_LAB_PVIDEO_TEST_V0_1"; }, "cost/job binding mismatch"],
  ["twin evidence digest changed", (data) => { data.scene_manifest.twin_evidence[0].twin_record_sha256 = "0".repeat(64); }, "twin record digest mismatch"],
  ["loader contract changed", (data) => { data.scene_manifest.rendering.loader_floor_contact_contract.recenter_xz_to_world_transform = false; }, "loader transform/floor-contact contract mismatch"],
  ["QA check set replaced", (data) => { data.fidelity_qa.checks = [{ check_id: "ARBITRARY", result: "PASS", finding_count: 0 }]; }, "QA check set must contain every required check exactly once"],
  ["rights coverage reduced", (data) => { data.rights_disclosure.source_assets[0].asset_count = 1; }, "rights source coverage must account for all eight assets"],
  ["rights evidence ref replaced", (data) => { data.rights_disclosure.source_assets[0].evidence_refs[0] = data.rights_disclosure.source_assets[0].evidence_refs[1]; }, "rights evidence refs must match the exact eight frozen Product Twins"],
  ["avatar orientation changed", (data) => { data.scene_manifest.rendering.loader_floor_contact_contract.avatar_visual_front_axis = "+Z"; }, "avatar orientation contract mismatch"],
  ["orientation observed value falsified", (data) => { data.orientation_evidence.records[0].landmark_checks[0].observed = -999; }, "does not match recomputed GLB observations"],
  ["orientation pass falsified", (data) => { data.orientation_evidence.records[0].landmark_checks[0].pass = false; }, "does not match recomputed GLB observations"],
  ["orientation twin duplicated", (data) => { data.orientation_evidence.records[1].twin_ref = data.orientation_evidence.records[0].twin_ref; }, "does not match recomputed GLB observations"],
  ["orientation twin missing", (data) => { data.orientation_evidence.records.pop(); }, "does not match recomputed GLB observations"],
  ["LISTERBY false directional front", (data) => {
    const record = data.orientation_evidence.records.find((entry) => entry.twin_ref === "PT_IKEA_LISTERBY_30513904");
    record.orientation_mode = "LANDMARK_FRONT";
    record.visual_front_axis = "-Z";
    record.symmetry_class = "DIRECTIONAL_LANDMARK";
    record.symmetry_tolerance_m = null;
  }, "does not match recomputed GLB observations"],
  ["LOHALS symmetry class downgraded", (data) => {
    const record = data.orientation_evidence.records.find((entry) => entry.twin_ref === "PT_IKEA_LOHALS_30511288");
    record.symmetry_class = "GEOMETRIC_C2";
    record.symmetry_tolerance_m = 1e-9;
  }, "does not match recomputed GLB observations"],
  ["orientation minimum Y falsified", (data) => { data.orientation_evidence.records[0].bounds_m.min[1] = 0.001; }, "does not match recomputed GLB observations"],
  ["orientation verified height falsified", (data) => { data.orientation_evidence.records[0].verified_height_m += 0.001; }, "does not match recomputed GLB observations"],
  ["orientation stale builder hash", (data) => { data.orientation_evidence.builder_sha256 = "0".repeat(64); }, "orientation evidence builder hash mismatch"],
  ["orientation executor relabelled", (data) => { data.orientation_evidence.approval.executor_id = "RELABELLED_EXECUTOR"; }, "orientation evidence executor identity mismatch"],
  ["orientation same executor and reviewer", (data) => {
    data.orientation_evidence.status = "VERIFIED";
    data.orientation_evidence.approval.state = "APPROVED";
    data.orientation_evidence.approval.reviewer_id = data.orientation_evidence.approval.executor_id;
  }, "orientation evidence requires an independent reviewer"],
  ["orientation whitespace reviewer impersonation", (data) => {
    data.orientation_evidence.status = "VERIFIED";
    data.orientation_evidence.approval.state = "APPROVED";
    data.orientation_evidence.approval.reviewer_id = `${data.orientation_evidence.approval.executor_id} `;
  }, "orientation evidence requires an independent reviewer"],
  ["camera time reversed", (data) => { data.camera_shots.shots.find((shot) => shot.role === "CAMERA_PATH").path.keyframes[2].time_s = 1; }, "camera path times must be strictly increasing"],
  ["camera time detached from frame", (data) => { data.camera_shots.shots.find((shot) => shot.role === "CAMERA_PATH").path.keyframes[2].time_s = 10.1; }, "camera path time must equal frame / fps"],
  ["stills duplicate evidence falsified", (data) => { data.stills_run.deterministic_duplicate_pass = false; }, "stills duplicate-render evidence failed"],
  ["stills local cost falsified", (data) => { data.stills_run.cost_usd = 999; }, "stills run network/cost evidence mismatch"],
  ["video duplicate evidence falsified", (data) => { data.video_run.deterministic_duplicate_sha256 = "0".repeat(64); }, "video duplicate-encode evidence failed"],
  ["stills shot binding relabelled", (data) => {
    const runOutput = data.stills_run.outputs.find((output) => output.output_asset_id === "OUTPUT_ROOM_QA_FRONT_V0_1");
    const rear = data.camera_shots.shots.find((shot) => shot.role === "QA_REAR");
    runOutput.shot_id = rear.shot_id;
    runOutput.role = rear.role;
  }, "stills run output binding mismatch"],
  ["stills mutation audit keys replaced", (data) => { data.stills_run.outputs[0].audit.mutation_counts = { foo: 0, bar: 0, baz: 0, qux: 0 }; }, "stills mutation audit failed"],
  ["media tool version metadata falsified", (data) => {
    data.render_environment.environment.ffmpeg.version_prefix = "BOGUS";
    data.stills_run.environment.ffmpeg.version_prefix = "BOGUS";
    data.video_run.environment.ffmpeg.version_prefix = "BOGUS";
  }, "render environment media-tool binding mismatch"]
];

const approvedProviderRights = structuredClone(baseline);
approvedProviderRights.rights_disclosure.provider_processing.state = "YES";
approvedProviderRights.rights_disclosure.source_assets[0].provider_processing = "YES";
approvedProviderRights.rights_disclosure.source_assets[0].derivative_creation = "YES";
approvedProviderRights.rights_disclosure.approval.state = "APPROVED";
approvedProviderRights.rights_disclosure.approval.reviewer_id = "VERIFIER_1";
const approvedProviderRightsResult = await validateRoomLabMediaProof({ bundle: approvedProviderRights });
assert.equal(approvedProviderRightsResult.ok, true, approvedProviderRightsResult.errors.join("\n"));

for (const [name, mutate, expectedError] of fixtures) {
  const data = structuredClone(baseline);
  mutate(data);
  const result = await validateRoomLabMediaProof({ bundle: data });
  assert.equal(result.ok, false, `${name} unexpectedly passed`);
  assert(result.errors.some((error) => error.includes(expectedError)), `${name} failed for the wrong reason:\n${result.errors.join("\n")}`);
}

process.stdout.write(`${JSON.stringify({ ok: true, exact_fixture: "PASS", negative_fixtures: fixtures.length })}\n`);
