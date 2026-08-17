import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const CATALOG = 'https://catalog.shopify.com/api/ucp/mcp';
const PROFILE = 'https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json';
const COUNTRY = 'ES';
const CURRENCY = 'EUR';
const API_VERSION = '2026-07';
const generatedAt = new Date().toISOString();
const input = JSON.parse(await fs.readFile(path.join(ROOT, 'data/identity/shopify-design-public-model3d-candidates.json'), 'utf8'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function merchantOrigin(variant) {
  for (const raw of [variant?.checkout_url, variant?.seller?.url, variant?.url]) {
    try { return new URL(raw).origin; } catch {}
  }
  return variant?.seller?.domain ? `https://${variant.seller.domain}` : null;
}

async function catalogSearch(query, attempt = 0) {
  const response = await fetch(CATALOG, {
    method: 'POST',
    headers: {'content-type': 'application/json', 'user-agent': 'product-twin-shopify-model3d-commerce-join/0.1'},
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
            filters: {ships_to: {country: COUNTRY}, available: true},
            context: {address_country: COUNTRY, currency: CURRENCY, intent: 'Join a merchant-native furniture Model3d candidate to Spain-country-filtered Shopify commerce without disclosing a project postcode'},
            pagination: {limit: 50},
          },
        },
      },
    }),
  });
  const text = await response.text();
  if ((response.status === 429 || response.status >= 500) && attempt < 5) {
    await sleep(Math.min(30000, 1200 * ((attempt + 1) ** 2)));
    return catalogSearch(query, attempt + 1);
  }
  if (!response.ok) throw new Error(`search_catalog ${response.status}: ${text.slice(0, 500)}`);
  const json = JSON.parse(text);
  if (json.error) throw new Error(JSON.stringify(json.error));
  return json.result?.structuredContent ?? json.result;
}

const variantQuery = `query ProductTwinCommerceJoin($id: ID!) {
  node(id: $id) {
    ... on ProductVariant {
      id title sku barcode availableForSale selectedOptions { name value } price { amount currencyCode }
      product { id title vendor handle productType }
    }
  }
}`;

async function resolveVariant(origin, variantId) {
  const response = await fetch(`${origin}/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {'content-type': 'application/json', 'user-agent': 'product-twin-shopify-model3d-commerce-join/0.1'},
    body: JSON.stringify({query: variantQuery, variables: {id: variantId}}),
  });
  if (!response.ok) return null;
  const json = await response.json();
  return json.data?.node ?? null;
}

const joins = [];
for (const candidate of input.candidates ?? []) {
  console.log(`Shopify destination join: ${candidate.identity.vendor} ${candidate.identity.product_title}`);
  const result = await catalogSearch(`${candidate.identity.vendor} ${candidate.identity.product_title}`);
  const variants = (result?.products ?? []).flatMap((product) => product.variants ?? []);
  const merchantVariants = variants.filter((variant) => merchantOrigin(variant) === candidate.merchant_origin && variant?.id);
  const exact = [];
  for (const variant of merchantVariants.slice(0, 50)) {
    const resolved = await resolveVariant(candidate.merchant_origin, variant.id);
    if (resolved?.product?.id !== candidate.identity.merchant_product_gid) continue;
    exact.push({
      merchant_variant_gid: resolved.id,
      variant_title: resolved.title,
      sku: resolved.sku,
      barcode: resolved.barcode,
      selected_options: Object.fromEntries((resolved.selectedOptions ?? []).map((option) => [option.name, option.value])),
      available_for_sale: resolved.availableForSale === true,
      dated_price: resolved.price ? {amount: resolved.price.amount, currency: resolved.price.currencyCode} : null,
    });
  }
  joins.push({
    candidate_id: candidate.candidate_id,
    category_id: candidate.category_id,
    room_role: candidate.room_role,
    identity: candidate.identity,
    status: exact.length ? 'EXACT_MERCHANT_PRODUCT_JOIN_COUNTRY_FILTER_PASS' : 'NO_EXACT_COUNTRY_FILTERED_JOIN',
    destination: {country: COUNTRY, scope: 'country_only'},
    exact_variant_matches: exact,
    checkout_refresh_required: true,
    observed_at: generatedAt,
    policy: 'The country-filtered catalog result proves Spain discovery eligibility, not exact postcode delivery, final tax, freight, stock allocation or delivery promise. Refresh checkout before quoting or purchase.',
  });
  await sleep(250);
}

const summary = {
  generated_at: generatedAt,
  candidates: joins.length,
  exact_country_filtered_product_joins: joins.filter((join) => join.status === 'EXACT_MERCHANT_PRODUCT_JOIN_COUNTRY_FILTER_PASS').length,
  exact_country_filtered_variants: joins.reduce((sum, join) => sum + join.exact_variant_matches.length, 0),
  complete_candidate_join_coverage: joins.every((join) => join.status === 'EXACT_MERCHANT_PRODUCT_JOIN_COUNTRY_FILTER_PASS'),
  destination: {country: COUNTRY, scope: 'country_only', currency: CURRENCY},
};
await fs.mkdir(path.join(ROOT, 'data/commerce'), {recursive: true});
await fs.mkdir(path.join(ROOT, 'data/metrics'), {recursive: true});
await fs.writeFile(path.join(ROOT, 'data/commerce/shopify-design-public-model3d-spain-joins-2026-08-17.json'), `${JSON.stringify({version: '0.1', summary, joins}, null, 2)}\n`);
await fs.writeFile(path.join(ROOT, 'data/metrics/shopify-design-public-model3d-commerce-latest.json'), `${JSON.stringify({summary, results: joins.map((join) => ({candidate_id: join.candidate_id, title: join.identity.product_title, vendor: join.identity.vendor, status: join.status, exact_variant_matches: join.exact_variant_matches.length}))}, null, 2)}\n`);
console.log(JSON.stringify({summary, results: joins.map((join) => ({candidate_id: join.candidate_id, title: join.identity.product_title, vendor: join.identity.vendor, status: join.status, exact_variant_matches: join.exact_variant_matches.length, variants: join.exact_variant_matches.slice(0, 10)}))}, null, 2));
