import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const projectPath=process.argv[2]||"data/projects/marbella-villa.example.json";
const project=JSON.parse(await fs.readFile(path.join(ROOT,projectPath),"utf8"));
const slug=(project.project_id||"project").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const solar=JSON.parse(await fs.readFile(path.join(ROOT,`data/energy/${slug}.pvgis.json`),"utf8"));

const yieldPerKwp=solar.performance?.annual_energy_kwh_per_kwp;
if(!Number.isFinite(yieldPerKwp)||yieldPerKwp<=0) throw new Error("Verified annual PV yield per kWp is required.");

const targetAnnualKwh=project.energy?.target_annual_pv_generation_kwh??null;
const annualElectricityDemandKwh=project.energy?.annual_electricity_demand_kwh??null;
const usableRoofArea=project.solar?.usable_roof_area_m2??null;
const targetKwp=Number.isFinite(targetAnnualKwh)?targetAnnualKwh/yieldPerKwp:null;

const missing=[];
if(!Number.isFinite(targetAnnualKwh)&&!Number.isFinite(annualElectricityDemandKwh)) missing.push("annual electricity demand or desired annual PV generation");
if(!Number.isFinite(usableRoofArea)) missing.push("usable roof-plane geometry/area after setbacks");
missing.push("local obstruction/shading model");
if(!project.electrical?.phase||project.electrical.phase==="unknown") missing.push("confirmed electrical phase");
missing.push("grid export/import constraints and contracted supply");
missing.push("battery/autonomy objective if storage is desired");

const requirement={
  requirement_id:`REQ_SOLAR_${project.project_id}`,
  project_id:project.project_id,
  system:"solar_pv",
  status:missing.length?"needs_inputs":"provisional",
  objective:"Size a technically compatible, regulation-aware PV system from site performance and building demand before selecting commercial products.",
  verified_site_resource:{
    annual_energy_kwh_per_kwp:yieldPerKwp,
    annual_plane_irradiation_kwh_m2:solar.performance?.annual_plane_irradiation_kwh_m2??null,
    optimal_tilt_deg:solar.optimized_plane?.tilt_deg??null,
    optimal_pvgis_azimuth_deg:solar.optimized_plane?.pvgis_azimuth_deg??null,
    source:"PVGIS 5.3 / PVGIS-SARAH3"
  },
  sizing_factors:{
    annual_generation_per_1_kwp_kwh:yieldPerKwp,
    kwp_required_per_10000_kwh_year:Number((10000/yieldPerKwp).toFixed(3)),
    example_10_kwp_annual_generation_kwh:Number((10*yieldPerKwp).toFixed(1))
  },
  project_targets:{
    annual_electricity_demand_kwh:annualElectricityDemandKwh,
    target_annual_pv_generation_kwh:targetAnnualKwh,
    calculated_target_kwp:targetKwp?Number(targetKwp.toFixed(3)):null,
    usable_roof_area_m2:usableRoofArea
  },
  physical_constraints:{
    target_roof_plane:{
      optimal_screening_tilt_deg:solar.optimized_plane?.tilt_deg??null,
      optimal_screening_azimuth_deg:solar.optimized_plane?.pvgis_azimuth_deg??null,
      actual_roof_plane_selection:"pending_geometry_intersection"
    },
    module_count:"pending_real_panel_dimensions_and_roof_geometry",
    access_and_fire_setbacks:"pending_local_design_and_regulatory_rules"
  },
  electrical_or_connection_constraints:{
    nominal_voltage_v:project.electrical?.nominal_voltage_v??null,
    frequency_hz:project.electrical?.frequency_hz??null,
    phase:project.electrical?.phase??"unknown",
    string_voltage_current_window:"derived_after_panel_and_inverter_candidate matching",
    grid_connection:"pending_project_grid_context"
  },
  product_twin_category_ids:[
    "ENERGY.SOLAR.PANEL",
    "ENERGY.SOLAR.INVERTER",
    "ENERGY.SOLAR.MOUNTING",
    "ENERGY.SOLAR.BOS",
    "ENERGY.BATTERY"
  ],
  selection_sequence:[
    "resolve building load / generation target",
    "intersect roof geometry with solar resource and shading",
    "derive target kWp and layout envelope",
    "find real PV module Twins fitting roof/efficiency constraints",
    "derive string architecture from selected modules",
    "find compatible inverter Twin",
    "evaluate battery objective and compatible battery Twin if needed",
    "run regulation/grid checks",
    "resolve local offers, installer route, logistics and landed/installed cost"
  ],
  missing_inputs:[...new Set(missing)],
  principle:"No commercial panel or inverter is selected before the project-level performance requirement is defined."
};

await fs.writeFile(path.join(ROOT,`data/energy/${slug}.solar-requirement.json`),JSON.stringify(requirement,null,2));
console.log(JSON.stringify({requirement_id:requirement.requirement_id,status:requirement.status,annual_energy_kwh_per_kwp:yieldPerKwp,kwp_required_per_10000_kwh_year:requirement.sizing_factors.kwp_required_per_10000_kwh_year,missing_inputs:requirement.missing_inputs},null,2));
