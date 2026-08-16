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

function evaluatePowerElectronics(){
  const c=evidence.claims??{};
  const checks=[];
  checks.push({
    check:"manufacturer_technical_evidence",
    state:evidence.verification?.technical==="verified"?"PASS":"HOLD",
    detail:evidence.authority?.grade??null
  });

  const frequency=project.electrical?.frequency_hz;
  checks.push({
    check:"grid_frequency",
    state:frequency&&includesNumeric(c.frequency_hz,frequency)?"PASS":"HOLD",
    required:frequency??null,
    product:c.frequency_hz??null
  });

  const phase=project.electrical?.phase;
  const productThreePhase=String(c.grid_configuration??"").toLowerCase().includes("three-phase");
  checks.push({
    check:"phase",
    state:phase==="unknown"||!phase?"HOLD":((phase==="three"&&productThreePhase)||(phase==="single"&&!productThreePhase)?"PASS":"BLOCK"),
    required:phase??"unknown",
    product:productThreePhase?"three":"single_or_unknown"
  });

  const nominal=project.electrical?.nominal_voltage_v;
  const voltagePlausible=nominal&&(
    includesNumeric(c.phase_voltage_v,nominal,5)||
    includesNumeric(c.ac_nominal_voltage_v,nominal,10)
  );
  checks.push({
    check:"nominal_voltage",
    state:voltagePlausible?"PASS":"HOLD",
    required:nominal??null,
    product:{phase_voltage_v:c.phase_voltage_v??null,line_voltage_v:c.ac_nominal_voltage_v??null}
  });

  const targetKwp=solarRequirement?.project_targets?.calculated_target_kwp;
  checks.push({
    check:"pv_system_sizing",
    state:Number.isFinite(targetKwp)?(targetKwp<=Number(c.recommended_max_pv_power_wp??0)/1000?"PASS":"BLOCK"):"HOLD",
    required_target_kwp:targetKwp??null,
    product_recommended_max_pv_kwp:Number.isFinite(Number(c.recommended_max_pv_power_wp))?Number(c.recommended_max_pv_power_wp)/1000:null
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
else checks=[{check:"category_evaluator",state:"HOLD",detail:"No category-specific evaluator implemented yet."}];

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
if(project.electrical?.phase==="unknown"||!project.electrical?.phase)missingProjectInputs.push("confirmed electrical phase");
if(!Number.isFinite(solarRequirement?.project_targets?.calculated_target_kwp))missingProjectInputs.push("target PV system kWp from building load/generation objective");
if(!solarRequirement?.project_targets?.usable_roof_area_m2)missingProjectInputs.push("usable roof area / roof-plane geometry");

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
    electrical:project.electrical
  },
  principle:"Manufacturer-verified product facts and project suitability are independent gates."
};

await fs.mkdir(path.join(ROOT,"data/tests/results"),{recursive:true});
const evidenceSlug=evidence.evidence_id.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
await fs.writeFile(path.join(ROOT,`data/tests/results/${evidenceSlug}.fit.json`),JSON.stringify(result,null,2));
console.log(JSON.stringify({evidence_id:result.evidence_id,overall_state:result.overall_state,missing_project_inputs:result.missing_project_inputs,checks:result.checks.map(x=>({check:x.check,state:x.state}))},null,2));
