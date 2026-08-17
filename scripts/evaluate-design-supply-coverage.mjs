import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const ROOT = process.cwd();
const FILES = {
  contract: 'config/design-supply-coverage-v0.1.json',
  markets: 'config/market-benchmarks-v0.1.json',
  anchors: 'config/market-anchor-suppliers-v0.1.json',
  design: 'data/showrooms/living-room-client-design-v0.1.json',
  evidence: 'data/procurement/living-room-design-offers-v0.1.json',
  output: 'data/procurement/living-room-design-supply-coverage-v0.1.json',
  metric: 'data/metrics/design-supply-coverage-latest.json'
};

const round = (value, places = 2) => Number(value.toFixed(places));
const CONFIRMED_OUTCOMES = new Set([
  'LOCAL_MARKET_CONFIRMED',
  'NON_LOCAL_UP_TO_10_DAYS_CONFIRMED',
  'NON_LOCAL_11_TO_30_DAYS_CONFIRMED',
  'NON_LOCAL_OVER_30_DAYS_CONFIRMED',
  'DESTINATION_CONFIRMED_ORIGIN_OR_LEAD_UNKNOWN'
]);

function originCountry(offer) {
  return offer?.dispatch_country ?? offer?.seller_country ?? null;
}

function routeMatchesDestination(offer, destination) {
  if (!offer || !destination?.country) return false;
  return offer.delivery?.country === destination.country || offer.retailer_territory_country === destination.country;
}

function exactDestinationDelivery(offer, destination) {
  if (!routeMatchesDestination(offer, destination) || offer?.delivery?.exact_destination_confirmed !== true) return false;
  if (destination.postal_code && offer.delivery.postal_code !== destination.postal_code) return false;
  return true;
}

function leadTime(offer) {
  const min = offer?.delivery?.lead_time_days_min;
  const max = offer?.delivery?.lead_time_days_max;
  return Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max >= min ? {min, max} : null;
}

export function classifyPlacement({placement, offer, destination}) {
  const origin = originCountry(offer);
  const routeMatch = routeMatchesDestination(offer, destination);
  const exactDelivery = exactDestinationDelivery(offer, destination);
  const destinationUnavailable = routeMatch && offer?.delivery?.destination_state === 'UNAVAILABLE';
  const lead = leadTime(offer);
  const localOrigin = origin === destination.country;

  const supplierGeography = localOrigin
    ? 'LOCAL_SELLER_OR_DISPATCH_CONFIRMED'
    : origin
      ? 'NON_LOCAL_ORIGIN_CONFIRMED'
      : 'ORIGIN_UNRESOLVED';

  const deliveryTimeline = destinationUnavailable
    ? 'DESTINATION_UNAVAILABLE_CONFIRMED'
    : exactDelivery && lead
      ? lead.max <= 10
        ? 'UP_TO_10_DAYS_CONFIRMED'
        : lead.max <= 30
          ? '11_TO_30_DAYS_CONFIRMED'
          : 'OVER_30_DAYS_CONFIRMED'
      : 'DELIVERY_UNCONFIRMED';

  let outcome = 'UNRESOLVED';
  if (destinationUnavailable) outcome = 'DESTINATION_UNAVAILABLE_CONFIRMED';
  else if (exactDelivery && localOrigin) outcome = 'LOCAL_MARKET_CONFIRMED';
  else if (exactDelivery && origin && lead?.max <= 10) outcome = 'NON_LOCAL_UP_TO_10_DAYS_CONFIRMED';
  else if (exactDelivery && origin && lead?.max <= 30) outcome = 'NON_LOCAL_11_TO_30_DAYS_CONFIRMED';
  else if (exactDelivery && origin && lead?.max > 30) outcome = 'NON_LOCAL_OVER_30_DAYS_CONFIRMED';
  else if (exactDelivery) outcome = 'DESTINATION_CONFIRMED_ORIGIN_OR_LEAD_UNKNOWN';
  else if (routeMatch && offer?.catalog_route_state && offer?.live_refresh_required === true) outcome = 'ROUTE_REFRESH_REQUIRED';

  return {
    placement_id: placement.placement_id,
    role: placement.role,
    twin_id: placement.twin_id,
    avatar_id: placement.avatar_id,
    selected_configuration: placement.selected_configuration,
    quantity: placement.quantity,
    offer_ref: placement.offer_ref ?? null,
    seller: offer ? {seller_id: offer.seller_id, seller_name: offer.seller_name} : null,
    outcome,
    supplier_geography: supplierGeography,
    delivery_timeline: deliveryTimeline,
    evidence: {
      destination,
      retailer_territory_country: offer?.retailer_territory_country ?? null,
      seller_country: offer?.seller_country ?? null,
      dispatch_country: offer?.dispatch_country ?? null,
      exact_destination_confirmed: exactDelivery,
      destination_state: offer?.delivery?.destination_state ?? null,
      lead_time_days: lead,
      price: offer?.price ?? null,
      price_state: offer?.price_state ?? null,
      landed_value: offer?.landed_value ?? null,
      stock_state: offer?.stock_state ?? 'UNRESOLVED',
      observed_at: offer?.observed_at ?? null,
      expires_at: offer?.expires_at ?? null,
      live_refresh_required: offer?.live_refresh_required === true
    }
  };
}

function distribution(rows, key, orderedKeys, weight) {
  const total = rows.reduce((sum, row) => sum + weight(row), 0);
  return {
    total_weight: total,
    buckets: orderedKeys.map((bucket) => {
      const bucketWeight = rows.filter((row) => row[key] === bucket).reduce((sum, row) => sum + weight(row), 0);
      return {bucket, weight: bucketWeight, percentage: total ? round((bucketWeight / total) * 100) : 0};
    })
  };
}

function valueAvailability(rows, field) {
  const values = rows.map((row) => row.evidence[field]);
  const usable = values.every((value) => value && Number.isFinite(Number(value.amount)) && value.currency);
  const currencies = [...new Set(values.filter(Boolean).map((value) => value.currency))];
  if (!usable) return {available: false, reason: `Every placement needs a current ${field} before this percentage basis can be emitted.`};
  if (currencies.length !== 1) return {available: false, reason: `${field} currencies are not comparable without a dated conversion policy.`, currencies};
  return {available: true, currency: currencies[0]};
}

function valueCoverage(rows, field, contract) {
  const availability = valueAvailability(rows, field);
  if (!availability.available) return availability;
  const weight = (row) => row.quantity * Number(row.evidence[field].amount);
  return {
    ...availability,
    total_value: round(rows.reduce((sum, row) => sum + weight(row), 0)),
    outcome: distribution(rows, 'outcome', contract.client_panels.outcome, weight),
    supplier_geography: distribution(rows, 'supplier_geography', contract.client_panels.supplier_geography, weight),
    delivery_timeline: distribution(rows, 'delivery_timeline', contract.client_panels.delivery_timeline, weight)
  };
}

function headlineCoverage(rows) {
  const confirmedUnits = rows.filter((row) => CONFIRMED_OUTCOMES.has(row.outcome)).reduce((sum, row) => sum + row.quantity, 0);
  const unavailableUnits = rows.filter((row) => row.outcome === 'DESTINATION_UNAVAILABLE_CONFIRMED').reduce((sum, row) => sum + row.quantity, 0);
  const routeRefreshUnits = rows.filter((row) => row.outcome === 'ROUTE_REFRESH_REQUIRED').reduce((sum, row) => sum + row.quantity, 0);
  const totalUnits = rows.reduce((sum, row) => sum + row.quantity, 0);
  return {
    confirmed_deliverable_percentage_by_units: totalUnits ? round(confirmedUnits / totalUnits * 100) : 0,
    confirmed_unavailable_percentage_by_units: totalUnits ? round(unavailableUnits / totalUnits * 100) : 0,
    exact_route_refresh_required_percentage_by_units: totalUnits ? round(routeRefreshUnits / totalUnits * 100) : 0,
    unresolved_or_incomplete_percentage_by_units: totalUnits ? round((totalUnits - confirmedUnits - unavailableUnits - routeRefreshUnits) / totalUnits * 100) : 0
  };
}

function evaluateSubstitutions(candidates, placements) {
  const placementIds = new Set(placements.map((placement) => placement.placement_id));
  return (candidates ?? []).map((candidate) => {
    const blockers = [];
    if (!placementIds.has(candidate.source_placement_id)) blockers.push('source placement is not in the design');
    if (candidate.role_match !== 'PASS') blockers.push('design role is not approved');
    if (candidate.dimension_and_circulation_fit !== 'PASS') blockers.push('dimension and circulation fit needs review');
    if (candidate.technical_compatibility !== 'PASS') blockers.push('technical compatibility is not fully passed');
    if (candidate.colour_finish_material_match !== 'PASS') blockers.push('colour, finish and material need review');
    if (candidate.client_design_approval !== 'APPROVED') blockers.push('client design approval is required');
    if (!String(candidate.destination_offer_state).includes('CONFIRMED')) blockers.push('destination offer and delivery are not confirmed');
    return {
      ...candidate,
      coverage_rescue_state: blockers.length ? 'CANDIDATE_ONLY' : 'CONFIRMED_ELIGIBLE_AFTER_SWAP',
      blockers
    };
  });
}

function buildConditionalSubstitutionScenarios({substitutions, placements, currentRows, offers, destination, contract}) {
  const placementById = new Map(placements.map((placement) => [placement.placement_id, placement]));
  const rowById = new Map(currentRows.map((row) => [row.placement_id, row]));
  const currentHeadline = headlineCoverage(currentRows);
  return substitutions.map((candidate) => {
    const sourcePlacement = placementById.get(candidate.source_placement_id);
    const sourceRow = rowById.get(candidate.source_placement_id);
    const alternativeOffer = offers.get(candidate.alternative_offer_ref);
    if (!sourcePlacement || !sourceRow || !alternativeOffer) {
      return {
        substitution_id: candidate.substitution_id,
        scenario_state: 'NO_CONFIRMED_SUPPLY_RESCUE',
        counted_in_current_design_coverage: false,
        reason: 'The source placement or exact alternative offer evidence is missing.'
      };
    }
    const alternativePlacement = {
      ...sourcePlacement,
      twin_id: candidate.alternative_twin_id,
      avatar_id: candidate.alternative_avatar_id ?? null,
      selected_configuration: candidate.alternative_configuration ?? null,
      offer_ref: candidate.alternative_offer_ref
    };
    const alternativeRow = classifyPlacement({placement: alternativePlacement, offer: alternativeOffer, destination});
    const scenarioRows = currentRows.map((row) => row.placement_id === candidate.source_placement_id ? alternativeRow : row);
    const conditionalHeadline = headlineCoverage(scenarioRows);
    const supplyRescue = !CONFIRMED_OUTCOMES.has(sourceRow.outcome) && CONFIRMED_OUTCOMES.has(alternativeRow.outcome);
    return {
      substitution_id: candidate.substitution_id,
      scenario_state: supplyRescue
        ? candidate.blockers.length
          ? 'CONDITIONAL_NOT_APPROVED'
          : 'CONFIRMED_ELIGIBLE_AFTER_SWAP'
        : 'NO_CONFIRMED_SUPPLY_RESCUE',
      counted_in_current_design_coverage: false,
      source: {placement_id: sourcePlacement.placement_id, twin_id: sourcePlacement.twin_id, outcome: sourceRow.outcome},
      alternative: {
        twin_id: alternativePlacement.twin_id,
        avatar_id: alternativePlacement.avatar_id,
        selected_configuration: alternativePlacement.selected_configuration,
        offer_ref: alternativePlacement.offer_ref,
        outcome: alternativeRow.outcome,
        price: alternativeRow.evidence.price,
        delivery_timeline: alternativeRow.delivery_timeline
      },
      current_headline: currentHeadline,
      conditional_headline: conditionalHeadline,
      confirmed_deliverable_lift_percentage_points: round(conditionalHeadline.confirmed_deliverable_percentage_by_units - currentHeadline.confirmed_deliverable_percentage_by_units),
      conditional_merchandise_value: valueCoverage(scenarioRows, 'price', contract),
      remaining_gates: candidate.blockers,
      policy: 'This is a what-if supply scenario only. It does not alter the selected design or current coverage until every remaining gate passes and the client approves the swap.'
    };
  });
}

export function evaluateDesignSupplyCoverage({contract, marketConfig, anchorConfig = {markets: []}, design, evidence}) {
  const offers = new Map((evidence.offers ?? []).map((offer) => [offer.offer_ref, offer]));
  const outcomeKeys = contract.client_panels.outcome;
  const geographyKeys = contract.client_panels.supplier_geography;
  const timelineKeys = contract.client_panels.delivery_timeline;

  const evaluateMarket = (market) => {
    const destination = market.country === design.destination.country
      ? design.destination
      : {country: market.country, postal_code: null, destination_state: 'BENCHMARK_ADDRESS_REQUIRED'};
    const rows = design.placements.map((placement) => classifyPlacement({placement, offer: offers.get(placement.offer_ref), destination}));
    const byLineItem = {
      outcome: distribution(rows, 'outcome', outcomeKeys, () => 1),
      supplier_geography: distribution(rows, 'supplier_geography', geographyKeys, () => 1),
      delivery_timeline: distribution(rows, 'delivery_timeline', timelineKeys, () => 1)
    };
    const byUnitQuantity = {
      outcome: distribution(rows, 'outcome', outcomeKeys, (row) => row.quantity),
      supplier_geography: distribution(rows, 'supplier_geography', geographyKeys, (row) => row.quantity),
      delivery_timeline: distribution(rows, 'delivery_timeline', timelineKeys, (row) => row.quantity)
    };
    const anchorMarket = anchorConfig.markets.find((entry) => entry.country === market.country) ?? {anchor_candidates: []};
    const connectedAnchors = anchorMarket.anchor_candidates.filter((candidate) => candidate.connection_state.startsWith('EXACT_PRODUCT_ROUTES_CONNECTED'));
    const connectedAnchorRoles = [...new Set(connectedAnchors.map((candidate) => candidate.role))];
    const requiredAnchorRoles = Object.keys(anchorConfig.minimum_market_coverage ?? {});
    return {
      country: market.country,
      name: market.name,
      currency: market.currency,
      destination,
      headline: headlineCoverage(rows),
      local_anchor_network: {
        candidates: anchorMarket.anchor_candidates,
        connected_anchor_roles: connectedAnchorRoles,
        required_anchor_roles: requiredAnchorRoles,
        state: requiredAnchorRoles.length > 0 && requiredAnchorRoles.every((role) => connectedAnchorRoles.includes(role))
          ? 'V0_ANCHOR_NETWORK_CONNECTED'
          : connectedAnchorRoles.length
            ? 'PARTIAL'
            : 'NOT_CONNECTED'
      },
      coverage: {by_line_item: byLineItem, by_unit_quantity: byUnitQuantity},
      placements: rows
    };
  };

  const benchmarks = marketConfig.markets.map(evaluateMarket);
  const currentMarket = benchmarks.find((market) => market.country === design.destination.country);
  const substitutions = evaluateSubstitutions(evidence.substitution_candidates, design.placements);
  const conditionalScenarios = buildConditionalSubstitutionScenarios({
    substitutions,
    placements: design.placements,
    currentRows: currentMarket.placements,
    offers,
    destination: design.destination,
    contract
  });
  const substitutionSourcePlacements = new Set(substitutions.map((candidate) => candidate.source_placement_id));
  const eligibleSubstitutionPlacements = new Set(substitutions.filter((candidate) => candidate.coverage_rescue_state === 'CONFIRMED_ELIGIBLE_AFTER_SWAP').map((candidate) => candidate.source_placement_id));

  return {
    version: '0.1',
    generated_at: new Date().toISOString(),
    contract_id: contract.contract_id,
    design: {
      design_id: design.design_id,
      project_id: design.project_id,
      space_id: design.space_id,
      name: design.name,
      destination: design.destination,
      placement_line_items: design.placements.length,
      placed_units: design.placements.reduce((sum, placement) => sum + placement.quantity, 0),
      avatar_rule: 'Every placement keeps its Product Twin, exact selected configuration and avatar; supply evidence refreshes independently.'
    },
    current_design_coverage: currentMarket,
    value_coverage: {
      merchandise_value: valueCoverage(currentMarket.placements, 'price', contract),
      landed_value: valueCoverage(currentMarket.placements, 'landed_value', contract)
    },
    substitutions: {
      candidates: substitutions,
      placements_with_candidate_alternatives: substitutionSourcePlacements.size,
      candidate_alternative_coverage_percentage_by_line_item: round(substitutionSourcePlacements.size / design.placements.length * 100),
      placements_with_confirmed_eligible_alternatives: eligibleSubstitutionPlacements.size,
      confirmed_alternative_coverage_percentage_by_line_item: round(eligibleSubstitutionPlacements.size / design.placements.length * 100),
      conditional_scenarios: conditionalScenarios,
      policy: contract.substitution_rules.principle
    },
    benchmark_markets: benchmarks.map(({placements, ...market}) => ({...market, evidence_line_count: placements.length})),
    client_language: {
      current_truth: `${currentMarket.headline.confirmed_deliverable_percentage_by_units}% of placed units currently have confirmed delivery evidence in ${currentMarket.name}; ${currentMarket.headline.confirmed_unavailable_percentage_by_units}% are confirmed unavailable at the destination; ${currentMarket.headline.exact_route_refresh_required_percentage_by_units}% still await live destination refresh.`,
      unresolved_rule: 'Percentages never silently normalize away missing evidence; any remainder is shown as route refresh required or unresolved.',
      alternative_rule: 'Similar products are shown beside the design impact and cannot be counted as confirmed coverage until fit, finish, technical, client-approval and destination-delivery gates pass.',
      scenario_rule: 'A conditional scenario may show the supply coverage available after a proposed swap, but it is always separate from current design coverage and never implies approval.'
    }
  };
}

async function readJson(relativePath) {
  return fs.readFile(path.join(ROOT, relativePath), 'utf8').then(JSON.parse);
}

async function main() {
  const [contract, marketConfig, anchorConfig, design, evidence] = await Promise.all([
    readJson(FILES.contract), readJson(FILES.markets), readJson(FILES.anchors), readJson(FILES.design), readJson(FILES.evidence)
  ]);
  const report = evaluateDesignSupplyCoverage({contract, marketConfig, anchorConfig, design, evidence});
  await fs.mkdir(path.join(ROOT, 'data/procurement'), {recursive: true});
  await fs.mkdir(path.join(ROOT, 'data/metrics'), {recursive: true});
  await fs.writeFile(path.join(ROOT, FILES.output), `${JSON.stringify(report, null, 2)}\n`);
  const metric = {
    generated_at: report.generated_at,
    contract_id: report.contract_id,
    design: report.design,
    current_market_headline: report.current_design_coverage.headline,
    benchmark_markets: report.benchmark_markets.map((market) => ({country: market.country, name: market.name, headline: market.headline})),
    substitutions: {
      candidates: report.substitutions.candidates.length,
      candidate_alternative_coverage_percentage_by_line_item: report.substitutions.candidate_alternative_coverage_percentage_by_line_item,
      confirmed_alternative_coverage_percentage_by_line_item: report.substitutions.confirmed_alternative_coverage_percentage_by_line_item,
      conditional_scenarios: report.substitutions.conditional_scenarios.map((scenario) => ({
        substitution_id: scenario.substitution_id,
        scenario_state: scenario.scenario_state,
        conditional_confirmed_deliverable_percentage_by_units: scenario.conditional_headline?.confirmed_deliverable_percentage_by_units ?? null,
        confirmed_deliverable_lift_percentage_points: scenario.confirmed_deliverable_lift_percentage_points ?? null
      }))
    }
  };
  await fs.writeFile(path.join(ROOT, FILES.metric), `${JSON.stringify(metric, null, 2)}\n`);
  console.log(JSON.stringify(metric, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
