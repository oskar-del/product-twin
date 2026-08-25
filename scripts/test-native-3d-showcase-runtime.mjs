import assert from "node:assert/strict";
import fs from "node:fs";

import {validateNativeShowcase} from "./validate-native-3d-showcase-runtime.mjs";

const manifest = JSON.parse(fs.readFileSync("data/geometry/native-3d-showcase-manifest.json", "utf8"));
assert.deepEqual(validateNativeShowcase({manifest}), []);

const promotedRights = structuredClone(manifest);
promotedRights.entries[0].rights_state = "cleared";
assert(validateNativeShowcase({manifest: promotedRights}).some(error => error.includes("rights must remain review")));

const leakedUrl = structuredClone(manifest);
leakedUrl.entries[0].glb.cdn_url = "https://cdn.shopify.com/example.glb";
assert(validateNativeShowcase({manifest: leakedUrl}).some(error => error.includes("raw CDN URL leaked")));

const forgedHash = structuredClone(manifest);
forgedHash.entries[0].glb.sha256 = "0".repeat(64);
assert(validateNativeShowcase({manifest: forgedHash, requireRuntime: true, readFile: () => Buffer.from("glTFfake")}).some(error => error.includes("runtime sha256 mismatch")));

console.log("native 3D showcase manifest PASS (baseline + 3 negative mutations)");
