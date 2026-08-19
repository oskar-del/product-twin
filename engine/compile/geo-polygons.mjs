/**
 * GeoJSON polygons → local ENU rings.
 *
 * Parcel boundaries arrive as WGS84 rings from a cadastre. The engine works in local metres, so
 * something has to project them — and that something must also CHECK itself: a ring whose
 * computed area disagrees with the area the authority states for that parcel is a projection
 * bug, a wrong parcel, or a wrong datum, and all three are silent failures that produce a
 * confident-looking wrong picture.
 *
 * Pure module: no DOM, no WebGL.
 */

import {wgs84ToLocal, assertLonLat} from "../geo/local-enu.mjs";

/**
 * Twice the signed area of a closed ring, by the cross-product (shoelace) sum.
 * Kept private so area and centroid can never be computed with two different sign conventions —
 * which is exactly the bug that put parcel centroids on the wrong side of the origin.
 */
function twiceSignedArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return sum;
}

/** Signed area of a closed ring in local metres. Positive = counter-clockwise in the x/z plane. */
export function ringAreaM2(ring) {
  return twiceSignedArea(ring) / 2;
}

export function ringCentroid(ring) {
  const twiceArea = twiceSignedArea(ring);
  if (Math.abs(twiceArea) < 1e-9) {
    const sum = ring.reduce((acc, [x, z]) => [acc[0] + x, acc[1] + z], [0, 0]);
    return [sum[0] / ring.length, sum[1] / ring.length];
  }
  let x = 0;
  let z = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    x += (ring[j][0] + ring[i][0]) * cross;
    z += (ring[j][1] + ring[i][1]) * cross;
  }
  return [x / (3 * twiceArea), z / (3 * twiceArea)];
}

/** Mean of a set of WGS84 positions — used to pick a scene origin from a cluster of parcels. */
export function meanLonLat(positions) {
  if (!positions.length) throw new RangeError("meanLonLat requires at least one position");
  const sum = positions.map(position => assertLonLat(position)).reduce(
    (acc, [longitude, latitude]) => [acc[0] + longitude, acc[1] + latitude],
    [0, 0]
  );
  return [sum[0] / positions.length, sum[1] / positions.length];
}

/** Drop the duplicated closing vertex GeoJSON rings carry; the engine closes shapes itself. */
function openRing(ring) {
  const last = ring.at(-1);
  const first = ring[0];
  return last && first && last[0] === first[0] && last[1] === first[1] ? ring.slice(0, -1) : ring;
}

/**
 * Project one GeoJSON Polygon / MultiPolygon feature into local ENU.
 *
 * @returns {{ring: number[][], area_m2: number, centroid_xz: number[], centroid_wgs84: number[]}}
 */
export function projectFeature({feature, originWgs84}) {
  const geometry = feature?.geometry;
  if (!geometry) throw new TypeError("feature has no geometry");
  let coordinates;
  if (geometry.type === "Polygon") coordinates = geometry.coordinates[0];
  else if (geometry.type === "MultiPolygon") {
    // Largest part wins: a cadastral parcel split by a path is still one parcel.
    coordinates = geometry.coordinates
      .map(part => part[0])
      .reduce((best, part) => {
        const ring = openRing(part).map(position => wgs84ToLocal({originWgs84, lonLat: position}));
        return Math.abs(ringAreaM2(ring)) > (best.area ?? -1) ? {part, area: Math.abs(ringAreaM2(ring))} : best;
      }, {}).part;
  } else throw new TypeError(`unsupported geometry type ${geometry.type}`);

  const ring = openRing(coordinates).map(position => wgs84ToLocal({originWgs84, lonLat: position}));
  if (ring.length < 3) throw new RangeError("projected ring has fewer than 3 vertices");
  const area = Math.abs(ringAreaM2(ring));
  const centroid = ringCentroid(ring);
  return Object.freeze({
    ring: ring.map(point => Object.freeze([...point])),
    area_m2: area,
    centroid_xz: Object.freeze(centroid),
    centroid_wgs84: Object.freeze(openRing(coordinates).reduce(
      (acc, position, index, all) => index === all.length - 1
        ? [(acc[0] + position[0]) / all.length, (acc[1] + position[1]) / all.length]
        : [acc[0] + position[0], acc[1] + position[1]],
      [0, 0]
    ))
  });
}

/**
 * Cross-check a projected ring against the area its authority states.
 * A disagreement above `tolerance` (fraction) is returned, not thrown — the caller decides
 * whether a 2 % cadastral rounding is acceptable and a 40 % gap is a wrong parcel.
 */
export function checkStatedArea({projected, statedAreaM2, tolerance = 0.05}) {
  if (!Number.isFinite(statedAreaM2) || statedAreaM2 <= 0) {
    return Object.freeze({checked: false, reason: "no stated area to check against"});
  }
  const drift = Math.abs(projected.area_m2 - statedAreaM2) / statedAreaM2;
  return Object.freeze({
    checked: true,
    computed_m2: Number(projected.area_m2.toFixed(1)),
    stated_m2: statedAreaM2,
    drift,
    within_tolerance: drift <= tolerance,
    tolerance
  });
}
