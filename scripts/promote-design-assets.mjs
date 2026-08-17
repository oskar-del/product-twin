import fsp from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {assertNoDesignAssetCommerce} from './lib/design-asset-truth.mjs';
import {REQUIRED_PUBLICATION_GATES, validatePublicationContract} from './lib/design-asset-publication.mjs';

export const MANUAL_PROMOTION_CLAIMS = Object.freeze(REQUIRED_PUBLICATION_GATES.filter((gate) => gate !== 'all_model_dependencies_resolved'));
export const TECHNICAL_G2_GATES = Object.freeze([
  'all_model_dependencies_resolved',
  'source_orientation_applied',
  'back_face_policy_applied',
  'texture_embedding_verified',
  'canonical_view_visual_qa_passed',
  'independent_scale_qa_passed',
]);

const TOP_LEVEL_KEYS = new Set(['version', 'record_lane', 'publication_surface', 'evidence_policy', 'assets']);
const ASSET_KEYS = new Set(['design_asset_id', 'geometry_sha256', 'public_asset_reference', 'claims']);
const COMMON_CLAIM_KEYS = ['status', 'reviewer', 'reviewed_at', 'evidence_refs', 'note'];
const CLAIM_EXTRA_KEYS = {
  rights_source_verified: ['license_id', 'source_url'],
  redistribution_allowed: ['distribution_scope'],
  source_orientation_applied: [],
  back_face_policy_applied: [],
  texture_embedding_verified: [],
  canonical_view_visual_qa_passed: [],
  independent_scale_qa_passed: ['method', 'reference_uri', 'reference_dimensions_mm', 'maximum_axis_error_mm'],
  attribution_display_verified: ['display_surfaces'],
};
const CANONICAL_VIEWS = ['front', 'rear', 'left', 'right', 'three_quarter', 'top', 'floor_contact'];

function exactKeys(value, allowed, location) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`${location}: fields outside the strict allowlist: ${unknown.join(', ')}`);
}

function object(value, location) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${location} must be an object`);
  return value;
}

function string(value, location) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${location} must be a non-empty string`);
}

function finite(value, location) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${location} must be a finite number`);
}

function sha256(value, location) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) throw new Error(`${location} must be a lowercase SHA-256 digest`);
}

function durableEvidenceRef(value, location) {
  string(value, location);
  if (value.startsWith('.runtime/') || value.includes('/.runtime/')) throw new Error(`${location} must not point to runtime-only evidence`);
  if (!/^https:\/\//.test(value) && !/^(data|config|docs)\//.test(value)) throw new Error(`${location} must be an HTTPS URL or a durable repository evidence path`);
}

function validateClaim(claim, gate, location) {
  object(claim, location);
  exactKeys(claim, new Set([...COMMON_CLAIM_KEYS, ...CLAIM_EXTRA_KEYS[gate]]), location);
  if (!['PASS', 'FAIL'].includes(claim.status)) throw new Error(`${location}.status must be PASS or FAIL; omit the claim while pending`);
  string(claim.reviewer, `${location}.reviewer`);
  string(claim.reviewed_at, `${location}.reviewed_at`);
  if (!Number.isFinite(Date.parse(claim.reviewed_at))) throw new Error(`${location}.reviewed_at must be an ISO date-time`);
  string(claim.note, `${location}.note`);
  if (claim.note.trim().length < 20) throw new Error(`${location}.note must contain at least 20 characters`);
  if (!Array.isArray(claim.evidence_refs) || claim.evidence_refs.length === 0) throw new Error(`${location}.evidence_refs must contain at least one durable reference`);
  claim.evidence_refs.forEach((item, index) => durableEvidenceRef(item, `${location}.evidence_refs[${index}]`));
  if (gate === 'rights_source_verified') {
    string(claim.license_id, `${location}.license_id`);
    string(claim.source_url, `${location}.source_url`);
    if (!/^https:\/\//.test(claim.source_url)) throw new Error(`${location}.source_url must be HTTPS`);
  }
  if (gate === 'redistribution_allowed' && claim.distribution_scope !== 'ROOM_LAB_PUBLIC_ASSET_REDISTRIBUTION') {
    throw new Error(`${location}.distribution_scope must be ROOM_LAB_PUBLIC_ASSET_REDISTRIBUTION`);
  }
  if (gate === 'independent_scale_qa_passed') {
    string(claim.method, `${location}.method`);
    if (/declared|envelope|library.metadata/i.test(claim.method)) throw new Error(`${location}.method must be independent of declared-envelope or library metadata`);
    string(claim.reference_uri, `${location}.reference_uri`);
    if (!/^https:\/\//.test(claim.reference_uri) && !/^data\/evidence\//.test(claim.reference_uri)) throw new Error(`${location}.reference_uri must be HTTPS or durable data/evidence`);
    object(claim.reference_dimensions_mm, `${location}.reference_dimensions_mm`);
    exactKeys(claim.reference_dimensions_mm, new Set(['width', 'depth', 'height']), `${location}.reference_dimensions_mm`);
    for (const axis of ['width', 'depth', 'height']) {
      finite(claim.reference_dimensions_mm[axis], `${location}.reference_dimensions_mm.${axis}`);
      if (claim.reference_dimensions_mm[axis] <= 0) throw new Error(`${location}.reference_dimensions_mm.${axis} must be positive`);
    }
    finite(claim.maximum_axis_error_mm, `${location}.maximum_axis_error_mm`);
    if (claim.maximum_axis_error_mm < 0) throw new Error(`${location}.maximum_axis_error_mm must not be negative`);
  }
  if (gate === 'attribution_display_verified') {
    if (!Array.isArray(claim.display_surfaces) || claim.display_surfaces.some((item) => typeof item !== 'string')) throw new Error(`${location}.display_surfaces must be an array of strings`);
  }
}

export function validatePromotionEvidence(evidence, publicationContract) {
  object(evidence, 'promotion_evidence');
  exactKeys(evidence, TOP_LEVEL_KEYS, 'promotion_evidence');
  if (evidence.version !== '0.1') throw new Error('promotion_evidence.version must be 0.1');
  if (evidence.record_lane !== 'DESIGN_ASSET') throw new Error('promotion_evidence.record_lane must be DESIGN_ASSET');
  if (evidence.publication_surface !== 'ROOM_LAB') throw new Error('promotion_evidence.publication_surface must be ROOM_LAB');
  string(evidence.evidence_policy, 'promotion_evidence.evidence_policy');
  validatePublicationContract(publicationContract);
  if (!Array.isArray(evidence.assets)) throw new Error('promotion_evidence.assets must be an array');
  const ids = new Set();
  for (const [index, asset] of evidence.assets.entries()) {
    const location = `promotion_evidence.assets[${index}]`;
    object(asset, location);
    exactKeys(asset, ASSET_KEYS, location);
    string(asset.design_asset_id, `${location}.design_asset_id`);
    if (ids.has(asset.design_asset_id)) throw new Error(`${location}.design_asset_id is duplicated`);
    ids.add(asset.design_asset_id);
    sha256(asset.geometry_sha256, `${location}.geometry_sha256`);
    if (asset.public_asset_reference !== null) {
      string(asset.public_asset_reference, `${location}.public_asset_reference`);
      if (!/^https:\/\//.test(asset.public_asset_reference) || asset.public_asset_reference.includes('.runtime')) throw new Error(`${location}.public_asset_reference must be a stable HTTPS reference, never a runtime path`);
    }
    object(asset.claims, `${location}.claims`);
    exactKeys(asset.claims, new Set(MANUAL_PROMOTION_CLAIMS), `${location}.claims`);
    for (const [gate, claim] of Object.entries(asset.claims)) validateClaim(claim, gate, `${location}.claims.${gate}`);
  }
  assertNoDesignAssetCommerce(evidence, 'promotion_evidence');
  return evidence;
}

function exactSet(values, expected) {
  return Array.isArray(values) && values.length === expected.length && values.every((value) => expected.includes(value)) && new Set(values).size === values.length;
}

function claimPassed(evidence, gate) {
  return evidence.claims[gate]?.status === 'PASS';
}

function scaleMatches(converted, claim) {
  if (!claimPassed({claims: {independent_scale_qa_passed: claim}}, 'independent_scale_qa_passed')) return false;
  const measured = converted?.measured_mm;
  if (!measured) return false;
  return ['width', 'depth', 'height'].every((axis) => Math.abs(measured[axis] - claim.reference_dimensions_mm[axis]) <= claim.maximum_axis_error_mm);
}

export function evaluatePromotionAsset({candidate, ingested, converted, visual, review, evidence, publicationContract}) {
  if (!candidate || !ingested || !converted || !visual || !review || !evidence) throw new Error('promotion evaluation requires candidate, intake, conversion, render, review and promotion evidence records');
  if (evidence.geometry_sha256 !== converted.sha256 || visual.runtime_glb_sha256 !== converted.sha256) throw new Error(`${candidate.design_asset_id}: promotion evidence is not bound to the converted GLB hash`);
  const dependenciesResolved = ingested.intake_state === 'DOWNLOADED_UNVERIFIED_CONVERSION_REQUIRED'
    && Array.isArray(ingested.blockers) && ingested.blockers.length === 0
    && (ingested.model?.dependencies ?? []).every((dependency) => dependency.required !== true || dependency.state === 'RESOLVED');
  const viewsComplete = visual.automated_checks?.all_seven_views_rendered === true
    && exactSet(visual.views?.map((item) => item.view), CANONICAL_VIEWS);
  const geometryChecks = visual.automated_checks ?? {};
  const textureReviewPass = review.texture_embedding === 'PASS_GLTF_EMBEDDED_AND_RENDERED'
    || review.texture_embedding === 'NO_SOURCE_TEXTURE_EXPECTED_MATERIAL_ONLY';
  const orientationReviewPass = review.source_rotation === 'PASS'
    && (String(review.orientation).startsWith('PASS') || String(review.orientation).startsWith('NON_DIAGNOSTIC'));
  const visualReviewPass = review.render_visual_verdict === 'PASS'
    && String(review.silhouette).startsWith('PASS')
    && String(review.proportions).startsWith('PASS')
    && String(review.floor_contact).startsWith('PASS')
    && review.centre_pivot === 'PASS'
    && review.normals_back_faces === 'PASS'
    && String(review.material_colours).startsWith('PASS')
    && !String(review.glass_alpha).startsWith('BLOCKED');
  const rightsClaim = evidence.claims.rights_source_verified;
  const scaleClaim = evidence.claims.independent_scale_qa_passed;
  const attributionClaim = evidence.claims.attribution_display_verified;
  const requiredSurfaces = publicationContract.visible_attribution.required_fields?.length
    ? publicationContract.visible_attribution.display_surfaces
    : [];
  const gates = {
    rights_source_verified: claimPassed(evidence, 'rights_source_verified')
      && rightsClaim.license_id === converted.attribution?.license_id
      && rightsClaim.source_url === converted.attribution?.source_url,
    redistribution_allowed: claimPassed(evidence, 'redistribution_allowed')
      && evidence.claims.redistribution_allowed.distribution_scope === 'ROOM_LAB_PUBLIC_ASSET_REDISTRIBUTION',
    all_model_dependencies_resolved: dependenciesResolved,
    source_orientation_applied: claimPassed(evidence, 'source_orientation_applied') && orientationReviewPass && Boolean(converted.source_transform),
    back_face_policy_applied: claimPassed(evidence, 'back_face_policy_applied') && review.normals_back_faces === 'PASS' && Boolean(converted.source_transform),
    texture_embedding_verified: claimPassed(evidence, 'texture_embedding_verified') && textureReviewPass,
    canonical_view_visual_qa_passed: claimPassed(evidence, 'canonical_view_visual_qa_passed')
      && viewsComplete
      && geometryChecks.finite_geometry === true
      && geometryChecks.floor_contact_error_mm <= 1
      && Math.abs(geometryChecks.centre_pivot_offset_mm?.x ?? Infinity) <= 1
      && Math.abs(geometryChecks.centre_pivot_offset_mm?.z ?? Infinity) <= 1
      && visualReviewPass,
    independent_scale_qa_passed: Boolean(scaleClaim) && scaleMatches(converted, scaleClaim),
    attribution_display_verified: claimPassed(evidence, 'attribution_display_verified')
      && exactSet(attributionClaim.display_surfaces, requiredSurfaces)
      && converted.attribution?.display_required === true,
  };
  const geometryState = TECHNICAL_G2_GATES.every((gate) => gates[gate]) ? 'G2' : 'G1';
  const allGatesPass = REQUIRED_PUBLICATION_GATES.every((gate) => gates[gate]);
  const stableReferencePresent = typeof evidence.public_asset_reference === 'string' && /^https:\/\//.test(evidence.public_asset_reference);
  const publicationAllowed = allGatesPass && stableReferencePresent;
  const blockers = REQUIRED_PUBLICATION_GATES.filter((gate) => !gates[gate]);
  if (!stableReferencePresent) blockers.push('stable_public_asset_reference_absent');
  if (!gates.canonical_view_visual_qa_passed) blockers.push(...(review.blockers ?? []).map((item) => `visual_review:${item}`));
  return assertNoDesignAssetCommerce({
    design_asset_id: candidate.design_asset_id,
    identity_scope: 'GENERIC_DESIGN_ASSET',
    not_a_product_twin: true,
    geometry_sha256: converted.sha256,
    geometry_state: geometryState,
    publication_state: publicationAllowed ? 'PUBLISHABLE_G2' : geometryState === 'G2' ? 'G2_PUBLICATION_BLOCKED' : 'G1_PROMOTION_BLOCKED',
    publication_allowed: publicationAllowed,
    public_asset_reference: publicationAllowed ? evidence.public_asset_reference : null,
    gates,
    evidence_claim_status: Object.fromEntries(MANUAL_PROMOTION_CLAIMS.map((gate) => [gate, evidence.claims[gate]?.status ?? 'PENDING'])),
    blockers,
  }, `promotion_decision.${candidate.design_asset_id}`);
}

async function readJson(filePath) {
  return JSON.parse(await fsp.readFile(filePath, 'utf8'));
}

export async function promoteDesignAssets({root = process.cwd(), env = process.env, now = new Date()} = {}) {
  const [pilot, intake, conversion, visualQa, visualReview, promotionEvidence, publicationContract] = await Promise.all([
    readJson(path.join(root, env.DESIGN_ASSET_PILOT ?? 'config/geometry/sweet-home-3d-design-asset-pilot-v0.1.json')),
    readJson(path.join(root, env.DESIGN_ASSET_INTAKE ?? 'data/metrics/sweet-home-3d-design-asset-intake-latest.json')),
    readJson(path.join(root, env.DESIGN_ASSET_CONVERSION ?? 'data/metrics/sweet-home-3d-design-asset-conversion-latest.json')),
    readJson(path.join(root, env.DESIGN_ASSET_VISUAL_QA ?? 'data/metrics/kator-legaz-design-asset-visual-qa-v0.1.json')),
    readJson(path.join(root, env.DESIGN_ASSET_VISUAL_REVIEW ?? 'data/evidence/kator-legaz-design-asset-visual-review-v0.1.json')),
    readJson(path.join(root, env.DESIGN_ASSET_PROMOTION_EVIDENCE ?? 'data/evidence/kator-legaz-design-asset-promotion-evidence-v0.1.json')),
    readJson(path.join(root, env.DESIGN_ASSET_PUBLICATION_CONTRACT ?? 'config/geometry/design-asset-publication-contract-v0.1.json')),
  ]);
  validatePromotionEvidence(promotionEvidence, publicationContract);
  const publicationGates = validatePublicationContract(publicationContract);
  const maps = [intake, conversion, visualQa, visualReview, promotionEvidence].map((source) => {
    const result = new Map(source.assets.map((item) => [item.design_asset_id, item]));
    if (result.size !== source.assets.length) throw new Error('promotion input contains duplicate design_asset_id values');
    return result;
  });
  const pilotIds = new Set(pilot.candidates.map((item) => item.design_asset_id));
  const evidenceIds = new Set(promotionEvidence.assets.map((item) => item.design_asset_id));
  const missing = [...pilotIds].filter((id) => !evidenceIds.has(id));
  const unexpected = [...evidenceIds].filter((id) => !pilotIds.has(id));
  if (missing.length || unexpected.length) throw new Error(`promotion evidence coverage mismatch; missing=[${missing.join(',')}], unexpected=[${unexpected.join(',')}]`);
  const assets = pilot.candidates.map((candidate) => evaluatePromotionAsset({
    candidate,
    ingested: maps[0].get(candidate.design_asset_id),
    converted: maps[1].get(candidate.design_asset_id),
    visual: maps[2].get(candidate.design_asset_id),
    review: maps[3].get(candidate.design_asset_id),
    evidence: maps[4].get(candidate.design_asset_id),
    publicationContract,
  }));
  const metric = {
    version: '0.1',
    generated_at: now.toISOString(),
    record_lane: 'DESIGN_ASSET',
    publication_surface: 'ROOM_LAB',
    policy: 'Promotion is computed from hash-bound durable evidence. Missing claims fail closed. G2 never creates Product Twin identity or commerce evidence.',
    publication_gates: publicationGates,
    summary: {
      assets: assets.length,
      g1_blocked: assets.filter((item) => item.geometry_state === 'G1').length,
      g2_ready: assets.filter((item) => item.geometry_state === 'G2').length,
      publication_allowed: assets.filter((item) => item.publication_allowed).length,
    },
    assets,
  };
  assertNoDesignAssetCommerce(metric, 'design_asset_promotion_metric');
  const outputPath = path.resolve(root, env.DESIGN_ASSET_PROMOTION_METRIC ?? 'data/metrics/design-asset-promotion-latest.json');
  const metricRoot = path.resolve(root, 'data/metrics');
  if (!(outputPath === metricRoot || outputPath.startsWith(`${metricRoot}${path.sep}`))) throw new Error('Design Asset promotion metric must remain under data/metrics');
  await fsp.mkdir(path.dirname(outputPath), {recursive: true});
  await fsp.writeFile(outputPath, `${JSON.stringify(metric, null, 2)}\n`);
  return metric;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await promoteDesignAssets();
  console.log(JSON.stringify({status: 'PASS', ...result.summary}));
}
