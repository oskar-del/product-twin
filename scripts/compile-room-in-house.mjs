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
const BRAGE = path.resolve(root,
  "../repo-brage/OPEN AI/Säterdalsvägen 14 - Svärtinge/04-House-Design/BRAGE/geometry/house-in-scene-v0.3-patch.json");
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
  const patch = read(BRAGE);
  const room = patch.add_elements.find(e => e.id === "ROOM_GLANRUMMET");
  if (!room) throw new Error("ROOM_GLANRUMMET not found in BRAGE patch");
  const [width, height, depth] = room.geometry.size;

  // The openings are BRAGE's, not ours: the room element itself states "Fully glazed
  // south+west". We render that as one wall-sized opening per glazed face, inset from the
  // structure, and we do not add a single opening the spec does not claim.
  const feature = room.feature ?? "";
  const glazedSouth = /south/i.test(feature) && /glaz/i.test(feature);
  const glazedWest = /west/i.test(feature) && /glaz/i.test(feature);
  if (!glazedSouth && !glazedWest) throw new Error(`no glazing stated for ROOM_GLANRUMMET: "${feature}"`);

  const margin = 0.3;                       // structure left at the wall edges
  const sill = 0.1;
  const headHeight = height - 0.25;
  const openings = [];
  if (glazedSouth) {
    openings.push({
      id: "GLAZ_GLANRUMMET_S", type: "OPENING",
      label: "Glanrummet south glazing — full-height toward the lake",
      evidence_class: "CONCEPT",
      source_refs: ["BRAGE house-in-scene-v0.3-patch ROOM_GLANRUMMET.feature"],
      limitations: ["Glazed extent is read from BRAGE's stated 'fully glazed south+west'; no mullion, frame or opening schedule is specified yet."],
      geometry: {primitive: "BOX", size: [width - margin * 2, headHeight - sill, 0.12],
        position: [0, (sill + headHeight) / 2, -depth / 2], rotation_y_deg: 0}
    });
  }
  if (glazedWest) {
    openings.push({
      id: "GLAZ_GLANRUMMET_W", type: "OPENING",
      label: "Glanrummet west glazing — evening sun",
      evidence_class: "CONCEPT",
      source_refs: ["BRAGE house-in-scene-v0.3-patch ROOM_GLANRUMMET.feature"],
      limitations: ["Glazed extent is read from BRAGE's stated 'fully glazed south+west'; the spec notes the glazing is splayed toward the lake, which this orthogonal volume does not model."],
      geometry: {primitive: "BOX", size: [depth - margin * 2, headHeight - sill, 0.12],
        position: [-width / 2, (sill + headHeight) / 2, 0], rotation_y_deg: 90}
    });
  }

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
      id: "ROOM_GLANRUMMET", type: "ROOM", label: room.label,
      evidence_class: "CONCEPT",
      source_refs: room.source_refs,
      limitations: ["Concept room volume from BRAGE's house design. No entitlement, buildable envelope or floor level is established for this plot."],
      geometry: {primitive: "ROOM_VOLUME", size: [width, height, depth], position: [0, height / 2, 0], rotation_y_deg: 0, intended_use: room.intended_use}
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
    elements: [...shell, ...moved],
    house_context: {
      house: "Vinkelhuset mot Glan",
      patch: "house-in-scene-v0.3-patch.json",
      room_origin_in_house: room.geometry.position,
      note: "The room is compiled at its own origin; room_origin_in_house is where it sits in the house scene."
    }
  };

  fs.mkdirSync(OUT_DIR, {recursive: true});
  const out = path.join(OUT_DIR, "scene-v0.1.json");
  fs.writeFileSync(out, `${JSON.stringify(scene, null, 2)}\n`);

  const shoppable = scene.elements.filter(e => e.commerce?.buy_url);
  const sourceShoppable = source.elements.filter(e => e.commerce?.buy_url);
  const sourceLinks = new Map(sourceShoppable.map(e => [e.id, e.commerce.buy_url]));
  const changed = shoppable.filter(e => sourceLinks.get(e.id) !== e.commerce.buy_url);

  console.log(`wrote ${path.relative(root, out)}`);
  console.log(`  room        ${room.label}`);
  console.log(`  volume      ${width} × ${height} × ${depth} m (BRAGE ROOM_GLANRUMMET)`);
  console.log(`  glazing     ${openings.map(o => o.id).join(", ") || "none"} — from "${feature}"`);
  console.log(`  elements    ${scene.elements.length} · ${shoppable.length} shoppable`);
  console.log(`  BUY links   ${shoppable.length - changed.length}/${shoppable.length} byte-identical to the source scene${changed.length ? ` — CHANGED: ${changed.map(e => e.id).join(", ")}` : ""}`);
  if (changed.length) process.exit(1);
}
main();
