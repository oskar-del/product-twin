import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {buildCompactHouseRouteBaseline, HOUSE_FILES} from './build-compact-house-route-baseline.mjs';
import {validateCompactHouseRouteBaseline} from './validate-compact-house-route-baseline.mjs';

const ROOT = process.cwd();
const entries = await Promise.all(Object.entries(HOUSE_FILES).filter(([key]) => !['schema', 'output'].includes(key)).map(async ([key, file]) => [key, JSON.parse(await fs.readFile(path.join(ROOT, file), 'utf8'))]));
const sources = Object.fromEntries(entries);
const schema = JSON.parse(await fs.readFile(path.join(ROOT, HOUSE_FILES.schema), 'utf8'));
const snapshotTime = new Date('2026-08-17T20:15:00+02:00');
const baseline = buildCompactHouseRouteBaseline(sources, snapshotTime);
const validate = (candidate, sourceOverride = sources) => validateCompactHouseRouteBaseline(candidate, schema, sourceOverride);

assert.deepEqual(validate(baseline), [], 'canonical compact-house route baseline must pass deterministic validation');
const committed = JSON.parse(await fs.readFile(path.join(ROOT, HOUSE_FILES.output), 'utf8'));
assert.deepEqual(committed, baseline, 'committed compact-house baseline must be reproducible from canonical sources');

assert.equal(baseline.status, 'PRE_BOM_SCOPE_NOT_PROCUREMENT_READY');
assert.equal(baseline.scope_state.state, 'PILOT_ROUTE_MAP_NOT_FULL_BOM');
assert.equal(baseline.scope_state.frozen_house_design, false);
assert.equal(baseline.scope_state.full_bom, false);
assert.equal(baseline.scope_state.quantities_complete, false);
assert.equal(baseline.scope_state.partial_package_count, 7);
assert.equal(baseline.scope_state.missing_package_count, 4);
assert.equal(baseline.packages.length, 11);
assert.deepEqual(
  baseline.packages.map((pkg) => pkg.construction_phase),
  sources.logisticsSchema.construction_phases,
  'package baseline must cover every canonical construction phase exactly once'
);
assert.equal(baseline.source_snapshot.logistics_schema.sha256.length, 64);
assert.equal(baseline.source_snapshot.regulatory_schema.sha256.length, 64);
assert.equal(baseline.source_snapshot.jurisdiction_seed.sha256.length, 64);
assert.equal(baseline.source_snapshot.prefab_system.sha256.length, 64);
assert.equal(baseline.line_items.length, 10);
assert(baseline.line_items.every((line) => line.quantity.state === 'UNRESOLVED' && line.quantity.value === null));
assert(baseline.line_items.every((line) => line.supply_class === 'UNVERIFIED'));
assert(baseline.line_items.every((line) => line.discovery_evidence.evidence_state === 'HISTORICAL_UNDATED_AGGREGATE'));
const poolPumpRegulatory = baseline.line_items.find((line) => line.slot_id === 'WB10_05').discovery_evidence;
assert.equal(poolPumpRegulatory.source_regulatory_state, 'NOT_APPLICABLE');
assert.equal(poolPumpRegulatory.regulatory_state, 'REVIEW');
assert.equal(poolPumpRegulatory.regulatory_derivation_state, 'AUTHORITY_OVERRIDES_HISTORICAL_SOURCE');
assert(baseline.line_items.every((line) => line.readiness.purchase_ready === false && line.readiness.gates.length === 9));
assert.deepEqual(baseline.route_summary, {total_lines: 10, configured_rfq: 1, merchant_cart: 8, direct_trade: 1, needs_requirement: 4, needs_technical_review: 6, executable_now: 0});
assert.equal(baseline.cost_summary.state, 'NO_COMPARABLE_COST_BASIS');
assert.equal(baseline.cost_summary.landed_total, null);
assert.equal(baseline.schedule.state, 'PRE_PROGRAMME');
assert.equal(baseline.schedule.programme_start_date, null);
assert.equal(baseline.procurement_readiness.purchase_ready, false);
assert.equal(baseline.procurement_readiness.blocking_gate_ids.length, 11);
assert.equal(baseline.site_context.cte_zone, 'A3');
assert.equal(baseline.site_context.annual_energy_kwh_per_kwp, 1732.34);
assert.equal(baseline.site_context.product_sizing_state, 'BLOCKED_MISSING_BUILDING_INPUTS');
assert.equal(baseline.construction_strategy.selected_route, null);
assert.equal(baseline.construction_strategy.pod_configuration_selected, false);

const forgedReady = structuredClone(baseline);
forgedReady.procurement_readiness.purchase_ready = true;
forgedReady.procurement_readiness.state = 'READY';
forgedReady.status = 'PURCHASE_READY';
assert(validate(forgedReady).length > 0, 'pre-BoM baseline cannot be promoted to purchase-ready');

const forgedScope = structuredClone(baseline);
forgedScope.scope_state.frozen_house_design = true;
forgedScope.scope_state.full_bom = true;
forgedScope.scope_state.quantities_complete = true;
assert(validate(forgedScope).length > 0, 'missing frozen design, full BoM and quantities cannot be self-asserted complete');

const forgedQuantity = structuredClone(baseline);
forgedQuantity.line_items[0].quantity = {state: 'RESOLVED', value: 100, unit_basis: 'm3'};
assert(validate(forgedQuantity).length > 0, 'pilot quantity basis cannot be converted into an invented quantity');

const forgedSupply = structuredClone(baseline);
forgedSupply.line_items[0].supply_class = 'LOCAL';
assert(validate(forgedSupply).length > 0, 'historical discovery counts cannot be promoted to local or confirmed supply');

const forgedFreshness = structuredClone(baseline);
forgedFreshness.line_items[0].discovery_evidence.evidence_state = 'CURRENT';
assert(validate(forgedFreshness).length > 0, 'undated aggregate discovery counts cannot be called current evidence');

const forgedPackage = structuredClone(baseline);
forgedPackage.packages.find((pkg) => pkg.package_id === 'PKG_SITE_WORKS').coverage_state = 'PILOT_PARTIAL';
assert(validate(forgedPackage).length > 0, 'missing construction packages cannot claim pilot coverage');

const wrongPhase = structuredClone(baseline);
wrongPhase.line_items.find((line) => line.slot_id === 'WB10_06').construction_phase = 'landscape';
assert(validate(wrongPhase).length > 0, 'source fixture phase IDs must map deterministically into canonical package phases');

const forgedCost = structuredClone(baseline);
forgedCost.line_items[0].commercial_state.merchandise = {state: 'VERIFIED', amount: 500, currency: 'EUR', reason: 'forged'};
assert(validate(forgedCost).length > 0, 'cost cannot be emitted without exact identity, quantity and destination quote evidence');

const forgedPrefab = structuredClone(baseline);
forgedPrefab.construction_strategy.selected_route = 'PREFAB';
forgedPrefab.construction_strategy.prefab_state = 'APPROVED';
forgedPrefab.construction_strategy.pod_configuration_selected = true;
assert(validate(forgedPrefab).length > 0, 'prefab modes and pod categories cannot be treated as an approved factory configuration');

const foreignMarket = structuredClone(baseline);
foreignMarket.project.country = 'SE';
foreignMarket.project.postal_code = '21120';
assert(validate(foreignMarket).length > 0, 'Spain pilot evidence must not be reused for Sweden');

const forgedHash = structuredClone(baseline);
forgedHash.source_snapshot.routes.sha256 = '0'.repeat(64);
assert(validate(forgedHash).length > 0, 'canonical source hashes must be immutable');

const checkoutLeak = structuredClone(baseline);
checkoutLeak.line_items[0].route.checkout_payload = {cart_id: 'mutable-cart'};
assert(validate(checkoutLeak).length > 0, 'mutable checkout payloads must be excluded from the permanent baseline');

const cartIdentitySources = structuredClone(sources);
cartIdentitySources.routes.routes[0].selected_external_reference.product_id = 'gid://shopify/Cart/session-token-abc';
assert.throws(
  () => buildCompactHouseRouteBaseline(cartIdentitySources, snapshotTime),
  /immutable Shopify product and variant identity/,
  'mutable cart or session IDs cannot be laundered through product identity fields'
);

const foreignPvgisSources = structuredClone(sources);
foreignPvgisSources.pvgis.location = {...foreignPvgisSources.pvgis.location, lat: 59.3293, lon: 18.0686};
assert.throws(
  () => buildCompactHouseRouteBaseline(foreignPvgisSources, snapshotTime),
  /PVGIS coordinates and elevation must match/,
  'foreign solar-resource evidence cannot be attached to the Spain project'
);

const conflictingSolarSources = structuredClone(sources);
conflictingSolarSources.solarRequirement.verified_site_resource.annual_energy_kwh_per_kwp = 999;
assert.throws(
  () => buildCompactHouseRouteBaseline(conflictingSolarSources, snapshotTime),
  /Solar requirement screening resource must reconcile/,
  'duplicate solar screening facts must reconcile to canonical PVGIS evidence'
);

const futureResultsSources = structuredClone(sources);
futureResultsSources.pilotResults.summary.generated_at = '2099-01-01T00:00:00Z';
assert.throws(
  () => buildCompactHouseRouteBaseline(futureResultsSources, snapshotTime),
  /cannot be later than baseline generation/,
  'future-dated discovery results cannot be stored as historical evidence in an earlier baseline'
);

const contradictoryRouteSources = structuredClone(sources);
const concreteRoute = contradictoryRouteSources.routes.routes.find((route) => route.slot_id === 'WB10_01');
concreteRoute.state = 'needs_technical_review';
concreteRoute.requirement_state = 'complete';
assert.throws(
  () => buildCompactHouseRouteBaseline(contradictoryRouteSources, snapshotTime),
  /route state must reconcile to its incomplete canonical requirement/,
  'route state cannot outrun its canonical requirement'
);

const contradictoryRegulatorySources = structuredClone(sources);
const concreteResult = contradictoryRegulatorySources.pilotResults.slots.find((slot) => slot.slot_id === 'WB10_01');
concreteResult.regulatory_state = 'NOT_APPLICABLE';
assert.throws(
  () => buildCompactHouseRouteBaseline(contradictoryRegulatorySources, snapshotTime),
  /regulatory state does not reconcile to category authority, blockers and missing evidence/,
  'regulatory HOLD cannot be removed while evidence and blocker fields remain open'
);

const coherentlySelfClearedRegulatorySources = structuredClone(sources);
const selfClearedConcrete = coherentlySelfClearedRegulatorySources.pilotResults.slots.find((slot) => slot.slot_id === 'WB10_01');
selfClearedConcrete.regulatory_state = 'NOT_APPLICABLE';
selfClearedConcrete.missing_regulatory_evidence = [];
selfClearedConcrete.blockers = selfClearedConcrete.blockers.filter((blocker) => blocker !== 'regulatory_gate');
assert.throws(
  () => buildCompactHouseRouteBaseline(coherentlySelfClearedRegulatorySources, snapshotTime),
  /regulatory state does not reconcile to category authority, blockers and missing evidence/,
  'a regulated structural category cannot self-clear by editing all redundant result fields together'
);

const foreignCteSources = structuredClone(sources);
foreignCteSources.cteClimate.province = 'Stockholm';
foreignCteSources.cteClimate.evidence_note = 'forged foreign climate evidence';
assert.throws(
  () => buildCompactHouseRouteBaseline(foreignCteSources, snapshotTime),
  /CTE province and authority must match/,
  'verified CTE context must join to the project province and official authority'
);

const stalePhaseAuthority = structuredClone(sources);
stalePhaseAuthority.logisticsSchema.construction_phases[0] = 'preliminaries';
assert.throws(
  () => buildCompactHouseRouteBaseline(stalePhaseAuthority, snapshotTime),
  /must exactly follow the canonical logistics construction phases/,
  'package phases must fail when the hashed logistics authority changes'
);

const contradictorySources = structuredClone(sources);
contradictorySources.pilotResults.slots[0].technical_match_verified = true;
assert(validate(baseline, contradictorySources).some((error) => error.includes('source compilation failed')), 'validator must fail when canonical sources contradict the fail-closed pilot state');

assert(validateCompactHouseRouteBaseline(baseline, schema).some((error) => error.includes('requires every canonical source')), 'validation without canonical sources must fail closed');

console.log('compact-house route baseline: source hashes, canonical phase/prefab/regulatory authorities, CTE/site/solar/temporal joins, authority-derived regulatory states, route semantics, immutable identities, historical discovery quarantine, unresolved quantities, cost/supply isolation and readiness gates passed');
