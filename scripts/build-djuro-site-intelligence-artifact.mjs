import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "data/sites/sweden/djuro-byvag-34";
const VIEWER = path.join(root, "prototype/djuro-byvag-34/index.html");
const CANVAS_APP = path.join(root, "prototype/djuro-byvag-34/canvas-app.js");
const OUT = path.join(root, SITE, "site-intelligence-artifact.html");

// This produces the self-contained Artifact bundle: same CSS/DOM chrome as the
// Three.js prototype/djuro-byvag-34/index.html (mode-dock, steps, evidence panel,
// legend, tools), but with the Three.js/WebGL scene swapped for canvas-app.js — a
// dependency-free Canvas2D orbit renderer. The swap is necessary because Artifacts
// run in a sandboxed context that blocks the CDN import map AND blob-URL ES module
// imports that the local Three.js prototype relies on; Canvas2D has no such
// dependency and was verified to render identically in that sandbox.
const html = fs.readFileSync(VIEWER, "utf8");
const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const body = html.match(/<body>([\s\S]*?)<script type="module">/)[1];
const appJs = fs.readFileSync(CANVAS_APP, "utf8");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(root, SITE, name), "utf8"));
}
const scene = readJson("neighbourhood-scene-v0.1.json");
const geomSources = readJson("official-context-geometry-sources-v0.1.json");

const dataBlock = `<script>\nwindow.__SCENE__=${JSON.stringify(scene)};\nwindow.__GEOM__=${JSON.stringify(geomSources)};\n</script>\n`;

const out = `<meta charset="utf-8">
<title>Djurö Byväg 34</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
${style}
</style>
${body}
${dataBlock}
<script>
${appJs}
</script>
`;

fs.writeFileSync(OUT, out);
console.log(JSON.stringify({ output: path.relative(root, OUT), bytes: out.length }, null, 2));
