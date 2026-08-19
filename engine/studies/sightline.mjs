/**
 * Sightlines: is there anything between these two points?
 *
 * "From the terrace of villa A you can see villa B's roof, 34 m away" is the kind of sentence a
 * buyer actually cares about and no brochure can be trusted on. This computes it: a ray, the
 * real geometry, and a named blocker when the answer is no.
 *
 * Every result carries its own method and limitations, because a sightline against a twin is a
 * claim about the MODEL — vegetation, fences and anything not in the scene cannot block a ray
 * that does not know they exist.
 */
import {vec3} from "./geometry-queries.mjs";

const toDegrees = radians => radians * 180 / Math.PI;

/**
 * @param {object} options
 * @param {object} options.index    from createGeometryIndex
 * @param {number[]} options.from   [x, y, z] observer, y = eye height in scene metres
 * @param {number[]} options.to     [x, y, z] target
 * @param {string[]} [options.ignoreElementIds] elements the ray passes through — normally the
 *        two things being related, since standing on a terrace should not be blocked by it
 */
export function sightline({index, from, to, ignoreElementIds = []}) {
  const origin = vec3(from);
  const target = vec3(to);
  const delta = target.clone().sub(origin);
  const distance = delta.length();
  if (distance === 0) throw new RangeError("sightline endpoints coincide");

  const hit = index.cast(origin, delta, distance - 1e-4, new Set(ignoreElementIds));
  const horizontal = Math.hypot(delta.x, delta.z);

  return Object.freeze({
    visible: hit === null,
    distance_m: Number(distance.toFixed(3)),
    horizontal_distance_m: Number(horizontal.toFixed(3)),
    bearing_deg: Number(((toDegrees(Math.atan2(delta.x, delta.z)) + 360) % 360).toFixed(2)),
    elevation_deg: Number(toDegrees(Math.atan2(delta.y, horizontal)).toFixed(2)),
    blocked_by: hit ? {element_id: hit.element.id, label: hit.element.label, type: hit.element.type, at_m: Number(hit.distance_m.toFixed(3))} : null,
    evidence_class: "DERIVED",
    method: "RAY_INTERSECTION_AGAINST_SCENE_GEOMETRY",
    limitations: Object.freeze([
      "Computed against the twin's geometry only: vegetation, fences, vehicles and anything not modelled cannot block this ray.",
      "Each end point is a single point, not a window or a person; a view that is open at eye height may be blocked a metre lower.",
      ...(hit ? [] : ["No blocker was found in the model. That is not the same as a confirmed open view on site."])
    ])
  });
}

/** Every pairwise relation between a set of named observation points. */
export function sightlineMatrix({index, points}) {
  const results = [];
  for (const a of points) {
    for (const b of points) {
      if (a.id === b.id) continue;
      results.push({
        from: a.id,
        to: b.id,
        ...sightline({index, from: a.position, to: b.position, ignoreElementIds: [a.element_id, b.element_id].filter(Boolean)})
      });
    }
  }
  return results;
}
