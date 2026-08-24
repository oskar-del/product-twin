import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const base="data/sites/sweden/saterdalsvagen-14";
const sourcePath=`${base}/plot-intelligence-v0.1.json`;
const geometryPath=`${base}/neighbourhood-context-indicative-v0.1.geojson`;
const manifestPath=`${base}/neighbourhood-twin-alpha-v0.1.json`;
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const sha=p=>crypto.createHash("sha256").update(fs.readFileSync(path.join(root,p))).digest("hex");
const source=read(sourcePath);
const [lon,lat]=source.identity.coordinate_wgs84;
const area=source.findings.find(f=>f.finding_id==="FINDING_SE_NOKA_PROPERTY_LOCATOR_CONFIRMED").value.municipal_map_area_m2;
const radius=Math.sqrt(area/Math.PI);

function notionalDisc(){
  const ring=[];
  for(let i=0;i<=32;i++){
    const angle=2*Math.PI*i/32;
    const east=radius*Math.cos(angle),north=radius*Math.sin(angle);
    ring.push([lon+east/(111320*Math.cos(lat*Math.PI/180)),lat+north/110540]);
  }
  return {type:"FeatureCollection",name:"SVÄRTINGE 54:28 indicative context only",crs:{type:"name",properties:{name:"urn:ogc:def:crs:OGC::CRS84"}},features:[
    {type:"Feature",properties:{feature_id:"ADDRESS_LOCATOR",evidence_state:"VERIFIED",geometry_role:"MUNICIPAL_ADDRESS_TO_PROPERTY_LOCATOR_NOT_BOUNDARY"},geometry:{type:"Point",coordinates:[lon,lat]}},
    {type:"Feature",properties:{feature_id:"AREA_EQUIVALENT_DISC",evidence_state:"INDICATIVE",geometry_role:"NOTIONAL_AREA_EQUIVALENT_DISC_NOT_PARCEL_BOUNDARY",area_basis_m2:area,radius_m:radius,legal_or_survey_use:false,design_setout_use:false},geometry:{type:"Polygon",coordinates:[ring]}}
  ]};
}

const E={VERIFIED:0,INDICATIVE:0,REPORTED_UNVERIFIED:0,BLOCKED:0,UNKNOWN:0};
function evidence(state){E[state]++;return state;}
function gate(gate_id,prevents,reason,evidence_refs=[]){return {gate_id,state:"BLOCKED",prevents,reason,evidence_refs};}

export function build(){
  fs.mkdirSync(path.dirname(path.join(root,geometryPath)),{recursive:true});
  fs.writeFileSync(path.join(root,geometryPath),JSON.stringify(notionalDisc(),null,2)+"\n");
  const manifest={
    manifest_version:"neighbourhood-twin-alpha/v0.1",entity_type:"NeighbourhoodTwinAlpha",neighbourhood_twin_id:"NEIGH_SE_NORRKOPING_SVARTINGE_54_28_ALPHA",version:"0.1",
    subject:{working_identity:"SVÄRTINGE 54:28",municipality:"Norrköping",address:source.identity.address,identity_state:"VERIFIED_MUNICIPAL_LOCATOR_NOT_PROPERTY_REGISTER"},
    source_binding:{path:sourcePath,sha256:sha(sourcePath),source_receipts:source.source_receipts.length,findings:source.findings.length},
    coordinate_anchor:{state:evidence("VERIFIED"),role:"MUNICIPAL_ADDRESS_TO_PROPERTY_LOCATOR",wgs84:{crs:"EPSG:4326",axis_order:"longitude_latitude",coordinates:[lon,lat]},municipal_query:{crs:"EPSG:3010",coordinates:[122807,6504014]},render_frame:{type:"LOCAL_ENU",origin_wgs84:[lon,lat],linear_unit:"metre",vertical_datum:"UNRESOLVED_NO_TERRAIN"},limitations:["Not a surveyed point","Not an authoritative cadastral centroid","No vertical coordinate"]},
    parcel_representation:{state:evidence("INDICATIVE"),geometry_path:geometryPath,geometry_sha256:sha(geometryPath),representation:"AREA_EQUIVALENT_DISC",municipal_map_area_m2:area,registered_area_m2:null,legal_boundary_available:false,surveyed_boundary_available:false,render_policy:"TRANSLUCENT_UNCERTAINTY_DISC_ONLY",forbidden_labels:["LEGAL_BOUNDARY","CADASTRAL_BOUNDARY","SURVEYED_BOUNDARY","BUILDABLE_ENVELOPE"],limitations:["The disc is a synthetic area-equivalent context marker, not parcel shape","NOKA boundaries have no legal effect","No setout, setback or entitlement decision may use this geometry"]},
    terrain:{state:evidence("BLOCKED"),availability:{product:"Lantmäteriet Markhöjdmodell 1 m",item_id:"650_55",horizontal_crs:"EPSG:3006",compound_crs:"EPSG:5845",vertical_datum:"RH2000",grid_resolution_m:1},asset_access:"HTTP_401_WITHOUT_CREDENTIALS",terrain_values_available:false,mesh_available:false,render_policy:"FLAT_NEUTRAL_CONTEXT_PLANE_WITH_TERRAIN_UNAVAILABLE_BADGE",blockers:["Raster bytes unavailable","No coverage/nodata QA","No plot clip","No elevations, contours, slopes, drainage or terrain mesh"]},
    context_layers:[
      {layer_id:"SURROUNDING_BUILDINGS",state:evidence("INDICATIVE"),source:"Norrköping 2026 Svärtinge consultation narrative",observation_date:"2026-08-17",geometry_available:false,render_allowed:false,known_context:"Svärtinge is described as an existing villa settlement with proposed residential development",limitations:["No authoritative or public building-footprint capture is bound","No height, storey, use or lawful-status claims"]},
      {layer_id:"ROADS_AND_STREETS",state:evidence("INDICATIVE"),source:"Municipal address locator and historic plan archive",observation_date:"2026-08-17",geometry_available:false,render_allowed:false,known_context:"Säterdalsvägen exists as the subject address; historic plan signals road structure and a historic maximum gradient of 1:12",limitations:["No current centreline geometry","No road class, width, gradient, manager or legal-access proof"]},
      {layer_id:"STREET_AND_NEIGHBOURHOOD_CHARACTER",state:evidence("VERIFIED"),source:"Norrköping FÖP Svärtinge consultation document",observation_date:"2026-08-17",geometry_available:false,render_allowed:true,render_mode:"TEXT_CONTEXT_ONLY",known_context:"Residential service locality near Glan; current centre described around school and grocery store",limitations:["Strategic narrative, not parcel geometry or entitlement"]}
    ],
    proximity_register:[
      {category:"SCHOOL",name:"Svärtinge Skogsbacke skola",state:evidence("VERIFIED"),source_url:"https://norrkoping.se/skola-och-forskola/grundskola/kommunala-grundskolor/svartinge-skogsbacke-skola",observation_date:"2026-08-18",distance_m:null,measurement_method:"OFFICIAL_LOCALITY_PRESENCE_ONLY_NO_FACILITY_COORDINATE_CAPTURE",facts:["Municipal F-6 school","Located in Svärtinge"],limitations:["No straight-line, route or travel-time measurement"]},
      {category:"SCHOOL",name:"Svärtingehus skola",state:evidence("VERIFIED"),source_url:"https://norrkoping.se/skola-och-forskola/grundskola/kommunala-grundskolor/svartingehus-skola",observation_date:"2026-08-18",distance_m:null,measurement_method:"OFFICIAL_LOCALITY_PRESENCE_ONLY_NO_FACILITY_COORDINATE_CAPTURE",facts:["Municipal F-6 school","Located in Svärtinge"],limitations:["No straight-line, route or travel-time measurement"]},
      {category:"CHILDCARE",name:"Utsiktens förskola",state:evidence("VERIFIED"),source_url:"https://norrkoping.se/skola-och-forskola/forskola-och-annan-pedagogisk-verksamhet/kommunala-forskolor/utsikten",observation_date:"2026-08-18",distance_m:null,measurement_method:"OFFICIAL_LOCALITY_PRESENCE_ONLY_NO_FACILITY_COORDINATE_CAPTURE",facts:["Municipal preschool","Described as in upper Svärtinge"],limitations:["No straight-line, route or travel-time measurement"]},
      {category:"HEALTHCARE",name:"Local primary care",state:evidence("INDICATIVE"),source_url:"https://norrkoping.se/download/18.38ef647f19e49e0477131f/1779430656807/KS%202025_1018_Planhandling%20F%C3%96P%20Sv%C3%A4rtinge.pdf",observation_date:"2026-08-18",distance_m:null,measurement_method:"MUNICIPAL_CURRENT_SERVICE_NARRATIVE_NO_FACILITY_COORDINATE_CAPTURE",facts:["Draft municipal document states Svärtinge currently lacks a health centre","Region coverage is described as available elsewhere"],limitations:["Draft strategic document","No named provider, capacity, route or travel-time measurement"]},
      {category:"TRANSPORT",name:"Svärtinge skogsbacke stop",state:evidence("VERIFIED"),source_url:"https://www.ostgotatrafiken.se/hallplats/svartinge-skogsbacke",observation_date:"2026-08-18",distance_m:null,measurement_method:"OFFICIAL_STOP_PAGE_PRESENCE_ONLY_NO_COORDINATE_CAPTURE",facts:["Official stop page","Line 410 shown at observation"],limitations:["Timetable is volatile","No distance, walking route or service-frequency claim"]},
      {category:"SHOP",name:"ICA Nära Svärtinge",state:evidence("VERIFIED"),source_url:"https://www.ica.se/butiker/nara/norrkoping/ica-nara-svartinge-1064007/tjanster/",observation_date:"2026-08-18",distance_m:null,measurement_method:"PUBLIC_OPERATOR_LOCALITY_PRESENCE_ONLY_NO_COORDINATE_CAPTURE",facts:["Grocery service in Svärtinge","Operator page lists pharmacy/health service and fuel service"],limitations:["No price, stock, opening-hour or route claim","No distance measurement"]},
      {category:"NATURE",name:"Lake Glan and local nature context",state:evidence("VERIFIED"),source_url:"https://norrkoping.se/download/18.38ef647f19e49e0477131f/1779430656807/KS%202025_1018_Planhandling%20F%C3%96P%20Sv%C3%A4rtinge.pdf",observation_date:"2026-08-18",distance_m:null,measurement_method:"MUNICIPAL_LOCALITY_NARRATIVE_NO_ACCESS_OR_DISTANCE_MEASUREMENT",facts:["Svärtinge is described in relation to Lake Glan and nature"],limitations:["No verified sightline, shoreline access, walking route or distance"]},
      {category:"OTHER_SERVICE",name:"Library",state:evidence("INDICATIVE"),source_url:"https://norrkoping.se/download/18.38ef647f19e49e0477131f/1779430656807/KS%202025_1018_Planhandling%20F%C3%96P%20Sv%C3%A4rtinge.pdf",observation_date:"2026-08-18",distance_m:null,measurement_method:"MUNICIPAL_CURRENT_SERVICE_NARRATIVE",facts:["Draft municipal document states Svärtinge currently lacks a library"],limitations:["Draft narrative may change","No alternative-library distance or route measurement"]}
    ],
    evidence_register:[
      {evidence_id:"EV_SUBJECT_IDENTITY",domain:"SUBJECT_IDENTITY",state:evidence("VERIFIED"),value:"SVÄRTINGE 54:28",source_refs:["FINDING_SE_NOKA_PROPERTY_LOCATOR_CONFIRMED"],reason:"Municipal address/property point query confirms the working designation; property-register title and registered area remain outside this claim."},
      {evidence_id:"EV_COORDINATE_ANCHOR",domain:"COORDINATE",state:evidence("VERIFIED"),value:"EPSG:4326 locator plus EPSG:3010 municipal query point",source_refs:["FINDING_SE_NOKA_PROPERTY_LOCATOR_CONFIRMED"],reason:"Pinned source coordinates with explicit axis order; not a survey control point."},
      {evidence_id:"EV_MUNICIPAL_MAP_AREA",domain:"PARCEL_AREA",state:evidence("INDICATIVE"),value:`${area} m2 municipal map surface`,source_refs:["FINDING_SE_NOKA_PROPERTY_LOCATOR_CONFIRMED"],reason:"NOKA map surface is useful context but has no legal effect."},
      {evidence_id:"EV_PARCEL_SHAPE",domain:"PARCEL_GEOMETRY",state:evidence("UNKNOWN"),value:null,source_refs:[],reason:"No authoritative cadastral vector or surveyed boundary is bound; only an area-equivalent uncertainty disc is rendered."},
      {evidence_id:"EV_SELLER_CLAIMS",domain:"MARKET_REPORTED_CONTEXT",state:evidence("REPORTED_UNVERIFIED"),value:"Claims remain only in the separated Project record",source_refs:["data/sites/sweden/saterdalsvagen-14/project-v0.1.json"],reason:"No listing, price, owner or transaction payload is copied into the Neighbourhood Twin."},
      {evidence_id:"EV_TERRAIN",domain:"TERRAIN",state:evidence("BLOCKED"),value:"Lantmäteriet item 650_55 identified; bytes unavailable",source_refs:["FINDING_SE_HEIGHT_ITEM_AVAILABLE_NOT_FETCHED"],reason:"HTTP 401 prevents raster QA and every terrain derivation."},
      {evidence_id:"EV_BUILDINGS",domain:"EXISTING_BUILDINGS",state:evidence("BLOCKED"),value:null,source_refs:[],reason:"No source-bound building footprints or heights are captured."},
      {evidence_id:"EV_ROADS",domain:"ROADS",state:evidence("BLOCKED"),value:null,source_refs:[],reason:"No current source-bound centreline, width, gradient, manager or access geometry is captured."},
      {evidence_id:"EV_PROXIMITY_PRESENCE",domain:"PROXIMITY",state:evidence("VERIFIED"),value:"Schools, preschool, transit stop, grocery and nature/locality context",source_refs:["public official/operator pages observed 2026-08-18"],reason:"Locality presence only; each row retains its source and method."},
      {evidence_id:"EV_PROXIMITY_DISTANCE",domain:"PROXIMITY_DISTANCE",state:evidence("UNKNOWN"),value:null,source_refs:[],reason:"No facility-coordinate capture was authorized; no straight-line, route or travel-time values are asserted."},
      {evidence_id:"EV_PLANNING_LOCATOR",domain:"PLANNING",state:evidence("INDICATIVE"),value:"0581K-22D:1008 at municipal point locator",source_refs:["FINDING_SE_NOKA_EFFECTIVE_PLAN_LOCATOR"],reason:"Historic plan record is found, but present property mapping, amendment chain and exact legal effect remain unresolved."},
      {evidence_id:"EV_STRATEGIC_PLAN_STATUS",domain:"PLANNING",state:evidence("VERIFIED"),value:"2025 municipal plan adopted; 1984 Svärtinge plan continues; 2026 proposal is consultation draft",source_refs:["FINDING_SE_CURRENT_STRATEGIC_PLAN_STATUS"],reason:"Instrument states are kept distinct and none is promoted to property entitlement."},
      {evidence_id:"EV_ENTITLEMENT",domain:"ENTITLEMENT",state:evidence("BLOCKED"),value:null,source_refs:[],reason:"No property-specific governing interpretation or buildable envelope exists."},
      {evidence_id:"EV_MUNIN_REFERENCE",domain:"MUNIN_INTERFACE",state:evidence("UNKNOWN"),value:null,source_refs:[],reason:"No opaque Munin identifier is available and none is invented; payload count remains zero."}
    ],
    planning:{state:evidence("INDICATIVE"),governing_locator:{record:"0581K-22D:1008",type:"Avstyckningsplan",legal_force_date:"1936-05-26",current_property_mapping:"UNRESOLVED"},strategic_context:{municipality_wide_plan_adopted:"2025-12-15",svartinge_1984:"OUTDATED_BUT_CONTINUES_UNTIL_REPLACED",svartinge_2026:"CONSULTATION_DRAFT_NOT_ADOPTED"},entitlement_state:"BLOCKED",historic_signals_only:["one dwelling house per historic plot","approximately 3000 m2 original average plot pattern","historic 1:12 road-gradient signal","historic 40 m high-voltage corridor","open roadside drainage","water provision before sale or construction"],forbidden_inferences:["Current minimum plot size","Current building right","Current buildable envelope","Current access approval","Current utility capacity"]},
    hard_gates:[
      gate("LEGAL_BOUNDARY",["LEGAL_OR_CADASTRAL_BOUNDARY_RENDER","SETBACK_MEASUREMENT","BUILDABLE_ENVELOPE"],"NOKA map geometry has no legal effect and no authoritative cadastral vector or field survey is bound.",["FINDING_SE_NOKA_PROPERTY_LOCATOR_CONFIRMED"]),
      gate("TERRAIN",["TERRAIN_MESH","CONTOURS","SLOPE","DRAINAGE","FINISHED_FLOOR_LEVEL"],"The identified 1 m terrain asset returned HTTP 401; no raster bytes or derivations exist.",["FINDING_SE_HEIGHT_ITEM_AVAILABLE_NOT_FETCHED"]),
      gate("EXISTING_BUILDINGS",["BUILDING_FOOTPRINT_RENDER","HEIGHT_OR_STOREY_CLAIM","SHADOW_OR_OVERLOOK_ANALYSIS"],"No source-bound surrounding building geometry or height evidence has been captured.",[]),
      gate("ROAD_GEOMETRY",["ROAD_CENTERLINE_RENDER","ROAD_WIDTH_OR_GRADIENT","DRIVEWAY_DESIGN"],"The street name and historic plan context do not provide current surveyed road geometry.",[]),
      gate("PLANNING_AND_ENTITLEMENT",["ENTITLEMENT_CLAIM","BUILDABLE_ENVELOPE","H30_H50_ELIGIBILITY"],"The current property-to-historic-plan mapping, amendment chain and property-specific legal effect remain unresolved.",["FINDING_SE_NOKA_EFFECTIVE_PLAN_LOCATOR","FINDING_SE_CURRENT_STRATEGIC_PLAN_STATUS"]),
      gate("LEGAL_ACCESS",["LEGAL_ACCESS_PASS","DRIVEWAY_APPROVAL","CONSTRUCTION_ACCESS"],"Road proximity cannot prove servitude, road-manager consent, gradient or permitted access.",[]),
      gate("UTILITIES",["UTILITY_CAPACITY","CONNECTION_POINT","PAID_STATUS","CONSTRUCTION_CLEARANCE"],"Seller-reported VA status is not provider-confirmed and no utility-line case exists.",[]),
      gate("FLOOD_AND_DRAINAGE",["FLOOD_ABSENCE_CLAIM","DRAINAGE_DESIGN","SAFE_FLOOR_LEVEL"],"Point-only consultation-layer zero intersections cannot prove parcel-wide absence; terrain and local drainage are unresolved.",["FINDING_SE_DRAFT_FOP_POINT_CONTEXT"]),
      gate("SOIL_AND_GROUNDWATER",["FOUNDATION_SELECTION","INFILTRATION_DESIGN","CONTAMINATION_CLEARANCE"],"Glaciofluvial screening and nearby depth variability require plot-specific geotechnical, groundwater, radon, infiltration and contamination work.",["FINDING_SE_SOIL_GLACIOFLUVIAL","FINDING_SE_NEARBY_SOIL_DEPTH_VARIABILITY","FINDING_SE_EBH_CONTEXT_2KM"]),
      gate("HERITAGE_AND_ENVIRONMENT",["HERITAGE_CLEARANCE","PROTECTED_AREA_ABSENCE","SHORELINE_OR_WATER_PROTECTION_CLEARANCE"],"Nearby heritage records, inconclusive national services, water-protection and parcel-wide environmental intersections remain unresolved.",["FINDING_SE_HERITAGE_POINTS_500M","FINDING_SE_PROTECTED_SERVICE_INCONCLUSIVE","FINDING_SE_GLAN_WATER_PROTECTION_UNRESOLVED"])
    ],
    munin_interface:{mode:"OPAQUE_REFERENCES_ONLY",references:[],payload_persisted:false,forbidden_payload_domains:["PRICE","OWNER","LISTING","TRANSACTION","VALUATION","COMPARABLE","PERSONAL_RECORD"],state:"NO_OPAQUE_REFERENCE_AVAILABLE_NOT_INVENTED"},
    interface_stages:["REGION","NEIGHBOURHOOD","STREET","PLOT","BUILDING","UNIT","ROOM"],
    camera_lod_contract:[
      {mode:"NEIGHBOURHOOD_VIEW",stage_from:"REGION",stage_to:"NEIGHBOURHOOD",target:"coordinate_anchor",range_m:[250,5000],lod:"LOD0_CONTEXT_LABELS",allowed:["anchor","locality labels","evidence-state badges"],blocked:["terrain mesh","building footprints","legal parcel outline"]},
      {mode:"STREET_VIEW",stage_from:"NEIGHBOURHOOD",stage_to:"STREET",target:"subject street context",range_m:[50,500],lod:"LOD1_TEXT_AND_ANCHOR",allowed:["street name","verified locality context"],blocked:["invented road geometry","street-level imagery","building massing"]},
      {mode:"PLOT_ORBIT",stage_from:"STREET",stage_to:"PLOT",target:"area-equivalent uncertainty disc",range_m:[20,150],lod:"LOD2_INDICATIVE_DISC",allowed:["translucent notional disc","anchor","gate overlays"],blocked:["legal boundary","setbacks","terrain-derived levels","buildable envelope"]},
      {mode:"BUILDING_ORBIT_AND_ROOM_ENTRY",stage_from:"PLOT",stage_to:"ROOM",target:null,range_m:null,lod:"BLOCKED_NO_BUILDING_UNIT_ROOM_GEOMETRY",allowed:["blocked-state explanation"],blocked:["building orbit","unit entry","room entry"]}
    ],
    prototype_capabilities:{can_display:["regional/locality context","verified address/property locator","explicit CRS","translucent area-equivalent uncertainty disc","text-only street/neighbourhood character","source-labelled proximity register","planning chronology","hard-gate overlays"],cannot_display:["legal or surveyed parcel boundary","terrain, contours, slope or drainage","source-bound surrounding buildings or road geometry","buildable envelope or entitlement","legal access or utility routes","verified flood absence","building, unit or room geometry"]},
    evidence_summary:E
  };
  fs.writeFileSync(path.join(root,manifestPath),JSON.stringify(manifest,null,2)+"\n");
  return manifest;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const m=build();console.log(JSON.stringify({manifest:manifestPath,geometry:geometryPath,evidence_summary:m.evidence_summary,hard_gates:m.hard_gates.length},null,2));}
