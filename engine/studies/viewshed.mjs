/**
 * Viewshed: what can you actually see from here?
 *
 * The measured answer to the single most-asked and least-verified question in property. A
 * listing says "sea views"; this says "the horizon is clear to 2.1° between south-west and
 * north-west, 71 % open sky, and the thing blocking the east is the neighbouring building".
 *
 * Method: sweep the compass, and for each azimuth find the lowest elevation angle at which the
 * view gets out. That angle IS the horizon in that direction, and everything above it is sky.
 *
 * Runs headless like the other studies, so a view certificate can be regenerated on a build
 * server rather than trusted from a screenshot.
 */
import {vec3} from "./geometry-queries.mjs";

const toRadians = degrees => degrees * Math.PI / 180;
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** Direction vector for a compass azimuth (clockwise from north) and elevation, both degrees. */
function directionFor(azimuthDeg, elevationDeg) {
  const azimuth = toRadians(azimuthDeg);
  const elevation = toRadians(elevationDeg);
  const horizontal = Math.cos(elevation);
  return [horizontal * Math.sin(azimuth), Math.sin(elevation), horizontal * Math.cos(azimuth)];
}

/**
 * Lowest unobstructed elevation angle along one azimuth, by bisection.
 *
 * Assumes that if the view is blocked at an angle it may open up higher — true for terrain and
 * buildings, false under an overhang or a balcony above you. That assumption is stated in the
 * result's limitations rather than hidden.
 */
function horizonAlong({index, origin, azimuthDeg, minElevationDeg, maxElevationDeg, maxDistance, ignore, iterations}) {
  const blockedAt = elevationDeg => index.cast(origin, vec3(directionFor(azimuthDeg, elevationDeg)), maxDistance, ignore);

  const top = blockedAt(maxElevationDeg);
  if (top) return {elevation_deg: maxElevationDeg, open: false, blocked_by: top.element};

  const lowest = blockedAt(minElevationDeg);
  if (!lowest) return {elevation_deg: minElevationDeg, open: true, blocked_by: null};

  let low = minElevationDeg;
  let high = maxElevationDeg;
  let blocker = lowest.element;
  for (let i = 0; i < iterations; i += 1) {
    const mid = (low + high) / 2;
    const hit = blockedAt(mid);
    if (hit) { low = mid; blocker = hit.element; } else { high = mid; }
  }
  return {elevation_deg: high, open: true, blocked_by: blocker};
}

/**
 * @param {object} options
 * @param {object} options.index    from createGeometryIndex
 * @param {number[]} options.from   [x, y, z] observer, y = eye height in scene metres
 * @param {number} [options.rays]         azimuth samples around the compass
 * @param {number} [options.maxDistanceM] how far to look before calling it open sky
 * @param {string[]} [options.ignoreElementIds] usually whatever the observer is standing on
 */
export function viewshed({
  index,
  from,
  rays = 180,
  maxDistanceM = 4000,
  minElevationDeg = -15,
  maxElevationDeg = 60,
  iterations = 9,
  ignoreElementIds = []
}) {
  if (!Number.isInteger(rays) || rays < 8) throw new RangeError("rays must be an integer of at least 8");
  if (minElevationDeg >= maxElevationDeg) throw new RangeError("minElevationDeg must be below maxElevationDeg");
  const origin = vec3(from);
  const ignore = new Set(ignoreElementIds);

  const horizon = [];
  const blockers = new Map();
  for (let i = 0; i < rays; i += 1) {
    const azimuthDeg = (i * 360) / rays;
    const result = horizonAlong({
      index, origin, azimuthDeg, minElevationDeg, maxElevationDeg, maxDistance: maxDistanceM, ignore, iterations
    });
    horizon.push({
      azimuth_deg: Number(azimuthDeg.toFixed(2)),
      horizon_elevation_deg: Number(result.elevation_deg.toFixed(2)),
      open: result.open,
      blocked_by: result.blocked_by?.id ?? null
    });
    if (result.blocked_by) {
      const entry = blockers.get(result.blocked_by.id) ?? {element_id: result.blocked_by.id, label: result.blocked_by.label, azimuths: 0};
      entry.azimuths += 1;
      blockers.set(result.blocked_by.id, entry);
    }
  }

  // Fraction of the sky hemisphere above the horizon. For one azimuth slice the solid angle
  // above elevation h is (1 − sin h) dφ, and a full hemisphere is 2π — so the fraction is the
  // mean of (1 − sin h) over azimuth, clamped for horizons that dip below level.
  //
  // An azimuth still blocked at the top of the search contributes ZERO, not (1 − sin(max)):
  // its horizon is somewhere between the ceiling and straight up and we did not look, so
  // crediting it with the sky above the ceiling would invent a view. Enclosed points must read
  // as enclosed.
  const unresolved = horizon.filter(sample => !sample.open).length;
  const openSkyFraction = horizon.reduce(
    (sum, sample) => sum + (sample.open ? Math.max(0, 1 - Math.sin(toRadians(Math.max(0, sample.horizon_elevation_deg)))) : 0),
    0
  ) / horizon.length;

  const sectors = COMPASS.map((name, sectorIndex) => {
    const centre = sectorIndex * 45;
    const inSector = horizon.filter(sample => {
      const delta = Math.abs(((sample.azimuth_deg - centre + 540) % 360) - 180);
      return 180 - delta <= 22.5;
    });
    const elevations = inSector.map(sample => Math.max(0, sample.horizon_elevation_deg));
    return {
      sector: name,
      mean_horizon_deg: Number((elevations.reduce((sum, value) => sum + value, 0) / (elevations.length || 1)).toFixed(2)),
      max_horizon_deg: Number(Math.max(0, ...elevations).toFixed(2)),
      fully_open: inSector.every(sample => sample.blocked_by === null)
    };
  });

  const clearSectors = sectors.filter(sector => sector.max_horizon_deg < 2);

  return Object.freeze({
    observer: Object.freeze([...from]),
    rays,
    open_sky_fraction: Number(openSkyFraction.toFixed(4)),
    unresolved_azimuths: unresolved,
    mean_horizon_deg: Number((horizon.reduce((sum, sample) => sum + Math.max(0, sample.horizon_elevation_deg), 0) / horizon.length).toFixed(2)),
    max_horizon_deg: Number(Math.max(...horizon.map(sample => sample.horizon_elevation_deg)).toFixed(2)),
    max_horizon_is_capped: unresolved > 0,
    clear_sectors: clearSectors.map(sector => sector.sector),
    sectors,
    principal_blockers: [...blockers.values()]
      .sort((a, b) => b.azimuths - a.azimuths)
      .map(blocker => ({...blocker, share_of_compass: Number((blocker.azimuths / rays).toFixed(3))})),
    horizon,
    evidence_class: "DERIVED",
    method: `COMPASS_SWEEP_${rays}_RAYS_BISECTED_${iterations}_STEPS_TO_${maxDistanceM}M`,
    limitations: Object.freeze([
      `Swept at ${(360 / rays).toFixed(1)}° intervals from a single point at ${from[1].toFixed(2)} m in the scene's own height frame; a narrow gap between two obstructions can fall between samples.`,
      "Only modelled geometry blocks the view: trees, walls, parked vehicles, and anything outside the scene do not.",
      "The horizon search assumes that a view blocked at one angle may open above it — it does not correctly describe an overhang, balcony or canopy directly above the observer.",
      `Nothing beyond ${maxDistanceM} m is treated as an obstruction, so distant land, sea or mountains are counted as open sky.`,
      "This describes what geometry permits, not what is worth looking at.",
      ...(unresolved
        ? [`${unresolved} of ${rays} directions were still blocked at ${maxElevationDeg}° above level, the top of the search. Their horizon is somewhere higher and was not resolved; they are counted as no sky rather than guessed.`]
        : [])
    ])
  });
}
