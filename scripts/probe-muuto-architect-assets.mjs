import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
const twin=JSON.parse(await fs.readFile(path.join(ROOT,'data/twins/PT_MUUTO_OUTLINE_2S_OU2SRA10101.json'),'utf8'));
const seeds=[twin.manufacturer_evidence.product_page,twin.manufacturer_evidence.architect_download_hub];
const ids=[twin.identity.manufacturer_item_no,twin.identity.legacy_item_no,twin.identity.gtin_ean,'Outline','OU2S'].filter(Boolean).map(x=>String(x).toLowerCase());
const extRe=/\.(?:obj|3ds|dwg|skp|rfa|rvt|fbx|gltf|glb|zip)(?:[?#][^"'\s<>]*)?/ig;

async function fetchText(url){
  try{
    const res=await fetch(url,{redirect:'follow',headers:{'user-agent':'product-twin-public-asset-probe/0.1'}});
    const type=res.headers.get('content-type')||'';
    const finalUrl=res.url;
    if(!res.ok)return {ok:false,status:res.status,url:finalUrl,type,text:''};
    if(!/(text|javascript|json|html|xml)/i.test(type))return {ok:true,status:res.status,url:finalUrl,type,text:'',binary:true};
    const text=await res.text();
    return {ok:true,status:res.status,url:finalUrl,type,text:text.slice(0,8_000_000)};
  }catch(e){return {ok:false,status:null,url,error:String(e?.message??e),text:''}}
}

function absolutize(base,raw){
  try{return new URL(raw,base).href}catch{return null}
}
function extractUrls(base,text){
  const found=new Set();
  const attr=/(?:href|src|data-url|data-src|download-url)\s*=\s*["']([^"']+)["']/ig;
  let m;while((m=attr.exec(text))){const u=absolutize(base,m[1]);if(u)found.add(u)}
  const plain=/(https?:\\?\/\\?\/[^"'\s<>]+|\/[A-Za-z0-9_./%?=&+-]+\.(?:obj|3ds|dwg|skp|rfa|rvt|fbx|gltf|glb|zip)(?:\?[^"'\s<>]*)?)/ig;
  while((m=plain.exec(text))){const cleaned=m[1].replace(/\\\//g,'/');const u=absolutize(base,cleaned);if(u)found.add(u)}
  return [...found];
}
function relevance(url,context=''){
  const s=(url+' '+context).toLowerCase();let score=0;const reasons=[];
  for(const id of ids){if(s.includes(id)){score+=2;reasons.push(`id:${id}`)}}
  if(extRe.test(url)){score+=3;reasons.push('3d_or_cad_extension')} extRe.lastIndex=0;
  if(/architect|download|3d|cad|bim|digitalshowroom/i.test(s)){score+=1;reasons.push('asset_context')}
  return {score,reasons:[...new Set(reasons)]};
}

const pages=[];const candidates=new Map();const scripts=[];
for(const seed of seeds){
  const r=await fetchText(seed);pages.push({seed,resolved_url:r.url??seed,http_status:r.status,content_type:r.type??null,ok:r.ok,error:r.error??null});
  if(!r.ok||!r.text)continue;
  for(const u of extractUrls(r.url??seed,r.text)){
    const rel=relevance(u);
    if(rel.score>0)candidates.set(u,{url:u,source_page:r.url??seed,...rel});
    if(/\.js(?:\?|$)/i.test(u)&&scripts.length<30)scripts.push(u);
  }
}

// Public JS often contains API/download endpoint templates. Scan a small bounded set; do not execute code or authenticate.
for(const js of [...new Set(scripts)].slice(0,20)){
  const r=await fetchText(js);if(!r.ok||!r.text)continue;
  const lower=r.text.toLowerCase();
  if(!ids.some(id=>lower.includes(id))&&!/(architect|digitalshowroom|download|\.obj|\.3ds|\.dwg|\.skp|\.rfa|\.zip)/i.test(r.text))continue;
  for(const u of extractUrls(r.url??js,r.text)){
    const rel=relevance(u,r.text.slice(Math.max(0,r.text.indexOf(u)-200),Math.min(r.text.length,r.text.indexOf(u)+300)));
    if(rel.score>0)candidates.set(u,{url:u,source_page:r.url??js,...rel});
  }
}

const ranked=[...candidates.values()].sort((a,b)=>b.score-a.score).slice(0,100);
const directAssetCandidates=ranked.filter(x=>/\.(obj|3ds|dwg|skp|rfa|rvt|fbx|gltf|glb|zip)(?:[?#]|$)/i.test(x.url));
const out={
  generated_at:new Date().toISOString(),
  twin_id:twin.twin_id,
  policy:'Public manufacturer references only. No authentication bypass, no protected binary download, no asset redistribution.',
  pages_probed:pages,
  public_candidate_reference_count:ranked.length,
  direct_asset_candidate_count:directAssetCandidates.length,
  candidates:ranked.map(x=>({...x,asset_downloaded:false,rights_state:'review'})),
  conclusion:directAssetCandidates.length?'PUBLIC_DIRECT_ASSET_REFERENCE_FOUND_NEEDS_RIGHTS_AND_SCALE_VALIDATION':'NO_PUBLIC_DIRECT_ASSET_REFERENCE_FOUND',
  next_action:directAssetCandidates.length?'validate exact identity/format and manufacturer terms before transient download/conversion':'use authorized professional download access or request asset from Muuto; do not bypass access controls'
};
await fs.mkdir(path.join(ROOT,'data/geometry'),{recursive:true});
await fs.writeFile(path.join(ROOT,'data/geometry/muuto-outline-architect-asset-probe.json'),JSON.stringify(out,null,2));
await fs.mkdir(path.join(ROOT,'data/metrics'),{recursive:true});
await fs.writeFile(path.join(ROOT,'data/metrics/muuto-asset-probe-latest.json'),JSON.stringify({generated_at:out.generated_at,twin_id:out.twin_id,public_candidate_reference_count:out.public_candidate_reference_count,direct_asset_candidate_count:out.direct_asset_candidate_count,conclusion:out.conclusion,next_action:out.next_action},null,2));
console.log(JSON.stringify({twin_id:out.twin_id,direct_asset_candidate_count:out.direct_asset_candidate_count,conclusion:out.conclusion},null,2));
