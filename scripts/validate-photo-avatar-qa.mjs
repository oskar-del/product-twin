import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function finite(value) {
  return Number.isFinite(value);
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => fs.createReadStream(filePath).on('data', (chunk) => hash.update(chunk)).on('end', resolve).on('error', reject));
  return hash.digest('hex');
}

export function evaluatePhotoAvatarQa({ generationMetric, report, contract, asset }) {
  const requiredViews = contract.required_views ?? [];
  const thresholds = contract.thresholds ?? {};
  const required = contract.required_states ?? {};
  const comparisons = Array.isArray(report?.view_comparisons) ? report.view_comparisons : [];
  const byView = new Map(comparisons.map((comparison) => [comparison.view, comparison]));
  const requiredComparisons = requiredViews.map((view) => byView.get(view)).filter(Boolean);
  const silhouetteErrors = requiredComparisons.map((comparison) => comparison.silhouette_error_percent);
  const landmarkErrors = requiredComparisons.map((comparison) => comparison.landmark_error_percent);
  const expected = generationMetric?.expected_dimensions_mm ?? {};
  const measured = report?.measured_model_dimensions_mm ?? {};
  const axes = ['width', 'depth', 'height'];
  const dimensionErrors = Object.fromEntries(axes.map((axis) => [axis, finite(expected[axis]) && expected[axis] > 0 && finite(measured[axis]) ? Math.abs(measured[axis] - expected[axis]) / expected[axis] * 100 : null]));
  const coverage = report?.coverage ?? {};
  const coverageValues = [coverage.observed_surface_percent, coverage.inferred_surface_percent, coverage.unresolved_surface_percent];
  const coverageSum = coverageValues.every(finite) ? coverageValues.reduce((sum, value) => sum + value, 0) : null;
  const meanSilhouette = silhouetteErrors.length === requiredViews.length && silhouetteErrors.every(finite) ? mean(silhouetteErrors) : null;
  const meanLandmark = landmarkErrors.length === requiredViews.length && landmarkErrors.every(finite) ? mean(landmarkErrors) : null;
  const checks = [
    { id: 'generation_ready_for_qa', pass: generationMetric?.status === required.generation },
    { id: 'job_identity_match', pass: typeof report?.job_id === 'string' && report.job_id === generationMetric?.job_id },
    { id: 'runtime_glb_asset', pass: asset?.insideRuntime === true && asset?.magic === contract.asset_policy?.required_magic && asset?.bytes > 12 },
    { id: 'five_view_capture_recorded', pass: Number(generationMetric?.capture_view_count ?? 0) >= requiredViews.length && requiredViews.every((view) => generationMetric?.capture_views?.includes(view)) },
    { id: 'required_view_comparisons', pass: requiredComparisons.length === requiredViews.length },
    { id: 'per_view_review_accepted', pass: requiredComparisons.length === requiredViews.length && requiredComparisons.every((comparison) => comparison.reviewer_state === required.per_view_review) },
    { id: 'per_view_silhouette_threshold', pass: silhouetteErrors.length === requiredViews.length && silhouetteErrors.every((value) => finite(value) && value <= thresholds.maximum_per_view_silhouette_error_percent) },
    { id: 'mean_silhouette_threshold', pass: finite(meanSilhouette) && meanSilhouette <= thresholds.maximum_mean_silhouette_error_percent, actual: meanSilhouette },
    { id: 'per_view_landmark_threshold', pass: landmarkErrors.length === requiredViews.length && landmarkErrors.every((value) => finite(value) && value <= thresholds.maximum_per_view_landmark_error_percent) },
    { id: 'mean_landmark_threshold', pass: finite(meanLandmark) && meanLandmark <= thresholds.maximum_mean_landmark_error_percent, actual: meanLandmark },
    { id: 'physical_scale_threshold', pass: axes.every((axis) => finite(dimensionErrors[axis]) && dimensionErrors[axis] <= thresholds.maximum_axis_dimension_error_percent), actual: dimensionErrors },
    { id: 'coverage_sum', pass: finite(coverageSum) && Math.abs(coverageSum - 100) <= thresholds.coverage_sum_tolerance_percent, actual: coverageSum },
    { id: 'observed_surface_threshold', pass: finite(coverage.observed_surface_percent) && coverage.observed_surface_percent >= thresholds.minimum_observed_surface_percent },
    { id: 'unresolved_surface_threshold', pass: finite(coverage.unresolved_surface_percent) && coverage.unresolved_surface_percent <= thresholds.maximum_unresolved_surface_percent },
    { id: 'human_review_accepted', pass: report?.human_review_state === required.human_review },
    { id: 'render_rights_evidence', pass: report?.rights_review?.render_allowed === required.render_allowed && Array.isArray(report?.rights_review?.evidence_refs) && report.rights_review.evidence_refs.some((value) => typeof value === 'string' && value.trim()) },
    { id: 'claim_ceiling', pass: report?.promotion?.maximum_claim_level === required.maximum_claim_level && report?.promotion?.exact_product_claim_allowed === required.exact_product_claim_allowed && report?.promotion?.engineering_interface_claim_allowed === required.engineering_interface_claim_allowed },
  ];
  const blocked = checks.filter((check) => !check.pass);
  return {
    status: blocked.length ? 'BLOCKED' : 'PASS',
    checks_total: checks.length,
    checks_passed: checks.length - blocked.length,
    blocked_check_ids: blocked.map((check) => check.id),
    computed: {
      mean_silhouette_error_percent: meanSilhouette,
      mean_landmark_error_percent: meanLandmark,
      dimension_error_percent: dimensionErrors,
      coverage_sum_percent: coverageSum,
    },
    checks,
  };
}

export async function validatePhotoAvatarQa({ root = process.cwd(), reportPath, generationMetricPath = 'data/metrics/meshy-avatar-job-latest.json', contractPath = 'config/geometry/photo-avatar-qa-contract.json' }) {
  if (!reportPath) throw new Error('PHOTO_AVATAR_QA is required');
  const [generationMetric, report, contract] = await Promise.all([
    fsp.readFile(path.resolve(root, generationMetricPath), 'utf8').then(JSON.parse),
    fsp.readFile(path.resolve(root, reportPath), 'utf8').then(JSON.parse),
    fsp.readFile(path.resolve(root, contractPath), 'utf8').then(JSON.parse),
  ]);
  const assetPath = path.resolve(root, generationMetric.runtime_asset_path ?? '');
  const runtimeRoot = path.resolve(root, '.runtime');
  const insideRuntime = assetPath.startsWith(`${runtimeRoot}${path.sep}`);
  let asset = { insideRuntime, bytes: 0, magic: null, sha256: null };
  if (insideRuntime) {
    try {
      const handle = await fsp.open(assetPath, 'r');
      try {
        const stat = await handle.stat();
        const header = Buffer.alloc(4);
        await handle.read(header, 0, 4, 0);
        asset = { insideRuntime, bytes: stat.size, magic: header.toString('ascii'), sha256: await sha256(assetPath) };
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  const evaluation = evaluatePhotoAvatarQa({ generationMetric, report, contract, asset });
  const qaMetric = {
    generated_at: new Date().toISOString(),
    job_id: report.job_id ?? null,
    ...evaluation,
    status: evaluation.status === 'PASS' ? 'SUCCEEDED_QA_PASS' : 'QA_BLOCKED',
    asset,
    coverage: report.coverage ?? null,
    human_review_state: report.human_review_state ?? null,
    promotion: report.promotion ?? null,
  };
  const qaMetricPath = path.join(root, 'data/metrics/photo-avatar-qa-latest.json');
  await fsp.mkdir(path.dirname(qaMetricPath), { recursive: true });
  await fsp.writeFile(qaMetricPath, JSON.stringify(qaMetric, null, 2) + '\n');
  if (evaluation.status === 'PASS') {
    const promotedMetric = {
      ...generationMetric,
      generated_at: qaMetric.generated_at,
      status: 'SUCCEEDED_QA_PASS',
      asset_sha256: asset.sha256,
      coverage: report.coverage,
      qa: {
        human_review_state: report.human_review_state,
        view_comparisons: report.view_comparisons,
        measured_model_dimensions_mm: report.measured_model_dimensions_mm,
        computed: evaluation.computed,
      },
      maximum_claim_level_after_qa: requiredClaim(contract),
      exact_product_claim_allowed: false,
      engineering_interface_claim_allowed: false,
    };
    await fsp.writeFile(path.resolve(root, generationMetricPath), JSON.stringify(promotedMetric, null, 2) + '\n');
  }
  return qaMetric;
}

function requiredClaim(contract) {
  return contract?.required_states?.maximum_claim_level ?? 'G2';
}

async function main() {
  const result = await validatePhotoAvatarQa({ reportPath: process.env.PHOTO_AVATAR_QA });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'SUCCEEDED_QA_PASS') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
