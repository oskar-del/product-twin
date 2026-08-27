// Rebuild avatar-index.json with derived counts from data/twins/.
// Usage: node scripts/rebuild-avatar-index.mjs
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TWINS_DIR = path.join(ROOT, 'data/twins');
const INDEX_PATH = path.join(ROOT, 'data/geometry/avatar-index.json');

async function main() {
  const existing = JSON.parse(await fs.readFile(INDEX_PATH, 'utf8'));
  const files = (await fs.readdir(TWINS_DIR)).filter(f => f.endsWith('.json')).sort();

  const levels = { G0: 0, G1: 0, G2: 0, G3: 0, G4: 0, G5: 0 };
  const states = {};
  const categories = {};
  let hasCommerce = 0, hasEan = 0, hasAffiliate = 0;

  for (const file of files) {
    const twin = JSON.parse(await fs.readFile(path.join(TWINS_DIR, file), 'utf8'));
    const level = twin.geometry?.level || 'G0';
    levels[level] = (levels[level] || 0) + 1;
    const state = twin.geometry?.state || 'none';
    states[state] = (states[state] || 0) + 1;
    const cat = (twin.category_id || 'unknown').split('.').slice(0, 2).join('.');
    categories[cat] = (categories[cat] || 0) + 1;
    if (twin.commerce) hasCommerce++;
    if (twin.commerce?.ean) hasEan++;
    if (twin.commerce?.affiliate_link) hasAffiliate++;
  }

  existing.generated_at = new Date().toISOString().slice(0, 10);
  existing.summary = {
    total_twins: files.length,
    ...levels,
    geometry_states: states,
    categories,
    commerce_coverage: { has_commerce: hasCommerce, has_ean: hasEan, has_affiliate_link: hasAffiliate },
    note: 'counts derived from data/twins/ by scripts/rebuild-avatar-index.mjs',
  };

  await fs.writeFile(INDEX_PATH, JSON.stringify(existing, null, 2) + '\n');
  console.log(JSON.stringify(existing.summary, null, 2));
}

await main();
