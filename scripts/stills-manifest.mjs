/**
 * Stills manifest — proof that each committed PNG came from a stamped script.
 *
 * "Gate the artefact, not the tool" caught stale .py files whose exporter was
 * already correct. The same staleness has one more hop: a .py can be re-exported
 * WITH the label while the .png beside it was rendered from the old one, so the
 * image people actually see carries no stamp. Asserting on the script cannot see
 * that, and nothing in a PNG says which script drew it.
 *
 * So the manifest records, per still: the script's sha256, the PNG's sha256, and
 * whether that script stamps. The gate recomputes all three. If either file
 * changes without the manifest being rebuilt, the hashes stop matching and the
 * still is treated as unproven.
 *
 *   node scripts/stills-manifest.mjs           # verify (exit 1 on drift)
 *   node scripts/stills-manifest.mjs --write   # rebuild after a re-render
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STILLS = path.join(root, "dist/stills");
const MANIFEST = path.join(STILLS, "manifest.json");

const sha256 = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

/** A script stamps if it burns the label in AND actually switches the stamp on. */
export function scriptStamps(body) {
  return /VISUALIZATION/.test(body)
    && /not a view claim/i.test(body)
    && /use_stamp = True/.test(body)
    && /use_stamp_note = True/.test(body);
}

export function buildManifest() {
  const scripts = fs.existsSync(STILLS)
    ? fs.readdirSync(STILLS).filter(f => f.endsWith(".py")).sort()
    : [];

  return {
    generated_at: new Date().toISOString(),
    rule: "Every committed still must be rendered from a script that burns in the VISUALIZATION stamp. A rendered horizon is never a view claim.",
    stills: scripts.map(scriptName => {
      const scriptPath = path.join(STILLS, scriptName);
      const body = fs.readFileSync(scriptPath, "utf8");
      const pngName = scriptName.replace(/\.py$/, ".png");
      const pngPath = path.join(STILLS, pngName);
      const rendered = fs.existsSync(pngPath);
      return {
        script: scriptName,
        script_sha256: sha256(scriptPath),
        stamp: scriptStamps(body),
        png: rendered ? pngName : null,
        png_sha256: rendered ? sha256(pngPath) : null
      };
    })
  };
}

/** @returns {string[]} problems; empty means every still is proven. */
export function verifyManifest() {
  const problems = [];
  if (!fs.existsSync(MANIFEST)) return ["dist/stills/manifest.json is missing — run scripts/stills-manifest.mjs --write"];

  const recorded = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const current = buildManifest();
  const byScript = new Map(recorded.stills.map(e => [e.script, e]));

  for (const now of current.stills) {
    const was = byScript.get(now.script);
    if (!was) { problems.push(`${now.script}: not in the manifest — rebuild it`); continue; }
    if (!now.stamp) problems.push(`${now.script}: does not burn in the VISUALIZATION stamp`);
    if (was.script_sha256 !== now.script_sha256) problems.push(`${now.script}: script changed since the manifest was written`);
    if (!now.png) { problems.push(`${now.script}: no rendered PNG beside it`); continue; }
    if (was.png_sha256 !== now.png_sha256) {
      problems.push(`${now.png}: PNG changed since the manifest was written — re-render or rebuild the manifest`);
    }
    // The hop the .py check cannot see: script re-exported, image not re-rendered.
    if (was.script_sha256 === now.script_sha256 && was.png_sha256 === now.png_sha256 && !was.stamp) {
      problems.push(`${now.png}: rendered from a script that did not stamp`);
    }
  }

  for (const was of recorded.stills) {
    if (!current.stills.some(n => n.script === was.script)) problems.push(`${was.script}: in the manifest but gone from disk`);
  }
  return problems;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  if (process.argv.includes("--write")) {
    const manifest = buildManifest();
    fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`wrote ${path.relative(root, MANIFEST)}`);
    for (const s of manifest.stills) {
      console.log(`  ${s.script.padEnd(26)} stamp=${String(s.stamp).padEnd(5)} png=${s.png ?? "MISSING"}`);
    }
    const unstamped = manifest.stills.filter(s => !s.stamp);
    if (unstamped.length) {
      console.error(`\n  ${unstamped.length} script(s) do not stamp: ${unstamped.map(s => s.script).join(", ")}`);
      process.exit(1);
    }
  } else {
    const problems = verifyManifest();
    if (problems.length) {
      console.error("stills manifest FAILED:");
      for (const p of problems) console.error(`  - ${p}`);
      process.exit(1);
    }
    const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
    console.log(`stills manifest OK · ${m.stills.length} still(s), all rendered from stamped scripts`);
  }
}
