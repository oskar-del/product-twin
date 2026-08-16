import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT=process.cwd();
const CATALOG="https://catalog.shopify.com/api/ucp/mcp";
const PROFILE="https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json";
const API_VERSION="2026-07";
const REF_PATH=path.join(ROOT,"data/references/project-marbella-villa-001.shopify.json");
const refs=JSON.parse(await fs.readFile(REF_PATH,"utf8"));
const selections=(refs.selections??[]).filter(x=>x.external_reference?.variant_id);

async function lookup(ids){
  const res=await fetch(CATALOG,{method:"POST",headers:{"content-type":"application/json","user-agent":"product-twin-model3d-probe/0.1"},body:JSON.stringify({jsonrpc:"2.0",id:crypto.randomUUID(),method:"tools/call",params:{name:"lookup_catalog",arguments:{meta:{"ucp-agent":{profile:PROFILE}},catalog:{ids,context:{address_country:"ES",currency:"EUR"}}}}})});
  const text=await res.text();
  if(!res.ok)throw new Error(`lookup_catalog ${res.status}: ${text.slice(0,600)}`);
  const json=JSON.parse(text);if(json.error)throw new Error(JSON.stringify(json.error));return json.result?.structuredContent??json.result;
}

function originFromCheckout(url){try{return new URL(url).origin}catch{return null}}

const query=`query ProductMediaFromVariant($id: ID!) {
  node(id:$id) {
    ... on ProductVariant {
      id
      product {
        id
        media(first:30) {
          nodes {
            mediaContentType
            ... on Model3d {
              id
              sources { format mimeType filesize url }
            }
          }
        }
      }
    }
  }
}`;

async function probeStorefront(origin,variantId){
  const endpoint=`${origin}/api/${API_VERSION}/graphql.json`;
  const res=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","user-agent":"product-twin-model3d-probe/0.1"},body:JSON.stringify({query,variables:{id:variantId}})});
  const text=await res.text();
  if(!res.ok)return {ok:false,http_status:res.status,error:text.slice(0,300)};
  let json;try{json=JSON.parse(text)}catch{return {ok:false,http_status:res.status,error:"non_json_response"}};
  if(json.errors?.length)return {ok:false,http_status:res.status,error:json.errors.map(x=>x.message).join(" | ").slice(0,500)};
  const product=json.data?.node?.product??null;
  const models=(product?.media?.nodes??[]).filter(x=>x?.mediaContentType==="MODEL_3D");
  return {ok:true,product_gid:product?.id??null,models};
}

const lookupResult=await lookup(selections.map(x=>x.external_reference.variant_id).slice(0,50));
const variantIndex=new Map();
for(const product of lookupResult?.products??[])for(const variant of product.variants??[])variantIndex.set(variant.id,{product,variant});

const slots=[];const geometryRefs=[];
for(const selection of selections){
  const variantId=selection.external_reference.variant_id;
  const hit=variantIndex.get(variantId);
  if(!hit){slots.push({slot_id:selection.slot_id,category_id:selection.category_id,status:"LIVE_VARIANT_NOT_RESOLVED",model3d_count:0});continue;}
  const origin=originFromCheckout(hit.variant.checkout_url);
  if(!origin){slots.push({slot_id:selection.slot_id,category_id:selection.category_id,status:"NO_MERCHANT_ORIGIN",model3d_count:0});continue;}
  let result;try{result=await probeStorefront(origin,variantId)}catch(e){result={ok:false,error:String(e)}}
  if(!result.ok){slots.push({slot_id:selection.slot_id,category_id:selection.category_id,status:"STOREFRONT_PROBE_FAILED",model3d_count:0,error:result.error??null});continue;}
  const models=result.models??[];
  slots.push({slot_id:selection.slot_id,category_id:selection.category_id,status:models.length?"MODEL3D_PRESENT":"NO_MODEL3D",model3d_count:models.length,formats:[...new Set(models.flatMap(m=>(m.sources??[]).map(s=>s.format)).filter(Boolean))]});
  for(const model of models){
    geometryRefs.push({
      geometry_reference_id:`SHOPIFY_MODEL3D_${crypto.createHash("sha1").update(`${origin}|${model.id}`).digest("hex").slice(0,16)}`,
      slot_id:selection.slot_id,
      category_id:selection.category_id,
      source_id:"shopify_merchant_storefront",
      merchant_origin:origin,
      merchant_product_gid:result.product_gid,
      merchant_variant_gid:variantId,
      merchant_model3d_gid:model.id,
      formats:[...new Set((model.sources??[]).map(s=>s.format).filter(Boolean))],
      asset_resolution:"live_storefront_api_required",
      copied_to_product_twin:false,
      identity_state:"exact_merchant_product_association",
      scale_state:"requires_asset_validation",
      rights_state:"review",
      promotion_state:"geometry_candidate_not_yet_render_claim",
      note:"Shopify-hosted Model3d is associated with the exact merchant product. Product Twin stores only stable references and resolves source URLs live; render/derivative/redistribution rights remain a separate gate."
    });
  }
}

const summary={generated_at:new Date().toISOString(),references_probed:selections.length,storefront_probes_ok:slots.filter(x=>!["LIVE_VARIANT_NOT_RESOLVED","NO_MERCHANT_ORIGIN","STOREFRONT_PROBE_FAILED"].includes(x.status)).length,slots_with_model3d:slots.filter(x=>x.status==="MODEL3D_PRESENT").length,total_model3d_assets:geometryRefs.length,policy:"No Shopify catalog payload or Model3d source URLs persisted; stable external geometry references only."};
await fs.mkdir(path.join(ROOT,"data/metrics"),{recursive:true});
await fs.writeFile(path.join(ROOT,"data/metrics/shopify-model3d-probe-latest.json"),JSON.stringify({...summary,slots},null,2));
await fs.mkdir(path.join(ROOT,"data/geometry"),{recursive:true});
await fs.writeFile(path.join(ROOT,"data/geometry/shopify-model3d-references.json"),JSON.stringify({version:"0.1",generated_at:summary.generated_at,summary:{references:geometryRefs.length},references:geometryRefs},null,2));
console.log(JSON.stringify(summary,null,2));
