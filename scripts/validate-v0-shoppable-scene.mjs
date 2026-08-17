import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SCENE_PATH = path.join(ROOT, 'data/showrooms/v0-shoppable-dining-scene.json');
const INDEX_PATH = path.join(ROOT, 'data/geometry/avatar-index.json');
const METRIC_PATH = path.join(ROOT, 'data/metrics/v0-shoppable-scene-latest.json');

const [scene, avatarIndex] = await Promise.all([
  fs.readFile(SCENE_PATH, 'utf8').then(JSON.parse),
  fs.readFile(INDEX_PATH, 'utf8').then(JSON.parse),
]);

const checks = [];
const check = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail });
const avatars = new Map((avatarIndex.avatars ?? []).map((avatar) => [avatar.avatar_id, avatar]));
const products = scene.products ?? [];
const primary = products.find((product) => product.role === 'primary');
const substitute = products.find((product) => product.role === 'lower_cost_substitute');

check('one_primary', Boolean(primary), primary?.twin_id ?? 'missing');
check('one_lower_cost_substitute', Boolean(substitute), substitute?.twin_id ?? 'missing');
check('same_category', primary?.category_id && primary.category_id === substitute?.category_id, primary && substitute ? `${primary.category_id} / ${substitute.category_id}` : 'missing product');
check('same_transform', primary?.placement?.transform_ref && primary.placement.transform_ref === substitute?.placement?.transform_ref && primary.placement.transform_ref === scene.swap_proof?.same_transform_ref, scene.swap_proof?.same_transform_ref ?? 'missing');

for (const product of products) {
  const indexed = avatars.get(product.avatar?.avatar_id);
  const assetPath = product.avatar?.asset_path ? path.join(ROOT, product.avatar.asset_path) : null;
  check(`${product.twin_id}:identity_exact`, product.identity?.state === 'verified_exact_retail_article', product.identity?.state ?? 'missing');
  check(`${product.twin_id}:avatar_indexed`, Boolean(indexed), product.avatar?.avatar_id ?? 'missing');
  check(`${product.twin_id}:avatar_promoted`, indexed?.promotion_state === 'promoted_proxy' && indexed?.level === 'G2', indexed ? `${indexed.level}/${indexed.promotion_state}` : 'missing');
  check(`${product.twin_id}:asset_exists`, Boolean(assetPath && await fs.stat(assetPath).then(() => true).catch(() => false)), product.avatar?.asset_path ?? 'missing');
  check(`${product.twin_id}:proxy_disclosed`, /proxy/i.test(product.avatar?.claim ?? '') && /does not claim/i.test(product.avatar?.disclosure ?? ''), product.avatar?.claim ?? 'missing');
  check(`${product.twin_id}:technical_gate`, ['PASS', 'CONDITIONAL_PASS'].includes(product.technical_gate?.state), product.technical_gate?.state ?? 'missing');
  check(`${product.twin_id}:regulatory_gate`, ['PASS', 'CONDITIONAL_PASS'].includes(product.regulatory_gate?.state), product.regulatory_gate?.state ?? 'missing');
  check(`${product.twin_id}:dated_offer`, Number.isFinite(product.offer_snapshot?.unit_price) && /^\d{4}-\d{2}-\d{2}$/.test(product.offer_snapshot?.observed_at ?? ''), `${product.offer_snapshot?.unit_price ?? 'missing'} ${product.offer_snapshot?.currency ?? ''} @ ${product.offer_snapshot?.observed_at ?? 'missing'}`);
  check(`${product.twin_id}:live_refresh_policy`, /REFRESH_REQUIRED/.test(product.offer_snapshot?.availability_state ?? ''), product.offer_snapshot?.availability_state ?? 'missing');
  check(`${product.twin_id}:handoff`, /DIRECT_PRODUCT_PAGE/.test(product.offer_snapshot?.handoff_state ?? '') && /^https:\/\//.test(product.offer_snapshot?.product_url ?? ''), product.offer_snapshot?.handoff_state ?? 'missing');
}

if (primary && substitute) {
  const calculatedDelta = Number((substitute.offer_snapshot.unit_price - primary.offer_snapshot.unit_price).toFixed(2));
  check('budget_delta', calculatedDelta === scene.swap_proof?.budget_delta_eur, `${calculatedDelta} calculated / ${scene.swap_proof?.budget_delta_eur} declared`);
  check('resulting_total', substitute.offer_snapshot.unit_price === scene.swap_proof?.resulting_total_eur, `${substitute.offer_snapshot.unit_price} calculated / ${scene.swap_proof?.resulting_total_eur} declared`);
  check('lower_cost', calculatedDelta < 0, `${calculatedDelta} EUR`);
}

check('no_retained_mutable_payload', Array.isArray(scene.persistence_policy?.do_not_persist) && scene.persistence_policy.do_not_persist.some((item) => /stock payload/i.test(item)) && scene.persistence_policy.do_not_persist.some((item) => /cart\/session data/i.test(item)), 'stock/cart payload exclusion');

const failed = checks.filter((item) => !item.pass);
const result = {
  generated_at: new Date().toISOString(),
  scene_id: scene.scene_id,
  contract_status: failed.length ? 'FAIL' : 'PASS',
  end_to_end_status: scene.exit_evidence?.overall ?? 'UNDECLARED',
  checks_total: checks.length,
  checks_passed: checks.length - failed.length,
  checks_failed: failed.length,
  blockers: [
    'Live delivery/store availability requires a location-aware IKEA session.',
    'IKEA currently reports sales/payment-area issues; checkout must be refreshed before purchase.',
    'Ceiling hook, lamp and project electrical installation remain conditional technical gates.',
  ],
  checks,
};

await fs.mkdir(path.dirname(METRIC_PATH), { recursive: true });
await fs.writeFile(METRIC_PATH, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exitCode = 1;
