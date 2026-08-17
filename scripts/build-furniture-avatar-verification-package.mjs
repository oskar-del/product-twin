import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const output="data/verification/packages/furniture-avatar-manifest-v0.1-package-2.json";
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const hash=p=>crypto.createHash("sha256").update(fs.readFileSync(path.join(root,p))).digest("hex");
const artifactPaths=[
  ["MANIFEST","data/geometry/manifests/furniture-avatar-manifest-v0.1.json"],
  ["MANIFEST_SCHEMA","config/geometry/furniture-avatar-manifest-v0.1.schema.json"],
  ["CANONICAL_QA_METRIC","data/metrics/furniture-avatar-manifest-v0.1-qa.json"],
  ["VISUAL_REVIEW","data/evidence/furniture-avatar-manifest-v0.1-visual-review.json"],
  ["MANIFEST_BUILDER","scripts/build-furniture-avatar-manifest.mjs"],
  ["MANIFEST_MUTATION_TEST","scripts/test-build-furniture-avatar-manifest.mjs"],
  ["QA_RENDERER","scripts/render-furniture-avatar-manifest-qa.py"],
  ["QA_TEST","scripts/test-render-furniture-avatar-manifest-qa.mjs"],
  ["BRAIN_CHECKPOINT","docs/handoffs/FURNITURE-AVATAR-MANIFEST-V0.1.md"],
  ["PERMANENT_AVATAR_FACTORY_HANDOFF","docs/handoffs/AVATAR-FACTORY.md"],
  ["PACKAGE_SCHEMA","config/verification/furniture-avatar-verification-package-v0.1.schema.json"],
  ["GEOMETRY_LEVEL_CONTRACT","config/geometry/avatar-levels.json"],
  ["ARPER_RIGHTS_REVIEW","data/rights/arper-ply-3853-rights-and-rfq.json"]
];
function qaArtifactPaths(qa){
  const base=qa.qa_pack.directory;
  const paths=[["QA_MASTER_CONTACT_SHEET",`${base}/${qa.qa_pack.master_contact_sheet}`]];
  for(const asset of qa.assets){
    for(const view of asset.views)paths.push([`QA_VIEW_${asset.role}_${view.view}`,`${base}/${asset.asset_directory}/${view.file}`]);
    paths.push([`QA_CONTACT_SHEET_${asset.role}`,`${base}/${asset.asset_directory}/${asset.contact_sheet.file}`]);
  }
  return paths;
}

export function validateVerificationPackage(p,{checkFiles=false}={}){
  const errors=[];
  if(p.package_number!==2||p.package_id!=="VERIFICATION_PACKAGE_2_FURNITURE_AVATAR_MANIFEST_V0_1")errors.push("package_identity");
  if(p.merge_authorized!==false||p.publication_authorized!==false)errors.push("authority_escalation");
  if(p.expected_gate_state.internal_room_alpha_ingestible!==4||p.expected_gate_state.publicly_publishable!==0)errors.push("gate_counts");
  if(p.expected_gate_state.arper_runtime_ingestible!==false||p.expected_gate_state.arper_publicly_publishable!==false)errors.push("arper_gate");
  if(new Set(p.artifacts.map(a=>a.path)).size!==p.artifacts.length)errors.push("duplicate_artifact");
  if(p.canonical_evidence.views!==28||p.canonical_evidence.contact_sheets!==5||p.canonical_evidence.git_policy!=="COMMITTED_REVIEW_EVIDENCE")errors.push("canonical_inventory");
  if(p.asset_decisions.length!==5||p.asset_decisions.some(a=>!a.pass_reasons.length||!a.block_reasons.length))errors.push("asset_decisions");
  if(p.asset_decisions.some(a=>a.public_publication!=="BLOCKED"))errors.push("asset_publication");
  if(p.claims_for_verification.some(c=>typeof c.reason!=="string"||!c.reason.trim()))errors.push("claim_reason");
  if(!p.claims_for_verification.some(c=>c.id==="PUBLIC_PUBLICATION"&&c.expected==="BLOCKED"))errors.push("public_claim");
  if(!p.claims_for_verification.some(c=>c.id==="ARPER_RIGHTS_AND_PUBLICATION"&&c.expected==="BLOCKED"))errors.push("arper_claim");
  if(checkFiles)for(const a of p.artifacts){const full=path.join(root,a.path);if(!fs.existsSync(full))errors.push(`missing:${a.path}`);else if(hash(a.path)!==a.sha256)errors.push(`hash:${a.path}`);}
  return errors;
}

export function buildVerificationPackage(){
  const manifest=read("data/geometry/manifests/furniture-avatar-manifest-v0.1.json");
  const qa=read("data/metrics/furniture-avatar-manifest-v0.1-qa.json");
  const p={
    package_id:"VERIFICATION_PACKAGE_2_FURNITURE_AVATAR_MANIFEST_V0_1",package_number:2,version:"0.1",status:"READY_FOR_INDEPENDENT_VERIFICATION",subject:"LIVING_ROOM_ALPHA_FURNITURE_MANIFEST",source_branch:"agent/avatar-factory-source-graph",merge_authorized:false,publication_authorized:false,
    scope:{primary_assets:manifest.summary.primary_assets,supplemental_blocked_assets:manifest.summary.supplemental_blocked_assets,roles:manifest.selected_roles},
    artifacts:[...artifactPaths,...qaArtifactPaths(qa)].map(([role,p])=>({role,path:p,sha256:hash(p),required:true})),
    canonical_evidence:{git_policy:"COMMITTED_REVIEW_EVIDENCE",directory:qa.qa_pack.directory,views:qa.summary.rendered_views,contact_sheets:qa.summary.assets+1,master_contact_sheet_sha256:qa.qa_pack.master_contact_sheet_sha256,reproducible:true},
    asset_decisions:manifest.assets.map(a=>({asset_id:a.asset_id,role:a.role,geometry_level:a.geometry.level,internal_ingest:a.publication.internal_ingest_allowed?"PASS":"BLOCKED",public_publication:"BLOCKED",pass_reasons:a.publication.internal_ingest_allowed?["VERIFIED_EXACT_PRODUCT_IDENTITY","PROJECT_AUTHORED_G2_PROXY_DISCLOSED_AS_NON_EXACT","INDEPENDENT_SCALE_PASS","CANONICAL_VISUAL_QA_PASS","FLOOR_ANCHOR_AND_COLLISION_ENVELOPE_PASS"]:["EXACT_MANUFACTURER_IDENTITY_VERIFIED","TRANSIENT_GEOMETRY_SCALE_QA_PASS"],block_reasons:a.publication.blockers})),
    claims_for_verification:[
      {id:"MANIFEST_CONTRACT",expected:"PASS",reason:"Versioned strict schema and deterministic builder define every required furniture-avatar axis.",evidence:["data/geometry/manifests/furniture-avatar-manifest-v0.1.json","config/geometry/furniture-avatar-manifest-v0.1.schema.json"]},
      {id:"FOUR_PRIMARY_ROLE_SELECTION",expected:"PASS",reason:"Exactly one sofa, lounge chair, coffee/side table and floor lamp are marked primary.",evidence:["data/geometry/manifests/furniture-avatar-manifest-v0.1.json"]},
      {id:"PRODUCT_IDENTITY_SEPARATE_FROM_PROXY_LIKENESS",expected:"PASS",reason:"Exact retail identities are verified separately while every project proxy sets exact_likeness_claimed false.",evidence:["scripts/test-build-furniture-avatar-manifest.mjs"]},
      {id:"PRODUCT_TWIN_DESIGN_ASSET_LEAKAGE_DEFENCE",expected:"PASS",reason:"Mutations injecting exact identity or commerce into the Design Asset lane fail deterministically.",evidence:["scripts/test-build-furniture-avatar-manifest.mjs"]},
      {id:"WORLD_TRANSFORMED_DIMENSIONS_AND_FLOOR_CONTACT",expected:"PASS",reason:"Parsed node transforms yield exact declared envelopes, zero floor-contact error and centred X/Z pivots for all four primaries.",evidence:["data/metrics/furniture-avatar-manifest-v0.1-qa.json"]},
      {id:"CANONICAL_SEVEN_VIEW_QA",expected:"PASS",reason:"All four primaries have front, rear, left, right, three-quarter, top and floor-contact evidence with recorded pre-Verification review.",evidence:["data/metrics/furniture-avatar-manifest-v0.1-qa.json","data/evidence/furniture-avatar-manifest-v0.1-visual-review.json"]},
      {id:"G2_ONLY_APPEARANCE_DISCLOSURE",expected:"PASS",reason:"Appearance remains medium-confidence material cues without embedded exact textures, so no primary is promoted beyond G2.",evidence:["data/geometry/manifests/furniture-avatar-manifest-v0.1.json"]},
      {id:"INTERNAL_ROOM_ALPHA_INGEST",expected:"PASS",reason:"Four project-authored G2 planning proxies have scale, anchor, collision, clearance and disclosure records required for internal planning.",evidence:["data/geometry/manifests/furniture-avatar-manifest-v0.1.json"]},
      {id:"PUBLIC_PUBLICATION",expected:"BLOCKED",reason:"Independent public-rights approval and complete attribution-display verification are not recorded for the four primaries.",evidence:["data/geometry/manifests/furniture-avatar-manifest-v0.1.json"]},
      {id:"ARPER_RIGHTS_AND_PUBLICATION",expected:"BLOCKED",reason:"Written commercial-rendering and redistribution permission, persistent-binary permission, approved PBR and functional clearance are missing.",evidence:["data/rights/arper-ply-3853-rights-and-rfq.json","data/geometry/manifests/furniture-avatar-manifest-v0.1.json"]}
    ],
    claims_explicitly_not_made:["G3 render-grade fidelity","exact manufacturer geometry for the four primary proxies","exact product texture or finish","public redistribution approval","complete customer-facing attribution verification","procurement readiness","destination availability"],
    expected_gate_state:{internal_room_alpha_ingestible:manifest.summary.internal_ingestible,publicly_publishable:manifest.summary.publicly_publishable,arper_runtime_ingestible:false,arper_publicly_publishable:false},
    verification_requests:["Recompute every required artifact SHA-256","Run the manifest mutation suite","Re-render the canonical pack and compare metric invariants","Inspect front/rear orientation and floor contact from runtime contact sheets","Independently assess project-proxy derivative/public rendering rights","Verify attribution on every required Room Lab surface","Confirm Arper remains blocked without written permission","Confirm commerce and destination-supply data remain absent"],
    reproduction:{commands:["npm run furniture:avatar:manifest","npm run furniture:avatar:manifest:test","npm run furniture:avatar:qa:render","npm run furniture:avatar:qa:test","npm run furniture:avatar:verification:package","npm run furniture:avatar:verification:test","git diff --check"],expected:["5 manifest records: 4 primary plus 1 blocked Arper candidate","4 internal-ingestible primary assets","0 publicly publishable assets","28 canonical views and 5 contact sheets","all mutation tests pass","all 238 or more config/data JSON files parse","clean whitespace diff gate"]},
    mutation_coverage:["Design Asset exact-product identity injection","Design Asset commerce-field injection","unverified Product Twin identity","G1 public promotion","unresolved-rights public promotion","proxy exact-likeness escalation","appearance/dimensional-confidence collapse","geometry hash corruption","Arper publication bypass","package authority escalation","package gate-count escalation","package artifact hash corruption","canonical evidence count mutation"]
  };
  const errors=validateVerificationPackage(p,{checkFiles:true});if(errors.length)throw new Error(errors.join(", "));return p;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const p=buildVerificationPackage();const target=path.join(root,output);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(p,null,2)+"\n");console.log(output);
}
