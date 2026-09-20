/**
 * Bundle a twin scene into ONE self-contained HTML file.
 *
 * Everything inline: the engine, three.js, the scene document, the stylesheet. The output makes
 * zero network requests, which is what lets the same artifact be an Artifact link, an email
 * attachment, an iframe embed in a developer's own site, or a file on a USB stick in a sales
 * meeting with no wifi.
 *
 *   node scripts/bundle-twin-scene.mjs <scene.json> [--out <file.html>]
 *                                      [--title "…"] [--eyebrow "…"] [--asset-base <url>] [--no-minify]
 *
 * The scene is parsed against the twin-scene contract first: a bundle is a published artifact,
 * and publishing a scene the engine would refuse to render is worse than failing here.
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import esbuild from "esbuild";

import {parseScene, evidenceProfile} from "../engine/core/scene-contract.mjs";
import {chromeCss} from "../engine/ui/chrome/chrome-css.mjs";
import {topBar} from "../engine/ui/chrome/chrome.mjs";
import {glbBounds, boundsLabelMm} from "../engine/geometry/glb-bounds.mjs";
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

function shell({title, script, scene, generatedAt, looks = [], plot}) {
  const modes = looks.map(look => ({
    id: look.id,
    label: look.label,
    active: look.id === scene.scene_id,
    href: look.href
  }));

  // The mode switcher doubles as the "Looks" switcher: each look is another
  // bundled room on the same chrome, so switching is a navigation, not a
  // re-render. Links are relative, so the set works from any directory.
  const lookButtons = modes.map(mode => (
    mode.active
      ? `<button class="ink-mode" type="button" data-mode="${escapeHtml(mode.id)}" aria-pressed="true">${escapeHtml(mode.label)}</button>`
      : `<a class="ink-mode" href="${escapeHtml(mode.href)}" data-mode="${escapeHtml(mode.id)}" aria-pressed="false">${escapeHtml(mode.label)}</a>`
  )).join("");

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
${chromeCss()}
  html,body{margin:0;height:100%;overflow:hidden}
  body{display:flex;flex-direction:column;background:var(--ink-bg)}
  .room-topbar{flex:0 0 auto;z-index:12}
  #twin-stage{position:relative;flex:1 1 auto;min-height:0}
  .twin-boot{position:absolute;inset:0;display:grid;place-items:center;background:var(--ink-bg);color:var(--ink-text-faint);font-size:11px;letter-spacing:.14em;z-index:9;text-align:center;padding:24px}
  /* The engine's own light chrome is replaced by ink. The brand pill duplicates
     the topBar and the light panel is superseded by the chrome's sidePanel, so
     both go; the dock and step rail are already dark and are kept. The evidence
     legend stays — it is the one thing the room must not lose — restyled onto
     ink tokens rather than rebuilt. */
  .twin-engine .twin-panel,
  .twin-engine .twin-brand{display:none!important}
  /* The engine injects its stylesheet at runtime, i.e. after this block, so an
     equal-specificity rule here loses the cascade. !important is the honest fix
     rather than an escalating selector war with a sheet we do not control. */
  .twin-engine .twin-legend{
    background:rgba(16,25,22,.92)!important;
    border:1px solid var(--ink-line)!important;
    border-radius:var(--ink-radius)!important;
    color:var(--ink-text-dim)!important;
    font-family:var(--ink-sans)!important;
    backdrop-filter:blur(12px)
  }
  .twin-engine .twin-legend *{color:var(--ink-text-dim)!important}
  .twin-engine .twin-legend b,
  .twin-engine .twin-legend strong,
  .twin-engine .twin-legend summary{color:var(--ink-text)!important}
  .room-panel{position:absolute;right:16px;top:16px;bottom:16px;z-index:14;display:none;overflow:auto}
  .room-panel.is-open{display:block}
  .room-legend{position:absolute;left:16px;bottom:16px;z-index:13}
  @media(max-width:640px){.room-panel{left:16px;right:16px;top:auto;max-height:56%}}
</style>
</head>
<body class="ink">
<div class="room-topbar">
${topBar(
  {name: plot?.name ?? scene.subject?.label ?? scene.scene_id, kicker: plot?.kicker ?? "Rooms · shoppable", sub: plot?.sub ?? ""},
  [],
  {}
).replace('</header>', `<div class="ink-modes">${lookButtons}</div></header>`)}
</div>
<div id="twin-stage">
  <div class="twin-boot" id="twin-boot">LOADING TWIN…</div>
</div>
<script type="module">
${escapeScript(script)}
</script>
<!-- ${escapeHtml(ENGINE_VERSION_STRING)} · scene ${escapeHtml(scene.scene_id)} (${escapeHtml(scene.scene_version)}) · bundled ${escapeHtml(generatedAt)}
     sources: ${scene.source_bindings.map(binding => escapeHtml(`${binding.role}=${binding.path}`)).join(" · ")} -->
</body>
</html>
`;
}

/**
 * The rooms that make up the "Looks" switcher. Each is a bundled page on the
 * same chrome; switching look is a navigation between them. Declared here
 * rather than discovered, so a half-built scene never appears in the switcher.
 */
export const LOOKS = [
  {id: "SCENE_SHOPPABLE_ROOM_NEWPORT_LIVING_V01", label: "Newport · living", href: "scene_shoppable_room_newport_living_v01.html"},
  {id: "SCENE_SHOPPABLE_TERRACE_VIDAXL_V01", label: "vidaXL · terrace", href: "scene_shoppable_terrace_vidaxl_v01.html"}
];

export async function bundleTwinScene({scenePath, outPath, title, eyebrow, minify = true, generatedAt, assetBasePath = "", looks = LOOKS, plot}) {
  const absoluteScene = path.resolve(root, scenePath);
  const document = JSON.parse(fs.readFileSync(absoluteScene, "utf8"));

  // Inline every GLTF_ASSET as a data: URI. Without this the bundle still
  // fetches .glb files by relative path at runtime — which 404s wherever the
  // HTML is served from a directory that isn't the repo root, and silently
  // degrades every product to a placeholder sphere. "Self-contained" has to
  // include the geometry, or the room has no furniture in it.
  const assetReport = {inlined: 0, missing: [], bytes: 0, measured: 0};
  for (const element of document.elements ?? []) {
    const assetPath = element.geometry?.asset_path;
    if (element.geometry?.primitive !== "GLTF_ASSET" || !assetPath) continue;
    if (/^(data:|https?:)/.test(assetPath)) continue;
    const abs = path.resolve(root, assetPath);
    if (!fs.existsSync(abs)) { assetReport.missing.push(`${element.id} → ${assetPath}`); continue; }
    // Measure the mesh that will actually render. A dimension read off the GLB
    // is AUTHORITATIVE for what the viewer shows; a dimension parsed from a
    // merchant title is at best INDICATIVE. The panel needs to tell them apart,
    // and only this side of the pipeline can measure.
    const measured = glbBounds(abs);
    if (measured) {
      element.geometry.measured_bounds_m = measured.size;
      element.geometry.dimensions_label = boundsLabelMm(measured.size);
      element.geometry.dimension_evidence = "AUTHORITATIVE";
      element.geometry.dimension_source = "Measured from the GLB POSITION accessors";
      assetReport.measured++;
    } else {
      element.geometry.dimension_evidence = "INDICATIVE";
      element.geometry.dimension_source = "Catalog title or category default — mesh not measurable";
    }

    const bytes = fs.readFileSync(abs);
    element.geometry.asset_path = `data:model/gltf-binary;base64,${bytes.toString("base64")}`;
    element.geometry.asset_source_path = assetPath;   // keep provenance readable
    assetReport.inlined++;
    assetReport.bytes += bytes.length;
  }

  const scene = parseScene(document);

  const workDir = path.join(root, ".runtime/bundle");
  fs.mkdirSync(workDir, {recursive: true});
  const sceneCopy = path.join(workDir, "scene.json");
  fs.writeFileSync(sceneCopy, JSON.stringify(document));

  const eyebrowLabel = eyebrow ?? scene.subject?.label ?? scene.scene_id;
  const entry = path.join(workDir, "entry.mjs");
  fs.writeFileSync(entry, `import sceneDocument from "./scene.json";
import {createTwinViewer} from ${JSON.stringify(path.join(root, "engine/twin-engine.mjs"))};
import {createRoomPanel} from ${JSON.stringify(path.join(root, "engine/ui/chrome/room-panel.mjs"))};

const BRAND = ${JSON.stringify(eyebrowLabel)};
const ASSET_BASE = ${JSON.stringify(assetBasePath)};

const boot = document.getElementById("twin-boot");
try {
  const stage = document.getElementById("twin-stage");
  // The room renders its own panel on the ink chrome; the engine's light panel
  // is hidden by this page's CSS. onElementOpen is the engine's existing seam.
  const roomPanel = createRoomPanel({mount: stage});
  globalThis.roomPanel = roomPanel;
  globalThis.twinViewer = await createTwinViewer({
    mount: stage, sceneDocument, brand: BRAND, assetBasePath: ASSET_BASE,
    onElementOpen: element => roomPanel.open(element)
  });
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
    generatedAt: generatedAt ?? "unstamped",
    looks,
    plot
  });

  const output = path.resolve(root, outPath ?? path.join("dist/twins", `${scene.scene_id.toLowerCase()}.html`));
  fs.mkdirSync(path.dirname(output), {recursive: true});
  fs.writeFileSync(output, html);

  return {scene, html, outputPath: output, bytes: Buffer.byteLength(html), scriptBytes: Buffer.byteLength(script), assetReport};
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  const options = parseArgs(process.argv.slice(2));
  if (!options.scene) {
    console.error("usage: node scripts/bundle-twin-scene.mjs <scene.json> [--out <file.html>] [--title …] [--eyebrow …] [--asset-base <url>] [--no-minify]");
    process.exit(2);
  }
  const built = await bundleTwinScene({
    scenePath: options.scene,
    outPath: options.out,
    title: options.title,
    eyebrow: options.eyebrow,
    assetBasePath: options["asset-base"] ?? "",
    minify: options.minify,
    generatedAt: new Date().toISOString()
  });
  const kb = value => `${(value / 1024).toFixed(0)} KB`;
  console.log(`bundled ${built.scene.scene_id}`);
  console.log(`  → ${path.relative(root, built.outputPath)}  ${kb(built.bytes)} (script ${kb(built.scriptBytes)})`);
  console.log(`  ${built.scene.elements.length} elements · ${built.scene.stages.length} stages · evidence ${JSON.stringify(evidenceProfile(built.scene))}`);
  const {inlined, missing, bytes, measured} = built.assetReport;
  console.log(`  assets         ${inlined} GLB inlined (${kb(bytes)}) · ${measured} measured from mesh${missing.length ? ` · ${missing.length} MISSING` : ""}`);
  for (const m of missing) console.log(`    ✗ missing asset: ${m}`);
  if (missing.length) {
    console.error("  NOT self-contained: missing geometry would render as placeholder spheres");
    process.exit(1);
  }
  console.log("  self-contained: no network requests at runtime");
}
