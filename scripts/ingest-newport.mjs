// Ingest Newport Adtraction feed catalog into twin JSON files.
// Usage: node scripts/ingest-newport.mjs
// Reads data/newport/newport-catalog.jsonl, writes to data/twins/.
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

const ROOT = process.cwd();
const CATALOG = path.join(ROOT, 'data/newport/newport-catalog.jsonl');
const TWINS_DIR = path.join(ROOT, 'data/twins');

const CATEGORY_MAP = {
  'Fåtöljer': 'FFE.SEATING.ARMCHAIR',
  'Skinnfåtöljer': 'FFE.SEATING.ARMCHAIR',
  'Soffor': 'FFE.SEATING.SOFA',
  'Soffbord': 'FFE.TABLE.COFFEE',
  'Bord': 'FFE.TABLE',
  'Matbord': 'FFE.TABLE.DINING',
  'Sidobord': 'FFE.TABLE.SIDE',
  'Konsolbord': 'FFE.TABLE.CONSOLE',
  'Nattduksbord': 'FFE.TABLE.BEDSIDE',
  'Stolar': 'FFE.SEATING.CHAIR',
  'Matstolar': 'FFE.SEATING.DINING_CHAIR',
  'Barstolar': 'FFE.SEATING.BAR_STOOL',
  'Bänkar': 'FFE.SEATING.BENCH',
  'Sängar': 'FFE.BEDROOM.BED',
  'Förvaring': 'FFE.STORAGE',
  'Hyllor': 'FFE.STORAGE.SHELF',
  'Skåp': 'FFE.STORAGE.CABINET',
  'Byråer': 'FFE.STORAGE.DRESSER',
  'Mattor': 'FFE.TEXTILES.RUG',
  'Kuddar': 'FFE.TEXTILES.CUSHION',
  'Plädar': 'FFE.TEXTILES.THROW',
  'Gardiner': 'FFE.TEXTILES.CURTAIN',
  'Krukor & vaser': 'FFE.DECOR.VASE',
  'Konstväxter': 'FFE.DECOR.PLANT',
  'Dekoration': 'FFE.DECOR',
  'Ljusstakar & ljuslyktor': 'FFE.DECOR.CANDLE',
  'Tavlor': 'FFE.DECOR.ART',
  'Speglar': 'FFE.DECOR.MIRROR',
  'Lampor': 'ELECTRICAL.LUMINAIRES',
  'Bordslampor': 'ELECTRICAL.LUMINAIRES.TABLE',
  'Golvlampor': 'ELECTRICAL.LUMINAIRES.FLOOR',
  'Taklampor': 'ELECTRICAL.LUMINAIRES.PENDANT',
  'Vägglampor': 'ELECTRICAL.LUMINAIRES.WALL',
  'Utemöbler': 'FFE.OUTDOOR',
  'Utefåtöljer': 'FFE.OUTDOOR.SEATING',
  'Utesoffor': 'FFE.OUTDOOR.SOFA',
  'Utebord': 'FFE.OUTDOOR.TABLE',
  'Coffee table books': 'FFE.DECOR.BOOK',
  'Slim Aarons': 'FFE.DECOR.ART',
  'Doft & skönhet': 'FFE.DECOR.FRAGRANCE',
  'Smycken & accessoarer': 'OTHER.ACCESSORIES',
  'Lamptillbehör': 'ELECTRICAL.LUMINAIRES.ACCESSORY',
};

function mapCategory(catPath) {
  const parts = catPath.split('>').map(s => s.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (CATEGORY_MAP[parts[i]]) return CATEGORY_MAP[parts[i]];
  }
  return 'OTHER';
}

function parsePrice(priceStr) {
  if (!priceStr) return null;
  const num = parseFloat(priceStr.replace(/[^\d.,]/g, '').replace(',', '.'));
  return isNaN(num) ? null : num;
}

function slugify(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

async function main() {
  await fs.mkdir(TWINS_DIR, { recursive: true });

  const rl = readline.createInterface({ input: (await import('node:fs')).createReadStream(CATALOG) });
  let ingested = 0, skipped = 0;
  const seen = new Set();

  for await (const line of rl) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);

    const twinId = `PT_NEWPORT_${row.id}`;
    if (seen.has(twinId)) { skipped++; continue; }
    seen.add(twinId);

    const twinPath = path.join(TWINS_DIR, `${twinId}.json`);
    try { await fs.access(twinPath); skipped++; continue; } catch {}

    const categoryId = mapCategory(row.category || '');
    const brandSlug = slugify(row.brand || 'newport');

    const twin = {
      twin_id: twinId,
      schema_version: '0.4.0',
      identity: {
        name: row.title,
        manufacturer: row.brand || 'Newport',
        article_no: row.id,
        ean: row.gtin || null,
        source: 'newport_adtraction_feed_2175',
      },
      category_id: categoryId,
      bucket: row.bucket,
      physical: {
        dimensions_mm: null,
      },
      commerce: {
        merchant: 'Newport SE',
        currency: row.currency || 'SEK',
        unit_price: parsePrice(row.price),
        sale_price: parsePrice(row.sale_price) || null,
        ean: row.gtin || null,
        product_url: row.product_url,
        cart_deeplink: row.product_url,
        affiliate_link: row.affiliate_link,
        available: row.availability === 'in_stock',
        observed_at: '2026-08-28',
        refresh_policy: 'live_required_before_quote_or_purchase',
        adtraction_program: { feed_id: '2175', commission_pct: 9 },
      },
      image: {
        primary_url: row.image || null,
      },
      appearance: {
        color: row.color || null,
        material: row.material || null,
      },
      geometry: {
        level: 'G0',
        state: 'catalog_only',
      },
      readiness: {
        identity: 'feed_verified',
        commerce: 'affiliate_live',
        geometry: 'G0_catalog_only',
      },
      external_identities: [{
        source_id: 'newport_adtraction',
        feed_id: '2175',
        product_id: row.id,
        product_url: row.product_url,
      }],
    };

    await fs.writeFile(twinPath, JSON.stringify(twin, null, 2) + '\n');
    ingested++;
    if (ingested % 1000 === 0) process.stderr.write(`... ${ingested} ingested\n`);
  }

  console.log(JSON.stringify({ ingested, skipped, total: ingested + skipped }));
}

await main();
