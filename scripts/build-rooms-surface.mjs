/**
 * Rooms — screen 4 of the one product, on the ink chrome.
 *
 * Hosts BOTH shoppable rooms on one page behind a "Looks" switcher. The 3D
 * stage runs headless of its own chrome (`chrome:false`) and the ink package
 * supplies everything the buyer sees: topBar, sidePanel, evidenceChip, legend.
 * Platform owns the chrome; this surface consumes it.
 *
 * The product panel is `sidePanel()` with name · brand · dimensions + the
 * dimension-provenance chip (AUTHORITATIVE from GLB bounds, INDICATIVE from a
 * parsed title) · price · BUY. The BUY href is the catalog's affiliate_link
 * VERBATIM — tracking parameters are the revenue.
 *
 *   node scripts/build-rooms-surface.mjs [--asset-base /assets] [--out dist/twins/rooms.html]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";
import { parseScene } from "../engine/core/scene-contract.mjs";
import { topBar, evidenceLegend } from "../engine/ui/chrome/chrome.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const LOOKS = [
  {
    id: "NEWPORT_LIVING",
    label: "Newport · living room",
    scene: "data/scenes/shoppable-room-newport-living/scene-v0.1.json",
    channel: "newport"
  },
  {
    id: "VIDAXL_TERRACE",
    label: "vidaXL · terrace",
    scene: "data/scenes/shoppable-terrace-vidaxl/scene-v0.1.json",
    channel: "vidaxl"
  },
  {
    id: "GLANRUMMET",
    label: "Glanrummet · in the house",
    scene: "data/scenes/shoppable-room-glanrummet/scene-v0.1.json",
    channel: "newport"
  }
];

const INK_BG = 0x101916; // --ink-bg, so the stage and the chrome are one surface

function money(amount, currency) {
  if (!Number.isFinite(amount)) return null;
  return `${amount.toLocaleString("sv-SE")} ${currency ?? ""}`.trim();
}

function summarise(scene) {
  const shoppable = scene.elements.filter(e => e.commerce);
  const total = shoppable.reduce((sum, e) => sum + (e.commerce.price ?? 0), 0);
  const currency = shoppable.find(e => e.commerce.currency)?.commerce.currency ?? "";
  const tracked = shoppable.filter(e => /[?&]as=/.test(e.commerce.buy_url ?? ""));
  return {
    elements: scene.elements.length,
    shoppable: shoppable.length,
    tracked: tracked.length,
    total: money(total, currency)
  };
}

const args = process.argv.slice(2);
const argValue = flag => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};
const assetBase = argValue("--asset-base") ?? "/assets";
const outPath = path.resolve(root, argValue("--out") ?? "dist/twins/rooms.html");

// ── load and verify every look before writing a page that claims them ────────
const looks = LOOKS.map(look => {
  const doc = JSON.parse(fs.readFileSync(path.join(root, look.scene), "utf8"));
  const parsed = parseScene(doc);
  return { ...look, doc, stats: summarise(parsed) };
});

const workDir = path.join(root, ".runtime", "rooms-surface");
fs.mkdirSync(workDir, { recursive: true });

const entry = path.join(workDir, "entry.mjs");
fs.writeFileSync(entry, `
import { createTwinViewer } from ${JSON.stringify(path.join(root, "engine/twin-engine.mjs"))};
import { sidePanel } from ${JSON.stringify(path.join(root, "engine/ui/chrome/chrome.mjs"))};

const LOOKS = ${JSON.stringify(looks.map(l => ({ id: l.id, label: l.label, channel: l.channel, doc: l.doc, stats: l.stats })))};
const ASSET_BASE = ${JSON.stringify(assetBase)};
const INK_BG = ${INK_BG};

const stage = document.getElementById("stage");
const panelHost = document.getElementById("panelHost");
const statusHost = document.getElementById("stageStatus");

let viewer = null;
let current = null;

function fmtDims(c) {
  const d = c.dimensions_mm;
  return d ? d.width + " × " + d.depth + " × " + d.height + " mm" : null;
}

function showPanel(element) {
  const c = element?.commerce;
  if (!c) { panelHost.innerHTML = ""; return; }

  const rows = [
    { label: "Brand", value: c.brand },
    { label: "Dimensions", value: fmtDims(c) },
    { label: "Dimension source", value: c.dimension_source ? c.dimension_source.replace(/_/g, " ").toLowerCase() : null },
    { label: "Geometry evidence", value: element.evidence_class },
    { label: "Colour", value: c.color },
    { label: "Material", value: c.material },
    { label: "SKU", value: c.sku },
    { label: "Channel", value: c.channel }
  ];

  panelHost.innerHTML = sidePanel({
    kicker: element.type + " · " + element.id,
    title: c.product_name ?? element.label,
    brand: c.brand,
    // ONE chip, and it is about the dimensions it sits beside. Two bare chips
    // (dimension vs geometry) read as a contradiction; geometry goes in a row.
    chips: [c.dimension_evidence].filter(Boolean),
    price: c.price != null ? c.price.toLocaleString("sv-SE") + " " + (c.currency ?? "") : null,
    rows,
    // Verbatim: whatever the catalog gave, untouched.
    action: c.buy_url ? { label: "BUY", href: c.buy_url } : null,
    notes: element.limitations ?? [],
    open: true
  });
  panelHost.querySelectorAll("[data-close-panel], .ink-side-close").forEach(b => b.onclick = clearPanel);
}

function clearPanel() { panelHost.innerHTML = ""; }

async function load(lookId) {
  const look = LOOKS.find(l => l.id === lookId) ?? LOOKS[0];
  if (current === look.id) return;
  current = look.id;

  clearPanel();
  stage.innerHTML = "";
  statusHost.textContent = "Loading " + look.label + " …";

  viewer = await createTwinViewer({
    mount: stage,
    sceneDocument: look.doc,
    chrome: false,              // the ink chrome replaces the engine's own
    assetBasePath: ASSET_BASE,
    stageBackground: INK_BG,
    onElementOpen: showPanel
  });

  const loaded = await viewer.avatarsReady;
  const s = look.stats;
  statusHost.textContent =
    s.elements + " elements · " + s.shoppable + " shoppable · " + s.tracked + " tracked · " +
    loaded.length + "/" + s.shoppable + " geometry hydrated · " + s.total;

  document.querySelectorAll("[data-look]").forEach(b =>
    b.classList.toggle("is-active", b.dataset.look === look.id));
  globalThis.roomsViewer = viewer;
  globalThis.roomsLoaded = loaded;
}

document.querySelectorAll("[data-look]").forEach(b =>
  b.onclick = () => load(b.dataset.look));

globalThis.loadLook = load;

// Deep link: #look=<id>&open=<elementId> selects a look and opens one product.
// Gives a shareable link to a specific piece, and makes a headless screenshot
// reproducible without scripting a click at fixed pixel coordinates.
function parseHash() {
  const h = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
  return { look: h.get("look"), open: h.get("open"), stage: h.get("stage") };
}

async function applyHash() {
  const { look, open, stage } = parseHash();
  await load(look ?? LOOKS[0].id);
  if (stage) { try { viewer.goToStageId(stage, { instant: true }); } catch {} }
  if (open) {
    // Route through the engine's own opener: viewer.elements is a Map of
    // three.js objects, not scene elements, and openElementById fires
    // onElementOpen so the deep link and a click take the identical path.
    try { viewer.openElementById(open); } catch { clearPanel(); }
  }
}

addEventListener("hashchange", applyHash);
await applyHash();
globalThis.roomsReady = true;
`);

const bundle = await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "browser",
  write: false,
  minify: true,
  loader: { ".json": "json" }
});
const script = bundle.outputFiles[0].text;

const tokens = fs.readFileSync(path.join(root, "engine/ui/chrome/tokens.css"), "utf8");

const html = `<!doctype html>
<meta charset="utf-8">
<title>Rooms — shoppable, channel-tracked</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
${tokens}
html,body{margin:0;height:100%;background:var(--ink-bg);color:var(--ink-paper);font-family:var(--ink-sans);overflow:hidden}
.rooms{display:flex;flex-direction:column;height:100%}
.rooms-stagewrap{flex:1;position:relative;min-height:0}
#stage{position:absolute;inset:0}
#stage canvas{display:block;width:100%;height:100%}
.rooms-status{padding:9px 16px;border-top:1px solid var(--ink-line,rgba(255,255,255,.08));font-size:9px;letter-spacing:.07em;color:var(--ink-bronze,#d8b874)}
.rooms-looks{display:flex;gap:4px;background:rgba(16,25,22,.9);padding:5px;border-radius:14px}
.rooms-look{border:0;background:transparent;color:rgba(255,255,255,.67);padding:8px 12px;border-radius:10px;font-size:9px;letter-spacing:.08em;cursor:pointer;font-family:inherit;white-space:nowrap}
.rooms-look.is-active{background:var(--ink-paper,#f5f1e8);color:#14231d}
#panelHost .ink-side{position:absolute;right:16px;top:16px;bottom:16px;width:min(360px,calc(100vw - 32px));z-index:12;overflow:auto}
.rooms-disclaimer{position:absolute;left:16px;top:16px;z-index:8;max-width:300px;font-size:8px;line-height:1.55;letter-spacing:.05em;color:rgba(255,255,255,.5)}
</style>
<body class="ink">
<div class="rooms">
${topBar(
  { kicker: "Plot-to-project · screen 4", name: "Rooms", sub: "shoppable · channel-tracked" },
  [],
  {}
)}
<div style="display:flex;justify-content:center;padding:10px 16px 0">
  <div class="rooms-looks" role="group" aria-label="Looks">
    ${looks.map((l, i) => `<button class="rooms-look${i === 0 ? " is-active" : ""}" data-look="${l.id}">${l.label}</button>`).join("")}
  </div>
</div>
<div class="rooms-stagewrap">
  <div id="stage"></div>
  <div class="rooms-disclaimer">VISUALISATION · product geometry is a G2 proxy: real footprint and height, representative shape. Prices and availability are the catalog's at build time, not a quote.</div>
  <div id="panelHost"></div>
</div>
<div class="rooms-status" id="stageStatus">…</div>
</div>
${evidenceLegend("Click any product for its evidence and a channel-tracked BUY")}
<script type="module">${script}</script>
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html);

console.log(`wrote ${path.relative(root, outPath)}  ${(html.length / 1024).toFixed(0)} KB`);
for (const l of looks) {
  console.log(`  ${l.label.padEnd(26)} ${String(l.stats.elements).padStart(2)} elements · ${l.stats.shoppable} shoppable · ${l.stats.tracked} tracked · ${l.stats.total}`);
}
