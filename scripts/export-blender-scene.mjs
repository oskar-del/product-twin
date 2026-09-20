/**
 * Export a twin scene as a Blender Python script.
 *
 *   node scripts/export-blender-scene.mjs <scene.json> [--out path.py] [--stage ROOM] [--profile REALISTIC]
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {parseScene} from "../engine/core/scene-contract.mjs";
import {exportBlenderScene} from "../engine/export/blender-scene.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const sceneArg = process.argv[2];
if (!sceneArg) {
  console.error("usage: node scripts/export-blender-scene.mjs <scene.json> [--out path.py] [--stage ID] [--profile REALISTIC|INTELLIGENCE]");
  process.exit(1);
}

const scenePath = path.resolve(root, sceneArg);
const document = JSON.parse(fs.readFileSync(scenePath, "utf8"));
const scene = parseScene(document);

const outIdx = process.argv.indexOf("--out");
const stageIdx = process.argv.indexOf("--stage");
const profileIdx = process.argv.indexOf("--profile");

const outputPy = outIdx !== -1 ? path.resolve(process.argv[outIdx + 1]) : scenePath.replace(/\.json$/, ".py");
const stage = stageIdx !== -1 ? process.argv[stageIdx + 1] : undefined;
const profile = profileIdx !== -1 ? process.argv[profileIdx + 1] : "REALISTIC";

// asset_path on a scene element is REPO-relative (data/geometry/avatars/...), so the base is
// the repo root — not the scene's own directory, which would resolve every GLB to a path that
// does not exist and import an empty room.
const glbBasePath = root;
const renderOutput = outputPy.replace(/\.py$/, ".png");

const numArg = flag => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : Number(process.argv[i + 1]);
};
const samples = numArg("--samples");
const width = numArg("--width");

const script = exportBlenderScene(scene, {
  glbBasePath,
  outputPath: renderOutput,
  stage,
  profile,
  samples,
  resolution: width ? [width, Math.round(width * 0.625)] : undefined,
  windowWattsPerSqm: numArg("--window-w"),
  lens: numArg("--lens"),
  cameraCorner: process.argv.includes("--east") ? "east" : "west"
});

fs.writeFileSync(outputPy, script);
const gltfCount = scene.elements.filter(e => e.geometry.primitive === "GLTF_ASSET").length;
console.log(`wrote ${path.relative(root, outputPy)}`);
console.log(`  ${gltfCount} GLTF elements · stage ${stage ?? scene.stages[0].id} · profile ${profile}`);
console.log(`  render target: ${path.relative(root, renderOutput)}`);
console.log(`  run: blender --background --python ${path.relative(root, outputPy)}`);
