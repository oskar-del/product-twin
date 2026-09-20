/**
 * Validate geometry/house-v0.3-geometry-spec.json.
 *   node geometry/validate-house-v0.3.mjs
 * Exits non-zero on any failure, so it can gate a commit.
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(fs.readFileSync(path.join(here, "house-v0.3-geometry-spec.json"), "utf8"));
const fail = [];
const check = (ok, message) => { if (!ok) fail.push(message); };

const shoelace = poly => Math.abs(poly.reduce((s, [x1, z1], i) => {
  const [x2, z2] = poly[(i + 1) % poly.length];
  return s + x1 * z2 - x2 * z1;
}, 0)) / 2;

check(spec.spec_version === "brage-house-geometry/v0.3", "spec_version is not v0.3");
check(Array.isArray(spec.rooms) && spec.rooms.length > 0, "no rooms");
check(spec.rooms.some(r => r.id === "ROOM_GLANRUMMET"), "ROOM_GLANRUMMET missing — Platform reads that id");
check(spec.roof?.pitch_deg === 30, "roof pitch is not 30°");
check(spec.roof?.ridge_Y > spec.roof?.eaves_Y, "ridge is not above the eaves");
check(Boolean(spec.wing_roof?.type), "wing roof type not stated");

const ids = new Set();
for (const room of spec.rooms) {
  check(!ids.has(room.id), `duplicate room id ${room.id}`); ids.add(room.id);
  check(room.floor_area_m2 > 0, `${room.id}: no floor area`);
  check(Math.abs(shoelace(room.footprint_xz) - room.floor_area_m2) < 0.01, `${room.id}: stated area ≠ its polygon`);
  check(room.ceiling_height_m > 0, `${room.id}: no ceiling height`);
  check(room.wall_segments?.length === room.footprint_xz.length, `${room.id}: wall segments ≠ polygon edges`);
  check(Boolean(room.finishes?.floor && room.finishes?.walls && room.finishes?.ceiling), `${room.id}: finishes incomplete`);
  for (const o of room.openings ?? []) {
    check(o.sill_m == null || o.head_m > o.sill_m, `${o.id}: head is not above sill`);
    check(Boolean(o.wall), `${o.id}: no wall/orientation`);
  }
}

const heated = spec.rooms.filter(r => r.heated && r.storey !== "SOUTERRAIN")
  .reduce((s, r) => s + r.floor_area_m2, 0);
check(Math.abs(heated - spec.area_summary.heated_m2_excl_souterrain) < 0.01, "heated summary ≠ sum of heated rooms");
const recon = spec.area_summary.brief_reconciliation;
check(Math.abs(recon.computed_m2 - recon.brief_figure_m2 - recon.difference_m2) < 0.01, "reconciliation arithmetic is wrong");
check(recon.explanation?.length > 0, "difference from the brief is not explained");

console.log(fail.length ? `FAIL (${fail.length})\n  ${fail.join("\n  ")}` : `PASS · ${spec.rooms.length} rooms · ${spec.rooms.reduce((s, r) => s + (r.openings?.length ?? 0), 0)} openings · heated ${heated.toFixed(1)} m² (brief ${recon.brief_figure_m2}, diff ${recon.difference_m2})`);
process.exit(fail.length ? 1 : 0);
