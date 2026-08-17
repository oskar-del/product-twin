import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {compositeReleaseConstants, validateCompositeReleaseManifest} from './lib/composite-release-gate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = path.join(root, 'data/releases/composite-release-manifest-v0.1.json');
const blockedFixture = JSON.parse(await fsp.readFile(fixturePath, 'utf8'));
const now = '2026-08-17T15:00:00Z';
const clone = (value) => structuredClone(value);

function makeEvidenceCurrent(value, market = null, destination = null) {
  value.observed_at = '2026-08-17T14:30:00Z';
  value.freshness_state = 'CURRENT';
  value.valid_until = '2026-08-19T14:30:00Z';
  value.market = market;
  value.destination = destination === null ? null : clone(destination);
}

function makeReadyManifest() {
  const manifest = clone(blockedFixture);
  manifest.manifest_id = 'COMPOSITE_RELEASE_READY_TEST_FIXTURE';
  manifest.release_state = 'READY';
  manifest.release_blockers = [];

  manifest.asset_records[0].required_for_release = false;

  manifest.site_evidence.state = 'READY';
  manifest.site_evidence.hard_gates_open = [];
  manifest.site_evidence.claims = {
    boundary: 'OFFICIAL_VERIFIED',
    crs: 'VERIFIED',
    terrain: 'AUTHORITATIVE_VERIFIED',
    planning_entitlement: 'ENTITLED',
    legal_access: 'LEGAL_VERIFIED',
    sun_and_views: 'VERIFIED',
  };

  const transformA = {position_m: [0, 0, 0], rotation_deg: [0, 0, 0]};
  const transformB = {position_m: [1.5, 0, 0.5], rotation_deg: [0, 15, 0]};
  manifest.room_placement.state = 'VERIFIED';
  manifest.room_placement.expected_placement_count = 2;
  manifest.room_placement.fallback_consistency_verified = true;
  manifest.room_placement.collision_state_verified = true;
  manifest.room_placement.placements = [
    {
      placement_id: 'PLACEMENT_SOFA_01',
      source_lane: 'PRODUCT_TWIN',
      reference_id: 'PT_IKEA_KIVIK_49440597',
      transform: clone(transformA),
      reset_transform: clone(transformA),
      fallback_transform: clone(transformA),
      collision_state: 'CLEAR',
      fit_state: 'INSIDE',
      bundle: {bundle_id: null, item_quantity: 1, visible_avatar_count: 1},
    },
    {
      placement_id: 'PLACEMENT_CHAIR_SET_01',
      source_lane: 'PRODUCT_TWIN',
      reference_id: 'PT_IKEA_LISABO_00457235',
      transform: clone(transformB),
      reset_transform: clone(transformB),
      fallback_transform: clone(transformB),
      collision_state: 'CLEAR',
      fit_state: 'INSIDE',
      bundle: {bundle_id: 'BUNDLE_LISABO_4_CHAIRS', item_quantity: 1, visible_avatar_count: 4},
    },
  ];

  const supply = manifest.market_supply[0];
  supply.claim_state = 'CURRENT';
  supply.current_claim = true;
  makeEvidenceCurrent(supply.evidence, supply.market, supply.destination);

  manifest.procurement_readiness.state = 'READY';
  manifest.procurement_readiness.ready = true;
  for (const gate of compositeReleaseConstants.PROCUREMENT_GATES) manifest.procurement_readiness.gates[gate] = true;
  makeEvidenceCurrent(
    manifest.procurement_readiness.evidence,
    manifest.procurement_readiness.destination.country,
    manifest.procurement_readiness.destination,
  );

  makeEvidenceCurrent(manifest.deployment_state.evidence);
  manifest.deployment_state.current_claim = true;
  return manifest;
}

const blockedResult = validateCompositeReleaseManifest(blockedFixture, {now});
assert.equal(blockedResult.status, 'PASS');
assert.equal(blockedResult.release_decision, 'BLOCKED');
assert.equal(blockedResult.block_reasons.length, 6);

const readyFixture = makeReadyManifest();
const readyResult = validateCompositeReleaseManifest(readyFixture, {now});
assert.equal(readyResult.status, 'PASS');
assert.equal(readyResult.release_decision, 'READY');
assert.deepEqual(readyResult.block_reasons, []);

const mutations = [
  ['unknown top-level field', readyFixture, (m) => { m.confident_prose_waiver = true; }, 'UNKNOWN_FIELD'],
  ['unsupported schema version', readyFixture, (m) => { m.schema_version = '9.9'; }, 'SCHEMA_VERSION_UNSUPPORTED'],
  ['invalid checkpoint commit', readyFixture, (m) => { m.checkpoints[0].commit_sha = 'ef1d52d'; }, 'CHECKPOINT_COMMIT_INVALID'],
  ['duplicate checkpoint branch', readyFixture, (m) => { m.checkpoints[1].branch = m.checkpoints[0].branch; }, 'DUPLICATE_CHECKPOINT_BRANCH'],
  ['malformed evidence content hash', readyFixture, (m) => { m.asset_records[0].identity.evidence.content_sha256 = 'abbreviated'; }, 'EVIDENCE_CONTENT_HASH_INVALID'],
  ['publishable inventory exceeds source records', readyFixture, (m) => { m.asset_records[0].inventory.publishable_count = 13; }, 'ASSET_PUBLISHABLE_COUNT_EXCEEDS_RECORDS'],
  ['Design Asset commerce leak', readyFixture, (m) => { m.asset_records[0].appearance.nested = {unitPriceEUR: 299}; }, 'DESIGN_ASSET_COMMERCE_OR_IDENTITY_LEAK'],
  ['Design Asset exact product claim', readyFixture, (m) => { m.asset_records[0].publication.exact_product_claim = true; }, 'DESIGN_ASSET_EXACT_PRODUCT_CLAIM'],
  ['Product Twin identifier removed', readyFixture, (m) => { m.asset_records[1].identity.identifiers = {}; }, 'PRODUCT_TWIN_IDENTIFIER_REQUIRED'],
  ['premature geometry promotion', readyFixture, (m) => { m.asset_records[1].geometry.claimed_level = 'G3'; }, 'PREMATURE_GEOMETRY_PROMOTION'],
  ['G1 units missing', readyFixture, (m) => { m.asset_records[1].geometry.verified_units = false; }, 'GEOMETRY_G1_UNITS_REQUIRED'],
  ['G1 floor contact missing', readyFixture, (m) => { m.asset_records[1].geometry.floor_contact_verified = false; }, 'GEOMETRY_G1_FLOOR_CONTACT_REQUIRED'],
  ['G1 clearance missing', readyFixture, (m) => { m.asset_records[1].geometry.clearance_verified = false; }, 'GEOMETRY_G1_CLEARANCE_REQUIRED'],
  ['G1 anchor/pivot missing', readyFixture, (m) => { m.asset_records[1].geometry.anchor_pivot_verified = false; }, 'GEOMETRY_G1_ANCHOR_PIVOT_REQUIRED'],
  ['G2 independent scale missing', readyFixture, (m) => { m.asset_records[1].geometry.independent_scale_verified = false; }, 'GEOMETRY_G2_INDEPENDENT_SCALE_REQUIRED'],
  ['G2 disclosure missing', readyFixture, (m) => { m.asset_records[1].geometry.proxy_disclosed = false; }, 'GEOMETRY_G2_DISCLOSURE_REQUIRED'],
  ['G2 display rights missing', readyFixture, (m) => { m.asset_records[1].rights.display_allowed = false; }, 'G2_RENDER_RIGHTS_REQUIRED'],
  ['G3 appearance missing', readyFixture, (m) => {
    m.asset_records[1].geometry.claimed_level = 'G3';
    m.asset_records[1].geometry.verified_level = 'G3';
    m.asset_records[1].geometry.exact_form_verified = true;
  }, 'G3_APPEARANCE_EVIDENCE_REQUIRED'],
  ['G3 rights missing', readyFixture, (m) => {
    const asset = m.asset_records[1];
    asset.geometry.claimed_level = 'G3';
    asset.geometry.verified_level = 'G3';
    asset.geometry.exact_form_verified = true;
    asset.appearance = {...asset.appearance, state: 'EXACT_VERIFIED', canonical_views_verified: true, materials_verified: true, exact_likeness_verified: true};
  }, 'G3_RIGHTS_EVIDENCE_REQUIRED'],
  ['publishable rights missing', readyFixture, (m) => { m.asset_records[0].publication.state = 'PUBLISHABLE'; }, 'PUBLISHABLE_RIGHTS_REQUIRED'],
  ['publishable attribution display missing', readyFixture, (m) => {
    const asset = m.asset_records[0];
    asset.geometry.claimed_level = 'G2';
    asset.geometry.verified_level = 'G2';
    asset.geometry.promotion_state = 'ACCEPTED';
    for (const field of ['verified_dimensions', 'verified_units', 'verified_orientation', 'floor_contact_verified', 'clearance_verified', 'anchor_pivot_verified', 'recognizable_form_verified', 'independent_scale_verified', 'proxy_disclosed']) asset.geometry[field] = true;
    asset.rights = {...asset.rights, state: 'CLEARED', display_allowed: true, derivatives_allowed: true, redistribution_allowed: true};
    asset.publication.state = 'PUBLISHABLE';
  }, 'PUBLISHABLE_ATTRIBUTION_DISPLAY_REQUIRED'],
  ['site boundary fabricated with open gate', readyFixture, (m) => { m.site_evidence.hard_gates_open.push('OFFICIAL_CATASTRO_BOUNDARY'); }, 'SITE_BOUNDARY_GATE_OPEN'],
  ['site planning entitlement fabricated', readyFixture, (m) => { m.site_evidence.hard_gates_open.push('CURRENT_PLANNING_CERTIFICATE'); }, 'SITE_PLANNING_GATE_OPEN'],
  ['site sun/view inputs removed', readyFixture, (m) => { m.site_evidence.claims.terrain = 'ABSENT'; }, 'SITE_SUN_VIEW_INPUTS_MISSING'],
  ['duplicate placement ID', readyFixture, (m) => { m.room_placement.placements[1].placement_id = m.room_placement.placements[0].placement_id; }, 'DUPLICATE_PLACEMENT_ID'],
  ['non-finite placement transform', readyFixture, (m) => { m.room_placement.placements[0].transform.position_m[0] = Number.NaN; }, 'PLACEMENT_POSITION_INVALID'],
  ['fallback transform drift', readyFixture, (m) => { m.room_placement.placements[0].fallback_transform.position_m[0] = 0.1; }, 'ROOM_FALLBACK_TRANSFORM_MISMATCH'],
  ['collision hidden in verified room', readyFixture, (m) => {
    m.room_placement.placements[0].collision_state = 'COLLISION';
    m.room_placement.placements[0].fit_state = 'COLLISION';
  }, 'ROOM_COLLISION_NOT_VERIFIED'],
  ['bundle visible count inconsistent', readyFixture, (m) => {
    m.room_placement.placements[1].bundle.item_quantity = 4;
    m.room_placement.placements[1].bundle.visible_avatar_count = 2;
  }, 'PLACEMENT_BUNDLE_COUNT_INCONSISTENT'],
  ['market evidence leaked from another market', readyFixture, (m) => { m.market_supply[0].evidence.market = 'SE'; }, 'MARKET_EVIDENCE_LEAK'],
  ['destination evidence leaked to another postcode', readyFixture, (m) => { m.market_supply[0].evidence.destination.postal_code = '28001'; }, 'DESTINATION_EVIDENCE_LEAK'],
  ['stale supply marked current', readyFixture, (m) => {
    m.market_supply[0].evidence.freshness_state = 'STALE';
    m.market_supply[0].evidence.valid_until = null;
  }, 'STALE_SUPPLY_MARKED_CURRENT'],
  ['expired supply marked current', readyFixture, (m) => { m.market_supply[0].evidence.valid_until = '2026-08-17T14:31:00Z'; }, 'CURRENT_EVIDENCE_EXPIRED'],
  ['unproven local supplier claim', readyFixture, (m) => {
    m.market_supply[0].local_supplier_claim = true;
    m.market_supply[0].seller_or_dispatch_country = null;
  }, 'LOCAL_SUPPLIER_ORIGIN_UNPROVEN'],
  ['unapproved substitution counted current', readyFixture, (m) => { m.market_supply[0].conditional_substitution.counted_as_current = true; }, 'UNAPPROVED_SUBSTITUTION_COUNTED_CURRENT'],
  ['procurement ready without lead time', readyFixture, (m) => { m.procurement_readiness.gates.known_lead_time = false; }, 'PREMATURE_PROCUREMENT_READY'],
  ['procurement ready with stale evidence', readyFixture, (m) => {
    m.procurement_readiness.evidence.freshness_state = 'RECHECK_REQUIRED';
    m.procurement_readiness.evidence.valid_until = null;
  }, 'PROCUREMENT_READY_WITHOUT_CURRENT_EVIDENCE'],
  ['deployment source commit abbreviated', readyFixture, (m) => { m.deployment_state.source_commit = '04cc623'; }, 'DEPLOYMENT_SOURCE_COMMIT_INVALID'],
  ['deployment evidence expired', readyFixture, (m) => { m.deployment_state.evidence.valid_until = '2026-08-17T14:31:00Z'; }, 'CURRENT_EVIDENCE_EXPIRED'],
  ['blocked release waived in prose', blockedFixture, (m) => { m.release_state = 'READY'; }, 'RELEASE_STATE_MISMATCH'],
  ['declared blockers omit deterministic blocker', blockedFixture, (m) => { m.release_blockers.pop(); }, 'RELEASE_BLOCKERS_MISMATCH'],
];

for (const [name, base, mutate, expectedCode] of mutations) {
  const candidate = clone(base);
  mutate(candidate);
  const result = validateCompositeReleaseManifest(candidate, {now});
  assert.equal(result.status, 'FAIL', `${name} should fail`);
  assert.ok(result.issues.some((issue) => issue.code === expectedCode), `${name} should emit ${expectedCode}; emitted ${result.issues.map((issue) => issue.code).join(', ')}`);
}

const releaseGate = spawnSync(process.execPath, ['scripts/validate-composite-release-manifest.mjs', '--require-ready'], {
  cwd: root,
  encoding: 'utf8',
});
assert.equal(releaseGate.status, 2, releaseGate.stderr || releaseGate.stdout);

console.log(JSON.stringify({
  status: 'PASS',
  honest_blocked_manifest_checks: blockedResult.checks_total,
  ready_fixture_checks: readyResult.checks_total,
  mutation_scenarios: mutations.length,
  blocked_release_gate_exit_code: releaseGate.status,
}, null, 2));
