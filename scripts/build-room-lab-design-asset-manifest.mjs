import fsp from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {assertNoDesignAssetCommerce} from './lib/design-asset-truth.mjs';
import {loadTaxonomyResolver} from './lib/taxonomy-aliases.mjs';

export const ROOM_LAB_CANONICAL_VIEWS = Object.freeze([
  'front', 'rear', 'left', 'right', 'three_quarter', 'top', 'floor_contact',
]);

export const LIVING_DINING_ASSET_IDS = Object.freeze([
  'DA_SH3D_KL_MID_CENTURY_SOFA',
  'DA_SH3D_KL_MID_CENTURY_CHAIR',
  'DA_SH3D_KL_CHAIR_OTTOMAN',
  'DA_SH3D_KL_FULL_BOOKCASE',
  'DA_SH3D_KL_ORIENTAL_RUG',
  'DA_SH3D_KL_PEDESTAL_VASE_LAMP',
  'DA_SH3D_KL_DINING_CHAIR',
  'DA_SH3D_KL_GLASS_DINING_TABLE',
  'DA_SH3D_KL_CAFE_TABLE',
]);

const TOP_LEVEL_KEYS = new Set([
  'version', 'generated_at', 'record_lane', 'consumer', 'policy',
  'visible_attribution_contract', 'summary', 'assets',
]);
const ASSET_KEYS = new Set([
  'record_lane', 'design_asset_id', 'identity_scope', 'not_a_product_twin',
  'source_model_name', 'category_id', 'catalogue_scope', 'geometry_level',
  'geometry', 'dimensions', 'transform', 'visible_attribution', 'canonical_views',
  'qa', 'publication_state', 'publication_allowed',
  'geometry_asset_reference', 'replacement_search_requirement',
]);

function exactKeys(value, allowed, location) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`${location}: fields outside the strict manifest allowlist: ${unknown.join(', ')}`);
}

function object(value, location) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${location} must be an object`);
  return value;
}

function string(value, location) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${location} must be a non-empty string`);
}

function finite(value, location) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${location} must be a finite number`);
}

function exactStringArray(value, required, location) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new Error(`${location} must be an array of strings`);
  if (JSON.stringify(value) !== JSON.stringify(required)) throw new Error(`${location} must equal ${required.join(', ')}`);
}

export function validateRoomLabDesignAssetManifest(manifest) {
  object(manifest, 'room_lab_manifest');
  exactKeys(manifest, TOP_LEVEL_KEYS, 'room_lab_manifest');
  if (manifest.record_lane !== 'DESIGN_ASSET') throw new Error('room_lab_manifest.record_lane must be DESIGN_ASSET');
  if (manifest.consumer !== 'ROOM_LAB') throw new Error('room_lab_manifest.consumer must be ROOM_LAB');
  string(manifest.version, 'room_lab_manifest.version');
  string(manifest.generated_at, 'room_lab_manifest.generated_at');
  string(manifest.policy, 'room_lab_manifest.policy');
  object(manifest.visible_attribution_contract, 'room_lab_manifest.visible_attribution_contract');
  object(manifest.summary, 'room_lab_manifest.summary');
  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) throw new Error('room_lab_manifest.assets must be a non-empty array');
  const ids = new Set();
  for (const [index, asset] of manifest.assets.entries()) {
    const location = `room_lab_manifest.assets[${index}]`;
    object(asset, location);
    exactKeys(asset, ASSET_KEYS, location);
    if (asset.record_lane !== 'DESIGN_ASSET') throw new Error(`${location}.record_lane must be DESIGN_ASSET`);
    if (asset.identity_scope !== 'GENERIC_DESIGN_ASSET') throw new Error(`${location}.identity_scope must be GENERIC_DESIGN_ASSET`);
    if (asset.not_a_product_twin !== true) throw new Error(`${location}.not_a_product_twin must be true`);
    for (const key of ['design_asset_id', 'source_model_name', 'category_id', 'catalogue_scope', 'geometry_level', 'publication_state']) string(asset[key], `${location}.${key}`);
    if (ids.has(asset.design_asset_id)) throw new Error(`${location}.design_asset_id is duplicated`);
    ids.add(asset.design_asset_id);
    object(asset.geometry, `${location}.geometry`);
    exactKeys(asset.geometry, new Set(['format', 'byte_size', 'sha256', 'source_vertices', 'triangles', 'primitives', 'materials', 'embedded_textures', 'runtime_binary_retained_outside_repository']), `${location}.geometry`);
    if (asset.geometry.format !== 'GLB_2_0') throw new Error(`${location}.geometry.format must be GLB_2_0`);
    for (const key of ['byte_size', 'source_vertices', 'triangles', 'primitives', 'materials', 'embedded_textures']) finite(asset.geometry[key], `${location}.geometry.${key}`);
    if (!/^[0-9a-f]{64}$/.test(asset.geometry.sha256)) throw new Error(`${location}.geometry.sha256 must be a lowercase SHA-256 digest`);
    if (asset.geometry.runtime_binary_retained_outside_repository !== true) throw new Error(`${location}.geometry.runtime_binary_retained_outside_repository must be true`);
    object(asset.dimensions, `${location}.dimensions`);
    exactKeys(asset.dimensions, new Set(['width_mm', 'depth_mm', 'height_mm', 'evidence_state']), `${location}.dimensions`);
    for (const key of ['width_mm', 'depth_mm', 'height_mm']) finite(asset.dimensions[key], `${location}.dimensions.${key}`);
    string(asset.dimensions.evidence_state, `${location}.dimensions.evidence_state`);
    object(asset.transform, `${location}.transform`);
    exactKeys(asset.transform, new Set(['units', 'up_axis', 'front_axis', 'origin', 'pivot', 'source_model_rotation_matrix3_row_major', 'back_face_shown', 'normalization']), `${location}.transform`);
    if (asset.transform.units !== 'metres' || asset.transform.up_axis !== 'Y') throw new Error(`${location}.transform must use metres and Y-up`);
    string(asset.transform.front_axis, `${location}.transform.front_axis`);
    string(asset.transform.pivot, `${location}.transform.pivot`);
    object(asset.transform.origin, `${location}.transform.origin`);
    exactKeys(asset.transform.origin, new Set(['x_mm', 'y_mm', 'z_mm']), `${location}.transform.origin`);
    for (const key of ['x_mm', 'y_mm', 'z_mm']) finite(asset.transform.origin[key], `${location}.transform.origin.${key}`);
    const matrix = asset.transform.source_model_rotation_matrix3_row_major;
    if (!Array.isArray(matrix) || matrix.length !== 9 || matrix.some((item) => typeof item !== 'number' || !Number.isFinite(item))) throw new Error(`${location}.transform.source_model_rotation_matrix3_row_major must contain nine finite numbers`);
    if (typeof asset.transform.back_face_shown !== 'boolean') throw new Error(`${location}.transform.back_face_shown must be a boolean`);
    object(asset.transform.normalization, `${location}.transform.normalization`);
    exactKeys(asset.transform.normalization, new Set(['kind', 'scale_xyz', 'source_scale_independently_verified']), `${location}.transform.normalization`);
    string(asset.transform.normalization.kind, `${location}.transform.normalization.kind`);
    if (!Array.isArray(asset.transform.normalization.scale_xyz) || asset.transform.normalization.scale_xyz.length !== 3 || asset.transform.normalization.scale_xyz.some((item) => typeof item !== 'number' || !Number.isFinite(item))) throw new Error(`${location}.transform.normalization.scale_xyz must contain three finite numbers`);
    if (typeof asset.transform.normalization.source_scale_independently_verified !== 'boolean') throw new Error(`${location}.transform.normalization.source_scale_independently_verified must be a boolean`);
    object(asset.visible_attribution, `${location}.visible_attribution`);
    exactKeys(asset.visible_attribution, new Set(['creator', 'text', 'license_id', 'source_url', 'display_required', 'display_state']), `${location}.visible_attribution`);
    for (const key of ['creator', 'text', 'license_id', 'source_url', 'display_state']) string(asset.visible_attribution[key], `${location}.visible_attribution.${key}`);
    if (asset.visible_attribution.display_required !== true) throw new Error(`${location}.visible_attribution.display_required must be true`);
    exactStringArray(asset.canonical_views, ROOM_LAB_CANONICAL_VIEWS, `${location}.canonical_views`);
    object(asset.qa, `${location}.qa`);
    exactKeys(asset.qa, new Set(['visual_review_state', 'independent_scale_state', 'texture_state', 'glass_alpha_state', 'floor_contact_error_mm', 'centre_pivot_offset_mm', 'blockers']), `${location}.qa`);
    finite(asset.qa.floor_contact_error_mm, `${location}.qa.floor_contact_error_mm`);
    object(asset.qa.centre_pivot_offset_mm, `${location}.qa.centre_pivot_offset_mm`);
    for (const key of ['x', 'z']) finite(asset.qa.centre_pivot_offset_mm[key], `${location}.qa.centre_pivot_offset_mm.${key}`);
    if (!Array.isArray(asset.qa.blockers) || asset.qa.blockers.some((item) => typeof item !== 'string')) throw new Error(`${location}.qa.blockers must be an array of strings`);
    if (typeof asset.publication_allowed !== 'boolean') throw new Error(`${location}.publication_allowed must be a boolean`);
    if (!asset.publication_allowed && asset.geometry_asset_reference !== null) throw new Error(`${location}.geometry_asset_reference must remain null while publication is blocked`);
    if (asset.publication_allowed && (asset.geometry_level !== 'G2' || typeof asset.geometry_asset_reference !== 'string' || !/^https:\/\//.test(asset.geometry_asset_reference))) throw new Error(`${location} publishable assets require G2 and a stable HTTPS geometry_asset_reference`);
    object(asset.replacement_search_requirement, `${location}.replacement_search_requirement`);
    exactKeys(asset.replacement_search_requirement, new Set(['required', 'state', 'benchmarks', 'match_axes']), `${location}.replacement_search_requirement`);
    if (asset.replacement_search_requirement.required !== true) throw new Error(`${location}.replacement_search_requirement.required must be true`);
    exactStringArray(asset.replacement_search_requirement.benchmarks, ['ES', 'SE', 'GB', 'US'], `${location}.replacement_search_requirement.benchmarks`);
  }
  assertNoDesignAssetCommerce(manifest, 'room_lab_manifest');
  return manifest;
}

async function readJson(filePath, fallback = undefined) {
  try { return JSON.parse(await fsp.readFile(filePath, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}

export async function buildRoomLabDesignAssetManifest({root = process.cwd(), env = process.env} = {}) {
  const [pilot, intake, conversion, visualQa, visualReview, promotion, publicationContract, resolveCategory] = await Promise.all([
    readJson(path.join(root, env.DESIGN_ASSET_PILOT ?? 'config/geometry/sweet-home-3d-design-asset-pilot-v0.1.json')),
    readJson(path.join(root, env.DESIGN_ASSET_INTAKE ?? 'data/metrics/sweet-home-3d-design-asset-intake-latest.json')),
    readJson(path.join(root, env.DESIGN_ASSET_CONVERSION ?? 'data/metrics/sweet-home-3d-design-asset-conversion-latest.json')),
    readJson(path.join(root, env.DESIGN_ASSET_VISUAL_QA ?? 'data/metrics/kator-legaz-design-asset-visual-qa-v0.1.json')),
    readJson(path.join(root, env.DESIGN_ASSET_VISUAL_REVIEW ?? 'data/evidence/kator-legaz-design-asset-visual-review-v0.1.json')),
    readJson(path.join(root, env.DESIGN_ASSET_PROMOTION_METRIC ?? 'data/metrics/design-asset-promotion-latest.json')),
    readJson(path.join(root, env.DESIGN_ASSET_PUBLICATION_CONTRACT ?? 'config/geometry/design-asset-publication-contract-v0.1.json')),
    loadTaxonomyResolver(root),
  ]);
  const intakeById = new Map(intake.assets.map((item) => [item.design_asset_id, item]));
  const conversionById = new Map(conversion.assets.map((item) => [item.design_asset_id, item]));
  const visualById = new Map(visualQa.assets.map((item) => [item.design_asset_id, item]));
  const reviewById = new Map(visualReview.assets.map((item) => [item.design_asset_id, item]));
  const promotionById = new Map(promotion.assets.map((item) => [item.design_asset_id, item]));
  if (reviewById.size !== visualReview.assets.length) throw new Error('independent visual review contains duplicate design_asset_id values');
  const livingDining = new Set(LIVING_DINING_ASSET_IDS);
  const assets = pilot.candidates.map((candidate) => {
    const ingested = intakeById.get(candidate.design_asset_id);
    const converted = conversionById.get(candidate.design_asset_id);
    const visual = visualById.get(candidate.design_asset_id);
    const review = reviewById.get(candidate.design_asset_id);
    const decision = promotionById.get(candidate.design_asset_id);
    if (!ingested || !converted || !visual || !review || !decision) throw new Error(`${candidate.design_asset_id}: intake, conversion, render QA, independent visual review and computed promotion evidence are all required`);
    if (decision.geometry_sha256 !== converted.sha256) throw new Error(`${candidate.design_asset_id}: promotion decision does not match converted GLB hash`);
    const views = visual.views.map((view) => view.view);
    exactStringArray(views, ROOM_LAB_CANONICAL_VIEWS, `${candidate.design_asset_id}.views`);
    const canonicalVisualPass = decision.gates.canonical_view_visual_qa_passed === true;
    const independentScalePass = decision.gates.independent_scale_qa_passed === true;
    const publicationAllowed = decision.publication_allowed === true;
    const blockers = decision.blockers;
    return {
      record_lane: 'DESIGN_ASSET',
      design_asset_id: candidate.design_asset_id,
      identity_scope: 'GENERIC_DESIGN_ASSET',
      not_a_product_twin: true,
      source_model_name: candidate.source_model_name,
      category_id: resolveCategory(candidate.category_id),
      catalogue_scope: livingDining.has(candidate.design_asset_id) ? 'LIVING_DINING' : 'FUTURE_CATEGORY_BREADTH',
      geometry_level: decision.geometry_state,
      geometry: {
        format: 'GLB_2_0',
        byte_size: converted.bytes,
        sha256: converted.sha256,
        source_vertices: converted.mesh.source_vertices,
        triangles: converted.mesh.source_triangles,
        primitives: converted.mesh.primitives,
        materials: converted.materials.count,
        embedded_textures: converted.materials.embedded_textures,
        runtime_binary_retained_outside_repository: true,
      },
      dimensions: {
        width_mm: converted.declared_mm.width,
        depth_mm: converted.declared_mm.depth,
        height_mm: converted.declared_mm.height,
        evidence_state: independentScalePass ? 'INDEPENDENT_SCALE_VERIFIED' : ingested.source_dimensions.verification_state,
      },
      transform: {
        units: 'metres',
        up_axis: 'Y',
        front_axis: decision.gates.source_orientation_applied ? 'REVIEWED_FROM_CANONICAL_FRONT' : 'UNVERIFIED',
        origin: {x_mm: 0, y_mm: 0, z_mm: 0},
        pivot: canonicalVisualPass ? 'REVIEWED_CENTER_XZ_MIN_Y_0' : 'MECHANICAL_BOUNDS_CENTER_XZ_MIN_Y_0_SEMANTIC_PIVOT_UNVERIFIED',
        source_model_rotation_matrix3_row_major: converted.source_transform.model_rotation.matrix3_row_major,
        back_face_shown: converted.source_transform.back_face_shown,
        normalization: {
          kind: converted.normalization.kind,
          scale_xyz: converted.normalization.scale_xyz,
          source_scale_independently_verified: independentScalePass,
        },
      },
      visible_attribution: {
        ...converted.attribution,
        display_state: decision.gates.attribution_display_verified ? 'VERIFIED_ON_REQUIRED_ROOM_LAB_SURFACES' : 'REQUIRED_NOT_YET_CUSTOMER_UI_VERIFIED',
      },
      canonical_views: views,
      qa: {
        visual_review_state: canonicalVisualPass ? 'CANONICAL_VISUAL_QA_PASS' : `RENDER_${review.render_visual_verdict}_G2_BLOCKED`,
        independent_scale_state: independentScalePass ? 'PASS' : 'BLOCKED_NO_INDEPENDENT_SOURCE',
        texture_state: review.texture_embedding,
        glass_alpha_state: review.glass_alpha,
        floor_contact_error_mm: visual.automated_checks.floor_contact_error_mm,
        centre_pivot_offset_mm: visual.automated_checks.centre_pivot_offset_mm,
        blockers,
      },
      publication_state: decision.publication_state,
      publication_allowed: publicationAllowed,
      geometry_asset_reference: publicationAllowed ? decision.public_asset_reference : null,
      replacement_search_requirement: {
        required: true,
        state: 'SEPARATE_PRODUCT_TWIN_SEARCH_REQUIRED',
        benchmarks: candidate.replacement_benchmarks,
        match_axes: ['category', 'dimensions', 'rotation_aware_fit', 'style', 'silhouette', 'material_intent'],
      },
    };
  });
  const manifest = validateRoomLabDesignAssetManifest({
    version: '0.1',
    generated_at: new Date().toISOString(),
    record_lane: 'DESIGN_ASSET',
    consumer: 'ROOM_LAB',
    policy: 'This manifest contains generic Design Assets only. Blocked runtime geometry has no consumer asset reference and carries no Product Twin, commerce, or purchasing evidence.',
    visible_attribution_contract: publicationContract.visible_attribution,
    summary: {
      assets: assets.length,
      living_dining: assets.filter((item) => item.catalogue_scope === 'LIVING_DINING').length,
      g1_blocked: assets.filter((item) => item.geometry_level === 'G1').length,
      g2_ready: assets.filter((item) => item.geometry_level === 'G2').length,
      publication_allowed: assets.filter((item) => item.publication_allowed).length,
    },
    assets,
  });
  const outputPath = path.resolve(root, env.ROOM_LAB_DESIGN_ASSET_MANIFEST ?? 'data/geometry/manifests/room-lab-design-assets-v0.1.json');
  const manifestRoot = path.resolve(root, 'data/geometry/manifests');
  if (!(outputPath === manifestRoot || outputPath.startsWith(`${manifestRoot}${path.sep}`))) throw new Error('Room Lab Design Asset manifest must remain under data/geometry/manifests');
  await fsp.mkdir(path.dirname(outputPath), {recursive: true});
  await fsp.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifest = await buildRoomLabDesignAssetManifest();
  console.log(JSON.stringify({status: 'PASS', version: manifest.version, ...manifest.summary}));
}
