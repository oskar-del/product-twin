/**
 * Bundle gate.
 *
 * A bundle is a published artifact: it may be emailed, iframed into a client's own site, or
 * opened offline in a meeting. "Self-contained" therefore has to be a checked property, not an
 * intention — one external URL and the artifact breaks exactly where it matters.
 *
 *   node scripts/test-twin-scene-bundle.mjs
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {bundleTwinScene} from "./bundle-twin-scene.mjs";
import {buildConformanceScene} from "./build-twin-engine-conformance-scene.mjs";
import {SceneContractError} from "../engine/core/scene-contract.mjs";
import {ENGINE_VERSION_STRING} from "../engine/version.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workDir = path.join(root, ".runtime/bundle-gate");
fs.mkdirSync(workDir, {recursive: true});

/** Stated budget. A twin that outgrows this needs a decision, not a silent bigger download. */
const MAX_BUNDLE_BYTES = 1_500_000;

let failures = 0;
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`FAIL  ${message}`);
  }
}

const built = await bundleTwinScene({
  scenePath: "data/scenes/twin-engine-conformance/scene-v0.1.json",
  outPath: path.join(workDir, "conformance.html"),
  generatedAt: "1970-01-01T00:00:00Z"
});
const html = built.html;

check(fs.existsSync(built.outputPath), "the bundler must write its output file");
check(built.bytes <= MAX_BUNDLE_BYTES, `bundle is ${built.bytes} bytes, over the ${MAX_BUNDLE_BYTES}-byte budget`);

// ── self-containment ────────────────────────────────────────────────────────────────────────
// What matters is not whether a URL-shaped string exists in the file — minified three.js carries
// paper citations inside GLSL — but whether the browser would ever REQUEST one. So the check is
// context-aware: every position from which a URL can be fetched.
const FETCHING_CONTEXTS = [
  [/\b(?:src|href)\s*=\s*["'](?:https?:)?\/\/[^"']+/gi, "markup src/href"],
  [/\bfetch\s*\(\s*["'`](?:https?:)?\/\//gi, "fetch()"],
  [/\bimport\s*\(\s*["'`](?:https?:)?\/\//gi, "dynamic import()"],
  [/\bfrom\s*["'`](?:https?:)?\/\//gi, "static import"],
  [/\bnew\s+(?:Worker|SharedWorker|EventSource|WebSocket)\s*\(\s*["'`](?:https?:|wss?:)?\/\//gi, "worker/socket"],
  [/\bimportScripts\s*\(\s*["'`](?:https?:)?\/\//gi, "importScripts()"],
  [/url\(\s*["']?(?:https?:)?\/\//gi, "CSS url()"],
  [/\bnew\s+URL\s*\(\s*["'`]https?:\/\//gi, "new URL()"]
];
const fetchable = FETCHING_CONTEXTS.flatMap(([pattern, label]) =>
  [...html.matchAll(pattern)].map(match => `${label}: ${match[0].slice(0, 80)}`)
);
check(fetchable.length === 0, `bundle can request ${fetchable.length} external resource(s): ${fetchable.slice(0, 4).join(" | ")}`);

// Informational: URL-shaped strings that are NOT in a fetching context. Printed so drift is
// visible, not failed on.
const inertUrls = [...new Set([...html.matchAll(/\bhttps?:\/\/[^\s"'`)<>]+/g)].map(match => match[0]))]
  .filter(url => !url.startsWith("http://www.w3.org/"));

const scriptTags = [...html.matchAll(/<script\b([^>]*)>/gi)].map(match => match[1]);
check(scriptTags.length === 1, `bundle must contain exactly one script tag, found ${scriptTags.length}`);
check(scriptTags[0]?.includes('type="module"'), "the bundle's script must be a module");
check(!/<script[^>]*\ssrc=/i.test(html), "the bundle must not load any script by src");
check(!/<link[^>]*rel=["']stylesheet/i.test(html), "the bundle must not load an external stylesheet");
check(!/\bimport\s*\(\s*["'][^"']*["']\s*\)/.test(html) || !/from\s*["']three["']/.test(html), "the bundle must not leave a bare module specifier to resolve at runtime");
check(!html.includes("</script>\n</script>"), "script escaping must not corrupt the document");

// ── the scene travels with the bundle ───────────────────────────────────────────────────────
const scene = built.scene;
check(html.includes(scene.scene_id), "the bundle must carry its scene id");
check(html.includes(`name="twin-scene-version" content="${scene.scene_version}"`), "the bundle must declare its scene version");
check(html.includes(`content="${ENGINE_VERSION_STRING}"`), "the bundle must declare the engine that produced it");
check(html.includes("ENGINE_CONFORMANCE_FIXTURE"), "the scene's source refs must be inlined, not fetched");
for (const binding of scene.source_bindings) {
  check(html.includes(binding.path), `the bundle must record its source binding ${binding.path}`);
}
check(html.includes(scene.legal_claim_policy.rule), "the bundle must surface what the scene may not claim");

// ── refusal ─────────────────────────────────────────────────────────────────────────────────
// A bundle is a publication. A scene the engine would refuse to render must never reach one.
const broken = buildConformanceScene();
broken.elements[0].geometry.primitive = "NURBS_SURFACE";
const brokenPath = path.join(workDir, "broken-scene.json");
fs.writeFileSync(brokenPath, JSON.stringify(broken));
let refused = null;
try {
  await bundleTwinScene({scenePath: path.relative(root, brokenPath), outPath: path.join(workDir, "broken.html")});
} catch (error) {
  refused = error;
}
check(refused instanceof SceneContractError, "bundling a contract-violating scene must fail with a SceneContractError");
check(!fs.existsSync(path.join(workDir, "broken.html")), "a refused bundle must not leave an output file behind");

// ── determinism ─────────────────────────────────────────────────────────────────────────────
const again = await bundleTwinScene({
  scenePath: "data/scenes/twin-engine-conformance/scene-v0.1.json",
  outPath: path.join(workDir, "conformance-2.html"),
  generatedAt: "1970-01-01T00:00:00Z"
});
check(again.html === html, "bundling the same scene twice must produce byte-identical output");

console.log(`bundle ${(built.bytes / 1024).toFixed(0)} KB (budget ${(MAX_BUNDLE_BYTES / 1024).toFixed(0)} KB) · ${fetchable.length} fetchable external resources · ${scriptTags.length} script tag`);
if (inertUrls.length) console.log(`  inert URL strings (not requested): ${inertUrls.join(", ")}`);
console.log(`${checks - failures}/${checks} bundle checks passed`);
if (failures) {
  console.error(`twin-engine bundle gate FAILED with ${failures} failure(s)`);
  process.exit(1);
}
console.log("twin-engine bundle gate PASSED");
