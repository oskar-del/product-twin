// Twin compiler: product feed row → committed twin JSON with full commerce fields.
// Usage: node scripts/compile-twin.mjs < feed.jsonl
// Each line: {"article_no","name","family","category_id","dims_mm":{"w","d","h"},"price_eur","currency","ean","product_url","merchant"}
// Outputs twin JSON to data/twins/ — one file per product.

import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

const ROOT = process.cwd();
const TWINS_DIR = path.join(ROOT, 'data/twins');

function slugify(family) {
  return family.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function twinId(manufacturer, family, articleNo) {
  const art = articleNo.replace(/[.\-\s]/g, '');
  return `PT_${manufacturer.toUpperCase()}_${slugify(family)}_${art}`;
}

function cartDeeplink(articleNo, merchant) {
  if (merchant === 'IKEA') {
    const art = articleNo.replace(/\./g, '');
    return `https://www.ikea.com/es/en/p/-${art}/`;
  }
  return null;
}

function buildTwin(row) {
  const art = row.article_no;
  const manufacturer = row.manufacturer || 'IKEA';
  const id = twinId(manufacturer, row.family, art);
  const artDotted = art.match(/.{1,3}/g)?.join('.') ?? art;

  const twin = {
    twin_id: id,
    kind: 'object',
    category_id: row.category_id,
    identity: {
      state: 'verified',
      manufacturer,
      product_family: row.family,
      model: row.name,
      article_no: artDotted,
      ean: row.ean || null,
      configuration: row.name,
    },
    physical: {
      dimensions_mm: {
        width: row.dims_mm.w,
        depth: row.dims_mm.d,
        height: row.dims_mm.h,
      },
      evidence_state: 'official_retailer_dimensions',
    },
    commerce: {
      merchant: row.merchant || 'IKEA Spain',
      currency: row.currency || 'EUR',
      unit_price: row.price_eur ?? null,
      ean: row.ean || null,
      product_url: row.product_url || null,
      cart_deeplink: row.cart_deeplink || cartDeeplink(art, manufacturer),
      affiliate_link: row.affiliate_link || null,
      available: true,
      observed_at: new Date().toISOString().slice(0, 10),
      refresh_policy: 'live_required_before_quote_or_purchase',
    },
    external_identities: [
      {
        source_id: (manufacturer === 'IKEA' ? 'ikea_spain' : row.source_id || 'merchant'),
        role: 'direct_retail_reference',
        product_url: row.product_url || null,
        verification: {
          state: 'exact_retail_article_verified',
          article_no: artDotted,
          ean: row.ean || null,
          postcode_delivery_state: 'live_refresh_required',
        },
        refresh_policy: 'live_required_before_quote_or_purchase',
        mutable_catalog_data_persisted: false,
      },
    ],
    geometry: {
      level: 'G0',
      state: 'awaiting_proxy_build',
      avatar_id: null,
      asset_path: null,
      scale_state: `target ${row.dims_mm.w}x${row.dims_mm.d}x${row.dims_mm.h}mm`,
    },
    readiness: {
      identity: 'verified_exact_retail_article',
      commerce: 'live_commerce_fields_populated',
      dimensions: 'verified',
      geometry: 'G0_awaiting_proxy',
    },
    policy: 'Real, exact retail product identity with live commerce fields. Geometry awaits proxy build.',
  };

  return { id, twin };
}

async function main() {
  await fs.mkdir(TWINS_DIR, { recursive: true });

  const input = process.stdin;
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  let created = 0, skipped = 0, errors = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    let row;
    try { row = JSON.parse(trimmed); }
    catch (e) { console.error(`SKIP bad JSON: ${trimmed.slice(0, 80)}`); errors++; continue; }

    if (!row.article_no || !row.name || !row.family || !row.category_id || !row.dims_mm) {
      console.error(`SKIP missing required fields: ${row.article_no || '?'}`);
      errors++;
      continue;
    }

    const { id, twin } = buildTwin(row);
    const dest = path.join(TWINS_DIR, `${id}.json`);

    try {
      await fs.access(dest);
      skipped++;
    } catch {
      await fs.writeFile(dest, JSON.stringify(twin, null, 2) + '\n');
      created++;
      console.log(`CREATED ${id}`);
    }
  }

  console.log(JSON.stringify({ created, skipped, errors }));
}

await main();
