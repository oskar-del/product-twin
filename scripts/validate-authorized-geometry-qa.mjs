import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const JSON_CHUNK = 0x4e4f534a;

function getPath(value, dottedPath) {
  return dottedPath.split('.').reduce((current, key) => current?.[key], value);
}

function collectForbiddenKeys(value, patterns, found = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectForbiddenKeys(item, patterns, found));
    return found;
  }
  if (!value || typeof value !== 'object') return found;
  for (const [key, child] of Object.entries(value)) {
    if (patterns.some((pattern) => key.toLowerCase().includes(pattern.toLowerCase()))) found.push(key);
    collectForbiddenKeys(child, patterns, found);
  }
  return found;
}

function multiply(a, b) {
  const result = Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let index = 0; index < 4; index += 1) result[column * 4 + row] += a[index * 4 + row] * b[column * 4 + index];
    }
  }
  return result;
}

function nodeMatrix(node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) return node.matrix;
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  return [
    (1 - 2 * y * y - 2 * z * z) * sx, (2 * x * y + 2 * z * w) * sx, (2 * x * z - 2 * y * w) * sx, 0,
    (2 * x * y - 2 * z * w) * sy, (1 - 2 * x * x - 2 * z * z) * sy, (2 * y * z + 2 * x * w) * sy, 0,
    (2 * x * z + 2 * y * w) * sz, (2 * y * z - 2 * x * w) * sz, (1 - 2 * x * x - 2 * y * y) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function transformPoint(matrix, point) {
  const [x, y, z] = point;
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
}

export function inspectGlb(buffer) {
  if (buffer.length < 20 || buffer.subarray(0, 4).toString('ascii') !== 'glTF') throw new Error('asset is not a GLB');
  const version = buffer.readUInt32LE(4);
  const declaredLength = buffer.readUInt32LE(8);
  if (version !== 2 || declaredLength !== buffer.length) throw new Error('invalid GLB version or declared length');
  let json;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    if (offset + 8 + chunkLength > buffer.length) throw new Error('GLB chunk exceeds declared length');
    if (chunkType === JSON_CHUNK) json = JSON.parse(buffer.subarray(offset + 8, offset + 8 + chunkLength).toString('utf8').trim());
    offset += 8 + chunkLength;
  }
  if (!json) throw new Error('GLB JSON chunk is missing');
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  let positionAccessorCount = 0;
  const visit = (nodeIndex, parentMatrix) => {
    const node = json.nodes?.[nodeIndex] ?? {};
    const world = multiply(parentMatrix, nodeMatrix(node));
    const mesh = json.meshes?.[node.mesh];
    for (const primitive of mesh?.primitives ?? []) {
      const accessor = json.accessors?.[primitive.attributes?.POSITION];
      if (!accessor || !Array.isArray(accessor.min) || !Array.isArray(accessor.max) || accessor.min.length !== 3 || accessor.max.length !== 3) continue;
      positionAccessorCount += 1;
      for (const x of [accessor.min[0], accessor.max[0]]) for (const y of [accessor.min[1], accessor.max[1]]) for (const z of [accessor.min[2], accessor.max[2]]) {
        const transformed = transformPoint(world, [x, y, z]);
        for (let axis = 0; axis < 3; axis += 1) {
          minimum[axis] = Math.min(minimum[axis], transformed[axis]);
          maximum[axis] = Math.max(maximum[axis], transformed[axis]);
        }
      }
    }
    for (const child of node.children ?? []) visit(child, world);
  };
  const scene = json.scenes?.[json.scene ?? 0];
  for (const nodeIndex of scene?.nodes ?? []) visit(nodeIndex, identity);
  if (!positionAccessorCount || minimum.some((value) => !Number.isFinite(value))) throw new Error('no POSITION accessor bounds found');
  return {
    magic: 'glTF',
    version,
    position_accessor_count: positionAccessorCount,
    bounds_m: { minimum, maximum },
    dimensions_mm: maximum.map((value, index) => (value - minimum[index]) * 1000),
  };
}

function evaluateBounds(actualMm, rule) {
  const sorted = [...actualMm].sort((a, b) => a - b);
  if (rule.mode === 'unordered_axes_tolerance') {
    const expected = [...rule.expected_mm].sort((a, b) => a - b);
    const relativeErrors = expected.map((value, index) => Math.abs(sorted[index] - value) / value);
    return { pass: relativeErrors.every((error) => error <= rule.maximum_relative_error), sorted_actual_mm: sorted, sorted_expected_mm: expected, relative_errors: relativeErrors };
  }
  if (rule.mode === 'long_and_short_axes') {
    const longPass = sorted[2] >= rule.long_axis_range_mm[0] && sorted[2] <= rule.long_axis_range_mm[1];
    const shortPass = sorted.slice(0, 2).every((value) => Math.abs(value - rule.short_axis_expected_mm) <= rule.short_axis_tolerance_mm);
    return { pass: longPass && shortPass, sorted_actual_mm: sorted, long_axis_pass: longPass, short_axes_pass: shortPass };
  }
  return { pass: false, error: `unsupported bounds mode ${rule.mode}` };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function runtimePath(root, relativePath, label) {
  const resolved = path.resolve(root, relativePath ?? '');
  const runtime = path.resolve(root, '.runtime');
  if (!resolved.startsWith(`${runtime}${path.sep}`)) throw new Error(`${label} must remain under gitignored .runtime`);
  return resolved;
}

export async function validateAuthorizedGeometryQa({ root = process.cwd(), evidencePath, now = new Date() } = {}) {
  if (!evidencePath) throw new Error('GEOMETRY_QA_EVIDENCE is required');
  const evidenceFile = runtimePath(root, evidencePath, 'Geometry QA evidence');
  const contract = await readJson(path.join(root, 'config/geometry/authorized-geometry-qa-contract.json'));
  const evidence = await readJson(evidenceFile);
  const target = contract.targets.find((candidate) => candidate.target_id === evidence.target_id);
  if (!target) throw new Error(`No geometry QA contract exists for ${evidence.target_id ?? 'missing target_id'}`);
  const [intakeManifest, intakeMetric] = await Promise.all([
    readJson(path.join(root, target.intake_manifest_path)),
    readJson(path.join(root, target.intake_metric_path)),
  ]);
  const assetPath = runtimePath(root, evidence.converted_asset_path, 'Converted geometry asset');
  const assetBuffer = await fs.readFile(assetPath);
  const assetSha256 = crypto.createHash('sha256').update(assetBuffer).digest('hex');
  let inspection = null;
  let inspectionError = null;
  try { inspection = inspectGlb(assetBuffer); } catch (error) { inspectionError = error.message; }
  const bounds = inspection ? evaluateBounds(inspection.dimensions_mm, target.bounds_rule) : { pass: false, error: inspectionError };
  const forbiddenKeys = collectForbiddenKeys(evidence, contract.forbidden_evidence_key_patterns ?? []);
  const fieldChecks = (target.identity_fields ?? []).map((rule) => ({
    id: `identity:${rule.path}`,
    pass: rule.one_of ? rule.one_of.includes(getPath(evidence, rule.path)) : getPath(evidence, rule.path) === rule.equals,
    actual: getPath(evidence, rule.path) ?? null,
  }));
  const measurementChecks = (target.measurement_fields ?? []).map((rule) => {
    const actual = getPath(evidence, rule.path);
    return { id: `measurement:${rule.path}`, pass: Number.isFinite(actual) && Math.abs(actual - rule.expected) <= rule.tolerance_mm, actual: actual ?? null, expected: rule.expected, tolerance_mm: rule.tolerance_mm };
  });
  const interfaceChecks = (target.interface_fields ?? []).map((rule) => ({ id: `interface:${rule.path}`, pass: getPath(evidence, rule.path) === rule.equals, actual: getPath(evidence, rule.path) ?? null }));
  const rights = evidence.rights ?? {};
  const checks = [
    { id: 'intake_target_binding', pass: intakeManifest.target_id === target.target_id && intakeMetric.target_id === target.target_id },
    { id: 'authorized_intake_state', pass: intakeMetric.status === 'AUTHORIZED_CAPTURE_INTAKE_RECORDED_CONVERSION_QA_REQUIRED' },
    { id: 'source_hash_binding', pass: typeof evidence.source_sha256 === 'string' && evidence.source_sha256 === intakeMetric.source?.sha256 },
    { id: 'converted_glb_runtime_asset', pass: path.extname(assetPath).toLowerCase() === contract.asset_policy.required_extension && inspection?.magic === contract.asset_policy.required_magic && inspection?.version === contract.asset_policy.required_version, error: inspectionError },
    { id: 'converted_asset_hash_declaration', pass: evidence.converted_asset_sha256 === assetSha256 },
    { id: 'physical_scale', pass: bounds.pass, detail: bounds },
    ...fieldChecks,
    ...measurementChecks,
    ...interfaceChecks,
    { id: 'rights_access_binding', pass: rights.access_basis === intakeMetric.authorization?.access_basis && rights.terms_reference === intakeMetric.authorization?.terms_reference && rights.project_reference === intakeMetric.authorization?.project_reference },
    { id: 'project_use_scope', pass: rights.project_use_scope_confirmed === true && contract.rights_policy.allowed_render_scopes.includes(rights.render_scope) },
    { id: 'ephemeral_derivative_storage', pass: rights.derivative_storage_scope === contract.rights_policy.required_derivative_storage_scope },
    { id: 'no_asset_redistribution', pass: rights.asset_redistribution_allowed === contract.rights_policy.asset_redistribution_allowed },
    { id: 'no_binary_or_conversion_commit', pass: rights.manufacturer_binary_committed === contract.rights_policy.manufacturer_binary_committed && rights.converted_asset_committed === contract.rights_policy.converted_asset_committed },
    { id: 'conversion_provenance', pass: typeof evidence.conversion?.tool === 'string' && evidence.conversion.tool.length >= 2 && typeof evidence.conversion?.tool_version === 'string' && evidence.conversion.tool_version.length >= 1 },
    { id: 'no_forbidden_private_fields', pass: forbiddenKeys.length === 0, forbidden_keys: forbiddenKeys },
    { id: 'operator_confirmation', pass: typeof evidence.operator_confirmation === 'string' && evidence.operator_confirmation.length >= 30 },
  ];
  const blocked = checks.filter((check) => !check.pass);
  const metric = {
    generated_at: now.toISOString(),
    target_id: target.target_id,
    status: blocked.length ? 'AUTHORIZED_GEOMETRY_QA_BLOCKED' : target.success_status,
    checks_total: checks.length,
    checks_passed: checks.length - blocked.length,
    blocked_check_ids: blocked.map((check) => check.id),
    source_binding: { intake_id: intakeMetric.intake_id, source_sha256: intakeMetric.source?.sha256 ?? null },
    converted_asset: { file_name: path.basename(assetPath), bytes: assetBuffer.length, sha256: assetSha256, format: inspection?.magic ?? null, version: inspection?.version ?? null },
    geometry: { dimensions_mm: inspection?.dimensions_mm ?? null, position_accessor_count: inspection?.position_accessor_count ?? 0, bounds_evaluation: bounds },
    identity_checks: fieldChecks,
    measurement_checks: measurementChecks,
    interface_checks: interfaceChecks,
    rights: { project_use_scope_confirmed: rights.project_use_scope_confirmed === true, render_scope: rights.render_scope ?? null, derivative_storage_scope: rights.derivative_storage_scope ?? null, asset_redistribution_allowed: rights.asset_redistribution_allowed ?? null, binaries_committed: Boolean(rights.manufacturer_binary_committed || rights.converted_asset_committed) },
    persistence: { manufacturer_binary_committed: false, converted_asset_committed: false, runtime_asset_retained_by_validator: true, evidence_text_persisted: false },
    checks,
  };
  const metricPath = path.resolve(root, target.qa_metric_path);
  const metricRoot = path.resolve(root, 'data/metrics');
  if (!metricPath.startsWith(`${metricRoot}${path.sep}`)) throw new Error('qa_metric_path must remain under data/metrics');
  await fs.mkdir(path.dirname(metricPath), { recursive: true });
  await fs.writeFile(metricPath, JSON.stringify(metric, null, 2) + '\n');
  return metric;
}

async function main() {
  const result = await validateAuthorizedGeometryQa({ evidencePath: process.env.GEOMETRY_QA_EVIDENCE });
  console.log(JSON.stringify(result, null, 2));
  if (result.status === 'AUTHORIZED_GEOMETRY_QA_BLOCKED') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
