import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fsp from 'node:fs/promises';

const metric = JSON.parse(await fsp.readFile('data/metrics/kator-legaz-design-asset-visual-qa-v0.1.json', 'utf8'));
assert.equal(metric.summary.assets, 12);
assert.equal(metric.summary.rendered_views, 84);
for (const asset of metric.assets) {
  assert.equal(asset.views.length, 7);
  for (const view of asset.views) {
    assert.deepEqual(view.diagnostic_overlays, ['canonical_axes', 'mechanical_origin_pivot', 'bounds', 'sampled_face_normals', 'back_face_counts']);
    for (const field of ['front_facing_triangles', 'back_facing_triangles', 'culled_back_faces']) assert.equal(Number.isInteger(view[field]), true);
    assert.equal(view.front_facing_triangles + view.back_facing_triangles + view.degenerate_triangles, asset.automated_checks.triangle_count);
  }
}

const glass = metric.assets.find((asset) => asset.design_asset_id === 'DA_SH3D_KL_GLASS_DINING_TABLE');
assert.equal(glass.automated_checks.alpha_material_count, 1);
const glb = await fsp.readFile('.runtime/design-assets/converted/da_sh3d_kl_glass_dining_table.glb');
let document;
for (let offset = 12; offset + 8 <= glb.length;) {
  const length = glb.readUInt32LE(offset);
  const type = glb.readUInt32LE(offset + 4);
  if (type === 0x4e4f534a) document = JSON.parse(glb.subarray(offset + 8, offset + 8 + length).toString('utf8').trim());
  offset += 8 + length;
}
const tabletop = document.materials.find((material) => material.name === 'tabletop');
assert.equal(tabletop.alphaMode, 'BLEND');
assert.equal(tabletop.pbrMetallicRoughness.baseColorFactor[3], 0.65);

const alphaRegression = spawnSync('python3', ['-c', [
  'import importlib.util',
  'import sys',
  'from pathlib import Path',
  'from PIL import Image',
  'p=Path("scripts/render-design-asset-qa-pack.py")',
  's=importlib.util.spec_from_file_location("qa_renderer", p)',
  'm=importlib.util.module_from_spec(s)',
  'sys.modules[s.name]=m',
  's.loader.exec_module(m)',
  'i=Image.new("RGBA", (5,5), (255,255,255,255))',
  'o=m.composite_polygon(i, [(0,0),(4,0),(4,4),(0,4)], (0,0,0,128))',
  'assert o.getpixel((2,2)) == (127,127,127,255), o.getpixel((2,2))',
].join(';')], {encoding: 'utf8'});
assert.equal(alphaRegression.status, 0, alphaRegression.stderr || alphaRegression.stdout);

console.log(JSON.stringify({status: 'PASS', assets: 12, views: 84, diagnostic_overlays: 5, glass_alpha_composite: 'PASS'}));
