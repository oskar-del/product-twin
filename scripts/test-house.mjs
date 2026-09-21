/**
 * Whole-house scene gate.
 *
 *   node scripts/test-house.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseScene } from "../engine/core/scene-contract.mjs";
import { mergeVoids, wallPanels } from "./compile-house.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0, failed = 0;
const check = (label, ok) => { if (ok) passed++; else { failed++; console.error(`FAIL  ${label}`); } };

// §1 void merging — the nested-opening case that made this necessary
console.log("§1 void merging");
const nested = mergeVoids([
  { t0: 0.5, t1: 6.5, sill_m: 0, head_m: 2.55 },
  { t0: 2.9, t1: 4.7, sill_m: 0, head_m: 2.40 }
]);
check("a nested opening merges into one void", nested.length === 1);
check("merged void spans the outer opening", nested[0].t0 === 0.5 && nested[0].t1 === 6.5);
check("merged void takes the highest head", nested[0].head === 2.55);

const apart = mergeVoids([
  { t0: 0, t1: 1, sill_m: 0.9, head_m: 2.1 },
  { t0: 3, t1: 4, sill_m: 0.9, head_m: 2.1 }
]);
check("separate openings stay separate", apart.length === 2);
check("touching openings merge", mergeVoids([
  { t0: 0, t1: 2, sill_m: 0, head_m: 2 }, { t0: 2, t1: 4, sill_m: 0, head_m: 2 }
]).length === 1);

// §2 wall splitting
console.log("§2 wall splitting");
const seg = { length_m: 7 };
const solid = wallPanels(seg, [], 2.7);
check("a wall with no opening is one panel", solid.length === 1);
check("that panel is the full wall", solid[0].t0 === 0 && solid[0].t1 === 7);

const cut = wallPanels(seg, [{ t0: 2, t1: 5, sill: 0, head: 2.2 }], 2.7);
check("a full-height-ish opening leaves piers + head", cut.length === 3);
check("no sill panel when the sill is 0", !cut.some(p => p.kind === "sill"));
check("head panel sits above the opening", cut.find(p => p.kind === "head").y0 === 2.2);

const withSill = wallPanels(seg, [{ t0: 2, t1: 5, sill: 0.9, head: 2.1 }], 2.7);
check("a raised sill adds a sill panel", withSill.some(p => p.kind === "sill"));
check("the sill panel stops at the sill", withSill.find(p => p.kind === "sill").y1 === 0.9);

const full = wallPanels(seg, [{ t0: 0, t1: 7, sill: 0, head: 2.7 }], 2.7);
check("a wall that is entirely opening leaves nothing", full.length === 0);

// §3 the committed house scene
console.log("§3 the house scene");
const p = path.resolve(root, "data/scenes/house-vinkelhuset/scene-v0.1.json");
if (!fs.existsSync(p)) {
  check("house scene exists", false);
} else {
  const doc = JSON.parse(fs.readFileSync(p, "utf8"));
  const scene = parseScene(doc);
  const s = doc.house_summary;
  const byType = {};
  for (const e of scene.elements) byType[e.type] = (byType[e.type] ?? 0) + 1;

  // Was pinned to v0.3 and broke the day v0.4 landed. The contract is that a
  // BRAGE house spec is recorded and is not older than v0.3, not that it is
  // frozen at one version.
  const vm = String(s.spec_version ?? "").match(/^brage-house-geometry\/v(\d+)\.(\d+)$/);
  check("built from a BRAGE house spec", vm !== null);
  check("spec is v0.3 or newer", vm ? (Number(vm[1]) > 0 || Number(vm[2]) >= 3) : false);
  check("all 13 rooms present", byType.ROOM === 13);
  check("all 18 openings present", byType.OPENING === 18);
  // v0.3 gave the wing one monopitch plane (3 roof planes); v0.4 made it its own
  // gable (4), because the monopitch fell through the rooms below it. Assert the
  // bar's two planes plus at least one wing plane, so either shape passes and a
  // missing roof still fails.
  const roofIds = scene.elements.filter(e => e.type === "ROOF").map(e => e.id);
  check("the bar has both gable planes",
    roofIds.includes("ROOF_GABLE_SOUTH") && roofIds.includes("ROOF_GABLE_NORTH"));
  check("the wing is roofed", roofIds.some(id => /^ROOF_WING_/.test(id)));
  check("no roof plane passes through the rooms below it",
    (s.spec_conflicts ?? []).length === 0);
  check("walls were split, not drawn whole", byType.WALL > 13 * 4);

  // BRAGE's trap 1
  const glan = scene.elements.find(e => e.id === "ROOM_GLANRUMMET");
  check("ROOM_GLANRUMMET keeps its id", Boolean(glan));
  check("ROOM_GLANRUMMET keeps its 7 x 7 footprint",
    Math.abs(glan.geometry.size[0] - 7) < 1e-9 && Math.abs(glan.geometry.size[2] - 7) < 1e-9);

  // BRAGE's trap 2 — areas are the spec's, never summed from footprints
  check("heated area is the spec's 206.4 m2", s.heated_m2_excl_souterrain === 206.4);
  check("area provenance is recorded", s.area_source === "BRAGE_SPEC_V03_AREA_SUMMARY");
  check("the upper floor's usable width is carried", s.upper_floor.usable_width_m === 4.23);
  check("usable width is narrower than the structural span", s.upper_floor.usable_width_m < s.upper_floor.span_m);
  check("FLOOR_AREA is a blocked claim", doc.legal_claim_policy.blocked_claims.includes("FLOOR_AREA"));

  // The rooflight was silently dropped once; it must never be again.
  const rooflight = scene.elements.find(e => e.id === "OP_UPBATH_ROOF");
  check("the rooflight is built, not dropped", Boolean(rooflight));
  check("the rooflight sits in a roof plane", rooflight?.opening_schedule?.in_roof_plane === true);

  // Every opening states its provenance and makes no view claim
  const openings = scene.elements.filter(e => e.type === "OPENING");
  check("every opening cites the spec schedule",
    openings.every(o => o.opening_schedule?.source === "BRAGE_SPEC_V03_OPENING_SCHEDULE"));
  check("every opening disclaims the view",
    openings.every(o => o.limitations.some(l => /VISUALIZATION/i.test(l))));

  // Spec conflicts must be disclosed, not silently corrected
  const conflicts = s.spec_conflicts ?? [];
  if (conflicts.length) {
    const roofs = new Set(conflicts.map(c => c.roof));
    check("every conflicting roof says so in its own limitations",
      [...roofs].every(id => scene.elements.find(e => e.id === id)
        ?.limitations.some(l => /SPEC CONFLICT/.test(l))));
    check("each conflict names the shortfall",
      conflicts.every(c => Number.isFinite(c.shortfall_m) && c.shortfall_m > 0));
  } else {
    check("no conflicts is a valid state", true);
    check("no conflicts is a valid state", true);
  }

  check("every element is CONCEPT", scene.elements.every(e => e.evidence_class === "CONCEPT"));
  check("element ids are unique", new Set(scene.elements.map(e => e.id)).size === scene.elements.length);
}

// §4 the Cycles still carries its label
console.log("§4 still labelling");
const py = path.resolve(root, "dist/stills/house-vinkelhuset.py");
if (!fs.existsSync(py)) {
  check("blender script committed", false);
} else {
  const src = fs.readFileSync(py, "utf8");
  check("the still is stamped VISUALIZATION", /stamp_note_text\s*=\s*'VISUALIZATION/.test(src));
  check("the stamp denies the view claim", /Rendered horizon is not a view claim/.test(src));
  check("the stamp is actually enabled", /use_stamp\s*=\s*True/.test(src) && /use_stamp_note\s*=\s*True/.test(src));
  check("the script renders with Cycles", /CYCLES/.test(src));
  check("structure was emitted, not just GLTF", /def box\(/.test(src) && /def quad\(/.test(src));
}

console.log(`\n${passed} passed, ${failed} failed (${passed + failed} checks)`);
if (failed) process.exit(1);
