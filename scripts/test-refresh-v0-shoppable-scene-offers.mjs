import assert from 'node:assert/strict';
import { extractOfficialOffer } from './refresh-v0-shoppable-scene-offers.mjs';

const html = `<!doctype html>
<html><head><script type="application/ld+json">{
  "@context": "https://schema.org",
  "@type": "Product",
  "sku": "804.071.14",
  "name": "SKURUP",
  "offers": {"@type":"Offer","priceCurrency":"EUR","price":"21.49","availability":"https://schema.org/InStock"}
}</script></head><body>
<h1>SKURUP</h1><p>804.071.14</p><button>Añadir al carrito</button>
<p>Nuestras áreas de ventas y pago están experimentando problemas en este momento.</p>
</body></html>`;

const result = extractOfficialOffer(html, '804.071.14');
assert.equal(result.identity_match, true);
assert.equal(result.price_eur, 21.49);
assert.equal(result.structured_availability, 'InStock');
assert.equal(result.add_to_cart_observed, true);
assert.equal(result.merchant_sales_payment_issue_observed, true);

const mismatch = extractOfficialOffer(html, '603.865.27');
assert.equal(mismatch.identity_match, false);

console.log(JSON.stringify({ status: 'PASS', checks: 6 }, null, 2));
