// Adds the `attach` block (role/slots or role/attach_as) to twin JSON files, purely
// from category_id — zero-LLM, deterministic. Usage:
//   node scripts/annotate-attach-points.mjs [glob]           # default: data/twins/*.json
import fs from 'node:fs/promises';
import path from 'node:path';
import { globSync } from 'node:fs';

const ROOT = process.cwd();
const pattern = process.argv[2] || 'data/twins/*.json';

const BASE_SLOT_TEMPLATES = [
  { match: /^FFE\.SEATING\.SOFA/, slots: [
    { slot_id: 'seat_back', type: 'pillow', capacity: 3 },
    { slot_id: 'seat', type: 'throw', capacity: 1 },
  ]},
  { match: /^FFE\.SEATING\.(ARMCHAIR|CHAIR|BENCH)/, slots: [
    { slot_id: 'seat_back', type: 'pillow', capacity: 1 },
    { slot_id: 'seat', type: 'throw', capacity: 1 },
  ]},
  { match: /^FFE\.TABLE\.(COFFEE|SIDE|DINING)/, slots: [
    { slot_id: 'top', type: 'centerpiece', capacity: 1 },
  ]},
  { match: /^FFE\.TABLE$/, slots: [
    { slot_id: 'top', type: 'centerpiece', capacity: 1 },
  ]},
  { match: /^FFE\.STORAGE\.(SHELVING|BOOKCASE)/, slots: [
    { slot_id: 'surface', type: 'vignette', capacity: 3 },
  ]},
  { match: /^FFE\.STORAGE(\.(DRESSER|CHEST|TV_BENCH))?$/, slots: [
    { slot_id: 'surface', type: 'vignette', capacity: 2 },
  ]},
];

const ATTACH_AS_TEMPLATES = [
  { match: /^FFE\.TEXTILES\.CUSHION/, accepts_slot_type: 'pillow', default_mm: { width: 450, depth: 450, height: 150 } },
  { match: /^FFE\.TEXTILES\.RUG/, accepts_slot_type: 'rug', default_mm: { width: 2000, depth: 3000, height: 10 } },
  { match: /^FFE\.TEXTILES/, accepts_slot_type: 'throw', default_mm: { width: 1300, depth: 1700, height: 20 } },
  { match: /^FFE\.DECOR\.(VASE|PLANT)/, accepts_slot_type: 'centerpiece', default_mm: { width: 250, depth: 250, height: 350 } },
  { match: /^FFE\.DECOR\.(CANDLE|BOOK|FRAGRANCE|MIRROR|ART)/, accepts_slot_type: 'vignette', default_mm: { width: 150, depth: 150, height: 200 } },
  { match: /^FFE\.DECOR/, accepts_slot_type: 'vignette', default_mm: { width: 200, depth: 200, height: 250 } },
];

function classify(categoryId, bucket) {
  if (!categoryId) return null;
  for (const t of BASE_SLOT_TEMPLATES) {
    if (t.match.test(categoryId)) return { role: 'base', slots: t.slots };
  }
  for (const t of ATTACH_AS_TEMPLATES) {
    if (t.match.test(categoryId)) return { role: 'attach', accepts_slot_type: t.accepts_slot_type, default_mm: t.default_mm };
  }
  if (bucket === 'FURNITURE') {
    // floor-standing furniture outside the explicit list still gets a floor role, no slots claimed
    return { role: 'free' };
  }
  return null;
}

async function main() {
  const files = globSync(pattern, { cwd: ROOT });
  let annotated = 0, skipped_no_match = 0, skipped_has_attach = 0;
  const byRole = { base: 0, attach: 0, free: 0 };

  for (const rel of files) {
    const p = path.join(ROOT, rel);
    const twin = JSON.parse(await fs.readFile(p, 'utf8'));
    if (twin.attach) { skipped_has_attach++; continue; }

    const cls = classify(twin.category_id, twin.bucket);
    if (!cls) { skipped_no_match++; continue; }

    if (cls.role === 'base') {
      twin.attach = { role: 'base', slots: cls.slots };
    } else if (cls.role === 'attach') {
      const dims = twin.physical?.dimensions_mm;
      twin.attach = {
        role: 'attach',
        accepts_slot_type: cls.accepts_slot_type,
        footprint_mm: dims && dims.width ? dims : cls.default_mm,
        footprint_source: dims && dims.width ? 'measured' : 'category_default',
      };
    } else {
      twin.attach = { role: 'free' };
    }
    byRole[cls.role]++;
    await fs.writeFile(p, JSON.stringify(twin, null, 2) + '\n');
    annotated++;
  }

  console.log(JSON.stringify({ pattern, files: files.length, annotated, skipped_no_match, skipped_has_attach, byRole }, null, 2));
}

await main();
