/**
 * Sun hours on a point, computed against the twin's geometry.
 *
 * "The terrace gets sun from 11 until sunset in March" is a sentence that sells a property and
 * that nobody verifies. This verifies it: step through the day, put the sun where NOAA says it
 * is, and shoot a ray from the point towards it. If the ray hits the building next door, that
 * minute is not sunlit.
 *
 * Runs headless, so the number is re-derivable on a build server rather than remembered from a
 * screenshot.
 */
import {solarDirection, solarPosition, localHourToUtc} from "./sun.mjs";
import {vec3} from "./geometry-queries.mjs";

const RAY_LENGTH_M = 5000;

/**
 * @param {object} options
 * @param {object} options.index       from createGeometryIndex
 * @param {number[]} options.point     [x, y, z] in scene metres — lift it slightly off the
 *                                     surface it sits on, or that surface blocks its own sun
 * @param {number} options.latitude
 * @param {number} options.longitude
 * @param {string} options.date        YYYY-MM-DD
 * @param {number} [options.utcOffsetHours] scene-declared; derived from longitude when absent
 * @param {number} [options.stepMinutes]
 * @param {string[]} [options.ignoreElementIds] usually the element the point sits on
 */
export function sunHours({
  index,
  point,
  latitude,
  longitude,
  date,
  utcOffsetHours,
  stepMinutes = 10,
  ignoreElementIds = []
}) {
  if (!Number.isFinite(stepMinutes) || stepMinutes <= 0 || stepMinutes > 60) {
    throw new RangeError("stepMinutes must be within (0, 60]");
  }
  const origin = vec3(point);
  const ignore = new Set(ignoreElementIds);
  const stepHours = stepMinutes / 60;

  let daylightHours = 0;
  let sunlitHours = 0;
  const intervals = [];
  let open = null;
  let firstSun = null;
  let lastSun = null;

  for (let localHour = 0; localHour < 24; localHour += stepHours) {
    const {utcHour} = localHourToUtc({hour: localHour, utcOffsetHours, longitude});
    const position = solarPosition({latitude, longitude, date, utcHour});
    if (!position.above_horizon) {
      if (open) { intervals.push(open); open = null; }
      continue;
    }
    daylightHours += stepHours;

    const direction = solarDirection({latitude, longitude, date, utcHour});
    const blocked = index.cast(origin, vec3(direction), RAY_LENGTH_M, ignore);
    if (blocked) {
      if (open) { intervals.push(open); open = null; }
      continue;
    }

    sunlitHours += stepHours;
    firstSun ??= localHour;
    lastSun = localHour + stepHours;
    if (open) open.to = localHour + stepHours;
    else open = {from: localHour, to: localHour + stepHours};
  }
  if (open) intervals.push(open);

  const format = value => `${String(Math.floor(value)).padStart(2, "0")}:${String(Math.round((value % 1) * 60)).padStart(2, "0")}`;

  return Object.freeze({
    date,
    sunlit_hours: Number(sunlitHours.toFixed(2)),
    daylight_hours: Number(daylightHours.toFixed(2)),
    sunlit_fraction_of_daylight: daylightHours ? Number((sunlitHours / daylightHours).toFixed(3)) : 0,
    first_sun_local: firstSun === null ? null : format(firstSun),
    last_sun_local: lastSun === null ? null : format(lastSun),
    intervals: intervals.map(interval => Object.freeze({from: format(interval.from), to: format(interval.to)})),
    step_minutes: stepMinutes,
    evidence_class: "DERIVED",
    method: `NOAA_SOLAR_POSITION_WITH_RAY_OCCLUSION_${stepMinutes}MIN_STEPS`,
    limitations: Object.freeze([
      `Sampled every ${stepMinutes} minutes against the twin's geometry; shorter obstructions can fall between samples.`,
      "Only modelled geometry casts shade: trees, awnings, neighbouring buildings outside the scene and future construction do not.",
      "Clear-sky geometry only — no cloud, no atmospheric attenuation, no seasonal vegetation.",
      "A single point, not a surface: a terrace can be half in shade while its sample point is lit."
    ])
  });
}
