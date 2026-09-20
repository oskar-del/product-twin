// Targeted rebuild of proxies that use the cylinder shape (LUMINAIRES / BULBS).
// Their flat caps were wound against their declared normals and rendered black.
// Only regenerates twins that ALREADY have a committed proxy -- no new geometry,
// no scope creep into the 56k twins that gained dimensions in item 1.
// Usage: node scripts/rebuild-cylinder-proxies.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildGlb, spineMaterial, shapeForCategory, quaternionFromEuler } from './build-all-proxies.mjs';

const ROOT = process.cwd();
const WRITE = process.argv.includes('--write');
const rows = fs.readFileSync(path.join(ROOT, '.runtime/twin-index.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map(JSON.parse)
  .filter(r => r.asset && r.cat && shapeForCategory(r.cat) === 'cylinder');

let rebuilt = 0, missing = 0;
for (const r of rows) {
  const abs = path.join(ROOT, r.asset);
  if (!fs.existsSync(abs)) { missing++; continue; }
  const twinPath = path.join(ROOT, 'data/twins', r.id + '.json');
  const twin = JSON.parse(fs.readFileSync(twinPath, 'utf8'));
  const dims = twin.physical?.dimensions_mm;
  if (!dims?.width || !dims?.height) { missing++; continue; }
  const w = dims.width / 1000, h = dims.height / 1000, d = (dims.depth || dims.width) / 1000;
  const glb = buildGlb([{ name: 'proxy_body', geo: 'cylinder', scale: [w, h, d],
                          translation: [0, h / 2, 0], rotation: quaternionFromEuler(0, 0, 0) }],
                       spineMaterial(r.cat));
  if (WRITE) {
    fs.writeFileSync(abs, glb);
    const sha = crypto.createHash('sha256').update(glb).digest('hex');
    if (twin.geometry) { twin.geometry.sha256 = sha; twin.geometry.rebuilt_reason = 'cylinder cap winding fix 2026-09-20'; }
    fs.writeFileSync(twinPath, JSON.stringify(twin, null, 2) + '\n');
  }
  rebuilt++;
}
console.log(JSON.stringify({ write: WRITE, rebuilt, skipped_missing_asset_or_dims: missing, candidates: rows.length }));
