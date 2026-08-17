import assert from 'node:assert/strict';
import {classifyPlacement, evaluateDesignSupplyCoverage} from './evaluate-design-supply-coverage.mjs';

const contract = {
  contract_id: 'TEST',
  client_panels: {
    outcome: [
      'LOCAL_MARKET_CONFIRMED',
      'NON_LOCAL_UP_TO_10_DAYS_CONFIRMED',
      'NON_LOCAL_11_TO_30_DAYS_CONFIRMED',
      'NON_LOCAL_OVER_30_DAYS_CONFIRMED',
      'DESTINATION_CONFIRMED_ORIGIN_OR_LEAD_UNKNOWN',
      'DESTINATION_UNAVAILABLE_CONFIRMED',
      'ROUTE_REFRESH_REQUIRED',
      'UNRESOLVED'
    ],
    supplier_geography: ['LOCAL_SELLER_OR_DISPATCH_CONFIRMED', 'NON_LOCAL_ORIGIN_CONFIRMED', 'ORIGIN_UNRESOLVED'],
    delivery_timeline: ['UP_TO_10_DAYS_CONFIRMED', '11_TO_30_DAYS_CONFIRMED', 'OVER_30_DAYS_CONFIRMED', 'DESTINATION_UNAVAILABLE_CONFIRMED', 'DELIVERY_UNCONFIRMED']
  },
  substitution_rules: {principle: 'test', automatic_swap_allowed: false}
};

const destination = {country: 'ES', postal_code: '29660'};
const design = {
  design_id: 'D', project_id: 'P', space_id: 'S', name: 'Coverage arithmetic fixture', destination,
  placements: [
    {placement_id: 'LOCAL', role: 'sofa', twin_id: 'T1', avatar_id: 'A1', selected_configuration: 'C1', quantity: 90, offer_ref: 'O1'},
    {placement_id: 'FAST', role: 'chair', twin_id: 'T2', avatar_id: 'A2', selected_configuration: 'C2', quantity: 5, offer_ref: 'O2'},
    {placement_id: 'MONTH', role: 'table', twin_id: 'T3', avatar_id: 'A3', selected_configuration: 'C3', quantity: 3, offer_ref: 'O3'},
    {placement_id: 'MISSING', role: 'lamp', twin_id: 'T4', avatar_id: 'A4', selected_configuration: 'C4', quantity: 2, offer_ref: null}
  ]
};

const delivery = (min, max) => ({country: 'ES', postal_code: '29660', exact_destination_confirmed: true, lead_time_days_min: min, lead_time_days_max: max});
const evidence = {
  offers: [
    {offer_ref: 'O1', seller_country: 'ES', dispatch_country: 'ES', retailer_territory_country: 'ES', delivery: delivery(2, 5), price: {amount: '100', currency: 'EUR'}, stock_state: 'CURRENT', observed_at: '2026-08-17', live_refresh_required: false},
    {offer_ref: 'O2', seller_country: 'DE', dispatch_country: 'DE', retailer_territory_country: 'ES', delivery: delivery(7, 10), price: {amount: '100', currency: 'EUR'}, stock_state: 'CURRENT', observed_at: '2026-08-17', live_refresh_required: false},
    {offer_ref: 'O3', seller_country: 'IT', dispatch_country: 'IT', retailer_territory_country: 'ES', delivery: delivery(21, 30), price: {amount: '100', currency: 'EUR'}, stock_state: 'CURRENT', observed_at: '2026-08-17', live_refresh_required: false},
    {offer_ref: 'O5', seller_country: null, dispatch_country: null, retailer_territory_country: 'ES', delivery: delivery(4, 7), price: {amount: '150', currency: 'EUR'}, stock_state: 'CURRENT', observed_at: '2026-08-17', live_refresh_required: false}
  ],
  substitution_candidates: [{
    substitution_id: 'S1', source_placement_id: 'MISSING', source_twin_id: 'T4', alternative_twin_id: 'T5', role_match: 'PASS',
    dimension_and_circulation_fit: 'PASS', technical_compatibility: 'PASS', colour_finish_material_match: 'PASS',
    client_design_approval: 'REQUIRED', destination_offer_state: 'CONFIRMED', alternative_offer_ref: 'O5',
    alternative_avatar_id: 'A5', alternative_configuration: 'C5'
  }]
};

const marketConfig = {markets: [{country: 'ES', name: 'Spain', currency: 'EUR'}, {country: 'SE', name: 'Sweden', currency: 'SEK'}]};
const report = evaluateDesignSupplyCoverage({contract, marketConfig, design, evidence});
const unitBuckets = Object.fromEntries(report.current_design_coverage.coverage.by_unit_quantity.outcome.buckets.map((row) => [row.bucket, row.percentage]));

assert.equal(unitBuckets.LOCAL_MARKET_CONFIRMED, 90);
assert.equal(unitBuckets.NON_LOCAL_UP_TO_10_DAYS_CONFIRMED, 5);
assert.equal(unitBuckets.NON_LOCAL_11_TO_30_DAYS_CONFIRMED, 3);
assert.equal(unitBuckets.UNRESOLVED, 2, 'the missing two percent must stay explicit');
assert.equal(Object.values(unitBuckets).reduce((sum, value) => sum + value, 0), 100);
assert.equal(report.substitutions.confirmed_alternative_coverage_percentage_by_line_item, 0, 'client approval cannot be bypassed');
assert.equal(report.substitutions.conditional_scenarios[0].scenario_state, 'CONDITIONAL_NOT_APPROVED');
assert.equal(report.substitutions.conditional_scenarios[0].conditional_headline.confirmed_deliverable_percentage_by_units, 100, 'what-if coverage can be calculated without mutating current coverage');
assert.equal(report.substitutions.conditional_scenarios[0].confirmed_deliverable_lift_percentage_points, 2);
assert.equal(report.current_design_coverage.headline.confirmed_deliverable_percentage_by_units, 98, 'the conditional scenario must not alter current coverage');
assert.equal(report.benchmark_markets.find((market) => market.country === 'SE').headline.unresolved_or_incomplete_percentage_by_units, 100);

const unavailable = classifyPlacement({
  placement: {placement_id: 'U', role: 'table', twin_id: 'TU', avatar_id: 'AU', selected_configuration: 'CU', quantity: 1, offer_ref: 'OU'},
  offer: {offer_ref: 'OU', retailer_territory_country: 'ES', delivery: {country: 'ES', postal_code: '29660', exact_destination_confirmed: false, destination_state: 'UNAVAILABLE'}},
  destination
});
assert.equal(unavailable.outcome, 'DESTINATION_UNAVAILABLE_CONFIRMED');
assert.equal(unavailable.delivery_timeline, 'DESTINATION_UNAVAILABLE_CONFIRMED');

console.log('design supply coverage: 90/5/3/2 arithmetic, explicit unavailable state, substitution gate and multi-market isolation passed');
