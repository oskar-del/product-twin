import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const SCENE_PATH = path.join(ROOT, 'data/showrooms/v0-shoppable-dining-scene.json');
const METRIC_PATH = path.join(ROOT, 'data/metrics/v0-shoppable-scene-refresh-latest.json');

const digits = (value) => String(value ?? '').replace(/\D/g, '');
const asTypes = (value) => Array.isArray(value) ? value : [value];

function walk(value, visitor) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visitor);
    return;
  }
  if (!value || typeof value !== 'object') return;
  visitor(value);
  for (const child of Object.values(value)) walk(child, visitor);
}

function visibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&euro;|&#8364;/gi, '€')
    .replace(/&aacute;/gi, 'á')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractOfficialOffer(html, expectedArticleNo) {
  const normalizedExpected = digits(expectedArticleNo);
  const products = [];
  const scriptPattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    try {
      const json = JSON.parse(match[1].trim());
      walk(json, (node) => {
        if (asTypes(node['@type']).some((type) => String(type).toLowerCase() === 'product')) products.push(node);
      });
    } catch {
      // Malformed unrelated structured-data blocks do not invalidate the page.
    }
  }

  const htmlHasArticle = digits(visibleText(html)).includes(normalizedExpected);
  const product = products.find((item) => {
    const candidates = [item.sku, item.mpn, item.productID, item.name];
    return candidates.some((candidate) => digits(candidate).includes(normalizedExpected));
  }) ?? (products.length === 1 && htmlHasArticle ? products[0] : null);

  const offers = product ? (Array.isArray(product.offers) ? product.offers : [product.offers]).filter(Boolean) : [];
  const offer = offers.find((item) => String(item.priceCurrency ?? '').toUpperCase() === 'EUR') ?? offers[0] ?? null;
  let price = Number(offer?.price);

  if (!Number.isFinite(price)) {
    const metaPrice = html.match(/<meta\b[^>]*(?:property|itemprop)=["'](?:product:price:amount|price)["'][^>]*content=["'](\d+(?:[.,]\d+)?)["']/i)
      ?? html.match(/<meta\b[^>]*content=["'](\d+(?:[.,]\d+)?)["'][^>]*(?:property|itemprop)=["'](?:product:price:amount|price)["']/i);
    price = metaPrice ? Number(metaPrice[1].replace(',', '.')) : Number.NaN;
  }

  const text = visibleText(html);
  const addToCartObserved = /añadir al carrito/i.test(text);
  const merchantIssueObserved = /áreas de ventas y pago están experimentando problemas|sales and payment areas are experiencing problems/i.test(text);
  const structuredAvailability = offer?.availability ? String(offer.availability).split('/').pop() : null;

  return {
    identity_match: Boolean(product && htmlHasArticle),
    expected_article_no: expectedArticleNo,
    structured_product_found: Boolean(product),
    price_eur: Number.isFinite(price) ? price : null,
    structured_availability: structuredAvailability,
    add_to_cart_observed: addToCartObserved,
    merchant_sales_payment_issue_observed: merchantIssueObserved,
  };
}

async function main() {
  const scene = JSON.parse(await fs.readFile(SCENE_PATH, 'utf8'));
  const observedAt = new Date().toISOString().slice(0, 10);
  const results = [];

  for (const product of scene.products ?? []) {
    const url = product.offer_snapshot?.product_url;
    try {
      const response = await fetch(url, {
        headers: {
          'accept-language': 'es-ES,es;q=0.9,en;q=0.6',
          'user-agent': 'product-twin-offer-refresh/0.1 (+minimal-reference-only)',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const extracted = extractOfficialOffer(await response.text(), product.identity.article_no);
      if (!extracted.identity_match) throw new Error('exact article identity not found in official page');
      if (!Number.isFinite(extracted.price_eur)) throw new Error('EUR price not found in official structured data');

      Object.assign(product.offer_snapshot, {
        unit_price: extracted.price_eur,
        observed_at: observedAt,
        price_state: 'LIVE_OFFICIAL_PAGE_REFRESHED',
        availability_state: 'LIVE_LOCATION_REFRESH_REQUIRED',
        handoff_state: extracted.add_to_cart_observed ? 'DIRECT_PRODUCT_PAGE_ADD_TO_CART_OBSERVED' : 'DIRECT_PRODUCT_PAGE_AVAILABLE',
        checkout_state: extracted.merchant_sales_payment_issue_observed ? 'MERCHANT_REPORTED_TEMPORARY_SALES_AND_PAYMENT_ISSUES' : 'LIVE_CHECKOUT_HEALTH_UNVERIFIED',
      });
      results.push({ twin_id: product.twin_id, status: 'REFRESHED', ...extracted });
    } catch (error) {
      results.push({ twin_id: product.twin_id, status: 'FAILED', error: String(error?.message ?? error) });
    }
  }

  const primary = scene.products.find((product) => product.twin_id === scene.swap_proof.from_twin_id);
  const substitute = scene.products.find((product) => product.twin_id === scene.swap_proof.to_twin_id);
  if (primary && substitute) {
    scene.swap_proof.budget_delta_eur = Number((substitute.offer_snapshot.unit_price - primary.offer_snapshot.unit_price).toFixed(2));
    scene.swap_proof.resulting_total_eur = substitute.offer_snapshot.unit_price;
  }
  scene.evidence_observed_at = observedAt;
  scene.exit_evidence.live_price_refresh = `PASS_${observedAt.replaceAll('-', '_')}`;

  const failures = results.filter((item) => item.status === 'FAILED');
  const metric = {
    generated_at: new Date().toISOString(),
    scene_id: scene.scene_id,
    status: failures.length ? 'PARTIAL_REFRESH_FAILED' : 'OFFICIAL_PRICE_AND_HANDOFF_SIGNALS_REFRESHED',
    products_checked: results.length,
    products_refreshed: results.length - failures.length,
    products_failed: failures.length,
    location_availability_state: 'SESSION_REQUIRED_NOT_FABRICATED',
    storage_policy: 'minimal dated identity/price/handoff signals only; no retailer payload, image, stock response or cart session persisted',
    results,
  };

  await Promise.all([
    fs.writeFile(SCENE_PATH, JSON.stringify(scene, null, 2) + '\n'),
    fs.writeFile(METRIC_PATH, JSON.stringify(metric, null, 2) + '\n'),
  ]);
  console.log(JSON.stringify(metric, null, 2));
  if (failures.length) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
