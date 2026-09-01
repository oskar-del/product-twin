// Generic catalog ingestion: brand JSONL → twin JSON files (catalog-only, no geometry).
// Usage: node scripts/ingest-catalog.mjs <brand> <path-to-jsonl>
// Example: node scripts/ingest-catalog.mjs valostore data/valostore/valostore-catalog.jsonl
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

const ROOT = process.cwd();
const TWINS_DIR = path.join(ROOT, 'data/twins');

const [,, brand, catalogPath] = process.argv;
if (!brand || !catalogPath) { console.error('Usage: node scripts/ingest-catalog.mjs <brand> <path>'); process.exit(1); }

const BRAND_UPPER = brand.toUpperCase();

function parsePrice(s) {
  if (!s) return null;
  const n = parseFloat(s.replace(/[^\d.,]/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

async function main() {
  await fs.mkdir(TWINS_DIR, { recursive: true });
  const rl = readline.createInterface({ input: (await import('node:fs')).createReadStream(path.resolve(catalogPath)) });
  let ingested = 0, skipped = 0;
  const seen = new Set();

  for await (const line of rl) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    const safeId = String(row.id).replace(/[^A-Za-z0-9_.-]/g, '-');
    const twinId = `PT_${BRAND_UPPER}_${safeId}`;
    if (seen.has(twinId)) { skipped++; continue; }
    seen.add(twinId);

    const twinPath = path.join(TWINS_DIR, `${twinId}.json`);
    try { await fs.access(twinPath); skipped++; continue; } catch {}

    const twin = {
      twin_id: twinId,
      schema_version: '0.4.0',
      identity: {
        name: row.title || '',
        manufacturer: row.brand || brand,
        article_no: row.id,
        ean: row.gtin || null,
        source: `${brand}_adtraction_feed`,
      },
      category_id: 'CATALOG_ONLY',
      bucket: row.bucket || 'CATALOG_ONLY',
      commerce: {
        merchant: `${brand} SE`,
        currency: row.currency || 'SEK',
        unit_price: parsePrice(row.price),
        ean: row.gtin || null,
        product_url: row.product_url || null,
        cart_deeplink: row.product_url || null,
        affiliate_link: row.affiliate_link || null,
        available: row.availability === 'in_stock',
        observed_at: '2026-08-29',
        refresh_policy: 'live_required_before_quote_or_purchase',
      },
      image: { primary_url: row.image || null },
      geometry: { level: 'G0', state: 'catalog_only' },
      readiness: { identity: 'feed_verified', commerce: row.affiliate_link ? 'affiliate_live' : 'catalog_only', geometry: 'G0_catalog_only' },
    };

    await fs.writeFile(twinPath, JSON.stringify(twin, null, 2) + '\n');
    ingested++;
    if (ingested % 500 === 0) process.stderr.write(`... ${ingested}\n`);
  }

  console.log(JSON.stringify({ brand, ingested, skipped, total: ingested + skipped }));
}

await main();
