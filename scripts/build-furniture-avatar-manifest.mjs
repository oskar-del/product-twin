import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(root, "data/geometry/manifests/furniture-avatar-manifest-v0.1.json");
const sha = p => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, p))).digest("hex");
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const reviewPath = "data/evidence/furniture-avatar-manifest-v0.1-visual-review.json";
const visualReview = fs.existsSync(path.join(root, reviewPath)) ? read(reviewPath) : null;

const selections = [
  {role:"SOFA", twin:"PT_IKEA_KIVIK_49440597", front:[0,0,-1], clearance:[{role:"FRONT_APPROACH",distance_mm:700}], prefs:{wall:"BACK_TO_WALL_PREFERRED",centre:"ALLOWED", rel:["FACE_COFFEE_TABLE","ANCHOR_LOUNGE_GROUP"]}},
  {role:"LOUNGE_CHAIR", twin:"PT_IKEA_POANG_39240787", front:[0,0,-1], clearance:[{role:"FRONT_APPROACH",distance_mm:600}], prefs:{wall:"NEUTRAL",centre:"PREFERRED",rel:["FACE_SOFA_OR_COFFEE_TABLE","KEEP_FRONT_APPROACH_CLEAR"]}},
  {role:"COFFEE_SIDE_TABLE", twin:"PT_IKEA_LISTERBY_30513904", front:null, clearance:[{role:"SOFA_GAP",distance_mm:420},{role:"CIRCULATION",distance_mm:600}], prefs:{wall:"AVOID",centre:"PREFERRED",rel:["CENTRE_ON_SOFA","MAINTAIN_SOFA_GAP"]}},
  {role:"FLOOR_LAMP", twin:"PT_IKEA_LAUTERS_30405042", front:null, clearance:[{role:"SERVICE",distance_mm:100}], prefs:{wall:"NEAR_WALL_ALLOWED",centre:"AVOID",rel:["PLACE_BESIDE_SOFA_OR_LOUNGE_CHAIR","KEEP_CORD_ROUTE_CLEAR"]}}
];
const twinFiles = Object.fromEntries(selections.map(s => [s.twin, `data/twins/${s.twin}.json`]));

function productAsset(s) {
  const t = read(twinFiles[s.twin]);
  const metric = read(t.geometry.qa_metric);
  const p = t.geometry.asset_path;
  const d = t.physical.dimensions_mm;
  const source = t.external_identities[0].product_url;
  return {
    asset_id:t.geometry.avatar_id, primary_selection:true, role:s.role, record_lane:"PRODUCT_TWIN",
    product_identity:{verification_state:"VERIFIED_EXACT",twin_id:t.twin_id,manufacturer:t.identity.manufacturer,family:t.identity.product_family,model:t.identity.model,article_no:t.identity.article_no,source_url:source},
    geometry:{uri:p,sha256:sha(p),format:"GLB",bytes:fs.statSync(path.join(root,p)).size,level:"G2",level_state:"PROMOTED_REALISTIC_PLANNING_PROXY",persistent_binary:true,runtime_ingestible:true,exact_likeness_claimed:false,disclosure:t.geometry.shape_claim},
    independent_scale:{state:"PASS",method:"OFFICIAL_DIMENSIONS_VS_PARSED_GLB_BOUNDS",evidence:[twinFiles[s.twin],t.geometry.qa_metric],max_relative_error:metric.relative_error_max},
    dimensions:{...d,unit:"mm"}, orientation:{up_axis:"Y",handedness:"RIGHT_HANDED",origin:"FLOOR_CENTER",floor_anchor:"MIN_Y_EQ_0",front_state:s.front?"DECLARED":"NON_DIRECTIONAL",front_vector:s.front},
    collision_envelope:{...d,unit:"mm"}, functional_clearance:{state:"DECLARED_PLANNING",zones:s.clearance},
    placement:{roles:[s.role,"RESIDENTIAL_LOUNGE"],wall_preference:s.prefs.wall,centre_preference:s.prefs.centre,furniture_relationships:s.prefs.rel},
    dimensional_confidence:"HIGH_INDEPENDENT_SCALE_PASS",
    appearance:{confidence:"MEDIUM",state:"VARIANT_COLOUR_AND_ROUGHNESS_CUES_ONLY",materials:t.geometry.appearance.material_cues,exact_finish_claimed:false,pbr_state:t.geometry.appearance.pbr_state,texture_evidence:["NO_EMBEDDED_TEXTURES","NO_MANUFACTURER_TEXTURE_ARTWORK_COPIED"]},
    provenance:[{kind:"PRODUCT_TWIN_RECORD",uri:twinFiles[s.twin],sha256:sha(twinFiles[s.twin])},{kind:"GEOMETRY_QA_METRIC",uri:t.geometry.qa_metric,sha256:sha(t.geometry.qa_metric)},{kind:"CANONICAL_VISUAL_REVIEW",uri:reviewPath,sha256:visualReview?sha(reviewPath):null}],
    rights:{source_state:"PROJECT_AUTHORED_GEOMETRY",derivative_state:"NO_MANUFACTURER_GEOMETRY_OR_TEXTURE_COPIED",redistribution_state:"PROJECT_PROXY_ALLOWED",rendering_state:"INTERNAL_PROJECT_PROXY_ALLOWED",evidence:[twinFiles[s.twin],t.geometry.qa_metric]},
    attribution:{required:true,display_text:`${t.identity.manufacturer} ${t.identity.product_family} ${t.identity.article_no}; Product Twin planning proxy, not manufacturer geometry.`,source_url:source,display_state:"PARTIAL_IDENTITY_SOURCE_DISCLOSURE",required_surfaces:["ROOM_OBJECT_DETAILS","AVATAR_GALLERY","EXPORTED_SCENE_CREDITS"]},
    publication:{state:"INTERNAL_ROOM_ALPHA_READY_PUBLIC_BLOCKED",internal_ingest_allowed:true,public_allowed:false,blockers:["INDEPENDENT_RIGHTS_APPROVAL_NOT_RECORDED","ATTRIBUTION_DISPLAY_NOT_VERIFIED_ON_ALL_REQUIRED_SURFACES"]},
    verification_required:["Approve project-authored proxy derivative/right status","Verify canonical-view QA evidence","Verify attribution on every required Room Lab surface"]
  };
}

const arperMetricPath = "data/metrics/arper-ply-3853-g3-v0-1-glb-qa-latest.json";
const arperRightsPath = "data/rights/arper-ply-3853-rights-and-rfq.json";
const arperTargetPath = "config/geometry/arper-ply-3853-target.json";
const arperMetric = read(arperMetricPath);
const arperTarget = read(arperTargetPath);
const sourceUrl = "https://arper-cdn.thron.com/delivery/public/document/arper/e7270421-ade5-487d-85fd-8d6a80c3db5f/jd4oic/WEB/Arper_Ply_3D_table_h36cm_55x54cm_3853.3DS";
const arper = {
  asset_id:"AVATAR_ARPER_PLY_3853_EXACT_GEOMETRY_CANDIDATE",primary_selection:false,role:"COFFEE_SIDE_TABLE",record_lane:"PRODUCT_TWIN",
  product_identity:{verification_state:"VERIFIED_EXACT",twin_id:"PT_ARPER_PLY_3853",manufacturer:"Arper",family:"Ply Table",model:"Ply Table low table, small top, wood legs",article_no:"3853",source_url:arperTarget.manufacturer_page},
  geometry:{uri:sourceUrl,sha256:"056266beb2cbea1af1cc91bcab74dccb46620ebc55464276d1d22f90f8977e9a",format:"3DS",bytes:null,level:"G2",level_state:"G3_CANDIDATE_NOT_PROMOTED",persistent_binary:false,runtime_ingestible:false,exact_likeness_claimed:true,disclosure:"Exact manufacturer geometry candidate; no persistent binary, approved PBR finish, or commercial rendering right."},
  independent_scale:{state:"PASS",method:"MANUFACTURER_DIMENSIONS_VS_TRANSIENT_CONVERTED_BOUNDS",evidence:[arperTargetPath,arperMetricPath],max_relative_error:0.001255},
  dimensions:{width:550,depth:540,height:360,unit:"mm"},orientation:{up_axis:"Y",handedness:"RIGHT_HANDED",origin:"FLOOR_CENTER",floor_anchor:"MIN_Y_EQ_0",front_state:"NON_DIRECTIONAL",front_vector:null},
  collision_envelope:{width:550,depth:540,height:360,unit:"mm"},functional_clearance:{state:"UNVERIFIED",zones:[]},
  placement:{roles:["COFFEE_SIDE_TABLE","RESIDENTIAL_LOUNGE"],wall_preference:"NEUTRAL",centre_preference:"ALLOWED",furniture_relationships:["CLEARANCE_NOT_VERIFIED"]},dimensional_confidence:"HIGH_MANUFACTURER_SCALE_PASS",
  appearance:{confidence:"LOW",state:"GEOMETRY_ONLY_FINISH_UNAPPROVED",materials:["WOOD_LEGS_DECLARED_BY_MODEL_NAME"],exact_finish_claimed:false,pbr_state:"NO_APPROVED_PBR",texture_evidence:["NO_APPROVED_TEXTURE_EVIDENCE"]},
  provenance:[{kind:"MANUFACTURER_3DS_SOURCE",uri:sourceUrl,sha256:"056266beb2cbea1af1cc91bcab74dccb46620ebc55464276d1d22f90f8977e9a"},{kind:"TRANSIENT_GEOMETRY_QA",uri:arperMetricPath,sha256:sha(arperMetricPath)},{kind:"RIGHTS_REVIEW",uri:arperRightsPath,sha256:sha(arperRightsPath)}],
  rights:{source_state:"MANUFACTURER_PROTECTED_CONTENT",derivative_state:"BLOCKED_WITHOUT_WRITTEN_PERMISSION",redistribution_state:"BLOCKED_WITHOUT_PERMISSION",rendering_state:"BLOCKED_WITHOUT_PERMISSION",evidence:[arperRightsPath]},
  attribution:{required:true,display_text:"Arper Ply Table #3853 — manufacturer geometry; use blocked pending written permission.",source_url:arperTarget.manufacturer_page,display_state:"BLOCKED_NO_AUTHORIZED_DISPLAY",required_surfaces:["NOT_PUBLIC_UNTIL_PERMISSION"]},
  publication:{state:"BLOCKED_RIGHTS",internal_ingest_allowed:false,public_allowed:false,blockers:["WRITTEN_COMMERCIAL_RENDERING_PERMISSION_MISSING","REDISTRIBUTION_PERMISSION_MISSING","PERSISTENT_BINARY_FORBIDDEN","APPROVED_PBR_MATERIAL_MISSING","FUNCTIONAL_CLEARANCE_UNVERIFIED"]},
  verification_required:["Obtain and ingest written Arper permission","Approve persistent storage and derivative terms","Approve exact material/PBR configuration","Verify functional clearance and attribution display"]
};

export function validateManifest(m) {
  const errors=[]; const ids=new Set();
  if(m.manifest_id!=="FURNITURE_AVATAR_MANIFEST_V0_1"||m.version!=="0.1") errors.push("identity");
  if(m.selected_roles.length!==4||new Set(m.selected_roles).size!==4) errors.push("selected_roles");
  for(const a of m.assets){
    if(ids.has(a.asset_id)) errors.push(`duplicate:${a.asset_id}`); ids.add(a.asset_id);
    if(a.record_lane==="DESIGN_ASSET"&&a.product_identity!==null) errors.push(`design_asset_identity:${a.asset_id}`);
    if(a.record_lane==="DESIGN_ASSET"&&containsCommerce(a)) errors.push(`design_asset_commerce:${a.asset_id}`);
    if(a.record_lane==="PRODUCT_TWIN"&&a.product_identity?.verification_state!=="VERIFIED_EXACT") errors.push(`unverified_identity:${a.asset_id}`);
    if(a.geometry.level==="G1"&&a.publication.public_allowed) errors.push(`g1_public:${a.asset_id}`);
    if(a.publication.public_allowed&&(!a.rights.redistribution_state.includes("ALLOWED")||a.publication.blockers.length)) errors.push(`unsafe_publication:${a.asset_id}`);
    if(a.geometry.exact_likeness_claimed&&a.geometry.level==="G2"&&a.geometry.level_state.includes("PROXY")) errors.push(`proxy_exact_likeness:${a.asset_id}`);
    if(a.appearance.confidence===a.dimensional_confidence) errors.push(`confidence_leak:${a.asset_id}`);
    if(!/^[a-f0-9]{64}$/.test(a.geometry.sha256)) errors.push(`geometry_hash:${a.asset_id}`);
  }
  if(m.assets.find(a=>a.asset_id.includes("ARPER"))?.publication.public_allowed) errors.push("arper_public");
  return errors;
}
function containsCommerce(value){
  const forbidden=new Set(["sku","price","stock","merchant","supplier","delivery","procurement"]);
  if(Array.isArray(value)) return value.some(containsCommerce);
  if(value&&typeof value==="object") return Object.entries(value).some(([k,v])=>forbidden.has(k.toLowerCase())||containsCommerce(v));
  return false;
}

export function buildManifest(){
  const assets=[...selections.map(productAsset),arper];
  const manifest={manifest_id:"FURNITURE_AVATAR_MANIFEST_V0_1",version:"0.1",record_type:"FURNITURE_AVATAR_MANIFEST",consumer:"MANIFEST_DRIVEN_ROOM_ALPHA",policy:{commerce_separate:true,destination_supply_separate:true,exact_identity_rule:"Exact product identity is independent evidence; project-authored approximate geometry never claims exact likeness.",public_fail_closed:true},selected_roles:selections.map(s=>s.role),summary:{primary_assets:4,supplemental_blocked_assets:1,internal_ingestible:assets.filter(a=>a.publication.internal_ingest_allowed).length,publicly_publishable:assets.filter(a=>a.publication.public_allowed).length},assets};
  const errors=validateManifest(manifest); if(errors.length) throw new Error(errors.join(", "));
  return manifest;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  fs.mkdirSync(path.dirname(outPath),{recursive:true}); fs.writeFileSync(outPath,JSON.stringify(buildManifest(),null,2)+"\n");
  console.log(path.relative(root,outPath));
}
