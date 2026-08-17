import assert from 'node:assert/strict';
import {evaluateProductTwin} from './evaluate-product-twin-readiness.mjs';

const contract = {project_destination: {project_id: 'P', country: 'ES', postal_code: '29660', construction_phase: 'ffe'}};
const kit = {candidate_id: 'C', identity: {vendor: 'Brand', product_title: 'Sofa'}, photo_input_band: 'STRONG_P2_MULTI_VIEW_INPUT', route: 'MULTI_IMAGE_AI_TO_G2_CANDIDATE', queue_state: 'NOT_QUEUED_RECONSTRUCTION_RIGHTS_REVIEW', presentation: {public_presentation_allowed: false}};
const twin = {
  twin_id: 'PT_SOFA',
  identity: {state: 'exact_merchant_variant_and_manufacturer_product_family_verified_visible_finish_incomplete', manufacturer: 'Brand', model: 'Sofa', merchant_sku: 'SOFA-1', configuration: 'Cat 2', configuration_limit: 'Exact fabric missing'},
  physical: {expected_manufacturer_dimensions_mm: [1000, 800, 700]},
  geometry: {level: 'G2', rights: {state: 'review'}},
  readiness: {dimensions: 'verified'}
};
const commerce = {merchant_product_gid: 'P1', merchant_variant_gid: 'V1', sku: 'SOFA-1', available_for_sale: true, price: {amount: '1000', currency: 'EUR'}, destination_country: 'ES', destination_postal_code: null, catalog_filter_passed: true, exact_postcode_checkout_verified: false, observed_at: '2026-08-17T00:00:00Z'};

const result = evaluateProductTwin({contract, kit, twin, commerceEvidence: commerce, merchant: {seller_id: 'merchant', seller_name: 'Merchant', seller_country: null, dispatch_country: null}});
assert.equal(result.headline.Spain_supply_state, 'SPAIN_COUNTRY_CATALOG_CANDIDATE');
assert.equal(result.headline.Spanish_supplier_state, 'NOT_PROVEN');
assert.equal(result.procurement_ready, false);
assert.equal(result.lanes.logistics_and_landed_cost.state, 'UNKNOWN');
assert.equal(result.offer_snapshot.shipping_disclosure, 'unknown_until_checkout_or_quote');
assert.ok(result.blockers.includes('Spanish supplier or Spanish dispatch origin is not proven'));
assert.equal('global_confidence_score' in result, false);
console.log(JSON.stringify({status: 'PASS', scenarios: 1, lanes: Object.keys(result.lanes).length}, null, 2));
