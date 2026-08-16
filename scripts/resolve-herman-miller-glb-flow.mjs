import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
const target=JSON.parse(await fs.readFile(path.join(ROOT,'config/geometry/herman-miller-sayl-target.json'),'utf8'));
const VERSION='9.7.1-build.7';
const CDN=`https://cdn.3dcloud.io/hermanmiller-kongfigurator-frontend/${VERSION}/MxtHermanMillerKongfigurator-${VERSION}.min.js`;
const iframe=target.manufacturer_sources.configurator_iframe;

async function get(url){
  try{
    const r=await fetch(url,{redirect:'follow',headers:{'user-agent':'product-twin-public-configurator-resolver/0.1'}});
    const text=await r.text();return {ok:r.ok,status:r.status,url:r.url,type:r.headers.get('content-type')||'',text:r.ok?text.slice(0,30_000_000):text.slice(0,1000)};
  }catch(e){return {ok:false,status:null,url,error:String(e?.message??e),text:''}}
}
function extractAround(text,needles,limit=160){
  const out=[];const lower=text.toLowerCase();
  for(const needle of needles){const n=needle.toLowerCase();let from=0;while(out.length<limit){const i=lower.indexOf(n,from);if(i<0)break;out.push({needle,snippet:text.slice(Math.max(0,i-650),Math.min(text.length,i+1200)).replace(/\s+/g,' ')});from=i+n.length}}
  return out;
}
function uniqueStrings(text,re){const s=new Set();let m;while((m=re.exec(text))&&s.size<500)s.add(m[0].replace(/\\\//g,'/'));return [...s]}

const [iframeRes,libRes]=await Promise.all([get(iframe),get(CDN)]);
const needles=['.glb','glb','gltf','download','export','downloadModel','download3d','modelDownload','model-export','assetUrl','asset-url','configurationId','configuration-id','sku','shareUrl','productCode','scene','api/','graphql','fetch(','axios','XMLHttpRequest','3dcloud.io','storage.googleapis','amazonaws','cloudfront'];
const signals=libRes.ok?extractAround(libRes.text,needles):[];
const iframeSignals=iframeRes.ok?extractAround(iframeRes.text,['__NEXT_DATA__','configurationId','configuration-id','sku','5b218f84','configId']):[];
const absoluteUrls=libRes.ok?uniqueStrings(libRes.text,/https?:\\?\/\\?\/[^"'`\s)]+/ig):[];
const endpointRefs=absoluteUrls.filter(u=>/3dcloud|marxent|api|download|asset|model|gltf|glb|storage|cloudfront|amazonaws/i.test(u)).slice(0,300);
const glbRefs=absoluteUrls.filter(u=>/\.glb(?:[?#]|$)/i.test(u));
const methodNames=libRes.ok?uniqueStrings(libRes.text,/\b(?:download|export|get|create|generate)[A-Za-z0-9_$]{2,60}/g).filter(x=>/download|export|model|asset|gltf|glb|render/i.test(x)).slice(0,300):[];

const nextDataMatch=iframeRes.text?.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
let nextData=null;try{if(nextDataMatch)nextData=JSON.parse(nextDataMatch[1])}catch{}
const nextDataSummary=nextData?{page:nextData.page,query:nextData.query,buildId:nextData.buildId,props_keys:Object.keys(nextData.props?.pageProps??{})}:null;

const out={
  generated_at:new Date().toISOString(),target_id:target.target_id,
  policy:'Inspect public configurator resources only. Do not bypass authentication, forge private API credentials, or persist manufacturer binary assets.',
  library:{url:CDN,ok:libRes.ok,http_status:libRes.status,content_type:libRes.type,bytes_scanned:libRes.text?.length??0,version:VERSION},
  iframe:{url:iframe,ok:iframeRes.ok,http_status:iframeRes.status,content_type:iframeRes.type,next_data:nextDataSummary},
  glb_static_reference_count:glbRefs.length,
  endpoint_reference_count:endpointRefs.length,
  method_name_candidates:methodNames,
  endpoint_references:endpointRefs,
  library_signals:signals,
  iframe_signals:iframeSignals,
  conclusion:glbRefs.length?'STATIC_GLB_REFERENCE_PRESENT':(methodNames.length||signals.length?'PUBLIC_EXPORT_LOGIC_IDENTIFIED_NEEDS_CALL_SHAPE_RESOLUTION':'EXPORT_FLOW_NOT_RESOLVED'),
  next_action:glbRefs.length?'verify reference corresponds to active Sayl configuration and validate scale':'identify the public Downloads-button method/call shape and invoke only if it is the same unauthenticated action available to a normal configurator user'
};
await fs.mkdir(path.join(ROOT,'data/geometry'),{recursive:true});await fs.writeFile(path.join(ROOT,'data/geometry/herman-miller-sayl-glb-flow.json'),JSON.stringify(out,null,2));
await fs.mkdir(path.join(ROOT,'data/metrics'),{recursive:true});await fs.writeFile(path.join(ROOT,'data/metrics/herman-miller-sayl-glb-flow-latest.json'),JSON.stringify({generated_at:out.generated_at,target_id:out.target_id,library:out.library,iframe:out.iframe,glb_static_reference_count:out.glb_static_reference_count,endpoint_reference_count:out.endpoint_reference_count,method_name_candidate_count:out.method_name_candidates.length,conclusion:out.conclusion,next_action:out.next_action},null,2));
console.log(JSON.stringify({target_id:out.target_id,library_ok:out.library.ok,glb_static_reference_count:out.glb_static_reference_count,endpoint_reference_count:out.endpoint_reference_count,method_name_candidate_count:out.method_name_candidates.length,conclusion:out.conclusion},null,2));
