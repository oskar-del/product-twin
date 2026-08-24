import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {FILES, LOCAL_SUPPLY_RADIUS_KM, SUPPLY_CLASSES} from './build-living-room-procurement-plan.mjs';

const ROOT = process.cwd();
const SCHEMA_FILE = 'config/project-procurement-plan.schema.json';
const round = (value, places = 2) => Number(value.toFixed(places));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const unique = (values) => new Set(values).size === values.length;
const hashObject = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ROLE_MAP = {
  sofa: {specificationRole: 'FFE.SEATING.SOFA', subpackageId: 'SUBPKG_FFE_SEATING'},
  armchair: {specificationRole: 'FFE.SEATING.ARMCHAIR', subpackageId: 'SUBPKG_FFE_SEATING'},
  coffee_table: {specificationRole: 'FFE.TABLE.COFFEE', subpackageId: 'SUBPKG_FFE_TABLES'},
  side_table: {specificationRole: 'FFE.TABLE.SIDE', subpackageId: 'SUBPKG_FFE_TABLES'},
  floor_lamp: {specificationRole: 'ELECTRICAL.LUMINAIRES.FLOOR_LAMP', subpackageId: 'SUBPKG_FFE_LIGHTING'},
  rug: {specificationRole: 'FFE.SOFT_FURNISHINGS.RUG', subpackageId: 'SUBPKG_FFE_SOFT_FURNISHINGS'},
  media_unit: {specificationRole: 'FFE.STORAGE.MEDIA_UNIT', subpackageId: 'SUBPKG_FFE_STORAGE'},
  bookcase: {specificationRole: 'FFE.STORAGE.BOOKCASE', subpackageId: 'SUBPKG_FFE_STORAGE'}
};

function parseDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function articleNumberForTwin(twinId) {
  const digits = String(twinId).match(/(\d{8})$/)?.[1];
  return digits ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}` : null;
}

function resolveRef(rootSchema, ref) {
  if (!ref.startsWith('#/')) throw new Error(`Only local schema references are supported: ${ref}`);
  return ref.slice(2).split('/').reduce((value, key) => value?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], rootSchema);
}

function matchesType(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isObject(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

export function validateJsonSchema(value, schema, rootSchema = schema, valuePath = '$', errors = []) {
  if (schema.$ref) return validateJsonSchema(value, resolveRef(rootSchema, schema.$ref), rootSchema, valuePath, errors);
  if (Object.hasOwn(schema, 'const') && value !== schema.const) errors.push(`${valuePath} must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((item) => item === value)) errors.push(`${valuePath} must be one of ${schema.enum.join(', ')}`);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => matchesType(value, type))) {
      errors.push(`${valuePath} must have type ${types.join(' or ')}`);
      return errors;
    }
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${valuePath} must contain at least ${schema.minLength} characters`);
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) errors.push(`${valuePath} must match ${schema.pattern}`);
    if (schema.format === 'date-time' && Number.isNaN(new Date(value).valueOf())) errors.push(`${valuePath} must be a valid date-time`);
    if (schema.format === 'uri') {
      try { new URL(value); } catch { errors.push(`${valuePath} must be a valid URI`); }
    }
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${valuePath} must be >= ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${valuePath} must be <= ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${valuePath} must contain at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${valuePath} must contain no more than ${schema.maxItems} items`);
    if (schema.uniqueItems) {
      const serialized = value.map((item) => JSON.stringify(item));
      if (new Set(serialized).size !== serialized.length) errors.push(`${valuePath} must contain unique items`);
    }
    if (schema.items) value.forEach((item, index) => validateJsonSchema(item, schema.items, rootSchema, `${valuePath}[${index}]`, errors));
  }
  if (isObject(value)) {
    for (const required of schema.required ?? []) if (!Object.hasOwn(value, required)) errors.push(`${valuePath}.${required} is required`);
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties?.[key]) validateJsonSchema(child, schema.properties[key], rootSchema, `${valuePath}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${valuePath}.${key} is not allowed`);
    }
  }
  return errors;
}

function evidenceStateAt(evidence, asOf) {
  if (evidence.live_refresh_required) return 'REFRESH_REQUIRED';
  if (!evidence.observed_at || !evidence.expires_at) return 'UNKNOWN';
  const observedAt = new Date(evidence.observed_at);
  const expiresAt = new Date(evidence.expires_at);
  if (Number.isNaN(observedAt.valueOf()) || Number.isNaN(expiresAt.valueOf())) return 'UNKNOWN';
  if (observedAt.valueOf() > asOf.valueOf() || expiresAt.valueOf() < observedAt.valueOf()) return 'UNKNOWN';
  return asOf.valueOf() <= expiresAt.valueOf() ? 'CURRENT' : 'EXPIRED';
}

function leadTime(delivery) {
  const min = delivery?.lead_time_days_min;
  const max = delivery?.lead_time_days_max;
  return Number.isInteger(min) && Number.isInteger(max) && min >= 0 && max >= min ? {min, max} : null;
}

function deriveSupplyClass(primary, destination, asOf) {
  if (evidenceStateAt(primary.evidence, asOf) !== 'CURRENT') return 'UNVERIFIED';
  const delivery = primary.delivery;
  const routeMatch = delivery.country === destination.country && delivery.postal_code === destination.postal_code;
  if (routeMatch && delivery.destination_state === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (!routeMatch || delivery.destination_state !== 'AVAILABLE' || delivery.exact_destination_confirmed !== true) return 'UNVERIFIED';
  const local = primary.seller.locality_state === 'LOCAL_CONFIRMED'
    && primary.seller.locality_evidence.state === 'VERIFIED_LOCAL_LOCATION'
    && primary.seller.locality_evidence.origin_location?.country === destination.country
    && Boolean(primary.seller.locality_evidence.source_ref)
    && Number.isFinite(primary.seller.locality_evidence.distance_km)
    && primary.seller.locality_evidence.distance_km <= destination.local_supply_radius_km;
  if (local) return 'LOCAL';
  const lead = leadTime(delivery);
  if (!lead) return 'UNVERIFIED';
  return lead.max <= 10 ? 'CONFIRMED_WITHIN_10_DAYS' : 'CONFIRMED_BEYOND_10_DAYS';
}

function expectedApprovalState(value) {
  if (value === 'PASS' || value === 'APPROVED') return 'PASS';
  if (value === 'REQUIRED') return 'BLOCKED';
  return 'REVIEW';
}

function assertExactGates(actual, expected, label, errors) {
  const actualIds = actual.map((item) => item.gate);
  const expectedIds = Object.keys(expected);
  if (!unique(actualIds)) errors.push(`${label} gate IDs must be unique`);
  if (!sameJson(actualIds, expectedIds)) errors.push(`${label} must contain the exact gate set in canonical order: ${expectedIds.join(', ')}`);
  for (const [gateId, expectation] of Object.entries(expected)) {
    const gate = actual.find((item) => item.gate === gateId);
    if (!gate) continue;
    if (gate.state !== expectation.state) errors.push(`${label}.${gateId} state must be derived as ${expectation.state}`);
    if (gate.critical !== expectation.critical) errors.push(`${label}.${gateId} critical must be ${expectation.critical}`);
  }
}

function findMutablePayloads(value, valuePath = '$', matches = []) {
  if (Array.isArray(value)) value.forEach((item, index) => findMutablePayloads(item, `${valuePath}[${index}]`, matches));
  else if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (key !== 'mutable_checkout_payloads_embedded' && /(checkout|cart|order).*(payload|token|session|id)/i.test(key)) matches.push(`${valuePath}.${key}`);
      findMutablePayloads(child, `${valuePath}.${key}`, matches);
    }
  }
  return matches;
}

function expectedSeller(offer, destination) {
  const origin = offer.dispatch_country ?? offer.seller_country ?? null;
  const localityEvidence = offer.locality_evidence ?? {state: 'UNRESOLVED', source_ref: null, origin_location: null, distance_km: null};
  const localityState = localityEvidence.state === 'VERIFIED_LOCAL_LOCATION'
    && localityEvidence.origin_location?.country === destination.country
    && localityEvidence.source_ref
    && Number.isFinite(localityEvidence.distance_km)
    && localityEvidence.distance_km <= destination.local_supply_radius_km
    ? 'LOCAL_CONFIRMED'
    : localityEvidence.state === 'VERIFIED_NON_LOCAL_LOCATION'
      ? 'NON_LOCAL_CONFIRMED'
      : origin
        ? 'COUNTRY_ONLY_LOCALITY_UNRESOLVED'
        : 'ORIGIN_UNRESOLVED';
  return {
    seller_id: offer.seller_id,
    seller_name: offer.seller_name,
    retailer_territory_country: offer.retailer_territory_country ?? null,
    seller_country: offer.seller_country ?? null,
    dispatch_country: offer.dispatch_country ?? null,
    locality_state: localityState,
    locality_evidence: localityEvidence
  };
}

function validateSessionSource({design, evidence, session}, errors) {
  if (session.destination?.country !== design.destination.country || session.destination?.postal_code !== design.destination.postal_code) errors.push('Session destination must match the frozen design destination');
  const offerByRef = new Map(evidence.offers.map((offer) => [offer.offer_ref, offer]));
  const sessionProducts = session.exact_room_products ?? [];
  const sessionByTwin = new Map(sessionProducts.map((product) => [product.twin_id, product]));
  if (sessionByTwin.size !== sessionProducts.length) errors.push('Session exact_room_products must have unique twin IDs');
  if (sessionProducts.length !== design.placements.length) errors.push('Session product membership must match every frozen placement line');
  let availableCount = 0;
  let unavailableCount = 0;
  let availableSubtotal = 0;
  let totalSubtotal = 0;
  const currencies = new Set();
  for (const placement of design.placements) {
    const offer = offerByRef.get(placement.offer_ref);
    const sessionProduct = sessionByTwin.get(placement.twin_id);
    if (!offer || !sessionProduct) {
      errors.push(`Session is missing exact source evidence for ${placement.twin_id}`);
      continue;
    }
    if (sessionProduct.article_no !== articleNumberForTwin(placement.twin_id)) errors.push(`Session article number does not match Product Twin identity for ${placement.twin_id}`);
    const sessionQuantity = sessionProduct.quantity ?? 1;
    if (sessionQuantity !== placement.quantity) errors.push(`Session quantity does not match frozen placement quantity for ${placement.twin_id}`);
    if (Number(sessionProduct.price?.amount) !== Number(offer.price?.amount) || sessionProduct.price?.currency !== offer.price?.currency) errors.push(`Session price does not match offer evidence for ${placement.twin_id}`);
    currencies.add(offer.price.currency);
    totalSubtotal += Number(offer.price.amount) * placement.quantity;
    if (sessionProduct.home_delivery_29660 === 'AVAILABLE') {
      availableCount += 1;
      availableSubtotal += Number(offer.price.amount) * placement.quantity;
      if (offer.delivery.destination_state !== 'AVAILABLE' || offer.delivery.exact_destination_confirmed !== true) errors.push(`Session availability does not match offer evidence for ${placement.twin_id}`);
    } else {
      unavailableCount += 1;
      if (offer.delivery.destination_state !== 'UNAVAILABLE') errors.push(`Session unavailability does not match offer evidence for ${placement.twin_id}`);
    }
  }
  const coverage = session.coverage_result ?? {};
  const placedUnits = design.placements.reduce((sum, placement) => sum + placement.quantity, 0);
  if (coverage.placement_lines !== design.placements.length || coverage.placed_units !== placedUnits) errors.push('Session design counts do not reconcile');
  if (coverage.destination_delivery_available_lines !== availableCount || coverage.destination_unavailable_lines !== unavailableCount) errors.push('Session availability counts do not reconcile');
  if (Number(coverage.seven_available_exact_products_subtotal?.amount) !== round(availableSubtotal)) errors.push('Session available subtotal does not reconcile');
  if (Number(coverage.all_eight_current_product_page_subtotal?.amount) !== round(totalSubtotal)) errors.push('Session specified subtotal does not reconcile');
  if (currencies.size !== 1) errors.push('Session must have one merchandise currency');
  const [currency] = currencies;
  if (coverage.seven_available_exact_products_subtotal?.currency !== currency || coverage.all_eight_current_product_page_subtotal?.currency !== currency) errors.push('Session subtotal currency does not reconcile');
  const cart = session.combined_cart_evidence ?? {};
  const cartDelivery = cart.home_delivery_29660 ?? {};
  if (cart.exact_room_products_in_cart !== availableCount || cartDelivery.state !== 'AVAILABLE') errors.push('Session combined-cart count or state does not reconcile');
  if (cartDelivery.standard_delivery_charge?.currency !== currency || cartDelivery.IKEA_Family_or_Business_delivery_charge?.currency !== currency) errors.push('Session freight currency must match merchandise currency');
  const deliveryDateMin = parseDateOnly(cartDelivery.delivery_date_min);
  const deliveryDateMax = parseDateOnly(cartDelivery.delivery_date_max);
  if (!deliveryDateMin || !deliveryDateMax || deliveryDateMax.valueOf() < deliveryDateMin.valueOf()) errors.push('Session delivery dates must be valid, ordered ISO calendar dates');
}

function validateSourceLineage(plan, sourceData, errors) {
  if (!sourceData?.design || !sourceData?.evidence || !sourceData?.session) {
    errors.push('Deterministic validation requires the design, offer and session source data');
    return;
  }
  const {design, evidence, session} = sourceData;
  const expectedRefs = {
    design: {path: FILES.design, version: design.version, identity: design.design_id, sha256: hashObject(design)},
    offer_evidence: {path: FILES.offers, version: evidence.version, identity: evidence.design_id, sha256: hashObject(evidence)},
    session_evidence: {path: FILES.session, version: session.observed_at, identity: session.session_id, sha256: hashObject(session)}
  };
  for (const [key, expected] of Object.entries(expectedRefs)) if (!sameJson(plan.source_snapshot[key], expected)) errors.push(`source_snapshot.${key} must match its canonical source identity and hash`);
  if (plan.source_snapshot.approval_evidence !== null) errors.push('Line procurement approval cannot be claimed without a canonical hashed approval source');
  if (plan.source_snapshot.site_access_evidence !== null) errors.push('Site access cannot be claimed without a canonical hashed site-access source');
  if (evidence.design_id !== design.design_id || plan.destination.country !== design.destination.country || plan.destination.postal_code !== design.destination.postal_code) errors.push('Design, evidence and plan destination identities must match');
  if (plan.destination.local_supply_radius_km !== LOCAL_SUPPLY_RADIUS_KM) errors.push(`Destination local-supply radius must use the explicit ${LOCAL_SUPPLY_RADIUS_KM} km policy`);
  if (plan.destination.site_access_state !== 'UNVERIFIED') errors.push('Site access must remain UNVERIFIED while no canonical site-access source is attached');
  validateSessionSource(sourceData, errors);

  const sourceHasTransforms = design.placements.every((placement) => isObject(placement.transform));
  const sourceHasBundles = design.placements.every((placement) => Object.hasOwn(placement, 'bundle'));
  const sourceComplete = sourceHasTransforms && sourceHasBundles;
  const snapshot = plan.source_snapshot.placement_snapshot;
  if (snapshot.state !== (sourceComplete ? 'COMPLETE' : 'IDENTITY_QUANTITY_ONLY')) errors.push('Placement snapshot state must be derived from the hashed design source');
  if (snapshot.transforms_included !== sourceHasTransforms || snapshot.bundle_membership_included !== sourceHasBundles) errors.push('Placement snapshot completeness flags must match the hashed design source');
  if (sourceComplete && snapshot.missing_inputs.length) errors.push('A complete placement snapshot cannot list missing inputs');
  if (!sourceComplete && snapshot.missing_inputs.length === 0) errors.push('An incomplete placement snapshot must list missing inputs');

  const placementById = new Map(design.placements.map((placement) => [placement.placement_id, placement]));
  const offerByRef = new Map(evidence.offers.map((offer) => [offer.offer_ref, offer]));
  const candidateById = new Map((evidence.substitution_candidates ?? []).map((candidate) => [candidate.substitution_id, candidate]));
  if (plan.line_items.length !== design.placements.length) errors.push('Plan line items must exactly match the frozen design placements');
  const generatedAt = new Date(plan.generated_at);
  for (const line of plan.line_items) {
    const placement = placementById.get(line.placement_id);
    if (!placement) {
      errors.push(`${line.line_item_id} has no frozen source placement`);
      continue;
    }
    if (line.line_item_id !== `LINE_${placement.placement_id}` || line.role !== placement.role || line.quantity !== placement.quantity) errors.push(`${line.line_item_id} identity, role or quantity does not match its frozen placement`);
    const mappedRole = ROLE_MAP[placement.role];
    if (!mappedRole || line.generic_specification_role !== mappedRole.specificationRole) errors.push(`${line.line_item_id} generic specification role does not match the canonical role map`);
    if (line.approval_state !== 'SPECIFIED_NOT_PROCUREMENT_APPROVED') errors.push(`${line.line_item_id} cannot claim procurement approval without a canonical hashed approval source`);
    if (!sourceHasBundles && line.bundle.state !== 'BUNDLE_MEMBERSHIP_UNVERIFIED') errors.push(`${line.line_item_id} cannot claim bundle completeness without source bundle data`);
    const primary = line.primary_product;
    const offer = offerByRef.get(placement.offer_ref);
    if (!offer) {
      errors.push(`${line.line_item_id} has no canonical source offer`);
      continue;
    }
    if (primary.twin_id !== placement.twin_id || primary.avatar_id !== placement.avatar_id || primary.selected_configuration !== placement.selected_configuration || primary.offer_ref !== placement.offer_ref) errors.push(`${line.line_item_id} primary product does not match the frozen placement`);
    if (primary.identity_state !== (offer.identity_state === 'EXACT_RETAIL_ARTICLE_VERIFIED' ? 'EXACT_RETAIL_ARTICLE_VERIFIED' : 'UNVERIFIED')) errors.push(`${line.line_item_id} identity_state does not match offer evidence`);
    if (primary.unit_price.amount !== Number(offer.price.amount) || primary.unit_price.currency !== offer.price.currency) errors.push(`${line.line_item_id} unit price does not match offer evidence`);
    if (!sameJson(primary.seller, expectedSeller(offer, plan.destination))) errors.push(`${line.line_item_id} seller/locality evidence does not match the canonical offer`);
    const expectedDelivery = {
      country: offer.delivery.country,
      postal_code: offer.delivery.postal_code,
      destination_state: offer.delivery.destination_state,
      exact_destination_confirmed: offer.delivery.exact_destination_confirmed === true,
      lead_time_days_min: Number.isInteger(offer.delivery.lead_time_days_min) ? offer.delivery.lead_time_days_min : null,
      lead_time_days_max: Number.isInteger(offer.delivery.lead_time_days_max) ? offer.delivery.lead_time_days_max : null,
      window_source: offer.delivery.window_source ?? null
    };
    for (const [key, value] of Object.entries(expectedDelivery)) if (primary.delivery[key] !== value) errors.push(`${line.line_item_id} delivery.${key} does not match offer evidence`);
    const expectedEvidence = {
      source_ref: `${FILES.offers}#${offer.offer_ref}`,
      source_uri: offer.product_url,
      observed_at: offer.observed_at,
      expires_at: offer.expires_at ?? null,
      live_refresh_required: offer.live_refresh_required === true,
      refresh_before_purchase: offer.refresh_before_purchase === true
    };
    for (const [key, value] of Object.entries(expectedEvidence)) if (primary.evidence[key] !== value) errors.push(`${line.line_item_id} evidence.${key} does not match the canonical offer`);
    const expectedFreshness = evidenceStateAt({...expectedEvidence, freshness_state: primary.evidence.freshness_state}, generatedAt);
    if (primary.evidence.freshness_state !== expectedFreshness) errors.push(`${line.line_item_id} evidence freshness is not derived from source observation and expiry`);
    if (primary.supply_class !== deriveSupplyClass(primary, plan.destination, generatedAt)) errors.push(`${line.line_item_id} supply_class is not derived from source delivery, locality and freshness`);

    const expectedCandidates = (evidence.substitution_candidates ?? []).filter((candidate) => candidate.source_placement_id === placement.placement_id && offerByRef.has(candidate.alternative_offer_ref));
    if (line.alternatives.length !== expectedCandidates.length) errors.push(`${line.line_item_id} alternatives do not match executable source candidates`);
    for (const alternative of line.alternatives) {
      const candidate = candidateById.get(alternative.substitution_id);
      const alternativeOffer = candidate ? offerByRef.get(candidate.alternative_offer_ref) : null;
      if (!candidate || !alternativeOffer || candidate.source_placement_id !== placement.placement_id) {
        errors.push(`${alternative.substitution_id} has no matching source candidate and offer`);
        continue;
      }
      if (alternative.twin_id !== candidate.alternative_twin_id || alternative.avatar_id !== (candidate.alternative_avatar_id ?? null) || alternative.selected_configuration !== (candidate.alternative_configuration ?? null) || alternative.offer_ref !== candidate.alternative_offer_ref) errors.push(`${alternative.substitution_id} identity does not match source candidate`);
      if (alternative.identity_state !== (alternativeOffer.identity_state === 'EXACT_RETAIL_ARTICLE_VERIFIED' ? 'EXACT_RETAIL_ARTICLE_VERIFIED' : 'UNVERIFIED')) errors.push(`${alternative.substitution_id} identity_state does not match offer evidence`);
      if (alternative.unit_price.amount !== Number(alternativeOffer.price.amount) || alternative.unit_price.currency !== alternativeOffer.price.currency) errors.push(`${alternative.substitution_id} price does not match source offer`);
      if (alternativeOffer.price.currency !== plan.currency) errors.push(`${alternative.substitution_id} source currency must match the destination plan currency`);
      if (alternativeOffer.delivery.country !== plan.destination.country || alternativeOffer.delivery.postal_code !== plan.destination.postal_code) errors.push(`${alternative.substitution_id} source delivery market must match the plan destination`);
      const expectedAlternativeDelivery = {
        country: alternativeOffer.delivery.country,
        postal_code: alternativeOffer.delivery.postal_code,
        destination_state: alternativeOffer.delivery.destination_state,
        exact_destination_confirmed: alternativeOffer.delivery.exact_destination_confirmed === true,
        lead_time_days_min: Number.isInteger(alternativeOffer.delivery.lead_time_days_min) ? alternativeOffer.delivery.lead_time_days_min : null,
        lead_time_days_max: Number.isInteger(alternativeOffer.delivery.lead_time_days_max) ? alternativeOffer.delivery.lead_time_days_max : null,
        window_source: alternativeOffer.delivery.window_source ?? null
      };
      for (const [key, value] of Object.entries(expectedAlternativeDelivery)) if (alternative.delivery[key] !== value) errors.push(`${alternative.substitution_id} delivery.${key} does not match its canonical alternative offer`);
      if (!sameJson(alternative.deltas.fit.dimension_delta_mm, candidate.dimension_delta_mm ?? null) || !sameJson(alternative.deltas.fit.same_center_transform_effect, candidate.same_center_transform_effect ?? null)) errors.push(`${alternative.substitution_id} fit deltas do not match source candidate`);
      if (alternative.deltas.visual.state !== candidate.colour_finish_material_match || alternative.deltas.performance.state !== candidate.technical_compatibility) errors.push(`${alternative.substitution_id} visual/performance deltas do not match source candidate`);
      const canonicalCostDelta = round(Number(alternativeOffer.price.amount) - Number(offer.price.amount));
      if (Number(candidate.price_delta_eur) !== canonicalCostDelta) errors.push(`${alternative.substitution_id} candidate price delta does not equal canonical alternative price minus selected primary price`);
      if (alternative.deltas.cost.amount !== canonicalCostDelta || alternative.deltas.cost.currency !== alternativeOffer.price.currency) errors.push(`${alternative.substitution_id} cost delta must be derived from canonical product prices`);
      if (alternative.deltas.carbon.state !== 'UNVERIFIED' || alternative.deltas.carbon.kg_co2e_delta !== null || alternative.deltas.carbon.source_ref !== null) errors.push(`${alternative.substitution_id} carbon delta must remain unverified without canonical comparable carbon evidence`);
      const expectedAltEvidence = {
        source_ref: `${FILES.offers}#${alternativeOffer.offer_ref}`,
        source_uri: alternativeOffer.product_url,
        observed_at: alternativeOffer.observed_at,
        expires_at: alternativeOffer.expires_at ?? null,
        live_refresh_required: alternativeOffer.live_refresh_required === true,
        refresh_before_purchase: alternativeOffer.refresh_before_purchase === true
      };
      for (const [key, value] of Object.entries(expectedAltEvidence)) if (alternative.evidence[key] !== value) errors.push(`${alternative.substitution_id} evidence.${key} does not match canonical offer`);
      const expectedAlternativeFreshness = evidenceStateAt({...expectedAltEvidence, freshness_state: alternative.evidence.freshness_state}, generatedAt);
      if (alternative.evidence.freshness_state !== expectedAlternativeFreshness) errors.push(`${alternative.substitution_id} freshness is not derived from source evidence`);
      const expectedAlternativeClass = deriveSupplyClass({delivery: expectedAlternativeDelivery, evidence: {...expectedAltEvidence, freshness_state: expectedAlternativeFreshness}, seller: expectedSeller(alternativeOffer, plan.destination)}, plan.destination, generatedAt);
      if (alternative.supply_class !== expectedAlternativeClass) errors.push(`${alternative.substitution_id} supply class is not derived from canonical alternative delivery evidence`);
      const expectedAlternativeLead = leadTime(expectedAlternativeDelivery);
      if (alternative.deltas.schedule.lead_time_days_min !== (expectedAlternativeLead?.min ?? null) || alternative.deltas.schedule.lead_time_days_max !== (expectedAlternativeLead?.max ?? null)) errors.push(`${alternative.substitution_id} schedule delta does not match canonical alternative delivery evidence`);
      if (alternative.deltas.schedule.state !== (expectedAlternativeLead ? 'DATED_WINDOW_CAPTURED' : 'UNVERIFIED')) errors.push(`${alternative.substitution_id} schedule state does not match canonical alternative delivery evidence`);
      const supplyConfirmed = ['LOCAL', 'CONFIRMED_WITHIN_10_DAYS', 'CONFIRMED_BEYOND_10_DAYS'].includes(expectedAlternativeClass);
      const expectedAlternativeGates = {
        IDENTITY: {state: alternativeOffer.identity_state === 'EXACT_RETAIL_ARTICLE_VERIFIED' ? 'PASS' : 'BLOCKED', critical: true},
        EVIDENCE_FRESHNESS: {state: expectedAlternativeFreshness === 'CURRENT' ? 'PASS' : 'BLOCKED', critical: true},
        DESTINATION_SUPPLY: {state: supplyConfirmed ? 'PASS' : 'BLOCKED', critical: true},
        ROLE_MATCH: {state: expectedApprovalState(candidate.role_match), critical: true},
        DIMENSION_AND_CIRCULATION_FIT: {state: expectedApprovalState(candidate.dimension_and_circulation_fit), critical: true},
        TECHNICAL_COMPATIBILITY: {state: expectedApprovalState(candidate.technical_compatibility), critical: true},
        COLOUR_FINISH_MATERIAL: {state: expectedApprovalState(candidate.colour_finish_material_match), critical: true},
        CLIENT_DESIGN_APPROVAL: {state: expectedApprovalState(candidate.client_design_approval), critical: true},
        CARBON_DELTA: {state: 'REVIEW', critical: false},
        SCHEDULE_DELTA: {state: supplyConfirmed && expectedAlternativeLead ? 'PASS' : 'BLOCKED', critical: true}
      };
      assertExactGates(alternative.approval_gates, expectedAlternativeGates, alternative.substitution_id, errors);
      const allRequiredApproved = Object.values(expectedAlternativeGates).filter((gate) => gate.critical).every((gate) => gate.state === 'PASS');
      if (alternative.state !== (allRequiredApproved ? 'APPROVED' : 'CONDITIONAL_NOT_APPROVED')) errors.push(`${alternative.substitution_id} state must be derived from all critical approval gates`);
    }
  }
}

function validateCosts(plan, sourceData, errors) {
  const components = plan.cost_summary;
  for (const [key, component] of Object.entries(components)) {
    if (component.currency !== plan.currency) errors.push(`cost_summary.${key} currency must match plan currency`);
    if (component.state === 'VERIFIED' && !Number.isFinite(component.amount)) errors.push(`cost_summary.${key} VERIFIED requires a finite amount`);
    if (['UNVERIFIED', 'CONTAMINATED_EVIDENCE'].includes(component.state) && component.amount !== null) errors.push(`cost_summary.${key} ${component.state} must not emit an amount`);
  }
  const generatedAt = new Date(plan.generated_at);
  const allCurrent = plan.line_items.every((line) => evidenceStateAt(line.primary_product.evidence, generatedAt) === 'CURRENT');
  const specified = round(plan.line_items.reduce((sum, line) => sum + line.primary_product.merchandise_total.amount, 0));
  if (components.specified_merchandise.amount !== specified) errors.push('Specified merchandise cost does not reconcile to line items');
  if (components.specified_merchandise.state !== (allCurrent ? 'VERIFIED' : 'HISTORICAL')) errors.push('Specified merchandise state must distinguish current from historical prices');
  const deliverable = plan.line_items.filter((line) => ['LOCAL', 'CONFIRMED_WITHIN_10_DAYS', 'CONFIRMED_BEYOND_10_DAYS'].includes(deriveSupplyClass(line.primary_product, plan.destination, generatedAt)));
  const deliverableSubtotal = round(deliverable.reduce((sum, line) => sum + line.primary_product.merchandise_total.amount, 0));
  const deliverableCurrent = deliverable.length > 0 && deliverable.every((line) => evidenceStateAt(line.primary_product.evidence, generatedAt) === 'CURRENT');
  if (deliverableCurrent) {
    if (components.currently_deliverable_merchandise.state !== 'VERIFIED' || components.currently_deliverable_merchandise.amount !== deliverableSubtotal) errors.push('Current deliverable merchandise must reconcile to current classified lines');
  } else if (components.currently_deliverable_merchandise.state !== 'UNVERIFIED' || components.currently_deliverable_merchandise.amount !== null) errors.push('Deliverable merchandise must be withheld when no current classified subtotal exists');
  const session = sourceData?.session;
  const freightContaminated = (session?.combined_cart_evidence?.accidental_accessories_in_cart?.length ?? 0) > 0 || session?.combined_cart_evidence?.landed_cost_state !== 'CLEAN_EXACT_CART';
  if (freightContaminated && (components.freight.state !== 'CONTAMINATED_EVIDENCE' || components.freight.amount !== null)) errors.push('Freight must remain withheld while session cart evidence is contaminated');
  for (const key of ['tax_and_duty', 'installation', 'contingency']) if (components[key].state !== 'UNVERIFIED' || components[key].amount !== null) errors.push(`cost_summary.${key} must remain unverified without a canonical source`);
  if (components.landed_total.state !== 'UNVERIFIED' || components.landed_total.amount !== null) errors.push('Landed total must remain withheld while required components lack canonical evidence');
  if (components.landed_total.amount !== null) {
    const keys = ['specified_merchandise', 'freight', 'tax_and_duty', 'installation', 'contingency'];
    if (!keys.every((key) => components[key].state === 'VERIFIED' && Number.isFinite(components[key].amount))) errors.push('Landed total cannot be emitted until every required component is verified');
    const expected = round(keys.reduce((sum, key) => sum + components[key].amount, 0));
    if (components.landed_total.amount !== expected) errors.push('Landed total must equal merchandise, freight, tax/duty, installation and contingency');
  }
}

function validateDeliverySchedule(plan, sourceData, errors) {
  const generatedAt = new Date(plan.generated_at);
  const confirmed = plan.line_items.filter((line) => ['LOCAL', 'CONFIRMED_WITHIN_10_DAYS', 'CONFIRMED_BEYOND_10_DAYS'].includes(deriveSupplyClass(line.primary_product, plan.destination, generatedAt)));
  const blocked = plan.line_items.filter((line) => !confirmed.includes(line));
  const expectedConfirmedIds = confirmed.map((line) => line.line_item_id);
  const expectedBlockedIds = blocked.map((line) => line.line_item_id);
  if (!sameJson(plan.delivery_schedule.blocked_line_item_ids, expectedBlockedIds)) errors.push('Delivery blocked-line IDs must be derived from supply classes');
  if (plan.delivery_schedule.required_on_site_date !== null || plan.delivery_schedule.state !== 'BLOCKED') errors.push('Schedule must remain blocked because the frozen source has no required-on-site date');
  if (confirmed.length) {
    if (plan.delivery_schedule.scheduled_groups.length !== 1) errors.push('The current source session supports exactly one evidence-only delivery group');
    const group = plan.delivery_schedule.scheduled_groups[0];
    const sessionDelivery = sourceData?.session?.combined_cart_evidence?.home_delivery_29660;
    if (group && (!sameJson(group.line_item_ids, expectedConfirmedIds) || group.delivery_date_min !== sessionDelivery?.delivery_date_min || group.delivery_date_max !== sessionDelivery?.delivery_date_max || group.membership_evidence_state !== 'COUNT_RECONCILED_NOT_ITEMIZED' || group.source_ref !== FILES.session || group.state !== 'EVIDENCE_WINDOW_ONLY' || group.booking_state !== 'NOT_BOOKED')) errors.push('Delivery group must exactly match the scoped, unbooked, count-only session evidence window');
    const deliveryDateMin = parseDateOnly(group?.delivery_date_min);
    const deliveryDateMax = parseDateOnly(group?.delivery_date_max);
    if (!deliveryDateMin || !deliveryDateMax || deliveryDateMax.valueOf() < deliveryDateMin.valueOf()) errors.push('Delivery group dates must be valid, ordered ISO calendar dates');
  } else if (plan.delivery_schedule.scheduled_groups.length) errors.push('No delivery group may be emitted without current confirmed lines');
}

function validateFreshnessReport(plan, errors) {
  const generatedAt = new Date(plan.generated_at);
  const evidences = plan.line_items.flatMap((line) => [line.primary_product.evidence, ...line.alternatives.map((alternative) => alternative.evidence)]);
  const states = evidences.map((evidence) => evidenceStateAt(evidence, generatedAt));
  const counts = Object.fromEntries(['CURRENT', 'EXPIRED', 'REFRESH_REQUIRED', 'UNKNOWN'].map((state) => [state, states.filter((value) => value === state).length]));
  if (plan.evidence_freshness.evaluated_at !== plan.generated_at || plan.evidence_freshness.monitor.last_checked_at !== plan.generated_at) errors.push('Freshness evaluation and monitor check must equal plan generation time');
  if (plan.evidence_freshness.current_count !== counts.CURRENT || plan.evidence_freshness.expired_count !== counts.EXPIRED || plan.evidence_freshness.refresh_required_count !== counts.REFRESH_REQUIRED || plan.evidence_freshness.unknown_count !== counts.UNKNOWN) errors.push('Freshness counts do not reconcile to evidence records');
  const expectedOverall = counts.REFRESH_REQUIRED ? 'REFRESH_REQUIRED' : counts.EXPIRED ? 'EXPIRED' : counts.UNKNOWN ? 'UNKNOWN' : 'CURRENT';
  if (plan.evidence_freshness.overall_state !== expectedOverall) errors.push('Freshness overall_state does not reconcile');
  const currentUntil = evidences.filter((evidence) => evidenceStateAt(evidence, generatedAt) === 'CURRENT' && evidence.expires_at).map((evidence) => evidence.expires_at).sort((a, b) => new Date(a) - new Date(b))[0] ?? null;
  if (plan.evidence_freshness.current_until !== currentUntil) errors.push('Freshness current_until must be the earliest current evidence expiry');
}

function validateRiskRegister(plan, derivedClasses, errors) {
  const all = plan.line_items.map((line) => line.line_item_id);
  const unavailable = plan.line_items.filter((line) => derivedClasses.get(line.line_item_id) === 'UNAVAILABLE').map((line) => line.line_item_id);
  const unverified = plan.line_items.filter((line) => derivedClasses.get(line.line_item_id) === 'UNVERIFIED').map((line) => line.line_item_id);
  const deliverable = plan.line_items.filter((line) => ['LOCAL', 'CONFIRMED_WITHIN_10_DAYS', 'CONFIRMED_BEYOND_10_DAYS'].includes(derivedClasses.get(line.line_item_id))).map((line) => line.line_item_id);
  const withAlternative = plan.line_items.filter((line) => line.alternatives.length).map((line) => line.line_item_id);
  const expected = [];
  if (unavailable.length) expected.push({
    risk_id: 'RISK_SELECTED_PRODUCT_UNAVAILABLE', category: 'supply', severity: 'HIGH', state: 'OPEN', affected_line_item_ids: unavailable,
    evidence: 'LISTERBY is unavailable for the exact ES 29660 route in the dated observation.',
    mitigation: 'Keep LISTERBY selected and visibly blocked; fit-check and explicitly approve VALNÄS or another exact alternative before changing the design.', owner: 'Build, Procurement & Logistics OS'
  });
  if (unverified.length) expected.push({
    risk_id: 'RISK_SELECTED_SUPPLY_UNVERIFIED', category: 'supply', severity: 'HIGH', state: 'OPEN', affected_line_item_ids: unverified,
    evidence: 'One or more selected routes lack current destination and lead-time evidence.',
    mitigation: 'Refresh exact destination evidence before making an availability or schedule claim.', owner: 'Build, Procurement & Logistics OS'
  });
  expected.push(
    {
      risk_id: 'RISK_SUBSTITUTION_NOT_APPROVED', category: 'approval', severity: 'HIGH', state: 'OPEN', affected_line_item_ids: withAlternative,
      evidence: 'VALNÄS remains conditional with fit, technical, finish and client-approval gates open.',
      mitigation: 'Resolve every disclosed delta and record explicit client approval; never auto-apply the alternative.', owner: 'Room Lab & Commerce Showroom / client decision'
    },
    {
      risk_id: 'RISK_FREIGHT_QUOTE_CONTAMINATED', category: 'landed_cost', severity: 'HIGH', state: 'OPEN', affected_line_item_ids: deliverable,
      evidence: 'The combined cart contained seven exact products and two accidental accessories.',
      mitigation: 'Capture a clean cart or supplier quote and allocate freight without embedding mutable checkout payloads.', owner: 'Build, Procurement & Logistics OS'
    },
    {
      risk_id: 'RISK_CART_MEMBERSHIP_NOT_ITEMIZED', category: 'schedule_evidence', severity: 'MEDIUM', state: 'OPEN', affected_line_item_ids: deliverable,
      evidence: 'The source cart records seven exact room products by count, but does not itemize their Product Twin IDs inside the cart evidence object.',
      mitigation: 'Treat the calendar window as evidence-only and capture an itemized clean quote before booking or purchase.', owner: 'Build, Procurement & Logistics OS'
    },
    {
      risk_id: 'RISK_SUPPLY_ORIGIN_UNRESOLVED', category: 'supplier', severity: 'MEDIUM', state: 'OPEN', affected_line_item_ids: all,
      evidence: 'Seller and dispatch country are null for every selected offer.',
      mitigation: 'Capture seller or dispatch origin before making locality or route-carbon claims.', owner: 'Build, Procurement & Logistics OS'
    },
    {
      risk_id: 'RISK_EVIDENCE_EXPIRES_DAILY', category: 'freshness', severity: 'HIGH', state: 'OPEN', affected_line_item_ids: all,
      evidence: 'Every selected offer is mutable and the current snapshot expires at the recorded validity boundary.',
      mitigation: 'Run the evidence monitor daily while shown and refresh immediately before approval or purchase.', owner: 'Verification, Evidence & Monitoring'
    },
    {
      risk_id: 'RISK_PLACEMENT_SNAPSHOT_INCOMPLETE', category: 'source_completeness', severity: 'HIGH', state: 'OPEN', affected_line_item_ids: all,
      evidence: 'The repository manifest contains identities and quantities but no transforms or bundle membership.',
      mitigation: 'Consume a versioned Room Lab placement export before claiming exact bundle or placement-derived quantities.', owner: 'Room Lab & Commerce Showroom'
    },
    {
      risk_id: 'RISK_SITE_AND_INSTALLATION_UNVERIFIED', category: 'delivery_installation', severity: 'HIGH', state: 'OPEN', affected_line_item_ids: all,
      evidence: 'Site access, unloading, storage, required-on-site date, assembly and installation are absent.',
      mitigation: 'Attach destination access constraints, installation scope and required-on-site date before scheduling.', owner: 'Build, Procurement & Logistics OS'
    }
  );
  if (!sameJson(plan.risk_register, expected)) errors.push('Risk register records must exactly match independently derived controls, states, evidence, mitigations and owners');
}

export function validateProcurementPlan(plan, schema, {currentAt = null, sourceData = null} = {}) {
  const errors = validateJsonSchema(plan, schema);
  if (errors.length) return errors;
  const mutablePaths = findMutablePayloads(plan);
  if (mutablePaths.length) errors.push(`Mutable checkout/cart/order fields are forbidden: ${mutablePaths.join(', ')}`);
  validateSourceLineage(plan, sourceData, errors);

  const lineIds = plan.line_items.map((line) => line.line_item_id);
  const placementIds = plan.line_items.map((line) => line.placement_id);
  if (!unique(lineIds)) errors.push('line_item_id values must be unique');
  if (!unique(placementIds)) errors.push('placement_id values must be unique');
  const packagedLineIds = plan.packages.flatMap((pkg) => pkg.subpackages.flatMap((subpackage) => subpackage.line_item_ids));
  if (!unique(packagedLineIds)) errors.push('Every line item must occur in exactly one package/subpackage');
  if (!sameJson([...packagedLineIds].sort(), [...lineIds].sort())) errors.push('Package/subpackage line IDs must exactly cover the plan line items');
  if (plan.packages.length !== 1 || plan.packages[0].package_id !== 'PKG_FFE_LIVING_ROOM' || plan.packages[0].construction_phase !== 'ffe') errors.push('Living-room lines must remain in the canonical FFE construction package');
  for (const line of plan.line_items) {
    const expectedSubpackage = ROLE_MAP[line.role]?.subpackageId;
    const actualSubpackage = plan.packages.flatMap((pkg) => pkg.subpackages).find((subpackage) => subpackage.line_item_ids.includes(line.line_item_id));
    if (!expectedSubpackage || actualSubpackage?.subpackage_id !== expectedSubpackage) errors.push(`${line.line_item_id} is not assigned to the subpackage required by its canonical role`);
  }
  const totalUnits = plan.line_items.reduce((sum, line) => sum + line.quantity, 0);
  if (plan.source_snapshot.placement_snapshot.placement_line_count !== plan.line_items.length || plan.source_snapshot.placement_snapshot.placed_unit_count !== totalUnits) errors.push('Source placement counts must match plan lines and quantities');
  if (plan.classification_summary.total_lines !== plan.line_items.length || plan.classification_summary.total_units !== totalUnits) errors.push('Classification totals must match plan lines and quantities');
  const classNames = plan.classification_summary.classes.map((entry) => entry.supply_class);
  if (!unique(classNames) || !sameJson([...classNames].sort(), [...SUPPLY_CLASSES].sort())) errors.push('Classification summary must contain each supply class exactly once');
  const generatedAt = new Date(plan.generated_at);
  const derivedClasses = new Map(plan.line_items.map((line) => [line.line_item_id, deriveSupplyClass(line.primary_product, plan.destination, generatedAt)]));
  for (const line of plan.line_items) if (line.primary_product.supply_class !== derivedClasses.get(line.line_item_id)) errors.push(`${line.line_item_id} stored supply class does not match independently derived class`);
  for (const entry of plan.classification_summary.classes) {
    const matching = plan.line_items.filter((line) => derivedClasses.get(line.line_item_id) === entry.supply_class);
    const units = matching.reduce((sum, line) => sum + line.quantity, 0);
    if (entry.line_count !== matching.length || entry.unit_quantity !== units || entry.unit_percentage !== round(units / totalUnits * 100)) errors.push(`${entry.supply_class} summary does not reconcile to independently derived classes`);
  }
  if (Math.abs(round(plan.classification_summary.classes.reduce((sum, entry) => sum + entry.unit_percentage, 0)) - 100) > 0.01) errors.push('Supply-class percentages must total 100');

  validateCosts(plan, sourceData, errors);
  validateDeliverySchedule(plan, sourceData, errors);
  validateFreshnessReport(plan, errors);
  const validLineIds = new Set(lineIds);
  for (const risk of plan.risk_register) for (const lineId of risk.affected_line_item_ids) if (!validLineIds.has(lineId)) errors.push(`${risk.risk_id} references unknown line ${lineId}`);
  if (!unique(plan.risk_register.map((risk) => risk.risk_id))) errors.push('risk_id values must be unique');
  validateRiskRegister(plan, derivedClasses, errors);

  const cost = plan.cost_summary;
  for (const line of plan.line_items) {
    const primary = line.primary_product;
    if (primary.unit_price.currency !== plan.currency || primary.merchandise_total.currency !== plan.currency || primary.merchandise_total.amount !== round(primary.unit_price.amount * line.quantity)) errors.push(`${line.line_item_id} merchandise currency or arithmetic does not reconcile`);
    const derivedClass = derivedClasses.get(line.line_item_id);
    const expectedLineGates = {
      IDENTITY: {state: primary.identity_state === 'EXACT_RETAIL_ARTICLE_VERIFIED' ? 'PASS' : 'BLOCKED', critical: true},
      QUANTITY: {state: Number.isInteger(line.quantity) && line.quantity > 0 ? 'PASS' : 'BLOCKED', critical: true},
      EVIDENCE_FRESHNESS: {state: evidenceStateAt(primary.evidence, generatedAt) === 'CURRENT' ? 'PASS' : 'BLOCKED', critical: true},
      DESTINATION_SUPPLY: {state: ['LOCAL', 'CONFIRMED_WITHIN_10_DAYS', 'CONFIRMED_BEYOND_10_DAYS'].includes(derivedClass) ? 'PASS' : 'BLOCKED', critical: true},
      PROCUREMENT_APPROVAL: {state: plan.source_snapshot.approval_evidence !== null && line.approval_state === 'PROCUREMENT_APPROVED' ? 'PASS' : 'BLOCKED', critical: true},
      REQUIRED_ON_SITE_DATE: {state: plan.delivery_schedule.required_on_site_date ? 'PASS' : 'BLOCKED', critical: true},
      CLEAN_CHECKOUT_TOTAL: {state: cost.freight.state === 'VERIFIED' ? 'PASS' : 'BLOCKED', critical: true},
      LANDED_COST: {state: cost.landed_total.state === 'VERIFIED' && Number.isFinite(cost.landed_total.amount) ? 'PASS' : 'BLOCKED', critical: true},
      INSTALLATION: {state: cost.installation.state === 'VERIFIED' && Number.isFinite(cost.installation.amount) ? 'PASS' : 'BLOCKED', critical: true},
      PURCHASE_REFRESH: {state: primary.evidence.refresh_before_purchase === false ? 'PASS' : 'BLOCKED', critical: true}
    };
    assertExactGates(line.readiness.gates, expectedLineGates, line.line_item_id, errors);
    const lineReady = Object.values(expectedLineGates).every((gate) => gate.state === 'PASS');
    if (line.readiness.purchase_ready !== lineReady || line.readiness.state !== (lineReady ? 'READY' : 'BLOCKED')) errors.push(`${line.line_item_id} readiness must be independently derived from exact gates`);
  }

  const snapshot = plan.source_snapshot.placement_snapshot;
  const sourceComplete = snapshot.state === 'COMPLETE' && snapshot.transforms_included && snapshot.bundle_membership_included && snapshot.missing_inputs.length === 0 && plan.line_items.every((line) => line.bundle.state !== 'BUNDLE_MEMBERSHIP_UNVERIFIED');
  const allSupplyReady = [...derivedClasses.values()].every((value) => ['LOCAL', 'CONFIRMED_WITHIN_10_DAYS', 'CONFIRMED_BEYOND_10_DAYS'].includes(value));
  const rescueLines = plan.line_items.filter((line) => ['UNAVAILABLE', 'UNVERIFIED'].includes(derivedClasses.get(line.line_item_id)));
  const substitutionsApproved = rescueLines.every((line) => line.alternatives.some((alternative) => alternative.state === 'APPROVED' && ['LOCAL', 'CONFIRMED_WITHIN_10_DAYS', 'CONFIRMED_BEYOND_10_DAYS'].includes(alternative.supply_class)));
  const lineApprovalsComplete = plan.source_snapshot.approval_evidence !== null && plan.line_items.every((line) => line.approval_state === 'PROCUREMENT_APPROVED');
  const expectedGlobalGates = {
    SOURCE_PLACEMENT_COMPLETE: {state: sourceComplete ? 'PASS' : 'BLOCKED', critical: true},
    MERCHANDISE_RECONCILIATION: {state: cost.specified_merchandise.state === 'VERIFIED' ? 'PASS' : 'BLOCKED', critical: true},
    DESTINATION_SUPPLY_ALL_LINES: {state: allSupplyReady ? 'PASS' : 'BLOCKED', critical: true},
    SUBSTITUTION_APPROVALS: {state: substitutionsApproved ? 'PASS' : 'BLOCKED', critical: true},
    LINE_PROCUREMENT_APPROVALS: {state: lineApprovalsComplete ? 'PASS' : 'BLOCKED', critical: true},
    EVIDENCE_FRESHNESS: {state: plan.evidence_freshness.overall_state === 'CURRENT' ? 'PASS' : 'BLOCKED', critical: true},
    PURCHASE_TIME_REFRESH: {state: plan.line_items.every((line) => line.primary_product.evidence.refresh_before_purchase === false) ? 'PASS' : 'BLOCKED', critical: true},
    CLEAN_FREIGHT: {state: cost.freight.state === 'VERIFIED' && Number.isFinite(cost.freight.amount) ? 'PASS' : 'BLOCKED', critical: true},
    TAX_AND_DUTY: {state: cost.tax_and_duty.state === 'VERIFIED' && Number.isFinite(cost.tax_and_duty.amount) ? 'PASS' : 'BLOCKED', critical: true},
    INSTALLATION: {state: cost.installation.state === 'VERIFIED' && Number.isFinite(cost.installation.amount) ? 'PASS' : 'BLOCKED', critical: true},
    CONTINGENCY: {state: cost.contingency.state === 'VERIFIED' && Number.isFinite(cost.contingency.amount) ? 'PASS' : 'BLOCKED', critical: true},
    LANDED_TOTAL: {state: cost.landed_total.state === 'VERIFIED' && Number.isFinite(cost.landed_total.amount) ? 'PASS' : 'BLOCKED', critical: true},
    REQUIRED_ON_SITE_DATE: {state: plan.delivery_schedule.required_on_site_date ? 'PASS' : 'BLOCKED', critical: true},
    SITE_ACCESS: {state: plan.source_snapshot.site_access_evidence !== null && plan.destination.site_access_state === 'VERIFIED' ? 'PASS' : 'BLOCKED', critical: true},
    MUTABLE_CHECKOUT_PAYLOAD_EXCLUDED: {state: mutablePaths.length ? 'BLOCKED' : 'PASS', critical: true}
  };
  assertExactGates(plan.procurement_readiness.gates, expectedGlobalGates, 'procurement_readiness', errors);
  const expectedBlockingIds = Object.entries(expectedGlobalGates).filter(([, gate]) => gate.state !== 'PASS').map(([gateId]) => gateId);
  const globalReady = expectedBlockingIds.length === 0;
  if (plan.procurement_readiness.purchase_ready !== globalReady || plan.procurement_readiness.state !== (globalReady ? 'READY' : 'BLOCKED')) errors.push('Global readiness must be independently derived from source, supply, cost, schedule and freshness');
  if (!sameJson(plan.procurement_readiness.blocking_gate_ids, expectedBlockingIds)) errors.push('blocking_gate_ids must exactly list independently failed critical gates');
  if (plan.status !== (globalReady ? 'PURCHASE_READY' : 'DRAFT_NOT_PURCHASE_READY')) errors.push('Plan status must match independently derived readiness');
  if (plan.consumer_contract.selected_design_mutated || plan.consumer_contract.conditional_alternatives_auto_applied || plan.consumer_contract.mutable_checkout_payloads_embedded) errors.push('Consumer contract violates immutable-design or ephemeral-checkout policy');

  if (currentAt) {
    const currentDate = currentAt instanceof Date ? currentAt : new Date(currentAt);
    if (Number.isNaN(currentDate.valueOf())) errors.push('currentAt must be a valid date-time');
    else for (const line of plan.line_items) {
      if (evidenceStateAt(line.primary_product.evidence, currentDate) !== 'CURRENT') errors.push(`${line.line_item_id} is not current at ${currentDate.toISOString()}`);
      for (const alternative of line.alternatives) if (evidenceStateAt(alternative.evidence, currentDate) !== 'CURRENT') errors.push(`${alternative.substitution_id} is not current at ${currentDate.toISOString()}`);
    }
  }
  return errors;
}

function currentAtFromArgs(argv) {
  const current = argv.find((argument) => argument.startsWith('--current-at='));
  if (current) return new Date(current.slice('--current-at='.length));
  return argv.includes('--current') ? new Date() : null;
}

async function main() {
  const [schema, plan, design, evidence, session] = await Promise.all([
    fs.readFile(path.join(ROOT, SCHEMA_FILE), 'utf8').then(JSON.parse),
    fs.readFile(path.join(ROOT, FILES.output), 'utf8').then(JSON.parse),
    fs.readFile(path.join(ROOT, FILES.design), 'utf8').then(JSON.parse),
    fs.readFile(path.join(ROOT, FILES.offers), 'utf8').then(JSON.parse),
    fs.readFile(path.join(ROOT, FILES.session), 'utf8').then(JSON.parse)
  ]);
  const errors = validateProcurementPlan(plan, schema, {currentAt: currentAtFromArgs(process.argv.slice(2)), sourceData: {design, evidence, session}});
  console.log(JSON.stringify({status: errors.length ? 'PROJECT_PROCUREMENT_PLAN_BLOCKED' : 'PROJECT_PROCUREMENT_PLAN_PASS', schema: SCHEMA_FILE, manifest: FILES.output, errors}, null, 2));
  if (errors.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
