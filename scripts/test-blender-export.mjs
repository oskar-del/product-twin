/**
 * Blender scene export gate.
 *
 *   node scripts/test-blender-export.mjs
 */
import {parseScene} from "../engine/core/scene-contract.mjs";
import {exportBlenderScene} from "../engine/export/blender-scene.mjs";
import {buildShoppableRoom} from "./compile-shoppable-room.mjs";

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) { passed++; }
  else { failed++; console.error(`FAIL  ${label}`); }
}

const document = buildShoppableRoom();
const scene = parseScene(document);

// §1 Basic export
console.log("§1 basic export");
const script = exportBlenderScene(scene, {
  glbBasePath: "/data/geometry",
  outputPath: "/tmp/render.png",
  profile: "REALISTIC"
});

check("script is a string", typeof script === "string");
check("script is not empty", script.length > 100);
check("contains factory reset", script.includes("read_factory_settings"));
check("contains CYCLES", script.includes("CYCLES"));
check("contains render call", script.includes("bpy.ops.render.render"));
check("contains output path", script.includes("/tmp/render.png"));

// §2 GLTF elements imported
console.log("§2 GLTF elements");
const gltfElements = scene.elements.filter(e => e.geometry.primitive === "GLTF_ASSET");
check("at least 8 GLTF elements", gltfElements.length >= 8);
for (const el of gltfElements) {
  check(`${el.id} import_glb in script`, script.includes(el.geometry.asset_path));
}

// §3 Camera from stage
console.log("§3 camera");
check("contains camera setup", script.includes("cam.data.lens"));
check("contains look-at", script.includes("to_track_quat"));
check("camera is scene camera", script.includes("sc.camera = cam"));

// §4 Environment
console.log("§4 environment");
check("contains sun", script.includes("SUN"));
check("contains sky texture", script.includes("ShaderNodeTexSky"));
check("contains world", script.includes("sc.world"));

// §5 Room shell
console.log("§5 room shell");
check("contains floor plane", script.includes("primitive_plane_add"));
check("contains wall", script.includes("wall"));

// §6 Intelligence profile
console.log("§6 intelligence profile");
const intelScript = exportBlenderScene(scene, {
  glbBasePath: "/data",
  outputPath: "/tmp/intel.png",
  profile: "INTELLIGENCE"
});
check("intelligence uses flat_color", intelScript.includes("flat_color"));

// §7 Realistic profile does NOT override materials
console.log("§7 realistic profile");
check("realistic does not use flat_color for elements", !script.includes("flat_color(objs_"));

// §8 Stage selection
console.log("§8 stage selection");
const seatingScript = exportBlenderScene(scene, {
  glbBasePath: "/data",
  outputPath: "/tmp/seating.png",
  stage: "SEATING"
});
check("SEATING stage in header", seatingScript.includes("Stage: SEATING"));

// §9 Valid Python syntax (basic checks)
console.log("§9 syntax validity");
check("no undefined in output", !script.includes("undefined"));
check("no NaN in output", !script.includes("NaN"));
check("no [object Object]", !script.includes("[object Object]"));
check("balanced parentheses", countChar(script, "(") === countChar(script, ")"));

function countChar(str, ch) {
  let n = 0;
  for (const c of str) if (c === ch) n++;
  return n;
}

// §10 Coordinate system conversion
console.log("§10 coordinate conversion");
check("script uses Blender Y-up mapping comment or mathutils", script.includes("mathutils") || script.includes("Y-up"));

console.log(`\n${passed} passed, ${failed} failed (${passed + failed} checks)`);
if (failed) process.exit(1);
