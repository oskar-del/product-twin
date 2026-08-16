import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
const twin=JSON.parse(await fs.readFile(path.join(ROOT,'data/twins/PT_MUUTO_OUTLINE_2S_OU2SRA10101.json'),'utf8'));
const seeds=[twin.manufacturer_evidence.product_page,twin.manufacturer_evidence.architect_download_hub];
const strongIds=[twin.identity.manufacturer_item_no,twin.identity.legacy_item_no,twin.identity.gtin_ean].filter(Boolean).map(x=>String(x).toLowerCase());
const familyIds=['outline','ou2s'];
const ids=[...strongIds,...familyIds];
const assetExt=/\.(obj|3ds|dwg|skp|rfa|rvt|fbx|gltf|glb|zip)(?:[?#]|$)/i;

async function fetchText(url){
  try{
    const res=await fetch(url,{redirect:'follow',headers:{'user-agent':'product-twin-public-asset-probe/0.2'}});
    const type=res.headers.get('content-type')||'';const finalUrl=res.url;
    if(!res.ok)return {ok:false,status:res.status,url:finalUrl,type,text:''};
    if(!/(text|javascript|json|html|xml)/i.test(type))return {ok:true,status:res.status,url:finalUrl,type,text:'',binary:true};
    return {ok:true,status:res.status,url:finalUrl,type,text:(await res.text()).slice(0,8_000_000)};
  }catch(e){return {ok:false,status:null,url,error:String(e?.message??e),text:''}}
}
function absolutize(base,raw){try{return new URL(raw,base).href}catch{return null}}
function extractRefs(base,text){
  const refs=[];let m;
  const attr=/(?:href|src|data-url|data-src|download-url)\s*=\s*["']([^"']+)["']/ig;
  while((m=attr.exec(text))){const u=absolutize(base,m[1]);if(u)refs.push({url:u,index:m.index})}
  const plain=/(https?:\\?\/\\?\/[^"'\s<>]+|\/[A-Za-z0-9_./%?=&+-]+\.(?:obj|3ds|dwg|skp|rfa|rvt|fbx|gltf|glb|zip)(?:\?[^"'\s<>]*)?)/ig;
  while((m=plain.exec(text))){const u=absolutize(base,m[1].replace(/\\\//g,'/'));if(u)refs.push({url:u,index:m.index})}
  return refs;
}
function scoreRef(url,context=''){
  const urlLower=url.toLowerCase();const ctx=context.toLowerCase();let score=0;const reasons=[];
  for(const id of strongIds){if(urlLower.includes(id)||ctx.includes(id)){score+=4;reasons.push(`strong_id:${id}`)}}
  for(const id of familyIds){if(urlLower.includes(id)||ctx.includes(id)){score+=1;reasons.push(`family_id:${id}`)}}
  if(assetExt.test(url)){score+=3;reasons.push('3d_or_cad_extension')}
  if(/architect|download|3d|cad|bim|digitalshowroom/i.test(url+' '+context)){score+=1;reasons.push('asset_context')}
  const productBound=strongIds.some(id=>urlLower.includes(id)||ctx.includes(id)) || (familyIds.every(id=>urlLower.includes(id)||ctx.includes(id)) && /product|outline/i.test(ctx));
  return {score,reasons:[...new Set(reasons)],product_bound:productBound};
}

const pages=[],candidates=new Map(),scripts=[];
async function scanPage(url,isScript=false){
  const r=await fetchText(url);
  if(!isScript)pages.push({seed:url,resolved_url:r.url??url,http_status:r.status,content_type:r.type??null,ok:r.ok,error:r.error??null});
  if(!r.ok||!r.text)return;
  for(const ref of extractRefs(r.url??url,r.text)){
    const context=r.text.slice(Math.max(0,ref.index-500),Math.min(r.text.length,ref.index+800));
    const rel=scoreRef(ref.url,context);
    if(rel.score>0){const prev=candidates.get(ref.url);if(!prev||rel.score>prev.score)candidates.set(ref.url,{url:ref.url,source_page:r.url??url,...rel})}
    if(!isScript&&/\.js(?:\?|$)/i.test(ref.url)&&scripts.length<30)scripts.push(ref.url);
  }
}
for(const seed of seeds)await scanPage(seed,false);
for(const js of [...new Set(scripts)].slice(0,20))await scanPage(js,true);

const ranked=[...candidates.values()].sort((a,b)=>b.score-a.score).slice(0,100);
const anyAssetReferences=ranked.filter(x=>assetExt.test(x.url));
const productBoundDirectAssets=anyAssetReferences.filter(x=>x.product_bound);
const gatedProductReferences=ranked.filter(x=>x.product_bound&&/professionals\.muuto\.com\/login/i.test(x.url));
const exactProductImages=ranked.filter(x=>x.product_bound&&/\.(webp|jpg|jpeg|png)(?:[?#]|$)/i.test(x.url));
const out={
  generated_at:new Date().toISOString(),twin_id:twin.twin_id,
  policy:'Public manufacturer references only. No authentication bypass, no protected binary download, no asset redistribution.',
  pages_probed:pages,
  public_candidate_reference_count:ranked.length,
  any_3d_or_cad_reference_count:anyAssetReferences.length,
  product_bound_direct_asset_count:productBoundDirectAssets.length,
  gated_exact_product_reference_count:gatedProductReferences.length,
  exact_product_image_reference_count:exactProductImages.length,
  candidates:ranked.map(x=>({...x,asset_downloaded:false,rights_state:'review'})),
  conclusion:productBoundDirectAssets.length?'PUBLIC_PRODUCT_BOUND_ASSET_FOUND_NEEDS_RIGHTS_AND_SCALE_VALIDATION':(gatedProductReferences.length?'EXACT_PRODUCT_PROFESSIONAL_ASSET_PATH_GATED':'NO_PRODUCT_BOUND_DIRECT_ASSET_FOUND'),
  next_action:productBoundDirectAssets.length?'validate exact identity/format and manufacturer terms before transient download/conversion':(gatedProductReferences.length?'obtain authorized Muuto professional access or request exact architect file; do not bypass login':'request manufacturer asset or use rights-cleared reconstruction proxy')
};
await fs.mkdir(path.join(ROOT,'data/geometry'),{recursive:true});
await fs.writeFile(path.join(ROOT,'data/geometry/muuto-outline-architect-asset-probe.json'),JSON.stringify(out,null,2));
await fs.mkdir(path.join(ROOT,'data/metrics'),{recursive:true});
await fs.writeFile(path.join(ROOT,'data/metrics/muuto-asset-probe-latest.json'),JSON.stringify({generated_at:out.generated_at,twin_id:out.twin_id,public_candidate_reference_count:out.public_candidate_reference_count,any_3d_or_cad_reference_count:out.any_3d_or_cad_reference_count,product_bound_direct_asset_count:out.product_bound_direct_asset_count,gated_exact_product_reference_count:out.gated_exact_product_reference_count,exact_product_image_reference_count:out.exact_product_image_reference_count,conclusion:out.conclusion,next_action:out.next_action},null,2));
console.log(JSON.stringify({twin_id:out.twin_id,product_bound_direct_asset_count:out.product_bound_direct_asset_count,gated_exact_product_reference_count:out.gated_exact_product_reference_count,conclusion:out.conclusion},null,2));
