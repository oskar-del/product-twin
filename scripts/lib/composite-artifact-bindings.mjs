import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const AVATAR_PUBLICATION_GATES = [
  'rights_source_verified',
  'redistribution_allowed',
  'all_model_dependencies_resolved',
  'source_orientation_applied',
  'back_face_policy_applied',
  'texture_embedding_verified',
  'canonical_view_visual_qa_passed',
  'independent_scale_qa_passed',
  'attribution_display_verified',
];

const CANOPUS_GATE_MAP = new Map([
  ['GATE_CATASTRO_BOUNDARY', 'OFFICIAL_CATASTRO_BOUNDARY'],
  ['GATE_IGN_TERRAIN', 'OFFICIAL_IGN_TERRAIN_VERTICAL_DATUM'],
  ['GATE_CONTEXT_OBSTRUCTIONS', 'CONTEXT_OBSTRUCTION_SURFACE'],
  ['GATE_CERTIFICADO_URBANISTICO', 'CURRENT_PLANNING_CERTIFICATE'],
  ['GATE_GOVERNING_PLAN', 'GOVERNING_PLANNING_INSTRUMENT'],
  ['GATE_A7_BUILDING_LINE_AND_ACCESS', 'A7_BUILDING_LINE_AND_ACCESS'],
  ['GATE_PERMITTED_ACCESS', 'AUTHORITY_CONFIRMED_ENTRANCE'],
  ['GATE_ROOFTOP_RULES', 'ROOFTOP_CORNICE_RULES'],
  ['GATE_TITLE_AND_CHARGES', 'TITLE_AND_CHARGES'],
  ['GATE_FLOOD_AND_OVERLAYS', 'FLOOD_ENVIRONMENTAL_OVERLAYS'],
  ['GATE_UTILITY_CAPACITY', 'UTILITY_CAPACITY'],
]);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const sorted = (values) => [...values].sort();

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function artifactSetDigest(artifacts) {
  const hash = createHash('sha256');
  for (const artifact of [...artifacts].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(artifact.path);
    hash.update('\0');
    hash.update(String(artifact.bytes.length));
    hash.update('\0');
    hash.update(artifact.bytes);
    hash.update('\0');
  }
  return hash.digest('hex');
}

function assertionCount(value) {
  if (Array.isArray(value)) return value.reduce((total, item) => total + assertionCount(item), 0);
  if (!isObject(value)) return 0;
  if (Object.hasOwn(value, 'evidence_class') && Object.hasOwn(value, 'source') && Object.hasOwn(value, 'verification')) return 1;
  return Object.values(value).reduce((total, item) => total + assertionCount(item), 0);
}

function sameSet(a, b) {
  return Array.isArray(a) && Array.isArray(b) && JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
}

export function readGitJsonArtifact({root, commit, path}) {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`ARTIFACT_COMMIT_INVALID:${commit}`);
  if (typeof path !== 'string' || path.length === 0 || path.startsWith('/') || path.split('/').includes('..')) throw new Error(`ARTIFACT_PATH_INVALID:${path}`);
  const bytes = execFileSync('git', ['show', `${commit}:${path}`], {cwd: root, maxBuffer: 64 * 1024 * 1024});
  let json;
  try {
    json = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`ARTIFACT_JSON_INVALID:${path}:${error.message}`);
  }
  return {
    commit,
    path,
    bytes,
    sha256: digest(bytes),
    json,
    source_ref: `https://github.com/oskar-del/product-twin/blob/${commit}/${path}`,
  };
}

export function deriveAvatarFactoryBinding({indexArtifact, conversionArtifact}) {
  const index = indexArtifact.json;
  const conversion = conversionArtifact.json;
  if (!isObject(index) || index.record_lane !== 'GENERIC_DESIGN_ASSET') throw new Error('AVATAR_INDEX_LANE_INVALID');
  if (!Array.isArray(index.assets) || !isObject(index.summary)) throw new Error('AVATAR_INDEX_STRUCTURE_INVALID');
  if (!Array.isArray(conversion.assets) || !isObject(conversion.summary)) throw new Error('AVATAR_CONVERSION_STRUCTURE_INVALID');
  if (!sameSet(index.publication_gates, AVATAR_PUBLICATION_GATES)) throw new Error('AVATAR_PUBLICATION_GATE_SET_INVALID');

  const indexIds = index.assets.map((asset) => asset.design_asset_id);
  const conversionIds = conversion.assets.map((asset) => asset.design_asset_id);
  if (new Set(indexIds).size !== indexIds.length) throw new Error('AVATAR_INDEX_DUPLICATE_ID');
  if (!sameSet(indexIds, conversionIds)) throw new Error('AVATAR_INDEX_CONVERSION_ID_MISMATCH');
  if (index.summary.assets !== index.assets.length) throw new Error('AVATAR_INDEX_COUNT_MISMATCH');
  if (index.summary.publishable !== index.assets.filter((asset) => asset.publication_allowed === true).length) throw new Error('AVATAR_PUBLISHABLE_COUNT_MISMATCH');
  if (conversion.summary.converted !== conversion.assets.length) throw new Error('AVATAR_CONVERSION_COUNT_MISMATCH');
  if (conversion.summary.converted !== index.summary.assets) throw new Error('AVATAR_CONVERSION_INDEX_COUNT_MISMATCH');

  for (const asset of index.assets) {
    if (asset.identity_scope !== 'GENERIC_DESIGN_ASSET' || asset.not_a_product_twin !== true) throw new Error(`AVATAR_ASSET_LANE_INVALID:${asset.design_asset_id}`);
    if (!isObject(asset.gates) || !sameSet(Object.keys(asset.gates), AVATAR_PUBLICATION_GATES)) throw new Error(`AVATAR_ASSET_GATE_SET_INVALID:${asset.design_asset_id}`);
    const allGatesPass = AVATAR_PUBLICATION_GATES.every((gate) => asset.gates[gate] === true);
    if (asset.publication_allowed !== allGatesPass) throw new Error(`AVATAR_PUBLICATION_GATE_DECISION_MISMATCH:${asset.design_asset_id}`);
  }

  const geometryStates = [...new Set(index.assets.map((asset) => asset.geometry_state))];
  if (geometryStates.length !== 1 || !['G0', 'G1', 'G2', 'G3', 'G4', 'G5'].includes(geometryStates[0])) throw new Error('AVATAR_BATCH_GEOMETRY_STATE_MIXED_OR_INVALID');
  const independentlyScaled = index.assets.every((asset) => asset.gates.independent_scale_qa_passed === true);
  const orientationVerified = index.assets.every((asset) => asset.gates.source_orientation_applied === true);
  const canonicalViewsVerified = index.assets.every((asset) => asset.gates.canonical_view_visual_qa_passed === true);
  const materialsVerified = index.assets.every((asset) => asset.gates.texture_embedding_verified === true);
  const rightsCleared = index.assets.every((asset) => asset.gates.rights_source_verified === true && asset.gates.redistribution_allowed === true);
  const attributionDisplayed = index.assets.every((asset) => asset.gates.attribution_display_verified === true);

  return {
    artifact_set_sha256: artifactSetDigest([indexArtifact, conversionArtifact]),
    index_sha256: indexArtifact.sha256,
    conversion_sha256: conversionArtifact.sha256,
    record_lane: 'DESIGN_ASSET',
    record_count: index.summary.assets,
    publishable_count: index.summary.publishable,
    converted_count: conversion.summary.converted,
    claimed_level: geometryStates[0],
    verified_level: independentlyScaled && orientationVerified ? geometryStates[0] : 'G0',
    promotion_state: independentlyScaled && orientationVerified ? 'ACCEPTED' : 'BLOCKED',
    independently_scaled: independentlyScaled,
    orientation_verified: orientationVerified,
    canonical_views_verified: canonicalViewsVerified,
    materials_verified: materialsVerified,
    rights_cleared: rightsCleared,
    attribution_displayed: attributionDisplayed,
    publication_state: index.summary.publishable > 0 ? 'PUBLISHABLE' : 'UNPUBLISHED',
  };
}

export function deriveCanopusBinding({sourcesArtifact, projectArtifact, siteArtifact, scenarioArtifact}) {
  const sources = sourcesArtifact.json;
  const project = projectArtifact.json;
  const site = siteArtifact.json;
  const scenario = scenarioArtifact.json;
  if (!Array.isArray(sources.documents)) throw new Error('CANOPUS_SOURCE_DOCUMENTS_INVALID');
  if (!Array.isArray(site.hard_gates) || site.hard_gates.length === 0) throw new Error('CANOPUS_HARD_GATES_INVALID');
  const gateIds = site.hard_gates.map((gate) => {
    if (gate.status !== 'OPEN' || gate.severity !== 'HARD') throw new Error(`CANOPUS_GATE_NOT_OPEN_HARD:${gate.gate_id}`);
    const mapped = CANOPUS_GATE_MAP.get(gate.gate_id);
    if (!mapped) throw new Error(`CANOPUS_GATE_UNKNOWN:${gate.gate_id}`);
    return mapped;
  });
  if (new Set(gateIds).size !== gateIds.length) throw new Error('CANOPUS_GATE_DUPLICATE');

  const boundaryVerified = site.spatial?.boundary?.geometry !== null && site.spatial?.boundary?.raw_artifact !== null;
  const crsVerified = boundaryVerified && site.spatial?.boundary?.crs !== null;
  const terrainVerified = site.spatial?.terrain?.raw_dem !== null && site.spatial?.terrain?.terrain_mesh !== null && site.spatial?.terrain?.vertical_datum !== null;
  const planningEntitled = site.planning?.entitlement !== null && site.planning?.buildable_envelope !== null;
  const legalAccessVerified = site.access?.permitted_access_point !== null;
  const obstructionGateOpen = gateIds.includes('CONTEXT_OBSTRUCTION_SURFACE');
  if (boundaryVerified && gateIds.includes('OFFICIAL_CATASTRO_BOUNDARY')) throw new Error('CANOPUS_BOUNDARY_PRESENT_WITH_GATE_OPEN');
  if (terrainVerified && gateIds.includes('OFFICIAL_IGN_TERRAIN_VERTICAL_DATUM')) throw new Error('CANOPUS_TERRAIN_PRESENT_WITH_GATE_OPEN');
  if (planningEntitled && (gateIds.includes('CURRENT_PLANNING_CERTIFICATE') || gateIds.includes('GOVERNING_PLANNING_INSTRUMENT'))) throw new Error('CANOPUS_ENTITLEMENT_PRESENT_WITH_GATE_OPEN');
  if (legalAccessVerified && (gateIds.includes('A7_BUILDING_LINE_AND_ACCESS') || gateIds.includes('AUTHORITY_CONFIRMED_ENTRANCE'))) throw new Error('CANOPUS_ACCESS_PRESENT_WITH_GATE_OPEN');

  return {
    artifact_set_sha256: artifactSetDigest([sourcesArtifact, projectArtifact, siteArtifact, scenarioArtifact]),
    site_twin_id: site.site_twin_id,
    source_count: sources.documents.length,
    assertion_count: assertionCount(project) + assertionCount(site) + assertionCount(scenario),
    hard_gates_open: sorted(gateIds),
    state: gateIds.length === 0 ? 'READY' : 'BLOCKED',
    claims: {
      boundary: boundaryVerified ? 'OFFICIAL_VERIFIED' : 'ABSENT',
      crs: crsVerified ? 'VERIFIED' : 'UNRESOLVED',
      terrain: terrainVerified ? 'AUTHORITATIVE_VERIFIED' : 'ABSENT',
      planning_entitlement: planningEntitled ? 'ENTITLED' : 'UNRESOLVED',
      legal_access: legalAccessVerified ? 'LEGAL_VERIFIED' : 'UNRESOLVED',
      sun_and_views: boundaryVerified && crsVerified && terrainVerified && !obstructionGateOpen ? 'VERIFIED' : 'CONDITIONAL',
    },
  };
}

export function validateCompositeArtifactBindings({manifest, avatarBinding, canopusBinding}) {
  const issues = [];
  let checksTotal = 0;
  const check = (condition, code, path, message) => {
    checksTotal += 1;
    if (!condition) issues.push({code, path, message});
  };

  const avatar = manifest.asset_records?.find((record) => record.record_id === 'DA_SH3D_KATOR_LEGAZ_BATCH_12');
  check(Boolean(avatar), 'AVATAR_MANIFEST_RECORD_MISSING', 'manifest.asset_records', 'Kator/Legaz batch record is required');
  if (avatar) {
    check(avatar.source_lane === avatarBinding.record_lane, 'AVATAR_MANIFEST_LANE_MISMATCH', 'avatar.source_lane', 'manifest lane differs from artifact lane');
    check(avatar.inventory?.record_count === avatarBinding.record_count, 'AVATAR_MANIFEST_COUNT_MISMATCH', 'avatar.inventory.record_count', 'manifest count differs from artifact count');
    check(avatar.inventory?.publishable_count === avatarBinding.publishable_count, 'AVATAR_MANIFEST_PUBLISHABLE_COUNT_MISMATCH', 'avatar.inventory.publishable_count', 'manifest publishable count differs from artifact count');
    check(avatar.geometry?.claimed_level === avatarBinding.claimed_level, 'AVATAR_MANIFEST_CLAIMED_LEVEL_MISMATCH', 'avatar.geometry.claimed_level', 'manifest claimed level differs from index');
    check(avatar.geometry?.verified_level === avatarBinding.verified_level, 'AVATAR_MANIFEST_VERIFIED_LEVEL_MISMATCH', 'avatar.geometry.verified_level', 'manifest verified level differs from canonical artifact evaluation');
    check(avatar.geometry?.promotion_state === avatarBinding.promotion_state, 'AVATAR_MANIFEST_PROMOTION_STATE_MISMATCH', 'avatar.geometry.promotion_state', 'manifest promotion state differs from canonical artifact evaluation');
    check(avatar.publication?.state === avatarBinding.publication_state, 'AVATAR_MANIFEST_PUBLICATION_STATE_MISMATCH', 'avatar.publication.state', 'manifest publication state differs from index');
    check(avatar.geometry?.evidence?.content_sha256 === avatarBinding.conversion_sha256, 'AVATAR_CONVERSION_HASH_MISMATCH', 'avatar.geometry.evidence.content_sha256', 'conversion artifact hash is missing or incorrect');
    for (const lane of ['identity', 'appearance', 'rights', 'attribution', 'publication']) {
      check(avatar[lane]?.evidence?.content_sha256 === avatarBinding.index_sha256, 'AVATAR_INDEX_HASH_MISMATCH', `avatar.${lane}.evidence.content_sha256`, 'index artifact hash is missing or incorrect');
    }
  }

  const site = manifest.site_evidence;
  check(site?.site_twin_id === canopusBinding.site_twin_id, 'CANOPUS_MANIFEST_ID_MISMATCH', 'manifest.site_evidence.site_twin_id', 'Site Twin ID differs from artifact');
  check(site?.source_count === canopusBinding.source_count, 'CANOPUS_MANIFEST_SOURCE_COUNT_MISMATCH', 'manifest.site_evidence.source_count', 'source count differs from artifact');
  check(site?.assertion_count === canopusBinding.assertion_count, 'CANOPUS_MANIFEST_ASSERTION_COUNT_MISMATCH', 'manifest.site_evidence.assertion_count', 'assertion count differs from artifacts');
  check(sameSet(site?.hard_gates_open, canopusBinding.hard_gates_open), 'CANOPUS_MANIFEST_HARD_GATES_MISMATCH', 'manifest.site_evidence.hard_gates_open', 'hard gates differ from Site Twin artifact');
  check(site?.state === canopusBinding.state, 'CANOPUS_MANIFEST_STATE_MISMATCH', 'manifest.site_evidence.state', 'site state differs from artifact-derived state');
  for (const [claim, value] of Object.entries(canopusBinding.claims)) {
    check(site?.claims?.[claim] === value, 'CANOPUS_MANIFEST_CLAIM_MISMATCH', `manifest.site_evidence.claims.${claim}`, 'site claim differs from artifact-derived state');
  }
  check(site?.evidence?.content_sha256 === canopusBinding.artifact_set_sha256, 'CANOPUS_ARTIFACT_SET_HASH_MISMATCH', 'manifest.site_evidence.evidence.content_sha256', 'CANOPUS artifact-set hash is missing or incorrect');

  return {
    status: issues.length === 0 ? 'PASS' : 'FAIL',
    checks_total: checksTotal,
    checks_passed: checksTotal - issues.length,
    issues,
    bindings: {
      avatar: avatarBinding,
      canopus: canopusBinding,
    },
  };
}

export const compositeArtifactBindingConstants = {
  AVATAR_PUBLICATION_GATES,
  CANOPUS_GATE_MAP: Object.fromEntries(CANOPUS_GATE_MAP),
};
