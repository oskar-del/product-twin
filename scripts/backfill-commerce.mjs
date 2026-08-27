// Backfill commerce fields on existing twins that lack them.
// Reads every twin in data/twins/, adds a commerce block from external_identities if missing.
// Also updates affiliate_link when ADTRACTION_CHANNEL_ID + ADTRACTION_PROGRAM_ID are set.
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TWINS_DIR = path.join(ROOT, 'data/twins');

const ADTRACTION_CHANNEL = process.env.ADTRACTION_CHANNEL_ID || '';
const ADTRACTION_PROGRAM = process.env.ADTRACTION_PROGRAM_ID || '';
const ADTRACTION_READY = !!(ADTRACTION_CHANNEL && ADTRACTION_PROGRAM);

function adtractionWrap(productUrl) {
  if (!ADTRACTION_READY || !productUrl) return null;
  const encoded = encodeURIComponent(productUrl);
  return `https://track.adtraction.com/t/t?a=${ADTRACTION_CHANNEL}&as=${ADTRACTION_PROGRAM}&t=2&tk=1&url=${encoded}`;
}

function cartDeeplink(articleNo, manufacturer) {
  if (manufacturer === 'IKEA') {
    const art = articleNo.replace(/\./g, '');
    return `https://www.ikea.com/es/en/p/-${art}/`;
  }
  return null;
}

async function main() {
  if (ADTRACTION_READY) console.log(`Adtraction wrapping ON (channel=${ADTRACTION_CHANNEL}, program=${ADTRACTION_PROGRAM})`);
  else console.log('Adtraction wrapping OFF (set ADTRACTION_CHANNEL_ID + ADTRACTION_PROGRAM_ID to enable)');

  const files = (await fs.readdir(TWINS_DIR)).filter(f => f.endsWith('.json')).sort();
  let created = 0, affiliateWrapped = 0, skipped = 0;

  for (const file of files) {
    const p = path.join(TWINS_DIR, file);
    const twin = JSON.parse(await fs.readFile(p, 'utf8'));
    let dirty = false;

    if (!twin.commerce) {
      const ext = (twin.external_identities || [])[0];
      const manufacturer = twin.identity?.manufacturer || '';
      const articleNo = twin.identity?.article_no || '';
      const isNorr11 = manufacturer === 'NORR11';
      const isWendelbo = manufacturer === 'Wendelbo';
      const isMuuto = manufacturer === 'Muuto';

      twin.commerce = {
        merchant: isNorr11 || isWendelbo ? 'Design Public Group (trade)' : isMuuto ? 'Muuto' : ext?.source_id === 'ikea_spain' ? 'IKEA Spain' : 'unknown',
        currency: isNorr11 || isWendelbo ? 'USD' : 'EUR',
        unit_price: null,
        ean: twin.identity?.ean || null,
        product_url: ext?.product_url || null,
        cart_deeplink: cartDeeplink(articleNo, manufacturer),
        affiliate_link: adtractionWrap(ext?.product_url || cartDeeplink(articleNo, manufacturer)),
        available: true,
        observed_at: new Date().toISOString().slice(0, 10),
        refresh_policy: 'live_required_before_quote_or_purchase',
      };
      dirty = true;
      created++;
    }

    if (ADTRACTION_READY && twin.commerce && !twin.commerce.affiliate_link) {
      const url = twin.commerce.product_url || twin.commerce.cart_deeplink;
      const wrapped = adtractionWrap(url);
      if (wrapped) {
        twin.commerce.affiliate_link = wrapped;
        dirty = true;
        affiliateWrapped++;
      }
    }

    if (dirty) {
      await fs.writeFile(p, JSON.stringify(twin, null, 2) + '\n');
      console.log(`UPDATED ${twin.twin_id}`);
    } else {
      skipped++;
    }
  }

  console.log(JSON.stringify({ created, affiliateWrapped, skipped }));
}

await main();
