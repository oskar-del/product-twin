import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { resolveProjectContext } from "./project-context-resolve.mjs";

const ROOT=process.cwd();
const RUNTIME=path.join(ROOT,".runtime/shopify");
// Use Shopify's official fixture during protocol validation to remove our hosted profile as a failure variable.
const PROFILE="https://shopify.dev/ucp/agent-profiles/examples/2026-04-08/cart-and-checkout.json";
const project=resolveProjectContext(JSON.parse(await fs.readFile(path.join(ROOT,"data/projects/marbella-villa.example.json"),"utf8")));
let offerResolution={slots:[]};
try{offerResolution=JSON.parse(await fs.readFile(path.join(RUNTIME,"offers.json"),"utf8"));}catch{}

function normalizeOrigin(checkoutUrl){
  if(!checkoutUrl)return null;
  try{return new URL(checkoutUrl).origin;}catch{return null;}
}

async function discoverMerchant(origin){
  if(!origin)return {status:"NO_CHECKOUT_ORIGIN",origin:null,endpoint:null,well_known:false,cart_capability:null};
  try{
    const res=await fetch(`${origin}/.well-known/ucp`,{headers:{"user-agent":"product-twin-cart-agent/0.3"}});
    if(!res.ok){
      return {status:"WELL_KNOWN_HTTP_ERROR",origin,endpoint:`${origin}/api/ucp/mcp`,well_known:false,http_status:res.status,cart_capability:null};
    }
    const ucp=await res.json();
    const shopping=ucp?.ucp?.services?.["dev.ucp.shopping"];
    const mcp=Array.isArray(shopping)?shopping.find(s=>s.transport==="mcp"):null;
    const cartCapability=Array.isArray(ucp?.ucp?.capabilities?.["dev.ucp.shopping.cart"]);
    return {
      status:mcp?.endpoint?"DISCOVERED":"FALLBACK_ENDPOINT",
      origin,
      endpoint:mcp?.endpoint??`${origin}/api/ucp/mcp`,
      well_known:true,
      ucp_version:ucp?.ucp?.version??null,
      cart_capability:cartCapability,
      mcp_advertised:!!mcp?.endpoint
    };
  }catch(error){
    return {status:"WELL_KNOWN_FETCH_FAILED",origin,endpoint:`${origin}/api/ucp/mcp`,well_known:false,cart_capability:null,error:String(error?.message??error)};
  }
}

function parseToolPayload(data,key){
  if(data?.result?.structuredContent){
    const sc=data.result.structuredContent;
    return sc?.[key]??sc;
  }
  const text=data?.result?.content?.[0]?.text;
  if(typeof text==="string"){
    try{const parsed=JSON.parse(text);return parsed?.[key]??parsed;}catch{}
  }
  return null;
}

async function callTool(endpoint,name,args){
  const res=await fetch(endpoint,{
    method:"POST",
    headers:{"content-type":"application/json","user-agent":"product-twin-cart-agent/0.3"},
    body:JSON.stringify({
      jsonrpc:"2.0",
      method:"tools/call",
      id:crypto.randomUUID(),
      params:{name,arguments:{...args,meta:{"ucp-agent":{profile:PROFILE}}}}
    })
  });
  const text=await res.text();
  if(!res.ok)return {ok:false,failure:"MCP_HTTP_ERROR",http_status:res.status,response:text.slice(0,500)};
  let json;
  try{json=JSON.parse(text);}catch{return {ok:false,failure:"MCP_NON_JSON",response:text.slice(0,500)}}
  if(json.error)return {ok:false,failure:"JSON_RPC_ERROR",error:json.error};
  if(!json.result)return {ok:false,failure:"MCP_RESULT_MISSING",response:json};
  return {ok:true,json};
}

function totalsMap(a=[]){return Object.fromEntries((a??[]).map(x=>[x.type,{amount:x.amount??null,display_text:x.display_text??null}]));}

async function createCart(offer){
  if(!offer?.variant_id)return {status:"FAILED",failure:"VARIANT_ID_MISSING"};
  const origin=normalizeOrigin(offer.checkout_url);
  if(!origin)return {status:"FAILED",failure:"CHECKOUT_URL_MISSING_OR_INVALID"};

  const discovery=await discoverMerchant(origin);
  const endpoint=discovery.endpoint;
  if(!endpoint)return {status:"FAILED",failure:"MCP_ENDPOINT_UNRESOLVED",discovery};

  // First make the smallest request Shopify documents: one line item + agent profile.
  const created=await callTool(endpoint,"create_cart",{
    cart:{line_items:[{quantity:1,item:{id:offer.variant_id}}]}
  });
  if(!created.ok)return {status:"FAILED",failure:created.failure,discovery,http_status:created.http_status??null,error:created.error??null,response:created.response??null};

  let cart=parseToolPayload(created.json,"cart");
  if(!cart?.id)return {status:"FAILED",failure:"CART_PAYLOAD_MISSING",discovery};

  const initialTotals=totalsMap(cart.totals);
  let localization={status:"NOT_ATTEMPTED"};

  // Then localize the existing cart. Keeping this separate tells us whether creation works even if context update does not.
  const context={
    address_country:project.location.country,
    ...(project.location.region?{address_region:project.location.region}:{}),
    ...(project.location.postal_code?{postal_code:project.location.postal_code}:{}),
    currency:project.procurement.currency
  };
  const updated=await callTool(endpoint,"update_cart",{
    id:cart.id,
    cart:{line_items:[{quantity:1,item:{id:offer.variant_id}}],context}
  });
  if(updated.ok){
    const localized=parseToolPayload(updated.json,"cart");
    if(localized?.id){cart=localized;localization={status:"UPDATED"};}
    else localization={status:"FAILED",failure:"UPDATED_CART_PAYLOAD_MISSING"};
  }else{
    localization={status:"FAILED",failure:updated.failure,http_status:updated.http_status??null,error:updated.error??null};
  }

  const finalTotals=totalsMap(cart.totals);
  return {
    status:"CREATED",
    discovery,
    merchant_origin:origin,
    merchant_endpoint:endpoint,
    cart_id:cart.id,
    currency:cart.currency??null,
    initial_totals:initialTotals,
    localized_totals:finalTotals,
    continue_url:cart.continue_url??null,
    expires_at:cart.expires_at??null,
    localization,
    provisional_shipping_estimate_minor:finalTotals.fulfillment?.amount??null,
    shipping_estimate_authority:finalTotals.fulfillment?.amount!=null?"PROVISIONAL_CART_CONTEXT":"NOT_AVAILABLE"
  };
}

const slots=[];
for(const s of offerResolution.slots??[]){
  const o=s.best_offer;
  const cart=o?await createCart(o):{status:"FAILED",failure:"NO_RESOLVED_OFFER"};
  slots.push({
    slot_id:s.slot_id,
    category_id:s.category_id,
    candidate_id:o?.candidate_id??null,
    variant_id:o?.variant_id??null,
    checkout_url_present:!!o?.checkout_url,
    cart
  });
}

const failures={};
for(const s of slots){if(s.cart.status!=="CREATED"){const k=s.cart.failure??"UNKNOWN";failures[k]=(failures[k]??0)+1;}}
const summary={
  generated_at:new Date().toISOString(),
  project_id:project.project_id,
  slots:slots.length,
  offers_with_checkout_url:slots.filter(x=>x.checkout_url_present).length,
  merchant_origins_resolved:slots.filter(x=>!!x.cart.merchant_origin).length,
  well_known_ucp_found:slots.filter(x=>x.cart.discovery?.well_known).length,
  cart_capability_advertised:slots.filter(x=>x.cart.discovery?.cart_capability===true).length,
  mcp_endpoint_advertised:slots.filter(x=>x.cart.discovery?.mcp_advertised===true).length,
  create_cart_attempted:slots.filter(x=>!!x.cart.discovery?.endpoint).length,
  carts_created:slots.filter(x=>x.cart.status==="CREATED").length,
  carts_localized:slots.filter(x=>x.cart.localization?.status==="UPDATED").length,
  provisional_shipping_estimates:slots.filter(x=>x.cart.shipping_estimate_authority==="PROVISIONAL_CART_CONTEXT").length,
  failure_reason_counts:failures,
  checkout_required_for_authoritative_shipping:true,
  storage_policy:"cart_test_payload_ephemeral"
};

await fs.writeFile(path.join(RUNTIME,"carts.json"),JSON.stringify({summary,slots}));
await fs.mkdir(path.join(ROOT,"data/metrics"),{recursive:true});
await fs.writeFile(path.join(ROOT,"data/metrics/cart-test-latest.json"),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
