import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inspectGlb, validateAuthorizedGeometryQa } from './validate-authorized-geometry-qa.mjs';

function fixtureGlb(dimensionsMm, node = {}) {
  const half = dimensionsMm.map((value) => value / 2000);
  const json = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, ...node }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ componentType: 5126, count: 8, type: 'VEC3', min: half.map((value) => -value), max: half }],
  };
  const body = Buffer.from(JSON.stringify(json));
  const padding = Buffer.alloc((4 - (body.length % 4)) % 4, 0x20);
  const chunk = Buffer.concat([body, padding]);
  const header = Buffer.alloc(20);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + chunk.length, 8);
  header.writeUInt32LE(chunk.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, chunk]);
}

const transformed = fixtureGlb([600, 380, 70]);
assert.deepEqual(inspectGlb(transformed).dimensions_mm.map(Math.round), [600, 380, 70]);
const quarterTurn = Math.sqrt(0.5);
const rotated = fixtureGlb([600, 380, 70], { rotation: [0, 0, quarterTurn, quarterTurn], translation: [1, 2, 3] });
assert.deepEqual(inspectGlb(rotated).dimensions_mm.map(Math.round), [380, 600, 70]);

const sourceRoot = process.cwd();
const contract = JSON.parse(await fs.readFile(path.join(sourceRoot, 'config/geometry/authorized-geometry-qa-contract.json'), 'utf8'));
const manifests = await Promise.all(contract.targets.map((target) => fs.readFile(path.join(sourceRoot, target.intake_manifest_path), 'utf8')));
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'authorized-geometry-qa-'));

function targetIndex(targetId) {
  const index = contract.targets.findIndex((target) => target.target_id === targetId);
  assert.notEqual(index, -1, `missing QA target ${targetId}`);
  return index;
}

function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }

async function writeTarget(targetIndex, dimensionsMm, evidenceValues) {
  const target = contract.targets[targetIndex];
  const manifestPath = path.join(tempRoot, target.intake_manifest_path);
  const intakePath = path.join(tempRoot, target.intake_metric_path);
  const assetRelative = `.runtime/${target.target_id}/model.glb`;
  const asset = fixtureGlb(dimensionsMm);
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.mkdir(path.dirname(intakePath), { recursive: true });
  await fs.mkdir(path.dirname(path.join(tempRoot, assetRelative)), { recursive: true });
  await fs.writeFile(manifestPath, manifests[targetIndex]);
  await fs.writeFile(path.join(tempRoot, assetRelative), asset);
  const sourceHash = 'a'.repeat(64);
  await fs.writeFile(intakePath, JSON.stringify({
    intake_id: `INTAKE_${targetIndex}`,
    target_id: target.target_id,
    status: 'AUTHORIZED_CAPTURE_INTAKE_RECORDED_CONVERSION_QA_REQUIRED',
    source: { sha256: sourceHash },
    authorization: { access_basis: 'authorized_project_use', terms_reference: 'terms-v1', project_reference: 'project-v0' },
  }));
  const evidence = {
    target_id: target.target_id,
    source_sha256: sourceHash,
    converted_asset_path: assetRelative,
    converted_asset_sha256: sha256(asset),
    conversion: { tool: 'fixture-converter', tool_version: '1.0' },
    rights: {
      access_basis: 'authorized_project_use', terms_reference: 'terms-v1', project_reference: 'project-v0',
      project_use_scope_confirmed: true, render_scope: 'project_only', derivative_storage_scope: 'ephemeral_only',
      asset_redistribution_allowed: false, manufacturer_binary_committed: false, converted_asset_committed: false,
    },
    operator_confirmation: 'I inspected the product-bound conversion and confirm this QA report is accurate.',
    ...evidenceValues,
  };
  const evidenceRelative = `.runtime/${target.target_id}/qa.json`;
  await fs.writeFile(path.join(tempRoot, evidenceRelative), JSON.stringify(evidence));
  return { target, evidence, evidenceRelative, asset };
}

try {
  await fs.mkdir(path.join(tempRoot, 'config/geometry'), { recursive: true });
  await fs.writeFile(path.join(tempRoot, 'config/geometry/authorized-geometry-qa-contract.json'), JSON.stringify(contract));

  const muuto = await writeTarget(targetIndex('MUUTO_OUTLINE_2S_OU2SRA10101_G3_V0_1'), [1700, 840, 710], {
    identity: { manufacturer_item_no: 'OU2SRA10101', legacy_item_no: '27003-COGN', ean: '5713222210793', manufacturer: 'Muuto', product_family: 'Outline Sofa' },
    measurements_mm: { seat_height: 400, seat_depth: 620 },
    interfaces: { object_role: 'seating_sofa', seat_finish: 'Refine Leather - Cognac', base_color: 'Black', base_type: 'Standard Base' },
  });
  const muutoPass = await validateAuthorizedGeometryQa({ root: tempRoot, evidencePath: muuto.evidenceRelative });
  assert.equal(muutoPass.status, 'AUTHORIZED_EXACT_G3_VISUAL_QA_PASS');

  const fiber = await writeTarget(targetIndex('MUUTO_FIBER_LOUNGE_FILOUWON04041_G3_V0_1'), [600, 690, 744], {
    identity: { manufacturer_item_no: 'FILOUWON04041', legacy_item_no: '25513', ean: '5713295826631', manufacturer: 'Muuto', product_family: 'Fiber Lounge Chair' },
    measurements_mm: { seat_height: 380, seat_depth: 490 },
    interfaces: { object_role: 'seating_lounge', shell_color: 'Natural White', base_material: 'Oak', upholstery: 'None' },
  });
  const fiberPass = await validateAuthorizedGeometryQa({ root: tempRoot, evidencePath: fiber.evidenceRelative });
  assert.equal(fiberPass.status, 'AUTHORIZED_EXACT_G3_VISUAL_QA_PASS');

  const around = await writeTarget(targetIndex('MUUTO_AROUND_SMALL_AROTABSM01_G3_V0_1'), [450, 450, 460], {
    identity: { manufacturer_item_no: 'AROTABSM01', legacy_item_no: '60012', ean: '5713294887800', manufacturer: 'Muuto', product_family: 'Around Coffee Table' },
    measurements_mm: { diameter: 450, height: 460 },
    interfaces: { object_role: 'coffee_table', size: 'Small', material_finish: 'Oak' },
  });
  const aroundPass = await validateAuthorizedGeometryQa({ root: tempRoot, evidencePath: around.evidenceRelative });
  assert.equal(aroundPass.status, 'AUTHORIZED_EXACT_G3_VISUAL_QA_PASS');

  const leaf = await writeTarget(targetIndex('MUUTO_LEAF_FLOOR_LEAFLR01_G3_V0_1'), [433, 433, 1190], {
    identity: { manufacturer_item_no: 'LEAFLR01', legacy_item_no: '13431', ean: '5710562134314', manufacturer: 'Muuto', product_family: 'Leaf Lamp' },
    measurements_mm: { base_diameter: 220, cord_length: 1800 },
    interfaces: { object_role: 'floor_lamp', color: 'White', electrical_territory: 'EU/non-US' },
  });
  const leafPass = await validateAuthorizedGeometryQa({ root: tempRoot, evidencePath: leaf.evidenceRelative });
  assert.equal(leafPass.status, 'AUTHORIZED_EXACT_G3_VISUAL_QA_PASS');

  const rocaIndex = targetIndex('ROCA_A32727500B_G4_V0_1');
  const roca = await writeTarget(rocaIndex, [600, 380, 70], {
    identity: { reference: 'A32727500B', manufacturer: 'Roca', product_family: 'Horizon' },
    interfaces: { installation: 'countertop', drain_geometry_observed: true, overflow: false, ifc_classification: 'Sanitary Terminal' },
  });
  const rocaPass = await validateAuthorizedGeometryQa({ root: tempRoot, evidencePath: roca.evidenceRelative, now: new Date('2026-08-17T00:00:00Z') });
  assert.equal(rocaPass.status, 'AUTHORIZED_EXACT_G4_PROJECT_USE_QA_PASS');
  assert.equal(rocaPass.checks_passed, rocaPass.checks_total);
  assert.deepEqual(rocaPass.geometry.dimensions_mm.map(Math.round), [600, 380, 70]);

  roca.evidence.source_sha256 = 'b'.repeat(64);
  await fs.writeFile(path.join(tempRoot, roca.evidenceRelative), JSON.stringify(roca.evidence));
  const badHash = await validateAuthorizedGeometryQa({ root: tempRoot, evidencePath: roca.evidenceRelative });
  assert.equal(badHash.status, 'AUTHORIZED_GEOMETRY_QA_BLOCKED');
  assert.ok(badHash.blocked_check_ids.includes('source_hash_binding'));

  const scaled = await writeTarget(rocaIndex, [800, 380, 70], {
    identity: { reference: '327275XXB', manufacturer: 'Roca', product_family: 'Horizon' },
    interfaces: { installation: 'countertop', drain_geometry_observed: true, overflow: false, ifc_classification: 'Sanitary Terminal' },
  });
  const scaleBlocked = await validateAuthorizedGeometryQa({ root: tempRoot, evidencePath: scaled.evidenceRelative });
  assert.ok(scaleBlocked.blocked_check_ids.includes('physical_scale'));

  scaled.evidence.rights.asset_redistribution_allowed = true;
  await fs.writeFile(path.join(tempRoot, scaled.evidenceRelative), JSON.stringify(scaled.evidence));
  const rightsBlocked = await validateAuthorizedGeometryQa({ root: tempRoot, evidencePath: scaled.evidenceRelative });
  assert.ok(rightsBlocked.blocked_check_ids.includes('no_asset_redistribution'));

  const gf = await writeTarget(targetIndex('GF_SANIPEX_MT_1158140_G4_V0_1'), [54, 25, 25], {
    identity: { manufacturer_part_no: '1158140', gf_item_no: '351616990', ean: '7613263030184', gtin14: '07613263030184', etim_class: 'EC003024' },
    measurements_mm: { l1: 54, z1: 34, inner_diameter: 16, z_d2: 12 },
    interfaces: { component_type: 'IfcPipeFittingType', nominal_system: 'JRG Sanipex MT', nominal_diameter_mm: 16, connection_role: 'adapter' },
  });
  const gfPass = await validateAuthorizedGeometryQa({ root: tempRoot, evidencePath: gf.evidenceRelative });
  assert.equal(gfPass.status, 'AUTHORIZED_EXACT_G4_INTERFACE_QA_PASS');

  gf.evidence.identity.ean = 'wrong';
  await fs.writeFile(path.join(tempRoot, gf.evidenceRelative), JSON.stringify(gf.evidence));
  const identityBlocked = await validateAuthorizedGeometryQa({ root: tempRoot, evidencePath: gf.evidenceRelative });
  assert.ok(identityBlocked.blocked_check_ids.includes('identity:identity.ean'));

  console.log(JSON.stringify({ status: 'PASS', scenarios: 10, glb_parser: 'PASS', targets: ['Muuto Outline', 'Muuto Fiber', 'Muuto Around', 'Muuto Leaf', 'Roca', 'GF Sanipex'] }, null, 2));
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
