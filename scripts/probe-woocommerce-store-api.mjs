import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
const cfg=JSON.parse(await fs.readFile(path.join(ROOT,'config/commerce/woocommerce-probe-stores.json'),'utf8'));
await fs.mkdir(path.join(ROOT,'data','commerce'),{recursive:true});
await fs.mkdir(path.join(ROOT,'data','metrics'),{recursive:true});

function endpointCandidates(base){
  const u=new URL(base);
  const clean=base.replace(/\/$/,'');
  const origin=u.origin;
  return [...new Set([
    `${clean}/wp-json/wc/store/v1/products?per_page=${cfg.probe_limit??8}`,
    `${origin}/wp-json/wc/store/v1/products?per_page=${cfg.probe_limit??8}`,
    `${clean}/?rest_route=/wc/store/v1/products&per_page=${cfg.probe_limit??8}`,
    `${origin}/?rest_route=/wc/store/v1/products&per_page=${cfg.probe_limit??8}`
  ])];
}

async function get(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),25000);
  try{
    const r=await fetch(url,{headers:{'accept':'application/json','user-agent':'product-twin-woocommerce-probe/0.1'},redirect:'follow',signal:controller.signal});
    const text=await r.text();
    let json=null;try{json=JSON.parse(text)}catch{}
    return {ok:r.ok,status:r.status,url:r.url,content_type:r.headers.get('content-type'),json,error:json?null:text.slice(0,180)};
  }catch(e){return {ok:false,status:null,url,error:String(e)}}finally{clearTimeout(timer)}
}

const stores=[];
for(const store of cfg.stores??[]){
  let chosen=null;const attempts=[];
  for(const endpoint of endpointCandidates(store.base_url)){
    const r=await get(endpoint);
    const isProducts=r.ok&&Array.isArray(r.json);
    attempts.push({endpoint,http_status:r.status,resolved_url:r.url,products_array:isProducts,content_type:r.content_type??null,error:isProducts?null:r.error??null});
    if(isProducts){chosen=r;break;}
  }
  const products=chosen?.json??[];
  const references=products.slice(0,cfg.probe_limit??8).map(p=>({
    source_id:'woocommerce_store_api',
    store_id:store.store_id,
    merchant_product_id:p.id??null,
    sku:p.sku||null,
    name:p.name||null,
    permalink:p.permalink||null,
    currency:p.prices?.currency_code||null,
    price_minor:p.prices?.price??null,
    in_stock:typeof p.is_in_stock==='boolean'?p.is_in_stock:null,
    category_names:(p.categories??[]).map(x=>x.name).filter(Boolean).slice(0,8),
    image_reference:p.images?.[0]?.src??null,
    identity_state:'merchant_candidate',
    refresh_policy:'live_required'
  }));
  stores.push({
    store_id:store.store_id,base_url:store.base_url,relevance:store.relevance??[],demo:Boolean(store.demo),
    state:chosen?'LIVE_STORE_API_PRODUCTS':'UNRESOLVED',
    endpoint:chosen?.url??null,
    product_count_sample:products.length,
    product_references:references,
    attempts
  });
}

const live=stores.filter(x=>x.state==='LIVE_STORE_API_PRODUCTS');
const realLive=live.filter(x=>!x.demo);
const result={
  generated_at:new Date().toISOString(),
  adapter_id:'woocommerce_store_api',
  stores_tested:stores.length,
  stores_live:live.length,
  non_demo_stores_live:realLive.length,
  candidate_references:stores.reduce((n,s)=>n+s.product_references.length,0),
  status:realLive.length?'LIVE_MERCHANT_PLATFORM_ADAPTER_PROVEN':(live.length?'DEMO_ONLY_ADAPTER_PROVEN':'NO_LIVE_STORES'),
  scope_note:'WooCommerce Store API is a per-merchant public commerce surface, not a single cross-merchant global catalog.',
  stores
};
await fs.writeFile(path.join(ROOT,'data','commerce','woocommerce-store-api-latest.json'),JSON.stringify(result,null,2));
await fs.writeFile(path.join(ROOT,'data','metrics','woocommerce-store-api-latest.json'),JSON.stringify({generated_at:result.generated_at,adapter_id:result.adapter_id,stores_tested:result.stores_tested,stores_live:result.stores_live,non_demo_stores_live:result.non_demo_stores_live,candidate_references:result.candidate_references,status:result.status},null,2));
console.log(JSON.stringify({status:result.status,stores_live:result.stores_live,non_demo_stores_live:result.non_demo_stores_live,candidate_references:result.candidate_references},null,2));
