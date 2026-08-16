import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { resolveProjectContext } from "./project-context-resolve.mjs";

const ROOT=process.cwd();
const PROFILE="https://raw.githubusercontent.com/oskar-del/product-twin/main/config/ucp-agent-profile.json";
const project=resolveProjectContext(JSON.parse(await fs.readFile(path.join(ROOT,"data/projects/marbella-villa.example.json"),"utf8")));
let offerResolution={slots:[]};
try{offerResolution=JSON.parse(await fs.readFile(path.join(ROOT,"data/offers/whole-building-10.latest.json"),"utf8"));}catch{}

function mcpEndpoint(offer){
  const base=offer?.seller?.url || (offer?.seller?.domain?`https://${offer.seller.domain}`:null);
  if(!base)return null;
  const u=new URL(base);
  return `${u.origin}/api/ucp/mcp`;
}

function totalsMap(totals=[]){
  return Object.fromEntries((totals??[]).map(x=>[x.type,{amount:x.amount??null,display_text:x.display_text??null}]));
}

async function createCart(offer){
  const endpoint=mcpEndpoint(offer);
  if(!endpoint || !offer?.variant_id)return {status:"not_attempted",reason:"missing_merchant_endpoint_or_variant"};

  try{
    const res=await fetch(endpoint,{
      method:"POST",
      headers:{"content-type":"application/json","user-agent":"product-twin-cart-agent/0.1"},
      body:JSON.stringify({
        jsonrpc:"2.0",
        method:"tools/call",
        id:crypto.randomUUID(),
        params:{
          name:"create_cart",
          arguments:{
            meta:{"ucp-agent":{profile:PROFILE}},
            cart:{
              line_items:[{quantity:1,item:{id:offer.variant_id}}],
              context:{
                address_country:project.location.country,
                ...(project.location.region?{address_region:project.location.region}:{}),
                ...(project.location.postal_code?{postal_code:project.location.postal_code}:{}),
                currency:project.procurement.currency,
                intent:"Project procurement estimate for a building product delivered to the project location"
              },
              attribution:{
                referring_domain:"product-twin",
                utm_source:"product_twin",
                utm_medium:"agentic_procurement",
                utm_campaign:"whole_building_test"
              }
            }
          }
        }
      })
    });
    const text=await res.text();
    if(!res.ok)return {status:"failed",http_status:res.status,error:text.slice(0,1000)};
    let json;
    try{json=JSON.parse(text);}catch{return {status:"failed",error:"non_json_response",response:text.slice(0,1000)}}
    if(json.error)return {status:"failed",error:json.error};
    const cart=json.result?.structuredContent?.cart ?? json.result?.structuredContent ?? null;
    if(!cart)return {status:"failed",error:"cart_missing_from_response",response:json.result??null};
    const totals=totalsMap(cart.totals);
    return {
      status:"created",
      merchant_endpoint:endpoint,
      cart_id:cart.id??null,
      currency:cart.currency??project.procurement.currency,
      totals,
      subtotal_minor:totals.subtotal?.amount??null,
      estimated_fulfillment_minor:totals.fulfillment?.amount??null,
      estimated_tax_minor:totals.tax?.amount??null,
      estimated_total_minor:totals.total?.amount??null,
      continue_url:cart.continue_url??null,
      expires_at:cart.expires_at??null,
      messages:cart.messages??[],
      shipping_estimate_authority:totals.fulfillment?.amount!=null?"PROVISIONAL_CART_CONTEXT":"NOT_AVAILABLE",
      note:"Cart context can localize estimates but is not authoritative for shipping. Exact shipping requires Checkout MCP with a shipping address."
    };
  }catch(error){
    return {status:"failed",error:String(error?.message??error),merchant_endpoint:endpoint};
  }
}

const slots=[];
for(const slot of offerResolution.slots??[]){
  const offer=slot.best_offer;
  const cart=offer?await createCart(offer):{status:"not_attempted",reason:"no_resolved_offer"};
  slots.push({
    slot_id:slot.slot_id,
    category_id:slot.category_id,
    candidate_id:offer?.candidate_id??null,
    seller:offer?.seller??null,
    variant_id:offer?.variant_id??null,
    cart
  });
}

const summary={
  generated_at:new Date().toISOString(),
  project_id:project.project_id,
  destination:{country:project.location.country,postal_code:project.location.postal_code},
  slots:slots.length,
  carts_created:slots.filter(x=>x.cart.status==="created").length,
  provisional_shipping_estimates:slots.filter(x=>x.cart.shipping_estimate_authority==="PROVISIONAL_CART_CONTEXT").length,
  checkout_required_for_authoritative_shipping:true
};

await fs.mkdir(path.join(ROOT,"data/carts"),{recursive:true});
await fs.writeFile(path.join(ROOT,"data/carts/whole-building-10.latest.json"),JSON.stringify({summary,slots},null,2));
console.log(JSON.stringify(summary,null,2));
