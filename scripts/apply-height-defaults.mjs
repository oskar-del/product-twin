// Applies config/geometry/category-height-defaults.json per Brain's maker-checker
// ruling (2026-09-20), and backfills dimensions_source on twins whose dimensions
// pre-date the source-stamping work.
//
// The three provenance tiers are kept STRICTLY separate and never summed into one
// "placeable" number:
//   WDH            - all three axes stated by the source text            (real)
//   WD+H_DEFAULT   - W/D from source, height from the category table     (indicative)
//   WDH_DEFAULT    - all three axes invented by the proxy builder        (indicative)
// Usage: node scripts/apply-height-defaults.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WRITE = process.argv.includes('--write');
const TABLE = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/geometry/category-height-defaults.json'), 'utf8'));
const DEF = TABLE.defaults_mm;

const rows = fs.readFileSync(path.join(ROOT, '.runtime/twin-index.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map(JSON.parse);

const st = {};
const bump = (src, k) => { (st[src] ??= { twins: 0, wdh: 0, wd_h_default: 0, wdh_default: 0, verified: 0, footprint_no_default: 0, stamped_source: 0 })[k]++; };

for (const r of rows) {
  const src = r.src || 'unknown';
  (st[src] ??= { twins: 0, wdh: 0, wd_h_default: 0, wdh_default: 0, verified: 0, footprint_no_default: 0, stamped_source: 0 }).twins++;

  const p = path.join(ROOT, 'data/twins', r.id + '.json');
  let twin = null, dirty = false;
  const load = () => (twin ??= JSON.parse(fs.readFileSync(p, 'utf8')));

  const hasFull = r.w && r.d && r.h;
  const footprintOnly = r.w && r.d && !r.h;

  // 1. Backfill provenance on dimensions that pre-date dimensions_source.
  if (hasFull && !r.dsrc) {
    const t = load();
    const ss = (t.geometry?.scale_state || '');
    // These are NOT measurements: the universal proxy builder wrote a per-category
    // envelope for all three axes. Labelling them "pre-existing" would hide that.
    const isDefault = ss.startsWith('category_default');
    t.physical = t.physical || {};
    t.physical.dimensions_source = isDefault ? 'proxy_build:category_default' : 'proxy_build:verified_envelope';
    t.physical.dimensions_axes = isDefault ? 'WDH_DEFAULT' : 'WDH';
    if (isDefault) t.physical.dimensions_indicative = true;
    dirty = true;
    bump(src, 'stamped_source');
    bump(src, isDefault ? 'wdh_default' : 'verified');
  } else if (hasFull) {
    bump(src, (r.dsrc || '').startsWith('proxy_build:category_default') ? 'wdh_default'
             : (r.dsrc || '').startsWith('proxy_build:verified') ? 'verified' : 'wdh');
  }

  // 2. Fill height from the category table where the source states only a footprint.
  if (footprintOnly) {
    const entry = DEF[r.cat];
    if (!entry) { bump(src, 'footprint_no_default'); }
    else {
      const t = load();
      t.physical = t.physical || {};
      t.physical.dimensions_mm = { ...(t.physical.dimensions_mm || {}), height: entry.h };
      t.physical.dimensions_source = `${t.physical.dimensions_source || 'title_regex'} + category_default:${r.cat}`;
      t.physical.dimensions_axes = 'WD+H_DEFAULT';
      t.physical.dimensions_indicative = true;
      t.physical.height_rationale = entry.why;
      dirty = true;
      bump(src, 'wd_h_default');
    }
  }

  if (dirty && WRITE) fs.writeFileSync(p, JSON.stringify(twin, null, 2) + '\n');
}

fs.writeFileSync(path.join(ROOT, '.runtime/height-defaults-report.json'), JSON.stringify(st, null, 2) + '\n');
const tot = Object.values(st).reduce((a, s) => {
  for (const k of Object.keys(s)) a[k] = (a[k] || 0) + s[k];
  return a;
}, {});
console.log(JSON.stringify({ write: WRITE, total: tot }, null, 2));
