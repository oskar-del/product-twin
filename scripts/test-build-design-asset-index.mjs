import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import {buildDesignAssetIndex, REQUIRED_PUBLICATION_GATES, validatePublicationContract} from './build-design-asset-index.mjs';
import {findForbiddenDesignAssetFields} from './lib/design-asset-truth.mjs';

const index = await buildDesignAssetIndex();
assert.equal(index.summary.assets, 12);
assert.equal(index.summary.publishable, 0);
assert.equal(index.visible_attribution_contract.display_surfaces.includes('asset_card'), true);
for (const asset of index.assets) {
  assert.equal(asset.identity_scope, 'GENERIC_DESIGN_ASSET');
  assert.equal(asset.not_a_product_twin, true);
  assert.equal(asset.publication_allowed, false);
  assert.equal(asset.attribution.display_required, true);
  assert.deepEqual(findForbiddenDesignAssetFields(asset), []);
}
const validContract = JSON.parse(await fsp.readFile('config/geometry/design-asset-publication-contract-v0.1.json', 'utf8'));
assert.deepEqual(validatePublicationContract(validContract), REQUIRED_PUBLICATION_GATES);
assert.throws(() => validatePublicationContract({...validContract, publication_gates: []}), /exact non-empty/);
assert.throws(() => validatePublicationContract({...validContract, publication_gates: undefined}), /exact non-empty/);
assert.throws(() => validatePublicationContract({...validContract, publication_gates: REQUIRED_PUBLICATION_GATES.slice(1)}), /gate set mismatch/);
assert.throws(() => validatePublicationContract({...validContract, publication_gates: [...REQUIRED_PUBLICATION_GATES, 'optional_gate']}), /gate set mismatch/);
assert.throws(() => validatePublicationContract({...validContract, publication_gates: [...REQUIRED_PUBLICATION_GATES, REQUIRED_PUBLICATION_GATES[0]]}), /gate set mismatch/);
console.log(JSON.stringify({status: 'PASS', indexed: index.assets.length, published: 0}));
