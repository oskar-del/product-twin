import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { evaluatePhotoAvatarQa, validatePhotoAvatarQa } from './validate-photo-avatar-qa.mjs';

const requiredViews = ['front', 'rear', 'left', 'right', 'three_quarter'];
const contract = {
  required_views: requiredViews,
  thresholds: {
    maximum_per_view_silhouette_error_percent: 12,
    maximum_mean_silhouette_error_percent: 8,
    maximum_per_view_landmark_error_percent: 15,
    maximum_mean_landmark_error_percent: 10,
    maximum_axis_dimension_error_percent: 3,
    minimum_observed_surface_percent: 70,
    maximum_unresolved_surface_percent: 10,
    coverage_sum_tolerance_percent: 0.5,
  },
  required_states: {
    generation: 'SUCCEEDED_REQUIRES_QA',
    human_review: 'accepted',
    per_view_review: 'accepted',
    render_allowed: 'yes',
    maximum_claim_level: 'G2',
    exact_product_claim_allowed: false,
    engineering_interface_claim_allowed: false,
  },
  asset_policy: { required_magic: 'glTF' },
};
const generationMetric = {
  job_id: 'QA_FIXTURE',
  status: 'SUCCEEDED_REQUIRES_QA',
  runtime_asset_path: '.runtime/avatars/QA_FIXTURE/model.glb',
  capture_view_count: 5,
  capture_views: requiredViews,
  expected_dimensions_mm: { width: 500, depth: 400, height: 300 },
};
const report = {
  job_id: 'QA_FIXTURE',
  measured_model_dimensions_mm: { width: 505, depth: 396, height: 303 },
  view_comparisons: requiredViews.map((view) => ({ view, silhouette_error_percent: 6, landmark_error_percent: 8, reviewer_state: 'accepted' })),
  coverage: { observed_surface_percent: 82, inferred_surface_percent: 13, unresolved_surface_percent: 5 },
  human_review_state: 'accepted',
  rights_review: { render_allowed: 'yes', redistribution_allowed: 'no', evidence_refs: ['owner-capture-declaration'] },
  promotion: { maximum_claim_level: 'G2', exact_product_claim_allowed: false, engineering_interface_claim_allowed: false },
};
const asset = { insideRuntime: true, magic: 'glTF', bytes: 128, sha256: '0'.repeat(64) };

assert.equal(evaluatePhotoAvatarQa({ generationMetric, report, contract, asset }).status, 'PASS');
const badScale = structuredClone(report);
badScale.measured_model_dimensions_mm.width = 540;
assert.ok(evaluatePhotoAvatarQa({ generationMetric, report: badScale, contract, asset }).blocked_check_ids.includes('physical_scale_threshold'));
const badCoverage = structuredClone(report);
badCoverage.coverage = { observed_surface_percent: 60, inferred_surface_percent: 20, unresolved_surface_percent: 20 };
const badCoverageResult = evaluatePhotoAvatarQa({ generationMetric, report: badCoverage, contract, asset });
assert.ok(badCoverageResult.blocked_check_ids.includes('observed_surface_threshold'));
assert.ok(badCoverageResult.blocked_check_ids.includes('unresolved_surface_threshold'));
const notAccepted = structuredClone(report);
notAccepted.human_review_state = 'review';
assert.ok(evaluatePhotoAvatarQa({ generationMetric, report: notAccepted, contract, asset }).blocked_check_ids.includes('human_review_accepted'));

const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'photo-avatar-qa-'));
try {
  await fsp.mkdir(path.join(tempRoot, 'config/geometry'), { recursive: true });
  await fsp.mkdir(path.join(tempRoot, 'data/metrics'), { recursive: true });
  await fsp.mkdir(path.join(tempRoot, '.runtime/avatars/QA_FIXTURE'), { recursive: true });
  await Promise.all([
    fsp.writeFile(path.join(tempRoot, 'config/geometry/photo-avatar-qa-contract.json'), JSON.stringify(contract)),
    fsp.writeFile(path.join(tempRoot, 'data/metrics/meshy-avatar-job-latest.json'), JSON.stringify(generationMetric)),
    fsp.writeFile(path.join(tempRoot, '.runtime/qa-report.json'), JSON.stringify(report)),
    fsp.writeFile(path.join(tempRoot, '.runtime/avatars/QA_FIXTURE/model.glb'), Buffer.concat([Buffer.from('glTF'), Buffer.alloc(124)])),
  ]);
  const result = await validatePhotoAvatarQa({ root: tempRoot, reportPath: '.runtime/qa-report.json' });
  assert.equal(result.status, 'SUCCEEDED_QA_PASS');
  assert.equal(JSON.parse(await fsp.readFile(path.join(tempRoot, 'data/metrics/meshy-avatar-job-latest.json'), 'utf8')).status, 'SUCCEEDED_QA_PASS');
} finally {
  await fsp.rm(tempRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({ status: 'PASS', scenarios: 5, checks_per_valid_report: 17 }, null, 2));
