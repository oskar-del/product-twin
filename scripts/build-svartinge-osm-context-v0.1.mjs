import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const rawPath=".runtime/sites/sweden/saterdalsvagen-14/raw/osm-context-900m.json";
const outputPath="data/sites/sweden/saterdalsvagen-14/osm-context-v0.1.json";
const origin=[16.0317063331,58.6522414431];
const radius=900;
const retrievedAt="2026-08-24T19:17:52Z";
const canonicalQuery="[out:json][timeout:90];(way(around:900,58.6522414431,16.0317063331)[highway];way(around:900,58.6522414431,16.0317063331)[building];way(around:900,58.6522414431,16.0317063331)[natural=water];relation(around:900,58.6522414431,16.0317063331)[natural=water];way(around:900,58.6522414431,16.0317063331)[waterway];way(around:900,58.6522414431,16.0317063331)[natural=wood];way(around:900,58.6522414431,16.0317063331)[landuse];);out body geom;";
const round=(value,digits=2)=>Number(value.toFixed(digits));
const shaBytes=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
const canonical=value=>JSON.stringify(value,Object.keys(value).sort());

function localPoint(point){
  const earth=6378137,cos=Math.cos(origin[1]*Math.PI/180);
  return [round((point.lon-origin[0])*Math.PI/180*earth*cos),round((point.lat-origin[1])*Math.PI/180*earth)];
}

function samePoint(a,b){return Math.abs(a[0]-b[0])<0.01&&Math.abs(a[1]-b[1])<0.01;}
function dedupe(points){return points.filter((point,index)=>index===0||!samePoint(point,points[index-1]));}
function bbox(points){return points.reduce((out,[x,z])=>[Math.min(out[0],x),Math.min(out[1],z),Math.max(out[2],x),Math.max(out[3],z)],[Infinity,Infinity,-Infinity,-Infinity]);}
function bboxIntersects(bounds,limit=radius){return !(bounds[2]<-limit||bounds[0]>limit||bounds[3]<-limit||bounds[1]>limit);}
function lineLength(points){let total=0;for(let i=1;i<points.length;i++)total+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);return total;}

function clipSegment(a,b,limit=radius){
  let t0=0,t1=1;const dx=b[0]-a[0],dz=b[1]-a[1];
  for(const [p,q] of [[-dx,a[0]+limit],[dx,limit-a[0]],[-dz,a[1]+limit],[dz,limit-a[1]]]){
    if(p===0&&q<0)return null;
    if(p!==0){const r=q/p;if(p<0){if(r>t1)return null;if(r>t0)t0=r;}else{if(r<t0)return null;if(r<t1)t1=r;}}
  }
  return [[round(a[0]+t0*dx),round(a[1]+t0*dz)],[round(a[0]+t1*dx),round(a[1]+t1*dz)]];
}

function clipPolyline(points){
  const parts=[];let part=[];
  for(let i=1;i<points.length;i++){
    const clipped=clipSegment(points[i-1],points[i]);
    if(!clipped){if(part.length>1)parts.push(dedupe(part));part=[];continue;}
    if(!part.length||!samePoint(part.at(-1),clipped[0])){if(part.length>1)parts.push(dedupe(part));part=[clipped[0]];}
    part.push(clipped[1]);
  }
  if(part.length>1)parts.push(dedupe(part));
  return parts.filter(points=>points.length>1&&lineLength(points)>=3);
}

function clipPolygon(points,limit=radius){
  let output=points;
  const edges=[
    {inside:p=>p[0]>=-limit,intersect:(a,b)=>[-limit,a[1]+(b[1]-a[1])*(-limit-a[0])/(b[0]-a[0])]},
    {inside:p=>p[0]<=limit,intersect:(a,b)=>[limit,a[1]+(b[1]-a[1])*(limit-a[0])/(b[0]-a[0])]},
    {inside:p=>p[1]>=-limit,intersect:(a,b)=>[a[0]+(b[0]-a[0])*(-limit-a[1])/(b[1]-a[1]),-limit]},
    {inside:p=>p[1]<=limit,intersect:(a,b)=>[a[0]+(b[0]-a[0])*(limit-a[1])/(b[1]-a[1]),limit]}
  ];
  for(const edge of edges){
    const input=output;output=[];if(!input.length)break;
    for(let i=0;i<input.length;i++){
      const current=input[i],previous=input[(i+input.length-1)%input.length],currentInside=edge.inside(current),previousInside=edge.inside(previous);
      if(currentInside){if(!previousInside)output.push(edge.intersect(previous,current).map(value=>round(value)));output.push(current);}
      else if(previousInside)output.push(edge.intersect(previous,current).map(value=>round(value)));
    }
  }
  return dedupe(output).filter((point,index,array)=>index<array.length-1||!samePoint(point,array[0]));
}

function roadWidth(tags){
  const explicit=Number.parseFloat(tags.width);
  if(Number.isFinite(explicit)&&explicit>0&&explicit<30)return round(explicit);
  return {primary:7.5,tertiary:6.5,residential:5.2,unclassified:5,service:3.2,track:2.6,cycleway:2,path:1.4,footway:1.4,platform:1.8}[tags.highway]??3;
}

function displayHeight(element){
  const tag=element.tags?.building;
  if(tag==="church")return 10.5;
  if(tag==="retail")return 6.5;
  if(tag==="grandstand")return 5.5;
  return round(4.6+(element.id%5)*0.38);
}

export function compile(raw){
  const roads=[];
  for(const element of raw.elements.filter(item=>item.type==="way"&&item.tags?.highway&&item.geometry?.length>1)){
    const parts=clipPolyline(element.geometry.map(localPoint));
    parts.forEach((points,index)=>roads.push({
      feature_id:`OSM_ROAD_${element.id}_${index+1}`,
      osm_way_id:element.id,
      name:element.tags.name??null,
      highway_class:element.tags.highway,
      surface:element.tags.surface??null,
      display_width_m:roadWidth(element.tags),
      width_method:Number.isFinite(Number.parseFloat(element.tags.width))?"OSM_WIDTH_TAG":"DISPLAY_WIDTH_FROM_HIGHWAY_CLASS_NOT_MEASURED",
      points_xz:points
    }));
  }
  const buildings=[];
  for(const element of raw.elements.filter(item=>item.type==="way"&&item.tags?.building&&item.geometry?.length>=4)){
    let points=dedupe(element.geometry.map(localPoint));
    if(points.length>2&&samePoint(points[0],points.at(-1)))points=points.slice(0,-1);
    if(points.length<3||!bboxIntersects(bbox(points)))continue;
    buildings.push({
      feature_id:`OSM_BUILDING_${element.id}`,
      osm_way_id:element.id,
      building_tag:element.tags.building,
      points_xz:points,
      source_height_m:null,
      source_levels:null,
      display_height_m:displayHeight(element),
      height_method:"DETERMINISTIC_PRESENTATION_ONLY_NO_OSM_HEIGHT_OR_LEVEL_TAG"
    });
  }
  const landcover=[];
  for(const element of raw.elements.filter(item=>item.type==="way"&&item.tags?.landuse&&item.geometry?.length>=4)){
    const points=clipPolygon(element.geometry.map(localPoint));
    if(points.length<3)continue;
    landcover.push({feature_id:`OSM_LANDUSE_${element.id}`,osm_way_id:element.id,landuse:element.tags.landuse,points_xz:points});
  }
  const water=[];
  for(const element of raw.elements.filter(item=>item.type==="way"&&item.tags?.natural==="water"&&item.geometry?.length>=4)){
    const points=clipPolygon(element.geometry.map(localPoint));
    if(points.length<3)continue;
    water.push({feature_id:`OSM_WATER_${element.id}`,osm_way_id:element.id,name:element.tags.name??null,water:element.tags.water??null,points_xz:points});
  }
  const waterways=[];
  for(const element of raw.elements.filter(item=>item.type==="way"&&item.tags?.waterway&&item.geometry?.length>1)){
    clipPolyline(element.geometry.map(localPoint)).forEach((points,index)=>waterways.push({feature_id:`OSM_WATERWAY_${element.id}_${index+1}`,osm_way_id:element.id,name:element.tags.name??null,waterway:element.tags.waterway,points_xz:points}));
  }
  roads.sort((a,b)=>a.feature_id.localeCompare(b.feature_id));buildings.sort((a,b)=>a.feature_id.localeCompare(b.feature_id));landcover.sort((a,b)=>a.feature_id.localeCompare(b.feature_id));water.sort((a,b)=>a.feature_id.localeCompare(b.feature_id));waterways.sort((a,b)=>a.feature_id.localeCompare(b.feature_id));
  const namedStreets=[...new Set(roads.map(road=>road.name).filter(Boolean).map(name=>name.toLocaleLowerCase("sv-SE")))].sort((a,b)=>a.localeCompare(b,"sv-SE"));
  const compiled={roads,buildings,landcover,water,waterways};
  return {
    schema_version:"svartinge-osm-context/v0.1",
    entity_type:"SourceBoundNeighbourhoodContext",
    context_id:"SE_SVARTINGE_54_28_OSM_900M_V01",
    subject:{working_property_identity:"SVÄRTINGE 54:28",origin_wgs84:origin,context_radius_m:800,stitching_halo_m:100,selection_radius_m:radius},
    source:{provider:"OpenStreetMap contributors",service:"Overpass API",endpoint:"https://overpass-api.de/api/interpreter",state:"CONNECTED_SOURCE_SNAPSHOT",official_source:false,canonical_query:canonicalQuery,retrieved_at:retrievedAt,osm_base_timestamp:raw.osm3s?.timestamp_osm_base??null,license:"ODbL-1.0",attribution:"© OpenStreetMap contributors",copyright_url:"https://www.openstreetmap.org/copyright",raw_runtime_locator:rawPath,raw_byte_count:fs.statSync(path.join(root,rawPath)).size,raw_sha256:shaBytes(fs.readFileSync(path.join(root,rawPath))),credentials_required:false,credentials_persisted:false},
    transform:{frame:"LOCAL_EAST_NORTH",method:"WGS84_LOCAL_EQUIRECTANGULAR_AROUND_MUNICIPAL_LOCATOR",linear_units:"metre",clip_bounds_xz_m:[-radius,-radius,radius,radius],precision_m:0.01,limitations:["Local transform is suitable for contextual visualization, not survey control.","Road widths and all building heights without source tags are presentation-only.","OpenStreetMap is community-maintained context, not official cadastral, access, planning or terrain evidence."]},
    statistics:{raw_element_count:raw.elements.length,road_segment_count:roads.length,named_street_count:namedStreets.length,named_streets:namedStreets,building_footprint_count:buildings.length,landcover_polygon_count:landcover.length,water_polygon_count:water.length,waterway_segment_count:waterways.length},
    compiled,
    derived_content_sha256:shaBytes(Buffer.from(JSON.stringify(compiled))),
    evidence_policy:{evidence_class:"DERIVED",legal_effect:"NONE",official_geometry_gates_closed:false,market_data_included:false,personal_data_included:false,required_attribution_visible:true,forbidden_claims:["LEGAL_BOUNDARY","REGISTERED_AREA","BUILDING_HEIGHT","LEGAL_ACCESS","SURVEYED_TERRAIN","PLANNING_ENTITLEMENT"]}
  };
}

export function build(){
  const rawFile=path.join(root,rawPath);
  if(!fs.existsSync(rawFile))throw new Error(`Runtime OpenStreetMap extract missing: ${rawPath}`);
  const manifest=compile(JSON.parse(fs.readFileSync(rawFile,"utf8")));
  fs.writeFileSync(path.join(root,outputPath),JSON.stringify(manifest,null,2)+"\n");
  return manifest;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const result=build();
  console.log(JSON.stringify({output:outputPath,roads:result.statistics.road_segment_count,named_streets:result.statistics.named_street_count,buildings:result.statistics.building_footprint_count,landcover:result.statistics.landcover_polygon_count,derived_sha256:result.derived_content_sha256},null,2));
}
