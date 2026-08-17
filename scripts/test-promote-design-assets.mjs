import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import {
  evaluatePromotionAsset,
  MANUAL_PROMOTION_CLAIMS,
  promoteDesignAssets,
  validatePromotionEvidence,
} from './promote-design-assets.mjs';

const read = async (file) => JSON.parse(await fsp.readFile(file, 'utf8'));
const [pilot, intake, conversion, visualQa, visualReview, evidence, contract] = await Promise.all([
  read('config/geometry/sweet-home-3d-design-asset-pilot-v0.1.json'),
  read('data/metrics/sweet-home-3d-design-asset-intake-latest.json'),
  read('data/metrics/sweet-home-3d-design-asset-conversion-latest.json'),
  read('data/metrics/kator-legaz-design-asset-visual-qa-v0.1.json'),
  read('data/evidence/kator-legaz-design-asset-visual-review-v0.1.json'),
  read('data/evidence/kator-legaz-design-asset-promotion-evidence-v0.1.json'),
  read('config/geometry/design-asset-publication-contract-v0.1.json'),
]);

validatePromotionEvidence(evidence, contract);
const current = await promoteDesignAssets({now: new Date('2026-08-17T16:00:00.000Z')});
assert.deepEqual(current.summary, {assets: 12, g1_blocked: 12, g2_ready: 0, publication_allowed: 0});
assert.ok(current.assets.every((asset) => asset.blockers.includes('independent_scale_qa_passed')));
assert.ok(current.assets.every((asset) => asset.blockers.includes('stable_public_asset_reference_absent')));

const candidate = structuredClone(pilot.candidates[0]);
const ingested = structuredClone(intake.assets[0]);
const converted = structuredClone(conversion.assets[0]);
const visual = structuredClone(visualQa.assets[0]);
const review = structuredClone(visualReview.assets[0]);
Object.assign(review, {
  render_visual_verdict: 'PASS',
  orientation: 'PASS',
  silhouette: 'PASS',
  source_rotation: 'PASS',
  proportions: 'PASS',
  floor_contact: 'PASS',
  centre_pivot: 'PASS',
  normals_back_faces: 'PASS',
  texture_embedding: 'NO_SOURCE_TEXTURE_EXPECTED_MATERIAL_ONLY',
  glass_alpha: 'NOT_APPLICABLE',
  material_colours: 'PASS',
});
const baseClaim = {
  status: 'PASS',
  reviewer: 'Independent QA Fixture',
  reviewed_at: '2026-08-17T15:55:00Z',
  evidence_refs: ['data/evidence/fixture-independent-review.json'],
  note: 'Independent fixture evidence confirms this gate for deterministic promotion testing.',
};
const passingEvidence = {
  design_asset_id: candidate.design_asset_id,
  geometry_sha256: converted.sha256,
  public_asset_reference: 'https://assets.example.test/design-assets/fixture.glb',
  claims: {
    rights_source_verified: {...baseClaim, license_id: converted.attribution.license_id, source_url: converted.attribution.source_url},
    redistribution_allowed: {...baseClaim, distribution_scope: 'ROOM_LAB_PUBLIC_ASSET_REDISTRIBUTION'},
    source_orientation_applied: {...baseClaim},
    back_face_policy_applied: {...baseClaim},
    texture_embedding_verified: {...baseClaim},
    canonical_view_visual_qa_passed: {...baseClaim},
    independent_scale_qa_passed: {
      ...baseClaim,
      method: 'INDEPENDENT_SOURCE_MEASUREMENT',
      reference_uri: 'data/evidence/fixture-independent-scale.json',
      reference_dimensions_mm: structuredClone(converted.measured_mm),
      maximum_axis_error_mm: 1,
    },
    attribution_display_verified: {...baseClaim, display_surfaces: structuredClone(contract.visible_attribution.display_surfaces)},
  },
};
const passingDocument = {
  version: '0.1',
  record_lane: 'DESIGN_ASSET',
  publication_surface: 'ROOM_LAB',
  evidence_policy: 'Synthetic evidence document used only to prove the fail-closed promotion path.',
  assets: [passingEvidence],
};
validatePromotionEvidence(passingDocument, contract);
const evaluate = (assetEvidence = passingEvidence, assetReview = review) => evaluatePromotionAsset({candidate, ingested, converted, visual, review: assetReview, evidence: assetEvidence, publicationContract: contract});
const promoted = evaluate();
assert.equal(promoted.geometry_state, 'G2');
assert.equal(promoted.publication_state, 'PUBLISHABLE_G2');
assert.equal(promoted.publication_allowed, true);
assert.ok(Object.values(promoted.gates).every(Boolean));
assert.equal(promoted.public_asset_reference, passingEvidence.public_asset_reference);

for (const gate of MANUAL_PROMOTION_CLAIMS) {
  const mutation = structuredClone(passingEvidence);
  delete mutation.claims[gate];
  const decision = evaluate(mutation);
  assert.equal(decision.gates[gate], false, `${gate} must fail closed when its claim is absent`);
  assert.equal(decision.publication_allowed, false);
}

const incompleteAttribution = structuredClone(passingEvidence);
incompleteAttribution.claims.attribution_display_verified.display_surfaces.pop();
assert.equal(evaluate(incompleteAttribution).gates.attribution_display_verified, false);
const wrongScale = structuredClone(passingEvidence);
wrongScale.claims.independent_scale_qa_passed.reference_dimensions_mm.width += 100;
assert.equal(evaluate(wrongScale).gates.independent_scale_qa_passed, false);
const blockedReview = structuredClone(review);
blockedReview.glass_alpha = 'BLOCKED_OPAQUE_TOP';
assert.equal(evaluate(passingEvidence, blockedReview).gates.canonical_view_visual_qa_passed, false);

const cloneDocument = () => structuredClone(passingDocument);
const unknownClaimField = cloneDocument();
unknownClaimField.assets[0].claims.source_orientation_applied.confidence = 1;
assert.throws(() => validatePromotionEvidence(unknownClaimField, contract), /strict allowlist/);
const pendingClaim = cloneDocument();
pendingClaim.assets[0].claims.source_orientation_applied.status = 'PENDING';
assert.throws(() => validatePromotionEvidence(pendingClaim, contract), /PASS or FAIL/);
const runtimeEvidence = cloneDocument();
runtimeEvidence.assets[0].claims.source_orientation_applied.evidence_refs = ['.runtime/private/review.json'];
assert.throws(() => validatePromotionEvidence(runtimeEvidence, contract), /runtime-only/);
const runtimeAsset = cloneDocument();
runtimeAsset.assets[0].public_asset_reference = 'https://assets.example.test/.runtime/model.glb';
assert.throws(() => validatePromotionEvidence(runtimeAsset, contract), /stable HTTPS/);
const declaredEnvelope = cloneDocument();
declaredEnvelope.assets[0].claims.independent_scale_qa_passed.method = 'LIBRARY_DECLARED_ENVELOPE';
assert.throws(() => validatePromotionEvidence(declaredEnvelope, contract), /independent/);
const commercePoison = cloneDocument();
commercePoison.assets[0].claims.source_orientation_applied.unitPriceEUR = 100;
assert.throws(() => validatePromotionEvidence(commercePoison, contract), /strict allowlist|forbidden/);
const wrongHash = structuredClone(passingEvidence);
wrongHash.geometry_sha256 = 'a'.repeat(64);
assert.throws(() => evaluate(wrongHash), /not bound/);

console.log(JSON.stringify({
  status: 'PASS',
  current_assets: current.summary.assets,
  current_g2: current.summary.g2_ready,
  synthetic_g2_path: promoted.publication_allowed,
  missing_claim_checks: MANUAL_PROMOTION_CLAIMS.length,
  poison_mutations: 7,
}));
