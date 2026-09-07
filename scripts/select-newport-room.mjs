// Picks Newport substitutes for each placement role in the room-alpha living room,
// matching on category + closest real dimensions to the original piece. Zero-LLM,
// deterministic. Only twins with a G2 proxy ON DISK and a channel-tracked
// affiliate_link are eligible. Emits data/showrooms/newport-room-picks-v0.1.json
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TWINS = path.join(ROOT, 'data/twins');

// role -> { categories (in preference order), target dims of the original piece }
const ROLES = {
  LR_SOFA_01:        { cats: ['FFE.SEATING.SOFA'],       target: [2280, 950, 830] },
  LR_ARMCHAIR_01:    { cats: ['FFE.SEATING.ARMCHAIR'],   target: [680, 820, 1000] },
  LR_COFFEE_TABLE_01:{ cats: ['FFE.TABLE.COFFEE'],       target: [1400, 600, 370] },
  LR_RUG_01:         { cats: ['FFE.TEXTILES.RUG'],       target: [1330, 1950, 13] },
  LR_SIDE_TABLE_01:  { cats: ['FFE.TABLE.SIDE'],         target: [450, 450, 530] },
  LR_FLOOR_LAMP_01:  { cats: ['ELECTRICAL.LUMINAIRES.FLOOR'], target: [620, 620, 1510] },
  LR_MEDIA_UNIT_01:  { cats: ['FFE.STORAGE.TV_BENCH', 'FFE.STORAGE.DRESSER', 'FFE.STORAGE'], target: [1800, 420, 380] },
  LR_BOOKCASE_01:    { cats: ['FFE.STORAGE.BOOKCASE', 'FFE.STORAGE.SHELVING', 'FFE.STORAGE'], target: [800, 280, 2020] },
};

// affiliate links come from the raw feed, keyed by article id
const feed = new Map();
for (const line of fs.readFileSync(path.join(ROOT, 'data/newport/newport-catalog.jsonl'), 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const r = JSON.parse(line);
  feed.set(String(r.id), r);
}

const candidates = [];
for (const f of fs.readdirSync(TWINS)) {
  if (!f.startsWith('PT_NEWPORT_') || !f.endsWith('.json')) continue;
  const t = JSON.parse(fs.readFileSync(path.join(TWINS, f), 'utf8'));
  const g = t.geometry || {};
  if (g.level !== 'G2' || !g.asset_path || !fs.existsSync(path.join(ROOT, g.asset_path))) continue;
  const dm = t.physical?.dimensions_mm;
  if (!dm?.width || !dm?.depth || !dm?.height) continue;
  const aff = t.commerce?.affiliate_link;
  if (!aff) continue;
  candidates.push({ twin: t, dims: [dm.width, dm.depth, dm.height], asset: g.asset_path });
}

const picks = {};
const report = [];
for (const [role, spec] of Object.entries(ROLES)) {
  let best = null;
  for (const catPref of spec.cats) {           // honour category preference order
    const pool = candidates.filter(c => c.twin.category_id === catPref);
    if (!pool.length) continue;
    for (const c of pool) {
      // relative dimensional distance, so big and small pieces compare fairly
      const d = c.dims.reduce((s, v, i) => s + Math.abs(v - spec.target[i]) / spec.target[i], 0);
      if (!best || d < best.dist) best = { ...c, dist: d, matched_cat: catPref };
    }
    if (best) break;                            // first category that yields anything wins
  }
  if (!best) { report.push({ role, status: 'NO_CANDIDATE', reason: `no Newport twin with G2 proxy + dims + affiliate_link in ${spec.cats.join('/')}` }); continue; }
  // Reject absurd substitutes: a summed relative dimensional error above this means the
  // pool has nothing of the right SHAPE for the role (e.g. a coat hanger for a bookcase).
  // Better an honest unfilled role than a nonsense piece in a client-facing room.
  const MAX_FIT_DISTANCE = 0.9;
  if (best.dist > MAX_FIT_DISTANCE) {
    report.push({ role, status: 'REJECTED_POOR_FIT', best_candidate: best.twin.identity.name, twin_id: best.twin.twin_id, fit: Number(best.dist.toFixed(3)), threshold: MAX_FIT_DISTANCE, reason: 'closest Newport piece is dimensionally wrong for this role' });
    continue;
  }
  const raw = feed.get(String(best.twin.identity.article_no));
  picks[role] = {
    twin_id: best.twin.twin_id,
    name: best.twin.identity.name,
    brand: best.twin.identity.manufacturer,
    category_id: best.twin.category_id,
    matched_category: best.matched_cat,
    dims_mm: { width: best.dims[0], depth: best.dims[1], height: best.dims[2] },
    target_dims_mm: { width: spec.target[0], depth: spec.target[1], height: spec.target[2] },
    fit_distance: Number(best.dist.toFixed(4)),
    asset_path: best.asset,
    price_sek: best.twin.commerce.unit_price,
    affiliate_link: best.twin.commerce.affiliate_link,
    affiliate_link_matches_feed: raw ? raw.affiliate_link === best.twin.commerce.affiliate_link : null,
    color: raw?.color || null,
    material: raw?.material || null,
  };
  report.push({ role, status: 'OK', twin_id: best.twin.twin_id, name: best.twin.identity.name, fit: Number(best.dist.toFixed(3)) });
}

const out = {
  schema_version: '0.1.0',
  generated_at: new Date().toISOString(),
  note: 'Newport substitutes for the room-alpha living room. Channel-tracked affiliate_link taken verbatim from the twin (cross-checked against the raw feed row). Only twins with a G2 proxy on disk and real dimensions are eligible.',
  eligible_pool: candidates.length,
  picks,
  unfilled_roles: report.filter(r => r.status !== 'OK'),
};
fs.mkdirSync(path.join(ROOT, 'data/showrooms'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data/showrooms/newport-room-picks-v0.1.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ eligible_pool: candidates.length, filled: Object.keys(picks).length, roles: report }, null, 2));
