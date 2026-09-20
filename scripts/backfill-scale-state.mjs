// Rewrites geometry.scale_state / shape_claim on EXISTING twins from their
// dimensions_tier, so the misleading strings already on disk are corrected rather
// than merely avoided in future writes. Uses the same helper as the proxy builders.
// Usage: node scripts/backfill-scale-state.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';
import { scaleStateFor } from './scale-state-lib.mjs';

const ROOT = process.cwd();
const WRITE = process.argv.includes('--write');
const DIR = path.join(ROOT, 'data/twins');

const before = {}, after = {};
let changed = 0, withGeom = 0;

// Only twins that actually carry geometry can have a scale_state, and the index
// already knows which those are -- scanning all 225k files for ~3.9k hits was the
// difference between seconds and a timeout.
const targets = fs.readFileSync(path.join(ROOT, '.runtime/twin-index.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map(JSON.parse).filter(r => r.asset).map(r => r.id + '.json');

for (const f of targets) {
  const p = path.join(DIR, f);
  if (!fs.existsSync(p)) continue;
  const twin = JSON.parse(fs.readFileSync(p, 'utf8'));
  const g = twin.geometry;
  if (!g || !g.scale_state) continue;
  withGeom++;

  const key = String(g.scale_state).split(' ')[0];
  before[key] = (before[key] || 0) + 1;

  const dm = twin.physical?.dimensions_mm || {};
  // Prefer the dimensions actually recorded; fall back to the numbers embedded in
  // the old string only if the twin has none (shouldn't happen for proxied twins).
  const nums = String(g.scale_state).match(/(\d+)x(\d+)x(\d+)mm/);
  const w = dm.width ?? (nums && +nums[1]);
  const d = dm.depth ?? (nums && +nums[2]);
  const h = dm.height ?? (nums && +nums[3]);
  if (!w || !d || !h) continue;

  const next = scaleStateFor(twin, w, d, h);
  after[String(next.scale_state).split(' ')[0]] = (after[String(next.scale_state).split(' ')[0]] || 0) + 1;

  if (g.scale_state !== next.scale_state || g.shape_claim !== next.shape_claim) {
    changed++;
    if (WRITE) {
      twin.geometry = { ...g, ...next };
      delete twin.geometry.scale_state_note;   // superseded: the string is now truthful
      fs.writeFileSync(p, JSON.stringify(twin, null, 2) + '\n');
    }
  }
}

console.log(JSON.stringify({ write: WRITE, twins_with_geometry: withGeom, changed, before, after }, null, 2));
