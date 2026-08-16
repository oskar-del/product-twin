import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
const targets=JSON.parse(await fs.readFile(path.join(ROOT,'config/geometry/exact-avatar-targets.json'),'utf8'));
const candidates=JSON.parse(await fs.readFile(path.join(ROOT,'data/identity/exact-avatar-commerce-candidates.json'),'utf8'));
const API_VERSION='2026-07';
const targetMap=new Map((targets.targets??[]).map(x=>[x.target_id,x]));

const query=`query VerifyVariant($id: ID!) {
  node(id:$id) {
    ... on ProductVariant {
      id sku barcode title availableForSale
      product { id title vendor handle }
    }
  }
}`;

async function storefront(domain,variantId){
  const res=await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`,{method:'POST',headers:{'content-type':'application/json','user-agent':'product-twin-exact-identity-verifier/0.1'},body:JSON.stringify({query,variables:{id:variantId}})});
  const text=await res.text();
  if(!res.ok)return {ok:false,http_status:res.status,error:text.slice(0,300)};
  let json;try{json=JSON.parse(text)}catch{return {ok:false,error:'non_json_response'}};
  if(json.errors?.length)return {ok:false,error:json.errors.map(x=>x.message).join(' | ')};
  return {ok:true,variant:json.data?.node??null};
}

const verified=[];
for(const group of candidates.targets??[]){
  const target=targetMap.get(group.target_id);if(!target)continue;
  for(const c of group.candidate_references??[]){
    if(!c.seller_domain||!c.variant_id)continue;
    let r;try{r=await storefront(c.seller_domain,c.variant_id)}catch(e){r={ok:false,error:String(e)}}
    if(!r.ok||!r.variant){verified.push({...c,verification_state:'merchant_storefront_unresolved',verification_error:r.error??null});continue;}
    const v=r.variant;
    const sku=String(v.sku??'').trim();const barcode=String(v.barcode??'').trim();const vendor=String(v.product?.vendor??'').trim();
    const itemMatch=sku&&[target.manufacturer_item_no,target.old_item_no].filter(Boolean).includes(sku);
    const barcodeMatch=barcode&&barcode===String(target.gtin_ean??'');
    const vendorMatch=vendor.toLowerCase()===String(target.manufacturer).toLowerCase();
    const modelText=`${v.product?.title??''} ${v.title??''}`.toLowerCase();
    const modelMatch=modelText.includes('outline')&&modelText.includes('sofa');
    const exact=Boolean(barcodeMatch||itemMatch);
    verified.push({
      source_id:c.source_id,target_id:c.target_id,product_id:c.product_id,variant_id:c.variant_id,seller_domain:c.seller_domain,seller_id:c.seller_id,
      verification_state:exact?'EXACT_IDENTITY_VERIFIED':(vendorMatch&&modelMatch?'FAMILY_MODEL_VERIFIED_CONFIGURATION_UNRESOLVED':'NOT_EXACT'),
      evidence:{manufacturer_item_match:Boolean(itemMatch),gtin_match:Boolean(barcodeMatch),vendor_match:Boolean(vendorMatch),model_family_match:Boolean(modelMatch),merchant_sku:sku||null,merchant_barcode:barcode||null},
      refresh_policy:'live_required_for_commerce',
      note:exact?'Exact product identity joined through merchant SKU/GTIN.':'No exact manufacturer item/GTIN match; do not join as exact configuration.'
    });
  }
}
const summary={generated_at:new Date().toISOString(),candidates_checked:verified.length,exact_identity_verified:verified.filter(x=>x.verification_state==='EXACT_IDENTITY_VERIFIED').length,family_model_verified:verified.filter(x=>x.verification_state==='FAMILY_MODEL_VERIFIED_CONFIGURATION_UNRESOLVED').length,unresolved_or_not_exact:verified.filter(x=>!['EXACT_IDENTITY_VERIFIED','FAMILY_MODEL_VERIFIED_CONFIGURATION_UNRESOLVED'].includes(x.verification_state)).length};
await fs.writeFile(path.join(ROOT,'data/identity/exact-avatar-commerce-verification.json'),JSON.stringify({summary,results:verified},null,2));
await fs.writeFile(path.join(ROOT,'data/metrics/exact-avatar-commerce-verification-latest.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
