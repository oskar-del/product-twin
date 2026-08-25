import assert from "node:assert/strict";
import fs from "node:fs";
import {validateArchitecturalComparisonViewer,validateContextBuildingLodViewer,validateArchitecturalHeroViewer,validateArchitecturalIntentViewer,validateContextProviders,validateDesignCandidateStudies,validateMunicipalAerialHistory,validateNeighbourhoodDetailViewer,validateOfficialContextGeometrySources,validatePlotTerrainViewer,validateStreetApproachViewer,validateStreetContext,validateSvartingePrototype,validateTerrainShadingViewer,validateTerrainSourceMetadata,validateVisualAcceptance,validateVisualReconstruction} from "./validate-svartinge-neighbourhood-prototype-v0.2.mjs";

const baseline=JSON.parse(fs.readFileSync("data/sites/sweden/saterdalsvagen-14/neighbourhood-scene-v0.2.json","utf8"));
const providerBaseline=JSON.parse(fs.readFileSync("data/sites/sweden/saterdalsvagen-14/context-providers-v0.1.json","utf8"));
const streetBaseline=JSON.parse(fs.readFileSync("data/sites/sweden/saterdalsvagen-14/street-context-v0.1.json","utf8"));
const terrainBaseline=JSON.parse(fs.readFileSync("data/sites/sweden/saterdalsvagen-14/terrain-source-metadata-v0.1.json","utf8"));
const officialGeometryBaseline=JSON.parse(fs.readFileSync("data/sites/sweden/saterdalsvagen-14/official-context-geometry-sources-v0.1.json","utf8"));
const aerialHistoryBaseline=JSON.parse(fs.readFileSync("data/sites/sweden/saterdalsvagen-14/municipal-aerial-history-v0.1.json","utf8"));
const visualReconstructionBaseline=JSON.parse(fs.readFileSync("data/sites/sweden/saterdalsvagen-14/visual-reconstruction-v0.1.json","utf8"));
const designStudiesBaseline=JSON.parse(fs.readFileSync("data/sites/sweden/saterdalsvagen-14/design-candidate-studies-v0.2.json","utf8"));
const visualAcceptanceBaseline=JSON.parse(fs.readFileSync("data/sites/sweden/saterdalsvagen-14/visual-acceptance-v0.1.json","utf8"));
const viewerBaseline=fs.readFileSync("prototype/svartinge-neighbourhood/index.html","utf8");
assert.equal(validateSvartingePrototype(baseline).ok,true,"baseline scene must validate");
assert.equal(validateContextProviders(providerBaseline).ok,true,"baseline provider registry must validate");
assert.equal(validateStreetContext(streetBaseline).ok,true,"baseline street context must validate");
assert.equal(validateTerrainSourceMetadata(terrainBaseline).ok,true,"baseline terrain source metadata must validate");
assert.equal(validateOfficialContextGeometrySources(officialGeometryBaseline).ok,true,"baseline official context geometry sources must validate");
assert.equal(validateMunicipalAerialHistory(aerialHistoryBaseline).ok,true,"baseline municipal aerial history must validate");
assert.equal(validateVisualReconstruction(visualReconstructionBaseline).ok,true,"baseline visual reconstruction must validate");
assert.equal(validateDesignCandidateStudies(designStudiesBaseline,{scene:baseline}).ok,true,"baseline design candidate studies must validate");
assert.equal(validateVisualAcceptance(visualAcceptanceBaseline,{scene:baseline}).ok,true,"baseline five-view visual acceptance must validate");
assert.equal(validatePlotTerrainViewer(viewerBaseline).ok,true,"baseline plot terrain study must validate");
assert.equal(validateTerrainShadingViewer(viewerBaseline).ok,true,"baseline terrain shading must validate");
assert.equal(validateNeighbourhoodDetailViewer(viewerBaseline).ok,true,"baseline neighbourhood street-room detail must validate");
assert.equal(validateContextBuildingLodViewer(viewerBaseline).ok,true,"baseline context-building roof LOD must validate");
assert.equal(validateStreetApproachViewer(viewerBaseline).ok,true,"baseline street approach must validate");
assert.equal(validateArchitecturalHeroViewer(viewerBaseline).ok,true,"baseline architectural hero must validate");
assert.equal(validateArchitecturalIntentViewer(viewerBaseline).ok,true,"baseline architectural intent must validate");
assert.equal(validateArchitecturalComparisonViewer(viewerBaseline).ok,true,"baseline architectural comparison must validate");
const terrainFunctionNames=["pointInPolygon","segmentIntersectionParameter","clipSegmentToPlot","contourCellSegments"],terrainFunctionSource=terrainFunctionNames.map(name=>viewerBaseline.split("\n").find(line=>line.startsWith(`function ${name}(`))).join("\n"),terrainFunctions=new Function(`${terrainFunctionSource};return {${terrainFunctionNames.join(",")}}`)(),plotPoints=baseline.elements.find(item=>item.id==="PLOT_54_28").geometry.points_xz,plotBounds=plotPoints.reduce((out,[x,z])=>[Math.min(out[0],x),Math.min(out[1],z),Math.max(out[2],x),Math.max(out[3],z)],[Infinity,Infinity,-Infinity,-Infinity]),displayHeight=(x,z)=>2.2*(.008*x+.014*z+.55*Math.sin(x/38)*Math.cos(z/52)),terrainSamples=[];
for(let x=Math.floor(plotBounds[0]);x<=Math.ceil(plotBounds[2]);x++)for(let z=Math.floor(plotBounds[1]);z<=Math.ceil(plotBounds[3]);z++)if(terrainFunctions.pointInPolygon(x,z,plotPoints))terrainSamples.push({x,z,h:displayHeight(x,z)});
for(const [x,z] of plotPoints)terrainSamples.push({x,z,h:displayHeight(x,z)});
const displayLow=terrainSamples.reduce((best,item)=>item.h<best.h?item:best),displayHigh=terrainSamples.reduce((best,item)=>item.h>best.h?item:best),displayRelief=displayHigh.h-displayLow.h;let contourLevelCount=0,contourSegmentCount=0;
for(let offset=.5;offset<displayRelief-.1;offset+=.5){contourLevelCount++;const level=displayLow.h+offset;for(let x=Math.floor(plotBounds[0]);x<Math.ceil(plotBounds[2]);x++)for(let z=Math.floor(plotBounds[1]);z<Math.ceil(plotBounds[3]);z++){const corners=[[x,z],[x+1,z],[x+1,z+1],[x,z+1]],heights=corners.map(([cx,cz])=>displayHeight(cx,cz));for(const [a,b] of terrainFunctions.contourCellSegments(corners,heights,level))for(const [start,end] of terrainFunctions.clipSegmentToPlot(a,b,plotPoints)){const midpoint=[(start[0]+end[0])/2,(start[1]+end[1])/2];assert.equal(terrainFunctions.pointInPolygon(midpoint[0],midpoint[1],plotPoints),true,"clipped contour midpoint must remain inside indicative plot");contourSegmentCount++;}}}
assert.equal(Number(displayRelief.toFixed(1)),3.6,"relative display relief drift");assert.equal(contourLevelCount,7,"relative contour-level count drift");assert.equal(contourSegmentCount,294,"deterministic clipped contour segment count drift");

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
  ["neighbourhood camera loses plot",m=>m.navigation.find(x=>x.id==="NEIGHBOURHOOD_VIEW").target=[400,0,400],"neighbourhood camera does not target subject plot"],
  ["street camera floats",m=>m.navigation.find(x=>x.id==="STREET_VIEW").camera[1]+=8,"street camera is not at a credible local eye height"],
  ["street target floats",m=>m.navigation.find(x=>x.id==="STREET_VIEW").target[1]+=3,"street approach does not reveal the road-to-plot ground relationship"],
  ["street camera retreats",m=>{const stage=m.navigation.find(x=>x.id==="STREET_VIEW");stage.camera[0]-=90;stage.camera[2]-=90},"street approach does not frame the plot at arrival scale"],
  ["street target leaves plot",m=>m.navigation.find(x=>x.id==="STREET_VIEW").target=[400,1.6,400],"street approach target leaves the indicative plot"],
  ["street target returns to corner",m=>{const stage=m.navigation.find(x=>x.id==="STREET_VIEW");stage.target=[-19,.2,.5]},"street approach does not centre the subject plot"],
  ["street camera leaves mapped road",m=>m.navigation.find(x=>x.id==="STREET_VIEW").camera[0]+=20,"street approach camera is not source-bound to the Säterdalsvägen road corridor"],
  ["plot view clutter restored",m=>m.navigation.find(x=>x.id==="PLOT_ORBIT").visible_groups.push("CONTEXT_BUILDING"),"analytical plot view is cluttered or oblique"],
  ["plot camera flattened",m=>{const stage=m.navigation.find(x=>x.id==="PLOT_ORBIT");stage.camera[0]=stage.target[0];stage.camera[2]=stage.target[2]},"plot camera does not expose terrain form"],
  ["concept hero loses architecture",m=>m.navigation.find(x=>x.id==="CONCEPT_HOUSE_ON_PLOT").camera=[300,18,-300],"concept hero camera does not frame architecture at useful scale"],
  ["concept hero over-crops architecture",m=>m.navigation.find(x=>x.id==="CONCEPT_HOUSE_ON_PLOT").camera=[14,5,7],"concept hero camera does not frame architecture at useful scale"],
  ["terrain promoted",m=>m.elements.find(x=>x.id==="TERRAIN_CONTEXT").evidence_class="AUTHORITATIVE","terrain promoted"],
  ["terrain facets restored",m=>m.elements.find(x=>x.id==="TERRAIN_CONTEXT").geometry.segments=12,"terrain mesh does not cover"],
  ["terrain relief misrepresented",m=>m.elements.find(x=>x.id==="TERRAIN_CONTEXT").geometry.visual_relief_exaggeration=1,"visual terrain relief disclosure missing"],
  ["context building promoted",m=>m.elements.find(x=>x.type==="CONTEXT_BUILDING").evidence_class="AUTHORITATIVE","source-bound context building coverage incomplete"],
  ["context footprint edited",m=>m.elements.find(x=>x.type==="CONTEXT_BUILDING").geometry.points_xz[0][0]+=2,"context building footprint or height diverges"],
  ["context height method promoted",m=>m.elements.find(x=>x.type==="CONTEXT_BUILDING").geometry.height_method="SURVEYED","context building footprint or height diverges"],
  ["building coverage erased",m=>m.elements=m.elements.filter(x=>x.type!=="CONTEXT_BUILDING").concat(baseline.elements.filter(x=>x.type==="CONTEXT_BUILDING").slice(0,12)),"source-bound context building coverage incomplete"],
  ["road promoted",m=>m.elements.find(x=>x.type==="ROAD").evidence_class="AUTHORITATIVE","ten-street source-bound road context incomplete"],
  ["road slices terrain",m=>m.elements.find(x=>x.type==="ROAD").geometry.points[0][1]+=2,"road ribbon diverges from source artifact or display terrain"],
  ["road source shape edited",m=>m.elements.find(x=>x.type==="ROAD").geometry.points[0][0]+=2,"road ribbon diverges from source artifact or display terrain"],
  ["named street coverage erased",m=>m.elements.filter(x=>x.type==="ROAD").forEach(x=>x.geometry.source_name=null),"ten-street source-bound road context incomplete"],
  ["landcover promoted",m=>m.elements.find(x=>x.type==="LANDCOVER").evidence_class="AUTHORITATIVE","land or water context diverges"],
  ["water context removed",m=>m.elements=m.elements.filter(x=>x.type!=="WATER"),"source-bound land or water context incomplete"],
  ["OSM source role promoted",m=>m.source_bindings.find(x=>x.path.endsWith("osm-context-v0.1.json")).role="OFFICIAL_GEOMETRY","OpenStreetMap source binding or non-official scope missing"],
  ["concept house promoted",m=>m.elements.find(x=>x.id==="HOUSE_SLAB").evidence_class="DERIVED","concept building/room geometry"],
  ["concept preview removed",m=>m.navigation.find(x=>x.id==="CONCEPT_HOUSE_ON_PLOT").visible_groups=m.navigation.find(x=>x.id==="CONCEPT_HOUSE_ON_PLOT").visible_groups.filter(x=>x!=="CONCEPT_BUILDING"),"concept preview visibility invalid"],
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

const terrainViewerAttacks=[
  ["plot contour interval inflated",html=>html.replace("interval=.5","interval=5"),"plot terrain relative contour geometry missing"],
  ["plot contour clipping bypassed",html=>html.replace("clipSegmentToPlot(a,b,points)","[[a,b]]"),"plot terrain contours are not clipped"],
  ["plot contour evidence promoted",html=>html.replace("DERIVED_RELATIVE_UNCALIBRATED","AUTHORITATIVE"),"plot terrain evidence classification promoted"],
  ["plot contour stage scope removed",html=>html.replace("stage.id==='PLOT_ORBIT'&&Boolean(terrainObject?.visible)","Boolean(terrainObject?.visible)"),"plot terrain study scope"],
  ["plot official-level warning removed",html=>html.replace("NO RH2000 LEVEL","OFFICIAL CONTOURS"),"plot terrain evidence classification promoted"]
];
for(const [name,mutate,needle] of terrainViewerAttacks){
  const result=validatePlotTerrainViewer(mutate(viewerBaseline));
  assert.equal(result.ok,false,name);assert.ok(result.errors.some(e=>e.includes(needle)),`${name}: ${result.errors.join(" | ")}`);
}

const terrainShadingViewerAttacks=[
  ["shadow normal bias removed",html=>html.replace("sun.shadow.normalBias=.12","sun.shadow.normalBias=0"),"directional shadow acne controls"],
  ["shadow depth range widened",html=>html.replace("sun.shadow.camera.far=520","sun.shadow.camera.far=4000"),"directional shadow depth range"],
  ["terrain self shadow restored",html=>html.replace("mesh.castShadow=false;mesh.receiveShadow=true;root.add(mesh);terrainObject=mesh","mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);terrainObject=mesh"),"terrain shading can self-shadow"],
  ["terrain faceting restored",html=>html.replace("const mesh=profile(new THREE.Mesh(geo),item,1,1)","const mesh=profile(new THREE.Mesh(geo,new THREE.MeshStandardMaterial({flatShading:true})),item,1,1)"),"terrain surface reintroduced faceting"],
  ["aerial drape offset removed",html=>html.replace("polygonOffset:true,polygonOffsetFactor:-1","polygonOffset:false,polygonOffsetFactor:0"),"aerial drape can z-fight"],
  ["close-stage aerial restored at full opacity",html=>html.replace("STREET_VIEW:.24,PLOT_ORBIT:.3,CONCEPT_HOUSE_ON_PLOT:.18","STREET_VIEW:.94,PLOT_ORBIT:.94,CONCEPT_HOUSE_ON_PLOT:.94"),"close-view aerial drape can overpower"],
  ["comparison aerial restored",html=>html.replace("aerialDrapeMesh.visible=realistic&&!conceptComparison","aerialDrapeMesh.visible=realistic"),"close-view aerial drape can overpower"]
];
for(const [name,mutate,needle] of terrainShadingViewerAttacks){
  const result=validateTerrainShadingViewer(mutate(viewerBaseline));
  assert.equal(result.ok,false,name);assert.ok(result.errors.some(e=>e.includes(needle)),`${name}: ${result.errors.join(" | ")}`);
}

const streetApproachViewerAttacks=[
  ["street FOV drifts",html=>html.replace("STREET_VIEW:44","STREET_VIEW:48"),"street approach camera FOV drift"],
  ["street legal access promoted",html=>html.replace("FRONTAGE + LEGAL ACCESS UNVERIFIED","FRONTAGE + LEGAL ACCESS VERIFIED"),"street approach evidence caption missing or promoted"],
  ["street road binding changes",html=>html.replace("source_name?.toLocaleLowerCase('sv-SE')==='säterdalsvägen'","source_name?.toLocaleLowerCase('sv-SE')==='other'"),"street approach source-road treatment missing"],
  ["street labels restored",html=>html.replace("stageLabelsAllowed=!['STREET_VIEW','PLOT_ORBIT','CONCEPT_HOUSE_ON_PLOT'].includes(s.id)","stageLabelsAllowed=!['PLOT_ORBIT','CONCEPT_HOUSE_ON_PLOT'].includes(s.id)"),"street approach labels or POIs obscure the primary subject"],
  ["street plot analytics restored",html=>html.replace("if(o.userData.plotAnalyticalCue)o.visible=streetApproach&&Boolean(o.userData.streetBoundaryCue)","if(o.userData.plotAnalyticalCue)o.visible=true"),"street approach plot locator is missing boundary lights"],
  ["street boundary lights oversized",html=>html.replace("object.material.size=1.05","object.material.size=2.5"),"street approach boundary lights are oversized"],
  ["street utility obstruction restored",html=>html.replace("if(o.userData.utilityInfrastructure)o.visible=false","if(o.userData.utilityInfrastructure)o.visible=realistic"),"visual-only utility furniture obstructs"]
];
for(const [name,mutate,needle] of streetApproachViewerAttacks){
  const result=validateStreetApproachViewer(mutate(viewerBaseline));
  assert.equal(result.ok,false,name);assert.ok(result.errors.some(e=>e.includes(needle)),`${name}: ${result.errors.join(" | ")}`);
}

const neighbourhoodDetailViewerAttacks=[
  ["nearby detail renderer removed",html=>html.replace("function addHouseDetails","function omitHouseDetails"),"nearby building detail is not source-footprint bound"],
  ["nearby detail loses source footprints",html=>html.replace("const g=item.geometry,points=g.points_xz","const g=item.geometry,points=[]"),"nearby building detail is not source-footprint bound"],
  ["nearby detail expands without bound",html=>html.replace("slice(0,36)","slice(0,360)"),"nearby building detail is not performance bounded"],
  ["nearby detail evidence promoted",html=>html.replace("mesh.castShadow=castShadow;mesh.userData.contextBuildingDetail=true;mesh.userData.visualOnly=true","mesh.castShadow=castShadow;mesh.userData.contextBuildingDetail=true;mesh.userData.visualOnly=false"),"nearby building detail can promote"],
  ["nearby detail limitation promoted",html=>html.replace("they are not observed building details","they are observed building details"),"nearby building detail limitation missing or promoted"],
  ["nearby detail stage binding removed",html=>html.replace("mesh.castShadow=castShadow;mesh.userData.contextBuildingDetail=true","mesh.castShadow=castShadow;mesh.userData.contextBuildingDetail=false"),"building detail can float"],
  ["road batching mount removed",html=>html.replace("data.elements.forEach(buildElement);mountRoadNetwork();","data.elements.forEach(buildElement);"),"road ribbons are not deterministically"],
  ["road batching lineage removed",html=>html.replace("sourceGeometry='OSM_ROAD_RIBBONS'","sourceGeometry='GENERIC_ROAD_GRID'"),"road-network visual batching can promote"],
  ["neighbourhood tree LOD removed",html=>html.replace("if(o.userData.contextVegetation)o.visible=realistic&&boundedSiteStage&&!conceptComparison","if(o.userData.contextVegetation)o.visible=realistic"),"vegetation is rendered across the full neighbourhood"]
];
for(const [name,mutate,needle] of neighbourhoodDetailViewerAttacks){
  const result=validateNeighbourhoodDetailViewer(mutate(viewerBaseline));
  assert.equal(result.ok,false,name);assert.ok(result.errors.some(e=>e.includes(needle)),`${name}: ${result.errors.join(" | ")}`);
}

const contextBuildingLodViewerAttacks=[
  ["far LOD band removed",html=>html.replaceAll("['NEAR_0_170_M','MID_170_650_M','FAR_650_PLUS_M']","['NEAR_0_170_M','MID_170_650_M']"),"mount bands are incomplete"],
  ["body LOD loses footprint lineage",html=>html.replace("contextBodyLodEntries.push","contextBodyLodEntriesOmitted.push"),"not source-footprint bound"],
  ["middle LOD loses footprint lineage",html=>html.replaceAll("sourceGeometry='OSM_FOOTPRINT_BOUNDS'","sourceGeometry='GENERIC_ROOF_GRID'"),"not source-footprint bound"],
  ["body LOD loses instancing",html=>html.replace("new THREE.InstancedMesh(geometry","new THREE.Mesh(geometry"),"not deterministically instanced"],
  ["context LOD evidence promoted",html=>html.replaceAll("mesh.userData.visualOnly=true;mesh.userData.evidenceEffect='NONE';mesh.userData.sourceGeometry","mesh.userData.visualOnly=false;mesh.userData.evidenceEffect='CLOSE_GATE';mesh.userData.sourceGeometry"),"masquerade as observed building evidence"],
  ["context LOD shadows exceed frame budget",html=>html.replaceAll("mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData.realisticOnly=true","mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.realisticOnly=true"),"bounded rendering budget"],
  ["concept context distance bound removed",html=>html.replace("contextDistanceLimit=candidatePreview?150:boundedSiteStage?170:Infinity","contextDistanceLimit=Infinity"),"street/plot/concept context geometry"],
  ["realistic LOD replacement removed",html=>html.replace("contextLodReplaced=realistic&&item.type==='CONTEXT_BUILDING'&&!boundedSiteStage","contextLodReplaced=false"),"realistic LOD replacement is not distance bounded"],
  ["body LOD mount removed",html=>html.replace("function buildRealismDecor(){addSky();mountContextBodyLod();mountContextRoofLod();","function buildRealismDecor(){addSky();mountContextRoofLod();"),"not mounted or disclosed"],
  ["profile traversal restored per frame",html=>html.replace("if(mode==='COMPARE')applyProfile(name,previewCandidateId)","applyProfile(name,previewCandidateId)"),"recomputed on every animation frame"],
  ["shadow map restored per frame",html=>html.replace("renderer.shadowMap.autoUpdate=false","renderer.shadowMap.autoUpdate=true"),"shadows are recomputed on every animation frame"]
];
for(const [name,mutate,needle] of contextBuildingLodViewerAttacks){
  const result=validateContextBuildingLodViewer(mutate(viewerBaseline));
  assert.equal(result.ok,false,name);assert.ok(result.errors.some(e=>e.includes(needle)),`${name}: ${result.errors.join(" | ")}`);
}

const architecturalHeroViewerAttacks=[
  ["hero panel reserve removed",html=>html.replace("camera.setViewOffset(width+dockReserve","camera.setViewOffset(width"),"architectural hero framing"],
  ["hero side openings removed",html=>html.replaceAll("facade_rhythm==='PANORAMIC_BAYS'","facade_rhythm==='NONE'"),"architectural hero lacks façade depth"],
  ["hero roof seams removed",html=>html.replace("function addRoofSeams","function omitRoofSeams"),"architectural hero roof expression"],
  ["hero vertical timber removed",html=>html.replace("texture:surfaceTextures.verticalTimber","siding:true"),"lacks legible Nordic vertical-timber"],
  ["hero envelope depth removed",html=>html.replace("function addArchitecturalEnvelopeDepth","function omitArchitecturalEnvelopeDepth"),"envelope lacks corner"],
  ["hero deck edge removed",html=>html.replace("function addConceptRailing","function omitConceptRailing"),"deck edge or arrival transition"],
  ["hero plot overlay restored",html=>html.replace("candidatePreview?.035:.1",".1"),"architectural hero is obscured"],
  ["hero boundary line draws through architecture",html=>html.replace("object.material.depthTest=true","object.material.depthTest=false"),"architectural hero is obscured"],
  ["hero intent overlays restored",html=>html.replace("if(object.userData.intentLens)object.visible=false","if(object.userData.intentLens)object.visible=true"),"architectural hero is obscured"],
  ["hero plot clutter restored",html=>html.replace("realistic&&!candidatePreview","realistic"),"architectural hero clutter isolation"]
];
for(const [name,mutate,needle] of architecturalHeroViewerAttacks){
  const result=validateArchitecturalHeroViewer(mutate(viewerBaseline));
  assert.equal(result.ok,false,name);assert.ok(result.errors.some(e=>e.includes(needle)),`${name}: ${result.errors.join(" | ")}`);
}

const architecturalComparisonViewerAttacks=[
  ["comparison land lens removed",html=>html.replace('data-lens="LAND"','data-lens="GROUND"'),"architectural comparison lenses missing"],
  ["comparison land caveat promoted",html=>html.replace("no surveyed level, cut, fill, setback or buildable-envelope claim","surveyed level and buildable envelope verified"),"architectural comparison land lens"],
  ["comparison living caveat removed",html=>html.replace("view performance remain unverified","view performance verified"),"architectural comparison living lens"],
  ["comparison review silently selects",html=>html.replace("setActiveCandidate(candidate.candidate_id);setMode('REALISTIC')","sessionSelectedCandidateId=candidate.candidate_id;setMode('REALISTIC')"),"silently selecting a scheme"],
  ["comparison raycast left binary",html=>html.replace("conceptComparison?3:2","conceptComparison?2:2"),"three synchronized viewports"],
  ["comparison orbit framing removed",html=>html.replace("THREE ORBITABLE ARCHITECTURAL CONCEPTS","THREE STATIC ARCHITECTURAL CONCEPTS"),"framing, orbitability or performance"],
  ["comparison white horizon restored",html=>html.replace("sky.userData.currentSiteClutter=true","sky.userData.currentSiteClutter=false"),"repeats a white sky-horizon slab"],
  ["comparison viewport separators removed",html=>html.replaceAll(".scheme-compare-labels:not(.hidden)",".scheme-compare-labels"),"viewports lack deliberate full-height separation"]
];
for(const [name,mutate,needle] of architecturalComparisonViewerAttacks){
  const result=validateArchitecturalComparisonViewer(mutate(viewerBaseline));
  assert.equal(result.ok,false,name);assert.ok(result.errors.some(e=>e.includes(needle)),`${name}: ${result.errors.join(" | ")}`);
}

const architecturalIntentViewerAttacks=[
  ["intent layer removed",html=>html.replace(");buildCandidateIntent(candidate,group);",");void candidate;"),"architectural intent layer"],
  ["arrival intent promoted",html=>html.replace("formIntent.userData.evidenceClass='CONCEPT'","formIntent.userData.evidenceClass='AUTHORITATIVE'"),"concept arrival intent"],
  ["relative ground promoted",html=>html.replace("landIntent.userData.evidenceClass='DERIVED_RELATIVE_UNCALIBRATED'","landIntent.userData.evidenceClass='SURVEYED'"),"relative ground intent"],
  ["reported view promoted",html=>html.replace("viewArrow.userData.evidenceClass='REPORTED_UNVERIFIED'","viewArrow.userData.evidenceClass='AUTHORITATIVE'"),"reported view intent"],
  ["solar intent frozen",html=>html.replace("candidateSolarArrows.forEach(arrow=>arrow.setDirection(solarDirection))","void solarDirection"),"derived solar intent"],
  ["3D lens binding removed",html=>html.replace("o.userData.intentLens===comparisonLensId","true"),"comparison lenses do not control"],
  ["intent limitation promoted",html=>html.replace("INTENT OVERLAYS DO NOT VERIFY VIEW, SOLAR PERFORMANCE, ACCESS OR FINISHED LEVELS","INTENT OVERLAYS VERIFY VIEW, SOLAR PERFORMANCE, ACCESS AND FINISHED LEVELS"),"architectural intent evidence disclosure"]
];
for(const [name,mutate,needle] of architecturalIntentViewerAttacks){
  const result=validateArchitecturalIntentViewer(mutate(viewerBaseline));
  assert.equal(result.ok,false,name);assert.ok(result.errors.some(e=>e.includes(needle)),`${name}: ${result.errors.join(" | ")}`);
}

const providerAttacks=[
  ["provider schema mutated",m=>m.schema_version="svartinge-context-providers/v9","provider schema version drift"],
  ["external source marked connected",m=>m.providers.find(x=>x.provider_id==="MAPBOX_STANDARD_SATELLITE").state="CONNECTED","provider connection set drift"],
  ["municipal live source disconnected",m=>m.providers.find(x=>x.provider_id==="NORRKOPING_ORTHOPHOTO").state="DOCUMENTED_NOT_CONNECTED","provider connection set drift"],
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
const aerialHistoryAttacks=[
  ["aerial axis swapped",m=>m.service.axis_order="EASTING_NORTHING","municipal aerial WMS axis order drift"],
  ["aerial layer removed",m=>m.live_layers.pop(),"municipal aerial history layer set incomplete"],
  ["aerial title changed",m=>m.live_layers[0].service_title="Aerial 2008","municipal aerial layer identity drift"],
  ["year promoted to capture date",m=>m.live_layers[0].year_label_is_verified_capture_date=true,"municipal aerial layer over-promoted or persisted"],
  ["provider pixels persisted",m=>m.live_layers[0].response_persisted=true,"municipal aerial layer over-promoted or persisted"],
  ["aerial response hash changed",m=>m.live_layers[0].response_sha256="0".repeat(64),"municipal aerial response receipt drift"],
  ["aerial tracing enabled",m=>m.rendering_policy.geometry_extraction_allowed=true,"municipal aerial evidence policy promoted"],
  ["aerial evidence promoted",m=>m.rendering_policy.evidence_promotion_allowed=true,"municipal aerial evidence policy promoted"],
  ["aerial gate closed",m=>m.gate.status="SATISFIED","municipal aerial provenance gate closed or changed"]
];
for(const [name,mutate,needle] of aerialHistoryAttacks){
  const changed=structuredClone(aerialHistoryBaseline);mutate(changed);const result=validateMunicipalAerialHistory(changed);
  assert.equal(result.ok,false,name);assert.ok(result.errors.some(e=>e.includes(needle)),`${name}: ${result.errors.join(" | ")}`);
}
const visualReconstructionAttacks=[
  ["visual promoted to photograph",m=>m.policy.is_source_photograph=true,"visual reconstruction evidence policy promoted"],
  ["visual promoted to survey",m=>m.policy.is_survey_evidence=true,"visual reconstruction evidence policy promoted"],
  ["visual closes gate",m=>m.policy.closes_evidence_gate=true,"visual reconstruction evidence policy promoted"],
  ["provider pixels claimed",m=>m.policy.provider_pixels_in_asset=true,"visual reconstruction evidence policy promoted"],
  ["visual geometry extraction",m=>m.policy.geometry_extraction_allowed=true,"visual reconstruction evidence policy promoted"],
  ["visual asset hash drift",m=>m.renderings[0].asset_sha256="0".repeat(64),"visual reconstruction asset identity drift"],
  ["visual viewpoint removed",m=>m.renderings.pop(),"visual reconstruction set incomplete"],
  ["visual viewpoint duplicated",m=>m.renderings[3].rendering_id=m.renderings[0].rendering_id,"visual reconstruction viewpoint drift"],
  ["stage asset swapped",m=>m.renderings[2].asset_path=m.renderings[3].asset_path,"visual reconstruction asset identity drift"],
  ["visual hard gate removed",m=>m.policy.blocked_claims.pop(),"visual reconstruction hard gates changed"],
  ["visual unknown field",m=>m.current_condition_verified=true,"visual reconstruction: unknown or missing fields"]
];
for(const [name,mutate,needle] of visualReconstructionAttacks){
  const changed=structuredClone(visualReconstructionBaseline);mutate(changed);const result=validateVisualReconstruction(changed);
  assert.equal(result.ok,false,name);assert.ok(result.errors.some(e=>e.includes(needle)),`${name}: ${result.errors.join(" | ")}`);
}
const designStudiesAttacks=[
  ["candidate falsely selected",m=>m.policy.selected_candidate_id="VIEW_BAR","design candidate policy promoted"],
  ["candidate evidence promoted",m=>m.candidates[0].evidence_class="DERIVED","concept evidence or signals invalid"],
  ["candidate hard gate removed",m=>m.policy.blocked_claims.pop(),"design candidate hard gates changed"],
  ["candidate falsely ranked",m=>m.intent_pipeline.ranking_state="RANKED","design intent pipeline incomplete or falsely ranked"],
  ["candidate leaves display plot",m=>m.candidates[0].volumes[0].position_xz_m=[200,200],"preview massing leaves indicative display polygon"],
  ["candidate footprint drift",m=>m.candidates[0].footprint_m2+=1,"footprint or concept GFA drift"],
  ["candidate scene drift",m=>m.scene_ref.scene_id="OTHER","design candidate scene binding drift"],
  ["candidate legal effect invented",m=>m.policy.legal_effect="APPROVED","design candidate policy promoted"],
  ["candidate geometry promoted",m=>m.policy.geometry_scope="APPROVED_BIM","design candidate policy promoted"],
  ["candidate architecture promoted",m=>m.candidates[0].presentation_profile.presentation_only=false,"architectural presentation profile promoted or invalid"],
  ["candidate roof strategies collapsed",m=>m.candidates[2].presentation_profile.roof_form=m.candidates[0].presentation_profile.roof_form,"design candidates do not exercise three distinct roof strategies"],
  ["candidate arrival strategies collapsed",m=>m.candidates[2].presentation_profile.arrival_expression=m.candidates[0].presentation_profile.arrival_expression,"design candidates do not exercise three distinct arrival_expression strategies"],
  ["candidate outdoor rooms collapsed",m=>m.candidates[2].presentation_profile.outdoor_room_type=m.candidates[0].presentation_profile.outdoor_room_type,"design candidates do not exercise three distinct outdoor_room_type strategies"],
  ["candidate terrain responses collapsed",m=>m.candidates[2].presentation_profile.terrain_response_expression=m.candidates[0].presentation_profile.terrain_response_expression,"design candidates do not exercise three distinct terrain_response_expression strategies"],
  ["candidate terrain levels collapsed",m=>m.candidates.find(candidate=>candidate.candidate_id==="COURTYARD_EDGE").volumes[1].display_level_offset_m=0,"concept terrain-response geometry drift"],
  ["candidate facade rhythms collapsed",m=>m.candidates[2].presentation_profile.facade_rhythm=m.candidates[0].presentation_profile.facade_rhythm,"design candidates do not exercise three distinct facade_rhythm strategies"],
  ["candidate arrival enum invalid",m=>m.candidates[0].presentation_profile.arrival_expression="CARPORT_GATE","architectural presentation profile promoted or invalid"],
  ["candidate design evidence thinned",m=>m.candidates[0].design_signals.pop(),"concept evidence or signals invalid"],
  ["candidate roof made implausible",m=>m.candidates[0].presentation_profile.roof_rise_m=9,"architectural presentation dimensions invalid"],
  ["candidate terrace leaves plot",m=>m.candidates[0].presentation_profile.terrace_depth_m=30,"architectural presentation dimensions invalid"],
  ["candidate presentation field injected",m=>m.candidates[0].presentation_profile.approved_material=true,"presentation: unknown or missing fields"],
  ["candidate unknown field",m=>m.approved=true,"design candidate studies: unknown or missing fields"]
];
for(const [name,mutate,needle] of designStudiesAttacks){
  const changed=structuredClone(designStudiesBaseline);mutate(changed);const result=validateDesignCandidateStudies(changed,{scene:baseline});
  assert.equal(result.ok,false,name);assert.ok(result.errors.some(e=>e.includes(needle)),`${name}: ${result.errors.join(" | ")}`);
}
const visualAcceptanceAttacks=[
  ["visual acceptance version mutated",m=>m.schema_version="svartinge-visual-acceptance/v9","visual acceptance identity drift"],
  ["automated approval enabled",m=>m.policy.automated_visual_approval_allowed=true,"visual acceptance policy weakened"],
  ["explicit approval disabled",m=>m.policy.explicit_user_approval_required=false,"visual acceptance policy weakened"],
  ["browser security bypass enabled",m=>m.policy.browser_security_workarounds_allowed=true,"visual acceptance policy weakened"],
  ["canonical view removed",m=>m.canonical_views.pop(),"five-view visual acceptance set incomplete or reordered"],
  ["canonical views reordered",m=>m.canonical_views.reverse(),"five-view visual acceptance set incomplete or reordered"],
  ["comparison changed to realistic",m=>m.canonical_views[4].renderer_mode="REALISTIC","canonical stage or renderer mode drift"],
  ["view falsely approved",m=>m.canonical_views[0].acceptance_state="APPROVED","approval lacks user-reviewed visual artifact"],
  ["pending blockers erased",m=>m.canonical_views[0].blockers=[],"pending visual state lost required blockers"],
  ["pending review evidence invented",m=>m.canonical_views[0].review_evidence.reviewer="USER","pending visual state lost required blockers or invented review evidence"],
  ["aggregate falsely approved",m=>m.review_state="APPROVED","visual acceptance aggregate state is inconsistent"],
  ["user approval invented",m=>m.user_approval={confirmation:"APPROVED_BY_USER",reviewed_at:"2026-08-24T20:00:00Z",approved_view_ids:m.canonical_views.map(view=>view.view_id)},"user approval was invented before all five views passed"],
  ["viewer hash drift",m=>m.viewer_ref.sha256="0".repeat(64),"visual acceptance viewer binding or hash mismatch"],
  ["scene hash drift",m=>m.scene_ref.sha256="0".repeat(64),"visual acceptance scene hash mismatch"],
  ["visual acceptance unknown field",m=>m.self_score=10,"visual acceptance: unknown or missing fields"]
];
for(const [name,mutate,needle] of visualAcceptanceAttacks){
  const changed=structuredClone(visualAcceptanceBaseline);mutate(changed);const result=validateVisualAcceptance(changed,{scene:baseline});
  assert.equal(result.ok,false,name);assert.ok(result.errors.some(e=>e.includes(needle)),`${name}: ${result.errors.join(" | ")}`);
}
console.log(`Svärtinge 3D prototype mutation suite passed (${attacks.length+terrainViewerAttacks.length+terrainShadingViewerAttacks.length+streetApproachViewerAttacks.length+neighbourhoodDetailViewerAttacks.length+contextBuildingLodViewerAttacks.length+architecturalHeroViewerAttacks.length+architecturalComparisonViewerAttacks.length+architecturalIntentViewerAttacks.length+providerAttacks.length+streetAttacks.length+terrainAttacks.length+officialGeometryAttacks.length+aerialHistoryAttacks.length+visualReconstructionAttacks.length+designStudiesAttacks.length+visualAcceptanceAttacks.length} attacks)`);
