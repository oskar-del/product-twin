import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { resolveProjectContext } from "./project-context-resolve.mjs";

const ROOT=process.cwd();
const ENDPOINT="https://catalog.shopify.com/api/ucp/mcp";
const PROFILE=process.env.UCP_AGENT_PROFILE || "https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json";
const project=resolveProjectContext(JSON.parse(await fs.readFile(path.join(ROOT,"data/projects/marbella-villa.example.json"),"utf8")));
const test=JSON.parse(await fs.readFile(path.join(ROOT,"data/tests/whole-building-10.json"),"utf8"));
const candidates=JSON.parse(await fs.readFile(path.join(ROOT,"data/shopify/triage/latest.json"),"utf8"));

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function callMcp(toolName,catalog,attempt=1){
  const res=await fetch(ENDPOINT,{
    method:"POST",
    headers:{"content-type":"application/json","user-agent":"product-twin-offer-resolver/0.1"},
    body:JSON.stringify({jsonrpc:"2.0",id:crypto.randomUUID(),method:"tools/call",params:{
      name:toolName,
      arguments:{meta:{"ucp-agent":{profile:PROFILE}},catalog}
    }})
  });
  if(!res.ok){
    const text=await res.text();
    if(attempt<4 && [429,500,502,503,504].includes(res.status)){
      await sleep(700*attempt*attempt);
      return callMcp(toolName,catalog,attempt+1);
    }
    throw new Error(`Shopify MCP ${res.status}: ${text}`);
  }
  const json=await res.json();
  if(json.error) throw new Error(JSON.stringify(json.error));
  return json.result?.structuredContent ?? json.result;
}

function exactShipFilter(){
  return {
    country:project.location.country,
    ...(project.location.postal_code?{postal_code:project.location.postal_code}:{})
  };
}

function bestVariant(product){
  const variants=(product?.variants??[]).filter(v=>v?.availability?.available!==false && v?.price?.amount!=null);
  variants.sort((a,b)=>Number(a.price.amount)-Number(b.price.amount));
  return variants[0]??null;
}

async function resolveCandidate(c){
  const id=c.identity?.shopify_id;
  if(!id) return {candidate_id:c.candidate_id,error:"missing_shopify_product_id"};

  let detail;
  try{
    detail=await callMcp("get_product",{
      id,
      filters:{ships_to:exactShipFilter(),available:true},
      context:{
        address_country:project.location.country,
        ...(project.location.region?{address_region:project.location.region}:{}),
        ...(project.location.postal_code?{postal_code:project.location.postal_code}:{}),
        currency:project.procurement.currency
      },
      view:"summary"
    });
  }catch(error){
    return {candidate_id:c.candidate_id,shopify_id:id,error:String(error?.message??error)};
  }

  const product=detail?.product;
  const variant=bestVariant(product);
  if(!product || !variant){
    return {
      candidate_id:c.candidate_id,
      shopify_id:id,
      title:c.identity?.title??null,
      ships_to_project:false,
      exact_postcode_checked:project.location.postal_code??null,
      reason:"no_sale_ready_variant_for_project_destination"
    };
  }

  let domestic=false;
  try{
    const domesticResult=await callMcp("get_product",{
      id,
      filters:{
        ships_to:exactShipFilter(),
        ships_from:[{country:project.location.country}],
        available:true
      },
      context:{address_country:project.location.country,currency:project.procurement.currency},
      view:"summary"
    });
    domestic=!!bestVariant(domesticResult?.product);
  }catch{
    domestic=false;
  }

  const seller=variant.seller??null;
  return {
    candidate_id:c.candidate_id,
    shopify_id:id,
    canonical_category_id:c.taxonomy?.canonical_category_id??null,
    category_match_status:"provisional_discovery_match",
    candidate_quality:c.triage?.candidate_quality??null,
    title:product.title??c.identity?.title??null,
    variant_id:variant.id??null,
    sku:variant.sku??null,
    price:{
      amount_minor:variant.price?.amount??null,
      currency:variant.price?.currency??project.procurement.currency
    },
    availability:variant.availability??null,
    checkout_url:variant.checkout_url??null,
    seller:seller?{
      id:seller.id??null,
      name:seller.name??null,
      domain:seller.domain??null,
      url:seller.url??null
    }:null,
    ships_to_project:true,
    exact_postcode_checked:project.location.postal_code??null,
    origin:{
      country:domestic?project.location.country:null,
      country_verified:domestic,
      precision:domestic?"country":"unknown",
      regional_or_local_location:"requires_merchant_location_enrichment"
    },
    logistics:{
      shipping_cost:null,
      shipping_cost_status:"not_exposed_by_global_catalog",
      lead_time_days:null,
      lead_time_status:"not_exposed_by_global_catalog",
      landed_cost:null,
      landed_cost_status:"requires_checkout_or_supplier_quote"
    },
    attribution:{
      checkout_url_from_catalog:true,
      purchase_url_must_be_preserved:true
    }
  };
}

function rankOffers(rows){
  const valid=rows.filter(x=>x.ships_to_project && x.price?.amount_minor!=null);
  if(!valid.length) return rows;
  const prices=valid.map(x=>Number(x.price.amount_minor));
  const min=Math.min(...prices),max=Math.max(...prices);
  for(const x of rows){
    if(!x.ships_to_project){x.rank_score=0;continue;}
    const p=Number(x.price?.amount_minor);
    const priceScore=Number.isFinite(p)?(max===min?1:1-(p-min)/(max-min)):0;
    const score=
      0.40 +
      (x.origin?.country_verified?0.20:0) +
      (x.availability?.available!==false?0.15:0) +
      (x.seller?.id?0.05:0) +
      priceScore*0.20;
    x.rank_score=Number(score.toFixed(4));
  }
  return rows.sort((a,b)=>(b.rank_score??0)-(a.rank_score??0));
}

const byCategory=new Map();
for(const c of candidates){
  const id=c.taxonomy?.canonical_category_id;
  if(!id) continue;
  const arr=byCategory.get(id)??[];
  arr.push(c);
  byCategory.set(id,arr);
}
for(const arr of byCategory.values()) arr.sort((a,b)=>(b.triage?.candidate_quality??0)-(a.triage?.candidate_quality??0));

const slots=[];
for(const slot of test.requirements){
  const pool=(byCategory.get(slot.category_id)??[]).slice(0,3);
  const resolved=[];
  for(const c of pool){
    resolved.push(await resolveCandidate(c));
    await sleep(100);
  }
  const ranked=rankOffers(resolved);
  slots.push({
    slot_id:slot.slot_id,
    category_id:slot.category_id,
    discovered_candidates:(byCategory.get(slot.category_id)??[]).length,
    candidates_checked:pool.length,
    resolved_offer_count:ranked.filter(x=>x.ships_to_project).length,
    best_offer:ranked.find(x=>x.ships_to_project)??null,
    offers:ranked
  });
}

const summary={
  generated_at:new Date().toISOString(),
  project_id:project.project_id,
  destination:{country:project.location.country,postal_code:project.location.postal_code},
  slots:slots.length,
  slots_with_discovery:slots.filter(x=>x.discovered_candidates>0).length,
  slots_with_postcode_deliverable_offer:slots.filter(x=>x.resolved_offer_count>0).length,
  domestic_best_offers:slots.filter(x=>x.best_offer?.origin?.country_verified).length,
  landed_cost_known:slots.filter(x=>x.best_offer?.logistics?.landed_cost!=null).length,
  note:"Global Catalog verifies destination eligibility and seller/checkout identity, but does not expose freight price, lead time, or precise merchant warehouse location."
};

await fs.mkdir(path.join(ROOT,"data/offers"),{recursive:true});
await fs.writeFile(path.join(ROOT,"data/offers/whole-building-10.latest.json"),JSON.stringify({summary,slots},null,2));
console.log(JSON.stringify(summary,null,2));
