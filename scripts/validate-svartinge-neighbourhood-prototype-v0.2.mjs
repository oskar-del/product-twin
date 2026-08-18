import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const scenePath="data/sites/sweden/saterdalsvagen-14/neighbourhood-scene-v0.2.json";
const schemaPath="config/spatial/svartinge-neighbourhood-scene-v0.2.schema.json";
const providerPath="data/sites/sweden/saterdalsvagen-14/context-providers-v0.1.json";
const providerSchemaPath="config/spatial/svartinge-context-providers-v0.1.schema.json";
const streetPath="data/sites/sweden/saterdalsvagen-14/street-context-v0.1.json";
const streetSchemaPath="config/spatial/svartinge-street-context-v0.1.schema.json";
const viewerPath="prototype/svartinge-neighbourhood/index.html";
const liveAdapterPath="prototype/svartinge-neighbourhood/live-context-adapter.mjs";
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
  check(providers.filter(x=>x.state==="CONNECTED").length===1&&providers.find(x=>x.state==="CONNECTED")?.provider_id==="LOCAL_PROCEDURAL_REALISM","external provider falsely marked connected");
  check(providers.find(x=>x.provider_id==="MAPBOX_STANDARD_SATELLITE")?.state==="KEY_REQUIRED","Mapbox access state promoted");
  check(providers.find(x=>x.provider_id==="GOOGLE_STREET_VIEW")?.state==="RESEARCH_ONLY","Street View reference state promoted");
  check(providers.find(x=>x.provider_id==="GOOGLE_PHOTOREALISTIC_3D_TILES")?.state==="KEY_REQUIRED","Google 3D Tiles access state promoted");
  check(!/(api[_-]?key|access[_-]?token|password|connection[_-]?string|client[_-]?secret)\s*[\":=]+\s*[\"']?(?!required|false|null)/i.test(JSON.stringify(registry)),"provider registry contains a possible credential payload");
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

export function validateSvartingePrototype(scene,{checkFiles=true,repoRoot=root}={}){
  const errors=[];let assertions=0;const check=(ok,msg)=>{assertions++;if(!ok)errors.push(msg);};
  exactKeys(scene,["scene_version","entity_type","scene_id","generated_at","subject","coordinate_system","source_bindings","evidence_classes","measurements","legal_claim_policy","navigation","elements","studies","prototype","project_status"],"scene",check);
  check(scene.scene_version==="svartinge-neighbourhood-scene/v0.2","scene version drift");
  check(scene.subject?.working_property_identity==="SVÄRTINGE 54:28","working identity drift");
  check(scene.subject?.identity_scope==="MUNICIPAL_ADDRESS_TO_PROPERTY_OBSERVATION_NOT_PROPERTY_REGISTER","identity scope promoted");
  check(JSON.stringify(scene.evidence_classes)===JSON.stringify(CLASSES),"evidence class vocabulary drift");
  check(scene.coordinate_system?.frame==="LOCAL_ENU"&&scene.coordinate_system?.linear_units==="metre","coordinate frame or units invalid");
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
    check(fs.existsSync(path.join(repoRoot,viewerPath)),"viewable prototype missing");
    check(fs.existsSync(path.join(repoRoot,liveAdapterPath)),"live context adapter missing");
    if(fs.existsSync(path.join(repoRoot,viewerPath))){const html=fs.readFileSync(path.join(repoRoot,viewerPath),"utf8");check(html.includes("neighbourhood-scene-v0.2.json")&&html.includes("OrbitControls")&&html.includes("CONCEPT MODE · LEGAL GATES OPEN"),"viewer is not bound to the scene/evidence UI");check(html.includes("INTELLIGENCE")&&html.includes("REALISTIC")&&html.includes("COMPARE")&&html.includes("renderPass")&&html.includes("context-providers-v0.1.json"),"synchronized renderer modes or provider interface missing");check(html.includes("street-context-v0.1.json")&&html.includes("street_room_high_detail")&&html.includes("buildExactListingCharacter")&&html.includes("Exact-address listing character"),"Street Room rendering or source disclosure missing");check(html.includes("applyStageVisibility")&&html.includes("visible_groups"),"navigation stages do not enforce their geometry visibility contract");check(html.includes("One geometry graph")&&html.includes("Realism changes presentation—not evidence"),"one-Twin evidence separation missing");for(const step of STEPS)check(scene.navigation.some(x=>x.id===step),`viewer step source missing ${step}`);}
    for(const binding of scene.source_bindings.filter(x=>x.sha256!=="RUNTIME_ONLY_NOT_COMMITTED")){check(fs.existsSync(path.join(repoRoot,binding.path)),`source binding missing ${binding.path}`);if(fs.existsSync(path.join(repoRoot,binding.path)))check(shaAt(repoRoot,binding.path)===binding.sha256,`source binding hash mismatch ${binding.path}`);}
    const schema=read(schemaPath,repoRoot);check(schema.additionalProperties===false&&schema.properties?.scene_version?.const==="svartinge-neighbourhood-scene/v0.2","strict versioned schema missing");
    if(fs.existsSync(path.join(repoRoot,providerPath))){const providerResult=validateContextProviders(read(providerPath,repoRoot));assertions+=providerResult.assertions;errors.push(...providerResult.errors);}
    if(fs.existsSync(path.join(repoRoot,providerSchemaPath))){const providerSchema=read(providerSchemaPath,repoRoot);check(providerSchema.additionalProperties===false&&providerSchema.properties?.schema_version?.const==="svartinge-context-providers/v0.1","strict provider schema missing");}
    if(fs.existsSync(path.join(repoRoot,streetPath))){const streetResult=validateStreetContext(read(streetPath,repoRoot));assertions+=streetResult.assertions;errors.push(...streetResult.errors);}
    if(fs.existsSync(path.join(repoRoot,streetSchemaPath))){const streetSchema=read(streetSchemaPath,repoRoot);check(streetSchema.additionalProperties===false&&streetSchema.properties?.schema_version?.const==="svartinge-street-context/v0.1","strict street context schema missing");}
    if(fs.existsSync(path.join(repoRoot,liveAdapterPath))){const adapter=fs.readFileSync(path.join(repoRoot,liveAdapterPath),"utf8");check(adapter.includes("EXPLICIT_RUNTIME_CONFIG_ONLY")&&adapter.includes("LIVE_ONLY_NO_PERSISTENCE")&&adapter.includes("evidence_promotion_allowed: false"),"live adapter safety contract weakened");check(!/(localStorage|sessionStorage|document\.cookie|URLSearchParams)/.test(adapter),"live adapter persists or transports runtime credentials unsafely");}
  }
  return {ok:errors.length===0,assertions,errors};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const result=validateSvartingePrototype(read(scenePath));
  if(!result.ok){console.error(`Svärtinge 3D prototype FAIL (${result.assertions} assertions)`);result.errors.forEach(e=>console.error(`- ${e}`));process.exitCode=1;}
  else console.log(`Svärtinge 3D prototype PASS (${result.assertions} assertions; 7 navigation stages; 5 evidence classes)`);
}
