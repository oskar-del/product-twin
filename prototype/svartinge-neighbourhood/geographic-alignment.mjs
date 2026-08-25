const GRS80_AXIS_M = 6378137;
const GRS80_FLATTENING = 1 / 298.257222101;
const SWEREF99_TM_CENTRAL_MERIDIAN_DEG = 15;
const SWEREF99_TM_SCALE = 0.9996;
const SWEREF99_TM_FALSE_EASTING_M = 500000;
const METRES_PER_DEGREE_LATITUDE = 110540;

function finite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return value;
}

function pair(value, label) {
  if (!Array.isArray(value) || value.length !== 2) throw new TypeError(`${label} must contain two numbers`);
  return value.map((number, index) => finite(number, `${label}[${index}]`));
}

function triple(value, label) {
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError(`${label} must contain three numbers`);
  return value.map((number, index) => finite(number, `${label}[${index}]`));
}

function degreesToRadians(value) {
  return value * Math.PI / 180;
}

function radiansToDegrees(value) {
  return value * 180 / Math.PI;
}

export function sweref99TmFromWgs84(value) {
  const [longitude, latitude] = pair(value, "longitude/latitude");
  if (longitude < 10 || longitude > 25 || latitude < 54 || latitude > 70) throw new RangeError("coordinate is outside the supported Sweden guard");
  const eccentricitySquared = GRS80_FLATTENING * (2 - GRS80_FLATTENING);
  const secondEccentricitySquared = eccentricitySquared / (1 - eccentricitySquared);
  const phi = degreesToRadians(latitude);
  const lambdaDifference = degreesToRadians(longitude - SWEREF99_TM_CENTRAL_MERIDIAN_DEG);
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);
  const radiusOfCurvature = GRS80_AXIS_M / Math.sqrt(1 - eccentricitySquared * sinPhi ** 2);
  const T = tanPhi ** 2;
  const C = secondEccentricitySquared * cosPhi ** 2;
  const A = cosPhi * lambdaDifference;
  const e4 = eccentricitySquared ** 2;
  const e6 = eccentricitySquared ** 3;
  const meridionalArc = GRS80_AXIS_M * (
    (1 - eccentricitySquared / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
    - (3 * eccentricitySquared / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi)
    + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi)
    - 35 * e6 / 3072 * Math.sin(6 * phi)
  );
  const easting = SWEREF99_TM_FALSE_EASTING_M + SWEREF99_TM_SCALE * radiusOfCurvature * (
    A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * secondEccentricitySquared) * A ** 5 / 120
  );
  const northing = SWEREF99_TM_SCALE * (
    meridionalArc + radiusOfCurvature * tanPhi * (
      A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24
      + (61 - 58 * T + T ** 2 + 600 * C - 330 * secondEccentricitySquared) * A ** 6 / 720
    )
  );
  return Object.freeze([easting, northing]);
}

export function localHorizontalToWgs84({originWgs84, localEastNorthM}) {
  const [longitude, latitude] = pair(originWgs84, "originWgs84");
  const [east, north] = pair(localEastNorthM, "localEastNorthM");
  const metresPerDegreeLongitude = 111320 * Math.cos(degreesToRadians(latitude));
  return Object.freeze([
    longitude + east / metresPerDegreeLongitude,
    latitude + north / METRES_PER_DEGREE_LATITUDE
  ]);
}

export function deriveLiveContextView({originWgs84, camera, target, zoom}) {
  const cameraVector = triple(camera, "camera");
  const targetVector = triple(target, "target");
  const dx = targetVector[0] - cameraVector[0];
  const dz = targetVector[2] - cameraVector[2];
  const horizontalDistance = Math.hypot(dx, dz);
  const verticalDistance = Math.abs(cameraVector[1] - targetVector[1]);
  const bearing = (radiansToDegrees(Math.atan2(dx, dz)) + 360) % 360;
  const pitch = Math.min(85, Math.max(0, 90 - radiansToDegrees(Math.atan2(verticalDistance, horizontalDistance))));
  return Object.freeze({
    center_wgs84: localHorizontalToWgs84({originWgs84, localEastNorthM: [targetVector[0], targetVector[2]]}),
    zoom: finite(zoom, "zoom"),
    pitch: Number(pitch.toFixed(4)),
    bearing: Number(bearing.toFixed(4)),
    synchronization: "LOCAL_EAST_UP_NORTH_STAGE_REFERENCE",
    evidence_effect: "NONE"
  });
}
