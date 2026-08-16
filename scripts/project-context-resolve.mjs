import fs from "node:fs/promises";
import path from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function completeness(project) {
  const checks = {
    coordinates: Number.isFinite(project.location?.lat) && Number.isFinite(project.location?.lon),
    country: !!project.location?.country,
    postal_code: !!project.location?.postal_code,
    jurisdiction: project.jurisdiction?.status !== "unresolved" && !!project.jurisdiction?.resolved_id,
    climate: project.climate?.status === "verified",
    solar: project.solar?.analysis_status === "verified",
    electrical: !!project.electrical?.nominal_voltage_v && !!project.electrical?.frequency_hz,
    logistics: !!project.logistics?.regional_scope && !!project.logistics?.national_scope,
    procurement: !!project.procurement?.currency
  };
  return {
    checks,
    ready_for_product_search: checks.coordinates && checks.country && checks.procurement,
    ready_for_regulatory_screen: checks.jurisdiction,
    ready_for_logistics_screen: checks.coordinates && checks.country && checks.logistics,
    ready_for_solar_resource_screen: checks.coordinates && checks.solar,
    ready_for_solar_product_sizing: checks.coordinates && checks.solar && checks.electrical,
    ready_for_energy_code_screen: checks.jurisdiction && checks.climate,
    unresolved: Object.entries(checks).filter(([,v])=>!v).map(([k])=>k)
  };
}

function solarFromEvidence(base, evidence) {
  if (!evidence?.performance?.annual_energy_kwh_per_kwp) return base;
  return {
    ...(base ?? {}),
    analysis_status: "verified",
    resource_status: "VERIFIED_PVGIS",
    irradiance_source: `${evidence.source?.service ?? "PVGIS"} ${evidence.source?.api_version ?? ""}`.trim(),
    weather_dataset: evidence.source?.radiation_database ?? null,
    annual_yield_kwh_per_kwp: evidence.performance.annual_energy_kwh_per_kwp,
    annual_plane_irradiation_kwh_m2: evidence.performance.annual_plane_irradiation_kwh_m2 ?? null,
    optimal_tilt_deg: evidence.optimized_plane?.tilt_deg ?? null,
    optimal_pvgis_azimuth_deg: evidence.optimized_plane?.pvgis_azimuth_deg ?? null,
    elevation_m: evidence.location?.elevation_m ?? null,
    roof_geometry_source: base?.roof_geometry_source ?? null,
    usable_roof_area_m2: base?.usable_roof_area_m2 ?? null,
    actual_system_size_status: "requires_roof_geometry_and_real_product_twins",
    source_evidence: {
      authority: evidence.source?.authority ?? "European Commission Joint Research Centre",
      service: evidence.source?.service ?? "PVGIS",
      generated_at: evidence.generated_at ?? null
    }
  };
}

function climateFromEvidence(base, evidence) {
  if (evidence?.status !== "verified" || !evidence?.cte_zone) return base;
  return {
    ...(base ?? {}),
    status: "verified",
    cte_zone: evidence.cte_zone,
    cte_winter_zone: evidence.winter_zone ?? null,
    cte_summer_zone: evidence.summer_zone ?? null,
    elevation_m: evidence.elevation_m ?? null,
    source: {
      authority: evidence.source?.authority ?? null,
      document: evidence.source?.document ?? null,
      document_date: evidence.source?.document_date ?? null,
      verified_at: evidence.source?.verified_at ?? null
    }
  };
}

export function resolveProjectContext(project, evidence={}) {
  assert(project?.project_id, "project_id is required");
  assert(project?.location, "location is required");

  const resolved = {
    ...project,
    climate: climateFromEvidence(project.climate, evidence.climate),
    solar: solarFromEvidence(project.solar, evidence.solar),
    context_version: "0.3",
    resolved_at: new Date().toISOString(),
    procurement_context: {
      currency: project.procurement?.currency ?? "EUR",
      destination: {
        country: project.location?.country ?? null,
        region: project.location?.region ?? null,
        municipality: project.location?.municipality ?? null,
        postal_code: project.location?.postal_code ?? null,
        coordinates: {
          lat: project.location?.lat ?? null,
          lon: project.location?.lon ?? null
        }
      },
      sourcing_preference: {
        local_preference: project.procurement?.local_preference ?? "none",
        local_radius_km: project.logistics?.local_radius_km ?? null,
        target_local_spend_percent: project.procurement?.target_local_spend_percent ?? null,
        max_lead_time_days: project.procurement?.max_lead_time_days ?? null
      }
    }
  };

  resolved.completeness = completeness(resolved);
  return resolved;
}

function projectSlug(project) {
  return (project.project_id||"project").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

async function loadEvidence(project, suffix) {
  const file=path.join("data/energy",`${projectSlug(project)}.${suffix}.json`);
  try { return JSON.parse(await fs.readFile(file,"utf8")); } catch { return null; }
}

if (process.argv[1]?.endsWith("project-context-resolve.mjs")) {
  const input = process.argv[2] || "data/projects/marbella-villa.example.json";
  const project = JSON.parse(await fs.readFile(input,"utf8"));
  const solar=await loadEvidence(project,"pvgis");
  const climate=await loadEvidence(project,"cte-climate");
  const result = resolveProjectContext(project,{solar,climate});
  console.log(JSON.stringify(result,null,2));
}
