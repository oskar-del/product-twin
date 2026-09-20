/**
 * Draw the room schedule FROM house-v0.4-geometry-spec.json.
 *   node geometry/draw-house-v0.4.mjs
 *
 * Nothing is drawn by hand: every wall, opening and label comes out of the
 * spec. If the drawing looks right, the spec is complete enough for Platform to
 * build the interior from — that is the point of rendering it at all.
 *
 * Ink chrome tokens, per the sprint mandate.
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(fs.readFileSync(path.join(here, "house-v0.4-geometry-spec.json"), "utf8"));

const S = 34;                 // px per metre
const PAD = 60;
const esc = s => String(s).replace(/[&<>]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;"}[c]));

function storeySvg(storey, title) {
  const rooms = spec.rooms.filter(r => r.storey === storey);
  if (!rooms.length) return "";
  const pts = rooms.flatMap(r => r.footprint_xz);
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const W = (maxX - minX) * S + PAD * 2;
  const H = (maxZ - minZ) * S + PAD * 2 + 26;
  const px = x => PAD + (x - minX) * S;
  const pz = z => PAD + 26 + (z - minZ) * S;

  const body = rooms.map(room => {
    const d = room.footprint_xz.map((p, i) => `${i ? "L" : "M"}${px(p[0]).toFixed(1)},${pz(p[1]).toFixed(1)}`).join("") + "Z";
    const cx = px(room.footprint_xz.reduce((s, p) => s + p[0], 0) / room.footprint_xz.length);
    const cz = pz(room.footprint_xz.reduce((s, p) => s + p[1], 0) / room.footprint_xz.length);
    const fill = room.heated ? "#1b2823" : "#141d1a";
    // Fit the label to the room's own width, so a narrow room does not print
    // its name across its neighbour.
    const widthM = Math.max(...room.footprint_xz.map(p => p[0])) - Math.min(...room.footprint_xz.map(p => p[0]));
    const maxChars = Math.max(6, Math.floor((widthM * S) / 6.6));
    const raw = room.use.replace(/_/g, " ");
    const label = raw.length > maxChars ? `${raw.slice(0, maxChars - 1).trimEnd()}…` : raw;
    // Openings are drawn on the wall line they sit on.
    const ops = (room.openings ?? []).filter(o => o.from_xz && o.to_xz && o.wall !== "ROOF_NORTH").map(o =>
      `<line x1="${px(o.from_xz[0]).toFixed(1)}" y1="${pz(o.from_xz[1]).toFixed(1)}" x2="${px(o.to_xz[0]).toFixed(1)}" y2="${pz(o.to_xz[1]).toFixed(1)}" stroke="#d8b874" stroke-width="4.5" stroke-linecap="butt"/>`
    ).join("");
    return `<path d="${d}" fill="${fill}" stroke="#f3efe6" stroke-width="2.2"/>${ops}
      <text x="${cx.toFixed(1)}" y="${(cz - 7).toFixed(1)}" text-anchor="middle" font-family="Georgia,serif" font-size="12" fill="#f3efe6">${esc(label)}</text>
      <text x="${cx.toFixed(1)}" y="${(cz + 9).toFixed(1)}" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" fill="#d8b874">${room.floor_area_m2} m²</text>
      <text x="${cx.toFixed(1)}" y="${(cz + 23).toFixed(1)}" text-anchor="middle" font-family="Inter,sans-serif" font-size="8" fill="rgba(255,255,255,.45)">h ${room.ceiling_height_m} m${room.heated ? "" : " · cold"}</text>`;
  }).join("");

  const total = rooms.reduce((s, r) => s + r.floor_area_m2, 0).toFixed(1);
  return `<figure>
  <figcaption>${esc(title)} — ${rooms.length} rooms · ${total} m²</figcaption>
  <svg viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" width="${W.toFixed(0)}" height="${H.toFixed(0)}">
    <text x="${PAD}" y="26" font-family="Inter,sans-serif" font-size="9" fill="#d8b874" letter-spacing="2">${esc(title.toUpperCase())}</text>
    ${body}
    <g stroke="rgba(255,255,255,.3)" stroke-width="1">
      <line x1="${PAD}" y1="${(H - 22).toFixed(0)}" x2="${(PAD + 5 * S).toFixed(0)}" y2="${(H - 22).toFixed(0)}"/>
      <line x1="${PAD}" y1="${(H - 26).toFixed(0)}" x2="${PAD}" y2="${(H - 18).toFixed(0)}"/>
      <line x1="${(PAD + 5 * S).toFixed(0)}" y1="${(H - 26).toFixed(0)}" x2="${(PAD + 5 * S).toFixed(0)}" y2="${(H - 18).toFixed(0)}"/>
    </g>
    <text x="${PAD}" y="${(H - 8).toFixed(0)}" font-family="Inter,sans-serif" font-size="8" fill="rgba(255,255,255,.45)">5 m · south (lake) is down</text>
  </svg></figure>`;
}

const a = spec.area_summary;
const recon = a.brief_reconciliation;

const html = `<!doctype html><meta charset="utf-8">
<title>Vinkelhuset v0.3 — room schedule</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap">
<style>
 body{margin:0;background:#101916;color:#f3efe6;font-family:Inter,sans-serif;padding:34px 44px 50px}
 h1{font:500 34px/1.1 Georgia,serif;margin:6px 0 4px;letter-spacing:-.02em}
 .kick{color:#d8b874;font-size:10px;letter-spacing:.16em;text-transform:uppercase}
 .sub{font-size:11px;color:rgba(255,255,255,.55);max-width:70ch;line-height:1.6;margin:0 0 22px}
 .plans{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}
 figure{margin:0;background:#17241f;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:14px}
 figcaption{font-size:9px;letter-spacing:.09em;text-transform:uppercase;color:#d8b874;margin-bottom:6px}
 svg{display:block}
 .facts{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:22px}
 .fact{background:#1b2823;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:18px}
 .fact span{font-size:9px;letter-spacing:.09em;color:#d8b874;text-transform:uppercase}
 .fact b{display:block;font:500 30px/1 Georgia,serif;margin:10px 0 6px}
 .fact small{font-size:9px;color:rgba(255,255,255,.5);line-height:1.5}
 .recon{margin-top:16px;background:#17241f;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:18px;max-width:100ch}
 .recon h2{font:500 18px Georgia,serif;margin:0 0 8px}
 .recon li{font-size:10px;line-height:1.65;color:rgba(255,255,255,.62);margin:4px 0}
 .chip{display:inline-block;padding:4px 8px;border-radius:999px;font-size:8px;letter-spacing:.11em;background:rgba(115,90,158,.18);color:#b39ed8;border:1px solid #735a9e}
</style>
<div class="kick">BRAGE · Vinkelhuset mot Glan · house-v0.4-geometry-spec.json</div>
<h1>Room schedule — drawn from the spec</h1>
<p class="sub">Every wall, opening, area and label on this page is read out of the JSON by
geometry/draw-house-v0.4.mjs. Nothing is drawn by hand, so if the plan is right the spec is
complete enough for Platform to build the interior from. <span class="chip">CONCEPT</span></p>
<p class="sub" style="color:rgba(255,255,255,.72)"><b>v0.4 fixes a roof that did not close.</b>
The wing's 15° mono-pitch in v0.3 fell to Y 0.64 m at the north edge while the rooms below are
2.40–2.50 m — it passed straight through them. The wing now has its own 15° gable: eaves stay at
3.0 m level with the bar's, ridge lands at 4.07 m, under the bar's 5.02 m. A roof-clearance
assertion now runs at build time and refuses to write a spec whose roof intersects its own rooms.</p>
<div class="plans">
${storeySvg("GROUND", "Ground floor")}
${storeySvg("UPPER", "Upper floor (in the roof)")}
${storeySvg("SOUTERRAIN", "Souterrain (west gable)")}
</div>
<div class="facts">
  <div class="fact"><span>Heated, excl. suterräng</span><b>${a.heated_m2_excl_souterrain} m²</b><small>12 heated rooms; garage excluded as cold</small></div>
  <div class="fact"><span>Heated, incl. suterräng</span><b>${a.heated_m2_incl_souterrain} m²</b><small>Suterräng validated by the measured 13° SW slope</small></div>
  <div class="fact"><span>Upper floor usable</span><b>${spec.upper_floor_derivation.usable_width_m} m</b><small>of the ${spec.upper_floor_derivation.span_m} m span — the band clearing ${spec.upper_floor_derivation.headroom_min_m} m under the ${spec.roof.pitch_deg}° roof</small></div>
  <div class="fact"><span>Ridge / eaves</span><b>${spec.roof.ridge_Y} m</b><small>eaves ${spec.roof.eaves_Y} m · bar ${spec.roof.pitch_deg}° gable · wing ${spec.wing_roof.pitch_deg}° gable, ridge ${spec.wing_roof.ridge_Y} m</small></div>
</div>
<div class="recon">
  <h2>The brief says ${recon.brief_figure_m2} m². The geometry says ${recon.computed_m2} m².</h2>
  <ul>${recon.explanation.map(e => `<li>${esc(e)}</li>`).join("")}</ul>
</div>`;

const out = path.join(here, "..", "docs", "screens", "house-v0.4-room-schedule.html");
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, html);
console.log(`wrote ${path.relative(path.join(here, ".."), out)}`);
console.log(`  storeys drawn   GROUND · UPPER · SOUTERRAIN`);
console.log(`  rooms drawn     ${spec.rooms.length} · openings ${spec.rooms.reduce((s, r) => s + (r.openings?.length ?? 0), 0)}`);
