import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const ROOT = process.cwd();
const FILES = {
  contract: 'config/product-twin-readiness-card-v0.1.json',
  reconstruction: 'data/metrics/avatar-reconstruction-readiness-latest.json',
  focusedCommerce: 'data/commerce/shopify-design-public-model3d-spain-joins-2026-08-17.json',
  broadCandidates: 'data/identity/shopify-furniture-model3d-candidates.json',
  twinDir: 'data/twins',
  output: 'data/procurement/living-room-furniture-twin-readiness-v0.1.json',
  metric: 'data/metrics/product-twin-readiness-latest.json'
};

function merchantProductId(twin) {
  return (twin.external_identities ?? []).find((identity) => identity.merchant_product_gid)?.merchant_product_gid ?? null;
}

function focusedEvidence(join) {
  const variant = join?.exact_variant_matches?.[0] ?? null;
  if (!join || !variant) return null;
  return {
    source_kind: 'shopify_country_filtered_exact_join',
    merchant_product_gid: join.identity.merchant_product_gid,
    merchant_variant_gid: variant.merchant_variant_gid,
    sku: variant.sku,
    variant_title: variant.variant_title,
    selected_options: variant.selected_options,
    available_for_sale: variant.available_for_sale,
    price: variant.dated_price,
    destination_country: join.destination?.country ?? null,
    destination_postal_code: null,
    catalog_filter_scope: join.destination?.scope ?? 'country_only',
    catalog_filter_passed: join.status === 'EXACT_MERCHANT_PRODUCT_JOIN_COUNTRY_FILTER_PASS',
    exact_postcode_checkout_verified: false,
    observed_at: join.observed_at,
    checkout_refresh_required: join.checkout_refresh_required === true,
  };
}

function broadEvidence(candidate, fallbackObservedAt) {
  if (!candidate?.commerce) return null;
  return {
    source_kind: 'shopify_postcode_filtered_discovery_join',
    merchant_product_gid: candidate.identity.merchant_product_gid,
    merchant_variant_gid: candidate.identity.merchant_variant_gid,
    sku: candidate.identity.sku,
    variant_title: candidate.identity.variant_title,
    selected_options: candidate.identity.selected_options,
    available_for_sale: candidate.commerce.available_for_sale,
    price: candidate.commerce.price_amount ? {amount: candidate.commerce.price_amount, currency: candidate.commerce.price_currency} : null,
    destination_country: candidate.commerce.destination_country,
    destination_postal_code: candidate.commerce.destination_postal_code,
    catalog_filter_scope: 'country_and_postal_code',
    catalog_filter_passed: candidate.commerce.catalog_delivery_filter_passed === true,
    exact_postcode_checkout_verified: false,
    observed_at: fallbackObservedAt,
    checkout_refresh_required: candidate.commerce.checkout_refresh_required === true,
  };
}

function state(value, detail, evidence = null) {
  return {state: value, detail, ...(evidence ? {evidence} : {})};
}

export function evaluateProductTwin({contract, kit, twin, commerceEvidence, merchant}) {
  const project = contract.project_destination;
  const price = commerceEvidence?.price ?? null;
  const available = commerceEvidence?.available_for_sale === true;
  const countryFilter = commerceEvidence?.catalog_filter_passed === true && commerceEvidence.destination_country === project.country;
  const postcodeFilter = countryFilter && commerceEvidence.destination_postal_code === project.postal_code;
  const exactCheckout = commerceEvidence?.exact_postcode_checkout_verified === true;
  const visibleConfigurationExact = twin?.identity?.state?.includes('visible_finish_incomplete') === false && twin?.identity?.configuration_limit == null;
  const dimensionsVerified = twin?.readiness?.dimensions === 'verified';
  const rightsCleared = twin?.geometry?.rights?.state === 'cleared';
  const offerCurrent = false;
  const leadTimeKnown = false;
  const landedCostKnown = false;
  const SpanishSupplierProven = merchant?.dispatch_country === 'ES' || merchant?.seller_country === 'ES';
  const attributionConfigured = false;
  const routeReady = exactCheckout && offerCurrent && available;
  const procurementReady = visibleConfigurationExact && dimensionsVerified && available && exactCheckout && leadTimeKnown && landedCostKnown && routeReady;
  const sku = commerceEvidence?.sku ?? twin?.identity?.merchant_sku ?? null;

  const lanes = {
    identity: state(twin ? 'PASS' : 'BLOCKED', twin ? 'Stable Product Twin and exact merchant product identity are joined.' : 'Canonical Product Twin missing.', {twin_id: twin?.twin_id ?? null, merchant_product_gid: commerceEvidence?.merchant_product_gid ?? null, sku}),
    configuration_and_finish: state(visibleConfigurationExact ? 'PASS' : 'REVIEW', visibleConfigurationExact ? 'Exact visible configuration is bound.' : 'Merchant variant/price group exists, but exact visible fabric and colour are not bound.', {configuration: twin?.identity?.configuration ?? null, limit: twin?.identity?.configuration_limit ?? null}),
    avatar_and_geometry: state(kit?.presentation?.public_presentation_allowed ? 'PASS' : kit ? 'PASS_WITH_LIMITS' : 'UNKNOWN', kit ? `${kit.photo_input_band}; ${kit.route}.` : 'No reconstruction evidence card found.', {geometry_level: twin?.geometry?.level ?? null, photo_input_band: kit?.photo_input_band ?? null, queue_state: kit?.queue_state ?? null}),
    dimensions_and_fit: state(dimensionsVerified ? 'PASS' : 'REVIEW', dimensionsVerified ? 'Manufacturer-scale QA passed for placement and fit.' : 'Complete authoritative dimensions or scale QA remain incomplete.', {physical: twin?.physical ?? null}),
    technical_evidence: state(dimensionsVerified ? 'PASS_WITH_LIMITS' : 'UNKNOWN', dimensionsVerified ? 'Furniture envelope supports spatial fit; weight, care, fire, durability and installation evidence are not complete.' : 'Spatial and technical fit are incomplete.'),
    rights_and_provenance: state(rightsCleared ? 'PASS' : 'REVIEW', rightsCleared ? 'Commercial render scope is cleared.' : 'Source provenance is recorded, but reconstruction/render/platform-display rights remain under review.', {rights: twin?.geometry?.rights ?? null}),
    supplier_and_offer: state(countryFilter && price ? 'PASS_WITH_LIMITS' : 'UNKNOWN', countryFilter && price ? 'An exact merchant variant has a dated sale/price observation for Spain discovery.' : 'No exact Spain-filtered offer is joined.', {
      seller_id: merchant?.seller_id ?? 'design_public_group_trade',
      seller_name: merchant?.seller_name ?? 'Design Public Group Trade',
      seller_or_dispatch_country: merchant?.seller_country ?? merchant?.dispatch_country ?? null,
      Spanish_supplier_state: SpanishSupplierProven ? 'PROVEN' : 'NOT_PROVEN',
      price,
      available_for_sale_at_observation: available,
      observed_at: commerceEvidence?.observed_at ?? null,
      freshness_state: 'LIVE_REFRESH_REQUIRED'
    }),
    Spain_and_postcode_delivery: state(exactCheckout ? 'PASS' : postcodeFilter ? 'PASS_WITH_LIMITS' : countryFilter ? 'PASS_WITH_LIMITS' : 'UNKNOWN', exactCheckout ? `Delivery to ${project.postal_code} is checkout-confirmed.` : postcodeFilter ? `Catalog filtering included ${project.postal_code}, but checkout, allocation and delivery promise are not authoritative.` : countryFilter ? 'Spain country eligibility passed; exact postcode delivery is unverified.' : 'Spain delivery is not proven.', {
      destination: project,
      country_catalog_filter_passed: countryFilter,
      postcode_catalog_filter_passed: postcodeFilter,
      exact_postcode_checkout_verified: exactCheckout
    }),
    logistics_and_landed_cost: state(landedCostKnown && leadTimeKnown ? 'PASS' : 'UNKNOWN', 'Origin, carrier, shipping mode, packaging, freight, tax, lead time, unloading, storage and installation remain unresolved.', {
      origin_location: null,
      shipping_mode: null,
      carrier_or_3pl: null,
      lead_time_days: null,
      delivery_cost: null,
      tax: null,
      landed_cost: null,
      palletization: null,
      site_unloading: null,
      installation: null
    }),
    procurement_route: state(procurementReady ? 'PASS' : 'REVIEW', procurementReady ? 'Product is ready for procurement.' : 'Merchant-cart/external-checkout route exists structurally but still needs exact configuration, live offer refresh and authoritative logistics.', {
      route_type: 'merchant_cart',
      state: procurementReady ? 'ready' : 'needs_address_and_logistics',
      cart_created: false,
      checkout_total_verified: exactCheckout,
      quote_or_order_id: null
    }),
    attribution_and_affiliate: state(attributionConfigured ? 'PASS' : 'UNKNOWN', attributionConfigured ? 'Affiliate attribution is configured.' : 'Affiliate programme, attribution ID, commission and disclosure are not configured for this merchant/product.')
  };

  const blockers = [
    ...(visibleConfigurationExact ? [] : ['bind the exact visible fabric/colour configuration']),
    ...(rightsCleared ? [] : ['clear reconstruction and commercial render/platform rights']),
    ...(countryFilter ? [] : ['resolve an exact Spain-filtered offer']),
    ...(exactCheckout ? [] : [`confirm tax, freight, allocation and delivery to ${project.postal_code} through checkout or live quote`]),
    ...(leadTimeKnown ? [] : ['verify lead time']),
    ...(landedCostKnown ? [] : ['calculate landed and installed cost']),
    ...(SpanishSupplierProven ? [] : ['Spanish supplier or Spanish dispatch origin is not proven']),
  ];

  return {
    twin_id: twin?.twin_id ?? null,
    candidate_id: kit?.candidate_id ?? null,
    product: {manufacturer: twin?.identity?.manufacturer ?? kit?.identity?.vendor ?? null, model: twin?.identity?.model ?? kit?.identity?.product_title ?? null, sku},
    destination: project,
    headline: {
      design_state: dimensionsVerified && kit ? 'DESIGN_CANDIDATE' : 'DESIGN_EVIDENCE_REVIEW',
      presentation_state: kit?.presentation?.public_presentation_allowed ? 'PUBLIC_PRESENTATION_READY' : 'PUBLIC_PRESENTATION_BLOCKED',
      Spain_supply_state: countryFilter ? postcodeFilter ? 'POSTCODE_CATALOG_CANDIDATE' : 'SPAIN_COUNTRY_CATALOG_CANDIDATE' : 'SPAIN_SUPPLY_UNPROVEN',
      Spanish_supplier_state: SpanishSupplierProven ? 'PROVEN' : 'NOT_PROVEN',
      procurement_state: procurementReady ? 'PROCUREMENT_READY' : 'NOT_PROCUREMENT_READY'
    },
    lanes,
    offer_snapshot: commerceEvidence ? {
      offer_id: `OFFER_${kit.candidate_id}_${String(commerceEvidence.observed_at ?? 'DATED').slice(0, 10).replaceAll('-', '')}`,
      product_twin_id: twin?.twin_id ?? null,
      seller_id: merchant?.seller_id ?? 'design_public_group_trade',
      external_product_id: commerceEvidence.merchant_product_gid,
      external_variant_id: commerceEvidence.merchant_variant_gid,
      sku,
      price,
      quantity_basis: 'one listed item',
      tax_disclosure: 'unknown_until_checkout',
      shipping_disclosure: 'unknown_until_checkout_or_quote',
      stock_state: available ? 'available_for_sale_at_observation' : 'not_confirmed',
      lead_time: null,
      territory: commerceEvidence.destination_country,
      checkout_route: 'merchant_cart_or_external_checkout_live_refresh_required',
      observed_at: commerceEvidence.observed_at,
      expires_at: null,
      freshness_state: 'LIVE_REFRESH_REQUIRED'
    } : null,
    procurement_ready: procurementReady,
    blockers,
    policy: 'Avatar, product identity, selected configuration, supplier locality, offer freshness, Spain/postcode delivery and landed logistics are independent evidence lanes. No global readiness score is emitted.'
  };
}

async function readJson(relativePath) {
  return fs.readFile(path.join(ROOT, relativePath), 'utf8').then(JSON.parse);
}

async function main() {
  const [contract, reconstruction, focused, broad] = await Promise.all([
    readJson(FILES.contract), readJson(FILES.reconstruction), readJson(FILES.focusedCommerce), readJson(FILES.broadCandidates)
  ]);
  const twinFiles = (await fs.readdir(path.join(ROOT, FILES.twinDir))).filter((file) => file.endsWith('.json'));
  const twins = await Promise.all(twinFiles.map((file) => readJson(path.join(FILES.twinDir, file))));
  const twinByProduct = new Map(twins.map((twin) => [merchantProductId(twin), twin]).filter(([id]) => id));
  const focusedById = new Map((focused.joins ?? []).map((join) => [join.candidate_id, join]));
  const broadById = new Map((broad.candidates ?? []).map((candidate) => [candidate.candidate_id, candidate]));
  const cards = (reconstruction.kits ?? []).map((kit) => {
    const focusedJoin = focusedById.get(kit.candidate_id);
    const broadCandidate = broadById.get(kit.candidate_id);
    const evidence = focusedEvidence(focusedJoin) ?? broadEvidence(broadCandidate, broad.summary?.generated_at);
    const twin = twinByProduct.get(evidence?.merchant_product_gid) ?? null;
    return evaluateProductTwin({contract, kit, twin, commerceEvidence: evidence, merchant: {seller_id: 'design_public_group_trade', seller_name: 'Design Public Group Trade', seller_country: null, dispatch_country: null}});
  });
  const summary = {
    generated_at: new Date().toISOString(),
    contract_id: contract.contract_id,
    twins_evaluated: cards.length,
    exact_merchant_offers_with_dated_price: cards.filter((card) => card.offer_snapshot?.price).length,
    available_for_sale_at_observation: cards.filter((card) => card.offer_snapshot?.stock_state === 'available_for_sale_at_observation').length,
    Spain_country_catalog_candidates: cards.filter((card) => ['SPAIN_COUNTRY_CATALOG_CANDIDATE', 'POSTCODE_CATALOG_CANDIDATE'].includes(card.headline.Spain_supply_state)).length,
    postcode_catalog_candidates: cards.filter((card) => card.headline.Spain_supply_state === 'POSTCODE_CATALOG_CANDIDATE').length,
    exact_postcode_checkout_confirmed: cards.filter((card) => card.lanes.Spain_and_postcode_delivery.evidence?.exact_postcode_checkout_verified).length,
    Spanish_supplier_or_dispatch_origin_proven: cards.filter((card) => card.headline.Spanish_supplier_state === 'PROVEN').length,
    known_lead_time: cards.filter((card) => card.lanes.logistics_and_landed_cost.evidence?.lead_time_days != null).length,
    known_landed_cost: cards.filter((card) => card.lanes.logistics_and_landed_cost.evidence?.landed_cost != null).length,
    procurement_ready: cards.filter((card) => card.procurement_ready).length,
    policy: 'Counts preserve independent evidence lanes. Spain deliverability is not Spanish supplier proof; catalog filters are not authoritative checkout logistics.'
  };
  const output = {version: '0.1', summary, cards};
  await fs.mkdir(path.join(ROOT, 'data/procurement'), {recursive: true});
  await fs.writeFile(path.join(ROOT, FILES.output), `${JSON.stringify(output, null, 2)}\n`);
  await fs.writeFile(path.join(ROOT, FILES.metric), `${JSON.stringify({summary, cards: cards.map((card) => ({twin_id: card.twin_id, candidate_id: card.candidate_id, product: card.product, headline: card.headline, procurement_ready: card.procurement_ready, blockers: card.blockers}))}, null, 2)}\n`);
  console.log(JSON.stringify({summary, cards: cards.map((card) => ({twin_id: card.twin_id, product: card.product, headline: card.headline, lane_states: Object.fromEntries(Object.entries(card.lanes).map(([name, lane]) => [name, lane.state])), blockers: card.blockers}))}, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
