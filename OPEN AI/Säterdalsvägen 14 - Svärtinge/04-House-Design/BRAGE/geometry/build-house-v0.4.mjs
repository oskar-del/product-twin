/**
 * Build geometry/house-v0.4-geometry-spec.json — Vinkelhuset, room by room.
 *
 *   node geometry/build-house-v0.4.mjs
 *
 * v0.4 fixes a real defect in v0.3: the wing's 15° mono-pitch fell north off a
 * 3.0 m plate and reached Y 0.64 m at the north edge, while the garage and
 * utility rooms below are 2.40–2.50 m. The roof passed straight through them.
 * Nothing in v0.3 checked roof-to-room clearance, so nothing caught it.
 *
 * Platform builds the interior from this file, so NOTHING here is a typed
 * dimension. Rooms are declared as footprint polygons in scene-v0.2 coordinates
 * (South/lake = −Z, East = +X, metres); every area, perimeter, wall segment and
 * volume is computed from those polygons. The roof is declared by pitch, plate
 * and span, and the upper floor's usable area is computed from the roof
 * section — not asserted.
 *
 * Room boundaries are the v0.2 interior walls, unchanged:
 *   bar  X[−11,9] × Z[−4,3]   split at x = −4, 2, 5
 *   wing X[3,11]  × Z[3,11]   split at x = 6 and z = 6
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {roofClearanceFailures} from "./roof-planes.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

/* ── helpers ───────────────────────────────────────────────────────────── */

const rect = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

/** Shoelace area of a closed-by-convention ring. */
function area(poly) {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    sum += x1 * z2 - x2 * z1;
  }
  return Math.abs(sum) / 2;
}

function perimeter(poly) {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    sum += Math.hypot(x2 - x1, z2 - z1);
  }
  return sum;
}

/** Compass orientation of a wall segment's outward normal, in scene axes. */
function orientationOf([x1, z1], [x2, z2]) {
  const dx = x2 - x1, dz = z2 - z1;
  if (Math.abs(dz) < 1e-9) return dx > 0 ? "SOUTH" : "NORTH"; // runs E–W
  if (Math.abs(dx) < 1e-9) return dz > 0 ? "EAST" : "WEST";   // runs N–S
  return "SKEW";
}

/** Wall segments of a room, derived from its ring. */
function wallsOf(id, poly, height) {
  return poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length];
    return {
      id: `${id}_W${i}`,
      from_xz: p,
      to_xz: q,
      length_m: round(Math.hypot(q[0] - p[0], q[1] - p[1])),
      height_m: height,
      faces: orientationOf(p, q)
    };
  });
}

const round = (value, digits = 2) => Number(value.toFixed(digits));

/* ── roof (item 2) ─────────────────────────────────────────────────────── */

const ROOF = {
  type: "GABLE",
  pitch_deg: 30,
  ridge_axis: "EAST_WEST",
  ridge_xz: [[-11, -0.5], [9, -0.5]],        // centred on the bar's 7 m span
  ridge_at_z: -0.5,
  extent_x: [-11.5, 9.5],                     // incl. 0.5 m overhang
  extent_z: [-4.5, 3.5],
  span_m: 7,                                  // Z[−4,3]
  wall_plate_Y: 3.0,                          // top of ground-storey walls
  eaves_overhang_m: 0.5,
  knee_wall_m: 1.1,                           // upper floor sits on a knee wall
  covering: "STANDING_SEAM_SHEET_METAL",
  note: "30° both planes. Supersedes the asymmetric-ridge sketch in 04-WINNER-DEVELOPED.md; the south plane is still the PV-ready plane, it is now the same pitch as the north."
};
// Ridge height above the wall plate, and above the upper floor.
ROOF.ridge_height_above_plate_m = round((ROOF.span_m / 2) * Math.tan(ROOF.pitch_deg * Math.PI / 180));
ROOF.ridge_Y = round(ROOF.wall_plate_Y + ROOF.ridge_height_above_plate_m);
ROOF.eaves_Y = ROOF.wall_plate_Y;

const WING_ROOF = (() => {
  // The wing is 8 m deep (Z[3,11]) and its rooms are 2.40–2.50 m.
  //
  // A mono-pitch cannot do this. Falling north at 15° it loses 2.36 m over the
  // 8.8 m run and ends at 0.64 m — through the rooms. Clearing 2.50 m that way
  // needs either a 4.86 m plate or a pitch of 3.25°, and both are bad
  // architecture here: a 4.86 m eave sits almost at the BAR's ridge (5.02 m)
  // and kills the subordination the whole parti depends on, while 3.25° is a
  // flat roof pretending to be a pitched one.
  //
  // So the wing gets its OWN gable, ridge east–west at mid-depth. The eaves
  // stay at 3.0 m, level with the bar's, and the ridge lands at 4.07 m —
  // comfortably under the bar's 5.02 m. The wing reads as a smaller sibling of
  // the bar rather than a lean-to, and the lowest point of the roof is the
  // 3.0 m plate, which clears every room beneath it.
  const pitch = 15;
  const plate = 3.0;
  const overhang = 0.4;
  const z0 = 3, z1 = 11;
  const ridgeZ = (z0 + z1) / 2;
  const ridgeY = plate + (ridgeZ - z0) * Math.tan(pitch * Math.PI / 180);
  return {
    type: "GABLE",
    pitch_deg: pitch,
    ridge_axis: "EAST_WEST",
    ridge_at_z: ridgeZ,
    ridge_xz: [[3, ridgeZ], [11, ridgeZ]],
    ridge_Y: round(ridgeY),
    wall_plate_Y: plate,
    eaves_Y: plate,
    span_m: z1 - z0,
    eaves_overhang_m: overhang,
    extent_x: [3 - overhang, 11 + overhang],
    extent_z: [z0 - overhang, z1 + overhang],
    covering: "STANDING_SEAM_SHEET_METAL",
    supersedes: "v0.3 WING_ROOF — a 15° MONOPITCH falling north, which passed through the rooms below it",
    note: "Cold wing. Its own gable keeps the eaves level with the bar's and the ridge below it, so the wing stays subordinate without a 4.9 m eave."
  };
})();

/**
 * Usable upper-floor width under a 30° gable with a knee wall: the band where
 * headroom reaches HEADROOM_MIN. Computed, not assumed.
 */
const HEADROOM_MIN = 1.9;
const UPPER_FLOOR_Y = 3.0;
function usableWidthUnderRoof() {
  const tan = Math.tan(ROOF.pitch_deg * Math.PI / 180);
  // Height above the upper floor at distance d from the eaves wall:
  //   h(d) = knee_wall + d·tan(pitch), capped at the ridge.
  const dMin = (HEADROOM_MIN - ROOF.knee_wall_m) / tan;   // where h reaches 1.9 m
  const usable = ROOF.span_m - 2 * dMin;
  return {d_to_headroom_m: round(dMin), usable_width_m: round(usable)};
}

/* ── rooms ─────────────────────────────────────────────────────────────── */

const H = 2.5;   // ground-storey clear ceiling height (3.0 m structure − floor/ceiling build-up)

const GROUND = [
  {
    id: "ROOM_GLANRUMMET", use: "LIVING_VIEW", heated: true, storey: "GROUND",
    poly: rect(-11, -4, -4, 3), ceiling_m: 2.7,
    finishes: {floor: "OILED_OAK_PLANK", walls: "PAINTED_PLASTER_WARM_WHITE", ceiling: "EXPOSED_TIMBER_SOFFIT"},
    note: "The one move: fully glazed south and west, glass splayed toward Glan. Ceiling lifted above the rest of the bar."
  },
  {
    id: "ROOM_KITCHEN_DINING", use: "KITCHEN_DINING", heated: true, storey: "GROUND",
    poly: rect(-4, 2, -4, 3), ceiling_m: H,
    finishes: {floor: "OILED_OAK_PLANK", walls: "PAINTED_PLASTER_WARM_WHITE", ceiling: "PAINTED_PLASTER"}
  },
  {
    id: "ROOM_HEART_ZONE", use: "WET_CORE_AND_CIRCULATION", heated: true, storey: "GROUND",
    poly: rect(2, 5, -4, 3), ceiling_m: H,
    finishes: {floor: "LARGE_FORMAT_STONE_TILE", walls: "TILE_AND_PAINTED_PLASTER", ceiling: "PAINTED_PLASTER"},
    contains: "HOUSE_HEART prefab wet core, 3×3 m at [2,5]×[0.5,3.5]"
  },
  {
    id: "ROOM_MAIN_BED", use: "MAIN_BEDROOM_ENSUITE", heated: true, storey: "GROUND",
    poly: rect(5, 9, -4, 3), ceiling_m: H,
    finishes: {floor: "OILED_OAK_PLANK", walls: "PAINTED_PLASTER_WARM_WHITE", ceiling: "PAINTED_PLASTER"}
  },
  {
    id: "ROOM_ENTRY_HALL", use: "ENTRY_HALL", heated: true, storey: "GROUND",
    poly: rect(3, 6, 3, 6), ceiling_m: H,
    finishes: {floor: "LARGE_FORMAT_STONE_TILE", walls: "PAINTED_PLASTER_WARM_WHITE", ceiling: "PAINTED_PLASTER"}
  },
  {
    id: "ROOM_UTILITY_WC", use: "UTILITY_WC_LAUNDRY", heated: true, storey: "GROUND",
    poly: rect(3, 6, 6, 11), ceiling_m: H,
    finishes: {floor: "LARGE_FORMAT_STONE_TILE", walls: "TILE_AND_PAINTED_PLASTER", ceiling: "PAINTED_PLASTER"}
  },
  {
    id: "ROOM_GARAGE", use: "GARAGE_DOUBLE", heated: false, storey: "GROUND",
    poly: rect(6, 11, 3, 11), ceiling_m: 2.4,
    finishes: {floor: "POWER_FLOATED_CONCRETE", walls: "EXPOSED_STUD_AND_BOARD", ceiling: "EXPOSED_STRUCTURE"},
    note: "Cold volume. Excluded from the heated figure."
  }
];

/* Upper floor — in the roof over the eastern half of the bar. Its width is the
   computed usable band, not the full 7 m span. */
const upper = usableWidthUnderRoof();
const UPPER_Z0 = round(-0.5 - upper.usable_width_m / 2);
const UPPER_Z1 = round(-0.5 + upper.usable_width_m / 2);

const UPPER = [
  {
    id: "ROOM_CHILD_1", use: "BEDROOM", heated: true, storey: "UPPER",
    poly: rect(1, 5, UPPER_Z0, UPPER_Z1), ceiling_m: round(ROOF.ridge_height_above_plate_m),
    finishes: {floor: "OILED_OAK_PLANK", walls: "PAINTED_PLASTER_WARM_WHITE", ceiling: "SLOPED_PAINTED_PLASTER"}
  },
  {
    id: "ROOM_CHILD_2", use: "BEDROOM", heated: true, storey: "UPPER",
    poly: rect(5, 9, UPPER_Z0, UPPER_Z1), ceiling_m: round(ROOF.ridge_height_above_plate_m),
    finishes: {floor: "OILED_OAK_PLANK", walls: "PAINTED_PLASTER_WARM_WHITE", ceiling: "SLOPED_PAINTED_PLASTER"}
  },
  {
    id: "ROOM_UPPER_BATH", use: "BATHROOM", heated: true, storey: "UPPER",
    poly: rect(-1, 1, UPPER_Z0, UPPER_Z1), ceiling_m: round(ROOF.ridge_height_above_plate_m),
    finishes: {floor: "STONE_TILE", walls: "TILE", ceiling: "SLOPED_PAINTED_PLASTER"}
  }
];

/* Suterräng — VALIDATED by the measured 13° SW slope. */
const SUTER = [
  {
    id: "ROOM_GILLESTUGA", use: "FAMILY_ROOM", heated: true, storey: "SOUTERRAIN",
    poly: rect(-11, -5, -4, 3), ceiling_m: 2.4,
    finishes: {floor: "POLISHED_CONCRETE", walls: "PAINTED_PLASTER_WARM_WHITE", ceiling: "PAINTED_PLASTER"},
    note: "Walks out to the terrace at the west gable."
  },
  {
    id: "ROOM_GUEST", use: "GUEST_BEDROOM", heated: true, storey: "SOUTERRAIN",
    poly: rect(-5, -3, -4, 3), ceiling_m: 2.4,
    finishes: {floor: "OILED_OAK_PLANK", walls: "PAINTED_PLASTER_WARM_WHITE", ceiling: "PAINTED_PLASTER"}
  },
  {
    id: "ROOM_TECH_STORE", use: "PLANT_AND_STORE", heated: true, storey: "SOUTERRAIN",
    poly: rect(-3, -1, -4, 3), ceiling_m: 2.4,
    finishes: {floor: "SEALED_CONCRETE", walls: "PAINTED_BLOCK", ceiling: "EXPOSED_STRUCTURE"}
  }
];

/* ── openings ──────────────────────────────────────────────────────────── */
/* Sill and head are heights above that room's finished floor. */

const OPENINGS = [
  // Glanrummet — the glazed corner
  {id: "OP_GLAN_S1", room: "ROOM_GLANRUMMET", type: "FIXED_GLAZING", wall: "SOUTH", from_xz: [-10.5, -4], to_xz: [-4.5, -4], sill_m: 0.0, head_m: 2.55, glazing: "TRIPLE_ALU_CLAD_TIMBER"},
  {id: "OP_GLAN_W1", room: "ROOM_GLANRUMMET", type: "FIXED_GLAZING", wall: "WEST", from_xz: [-11, -3.5], to_xz: [-11, 2.5], sill_m: 0.0, head_m: 2.55, glazing: "TRIPLE_ALU_CLAD_TIMBER", note: "Evening sun; splayed toward the lake."},
  {id: "OP_GLAN_DOOR", room: "ROOM_GLANRUMMET", type: "SLIDING_DOOR", wall: "SOUTH", from_xz: [-7.6, -4], to_xz: [-5.8, -4], sill_m: 0.0, head_m: 2.4, glazing: "TRIPLE_ALU_CLAD_TIMBER"},
  // Kitchen / dining
  {id: "OP_KD_S1", room: "ROOM_KITCHEN_DINING", type: "WINDOW", wall: "SOUTH", from_xz: [-3.4, -4], to_xz: [-0.4, -4], sill_m: 0.5, head_m: 2.4, glazing: "TRIPLE_ALU_CLAD_TIMBER"},
  {id: "OP_KD_DOOR", room: "ROOM_KITCHEN_DINING", type: "SLIDING_DOOR", wall: "SOUTH", from_xz: [0.2, -4], to_xz: [1.8, -4], sill_m: 0.0, head_m: 2.4, glazing: "TRIPLE_ALU_CLAD_TIMBER"},
  {id: "OP_KD_N1", room: "ROOM_KITCHEN_DINING", type: "WINDOW", wall: "NORTH", from_xz: [-3.0, 3], to_xz: [-1.8, 3], sill_m: 1.4, head_m: 2.4, glazing: "TRIPLE_ALU_CLAD_TIMBER", note: "High north light over the counter."},
  // Main bedroom
  {id: "OP_BED_S1", room: "ROOM_MAIN_BED", type: "WINDOW", wall: "SOUTH", from_xz: [5.6, -4], to_xz: [8.4, -4], sill_m: 0.5, head_m: 2.4, glazing: "TRIPLE_ALU_CLAD_TIMBER"},
  {id: "OP_BED_E1", room: "ROOM_MAIN_BED", type: "WINDOW", wall: "EAST", from_xz: [9, -2.6], to_xz: [9, -1.2], sill_m: 0.7, head_m: 2.2, glazing: "TRIPLE_ALU_CLAD_TIMBER", note: "Morning light."},
  // Entry
  {id: "OP_ENTRY_DOOR", room: "ROOM_ENTRY_HALL", type: "ENTRANCE_DOOR", wall: "EAST", from_xz: [6, 3.6], to_xz: [6, 4.7], sill_m: 0.0, head_m: 2.1, glazing: "PART_GLAZED_TIMBER", note: "Off the arrival court."},
  {id: "OP_ENTRY_W1", room: "ROOM_ENTRY_HALL", type: "WINDOW", wall: "WEST", from_xz: [3, 3.8], to_xz: [3, 5.2], sill_m: 0.9, head_m: 2.2, glazing: "TRIPLE_ALU_CLAD_TIMBER"},
  // Utility
  {id: "OP_UTIL_N1", room: "ROOM_UTILITY_WC", type: "WINDOW", wall: "NORTH", from_xz: [3.6, 11], to_xz: [4.8, 11], sill_m: 1.3, head_m: 2.2, glazing: "TRIPLE_ALU_CLAD_TIMBER"},
  // Garage
  {id: "OP_GARAGE_DOOR", room: "ROOM_GARAGE", type: "GARAGE_DOOR", wall: "NORTH", from_xz: [6.8, 11], to_xz: [10.2, 11], sill_m: 0.0, head_m: 2.2, glazing: "INSULATED_SECTIONAL"},
  // Upper — dormer/gable to the south
  {id: "OP_CH1_S", room: "ROOM_CHILD_1", type: "DORMER_WINDOW", wall: "SOUTH", from_xz: [1.6, UPPER_Z0], to_xz: [3.4, UPPER_Z0], sill_m: 0.6, head_m: 1.9, glazing: "TRIPLE_ALU_CLAD_TIMBER"},
  {id: "OP_CH2_S", room: "ROOM_CHILD_2", type: "DORMER_WINDOW", wall: "SOUTH", from_xz: [5.6, UPPER_Z0], to_xz: [7.4, UPPER_Z0], sill_m: 0.6, head_m: 1.9, glazing: "TRIPLE_ALU_CLAD_TIMBER"},
  {id: "OP_UPBATH_ROOF", room: "ROOM_UPPER_BATH", type: "ROOF_LIGHT", wall: "ROOF_NORTH", from_xz: [-0.6, 0.2], to_xz: [0.6, 1.4], sill_m: null, head_m: null, glazing: "TRIPLE_ROOFLIGHT"},
  // Suterräng — walk-out west
  {id: "OP_GILLE_W", room: "ROOM_GILLESTUGA", type: "SLIDING_DOOR", wall: "WEST", from_xz: [-11, -2.6], to_xz: [-11, 0.4], sill_m: 0.0, head_m: 2.2, glazing: "TRIPLE_ALU_CLAD_TIMBER", note: "The walk-out the 13° slope pays for."},
  {id: "OP_GILLE_S", room: "ROOM_GILLESTUGA", type: "WINDOW", wall: "SOUTH", from_xz: [-9.6, -4], to_xz: [-7.2, -4], sill_m: 0.9, head_m: 2.2, glazing: "TRIPLE_ALU_CLAD_TIMBER"},
  {id: "OP_GUEST_S", room: "ROOM_GUEST", type: "WINDOW", wall: "SOUTH", from_xz: [-4.6, -4], to_xz: [-3.4, -4], sill_m: 0.9, head_m: 2.2, glazing: "TRIPLE_ALU_CLAD_TIMBER"}
];

/* ── assemble ──────────────────────────────────────────────────────────── */

function buildRoom(room) {
  const a = area(room.poly);
  const openings = OPENINGS.filter(o => o.room === room.id).map(o => ({
    ...o,
    length_m: round(Math.hypot(o.to_xz[0] - o.from_xz[0], o.to_xz[1] - o.from_xz[1])),
    area_m2: o.sill_m != null && o.head_m != null
      ? round(Math.hypot(o.to_xz[0] - o.from_xz[0], o.to_xz[1] - o.from_xz[1]) * (o.head_m - o.sill_m))
      : null
  }));
  const glazed = openings.reduce((s, o) => s + (o.area_m2 ?? 0), 0);
  return {
    id: room.id,
    use: room.use,
    storey: room.storey,
    heated: room.heated,
    evidence_class: "CONCEPT",
    footprint_xz: room.poly,
    floor_area_m2: round(a),
    perimeter_m: round(perimeter(room.poly)),
    ceiling_height_m: room.ceiling_m,
    volume_m3: round(a * room.ceiling_m),
    wall_segments: wallsOf(room.id, room.poly, room.ceiling_m),
    openings,
    glazed_area_m2: round(glazed),
    glazing_ratio_of_floor: round(glazed / a, 3),
    finishes: room.finishes,
    ...(room.note ? {note: room.note} : {}),
    ...(room.contains ? {contains: room.contains} : {})
  };
}

const rooms = [...GROUND, ...UPPER, ...SUTER].map(buildRoom);

const sum = predicate => round(rooms.filter(predicate).reduce((s, r) => s + r.floor_area_m2, 0));

const heatedNoSuter = sum(r => r.heated && r.storey !== "SOUTERRAIN");
const heatedWithSuter = sum(r => r.heated);
const cold = sum(r => !r.heated);

// The Brain's brief carries a 210 m² heated figure. Reconcile rather than match.
const BRIEF_HEATED = 210;

const spec = {
  spec_version: "brage-house-geometry/v0.4",
  entity_type: "RoomLevelHouseGeometrySpec",
  spec_id: "BRAGE_SE_SVARTINGE_54_28_HOUSE_V04",
  generated_by: "BRAGE (agent/brage-design) · geometry/build-house-v0.4.mjs",
  generated_at: new Date().toISOString(),
  supersedes: "brage-house-geometry/v0.3 (its wing roof clashed with the rooms below)",
  subject: {
    working_property_identity: "SVÄRTINGE 54:28",
    address: "Säterdalsvägen 14, 605 70 Svärtinge, Norrköping",
    concept_name: "Vinkelhuset mot Glan"
  },
  coordinate_system: {
    binds_scene: "svartinge-neighbourhood-scene/v0.2",
    units: "metres",
    convention: "Local scene frame. South (lake/view side) = negative Z. East = positive X. Y up.",
    finished_floor_Y: {GROUND: 0.0, UPPER: UPPER_FLOOR_Y, SOUTERRAIN: -2.5}
  },
  evidence_policy: {
    all_geometry_class: "CONCEPT",
    statement: "Room geometry is design intent, not a survey. Areas are computed from the declared footprints, not measured on site or taken from a drawing.",
    derived_not_typed: "Every area, perimeter, volume, wall segment and the upper floor's usable width is computed by geometry/build-house-v0.4.mjs from footprint polygons and the roof section.",
    closed_gates: [
      {id: "registered_area", value: "1936.8 m²", source: "Lantmäteriet fastighetsindelning", date: "2026-08-27"},
      {id: "terrain_DTM_slope", value: "13° SW", source: "Spatial Studio 1 m DTM", date: "2026-08-27"}
    ],
    open_gates_blocking_promotion: ["BYA_BTA", "H30_H50_eligibility", "legal_access", "utility_capacity", "VIEWSHED_GLAN"]
  },
  roof: ROOF,
  wing_roof: WING_ROOF,
  upper_floor_derivation: {
    method: "Usable width is the band under the 30° gable where headroom reaches the minimum, measured from the knee wall.",
    headroom_min_m: HEADROOM_MIN,
    knee_wall_m: ROOF.knee_wall_m,
    pitch_deg: ROOF.pitch_deg,
    span_m: ROOF.span_m,
    distance_from_eaves_to_headroom_m: upper.d_to_headroom_m,
    usable_width_m: upper.usable_width_m,
    usable_band_z: [UPPER_Z0, UPPER_Z1],
    note: "The full 7 m span is NOT counted as floor area; only the band that clears 1.9 m."
  },
  rooms,
  area_summary: {
    heated_m2_excl_souterrain: heatedNoSuter,
    heated_m2_incl_souterrain: heatedWithSuter,
    cold_m2: cold,
    ground_footprint_m2: round(area(rect(-11, 9, -4, 3)) + area(rect(3, 11, 3, 11))),
    by_storey: {
      GROUND: sum(r => r.storey === "GROUND"),
      UPPER: sum(r => r.storey === "UPPER"),
      SOUTERRAIN: sum(r => r.storey === "SOUTERRAIN")
    },
    brief_reconciliation: {
      brief_figure_m2: BRIEF_HEATED,
      computed_m2: heatedNoSuter,
      difference_m2: round(heatedNoSuter - BRIEF_HEATED),
      explanation: [
        "The 210 m² in the sprint brief is not reproduced by the geometry, and has not been adjusted to fit.",
        "Computed heated area excludes the garage (cold) and counts the upper floor only where headroom clears 1.9 m under the 30° roof, which is narrower than its 7 m structural span.",
        "The earlier presentation quoted 'markplan ~140 m²', which is the bar alone; the wing's heated rooms (entry hall + utility/WC/laundry) were not in that figure.",
        "It also quoted 'garage ~30 m²' where the v0.2 wing footprint gives 40 m².",
        "Resolution is Brain's: either the brief's 210 is superseded by this computation, or the room program must grow by the stated difference."
      ]
    }
  },
  handoff: {
    to: "Platform (interior build) · Spatial (roof render) · MIMER (rules check)",
    platform_note: "ROOM_GLANRUMMET keeps its v0.2 id and its 7×7 m footprint, so the room Platform already built still resolves.",
    read_order: ["rooms[].footprint_xz", "rooms[].wall_segments", "rooms[].openings", "roof", "wing_roof"]
  }
};

// Assert before writing: a spec whose roof passes through its own rooms must
// never reach disk again.
const failures = roofClearanceFailures(spec);
if (failures.length) {
  console.error("REFUSING TO WRITE — roof clashes with rooms below:");
  for (const f of failures) {
    console.error(`  ${f.room}: ceiling ${f.ceiling_m} m but roof is ${f.lowest_roof_m} m at [${f.at_xz}] (short ${f.shortfall_m} m)`);
  }
  process.exit(1);
}

const out = path.join(here, "house-v0.4-geometry-spec.json");
fs.writeFileSync(out, `${JSON.stringify(spec, null, 2)}\n`);

console.log(`wrote geometry/house-v0.4-geometry-spec.json  ${(JSON.stringify(spec).length / 1024).toFixed(1)} KB`);
console.log(`  rooms            ${rooms.length} (${rooms.filter(r => r.heated).length} heated, ${rooms.filter(r => !r.heated).length} cold)`);
console.log(`  openings         ${OPENINGS.length}`);
console.log(`  heated excl. suterräng  ${heatedNoSuter} m²   incl.  ${heatedWithSuter} m²   cold ${cold} m²`);
console.log(`  by storey        GROUND ${spec.area_summary.by_storey.GROUND} · UPPER ${spec.area_summary.by_storey.UPPER} · SOUTERRAIN ${spec.area_summary.by_storey.SOUTERRAIN}`);
console.log(`  roof             bar ${ROOF.pitch_deg}° gable ridge ${ROOF.ridge_Y} m · wing ${WING_ROOF.pitch_deg}° gable ridge ${WING_ROOF.ridge_Y} m (eaves both ${ROOF.eaves_Y} m)`);
console.log(`  roof clearance   PASS — every roof plane clears every room beneath it`);
console.log(`  upper usable     ${upper.usable_width_m} m of the ${ROOF.span_m} m span (headroom ≥ ${HEADROOM_MIN} m)`);
console.log(`  brief 210 m²     computed ${heatedNoSuter} m² · diff ${spec.area_summary.brief_reconciliation.difference_m2} m² — explained, not adjusted`);
