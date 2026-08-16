import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const projectPath=process.argv[2]||"data/projects/marbella-villa.example.json";
const project=JSON.parse(await fs.readFile(path.join(ROOT,projectPath),"utf8"));
const concrete=project.structure?.concrete??{};
const procurement=project.procurement??{};

function present(v){return v!==null&&v!==undefined&&String(v).trim()!=="";}
function positive(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:null;}

const missing=[];
if(!present(concrete.compressive_strength))missing.push("specified concrete compressive-strength class");
if(!present(concrete.exposure_class))missing.push("exposure class / durability environment");
if(!present(concrete.consistency_or_slump))missing.push("consistency or slump class");
if(!positive(concrete.aggregate_max_mm))missing.push("maximum aggregate size");
if(!positive(concrete.quantity_m3))missing.push("estimated concrete quantity in m3 by pour/package");
if(!present(concrete.required_on_site_date))missing.push("required pour/delivery date or construction programme milestone");
if(!project.location?.address)missing.push("real project delivery address for batching-plant routing and truck logistics");
if(!project.location?.postal_code)missing.push("project postal code");

const requirement={
  requirement_id:`REQ_STRUCTURAL_CONCRETE_${project.project_id}`,
  project_id:project.project_id,
  system:"structural_concrete",
  status:missing.length?"needs_inputs":"provisional",
  objective:"Convert the engineered structural concrete specification and construction programme into a configured-material RFQ/order requirement.",
  required_performance:{
    compressive_strength:concrete.compressive_strength??null,
    exposure_class:concrete.exposure_class??null,
    consistency_or_slump:concrete.consistency_or_slump??null,
    aggregate_max_mm:positive(concrete.aggregate_max_mm),
    chloride_class:concrete.chloride_class??null,
    cement_or_binder_constraints:concrete.cement_or_binder_constraints??null,
    special_requirements:concrete.special_requirements??[]
  },
  quantity_and_schedule:{
    quantity_m3:positive(concrete.quantity_m3),
    required_on_site_date:concrete.required_on_site_date??null,
    pour_id:concrete.pour_id??null,
    pour_sequence:concrete.pour_sequence??null,
    discharge_rate_m3_h:positive(concrete.discharge_rate_m3_h),
    pump_required:concrete.pump_required??null
  },
  sustainability:{
    max_embodied_carbon_kgco2e_m3:positive(concrete.max_embodied_carbon_kgco2e_m3),
    epd_required:concrete.epd_required??null,
    recycled_content_target_percent:positive(concrete.recycled_content_target_percent)
  },
  logistics_constraints:{
    project_address:project.location?.address??null,
    postal_code:project.location?.postal_code??null,
    coordinates:Number.isFinite(project.location?.lat)&&Number.isFinite(project.location?.lon)?{lat:project.location.lat,lon:project.location.lon}:null,
    site_access:project.logistics?.site_access??null,
    batching_plant:"resolve from supplier against project location and required mix",
    delivery_mode:"mixer_truck",
    time_slot:"must coordinate with pour programme",
    local_preference:procurement.local_preference??null
  },
  product_twin_category_ids:["STRUCTURE.CONCRETE"],
  configured_twin:{
    kind:"configured_material",
    configuration_status:missing.length?"needs_inputs":"provisional",
    pricing_mode:"rfq",
    commerce_basis:"m3"
  },
  selection_sequence:[
    "receive structural engineer's concrete specification",
    "split requirement into pours / programme packages",
    "resolve viable local batching plants and delivery radius",
    "request configured mix / quote from direct concrete sources",
    "verify declared mix performance, plant quality evidence and sustainability documentation",
    "rank by technical compliance before price, then plant distance, embodied carbon, capacity, truck logistics and delivered price",
    "reserve pour slot and mixer/pump logistics",
    "track trucks / delivery tickets / as-delivered batch evidence",
    "attach tickets and conformity records back to the project Twin"
  ],
  missing_inputs:missing,
  principle:"Ready-mix concrete is procured as an engineered, configured, plant-and-pour-specific material—not as a generic catalog SKU."
};

const slug=project.project_id.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
await fs.mkdir(path.join(ROOT,"data/requirements"),{recursive:true});
await fs.writeFile(path.join(ROOT,`data/requirements/${slug}.structural-concrete.json`),JSON.stringify(requirement,null,2));
console.log(JSON.stringify({requirement_id:requirement.requirement_id,status:requirement.status,missing_inputs:requirement.missing_inputs},null,2));
