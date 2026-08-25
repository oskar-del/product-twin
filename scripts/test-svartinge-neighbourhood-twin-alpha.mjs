import assert from "node:assert/strict";
import fs from "node:fs";
import {validateNeighbourhoodAlpha} from "./validate-svartinge-neighbourhood-twin-alpha.mjs";
const path="data/sites/sweden/saterdalsvagen-14/neighbourhood-twin-alpha-v0.1.json";
const baseline=JSON.parse(fs.readFileSync(path,"utf8"));
assert.equal(validateNeighbourhoodAlpha(baseline).ok,true);
const attacks=[
  ["property-register identity invented",m=>m.subject.identity_state="PROPERTY_REGISTER_VERIFIED","identity over-promotion"],
  ["CRS erased",m=>m.coordinate_anchor.wgs84.crs=null,"coordinate CRS"],
  ["vertical terrain invented",m=>m.coordinate_anchor.render_frame.vertical_datum="RH2000","vertical datum invented"],
  ["notional disc promoted",m=>m.parcel_representation.state="VERIFIED","notional parcel"],
  ["legal boundary invented",m=>m.parcel_representation.legal_boundary_available=true,"boundary invented"],
  ["terrain mesh invented",m=>m.terrain.mesh_available=true,"terrain invented"],
  ["building footprints invented",m=>m.context_layers.find(x=>x.layer_id==="SURROUNDING_BUILDINGS").render_allowed=true,"buildings invented"],
  ["road geometry invented",m=>m.context_layers.find(x=>x.layer_id==="ROADS_AND_STREETS").render_allowed=true,"road geometry invented"],
  ["entitlement invented",m=>m.planning.entitlement_state="VERIFIED","planning entitlement"],
  ["consultation treated as adopted",m=>m.planning.strategic_context.svartinge_2026="ADOPTED","draft status promoted"],
  ["gate waived",m=>m.hard_gates.find(g=>g.gate_id==="LEGAL_ACCESS").state="PASS","hard gate set"],
  ["stage skipped",m=>m.interface_stages.splice(2,1),"stage chain"],
  ["room entry enabled",m=>m.camera_lod_contract.at(-1).lod="LOD4_ROOM","prematurely enabled"],
  ["distance invented",m=>m.proximity_register[0].distance_m=120,"unsupported distance invented"],
  ["source method erased",m=>m.proximity_register[0].measurement_method="","source/date/method missing"],
  ["UNKNOWN state erased",m=>m.evidence_register=m.evidence_register.filter(x=>x.state!=="UNKNOWN"),"all five truth states"],
  ["Munin price injected",m=>m.munin_interface.price=123,"forbidden Munin payload key"],
  ["Munin owner injected",m=>m.munin_interface.owner="person","forbidden Munin payload key"],
  ["Munin payload enabled",m=>m.munin_interface.payload_persisted=true,"Munin interface payload"],
  ["source hash poisoned",m=>m.source_binding.sha256="0".repeat(64),"source binding hash mismatch"],
  ["geometry hash poisoned",m=>m.parcel_representation.geometry_sha256="0".repeat(64),"geometry hash mismatch"]
  ,["unknown nested field",m=>m.coordinate_anchor.secret="leak","coordinate_anchor: unknown or missing fields"]
];
for(const [name,mutate,needle] of attacks){const m=structuredClone(baseline);mutate(m);const result=validateNeighbourhoodAlpha(m);assert.equal(result.ok,false,name);assert.ok(result.errors.some(e=>e.includes(needle)),`${name}: ${result.errors.join(" | ")}`);}
console.log(`Svärtinge Neighbourhood Twin Alpha mutation suite passed (${attacks.length} attacks)`);
