/**
 * Local ENU frame ↔ WGS84.
 *
 * Every twin scene is authored in a local East/Up/North metre frame with a WGS84 origin, so
 * geometry stays small, precise and projection-free. This module is the only place that
 * converts between that frame and the round earth — map overlays, per-plot geocoding and
 * live-context camera derivation all go through it.
 *
 * Deliberately site- and country-agnostic: no national grid, no projection guard. National
 * projections (SWEREF99 TM, ETRS89/UTM) belong in per-market modules that import this one.
 *
 * Pure module: no DOM, no WebGL.
 */

/**
 * Metres per degree, as a function of latitude, on the WGS84 ellipsoid.
 *
 * The flat constants this started with (110540 m/deg latitude, 111320·cos φ m/deg longitude)
 * are equator-ish values, and using them at 38.7°N under-read every Catastro parcel area by a
 * systematic ~0.6-0.7 % — small, but a bias in exactly the direction that makes a plot look
 * cheaper per m² than it is. These series are the standard WGS84 expansions, good to about a
 * centimetre per degree, and they remove the bias at every latitude we operate in.
 */
function metresPerDegreeLatitude(latitude) {
  const phi = toRadians(latitude);
  return 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi) - 0.0023 * Math.cos(6 * phi);
}

function metresPerDegreeLongitude(latitude) {
  const phi = toRadians(latitude);
  return 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi) + 0.118 * Math.cos(5 * phi);
}

const toRadians = degrees => degrees * Math.PI / 180;
const toDegrees = radians => radians * 180 / Math.PI;

function finite(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number`);
  return value;
}

export function assertLonLat(value, label = "lonLat") {
  if (!Array.isArray(value) || value.length !== 2) throw new TypeError(`${label} must be [longitude, latitude]`);
  const [longitude, latitude] = value.map((number, index) => finite(number, `${label}[${index}]`));
  if (longitude < -180 || longitude > 180) throw new RangeError(`${label} longitude out of range`);
  if (latitude < -90 || latitude > 90) throw new RangeError(`${label} latitude out of range`);
  return [longitude, latitude];
}

export function assertVec3(value, label = "vector") {
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError(`${label} must be [x, y, z]`);
  return value.map((number, index) => finite(number, `${label}[${index}]`));
}

/** Local east/north metres → WGS84 [lon, lat]. */
export function localToWgs84({originWgs84, eastNorthM}) {
  const [longitude, latitude] = assertLonLat(originWgs84, "originWgs84");
  if (!Array.isArray(eastNorthM) || eastNorthM.length !== 2) throw new TypeError("eastNorthM must be [east, north]");
  const [east, north] = eastNorthM.map((number, index) => finite(number, `eastNorthM[${index}]`));
  return Object.freeze([
    longitude + east / metresPerDegreeLongitude(latitude),
    latitude + north / metresPerDegreeLatitude(latitude)
  ]);
}

/** WGS84 [lon, lat] → local east/north metres, inverse of localToWgs84. */
export function wgs84ToLocal({originWgs84, lonLat}) {
  const [originLongitude, originLatitude] = assertLonLat(originWgs84, "originWgs84");
  const [longitude, latitude] = assertLonLat(lonLat, "lonLat");
  return Object.freeze([
    (longitude - originLongitude) * metresPerDegreeLongitude(originLatitude),
    (latitude - originLatitude) * metresPerDegreeLatitude(originLatitude)
  ]);
}

/** Scene position [x=east, y=up, z=north] → WGS84, ignoring height. */
export function scenePositionToWgs84({originWgs84, position}) {
  const [x, , z] = assertVec3(position, "position");
  return localToWgs84({originWgs84, eastNorthM: [x, z]});
}

/**
 * Derive a slippy-map camera (centre/zoom/pitch/bearing) from a scene camera keyframe, so a
 * live map layer can follow the twin's stages without ever affecting evidence.
 */
export function deriveMapView({originWgs84, camera, target, zoom}) {
  const cameraVector = assertVec3(camera, "camera");
  const targetVector = assertVec3(target, "target");
  const east = targetVector[0] - cameraVector[0];
  const north = targetVector[2] - cameraVector[2];
  const horizontal = Math.hypot(east, north);
  const vertical = Math.abs(cameraVector[1] - targetVector[1]);
  if (horizontal === 0 && vertical === 0) throw new RangeError("camera and target must not coincide");
  const bearing = (toDegrees(Math.atan2(east, north)) + 360) % 360;
  const pitch = Math.min(85, Math.max(0, 90 - toDegrees(Math.atan2(vertical, horizontal))));
  return Object.freeze({
    center_wgs84: scenePositionToWgs84({originWgs84, position: targetVector}),
    zoom: finite(zoom, "zoom"),
    pitch: Number(pitch.toFixed(4)),
    bearing: Number(bearing.toFixed(4)),
    synchronization: "LOCAL_EAST_UP_NORTH_STAGE_REFERENCE",
    evidence_effect: "NONE"
  });
}
