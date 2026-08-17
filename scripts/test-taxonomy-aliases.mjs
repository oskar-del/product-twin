import assert from 'node:assert/strict';
import {loadTaxonomyResolver} from './lib/taxonomy-aliases.mjs';

const resolve = await loadTaxonomyResolver();
assert.equal(resolve('FFE.SEATING.ARMCHAIR'), 'FFE.SEATING.LOUNGE');
assert.equal(resolve('FFE.STORAGE.BOOKCASE'), 'FFE.STORAGE');
assert.equal(resolve('FFE.RUGS'), 'FFE.RUGS');
assert.throws(() => resolve('FFE.DOES_NOT_EXIST'), /unknown canonical taxonomy category/);
console.log(JSON.stringify({status: 'PASS', aliases: 5}));
