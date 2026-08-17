import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSwedenPlotIntelligence } from "./validate-sweden-plot-intelligence.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY_REL = "data/sites/sweden/source-registry-v0.1.json";
const INTAKE_REL = "data/sites/sweden/saterdalsvagen-14/intake-v0.1.json";
const SITE_REL = "data/sites/sweden/saterdalsvagen-14/plot-intelligence-v0.1.json";
const PROJECT_REL = "data/sites/sweden/saterdalsvagen-14/project-v0.1.json";
const SCENARIO_REL = "data/sites/sweden/saterdalsvagen-14/design-scenario-v0.1.json";

const readJson = (root, relative) => JSON.parse(fs.readFileSync(path.resolve(root, relative), "utf8"));
const digestFile = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const digestRelative = (root, relative) => digestFile(path.resolve(root, relative));
const exactSet = (values, expected) => Array.isArray(values)
  && values.length === expected.length
  && new Set(values).size === expected.length
  && expected.every((value) => values.includes(value));

export function validateSaterdalsvagen14({
  root = ROOT,
  registryOverride = null,
  intakeOverride = null,
  siteOverride = null,
  projectOverride = null,
  scenarioOverride = null,
  requireRuntime = false,
} = {}) {
  const errors = [];
  let assertions = 0;
  const check = (condition, message) => {
    assertions += 1;
    if (!condition) errors.push(message);
  };

  const registry = registryOverride ?? readJson(root, REGISTRY_REL);
  const intake = intakeOverride ?? readJson(root, INTAKE_REL);
  const site = siteOverride ?? readJson(root, SITE_REL);
  const project = projectOverride ?? readJson(root, PROJECT_REL);
  const scenario = scenarioOverride ?? readJson(root, SCENARIO_REL);

  const generic = validateSwedenPlotIntelligence({
    root,
    registryOverride: registry,
    intakeOverride: intake,
    plotOverride: site,
    registryPath: REGISTRY_REL,
    intakePath: INTAKE_REL,
    plotPath: SITE_REL,
  });
  assertions += generic.assertions;
  errors.push(...generic.errors.map((error) => `national profile: ${error}`));

  check(project.entity_type === "SwedenPlotProject" && project.project_id === "PRJ_SE_SATERDALSVAGEN14", "project identity is wrong");
  check(project.status === "DISCOVERY", "project is promoted beyond discovery");
  check(site.status === "DISCOVERY", "Site Twin is promoted beyond discovery");
  check(site.project_context?.project_id === project.project_id, "Project and Site Twin IDs are not bound");
  check(project.site_twin_ref?.path === SITE_REL, "project points to the wrong Site Twin path");
  check(project.site_twin_ref?.content_sha256 === digestRelative(root, SITE_REL), "project Site Twin content hash is stale");
  check(scenario.site_twin_ref?.path === SITE_REL, "scenario points to the wrong Site Twin path");
  check(scenario.site_twin_ref?.content_sha256 === digestRelative(root, SITE_REL), "scenario Site Twin content hash is stale");
  check(scenario.status === "BLOCKED_PENDING_SITE_BASIS", "scenario was promoted without a design basis");
  check(exactSet(scenario.requested_house_profiles, ["HOUSEKIT_H30", "HOUSEKIT_H50"]), "scenario comparison profiles changed");
  for (const field of ["selected_house_profile", "site_boundary", "buildable_envelope", "building_geometry", "access_point", "finished_floor_level"]) {
    check(scenario[field] === null, `scenario ${field} must remain null`);
  }
  check(scenario.separation_rules?.cannot_redefine_site_boundary === true, "scenario may redefine the Site Twin boundary");
  check(scenario.separation_rules?.cannot_promote_screening_to_entitlement === true, "scenario may promote screening to entitlement");
  check(scenario.separation_rules?.cannot_convert_seller_claims_to_verified_facts === true, "scenario may convert seller claims into verified facts");

  const marketReceiptIds = new Set((project.market_source_receipts ?? []).map((receipt) => receipt.receipt_id));
  check(marketReceiptIds.size === 2, "market receipt set is incomplete or duplicated");
  for (const receipt of project.market_source_receipts ?? []) {
    check(receipt.source_role === "SELLER_MARKETING", `${receipt.receipt_id}: market evidence was promoted to authority evidence`);
    check(/^https:\/\/(www\.)?(boneo\.se|files\.boneo\.se)\//.test(receipt.url), `${receipt.receipt_id}: unexpected market source host`);
    check(/^[a-f0-9]{64}$/.test(receipt.sha256), `${receipt.receipt_id}: invalid market receipt hash`);
  }
  const factById = new Map((project.reported_facts ?? []).map((fact) => [fact.fact_id, fact]));
  check(factById.size === (project.reported_facts?.length ?? 0), "market fact IDs are duplicated");
  for (const fact of project.reported_facts ?? []) {
    check(fact.status === "REPORTED_UNVERIFIED", `${fact.fact_id}: seller fact was promoted to verified`);
    check(fact.source_receipt_refs?.every((ref) => marketReceiptIds.has(ref)), `${fact.fact_id}: unknown market receipt reference`);
  }
  check(factById.get("MARKET_AREA_M2")?.value === 1939, "listing area changed");
  check(factById.get("MARKET_PRICE_SEK")?.value === 2300000, "listing price changed");
  check(factById.get("MARKET_MUNICIPAL_VA_PAID")?.value === true, "seller VA statement changed");
  check(factById.get("WORKING_PROPERTY_DESIGNATION")?.value === "SVÄRTINGE 54:28", "working property designation changed");
  check(project.comparisons?.length === 1
    && project.comparisons[0].market_value_m2 === 1939
    && project.comparisons[0].public_locator_value_m2 === 1938.1988442902577
    && project.comparisons[0].delta_m2 === 0.8011557097423
    && project.comparisons[0].resolution === "OPEN_PENDING_AUTHORITATIVE_PROPERTY_RECORD", "area discrepancy is not retained as open");

  const gateById = new Map((site.gates ?? []).map((gate) => [gate.gate_id, gate]));
  const satisfiedGates = (site.gates ?? []).filter((gate) => gate.status === "SATISFIED").map((gate) => gate.gate_id);
  check(exactSet(satisfiedGates, ["GATE_SE_MUNICIPAL_JURISDICTION", "GATE_SE_CURRENT_LAW_PROFILE"]), "the verified discovery gate set is wrong");
  for (const gateId of [
    "GATE_SE_PLOT_IDENTITY",
    "GATE_SE_BOUNDARY_FOR_DESIGN",
    "GATE_SE_DETAIL_PLAN_AND_STATUS",
    "GATE_SE_H30_H50_ELIGIBILITY",
    "GATE_SE_BUILDABLE_ENVELOPE",
    "GATE_SE_TERRAIN",
    "GATE_SE_GROUND_CONDITIONS",
    "GATE_SE_FLOOD_AND_GEOHAZARDS",
    "GATE_SE_ENVIRONMENTAL_RESTRICTIONS",
    "GATE_SE_CULTURAL_AND_CONTAMINATION",
    "GATE_SE_LEGAL_ACCESS",
    "GATE_SE_UTILITIES_AND_CAPACITY",
    "GATE_SE_CONSTRUCTION_CLEARANCE",
  ]) check(gateById.get(gateId)?.status === "OPEN", `${gateId} must remain OPEN`);

  const findingById = new Map((site.findings ?? []).map((finding) => [finding.finding_id, finding]));
  check(findingById.get("FINDING_SE_SOIL_GLACIOFLUVIAL")?.value === "Isälvssediment", "official soil class changed");
  check(findingById.get("FINDING_SE_MODELLED_SOIL_DEPTH_9M")?.value === 9, "modelled soil depth changed");
  check(findingById.get("FINDING_SE_NEARBY_SOIL_DEPTH_VARIABILITY")?.value?.selected_depth_range_m?.[0] === 0
    && findingById.get("FINDING_SE_NEARBY_SOIL_DEPTH_VARIABILITY")?.value?.selected_depth_range_m?.[1] === 22, "nearby soil-depth variability changed");
  check(findingById.get("FINDING_SE_HERITAGE_POINTS_500M")?.value?.length === 2
    && findingById.get("FINDING_SE_HERITAGE_POINTS_500M")?.value?.every((record) => record.distance_m > 470 && record.distance_m < 473), "heritage screening records changed");
  check(findingById.get("FINDING_SE_PROTECTED_SERVICE_INCONCLUSIVE")?.value?.conclusion === "NO_ABSENCE_INFERENCE", "inconclusive protected-area response was treated as absence");
  check(findingById.get("FINDING_SE_HEIGHT_ITEM_AVAILABLE_NOT_FETCHED")?.value?.asset_access === "HTTP_401_WITHOUT_CREDENTIALS", "terrain asset access gap disappeared without evidence");
  check(findingById.get("FINDING_SE_SVARTINGE_UDDE_AMENDMENT_SCOPE")?.limitations?.some((text) => text.includes("not been proven")), "Svärtinge Udde plan was treated as governing this plot");
  check(findingById.get("FINDING_SE_GLAN_WATER_PROTECTION_UNRESOLVED")?.value?.plot_zone === null, "water-protection zone was invented");
  check(findingById.get("FINDING_SE_NOKA_PROPERTY_LOCATOR_CONFIRMED")?.value?.property_designation === "SVÄRTINGE 54:28"
    && findingById.get("FINDING_SE_NOKA_PROPERTY_LOCATOR_CONFIRMED")?.value?.municipality === "Norrköping", "NOKA property locator changed");
  check(findingById.get("FINDING_SE_NOKA_EFFECTIVE_PLAN_LOCATOR")?.value?.plan_record === "0581K-22D:1008"
    && findingById.get("FINDING_SE_NOKA_EFFECTIVE_PLAN_LOCATOR")?.verification === "PARTIAL", "NOKA effective-plan locator changed or was over-promoted");
  const historicPlanFinding = findingById.get("FINDING_SE_PLAN_22D1008_HISTORIC_PROVISIONS");
  check(historicPlanFinding?.value?.historic_review_signals?.maximum_dwelling_houses_per_plot === 1
    && historicPlanFinding?.value?.historic_review_signals?.average_plot_area_approx_m2 === 3000
    && historicPlanFinding?.value?.historic_review_signals?.maximum_road_gradient === "1:12"
    && historicPlanFinding?.value?.historic_review_signals?.high_voltage_corridor_width_m === 40,
  "historic plan review signals changed");
  check(historicPlanFinding?.verification === "PARTIAL"
    && historicPlanFinding?.limitations?.some((text) => text.includes("not recorded as a present minimum-plot-size provision")),
  "historic plan evidence was promoted into a current plot entitlement");
  check(findingById.get("FINDING_SE_PLAN_22D1008_MAP_AVAILABLE")?.value?.current_property_directly_identified === false,
    "the current property was falsely identified on the historic plan map");
  const strategicStatus = findingById.get("FINDING_SE_CURRENT_STRATEGIC_PLAN_STATUS");
  check(strategicStatus?.value?.municipality_wide_plan_adopted === "2025-12-15"
    && strategicStatus?.value?.svartinge_1984_plan_status === "OUTDATED_BUT_CONTINUES_UNTIL_REPLACED"
    && strategicStatus?.value?.svartinge_2026_proposal_adopted === false,
  "adopted, continuing and proposed strategic-plan states were conflated");
  const draftPointContext = findingById.get("FINDING_SE_DRAFT_FOP_POINT_CONTEXT");
  check(draftPointContext?.verification === "PARTIAL"
    && draftPointContext?.value?.proposal_stage === "CONSULTATION_DRAFT_NOT_ADOPTED"
    && draftPointContext?.value?.proposed_area_name === "Övre Svärtinge"
    && exactSet(draftPointContext?.value?.proposal_minimum_plot_size_m2, [1000, 1200])
    && draftPointContext?.value?.geotechnical_zone === 2,
  "draft municipal point context changed or was over-promoted");
  check(draftPointContext?.value?.absence_inference_permitted === false
    && draftPointContext?.limitations?.some((text) => text.includes("zero point intersections cannot establish non-intersection")),
  "point-only zero intersections were converted into parcel-wide absence evidence");
  for (const gateId of ["GATE_SE_GROUND_CONDITIONS", "GATE_SE_FLOOD_AND_GEOHAZARDS", "GATE_SE_ENVIRONMENTAL_RESTRICTIONS"]) {
    check(gateById.get(gateId)?.evidence_refs?.includes("FINDING_SE_DRAFT_FOP_POINT_CONTEXT"), `${gateId} is not bound to the municipal point-screen limitations`);
  }
  const ebhContext = findingById.get("FINDING_SE_EBH_CONTEXT_2KM");
  check(ebhContext?.value?.records_within_2km === 4
    && ebhContext?.value?.nearest_records?.[0]?.ebh_object_id === 143275
    && ebhContext?.value?.nearest_records?.[0]?.distance_m === 312.3
    && ebhContext?.value?.nearest_records?.[1]?.ebh_object_id === 144072
    && ebhContext?.value?.nearest_records?.[1]?.risk_class === "2",
  "EBH contamination-context records changed");
  check(ebhContext?.value?.plot_contamination_conclusion === "UNRESOLVED"
    && ebhContext?.limitations?.some((text) => text.includes("do not prove contamination")),
  "EBH context was converted into a plot contamination conclusion");
  check(gateById.get("GATE_SE_CULTURAL_AND_CONTAMINATION")?.evidence_refs?.includes("FINDING_SE_EBH_CONTEXT_2KM"),
    "contamination gate is not bound to the EBH context and its limitations");
  check(gateById.get("GATE_SE_MUNICIPAL_JURISDICTION")?.status === "SATISFIED"
    && gateById.get("GATE_SE_MUNICIPAL_JURISDICTION")?.evidence_refs?.includes("FINDING_SE_NOKA_PROPERTY_LOCATOR_CONFIRMED"), "municipal jurisdiction is not bound to the NOKA evidence");

  if (requireRuntime) {
    const receipts = [...(site.source_receipts ?? []), ...(project.market_source_receipts ?? [])];
    for (const receipt of receipts) {
      const file = path.resolve(root, receipt.runtime_locator);
      check(fs.existsSync(file), `${receipt.receipt_id}: runtime evidence file is absent`);
      if (fs.existsSync(file)) check(digestFile(file) === receipt.sha256, `${receipt.receipt_id}: runtime evidence hash mismatch`);
    }
  }

  return { ok: errors.length === 0, errors, assertions };
}

function runCli() {
  const unknown = process.argv.slice(2).filter((arg) => arg !== "--require-runtime");
  if (unknown.length) {
    console.error(`Unknown arguments: ${unknown.join(", ")}`);
    process.exitCode = 2;
    return;
  }
  const result = validateSaterdalsvagen14({ requireRuntime: process.argv.includes("--require-runtime") });
  if (!result.ok) {
    console.error(`Säterdalsvägen 14 validation failed (${result.errors.length} errors, ${result.assertions} assertions):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Säterdalsvägen 14 validation passed (${result.assertions} assertions; Project → Site Twin → blocked Design Scenario).`);
}

const mainFile = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (mainFile && fileURLToPath(import.meta.url) === mainFile) runCli();
