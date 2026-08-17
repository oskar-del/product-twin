import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const packPath = path.join(ROOT, 'config/geometry/ikea-residential-starter-pack-v0.1.json');
const avatarIndexPath = path.join(ROOT, 'data/geometry/avatar-index.json');
const twinDir = path.join(ROOT, 'data/twins');
const selectedAvatarIds = new Set([
  'AVATAR_IKEA_KIVIK_49440597_G2_SOFA_PROXY',
  'AVATAR_IKEA_POANG_39240787_G2_ARMCHAIR_PROXY',
  'AVATAR_IKEA_BILLY_00263850_G2_BOOKCASE_PROXY',
  'AVATAR_IKEA_BESTA_89330691_G2_MEDIA_UNIT_PROXY',
  'AVATAR_IKEA_LISTERBY_30513904_G2_COFFEE_TABLE_PROXY',
  'AVATAR_IKEA_LOHALS_30511288_G2_RUG_PROXY',
  'AVATAR_IKEA_GLADOM_70578451_G2_TRAY_TABLE_PROXY',
  'AVATAR_IKEA_LAUTERS_30405042_G2_FLOOR_LAMP_PROXY',
]);

const [pack, avatarIndex] = await Promise.all([
  fs.readFile(packPath, 'utf8').then(JSON.parse),
  fs.readFile(avatarIndexPath, 'utf8').then(JSON.parse),
]);
const avatarById = new Map((avatarIndex.avatars ?? []).map((avatar) => [avatar.avatar_id, avatar]));

async function metricPathFor(avatarId) {
  const files = await fs.readdir(path.join(ROOT, 'data/metrics'));
  for (const file of files.filter((name) => name.endsWith('.json'))) {
    const relativePath = path.join('data/metrics', file);
    try {
      const metric = JSON.parse(await fs.readFile(path.join(ROOT, relativePath), 'utf8'));
      if (metric.avatar_id === avatarId) return relativePath;
    } catch {
      // Some metrics are deliberately large or use a different schema; skip them.
    }
  }
  throw new Error(`No QA metric found for ${avatarId}`);
}

function twinId(avatarId) {
  return avatarId.replace(/^AVATAR_/, 'PT_').replace(/_G2_[A-Z_]+$/, '');
}

function readiness(product, avatar) {
  return {
    identity: 'verified_exact_retail_article',
    commerce: 'official_product_page_verified_live_postcode_refresh_required',
    dimensions: 'verified',
    geometry: 'G2_promoted_planning_proxy',
    appearance: 'variant_colour_and_roughness_cues_only_no_exact_texture',
    room_placement: 'ready_for_planning_and_circulation',
    render: 'planning_preview_only',
    rights: 'product_twin_owned_proxy_no_manufacturer_asset_redistribution',
    next_gate: avatar.next_gate,
  };
}

await fs.mkdir(twinDir, {recursive: true});
const written = [];
for (const product of pack.products.filter((item) => selectedAvatarIds.has(item.avatar_id))) {
  const avatar = avatarById.get(product.avatar_id);
  if (!avatar) throw new Error(`Avatar index entry missing for ${product.avatar_id}`);
  const qaMetric = await metricPathFor(product.avatar_id);
  const id = twinId(product.avatar_id);
  const record = {
    twin_id: id,
    kind: product.type,
    category_id: product.category_id,
    identity: {
      state: 'verified',
      manufacturer: 'IKEA',
      product_family: product.product_family,
      model: product.name,
      article_no: product.article_no,
      configuration: product.name,
    },
    physical: {
      dimensions_mm: product.dimensions_mm,
      secondary_dimensions_mm: product.secondary_dimensions_mm,
      evidence_state: 'official_retailer_dimensions_and_glb_envelope_verified',
    },
    external_identities: [{
      source_id: 'ikea_spain',
      role: 'direct_retail_reference',
      product_url: product.official_url,
      verification: {
        state: 'exact_retail_article_verified',
        article_no: product.article_no,
        postcode_delivery_state: 'live_refresh_required',
      },
      refresh_policy: 'live_required_before_quote_or_purchase',
      mutable_catalog_data_persisted: false,
    }],
    geometry: {
      level: 'G2',
      state: 'promoted_realistic_planning_proxy',
      avatar_id: product.avatar_id,
      asset_path: avatar.asset_path,
      scale_state: avatar.scale,
      shape_claim: avatar.shape ?? avatar.appearance,
      placement: product.placement,
      appearance: {
        material_cues: product.material_cues,
        pbr_state: 'variant_specific_base_colour_and_roughness_cues',
        embedded_textures: false,
        exact_manufacturer_texture_or_finish_claimed: false,
      },
      qa_metric: qaMetric,
      rights: {
        geometry_owner: 'Product Twin planning proxy',
        manufacturer_geometry_copied: false,
        manufacturer_texture_artwork_copied: false,
        exact_likeness_claimed: false,
      },
    },
    readiness: readiness(product, avatar),
    promotion_blockers: [
      'authorized exact product geometry or independently validated exact reconstruction',
      'exact selected-variant material and texture QA',
      'live postcode 29660 price, stock and delivery refresh',
    ],
    policy: 'This is a real, exact retail product identity with a verified-scale G2 planning avatar. It is usable for room fit and circulation, but is not a G3 claim of exact visual likeness or finish.',
  };
  const fileName = `${id}.json`;
  await fs.writeFile(path.join(twinDir, fileName), `${JSON.stringify(record, null, 2)}\n`);
  written.push({twin_id: id, file: path.join('data/twins', fileName), avatar_id: product.avatar_id});
}

if (written.length !== selectedAvatarIds.size) throw new Error(`Expected ${selectedAvatarIds.size} Twins, wrote ${written.length}`);
console.log(JSON.stringify({written: written.length, twins: written}, null, 2));
