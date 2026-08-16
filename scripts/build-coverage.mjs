import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const taxonomy = JSON.parse(await fs.readFile(path.join(ROOT,"config/taxonomy.json"),"utf8"));
const energy = JSON.parse(await fs.readFile(path.join(ROOT,"config/taxonomy-energy-extension.json"),"utf8"));
const candidates = JSON.parse(await fs.readFile(path.join(ROOT,"data/shopify/triage/latest.json"),"utf8"));

function flatten(nodes, parent=null, out=[]) {
  for (const node of nodes) {
    if (node.children) {
      out.push({id:node.id,name:node.name,parent,leaf:false,profile:null});
      flatten(node.children,node.id,out);
    } else {
      out.push({id:node.id,name:node.name,parent,leaf:true,profile:node.profile ?? null});
    }
  }
  return out;
}

// Main taxonomy remains the base. More specific extensions override duplicate IDs.
const categoriesById = new Map();
for (const c of flatten(taxonomy.top_level)) categoriesById.set(c.id,c);
if (energy.top_level) {
  for (const c of flatten([energy.top_level])) categoriesById.set(c.id,c);
}
const categories = [...categoriesById.values()];

const rows = new Map(categories.filter(c=>c.leaf).map(c=>[c.id,{
  category_id:c.id,
  name:c.name,
  parent:c.parent,
  specification_profile:c.profile,
  sources:{},
  candidates:0,
  commerce_ready:0,
  with_media:0,
  identity_ready:0,
  dimensions_ready:0,
  geometry_ready:0,
  rights_ready:0,
  specification_ready:0,
  render_ready:0,
  status:"no_supply"
}]));

for (const c of candidates) {
  const id=c.taxonomy?.canonical_category_id;
  if (!id || !rows.has(id)) continue;
  const row=rows.get(id);
  row.candidates += 1;
  row.sources[c.source]=(row.sources[c.source]??0)+1;
  if (c.readiness?.commerce === "ready" || c.best_offer) row.commerce_ready += 1;
  if ((c.product?.media??[]).length) row.with_media += 1;
  if (["ready","verified"].includes(c.readiness?.identity)) row.identity_ready += 1;
  if (["ready","verified"].includes(c.readiness?.dimensions)) row.dimensions_ready += 1;
  if (["ready","verified"].includes(c.readiness?.geometry)) row.geometry_ready += 1;
  if (["ready","verified"].includes(c.readiness?.rights)) row.rights_ready += 1;
  if (["ready","verified"].includes(c.readiness?.specification)) row.specification_ready += 1;
  if (["ready","verified"].includes(c.readiness?.render)) row.render_ready += 1;
}

for (const row of rows.values()) {
  if (row.render_ready > 0) row.status="renderable_supply";
  else if (row.specification_ready > 0 && row.commerce_ready > 0) row.status="specifiable_supply";
  else if (row.commerce_ready > 0) row.status="commerce_candidates";
  else if (row.candidates > 0) row.status="discovered";
}

const leafRows=[...rows.values()].sort((a,b)=>a.category_id.localeCompare(b.category_id));
const summary={
  generated_at:new Date().toISOString(),
  taxonomy_version:taxonomy.version,
  energy_taxonomy_version:energy.version,
  category_count:leafRows.length,
  categories_with_candidates:leafRows.filter(x=>x.candidates>0).length,
  categories_with_commerce:leafRows.filter(x=>x.commerce_ready>0).length,
  categories_with_specifiable_supply:leafRows.filter(x=>x.status==="specifiable_supply"||x.status==="renderable_supply").length,
  categories_with_renderable_supply:leafRows.filter(x=>x.render_ready>0).length,
  total_candidates:leafRows.reduce((a,x)=>a+x.candidates,0)
};

await fs.mkdir(path.join(ROOT,"data/coverage"),{recursive:true});
await fs.writeFile(path.join(ROOT,"data/coverage/latest.json"),JSON.stringify({summary,categories:leafRows},null,2));
await fs.writeFile(path.join(ROOT,"data/coverage/summary.json"),JSON.stringify(summary,null,2));

console.log("Product Twin coverage");
console.log(JSON.stringify(summary,null,2));
