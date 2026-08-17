import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import {pathToFileURL} from 'node:url';
import {assertDesignAssetRuntimeRecord, assertNoDesignAssetCommerce} from './lib/design-asset-truth.mjs';
import {loadTaxonomyResolver} from './lib/taxonomy-aliases.mjs';

const TOOL_DEFINITIONS = [
  {
    name: 'search_product_twins',
    description: 'Search exact or candidate Product Twins. Results may include identity, physical, geometry and procurement evidence. This tool never returns generic Design Assets.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {type: 'string'},
        category_id: {type: 'string'},
        geometry_level: {type: 'string', enum: ['G0', 'G1', 'G2', 'G3', 'G4', 'G5']},
        limit: {type: 'integer', minimum: 1, maximum: 100, default: 20},
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_product_twin',
    description: 'Return one Product Twin with its independent identity, geometry, appearance and procurement-readiness lanes.',
    inputSchema: {
      type: 'object',
      required: ['twin_id'],
      properties: {twin_id: {type: 'string'}},
      additionalProperties: false,
    },
  },
  {
    name: 'search_design_assets',
    description: 'Search rights-tracked generic Design Assets for room composition and fit. These records are not products and never contain SKU, offer, price, stock, supplier or checkout claims.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {type: 'string'},
        category_id: {type: 'string'},
        room_role: {type: 'string'},
        geometry_state: {type: 'string', enum: ['CANDIDATE_NOT_DOWNLOADED', 'DOWNLOADED_UNVERIFIED', 'G1_CONVERTED_VISUAL_QA_REQUIRED', 'G2_READY']},
        limit: {type: 'integer', minimum: 1, maximum: 100, default: 20},
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_design_asset',
    description: 'Return one generic Design Asset, its attribution, geometry state and replacement-match requirements. Commerce identity is intentionally unavailable.',
    inputSchema: {
      type: 'object',
      required: ['design_asset_id'],
      properties: {design_asset_id: {type: 'string'}},
      additionalProperties: false,
    },
  },
  {
    name: 'get_room_supply_coverage',
    description: 'Return transparent destination supply coverage for the current Room Lab design, including local/origin/lead-time evidence and unresolved fields.',
    inputSchema: {
      type: 'object',
      properties: {market: {type: 'string', enum: ['ES', 'SE', 'GB', 'US'], default: 'ES'}},
      additionalProperties: false,
    },
  },
];

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await fsp.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

function textMatch(value, query) {
  return !query || JSON.stringify(value).toLowerCase().includes(query.toLowerCase());
}

function limit(value) {
  return Math.max(1, Math.min(100, Number.isInteger(value) ? value : 20));
}

async function loadTwins(root) {
  const directory = path.join(root, 'data/twins');
  const files = (await fsp.readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  return Promise.all(files.map((name) => readJson(path.join(directory, name))));
}

async function loadProcurementCards(root) {
  const document = await readJson(path.join(root, 'data/procurement/living-room-furniture-twin-readiness-v0.1.json'), {cards: []});
  return new Map((document.cards ?? []).map((card) => [card.twin_id, card]));
}

async function loadDesignAssets(root) {
  const resolveCategory = await loadTaxonomyResolver(root);
  const pilot = await readJson(path.join(root, 'config/geometry/sweet-home-3d-design-asset-pilot-v0.1.json'), {candidates: []});
  const intake = await readJson(path.join(root, 'data/metrics/sweet-home-3d-design-asset-intake-latest.json'), {assets: []});
  const conversion = await readJson(path.join(root, 'data/metrics/sweet-home-3d-design-asset-conversion-latest.json'), {assets: []});
  const intakeById = new Map((intake.assets ?? []).map((asset) => [asset.design_asset_id, asset]));
  const conversionById = new Map((conversion.assets ?? []).map((asset) => [asset.design_asset_id, asset]));
  return (pilot.candidates ?? []).map((candidate) => {
    const intakeAsset = intakeById.get(candidate.design_asset_id);
    const converted = conversionById.get(candidate.design_asset_id);
    const geometryState = converted?.status === 'GLB_CONVERTED_DECLARED_ENVELOPE_APPLIED_VISUAL_QA_REQUIRED'
      ? 'G1_CONVERTED_VISUAL_QA_REQUIRED'
      : intakeAsset?.intake_state === 'DOWNLOADED_UNVERIFIED_CONVERSION_REQUIRED'
        ? 'DOWNLOADED_UNVERIFIED'
        : candidate.asset_state;
    const asset = {
      ...candidate,
      category_id: resolveCategory(candidate.category_id),
      geometry_state: geometryState,
      source_dimensions: intakeAsset?.source_dimensions ?? null,
      source_transform: intakeAsset?.source_transform ?? null,
      attribution: intakeAsset?.attribution ?? {
        creator: null,
        text: candidate.license?.attribution_text ?? null,
        license_id: candidate.license?.spdx_like ?? null,
        source_url: candidate.license?.source_reference ?? null,
        display_required: candidate.license?.attribution_required === true,
      },
      conversion: converted ? {
        status: converted.status,
        current_geometry_level: converted.current_geometry_level,
        maximum_after_visual_and_scale_qa: converted.maximum_after_visual_and_scale_qa,
        runtime_glb_path: converted.runtime_glb_path,
        envelope_normalization_error_max: converted.envelope_normalization_error_max,
        independent_scale_qa_passed: converted.independent_scale_qa_passed,
        materials: converted.materials,
        remaining_gates: converted.remaining_gates,
      } : null,
    };
    return assertDesignAssetRuntimeRecord(asset);
  });
}

export function listTools() {
  return TOOL_DEFINITIONS;
}

export async function callProductTwinTool(name, args = {}, {root = process.cwd()} = {}) {
  if (name === 'search_product_twins') {
    const [twins, procurement, resolveCategory] = await Promise.all([loadTwins(root), loadProcurementCards(root), loadTaxonomyResolver(root)]);
    const requestedCategory = args.category_id ? resolveCategory(args.category_id) : null;
    return twins.filter((twin) =>
      (!requestedCategory || resolveCategory(twin.category_id) === requestedCategory)
      && (!args.geometry_level || twin.geometry?.level === args.geometry_level)
      && textMatch(twin, args.query)
    ).slice(0, limit(args.limit)).map((twin) => {
      const card = procurement.get(twin.twin_id);
      return {
        record_lane: 'PRODUCT_TWIN',
        twin_id: twin.twin_id,
        category_id: resolveCategory(twin.category_id),
        source_category_id: resolveCategory(twin.category_id) === twin.category_id ? undefined : twin.category_id,
        identity: twin.identity,
        dimensions_mm: twin.physical?.dimensions_mm ?? null,
        geometry: twin.geometry ? {level: twin.geometry.level, state: twin.geometry.state, asset_path: twin.geometry.asset_path, appearance: twin.geometry.appearance ?? null} : null,
        procurement: card ? {headline: card.headline, procurement_ready: card.procurement_ready, blockers: card.blockers} : null,
      };
    });
  }
  if (name === 'get_product_twin') {
    const twins = await loadTwins(root);
    const twin = twins.find((item) => item.twin_id === args.twin_id);
    if (!twin) throw new Error(`Product Twin not found: ${args.twin_id}`);
    const procurement = await loadProcurementCards(root);
    return {record_lane: 'PRODUCT_TWIN', twin, procurement_readiness: procurement.get(twin.twin_id) ?? null};
  }
  if (name === 'search_design_assets') {
    const assets = await loadDesignAssets(root);
    const response = assets.filter((asset) =>
      (!args.category_id || asset.category_id === args.category_id)
      && (!args.room_role || asset.room_roles?.includes(args.room_role))
      && (!args.geometry_state || asset.geometry_state === args.geometry_state)
      && textMatch(asset, args.query)
    ).slice(0, limit(args.limit)).map((asset) => assertDesignAssetRuntimeRecord({record_lane: 'DESIGN_ASSET', ...asset}, `search_design_assets.${asset.design_asset_id}`));
    return assertNoDesignAssetCommerce(response, 'search_design_assets.response');
  }
  if (name === 'get_design_asset') {
    const assets = await loadDesignAssets(root);
    const asset = assets.find((item) => item.design_asset_id === args.design_asset_id);
    if (!asset) throw new Error(`Design Asset not found: ${args.design_asset_id}`);
    const response = {
      record_lane: 'DESIGN_ASSET',
      asset,
      replacement_search_guidance: {
        state: 'SEPARATE_PRODUCT_TWIN_SEARCH_REQUIRED',
        recommended_tool: 'search_product_twins',
        reason: 'This generic geometry has no purchasable identity. Resolve a Product Twin independently before evaluating supply.',
      },
    };
    return assertNoDesignAssetCommerce(response, 'get_design_asset.response');
  }
  if (name === 'get_room_supply_coverage') {
    const market = args.market ?? 'ES';
    const coverage = await readJson(path.join(root, 'data/procurement/living-room-design-supply-coverage-v0.1.json'));
    if (!coverage) throw new Error('Room supply coverage is unavailable');
    if (market !== coverage.current_design_coverage?.country) {
      return {
        market,
        state: 'BENCHMARK_NOT_YET_LIVE',
        supported_benchmark_markets: ['ES', 'SE', 'GB', 'US'],
        current_live_market: coverage.current_design_coverage?.country ?? null,
        next_action: 'Run the same destination offer and logistics evidence contract for this market.',
      };
    }
    return {market, state: 'LIVE_EVIDENCE_AVAILABLE', design: coverage.design, coverage: coverage.current_design_coverage};
  }
  throw new Error(`Unknown Product Twin MCP tool: ${name}`);
}

export async function handleMcpRequest(request, options = {}) {
  if (request.method === 'initialize') return {
    protocolVersion: request.params?.protocolVersion ?? '2025-06-18',
    capabilities: {tools: {listChanged: false}},
    serverInfo: {name: 'product-twin-mcp', version: '0.1.0'},
    instructions: 'Product Twins and generic Design Assets are separate evidence lanes. Use search_product_twins for procurable identities and search_design_assets only for generic room composition.',
  };
  if (request.method === 'ping') return {};
  if (request.method === 'tools/list') return {tools: listTools()};
  if (request.method === 'tools/call') {
    const result = await callProductTwinTool(request.params?.name, request.params?.arguments ?? {}, options);
    const response = {content: [{type: 'text', text: JSON.stringify(result, null, 2)}], structuredContent: {result}};
    if (['search_design_assets', 'get_design_asset'].includes(request.params?.name)) assertNoDesignAssetCommerce(response, `${request.params.name}.mcp_response`);
    return response;
  }
  if (request.method?.startsWith('notifications/')) return null;
  throw new Error(`Unsupported MCP method: ${request.method}`);
}

async function start() {
  const input = readline.createInterface({input: process.stdin, crlfDelay: Infinity});
  for await (const line of input) {
    if (!line.trim()) continue;
    let request;
    try {
      request = JSON.parse(line);
      const result = await handleMcpRequest(request);
      if (request.id === undefined || result === null) continue;
      process.stdout.write(`${JSON.stringify({jsonrpc: '2.0', id: request.id, result})}\n`);
    } catch (error) {
      if (request?.id === undefined) continue;
      process.stdout.write(`${JSON.stringify({jsonrpc: '2.0', id: request.id, error: {code: -32000, message: error.message}})}\n`);
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await start();
