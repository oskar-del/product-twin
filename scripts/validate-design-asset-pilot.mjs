import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {findForbiddenDesignAssetFields} from "./lib/design-asset-truth.mjs";
import {loadTaxonomyResolver} from "./lib/taxonomy-aliases.mjs";

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const defaultPilot=path.join(repoRoot,"config/geometry/sweet-home-3d-design-asset-pilot-v0.1.json");
const requiredMarkets=["ES","SE","GB","US"];

export async function validateDesignAssetPilot(pilotPath=defaultPilot){
  const [pilot,resolveCategory]=await Promise.all([
    fs.readFile(pilotPath,"utf8").then(JSON.parse),
    loadTaxonomyResolver(repoRoot)
  ]);
  const errors=[];
  const candidates=pilot.candidates??[];
  if(pilot.status!=="CANDIDATES_MAPPED_ASSETS_NOT_DOWNLOADED")errors.push("pilot status must remain CANDIDATES_MAPPED_ASSETS_NOT_DOWNLOADED before binary intake");
  if(candidates.length<10)errors.push("pilot must map at least ten design-asset candidates");
  if(new Set(candidates.map((candidate)=>candidate.design_asset_id)).size!==candidates.length)errors.push("design_asset_id values must be unique");
  if(JSON.stringify(pilot.intake_rules?.benchmark_markets)!==JSON.stringify(requiredMarkets))errors.push("pilot benchmark markets must be ES, SE, GB and US");

  candidates.forEach((candidate,index)=>{
    const label=`candidate[${index}] ${candidate.design_asset_id??"UNKNOWN"}`;
    if(candidate.identity_scope!=="GENERIC_DESIGN_ASSET")errors.push(`${label}: identity_scope must be GENERIC_DESIGN_ASSET`);
    if(candidate.not_a_product_twin!==true)errors.push(`${label}: not_a_product_twin must be true`);
    if(candidate.replacement_search_required!==true)errors.push(`${label}: replacement_search_required must be true`);
    if(candidate.target_geometry_level!=="G2")errors.push(`${label}: target_geometry_level must be G2`);
    if(candidate.asset_state!=="CANDIDATE_NOT_DOWNLOADED")errors.push(`${label}: asset_state cannot advance before binary intake and QA`);
    if(candidate.dimensions_state!=="UNVERIFIED_LIBRARY_METADATA")errors.push(`${label}: dimensions must remain unverified before measuring the source asset`);
    try {
      const canonical=resolveCategory(candidate.category_id);
      if(canonical!==candidate.category_id)errors.push(`${label}: category ${candidate.category_id} is an alias; store canonical ${canonical}`);
    } catch (error) { errors.push(`${label}: ${error.message}`); }
    if(candidate.license?.attribution_required!==true||!candidate.license?.attribution_text)errors.push(`${label}: CC-BY attribution must be explicit`);
    if(JSON.stringify(candidate.replacement_benchmarks)!==JSON.stringify(requiredMarkets))errors.push(`${label}: replacement benchmarks must be ES, SE, GB and US`);
    for(const hit of findForbiddenDesignAssetFields(candidate,label))errors.push(`${hit}: commerce/product identity fields are forbidden in Design Assets`);
  });

  return {
    ok:errors.length===0,
    errors,
    summary:{
      candidates:candidates.length,
      categories:new Set(candidates.map((candidate)=>candidate.category_id)).size,
      benchmark_markets:requiredMarkets,
      product_identity_fields:0,
      ready_assets:candidates.filter((candidate)=>candidate.asset_state==="G2_READY").length
    }
  };
}

if(import.meta.url===pathToFileURL(process.argv[1]).href){
  const pilotPath=process.env.DESIGN_ASSET_PILOT?path.resolve(process.env.DESIGN_ASSET_PILOT):defaultPilot;
  const result=await validateDesignAssetPilot(pilotPath);
  if(!result.ok){console.error(JSON.stringify(result,null,2));process.exitCode=1;}
  else console.log(JSON.stringify(result,null,2));
}
