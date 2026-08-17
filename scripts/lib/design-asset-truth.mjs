export const DESIGN_ASSET_FORBIDDEN_KEYS = new Set([
  'product_twin_id', 'twin_id', 'sku', 'gtin', 'ean', 'upc',
  'price', 'stock', 'offer', 'offers', 'supplier', 'seller',
  'checkout', 'cart', 'commerce', 'procurement', 'logistics',
  'merchant_product_gid', 'merchant_variant_gid', 'merchant_product_id',
  'merchant_variant_id', 'lead_time', 'landed_cost',
]);

const DESIGN_ASSET_FORBIDDEN_SEMANTIC_TOKENS = new Set([
  'price', 'pricing', 'stock', 'availability', 'inventory',
  'supplier', 'seller', 'offer', 'checkout', 'cart', 'commerce',
  'procurement', 'logistics', 'merchant', 'sku', 'gtin', 'ean', 'upc',
  'currency', 'discount', 'tax', 'shipment', 'shipping', 'delivery',
  'fulfillment', 'fulfilment', 'warehouse', 'msrp', 'rrp', 'vendor',
  'qty', 'quantity', 'amount', 'cost', 'rate',
]);

const DESIGN_ASSET_FORBIDDEN_COMPACT_FRAGMENTS = [
  'unitprice', 'listprice', 'saleprice', 'retailprice',
  'availabilitystock', 'stockavailable', 'destinationsupplier',
  'suppliername', 'vendorname', 'orderquantity', 'quantityavailable',
  'orderqty', 'unitcost', 'unitrate', 'unitamount', 'leadtime', 'landedcost',
  'msrp', 'rrp', 'vendor', 'quantity',
];

export const DESIGN_ASSET_RUNTIME_ALLOWED_KEYS = new Set([
  'record_lane', 'design_asset_id', 'source_id', 'source_model_name',
  'identity_scope', 'category_id', 'style_tags', 'room_roles', 'asset_state',
  'dimensions_state', 'license', 'target_geometry_level', 'not_a_product_twin',
  'replacement_search_required', 'replacement_benchmarks', 'geometry_state',
  'source_dimensions', 'source_transform', 'attribution', 'conversion',
]);

const DESIGN_ASSET_RUNTIME_NESTED_ALLOWLISTS = {
  license: new Set(['spdx_like', 'attribution_required', 'attribution_text', 'source_reference']),
  source_dimensions: new Set(['source_unit', 'width_cm', 'depth_cm', 'height_cm', 'derived_mm', 'verification_state']),
  'source_dimensions.derived_mm': new Set(['width', 'depth', 'height']),
  source_transform: new Set(['model_rotation', 'back_face_shown', 'back_face_declared', 'multi_part_model', 'axis_contract']),
  'source_transform.model_rotation': new Set(['declared', 'matrix3_row_major', 'determinant']),
  attribution: new Set(['creator', 'text', 'license_id', 'source_url', 'display_required']),
  conversion: new Set([
    'status', 'current_geometry_level', 'maximum_after_visual_and_scale_qa',
    'runtime_glb_path', 'envelope_normalization_error_max',
    'independent_scale_qa_passed', 'materials', 'remaining_gates',
  ]),
  'conversion.materials': new Set(['count', 'embedded_textures', 'source_mtl_materials']),
};

function semanticKeyTokens(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function isForbiddenDesignAssetKey(key) {
  const normalized = String(key).toLowerCase();
  if (DESIGN_ASSET_FORBIDDEN_KEYS.has(normalized)) return true;
  const tokens = semanticKeyTokens(key);
  if (tokens.some((token) => DESIGN_ASSET_FORBIDDEN_SEMANTIC_TOKENS.has(token))) return true;
  const joined = tokens.join('');
  return DESIGN_ASSET_FORBIDDEN_COMPACT_FRAGMENTS.some((fragment) => joined.includes(fragment));
}

export function findForbiddenDesignAssetFields(value, location = 'design_asset', hits = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenDesignAssetFields(item, `${location}[${index}]`, hits));
    return hits;
  }
  if (!value || typeof value !== 'object') return hits;
  for (const [key, child] of Object.entries(value)) {
    if (isForbiddenDesignAssetKey(key)) hits.push(`${location}.${key}`);
    findForbiddenDesignAssetFields(child, `${location}.${key}`, hits);
  }
  return hits;
}

export function assertNoDesignAssetCommerce(value, location = 'design_asset_response') {
  const hits = findForbiddenDesignAssetFields(value, location);
  if (hits.length) throw new Error(`${hits.join(', ')}: commerce/product identity fields are forbidden in Design Assets`);
  return value;
}

export function assertGenericDesignAsset(value, location = 'design_asset') {
  if (!value || typeof value !== 'object') throw new Error(`${location}: Design Asset must be an object`);
  if (value.identity_scope !== 'GENERIC_DESIGN_ASSET') throw new Error(`${location}.identity_scope must be GENERIC_DESIGN_ASSET`);
  if (value.not_a_product_twin !== true) throw new Error(`${location}.not_a_product_twin must be true`);
  assertNoDesignAssetCommerce(value, location);
  return value;
}

export function assertDesignAssetRuntimeRecord(value, location = 'design_asset_runtime_record') {
  assertGenericDesignAsset(value, location);
  const required = [
    'design_asset_id', 'source_id', 'source_model_name', 'identity_scope',
    'category_id', 'style_tags', 'room_roles', 'asset_state', 'dimensions_state',
    'license', 'target_geometry_level', 'not_a_product_twin',
    'replacement_search_required', 'replacement_benchmarks', 'geometry_state',
    'source_dimensions', 'source_transform', 'attribution', 'conversion',
  ];
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  if (missing.length) throw new Error(`${location}: required Design Asset runtime fields missing: ${missing.join(', ')}`);
  const unknown = Object.keys(value).filter((key) => !DESIGN_ASSET_RUNTIME_ALLOWED_KEYS.has(key));
  if (unknown.length) throw new Error(`${location}: fields outside the strict Design Asset runtime allowlist: ${unknown.join(', ')}`);
  if (value.record_lane !== undefined && value.record_lane !== 'DESIGN_ASSET') throw new Error(`${location}.record_lane must be DESIGN_ASSET`);
  for (const [objectPath, allowed] of Object.entries(DESIGN_ASSET_RUNTIME_NESTED_ALLOWLISTS)) {
    const nested = objectPath.split('.').reduce((current, key) => current?.[key], value);
    if (nested === null || nested === undefined) continue;
    if (typeof nested !== 'object' || Array.isArray(nested)) throw new Error(`${location}.${objectPath} must be an object`);
    const nestedUnknown = Object.keys(nested).filter((key) => !allowed.has(key));
    if (nestedUnknown.length) throw new Error(`${location}.${objectPath}: fields outside the strict Design Asset runtime allowlist: ${nestedUnknown.join(', ')}`);
  }

  const string = (item, itemPath, {nonEmpty = true} = {}) => {
    if (typeof item !== 'string' || (nonEmpty && !item.trim())) throw new Error(`${itemPath} must be ${nonEmpty ? 'a non-empty ' : 'a '}string`);
  };
  const boolean = (item, itemPath) => {
    if (typeof item !== 'boolean') throw new Error(`${itemPath} must be a boolean`);
  };
  const number = (item, itemPath) => {
    if (typeof item !== 'number' || !Number.isFinite(item)) throw new Error(`${itemPath} must be a finite number`);
  };
  const stringArray = (item, itemPath) => {
    if (!Array.isArray(item) || item.some((entry) => typeof entry !== 'string')) throw new Error(`${itemPath} must be an array of strings only`);
  };
  const object = (item, itemPath) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${itemPath} must be an object`);
  };
  const requireKeys = (item, keys, itemPath) => {
    const absent = keys.filter((key) => !Object.hasOwn(item, key));
    if (absent.length) throw new Error(`${itemPath} required fields missing: ${absent.join(', ')}`);
  };

  for (const key of ['design_asset_id', 'source_id', 'source_model_name', 'category_id', 'asset_state', 'dimensions_state', 'geometry_state']) string(value[key], `${location}.${key}`);
  stringArray(value.style_tags, `${location}.style_tags`);
  stringArray(value.room_roles, `${location}.room_roles`);
  stringArray(value.replacement_benchmarks, `${location}.replacement_benchmarks`);
  if (value.identity_scope !== 'GENERIC_DESIGN_ASSET') throw new Error(`${location}.identity_scope must be GENERIC_DESIGN_ASSET`);
  if (value.target_geometry_level !== 'G2') throw new Error(`${location}.target_geometry_level must be G2`);
  if (value.not_a_product_twin !== true) throw new Error(`${location}.not_a_product_twin must be true`);
  if (value.replacement_search_required !== true) throw new Error(`${location}.replacement_search_required must be true`);

  object(value.license, `${location}.license`);
  requireKeys(value.license, ['spdx_like', 'attribution_required', 'attribution_text', 'source_reference'], `${location}.license`);
  string(value.license.spdx_like, `${location}.license.spdx_like`);
  boolean(value.license.attribution_required, `${location}.license.attribution_required`);
  string(value.license.attribution_text, `${location}.license.attribution_text`);
  string(value.license.source_reference, `${location}.license.source_reference`);

  object(value.attribution, `${location}.attribution`);
  requireKeys(value.attribution, ['creator', 'text', 'license_id', 'source_url', 'display_required'], `${location}.attribution`);
  string(value.attribution.creator, `${location}.attribution.creator`);
  string(value.attribution.text, `${location}.attribution.text`);
  string(value.attribution.license_id, `${location}.attribution.license_id`);
  string(value.attribution.source_url, `${location}.attribution.source_url`);
  boolean(value.attribution.display_required, `${location}.attribution.display_required`);

  if (value.source_dimensions !== null) {
    object(value.source_dimensions, `${location}.source_dimensions`);
    requireKeys(value.source_dimensions, ['source_unit', 'width_cm', 'depth_cm', 'height_cm', 'derived_mm', 'verification_state'], `${location}.source_dimensions`);
    string(value.source_dimensions.source_unit, `${location}.source_dimensions.source_unit`);
    number(value.source_dimensions.width_cm, `${location}.source_dimensions.width_cm`);
    number(value.source_dimensions.depth_cm, `${location}.source_dimensions.depth_cm`);
    number(value.source_dimensions.height_cm, `${location}.source_dimensions.height_cm`);
    string(value.source_dimensions.verification_state, `${location}.source_dimensions.verification_state`);
    object(value.source_dimensions.derived_mm, `${location}.source_dimensions.derived_mm`);
    requireKeys(value.source_dimensions.derived_mm, ['width', 'depth', 'height'], `${location}.source_dimensions.derived_mm`);
    for (const key of ['width', 'depth', 'height']) number(value.source_dimensions.derived_mm[key], `${location}.source_dimensions.derived_mm.${key}`);
  }

  if (value.source_transform !== null) {
    object(value.source_transform, `${location}.source_transform`);
    requireKeys(value.source_transform, ['model_rotation', 'back_face_shown', 'back_face_declared', 'multi_part_model', 'axis_contract'], `${location}.source_transform`);
    boolean(value.source_transform.back_face_shown, `${location}.source_transform.back_face_shown`);
    boolean(value.source_transform.back_face_declared, `${location}.source_transform.back_face_declared`);
    boolean(value.source_transform.multi_part_model, `${location}.source_transform.multi_part_model`);
    string(value.source_transform.axis_contract, `${location}.source_transform.axis_contract`);
    object(value.source_transform.model_rotation, `${location}.source_transform.model_rotation`);
    requireKeys(value.source_transform.model_rotation, ['declared', 'matrix3_row_major'], `${location}.source_transform.model_rotation`);
    boolean(value.source_transform.model_rotation.declared, `${location}.source_transform.model_rotation.declared`);
    const matrix = value.source_transform.model_rotation.matrix3_row_major;
    if (!Array.isArray(matrix) || matrix.length !== 9 || matrix.some((entry) => typeof entry !== 'number' || !Number.isFinite(entry))) throw new Error(`${location}.source_transform.model_rotation.matrix3_row_major must be an array of nine finite numbers`);
    if (value.source_transform.model_rotation.determinant !== undefined) number(value.source_transform.model_rotation.determinant, `${location}.source_transform.model_rotation.determinant`);
  }

  if (value.conversion !== null) {
    object(value.conversion, `${location}.conversion`);
    requireKeys(value.conversion, ['status', 'current_geometry_level', 'maximum_after_visual_and_scale_qa', 'runtime_glb_path', 'envelope_normalization_error_max', 'independent_scale_qa_passed', 'materials', 'remaining_gates'], `${location}.conversion`);
    for (const key of ['status', 'current_geometry_level', 'maximum_after_visual_and_scale_qa', 'runtime_glb_path']) string(value.conversion[key], `${location}.conversion.${key}`);
    number(value.conversion.envelope_normalization_error_max, `${location}.conversion.envelope_normalization_error_max`);
    boolean(value.conversion.independent_scale_qa_passed, `${location}.conversion.independent_scale_qa_passed`);
    stringArray(value.conversion.remaining_gates, `${location}.conversion.remaining_gates`);
    object(value.conversion.materials, `${location}.conversion.materials`);
    requireKeys(value.conversion.materials, ['count', 'embedded_textures', 'source_mtl_materials'], `${location}.conversion.materials`);
    for (const key of ['count', 'embedded_textures', 'source_mtl_materials']) number(value.conversion.materials[key], `${location}.conversion.materials.${key}`);
  }
  return value;
}
