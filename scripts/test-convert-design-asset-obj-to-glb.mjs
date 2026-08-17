import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {convertDesignAssets, inspectGlb, parseMtl, parseObj} from './convert-design-asset-obj-to-glb.mjs';

assert.equal(parseObj('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n').faces.length, 1);
assert.equal(parseObj('v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf 1 2 3 4\n').faces.length, 2);
assert.deepEqual(parseMtl('newmtl oak\nKd 0.5 0.3 0.1\nNs 100\n').get('oak').color, [0.5, 0.3, 0.1]);

const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'design-asset-convert-'));
try {
  const modelDir = path.join(root, '.runtime/design-assets/source/models');
  await fsp.mkdir(modelDir, {recursive: true});
  await fsp.mkdir(path.join(root, 'data/metrics'), {recursive: true});
  await fsp.writeFile(path.join(modelDir, 'sofa.obj'), [
    'mtllib sofa.mtl',
    'v 0 0 0', 'v 2 0 0', 'v 2 1 0', 'v 0 1 0',
    'v 0 0 1', 'v 2 0 1', 'v 2 1 1', 'v 0 1 1',
    'vt 0 0', 'vt 1 0', 'vt 1 1', 'vt 0 1',
    'vt 0 0', 'vt 1 0', 'vt 1 1', 'vt 0 1',
    'usemtl fabric',
    'f 1/1 2/2 3/3 4/4', 'f 5/5 8/8 7/7 6/6', 'f 1/1 5/5 6/6 2/2', 'f 2/2 6/6 7/7 3/3', 'f 3/3 7/7 8/8 4/4', 'f 5/5 1/1 4/4 8/8',
    '',
  ].join('\n'));
  await fsp.writeFile(path.join(modelDir, 'sofa.mtl'), 'newmtl fabric\nKd 0.31 0.12 0.08\nNs 20\nmap_Kd fabric.png\n');
  await fsp.writeFile(path.join(modelDir, 'fabric.png'), Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc00000040101005f3f6fea0000000049454e44ae426082', 'hex'));
  await fsp.writeFile(path.join(root, 'data/metrics/intake.json'), JSON.stringify({
    assets: [{
      design_asset_id: 'DA_FIXTURE_SOFA',
      source_model_name: 'Fixture sofa',
      intake_state: 'DOWNLOADED_UNVERIFIED_CONVERSION_REQUIRED',
      identity_scope: 'GENERIC_DESIGN_ASSET',
      not_a_product_twin: true,
      license: {spdx_like: 'CC-BY-3.0'},
      attribution: {creator: 'Fixture Creator', text: 'Fixture attribution', license_id: 'CC-BY-3.0', source_url: 'https://example.com', display_required: true},
      source_dimensions: {derived_mm: {width: 1800, height: 750, depth: 800}},
      source_transform: {model_rotation: {declared: true, matrix3_row_major: [0, 0, 1, 0, 1, 0, -1, 0, 0]}, back_face_shown: false},
      model: {
        runtime_path: '.runtime/design-assets/source/models/sofa.obj',
        dependencies: [
          {type: 'material', entry: 'models/sofa.mtl', runtime_path: '.runtime/design-assets/source/models/sofa.mtl', required: true, state: 'RESOLVED'},
          {type: 'texture', reference: 'fabric.png', parent_entry: 'models/sofa.mtl', entry: 'models/fabric.png', runtime_path: '.runtime/design-assets/source/models/fabric.png', required: true, state: 'RESOLVED'},
        ],
      },
    }, {
      design_asset_id: 'DA_FIXTURE_BLOCKED',
      source_model_name: 'Blocked fixture',
      intake_state: 'DOWNLOADED_UNVERIFIED_CONVERSION_REQUIRED',
      identity_scope: 'GENERIC_DESIGN_ASSET',
      not_a_product_twin: true,
      source_dimensions: {derived_mm: {width: 1000, height: 1000, depth: 1000}},
      model: {runtime_path: '.runtime/design-assets/source/models/sofa.obj', dependencies: [{type: 'material', entry: 'models/missing.mtl', required: true, state: 'MISSING'}]},
    }],
  }));
  const result = await convertDesignAssets({root, env: {DESIGN_ASSET_INTAKE: 'data/metrics/intake.json'}});
  assert.equal(result.summary.converted, 1);
  assert.equal(result.summary.blocked_or_failed, 1);
  const asset = result.assets[0];
  assert.equal(asset.status, 'GLB_CONVERTED_DECLARED_ENVELOPE_APPLIED_VISUAL_QA_REQUIRED');
  assert.equal(asset.current_geometry_level, 'G1');
  assert.equal(asset.maximum_after_visual_and_scale_qa, 'G2');
  assert.equal(asset.independent_scale_qa_passed, false);
  assert.equal(asset.exact_product_claim_allowed, false);
  assert.equal(asset.materials.count, 1);
  assert.equal(asset.materials.embedded_textures, 1);
  assert.equal(asset.mesh.source_triangles, 12);
  assert.ok(asset.envelope_normalization_error_max < 0.001);
  assert.equal(asset.normalization.kind, 'DECLARED_ENVELOPE_NON_UNIFORM');
  assert.equal(result.assets[1].status, 'BLOCKED_CONVERSION_INPUT_INVALID');
  assert.match(result.assets[1].blockers[0], /dependencies unresolved/);
  const glb = await fsp.readFile(path.join(root, asset.runtime_glb_path));
  assert.equal(glb.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(glb.readUInt32LE(8), glb.length);
  const document = inspectGlb(glb);
  assert.equal(document.images.length, 1);
  assert.equal(document.textures.length, 1);
  assert.equal(document.materials[0].doubleSided, false);
  assert.equal(document.materials[0].pbrMetallicRoughness.baseColorTexture.index, 0);
  assert.equal(document.asset.extras.attribution.text, 'Fixture attribution');
  assert.equal(document.asset.extras.independent_scale_qa_passed, false);
} finally {
  await fsp.rm(root, {recursive: true, force: true});
}

console.log(JSON.stringify({status: 'PASS', checks: 25, output: 'DECLARED_ENVELOPE_G1_TEXTURE_EMBEDDED_GLB'}));
