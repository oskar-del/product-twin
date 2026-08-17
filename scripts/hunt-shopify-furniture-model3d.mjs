import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const CATALOG = 'https://catalog.shopify.com/api/ucp/mcp';
const PROFILE = 'https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json';
const CONFIG_PATH = path.join(ROOT, 'config/geometry/shopify-furniture-model3d-hunt.json');
const config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8'));
const generatedAt = new Date().toISOString();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function catalogSearch(query, attempt = 1) {
  const response = await fetch(CATALOG, {
    method: 'POST',
    headers: {'content-type':'application/json','user-agent':'product-twin-shopify-model3d-furniture-hunt/0.1'},
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'tools/call',
      params: {
        name: 'search_catalog',
        arguments: {
          meta: {'ucp-agent': {profile: PROFILE}},
          catalog: {
            query,
            filters: {ships_to: {country: config.destination.country, postal_code: config.destination.postal_code}, available: true},
            context: {
              address_country: config.destination.country,
              postal_code: config.destination.postal_code,
              currency: config.destination.currency,
              intent: 'Find residential furniture with merchant-hosted native 3D media for an exact Product Twin room'
            },
            pagination: {limit: Math.min(50, config.search_limit_per_query ?? 50)}
          }
        }
      }
    })
  });
  const text = await response.text();
  if (!response.ok) {
    if (attempt < 5 && [429,500,502,503,504].includes(response.status)) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(30000, 1200 * attempt * attempt);
      console.log(`Shopify catalog ${response.status}; retry ${attempt}/4 in ${wait}ms`);
      await sleep(wait);
      return catalogSearch(query, attempt + 1);
    }
    throw new Error(`search_catalog ${response.status}: ${text.slice(0,600)}`);
  }
  const json = JSON.parse(text);
  if (json.error) throw new Error(JSON.stringify(json.error));
  return json.result?.structuredContent ?? json.result;
}

function merchantOrigin(variant) {
  for (const raw of [variant?.checkout_url, variant?.seller?.url, variant?.url]) {
    try { return new URL(raw).origin; } catch {}
  }
  const domain = variant?.seller?.domain;
  return domain ? `https://${domain}` : null;
}

function chooseVariant(product) {
  const variants = (product?.variants ?? []).filter((variant) => variant?.id && variant?.availability?.available !== false);
  return variants.find((variant) => variant?.seller?.domain && merchantOrigin(variant)) ?? variants.find(merchantOrigin) ?? null;
}

const storefrontQuery = `query ProductTwinModel3dCandidate($id: ID!) {
  node(id: $id) {
    ... on ProductVariant {
      id
      title
      sku
      barcode
      availableForSale
      selectedOptions { name value }
      price { amount currencyCode }
      product {
        id
        title
        vendor
        handle
        productType
        variants(first: 100) { nodes { id title sku barcode availableForSale selectedOptions { name value } } }
        media(first: 50) {
          nodes {
            mediaContentType
            ... on Model3d { id sources { format mimeType filesize url } }
          }
        }
      }
    }
  }
}`;

async function probeStorefront(origin, variantId) {
  const endpoint = `${origin}/api/${config.storefront_api_version}/graphql.json`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {'content-type':'application/json','user-agent':'product-twin-shopify-model3d-furniture-hunt/0.1'},
    body: JSON.stringify({query: storefrontQuery, variables: {id: variantId}})
  });
  const text = await response.text();
  if (!response.ok) return {ok:false,http_status:response.status,error:text.slice(0,240)};
  let json;
  try { json = JSON.parse(text); } catch { return {ok:false,http_status:response.status,error:'non_json_response'}; }
  if (json.errors?.length) return {ok:false,http_status:response.status,error:json.errors.map((item) => item.message).join(' | ').slice(0,400)};
  const variant = json.data?.node ?? null;
  const product = variant?.product ?? null;
  const models = (product?.media?.nodes ?? []).filter((media) => media?.mediaContentType === 'MODEL_3D');
  return {ok:true,variant,product,models};
}

function optionsObject(options) {
  return Object.fromEntries((options ?? []).map((option) => [option.name, option.value]));
}

function candidateScore(candidate) {
  let score = 50;
  if (candidate.variant_binding_state === 'SINGLE_VARIANT_PRODUCT_STRONG_BINDING') score += 20;
  if (candidate.identity.sku) score += 8;
  if (candidate.identity.barcode) score += 10;
  if (candidate.identity.vendor) score += 5;
  if (candidate.commerce.price_currency === config.destination.currency) score += 3;
  if (candidate.commerce.available_for_sale) score += 4;
  return Math.min(100, score);
}

const discovered = new Map();
const categorySearchStats = [];
for (const category of config.categories) {
  let returned = 0;
  for (const query of category.queries) {
    console.log(`Shopify 3D-first search: ${category.category_id} :: ${query}`);
    const result = await catalogSearch(query);
    const products = result?.products ?? [];
    returned += products.length;
    for (const product of products) {
      const variant = chooseVariant(product);
      const origin = merchantOrigin(variant);
      if (!variant?.id || !origin) continue;
      const key = `${origin}|${variant.id}`;
      const previous = discovered.get(key);
      const hint = {category_id:category.category_id,room_role:category.room_role,query};
      if (previous) previous.hints.push(hint);
      else discovered.set(key, {origin, variant_id:variant.id, catalog_product_id:product.id??null, hints:[hint]});
    }
    await sleep(250);
  }
  categorySearchStats.push({category_id:category.category_id,queries:category.queries.length,products_returned:returned});
}

const maximumProbes = config.maximum_storefront_probes ?? 180;
const categoryBuckets = new Map(config.categories.map((category) => [category.category_id, []]));
for (const item of discovered.values()) {
  for (const categoryId of new Set(item.hints.map((hint) => hint.category_id))) categoryBuckets.get(categoryId)?.push(item);
}
const queue = [];
const queuedKeys = new Set();
let addedInRound = true;
while (queue.length < maximumProbes && addedInRound) {
  addedInRound = false;
  for (const category of config.categories) {
    const bucket = categoryBuckets.get(category.category_id) ?? [];
    while (bucket.length) {
      const item = bucket.shift();
      const key = `${item.origin}|${item.variant_id}`;
      if (queuedKeys.has(key)) continue;
      queuedKeys.add(key);
      queue.push(item);
      addedInRound = true;
      break;
    }
    if (queue.length >= maximumProbes) break;
  }
}
const probeFailures = [];
const candidates = [];
async function processProbe(item, probeNumber) {
  console.log(`Storefront Model3d probe ${probeNumber}/${queue.length}: ${new URL(item.origin).hostname}`);
  let result;
  try { result = await probeStorefront(item.origin, item.variant_id); }
  catch (error) { result = {ok:false,error:String(error?.message??error)}; }
  if (!result.ok) {
    probeFailures.push({merchant_origin:item.origin,status:'STOREFRONT_PROBE_FAILED',error:result.error??null});
    return;
  }
  if (!result.models.length) return;
  const merchantVariants = result.product?.variants?.nodes ?? [];
  const variantBindingState = merchantVariants.length === 1 ? 'SINGLE_VARIANT_PRODUCT_STRONG_BINDING' : 'PRODUCT_LEVEL_MODEL_VARIANT_MATERIAL_BINDING_UNRESOLVED';
  for (const model of result.models) {
    const hint = item.hints[0];
    const candidate = {
      candidate_id: `SHOPIFY_FURNITURE_MODEL3D_${crypto.createHash('sha1').update(`${item.origin}|${model.id}|${item.variant_id}`).digest('hex').slice(0,16)}`,
      category_id: hint.category_id,
      room_role: hint.room_role,
      source_id: 'shopify_merchant_storefront',
      merchant_origin: item.origin,
      identity: {
        merchant_product_gid: result.product?.id??null,
        merchant_variant_gid: result.variant?.id??item.variant_id,
        merchant_model3d_gid: model.id,
        product_title: result.product?.title??null,
        vendor: result.product?.vendor??null,
        handle: result.product?.handle??null,
        product_type: result.product?.productType??null,
        variant_title: result.variant?.title??null,
        sku: result.variant?.sku??null,
        barcode: result.variant?.barcode??null,
        selected_options: optionsObject(result.variant?.selectedOptions)
      },
      geometry: {
        media_type: 'MODEL_3D',
        formats: [...new Set((model.sources??[]).map((source) => source.format).filter(Boolean))],
        source_count: (model.sources??[]).length,
        asset_urls_persisted: false,
        scale_state: 'UNVERIFIED_LIVE_ASSET_INSPECTION_REQUIRED',
        rights_state: 'REVIEW',
        promotion_state: 'G3_CANDIDATE_NOT_PROMOTED'
      },
      commerce: {
        available_for_sale: result.variant?.availableForSale === true,
        price_amount: result.variant?.price?.amount??null,
        price_currency: result.variant?.price?.currencyCode??null,
        destination_country: config.destination.country,
        destination_postal_code: config.destination.postal_code,
        catalog_delivery_filter_passed: true,
        checkout_refresh_required: true
      },
      merchant_variant_count: merchantVariants.length,
      variant_binding_state: variantBindingState,
      discovery_queries: [...new Set(item.hints.map((entry) => entry.query))],
      observed_at: generatedAt,
      policy: 'Stable merchant identity and dated commerce observation only. Model source URLs are resolved live and not persisted.'
    };
    candidate.rank_score = candidateScore(candidate);
    candidates.push(candidate);
  }
}
const probeConcurrency = Math.max(1,Math.min(12,Number(config.probe_concurrency??8)));
for (let index=0;index<queue.length;index+=probeConcurrency) {
  const batch=queue.slice(index,index+probeConcurrency);
  await Promise.all(batch.map((item,offset)=>processProbe(item,index+offset+1)));
  if (index+probeConcurrency<queue.length) await sleep(config.probe_delay_ms??120);
}

const dedupedCandidates = [...new Map(candidates.map((candidate) => [candidate.candidate_id,candidate])).values()]
  .sort((a,b) => b.rank_score - a.rank_score || a.identity.product_title.localeCompare(b.identity.product_title));
const byCategory = config.categories.map((category) => {
  const rows = dedupedCandidates.filter((candidate) => candidate.category_id === category.category_id);
  return {
    category_id: category.category_id,
    room_role: category.room_role,
    target_count: category.target_count,
    model3d_candidates: rows.length,
    single_variant_strong_binding: rows.filter((candidate) => candidate.variant_binding_state === 'SINGLE_VARIANT_PRODUCT_STRONG_BINDING').length,
    top_candidate_ids: rows.slice(0,Math.max(3,category.target_count)).map((candidate) => candidate.candidate_id)
  };
});
const summary = {
  generated_at: generatedAt,
  destination: config.destination,
  catalog_queries: config.categories.reduce((sum,category) => sum + category.queries.length,0),
  unique_merchant_variants_discovered: discovered.size,
  storefront_probes_attempted: queue.length,
  storefront_probe_failures: probeFailures.length,
  model3d_candidates: dedupedCandidates.length,
  single_variant_strong_binding: dedupedCandidates.filter((candidate) => candidate.variant_binding_state === 'SINGLE_VARIANT_PRODUCT_STRONG_BINDING').length,
  categories_with_model3d: byCategory.filter((category) => category.model3d_candidates > 0).length,
  complete_room_role_coverage: byCategory.every((category) => category.model3d_candidates >= category.target_count),
  policy: 'No Shopify catalog payload or Model3d source URL persisted; only stable merchant references, identity evidence and dated minimal commerce observations.'
};

await fs.mkdir(path.join(ROOT,'data/identity'),{recursive:true});
await fs.mkdir(path.join(ROOT,'data/geometry'),{recursive:true});
await fs.mkdir(path.join(ROOT,'data/metrics'),{recursive:true});
await fs.writeFile(path.join(ROOT,'data/identity/shopify-furniture-model3d-candidates.json'),JSON.stringify({version:'0.1',summary,candidates:dedupedCandidates},null,2)+'\n');
await fs.writeFile(path.join(ROOT,'data/geometry/shopify-furniture-model3d-references.json'),JSON.stringify({
  version:'0.1',generated_at:generatedAt,summary:{references:dedupedCandidates.length},references:dedupedCandidates.map((candidate) => ({
    geometry_reference_id:candidate.candidate_id,
    category_id:candidate.category_id,
    room_role:candidate.room_role,
    source_id:candidate.source_id,
    merchant_origin:candidate.merchant_origin,
    merchant_product_gid:candidate.identity.merchant_product_gid,
    merchant_variant_gid:candidate.identity.merchant_variant_gid,
    merchant_model3d_gid:candidate.identity.merchant_model3d_gid,
    formats:candidate.geometry.formats,
    variant_binding_state:candidate.variant_binding_state,
    asset_resolution:'LIVE_STOREFRONT_API_REQUIRED',
    source_urls_persisted:false,
    scale_state:candidate.geometry.scale_state,
    rights_state:candidate.geometry.rights_state,
    promotion_state:candidate.geometry.promotion_state
  }))
},null,2)+'\n');
await fs.writeFile(path.join(ROOT,'data/metrics/shopify-furniture-model3d-hunt-latest.json'),JSON.stringify({summary,category_search:categorySearchStats,by_category:byCategory,probe_failures:probeFailures.slice(0,20)},null,2)+'\n');
console.log(JSON.stringify({summary,by_category:byCategory,top_candidates:dedupedCandidates.slice(0,12).map((candidate)=>({candidate_id:candidate.candidate_id,category_id:candidate.category_id,title:candidate.identity.product_title,vendor:candidate.identity.vendor,variant:candidate.identity.variant_title,formats:candidate.geometry.formats,binding:candidate.variant_binding_state,rank_score:candidate.rank_score}))},null,2));
