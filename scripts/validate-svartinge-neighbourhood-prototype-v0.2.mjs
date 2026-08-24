import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
import {deriveLiveContextView} from "../prototype/svartinge-neighbourhood/geographic-alignment.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const scenePath="data/sites/sweden/saterdalsvagen-14/neighbourhood-scene-v0.2.json";
const schemaPath="config/spatial/svartinge-neighbourhood-scene-v0.2.schema.json";
const providerPath="data/sites/sweden/saterdalsvagen-14/context-providers-v0.1.json";
const providerSchemaPath="config/spatial/svartinge-context-providers-v0.1.schema.json";
const streetPath="data/sites/sweden/saterdalsvagen-14/street-context-v0.1.json";
const streetSchemaPath="config/spatial/svartinge-street-context-v0.1.schema.json";
const terrainMetadataPath="data/sites/sweden/saterdalsvagen-14/terrain-source-metadata-v0.1.json";
const terrainMetadataSchemaPath="config/spatial/svartinge-terrain-source-metadata-v0.1.schema.json";
const officialGeometryPath="data/sites/sweden/saterdalsvagen-14/official-context-geometry-sources-v0.1.json";
const officialGeometrySchemaPath="config/spatial/svartinge-official-context-geometry-sources-v0.1.schema.json";
const aerialHistoryPath="data/sites/sweden/saterdalsvagen-14/municipal-aerial-history-v0.1.json";
const aerialHistorySchemaPath="config/spatial/svartinge-municipal-aerial-history-v0.1.schema.json";
const visualReconstructionPath="data/sites/sweden/saterdalsvagen-14/visual-reconstruction-v0.1.json";
const visualReconstructionSchemaPath="config/spatial/svartinge-visual-reconstruction-v0.1.schema.json";
const viewerPath="prototype/svartinge-neighbourhood/index.html";
const liveAdapterPath="prototype/svartinge-neighbourhood/live-context-adapter.mjs";
const serverPath="scripts/serve-svartinge-neighbourhood-prototype.mjs";
const CLASSES=["AUTHORITATIVE","INDICATIVE","DERIVED","REPORTED_UNVERIFIED","CONCEPT"];
const STEPS=["NEIGHBOURHOOD_VIEW","STREET_VIEW","PLOT_ORBIT","CONCEPT_HOUSE_ON_PLOT","BUILDING_ORBIT","ENTER_BUILDING","ROOM"];
const BLOCKED=["LEGAL_BOUNDARY","REGISTERED_AREA","ENTITLEMENT","BUILDABLE_ENVELOPE","LEGAL_ACCESS","UTILITY_CAPACITY","SURVEYED_TERRAIN","FINISHED_FLOOR_LEVEL"];
const PROVIDER_STATES=["CONNECTED","EXECUTABLE_NOT_TESTED","DOCUMENTED_NOT_CONNECTED","KEY_REQUIRED","RESEARCH_ONLY"];
const FORBIDDEN_LOCAL_KEYS=new Set(["owner","owners","asking_price","sale_price","price","transaction","transactions","valuation","comparables","utility_capacity_verified","legal_access_verified","entitled"]);
const read=(p,r=root)=>JSON.parse(fs.readFileSync(path.join(r,p),"utf8"));
const shaAt=(r,p)=>crypto.createHash("sha256").update(fs.readFileSync(path.join(r,p))).digest("hex");

function exactKeys(value,keys,label,check){check(value&&typeof value==="object"&&!Array.isArray(value)&&Object.keys(value).sort().join("|")===[...keys].sort().join("|"),`${label}: unknown or missing fields`);}
function walk(value,name="scene",errors=[]){
  if(Array.isArray(value)){value.forEach((v,i)=>walk(v,`${name}[${i}]`,errors));return errors;}
  if(!value||typeof value!=="object")return errors;
  for(const [k,v] of Object.entries(value)){if(FORBIDDEN_LOCAL_KEYS.has(k.toLowerCase()))errors.push(`${name}.${k}: forbidden external fact payload`);walk(v,`${name}.${k}`,errors);}return errors;
}
function polygonArea(points){let twice=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];twice+=a[0]*b[1]-b[0]*a[1];}return Math.abs(twice)/2;}
function bboxContains(bbox,point){return Array.isArray(bbox)&&bbox.length===4&&point[0]>=bbox[0]&&point[0]<=bbox[2]&&point[1]>=bbox[1]&&point[1]<=bbox[3];}

export function validateContextProviders(registry){
  const errors=[];let assertions=0;const check=(ok,msg)=>{assertions++;if(!ok)errors.push(msg);};
  exactKeys(registry,["schema_version","entity_type","subject","policy","providers"],"provider registry",check);
  check(registry.schema_version==="svartinge-context-providers/v0.1","provider schema version drift");
  check(registry.entity_type==="SpatialContextProviderRegistry"&&registry.subject==="SVÄRTINGE 54:28","provider subject drift");
  check(registry.policy?.no_committed_credentials===true&&registry.policy?.no_provider_content_reclassified===true&&registry.policy?.restricted_tiles_live_only===true&&registry.policy?.attribution_required===true,"provider safety policy weakened");
  const providers=registry.providers??[],ids=new Set();check(providers.length>=8,"provider stack incomplete");
  for(const provider of providers){
    exactKeys(provider,["provider_id","label","capability","state","evidence_role","delivery_mode","credential_configured","source_url","limitations"],provider.provider_id??"provider",check);
    check(Boolean(provider.provider_id&&!ids.has(provider.provider_id)),`${provider.provider_id||"provider"}: missing or duplicate provider id`);ids.add(provider.provider_id);
    check(PROVIDER_STATES.includes(provider.state),`${provider.provider_id}: invalid provider state`);
    check(provider.credential_configured===false,`${provider.provider_id}: credential state must remain redacted false`);
    check(/^https:\/\//.test(provider.source_url??""),`${provider.provider_id}: authoritative documentation URL missing`);
    check(Array.isArray(provider.limitations)&&provider.limitations.length>0,`${provider.provider_id}: provider limitations missing`);
  }
  check(JSON.stringify(providers.filter(x=>x.state==="CONNECTED").map(x=>x.provider_id).sort())===JSON.stringify(["LOCAL_PROCEDURAL_REALISM","NORRKOPING_ORTHOPHOTO"]),"provider connection set drift");
  check(providers.find(x=>x.provider_id==="MAPBOX_STANDARD_SATELLITE")?.state==="KEY_REQUIRED","Mapbox access state promoted");
  check(providers.find(x=>x.provider_id==="GOOGLE_STREET_VIEW")?.state==="RESEARCH_ONLY","Street View reference state promoted");
  check(providers.find(x=>x.provider_id==="GOOGLE_PHOTOREALISTIC_3D_TILES")?.state==="KEY_REQUIRED","Google 3D Tiles access state promoted");
  check(providers.find(x=>x.provider_id==="LANTMATERIET_BUILDINGS_0581")?.state==="KEY_REQUIRED","official building access state promoted");
  check(providers.find(x=>x.provider_id==="LANTMATERIET_PROPERTY_DIVISION_0581")?.state==="KEY_REQUIRED","official property-division access state promoted");
  check(providers.find(x=>x.provider_id==="TRAFIKVERKET_NVDB_ROAD_NETWORK")?.state==="KEY_REQUIRED","official road access state promoted");
  check(providers.find(x=>x.provider_id==="NORRKOPING_ORTHOPHOTO")?.evidence_role==="LIVE_VISUAL_CONTEXT"&&providers.find(x=>x.provider_id==="NORRKOPING_ORTHOPHOTO")?.delivery_mode==="LIVE_TILES","municipal live aerial provider contract drift");
  check(!/(api[_-]?key|access[_-]?token|password|connection[_-]?string|client[_-]?secret)\s*[\":=]+\s*[\"']?(?!required|false|null)/i.test(JSON.stringify(registry)),"provider registry contains a possible credential payload");
  return {ok:errors.length===0,assertions,errors};
}

export function validateMunicipalAerialHistory(history,{repoRoot=root}={}){
  const errors=[];let assertions=0;const check=(ok,msg)=>{assertions++;if(!ok)errors.push(msg);};
  exactKeys(history,["schema_version","entity_type","subject","authority","service","locator","live_layers","rendering_policy","gate"],"municipal aerial history",check);
  check(history.schema_version==="svartinge-municipal-aerial-history/v0.1"&&history.entity_type==="MunicipalAerialHistoryReferenceSet"&&history.subject==="SVÄRTINGE 54:28"&&history.authority==="Norrköpings kommun","municipal aerial history identity drift");
  const service=history.service??{};
  exactKeys(service,["endpoint","protocol","service_title","crs","axis_order","capabilities_retrieved_at","capabilities_receipt"],"municipal aerial service",check);
  check(service.endpoint==="https://kartdata.norrkoping.se/wms?servicename=kartor"&&service.protocol==="WMS 1.3.0"&&service.service_title==="SpatialMap 4.3.0"&&service.crs==="EPSG:3010","municipal aerial service identity drift");
  check(service.axis_order==="NORTHING_EASTING_FOR_WMS_1_3_0","municipal aerial WMS axis order drift");
  const receipt=service.capabilities_receipt??{},runtimePath=path.join(repoRoot,receipt.runtime_locator??"");
  check(receipt.byte_count===609850&&receipt.sha256==="de938fb1cd269fed257e66ee32bfaa79c06912a076f1c3cbb80f07747339cd03"&&receipt.content_persisted_in_repository===false,"municipal aerial capability receipt drift");
  if(receipt.runtime_locator&&fs.existsSync(runtimePath)){check(fs.statSync(runtimePath).size===receipt.byte_count,"municipal aerial capability runtime byte count mismatch");check(shaAt(repoRoot,receipt.runtime_locator)===receipt.sha256,"municipal aerial capability runtime hash mismatch");}
  check(JSON.stringify(history.locator?.coordinate_epsg3010_easting_northing)===JSON.stringify([122807,6504014])&&/not survey control/i.test(history.locator?.scope??""),"municipal aerial locator scope promoted or changed");
  const expected={AERIAL_2008:{layer:"ortofoto_aldre_norrkoping_2008",title:"Norrköping, Åby, Svärtinge 2008",year:2008,bytes:767978,hash:"c4a205bfb082d0c41833af118cc8569ba070690f126b8f0369f141ed728e07a1"},AERIAL_2010:{layer:"ortofoto_aldre_norrkoping_2010",title:"Norrköping, Åby, Svärtinge 2010",year:2010,bytes:804720,hash:"5b687e5f372aee18044efbe60a269b487858a5060c0f2051fbf4fed54664d8e4"},AERIAL_2017:{layer:"ortofoto_orter_lm",title:"Hela kommunen 2017",year:2017,bytes:686340,hash:"d9e3298846736dbe2374358ba06ae6e24cb464579785660906e2e84d80952516"},AERIAL_2025:{layer:"extwms_lm_ortofoto",title:"Flygfoto 2025",year:2025,bytes:123575,hash:"bb67a2ecefe1f5bdb9aaa6b1fc0695cab72fdb4c726e6b1f73e704bf71902c3f"}};
  const layers=history.live_layers??[],ids=new Set();check(layers.length===4,"municipal aerial history layer set incomplete");
  for(const layer of layers){
    exactKeys(layer,["layer_id","wms_layer","service_title","year_label","year_label_is_verified_capture_date","live_request_url","request_bbox_axis_order","response_observed_at","response_status","response_byte_count","response_sha256","response_persisted","exact_locator_covered"],layer.layer_id??"aerial layer",check);
    const spec=expected[layer.layer_id];check(Boolean(spec&&!ids.has(layer.layer_id)),`${layer.layer_id||"aerial layer"}: missing, duplicate or unexpected`);ids.add(layer.layer_id);
    check(layer.wms_layer===spec?.layer&&layer.service_title===spec?.title&&layer.year_label===spec?.year,"municipal aerial layer identity drift");
    check(layer.year_label_is_verified_capture_date===false&&layer.response_persisted===false&&layer.exact_locator_covered===true,"municipal aerial layer over-promoted or persisted");
    check(layer.response_status===200&&layer.response_byte_count===spec?.bytes&&layer.response_sha256===spec?.hash,"municipal aerial response receipt drift");
    check(/^https:\/\/kart(?:data|or-cache)\.norrkoping\.se\//.test(layer.live_request_url??"")&&!/(token|key|password|secret)=/i.test(layer.live_request_url??""),"municipal aerial live URL invalid or credential-bearing");
  }
  check(Object.keys(expected).every(id=>ids.has(id)),"municipal aerial expected layers missing");
  const policy=history.rendering_policy??{};
  check(policy.mode==="LIVE_REFERENCE_ONLY"&&policy.provider_pixels_in_repository===false&&policy.browser_cache_is_provider_controlled===true&&policy.attribution_required===true,"municipal aerial live-only policy weakened");
  check(policy.geometry_extraction_allowed===false&&policy.evidence_promotion_allowed===false&&policy.legal_boundary_effect==="NONE"&&policy.source_year_labels_are_capture_dates===false,"municipal aerial evidence policy promoted");
  check(history.gate?.gate_id==="GATE_SE_AERIAL_PROVENANCE_AND_PUBLICATION_RIGHTS"&&history.gate?.status==="OPEN","municipal aerial provenance gate closed or changed");
  return {ok:errors.length===0,assertions,errors};
}

export function validateVisualReconstruction(manifest,{repoRoot=root}={}){
  const errors=[];let assertions=0;const check=(ok,msg)=>{assertions++;if(!ok)errors.push(msg);};
  exactKeys(manifest,["schema_version","entity_type","subject","renderings","policy"],"visual reconstruction",check);
  check(manifest.schema_version==="svartinge-visual-reconstruction/v0.1"&&manifest.entity_type==="VisualReconstructionManifest"&&manifest.subject==="SVÄRTINGE 54:28","visual reconstruction identity drift");
  const renderings=manifest.renderings??[],specs={
    VR_SE_SVARTINGE_STREET_ARRIVAL_V01:{viewpoint:"STREET_ARRIVAL_EXISTING_CONDITION",path:"prototype/svartinge-neighbourhood/assets/street-arrival-existing-condition-v0.1.png",hash:"47c0ce69c29659c219f9c12d1cc1be08235a505ed941dad48e801ad0f8ccec13"},
    VR_SE_SVARTINGE_NEIGHBOURHOOD_AERIAL_V01:{viewpoint:"NEIGHBOURHOOD_AERIAL_EXISTING_CONDITION",path:"prototype/svartinge-neighbourhood/assets/neighbourhood-aerial-existing-condition-v0.1.png",hash:"45b6a7d4332e5359735acb075310423e88f178088917ccc99058cfcbd0891d41"},
    VR_SE_SVARTINGE_STREET_APPROACH_V01:{viewpoint:"STREET_APPROACH_EXISTING_CONDITION",path:"prototype/svartinge-neighbourhood/assets/street-approach-existing-condition-v0.1.png",hash:"891a5749880b458aff87377325e53b0f2119789c3fc7765381660c9fc3ac463c"},
    VR_SE_SVARTINGE_PLOT_OUTLOOK_V01:{viewpoint:"PLOT_OUTLOOK_EXISTING_CONDITION",path:"prototype/svartinge-neighbourhood/assets/plot-outlook-existing-condition-v0.1.png",hash:"6df422ab0f4ba2059e6f2db83295610c52c36ca13beb26cbc3402c7815ee6bf4"}
  };check(renderings.length===4,"visual reconstruction set incomplete");
  const ids=new Set();for(const item of renderings){
    exactKeys(item,["rendering_id","title","asset_path","asset_sha256","pixel_dimensions","viewpoint","evidence_state","generation_method","source_refs","observed_character","limitations"],"visual reconstruction item",check);
    const spec=specs[item.rendering_id];check(Boolean(spec&&!ids.has(item.rendering_id)),"visual reconstruction viewpoint drift");ids.add(item.rendering_id);
    check(item.viewpoint===spec?.viewpoint&&item.asset_path===spec?.path&&item.asset_sha256===spec?.hash,"visual reconstruction asset identity drift");
    check(item.evidence_state==="CONCEPT_VISUAL_RECONSTRUCTION"&&item.generation_method==="GENERATIVE_RENDER_FROM_REFERENCE_OBSERVATIONS","visual reconstruction promoted or method changed");
    check(JSON.stringify(item.pixel_dimensions)===JSON.stringify({width:1672,height:941}),"visual reconstruction dimensions drift");
    check(item.source_refs?.length>=2,"visual reconstruction source bindings incomplete");
    check(item.observed_character?.length>=6&&item.limitations?.length>=5&&item.limitations?.some(x=>/generative visual reconstruction/i.test(x)),"visual reconstruction limitations incomplete");
    const asset=path.join(repoRoot,item.asset_path??"");check(fs.existsSync(asset),"visual reconstruction asset missing");if(fs.existsSync(asset))check(shaAt(repoRoot,item.asset_path)===item.asset_sha256,"visual reconstruction asset hash mismatch");
  }
  check(Object.keys(specs).every(id=>ids.has(id)),"visual reconstruction expected views missing");
  const policy=manifest.policy??{};
  exactKeys(policy,["is_source_photograph","is_survey_evidence","closes_evidence_gate","provider_pixels_in_asset","geometry_extraction_allowed","display_label","blocked_claims"],"visual reconstruction policy",check);
  check(policy.is_source_photograph===false&&policy.is_survey_evidence===false&&policy.closes_evidence_gate===false&&policy.provider_pixels_in_asset===false&&policy.geometry_extraction_allowed===false,"visual reconstruction evidence policy promoted");
  check(policy.display_label==="VISUAL RECONSTRUCTION · NOT A SURVEY OR CURRENT PHOTOGRAPH","visual reconstruction display warning drift");
  check(JSON.stringify(policy.blocked_claims)===JSON.stringify(BLOCKED),"visual reconstruction hard gates changed");
  return {ok:errors.length===0,assertions,errors};
}

export function validateOfficialContextGeometrySources(sourceSet,{repoRoot=root}={}){
  const errors=[];let assertions=0;const check=(ok,msg)=>{assertions++;if(!ok)errors.push(msg);};
  exactKeys(sourceSet,["schema_version","entity_type","subject","authority","catalogue","datasets","access_guide","road_source","import_contract","promotion_gates"],"official context geometry sources",check);
  check(sourceSet.schema_version==="svartinge-official-context-geometry-sources/v0.1"&&sourceSet.entity_type==="OfficialContextGeometrySourceReceiptSet"&&sourceSet.subject==="SVÄRTINGE 54:28","official geometry source identity drift");
  const catalogue=sourceSet.catalogue??{};
  check(catalogue.api_url==="https://api.lantmateriet.se/stac-vektor/v1/"&&catalogue.license==="CC-BY-4.0"&&catalogue.special_terms_review_required===true,"official geometry catalogue policy drift");
  check(JSON.stringify(catalogue.collections_observed)===JSON.stringify(["kommun-lan-rike","fastighetsindelning","belagenhetsadresser","byggnader","marktacke","ortnamn"])&&catalogue.topography_10_collection_present===false,"official geometry catalogue collection claim drift");
  const locatorWgs=[16.0317063331,58.6522414431],locatorProjected=[559868.9999,6501790.311];
  const expected={buildings:{collection:"byggnader",title:"Byggnader för Norrköpings kommun",updated_at:"2026-08-14T23:30:00.889000Z",asset_size_bytes:14122089,sha256:"c4c98db79320b39f6430d79c004924de9b849c7f38f17738923ddf6e5c67b827"},property_division:{collection:"fastighetsindelning",title:"Fastighetsindelning i Norrköpings kommun",updated_at:"2026-08-15T00:14:50.028000Z",asset_size_bytes:44443839,sha256:"4b3754293bed4951194b97f47c7e4e9ac1a53a0098a09445b1e831db734b1554"}};
  for(const [key,spec] of Object.entries(expected)){
    const dataset=sourceSet.datasets?.[key]??{};
    check(dataset.collection===spec.collection&&dataset.item_id==="0581"&&dataset.title===spec.title&&dataset.updated_at===spec.updated_at,"official geometry dataset identity drift");
    check(dataset.horizontal_crs==="EPSG:3006"&&dataset.asset_media_type==="application/zip"&&dataset.asset_format==="GeoPackage in ZIP"&&dataset.asset_size_bytes===spec.asset_size_bytes,"official geometry dataset format or size drift");
    check(bboxContains(dataset.wgs84_bbox,locatorWgs)&&bboxContains(dataset.projected_bbox,locatorProjected)&&dataset.locator_covered===true,"official geometry dataset does not cover locator");
    check(dataset.metadata_state==="OFFICIAL_METADATA_VERIFIED"&&dataset.metadata_receipt?.sha256===spec.sha256,"official geometry metadata receipt drift");
    check(dataset.asset_access?.state==="KEY_REQUIRED"&&dataset.asset_access?.http_status_without_credentials===401&&dataset.asset_access?.bytes_acquired===false&&dataset.asset_access?.geometry_available===false&&dataset.asset_access?.credential_persisted===false,"official geometry asset falsely promoted");
    const receipt=dataset.metadata_receipt??{},runtimePath=path.join(repoRoot,receipt.runtime_locator??"");
    if(receipt.runtime_locator&&fs.existsSync(runtimePath)){check(fs.statSync(runtimePath).size===receipt.byte_count,`${key}: runtime metadata byte count mismatch`);check(shaAt(repoRoot,receipt.runtime_locator)===receipt.sha256,`${key}: runtime metadata hash mismatch`);}
  }
  const receipt=sourceSet.catalogue?.receipt??{},catalogueRuntime=path.join(repoRoot,receipt.runtime_locator??"");
  check(receipt.sha256==="1d19a0f3b9a4b143027bfa92506d68da520b787505971def659e68f75b5c669d"&&receipt.byte_count===6868&&receipt.content_persisted_in_repository===false,"official catalogue receipt drift");
  if(receipt.runtime_locator&&fs.existsSync(catalogueRuntime)){check(fs.statSync(catalogueRuntime).size===receipt.byte_count,"official catalogue runtime byte count mismatch");check(shaAt(repoRoot,receipt.runtime_locator)===receipt.sha256,"official catalogue runtime hash mismatch");}
  const guide=sourceSet.access_guide??{},guideRuntime=path.join(repoRoot,guide.runtime_locator??"");
  check(guide.states_product_must_be_ordered===true&&guide.states_authorization_required===true&&guide.byte_count===161318&&guide.sha256==="d6fcbd7a86ff522998b505b58e61119ab3eff0e268240beeb035b9c620098da9","official access guide receipt drift");
  if(guide.runtime_locator&&fs.existsSync(guideRuntime)){check(fs.statSync(guideRuntime).size===guide.byte_count,"official access guide runtime byte count mismatch");check(shaAt(repoRoot,guide.runtime_locator)===guide.sha256,"official access guide runtime hash mismatch");}
  const road=sourceSet.road_source??{};
  check(road.authority==="Trafikverket"&&road.product==="NVDB Vägtrafiknät"&&road.documented_current_data===true&&road.download_requires_registered_account===true,"official road source identity drift");
  check(road.state==="KEY_REQUIRED"&&road.exact_extract_acquired===false&&road.geometry_available===false,"official road geometry falsely promoted");
  const contract=sourceSet.import_contract??{};
  check(contract.runtime_credentials_only===true&&contract.committed_credentials_forbidden===true&&contract.raw_asset_sha256_required===true&&contract.geopackage_integrity_check_required===true&&contract.source_crs_must_be_parsed===true&&contract.derived_geometry_hash_required===true,"official geometry import safety contract weakened");
  check(contract.clip_buffer_m===250&&contract.source_object_ids_must_be_preserved===true&&contract.building_heights_may_be_invented===false&&contract.road_width_may_be_invented===false&&contract.legal_access_may_be_inferred===false,"official geometry derivation scope promoted");
  const gates=sourceSet.promotion_gates??[];
  check(gates.length===3&&new Set(gates.map(g=>g.gate_id)).size===3&&gates.every(g=>g.status==="OPEN"),"official context geometry gate closed or incomplete");
  check(!/(api[_-]?key|access[_-]?token|password|connection[_-]?string|client[_-]?secret)\s*[\":=]+\s*[\"']?(?!required|false|null)/i.test(JSON.stringify(sourceSet)),"official geometry receipts contain a possible credential payload");
  return {ok:errors.length===0,assertions,errors};
}

export function validateStreetContext(street){
  const errors=[];let assertions=0;const check=(ok,msg)=>{assertions++;if(!ok)errors.push(msg);};
  exactKeys(street,["schema_version","entity_type","subject","focus","observations","character","rendering_policy"],"street context",check);
  check(street.schema_version==="svartinge-street-context/v0.1","street context schema version drift");
  check(street.entity_type==="StreetContextObservationSet"&&street.subject==="SVÄRTINGE 54:28","street context subject drift");
  exactKeys(street.focus,["name","detail_radius_m","wider_context_policy","geometry_policy"],"street focus",check);
  check(street.focus?.detail_radius_m===80&&street.focus?.wider_context_policy==="LIGHTWEIGHT_CONTEXT_ONLY","street room focus drift");
  check(street.focus?.geometry_policy==="PRODUCT_TWIN_GEOMETRY_ONLY_NO_PROVIDER_TRACING","provider tracing enabled");
  const observations=street.observations??[],ids=new Set();check(observations.length===3,"street source observation set changed");
  for(const observation of observations){
    exactKeys(observation,["observation_id","provider_id","evidence_role","relationship_to_subject","source_url","observed_label","imagery_date","observed_at","artifact_receipt","content_persisted","geometry_extraction_allowed","exact_plot_frontage_confirmed","attribution","limitations"],observation.observation_id??"street observation",check);
    check(Boolean(observation.observation_id&&!ids.has(observation.observation_id)),`${observation.observation_id||"street observation"}: duplicate or missing id`);ids.add(observation.observation_id);
    check(/^https:\/\//.test(observation.source_url??""),`${observation.observation_id}: source URL missing`);
    check(observation.content_persisted===false&&observation.geometry_extraction_allowed===false&&observation.exact_plot_frontage_confirmed===false,`${observation.observation_id}: provider content or geometry promoted`);
    check(Array.isArray(observation.limitations)&&observation.limitations.length>=2,`${observation.observation_id}: limitations missing`);
  }
  const google=observations.find(x=>x.provider_id==="GOOGLE_STREET_VIEW");
  check(google?.evidence_role==="REFERENCE_ONLY"&&google?.relationship_to_subject==="NEARBY_SAME_STREET_NOT_EXACT_PLOT_FRONTAGE","Google Street View scope promoted");
  check(google?.observed_label==="8 Säterdalsvägen"&&google?.imagery_date==="2022-07","Google Street View observation identity/date drift");
  const listing=observations.find(x=>x.provider_id==="HEMNET_LISTING");
  check(listing?.evidence_role==="LISTED_REFERENCE"&&listing?.relationship_to_subject==="EXACT_ADDRESS_LISTING_GALLERY_NOT_SURVEY","exact-address listing visual scope promoted or missing");
  check(listing?.observed_label==="Säterdalsvägen 14 · five-image listing gallery"&&listing?.imagery_date===null&&listing?.artifact_receipt===null,"listing gallery identity, date or artifact state drift");
  check(listing?.content_persisted===false&&listing?.geometry_extraction_allowed===false&&listing?.exact_plot_frontage_confirmed===false,"listing pixels, geometry or exact frontage promoted");
  const ortho=observations.find(x=>x.provider_id==="NORRKOPING_ORTHOPHOTO");
  check(ortho?.relationship_to_subject==="EXACT_RECORDED_MUNICIPAL_POINT_TILE"&&ortho?.imagery_date===null,"orthophoto coverage or unresolved date misrepresented");
  exactKeys(ortho?.artifact_receipt,["request_method","canonical_request","response_status","content_type","byte_count","sha256","crs","bounds","cache_tile_index","cache_last_modified","cache_last_modified_is_acquisition_date"],"orthophoto artifact receipt",check);
  check(ortho?.artifact_receipt?.response_status===200&&ortho?.artifact_receipt?.content_type==="image/png"&&ortho?.artifact_receipt?.byte_count===123575,"orthophoto response receipt drift");
  check(ortho?.artifact_receipt?.sha256==="bb67a2ecefe1f5bdb9aaa6b1fc0695cab72fdb4c726e6b1f73e704bf71902c3f"&&ortho?.artifact_receipt?.crs==="EPSG:3010","orthophoto hash or CRS drift");
  check(JSON.stringify(ortho?.artifact_receipt?.bounds)===JSON.stringify([122675.2,6503526.4,123494.4,6504345.6])&&JSON.stringify(ortho?.artifact_receipt?.cache_tile_index)===JSON.stringify([56,189,6]),"orthophoto tile bounds/index drift");
  check(ortho?.artifact_receipt?.cache_last_modified_is_acquisition_date===false,"cache timestamp promoted as imagery acquisition date");
  check(google?.artifact_receipt===null,"Google provider artifact receipt persisted");
  exactKeys(street.character,["road","terrain_and_view","vegetation","utilities","buildings","frontage","exact_plot_visual"],"street character",check);
  for(const [name,item] of Object.entries(street.character??{})){exactKeys(item,["state","observed","render_use"],`street character ${name}`,check);const expected=name==="exact_plot_visual"?"LISTED_REFERENCE":"REFERENCE_ONLY_NEARBY";check(item.state===expected&&Array.isArray(item.observed)&&item.observed.length>0,`street character ${name} promoted or empty`);}
  check(street.character?.exact_plot_visual?.render_use==="EXACT_LISTING_CHARACTER_ONLY"&&street.character?.exact_plot_visual?.observed?.some(x=>x.includes("Glan")),"exact listing view character missing or promoted");
  exactKeys(street.rendering_policy,["street_room_high_detail","exact_provider_geometry","provider_pixels_in_repository","legal_or_survey_promotion","live_attribution_required","street_view_live_reference_only","listing_pixels_in_repository"],"street rendering policy",check);
  check(street.rendering_policy?.street_room_high_detail===true&&street.rendering_policy?.exact_provider_geometry===false&&street.rendering_policy?.provider_pixels_in_repository===false&&street.rendering_policy?.legal_or_survey_promotion===false&&street.rendering_policy?.live_attribution_required===true&&street.rendering_policy?.street_view_live_reference_only===true&&street.rendering_policy?.listing_pixels_in_repository===false,"street rendering evidence separation weakened");
  check(!/(data:image|image_key|pano(?:rama)?[_-]?id|base64)/i.test(JSON.stringify(street)),"provider image or panorama identifier persisted");
  return {ok:errors.length===0,assertions,errors};
}

export function validateTerrainSourceMetadata(terrain,{repoRoot=root}={}){
  const errors=[];let assertions=0;const check=(ok,msg)=>{assertions++;if(!ok)errors.push(msg);};
  exactKeys(terrain,["schema_version","entity_type","subject","source_item","public_metadata_receipts","locator_projection","source_at_plot","raster_access","municipal_alternative","terrain_gate"],"terrain metadata",check);
  check(terrain.schema_version==="svartinge-terrain-source-metadata/v0.1"&&terrain.entity_type==="TerrainSourceMetadataReceiptSet"&&terrain.subject==="SVÄRTINGE 54:28","terrain metadata identity drift");
  const item=terrain.source_item??{};
  exactKeys(item,["authority","collection","item_id","item_url","data_asset_url","data_asset_size_bytes","data_asset_multihash","projected_bbox","wgs84_bbox","compound_crs","horizontal_crs","vertical_datum","grid_resolution_m","nodata","grid_shape","updated_at","data_modified_at"],"terrain source item",check);
  check(item.authority==="Lantmäteriet"&&item.collection==="dtm-cog"&&item.item_id==="650_55","terrain source item changed");
  check(item.compound_crs==="EPSG:5845"&&item.horizontal_crs==="EPSG:3006"&&item.vertical_datum==="RH2000"&&item.grid_resolution_m===1,"terrain CRS, datum or resolution drift");
  check(JSON.stringify(item.projected_bbox)===JSON.stringify([550000,6500000,560000,6510000])&&JSON.stringify(item.grid_shape)===JSON.stringify([10000,10000])&&item.nodata===-9999,"terrain grid metadata drift");
  check(item.data_asset_size_bytes===246140605&&item.data_asset_multihash==="1220789c7144922ab546ff8c149f8f82fb6a144fb751b2ff599abb8e96a9f5e56de2","terrain raster identity drift");
  const receipts=terrain.public_metadata_receipts??[],receiptIds=new Set();check(receipts.length===4,"terrain public metadata receipt set incomplete");
  for(const receipt of receipts){exactKeys(receipt,["receipt_id","source_url","runtime_locator","retrieved_at","byte_count","sha256","content_persisted_in_repository"],receipt.receipt_id??"terrain receipt",check);check(Boolean(receipt.receipt_id&&!receiptIds.has(receipt.receipt_id)),`${receipt.receipt_id||"terrain receipt"}: duplicate receipt`);receiptIds.add(receipt.receipt_id);check(/^https:\/\//.test(receipt.source_url??"")&&/^\.runtime\//.test(receipt.runtime_locator??""),`${receipt.receipt_id}: invalid source or runtime locator`);check(/^[a-f0-9]{64}$/.test(receipt.sha256??"")&&receipt.content_persisted_in_repository===false,`${receipt.receipt_id}: invalid hash or repository persistence`);const runtimePath=path.join(repoRoot,receipt.runtime_locator);if(fs.existsSync(runtimePath)){check(fs.statSync(runtimePath).size===receipt.byte_count,`${receipt.receipt_id}: runtime byte count mismatch`);check(shaAt(repoRoot,receipt.runtime_locator)===receipt.sha256,`${receipt.receipt_id}: runtime hash mismatch`);}}
  const expectedReceiptHashes={RCPT_SE_LM_TERRAIN_STAC_ITEM_650_55:"c8c99c78dd1db2915bb3abd3e56a91013724807a1015f2fb105bfecc15eba94a",RCPT_SE_LM_TERRAIN_INFO_650_55:"5a8aeebac1df53e4295eb5a6ec9dcd6c74d6e2854d36a640bfc2f2db2a685366",RCPT_SE_LM_TERRAIN_PROVENANCE_650_55:"c0c8a44a7088146a4a25c11531ffb47309f53d7dfea7123ad12a6897a55488ea",RCPT_SE_LM_TERRAIN_THUMBNAIL_650_55:"804ef951331d98912ec10f1eccbfa004d18cfdbac395848d4c8e68a9dea38edd"};
  check(Object.entries(expectedReceiptHashes).every(([id,hash])=>receipts.find(receipt=>receipt.receipt_id===id)?.sha256===hash),"terrain receipt identity drift");
  const projection=terrain.locator_projection??{};exactKeys(projection,["source_coordinate_wgs84","projected_coordinate_epsg3006","method","control_example_input_lat_lon","control_example_expected_northing_easting","control_error_m","scope"],"terrain locator projection",check);
  check(Math.abs(projection.projected_coordinate_epsg3006?.[0]-559868.9999)<.001&&Math.abs(projection.projected_coordinate_epsg3006?.[1]-6501790.311)<.001,"terrain locator projection drift");
  check(projection.control_error_m<.002&&projection.scope==="Municipal address locator transformation, not survey control","terrain projection control or scope invalid");
  const sourceAtPlot=terrain.source_at_plot??{};exactKeys(sourceAtPlot,["provenance_feature_id","measurement_date","measurement_method","producer","reported_horizontal_uncertainty_m","reported_vertical_uncertainty_m","selection_method","verification_state"],"terrain source at plot",check);
  check(sourceAtPlot.provenance_feature_id==="0"&&sourceAtPlot.measurement_date==="2020-11-20"&&sourceAtPlot.measurement_method==="Luftburen laserskanning","terrain plot-area provenance drift");
  check(sourceAtPlot.reported_horizontal_uncertainty_m===.3&&sourceAtPlot.reported_vertical_uncertainty_m===.1&&sourceAtPlot.verification_state==="OFFICIAL_METADATA_VERIFIED_RASTER_NOT_ACQUIRED","terrain source uncertainty or verification state drift");
  const access=terrain.raster_access??{};exactKeys(access,["state","last_checked_at","http_status_without_credentials","raster_bytes_acquired","terrain_values_available","runtime_credential_persisted"],"terrain raster access",check);
  check(access.state==="KEY_REQUIRED"&&access.http_status_without_credentials===401&&access.raster_bytes_acquired===false&&access.terrain_values_available===false&&access.runtime_credential_persisted===false,"terrain raster access falsely promoted");
  const alternative=terrain.municipal_alternative??{};exactKeys(alternative,["authority","product","document_url","document_date","reported_products","reported_vertical_accuracy_m","exact_plot_coverage","minimum_fee_sek","state"],"municipal terrain alternative",check);
  check(alternative.authority==="Norrköpings kommun"&&alternative.reported_vertical_accuracy_m===.05&&alternative.exact_plot_coverage==="UNKNOWN_REQUIRES_MUNICIPAL_CONFIRMATION"&&alternative.minimum_fee_sek===500&&alternative.state==="DOCUMENTED_NOT_CONNECTED","municipal terrain alternative promoted or changed");
  const gate=terrain.terrain_gate??{};exactKeys(gate,["gate_id","status","reason","forbidden_outputs_until_closed"],"terrain gate",check);
  check(gate.gate_id==="GATE_SE_TERRAIN"&&gate.status==="OPEN"&&gate.forbidden_outputs_until_closed?.length>=5,"terrain gate closed or weakened without raster");
  check(!/(api[_-]?key|access[_-]?token|password|connection[_-]?string|client[_-]?secret)\s*[\":=]+\s*[\"']?(?!required|false|null)/i.test(JSON.stringify(terrain)),"terrain metadata contains a possible credential payload");
  return {ok:errors.length===0,assertions,errors};
}

export function validateSvartingePrototype(scene,{checkFiles=true,repoRoot=root}={}){
  const errors=[];let assertions=0;const check=(ok,msg)=>{assertions++;if(!ok)errors.push(msg);};
  exactKeys(scene,["scene_version","entity_type","scene_id","generated_at","subject","coordinate_system","source_bindings","evidence_classes","measurements","legal_claim_policy","navigation","elements","studies","prototype","project_status"],"scene",check);
  check(scene.scene_version==="svartinge-neighbourhood-scene/v0.2","scene version drift");
  check(scene.subject?.working_property_identity==="SVÄRTINGE 54:28","working identity drift");
  check(scene.subject?.identity_scope==="MUNICIPAL_ADDRESS_TO_PROPERTY_OBSERVATION_NOT_PROPERTY_REGISTER","identity scope promoted");
  check(JSON.stringify(scene.evidence_classes)===JSON.stringify(CLASSES),"evidence class vocabulary drift");
  check(scene.coordinate_system?.frame==="LOCAL_ENU"&&scene.coordinate_system?.linear_units==="metre","coordinate frame or units invalid");
  check(JSON.stringify(scene.coordinate_system?.axes)===JSON.stringify({x:"EAST",y:"UP",z:"NORTH"}),"local axis convention missing or changed");
  check(scene.coordinate_system?.vertical_reference==="LOCAL_RELATIVE_UNCALIBRATED","vertical reference promoted");
  check(scene.coordinate_system?.evidence_class==="AUTHORITATIVE","coordinate evidence class drift");
  check(scene.measurements?.municipal_map_area_m2?.evidence_class==="INDICATIVE","municipal area over-promoted");
  check(Math.abs(scene.measurements?.municipal_map_area_m2?.value-1938.1988442902577)<1e-6,"municipal area drift");
  check(scene.measurements?.listing_area_m2?.value===1939&&scene.measurements?.listing_area_m2?.evidence_class==="REPORTED_UNVERIFIED","listing area state drift");
  check(Math.abs(scene.measurements?.derived_trace_area_m2?.value-1938.199)<=.01&&scene.measurements?.derived_trace_area_m2?.evidence_class==="DERIVED","derived trace area invalid");
  check(scene.legal_claim_policy?.visualisation_allowed===true&&scene.legal_claim_policy?.concept_design_allowed===true&&scene.legal_claim_policy?.sun_view_navigation_allowed===true,"concept capability incorrectly blocked");
  for(const claim of BLOCKED)check(scene.legal_claim_policy?.blocked_claims?.includes(claim),`missing blocked legal claim ${claim}`);
  check(JSON.stringify(scene.navigation?.map(x=>x.id))===JSON.stringify(STEPS),"navigation progression incomplete or reordered");
  check(scene.navigation?.every(x=>x.camera?.length===3&&x.target?.length===3&&x.visible_groups?.length&&typeof x.cutaway==="boolean"),"navigation camera contract invalid");
  check(scene.navigation?.every(step=>{const expected=deriveLiveContextView({originWgs84:scene.coordinate_system.origin_wgs84,camera:step.camera,target:step.target,zoom:step.live_context_view?.zoom});return JSON.stringify(step.live_context_view)===JSON.stringify(expected);}),"live context camera is not deterministically synchronized to the Twin stage");
  check(scene.navigation?.every(step=>step.live_context_view?.evidence_effect==="NONE"&&step.live_context_view?.synchronization==="LOCAL_EAST_UP_NORTH_STAGE_REFERENCE"),"live context view promoted evidence or lost synchronization scope");
  check(scene.navigation?.find(x=>x.id==="ENTER_BUILDING")?.cutaway===true&&scene.navigation?.find(x=>x.id==="ROOM")?.cutaway===true,"interior cutaway missing");
  const elements=scene.elements??[],ids=new Set();check(elements.length>=30,"scene is not materially populated");
  for(const el of elements){
    check(Boolean(el.id&&!ids.has(el.id)),`${el.id||"element"}: missing or duplicate id`);ids.add(el.id);
    check(CLASSES.includes(el.evidence_class),`${el.id}: invalid or missing evidence class`);
    check(Boolean(el.geometry?.primitive),`${el.id}: geometry primitive missing`);
    check(Array.isArray(el.source_refs)&&el.source_refs.length>0,`${el.id}: source refs missing`);
    check(Array.isArray(el.limitations)&&el.limitations.length>0,`${el.id}: limitations missing`);
  }
  for(const state of CLASSES)check(elements.some(x=>x.evidence_class===state),`no scene element exercises ${state}`);
  const plot=elements.find(x=>x.id==="PLOT_54_28");check(plot?.evidence_class==="INDICATIVE"&&plot?.geometry?.primitive==="EXTRUDED_POLYGON","plot representation invalid");
  check(Math.abs(polygonArea(plot?.geometry?.points_xz??[])-1938.1988442902577)<.05,"plot trace does not reproduce municipal map area");
  check(plot?.limitations?.some(x=>x.includes("no legal effect")),"plot legal limitation missing");
  const terrain=elements.find(x=>x.id==="TERRAIN_CONTEXT");check(terrain?.evidence_class==="DERIVED"&&terrain?.geometry?.height_reference==="LOCAL_RELATIVE_UNCALIBRATED","terrain promoted or unlabelled");
  check(elements.filter(x=>x.type==="CONTEXT_BUILDING").length>=10&&elements.filter(x=>x.type==="CONTEXT_BUILDING").every(x=>x.evidence_class==="DERIVED"),"derived context massing incomplete or promoted");
  check(elements.filter(x=>x.type==="ROAD").length>=2&&elements.filter(x=>x.type==="ROAD").every(x=>x.evidence_class==="DERIVED"),"derived road context incomplete or promoted");
  check(elements.filter(x=>["CONCEPT_BUILDING","ROOM","OPENING","FURNITURE"].includes(x.type)).length>=10&&elements.filter(x=>["CONCEPT_BUILDING","ROOM","OPENING","FURNITURE"].includes(x.type)).every(x=>x.evidence_class==="CONCEPT"),"concept building/room geometry missing or promoted");
  check(elements.find(x=>x.id==="VIEW_GLAN")?.evidence_class==="REPORTED_UNVERIFIED","reported view promoted");
  const pois=elements.filter(x=>x.type==="POI");check(pois.length>=6,"POI layer incomplete");check(pois.every(x=>x.evidence_class==="INDICATIVE"&&x.geometry?.placement_method==="DIAGRAMMATIC_NOT_GEOGRAPHIC"&&x.geometry?.distance_m===null),"POI position promoted or coordinate/distance invented");
  check(scene.studies?.solar?.evidence_class==="DERIVED"&&scene.studies?.views?.evidence_class==="REPORTED_UNVERIFIED","study evidence class invalid");
  check(scene.project_status?.design_scenario==="CONCEPT_VISUALISATION_ACTIVE_LEGAL_GATES_OPEN"&&scene.project_status?.selected_house_profile===null,"concept scenario status promoted");
  walk(scene).forEach(e=>errors.push(e));
  if(checkFiles){
    check(fs.existsSync(path.join(repoRoot,schemaPath)),"scene schema missing");
    check(fs.existsSync(path.join(repoRoot,providerPath)),"context provider registry missing");
    check(fs.existsSync(path.join(repoRoot,providerSchemaPath)),"context provider schema missing");
    check(fs.existsSync(path.join(repoRoot,streetPath)),"street context observations missing");
    check(fs.existsSync(path.join(repoRoot,streetSchemaPath)),"street context schema missing");
    check(fs.existsSync(path.join(repoRoot,terrainMetadataPath)),"terrain source metadata missing");
    check(fs.existsSync(path.join(repoRoot,terrainMetadataSchemaPath)),"terrain source metadata schema missing");
    check(fs.existsSync(path.join(repoRoot,officialGeometryPath)),"official context geometry source receipts missing");
    check(fs.existsSync(path.join(repoRoot,officialGeometrySchemaPath)),"official context geometry source schema missing");
    check(fs.existsSync(path.join(repoRoot,aerialHistoryPath)),"municipal aerial history missing");
    check(fs.existsSync(path.join(repoRoot,aerialHistorySchemaPath)),"municipal aerial history schema missing");
    check(fs.existsSync(path.join(repoRoot,visualReconstructionPath)),"visual reconstruction manifest missing");
    check(fs.existsSync(path.join(repoRoot,visualReconstructionSchemaPath)),"visual reconstruction schema missing");
    check(fs.existsSync(path.join(repoRoot,viewerPath)),"viewable prototype missing");
    check(fs.existsSync(path.join(repoRoot,liveAdapterPath)),"live context adapter missing");
    if(fs.existsSync(path.join(repoRoot,viewerPath))){const html=fs.readFileSync(path.join(repoRoot,viewerPath),"utf8");check(html.includes("neighbourhood-scene-v0.2.json")&&html.includes("OrbitControls")&&html.includes("CONCEPT MODE · LEGAL GATES OPEN"),"viewer is not bound to the scene/evidence UI");check(html.includes("INTELLIGENCE")&&html.includes("REALISTIC")&&html.includes("COMPARE")&&html.includes("renderPass")&&html.includes("context-providers-v0.1.json"),"synchronized renderer modes or provider interface missing");check(html.includes("street-context-v0.1.json")&&html.includes("street_room_high_detail")&&html.includes("buildExactListingCharacter")&&html.includes("Exact-address listing character"),"Street Room rendering or source disclosure missing");check(html.includes("addStreetDetail")&&html.includes("addHouseDetails")&&html.includes("addExactPlotWorkingCharacter")&&html.includes("proceduralTexture"),"higher-fidelity Street Room character layer is incomplete");check(html.includes("continuousRibbonGeometry")&&html.includes("gableRoofGeometry")&&!html.includes("new THREE.BoxGeometry(g.width_m,.12,length)"),"continuous roads or gable context buildings regressed");check(html.includes("edge.userData.intelligenceOnly=true")&&html.includes("item.type==='PLOT'?.18:1")===false,"plot evidence outline leaked into realistic profile");check(html.includes("streetArrivalTexture")&&html.includes("['STREET_VIEW','PLOT_ORBIT'].includes(stage.id)")&&html.includes("VISUAL RECONSTRUCTION · NOT A SURVEY OR CURRENT PHOTOGRAPH"),"main realistic stage is not bound to the labelled reconstruction profile");check(html.includes("realismDecor.visible=realistic")&&html.includes("stageLabelsAllowed"),"visual-only street character or close-view label isolation is missing");check(html.includes("applyStageVisibility")&&html.includes("visible_groups"),"navigation stages do not enforce their geometry visibility contract");check(html.includes("One geometry graph")&&html.includes("Realism changes presentation—not evidence"),"one-Twin evidence separation missing");check(html.includes("terrain-source-metadata-v0.1.json")&&html.includes("createMapboxRuntimeAdapter")&&html.includes("syncLiveStage")&&html.includes("LIVE VISUAL CONTEXT · NO EVIDENCE EFFECT"),"live context or official terrain disclosure is not mounted");check(html.includes("official-context-geometry-sources-v0.1.json")&&html.includes("Exact official geometry packages")&&html.includes("protected geometry bytes are absent"),"official geometry source disclosure is not mounted");check(html.includes("municipal-aerial-history-v0.1.json")&&html.includes("Aerial history")&&html.includes("LIVE MUNICIPAL WMS · NO PIXELS STORED"),"live municipal aerial history is not mounted");check(html.includes("visual-reconstruction-v0.1.json")&&html.includes("Realistic view")&&html.includes("NOT A SURVEY OR CURRENT PHOTOGRAPH")&&html.includes("mountVisualReconstruction"),"visual reconstruction is not safely mounted");check(html.includes("v3.25.0")&&html.includes("Disconnect & forget")&&html.includes("TOKEN STAYS IN THIS PAGE MEMORY ONLY"),"credential-safe live provider controls are incomplete");check(!/(localStorage|sessionStorage|document\.cookie|URLSearchParams)/.test(html),"viewer persists or transports runtime credentials unsafely");for(const step of STEPS)check(scene.navigation.some(x=>x.id===step),`viewer step source missing ${step}`);}
    if(fs.existsSync(path.join(repoRoot,viewerPath))){const html=fs.readFileSync(path.join(repoRoot,viewerPath),"utf8");check(html.includes("reconstructionTextureByStage")&&html.includes("street-approach-existing-condition-v0.1.png")&&html.includes("plot-outlook-existing-condition-v0.1.png"),"distinct realistic stage viewpoints are missing");check(html.includes("b.disabled=locked")&&html.includes("i>=4")&&html.includes("selected_house_profile===null"),"unselected building and room stages are not hard locked");check(html.includes("visualViews")&&html.includes("setVisualRendering")&&html.includes("reconstructionViewpointByStage"),"four-view reconstruction gallery is not stage synchronized");check(!html.includes("new THREE.WireframeGeometry"),"moire-producing analytical terrain wire returned");check(html.includes("mountMunicipalAerialDrape")&&html.includes("/runtime/norrkoping-aerial")&&html.includes("NAVIGABLE 3D")&&html.includes("LIVE AERIAL-GROUNDED"),"main Realistic profile is not a navigable aerial-grounded spatial scene");check(!html.includes("scene.background=backplate")&&!html.includes("o.visible=!backplate"),"static reconstruction backplate replaced navigable spatial geometry");}
    if(fs.existsSync(path.join(repoRoot,serverPath))){const server=fs.readFileSync(path.join(repoRoot,serverPath),"utf8");check(server.includes('/runtime/norrkoping-aerial')&&server.includes('kartdata.norrkoping.se/wms')&&server.includes('"cache-control":"no-store"'),"live municipal aerial proxy is missing or cache policy weakened");check(server.includes('"x-evidence-effect":"NONE"')&&server.includes('"x-pixel-persistence":"MEMORY_ONLY"')&&!/writeFile|createWriteStream/.test(server),"live aerial proxy can persist pixels or affect evidence");}
    for(const binding of scene.source_bindings.filter(x=>x.sha256!=="RUNTIME_ONLY_NOT_COMMITTED")){check(fs.existsSync(path.join(repoRoot,binding.path)),`source binding missing ${binding.path}`);if(fs.existsSync(path.join(repoRoot,binding.path)))check(shaAt(repoRoot,binding.path)===binding.sha256,`source binding hash mismatch ${binding.path}`);}
    const schema=read(schemaPath,repoRoot);check(schema.additionalProperties===false&&schema.properties?.scene_version?.const==="svartinge-neighbourhood-scene/v0.2","strict versioned schema missing");
    if(fs.existsSync(path.join(repoRoot,providerPath))){const providerResult=validateContextProviders(read(providerPath,repoRoot));assertions+=providerResult.assertions;errors.push(...providerResult.errors);}
    if(fs.existsSync(path.join(repoRoot,providerSchemaPath))){const providerSchema=read(providerSchemaPath,repoRoot);check(providerSchema.additionalProperties===false&&providerSchema.properties?.schema_version?.const==="svartinge-context-providers/v0.1","strict provider schema missing");}
    if(fs.existsSync(path.join(repoRoot,streetPath))){const streetResult=validateStreetContext(read(streetPath,repoRoot));assertions+=streetResult.assertions;errors.push(...streetResult.errors);}
    if(fs.existsSync(path.join(repoRoot,streetSchemaPath))){const streetSchema=read(streetSchemaPath,repoRoot);check(streetSchema.additionalProperties===false&&streetSchema.properties?.schema_version?.const==="svartinge-street-context/v0.1","strict street context schema missing");}
    if(fs.existsSync(path.join(repoRoot,terrainMetadataPath))){const terrainResult=validateTerrainSourceMetadata(read(terrainMetadataPath,repoRoot),{repoRoot});assertions+=terrainResult.assertions;errors.push(...terrainResult.errors);}
    if(fs.existsSync(path.join(repoRoot,terrainMetadataSchemaPath))){const terrainSchema=read(terrainMetadataSchemaPath,repoRoot);check(terrainSchema.additionalProperties===false&&terrainSchema.properties?.schema_version?.const==="svartinge-terrain-source-metadata/v0.1","strict terrain metadata schema missing");}
    if(fs.existsSync(path.join(repoRoot,officialGeometryPath))){const geometryResult=validateOfficialContextGeometrySources(read(officialGeometryPath,repoRoot),{repoRoot});assertions+=geometryResult.assertions;errors.push(...geometryResult.errors);}
    if(fs.existsSync(path.join(repoRoot,officialGeometrySchemaPath))){const geometrySchema=read(officialGeometrySchemaPath,repoRoot);check(geometrySchema.additionalProperties===false&&geometrySchema.properties?.schema_version?.const==="svartinge-official-context-geometry-sources/v0.1","strict official geometry source schema missing");}
    if(fs.existsSync(path.join(repoRoot,aerialHistoryPath))){const historyResult=validateMunicipalAerialHistory(read(aerialHistoryPath,repoRoot),{repoRoot});assertions+=historyResult.assertions;errors.push(...historyResult.errors);}
    if(fs.existsSync(path.join(repoRoot,aerialHistorySchemaPath))){const historySchema=read(aerialHistorySchemaPath,repoRoot);check(historySchema.additionalProperties===false&&historySchema.properties?.schema_version?.const==="svartinge-municipal-aerial-history/v0.1","strict municipal aerial history schema missing");}
    if(fs.existsSync(path.join(repoRoot,visualReconstructionPath))){const visualResult=validateVisualReconstruction(read(visualReconstructionPath,repoRoot),{repoRoot});assertions+=visualResult.assertions;errors.push(...visualResult.errors);}
    if(fs.existsSync(path.join(repoRoot,visualReconstructionSchemaPath))){const visualSchema=read(visualReconstructionSchemaPath,repoRoot);check(visualSchema.additionalProperties===false&&visualSchema.properties?.schema_version?.const==="svartinge-visual-reconstruction/v0.1","strict visual reconstruction schema missing");}
    if(fs.existsSync(path.join(repoRoot,liveAdapterPath))){const adapter=fs.readFileSync(path.join(repoRoot,liveAdapterPath),"utf8");check(adapter.includes("EXPLICIT_RUNTIME_CONFIG_ONLY")&&adapter.includes("LIVE_ONLY_NO_PERSISTENCE")&&adapter.includes("evidence_promotion_allowed: false")&&adapter.includes("runtime_token_cleared_on_destroy: true"),"live adapter safety contract weakened");check(adapter.includes("syncStage")&&adapter.includes("LOCAL_EAST_UP_NORTH_STAGE_REFERENCE")&&adapter.includes('evidence_effect !== "NONE"'),"stage synchronization could promote or drift live context");check(!/(localStorage|sessionStorage|document\.cookie|URLSearchParams)/.test(adapter),"live adapter persists or transports runtime credentials unsafely");}
  }
  return {ok:errors.length===0,assertions,errors};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const result=validateSvartingePrototype(read(scenePath));
  if(!result.ok){console.error(`Svärtinge 3D prototype FAIL (${result.assertions} assertions)`);result.errors.forEach(e=>console.error(`- ${e}`));process.exitCode=1;}
  else console.log(`Svärtinge 3D prototype PASS (${result.assertions} assertions; 7 navigation stages; 5 evidence classes)`);
}
