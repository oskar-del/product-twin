// Multi-merchant native-MODEL_3D census. Generalizes the single-merchant census
// (census-shopify-merchant-model3d.mjs, which stays as the proven DPG baseline)
// to every merchant in config/geometry/shopify-multi-merchant-model3d-census.json
// that carries a passing capability-probe verdict. Same method: Shopify product
// sitemap discovery + token-less per-handle Storefront product query. Caps keep a
// sweep inside a tight compute budget and are reported so partial counts are never
// read as complete. Persists MODEL_3D evidence only; no model source URLs.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const UA = 'product-twin-shopify-multi-merchant-model3d-census/0.1';
const PER_REQUEST_TIMEOUT_MS = Number(process.env.CENSUS_TIMEOUT_MS ?? 8000);

function decodeXml(v) {
  return v.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
}
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? decodeXml(m[1].trim()) : null;
}
async function fetchText(url, options = {}, attempt = 0) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, headers: { 'user-agent': UA, ...(options.headers ?? {}) }, signal: ctrl.signal });
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      clearTimeout(timer);
      await new Promise((r) => setTimeout(r, Math.min(8000, 600 * (2 ** attempt))));
      return fetchText(url, options, attempt + 1);
    }
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (error) {
    return { ok: false, status: 0, text: '', error: String(error?.message ?? error) };
  } finally {
    clearTimeout(timer);
  }
}

const PRODUCT_QUERY = `query MultiMerchantModel3dCensus($handle: String!) {
  product(handle: $handle) {
    id title vendor productType handle
    variants(first: 50) { nodes { id title sku barcode availableForSale price { amount currencyCode } } }
    media(first: 50) { nodes { mediaContentType ... on Model3d { id sources { format } } } }
  }
}`;

function makeClassifier(cfg) {
  return (title, handle) => {
    const text = `${title ?? ''} ${handle ?? ''}`.toLowerCase().replaceAll('-', ' ');
    if (cfg.exclusion_patterns.some((p) => text.includes(p))) return null;
    for (const role of cfg.roles) if (role.patterns.some((p) => text.includes(p))) return role;
    return null;
  };
}

async function censusMerchant(merchant, cfg, caps) {
  const origin = merchant.origin.replace(/\/$/, '');
  const classify = makeClassifier(cfg);
  const result = {
    merchant_id: merchant.merchant_id,
    merchant_origin: origin,
    product_sitemaps_total: 0,
    product_sitemaps_scanned: 0,
    relevant_products_discovered: 0,
    product_probes_attempted: 0,
    probe_failures: 0,
    model3d_candidates: 0,
    coverage_capped: false,
    candidates: [],
    error: null,
  };

  const root = await fetchText(`${origin}/sitemap.xml`);
  if (!root.ok) { result.error = `sitemap ${root.status || root.error}`; return result; }
  const productSitemaps = [...root.text.matchAll(/<loc>([^<]*sitemap_products_[^<]*)<\/loc>/gi)].map((m) => decodeXml(m[1].trim()));
  result.product_sitemaps_total = productSitemaps.length;
  if (!productSitemaps.length) { result.error = 'no shopify product sitemaps'; return result; }

  const scanList = productSitemaps.slice(0, caps.maxSitemaps);
  result.product_sitemaps_scanned = scanList.length;
  result.coverage_capped = scanList.length < productSitemaps.length;

  const discovered = new Map();
  for (let i = 0; i < scanList.length; i += cfg.concurrency) {
    const batch = scanList.slice(i, i + cfg.concurrency);
    const docs = await Promise.all(batch.map((u) => fetchText(u)));
    for (const doc of docs) {
      if (!doc.ok) continue;
      for (const m of doc.text.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
        const loc = tag(m[1], 'loc');
        const handle = loc?.match(/\/products\/([^/?#]+)/)?.[1];
        if (!handle) continue;
        const title = tag(m[1], 'image:title') ?? handle.replaceAll('-', ' ');
        const role = classify(title, handle);
        if (role) discovered.set(handle, { handle, title, room_role: role.room_role, category_id: role.category_id });
      }
    }
  }
  result.relevant_products_discovered = discovered.size;

  const selected = [...discovered.values()].slice(0, caps.maxProbes);
  if (selected.length < discovered.size) result.coverage_capped = true;
  result.product_probes_attempted = selected.length;

  const endpoint = `${origin}/api/${cfg.storefront_api_version}/graphql.json`;
  for (let i = 0; i < selected.length; i += cfg.concurrency) {
    const batch = selected.slice(i, i + cfg.concurrency);
    const results = await Promise.all(batch.map(async (entry) => {
      const res = await fetchText(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: PRODUCT_QUERY, variables: { handle: entry.handle } }) });
      if (!res.ok) { result.probe_failures += 1; return null; }
      let json; try { json = JSON.parse(res.text); } catch { result.probe_failures += 1; return null; }
      if (json.errors?.length) { result.probe_failures += 1; return null; }
      const product = json.data?.product;
      if (!product) return null;
      const models = (product.media?.nodes ?? []).filter((n) => n?.mediaContentType === 'MODEL_3D');
      if (!models.length) return null;
      const variants = product.variants?.nodes ?? [];
      return {
        candidate_id: `SHOPIFY_MERCHANT_MODEL3D_${merchant.merchant_id}_${String(product.id).split('/').pop()}`,
        merchant_id: merchant.merchant_id,
        category_id: entry.category_id,
        room_role: entry.room_role,
        identity: { merchant_product_gid: product.id, product_title: product.title, vendor: product.vendor, handle: product.handle, product_type: product.productType },
        variants: { count_returned: variants.length, has_single_variant: variants.length === 1, available_count: variants.filter((v) => v.availableForSale).length },
        geometry: {
          media_type: 'MODEL_3D',
          model_references: models.map((m) => ({ merchant_model3d_gid: m.id, formats: [...new Set((m.sources ?? []).map((s) => String(s.format).toLowerCase()))], source_urls_persisted: false })),
          scale_state: 'LIVE_ASSET_INSPECTION_REQUIRED',
          material_state: 'LIVE_ASSET_INSPECTION_REQUIRED',
          rights_state: 'REVIEW',
          promotion_state: 'CANDIDATE_NOT_PROMOTED',
        },
        commerce: { destination_delivery_state: 'UNVERIFIED_MERCHANT_CENSUS_NOT_CATALOG_DESTINATION_FILTERED', checkout_refresh_required: true },
      };
    }));
    result.candidates.push(...results.filter(Boolean));
  }
  result.model3d_candidates = result.candidates.length;
  return result;
}

async function main() {
  const cfg = JSON.parse(await fs.readFile(path.join(ROOT, 'config/geometry/shopify-multi-merchant-model3d-census.json'), 'utf8'));
  const caps = {
    maxSitemaps: Number(process.env.CENSUS_MAX_SITEMAPS ?? cfg.default_caps.max_product_sitemaps_per_merchant),
    maxProbes: Number(process.env.CENSUS_MAX_PROBES ?? cfg.default_caps.max_probes_per_merchant),
  };
  const only = process.env.ONLY_MERCHANTS ? new Set(process.env.ONLY_MERCHANTS.split(',').map((s) => s.trim())) : null;
  const merchants = cfg.merchants.filter((m) => !only || only.has(m.merchant_id));
  const generated_at = new Date().toISOString();

  const perMerchant = [];
  for (const merchant of merchants) {
    const r = await censusMerchant(merchant, cfg, caps);
    perMerchant.push(r);
    console.error(`${merchant.merchant_id}: discovered=${r.relevant_products_discovered} probed=${r.product_probes_attempted} model3d=${r.model3d_candidates}${r.error ? ' ERROR=' + r.error : ''}${r.coverage_capped ? ' (capped)' : ''}`);
  }

  const allCandidates = perMerchant.flatMap((m) => m.candidates);
  const summary = {
    generated_at,
    caps,
    merchants_censused: perMerchant.length,
    merchants_with_model3d: perMerchant.filter((m) => m.model3d_candidates > 0).length,
    total_model3d_candidates: allCandidates.length,
    any_coverage_capped: perMerchant.some((m) => m.coverage_capped),
    per_merchant: perMerchant.map((m) => ({ merchant_id: m.merchant_id, discovered: m.relevant_products_discovered, probed: m.product_probes_attempted, model3d: m.model3d_candidates, capped: m.coverage_capped, error: m.error })),
    persistence_policy: cfg.persistence_policy,
  };

  await fs.mkdir(path.join(ROOT, 'data/identity'), { recursive: true });
  await fs.mkdir(path.join(ROOT, 'data/metrics'), { recursive: true });
  await fs.writeFile(path.join(ROOT, 'data/identity/shopify-multi-merchant-model3d-candidates.json'), JSON.stringify({ version: '0.1', summary, candidates: allCandidates }, null, 2) + '\n');
  await fs.writeFile(path.join(ROOT, 'data/metrics/shopify-multi-merchant-model3d-census-latest.json'), JSON.stringify({ summary }, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
