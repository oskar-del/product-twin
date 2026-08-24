import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EVIDENCE_STATES,
  EXISTING_PROPERTY_MODES,
  MUNIN_REFERENCE_TYPES,
  SPATIAL_BUNDLE_VERSION,
  canonicalJson,
  compileSpatialGraph,
  validateSpatialBundle,
} from "./plot-to-project-spatial-contract.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

const PATHS = {
  fixture: "data/spatial-contract/v1/contract-only-fixture-v1.json",
  compiledGraph: "data/spatial-contract/v1/contract-only-compiled-graph-v1.json",
  defsSchema: "config/spatial/plot-to-project-defs-v1.schema.json",
  muninSchema: "config/spatial/munin-external-reference-v1.schema.json",
  neighbourhoodSchema: "config/spatial/neighbourhood-twin-v1.schema.json",
  buildingSchema: "config/spatial/building-twin-v1.schema.json",
  unitSchema: "config/spatial/unit-twin-v1.schema.json",
  conditionSchema: "config/spatial/existing-condition-twin-v1.schema.json",
  spaceSchema: "config/spatial/space-twin-v1.schema.json",
  scenarioSchema: "config/spatial/existing-property-design-scenario-v1.schema.json",
  bundleSchema: "config/spatial/plot-to-project-spatial-bundle-v1.schema.json",
};

const readJson = async (root, relativePath) => JSON.parse(await fs.readFile(path.join(root, relativePath), "utf8"));

function makeAudit() {
  const errors = [];
  let assertions = 0;
  const check = (condition, message) => {
    assertions += 1;
    if (!condition) errors.push(message);
  };
  const addAssertions = (count) => { assertions += count; };
  return { errors, check, addAssertions, get assertions() { return assertions; } };
}

function checkSchema(schema, expectedIdSuffix, audit, { requireStrict = true } = {}) {
  audit.check(schema.$schema === "https://json-schema.org/draft/2020-12/schema", `${expectedIdSuffix}: expected JSON Schema 2020-12`);
  audit.check(schema.$id?.endsWith(expectedIdSuffix), `${expectedIdSuffix}: versioned schema ID mismatch`);
  if (requireStrict) audit.check(schema.additionalProperties === false, `${expectedIdSuffix}: top-level unknown fields must be rejected`);
}

function walkRefs(value, refs = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => walkRefs(item, refs));
    return refs;
  }
  if (!value || typeof value !== "object") return refs;
  for (const [key, child] of Object.entries(value)) {
    if (key === "$ref" && typeof child === "string") refs.push(child);
    else walkRefs(child, refs);
  }
  return refs;
}

function checkSchemaRefs(loaded, audit) {
  const schemas = Object.values(loaded).filter((value) => value && typeof value === "object" && typeof value.$id === "string");
  const byFileName = new Map(schemas.map((schema) => [schema.$id.split("/").at(-1), schema]));
  for (const schema of schemas) {
    for (const ref of walkRefs(schema)) {
      if (ref.startsWith("#/")) continue;
      const [relativeFile, fragment] = ref.split("#");
      const target = byFileName.get(relativeFile.replace(/^\.\//, ""));
      audit.check(Boolean(target), `${schema.$id}: unresolved schema reference ${ref}`);
      if (target && fragment?.startsWith("/$defs/")) audit.check(Object.hasOwn(target.$defs ?? {}, fragment.slice("/$defs/".length)), `${schema.$id}: unresolved schema definition ${ref}`);
    }
  }
}

function checkSchemas(loaded, audit) {
  checkSchema(loaded.defsSchema, "/plot-to-project-defs-v1.schema.json", audit, { requireStrict: false });
  checkSchema(loaded.muninSchema, "/munin-external-reference-v1.schema.json", audit);
  checkSchema(loaded.neighbourhoodSchema, "/neighbourhood-twin-v1.schema.json", audit);
  checkSchema(loaded.buildingSchema, "/building-twin-v1.schema.json", audit);
  checkSchema(loaded.unitSchema, "/unit-twin-v1.schema.json", audit);
  checkSchema(loaded.conditionSchema, "/existing-condition-twin-v1.schema.json", audit);
  checkSchema(loaded.spaceSchema, "/space-twin-v1.schema.json", audit);
  checkSchema(loaded.scenarioSchema, "/existing-property-design-scenario-v1.schema.json", audit);
  checkSchema(loaded.bundleSchema, "/plot-to-project-spatial-bundle-v1.schema.json", audit);
  audit.check(canonicalJson(loaded.defsSchema.$defs.evidenceState.enum) === canonicalJson(EVIDENCE_STATES), "Shared schema changed the four evidence states");
  audit.check(canonicalJson(loaded.muninSchema.properties.supported_reference_types.const) === canonicalJson(MUNIN_REFERENCE_TYPES), "Munin schema changed the seven external reference types");
  audit.check(canonicalJson(loaded.scenarioSchema.properties.mode.enum) === canonicalJson(EXISTING_PROPERTY_MODES), "Scenario schema changed the six existing-property modes");
  audit.check(loaded.bundleSchema.properties.manifest_version.const === SPATIAL_BUNDLE_VERSION, "Bundle schema version does not match the executable contract");
  audit.check(loaded.bundleSchema.properties.dashboard_expansion.const === false, "Bundle schema must prohibit dashboard expansion in this milestone");
  audit.check(loaded.bundleSchema.properties.deployment_state.const === "NOT_DEPLOYED", "Bundle schema must prohibit deployment in this milestone");
  const entityProfiles = [
    [loaded.neighbourhoodSchema, "neighbourhood-twin/v1", "NeighbourhoodTwin"],
    [loaded.buildingSchema, "building-twin/v1", "BuildingTwin"],
    [loaded.unitSchema, "unit-twin/v1", "UnitTwin"],
    [loaded.conditionSchema, "existing-condition-twin/v1", "ExistingConditionTwin"],
    [loaded.spaceSchema, "space-twin/v1", "SpaceTwin"],
    [loaded.scenarioSchema, "existing-property-design-scenario/v1", "ExistingPropertyDesignScenario"],
  ];
  for (const [schema, version, entityType] of entityProfiles) {
    audit.check(schema.properties.manifest_version.const === version, `${entityType}: schema version mismatch`);
    audit.check(schema.properties.entity_type.const === entityType, `${entityType}: schema entity type mismatch`);
  }
  checkSchemaRefs(loaded, audit);
}

export async function validateSpatialContractCheckpoint({ root = REPO_ROOT, overrides = {} } = {}) {
  const loaded = {};
  for (const [key, relativePath] of Object.entries(PATHS)) loaded[key] = overrides[key] ?? await readJson(root, relativePath);
  const audit = makeAudit();
  checkSchemas(loaded, audit);
  const validation = validateSpatialBundle(loaded.fixture);
  audit.addAssertions(validation.assertions);
  validation.errors.forEach((error) => audit.errors.push(error));

  const fixtureModes = loaded.fixture.design_scenarios.map((scenario) => scenario.mode).sort();
  audit.check(canonicalJson(fixtureModes) === canonicalJson([...EXISTING_PROPERTY_MODES].sort()), "Contract fixture must exercise all six existing-property scenario modes exactly once");
  audit.check(loaded.fixture.munin_interface.references.length === 0, "Contract fixture must not ingest or fabricate Munin references");
  audit.check([
    ...loaded.fixture.neighbourhood_twins,
    ...loaded.fixture.building_twins,
    ...loaded.fixture.unit_twins,
    ...loaded.fixture.existing_condition_twins,
    ...loaded.fixture.space_twins,
    ...loaded.fixture.design_scenarios,
  ].every((item) => (item.external_evidence_refs ?? []).length === 0 && (item.munin_reference_ids ?? []).length === 0), "Contract fixture must remain free of Swedish market, cost and ownership evidence");

  const firstGraph = compileSpatialGraph(loaded.fixture);
  const secondGraph = compileSpatialGraph(structuredClone(loaded.fixture));
  audit.check(canonicalJson(firstGraph) === canonicalJson(secondGraph), "Spatial graph compilation is not deterministic across clean objects");
  audit.check(canonicalJson(firstGraph) === canonicalJson(loaded.compiledGraph), "Compiled spatial graph differs from its committed deterministic export");
  audit.check(firstGraph.nodes.length === 12, "Contract graph must contain Site + five extension twins + six scenarios");
  audit.check(firstGraph.edges.length === 11, "Contract graph hierarchy or scenario edge count drifted");

  return {
    ok: audit.errors.length === 0,
    assertions: audit.assertions,
    errors: audit.errors,
    graph: { nodes: firstGraph.nodes.length, edges: firstGraph.edges.length },
    modes: fixtureModes,
    muninReferencesPersisted: loaded.fixture.munin_interface.references.length,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateSpatialContractCheckpoint();
  if (!result.ok) {
    console.error(`PLOT-TO-PROJECT SPATIAL CONTRACT: FAIL (${result.assertions} assertions)`);
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    console.log(`PLOT-TO-PROJECT SPATIAL CONTRACT: PASS (${result.assertions} assertions)`);
    console.log(`Deterministic graph: ${result.graph.nodes} nodes · ${result.graph.edges} edges`);
    console.log(`Munin records persisted: ${result.muninReferencesPersisted}`);
  }
}
