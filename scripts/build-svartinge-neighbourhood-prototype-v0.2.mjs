import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
import {deriveLiveContextView} from "../prototype/svartinge-neighbourhood/geographic-alignment.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const base="data/sites/sweden/saterdalsvagen-14";
const sourcePath=`${base}/plot-intelligence-v0.1.json`;
const projectPath=`${base}/project-v0.1.json`;
const alphaPath=`${base}/neighbourhood-twin-alpha-v0.1.json`;
const municipalBoundaryPath=`${base}/municipal-property-boundary-epsg3010-v0.1.json`;
const outputPath=`${base}/neighbourhood-scene-v0.2.json`;
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const sha=p=>crypto.createHash("sha256").update(fs.readFileSync(path.join(root,p))).digest("hex");
const round=(n,d=4)=>Number(n.toFixed(d));

function polygonArea(points){
  let twice=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    twice+=a[0]*b[1]-b[0]*a[1];
  }
  return Math.abs(twice)/2;
}

function scalePolygonToArea(points,targetArea){
  const factor=Math.sqrt(targetArea/polygonArea(points));
  return points.map(([x,z])=>[round(x*factor),round(z*factor)]);
}

function terrainGrid(){
  const size=360,segments=24,vertices=[];
  for(let iz=0;iz<=segments;iz++){
    for(let ix=0;ix<=segments;ix++){
      const x=-size/2+size*ix/segments;
      const z=-size/2+size*iz/segments;
      const y=0.008*x+0.014*z+0.55*Math.sin(x/38)*Math.cos(z/52);
      vertices.push([round(x),round(y),round(z)]);
    }
  }
  return {size_m:size,segments,vertices,height_reference:"LOCAL_RELATIVE_UNCALIBRATED",method:"Deterministic contextual surface: planar fall plus low-amplitude smoothing; no RH2000 elevation claim."};
}

function element(id,type,label,evidence_class,geometry,source_refs=[],limitations=[]){
  return {id,type,label,evidence_class,geometry,source_refs,limitations};
}

function building(id,x,z,w,d,h,rotation=0){
  return element(id,"CONTEXT_BUILDING",`Context massing ${id.split("_").at(-1)}`,"DERIVED",{primitive:"BOX",position:[x,h/2,z],size:[w,h,d],rotation_y_deg:rotation},["RCPT_SE_LISTING_MAP_IMAGE"],["Footprint position and envelope are diagrammatically traced/estimated from the listing map.","Height is a context-massing estimate, not a surveyed storey or ridge height.","No ownership, use, lawful-status or address claim."]);
}

function buildScene(){
  const source=read(sourcePath),project=read(projectPath),alpha=read(alphaPath),municipalBoundary=read(municipalBoundaryPath);
  const finding=source.findings.find(f=>f.finding_id==="FINDING_SE_NOKA_PROPERTY_LOCATOR_CONFIRMED");
  if(!finding)throw new Error("NOKA property finding missing");
  const municipalArea=finding.value.municipal_map_area_m2;
  const [lon,lat]=source.identity.coordinate_wgs84;
  const plot=municipalBoundary.renderer_transform.points_xz_local_m;
  const observedArea=municipalBoundary.geometry.area_m2;
  if(municipalBoundary.subject!=="SVÄRTINGE 54:28"||municipalBoundary.source_service.property_query_resolved_exactly!==true)throw new Error("Exact municipal property boundary observation missing");
  if(Math.abs(polygonArea(plot)-observedArea)>0.001)throw new Error("Municipal boundary transform changed the observed area");
  if(Math.abs(observedArea-municipalArea)>0.01)throw new Error("Municipal boundary and locator areas disagree");
  const elements=[];

  elements.push(element("TERRAIN_CONTEXT","TERRAIN","Derived local terrain context","DERIVED",{primitive:"GRID_SURFACE",...terrainGrid()},["FINDING_SE_HEIGHT_ITEM_AVAILABLE_NOT_FETCHED","RCPT_SE_LISTING_MAP_IMAGE"],["Indicative visual surface only.","No official raster bytes, RH2000 levels, contours, slopes, drainage or finished-floor values."]));
  elements.push(element("PLOT_54_28","PLOT","SVÄRTINGE 54:28 municipal-map boundary observation","INDICATIVE",{primitive:"EXTRUDED_POLYGON",points_xz:plot,base_y:0.15,height:0.18,area_m2:observedArea},[municipalBoundaryPath,"FINDING_SE_NOKA_PROPERTY_LOCATOR_CONFIRMED","RCPT_SE_NORRKOPING_NOKA_PROPERTY_PLAN_QUERY"],["Shape is joined without vertex editing from the property-specific Norrköping municipal DWG export.","Norrköpings kommun states that displayed property boundaries have no legal effect and their geographic position may be misleading.","Not suitable for cadastral, setback, area certification or set-out use."]));
  elements.push(element("ADDRESS_LOCATOR","ANCHOR","Säterdalsvägen 14 municipal locator","AUTHORITATIVE",{primitive:"MARKER",position:[0,2.5,0]},["FINDING_SE_NOKA_PROPERTY_LOCATOR_CONFIRMED"],["Authoritative only as a dated municipal address-to-property observation.","Not a survey control point or property-register title record."]));

  elements.push(element("ROAD_SATERDALSVAGEN","ROAD","Säterdalsvägen derived alignment","DERIVED",{primitive:"POLYLINE_RIBBON",points:[[-150,0,-54],[-70,0,-43],[-35,0,-30],[-28,0,-18],[-27,0,80]],width_m:6},["RCPT_SE_LISTING_MAP_IMAGE","RCPT_SE_NORRKOPING_NOKA_PROPERTY_PLAN_QUERY"],["Diagrammatic alignment traced from available map imagery.","No current centreline, width, gradient, road-manager or legal-access claim."]));
  elements.push(element("ROAD_GAMLA_LANDSVAGEN","ROAD","Gamla Landsvägen derived alignment","DERIVED",{primitive:"POLYLINE_RIBBON",points:[[20,0,-31],[85,0,-44],[155,0,-52]],width_m:7},["RCPT_SE_LISTING_MAP_IMAGE"],["Diagrammatic alignment traced from listing map imagery.","Width and vertical geometry are estimated for navigation only."]));

  [
    ["CTX_BLDG_01",-88,-20,18,11,5.8,-12],["CTX_BLDG_02",-115,-72,14,10,5.2,8],
    ["CTX_BLDG_03",-57,-76,17,12,6.1,-4],["CTX_BLDG_04",10,-58,12,9,5.4,15],
    ["CTX_BLDG_05",58,-30,26,11,6.2,-17],["CTX_BLDG_06",92,-70,17,11,5.8,-11],
    ["CTX_BLDG_07",91,32,22,12,6.0,7],["CTX_BLDG_08",-90,57,17,11,5.6,12],
    ["CTX_BLDG_09",-45,91,18,12,6.1,-5],["CTX_BLDG_10",42,88,16,10,5.5,9],
    ["CTX_BLDG_11",126,68,19,12,6.4,-8],["CTX_BLDG_12",133,-10,15,10,5.2,11]
  ].forEach(args=>elements.push(building(...args)));

  elements.push(element("VIEW_GLAN","VIEW_DIRECTION","Reported Glan view direction","REPORTED_UNVERIFIED",{primitive:"DIRECTION_CONE",origin:[5,3,-3],azimuth_deg:185,length_m:95,spread_deg:22},["PROJECT_SE_SATERDALSVAGEN14","RCPT_SE_LISTING"],["Direction is a concept visualization of the seller-reported Glan view.","No verified sightline, obstruction, seasonal foliage or view-right claim."]));
  elements.push(element("SOLAR_PATH","ENVIRONMENTAL_ANCHOR","Derived solar path","DERIVED",{primitive:"SOLAR_ARC",latitude_deg:lat,longitude_deg:lon,study_date:"2026-06-21",hours:[6,8,10,12,14,16,18,20]},["COORDINATE_ANCHOR"],["Solar vectors are analytical directions from the working coordinate.","Context massing and terrain are not verified, so shadows are concept-study output only."]));

  const houseRotation=0;
  const conceptCenter=[9.4,13.1];
  elements.push(element("HOUSE_SLAB","CONCEPT_BUILDING","Concept house slab","CONCEPT",{primitive:"BOX",position:[conceptCenter[0],0.55,conceptCenter[1]],size:[12,0.35,8],rotation_y_deg:houseRotation},["USER_DIRECTIVE_CONCEPT_PROTOTYPE"],["Concept placement only; no entitlement, setback, access, foundation or finished-floor claim."]));
  elements.push(element("HOUSE_WALL_N","CONCEPT_BUILDING","Concept north wall","CONCEPT",{primitive:"BOX",position:[conceptCenter[0],2.05,conceptCenter[1]+4],size:[12,3,0.22],rotation_y_deg:houseRotation},["USER_DIRECTIVE_CONCEPT_PROTOTYPE"],["Concept geometry only."]));
  elements.push(element("HOUSE_WALL_S","CONCEPT_BUILDING","Concept garden wall","CONCEPT",{primitive:"BOX",position:[conceptCenter[0],2.05,conceptCenter[1]-4],size:[12,3,0.22],rotation_y_deg:houseRotation},["USER_DIRECTIVE_CONCEPT_PROTOTYPE"],["Concept geometry only; includes diagrammatic glazing zones."]));
  elements.push(element("HOUSE_WALL_E","CONCEPT_BUILDING","Concept east wall","CONCEPT",{primitive:"BOX",position:[conceptCenter[0]+6,2.05,conceptCenter[1]],size:[0.22,3,8],rotation_y_deg:houseRotation},["USER_DIRECTIVE_CONCEPT_PROTOTYPE"],["Concept geometry only."]));
  elements.push(element("HOUSE_WALL_W","CONCEPT_BUILDING","Concept west wall","CONCEPT",{primitive:"BOX",position:[conceptCenter[0]-6,2.05,conceptCenter[1]],size:[0.22,3,8],rotation_y_deg:houseRotation},["USER_DIRECTIVE_CONCEPT_PROTOTYPE"],["Concept geometry only."]));
  elements.push(element("HOUSE_ROOF","CONCEPT_BUILDING","Concept roof","CONCEPT",{primitive:"BOX",position:[conceptCenter[0],3.65,conceptCenter[1]],size:[12.5,0.28,8.5],rotation_y_deg:houseRotation},["USER_DIRECTIVE_CONCEPT_PROTOTYPE"],["Concept geometry only; hidden for interior navigation."]));
  elements.push(element("ROOM_LIVING","ROOM","Concept living room","CONCEPT",{primitive:"ROOM_VOLUME",position:[11.2,1.65,11.55],size:[6,3,4.6],rotation_y_deg:houseRotation,intended_use:"LIVING_DINING"},["ROOM_TWIN_PATTERN","USER_DIRECTIVE_CONCEPT_PROTOTYPE"],["6.0 x 4.6 m concept room used to prove the navigation/export chain.","Not surveyed, approved BIM or built geometry."]));
  elements.push(element("ROOM_SERVICE","ROOM","Concept service/private zone","CONCEPT",{primitive:"ROOM_VOLUME",position:[6.3,1.65,13.45],size:[3.4,3,6.5],rotation_y_deg:houseRotation,intended_use:"UNRESOLVED_FLEX_ZONE"},["USER_DIRECTIVE_CONCEPT_PROTOTYPE"],["Diagrammatic zone only; no fixed programme or compliance claim."]));
  elements.push(element("WINDOW_GLAN","OPENING","Concept south glazing","CONCEPT",{primitive:"BOX",position:[11.5,2.05,8.98],size:[4.2,2.25,0.08],rotation_y_deg:houseRotation},["VIEW_GLAN","USER_DIRECTIVE_CONCEPT_PROTOTYPE"],["Concept opening aligned to the reported view direction; no overheating, structural or planning verification."]));
  elements.push(element("DOOR_ENTRY","OPENING","Concept entrance","CONCEPT",{primitive:"BOX",position:[3.28,1.75,13.3],size:[0.08,2.25,1.05],rotation_y_deg:houseRotation},["USER_DIRECTIVE_CONCEPT_PROTOTYPE"],["Concept entry only; not a legal access or accessibility claim."]));
  elements.push(element("SOFA_CONCEPT","FURNITURE","Concept sofa proxy","CONCEPT",{primitive:"BOX",position:[11.4,1.0,12.45],size:[2.8,0.8,0.9],rotation_y_deg:houseRotation},["ROOM_TWIN_PATTERN"],["Spatial proxy only; no Product Twin or procurement claim."]));
  elements.push(element("TABLE_CONCEPT","FURNITURE","Concept table proxy","CONCEPT",{primitive:"BOX",position:[11.4,0.8,10.9],size:[1.5,0.12,0.75],rotation_y_deg:houseRotation},["ROOM_TWIN_PATTERN"],["Spatial proxy only; no Product Twin or procurement claim."]));

  const poiNames=["Svärtinge Skogsbacke skola","Svärtingehus skola","Utsiktens förskola","Svärtinge skogsbacke stop","ICA Nära Svärtinge","Lake Glan context"];
  poiNames.forEach((label,i)=>elements.push(element(`POI_${String(i+1).padStart(2,"0")}`,"POI",label,"INDICATIVE",{primitive:"DIAGRAMMATIC_MARKER",position:[-145+i*52,8,145+(i%2)*18],placement_method:"DIAGRAMMATIC_NOT_GEOGRAPHIC",distance_m:null},[alpha.proximity_register.find(p=>p.name===label)?.source_url??"NEIGHBOURHOOD_ALPHA_PROXIMITY_REGISTER"],["Locality presence is source-bound, but the 3D marker position is indicative and diagrammatic.","No coordinate, distance, route or travel-time claim."])));

  const liveZoom={NEIGHBOURHOOD_VIEW:15.6,STREET_VIEW:19.2,PLOT_ORBIT:17.8,CONCEPT_HOUSE_ON_PLOT:18.7,BUILDING_ORBIT:19.4,ENTER_BUILDING:20,ROOM:20.5};
  const navigation=[
    {id:"NEIGHBOURHOOD_VIEW",label:"Neighbourhood view",camera:[125,105,150],target:[9,0,13],visible_groups:["TERRAIN","PLOT","ROAD","CONTEXT_BUILDING","POI"],cutaway:false},
    {id:"STREET_VIEW",label:"Street approach",camera:[-54,4.2,-28],target:[8,2,14],visible_groups:["TERRAIN","PLOT","ROAD","CONTEXT_BUILDING","POI"],cutaway:false},
    {id:"PLOT_ORBIT",label:"Plot plan",camera:[9,75,25],target:[9,0,13],visible_groups:["TERRAIN","PLOT","ROAD"],cutaway:false},
    {id:"CONCEPT_HOUSE_ON_PLOT",label:"Concept house on plot",camera:[48,31,54],target:[9.4,2,13.1],visible_groups:["TERRAIN","PLOT","ROAD","CONTEXT_BUILDING","VIEW_DIRECTION","CONCEPT_BUILDING","OPENING"],cutaway:false},
    {id:"BUILDING_ORBIT",label:"Building orbit",camera:[26.4,11,29.1],target:[9.4,2,13.1],visible_groups:["PLOT","CONCEPT_BUILDING","OPENING","VIEW_DIRECTION"],cutaway:false},
    {id:"ENTER_BUILDING",label:"Enter building",camera:[4.9,2.1,12.8],target:[11.4,1.6,11.6],visible_groups:["CONCEPT_BUILDING","OPENING","ROOM","FURNITURE"],cutaway:true},
    {id:"ROOM",label:"Room",camera:[13.5,1.75,13.2],target:[11.1,1.45,11],visible_groups:["CONCEPT_BUILDING","OPENING","ROOM","FURNITURE","VIEW_DIRECTION"],cutaway:true}
  ].map(step=>({...step,live_context_view:deriveLiveContextView({originWgs84:[lon,lat],camera:step.camera,target:step.target,zoom:liveZoom[step.id]})}));

  return {
    scene_version:"svartinge-neighbourhood-scene/v0.2",
    entity_type:"NeighbourhoodSceneExport",
    scene_id:"SCENE_SE_NORRKOPING_SVARTINGE_54_28_CONCEPT_V02",
    generated_at:"2026-08-18T00:00:00Z",
    subject:{working_property_identity:"SVÄRTINGE 54:28",address:source.identity.address,municipality:"Norrköping",identity_evidence_class:"AUTHORITATIVE",identity_scope:"MUNICIPAL_ADDRESS_TO_PROPERTY_OBSERVATION_NOT_PROPERTY_REGISTER"},
    coordinate_system:{frame:"LOCAL_ENU",axes:{x:"EAST",y:"UP",z:"NORTH"},origin_wgs84:[lon,lat],horizontal_reference:"EPSG:4326 origin",projected_origin_epsg3010_m:municipalBoundary.renderer_transform.origin_epsg3010_m,vertical_reference:"LOCAL_RELATIVE_UNCALIBRATED",linear_units:"metre",evidence_class:"AUTHORITATIVE",limitations:["Origin is a municipal locator, not survey control.","All Y values are relative prototype heights.","Live context uses stage-level camera synchronization; it is not a pixel-aligned survey overlay."]},
    source_bindings:[
      {path:sourcePath,sha256:sha(sourcePath),role:"OFFICIAL_AND_CONTEXT_EVIDENCE"},
      {path:projectPath,sha256:sha(projectPath),role:"LISTING_REPORTED_CONTEXT"},
      {path:alphaPath,sha256:sha(alphaPath),role:"PRIOR_EVIDENCE_GATE_CHECKPOINT"},
      {path:municipalBoundaryPath,sha256:sha(municipalBoundaryPath),role:"OFFICIAL_MUNICIPAL_MAP_BOUNDARY_OBSERVATION_NO_LEGAL_EFFECT"},
      {path:".runtime/sites/sweden/saterdalsvagen-14/raw/boneo-fastighetskarta.webp",sha256:"RUNTIME_ONLY_NOT_COMMITTED",role:"LISTING_MAP_TRACE_REFERENCE"}
    ],
    evidence_classes:["AUTHORITATIVE","INDICATIVE","DERIVED","REPORTED_UNVERIFIED","CONCEPT"],
    measurements:{municipal_map_area_m2:{value:municipalArea,evidence_class:"INDICATIVE",source_ref:"FINDING_SE_NOKA_PROPERTY_LOCATOR_CONFIRMED"},listing_area_m2:{value:1939,evidence_class:"REPORTED_UNVERIFIED",source_ref:"PROJECT_SE_SATERDALSVAGEN14"},municipal_export_computed_area_m2:{value:observedArea,evidence_class:"INDICATIVE",method:"Joined without vertex editing from six klm_fastgranser segments in the property-specific municipal DWG export"}},
    legal_claim_policy:{visualisation_allowed:true,concept_design_allowed:true,sun_view_navigation_allowed:true,blocked_claims:["LEGAL_BOUNDARY","REGISTERED_AREA","ENTITLEMENT","BUILDABLE_ENVELOPE","LEGAL_ACCESS","UTILITY_CAPACITY","SURVEYED_TERRAIN","FINISHED_FLOOR_LEVEL"],rule:"Open gates block authoritative legal/design-basis claims, not explicitly labelled concept visualization."},
    navigation,
    elements,
    studies:{solar:{evidence_class:"DERIVED",coordinate:[lon,lat],date:"2026-06-21",interactive_hour_range:[6,20],limitations:["Analytical sun direction on derived context only."]},views:{evidence_class:"REPORTED_UNVERIFIED",direction_id:"VIEW_GLAN",limitations:["Seller-reported view; no verified visibility analysis."]}},
    prototype:{viewer_path:"prototype/svartinge-neighbourhood/index.html",requires_http_server:true,recommended_command:"npm run site:sweden:svartinge:prototype:serve",default_step:"NEIGHBOURHOOD_VIEW"},
    project_status:{design_scenario:"CONCEPT_VISUALISATION_ACTIVE_LEGAL_GATES_OPEN",selected_house_profile:null,source_project_status:project.status??null}
  };
}

export function build(){
  const scene=buildScene();
  fs.writeFileSync(path.join(root,outputPath),JSON.stringify(scene,null,2)+"\n");
  return scene;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const scene=build();
  console.log(JSON.stringify({output:outputPath,elements:scene.elements.length,navigation_steps:scene.navigation.length,evidence_classes:scene.evidence_classes,plot_area_m2:scene.measurements.municipal_export_computed_area_m2.value},null,2));
}
