import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
await fs.mkdir(path.join(ROOT,'data','identity'),{recursive:true});
await fs.mkdir(path.join(ROOT,'data','metrics'),{recursive:true});

const cases=[
  {id:'EXACT_MUUTO_OUTLINE_2S_001',gtin:'5713222210793',kind:'real_product_target'},
  {id:'GS1_OFFICIAL_RESOLVER_DEMO',gtin:'9506000164908',kind:'official_protocol_control'}
];

function gtin14(value){return String(value).replace(/\D/g,'').padStart(14,'0')}

async function probe(c){
  const canonical=gtin14(c.gtin);
  const url=`https://id.gs1.org/01/${canonical}?linkType=all`;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),30000);
  try{
    const r=await fetch(url,{redirect:'manual',signal:controller.signal,headers:{
      'accept':'application/linkset+json, application/json;q=0.9, text/html;q=0.7',
      'user-agent':'product-twin-gs1-resolver-probe/0.1'
    }});
    const body=await r.text();
    const link=r.headers.get('link');
    const location=r.headers.get('location');
    const contentType=r.headers.get('content-type');
    const lower=body.toLowerCase();
    const hasLinkset=/target|linkset|href|linktype|product info|homepage|defaultlink/.test(lower)||Boolean(link);
    return {
      case_id:c.id,kind:c.kind,input_gtin:c.gtin,canonical_gtin14:canonical,
      request_url:url,http_status:r.status,content_type:contentType,location:location??null,link_header:link??null,
      state:r.status>=200&&r.status<400?(hasLinkset?'RESOLVER_RESPONSE_WITH_LINK_EVIDENCE':'RESOLVER_RESPONSE_NO_LINK_EVIDENCE'):(r.status===404?'RESOLVER_NO_RECORD':'RESOLVER_HTTP_ERROR'),
      body_excerpt:body.replace(/\s+/g,' ').trim().slice(0,1200)||null
    };
  }catch(e){return {case_id:c.id,kind:c.kind,input_gtin:c.gtin,canonical_gtin14:canonical,request_url:url,state:'ERROR',error:String(e)}}finally{clearTimeout(timer)}
}

const results=[];
for(const c of cases)results.push(await probe(c));
const control=results.find(x=>x.kind==='official_protocol_control');
const target=results.find(x=>x.kind==='real_product_target');
const protocolLive=Boolean(control&&!['ERROR','RESOLVER_HTTP_ERROR'].includes(control.state));
const targetEnriched=target?.state==='RESOLVER_RESPONSE_WITH_LINK_EVIDENCE';
const summary={
  generated_at:new Date().toISOString(),source_id:'gs1_global_resolver',
  protocol_live:protocolLive,target_enrichment_found:Boolean(targetEnriched),
  status:protocolLive?(targetEnriched?'LIVE_NEUTRAL_ENRICHMENT_TARGET_MATCH':'LIVE_NEUTRAL_ENRICHMENT_PROTOCOL_TARGET_UNRESOLVED'):'PROTOCOL_TEST_FAILED',
  note:'GS1 Global Office Resolver is a neutral Digital Link enrichment/link-discovery source. It is not a substitute for Verified by GS1 registry identity verification.'
};
await fs.writeFile(path.join(ROOT,'data','identity','gs1-resolver-latest.json'),JSON.stringify({summary,results},null,2));
await fs.writeFile(path.join(ROOT,'data','metrics','gs1-resolver-latest.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
