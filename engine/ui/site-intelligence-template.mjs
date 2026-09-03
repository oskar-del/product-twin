/**
 * Site Intelligence template — reusable UI chrome for any twin scene.
 *
 * Extracts the mode dock, step nav, evidence legend, detail panel, and tools
 * bar from the Djurö prototype into parameterized builders that any site can
 * compose. Pure module: returns HTML strings + CSS + wiring JS. No DOM access.
 */

const EVIDENCE_CLASSES = [
  { id: "AUTHORITATIVE",       css: "var(--authoritative)", hex: "#176b52" },
  { id: "INDICATIVE",          css: "var(--indicative)",    hex: "#c18a2d" },
  { id: "DERIVED",             css: "var(--derived)",       hex: "#497aa2" },
  { id: "REPORTED_UNVERIFIED", css: "var(--reported)",      hex: "#a65b68" },
  { id: "CONCEPT",             css: "var(--concept)",       hex: "#735a9e" }
];

export { EVIDENCE_CLASSES };

/**
 * CSS variables and base reset shared by every Site Intelligence surface.
 */
export function baseCss() {
  return `:root{--ink:#14231d;--paper:#f5f1e8;--glass:rgba(247,244,236,.92);--line:rgba(20,35,29,.15);--authoritative:#176b52;--indicative:#c18a2d;--derived:#497aa2;--reported:#a65b68;--concept:#735a9e}
*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden;background:#d9e0db;color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,sans-serif}canvas{display:block}.hidden{display:none!important}`;
}

/**
 * Top bar with site brand chip.
 * @param {string} siteName
 */
export function topBarHtml(siteName) {
  return `<div class="top"><div class="brand">${esc(siteName)}</div></div>`;
}

/**
 * Mode dock: INTELLIGENCE / REALISTIC / COMPARE.
 * @param {string[]} [modes] — default all three
 */
export function modeDockHtml(modes = ["INTELLIGENCE", "REALISTIC", "COMPARE"]) {
  const buttons = modes.map((m, i) =>
    `<button class="mode${i === 0 ? " active" : ""}" data-mode="${m}">${m}</button>`
  ).join("");
  return `<div class="mode-dock" role="group" aria-label="Twin view mode">${buttons}</div>`;
}

export function modeDockCss() {
  return `.mode-dock{position:fixed;left:50%;top:15px;transform:translateX(-50%);z-index:10;display:flex;gap:4px;background:rgba(20,35,29,.9);padding:5px;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.18)}.mode{border:0;background:transparent;color:rgba(255,255,255,.67);padding:8px 12px;border-radius:10px;font-size:9px;letter-spacing:.08em;cursor:pointer}.mode.active{background:white;color:var(--ink)}`;
}

/**
 * Step navigation bar — built from scene stages.
 * @param {{id: string, label: string}[]} stages
 */
export function stepsHtml(stages) {
  const buttons = stages.map((s, i) =>
    `<button class="step${i === 0 ? " active" : ""}" data-step="${i}">${i + 1}. ${esc(s.label)}</button>`
  ).join("");
  return `<nav class="steps" id="steps">${buttons}</nav>`;
}

export function stepsCss() {
  return `.steps{position:fixed;left:50%;top:65px;transform:translateX(-50%);display:flex;gap:5px;z-index:9;background:rgba(20,35,29,.86);padding:6px;border-radius:15px;max-width:calc(100vw - 30px);overflow:auto}.step{border:0;color:rgba(255,255,255,.68);background:transparent;padding:8px 10px;border-radius:10px;font-size:9px;white-space:nowrap;cursor:pointer}.step.active{background:white;color:var(--ink)}`;
}

/**
 * Evidence legend sidebar.
 * @param {string} [hint]
 */
export function legendHtml(hint = "One geometry graph · synchronized camera · click elements for evidence") {
  const dots = EVIDENCE_CLASSES.map(e =>
    `<span class="dot" style="background:${e.css}"></span>${e.id}<br>`
  ).join("");
  return `<aside class="legend"><b>Evidence class</b><br>${dots}<div class="hint">${esc(hint)}</div></aside>`;
}

export function legendCss() {
  return `.legend{position:fixed;left:16px;bottom:16px;z-index:8;background:var(--glass);border:1px solid var(--line);border-radius:15px;padding:12px 14px;font-size:10px;line-height:1.75;backdrop-filter:blur(12px);max-width:295px}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}.hint{opacity:.6;margin-top:4px}`;
}

/**
 * Detail panel — opens on element click.
 */
export function panelHtml() {
  return `<aside class="si-panel" id="siPanel">
<button class="close" id="siClose" aria-label="Close details">×</button>
<div class="eyebrow" id="siPanelType"></div>
<h2 id="siPanelTitle"></h2>
<div id="siPanelBadge"></div>
<div id="siPanelBody"></div>
</aside>`;
}

export function panelCss() {
  return `.si-panel{position:fixed;right:16px;top:112px;bottom:66px;width:360px;z-index:12;background:rgba(247,244,236,.97);border:1px solid var(--line);border-radius:18px;padding:18px;overflow:auto;transform:translateX(calc(100% + 32px));transition:.2s;backdrop-filter:blur(18px);box-shadow:0 18px 55px rgba(0,0,0,.18)}.si-panel.open{transform:none}.si-panel h2{font:500 24px/1.08 Georgia,serif;margin:7px 0 11px}.eyebrow{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#66736c}.close{float:right;border:0;background:transparent;font-size:20px;cursor:pointer}.badge{display:inline-block;padding:5px 7px;border-radius:999px;color:white;font-size:9px;letter-spacing:.06em}.row{padding:9px 0;border-bottom:1px solid rgba(0,0,0,.08);font-size:10px;line-height:1.45}.row b{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px}.limitations{margin:7px 0 0;padding-left:16px}.limitations li{margin:5px 0}`;
}

/**
 * Tools bar — configurable toggle buttons.
 * @param {{id: string, label: string, active?: boolean}[]} tools
 */
export function toolsHtml(tools) {
  const buttons = tools.map(t =>
    `<button class="tool${t.active ? " active" : ""}" id="${esc(t.id)}">${esc(t.label)}</button>`
  ).join("");
  return `<div class="tools">${buttons}</div>`;
}

export function toolsCss() {
  return `.tools{position:fixed;right:16px;bottom:16px;z-index:10;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.tool{border:1px solid var(--line);background:var(--glass);padding:9px 11px;border-radius:999px;font-size:10px;cursor:pointer;backdrop-filter:blur(12px)}.tool.active{background:var(--ink);color:white}`;
}

/**
 * Responsive breakpoints.
 */
export function responsiveCss() {
  return `@media(max-width:1050px){.top .chip{display:none}.mode-dock{left:auto;right:16px;transform:none}.steps{left:10px;right:10px;top:64px;transform:none}.si-panel{width:calc(100vw - 32px)}.legend{max-width:230px}}@media(max-width:640px){.brand{max-width:180px}.mode{padding:8px 7px;font-size:8px}.legend{display:none}.tools{left:16px}}`;
}

/**
 * Gate notice — the honesty banner.
 * @param {string} text
 */
export function gateHtml(text) {
  return `<div class="gate">${esc(text)}</div>`;
}

export function gateCss() {
  return `.gate{position:fixed;left:16px;top:112px;z-index:8;max-width:300px;background:var(--glass);border:1px solid var(--line);border-radius:14px;padding:10px 13px;font-size:9px;line-height:1.5;backdrop-filter:blur(12px)}`;
}

/**
 * Compose a full Site Intelligence page skeleton.
 * @param {object} opts
 * @param {string} opts.siteName
 * @param {string} opts.title
 * @param {{id: string, label: string}[]} opts.stages
 * @param {string[]} [opts.modes]
 * @param {{id: string, label: string, active?: boolean}[]} [opts.tools]
 * @param {string} [opts.gateText]
 * @param {string} [opts.canvasId]
 * @returns {{ css: string, html: string }}
 */
export function composeSiteIntelligence(opts) {
  const {
    siteName,
    stages,
    modes,
    tools = [
      { id: "terrainToggle", label: "Terrain", active: true },
      { id: "labelsToggle",  label: "Labels",  active: true }
    ],
    gateText,
    canvasId = "c"
  } = opts;

  const css = [
    baseCss(),
    modeDockCss(),
    stepsCss(),
    legendCss(),
    panelCss(),
    toolsCss(),
    gateCss(),
    responsiveCss()
  ].join("\n");

  const htmlParts = [
    topBarHtml(siteName),
    modeDockHtml(modes),
    stepsHtml(stages),
    gateText ? gateHtml(gateText) : "",
    `<canvas id="${esc(canvasId)}"></canvas>`,
    legendHtml(),
    toolsHtml(tools),
    panelHtml()
  ];

  return { css, html: htmlParts.join("\n") };
}

/**
 * JS wiring: mode dock click handler (returns a script block body).
 * The caller supplies a setMode(mode) callback name.
 */
export function modeDockWiringJs(setModeFn = "setMode") {
  return `document.querySelectorAll('.mode').forEach(b=>b.onclick=()=>${setModeFn}(b.dataset.mode));`;
}

/**
 * JS wiring: step nav click handler.
 * The caller supplies a stepTo(index) callback name.
 */
export function stepsWiringJs(stepToFn = "stepTo") {
  return `document.querySelectorAll('.step').forEach((b,i)=>b.onclick=()=>${stepToFn}(i));`;
}

/**
 * JS wiring: panel open/close.
 */
export function panelWiringJs() {
  return `const siPanel=document.getElementById('siPanel');
const siClose=document.getElementById('siClose');
const siPanelType=document.getElementById('siPanelType');
const siPanelTitle=document.getElementById('siPanelTitle');
const siPanelBadge=document.getElementById('siPanelBadge');
const siPanelBody=document.getElementById('siPanelBody');
siClose.onclick=()=>siPanel.classList.remove('open');
function openSiPanel(item){
  siPanel.classList.add('open');
  siPanelType.textContent=item.type+' · '+item.id;
  siPanelTitle.textContent=item.label;
  siPanelBadge.innerHTML='<span class="badge" style="background:'+({AUTHORITATIVE:'#176b52',INDICATIVE:'#c18a2d',DERIVED:'#497aa2',REPORTED_UNVERIFIED:'#a65b68',CONCEPT:'#735a9e'}[item.evidence_class]||'#555')+'">'+item.evidence_class+'</span>';
  const g=JSON.stringify(item.geometry,null,2);
  siPanelBody.innerHTML='<div class="row"><b>Geometry / method</b><code>'+item.geometry.primitive+'</code></div>'
    +'<div class="row"><b>Source references</b>'+(item.source_refs?.length?item.source_refs.join('<br>'):'None')+'</div>'
    +'<div class="row"><b>Limitations</b><ul class="limitations">'+(item.limitations||[]).map(x=>'<li>'+x+'</li>').join('')+'</ul></div>'
    +'<div class="row"><b>Scene parameters</b><pre style="white-space:pre-wrap;font-size:9px">'+g+'</pre></div>';
}`;
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
