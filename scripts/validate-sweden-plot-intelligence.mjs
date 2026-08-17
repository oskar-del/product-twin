import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REGISTRY_REL = "data/sites/sweden/source-registry-v0.1.json";
const INTAKE_REL = "data/sites/sweden/plot-intake-template-v0.1.json";
const PLOT_REL = "data/sites/sweden/plot-intelligence-template-v0.1.json";
const SCHEMA_RELS = [
  "config/site/sweden-source-registry-v0.1.schema.json",
  "config/site/sweden-plot-intake-v0.1.schema.json",
  "config/site/sweden-plot-intelligence-v0.1.schema.json",
];

export const EXPECTED_SOURCE_IDS = [
  "SE_LM_HEIGHT_1M_STAC",
  "SE_LM_ORTHOPHOTO_STAC",
  "SE_LM_PROPERTY_DIVISION_VECTOR",
  "SE_LM_BUILDINGS_VECTOR",
  "SE_LM_PROPERTY_REGISTER_EXTRACT",
  "SE_NGP_DETAIL_PLAN",
  "SE_BOVERKET_PLAN_PROVISIONS_API",
  "SE_BOVERKET_CURRENT_PBL",
  "SE_MUNICIPAL_PLAN_AND_PERMIT_ARCHIVE",
  "SE_SGU_SOIL_25_100K",
  "SE_SGU_SOIL_DEPTH",
  "SE_SGU_WELLS",
  "SE_SGU_GROUNDWATER",
  "SE_SGI_GROUND_RISK",
  "SE_MCF_FLOOD",
  "SE_NATURVARD_PROTECTED_AREAS",
  "SE_NATURVARD_NATURA2000",
  "SE_NATURVARD_STRANDSKYDD",
  "SE_RAA_FORNSOK",
  "SE_LST_CONTAMINATED_LAND",
  "SE_LST_GEODATA_CATALOG",
  "SE_TRAFIKVERKET_NVDB",
  "SE_LEDNINGSKOLLEN",
  "SE_EI_GRID_PLANS",
  "SE_SMHI_OPEN_DATA",
  "SE_MUNICIPAL_VA_AND_BUILDING_RESPONSE",
  "SE_UTILITY_PROVIDER_CAPACITY_RESPONSE",
  "SE_FIELD_SURVEY",
  "SE_FIELD_GROUND_ENVIRONMENT",
];

export const EXPECTED_GATES = [
  "GATE_SE_PLOT_IDENTITY",
  "GATE_SE_MUNICIPAL_JURISDICTION",
  "GATE_SE_PROPERTY_DIVISION_CONTEXT",
  "GATE_SE_PROPERTY_REGISTER",
  "GATE_SE_RIGHTS_AND_JOINT_FACILITIES",
  "GATE_SE_BOUNDARY_FOR_DESIGN",
  "GATE_SE_DETAIL_PLAN_AND_STATUS",
  "GATE_SE_CURRENT_LAW_PROFILE",
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
];

const EXPECTED_LEVELS = [
  "LEVEL_OPEN_NATIONAL_CONTEXT",
  "LEVEL_MUNICIPAL_PLANNING",
  "LEVEL_AUTHORITATIVE_PROPERTY_RECORD",
  "LEVEL_FIELD_AND_PROVIDER_PROOF",
];

const ALLOWED_HOSTS = new Set([
  "api-portal.boverket.se",
  "api.lantmateriet.se",
  "app.raa.se",
  "bransch.trafikverket.se",
  "ei.se",
  "geodata.naturvardsverket.se",
  "geotorget.lantmateriet.se",
  "gis.lansstyrelsen.se",
  "gis.sgi.se",
  "namespace.lantmateriet.se",
  "nvdbpakarta.trafikverket.se",
  "opendata-download-metobs.smhi.se",
  "opendata.smhi.se",
  "resource.sgu.se",
  "www.boverket.se",
  "www.lantmateriet.se",
  "www.ledningskollen.se",
  "www.mcf.se",
  "www.naturvardsverket.se",
  "www.raa.se",
  "www.sgi.se",
  "www.sgu.se",
  "www.smhi.se",
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function digest(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function exactSet(values, expected) {
  return Array.isArray(values)
    && values.length === expected.length
    && new Set(values).size === expected.length
    && expected.every((value) => values.includes(value));
}

function isIsoDate(value) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

function isIsoDateTime(value) {
  return typeof value === "string"
    && /(Z|[+-]\d\d:\d\d)$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function officialHttps(value) {
  if (value === null) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function includesText(values, fragment) {
  return Array.isArray(values) && values.some((value) => value.toLowerCase().includes(fragment.toLowerCase()));
}

export function validateSwedenPlotIntelligence({
  root = process.cwd(),
  registryOverride = null,
  intakeOverride = null,
  plotOverride = null,
  registryPath = REGISTRY_REL,
  intakePath = INTAKE_REL,
  plotPath = PLOT_REL,
} = {}) {
  const errors = [];
  let assertions = 0;
  const check = (condition, message) => {
    assertions += 1;
    if (!condition) errors.push(message);
  };
  const absolute = (relative) => path.resolve(root, relative);

  for (const schemaRel of SCHEMA_RELS) {
    const file = absolute(schemaRel);
    check(fs.existsSync(file), `${schemaRel}: schema is absent`);
    if (!fs.existsSync(file)) continue;
    let schema;
    try { schema = readJson(file); } catch { schema = null; }
    check(schema !== null, `${schemaRel}: schema is not valid JSON`);
    if (!schema) continue;
    check(schema.$schema === "https://json-schema.org/draft/2020-12/schema", `${schemaRel}: wrong JSON Schema dialect`);
    check(schema.additionalProperties === false, `${schemaRel}: root must fail closed on unknown properties`);
    check(typeof schema.$id === "string" && schema.$id.includes("product-twin.local/schemas/site/"), `${schemaRel}: schema ID is missing or wrong`);
  }

  const registryFile = absolute(registryPath);
  const intakeFile = absolute(intakePath);
  const plotFile = absolute(plotPath);
  check(registryOverride !== null || fs.existsSync(registryFile), "Sweden source registry is absent");
  check(intakeOverride !== null || fs.existsSync(intakeFile), "Sweden intake template is absent");
  check(plotOverride !== null || fs.existsSync(plotFile), "Sweden plot-intelligence template is absent");
  if (errors.length) return { ok: false, errors, assertions };

  const registry = registryOverride ?? readJson(registryFile);
  const intake = intakeOverride ?? readJson(intakeFile);
  const plot = plotOverride ?? readJson(plotFile);

  check(registry.schema_version === "0.1", "registry schema version must be 0.1");
  check(registry.entity_type === "SwedenPlotSourceRegistry", "registry entity type is wrong");
  check(registry.registry_id === "SE_PLOT_SOURCE_REGISTRY_V0_1", "registry ID is wrong");
  check(registry.country === "SE" && registry.canonical_crs === "EPSG:3006", "registry country or canonical CRS is wrong");
  check(isIsoDate(registry.researched_at), "registry research date is invalid");
  check(exactSet(registry.evidence_levels?.map((level) => level.level_id), EXPECTED_LEVELS), "evidence ladder is incomplete or unexpected");
  for (const [index, level] of (registry.evidence_levels ?? []).entries()) {
    check(level.precedence === index + 1, `${level.level_id}: evidence precedence is wrong`);
    check(typeof level.role === "string" && level.role.length >= 20, `${level.level_id}: role is too weak`);
    check(typeof level.promotion_limit === "string" && level.promotion_limit.length >= 20, `${level.level_id}: promotion limit is missing`);
  }

  const rule = registry.current_rule_profile ?? {};
  check(rule.profile_id === "PBL_2025_974_EFFECTIVE_2025_12_01", "current PBL profile ID is wrong");
  check(rule.effective_from === "2025-12-01", "current PBL effective date is wrong");
  check(rule.legal_source_id === "SE_BOVERKET_CURRENT_PBL", "current PBL source binding is wrong");
  check(rule.inside_detail_plan?.max_individual_area_m2 === 30, "inside-plan individual H30 limit changed");
  check(rule.inside_detail_plan?.max_cumulative_area_m2 === 45, "inside-plan aggregate limit changed");
  check(rule.inside_detail_plan?.max_ridge_height_m === 4, "inside-plan ridge-height limit changed");
  check(rule.outside_detail_plan?.max_individual_area_m2 === 50, "outside-plan individual H50 limit changed");
  check(rule.outside_detail_plan?.max_cumulative_area_m2 === 65, "outside-plan aggregate limit changed");
  check(rule.outside_detail_plan?.max_ridge_height_m === 4.5, "outside-plan ridge-height limit changed");
  check(Array.isArray(rule.always_requires_case_checks) && rule.always_requires_case_checks.length >= 7, "H30/H50 case checks are incomplete");
  check(includesText(rule.always_requires_case_checks, "principal building"), "H30/H50 profile omits the principal-building test");
  check(includesText(rule.always_requires_case_checks, "aggregate"), "H30/H50 profile omits aggregate-area accounting");
  check(includesText(rule.always_requires_case_checks, "shoreline"), "H30/H50 profile omits special-protection checks");

  const sourceIds = registry.sources?.map((source) => source.source_id) ?? [];
  check(exactSet(sourceIds, EXPECTED_SOURCE_IDS), "source registry is incomplete or contains unexpected sources");
  const sourceById = new Map((registry.sources ?? []).map((source) => [source.source_id, source]));
  check(sourceById.size === (registry.sources?.length ?? 0), "source IDs are duplicated");
  for (const source of registry.sources ?? []) {
    check(EXPECTED_LEVELS.includes(source.evidence_level), `${source.source_id}: unknown evidence level`);
    check(Array.isArray(source.themes) && source.themes.length >= 1, `${source.source_id}: no themes`);
    check(officialHttps(source.landing_page), `${source.source_id}: landing page is not an allowed official HTTPS URL`);
    check(officialHttps(source.endpoint_url), `${source.source_id}: endpoint is not an allowed official HTTPS URL`);
    check(officialHttps(source.probe_url), `${source.source_id}: probe URL is not an allowed official HTTPS URL`);
    check(Array.isArray(source.cannot_prove) && source.cannot_prove.length >= 1, `${source.source_id}: cannot-prove guard is absent`);
    check(Array.isArray(source.limitations) && source.limitations.length >= 1, `${source.source_id}: limitations are absent`);
    check(isIsoDate(source.checked_at), `${source.source_id}: checked_at is invalid`);
    check(Array.isArray(source.can_close_gates) && source.can_close_gates.every((gate) => EXPECTED_GATES.includes(gate)), `${source.source_id}: references an unknown closeable gate`);
    const expectedAutomation = {
      OPEN_API: ["DIRECT"],
      OPEN_DOWNLOAD: ["DIRECT"],
      ACCESS_SETUP: ["DIRECT_AFTER_ACCESS"],
      LEGAL_REVIEW_AND_ACCESS: ["DIRECT_AFTER_ACCESS"],
      REQUEST_BASED: ["HUMAN_REQUEST_REQUIRED"],
      ACCOUNT_CASE: ["CASE_CREATION_REQUIRES_PERMISSION"],
      MUNICIPALITY_SPECIFIC: ["MUNICIPAL_ADAPTER_REQUIRED", "HUMAN_REQUEST_REQUIRED"],
      PROVIDER_RESPONSE: ["HUMAN_REQUEST_REQUIRED"],
      COMMISSIONED: ["COMMISSION_REQUIRED"],
    }[source.access_mode] ?? [];
    check(expectedAutomation.includes(source.automation_state), `${source.source_id}: access mode and automation state conflict`);
    if (["REQUEST_BASED", "ACCOUNT_CASE", "MUNICIPALITY_SPECIFIC", "PROVIDER_RESPONSE", "COMMISSIONED"].includes(source.access_mode)) {
      check(Array.isArray(source.resolution_requires) && source.resolution_requires.length >= 1, `${source.source_id}: human/case source lacks prerequisites`);
    }
  }

  const propertyDivision = sourceById.get("SE_LM_PROPERTY_DIVISION_VECTOR") ?? {};
  check(exactSet(propertyDivision.can_close_gates, ["GATE_SE_PROPERTY_DIVISION_CONTEXT"]), "property-division vector has excessive gate authority");
  check(includesText(propertyDivision.cannot_prove, "legally binding boundary"), "property-division vector lacks the non-legal-boundary warning");
  check(!propertyDivision.can_close_gates?.includes("GATE_SE_BOUNDARY_FOR_DESIGN"), "property-division vector is being treated as a design/legal survey");

  const height = sourceById.get("SE_LM_HEIGHT_1M_STAC") ?? {};
  check(height.endpoint_url === "https://api.lantmateriet.se/stac-hojd/v1", "height-model STAC endpoint changed unexpectedly");
  check(height.name.includes("Markhöjdmodell"), "height source identity is wrong");
  check(includesText(height.cannot_prove, "survey-grade"), "height model is being treated as field survey evidence");

  const ngp = sourceById.get("SE_NGP_DETAIL_PLAN") ?? {};
  check(ngp.can_close_gates?.length === 0, "NGP discovery data must not alone close the plan gate");
  check(includesText(ngp.limitations, "before 2022-01-01"), "NGP historical-coverage limitation is absent");
  check(includesText(ngp.limitations, "legal force"), "NGP legal-force limitation is absent");

  const pbl = sourceById.get("SE_BOVERKET_CURRENT_PBL") ?? {};
  check(exactSet(pbl.can_close_gates, ["GATE_SE_CURRENT_LAW_PROFILE"]), "Boverket law guidance has excessive gate authority");
  check(includesText(pbl.cannot_prove, "plot-specific eligibility"), "Boverket guidance is being used as plot-specific permission");

  const propertyExtract = sourceById.get("SE_LM_PROPERTY_REGISTER_EXTRACT") ?? {};
  check(propertyExtract.access_mode === "REQUEST_BASED", "property-register extract is falsely automated");
  check(includesText(propertyExtract.cannot_prove, "full register"), "standard extract is being treated as the full property record");

  const nvdb = sourceById.get("SE_TRAFIKVERKET_NVDB") ?? {};
  check(nvdb.can_close_gates?.length === 0, "NVDB must not close legal access");
  check(includesText(nvdb.cannot_prove, "legal property access"), "NVDB legal-access guard is absent");

  const ledningskollen = sourceById.get("SE_LEDNINGSKOLLEN") ?? {};
  check(exactSet(ledningskollen.can_close_gates, ["GATE_SE_CONSTRUCTION_CLEARANCE"]), "Ledningskollen has excessive gate authority");
  check(!ledningskollen.can_close_gates?.includes("GATE_SE_UTILITIES_AND_CAPACITY"), "Ledningskollen is being used as a capacity confirmation");
  check(includesText(ledningskollen.cannot_prove, "utility capacity"), "Ledningskollen capacity warning is absent");

  const utilityResponse = sourceById.get("SE_UTILITY_PROVIDER_CAPACITY_RESPONSE") ?? {};
  check(exactSet(utilityResponse.can_close_gates, ["GATE_SE_UTILITIES_AND_CAPACITY"]), "provider capacity response has wrong gate authority");
  check(utilityResponse.access_mode === "PROVIDER_RESPONSE", "provider capacity was not classified as a provider response");

  const soil = sourceById.get("SE_SGU_SOIL_25_100K") ?? {};
  check(soil.can_close_gates?.length === 0, "overview soil mapping must not close the ground-condition gate");
  check(includesText(soil.cannot_prove, "bearing capacity"), "soil source lacks bearing-capacity guard");

  const survey = sourceById.get("SE_FIELD_SURVEY") ?? {};
  check(exactSet(survey.can_close_gates, ["GATE_SE_BOUNDARY_FOR_DESIGN"]), "field survey has wrong gate authority");
  check(survey.automation_state === "COMMISSION_REQUIRED", "field survey was falsely automated");

  const fieldGround = sourceById.get("SE_FIELD_GROUND_ENVIRONMENT") ?? {};
  check(exactSet(fieldGround.can_close_gates, ["GATE_SE_GROUND_CONDITIONS"]), "field ground pack has wrong gate authority");
  check(fieldGround.automation_state === "COMMISSION_REQUIRED", "ground investigation was falsely automated");

  const gateIds = registry.gate_catalog?.map((gate) => gate.gate_id) ?? [];
  check(exactSet(gateIds, EXPECTED_GATES), "gate catalog is incomplete or unexpected");
  const gateById = new Map((registry.gate_catalog ?? []).map((gate) => [gate.gate_id, gate]));
  check(gateById.size === (registry.gate_catalog?.length ?? 0), "gate catalog contains duplicate IDs");
  for (const gate of registry.gate_catalog ?? []) {
    check(gate.default_status === "OPEN", `${gate.gate_id}: default status must be OPEN`);
    check(Array.isArray(gate.close_requires) && gate.close_requires.length >= 1, `${gate.gate_id}: close requirements are absent`);
    check(typeof gate.false_positive_guard === "string" && gate.false_positive_guard.length >= 20, `${gate.gate_id}: false-positive guard is absent`);
    check(gate.screening_sources?.every((sourceId) => sourceById.has(sourceId)), `${gate.gate_id}: references an unknown screening source`);
  }
  check(includesText(gateById.get("GATE_SE_H30_H50_ELIGIBILITY")?.close_requires, "principal building"), "H30/H50 gate omits the principal-building requirement");
  check(includesText(gateById.get("GATE_SE_H30_H50_ELIGIBILITY")?.false_positive_guard ? [gateById.get("GATE_SE_H30_H50_ELIGIBILITY").false_positive_guard] : [], "not automatically"), "H30/H50 false-positive guard is weak");
  check(includesText(gateById.get("GATE_SE_LEGAL_ACCESS")?.false_positive_guard ? [gateById.get("GATE_SE_LEGAL_ACCESS").false_positive_guard] : [], "cannot prove"), "legal-access proximity guard is absent");
  check(includesText(gateById.get("GATE_SE_UTILITIES_AND_CAPACITY")?.false_positive_guard ? [gateById.get("GATE_SE_UTILITIES_AND_CAPACITY").false_positive_guard] : [], "cannot prove"), "utility-capacity map guard is absent");

  const alertIds = registry.version_alerts?.map((alert) => alert.alert_id) ?? [];
  check(exactSet(alertIds, ["SE_LM_PROPERTY_PRODUCTS_2026_TRANSITION", "SE_SMHI_MESAN2GV3_TRANSITION", "SE_PBL_2025_974_PROFILE"]), "version alerts are incomplete or unexpected");
  for (const alert of registry.version_alerts ?? []) {
    check(isIsoDate(alert.effective_date), `${alert.alert_id}: effective date is invalid`);
    check(typeof alert.action === "string" && alert.action.length >= 30, `${alert.alert_id}: migration action is absent`);
  }

  check(intake.schema_version === "0.1" && intake.entity_type === "SwedenPlotIntake" && intake.country === "SE", "intake profile identity is wrong");
  const locator = intake.locator ?? {};
  const locatorValues = [locator.municipality, locator.property_designation, locator.address, locator.coordinate_wgs84, locator.listing_url];
  const hasLocator = locatorValues.some((value) => value !== null && value !== "");
  if (locator.coordinate_wgs84 !== null && locator.coordinate_wgs84 !== undefined) {
    const [lon, lat] = locator.coordinate_wgs84;
    check(Array.isArray(locator.coordinate_wgs84) && locator.coordinate_wgs84.length === 2, "intake WGS84 coordinate must be [longitude, latitude]");
    check(Number.isFinite(lon) && lon >= 10 && lon <= 25 && Number.isFinite(lat) && lat >= 54 && lat <= 70, "intake coordinate is outside the Sweden guard or axes are swapped");
  }
  check(!locator.property_designation || Boolean(locator.municipality), "property designation requires municipality context");
  if (intake.ready_for_automated_discovery) {
    check(Boolean(locator.municipality), "automated discovery requires municipality");
    check(Boolean(locator.property_designation || locator.coordinate_wgs84 || locator.address || locator.listing_url), "automated discovery requires a resolvable locator");
  } else if (!hasLocator) {
    check(Array.isArray(intake.blockers) && intake.blockers.length >= 1, "blank intake lacks a locator blocker");
  }
  check(exactSet(intake.project_intent?.house_profiles, ["HOUSEKIT_H30", "HOUSEKIT_H50"]), "starter intake must retain both H30 and H50 comparison profiles");
  check(intake.permissions?.may_request_property_register_extract === false, "starter intake invents permission for a property-register request");
  check(intake.permissions?.may_create_ledningskollen_case === false, "starter intake invents permission for a Ledningskollen case");
  check(intake.permissions?.may_contact_municipality === false, "starter intake invents permission to contact a municipality");
  check(intake.permissions?.may_order_field_work === false, "starter intake invents permission to order field work");

  check(plot.schema_version === "0.1" && plot.entity_type === "SwedenPlotIntelligence", "plot profile identity is wrong");
  check(plot.profile === "SE_NATIONAL_PLOT_INTELLIGENCE_V0_1", "plot profile name is wrong");
  check(plot.country === "SE" && plot.canonical_crs === "EPSG:3006", "plot country or canonical CRS is wrong");
  check(plot.source_registry_ref?.id === registry.registry_id && plot.source_registry_ref?.version === registry.schema_version, "plot registry identity/version binding is wrong");
  check(plot.source_registry_ref?.path === REGISTRY_REL, "plot registry path binding is wrong");
  if (registryOverride === null && registryPath === REGISTRY_REL) {
    check(plot.source_registry_ref?.content_sha256 === digest(registryFile), "plot registry content hash is stale or wrong");
  }
  check(exactSet(plot.project_context?.requested_house_profiles, ["HOUSEKIT_H30", "HOUSEKIT_H50"]), "plot starter profile must retain H30 and H50 comparison");
  check(plot.project_context?.no_site_evidence_override === true, "scenario/project context can override site evidence");
  const plotGateIds = plot.gates?.map((gate) => gate.gate_id) ?? [];
  check(exactSet(plotGateIds, EXPECTED_GATES), "plot gate set is incomplete or unexpected");
  const receiptIds = new Set((plot.source_receipts ?? []).map((receipt) => receipt.receipt_id));
  check(receiptIds.size === (plot.source_receipts?.length ?? 0), "plot source receipt IDs are duplicated");
  for (const receipt of plot.source_receipts ?? []) {
    check(sourceById.has(receipt.source_id), `${receipt.receipt_id}: unknown source ID`);
    check(isIsoDateTime(receipt.retrieved_at), `${receipt.receipt_id}: retrieval time is invalid`);
    check(/^[a-f0-9]{64}$/.test(receipt.sha256), `${receipt.receipt_id}: SHA-256 is invalid`);
    check(/^\.runtime\/sites\/sweden\/[A-Za-z0-9._/-]+$/.test(receipt.runtime_locator) && !receipt.runtime_locator.includes(".."), `${receipt.receipt_id}: unsafe runtime locator`);
  }
  for (const finding of plot.findings ?? []) {
    check(Array.isArray(finding.source_receipt_refs) && finding.source_receipt_refs.length >= 1, `${finding.finding_id}: finding lacks evidence receipts`);
    check(finding.source_receipt_refs?.every((receiptId) => receiptIds.has(receiptId)), `${finding.finding_id}: finding references an unknown receipt`);
    check(isIsoDateTime(finding.observed_at), `${finding.finding_id}: observation time is invalid`);
  }
  for (const gate of plot.gates ?? []) {
    if (gate.status === "SATISFIED") {
      check(Array.isArray(gate.evidence_refs) && gate.evidence_refs.length >= 1, `${gate.gate_id}: satisfied gate lacks evidence`);
      check(isIsoDateTime(gate.decided_at), `${gate.gate_id}: satisfied gate lacks a decision timestamp`);
      check(gate.evidence_refs?.every((ref) => receiptIds.has(ref) || (plot.findings ?? []).some((finding) => finding.finding_id === ref)), `${gate.gate_id}: satisfied gate references unknown evidence`);
    }
    if (gate.status === "OPEN") {
      check(gate.decided_at === null, `${gate.gate_id}: open gate has a decision timestamp`);
    }
  }
  const identity = plot.identity ?? {};
  if (identity.coordinate_wgs84 !== null && identity.coordinate_wgs84 !== undefined) {
    const [lon, lat] = identity.coordinate_wgs84;
    check(Array.isArray(identity.coordinate_wgs84) && identity.coordinate_wgs84.length === 2, "plot coordinate must be [longitude, latitude]");
    check(Number.isFinite(lon) && lon >= 10 && lon <= 25 && Number.isFinite(lat) && lat >= 54 && lat <= 70, "plot coordinate is outside the Sweden guard or axes are swapped");
  }
  if (identity.intake_ready) {
    check(Boolean(identity.municipality && identity.property_designation), "intake-ready plot lacks municipality or property designation");
  }
  if (plot.status !== "INTAKE_REQUIRED") {
    check(identity.intake_ready === true, "promoted plot status lacks resolved intake identity");
    check((plot.source_receipts?.length ?? 0) >= 1, "promoted plot status lacks source receipts");
  } else {
    check(identity.intake_ready === false, "intake-required plot claims ready identity");
    check(plot.site_twin_ref === null, "intake-required plot invents a Site Twin reference");
    check((plot.source_receipts?.length ?? 0) === 0 && (plot.findings?.length ?? 0) === 0, "blank starter plot contains invented evidence");
    check(plot.gates?.every((gate) => gate.status === "OPEN" && gate.evidence_refs.length === 0), "blank starter plot must keep every gate open and unbound");
  }
  const separation = plot.separation_rules ?? {};
  for (const [key, value] of Object.entries(separation)) {
    check(value === true, `separation rule ${key} must remain true`);
  }
  check(Object.keys(separation).length === 6, "separation-rule set is incomplete or unexpected");

  return { ok: errors.length === 0, errors, assertions };
}

function parseCli(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--registry") options.registryPath = argv[++index];
    else if (arg === "--intake") options.intakePath = argv[++index];
    else if (arg === "--plot") options.plotPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function runCli() {
  let options;
  try { options = parseCli(process.argv.slice(2)); }
  catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }
  const result = validateSwedenPlotIntelligence(options);
  if (!result.ok) {
    console.error(`Sweden plot-intelligence validation failed (${result.errors.length} errors, ${result.assertions} assertions):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Sweden plot-intelligence validation passed (${result.assertions} assertions, ${EXPECTED_SOURCE_IDS.length} sources, ${EXPECTED_GATES.length} open gates).`);
}

const mainFile = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (mainFile && fileURLToPath(import.meta.url) === mainFile) runCli();
