import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const board = JSON.parse(await fs.readFile(path.join(ROOT, 'data/showrooms/living-room-supply-board-v0.2.json'), 'utf8'));
const avatarIndex = JSON.parse(await fs.readFile(path.join(ROOT, 'data/geometry/avatar-index.json'), 'utf8'));
const promoted = new Set((avatarIndex.avatars ?? []).map((avatar) => avatar.avatar_id));
const candidates = new Set((avatarIndex.candidates ?? []).map((candidate) => candidate.avatar_id));

async function twinCheck(item) {
  const filePath = path.join(ROOT, 'data/twins', `${item.twin_id}.json`);
  try {
    const twin = JSON.parse(await fs.readFile(filePath, 'utf8'));
    return twin.twin_id === item.twin_id;
  } catch {
    return false;
  }
}

const buildTwinChecks = await Promise.all(board.build_now.map(twinCheck));
const candidateTwinChecks = await Promise.all(board.shopify_native_geometry_lane.map(twinCheck));
const gap = board.shopify_native_geometry_gap_census;
const checks = [
  {id: 'build_now_count', pass: board.build_now.length === board.summary.build_now_product_twins},
  {id: 'build_now_promoted_avatar_count', pass: board.build_now.filter((item) => promoted.has(item.avatar_id)).length === board.summary.build_now_promoted_g2_assets},
  {id: 'build_now_twin_records', pass: buildTwinChecks.every(Boolean)},
  {id: 'shopify_candidate_count', pass: board.shopify_native_geometry_lane.length === board.summary.shopify_native_model3d_candidates},
  {id: 'shopify_candidate_index_entries', pass: board.shopify_native_geometry_lane.every((item) => candidates.has(item.avatar_id))},
  {id: 'shopify_candidate_twin_records', pass: candidateTwinChecks.every(Boolean)},
  {id: 'shopify_scale_pass_summary', pass: board.summary.shopify_native_scale_qa_passes === avatarIndex.summary.merchant_native_scale_qa_passes},
  {id: 'shopify_texture_summary', pass: board.summary.shopify_native_textured_candidates === avatarIndex.summary.textured_merchant_native_model3d_candidates},
  {id: 'no_premature_g3', pass: board.summary.shopify_native_candidates_promoted_g3 === 0 && board.summary.living_room_roles_covered_with_exact_visual_g3 === 0},
  {id: 'supplier_outreach_parked', pass: board.source_decisions.supplier_outreach === 'PARKED'},
  {id: 'coffee_table_gap_closed', pass: gap.coffee_tables_checked === 604 && gap.coffee_table_model3d_hits === 0},
  {id: 'side_table_gap_closed', pass: gap.side_tables_checked === 385 && gap.side_table_model3d_hits === 0},
  {id: 'floor_lamp_gap_closed', pass: gap.floor_lamps_checked === 121 && gap.floor_lamp_model3d_hits === 0},
  {id: 'rug_gap_closed', pass: gap.rugs_checked === 212 && gap.rug_model3d_hits === 0},
  {id: 'current_supply_coverage_preserved', pass: board.summary.current_design_confirmed_deliverable_percentage === 87.5},
  {id: 'valnas_conditional_supply_rescue', pass: board.live_supply_recovery.conditional_coverage_scenario.if_approved_confirmed_deliverable_percentage === 100 && board.live_supply_recovery.conditional_coverage_scenario.coverage_lift_percentage_points === 12.5},
  {id: 'conditional_scenario_not_current', pass: board.summary.conditional_scenario_counted_as_current_coverage === false && board.live_supply_recovery.conditional_coverage_scenario.counted_as_current_coverage === false},
  {id: 'valnas_conditional_budget_delta', pass: board.live_supply_recovery.conditional_coverage_scenario.if_approved_merchandise_subtotal_eur === 1176.96 && board.live_supply_recovery.conditional_coverage_scenario.price_delta_eur === 50},
];
const blocked = checks.filter((check) => !check.pass);
const metric = {
  generated_at: new Date().toISOString(),
  status: blocked.length ? 'LIVING_ROOM_SUPPLY_BOARD_BLOCKED' : 'LIVING_ROOM_SUPPLY_BOARD_PASS',
  checks_total: checks.length,
  checks_passed: checks.length - blocked.length,
  blocked_check_ids: blocked.map((check) => check.id),
  summary: board.summary,
  checks,
};
await fs.writeFile(path.join(ROOT, 'data/metrics/living-room-supply-board-latest.json'), `${JSON.stringify(metric, null, 2)}\n`);
console.log(JSON.stringify(metric, null, 2));
if (blocked.length) process.exitCode = 1;
