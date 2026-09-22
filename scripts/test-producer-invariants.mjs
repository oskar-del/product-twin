/**
 * Producer invariants — the two things that only fail where nobody looks.
 *
 * §1  Every shipped scene bundles with ZERO missing assets.
 *     The bundler printed "1 MISSING" for a day and rendered a placeholder
 *     sphere where a sofa's coffee table should have been. A log line nobody
 *     reads is the failure mode, so it becomes an assertion.
 *
 * §2  Only ONE function may hand out AUTHORITATIVE for a dimension.
 *     The overclaim was removed from the scene compiler and then walked back in
 *     through the bundler, which stamped AUTHORITATIVE on anything it could
 *     measure off a G2 proxy. The fix has to hold in every producer, so this is
 *     a source scan rather than a behavioural test: a new producer written next
 *     month fails here the moment it invents its own evidence.
 *
 *   node scripts/test-producer-invariants.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundleTwinScene } from "./bundle-twin-scene.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workDir = path.join(root, ".runtime", "producer-invariants");

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) { passed++; }
  else { failed++; console.error(`FAIL  ${label}`); }
}

// ── §1 no shipped scene may bundle with a missing asset ──────────────────────
console.log("§1 every shipped scene bundles complete");
fs.mkdirSync(workDir, { recursive: true });

const SHIPPED = [
  "data/scenes/shoppable-room-newport-living/scene-v0.1.json",
  "data/scenes/shoppable-terrace-vidaxl/scene-v0.1.json",
  "data/scenes/shoppable-bedroom/scene-v0.1.json",
  "data/scenes/room-glanrummet-newport/scene-v0.1.json",
  "data/scenes/house-vinkelhuset/scene-v0.1.json"
].filter(rel => fs.existsSync(path.join(root, rel)));

check("there are shipped scenes to check", SHIPPED.length >= 4);

for (const rel of SHIPPED) {
  const name = rel.split("/")[2];
  const built = await bundleTwinScene({
    scenePath: rel,
    outPath: path.join(workDir, `${name}.html`),
    minify: false
  });
  const { missing, inlined } = built.assetReport;

  check(`${name}: 0 missing assets${missing.length ? ` — ${missing.join(", ")}` : ""}`, missing.length === 0);

  // A scene that declares GLTF_ASSET elements must actually carry them.
  const declared = built.scene.elements.filter(e => e.geometry?.primitive === "GLTF_ASSET").length;
  check(`${name}: every declared GLTF asset is inlined (${inlined}/${declared})`, inlined === declared);

  // And nothing may be left pointing at a path the browser would go fetch.
  const external = built.scene.elements.filter(e =>
    e.geometry?.primitive === "GLTF_ASSET" && !String(e.geometry?.asset_path ?? "").startsWith("data:"));
  check(`${name}: no asset left as a runtime fetch`, external.length === 0);
}

// ── §2 only one function may grant AUTHORITATIVE to a dimension ──────────────
console.log("§2 AUTHORITATIVE stays where it belongs");

// The single producer allowed to decide dimension evidence.
const OWNER = "engine/compile/catalog-row.mjs";
// Files that legitimately NAME the class without granting it: the chrome
// palette, the legend, and the tests that assert this very rule.
const ALLOWED = new Set([
  OWNER,
  "scripts/test-producer-invariants.mjs",
  "scripts/test-catalog-rooms.mjs",
  "engine/ui/chrome/chrome.mjs",
  "engine/core/evidence.mjs",
  "engine/core/profiles.mjs",
  "engine/export/blender-scene.mjs"
]);

function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...sourceFiles(rel));
    else if (entry.name.endsWith(".mjs")) out.push(rel);
  }
  return out;
}

const files = [...sourceFiles("engine"), ...sourceFiles("scripts")];
check("source scan found files", files.length > 20);

const offenders = [];
for (const rel of files) {
  if (ALLOWED.has(rel)) continue;
  const lines = fs.readFileSync(path.join(root, rel), "utf8").split("\n");
  lines.forEach((line, i) => {
    if (!/AUTHORITATIVE/.test(line)) return;
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;              // prose, not code
    // Granting = the literal assigned to, or compared into, a dimension field.
    if (/dimension\w*\s*[:=]\s*["'`]AUTHORITATIVE["'`]/.test(line)
      || /["'`]AUTHORITATIVE["'`]\s*[,;)]?\s*$/.test(line) && /dimension/i.test(line)) {
      offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 90)}`);
    }
  });
}

for (const o of offenders) console.error(`      ${o}`);
check(`no producer outside ${OWNER} grants AUTHORITATIVE to a dimension (${offenders.length} found)`,
  offenders.length === 0);

// The rule is only meaningful if the owner still does grant it.
const ownerBody = fs.readFileSync(path.join(root, OWNER), "utf8");
check(`${OWNER} is still the one that grants it`, /return "AUTHORITATIVE"/.test(ownerBody));

console.log(`\n${passed} passed, ${failed} failed (${passed + failed} checks)`);
if (failed) process.exit(1);
