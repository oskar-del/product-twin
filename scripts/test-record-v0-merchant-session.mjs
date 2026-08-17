import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { evaluateMerchantSessionEvidence, recordMerchantSession } from './record-v0-merchant-session.mjs';

const now = new Date('2026-08-16T22:00:00.000Z');
const contract = {
  scene_id: 'V0_SHOPPABLE_DINING_001', merchant: 'IKEA Spain', location: { country: 'ES', postal_code: '29660' },
  maximum_observation_age_minutes: 30, maximum_future_clock_skew_minutes: 5,
  products: [
    { twin_id: 'PT_IKEA_SKURUP_80407114', article_no: '804.071.14', official_url: 'https://www.ikea.com/es/es/p/skurup-lampara-techo-negro-80407114/' },
    { twin_id: 'PT_IKEA_MELODI_60386527', article_no: '603.865.27', official_url: 'https://www.ikea.com/es/es/p/melodi-lampara-techo-blanco-60386527/' },
  ],
  allowed_states: { availability: ['delivery_available','store_available','unavailable','not_offered'], cart: ['added','not_added'], checkout: ['healthy_to_final_review','blocked','not_checked'] },
  privacy_policy: { required_false_declarations: ['contains_personal_data','contains_session_identifier','contains_cart_identifier','contains_cart_payload','contains_payment_data'], forbidden_key_patterns: ['session_id','cart_id','email','payment'] },
};
const evidence = {
  scene_id: contract.scene_id, merchant: contract.merchant, location: contract.location, observed_at: '2026-08-16T21:50:00.000Z',
  products: contract.products.map((product, index) => ({ ...product, price_eur: index ? 5.99 : 19.99, currency: 'EUR', availability_state: index ? 'delivery_available' : 'unavailable', cart_state: index ? 'added' : 'not_added', checkout_state: index ? 'healthy_to_final_review' : 'not_checked' })),
  privacy: { contains_personal_data:false, contains_session_identifier:false, contains_cart_identifier:false, contains_cart_payload:false, contains_payment_data:false },
  operator_confirmation: 'I observed these exact articles in one location-aware IKEA Spain session for postcode 29660.',
};

assert.equal(evaluateMerchantSessionEvidence(evidence, contract, now).status, 'PASS');
const stale = structuredClone(evidence); stale.observed_at = '2026-08-16T20:00:00.000Z';
assert.ok(evaluateMerchantSessionEvidence(stale, contract, now).blocked_check_ids.includes('fresh_observation'));
const wrongLocation = structuredClone(evidence); wrongLocation.location.postal_code = '28001';
assert.ok(evaluateMerchantSessionEvidence(wrongLocation, contract, now).blocked_check_ids.includes('location_identity'));
const privateField = structuredClone(evidence); privateField.session_id = 'forbidden';
assert.ok(evaluateMerchantSessionEvidence(privateField, contract, now).blocked_check_ids.includes('no_forbidden_fields'));
const noReadyProduct = structuredClone(evidence); noReadyProduct.products.forEach((product) => { product.cart_state = 'not_added'; product.checkout_state = 'not_checked'; });
assert.ok(evaluateMerchantSessionEvidence(noReadyProduct, contract, now).blocked_check_ids.includes('one_procurement_ready_article'));

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'v0-merchant-session-'));
try {
  await fs.mkdir(path.join(tempRoot, 'config/commerce'), { recursive: true });
  await fs.mkdir(path.join(tempRoot, 'data/showrooms'), { recursive: true });
  await fs.mkdir(path.join(tempRoot, '.runtime'), { recursive: true });
  const scene = { scene_id: contract.scene_id, products: evidence.products.map((product, index) => ({ twin_id: product.twin_id, offer_snapshot: { unit_price: index ? 5.99 : 19.99 } })), swap_proof: { from_twin_id: evidence.products[0].twin_id, to_twin_id: evidence.products[1].twin_id }, exit_evidence: {} };
  await Promise.all([
    fs.writeFile(path.join(tempRoot, 'config/commerce/ikea-v0-live-session-contract.json'), JSON.stringify(contract)),
    fs.writeFile(path.join(tempRoot, 'data/showrooms/v0-shoppable-dining-scene.json'), JSON.stringify(scene)),
    fs.writeFile(path.join(tempRoot, '.runtime/evidence.json'), JSON.stringify(evidence)),
  ]);
  const metric = await recordMerchantSession({ root: tempRoot, evidencePath: '.runtime/evidence.json', now });
  assert.equal(metric.status, 'LIVE_SESSION_PROCUREMENT_READY_PASS');
  assert.equal(JSON.parse(await fs.readFile(path.join(tempRoot, 'data/showrooms/v0-shoppable-dining-scene.json'), 'utf8')).exit_evidence.overall, 'PASS');
  assert.equal(metric.privacy.persisted_session_or_cart_identifier, false);
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({ status: 'PASS', scenarios: 6, checks_per_valid_evidence: 13 }, null, 2));
