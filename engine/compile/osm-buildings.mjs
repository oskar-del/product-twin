/**
 * OSM building footprints → CONTEXT_BUILDING scene elements.
 *
 * Overpass or a GeoJSON extract hands us building polygons with optional height tags. This
 * turns them into scene elements the engine can render as neighbourhood context — the buildings
 * the subject sits among, not the subject itself.
 *
 * Heights: OSM `building:levels` × 3 m, or `height` tag, or a default 7 m (two-storey
 * residential). Every height carries REPORTED_UNVERIFIED because OSM building heights are
 * crowd-sourced estimates, not survey data.
 *
 * Pure module: no DOM, no WebGL.
 */

import {projectFeature, ringCentroid, ringAreaM2} from "./geo-polygons.mjs";
import {sampleHeightAt} from "./terrain-interpolation.mjs";

const DEFAULT_FLOOR_HEIGHT_M = 3;
const DEFAULT_BUILDING_HEIGHT_M = 7;
const MIN_FOOTPRINT_M2 = 8;

function estimateHeight(properties) {
  if (typeof properties?.height === "number" && properties.height > 0) {
    return {height_m: properties.height, method: "osm:height"};
  }
  if (typeof properties?.["building:height"] === "number" && properties["building:height"] > 0) {
    return {height_m: properties["building:height"], method: "osm:building:height"};
  }
  const heightStr = String(properties?.height ?? "");
  const parsed = parseFloat(heightStr);
  if (Number.isFinite(parsed) && parsed > 0) {
    return {height_m: parsed, method: "osm:height"};
  }
  const levels = parseInt(String(properties?.["building:levels"] ?? ""), 10);
  if (Number.isFinite(levels) && levels > 0) {
    return {height_m: levels * DEFAULT_FLOOR_HEIGHT_M, method: `osm:building:levels×${DEFAULT_FLOOR_HEIGHT_M}m`};
  }
  return {height_m: DEFAULT_BUILDING_HEIGHT_M, method: `default_${DEFAULT_BUILDING_HEIGHT_M}m`};
}

/**
 * @param {object} options
 * @param {Array<object>} options.features  GeoJSON Feature[] with Polygon/MultiPolygon geometry
 * @param {[number,number]} options.originWgs84  scene origin [lon, lat]
 * @param {Array<{x:number,z:number,elevation:number}>} [options.terrainSamples]  for ground draping
 * @param {number} [options.datum]  terrain datum for height sampling
 * @param {number} [options.maxBuildings]  clip to N nearest to origin (perf budget)
 * @param {number} [options.minFootprintM2]  skip small sheds
 * @param {string[]} options.sourceRefs  e.g. ["OpenStreetMap contributors, ODbL"]
 * @returns {{elements: object[], skipped: number, limitations: string[]}}
 */
export function compileOsmBuildings({
  features,
  originWgs84,
  terrainSamples = null,
  datum,
  maxBuildings = 500,
  minFootprintM2 = MIN_FOOTPRINT_M2,
  sourceRefs
}) {
  if (!Array.isArray(features) || !features.length) {
    throw new TypeError("features must be a non-empty array of GeoJSON features");
  }
  if (!Array.isArray(sourceRefs) || !sourceRefs.length) {
    throw new TypeError("sourceRefs must name the data source");
  }

  const projected = [];
  let parseErrors = 0;

  for (const feature of features) {
    try {
      const result = projectFeature({feature, originWgs84});
      if (result.area_m2 < minFootprintM2) continue;
      const {height_m, method} = estimateHeight(feature.properties);
      const centroid = ringCentroid(result.ring);
      const distanceFromOrigin = Math.hypot(centroid[0], centroid[1]);
      projected.push({
        ring: result.ring,
        area_m2: result.area_m2,
        centroid,
        distanceFromOrigin,
        height_m,
        height_method: method,
        osmId: feature.properties?.["@id"] ?? feature.id ?? null
      });
    } catch {
      parseErrors += 1;
    }
  }

  projected.sort((a, b) => a.distanceFromOrigin - b.distanceFromOrigin);
  const selected = projected.slice(0, maxBuildings);
  const skipped = projected.length - selected.length;

  const elements = selected.map((building, index) => {
    let baseY = 0;
    if (terrainSamples && terrainSamples.length >= 3) {
      const sample = sampleHeightAt({
        samples: terrainSamples,
        x: building.centroid[0],
        z: building.centroid[1],
        datum
      });
      baseY = Number(sample.height.toFixed(3));
    }

    const id = building.osmId
      ? `ctx-osm-${String(building.osmId).replace(/\//g, "-")}`
      : `ctx-bldg-${index}`;

    return {
      id,
      type: "CONTEXT_BUILDING",
      label: `Building ${index + 1}`,
      evidence_class: "REPORTED_UNVERIFIED",
      geometry: {
        primitive: "EXTRUDED_POLYGON",
        points_xz: building.ring.map(([x, z]) => [Number(x.toFixed(2)), Number(z.toFixed(2))]),
        height: building.height_m,
        base_y: baseY,
        area_m2: Number(building.area_m2.toFixed(1))
      },
      source_refs: sourceRefs,
      limitations: [
        `Height ${building.height_m} m from ${building.height_method}; not surveyed.`,
        "Footprint from OpenStreetMap; may be outdated or simplified.",
        ...(baseY !== 0 ? [`Base draped on interpolated terrain at ${baseY.toFixed(2)} m.`] : [])
      ]
    };
  });

  const limitations = [
    `${selected.length} context buildings compiled from ${features.length} OSM features (${parseErrors} unparseable, ${projected.length - selected.length - parseErrors + parseErrors} below ${minFootprintM2} m² or beyond the ${maxBuildings}-building cap).`,
    "Heights are crowd-sourced estimates or defaults, not measured.",
    "Footprints are extruded vertically; real roofs, setbacks and overhangs are not represented."
  ];
  if (skipped > 0) {
    limitations.push(`${skipped} buildings beyond the ${maxBuildings}-building cap were dropped (furthest from origin first).`);
  }

  return Object.freeze({elements, skipped, parseErrors, limitations: Object.freeze(limitations)});
}
