import assert from 'node:assert/strict';
import {evaluateReconstructionKit} from './evaluate-avatar-reconstruction-readiness.mjs';

const contract = {
  contract_id: 'TEST',
  axes: {
    identity: {verified_product: 100, candidate_product: 60, unresolved: 0},
    dimensions: {manufacturer_verified: 100, measured: 100, merchant_claimed: 75, partial_authoritative: 55, estimated: 35, unknown: 0},
    view_coverage_weights: {front: 20, rear: 15, left: 10, right: 10, three_quarter: 20, detail: 15, top: 5, bottom: 5},
    image_quality: {volume_max: 40, reconstruction_resolution_max: 40, high_resolution_bonus: 10, isolated_background_bonus: 10},
    material_evidence: {detail_view: 25, variant_image_present_unresolved: 10, exact_visible_variant_bound: 30, embedded_pbr_texture: 25, embedded_normal_map: 20},
    geometry_prior: {native_model_present: 50, manufacturer_scale_qa_pass: 25, embedded_texture: 15, embedded_normal_map: 10},
    rights: {reconstruction_yes: 50, reconstruction_review: 15, render_yes: 40, render_review: 10, redistribution_yes: 10},
  },
  input_bands: {
    strong_p2: {identity_min: 80, dimensions_min: 90, view_coverage_min: 70, image_quality_min: 60},
    usable_p2_with_limits: {identity_min: 60, dimensions_min: 50, view_coverage_min: 50, image_quality_min: 45},
  },
  policy: {maximum_photo_reconstruction_claim_before_qa: 'G1', maximum_photo_reconstruction_claim_after_v0_qa: 'G2'},
};
const media = {candidate_id: 'A', status: 'LIVE_MEDIA_AUDITED', identity: {product_title: 'Test Chair'}, media_counts: {IMAGE: 8}, image_evidence: {unique_binary_images: 8, reconstruction_resolution_images: 8, images_1600px_or_larger: 0, images_with_variant_binding: 1}};
const inspection = {candidate_id: 'A', geometry: {scale_qa: {pass: true}}, materials: {texture_count: 0, materials: []}};
const baseReview = {candidate_id: 'A', observed_views: ['front', 'rear', 'left', 'right', 'three_quarter', 'detail'], isolated_background: true, dimension_evidence_state: 'manufacturer_verified', variant_visual_binding_state: 'present_unresolved'};

const blocked = evaluateReconstructionKit({contract, reviewSet: {rights: {reconstruction_allowed: 'review', render_allowed: 'review', redistribution_allowed: 'no'}, products: [baseReview]}, mediaMetric: {products: [media]}, inspections: [inspection]});
assert.equal(blocked.kits[0].photo_input_band, 'STRONG_P2_MULTI_VIEW_INPUT');
assert.equal(blocked.kits[0].queue_state, 'NOT_QUEUED_RECONSTRUCTION_RIGHTS_REVIEW');
assert.equal(blocked.kits[0].presentation.public_presentation_allowed, false);

const clearedReview = {...baseReview, rights: {reconstruction_allowed: 'yes', render_allowed: 'yes', redistribution_allowed: 'no'}};
const ready = evaluateReconstructionKit({contract, reviewSet: {products: [clearedReview]}, mediaMetric: {products: [media]}, inspections: [inspection]});
assert.equal(ready.kits[0].queue_state, 'READY_FOR_G2_GENERATION_PREFLIGHT');
assert.equal(ready.kits[0].presentation.maximum_claim_before_generation_qa, 'G1');

const weakReview = {...clearedReview, observed_views: ['front'], dimension_evidence_state: 'unknown'};
const weak = evaluateReconstructionKit({contract, reviewSet: {products: [weakReview]}, mediaMetric: {products: [media]}, inspections: [inspection]});
assert.equal(weak.kits[0].photo_input_band, 'P1_VISUAL_REFERENCE_ONLY');
assert.equal(weak.kits[0].queue_state, 'HOLD_FOR_MORE_EVIDENCE');

assert.equal('global_confidence_score' in ready.kits[0], false);
console.log(JSON.stringify({status: 'PASS', scenarios: 3, policy: 'separate_axis_scores_no_global_confidence'}, null, 2));
