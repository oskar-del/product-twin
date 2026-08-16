import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { resolveProjectContext } from "./project-context-resolve.mjs";

const ROOT=process.cwd();
const PROFILE="https://raw.githubusercontent.com/oskar-del/product-twin/main/config/ucp-agent-profile.json";
const project=resolveProjectContext(JSON.parse(await fs.readFile(path.join(ROOT,"data/projects/marbella-villa.example.json"),"utf8")));
let carts={slots:[]};
try{carts=JSON.parse(await fs.readFile(path.join(ROOT,"data/carts/whole-building-10.latest.json"),"utf8"));}catch{}

function fullAddressAvailable(p){
  const l=p.location??{};
  return !!(l.address && l.postal_code && l.municipality && l.country);
}

function authHeaders(){
  const headers={"content-type":"application/json","user-agent":"product-twin-checkout-agent/0.1"};
  if(process.env.SHOPIFY_UCP_ACCESS_TOKEN) headers.authorization=`Bearer ${process.env.SHOPIFY_UCP_ACCESS_TOKEN}`;
  return headers;
}

function checkoutTotals(totals=[]){
  return Object.fromEntries((totals??[]).map(x=>[x.type,{amount:x.amount??null,display_text:x.display_text??null}]));
}

async function createCheckout(slot){
  if(!fullAddressAvailable(project)){
    return {
      status:"ADDRESS_REQUIRED",
      reason:"Authoritative shipping requires a full delivery address. Project test currently has only municipality/postcode; no address is fabricated.",
      required_fields:["location.address","location.postal_code","location.municipality","location.country"]
    };
  }
  const cart=slot.cart;
  if(cart?.status!=="created" || !cart.cart_id || !cart.merchant_endpoint){
    return {status:"CART_REQUIRED",reason:"No valid merchant cart is available for conversion to checkout."};
  }
  if(!process.env.SHOPIFY_UCP_ACCESS_TOKEN){
    return {
      status:"AUTH_REQUIRED",
      reason:"Shopify Checkout MCP requires authenticated or signed requests. Set a delegated UCP access token or add HTTP Message Signature support before checkout creation.",
      merchant_endpoint:cart.merchant_endpoint,
      cart_id:cart.cart_id
    };
  }

  const l=project.location;
  const checkout={
    currency:project.procurement.currency,
    fulfillment:{
      methods:[{
        type:"shipping",
        destinations:[{
          street_address:l.address,
          address_locality:l.municipality,
          ...(l.province?{address_region:l.province}:{}),
          postal_code:l.postal_code,
          address_country:l.country
        }]
      }]
    },
    context:{
      address_country:l.country,
      ...(l.region?{address_region:l.region}:{}),
      postal_code:l.postal_code,
      currency:project.procurement.currency,
      intent:"Authoritative project procurement shipping and tax quote"
    }
  };

  try{
    const res=await fetch(cart.merchant_endpoint,{
      method:"POST",
      headers:authHeaders(),
      body:JSON.stringify({
        jsonrpc:"2.0",
        method:"tools/call",
        id:crypto.randomUUID(),
        params:{
          name:"create_checkout",
          arguments:{
            meta:{"ucp-agent":{profile:PROFILE}},
            cart_id:cart.cart_id,
            checkout
          }
        }
      })
    });
    const text=await res.text();
    if(!res.ok)return {status:"FAILED",http_status:res.status,error:text.slice(0,1200)};
    let json;
    try{json=JSON.parse(text);}catch{return {status:"FAILED",error:"non_json_response",response:text.slice(0,1200)}}
    if(json.error)return {status:"FAILED",error:json.error};
    const co=json.result?.structuredContent?.checkout ?? json.result?.structuredContent ?? null;
    if(!co)return {status:"FAILED",error:"checkout_missing_from_response"};
    const totals=checkoutTotals(co.totals);
    return {
      status:"CREATED",
      checkout_id:co.id??null,
      checkout_status:co.status??null,
      currency:co.currency??project.procurement.currency,
      subtotal_minor:totals.subtotal?.amount??null,
      shipping_minor:totals.fulfillment?.amount??null,
      tax_minor:totals.tax?.amount??null,
      total_minor:totals.total?.amount??null,
      continue_url:co.continue_url??null,
      expires_at:co.expires_at??null,
      shipping_quote_authority:totals.fulfillment?.amount!=null?"AUTHORITATIVE_CHECKOUT":"NOT_RETURNED"
    };
  }catch(error){
    return {status:"FAILED",error:String(error?.message??error)};
  }
}

const slots=[];
for(const slot of carts.slots??[]){
  slots.push({slot_id:slot.slot_id,category_id:slot.category_id,checkout:await createCheckout(slot)});
}
const summary={
  generated_at:new Date().toISOString(),
  project_id:project.project_id,
  full_address_available:fullAddressAvailable(project),
  access_token_available:!!process.env.SHOPIFY_UCP_ACCESS_TOKEN,
  slots:slots.length,
  checkouts_created:slots.filter(x=>x.checkout.status==="CREATED").length,
  authoritative_shipping_quotes:slots.filter(x=>x.checkout.shipping_quote_authority==="AUTHORITATIVE_CHECKOUT").length,
  address_required:slots.filter(x=>x.checkout.status==="ADDRESS_REQUIRED").length,
  auth_required:slots.filter(x=>x.checkout.status==="AUTH_REQUIRED").length
};
await fs.mkdir(path.join(ROOT,"data/checkouts"),{recursive:true});
await fs.writeFile(path.join(ROOT,"data/checkouts/whole-building-10.latest.json"),JSON.stringify({summary,slots},null,2));
console.log(JSON.stringify(summary,null,2));
