/**
 * Site Intelligence template gate.
 *
 *   node scripts/test-site-intelligence-template.mjs
 */
import {
  EVIDENCE_CLASSES,
  baseCss, modeDockHtml, modeDockCss, stepsHtml, stepsCss,
  legendHtml, legendCss, panelHtml, panelCss, toolsHtml, toolsCss,
  gateHtml, gateCss, responsiveCss, topBarHtml,
  composeSiteIntelligence,
  modeDockWiringJs, stepsWiringJs, panelWiringJs
} from "../engine/ui/site-intelligence-template.mjs";

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) { passed++; }
  else { failed++; console.error(`FAIL  ${label}`); }
}

// §1 Evidence classes
console.log("§1 evidence classes");
check("5 evidence classes", EVIDENCE_CLASSES.length === 5);
check("AUTHORITATIVE first", EVIDENCE_CLASSES[0].id === "AUTHORITATIVE");
check("CONCEPT last", EVIDENCE_CLASSES[4].id === "CONCEPT");
for (const e of EVIDENCE_CLASSES) {
  check(`${e.id} has css`, e.css.startsWith("var(--"));
  check(`${e.id} has hex`, /^#[0-9a-f]{6}$/.test(e.hex));
}

// §2 Base CSS
console.log("§2 base CSS");
const css = baseCss();
check("contains --ink", css.includes("--ink"));
check("contains --authoritative", css.includes("--authoritative"));
check("contains box-sizing", css.includes("box-sizing"));

// §3 Mode dock
console.log("§3 mode dock");
const dock = modeDockHtml();
check("contains INTELLIGENCE", dock.includes("INTELLIGENCE"));
check("contains REALISTIC", dock.includes("REALISTIC"));
check("contains COMPARE", dock.includes("COMPARE"));
check("first mode is active", dock.includes('class="mode active"'));
const dockCss = modeDockCss();
check("mode-dock css", dockCss.includes(".mode-dock"));

const customDock = modeDockHtml(["INTELLIGENCE", "REALISTIC"]);
check("custom modes: no COMPARE", !customDock.includes("COMPARE"));

// §4 Steps
console.log("§4 steps");
const stages = [
  { id: "OVERVIEW", label: "Overview" },
  { id: "PLOT", label: "The plot" },
  { id: "BUILDING", label: "Building" }
];
const stepsH = stepsHtml(stages);
check("step 1 numbered", stepsH.includes("1. Overview"));
check("step 3 numbered", stepsH.includes("3. Building"));
check("first step active", stepsH.includes('class="step active"'));
check("data-step attr", stepsH.includes('data-step="0"'));
const sCss = stepsCss();
check("steps css", sCss.includes(".steps"));

// §5 Legend
console.log("§5 legend");
const legend = legendHtml();
check("legend has AUTHORITATIVE", legend.includes("AUTHORITATIVE"));
check("legend has CONCEPT", legend.includes("CONCEPT"));
check("legend has dots", legend.includes('class="dot"'));
check("legend has hint", legend.includes("click elements"));
const customLegend = legendHtml("Custom hint");
check("custom hint", customLegend.includes("Custom hint"));
const lCss = legendCss();
check("legend css", lCss.includes(".legend"));

// §6 Panel
console.log("§6 panel");
const panel = panelHtml();
check("panel id", panel.includes('id="siPanel"'));
check("close button", panel.includes('id="siClose"'));
check("panel type slot", panel.includes('id="siPanelType"'));
check("panel title slot", panel.includes('id="siPanelTitle"'));
const pCss = panelCss();
check("panel css", pCss.includes(".si-panel"));
check("panel open class", pCss.includes(".si-panel.open"));

// §7 Tools
console.log("§7 tools");
const tools = [
  { id: "t1", label: "Terrain", active: true },
  { id: "t2", label: "Labels", active: false }
];
const toolsH = toolsHtml(tools);
check("tool 1 active", toolsH.includes('class="tool active"'));
check("tool 2 not active", toolsH.includes('id="t2"'));
const tCss = toolsCss();
check("tools css", tCss.includes(".tools"));

// §8 Gate notice
console.log("§8 gate notice");
const gate = gateHtml("No design yet");
check("gate text", gate.includes("No design yet"));
const gCss = gateCss();
check("gate css", gCss.includes(".gate"));

// §9 Responsive
console.log("§9 responsive");
const rCss = responsiveCss();
check("has media query", rCss.includes("@media"));
check("breakpoint 1050", rCss.includes("1050px"));
check("breakpoint 640", rCss.includes("640px"));

// §10 Top bar
console.log("§10 top bar");
const top = topBarHtml("Djurö byväg 34");
check("brand name", top.includes("Djurö byväg 34"));
check("brand class", top.includes('class="brand"'));

// §11 Compose full skeleton
console.log("§11 compose");
const composed = composeSiteIntelligence({
  siteName: "Test Site",
  stages,
  gateText: "Honesty notice"
});
check("composed has css", composed.css.length > 500);
check("composed has html", composed.html.length > 200);
check("composed css has all sections",
  composed.css.includes(".mode-dock") &&
  composed.css.includes(".steps") &&
  composed.css.includes(".legend") &&
  composed.css.includes(".si-panel") &&
  composed.css.includes(".tools") &&
  composed.css.includes(".gate") &&
  composed.css.includes("@media")
);
check("composed html has all sections",
  composed.html.includes("mode-dock") &&
  composed.html.includes("steps") &&
  composed.html.includes("legend") &&
  composed.html.includes("siPanel") &&
  composed.html.includes("tools") &&
  composed.html.includes("gate") &&
  composed.html.includes("canvas")
);

// §12 Wiring JS
console.log("§12 wiring JS");
const mjs = modeDockWiringJs();
check("mode wiring calls setMode", mjs.includes("setMode"));
check("mode wiring queries .mode", mjs.includes(".mode"));
const sjs = stepsWiringJs("goToStep");
check("step wiring uses custom fn", sjs.includes("goToStep"));
const pjs = panelWiringJs();
check("panel wiring has openSiPanel", pjs.includes("openSiPanel"));
check("panel wiring has evidence colors", pjs.includes("#176b52"));
check("panel wiring has close handler", pjs.includes("remove('open')"));

// §13 HTML escaping
console.log("§13 escaping");
const xss = topBarHtml('<script>alert(1)</script>');
check("escapes angle brackets", !xss.includes("<script>"));
check("contains escaped", xss.includes("&lt;script&gt;"));

console.log(`\n${passed} passed, ${failed} failed (${passed + failed} checks)`);
if (failed) process.exit(1);
