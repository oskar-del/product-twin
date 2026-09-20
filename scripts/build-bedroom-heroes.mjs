// Bedroom hero proxies: Kungsangen beds (top 20) + Lampemesteren pendants/table
// lamps (top 20), so Platform can compose room look #3 from a second catalog.
//
// Honesty contract:
//  * Footprint (W x D) is REAL -- parsed from the merchant title ("Sang ... 180x200").
//  * Height is NOT stated by these feeds. The proxy needs one, so a documented
//    CATEGORY-DEFAULT height is used for GEOMETRY ONLY. The twin's
//    physical.dimensions_mm.height stays null -- we never write a guess back into
//    the measured record. The assumption is recorded in geometry.scale_state and
//    geometry.height_source.
// Usage: node scripts/build-bedroom-heroes.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildGlb, spineMaterial, quaternionFromEuler } from './build-all-proxies.mjs';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'data/geometry/avatars');
const WRITE = process.argv.includes('--write');

// Category-default heights (mm). Documented assumptions, not measurements.
const DEFAULT_H = {
  'FFE.BEDROOM.BED_FRAME': 600,               // Swedish continental bed, base + mattress top
  'ELECTRICAL.LUMINAIRES.PENDANT': 300,       // shade body height; drop wire not modelled
  'ELECTRICAL.LUMINAIRES.TABLE': 420,
};
// Standard double-bed footprint we score "fit" against, for a bedroom hero shot.
const BED_TARGET = [1600, 2000];

const rows = fs.readFileSync(path.join(ROOT, '.runtime/twin-index.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map(JSON.parse);

// Model family = name with the size token and trailing variant words stripped, so
// we pick 20 DIFFERENT beds rather than 20 sizes of the same one.
const family = (n) => (n || '').replace(/\d+\s*[x×]\s*\d+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 2).join(' ').toLowerCase();

function pick(src, cats, n, scorer, extra = () => true) {
  const pool = rows.filter(r => r.src === src && cats.includes(r.cat) && r.w && r.d && extra(r));
  const seen = new Set(); const out = [];
  for (const r of pool.sort(scorer)) {
    const f = family(r.name);
    if (seen.has(f)) continue;
    seen.add(f); out.push(r);
    if (out.length >= n) break;
  }
  return out;
}

const beds = pick('kungsangen', ['FFE.BEDROOM.BED_FRAME'], 20,
  (a, b) => (Math.abs(a.w - BED_TARGET[0]) + Math.abs(a.d - BED_TARGET[1]))
          - (Math.abs(b.w - BED_TARGET[0]) + Math.abs(b.d - BED_TARGET[1])));

// Lamps: prefer the largest real footprint (a hero piece reads in a render).
const MAX_LUMINAIRE_MM = 1200;   // a pendant wider than 1.2 m is a parse error here
const lamps = pick('lampemesteren',
  ['ELECTRICAL.LUMINAIRES.PENDANT', 'ELECTRICAL.LUMINAIRES.TABLE'], 20,
  (a, b) => (b.w * b.d) - (a.w * a.d),
  (r) => /diameter/.test(String(r.dsrc || '')) && r.w <= MAX_LUMINAIRE_MM);

function makeProxy(r) {
  const h = DEFAULT_H[r.cat];
  const w = r.w / 1000, d = r.d / 1000, hh = h / 1000;
  const mat = spineMaterial(r.cat);
  const parts = [];

  if (r.cat === 'FFE.BEDROOM.BED_FRAME') {
    // mattress slab on a slightly inset base
    const baseH = hh * 0.62, matH = hh - baseH;
    parts.push({ name: 'bed_base', geo: 'box', scale: [w * 0.97, baseH, d * 0.99],
                 translation: [0, baseH / 2, 0], rotation: quaternionFromEuler(0,0,0) });
    parts.push({ name: 'mattress', geo: 'soft', scale: [w, matH, d],
                 translation: [0, baseH + matH / 2, 0], rotation: quaternionFromEuler(0,0,0) });
  } else if (r.cat === 'ELECTRICAL.LUMINAIRES.PENDANT') {
    parts.push({ name: 'shade', geo: 'cylinder', scale: [w, hh, d],
                 translation: [0, hh / 2, 0], rotation: quaternionFromEuler(0,0,0) });
  } else {
    const baseH = hh * 0.08, shadeH = hh * 0.45, stemH = hh - baseH - shadeH;
    parts.push({ name: 'base', geo: 'cylinder', scale: [w * 0.55, baseH, d * 0.55],
                 translation: [0, baseH / 2, 0], rotation: quaternionFromEuler(0,0,0) });
    parts.push({ name: 'stem', geo: 'cylinder', scale: [w * 0.08, stemH, d * 0.08],
                 translation: [0, baseH + stemH / 2, 0], rotation: quaternionFromEuler(0,0,0) });
    parts.push({ name: 'shade', geo: 'cylinder', scale: [w, shadeH, d],
                 translation: [0, baseH + stemH + shadeH / 2, 0], rotation: quaternionFromEuler(0,0,0) });
  }
  return { glb: buildGlb(parts, mat), h };
}

const made = [];
for (const r of [...beds, ...lamps]) {
  const { glb, h } = makeProxy(r);
  const slug = r.id.replace('PT_', '').toLowerCase().replace(/_/g, '-');
  const file = `${slug}-g2-proxy.glb`;
  const sha = crypto.createHash('sha256').update(glb).digest('hex');
  if (WRITE) {
    fs.writeFileSync(path.join(OUT, file), glb);
    const p = path.join(ROOT, 'data/twins', `${r.id}.json`);
    const twin = JSON.parse(fs.readFileSync(p, 'utf8'));
    twin.geometry = {
      level: 'G2',
      state: 'promoted_hero_proxy',
      avatar_id: `AVATAR_${r.id.replace('PT_', '')}_G2_PROXY`,
      asset_path: `data/geometry/avatars/${file}`,
      sha256: sha,
      scale_state: `footprint ${r.w}x${r.d}mm from title; height ${h}mm CATEGORY DEFAULT`,
      height_source: 'category_default',
      footprint_source: twin.physical?.dimensions_source || 'title_regex',
      shape_claim: 'category-default proxy; not manufacturer geometry',
      rights: { geometry_owner: 'Product Twin universal proxy', manufacturer_geometry_copied: false, manufacturer_texture_artwork_copied: false },
    };
    if (twin.readiness) twin.readiness.geometry = 'G2_promoted_hero_proxy';
    fs.writeFileSync(p, JSON.stringify(twin, null, 2) + '\n');
  }
  made.push({ id: r.id, name: r.name, cat: r.cat, w: r.w, d: r.d, h_default: h, file, bytes: glb.length });
}

fs.writeFileSync(path.join(ROOT, '.runtime/bedroom-heroes.json'), JSON.stringify(made, null, 2) + '\n');
console.log(JSON.stringify({ write: WRITE, beds: beds.length, lamps: lamps.length, total: made.length,
  bytes: made.reduce((s, m) => s + m.bytes, 0) }, null, 2));
