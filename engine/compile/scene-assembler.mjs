/**
 * Assemble a twin-scene v0.1 document.
 *
 * The last mile between "we have spatial evidence about a site" and "the engine can render it".
 * Site adapters do the joins only they can do — which elevation sample belongs to which parcel,
 * which parcel the developer means by Villa 3 — and hand the results here. This module owns the
 * parts no site should re-invent: scene envelope, camera framing from real extents, and the
 * refusal to return anything the engine would not accept.
 *
 * It never invents evidence. Every element must arrive with its own evidence class, sources and
 * limitations; the assembler will not default them.
 *
 * Pure module: no DOM, no WebGL.
 */

import {parseScene} from "../core/scene-contract.mjs";
import {extentsOf} from "../core/extents.mjs";
import {ringAreaM2} from "./geo-polygons.mjs";

export {extentsOf} from "../core/extents.mjs";

const EVIDENCE_CLASSES = ["AUTHORITATIVE", "INDICATIVE", "DERIVED", "REPORTED_UNVERIFIED", "CONCEPT"];

function requireField(value, label) {
  if (value === undefined || value === null || value === "") throw new TypeError(`${label} is required`);
  return value;
}

export function frameCamera({centre, radius, fovDeg = 45, bearingDeg = 215, elevationDeg = 32, padding = 1.05}) {
  const distance = (radius * padding) / Math.tan((fovDeg / 2) * Math.PI / 180);
  const bearing = bearingDeg * Math.PI / 180;
  const elevation = elevationDeg * Math.PI / 180;
  const horizontal = distance * Math.cos(elevation);
  return Object.freeze([
    Number((centre[0] + horizontal * Math.sin(bearing)).toFixed(3)),
    Number((distance * Math.sin(elevation)).toFixed(3)),
    Number((centre[1] + horizontal * Math.cos(bearing)).toFixed(3))
  ]);
}

/**
 * Derive navigation stages from the geometry itself, so a scene's cameras can never point at
 * where a building used to be.
 *
 * @param {Array} elements
 * @param {Array<{id, label, types, focus_element_id, elevation_deg, bearing_deg, cutaway, labels}>} plan
 */
export function deriveNavigation({elements, plan}) {
  return plan.map(stage => {
    const types = new Set(stage.types);
    const inStage = elements.filter(element => types.has(element.type));
    if (!inStage.length) throw new RangeError(`stage ${stage.id} has no elements of types ${[...types].join(", ")}`);
    const focus = stage.focus_element_id
      ? elements.find(element => element.id === stage.focus_element_id)
      : null;
    if (stage.focus_element_id && !focus) throw new RangeError(`stage ${stage.id} focuses unknown element ${stage.focus_element_id}`);
    const extents = extentsOf(focus ? [focus] : inStage);
    const target = [Number(extents.centre[0].toFixed(3)), stage.target_y ?? 0, Number(extents.centre[1].toFixed(3))];
    return {
      id: stage.id,
      label: stage.label,
      camera: [...frameCamera({
        centre: extents.centre,
        radius: extents.radius_m,
        bearingDeg: stage.bearing_deg,
        elevationDeg: stage.elevation_deg
      })],
      target,
      visible_groups: [...types],
      cutaway: stage.cutaway ?? false,
      ...(stage.labels === undefined ? {} : {labels: stage.labels}),
      ...(stage.open_element_id ? {on_enter_open_element: stage.open_element_id} : {})
    };
  });
}

/**
 * Build and validate a twin-scene document.
 * @throws {SceneContractError} if the assembled scene is not renderable.
 */
export function assembleScene({
  sceneId,
  sceneVersion = "twin-scene/v0.1",
  entityType = "SiteSceneExport",
  generatedAt,
  subject,
  originWgs84,
  horizontalReference,
  verticalReference = "LOCAL_RELATIVE_UNCALIBRATED",
  coordinateLimitations,
  sourceBindings,
  legalClaimPolicy,
  elements,
  navigationPlan,
  navigation,
  studies,
  presentation,
  extra = {}
}) {
  requireField(sceneId, "sceneId");
  requireField(generatedAt, "generatedAt");
  requireField(subject, "subject");
  requireField(originWgs84, "originWgs84");
  requireField(legalClaimPolicy, "legalClaimPolicy");
  if (!Array.isArray(elements) || !elements.length) throw new TypeError("elements must be a non-empty array");
  if (!Array.isArray(sourceBindings) || !sourceBindings.length) {
    throw new TypeError("sourceBindings must record at least one source: an unsourced scene is not publishable");
  }
  for (const [index, element] of elements.entries()) {
    if (!EVIDENCE_CLASSES.includes(element?.evidence_class)) {
      throw new TypeError(`elements[${index}] (${element?.id}) must declare an evidence class — the assembler will not guess one`);
    }
    if (!element.source_refs?.length) throw new TypeError(`elements[${index}] (${element.id}) must name its sources`);
    if (!Array.isArray(element.limitations)) throw new TypeError(`elements[${index}] (${element.id}) must state its limitations`);
  }

  const stages = navigation ?? deriveNavigation({elements, plan: requireField(navigationPlan, "navigationPlan or navigation")});

  const document = {
    scene_version: sceneVersion,
    entity_type: entityType,
    scene_id: sceneId,
    generated_at: generatedAt,
    subject,
    coordinate_system: {
      frame: "LOCAL_ENU",
      axes: {x: "EAST", y: "UP", z: "NORTH"},
      origin_wgs84: [...originWgs84],
      horizontal_reference: horizontalReference ?? "EPSG:4326 origin",
      vertical_reference: verticalReference,
      linear_units: "metre",
      evidence_class: subject.identity_evidence_class ?? "DERIVED",
      limitations: coordinateLimitations ?? [
        "Local east/up/north frame anchored on the scene origin; not survey control.",
        "Heights are relative to the scene's own datum unless an element states otherwise."
      ]
    },
    source_bindings: sourceBindings,
    evidence_classes: [...EVIDENCE_CLASSES],
    legal_claim_policy: legalClaimPolicy,
    navigation: stages,
    elements,
    ...(studies ? {studies} : {}),
    presentation: presentation ?? {
      profiles: ["INTELLIGENCE", "REALISTIC", "COMPARE"],
      default_profile: "INTELLIGENCE",
      default_stage: stages[0].id
    },
    ...extra
  };

  // Refuse here, not at render time: a compiler that emits a scene the engine rejects has just
  // moved the failure somewhere less convenient.
  const parsed = parseScene(document);
  return Object.freeze({document, scene: parsed, extents: extentsOf(elements)});
}

/** Convenience: a plot/parcel element from a projected ring. */
export function parcelElement({id, label, type = "PLOT", evidenceClass, ring, heightM = 0.3, baseY = 0, areaM2, sourceRefs, limitations}) {
  return {
    id,
    type,
    label,
    evidence_class: evidenceClass,
    geometry: {
      primitive: "EXTRUDED_POLYGON",
      points_xz: ring.map(([x, z]) => [Number(x.toFixed(3)), Number(z.toFixed(3))]),
      height: heightM,
      base_y: baseY,
      area_m2: Number((areaM2 ?? Math.abs(ringAreaM2(ring))).toFixed(1))
    },
    source_refs: sourceRefs,
    limitations
  };
}
