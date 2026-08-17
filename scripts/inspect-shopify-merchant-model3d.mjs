import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {inspectGlb} from './validate-authorized-geometry-qa.mjs';

const ROOT = process.cwd();
const input = JSON.parse(await fs.readFile(path.join(ROOT, 'data/identity/shopify-design-public-model3d-candidates.json'), 'utf8'));
const qaConfig = JSON.parse(await fs.readFile(path.join(ROOT, 'config/geometry/shopify-design-public-model3d-qa-targets.json'), 'utf8'));
const qaTargets = new Map((qaConfig.targets ?? []).map((target) => [target.candidate_id, target]));
const runtimeDir = path.join(ROOT, '.runtime/shopify-design-public-model3d-inspection');
const generatedAt = new Date().toISOString();
const endpoint = `${input.summary.merchant_origin}/api/2026-07/graphql.json`;

const query = `query ProductTwinMerchantModel3dInspection($handle: String!) {
  product(handle: $handle) {
    id title vendor productType handle
    variants(first: 100) { nodes { id title sku barcode availableForSale selectedOptions { name value } price { amount currencyCode } } }
    media(first: 50) { nodes { mediaContentType ... on Model3d { id sources { format mimeType filesize url } } } }
  }
}`;

function glbJson(buffer) {
  if (buffer.subarray(0, 4).toString('ascii') !== 'glTF') throw new Error('asset is not GLB');
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) return JSON.parse(buffer.subarray(offset + 8, offset + 8 + length).toString('utf8').trim());
    offset += 8 + length;
  }
  throw new Error('GLB JSON chunk missing');
}

function materialSummary(document) {
  const materials = document.materials ?? [];
  return {
    material_count: materials.length,
    texture_count: document.textures?.length ?? 0,
    image_count: document.images?.length ?? 0,
    materials: materials.slice(0, 40).map((material, index) => ({
      index,
      name: material.name ?? null,
      alpha_mode: material.alphaMode ?? 'OPAQUE',
      double_sided: material.doubleSided === true,
      base_color_factor: material.pbrMetallicRoughness?.baseColorFactor ?? null,
      base_color_texture_present: Number.isInteger(material.pbrMetallicRoughness?.baseColorTexture?.index),
      metallic_factor: material.pbrMetallicRoughness?.metallicFactor ?? null,
      roughness_factor: material.pbrMetallicRoughness?.roughnessFactor ?? null,
      normal_texture_present: Number.isInteger(material.normalTexture?.index),
    })),
  };
}

function scaleEvaluation(candidateId, actualDimensions) {
  const target = qaTargets.get(candidateId);
  if (!target) return {state: 'EXPECTED_DIMENSIONS_NOT_CONFIGURED', pass: false};
  const actual = [...actualDimensions].sort((a, b) => a - b);
  const expected = [...target.expected_dimensions_mm].sort((a, b) => a - b);
  const relativeErrors = expected.map((value, index) => Math.abs(actual[index] - value) / value);
  const maximumRelativeError = Math.max(...relativeErrors);
  return {
    state: maximumRelativeError <= qaConfig.maximum_relative_error ? 'MANUFACTURER_SCALE_QA_PASS' : 'MANUFACTURER_SCALE_QA_BLOCKED',
    pass: maximumRelativeError <= qaConfig.maximum_relative_error,
    expected_dimensions_mm: target.expected_dimensions_mm,
    sorted_actual_mm: actual,
    sorted_expected_mm: expected,
    relative_errors: relativeErrors,
    maximum_relative_error: maximumRelativeError,
    allowed_relative_error: qaConfig.maximum_relative_error,
    dimension_source: target.dimension_source,
    source_note: target.source_note,
  };
}

async function resolveProduct(candidate, attempt = 0) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {'content-type': 'application/json', 'user-agent': 'product-twin-shopify-merchant-model3d-inspector/0.1'},
    body: JSON.stringify({query, variables: {handle: candidate.identity.handle}}),
  });
  const text = await response.text();
  if ((response.status === 429 || response.status >= 500) && attempt < 5) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(12000, 750 * (2 ** attempt))));
    return resolveProduct(candidate, attempt + 1);
  }
  if (!response.ok) throw new Error(`storefront ${response.status}: ${text.slice(0, 240)}`);
  const json = JSON.parse(text);
  if (json.errors?.length) throw new Error(json.errors.map((item) => item.message).join(' | '));
  return json.data?.product;
}

await fs.mkdir(runtimeDir, {recursive: true});
const inspections = [];
for (const candidate of input.candidates ?? []) {
  console.log(`Inspecting ${candidate.identity.vendor} ${candidate.identity.product_title}`);
  try {
    const product = await resolveProduct(candidate);
    if (!product) throw new Error('merchant product no longer resolves');
    const expectedModelIds = new Set(candidate.geometry.model_references.map((model) => model.merchant_model3d_gid));
    const model = (product.media?.nodes ?? []).find((media) => expectedModelIds.has(media?.id));
    if (!model) throw new Error('stable merchant Model3d reference no longer resolves');
    const source = (model.sources ?? []).find((item) => String(item.format).toLowerCase() === 'glb' || String(item.mimeType).toLowerCase() === 'model/gltf-binary');
    if (!source?.url) throw new Error('resolved Model3d has no GLB source');
    const response = await fetch(source.url, {headers: {'user-agent': 'product-twin-shopify-merchant-model3d-inspector/0.1'}});
    if (!response.ok) throw new Error(`GLB fetch ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 150_000_000) throw new Error('GLB exceeds 150 MB inspection limit');
    const geometry = inspectGlb(buffer);
    const materials = materialSummary(glbJson(buffer));
    const scaleQa = scaleEvaluation(candidate.candidate_id, geometry.dimensions_mm);
    const runtimeAssetPath = path.join(runtimeDir, `${candidate.candidate_id}.glb`);
    await fs.writeFile(runtimeAssetPath, buffer);
    const variants = product.variants?.nodes ?? [];
    inspections.push({
      candidate_id: candidate.candidate_id,
      category_id: candidate.category_id,
      room_role: candidate.room_role,
      merchant_origin: candidate.merchant_origin,
      identity: {
        product_title: product.title,
        vendor: product.vendor,
        product_type: product.productType,
        handle: product.handle,
        merchant_product_gid: product.id,
        merchant_model3d_gid: model.id,
      },
      status: 'LIVE_MODEL3D_INSPECTED_SCALE_AND_VARIANT_QA_REQUIRED',
      asset: {
        format: 'glb',
        bytes: buffer.length,
        sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
        source_url_persisted: false,
        binary_committed: false,
        runtime_file_retained: true,
      },
      geometry: {
        dimensions_mm: geometry.dimensions_mm,
        position_accessor_count: geometry.position_accessor_count,
        scale_state: scaleQa.state,
        scale_qa: scaleQa,
      },
      materials,
      variants: {
        count_returned: variants.length,
        available_count: variants.filter((variant) => variant.availableForSale).length,
        binding_state: variants.length === 1 ? 'SINGLE_VARIANT_NEEDS_VISUAL_MATERIAL_QA' : 'PRODUCT_LEVEL_MODEL_MULTIPLE_VARIANTS_UNRESOLVED',
      },
      rights: {state: 'REVIEW', render_scope: 'UNRESOLVED', derivative_storage: 'RUNTIME_INSPECTION_ONLY', redistribution: false},
      commerce: {destination_delivery_state: 'UNVERIFIED_MERCHANT_CENSUS_NOT_CATALOG_DESTINATION_FILTERED', checkout_refresh_required: true},
      promotion: {current_level: 'G2_CANDIDATE', target_level: 'G3', blocked_by: [...(scaleQa.pass ? [] : ['manufacturer dimension scale QA']), 'exact selected-variant material binding', 'render and platform-display rights review', 'Shopify catalog destination join and checkout refresh']},
    });
  } catch (error) {
    inspections.push({candidate_id: candidate.candidate_id, status: 'LIVE_MODEL3D_INSPECTION_FAILED', error: String(error?.message ?? error)});
  }
}

const successful = inspections.filter((item) => item.status === 'LIVE_MODEL3D_INSPECTED_SCALE_AND_VARIANT_QA_REQUIRED');
const summary = {
  generated_at: generatedAt,
  candidates: inspections.length,
  inspected: successful.length,
  failed: inspections.length - successful.length,
  candidates_with_textures: successful.filter((item) => item.materials.texture_count > 0).length,
  candidates_with_normal_maps: successful.filter((item) => item.materials.materials.some((material) => material.normal_texture_present)).length,
  single_variant_candidates: successful.filter((item) => item.variants.count_returned === 1).length,
  manufacturer_scale_qa_passes: successful.filter((item) => item.geometry.scale_qa?.pass === true).length,
  promoted_g3: 0,
  policy: 'GLB source URLs are not persisted. Resolved binaries remain only under gitignored runtime for inspection; stable hashes, measurements and QA states are persisted.',
};
await fs.writeFile(path.join(ROOT, 'data/metrics/shopify-design-public-model3d-inspection-latest.json'), `${JSON.stringify({summary, inspections}, null, 2)}\n`);
console.log(JSON.stringify({summary, inspections: successful.map((item) => ({candidate_id: item.candidate_id, room_role: item.room_role, title: item.identity.product_title, vendor: item.identity.vendor, dimensions_mm: item.geometry.dimensions_mm, scale_qa: item.geometry.scale_qa?.state, maximum_scale_error: item.geometry.scale_qa?.maximum_relative_error, bytes: item.asset.bytes, materials: item.materials.material_count, textures: item.materials.texture_count, normal_maps: item.materials.materials.filter((material) => material.normal_texture_present).length, variants: item.variants.count_returned}))}, null, 2));
