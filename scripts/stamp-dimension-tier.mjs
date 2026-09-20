// Stamps physical.dimensions_tier on EVERY twin, per Brain's ruling 2026-09-20.
// A single machine-readable enum so no consumer has to parse dimensions_source
// strings to learn how much of an envelope is real:
//
//   SOURCE                - all three axes stated by the source text, or a
//                           verified measured envelope. Safe to quote.
//   WD_SOURCE_H_DEFAULT   - W/D from source, height from the category table.
//                           INDICATIVE: never quote the height as a product fact.
//   ALL_DEFAULT           - every axis invented by the universal proxy builder.
//                           INDICATIVE and WEAKER than WD_SOURCE_H_DEFAULT; the
//                           room compiler must not choose one of these while a
//                           source-stated candidate exists for the same role.
//   NONE                  - no usable envelope. Not placeable.
//
// Selection order for the room compiler: SOURCE > WD_SOURCE_H_DEFAULT > ALL_DEFAULT.
// Usage: node scripts/stamp-dimension-tier.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WRITE = process.argv.includes('--write');
const DIR = path.join(ROOT, 'data/twins');

const counts = {};
let scanned = 0;

for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.json')) continue;
  scanned++;
  const p = path.join(DIR, f);
  const twin = JSON.parse(fs.readFileSync(p, 'utf8'));
  const ph = twin.physical || {};
  const dm = ph.dimensions_mm || {};
  const axes = ph.dimensions_axes || '';
  const full = dm.width && dm.depth && dm.height;

  let tier;
  if (!full) tier = 'NONE';
  else if (axes === 'WD+H_DEFAULT') tier = 'WD_SOURCE_H_DEFAULT';
  else if (axes === 'WDH_DEFAULT') tier = 'ALL_DEFAULT';
  else tier = 'SOURCE';

  counts[tier] = (counts[tier] || 0) + 1;

  if (WRITE && ph.dimensions_tier !== tier) {
    twin.physical = { ...ph, dimensions_tier: tier };
    fs.writeFileSync(p, JSON.stringify(twin, null, 2) + '\n');
  }
}

console.log(JSON.stringify({ write: WRITE, scanned, counts }, null, 2));
