import fs from "node:fs/promises";
import path from "node:path";
import { resolveProjectContext } from "./project-context-resolve.mjs";
import { evaluateRegulation } from "./regulatory-evaluate.mjs";

const ROOT=process.cwd();
const project=resolveProjectContext(JSON.parse(await fs.readFile(path.join(ROOT,"data/projects/marbella-villa.example.json"),"utf8")));
const test=JSON.parse(await fs.readFile(path.join(ROOT,"data/tests/whole-building-10.json"),"utf8"));
const taxonomy=JSON.parse(await fs.readFile(path.join(ROOT,"config/taxonomy.json"),"utf8"));
const energy=JSON.parse(await fs.readFile(path.join(ROOT,"config/taxonomy-energy-extension.json"),"utf8"));
const profiles=JSON.parse(await fs.readFile(path.join(ROOT,"config/specification-profiles.json"),"utf8"));

let coverage={categories:[]};
try { coverage=JSON.parse(await fs.readFile(path.join(ROOT,"data/coverage/latest.json"),"utf8")); } catch {}

function flatten(nodes,out=[]) {
  for (const n of nodes) {
    if (n.children) flatten(n.children,out);
    else out.push(n);
  }
  return out;
}

const leaves=flatten(taxonomy.top_level);
for (const n of energy.top_level?.children ?? []) leaves.push(n);
const categoryById=new Map(leaves.map(x=>[x.id,x]));
const coverageById=new Map((coverage.categories??[]).map(x=>[x.category_id,x]));

const severity={BLOCK:5,HOLD:4,REVIEW:3,OPPORTUNITY:2,PASS:1,NOT_APPLICABLE:0};
function aggregateRegulatory(category_id) {
  const stages=["product_selection","design","installation","connection"];
  const all=stages.flatMap(stage=>evaluateRegulation({
    jurisdiction_id:project.jurisdiction.resolved_id,
    category_id,
    stage,
    evidence:[]
  }));
  const state=all.length ? all.reduce((best,x)=> severity[x.state] > severity[best] ? x.state : best, all[0].state) : "NOT_APPLICABLE";
  return {state,rules:all,missing_evidence:[...new Set(all.flatMap(x=>x.missing_evidence??[]))]};
}

function technicalStatus(category) {
  if (!category) return {state:"BLOCK",reason:"Category not found in canonical taxonomy"};
  const profile=profiles.profiles?.[category.profile];
  if (!profile) return {state:"HOLD",reason:`Specification profile '${category.profile}' is not yet defined`};
  return {state:"READY_FOR_REQUIREMENT_CAPTURE",profile:category.profile};
}

const slots=test.requirements.map(slot=>{
  const category=categoryById.get(slot.category_id);
  const cov=coverageById.get(slot.category_id);
  const regulatory=aggregateRegulatory(slot.category_id);
  const technical=technicalStatus(category);

  return {
    ...slot,
    canonical_category: category ? {id:category.id,name:category.name,profile:category.profile} : null,
    technical_specification_status: technical,
    candidate_supply_count: cov?.candidates ?? 0,
    best_offer: null,
    supply_origin: null,
    ships_to_project: null,
    landed_cost: null,
    lead_time: null,
    regulatory_state: regulatory.state,
    regulatory_rules: regulatory.rules,
    missing_evidence: regulatory.missing_evidence,
    geometry_or_bim_status: cov ? {
      geometry_ready:cov.geometry_ready ?? 0,
      render_ready:cov.render_ready ?? 0
    } : {geometry_ready:0,render_ready:0},
    required_order_date: null,
    procurement_route: cov?.commerce_ready > 0 ? "OFFER_RESOLUTION_REQUIRED" : "SOURCE_DISCOVERY_REQUIRED",
    blockers: [
      ...(category?[]:["category_missing"]),
      ...(technical.state==="HOLD"?["specification_profile_missing"]:[]),
      ...(technical.state==="BLOCK"?["taxonomy_block"]:[]),
      ...((cov?.candidates??0)===0?["supply_missing"]:[]),
      ...(["BLOCK","HOLD"].includes(regulatory.state)?["regulatory_gate"]:[]),
      ...(project.completeness.ready_for_logistics_screen?[]:["project_logistics_context_incomplete"])
    ]
  };
});

const summary={
  generated_at:new Date().toISOString(),
  test_id:test.test_id,
  project_id:project.project_id,
  project_context:project.completeness,
  slots:slots.length,
  categories_resolved:slots.filter(x=>x.canonical_category).length,
  categories_with_supply:slots.filter(x=>x.candidate_supply_count>0).length,
  technical_profiles_available:slots.filter(x=>x.technical_specification_status.state==="READY_FOR_REQUIREMENT_CAPTURE").length,
  regulatory_clear_or_review:slots.filter(x=>!["BLOCK","HOLD"].includes(x.regulatory_state)).length,
  end_to_end_ready:slots.filter(x=>x.blockers.length===0).length,
  blocker_counts:Object.fromEntries([...new Set(slots.flatMap(x=>x.blockers))].map(b=>[b,slots.filter(x=>x.blockers.includes(b)).length]))
};

await fs.mkdir(path.join(ROOT,"data/tests/results"),{recursive:true});
await fs.writeFile(path.join(ROOT,"data/tests/results/whole-building-10.latest.json"),JSON.stringify({summary,slots},null,2));
console.log(JSON.stringify(summary,null,2));
