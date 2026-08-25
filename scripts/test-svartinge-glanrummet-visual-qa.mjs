#!/usr/bin/env node

import assert from "node:assert/strict";
import {loadVisualQaFixture, validateVisualQa} from "./validate-svartinge-glanrummet-visual-qa.mjs";
import {captureReadyPage} from "./capture-svartinge-glanrummet-visual-qa.mjs";
import {fitSphereDistance} from "../prototype/showroom-living/visual-framing.mjs";

const original = loadVisualQaFixture();
const baseline = validateVisualQa(original);
assert.deepEqual(baseline.errors, [], `baseline visual QA fixture failed: ${baseline.errors.join("; ")}`);

const jsonClone = value => structuredClone(value);
const cloneFixture = () => ({
  composition: jsonClone(original.composition),
  qa: jsonClone(original.qa),
  commerce: jsonClone(original.commerce),
  base: jsonClone(original.base),
  viewer: original.viewer,
  framingSource: original.framingSource,
  captureSource: original.captureSource
});

const readyState = {
  state: "ready",
  view: "hero",
  loaded: original.qa.acceptance.placed_product_count,
  assetLoadFailures: [],
  clippedTags: 0
};
const cdpCalls = [];
const mockCdp = {
  async send(method, params) {
    cdpCalls.push({method, params});
    if (method === "Runtime.evaluate" && params.expression.startsWith("JSON.stringify")) {
      return {result: {value: JSON.stringify(readyState)}};
    }
    if (method === "Page.captureScreenshot") return {data: "pixel-evidence"};
    return {};
  }
};
const runtimeCapture = await captureReadyPage({cdp: mockCdp, url: "http://example.test/room", view: original.qa.views[0], qaContract: original.qa, pollIntervalMs: 0, timeoutMs: 100});
assert.deepEqual(runtimeCapture.state, readyState, "capture helper must return the readiness state from the same CDP object");
assert.equal(runtimeCapture.captured.data, "pixel-evidence", "capture helper must return pixels from the same CDP object");
assert(cdpCalls.findIndex(call => call.method === "Runtime.evaluate" && call.params.expression.startsWith("JSON.stringify")) < cdpCalls.findIndex(call => call.method === "Page.captureScreenshot"), "readiness must precede screenshot capture");

const portraitDistance = fitSphereDistance({radius: 1, verticalFovDeg: 49, aspect: 9 / 16, margin: 1.12});
const landscapeDistance = fitSphereDistance({radius: 1, verticalFovDeg: 49, aspect: 1.5, margin: 1.12});
assert(portraitDistance > landscapeDistance, "portrait framing must use horizontal FOV and move farther away");

const mutations = [
  ["day bed breaches the left wall", fixture => { fixture.composition.placement_overrides.PT_NORR11_MAN_DAY_BED_NOR_MAN_DAYBED_CAT1.position_m[0] = -2.55; }, "day_bed lies outside"],
  ["solid products collide", fixture => { fixture.composition.placement_overrides.PT_WENDELBO_ATLI_WEN_333_1_COM.position_m = [0, 0, -3.1]; }, "solid product collision count"],
  ["rug returns to white placeholder", fixture => { fixture.composition.appearance_profile.roles.rug.surface_color = "#ffffff"; }, "rug cue must not be white"],
  ["coffee table returns to white placeholder", fixture => { fixture.composition.appearance_profile.roles.coffee_table.surface_color = "#ffffff"; }, "coffee table cue must not be white"],
  ["responsive camera cannot fit portrait", fixture => { fixture.composition.responsive_framing.maximum_camera_distance_m = 5; }, "responsive framing requires"],
  ["fixed camera cuts the composition", fixture => { fixture.qa.views[0].camera_position_m = [0, 0.5, -3.1]; }, "hero places geometry behind the camera"],
  ["human review silently disabled", fixture => { fixture.qa.acceptance.human_pixel_review_required_before_publication = false; }, "human pixel review must remain required"],
  ["commerce promoted before review", fixture => { fixture.commerce.visual_qa.pixel_review_state = "APPROVED"; }, "pixel review must remain pending"],
  ["readiness and screenshot sessions split", fixture => { fixture.captureSource = fixture.captureSource.replace("const session = await openChromeCapture(chrome, view.id);", "const session = await openChromeCapture(chrome, view.id);\n  const screenshotSession = await openChromeCapture(chrome, `${view.id}-screenshot`);"); }, "one CDP session"],
  ["portrait FOV uses the wider angle", fixture => { fixture.framingSource = fixture.framingSource.replace("Math.min(vertical, horizontal)", "Math.max(vertical, horizontal)"); }, "select the limiting FOV"],
  ["stale evidence cleanup deferred", fixture => { fixture.captureSource = fixture.captureSource.replace("fs.rmSync(outputDir, {recursive: true, force: true})", "").replace("for (const view of qa.views) views.push(await captureView({chrome, origin, view}));", "for (const view of qa.views) views.push(await captureView({chrome, origin, view}));\n    fs.rmSync(outputDir, {recursive: true, force: true});"); }, "before rendering or browser capture"],
  ["input hashing removed", fixture => { fixture.captureSource = fixture.captureSource.replace("function evidenceInputs()", "function removedEvidenceInputs()"); }, "hash its evidence inputs"],
  ["Three.js renderer omitted from input hashes", fixture => { fixture.captureSource = fixture.captureSource.replace('    "prototype/showroom-living/vendor/three.module.js",\n', ""); }, "include vendor/three.module.js"],
  ["responsive framing execution removed", fixture => { fixture.viewer = fixture.viewer.replace("function frameCompositionForAspect()", "function removedFrameCompositionForAspect()"); }, "execute geometry-based responsive framing"],
  ["versioned framing contract ignored", fixture => { fixture.viewer = fixture.viewer.replace("scene_data.responsive_framing", "{}"); }, "consume the versioned responsive-framing contract"]
];

for (const [name, mutate, expected] of mutations) {
  const fixture = cloneFixture();
  mutate(fixture);
  const result = validateVisualQa(fixture);
  assert(result.errors.some(error => error.includes(expected)), `${name}: expected failure containing '${expected}', got ${result.errors.join("; ")}`);
}

console.log(`Svärtinge Glanrummet visual QA runtime + mutation suite PASS (${mutations.length}/${mutations.length})`);
