import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const taxonomy=JSON.parse(await fs.readFile(path.join(ROOT,"config/taxonomy.json"),"utf8"));
const energy=JSON.parse(await fs.readFile(path.join(ROOT,"config/taxonomy-energy-extension.json"),"utf8"));

function flatten(nodes,parent=null,out=[]){
  for(const node of nodes){
    if(node.children){flatten(node.children,node.id,out);}
    else out.push({id:node.id,name:node.name,parent,profile:node.profile??null});
  }
  return out;
}
const byId=new Map();
for(const x of flatten(taxonomy.top_level))byId.set(x.id,x);
for(const x of flatten([energy.top_level]))byId.set(x.id,x);

async function readJson(file,fallback=null){try{return JSON.parse(await fs.readFile(file,"utf8"));}catch{return fallback;}}
async function listJson(dir){
  let out=[];let entries=[];try{entries=await fs.readdir(dir,{withFileTypes:true});}catch{return out;}
  for(const e of entries){
    const p=path.join(dir,e.name);
    if(e.isDirectory())out=out.concat(await listJson(p));
    else if(e.isFile()&&e.name.endsWith(".json")){const j=await readJson(p);if(j)out.push(j);}
  }
  return out;
}

const sourceFiles=await listJson(path.join(ROOT,"config/source-mappings"));
const evidence=await listJson(path.join(ROOT,"data/evidence/manufacturer"));
const shopifyCoverage=await readJson(path.join(ROOT,"data/coverage/latest.json"),{categories:[]});
const liveByCategory=new Map((shopifyCoverage.categories??[]).map(x=>[x.category_id,x]));

const rows=[...byId.values()].map(c=>({
  category_id:c.id,
  name:c.name,
  specification_profile:c.profile,
  source_mappings:[],
  live_discovery_signals:0,
  authoritative_manufacturer_evidence_records:0,
  direct_trade_sources:0,
  live_commerce_sources:0,
  technical_evidence_sources:0,
  geometry_sources:0,
  bim_sources:0,
  coverage_state:"NO_SOURCE"
}));
const rowById=new Map(rows.map(x=>[x.category_id,x]));

for(const source of sourceFiles){
  for(const m of source.mappings??source.taxonomy_mappings??[]){
    const row=rowById.get(m.category_id);if(!row)continue;
    const caps=source.capabilities??{};
    const sourceType=source.source_type??(source.source_id==="shopify_global_catalog"?"global_catalog":"unknown");
    row.source_mappings.push({
      source_id:source.source_id,
      source_name:source.source_name??source.name??source.source_id,
      source_type:sourceType,
      fitness:m.fitness??"unknown",
      auth_state:source.access_state?.trade_commerce_state??null,
      capabilities:{
        live_price:!!caps.live_price,
        live_stock:!!caps.live_stock,
        technical_evidence:!!caps.technical_evidence,
        geometry:!!caps.geometry,
        bim:!!caps.bim,
        order:!!caps.order,
        quote:!!caps.quote,
        physical_locations:!!caps.physical_locations
      }
    });
    if(["trade_portal","manufacturer","distributor"].includes(sourceType))row.direct_trade_sources++;
    if(source.source_id==="shopify_global_catalog"||caps.live_price||caps.order)row.live_commerce_sources++;
    if(caps.technical_evidence)row.technical_evidence_sources++;
    if(caps.geometry)row.geometry_sources++;
    if(caps.bim)row.bim_sources++;
  }
}

for(const ev of evidence){
  const id=ev.subject?.category_id;const row=rowById.get(id);if(!row)continue;
  if(["A_MANUFACTURER","A_REGULATOR","B_CERTIFICATION_BODY","B_DISTRIBUTOR_AUTHORIZED"].includes(ev.authority?.grade)){
    row.authoritative_manufacturer_evidence_records++;
    row.technical_evidence_sources=Math.max(row.technical_evidence_sources,1);
  }
}

for(const row of rows){
  const live=liveByCategory.get(row.category_id);
  row.live_discovery_signals=live?.live_discovered??0;
  const hasDiscovery=row.live_discovery_signals>0||row.source_mappings.length>0;
  const hasTech=row.authoritative_manufacturer_evidence_records>0||row.technical_evidence_sources>0;
  const hasDirect=row.direct_trade_sources>0;
  const hasCommerce=row.live_commerce_sources>0;
  if(hasTech&&hasDirect&&hasCommerce)row.coverage_state="MULTI_GRAPH_SOURCE";
  else if(hasTech&&hasCommerce)row.coverage_state="TECHNICAL_PLUS_COMMERCE";
  else if(hasCommerce)row.coverage_state="COMMERCE_SOURCE";
  else if(hasTech)row.coverage_state="TECHNICAL_SOURCE";
  else if(hasDiscovery)row.coverage_state="DISCOVERY_SOURCE";
}
rows.sort((a,b)=>a.category_id.localeCompare(b.category_id));

const summary={
  generated_at:new Date().toISOString(),
  canonical_categories:rows.length,
  categories_with_any_source:rows.filter(x=>x.coverage_state!=="NO_SOURCE").length,
  categories_with_live_discovery:rows.filter(x=>x.live_discovery_signals>0).length,
  categories_with_authoritative_manufacturer_evidence:rows.filter(x=>x.authoritative_manufacturer_evidence_records>0).length,
  categories_with_direct_trade_source:rows.filter(x=>x.direct_trade_sources>0).length,
  categories_with_multi_graph_source:rows.filter(x=>x.coverage_state==="MULTI_GRAPH_SOURCE").length,
  manufacturer_evidence_records:evidence.length,
  source_adapters:sourceFiles.length,
  principle:"Coverage is measured against Product Twin's canonical taxonomy. A source contributes capabilities; it never defines the category universe."
};
await fs.mkdir(path.join(ROOT,"data/coverage"),{recursive:true});
await fs.writeFile(path.join(ROOT,"data/coverage/source-matrix.json"),JSON.stringify({summary,categories:rows},null,2));
console.log(JSON.stringify(summary,null,2));
