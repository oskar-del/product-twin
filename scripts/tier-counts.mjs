// Per-catalog dimensions_tier counts read straight from the twins -- the twins are
// the authority, not a report file that can drift after a later correction.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd(), DIR = path.join(ROOT, 'data/twins');
const out = {};
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.json')) continue;
  const t = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const cat = (t.identity?.source || '').replace(/_adtraction.*/, '') || 'unknown';
  const tier = (t.physical || {}).dimensions_tier || 'NONE';
  const b = (out[cat] ??= { twins: 0, SOURCE: 0, WD_SOURCE_H_DEFAULT: 0, ALL_DEFAULT: 0, NONE: 0 });
  b.twins++; b[tier]++;
}
fs.writeFileSync(path.join(ROOT, '.runtime/tier-counts.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
