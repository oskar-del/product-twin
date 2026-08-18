import assert from "node:assert/strict";
import fs from "node:fs";
import {validateContextProviders,validateStreetContext,validateSvartingePrototype} from "./validate-svartinge-neighbourhood-prototype-v0.2.mjs";

const baseline=JSON.parse(fs.readFileSync("data/sites/sweden/saterdalsvagen-14/neighbourhood-scene-v0.2.json","utf8"));
const providerBaseline=JSON.parse(fs.readFileSync("data/sites/sweden/saterdalsvagen-14/context-providers-v0.1.json","utf8"));
const streetBaseline=JSON.parse(fs.readFileSync("data/sites/sweden/saterdalsvagen-14/street-context-v0.1.json","utf8"));
assert.equal(validateSvartingePrototype(baseline).ok,true,"baseline scene must validate");
assert.equal(validateContextProviders(providerBaseline).ok,true,"baseline provider registry must validate");
assert.equal(validateStreetContext(streetBaseline).ok,true,"baseline street context must validate");

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

const providerAttacks=[
  ["provider schema mutated",m=>m.schema_version="svartinge-context-providers/v9","provider schema version drift"],
  ["external source marked connected",m=>m.providers.find(x=>x.provider_id==="MAPBOX_STANDARD_SATELLITE").state="CONNECTED","external provider falsely marked connected"],
  ["Mapbox key gate removed",m=>m.providers.find(x=>x.provider_id==="MAPBOX_STANDARD_SATELLITE").state="EXECUTABLE_NOT_TESTED","Mapbox access state promoted"],
  ["Street View promoted",m=>m.providers.find(x=>x.provider_id==="GOOGLE_STREET_VIEW").state="CONNECTED","Street View reference state promoted"],
  ["credential flag promoted",m=>m.providers[0].credential_configured=true,"credential state must remain redacted false"],
  ["provider limitation erased",m=>m.providers[0].limitations=[],"provider limitations missing"],
  ["unknown provider field",m=>m.providers[0].token="secret","unknown or missing fields"]
];
for(const [name,mutate,needle] of providerAttacks){
  const changed=structuredClone(providerBaseline);mutate(changed);const result=validateContextProviders(changed);
  assert.equal(result.ok,false,name);assert.ok(result.errors.some(e=>e.includes(needle)),`${name}: ${result.errors.join(" | ")}`);
}
const streetAttacks=[
  ["Street View promoted",m=>m.observations.find(x=>x.provider_id==="GOOGLE_STREET_VIEW").evidence_role="AUTHORITATIVE_CONTEXT_CANDIDATE","Google Street View scope promoted"],
  ["exact frontage invented",m=>m.observations.find(x=>x.provider_id==="GOOGLE_STREET_VIEW").exact_plot_frontage_confirmed=true,"provider content or geometry promoted"],
  ["provider image persisted",m=>m.observations.find(x=>x.provider_id==="GOOGLE_STREET_VIEW").content_persisted=true,"provider content or geometry promoted"],
  ["provider geometry extraction enabled",m=>m.observations.find(x=>x.provider_id==="GOOGLE_STREET_VIEW").geometry_extraction_allowed=true,"provider content or geometry promoted"],
  ["Street View date promoted",m=>m.observations.find(x=>x.provider_id==="GOOGLE_STREET_VIEW").imagery_date="2026-08","Google Street View observation identity/date drift"],
  ["orthophoto date invented",m=>m.observations.find(x=>x.provider_id==="NORRKOPING_ORTHOPHOTO").imagery_date="2025","orthophoto coverage or unresolved date misrepresented"],
  ["orthophoto hash drift",m=>m.observations.find(x=>x.provider_id==="NORRKOPING_ORTHOPHOTO").artifact_receipt.sha256="0".repeat(64),"orthophoto hash or CRS drift"],
  ["cache date promoted",m=>m.observations.find(x=>x.provider_id==="NORRKOPING_ORTHOPHOTO").artifact_receipt.cache_last_modified_is_acquisition_date=true,"cache timestamp promoted"],
  ["Google provider receipt invented",m=>m.observations.find(x=>x.provider_id==="GOOGLE_STREET_VIEW").artifact_receipt={sha256:"0".repeat(64)},"Google provider artifact receipt persisted"],
  ["listing promoted",m=>m.observations.find(x=>x.provider_id==="HEMNET_LISTING").evidence_role="AUTHORITATIVE_CONTEXT_CANDIDATE","exact-address listing visual scope promoted"],
  ["listing capture date invented",m=>m.observations.find(x=>x.provider_id==="HEMNET_LISTING").imagery_date="2026-08","listing gallery identity, date or artifact state drift"],
  ["listing pixels persisted",m=>m.observations.find(x=>x.provider_id==="HEMNET_LISTING").content_persisted=true,"provider content or geometry promoted"],
  ["listing geometry extraction",m=>m.observations.find(x=>x.provider_id==="HEMNET_LISTING").geometry_extraction_allowed=true,"provider content or geometry promoted"],
  ["listing character promoted",m=>m.character.exact_plot_visual.state="AUTHORITATIVE","street character exact_plot_visual promoted or empty"],
  ["listing pixels policy weakened",m=>m.rendering_policy.listing_pixels_in_repository=true,"street rendering evidence separation weakened"],
  ["street character promoted",m=>m.character.road.state="AUTHORITATIVE","street character road promoted or empty"],
  ["street unknown field",m=>m.dashboard=true,"street context: unknown or missing fields"]
];
for(const [name,mutate,needle] of streetAttacks){
  const changed=structuredClone(streetBaseline);mutate(changed);const result=validateStreetContext(changed);
  assert.equal(result.ok,false,name);assert.ok(result.errors.some(e=>e.includes(needle)),`${name}: ${result.errors.join(" | ")}`);
}
console.log(`Svärtinge 3D prototype mutation suite passed (${attacks.length+providerAttacks.length+streetAttacks.length} attacks)`);
