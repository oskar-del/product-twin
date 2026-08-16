import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const RUNTIME=path.join(ROOT,".runtime/shopify");
const projectId="PROJECT_MARBELLA_VILLA_001";
const slug=projectId.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
let offers={slots:[]};
try{offers=JSON.parse(await fs.readFile(path.join(RUNTIME,"offers.json"),"utf8"));}catch{}

async function walkJson(dir,out=[]){
  let entries=[];try{entries=await fs.readdir(dir,{withFileTypes:true});}catch{return out;}
  for(const entry of entries){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory())await walkJson(p,out);
    else if(entry.isFile()&&entry.name.endsWith(".json")){
      try{out.push(JSON.parse(await fs.readFile(p,"utf8")));}catch{}
    }
  }
  return out;
}
const evidence=await walkJson(path.join(ROOT,"data/evidence/manufacturer"));

function norm(s){return String(s??"").toUpperCase().replace(/[^A-Z0-9]+/g," ").trim();}
function compact(s){return norm(s).replace(/\s+/g,"");}
function modelTokens(model){
  const n=norm(model);
  const c=compact(model);
  return [...new Set([n,c,...n.split(" ").filter(x=>x.length>=4)])];
}
function scoreOffer(offer,ev){
  const title=norm(offer?.title);
  const sku=norm(offer?.sku);
  const hay=norm(`${offer?.title??""} ${offer?.sku??""}`);
  const hayCompact=compact(`${offer?.title??""} ${offer?.sku??""}`);
  const manufacturer=norm(ev.subject?.manufacturer);
  const model=norm(ev.subject?.model);
  const modelCompact=compact(ev.subject?.model);
  const manufacturerHit=!!manufacturer && hay.includes(manufacturer);
  const exactModelHit=(!!model&&hay.includes(model)) || (!!modelCompact&&hayCompact.includes(modelCompact));
  const skuHit=!!ev.subject?.manufacturer_sku && (sku.includes(norm(ev.subject.manufacturer_sku))||compact(sku).includes(compact(ev.subject.manufacturer_sku)));
  let tokenHits=0;
  for(const token of modelTokens(ev.subject?.model)){if(token.length>=4&&(hay.includes(token)||hayCompact.includes(compact(token))))tokenHits++;}
  let score=0;
  if(manufacturerHit)score+=0.25;
  if(exactModelHit)score+=0.60;
  if(skuHit)score+=0.75;
  if(!exactModelHit&&!skuHit&&tokenHits>=2)score+=0.30;
  if(offer?.canonical_category_id===ev.subject?.category_id)score+=0.10;
  return {score:Math.min(1,score),manufacturerHit,exactModelHit,skuHit,tokenHits};
}

const rows=[];
for(const slot of offers.slots??[]){
  const offer=slot.best_offer;
  if(!offer)continue;
  const candidates=evidence.filter(ev=>ev.subject?.category_id===slot.category_id).map(ev=>({ev,match:scoreOffer(offer,ev)})).sort((a,b)=>b.match.score-a.match.score);
  const best=candidates[0];
  let state="UNRESOLVED";
  if(best?.match.skuHit)state="VERIFIED_BY_MANUFACTURER_SKU_SIGNAL";
  else if(best?.match.manufacturerHit&&best?.match.exactModelHit)state="LIKELY_EXACT_MODEL";
  else if((best?.match.score??0)>=0.55)state="LIKELY_MODEL";

  rows.push({
    slot_id:slot.slot_id,
    category_id:slot.category_id,
    external_reference:{
      source_id:"shopify_global_catalog",
      product_id:offer.shopify_id??null,
      variant_id:offer.variant_id??null
    },
    identity_state:state,
    matched_evidence_id:state!=="UNRESOLVED"?best?.ev?.evidence_id??null:null,
    matched_subject:state!=="UNRESOLVED"?best?.ev?.subject??null:null,
    confidence:best?Number(best.match.score.toFixed(3)):0,
    match_signals:best?{
      manufacturer_token:best.match.manufacturerHit,
      exact_model_token:best.match.exactModelHit,
      manufacturer_sku_token:best.match.skuHit,
      model_token_hits:best.match.tokenHits
    }:{},
    next_action:state==="UNRESOLVED"?"manufacturer_identity_enrichment_required":"verify merchant product maps to exact manufacturer revision/SKU before promotion"
  });
}

const summary={
  generated_at:new Date().toISOString(),
  project_id:projectId,
  live_offers_evaluated:rows.length,
  authoritative_evidence_records:evidence.length,
  likely_or_verified_identity_links:rows.filter(x=>x.identity_state!=="UNRESOLVED").length,
  unresolved:rows.filter(x=>x.identity_state==="UNRESOLVED").length,
  principle:"Persist only Product Twin identity decisions and stable external references; Shopify presentation fields used for matching remain ephemeral."
};
await fs.mkdir(path.join(ROOT,"data/identity"),{recursive:true});
await fs.writeFile(path.join(ROOT,`data/identity/${slug}.identity-links.json`),JSON.stringify({summary,links:rows},null,2));
console.log(JSON.stringify(summary,null,2));
