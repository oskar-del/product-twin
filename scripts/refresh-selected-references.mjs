import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { resolveProjectContext } from "./project-context-resolve.mjs";

const ROOT=process.cwd();
const RUNTIME=path.join(ROOT,".runtime/shopify");
const ENDPOINT="https://catalog.shopify.com/api/ucp/mcp";
const PROFILE="https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json";
const projectRaw=JSON.parse(await fs.readFile(path.join(ROOT,"data/projects/marbella-villa.example.json"),"utf8"));
const project=resolveProjectContext(projectRaw);
const slug=project.project_id.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const referencePath=path.join(ROOT,"data/references",`${slug}.shopify.json`);

let refs={selections:[]};
try{refs=JSON.parse(await fs.readFile(referencePath,"utf8"));}catch{
  await fs.mkdir(path.join(ROOT,"data/metrics"),{recursive:true});
  const summary={generated_at:new Date().toISOString(),project_id:project.project_id,stored_references:0,resolved_live:0,status:"NO_REFERENCES_YET"};
  await fs.writeFile(path.join(ROOT,"data/metrics/reference-refresh-latest.json"),JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary,null,2));
  process.exit(0);
}

const selections=(refs.selections??[]).filter(x=>x.external_reference?.variant_id);
const ids=selections.map(x=>x.external_reference.variant_id).slice(0,50);

async function callLookup(ids){
  const res=await fetch(ENDPOINT,{
    method:"POST",
    headers:{"content-type":"application/json","user-agent":"product-twin-reference-refresh/0.1"},
    body:JSON.stringify({
      jsonrpc:"2.0",
      method:"tools/call",
      id:crypto.randomUUID(),
      params:{
        name:"lookup_catalog",
        arguments:{
          meta:{"ucp-agent":{profile:PROFILE}},
          catalog:{
            ids,
            filters:{
              ships_to:{
                country:project.location.country,
                ...(project.location.postal_code?{postal_code:project.location.postal_code}:{})
              },
              available:true
            },
            context:{
              address_country:project.location.country,
              ...(project.location.region?{address_region:project.location.region}:{}),
              ...(project.location.postal_code?{postal_code:project.location.postal_code}:{}),
              currency:project.procurement.currency
            }
          }
        }
      }
    })
  });
  const text=await res.text();
  if(!res.ok)throw new Error(`lookup_catalog ${res.status}: ${text.slice(0,800)}`);
  const json=JSON.parse(text);
  if(json.error)throw new Error(JSON.stringify(json.error));
  return json.result?.structuredContent??json.result;
}

const result=ids.length?await callLookup(ids):{products:[],messages:[]};
const variantIndex=new Map();
for(const product of result?.products??[]){
  for(const variant of product.variants??[]){
    variantIndex.set(variant.id,{product,variant});
  }
}

const slots=[];
for(const ref of selections){
  const variantId=ref.external_reference.variant_id;
  const hit=variantIndex.get(variantId);
  if(!hit){
    slots.push({slot_id:ref.slot_id,category_id:ref.category_id,discovered_candidates:1,candidates_checked:1,resolved_offer_count:0,best_offer:null,offers:[]});
    continue;
  }
  const {product,variant}=hit;
  const offer={
    candidate_id:`REF_${crypto.createHash("sha1").update(variantId).digest("hex").slice(0,12)}`,
    shopify_id:product.id??ref.external_reference.external_id??null,
    canonical_category_id:ref.category_id,
    category_match_status:"stored_reference_revalidated_not_technical_verified",
    variant_id:variant.id,
    sku:variant.sku??null,
    price:{amount_minor:variant.price?.amount??null,currency:variant.price?.currency??project.procurement.currency},
    availability:variant.availability??null,
    checkout_url:variant.checkout_url??null,
    seller:variant.seller?{id:variant.seller.id??null,name:variant.seller.name??null,domain:variant.seller.domain??null,url:variant.seller.url??null}:null,
    ships_to_project:true,
    exact_postcode_checked:project.location.postal_code??null,
    origin:{country:null,country_verified:false,precision:"unknown"},
    logistics:{shipping_cost:null,lead_time_days:null,landed_cost:null}
  };
  slots.push({slot_id:ref.slot_id,category_id:ref.category_id,discovered_candidates:1,candidates_checked:1,resolved_offer_count:1,best_offer:offer,offers:[offer]});
}

const output={
  summary:{
    generated_at:new Date().toISOString(),
    project_id:project.project_id,
    stored_references:selections.length,
    resolved_live:slots.filter(x=>x.best_offer).length,
    unresolved_live:slots.filter(x=>!x.best_offer).length,
    checkout_urls_available:slots.filter(x=>x.best_offer?.checkout_url).length,
    lookup_messages:(result?.messages??[]).length,
    storage_policy:"lookup_payload_ephemeral_reference_only_persistence"
  },
  slots
};
await fs.mkdir(RUNTIME,{recursive:true});
await fs.writeFile(path.join(RUNTIME,"offers.json"),JSON.stringify(output));
await fs.mkdir(path.join(ROOT,"data/metrics"),{recursive:true});
await fs.writeFile(path.join(ROOT,"data/metrics/reference-refresh-latest.json"),JSON.stringify(output.summary,null,2));
console.log(JSON.stringify(output.summary,null,2));
