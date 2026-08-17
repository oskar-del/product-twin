const LEVELS = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5'];

const SITE_GATES = new Set([
  'OFFICIAL_CATASTRO_BOUNDARY',
  'OFFICIAL_IGN_TERRAIN_VERTICAL_DATUM',
  'CONTEXT_OBSTRUCTION_SURFACE',
  'CURRENT_PLANNING_CERTIFICATE',
  'GOVERNING_PLANNING_INSTRUMENT',
  'A7_BUILDING_LINE_AND_ACCESS',
  'AUTHORITY_CONFIRMED_ENTRANCE',
  'ROOFTOP_CORNICE_RULES',
  'TITLE_AND_CHARGES',
  'FLOOD_ENVIRONMENTAL_OVERLAYS',
  'UTILITY_CAPACITY',
]);

const PROCUREMENT_GATES = [
  'exact_product_and_selected_configuration',
  'technical_fit_for_project',
  'current_offer_or_quote',
  'stock_or_allocated_availability',
  'destination_delivery_confirmation',
  'known_lead_time',
  'known_landed_cost_or_authoritative_checkout_total',
  'ready_cart_trade_or_rfq_route',
];

const FORBIDDEN_DESIGN_ASSET_KEYS = new Set([
  'producttwinid', 'twinid', 'sku', 'gtin', 'ean', 'upc',
  'price', 'unitprice', 'unitpriceeur', 'msrp', 'msrpeur', 'rrp',
  'stock', 'availabilitystock', 'offer', 'offers', 'supplier', 'seller',
  'vendor', 'merchant', 'commerce', 'procurement', 'logistics', 'checkout',
  'cart', 'leadtime', 'leadtimedays', 'landedcost', 'landedcosteur',
  'quantity', 'qty', 'amount', 'cost', 'rate',
]);

const normalizeKey = (key) => key.toLowerCase().replace(/[^a-z0-9]/g, '');
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const unique = (values) => [...new Set(values)];
const sorted = (values) => [...values].sort();

function sameStringSet(a, b) {
  return Array.isArray(a)
    && Array.isArray(b)
    && JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
}

function sameDestination(a, b) {
  return isObject(a)
    && isObject(b)
    && a.country === b.country
    && a.postal_code === b.postal_code;
}

function sameTransform(a, b) {
  return isObject(a)
    && isObject(b)
    && JSON.stringify(a.position_m) === JSON.stringify(b.position_m)
    && JSON.stringify(a.rotation_deg) === JSON.stringify(b.rotation_deg);
}

function findForbiddenDesignAssetKeys(value, path = 'asset', findings = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenDesignAssetKeys(item, `${path}[${index}]`, findings));
    return findings;
  }
  if (!isObject(value)) return findings;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_DESIGN_ASSET_KEYS.has(normalizeKey(key))) findings.push(childPath);
    findForbiddenDesignAssetKeys(child, childPath, findings);
  }
  return findings;
}

export function validateCompositeReleaseManifest(manifest, options = {}) {
  const nowMs = options.now instanceof Date
    ? options.now.getTime()
    : typeof options.now === 'string'
      ? Date.parse(options.now)
      : Date.now();
  const issues = [];
  const readinessBlockers = [];
  let checksTotal = 0;

  const check = (condition, code, path, message) => {
    checksTotal += 1;
    if (!condition) issues.push({code, path, message});
    return condition;
  };

  const strictObject = (value, path, required, allowed = required) => {
    if (!check(isObject(value), 'TYPE_OBJECT_REQUIRED', path, 'must be an object')) return false;
    for (const key of required) {
      check(Object.hasOwn(value, key), 'REQUIRED_FIELD_MISSING', `${path}.${key}`, 'required field is missing');
    }
    for (const key of Object.keys(value)) {
      check(allowed.includes(key), 'UNKNOWN_FIELD', `${path}.${key}`, 'field is outside the composite release contract');
    }
    return true;
  };

  const enumValue = (value, values, code, path) => check(values.includes(value), code, path, `must be one of ${values.join(', ')}`);
  const stringValue = (value, code, path) => check(isNonEmptyString(value), code, path, 'must be a non-empty string');
  const boolValue = (value, code, path) => check(typeof value === 'boolean', code, path, 'must be boolean');
  const intValue = (value, code, path, minimum = 0) => check(Number.isInteger(value) && value >= minimum, code, path, `must be an integer >= ${minimum}`);

  const timestamp = (value, code, path, {futureAllowed = false} = {}) => {
    const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN;
    const valid = check(Number.isFinite(parsed), code, path, 'must be an RFC 3339 timestamp');
    if (valid && !futureAllowed) {
      check(parsed <= nowMs + 300_000, 'EVIDENCE_OBSERVED_IN_FUTURE', path, 'observation time cannot be in the future');
    }
    return parsed;
  };

  const destination = (value, path) => {
    if (!strictObject(value, path, ['country', 'region', 'postal_code'])) return false;
    stringValue(value.country, 'DESTINATION_COUNTRY_REQUIRED', `${path}.country`);
    check(value.region === null || isNonEmptyString(value.region), 'DESTINATION_REGION_INVALID', `${path}.region`, 'must be null or a non-empty string');
    stringValue(value.postal_code, 'DESTINATION_POSTAL_CODE_REQUIRED', `${path}.postal_code`);
    return true;
  };

  const evidence = (value, path, {expectedMarket = null, expectedDestination = null} = {}) => {
    const requiredFields = ['source_ref', 'observed_at', 'freshness_state', 'valid_until', 'market', 'destination'];
    const allowedFields = [...requiredFields, 'content_sha256'];
    if (!strictObject(value, path, requiredFields, allowedFields)) return;
    if (Object.hasOwn(value, 'content_sha256')) {
      check(value.content_sha256 === null || /^[0-9a-f]{64}$/.test(value.content_sha256), 'EVIDENCE_CONTENT_HASH_INVALID', `${path}.content_sha256`, 'must be null or a full SHA-256 digest');
    }
    const freshnessValid = enumValue(
      value.freshness_state,
      ['SNAPSHOT', 'CURRENT', 'STALE', 'RECHECK_REQUIRED', 'MISSING'],
      'EVIDENCE_FRESHNESS_INVALID',
      `${path}.freshness_state`,
    );
    if (value.freshness_state === 'MISSING') {
      check(value.source_ref === null, 'MISSING_EVIDENCE_HAS_SOURCE', `${path}.source_ref`, 'missing evidence must not pretend to have a source');
      check(value.observed_at === null, 'MISSING_EVIDENCE_HAS_OBSERVATION', `${path}.observed_at`, 'missing evidence must not have an observation time');
    } else {
      stringValue(value.source_ref, 'EVIDENCE_SOURCE_REQUIRED', `${path}.source_ref`);
      timestamp(value.observed_at, 'EVIDENCE_OBSERVED_AT_REQUIRED', `${path}.observed_at`);
    }
    if (freshnessValid && value.freshness_state === 'CURRENT') {
      const until = timestamp(value.valid_until, 'CURRENT_EVIDENCE_EXPIRY_REQUIRED', `${path}.valid_until`, {futureAllowed: true});
      if (Number.isFinite(until)) check(until >= nowMs, 'CURRENT_EVIDENCE_EXPIRED', `${path}.valid_until`, 'current evidence has expired');
    } else {
      check(value.valid_until === null || typeof value.valid_until === 'string', 'EVIDENCE_EXPIRY_INVALID', `${path}.valid_until`, 'must be null or a timestamp');
    }
    if (expectedMarket !== null) {
      check(value.market === expectedMarket, 'MARKET_EVIDENCE_LEAK', `${path}.market`, 'evidence market must match the claim market');
    } else {
      check(value.market === null, 'STATIC_EVIDENCE_MARKET_FORBIDDEN', `${path}.market`, 'non-market evidence must not carry a market');
    }
    if (expectedDestination !== null) {
      destination(value.destination, `${path}.destination`);
      check(sameDestination(value.destination, expectedDestination), 'DESTINATION_EVIDENCE_LEAK', `${path}.destination`, 'evidence destination must match the claim destination');
    } else {
      check(value.destination === null, 'STATIC_EVIDENCE_DESTINATION_FORBIDDEN', `${path}.destination`, 'non-destination evidence must not carry a destination');
    }
  };

  const topFields = [
    'schema_version', 'manifest_id', 'generated_at', 'release_state', 'release_blockers',
    'checkpoints', 'asset_records', 'site_evidence', 'room_placement', 'market_supply',
    'procurement_readiness', 'deployment_state',
  ];
  if (!strictObject(manifest, 'manifest', topFields)) {
    return {status: 'FAIL', release_decision: 'BLOCKED', checks_total: checksTotal, checks_passed: 0, block_reasons: [], issues};
  }
  check(manifest.schema_version === '0.1', 'SCHEMA_VERSION_UNSUPPORTED', 'manifest.schema_version', 'only schema version 0.1 is supported');
  stringValue(manifest.manifest_id, 'MANIFEST_ID_REQUIRED', 'manifest.manifest_id');
  timestamp(manifest.generated_at, 'MANIFEST_GENERATED_AT_INVALID', 'manifest.generated_at');
  enumValue(manifest.release_state, ['READY', 'BLOCKED'], 'RELEASE_STATE_INVALID', 'manifest.release_state');
  check(Array.isArray(manifest.release_blockers), 'RELEASE_BLOCKERS_ARRAY_REQUIRED', 'manifest.release_blockers', 'must be an array');

  if (check(Array.isArray(manifest.checkpoints), 'CHECKPOINTS_ARRAY_REQUIRED', 'manifest.checkpoints', 'must be an array')) {
    const branches = new Set();
    const workstreams = new Set();
    manifest.checkpoints.forEach((checkpoint, index) => {
      const path = `manifest.checkpoints[${index}]`;
      const fields = ['workstream', 'branch', 'commit_sha', 'relationship', 'artifact_state', 'verification', 'evidence'];
      if (!strictObject(checkpoint, path, fields)) return;
      stringValue(checkpoint.workstream, 'CHECKPOINT_WORKSTREAM_REQUIRED', `${path}.workstream`);
      check(isNonEmptyString(checkpoint.branch) && checkpoint.branch.startsWith('agent/'), 'CHECKPOINT_BRANCH_INVALID', `${path}.branch`, 'must be an agent/* branch');
      check(/^[0-9a-f]{40}$/.test(checkpoint.commit_sha), 'CHECKPOINT_COMMIT_INVALID', `${path}.commit_sha`, 'must be a full 40-character commit SHA');
      check(checkpoint.relationship === 'HEAD_AT_OBSERVATION', 'CHECKPOINT_RELATIONSHIP_INVALID', `${path}.relationship`, 'checkpoint must be the observed branch head');
      enumValue(checkpoint.artifact_state, ['IMPLEMENTATION_CHECKPOINT', 'HANDOFF_ONLY', 'DEPLOYMENT_HANDOFF'], 'CHECKPOINT_ARTIFACT_STATE_INVALID', `${path}.artifact_state`);
      check(!branches.has(checkpoint.branch), 'DUPLICATE_CHECKPOINT_BRANCH', `${path}.branch`, 'branch appears more than once');
      check(!workstreams.has(checkpoint.workstream), 'DUPLICATE_CHECKPOINT_WORKSTREAM', `${path}.workstream`, 'workstream appears more than once');
      branches.add(checkpoint.branch);
      workstreams.add(checkpoint.workstream);

      const verificationFields = ['state', 'checks_passed', 'mutation_scenarios_passed', 'notes'];
      if (strictObject(checkpoint.verification, `${path}.verification`, verificationFields)) {
        enumValue(checkpoint.verification.state, ['REPRODUCED', 'NOT_REPRODUCED', 'EXTERNAL_STATUS_ONLY', 'NOT_APPLICABLE'], 'CHECKPOINT_VERIFICATION_STATE_INVALID', `${path}.verification.state`);
        check(checkpoint.verification.checks_passed === null || (Number.isInteger(checkpoint.verification.checks_passed) && checkpoint.verification.checks_passed >= 0), 'CHECKPOINT_CHECK_COUNT_INVALID', `${path}.verification.checks_passed`, 'must be null or a non-negative integer');
        check(checkpoint.verification.mutation_scenarios_passed === null || (Number.isInteger(checkpoint.verification.mutation_scenarios_passed) && checkpoint.verification.mutation_scenarios_passed >= 0), 'CHECKPOINT_MUTATION_COUNT_INVALID', `${path}.verification.mutation_scenarios_passed`, 'must be null or a non-negative integer');
        stringValue(checkpoint.verification.notes, 'CHECKPOINT_NOTES_REQUIRED', `${path}.verification.notes`);
      }
      evidence(checkpoint.evidence, `${path}.evidence`);
      check(checkpoint.evidence?.freshness_state === 'SNAPSHOT', 'CHECKPOINT_EVIDENCE_MUST_BE_SNAPSHOT', `${path}.evidence.freshness_state`, 'immutable commit evidence must be a snapshot');
    });
  }

  if (check(Array.isArray(manifest.asset_records), 'ASSET_RECORDS_ARRAY_REQUIRED', 'manifest.asset_records', 'must be an array')) {
    const recordIds = new Set();
    manifest.asset_records.forEach((asset, index) => {
      const path = `manifest.asset_records[${index}]`;
      const fields = ['record_id', 'source_lane', 'required_for_release', 'inventory', 'identity', 'geometry', 'appearance', 'rights', 'attribution', 'publication'];
      if (!strictObject(asset, path, fields)) return;
      stringValue(asset.record_id, 'ASSET_RECORD_ID_REQUIRED', `${path}.record_id`);
      check(!recordIds.has(asset.record_id), 'DUPLICATE_ASSET_RECORD_ID', `${path}.record_id`, 'asset record ID must be unique');
      recordIds.add(asset.record_id);
      enumValue(asset.source_lane, ['PRODUCT_TWIN', 'DESIGN_ASSET'], 'SOURCE_LANE_INVALID', `${path}.source_lane`);
      boolValue(asset.required_for_release, 'ASSET_REQUIRED_FLAG_INVALID', `${path}.required_for_release`);
      if (strictObject(asset.inventory, `${path}.inventory`, ['record_count', 'publishable_count'])) {
        intValue(asset.inventory.record_count, 'ASSET_RECORD_COUNT_INVALID', `${path}.inventory.record_count`, 1);
        intValue(asset.inventory.publishable_count, 'ASSET_PUBLISHABLE_COUNT_INVALID', `${path}.inventory.publishable_count`);
        check(asset.inventory.publishable_count <= asset.inventory.record_count, 'ASSET_PUBLISHABLE_COUNT_EXCEEDS_RECORDS', `${path}.inventory`, 'publishable count cannot exceed record count');
      }

      if (asset.source_lane === 'DESIGN_ASSET') {
        const forbidden = findForbiddenDesignAssetKeys(asset, path);
        check(forbidden.length === 0, 'DESIGN_ASSET_COMMERCE_OR_IDENTITY_LEAK', path, `forbidden Product Twin/commerce keys found: ${forbidden.join(', ')}`);
        if (strictObject(asset.identity, `${path}.identity`, ['state', 'evidence'])) {
          check(asset.identity.state === 'GENERIC', 'DESIGN_ASSET_IDENTITY_INVALID', `${path}.identity.state`, 'Design Asset identity must remain GENERIC');
          evidence(asset.identity.evidence, `${path}.identity.evidence`);
        }
      } else if (strictObject(asset.identity, `${path}.identity`, ['state', 'manufacturer', 'model', 'identifiers', 'evidence'])) {
        check(asset.identity.state === 'VERIFIED_PRODUCT', 'PRODUCT_TWIN_IDENTITY_UNVERIFIED', `${path}.identity.state`, 'Product Twin identity must be verified');
        stringValue(asset.identity.manufacturer, 'PRODUCT_TWIN_MANUFACTURER_REQUIRED', `${path}.identity.manufacturer`);
        stringValue(asset.identity.model, 'PRODUCT_TWIN_MODEL_REQUIRED', `${path}.identity.model`);
        check(isObject(asset.identity.identifiers) && Object.keys(asset.identity.identifiers).length > 0, 'PRODUCT_TWIN_IDENTIFIER_REQUIRED', `${path}.identity.identifiers`, 'at least one canonical identifier is required');
        evidence(asset.identity.evidence, `${path}.identity.evidence`);
      }

      const geometryFields = [
        'claimed_level', 'verified_level', 'promotion_state', 'verified_dimensions', 'verified_units',
        'verified_orientation', 'floor_contact_verified', 'clearance_verified', 'anchor_pivot_verified', 'recognizable_form_verified',
        'independent_scale_verified', 'proxy_disclosed', 'exact_form_verified',
        'technical_interfaces_verified', 'manufacturing_authority_verified', 'evidence',
      ];
      if (strictObject(asset.geometry, `${path}.geometry`, geometryFields)) {
        const claimedOk = enumValue(asset.geometry.claimed_level, LEVELS, 'GEOMETRY_CLAIMED_LEVEL_INVALID', `${path}.geometry.claimed_level`);
        const verifiedOk = enumValue(asset.geometry.verified_level, LEVELS, 'GEOMETRY_VERIFIED_LEVEL_INVALID', `${path}.geometry.verified_level`);
        enumValue(asset.geometry.promotion_state, ['ACCEPTED', 'BLOCKED'], 'GEOMETRY_PROMOTION_STATE_INVALID', `${path}.geometry.promotion_state`);
        for (const field of geometryFields.slice(3, -1)) boolValue(asset.geometry[field], 'GEOMETRY_GATE_FLAG_INVALID', `${path}.geometry.${field}`);
        evidence(asset.geometry.evidence, `${path}.geometry.evidence`);
        if (claimedOk && verifiedOk) {
          const claimed = LEVELS.indexOf(asset.geometry.claimed_level);
          const verified = LEVELS.indexOf(asset.geometry.verified_level);
          check(!(claimed > verified && asset.geometry.promotion_state === 'ACCEPTED'), 'PREMATURE_GEOMETRY_PROMOTION', `${path}.geometry`, 'claimed geometry level exceeds independently verified level');
          if (asset.required_for_release && (claimed > verified || asset.geometry.promotion_state === 'BLOCKED')) {
            readinessBlockers.push(`ASSET_PROMOTION_BLOCKED:${asset.record_id}`);
          }
          if (verified >= 1) {
            check(asset.geometry.verified_dimensions, 'GEOMETRY_G1_DIMENSIONS_REQUIRED', `${path}.geometry.verified_dimensions`, 'G1+ requires verified real-world dimensions');
            check(asset.geometry.verified_units, 'GEOMETRY_G1_UNITS_REQUIRED', `${path}.geometry.verified_units`, 'G1+ requires verified units');
            check(asset.geometry.verified_orientation, 'GEOMETRY_G1_ORIENTATION_REQUIRED', `${path}.geometry.verified_orientation`, 'G1+ requires verified orientation');
            check(asset.geometry.floor_contact_verified, 'GEOMETRY_G1_FLOOR_CONTACT_REQUIRED', `${path}.geometry.floor_contact_verified`, 'G1+ requires verified anchor/floor contact');
            check(asset.geometry.clearance_verified, 'GEOMETRY_G1_CLEARANCE_REQUIRED', `${path}.geometry.clearance_verified`, 'G1+ requires a verified clearance contract');
            check(asset.geometry.anchor_pivot_verified, 'GEOMETRY_G1_ANCHOR_PIVOT_REQUIRED', `${path}.geometry.anchor_pivot_verified`, 'G1+ requires a verified anchor/pivot');
          }
          if (verified >= 2) {
            check(asset.geometry.recognizable_form_verified, 'GEOMETRY_G2_FORM_REQUIRED', `${path}.geometry.recognizable_form_verified`, 'G2+ requires recognizable form verification');
            check(asset.geometry.independent_scale_verified, 'GEOMETRY_G2_INDEPENDENT_SCALE_REQUIRED', `${path}.geometry.independent_scale_verified`, 'G2+ requires independent scale verification');
            check(asset.geometry.proxy_disclosed, 'GEOMETRY_G2_DISCLOSURE_REQUIRED', `${path}.geometry.proxy_disclosed`, 'G2 proxy limitations must be disclosed');
          }
          if (verified >= 3) {
            check(asset.geometry.exact_form_verified, 'GEOMETRY_G3_EXACT_FORM_REQUIRED', `${path}.geometry.exact_form_verified`, 'G3+ requires exact-form evidence');
          }
          if (verified >= 4) check(asset.geometry.technical_interfaces_verified, 'GEOMETRY_G4_TECHNICAL_EVIDENCE_REQUIRED', `${path}.geometry.technical_interfaces_verified`, 'G4+ requires technical interfaces');
          if (verified >= 5) check(asset.geometry.manufacturing_authority_verified, 'GEOMETRY_G5_MANUFACTURER_AUTHORITY_REQUIRED', `${path}.geometry.manufacturing_authority_verified`, 'G5 requires manufacturer/configurator authority');
        }
      }

      if (strictObject(asset.appearance, `${path}.appearance`, ['state', 'canonical_views_verified', 'materials_verified', 'exact_likeness_verified', 'evidence'])) {
        enumValue(asset.appearance.state, ['UNVERIFIED', 'PROXY_DISCLOSED', 'EXACT_VERIFIED'], 'APPEARANCE_STATE_INVALID', `${path}.appearance.state`);
        boolValue(asset.appearance.canonical_views_verified, 'APPEARANCE_VIEW_FLAG_INVALID', `${path}.appearance.canonical_views_verified`);
        boolValue(asset.appearance.materials_verified, 'APPEARANCE_MATERIAL_FLAG_INVALID', `${path}.appearance.materials_verified`);
        boolValue(asset.appearance.exact_likeness_verified, 'APPEARANCE_EXACT_FLAG_INVALID', `${path}.appearance.exact_likeness_verified`);
        evidence(asset.appearance.evidence, `${path}.appearance.evidence`);
        if (LEVELS.indexOf(asset.geometry?.verified_level) >= 3) {
          check(asset.appearance.state === 'EXACT_VERIFIED' && asset.appearance.canonical_views_verified && asset.appearance.materials_verified && asset.appearance.exact_likeness_verified, 'G3_APPEARANCE_EVIDENCE_REQUIRED', `${path}.appearance`, 'G3+ requires exact appearance and material evidence');
        }
      }

      if (strictObject(asset.rights, `${path}.rights`, ['state', 'display_allowed', 'derivatives_allowed', 'redistribution_allowed', 'evidence'])) {
        enumValue(asset.rights.state, ['UNKNOWN', 'BLOCKED', 'LIMITED', 'CLEARED'], 'RIGHTS_STATE_INVALID', `${path}.rights.state`);
        boolValue(asset.rights.display_allowed, 'RIGHTS_DISPLAY_FLAG_INVALID', `${path}.rights.display_allowed`);
        boolValue(asset.rights.derivatives_allowed, 'RIGHTS_DERIVATIVE_FLAG_INVALID', `${path}.rights.derivatives_allowed`);
        boolValue(asset.rights.redistribution_allowed, 'RIGHTS_REDISTRIBUTION_FLAG_INVALID', `${path}.rights.redistribution_allowed`);
        evidence(asset.rights.evidence, `${path}.rights.evidence`);
        if (LEVELS.indexOf(asset.geometry?.verified_level) >= 2) {
          check(['LIMITED', 'CLEARED'].includes(asset.rights.state) && asset.rights.display_allowed, 'G2_RENDER_RIGHTS_REQUIRED', `${path}.rights`, 'render-ready G2+ requires evidenced display rights');
        }
        if (LEVELS.indexOf(asset.geometry?.verified_level) >= 3) {
          check(asset.rights.state === 'CLEARED' && asset.rights.display_allowed && asset.rights.derivatives_allowed, 'G3_RIGHTS_EVIDENCE_REQUIRED', `${path}.rights`, 'G3+ requires cleared display and derivative rights');
        }
      }

      if (strictObject(asset.attribution, `${path}.attribution`, ['required', 'creator', 'text', 'license_id', 'source_url', 'display_verified', 'evidence'])) {
        boolValue(asset.attribution.required, 'ATTRIBUTION_REQUIRED_FLAG_INVALID', `${path}.attribution.required`);
        boolValue(asset.attribution.display_verified, 'ATTRIBUTION_DISPLAY_FLAG_INVALID', `${path}.attribution.display_verified`);
        if (asset.attribution.required) {
          for (const field of ['creator', 'text', 'license_id', 'source_url']) stringValue(asset.attribution[field], 'ATTRIBUTION_FIELD_REQUIRED', `${path}.attribution.${field}`);
        }
        evidence(asset.attribution.evidence, `${path}.attribution.evidence`);
      }

      if (strictObject(asset.publication, `${path}.publication`, ['state', 'exact_product_claim', 'evidence'])) {
        enumValue(asset.publication.state, ['UNPUBLISHED', 'PLANNING_ONLY', 'PUBLISHABLE'], 'PUBLICATION_STATE_INVALID', `${path}.publication.state`);
        boolValue(asset.publication.exact_product_claim, 'PUBLICATION_EXACT_CLAIM_FLAG_INVALID', `${path}.publication.exact_product_claim`);
        evidence(asset.publication.evidence, `${path}.publication.evidence`);
        if (asset.source_lane === 'DESIGN_ASSET') check(!asset.publication.exact_product_claim, 'DESIGN_ASSET_EXACT_PRODUCT_CLAIM', `${path}.publication.exact_product_claim`, 'Design Assets can never make exact product claims');
        if (asset.publication.state === 'PUBLISHABLE') {
          check(LEVELS.indexOf(asset.geometry?.verified_level) >= 2, 'PUBLISHABLE_GEOMETRY_G2_REQUIRED', `${path}.geometry.verified_level`, 'publication requires independently verified G2+');
          check(asset.rights?.state === 'CLEARED' && asset.rights.display_allowed && asset.rights.redistribution_allowed, 'PUBLISHABLE_RIGHTS_REQUIRED', `${path}.rights`, 'publication requires cleared display and redistribution rights');
          if (asset.attribution?.required) check(asset.attribution.display_verified, 'PUBLISHABLE_ATTRIBUTION_DISPLAY_REQUIRED', `${path}.attribution.display_verified`, 'required attribution must be verified on display surfaces');
        }
        if (asset.publication.exact_product_claim) {
          check(asset.source_lane === 'PRODUCT_TWIN' && asset.identity?.state === 'VERIFIED_PRODUCT', 'EXACT_PRODUCT_IDENTITY_REQUIRED', `${path}.identity`, 'exact product claims require a verified Product Twin identity');
          check(LEVELS.indexOf(asset.geometry?.verified_level) >= 3, 'EXACT_PRODUCT_GEOMETRY_G3_REQUIRED', `${path}.geometry.verified_level`, 'exact visual product claims require G3+');
        }
      }
    });
  }

  const site = manifest.site_evidence;
  if (strictObject(site, 'manifest.site_evidence', ['site_twin_id', 'required_for_release', 'state', 'source_count', 'assertion_count', 'hard_gates_open', 'claims', 'evidence'])) {
    stringValue(site.site_twin_id, 'SITE_TWIN_ID_REQUIRED', 'manifest.site_evidence.site_twin_id');
    boolValue(site.required_for_release, 'SITE_REQUIRED_FLAG_INVALID', 'manifest.site_evidence.required_for_release');
    enumValue(site.state, ['READY', 'BLOCKED'], 'SITE_STATE_INVALID', 'manifest.site_evidence.state');
    intValue(site.source_count, 'SITE_SOURCE_COUNT_INVALID', 'manifest.site_evidence.source_count');
    intValue(site.assertion_count, 'SITE_ASSERTION_COUNT_INVALID', 'manifest.site_evidence.assertion_count');
    if (check(Array.isArray(site.hard_gates_open), 'SITE_HARD_GATES_ARRAY_REQUIRED', 'manifest.site_evidence.hard_gates_open', 'must be an array')) {
      check(unique(site.hard_gates_open).length === site.hard_gates_open.length, 'DUPLICATE_SITE_HARD_GATE', 'manifest.site_evidence.hard_gates_open', 'hard gates must be unique');
      site.hard_gates_open.forEach((gate, index) => check(SITE_GATES.has(gate), 'UNKNOWN_SITE_HARD_GATE', `manifest.site_evidence.hard_gates_open[${index}]`, 'unknown hard gate'));
    }
    const claimFields = ['boundary', 'crs', 'terrain', 'planning_entitlement', 'legal_access', 'sun_and_views'];
    if (strictObject(site.claims, 'manifest.site_evidence.claims', claimFields)) {
      enumValue(site.claims.boundary, ['ABSENT', 'OFFICIAL_VERIFIED'], 'SITE_BOUNDARY_STATE_INVALID', 'manifest.site_evidence.claims.boundary');
      enumValue(site.claims.crs, ['UNRESOLVED', 'VERIFIED'], 'SITE_CRS_STATE_INVALID', 'manifest.site_evidence.claims.crs');
      enumValue(site.claims.terrain, ['ABSENT', 'AUTHORITATIVE_VERIFIED'], 'SITE_TERRAIN_STATE_INVALID', 'manifest.site_evidence.claims.terrain');
      enumValue(site.claims.planning_entitlement, ['UNRESOLVED', 'ENTITLED'], 'SITE_PLANNING_STATE_INVALID', 'manifest.site_evidence.claims.planning_entitlement');
      enumValue(site.claims.legal_access, ['UNRESOLVED', 'LEGAL_VERIFIED'], 'SITE_ACCESS_STATE_INVALID', 'manifest.site_evidence.claims.legal_access');
      enumValue(site.claims.sun_and_views, ['CONDITIONAL', 'VERIFIED'], 'SITE_SUN_VIEW_STATE_INVALID', 'manifest.site_evidence.claims.sun_and_views');
      const open = new Set(site.hard_gates_open || []);
      if (site.claims.boundary === 'OFFICIAL_VERIFIED') check(!open.has('OFFICIAL_CATASTRO_BOUNDARY'), 'SITE_BOUNDARY_GATE_OPEN', 'manifest.site_evidence.claims.boundary', 'official boundary cannot be verified while its hard gate is open');
      if (site.claims.crs === 'VERIFIED') check(!open.has('OFFICIAL_CATASTRO_BOUNDARY') && site.claims.boundary === 'OFFICIAL_VERIFIED', 'SITE_CRS_GATE_OPEN', 'manifest.site_evidence.claims.crs', 'CRS requires the official parcel source');
      if (site.claims.terrain === 'AUTHORITATIVE_VERIFIED') check(!open.has('OFFICIAL_IGN_TERRAIN_VERTICAL_DATUM') && site.claims.crs === 'VERIFIED', 'SITE_TERRAIN_GATE_OPEN', 'manifest.site_evidence.claims.terrain', 'terrain requires official IGN source, vertical datum and verified CRS');
      if (site.claims.planning_entitlement === 'ENTITLED') check(!open.has('CURRENT_PLANNING_CERTIFICATE') && !open.has('GOVERNING_PLANNING_INSTRUMENT'), 'SITE_PLANNING_GATE_OPEN', 'manifest.site_evidence.claims.planning_entitlement', 'planning entitlement cannot be inferred while authority gates are open');
      if (site.claims.legal_access === 'LEGAL_VERIFIED') check(!open.has('A7_BUILDING_LINE_AND_ACCESS') && !open.has('AUTHORITY_CONFIRMED_ENTRANCE'), 'SITE_ACCESS_GATE_OPEN', 'manifest.site_evidence.claims.legal_access', 'legal access cannot be inferred while access gates are open');
      if (site.claims.sun_and_views === 'VERIFIED') check(site.claims.boundary === 'OFFICIAL_VERIFIED' && site.claims.crs === 'VERIFIED' && site.claims.terrain === 'AUTHORITATIVE_VERIFIED' && !open.has('CONTEXT_OBSTRUCTION_SURFACE'), 'SITE_SUN_VIEW_INPUTS_MISSING', 'manifest.site_evidence.claims.sun_and_views', 'verified sun/views require authoritative geometry and obstruction inputs');
      if (site.state === 'READY') check(open.size === 0 && Object.values(site.claims).every((value) => !['ABSENT', 'UNRESOLVED', 'CONDITIONAL'].includes(value)), 'SITE_READY_WITH_OPEN_GATES', 'manifest.site_evidence', 'Site Twin cannot be ready with open gates or unresolved claims');
    }
    evidence(site.evidence, 'manifest.site_evidence.evidence');
    if (site.required_for_release && site.state !== 'READY') readinessBlockers.push(`SITE_EVIDENCE_BLOCKED:${site.site_twin_id}`);
  }

  const room = manifest.room_placement;
  if (strictObject(room, 'manifest.room_placement', ['scene_id', 'required_for_release', 'state', 'source_commit', 'expected_placement_count', 'fallback_consistency_verified', 'collision_state_verified', 'placements', 'evidence'])) {
    stringValue(room.scene_id, 'ROOM_SCENE_ID_REQUIRED', 'manifest.room_placement.scene_id');
    boolValue(room.required_for_release, 'ROOM_REQUIRED_FLAG_INVALID', 'manifest.room_placement.required_for_release');
    enumValue(room.state, ['VERIFIED', 'BLOCKED_MISSING_EXPORTED_MANIFEST', 'BLOCKED_TEST_FAILURE'], 'ROOM_STATE_INVALID', 'manifest.room_placement.state');
    check(/^[0-9a-f]{40}$/.test(room.source_commit), 'ROOM_SOURCE_COMMIT_INVALID', 'manifest.room_placement.source_commit', 'must be a full source commit SHA');
    intValue(room.expected_placement_count, 'ROOM_EXPECTED_COUNT_INVALID', 'manifest.room_placement.expected_placement_count');
    boolValue(room.fallback_consistency_verified, 'ROOM_FALLBACK_FLAG_INVALID', 'manifest.room_placement.fallback_consistency_verified');
    boolValue(room.collision_state_verified, 'ROOM_COLLISION_FLAG_INVALID', 'manifest.room_placement.collision_state_verified');
    if (check(Array.isArray(room.placements), 'ROOM_PLACEMENTS_ARRAY_REQUIRED', 'manifest.room_placement.placements', 'must be an array')) {
      const ids = new Set();
      room.placements.forEach((placement, index) => {
        const path = `manifest.room_placement.placements[${index}]`;
        const fields = ['placement_id', 'source_lane', 'reference_id', 'transform', 'reset_transform', 'fallback_transform', 'collision_state', 'fit_state', 'bundle'];
        if (!strictObject(placement, path, fields)) return;
        stringValue(placement.placement_id, 'PLACEMENT_ID_REQUIRED', `${path}.placement_id`);
        check(!ids.has(placement.placement_id), 'DUPLICATE_PLACEMENT_ID', `${path}.placement_id`, 'placement IDs must be unique');
        ids.add(placement.placement_id);
        enumValue(placement.source_lane, ['PRODUCT_TWIN', 'DESIGN_ASSET'], 'PLACEMENT_SOURCE_LANE_INVALID', `${path}.source_lane`);
        stringValue(placement.reference_id, 'PLACEMENT_REFERENCE_REQUIRED', `${path}.reference_id`);
        if (placement.source_lane === 'PRODUCT_TWIN') check(placement.reference_id.startsWith('PT_'), 'PLACEMENT_PRODUCT_TWIN_REFERENCE_INVALID', `${path}.reference_id`, 'Product Twin placements must reference PT_*');
        if (placement.source_lane === 'DESIGN_ASSET') check(placement.reference_id.startsWith('DA_'), 'PLACEMENT_DESIGN_ASSET_REFERENCE_INVALID', `${path}.reference_id`, 'Design Asset placements must reference DA_*');
        for (const name of ['transform', 'reset_transform', 'fallback_transform']) {
          const transform = placement[name];
          if (strictObject(transform, `${path}.${name}`, ['position_m', 'rotation_deg'])) {
            check(Array.isArray(transform.position_m) && transform.position_m.length === 3 && transform.position_m.every(isFiniteNumber), 'PLACEMENT_POSITION_INVALID', `${path}.${name}.position_m`, 'must contain three finite metre coordinates');
            check(Array.isArray(transform.rotation_deg) && transform.rotation_deg.length === 3 && transform.rotation_deg.every(isFiniteNumber), 'PLACEMENT_ROTATION_INVALID', `${path}.${name}.rotation_deg`, 'must contain three finite degree rotations');
          }
        }
        check(sameTransform(placement.transform, placement.fallback_transform), 'ROOM_FALLBACK_TRANSFORM_MISMATCH', `${path}.fallback_transform`, 'fallback and WebGL transforms must match');
        enumValue(placement.collision_state, ['CLEAR', 'COLLISION', 'UNVERIFIED'], 'PLACEMENT_COLLISION_STATE_INVALID', `${path}.collision_state`);
        enumValue(placement.fit_state, ['INSIDE', 'COLLISION', 'OUTSIDE', 'UNVERIFIED'], 'PLACEMENT_FIT_STATE_INVALID', `${path}.fit_state`);
        if (placement.collision_state === 'CLEAR') check(placement.fit_state === 'INSIDE', 'PLACEMENT_CLEAR_BUT_NOT_INSIDE', path, 'clear placement must be inside the room');
        if (strictObject(placement.bundle, `${path}.bundle`, ['bundle_id', 'item_quantity', 'visible_avatar_count'])) {
          check(placement.bundle.bundle_id === null || isNonEmptyString(placement.bundle.bundle_id), 'PLACEMENT_BUNDLE_ID_INVALID', `${path}.bundle.bundle_id`, 'must be null or a non-empty string');
          intValue(placement.bundle.item_quantity, 'PLACEMENT_BUNDLE_QUANTITY_INVALID', `${path}.bundle.item_quantity`, 1);
          intValue(placement.bundle.visible_avatar_count, 'PLACEMENT_VISIBLE_AVATAR_COUNT_INVALID', `${path}.bundle.visible_avatar_count`, 1);
          check(placement.bundle.visible_avatar_count >= placement.bundle.item_quantity, 'PLACEMENT_BUNDLE_COUNT_INCONSISTENT', `${path}.bundle`, 'visible avatar count cannot be lower than item quantity');
        }
      });
      if (room.state === 'VERIFIED') {
        check(room.placements.length > 0 && room.placements.length === room.expected_placement_count, 'ROOM_PLACEMENT_COUNT_MISMATCH', 'manifest.room_placement.placements', 'verified room placement count must match the exported manifest');
        check(room.fallback_consistency_verified, 'ROOM_FALLBACK_NOT_VERIFIED', 'manifest.room_placement.fallback_consistency_verified', 'verified room requires fallback/WebGL consistency');
        check(room.collision_state_verified && room.placements.every((item) => item.collision_state === 'CLEAR' && item.fit_state === 'INSIDE'), 'ROOM_COLLISION_NOT_VERIFIED', 'manifest.room_placement', 'verified room requires deterministic clear/inside state for every placement');
      }
    }
    evidence(room.evidence, 'manifest.room_placement.evidence');
    if (room.required_for_release && room.state !== 'VERIFIED') readinessBlockers.push(`ROOM_PLACEMENT_BLOCKED:${room.scene_id}`);
  }

  if (check(Array.isArray(manifest.market_supply), 'MARKET_SUPPLY_ARRAY_REQUIRED', 'manifest.market_supply', 'must be an array')) {
    const marketDestinations = new Set();
    manifest.market_supply.forEach((supply, index) => {
      const path = `manifest.market_supply[${index}]`;
      const fields = ['supply_id', 'required_for_release', 'market', 'destination', 'claim_state', 'current_claim', 'coverage', 'local_supplier_claim', 'seller_or_dispatch_country', 'conditional_substitution', 'evidence'];
      if (!strictObject(supply, path, fields)) return;
      stringValue(supply.supply_id, 'SUPPLY_ID_REQUIRED', `${path}.supply_id`);
      boolValue(supply.required_for_release, 'SUPPLY_REQUIRED_FLAG_INVALID', `${path}.required_for_release`);
      stringValue(supply.market, 'SUPPLY_MARKET_REQUIRED', `${path}.market`);
      destination(supply.destination, `${path}.destination`);
      check(supply.market === supply.destination?.country, 'MARKET_DESTINATION_COUNTRY_MISMATCH', `${path}.destination.country`, 'market and destination country must match');
      const marketKey = `${supply.market}:${supply.destination?.postal_code}`;
      check(!marketDestinations.has(marketKey), 'DUPLICATE_MARKET_DESTINATION', path, 'market/destination evidence must not be duplicated');
      marketDestinations.add(marketKey);
      enumValue(supply.claim_state, ['CURRENT', 'OBSERVED_REFRESH_REQUIRED', 'STALE', 'UNKNOWN'], 'SUPPLY_CLAIM_STATE_INVALID', `${path}.claim_state`);
      boolValue(supply.current_claim, 'SUPPLY_CURRENT_FLAG_INVALID', `${path}.current_claim`);
      if (strictObject(supply.coverage, `${path}.coverage`, ['confirmed_deliverable_percentage', 'confirmed_unavailable_percentage'])) {
        check(isFiniteNumber(supply.coverage.confirmed_deliverable_percentage) && supply.coverage.confirmed_deliverable_percentage >= 0 && supply.coverage.confirmed_deliverable_percentage <= 100, 'SUPPLY_DELIVERABLE_PERCENT_INVALID', `${path}.coverage.confirmed_deliverable_percentage`, 'must be between 0 and 100');
        check(isFiniteNumber(supply.coverage.confirmed_unavailable_percentage) && supply.coverage.confirmed_unavailable_percentage >= 0 && supply.coverage.confirmed_unavailable_percentage <= 100, 'SUPPLY_UNAVAILABLE_PERCENT_INVALID', `${path}.coverage.confirmed_unavailable_percentage`, 'must be between 0 and 100');
        check(supply.coverage.confirmed_deliverable_percentage + supply.coverage.confirmed_unavailable_percentage <= 100, 'SUPPLY_COVERAGE_EXCEEDS_100', `${path}.coverage`, 'coverage buckets cannot exceed 100%');
      }
      boolValue(supply.local_supplier_claim, 'LOCAL_SUPPLIER_FLAG_INVALID', `${path}.local_supplier_claim`);
      check(supply.seller_or_dispatch_country === null || isNonEmptyString(supply.seller_or_dispatch_country), 'SELLER_DISPATCH_COUNTRY_INVALID', `${path}.seller_or_dispatch_country`, 'must be null or a country code');
      if (supply.local_supplier_claim) check(supply.seller_or_dispatch_country === supply.destination?.country, 'LOCAL_SUPPLIER_ORIGIN_UNPROVEN', `${path}.seller_or_dispatch_country`, 'local supplier requires seller or dispatch origin in the destination country');
      if (strictObject(supply.conditional_substitution, `${path}.conditional_substitution`, ['approved', 'counted_as_current', 'current_percentage', 'conditional_percentage'])) {
        boolValue(supply.conditional_substitution.approved, 'SUBSTITUTION_APPROVAL_FLAG_INVALID', `${path}.conditional_substitution.approved`);
        boolValue(supply.conditional_substitution.counted_as_current, 'SUBSTITUTION_CURRENT_FLAG_INVALID', `${path}.conditional_substitution.counted_as_current`);
        check(isFiniteNumber(supply.conditional_substitution.current_percentage), 'SUBSTITUTION_CURRENT_PERCENT_INVALID', `${path}.conditional_substitution.current_percentage`, 'must be numeric');
        check(isFiniteNumber(supply.conditional_substitution.conditional_percentage), 'SUBSTITUTION_CONDITIONAL_PERCENT_INVALID', `${path}.conditional_substitution.conditional_percentage`, 'must be numeric');
        if (!supply.conditional_substitution.approved) check(!supply.conditional_substitution.counted_as_current, 'UNAPPROVED_SUBSTITUTION_COUNTED_CURRENT', `${path}.conditional_substitution`, 'unapproved substitution cannot count as current coverage');
      }
      evidence(supply.evidence, `${path}.evidence`, {expectedMarket: supply.market, expectedDestination: supply.destination});
      if (supply.current_claim) {
        check(supply.claim_state === 'CURRENT' && supply.evidence?.freshness_state === 'CURRENT', 'STALE_SUPPLY_MARKED_CURRENT', path, 'current supply requires unexpired CURRENT evidence');
      } else {
        check(supply.claim_state !== 'CURRENT', 'CURRENT_SUPPLY_FLAG_MISMATCH', `${path}.claim_state`, 'CURRENT claim state requires current_claim=true');
      }
      if (supply.required_for_release && !supply.current_claim) readinessBlockers.push(`MARKET_SUPPLY_NOT_CURRENT:${marketKey}`);
    });
  }

  const procurement = manifest.procurement_readiness;
  if (strictObject(procurement, 'manifest.procurement_readiness', ['contract_id', 'required_for_release', 'state', 'ready', 'destination', 'gates', 'evidence'])) {
    stringValue(procurement.contract_id, 'PROCUREMENT_CONTRACT_ID_REQUIRED', 'manifest.procurement_readiness.contract_id');
    boolValue(procurement.required_for_release, 'PROCUREMENT_REQUIRED_FLAG_INVALID', 'manifest.procurement_readiness.required_for_release');
    enumValue(procurement.state, ['READY', 'BLOCKED'], 'PROCUREMENT_STATE_INVALID', 'manifest.procurement_readiness.state');
    boolValue(procurement.ready, 'PROCUREMENT_READY_FLAG_INVALID', 'manifest.procurement_readiness.ready');
    destination(procurement.destination, 'manifest.procurement_readiness.destination');
    if (strictObject(procurement.gates, 'manifest.procurement_readiness.gates', PROCUREMENT_GATES)) {
      for (const gate of PROCUREMENT_GATES) boolValue(procurement.gates[gate], 'PROCUREMENT_GATE_FLAG_INVALID', `manifest.procurement_readiness.gates.${gate}`);
      if (procurement.ready) check(PROCUREMENT_GATES.every((gate) => procurement.gates[gate] === true), 'PREMATURE_PROCUREMENT_READY', 'manifest.procurement_readiness.gates', 'procurement readiness requires every independent gate');
    }
    check(procurement.ready === (procurement.state === 'READY'), 'PROCUREMENT_STATE_FLAG_MISMATCH', 'manifest.procurement_readiness', 'state and ready flag must agree');
    evidence(procurement.evidence, 'manifest.procurement_readiness.evidence', {expectedMarket: procurement.destination?.country, expectedDestination: procurement.destination});
    if (procurement.ready) check(procurement.evidence?.freshness_state === 'CURRENT', 'PROCUREMENT_READY_WITHOUT_CURRENT_EVIDENCE', 'manifest.procurement_readiness.evidence', 'procurement readiness requires current destination evidence');
    if (procurement.required_for_release && !procurement.ready) readinessBlockers.push(`PROCUREMENT_NOT_READY:${procurement.contract_id}`);
  }

  const deployment = manifest.deployment_state;
  if (strictObject(deployment, 'manifest.deployment_state', ['required_for_release', 'state', 'current_claim', 'platform', 'project_id', 'version_number', 'version_id', 'deployment_id', 'source_commit', 'url', 'evidence'])) {
    boolValue(deployment.required_for_release, 'DEPLOYMENT_REQUIRED_FLAG_INVALID', 'manifest.deployment_state.required_for_release');
    enumValue(deployment.state, ['SUCCEEDED', 'FAILED', 'UNKNOWN'], 'DEPLOYMENT_STATE_INVALID', 'manifest.deployment_state.state');
    boolValue(deployment.current_claim, 'DEPLOYMENT_CURRENT_FLAG_INVALID', 'manifest.deployment_state.current_claim');
    stringValue(deployment.platform, 'DEPLOYMENT_PLATFORM_REQUIRED', 'manifest.deployment_state.platform');
    stringValue(deployment.project_id, 'DEPLOYMENT_PROJECT_ID_REQUIRED', 'manifest.deployment_state.project_id');
    intValue(deployment.version_number, 'DEPLOYMENT_VERSION_INVALID', 'manifest.deployment_state.version_number', 1);
    stringValue(deployment.version_id, 'DEPLOYMENT_VERSION_ID_REQUIRED', 'manifest.deployment_state.version_id');
    stringValue(deployment.deployment_id, 'DEPLOYMENT_ID_REQUIRED', 'manifest.deployment_state.deployment_id');
    check(/^[0-9a-f]{40}$/.test(deployment.source_commit), 'DEPLOYMENT_SOURCE_COMMIT_INVALID', 'manifest.deployment_state.source_commit', 'must be a full source commit SHA');
    check(isNonEmptyString(deployment.url) && /^https:\/\//.test(deployment.url), 'DEPLOYMENT_URL_INVALID', 'manifest.deployment_state.url', 'must be an HTTPS URL');
    evidence(deployment.evidence, 'manifest.deployment_state.evidence');
    if (deployment.current_claim) check(deployment.state === 'SUCCEEDED' && deployment.evidence?.freshness_state === 'CURRENT', 'DEPLOYMENT_CURRENT_CLAIM_UNSUPPORTED', 'manifest.deployment_state', 'current deployment claim requires a succeeded status and unexpired current evidence');
    if (deployment.required_for_release && !(deployment.state === 'SUCCEEDED' && deployment.current_claim)) readinessBlockers.push(`DEPLOYMENT_NOT_CURRENT:${deployment.project_id}`);
  }

  const computedBlockers = sorted(unique(readinessBlockers));
  const releaseDecision = computedBlockers.length === 0 ? 'READY' : 'BLOCKED';
  check(manifest.release_state === releaseDecision, 'RELEASE_STATE_MISMATCH', 'manifest.release_state', `declared release state must be ${releaseDecision}`);
  check(sameStringSet(manifest.release_blockers, computedBlockers), 'RELEASE_BLOCKERS_MISMATCH', 'manifest.release_blockers', 'declared blockers must exactly match deterministic readiness blockers');
  check(unique(manifest.release_blockers || []).length === (manifest.release_blockers || []).length, 'DUPLICATE_RELEASE_BLOCKER', 'manifest.release_blockers', 'release blockers must be unique');

  return {
    status: issues.length === 0 ? 'PASS' : 'FAIL',
    release_decision: releaseDecision,
    checks_total: checksTotal,
    checks_passed: checksTotal - issues.length,
    block_reasons: computedBlockers,
    issues,
  };
}

export const compositeReleaseConstants = {
  LEVELS,
  PROCUREMENT_GATES,
  SITE_GATES: [...SITE_GATES],
};
