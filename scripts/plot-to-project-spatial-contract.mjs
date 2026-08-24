import crypto from "node:crypto";

export const SPATIAL_BUNDLE_VERSION = "plot-to-project-spatial/v1";
export const MUNIN_INTERFACE_VERSION = "munin-external-reference/v1";
export const SPATIAL_GRAPH_VERSION = "plot-to-project-spatial-graph/v1";

export const EVIDENCE_STATES = Object.freeze(["RECORDED", "LISTED", "INFERRED", "FORECAST"]);
export const MUNIN_REFERENCE_TYPES = Object.freeze(["PROPERTY", "BUILDING", "UNIT", "BRF", "HISTORIC_SALES", "CURRENT_LISTING", "COMPARABLE_SET"]);
export const EXISTING_PROPERTY_MODES = Object.freeze(["AS_IS", "COSMETIC_RENOVATION", "FULL_RENOVATION", "RECONFIGURATION", "ENERGY_RETROFIT", "EXTENSION"]);

const EVIDENCE_STATE_SET = new Set(EVIDENCE_STATES);
const REFERENCE_TYPE_SET = new Set(MUNIN_REFERENCE_TYPES);
const SCENARIO_MODE_SET = new Set(EXISTING_PROPERTY_MODES);
const LIFECYCLE_STATES = new Set(["UNBOUND", "REFERENCE_ONLY", "SPATIAL_BASIS", "VERIFIED"]);
const FACT_DOMAINS = new Set(["PROPERTY_IDENTITY", "BUILDING_IDENTITY", "UNIT_IDENTITY", "BRF_IDENTITY", "HISTORIC_SALES", "CURRENT_LISTING", "COMPARABLE_SET", "MARKET_VALUE", "COST", "OWNERSHIP"]);
const APPLICABILITY_STATES = new Set(["UNASSESSED", "APPLIES", "DOES_NOT_APPLY", "PARTIAL"]);
const SCENARIO_STATUSES = new Set(["BLOCKED_NO_EXISTING_PROPERTY_EVIDENCE", "DRAFT_SPATIAL_ONLY", "READY_FOR_VERIFICATION", "VERIFIED"]);
const TRANSFORMATION_OPERATIONS = new Set(["KEEP", "REMOVE", "ADD", "MOVE", "REPLACE", "RECONFIGURE", "RETROFIT_ENVELOPE", "EXTEND"]);
const FORBIDDEN_FACT_KEYS = new Set([
  "market_value",
  "valuation_amount",
  "estimated_value",
  "asking_price",
  "listing_price",
  "sale_price",
  "purchase_price",
  "price",
  "cost",
  "cost_value",
  "renovation_cost",
  "construction_cost",
  "owner_name",
  "owner_id",
  "ownership_fact",
  "ownership_share",
]);

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isSha256 = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const isIsoDateTime = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value);

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
}

export function canonicalJson(value) {
  return `${JSON.stringify(sorted(value), null, 2)}\n`;
}

export function canonicalSha256(value) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function makeContext() {
  const errors = [];
  let assertions = 0;
  const check = (condition, message) => {
    assertions += 1;
    if (!condition) errors.push(message);
  };
  const strict = (value, fields, path) => {
    check(isObject(value), `${path}: expected object`);
    if (!isObject(value)) return false;
    for (const key of Object.keys(value)) check(fields.includes(key), `${path}.${key}: unknown field`);
    for (const key of fields) check(Object.hasOwn(value, key), `${path}.${key}: required field is missing`);
    return true;
  };
  return { errors, check, strict, get assertions() { return assertions; } };
}

function sameArray(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && actual.every((item, index) => item === expected[index]);
}

function validateUniqueStrings(values, path, context) {
  context.check(Array.isArray(values), `${path}: expected array`);
  if (!Array.isArray(values)) return [];
  context.check(values.every((value) => typeof value === "string" && value.length > 0), `${path}: expected non-empty string IDs`);
  context.check(new Set(values).size === values.length, `${path}: duplicate IDs`);
  return values;
}

function validateVector(value, length, path, context) {
  context.check(Array.isArray(value) && value.length === length, `${path}: expected ${length}-number vector`);
  if (Array.isArray(value)) value.forEach((component, index) => context.check(isFiniteNumber(component), `${path}[${index}]: expected finite number`));
}

function validateImmutableRef(ref, path, context) {
  if (!context.strict(ref, ["id", "version", "path", "content_sha256", "binding_state"], path)) return;
  context.check(typeof ref.id === "string" && ref.id.length >= 3, `${path}.id: invalid`);
  context.check(new Set(["UNBOUND", "BOUND"]).has(ref.binding_state), `${path}.binding_state: invalid`);
  if (ref.binding_state === "UNBOUND") {
    context.check(ref.version === null && ref.path === null && ref.content_sha256 === null, `${path}: UNBOUND reference cannot contain version, path or hash`);
  } else if (ref.binding_state === "BOUND") {
    context.check(typeof ref.version === "string" && ref.version.length > 0, `${path}.version: required for BOUND reference`);
    context.check(typeof ref.path === "string" && ref.path.length > 0, `${path}.path: required for BOUND reference`);
    context.check(isSha256(ref.content_sha256), `${path}.content_sha256: invalid for BOUND reference`);
  }
}

function validateFrame(frame, path, expectedParentFrameId, context) {
  if (!context.strict(frame, ["frame_id", "parent_frame_id", "crs", "linear_units", "transform_to_parent", "evidence_state", "evidence_refs"], path)) return;
  context.check(typeof frame.frame_id === "string" && frame.frame_id.length > 0, `${path}.frame_id: invalid`);
  context.check(frame.parent_frame_id === expectedParentFrameId, `${path}.parent_frame_id: expected ${expectedParentFrameId}`);
  context.check(frame.crs === null || (typeof frame.crs === "string" && frame.crs.length > 0), `${path}.crs: invalid`);
  context.check(frame.linear_units === "m", `${path}.linear_units: only metres are supported`);
  validateUniqueStrings(frame.evidence_refs, `${path}.evidence_refs`, context);
  if (frame.transform_to_parent === null) {
    context.check(frame.evidence_state === null, `${path}: absent transform cannot claim an evidence state`);
    context.check(frame.evidence_refs.length === 0, `${path}: absent transform cannot retain evidence refs`);
    return;
  }
  if (!context.strict(frame.transform_to_parent, ["translation_m", "rotation_quaternion_xyzw", "scale_xyz"], `${path}.transform_to_parent`)) return;
  validateVector(frame.transform_to_parent.translation_m, 3, `${path}.transform_to_parent.translation_m`, context);
  validateVector(frame.transform_to_parent.rotation_quaternion_xyzw, 4, `${path}.transform_to_parent.rotation_quaternion_xyzw`, context);
  validateVector(frame.transform_to_parent.scale_xyz, 3, `${path}.transform_to_parent.scale_xyz`, context);
  context.check(frame.transform_to_parent.scale_xyz?.every((value) => value === 1), `${path}.transform_to_parent.scale_xyz: non-unit scaling is unsupported`);
  const q = frame.transform_to_parent.rotation_quaternion_xyzw;
  if (Array.isArray(q) && q.every(isFiniteNumber)) context.check(Math.abs(Math.hypot(...q) - 1) <= 1e-9, `${path}.transform_to_parent.rotation_quaternion_xyzw: quaternion must be normalized`);
  context.check(EVIDENCE_STATE_SET.has(frame.evidence_state), `${path}.evidence_state: populated transform requires one of the four evidence states`);
  context.check(frame.evidence_refs.length > 0, `${path}.evidence_refs: populated transform requires external evidence`);
}

function validateGeometry(geometry, path, context) {
  if (!context.strict(geometry, ["status", "geometry_kind", "uri", "content_sha256", "crs", "linear_units", "bounds", "evidence_state", "evidence_refs"], path)) return;
  context.check(new Set(["ABSENT", "AVAILABLE"]).has(geometry.status), `${path}.status: invalid`);
  context.check(typeof geometry.geometry_kind === "string" && geometry.geometry_kind.length > 0, `${path}.geometry_kind: required`);
  context.check(geometry.linear_units === "m", `${path}.linear_units: only metres are supported`);
  validateUniqueStrings(geometry.evidence_refs, `${path}.evidence_refs`, context);
  if (geometry.status === "ABSENT") {
    context.check(geometry.uri === null && geometry.content_sha256 === null && geometry.crs === null && geometry.bounds === null && geometry.evidence_state === null, `${path}: ABSENT geometry must keep URI, hash, CRS, bounds and evidence state null`);
    context.check(geometry.evidence_refs.length === 0, `${path}: ABSENT geometry cannot retain evidence refs`);
    return;
  }
  context.check(typeof geometry.uri === "string" && geometry.uri.length > 0, `${path}.uri: AVAILABLE geometry requires a URI`);
  context.check(isSha256(geometry.content_sha256), `${path}.content_sha256: AVAILABLE geometry requires SHA-256`);
  context.check(typeof geometry.crs === "string" && geometry.crs.length > 0, `${path}.crs: AVAILABLE geometry requires CRS`);
  context.check(EVIDENCE_STATE_SET.has(geometry.evidence_state), `${path}.evidence_state: AVAILABLE geometry requires one of the four evidence states`);
  context.check(geometry.evidence_refs.length > 0, `${path}.evidence_refs: AVAILABLE geometry requires external evidence`);
  if (context.strict(geometry.bounds, ["min", "max"], `${path}.bounds`)) {
    validateVector(geometry.bounds.min, 3, `${path}.bounds.min`, context);
    validateVector(geometry.bounds.max, 3, `${path}.bounds.max`, context);
    if (Array.isArray(geometry.bounds.min) && Array.isArray(geometry.bounds.max)) context.check(geometry.bounds.min.every((value, index) => value < geometry.bounds.max[index]), `${path}.bounds: min must be lower than max on all axes`);
  }
}

function validateMuninInterface(value, context) {
  const path = "munin_interface";
  if (!context.strict(value, ["manifest_version", "entity_type", "interface_id", "provider", "consumer", "mode", "evidence_states", "supported_reference_types", "references", "ownership"], path)) return new Map();
  context.check(value.manifest_version === MUNIN_INTERFACE_VERSION, `${path}.manifest_version: unsupported`);
  context.check(value.entity_type === "MuninExternalReferenceInterface", `${path}.entity_type: invalid`);
  context.check(/^MUNIN_IF_[A-Z0-9_]+$/.test(value.interface_id ?? ""), `${path}.interface_id: invalid`);
  context.check(value.provider === "MUNIN", `${path}.provider: must remain MUNIN`);
  context.check(value.consumer === "PLOT_TO_PROJECT_SPATIAL_STUDIO_3", `${path}.consumer: invalid`);
  context.check(value.mode === "REFERENCE_ONLY_NO_PAYLOAD", `${path}.mode: payload persistence is forbidden`);
  context.check(sameArray(value.evidence_states, EVIDENCE_STATES), `${path}.evidence_states: exact four-state vocabulary and order required`);
  context.check(sameArray(value.supported_reference_types, MUNIN_REFERENCE_TYPES), `${path}.supported_reference_types: required reference interface changed`);
  context.check(Array.isArray(value.references), `${path}.references: expected array`);
  const references = new Map();
  for (const [index, ref] of (value.references ?? []).entries()) {
    const refPath = `${path}.references[${index}]`;
    if (!context.strict(ref, ["reference_id", "reference_type", "external_id", "record_version", "canonical_uri", "content_sha256", "evidence_state", "observed_at", "source_system", "payload_persisted"], refPath)) continue;
    context.check(/^MREF_[A-Z0-9_]+$/.test(ref.reference_id ?? ""), `${refPath}.reference_id: invalid`);
    context.check(!references.has(ref.reference_id), `${refPath}.reference_id: duplicate`);
    context.check(REFERENCE_TYPE_SET.has(ref.reference_type), `${refPath}.reference_type: invalid`);
    context.check(typeof ref.external_id === "string" && ref.external_id.length > 0, `${refPath}.external_id: required`);
    context.check(typeof ref.record_version === "string" && ref.record_version.length > 0, `${refPath}.record_version: required`);
    context.check(ref.canonical_uri === null || (typeof ref.canonical_uri === "string" && ref.canonical_uri.length > 0), `${refPath}.canonical_uri: invalid`);
    context.check(ref.content_sha256 === null || isSha256(ref.content_sha256), `${refPath}.content_sha256: invalid`);
    context.check(EVIDENCE_STATE_SET.has(ref.evidence_state), `${refPath}.evidence_state: invalid`);
    context.check(isIsoDateTime(ref.observed_at), `${refPath}.observed_at: invalid`);
    context.check(ref.source_system === "MUNIN", `${refPath}.source_system: external facts must remain Munin-owned`);
    context.check(ref.payload_persisted === false, `${refPath}.payload_persisted: market payload persistence is forbidden`);
    references.set(ref.reference_id, ref);
  }
  if (context.strict(value.ownership, ["identity_and_market_facts", "spatial_applicability", "transformation_geometry", "final_acceptance"], `${path}.ownership`)) {
    context.check(value.ownership.identity_and_market_facts === "MUNIN", `${path}.ownership.identity_and_market_facts: invalid`);
    context.check(value.ownership.spatial_applicability === "PLOT_TO_PROJECT_SPATIAL_STUDIO_3", `${path}.ownership.spatial_applicability: invalid`);
    context.check(value.ownership.transformation_geometry === "PLOT_TO_PROJECT_SPATIAL_STUDIO_3", `${path}.ownership.transformation_geometry: invalid`);
    context.check(value.ownership.final_acceptance === "VERIFICATION", `${path}.ownership.final_acceptance: invalid`);
  }
  return references;
}

function validateExternalBinding(binding, path, knownMuninRefs, knownSpatialTargets, context) {
  if (!context.strict(binding, ["binding_id", "fact_domain", "munin_reference_id", "spatial_target_ref", "applicability", "method"], path)) return;
  context.check(typeof binding.binding_id === "string" && binding.binding_id.length > 0, `${path}.binding_id: invalid`);
  context.check(FACT_DOMAINS.has(binding.fact_domain), `${path}.fact_domain: invalid`);
  context.check(knownMuninRefs.has(binding.munin_reference_id), `${path}.munin_reference_id: unresolved external reference`);
  const identityTypeByDomain = {
    PROPERTY_IDENTITY: "PROPERTY",
    BUILDING_IDENTITY: "BUILDING",
    UNIT_IDENTITY: "UNIT",
    BRF_IDENTITY: "BRF",
    HISTORIC_SALES: "HISTORIC_SALES",
    CURRENT_LISTING: "CURRENT_LISTING",
    COMPARABLE_SET: "COMPARABLE_SET",
  };
  if (identityTypeByDomain[binding.fact_domain]) context.check(knownMuninRefs.get(binding.munin_reference_id)?.reference_type === identityTypeByDomain[binding.fact_domain], `${path}: fact domain does not match Munin reference type`);
  context.check(knownSpatialTargets.has(binding.spatial_target_ref), `${path}.spatial_target_ref: unresolved spatial target`);
  context.check(binding.method === "SPATIAL_APPLICABILITY_ONLY_NO_FACT_VALUE", `${path}.method: Spatial Studio may store applicability only`);
  const applicabilityPath = `${path}.applicability`;
  if (!context.strict(binding.applicability, ["status", "geometry_ref", "evidence_state", "evidence_refs", "decided_at", "rationale"], applicabilityPath)) return;
  const applicability = binding.applicability;
  context.check(APPLICABILITY_STATES.has(applicability.status), `${applicabilityPath}.status: invalid`);
  validateUniqueStrings(applicability.evidence_refs, `${applicabilityPath}.evidence_refs`, context);
  if (applicability.status === "UNASSESSED") {
    context.check(applicability.geometry_ref === null && applicability.evidence_state === null && applicability.evidence_refs.length === 0 && applicability.decided_at === null, `${applicabilityPath}: UNASSESSED applicability cannot claim geometry, evidence or a decision time`);
  } else {
    context.check(EVIDENCE_STATE_SET.has(applicability.evidence_state), `${applicabilityPath}.evidence_state: assessed applicability requires one of the four evidence states`);
    context.check(applicability.evidence_refs.length > 0, `${applicabilityPath}.evidence_refs: assessed applicability requires evidence`);
    context.check(isIsoDateTime(applicability.decided_at), `${applicabilityPath}.decided_at: assessed applicability requires a decision time`);
    context.check(typeof applicability.rationale === "string" && applicability.rationale.length > 0, `${applicabilityPath}.rationale: assessed applicability requires rationale`);
    if (applicability.status === "PARTIAL") context.check(typeof applicability.geometry_ref === "string" && applicability.geometry_ref.length > 0, `${applicabilityPath}.geometry_ref: PARTIAL applicability requires geometry`);
  }
}

function validateExternalRefs(entity, path, knownMuninRefs, knownSpatialTargets, context) {
  validateUniqueStrings(entity.munin_reference_ids, `${path}.munin_reference_ids`, context);
  for (const referenceId of entity.munin_reference_ids ?? []) context.check(knownMuninRefs.has(referenceId), `${path}.munin_reference_ids: unresolved ${referenceId}`);
  context.check(Array.isArray(entity.external_evidence_refs), `${path}.external_evidence_refs: expected array`);
  for (const [index, binding] of (entity.external_evidence_refs ?? []).entries()) validateExternalBinding(binding, `${path}.external_evidence_refs[${index}]`, knownMuninRefs, knownSpatialTargets, context);
}

function validateBlockers(blockers, path, context) {
  validateUniqueStrings(blockers, path, context);
}

function validateEntityHeader(entity, path, expected, context) {
  context.check(entity.manifest_version === expected.version, `${path}.manifest_version: expected ${expected.version}`);
  context.check(entity.entity_type === expected.type, `${path}.entity_type: expected ${expected.type}`);
  context.check(expected.idPattern.test(entity[expected.idField] ?? ""), `${path}.${expected.idField}: invalid`);
  context.check(/^\d+\.\d+$/.test(entity.version ?? ""), `${path}.version: expected major.minor`);
  context.check(LIFECYCLE_STATES.has(entity.lifecycle_state), `${path}.lifecycle_state: invalid`);
}

function findForbiddenFactKeys(value, path = "manifest", hits = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenFactKeys(item, `${path}[${index}]`, hits));
    return hits;
  }
  if (!isObject(value)) return hits;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_FACT_KEYS.has(key.toLowerCase())) hits.push(`${path}.${key}`);
    findForbiddenFactKeys(child, `${path}.${key}`, hits);
  }
  return hits;
}

function collectSpatialTargets(bundle) {
  return new Set([
    bundle.site_twin_ref?.id,
    ...(bundle.neighbourhood_twins ?? []).map((item) => item.neighbourhood_twin_id),
    ...(bundle.building_twins ?? []).map((item) => item.building_twin_id),
    ...(bundle.unit_twins ?? []).map((item) => item.unit_twin_id),
    ...(bundle.existing_condition_twins ?? []).map((item) => item.existing_condition_twin_id),
    ...(bundle.space_twins ?? []).map((item) => item.space_twin_id),
    ...(bundle.design_scenarios ?? []).map((item) => item.scenario_id),
  ].filter(Boolean));
}

function collectSpatialTargetList(bundle) {
  return [
    bundle.site_twin_ref?.id,
    ...(bundle.neighbourhood_twins ?? []).map((item) => item.neighbourhood_twin_id),
    ...(bundle.building_twins ?? []).map((item) => item.building_twin_id),
    ...(bundle.unit_twins ?? []).map((item) => item.unit_twin_id),
    ...(bundle.existing_condition_twins ?? []).map((item) => item.existing_condition_twin_id),
    ...(bundle.space_twins ?? []).map((item) => item.space_twin_id),
    ...(bundle.design_scenarios ?? []).map((item) => item.scenario_id),
  ].filter(Boolean);
}

export function validateSpatialBundle(bundle) {
  const context = makeContext();
  const topFields = ["manifest_version", "entity_type", "project_id", "site_twin_ref", "munin_interface", "neighbourhood_twins", "building_twins", "unit_twins", "existing_condition_twins", "space_twins", "design_scenarios", "ownership_boundary", "forbidden_local_fact_domains", "dashboard_expansion", "deployment_state"];
  if (!context.strict(bundle, topFields, "manifest")) return { ok: false, assertions: context.assertions, errors: context.errors };
  context.check(bundle.manifest_version === SPATIAL_BUNDLE_VERSION, "manifest.manifest_version: unsupported");
  context.check(bundle.entity_type === "PlotToProjectSpatialBundle", "manifest.entity_type: invalid");
  context.check(/^PRJ_[A-Z0-9_]+$/.test(bundle.project_id ?? ""), "manifest.project_id: invalid");
  validateImmutableRef(bundle.site_twin_ref, "manifest.site_twin_ref", context);
  const knownMuninRefs = validateMuninInterface(bundle.munin_interface, context);
  const knownSpatialTargets = collectSpatialTargets(bundle);
  const allEntityIds = collectSpatialTargetList(bundle);
  context.check(new Set(allEntityIds).size === allEntityIds.length, "manifest: duplicate IDs across the spatial hierarchy");

  for (const forbiddenPath of findForbiddenFactKeys(bundle)) context.check(false, `${forbiddenPath}: local market value, cost or ownership fact is forbidden; use a Munin external evidence reference`);

  const neighbourhoodById = new Map();
  context.check(Array.isArray(bundle.neighbourhood_twins), "manifest.neighbourhood_twins: expected array");
  for (const [index, entity] of (bundle.neighbourhood_twins ?? []).entries()) {
    const path = `manifest.neighbourhood_twins[${index}]`;
    if (!context.strict(entity, ["manifest_version", "entity_type", "neighbourhood_twin_id", "version", "lifecycle_state", "site_twin_ref", "frame", "context_geometry", "munin_reference_ids", "external_evidence_refs", "blockers"], path)) continue;
    validateEntityHeader(entity, path, { version: "neighbourhood-twin/v1", type: "NeighbourhoodTwin", idField: "neighbourhood_twin_id", idPattern: /^NEIGH_[A-Z0-9_]+$/ }, context);
    context.check(!neighbourhoodById.has(entity.neighbourhood_twin_id), `${path}.neighbourhood_twin_id: duplicate`);
    neighbourhoodById.set(entity.neighbourhood_twin_id, entity);
    validateImmutableRef(entity.site_twin_ref, `${path}.site_twin_ref`, context);
    context.check(entity.site_twin_ref.id === bundle.site_twin_ref.id, `${path}.site_twin_ref.id: hierarchy does not match root Site Twin`);
    context.check(canonicalJson(entity.site_twin_ref) === canonicalJson(bundle.site_twin_ref), `${path}.site_twin_ref: immutable Site Twin binding drift`);
    validateFrame(entity.frame, `${path}.frame`, bundle.site_twin_ref.id, context);
    validateGeometry(entity.context_geometry, `${path}.context_geometry`, context);
    validateExternalRefs(entity, path, knownMuninRefs, knownSpatialTargets, context);
    validateBlockers(entity.blockers, `${path}.blockers`, context);
  }

  const buildingById = new Map();
  context.check(Array.isArray(bundle.building_twins), "manifest.building_twins: expected array");
  for (const [index, entity] of (bundle.building_twins ?? []).entries()) {
    const path = `manifest.building_twins[${index}]`;
    if (!context.strict(entity, ["manifest_version", "entity_type", "building_twin_id", "version", "lifecycle_state", "neighbourhood_twin_id", "frame", "envelope_geometry", "level_geometry_refs", "munin_reference_ids", "external_evidence_refs", "blockers"], path)) continue;
    validateEntityHeader(entity, path, { version: "building-twin/v1", type: "BuildingTwin", idField: "building_twin_id", idPattern: /^BLDG_[A-Z0-9_]+$/ }, context);
    context.check(!buildingById.has(entity.building_twin_id), `${path}.building_twin_id: duplicate`);
    buildingById.set(entity.building_twin_id, entity);
    const parent = neighbourhoodById.get(entity.neighbourhood_twin_id);
    context.check(Boolean(parent), `${path}.neighbourhood_twin_id: unresolved parent`);
    validateFrame(entity.frame, `${path}.frame`, parent?.frame?.frame_id, context);
    validateGeometry(entity.envelope_geometry, `${path}.envelope_geometry`, context);
    validateUniqueStrings(entity.level_geometry_refs, `${path}.level_geometry_refs`, context);
    validateExternalRefs(entity, path, knownMuninRefs, knownSpatialTargets, context);
    validateBlockers(entity.blockers, `${path}.blockers`, context);
  }

  const unitById = new Map();
  context.check(Array.isArray(bundle.unit_twins), "manifest.unit_twins: expected array");
  for (const [index, entity] of (bundle.unit_twins ?? []).entries()) {
    const path = `manifest.unit_twins[${index}]`;
    if (!context.strict(entity, ["manifest_version", "entity_type", "unit_twin_id", "version", "lifecycle_state", "building_twin_id", "frame", "unit_geometry", "existing_condition_twin_ids", "munin_reference_ids", "external_evidence_refs", "blockers"], path)) continue;
    validateEntityHeader(entity, path, { version: "unit-twin/v1", type: "UnitTwin", idField: "unit_twin_id", idPattern: /^UNIT_[A-Z0-9_]+$/ }, context);
    context.check(!unitById.has(entity.unit_twin_id), `${path}.unit_twin_id: duplicate`);
    unitById.set(entity.unit_twin_id, entity);
    const parent = buildingById.get(entity.building_twin_id);
    context.check(Boolean(parent), `${path}.building_twin_id: unresolved parent`);
    validateFrame(entity.frame, `${path}.frame`, parent?.frame?.frame_id, context);
    validateGeometry(entity.unit_geometry, `${path}.unit_geometry`, context);
    validateUniqueStrings(entity.existing_condition_twin_ids, `${path}.existing_condition_twin_ids`, context);
    validateExternalRefs(entity, path, knownMuninRefs, knownSpatialTargets, context);
    validateBlockers(entity.blockers, `${path}.blockers`, context);
  }

  const conditionById = new Map();
  context.check(Array.isArray(bundle.existing_condition_twins), "manifest.existing_condition_twins: expected array");
  for (const [index, entity] of (bundle.existing_condition_twins ?? []).entries()) {
    const path = `manifest.existing_condition_twins[${index}]`;
    if (!context.strict(entity, ["manifest_version", "entity_type", "existing_condition_twin_id", "version", "lifecycle_state", "unit_twin_id", "observation_date", "frame", "condition_geometry", "element_observations", "space_twin_ids", "munin_reference_ids", "external_evidence_refs", "blockers"], path)) continue;
    validateEntityHeader(entity, path, { version: "existing-condition-twin/v1", type: "ExistingConditionTwin", idField: "existing_condition_twin_id", idPattern: /^ECOND_[A-Z0-9_]+$/ }, context);
    context.check(!conditionById.has(entity.existing_condition_twin_id), `${path}.existing_condition_twin_id: duplicate`);
    conditionById.set(entity.existing_condition_twin_id, entity);
    const parent = unitById.get(entity.unit_twin_id);
    context.check(Boolean(parent), `${path}.unit_twin_id: unresolved parent`);
    context.check(parent?.existing_condition_twin_ids?.includes(entity.existing_condition_twin_id), `${path}: Unit Twin does not list this Existing Condition Twin`);
    context.check(entity.observation_date === null || /^\d{4}-\d{2}-\d{2}$/.test(entity.observation_date), `${path}.observation_date: invalid`);
    if (entity.lifecycle_state === "UNBOUND") context.check(entity.observation_date === null, `${path}.observation_date: UNBOUND condition cannot claim an observation date`);
    validateFrame(entity.frame, `${path}.frame`, parent?.frame?.frame_id, context);
    validateGeometry(entity.condition_geometry, `${path}.condition_geometry`, context);
    context.check(Array.isArray(entity.element_observations), `${path}.element_observations: expected array`);
    for (const [observationIndex, observation] of (entity.element_observations ?? []).entries()) {
      const observationPath = `${path}.element_observations[${observationIndex}]`;
      if (!context.strict(observation, ["observation_id", "spatial_element_ref", "condition_code", "geometry_ref", "evidence_state", "evidence_refs"], observationPath)) continue;
      context.check(typeof observation.observation_id === "string" && observation.observation_id.length > 0, `${observationPath}.observation_id: required`);
      context.check(typeof observation.spatial_element_ref === "string" && observation.spatial_element_ref.length > 0, `${observationPath}.spatial_element_ref: required`);
      context.check(typeof observation.condition_code === "string" && observation.condition_code.length > 0, `${observationPath}.condition_code: required`);
      context.check(observation.geometry_ref === null || typeof observation.geometry_ref === "string", `${observationPath}.geometry_ref: invalid`);
      context.check(EVIDENCE_STATE_SET.has(observation.evidence_state), `${observationPath}.evidence_state: invalid`);
      validateUniqueStrings(observation.evidence_refs, `${observationPath}.evidence_refs`, context);
      context.check(observation.evidence_refs.length > 0, `${observationPath}.evidence_refs: condition observation requires evidence`);
    }
    validateUniqueStrings(entity.space_twin_ids, `${path}.space_twin_ids`, context);
    validateExternalRefs(entity, path, knownMuninRefs, knownSpatialTargets, context);
    validateBlockers(entity.blockers, `${path}.blockers`, context);
  }

  const spaceById = new Map();
  context.check(Array.isArray(bundle.space_twins), "manifest.space_twins: expected array");
  for (const [index, entity] of (bundle.space_twins ?? []).entries()) {
    const path = `manifest.space_twins[${index}]`;
    if (!context.strict(entity, ["manifest_version", "entity_type", "space_twin_id", "version", "lifecycle_state", "existing_condition_twin_id", "space_type", "intended_use", "frame", "space_geometry", "room_twin_ref", "semantic_anchor_refs", "munin_reference_ids", "external_evidence_refs", "blockers"], path)) continue;
    validateEntityHeader(entity, path, { version: "space-twin/v1", type: "SpaceTwin", idField: "space_twin_id", idPattern: /^SPACE_[A-Z0-9_]+$/ }, context);
    context.check(!spaceById.has(entity.space_twin_id), `${path}.space_twin_id: duplicate`);
    spaceById.set(entity.space_twin_id, entity);
    const parent = conditionById.get(entity.existing_condition_twin_id);
    context.check(Boolean(parent), `${path}.existing_condition_twin_id: unresolved parent`);
    context.check(parent?.space_twin_ids?.includes(entity.space_twin_id), `${path}: Existing Condition Twin does not list this Space Twin`);
    context.check(typeof entity.space_type === "string" && entity.space_type.length > 0, `${path}.space_type: required`);
    context.check(typeof entity.intended_use === "string" && entity.intended_use.length > 0, `${path}.intended_use: required`);
    validateFrame(entity.frame, `${path}.frame`, parent?.frame?.frame_id, context);
    validateGeometry(entity.space_geometry, `${path}.space_geometry`, context);
    validateImmutableRef(entity.room_twin_ref, `${path}.room_twin_ref`, context);
    validateUniqueStrings(entity.semantic_anchor_refs, `${path}.semantic_anchor_refs`, context);
    validateExternalRefs(entity, path, knownMuninRefs, knownSpatialTargets, context);
    validateBlockers(entity.blockers, `${path}.blockers`, context);
  }

  const scenarioIds = new Set();
  context.check(Array.isArray(bundle.design_scenarios), "manifest.design_scenarios: expected array");
  for (const [index, scenario] of (bundle.design_scenarios ?? []).entries()) {
    const path = `manifest.design_scenarios[${index}]`;
    if (!context.strict(scenario, ["manifest_version", "entity_type", "scenario_id", "project_id", "site_twin_id", "existing_condition_twin_id", "mode", "status", "scope_refs", "transformation_operations", "external_evidence_refs", "blockers"], path)) continue;
    context.check(scenario.manifest_version === "existing-property-design-scenario/v1", `${path}.manifest_version: unsupported`);
    context.check(scenario.entity_type === "ExistingPropertyDesignScenario", `${path}.entity_type: invalid`);
    context.check(/^SCN_[A-Z0-9_]+$/.test(scenario.scenario_id ?? ""), `${path}.scenario_id: invalid`);
    context.check(!scenarioIds.has(scenario.scenario_id), `${path}.scenario_id: duplicate`);
    scenarioIds.add(scenario.scenario_id);
    context.check(scenario.project_id === bundle.project_id, `${path}.project_id: does not match bundle`);
    context.check(scenario.site_twin_id === bundle.site_twin_ref.id, `${path}.site_twin_id: does not match Site Twin`);
    context.check(conditionById.has(scenario.existing_condition_twin_id), `${path}.existing_condition_twin_id: unresolved baseline`);
    context.check(SCENARIO_MODE_SET.has(scenario.mode), `${path}.mode: invalid existing-property mode`);
    context.check(SCENARIO_STATUSES.has(scenario.status), `${path}.status: invalid`);
    validateUniqueStrings(scenario.scope_refs, `${path}.scope_refs`, context);
    for (const scopeRef of scenario.scope_refs ?? []) context.check(knownSpatialTargets.has(scopeRef), `${path}.scope_refs: unresolved ${scopeRef}`);
    context.check(Array.isArray(scenario.transformation_operations), `${path}.transformation_operations: expected array`);
    if (scenario.mode === "AS_IS") context.check((scenario.transformation_operations ?? []).length === 0, `${path}: AS_IS cannot contain transformation operations`);
    for (const [operationIndex, operation] of (scenario.transformation_operations ?? []).entries()) {
      const operationPath = `${path}.transformation_operations[${operationIndex}]`;
      if (!context.strict(operation, ["operation_id", "operation_type", "target_twin_id", "source_geometry_ref", "result_geometry", "evidence_state", "evidence_refs"], operationPath)) continue;
      context.check(typeof operation.operation_id === "string" && operation.operation_id.length > 0, `${operationPath}.operation_id: required`);
      context.check(TRANSFORMATION_OPERATIONS.has(operation.operation_type), `${operationPath}.operation_type: invalid`);
      context.check(knownSpatialTargets.has(operation.target_twin_id), `${operationPath}.target_twin_id: unresolved`);
      context.check(operation.source_geometry_ref === null || typeof operation.source_geometry_ref === "string", `${operationPath}.source_geometry_ref: invalid`);
      validateGeometry(operation.result_geometry, `${operationPath}.result_geometry`, context);
      context.check(operation.result_geometry?.status === "AVAILABLE", `${operationPath}.result_geometry: transformation requires deterministic output geometry`);
      context.check(EVIDENCE_STATE_SET.has(operation.evidence_state), `${operationPath}.evidence_state: invalid`);
      validateUniqueStrings(operation.evidence_refs, `${operationPath}.evidence_refs`, context);
      context.check(operation.evidence_refs.length > 0, `${operationPath}.evidence_refs: transformation requires evidence`);
    }
    const scenarioWrapper = { munin_reference_ids: [], external_evidence_refs: scenario.external_evidence_refs };
    validateExternalRefs(scenarioWrapper, path, knownMuninRefs, knownSpatialTargets, context);
    validateBlockers(scenario.blockers, `${path}.blockers`, context);
  }

  if (context.strict(bundle.ownership_boundary, ["munin", "spatial_studio_3", "verification"], "manifest.ownership_boundary")) {
    context.check(bundle.ownership_boundary.munin === "property/building/unit/BRF identity; historic sales; current listings; comparable sets; market values; costs; ownership facts", "manifest.ownership_boundary.munin: invalid");
    context.check(bundle.ownership_boundary.spatial_studio_3 === "spatial hierarchy; spatial applicability; coordinate transforms; existing-condition and scenario transformation geometry", "manifest.ownership_boundary.spatial_studio_3: invalid");
    context.check(bundle.ownership_boundary.verification === "final evidence and geometry acceptance", "manifest.ownership_boundary.verification: invalid");
  }
  context.check(sameArray(bundle.forbidden_local_fact_domains, ["MARKET_VALUE", "COST", "OWNERSHIP"]), "manifest.forbidden_local_fact_domains: exact ownership guard required");
  context.check(bundle.dashboard_expansion === false, "manifest.dashboard_expansion: dashboard work is out of scope");
  context.check(bundle.deployment_state === "NOT_DEPLOYED", "manifest.deployment_state: deployment is out of scope");

  const referenceConsumers = [
    ...bundle.neighbourhood_twins,
    ...bundle.building_twins,
    ...bundle.unit_twins,
    ...bundle.existing_condition_twins,
    ...bundle.space_twins,
    ...bundle.design_scenarios,
  ];
  const usedMuninRefs = new Set(referenceConsumers.flatMap((item) => [
    ...(item.munin_reference_ids ?? []),
    ...(item.external_evidence_refs ?? []).map((binding) => binding.munin_reference_id),
  ]));
  for (const referenceId of knownMuninRefs.keys()) context.check(usedMuninRefs.has(referenceId), `munin_interface.references.${referenceId}: unconsumed reference is forbidden`);

  return { ok: context.errors.length === 0, assertions: context.assertions, errors: context.errors };
}

export function compileSpatialGraph(bundle) {
  const validation = validateSpatialBundle(bundle);
  if (!validation.ok) throw new Error(`Spatial graph compilation blocked:\n${validation.errors.join("\n")}`);
  const nodes = [
    { id: bundle.site_twin_ref.id, entity_type: "SiteTwin", version: bundle.site_twin_ref.version },
    ...bundle.neighbourhood_twins.map((item) => ({ id: item.neighbourhood_twin_id, entity_type: item.entity_type, version: item.version })),
    ...bundle.building_twins.map((item) => ({ id: item.building_twin_id, entity_type: item.entity_type, version: item.version })),
    ...bundle.unit_twins.map((item) => ({ id: item.unit_twin_id, entity_type: item.entity_type, version: item.version })),
    ...bundle.existing_condition_twins.map((item) => ({ id: item.existing_condition_twin_id, entity_type: item.entity_type, version: item.version })),
    ...bundle.space_twins.map((item) => ({ id: item.space_twin_id, entity_type: item.entity_type, version: item.version })),
    ...bundle.design_scenarios.map((item) => ({ id: item.scenario_id, entity_type: item.entity_type, version: item.manifest_version })),
    ...bundle.munin_interface.references.map((item) => ({ id: item.reference_id, entity_type: "MuninExternalReference", version: item.record_version })),
  ].sort((a, b) => a.id.localeCompare(b.id) || a.entity_type.localeCompare(b.entity_type));

  const edges = [
    ...bundle.neighbourhood_twins.map((item) => ({ from: bundle.site_twin_ref.id, to: item.neighbourhood_twin_id, relation: "CONTAINS" })),
    ...bundle.building_twins.map((item) => ({ from: item.neighbourhood_twin_id, to: item.building_twin_id, relation: "CONTAINS" })),
    ...bundle.unit_twins.map((item) => ({ from: item.building_twin_id, to: item.unit_twin_id, relation: "CONTAINS" })),
    ...bundle.existing_condition_twins.map((item) => ({ from: item.unit_twin_id, to: item.existing_condition_twin_id, relation: "BASELINE_CAPTURE" })),
    ...bundle.space_twins.map((item) => ({ from: item.existing_condition_twin_id, to: item.space_twin_id, relation: "CONTAINS" })),
    ...bundle.design_scenarios.map((item) => ({ from: item.existing_condition_twin_id, to: item.scenario_id, relation: "BASELINE_FOR" })),
    ...[
      ...bundle.neighbourhood_twins,
      ...bundle.building_twins,
      ...bundle.unit_twins,
      ...bundle.existing_condition_twins,
      ...bundle.space_twins,
      ...bundle.design_scenarios,
    ].flatMap((item) => (item.external_evidence_refs ?? []).map((binding) => ({ from: binding.munin_reference_id, to: binding.spatial_target_ref, relation: "EXTERNAL_EVIDENCE_FOR" }))),
  ].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.relation.localeCompare(b.relation));

  return {
    manifest_version: SPATIAL_GRAPH_VERSION,
    project_id: bundle.project_id,
    source_bundle_sha256: canonicalSha256(bundle),
    evidence_states: [...EVIDENCE_STATES],
    nodes,
    edges,
  };
}
