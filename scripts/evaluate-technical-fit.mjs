import fs from "node:fs/promises";
import path from "node:path";
import { resolveProjectContext } from "./project-context-resolve.mjs";
import { evaluateRegulation } from "./regulatory-evaluate.mjs";

const ROOT=process.cwd();
const evidencePath=process.argv[2]||"data/evidence/manufacturer/huawei-sun2000-10ktl-m1.json";
const projectPath=process.argv[3]||"data/projects/marbella-villa.example.json";
const evidence=JSON.parse(await fs.readFile(path.join(ROOT,evidencePath),"utf8"));
const projectRaw=JSON.parse(await fs.readFile(path.join(ROOT,projectPath),"utf8"));
const slug=projectRaw.project_id.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

async function optionalJson(file){try{return JSON.parse(await fs.readFile(path.join(ROOT,file),"utf8"));}catch{return null;}}
const solar=await optionalJson(`data/energy/${slug}.pvgis.json`);
const climate=await optionalJson(`data/energy/${slug}.cte-climate.json`);
const solarRequirement=await optionalJson(`data/energy/${slug}.solar-requirement.json`);
const project=resolveProjectContext(projectRaw,{solar,climate});

function includesNumeric(value,target,tolerance=0.5){
  const values=Array.isArray(value)?value:[value];
  return values.some(v=>Number.isFinite(Number(v))&&Math.abs(Number(v)-Number(target))<=tolerance);
}

function evidenceCheck(){
  return {
    check:"manufacturer_technical_evidence",
    state:evidence.verification?.technical==="verified"?"PASS":"HOLD",
    detail:evidence.authority?.grade??null
  };
}

function evaluatePowerElectronics(){
  const c=evidence.claims??{};
  const checks=[evidenceCheck()];
  const frequency=project.electrical?.frequency_hz;
  checks.push({check:"grid_frequency",state:frequency&&includesNumeric(c.frequency_hz,frequency)?"PASS":"HOLD",required:frequency??null,product:c.frequency_hz??null});
  const phase=project.electrical?.phase;
  const productThreePhase=String(c.grid_configuration??"").toLowerCase().includes("three-phase");
  checks.push({check:"phase",state:phase==="unknown"||!phase?"HOLD":((phase==="three"&&productThreePhase)||(phase==="single"&&!productThreePhase)?"PASS":"BLOCK"),required:phase??"unknown",product:productThreePhase?"three":"single_or_unknown"});
  const nominal=project.electrical?.nominal_voltage_v;
  const voltagePlausible=nominal&&(includesNumeric(c.phase_voltage_v,nominal,5)||includesNumeric(c.ac_nominal_voltage_v,nominal,10));
  checks.push({check:"nominal_voltage",state:voltagePlausible?"PASS":"HOLD",required:nominal??null,product:{phase_voltage_v:c.phase_voltage_v??null,line_voltage_v:c.ac_nominal_voltage_v??null}});
  const targetKwp=solarRequirement?.project_targets?.calculated_target_kwp;
  checks.push({check:"pv_system_sizing",state:Number.isFinite(targetKwp)?(targetKwp<=Number(c.recommended_max_pv_power_wp??0)/1000?"PASS":"BLOCK"):"HOLD",required_target_kwp:targetKwp??null,product_recommended_max_pv_kwp:Number.isFinite(Number(c.recommended_max_pv_power_wp))?Number(c.recommended_max_pv_power_wp)/1000:null});
  checks.push({check:"territory_applicability",state:evidence.verification?.territory_applicability==="verified"?"PASS":"REVIEW",detail:evidence.verification?.territory_applicability??"unresolved"});
  return checks;
}

function evaluatePoolPump(){
  const c=evidence.claims??{};
  const p=projectRaw.pool??{};
  const plant=p.plant??{};
  const checks=[evidenceCheck()];

  const projectFrequency=plant.frequency_hz??project.electrical?.frequency_hz;
  checks.push({
    check:"pool_plant_frequency",
    state:projectFrequency&&includesNumeric(c.frequency_hz,projectFrequency)?"PASS":"HOLD",
    required:projectFrequency??null,
    product:c.frequency_hz??null
  });

  const projectVoltage=plant.voltage_v??project.electrical?.nominal_voltage_v;
  const voltagePass=projectVoltage&&includesNumeric(c.power_supply_v,projectVoltage,10);
  checks.push({
    check:"pool_plant_voltage",
    state:voltagePass?"PASS":"HOLD",
    required:projectVoltage??null,
    product:c.power_supply_v??null
  });

  const plantPhase=plant.phase??null;
  checks.push({
    check:"pool_plant_phase",
    state:!plantPhase?"HOLD":(plantPhase===c.phase?"PASS":"BLOCK"),
    required:plantPhase??"unresolved",
    product:c.phase??null
  });

  const volume=Number(p.volume_m3);
  const turnover=Number(p.target_turnover_hours);
  const explicitFlow=Number(p.required_flow_m3_h);
  const requiredFlow=Number.isFinite(explicitFlow)&&explicitFlow>0?explicitFlow:(Number.isFinite(volume)&&volume>0&&Number.isFinite(turnover)&&turnover>0?volume/turnover:null);
  const requiredHead=Number(p.total_dynamic_head_m);
  const dutyPoints=Array.isArray(c.duty_points)?c.duty_points:[];
  const maxDocumentedFlow=dutyPoints.length?Math.max(...dutyPoints.map(x=>Number(x.flow_m3_h)||0)):null;
  const maxHead=Number(c.max_head_m);

  let hydraulicState="HOLD";
  let hydraulicDetail="Pool volume/turnover or required flow and total dynamic head are required.";
  if(Number.isFinite(requiredFlow)&&Number.isFinite(requiredHead)){
    const exact=dutyPoints.find(x=>Math.abs(Number(x.flow_m3_h)-requiredFlow)<=0.5&&Math.abs(Number(x.head_m)-requiredHead)<=0.5);
    if(exact){
      hydraulicState="PASS";
      hydraulicDetail="Required duty point is directly supported by a manufacturer-published duty point.";
    } else if((Number.isFinite(maxDocumentedFlow)&&requiredFlow>maxDocumentedFlow*1.15)||(Number.isFinite(maxHead)&&requiredHead>maxHead)){
      hydraulicState="BLOCK";
      hydraulicDetail="Required duty is outside the documented product envelope.";
    } else {
      hydraulicState="REVIEW";
      hydraulicDetail="Required duty is plausibly inside the product envelope but requires the full manufacturer Q-H curve / hydraulic engineering check rather than interpolation from three brochure duty points.";
    }
  }
  checks.push({
    check:"hydraulic_duty",
    state:hydraulicState,
    required:{flow_m3_h:Number.isFinite(requiredFlow)?Number(requiredFlow.toFixed(2)):null,total_dynamic_head_m:Number.isFinite(requiredHead)?requiredHead:null,pool_volume_m3:Number.isFinite(volume)?volume:null,target_turnover_hours:Number.isFinite(turnover)?turnover:null},
    product:{max_head_m:Number.isFinite(maxHead)?maxHead:null,max_documented_flow_m3_h:maxDocumentedFlow,duty_points:dutyPoints},
    detail:hydraulicDetail
  });

  const projectConnection=p.pipe_system?.pump_connection??null;
  checks.push({
    check:"hydraulic_connection",
    state:projectConnection?"REVIEW":"HOLD",
    required:projectConnection,
    product:{external:c.connection_external??null,internal:c.connection_internal??null},
    detail:projectConnection?"Connection string exists; exact fitting/adapter compatibility still requires pipe-system evidence.":"Pool pipe/fitting system at the pump has not been defined."
  });

  checks.push({
    check:"territory_applicability",
    state:evidence.verification?.territory_applicability==="verified"?"PASS":"REVIEW",
    detail:evidence.verification?.territory_applicability??"unresolved"
  });
  return checks;
}

let checks=[];
if(evidence.subject?.category_id==="ENERGY.SOLAR.INVERTER") checks=evaluatePowerElectronics();
else if(evidence.subject?.category_id==="POOL.PUMPS") checks=evaluatePoolPump();
else checks=[evidenceCheck(),{check:"category_evaluator",state:"HOLD",detail:"No category-specific evaluator implemented yet."}];

const regulation=["product_selection","design","installation","connection"].flatMap(stage=>evaluateRegulation({
  jurisdiction_id:project.jurisdiction.resolved_id,
  category_id:evidence.subject.category_id,
  stage,
  evidence:[]
}));

const states=[...checks.map(x=>x.state),...regulation.map(x=>x.state)];
let overall="PASS";
if(states.includes("BLOCK"))overall="BLOCK";
else if(states.includes("HOLD"))overall="HOLD";
else if(states.includes("REVIEW"))overall="REVIEW";

const missingProjectInputs=[];
if(evidence.subject?.category_id==="ENERGY.SOLAR.INVERTER"){
  if(project.electrical?.phase==="unknown"||!project.electrical?.phase)missingProjectInputs.push("confirmed electrical phase");
  if(!Number.isFinite(solarRequirement?.project_targets?.calculated_target_kwp))missingProjectInputs.push("target PV system kWp from building load/generation objective");
  if(!solarRequirement?.project_targets?.usable_roof_area_m2)missingProjectInputs.push("usable roof area / roof-plane geometry");
}
if(evidence.subject?.category_id==="POOL.PUMPS"){
  const p=projectRaw.pool??{};
  if(!Number.isFinite(Number(p.required_flow_m3_h))&&!(Number.isFinite(Number(p.volume_m3))&&Number.isFinite(Number(p.target_turnover_hours)))) missingProjectInputs.push("pool volume + target turnover time, or explicit required filtration flow");
  if(!Number.isFinite(Number(p.total_dynamic_head_m))) missingProjectInputs.push("pool total dynamic head / hydraulic loss calculation");
  if(!p.plant?.phase) missingProjectInputs.push("pool plant electrical phase/circuit confirmation");
  if(!p.pipe_system?.pump_connection) missingProjectInputs.push("pool pump pipe/fitting connection specification");
}

const result={
  generated_at:new Date().toISOString(),
  project_id:project.project_id,
  evidence_id:evidence.evidence_id,
  subject:evidence.subject,
  evidence_authority:evidence.authority,
  overall_state:overall,
  checks,
  regulatory_screen:regulation.map(x=>({rule_id:x.rule_id,jurisdiction_id:x.jurisdiction_id,stage:x.stage,state:x.state,missing_evidence:x.missing_evidence??[],professional_signoff:x.professional_signoff??false})),
  missing_project_inputs:[...new Set(missingProjectInputs)],
  project_context:{
    cte_zone:project.climate?.cte_zone??null,
    solar_yield_kwh_per_kwp:project.solar?.annual_yield_kwh_per_kwp??null,
    electrical:project.electrical,
    pool:projectRaw.pool??null
  },
  principle:"Manufacturer-verified product facts and project suitability are independent gates. Performance equipment is selected against a project duty requirement, not marketing size labels."
};

await fs.mkdir(path.join(ROOT,"data/tests/results"),{recursive:true});
const evidenceSlug=evidence.evidence_id.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
await fs.writeFile(path.join(ROOT,`data/tests/results/${evidenceSlug}.fit.json`),JSON.stringify(result,null,2));
console.log(JSON.stringify({evidence_id:result.evidence_id,overall_state:result.overall_state,missing_project_inputs:result.missing_project_inputs,checks:result.checks.map(x=>({check:x.check,state:x.state}))},null,2));
