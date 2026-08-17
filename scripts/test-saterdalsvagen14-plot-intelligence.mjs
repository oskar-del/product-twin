import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSaterdalsvagen14 } from "./validate-saterdalsvagen14-plot-intelligence.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
const clone = (value) => structuredClone(value);
const fixture = {
  registry: read("data/sites/sweden/source-registry-v0.1.json"),
  intake: read("data/sites/sweden/saterdalsvagen-14/intake-v0.1.json"),
  site: read("data/sites/sweden/saterdalsvagen-14/plot-intelligence-v0.1.json"),
  project: read("data/sites/sweden/saterdalsvagen-14/project-v0.1.json"),
  scenario: read("data/sites/sweden/saterdalsvagen-14/design-scenario-v0.1.json"),
};

const baseline = validateSaterdalsvagen14();
assert.equal(baseline.ok, true, baseline.errors.join("\n"));

const attacks = [
  ["project Site Twin hash drift", ({ project }) => { project.site_twin_ref.content_sha256 = "a".repeat(64); }],
  ["scenario Site Twin hash drift", ({ scenario }) => { scenario.site_twin_ref.content_sha256 = "b".repeat(64); }],
  ["seller VA claim promoted", ({ project }) => { project.reported_facts.find((fact) => fact.fact_id === "MARKET_MUNICIPAL_VA_PAID").status = "VERIFIED"; }],
  ["seller parcel map treated as authority", ({ project }) => { project.market_source_receipts[1].source_role = "OFFICIAL_PROPERTY_RECORD"; }],
  ["area discrepancy erased", ({ project }) => { project.comparisons = []; }],
  ["scenario house selected", ({ scenario }) => { scenario.selected_house_profile = "HOUSEKIT_H50"; }],
  ["scenario boundary invented", ({ scenario }) => { scenario.site_boundary = { type: "Polygon", coordinates: [] }; }],
  ["scenario envelope invented", ({ scenario }) => { scenario.buildable_envelope = { type: "Polygon", coordinates: [] }; }],
  ["scenario access invented", ({ scenario }) => { scenario.access_point = [559900, 6501800]; }],
  ["scenario promoted", ({ scenario }) => { scenario.status = "DESIGN_BASIS"; }],
  ["identity gate closed from market locator", ({ site }) => { site.gates.find((gate) => gate.gate_id === "GATE_SE_PLOT_IDENTITY").status = "SATISFIED"; }],
  ["municipal jurisdiction evidence removed", ({ site }) => { site.gates.find((gate) => gate.gate_id === "GATE_SE_MUNICIPAL_JURISDICTION").status = "OPEN"; }],
  ["plan gate closed from non-governing plan", ({ site }) => { site.gates.find((gate) => gate.gate_id === "GATE_SE_DETAIL_PLAN_AND_STATUS").status = "SATISFIED"; }],
  ["terrain gate closed without raster", ({ site }) => { site.gates.find((gate) => gate.gate_id === "GATE_SE_TERRAIN").status = "SATISFIED"; }],
  ["ground gate closed from overview screen", ({ site }) => { site.gates.find((gate) => gate.gate_id === "GATE_SE_GROUND_CONDITIONS").status = "SATISFIED"; }],
  ["environment gate closed from empty service", ({ site }) => { site.gates.find((gate) => gate.gate_id === "GATE_SE_ENVIRONMENTAL_RESTRICTIONS").status = "SATISFIED"; }],
  ["utility gate closed from seller VA claim", ({ site }) => { site.gates.find((gate) => gate.gate_id === "GATE_SE_UTILITIES_AND_CAPACITY").status = "SATISFIED"; }],
  ["protected service zero treated as absence", ({ site }) => { site.findings.find((finding) => finding.finding_id === "FINDING_SE_PROTECTED_SERVICE_INCONCLUSIVE").value.conclusion = "NO_PROTECTED_AREAS"; }],
  ["water protection zone invented", ({ site }) => { site.findings.find((finding) => finding.finding_id === "FINDING_SE_GLAN_WATER_PROTECTION_UNRESOLVED").value.plot_zone = "tertiary"; }],
  ["soil depth normalized", ({ site }) => { site.findings.find((finding) => finding.finding_id === "FINDING_SE_MODELLED_SOIL_DEPTH_9M").value = 5; }],
  ["heritage record removed", ({ site }) => { site.findings.find((finding) => finding.finding_id === "FINDING_SE_HERITAGE_POINTS_500M").value.pop(); }],
  ["NOKA property designation altered", ({ site }) => { site.findings.find((finding) => finding.finding_id === "FINDING_SE_NOKA_PROPERTY_LOCATOR_CONFIRMED").value.property_designation = "SVÄRTINGE 54:29"; }],
  ["NOKA plan locator over-promoted", ({ site }) => { site.findings.find((finding) => finding.finding_id === "FINDING_SE_NOKA_EFFECTIVE_PLAN_LOCATOR").verification = "VERIFIED"; }],
  ["historic average lot size treated as current minimum", ({ site }) => { site.findings.find((finding) => finding.finding_id === "FINDING_SE_PLAN_22D1008_HISTORIC_PROVISIONS").limitations = []; }],
  ["current parcel invented on historic plan map", ({ site }) => { site.findings.find((finding) => finding.finding_id === "FINDING_SE_PLAN_22D1008_MAP_AVAILABLE").value.current_property_directly_identified = true; }],
  ["consultation proposal treated as adopted", ({ site }) => { site.findings.find((finding) => finding.finding_id === "FINDING_SE_CURRENT_STRATEGIC_PLAN_STATUS").value.svartinge_2026_proposal_adopted = true; }],
  ["point-only zero intersections treated as parcel absence", ({ site }) => { site.findings.find((finding) => finding.finding_id === "FINDING_SE_DRAFT_FOP_POINT_CONTEXT").value.absence_inference_permitted = true; }],
  ["EBH context treated as a clean plot certificate", ({ site }) => { site.findings.find((finding) => finding.finding_id === "FINDING_SE_EBH_CONTEXT_2KM").value.plot_contamination_conclusion = "NO_CONTAMINATION"; }],
];

for (const [name, mutate] of attacks) {
  const current = Object.fromEntries(Object.entries(fixture).map(([key, value]) => [key, clone(value)]));
  mutate(current);
  const result = validateSaterdalsvagen14({
    registryOverride: current.registry,
    intakeOverride: current.intake,
    siteOverride: current.site,
    projectOverride: current.project,
    scenarioOverride: current.scenario,
  });
  assert.equal(result.ok, false, `${name}: mutation unexpectedly passed`);
}

console.log(`Säterdalsvägen 14 mutation suite passed (${attacks.length} attacks; baseline ${baseline.assertions} assertions).`);
