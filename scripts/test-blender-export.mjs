/**
 * Blender scene export gate.
 *
 *   node scripts/test-blender-export.mjs
 */
import {parseScene} from "../engine/core/scene-contract.mjs";
import {exportBlenderScene} from "../engine/export/blender-scene.mjs";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {buildRoom} from "./compile-shoppable-room.mjs";

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) { passed++; }
  else { failed++; console.error(`FAIL  ${label}`); }
}

// The compiler is room-driven now: export the first configured room.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rooms = JSON.parse(fs.readFileSync(path.join(root, "config/shoppable-rooms.json"), "utf8")).rooms;
const {scene: document} = buildRoom(rooms[0]);
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
// The shell is built from the scene's own ROOM_VOLUME, so the assertions are about the real
// dimensions reaching Blender — not about which primitive call happens to draw them.
check("declares the room volume dimensions", /^W, H, D, T = 6, 2\.7, 5, /m.test(script));
check("contains floor slab", script.includes("m_floor") && script.includes("slab(W, D, T"));
check("contains wall", script.includes("m_wall"));
check("cuts the window opening out of its wall", script.includes("opening ROOM_WINDOW"));
check("lights the opening", script.includes("ROOM_WINDOW_light"));
check("camera is inside the room volume", (() => {
  const loc = /cam\.location = \(([-\d.]+), ([-\d.]+), ([-\d.]+)\)/.exec(script);
  if (!loc) return false;
  const [x, y, z] = loc.slice(1).map(Number);
  return Math.abs(x) < 3 && Math.abs(y) < 2.5 && z > 0 && z < 2.7;
})());

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

// §11 VISUALIZATION label — on the exporter AND on every committed .py
console.log("§11 visualization label");

// A still travels as a file, detached from the scene and any caption, so the
// label has to be burned into the image, not left to whoever embeds it.
check("export stamps VISUALIZATION", /VISUALIZATION/.test(script));
check("export denies the view claim", /not a view claim/i.test(script));
check("export names it CONCEPT", /CONCEPT design/.test(script));
check("stamp is actually switched on", /use_stamp = True/.test(script));
check("stamp note is switched on", /use_stamp_note = True/.test(script));
check("intelligence profile is labelled too", /VISUALIZATION/.test(intelScript));
check("a non-default stage is labelled too", /VISUALIZATION/.test(seatingScript));

// The artifacts on disk: two of the three were exported before the stamp
// existed and shipped unlabelled for a day. Asserting on the committed files
// is what catches a stale export, which asserting on the exporter cannot.
const stillsDir = path.resolve(root, "dist/stills");
if (fs.existsSync(stillsDir)) {
  const emitted = fs.readdirSync(stillsDir).filter(f => f.endsWith(".py"));
  check("committed stills exist", emitted.length > 0);
  for (const file of emitted) {
    const body = fs.readFileSync(path.join(stillsDir, file), "utf8");
    check(`${file}: carries VISUALIZATION`, /VISUALIZATION/.test(body));
    check(`${file}: denies the view claim`, /not a view claim/i.test(body));
    check(`${file}: stamp enabled`, /use_stamp = True/.test(body) && /use_stamp_note = True/.test(body));
  }
}

console.log(`\n${passed} passed, ${failed} failed (${passed + failed} checks)`);
if (failed) process.exit(1);
