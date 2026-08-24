import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PATHS = {
  fixture: "data/neighbourhood-cell/v1/sweden-contract-only-fixture-v1.json",
  compiledPlan: "data/neighbourhood-cell/v1/sweden-contract-only-compiled-plan-v1.json",
  cellSchema: "config/spatial/sweden-neighbourhood-cell-v1.schema.json",
  marketSchema: "config/spatial/munin-property-market-reference-v2.schema.json",
  availability: "data/sites/sweden/saterdalsvagen-14/neighbourhood-cell-availability-v0.1.json",
  availabilitySchema: "config/spatial/sweden-neighbourhood-cell-availability-v1.schema.json",
};

export const EVIDENCE_STATES = ["RECORDED", "LISTED", "INFERRED", "FORECAST"];
export const LAYER_CATEGORIES = ["TERRAIN", "ORTHOPHOTO", "PROPERTY_DIVISION", "BUILDINGS", "ROADS", "VEGETATION", "HYDROGRAPHY", "PLANNING", "ENVIRONMENT", "LIVE_PHOTOREALISTIC_REFERENCE"];
export const MARKET_REFERENCE_TYPES = ["PROPERTY", "PROPERTY_LINEAGE", "ADDRESS", "BUILDING", "UNIT", "BRF", "HISTORIC_SALES", "TRANSACTION_HISTORY", "LISTING_HISTORY", "TAX_ASSESSMENT_HISTORY", "CURRENT_LISTING", "COMPARABLE_SET", "MARKET_INDEX", "VALUATION"];
export const TIMELINE_EVENT_TYPES = ["LISTING_CREATED", "ASKING_PRICE_CHANGED", "LISTING_WITHDRAWN", "LISTING_RELISTED", "BROKER_REPORTED_SALE", "FINAL_BID_REPORTED", "DEED_TRANSFER_RECORDED", "TAX_ASSESSMENT_RECORDED", "PROPERTY_SUBDIVIDED", "PROPERTY_MERGED", "BUILDING_COMPLETED"];
export const ALLOCATION_STATES = ["EXACT_SINGLE_PROPERTY", "MULTI_PROPERTY_UNALLOCATED", "PARENT_PROPERTY_ONLY", "NOT_APPLICABLE"];
export const IDENTITY_ORDER = ["TYPED_ADDRESS", "CANONICAL_ADDRESS_ID", "PROPERTY_ID", "PROPERTY_LINEAGE", "BUILDING_ID", "UNIT_OR_BRF_ID"];
export const FORBIDDEN_OPERATIONS = ["PERSIST_GOOGLE_TILES", "TRACE_OR_EXTRACT_GOOGLE_GEOMETRY", "COPY_MUNIN_MARKET_PAYLOAD", "PROMOTE_PROPOSED_DESIGN_TO_EXISTING_CONDITION", "USE_POSTCODE_AS_GEOMETRY_KEY"];

const readJson = async (root, relativePath) => JSON.parse(await fs.readFile(path.join(root, relativePath), "utf8"));
const canonical = (value) => JSON.stringify(sortDeep(value));
function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortDeep(value[key])]));
}

function makeAudit() {
  const errors = [];
  let assertions = 0;
  const check = (condition, message) => {
    assertions += 1;
    if (!condition) errors.push(message);
  };
  return { errors, check, get assertions() { return assertions; } };
}

function exactKeys(value, expected, label, audit) {
  audit.check(Boolean(value) && typeof value === "object" && !Array.isArray(value), `${label}: expected object`);
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  audit.check(canonical(Object.keys(value).sort()) === canonical([...expected].sort()), `${label}: unknown or missing field`);
}

function forbiddenFactKeys(value, pathLabel = "contract", errors = []) {
  const forbidden = new Set(["price", "asking_price", "sale_price", "purchase_price", "market_value", "valuation_amount", "cost", "owner_name", "buyer_name", "seller_name", "personnummer", "personal_number"]);
  if (Array.isArray(value)) value.forEach((item, index) => forbiddenFactKeys(item, `${pathLabel}[${index}]`, errors));
  else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key.toLowerCase())) errors.push(`${pathLabel}.${key}: local market or personal fact payload is forbidden`);
    forbiddenFactKeys(child, `${pathLabel}.${key}`, errors);
  }
  return errors;
}

export function compileSwedenCellPlan(contract) {
  const persistentLayers = contract.layers.filter((layer) => layer.category !== "LIVE_PHOTOREALISTIC_REFERENCE").map((layer) => layer.layer_id);
  const liveLayers = contract.layers.filter((layer) => layer.category === "LIVE_PHOTOREALISTIC_REFERENCE").map((layer) => layer.layer_id);
  return {
    compiler_version: contract.manifest_version,
    compiler_id: contract.compiler_id,
    country_code: contract.country_code,
    spatial_index: {
      scheme: contract.cell_index.scheme,
      crs: contract.cell_index.native_crs,
      cell_size_m: contract.cell_index.cell_size_m,
      halo_m: contract.cell_index.halo_m,
    },
    execution_phases: [
      { phase: 1, id: "IDENTITY_AND_CELL_RESOLUTION", operations: contract.request_resolution.steps.slice(0, 4) },
      { phase: 2, id: "REUSE_AND_ACQUIRE", operations: contract.request_resolution.steps.slice(4, 6) },
      { phase: 3, id: "SOURCE_BOUND_SPATIAL_COMPILATION", layer_ids: persistentLayers },
      { phase: 4, id: "LIVE_VISUAL_CONTEXT", layer_ids: liveLayers },
      { phase: 5, id: "PROPERTY_AND_PROJECT_OVERLAYS", operations: contract.request_resolution.steps.slice(6) },
      { phase: 6, id: "VERIFICATION", operations: ["VERIFY_SOURCE_LINEAGE", "VERIFY_CELL_STITCHING", "VERIFY_PROPERTY_APPLICABILITY", "KEEP_PROPOSED_DESIGNS_SEPARATE_FROM_CURRENT_WORLD"] },
    ],
    market_interface: {
      version: contract.market_interface.manifest_version,
      mode: contract.market_interface.mode,
      reference_count: contract.market_interface.references.length,
      connector_count: contract.market_interface.connector_routes.length,
    },
    deployment_state: contract.deployment_state,
  };
}

export function validateSwedenCellContract(contract, { schemas = null, committedPlan = null, requireContractOnly = true } = {}) {
  const audit = makeAudit();
  exactKeys(contract, ["manifest_version", "entity_type", "compiler_id", "country_code", "cell_index", "request_resolution", "context_policy", "lod_policy", "layers", "market_interface", "ownership", "forbidden_operations", "dashboard_expansion", "deployment_state"], "contract", audit);
  audit.check(contract.manifest_version === "sweden-neighbourhood-cell/v1", "manifest_version: unsupported Sweden cell contract");
  audit.check(contract.entity_type === "SwedenNeighbourhoodCellCompilerContract", "entity_type: invalid Sweden cell contract");
  audit.check(/^SE_CELL_COMPILER_[A-Z0-9_]+$/.test(contract.compiler_id ?? ""), "compiler_id: invalid");
  audit.check(contract.country_code === "SE", "country_code: Sweden compiler must remain SE");

  const cell = contract.cell_index ?? {};
  exactKeys(cell, ["scheme", "native_crs", "cell_size_m", "halo_m", "cell_id_template", "postcode_role", "boundary_stitching"], "cell_index", audit);
  audit.check(cell.scheme === "NATIVE_PROJECTED_SQUARE" && cell.native_crs === "EPSG:3006", "cell index must use the native SWEREF 99 TM projected grid");
  audit.check(cell.cell_size_m === 1000 && cell.halo_m >= 50 && cell.halo_m <= 250, "cell size or stitching halo changed");
  audit.check(cell.cell_id_template === "SE_EPSG3006_1KM_{EASTING_KM}_{NORTHING_KM}", "cell ID template changed");
  audit.check(cell.postcode_role === "DISCOVERY_ANALYTICS_AND_ROLLOUT_ONLY_NOT_SPATIAL_KEY", "postcode must not become a geometry key");
  audit.check(cell.boundary_stitching === "SOURCE_GEOMETRY_CLIPPED_WITH_HALO_AND_DEDUPED_BY_STABLE_SOURCE_ID", "cell boundary stitching contract changed");

  const resolution = contract.request_resolution ?? {};
  audit.check(resolution.entrypoint === "ADDRESS", "address must remain the request entrypoint");
  audit.check(canonical(resolution.steps) === canonical(["NORMALIZE_ADDRESS", "RESOLVE_CANONICAL_ADDRESS_ID", "RESOLVE_PROPERTY_ID_AND_LINEAGE", "LOCATE_NATIVE_CELLS", "LOAD_AVAILABLE_CELL_VERSIONS", "COMPILE_MISSING_OR_STALE_LAYERS", "BIND_PROPERTY_TWIN_AS_OVERLAY"]), "address-to-cell resolution pipeline changed");
  audit.check(resolution.cache_policy === "REUSE_SOURCE_BOUND_CELL_ARTIFACTS_BY_VERSION_AND_HASH", "source-bound cell reuse policy changed");
  audit.check(resolution.missing_cell_policy === "LIVE_CONTEXT_FIRST_THEN_ASYNC_SOURCE_BOUND_COMPILATION", "missing-cell progressive delivery policy changed");

  const context = contract.context_policy ?? {};
  audit.check(context.selection_method === "STREET_NETWORK_PLUS_VIEW_HORIZON", "context selection must combine streets and view horizon");
  audit.check(Number.isInteger(context.minimum_street_segments) && context.minimum_street_segments >= 10, "context must include at least ten street segments");
  audit.check(canonical(context.urban_radius_m) === canonical([300, 500]) && canonical(context.suburban_radius_m) === canonical([600, 800]) && canonical(context.rural_radius_m) === canonical([1000, 3000]), "adaptive context radii changed");
  audit.check(contract.lod_policy?.camera_continuity === "ONE_GEOREFERENCED_WORLD_ONE_CAMERA", "single-world camera continuity changed");
  audit.check(contract.lod_policy?.levels?.length === 5 && contract.lod_policy.levels.at(-1) === "BUILDING_AND_ROOM_DETAIL", "LOD hierarchy changed");

  const layers = Array.isArray(contract.layers) ? contract.layers : [];
  audit.check(layers.length === LAYER_CATEGORIES.length, "cell must define exactly ten required layers");
  audit.check(new Set(layers.map((layer) => layer.layer_id)).size === layers.length, "duplicate cell layer ID");
  audit.check(canonical(layers.map((layer) => layer.category)) === canonical(LAYER_CATEGORIES), "required cell layer order or category changed");
  for (const layer of layers) {
    audit.check(Array.isArray(layer.blockers) && layer.blockers.length >= 1, `${layer.layer_id ?? "unknown layer"}: source blocker missing`);
    if (requireContractOnly) audit.check(layer.source_artifact_ref === null, `${layer.layer_id}: contract-only fixture must not bind source artifacts`);
  }
  const photorealistic = layers.find((layer) => layer.category === "LIVE_PHOTOREALISTIC_REFERENCE");
  audit.check(photorealistic?.persistence === "LIVE_DISPLAY_ONLY" && photorealistic?.geometry_derivation_allowed === false && photorealistic?.domain_owner === "EXTERNAL_PROVIDER", "Google/live photorealistic context must remain live-only and non-derivative");
  const orthophoto = layers.find((layer) => layer.category === "ORTHOPHOTO");
  audit.check(orthophoto?.persistence === "LIVE_DISPLAY_ONLY" && orthophoto?.geometry_derivation_allowed === false, "current connected orthophoto must remain live-only and non-derivative");

  const market = contract.market_interface ?? {};
  audit.check(market.manifest_version === "munin-property-market-reference/v2" && market.entity_type === "MuninPropertyMarketReferenceInterface", "Munin market interface version or type changed");
  audit.check(market.provider === "MUNIN" && market.consumer === "PLOT_TO_PROJECT_SPATIAL_STUDIO_3" && market.mode === "REFERENCE_ONLY_NO_PAYLOAD", "Munin market ownership or reference-only mode changed");
  audit.check(canonical(market.evidence_states) === canonical(EVIDENCE_STATES), "market interface changed the four evidence states");
  audit.check(canonical(market.supported_reference_types) === canonical(MARKET_REFERENCE_TYPES), "market interface reference types changed");
  audit.check(canonical(market.timeline_event_types) === canonical(TIMELINE_EVENT_TYPES), "property price timeline event vocabulary changed");
  audit.check(canonical(market.transaction_allocation_states) === canonical(ALLOCATION_STATES), "transaction allocation safeguards changed");
  audit.check(canonical(market.identity_resolution_order) === canonical(IDENTITY_ORDER), "property identity and lineage resolution order changed");
  audit.check(Array.isArray(market.connector_routes) && market.connector_routes.length === 6 && new Set(market.connector_routes.map((route) => route.connector_id)).size === 6, "Swedish market connector routes changed");
  for (const route of market.connector_routes ?? []) audit.check(route.personal_data_policy === "NO_PERSONAL_DATA_REQUESTED_OR_PERSISTED", `${route.connector_id}: personal-data policy weakened`);
  const lantmateriet = market.connector_routes?.find((route) => route.connector_id === "SE_MARKET_LANTMATERIET_FASTIGHETSPRIS");
  audit.check(lantmateriet?.role === "OFFICIAL_TRANSACTION" && canonical(lantmateriet?.supported_evidence_states) === canonical(["RECORDED"]), "Lantmäteriet route must remain the official recorded-transaction source");
  const booli = market.connector_routes?.find((route) => route.connector_id === "SE_MARKET_BOOLI");
  const hemnet = market.connector_routes?.find((route) => route.connector_id === "SE_MARKET_HEMNET");
  audit.check([booli, hemnet].every((route) => route?.acquisition_mode === "LIVE_REFERENCE_ONLY" && canonical(route?.supported_evidence_states) === canonical(["LISTED"])), "Booli/Hemnet must remain listing references until partnership access exists");
  audit.check(market.privacy?.person_names === "FORBIDDEN" && market.privacy?.personal_identifiers === "FORBIDDEN" && market.privacy?.protected_records === "EXCLUDE" && market.privacy?.price_payload_location === "MUNIN_ONLY", "market privacy or payload boundary weakened");
  if (requireContractOnly) audit.check(Array.isArray(market.references) && market.references.length === 0, "contract-only fixture must not ingest Swedish market records");
  for (const reference of market.references ?? []) {
    audit.check(reference.payload_persisted === false && reference.personal_data_persisted === false, `${reference.reference_id}: payload persistence is forbidden`);
    audit.check(MARKET_REFERENCE_TYPES.includes(reference.reference_type), `${reference.reference_id}: unsupported market reference type`);
  }

  audit.check(contract.ownership?.neighbourhood_geometry === "PLOT_TO_PROJECT_SPATIAL_STUDIO_3" && contract.ownership?.market_and_price_facts === "MUNIN", "neighbourhood versus market ownership boundary changed");
  audit.check(contract.ownership?.promotion_to_current_world === "VERIFICATION_ONLY" && contract.ownership?.final_acceptance === "VERIFICATION", "project overlay promotion bypasses Verification");
  audit.check(canonical(contract.forbidden_operations) === canonical(FORBIDDEN_OPERATIONS), "forbidden operation set changed");
  audit.check(contract.dashboard_expansion === false, "dashboard expansion is out of scope");
  audit.check(contract.deployment_state === "NOT_DEPLOYED", "deployment is out of scope");
  forbiddenFactKeys(contract).forEach((error) => audit.errors.push(error));

  if (schemas) {
    audit.check(schemas.cellSchema?.$schema === "https://json-schema.org/draft/2020-12/schema" && schemas.cellSchema?.additionalProperties === false, "strict Sweden cell schema missing");
    audit.check(schemas.cellSchema?.properties?.manifest_version?.const === "sweden-neighbourhood-cell/v1", "Sweden cell schema version changed");
    audit.check(schemas.marketSchema?.$schema === "https://json-schema.org/draft/2020-12/schema" && schemas.marketSchema?.additionalProperties === false, "strict Munin market v2 schema missing");
    audit.check(schemas.marketSchema?.properties?.mode?.const === "REFERENCE_ONLY_NO_PAYLOAD", "Munin market schema permits payload persistence");
    audit.check(schemas.cellSchema?.properties?.market_interface?.$ref === "./munin-property-market-reference-v2.schema.json", "Sweden cell schema is not bound to Munin market v2");
  }
  if (committedPlan) audit.check(canonical(compileSwedenCellPlan(contract)) === canonical(committedPlan), "deterministic compiled cell plan differs from committed export");
  return { ok: audit.errors.length === 0, assertions: audit.assertions, errors: audit.errors, plan: compileSwedenCellPlan(contract) };
}

export function validateSvartingeCellAvailability(availability, { schema = null } = {}) {
  const audit = makeAudit();
  exactKeys(availability, ["manifest_version", "entity_type", "availability_id", "compiler_contract_ref", "subject", "selection", "cells", "source_coverage", "compiled_artifacts", "market_reference_ids", "blockers", "deployment_state"], "availability", audit);
  audit.check(availability.manifest_version === "sweden-neighbourhood-cell-availability/v1" && availability.entity_type === "SwedenNeighbourhoodCellAvailability", "availability manifest version or type changed");
  audit.check(availability.compiler_contract_ref === PATHS.fixture, "availability manifest is not pinned to the Sweden cell compiler contract");
  const locator = availability.subject?.locator_epsg3006_easting_northing ?? [];
  audit.check(Math.abs((locator[0] ?? 0) - 559868.9999) < 0.001 && Math.abs((locator[1] ?? 0) - 6501790.311) < 0.001, "Svärtinge projected locator drifted");
  audit.check(availability.subject?.working_property_identity === "SVÄRTINGE 54:28" && availability.subject?.identity_state === "AUTHORITATIVE_LOCATOR_NOT_SURVEY_CONTROL", "Svärtinge working identity or locator limitation changed");
  const selection = availability.selection ?? {};
  audit.check(selection.profile === "SUBURBAN" && selection.context_radius_m === 800 && selection.stitching_halo_m === 100 && selection.selection_radius_m === 900, "Svärtinge suburban cell selection profile changed");
  const expectedBbox = [locator[0] - 900, locator[1] - 900, locator[0] + 900, locator[1] + 900];
  audit.check(canonical(selection.selection_bbox_epsg3006) === canonical(expectedBbox), "Svärtinge cell selection bbox is not derived from locator plus radius and halo");
  const [minE, minN, maxE, maxN] = expectedBbox;
  const expectedCells = [];
  for (let northingKm = Math.floor(minN / 1000); northingKm <= Math.floor(maxN / 1000); northingKm += 1) {
    for (let eastingKm = Math.floor(minE / 1000); eastingKm <= Math.floor(maxE / 1000); eastingKm += 1) expectedCells.push(`SE_EPSG3006_1KM_${eastingKm}_${northingKm}`);
  }
  const cells = availability.cells ?? [];
  audit.check(expectedCells.length === 9 && canonical(cells.map((cell) => cell.cell_id)) === canonical(expectedCells), "Svärtinge must resolve to the deterministic nine-cell coverage set");
  audit.check(new Set(cells.map((cell) => cell.cell_id)).size === cells.length, "Svärtinge availability contains duplicate cell IDs");
  const subjectCellId = `SE_EPSG3006_1KM_${Math.floor(locator[0] / 1000)}_${Math.floor(locator[1] / 1000)}`;
  for (const cell of cells) {
    const expectedCellBbox = [cell.easting_km * 1000, cell.northing_km * 1000, (cell.easting_km + 1) * 1000, (cell.northing_km + 1) * 1000];
    audit.check(cell.cell_id === `SE_EPSG3006_1KM_${cell.easting_km}_${cell.northing_km}` && canonical(cell.bbox_epsg3006) === canonical(expectedCellBbox), `${cell.cell_id}: cell ID or bbox does not match the native grid`);
    audit.check(cell.role === (cell.cell_id === subjectCellId ? "SUBJECT" : "CONTEXT"), `${cell.cell_id}: subject/context role is wrong`);
    audit.check(cell.availability_state === "INDEXED_NOT_COMPILED", `${cell.cell_id}: cell promoted without compiled source artifacts`);
  }
  audit.check(cells.filter((cell) => cell.role === "SUBJECT").length === 1, "Svärtinge availability must contain exactly one subject cell");
  const coverage = availability.source_coverage ?? [];
  audit.check(canonical(coverage.map((item) => item.category)) === canonical(["TERRAIN", "ORTHOPHOTO", "PROPERTY_DIVISION", "BUILDINGS", "ROADS"]), "Svärtinge source coverage set changed");
  audit.check(coverage.find((item) => item.category === "TERRAIN")?.state === "METADATA_ONLY_KEY_REQUIRED", "terrain access gate was closed without bytes");
  audit.check(coverage.find((item) => item.category === "ORTHOPHOTO")?.state === "CONNECTED_LIVE_ONLY", "municipal aerial persistence state changed");
  audit.check(["PROPERTY_DIVISION", "BUILDINGS"].every((category) => coverage.find((item) => item.category === category)?.state === "METADATA_ONLY_KEY_REQUIRED"), "protected official geometry gate was closed without bytes");
  audit.check(coverage.find((item) => item.category === "ROADS")?.state === "DOCUMENTED_NOT_CONNECTED", "road source gate was closed without an exact extract");
  audit.check(Array.isArray(availability.compiled_artifacts) && availability.compiled_artifacts.length === 0, "Svärtinge availability must not fabricate compiled cell artifacts");
  audit.check(Array.isArray(availability.market_reference_ids) && availability.market_reference_ids.length === 0, "Svärtinge availability must not ingest market references");
  audit.check(Array.isArray(availability.blockers) && availability.blockers.length >= 3, "Svärtinge cell blockers are incomplete");
  audit.check(availability.deployment_state === "NOT_DEPLOYED", "Svärtinge cells must not be deployed in this milestone");
  forbiddenFactKeys(availability, "availability").forEach((error) => audit.errors.push(error));
  if (schema) {
    audit.check(schema.$schema === "https://json-schema.org/draft/2020-12/schema" && schema.additionalProperties === false, "strict cell availability schema missing");
    audit.check(schema.properties?.manifest_version?.const === "sweden-neighbourhood-cell-availability/v1", "cell availability schema version changed");
  }
  return { ok: audit.errors.length === 0, assertions: audit.assertions, errors: audit.errors, cells: cells.length };
}

export async function validateSwedenCellCheckpoint({ root = ROOT, overrides = {} } = {}) {
  const fixture = overrides.fixture ?? await readJson(root, PATHS.fixture);
  const compiledPlan = overrides.compiledPlan ?? await readJson(root, PATHS.compiledPlan);
  const cellSchema = overrides.cellSchema ?? await readJson(root, PATHS.cellSchema);
  const marketSchema = overrides.marketSchema ?? await readJson(root, PATHS.marketSchema);
  const availability = overrides.availability ?? await readJson(root, PATHS.availability);
  const availabilitySchema = overrides.availabilitySchema ?? await readJson(root, PATHS.availabilitySchema);
  const contractResult = validateSwedenCellContract(fixture, { schemas: { cellSchema, marketSchema }, committedPlan: compiledPlan, requireContractOnly: true });
  const availabilityResult = validateSvartingeCellAvailability(availability, { schema: availabilitySchema });
  return {
    ok: contractResult.ok && availabilityResult.ok,
    assertions: contractResult.assertions + availabilityResult.assertions,
    errors: [...contractResult.errors, ...availabilityResult.errors],
    plan: contractResult.plan,
    cells: availabilityResult.cells,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateSwedenCellCheckpoint();
  if (!result.ok) {
    console.error(`SWEDEN NEIGHBOURHOOD CELL CONTRACT: FAIL (${result.assertions} assertions)`);
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    console.log(`SWEDEN NEIGHBOURHOOD CELL CONTRACT: PASS (${result.assertions} assertions)`);
    console.log(`Cell layers: ${LAYER_CATEGORIES.length} · Svärtinge cells: ${result.cells} · market connectors: 6 · market records persisted: 0`);
  }
}
