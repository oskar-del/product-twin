import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const projectPath=process.argv[2]||"data/projects/marbella-villa.example.json";
const project=JSON.parse(await fs.readFile(path.join(ROOT,projectPath),"utf8"));
const pool=project.pool??{};

function n(v){const x=Number(v);return Number.isFinite(x)&&x>0?x:null;}
const volume=n(pool.volume_m3);
const turnover=n(pool.target_turnover_hours);
const explicitFlow=n(pool.required_flow_m3_h);
const head=n(pool.total_dynamic_head_m);
const flow=explicitFlow??(volume&&turnover?volume/turnover:null);

const missing=[];
if(!flow)missing.push("pool volume + target turnover time, or explicit required filtration flow");
if(!head)missing.push("total dynamic head from pipe/fitting/filter/equipment hydraulic calculation");
if(!pool.pipe_system?.pump_connection)missing.push("pump connection / pipe and fitting system");
if(!pool.plant?.phase)missing.push("pool plant electrical phase/circuit");
if(!pool.plant?.voltage_v&&!project.electrical?.nominal_voltage_v)missing.push("pool plant voltage");
if(!pool.plant?.frequency_hz&&!project.electrical?.frequency_hz)missing.push("pool plant frequency");

const requirement={
  requirement_id:`REQ_POOL_CIRCULATION_${project.project_id}`,
  project_id:project.project_id,
  system:"pool_circulation",
  status:missing.length?"needs_inputs":"provisional",
  objective:"Define the hydraulic and electrical duty for the pool circulation system before selecting a commercial pump.",
  design_inputs:{
    pool_volume_m3:volume,
    target_turnover_hours:turnover,
    explicit_required_flow_m3_h:explicitFlow,
    total_dynamic_head_m:head
  },
  required_performance:{
    filtration_flow_m3_h:flow?Number(flow.toFixed(3)):null,
    duty_head_m:head,
    duty_point:flow&&head?{flow_m3_h:Number(flow.toFixed(3)),head_m:head}:null
  },
  physical_constraints:{
    pump_connection:pool.pipe_system?.pump_connection??null,
    plant_room_clearance:pool.plant?.clearance??null,
    noise_target_db:pool.plant?.noise_target_db??null
  },
  electrical_or_connection_constraints:{
    voltage_v:pool.plant?.voltage_v??project.electrical?.nominal_voltage_v??null,
    frequency_hz:pool.plant?.frequency_hz??project.electrical?.frequency_hz??null,
    phase:pool.plant?.phase??null
  },
  regulatory_constraints:[
    "Spain REBT / ITC-BT-31 installation review for pool electrical equipment"
  ],
  product_twin_category_ids:["POOL.PUMPS","POOL.FILTRATION","POOL.PIPE","POOL.FITTINGS"],
  selection_sequence:[
    "derive pool water volume from designed geometry",
    "set circulation/turnover objective with project engineer/operator",
    "calculate total dynamic head across pipework, fittings, filter and equipment",
    "define pipe size and pump connection system",
    "confirm pool-plant electrical circuit",
    "match manufacturer Q-H curve to required duty point",
    "check efficiency/noise/control requirements",
    "run REBT/ITC-BT-31 installation screen",
    "resolve local/direct trade and live commerce routes",
    "rank by technical fit, lifecycle energy, locality, availability, delivered cost and lead time"
  ],
  missing_inputs:missing,
  principle:"Pump horsepower is not the design requirement. Product Twin selects a pump only after a hydraulic duty point is defined."
};

const slug=project.project_id.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
await fs.mkdir(path.join(ROOT,"data/requirements"),{recursive:true});
await fs.writeFile(path.join(ROOT,`data/requirements/${slug}.pool-circulation.json`),JSON.stringify(requirement,null,2));
console.log(JSON.stringify({requirement_id:requirement.requirement_id,status:requirement.status,duty_point:requirement.required_performance.duty_point,missing_inputs:requirement.missing_inputs},null,2));
