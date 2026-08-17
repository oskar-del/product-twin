import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {deriveAvatarAssetSetHash, deriveRoomGeometryHash, validateRoomAlphaRelease} from './lib/room-alpha-gate.mjs';

const now = '2026-08-17T18:00:00Z';
const clone = (value) => structuredClone(value);
const hashJson = (value) => createHash('sha256').update(`${JSON.stringify(value, null, 2)}\n`).digest('hex');
const hashFor = (label) => createHash('sha256').update(label).digest('hex');

function snapshotEvidence(id, label = id) {
  return {
    evidence_id: id,
    source_uri: `repo://evidence/${label.toLowerCase()}.json`,
    observed_at: '2026-08-17T17:00:00Z',
    content_sha256: hashFor(label),
    freshness_state: 'SNAPSHOT',
    valid_until: null,
    market: null,
    destination: null,
  };
}

function currentEvidence(id, market, destination) {
  return {
    evidence_id: id,
    source_uri: `https://evidence.example/${market.toLowerCase()}/${id.toLowerCase()}`,
    observed_at: '2026-08-17T17:00:00Z',
    content_sha256: hashFor(id),
    freshness_state: 'CURRENT',
    valid_until: '2026-08-18T17:00:00Z',
    market,
    destination: clone(destination),
  };
}

function geometry(level, dimensions) {
  const rank = Number(level.slice(1));
  return {
    claimed_level: level,
    verified_level: level,
    dimensions_m: dimensions,
    orientation: {up_axis: '+Y', forward_axis: '+Z'},
    floor_anchor: {type: 'FLOOR', local_point_m: [0, -dimensions[1] / 2, 0], surface_normal: [0, 1, 0]},
    confidence: 0.8,
    evidence_flags: {
      dimensions_verified: rank >= 1,
      units_verified: rank >= 1,
      orientation_verified: rank >= 1,
      floor_anchor_verified: rank >= 1,
      clearance_verified: rank >= 1,
      anchor_pivot_verified: rank >= 1,
      recognizable_form_verified: rank >= 2,
      independent_scale_verified: rank >= 2,
      proxy_disclosed: rank >= 2,
      exact_form_verified: rank >= 3,
      technical_interfaces_verified: rank >= 4,
      manufacturing_authority_verified: rank >= 5,
    },
    evidence: [snapshotEvidence(`EVIDENCE_GEOMETRY_${dimensions.join('_').replaceAll('.', '_')}`)],
  };
}

function qaRecords(prefix) {
  return ['VISUAL', 'ORIENTATION', 'FLOOR_ANCHOR'].map((type) => ({
    qa_id: `QA_${prefix}_${type}`,
    type,
    state: 'PASS',
    observed_at: '2026-08-17T17:00:00Z',
    evidence: [snapshotEvidence(`EVIDENCE_QA_${prefix}_${type}`)],
  }));
}

function avatarAsset({id, lane, dimensions, envelope, clearance, promoted = true}) {
  const product = lane === 'PRODUCT_TWIN';
  return {
    asset_id: id,
    source_lane: lane,
    asset_uri: `repo://data/room-alpha/${id.toLowerCase()}.glb`,
    asset_sha256: hashFor(`${id}-binary`),
    identity: {
      state: product ? 'VERIFIED_PRODUCT' : 'GENERIC',
      canonical_id: product ? id : null,
      evidence: product ? [snapshotEvidence(`EVIDENCE_IDENTITY_${id}`)] : [],
    },
    geometry: geometry(product ? 'G2' : 'G1', dimensions),
    appearance: {state: 'APPROXIMATE', confidence: 0.65, evidence: [snapshotEvidence(`EVIDENCE_APPEARANCE_${id}`)]},
    rights: {
      state: product || promoted ? 'CLEARED' : 'UNRESOLVED',
      display_allowed: product || promoted,
      derivatives_allowed: product || promoted,
      redistribution_allowed: false,
      attribution_required: true,
      evidence: product || promoted ? [snapshotEvidence(`EVIDENCE_RIGHTS_${id}`)] : [],
    },
    attribution: {
      required: true,
      creator: 'Fixture Creator',
      license_id: 'FIXTURE-LICENSE-1.0',
      source_uri: 'https://evidence.example/licenses/fixture',
      display_text: `Fixture attribution for ${id}`,
    },
    spatial_semantics: {
      footprint_m: [envelope.width, envelope.depth],
      collision_envelope_m: clone(envelope),
      functional_clearance_m: clone(clearance),
      anchors: [{anchor_id: `ANCHOR_${id}_FLOOR`, type: 'FLOOR', local_point_m: [0, -dimensions[1] / 2, 0]}],
      unknown_product_fallback: {policy: 'CONSERVATIVE_BOX', dimensions_m: [1, 1, 1], clearance_m: 0.4, public_allowed: false},
    },
    qa_records: promoted ? qaRecords(id) : [],
    publication: {promoted, public_allowed: promoted && product},
  };
}

function placement(id, asset, position, score) {
  const transform = {position_m: position, rotation_deg: [0, 0, 0]};
  return {
    placement: {
      placement_id: id,
      scene_id: 'SCENE_ROOM_ALPHA_FIXTURE',
      profile_id: 'PROFILE_ROOM_ALPHA_FIXTURE',
      asset_id: asset.asset_id,
      transform: clone(transform),
      floor_anchor: {surface_id: 'SURFACE_FLOOR', world_point_m: [position[0], 0, position[2]]},
      collision_envelope_m: clone(asset.spatial_semantics.collision_envelope_m),
      functional_clearance_m: clone(asset.spatial_semantics.functional_clearance_m),
      source_candidate_id: `CANDIDATE_${id}`,
    },
    candidate: {
      candidate_id: `CANDIDATE_${id}`,
      placement_id: id,
      transform: clone(transform),
      hard_constraints_passed: true,
      hard_failure_reasons: [],
      soft_score: score,
    },
  };
}

function makeReadyBundle() {
  const clearance = {front: 0.1, back: 0.1, left: 0.1, right: 0.1};
  const sofa = avatarAsset({id: 'PT_FIXTURE_SOFA', lane: 'PRODUCT_TWIN', dimensions: [2, 0.8, 0.8], envelope: {width: 2, height: 0.8, depth: 0.8}, clearance});
  const table = avatarAsset({id: 'PT_FIXTURE_TABLE', lane: 'PRODUCT_TWIN', dimensions: [0.8, 0.75, 3], envelope: {width: 0.8, height: 0.75, depth: 3}, clearance});
  const designAsset = avatarAsset({id: 'DA_FIXTURE_CHAIR', lane: 'DESIGN_ASSET', dimensions: [0.7, 0.9, 0.7], envelope: {width: 0.7, height: 0.9, depth: 0.7}, clearance, promoted: false});
  const avatarManifest = {
    schema_version: '0.1',
    manifest_id: 'FURNITURE_AVATAR_MANIFEST_FIXTURE',
    generated_at: '2026-08-17T17:00:00Z',
    source: {workstream: 'AVATAR_FACTORY', branch: 'agent/avatar-factory-source-graph', commit_sha: '2a959d4f8e270d150b74e3f43daf624a4ed06c9c', pipeline_version: 'fixture-1'},
    asset_set_sha256: '',
    assets: [sofa, table, designAsset],
  };

  const sofaPlacement = placement('PLACEMENT_SOFA', sofa, [2, 0, 3], 0.9);
  const tablePlacement = placement('PLACEMENT_TABLE', table, [7, 0, 3], 0.8);
  const rejectedCandidate = {
    candidate_id: 'CANDIDATE_REJECTED_OUTSIDE',
    placement_id: 'PLACEMENT_SOFA',
    transform: {position_m: [11, 0, 3], rotation_deg: [0, 0, 0]},
    hard_constraints_passed: false,
    hard_failure_reasons: ['OUTSIDE_ROOM'],
    soft_score: 1,
  };
  const room = {
    bounds: {min_m: [0, 0, 0], max_m: [10, 3, 6]},
    surfaces: [
      {surface_id: 'SURFACE_FLOOR', type: 'FLOOR', bounds: {min_m: [0, 0, 0], max_m: [10, 0, 6]}},
      {surface_id: 'SURFACE_WALL_NORTH', type: 'WALL', bounds: {min_m: [0, 0, 6], max_m: [10, 3, 6]}},
    ],
    openings: [{opening_id: 'OPENING_DOOR', surface_id: 'SURFACE_WALL_NORTH', clearance_bounds: {min_m: [0, 0, 5.5], max_m: [1, 2.2, 6]}}],
    protected_paths: [{path_id: 'PATH_ENTRY', bounds: {min_m: [4.5, 0, 0], max_m: [5.5, 2.2, 1]}, minimum_width_m: 1}],
  };
  const sceneManifest = {
    schema_version: '0.1',
    manifest_id: 'ROOM_ALPHA_SCENE_MANIFEST_FIXTURE',
    scene_id: 'SCENE_ROOM_ALPHA_FIXTURE',
    profile_id: 'PROFILE_ROOM_ALPHA_FIXTURE',
    generated_at: '2026-08-17T17:00:00Z',
    source: {workstream: 'ROOM_LAB', branch: 'agent/room-lab-commerce-showroom', commit_sha: 'a2e4b206742f4a742e8770cf71e7ca25a91cd674', pipeline_version: 'fixture-1'},
    avatar_manifest_id: avatarManifest.manifest_id,
    avatar_manifest_sha256: '',
    room_geometry_sha256: '',
    room,
    constraints: {
      hard: [{constraint_id: 'CONSTRAINT_BOUNDARY', type: 'ROOM_BOUNDARY'}, {constraint_id: 'CONSTRAINT_COLLISION', type: 'COLLISION'}],
      soft: [{preference_id: 'PREFERENCE_VIEW', type: 'VIEW_ALIGNMENT', weight: 0.5}],
    },
    placements: [sofaPlacement.placement, tablePlacement.placement],
    candidate_generation: {
      algorithm: 'fixture-grid',
      algorithm_version: '1.0.0',
      seed: 42,
      deterministic: true,
      candidates: [sofaPlacement.candidate, tablePlacement.candidate, rejectedCandidate],
    },
    ranking: {algorithm_version: '1.0.0', deterministic: true, tie_break: 'CANDIDATE_ID_ASC', ranked_candidate_ids: ['CANDIDATE_PLACEMENT_SOFA', 'CANDIDATE_PLACEMENT_TABLE']},
    interaction_policy: {
      drag: {boundary_enforced: true, collision_enforced: true},
      pickup: {boundary_enforced: true, collision_enforced: true},
      nudge: {boundary_enforced: true, collision_enforced: true},
      rotation: {boundary_enforced: true, collision_enforced: true},
    },
    unknown_product_fallback: {policy: 'CONSERVATIVE_BOX', dimensions_m: [1, 1, 1], clearance_m: 0.4, public_allowed: false},
    rejected_candidates: [{candidate_id: 'CANDIDATE_REJECTED_OUTSIDE', reasons: ['OUTSIDE_ROOM']}],
  };

  const destination = {country: 'ES', region: 'Malaga', postal_code: '29660'};
  const supplyManifest = {
    schema_version: '0.1',
    manifest_id: 'ROOM_ALPHA_SUPPLY_FIXTURE_ES',
    generated_at: '2026-08-17T17:00:00Z',
    market: 'ES',
    destination,
    offers: [{
      offer_id: 'OFFER_FIXTURE_SOFA_ES',
      product_twin_id: 'PT_FIXTURE_SOFA',
      market: 'ES',
      destination: clone(destination),
      price: 999,
      currency: 'EUR',
      stock_state: 'IN_STOCK',
      delivery_state: 'CONFIRMED',
      merchant: 'Fixture Merchant',
      evidence: [currentEvidence('EVIDENCE_OFFER_FIXTURE_SOFA_ES', 'ES', destination)],
    }],
  };

  const checkEvidence = (id) => [snapshotEvidence(id)];
  const candidate = {
    schema_version: '0.1',
    candidate_id: 'ROOM_ALPHA_READY_FIXTURE',
    evaluated_at: '2026-08-17T17:30:00Z',
    publication_target: 'INTEGRATION_TEST',
    room_source: {
      branch: 'agent/room-lab-commerce-showroom',
      commit_sha: 'a2e4b206742f4a742e8770cf71e7ca25a91cd674',
      sites_project_id: 'appgprj_fixture',
      sites_version_id: 'appgprj_fixture~appgver_fixture',
      sites_version_number: 14,
      sites_archive_sha256: hashFor('sites-archive'),
      sites_archive_file_count: 79,
      saved: true,
      deployed: false,
      public_version_number: 11,
      public_deployment_qa_state: 'REPORTED',
      source_evidence: snapshotEvidence('EVIDENCE_ROOM_SOURCE'),
    },
    manifest_refs: {
      scene: {path: 'fixtures/scene.json', sha256: ''},
      furniture_avatar: {path: 'fixtures/avatar.json', sha256: ''},
      supply: {path: 'fixtures/supply.json', sha256: ''},
    },
    checks: {
      build: {state: 'PASS', evidence: checkEvidence('EVIDENCE_BUILD')},
      lint: {state: 'PASS', evidence: checkEvidence('EVIDENCE_LINT')},
      artifact_validation: {state: 'PASS', evidence: checkEvidence('EVIDENCE_ARTIFACT')},
      deterministic_tests: {state: 'PASS', passed: 11, total: 11, evidence: checkEvidence('EVIDENCE_TESTS')},
      browser_manual_interaction_qa: {state: 'MISSING', evidence: []},
    },
  };
  return {candidate, avatarManifest, sceneManifest, supplyManifest};
}

function bind(bundle) {
  bundle.avatarManifest.asset_set_sha256 = deriveAvatarAssetSetHash(bundle.avatarManifest.assets);
  const avatarManifestSha256 = hashJson(bundle.avatarManifest);
  bundle.sceneManifest.avatar_manifest_id = bundle.avatarManifest.manifest_id;
  bundle.sceneManifest.avatar_manifest_sha256 = avatarManifestSha256;
  bundle.sceneManifest.room_geometry_sha256 = deriveRoomGeometryHash(bundle.sceneManifest.room);
  const sceneManifestSha256 = hashJson(bundle.sceneManifest);
  const supplyManifestSha256 = hashJson(bundle.supplyManifest);
  if (bundle.candidate.manifest_refs.furniture_avatar) bundle.candidate.manifest_refs.furniture_avatar.sha256 = avatarManifestSha256;
  if (bundle.candidate.manifest_refs.scene) bundle.candidate.manifest_refs.scene.sha256 = sceneManifestSha256;
  if (bundle.candidate.manifest_refs.supply) bundle.candidate.manifest_refs.supply.sha256 = supplyManifestSha256;
  const assetDigests = Object.fromEntries(bundle.avatarManifest.assets.map((asset) => [asset.asset_id, asset.asset_sha256]));
  return {
    avatarManifest: bundle.avatarManifest,
    sceneManifest: bundle.sceneManifest,
    supplyManifest: bundle.supplyManifest,
    avatarManifestSha256,
    sceneManifestSha256,
    supplyManifestSha256,
    assetDigests,
    evidenceFiles: [
      {path: 'fixtures/avatar.json', sha256: avatarManifestSha256, state: 'INSPECTED'},
      {path: 'fixtures/scene.json', sha256: sceneManifestSha256, state: 'INSPECTED'},
      {path: 'fixtures/supply.json', sha256: supplyManifestSha256, state: 'INSPECTED'},
    ],
  };
}

function evaluate(bundle, options = {}) {
  const inputs = bind(bundle);
  if (options.afterBind) options.afterBind(inputs, bundle);
  return validateRoomAlphaRelease(bundle.candidate, inputs, {now, gitCommitReachable: options.gitCommitReachable ?? true});
}

const baseline = makeReadyBundle();
const baselineResult = evaluate(baseline);
assert.equal(baselineResult.status, 'PASS');
assert.deepEqual(baselineResult.eligibility, {integration_testing: 'PASS', public_deployment: 'BLOCK'});
assert.ok(baselineResult.public_failed_gates.some((issue) => issue.code === 'PUBLIC_BROWSER_MANUAL_QA_REQUIRED'));

const publicReady = makeReadyBundle();
publicReady.candidate.publication_target = 'PUBLIC';
publicReady.candidate.checks.browser_manual_interaction_qa = {state: 'PASS', evidence: [snapshotEvidence('EVIDENCE_BROWSER_QA')]};
const publicReadyResult = evaluate(publicReady);
assert.equal(publicReadyResult.status, 'PASS');
assert.deepEqual(publicReadyResult.eligibility, {integration_testing: 'PASS', public_deployment: 'PASS'});

const mutations = [
  ['missing stable ID', (b) => { delete b.avatarManifest.assets[0].asset_id; }, 'REQUIRED_FIELD_MISSING'],
  ['duplicate avatar IDs', (b) => { b.avatarManifest.assets[1].asset_id = b.avatarManifest.assets[0].asset_id; }, 'DUPLICATE_AVATAR_ID'],
  ['duplicate placement IDs', (b) => { b.sceneManifest.placements[1].placement_id = b.sceneManifest.placements[0].placement_id; }, 'DUPLICATE_PLACEMENT_ID'],
  ['unknown waiver field', (b) => { b.candidate.scripted_gate_waiver = true; }, 'UNKNOWN_FIELD'],
  ['invalid avatar URI', (b) => { b.avatarManifest.assets[0].asset_uri = 'javascript:alert(1)'; }, 'AVATAR_ASSET_URI_INVALID'],
  ['false G-level promotion', (b) => { b.avatarManifest.assets[0].geometry.claimed_level = 'G5'; }, 'FALSE_G_LEVEL_PROMOTION'],
  ['nested Design Asset commerce alias', (b) => { b.avatarManifest.assets[2].spatial_semantics.hidden = {supplierPrice: 200}; }, 'DESIGN_ASSET_COMMERCE_LEAK'],
  ['invalid avatar dimensions', (b) => { b.avatarManifest.assets[0].geometry.dimensions_m[0] = -1; }, 'GEOMETRY_DIMENSIONS_INVALID'],
  ['non-finite placement transform', (b) => { b.sceneManifest.placements[0].transform.position_m[0] = Number.NaN; }, 'PLACEMENT_POSITION_NONFINITE'],
  ['missing required attribution', (b) => { b.avatarManifest.assets[0].attribution.display_text = null; }, 'ATTRIBUTION_DISPLAY_TEXT_REQUIRED'],
  ['rights-state publication bypass', (b) => { b.avatarManifest.assets[0].rights.state = 'UNRESOLVED'; b.avatarManifest.assets[0].rights.evidence = []; }, 'PUBLIC_AVATAR_RIGHTS_UNRESOLVED'],
  ['cross-market evidence leakage', (b) => { b.supplyManifest.offers[0].evidence[0].market = 'SE'; }, 'CROSS_MARKET_EVIDENCE_LEAK'],
  ['outside-room placement', (b) => {
    b.sceneManifest.placements[0].transform.position_m[0] = 9.8;
    b.sceneManifest.placements[0].floor_anchor.world_point_m[0] = 9.8;
    b.sceneManifest.candidate_generation.candidates[0].transform.position_m[0] = 9.8;
  }, 'PLACEMENT_OUTSIDE_ROOM'],
  ['collision introduced after rotation', (b) => {
    const placementItem = b.sceneManifest.placements[1];
    placementItem.transform.position_m = [3.6, 0, 3];
    placementItem.transform.rotation_deg = [0, 90, 0];
    placementItem.floor_anchor.world_point_m = [3.6, 0, 3];
    const candidateItem = b.sceneManifest.candidate_generation.candidates[1];
    candidateItem.transform = clone(placementItem.transform);
  }, 'PLACEMENT_COLLISION'],
  ['malformed floor anchor', (b) => { b.avatarManifest.assets[0].geometry.floor_anchor.surface_normal = [0, 0, 0]; }, 'FLOOR_ANCHOR_NORMAL_INVALID'],
  ['malformed protected path', (b) => { b.sceneManifest.room.protected_paths[0].bounds.min_m[0] = 6; }, 'PROTECTED_PATH_BOUNDS_INVERTED'],
  ['non-deterministic ranking', (b) => { b.sceneManifest.ranking.ranked_candidate_ids.reverse(); }, 'RANKING_NOT_DETERMINISTIC'],
  ['unsafe unknown-product defaults', (b) => { b.sceneManifest.unknown_product_fallback.clearance_m = 0.05; }, 'SCENE_UNKNOWN_PRODUCT_CLEARANCE_UNSAFE'],
  ['room isolation leak', (b) => { b.sceneManifest.placements[0].scene_id = 'SCENE_OTHER'; }, 'PLACEMENT_SCENE_ISOLATION_FAILURE'],
  ['profile isolation leak', (b) => { b.sceneManifest.placements[0].profile_id = 'PROFILE_OTHER'; }, 'PLACEMENT_PROFILE_ISOLATION_FAILURE'],
  ['invalid candidate lacks rejection reason', (b) => { b.sceneManifest.candidate_generation.candidates[2].hard_failure_reasons = []; }, 'INVALID_CANDIDATE_REASONS_REQUIRED'],
  ['interaction rotation boundary disabled', (b) => { b.sceneManifest.interaction_policy.rotation.boundary_enforced = false; }, 'INTERACTION_BOUNDARY_ENFORCEMENT_REQUIRED'],
  ['supply references Design Asset', (b) => { b.supplyManifest.offers[0].product_twin_id = 'DA_FIXTURE_CHAIR'; }, 'SUPPLY_DESIGN_ASSET_REFERENCE_FORBIDDEN'],
  ['required scene manifest missing', (b) => { b.candidate.manifest_refs.scene = null; }, 'ROOM_SCENE_MANIFEST_MISSING'],
  ['required avatar manifest missing', (b) => { b.candidate.manifest_refs.furniture_avatar = null; }, 'AVATAR_MANIFEST_MISSING'],
  ['source commit unreachable', () => {}, 'ROOM_SOURCE_COMMIT_UNREACHABLE', {gitCommitReachable: false}],
  ['scene content hash substitution', () => {}, 'SCENE_MANIFEST_CONTENT_HASH_MISMATCH', {afterBind: (inputs) => { inputs.sceneManifestSha256 = '0'.repeat(64); }}],
  ['promoted avatar binary substitution', () => {}, 'PROMOTED_AVATAR_BINARY_HASH_UNVERIFIED', {afterBind: (inputs) => { inputs.assetDigests.PT_FIXTURE_SOFA = '0'.repeat(64); }}],
  ['reported build cannot pass gate', (b) => { b.candidate.checks.build = {state: 'REPORTED', evidence: []}; }, 'BUILD_CHECK_UNVERIFIED'],
  ['incomplete deterministic tests', (b) => { b.candidate.checks.deterministic_tests.passed = 10; }, 'DETERMINISTIC_TESTS_INCOMPLETE'],
  ['public deployment without browser QA', (b) => { b.candidate.publication_target = 'PUBLIC'; }, 'PUBLIC_BROWSER_MANUAL_QA_REQUIRED'],
];

for (const [name, mutate, expectedCode, options] of mutations) {
  const bundle = makeReadyBundle();
  mutate(bundle);
  const result = evaluate(bundle, options);
  const emitted = [...result.failed_gates, ...result.public_failed_gates].map((issue) => issue.code);
  assert.ok(emitted.includes(expectedCode), `${name} should emit ${expectedCode}; emitted ${emitted.join(', ')}`);
}

const observedReleaseVote = spawnSync(process.execPath, ['scripts/validate-room-alpha-release.mjs', '--require-pass'], {
  cwd: process.cwd(),
  encoding: 'utf8',
});
assert.equal(observedReleaseVote.status, 2, observedReleaseVote.stderr || observedReleaseVote.stdout);

console.log(JSON.stringify({
  status: 'PASS',
  positive_integration_checks: baselineResult.checks_total,
  public_ready_checks: publicReadyResult.checks_total,
  mutation_scenarios: mutations.length,
  integration_without_browser_qa: baselineResult.eligibility.integration_testing,
  public_without_browser_qa: baselineResult.eligibility.public_deployment,
  observed_release_vote_exit_code: observedReleaseVote.status,
}, null, 2));
