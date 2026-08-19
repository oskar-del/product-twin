import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EVIDENCE_STATES,
  MUNIN_REFERENCE_TYPES,
  canonicalJson,
  compileSpatialGraph,
  validateSpatialBundle,
} from "./plot-to-project-spatial-contract.mjs";
import { validateSpatialContractCheckpoint } from "./validate-plot-to-project-spatial-contract.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (relativePath) => JSON.parse(await fs.readFile(path.join(ROOT, relativePath), "utf8"));
const fixture = await readJson("data/spatial-contract/v1/contract-only-fixture-v1.json");
const committedGraph = await readJson("data/spatial-contract/v1/contract-only-compiled-graph-v1.json");
const clone = (value) => structuredClone(value);

const baseline = await validateSpatialContractCheckpoint();
if (!baseline.ok) throw new Error(`Valid spatial contract checkpoint failed:\n${baseline.errors.join("\n")}`);

const synthetic = clone(fixture);
synthetic.munin_interface.references = MUNIN_REFERENCE_TYPES.map((referenceType, index) => ({
  reference_id: `MREF_TEST_${referenceType}`,
  reference_type: referenceType,
  external_id: `TEST_ONLY_${referenceType}_ID`,
  record_version: "test-only/v1",
  canonical_uri: null,
  content_sha256: null,
  evidence_state: EVIDENCE_STATES[index % EVIDENCE_STATES.length],
  observed_at: "2026-08-17T00:00:00Z",
  source_system: "MUNIN",
  payload_persisted: false,
}));
synthetic.neighbourhood_twins[0].munin_reference_ids = ["MREF_TEST_PROPERTY"];
synthetic.building_twins[0].munin_reference_ids = ["MREF_TEST_BUILDING", "MREF_TEST_BRF"];
synthetic.unit_twins[0].munin_reference_ids = ["MREF_TEST_UNIT", "MREF_TEST_HISTORIC_SALES", "MREF_TEST_CURRENT_LISTING", "MREF_TEST_COMPARABLE_SET"];
const syntheticResult = validateSpatialBundle(synthetic);
if (!syntheticResult.ok) throw new Error(`Reference-only interface fixture failed:\n${syntheticResult.errors.join("\n")}`);
if (synthetic.munin_interface.references.some((ref) => ref.payload_persisted !== false)) throw new Error("Synthetic reference-only interface persisted a payload");

const attacks = [];
const attack = (name, mutate, expected) => attacks.push({ name, mutate, expected });

attack("bundle schema version", (value) => { value.manifest_version = "plot-to-project-spatial/v999"; }, /manifest_version: unsupported/);
attack("unknown top-level field", (value) => { value.dashboard = {}; }, /unknown field/);
attack("fifth evidence state", (value) => { value.munin_interface.evidence_states.push("UNKNOWN"); }, /exact four-state vocabulary/);
attack("missing Munin reference type", (value) => { value.munin_interface.supported_reference_types.pop(); }, /required reference interface changed/);
attack("Munin provider ownership drift", (value) => { value.munin_interface.provider = "SPATIAL_STUDIO"; }, /must remain MUNIN/);
attack("dashboard scope expansion", (value) => { value.dashboard_expansion = true; }, /dashboard work is out of scope/);
attack("deployment state mutation", (value) => { value.deployment_state = "DEPLOYED"; }, /deployment is out of scope/);
attack("unbound Site Twin with fabricated version", (value) => { value.site_twin_ref.version = "1.0"; }, /UNBOUND reference cannot contain/);
attack("Neighbourhood Site Twin drift", (value) => { value.neighbourhood_twins[0].site_twin_ref.id = "SITE_OTHER"; }, /hierarchy does not match root Site Twin/);
attack("Building parent ID unresolved", (value) => { value.building_twins[0].neighbourhood_twin_id = "NEIGH_MISSING"; }, /unresolved parent/);
attack("Building frame parent drift", (value) => { value.building_twins[0].frame.parent_frame_id = "WRONG_FRAME"; }, /parent_frame_id/);
attack("transform without evidence", (value) => { value.unit_twins[0].frame.transform_to_parent = { translation_m: [0, 0, 0], rotation_quaternion_xyzw: [0, 0, 0, 1], scale_xyz: [1, 1, 1] }; }, /requires one of the four evidence states/);
attack("non-unit transform scale", (value) => { const frame = value.unit_twins[0].frame; frame.transform_to_parent = { translation_m: [0, 0, 0], rotation_quaternion_xyzw: [0, 0, 0, 1], scale_xyz: [2, 1, 1] }; frame.evidence_state = "RECORDED"; frame.evidence_refs = ["E_TEST"]; }, /non-unit scaling/);
attack("non-normalized quaternion", (value) => { const frame = value.unit_twins[0].frame; frame.transform_to_parent = { translation_m: [0, 0, 0], rotation_quaternion_xyzw: [0, 0, 0, 2], scale_xyz: [1, 1, 1] }; frame.evidence_state = "RECORDED"; frame.evidence_refs = ["E_TEST"]; }, /quaternion must be normalized/);
attack("ABSENT geometry with URI", (value) => { value.building_twins[0].envelope_geometry.uri = "invented.glb"; }, /ABSENT geometry must keep/);
attack("AVAILABLE geometry without hash", (value) => { const geometry = value.space_twins[0].space_geometry; geometry.status = "AVAILABLE"; geometry.uri = "space.glb"; geometry.crs = "LOCAL"; geometry.bounds = { min: [0, 0, 0], max: [1, 1, 1] }; geometry.evidence_state = "INFERRED"; geometry.evidence_refs = ["E_TEST"]; }, /requires SHA-256/);
attack("Unit omits Existing Condition child", (value) => { value.unit_twins[0].existing_condition_twin_ids = []; }, /does not list this Existing Condition Twin/);
attack("Existing Condition omits Space child", (value) => { value.existing_condition_twins[0].space_twin_ids = []; }, /does not list this Space Twin/);
attack("duplicate hierarchy ID", (value) => { value.design_scenarios[0].scenario_id = value.space_twins[0].space_twin_id; }, /duplicate IDs across the spatial hierarchy/);
attack("invalid existing-property mode", (value) => { value.design_scenarios[0].mode = "FLIP_FOR_PROFIT"; }, /invalid existing-property mode/);
attack("scenario Project mismatch", (value) => { value.design_scenarios[0].project_id = "PRJ_OTHER"; }, /does not match bundle/);
attack("scenario Site mismatch", (value) => { value.design_scenarios[0].site_twin_id = "SITE_OTHER"; }, /does not match Site Twin/);
attack("scenario unresolved scope", (value) => { value.design_scenarios[0].scope_refs = ["SPACE_MISSING"]; }, /scope_refs: unresolved/);
attack("AS_IS transformation operation", (value) => { value.design_scenarios[0].transformation_operations = [{ operation_id: "OP_TEST", operation_type: "KEEP", target_twin_id: "SPACE_TEST_ONLY_UNBOUND", source_geometry_ref: null, result_geometry: { status: "AVAILABLE", geometry_kind: "TEST", uri: "test.glb", content_sha256: "a".repeat(64), crs: "LOCAL", linear_units: "m", bounds: { min: [0, 0, 0], max: [1, 1, 1] }, evidence_state: "FORECAST", evidence_refs: ["E_TEST"] }, evidence_state: "FORECAST", evidence_refs: ["E_TEST"] }]; }, /AS_IS cannot contain transformation operations/);
attack("local market value fact", (value) => { value.unit_twins[0].market_value = 1; }, /local market value, cost or ownership fact is forbidden/);
attack("local renovation cost fact", (value) => { value.design_scenarios[1].renovation_cost = 1; }, /local market value, cost or ownership fact is forbidden/);
attack("local owner identity fact", (value) => { value.site_twin_ref.owner_name = "Forbidden"; }, /local market value, cost or ownership fact is forbidden/);
attack("Munin payload persistence", (value) => { value.munin_interface.references = [{ ...synthetic.munin_interface.references[0], payload_persisted: true }]; value.neighbourhood_twins[0].munin_reference_ids = ["MREF_TEST_PROPERTY"]; }, /payload persistence is forbidden/);
attack("invalid external evidence state", (value) => { value.munin_interface.references = [{ ...synthetic.munin_interface.references[0], evidence_state: "UNKNOWN" }]; value.neighbourhood_twins[0].munin_reference_ids = ["MREF_TEST_PROPERTY"]; }, /evidence_state: invalid/);
attack("unconsumed external reference", (value) => { value.munin_interface.references = [synthetic.munin_interface.references[0]]; }, /unconsumed reference is forbidden/);
attack("unresolved entity Munin reference", (value) => { value.unit_twins[0].munin_reference_ids = ["MREF_MISSING"]; }, /unresolved MREF_MISSING/);
attack("external fact-domain type mismatch", (value) => { value.munin_interface.references = [synthetic.munin_interface.references[0]]; value.neighbourhood_twins[0].external_evidence_refs = [{ binding_id: "B_TEST", fact_domain: "BUILDING_IDENTITY", munin_reference_id: "MREF_TEST_PROPERTY", spatial_target_ref: "NEIGH_TEST_ONLY_UNBOUND", applicability: { status: "UNASSESSED", geometry_ref: null, evidence_state: null, evidence_refs: [], decided_at: null, rationale: "" }, method: "SPATIAL_APPLICABILITY_ONLY_NO_FACT_VALUE" }]; }, /fact domain does not match Munin reference type/);
attack("UNASSESSED applicability with evidence", (value) => { value.munin_interface.references = [synthetic.munin_interface.references[0]]; value.neighbourhood_twins[0].external_evidence_refs = [{ binding_id: "B_TEST", fact_domain: "PROPERTY_IDENTITY", munin_reference_id: "MREF_TEST_PROPERTY", spatial_target_ref: "NEIGH_TEST_ONLY_UNBOUND", applicability: { status: "UNASSESSED", geometry_ref: null, evidence_state: "RECORDED", evidence_refs: ["E_TEST"], decided_at: null, rationale: "" }, method: "SPATIAL_APPLICABILITY_ONLY_NO_FACT_VALUE" }]; }, /UNASSESSED applicability cannot claim/);
attack("scenario manifest version mutation", (value) => { value.design_scenarios[0].manifest_version = "existing-property-design-scenario/v2"; }, /manifest_version: unsupported/);

let passed = 0;
for (const { name, mutate, expected } of attacks) {
  const value = clone(fixture);
  mutate(value);
  const result = validateSpatialBundle(value);
  if (result.ok) throw new Error(`Mutation unexpectedly passed: ${name}`);
  const message = result.errors.join("\n");
  if (!expected.test(message)) throw new Error(`Mutation failed for the wrong reason: ${name}\n${message}`);
  passed += 1;
}

const graphA = compileSpatialGraph(fixture);
const graphB = compileSpatialGraph(clone(fixture));
if (canonicalJson(graphA) !== canonicalJson(graphB)) throw new Error("Spatial graph compilation is not deterministic");
if (canonicalJson(graphA) !== canonicalJson(committedGraph)) throw new Error("Spatial graph compilation differs from committed graph");

console.log(`PLOT-TO-PROJECT SPATIAL MUTATIONS: PASS (${passed}/${attacks.length} attacks rejected)`);
console.log(`Munin reference-only interface: PASS (${MUNIN_REFERENCE_TYPES.length} ID types · ${EVIDENCE_STATES.length} evidence states · 0 payloads)`);
console.log("Deterministic spatial graph: PASS (two clean runs and committed export)");
