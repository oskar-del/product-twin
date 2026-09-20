// Picks the pieces for the material-truth still: one Newport twin per DOCUMENTED
// colour word (each must own a G2 proxy), plus deliberate controls -- a
// "Flerfargad"/"Transparent" row (a colour string that names no single hue) and a
// row with no colour at all. The controls exist so the render proves we fall back
// to a flagged neutral instead of inventing a hue.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WANT = ['Vit', 'Svart', 'Beige', 'Brun', 'Guld', 'Silver', 'Grå', 'Grön', 'Blå', 'Röd'];

const rows = fs.readFileSync(path.join(ROOT, '.runtime/twin-index.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map(JSON.parse)
  .filter(r => r.src === 'newport' && r.asset && r.w && r.h);

function cues(id) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'data/twins', id + '.json'), 'utf8')).material_cues || {};
}

const chosen = [];
const used = new Set();
function take(pred, label) {
  for (const r of rows) {
    if (used.has(r.id)) continue;
    const c = cues(r.id);
    if (!pred(c)) continue;
    used.add(r.id);
    chosen.push({ id: r.id, name: r.name, cat: r.cat, asset: r.asset,
                  w: r.w, d: r.d, h: r.h, colour_text: c.colour_text ?? null,
                  material_text: c.material_text ?? null, bucket: label });
    return true;
  }
  return false;
}

for (const want of WANT) {
  take(c => (c.colour_text || '').trim().toLowerCase() === want.toLowerCase(), 'documented');
}
take(c => /flerfärgad/i.test(c.colour_text || ''), 'control_no_single_hue');
take(c => /transparent/i.test(c.colour_text || ''), 'control_no_single_hue');
take(c => !c.colour_text, 'control_undocumented');

fs.writeFileSync(path.join(ROOT, '.runtime/material-truth-set.json'), JSON.stringify(chosen, null, 2) + '\n');
console.log(JSON.stringify({ picked: chosen.length,
  documented: chosen.filter(c => c.bucket === 'documented').length,
  controls: chosen.filter(c => c.bucket !== 'documented').length }, null, 2));
for (const c of chosen) console.log(`  ${(c.colour_text || '(none)').padEnd(14)} ${c.bucket.padEnd(22)} ${c.name.slice(0, 44)}`);
