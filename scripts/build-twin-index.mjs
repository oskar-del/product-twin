// One pass over data/twins -> a compact JSONL index in .runtime/ so every later
// analysis is a cheap stream instead of 225k file opens. Never committed.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'data/twins');
const OUT = path.join(ROOT, '.runtime/twin-index.jsonl');

const names = fs.readdirSync(DIR);
const out = fs.createWriteStream(OUT);
let n = 0;
for (const f of names) {
  if (!f.endsWith('.json')) continue;
  let t;
  try { t = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch { continue; }
  const dm = t.physical?.dimensions_mm || null;
  out.write(JSON.stringify({
    id: t.twin_id,
    src: (t.identity?.source || '').replace(/_adtraction.*/, ''),
    art: t.identity?.article_no ?? null,
    name: t.identity?.name ?? '',
    cat: t.category_id ?? null,
    bucket: t.bucket ?? null,
    w: dm?.width ?? null, d: dm?.depth ?? null, h: dm?.height ?? null,
    dsrc: t.physical?.dimensions_source ?? null,
    glvl: t.geometry?.level ?? null,
    asset: t.geometry?.asset_path ?? null,
    role: t.attach?.role ?? null,
  }) + '\n');
  n++;
}
out.end();
console.log(JSON.stringify({ indexed: n, out: '.runtime/twin-index.jsonl' }));
