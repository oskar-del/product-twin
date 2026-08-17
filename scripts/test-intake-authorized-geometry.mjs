import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { intakeAuthorizedGeometry, signatureState } from './intake-authorized-geometry.mjs';

assert.deepEqual(signatureState('.rfa', Buffer.concat([Buffer.from('d0cf11e0a1b11ae1', 'hex'), Buffer.alloc(256)])), { valid: true, signature: 'OLE_COMPOUND_FILE' });
assert.deepEqual(signatureState('.rvt', Buffer.from('504b030400000000', 'hex')), { valid: false, signature: 'UNEXPECTED' });
assert.deepEqual(signatureState('.zip', Buffer.from('504b030400000000', 'hex')), { valid: true, signature: 'ZIP' });
assert.equal(signatureState('.gsm', Buffer.from('0100000000000000', 'hex')).valid, true);
assert.deepEqual(signatureState('.obj', Buffer.from('# exported model\no fitting\nv 0 0 0\n')), { valid: true, signature: 'WAVEFRONT_OBJ_TEXT' });
assert.deepEqual(signatureState('.ifc', Buffer.from('ISO-10303-21;\nHEADER;')), { valid: true, signature: 'IFC_STEP_TEXT' });
assert.deepEqual(signatureState('.dwg', Buffer.from('AC1032binary payload')), { valid: true, signature: 'AUTOCAD_DWG' });
assert.deepEqual(signatureState('.dxf', Buffer.from('  0\nSECTION\n  2\nHEADER\n')), { valid: true, signature: 'AUTOCAD_DXF_TEXT' });
assert.deepEqual(signatureState('.sat', Buffer.from('700 0 0 1\n23 Spatial ACIS 32.0.1')), { valid: true, signature: 'ACIS_SAT_TEXT' });
assert.deepEqual(signatureState('.fbx', Buffer.from('Kaydara FBX Binary  \u0000')), { valid: true, signature: 'FBX_BINARY' });
assert.deepEqual(signatureState('.fbx', Buffer.from('; FBX 7.4.0 project file')), { valid: true, signature: 'FBX_ASCII' });
assert.equal(signatureState('.obj', Buffer.from('MZ executable')).valid, false);
assert.equal(signatureState('.exe', Buffer.from('4d5a000000000000', 'hex')).valid, false);

const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'authorized-geometry-intake-'));
try {
  const runtime = path.join(tempRoot, '.runtime');
  const manifestDir = path.join(tempRoot, 'config/geometry/intake');
  await fsp.mkdir(runtime, { recursive: true });
  await fsp.mkdir(manifestDir, { recursive: true });
  const sourcePath = path.join(runtime, 'official-model.obj');
  await fsp.writeFile(sourcePath, Buffer.concat([Buffer.from('# official export\no fitting\nv 0 0 0\n'), Buffer.alloc(2048, 32)]));
  await fsp.writeFile(path.join(manifestDir, 'fixture.json'), JSON.stringify({
    intake_id: 'FIXTURE_INTAKE',
    target_id: 'FIXTURE_TARGET',
    expected_identity_values: ['1158140'],
    official_source_urls: ['https://manufacturer.example/model'],
    allowed_extensions: ['.obj'],
    allowed_access_bases: ['authorized_project_use'],
    minimum_bytes: 1000,
    metric_path: 'data/metrics/fixture-latest.json',
    post_intake_gates: ['conversion QA'],
  }));
  const metric = await intakeAuthorizedGeometry({
    root: tempRoot,
    env: {
      GEOMETRY_INTAKE_MANIFEST: 'config/geometry/intake/fixture.json',
      GEOMETRY_FILE: '.runtime/official-model.obj',
      GEOMETRY_ACCESS_BASIS: 'authorized_project_use',
      GEOMETRY_TERMS_REF: 'terms fixture',
      GEOMETRY_PROJECT_REF: 'project fixture',
      GEOMETRY_CONFIRMED_IDENTITY: '1158140',
    },
  });
  assert.equal(metric.status, 'AUTHORIZED_CAPTURE_INTAKE_RECORDED_CONVERSION_QA_REQUIRED');
  assert.equal(metric.source.signature, 'WAVEFRONT_OBJ_TEXT');
  assert.equal(metric.source.sha256.length, 64);
  assert.equal(metric.persistence.manufacturer_binary_copied_by_intake, false);
  assert.equal(JSON.parse(await fsp.readFile(path.join(tempRoot, 'data/metrics/fixture-latest.json'), 'utf8')).target_id, 'FIXTURE_TARGET');
} finally {
  await fsp.rm(tempRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({ status: 'PASS', checks: 18 }, null, 2));
