// Rebuilds the room-alpha living-room furniture manifest from Newport affiliate
// inventory, preserving Platform's original placements/transforms verbatim.
// BUY = the twin's channel-tracked affiliate_link, copied verbatim from the feed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const picksDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/showrooms/newport-room-picks-v0.1.json'), 'utf8'));

// Platform's original transforms, kept byte-for-byte (placement_changes_allowed: false)
const TRANSFORMS = {
  LR_SOFA_01:         { translation_m: [0, 0, -1.78],     rotation_y_rad: 3.141592653589793 },
  LR_ARMCHAIR_01:     { translation_m: [-1.88, 0, 0.05],  rotation_y_rad: -1.5707963267948966 },
  LR_COFFEE_TABLE_01: { translation_m: [0, 0, -0.22],     rotation_y_rad: 0 },
  LR_RUG_01:          { translation_m: [0, 0, -0.18],     rotation_y_rad: 0 },
  LR_SIDE_TABLE_01:   { translation_m: [1.58, 0, -1.55],  rotation_y_rad: 0 },
  LR_FLOOR_LAMP_01:   { translation_m: [-1.72, 0, -1.55], rotation_y_rad: 0.2 },
  LR_MEDIA_UNIT_01:   { translation_m: [0, 0, 2.05],      rotation_y_rad: 0 },
  LR_BOOKCASE_01:     { translation_m: [2.84, 0, 1.15],   rotation_y_rad: 1.5707963267948966 },
};

const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const placements = [];
for (const [role, pick] of Object.entries(picksDoc.picks)) {
  const abs = path.join(ROOT, pick.asset_path);
  const digest = sha256(abs);
  placements.push({
    placement_id: `${pick.twin_id.toLowerCase()}-placement-01`,
    source_placement_alias: role,
    source_lane: 'PRODUCT_TWIN',
    product_twin_id: pick.twin_id,
    design_asset_id: null,
    transform: { ...TRANSFORMS[role], scale: [1, 1, 1] },
    asset: {
      avatar_id: `AVATAR_NEWPORT_${pick.twin_id.replace('PT_NEWPORT_', '')}_G2_PROXY`,
      uri: pick.asset_path,
      revision: `sha256:${digest}`,
      sha256: digest,
      geometry_level: 'G2',
      appearance_level: 'A1_COLOUR_ROUGHNESS_CUE_ONLY',
    },
    commerce: {
      merchant: 'Newport SE',
      currency: 'SEK',
      unit_price: pick.price_sek,
      // channel-tracked, verbatim from the Adtraction feed row (as=2106320328, fid=2175)
      buy_url: pick.affiliate_link,
      affiliate_link_matches_feed: pick.affiliate_link_matches_feed,
      adtraction_program: { feed_id: '2175', commission_pct: 9 },
    },
    material_cues: { color: pick.color, material: pick.material, source: 'newport_adtraction_feed_2175' },
    fit: { target_dims_mm: pick.target_dims_mm, actual_dims_mm: pick.dims_mm, fit_distance: pick.fit_distance },
    rights: { internal_render: 'YES', provider_processing: 'REVIEW', public_publication: 'REVIEW', redistribution: 'NO' },
  });
}

const manifest = {
  schema_version: '0.1.0',
  furniture_manifest_id: 'FURNITURE_MANIFEST_LIVING_ROOM_NEWPORT_V0_1',
  revision: '0.1.0',
  scene_id: 'SCENE_ROOM_LAB_MARBELLA_LIVING_V0_1',
  supersedes: 'FURNITURE_MANIFEST_LIVING_ROOM_ALPHA_V0_1 (IKEA inventory — not an approved channel)',
  channel: { network: 'Adtraction', program: 'Newport SE', feed_id: '2175', commission_pct: 9, publisher_as: '2106320328' },
  placements,
  unfilled_roles: picksDoc.unfilled_roles,
  freeze: { camera_changes_allowed: false, placement_changes_allowed: false, silent_fallback_allowed: false },
};

fs.writeFileSync(path.join(ROOT, 'data/showrooms/newport-living-room-furniture-manifest-v0.1.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({
  placements: placements.length,
  unfilled: manifest.unfilled_roles.length,
  total_sek: placements.reduce((s, p) => s + (p.commerce.unit_price || 0), 0),
  all_links_verbatim: placements.every(p => p.commerce.affiliate_link_matches_feed === true),
}, null, 2));
