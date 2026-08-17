import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
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
const normalizedArmchairs = await callProductTwinTool('search_product_twins', {category_id: 'FFE.SEATING.LOUNGE'});
assert.ok(normalizedArmchairs.some((item) => item.source_category_id === 'FFE.SEATING.ARMCHAIR' && item.category_id === 'FFE.SEATING.LOUNGE'));

const designAssets = await callProductTwinTool('search_design_assets', {category_id: 'FFE.SEATING.SOFA'});
assert.equal(designAssets.length, 1);
assert.equal(designAssets[0].record_lane, 'DESIGN_ASSET');
assert.equal(designAssets[0].not_a_product_twin, true);
assert.ok(['CANDIDATE_NOT_DOWNLOADED', 'G1_CONVERTED_VISUAL_QA_REQUIRED'].includes(designAssets[0].geometry_state));
assert.equal(designAssets[0].attribution.display_required, true);
const designText = JSON.stringify(designAssets[0]);
for (const forbidden of ['"sku"', '"gtin"', '"price"', '"stock"', '"offer"', '"supplier"', '"twin_id"']) assert.equal(designText.includes(forbidden), false);

const designAsset = await callProductTwinTool('get_design_asset', {design_asset_id: 'DA_SH3D_KL_MID_CENTURY_SOFA'});
assert.equal('procurement' in designAsset, false);
assert.equal(designAsset.replacement_search_guidance.state, 'SEPARATE_PRODUCT_TWIN_SEARCH_REQUIRED');
assert.equal(designAsset.replacement_search_guidance.recommended_tool, 'search_product_twins');

const spain = await callProductTwinTool('get_room_supply_coverage', {market: 'ES'});
assert.equal(spain.state, 'LIVE_EVIDENCE_AVAILABLE');
assert.equal(spain.coverage.headline.confirmed_deliverable_percentage_by_units, 87.5);
const sweden = await callProductTwinTool('get_room_supply_coverage', {market: 'SE'});
assert.equal(sweden.state, 'BENCHMARK_NOT_YET_LIVE');

const toolsCall = await handleMcpRequest({method: 'tools/call', params: {name: 'search_design_assets', arguments: {query: 'sofa'}}});
assert.equal(toolsCall.structuredContent.result[0].record_lane, 'DESIGN_ASSET');
assert.equal(JSON.stringify(toolsCall).includes('"procurement"'), false);

const getToolsCall = await handleMcpRequest({method: 'tools/call', params: {name: 'get_design_asset', arguments: {design_asset_id: 'DA_SH3D_KL_MID_CENTURY_SOFA'}}});
assert.equal(getToolsCall.structuredContent.result.replacement_search_guidance.recommended_tool, 'search_product_twins');
assert.equal(JSON.stringify(getToolsCall).includes('"procurement"'), false);

const poisonRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'design-asset-mcp-poison-'));
try {
  await fsp.mkdir(path.join(poisonRoot, 'config/geometry'), {recursive: true});
  await fsp.mkdir(path.join(poisonRoot, 'data/metrics'), {recursive: true});
  await Promise.all([
    fsp.copyFile('config/taxonomy.json', path.join(poisonRoot, 'config/taxonomy.json')),
    fsp.copyFile('config/taxonomy-aliases.json', path.join(poisonRoot, 'config/taxonomy-aliases.json')),
  ]);
  const poisonedPilot = JSON.parse(await fsp.readFile('config/geometry/sweet-home-3d-design-asset-pilot-v0.1.json', 'utf8'));
  poisonedPilot.candidates[0].style_tags.push({msrp: 299, vendor: 'Injected'});
  await fsp.writeFile(path.join(poisonRoot, 'config/geometry/sweet-home-3d-design-asset-pilot-v0.1.json'), JSON.stringify(poisonedPilot));
  await fsp.writeFile(path.join(poisonRoot, 'data/metrics/sweet-home-3d-design-asset-intake-latest.json'), '{"assets":[]}');
  await fsp.writeFile(path.join(poisonRoot, 'data/metrics/sweet-home-3d-design-asset-conversion-latest.json'), '{"assets":[]}');
  const poisonSearch = {method: 'tools/call', params: {name: 'search_design_assets', arguments: {query: 'sofa'}}};
  const poisonGet = {method: 'tools/call', params: {name: 'get_design_asset', arguments: {design_asset_id: 'DA_SH3D_KL_MID_CENTURY_SOFA'}}};
  await assert.rejects(() => handleMcpRequest(poisonSearch, {root: poisonRoot}), /msrp|vendor|array of strings only|forbidden/);
  await assert.rejects(() => handleMcpRequest(poisonGet, {root: poisonRoot}), /msrp|vendor|array of strings only|forbidden/);
} finally {
  await fsp.rm(poisonRoot, {recursive: true, force: true});
}

console.log(JSON.stringify({status: 'PASS', checks: 34, tools: listTools().length, evidence_lanes: ['PRODUCT_TWIN', 'DESIGN_ASSET'], poison_mutations: 2}, null, 2));
