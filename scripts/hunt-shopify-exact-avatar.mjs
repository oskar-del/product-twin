import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const ENDPOINT='https://catalog.shopify.com/api/ucp/mcp';
const PROFILE='https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json';
const config=JSON.parse(await fs.readFile(path.join(ROOT,'config/geometry/exact-avatar-targets.json'),'utf8'));

async function callSearch(query){
  const res=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json','user-agent':'product-twin-exact-avatar-hunt/0.1'},body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method:'tools/call',params:{name:'search_catalog',arguments:{meta:{'ucp-agent':{profile:PROFILE}},catalog:{query,filters:{ships_to:{country:'ES'},available:true},context:{address_country:'ES',currency:'EUR',intent:'Resolve exact manufacturer/model identity for Product Twin avatar'},pagination:{limit:50}}}}})});
  const text=await res.text();
  if(!res.ok) throw new Error(`search_catalog ${res.status}: ${text.slice(0,700)}`);
  const json=JSON.parse(text);if(json.error)throw new Error(JSON.stringify(json.error));
  return json.result?.structuredContent??json.result;
}

function flatText(p){return [p.title,p.description,...(p.variants??[]).flatMap(v=>[v.title,v.sku])].filter(Boolean).join(' ').toLowerCase()}
function score(target,p){
  const t=flatText(p); let s=0; const reasons=[];
  const m=target.manufacturer.toLowerCase(); const fam=target.product_family.toLowerCase(); const model=target.model.toLowerCase();
  if(t.includes(m)){s+=0.25;reasons.push('manufacturer_name')}
  if(t.includes(fam)){s+=0.25;reasons.push('family_name')}
  if(t.includes(model)){s+=0.2;reasons.push('model_name')}
  for(const v of p.variants??[]){
    const sku=String(v.sku??'').toLowerCase();
    if(sku && sku===String(target.manufacturer_item_no??'').toLowerCase()){s+=0.25;reasons.push('exact_manufacturer_item_no')}
    if(sku && sku===String(target.gtin_ean??'').toLowerCase()){s+=0.3;reasons.push('sku_equals_gtin')}
  }
  return {score:Math.min(1,s),reasons:[...new Set(reasons)]};
}
function bestVariant(p,target){
  const exact=(p.variants??[]).find(v=>[target.manufacturer_item_no,target.gtin_ean].filter(Boolean).includes(String(v.sku??'')));
  return exact??(p.variants??[]).find(v=>v.availability?.available!==false)??p.variants?.[0]??null;
}

const outputs=[];
for(const target of config.targets??[]){
  const seen=new Map();
  for(const q of target.commerce_hunt_queries??[]){
    const r=await callSearch(q);
    for(const p of r?.products??[]){
      const id=String(p.id??p.url??crypto.randomUUID());
      const sc=score(target,p);
      const existing=seen.get(id);
      if(!existing||sc.score>existing.match.score)seen.set(id,{p,match:sc,queries:[q]});
      else existing.queries.push(q);
    }
  }
  const ranked=[...seen.values()].sort((a,b)=>b.match.score-a.match.score).slice(0,10);
  const refs=ranked.map(({p,match,queries})=>{
    const v=bestVariant(p,target);
    return {
      source_id:'shopify_global_catalog',
      target_id:target.target_id,
      product_id:p.id??null,
      variant_id:v?.id??null,
      seller_domain:v?.seller?.domain??null,
      seller_id:v?.seller?.id??null,
      matched_queries:[...new Set(queries)],
      identity_match_score:match.score,
      identity_match_reasons:match.reasons,
      identity_state:match.reasons.includes('exact_manufacturer_item_no')||match.reasons.includes('sku_equals_gtin')?'strong_candidate':'provisional_candidate',
      refresh_policy:'live_required',
      persisted_fields_policy:'stable_reference_and_match_evidence_only'
    };
  });
  outputs.push({target_id:target.target_id,manufacturer:target.manufacturer,model:target.model,queries_run:(target.commerce_hunt_queries??[]).length,candidate_references:refs});
}

const summary={generated_at:new Date().toISOString(),targets:outputs.length,targets_with_candidates:outputs.filter(x=>x.candidate_references.length).length,strong_identity_candidates:outputs.flatMap(x=>x.candidate_references).filter(x=>x.identity_state==='strong_candidate').length,policy:'Search payload ephemeral; persist stable external references and match evidence only.'};
await fs.mkdir(path.join(ROOT,'data/identity'),{recursive:true});
await fs.writeFile(path.join(ROOT,'data/identity/exact-avatar-commerce-candidates.json'),JSON.stringify({summary,targets:outputs},null,2));
await fs.mkdir(path.join(ROOT,'data/metrics'),{recursive:true});
await fs.writeFile(path.join(ROOT,'data/metrics/exact-avatar-commerce-hunt-latest.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
