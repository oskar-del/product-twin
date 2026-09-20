/**
 * Roof geometry, shared by the generator and the validator.
 *
 * This module exists because v0.3 shipped a wing roof that passed through the
 * rooms underneath it: a 15° mono falling north off a 3.0 m plate reaches
 * Y 0.64 m at the north edge, while the garage and utility rooms below are
 * 2.40–2.50 m. Nothing checked it. The fix is not only a better roof — it is
 * that the roof and the checker now compute height the SAME way, from one
 * function, so the assertion cannot drift from the design.
 */

const rad = deg => (deg * Math.PI) / 180;

/**
 * Specs before v0.4 do not declare roof extents, and a checker that crashes on
 * the very file it is meant to indict is useless. When extents are missing we
 * derive them from the ground-floor rooms each roof sits over — the bar roof
 * covers the rooms south of the wing line (z ≤ 3), the wing roof those north of
 * it — plus the declared overhang.
 */
function withExtents(roof, spec) {
  if (roof.extent_x && roof.extent_z) return roof;
  const isWing = roof === spec.wing_roof;
  const rooms = (spec.rooms ?? []).filter(r =>
    r.storey === "GROUND" &&
    (isWing ? Math.max(...r.footprint_xz.map(p => p[1])) > 3
            : Math.min(...r.footprint_xz.map(p => p[1])) < 3));
  if (!rooms.length) return {...roof, extent_x: [0, 0], extent_z: [0, 0]};
  const xs = rooms.flatMap(r => r.footprint_xz.map(p => p[0]));
  const zs = rooms.flatMap(r => r.footprint_xz.map(p => p[1]));
  const o = roof.eaves_overhang_m ?? 0;
  const derived = {
    ...roof,
    extent_x: [Math.min(...xs) - o, Math.max(...xs) + o],
    extent_z: [Math.min(...zs) - o, Math.max(...zs) + o],
    extents_derived: true
  };
  // A gable also needs its ridge position; take it from ridge_xz when present.
  if (derived.type === "GABLE" && derived.ridge_at_z == null && Array.isArray(derived.ridge_xz)) {
    derived.ridge_at_z = derived.ridge_xz[0][1];
  }
  return derived;
}

/**
 * Height of a roof plane above datum at (x, z), or null when the point lies
 * outside that roof's extent.
 *
 * GABLE   — falls both ways from a ridge line.
 * MONOPITCH — falls from a high edge toward `falls_towards`.
 */
export function planeHeightAt(roof, x, z) {
  const [x0, x1] = roof.extent_x;
  const [z0, z1] = roof.extent_z;
  if (x < x0 || x > x1 || z < z0 || z > z1) return null;

  if (roof.type === "GABLE") {
    const axis = roof.ridge_axis === "EAST_WEST" ? z : x;
    const ridgeAt = roof.ridge_axis === "EAST_WEST" ? roof.ridge_at_z : roof.ridge_at_x;
    const d = Math.abs(axis - ridgeAt);
    return roof.ridge_Y - d * Math.tan(rad(roof.pitch_deg));
  }

  if (roof.type === "MONOPITCH") {
    // Distance measured from the high edge, in the direction of fall.
    const d = roof.falls_towards === "NORTH" ? z - z0
            : roof.falls_towards === "SOUTH" ? z1 - z
            : roof.falls_towards === "EAST"  ? x - x0
            : x1 - x;
    return roof.wall_plate_Y - d * Math.tan(rad(roof.pitch_deg));
  }

  return null;
}

/** The lowest roof height over a room's footprint, and where it occurs. */
export function lowestOverFootprint(roofs, footprint, samples = 12) {
  const xs = footprint.map(p => p[0]);
  const zs = footprint.map(p => p[1]);
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  const [minZ, maxZ] = [Math.min(...zs), Math.max(...zs)];

  let lowest = Infinity;
  let at = null;
  let covered = false;

  for (let i = 0; i <= samples; i++) {
    for (let j = 0; j <= samples; j++) {
      const x = minX + ((maxX - minX) * i) / samples;
      const z = minZ + ((maxZ - minZ) * j) / samples;
      for (const roof of roofs) {
        const h = planeHeightAt(roof, x, z);
        if (h == null) continue;
        covered = true;
        if (h < lowest) { lowest = h; at = [Number(x.toFixed(2)), Number(z.toFixed(2))]; }
      }
    }
  }
  return covered ? {lowest_m: Number(lowest.toFixed(3)), at_xz: at} : null;
}

/**
 * Every roof plane must clear every room beneath it by at least that room's
 * ceiling height. Returns the failures; an empty array is a pass.
 */
export function roofClearanceFailures(spec) {
  const roofs = [spec.roof, spec.wing_roof].filter(Boolean).map(r => withExtents(r, spec));
  const failures = [];
  for (const room of spec.rooms ?? []) {
    if (room.storey !== "GROUND") continue;      // only the storey directly under the roofs
    const result = lowestOverFootprint(roofs, room.footprint_xz);
    if (!result) continue;                        // not covered by a declared plane
    if (result.lowest_m < room.ceiling_height_m) {
      failures.push({
        room: room.id,
        ceiling_m: room.ceiling_height_m,
        lowest_roof_m: result.lowest_m,
        at_xz: result.at_xz,
        shortfall_m: Number((room.ceiling_height_m - result.lowest_m).toFixed(3))
      });
    }
  }
  return failures;
}
