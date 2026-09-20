// Stamps material_cues on twins from the merchant feed's OWN color/material fields.
// Evidence class REPORTED: these are the merchant's stated values, copied verbatim,
// never inferred. Feeds that ship no colour (kungsangen, golvpoolen, gripsholm) get
// nothing rather than a guess.
// Usage: node scripts/stamp-material-cues.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WRITE = process.argv.includes('--write');
const CATALOGS = {
  newport: 'data/newport/newport-catalog.jsonl',
  mjuk: 'data/mjuk/mjuk-catalog.jsonl',
  lampemesteren: 'data/lampemesteren/lampemesteren-catalog.jsonl',
  lampan: 'data/lampan/lampan-catalog.jsonl',
  'vidaxl-outdoor': 'data/vidaxl-outdoor/vidaxl-outdoor-catalog.jsonl',
  kungsangen: 'data/kungsangen/kungsangen-catalog.jsonl',
  golvpoolen: 'data/golvpoolen/golvpoolen-catalog.jsonl',
  gripsholm: 'data/gripsholm/gripsholm-catalog.jsonl',
};

const rows = fs.readFileSync(path.join(ROOT, '.runtime/twin-index.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map(JSON.parse);
const byCatalog = new Map();
for (const r of rows) { if (!byCatalog.has(r.src)) byCatalog.set(r.src, []); byCatalog.get(r.src).push(r); }

const report = {};
for (const [cat, file] of Object.entries(CATALOGS)) {
  const list = byCatalog.get(cat) || [];
  const feed = new Map();
  for (const line of fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n')) {
    if (line.trim()) { const r = JSON.parse(line); feed.set(String(r.id).replace(/[^A-Za-z0-9_.-]/g, '-'), r); }
  }
  const st = { twins: list.length, colour: 0, material: 0, both: 0, none: 0 };
  for (const r of list) {
    const raw = feed.get(String(r.art).replace(/[^A-Za-z0-9_.-]/g, '-'));
    const colour = (raw?.color || '').trim() || null;
    const material = (raw?.material || '').trim() || null;
    if (!colour && !material) { st.none++; continue; }
    if (colour) st.colour++;
    if (material) st.material++;
    if (colour && material) st.both++;
    if (WRITE) {
      const p = path.join(ROOT, 'data/twins', `${r.id}.json`);
      const twin = JSON.parse(fs.readFileSync(p, 'utf8'));
      twin.material_cues = {
        colour_text: colour, material_text: material,
        evidence_class: 'REPORTED',
        source: `${cat}_feed`,
        limitation: 'Merchant-stated colour/material text. No swatch, hex or finish code is published, so renders map the colour NAME to a documented palette entry.',
      };
      fs.writeFileSync(p, JSON.stringify(twin, null, 2) + '\n');
    }
  }
  report[cat] = st;
}
console.log(JSON.stringify(report, null, 2));
