import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REQUIRED_VIEWS = ['front', 'rear', 'left', 'right', 'three_quarter'];

function hasEmbeddedSecret(value, key = '') {
  if (/api[_-]?key|access[_-]?token|secret|password|credential/i.test(key)) return true;
  if (typeof value === 'string' && /^(?:sk-|Bearer\s+)[A-Za-z0-9._-]{8,}/i.test(value.trim())) return true;
  if (Array.isArray(value)) return value.some((item) => hasEmbeddedSecret(item));
  if (value && typeof value === 'object') return Object.entries(value).some(([childKey, child]) => hasEmbeddedSecret(child, childKey));
  return false;
}

export function evaluatePhotoAvatarJob(job) {
  const images = Array.isArray(job?.source_images) ? job.source_images : [];
  const cleared = images.filter((image) => image?.rights_state === 'cleared_for_reconstruction');
  const clearedViews = new Set(cleared.map((image) => image?.view));
  const dimensions = job?.dimensions ?? {};
  const positiveDimensions = ['width_mm', 'depth_mm', 'height_mm'].every((key) => Number.isFinite(dimensions[key]) && dimensions[key] > 0);
  const uniqueIds = images.length > 0 && new Set(images.map((image) => image?.image_id)).size === images.length && images.every((image) => typeof image?.image_id === 'string' && image.image_id.trim());
  const checks = [
    { id: 'job_id', pass: typeof job?.job_id === 'string' && job.job_id.trim().length > 0 },
    { id: 'no_embedded_credentials', pass: !hasEmbeddedSecret(job) },
    { id: 'minimum_cleared_images', pass: cleared.length >= 5, actual: cleared.length, required: 5 },
    { id: 'unique_image_ids', pass: uniqueIds },
    { id: 'required_views', pass: REQUIRED_VIEWS.every((view) => clearedViews.has(view)), actual: [...clearedViews], required: REQUIRED_VIEWS },
    { id: 'temporary_https_image_references', pass: cleared.every((image) => /^https:\/\//i.test(String(image?.source_uri_or_reference ?? ''))) },
    { id: 'per_image_rights_clearance', pass: images.length > 0 && images.every((image) => image?.rights_state === 'cleared_for_reconstruction') },
    { id: 'job_rights', pass: job?.rights?.reconstruction_allowed === 'yes' && job?.rights?.render_allowed === 'yes' },
    { id: 'rights_evidence', pass: Array.isArray(job?.rights?.evidence_refs) && job.rights.evidence_refs.some((ref) => typeof ref === 'string' && ref.trim()) },
    { id: 'known_physical_scale', pass: positiveDimensions && ['measured', 'manufacturer_verified'].includes(dimensions.scale_state) && typeof dimensions.evidence_ref === 'string' && dimensions.evidence_ref.trim().length > 0 },
    { id: 'meshy_multi_image_glb', pass: job?.reconstruction?.engine === 'meshy' && job?.reconstruction?.mode === 'multi_image_ai' && job?.reconstruction?.target_format === 'glb' },
    { id: 'source_view_rerender_required', pass: job?.qa?.source_view_rerender_required === true },
    { id: 'exact_product_claim_disabled', pass: job?.promotion?.exact_product_claim_allowed === false },
  ];
  const blocked = checks.filter((check) => !check.pass);
  return {
    status: blocked.length ? 'BLOCKED' : 'PASS',
    checks_total: checks.length,
    checks_passed: checks.length - blocked.length,
    blocked_check_ids: blocked.map((check) => check.id),
    cleared_image_count: cleared.length,
    cleared_views: [...clearedViews],
    checks,
  };
}

async function main() {
  const root = process.cwd();
  const jobPath = process.env.AVATAR_JOB;
  if (!jobPath) throw new Error('AVATAR_JOB is required');
  const job = JSON.parse(await fs.readFile(path.resolve(root, jobPath), 'utf8'));
  const result = {
    generated_at: new Date().toISOString(),
    job_id: job.job_id ?? null,
    ...evaluatePhotoAvatarJob(job),
  };
  const outputPath = path.join(root, 'data/metrics/photo-avatar-preflight-latest.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
