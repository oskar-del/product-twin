import crypto from "node:crypto";

export const ROOM_TWIN_MANIFEST_VERSION = "room-twin/v1";
export const ROOM_LAB_SCENE_VERSION = "room-scene/v1";

const ROOM_STATES = new Set([
  "SURVEYED_ROOM",
  "OFFICIAL_DERIVED_ROOM",
  "MEASURED_EVIDENCE_ROOM",
  "ASSUMED_DESIGN_ROOM",
  "CONCEPT_DESIGN_ROOM",
  "UNKNOWN_ROOM",
]);
const EVIDENCE_STATES = new Set([
  "SURVEYED",
  "OFFICIAL_SOURCE_DERIVED",
  "MEASURED_FROM_SUPPLIED_EVIDENCE",
  "ASSUMED",
  "CONCEPT_DESIGN",
  "UNKNOWN",
]);
const INTENT_TYPES = new Set([
  "MORNING_SUN",
  "EVENING_SUN",
  "VIEW_PRESERVE",
  "VIEW_PRIORITISE",
  "PRIVACY",
  "GLARE_OVERHEATING",
  "WINDOW_ORIENTATION_OPENING",
  "ROOM_ADJACENCY_CIRCULATION",
  "GARDEN_SUN_SHADE_WIND_WATER_PLANTING",
]);
const ANCHOR_TYPES = new Set([
  "WALL",
  "ROOM_CENTRE",
  "DOOR",
  "WINDOW",
  "VIEW_DIRECTION",
  "VIEW_CONE",
  "MORNING_SOLAR_DIRECTION",
  "EVENING_SOLAR_DIRECTION",
  "FOCAL_POINT",
  "POWER",
  "WATER",
  "DRAINAGE",
  "VENTILATION",
  "FURNITURE_RELATIONSHIP",
  "GARDEN_TERRACE_RELATIONSHIP",
]);
const SOURCE_KINDS = new Set(["SURVEY", "DOCUMENT", "API", "REPOSITORY_RECORD", "USER_DESIGN_DIRECTIVE", "NONE"]);
const GATE_STATUSES = new Set(["OPEN", "SATISFIED", "NOT_APPLICABLE"]);
const GEOMETRY_STATE_BY_ROOM_STATE = {
  SURVEYED_ROOM: new Set(["SURVEYED", "OFFICIAL_SOURCE_DERIVED", "MEASURED_FROM_SUPPLIED_EVIDENCE", "UNKNOWN"]),
  OFFICIAL_DERIVED_ROOM: new Set(["OFFICIAL_SOURCE_DERIVED", "MEASURED_FROM_SUPPLIED_EVIDENCE", "UNKNOWN"]),
  MEASURED_EVIDENCE_ROOM: new Set(["MEASURED_FROM_SUPPLIED_EVIDENCE", "UNKNOWN"]),
  ASSUMED_DESIGN_ROOM: new Set(["ASSUMED", "UNKNOWN"]),
  CONCEPT_DESIGN_ROOM: new Set(["CONCEPT_DESIGN", "UNKNOWN"]),
  UNKNOWN_ROOM: new Set(["UNKNOWN"]),
};

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
}

export function canonicalJson(value) {
  return `${JSON.stringify(sorted(value), null, 2)}\n`;
}

export function canonicalSha256(value) {
  return sha256(canonicalJson(value));
}

function makeContext() {
  const errors = [];
  let assertions = 0;
  const check = (condition, message) => {
    assertions += 1;
    if (!condition) errors.push(message);
  };
  const strict = (value, allowed, path) => {
    check(isObject(value), `${path}: expected object`);
    if (!isObject(value)) return;
    for (const key of Object.keys(value)) check(allowed.includes(key), `${path}.${key}: unknown field`);
    for (const key of allowed) check(Object.hasOwn(value, key), `${path}.${key}: required field is missing`);
  };
  return { errors, get assertions() { return assertions; }, check, strict };
}

function validateVector3(value, path, context, { nullable = false } = {}) {
  if (nullable && value === null) return;
  context.check(Array.isArray(value) && value.length === 3, `${path}: expected a three-number vector`);
  if (Array.isArray(value)) value.forEach((component, index) => context.check(isFiniteNumber(component), `${path}[${index}]: expected finite number`));
}

function validateFileRef(value, path, context) {
  context.strict(value, ["id", "version", "path", "sha256"], path);
  if (!isObject(value)) return;
  context.check(typeof value.id === "string" && value.id.length > 0, `${path}.id: required`);
  context.check(typeof value.version === "string" && value.version.length > 0, `${path}.version: required`);
  context.check(value.path === null || (typeof value.path === "string" && value.path.length > 0), `${path}.path: invalid`);
  context.check(value.sha256 === null || /^[a-f0-9]{64}$/.test(value.sha256), `${path}.sha256: invalid`);
  context.check((value.path === null) === (value.sha256 === null), `${path}: path and hash must both be null or both be populated`);
}

function validateEvidenceRecord(record, index, context) {
  const path = `evidence_records[${index}]`;
  context.strict(record, ["evidence_id", "state", "source", "observation_date", "confidence", "method", "limitations"], path);
  if (!isObject(record)) return;
  context.check(typeof record.evidence_id === "string" && record.evidence_id.length > 0, `${path}.evidence_id: required`);
  context.check(EVIDENCE_STATES.has(record.state), `${path}.state: invalid evidence state`);
  context.strict(record.source, ["kind", "ref", "locator", "authority", "sha256"], `${path}.source`);
  if (isObject(record.source)) {
    context.check(SOURCE_KINDS.has(record.source.kind), `${path}.source.kind: invalid`);
    context.check(record.source.ref === null || typeof record.source.ref === "string", `${path}.source.ref: invalid`);
    context.check(record.source.locator === null || typeof record.source.locator === "string", `${path}.source.locator: invalid`);
    context.check(record.source.authority === null || typeof record.source.authority === "string", `${path}.source.authority: invalid`);
    context.check(record.source.sha256 === null || /^[a-f0-9]{64}$/.test(record.source.sha256), `${path}.source.sha256: invalid`);
    context.check(record.state === "UNKNOWN" ? record.source.kind === "NONE" : record.source.kind !== "NONE", `${path}: evidence source kind conflicts with evidence state`);
  }
  context.check(record.observation_date === null || /^\d{4}-\d{2}-\d{2}$/.test(record.observation_date), `${path}.observation_date: invalid`);
  context.strict(record.confidence, ["label", "value"], `${path}.confidence`);
  if (isObject(record.confidence)) {
    context.check(new Set(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]).has(record.confidence.label), `${path}.confidence.label: invalid`);
    context.check(isFiniteNumber(record.confidence.value) && record.confidence.value >= 0 && record.confidence.value <= 1, `${path}.confidence.value: invalid`);
    if (record.confidence.label === "UNKNOWN") context.check(record.confidence.value === 0, `${path}.confidence: UNKNOWN must have value 0`);
  }
  context.check(typeof record.method === "string", `${path}.method: invalid`);
  context.check(Array.isArray(record.limitations) && record.limitations.every((item) => typeof item === "string"), `${path}.limitations: invalid`);
}

function validateTransformFrame(frame, path, expected, context, evidenceById, gateById) {
  context.strict(frame, ["frame_id", "parent_frame_id", "transform", "evidence_ref", "gate_id"], path);
  if (!isObject(frame)) return;
  context.check(frame.frame_id === expected.frame, `${path}.frame_id: expected ${expected.frame}`);
  context.check(frame.parent_frame_id === expected.parent, `${path}.parent_frame_id: expected ${expected.parent}`);
  context.check(evidenceById.has(frame.evidence_ref), `${path}.evidence_ref: unknown evidence`);
  context.check(gateById.has(frame.gate_id), `${path}.gate_id: unknown gate`);
  if (frame.transform === null) return;
  context.strict(frame.transform, ["translation_m", "yaw_rad", "scale"], `${path}.transform`);
  if (!isObject(frame.transform)) return;
  validateVector3(frame.transform.translation_m, `${path}.transform.translation_m`, context);
  context.check(isFiniteNumber(frame.transform.yaw_rad), `${path}.transform.yaw_rad: invalid`);
  context.check(frame.transform.scale === 1, `${path}.transform.scale: only metre-scale identity is supported`);
  context.check(gateById.get(frame.gate_id)?.status === "SATISFIED", `${path}: transform populated while its hard gate is not SATISFIED`);
  context.check(evidenceById.get(frame.evidence_ref)?.state !== "UNKNOWN", `${path}: populated transform cannot use UNKNOWN evidence`);
}

function validateSpatialIntent(intent, index, context, evidenceById, gateById, knownRefs) {
  const path = `spatial_intents[${index}]`;
  context.strict(intent, ["intent_id", "intent_type", "scope", "user_design_intent", "hard_constraints", "soft_objectives", "candidate_generation", "ranking", "selection"], path);
  if (!isObject(intent)) return;
  context.check(typeof intent.intent_id === "string" && intent.intent_id.length > 0, `${path}.intent_id: required`);
  context.check(INTENT_TYPES.has(intent.intent_type), `${path}.intent_type: invalid`);
  context.check(new Set(["ROOM", "LEVEL", "BUILDING", "GARDEN_TERRACE"]).has(intent.scope), `${path}.scope: invalid`);
  context.check(typeof intent.user_design_intent === "string" && intent.user_design_intent.length > 0, `${path}.user_design_intent: required`);
  context.check(Array.isArray(intent.hard_constraints), `${path}.hard_constraints: expected array`);
  for (const [constraintIndex, constraint] of (intent.hard_constraints ?? []).entries()) {
    const constraintPath = `${path}.hard_constraints[${constraintIndex}]`;
    context.strict(constraint, ["constraint_id", "statement", "evidence_refs", "gate_ids"], constraintPath);
    if (!isObject(constraint)) continue;
    context.check(typeof constraint.constraint_id === "string" && constraint.constraint_id.length > 0, `${constraintPath}.constraint_id: required`);
    context.check(typeof constraint.statement === "string" && constraint.statement.length > 0, `${constraintPath}.statement: required`);
    context.check(Array.isArray(constraint.evidence_refs) && constraint.evidence_refs.every((ref) => evidenceById.has(ref)), `${constraintPath}.evidence_refs: unknown evidence`);
    context.check(Array.isArray(constraint.gate_ids) && constraint.gate_ids.every((ref) => gateById.has(ref)), `${constraintPath}.gate_ids: unknown gate`);
  }
  context.check(Array.isArray(intent.soft_objectives), `${path}.soft_objectives: expected array`);
  for (const [objectiveIndex, objective] of (intent.soft_objectives ?? []).entries()) {
    const objectivePath = `${path}.soft_objectives[${objectiveIndex}]`;
    context.strict(objective, ["objective_id", "statement", "weight"], objectivePath);
    if (!isObject(objective)) continue;
    context.check(typeof objective.objective_id === "string" && objective.objective_id.length > 0, `${objectivePath}.objective_id: required`);
    context.check(typeof objective.statement === "string" && objective.statement.length > 0, `${objectivePath}.statement: required`);
    context.check(isFiniteNumber(objective.weight) && objective.weight >= 0 && objective.weight <= 1, `${objectivePath}.weight: invalid`);
  }
  context.strict(intent.candidate_generation, ["method", "status", "input_refs", "blockers"], `${path}.candidate_generation`);
  if (isObject(intent.candidate_generation)) {
    context.check(intent.candidate_generation.method === "DETERMINISTIC", `${path}.candidate_generation.method: invalid`);
    context.check(new Set(["READY", "BLOCKED"]).has(intent.candidate_generation.status), `${path}.candidate_generation.status: invalid`);
    context.check(Array.isArray(intent.candidate_generation.input_refs) && intent.candidate_generation.input_refs.every((ref) => knownRefs.has(ref)), `${path}.candidate_generation.input_refs: unknown input`);
    context.check(Array.isArray(intent.candidate_generation.blockers) && intent.candidate_generation.blockers.every((item) => typeof item === "string" && item.length > 0), `${path}.candidate_generation.blockers: invalid`);
    if (intent.candidate_generation.status === "BLOCKED") context.check(intent.candidate_generation.blockers.length > 0, `${path}.candidate_generation: BLOCKED requires a blocker`);
    if (intent.candidate_generation.status === "READY") context.check(intent.candidate_generation.blockers.length === 0, `${path}.candidate_generation: READY cannot retain blockers`);
  }
  context.strict(intent.ranking, ["method", "status", "required_evidence_refs"], `${path}.ranking`);
  if (isObject(intent.ranking)) {
    context.check(intent.ranking.method === "EVIDENCE_BACKED", `${path}.ranking.method: invalid`);
    context.check(new Set(["READY", "BLOCKED"]).has(intent.ranking.status), `${path}.ranking.status: invalid`);
    context.check(Array.isArray(intent.ranking.required_evidence_refs) && intent.ranking.required_evidence_refs.every((ref) => evidenceById.has(ref)), `${path}.ranking.required_evidence_refs: unknown evidence`);
  }
  context.strict(intent.selection, ["status", "selected_candidate_id", "selected_by", "selected_at"], `${path}.selection`);
  if (isObject(intent.selection)) {
    context.check(new Set(["UNSELECTED", "SELECTED"]).has(intent.selection.status), `${path}.selection.status: invalid`);
    if (intent.selection.status === "UNSELECTED") {
      context.check(intent.selection.selected_candidate_id === null && intent.selection.selected_by === null && intent.selection.selected_at === null, `${path}.selection: unselected intent cannot contain a selection`);
    } else {
      context.check(typeof intent.selection.selected_candidate_id === "string" && typeof intent.selection.selected_by === "string" && /^\d{4}-\d{2}-\d{2}T/.test(intent.selection.selected_at ?? ""), `${path}.selection: selected intent requires explicit candidate, actor and time`);
    }
  }
}

export function validateRoomTwin(manifest) {
  const context = makeContext();
  context.strict(manifest, ["manifest_version", "entity_type", "room_state", "identity", "coordinate_systems", "spatial_geometry", "semantic_anchors", "evidence_records", "hard_gates", "blockers", "upstream_context", "spatial_intents", "domain_ownership", "room_lab_compatibility"], "manifest");
  if (!isObject(manifest)) return { ok: false, errors: context.errors, assertions: context.assertions };
  context.check(manifest.manifest_version === ROOM_TWIN_MANIFEST_VERSION, "manifest_version: unsupported");
  context.check(manifest.entity_type === "RoomTwin", "entity_type: expected RoomTwin");
  context.check(ROOM_STATES.has(manifest.room_state), "room_state: invalid");

  context.strict(manifest.identity, ["project_id", "site_twin_id", "design_scenario_id", "building_id", "level_id", "room_id", "room_version", "room_type", "intended_use", "label"], "identity");
  if (isObject(manifest.identity)) {
    for (const key of ["project_id", "site_twin_id", "design_scenario_id", "building_id", "level_id", "room_id", "room_type", "intended_use", "label"]) context.check(typeof manifest.identity[key] === "string" && manifest.identity[key].length > 0, `identity.${key}: required`);
    context.check(/^\d+\.\d+$/.test(manifest.identity.room_version ?? ""), "identity.room_version: expected major.minor");
  }

  context.check(Array.isArray(manifest.evidence_records) && manifest.evidence_records.length > 0, "evidence_records: expected non-empty array");
  (manifest.evidence_records ?? []).forEach((record, index) => validateEvidenceRecord(record, index, context));
  const evidenceById = new Map((manifest.evidence_records ?? []).map((record) => [record.evidence_id, record]));
  context.check(evidenceById.size === (manifest.evidence_records?.length ?? 0), "evidence_records: duplicate evidence IDs");

  context.check(Array.isArray(manifest.hard_gates), "hard_gates: expected array");
  for (const [index, gate] of (manifest.hard_gates ?? []).entries()) {
    const path = `hard_gates[${index}]`;
    context.strict(gate, ["gate_id", "scope", "status", "evidence_refs", "blocker"], path);
    if (!isObject(gate)) continue;
    context.check(typeof gate.gate_id === "string" && gate.gate_id.length > 0, `${path}.gate_id: required`);
    context.check(new Set(["UPSTREAM_SITE", "ROOM"]).has(gate.scope), `${path}.scope: invalid`);
    context.check(GATE_STATUSES.has(gate.status), `${path}.status: invalid`);
    context.check(Array.isArray(gate.evidence_refs) && gate.evidence_refs.every((ref) => evidenceById.has(ref)), `${path}.evidence_refs: unknown evidence`);
    if (gate.status === "OPEN") context.check(typeof gate.blocker === "string" && gate.blocker.length > 0, `${path}: OPEN gate requires blocker`);
    else context.check(gate.blocker === null, `${path}: closed gate cannot retain blocker`);
  }
  const gateById = new Map((manifest.hard_gates ?? []).map((gate) => [gate.gate_id, gate]));
  context.check(gateById.size === (manifest.hard_gates?.length ?? 0), "hard_gates: duplicate gate IDs");

  context.strict(manifest.coordinate_systems, ["linear_units", "angle_units", "room_axis_convention", "site_frame", "building_local", "level_local", "room_local", "room_true_north_yaw_rad"], "coordinate_systems");
  if (isObject(manifest.coordinate_systems)) {
    context.check(manifest.coordinate_systems.linear_units === "m", "coordinate_systems.linear_units: only metres are supported");
    context.check(manifest.coordinate_systems.angle_units === "rad", "coordinate_systems.angle_units: only radians are supported");
    context.check(manifest.coordinate_systems.room_axis_convention === "+X right/east in room, +Y up, +Z toward max-z", "coordinate_systems.room_axis_convention: unsupported");
    const site = manifest.coordinate_systems.site_frame;
    context.strict(site, ["frame_id", "crs", "origin", "north_definition", "evidence_ref"], "coordinate_systems.site_frame");
    if (isObject(site)) {
      context.check(site.frame_id === "SITE", "coordinate_systems.site_frame.frame_id: expected SITE");
      context.check(site.crs === null || typeof site.crs === "string", "coordinate_systems.site_frame.crs: invalid");
      validateVector3(site.origin, "coordinate_systems.site_frame.origin", context, { nullable: true });
      context.check((site.crs === null) === (site.origin === null), "coordinate_systems.site_frame: CRS and origin must be populated together");
      context.check(site.north_definition === null || typeof site.north_definition === "string", "coordinate_systems.site_frame.north_definition: invalid");
      context.check(evidenceById.has(site.evidence_ref), "coordinate_systems.site_frame.evidence_ref: unknown evidence");
      if (site.crs !== null) context.check(evidenceById.get(site.evidence_ref)?.state === "OFFICIAL_SOURCE_DERIVED" || evidenceById.get(site.evidence_ref)?.state === "SURVEYED", "coordinate_systems.site_frame: populated CRS requires official or surveyed evidence");
    }
    validateTransformFrame(manifest.coordinate_systems.building_local, "coordinate_systems.building_local", { frame: "BUILDING", parent: "SITE" }, context, evidenceById, gateById);
    validateTransformFrame(manifest.coordinate_systems.level_local, "coordinate_systems.level_local", { frame: "LEVEL", parent: "BUILDING" }, context, evidenceById, gateById);
    validateTransformFrame(manifest.coordinate_systems.room_local, "coordinate_systems.room_local", { frame: "ROOM", parent: "LEVEL" }, context, evidenceById, gateById);
    context.check(manifest.coordinate_systems.room_true_north_yaw_rad === null || isFiniteNumber(manifest.coordinate_systems.room_true_north_yaw_rad), "coordinate_systems.room_true_north_yaw_rad: invalid");
    if (manifest.coordinate_systems.room_true_north_yaw_rad !== null) context.check(manifest.coordinate_systems.room_local?.transform !== null, "coordinate_systems.room_true_north_yaw_rad: cannot be known without room transform");
  }

  const geometry = manifest.spatial_geometry;
  context.strict(geometry, ["bounds", "floor", "ceiling", "walls", "surfaces", "openings", "columns", "fixed_elements", "service_zones", "protected_paths", "required_clearances"], "spatial_geometry");
  const geometryEvidenceRefs = [];
  const knownRefs = new Set();
  if (isObject(geometry)) {
    context.strict(geometry.bounds, ["minX", "maxX", "minZ", "maxZ", "evidence_ref"], "spatial_geometry.bounds");
    const bounds = geometry.bounds;
    if (isObject(bounds)) {
      for (const key of ["minX", "maxX", "minZ", "maxZ"]) context.check(isFiniteNumber(bounds[key]), `spatial_geometry.bounds.${key}: invalid`);
      context.check(bounds.minX < bounds.maxX && bounds.minZ < bounds.maxZ, "spatial_geometry.bounds: invalid ordering");
      geometryEvidenceRefs.push(bounds.evidence_ref);
      knownRefs.add("ROOM_BOUNDS");
    }
    const validatePlane = (plane, path) => {
      context.strict(plane, ["id", "label", "y", "evidence_ref"], path);
      if (!isObject(plane)) return;
      context.check(typeof plane.id === "string" && plane.id.length > 0, `${path}.id: required`);
      context.check(typeof plane.label === "string" && plane.label.length > 0, `${path}.label: required`);
      context.check(isFiniteNumber(plane.y), `${path}.y: invalid`);
      geometryEvidenceRefs.push(plane.evidence_ref);
      knownRefs.add(plane.id);
    };
    validatePlane(geometry.floor, "spatial_geometry.floor");
    if (geometry.ceiling !== null) {
      validatePlane(geometry.ceiling, "spatial_geometry.ceiling");
      context.check(geometry.ceiling?.y > geometry.floor?.y, "spatial_geometry.ceiling: must be above floor");
    }
    for (const collection of ["walls", "columns", "fixed_elements", "service_zones"]) {
      const values = geometry[collection];
      context.check(values === null || Array.isArray(values), `spatial_geometry.${collection}: expected array or null`);
      for (const [index, item] of (values ?? []).entries()) {
        const path = `spatial_geometry.${collection}[${index}]`;
        context.strict(item, ["id", "label", "bounds", "evidence_ref"], path);
        if (!isObject(item)) continue;
        context.check(typeof item.id === "string" && item.id.length > 0, `${path}.id: required`);
        context.check(typeof item.label === "string" && item.label.length > 0, `${path}.label: required`);
        context.strict(item.bounds, ["min", "max"], `${path}.bounds`);
        if (isObject(item.bounds)) {
          validateVector3(item.bounds.min, `${path}.bounds.min`, context);
          validateVector3(item.bounds.max, `${path}.bounds.max`, context);
        }
        geometryEvidenceRefs.push(item.evidence_ref);
        knownRefs.add(item.id);
      }
    }
    context.check(Array.isArray(geometry.surfaces), "spatial_geometry.surfaces: expected array");
    const surfaceById = new Map();
    for (const [index, surface] of (geometry.surfaces ?? []).entries()) {
      const path = `spatial_geometry.surfaces[${index}]`;
      context.strict(surface, ["id", "label", "side", "rotation_rad", "gap_m", "evidence_ref"], path);
      if (!isObject(surface)) continue;
      context.check(typeof surface.id === "string" && surface.id.length > 0, `${path}.id: required`);
      context.check(typeof surface.label === "string" && surface.label.length > 0, `${path}.label: required`);
      context.check(new Set(["left", "right", "min-z", "max-z"]).has(surface.side), `${path}.side: invalid`);
      context.check(isFiniteNumber(surface.rotation_rad), `${path}.rotation_rad: invalid`);
      context.check(isFiniteNumber(surface.gap_m) && surface.gap_m >= 0, `${path}.gap_m: invalid`);
      context.check(!surfaceById.has(surface.id), `${path}.id: duplicate`);
      surfaceById.set(surface.id, surface);
      geometryEvidenceRefs.push(surface.evidence_ref);
      knownRefs.add(surface.id);
    }
    context.check(geometry.openings === null || Array.isArray(geometry.openings), "spatial_geometry.openings: expected array or null");
    const openingById = new Map();
    for (const [index, opening] of (geometry.openings ?? []).entries()) {
      const path = `spatial_geometry.openings[${index}]`;
      context.strict(opening, ["id", "label", "opening_type", "surface_id", "width_m", "sill_m", "height_m", "offset_along_surface_m", "evidence_ref"], path);
      if (!isObject(opening)) continue;
      context.check(typeof opening.id === "string" && opening.id.length > 0, `${path}.id: required`);
      context.check(new Set(["DOOR", "WINDOW", "OTHER"]).has(opening.opening_type), `${path}.opening_type: invalid`);
      context.check(surfaceById.has(opening.surface_id), `${path}.surface_id: unknown surface`);
      context.check(isFiniteNumber(opening.width_m) && opening.width_m > 0, `${path}.width_m: invalid`);
      context.check(opening.sill_m === null || isFiniteNumber(opening.sill_m), `${path}.sill_m: invalid`);
      context.check(opening.height_m === null || (isFiniteNumber(opening.height_m) && opening.height_m > 0), `${path}.height_m: invalid`);
      context.check(opening.offset_along_surface_m === null || isFiniteNumber(opening.offset_along_surface_m), `${path}.offset_along_surface_m: invalid`);
      const surface = surfaceById.get(opening.surface_id);
      const span = surface && bounds ? (new Set(["left", "right"]).has(surface.side) ? bounds.maxZ - bounds.minZ : bounds.maxX - bounds.minX) : 0;
      context.check(opening.width_m <= span, `${path}: opening exceeds its surface span`);
      if (geometry.ceiling && opening.sill_m !== null && opening.height_m !== null) context.check(opening.sill_m + opening.height_m <= geometry.ceiling.y - geometry.floor.y, `${path}: opening exceeds ceiling`);
      geometryEvidenceRefs.push(opening.evidence_ref);
      openingById.set(opening.id, opening);
      knownRefs.add(opening.id);
    }
    for (const collection of ["protected_paths", "required_clearances"]) {
      const values = geometry[collection];
      context.check(values === null || Array.isArray(values), `spatial_geometry.${collection}: expected array or null`);
      for (const [index, rect] of (values ?? []).entries()) {
        const path = `spatial_geometry.${collection}[${index}]`;
        context.strict(rect, ["id", "label", "x", "z", "width_m", "depth_m", "evidence_ref"], path);
        if (!isObject(rect)) continue;
        context.check(typeof rect.id === "string" && rect.id.length > 0, `${path}.id: required`);
        context.check(isFiniteNumber(rect.x) && isFiniteNumber(rect.z), `${path}: invalid centre`);
        context.check(isFiniteNumber(rect.width_m) && rect.width_m > 0 && isFiniteNumber(rect.depth_m) && rect.depth_m > 0, `${path}: requires positive width and depth`);
        context.check(isObject(bounds) && rect.x - rect.width_m / 2 >= bounds.minX && rect.x + rect.width_m / 2 <= bounds.maxX && rect.z - rect.depth_m / 2 >= bounds.minZ && rect.z + rect.depth_m / 2 <= bounds.maxZ, `${path}: rectangle lies outside room bounds`);
        geometryEvidenceRefs.push(rect.evidence_ref);
        knownRefs.add(rect.id);
      }
    }
  }

  context.check(Array.isArray(manifest.semantic_anchors), "semantic_anchors: expected array");
  const anchorIds = new Set();
  for (const [index, anchor] of (manifest.semantic_anchors ?? []).entries()) {
    const path = `semantic_anchors[${index}]`;
    context.strict(anchor, ["id", "label", "anchor_type", "target_ref", "point", "direction", "cone_half_angle_rad", "rotations_rad", "evidence_ref"], path);
    if (!isObject(anchor)) continue;
    context.check(typeof anchor.id === "string" && anchor.id.length > 0, `${path}.id: required`);
    context.check(!anchorIds.has(anchor.id), `${path}.id: duplicate`);
    anchorIds.add(anchor.id);
    context.check(ANCHOR_TYPES.has(anchor.anchor_type), `${path}.anchor_type: invalid`);
    context.check(anchor.target_ref === null || knownRefs.has(anchor.target_ref), `${path}.target_ref: unknown target`);
    validateVector3(anchor.point, `${path}.point`, context, { nullable: true });
    validateVector3(anchor.direction, `${path}.direction`, context, { nullable: true });
    context.check(anchor.cone_half_angle_rad === null || (isFiniteNumber(anchor.cone_half_angle_rad) && anchor.cone_half_angle_rad >= 0), `${path}.cone_half_angle_rad: invalid`);
    context.check(anchor.rotations_rad === null || (Array.isArray(anchor.rotations_rad) && anchor.rotations_rad.every(isFiniteNumber)), `${path}.rotations_rad: invalid`);
    context.check(evidenceById.has(anchor.evidence_ref), `${path}.evidence_ref: unknown evidence`);
    if (anchor.point && geometry?.bounds) context.check(anchor.point[0] >= geometry.bounds.minX && anchor.point[0] <= geometry.bounds.maxX && anchor.point[2] >= geometry.bounds.minZ && anchor.point[2] <= geometry.bounds.maxZ, `${path}.point: outside room bounds`);
    geometryEvidenceRefs.push(anchor.evidence_ref);
    knownRefs.add(anchor.id);
  }
  context.check((manifest.semantic_anchors ?? []).filter((anchor) => anchor.anchor_type === "ROOM_CENTRE").length === 1, "semantic_anchors: exactly one ROOM_CENTRE is required");

  for (const ref of geometryEvidenceRefs) context.check(evidenceById.has(ref), `geometry evidence_ref ${ref}: unknown evidence`);
  const permittedStates = GEOMETRY_STATE_BY_ROOM_STATE[manifest.room_state] ?? new Set();
  for (const ref of geometryEvidenceRefs) {
    const state = evidenceById.get(ref)?.state;
    if (state) context.check(permittedStates.has(state), `geometry evidence ${ref}: ${state} misrepresents ${manifest.room_state}`);
  }

  context.check(Array.isArray(manifest.blockers) && manifest.blockers.every((item) => typeof item === "string" && item.length > 0), "blockers: invalid");
  context.strict(manifest.upstream_context, ["site_twin_ref", "design_scenario_ref", "site_boundary_geometry", "terrain_dem", "permitted_access_point", "planning_entitlement", "buildable_envelope"], "upstream_context");
  if (isObject(manifest.upstream_context)) {
    validateFileRef(manifest.upstream_context.site_twin_ref, "upstream_context.site_twin_ref", context);
    validateFileRef(manifest.upstream_context.design_scenario_ref, "upstream_context.design_scenario_ref", context);
    for (const key of ["site_boundary_geometry", "terrain_dem", "permitted_access_point", "planning_entitlement", "buildable_envelope"]) context.check(manifest.upstream_context[key] === null, `upstream_context.${key}: Room Twin must reference, not duplicate or invent, upstream spatial truth`);
  }

  context.check(Array.isArray(manifest.spatial_intents), "spatial_intents: expected array");
  (manifest.spatial_intents ?? []).forEach((intent, index) => validateSpatialIntent(intent, index, context, evidenceById, gateById, knownRefs));
  context.check(new Set((manifest.spatial_intents ?? []).map((intent) => intent.intent_id)).size === (manifest.spatial_intents?.length ?? 0), "spatial_intents: duplicate IDs");

  context.strict(manifest.domain_ownership, ["spatial_studio", "avatar_factory", "procurement", "room_lab", "verification"], "domain_ownership");
  if (isObject(manifest.domain_ownership)) {
    context.check(manifest.domain_ownership.spatial_studio === "site/building/level/room geometry and environmental anchors", "domain_ownership.spatial_studio: invalid");
    context.check(manifest.domain_ownership.avatar_factory === "furniture geometry and product spatial semantics", "domain_ownership.avatar_factory: invalid");
    context.check(manifest.domain_ownership.procurement === "destination-specific supply", "domain_ownership.procurement: invalid");
    context.check(manifest.domain_ownership.room_lab === "interaction and explicit placements", "domain_ownership.room_lab: invalid");
    context.check(manifest.domain_ownership.verification === "final acceptance", "domain_ownership.verification: invalid");
  }

  const compatibility = manifest.room_lab_compatibility;
  context.strict(compatibility, ["target_manifest_version", "source_commit", "source_manifest_path", "source_manifest_sha256", "source_importer_sha256", "scene_id", "scene_label", "domain_owner", "baseline_placements"], "room_lab_compatibility");
  if (isObject(compatibility)) {
    context.check(compatibility.target_manifest_version === ROOM_LAB_SCENE_VERSION, "room_lab_compatibility.target_manifest_version: unsupported");
    context.check(/^[a-f0-9]{40}$/.test(compatibility.source_commit ?? ""), "room_lab_compatibility.source_commit: invalid");
    context.check(typeof compatibility.source_manifest_path === "string" && compatibility.source_manifest_path.length > 0, "room_lab_compatibility.source_manifest_path: required");
    context.check(compatibility.source_manifest_sha256 === null || /^[a-f0-9]{64}$/.test(compatibility.source_manifest_sha256), "room_lab_compatibility.source_manifest_sha256: invalid");
    context.check(/^[a-f0-9]{64}$/.test(compatibility.source_importer_sha256 ?? ""), "room_lab_compatibility.source_importer_sha256: invalid");
    context.check(typeof compatibility.scene_id === "string" && compatibility.scene_id.length > 0, "room_lab_compatibility.scene_id: required");
    context.check(typeof compatibility.scene_label === "string" && compatibility.scene_label.length > 0, "room_lab_compatibility.scene_label: required");
    context.check(compatibility.domain_owner === "ROOM_LAB", "room_lab_compatibility.domain_owner: explicit placements must remain Room Lab-owned");
    context.check(Array.isArray(compatibility.baseline_placements), "room_lab_compatibility.baseline_placements: expected array");
    for (const [index, placement] of (compatibility.baseline_placements ?? []).entries()) {
      const path = `room_lab_compatibility.baseline_placements[${index}]`;
      context.strict(placement, ["product_id", "x", "y", "z", "rotation"], path);
      if (!isObject(placement)) continue;
      context.check(typeof placement.product_id === "string" && placement.product_id.length > 0, `${path}.product_id: required`);
      for (const key of ["x", "y", "z", "rotation"]) context.check(isFiniteNumber(placement[key]), `${path}.${key}: invalid`);
    }
  }

  return { ok: context.errors.length === 0, errors: context.errors, assertions: context.assertions };
}

export function exportRoomLabScene(manifest) {
  const validation = validateRoomTwin(manifest);
  if (!validation.ok) throw new Error(`Room Twin export blocked:\n${validation.errors.join("\n")}`);
  const geometry = manifest.spatial_geometry;
  const compatibility = manifest.room_lab_compatibility;
  const scene = {
    id: compatibility.scene_id,
    label: compatibility.scene_label,
    bounds: {
      minX: geometry.bounds.minX,
      maxX: geometry.bounds.maxX,
      minZ: geometry.bounds.minZ,
      maxZ: geometry.bounds.maxZ,
    },
    floor: { id: geometry.floor.id, label: geometry.floor.label, y: geometry.floor.y },
    surfaces: geometry.surfaces.map((surface) => ({
      id: surface.id,
      label: surface.label,
      side: surface.side,
      rotation: surface.rotation_rad,
      gap: surface.gap_m,
    })),
    openings: (geometry.openings ?? []).map((opening) => {
      const result = { id: opening.id, label: opening.label, surfaceId: opening.surface_id, width: opening.width_m };
      if (opening.sill_m !== null) result.sill = opening.sill_m;
      if (opening.height_m !== null) result.height = opening.height_m;
      return result;
    }),
    protectedPaths: (geometry.protected_paths ?? []).map((path) => ({ id: path.id, label: path.label, x: path.x, z: path.z, width: path.width_m, depth: path.depth_m })),
    anchors: manifest.semantic_anchors
      .filter((anchor) => anchor.point !== null && anchor.rotations_rad !== null)
      .map((anchor) => ({ id: anchor.id, label: anchor.label, x: anchor.point[0], z: anchor.point[2], rotations: anchor.rotations_rad })),
    baseline_placements: compatibility.baseline_placements.map((placement) => ({ ...placement })),
  };
  return { manifest_version: ROOM_LAB_SCENE_VERSION, scene };
}

export function validateRoomLabSceneV1(sceneManifest) {
  const context = makeContext();
  context.strict(sceneManifest, ["manifest_version", "scene"], "room_lab_manifest");
  if (!isObject(sceneManifest)) return { ok: false, errors: context.errors, assertions: context.assertions };
  context.check(sceneManifest.manifest_version === ROOM_LAB_SCENE_VERSION, "room_lab_manifest.manifest_version: unsupported");
  const scene = sceneManifest.scene;
  context.strict(scene, ["id", "label", "bounds", "floor", "surfaces", "openings", "protectedPaths", "anchors", "baseline_placements"], "room_lab_manifest.scene");
  if (!isObject(scene)) return { ok: false, errors: context.errors, assertions: context.assertions };
  context.strict(scene.bounds, ["minX", "maxX", "minZ", "maxZ"], "room_lab_manifest.scene.bounds");
  const bounds = scene.bounds;
  context.check(isObject(bounds) && [bounds?.minX, bounds?.maxX, bounds?.minZ, bounds?.maxZ].every(isFiniteNumber) && bounds.minX < bounds.maxX && bounds.minZ < bounds.maxZ, "room_lab_manifest.scene.bounds: invalid");
  context.strict(scene.floor, ["id", "label", "y"], "room_lab_manifest.scene.floor");
  context.check(isObject(scene.floor) && isFiniteNumber(scene.floor.y), "room_lab_manifest.scene.floor: invalid");
  context.check(Array.isArray(scene.surfaces), "room_lab_manifest.scene.surfaces: expected array");
  const surfaceIds = new Set((scene.surfaces ?? []).map((surface) => surface.id));
  for (const opening of scene.openings ?? []) context.check(surfaceIds.has(opening.surfaceId), `room_lab_manifest.scene.openings.${opening.id}: unknown surface`);
  for (const path of scene.protectedPaths ?? []) context.check(path.width > 0 && path.depth > 0, `room_lab_manifest.scene.protectedPaths.${path.id}: invalid dimensions`);
  context.check(Array.isArray(scene.anchors), "room_lab_manifest.scene.anchors: expected array");
  context.check(Array.isArray(scene.baseline_placements), "room_lab_manifest.scene.baseline_placements: expected array");
  return { ok: context.errors.length === 0, errors: context.errors, assertions: context.assertions };
}
