/**
 * Scattered elevation samples → a terrain GRID_SURFACE.
 *
 * Svärtinge arrived with a ready-made 25×25 height grid. Most sites will not: IGN, Lantmäteriet
 * and every point-query elevation API hand back a handful of samples at parcel centroids. This
 * turns those into a surface the engine can render — inverse-distance weighted, deterministic,
 * and honest about what it is: a DERIVED interpolation between measured points, never a survey.
 *
 * The returned metadata is meant to be copied into the element's `limitations`, because a
 * viewer looking at smooth ground has no way to know it was reconstructed from 16 points.
 *
 * Pure module: no DOM, no WebGL.
 */

const isFiniteNumber = value => typeof value === "number" && Number.isFinite(value);

/**
 * Height at an arbitrary point, by the same interpolation the grid uses.
 *
 * Needed to sit things ON the ground: a parcel outline drawn at a fixed y is buried on the high
 * side of a slope and floating on the low side, which reads as sloppy at best and as a claim
 * about levels at worst.
 */
export function sampleHeightAt({samples, x, z, power = 2, smoothing = 1, datum}) {
  const elevations = samples.map(sample => sample.elevation);
  const reference = isFiniteNumber(datum)
    ? datum
    : elevations.reduce((sum, value) => sum + value, 0) / elevations.length;
  let weighted = 0;
  let weights = 0;
  for (const sample of samples) {
    const distance = Math.hypot(x - sample.x, z - sample.z) + smoothing;
    const weight = 1 / Math.pow(distance, power);
    weighted += weight * (sample.elevation - reference);
    weights += weight;
  }
  return {height: weighted / weights, datum_m: reference};
}

/**
 * @param {object} options
 * @param {Array<{x:number,z:number,elevation:number}>} options.samples  local ENU metres + height
 * @param {number} options.size     side length of the square grid, metres
 * @param {number} options.segments grid subdivisions per axis (vertices = (segments+1)^2)
 * @param {number} [options.power]  IDW exponent; higher = more local, flatter between samples
 * @param {number} [options.smoothing] metres added to each distance, so a vertex sitting on a
 *                                     sample does not divide by zero and spike
 * @param {number} [options.datum]  height subtracted from every sample; defaults to the sample
 *                                  mean so the scene sits around y = 0
 */
export function interpolateTerrainGrid({samples, size, segments, power = 2, smoothing = 1, datum}) {
  if (!Array.isArray(samples) || samples.length < 3) {
    throw new RangeError("interpolateTerrainGrid needs at least 3 samples");
  }
  for (const [index, sample] of samples.entries()) {
    if (!isFiniteNumber(sample?.x) || !isFiniteNumber(sample?.z) || !isFiniteNumber(sample?.elevation)) {
      throw new TypeError(`samples[${index}] must be {x, z, elevation} finite numbers`);
    }
  }
  if (!Number.isInteger(segments) || segments < 1) throw new RangeError("segments must be a positive integer");
  if (!isFiniteNumber(size) || size <= 0) throw new RangeError("size must be a positive number");

  const elevations = samples.map(sample => sample.elevation);
  const reference = isFiniteNumber(datum)
    ? datum
    : elevations.reduce((sum, value) => sum + value, 0) / elevations.length;

  const vertices = [];
  const step = size / segments;
  for (let row = 0; row <= segments; row += 1) {
    for (let column = 0; column <= segments; column += 1) {
      const x = -size / 2 + column * step;
      const z = -size / 2 + row * step;
      let weighted = 0;
      let weights = 0;
      for (const sample of samples) {
        const distance = Math.hypot(x - sample.x, z - sample.z) + smoothing;
        const weight = 1 / Math.pow(distance, power);
        weighted += weight * (sample.elevation - reference);
        weights += weight;
      }
      vertices.push([Number(x.toFixed(4)), Number((weighted / weights).toFixed(4)), Number(z.toFixed(4))]);
    }
  }

  const heights = vertices.map(vertex => vertex[1]);
  const sampleRadius = Math.max(...samples.map(sample => Math.hypot(sample.x, sample.z)));

  return Object.freeze({
    geometry: Object.freeze({
      primitive: "GRID_SURFACE",
      size_m: size,
      segments,
      vertices,
      method: `INVERSE_DISTANCE_WEIGHTED_P${power}_SMOOTHING_${smoothing}M`,
      height_reference: "LOCAL_RELATIVE_TO_SAMPLE_MEAN"
    }),
    metadata: Object.freeze({
      sample_count: samples.length,
      datum_m: Number(reference.toFixed(3)),
      min_height_m: Number(Math.min(...heights).toFixed(3)),
      max_height_m: Number(Math.max(...heights).toFixed(3)),
      sample_span_m: Number((Math.max(...elevations) - Math.min(...elevations)).toFixed(2)),
      furthest_sample_from_origin_m: Number(sampleRadius.toFixed(1)),
      extrapolated_beyond_samples: size / 2 > sampleRadius
    }),
    /** Drop straight into an element's `limitations`. Written to be read by a buyer, not a GIS. */
    limitations: Object.freeze([
      `Surface interpolated from ${samples.length} measured elevation points by inverse-distance weighting (power ${power}); it is not a surveyed or LiDAR-dense terrain model.`,
      `Measured points span ${(Math.max(...elevations) - Math.min(...elevations)).toFixed(1)} m of height; heights are shown relative to their mean (${reference.toFixed(1)} m).`,
      ...(size / 2 > sampleRadius
        ? [`The grid extends ${(size / 2 - sampleRadius).toFixed(0)} m beyond the outermost measured point; ground beyond that radius is extrapolation.`]
        : [])
    ])
  });
}
