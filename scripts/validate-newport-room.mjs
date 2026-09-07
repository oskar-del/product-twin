// Gate check for the Newport living-room manifest. Fails loudly; no silent fallback.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/showrooms/newport-living-room-furniture-manifest-v0.1.json'), 'utf8'));
const feed = new Map();
for (const line of fs.readFileSync(path.join(ROOT, 'data/newport/newport-catalog.jsonl'), 'utf8').split('\n')) {
  if (line.trim()) { const r = JSON.parse(line); feed.set(String(r.id), r); }
}

const errors = [];
const checks = [];
for (const p of M.placements) {
  const id = p.product_twin_id.replace('PT_NEWPORT_', '');
  const row = feed.get(id);

  const assetAbs = path.join(ROOT, p.asset.uri);
  if (!fs.existsSync(assetAbs)) { errors.push(`${p.product_twin_id}: asset missing ${p.asset.uri}`); continue; }
  const digest = crypto.createHash('sha256').update(fs.readFileSync(assetAbs)).digest('hex');
  if (digest !== p.asset.sha256) errors.push(`${p.product_twin_id}: sha256 mismatch`);

  if (!row) { errors.push(`${p.product_twin_id}: no feed row for id ${id}`); continue; }
  if (p.commerce.buy_url !== row.affiliate_link) errors.push(`${p.product_twin_id}: buy_url is NOT the verbatim feed affiliate_link`);
  if (!/at\.newport\.se/.test(p.commerce.buy_url)) errors.push(`${p.product_twin_id}: buy_url is not an Adtraction-tracked newport link`);
  if (!/as=2106320328/.test(p.commerce.buy_url)) errors.push(`${p.product_twin_id}: buy_url missing publisher id as=2106320328`);
  if (/ikea\.com/i.test(JSON.stringify(p))) errors.push(`${p.product_twin_id}: IKEA reference still present`);

  checks.push({ twin: p.product_twin_id, name: row.title, sek: p.commerce.unit_price, tracked: true, asset_ok: true });
}

// the whole point of the redirect: zero IKEA anywhere in the manifest
if (/PT_IKEA_|ikea\.com/i.test(JSON.stringify(M))) errors.push('manifest still contains IKEA inventory');

const result = {
  manifest: M.furniture_manifest_id,
  placements: M.placements.length,
  unfilled_roles: M.unfilled_roles.map(r => r.role),
  total_sek: M.placements.reduce((s, p) => s + (p.commerce.unit_price || 0), 0),
  checks,
  errors,
  status: errors.length ? 'FAIL' : 'PASS',
};
console.log(JSON.stringify(result, null, 2));
process.exit(errors.length ? 1 : 0);
