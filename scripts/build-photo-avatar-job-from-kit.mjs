import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {evaluatePhotoAvatarJob} from './preflight-photo-avatar-job.mjs';

const ROOT = process.cwd();
const DEFAULT_CANDIDATE = 'SHOPIFY_MERCHANT_MODEL3D_10584852108';
const reviewPath = 'config/geometry/shopify-seating-reconstruction-evidence-v0.1.json';
const mediaPath = 'data/metrics/shopify-design-public-product-media-latest.json';
const focusedInspectionPath = 'data/metrics/shopify-design-public-model3d-inspection-latest.json';
const broadInspectionPath = 'data/metrics/shopify-furniture-model3d-inspection-latest.json';
const metricPath = 'data/metrics/photo-avatar-job-factory-latest.json';

export function buildPhotoAvatarJob({review, media, inspection, resolvedUrls, generatedAt = new Date().toISOString()}) {
  const rights = review.rights;
  if (rights?.reconstruction_allowed !== 'yes' || rights?.render_allowed !== 'yes') {
    return {
      status: 'RIGHTS_BLOCKED_NO_JOB_CREATED',
      candidate_id: review.candidate_id,
      blockers: [
        ...(rights?.reconstruction_allowed === 'yes' ? [] : ['reconstruction_allowed must be yes']),
        ...(rights?.render_allowed === 'yes' ? [] : ['render_allowed must be yes']),
      ],
    };
  }
  const dimensions = inspection?.geometry?.scale_qa?.expected_dimensions_mm ?? [];
  const scaleState = ['manufacturer_verified', 'measured', 'merchant_claimed', 'estimated', 'unknown'].includes(review.dimension_evidence_state)
    ? review.dimension_evidence_state
    : review.dimension_evidence_state === 'partial_authoritative' ? 'merchant_claimed' : 'unknown';
  const bindings = review.source_image_bindings ?? [];
  const jobId = `PHOTO_${review.candidate_id.replace(/[^A-Za-z0-9]+/g, '_')}_${generatedAt.slice(0, 10).replaceAll('-', '')}`;
  const sourceImages = bindings.map((binding, index) => ({
    image_id: binding.image_gid,
    source_type: 'merchant',
    source_uri_or_reference: resolvedUrls.get(binding.image_gid) ?? null,
    view: binding.view,
    rights_state: 'cleared_for_reconstruction',
    known_camera: false,
    sequence: index + 1,
  }));
  const job = {
    job_id: jobId,
    subject: {
      product_twin_id: review.product_twin_id ?? null,
      category_id: media.category_id,
      manufacturer: media.identity?.vendor ?? null,
      model: media.identity?.product_title ?? null,
      sku: null,
      gtin: null,
      identity_state: media.status === 'LIVE_MEDIA_AUDITED' ? 'verified' : 'candidate',
    },
    source_images: sourceImages,
    rights: {
      reconstruction_allowed: rights.reconstruction_allowed,
      render_allowed: rights.render_allowed,
      redistribution_allowed: rights.redistribution_allowed,
      evidence_refs: rights.evidence_refs ?? [],
    },
    dimensions: {
      width_mm: dimensions[0] ?? null,
      depth_mm: dimensions[1] ?? null,
      height_mm: dimensions[2] ?? null,
      scale_state: scaleState,
      evidence_ref: inspection?.geometry?.scale_qa?.dimension_source ?? null,
    },
    reconstruction: {engine: 'meshy', mode: 'multi_image_ai', target_format: 'glb', target_polycount: 120000, pbr_requested: true, remesh_requested: true},
    qa: {scale_checked: false, source_view_rerender_required: true, material_match_state: 'not_checked', human_review_state: 'not_reviewed'},
    promotion: {maximum_claim_level: 'G2', exact_product_claim_allowed: false, blocking_reasons: ['generation QA pending', 'exact selected visible material remains independently gated']},
  };
  return {status: 'JOB_CREATED_REQUIRES_PREFLIGHT', candidate_id: review.candidate_id, job, preflight: evaluatePhotoAvatarJob(job)};
}

async function resolveImageUrls({merchantOrigin, handle, bindings}) {
  const endpoint = `${merchantOrigin}/api/2026-07/graphql.json`;
  const query = `query ProductTwinPhotoFactory($handle: String!) { product(handle: $handle) { media(first: 100) { nodes { ... on MediaImage { image { id url } } } } } }`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {'content-type': 'application/json', 'user-agent': 'product-twin-photo-avatar-factory/0.1'},
    body: JSON.stringify({query, variables: {handle}}),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`storefront ${response.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  if (json.errors?.length) throw new Error(json.errors.map((item) => item.message).join(' | '));
  const wanted = new Set(bindings.map((binding) => binding.image_gid));
  return new Map((json.data?.product?.media?.nodes ?? []).map((node) => node?.image).filter((image) => image?.id && wanted.has(image.id)).map((image) => [image.id, image.url]));
}

async function main() {
  const read = (relativePath) => fs.readFile(path.join(ROOT, relativePath), 'utf8').then(JSON.parse);
  const [reviewSet, mediaMetric, focused, broad] = await Promise.all([read(reviewPath), read(mediaPath), read(focusedInspectionPath), read(broadInspectionPath)]);
  const candidateId = process.env.AVATAR_KIT_ID ?? DEFAULT_CANDIDATE;
  const reviewBase = reviewSet.products.find((item) => item.candidate_id === candidateId);
  if (!reviewBase) throw new Error(`Unknown AVATAR_KIT_ID: ${candidateId}`);
  const review = {...reviewBase, rights: reviewBase.rights ?? reviewSet.rights};
  const media = mediaMetric.products.find((item) => item.candidate_id === candidateId);
  const inspection = [...(focused.inspections ?? []), ...(broad.inspections ?? [])].find((item) => item.candidate_id === candidateId);
  let resolvedUrls = new Map();
  if (review.rights?.reconstruction_allowed === 'yes' && review.rights?.render_allowed === 'yes') {
    if (!(review.source_image_bindings?.length > 0)) throw new Error('Cleared kit has no source_image_bindings');
    resolvedUrls = await resolveImageUrls({merchantOrigin: reviewSet.merchant_origin, handle: media.identity.handle, bindings: review.source_image_bindings});
  }
  const result = buildPhotoAvatarJob({review, media, inspection, resolvedUrls});
  const metric = {generated_at: new Date().toISOString(), ...result, ...(result.job ? {job: undefined, runtime_job_path: `.runtime/avatars/${result.job.job_id}/job.json`} : {})};
  await fs.writeFile(path.join(ROOT, metricPath), `${JSON.stringify(metric, null, 2)}\n`);
  if (result.job) {
    const runtimePath = path.join(ROOT, '.runtime/avatars', result.job.job_id, 'job.json');
    await fs.mkdir(path.dirname(runtimePath), {recursive: true});
    await fs.writeFile(runtimePath, `${JSON.stringify(result.job, null, 2)}\n`);
  }
  console.log(JSON.stringify(metric, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
