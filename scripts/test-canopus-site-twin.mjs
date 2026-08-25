import assert from 'node:assert/strict';
import { loadCanopusBundle, validateCanopusBundle } from './validate-canopus-site-twin.mjs';

const baseline = await loadCanopusBundle();
const pass = validateCanopusBundle(baseline);
assert.equal(pass.status, 'PASS', JSON.stringify(pass.issues, null, 2));
assert.equal(pass.checks_passed, pass.checks_total);
assert.equal(pass.summary.raw_boundary_geometry, 'ABSENT_AS_REQUIRED');
assert.equal(pass.summary.planning_entitlement, 'UNRESOLVED_AS_REQUIRED');
assert.deepEqual(validateCanopusBundle(baseline), pass, 'Validator output must be deterministic.');

function mutated(change) {
  const fixture = structuredClone(baseline);
  change(fixture);
  return validateCanopusBundle(fixture);
}

function expectBlocked(name, change, expectedIssueId) {
  const result = mutated(change);
  assert.equal(result.status, 'BLOCKED', `${name} should block`);
  assert.ok(result.issue_ids.includes(expectedIssueId), `${name} should include ${expectedIssueId}; got ${result.issue_ids.join(', ')}`);
}

expectBlocked('fabricated boundary polygon', (fixture) => {
  fixture.site.spatial.boundary.geometry = { type: 'Polygon', coordinates: [] };
}, 'raw:boundary_geometry_absent');

expectBlocked('fabricated boundary CRS', (fixture) => {
  fixture.site.spatial.boundary.crs = 'EPSG:25830';
}, 'raw:boundary_crs_absent');

expectBlocked('unverified DEM path', (fixture) => {
  fixture.site.spatial.terrain.raw_dem = '.runtime/canopus/fake-dem.tif';
}, 'raw:terrain_dem_absent');

expectBlocked('invented access point', (fixture) => {
  fixture.site.access.permitted_access_point = { latitude: 36.5, longitude: -4.97 };
}, 'raw:access_permission_absent');

expectBlocked('invented entitlement', (fixture) => {
  fixture.site.planning.entitlement = { buildable_area_m2: 32000 };
}, 'raw:planning_entitlement_absent');

expectBlocked('seller buildability promoted to concept fact', (fixture) => {
  fixture.project.seller_brief.assertions.buildable_area_m2.evidence_class = 'concept';
  fixture.project.seller_brief.assertions.buildable_area_m2.verification.status = 'design_intent_only';
}, 'facts:seller_buildable_class');

expectBlocked('public realm conflated with seller allowance', (fixture) => {
  fixture.scenario.programme.assertions.public_realm_area_m2.evidence_class = 'seller_stated';
  fixture.scenario.programme.assertions.public_realm_area_m2.verification.status = 'seller_document_pending';
}, 'facts:public_realm_separate_class');

expectBlocked('missing assertion authority', (fixture) => {
  delete fixture.site.identity.assertions.registered_area_m2.source.authority;
}, 'assertion:$.site.identity.assertions.registered_area_m2:source_authority');

expectBlocked('out-of-range source page', (fixture) => {
  fixture.scenario.assertions.scenario_name.source.pdf_page = 99;
}, 'assertion:$.scenario.assertions.scenario_name:source_page');

expectBlocked('broken scenario reference', (fixture) => {
  fixture.project.design_scenario_refs = ['SCN_OTHER'];
}, 'entity:project_scenario_ref');

expectBlocked('missing Catastro hard gate', (fixture) => {
  fixture.site.hard_gates = fixture.site.hard_gates.filter((gate) => gate.gate_id !== 'GATE_CATASTRO_BOUNDARY');
}, 'gates:required_set');

expectBlocked('boundary WKT bypass', (fixture) => {
  fixture.site.spatial.boundary.wkt = 'POLYGON EMPTY';
}, 'schema:site:$.spatial.boundary:additionalProperties:wkt');

expectBlocked('scenario vertex bypass', (fixture) => {
  fixture.scenario.geometry.vertices_m = [[0, 0, 0]];
}, 'schema:scenario:$.geometry:additionalProperties:vertices_m');

expectBlocked('assertion geometry bypass', (fixture) => {
  fixture.site.identity.assertions.registered_area_m2.geometry = { type: 'Polygon' };
}, 'schema:site:$.identity.assertions.registered_area_m2:additionalProperties:geometry');

expectBlocked('unknown schema version', (fixture) => {
  fixture.project.schema_version = '9.9';
}, 'schema:project:$.schema_version:const');

expectBlocked('unknown project field', (fixture) => {
  fixture.project.unknown_field = true;
}, 'schema:project:$:additionalProperties:unknown_field');

console.log(JSON.stringify({
  status: 'PASS',
  baseline_checks: pass.checks_total,
  mutation_scenarios: 16,
  assertions: pass.summary.assertions,
  hard_gates: pass.summary.hard_gates,
}, null, 2));
