/**
 * Put the shoppable room INSIDE the house.
 *
 * SPRINT DAY 2026-09-20 item 3. The Newport living room floats in a 6 × 5 m abstract box.
 * BRAGE's Vinkelhuset spec defines the room it should actually live in — ROOM_GLANRUMMET, the
 * west view/evening room — so this compiler takes that room's real volume and its own stated
 * glazing, and re-seats the same Newport products in it.
 *
 * Nothing about the products changes: every commerce payload, and therefore every BUY link, is
 * copied from the compiled Newport scene byte-for-byte. Only the shell and the positions differ.
 *
 *   node scripts/compile-room-in-house.mjs
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// BRAGE's room-level spec, read live from their worktree — never a vendored copy,
// which goes stale the moment they regenerate. v0.3 supersedes the in-scene patch
// as the source for room volumes and openings: the patch states a massing box and
// a prose "fully glazed south+west", the spec states the actual opening schedule.
const BRAGE = path.resolve(root,
  "../repo-brage/OPEN AI/Säterdalsvägen 14 - Svärtinge/04-House-Design/BRAGE/geometry/house-v0.3-geometry-spec.json");
const SOURCE = path.join(root, "data/scenes/shoppable-room-newport-living/scene-v0.1.json");
const OUT_DIR = path.join(root, "data/scenes/room-glanrummet-newport");

const read = f => JSON.parse(fs.readFileSync(f, "utf8"));

// New seating plan for a 7 × 7 m room glazed on its south and west faces: the sofa backs onto
// the solid north wall and faces the lake, the armchair turns into the west glazing, and the
// media unit takes the one wall that is neither glass nor the doorway to the kitchen.
const PLAN = {
  SOFA:        {x: 0.2,  z: 0.8,  rot: 180},
  COFFEE_TABLE:{x: 0.2,  z: -0.8, rot: 0},
  ARMCHAIR:    {x: -2.3, z: -1.0, rot: 100},
  SIDE_TABLE:  {x: 2.0,  z: 0.8,  rot: 0},
  MEDIA_UNIT:  {x: 3.0,  z: -0.6, rot: -90},
  FOOTSTOOL:   {x: -0.6, z: -1.9, rot: 0},
  RUG:         {x: 0.2,  z: -0.4, rot: 0}
};
// Attached pieces keep their offset from the base they sit on, so cushions stay on the sofa.
const ATTACHED_TO = {CUSHION_A: "SOFA", CUSHION_B: "SOFA", VASE: "COFFEE_TABLE", TABLE_LAMP: "SIDE_TABLE"};

function main() {
  const spec = read(BRAGE);
  const room = (spec.rooms ?? []).find(r => r.id === "ROOM_GLANRUMMET");
  if (!room) throw new Error(`ROOM_GLANRUMMET not found in ${spec.spec_id ?? "BRAGE spec"}`);

  // Volume is computed from the stated footprint and ceiling height — not from a
  // massing box. v0.3 gives 2.7 m clear; the v0.2 patch said 3.0, which was the
  // structural plate height, not the room.
  const xs = room.footprint_xz.map(p => p[0]);
  const zs = room.footprint_xz.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const height = room.ceiling_height_m;
  if (!(width > 0 && depth > 0 && height > 0)) {
    throw new Error(`ROOM_GLANRUMMET geometry is not usable: ${width}x${depth}x${height}`);
  }
  // Room-local frame: the spec is in house coordinates, the scene is centred on the room.
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  // Openings come from the spec's own schedule. Nothing is inferred from prose and
  // no margin, sill or head is invented here: if the spec states no opening for this
  // room, the room renders solid and that is the honest answer.
  const specOpenings = (room.openings ?? []);
  if (specOpenings.length === 0) {
    throw new Error("ROOM_GLANRUMMET states no openings in the spec — refusing to invent glazing");
  }

  const wallFaces = new Set((room.wall_segments ?? []).map(w => w.faces));
  const openings = specOpenings.map(o => {
    const [ax, az] = o.from_xz;
    const [bx, bz] = o.to_xz;
    const sill = o.sill_m;
    const head = o.head_m;
    if (!(head > sill)) throw new Error(`${o.id}: head_m ${head} is not above sill_m ${sill}`);
    if (o.wall && wallFaces.size && !wallFaces.has(o.wall)) {
      throw new Error(`${o.id}: sits on wall "${o.wall}", which is not a stated wall face of this room`);
    }

    const runX = Math.abs(bx - ax);
    const runZ = Math.abs(bz - az);
    const horizontal = runX >= runZ;          // opening runs along X (a south/north wall)
    const length = horizontal ? runX : runZ;
    const midX = (ax + bx) / 2 - cx;
    const midZ = (az + bz) / 2 - cz;

    const isDoor = /DOOR/i.test(o.type ?? "");
    return {
      id: o.id,
      type: "OPENING",
      label: `${o.id} — ${String(o.type ?? "opening").replace(/_/g, " ").toLowerCase()} on the ${String(o.wall ?? "").toLowerCase()} wall`,
      evidence_class: "CONCEPT",
      source_refs: [
        `${spec.spec_id} ROOM_GLANRUMMET.openings[${o.id}]`,
        `BRAGE ${spec.spec_version} · generated ${spec.generated_at}`
      ],
      limitations: [
        `Extent, sill ${sill} m and head ${head} m are BRAGE's stated values; frame, mullion and ironmongery are not specified.`,
        o.note ? `Spec note: ${o.note}` : null,
        "Anything visible through this opening is a VISUALIZATION. No outlook, sightline or lake view is claimed or measured here."
      ].filter(Boolean),
      geometry: {
        primitive: "BOX",
        size: horizontal ? [length, head - sill, 0.12] : [length, head - sill, 0.12],
        position: [midX, (sill + head) / 2, midZ],
        rotation_y_deg: horizontal ? 0 : 90
      },
      opening_schedule: {
        wall: o.wall ?? null,
        opening_type: o.type ?? null,
        sill_m: sill,
        head_m: head,
        length_m: o.length_m ?? Number(length.toFixed(3)),
        area_m2: o.area_m2 ?? null,
        glazing: o.glazing ?? null,
        is_door: isDoor,
        source: "BRAGE_SPEC_V03_OPENING_SCHEDULE"
      }
    };
  });

  const source = read(SOURCE);
  const byId = new Map(source.elements.map(e => [e.id, e]));
  const moved = [];
  const place = (element, x, z, rot) => {
    const next = structuredClone(element);
    next.geometry = {...next.geometry, position: [x, element.geometry.position[1], z], rotation_y_deg: rot};
    return next;
  };

  for (const [id, spot] of Object.entries(PLAN)) {
    const element = byId.get(id);
    if (!element) throw new Error(`source scene has no ${id}`);
    moved.push(place(element, spot.x, spot.z, spot.rot));
  }
  for (const [id, baseId] of Object.entries(ATTACHED_TO)) {
    const element = byId.get(id);
    const base = byId.get(baseId);
    if (!element || !base) continue;
    const dx = element.geometry.position[0] - base.geometry.position[0];
    const dz = element.geometry.position[2] - base.geometry.position[2];
    moved.push(place(element, PLAN[baseId].x + dx, PLAN[baseId].z + dz, element.geometry.rotation_y_deg ?? 0));
  }

  const shell = [
    {
      // Non-pickable: this volume encloses every product, so leaving it
      // pickable means every click lands on the box instead of the sofa.
      id: "ROOM_GLANRUMMET", type: "ROOM", picking: false,
      label: `Glanrummet — ${room.floor_area_m2} m² · ${room.ceiling_height_m} m clear`,
      evidence_class: room.evidence_class ?? "CONCEPT",
      source_refs: [`${spec.spec_id} rooms[ROOM_GLANRUMMET]`, `BRAGE ${spec.spec_version}`],
      limitations: [
        "Concept room volume from BRAGE's house design. No entitlement, buildable envelope or floor level is established for this plot.",
        `Footprint ${width} × ${depth} m and ${height} m clear height are the spec's computed values, not a survey.`
      ],
      geometry: {primitive: "ROOM_VOLUME", size: [width, height, depth], position: [0, height / 2, 0], rotation_y_deg: 0, intended_use: room.use}
    },
    {
      id: "ROOM_FLOOR", type: "TERRAIN", label: "Room floor",
      evidence_class: "CONCEPT", source_refs: ["SHOPPABLE_ROOM_COMPILER"],
      limitations: ["Flat reference plane for the room volume."],
      geometry: {primitive: "GRID_SURFACE", size_m: Math.max(width, depth), segments: 1,
        vertices: [[-width / 2, 0, -depth / 2], [width / 2, 0, -depth / 2], [-width / 2, 0, depth / 2], [width / 2, 0, depth / 2]],
        method: "FLAT", height_reference: "LOCAL_RELATIVE"}
    },
    ...openings
  ];

  const scene = {
    ...source,
    scene_id: "SCENE_ROOM_GLANRUMMET_NEWPORT_V01",
    generated_at: new Date().toISOString(),
    subject: {
      label: "Glanrummet — Newport set inside BRAGE's Vinkelhuset",
      identity_evidence_class: "CONCEPT",
      identity_scope: "CONCEPT_ROOM_IN_CONCEPT_HOUSE"
    },
    // Inheriting the source room's policy would understate what this scene shows:
    // it sits inside a CONCEPT house, and its whole subject is an outlook over
    // Glan. Both need blocking explicitly.
    legal_claim_policy: {
      ...source.legal_claim_policy,
      blocked_claims: [
        ...new Set([
          ...(source.legal_claim_policy?.blocked_claims ?? []),
          "BUILDABLE_ENVELOPE",
          "VIEW_OR_OUTLOOK",
          "FLOOR_LEVEL"
        ])
      ],
      rule: "A shoppable room claims nothing about any real site. The house and this room are BRAGE's CONCEPT proposal: no entitlement, buildable envelope, floor level or access is established. Anything seen through the glazing is a VISUALIZATION — a rendered horizon is never a view claim, and no sightline to Glan has been measured here. Product geometry is a G2 proxy: real footprint and height, representative shape. BUY links carry the channel's own tracking parameters verbatim."
    },
    elements: [...shell, ...moved],
    house_context: {
      house: "Vinkelhuset mot Glan",
      spec: {
        id: spec.spec_id,
        version: spec.spec_version,
        generated_at: spec.generated_at,
        supersedes: spec.supersedes ?? null
      },
      room: {
        floor_area_m2: room.floor_area_m2,
        ceiling_height_m: room.ceiling_height_m,
        volume_m3: room.volume_m3,
        glazed_area_m2: room.glazed_area_m2 ?? null,
        glazing_ratio_of_floor: room.glazing_ratio_of_floor ?? null,
        finishes: room.finishes ?? null
      },
      // Where this room sits in the house frame; the scene itself is centred on the room.
      room_centre_in_house_xz: [cx, cz],
      room_footprint_xz: room.footprint_xz,
      roof: spec.roof
        ? {type: spec.roof.type, pitch_deg: spec.roof.pitch_deg, ridge_axis: spec.roof.ridge_axis,
           ridge_Y: spec.roof.ridge_Y, eaves_Y: spec.roof.eaves_Y, eaves_overhang_m: spec.roof.eaves_overhang_m}
        : null,
      note: "The room is compiled at its own origin; room_centre_in_house_xz is where it sits in the house frame. Roof is carried for context only — this scene renders the room interior, not the envelope."
    }
  };

  fs.mkdirSync(OUT_DIR, {recursive: true});
  const out = path.join(OUT_DIR, "scene-v0.1.json");
  fs.writeFileSync(out, `${JSON.stringify(scene, null, 2)}\n`);

  const shoppable = scene.elements.filter(e => e.commerce?.buy_url);
  const sourceShoppable = source.elements.filter(e => e.commerce?.buy_url);
  const sourceLinks = new Map(sourceShoppable.map(e => [e.id, e.commerce.buy_url]));
  const changed = shoppable.filter(e => sourceLinks.get(e.id) !== e.commerce.buy_url);

  const glazedArea = openings.reduce((sum, o) => sum + (o.opening_schedule.area_m2 ?? 0), 0);

  // Cross-check: the areas we carried per opening must add up to the room total the
  // spec computed independently. If these ever diverge we are reading the schedule
  // wrongly — better to stop than to ship a room whose glazing is quietly invented.
  if (typeof room.glazed_area_m2 === "number") {
    const drift = Math.abs(glazedArea - room.glazed_area_m2);
    if (drift > 0.01) {
      throw new Error(
        `glazed area mismatch: openings sum to ${glazedArea.toFixed(2)} m² but the spec states ` +
        `${room.glazed_area_m2} m² (drift ${drift.toFixed(3)} m²) — the opening schedule is not being read correctly`
      );
    }
  }

  console.log(`wrote ${path.relative(root, out)}`);
  console.log(`  spec        ${spec.spec_id} · ${spec.spec_version} · generated ${spec.generated_at}`);
  console.log(`  room        ROOM_GLANRUMMET · ${room.floor_area_m2} m² · ${room.volume_m3} m³`);
  console.log(`  volume      ${width} × ${depth} m footprint · ${height} m clear (computed from footprint_xz + ceiling_height_m)`);
  console.log(`  openings    ${openings.length} from the spec's schedule:`);
  for (const o of openings) {
    const k = o.opening_schedule;
    console.log(`                ${o.id.padEnd(13)} ${String(k.wall).padEnd(5)} ${String(k.opening_type).padEnd(14)} ${k.length_m} m · sill ${k.sill_m} → head ${k.head_m} m · ${k.area_m2} m²`);
  }
  console.log(`  glazed area ${glazedArea.toFixed(2)} m² computed · ${room.glazed_area_m2 ?? "?"} m² stated by the spec`);
  console.log(`  elements    ${scene.elements.length} · ${shoppable.length} shoppable`);
  console.log(`  BUY links   ${shoppable.length - changed.length}/${shoppable.length} byte-identical to the source scene${changed.length ? ` — CHANGED: ${changed.map(e => e.id).join(", ")}` : ""}`);
  if (changed.length) process.exit(1);
}
main();
