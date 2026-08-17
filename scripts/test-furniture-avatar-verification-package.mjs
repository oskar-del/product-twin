import assert from "node:assert/strict";
import fs from "node:fs";
import {buildVerificationPackage,validateVerificationPackage} from "./build-furniture-avatar-verification-package.mjs";

const valid=buildVerificationPackage();const clone=structuredClone;
assert.deepEqual(validateVerificationPackage(valid,{checkFiles:true}),[]);
assert.equal(valid.artifacts.length,46);assert.equal(valid.expected_gate_state.publicly_publishable,0);
assert.equal(valid.claims_for_verification.filter(c=>c.expected==="BLOCKED").length,2);
assert.equal(valid.asset_decisions.length,5);assert.ok(valid.asset_decisions.every(a=>a.pass_reasons.length&&a.block_reasons.length));
assert.ok(fs.existsSync(new URL("../config/verification/furniture-avatar-verification-package-v0.1.schema.json",import.meta.url)));
function reject(name,mutate,needle){const p=clone(valid);mutate(p);assert.ok(validateVerificationPackage(p).some(e=>e.includes(needle)),name);}
reject("authority escalation",p=>p.publication_authorized=true,"authority_escalation");
reject("public count escalation",p=>p.expected_gate_state.publicly_publishable=4,"gate_counts");
reject("Arper bypass",p=>p.expected_gate_state.arper_publicly_publishable=true,"arper_gate");
reject("canonical evidence inflation",p=>p.canonical_evidence.views=84,"canonical_inventory");
reject("asset reason removal",p=>p.asset_decisions[0].block_reasons=[],"asset_decisions");
reject("asset public bypass",p=>p.asset_decisions[0].public_publication="PASS","asset_publication");
reject("claim reason removal",p=>p.claims_for_verification[0].reason="","claim_reason");
reject("public blocked claim removed",p=>p.claims_for_verification=p.claims_for_verification.filter(c=>c.id!=="PUBLIC_PUBLICATION"),"public_claim");
reject("Arper blocked claim removed",p=>p.claims_for_verification=p.claims_for_verification.filter(c=>c.id!=="ARPER_RIGHTS_AND_PUBLICATION"),"arper_claim");
const broken=clone(valid);broken.artifacts[0].sha256="0".repeat(64);assert.ok(validateVerificationPackage(broken,{checkFiles:true}).some(e=>e.startsWith("hash:")));
console.log("Furniture Avatar Verification Package #2 integrity and mutation tests passed");
