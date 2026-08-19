import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const manifestPath="data/sites/sweden/saterdalsvagen-14/neighbourhood-twin-alpha-v0.1.json";
const schemaPath="config/spatial/neighbourhood-twin-alpha-v0.1.schema.json";
const sha=p=>crypto.createHash("sha256").update(fs.readFileSync(path.join(root,p))).digest("hex");
const read=(p,r=root)=>JSON.parse(fs.readFileSync(path.join(r,p),"utf8"));
const STATES=new Set(["VERIFIED","INDICATIVE","REPORTED_UNVERIFIED","BLOCKED","UNKNOWN"]);
const STAGES=["REGION","NEIGHBOURHOOD","STREET","PLOT","BUILDING","UNIT","ROOM"];
const FORBIDDEN_MUNIN_KEYS=new Set(["price","owner","owners","listing","transaction","transactions","sale_price","asking_price","personal_record","valuation","comparables"]);

function recursiveForbidden(value,pathName="manifest",errors=[]){
  if(Array.isArray(value)){value.forEach((v,i)=>recursiveForbidden(v,`${pathName}[${i}]`,errors));return errors;}
  if(!value||typeof value!=="object")return errors;
  for(const [k,v] of Object.entries(value)){if(FORBIDDEN_MUNIN_KEYS.has(k.toLowerCase()))errors.push(`${pathName}.${k}: forbidden Munin payload key`);recursiveForbidden(v,`${pathName}.${k}`,errors);}return errors;
}

export function validateNeighbourhoodAlpha(manifest,{checkFiles=true,repoRoot=root}={}){
  const errors=[];let assertions=0;const check=(ok,msg)=>{assertions++;if(!ok)errors.push(msg);};
  const exactKeys=(value,keys,label)=>check(value&&typeof value==="object"&&!Array.isArray(value)&&Object.keys(value).sort().join("|")===[...keys].sort().join("|"),`${label}: unknown or missing fields`);
  exactKeys(manifest,["manifest_version","entity_type","neighbourhood_twin_id","version","subject","source_binding","coordinate_anchor","parcel_representation","terrain","context_layers","proximity_register","evidence_register","planning","hard_gates","munin_interface","interface_stages","camera_lod_contract","prototype_capabilities","evidence_summary"],"manifest");
  exactKeys(manifest.coordinate_anchor,["state","role","wgs84","municipal_query","render_frame","limitations"],"coordinate_anchor");
  exactKeys(manifest.parcel_representation,["state","geometry_path","geometry_sha256","representation","municipal_map_area_m2","registered_area_m2","legal_boundary_available","surveyed_boundary_available","render_policy","forbidden_labels","limitations"],"parcel_representation");
  exactKeys(manifest.terrain,["state","availability","asset_access","terrain_values_available","mesh_available","render_policy","blockers"],"terrain");
  exactKeys(manifest.munin_interface,["mode","references","payload_persisted","forbidden_payload_domains","state"],"munin_interface");
  check(manifest.manifest_version==="neighbourhood-twin-alpha/v0.1","manifest version drift");
  check(manifest.subject?.working_identity==="SVÄRTINGE 54:28","subject identity drift");
  check(manifest.subject?.identity_state==="VERIFIED_MUNICIPAL_LOCATOR_NOT_PROPERTY_REGISTER","identity over-promotion");
  check(manifest.coordinate_anchor?.wgs84?.crs==="EPSG:4326"&&manifest.coordinate_anchor?.municipal_query?.crs==="EPSG:3010","coordinate CRS missing or changed");
  check(manifest.coordinate_anchor?.render_frame?.vertical_datum==="UNRESOLVED_NO_TERRAIN","vertical datum invented");
  check(manifest.parcel_representation?.representation==="AREA_EQUIVALENT_DISC"&&manifest.parcel_representation?.state==="INDICATIVE","notional parcel representation changed");
  check(manifest.parcel_representation?.legal_boundary_available===false&&manifest.parcel_representation?.surveyed_boundary_available===false,"legal/survey boundary invented");
  check(manifest.parcel_representation?.render_policy==="TRANSLUCENT_UNCERTAINTY_DISC_ONLY","parcel render policy promoted");
  check(manifest.terrain?.state==="BLOCKED"&&manifest.terrain?.terrain_values_available===false&&manifest.terrain?.mesh_available===false,"terrain invented or promoted");
  check(manifest.context_layers?.find(x=>x.layer_id==="SURROUNDING_BUILDINGS")?.render_allowed===false,"surrounding buildings invented");
  check(manifest.context_layers?.find(x=>x.layer_id==="ROADS_AND_STREETS")?.render_allowed===false,"road geometry invented");
  check(JSON.stringify(manifest.interface_stages)===JSON.stringify(STAGES),"interface stage chain drift");
  check(manifest.camera_lod_contract?.length===4,"camera/LOD contract incomplete");
  check(manifest.camera_lod_contract?.at(-1)?.lod==="BLOCKED_NO_BUILDING_UNIT_ROOM_GEOMETRY","building/unit/room entry prematurely enabled");
  check(manifest.hard_gates?.length===10&&manifest.hard_gates.every(g=>g.state==="BLOCKED"&&g.reason&&g.prevents.length),"hard gate set incomplete or promoted");
  const gateIds=new Set(manifest.hard_gates.map(g=>g.gate_id));
  for(const id of ["LEGAL_BOUNDARY","TERRAIN","EXISTING_BUILDINGS","ROAD_GEOMETRY","PLANNING_AND_ENTITLEMENT","LEGAL_ACCESS","UTILITIES","FLOOD_AND_DRAINAGE","SOIL_AND_GROUNDWATER","HERITAGE_AND_ENVIRONMENT"])check(gateIds.has(id),`missing hard gate ${id}`);
  check(manifest.planning?.entitlement_state==="BLOCKED"&&manifest.planning?.strategic_context?.svartinge_2026==="CONSULTATION_DRAFT_NOT_ADOPTED","planning entitlement or draft status promoted");
  check(manifest.munin_interface?.mode==="OPAQUE_REFERENCES_ONLY"&&manifest.munin_interface?.payload_persisted===false,"Munin interface payload promotion");
  check(Array.isArray(manifest.munin_interface?.references)&&manifest.munin_interface.references.length===0,"opaque Munin reference invented or payload persisted");
  recursiveForbidden(manifest).forEach(e=>errors.push(e));
  const proximity=manifest.proximity_register??[];
  check(new Set(proximity.map(p=>p.category)).size>=7,"proximity categories incomplete");
  for(const item of proximity){exactKeys(item,["category","name","state","source_url","observation_date","distance_m","measurement_method","facts","limitations"],`proximity ${item.category}`);check(STATES.has(item.state),`${item.category}: invalid evidence state`);check(item.observation_date&&item.measurement_method&&item.source_url,`${item.category}: source/date/method missing`);check(item.distance_m===null,`${item.category}: unsupported distance invented`);}
  const register=manifest.evidence_register??[];check(register.length>=10,"evidence register incomplete");
  check([...STATES].every(state=>register.some(row=>row.state===state)),"evidence register does not exercise all five truth states");
  for(const row of register)exactKeys(row,["evidence_id","domain","state","value","source_refs","reason"],`evidence ${row.evidence_id}`);
  check(register.every(row=>row.evidence_id&&row.domain&&STATES.has(row.state)&&row.reason),"evidence register row incomplete");
  check(manifest.prototype_capabilities?.cannot_display?.includes("legal or surveyed parcel boundary"),"prototype legal-boundary prohibition missing");
  check(manifest.prototype_capabilities?.cannot_display?.includes("terrain, contours, slope or drainage"),"prototype terrain prohibition missing");
  if(checkFiles){
    const sourcePath=manifest.source_binding.path,geometryPath=manifest.parcel_representation.geometry_path;
    check(fs.existsSync(path.join(repoRoot,sourcePath)),"source binding missing");
    check(fs.existsSync(path.join(repoRoot,geometryPath)),"indicative geometry missing");
    if(fs.existsSync(path.join(repoRoot,sourcePath)))check(shaAt(repoRoot,sourcePath)===manifest.source_binding.sha256,"source binding hash mismatch");
    if(fs.existsSync(path.join(repoRoot,geometryPath))){check(shaAt(repoRoot,geometryPath)===manifest.parcel_representation.geometry_sha256,"indicative geometry hash mismatch");const geo=readAt(repoRoot,geometryPath);check(geo.features?.[1]?.properties?.geometry_role==="NOTIONAL_AREA_EQUIVALENT_DISC_NOT_PARCEL_BOUNDARY"&&geo.features?.[1]?.properties?.legal_or_survey_use===false,"indicative geometry mislabeled");}
    const schema=readAt(repoRoot,schemaPath);check(schema.additionalProperties===false&&schema.properties?.manifest_version?.const==="neighbourhood-twin-alpha/v0.1","strict versioned schema missing");
  }
  return {ok:errors.length===0,assertions,errors};
}
function shaAt(r,p){return crypto.createHash("sha256").update(fs.readFileSync(path.join(r,p))).digest("hex");}
function readAt(r,p){return JSON.parse(fs.readFileSync(path.join(r,p),"utf8"));}

if(process.argv[1]===fileURLToPath(import.meta.url)){const result=validateNeighbourhoodAlpha(read(manifestPath));if(!result.ok){console.error(`Svärtinge Neighbourhood Twin Alpha FAIL (${result.assertions} assertions)`);result.errors.forEach(e=>console.error(`- ${e}`));process.exitCode=1;}else console.log(`Svärtinge Neighbourhood Twin Alpha PASS (${result.assertions} assertions; 10 hard gates; 0 Munin payloads)`);}
