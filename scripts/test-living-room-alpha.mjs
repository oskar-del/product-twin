#!/usr/bin/env node

import assert from "node:assert/strict";
import { buildLivingRoomAlphaPack } from "./build-living-room-alpha-pack.mjs";
import { loadLivingRoomAlphaBundle, validateLivingRoomAlpha } from "./validate-living-room-alpha.mjs";

await buildLivingRoomAlphaPack();
const baseline = await loadLivingRoomAlphaBundle();
const exact = await validateLivingRoomAlpha({ bundle: structuredClone(baseline) });
assert.equal(exact.ok, true, exact.errors.join("\n"));

const fixtures = [
  ["camera removed", (data) => { data.camera_pack.cameras.pop(); }, "six unique cameras and roles required"],
  ["camera role duplicated", (data) => { data.camera_pack.cameras[1].role = data.camera_pack.cameras[0].role; }, "six unique cameras and roles required"],
  ["camera moved one millimetre", (data) => { data.camera_pack.cameras[1].position_m[0] += 0.001; }, "camera numeric drift"],
  ["camera FOV changed", (data) => { data.camera_pack.cameras[1].vertical_fov_deg += 0.1; }, "camera lens mismatch"],
  ["hero camera copied from wide", (data) => {
    const wide = data.camera_pack.cameras.find((camera) => camera.camera_id === "CAM_ROOM_ALPHA_WIDE_V0_1");
    const hero = data.camera_pack.cameras.find((camera) => camera.camera_id === "CAM_ROOM_ALPHA_HERO_V0_1");
    hero.position_m = structuredClone(wide.position_m);
    hero.target_m = structuredClone(wide.target_m);
  }, "camera numeric drift: CAM_ROOM_ALPHA_HERO_V0_1"],
  ["camera aspect changed", (data) => { data.camera_pack.cameras[0].aspect_ratio = "16:10"; }, "camera aspect/resolution mismatch"],
  ["camera near plane changed", (data) => { data.camera_pack.cameras[1].near_m = 0.03; }, "camera source/frustum mismatch"],
  ["camera far plane changed", (data) => { data.camera_pack.cameras[1].far_m = 99; }, "camera source/frustum mismatch"],
  ["camera up vector changed", (data) => { data.camera_pack.cameras[0].up_vector = [0, 1, 0]; }, "camera source/frustum mismatch"],
  ["camera absolute orthographic bounds changed", (data) => {
    const bounds = data.camera_pack.cameras[0].orthographic_bounds_m;
    bounds.left += 0.1;
    bounds.right += 0.1;
  }, "camera bounds/output-class mismatch"],
  ["camera source shot changed", (data) => { data.camera_pack.cameras[1].source_shot_id = "SHOT_ROOM_QA_TOP_V0_1"; }, "camera source/frustum mismatch"],
  ["camera allowed output class changed", (data) => { data.camera_pack.cameras[1].allowed_output_classes.push("CONCEPT_MARKETING_RENDER"); }, "camera bounds/output-class mismatch"],
  ["clearance changed one millimetre", (data) => { data.camera_pack.cameras.find((camera) => camera.role === "SIDE_CLEARANCE_VIEW").expected_clearance_m += 0.001; }, "clearance must equal 0.785 m"],
  ["room source commit changed", (data) => { data.room_manifest.room_lab_binding.commit = "0".repeat(40); }, "frozen Room Lab source commit mismatch"],
  ["room scene hash changed", (data) => { data.room_manifest.room_lab_binding.scene_manifest_sha256 = "0".repeat(64); }, "room scene hash mismatch"],
  ["room manifest ID changed", (data) => { data.room_manifest.room_manifest_id = "ROOM_BOGUS"; }, "room manifest identity mismatch"],
  ["furniture manifest revision changed", (data) => { data.furniture_manifest.revision = "9.9.9"; }, "furniture manifest identity mismatch"],
  ["market manifest URI injected", (data) => { data.market_manifest.uri = "bogus.json"; }, "market manifest identity mismatch"],
  ["camera-pack scene ID changed", (data) => { data.camera_pack.scene_id = "SCENE_BOGUS"; }, "camera-pack source identity mismatch"],
  ["media room binding URI changed", (data) => { data.media_manifest.source_bindings.room.uri = "bogus.json"; }, "media room source identity mismatch"],
  ["media camera-pack identity changed", (data) => { data.media_manifest.camera_pack_binding.manifest_id = "CAMERA_PACK_BOGUS"; }, "media camera-pack identity mismatch"],
  ["room opening freeze weakened", (data) => { data.room_manifest.freeze.opening_changes_allowed = true; }, "room freeze policy mismatch"],
  ["room geometry substitution freeze weakened", (data) => { data.room_manifest.freeze.geometry_substitution_allowed = true; }, "room freeze policy mismatch"],
  ["furniture placement removed", (data) => { data.furniture_manifest.placements.pop(); }, "exactly eight unique placements required"],
  ["placement moved one millimetre", (data) => { data.furniture_manifest.placements[0].transform.translation_m[0] += 0.001; }, "placement transform drift"],
  ["placement rotated", (data) => { data.furniture_manifest.placements[0].transform.rotation_y_rad += 0.001; }, "placement rotation/scale drift"],
  ["asset hash changed", (data) => { data.furniture_manifest.placements[0].asset.sha256 = "0".repeat(64); }, "asset revision/hash mismatch"],
  ["VALNAS silently substituted", (data) => { data.furniture_manifest.placements[2].product_twin_id = "PT_IKEA_VALNAS_20628038"; }, "placement lane/twin mismatch"],
  ["Design Asset injected", (data) => {
    const placement = data.furniture_manifest.placements[0];
    placement.source_lane = "DESIGN_ASSET";
    placement.design_asset_id = "DESIGN_ASSET_TEST";
    placement.product_twin_id = null;
  }, "placement lane/twin mismatch"],
  ["crosswalk duplicated", (data) => { data.furniture_manifest.placements[1].source_placement_alias = data.furniture_manifest.placements[0].source_placement_alias; }, "placement crosswalk mismatch"],
  ["market marked current", (data) => { data.market_manifest.state = "CURRENT"; }, "evidence must remain dated context only"],
  ["LISTERBY marked available", (data) => { data.market_manifest.placement_supply.find((entry) => entry.placement_id === "listerby-placement-01").destination_state = "AVAILABLE"; }, "LISTERBY snapshot state must remain unavailable"],
  ["marketing output promoted", (data) => {
    const output = data.media_manifest.outputs.find((entry) => entry.output_class === "CONCEPT_MARKETING_RENDER");
    output.status = "AVAILABLE_INTERNAL_QA";
    output.publication_state = "INTERNAL_QA_ONLY";
  }, "concept marketing output must remain unrendered and rights-blocked"],
  ["marketing borrows verification PNG", (data) => {
    const concept = data.media_manifest.outputs.find((entry) => entry.output_class === "CONCEPT_MARKETING_RENDER");
    const verification = data.media_manifest.outputs.find((entry) => entry.output_class === "VERIFICATION_RENDER");
    concept.media = structuredClone(verification.media);
    concept.generation_date = "2026-08-17";
  }, "concept marketing output must remain unrendered and rights-blocked"],
  ["concept blocker removed", (data) => { data.media_manifest.outputs.find((entry) => entry.output_class === "CONCEPT_MARKETING_RENDER").blockers.pop(); }, "concept marketing output must remain unrendered and rights-blocked"],
  ["verification disclosure overclaims exact surveyed products", (data) => { data.media_manifest.outputs[0].disclosure.text = "Exact surveyed room and exact products."; }, "verification disclosure mismatch"],
  ["concept disclosure overclaims exact products", (data) => { data.media_manifest.outputs.find((entry) => entry.output_class === "CONCEPT_MARKETING_RENDER").disclosure.text = "Exact products and finishes."; }, "concept disclosure state mismatch"],
  ["output actual cost changed", (data) => { data.media_manifest.outputs[0].cost.actual = 1; }, "verification cost/date/rights mismatch"],
  ["provider call recorded", (data) => { data.media_manifest.cost_summary.provider_calls = 1; }, "alpha cost/provider summary mismatch"],
  ["absent avatar manifest activated", (data) => { data.media_manifest.avatar_manifest_adapter.state = "ACTIVE"; }, "future avatar manifest adapter policy mismatch"],
  ["avatar adapter may change camera", (data) => { data.media_manifest.avatar_manifest_adapter.forbidden_changes = ["scene", "placement_id", "transform"]; }, "future avatar manifest adapter policy mismatch"],
  ["avatar adapter allowed replacement removed", (data) => { data.media_manifest.avatar_manifest_adapter.allowed_replacements.pop(); }, "future avatar manifest adapter policy mismatch"],
  ["avatar adapter source-lane freeze removed", (data) => { data.media_manifest.avatar_manifest_adapter.forbidden_changes.pop(); }, "future avatar manifest adapter policy mismatch"],
  ["furniture adapter permits placement changes", (data) => { data.furniture_manifest.avatar_manifest_adapter.placement_changes_allowed = true; }, "furniture avatar adapter policy mismatch"],
  ["furniture adapter permits silent fallback", (data) => { data.furniture_manifest.avatar_manifest_adapter.silent_fallback_allowed = true; }, "furniture avatar adapter policy mismatch"],
  ["visibility filtered on wide", (data) => { data.camera_pack.cameras.find((camera) => camera.role === "WIDE_ROOM_PERSPECTIVE").visibility_policy = "SELECTED_ONLY_PLUS_SHELL"; }, "visibility filtering forbidden"],
  ["selected KIVIK removed", (data) => { data.camera_pack.cameras.find((camera) => camera.role === "SELECTED_PRODUCT_CANONICAL_INSPECTION").selected_placement_id = null; }, "selected-product camera must bind KIVIK"],
  ["output hash changed", (data) => { data.media_manifest.outputs.find((output) => output.output_class === "VERIFICATION_RENDER").media.sha256 = "0".repeat(64); }, "verification output identity/evidence mismatch"],
  ["output ID duplicated", (data) => { data.media_manifest.outputs[1].output_id = data.media_manifest.outputs[0].output_id; }, "output IDs and media mappings must be unique"],
  ["wide output borrows top-plan media", (data) => {
    const top = data.media_manifest.outputs.find((output) => output.camera_id === "CAM_ROOM_ALPHA_TOP_PLAN_V0_1" && output.output_class === "VERIFICATION_RENDER");
    const wide = data.media_manifest.outputs.find((output) => output.camera_id === "CAM_ROOM_ALPHA_WIDE_V0_1");
    wide.media = structuredClone(top.media);
    data.media_manifest.contact_sheet.input_sha256[1] = top.media.sha256;
  }, "output IDs and media mappings must be unique"],
  ["output placement omitted", (data) => { data.media_manifest.outputs[0].placement_ids.pop(); }, "output source/placement binding mismatch"],
  ["contact tiles swapped", (data) => { [data.media_manifest.contact_sheet.tile_order[0], data.media_manifest.contact_sheet.tile_order[1]] = [data.media_manifest.contact_sheet.tile_order[1], data.media_manifest.contact_sheet.tile_order[0]]; }, "contact-sheet camera order/identity mismatch"],
  ["contact input hash changed", (data) => { data.media_manifest.contact_sheet.input_sha256[0] = "0".repeat(64); }, "contact-sheet input hash order mismatch"],
  ["output classes collapsed", (data) => { data.media_manifest.output_classes.pop(); }, "output classes must remain strictly separated"],
  ["output class channel swapped", (data) => {
    data.media_manifest.output_classes[0].allowed_channel = "NONE";
    data.media_manifest.output_classes[1].allowed_channel = "INTERNAL_QA";
  }, "output classes must remain strictly separated"],
  ["output class disclosure flags swapped", (data) => {
    data.media_manifest.output_classes[0].visible_disclosure_required = true;
    data.media_manifest.output_classes[1].visible_disclosure_required = false;
  }, "output classes must remain strictly separated"],
  ["manifest marked verified while review pending", (data) => { data.media_manifest.status = "VERIFIED_INTERNAL_QA"; }, "pending Verification state/status mismatch"],
  ["Room Lab integration blocker removed", (data) => { data.media_manifest.blockers.pop(); }, "global blocker set mismatch"],
  ["governance commit changed", (data) => { data.media_manifest.governance_bindings[0].commit = "0".repeat(40); }, "governance binding mismatch"],
  ["same executor and reviewer", (data) => {
    data.media_manifest.verification_handoff.review_state = "APPROVED";
    data.media_manifest.verification_handoff.reviewer_id = data.media_manifest.verification_handoff.executor_id;
  }, "Verification reviewer must differ from executor"],
  ["commerce field injected into media", (data) => { data.media_manifest.outputs[0].price = 999; }, "forbidden commerce/current field in media manifest"],
  ["verification generation date removed", (data) => { data.media_manifest.outputs[0].generation_date = null; }, "verification cost/date/rights mismatch"],
  ["native visibility evidence falsified", (data) => { data.native_run.outputs[0].visible_placement_ids = ["billy-placement-01"]; }, "native visibility audit mismatch"],
  ["native duplicate evidence falsified", (data) => { data.native_run.outputs[0].duplicate_render_sha256 = "0".repeat(64); }, "native duplicate/camera audit mismatch"],
  ["native mutation keys falsified", (data) => { data.native_run.outputs[0].audit.mutation_counts = { foo: 0, bar: 0, baz: 0, qux: 0 }; }, "native scene audit mismatch"],
  ["native output URI falsified", (data) => { data.native_run.outputs[0].uri = "bogus.png"; }, "native output identity mismatch"],
  ["native output hash falsified", (data) => { data.native_run.outputs[0].sha256 = "0".repeat(64); }, "native duplicate/camera audit mismatch"],
  ["native output bytes falsified", (data) => { data.native_run.outputs[0].bytes += 1; }, "native duplicate/camera audit mismatch"],
  ["native output dimensions falsified", (data) => { data.native_run.outputs[0].dimensions_px.width += 1; }, "native duplicate/camera audit mismatch"],
  ["native environment falsified", (data) => { data.native_run.environment.chrome.version = "BOGUS"; }, "alpha native environment mismatch"],
  ["render environment falsified", (data) => { data.render_environment.environment.ffmpeg.version_prefix = "BOGUS"; }, "alpha render environment mismatch"],
  ["native audit placement falsified", (data) => { data.native_run.outputs[0].audit.placements[0].bounds_min_y_m = 0.1; }, "native scene audit mismatch"],
  ["reused shot evidence falsified", (data) => { data.reused_run.outputs.find((output) => output.output_asset_id === "OUTPUT_ROOM_QA_FRONT_V0_1").shot_id = "SHOT_ROOM_QA_TOP_V0_1"; }, "reused output evidence mismatch"]
];

for (const [name, mutate, expectedError] of fixtures) {
  const data = structuredClone(baseline);
  mutate(data);
  const result = await validateLivingRoomAlpha({ bundle: data });
  assert.equal(result.ok, false, `${name} unexpectedly passed`);
  assert(result.errors.some((error) => error.includes(expectedError)), `${name} failed for the wrong reason:\n${result.errors.join("\n")}`);
}

process.stdout.write(`${JSON.stringify({ ok: true, exact_fixture: "PASS", negative_fixtures: fixtures.length })}\n`);
