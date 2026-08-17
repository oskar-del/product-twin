import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

export const FURNITURE_PACKAGE_2_COMMIT = 'c6b227654f312561415388efb0fe06d1401f8b86';
export const FURNITURE_PACKAGE_2_PATH = 'data/verification/packages/furniture-avatar-manifest-v0.1-package-2.json';

const REQUIRED_VIEWS = ['front', 'rear', 'left', 'right', 'three_quarter', 'top', 'floor_contact'];
const REQUIRED_VISUAL_AXES = ['orientation', 'floor_contact', 'silhouette', 'colour', 'transparency', 'texture_uv_quality', 'roughness', 'visible_defects'];
const FORBIDDEN_SUPPLY_KEYS = [
  'sku', 'gtin', 'ean', 'upc', 'price', 'unitprice', 'msrp', 'rrp', 'stock',
  'availability', 'offer', 'offers', 'merchant', 'seller', 'supplier', 'vendor',
  'commerce', 'delivery', 'shipping', 'checkout', 'cart', 'procurement',
  'logistics', 'leadtime', 'landedcost', 'currency', 'market', 'destination',
];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const isHash = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const isFinitePositive = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const normalizeKey = (key) => key.toLowerCase().replace(/[^a-z0-9]/g, '');
const close = (a, b, tolerance = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
const validUri = (value) => {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.startsWith('/') || value.split('/').includes('..')) return false;
  if (!value.includes('://')) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

export function createGitCommitSource({commit = FURNITURE_PACKAGE_2_COMMIT, cwd = process.cwd()} = {}) {
  const buffers = new Map();
  const json = new Map();
  const existence = new Map();
  const readBuffer = (path) => {
    if (!buffers.has(path)) buffers.set(path, execFileSync('git', ['show', `${commit}:${path}`], {cwd, maxBuffer: 64 * 1024 * 1024}));
    return buffers.get(path);
  };
  return {
    commit,
    readBuffer,
    readText: (path) => readBuffer(path).toString('utf8'),
    readJson: (path) => {
      if (!json.has(path)) json.set(path, JSON.parse(readBuffer(path).toString('utf8')));
      return structuredClone(json.get(path));
    },
    exists(path) {
      if (existence.has(path)) return existence.get(path);
      try {
        execFileSync('git', ['cat-file', '-e', `${commit}:${path}`], {cwd, stdio: 'ignore'});
        existence.set(path, true);
      } catch {
        existence.set(path, false);
      }
      return existence.get(path);
    },
    commitDate() {
      return execFileSync('git', ['show', '-s', '--format=%cI', commit], {cwd, encoding: 'utf8'}).trim();
    },
  };
}

function resolveRef(schema, rootSchema) {
  if (!schema?.$ref) return schema;
  if (!schema.$ref.startsWith('#/')) throw new Error(`unsupported schema reference ${schema.$ref}`);
  return schema.$ref.slice(2).split('/').reduce((value, key) => value[key.replaceAll('~1', '/').replaceAll('~0', '~')], rootSchema);
}

function schemaTypeMatches(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isObject(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

function validateSchema(value, rawSchema, rootSchema, path, issues) {
  const schema = resolveRef(rawSchema, rootSchema);
  if (!schema) return;
  if (Array.isArray(schema.oneOf)) {
    const branches = schema.oneOf.map((branch) => {
      const branchIssues = [];
      validateSchema(value, branch, rootSchema, path, branchIssues);
      return branchIssues;
    });
    if (!branches.some((branch) => branch.length === 0)) issues.push({code: 'SCHEMA_ONE_OF_FAILED', path, message: 'value matches no permitted schema branch'});
    return;
  }
  if (Array.isArray(schema.anyOf)) {
    const branches = schema.anyOf.map((branch) => {
      const branchIssues = [];
      validateSchema(value, branch, rootSchema, path, branchIssues);
      return branchIssues;
    });
    if (!branches.some((branch) => branch.length === 0)) issues.push({code: 'SCHEMA_ANY_OF_FAILED', path, message: 'value matches no permitted schema branch'});
    return;
  }
  if (Object.hasOwn(schema, 'const') && value !== schema.const) issues.push({code: 'SCHEMA_CONST_MISMATCH', path, message: `must equal ${JSON.stringify(schema.const)}`});
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) issues.push({code: 'SCHEMA_ENUM_MISMATCH', path, message: `must be one of ${schema.enum.join(', ')}`});
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => schemaTypeMatches(value, type))) {
      issues.push({code: 'SCHEMA_TYPE_MISMATCH', path, message: `must be ${types.join(' or ')}`});
      return;
    }
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) issues.push({code: 'SCHEMA_STRING_TOO_SHORT', path, message: `must contain at least ${schema.minLength} characters`});
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) issues.push({code: 'SCHEMA_PATTERN_MISMATCH', path, message: `must match ${schema.pattern}`});
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) issues.push({code: 'SCHEMA_MINIMUM', path, message: `must be at least ${schema.minimum}`});
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) issues.push({code: 'SCHEMA_ARRAY_TOO_SHORT', path, message: `must contain at least ${schema.minItems} items`});
    if (schema.maxItems !== undefined && value.length > schema.maxItems) issues.push({code: 'SCHEMA_ARRAY_TOO_LONG', path, message: `must contain at most ${schema.maxItems} items`});
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) issues.push({code: 'SCHEMA_ARRAY_NOT_UNIQUE', path, message: 'items must be unique'});
    if (schema.items) value.forEach((item, index) => validateSchema(item, schema.items, rootSchema, `${path}[${index}]`, issues));
  }
  if (isObject(value)) {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) issues.push({code: 'REQUIRED_FIELD_MISSING', path: `${path}.${key}`, message: 'required field is missing'});
    if (schema.additionalProperties === false) for (const key of Object.keys(value)) if (!Object.hasOwn(schema.properties ?? {}, key)) issues.push({code: 'UNKNOWN_FIELD', path: `${path}.${key}`, message: 'field is not allowed by the published schema'});
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) if (Object.hasOwn(value, key)) validateSchema(value[key], childSchema, rootSchema, `${path}.${key}`, issues);
  }
}

function collectForbiddenKeys(value, path = 'value', findings = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenKeys(item, `${path}[${index}]`, findings));
    return findings;
  }
  if (!isObject(value)) return findings;
  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizeKey(key);
    if (FORBIDDEN_SUPPLY_KEYS.some((token) => normalized === token || normalized.startsWith(token) || normalized.endsWith(token))) findings.push(`${path}.${key}`);
    collectForbiddenKeys(child, `${path}.${key}`, findings);
  }
  return findings;
}

function multiplyMatrix(a, b) {
  const result = Array(16).fill(0);
  for (let row = 0; row < 4; row += 1) for (let column = 0; column < 4; column += 1) for (let index = 0; index < 4; index += 1) result[row * 4 + column] += a[row * 4 + index] * b[index * 4 + column];
  return result;
}

function localMatrix(node) {
  if (Array.isArray(node.matrix)) {
    const result = Array(16);
    for (let row = 0; row < 4; row += 1) for (let column = 0; column < 4; column += 1) result[row * 4 + column] = node.matrix[column * 4 + row];
    return result;
  }
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx, (2 * (x * y - z * w)) * sy, (2 * (x * z + y * w)) * sz, tx,
    (2 * (x * y + z * w)) * sx, (1 - 2 * (x * x + z * z)) * sy, (2 * (y * z - x * w)) * sz, ty,
    (2 * (x * z - y * w)) * sx, (2 * (y * z + x * w)) * sy, (1 - 2 * (x * x + y * y)) * sz, tz,
    0, 0, 0, 1,
  ];
}

function transformPoint(matrix, point) {
  return [
    matrix[0] * point[0] + matrix[1] * point[1] + matrix[2] * point[2] + matrix[3],
    matrix[4] * point[0] + matrix[5] * point[1] + matrix[6] * point[2] + matrix[7],
    matrix[8] * point[0] + matrix[9] * point[1] + matrix[10] * point[2] + matrix[11],
  ];
}

function parseGlb(buffer) {
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF' || buffer.readUInt32LE(4) !== 2) throw new Error('not a GLB 2.0 binary');
  if (buffer.readUInt32LE(8) !== buffer.length) throw new Error('GLB declared byte length does not match binary');
  let offset = 12;
  let document;
  let binary;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = buffer.subarray(offset, offset + length);
    offset += length;
    if (type === 0x4e4f534a) document = JSON.parse(chunk.toString('utf8').replace(/[\u0000 ]+$/u, ''));
    if (type === 0x004e4942) binary = chunk;
  }
  if (!document || !binary) throw new Error('GLB JSON or binary chunk missing');
  const component = {
    5120: {bytes: 1, read: (b, o) => b.readInt8(o)},
    5121: {bytes: 1, read: (b, o) => b.readUInt8(o)},
    5122: {bytes: 2, read: (b, o) => b.readInt16LE(o)},
    5123: {bytes: 2, read: (b, o) => b.readUInt16LE(o)},
    5125: {bytes: 4, read: (b, o) => b.readUInt32LE(o)},
    5126: {bytes: 4, read: (b, o) => b.readFloatLE(o)},
  };
  const widths = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16};
  const accessorValues = (index) => {
    const accessor = document.accessors[index];
    if (accessor.sparse) throw new Error('sparse GLB accessors are unsupported by this independent gate');
    const view = document.bufferViews[accessor.bufferView];
    const type = component[accessor.componentType];
    const width = widths[accessor.type];
    if (!type || !width) throw new Error('unsupported GLB accessor type');
    const stride = view.byteStride ?? type.bytes * width;
    const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const values = [];
    for (let row = 0; row < accessor.count; row += 1) {
      const item = [];
      for (let column = 0; column < width; column += 1) item.push(type.read(binary, start + row * stride + column * type.bytes));
      values.push(item);
    }
    return values;
  };
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const instances = [];
  const nodes = document.nodes ?? [];
  const visit = (nodeIndex, parent) => {
    const node = nodes[nodeIndex];
    const world = multiplyMatrix(parent, localMatrix(node));
    if (node.mesh !== undefined) instances.push({mesh: node.mesh, world});
    for (const child of node.children ?? []) visit(child, world);
  };
  const scene = (document.scenes ?? [])[document.scene ?? 0];
  if (scene) for (const node of scene.nodes ?? []) visit(node, identity);
  else for (let mesh = 0; mesh < (document.meshes ?? []).length; mesh += 1) instances.push({mesh, world: identity});
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let positions = 0;
  let triangles = 0;
  for (const instance of instances) for (const primitive of document.meshes[instance.mesh].primitives ?? []) {
    const rawPositions = accessorValues(primitive.attributes.POSITION);
    positions += rawPositions.length;
    for (const point of rawPositions.map((value) => transformPoint(instance.world, value))) for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
    if (primitive.indices !== undefined) triangles += Math.floor(accessorValues(primitive.indices).length / 3);
    else triangles += Math.floor(rawPositions.length / 3);
  }
  if (!positions || min.some((value) => !Number.isFinite(value)) || max.some((value) => !Number.isFinite(value))) throw new Error('GLB has no finite transformed positions');
  return {
    bounds_m: {min, max},
    dimensions_mm: {width: (max[0] - min[0]) * 1000, depth: (max[2] - min[2]) * 1000, height: (max[1] - min[1]) * 1000},
    floor_contact_error_mm: Math.abs(min[1]) * 1000,
    centre_pivot_offset_mm: {x: Math.abs((min[0] + max[0]) * 500), z: Math.abs((min[2] + max[2]) * 500)},
    positions,
    triangles,
    material_count: (document.materials ?? []).length || 1,
    embedded_texture_count: (document.images ?? []).length,
  };
}

function pngDimensions(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature) || buffer.toString('ascii', 12, 16) !== 'IHDR') throw new Error('not a PNG with IHDR');
  return {width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20)};
}

export function loadFurniturePackage2(source) {
  const packageRecord = source.readJson(FURNITURE_PACKAGE_2_PATH);
  const manifestPath = packageRecord.artifacts.find((artifact) => artifact.role === 'MANIFEST')?.path;
  const packageSchemaPath = packageRecord.artifacts.find((artifact) => artifact.role === 'PACKAGE_SCHEMA')?.path;
  const manifestSchemaPath = packageRecord.artifacts.find((artifact) => artifact.role === 'MANIFEST_SCHEMA')?.path;
  const qaPath = packageRecord.artifacts.find((artifact) => artifact.role === 'CANONICAL_QA_METRIC')?.path;
  const reviewPath = packageRecord.artifacts.find((artifact) => artifact.role === 'VISUAL_REVIEW')?.path;
  return {
    packageRecord,
    manifest: source.readJson(manifestPath),
    packageSchema: source.readJson(packageSchemaPath),
    manifestSchema: source.readJson(manifestSchemaPath),
    qa: source.readJson(qaPath),
    review: source.readJson(reviewPath),
    paths: {manifestPath, packageSchemaPath, manifestSchemaPath, qaPath, reviewPath},
  };
}

export function verifyFurniturePackage2(bundle, source, options = {}) {
  const evaluatedAt = options.evaluatedAt ?? new Date().toISOString();
  const issues = [];
  const publicIssues = [];
  const inspected = new Map();
  let checksTotal = 0;
  const check = (condition, code, path, message, target = issues) => {
    checksTotal += 1;
    if (!condition) target.push({code, path, message});
    return condition;
  };
  const inspect = (path, expectedHash = null) => {
    if (inspected.has(path)) return inspected.get(path);
    try {
      const bytes = source.readBuffer(path);
      const record = {path, bytes: bytes.length, sha256: sha256(bytes), state: 'INSPECTED'};
      if (expectedHash !== null) record.expected_sha256 = expectedHash;
      inspected.set(path, record);
      return record;
    } catch (error) {
      const record = {path, bytes: null, sha256: null, state: 'MISSING', error: error.message};
      if (expectedHash !== null) record.expected_sha256 = expectedHash;
      inspected.set(path, record);
      return record;
    }
  };
  const {packageRecord, manifest, packageSchema, manifestSchema, qa, review, paths} = bundle;

  inspect(FURNITURE_PACKAGE_2_PATH);

  check(source.commit === FURNITURE_PACKAGE_2_COMMIT, 'SOURCE_COMMIT_MISMATCH', 'source.commit', `must inspect exact commit ${FURNITURE_PACKAGE_2_COMMIT}`);
  check(packageRecord.source_branch === 'agent/avatar-factory-source-graph', 'SOURCE_BRANCH_MISMATCH', 'package.source_branch', 'package must identify the Avatar Factory source branch');
  check(packageRecord.source_commit === FURNITURE_PACKAGE_2_COMMIT, 'SOURCE_COMMIT_UNDECLARED', 'package.source_commit', 'verification package must bind itself to the exact source commit');
  check(typeof packageRecord.generated_at === 'string' && Number.isFinite(Date.parse(packageRecord.generated_at)), 'EVIDENCE_OBSERVED_AT_MISSING', 'package.generated_at', 'verification package must record an observation/generation time');
  check(['SNAPSHOT', 'CURRENT', 'STALE', 'RECHECK_REQUIRED'].includes(packageRecord.freshness_state), 'EVIDENCE_FRESHNESS_STATE_MISSING', 'package.freshness_state', 'verification package must declare evidence freshness');

  validateSchema(packageRecord, packageSchema, packageSchema, 'package', issues);
  validateSchema(manifest, manifestSchema, manifestSchema, 'manifest', issues);
  checksTotal += 2;

  const artifactPaths = packageRecord.artifacts.map((artifact) => artifact.path);
  check(new Set(artifactPaths).size === artifactPaths.length, 'DUPLICATE_ARTIFACT_PATH', 'package.artifacts', 'artifact paths must be unique');
  check(new Set(packageRecord.artifacts.map((artifact) => artifact.role)).size === packageRecord.artifacts.length, 'DUPLICATE_ARTIFACT_ROLE', 'package.artifacts', 'artifact roles must be unique');
  for (const [index, artifact] of packageRecord.artifacts.entries()) {
    check(validUri(artifact.path), 'PACKAGE_ARTIFACT_URI_INVALID', `package.artifacts[${index}].path`, 'artifact path must be a safe repository-relative URI');
    const record = inspect(artifact.path, artifact.sha256);
    check(record.state === 'INSPECTED', 'PACKAGE_ARTIFACT_MISSING', `package.artifacts[${index}].path`, `${artifact.path} is missing at the source commit`);
    check(isHash(artifact.sha256) && record.sha256 === artifact.sha256, 'PACKAGE_ARTIFACT_HASH_MISMATCH', `package.artifacts[${index}].sha256`, `${artifact.path} does not match its package hash`);
  }

  const expectedAssetProperties = ['placement', 'dimensional_confidence', 'appearance', 'provenance', 'rights', 'attribution', 'publication', 'verification_required'];
  check(expectedAssetProperties.every((key) => Object.hasOwn(manifestSchema?.$defs?.asset?.properties ?? {}, key)), 'MANIFEST_SCHEMA_ASSET_PROPERTIES_MISNESTED', `${paths.manifestSchemaPath}#/$defs/asset/properties`, 'published schema requires fields that it does not permit because asset properties are nested under functional_clearance');
  const qaRendererPath = packageRecord.artifacts.find((artifact) => artifact.role === 'QA_RENDERER')?.path;
  const sharedRendererPath = 'scripts/render-design-asset-qa-pack.py';
  const qaRendererSource = qaRendererPath ? source.readText(qaRendererPath) : '';
  const sharedRendererSource = source.exists(sharedRendererPath) ? source.readText(sharedRendererPath) : '';
  if (source.exists(sharedRendererPath)) inspect(sharedRendererPath);
  const importsSharedRenderer = qaRendererSource.includes('render-design-asset-qa-pack.py');
  check(!importsSharedRenderer || artifactPaths.includes(sharedRendererPath), 'QA_RENDERER_DEPENDENCY_UNBOUND', qaRendererPath ?? 'package.artifacts', 'canonical renderer imports a shared renderer whose hash is absent from Package #2');
  const directionalFrontLabelsReversed = qaRendererSource.includes('camera = tuple(-v for v in front)')
    && qaRendererSource.includes('view_specs["front"] = {"direction": camera')
    && sharedRendererSource.includes('eye = center + direction * diagonal * 3.0');

  const ids = manifest.assets.map((asset) => asset.asset_id);
  check(ids.every((id) => typeof id === 'string' && /^[A-Z][A-Z0-9_]{2,127}$/.test(id)), 'ASSET_ID_INVALID', 'manifest.assets', 'every asset must have a stable uppercase ID');
  check(new Set(ids).size === ids.length, 'DUPLICATE_ASSET_ID', 'manifest.assets', 'asset IDs must be unique');
  const qaById = new Map(qa.assets.map((asset) => [asset.asset_id, asset]));
  const reviewById = new Map(review.assets.map((asset) => [asset.asset_id, asset]));
  const assetDecisions = [];

  for (const [index, asset] of manifest.assets.entries()) {
    const base = `manifest.assets[${index}]`;
    const assetIssuesStart = issues.length;
    check(['PRODUCT_TWIN', 'DESIGN_ASSET'].includes(asset.record_lane), 'SOURCE_LANE_INVALID', `${base}.record_lane`, 'lane must be Product Twin or Design Asset');
    if (asset.record_lane === 'PRODUCT_TWIN') {
      check(asset.product_identity?.verification_state === 'VERIFIED_EXACT', 'PRODUCT_TWIN_IDENTITY_UNVERIFIED', `${base}.product_identity`, 'Product Twin requires verified exact identity evidence');
      check(typeof asset.product_identity?.source_url === 'string' && asset.product_identity.source_url.startsWith('https://'), 'PRODUCT_TWIN_IDENTITY_SOURCE_INVALID', `${base}.product_identity.source_url`, 'Product Twin identity needs an HTTPS source');
    } else {
      check(asset.product_identity === null, 'DESIGN_ASSET_PRODUCT_IDENTITY_FORBIDDEN', `${base}.product_identity`, 'Design Asset cannot carry product identity');
      for (const path of collectForbiddenKeys(asset, base)) check(false, 'DESIGN_ASSET_COMMERCE_LEAK', path, 'Design Asset contains a commerce, supplier, delivery, or procurement alias');
    }
    for (const path of collectForbiddenKeys({appearance: asset.appearance, geometry: asset.geometry, placement: asset.placement, spatial: {collision_envelope: asset.collision_envelope, functional_clearance: asset.functional_clearance}}, base)) check(false, 'AVATAR_SUPPLY_LEAK', path, 'furniture avatar manifest must not carry market or destination supply evidence');

    check(['G0', 'G1', 'G2', 'G3', 'G4', 'G5'].includes(asset.geometry.level), 'GEOMETRY_LEVEL_INVALID', `${base}.geometry.level`, 'geometry level must be G0-G5');
    check(isObject(asset.dimensions) && ['width', 'depth', 'height'].every((axis) => isFinitePositive(asset.dimensions[axis])) && asset.dimensions.unit === 'mm', 'DIMENSIONS_INVALID', `${base}.dimensions`, 'dimensions must be finite positive millimetres');
    check(asset.appearance?.confidence !== asset.dimensional_confidence, 'GEOMETRY_APPEARANCE_CONFIDENCE_COLLAPSED', base, 'geometry/dimensional confidence must remain separate from appearance confidence');
    const geometryUriValid = validUri(asset.geometry.uri);
    check(geometryUriValid, 'GEOMETRY_URI_INVALID', `${base}.geometry.uri`, 'geometry URI must be HTTPS or a safe repository-relative path');
    check(asset.attribution?.required === true, 'ATTRIBUTION_REQUIREMENT_REMOVED', `${base}.attribution.required`, 'attribution requirement cannot be removed');
    check(typeof asset.attribution?.display_text === 'string' && asset.attribution.display_text.trim().length > 0, 'ATTRIBUTION_PAYLOAD_MISSING', `${base}.attribution.display_text`, 'attribution display text is required');
    check(Array.isArray(asset.attribution?.required_surfaces) && asset.attribution.required_surfaces.length > 0, 'ATTRIBUTION_SURFACES_MISSING', `${base}.attribution.required_surfaces`, 'attribution must declare required display surfaces');

    for (const [provenanceIndex, provenance] of (asset.provenance ?? []).entries()) {
      check(validUri(provenance.uri), 'PROVENANCE_URI_INVALID', `${base}.provenance[${provenanceIndex}].uri`, 'provenance URI must be HTTPS or a safe repository-relative path');
      if (/^https:\/\//.test(provenance.uri)) continue;
      const record = inspect(provenance.uri, provenance.sha256);
      check(record.state === 'INSPECTED', 'PROVENANCE_FILE_MISSING', `${base}.provenance[${provenanceIndex}].uri`, `${provenance.uri} is missing`);
      check(record.sha256 === provenance.sha256, 'PROVENANCE_HASH_MISMATCH', `${base}.provenance[${provenanceIndex}].sha256`, `${provenance.uri} does not match its provenance hash`);
    }

    const isPrimary = asset.primary_selection === true;
    const isGlb = asset.geometry.format === 'GLB';
    let glb = null;
    if (isGlb && geometryUriValid) {
      const geometryRecord = inspect(asset.geometry.uri, asset.geometry.sha256);
      check(geometryRecord.state === 'INSPECTED', 'GEOMETRY_BINARY_MISSING', `${base}.geometry.uri`, `${asset.geometry.uri} is missing`);
      check(geometryRecord.sha256 === asset.geometry.sha256, 'GEOMETRY_HASH_MISMATCH', `${base}.geometry.sha256`, 'manifest-to-GLB hash binding failed');
      check(geometryRecord.bytes === asset.geometry.bytes, 'GEOMETRY_BYTE_COUNT_MISMATCH', `${base}.geometry.bytes`, 'manifest byte count differs from GLB');
      try {
        glb = parseGlb(source.readBuffer(asset.geometry.uri));
      } catch (error) {
        check(false, 'GLB_PARSE_FAILED', `${base}.geometry.uri`, error.message);
      }
    }
    if (glb) {
      for (const axis of ['width', 'depth', 'height']) check(close(glb.dimensions_mm[axis], asset.dimensions[axis], Math.max(0.01, asset.dimensions[axis] * 0.001)), 'GLB_DIMENSION_MISMATCH', `${base}.dimensions.${axis}`, `independent GLB bounds are ${glb.dimensions_mm[axis]}mm`);
      check(glb.floor_contact_error_mm <= 0.01, 'GLB_FLOOR_CONTACT_FAILED', `${base}.orientation.floor_anchor`, `independent floor error is ${glb.floor_contact_error_mm}mm`);
      check(glb.centre_pivot_offset_mm.x <= 0.01 && glb.centre_pivot_offset_mm.z <= 0.01, 'GLB_FLOOR_PIVOT_FAILED', `${base}.orientation.origin`, 'independent X/Z floor pivot is not centred');
      check(['width', 'depth', 'height'].every((axis) => close(asset.collision_envelope[axis], asset.dimensions[axis], 0.01)), 'COLLISION_ENVELOPE_MISMATCH', `${base}.collision_envelope`, 'collision envelope must match independently measured planning bounds');
    }

    const g2OrHigher = ['G2', 'G3', 'G4', 'G5'].includes(asset.geometry.level);
    if (g2OrHigher) {
      check(asset.independent_scale?.state === 'PASS', 'G2_INDEPENDENT_SCALE_MISSING', `${base}.independent_scale`, 'G2+ requires an independent scale pass');
      check(Array.isArray(asset.independent_scale?.evidence) && asset.independent_scale.evidence.length >= 2, 'G2_SCALE_EVIDENCE_INCOMPLETE', `${base}.independent_scale.evidence`, 'G2+ requires source dimensions and binary measurement evidence');
      check(!/DECLARED[_ ]ENVELOPE/i.test(asset.independent_scale?.method ?? ''), 'G2_DECLARED_ENVELOPE_ONLY', `${base}.independent_scale.method`, 'a declared envelope is not independent dimension evidence');
      const twinProvenance = (asset.provenance ?? []).find((item) => item.kind === 'PRODUCT_TWIN_RECORD');
      let twinRecord = null;
      if (twinProvenance && source.exists(twinProvenance.uri)) twinRecord = source.readJson(twinProvenance.uri);
      check(typeof twinRecord?.physical?.evidence_observed_at === 'string' || typeof twinRecord?.observed_at === 'string', 'G2_DIMENSION_SOURCE_OBSERVATION_UNBOUND', `${base}.independent_scale.evidence`, 'dimension source observation time is not bound into the Product Twin evidence record');
      check(['SNAPSHOT', 'CURRENT', 'STALE', 'RECHECK_REQUIRED'].includes(twinRecord?.physical?.freshness_state ?? twinRecord?.freshness_state), 'G2_DIMENSION_SOURCE_FRESHNESS_UNBOUND', `${base}.independent_scale.evidence`, 'dimension evidence has no explicit freshness state');
    }
    if (['G3', 'G4', 'G5'].includes(asset.geometry.level)) check(asset.geometry.exact_likeness_claimed === true && asset.appearance?.confidence === 'HIGH' && asset.appearance?.exact_finish_claimed === true, 'G_LEVEL_EVIDENCE_INSUFFICIENT', `${base}.geometry.level`, `${asset.geometry.level} requires exact form and high-confidence exact appearance evidence`);
    if (['G4', 'G5'].includes(asset.geometry.level)) check(Array.isArray(asset.technical_interface_evidence) && asset.technical_interface_evidence.length > 0, 'G4_TECHNICAL_EVIDENCE_MISSING', `${base}.technical_interface_evidence`, 'G4+ requires technical interface evidence');
    if (asset.geometry.level === 'G5') check(asset.manufacturing_authority_verified === true, 'G5_MANUFACTURING_AUTHORITY_MISSING', `${base}.manufacturing_authority_verified`, 'G5 requires manufacturing-authority evidence');

    const qaAsset = qaById.get(asset.asset_id);
    const reviewAsset = reviewById.get(asset.asset_id);
    if (isPrimary) {
      check(Boolean(qaAsset), 'CANONICAL_QA_RECORD_MISSING', `${base}.asset_id`, 'primary asset needs a canonical QA record');
      check(Boolean(reviewAsset), 'VISUAL_REVIEW_RECORD_MISSING', `${base}.asset_id`, 'primary asset needs a visual review record');
      if (qaAsset) {
        check(qaAsset.geometry_sha256 === asset.geometry.sha256, 'QA_GEOMETRY_HASH_MISMATCH', `${base}.geometry.sha256`, 'canonical QA is not bound to the promoted GLB');
        check(new Set(qaAsset.views.map((view) => view.view)).size === REQUIRED_VIEWS.length && REQUIRED_VIEWS.every((view) => qaAsset.views.some((item) => item.view === view)), 'CANONICAL_VIEW_SET_INCOMPLETE', `${base}.qa.views`, 'all seven unique canonical views are required');
        check(qaAsset.automated_checks?.floor_contact_error_mm <= 0.01, 'QA_FLOOR_CONTACT_FAILED', `${base}.qa.floor_contact`, 'canonical QA floor contact failed');
        check(qaAsset.automated_checks?.max_dimension_relative_error <= 0.001, 'QA_SCALE_FAILED', `${base}.qa.dimensions`, 'canonical QA scale error exceeds 0.1%');
        const qaBase = `${qa.qa_pack.directory}/${qaAsset.asset_directory}`;
        for (const [viewIndex, view] of qaAsset.views.entries()) {
          const viewPath = `${qaBase}/${view.file}`;
          const record = inspect(viewPath, view.sha256);
          check(record.sha256 === view.sha256 && record.bytes === view.bytes, 'CANONICAL_VIEW_HASH_MISMATCH', `${base}.qa.views[${viewIndex}]`, `${viewPath} does not match its metric`);
          try {
            const png = pngDimensions(source.readBuffer(viewPath));
            check(png.width === 640 && png.height === 640, 'CANONICAL_VIEW_DIMENSIONS_INVALID', `${base}.qa.views[${viewIndex}]`, 'canonical view must be 640x640 PNG');
          } catch (error) {
            check(false, 'CANONICAL_VIEW_PNG_INVALID', `${base}.qa.views[${viewIndex}]`, error.message);
          }
        }
      }
      if (reviewAsset) for (const axis of REQUIRED_VISUAL_AXES) check(typeof reviewAsset[axis] === 'string' && reviewAsset[axis].trim().length > 0, 'VISUAL_QA_AXIS_MISSING', `${base}.visual_review.${axis}`, `visual QA must score ${axis}`);
      if (asset.orientation.front_state === 'DECLARED') {
        check(Array.isArray(asset.orientation.front_vector) && asset.orientation.front_vector.length === 3 && close(Math.hypot(...asset.orientation.front_vector), 1, 1e-9), 'ORIENTATION_FRONT_VECTOR_INVALID', `${base}.orientation.front_vector`, 'directional asset needs a normalized front vector');
        const cameraSide = qaAsset?.views.find((view) => view.view === 'front')?.camera_side_vector;
        check(cameraSide?.length === 3, 'ORIENTATION_VIEW_CAMERA_EVIDENCE_MISSING', `${base}.qa.views.front.camera_side_vector`, 'directional canonical view must record the camera side vector');
        if (cameraSide?.length === 3) check(cameraSide.every((value, axis) => close(value, asset.orientation.front_vector[axis], 1e-9)), 'ORIENTATION_VIEW_CAMERA_SIDE_MISMATCH', `${base}.qa.views.front.camera_side_vector`, 'front camera must be located on the declared front side');
        check(!directionalFrontLabelsReversed, 'CANONICAL_FRONT_REAR_LABEL_REVERSED', `${base}.qa.views`, 'renderer places the front camera opposite the declared front vector; the sofa contact sheet visibly labels its smooth back as front');
      }
      const zones = asset.functional_clearance?.zones;
      check(asset.functional_clearance?.state === 'VERIFIED' && Array.isArray(zones) && zones.length > 0, 'FUNCTIONAL_CLEARANCE_UNVERIFIED', `${base}.functional_clearance`, 'Room Alpha hard constraints require verified functional clearance');
      if (Array.isArray(zones)) for (const [zoneIndex, zone] of zones.entries()) {
        check(isFinitePositive(zone.distance_mm), 'FUNCTIONAL_CLEARANCE_DISTANCE_INVALID', `${base}.functional_clearance.zones[${zoneIndex}].distance_mm`, 'clearance distance must be finite and positive');
        check(typeof zone.shape === 'string' && typeof zone.reference_frame === 'string', 'FUNCTIONAL_CLEARANCE_ENVELOPE_INCOMPLETE', `${base}.functional_clearance.zones[${zoneIndex}]`, 'clearance zone needs an explicit shape and reference frame');
      }
    }

    if (asset.publication?.public_allowed === true) {
      check(asset.rights?.redistribution_state === 'PUBLIC_REDISTRIBUTION_ALLOWED' && asset.rights?.rendering_state === 'PUBLIC_RENDERING_ALLOWED', 'PUBLIC_RIGHTS_BYPASS', `${base}.rights`, 'public publication requires explicit public rendering and redistribution rights; internal proxy permission is insufficient');
      check(asset.attribution?.display_state === 'VERIFIED_ALL_REQUIRED_SURFACES', 'PUBLIC_ATTRIBUTION_BYPASS', `${base}.attribution.display_state`, 'public publication requires verified attribution display');
    } else if (isPrimary) {
      check(false, 'PUBLIC_RIGHTS_APPROVAL_MISSING', `${base}.rights`, 'independent public rights approval is not recorded', publicIssues);
      check(false, 'PUBLIC_ATTRIBUTION_DISPLAY_UNVERIFIED', `${base}.attribution.display_state`, 'attribution is not verified on all required surfaces', publicIssues);
    }

    const newAssetIssues = issues.slice(assetIssuesStart).map((issue) => issue.code);
    assetDecisions.push({
      asset_id: asset.asset_id,
      role: asset.role,
      lane: asset.record_lane,
      geometry_level: asset.geometry.level,
      binary_geometry: glb && newAssetIssues.every((code) => !['GEOMETRY_URI_INVALID', 'GEOMETRY_BINARY_MISSING', 'GEOMETRY_HASH_MISMATCH', 'GEOMETRY_BYTE_COUNT_MISMATCH', 'GLB_PARSE_FAILED', 'GLB_DIMENSION_MISMATCH', 'GLB_FLOOR_CONTACT_FAILED', 'GLB_FLOOR_PIVOT_FAILED'].includes(code)) ? 'PASS' : 'BLOCK',
      room_alpha_promotion: isPrimary && newAssetIssues.length === 0 ? 'PASS' : 'BLOCK',
      public_publication: 'BLOCK',
      failed_gates: [...new Set(newAssetIssues)],
    });
  }

  const primaryIds = manifest.assets.filter((asset) => asset.primary_selection).map((asset) => asset.asset_id);
  check(primaryIds.length === 4, 'PRIMARY_ASSET_COUNT_INVALID', 'manifest.summary.primary_assets', 'Package #2 must contain four primary Room Alpha assets');
  check(packageRecord.expected_gate_state.publicly_publishable === 0 && manifest.summary.publicly_publishable === 0, 'PUBLICATION_COUNT_ESCALATION', 'package.expected_gate_state.publicly_publishable', 'package must remain fail-closed for public publication');

  const master = inspect(`${qa.qa_pack.directory}/${qa.qa_pack.master_contact_sheet}`, qa.qa_pack.master_contact_sheet_sha256);
  check(master.sha256 === qa.qa_pack.master_contact_sheet_sha256, 'MASTER_CONTACT_SHEET_HASH_MISMATCH', 'qa.qa_pack.master_contact_sheet_sha256', 'master contact sheet hash mismatch');

  const inspectedFiles = [...inspected.values()].sort((a, b) => a.path.localeCompare(b.path));
  const failedGateCodes = [...new Set(issues.map((issue) => issue.code))].sort();
  const publicGateCodes = [...new Set(publicIssues.map((issue) => issue.code))].sort();
  return {
    schema_version: '0.1',
    result_id: 'INDEPENDENT_FURNITURE_AVATAR_PACKAGE_2_RESULT',
    evaluated_at: evaluatedAt,
    verifier: 'VERIFICATION_EVIDENCE_MONITORING',
    source: {branch: 'agent/avatar-factory-source-graph', commit_sha: source.commit, package_path: FURNITURE_PACKAGE_2_PATH},
    decision: issues.length === 0 ? 'APPROVE' : 'BLOCK',
    eligibility: {
      package_acceptance: issues.length === 0 ? 'PASS' : 'BLOCK',
      internal_room_alpha: assetDecisions.filter((item) => item.room_alpha_promotion === 'PASS').length === 4 ? 'PASS' : 'BLOCK',
      public_publication: publicIssues.length === 0 && manifest.assets.filter((asset) => asset.primary_selection).every((asset) => asset.publication.public_allowed) ? 'PASS' : 'BLOCK',
    },
    checks: {total: checksTotal, passed: Math.max(0, checksTotal - issues.length - publicIssues.length), failed: issues.length, public_failed: publicIssues.length},
    failed_gate_codes: failedGateCodes,
    failed_gates: issues,
    public_failed_gate_codes: publicGateCodes,
    public_failed_gates: publicIssues,
    asset_decisions: assetDecisions,
    evidence_files_inspected: inspectedFiles,
    evidence_freshness: [
      {scope: 'PACKAGE', observed_at: packageRecord.generated_at ?? null, freshness_state: packageRecord.freshness_state ?? 'UNDECLARED'},
      {scope: 'SOURCE_COMMIT', observed_at: options.sourceCommitDate ?? null, freshness_state: 'SNAPSHOT'},
      {scope: 'DIMENSION_SOURCE_RECORDS', observed_at: null, freshness_state: 'UNDECLARED'},
    ],
    observed_passes: {
      package_artifacts: `${packageRecord.artifacts.length - issues.filter((issue) => issue.code.startsWith('PACKAGE_ARTIFACT_')).length}/${packageRecord.artifacts.length}`,
      primary_glb_hash_and_bounds: `${assetDecisions.filter((item) => item.binary_geometry === 'PASS' && primaryIds.includes(item.asset_id)).length}/4`,
      canonical_views_hashed: `${qa.assets.reduce((total, asset) => total + asset.views.length, 0)}/28`,
      public_assets: 0,
    },
    reproduction_commands: [
      `git fetch --no-tags origin ${FURNITURE_PACKAGE_2_COMMIT}`,
      `node scripts/verify-furniture-avatar-package-2.mjs --source-commit ${FURNITURE_PACKAGE_2_COMMIT}`,
      'node scripts/test-furniture-avatar-package-2.mjs',
      'git diff --check',
    ],
    policy: 'A deterministic failure is not waivable by a verifier, model, workstream, build pass, or prose judgement.',
    paths,
  };
}

export const internalsForTest = {parseGlb, pngDimensions, validateSchema, collectForbiddenKeys};
