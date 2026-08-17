import assert from 'node:assert/strict';
import {buildPhotoAvatarJob} from './build-photo-avatar-job-from-kit.mjs';

const bindings = ['front', 'rear', 'left', 'right', 'three_quarter', 'detail'].map((view) => ({view, image_gid: `IMG_${view}`}));
const base = {
  review: {candidate_id: 'TEST', product_twin_id: 'PT_TEST', dimension_evidence_state: 'manufacturer_verified', source_image_bindings: bindings, rights: {reconstruction_allowed: 'review', render_allowed: 'review', redistribution_allowed: 'no'}},
  media: {status: 'LIVE_MEDIA_AUDITED', category_id: 'FFE.SEATING.CHAIR', identity: {vendor: 'Test', product_title: 'Test Chair'}},
  inspection: {geometry: {scale_qa: {expected_dimensions_mm: [600, 700, 800], dimension_source: 'manufacturer-spec'}}},
  resolvedUrls: new Map(bindings.map((binding) => [binding.image_gid, `https://temporary.example/${binding.view}.jpg`])),
  generatedAt: '2026-08-17T00:00:00.000Z',
};

assert.equal(buildPhotoAvatarJob(base).status, 'RIGHTS_BLOCKED_NO_JOB_CREATED');
const cleared = structuredClone(base.review);
cleared.rights = {reconstruction_allowed: 'yes', render_allowed: 'yes', redistribution_allowed: 'no', evidence_refs: ['test-clearance']};
const ready = buildPhotoAvatarJob({...base, review: cleared});
assert.equal(ready.status, 'JOB_CREATED_REQUIRES_PREFLIGHT');
assert.equal(ready.preflight.status, 'PASS');
assert.equal(ready.job.promotion.maximum_claim_level, 'G2');
assert.equal(ready.job.promotion.exact_product_claim_allowed, false);
assert.equal(ready.job.source_images.length, 6);
console.log(JSON.stringify({status: 'PASS', scenarios: 2, ready_preflight_checks: ready.preflight.checks_total}, null, 2));
