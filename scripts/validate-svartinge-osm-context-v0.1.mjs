import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const manifestPath="data/sites/sweden/saterdalsvagen-14/osm-context-v0.1.json";
const schemaPath="config/spatial/svartinge-osm-context-v0.1.schema.json";
const sha=value=>crypto.createHash("sha256").update(value).digest("hex");
const exactKeys=(value,keys,label,check)=>check(value&&JSON.stringify(Object.keys(value).sort())===JSON.stringify([...keys].sort()),`${label}: unknown or missing fields`);
const pointInside=([x,z])=>Number.isFinite(x)&&Number.isFinite(z)&&x>=-900.01&&x<=900.01&&z>=-900.01&&z<=900.01;

export function validateOsmContext(manifest,{repoRoot=root,requireRuntime=false}={}){
  const errors=[];let assertions=0;const check=(condition,message)=>{assertions++;if(!condition)errors.push(message);};
  exactKeys(manifest,["schema_version","entity_type","context_id","subject","source","transform","statistics","compiled","derived_content_sha256","evidence_policy"],"manifest",check);
  check(manifest.schema_version==="svartinge-osm-context/v0.1"&&manifest.entity_type==="SourceBoundNeighbourhoodContext"&&manifest.context_id==="SE_SVARTINGE_54_28_OSM_900M_V01","context identity drift");
  const subject=manifest.subject??{};exactKeys(subject,["working_property_identity","origin_wgs84","context_radius_m","stitching_halo_m","selection_radius_m"],"subject",check);
  check(subject.working_property_identity==="SVÄRTINGE 54:28"&&JSON.stringify(subject.origin_wgs84)===JSON.stringify([16.0317063331,58.6522414431]),"subject locator drift");
  check(subject.context_radius_m===800&&subject.stitching_halo_m===100&&subject.selection_radius_m===900,"area-cell radius or halo drift");
  const source=manifest.source??{};exactKeys(source,["provider","service","endpoint","state","official_source","canonical_query","retrieved_at","osm_base_timestamp","license","attribution","copyright_url","raw_runtime_locator","raw_byte_count","raw_sha256","credentials_required","credentials_persisted"],"source",check);
  check(source.provider==="OpenStreetMap contributors"&&source.service==="Overpass API"&&source.state==="CONNECTED_SOURCE_SNAPSHOT"&&source.official_source===false,"source identity promoted or changed");
  check(source.license==="ODbL-1.0"&&source.attribution==="© OpenStreetMap contributors"&&source.copyright_url==="https://www.openstreetmap.org/copyright","ODbL attribution contract missing");
  check(/^https:\/\/overpass-api\.de\//.test(source.endpoint??"")&&/way\(around:900/.test(source.canonical_query??"")&&source.canonical_query.includes("[building]")&&source.canonical_query.includes("[highway]"),"canonical source request incomplete");
  check(/^2026-08-24T19:17:52Z$/.test(source.retrieved_at??"")&&/^2026-08-24T19:16:36Z$/.test(source.osm_base_timestamp??""),"source observation timestamps drift");
  check(source.credentials_required===false&&source.credentials_persisted===false&&/^\.runtime\//.test(source.raw_runtime_locator??"")&&Number.isInteger(source.raw_byte_count)&&source.raw_byte_count>0&&/^[a-f0-9]{64}$/.test(source.raw_sha256??""),"runtime receipt invalid or credential state changed");
  const rawFile=path.join(repoRoot,source.raw_runtime_locator??"");
  if(requireRuntime){check(fs.existsSync(rawFile),"runtime OpenStreetMap source is required but absent");if(fs.existsSync(rawFile)){const bytes=fs.readFileSync(rawFile);check(bytes.length===source.raw_byte_count,"runtime OpenStreetMap byte count mismatch");check(sha(bytes)===source.raw_sha256,"runtime OpenStreetMap hash mismatch");}}
  const transform=manifest.transform??{};exactKeys(transform,["frame","method","linear_units","clip_bounds_xz_m","precision_m","limitations"],"transform",check);
  check(transform.frame==="LOCAL_EAST_NORTH"&&transform.method==="WGS84_LOCAL_EQUIRECTANGULAR_AROUND_MUNICIPAL_LOCATOR"&&transform.linear_units==="metre"&&JSON.stringify(transform.clip_bounds_xz_m)===JSON.stringify([-900,-900,900,900])&&transform.precision_m===0.01,"local transform contract drift");
  check(Array.isArray(transform.limitations)&&transform.limitations.length===3&&transform.limitations.some(value=>/not survey control/i.test(value))&&transform.limitations.some(value=>/not official/i.test(value)),"transform limitations incomplete");
  const compiled=manifest.compiled??{};exactKeys(compiled,["roads","buildings","landcover","water","waterways"],"compiled context",check);
  const roads=compiled.roads??[],buildings=compiled.buildings??[],landcover=compiled.landcover??[],water=compiled.water??[],waterways=compiled.waterways??[];
  const all=[...roads,...buildings,...landcover,...water,...waterways],ids=all.map(item=>item.feature_id);
  check(new Set(ids).size===ids.length&&ids.every(Boolean),"compiled feature IDs missing or duplicated");
  check(roads.length>=100&&roads.every(road=>road.feature_id===`OSM_ROAD_${road.osm_way_id}_${road.feature_id.split("_").at(-1)}`&&road.points_xz?.length>=2&&road.points_xz.every(pointInside)&&road.display_width_m>0&&["OSM_WIDTH_TAG","DISPLAY_WIDTH_FROM_HIGHWAY_CLASS_NOT_MEASURED"].includes(road.width_method)),"source-bound road context incomplete or outside clip");
  const named=[...new Set(roads.map(road=>road.name).filter(Boolean).map(name=>name.toLocaleLowerCase("sv-SE")))].sort((a,b)=>a.localeCompare(b,"sv-SE"));
  check(named.length>=10&&named.includes("säterdalsvägen")&&named.includes("gamla landsvägen"),"ten-street recognizable context gate not met");
  check(buildings.length>=500&&buildings.every(building=>building.feature_id===`OSM_BUILDING_${building.osm_way_id}`&&building.points_xz?.length>=3&&building.points_xz.every(point=>Number.isFinite(point[0])&&Number.isFinite(point[1]))&&building.source_height_m===null&&building.source_levels===null&&building.display_height_m>0&&building.height_method==="DETERMINISTIC_PRESENTATION_ONLY_NO_OSM_HEIGHT_OR_LEVEL_TAG"),"building footprints or presentation-height separation invalid");
  check(landcover.every(item=>item.points_xz?.length>=3&&item.points_xz.every(pointInside))&&water.every(item=>item.points_xz?.length>=3&&item.points_xz.every(pointInside))&&waterways.every(item=>item.points_xz?.length>=2&&item.points_xz.every(pointInside)),"land/water context incomplete or outside clip");
  const stats=manifest.statistics??{};exactKeys(stats,["raw_element_count","road_segment_count","named_street_count","named_streets","building_footprint_count","landcover_polygon_count","water_polygon_count","waterway_segment_count"],"statistics",check);
  check(stats.raw_element_count===934&&stats.road_segment_count===roads.length&&stats.named_street_count===named.length&&JSON.stringify(stats.named_streets)===JSON.stringify(named),"road or named-street statistics mismatch");
  check(stats.building_footprint_count===buildings.length&&stats.landcover_polygon_count===landcover.length&&stats.water_polygon_count===water.length&&stats.waterway_segment_count===waterways.length,"feature statistics mismatch");
  check(manifest.derived_content_sha256===sha(Buffer.from(JSON.stringify(compiled))),"derived context content hash mismatch");
  const policy=manifest.evidence_policy??{};exactKeys(policy,["evidence_class","legal_effect","official_geometry_gates_closed","market_data_included","personal_data_included","required_attribution_visible","forbidden_claims"],"evidence policy",check);
  check(policy.evidence_class==="DERIVED"&&policy.legal_effect==="NONE"&&policy.official_geometry_gates_closed===false&&policy.market_data_included===false&&policy.personal_data_included===false&&policy.required_attribution_visible===true,"OpenStreetMap context was promoted or mixed with market/personal data");
  check(Array.isArray(policy.forbidden_claims)&&["LEGAL_BOUNDARY","BUILDING_HEIGHT","LEGAL_ACCESS","SURVEYED_TERRAIN","PLANNING_ENTITLEMENT"].every(value=>policy.forbidden_claims.includes(value)),"forbidden spatial claims weakened");
  check(!/(api[_-]?key|access[_-]?token|password|connection[_-]?string|client[_-]?secret)\s*[\":=]+\s*[\"']?(?!required|false|null)/i.test(JSON.stringify(manifest)),"context artifact contains a possible credential payload");
  return {ok:errors.length===0,assertions,errors,roads:roads.length,namedStreets:named.length,buildings:buildings.length};
}

export function run({requireRuntime=process.argv.includes("--require-runtime")}={}){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,manifestPath),"utf8"));
  const result=validateOsmContext(manifest,{requireRuntime});
  if(!fs.existsSync(path.join(root,schemaPath)))result.errors.push("OpenStreetMap context schema missing");
  result.ok=result.errors.length===0;
  return result;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const result=run();
  if(!result.ok){console.error(`SVÄRTINGE OSM CONTEXT: FAIL\n- ${result.errors.join("\n- ")}`);process.exit(1);}
  console.log(`SVÄRTINGE OSM CONTEXT: PASS (${result.assertions} assertions · ${result.namedStreets} named streets · ${result.roads} road segments · ${result.buildings} building footprints)`);
}
