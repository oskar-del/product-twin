/**
 * Dense height field → a budgeted terrain GRID_SURFACE.
 *
 * The perf budget names one concrete danger: a 1 m DEM over a 360 m site is ~259k triangles,
 * over the Twin budget on its own. So the hard part of a "terrain loader" is not reading the
 * DEM — a site adapter can hand us a 2-D height array from a COG, an ASCII grid, or a LiDAR
 * raster — it is decimating that array to a surface the engine can render WITHOUT quietly
 * throwing away the shape.
 *
 * This resamples a dense field to a target segment count and REPORTS the height error it cost,
 * so decimation is a stated trade rather than a silent one. A terrain that looks smooth gives
 * the viewer no way to know it was coarsened; the fidelity numbers and limitations are how the
 * honesty survives the optimisation.
 *
 * Pure module: no DOM, no WebGL, no file or network I/O — the adapter reads bytes, this shapes
 * numbers, and the split is what keeps it gateable in Node.
 */

const isFiniteNumber = value => typeof value === "number" && Number.isFinite(value);

/**
 * Validate a rectangular height field: rows × cols of finite metres.
 * @returns {{rows:number, cols:number}}
 */
export function assertHeightField(heights) {
  if (!Array.isArray(heights) || heights.length < 2) throw new TypeError("heights must be a 2-D array with at least 2 rows");
  const cols = heights[0]?.length;
  if (!Number.isInteger(cols) || cols < 2) throw new TypeError("each row must have at least 2 columns");
  for (const [row, values] of heights.entries()) {
    if (!Array.isArray(values) || values.length !== cols) throw new TypeError(`row ${row} is ragged: expected ${cols} columns`);
    for (const [col, value] of values.entries()) {
      if (!isFiniteNumber(value)) throw new TypeError(`heights[${row}][${col}] is not a finite number`);
    }
  }
  return {rows: heights.length, cols};
}

/** Bilinear sample of a height field at fractional grid coordinates (col u, row v). */
export function bilinearSample(heights, u, v) {
  const rows = heights.length;
  const cols = heights[0].length;
  const cu = Math.min(cols - 1, Math.max(0, u));
  const cv = Math.min(rows - 1, Math.max(0, v));
  const u0 = Math.floor(cu);
  const v0 = Math.floor(cv);
  const u1 = Math.min(cols - 1, u0 + 1);
  const v1 = Math.min(rows - 1, v0 + 1);
  const fu = cu - u0;
  const fv = cv - v0;
  const top = heights[v0][u0] * (1 - fu) + heights[v0][u1] * fu;
  const bottom = heights[v1][u0] * (1 - fu) + heights[v1][u1] * fu;
  return top * (1 - fv) + bottom * fv;
}

/** Largest segment count whose triangle total (2·segments²) fits the budget. */
export function segmentsForTriangleBudget(maxTriangles) {
  if (!isFiniteNumber(maxTriangles) || maxTriangles < 2) throw new RangeError("maxTriangles must be at least 2");
  return Math.max(1, Math.floor(Math.sqrt(maxTriangles / 2)));
}

/**
 * Resample a dense height field to a square GRID_SURFACE of `segments` subdivisions and measure
 * what the resampling cost, by comparing every ORIGINAL sample against the coarse surface.
 *
 * @param {object} options
 * @param {number[][]} options.heights   rows × cols of metres (row 0 = north edge)
 * @param {number} options.size          side length of the square site in metres
 * @param {number} [options.segments]    output subdivisions per axis (vertices = (segments+1)²)
 * @param {number} [options.maxTriangles] budget; used when `segments` is not given
 * @param {number} [options.datum]       height subtracted from every vertex; defaults to the
 *                                        field mean so the scene sits around y = 0
 */
export function heightFieldToGrid({heights, size, segments, maxTriangles, datum}) {
  const {rows, cols} = assertHeightField(heights);
  if (!isFiniteNumber(size) || size <= 0) throw new RangeError("size must be a positive number");

  const sourceTriangles = 2 * (rows - 1) * (cols - 1);
  const targetSegments = Number.isInteger(segments) && segments >= 1
    ? segments
    : Math.min(Math.max(rows, cols) - 1, segmentsForTriangleBudget(maxTriangles ?? sourceTriangles));
  if (targetSegments < 1) throw new RangeError("resolved segment count must be at least 1");

  let sum = 0;
  let count = 0;
  for (const rowValues of heights) for (const value of rowValues) { sum += value; count += 1; }
  const reference = isFiniteNumber(datum) ? datum : sum / count;

  // Build the coarse grid by bilinear sampling of the dense field.
  const vertices = [];
  const step = size / targetSegments;
  for (let row = 0; row <= targetSegments; row += 1) {
    for (let col = 0; col <= targetSegments; col += 1) {
      const u = (col / targetSegments) * (cols - 1);
      const v = (row / targetSegments) * (rows - 1);
      const x = -size / 2 + col * step;
      const z = -size / 2 + row * step;
      vertices.push([Number(x.toFixed(4)), Number((bilinearSample(heights, u, v) - reference).toFixed(4)), z]);
    }
  }

  // Fidelity: compare EVERY original sample against the coarse surface at the same place.
  const coarse = (px, pz) => {
    const col = ((px + size / 2) / size) * targetSegments;
    const row = ((pz + size / 2) / size) * targetSegments;
    return bilinearGrid(vertices, targetSegments, col, row);
  };
  let sqError = 0;
  let maxError = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const px = -size / 2 + (c / (cols - 1)) * size;
      const pz = -size / 2 + (r / (rows - 1)) * size;
      const error = Math.abs((heights[r][c] - reference) - coarse(px, pz));
      sqError += error * error;
      if (error > maxError) maxError = error;
    }
  }
  const rmsError = Math.sqrt(sqError / (rows * cols));
  const outputTriangles = 2 * targetSegments * targetSegments;

  return Object.freeze({
    geometry: Object.freeze({
      primitive: "GRID_SURFACE",
      size_m: size,
      segments: targetSegments,
      vertices,
      method: `HEIGHT_FIELD_RESAMPLE_${rows}x${cols}_TO_${targetSegments + 1}x${targetSegments + 1}`,
      height_reference: "LOCAL_RELATIVE_TO_FIELD_MEAN"
    }),
    fidelity: Object.freeze({
      source_samples: rows * cols,
      source_triangles: sourceTriangles,
      output_triangles: outputTriangles,
      decimation_ratio: Number((sourceTriangles / outputTriangles).toFixed(2)),
      rms_error_m: Number(rmsError.toFixed(4)),
      max_error_m: Number(maxError.toFixed(4)),
      datum_m: Number(reference.toFixed(3)),
      lossless: outputTriangles >= sourceTriangles && rmsError < 1e-9
    }),
    limitations: Object.freeze([
      outputTriangles >= sourceTriangles
        ? `Rendered at the source resolution (${rows}×${cols} samples); no decimation applied.`
        : `Decimated from ${rows}×${cols} source samples to a ${targetSegments + 1}×${targetSegments + 1} grid to stay within the render budget — a ${(sourceTriangles / outputTriangles).toFixed(0)}× reduction.`,
      `Coarsening cost ${rmsError.toFixed(2)} m RMS height error against the source, ${maxError.toFixed(2)} m at worst; features narrower than ${(size / targetSegments).toFixed(0)} m may be smoothed away.`,
      "Heights are shown relative to the field mean, not to any datum, floor level or sea level."
    ])
  });
}

/** Bilinear read of a flat (segments+1)² vertex grid at fractional (col, row). */
function bilinearGrid(vertices, segments, col, row) {
  const stride = segments + 1;
  const c0 = Math.min(segments, Math.max(0, Math.floor(col)));
  const r0 = Math.min(segments, Math.max(0, Math.floor(row)));
  const c1 = Math.min(segments, c0 + 1);
  const r1 = Math.min(segments, r0 + 1);
  const fc = Math.min(1, Math.max(0, col - c0));
  const fr = Math.min(1, Math.max(0, row - r0));
  const h = (r, c) => vertices[r * stride + c][1];
  const top = h(r0, c0) * (1 - fc) + h(r0, c1) * fc;
  const bottom = h(r1, c0) * (1 - fc) + h(r1, c1) * fc;
  return top * (1 - fr) + bottom * fr;
}
