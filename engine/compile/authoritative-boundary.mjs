/**
 * Authoritative property boundary → scene element.
 *
 * Takes a GeoJSON polygon from a land registry (Lantmäteriet, Catastro, Land Registry)
 * and produces a PROPERTY_BOUNDARY scene element with AUTHORITATIVE evidence class.
 * The element renders as a thin raised polygon overlay — a transparent coloured slab with
 * a strong edge, so the boundary reads as a claim about where the legal line sits without
 * obscuring what's under it.
 *
 * The boundary element carries the registry's own stated area for cross-checking, the
 * registry's object identifier for traceability, and limitations stating what the boundary
 * represents and what it doesn't.
 *
 * Pure module: no DOM, no WebGL.
 */

import {projectFeature, checkStatedArea} from "./geo-polygons.mjs";
import {sampleHeightAt} from "./terrain-interpolation.mjs";

/**
 * @param {object} options
 * @param {object} options.feature         GeoJSON Feature (Polygon/MultiPolygon) in WGS84
 * @param {[number,number]} options.originWgs84  scene origin [lon, lat]
 * @param {string} options.designation     property designation, e.g. "SVÄRTINGE 54:28"
 * @param {number} [options.statedAreaM2]  registry's stated area for cross-check
 * @param {string} options.registrySource  e.g. "Lantmäteriet Fastighetsindelning vektor"
 * @param {string} [options.registryId]    objektidentitet or similar
 * @param {string} [options.lastUpdated]   registry's senastandrad/last modified
 * @param {Array<{x,z,elevation}>} [options.terrainSamples]  for draping on terrain
 * @param {number} [options.datum]         terrain datum
 * @param {number} [options.areaTolerance] fraction drift allowed (default 0.02)
 * @returns {{element: object, areaCheck: object, limitations: string[]}}
 */
export function compileAuthoritativeBoundary({
  feature,
  originWgs84,
  designation,
  statedAreaM2,
  registrySource,
  registryId,
  lastUpdated,
  terrainSamples = null,
  datum,
  areaTolerance = 0.02
}) {
  if (!designation) throw new TypeError("designation is required");
  if (!registrySource) throw new TypeError("registrySource is required");

  const projected = projectFeature({feature, originWgs84});
  const areaCheck = statedAreaM2 != null
    ? checkStatedArea({projected, statedAreaM2, tolerance: areaTolerance})
    : {checked: false, reason: "no stated area provided"};

  let baseY = 0;
  if (terrainSamples && terrainSamples.length >= 3) {
    // Drape at highest boundary point, same strategy as parcels — the uphill half must
    // not disappear under terrain.
    let maxHeight = -Infinity;
    for (const [x, z] of projected.ring) {
      const sample = sampleHeightAt({samples: terrainSamples, x, z, datum});
      if (sample.height > maxHeight) maxHeight = sample.height;
    }
    baseY = Number(maxHeight.toFixed(3));
  }

  const limitations = [
    `Authoritative boundary from ${registrySource}${lastUpdated ? ` (last updated ${lastUpdated})` : ""}.`,
    "Represents the registered property extent, not a field survey; positional accuracy depends on the registry's source data.",
    ...(areaCheck.checked && !areaCheck.within_tolerance
      ? [`⚠ Projected area ${areaCheck.computed_m2} m² differs from stated ${areaCheck.stated_m2} m² by ${(areaCheck.drift * 100).toFixed(1)}% — exceeds ${(areaTolerance * 100).toFixed(0)}% tolerance.`]
      : []),
    ...(areaCheck.checked && areaCheck.within_tolerance
      ? [`Projected area ${areaCheck.computed_m2} m² within ${(areaTolerance * 100).toFixed(0)}% of stated ${areaCheck.stated_m2} m².`]
      : [])
  ];

  const id = `boundary-${designation.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  const element = {
    id,
    type: "PROPERTY_BOUNDARY",
    label: designation,
    evidence_class: "AUTHORITATIVE",
    geometry: {
      primitive: "EXTRUDED_POLYGON",
      points_xz: projected.ring.map(([x, z]) => [Number(x.toFixed(3)), Number(z.toFixed(3))]),
      height: 0.15,
      base_y: baseY,
      area_m2: Number(projected.area_m2.toFixed(1))
    },
    source_refs: [
      registrySource,
      ...(registryId ? [`registry object ${registryId}`] : []),
      ...(lastUpdated ? [`last updated ${lastUpdated}`] : [])
    ],
    limitations
  };

  return Object.freeze({element, areaCheck, projected, limitations: Object.freeze(limitations)});
}
