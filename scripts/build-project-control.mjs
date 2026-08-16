import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
async function read(file,fallback=null){try{return JSON.parse(await fs.readFile(path.join(ROOT,file),"utf8"));}catch{return fallback;}}
const project=await read("data/projects/marbella-villa.example.json",{});
const routes=await read("data/procurement/whole-building-10.routes.json",{summary:{},routes:[]});
const matrix=await read("data/coverage/source-matrix.json",{summary:{},categories:[]});
const test=await read("data/tests/results/whole-building-10.latest.json",{summary:{},slots:[]});
const solar=await read("data/energy/project-marbella-villa-001.pvgis.json",{});
const climate=await read("data/energy/project-marbella-villa-001.cte-climate.json",{});
const refs=await read("data/references/project-marbella-villa-001.shopify.json",{selections:[]});
const identity=await read("data/identity/project-marbella-villa-001.identity-links.json",{links:[]});

const matrixById=new Map((matrix.categories??[]).map(x=>[x.category_id,x]));
const testBySlot=new Map((test.slots??[]).map(x=>[x.slot_id,x]));
const refBySlot=new Map((refs.selections??[]).map(x=>[x.slot_id,x]));
const idBySlot=new Map((identity.links??[]).map(x=>[x.slot_id,x]));

function tone(state){
  const s=String(state??"");
  if(["ready","PASS","verified","VERIFIED","CREATED","provisional"].includes(s))return"good";
  if(["REVIEW","needs_technical_review","needs_account","needs_quote","needs_identity","unverified","UNRESOLVED"].includes(s))return"review";
  if(["HOLD","needs_requirement","needs_inputs","ADDRESS_REQUIRED"].includes(s))return"hold";
  if(["BLOCK","blocked"].includes(s))return"bad";
  return"muted";
}
function esc(v){return String(v??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function pretty(v){return String(v??"").replaceAll("_"," ");}
function badge(label,state=label){return `<span class="tag ${tone(state)}">${esc(pretty(label))}</span>`;}

const slots=(routes.routes??[]).map(r=>{
  const cov=matrixById.get(r.category_id)??{};
  const tst=testBySlot.get(r.slot_id)??{};
  const ref=refBySlot.get(r.slot_id)??{};
  const id=idBySlot.get(r.slot_id)??{};
  return{
    slot_id:r.slot_id,label:r.label,category_id:r.category_id,phase:tst.phase??null,
    requirement:{id:r.requirement_id,state:r.requirement_state??(r.inputs_required?.length?"needs_inputs":"not_modeled"),missing:r.state==="needs_requirement"?(r.inputs_required??[]):[]},
    coverage:{state:cov.coverage_state??"NO_SOURCE",live_discovery:cov.live_discovery_signals??0,manufacturer_evidence:cov.authoritative_manufacturer_evidence_records??0,direct_trade_sources:cov.direct_trade_sources??0,sources:cov.source_mappings??[]},
    identity:{state:id.identity_state??r.identity_state??"UNRESOLVED",evidence_id:id.matched_evidence_id??null,stable_reference:!!ref.external_reference},
    technical:{verified:tst.technical_match_verified??false,state:tst.technical_match_verified?"verified":"unverified"},
    regulation:{state:tst.regulatory_state??"unresolved",missing:tst.missing_regulatory_evidence??[]},
    commerce:{route:r.route_type,source:r.source_id,state:r.state,stable_shopify_ref:!!r.selected_external_reference},
    logistics:{postcode_offer_count:tst.postcode_deliverable_offer_count??0,landed_cost_known:tst.landed_cost_known??false,lead_time_known:tst.lead_time_known??false},
    next_actions:r.inputs_required??[],fallbacks:r.fallbacks??[]
  };
});

const dashboard={
  generated_at:new Date().toISOString(),
  project:{id:project.project_id,name:project.name,location:`${project.location?.municipality??""}, ${project.location?.region??""}`,postcode:project.location?.postal_code??null,cte_zone:climate.cte_zone??null,solar_yield_kwh_per_kwp:solar.performance?.annual_energy_kwh_per_kwp??null,solar_optimal_tilt_deg:solar.optimized_plane?.tilt_deg??null},
  metrics:{canonical_categories:matrix.summary?.canonical_categories??0,categories_with_any_source:matrix.summary?.categories_with_any_source??0,live_shopify_categories:matrix.summary?.categories_with_live_discovery??0,direct_trade_categories:matrix.summary?.categories_with_direct_trade_source??0,authoritative_evidence_categories:matrix.summary?.categories_with_authoritative_manufacturer_evidence??0,slots:slots.length,slots_with_stable_commerce_ref:slots.filter(x=>x.identity.stable_reference).length,slots_with_postcode_offer:slots.filter(x=>x.logistics.postcode_offer_count>0).length,slots_technically_verified:slots.filter(x=>x.technical.verified).length,procurement_ready:routes.summary?.executable_now??0},
  slots
};
await fs.mkdir(path.join(ROOT,"data/dashboard"),{recursive:true});
await fs.writeFile(path.join(ROOT,"data/dashboard/project-control.json"),JSON.stringify(dashboard,null,2));

const kpis=[
  ["Categories mapped",`${dashboard.metrics.categories_with_any_source}/${dashboard.metrics.canonical_categories}`],
  ["Shopify live",dashboard.metrics.live_shopify_categories],
  ["Direct trade",dashboard.metrics.direct_trade_categories],
  ["Stable refs",`${dashboard.metrics.slots_with_stable_commerce_ref}/${dashboard.metrics.slots}`],
  ["Postcode offers",`${dashboard.metrics.slots_with_postcode_offer}/${dashboard.metrics.slots}`],
  ["Procurement ready",`${dashboard.metrics.procurement_ready}/${dashboard.metrics.slots}`]
];
const routeTypes=["all",...new Set(slots.map(x=>x.commerce.route))];
const filterHtml=routeTypes.map((r,i)=>`<button class="filter ${i===0?"on":""}" data-filter="${esc(r)}">${esc(pretty(r))}</button>`).join("");
const rowsHtml=slots.map(x=>{
  const actions=(x.next_actions.length?x.next_actions:["No next action recorded"]).slice(0,4).map(a=>`<div>${esc(a)}</div>`).join("");
  const sourceBadges=(x.coverage.sources??[]).slice(0,3).map(s=>badge(s.source_id,s.source_type.includes("trade")?"verified":"muted")).join("");
  return `<div class="row" data-route="${esc(x.commerce.route)}">
    <div class="cell"><div class="name">${esc(x.label)}</div><div class="cat">${esc(x.category_id)}</div></div>
    <div class="cell">${badge(x.requirement.state,x.requirement.state)}<div class="small">${x.requirement.missing.length?esc(x.requirement.missing.length+" missing inputs"):"requirement captured / not modeled"}</div></div>
    <div class="cell"><div class="n">${esc(x.coverage.live_discovery)}</div><div class="small">live discovery</div>${x.coverage.direct_trade_sources?badge(x.coverage.direct_trade_sources+" direct","verified"):""}${x.coverage.manufacturer_evidence?badge(x.coverage.manufacturer_evidence+" evidence","verified"):""}<div class="sourcebadges">${sourceBadges}</div></div>
    <div class="cell">${badge(x.identity.state,x.identity.state)}<div class="small">stable ref ${x.identity.stable_reference?"yes":"no"}</div></div>
    <div class="cell">${badge(x.technical.state,x.technical.state)}</div>
    <div class="cell">${badge(x.regulation.state,x.regulation.state)}</div>
    <div class="cell"><div class="route">${esc(pretty(x.commerce.route))}</div>${badge(x.commerce.state,x.commerce.state)}<div class="small">${esc(x.commerce.source??"source unresolved")}</div></div>
    <div class="cell actions">${actions}</div>
  </div>`;
}).join("");

const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Product Twin · Project Control</title><style>
:root{--bg:#ede9df;--paper:#f8f6f0;--ink:#17231d;--green:#204d3b;--line:#d8d2c6;--muted:#738078;--good:#2f6b4f;--hold:#a36f22;--review:#6f668e;--bad:#9a4e42}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:13px Inter,system-ui,-apple-system,sans-serif}.top{background:#16231c;color:white;padding:24px 28px}.eyebrow{text-transform:uppercase;letter-spacing:.15em;font-size:10px;opacity:.72}.top h1{font-size:27px;margin:6px 0 4px}.sub{opacity:.68;font-size:12px}.wrap{max-width:1500px;margin:auto;padding:20px}.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:16px}.kpi{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:12px}.kpi span{font-size:9px;text-transform:uppercase;letter-spacing:.09em;color:var(--muted)}.kpi b{display:block;font-size:23px;margin-top:4px}.context{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}.pill{background:#e0ded5;border-radius:14px;padding:6px 9px;font-size:10px}.table{background:var(--paper);border:1px solid var(--line);border-radius:14px;overflow:hidden}.row{display:grid;grid-template-columns:180px 120px 160px 130px 110px 120px 155px 1fr;border-top:1px solid var(--line);min-height:82px}.row.head{min-height:auto;background:#e4e0d7;border-top:0;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#69746d}.cell{padding:11px;border-left:1px solid var(--line)}.cell:first-child{border-left:0}.name{font-size:14px;font-weight:700}.cat{font-size:9px;color:var(--muted);margin-top:4px}.tag{display:inline-block;font-size:9px;padding:4px 6px;border-radius:9px;margin:2px 2px 2px 0;background:#e4e2da}.tag.good{background:#dce9df;color:#24583e}.tag.hold{background:#f2e4cd;color:#815712}.tag.review{background:#e6e1ef;color:#574e78}.tag.bad{background:#eedbd7;color:#803e34}.tag.muted{color:#6d746f}.n{font-size:18px;font-weight:700}.small{font-size:9px;color:var(--muted);line-height:1.45}.route{font-weight:700;margin-bottom:4px}.actions{font-size:10px;line-height:1.45}.actions div:before{content:'→ ';color:var(--green);font-weight:700}.legend{font-size:10px;color:var(--muted);margin:12px 2px}.filters{margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap}.filter{border:1px solid var(--line);background:var(--paper);border-radius:16px;padding:7px 10px;cursor:pointer;font-size:10px}.filter.on{background:var(--green);color:white;border-color:var(--green)}.hidden{display:none}.sourcebadges{margin-top:5px}@media(max-width:1100px){.kpis{grid-template-columns:repeat(3,1fr)}.table{overflow-x:auto}.row{min-width:1170px}}@media(max-width:650px){.kpis{grid-template-columns:repeat(2,1fr)}.wrap{padding:10px}}
</style></head><body><div class="top"><div class="eyebrow">Product Twin · Plot to Project</div><h1>${esc(dashboard.project.name||dashboard.project.id)}</h1><div class="sub">${esc(dashboard.project.location)} · ${esc(dashboard.project.postcode)}</div></div><div class="wrap"><div class="kpis">${kpis.map(x=>`<div class="kpi"><span>${esc(x[0])}</span><b>${esc(x[1])}</b></div>`).join("")}</div><div class="context">${[dashboard.project.cte_zone?`CTE ${dashboard.project.cte_zone}`:null,dashboard.project.solar_yield_kwh_per_kwp?`${Math.round(dashboard.project.solar_yield_kwh_per_kwp).toLocaleString()} kWh/kWp/yr`:null,dashboard.project.solar_optimal_tilt_deg!=null?`PV optimum ~${dashboard.project.solar_optimal_tilt_deg}° tilt`:null].filter(Boolean).map(x=>`<span class="pill">${esc(x)}</span>`).join("")}</div><div class="filters">${filterHtml}</div><div class="table"><div class="row head"><div class="cell">Project slot</div><div class="cell">Requirement</div><div class="cell">Supply graph</div><div class="cell">Identity</div><div class="cell">Technical</div><div class="cell">Regulation</div><div class="cell">Procurement</div><div class="cell">Next</div></div><div id="rows">${rowsHtml}</div></div><div class="legend">Green = verified/ready signal · amber = missing design input · violet = review/verification gate · procurement remains blocked until all required gates clear.</div></div><script>document.querySelectorAll('.filter').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('.filter').forEach(function(x){x.classList.remove('on')});b.classList.add('on');var f=b.getAttribute('data-filter');document.querySelectorAll('.row[data-route]').forEach(function(r){r.classList.toggle('hidden',f!=='all'&&r.getAttribute('data-route')!==f)})})});</script></body></html>`;

await fs.mkdir(path.join(ROOT,"prototype"),{recursive:true});
await fs.writeFile(path.join(ROOT,"prototype/project-control.html"),html);
console.log(JSON.stringify({project:dashboard.project.id,slots:slots.length,html:"prototype/project-control.html",json:"data/dashboard/project-control.json"},null,2));
