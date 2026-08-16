import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const profiles=JSON.parse(await fs.readFile(path.join(ROOT,"config/specification-profiles.json"),"utf8"));
const taxonomy=JSON.parse(await fs.readFile(path.join(ROOT,"config/taxonomy.json"),"utf8"));
const energy=JSON.parse(await fs.readFile(path.join(ROOT,"config/taxonomy-energy-extension.json"),"utf8"));
const candidates=JSON.parse(await fs.readFile(path.join(ROOT,"data/shopify/triage/latest.json"),"utf8"));
let offers={slots:[]};
try{offers=JSON.parse(await fs.readFile(path.join(ROOT,"data/offers/whole-building-10.latest.json"),"utf8"));}catch{}

function flatten(nodes,out=[]){for(const n of nodes){if(n.children)flatten(n.children,out);else out.push(n);}return out;}
const leaves=flatten(taxonomy.top_level);
for(const n of energy.top_level?.children??[]){const i=leaves.findIndex(x=>x.id===n.id);if(i>=0)leaves[i]=n;else leaves.push(n);}
const categoryById=new Map(leaves.map(x=>[x.id,x]));
const candidateById=new Map(candidates.map(x=>[x.candidate_id,x]));

function norm(s){return String(s??"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");}
function flattenSpecs(value,prefix="",out={}){
  if(value==null)return out;
  if(Array.isArray(value)){
    for(const item of value){
      if(item && typeof item==="object" && (item.name||item.label||item.key)){
        const k=norm(item.name??item.label??item.key);
        out[k]=item.value??item.values??item.text??item.description??item;
      }else if(typeof item==="string"){
        out[norm(item)]=true;
      }
    }
    return out;
  }
  if(typeof value==="object"){
    for(const [k,v] of Object.entries(value)){
      const key=norm(prefix?`${prefix}_${k}`:k);
      if(v && typeof v==="object" && !Array.isArray(v)) flattenSpecs(v,key,out);
      else out[key]=v;
    }
    return out;
  }
  out[norm(prefix||"value")]=value;
  return out;
}

const aliases={
  width_mm:["width","product_width","dimensions_width"],
  height_mm:["height","product_height","dimensions_height"],
  depth_mm:["depth","product_depth","dimensions_depth"],
  dimensions:["dimensions","dimension","size","product_dimensions"],
  rated_power_wp:["rated_power","power","maximum_power","max_power","pmax","wattage"],
  module_efficiency_percent:["module_efficiency","efficiency"],
  voc_v:["voc","open_circuit_voltage"],
  isc_a:["isc","short_circuit_current"],
  vmp_v:["vmp","voltage_at_maximum_power","maximum_power_voltage"],
  imp_a:["imp","current_at_maximum_power","maximum_power_current"],
  rated_ac_power_w:["rated_ac_power","ac_power","nominal_ac_power","output_power"],
  max_dc_input_power_w:["max_dc_input_power","maximum_dc_power","max_input_power"],
  mppt_voltage_range_v:["mppt_voltage_range","mppt_range"],
  max_input_voltage_v:["max_input_voltage","maximum_input_voltage"],
  ac_nominal_voltage_v:["ac_nominal_voltage","nominal_voltage","output_voltage"],
  frequency_hz:["frequency","grid_frequency"],
  phase:["phase","phases"],
  capacity:["capacity","heating_capacity","cooling_capacity"],
  power_supply:["power_supply","voltage","electrical_supply"],
  nominal_diameter:["nominal_diameter","diameter","dn"],
  outside_diameter:["outside_diameter","outer_diameter","od"],
  pressure_rating:["pressure_rating","pn","working_pressure"],
  connection_type:["connection_type","connection","joint_type"],
  compressive_strength:["compressive_strength","strength_class","concrete_strength"],
  exposure_class:["exposure_class"],
  consistency_or_slump:["slump","consistency","slump_class"],
  aggregate_max_mm:["aggregate_max","max_aggregate","maximum_aggregate_size"],
  format:["format","size","dimensions"],
  thickness_mm:["thickness","product_thickness"],
  finish:["finish","surface_finish"]
};

function findSignal(field,signals){
  const keys=[norm(field),...(aliases[field]??[]).map(norm)];
  for(const k of keys){if(Object.prototype.hasOwnProperty.call(signals,k))return {key:k,value:signals[k]};}
  for(const [k,v] of Object.entries(signals)){
    if(keys.some(w=>k.endsWith(`_${w}`)||k.includes(w)))return {key:k,value:v};
  }
  return null;
}

const slots=[];
for(const slot of offers.slots??[]){
  const category=categoryById.get(slot.category_id);
  const profile=category?profiles.profiles?.[category.profile]:null;
  const required=profile?.required_for_specification??[];
  const rows=[];
  for(const offer of slot.offers??[]){
    const c=candidateById.get(offer.candidate_id);
    if(!c)continue;
    const metadata=c.product?.metadata??{};
    const signals={
      ...flattenSpecs(metadata.tech_specs??{}),
      ...flattenSpecs(metadata.specifications??{}),
      ...flattenSpecs(metadata.attributes??{})
    };
    const found={};
    const missing=[];
    for(const f of required){
      const hit=findSignal(f,signals);
      if(hit)found[f]={value:hit.value,source_key:hit.key}; else missing.push(f);
    }
    rows.push({
      candidate_id:c.candidate_id,
      title:c.identity?.title??null,
      profile:category?.profile??null,
      evidence_grade:"C_INFERRED_CATALOG",
      authority:"shopify_inferred_metadata",
      inferred_fields:found,
      required_fields:required,
      missing_required_fields:missing,
      inferred_completeness:required.length?Number(((required.length-missing.length)/required.length).toFixed(3)):0,
      can_verify_technical_match:false,
      next_action:"manufacturer_or_authoritative_technical_evidence_required"
    });
  }
  rows.sort((a,b)=>b.inferred_completeness-a.inferred_completeness);
  slots.push({slot_id:slot.slot_id,category_id:slot.category_id,profile:category?.profile??null,candidates:rows});
}

const summary={
  generated_at:new Date().toISOString(),
  slots:slots.length,
  candidates_evaluated:slots.reduce((n,s)=>n+s.candidates.length,0),
  candidates_with_any_required_signal:slots.reduce((n,s)=>n+s.candidates.filter(x=>x.inferred_completeness>0).length,0),
  authoritative_matches:0,
  principle:"Shopify inferred fields are discovery signals only. They never satisfy authoritative technical or regulatory evidence gates."
};
await fs.mkdir(path.join(ROOT,"data/technical"),{recursive:true});
await fs.writeFile(path.join(ROOT,"data/technical/whole-building-10.latest.json"),JSON.stringify({summary,slots},null,2));
console.log(JSON.stringify(summary,null,2));
