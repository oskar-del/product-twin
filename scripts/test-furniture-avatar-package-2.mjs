import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  FURNITURE_PACKAGE_2_COMMIT,
  createGitCommitSource,
  loadFurniturePackage2,
  internalsForTest,
  verifyFurniturePackage2,
} from './lib/furniture-avatar-package-2-gate.mjs';

const source = createGitCommitSource({commit: FURNITURE_PACKAGE_2_COMMIT});
const original = loadFurniturePackage2(source);
const clone = () => structuredClone(original);
const evaluate = (bundle) => verifyFurniturePackage2(bundle, source, {
  evaluatedAt: '2026-08-18T12:00:00+02:00',
  sourceCommitDate: source.commitDate(),
});
const emitted = (result, code, pathFragment = null) => result.failed_gates.some((issue) => issue.code === code && (pathFragment === null || issue.path.includes(pathFragment)));

const baseline = evaluate(clone());
assert.equal(baseline.decision, 'BLOCK');
assert.deepEqual(baseline.eligibility, {package_acceptance: 'BLOCK', internal_room_alpha: 'BLOCK', public_publication: 'BLOCK'});
for (const code of [
  'SOURCE_COMMIT_UNDECLARED',
  'EVIDENCE_OBSERVED_AT_MISSING',
  'EVIDENCE_FRESHNESS_STATE_MISSING',
  'MANIFEST_SCHEMA_ASSET_PROPERTIES_MISNESTED',
  'QA_RENDERER_DEPENDENCY_UNBOUND',
  'G2_DIMENSION_SOURCE_OBSERVATION_UNBOUND',
  'G2_DIMENSION_SOURCE_FRESHNESS_UNBOUND',
  'VISUAL_QA_AXIS_MISSING',
  'ORIENTATION_VIEW_CAMERA_EVIDENCE_MISSING',
  'CANONICAL_FRONT_REAR_LABEL_REVERSED',
  'FUNCTIONAL_CLEARANCE_UNVERIFIED',
  'FUNCTIONAL_CLEARANCE_ENVELOPE_INCOMPLETE',
]) assert.ok(baseline.failed_gate_codes.includes(code), `baseline must expose ${code}`);
assert.equal(baseline.observed_passes.package_artifacts, '46/46');
assert.equal(baseline.observed_passes.primary_glb_hash_and_bounds, '4/4');
assert.equal(baseline.observed_passes.canonical_views_hashed, '28/28');
assert.ok(baseline.public_failed_gate_codes.includes('PUBLIC_RIGHTS_APPROVAL_MISSING'));
assert.ok(baseline.public_failed_gate_codes.includes('PUBLIC_ATTRIBUTION_DISPLAY_UNVERIFIED'));

const committedResult = JSON.parse(fs.readFileSync('data/verification/reports/furniture-avatar-manifest-v0.1-package-2-independent-result.json', 'utf8'));
const resultSchema = JSON.parse(fs.readFileSync('config/verification/furniture-avatar-package-2-independent-result.schema.json', 'utf8'));
const resultSchemaIssues = [];
internalsForTest.validateSchema(committedResult, resultSchema, resultSchema, 'result', resultSchemaIssues);
assert.deepEqual(resultSchemaIssues, []);
assert.equal(committedResult.decision, baseline.decision);
assert.deepEqual(committedResult.eligibility, baseline.eligibility);
assert.equal(committedResult.evidence_files_inspected.count, baseline.evidence_files_inspected.length);
for (const [code, count] of Object.entries(committedResult.failed_gates)) assert.equal(baseline.failed_gates.filter((issue) => issue.code === code).length, count, `committed count for ${code}`);
for (const [code, count] of Object.entries(committedResult.public_failed_gates)) assert.equal(baseline.public_failed_gates.filter((issue) => issue.code === code).length, count, `committed public count for ${code}`);

const mutations = [
  ['missing stable ID', (b) => { delete b.manifest.assets[0].asset_id; }, 'ASSET_ID_INVALID'],
  ['duplicate stable IDs', (b) => { b.manifest.assets[1].asset_id = b.manifest.assets[0].asset_id; }, 'DUPLICATE_ASSET_ID'],
  ['unknown waiver field', (b) => { b.packageRecord.scripted_gate_waiver = true; }, 'UNKNOWN_FIELD', 'scripted_gate_waiver'],
  ['false G-level promotion', (b) => { b.manifest.assets[0].geometry.level = 'G5'; }, 'G_LEVEL_EVIDENCE_INSUFFICIENT'],
  ['G2 declared-envelope-only promotion', (b) => { b.manifest.assets[0].independent_scale.method = 'DECLARED_ENVELOPE_ONLY'; }, 'G2_DECLARED_ENVELOPE_ONLY'],
  ['nested Design Asset commerce alias', (b) => {
    const asset = b.manifest.assets[0];
    asset.record_lane = 'DESIGN_ASSET';
    asset.product_identity = null;
    asset.placement.catalogue = {supplierQuote: {unitPrice: 1000}};
  }, 'DESIGN_ASSET_COMMERCE_LEAK', 'supplierQuote'],
  ['cross-market supply evidence in avatar', (b) => { b.manifest.assets[0].appearance.supplyEvidence = {market: 'ES', inheritedBy: 'SE'}; }, 'AVATAR_SUPPLY_LEAK', 'market'],
  ['invalid non-finite dimensions', (b) => { b.manifest.assets[0].dimensions.width = Number.NaN; }, 'DIMENSIONS_INVALID'],
  ['missing attribution payload', (b) => { b.manifest.assets[0].attribution.display_text = ''; }, 'ATTRIBUTION_PAYLOAD_MISSING'],
  ['attribution requirement removed', (b) => { b.manifest.assets[0].attribution.required = false; }, 'ATTRIBUTION_REQUIREMENT_REMOVED'],
  ['rights-state public bypass', (b) => { b.manifest.assets[0].publication.public_allowed = true; }, 'PUBLIC_RIGHTS_BYPASS'],
  ['GLB substitution', (b) => { b.manifest.assets[0].geometry.sha256 = '0'.repeat(64); }, 'GEOMETRY_HASH_MISMATCH'],
  ['unsafe geometry URI', (b) => { b.manifest.assets[0].geometry.uri = '../outside.glb'; }, 'GEOMETRY_URI_INVALID'],
  ['package artifact substitution', (b) => { b.packageRecord.artifacts[0].sha256 = '0'.repeat(64); }, 'PACKAGE_ARTIFACT_HASH_MISMATCH'],
  ['canonical view substitution', (b) => { b.qa.assets[0].views[0].sha256 = '0'.repeat(64); }, 'CANONICAL_VIEW_HASH_MISMATCH'],
  ['canonical view removed', (b) => { b.qa.assets[0].views.pop(); }, 'CANONICAL_VIEW_SET_INCOMPLETE'],
  ['floor-contact evidence falsified', (b) => { b.qa.assets[0].automated_checks.floor_contact_error_mm = 25; }, 'QA_FLOOR_CONTACT_FAILED'],
  ['orientation camera on wrong side', (b) => { b.qa.assets[0].views.find((view) => view.view === 'front').camera_side_vector = [0, 0, 1]; }, 'ORIENTATION_VIEW_CAMERA_SIDE_MISMATCH'],
  ['unsafe functional-clearance distance', (b) => { b.manifest.assets[0].functional_clearance.zones[0].distance_mm = -1; }, 'FUNCTIONAL_CLEARANCE_DISTANCE_INVALID'],
  ['missing independent scale evidence', (b) => { b.manifest.assets[0].independent_scale.evidence = []; }, 'G2_SCALE_EVIDENCE_INCOMPLETE'],
  ['public count escalation', (b) => { b.packageRecord.expected_gate_state.publicly_publishable = 4; }, 'PUBLICATION_COUNT_ESCALATION'],
  ['source commit substitution', (b) => { b.packageRecord.source_commit = '0'.repeat(40); }, 'SOURCE_COMMIT_UNDECLARED'],
];

for (const [name, mutate, code, pathFragment] of mutations) {
  const bundle = clone();
  mutate(bundle);
  const result = evaluate(bundle);
  assert.equal(result.decision, 'BLOCK', `${name} must block`);
  assert.ok(emitted(result, code, pathFragment), `${name} must emit ${code}${pathFragment ? ` at ${pathFragment}` : ''}`);
}

console.log(JSON.stringify({
  status: 'PASS',
  source_commit: FURNITURE_PACKAGE_2_COMMIT,
  baseline_decision: baseline.decision,
  baseline_failed_gate_codes: baseline.failed_gate_codes.length,
  package_artifacts: baseline.observed_passes.package_artifacts,
  primary_glb_hash_and_bounds: baseline.observed_passes.primary_glb_hash_and_bounds,
  canonical_views_hashed: baseline.observed_passes.canonical_views_hashed,
  mutation_scenarios: mutations.length,
  committed_result_schema: 'PASS',
  scripted_gate_waivers: 'FORBIDDEN',
}, null, 2));
