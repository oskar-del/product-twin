import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileSwedenCellPlan, validateSvartingeCellAvailability, validateSwedenCellCheckpoint, validateSwedenCellContract } from "./validate-sweden-neighbourhood-cell-contract.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = JSON.parse(await fs.readFile(path.join(ROOT, "data/neighbourhood-cell/v1/sweden-contract-only-fixture-v1.json"), "utf8"));
const availability = JSON.parse(await fs.readFile(path.join(ROOT, "data/sites/sweden/saterdalsvagen-14/neighbourhood-cell-availability-v0.1.json"), "utf8"));
const clone = (value) => structuredClone(value);
const baseline = await validateSwedenCellCheckpoint();
if (!baseline.ok) throw new Error(`Valid Sweden cell checkpoint failed:\n${baseline.errors.join("\n")}`);

const attacks = [];
const attack = (name, mutate, expected) => attacks.push({ name, mutate, expected });
attack("schema version", (value) => { value.manifest_version = "sweden-neighbourhood-cell/v9"; }, /manifest_version/);
attack("postcode becomes geometry key", (value) => { value.cell_index.postcode_role = "PRIMARY_SPATIAL_KEY"; }, /postcode must not become/);
attack("web mercator persistence grid", (value) => { value.cell_index.native_crs = "EPSG:3857"; }, /native SWEREF/);
attack("cell size drift", (value) => { value.cell_index.cell_size_m = 5000; }, /cell size or stitching halo/);
attack("missing halo", (value) => { value.cell_index.halo_m = 0; }, /cell size or stitching halo/);
attack("insufficient street context", (value) => { value.context_policy.minimum_street_segments = 3; }, /at least ten street segments/);
attack("fixed radius only", (value) => { value.context_policy.selection_method = "FIXED_RADIUS"; }, /streets and view horizon/);
attack("camera continuity broken", (value) => { value.lod_policy.camera_continuity = "SEPARATE_SCENES"; }, /camera continuity/);
attack("layer removed", (value) => { value.layers.pop(); }, /exactly ten required layers/);
attack("duplicate layer ID", (value) => { value.layers[1].layer_id = value.layers[0].layer_id; }, /duplicate cell layer ID/);
attack("layer order drift", (value) => { [value.layers[0], value.layers[1]] = [value.layers[1], value.layers[0]]; }, /layer order or category/);
attack("Google tiles persisted", (value) => { value.layers.find((layer) => layer.category === "LIVE_PHOTOREALISTIC_REFERENCE").persistence = "PERSISTENT_SOURCE_BOUND_RASTER"; }, /live-only and non-derivative/);
attack("Google geometry extracted", (value) => { value.layers.find((layer) => layer.category === "LIVE_PHOTOREALISTIC_REFERENCE").geometry_derivation_allowed = true; }, /live-only and non-derivative/);
attack("current WMS becomes geometry source", (value) => { value.layers.find((layer) => layer.category === "ORTHOPHOTO").geometry_derivation_allowed = true; }, /orthophoto must remain live-only/);
attack("source artifact fabricated", (value) => { value.layers[0].source_artifact_ref = "invented://terrain"; }, /contract-only fixture must not bind/);
attack("local asking price", (value) => { value.asking_price = 1; }, /local market or personal fact payload/);
attack("local owner name", (value) => { value.owner_name = "Forbidden"; }, /local market or personal fact payload/);
attack("market provider drift", (value) => { value.market_interface.provider = "SPATIAL_STUDIO"; }, /market ownership or reference-only mode/);
attack("market payload mode", (value) => { value.market_interface.mode = "INLINE_PAYLOAD"; }, /market ownership or reference-only mode/);
attack("fifth evidence state", (value) => { value.market_interface.evidence_states.push("UNKNOWN"); }, /four evidence states/);
attack("historic references removed", (value) => { value.market_interface.supported_reference_types.splice(6, 1); }, /reference types changed/);
attack("listing history event removed", (value) => { value.market_interface.timeline_event_types.shift(); }, /timeline event vocabulary/);
attack("multi-property safeguard removed", (value) => { value.market_interface.transaction_allocation_states = ["EXACT_SINGLE_PROPERTY"]; }, /allocation safeguards/);
attack("property lineage skipped", (value) => { value.market_interface.identity_resolution_order.splice(3, 1); }, /identity and lineage resolution order/);
attack("market connector removed", (value) => { value.market_interface.connector_routes.pop(); }, /connector routes changed/);
attack("official deed source downgraded", (value) => { value.market_interface.connector_routes.find((route) => route.connector_id === "SE_MARKET_LANTMATERIET_FASTIGHETSPRIS").role = "LISTING_REFERENCE"; }, /official recorded-transaction source/);
attack("Booli treated as authorized API", (value) => { value.market_interface.connector_routes.find((route) => route.connector_id === "SE_MARKET_BOOLI").acquisition_mode = "API"; }, /listing references until partnership/);
attack("personal data policy weakened", (value) => { value.market_interface.connector_routes[0].personal_data_policy = "ALLOW"; }, /personal-data policy weakened/);
attack("price payload copied locally", (value) => { value.market_interface.privacy.price_payload_location = "SPATIAL_STUDIO"; }, /privacy or payload boundary/);
attack("market record ingested", (value) => { value.market_interface.references.push({ reference_id: "MREF_TEST", reference_type: "PROPERTY", external_id: "TEST", record_version: "1", canonical_uri: null, content_sha256: null, evidence_state: "RECORDED", observed_at: "2026-08-24T00:00:00Z", source_system: "MUNIN", payload_persisted: false, personal_data_persisted: false }); }, /must not ingest Swedish market records/);
attack("market facts owned by Spatial", (value) => { value.ownership.market_and_price_facts = "PLOT_TO_PROJECT_SPATIAL_STUDIO_3"; }, /ownership boundary changed/);
attack("proposed design promoted automatically", (value) => { value.ownership.promotion_to_current_world = "AUTOMATIC"; }, /bypasses Verification/);
attack("Google extraction safeguard removed", (value) => { value.forbidden_operations.splice(1, 1); }, /forbidden operation set changed/);
attack("dashboard expansion", (value) => { value.dashboard_expansion = true; }, /dashboard expansion/);
attack("deployment", (value) => { value.deployment_state = "DEPLOYED"; }, /deployment is out of scope/);

let passed = 0;
for (const { name, mutate, expected } of attacks) {
  const value = clone(fixture);
  mutate(value);
  const result = validateSwedenCellContract(value, { requireContractOnly: true });
  if (result.ok) throw new Error(`Mutation unexpectedly passed: ${name}`);
  const message = result.errors.join("\n");
  if (!expected.test(message)) throw new Error(`Mutation failed for the wrong reason: ${name}\n${message}`);
  passed += 1;
}

const availabilityAttacks = [];
const availabilityAttack = (name, mutate, expected) => availabilityAttacks.push({ name, mutate, expected });
availabilityAttack("projected locator drift", (value) => { value.subject.locator_epsg3006_easting_northing[0] += 1000; }, /projected locator drifted/);
availabilityAttack("suburban radius drift", (value) => { value.selection.context_radius_m = 200; }, /selection profile changed/);
availabilityAttack("selection bbox edited", (value) => { value.selection.selection_bbox_epsg3006[0] += 1; }, /selection bbox/);
availabilityAttack("coverage cell removed", (value) => { value.cells.pop(); }, /nine-cell coverage set/);
availabilityAttack("cell bbox edited", (value) => { value.cells[0].bbox_epsg3006[0] += 10; }, /native grid/);
availabilityAttack("cell promoted without artifacts", (value) => { value.cells[0].availability_state = "VERIFIED_REUSABLE"; }, /promoted without compiled/);
availabilityAttack("protected building gate closed", (value) => { value.source_coverage.find((item) => item.category === "BUILDINGS").state = "CONNECTED_LIVE_ONLY"; }, /official geometry gate/);
availabilityAttack("compiled artifact fabricated", (value) => { value.compiled_artifacts.push({ uri: "invented.glb" }); }, /must not fabricate compiled/);
availabilityAttack("market reference ingested", (value) => { value.market_reference_ids.push("MREF_INVENTED"); }, /must not ingest market references/);
availabilityAttack("availability deployed", (value) => { value.deployment_state = "DEPLOYED"; }, /must not be deployed/);
for (const { name, mutate, expected } of availabilityAttacks) {
  const value = clone(availability);
  mutate(value);
  const result = validateSvartingeCellAvailability(value);
  if (result.ok) throw new Error(`Availability mutation unexpectedly passed: ${name}`);
  const message = result.errors.join("\n");
  if (!expected.test(message)) throw new Error(`Availability mutation failed for the wrong reason: ${name}\n${message}`);
  passed += 1;
}

const planA = compileSwedenCellPlan(fixture);
const planB = compileSwedenCellPlan(clone(fixture));
if (JSON.stringify(planA) !== JSON.stringify(planB)) throw new Error("Sweden cell compilation plan is not deterministic");
console.log(`SWEDEN NEIGHBOURHOOD CELL MUTATIONS: PASS (${passed}/${attacks.length + availabilityAttacks.length} attacks rejected)`);
console.log("Deterministic cell plan: PASS · market payloads: 0 · personal records: 0");
