// Capability probe: for each candidate merchant, cheaply determine whether the
// token-less Shopify Storefront MODEL_3D census method works, using the SAME
// method as the census (sitemap discovery + per-handle product query) rather
// than the bulk products query. Records live evidence per merchant; asserts no
// viability without it. A small handle sample keeps each merchant to a few
// requests so a ~20-merchant sweep fits a tight time budget.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const SAMPLE_HANDLES = Number(process.env.SAMPLE_HANDLES ?? 6);
const PER_REQUEST_TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS ?? 6000);
const UA = 'product-twin-shopify-merchant-model3d-capability/0.1';

function decodeXml(v) {
  return v.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
}

async function fetchWithTimeout(url, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, headers: { 'user-agent': UA, ...(options.headers ?? {}) }, signal: ctrl.signal });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (error) {
    return { ok: false, status: 0, text: '', error: String(error?.message ?? error) };
  } finally {
    clearTimeout(timer);
  }
}

const PRODUCT_QUERY = `query CapabilityProbe($handle: String!) {
  product(handle: $handle) {
    id handle title
    media(first: 50) { nodes { mediaContentType ... on Model3d { id sources { format } } } }
  }
}`;

export async function probeMerchant(candidate, version) {
  const origin = candidate.origin.replace(/\/$/, '');
  const verdict = {
    merchant_id: candidate.merchant_id,
    origin,
    is_shopify_sitemap: false,
    product_sitemaps: 0,
    sampled_handles: 0,
    storefront_api_ok: false,
    sample_products_resolved: 0,
    model3d_products_in_sample: 0,
    model3d_seen_in_sample: false,
    statuses: {},
    census_viable: false,
    reason: null,
  };

  const root = await fetchWithTimeout(`${origin}/sitemap.xml`);
  verdict.statuses.sitemap = root.status;
  if (!root.ok) { verdict.reason = `sitemap ${root.status || root.error}`; return verdict; }
  const productSitemaps = [...root.text.matchAll(/<loc>([^<]*sitemap_products_[^<]*)<\/loc>/gi)].map((m) => decodeXml(m[1].trim()));
  verdict.product_sitemaps = productSitemaps.length;
  verdict.is_shopify_sitemap = productSitemaps.length > 0 || /sitemap_products/i.test(root.text);
  if (!productSitemaps.length) { verdict.reason = 'no shopify product sitemaps'; return verdict; }

  const firstSitemap = await fetchWithTimeout(productSitemaps[0]);
  verdict.statuses.product_sitemap = firstSitemap.status;
  if (!firstSitemap.ok) { verdict.reason = `product sitemap ${firstSitemap.status || firstSitemap.error}`; return verdict; }
  const handles = [];
  for (const m of firstSitemap.text.matchAll(/<loc>([^<]*\/products\/[^<]+)<\/loc>/gi)) {
    const handle = decodeXml(m[1]).match(/\/products\/([^/?#]+)/)?.[1];
    if (handle && !handles.includes(handle)) handles.push(handle);
    if (handles.length >= SAMPLE_HANDLES) break;
  }
  verdict.sampled_handles = handles.length;
  if (!handles.length) { verdict.reason = 'no product handles in first sitemap'; return verdict; }

  const endpoint = `${origin}/api/${version}/graphql.json`;
  for (const handle of handles) {
    const res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: PRODUCT_QUERY, variables: { handle } }),
    });
    verdict.statuses.storefront = res.status;
    if (!res.ok) { verdict.reason = verdict.reason ?? `storefront ${res.status || res.error}`; continue; }
    let json;
    try { json = JSON.parse(res.text); } catch { continue; }
    if (json.errors?.length) { verdict.reason = verdict.reason ?? `storefront errors: ${json.errors[0]?.message}`; continue; }
    verdict.storefront_api_ok = true;
    const product = json.data?.product;
    if (!product) continue;
    verdict.sample_products_resolved += 1;
    const has3d = (product.media?.nodes ?? []).some((n) => n?.mediaContentType === 'MODEL_3D');
    if (has3d) verdict.model3d_products_in_sample += 1;
  }
  verdict.model3d_seen_in_sample = verdict.model3d_products_in_sample > 0;
  verdict.census_viable = verdict.is_shopify_sitemap && verdict.storefront_api_ok && verdict.sample_products_resolved > 0;
  if (verdict.census_viable && !verdict.reason) verdict.reason = verdict.model3d_seen_in_sample ? 'viable; MODEL_3D present in sample' : 'viable; no MODEL_3D in small sample (full census still worthwhile)';
  return verdict;
}

async function main() {
  const cfg = JSON.parse(await fs.readFile(path.join(ROOT, 'config/geometry/shopify-merchant-model3d-candidates.json'), 'utf8'));
  const only = process.env.ONLY_MERCHANTS ? new Set(process.env.ONLY_MERCHANTS.split(',').map((s) => s.trim())) : null;
  const list = cfg.candidates.filter((c) => !only || only.has(c.merchant_id));
  const generated_at = new Date().toISOString();
  const concurrency = Number(process.env.PROBE_CONCURRENCY ?? 4);
  const verdicts = [];
  for (let i = 0; i < list.length; i += concurrency) {
    const batch = list.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((c) => probeMerchant(c, cfg.storefront_api_version)));
    verdicts.push(...results);
    console.error(`probed ${Math.min(i + batch.length, list.length)}/${list.length}`);
  }
  const viable = verdicts.filter((v) => v.census_viable);
  const summary = {
    generated_at,
    candidates_probed: verdicts.length,
    census_viable: viable.length,
    with_model3d_in_sample: verdicts.filter((v) => v.model3d_seen_in_sample).length,
    viable_merchant_ids: viable.map((v) => v.merchant_id),
  };
  const out = { version: '0.1', storefront_api_version: cfg.storefront_api_version, summary, verdicts };
  await fs.mkdir(path.join(ROOT, 'data/metrics'), { recursive: true });
  await fs.writeFile(path.join(ROOT, 'data/metrics/shopify-merchant-model3d-capability-latest.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify({ summary, verdicts }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
