import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDesignAssetPilot } from "./validate-design-asset-pilot.mjs";

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const sourceFile=path.join(repoRoot,"config/geometry/sweet-home-3d-design-asset-pilot-v0.1.json");

const valid=await validateDesignAssetPilot(sourceFile);
assert.equal(valid.ok,true,valid.errors.join("\n"));
assert.equal(valid.summary.candidates,12);
assert.equal(valid.summary.ready_assets,0);
assert.equal(valid.summary.product_identity_fields,0);

const tempDir=await fs.mkdtemp(path.join(os.tmpdir(),"design-asset-pilot-"));
const invalid=JSON.parse(await fs.readFile(sourceFile,"utf8"));
invalid.candidates[0].sku="FAKE-SKU";
invalid.candidates[0].asset_state="G2_READY";
const invalidFile=path.join(tempDir,"invalid.json");
await fs.writeFile(invalidFile,JSON.stringify(invalid));
const rejected=await validateDesignAssetPilot(invalidFile);
assert.equal(rejected.ok,false);
assert.ok(rejected.errors.some((error)=>error.includes("commerce/product identity fields are forbidden")));
assert.ok(rejected.errors.some((error)=>error.includes("asset_state cannot advance")));

console.log("design asset pilot validation passed");
