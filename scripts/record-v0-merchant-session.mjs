import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function collectForbiddenKeys(value, patterns, allowedDeclarationKeys, found = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectForbiddenKeys(item, patterns, allowedDeclarationKeys, found));
    return found;
  }
  if (!value || typeof value !== 'object') return found;
  for (const [key, child] of Object.entries(value)) {
    if (!allowedDeclarationKeys.includes(key) && patterns.some((pattern) => key.toLowerCase().includes(pattern.toLowerCase()))) found.push(key);
    collectForbiddenKeys(child, patterns, allowedDeclarationKeys, found);
  }
  return found;
}

export function evaluateMerchantSessionEvidence(evidence, contract, now = new Date()) {
  const observed = new Date(evidence?.observed_at ?? 'invalid');
  const ageMinutes = (now.getTime() - observed.getTime()) / 60000;
  const contractProducts = new Map((contract.products ?? []).map((product) => [product.twin_id, product]));
  const products = Array.isArray(evidence?.products) ? evidence.products : [];
  const declarations = contract.privacy_policy?.required_false_declarations ?? [];
  const forbiddenKeys = collectForbiddenKeys(evidence, contract.privacy_policy?.forbidden_key_patterns ?? [], declarations);
  const productChecks = products.map((product) => {
    const expected = contractProducts.get(product.twin_id);
    const identityPass = Boolean(expected && expected.article_no === product.article_no && expected.official_url === product.official_url);
    const statePass = contract.allowed_states.availability.includes(product.availability_state)
      && contract.allowed_states.cart.includes(product.cart_state)
      && contract.allowed_states.checkout.includes(product.checkout_state);
    const pricePass = Number.isFinite(product.price_eur) && product.price_eur >= 0 && product.currency === 'EUR';
    const procurementReady = identityPass && statePass && pricePass
      && ['delivery_available', 'store_available'].includes(product.availability_state)
      && product.cart_state === 'added'
      && product.checkout_state === 'healthy_to_final_review';
    return { twin_id: product.twin_id, identity_pass: identityPass, state_pass: statePass, price_pass: pricePass, procurement_ready: procurementReady };
  });
  const checks = [
    { id: 'scene_identity', pass: evidence?.scene_id === contract.scene_id },
    { id: 'merchant_identity', pass: evidence?.merchant === contract.merchant },
    { id: 'location_identity', pass: evidence?.location?.country === contract.location.country && evidence?.location?.postal_code === contract.location.postal_code },
    { id: 'valid_observation_time', pass: Number.isFinite(observed.getTime()) },
    { id: 'fresh_observation', pass: Number.isFinite(ageMinutes) && ageMinutes >= -contract.maximum_future_clock_skew_minutes && ageMinutes <= contract.maximum_observation_age_minutes, actual_age_minutes: ageMinutes },
    { id: 'all_configured_products_recorded_once', pass: products.length === contractProducts.size && new Set(products.map((product) => product.twin_id)).size === contractProducts.size && products.every((product) => contractProducts.has(product.twin_id)) },
    { id: 'exact_product_identity', pass: productChecks.length === contractProducts.size && productChecks.every((product) => product.identity_pass) },
    { id: 'allowed_state_vocabulary', pass: productChecks.length === contractProducts.size && productChecks.every((product) => product.state_pass) },
    { id: 'current_eur_prices', pass: productChecks.length === contractProducts.size && productChecks.every((product) => product.price_pass) },
    { id: 'privacy_declarations', pass: declarations.every((key) => evidence?.privacy?.[key] === false) },
    { id: 'no_forbidden_fields', pass: forbiddenKeys.length === 0, forbidden_keys: forbiddenKeys },
    { id: 'operator_confirmation', pass: typeof evidence?.operator_confirmation === 'string' && evidence.operator_confirmation.length >= 30 },
    { id: 'one_procurement_ready_article', pass: productChecks.some((product) => product.procurement_ready) },
  ];
  const blocked = checks.filter((check) => !check.pass);
  return {
    status: blocked.length ? 'BLOCKED' : 'PASS',
    checks_total: checks.length,
    checks_passed: checks.length - blocked.length,
    blocked_check_ids: blocked.map((check) => check.id),
    observed_age_minutes: Number.isFinite(ageMinutes) ? ageMinutes : null,
    procurement_ready_twin_ids: productChecks.filter((product) => product.procurement_ready).map((product) => product.twin_id),
    product_checks: productChecks,
    checks,
  };
}

export async function recordMerchantSession({ root = process.cwd(), evidencePath, now = new Date() }) {
  if (!evidencePath) throw new Error('MERCHANT_SESSION_EVIDENCE is required');
  const scenePath = path.join(root, 'data/showrooms/v0-shoppable-dining-scene.json');
  const contractPath = path.join(root, 'config/commerce/ikea-v0-live-session-contract.json');
  const resolvedEvidencePath = path.resolve(root, evidencePath);
  const runtimeRoot = path.resolve(root, '.runtime');
  if (!resolvedEvidencePath.startsWith(`${runtimeRoot}${path.sep}`)) throw new Error('Merchant session evidence must remain under gitignored .runtime');
  const [scene, contract, evidence] = await Promise.all([
    fs.readFile(scenePath, 'utf8').then(JSON.parse),
    fs.readFile(contractPath, 'utf8').then(JSON.parse),
    fs.readFile(resolvedEvidencePath, 'utf8').then(JSON.parse),
  ]);
  const evaluation = evaluateMerchantSessionEvidence(evidence, contract, now);
  const metric = {
    generated_at: now.toISOString(),
    scene_id: contract.scene_id,
    ...evaluation,
    status: evaluation.status === 'PASS' ? 'LIVE_SESSION_PROCUREMENT_READY_PASS' : 'LIVE_SESSION_EVIDENCE_BLOCKED',
    merchant: contract.merchant,
    location: contract.location,
    observed_at: evidence.observed_at ?? null,
    products: (evidence.products ?? []).map((product) => ({
      twin_id: product.twin_id,
      article_no: product.article_no,
      price_eur: product.price_eur,
      currency: product.currency,
      availability_state: product.availability_state,
      cart_state: product.cart_state,
      checkout_state: product.checkout_state,
      official_url: product.official_url,
    })),
    privacy: { persisted_personal_data: false, persisted_session_or_cart_identifier: false, persisted_cart_payload: false, persisted_payment_data: false },
    operator_confirmation: evidence.operator_confirmation ?? null,
  };
  if (evaluation.status === 'PASS') {
    const byTwin = new Map(evidence.products.map((product) => [product.twin_id, product]));
    for (const product of scene.products ?? []) {
      const live = byTwin.get(product.twin_id);
      if (!live) continue;
      Object.assign(product.offer_snapshot, {
        unit_price: live.price_eur,
        currency: live.currency,
        observed_at: evidence.observed_at.slice(0, 10),
        price_state: 'LIVE_LOCATION_SESSION_VERIFIED',
        availability_state: `LIVE_POSTCODE_${contract.location.postal_code}_${live.availability_state.toUpperCase()}`,
        handoff_state: live.cart_state === 'added' ? 'LIVE_SESSION_ADD_TO_CART_VERIFIED' : 'LIVE_SESSION_CART_NOT_ADDED',
        checkout_state: live.checkout_state === 'healthy_to_final_review' ? 'LIVE_CHECKOUT_HEALTH_VERIFIED' : `LIVE_CHECKOUT_${live.checkout_state.toUpperCase()}`,
      });
    }
    const primary = scene.products.find((product) => product.twin_id === scene.swap_proof.from_twin_id);
    const substitute = scene.products.find((product) => product.twin_id === scene.swap_proof.to_twin_id);
    if (primary && substitute) {
      scene.swap_proof.budget_delta_eur = Number((substitute.offer_snapshot.unit_price - primary.offer_snapshot.unit_price).toFixed(2));
      scene.swap_proof.resulting_total_eur = substitute.offer_snapshot.unit_price;
    }
    scene.evidence_observed_at = evidence.observed_at;
    scene.exit_evidence.live_price_refresh = 'PASS_LIVE_LOCATION_SESSION';
    scene.exit_evidence.live_availability_refresh = 'PASS_POSTCODE_SESSION';
    scene.exit_evidence.cart_or_rfq_handoff = 'PASS_LIVE_CART_AND_CHECKOUT_REVIEW';
    scene.exit_evidence.overall = 'PASS';
  }
  const metricPath = path.join(root, 'data/metrics/v0-merchant-session-latest.json');
  await fs.mkdir(path.dirname(metricPath), { recursive: true });
  await Promise.all([
    fs.writeFile(metricPath, JSON.stringify(metric, null, 2) + '\n'),
    ...(evaluation.status === 'PASS' ? [fs.writeFile(scenePath, JSON.stringify(scene, null, 2) + '\n')] : []),
  ]);
  return metric;
}

async function main() {
  const result = await recordMerchantSession({ evidencePath: process.env.MERCHANT_SESSION_EVIDENCE });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'LIVE_SESSION_PROCUREMENT_READY_PASS') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
