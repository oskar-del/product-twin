import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';

const DATA_PATHS = Object.freeze({
  sources: 'data/sites/canopus/evidence-sources-v0.1.json',
  project: 'data/sites/canopus/project-v0.1.json',
  site: 'data/sites/canopus/site-twin-v0.1.json',
  scenario: 'data/sites/canopus/design-scenarios/la-concha-gardens-v0.1.json',
});

const SCHEMA_PATHS = Object.freeze({
  assertion: 'config/site/evidence-assertion.schema.json',
  sources: 'config/site/evidence-source-manifest.schema.json',
  project: 'config/site/project.schema.json',
  site: 'config/site/site-twin.schema.json',
  scenario: 'config/site/design-scenario.schema.json',
});

const ASSERTION_KEYS = Object.freeze([
  'value',
  'unit',
  'evidence_class',
  'source',
  'method',
  'as_of',
  'verification',
  'confidence',
]);

const EVIDENCE_CLASSES = new Set([
  'official_source_reported',
  'calculated',
  'seller_stated',
  'concept',
  'underwriting_assumption',
  'external_market_reported',
]);

const VERIFICATION_BY_CLASS = Object.freeze({
  official_source_reported: new Set(['underlying_source_pending']),
  calculated: new Set(['underlying_source_pending', 'reproducible_from_reported_values']),
  seller_stated: new Set(['seller_document_pending']),
  concept: new Set(['design_intent_only']),
  underwriting_assumption: new Set(['underwriting_model_pending']),
  external_market_reported: new Set(['primary_source_refresh_required']),
});

const REQUIRED_HARD_GATES = new Set([
  'GATE_CATASTRO_BOUNDARY',
  'GATE_IGN_TERRAIN',
  'GATE_CONTEXT_OBSTRUCTIONS',
  'GATE_CERTIFICADO_URBANISTICO',
  'GATE_GOVERNING_PLAN',
  'GATE_A7_BUILDING_LINE_AND_ACCESS',
  'GATE_PERMITTED_ACCESS',
  'GATE_ROOFTOP_RULES',
  'GATE_TITLE_AND_CHARGES',
  'GATE_FLOOD_AND_OVERLAYS',
  'GATE_UTILITY_CAPACITY',
]);

async function readJson(root, relativePath) {
  return JSON.parse(await fs.readFile(path.join(root, relativePath), 'utf8'));
}

export async function loadCanopusBundle(root = process.cwd()) {
  const [dataEntries, schemaEntries] = await Promise.all([
    Promise.all(Object.entries(DATA_PATHS).map(async ([key, relativePath]) => [key, await readJson(root, relativePath)])),
    Promise.all(Object.entries(SCHEMA_PATHS).map(async ([key, relativePath]) => [key, await readJson(root, relativePath)])),
  ]);
  return { ...Object.fromEntries(dataEntries), schemas: Object.fromEntries(schemaEntries) };
}

function schemaTypeMatches(value, expectedType) {
  if (expectedType === 'null') return value === null;
  if (expectedType === 'array') return Array.isArray(value);
  if (expectedType === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (expectedType === 'integer') return Number.isInteger(value);
  if (expectedType === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === expectedType;
}

function jsonPointerGet(document, fragment) {
  if (!fragment || fragment === '#') return document;
  if (!fragment.startsWith('#/')) return undefined;
  return fragment.slice(2).split('/').reduce((current, token) => current?.[token.replaceAll('~1', '/').replaceAll('~0', '~')], document);
}

function schemaRegistry(schemas) {
  const registry = new Map();
  for (const [key, schema] of Object.entries(schemas ?? {})) {
    registry.set(key, schema);
    if (schema?.$id) registry.set(schema.$id, schema);
    const idName = schema?.$id?.split('/').pop();
    if (idName) registry.set(idName, schema);
  }
  return registry;
}

function validateSchemaInstance({ instance, schema, rootSchema = schema, registry, entityName, pointer = '$', issues = [], counter = { total: 0 } }) {
  const record = (rule, pass, message) => {
    counter.total += 1;
    if (!pass) issues.push({ id: `schema:${entityName}:${pointer}:${rule}`, message });
  };

  if (!schema || typeof schema !== 'object') {
    record('schema_object', false, `${pointer} resolved to an invalid schema.`);
    return { issues, checksTotal: counter.total };
  }

  if (schema.$ref) {
    const [externalRef, fragmentPart] = schema.$ref.split('#');
    let referencedRoot = rootSchema;
    if (externalRef) {
      referencedRoot = registry.get(externalRef) ?? registry.get(externalRef.split('/').pop());
      record(`ref:${schema.$ref}`, Boolean(referencedRoot), `${pointer} cannot resolve schema reference ${schema.$ref}.`);
      if (!referencedRoot) return { issues, checksTotal: counter.total };
    }
    const referencedSchema = jsonPointerGet(referencedRoot, fragmentPart === undefined ? '#' : `#${fragmentPart}`);
    record(`ref_target:${schema.$ref}`, Boolean(referencedSchema), `${pointer} cannot resolve schema target ${schema.$ref}.`);
    if (referencedSchema) validateSchemaInstance({ instance, schema: referencedSchema, rootSchema: referencedRoot, registry, entityName, pointer, issues, counter });
    return { issues, checksTotal: counter.total };
  }

  if (schema.const !== undefined) record('const', isDeepStrictEqual(instance, schema.const), `${pointer} must equal ${JSON.stringify(schema.const)}.`);
  if (Array.isArray(schema.enum)) record('enum', schema.enum.some((candidate) => isDeepStrictEqual(instance, candidate)), `${pointer} must match an allowed enum value.`);

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const typePass = types.some((type) => schemaTypeMatches(instance, type));
    record('type', typePass, `${pointer} must have type ${types.join(' or ')}.`);
    if (!typePass) return { issues, checksTotal: counter.total };
  }

  if (typeof instance === 'string') {
    if (schema.minLength !== undefined) record('minLength', instance.length >= schema.minLength, `${pointer} is shorter than ${schema.minLength} characters.`);
    if (schema.pattern !== undefined) record('pattern', new RegExp(schema.pattern).test(instance), `${pointer} does not match ${schema.pattern}.`);
  }

  if (typeof instance === 'number' && schema.minimum !== undefined) record('minimum', instance >= schema.minimum, `${pointer} must be at least ${schema.minimum}.`);

  if (Array.isArray(instance)) {
    if (schema.minItems !== undefined) record('minItems', instance.length >= schema.minItems, `${pointer} must contain at least ${schema.minItems} items.`);
    if (schema.uniqueItems === true) {
      const unique = [];
      for (const item of instance) if (!unique.some((candidate) => isDeepStrictEqual(candidate, item))) unique.push(item);
      record('uniqueItems', unique.length === instance.length, `${pointer} must contain unique items.`);
    }
    if (schema.items) instance.forEach((item, index) => validateSchemaInstance({ instance: item, schema: schema.items, rootSchema, registry, entityName, pointer: `${pointer}[${index}]`, issues, counter }));
  }

  if (instance !== null && typeof instance === 'object' && !Array.isArray(instance)) {
    if (schema.minProperties !== undefined) record('minProperties', Object.keys(instance).length >= schema.minProperties, `${pointer} must contain at least ${schema.minProperties} properties.`);
    for (const requiredKey of schema.required ?? []) record(`required:${requiredKey}`, Object.hasOwn(instance, requiredKey), `${pointer} is missing required property ${requiredKey}.`);
    for (const [key, value] of Object.entries(instance)) {
      const propertySchema = schema.properties?.[key];
      if (propertySchema) {
        validateSchemaInstance({ instance: value, schema: propertySchema, rootSchema, registry, entityName, pointer: `${pointer}.${key}`, issues, counter });
      } else if (schema.additionalProperties === false) {
        record(`additionalProperties:${key}`, false, `${pointer} contains forbidden property ${key}.`);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        validateSchemaInstance({ instance: value, schema: schema.additionalProperties, rootSchema, registry, entityName, pointer: `${pointer}.${key}`, issues, counter });
      }
    }
  }

  return { issues, checksTotal: counter.total };
}

function validateAuthoredSchemas(bundle) {
  const schemas = bundle.schemas ?? {};
  const registry = schemaRegistry(schemas);
  const result = { issues: [], checksTotal: 0 };
  for (const [entityName, instance, schema] of [
    ['sources', bundle.sources, schemas.sources],
    ['project', bundle.project, schemas.project],
    ['site', bundle.site, schemas.site],
    ['scenario', bundle.scenario, schemas.scenario],
  ]) {
    const validation = validateSchemaInstance({ instance, schema, registry, entityName });
    result.checksTotal += validation.checksTotal;
    result.issues.push(...validation.issues);
  }
  return result;
}

function walkAssertionMaps(value, visitor, pointer = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkAssertionMaps(item, visitor, `${pointer}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const childPointer = `${pointer}.${key}`;
    if (key === 'assertions' && child && typeof child === 'object' && !Array.isArray(child)) {
      for (const [assertionId, assertion] of Object.entries(child)) visitor(assertion, `${childPointer}.${assertionId}`);
    } else {
      walkAssertionMaps(child, visitor, childPointer);
    }
  }
}

function nonNullForbiddenSpatialPayloads(value, pointer = '$', found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => nonNullForbiddenSpatialPayloads(item, `${pointer}[${index}]`, found));
    return found;
  }
  if (!value || typeof value !== 'object') return found;
  for (const [key, child] of Object.entries(value)) {
    const childPointer = `${pointer}.${key}`;
    if (['coordinates', 'vertices', 'polygon', 'geojson'].includes(key.toLowerCase()) && child !== null) found.push(childPointer);
    nonNullForbiddenSpatialPayloads(child, childPointer, found);
  }
  return found;
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function approximately(actual, expected, tolerance) {
  return finiteNumber(actual) && Math.abs(actual - expected) <= tolerance;
}

export function validateCanopusBundle(bundle) {
  const issues = [];
  let checksTotal = 0;
  const check = (id, pass, message) => {
    checksTotal += 1;
    if (!pass) issues.push({ id, message });
  };

  const { sources, project, site, scenario } = bundle ?? {};
  check('bundle:sources_present', Boolean(sources), 'Evidence source manifest is missing.');
  check('bundle:project_present', Boolean(project), 'Project dataset is missing.');
  check('bundle:site_present', Boolean(site), 'Site Twin dataset is missing.');
  check('bundle:scenario_present', Boolean(scenario), 'Design Scenario dataset is missing.');
  if (!sources || !project || !site || !scenario) {
    return {
      status: 'BLOCKED', checks_total: checksTotal, checks_passed: checksTotal - issues.length,
      issue_ids: issues.map((issue) => issue.id).sort(), issues: issues.sort((a, b) => a.id.localeCompare(b.id)),
      summary: { sources: 0, assertions: 0, hard_gates: 0 },
    };
  }

  const authoredSchemaValidation = validateAuthoredSchemas(bundle);
  checksTotal += authoredSchemaValidation.checksTotal;
  issues.push(...authoredSchemaValidation.issues);

  check('entity:project_type', project.entity_type === 'Project', 'Project entity_type must be Project.');
  check('entity:site_type', site.entity_type === 'SiteTwin', 'Site entity_type must be SiteTwin.');
  check('entity:scenario_type', scenario.entity_type === 'DesignScenario', 'Scenario entity_type must be DesignScenario.');
  check('entity:project_site_ref', project.site_twin_ref === site.site_twin_id, 'Project must reference the loaded Site Twin.');
  check('entity:site_project_ref', site.project_id === project.project_id, 'Site Twin must reference the loaded Project.');
  check('entity:scenario_project_ref', scenario.project_id === project.project_id, 'Scenario must reference the loaded Project.');
  check('entity:scenario_site_ref', scenario.site_twin_id === site.site_twin_id, 'Scenario must reference the loaded Site Twin.');
  check('entity:project_scenario_ref', project.design_scenario_refs?.includes(scenario.scenario_id), 'Project must reference the loaded Design Scenario.');
  check('entity:site_status', site.status === 'EVIDENCE_ONLY_RAW_GEOMETRY_GATED', 'Site Twin must remain evidence-only until raw geometry is imported.');
  check('entity:scenario_status', scenario.status === 'CONCEPT_ONLY', 'Design Scenario must remain concept-only.');
  check('entity:scenario_compliance_status', scenario.planning_compliance_status === 'NOT_ASSESSED_ENTITLEMENT_GATED', 'Scenario cannot claim planning compliance.');

  const sourceDocuments = Array.isArray(sources.documents) ? sources.documents : [];
  const sourceById = new Map(sourceDocuments.map((document) => [document.document_id, document]));
  check('sources:count', sourceDocuments.length === 4, 'Exactly four reviewed PDF sources are expected.');
  check('sources:unique_ids', sourceById.size === sourceDocuments.length, 'Evidence source document IDs must be unique.');
  sourceDocuments.forEach((document) => {
    check(`source:${document.document_id}:pages`, Number.isInteger(document.pdf_pages) && document.pdf_pages > 0, `${document.document_id} must declare a positive PDF page count.`);
    check(`source:${document.document_id}:sha256`, /^[a-f0-9]{64}$/.test(document.sha256 ?? ''), `${document.document_id} must declare a SHA-256 digest.`);
    check(`source:${document.document_id}:raw_pending`, document.underlying_official_artifacts_attached === false, `${document.document_id} must not imply that underlying official artefacts are attached.`);
  });
  const expectedManifestPath = DATA_PATHS.sources;
  check('sources:project_manifest_binding', project.evidence_source_manifest === expectedManifestPath, 'Project source-manifest path is incorrect.');
  check('sources:site_manifest_binding', site.evidence_source_manifest === expectedManifestPath, 'Site source-manifest path is incorrect.');
  check('sources:scenario_manifest_binding', scenario.evidence_source_manifest === expectedManifestPath, 'Scenario source-manifest path is incorrect.');

  let assertionCount = 0;
  const assertionIds = new Set();
  for (const [entityName, entity] of [['project', project], ['site', site], ['scenario', scenario]]) {
    walkAssertionMaps(entity, (assertion, pointer) => {
      assertionCount += 1;
      assertionIds.add(pointer);
      const object = assertion && typeof assertion === 'object' && !Array.isArray(assertion);
      check(`assertion:${pointer}:object`, object, `${pointer} must be an assertion object.`);
      if (!object) return;
      for (const key of ASSERTION_KEYS) check(`assertion:${pointer}:required:${key}`, Object.hasOwn(assertion, key), `${pointer} is missing ${key}.`);
      check(`assertion:${pointer}:evidence_class`, EVIDENCE_CLASSES.has(assertion.evidence_class), `${pointer} has an unsupported evidence_class.`);
      check(`assertion:${pointer}:method`, typeof assertion.method === 'string' && assertion.method.length >= 3, `${pointer} must describe its method.`);
      check(`assertion:${pointer}:as_of`, /^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$/.test(assertion.as_of ?? ''), `${pointer} has an invalid as_of value.`);
      check(`assertion:${pointer}:confidence`, ['high', 'medium', 'low'].includes(assertion.confidence), `${pointer} has an invalid confidence.`);
      const source = assertion.source ?? {};
      const document = sourceById.get(source.document_id);
      check(`assertion:${pointer}:source_document`, Boolean(document), `${pointer} references an unknown source document.`);
      check(`assertion:${pointer}:source_authority`, typeof source.authority === 'string' && source.authority.length > 0, `${pointer} must name a source authority.`);
      check(`assertion:${pointer}:source_section`, typeof source.section === 'string' && source.section.length > 0, `${pointer} must name a source section.`);
      check(`assertion:${pointer}:source_page`, Number.isInteger(source.pdf_page) && source.pdf_page >= 1 && (!document || source.pdf_page <= document.pdf_pages), `${pointer} has an out-of-range PDF page.`);
      const verificationStatus = assertion.verification?.status;
      check(`assertion:${pointer}:verification_status`, VERIFICATION_BY_CLASS[assertion.evidence_class]?.has(verificationStatus) === true, `${pointer} verification status conflicts with evidence_class.`);
      check(`assertion:${pointer}:verification_note`, typeof assertion.verification?.note === 'string' && assertion.verification.note.length >= 3, `${pointer} must explain verification state.`);
    }, `$.${entityName}`);
  }
  check('assertions:count', assertionCount >= 40, 'The evidence dataset is unexpectedly sparse.');
  check('assertions:unique_pointers', assertionIds.size === assertionCount, 'Assertion pointers must be unique.');

  const boundary = site.spatial?.boundary ?? {};
  check('raw:boundary_status', boundary.status === 'MISSING_RAW_ARTIFACT', 'Boundary status must remain MISSING_RAW_ARTIFACT.');
  check('raw:boundary_artifact_absent', boundary.raw_artifact === null, 'No raw boundary artefact may be claimed before import.');
  check('raw:boundary_geometry_absent', boundary.geometry === null, 'Boundary geometry must remain null before official import.');
  check('raw:boundary_crs_absent', boundary.crs === null, 'Boundary CRS must remain null before official import.');
  const terrain = site.spatial?.terrain ?? {};
  check('raw:terrain_status', terrain.status === 'REPORTED_SUMMARY_ONLY', 'Terrain status must remain REPORTED_SUMMARY_ONLY.');
  check('raw:terrain_dem_absent', terrain.raw_dem === null, 'Raw DEM must remain null before official import.');
  check('raw:terrain_mesh_absent', terrain.terrain_mesh === null, 'Terrain mesh must remain null before reproducible generation.');
  check('raw:terrain_vertical_datum_absent', terrain.vertical_datum === null, 'Vertical datum must remain null until source metadata is imported.');
  check('raw:access_permission_absent', site.access?.permitted_access_point === null, 'Permitted access point must remain null until authority evidence arrives.');
  check('raw:planning_entitlement_absent', site.planning?.entitlement === null, 'Planning entitlement must remain null until certified.');
  check('raw:planning_envelope_absent', site.planning?.buildable_envelope === null, 'Buildable envelope must remain null until planning evidence arrives.');
  check('raw:scenario_model_absent', scenario.geometry?.model_asset === null, 'No machine-readable concept model may be claimed in this slice.');
  check('raw:scenario_alignment_absent', scenario.geometry?.survey_alignment === null, 'No survey alignment may be claimed in this slice.');
  const forbiddenSpatialPayloads = nonNullForbiddenSpatialPayloads({ site, scenario });
  check('raw:no_fabricated_spatial_payloads', forbiddenSpatialPayloads.length === 0, `Forbidden spatial payloads found: ${forbiddenSpatialPayloads.join(', ')}`);

  const gates = Array.isArray(site.hard_gates) ? site.hard_gates : [];
  const gateIds = gates.map((gate) => gate.gate_id);
  const gateIdSet = new Set(gateIds);
  check('gates:unique', gateIdSet.size === gateIds.length, 'Hard gate IDs must be unique.');
  check('gates:required_set', [...REQUIRED_HARD_GATES].every((gateId) => gateIdSet.has(gateId)), 'One or more required hard gates are missing.');
  gates.forEach((gate) => {
    check(`gate:${gate.gate_id}:open`, gate.status === 'OPEN', `${gate.gate_id} must remain open in this evidence-only slice.`);
    check(`gate:${gate.gate_id}:hard`, gate.severity === 'HARD', `${gate.gate_id} must remain a hard gate.`);
    check(`gate:${gate.gate_id}:blocks`, Array.isArray(gate.blocks) && gate.blocks.length > 0, `${gate.gate_id} must list blocked claims or operations.`);
    const document = sourceById.get(gate.source?.document_id);
    check(`gate:${gate.gate_id}:source_document`, Boolean(document), `${gate.gate_id} references an unknown source document.`);
    check(`gate:${gate.gate_id}:source_page`, Number.isInteger(gate.source?.pdf_page) && gate.source.pdf_page >= 1 && (!document || gate.source.pdf_page <= document.pdf_pages), `${gate.gate_id} has an out-of-range source page.`);
  });
  check('gates:boundary_binding', gateIdSet.has(boundary.gate_id), 'Boundary must reference an existing hard gate.');
  check('gates:terrain_binding', gateIdSet.has(terrain.gate_id), 'Terrain must reference an existing hard gate.');
  check('gates:access_binding', gateIdSet.has(site.access?.gate_id), 'Access must reference an existing hard gate.');
  check('gates:planning_bindings', site.planning?.gate_ids?.every((gateId) => gateIdSet.has(gateId)) === true, 'Planning gate references must resolve.');

  const siteIdentity = site.identity.assertions;
  const sellerBrief = project.seller_brief.assertions;
  const economics = project.economics.assertions;
  const scenarioProgramme = scenario.programme.assertions;
  const siteArea = siteIdentity.registered_area_m2?.value;
  const askingPrice = project.assertions.asking_price_eur?.value;
  const buildableArea = sellerBrief.buildable_area_m2?.value;
  const hotelKeys = sellerBrief.hotel_keys?.value;
  check('facts:cadastral_reference', siteIdentity.cadastral_reference?.value === '5410501UF2451S', 'Unexpected cadastral reference.');
  check('facts:registered_area', siteArea === 52733, 'Registered area must remain the reported 52,733 m2.');
  check('facts:seller_buildable_class', sellerBrief.buildable_area_m2?.evidence_class === 'seller_stated', '32,000 m2 buildability must remain seller-stated.');
  check('facts:seller_keys_class', sellerBrief.hotel_keys?.evidence_class === 'seller_stated', '250 keys must remain seller-stated.');
  check('facts:seller_storeys_class', sellerBrief.maximum_storeys?.evidence_class === 'seller_stated', 'Four storeys must remain seller-stated.');
  check('facts:seller_commercial_class', sellerBrief.commercial_area_m2?.evidence_class === 'seller_stated', '9,000 m2 commercial must remain seller-stated.');
  check('facts:public_realm_separate_class', scenarioProgramme.public_realm_area_m2?.evidence_class === 'concept', '9,000 m2 public realm must remain a separate concept assertion.');
  check('facts:commercial_public_values', sellerBrief.commercial_area_m2?.value === 9000 && scenarioProgramme.public_realm_area_m2?.value === 9000, 'The two separate 9,000 m2 assertions must retain their reported values.');
  check('math:land_per_plot_m2', approximately(askingPrice / siteArea, economics.land_cost_per_plot_m2_eur?.value, 1), 'Land cost per plot m2 is inconsistent.');
  check('math:land_per_buildable_m2', approximately(askingPrice / buildableArea, economics.land_cost_per_buildable_m2_eur?.value, 1), 'Land cost per buildable m2 is inconsistent.');
  check('math:land_per_key', askingPrice / hotelKeys === economics.land_cost_per_key_eur?.value, 'Land cost per key is inconsistent.');
  const terrainAssertions = terrain.assertions;
  check('math:terrain_fall', terrainAssertions.reported_maximum_elevation_m?.value - terrainAssertions.reported_minimum_elevation_m?.value === terrainAssertions.reported_total_fall_m?.value, 'Reported terrain fall is inconsistent with min/max elevation.');
  const mountain = site.views?.mountain?.assertions;
  check('math:mountain_ratio', approximately(Math.tan((mountain.elevation_angle_deg?.value * Math.PI) / 180), mountain.obstruction_height_ratio?.value, 0.001), 'Mountain obstruction ratio is inconsistent with elevation angle.');
  const tdc = economics.total_development_cost_eur?.value;
  const gdv = economics.gross_development_value_eur?.value;
  const profit = economics.developer_profit_eur?.value;
  check('math:developer_profit', gdv - tdc === profit, 'Developer profit is inconsistent with GDV and total development cost.');
  check('math:margin_on_cost', approximately((profit / tdc) * 100, economics.margin_on_cost_percent?.value, 0.1), 'Margin on cost is inconsistent with profit and total development cost.');

  issues.sort((a, b) => a.id.localeCompare(b.id));
  return {
    status: issues.length ? 'BLOCKED' : 'PASS',
    checks_total: checksTotal,
    checks_passed: checksTotal - issues.length,
    issue_ids: issues.map((issue) => issue.id),
    issues,
    summary: {
      sources: sourceDocuments.length,
      assertions: assertionCount,
      hard_gates: gates.length,
      raw_boundary_geometry: boundary.geometry === null ? 'ABSENT_AS_REQUIRED' : 'PRESENT',
      raw_terrain: terrain.raw_dem === null ? 'ABSENT_AS_REQUIRED' : 'PRESENT',
      planning_entitlement: site.planning?.entitlement === null ? 'UNRESOLVED_AS_REQUIRED' : 'PRESENT',
      design_scenario: scenario.status,
    },
  };
}

export async function validateCanopusSiteTwin({ root = process.cwd() } = {}) {
  return validateCanopusBundle(await loadCanopusBundle(root));
}

async function main() {
  const result = await validateCanopusSiteTwin();
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
