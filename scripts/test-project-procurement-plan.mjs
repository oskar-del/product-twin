import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {buildProcurementPlan, FILES, SUPPLY_CLASSES} from './build-living-room-procurement-plan.mjs';
import {validateProcurementPlan} from './validate-project-procurement-plan.mjs';

const ROOT = process.cwd();
const [design, evidence, session, schema] = await Promise.all([
  fs.readFile(path.join(ROOT, FILES.design), 'utf8').then(JSON.parse),
  fs.readFile(path.join(ROOT, FILES.offers), 'utf8').then(JSON.parse),
  fs.readFile(path.join(ROOT, FILES.session), 'utf8').then(JSON.parse),
  fs.readFile(path.join(ROOT, 'config/project-procurement-plan.schema.json'), 'utf8').then(JSON.parse)
]);

const snapshotTime = new Date('2026-08-17T18:00:00+02:00');
const sourceData = {design, evidence, session};
const validate = (candidate, options = {}) => validateProcurementPlan(candidate, schema, {sourceData, ...options});
const plan = buildProcurementPlan({design, evidence, session, asOf: snapshotTime});
assert.deepEqual(validate(plan), [], 'the canonical plan must pass schema and deterministic business validation');
const committedPlan = JSON.parse(await fs.readFile(path.join(ROOT, FILES.output), 'utf8'));
assert.deepEqual(committedPlan, plan, 'the committed manifest must be reproducible from its source evidence and generated_at');

assert.equal(plan.source_snapshot.placement_snapshot.state, 'IDENTITY_QUANTITY_ONLY');
assert.equal(plan.source_snapshot.placement_snapshot.transforms_included, false);
assert.equal(plan.source_snapshot.placement_snapshot.bundle_membership_included, false);
assert.equal(plan.classification_summary.total_lines, 8);
assert.equal(plan.classification_summary.total_units, 8);
assert.deepEqual(plan.classification_summary.classes.map((entry) => entry.supply_class), SUPPLY_CLASSES);

const classes = Object.fromEntries(plan.classification_summary.classes.map((entry) => [entry.supply_class, entry]));
assert.equal(classes.LOCAL.unit_quantity, 0);
assert.equal(classes.CONFIRMED_WITHIN_10_DAYS.unit_quantity, 7);
assert.equal(classes.CONFIRMED_WITHIN_10_DAYS.unit_percentage, 87.5);
assert.equal(classes.CONFIRMED_BEYOND_10_DAYS.unit_quantity, 0);
assert.equal(classes.UNAVAILABLE.unit_quantity, 1);
assert.equal(classes.UNAVAILABLE.unit_percentage, 12.5);
assert.equal(classes.UNVERIFIED.unit_quantity, 0);

assert.equal(plan.cost_summary.specified_merchandise.amount, 1126.96);
assert.equal(plan.cost_summary.currently_deliverable_merchandise.amount, 927.96);
assert.equal(plan.cost_summary.freight.state, 'CONTAMINATED_EVIDENCE');
assert.equal(plan.cost_summary.freight.amount, null);
assert.equal(plan.cost_summary.tax_and_duty.amount, null);
assert.equal(plan.cost_summary.installation.amount, null);
assert.equal(plan.cost_summary.contingency.amount, null);
assert.equal(plan.cost_summary.landed_total.amount, null);

const coffeeTable = plan.line_items.find((line) => line.placement_id === 'LR_COFFEE_TABLE_01');
assert.equal(coffeeTable.primary_product.twin_id, 'PT_IKEA_LISTERBY_30513904', 'the selected design must retain LISTERBY');
assert.equal(coffeeTable.primary_product.supply_class, 'UNAVAILABLE');
assert.equal(coffeeTable.alternatives.length, 1);
const valnas = coffeeTable.alternatives[0];
assert.equal(valnas.twin_id, 'PT_IKEA_VALNAS_20628038');
assert.equal(valnas.state, 'CONDITIONAL_NOT_APPROVED');
assert.equal(valnas.supply_class, 'UNVERIFIED', 'delivery availability without a dated lead time remains unverified in the five-class plan');
assert.equal(valnas.deltas.cost.amount, 50);
assert.equal(valnas.deltas.carbon.state, 'UNVERIFIED');
assert.equal(valnas.deltas.schedule.state, 'UNVERIFIED');
assert.equal(plan.consumer_contract.selected_design_mutated, false);
assert.equal(plan.consumer_contract.conditional_alternatives_auto_applied, false);

assert.equal(plan.delivery_schedule.state, 'BLOCKED');
assert.equal(plan.delivery_schedule.scheduled_groups[0].line_item_ids.length, 7);
assert.equal(plan.delivery_schedule.scheduled_groups[0].membership_evidence_state, 'COUNT_RECONCILED_NOT_ITEMIZED');
assert.deepEqual(plan.delivery_schedule.blocked_line_item_ids, [coffeeTable.line_item_id]);
assert(plan.risk_register.some((risk) => risk.risk_id === 'RISK_CART_MEMBERSHIP_NOT_ITEMIZED'));
assert.equal(plan.evidence_freshness.overall_state, 'CURRENT');
assert.equal(plan.evidence_freshness.current_count, 9);
assert.equal(plan.procurement_readiness.purchase_ready, false);
assert.equal(plan.status, 'DRAFT_NOT_PURCHASE_READY');
assert(plan.procurement_readiness.blocking_gate_ids.includes('CLEAN_FREIGHT'));
assert(plan.procurement_readiness.blocking_gate_ids.includes('SUBSTITUTION_APPROVALS'));
assert.deepEqual(validate(plan, {currentAt: snapshotTime}), [], 'the monitor must accept evidence inside its validity window');
assert.equal(
  validate(plan, {currentAt: new Date('2026-08-18T00:00:00+02:00')}).filter((error) => error.includes('is not current')).length,
  9,
  'the current-use monitor must block all eight selected lines and the conditional alternative after their evidence expires'
);

const expiredPlan = buildProcurementPlan({design, evidence, session, asOf: new Date('2026-08-18T00:00:00+02:00')});
const expiredClasses = Object.fromEntries(expiredPlan.classification_summary.classes.map((entry) => [entry.supply_class, entry.unit_quantity]));
assert.equal(expiredClasses.UNVERIFIED, 8, 'expired evidence must downgrade every selected line to unverified');
assert.equal(expiredClasses.UNAVAILABLE, 0, 'an expired unavailable observation is no longer a current unavailable claim');
assert.equal(expiredPlan.evidence_freshness.overall_state, 'EXPIRED');
assert.equal(expiredPlan.evidence_freshness.expired_count, 9);
assert.equal(expiredPlan.cost_summary.specified_merchandise.state, 'HISTORICAL');
assert.equal(expiredPlan.cost_summary.currently_deliverable_merchandise.state, 'UNVERIFIED');
assert.equal(expiredPlan.cost_summary.currently_deliverable_merchandise.amount, null);
assert.equal(expiredPlan.procurement_readiness.purchase_ready, false);
assert.deepEqual(validate(expiredPlan), [], 'expired plans remain valid records while clearly failing current supply/readiness');

const swedenDesign = structuredClone(design);
swedenDesign.destination = {...swedenDesign.destination, country: 'SE', region: 'Skane', postal_code: '21120'};
assert.throws(
  () => buildProcurementPlan({design: swedenDesign, evidence, session, asOf: snapshotTime}),
  /Destination-specific evidence is required for SE 21120/,
  'the compiler must reject Spain price, stock and delivery evidence for Sweden'
);

const falseReady = structuredClone(plan);
falseReady.procurement_readiness.purchase_ready = true;
falseReady.procurement_readiness.state = 'READY';
falseReady.status = 'PURCHASE_READY';
assert(validate(falseReady).some((error) => error.includes('Global readiness')), 'the validator must reject readiness that bypasses failed gates');

const dummyGateReady = structuredClone(plan);
for (const line of dummyGateReady.line_items) {
  line.readiness = {purchase_ready: true, state: 'READY', gates: [{gate: 'DUMMY', state: 'PASS', critical: true, reason: 'forged'}]};
}
dummyGateReady.procurement_readiness = {
  purchase_ready: true,
  state: 'READY',
  gate_policy: plan.procurement_readiness.gate_policy,
  gates: [{gate: 'DUMMY', state: 'PASS', critical: true, reason: 'forged'}],
  blocking_gate_ids: []
};
dummyGateReady.status = 'PURCHASE_READY';
assert(validate(dummyGateReady).some((error) => error.includes('exact gate set')), 'dummy PASS gates must not bypass independently derived readiness');

const forgedLocal = structuredClone(plan);
forgedLocal.line_items.find((line) => line.placement_id === 'LR_COFFEE_TABLE_01').primary_product.supply_class = 'LOCAL';
assert(validate(forgedLocal).some((error) => error.includes('supply_class')), 'LOCAL must be independently derived from verified physical locality evidence');

const countryOnlyEvidence = structuredClone(evidence);
countryOnlyEvidence.offers.find((offer) => offer.offer_ref === 'OFFER_ROUTE_IKEA_ES_KIVIK_49440597').seller_country = 'ES';
const countryOnlyPlan = buildProcurementPlan({design, evidence: countryOnlyEvidence, session, asOf: snapshotTime});
assert.equal(
  countryOnlyPlan.line_items.find((line) => line.placement_id === 'LR_SOFA_01').primary_product.supply_class,
  'CONFIRMED_WITHIN_10_DAYS',
  'country-level seller evidence must not be promoted to LOCAL without a verified physical location'
);

const distantLocalEvidence = structuredClone(evidence);
distantLocalEvidence.offers.find((offer) => offer.offer_ref === 'OFFER_ROUTE_IKEA_ES_KIVIK_49440597').locality_evidence = {
  state: 'VERIFIED_LOCAL_LOCATION',
  source_ref: 'source://physical-location/barcelona',
  origin_location: {country: 'ES', region: 'Barcelona', postal_code: '08001'},
  distance_km: 1000
};
const distantLocalPlan = buildProcurementPlan({design, evidence: distantLocalEvidence, session, asOf: snapshotTime});
assert.equal(
  distantLocalPlan.line_items.find((line) => line.placement_id === 'LR_SOFA_01').primary_product.supply_class,
  'CONFIRMED_WITHIN_10_DAYS',
  'a distant same-country seller must not pass the explicit project-local radius'
);
assert.deepEqual(validateProcurementPlan(distantLocalPlan, schema, {sourceData: {design, evidence: distantLocalEvidence, session}}), []);

const falseApproval = structuredClone(plan);
falseApproval.line_items.find((line) => line.placement_id === 'LR_COFFEE_TABLE_01').alternatives[0].state = 'APPROVED';
assert(validate(falseApproval).some((error) => error.includes('state must be derived from all critical approval gates')), 'VALNÄS approval state cannot contradict fit and client gates');

const forgedAlternativeDelivery = structuredClone(plan);
const forgedValnas = forgedAlternativeDelivery.line_items.find((line) => line.placement_id === 'LR_COFFEE_TABLE_01').alternatives[0];
forgedValnas.delivery = {...forgedValnas.delivery, lead_time_days_min: 1, lead_time_days_max: 2, window_source: 'FORGED_WINDOW'};
forgedValnas.supply_class = 'CONFIRMED_WITHIN_10_DAYS';
forgedValnas.deltas.schedule = {...forgedValnas.deltas.schedule, state: 'DATED_WINDOW_CAPTURED', lead_time_days_min: 1, lead_time_days_max: 2};
assert(validate(forgedAlternativeDelivery).some((error) => error.includes('canonical alternative offer')), 'alternative delivery and lead time must be joined to the canonical offer');

const foreignAlternativeEvidence = structuredClone(evidence);
const foreignValnasOffer = foreignAlternativeEvidence.offers.find((offer) => offer.offer_ref === 'OFFER_ROUTE_IKEA_ES_VALNAS_20628038');
foreignValnasOffer.price = {amount: '2499', currency: 'SEK'};
foreignValnasOffer.delivery = {...foreignValnasOffer.delivery, country: 'SE', postal_code: '21120'};
assert.throws(
  () => buildProcurementPlan({design, evidence: foreignAlternativeEvidence, session, asOf: snapshotTime}),
  /requires destination-specific evidence for ES 29660/,
  'foreign-market alternatives must not enter a Spain plan'
);

const sourceApprovedButUnscheduled = structuredClone(evidence);
const candidateApprovedButUnscheduled = sourceApprovedButUnscheduled.substitution_candidates[0];
candidateApprovedButUnscheduled.role_match = 'PASS';
candidateApprovedButUnscheduled.dimension_and_circulation_fit = 'PASS';
candidateApprovedButUnscheduled.technical_compatibility = 'PASS';
candidateApprovedButUnscheduled.colour_finish_material_match = 'PASS';
candidateApprovedButUnscheduled.client_design_approval = 'APPROVED';
const approvedButUnscheduledPlan = buildProcurementPlan({design, evidence: sourceApprovedButUnscheduled, session, asOf: snapshotTime});
const unscheduledAlternative = approvedButUnscheduledPlan.line_items.find((line) => line.placement_id === 'LR_COFFEE_TABLE_01').alternatives[0];
assert.equal(unscheduledAlternative.state, 'CONDITIONAL_NOT_APPROVED', 'design approval cannot bypass destination-supply and dated-schedule gates');
assert(approvedButUnscheduledPlan.procurement_readiness.blocking_gate_ids.includes('SUBSTITUTION_APPROVALS'));

const forgedCandidateDelta = structuredClone(evidence);
forgedCandidateDelta.substitution_candidates[0].price_delta_eur = '999.00';
assert.throws(
  () => buildProcurementPlan({design, evidence: forgedCandidateDelta, session, asOf: snapshotTime}),
  /price delta must equal alternative price minus selected primary price/,
  'substitution cost delta must be computed from canonical primary and alternative prices'
);

const falseSourceCompleteness = structuredClone(plan);
falseSourceCompleteness.source_snapshot.placement_snapshot = {
  ...falseSourceCompleteness.source_snapshot.placement_snapshot,
  state: 'COMPLETE',
  transforms_included: true,
  bundle_membership_included: true,
  missing_inputs: []
};
assert(validate(falseSourceCompleteness).some((error) => error.includes('hashed design source')), 'source completeness must be derived from hashed Room Lab inputs');

const assertedApprovalAndAccess = structuredClone(plan);
assertedApprovalAndAccess.line_items[0].approval_state = 'PROCUREMENT_APPROVED';
assertedApprovalAndAccess.destination.site_access_state = 'VERIFIED';
assert(validate(assertedApprovalAndAccess).some((error) => error.includes('cannot claim procurement approval')), 'line approval requires canonical hashed evidence');
assert(validate(assertedApprovalAndAccess).some((error) => error.includes('Site access must remain UNVERIFIED')), 'site access requires canonical hashed evidence');

const missingRequiredRisk = structuredClone(plan);
missingRequiredRisk.risk_register = missingRequiredRisk.risk_register.filter((risk) => risk.risk_id !== 'RISK_SELECTED_PRODUCT_UNAVAILABLE');
assert(validate(missingRequiredRisk).some((error) => error.includes('Risk register records must exactly match')), 'required risks must be independently derived');

const softenedRisk = structuredClone(plan);
Object.assign(softenedRisk.risk_register.find((risk) => risk.risk_id === 'RISK_SELECTED_PRODUCT_UNAVAILABLE'), {
  severity: 'LOW', state: 'CLOSED', evidence: 'resolved without evidence', mitigation: 'none', owner: 'nobody'
});
assert(validate(softenedRisk).some((error) => error.includes('Risk register records must exactly match')), 'risk severity, state, evidence, mitigation and owner must not be self-asserted');

const forgedRole = structuredClone(plan);
forgedRole.line_items.find((line) => line.placement_id === 'LR_SOFA_01').generic_specification_role = 'STRUCTURE.CONCRETE';
assert(validate(forgedRole).some((error) => error.includes('canonical role map')), 'generic specification roles must match the authoritative role map');

const forgedCarbon = structuredClone(plan);
forgedCarbon.line_items.find((line) => line.placement_id === 'LR_COFFEE_TABLE_01').alternatives[0].deltas.carbon = {
  state: 'VERIFIED', kg_co2e_delta: -999, reason: 'forged', source_ref: 'source://forged-carbon'
};
assert(validate(forgedCarbon).some((error) => error.includes('carbon delta must remain unverified')), 'carbon deltas require canonical comparable evidence');

const mixedCost = structuredClone(plan);
mixedCost.cost_summary.freight = {state: 'VERIFIED', amount: 10, currency: 'USD', reason: 'forged', source_ref: FILES.session};
mixedCost.cost_summary.tax_and_duty = {state: 'VERIFIED', amount: 1, currency: 'EUR', reason: 'forged', source_ref: FILES.session};
mixedCost.cost_summary.installation = {state: 'VERIFIED', amount: 2, currency: 'EUR', reason: 'forged', source_ref: FILES.session};
mixedCost.cost_summary.contingency = {state: 'VERIFIED', amount: 3, currency: 'EUR', reason: 'forged', source_ref: FILES.session};
mixedCost.cost_summary.landed_total = {state: 'VERIFIED', amount: 1, currency: 'GBP', reason: 'forged', source_ref: FILES.session};
assert(validate(mixedCost).some((error) => error.includes('currency must match plan currency')), 'mixed-currency landed totals must fail');
assert(validate(mixedCost).some((error) => error.includes('Landed total')), 'landed total must reconcile and retain canonical source evidence');

const wrongSession = structuredClone(session);
wrongSession.destination = {...wrongSession.destination, country: 'SE', postal_code: '21120'};
wrongSession.exact_room_products = [];
assert.throws(
  () => buildProcurementPlan({design, evidence, session: wrongSession, asOf: snapshotTime}),
  /Session destination SE 21120 does not match design destination ES 29660/,
  'session destination and product membership must be joined before using delivery dates or freight'
);

const invertedDeliverySession = structuredClone(session);
invertedDeliverySession.combined_cart_evidence.home_delivery_29660.delivery_date_min = '2099-12-31';
invertedDeliverySession.combined_cart_evidence.home_delivery_29660.delivery_date_max = '1900-01-01';
assert.throws(
  () => buildProcurementPlan({design, evidence, session: invertedDeliverySession, asOf: snapshotTime}),
  /delivery window maximum cannot be earlier/,
  'delivery calendar windows must be valid and ordered'
);

const quantityDesign = structuredClone(design);
quantityDesign.placements.find((placement) => placement.placement_id === 'LR_SOFA_01').quantity = 2;
const quantitySession = structuredClone(session);
quantitySession.coverage_result.placed_units = 9;
assert.throws(
  () => buildProcurementPlan({design: quantityDesign, evidence, session: quantitySession, asOf: snapshotTime}),
  /Session quantity does not match frozen placement quantity/,
  'placement quantities must reconcile to per-product session evidence before totals or cart windows are used'
);

const wrongArticleSession = structuredClone(session);
wrongArticleSession.exact_room_products.find((product) => product.twin_id === 'PT_IKEA_KIVIK_49440597').article_no = '000.000.00';
assert.throws(
  () => buildProcurementPlan({design, evidence, session: wrongArticleSession, asOf: snapshotTime}),
  /Session article number does not match Product Twin identity/,
  'session retail article identity must join to the exact Product Twin'
);

const futureEvidence = structuredClone(evidence);
for (const offer of futureEvidence.offers) offer.observed_at = '2099-01-01T00:00:00Z';
const futureObservationPlan = buildProcurementPlan({design, evidence: futureEvidence, session, asOf: snapshotTime});
assert.equal(futureObservationPlan.evidence_freshness.overall_state, 'UNKNOWN');
assert.equal(futureObservationPlan.classification_summary.classes.find((entry) => entry.supply_class === 'UNVERIFIED').unit_quantity, 8);
assert.equal(futureObservationPlan.cost_summary.specified_merchandise.state, 'HISTORICAL');

const expiringAlternativeEvidence = structuredClone(evidence);
expiringAlternativeEvidence.offers.find((offer) => offer.offer_ref === 'OFFER_ROUTE_IKEA_ES_VALNAS_20628038').expires_at = '2026-08-17T17:00:00+02:00';
const expiringAlternativePlan = buildProcurementPlan({design, evidence: expiringAlternativeEvidence, session, asOf: new Date('2026-08-17T16:00:00+02:00')});
const staleAlternativeErrors = validateProcurementPlan(expiringAlternativePlan, schema, {
  sourceData: {design, evidence: expiringAlternativeEvidence, session},
  currentAt: new Date('2026-08-17T18:00:00+02:00')
});
assert(staleAlternativeErrors.some((error) => error.includes('SUB_LISTERBY_TO_VALNAS is not current')), 'the live monitor must also expire conditional alternatives');

const checkoutLeak = structuredClone(plan);
checkoutLeak.line_items.find((line) => line.placement_id === 'LR_COFFEE_TABLE_01').alternatives[0].deltas.cost.checkout_payload = {cart_id: 'mutable-cart'};
assert(validate(checkoutLeak).some((error) => error.includes('checkout_payload is not allowed')), 'the schema must reject mutable checkout payloads even when nested in deltas');

assert(validateProcurementPlan(plan, schema).some((error) => error.includes('requires the design, offer and session source data')), 'full deterministic validation must fail when canonical sources are omitted');

const workflow = await fs.readFile(path.join(ROOT, '.github/workflows/project-procurement-plan.yml'), 'utf8');
assert.match(workflow, /schedule:\s*\n\s*- cron:/, 'the advertised daily freshness monitor must have an automatic schedule');

console.log('project procurement plan: source hashes, exact gates, radius locality, alternative market/cost joins, quantity/article identity, approval provenance, dates, risks, roles, carbon, all-offer freshness and payload exclusion passed');
