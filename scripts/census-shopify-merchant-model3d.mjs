import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const config = JSON.parse(await fs.readFile(path.join(ROOT, 'config/geometry/shopify-merchant-model3d-census.json'), 'utf8'));
const generatedAt = new Date().toISOString();
const endpoint = `${config.merchant_origin}/api/${config.storefront_api_version}/graphql.json`;

function decodeXml(value) {
  return value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
}

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? decodeXml(match[1].trim()) : null;
}

async function fetchText(url, attempt = 0) {
  const response = await fetch(url, {headers: {'user-agent': 'product-twin-shopify-merchant-model3d-census/0.1'}});
  if ((response.status === 429 || response.status >= 500) && attempt < 5) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(12000, 750 * (2 ** attempt))));
    return fetchText(url, attempt + 1);
  }
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

function classify(title, handle) {
  const text = `${title ?? ''} ${handle ?? ''}`.toLowerCase().replaceAll('-', ' ');
  if (config.exclusion_patterns.some((pattern) => text.includes(pattern))) return null;
  for (const role of config.roles) if (role.patterns.some((pattern) => text.includes(pattern))) return role;
  return null;
}

function productEntries(xml) {
  const entries = [];
  for (const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const loc = tag(match[1], 'loc');
    if (!loc) continue;
    const handle = loc.match(/\/products\/([^/?#]+)/)?.[1];
    if (!handle) continue;
    const title = tag(match[1], 'image:title') ?? handle.replaceAll('-', ' ');
    const role = classify(title, handle);
    if (role) entries.push({handle, title, room_role: role.room_role, category_id: role.category_id});
  }
  return entries;
}

const rootSitemap = await fetchText(`${config.merchant_origin}/sitemap.xml`);
const sitemapUrls = [...rootSitemap.matchAll(/<loc>([^<]*sitemap_products_[^<]*)<\/loc>/gi)].map((match) => decodeXml(match[1].trim()));
console.log(`Merchant product sitemaps: ${sitemapUrls.length}`);

const discoveredByHandle = new Map();
for (let offset = 0; offset < sitemapUrls.length; offset += config.concurrency) {
  const batch = sitemapUrls.slice(offset, offset + config.concurrency);
  const documents = await Promise.all(batch.map(fetchText));
  for (const document of documents) for (const entry of productEntries(document)) discoveredByHandle.set(entry.handle, entry);
  console.log(`Sitemaps ${Math.min(offset + batch.length, sitemapUrls.length)}/${sitemapUrls.length}; relevant products ${discoveredByHandle.size}`);
}

const queues = new Map(config.roles.map((role) => [role.room_role, []]));
for (const entry of discoveredByHandle.values()) queues.get(entry.room_role)?.push(entry);
for (const role of config.roles) {
  const queue = queues.get(role.room_role) ?? [];
  if (Number.isInteger(role.probe_target)) queues.set(role.room_role, queue.slice(0, role.probe_target));
}
const selected = [];
while (selected.length < config.maximum_product_probes) {
  let added = false;
  for (const role of config.roles) {
    const next = queues.get(role.room_role)?.shift();
    if (!next) continue;
    selected.push(next);
    added = true;
    if (selected.length >= config.maximum_product_probes) break;
  }
  if (!added) break;
}

const query = `query ProductTwinMerchantModel3dCensus($handle: String!) {
  product(handle: $handle) {
    id title vendor productType handle
    variants(first: 100) {
      nodes { id title sku barcode availableForSale selectedOptions { name value } price { amount currencyCode } }
    }
    media(first: 50) {
      nodes { mediaContentType ... on Model3d { id sources { format mimeType filesize } } }
    }
  }
}`;

async function probe(entry, attempt = 0) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {'content-type': 'application/json', 'user-agent': 'product-twin-shopify-merchant-model3d-census/0.1'},
    body: JSON.stringify({query, variables: {handle: entry.handle}}),
  });
  const text = await response.text();
  if ((response.status === 429 || response.status >= 500) && attempt < 5) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(12000, 750 * (2 ** attempt))));
    return probe(entry, attempt + 1);
  }
  if (!response.ok) throw new Error(`storefront ${response.status}: ${text.slice(0, 240)}`);
  const json = JSON.parse(text);
  if (json.errors?.length) throw new Error(json.errors.map((item) => item.message).join(' | '));
  const product = json.data?.product;
  if (!product) return null;
  const models = (product.media?.nodes ?? []).filter((item) => item?.mediaContentType === 'MODEL_3D');
  if (!models.length) return null;
  const variants = product.variants?.nodes ?? [];
  return {
    candidate_id: `SHOPIFY_MERCHANT_MODEL3D_${String(product.id).split('/').pop()}`,
    category_id: entry.category_id,
    room_role: entry.room_role,
    source_id: 'shopify_merchant_storefront',
    merchant_id: config.merchant_id,
    merchant_origin: config.merchant_origin,
    identity: {
      merchant_product_gid: product.id,
      product_title: product.title,
      vendor: product.vendor,
      handle: product.handle,
      product_type: product.productType,
    },
    variants: {
      count_returned: variants.length,
      has_single_variant: variants.length === 1,
      available_count: variants.filter((variant) => variant.availableForSale).length,
      representative: variants.slice(0, 5).map((variant) => ({
        merchant_variant_gid: variant.id,
        title: variant.title,
        sku: variant.sku,
        barcode: variant.barcode,
        available_for_sale: variant.availableForSale,
        selected_options: Object.fromEntries((variant.selectedOptions ?? []).map((option) => [option.name, option.value])),
        dated_price: variant.price ? {amount: variant.price.amount, currency: variant.price.currencyCode} : null,
      })),
    },
    geometry: {
      media_type: 'MODEL_3D',
      model_references: models.map((model) => ({
        merchant_model3d_gid: model.id,
        formats: [...new Set((model.sources ?? []).map((source) => String(source.format).toLowerCase()))],
        source_count: model.sources?.length ?? 0,
        source_urls_persisted: false,
      })),
      scale_state: 'LIVE_ASSET_INSPECTION_REQUIRED',
      material_state: 'LIVE_ASSET_INSPECTION_REQUIRED',
      rights_state: 'REVIEW',
      promotion_state: 'CANDIDATE_NOT_PROMOTED',
    },
    commerce: {
      merchant_storefront_available_count: variants.filter((variant) => variant.availableForSale).length,
      destination_delivery_state: 'UNVERIFIED_MERCHANT_CENSUS_NOT_CATALOG_DESTINATION_FILTERED',
      checkout_refresh_required: true,
    },
    variant_binding_state: variants.length === 1 ? 'SINGLE_VARIANT_STRONGER_BINDING_NEEDS_MATERIAL_QA' : 'PRODUCT_LEVEL_MODEL_VARIANT_BINDING_UNRESOLVED',
    observed_at: generatedAt,
  };
}

const candidates = [];
const failures = [];
for (let offset = 0; offset < selected.length; offset += config.concurrency) {
  const batch = selected.slice(offset, offset + config.concurrency);
  const results = await Promise.all(batch.map(async (entry) => {
    try { return await probe(entry); } catch (error) { failures.push({handle: entry.handle, error: String(error?.message ?? error)}); return null; }
  }));
  candidates.push(...results.filter(Boolean));
  console.log(`Merchant product probe ${Math.min(offset + batch.length, selected.length)}/${selected.length}; MODEL_3D hits ${candidates.length}`);
}

const byRole = config.roles.map((role) => ({
  room_role: role.room_role,
  category_id: role.category_id,
  sitemap_candidates: [...discoveredByHandle.values()].filter((item) => item.room_role === role.room_role).length,
  probed: selected.filter((item) => item.room_role === role.room_role).length,
  model3d_candidates: candidates.filter((item) => item.room_role === role.room_role).length,
  single_variant_candidates: candidates.filter((item) => item.room_role === role.room_role && item.variants.has_single_variant).length,
}));
const summary = {
  generated_at: generatedAt,
  merchant_id: config.merchant_id,
  merchant_origin: config.merchant_origin,
  product_sitemaps: sitemapUrls.length,
  relevant_products_discovered: discoveredByHandle.size,
  product_probes_attempted: selected.length,
  probe_failures: failures.length,
  model3d_candidates: candidates.length,
  single_variant_candidates: candidates.filter((item) => item.variants.has_single_variant).length,
  roles_with_model3d: new Set(candidates.map((item) => item.room_role)).size,
  destination_delivery_verified: 0,
  persistence_policy: config.persistence_policy,
};

await fs.mkdir(path.join(ROOT, 'data/identity'), {recursive: true});
await fs.mkdir(path.join(ROOT, 'data/geometry'), {recursive: true});
await fs.mkdir(path.join(ROOT, 'data/metrics'), {recursive: true});
await fs.writeFile(path.join(ROOT, 'data/identity/shopify-design-public-model3d-candidates.json'), `${JSON.stringify({version: '0.1', summary, candidates}, null, 2)}\n`);
await fs.writeFile(path.join(ROOT, 'data/geometry/shopify-design-public-model3d-references.json'), `${JSON.stringify({version: '0.1', generated_at: generatedAt, references: candidates.map((candidate) => ({candidate_id: candidate.candidate_id, category_id: candidate.category_id, room_role: candidate.room_role, merchant_origin: candidate.merchant_origin, merchant_product_gid: candidate.identity.merchant_product_gid, merchant_model3d_gids: candidate.geometry.model_references.map((model) => model.merchant_model3d_gid), asset_resolution: 'LIVE_STOREFRONT_API_REQUIRED', source_urls_persisted: false, scale_state: candidate.geometry.scale_state, material_state: candidate.geometry.material_state, rights_state: candidate.geometry.rights_state}))}, null, 2)}\n`);
await fs.writeFile(path.join(ROOT, 'data/metrics/shopify-design-public-model3d-census-latest.json'), `${JSON.stringify({summary, by_role: byRole, failure_sample: failures.slice(0, 20), top_candidates: candidates.slice(0, 50).map((candidate) => ({candidate_id: candidate.candidate_id, room_role: candidate.room_role, title: candidate.identity.product_title, vendor: candidate.identity.vendor, variants: candidate.variants.count_returned, single_variant: candidate.variants.has_single_variant, model3d_count: candidate.geometry.model_references.length}))}, null, 2)}\n`);
console.log(JSON.stringify({summary, by_role: byRole, top_candidates: candidates.slice(0, 50).map((candidate) => ({candidate_id: candidate.candidate_id, room_role: candidate.room_role, title: candidate.identity.product_title, vendor: candidate.identity.vendor, variants: candidate.variants.count_returned, single_variant: candidate.variants.has_single_variant, model3d_count: candidate.geometry.model_references.length}))}, null, 2));
