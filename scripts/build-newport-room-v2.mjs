// v0.2 of the Newport shoppable living room: prefers a REAL Meshy image-to-3D
// reconstruction where one exists for a Newport SKU, falls back to the G2 proxy
// otherwise. Fidelity is labelled per placement -- never silently mixed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const v1 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/showrooms/newport-living-room-furniture-manifest-v0.1.json'), 'utf8'));

// Newport SKUs we hold a real Meshy reconstruction for, chosen per role by dimension fit.
const MESHY_BY_ROLE = {
  LR_SOFA_01:         { id: '60667', glb: 'data/geometry/meshy-test/moderno-soffa-meshy.glb' },
  LR_ARMCHAIR_01:     { id: '54473', glb: 'data/geometry/meshy-test/54473-meshy.glb' },
  LR_COFFEE_TABLE_01: { id: '40622', glb: 'data/geometry/meshy-test/40622-meshy.glb' },
  LR_SIDE_TABLE_01:   { id: '43622', glb: 'data/geometry/meshy-test/43622-meshy.glb' },
};

const feed = new Map();
for (const line of fs.readFileSync(path.join(ROOT, 'data/newport/newport-catalog.jsonl'), 'utf8').split('\n')) {
  if (line.trim()) { const r = JSON.parse(line); feed.set(String(r.id), r); }
}
const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const placements = v1.placements.map((p) => {
  const role = p.source_placement_alias;
  const m = MESHY_BY_ROLE[role];
  if (!m) {
    return { ...p, asset: { ...p.asset, fidelity: 'G2_CATEGORY_PROXY', shape_claim: 'category-default proxy; not manufacturer geometry' } };
  }
  const twin = JSON.parse(fs.readFileSync(path.join(ROOT, `data/twins/PT_NEWPORT_${m.id}.json`), 'utf8'));
  const row = feed.get(m.id);
  const abs = path.join(ROOT, m.glb);
  const digest = sha256(abs);
  return {
    ...p,
    product_twin_id: twin.twin_id,
    asset: {
      avatar_id: `AVATAR_NEWPORT_${m.id}_MESHY`,
      uri: m.glb,
      revision: `sha256:${digest}`,
      sha256: digest,
      geometry_level: 'G2_PLUS',
      fidelity: 'MESHY_IMAGE_TO_3D_RECONSTRUCTION',
      shape_claim: 'reconstructed from the merchant product photo; approximate, not manufacturer CAD',
      appearance_level: 'A2_RECONSTRUCTED_TEXTURE',
    },
    commerce: {
      merchant: 'Newport SE', currency: 'SEK', unit_price: twin.commerce.unit_price,
      buy_url: twin.commerce.affiliate_link,
      affiliate_link_matches_feed: row ? row.affiliate_link === twin.commerce.affiliate_link : null,
      adtraction_program: { feed_id: '2175', commission_pct: 9 },
    },
    material_cues: { color: row?.color ?? null, material: row?.material ?? null, source: 'newport_adtraction_feed_2175' },
    fit: { target_dims_mm: p.fit.target_dims_mm, actual_dims_mm: twin.physical.dimensions_mm },
    rights: p.rights,
  };
});

const manifest = {
  ...v1,
  furniture_manifest_id: 'FURNITURE_MANIFEST_LIVING_ROOM_NEWPORT_V0_2',
  revision: '0.2.0',
  supersedes: 'FURNITURE_MANIFEST_LIVING_ROOM_NEWPORT_V0_1 (all-G2-proxy geometry)',
  fidelity_mix: {
    meshy_reconstruction: placements.filter(p => p.asset.fidelity?.startsWith('MESHY')).length,
    g2_category_proxy: placements.filter(p => p.asset.fidelity === 'G2_CATEGORY_PROXY').length,
  },
  placements,
};
fs.writeFileSync(path.join(ROOT, 'data/showrooms/newport-living-room-furniture-manifest-v0.2.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({
  placements: placements.length,
  fidelity_mix: manifest.fidelity_mix,
  total_sek: placements.reduce((s, p) => s + (p.commerce.unit_price || 0), 0),
  all_links_verbatim: placements.every(p => p.commerce.affiliate_link_matches_feed === true),
}, null, 2));
