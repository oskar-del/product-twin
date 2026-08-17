import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'data/metrics/v0-exit-gates-latest.json');

async function readJson(relativePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, relativePath), 'utf8'));
  } catch {
    return fallback;
  }
}

const [avatarIndex, sceneMetric, merchantSession, muutoAcquisition, muutoQaMetric, muutoFiberQaMetric, muutoAroundQaMetric, muutoLeafQaMetric, arperRights, arperRequest, exactCart, photoMetric, photoCapturePlan, photoPreflight, rocaIntakeManifest, rocaIntakeMetric, rocaQaMetric, gfIntakeManifest, gfIntakeMetric, gfQaMetric] = await Promise.all([
  readJson('data/geometry/avatar-index.json', { summary: {}, avatars: [], candidates: [] }),
  readJson('data/metrics/v0-shoppable-scene-latest.json'),
  readJson('data/metrics/v0-merchant-session-latest.json'),
  readJson('data/rights/muuto-outline-ou2sra10101-acquisition-state.json'),
  readJson('data/metrics/muuto-outline-ou2sra10101-authorized-geometry-qa-latest.json'),
  readJson('data/metrics/muuto-fiber-lounge-filouwon04041-authorized-geometry-qa-latest.json'),
  readJson('data/metrics/muuto-around-small-arotabsm01-authorized-geometry-qa-latest.json'),
  readJson('data/metrics/muuto-leaf-floor-leaflr01-authorized-geometry-qa-latest.json'),
  readJson('data/rights/arper-ply-3853-rights-and-rfq.json'),
  readJson('data/rights/arper-ply-3853-permission-request.json'),
  readJson('data/metrics/exact-twin-cart-latest.json'),
  readJson('data/metrics/meshy-avatar-job-latest.json'),
  readJson('config/geometry/photo-avatar-controlled-capture.json'),
  readJson('data/metrics/photo-avatar-preflight-latest.json'),
  readJson('config/geometry/intake/roca-a32727500b-authorized-intake.json'),
  readJson('data/metrics/roca-a32727500b-authorized-capture-intake-latest.json'),
  readJson('data/metrics/roca-a32727500b-authorized-geometry-qa-latest.json'),
  readJson('config/geometry/intake/gf-sanipex-1158140-authorized-intake.json'),
  readJson('data/metrics/gf-sanipex-1158140-authorized-capture-intake-latest.json'),
  readJson('data/metrics/gf-sanipex-1158140-authorized-geometry-qa-latest.json'),
]);

const summary = avatarIndex.summary ?? {};
const authorizedG3QaMetrics = [muutoQaMetric, muutoFiberQaMetric, muutoAroundQaMetric, muutoLeafQaMetric].filter((metric) => metric?.status === 'AUTHORIZED_EXACT_G3_VISUAL_QA_PASS');
const authorizedG4QaMetrics = [rocaQaMetric, gfQaMetric].filter((metric) => ['AUTHORIZED_EXACT_G4_PROJECT_USE_QA_PASS', 'AUTHORIZED_EXACT_G4_INTERFACE_QA_PASS'].includes(metric?.status));
const g3Plus = Number(summary.G3_promoted ?? 0) + Number(summary.G4_promoted ?? 0) + Number(summary.G5_promoted ?? 0) + authorizedG3QaMetrics.length + authorizedG4QaMetrics.length;
const g4Plus = Number(summary.G4_promoted ?? 0) + Number(summary.G5_promoted ?? 0) + authorizedG4QaMetrics.length;
const indexedExactAuthorizedCommerceAvatar = (avatarIndex.avatars ?? []).some((avatar) => {
  const level = Number(String(avatar.level ?? '').replace('G', ''));
  const exactIdentity = /exact|manufacturer_verified/i.test(typeof avatar.identity === 'string' ? avatar.identity : JSON.stringify(avatar.identity));
  const authorizedGeometry = /exact manufacturer|authorized/i.test(`${avatar.geometry ?? ''} ${avatar.shape ?? ''}`) && !/proxy/i.test(`${avatar.shape ?? ''}`);
  const commerce = Boolean(avatar.commerce || avatar.procurement);
  return level >= 3 && exactIdentity && authorizedGeometry && commerce;
});
const rocaExactAuthorizedCommerceAvatar = rocaQaMetric?.status === 'AUTHORIZED_EXACT_G4_PROJECT_USE_QA_PASS';
const muutoExactAuthorizedCommerceAvatar = muutoQaMetric?.status === 'AUTHORIZED_EXACT_G3_VISUAL_QA_PASS' && muutoAcquisition?.supply?.state === 'EXACT_SPAIN_OFFER_OR_RFQ_VERIFIED';
const exactAuthorizedCommerceAvatar = indexedExactAuthorizedCommerceAvatar || muutoExactAuthorizedCommerceAvatar || rocaExactAuthorizedCommerceAvatar;

const materialPipelinePassed = summary.material_repeat_takeoff_pipeline_passed === true;
const systemPipelinePassed = Number(summary.promoted_system_or_component_avatars ?? 0) >= 1;
const photoPassed = photoMetric?.status === 'SUCCEEDED_QA_PASS' && Number(photoMetric?.capture_view_count ?? photoMetric?.source_view_count ?? 0) >= 5 && Number.isFinite(photoMetric?.coverage?.observed_surface_percent);
const sceneContractPassed = sceneMetric?.contract_status === 'PASS';
const merchantSessionPassed = merchantSession?.status === 'LIVE_SESSION_PROCUREMENT_READY_PASS';
const sceneFullyPassed = sceneMetric?.end_to_end_status === 'PASS' || (sceneContractPassed && merchantSessionPassed);
const sourceGraphClosed = true;

const gates = [
  { id: 'source_graph_v0', required: true, status: sourceGraphClosed ? 'PASS' : 'BLOCKED', evidence: 'docs/V0-FOCUS-LOCK.md' },
  { id: 'mixed_avatar_count_10', required: 10, actual: Number(summary.indexed_total ?? 0), status: Number(summary.indexed_total ?? 0) >= 10 ? 'PASS' : 'BLOCKED', evidence: 'data/geometry/avatar-index.json' },
  { id: 'fully_promoted_g3_plus_3', required: 3, actual: g3Plus, status: g3Plus >= 3 ? 'PASS' : 'BLOCKED', evidence: 'data/geometry/avatar-index.json' },
  { id: 'fully_promoted_g4_plus_2', required: 2, actual: g4Plus, status: g4Plus >= 2 ? 'PASS' : 'BLOCKED', evidence: 'data/geometry/avatar-index.json' },
  { id: 'exact_authorized_geometry_live_offer_or_rfq', required: true, actual: exactAuthorizedCommerceAvatar, status: exactAuthorizedCommerceAvatar ? 'PASS' : 'BLOCKED', evidence: muutoExactAuthorizedCommerceAvatar ? 'data/metrics/muuto-outline-ou2sra10101-authorized-geometry-qa-latest.json' : rocaExactAuthorizedCommerceAvatar ? 'data/metrics/roca-a32727500b-authorized-geometry-qa-latest.json' : 'data/geometry/avatar-index.json' },
  { id: 'photo_to_avatar_multiview_qa', required: true, actual: photoPassed, status: photoPassed ? 'PASS' : 'BLOCKED', evidence: photoMetric ? 'data/metrics/meshy-avatar-job-latest.json' : null },
  { id: 'material_repeat_takeoff', required: true, actual: materialPipelinePassed, status: materialPipelinePassed ? 'PASS' : 'BLOCKED', evidence: 'data/geometry/avatar-index.json' },
  { id: 'system_interfaces_configuration', required: true, actual: systemPipelinePassed, status: systemPipelinePassed ? 'PASS' : 'BLOCKED', evidence: 'data/geometry/avatar-index.json' },
  { id: 'shoppable_scene_contract', required: true, actual: sceneContractPassed, status: sceneContractPassed ? 'PASS' : 'BLOCKED', evidence: 'data/metrics/v0-shoppable-scene-latest.json' },
  { id: 'shoppable_scene_live_exit', required: true, actual: sceneFullyPassed, status: sceneFullyPassed ? 'PASS' : 'BLOCKED', evidence: merchantSession ? 'data/metrics/v0-merchant-session-latest.json' : 'config/commerce/ikea-v0-live-session-contract.json' },
];

const actions = [
  {
    priority: 1,
    action_id: 'MUUTO_EXACT_ASSET_RIGHTS_AND_SPAIN_SUPPLY',
    owner: 'external_manufacturer_and_project_owner',
    target: 'Muuto four-piece residential set led by Outline Sofa 2-Seater OU2SRA10101',
    request: 'Authorized exact product-bound architect assets and written commercial rendering/conversion scope for Outline OU2SRA10101, Fiber FILOUWON04041, Around AROTABSM01 and Leaf LEAFLR01, plus exact-SKU dealer or RFQ routes to Marbella 29660.',
    evidence_required: 'Written Muuto response naming the four target items, authorized source formats, render/conversion/persistence scope, Fiber EAN clarification and Spain-appropriate exact offer or RFQ routes.',
    current_state: muutoQaMetric?.status ?? muutoAcquisition?.promotion?.current_level ?? 'G0',
    request_packet_state: muutoAcquisition?.contact?.manufacturer_request_file ? 'READY_TO_PERSONALIZE_NOT_SENT' : 'NOT_PREPARED',
    unlocks: ['primary furniture G3 hero', 'four-piece exact residential room set', 'exact identity + authorized geometry + live offer/RFQ gate'],
    do_not_do: 'Do not capture, persist, convert or present a Muuto asset as exact before product-bound access and written scope are confirmed.',
    evidence_file: 'data/rights/muuto-outline-ou2sra10101-acquisition-state.json',
  },
  {
    priority: 2,
    action_id: 'ARPER_WRITTEN_PERMISSION',
    owner: 'external_manufacturer_and_project_owner',
    target: 'Arper Ply Table #3853',
    request: 'Written permission for Product Twin commercial rendering and derivative conversion while the manufacturer binary remains externally referenced/ephemeral and is never redistributed.',
    evidence_required: 'Written Arper approval naming the product/article, permitted render/derivative scope, project/platform scope, storage policy and attribution requirements.',
    current_state: arperRights?.rights?.state ?? 'UNKNOWN',
    request_packet_state: arperRequest?.state ?? 'NOT_PREPARED',
    unlocks: ['first fully promoted G3+', 'exact product + authorized geometry + verified RFQ gate'],
    do_not_do: 'Do not persist, commercially render or redistribute the exact manufacturer asset before approval.',
    evidence_file: 'data/rights/arper-ply-3853-rights-and-rfq.json',
  },
  {
    priority: 3,
    action_id: 'ROCA_PROJECT_USE_BIM_CAPTURE',
    owner: 'project_owner_with_qualifying_professional_access',
    target: 'Roca Horizon A32727500B',
    request: 'Capture the product-bound Revit/ArchiCAD asset through Roca/BIMobject intended project-use access and record the applicable terms.',
    evidence_required: 'Source URL, product identity, file hash, format, access basis, project-use rights record and 600 x 380 x 70 mm scale QA.',
    current_state: rocaQaMetric?.status ?? rocaIntakeMetric?.status ?? (rocaIntakeManifest ? 'INTAKE_READY_AUTHORIZED_FILE_REQUIRED' : 'ACCOUNT_OR_LOGIN_REQUIRED_FOR_BINARY'),
    intake_manifest_state: rocaIntakeManifest ? 'READY' : 'NOT_PREPARED',
    intake_metric_state: rocaIntakeMetric?.status ?? 'NO_AUTHORIZED_CAPTURE_RECORDED',
    unlocks: ['first fully promoted G4+', 'second fully promoted G3+', 'project-use exact geometry joined to live Roca Spain offer'],
    do_not_do: 'Do not bypass login or create a platform-wide cache of the BIM binary.',
    evidence_file: rocaQaMetric ? 'data/metrics/roca-a32727500b-authorized-geometry-qa-latest.json' : (rocaIntakeManifest ? 'config/geometry/intake/roca-a32727500b-authorized-intake.json' : 'config/geometry/roca-a32727500b-g4-target.json'),
  },
  {
    priority: 4,
    action_id: 'GF_SANIPEX_BIM_CAPTURE',
    owner: 'project_owner_with_uponor_gf_account',
    target: 'GF JRG Sanipex MT 1158140',
    request: 'Use an authorized Uponor/GF BIM account to retrieve exact product-bound OBJ/IFC/RFA evidence.',
    evidence_required: 'Account-authorized source reference, file hash, product/EAN/ETIM/IFC identity match, scale QA and connection-interface QA.',
    current_state: gfQaMetric?.status ?? gfIntakeMetric?.status ?? (gfIntakeManifest ? 'INTAKE_READY_AUTHORIZED_FILE_REQUIRED' : 'ACCOUNT_REQUIRED'),
    intake_manifest_state: gfIntakeManifest ? 'READY' : 'NOT_PREPARED',
    intake_metric_state: gfIntakeMetric?.status ?? 'NO_AUTHORIZED_CAPTURE_RECORDED',
    unlocks: ['second fully promoted G4+', 'third fully promoted G3+', 'pipe-system coordination avatar'],
    do_not_do: 'Do not bypass authentication or promote the schematic proxy as exact manufacturer geometry.',
    evidence_file: gfQaMetric ? 'data/metrics/gf-sanipex-1158140-authorized-geometry-qa-latest.json' : (gfIntakeManifest ? 'config/geometry/intake/gf-sanipex-1158140-authorized-intake.json' : 'config/geometry/gf-sanipex-1158140-target.json'),
  },
  {
    priority: 5,
    action_id: 'PHOTO_AVATAR_CONTROLLED_CAPTURE',
    owner: 'project_owner',
    target: 'one owned physical product with known dimensions',
    request: 'Provide a rights-cleared controlled orbit/multi-view capture and measured scale, then configure the reconstruction engine credential as a secret.',
    evidence_required: 'At least front/rear/left/right/three-quarter views, measured W/D/H, image rights, reconstruction result, source-view rerender QA and observed/inferred/unresolved surface percentages.',
    current_state: photoMetric?.status ?? photoPreflight?.status ?? (photoCapturePlan ? 'CAPTURE_PLAN_READY_IMAGES_AND_CREDENTIAL_REQUIRED' : 'NO_JOB_RUN'),
    capture_plan_state: photoCapturePlan ? 'READY' : 'NOT_PREPARED',
    preflight_state: photoPreflight?.status ?? 'NO_JOB_PREFLIGHT_RECORDED',
    unlocks: ['photo-to-avatar multi-view QA gate'],
    do_not_do: 'Do not paste API keys into chat or commit them; use a repository/environment secret.',
    evidence_file: photoCapturePlan ? 'config/geometry/photo-avatar-controlled-capture.json' : 'config/geometry/photo-avatar-job.schema.json',
  },
  {
    priority: 6,
    action_id: 'IKEA_LOCATION_AVAILABILITY_CHECKOUT',
    owner: 'project_owner_in_live_merchant_session',
    target: 'IKEA SKURUP 804.071.14 / MELODI 603.865.27 at 29660',
    request: 'Resolve delivery/store availability in a live IKEA Spain location session and verify checkout health immediately before procurement.',
    evidence_required: 'Minimal timestamped availability/checkout state only; no stock payload or cart/session persistence.',
    current_state: merchantSession?.status ?? sceneMetric?.end_to_end_status ?? 'LIVE_SESSION_EVIDENCE_NOT_RECORDED',
    unlocks: ['full shoppable-scene live exit'],
    do_not_do: 'Do not treat generic schema.org availability or a dated price as postcode-level delivery stock.',
    evidence_file: merchantSession ? 'data/metrics/v0-merchant-session-latest.json' : 'config/commerce/ikea-v0-live-session-contract.json',
  },
];

const blocked = gates.filter((gate) => gate.status !== 'PASS');
const output = {
  generated_at: new Date().toISOString(),
  status: blocked.length ? 'V0_BLOCKED_EXTERNAL_GATES_REMAIN' : 'V0_EXIT_CRITERIA_PASS',
  summary: {
    gates_total: gates.length,
    gates_passed: gates.length - blocked.length,
    gates_blocked: blocked.length,
    promoted_g3_plus: g3Plus,
    promoted_g4_plus: g4Plus,
    authorized_g3_geometry_qa_passes: authorizedG3QaMetrics.length,
    authorized_g4_geometry_qa_passes: authorizedG4QaMetrics.length,
    exact_cart_proof_exists: exactCart?.cart_created === true,
    exact_cart_authoritative_shipping: exactCart?.authoritative_shipping === true,
  },
  gates,
  next_actions: actions,
  working_rule: 'Do not resume broad source hunting. Execute these target-specific access, rights, photo-capture and live-session actions in priority order.',
};

await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
await fs.writeFile(OUTPUT, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
