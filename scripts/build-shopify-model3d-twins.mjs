import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const [census, inspection, commerce] = await Promise.all([
  fs.readFile(path.join(ROOT, 'data/identity/shopify-design-public-model3d-candidates.json'), 'utf8').then(JSON.parse),
  fs.readFile(path.join(ROOT, 'data/metrics/shopify-design-public-model3d-inspection-latest.json'), 'utf8').then(JSON.parse),
  fs.readFile(path.join(ROOT, 'data/commerce/shopify-design-public-model3d-spain-joins-2026-08-17.json'), 'utf8').then(JSON.parse),
]);
const inspectionById = new Map((inspection.inspections ?? []).map((item) => [item.candidate_id, item]));
const commerceById = new Map((commerce.joins ?? []).map((item) => [item.candidate_id, item]));
const twinDir = path.join(ROOT, 'data/twins');

function safe(value) {
  return String(value ?? 'UNKNOWN').toUpperCase().replaceAll(/[^A-Z0-9]+/g, '_').replaceAll(/^_+|_+$/g, '');
}

function identityState(join) {
  return join?.exact_variant_matches?.length
    ? 'exact_merchant_variant_and_manufacturer_product_family_verified_visible_finish_incomplete'
    : 'manufacturer_product_family_and_merchant_product_verified_commerce_join_missing';
}

await fs.mkdir(twinDir, {recursive: true});
const written = [];
for (const candidate of census.candidates ?? []) {
  const inspected = inspectionById.get(candidate.candidate_id);
  const joined = commerceById.get(candidate.candidate_id);
  if (!inspected || inspected.status !== 'LIVE_MODEL3D_INSPECTED_SCALE_AND_VARIANT_QA_REQUIRED') throw new Error(`Successful inspection missing for ${candidate.candidate_id}`);
  const exactVariant = joined?.exact_variant_matches?.[0] ?? null;
  const suffix = exactVariant?.sku ? safe(exactVariant.sku) : safe(candidate.identity.merchant_product_gid.split('/').pop());
  const id = `PT_${safe(candidate.identity.vendor)}_${safe(candidate.identity.product_title)}_${suffix}`;
  const hasTextures = inspected.materials.texture_count > 0;
  const scalePass = inspected.geometry.scale_qa?.pass === true;
  const visibleConfiguration = exactVariant ? Object.entries(exactVariant.selected_options ?? {}).map(([name, value]) => `${name}: ${value}`).join(' / ') : 'unresolved';
  const record = {
    twin_id: id,
    kind: 'object',
    category_id: candidate.category_id,
    identity: {
      state: identityState(joined),
      manufacturer: candidate.identity.vendor,
      product_family: candidate.identity.product_title,
      model: candidate.identity.product_title,
      merchant_sku: exactVariant?.sku ?? null,
      configuration: visibleConfiguration,
      configuration_limit: exactVariant ? 'The Shopify variant identifies an upholstery group or route, not a selected visible fabric and colour.' : 'No exact destination-filtered merchant variant was joined.',
    },
    physical: {
      measured_model_axes_mm: inspected.geometry.dimensions_mm,
      expected_manufacturer_dimensions_mm: inspected.geometry.scale_qa?.expected_dimensions_mm ?? null,
      maximum_relative_scale_error: inspected.geometry.scale_qa?.maximum_relative_error ?? null,
      evidence_state: scalePass ? 'manufacturer_scale_qa_pass' : inspected.geometry.scale_qa?.state ?? 'manufacturer_scale_qa_required',
    },
    external_identities: [{
      source_id: 'shopify_merchant_storefront',
      role: 'live_commerce_and_native_model3d_reference',
      merchant_origin: candidate.merchant_origin,
      merchant_product_gid: candidate.identity.merchant_product_gid,
      merchant_variant_gid: exactVariant?.merchant_variant_gid ?? null,
      merchant_model3d_gids: candidate.geometry.model_references.map((model) => model.merchant_model3d_gid),
      verification: {
        state: joined?.status ?? 'not_joined',
        country_filter: joined?.destination ?? null,
        checkout_state: 'exact_postcode_tax_freight_and_delivery_refresh_required',
      },
      refresh_policy: 'live_required',
      mutable_catalog_data_persisted: false,
    }],
    geometry: {
      level: 'G2',
      state: 'candidate_live_shopify_native_product_shape',
      source_media_type: 'MODEL_3D',
      formats: candidate.geometry.model_references.flatMap((model) => model.formats),
      asset_storage: 'runtime_inspection_only',
      asset_sha256: inspected.asset.sha256,
      scale_state: inspected.geometry.scale_qa?.state ?? 'manufacturer_scale_qa_required',
      appearance: {
        material_count: inspected.materials.material_count,
        texture_count: inspected.materials.texture_count,
        normal_map_present: inspected.materials.materials.some((material) => material.normal_texture_present),
        state: hasTextures ? 'textured_product_level_model_selected_variant_not_bound' : 'generic_product_level_materials_selected_variant_not_bound',
        exact_selected_finish_claimed: false,
      },
      rights: {
        state: 'review',
        render_scope: 'unresolved',
        derivative_storage: 'runtime_inspection_only',
        redistribution: false,
      },
      inspection_evidence: 'data/metrics/shopify-design-public-model3d-inspection-latest.json',
    },
    commerce: {
      source: 'Shopify catalog and merchant Storefront API',
      dated_observation: exactVariant ? {available_for_sale: exactVariant.available_for_sale, price: exactVariant.dated_price, destination: joined.destination} : null,
      state: joined?.status ?? 'unverified',
      checkout_refresh_required: true,
    },
    readiness: {
      identity: exactVariant ? 'merchant_variant_verified_visible_finish_incomplete' : 'partial',
      commerce: exactVariant ? 'Spain_country_catalog_join_pass' : 'unverified',
      dimensions: scalePass ? 'verified' : 'review',
      geometry: 'G2_candidate',
      appearance: hasTextures ? 'textured_candidate_exact_variant_not_bound' : 'blocked_generic_materials',
      room_placement: scalePass ? 'runtime_candidate' : 'blocked_pending_scale_qa',
      render: 'blocked_pending_material_and_rights',
      rights: 'review',
    },
    promotion_blockers: [
      ...(scalePass ? [] : ['manufacturer dimension scale QA']),
      'select and bind an exact visible upholstery fabric and colour',
      'validate the selected-variant appearance against the live GLB',
      'confirm render and platform-display rights',
      'refresh exact postcode tax, freight, stock allocation and delivery before quote or purchase',
    ],
    policy: 'Shopify proves a native product-level 3D model and an exact merchant commerce join. G3 is not claimed until scale, visible material, rights and final delivery gates all pass.',
  };
  const fileName = `${id}.json`;
  await fs.writeFile(path.join(twinDir, fileName), `${JSON.stringify(record, null, 2)}\n`);
  written.push({candidate_id: candidate.candidate_id, twin_id: id, file: path.join('data/twins', fileName), role: candidate.room_role, scale_pass: scalePass, textures: inspected.materials.texture_count});
}

console.log(JSON.stringify({written: written.length, twins: written}, null, 2));
