import assert from 'node:assert/strict';
import { evaluatePhotoAvatarJob } from './preflight-photo-avatar-job.mjs';

const views = ['front', 'rear', 'left', 'right', 'three_quarter'];
const valid = {
  job_id: 'OWNED_PRODUCT_CAPTURE_001',
  subject: { category_id: 'FURNITURE.TABLES', identity_state: 'candidate' },
  source_images: views.map((view, index) => ({
    image_id: `IMG_${index + 1}`,
    source_type: 'user_capture',
    source_uri_or_reference: `https://temporary.example/${view}.jpg`,
    view,
    rights_state: 'cleared_for_reconstruction',
    known_camera: false,
  })),
  rights: { reconstruction_allowed: 'yes', render_allowed: 'yes', redistribution_allowed: 'no', evidence_refs: ['owner-capture-declaration'] },
  dimensions: { width_mm: 500, depth_mm: 400, height_mm: 300, scale_state: 'measured', evidence_ref: 'measurement-photo-001' },
  reconstruction: { engine: 'meshy', mode: 'multi_image_ai', target_format: 'glb' },
  qa: { scale_checked: false, source_view_rerender_required: true, human_review_state: 'not_reviewed' },
  promotion: { maximum_claim_level: 'G2', exact_product_claim_allowed: false, blocking_reasons: ['QA pending'] },
};

assert.equal(evaluatePhotoAvatarJob(valid).status, 'PASS');

const withoutRear = structuredClone(valid);
withoutRear.source_images = withoutRear.source_images.filter((image) => image.view !== 'rear');
assert.ok(evaluatePhotoAvatarJob(withoutRear).blocked_check_ids.includes('required_views'));

const rightsBlocked = structuredClone(valid);
rightsBlocked.rights.reconstruction_allowed = 'review';
assert.ok(evaluatePhotoAvatarJob(rightsBlocked).blocked_check_ids.includes('job_rights'));

const dimensionsMissing = structuredClone(valid);
dimensionsMissing.dimensions.width_mm = null;
assert.ok(evaluatePhotoAvatarJob(dimensionsMissing).blocked_check_ids.includes('known_physical_scale'));

const credentialEmbedded = structuredClone(valid);
credentialEmbedded.reconstruction.api_key = 'sk-should-never-be-here';
assert.ok(evaluatePhotoAvatarJob(credentialEmbedded).blocked_check_ids.includes('no_embedded_credentials'));

const localFile = structuredClone(valid);
localFile.source_images[0].source_uri_or_reference = './photo.jpg';
assert.ok(evaluatePhotoAvatarJob(localFile).blocked_check_ids.includes('temporary_https_image_references'));

console.log(JSON.stringify({ status: 'PASS', scenarios: 6, checks_per_valid_job: 13 }, null, 2));
