import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {convertDesignAssets, parseMtl, parseObj} from './convert-design-asset-obj-to-glb.mjs';

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
    'usemtl fabric',
    'f 1 2 3 4', 'f 5 8 7 6', 'f 1 5 6 2', 'f 2 6 7 3', 'f 3 7 8 4', 'f 5 1 4 8',
    '',
  ].join('\n'));
  await fsp.writeFile(path.join(modelDir, 'sofa.mtl'), 'newmtl fabric\nKd 0.31 0.12 0.08\nNs 20\n');
  await fsp.writeFile(path.join(root, 'data/metrics/intake.json'), JSON.stringify({
    assets: [{
      design_asset_id: 'DA_FIXTURE_SOFA',
      source_model_name: 'Fixture sofa',
      intake_state: 'DOWNLOADED_UNVERIFIED_CONVERSION_REQUIRED',
      licence: {spdx_like: 'CC-BY-3.0'},
      source_dimensions: {derived_mm: {width: 1800, height: 750, depth: 800}},
      model: {
        runtime_path: '.runtime/design-assets/source/models/sofa.obj',
        dependencies: [{type: 'material', entry: 'models/sofa.mtl'}],
      },
    }],
  }));
  const result = await convertDesignAssets({root, env: {DESIGN_ASSET_INTAKE: 'data/metrics/intake.json'}});
  assert.equal(result.summary.converted, 1);
  const asset = result.assets[0];
  assert.equal(asset.status, 'GLB_SCALE_PASS_VISUAL_QA_REQUIRED');
  assert.equal(asset.current_geometry_level, 'G1');
  assert.equal(asset.maximum_after_visual_qa, 'G2');
  assert.equal(asset.exact_product_claim_allowed, false);
  assert.equal(asset.materials.count, 1);
  assert.equal(asset.mesh.source_triangles, 12);
  assert.ok(asset.relative_error_max < 0.001);
  const glb = await fsp.readFile(path.join(root, asset.runtime_glb_path));
  assert.equal(glb.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(glb.readUInt32LE(8), glb.length);
} finally {
  await fsp.rm(root, {recursive: true, force: true});
}

console.log(JSON.stringify({status: 'PASS', checks: 14, output: 'SCALE_NORMALIZED_MATERIAL_COLOURED_GLB'}, null, 2));
