import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const projectPath=process.argv[2]||"data/projects/marbella-villa.example.json";
const project=JSON.parse(await fs.readFile(path.join(ROOT,projectPath),"utf8"));
const lat=project.location?.lat;
const lon=project.location?.lon;
if(!Number.isFinite(lat)||!Number.isFinite(lon)) throw new Error("Project requires numeric latitude/longitude for PVGIS.");

const params=new URLSearchParams({
  lat:String(lat),
  lon:String(lon),
  peakpower:"1",
  loss:"14",
  pvtechchoice:"crystSi2025",
  mountingplace:"free",
  optimalangles:"1",
  usehorizon:"1",
  raddatabase:"PVGIS-SARAH3",
  outputformat:"json"
});
const endpoint=`https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?${params}`;
const response=await fetch(endpoint,{headers:{"user-agent":"product-twin-pvgis-adapter/0.1"}});
if(!response.ok) throw new Error(`PVGIS ${response.status}: ${(await response.text()).slice(0,800)}`);
const json=await response.json();
const fixed=json.outputs?.totals?.fixed;
const monthly=json.outputs?.monthly?.fixed;
const mounting=json.inputs?.mounting_system?.fixed;
if(!fixed||!Array.isArray(monthly)||!mounting) throw new Error("Unexpected PVGIS PVcalc response shape.");

const summary={
  generated_at:new Date().toISOString(),
  project_id:project.project_id,
  source:{
    authority:"European Commission Joint Research Centre",
    service:"PVGIS",
    api_version:"5.3",
    tool:"PVcalc",
    radiation_database:json.inputs?.meteo_data?.radiation_db??"PVGIS-SARAH3",
    weather_year_min:json.inputs?.meteo_data?.year_min??null,
    weather_year_max:json.inputs?.meteo_data?.year_max??null,
    horizon_used:json.inputs?.meteo_data?.use_horizon??true
  },
  location:{
    lat:json.inputs?.location?.latitude??lat,
    lon:json.inputs?.location?.longitude??lon,
    elevation_m:json.inputs?.location?.elevation??null
  },
  baseline_system:{
    peak_power_kwp:1,
    technology:json.inputs?.pv_module?.technology??"crystSi2025",
    system_loss_percent:json.inputs?.pv_module?.system_loss??14,
    mounting:"ventilated/free-standing model used as rooftop screening baseline"
  },
  optimized_plane:{
    tilt_deg:mounting.slope?.value??null,
    tilt_optimized:mounting.slope?.optimal??true,
    pvgis_azimuth_deg:mounting.azimuth?.value??null,
    azimuth_optimized:mounting.azimuth?.optimal??true,
    convention:"PVGIS: 0°=south, +90°=west, -90°=east"
  },
  performance:{
    annual_energy_kwh_per_kwp:fixed.E_y??null,
    annual_plane_irradiation_kwh_m2:fixed["H(i)_y"]??null,
    average_daily_energy_kwh_per_kwp:fixed.E_d??null,
    total_loss_percent:fixed.l_total??null,
    annual_variability_sd_kwh:fixed.SD_y??null
  },
  monthly:monthly.map(m=>({
    month:m.month,
    energy_kwh_per_kwp:m.E_m??null,
    daily_energy_kwh_per_kwp:m.E_d??null,
    plane_irradiation_kwh_m2:m["H(i)_m"]??null,
    standard_deviation_kwh:m.SD_m??null
  })),
  readiness:{
    site_solar_resource:"VERIFIED_PVGIS",
    optimal_plane:"VERIFIED_PVGIS",
    roof_fit:"REQUIRES_ROOF_GEOMETRY",
    shading_from_local_obstructions:"REQUIRES_BUILDING_CONTEXT",
    actual_system_size:"REQUIRES_ROOF_AND_PRODUCT_TWINS",
    grid_and_regulatory:"REQUIRES_PROJECT_REGULATORY_GRAPH"
  },
  note:"This is a site-level 1 kWp screening baseline. Product Twin must later intersect roof geometry, local obstruction shading, electrical design, real panel dimensions/electrical specs, inverter sizing, regulation and commerce."
};

await fs.mkdir(path.join(ROOT,"data/energy"),{recursive:true});
const slug=(project.project_id||"project").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
await fs.writeFile(path.join(ROOT,`data/energy/${slug}.pvgis.json`),JSON.stringify(summary,null,2));
console.log(JSON.stringify({project_id:summary.project_id,annual_energy_kwh_per_kwp:summary.performance.annual_energy_kwh_per_kwp,optimal_tilt_deg:summary.optimized_plane.tilt_deg,optimal_pvgis_azimuth_deg:summary.optimized_plane.pvgis_azimuth_deg,radiation_database:summary.source.radiation_database},null,2));
