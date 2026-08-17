import assert from 'node:assert/strict';
import {assertDesignAssetRuntimeRecord, assertGenericDesignAsset, assertNoDesignAssetCommerce, findForbiddenDesignAssetFields} from './lib/design-asset-truth.mjs';

const generic = {identity_scope: 'GENERIC_DESIGN_ASSET', not_a_product_twin: true, attribution: {creator: 'Fixture'}};
const runtimeGeneric = {
  design_asset_id: 'DA_FIXTURE',
  source_id: 'fixture',
  source_model_name: 'Fixture chair',
  identity_scope: 'GENERIC_DESIGN_ASSET',
  category_id: 'FFE.SEATING.LOUNGE',
  style_tags: ['fixture'],
  room_roles: ['test-chair'],
  asset_state: 'CANDIDATE_NOT_DOWNLOADED',
  dimensions_state: 'UNVERIFIED_LIBRARY_METADATA',
  license: {spdx_like: 'CC-BY-3.0', attribution_required: true, attribution_text: 'Fixture attribution', source_reference: 'https://example.com'},
  target_geometry_level: 'G2',
  not_a_product_twin: true,
  replacement_search_required: true,
  replacement_benchmarks: ['ES', 'SE', 'GB', 'US'],
  geometry_state: 'CANDIDATE_NOT_DOWNLOADED',
  source_dimensions: null,
  source_transform: null,
  attribution: {creator: 'Fixture Creator', text: 'Fixture attribution', license_id: 'CC-BY-3.0', source_url: 'https://example.com', display_required: true},
  conversion: null,
};
assert.equal(assertGenericDesignAsset(generic), generic);
assert.deepEqual(findForbiddenDesignAssetFields({...generic, nested: {commerce: {price: 10}}}), ['design_asset.nested.commerce', 'design_asset.nested.commerce.price']);
assert.throws(() => assertGenericDesignAsset({...generic, procurement: {supplier: 'Never inherit'}}), /forbidden/);
assert.throws(() => assertGenericDesignAsset({...generic, merchant_variant_gid: 'gid:\/\/shopify\/ProductVariant\/1'}), /forbidden/);
for (const mutation of [
  {unit_price_eur: 299},
  {availability_stock: 4},
  {destination_supplier_name: 'Bypass Supplier'},
  {unitPriceEUR: 299},
  {unitpriceeur: 299},
  {msrp: 299},
  {msrpeur: 299},
  {rrp: 299},
  {vendor: 'Injected'},
  {vendornamecompact: 'Injected'},
  {qty: 4},
  {quantity: 4},
  {amount: 299},
  {cost: 250},
  {rate: 1.2},
  {leadTimeDays: 7},
  {nested: {landed_cost_eur: 350}},
]) assert.throws(() => assertGenericDesignAsset({...generic, ...mutation}), /forbidden/);
assert.throws(() => assertDesignAssetRuntimeRecord({...runtimeGeneric, custom_note: 'innocent but outside schema'}), /strict Design Asset runtime allowlist/);
assert.throws(() => assertDesignAssetRuntimeRecord({...runtimeGeneric, attribution: {...runtimeGeneric.attribution, unit_value_eur: 299}}), /strict Design Asset runtime allowlist/);
assert.throws(() => assertDesignAssetRuntimeRecord({...runtimeGeneric, style_tags: ['fixture', {label: 'poison'}]}), /array of strings only/);
assert.throws(() => assertDesignAssetRuntimeRecord({...runtimeGeneric, replacement_benchmarks: ['ES', 5]}), /array of strings only/);
assert.throws(() => assertDesignAssetRuntimeRecord({...runtimeGeneric, source_dimensions: {width_cm: '60'}}), /strict Design Asset runtime allowlist|required fields missing/);
assert.equal(assertDesignAssetRuntimeRecord(runtimeGeneric), runtimeGeneric);
assert.throws(() => assertNoDesignAssetCommerce({result: {asset: {...generic, unit_price_eur: 10}}}), /forbidden/);
assert.throws(() => assertGenericDesignAsset({not_a_product_twin: true}), /identity_scope/);
console.log(JSON.stringify({status: 'PASS', lane: 'GENERIC_DESIGN_ASSET', commerce_inheritance: 'BLOCKED'}));
