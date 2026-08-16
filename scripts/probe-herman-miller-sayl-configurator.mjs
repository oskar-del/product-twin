import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
const target=JSON.parse(await fs.readFile(path.join(ROOT,'config/geometry/herman-miller-sayl-target.json'),'utf8'));
const seed=target.manufacturer_sources.configurator_iframe;
const maxScripts=40;

async function fetchText(url){
  try{
    const res=await fetch(url,{redirect:'follow',headers:{'user-agent':'product-twin-public-configurator-probe/0.1'}});
    const type=res.headers.get('content-type')||'';
    const finalUrl=res.url;
    if(!res.ok)return {ok:false,status:res.status,url:finalUrl,type,text:'',error:`HTTP ${res.status}`};
    if(!/(html|javascript|json|text|xml)/i.test(type))return {ok:true,status:res.status,url:finalUrl,type,text:'',binary:true};
    return {ok:true,status:res.status,url:finalUrl,type,text:(await res.text()).slice(0,12_000_000)};
  }catch(e){return {ok:false,status:null,url,error:String(e?.message??e),text:''}}
}
function abs(base,raw){try{return new URL(raw,base).href}catch{return null}}
function refs(base,text){
  const out=[];let m;
  const attr=/(?:src|href)\s*=\s*["']([^"']+)["']/ig;
  while((m=attr.exec(text))){const u=abs(base,m[1]);if(u)out.push(u)}
  const urlish=/(https?:\\?\/\\?\/[^"'\s<>`]+|\/[A-Za-z0-9_./%-]+\.(?:js|json|glb|gltf|bin)(?:\?[^"'\s<>`]*)?)/ig;
  while((m=urlish.exec(text))){const u=abs(base,m[1].replace(/\\\//g,'/'));if(u)out.push(u)}
  return [...new Set(out)];
}
function snippets(text,patterns){
  const arr=[];
  for(const pat of patterns){let idx=0;const lower=text.toLowerCase(),needle=pat.toLowerCase();while((idx=lower.indexOf(needle,idx))>=0&&arr.length<100){arr.push({pattern:pat,snippet:text.slice(Math.max(0,idx-350),Math.min(text.length,idx+650))});idx+=needle.length}}
  return arr;
}

const root=await fetchText(seed);
const scriptUrls=root.ok?refs(root.url??seed,root.text).filter(u=>/\.js(?:\?|$)/i.test(u)).slice(0,maxScripts):[];
const files=[{url:root.url??seed,type:root.type,status:root.status,ok:root.ok,error:root.error??null}];
const candidates=new Map();
const patterns=['.glb','model/gltf-binary','download','configuration','configurator','sku','productcode','product code','sayl','iframe/5b218f84','api/','fetch(','axios','supabase','firebase','s3','cloudfront','vercel'];

function analyze(url,text){
  for(const u of refs(url,text)){
    const l=u.toLowerCase();
    if(/\.glb(?:[?#]|$)/i.test(u)||/gltf|model|download|config|product|api/i.test(l)){
      const row=candidates.get(u)??{url:u,source_files:[],signals:[]};
      row.source_files.push(url);
      if(/\.glb(?:[?#]|$)/i.test(u))row.signals.push('direct_glb_reference');
      if(/api|graphql|supabase|firebase/i.test(l))row.signals.push('api_or_backend_reference');
      if(/download/i.test(l))row.signals.push('download_reference');
      candidates.set(u,row);
    }
  }
  for(const s of snippets(text,patterns)){
    const key=`snippet:${url}:${s.pattern}:${s.snippet.slice(0,80)}`;
    candidates.set(key,{kind:'code_signal',source_file:url,pattern:s.pattern,snippet:s.snippet.replace(/\s+/g,' ').slice(0,900)});
  }
}
if(root.ok&&root.text)analyze(root.url??seed,root.text);
for(const js of scriptUrls){const r=await fetchText(js);files.push({url:r.url??js,type:r.type,status:r.status,ok:r.ok,error:r.error??null});if(r.ok&&r.text)analyze(r.url??js,r.text)}

const rows=[...candidates.values()];
const directGlb=rows.filter(x=>x.url&&/\.glb(?:[?#]|$)/i.test(x.url));
const backendRefs=rows.filter(x=>x.url&&x.signals?.includes('api_or_backend_reference'));
const codeSignals=rows.filter(x=>x.kind==='code_signal');
const out={
  generated_at:new Date().toISOString(),target_id:target.target_id,
  seed_url:seed,
  policy:'Public configurator HTML/JavaScript inspection only. No authentication bypass, no purchase automation, no manufacturer binary redistribution.',
  root_fetch:{ok:root.ok,http_status:root.status,content_type:root.type,resolved_url:root.url??seed,error:root.error??null},
  scripts_scanned:files.length-1,
  direct_glb_reference_count:directGlb.length,
  backend_reference_count:backendRefs.length,
  signal_count:codeSignals.length,
  direct_glb_references:directGlb.slice(0,30),
  backend_references:backendRefs.slice(0,40),
  code_signals:codeSignals.slice(0,100),
  conclusion:directGlb.length?'PUBLIC_GLB_REFERENCE_FOUND_NEEDS_CONFIG_AND_RIGHTS_VALIDATION':(backendRefs.length||codeSignals.length?'CONFIGURATOR_FLOW_DISCOVERED_NEEDS_ENDPOINT_RESOLUTION':'NO_PUBLIC_CONFIGURATOR_DOWNLOAD_FLOW_FOUND'),
  next_action:directGlb.length?'resolve exact configured option identity and transiently validate GLB bounds':'use discovered public configurator signals to resolve configuration/download endpoint without bypassing access controls'
};
await fs.mkdir(path.join(ROOT,'data/geometry'),{recursive:true});await fs.writeFile(path.join(ROOT,'data/geometry/herman-miller-sayl-configurator-probe.json'),JSON.stringify(out,null,2));
await fs.mkdir(path.join(ROOT,'data/metrics'),{recursive:true});await fs.writeFile(path.join(ROOT,'data/metrics/herman-miller-sayl-configurator-probe-latest.json'),JSON.stringify({generated_at:out.generated_at,target_id:out.target_id,root_fetch:out.root_fetch,scripts_scanned:out.scripts_scanned,direct_glb_reference_count:out.direct_glb_reference_count,backend_reference_count:out.backend_reference_count,signal_count:out.signal_count,conclusion:out.conclusion,next_action:out.next_action},null,2));
console.log(JSON.stringify({target_id:out.target_id,direct_glb_reference_count:out.direct_glb_reference_count,backend_reference_count:out.backend_reference_count,signal_count:out.signal_count,conclusion:out.conclusion},null,2));
