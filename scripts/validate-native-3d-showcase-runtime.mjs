import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = process.cwd();
const manifestPath = "data/geometry/native-3d-showcase-manifest.json";

export function validateNativeShowcase({manifest, requireRuntime = false, readFile = relative => fs.readFileSync(path.join(root, relative))}) {
  const errors = [];
  if (manifest?.version !== "0.1") errors.push("manifest version must be 0.1");
  if (manifest?.summary?.twins !== 8 || manifest?.entries?.length !== 8) errors.push("manifest must contain exactly 8 Product Twins");
  if (manifest?.summary?.resolved !== 8 || manifest?.summary?.unresolved !== 0) errors.push("all 8 manifest identities must resolve");
  for (const entry of manifest?.entries ?? []) {
    const at = entry.twin_id ?? "unknown twin";
    if (!entry.resolved) errors.push(`${at}: identity is unresolved`);
    if (entry.rights_state !== "review") errors.push(`${at}: rights must remain review`);
    if (entry.glb?.format !== "glb") errors.push(`${at}: format must be glb`);
    if (!/^\.runtime\/showcase\/native-3d\/[A-Z0-9_]+\.glb$/.test(entry.glb?.runtime_path ?? "")) errors.push(`${at}: runtime path is not isolated`);
    if (!Number.isInteger(entry.glb?.filesize) || entry.glb.filesize <= 0) errors.push(`${at}: filesize is invalid`);
    if (!/^[a-f0-9]{64}$/.test(entry.glb?.sha256 ?? "")) errors.push(`${at}: sha256 is invalid`);
    if (JSON.stringify(entry).includes("cdn.shopify.com")) errors.push(`${at}: raw CDN URL leaked into the committed manifest`);
    if (!requireRuntime) continue;
    try {
      const bytes = readFile(entry.glb.runtime_path);
      const digest = crypto.createHash("sha256").update(bytes).digest("hex");
      if (bytes.length !== entry.glb.filesize) errors.push(`${at}: runtime byte count mismatch`);
      if (digest !== entry.glb.sha256) errors.push(`${at}: runtime sha256 mismatch`);
      if (bytes.subarray(0, 4).toString("ascii") !== "glTF") errors.push(`${at}: runtime file is not a GLB`);
    } catch (error) {
      errors.push(`${at}: runtime asset unavailable (${error.code ?? error.message})`);
    }
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath), "utf8"));
  const requireRuntime = process.argv.includes("--require-runtime");
  const errors = validateNativeShowcase({manifest, requireRuntime});
  console.log(JSON.stringify({status: errors.length ? "NATIVE_SHOWCASE_FAIL" : "NATIVE_SHOWCASE_PASS", entries: manifest.entries.length, runtime_required: requireRuntime, rights_state: "review", errors}, null, 2));
  if (errors.length) process.exitCode = 1;
}
