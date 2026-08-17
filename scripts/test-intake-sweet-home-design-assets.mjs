import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { indexedFurniture, intakeSweetHomeDesignAssets, parseJavaProperties, safeZipEntry } from './intake-sweet-home-design-assets.mjs';

function zip(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('zip', args, { cwd, stdio: ['ignore', 'ignore', 'pipe'] });
    const errors = [];
    child.stderr.on('data', (chunk) => errors.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(Buffer.concat(errors).toString('utf8'))));
  });
}

assert.equal(safeZipEntry('models/chair.obj'), true);
assert.equal(safeZipEntry('../escape.obj'), false);
assert.equal(safeZipEntry('/absolute.obj'), false);
assert.equal(safeZipEntry('C:/absolute.obj'), false);
assert.deepEqual(parseJavaProperties('name#1=Mid-century\\\n sofa\nwidth#1:180\nunicode=V\\u00e5s'), {
  'name#1': 'Mid-centurysofa',
  'width#1': '180',
  unicode: 'Vås',
});
assert.equal(indexedFurniture(parseJavaProperties('name#1=Chair\nmodel#1=models/chair.obj\n')).length, 1);

const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'sweet-home-design-intake-'));
try {
  const runtime = path.join(tempRoot, '.runtime/source');
  const inner = path.join(tempRoot, '.runtime/fixture-library');
  const modelDir = path.join(inner, 'models');
  await fsp.mkdir(runtime, { recursive: true });
  await fsp.mkdir(modelDir, { recursive: true });
  await fsp.mkdir(path.join(tempRoot, 'config/geometry'), { recursive: true });

  await fsp.writeFile(path.join(inner, 'PluginFurnitureCatalog.properties'), [
    'name#1=Mid-century-sofa',
    'category#1=Living room',
    'model#1=models/Mid-century-sofa.obj',
    'width#1=180',
    'depth#1=80',
    'height#1=75',
    'creator#1=Fixture Creator',
    '',
  ].join('\n'));
  await fsp.writeFile(path.join(modelDir, 'Mid-century-sofa.obj'), [
    'mtllib Mid-century-sofa.mtl',
    'o sofa',
    'v 0 0 0',
    'v 1 0 0',
    'v 0 1 0',
    'f 1 2 3',
    '',
  ].join('\n'));
  await fsp.writeFile(path.join(modelDir, 'Mid-century-sofa.mtl'), 'newmtl fabric\nKd 0.4 0.2 0.1\n');

  const sh3fPath = path.join(runtime, 'Fixture.sh3f');
  await zip(['-q', '-r', sh3fPath, '.'], inner);
  const outerPath = path.join(runtime, 'Fixture-library.zip');
  await zip(['-q', outerPath, path.basename(sh3fPath)], runtime);

  await fsp.writeFile(path.join(tempRoot, 'config/geometry/pilot.json'), JSON.stringify({
    source: { source_id: 'fixture_library' },
    intake_rules: {
      benchmark_markets: ['ES', 'SE', 'GB', 'US'],
      required_conversion_checks: ['mesh bounds QA', 'visual QA'],
    },
    candidates: [{
      design_asset_id: 'DA_FIXTURE_SOFA',
      source_model_name: 'Mid-century-sofa',
      category_id: 'FFE.SEATING.SOFA',
      license: { spdx_like: 'CC-BY-3.0', attribution_required: true, attribution_text: 'Fixture', source_reference: 'https://example.com' },
    }],
  }, null, 2));

  const metric = await intakeSweetHomeDesignAssets({
    root: tempRoot,
    env: {
      SH3D_ARCHIVE: '.runtime/source/Fixture-library.zip',
      SH3D_PILOT_CONFIG: 'config/geometry/pilot.json',
    },
  });
  assert.equal(metric.status, 'DESIGN_ASSET_INTAKE_COMPLETE_CONVERSION_QA_REQUIRED');
  assert.equal(metric.summary.matched_candidates, 1);
  assert.equal(metric.summary.extracted_runtime_files, 2);
  assert.equal(metric.assets[0].identity_scope, 'GENERIC_DESIGN_ASSET');
  assert.equal(metric.assets[0].not_a_product_twin, true);
  assert.equal(metric.assets[0].promotion.current_level, 'G0');
  assert.equal(metric.assets[0].promotion.maximum_after_conversion, 'G2');
  assert.deepEqual(metric.assets[0].source_dimensions.derived_mm, { width: 1800, depth: 800, height: 750 });
  assert.equal(metric.assets[0].model.dependencies[0].type, 'material');
  assert.equal((await fsp.stat(path.join(tempRoot, metric.assets[0].model.runtime_path))).isFile(), true);
  assert.equal(JSON.parse(await fsp.readFile(path.join(tempRoot, 'data/metrics/sweet-home-3d-design-asset-intake-latest.json'), 'utf8')).summary.matched_candidates, 1);
} finally {
  await fsp.rm(tempRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({ status: 'PASS', checks: 17, lane: 'GENERIC_DESIGN_ASSET_TO_G2_ONLY' }, null, 2));
