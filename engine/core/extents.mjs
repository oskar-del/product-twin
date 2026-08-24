/**
 * Scene extents.
 *
 * How big is this twin, in metres? Used to frame cameras honestly at compile time and to scale
 * fog and clipping planes at render time. Both used to be hardcoded to the size of the first
 * site we built, which meant a bigger site rendered into fog and a smaller one had no depth
 * cue at all.
 *
 * Pure module: no DOM, no WebGL.
 */

/** Every ground-plane point an element occupies, in local metres. */
export function elementFootprint(element) {
  const geometry = element.geometry;
  switch (geometry.primitive) {
    case "GRID_SURFACE":
      return geometry.vertices.map(([x, , z]) => [x, z]);
    case "EXTRUDED_POLYGON":
      return geometry.points_xz.map(([x, z]) => [x, z]);
    case "POLYLINE_RIBBON":
      return geometry.points.map(([x, , z]) => [x, z]);
    case "BOX":
    case "ROOM_VOLUME": {
      const [width, , depth] = geometry.size;
      const [x, , z] = geometry.position;
      return [[x - width / 2, z - depth / 2], [x + width / 2, z + depth / 2]];
    }
    case "MARKER":
    case "DIAGRAMMATIC_MARKER":
      return [[geometry.position[0], geometry.position[2]]];
    case "DIRECTION_CONE":
      return [[geometry.origin[0], geometry.origin[2]]];
    default:
      return [];
  }
}

export function extentsOf(elements) {
  const points = elements.flatMap(elementFootprint);
  if (!points.length) throw new RangeError("cannot compute extents: no positioned elements");
  const xs = points.map(point => point[0]);
  const zs = points.map(point => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return Object.freeze({
    minX, maxX, minZ, maxZ,
    centre: Object.freeze([(minX + maxX) / 2, (minZ + maxZ) / 2]),
    radius_m: Math.max(Math.hypot(maxX - minX, maxZ - minZ) / 2, 1)
  });
}

/** Furthest a stage camera sits from what it is looking at. */
export function maxStageDistance(stages) {
  return stages.reduce((furthest, stage) => Math.max(furthest, Math.hypot(
    stage.camera[0] - stage.target[0],
    stage.camera[1] - stage.target[1],
    stage.camera[2] - stage.target[2]
  )), 0);
}

/**
 * Depth settings for a scene of this size.
 *
 * Derived from BOTH the geometry's radius and how far the scene's own cameras stand back,
 * because those can disagree: a wide site framed from far enough to see all of it will sit
 * beyond fog computed from radius alone, and render as haze. Calibrated so a 360 m site viewed
 * from ~270 m reproduces what the Svärtinge viewer was hand-tuned to (fog 260–620, far 1400).
 */
export function depthSettingsFor(radiusM, cameraDistanceM = 0) {
  const reference = Math.max(radiusM, cameraDistanceM);
  return Object.freeze({
    reference_m: reference,
    fogNear: Math.max(40, reference * 1.02),
    fogFar: Math.max(160, reference * 2.6),
    cameraFar: Math.max(400, reference * 5.5),
    cameraNear: 0.1,
    maxDistance: Math.max(120, reference * 2.4),
    shadowExtent: Math.max(60, radiusM * 0.75)
  });
}
