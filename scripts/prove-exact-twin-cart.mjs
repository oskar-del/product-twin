import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { resolveProjectContext } from './project-context-resolve.mjs';

const ROOT=process.cwd();
const TWIN_PATH=path.join(ROOT,'data/twins/PT_MUUTO_OUTLINE_2S_OU2SRA10101.json');
const CATALOG_PROFILE='https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json';
const CART_PROFILE='https://shopify.dev/ucp/agent-profiles/examples/2026-04-08/cart-and-checkout.json';
const CATALOG='https://catalog.shopify.com/api/ucp/mcp';
const twin=JSON.parse(await fs.readFile(TWIN_PATH,'utf8'));
const project=resolveProjectContext(JSON.parse(await fs.readFile(path.join(ROOT,'data/projects/marbella-villa.example.json'),'utf8')));
const ref=twin.external_identities.find(x=>x.source_id==='shopify_global_catalog'&&x.verification?.state==='exact_identity_verified');
if(!ref)throw new Error('Exact Shopify commerce reference missing from Twin');

async function mcp(endpoint,name,args,profile){
  const res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','user-agent':'product-twin-exact-cart/0.2'},body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method:'tools/call',params:{name,arguments:{...args,meta:{'ucp-agent':{profile}}}}})});
  const text=await res.text();if(!res.ok)throw new Error(`${name} ${res.status}: ${text.slice(0,600)}`);const json=JSON.parse(text);if(json.error)throw new Error(JSON.stringify(json.error));return json.result?.structuredContent??json.result;
}
function toolPayload(x,key){if(x?.[key])return x[key];const txt=x?.content?.[0]?.text;if(txt){try{const j=JSON.parse(txt);return j?.[key]??j}catch{}}return x}

const lookup=await mcp(CATALOG,'lookup_catalog',{catalog:{ids:[ref.variant_id],filters:{ships_to:{country:project.location.country,...(project.location.postal_code?{postal_code:project.location.postal_code}:{})},available:true},context:{address_country:project.location.country,...(project.location.region?{address_region:project.location.region}:{}),...(project.location.postal_code?{postal_code:project.location.postal_code}:{}),currency:project.procurement.currency}}},CATALOG_PROFILE);
let liveVariant=null;
for(const p of lookup?.products??[]){for(const v of p.variants??[]){if(v.id===ref.variant_id){liveVariant=v;break}}}
if(!liveVariant){
  const out={generated_at:new Date().toISOString(),twin_id:twin.twin_id,status:'LIVE_VARIANT_NOT_AVAILABLE_FOR_PROJECT',variant_id:ref.variant_id,project_postcode:project.location.postal_code??null};
  await fs.mkdir(path.join(ROOT,'data/metrics'),{recursive:true});await fs.writeFile(path.join(ROOT,'data/metrics/exact-twin-cart-latest.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));process.exit(0);
}
const checkoutUrl=liveVariant.checkout_url;if(!checkoutUrl)throw new Error('Exact live variant has no checkout URL');
const origin=new URL(checkoutUrl).origin;
const wellRes=await fetch(`${origin}/.well-known/ucp`,{headers:{'user-agent':'product-twin-exact-cart/0.2'}});if(!wellRes.ok)throw new Error(`merchant /.well-known/ucp ${wellRes.status}`);const well=await wellRes.json();
const shopping=well?.ucp?.services?.['dev.ucp.shopping'];const merchantMcp=(Array.isArray(shopping)?shopping:[]).find(x=>x.transport==='mcp');const endpoint=merchantMcp?.endpoint??`${origin}/api/ucp/mcp`;
const createdRaw=await mcp(endpoint,'create_cart',{cart:{line_items:[{quantity:1,item:{id:ref.variant_id}}]}},CART_PROFILE);let cart=toolPayload(createdRaw,'cart');if(!cart?.id)throw new Error('Cart created without cart id');
const context={address_country:project.location.country,...(project.location.region?{address_region:project.location.region}:{}),...(project.location.postal_code?{postal_code:project.location.postal_code}:{}),currency:project.procurement.currency};
let localized=false;
try{const updatedRaw=await mcp(endpoint,'update_cart',{id:cart.id,cart:{line_items:[{quantity:1,item:{id:ref.variant_id}}],context}},CART_PROFILE);const updated=toolPayload(updatedRaw,'cart');if(updated?.id){cart=updated;localized=true}}catch{}
const totals=Object.fromEntries((cart.totals??[]).map(x=>[x.type,{amount:x.amount??null,display_text:x.display_text??null}]));
const out={
  generated_at:new Date().toISOString(),
  twin_id:twin.twin_id,
  status:'EXACT_IDENTITY_CART_CREATED',
  manufacturer_item_no:twin.identity.manufacturer_item_no,
  gtin_ean:twin.identity.gtin_ean,
  shopify_product_id:ref.product_id,
  shopify_variant_id:ref.variant_id,
  merchant_origin:origin,
  merchant_ucp_discovered:Boolean(merchantMcp?.endpoint),
  exact_postcode_checked:project.location.postal_code??null,
  live_offer_resolved:true,
  cart_created:true,
  cart_localized:localized,
  currency:cart.currency??null,
  totals_present:Object.keys(totals),
  provisional_fulfillment_present:totals.fulfillment?.amount!=null,
  continue_url_present:Boolean(cart.continue_url),
  authoritative_shipping:false,
  note:'Cart existence proves a live transaction handoff for the exact verified Twin. Mutable price/stock/cart payload is not persisted; authoritative freight still requires Checkout with a real full delivery address.'
};
await fs.mkdir(path.join(ROOT,'data/metrics'),{recursive:true});await fs.writeFile(path.join(ROOT,'data/metrics/exact-twin-cart-latest.json'),JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
