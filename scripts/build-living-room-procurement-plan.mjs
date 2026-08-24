import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const ROOT = process.cwd();

export const FILES = {
  design: 'data/showrooms/living-room-client-design-v0.1.json',
  offers: 'data/procurement/living-room-design-offers-v0.1.json',
  session: 'data/procurement/living-room-ikea-spain-session-2026-08-17.json',
  output: 'data/procurement/room-lab-living-spain-procurement-plan-v1.0.0.json'
};

export const SUPPLY_CLASSES = [
  'LOCAL',
  'CONFIRMED_WITHIN_10_DAYS',
  'CONFIRMED_BEYOND_10_DAYS',
  'UNAVAILABLE',
  'UNVERIFIED'
];

export const LOCAL_SUPPLY_RADIUS_KM = 100;

const ROLE_MAP = {
  sofa: {specificationRole: 'FFE.SEATING.SOFA', subpackageId: 'SUBPKG_FFE_SEATING', subpackageName: 'Seating'},
  armchair: {specificationRole: 'FFE.SEATING.ARMCHAIR', subpackageId: 'SUBPKG_FFE_SEATING', subpackageName: 'Seating'},
  coffee_table: {specificationRole: 'FFE.TABLE.COFFEE', subpackageId: 'SUBPKG_FFE_TABLES', subpackageName: 'Tables'},
  side_table: {specificationRole: 'FFE.TABLE.SIDE', subpackageId: 'SUBPKG_FFE_TABLES', subpackageName: 'Tables'},
  floor_lamp: {specificationRole: 'ELECTRICAL.LUMINAIRES.FLOOR_LAMP', subpackageId: 'SUBPKG_FFE_LIGHTING', subpackageName: 'Lighting'},
  rug: {specificationRole: 'FFE.SOFT_FURNISHINGS.RUG', subpackageId: 'SUBPKG_FFE_SOFT_FURNISHINGS', subpackageName: 'Soft furnishings'},
  media_unit: {specificationRole: 'FFE.STORAGE.MEDIA_UNIT', subpackageId: 'SUBPKG_FFE_STORAGE', subpackageName: 'Storage and media'},
  bookcase: {specificationRole: 'FFE.STORAGE.BOOKCASE', subpackageId: 'SUBPKG_FFE_STORAGE', subpackageName: 'Storage and media'}
};

const money = (amount, currency) => ({amount: Number(Number(amount).toFixed(2)), currency});
const round = (value, places = 2) => Number(value.toFixed(places));

function articleNumberForTwin(twinId) {
  const digits = String(twinId).match(/(\d{8})$/)?.[1];
  return digits ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}` : null;
}

export function hashObject(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function requireValue(value, message) {
  if (value === undefined || value === null || value === '') throw new Error(message);
  return value;
}

function asDate(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error(`${label} must be a valid date-time: ${value}`);
  return date;
}

function asDateOnly(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) throw new Error(`${label} must be an ISO calendar date: ${value}`);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw new Error(`${label} must be a valid calendar date: ${value}`);
  return date;
}

function hasVerifiedLocality(localityEvidence, destination) {
  return localityEvidence?.state === 'VERIFIED_LOCAL_LOCATION'
    && localityEvidence?.origin_location?.country === destination.country
    && Boolean(localityEvidence?.source_ref)
    && Number.isFinite(localityEvidence?.distance_km)
    && localityEvidence.distance_km <= destination.local_supply_radius_km;
}

export function freshnessForOffer(offer, asOf) {
  if (offer?.live_refresh_required === true) return 'REFRESH_REQUIRED';
  if (!offer?.observed_at || !offer?.expires_at) return 'UNKNOWN';
  const observedAt = asDate(offer.observed_at, `${offer.offer_ref}.observed_at`);
  const expiresAt = asDate(offer.expires_at, `${offer.offer_ref}.expires_at`);
  if (observedAt.valueOf() > asOf.valueOf() || expiresAt.valueOf() < observedAt.valueOf()) return 'UNKNOWN';
  return asOf.valueOf() <= expiresAt.valueOf() ? 'CURRENT' : 'EXPIRED';
}

function routeMatchesDestination(offer, destination) {
  return offer?.delivery?.country === destination.country
    && (!destination.postal_code || offer.delivery.postal_code === destination.postal_code);
}

function leadTime(offer) {
  const min = offer?.delivery?.lead_time_days_min;
  const max = offer?.delivery?.lead_time_days_max;
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min) return null;
  return {min, max};
}

export function classifyOffer(offer, destination, asOf) {
  const freshnessState = freshnessForOffer(offer, asOf);
  const routeMatch = routeMatchesDestination(offer, destination);
  const destinationState = offer?.delivery?.destination_state ?? 'UNVERIFIED';
  const exactDelivery = routeMatch && offer?.delivery?.exact_destination_confirmed === true;
  const localEvidence = offer?.locality_evidence;
  const lead = leadTime(offer);

  if (freshnessState !== 'CURRENT') {
    return {supplyClass: 'UNVERIFIED', reason: `Mutable offer evidence is ${freshnessState}.`, freshnessState, lead};
  }
  if (routeMatch && destinationState === 'UNAVAILABLE') {
    return {supplyClass: 'UNAVAILABLE', reason: 'The exact destination route was checked and is unavailable.', freshnessState, lead};
  }
  if (!exactDelivery) {
    return {supplyClass: 'UNVERIFIED', reason: 'Exact destination delivery is not confirmed.', freshnessState, lead};
  }
  if (hasVerifiedLocality(localEvidence, destination)) {
    return {supplyClass: 'LOCAL', reason: `A verified physical supply or dispatch location is within the ${destination.local_supply_radius_km} km project-local radius and delivery is confirmed.`, freshnessState, lead};
  }
  if (!lead) {
    return {supplyClass: 'UNVERIFIED', reason: 'Destination delivery is available but no dated lead-time window is captured.', freshnessState, lead};
  }
  if (lead.max <= 10) {
    return {supplyClass: 'CONFIRMED_WITHIN_10_DAYS', reason: `Destination delivery is confirmed within ${lead.min}-${lead.max} days; origin is unresolved.`, freshnessState, lead};
  }
  return {supplyClass: 'CONFIRMED_BEYOND_10_DAYS', reason: `Destination delivery is confirmed in ${lead.min}-${lead.max} days; origin is unresolved.`, freshnessState, lead};
}

export function sellerForOffer(offer, destination) {
  const origin = offer.dispatch_country ?? offer.seller_country ?? null;
  const localityEvidence = offer.locality_evidence ?? {
    state: 'UNRESOLVED',
    source_ref: null,
    origin_location: null,
    distance_km: null
  };
  const localityState = hasVerifiedLocality(localityEvidence, destination)
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

export function deliveryForOffer(offer, classification) {
  return {
    country: offer.delivery?.country ?? 'ES',
    postal_code: offer.delivery?.postal_code ?? '',
    destination_state: offer.delivery?.destination_state ?? 'UNVERIFIED',
    exact_destination_confirmed: offer.delivery?.exact_destination_confirmed === true,
    lead_time_days_min: classification.lead?.min ?? null,
    lead_time_days_max: classification.lead?.max ?? null,
    window_source: offer.delivery?.window_source ?? null,
    classification_reason: classification.reason
  };
}

export function evidenceForOffer(offer, classification) {
  return {
    source_ref: `${FILES.offers}#${offer.offer_ref}`,
    source_uri: offer.product_url,
    observed_at: offer.observed_at,
    expires_at: offer.expires_at ?? null,
    freshness_state: classification.freshnessState,
    live_refresh_required: offer.live_refresh_required === true,
    refresh_before_purchase: offer.refresh_before_purchase === true
  };
}

function gate(gateId, state, critical, reason) {
  return {gate: gateId, state, critical, reason};
}

function lineReadiness({placement, offer, classification}) {
  const gates = [
    gate('IDENTITY', offer.identity_state === 'EXACT_RETAIL_ARTICLE_VERIFIED' ? 'PASS' : 'BLOCKED', true,
      offer.identity_state === 'EXACT_RETAIL_ARTICLE_VERIFIED' ? 'Exact retail article identity is recorded.' : 'Exact product identity is not verified.'),
    gate('QUANTITY', Number.isInteger(placement.quantity) && placement.quantity > 0 ? 'PASS' : 'BLOCKED', true,
      'Quantity must be a positive whole number from the frozen placement manifest.'),
    gate('EVIDENCE_FRESHNESS', classification.freshnessState === 'CURRENT' ? 'PASS' : 'BLOCKED', true,
      classification.freshnessState === 'CURRENT' ? 'Offer evidence is current at plan generation.' : `Offer evidence is ${classification.freshnessState}.`),
    gate('DESTINATION_SUPPLY', ['LOCAL', 'CONFIRMED_WITHIN_10_DAYS', 'CONFIRMED_BEYOND_10_DAYS'].includes(classification.supplyClass) ? 'PASS' : 'BLOCKED', true,
      classification.reason),
    gate('PROCUREMENT_APPROVAL', 'BLOCKED', true, 'The specified line has not received explicit procurement approval.'),
    gate('REQUIRED_ON_SITE_DATE', 'BLOCKED', true, 'No required-on-site date is present in the room manifest.'),
    gate('CLEAN_CHECKOUT_TOTAL', 'BLOCKED', true, 'No clean line-level or exact-cart checkout total is attached.'),
    gate('LANDED_COST', 'BLOCKED', true, 'Freight, tax/duty, handling and site delivery are incomplete.'),
    gate('INSTALLATION', 'BLOCKED', true, 'Installation scope, installer and cost are unverified.'),
    gate('PURCHASE_REFRESH', 'BLOCKED', true, 'Price, stock and delivery must be refreshed immediately before purchase.')
  ];
  const purchaseReady = gates.filter((item) => item.critical).every((item) => item.state === 'PASS');
  return {purchase_ready: purchaseReady, state: purchaseReady ? 'READY' : 'BLOCKED', gates};
}

function approvalState(value) {
  if (value === 'PASS' || value === 'APPROVED') return 'PASS';
  if (value === 'REQUIRED') return 'BLOCKED';
  return 'REVIEW';
}

function buildAlternative(candidate, offer, primaryOffer, destination, asOf) {
  const canonicalCostDelta = round(Number(offer.price.amount) - Number(primaryOffer.price.amount));
  if (Number(candidate.price_delta_eur) !== canonicalCostDelta) throw new Error(`${candidate.substitution_id} price delta must equal alternative price minus selected primary price`);
  const classification = classifyOffer(offer, destination, asOf);
  const supplyConfirmed = ['LOCAL', 'CONFIRMED_WITHIN_10_DAYS', 'CONFIRMED_BEYOND_10_DAYS'].includes(classification.supplyClass);
  const approvalGates = [
    gate('IDENTITY', offer.identity_state === 'EXACT_RETAIL_ARTICLE_VERIFIED' ? 'PASS' : 'BLOCKED', true, 'The alternative must have an exact verified retail identity.'),
    gate('EVIDENCE_FRESHNESS', classification.freshnessState === 'CURRENT' ? 'PASS' : 'BLOCKED', true, `Alternative offer evidence is ${classification.freshnessState}.`),
    gate('DESTINATION_SUPPLY', supplyConfirmed ? 'PASS' : 'BLOCKED', true, classification.reason),
    gate('ROLE_MATCH', approvalState(candidate.role_match), true, 'The alternative must preserve the approved design role.'),
    gate('DIMENSION_AND_CIRCULATION_FIT', approvalState(candidate.dimension_and_circulation_fit), true, 'Placement and circulation fit must pass at the selected transform.'),
    gate('TECHNICAL_COMPATIBILITY', approvalState(candidate.technical_compatibility), true, 'Technical compatibility must pass without undisclosed limits.'),
    gate('COLOUR_FINISH_MATERIAL', approvalState(candidate.colour_finish_material_match), true, 'Colour, finish and material intent must be approved.'),
    gate('CLIENT_DESIGN_APPROVAL', approvalState(candidate.client_design_approval), true, 'The client must explicitly approve the substitution.'),
    gate('CARBON_DELTA', 'REVIEW', false, 'Comparable carbon evidence is not yet available.'),
    gate('SCHEDULE_DELTA', supplyConfirmed && classification.lead ? 'PASS' : 'BLOCKED', true, classification.reason)
  ];
  const approved = approvalGates.filter((item) => item.critical).every((item) => item.state === 'PASS');
  return {
    substitution_id: candidate.substitution_id,
    state: approved ? 'APPROVED' : 'CONDITIONAL_NOT_APPROVED',
    twin_id: candidate.alternative_twin_id,
    avatar_id: candidate.alternative_avatar_id ?? null,
    selected_configuration: candidate.alternative_configuration ?? null,
    offer_ref: candidate.alternative_offer_ref,
    identity_state: offer.identity_state === 'EXACT_RETAIL_ARTICLE_VERIFIED' ? 'EXACT_RETAIL_ARTICLE_VERIFIED' : 'UNVERIFIED',
    supply_class: classification.supplyClass,
    unit_price: money(offer.price.amount, offer.price.currency),
    delivery: deliveryForOffer(offer, classification),
    evidence: evidenceForOffer(offer, classification),
    deltas: {
      fit: {
        state: candidate.dimension_and_circulation_fit,
        dimension_delta_mm: candidate.dimension_delta_mm ?? null,
        same_center_transform_effect: candidate.same_center_transform_effect ?? null
      },
      visual: {
        state: candidate.colour_finish_material_match,
        detail: 'Colour, finish and material equivalence remains a disclosed design review.'
      },
      performance: {
        state: candidate.technical_compatibility,
        detail: 'Furniture role compatibility is recorded; technical limits remain disclosed.'
      },
      carbon: {
        state: 'UNVERIFIED',
        kg_co2e_delta: null,
        reason: 'Comparable product, freight and installation carbon evidence is unavailable.',
        source_ref: null
      },
      cost: {
        state: 'VERIFIED_PRODUCT_PAGE_PRICE_DELTA',
        amount: canonicalCostDelta,
        currency: offer.price.currency
      },
      schedule: {
        state: classification.lead ? 'DATED_WINDOW_CAPTURED' : 'UNVERIFIED',
        lead_time_days_min: classification.lead?.min ?? null,
        lead_time_days_max: classification.lead?.max ?? null,
        reason: classification.lead ? 'A dated lead-time window is captured.' : 'No dated lead-time window is captured for the alternative.'
      }
    },
    approval_gates: approvalGates
  };
}

function buildLine({placement, offer, alternatives, destination, asOf}) {
  const role = requireValue(ROLE_MAP[placement.role], `No generic specification role is mapped for ${placement.role}`);
  if (offer.twin_id !== placement.twin_id) throw new Error(`${placement.placement_id} offer does not match its Product Twin`);
  const classification = classifyOffer(offer, destination, asOf);
  const unitPrice = money(offer.price.amount, offer.price.currency);
  return {
    line_item_id: `LINE_${placement.placement_id}`,
    placement_id: placement.placement_id,
    role: placement.role,
    generic_specification_role: role.specificationRole,
    quantity: placement.quantity,
    unit: 'each',
    bundle: {
      state: 'BUNDLE_MEMBERSHIP_UNVERIFIED',
      bundle_id: null,
      placed_avatar_quantity: null
    },
    primary_product: {
      twin_id: placement.twin_id,
      avatar_id: placement.avatar_id,
      selected_configuration: placement.selected_configuration,
      offer_ref: placement.offer_ref,
      identity_state: offer.identity_state === 'EXACT_RETAIL_ARTICLE_VERIFIED' ? 'EXACT_RETAIL_ARTICLE_VERIFIED' : 'UNVERIFIED',
      supply_class: classification.supplyClass,
      seller: sellerForOffer(offer, destination),
      unit_price: unitPrice,
      merchandise_total: money(unitPrice.amount * placement.quantity, unitPrice.currency),
      delivery: deliveryForOffer(offer, classification),
      evidence: evidenceForOffer(offer, classification)
    },
    alternatives,
    approval_state: 'SPECIFIED_NOT_PROCUREMENT_APPROVED',
    readiness: lineReadiness({placement, offer, classification})
  };
}

function buildPackages(lines) {
  const subpackages = new Map();
  for (const line of lines) {
    const role = ROLE_MAP[line.role];
    const entry = subpackages.get(role.subpackageId) ?? {
      subpackage_id: role.subpackageId,
      name: role.subpackageName,
      assignment_state: 'RULE_BASED_ROLE_MAP',
      line_item_ids: []
    };
    entry.line_item_ids.push(line.line_item_id);
    subpackages.set(role.subpackageId, entry);
  }
  return [{
    package_id: 'PKG_FFE_LIVING_ROOM',
    name: 'Living room furniture, fixtures and equipment',
    construction_phase: 'ffe',
    subpackages: [...subpackages.values()]
  }];
}

function buildClassificationSummary(lines) {
  const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0);
  return {
    basis: 'selected_primary_products',
    total_lines: lines.length,
    total_units: totalUnits,
    classes: SUPPLY_CLASSES.map((supplyClass) => {
      const matching = lines.filter((line) => line.primary_product.supply_class === supplyClass);
      const units = matching.reduce((sum, line) => sum + line.quantity, 0);
      return {
        supply_class: supplyClass,
        line_count: matching.length,
        unit_quantity: units,
        unit_percentage: totalUnits ? round(units / totalUnits * 100) : 0
      };
    })
  };
}

function costComponent(state, amount, currency, reason, sourceRef = null) {
  return {state, amount, currency, reason, source_ref: sourceRef};
}

export function validateSessionEvidence({design, evidence, session, asOf}) {
  const destination = design.destination;
  if (session.destination?.country !== destination.country || session.destination?.postal_code !== destination.postal_code) {
    throw new Error(`Session destination ${session.destination?.country} ${session.destination?.postal_code} does not match design destination ${destination.country} ${destination.postal_code}`);
  }
  const observedAt = asDate(session.observed_at, 'session.observed_at');
  if (observedAt.valueOf() > asOf.valueOf()) throw new Error('Session observation cannot be later than plan generation');

  const offerByRef = new Map(evidence.offers.map((offer) => [offer.offer_ref, offer]));
  const selectedByTwin = new Map(design.placements.map((placement) => [placement.twin_id, {placement, offer: offerByRef.get(placement.offer_ref)}]));
  const sessionProducts = session.exact_room_products ?? [];
  const sessionByTwin = new Map(sessionProducts.map((product) => [product.twin_id, product]));
  if (sessionByTwin.size !== sessionProducts.length) throw new Error('Session exact_room_products must contain unique Product Twin IDs');
  if (sessionProducts.length !== design.placements.length) throw new Error('Session exact_room_products must exactly match the frozen placement lines');
  if ([...selectedByTwin.keys()].some((twinId) => !sessionByTwin.has(twinId))) throw new Error('Session product membership does not match the frozen design');

  const currencies = new Set();
  let availableCount = 0;
  let unavailableCount = 0;
  let availableSubtotal = 0;
  let totalSubtotal = 0;
  for (const [twinId, {offer}] of selectedByTwin) {
    const sessionProduct = sessionByTwin.get(twinId);
    const placement = selectedByTwin.get(twinId).placement;
    if (!offer) throw new Error(`Session join is missing an offer for ${twinId}`);
    if (sessionProduct.article_no !== articleNumberForTwin(twinId)) throw new Error(`Session article number does not match Product Twin identity for ${twinId}`);
    const sessionQuantity = sessionProduct.quantity ?? 1;
    if (sessionQuantity !== placement.quantity) throw new Error(`Session quantity does not match frozen placement quantity for ${twinId}`);
    if (Number(sessionProduct.price?.amount) !== Number(offer.price?.amount) || sessionProduct.price?.currency !== offer.price?.currency) {
      throw new Error(`Session price does not match offer evidence for ${twinId}`);
    }
    currencies.add(offer.price.currency);
    totalSubtotal += Number(offer.price.amount) * placement.quantity;
    if (sessionProduct.home_delivery_29660 === 'AVAILABLE') {
      if (offer.delivery?.destination_state !== 'AVAILABLE' || offer.delivery?.exact_destination_confirmed !== true) throw new Error(`Session availability does not match offer evidence for ${twinId}`);
      availableCount += 1;
      availableSubtotal += Number(offer.price.amount) * placement.quantity;
    } else {
      if (offer.delivery?.destination_state !== 'UNAVAILABLE') throw new Error(`Session unavailability does not match offer evidence for ${twinId}`);
      unavailableCount += 1;
    }
  }
  if (currencies.size !== 1) throw new Error('Session products must use one comparable currency');
  const [currency] = currencies;
  const coverage = session.coverage_result;
  const placedUnits = design.placements.reduce((sum, placement) => sum + placement.quantity, 0);
  if (coverage.placement_lines !== design.placements.length || coverage.placed_units !== placedUnits) throw new Error('Session coverage counts do not match the frozen design');
  if (coverage.destination_delivery_available_lines !== availableCount || coverage.destination_unavailable_lines !== unavailableCount) throw new Error('Session availability counts do not reconcile');
  if (Number(coverage.seven_available_exact_products_subtotal.amount) !== round(availableSubtotal) || coverage.seven_available_exact_products_subtotal.currency !== currency) throw new Error('Session available subtotal does not reconcile');
  if (Number(coverage.all_eight_current_product_page_subtotal.amount) !== round(totalSubtotal) || coverage.all_eight_current_product_page_subtotal.currency !== currency) throw new Error('Session specified subtotal does not reconcile');

  const cart = session.combined_cart_evidence;
  const cartDelivery = cart.home_delivery_29660;
  if (cart.exact_room_products_in_cart !== availableCount || cartDelivery.state !== 'AVAILABLE') throw new Error('Combined-cart product count or delivery state does not reconcile to available selected products');
  if (cartDelivery.standard_delivery_charge.currency !== currency || cartDelivery.IKEA_Family_or_Business_delivery_charge.currency !== currency) throw new Error('Session freight currency must match merchandise currency');
  const deliveryDateMin = asDateOnly(cartDelivery.delivery_date_min, 'session.combined_cart_evidence.home_delivery_29660.delivery_date_min');
  const deliveryDateMax = asDateOnly(cartDelivery.delivery_date_max, 'session.combined_cart_evidence.home_delivery_29660.delivery_date_max');
  if (deliveryDateMax.valueOf() < deliveryDateMin.valueOf()) throw new Error('Session delivery window maximum cannot be earlier than its minimum');
  const availableOffers = [...selectedByTwin.values()].map((entry) => entry.offer).filter((offer) => offer.delivery.destination_state === 'AVAILABLE');
  if (availableOffers.some((offer) => offer.delivery.lead_time_days_min !== cartDelivery.lead_time_days_min || offer.delivery.lead_time_days_max !== cartDelivery.lead_time_days_max)) {
    throw new Error('Combined-cart lead-time window does not match the selected available offer evidence');
  }
  return {currency, availableCount, unavailableCount, availableSubtotal: round(availableSubtotal), totalSubtotal: round(totalSubtotal)};
}

function buildCostSummary(lines, session, currency) {
  const specified = lines.reduce((sum, line) => sum + line.primary_product.merchandise_total.amount, 0);
  const deliverableClasses = new Set(['LOCAL', 'CONFIRMED_WITHIN_10_DAYS', 'CONFIRMED_BEYOND_10_DAYS']);
  const deliverableLines = lines.filter((line) => deliverableClasses.has(line.primary_product.supply_class));
  const deliverable = deliverableLines
    .reduce((sum, line) => sum + line.primary_product.merchandise_total.amount, 0);
  const allPrimaryEvidenceCurrent = lines.every((line) => line.primary_product.evidence.freshness_state === 'CURRENT');
  const deliverableEvidenceCurrent = deliverableLines.length > 0 && deliverableLines.every((line) => line.primary_product.evidence.freshness_state === 'CURRENT');
  return {
    specified_merchandise: costComponent(allPrimaryEvidenceCurrent ? 'VERIFIED' : 'HISTORICAL', round(specified), currency,
      allPrimaryEvidenceCurrent
        ? 'Eight current official product-page prices; this includes the unavailable specified LISTERBY line.'
        : 'Historical product-page price snapshot retained for provenance; it is not current procurement evidence.', FILES.offers),
    currently_deliverable_merchandise: costComponent(deliverableEvidenceCurrent ? 'VERIFIED' : 'UNVERIFIED', deliverableEvidenceCurrent ? round(deliverable) : null, currency,
      deliverableEvidenceCurrent
        ? 'Selected primary products with current destination delivery and a dated lead-time classification.'
        : 'No current, destination-confirmed merchandise subtotal is available.', FILES.offers),
    freight: costComponent('CONTAMINATED_EVIDENCE', null, currency,
      `The captured ${session.combined_cart_evidence.home_delivery_29660.standard_delivery_charge.amount} ${currency} quote includes two accidental accessories and cannot be allocated cleanly.`, FILES.session),
    tax_and_duty: costComponent('UNVERIFIED', null, currency,
      'Destination tax treatment, included VAT disclosure and any duty are not joined at plan level.'),
    installation: costComponent('UNVERIFIED', null, currency,
      'Assembly, placement, electrical connection and installer scope are not quoted.'),
    contingency: costComponent('UNVERIFIED', null, currency,
      'No approved contingency basis or percentage is present.'),
    landed_total: costComponent('UNVERIFIED', null, currency,
      'Landed total is withheld until freight, tax/duty, handling, unloading, installation and contingency are complete.')
  };
}

function buildDeliverySchedule(lines, session) {
  const confirmed = lines.filter((line) => ['LOCAL', 'CONFIRMED_WITHIN_10_DAYS', 'CONFIRMED_BEYOND_10_DAYS'].includes(line.primary_product.supply_class));
  const blocked = lines.filter((line) => !confirmed.includes(line));
  const sessionDelivery = session.combined_cart_evidence.home_delivery_29660;
  return {
    state: 'BLOCKED',
    required_on_site_date: null,
    scheduled_groups: confirmed.length ? [{
      delivery_group_id: 'DELIVERY_GROUP_IKEA_ES_ROOM_BASELINE',
      state: 'EVIDENCE_WINDOW_ONLY',
      line_item_ids: confirmed.map((line) => line.line_item_id),
      delivery_date_min: sessionDelivery.delivery_date_min,
      delivery_date_max: sessionDelivery.delivery_date_max,
      membership_evidence_state: 'COUNT_RECONCILED_NOT_ITEMIZED',
      source_ref: FILES.session,
      booking_state: 'NOT_BOOKED'
    }] : [],
    blocked_line_item_ids: blocked.map((line) => line.line_item_id),
    unscheduled_reason: 'The required-on-site date, clean freight quote, site access, procurement approvals and one selected product route are unresolved.'
  };
}

function buildFreshness(lines, asOf) {
  const records = [
    ...lines.map((line) => line.primary_product.evidence),
    ...lines.flatMap((line) => line.alternatives.map((alternative) => alternative.evidence))
  ];
  const counts = Object.fromEntries(['CURRENT', 'EXPIRED', 'REFRESH_REQUIRED', 'UNKNOWN'].map((state) => [state, records.filter((record) => record.freshness_state === state).length]));
  const currentExpiries = records
    .filter((record) => record.freshness_state === 'CURRENT' && record.expires_at)
    .map((record) => record.expires_at)
    .sort((a, b) => new Date(a) - new Date(b));
  const overallState = counts.REFRESH_REQUIRED
    ? 'REFRESH_REQUIRED'
    : counts.EXPIRED
      ? 'EXPIRED'
      : counts.UNKNOWN
        ? 'UNKNOWN'
        : 'CURRENT';
  return {
    evaluated_at: asOf.toISOString(),
    overall_state: overallState,
    current_until: currentExpiries[0] ?? null,
    current_count: counts.CURRENT,
    expired_count: counts.EXPIRED,
    refresh_required_count: counts.REFRESH_REQUIRED,
    unknown_count: counts.UNKNOWN,
    policy: 'Price, stock and delivery evidence is checked daily while shown as current and immediately before approval or purchase.',
    monitor: {
      owner: 'Verification, Evidence & Monitoring',
      cadence: 'DAILY_WHILE_SHOWN_AS_CURRENT_AND_IMMEDIATELY_BEFORE_PURCHASE',
      failure_destination: 'Build, Procurement & Logistics OS risk register and Room Lab supply state',
      last_checked_at: asOf.toISOString(),
      renewal_condition: 'Refresh every selected and alternative offer for destination ES 29660 and generate a new versioned observation.',
      stop_condition: 'Stop when the room plan is superseded, rejected or no longer shown as current.'
    }
  };
}

function buildRisks(lines) {
  const all = lines.map((line) => line.line_item_id);
  const unavailable = lines.filter((line) => line.primary_product.supply_class === 'UNAVAILABLE').map((line) => line.line_item_id);
  const unverified = lines.filter((line) => line.primary_product.supply_class === 'UNVERIFIED').map((line) => line.line_item_id);
  const deliverable = lines.filter((line) => ['LOCAL', 'CONFIRMED_WITHIN_10_DAYS', 'CONFIRMED_BEYOND_10_DAYS'].includes(line.primary_product.supply_class)).map((line) => line.line_item_id);
  const withAlternative = lines.filter((line) => line.alternatives.length).map((line) => line.line_item_id);
  const risks = [];
  if (unavailable.length) risks.push({
      risk_id: 'RISK_SELECTED_PRODUCT_UNAVAILABLE', category: 'supply', severity: 'HIGH', state: 'OPEN', affected_line_item_ids: unavailable,
      evidence: 'LISTERBY is unavailable for the exact ES 29660 route in the dated observation.',
      mitigation: 'Keep LISTERBY selected and visibly blocked; fit-check and explicitly approve VALNÄS or another exact alternative before changing the design.', owner: 'Build, Procurement & Logistics OS'
  });
  if (unverified.length) risks.push({
    risk_id: 'RISK_SELECTED_SUPPLY_UNVERIFIED', category: 'supply', severity: 'HIGH', state: 'OPEN', affected_line_item_ids: unverified,
    evidence: 'One or more selected routes lack current destination and lead-time evidence.',
    mitigation: 'Refresh exact destination evidence before making an availability or schedule claim.', owner: 'Build, Procurement & Logistics OS'
  });
  risks.push(
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
  return risks;
}

function buildGlobalReadiness({lines, costSummary, deliverySchedule, freshness}) {
  const unavailableOrUnverified = lines.filter((line) => ['UNAVAILABLE', 'UNVERIFIED'].includes(line.primary_product.supply_class));
  const rescueLines = lines.filter((line) => ['UNAVAILABLE', 'UNVERIFIED'].includes(line.primary_product.supply_class));
  const substitutionRescuePassed = rescueLines.every((line) => line.alternatives.some((alternative) => alternative.state === 'APPROVED'));
  const purchaseRefreshPassed = lines.every((line) => line.primary_product.evidence.refresh_before_purchase === false);
  const gates = [
    gate('SOURCE_PLACEMENT_COMPLETE', 'BLOCKED', true, 'Room Lab transforms and bundle membership are not present in the frozen repository manifest.'),
    gate('MERCHANDISE_RECONCILIATION', costSummary.specified_merchandise.state === 'VERIFIED' ? 'PASS' : 'BLOCKED', true, 'Every selected line has a current comparable-currency product-page price.'),
    gate('DESTINATION_SUPPLY_ALL_LINES', unavailableOrUnverified.length ? 'BLOCKED' : 'PASS', true, unavailableOrUnverified.length ? `${unavailableOrUnverified.length} selected line is unavailable or unverified.` : 'Every selected line has confirmed destination supply.'),
    gate('SUBSTITUTION_APPROVALS', substitutionRescuePassed ? 'PASS' : 'BLOCKED', true, substitutionRescuePassed ? 'Every blocked selected line has an approved alternative.' : 'At least one blocked selected line lacks an approved alternative.'),
    gate('LINE_PROCUREMENT_APPROVALS', lines.every((line) => line.approval_state === 'PROCUREMENT_APPROVED') ? 'PASS' : 'BLOCKED', true, 'No hashed line-level procurement-approval source is attached.'),
    gate('EVIDENCE_FRESHNESS', freshness.overall_state === 'CURRENT' ? 'PASS' : 'BLOCKED', true, `Evidence freshness is ${freshness.overall_state}.`),
    gate('PURCHASE_TIME_REFRESH', purchaseRefreshPassed ? 'PASS' : 'BLOCKED', true, purchaseRefreshPassed ? 'Purchase-time offer refresh is complete.' : 'A new price, stock and delivery observation is required immediately before purchase.'),
    gate('CLEAN_FREIGHT', costSummary.freight.state === 'VERIFIED' ? 'PASS' : 'BLOCKED', true, costSummary.freight.reason),
    gate('TAX_AND_DUTY', costSummary.tax_and_duty.state === 'VERIFIED' ? 'PASS' : 'BLOCKED', true, costSummary.tax_and_duty.reason),
    gate('INSTALLATION', costSummary.installation.state === 'VERIFIED' ? 'PASS' : 'BLOCKED', true, costSummary.installation.reason),
    gate('CONTINGENCY', costSummary.contingency.state === 'VERIFIED' ? 'PASS' : 'BLOCKED', true, costSummary.contingency.reason),
    gate('LANDED_TOTAL', costSummary.landed_total.state === 'VERIFIED' ? 'PASS' : 'BLOCKED', true, costSummary.landed_total.reason),
    gate('REQUIRED_ON_SITE_DATE', deliverySchedule.required_on_site_date ? 'PASS' : 'BLOCKED', true, 'No required-on-site date is attached.'),
    gate('SITE_ACCESS', 'BLOCKED', true, 'Delivery access, unloading and storage constraints are unverified.'),
    gate('MUTABLE_CHECKOUT_PAYLOAD_EXCLUDED', 'PASS', true, 'The permanent plan contains evidence references, not mutable cart or order payloads.')
  ];
  const blockingGateIds = gates.filter((item) => item.critical && item.state !== 'PASS').map((item) => item.gate);
  return {
    purchase_ready: blockingGateIds.length === 0,
    state: blockingGateIds.length ? 'BLOCKED' : 'READY',
    gate_policy: 'Purchase readiness is true only when every critical deterministic gate passes; prose judgement cannot waive a failure.',
    gates,
    blocking_gate_ids: blockingGateIds
  };
}

export function buildProcurementPlan({design, evidence, session, asOf}) {
  const evaluatedAt = asOf instanceof Date ? asOf : asDate(asOf, 'asOf');
  const destination = {...design.destination, site_access_state: 'UNVERIFIED', local_supply_radius_km: LOCAL_SUPPLY_RADIUS_KM};
  const offerByRef = new Map(evidence.offers.map((offer) => [offer.offer_ref, offer]));
  const placementById = new Map(design.placements.map((placement) => [placement.placement_id, placement]));
  const substitutionsByPlacement = new Map();

  if (evidence.design_id !== design.design_id) throw new Error('Offer evidence design_id does not match the frozen design');
  for (const placement of design.placements) {
    const scopedOffer = requireValue(offerByRef.get(placement.offer_ref), `Missing offer ${placement.offer_ref}`);
    if (!routeMatchesDestination(scopedOffer, destination)) {
      throw new Error(`Destination-specific evidence is required for ${destination.country} ${destination.postal_code}; refusing to reuse ${scopedOffer.delivery?.country} ${scopedOffer.delivery?.postal_code} evidence`);
    }
  }
  const selectedCurrencies = new Set(design.placements.map((placement) => offerByRef.get(placement.offer_ref)?.price?.currency));
  if (selectedCurrencies.size !== 1 || selectedCurrencies.has(undefined)) throw new Error('Selected primary offers must use one comparable currency');
  const [selectedCurrency] = selectedCurrencies;
  validateSessionEvidence({design, evidence, session, asOf: evaluatedAt});

  for (const candidate of evidence.substitution_candidates ?? []) {
    const alternativeOffer = offerByRef.get(candidate.alternative_offer_ref);
    if (!alternativeOffer) continue;
    const sourcePlacement = requireValue(placementById.get(candidate.source_placement_id), `Alternative ${candidate.substitution_id} has no source placement`);
    if (candidate.source_twin_id !== sourcePlacement.twin_id) throw new Error(`Alternative ${candidate.substitution_id} source Product Twin does not match its placement`);
    const primaryOffer = requireValue(offerByRef.get(sourcePlacement.offer_ref), `Alternative ${candidate.substitution_id} has no selected primary offer`);
    if (!routeMatchesDestination(alternativeOffer, destination)) throw new Error(`Alternative ${candidate.substitution_id} requires destination-specific evidence for ${destination.country} ${destination.postal_code}`);
    if (alternativeOffer.price?.currency !== selectedCurrency) throw new Error(`Alternative ${candidate.substitution_id} currency ${alternativeOffer.price?.currency} does not match plan currency ${selectedCurrency}`);
    const list = substitutionsByPlacement.get(candidate.source_placement_id) ?? [];
    list.push(buildAlternative(candidate, alternativeOffer, primaryOffer, destination, evaluatedAt));
    substitutionsByPlacement.set(candidate.source_placement_id, list);
  }

  const lines = design.placements.map((placement) => {
    const offer = requireValue(offerByRef.get(placement.offer_ref), `Missing offer ${placement.offer_ref}`);
    return buildLine({
      placement,
      offer,
      alternatives: substitutionsByPlacement.get(placement.placement_id) ?? [],
      destination,
      asOf: evaluatedAt
    });
  });

  const currency = [...new Set(lines.map((line) => line.primary_product.unit_price.currency))];
  if (currency.length !== 1) throw new Error(`Plan requires one comparable currency; found ${currency.join(', ')}`);
  const planCurrency = currency[0];
  const costSummary = buildCostSummary(lines, session, planCurrency);
  const deliverySchedule = buildDeliverySchedule(lines, session);
  const freshness = buildFreshness(lines, evaluatedAt);
  const readiness = buildGlobalReadiness({lines, costSummary, deliverySchedule, freshness});
  const placedUnits = design.placements.reduce((sum, placement) => sum + placement.quantity, 0);

  return {
    schema_version: '1.0.0',
    plan_id: `PROC_PLAN_ROOM_LAB_LIVING_${destination.country}_${String(destination.postal_code).replaceAll(/[^A-Za-z0-9]/g, '_').toUpperCase()}`,
    revision: 1,
    status: readiness.purchase_ready ? 'PURCHASE_READY' : 'DRAFT_NOT_PURCHASE_READY',
    generated_at: evaluatedAt.toISOString(),
    source_snapshot: {
      design: {path: FILES.design, version: design.version, identity: design.design_id, sha256: hashObject(design)},
      offer_evidence: {path: FILES.offers, version: evidence.version, identity: evidence.design_id, sha256: hashObject(evidence)},
      session_evidence: {path: FILES.session, version: session.observed_at, identity: session.session_id, sha256: hashObject(session)},
      approval_evidence: null,
      site_access_evidence: null,
      placement_snapshot: {
        state: 'IDENTITY_QUANTITY_ONLY',
        placement_line_count: design.placements.length,
        placed_unit_count: placedUnits,
        transforms_included: false,
        bundle_membership_included: false,
        missing_inputs: ['versioned Room Lab transforms', 'bundle membership and placed-avatar quantities']
      }
    },
    destination,
    currency: planCurrency,
    packages: buildPackages(lines),
    line_items: lines,
    classification_summary: buildClassificationSummary(lines),
    cost_summary: costSummary,
    delivery_schedule: deliverySchedule,
    risk_register: buildRisks(lines),
    evidence_freshness: freshness,
    procurement_readiness: readiness,
    consumer_contract: {
      consumer: 'ROOM_LAB',
      manifest_role: 'PROCUREMENT_PLAN',
      selected_design_mutated: false,
      conditional_alternatives_auto_applied: false,
      mutable_checkout_payloads_embedded: false,
      notes: [
        'Room Lab owns placement transforms and bundle truth; this plan owns supply, cost, schedule, risk and readiness.',
        'VALNÄS is a separate conditional scenario and does not replace LISTERBY in the selected design.',
        'SE, GB and US must use separate destination evidence and are not inferred from this Spain plan.'
      ]
    }
  };
}

function parseAsOf(argv) {
  const inline = argv.find((argument) => argument.startsWith('--as-of='));
  if (inline) return asDate(inline.slice('--as-of='.length), '--as-of');
  const index = argv.indexOf('--as-of');
  if (index >= 0) return asDate(argv[index + 1], '--as-of');
  return new Date();
}

async function main() {
  const [design, evidence, session] = await Promise.all([
    fs.readFile(path.join(ROOT, FILES.design), 'utf8').then(JSON.parse),
    fs.readFile(path.join(ROOT, FILES.offers), 'utf8').then(JSON.parse),
    fs.readFile(path.join(ROOT, FILES.session), 'utf8').then(JSON.parse)
  ]);
  const plan = buildProcurementPlan({design, evidence, session, asOf: parseAsOf(process.argv.slice(2))});
  await fs.writeFile(path.join(ROOT, FILES.output), `${JSON.stringify(plan, null, 2)}\n`);
  console.log(JSON.stringify({
    plan_id: plan.plan_id,
    output: FILES.output,
    status: plan.status,
    classification_summary: plan.classification_summary,
    specified_merchandise: plan.cost_summary.specified_merchandise,
    currently_deliverable_merchandise: plan.cost_summary.currently_deliverable_merchandise,
    blocking_gate_ids: plan.procurement_readiness.blocking_gate_ids
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
