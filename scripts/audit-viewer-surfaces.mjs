/**
 * Capability audit of every browser surface in this repository.
 *
 * Emits a deterministic matrix of which viewer implements which engine capability,
 * so the twin-engine extraction plan is re-derivable instead of remembered.
 *
 *   node scripts/audit-viewer-surfaces.mjs [extra-surface.html ...]
 *   node scripts/audit-viewer-surfaces.mjs --json
 *
 * Surfaces that live on another branch can be staged into .runtime/ and passed as
 * arguments; the tool never reads outside the paths it is given.
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const asJson = process.argv.includes("--json");
const extra = process.argv.slice(2).filter(a => !a.startsWith("--"));

const CAPABILITIES = [
  ["three.js runtime", /three\.module|"three":/],
  ["orbit camera", /OrbitControls/],
  ["walk camera", /PointerLockControls/],
  ["glTF avatar loading", /GLTFLoader/],
  ["click picking", /Raycaster/],
  ["inspect panel", /(id|class)=["'][^"']*panel/],
  ["scene from external data", /fetch\(\s*['"`]?[A-Za-z_.$]/],
  ["lens / mode switching", /data-mode=|function setMode\(/],
  ["staged camera tween", /tween/],
  ["evidence classes", /AUTHORITATIVE/],
  ["stage visibility contract", /visible_groups/],
  ["terrain mesh", /GRID_SURFACE|computeVertexNormals/],
  ["interactive sun / time-of-day", /solarPosition|solarTime/],
  ["sprite labels", /THREE\.Sprite/],
  ["split-screen compare", /setScissor/],
  ["live map context", /mapbox/i],
  ["procedural textures", /CanvasTexture/],
  ["shadows", /shadowMap\.enabled/],
  ["commerce / offer state", /offer_snapshot|scene-budget/],
  ["resize handling", /addEventListener\((['"])resize\1/]
];

function discover() {
  const found = [];
  const proto = path.join(root, "prototype");
  if (fs.existsSync(proto)) {
    for (const entry of fs.readdirSync(proto, {withFileTypes: true})) {
      if (entry.isFile() && entry.name.endsWith(".html")) found.push(path.join("prototype", entry.name));
      if (entry.isDirectory()) {
        const index = path.join("prototype", entry.name, "index.html");
        if (fs.existsSync(path.join(root, index))) found.push(index);
      }
    }
  }
  return found.concat(extra);
}

function scriptBytes(html) {
  return [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => m[1].length)
    .reduce((a, b) => a + b, 0);
}

const surfaces = discover().map(rel => {
  const file = path.isAbsolute(rel) ? rel : path.join(root, rel);
  if (!fs.existsSync(file)) return {name: path.basename(path.dirname(rel)), path: rel, missing: true};
  const html = fs.readFileSync(file, "utf8");
  const name = rel.endsWith("/index.html") ? path.basename(path.dirname(rel)) : path.basename(rel, ".html");
  return {
    name,
    path: rel,
    bytes: html.length,
    script_bytes: scriptBytes(html),
    geometry_constructors: (html.match(/new THREE\.[A-Za-z]+Geometry\(/g) || []).length,
    capabilities: Object.fromEntries(CAPABILITIES.map(([label, re]) => [label, re.test(html)]))
  };
});

const live = surfaces.filter(s => !s.missing);
const report = {
  generated_by: "scripts/audit-viewer-surfaces.mjs",
  surface_count: live.length,
  surfaces: live,
  shared_by_all_3d: CAPABILITIES
    .map(([label]) => label)
    .filter(label => live.filter(s => s.capabilities["three.js runtime"]).every(s => s.capabilities[label])),
  unique_to_one_surface: Object.fromEntries(
    CAPABILITIES
      .map(([label]) => [label, live.filter(s => s.capabilities[label]).map(s => s.name)])
      .filter(([, owners]) => owners.length === 1)
  )
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const width = Math.max(...CAPABILITIES.map(([l]) => l.length)) + 2;
  const col = 17;
  console.log("capability".padEnd(width) + live.map(s => s.name.slice(0, col - 2).padEnd(col)).join(""));
  console.log("-".repeat(width + col * live.length));
  for (const [label] of CAPABILITIES) {
    console.log(label.padEnd(width) + live.map(s => (s.capabilities[label] ? "yes" : "·").padEnd(col)).join(""));
  }
  console.log("-".repeat(width + col * live.length));
  console.log("script bytes".padEnd(width) + live.map(s => String(s.script_bytes).padEnd(col)).join(""));
  console.log("inline geometry ctors".padEnd(width) + live.map(s => String(s.geometry_constructors).padEnd(col)).join(""));
  console.log("\nshared by every 3D surface (= extract first):\n  " + report.shared_by_all_3d.join("\n  "));
  console.log("\nimplemented by exactly one surface:");
  for (const [label, owners] of Object.entries(report.unique_to_one_surface)) console.log(`  ${label} → ${owners[0]}`);
  for (const missing of surfaces.filter(s => s.missing)) console.log(`\nNOT READ (absent from this checkout): ${missing.path}`);
}
