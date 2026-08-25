/**
 * Twin scene contract.
 *
 * Parses a twin-scene document into the normalized form the engine renders, and refuses
 * anything it cannot render honestly. Structural rules the JSON schema cannot express live
 * here: primitive-specific geometry requirements, id uniqueness, stage/element referential
 * integrity, camera degeneracy.
 *
 * The engine calls this before touching WebGL, so a malformed scene fails as a readable list
 * of violations instead of an empty canvas or — worse — a plausible-looking wrong picture.
 *
 * Pure module: no DOM, no WebGL, no ajv. Safe to import from a Node gate.
 */

import {EVIDENCE_CLASSES, isEvidenceClass} from "./evidence.mjs";

export const PRIMITIVES = Object.freeze([
  "GRID_SURFACE",
  "EXTRUDED_POLYGON",
  "POLYLINE_RIBBON",
  "BOX",
  "ROOM_VOLUME",
  "MARKER",
  "DIAGRAMMATIC_MARKER",
  "DIRECTION_CONE",
  "SOLAR_ARC"
]);

export const PROFILES = Object.freeze(["INTELLIGENCE", "REALISTIC", "COMPARE", "SYSTEMS"]);

export class SceneContractError extends Error {
  constructor(violations) {
    super(`twin scene violates the contract (${violations.length}):\n  - ${violations.join("\n  - ")}`);
    this.name = "SceneContractError";
    this.violations = Object.freeze([...violations]);
  }
}

const isFiniteNumber = value => typeof value === "number" && Number.isFinite(value);
const isVec3 = value => Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber);
const isVec2 = value => Array.isArray(value) && value.length === 2 && value.every(isFiniteNumber);
const isNonEmptyString = value => typeof value === "string" && value.length > 0;

/** Geometry rules per primitive. Each returns a list of violation strings. */
const GEOMETRY_RULES = {
  GRID_SURFACE(g, at) {
    const problems = [];
    if (!Number.isInteger(g.segments) || g.segments < 1) problems.push(`${at}.segments must be a positive integer`);
    if (!Array.isArray(g.vertices) || !g.vertices.every(isVec3)) problems.push(`${at}.vertices must be an array of [x,y,z]`);
    else if (Number.isInteger(g.segments)) {
      const expected = (g.segments + 1) ** 2;
      if (g.vertices.length !== expected) {
        problems.push(`${at}.vertices has ${g.vertices.length} points but segments=${g.segments} requires ${expected}`);
      }
    }
    return problems;
  },
  EXTRUDED_POLYGON(g, at) {
    const problems = [];
    if (!Array.isArray(g.points_xz) || g.points_xz.length < 3) problems.push(`${at}.points_xz needs at least 3 points`);
    else if (!g.points_xz.every(isVec2)) problems.push(`${at}.points_xz must be [x,z] pairs`);
    if (!isFiniteNumber(g.height)) problems.push(`${at}.height must be a number`);
    if (!isFiniteNumber(g.base_y)) problems.push(`${at}.base_y must be a number`);
    return problems;
  },
  POLYLINE_RIBBON(g, at) {
    const problems = [];
    if (!Array.isArray(g.points) || g.points.length < 2) problems.push(`${at}.points needs at least 2 points`);
    else if (!g.points.every(isVec3)) problems.push(`${at}.points must be [x,y,z] triples`);
    if (!isFiniteNumber(g.width_m) || g.width_m <= 0) problems.push(`${at}.width_m must be a positive number`);
    return problems;
  },
  BOX(g, at) {
    const problems = [];
    if (!isVec3(g.size) || g.size.some(v => v <= 0)) problems.push(`${at}.size must be three positive numbers`);
    if (!isVec3(g.position)) problems.push(`${at}.position must be [x,y,z]`);
    if (g.rotation_y_deg != null && !isFiniteNumber(g.rotation_y_deg)) problems.push(`${at}.rotation_y_deg must be a number`);
    return problems;
  },
  MARKER(g, at) {
    return isVec3(g.position) ? [] : [`${at}.position must be [x,y,z]`];
  },
  DIRECTION_CONE(g, at) {
    const problems = [];
    if (!isVec3(g.origin)) problems.push(`${at}.origin must be [x,y,z]`);
    if (!isFiniteNumber(g.azimuth_deg)) problems.push(`${at}.azimuth_deg must be a number`);
    if (!isFiniteNumber(g.length_m) || g.length_m <= 0) problems.push(`${at}.length_m must be a positive number`);
    return problems;
  },
  SOLAR_ARC(g, at) {
    const problems = [];
    if (!isFiniteNumber(g.latitude_deg) || Math.abs(g.latitude_deg) > 90) problems.push(`${at}.latitude_deg must be a latitude`);
    if (!isFiniteNumber(g.longitude_deg) || Math.abs(g.longitude_deg) > 180) problems.push(`${at}.longitude_deg must be a longitude`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(g.study_date))) problems.push(`${at}.study_date must be YYYY-MM-DD`);
    if (!Array.isArray(g.hours) || !g.hours.length || !g.hours.every(isFiniteNumber)) problems.push(`${at}.hours must be a non-empty array of numbers`);
    return problems;
  }
};
GEOMETRY_RULES.ROOM_VOLUME = GEOMETRY_RULES.BOX;
GEOMETRY_RULES.DIAGRAMMATIC_MARKER = GEOMETRY_RULES.MARKER;

function checkElement(element, index, seenIds, violations) {
  const at = `elements[${index}]`;
  if (!isNonEmptyString(element?.id)) violations.push(`${at}.id must be a non-empty string`);
  else if (seenIds.has(element.id)) violations.push(`${at}.id "${element.id}" is duplicated`);
  else seenIds.add(element.id);

  if (!isNonEmptyString(element?.type)) violations.push(`${at}.type must be a non-empty string`);
  if (!isNonEmptyString(element?.label)) violations.push(`${at}.label must be a non-empty string`);
  if (!isEvidenceClass(element?.evidence_class)) {
    violations.push(`${at}.evidence_class must be one of ${EVIDENCE_CLASSES.join(", ")}`);
  }
  if (!Array.isArray(element?.source_refs) || !element.source_refs.length) {
    violations.push(`${at}.source_refs must name at least one source — an unsourced element cannot be rendered as a claim`);
  }
  if (!Array.isArray(element?.limitations)) violations.push(`${at}.limitations must be an array`);

  const geometry = element?.geometry;
  if (!geometry || typeof geometry !== "object") {
    violations.push(`${at}.geometry is missing`);
    return;
  }
  if (!PRIMITIVES.includes(geometry.primitive)) {
    violations.push(`${at}.geometry.primitive "${geometry.primitive}" is not a twin-engine primitive (${PRIMITIVES.join(", ")})`);
    return;
  }
  violations.push(...GEOMETRY_RULES[geometry.primitive](geometry, `${at}.geometry`));
}

function checkStage(stage, index, elementTypes, elementIds, seenIds, violations) {
  const at = `navigation[${index}]`;
  if (!isNonEmptyString(stage?.id)) violations.push(`${at}.id must be a non-empty string`);
  else if (seenIds.has(stage.id)) violations.push(`${at}.id "${stage.id}" is duplicated`);
  else seenIds.add(stage.id);

  if (!isNonEmptyString(stage?.label)) violations.push(`${at}.label must be a non-empty string`);
  if (!isVec3(stage?.camera)) violations.push(`${at}.camera must be [x,y,z]`);
  if (!isVec3(stage?.target)) violations.push(`${at}.target must be [x,y,z]`);
  if (isVec3(stage?.camera) && isVec3(stage?.target) && stage.camera.every((v, i) => v === stage.target[i])) {
    violations.push(`${at}.camera coincides with target — the view direction is undefined`);
  }
  if (typeof stage?.cutaway !== "boolean") violations.push(`${at}.cutaway must be a boolean`);
  if (!Array.isArray(stage?.visible_groups) || !stage.visible_groups.length) {
    violations.push(`${at}.visible_groups must name at least one element type`);
  } else {
    for (const group of stage.visible_groups) {
      if (!elementTypes.has(group)) violations.push(`${at}.visible_groups references "${group}", which no element declares as its type`);
    }
  }
  if (stage?.on_enter_open_element != null && !elementIds.has(stage.on_enter_open_element)) {
    violations.push(`${at}.on_enter_open_element references unknown element "${stage.on_enter_open_element}"`);
  }
}

/**
 * Validate and normalize a twin-scene document.
 * @throws {SceneContractError} with every violation found, not just the first.
 */
export function parseScene(document) {
  const violations = [];
  if (!document || typeof document !== "object") throw new SceneContractError(["scene document must be an object"]);

  if (!isNonEmptyString(document.scene_id)) violations.push("scene_id must be a non-empty string");
  if (!/^[a-z0-9-]+\/v\d+\.\d+$/.test(String(document.scene_version))) {
    violations.push(`scene_version "${document.scene_version}" must look like <name>/v<major>.<minor>`);
  }

  const coordinateSystem = document.coordinate_system;
  if (!coordinateSystem || coordinateSystem.frame !== "LOCAL_ENU") violations.push("coordinate_system.frame must be LOCAL_ENU");
  if (coordinateSystem?.linear_units !== "metre") violations.push("coordinate_system.linear_units must be metre");
  if (!isVec2(coordinateSystem?.origin_wgs84)) violations.push("coordinate_system.origin_wgs84 must be [longitude, latitude]");
  const axes = coordinateSystem?.axes;
  if (!axes || axes.x !== "EAST" || axes.y !== "UP" || axes.z !== "NORTH") {
    violations.push("coordinate_system.axes must be x=EAST, y=UP, z=NORTH");
  }

  if (!Array.isArray(document.source_bindings) || !document.source_bindings.length) {
    violations.push("source_bindings must record at least one source the scene was built from");
  }
  if (!document.legal_claim_policy || !Array.isArray(document.legal_claim_policy.blocked_claims)) {
    violations.push("legal_claim_policy.blocked_claims must be an array — a scene must state what it may not claim");
  }

  const elements = Array.isArray(document.elements) ? document.elements : [];
  if (!elements.length) violations.push("elements must contain at least one element");
  const elementIds = new Set();
  elements.forEach((element, index) => checkElement(element, index, elementIds, violations));

  const elementTypes = new Set(elements.map(element => element?.type).filter(isNonEmptyString));
  const stages = Array.isArray(document.navigation) ? document.navigation : [];
  if (!stages.length) violations.push("navigation must contain at least one stage");
  const stageIds = new Set();
  stages.forEach((stage, index) => checkStage(stage, index, elementTypes, elementIds, stageIds, violations));

  const presentation = document.presentation ?? {};
  for (const profile of presentation.profiles ?? []) {
    if (!PROFILES.includes(profile)) violations.push(`presentation.profiles contains unknown profile "${profile}"`);
  }
  if (presentation.default_stage != null && !stageIds.has(presentation.default_stage)) {
    violations.push(`presentation.default_stage references unknown stage "${presentation.default_stage}"`);
  }

  if (violations.length) throw new SceneContractError(violations);

  return Object.freeze({
    scene_id: document.scene_id,
    scene_version: document.scene_version,
    subject: document.subject ?? null,
    origin_wgs84: Object.freeze([...coordinateSystem.origin_wgs84]),
    coordinate_system: coordinateSystem,
    legal_claim_policy: document.legal_claim_policy,
    source_bindings: Object.freeze([...document.source_bindings]),
    studies: document.studies ?? null,
    elements: Object.freeze(elements.map(element => Object.freeze({...element}))),
    element_types: Object.freeze([...elementTypes].sort()),
    stages: Object.freeze(stages.map(stage => Object.freeze({...stage}))),
    presentation: Object.freeze({
      profiles: Object.freeze(presentation.profiles ? [...presentation.profiles] : ["INTELLIGENCE", "REALISTIC", "COMPARE"]),
      default_profile: presentation.default_profile ?? "INTELLIGENCE",
      default_stage: presentation.default_stage ?? stages[0].id
    }),
    document
  });
}

/** Evidence-class histogram — what a scene is actually made of. */
export function evidenceProfile(scene) {
  const counts = Object.fromEntries(EVIDENCE_CLASSES.map(name => [name, 0]));
  for (const element of scene.elements) counts[element.evidence_class] += 1;
  return Object.freeze(counts);
}
