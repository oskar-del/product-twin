import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSwedenPlotIntelligence } from "./validate-sweden-plot-intelligence.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
const clone = (value) => structuredClone(value);

const validRegistry = read("data/sites/sweden/source-registry-v0.1.json");
const validIntake = read("data/sites/sweden/plot-intake-template-v0.1.json");
const validPlot = read("data/sites/sweden/plot-intelligence-template-v0.1.json");

const baseline = validateSwedenPlotIntelligence({ root: ROOT });
assert.equal(baseline.ok, true, baseline.errors.join("\n"));

const attacks = [
  ["missing national source", ({ registry }) => { registry.sources.pop(); }],
  ["non-official endpoint", ({ registry }) => { registry.sources[0].endpoint_url = "https://example.com/height"; }],
  ["height source identity drift", ({ registry }) => { registry.sources.find((source) => source.source_id === "SE_LM_HEIGHT_1M_STAC").endpoint_url = "https://api.lantmateriet.se/stac-hojd/v2"; }],
  ["height raster falsely credentialless", ({ registry }) => {
    const source = registry.sources.find((item) => item.source_id === "SE_LM_HEIGHT_1M_STAC");
    source.access_mode = "OPEN_API";
    source.automation_state = "DIRECT";
  }],
  ["property map promoted to legal boundary", ({ registry }) => {
    const source = registry.sources.find((item) => item.source_id === "SE_LM_PROPERTY_DIVISION_VECTOR");
    source.can_close_gates.push("GATE_SE_BOUNDARY_FOR_DESIGN");
    source.cannot_prove = source.cannot_prove.filter((value) => !value.includes("legally binding"));
  }],
  ["NGP promoted to complete plan proof", ({ registry }) => { registry.sources.find((source) => source.source_id === "SE_NGP_DETAIL_PLAN").can_close_gates = ["GATE_SE_DETAIL_PLAN_AND_STATUS"]; }],
  ["NGP historical gap erased", ({ registry }) => {
    const source = registry.sources.find((item) => item.source_id === "SE_NGP_DETAIL_PLAN");
    source.limitations = source.limitations.filter((value) => !value.includes("before 2022-01-01"));
  }],
  ["NGP falsely credentialless", ({ registry }) => {
    const source = registry.sources.find((item) => item.source_id === "SE_NGP_DETAIL_PLAN");
    source.access_mode = "OPEN_API";
    source.automation_state = "DIRECT";
  }],
  ["old PBL profile date", ({ registry }) => { registry.current_rule_profile.effective_from = "2014-07-02"; }],
  ["inside-plan H30 limit inflated", ({ registry }) => { registry.current_rule_profile.inside_detail_plan.max_individual_area_m2 = 31; }],
  ["outside-plan H50 limit inflated", ({ registry }) => { registry.current_rule_profile.outside_detail_plan.max_individual_area_m2 = 60; }],
  ["Boverket guidance promoted to plot eligibility", ({ registry }) => { registry.sources.find((source) => source.source_id === "SE_BOVERKET_CURRENT_PBL").can_close_gates.push("GATE_SE_H30_H50_ELIGIBILITY"); }],
  ["NVDB promoted to legal access", ({ registry }) => { registry.sources.find((source) => source.source_id === "SE_TRAFIKVERKET_NVDB").can_close_gates = ["GATE_SE_LEGAL_ACCESS"]; }],
  ["Ledningskollen promoted to capacity proof", ({ registry }) => { registry.sources.find((source) => source.source_id === "SE_LEDNINGSKOLLEN").can_close_gates.push("GATE_SE_UTILITIES_AND_CAPACITY"); }],
  ["overview soil promoted to geotechnical proof", ({ registry }) => { registry.sources.find((source) => source.source_id === "SE_SGU_SOIL_25_100K").can_close_gates = ["GATE_SE_GROUND_CONDITIONS"]; }],
  ["field survey falsely automated", ({ registry }) => { registry.sources.find((source) => source.source_id === "SE_FIELD_SURVEY").automation_state = "DIRECT"; }],
  ["default gate silently satisfied", ({ registry }) => { registry.gate_catalog[0].default_status = "SATISFIED"; }],
  ["required gate removed", ({ registry }) => { registry.gate_catalog.splice(5, 1); }],
  ["source refers to unknown gate", ({ registry }) => { registry.sources[0].can_close_gates.push("GATE_SE_MAGIC_PERMISSION"); }],
  ["version migration alert removed", ({ registry }) => { registry.version_alerts.shift(); }],
  ["property designation without municipality", ({ intake }) => { intake.locator.property_designation = "X 1:2"; }],
  ["Sweden coordinate axes swapped", ({ intake }) => { intake.locator.coordinate_wgs84 = [60, 18]; }],
  ["external property-record permission invented", ({ intake }) => { intake.permissions.may_request_property_register_extract = true; }],
  ["municipality-contact permission invented", ({ intake }) => { intake.permissions.may_contact_municipality = true; }],
  ["plot promoted without identity or evidence", ({ plot }) => { plot.status = "DISCOVERY"; }],
  ["satisfied plot gate without evidence", ({ plot }) => { plot.gates[0].status = "SATISFIED"; }],
  ["plot coordinate outside Sweden", ({ plot }) => { plot.identity.coordinate_wgs84 = [18, 95]; }],
  ["scenario allowed to redefine boundary", ({ plot }) => { plot.separation_rules.scenario_cannot_redefine_boundary = false; }],
  ["road geometry allowed to prove access", ({ plot }) => { plot.separation_rules.road_geometry_cannot_prove_legal_access = false; }],
  ["unknown receipt source", ({ plot }) => {
    plot.source_receipts.push({
      receipt_id: "RCPT_FAKE",
      source_id: "SE_FAKE_SOURCE",
      retrieved_at: "2026-08-17T12:00:00+02:00",
      request_or_record_ref: "fake",
      runtime_locator: ".runtime/sites/sweden/fake.json",
      sha256: "a".repeat(64),
      scope: "fake",
      evidence_class: "OFFICIAL_OPEN_SOURCE"
    });
  }],
];

for (const [name, mutate] of attacks) {
  const fixture = {
    registry: clone(validRegistry),
    intake: clone(validIntake),
    plot: clone(validPlot),
  };
  mutate(fixture);
  const result = validateSwedenPlotIntelligence({
    root: ROOT,
    registryOverride: fixture.registry,
    intakeOverride: fixture.intake,
    plotOverride: fixture.plot,
  });
  assert.equal(result.ok, false, `${name}: mutation unexpectedly passed`);
}

console.log(`Sweden plot-intelligence mutation suite passed (${attacks.length} attacks; baseline ${baseline.assertions} assertions).`);
