import assert from 'node:assert/strict';
import {
  buildRoomLabDesignAssetManifest,
  LIVING_DINING_ASSET_IDS,
  ROOM_LAB_CANONICAL_VIEWS,
  validateRoomLabDesignAssetManifest,
} from './build-room-lab-design-asset-manifest.mjs';
import {findForbiddenDesignAssetFields} from './lib/design-asset-truth.mjs';

const manifest = await buildRoomLabDesignAssetManifest();
assert.equal(manifest.record_lane, 'DESIGN_ASSET');
assert.equal(manifest.assets.length, 12);
assert.equal(manifest.summary.living_dining, 9);
assert.equal(manifest.summary.g1_blocked, 12);
assert.equal(manifest.summary.g2_ready, 0);
assert.equal(manifest.summary.publication_allowed, 0);
assert.deepEqual(findForbiddenDesignAssetFields(manifest), []);
for (const asset of manifest.assets) {
  assert.equal(asset.record_lane, 'DESIGN_ASSET');
  assert.equal(asset.identity_scope, 'GENERIC_DESIGN_ASSET');
  assert.equal(asset.not_a_product_twin, true);
  assert.equal(asset.geometry_level, 'G1');
  assert.equal(asset.geometry.format, 'GLB_2_0');
  assert.match(asset.geometry.sha256, /^[0-9a-f]{64}$/);
  assert.equal(asset.geometry.runtime_binary_retained_outside_repository, true);
  assert.equal(asset.transform.front_axis, 'UNVERIFIED');
  assert.equal(asset.transform.normalization.source_scale_independently_verified, false);
  assert.equal(asset.publication_allowed, false);
  assert.equal(asset.geometry_asset_reference, null);
  assert.deepEqual(asset.canonical_views, ROOM_LAB_CANONICAL_VIEWS);
  assert.equal(asset.replacement_search_requirement.required, true);
}
assert.deepEqual(
  manifest.assets.filter((asset) => asset.catalogue_scope === 'LIVING_DINING').map((asset) => asset.design_asset_id).sort(),
  [...LIVING_DINING_ASSET_IDS].sort(),
);
const glassTable = manifest.assets.find((asset) => asset.design_asset_id === 'DA_SH3D_KL_GLASS_DINING_TABLE');
assert.equal(glassTable.qa.visual_review_state, 'RENDER_BLOCKED_G2_BLOCKED');
assert.equal(glassTable.qa.glass_alpha_state, 'BLOCKED_OPAQUE_TOP');
assert.match(glassTable.qa.blockers.join(' '), /glass alpha or transmission appearance fails visual QA/);
const renderPassOnly = manifest.assets.filter((asset) => asset.qa.visual_review_state === 'RENDER_PASS_G2_BLOCKED');
assert.equal(renderPassOnly.length, 8);
assert.ok(renderPassOnly.every((asset) => asset.geometry_level === 'G1' && asset.publication_allowed === false));

const clone = () => structuredClone(manifest);
const commercePoison = clone();
commercePoison.assets[0].unitPriceEUR = 299;
assert.throws(() => validateRoomLabDesignAssetManifest(commercePoison), /allowlist|forbidden/);
const nestedPoison = clone();
nestedPoison.assets[0].qa.vendor = 'Injected';
assert.throws(() => validateRoomLabDesignAssetManifest(nestedPoison), /allowlist|forbidden/);
const missingView = clone();
missingView.assets[0].canonical_views.pop();
assert.throws(() => validateRoomLabDesignAssetManifest(missingView), /must equal/);
const runtimeLeak = clone();
runtimeLeak.assets[0].geometry_asset_reference = '.runtime/design-assets/converted/never.glb';
assert.throws(() => validateRoomLabDesignAssetManifest(runtimeLeak), /must remain null/);
const wrongLane = clone();
wrongLane.assets[0].record_lane = 'PRODUCT_TWIN';
assert.throws(() => validateRoomLabDesignAssetManifest(wrongLane), /must be DESIGN_ASSET/);

console.log(JSON.stringify({status: 'PASS', assets: 12, living_dining: 9, render_pass_g2_blocked: 8, poison_mutations: 5}));
