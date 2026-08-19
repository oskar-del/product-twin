/**
 * Bundle a twin scene into ONE self-contained HTML file.
 *
 * Everything inline: the engine, three.js, the scene document, the stylesheet. The output makes
 * zero network requests, which is what lets the same artifact be an Artifact link, an email
 * attachment, an iframe embed in a developer's own site, or a file on a USB stick in a sales
 * meeting with no wifi.
 *
 *   node scripts/bundle-twin-scene.mjs <scene.json> [--out <file.html>]
 *                                      [--title "…"] [--eyebrow "…"] [--no-minify]
 *
 * The scene is parsed against the twin-scene contract first: a bundle is a published artifact,
 * and publishing a scene the engine would refuse to render is worse than failing here.
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import esbuild from "esbuild";

import {parseScene, evidenceProfile} from "../engine/core/scene-contract.mjs";
import {ENGINE_VERSION_STRING} from "../engine/version.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const options = {minify: true};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--no-minify") options.minify = false;
    else if (arg.startsWith("--")) options[arg.slice(2)] = argv[++i];
    else positional.push(arg);
  }
  options.scene = positional[0];
  return options;
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));

/** `</script>` inside the bundled JS would close the tag it is written into. */
const escapeScript = value => value.replace(/<\/script/gi, "<\\/script");

function shell({title, script, scene, generatedAt}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="generator" content="${escapeHtml(ENGINE_VERSION_STRING)}">
<meta name="twin-scene-id" content="${escapeHtml(scene.scene_id)}">
<meta name="twin-scene-version" content="${escapeHtml(scene.scene_version)}">
<style>
  html,body{margin:0;height:100%;overflow:hidden;background:#d9e0db;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;color:#14231d}
  #twin-stage{position:fixed;inset:0}
  .twin-boot{position:fixed;inset:0;display:grid;place-items:center;background:#d9e0db;font-size:11px;letter-spacing:.14em;z-index:9;text-align:center;padding:24px}
</style>
</head>
<body>
<div id="twin-stage"></div>
<div class="twin-boot" id="twin-boot">LOADING TWIN…</div>
<script type="module">
${escapeScript(script)}
</script>
<!-- ${escapeHtml(ENGINE_VERSION_STRING)} · scene ${escapeHtml(scene.scene_id)} (${escapeHtml(scene.scene_version)}) · bundled ${escapeHtml(generatedAt)}
     sources: ${scene.source_bindings.map(binding => escapeHtml(`${binding.role}=${binding.path}`)).join(" · ")} -->
</body>
</html>
`;
}

export async function bundleTwinScene({scenePath, outPath, title, eyebrow, minify = true, generatedAt}) {
  const absoluteScene = path.resolve(root, scenePath);
  const document = JSON.parse(fs.readFileSync(absoluteScene, "utf8"));
  const scene = parseScene(document);

  const workDir = path.join(root, ".runtime/bundle");
  fs.mkdirSync(workDir, {recursive: true});
  const sceneCopy = path.join(workDir, "scene.json");
  fs.writeFileSync(sceneCopy, JSON.stringify(document));

  const eyebrowLabel = eyebrow ?? scene.subject?.label ?? scene.scene_id;
  const entry = path.join(workDir, "entry.mjs");
  fs.writeFileSync(entry, `import sceneDocument from "./scene.json";
import {createTwinViewer} from ${JSON.stringify(path.join(root, "engine/twin-engine.mjs"))};

const BRAND = ${JSON.stringify(eyebrowLabel)};

const boot = document.getElementById("twin-boot");
try {
  globalThis.twinViewer = await createTwinViewer({mount: document.getElementById("twin-stage"), sceneDocument, brand: BRAND});
  boot.remove();
} catch (error) {
  boot.textContent = "This twin could not start: " + error.message;
  throw error;
}
`);

  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    target: ["es2022"],
    platform: "browser",
    minify,
    legalComments: "none",
    write: false,
    absWorkingDir: root
  });

  const script = result.outputFiles[0].text;
  const html = shell({
    title: title ?? eyebrowLabel,
    script,
    scene,
    generatedAt: generatedAt ?? "unstamped"
  });

  const output = path.resolve(root, outPath ?? path.join("dist/twins", `${scene.scene_id.toLowerCase()}.html`));
  fs.mkdirSync(path.dirname(output), {recursive: true});
  fs.writeFileSync(output, html);

  return {scene, html, outputPath: output, bytes: Buffer.byteLength(html), scriptBytes: Buffer.byteLength(script)};
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  const options = parseArgs(process.argv.slice(2));
  if (!options.scene) {
    console.error("usage: node scripts/bundle-twin-scene.mjs <scene.json> [--out <file.html>] [--title …] [--eyebrow …] [--no-minify]");
    process.exit(2);
  }
  const built = await bundleTwinScene({
    scenePath: options.scene,
    outPath: options.out,
    title: options.title,
    eyebrow: options.eyebrow,
    minify: options.minify,
    generatedAt: new Date().toISOString()
  });
  const kb = value => `${(value / 1024).toFixed(0)} KB`;
  console.log(`bundled ${built.scene.scene_id}`);
  console.log(`  → ${path.relative(root, built.outputPath)}  ${kb(built.bytes)} (script ${kb(built.scriptBytes)})`);
  console.log(`  ${built.scene.elements.length} elements · ${built.scene.stages.length} stages · evidence ${JSON.stringify(evidenceProfile(built.scene))}`);
  console.log("  self-contained: no network requests at runtime");
}
