import assert from 'node:assert/strict';
import {callProductTwinTool, handleMcpRequest, listTools} from './product-twin-mcp-server.mjs';

assert.deepEqual(listTools().map((tool) => tool.name), [
  'search_product_twins',
  'get_product_twin',
  'search_design_assets',
  'get_design_asset',
  'get_room_supply_coverage',
]);

const initialized = await handleMcpRequest({method: 'initialize', params: {protocolVersion: '2025-06-18'}});
assert.equal(initialized.serverInfo.name, 'product-twin-mcp');
assert.match(initialized.instructions, /separate evidence lanes/i);

const products = await callProductTwinTool('search_product_twins', {query: 'KIVIK', geometry_level: 'G2'});
assert.equal(products.length, 1);
assert.equal(products[0].record_lane, 'PRODUCT_TWIN');
assert.equal(products[0].twin_id, 'PT_IKEA_KIVIK_49440597');
assert.deepEqual(products[0].dimensions_mm, {width: 2280, depth: 950, height: 830});

const designAssets = await callProductTwinTool('search_design_assets', {category_id: 'FFE.SEATING.SOFA'});
assert.equal(designAssets.length, 1);
assert.equal(designAssets[0].record_lane, 'DESIGN_ASSET');
assert.equal(designAssets[0].not_a_product_twin, true);
assert.equal(designAssets[0].geometry_state, 'CANDIDATE_NOT_DOWNLOADED');
const designText = JSON.stringify(designAssets[0]);
for (const forbidden of ['"sku"', '"gtin"', '"price"', '"stock"', '"offer"', '"supplier"', '"twin_id"']) assert.equal(designText.includes(forbidden), false);

const designAsset = await callProductTwinTool('get_design_asset', {design_asset_id: 'DA_SH3D_KL_MID_CENTURY_SOFA'});
assert.equal(designAsset.procurement.state, 'NOT_APPLICABLE');
assert.match(designAsset.procurement.next_action, /Product Twins/);

const spain = await callProductTwinTool('get_room_supply_coverage', {market: 'ES'});
assert.equal(spain.state, 'LIVE_EVIDENCE_AVAILABLE');
assert.equal(spain.coverage.headline.confirmed_deliverable_percentage_by_units, 87.5);
const sweden = await callProductTwinTool('get_room_supply_coverage', {market: 'SE'});
assert.equal(sweden.state, 'BENCHMARK_NOT_YET_LIVE');

const toolsCall = await handleMcpRequest({method: 'tools/call', params: {name: 'search_design_assets', arguments: {query: 'sofa'}}});
assert.equal(toolsCall.structuredContent.result[0].record_lane, 'DESIGN_ASSET');

console.log(JSON.stringify({status: 'PASS', checks: 27, tools: listTools().length, evidence_lanes: ['PRODUCT_TWIN', 'DESIGN_ASSET']}, null, 2));
