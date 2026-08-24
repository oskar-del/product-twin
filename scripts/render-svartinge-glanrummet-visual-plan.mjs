#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compositionPath = "data/showrooms/svartinge-glanrummet-living-room-v0.3.json";
const qaPath = "data/showrooms/svartinge-glanrummet-visual-qa-v0.1.json";
const basePath = "data/showrooms/norr11-marbella-living-room-v0.1.json";
const outputDir = path.resolve(root, process.env.VISUAL_QA_OUTPUT || ".runtime/visual-qa/svartinge-glanrummet-v0.3");

const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const escape = value => String(value).replace(/[&<>\"]/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[character]));

export function buildPlanSvg({composition = read(compositionPath), qa = read(qaPath), base = read(basePath)} = {}) {
  const width = 1440;
  const height = 960;
  const scale = 104;
  const roomLeft = 64;
  const roomTop = 112;
  const [roomWidth,, roomDepth] = composition.room.size_m;
  const backZ = -(roomDepth - 1);
  const xToPx = x => roomLeft + (x + roomWidth / 2) * scale;
  const zToPx = z => roomTop + (z - backZ) * scale;
  const products = base.products.map(product => ({
    ...product,
    placement: {...product.placement, ...(composition.placement_overrides[product.twin_id] || {})},
    footprint: qa.product_footprints_m[product.role],
    cue: composition.appearance_profile.roles[product.role]
  }));

  const productSvg = products.map(product => {
    const [footprintX, footprintZ] = product.footprint;
    const [x,,z] = product.placement.position_m;
    const colour = product.cue.surface_color || "#9b8d76";
    const planLabel = product.role === "floor_lamp" ? "lamp" : product.role.replaceAll("_", " ");
    return `<g transform="translate(${xToPx(x)} ${zToPx(z)}) rotate(${product.placement.rotation_deg_y || 0})">
      <rect x="${-footprintX * scale / 2}" y="${-footprintZ * scale / 2}" width="${footprintX * scale}" height="${footprintZ * scale}" rx="8" fill="${colour}" fill-opacity="${product.role === "rug" ? 0.42 : 0.82}" stroke="#182720" stroke-width="${product.role === "rug" ? 1.5 : 2.5}" stroke-dasharray="${product.role === "rug" ? "8 6" : "none"}"/>
      <path d="M 0 ${-Math.min(footprintZ * scale * 0.34, 34)} L 0 ${-footprintZ * scale / 2 + 8}" stroke="#f5efe3" stroke-width="3" marker-end="url(#arrow)"/>
      <text x="0" y="5" text-anchor="middle" fill="${product.role === "rug" ? "#182720" : "#fffaf0"}" font-size="${product.role === "floor_lamp" ? 10 : 12}" font-weight="700" transform="rotate(${-(product.placement.rotation_deg_y || 0)})">${escape(planLabel)}</text>
    </g>`;
  }).join("\n");

  const viewRows = qa.views.map((view, index) => `<g transform="translate(900 ${250 + index * 96})">
    <circle cx="0" cy="0" r="7" fill="#b57a22"/>
    <text x="22" y="-4" font-size="17" font-weight="700" fill="#17251f">${escape(view.id)} · ${escape(view.label)}</text>
    <text x="22" y="22" font-size="13" fill="#5f685f">camera ${view.camera_position_m.join(", ")} · FOV ${view.fov_deg}°</text>
  </g>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#f5efe3"/></marker></defs>
  <rect width="${width}" height="${height}" fill="#f2eee5"/>
  <text x="64" y="54" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#17251f">Glanrummet v0.3 · deterministic layout review</text>
  <text x="64" y="82" font-family="Arial, sans-serif" font-size="14" fill="#687068">Top-plan evidence · verified envelopes where available · not a photoreal render</text>
  <rect x="${roomLeft}" y="${roomTop}" width="${roomWidth * scale}" height="${roomDepth * scale}" fill="#e7dcc9" stroke="#17251f" stroke-width="5"/>
  <line x1="${xToPx(-roomWidth * 0.32 + 0.2)}" y1="${roomTop}" x2="${xToPx(roomWidth * 0.32 + 0.2)}" y2="${roomTop}" stroke="#6d9fa6" stroke-width="13"/>
  <text x="${xToPx(0.2)}" y="${roomTop + 28}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#36545a">CONCEPT OPENING · LAKE GLAN CUE</text>
  ${productSvg}
  <g font-family="Arial, sans-serif">
    <text x="900" y="122" font-size="21" font-weight="700" fill="#17251f">Review contract</text>
    <text x="900" y="154" font-size="14" fill="#5f685f">7 placed products · 3 fixed views · 1440 × 960</text>
    <text x="900" y="178" font-size="14" fill="#5f685f">24 px safe frame · 0 asset failures allowed</text>
    <text x="900" y="202" font-size="14" fill="#8a4c3c">Human pixel review remains mandatory before publication</text>
    ${viewRows}
    <rect x="880" y="584" width="490" height="250" rx="20" fill="#17251f"/>
    <text x="910" y="626" font-size="17" font-weight="700" fill="#f3eadb">Screenshot defects addressed</text>
    <text x="910" y="662" font-size="14" fill="#d8cfbf">• Complete right-hand seating kept inside the default frame</text>
    <text x="910" y="692" font-size="14" fill="#d8cfbf">• Overlapping back-wall art removed in Svärtinge mode</text>
    <text x="910" y="722" font-size="14" fill="#d8cfbf">• Rug long axis rotated across the conversation group</text>
    <text x="910" y="752" font-size="14" fill="#d8cfbf">• Rug and coffee table receive non-white planning cues</text>
    <text x="910" y="782" font-size="14" fill="#d8cfbf">• Day bed clears the left wall by more than the 100 mm gate</text>
    <text x="910" y="812" font-size="14" fill="#d8cfbf">• Floor texture contrast reduced and seeded deterministically</text>
  </g>
  <text x="64" y="910" font-family="Arial, sans-serif" font-size="13" fill="#687068">Dashed footprint = rug. Arrows show product forward axes. Furniture overlaps the rug intentionally; solid-product collision remains separately reviewable.</text>
</svg>`;
}

export function renderPlan() {
  fs.mkdirSync(outputDir, {recursive: true});
  const svgPath = path.join(outputDir, "layout-plan.svg");
  const pngPath = path.join(outputDir, "layout-plan.png");
  fs.writeFileSync(svgPath, buildPlanSvg());
  const inkscape = spawnSync("inkscape", [svgPath, "--export-type=png", `--export-filename=${pngPath}`], {encoding: "utf8"});
  if (inkscape.status !== 0) {
    const convert = spawnSync("convert", ["-background", "none", svgPath, pngPath], {encoding: "utf8"});
    if (convert.status === 0) return {svgPath, pngPath};
    console.warn("SVG rasterizer unavailable; SVG plan remains available");
    return {svgPath, pngPath: null};
  }
  return {svgPath, pngPath};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(renderPlan(), null, 2));
}
