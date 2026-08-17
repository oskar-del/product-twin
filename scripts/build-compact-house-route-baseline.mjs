import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const ROOT = process.cwd();

export const HOUSE_FILES = {
  project: 'data/projects/marbella-villa.example.json',
  pilotScope: 'data/tests/whole-building-10.json',
  routes: 'data/procurement/whole-building-10.routes.json',
  pilotResults: 'data/tests/results/whole-building-10.latest.json',
  concreteRequirement: 'data/requirements/project-marbella-villa-001.structural-concrete.json',
  poolRequirement: 'data/requirements/project-marbella-villa-001.pool-circulation.json',
  solarRequirement: 'data/energy/project-marbella-villa-001.solar-requirement.json',
  pvgis: 'data/energy/project-marbella-villa-001.pvgis.json',
  cteClimate: 'data/energy/project-marbella-villa-001.cte-climate.json',
  logisticsSchema: 'config/logistics-schema.json',
  regulatorySchema: 'config/regulatory-schema.json',
  jurisdictionSeed: 'config/jurisdictions/es-andalucia-seed.json',
  prefabSystem: 'config/prefab-system-schema.json',
  prefabModes: 'config/prefab-design-procurement-modes.json',
  prefabPods: 'config/prefab-room-pods.json',
  schema: 'config/compact-house-route-baseline.schema.json',
  output: 'data/procurement/project-marbella-villa-001-compact-house-route-baseline-v1.0.0.json'
};

const PACKAGE_DEFINITIONS = [
  {
    package_id: 'PKG_SITE_WORKS', name: 'Site works', construction_phase: 'siteworks', slots: [],
    expected_scope: ['survey and setting out', 'earthworks', 'temporary works', 'site drainage and utilities'],
    missing_scope: ['No frozen site-works design, quantities, method, supplier route or programme package exists.']
  },
  {
    package_id: 'PKG_FOUNDATIONS', name: 'Foundations', construction_phase: 'foundations', slots: [],
    expected_scope: ['foundation system', 'excavation support', 'reinforcement', 'concrete pours', 'ground waterproofing'],
    missing_scope: ['Structural concrete is a pilot material slot, not a designed foundation system or quantified pour schedule.']
  },
  {
    package_id: 'PKG_STRUCTURAL_SHELL', name: 'Structural shell', construction_phase: 'structure', slots: ['WB10_01'],
    expected_scope: ['primary structural system', 'concrete', 'reinforcement', 'structural steel or timber', 'connection nodes'],
    missing_scope: ['Only structural concrete routing is represented; engineered quantities, reinforcement, system selection and connections are absent.']
  },
  {
    package_id: 'PKG_FACADE_ROOF_OPENINGS', name: 'Facade, roof, windows and doors', construction_phase: 'envelope', slots: ['WB10_02'],
    expected_scope: ['facade system', 'roof build-up', 'waterproofing', 'insulation', 'windows', 'external doors and interfaces'],
    missing_scope: ['Only a generic window-system pilot slot is represented; facade, roof, doors, schedule quantities and interface details are absent.']
  },
  {
    package_id: 'PKG_MEP', name: 'Electrical, plumbing, HVAC and ventilation', construction_phase: 'mep_rough_in', slots: ['WB10_08'],
    expected_scope: ['electrical distribution', 'plumbing and drainage', 'hot water', 'HVAC', 'ventilation', 'controls and commissioning points'],
    missing_scope: ['Only a heat-pump discovery slot is represented; loads, schematics, distribution, ventilation and quantities are absent.']
  },
  {
    package_id: 'PKG_PREFAB_PODS', name: 'Bathroom, kitchen and service pods', construction_phase: 'interior_build', slots: [],
    expected_scope: ['bathroom pod', 'kitchen pod', 'utility or plant pod', 'service interfaces', 'lifting and installation route'],
    missing_scope: ['Pod categories and interface concepts exist, but no supplier system, configuration, quantity or route is selected.']
  },
  {
    package_id: 'PKG_INTERIOR_FINISHES_JOINERY', name: 'Interior finishes and fixed joinery', construction_phase: 'finishes', slots: ['WB10_03'],
    expected_scope: ['partitions', 'ceilings', 'floor and wall finishes', 'paint', 'fixed joinery', 'kitchen cabinetry and worktops'],
    missing_scope: ['Only a natural-stone discovery slot is represented; room take-offs, finish schedules and fixed joinery are absent.']
  },
  {
    package_id: 'PKG_BUILDING_FIXTURES_ENERGY', name: 'Building fixtures, solar and energy systems', construction_phase: 'fixtures', slots: ['WB10_06', 'WB10_07', 'WB10_09'],
    expected_scope: ['fixed luminaires', 'PV array', 'inverter', 'mounting', 'balance of system', 'metering', 'battery or energy manager if required'],
    missing_scope: ['Only panel, inverter and pendant discovery slots are represented; final fixture schedules, energy demand, usable roof geometry, shading, phase, grid constraints and system sizing are unresolved.']
  },
  {
    package_id: 'PKG_FURNITURE_EQUIPMENT', name: 'Furniture and equipment', construction_phase: 'ffe', slots: ['WB10_10'],
    expected_scope: ['furniture', 'appliances', 'sanitaryware', 'loose equipment and accessories'],
    missing_scope: ['Only a discovery sofa slot is represented; the approved room plan is separate and the whole-house FFE schedule is absent.']
  },
  {
    package_id: 'PKG_OUTDOOR_POOL_LANDSCAPE', name: 'Pool, garden and landscape', construction_phase: 'landscape', slots: ['WB10_04', 'WB10_05'],
    expected_scope: ['pool shell and waterproofing', 'pool hydraulics and plant', 'paving', 'drainage', 'irrigation', 'planting and outdoor equipment'],
    missing_scope: ['Only pool pipe and pump pilot slots are represented; pool geometry/duty, garden design, landscape quantities and site routes are absent.']
  },
  {
    package_id: 'PKG_INSTALLATION_COMMISSIONING_HANDOVER', name: 'Installation, commissioning and as-built handover', construction_phase: 'commissioning', slots: [],
    expected_scope: ['installation scopes', 'testing and commissioning', 'inspection records', 'warranties', 'as-built identities and maintenance data'],
    missing_scope: ['No installation contracts, commissioning plan, acceptance criteria or as-built handover graph exists.']
  }
];

const LINE_GATE_IDS = [
  'QUANTITY',
  'EXACT_IDENTITY',
  'TECHNICAL_MATCH',
  'DESTINATION_SUPPLY',
  'LEAD_TIME',
  'LANDED_COST',
  'REGULATORY',
  'REQUIRED_ON_SITE_DATE',
  'PURCHASE_REFRESH'
];

const GLOBAL_GATE_IDS = [
  'FROZEN_HOUSE_DESIGN',
  'FULL_BOM_SCOPE',
  'QUANTITIES_COMPLETE',
  'TECHNICAL_MATCHES',
  'DESTINATION_SUPPLY',
  'REGULATORY_CLEARANCE',
  'LANDED_COST',
  'CONSTRUCTION_PROGRAMME',
  'SITE_ACCESS',
  'CONSTRUCTION_ROUTE_SELECTED',
  'INSTALLATION_COMMISSIONING'
];

function asDate(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error(`${label} must be a valid date-time`);
  return date;
}

function sameNumber(left, right) {
  return Number(left) === Number(right);
}

function categoryMatches(categoryId, ruleCategory) {
  return ruleCategory.endsWith('.*') ? categoryId.startsWith(ruleCategory.slice(0, -1)) : categoryId === ruleCategory;
}

function deriveRegulatoryState(categoryId, jurisdictionSeed) {
  const states = jurisdictionSeed.seed_rules
    .filter((rule) => (rule.category_ids ?? []).some((ruleCategory) => categoryMatches(categoryId, ruleCategory)))
    .map((rule) => rule.default_state);
  if (states.includes('HOLD')) return 'HOLD';
  if (states.includes('REVIEW')) return 'REVIEW';
  return 'NOT_APPLICABLE';
}

export function hashHouseSource(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function sourceRef(pathValue, identity, version, value) {
  return {path: pathValue, identity: String(identity), version: String(version), sha256: hashHouseSource(value)};
}

function gate(gateId, reason) {
  return {gate: gateId, state: 'BLOCKED', critical: true, reason};
}

function unresolvedCost(reason) {
  return {state: 'UNVERIFIED', amount: null, currency: 'EUR', reason};
}

function assertSourceJoins({project, pilotScope, routes, pilotResults, concreteRequirement, poolRequirement, solarRequirement, pvgis, cteClimate, logisticsSchema, regulatorySchema, jurisdictionSeed, prefabSystem}, generatedAt) {
  const projectIds = [project.project_id, pilotScope.project_id, routes.summary.project_id, pilotResults.summary.project_id];
  if (new Set(projectIds).size !== 1) throw new Error('Project identities do not join across compact-house source files');
  if (pilotScope.requirements.length !== 10 || routes.routes.length !== 10 || pilotResults.slots.length !== 10) throw new Error('Whole-building pilot must contain exactly ten joined slots');
  if (pilotResults.summary.test_id !== pilotScope.test_id) throw new Error('Whole-building pilot result identity does not match the scoped fixture');
  const scopeIds = pilotScope.requirements.map((item) => item.slot_id);
  if (JSON.stringify(routes.routes.map((item) => item.slot_id)) !== JSON.stringify(scopeIds) || JSON.stringify(pilotResults.slots.map((item) => item.slot_id)) !== JSON.stringify(scopeIds)) throw new Error('Whole-building pilot slot order or membership does not reconcile');
  for (const [label, value] of [['routes.summary.generated_at', routes.summary.generated_at], ['pilotResults.summary.generated_at', pilotResults.summary.generated_at], ['pvgis.generated_at', pvgis.generated_at], ['cteClimate.generated_at', cteClimate.generated_at]]) {
    if (asDate(value, label).valueOf() > generatedAt.valueOf()) throw new Error(`${label} cannot be later than baseline generation`);
  }
  if ([concreteRequirement.project_id, poolRequirement.project_id, solarRequirement.project_id, pvgis.project_id, cteClimate.project_id].some((projectId) => projectId !== project.project_id)) throw new Error('Requirement, climate and solar sources must join to the compact-house project');
  if (!sameNumber(pvgis.location.lat, project.location.lat) || !sameNumber(pvgis.location.lon, project.location.lon) || pvgis.location.elevation_m !== cteClimate.elevation_m) throw new Error('PVGIS coordinates and elevation must match the project and verified climate context');
  if (cteClimate.province !== project.location.province || cteClimate.source.authority !== 'Ministerio de Vivienda y Agenda Urbana / Código Técnico de la Edificación' || cteClimate.source.document !== 'DB-HE Ahorro de energía - Anejo B Zonas climáticas') throw new Error('CTE province and authority must match the project jurisdiction and official climate evidence');
  const solarResource = solarRequirement.verified_site_resource;
  if (!sameNumber(solarResource.annual_energy_kwh_per_kwp, pvgis.performance.annual_energy_kwh_per_kwp)
    || !sameNumber(solarResource.annual_plane_irradiation_kwh_m2, pvgis.performance.annual_plane_irradiation_kwh_m2)
    || !sameNumber(solarResource.optimal_tilt_deg, pvgis.optimized_plane.tilt_deg)
    || !sameNumber(solarResource.optimal_pvgis_azimuth_deg, pvgis.optimized_plane.pvgis_azimuth_deg)) throw new Error('Solar requirement screening resource must reconcile to canonical PVGIS evidence');
  if (JSON.stringify(PACKAGE_DEFINITIONS.map((definition) => definition.construction_phase)) !== JSON.stringify(logisticsSchema.construction_phases)) throw new Error('Compact-house packages must exactly follow the canonical logistics construction phases');
  const jurisdictionIds = jurisdictionSeed.jurisdictions.map((jurisdiction) => jurisdiction.id);
  if (regulatorySchema.version !== '0.1' || jurisdictionSeed.version !== '0.2' || !project.jurisdiction.chain.every((jurisdictionId) => jurisdictionIds.includes(jurisdictionId)) || project.jurisdiction.resolved_id !== project.jurisdiction.chain.at(-1)) throw new Error('Regulatory authority and jurisdiction chain must match the compact-house project');
  if (prefabSystem.version !== '0.1') throw new Error('Unsupported prefab-system authority version');
}

function buildLine(requirement, route, result, resultGeneratedAt, jurisdictionSeed) {
  if (requirement.category_id !== route.category_id || requirement.category_id !== result.category_id || requirement.label !== route.label || requirement.label !== result.label) throw new Error(`${requirement.slot_id} category or label does not reconcile across sources`);
  if (route.identity_state !== 'UNRESOLVED' || result.technical_match_verified || result.lead_time_known || result.landed_cost_known) throw new Error(`${requirement.slot_id} source state exceeds the fail-closed compact-house pilot contract`);
  const reference = route.selected_external_reference;
  if (!reference || reference.source_id !== 'shopify_global_catalog' || !/^gid:\/\/shopify\/p\/[A-Za-z0-9]+$/.test(reference.product_id ?? '') || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(reference.variant_id ?? '')) throw new Error(`${requirement.slot_id} selected reference must be an immutable Shopify product and variant identity, not a cart, checkout or order identifier`);
  const selectedReference = {...reference, use_state: 'DISCOVERY_REFERENCE_NOT_APPROVED_PRODUCT'};
  const regulatoryState = deriveRegulatoryState(requirement.category_id, jurisdictionSeed);
  const hasRegulatoryEvidenceGap = result.blockers.includes('regulatory_gate') || result.missing_regulatory_evidence.length > 0;
  if (regulatoryState === 'HOLD' && (!hasRegulatoryEvidenceGap || result.regulatory_state !== 'HOLD')) throw new Error(`${requirement.slot_id} regulatory state does not reconcile to category authority, blockers and missing evidence`);
  if (regulatoryState !== 'HOLD' && hasRegulatoryEvidenceGap) throw new Error(`${requirement.slot_id} regulatory evidence gap does not reconcile to category authority`);
  const regulatoryPass = regulatoryState === 'NOT_APPLICABLE';
  const gates = LINE_GATE_IDS.map((gateId) => gate(gateId, {
    QUANTITY: 'The pilot records a unit basis, not a measured or scheduled quantity.',
    EXACT_IDENTITY: 'The selected external reference has unresolved canonical manufacturer identity.',
    TECHNICAL_MATCH: 'No candidate is verified against an engineered technical requirement.',
    DESTINATION_SUPPLY: 'Discovery candidates are not exact, destination-confirmed supply for an approved product.',
    LEAD_TIME: 'No verified lead time is recorded.',
    LANDED_COST: 'No comparable merchandise, freight, tax, installation or landed cost is recorded.',
    REGULATORY: regulatoryPass ? 'No seeded category rule applies to this pilot slot, but the complete house regulatory package is not closed.' : `The authority-derived regulatory state is ${regulatoryState}.`,
    REQUIRED_ON_SITE_DATE: 'The source contains a planning day offset, not a dated construction programme milestone.',
    PURCHASE_REFRESH: 'No purchase-time destination refresh exists for an approved exact product.'
  }[gateId]));
  const costReason = 'No approved exact product, quantity or comparable destination quote exists for this pilot line.';
  const packageDefinition = PACKAGE_DEFINITIONS.find((definition) => definition.slots.includes(requirement.slot_id));
  if (!packageDefinition) throw new Error(`${requirement.slot_id} has no canonical package mapping`);
  return {
    line_item_id: `LINE_${requirement.slot_id}`,
    slot_id: requirement.slot_id,
    label: requirement.label,
    category_id: requirement.category_id,
    package_id: packageDefinition.package_id,
    construction_phase: packageDefinition.construction_phase,
    source_phase: requirement.phase,
    quantity: {state: 'UNRESOLVED', value: null, unit_basis: requirement.quantity_basis},
    required_on_site: {state: 'PLANNING_DAY_OFFSET_ONLY', date: null, planning_day_offset: requirement.required_on_site_day},
    selected_reference: selectedReference,
    identity_state: 'UNRESOLVED',
    route: {
      route_type: route.route_type,
      source_id: route.source_id,
      state: route.state,
      requirement_id: route.requirement_id,
      requirement_state: route.requirement_state,
      inputs_required: route.inputs_required
    },
    discovery_evidence: {
      evidence_state: 'HISTORICAL_UNDATED_AGGREGATE',
      source_generated_at: resultGeneratedAt,
      live_supply_candidate_count: result.live_supply_count,
      offers_checked: result.offers_checked,
      postcode_candidate_count: result.postcode_deliverable_offer_count,
      technical_match_verified: false,
      lead_time_known: false,
      landed_cost_known: false,
      source_regulatory_state: result.regulatory_state,
      regulatory_state: regulatoryState,
      regulatory_derivation_state: result.regulatory_state === regulatoryState ? 'SOURCE_ALIGNED_WITH_AUTHORITY' : 'AUTHORITY_OVERRIDES_HISTORICAL_SOURCE'
    },
    supply_class: 'UNVERIFIED',
    commercial_state: {
      merchandise: unresolvedCost(costReason),
      freight: unresolvedCost(costReason),
      tax_and_duty: unresolvedCost(costReason),
      installation: unresolvedCost(costReason),
      contingency: unresolvedCost(costReason),
      landed_total: unresolvedCost(costReason)
    },
    readiness: {purchase_ready: false, state: 'BLOCKED', gates}
  };
}

function buildPackages(lines) {
  return PACKAGE_DEFINITIONS.map((definition) => ({
    package_id: definition.package_id,
    name: definition.name,
    construction_phase: definition.construction_phase,
    coverage_state: definition.slots.length ? 'PILOT_PARTIAL' : 'MISSING_FROM_PILOT_SCOPE',
    expected_scope: definition.expected_scope,
    pilot_line_item_ids: definition.slots.map((slotId) => lines.find((line) => line.slot_id === slotId)?.line_item_id),
    missing_scope: definition.missing_scope
  }));
}

function buildRisks(lines) {
  const all = lines.map((line) => line.line_item_id);
  const energy = lines.filter((line) => line.category_id.startsWith('ENERGY.')).map((line) => line.line_item_id);
  const regulated = lines.filter((line) => line.discovery_evidence.regulatory_state !== 'NOT_APPLICABLE').map((line) => line.line_item_id);
  return [
    {risk_id: 'RISK_NO_FROZEN_HOUSE_DESIGN_OR_FULL_BOM', severity: 'CRITICAL', state: 'OPEN', evidence: 'The repository contains a ten-slot routing pilot, not a frozen compact-house design or complete BoM.', mitigation: 'Freeze the H30 or other compact-house design graph and export measured package quantities before procurement compilation.', affected_line_item_ids: all},
    {risk_id: 'RISK_ALL_PILOT_QUANTITIES_UNRESOLVED', severity: 'CRITICAL', state: 'OPEN', evidence: 'Every pilot slot records only a quantity basis.', mitigation: 'Generate take-offs and schedules from approved geometry, engineering and room/package definitions.', affected_line_item_ids: all},
    {risk_id: 'RISK_DISCOVERY_REFERENCES_NOT_TECHNICALLY_VERIFIED', severity: 'HIGH', state: 'OPEN', evidence: 'All ten selected external references have unresolved exact identity and technical match.', mitigation: 'Define requirements first, then resolve exact Product Twins or configured RFQ responses.', affected_line_item_ids: all},
    {risk_id: 'RISK_NO_LEAD_TIME_OR_LANDED_COST', severity: 'HIGH', state: 'OPEN', evidence: 'All ten pilot results report missing lead time and landed cost.', mitigation: 'Obtain destination-specific quotes only after exact identity, quantity and technical fit are established.', affected_line_item_ids: all},
    {risk_id: 'RISK_PACKAGE_SCOPE_INCOMPLETE', severity: 'CRITICAL', state: 'OPEN', evidence: 'Seven packages are partially represented and four are absent from the pilot.', mitigation: 'Expand the frozen BoM to every site, building, services, interior, landscape and handover package.', affected_line_item_ids: all},
    {risk_id: 'RISK_SITE_ACCESS_UNVERIFIED', severity: 'HIGH', state: 'OPEN', evidence: 'Vehicle, crane, forklift, unloading, storage and delivery-window constraints are null.', mitigation: 'Survey and approve the physical delivery and lifting constraints before route selection.', affected_line_item_ids: all},
    {risk_id: 'RISK_CONSTRUCTION_ROUTE_NOT_SELECTED', severity: 'HIGH', state: 'OPEN', evidence: 'Conventional, prefab, additive and hybrid options are concepts only.', mitigation: 'Compare route-specific engineering, regulatory, cost, logistics and programme evidence before selection.', affected_line_item_ids: all},
    {risk_id: 'RISK_SOLAR_SYSTEM_REQUIREMENT_INCOMPLETE', severity: 'HIGH', state: 'OPEN', evidence: 'PV resource is verified, but demand, roof geometry, shading, phase and grid constraints are unresolved.', mitigation: 'Complete the project solar requirement before choosing panels, inverters or storage.', affected_line_item_ids: energy},
    {risk_id: 'RISK_REGULATORY_EVIDENCE_OPEN', severity: 'HIGH', state: 'OPEN', evidence: 'Pilot lines with HOLD or REVIEW regulatory states cannot progress to procurement.', mitigation: 'Resolve applicable conformity, declaration, electrical and project regulatory gates.', affected_line_item_ids: regulated},
    {risk_id: 'RISK_INSTALLATION_COMMISSIONING_UNDEFINED', severity: 'HIGH', state: 'OPEN', evidence: 'No installation scopes, commissioning plan or as-built acceptance records exist.', mitigation: 'Define installer responsibilities, tests, inspections, handover evidence and lifecycle ownership.', affected_line_item_ids: all}
  ];
}

export function buildCompactHouseRouteBaseline(sources, asOf) {
  const generatedAt = asOf instanceof Date ? asOf : new Date(asOf);
  if (Number.isNaN(generatedAt.valueOf())) throw new Error('asOf must be a valid date-time');
  assertSourceJoins(sources, generatedAt);
  const {project, pilotScope, routes, pilotResults, concreteRequirement, poolRequirement, solarRequirement, pvgis, cteClimate, logisticsSchema, regulatorySchema, jurisdictionSeed, prefabSystem, prefabModes, prefabPods} = sources;
  if (concreteRequirement.status !== 'needs_inputs' || poolRequirement.status !== 'needs_inputs' || solarRequirement.status !== 'needs_inputs') throw new Error('Compact-house requirements must remain explicitly incomplete in this baseline');
  if ([concreteRequirement.project_id, poolRequirement.project_id, solarRequirement.project_id].some((projectId) => projectId !== project.project_id)) throw new Error('Concrete, pool and solar requirements must join to the compact-house project');
  if (pvgis.project_id !== project.project_id || cteClimate.project_id !== project.project_id || cteClimate.status !== 'verified') throw new Error('Climate and solar screening evidence must join to the compact-house project');
  const routeRequirements = new Map(routes.routes.map((route) => [route.slot_id, route.requirement_id]));
  if (routeRequirements.get('WB10_01') !== concreteRequirement.requirement_id || routeRequirements.get('WB10_05') !== poolRequirement.requirement_id || routeRequirements.get('WB10_06') !== solarRequirement.requirement_id || routeRequirements.get('WB10_07') !== solarRequirement.requirement_id) throw new Error('Configured compact-house routes do not reference their canonical requirement manifests');
  const requirementById = new Map([concreteRequirement, poolRequirement, solarRequirement].map((requirement) => [requirement.requirement_id, requirement]));
  for (const route of routes.routes) {
    if (route.requirement_id) {
      const requirement = requirementById.get(route.requirement_id);
      if (!requirement || route.requirement_state !== requirement.status || route.state !== 'needs_requirement') throw new Error(`${route.slot_id} route state must reconcile to its incomplete canonical requirement`);
    } else if (route.requirement_state !== null || route.state !== 'needs_technical_review') throw new Error(`${route.slot_id} route without a requirement must remain in technical review`);
  }
  const routeBySlot = new Map(routes.routes.map((item) => [item.slot_id, item]));
  const resultBySlot = new Map(pilotResults.slots.map((item) => [item.slot_id, item]));
  const lines = pilotScope.requirements.map((requirement) => buildLine(requirement, routeBySlot.get(requirement.slot_id), resultBySlot.get(requirement.slot_id), pilotResults.summary.generated_at, jurisdictionSeed));
  const packages = buildPackages(lines);
  if (packages.some((pkg) => pkg.pilot_line_item_ids.includes(undefined))) throw new Error('Package mapping references an unknown pilot slot');
  const routeCounts = (key, value) => lines.filter((line) => line.route[key] === value).length;
  const scopeState = {
    state: 'PILOT_ROUTE_MAP_NOT_FULL_BOM',
    frozen_house_design: false,
    full_bom: false,
    quantities_complete: false,
    pilot_slot_count: lines.length,
    expected_package_count: packages.length,
    partial_package_count: packages.filter((pkg) => pkg.coverage_state === 'PILOT_PARTIAL').length,
    missing_package_count: packages.filter((pkg) => pkg.coverage_state === 'MISSING_FROM_PILOT_SCOPE').length,
    missing_upstream_inputs: [
      'frozen compact-house design graph and approved construction route',
      'complete package and subpackage BoM',
      'measured quantities and configuration schedules',
      'dated construction programme and required-on-site dates',
      'site access, unloading, lifting and storage survey',
      'engineered technical and regulatory requirements',
      'installation, commissioning and as-built handover plan'
    ]
  };
  const globalGates = GLOBAL_GATE_IDS.map((gateId) => gate(gateId, {
    FROZEN_HOUSE_DESIGN: 'No frozen compact-house design graph is attached.',
    FULL_BOM_SCOPE: 'The ten-slot pilot does not cover the complete house scope.',
    QUANTITIES_COMPLETE: 'Every pilot quantity is unresolved.',
    TECHNICAL_MATCHES: 'No pilot candidate has a verified technical match.',
    DESTINATION_SUPPLY: 'Discovery candidate counts do not prove exact destination supply.',
    REGULATORY_CLEARANCE: 'Required regulatory and conformity evidence is open.',
    LANDED_COST: 'No comparable merchandise, freight, tax, installation or landed cost exists.',
    CONSTRUCTION_PROGRAMME: 'Planning day offsets are not dated required-on-site milestones.',
    SITE_ACCESS: 'Site delivery, unloading, lifting and storage constraints are unverified.',
    CONSTRUCTION_ROUTE_SELECTED: 'Conventional, prefab, additive or hybrid construction has not been selected.',
    INSTALLATION_COMMISSIONING: 'Installation, commissioning and handover scopes are undefined.'
  }[gateId]));
  return {
    schema_version: '1.0.0',
    baseline_id: 'COMPACT_HOUSE_ROUTE_BASELINE_PROJECT_MARBELLA_VILLA_001',
    revision: 1,
    status: 'PRE_BOM_SCOPE_NOT_PROCUREMENT_READY',
    generated_at: generatedAt.toISOString(),
    project: {
      project_id: project.project_id,
      project_type: project.project_type,
      country: project.location.country,
      region: project.location.region,
      municipality: project.location.municipality,
      postal_code: project.location.postal_code,
      currency: project.procurement.currency,
      local_supply_radius_km: project.logistics.local_radius_km,
      site_access_state: 'UNVERIFIED'
    },
    site_context: {
      climate_state: 'VERIFIED_SCREENING_CONTEXT',
      cte_zone: cteClimate.cte_zone,
      solar_resource_state: 'VERIFIED_SCREENING_RESOURCE',
      annual_energy_kwh_per_kwp: pvgis.performance.annual_energy_kwh_per_kwp,
      annual_plane_irradiation_kwh_m2: pvgis.performance.annual_plane_irradiation_kwh_m2,
      screening_tilt_deg: pvgis.optimized_plane.tilt_deg,
      screening_pvgis_azimuth_deg: pvgis.optimized_plane.pvgis_azimuth_deg,
      product_sizing_state: 'BLOCKED_MISSING_BUILDING_INPUTS'
    },
    source_snapshot: {
      project: sourceRef(HOUSE_FILES.project, project.project_id, project.project_id, project),
      pilot_scope: sourceRef(HOUSE_FILES.pilotScope, pilotScope.test_id, pilotScope.test_id, pilotScope),
      routes: sourceRef(HOUSE_FILES.routes, routes.summary.project_id, routes.summary.generated_at, routes),
      pilot_results: sourceRef(HOUSE_FILES.pilotResults, pilotResults.summary.test_id, pilotResults.summary.generated_at, pilotResults),
      concrete_requirement: sourceRef(HOUSE_FILES.concreteRequirement, concreteRequirement.requirement_id, concreteRequirement.status, concreteRequirement),
      pool_requirement: sourceRef(HOUSE_FILES.poolRequirement, poolRequirement.requirement_id, poolRequirement.status, poolRequirement),
      solar_requirement: sourceRef(HOUSE_FILES.solarRequirement, solarRequirement.requirement_id, solarRequirement.status, solarRequirement),
      pvgis: sourceRef(HOUSE_FILES.pvgis, pvgis.project_id, pvgis.generated_at, pvgis),
      cte_climate: sourceRef(HOUSE_FILES.cteClimate, cteClimate.project_id, cteClimate.generated_at, cteClimate),
      logistics_schema: sourceRef(HOUSE_FILES.logisticsSchema, 'LOGISTICS_SCHEMA', logisticsSchema.version, logisticsSchema),
      regulatory_schema: sourceRef(HOUSE_FILES.regulatorySchema, 'REGULATORY_SCHEMA', regulatorySchema.version, regulatorySchema),
      jurisdiction_seed: sourceRef(HOUSE_FILES.jurisdictionSeed, project.jurisdiction.resolved_id, jurisdictionSeed.version, jurisdictionSeed),
      prefab_system: sourceRef(HOUSE_FILES.prefabSystem, 'PREFAB_SYSTEM_SCHEMA', prefabSystem.version, prefabSystem),
      prefab_modes: sourceRef(HOUSE_FILES.prefabModes, 'PREFAB_DESIGN_PROCUREMENT_MODES', prefabModes.version, prefabModes),
      prefab_pods: sourceRef(HOUSE_FILES.prefabPods, 'PREFAB_ROOM_PODS', prefabPods.version, prefabPods)
    },
    scope_state: scopeState,
    packages,
    line_items: lines,
    route_summary: {
      total_lines: lines.length,
      configured_rfq: routeCounts('route_type', 'configured_rfq'),
      merchant_cart: routeCounts('route_type', 'merchant_cart'),
      direct_trade: routeCounts('route_type', 'direct_trade'),
      needs_requirement: routeCounts('state', 'needs_requirement'),
      needs_technical_review: routeCounts('state', 'needs_technical_review'),
      executable_now: 0
    },
    cost_summary: {state: 'NO_COMPARABLE_COST_BASIS', currency: 'EUR', merchandise: null, freight: null, tax_and_duty: null, installation: null, contingency: null, landed_total: null},
    schedule: {state: 'PRE_PROGRAMME', programme_start_date: null, planning_day_offsets_present: true, required_on_site_dates_present: false, delivery_packages: []},
    construction_strategy: {selected_route: null, conventional_state: 'NOT_EVALUATED', prefab_state: 'CONCEPT_OPTIONS_ONLY', additive_state: 'CONCEPT_OPTIONS_ONLY', hybrid_state: 'CONCEPT_OPTIONS_ONLY', prefab_modes_are_planning_only: true, pod_configuration_selected: false},
    risk_register: buildRisks(lines),
    procurement_readiness: {purchase_ready: false, state: 'BLOCKED', gates: globalGates, blocking_gate_ids: globalGates.map((item) => item.gate)},
    consumer_contract: {
      manifest_role: 'PRE_BOM_PACKAGE_AND_ROUTE_BASELINE',
      executable_procurement_plan: false,
      pilot_candidates_are_approved_products: false,
      country_claim_scope: 'ES_29660_ONLY',
      mutable_checkout_payloads_embedded: false,
      notes: [
        'The ten pilot slots demonstrate procurement-route diversity; they are not a complete compact-house BoM.',
        'Live supply and postcode candidate counts are discovery signals, not exact product availability claims.',
        'Prefab modes and pod categories are planning frameworks only; no factory or configuration is approved.',
        'No Spain evidence may be inherited by Sweden, Great Britain or the United States.'
      ]
    }
  };
}

async function readSources() {
  const entries = await Promise.all(Object.entries(HOUSE_FILES).filter(([key]) => !['schema', 'output'].includes(key)).map(async ([key, file]) => [key, JSON.parse(await fs.readFile(path.join(ROOT, file), 'utf8'))]));
  return Object.fromEntries(entries);
}

function parseAsOf(argv) {
  const inline = argv.find((argument) => argument.startsWith('--as-of='));
  return inline ? new Date(inline.slice('--as-of='.length)) : new Date();
}

async function main() {
  const baseline = buildCompactHouseRouteBaseline(await readSources(), parseAsOf(process.argv.slice(2)));
  await fs.writeFile(path.join(ROOT, HOUSE_FILES.output), `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(JSON.stringify({baseline_id: baseline.baseline_id, output: HOUSE_FILES.output, status: baseline.status, scope_state: baseline.scope_state, route_summary: baseline.route_summary, purchase_ready: baseline.procurement_readiness.purchase_ready}, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
