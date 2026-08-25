#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {fitSphereDistance, perspectiveFovs} from "../prototype/showroom-living/visual-framing.mjs";

const modulePath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(modulePath), "..");
const readJson = (root, relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const readText = (root, relative) => fs.readFileSync(path.join(root, relative), "utf8");

export function loadVisualQaFixture(root = defaultRoot) {
  return {
    composition: readJson(root, "data/showrooms/svartinge-glanrummet-living-room-v0.3.json"),
    qa: readJson(root, "data/showrooms/svartinge-glanrummet-visual-qa-v0.1.json"),
    commerce: readJson(root, "data/integration/svartinge-glanrummet-commerce-v0.3.json"),
    base: readJson(root, "data/showrooms/norr11-marbella-living-room-v0.1.json"),
    viewer: readText(root, "prototype/showroom-living/index.html"),
    framingSource: readText(root, "prototype/showroom-living/visual-framing.mjs"),
    captureSource: readText(root, "scripts/capture-svartinge-glanrummet-visual-qa.mjs")
  };
}

function roleRect(product, composition, qa) {
  const footprint = qa.product_footprints_m[product.role];
  const placement = composition.placement_overrides[product.twin_id];
  if (!footprint || !placement) return null;
  const angle = (placement.rotation_deg_y || 0) * Math.PI / 180;
  const u = [Math.cos(angle), Math.sin(angle)];
  const v = [-Math.sin(angle), Math.cos(angle)];
  return {
    role: product.role,
    centre: [placement.position_m[0], placement.position_m[2]],
    axes: [u, v],
    half: [footprint[0] / 2, footprint[1] / 2]
  };
}

function rectCorners(rect) {
  const corners = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    corners.push([
      rect.centre[0] + sx * rect.half[0] * rect.axes[0][0] + sz * rect.half[1] * rect.axes[1][0],
      rect.centre[1] + sx * rect.half[0] * rect.axes[0][1] + sz * rect.half[1] * rect.axes[1][1]
    ]);
  }
  return corners;
}

function projectionRadius(rect, axis) {
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  return rect.half[0] * Math.abs(dot(rect.axes[0], axis)) + rect.half[1] * Math.abs(dot(rect.axes[1], axis));
}

function rectanglesOverlap(a, b) {
  const dot = (left, right) => left[0] * right[0] + left[1] * right[1];
  for (const axis of [...a.axes, ...b.axes]) {
    const centreDistance = Math.abs(dot(a.centre, axis) - dot(b.centre, axis));
    if (centreDistance >= projectionRadius(a, axis) + projectionRadius(b, axis) - 1e-8) return false;
  }
  return true;
}

const subtract = (a, b) => a.map((value, index) => value - b[index]);
const dot3 = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
const normalize3 = vector => {
  const length = Math.hypot(...vector);
  return length ? vector.map(value => value / length) : [0, 0, 0];
};

function fixedViewEnvelope(rects, qa, view) {
  const points = [];
  for (const rect of rects) {
    const height = qa.product_heights_m[rect.role];
    for (const [x, z] of rectCorners(rect)) for (const y of [0, height]) points.push([x, y, z]);
  }
  const forward = normalize3(subtract(view.target_m, view.camera_position_m));
  const right = normalize3(cross3(forward, [0, 1, 0]));
  const up = cross3(right, forward);
  const verticalFov = view.fov_deg * Math.PI / 180;
  const aspect = qa.viewport.width_px / qa.viewport.height_px;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  let maximumNdcX = 0;
  let maximumNdcY = 0;
  let minimumDepth = Infinity;
  for (const point of points) {
    const relative = subtract(point, view.camera_position_m);
    const depth = dot3(relative, forward);
    minimumDepth = Math.min(minimumDepth, depth);
    maximumNdcX = Math.max(maximumNdcX, Math.abs(dot3(relative, right) / (depth * Math.tan(horizontalFov / 2))));
    maximumNdcY = Math.max(maximumNdcY, Math.abs(dot3(relative, up) / (depth * Math.tan(verticalFov / 2))));
  }
  return {maximumNdcX, maximumNdcY, minimumDepth};
}

function responsiveDistance(rects, composition, qa) {
  const points = [];
  for (const rect of rects) {
    const height = qa.product_heights_m[rect.role];
    for (const [x, z] of rectCorners(rect)) for (const y of [0, height]) points.push([x, y, z]);
  }
  const mins = [0, 1, 2].map(axis => Math.min(...points.map(point => point[axis])));
  const maxs = [0, 1, 2].map(axis => Math.max(...points.map(point => point[axis])));
  const radius = Math.hypot(...maxs.map((value, axis) => (value - mins[axis]) / 2));
  const aspect = composition.responsive_framing.minimum_supported_aspect_ratio;
  return fitSphereDistance({radius, verticalFovDeg: composition.camera.fov_deg, aspect, margin: composition.responsive_framing.camera_fit_margin});
}

export function validateVisualQa(input = loadVisualQaFixture()) {
  const {composition, qa, commerce, base, viewer, framingSource, captureSource} = input;
  const errors = [];
  let checks = 0;
  const expect = (condition, message) => {
    checks += 1;
    if (!condition) errors.push(message);
  };

  expect(composition.version === "showroom-composition/v0.3", "composition version must be v0.3");
  expect(composition.scene_id.endsWith("_V03"), "scene identity must be v0.3");
  expect(composition.room.size_m.join("x") === "7x3x7", "room envelope must remain 7x3x7 m");
  expect(Object.keys(composition.placement_overrides).length === 7, "composition must contain seven placement overrides");
  expect(composition.placement_overrides.PT_IKEA_LOHALS_30511288.rotation_deg_y === 90, "rug long axis must be rotated");
  expect(composition.appearance_profile.roles.rug.surface_color !== "#ffffff", "rug cue must not be white");
  expect(composition.appearance_profile.roles.coffee_table.surface_color !== "#ffffff", "coffee table cue must not be white");
  expect(composition.appearance_profile.exact_finish_claim === false, "composition must not claim exact finishes");
  expect(composition.visual_corrections.length >= 6, "visual corrections must disclose the wall-clearance repair");

  const framing = composition.responsive_framing || {};
  expect(framing.fit_subject === "ACTIVE_PRODUCT_GEOMETRY_BOUNDING_SPHERE", "responsive framing must use active product geometry");
  expect(framing.fit_below_aspect_ratio === 1.45, "responsive framing threshold must remain 1.45");
  expect(framing.minimum_supported_aspect_ratio === qa.acceptance.minimum_supported_aspect_ratio, "responsive framing and QA minimum aspect must match");
  expect(framing.camera_fit_margin >= 1.1, "responsive framing margin must be at least 10%");
  expect(framing.maximum_camera_distance_m <= 24, "responsive camera maximum must remain bounded");
  const portraitFovs = perspectiveFovs(composition.camera.fov_deg, framing.minimum_supported_aspect_ratio);
  const landscapeFovs = perspectiveFovs(composition.camera.fov_deg, 1.5);
  expect(portraitFovs.limiting === portraitFovs.horizontal && landscapeFovs.limiting === landscapeFovs.vertical, "responsive framing must use the limiting portrait or landscape FOV");
  expect(fitSphereDistance({radius: 1, verticalFovDeg: composition.camera.fov_deg, aspect: framing.minimum_supported_aspect_ratio, margin: framing.camera_fit_margin}) > fitSphereDistance({radius: 1, verticalFovDeg: composition.camera.fov_deg, aspect: 1.5, margin: framing.camera_fit_margin}), "portrait framing must move farther away than landscape framing");

  expect(qa.composition_manifest.endsWith("v0.3.json"), "QA must bind the v0.3 composition");
  expect(qa.viewport.width_px === 1440 && qa.viewport.height_px === 960, "fixed QA viewport must remain 1440x960");
  expect(qa.views.length >= qa.acceptance.minimum_fixed_views && qa.views.length === 3, "QA must contain three fixed views");
  expect(new Set(qa.views.map(view => view.id)).size === qa.views.length, "QA view identifiers must be unique");
  expect(qa.acceptance.placed_product_count === 7, "QA must expect seven products");
  expect(qa.acceptance.runtime_asset_load_failures_allowed === 0, "QA must allow zero asset failures");
  expect(qa.acceptance.safe_frame_margin_px === 24, "QA safe frame must remain 24 px");
  expect(qa.acceptance.minimum_wall_clearance_m >= 0.1, "wall clearance must be at least 100 mm");
  expect(qa.acceptance.solid_product_collision_count_allowed === 0, "solid product collisions must be forbidden");
  expect(qa.acceptance.fixed_view_frustum_ndc_limit <= 0.9, "fixed views must reserve at least 10% frustum margin");
  expect(qa.acceptance.deterministic_procedural_textures_required === true, "deterministic textures must be required");
  expect(qa.acceptance.same_browser_readiness_and_capture_required === true, "same-browser readiness and capture must be required");
  expect(qa.acceptance.capture_input_hashes_required === true, "capture input hashes must be required");
  expect(qa.acceptance.stale_capture_cleanup_required === true, "stale capture cleanup must be required");
  expect(qa.acceptance.human_pixel_review_required_before_publication === true, "human pixel review must remain required");
  expect(qa.acceptance.unreviewed_publication_state === "BLOCK", "unreviewed publication must remain blocked");
  expect(Object.keys(qa.product_footprints_m).length === 7, "QA must include seven footprint records");
  expect(Object.keys(qa.product_heights_m).length === 7, "QA must include seven height records");

  const rects = base.products.map(product => roleRect(product, composition, qa));
  expect(rects.every(Boolean), "every placed product must bind a footprint and placement");
  if (rects.every(Boolean)) {
    const clearance = qa.acceptance.minimum_wall_clearance_m;
    const [roomWidth,,roomDepth] = composition.room.size_m;
    const bounds = {minX: -roomWidth / 2 + clearance, maxX: roomWidth / 2 - clearance, minZ: -(roomDepth - 1) + clearance, maxZ: 1 - clearance};
    for (const rect of rects) {
      const inside = rectCorners(rect).every(([x, z]) => x >= bounds.minX - 1e-9 && x <= bounds.maxX + 1e-9 && z >= bounds.minZ - 1e-9 && z <= bounds.maxZ + 1e-9);
      expect(inside, `${rect.role} lies outside the 100 mm room-clearance envelope`);
    }
    const solids = rects.filter(rect => rect.role !== "rug");
    let collisions = 0;
    for (let left = 0; left < solids.length; left += 1) for (let right = left + 1; right < solids.length; right += 1) {
      if (rectanglesOverlap(solids[left], solids[right])) collisions += 1;
    }
    expect(collisions === qa.acceptance.solid_product_collision_count_allowed, `solid product collision count is ${collisions}, expected 0`);

    const requiredDistance = responsiveDistance(rects, composition, qa);
    expect(Number.isFinite(requiredDistance) && requiredDistance <= framing.maximum_camera_distance_m, `responsive framing requires ${requiredDistance.toFixed(3)} m, above its camera limit`);
    for (const view of qa.views) {
      expect(view.camera_position_m.length === 3 && view.target_m.length === 3, `${view.id} camera vectors must be 3D`);
      expect(view.fov_deg >= 40 && view.fov_deg <= 60, `${view.id} FOV must remain bounded`);
      const envelope = fixedViewEnvelope(rects, qa, view);
      expect(envelope.minimumDepth > 0, `${view.id} places geometry behind the camera`);
      expect(envelope.maximumNdcX <= qa.acceptance.fixed_view_frustum_ndc_limit && envelope.maximumNdcY <= qa.acceptance.fixed_view_frustum_ndc_limit, `${view.id} exceeds the fixed-view frustum margin`);
    }
  }

  expect(viewer.includes("svartinge-glanrummet-living-room-v0.3.json"), "viewer must consume the v0.3 composition");
  expect(viewer.includes("svartinge-glanrummet-visual-qa-v0.1.json"), "viewer must consume the QA contract");
  expect(viewer.includes("deterministicRandom"), "viewer must seed procedural textures");
  expect(viewer.includes("function frameCompositionForAspect()") && viewer.includes("new THREE.Box3()") && viewer.includes("frameCompositionForAspect();"), "viewer must execute geometry-based responsive framing");
  expect(viewer.includes("scene_data.responsive_framing") && viewer.includes("camera_fit_margin") && viewer.includes("maximum_camera_distance_m"), "viewer must consume the versioned responsive-framing contract");
  expect(viewer.includes("import { fitSphereDistance } from './visual-framing.mjs'") && viewer.includes("fitSphereDistance({radius: sphere.radius"), "viewer must execute the tested framing function");
  expect(framingSource.includes("Math.min(vertical, horizontal)"), "framing module must select the limiting FOV");
  expect(viewer.includes("addEventListener('resize'") && viewer.includes("frameCompositionForAspect();"), "viewer must reframe on resize");
  expect(!viewer.includes("if (isSvartingeStudy) (function art"), "Svärtinge back-wall art must remain disabled");
  expect(viewer.includes("dataset.visualQaState"), "viewer must expose QA readiness");
  expect(viewer.includes("assetLoadFailures"), "viewer must expose asset failures");
  expect(viewer.includes("clippedTags"), "viewer must check safe-frame tags");

  const readyStart = captureSource.indexOf("export async function captureReadyPage");
  const captureViewStart = captureSource.indexOf("async function captureView");
  const evidenceStart = captureSource.indexOf("function evidenceInputs()");
  const readyBlock = captureSource.slice(readyStart, captureViewStart);
  const captureViewBlock = captureSource.slice(captureViewStart, evidenceStart);
  const sessionOpenCount = [...captureViewBlock.matchAll(/openChromeCapture\(/g)].length;
  expect(readyStart >= 0 && readyBlock.indexOf("Runtime.evaluate") < readyBlock.indexOf("Page.captureScreenshot") && readyBlock.includes("Page.captureScreenshot"), "capture helper must verify readiness before capturing pixels");
  expect(sessionOpenCount === 1 && captureViewBlock.includes("captureReadyPage({cdp: session.cdp"), "capture view must use one CDP session for readiness and pixels");
  const cleanupIndex = captureSource.indexOf("fs.rmSync(outputDir, {recursive: true, force: true})");
  const renderIndex = captureSource.indexOf("const plan = renderPlan()");
  const captureLoopIndex = captureSource.indexOf("for (const view of qa.views)");
  expect(cleanupIndex >= 0 && cleanupIndex < renderIndex && cleanupIndex < captureLoopIndex, "capture must clear stale evidence before rendering or browser capture");
  expect(captureSource.includes("function evidenceInputs()") && captureSource.includes("sha256: sha256"), "capture must hash its evidence inputs");
  for (const dependency of ["visual-framing.mjs", "vendor/three.module.js", "OrbitControls.js", "GLTFLoader.js", "RoomEnvironment.js"]) {
    expect(captureSource.includes(dependency), `capture input hashes must include ${dependency}`);
  }
  expect(captureSource.includes("capture-failure.json") && captureSource.includes("run-state.json"), "capture must persist explicit run and failure states");

  expect(commerce.source_showroom_manifest === qa.composition_manifest, "commerce must bind the QA composition");
  expect(commerce.source_visual_qa_contract.endsWith("visual-qa-v0.1.json"), "commerce must bind the QA contract");
  expect(commerce.visual_qa.pixel_review_state === "PENDING", "pixel review must remain pending");
  expect(commerce.visual_qa.publication_gate === "BLOCK_UNTIL_HUMAN_PIXEL_REVIEW", "publication gate must remain blocked");
  expect(commerce.forbidden.some(rule => rule.includes("three-view human pixel review")), "commerce must forbid unreviewed publication");

  return {checks, errors};
}

if (process.argv[1] === modulePath) {
  const result = validateVisualQa();
  if (result.errors.length) {
    for (const error of result.errors) console.error(`visual QA FAIL: ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Svärtinge Glanrummet visual QA contract PASS (${result.checks} checks)`);
  }
}
