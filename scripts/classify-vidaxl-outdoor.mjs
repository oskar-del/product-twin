// Classify vidaxl-outdoor twins from their title text.
// The vidaxl feed ships no usable category field: all 88k twins land as
// CATALOG_ONLY, which forces every proxy to the _default envelope. Titles,
// however, are descriptive Swedish AND usually carry real dimensions
// ("150x90x74 cm"), so a deterministic keyword pass recovers both.
//
// Usage: node scripts/classify-vidaxl-outdoor.mjs [--write] [--only 362241,340789]
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TWINS_DIR = path.join(ROOT, 'data/twins');
const WRITE = process.argv.includes('--write');
function argVal(f, d) { const i = process.argv.indexOf(f); return i !== -1 && process.argv[i+1] ? process.argv[i+1] : d; }
const ONLY = new Set((argVal('--only','')||'').split(',').map(s=>s.trim()).filter(Boolean));

// Ordered: first match wins, so specific patterns precede generic ones.
//
// Two traps this list is written around, both found by spot-checking output:
//  1. "med dynor" (= "with cushions") is a DESCRIPTOR on furniture, not the
//     product. A naive /dynor/ rule filed 26,889 lounge sets as cushions. The
//     cushion rule therefore runs last AND is guarded by NOT_CUSHION below.
//  2. "markis" is an awning, not a parasol — different envelope entirely.
const RULES = [
  ['FFE.OUTDOOR.SET',       /trädgårdsoffset|soffset|loungegrupp|soffgrupp|matgrupp|utomhussoffset|loungeset|matset|bistroset|bistrogrupp/i],
  ['FFE.OUTDOOR.SHADE',     /markis|paviljong|partytält|solsegel|pergola/i],
  ['FFE.OUTDOOR.PARASOL',   /parasollfot|viktplatta för parasoll/i],
  ['FFE.OUTDOOR.PARASOL',   /parasoll/i],
  ['FFE.OUTDOOR.LOUNGER',   /solsäng|solstol|däckstol|hängmatta/i],
  ['FFE.OUTDOOR.SOFA',      /trädgårdssoffa|loungesoffa|utesoffa|hörnsoffa|mittensoffa|mittensoffor/i],
  ['FFE.OUTDOOR.BENCH',     /trädgårdsbänk|gungbank|bänk\b/i],
  ['FFE.OUTDOOR.CHAIR',     /trädgårdsstol|utestol|matstol|gungstol|pall\b|fåtölj/i],
  ['FFE.OUTDOOR.TABLE',     /trädgårdsbord|utebord|soffbord|matbord|sidobord|bord\b/i],
  ['FFE.TEXTILES.RUG',      /utomhusmatta|utematta|matta\b/i],
  ['FFE.OUTDOOR.PLANTER',   /odlingslåda|blomlåda|kruka|planteringskärl|spaljé/i],
  ['FFE.OUTDOOR.STORAGE',   /förvaringsbox|dynbox|redskapsbod|skjul/i],
  ['ELECTRICAL.LUMINAIRES.OUTDOOR', /utomhusbelysning|marklampa|solcellslamp|vägglykta|lykta/i],
  ['FFE.OUTDOOR.CUSHION',   /\b(dyna|dynor|sittdyna|kudde|kuddar)\b/i],
  ['FFE.OUTDOOR',           /trädgård|utomhus|balkong|altan/i],
];

// A title that names a piece of furniture is that furniture, however many
// cushions come with it. Guards the CUSHION rule only.
const NOT_CUSHION = /soffa|stol|bord|bänk|säng|grupp|set\b|parasoll|markis|solsäng|fåtölj|pall\b/i;

function classify(name) {
  for (const [cat, rx] of RULES) {
    if (!rx.test(name)) continue;
    if (cat === 'FFE.OUTDOOR.CUSHION' && NOT_CUSHION.test(name)) continue;
    return cat;
  }
  return null;
}

async function main() {
  const files = (await fs.readdir(TWINS_DIR))
    .filter(f => f.startsWith('PT_VIDAXL-OUTDOOR_') && f.endsWith('.json')).sort();
  const counts = {}; let classified = 0, unmatched = 0, skipped = 0;

  for (const file of files) {
    const p = path.join(TWINS_DIR, file);
    const twin = JSON.parse(await fs.readFile(p, 'utf8'));
    if (ONLY.size && !ONLY.has(String(twin.identity?.article_no))) { skipped++; continue; }
    if (twin.category_id && twin.category_id !== 'CATALOG_ONLY') { skipped++; continue; }

    const cat = classify(twin.identity?.name || '');
    if (!cat) { unmatched++; continue; }
    counts[cat] = (counts[cat] || 0) + 1;
    classified++;
    if (WRITE) {
      twin.category_id = cat;
      twin.classification = {
        method: 'DETERMINISTIC_TITLE_KEYWORD',
        source: 'scripts/classify-vidaxl-outdoor.mjs',
        evidence_class: 'DERIVED',
        limitation: 'Category inferred from merchant title text, not a feed taxonomy field.',
      };
      await fs.writeFile(p, JSON.stringify(twin, null, 2) + '\n');
    }
  }
  console.log(JSON.stringify({ write: WRITE, classified, unmatched, skipped, total: files.length, counts }, null, 2));
}
await main();
