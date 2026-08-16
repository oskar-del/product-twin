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
let offerResolution={slots:[]};
try { coverage=JSON.parse(await fs.readFile(path.join(ROOT,"data/coverage/latest.json"),"utf8")); } catch {}
try { offerResolution=JSON.parse(await fs.readFile(path.join(ROOT,"data/offers/whole-building-10.latest.json"),"utf8")); } catch {}

function flatten(nodes,out=[]) {
  for (const n of nodes) {
    if (n.children) flatten(n.children,out);
    else out.push(n);
  }
  return out;
}

const leaves=flatten(taxonomy.top_level);
for (const n of energy.top_level?.children ?? []) {
  const i=leaves.findIndex(x=>x.id===n.id);
  if(i>=0) leaves[i]=n; else leaves.push(n);
}
const categoryById=new Map(leaves.map(x=>[x.id,x]));
const coverageById=new Map((coverage.categories??[]).map(x=>[x.category_id,x]));
const offersBySlot=new Map((offerResolution.slots??[]).map(x=>[x.slot_id,x]));

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
  const resolved=offersBySlot.get(slot.slot_id);
  const offer=resolved?.best_offer??null;
  const regulatory=aggregateRegulatory(slot.category_id);
  const technical=technicalStatus(category);
  const supplyCount=cov?.candidates??0;
  const ships=offer?.ships_to_project??null;
  const landed=offer?.logistics?.landed_cost??null;
  const leadTime=offer?.logistics?.lead_time_days??null;
  const techMatch=offer?.category_match_status??null;

  const blockers=[
    ...(category?[]:["category_missing"]),
    ...(technical.state==="HOLD"?["specification_profile_missing"]:[]),
    ...(technical.state==="BLOCK"?["taxonomy_block"]:[]),
    ...(supplyCount===0?["supply_missing"]:[]),
    ...(supplyCount>0 && !offer?["offer_resolution_missing"]:[]),
    ...(offer && ships!==true?["destination_not_served"]:[]),
    ...(offer && techMatch!=="verified_technical_match"?["technical_match_unverified"]:[]),
    ...(offer && landed==null?["landed_cost_missing"]:[]),
    ...(offer && leadTime==null?["lead_time_missing"]:[]),
    ...(["BLOCK","HOLD"].includes(regulatory.state)?["regulatory_gate"]:[]),
    ...(project.completeness.ready_for_logistics_screen?[]:["project_logistics_context_incomplete"])
  ];

  let procurementRoute="SOURCE_DISCOVERY_REQUIRED";
  if(supplyCount>0) procurementRoute="OFFER_RESOLUTION_REQUIRED";
  if(offer?.ships_to_project) procurementRoute="TECHNICAL_AND_LOGISTICS_ENRICHMENT_REQUIRED";
  if(offer?.ships_to_project && techMatch==="verified_technical_match" && landed!=null && leadTime!=null && !["BLOCK","HOLD"].includes(regulatory.state)) procurementRoute="READY_FOR_PROCUREMENT";

  return {
    ...slot,
    canonical_category: category ? {id:category.id,name:category.name,profile:category.profile} : null,
    technical_specification_status: technical,
    candidate_supply_count:supplyCount,
    offers_checked:resolved?.candidates_checked??0,
    postcode_deliverable_offers:resolved?.resolved_offer_count??0,
    best_offer:offer,
    supply_origin:offer?.origin??null,
    ships_to_project:ships,
    landed_cost:landed,
    landed_cost_status:offer?.logistics?.landed_cost_status??null,
    lead_time:leadTime,
    lead_time_status:offer?.logistics?.lead_time_status??null,
    regulatory_state:regulatory.state,
    regulatory_rules:regulatory.rules,
    missing_evidence:regulatory.missing_evidence,
    geometry_or_bim_status: cov ? {
      geometry_ready:cov.geometry_ready ?? 0,
      render_ready:cov.render_ready ?? 0
    } : {geometry_ready:0,render_ready:0},
    required_order_date:null,
    procurement_route:procurementRoute,
    blockers:[...new Set(blockers)]
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
  slots_with_resolved_offer:slots.filter(x=>x.best_offer).length,
  slots_with_postcode_delivery:slots.filter(x=>x.ships_to_project===true).length,
  regulatory_clear_or_review:slots.filter(x=>!["BLOCK","HOLD"].includes(x.regulatory_state)).length,
  technical_matches_verified:slots.filter(x=>x.best_offer?.category_match_status==="verified_technical_match").length,
  landed_costs_known:slots.filter(x=>x.landed_cost!=null).length,
  lead_times_known:slots.filter(x=>x.lead_time!=null).length,
  procurement_ready:slots.filter(x=>x.procurement_route==="READY_FOR_PROCUREMENT").length,
  end_to_end_ready:slots.filter(x=>x.blockers.length===0).length,
  blocker_counts:Object.fromEntries([...new Set(slots.flatMap(x=>x.blockers))].map(b=>[b,slots.filter(x=>x.blockers.includes(b)).length]))
};

await fs.mkdir(path.join(ROOT,"data/tests/results"),{recursive:true});
await fs.writeFile(path.join(ROOT,"data/tests/results/whole-building-10.latest.json"),JSON.stringify({summary,slots},null,2));
console.log(JSON.stringify(summary,null,2));
