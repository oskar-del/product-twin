// Re-derives dimensions_tier for twins currently stamped ALL_DEFAULT, by re-reading
// the MERCHANT TITLE instead of trusting geometry.scale_state.
//
// Why this is needed (Platform raised the disagreement, 2026-09-21):
// build-newport-proxies.mjs parses dimensions out of the title and overrides the
// category defaults with them (lines 217-221) -- but then writes
// `scale_state: "category_default ..."` UNCONDITIONALLY, whether the numbers came
// from the merchant's own title or from CATEGORY_DEFAULTS. scale_state is therefore
// not a provenance record, and the backfill in e5816844 trusted it. Compounding it,
// extract-dimensions.mjs skips any twin that already has all three axes, so those
// twins' titles were never examined at all.
//
// A twin is re-stamped only when the title's numbers MATCH the stored dimensions --
// that match is the evidence the stored value came from the title, not a default.
// Usage: node scripts/reconcile-dimension-tier.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WRITE = process.argv.includes('--write');
const DIR = path.join(ROOT, 'data/twins');

// Same shape as build-newport-proxies.parseDimsFromDesc, which is what actually
// produced these numbers.
function parseTitle(text) {
  if (!text) return null;
  const m = String(text).match(/(\d{2,4})\s*[x×X]\s*(\d{2,4})(?:\s*[x×X]\s*(\d{2,4}))?\s*(cm|mm)?/i);
  if (!m) return null;
  const scale = (m[4] || 'cm').toLowerCase() === 'mm' ? 1 : 10;
  return {
    width: parseInt(m[1]) * scale,
    depth: parseInt(m[2]) * scale,
    height: m[3] ? parseInt(m[3]) * scale : null,
  };
}

const stats = { scanned: 0, all_default: 0, to_source: 0, to_wd_source_h_default: 0, stays_all_default: 0, by_catalog: {} };
const examples = [];

for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.json')) continue;
  stats.scanned++;
  const p = path.join(DIR, f);
  const twin = JSON.parse(fs.readFileSync(p, 'utf8'));
  const ph = twin.physical || {};
  if (ph.dimensions_tier !== 'ALL_DEFAULT') continue;
  stats.all_default++;

  const dm = ph.dimensions_mm || {};
  const parsed = parseTitle(twin.identity?.name);
  const cat = (twin.identity?.source || '').replace(/_adtraction.*/, '') || 'unknown';
  const bucket = (stats.by_catalog[cat] ??= { all_default: 0, to_source: 0, to_wd: 0, stays: 0 });
  bucket.all_default++;

  // The title's numbers must MATCH what is stored, otherwise the stored value did
  // not come from the title and remains a default.
  const wdMatch = parsed && parsed.width === dm.width && parsed.depth === dm.depth;
  const hMatch = wdMatch && parsed.height && parsed.height === dm.height;

  let tier = null;
  if (hMatch) { tier = 'SOURCE'; stats.to_source++; bucket.to_source++; }
  else if (wdMatch) { tier = 'WD_SOURCE_H_DEFAULT'; stats.to_wd_source_h_default++; bucket.to_wd++; }
  else { stats.stays_all_default++; bucket.stays++; continue; }

  if (examples.length < 6) examples.push({ id: twin.twin_id, name: (twin.identity?.name || '').slice(0, 52), from: 'ALL_DEFAULT', to: tier, dims: dm });

  if (WRITE) {
    twin.physical.dimensions_tier = tier;
    twin.physical.dimensions_axes = tier === 'SOURCE' ? 'WDH' : 'WD+H_DEFAULT';
    twin.physical.dimensions_source = tier === 'SOURCE'
      ? 'title_regex:triple_wdh (reconciled 2026-09-21)'
      : 'title_regex:double_wd + proxy_category_default_height (reconciled 2026-09-21)';
    twin.physical.dimensions_indicative = tier !== 'SOURCE';
    if (twin.geometry) {
      twin.geometry.scale_state_note = 'scale_state says "category_default" but these numbers came from the merchant title; see scripts/reconcile-dimension-tier.mjs';
    }
    fs.writeFileSync(p, JSON.stringify(twin, null, 2) + '\n');
  }
}

fs.writeFileSync(path.join(ROOT, '.runtime/tier-reconcile-report.json'), JSON.stringify({ stats, examples }, null, 2) + '\n');
console.log(JSON.stringify({ write: WRITE, ...stats }, null, 2));
console.log('examples:'); for (const e of examples) console.log(' ', e.from, '->', e.to, '|', e.name, '|', JSON.stringify(e.dims));
