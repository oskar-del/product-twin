import assert from "node:assert/strict";
import fs from "node:fs";
import { buildManifest, validateManifest } from "./build-furniture-avatar-manifest.mjs";

const clone = value => structuredClone(value);
const valid = buildManifest();
assert.deepEqual(validateManifest(valid), []);
assert.equal(valid.assets.length, 5);
assert.equal(valid.assets.filter(a=>a.primary_selection).length, 4);
assert.equal(valid.summary.internal_ingestible, 4);
assert.equal(valid.summary.publicly_publishable, 0);
assert.ok(valid.assets.every(a=>a.geometry.level!=="G3"));
assert.equal(valid.assets.find(a=>a.asset_id.includes("ARPER")).publication.state,"BLOCKED_RIGHTS");
assert.ok(fs.existsSync(new URL("../config/geometry/furniture-avatar-manifest-v0.1.schema.json",import.meta.url)));

function rejected(name, mutate, pattern){ const m=clone(valid); mutate(m); assert.ok(validateManifest(m).some(e=>e.includes(pattern)),name); }
rejected("Design Asset identity leakage",m=>{m.assets[0].record_lane="DESIGN_ASSET";},"design_asset_identity");
rejected("Design Asset commerce leakage",m=>{m.assets[0].record_lane="DESIGN_ASSET";m.assets[0].product_identity=null;m.assets[0].placement.sku="LEAK";},"design_asset_commerce");
rejected("unverified Product Twin identity",m=>{m.assets[0].product_identity.verification_state="CANDIDATE";},"unverified_identity");
rejected("G1 promotion",m=>{m.assets[0].geometry.level="G1";m.assets[0].publication.public_allowed=true;},"g1_public");
rejected("rights blocker bypass",m=>{m.assets[0].publication.public_allowed=true;},"unsafe_publication");
rejected("proxy exact likeness",m=>{m.assets[0].geometry.exact_likeness_claimed=true;},"proxy_exact_likeness");
rejected("confidence truth leakage",m=>{m.assets[0].appearance.confidence=m.assets[0].dimensional_confidence;},"confidence_leak");
rejected("invalid hash",m=>{m.assets[0].geometry.sha256="bad";},"geometry_hash");
rejected("Arper publication",m=>{const a=m.assets.at(-1);a.publication.public_allowed=true;a.publication.blockers=[];},"arper_public");

const generic=clone(valid.assets[0]); generic.record_lane="DESIGN_ASSET";generic.product_identity=null;generic.asset_id="DA_VALID_GENERIC";
assert.equal(validateManifest({...valid,assets:[generic,...valid.assets.slice(1)]}).some(e=>e.includes("design_asset")),false);
console.log("furniture avatar manifest contract and mutation tests passed");
