// Clears geometry blocks whose asset_path no longer exists on disk.
//
// Cause: the item-3 hero rebuild deleted every *lampemesteren*/*kungsangen*
// -g2-proxy.glb and regenerated only the newly-selected 20 per catalog. Twins
// picked by the EARLIER selection kept a geometry block pointing at a file that
// had been removed -- so they advertised G2 geometry a consumer cannot load.
// Usage: node scripts/fix-dangling-geometry.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WRITE = process.argv.includes('--write');
const idx = fs.readFileSync(path.join(ROOT, '.runtime/twin-index.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map(JSON.parse);

const cleared = [];
for (const r of idx) {
  if (!r.asset || fs.existsSync(path.join(ROOT, r.asset))) continue;
  const p = path.join(ROOT, 'data/twins', r.id + '.json');
  const twin = JSON.parse(fs.readFileSync(p, 'utf8'));
  cleared.push({ id: r.id, was: twin.geometry?.asset_path });
  if (WRITE) {
    twin.geometry = {
      level: 'G0',
      state: 'catalog_only',
      note: 'previous G2 proxy asset was removed by the 2026-09-20 hero rebuild; geometry cleared rather than left dangling',
    };
    if (twin.readiness) twin.readiness.geometry = 'G0_catalog_only';
    fs.writeFileSync(p, JSON.stringify(twin, null, 2) + '\n');
  }
}
console.log(JSON.stringify({ write: WRITE, cleared: cleared.length, ids: cleared.map(c => c.id) }, null, 2));
