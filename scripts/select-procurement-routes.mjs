import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const project=JSON.parse(await fs.readFile(path.join(ROOT,"data/projects/marbella-villa.example.json"),"utf8"));
const test=JSON.parse(await fs.readFile(path.join(ROOT,"data/tests/whole-building-10.json"),"utf8"));

async function read(file,fallback=null){try{return JSON.parse(await fs.readFile(path.join(ROOT,file),"utf8"));}catch{return fallback;}}
const sourceMatrix=await read("data/coverage/source-matrix.json",{categories:[]});
const refs=await read("data/references/project-marbella-villa-001.shopify.json",{selections:[]});
const identity=await read("data/identity/project-marbella-villa-001.identity-links.json",{links:[]});
const whole=await read("data/tests/results/whole-building-10.latest.json",{slots:[]});
const concreteReq=await read("data/requirements/project-marbella-villa-001.structural-concrete.json");
const poolReq=await read("data/requirements/project-marbella-villa-001.pool-circulation.json");
const solarReq=await read("data/energy/project-marbella-villa-001.solar-requirement.json");

const coverageById=new Map((sourceMatrix.categories??[]).map(x=>[x.category_id,x]));
const refBySlot=new Map((refs.selections??[]).map(x=>[x.slot_id,x]));
const identityBySlot=new Map((identity.links??[]).map(x=>[x.slot_id,x]));
const wholeBySlot=new Map((whole.slots??[]).map(x=>[x.slot_id,x]));

function requirementFor(categoryId){
  if(categoryId==="STRUCTURE.CONCRETE")return concreteReq;
  if(categoryId==="POOL.PUMPS")return poolReq;
  if(categoryId.startsWith("ENERGY.SOLAR.")||categoryId==="ENERGY.BATTERY")return solarReq;
  return null;
}

function sourceCandidates(categoryId){
  return coverageById.get(categoryId)?.source_mappings??[];
}

function findSource(categoryId,predicate){
  return sourceCandidates(categoryId).find(predicate)??null;
}

function routeFor(slot){
  const categoryId=slot.category_id;
  const requirement=requirementFor(categoryId);
  const sources=sourceCandidates(categoryId);
  const selectedRef=refBySlot.get(slot.slot_id)?.external_reference??null;
  const identityLink=identityBySlot.get(slot.slot_id)??null;
  const wholeState=wholeBySlot.get(slot.slot_id)??null;

  const direct=findSource(categoryId,s=>["trade_portal","manufacturer_trade_portal","manufacturer","distributor"].includes(s.source_type));
  const shopify=findSource(categoryId,s=>s.source_id==="shopify_global_catalog") || (selectedRef?{source_id:"shopify_global_catalog",source_type:"global_catalog"}:null);
  const configured=["STRUCTURE.CONCRETE","OPENINGS.WINDOWS","KITCHEN.CABINETRY","KITCHEN.WORKTOPS"].includes(categoryId);

  const base={
    slot_id:slot.slot_id,
    label:slot.label,
    category_id:categoryId,
    project_id:test.project_id,
    requirement_id:requirement?.requirement_id??null,
    requirement_state:requirement?.status??null,
    selected_external_reference:selectedRef?{
      source_id:selectedRef.source_id,
      product_id:selectedRef.external_id??null,
      variant_id:selectedRef.variant_id??null
    }:null,
    identity_state:identityLink?.identity_state??"UNRESOLVED",
    available_sources:sources.map(s=>({source_id:s.source_id,source_type:s.source_type,fitness:s.fitness,auth_state:s.auth_state??null})),
    route_type:"unresolved",
    source_id:null,
    state:"blocked",
    reason:"No route selected",
    inputs_required:[],
    fallbacks:[]
  };

  if(configured && direct){
    base.route_type="configured_rfq";
    base.source_id=direct.source_id;
    base.state=requirement?.status==="provisional"?"needs_quote":"needs_requirement";
    base.reason=`${categoryId} behaves as a project-configured product; direct RFQ/trade procurement is preferred over retail carting.`;
    base.inputs_required=requirement?.missing_inputs??["complete configured-product requirement"];
    if(shopify)base.fallbacks.push({route_type:"merchant_cart",source_id:"shopify_global_catalog",state:"discovery_or_small_quantity_only",reason:"Useful for exploratory/small packaged products, not preferred project procurement route."});
    return base;
  }

  if(categoryId==="POOL.PUMPS" && direct){
    base.route_type="direct_trade";
    base.source_id=direct.source_id;
    if(requirement?.status!=="provisional"){
      base.state="needs_requirement";
      base.reason="Specialist direct trade source exists, but pump selection must wait for a hydraulic duty requirement.";
      base.inputs_required=requirement?.missing_inputs??[];
    }else if(base.identity_state==="UNRESOLVED"){
      base.state="needs_identity";
      base.reason="Hydraulic requirement exists; choose/verify an exact manufacturer pump identity before trade ordering.";
    }else{
      base.state=direct.auth_state==="ACCOUNT_REQUIRED"?"needs_account":"needs_technical_review";
      base.reason="Direct pool trade source is preferred once exact pump identity and project fit are verified.";
    }
    if(shopify)base.fallbacks.push({route_type:"merchant_cart",source_id:"shopify_global_catalog",state:selectedRef?"available":"live_lookup_required",reason:"Valid alternate commerce route for a technically verified exact pump."});
    return base;
  }

  if((categoryId.startsWith("ENERGY.SOLAR.")||categoryId==="ENERGY.BATTERY") && requirement){
    base.route_type=direct?"direct_trade":(shopify?"merchant_cart":"supplier_quote");
    base.source_id=direct?.source_id??shopify?.source_id??null;
    if(requirement.status!=="provisional"){
      base.state="needs_requirement";
      base.reason="Solar hardware must follow the project performance/electrical requirement; current system sizing inputs are incomplete.";
      base.inputs_required=requirement.missing_inputs??[];
    }else if(base.identity_state==="UNRESOLVED"){
      base.state="needs_identity";
      base.reason="System requirement is defined but the selected commerce offer is not yet linked to authoritative manufacturer identity.";
    }else{
      base.state="needs_technical_review";
      base.reason="Exact identity exists; electrical compatibility and regulation must clear before procurement.";
    }
    return base;
  }

  if(shopify && selectedRef){
    base.route_type="merchant_cart";
    base.source_id="shopify_global_catalog";
    base.state="needs_technical_review";
    base.reason="A live-refresh Shopify reference and merchant Cart MCP path exist; procurement waits for exact technical identity/fit and final logistics quote.";
    if(wholeState?.blockers?.includes("landed_cost_missing"))base.inputs_required.push("authoritative shipping/landed cost via Checkout or supplier quote");
    if(wholeState?.blockers?.includes("lead_time_missing"))base.inputs_required.push("verified lead time");
    if(base.identity_state==="UNRESOLVED")base.inputs_required.push("canonical manufacturer identity / exact model verification");
    return base;
  }

  if(direct){
    base.route_type="direct_trade";
    base.source_id=direct.source_id;
    base.state=direct.auth_state?"needs_account":"needs_quote";
    base.reason="A specialist direct source exists; no validated retail reference is required.";
    return base;
  }

  if(shopify){
    base.route_type="merchant_cart";
    base.source_id="shopify_global_catalog";
    base.state="needs_identity";
    base.reason="Shopify is a usable live commerce source, but no persistent exact selection is currently validated for this slot.";
    return base;
  }

  base.route_type="tender";
  base.state="needs_quote";
  base.reason="No executable source adapter exists yet; source discovery/vendor onboarding is required.";
  return base;
}

const routes=test.requirements.map(routeFor);
const summary={
  generated_at:new Date().toISOString(),
  project_id:test.project_id,
  slots:routes.length,
  by_route:Object.fromEntries([...new Set(routes.map(x=>x.route_type))].map(r=>[r,routes.filter(x=>x.route_type===r).length])),
  by_state:Object.fromEntries([...new Set(routes.map(x=>x.state))].map(s=>[s,routes.filter(x=>x.state===s).length])),
  executable_now:routes.filter(x=>x.state==="ready").length,
  principle:"Route follows product behavior and project requirement; retail checkout is not the universal procurement mechanism."
};
await fs.mkdir(path.join(ROOT,"data/procurement"),{recursive:true});
await fs.writeFile(path.join(ROOT,"data/procurement/whole-building-10.routes.json"),JSON.stringify({summary,routes},null,2));
console.log(JSON.stringify(summary,null,2));
