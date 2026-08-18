import assert from "node:assert/strict";
import fs from "node:fs";
import {validateContextProviders,validateOfficialContextGeometrySources,validateStreetContext,validateSvartingePrototype,validateTerrainSourceMetadata} from "./validate-svartinge-neighbourhood-prototype-v0.2.mjs";

const baseline=JSON.parse(fs.readFileSync("data/sites/sweden/saterdalsvagen-14/neighbourhood-scene-v0.2.json","utf8"));
const providerBaseline=JSON.parse(fs.readFileSync("data/sites/sweden/saterdalsvagen-14/context-providers-v0.1.json","utf8"));
const streetBaseline=JSON.parse(fs.readFileSync("data/sites/sweden/saterdalsvagen-14/street-context-v0.1.json","utf8"));
const terrainBaseline=JSON.parse(fs.readFileSync("data/sites/sweden/saterdalsvagen-14/terrain-source-metadata-v0.1.json","utf8"));
const officialGeometryBaseline=JSON.parse(fs.readFileSync("data/sites/sweden/saterdalsvagen-14/official-context-geometry-sources-v0.1.json","utf8"));
assert.equal(validateSvartingePrototype(baseline).ok,true,"baseline scene must validate");
assert.equal(validateContextProviders(providerBaseline).ok,true,"baseline provider registry must validate");
assert.equal(validateStreetContext(streetBaseline).ok,true,"baseline street context must validate");
assert.equal(validateTerrainSourceMetadata(terrainBaseline).ok,true,"baseline terrain source metadata must validate");
assert.equal(validateOfficialContextGeometrySources(officialGeometryBaseline).ok,true,"baseline official context geometry sources must validate");

const attacks=[
  ["identity promoted",m=>m.subject.identity_scope="PROPERTY_REGISTER_VERIFIED","identity scope promoted"],
  ["evidence vocabulary changed",m=>m.evidence_classes.push("VERIFIED"),"evidence class vocabulary"],
  ["vertical datum invented",m=>m.coordinate_system.vertical_reference="RH2000","vertical reference promoted"],
  ["axis convention changed",m=>m.coordinate_system.axes.z="SOUTH","local axis convention"],
  ["municipal area promoted",m=>m.measurements.municipal_map_area_m2.evidence_class="AUTHORITATIVE","municipal area over-promoted"],
  ["listing area promoted",m=>m.measurements.listing_area_m2.evidence_class="AUTHORITATIVE","listing area state"],
  ["legal boundary enabled",m=>m.legal_claim_policy.blocked_claims=m.legal_claim_policy.blocked_claims.filter(x=>x!=="LEGAL_BOUNDARY"),"missing blocked legal claim LEGAL_BOUNDARY"],
  ["concept visualization blocked",m=>m.legal_claim_policy.concept_design_allowed=false,"concept capability incorrectly blocked"],
  ["street stage removed",m=>m.navigation=m.navigation.filter(x=>x.id!=="STREET_VIEW"),"navigation progression"],
  ["room stage removed",m=>m.navigation=m.navigation.filter(x=>x.id!=="ROOM"),"navigation progression"],
  ["room cutaway disabled",m=>m.navigation.find(x=>x.id==="ROOM").cutaway=false,"interior cutaway missing"],
  ["live camera drift",m=>m.navigation.find(x=>x.id==="STREET_VIEW").live_context_view.bearing+=5,"live context camera is not deterministically synchronized"],
  ["live camera evidence promoted",m=>m.navigation.find(x=>x.id==="STREET_VIEW").live_context_view.evidence_effect="CLOSE_GATE","live context camera is not deterministically synchronized"],
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
const terrainAttacks=[
  ["terrain source changed",m=>m.source_item.item_id="650_56","terrain source item changed"],
  ["terrain datum changed",m=>m.source_item.vertical_datum="UNKNOWN","terrain CRS, datum or resolution drift"],
  ["terrain metadata hash changed",m=>m.public_metadata_receipts[1].sha256="0".repeat(64),"terrain receipt identity drift"],
  ["terrain date invented",m=>m.source_at_plot.measurement_date="2026-08-18","terrain plot-area provenance drift"],
  ["terrain raster promoted",m=>m.raster_access.raster_bytes_acquired=true,"terrain raster access falsely promoted"],
  ["terrain value promoted",m=>m.raster_access.terrain_values_available=true,"terrain raster access falsely promoted"],
  ["terrain gate closed",m=>m.terrain_gate.status="SATISFIED","terrain gate closed or weakened"],
  ["municipal coverage invented",m=>m.municipal_alternative.exact_plot_coverage="CONFIRMED","municipal terrain alternative promoted"],
  ["terrain unknown field",m=>m.elevation_m=42,"terrain metadata: unknown or missing fields"]
];
for(const [name,mutate,needle] of terrainAttacks){
  const changed=structuredClone(terrainBaseline);mutate(changed);const result=validateTerrainSourceMetadata(changed);
  assert.equal(result.ok,false,name);assert.ok(result.errors.some(e=>e.includes(needle)),`${name}: ${result.errors.join(" | ")}`);
}
const officialGeometryAttacks=[
  ["building item changed",m=>m.datasets.buildings.item_id="0582","official geometry dataset identity drift"],
  ["building locator excluded",m=>m.datasets.buildings.wgs84_bbox=[10,50,11,51],"official geometry dataset does not cover locator"],
  ["building bytes promoted",m=>m.datasets.buildings.asset_access.bytes_acquired=true,"official geometry asset falsely promoted"],
  ["property asset status changed",m=>m.datasets.property_division.asset_access.http_status_without_credentials=200,"official geometry asset falsely promoted"],
  ["building heights invented",m=>m.import_contract.building_heights_may_be_invented=true,"official geometry derivation scope promoted"],
  ["road width invented",m=>m.import_contract.road_width_may_be_invented=true,"official geometry derivation scope promoted"],
  ["legal access inferred",m=>m.import_contract.legal_access_may_be_inferred=true,"official geometry derivation scope promoted"],
  ["road geometry promoted",m=>m.road_source.geometry_available=true,"official road geometry falsely promoted"],
  ["topography collection invented",m=>m.catalogue.topography_10_collection_present=true,"official geometry catalogue collection claim drift"],
  ["geometry gate closed",m=>m.promotion_gates[0].status="SATISFIED","official context geometry gate closed or incomplete"]
];
for(const [name,mutate,needle] of officialGeometryAttacks){
  const changed=structuredClone(officialGeometryBaseline);mutate(changed);const result=validateOfficialContextGeometrySources(changed);
  assert.equal(result.ok,false,name);assert.ok(result.errors.some(e=>e.includes(needle)),`${name}: ${result.errors.join(" | ")}`);
}
console.log(`Svärtinge 3D prototype mutation suite passed (${attacks.length+providerAttacks.length+streetAttacks.length+terrainAttacks.length+officialGeometryAttacks.length} attacks)`);
