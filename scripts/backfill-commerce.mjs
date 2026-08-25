// Backfill commerce fields on existing twins that lack them.
// Reads every twin in data/twins/, adds a commerce block from external_identities if missing.
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TWINS_DIR = path.join(ROOT, 'data/twins');

function cartDeeplink(articleNo, manufacturer) {
  if (manufacturer === 'IKEA') {
    const art = articleNo.replace(/\./g, '');
    return `https://www.ikea.com/es/en/p/-${art}/`;
  }
  return null;
}

async function main() {
  const files = (await fs.readdir(TWINS_DIR)).filter(f => f.endsWith('.json')).sort();
  let updated = 0, skipped = 0;

  for (const file of files) {
    const p = path.join(TWINS_DIR, file);
    const twin = JSON.parse(await fs.readFile(p, 'utf8'));

    if (twin.commerce) { skipped++; continue; }

    const ext = (twin.external_identities || [])[0];
    const manufacturer = twin.identity?.manufacturer || '';
    const articleNo = twin.identity?.article_no || '';

    // For NORR11/Wendelbo, use the offer_snapshot pattern from the showcase
    const isNorr11 = manufacturer === 'NORR11';
    const isWendelbo = manufacturer === 'Wendelbo';
    const isMuuto = manufacturer === 'Muuto';

    let merchantOrigin = null;
    if (isNorr11 || isWendelbo) {
      const shopifyExt = (twin.external_identities || []).find(e => e.source_id === 'shopify_merchant_storefront');
      merchantOrigin = shopifyExt?.merchant_origin;
    }

    twin.commerce = {
      merchant: isNorr11 || isWendelbo ? 'Design Public Group (trade)' : isMuuto ? 'Muuto' : ext?.source_id === 'ikea_spain' ? 'IKEA Spain' : 'unknown',
      currency: isNorr11 || isWendelbo ? 'USD' : 'EUR',
      unit_price: null,
      ean: twin.identity?.ean || null,
      product_url: ext?.product_url || null,
      cart_deeplink: cartDeeplink(articleNo, manufacturer),
      affiliate_link: null,
      available: true,
      observed_at: new Date().toISOString().slice(0, 10),
      refresh_policy: 'live_required_before_quote_or_purchase',
    };

    await fs.writeFile(p, JSON.stringify(twin, null, 2) + '\n');
    updated++;
    console.log(`UPDATED ${twin.twin_id}`);
  }

  console.log(JSON.stringify({ updated, skipped }));
}

await main();
