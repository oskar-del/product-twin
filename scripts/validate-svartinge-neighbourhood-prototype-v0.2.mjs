import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const scenePath="data/sites/sweden/saterdalsvagen-14/neighbourhood-scene-v0.2.json";
const schemaPath="config/spatial/svartinge-neighbourhood-scene-v0.2.schema.json";
const viewerPath="prototype/svartinge-neighbourhood/index.html";
const CLASSES=["AUTHORITATIVE","INDICATIVE","DERIVED","REPORTED_UNVERIFIED","CONCEPT"];
const STEPS=["NEIGHBOURHOOD_VIEW","STREET_VIEW","PLOT_ORBIT","CONCEPT_HOUSE_ON_PLOT","BUILDING_ORBIT","ENTER_BUILDING","ROOM"];
const BLOCKED=["LEGAL_BOUNDARY","REGISTERED_AREA","ENTITLEMENT","BUILDABLE_ENVELOPE","LEGAL_ACCESS","UTILITY_CAPACITY","SURVEYED_TERRAIN","FINISHED_FLOOR_LEVEL"];
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
    check(fs.existsSync(path.join(repoRoot,viewerPath)),"viewable prototype missing");
    if(fs.existsSync(path.join(repoRoot,viewerPath))){const html=fs.readFileSync(path.join(repoRoot,viewerPath),"utf8");check(html.includes("neighbourhood-scene-v0.2.json")&&html.includes("OrbitControls")&&html.includes("CONCEPT MODE · LEGAL GATES OPEN"),"viewer is not bound to the scene/evidence UI");for(const step of STEPS)check(scene.navigation.some(x=>x.id===step),`viewer step source missing ${step}`);}
    for(const binding of scene.source_bindings.filter(x=>x.sha256!=="RUNTIME_ONLY_NOT_COMMITTED")){check(fs.existsSync(path.join(repoRoot,binding.path)),`source binding missing ${binding.path}`);if(fs.existsSync(path.join(repoRoot,binding.path)))check(shaAt(repoRoot,binding.path)===binding.sha256,`source binding hash mismatch ${binding.path}`);}
    const schema=read(schemaPath,repoRoot);check(schema.additionalProperties===false&&schema.properties?.scene_version?.const==="svartinge-neighbourhood-scene/v0.2","strict versioned schema missing");
  }
  return {ok:errors.length===0,assertions,errors};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const result=validateSvartingePrototype(read(scenePath));
  if(!result.ok){console.error(`Svärtinge 3D prototype FAIL (${result.assertions} assertions)`);result.errors.forEach(e=>console.error(`- ${e}`));process.exitCode=1;}
  else console.log(`Svärtinge 3D prototype PASS (${result.assertions} assertions; 7 navigation stages; 5 evidence classes)`);
}
