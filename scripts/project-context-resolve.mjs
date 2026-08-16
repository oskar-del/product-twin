import fs from "node:fs/promises";

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
    ready_for_solar_optimization: checks.coordinates && checks.climate && checks.solar,
    unresolved: Object.entries(checks).filter(([,v])=>!v).map(([k])=>k)
  };
}

export function resolveProjectContext(project) {
  assert(project?.project_id, "project_id is required");
  assert(project?.location, "location is required");

  const resolved = {
    ...project,
    context_version: "0.1",
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

if (process.argv[1]?.endsWith("project-context-resolve.mjs")) {
  const input = process.argv[2] || "data/projects/marbella-villa.example.json";
  const project = JSON.parse(await fs.readFile(input,"utf8"));
  const result = resolveProjectContext(project);
  console.log(JSON.stringify(result,null,2));
}
