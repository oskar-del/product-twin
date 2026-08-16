import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const taxonomy=JSON.parse(await fs.readFile(path.join(ROOT,"config/taxonomy.json"),"utf8"));
const energy=JSON.parse(await fs.readFile(path.join(ROOT,"config/taxonomy-energy-extension.json"),"utf8"));
const candidates=JSON.parse(await fs.readFile(path.join(ROOT,".runtime/shopify/triage.json"),"utf8"));

function flatten(nodes,parent=null,out=[]){for(const node of nodes){if(node.children){out.push({id:node.id,name:node.name,parent,leaf:false,profile:null});flatten(node.children,node.id,out);}else out.push({id:node.id,name:node.name,parent,leaf:true,profile:node.profile??null});}return out;}
const categoriesById=new Map();for(const c of flatten(taxonomy.top_level))categoriesById.set(c.id,c);if(energy.top_level)for(const c of flatten([energy.top_level]))categoriesById.set(c.id,c);
const rows=new Map([...categoriesById.values()].filter(c=>c.leaf).map(c=>[c.id,{category_id:c.id,name:c.name,parent:c.parent,specification_profile:c.profile,live_discovered:0,live_commerce_signals:0,live_media_signals:0,status:"no_live_discovery"}]));
for(const c of candidates){const id=c.taxonomy?.canonical_category_id;if(!id||!rows.has(id))continue;const row=rows.get(id);row.live_discovered++;if(c.best_offer)row.live_commerce_signals++;if((c.product?.media??[]).length)row.live_media_signals++;}
for(const row of rows.values()){if(row.live_discovered>0)row.status=row.live_commerce_signals>0?"live_commerce_candidates":"live_discovery_only";}
const leafRows=[...rows.values()].sort((a,b)=>a.category_id.localeCompare(b.category_id));
const summary={generated_at:new Date().toISOString(),taxonomy_version:taxonomy.version,energy_taxonomy_version:energy.version,category_count:leafRows.length,categories_with_live_discovery:leafRows.filter(x=>x.live_discovered>0).length,categories_with_live_commerce_signals:leafRows.filter(x=>x.live_commerce_signals>0).length,total_live_discoveries_after_dedup:leafRows.reduce((a,x)=>a+x.live_discovered,0),storage_policy:"aggregate_only_no_shopify_catalog_payload_cached",note:"Counts describe this live run only and are not a persistent Shopify product mirror."};
await fs.mkdir(path.join(ROOT,"data/coverage"),{recursive:true});
await fs.writeFile(path.join(ROOT,"data/coverage/latest.json"),JSON.stringify({summary,categories:leafRows},null,2));
await fs.writeFile(path.join(ROOT,"data/coverage/summary.json"),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
