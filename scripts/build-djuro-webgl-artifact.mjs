import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "data/sites/sweden/djuro-byvag-34";
const OUT = path.join(root, SITE, "site-intelligence-artifact.html");

const SVARTINGE_HTML = path.join(root, "prototype/svartinge-neighbourhood/index.html");
const svartinge = fs.readFileSync(SVARTINGE_HTML, "utf8");
const style = svartinge.match(/<style>([\s\S]*?)<\/style>/)[1];

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(root, SITE, name), "utf8"));
}
const scene = readJson("neighbourhood-scene-v0.1.json");
const geomSources = readJson("official-context-geometry-sources-v0.1.json");

const THREE_BUNDLE = process.argv[2];
if (!THREE_BUNDLE || !fs.existsSync(THREE_BUNDLE)) {
  console.error("Usage: node build-djuro-webgl-artifact.mjs <path-to-three-bundle.min.js>");
  process.exit(1);
}
const threeJs = fs.readFileSync(THREE_BUNDLE, "utf8");

const RENDERER = fs.readFileSync(path.join(root, "prototype/djuro-byvag-34/webgl-renderer.js"), "utf8");

const body = `
<div class="loading" id="loading">ASSEMBLING ONE TWIN · THREE WAYS OF SEEING…</div>
<div class="top"><div class="brand">PLOT-TO-PROJECT · SPATIAL STUDIO</div><div class="chip">DJURÖ 4:147 · Djurö byväg 34</div><div class="chip">5,156.3 m² registered parcel · authoritative</div></div>
<div class="mode-dock" role="group" aria-label="Twin view mode"><button class="mode active" data-mode="INTELLIGENCE">INTELLIGENCE</button><button class="mode" data-mode="REALISTIC">REALISTIC</button><button class="mode" data-mode="COMPARE">COMPARE</button></div>
<div class="gate"><b>SITE INTELLIGENCE · NO DESIGN YET</b><br>Realism changes presentation, not evidence. Buildings shown are the real registered structures — no renovation design exists yet. No view proves building height, water boundary or legal access.</div>
<nav class="steps" id="steps"></nav><div class="mode-caption" id="modeCaption">Evidence colours expose source status and uncertainty.</div>
<div class="split-label left hidden" id="leftLabel">INTELLIGENCE · EVIDENCE</div><div class="split-label right hidden" id="rightLabel">REALISTIC · VISUAL CONTEXT</div><div class="divider hidden" id="divider"></div>
<aside class="legend"><b>Evidence class</b><br><span class="dot" style="background:var(--authoritative)"></span>AUTHORITATIVE<br><span class="dot" style="background:var(--indicative)"></span>INDICATIVE<br><span class="dot" style="background:var(--derived)"></span>DERIVED<br><span class="dot" style="background:var(--reported)"></span>REPORTED_UNVERIFIED<br><span class="dot" style="background:var(--concept)"></span>CONCEPT<div class="hint">One geometry graph · synchronized camera · click elements for evidence</div></aside>
<div class="study"><div class="study-head"><b>Derived solar study · 21 June</b><span id="timeLabel">12:00</span></div><input id="solarTime" type="range" min="6" max="20" value="12" step=".25"><small>Analytical sun direction; shadows use derived context massing.</small></div>
<div class="tools"><button class="tool active" id="terrainToggle">Terrain</button><button class="tool active" id="poiToggle">POIs</button><button class="tool active" id="labelsToggle">Labels</button><button class="tool" id="liveContextButton">Live context</button><button class="tool" id="sourcesButton">Sources</button></div>
<aside class="panel" id="panel"><button class="close" id="close" aria-label="Close details">×</button><div class="eyebrow" id="panelType"></div><h2 id="panelTitle"></h2><div id="panelBadge"></div><div id="panelBody"></div></aside>
<aside class="live-panel" id="livePanel" aria-label="Live visual context">
  <div class="live-head"><button class="close" id="liveClose" aria-label="Close live context">×</button><div class="eyebrow" style="color:#d7c695">SYNCHRONIZED REFERENCE WINDOW</div><h2>Live aerial & terrain context</h2><p>Follows the active Twin stage. Visual orientation only; it cannot verify a boundary, height, access or planning fact.</p></div>
  <div class="live-setup"><input id="liveToken" type="password" autocomplete="off" spellcheck="false" aria-label="Temporary Mapbox public token" placeholder="Paste temporary Mapbox public token"><button id="liveConnect">Connect</button><button id="liveDisconnect" disabled>Disconnect & forget</button><div class="live-status" id="liveStatus">KEY REQUIRED · TOKEN STAYS IN THIS PAGE MEMORY ONLY</div></div>
  <div class="live-map" id="liveMap"><div class="live-policy">LIVE VISUAL CONTEXT · NO EVIDENCE EFFECT</div><div class="live-placeholder">Connect Mapbox to inspect current aerial character and terrain in an attributed live map. The procedural Twin remains fully usable without it.</div></div>
</aside>
`;

const out = `<meta charset="utf-8">
<title>Djurö Byväg 34</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
${style}
</style>
${body}
<script>
window.__SCENE__=${JSON.stringify(scene)};
window.__GEOM__=${JSON.stringify(geomSources)};
</script>
<script>
${threeJs}
</script>
<script>
${RENDERER}
</script>
`;

fs.writeFileSync(OUT, out);
console.log(JSON.stringify({ output: path.relative(root, OUT), bytes: out.length }, null, 2));
