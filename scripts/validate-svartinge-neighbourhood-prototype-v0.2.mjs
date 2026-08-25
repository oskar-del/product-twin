import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
import {deriveLiveContextView} from "../prototype/svartinge-neighbourhood/geographic-alignment.mjs";
import {validateOsmContext} from "./validate-svartinge-osm-context-v0.1.mjs";

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
const designStudiesPath="data/sites/sweden/saterdalsvagen-14/design-candidate-studies-v0.2.json";
const designStudiesSchemaPath="config/spatial/svartinge-design-candidate-studies-v0.2.schema.json";
const osmContextPath="data/sites/sweden/saterdalsvagen-14/osm-context-v0.1.json";
const osmContextSchemaPath="config/spatial/svartinge-osm-context-v0.1.schema.json";
const cellAvailabilityPath="data/sites/sweden/saterdalsvagen-14/neighbourhood-cell-availability-v0.1.json";
const visualAcceptancePath="data/sites/sweden/saterdalsvagen-14/visual-acceptance-v0.1.json";
const visualAcceptanceSchemaPath="config/spatial/svartinge-visual-acceptance-v0.1.schema.json";
const viewerPath="prototype/svartinge-neighbourhood/index.html";
const liveAdapterPath="prototype/svartinge-neighbourhood/live-context-adapter.mjs";
const serverPath="scripts/serve-svartinge-neighbourhood-prototype.mjs";
const builderPath="scripts/build-svartinge-neighbourhood-prototype-v0.2.mjs";
const CLASSES=["AUTHORITATIVE","INDICATIVE","DERIVED","REPORTED_UNVERIFIED","CONCEPT"];
const STEPS=["NEIGHBOURHOOD_VIEW","STREET_VIEW","PLOT_ORBIT","CONCEPT_HOUSE_ON_PLOT","BUILDING_ORBIT","ENTER_BUILDING","ROOM"];
const BLOCKED=["LEGAL_BOUNDARY","REGISTERED_AREA","ENTITLEMENT","BUILDABLE_ENVELOPE","LEGAL_ACCESS","UTILITY_CAPACITY","SURVEYED_TERRAIN","FINISHED_FLOOR_LEVEL"];
const PROVIDER_STATES=["CONNECTED","EXECUTABLE_NOT_TESTED","DOCUMENTED_NOT_CONNECTED","KEY_REQUIRED","RESEARCH_ONLY"];
const VISUAL_VIEW_IDS=["NEIGHBOURHOOD_ORBIT","STREET_APPROACH","PLOT_AND_TERRAIN","ARCHITECTURAL_CONCEPT_HERO","THREE_SCHEME_COMPARISON"];
const VISUAL_VIEW_BINDINGS={NEIGHBOURHOOD_ORBIT:["NEIGHBOURHOOD_VIEW","REALISTIC"],STREET_APPROACH:["STREET_VIEW","REALISTIC"],PLOT_AND_TERRAIN:["PLOT_ORBIT","REALISTIC"],ARCHITECTURAL_CONCEPT_HERO:["CONCEPT_HOUSE_ON_PLOT","REALISTIC"],THREE_SCHEME_COMPARISON:["CONCEPT_HOUSE_ON_PLOT","COMPARE"]};
const VISUAL_BLOCKERS=["INTERACTION_REVIEW_REQUIRED","PIXEL_REVIEW_REQUIRED","USER_APPROVAL_REQUIRED"];
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
function terrainHeight(x,z){return 2.2*(.008*x+.014*z+.55*Math.sin(x/38)*Math.cos(z/52));}
function bboxContains(bbox,point){return Array.isArray(bbox)&&bbox.length===4&&point[0]>=bbox[0]&&point[0]<=bbox[2]&&point[1]>=bbox[1]&&point[1]<=bbox[3];}
function pointInPolygon(x,z,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [xi,zi]=points[i],[xj,zj]=points[j],cross=(zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi;if(cross)inside=!inside;}return inside;}
function pointSegmentDistance2d(point,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],lengthSquared=dx*dx+dz*dz,t=lengthSquared?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dz)/lengthSquared)):0;return Math.hypot(point[0]-(a[0]+dx*t),point[1]-(a[1]+dz*t));}
function rotatedRectangleCorners(volume){const [x,z]=volume.position_xz_m,[width,,depth]=volume.size_whd_m,angle=volume.rotation_y_deg*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);return [[-width/2,-depth/2],[width/2,-depth/2],[width/2,depth/2],[-width/2,depth/2]].map(([dx,dz])=>[x+dx*c-dz*s,z+dx*s+dz*c]);}

export function validatePlotTerrainViewer(html){
  const errors=[];let assertions=0;const check=(ok,msg)=>{assertions++;if(!ok)errors.push(msg);};
  const start=html.indexOf("function terrainStudySprite"),end=html.indexOf("function architecturalMesh"),section=start>=0&&end>start?html.slice(start,end):"";
  check(section.includes("function buildPlotTerrainStudy")&&section.includes("function contourCellSegments")&&section.includes("interval=.5")&&section.includes("segmentCount"),"plot terrain relative contour geometry missing");
  check(section.includes("function clipSegmentToPlot")&&section.includes("segmentIntersectionParameter")&&section.includes("clipSegmentToPlot(a,b,points)"),"plot terrain contours are not clipped to the indicative display polygon");
  check(html.includes("plotTerrainStudyGroup.userData.evidenceClass='DERIVED_RELATIVE_UNCALIBRATED'")&&section.includes("0.5 M RELATIVE CONTOURS · NO RH2000 LEVEL")&&!section.includes("OFFICIAL CONTOURS"),"plot terrain evidence classification promoted or official level claimed");
  check(html.includes("plotTerrainStudyGroup.visible=stage.id==='PLOT_ORBIT'&&Boolean(terrainObject?.visible)")&&html.includes("terrainObject.visible);setMode(mode)"),"plot terrain study scope or terrain-toggle coupling drift");
  check(section.includes("HIGH · +")&&section.includes("LOW · 0.0 M DISPLAY")&&section.includes("displayReliefM"),"plot terrain high/low reading missing or unqualified");
  check(section.includes("new THREE.LineSegments")&&!section.includes("new THREE.PointLight")&&!section.includes("EffectComposer"),"plot terrain study adds a heavy lighting or post-processing path");
  return {ok:errors.length===0,assertions,errors};
}

export function validateTerrainShadingViewer(html){
  const errors=[];let assertions=0;const check=(ok,msg)=>{assertions++;if(!ok)errors.push(msg);};
  const start=html.indexOf("function terrain(item,g)"),end=html.indexOf("function footprint"),section=start>=0&&end>start?html.slice(start,end):"";
  check(html.includes("sun.shadow.bias=-.00035")&&html.includes("sun.shadow.normalBias=.12"),"directional shadow acne controls are missing or drifted");
  check(html.includes("sun.shadow.camera.near=2")&&html.includes("sun.shadow.camera.far=520"),"directional shadow depth range is not bounded for the neighbourhood scene");
  check(section.includes("geo.computeVertexNormals()")&&section.includes("mesh.castShadow=false")&&section.includes("mesh.receiveShadow=true"),"terrain shading can self-shadow or lose smooth derived relief");
  check(!section.includes("flatShading:true")&&!section.includes("WireframeGeometry"),"terrain surface reintroduced faceting or mesh-line moire");
  check(html.includes("polygonOffset:true,polygonOffsetFactor:-1")&&html.includes("position.setXYZ(i,x,groundY(x,z)+.075,z)"),"realistic aerial drape can z-fight with the derived terrain");
  return {ok:errors.length===0,assertions,errors};
}

export function validateStreetApproachViewer(html){
  const errors=[];let assertions=0;const check=(ok,msg)=>{assertions++;if(!ok)errors.push(msg);};
  const start=html.indexOf("function addStreetDetail"),end=html.indexOf("function addSky"),section=start>=0&&end>start?html.slice(start,end):"";
  check(section.includes("source_name?.toLocaleLowerCase('sv-SE')==='säterdalsvägen'")&&section.includes("visualRibbon(road.geometry.points"),"street approach source-road treatment missing");
  check(html.includes("STREET_VIEW:44"),"street approach camera FOV drift");
  check(html.includes("SÄTERDALSVÄGEN STREET ROOM · SOURCE-BOUND ROAD APPROACH · FRONTAGE + LEGAL ACCESS UNVERIFIED"),"street approach evidence caption missing or promoted");
  check(html.includes("stageLabelsAllowed=!['STREET_VIEW','PLOT_ORBIT','CONCEPT_HOUSE_ON_PLOT'].includes(s.id)")&&html.includes("poiGroup.visible=poisEnabled&&!realistic"),"street approach labels or POIs obscure the primary subject");
  check(html.includes("plotBeacon.visible=realistic&&plotBeaconEnabled&&allowed.has('PLOT')"),"street approach plot locator missing");
  check(html.includes("OrbitControls")&&!html.includes("realistic-plate")&&!html.includes("scene.background=backplate"),"street approach is not continuously orbitable 3D");
  return {ok:errors.length===0,assertions,errors};
}

export function validateNeighbourhoodDetailViewer(html){
  const errors=[];let assertions=0;const check=(ok,msg)=>{assertions++;if(!ok)errors.push(msg);};
  const start=html.indexOf("function contextInstanceMatrix"),end=html.indexOf("function addStreetDetail"),section=start>=0&&end>start?html.slice(start,end):"";
  check(section.includes("function addHouseDetails")&&section.includes("item.type==='CONTEXT_BUILDING'")&&section.includes("g.points_xz")&&section.includes("footprintBounds(points)"),"nearby building detail is not source-footprint bound");
  check(section.includes("new THREE.InstancedMesh")&&section.includes("entry.distance<210")&&section.includes("slice(0,36)"),"nearby building detail is not performance bounded");
  check(section.includes("trimTransforms")&&section.includes("glassTransforms")&&section.includes("doorTransforms")&&section.includes("chimneyTransforms")&&section.includes("window_count:glassTransforms.length"),"nearby building façade character is incomplete");
  check(section.includes("userData.visualOnly=true")&&section.includes("userData.evidenceEffect='NONE'"),"nearby building detail can promote or masquerade as evidence");
  check(html.includes("Nearby windows, doors, trim and chimneys are visual-only street-room character generated from source footprints; they are not observed building details."),"nearby building detail limitation missing or promoted");
  check(!section.includes("new THREE.PointLight")&&!section.includes("EffectComposer"),"nearby building detail added a heavy lighting or post-processing path");
  return {ok:errors.length===0,assertions,errors};
}

export function validateContextBuildingLodViewer(html){
  const errors=[];let assertions=0;const check=(ok,msg)=>{assertions++;if(!ok)errors.push(msg);};
  const start=html.indexOf("function footprint(item,g)"),end=html.indexOf("function surfacePolygon"),section=start>=0&&end>start?html.slice(start,end):"";
  check(html.includes("contextRoofLodEntries=[]")&&section.includes("distance<330")&&section.includes("else if(distance<650)contextRoofLodEntries.push"),"context-building roof LOD bands are missing or overlap");
  check(section.includes("footprintBounds(g.points_xz)")&&section.includes("sourceFootprintGeometry(g.points_xz,g.height_m)")&&section.includes("sourceGeometry='OSM_FOOTPRINT_BOUNDS'"),"middle-distance roof LOD is not source-footprint bound");
  check(section.includes("new THREE.InstancedMesh")&&section.includes("gableRoofGeometry(1,1,1)")&&section.includes("matrix.compose(position,quaternion,scale)")&&section.includes("mesh.instanceMatrix.needsUpdate=true"),"middle-distance roof LOD is not deterministically instanced");
  check(section.includes("mesh.userData.visualOnly=true")&&section.includes("mesh.userData.evidenceEffect='NONE'")&&section.includes("lodBand='MID_330_650_M'"),"context roof LOD can masquerade as observed building evidence");
  check(section.includes("mesh.castShadow=false")&&section.includes("mesh.receiveShadow=false")&&!section.includes("new THREE.PointLight")&&!section.includes("EffectComposer"),"middle-distance roof LOD exceeds the bounded rendering budget");
  check(html.includes("function buildRealismDecor(){addSky();mountContextRoofLod();")&&html.includes("Middle-distance gable caps are visual-only LOD derived from source-footprint bounds; they do not assert observed roof form or height."),"context roof LOD is not mounted or disclosed");
  return {ok:errors.length===0,assertions,errors};
}

export function validateArchitecturalHeroViewer(html){
  const errors=[];let assertions=0;const check=(ok,msg)=>{assertions++;if(!ok)errors.push(msg);};
  const start=html.indexOf("function architecturalMesh"),end=html.indexOf("function updateDesignSelectionUI"),section=start>=0&&end>start?html.slice(start,end):"";
  check(section.includes("function addArchitecturalOpening")&&section.includes("facade_rhythm==='PANORAMIC_BAYS'")&&section.includes("rotationYDeg"),"architectural hero lacks façade depth or side-opening articulation");
  check(section.includes("function addRoofSeams")&&section.includes("profile.roof_form==='MONO_PITCH'")&&section.includes("metalness:.38"),"architectural hero roof expression lacks lightweight construction depth");
  check(html.includes("function timberDeckTexture")&&section.includes("texture:surfaceTextures.deck")&&section.includes("function addConceptPlanter"),"architectural hero outdoor-room material or concept planting threshold missing");
  check(html.includes("function verticalTimberTexture")&&section.includes("texture:surfaceTextures.verticalTimber"),"architectural hero lacks legible Nordic vertical-timber façade character");
  check(section.includes("function addArchitecturalEnvelopeDepth")&&section.includes("envelopeDepth='CONCEPT_PRESENTATION_ONLY'")&&section.includes("addArchitecturalEnvelopeDepth(assembly"),"architectural hero envelope lacks corner, shadow-gap or fascia depth");
  check(section.includes("function addConceptRailing")&&section.includes("function addConceptSteps")&&section.includes("unit.userData.evidenceEffect='NONE'"),"architectural hero deck edge or arrival transition remains unresolved");
  check(html.includes("CONCEPT_HOUSE_ON_PLOT:35")&&html.includes("camera.setViewOffset(width+dockReserve")&&html.includes("mode!=='COMPARE'"),"architectural hero framing does not reserve the design panel or preserve comparison framing");
  check(html.includes("plotAnalyticalCue")&&html.includes("isPlotBeaconFill")&&html.includes("candidatePreview?.035:.1")&&html.includes("depthTest:true"),"architectural hero is obscured by analytical plot overlays");
  check(html.includes("currentSiteClutter")&&html.includes("realistic&&!candidatePreview")&&!section.includes("new THREE.PointLight")&&!section.includes("EffectComposer"),"architectural hero clutter isolation or performance boundary missing");
  return {ok:errors.length===0,assertions,errors};
}

export function validateArchitecturalIntentViewer(html){
  const errors=[];let assertions=0;const check=(ok,msg)=>{assertions++;if(!ok)errors.push(msg);};
  const start=html.indexOf("function candidateLocalPoint"),end=html.indexOf("function updateDesignSelectionUI"),section=start>=0&&end>start?html.slice(start,end):"";
  check(section.includes("function buildCandidateIntent")&&section.includes(");buildCandidateIntent(candidate,group);")&&section.includes("new THREE.ArrowHelper")&&section.includes("candidateFootprintPoints(volume)"),"architectural intent layer is missing from the orbitable concepts");
  check(section.includes("formIntent.userData.intentLens='FORM'")&&section.includes("formIntent.userData.evidenceClass='CONCEPT'")&&section.includes("arrival.distanceTo(door)"),"concept arrival intent is missing or promoted");
  check(section.includes("landIntent.userData.intentLens='LAND'")&&section.includes("landIntent.userData.evidenceClass='DERIVED_RELATIVE_UNCALIBRATED'")&&section.includes("volume.display_level_offset_m+.31"),"relative ground intent is missing or promoted as surveyed");
  check(section.includes("reportedViewAzimuth")&&section.includes("viewArrow.userData.evidenceClass='REPORTED_UNVERIFIED'")&&section.includes("185"),"reported view intent is missing or promoted");
  check(html.includes("candidateSolarArrows.forEach(arrow=>arrow.setDirection(solarDirection))")&&section.includes("solarArrow.userData.solarDirectionDynamic=true")&&section.includes("'LIVING','DERIVED'"),"derived solar intent does not follow the sun study");
  check(html.includes("o.userData.intentLens===comparisonLensId")&&html.includes("mode!=='COMPARE'")&&html.includes("renderComparisonCards();applyProfile(mode)"),"comparison lenses do not control the synchronized 3D intent overlays");
  check(html.includes("ARRIVAL · CONCEPT")&&html.includes("GROUND · DERIVED RELATIVE")&&html.includes("SUN · DERIVED")&&html.includes("VIEW · REPORTED")&&html.includes("INTENT OVERLAYS DO NOT VERIFY VIEW, SOLAR PERFORMANCE, ACCESS OR FINISHED LEVELS"),"architectural intent evidence disclosure is missing or promoted");
  check(section.includes("userData.evidenceEffect='NONE'")&&!section.includes("new THREE.PointLight")&&!section.includes("EffectComposer"),"architectural intent overlays can affect evidence or add a heavy rendering path");
  return {ok:errors.length===0,assertions,errors};
}

export function validateArchitecturalComparisonViewer(html){
  const errors=[];let assertions=0;const check=(ok,msg)=>{assertions++;if(!ok)errors.push(msg);};
  const start=html.indexOf("const comparisonLensNotes"),end=html.indexOf("function pineTree"),section=start>=0&&end>start?html.slice(start,end):"";
  check(html.includes('id="comparisonLens"')&&html.includes('data-lens="FORM"')&&html.includes('data-lens="LAND"')&&html.includes('data-lens="LIVING"'),"architectural comparison lenses missing or incomplete");
  check(section.includes("comparisonLensId==='LAND'")&&section.includes("terrain_response_expression")&&section.includes("display_level_offset_m")&&section.includes("no surveyed level"),"architectural comparison land lens is incomplete or over-promoted");
  check(section.includes("comparisonLensId==='LIVING'")&&section.includes("outdoor_room_type")&&section.includes("south_glazing_modules")&&section.includes("view performance remain unverified"),"architectural comparison living lens is incomplete or over-promoted");
  check(section.includes("function renderComparisonCards")&&section.includes("UNRANKED · CONCEPT")&&section.includes("SAME PLOT / CAMERA")&&section.includes("candidate.footprint_m2"),"architectural comparison cards are not manifest-driven or truthfully disclosed");
  check(section.includes("REVIEW ${candidate.label.split('·')[0].trim()} IN FULL 3D")&&section.includes("setActiveCandidate(candidate.candidate_id);setMode('REALISTIC')")&&!section.includes("sessionSelectedCandidateId=candidate.candidate_id"),"architectural comparison cannot return to a full 3D review without silently selecting a scheme");
  check(html.includes("comparisonLens.classList.toggle('hidden',!conceptComparison)")&&html.includes("schemeCompareLabels.classList.toggle('hidden',!conceptComparison)")&&html.includes("designDock.classList.toggle('hidden',!conceptStudy||conceptComparison)"),"architectural comparison overlays are not isolated to the concept comparison stage");
  check(html.includes("conceptComparison?3:2")&&html.includes("paneIndex=Math.min(paneCount-1")&&html.includes("Math.floor(e.clientX/paneWidth)"),"architectural comparison pointer mapping does not respect the three synchronized viewports");
  check(html.includes("THREE ORBITABLE ARCHITECTURAL CONCEPTS · SAME PLOT · SAME CAMERA")&&html.includes("innerWidth/3")&&html.includes("CONCEPT_HOUSE_ON_PLOT'?50:62")&&!section.includes("new THREE.PointLight")&&!section.includes("EffectComposer"),"architectural comparison framing, orbitability or performance boundary drift");
  return {ok:errors.length===0,assertions,errors};
}

export function validateDesignCandidateStudies(studies,{scene=read(scenePath),repoRoot=root}={}){
  const errors=[];let assertions=0;const check=(ok,msg)=>{assertions++;if(!ok)errors.push(msg);};
  exactKeys(studies,["schema_version","entity_type","subject","scene_ref","coordinate_frame","linear_units","study_state","policy","intent_pipeline","candidates"],"design candidate studies",check);
  check(studies.schema_version==="svartinge-design-candidate-studies/v0.2"&&studies.entity_type==="DesignCandidateStudySet"&&studies.subject==="SVÄRTINGE 54:28","design candidate identity drift");
  exactKeys(studies.scene_ref,["scene_id","scene_version","path"],"design scene ref",check);
  check(studies.scene_ref?.scene_id===scene.scene_id&&studies.scene_ref?.scene_version===scene.scene_version&&studies.scene_ref?.path===scenePath,"design candidate scene binding drift");
  check(studies.coordinate_frame==="LOCAL_ENU"&&studies.linear_units==="metre"&&studies.study_state==="CONCEPT_CANDIDATES_UNSELECTED","design candidate frame or state promoted");
  const policy=studies.policy??{};exactKeys(policy,["candidate_evidence_class","selected_candidate_id","legal_effect","geometry_scope","display_terrain_basis","blocked_claims"],"design candidate policy",check);
  check(policy.candidate_evidence_class==="CONCEPT"&&policy.selected_candidate_id===null&&policy.legal_effect==="NONE"&&policy.geometry_scope==="CONCEPT_PRESENTATION_GEOMETRY","design candidate policy promoted");
  check(policy.display_terrain_basis==="DERIVED_RELATIVE_UNCALIBRATED"&&JSON.stringify(policy.blocked_claims)===JSON.stringify(BLOCKED),"design candidate hard gates changed");
  const pipeline=studies.intent_pipeline??{};exactKeys(pipeline,["user_design_intent","hard_constraints","soft_objectives","ranking_state","explicit_selection_required"],"design intent pipeline",check);
  check(pipeline.user_design_intent?.length>=3&&pipeline.hard_constraints?.length>=3&&pipeline.soft_objectives?.length>=3&&pipeline.ranking_state==="NOT_RANKED_INSUFFICIENT_EVIDENCE"&&pipeline.explicit_selection_required===true,"design intent pipeline incomplete or falsely ranked");
  const plot=scene.elements?.find(item=>item.id==="PLOT_54_28")?.geometry?.points_xz??[],candidates=studies.candidates??[],expected=["COURTYARD_EDGE","SPLIT_TERRACE","VIEW_BAR"];
  check(candidates.length===3&&JSON.stringify(candidates.map(item=>item.candidate_id).sort())===JSON.stringify(expected),"design candidate set drift");
  const volumeIds=new Set();for(const candidate of candidates){
    exactKeys(candidate,["candidate_id","label","summary","evidence_class","footprint_m2","concept_storeys","approx_gross_floor_area_m2","presentation_profile","volumes","design_signals"],candidate.candidate_id??"candidate",check);
    check(candidate.evidence_class==="CONCEPT"&&candidate.concept_storeys===1&&candidate.design_signals?.length>=4,`${candidate.candidate_id}: concept evidence or signals invalid`);
    const presentation=candidate.presentation_profile??{};exactKeys(presentation,["architectural_language","roof_form","wall_finish","roof_finish","roof_rise_m","terrace_depth_m","south_glazing_modules","arrival_expression","outdoor_room_type","terrain_response_expression","facade_rhythm","presentation_only"],`${candidate.candidate_id} presentation`,check);
    check(["NORDIC_VIEW_HOUSE_CONCEPT","NORDIC_COURTYARD_HOUSE_CONCEPT","NORDIC_SPLIT_LEVEL_CONCEPT"].includes(presentation.architectural_language)&&["SHALLOW_GABLE","CROSS_GABLE","MONO_PITCH"].includes(presentation.roof_form)&&["LIGHT_TIMBER_CONCEPT","NATURAL_TIMBER_CONCEPT","SAGE_TIMBER_CONCEPT"].includes(presentation.wall_finish)&&["CHARCOAL_METAL_CONCEPT","OXIDE_METAL_CONCEPT"].includes(presentation.roof_finish)&&["RECESSED_PORCH","COURTYARD_PORTAL","GLAZED_LINK"].includes(presentation.arrival_expression)&&["LINEAR_VIEW_DECK","SHELTERED_COURTYARD","STEPPED_TERRACES"].includes(presentation.outdoor_room_type)&&["LOW_CONTINUOUS_PLINTH","TWIN_LEVEL_PLINTH","STEPPED_PLINTH"].includes(presentation.terrain_response_expression)&&["PANORAMIC_BAYS","COURTYARD_ARCADE","STAGGERED_BAYS"].includes(presentation.facade_rhythm)&&presentation.presentation_only===true,`${candidate.candidate_id}: architectural presentation profile promoted or invalid`);
    check(Number.isFinite(presentation.roof_rise_m)&&presentation.roof_rise_m>=.6&&presentation.roof_rise_m<=2&&Number.isFinite(presentation.terrace_depth_m)&&presentation.terrace_depth_m>=0&&presentation.terrace_depth_m<=3&&Number.isInteger(presentation.south_glazing_modules)&&presentation.south_glazing_modules>=1&&presentation.south_glazing_modules<=4,`${candidate.candidate_id}: architectural presentation dimensions invalid`);
    let footprint=0;for(const volume of candidate.volumes??[]){
      exactKeys(volume,["volume_id","position_xz_m","size_whd_m","rotation_y_deg","display_level_offset_m"],volume.volume_id??"candidate volume",check);
      check(Boolean(volume.volume_id&&!volumeIds.has(volume.volume_id)),`${candidate.candidate_id}: missing or duplicate volume id`);volumeIds.add(volume.volume_id);
      check(Array.isArray(volume.position_xz_m)&&volume.position_xz_m.length===2&&Array.isArray(volume.size_whd_m)&&volume.size_whd_m.length===3&&volume.size_whd_m.every(value=>Number.isFinite(value)&&value>0),`${volume.volume_id}: invalid massing dimensions`);
      footprint+=volume.size_whd_m?.[0]*volume.size_whd_m?.[2];
      check(rotatedRectangleCorners(volume).every(([x,z])=>pointInPolygon(x,z,plot)),`${volume.volume_id}: preview massing leaves indicative display polygon`);
      if(presentation.terrace_depth_m>0){const [x,z]=volume.position_xz_m,[width,,depth]=volume.size_whd_m,angle=volume.rotation_y_deg*Math.PI/180,dz=-(depth+presentation.terrace_depth_m)/2,terrace={position_xz_m:[x-dz*Math.sin(angle),z+dz*Math.cos(angle)],size_whd_m:[width*.92,.16,presentation.terrace_depth_m],rotation_y_deg:volume.rotation_y_deg};check(rotatedRectangleCorners(terrace).every(([tx,tz])=>pointInPolygon(tx,tz,plot)),`${volume.volume_id}: concept terrace leaves indicative display polygon`);}
      check(Number.isFinite(volume.display_level_offset_m)&&Math.abs(volume.display_level_offset_m)<=5,`${volume.volume_id}: invalid display level offset`);
    }
    check(Math.abs(footprint-candidate.footprint_m2)<1e-9&&candidate.approx_gross_floor_area_m2===candidate.footprint_m2,`${candidate.candidate_id}: footprint or concept GFA drift`);
  }
  check(new Set(candidates.map(candidate=>candidate.presentation_profile.roof_form)).size===3,"design candidates do not exercise three distinct roof strategies");
  const levelCounts=Object.fromEntries(candidates.map(candidate=>[candidate.candidate_id,new Set(candidate.volumes.map(volume=>volume.display_level_offset_m)).size]));
  check(levelCounts.VIEW_BAR===1&&levelCounts.COURTYARD_EDGE===2&&levelCounts.SPLIT_TERRACE===2,"concept terrain-response geometry drift");
  for(const field of ["arrival_expression","outdoor_room_type","terrain_response_expression","facade_rhythm"])check(new Set(candidates.map(candidate=>candidate.presentation_profile[field])).size===3,`design candidates do not exercise three distinct ${field} strategies`);
  check(walk(studies,"designStudies").length===0,"design candidate set contains forbidden external facts");
  const schema=read(designStudiesSchemaPath,repoRoot);check(schema.additionalProperties===false&&schema.properties?.schema_version?.const==="svartinge-design-candidate-studies/v0.2","strict design candidate schema missing");
  return {ok:errors.length===0,assertions,errors};
}

export function validateVisualAcceptance(acceptance,{scene=read(scenePath),repoRoot=root}={}){
  const errors=[];let assertions=0;const check=(ok,msg)=>{assertions++;if(!ok)errors.push(msg);};
  exactKeys(acceptance,["schema_version","entity_type","subject","scene_ref","viewer_ref","review_state","policy","canonical_views","user_approval"],"visual acceptance",check);
  check(acceptance.schema_version==="svartinge-visual-acceptance/v0.1"&&acceptance.entity_type==="SpatialTwinVisualAcceptance"&&acceptance.subject==="SVÄRTINGE 54:28","visual acceptance identity drift");
  exactKeys(acceptance.scene_ref,["scene_id","scene_version","path","sha256"],"visual acceptance scene ref",check);
  check(acceptance.scene_ref?.scene_id===scene.scene_id&&acceptance.scene_ref?.scene_version===scene.scene_version&&acceptance.scene_ref?.path===scenePath,"visual acceptance scene binding drift");
  check(/^[a-f0-9]{64}$/.test(acceptance.scene_ref?.sha256??"")&&acceptance.scene_ref?.sha256===shaAt(repoRoot,scenePath),"visual acceptance scene hash mismatch");
  exactKeys(acceptance.viewer_ref,["path","sha256"],"visual acceptance viewer ref",check);
  check(acceptance.viewer_ref?.path===viewerPath&&/^[a-f0-9]{64}$/.test(acceptance.viewer_ref?.sha256??"")&&acceptance.viewer_ref?.sha256===shaAt(repoRoot,viewerPath),"visual acceptance viewer binding or hash mismatch");
  const policy=acceptance.policy??{};exactKeys(policy,["automated_visual_approval_allowed","explicit_user_approval_required","actual_product_resolution_required","browser_security_workarounds_allowed","completion_gate"],"visual acceptance policy",check);
  check(policy.automated_visual_approval_allowed===false&&policy.explicit_user_approval_required===true&&policy.actual_product_resolution_required===true&&policy.browser_security_workarounds_allowed===false&&policy.completion_gate==="ALL_FIVE_CANONICAL_VIEWS_EXPLICITLY_APPROVED","visual acceptance policy weakened");
  const views=acceptance.canonical_views??[];check(views.length===5&&JSON.stringify(views.map(view=>view.view_id))===JSON.stringify(VISUAL_VIEW_IDS),"five-view visual acceptance set incomplete or reordered");
  let approved=0;
  for(const view of views){
    exactKeys(view,["view_id","label","navigation_stage_id","renderer_mode","acceptance_state","acceptance_criteria","review_evidence","blockers"],view.view_id??"visual view",check);
    const binding=VISUAL_VIEW_BINDINGS[view.view_id]??[];check(view.navigation_stage_id===binding[0]&&view.renderer_mode===binding[1],`${view.view_id}: canonical stage or renderer mode drift`);
    check(["PENDING_USER_REVIEW","APPROVED","REJECTED"].includes(view.acceptance_state)&&Array.isArray(view.acceptance_criteria)&&view.acceptance_criteria.length>=3&&new Set(view.acceptance_criteria).size===view.acceptance_criteria.length,`${view.view_id}: acceptance criteria or state invalid`);
    const evidence=view.review_evidence??{};exactKeys(evidence,["artifact_path","artifact_sha256","reviewed_at","reviewer","notes"],`${view.view_id} review evidence`,check);
    if(view.acceptance_state==="APPROVED"){
      approved++;
      check(evidence.reviewer==="USER"&&typeof evidence.reviewed_at==="string"&&typeof evidence.artifact_path==="string"&&fs.existsSync(path.join(repoRoot,evidence.artifact_path))&&/^[a-f0-9]{64}$/.test(evidence.artifact_sha256??"")&&shaAt(repoRoot,evidence.artifact_path)===evidence.artifact_sha256&&view.blockers?.length===0,`${view.view_id}: approval lacks user-reviewed visual artifact`);
    }else{
      check(evidence.artifact_path===null&&evidence.artifact_sha256===null&&evidence.reviewed_at===null&&evidence.reviewer===null&&JSON.stringify([...(view.blockers??[])].sort())===JSON.stringify(VISUAL_BLOCKERS),`${view.view_id}: pending visual state lost required blockers or invented review evidence`);
    }
  }
  const expectedState=approved===5?"APPROVED":approved===0?"PENDING_USER_REVIEW":"PARTIALLY_APPROVED";check(acceptance.review_state===expectedState,"visual acceptance aggregate state is inconsistent");
  if(expectedState==="APPROVED"){
    const user=acceptance.user_approval??{};exactKeys(user,["confirmation","reviewed_at","approved_view_ids"],"visual user approval",check);check(user.confirmation==="APPROVED_BY_USER"&&typeof user.reviewed_at==="string"&&JSON.stringify(user.approved_view_ids)===JSON.stringify(VISUAL_VIEW_IDS),"explicit five-view user approval missing");
  }else check(acceptance.user_approval===null,"user approval was invented before all five views passed");
  const schema=read(visualAcceptanceSchemaPath,repoRoot);check(schema.additionalProperties===false&&schema.properties?.schema_version?.const==="svartinge-visual-acceptance/v0.1","strict visual acceptance schema missing");
  return {ok:errors.length===0,assertions,errors};
}

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
  check(Math.abs(scene.measurements?.municipal_export_computed_area_m2?.value-1938.1989135742188)<=.001&&scene.measurements?.municipal_export_computed_area_m2?.evidence_class==="INDICATIVE","municipal export area invalid");
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
  check(plot?.geometry?.points_xz?.length===6&&plot?.source_refs?.some(ref=>ref.endsWith("municipal-property-boundary-epsg3010-v0.1.json")),"plot is not bound to the six-segment municipal property export");
  check(plot?.limitations?.some(limit=>/no legal effect/i.test(limit))&&plot?.limitations?.some(limit=>/may be misleading/i.test(limit)),"plot legal limitation missing");
  check(plot?.limitations?.some(x=>x.includes("no legal effect")),"plot legal limitation missing");
  const terrain=elements.find(x=>x.id==="TERRAIN_CONTEXT");check(terrain?.evidence_class==="DERIVED"&&terrain?.geometry?.height_reference==="LOCAL_RELATIVE_UNCALIBRATED","terrain promoted or unlabelled");
  check(terrain?.geometry?.size_m===1800&&terrain?.geometry?.segments===120&&terrain?.geometry?.vertices?.length===14641,"terrain mesh does not cover the 900 m source-bound context cell");
  check(terrain?.geometry?.visual_relief_exaggeration===2.2&&terrain?.geometry?.method?.includes("VISUAL_RELIEF_X2_2")&&terrain?.geometry?.method?.includes("no RH2000 elevation"),"visual terrain relief disclosure missing");
  const osmContext=fs.existsSync(path.join(repoRoot,osmContextPath))?read(osmContextPath,repoRoot):null;
  const osmRoadById=new Map((osmContext?.compiled?.roads??[]).map(item=>[item.feature_id,item]));
  const osmBuildingById=new Map((osmContext?.compiled?.buildings??[]).map(item=>[item.feature_id,item]));
  const osmLandById=new Map([...(osmContext?.compiled?.landcover??[]),...(osmContext?.compiled?.water??[]),...(osmContext?.compiled?.waterways??[])].map(item=>[item.feature_id,item]));
  const contextBuildings=elements.filter(x=>x.type==="CONTEXT_BUILDING");
  check(contextBuildings.length>=700&&contextBuildings.every(x=>x.evidence_class==="DERIVED"&&x.geometry?.primitive==="EXTRUDED_FOOTPRINT"),"source-bound context building coverage incomplete or promoted");
  check(contextBuildings.every(item=>{const source=osmBuildingById.get(item.id);return source&&JSON.stringify(item.geometry.points_xz)===JSON.stringify(source.points_xz)&&item.geometry.height_m===source.display_height_m&&item.geometry.height_method===source.height_method&&item.geometry.source_way_id===source.osm_way_id&&item.source_refs.includes(osmContextPath);}),"context building footprint or height diverges from source artifact");
  const roads=elements.filter(x=>x.type==="ROAD"),namedRoads=new Set(roads.map(item=>item.geometry?.source_name).filter(Boolean).map(name=>name.toLocaleLowerCase("sv-SE")));
  check(roads.length>=150&&roads.every(x=>x.evidence_class==="DERIVED"&&x.geometry?.primitive==="POLYLINE_RIBBON")&&namedRoads.size>=10&&namedRoads.has("säterdalsvägen"),"ten-street source-bound road context incomplete or promoted");
  check(roads.every(item=>{const source=osmRoadById.get(item.id);return source&&JSON.stringify(item.geometry.points.map(([x,,z])=>[x,z]))===JSON.stringify(source.points_xz)&&item.geometry.width_m===source.display_width_m&&item.geometry.source_way_id===source.osm_way_id&&item.geometry.width_method===source.width_method&&item.source_refs.includes(osmContextPath)&&item.geometry.points.every(([x,y,z])=>Math.abs(y-(terrainHeight(x,z)+.04))<.001);}),"road ribbon diverges from source artifact or display terrain");
  const landcover=elements.filter(x=>x.type==="LANDCOVER"),water=elements.filter(x=>x.type==="WATER"),waterways=elements.filter(x=>x.type==="WATERWAY");
  check(landcover.length===(osmContext?.compiled?.landcover?.length??-1)&&water.length===(osmContext?.compiled?.water?.length??-1)&&waterways.length===(osmContext?.compiled?.waterways?.length??-1),"source-bound land or water context incomplete");
  check([...landcover,...water,...waterways].every(item=>item.evidence_class==="DERIVED"&&osmLandById.has(item.id)&&item.source_refs.includes(osmContextPath)),"land or water context diverges from OpenStreetMap source artifact");
  const osmBinding=scene.source_bindings?.find(binding=>binding.path===osmContextPath);
  check(osmBinding?.role==="OPENSTREETMAP_CONTEXT_GEOMETRY_NON_OFFICIAL_ODBL"&&/^[a-f0-9]{64}$/.test(osmBinding?.sha256??""),"OpenStreetMap source binding or non-official scope missing");
  check(elements.filter(x=>["CONCEPT_BUILDING","ROOM","OPENING","FURNITURE"].includes(x.type)).length>=10&&elements.filter(x=>["CONCEPT_BUILDING","ROOM","OPENING","FURNITURE"].includes(x.type)).every(x=>x.evidence_class==="CONCEPT"),"concept building/room geometry missing or promoted");
  check(elements.find(x=>x.id==="VIEW_GLAN")?.evidence_class==="REPORTED_UNVERIFIED","reported view promoted");
  const pois=elements.filter(x=>x.type==="POI");check(pois.length>=6,"POI layer incomplete");check(pois.every(x=>x.evidence_class==="INDICATIVE"&&x.geometry?.placement_method==="DIAGRAMMATIC_NOT_GEOGRAPHIC"&&x.geometry?.distance_m===null),"POI position promoted or coordinate/distance invented");
  check(scene.studies?.solar?.evidence_class==="DERIVED"&&scene.studies?.views?.evidence_class==="REPORTED_UNVERIFIED","study evidence class invalid");
  check(scene.project_status?.design_scenario==="CONCEPT_VISUALISATION_ACTIVE_LEGAL_GATES_OPEN"&&scene.project_status?.selected_house_profile===null,"concept scenario status promoted");
  const plotPoints=plot?.geometry?.points_xz??[],plotCenter=plotPoints.reduce((sum,[x,z])=>[sum[0]+x/plotPoints.length,sum[1]+z/plotPoints.length],[0,0]);
  const neighbourhoodStage=scene.navigation?.find(x=>x.id==="NEIGHBOURHOOD_VIEW");check(Math.hypot(neighbourhoodStage?.target?.[0]-plotCenter[0],neighbourhoodStage?.target?.[2]-plotCenter[1])<=5,"neighbourhood camera does not target subject plot");
  const streetStage=scene.navigation?.find(x=>x.id==="STREET_VIEW"),streetEye=streetStage?.camera?.[1]-terrainHeight(streetStage?.camera?.[0],streetStage?.camera?.[2]),streetTargetEye=streetStage?.target?.[1]-terrainHeight(streetStage?.target?.[0],streetStage?.target?.[2]),streetHorizontal=Math.hypot(streetStage?.camera?.[0]-streetStage?.target?.[0],streetStage?.camera?.[2]-streetStage?.target?.[2]);
  check(streetEye>=1.65&&streetEye<=1.85&&streetTargetEye>=1.5&&streetTargetEye<=1.8,"street camera is not at a credible local eye height");
  check(streetHorizontal>=35&&streetHorizontal<=60,"street approach does not frame the plot at arrival scale");
  check(pointInPolygon(streetStage?.target?.[0],streetStage?.target?.[2],plotPoints),"street approach target leaves the indicative plot");
  const namedStreetRoads=roads.filter(item=>item.geometry?.source_name?.toLocaleLowerCase("sv-SE")==="säterdalsvägen"),streetRoadDistance=Math.min(...namedStreetRoads.flatMap(item=>(item.geometry?.points??[]).slice(0,-1).map((point,index)=>pointSegmentDistance2d([streetStage?.camera?.[0],streetStage?.camera?.[2]],[point[0],point[2]],[item.geometry.points[index+1][0],item.geometry.points[index+1][2]]))));
  check(namedStreetRoads.length>0&&Number.isFinite(streetRoadDistance)&&streetRoadDistance<=.1,"street approach camera is not source-bound to Säterdalsvägen");
  const plotStage=scene.navigation?.find(x=>x.id==="PLOT_ORBIT"),plotHorizontal=Math.hypot(plotStage?.camera?.[0]-plotStage?.target?.[0],plotStage?.camera?.[2]-plotStage?.target?.[2]),plotVertical=plotStage?.camera?.[1]-plotStage?.target?.[1];check(JSON.stringify(plotStage?.visible_groups)===JSON.stringify(["TERRAIN","PLOT","ROAD"]),"analytical plot view is cluttered or oblique");check(plotHorizontal>=70&&plotHorizontal<=130&&plotVertical>=40&&plotVertical<=75,"plot camera does not expose terrain form");
  const previewStage=scene.navigation?.find(x=>x.id==="CONCEPT_HOUSE_ON_PLOT"),previewHorizontal=Math.hypot(previewStage?.camera?.[0]-previewStage?.target?.[0],previewStage?.camera?.[2]-previewStage?.target?.[2]),previewVertical=previewStage?.camera?.[1]-previewStage?.target?.[1];check(previewStage?.visible_groups?.includes("CONCEPT_BUILDING")&&previewStage?.visible_groups?.includes("OPENING")&&!previewStage?.visible_groups?.some(type=>["ROOM","FURNITURE"].includes(type)),"concept preview visibility invalid");check(previewHorizontal>=38&&previewHorizontal<=50&&previewVertical>=9&&previewVertical<=18,"concept hero camera does not frame architecture at useful scale");
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
    check(fs.existsSync(path.join(repoRoot,designStudiesPath)),"design candidate study manifest missing");
    check(fs.existsSync(path.join(repoRoot,designStudiesSchemaPath)),"design candidate study schema missing");
    check(fs.existsSync(path.join(repoRoot,osmContextPath)),"OpenStreetMap context manifest missing");
    check(fs.existsSync(path.join(repoRoot,osmContextSchemaPath)),"OpenStreetMap context schema missing");
    check(fs.existsSync(path.join(repoRoot,cellAvailabilityPath)),"neighbourhood cell availability manifest missing");
    check(fs.existsSync(path.join(repoRoot,visualAcceptancePath)),"five-view visual acceptance record missing");
    check(fs.existsSync(path.join(repoRoot,visualAcceptanceSchemaPath)),"five-view visual acceptance schema missing");
    check(fs.existsSync(path.join(repoRoot,viewerPath)),"viewable prototype missing");
    check(fs.existsSync(path.join(repoRoot,liveAdapterPath)),"live context adapter missing");
    check(fs.existsSync(path.join(repoRoot,builderPath)),"scene builder missing");
    if(fs.existsSync(path.join(repoRoot,builderPath))){const builder=fs.readFileSync(path.join(repoRoot,builderPath),"utf8");check(builder.includes("function closestPointOnSegment")&&builder.includes("function deriveStreetApproach")&&builder.includes("osmContext.compiled.roads")&&builder.includes('"Säterdalsvägen"')&&!builder.includes("camera:[-56"),"street approach builder is not deterministically source-bound");}
    if(fs.existsSync(path.join(repoRoot,viewerPath))){const html=fs.readFileSync(path.join(repoRoot,viewerPath),"utf8");check(html.includes("neighbourhood-scene-v0.2.json")&&html.includes("OrbitControls")&&html.includes("CONCEPT MODE · LEGAL GATES OPEN"),"viewer is not bound to the scene/evidence UI");check(html.includes("INTELLIGENCE")&&html.includes("REALISTIC")&&html.includes("COMPARE")&&html.includes("renderPass")&&html.includes("context-providers-v0.1.json"),"synchronized renderer modes or provider interface missing");check(html.includes("street-context-v0.1.json")&&html.includes("street_room_high_detail")&&html.includes("buildExactListingCharacter")&&html.includes("Exact-address listing character"),"Street Room rendering or source disclosure missing");check(html.includes("addStreetDetail")&&html.includes("addHouseDetails")&&html.includes("addExactPlotWorkingCharacter")&&html.includes("proceduralTexture"),"higher-fidelity Street Room character layer is incomplete");check(html.includes("continuousRibbonGeometry")&&html.includes("gableRoofGeometry")&&!html.includes("new THREE.BoxGeometry(g.width_m,.12,length)"),"continuous roads or gable context buildings regressed");check(html.includes("edge.userData.intelligenceOnly=true")&&html.includes("item.type==='PLOT'?.18:1")===false,"plot evidence outline leaked into realistic profile");check(html.includes("streetArrivalTexture")&&html.includes("['STREET_VIEW','PLOT_ORBIT','CONCEPT_HOUSE_ON_PLOT']")&&html.includes("VISUAL RECONSTRUCTION · NOT A SURVEY OR CURRENT PHOTOGRAPH"),"main realistic stage is not bound to the labelled reconstruction profile");check(html.includes("realismDecor.visible=realistic")&&html.includes("stageLabelsAllowed"),"visual-only street character or close-view label isolation is missing");check(html.includes("applyStageVisibility")&&html.includes("visible_groups"),"navigation stages do not enforce their geometry visibility contract");check(html.includes("One geometry graph")&&html.includes("Realism changes presentation—not evidence"),"one-Twin evidence separation missing");check(html.includes("terrain-source-metadata-v0.1.json")&&html.includes("createMapboxRuntimeAdapter")&&html.includes("syncLiveStage")&&html.includes("LIVE VISUAL CONTEXT · NO EVIDENCE EFFECT"),"live context or official terrain disclosure is not mounted");check(html.includes("official-context-geometry-sources-v0.1.json")&&html.includes("Exact official geometry packages")&&html.includes("protected geometry bytes are absent"),"official geometry source disclosure is not mounted");check(html.includes("municipal-aerial-history-v0.1.json")&&html.includes("Aerial history")&&html.includes("LIVE MUNICIPAL WMS · NO PIXELS STORED"),"live municipal aerial history is not mounted");check(html.includes("visual-reconstruction-v0.1.json")&&html.includes("Visual reference")&&html.includes("NOT A SURVEY OR CURRENT PHOTOGRAPH")&&html.includes("mountVisualReconstruction"),"visual reconstruction is not safely mounted");check(html.includes("v3.25.0")&&html.includes("Disconnect & forget")&&html.includes("TOKEN STAYS IN THIS PAGE MEMORY ONLY"),"credential-safe live provider controls are incomplete");check(!/(localStorage|sessionStorage|document\.cookie|URLSearchParams)/.test(html),"viewer persists or transports runtime credentials unsafely");for(const step of STEPS)check(scene.navigation.some(x=>x.id===step),`viewer step source missing ${step}`);}
    if(fs.existsSync(path.join(repoRoot,viewerPath))){const html=fs.readFileSync(path.join(repoRoot,viewerPath),"utf8");check(html.includes("reconstructionTextureByStage")&&html.includes("street-approach-existing-condition-v0.1.png")&&html.includes("plot-outlook-existing-condition-v0.1.png"),"distinct realistic stage viewpoints are missing");check(html.includes("b.disabled=locked")&&html.includes("i>=4")&&html.includes("selected_house_profile===null"),"unselected building and room stages are not hard locked");check(html.includes("visualViews")&&html.includes("setVisualRendering")&&html.includes("reconstructionViewpointByStage"),"four-view reconstruction gallery is not stage synchronized");check(!html.includes("new THREE.WireframeGeometry"),"moire-producing analytical terrain wire returned");check(html.includes("mountMunicipalAerialDrape")&&html.includes("/runtime/norrkoping-aerial")&&html.includes("REALISTIC 3D")&&html.includes("ORBITABLE REALISTIC 3D")&&html.includes("applyProfile")&&!html.includes("realistic-plate"),"main Realistic profile is not the same orbitable 3D geometry");check(!html.includes("scene.background=backplate")&&!html.includes("o.visible=!backplate"),"static reconstruction backplate replaced navigable spatial geometry");check(!html.includes("drapeOnly")&&html.includes("realismDecor.visible=realistic")&&html.includes("LIVE MUNICIPAL AERIAL PATCH + OSM 3D CONTEXT")&&html.includes("NO STRETCHING OUTSIDE SOURCE BOUNDS"),"bounded aerial-grounded OSM 3D context or evidence disclosure missing");check(html.includes("sourceFootprintGeometry")&&html.includes("EXTRUDED_FOOTPRINT")&&html.includes("DRAPED_POLYGON")&&html.includes("OSM_CONTEXT")&&html.includes("CELL_AVAILABILITY")&&html.includes("OpenStreetMap contributors")&&html.includes("areaCell"),"source-bound area-cell renderer is incomplete");check(!html.includes("terrainMesh.userData.realisticMaterial.map=texture")&&!html.includes("lakeMaterial"),"stretched aerial or fabricated lake context returned");check(html.includes("RELIEF ×2.2 NOT ELEVATION EVIDENCE"),"visual terrain relief disclosure missing");check(html.includes("PLOT-TO-PROJECT · SITE INTELLIGENCE")&&html.includes("Know the land")&&html.includes("The place and the blockers"),"site intelligence is not the primary product surface");check(html.includes("plot-intelligence-v0.1.json")&&html.includes("plotIntelligence.source_receipts.length")&&html.includes("plotIntelligence.findings.length"),"site intelligence metrics are not bound to the evidence manifest");check(html.includes('id="enterSpatialLab"')&&html.includes("Open Spatial Lab")&&html.includes("legal and survey gates remain visible"),"Spatial Lab entry or evidence disclosure is missing");check(html.includes('id="solarDiagram"')&&html.includes("drawSolarDiagram")&&html.includes("SUMMER SOLSTICE")&&html.includes("NO TREE, BUILDING OR TERRAIN OCCLUSION CLAIM"),"architectural solar diagram or evidence limitation missing");check(html.includes('id="elevationDiagram"')&&html.includes("drawElevationDiagram")&&html.includes("RH2000 VALUES LOCKED")&&html.includes("RELATIVE DISPLAY SURFACE · NO LEVEL CLAIM"),"disclosed display profile or official-level gate missing");check(html.includes("Price against neighbours")&&html.includes("0 SOURCE-BOUND COMPS")&&html.includes("No price or ownership payload is stored in Spatial Studio")&&html.includes("PARCEL LINEAGE"),"reference-only market comparison plate or ownership boundary missing");check(html.includes('id="groundDiagram"')&&html.includes("drawGroundDiagram")&&html.includes("NEARBY OBSERVATIONS · NOT A TRANSECT")&&html.includes("GEOTECHNICAL INVESTIGATION REQUIRED"),"ground cutaway or screening limitations missing");check([2008,2010,2017,2025].every(year=>html.includes(`/runtime/norrkoping-aerial/${year}`))&&html.includes("NO PROVIDER PIXELS STORED")&&html.includes("not independently verified photography dates"),"landing aerial history or source-date disclosure missing");}
    if(fs.existsSync(path.join(repoRoot,viewerPath))){const html=fs.readFileSync(path.join(repoRoot,viewerPath),"utf8");check(html.includes("new THREE.ShapeGeometry(shape)")&&html.includes("groundY(x,z)+.09")&&html.includes("groundY(x,z)+.16"),"plot surface or boundary is not terrain-draped");check(html.includes('id="plotBeaconToggle"')&&html.includes("plotBeacon.visible=realistic&&plotBeaconEnabled&&allowed.has('PLOT')")&&html.includes("THREE.AdditiveBlending")&&html.includes("SUBJECT PLOT · INDICATIVE")&&html.includes("no legal boundary effect"),"lightweight disclosed Realistic plot beacon is missing");check(!html.includes("new THREE.PointLight")&&!html.includes("EffectComposer"),"plot locator added a light or post-processing performance burden");check(html.includes("pointerStart")&&html.includes("Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>5")&&html.includes("panelSelectableTypes")&&html.includes("clickable.filter(object=>panelSelectableTypes.has"),"orbit gestures can still trigger evidence selection");check(html.includes("compactGeometry")&&html.includes("compact.vertex_count")&&!html.includes("JSON.stringify(item.geometry"),"evidence panel can still dump raw terrain arrays");check(html.includes("width:min(380px,calc(100vw - 32px))")&&!html.includes(".panel{width:calc(100vw - 32px)}"),"desktop evidence panel can still expand to a full-width white wall");const terrainViewerResult=validatePlotTerrainViewer(html),terrainShadingResult=validateTerrainShadingViewer(html);assertions+=terrainViewerResult.assertions+terrainShadingResult.assertions;errors.push(...terrainViewerResult.errors,...terrainShadingResult.errors);}
    if(fs.existsSync(path.join(repoRoot,viewerPath))){const html=fs.readFileSync(path.join(repoRoot,viewerPath),"utf8");check(html.includes('id="gateDisclosure"')&&html.includes("gateDisclosure.onclick")&&html.includes("aria-expanded")&&html.includes(".gate.expanded em"),"evidence disclosure is not compact and deliberate");check(html.includes("buildNeighbourhoodPlotLocator")&&html.includes("SÄTERDALSVÄGEN 14 · SUBJECT PLOT")&&html.includes("new THREE.TorusGeometry")&&html.includes("neighbourhoodPlotLocator.visible=plotBeaconEnabled&&stage.id==='NEIGHBOURHOOD_VIEW'"),"neighbourhood-scale subject plot locator is missing");check(html.includes("NEIGHBOURHOOD_VIEW:52")&&html.includes("STREET_VIEW:44")&&html.includes("PLOT_ORBIT:48")&&html.includes("CONCEPT_HOUSE_ON_PLOT:35")&&html.includes("CONCEPT_HOUSE_ON_PLOT'?50:62"),"stage-specific camera framing is missing");check(!html.includes("for(let i=0;i<145;i++")&&html.includes("item.type==='LANDCOVER'&&item.geometry.surface_class==='forest'"),"unclassified procedural vegetation obscures source-bound context");const detailViewerResult=validateNeighbourhoodDetailViewer(html),lodViewerResult=validateContextBuildingLodViewer(html),streetViewerResult=validateStreetApproachViewer(html),heroViewerResult=validateArchitecturalHeroViewer(html);assertions+=detailViewerResult.assertions+lodViewerResult.assertions+streetViewerResult.assertions+heroViewerResult.assertions;errors.push(...detailViewerResult.errors,...lodViewerResult.errors,...streetViewerResult.errors,...heroViewerResult.errors);}
    if(fs.existsSync(path.join(repoRoot,viewerPath))){const html=fs.readFileSync(path.join(repoRoot,viewerPath),"utf8");check(html.includes("design-candidate-studies-v0.2.json")&&html.includes('id="designDock"')&&html.includes("buildDesignCandidates")&&html.includes("mountDesignStudies")&&html.includes("setActiveCandidate"),"versioned concept-studio candidate interface is not mounted");check(html.includes("CONCEPT DESIGN STUDIO")&&html.includes("0 SELECTED")&&html.includes("ROOF, FAÇADE, GLAZING & DECK ARE CONCEPT EXPRESSION")&&html.includes("NO SETBACK, ENTITLEMENT OR APPROVAL CLAIM"),"concept-studio legal and selection disclosure missing");check(html.includes("architecturalMesh")&&html.includes("gableRoofGeometry")&&html.includes("south_glazing_modules")&&html.includes("terrace_depth_m")&&html.includes("Concept studio · 3 schemes"),"candidate studies are still generic boxes instead of manifest-driven architectural assemblies");check(html.includes("buildCandidateSignature")&&html.includes("LINEAR_VIEW_DECK")&&html.includes("SHELTERED_COURTYARD")&&html.includes("STEPPED_TERRACES")&&html.includes("RECESSED_PORCH")&&html.includes("COURTYARD_PORTAL")&&html.includes("GLAZED_LINK"),"candidate-specific arrival and outdoor-room architecture is not rendered");check(html.includes("candidateStudyGroup.visible=candidatePreview")&&html.includes("candidateReplacesBaseline")&&html.includes("candidateFocusHidden"),"candidate preview does not isolate the architectural design stage");check(html.includes("conceptStudio&&mode==='INTELLIGENCE'")&&html.includes("legend.classList.toggle('hidden',conceptStudio)")&&html.includes("isPlotBeaconLabel")&&html.includes("!candidatePreview"),"concept stage does not open in a clean realistic presentation profile");check(html.includes('id="schemeCompareLabels"')&&html.includes("renderSynchronizedFrame")&&html.includes("innerWidth/3")&&html.includes("previewCandidateId")&&html.includes("SAME PLOT · SAME CAMERA"),"three-scheme synchronized comparison is missing");check(html.includes("sessionSelectedCandidateId=null")&&html.includes("designSelect.onclick")&&html.includes("SESSION ONLY · NO LEGAL EFFECT")&&html.includes("CLEAR SESSION CHOICE"),"explicit reversible concept selection is missing or over-promoted");check(html.includes("beaconFill")&&html.includes("opacity:.1")&&html.includes("blending:THREE.AdditiveBlending"),"subject-plot glow surface missing from Realistic profile");check(html.includes("new THREE.ArrowHelper")&&html.includes("RELATIVE FALL · DISPLAY ONLY"),"relative plot-fall cue is missing or presented without its limitation");check(!/data\.project_status\.selected_house_profile\s*=(?!=)/.test(html)&&!/policy\.selected_candidate_id\s*=(?!=)/.test(html),"preview interaction can silently select a design");const intentViewerResult=validateArchitecturalIntentViewer(html);assertions+=intentViewerResult.assertions;errors.push(...intentViewerResult.errors);const comparisonViewerResult=validateArchitecturalComparisonViewer(html);assertions+=comparisonViewerResult.assertions;errors.push(...comparisonViewerResult.errors);}
    if(fs.existsSync(path.join(repoRoot,viewerPath))){const html=fs.readFileSync(path.join(repoRoot,viewerPath),"utf8");check(html.includes("function candidateRoof")&&html.includes("profile.roof_form==='MONO_PITCH'")&&html.includes("roof.rotation.z")&&html.includes('id="designSignals"')&&html.includes("candidate.design_signals.slice(0,3)")&&html.includes("candidate.presentation_profile.roof_form.replaceAll"),"three concept studies do not expose distinct architectural roof and design strategies");check(html.includes("emissiveIntensity:.42")&&html.includes("transmission:.08")&&html.includes("const handle=architecturalMesh")&&html.includes("const chimney=architecturalMesh")&&html.includes("gutter.rotation.z=Math.PI/2")&&html.includes("downpipe.position.set"),"concept façades lack lightweight architectural depth and building detail");check(html.includes('id="performanceStatus"')&&html.includes("performancePolicy={targetFps:30,minPixelRatio:.8")&&html.includes("monitorRenderPerformance")&&html.includes("document.hidden")&&html.includes("GEOMETRY PRESERVED")&&html.includes("renderer.setPixelRatio(currentPixelRatio)"),"adaptive 3D performance protection is missing or can conceal geometry");const monitorBody=html.slice(html.indexOf("function monitorRenderPerformance"),html.indexOf("document.addEventListener('visibilitychange'"));check(!monitorBody.includes(".visible="),"performance adaptation can hide source geometry");}
    if(fs.existsSync(path.join(repoRoot,serverPath))){const server=fs.readFileSync(path.join(repoRoot,serverPath),"utf8");check(server.includes("norrkoping-aerial")&&server.includes("municipal-aerial-history-v0.1.json")&&server.includes("aerialByYear")&&server.includes('"cache-control":"no-store"'),"live municipal aerial-history proxy is missing or cache policy weakened");check(server.includes('"x-evidence-effect":"NONE"')&&server.includes('"x-pixel-persistence":"MEMORY_ONLY"')&&server.includes('"x-year-label-is-verified-capture-date":"false"')&&!/writeFile|createWriteStream/.test(server),"live aerial proxy can persist pixels, promote capture dates or affect evidence");}
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
    if(fs.existsSync(path.join(repoRoot,designStudiesPath))){const designResult=validateDesignCandidateStudies(read(designStudiesPath,repoRoot),{scene,repoRoot});assertions+=designResult.assertions;errors.push(...designResult.errors);}
    if(fs.existsSync(path.join(repoRoot,visualAcceptancePath))){const visualAcceptanceResult=validateVisualAcceptance(read(visualAcceptancePath,repoRoot),{scene,repoRoot});assertions+=visualAcceptanceResult.assertions;errors.push(...visualAcceptanceResult.errors);}
    if(fs.existsSync(path.join(repoRoot,osmContextPath))){const osmResult=validateOsmContext(read(osmContextPath,repoRoot),{repoRoot});assertions+=osmResult.assertions;errors.push(...osmResult.errors);}
    if(fs.existsSync(path.join(repoRoot,osmContextSchemaPath))){const osmSchema=read(osmContextSchemaPath,repoRoot);check(osmSchema.additionalProperties===false&&osmSchema.properties?.schema_version?.const==="svartinge-osm-context/v0.1","strict OpenStreetMap context schema missing");}
    if(fs.existsSync(path.join(repoRoot,liveAdapterPath))){const adapter=fs.readFileSync(path.join(repoRoot,liveAdapterPath),"utf8");check(adapter.includes("EXPLICIT_RUNTIME_CONFIG_ONLY")&&adapter.includes("LIVE_ONLY_NO_PERSISTENCE")&&adapter.includes("evidence_promotion_allowed: false")&&adapter.includes("runtime_token_cleared_on_destroy: true"),"live adapter safety contract weakened");check(adapter.includes("syncStage")&&adapter.includes("LOCAL_EAST_UP_NORTH_STAGE_REFERENCE")&&adapter.includes('evidence_effect !== "NONE"'),"stage synchronization could promote or drift live context");check(!/(localStorage|sessionStorage|document\.cookie|URLSearchParams)/.test(adapter),"live adapter persists or transports runtime credentials unsafely");}
  }
  return {ok:errors.length===0,assertions,errors};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const result=validateSvartingePrototype(read(scenePath));
  if(!result.ok){console.error(`Svärtinge 3D prototype FAIL (${result.assertions} assertions)`);result.errors.forEach(e=>console.error(`- ${e}`));process.exitCode=1;}
  else console.log(`Svärtinge 3D prototype PASS (${result.assertions} assertions; 7 navigation stages; 5 evidence classes)`);
}
