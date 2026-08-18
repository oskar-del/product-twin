/**
 * Solar position study.
 *
 * The Svärtinge viewer moved its sun on a hand-fitted arc (azimuth 70°→290° linear, altitude a
 * sine capped at 54°). That is close enough to look right and wrong enough to never be a claim.
 * This module computes the real thing — NOAA's low-precision solar position — so "sun on this
 * terrace at 08:00 in March" is DERIVED from a stated method rather than eyeballed.
 *
 * Accuracy of the underlying series: declination to ~0.01°, position to ~0.1° for years around
 * 2000–2100. Good enough for shading and sun-hours; not an ephemeris.
 *
 * Pure module: no DOM, no WebGL.
 */

const toRadians = degrees => degrees * Math.PI / 180;
const toDegrees = radians => radians * 180 / Math.PI;

function finite(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number`);
  return value;
}

/** Julian day number for a UTC calendar date at 00:00. */
export function julianDay({year, month, day}) {
  const y = month <= 2 ? year - 1 : year;
  const m = month <= 2 ? month + 12 : month;
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

export function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) throw new TypeError(`date must be YYYY-MM-DD — received ${JSON.stringify(value)}`);
  return {year: Number(match[1]), month: Number(match[2]), day: Number(match[3])};
}

/**
 * Solar azimuth (degrees clockwise from true north) and altitude (degrees above horizon).
 *
 * @param {object} input
 * @param {number} input.latitude   degrees north
 * @param {number} input.longitude  degrees east
 * @param {string} input.date       YYYY-MM-DD (UTC calendar date)
 * @param {number} input.utcHour    hour of day in UTC, may be fractional
 */
export function solarPosition({latitude, longitude, date, utcHour}) {
  finite(latitude, "latitude");
  finite(longitude, "longitude");
  finite(utcHour, "utcHour");
  if (latitude < -90 || latitude > 90) throw new RangeError("latitude out of range");

  const days = julianDay(parseIsoDate(date)) + utcHour / 24 - 2451545;
  const meanLongitude = (280.46 + 0.9856474 * days) % 360;
  const meanAnomaly = toRadians((357.528 + 0.9856003 * days) % 360);
  const eclipticLongitude = toRadians(
    meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)
  );
  const obliquity = toRadians(23.439 - 0.0000004 * days);

  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude)
  );

  const greenwichSiderealHours = (18.697374558 + 24.06570982441908 * days) % 24;
  const localSiderealDegrees = (greenwichSiderealHours + 24) % 24 * 15 + longitude;
  const hourAngle = toRadians(((localSiderealDegrees - toDegrees(rightAscension)) % 360 + 540) % 360 - 180);

  const phi = toRadians(latitude);
  const sinAltitude =
    Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAltitude)));
  const azimuth = Math.atan2(
    -Math.sin(hourAngle) * Math.cos(declination),
    Math.sin(declination) * Math.cos(phi) - Math.cos(declination) * Math.sin(phi) * Math.cos(hourAngle)
  );

  return Object.freeze({
    azimuth_deg: (toDegrees(azimuth) + 360) % 360,
    altitude_deg: toDegrees(altitude),
    declination_deg: toDegrees(declination),
    hour_angle_deg: toDegrees(hourAngle),
    above_horizon: altitude > 0
  });
}

/**
 * Unit direction vector towards the sun in the scene's local frame
 * (x = east, y = up, z = north). Returns null below the horizon.
 */
export function solarDirection(input) {
  const {azimuth_deg, altitude_deg, above_horizon} = solarPosition(input);
  if (!above_horizon) return null;
  const azimuth = toRadians(azimuth_deg);
  const altitude = toRadians(altitude_deg);
  const horizontal = Math.cos(altitude);
  return Object.freeze([
    horizontal * Math.sin(azimuth),
    Math.sin(altitude),
    horizontal * Math.cos(azimuth)
  ]);
}

/**
 * Light rig for a stage: sun position at `distance` metres, plus an intensity that fades with
 * altitude so dusk reads as dusk. Returns null when the sun is down — callers decide what a
 * night scene looks like; the engine does not invent light.
 */
export function sunLightRig({distance = 150, peakIntensity = 3, ...input}) {
  const direction = solarDirection(input);
  if (!direction) return null;
  const {altitude_deg, azimuth_deg} = solarPosition(input);
  return Object.freeze({
    position: Object.freeze(direction.map(component => component * distance)),
    intensity: Number((peakIntensity * Math.max(0.08, Math.sin(toRadians(altitude_deg)))).toFixed(4)),
    altitude_deg,
    azimuth_deg
  });
}

/**
 * Local clock hour → UTC hour. A scene may declare its offset; when it does not, the offset is
 * derived from longitude and MUST be disclosed as a limitation by the caller.
 */
export function localHourToUtc({hour, utcOffsetHours, longitude}) {
  finite(hour, "hour");
  const offset = utcOffsetHours ?? Math.round(finite(longitude, "longitude") / 15);
  return {utcHour: hour - offset, utc_offset_hours: offset, offset_source: utcOffsetHours == null ? "DERIVED_FROM_LONGITUDE" : "SCENE_DECLARED"};
}
