import assert from "node:assert/strict";
import fs from "node:fs";
import {validateSvartingePrototype} from "./validate-svartinge-neighbourhood-prototype-v0.2.mjs";

const baseline=JSON.parse(fs.readFileSync("data/sites/sweden/saterdalsvagen-14/neighbourhood-scene-v0.2.json","utf8"));
assert.equal(validateSvartingePrototype(baseline).ok,true,"baseline scene must validate");

const attacks=[
  ["identity promoted",m=>m.subject.identity_scope="PROPERTY_REGISTER_VERIFIED","identity scope promoted"],
  ["evidence vocabulary changed",m=>m.evidence_classes.push("VERIFIED"),"evidence class vocabulary"],
  ["vertical datum invented",m=>m.coordinate_system.vertical_reference="RH2000","vertical reference promoted"],
  ["municipal area promoted",m=>m.measurements.municipal_map_area_m2.evidence_class="AUTHORITATIVE","municipal area over-promoted"],
  ["listing area promoted",m=>m.measurements.listing_area_m2.evidence_class="AUTHORITATIVE","listing area state"],
  ["legal boundary enabled",m=>m.legal_claim_policy.blocked_claims=m.legal_claim_policy.blocked_claims.filter(x=>x!=="LEGAL_BOUNDARY"),"missing blocked legal claim LEGAL_BOUNDARY"],
  ["concept visualization blocked",m=>m.legal_claim_policy.concept_design_allowed=false,"concept capability incorrectly blocked"],
  ["street stage removed",m=>m.navigation=m.navigation.filter(x=>x.id!=="STREET_VIEW"),"navigation progression"],
  ["room stage removed",m=>m.navigation=m.navigation.filter(x=>x.id!=="ROOM"),"navigation progression"],
  ["room cutaway disabled",m=>m.navigation.find(x=>x.id==="ROOM").cutaway=false,"interior cutaway missing"],
  ["element evidence erased",m=>delete m.elements[0].evidence_class,"invalid or missing evidence class"],
  ["plot promoted",m=>m.elements.find(x=>x.id==="PLOT_54_28").evidence_class="AUTHORITATIVE","plot representation invalid"],
  ["plot area drift",m=>m.elements.find(x=>x.id==="PLOT_54_28").geometry.points_xz[0][0]+=8,"plot trace does not reproduce"],
  ["plot limitation erased",m=>m.elements.find(x=>x.id==="PLOT_54_28").limitations=["visual"],"plot legal limitation missing"],
  ["terrain promoted",m=>m.elements.find(x=>x.id==="TERRAIN_CONTEXT").evidence_class="AUTHORITATIVE","terrain promoted"],
  ["context building promoted",m=>m.elements.find(x=>x.type==="CONTEXT_BUILDING").evidence_class="AUTHORITATIVE","context massing incomplete"],
  ["road promoted",m=>m.elements.find(x=>x.type==="ROAD").evidence_class="AUTHORITATIVE","road context incomplete"],
  ["concept house promoted",m=>m.elements.find(x=>x.id==="HOUSE_SLAB").evidence_class="DERIVED","concept building/room geometry"],
  ["view promoted",m=>m.elements.find(x=>x.id==="VIEW_GLAN").evidence_class="AUTHORITATIVE","reported view promoted"],
  ["POI distance invented",m=>m.elements.find(x=>x.type==="POI").geometry.distance_m=450,"POI position promoted or coordinate/distance invented"],
  ["POI position promoted",m=>m.elements.find(x=>x.type==="POI").evidence_class="AUTHORITATIVE","POI position promoted or coordinate/distance invented"],
  ["owner payload injected",m=>m.owner="person","forbidden external fact payload"],
  ["source hash poisoned",m=>m.source_bindings[0].sha256="0".repeat(64),"source binding hash mismatch"],
  ["unknown root field",m=>m.dashboard_expansion=true,"scene: unknown or missing fields"]
];

for(const [name,mutate,needle] of attacks){
  const changed=structuredClone(baseline);mutate(changed);const result=validateSvartingePrototype(changed);
  assert.equal(result.ok,false,name);assert.ok(result.errors.some(e=>e.includes(needle)),`${name}: ${result.errors.join(" | ")}`);
}
console.log(`Svärtinge 3D prototype mutation suite passed (${attacks.length} attacks)`);
