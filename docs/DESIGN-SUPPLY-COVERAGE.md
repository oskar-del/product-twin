# Design Supply Coverage

## What this adds

Design Supply Coverage sits above the Product Twin and below client approval/procurement. It does not replace the avatar, simplify the Twin or remove the selected design.

The relationship is:

`Project → Room → Placement → Product Twin → Selected configuration → Avatar + Offer → Logistics route`

The placement keeps quantity and scene position. The Product Twin keeps canonical identity, dimensions, configuration and avatar. A dated seller Offer carries mutable price, stock and delivery evidence. This lets the room remain stable while supply evidence changes.

## Client-facing percentages

Every report states its percentage basis:

- line-item share;
- placed-unit share;
- merchandise-value share, only when every line has a current comparable-currency price;
- landed or installed-value share, only when every line has complete comparable-currency cost evidence.

The outcome report uses non-overlapping buckets:

- local-market seller or dispatch plus destination delivery confirmed;
- non-local supply delivered in up to 10 days;
- non-local supply delivered in 11–30 days;
- non-local supply delivered in more than 30 days;
- destination delivery confirmed while supplier/dispatch origin is still unknown;
- exact destination checked and currently unavailable;
- exact route exists but live address/stock/checkout or quote refresh is required;
- unresolved.

Supplier geography and delivery timeline are also shown independently. This matters because a product sold on a Spanish storefront is not necessarily dispatched by a Spanish supplier, and a local supplier does not automatically imply a short lead time.

If the known buckets are 90%, 5% and 3%, the system reports the remaining 2% as unresolved. It never silently renormalizes the known 98% to 100%.

## Current Room Lab truth

The living-room baseline has eight placement lines and eight placed units. Every placement retains an exact retail product identity, selected configuration and G2 planning avatar.

- Spain: eight exact IKEA Spain product routes checked live for postcode 29660 on 2026-08-17.
- Confirmed destination delivery: 87.5% by placed line/unit quantity (seven of eight).
- Confirmed destination-unavailable: 12.5% (LISTERBY coffee table).
- Confirmed delivery timeline: seven available exact products have a combined-cart window of 4–7 days.
- Proven Spanish seller or dispatch origin: 0%.
- Verified lead-time coverage: 87.5% by placed line/unit quantity.
- Current official product-page prices: eight of eight, totaling €1,126.96 for one of each placed product.
- Destination-deliverable merchandise subtotal: €927.96. By merchandise value, 82.34% is destination-confirmed and 17.66% is destination-unavailable.
- Landed or installed-value coverage: unavailable until freight, destination tax treatment, handling, assembly and installation are known.
- Candidate substitutes: sofa, armchair and coffee table, covering 37.5% of placement roles as candidates only.
- Confirmed/approved substitute coverage: 0%.

The engine also emits a strictly separate conditional scenario for decision-making: if VALNÄS passes its remaining fit, technical, material/finish and client-approval gates, confirmed destination-deliverable coverage rises from 87.5% to 100%. The one-of-each merchandise subtotal rises from €1,126.96 to €1,176.96, a €50 change. This scenario is explicitly labelled `CONDITIONAL_NOT_APPROVED` and is never counted as current coverage.

The sofa and armchair alternatives are intentionally not auto-swapped. VALNÄS 206.280.38 is the first supply-recovery candidate with an exact identity, authoritative 1180×720×500 mm dimensions, €249 dated price, live delivery to 29660, IKEA Málaga stock and a verified-scale G2 planning avatar. It is 220 mm shorter, 120 mm deeper and 130 mm taller than LISTERBY. At the same center transform, the deeper top reduces the sofa-side and opposite-side clearances by 60 mm each. Placement fit and client approval therefore remain mandatory before any swap.

The live cart showed delivery from €79.90 (€69.90 with IKEA Family/Business Network), but the cart also contained two accidental accessories. That quote is retained as evidence and is not emitted as a clean landed cost.

## First four market benchmarks

The same design is evaluated independently in four markets:

1. Spain — primary operating and client pilot market.
2. Sweden — Munin real-estate stack and HouseKit H30/H50 context.
3. United Kingdom — property-to-design and procurement benchmark.
4. United States — state/ZIP-specific large-market benchmark.

An avatar and Product Twin may be reused across all four. Offers, supplier locality, delivery, taxes, compatibility and procurement readiness may not.

Current benchmark evidence is intentionally asymmetric: Spain has eight live destination checks with seven available and one unavailable; Sweden, UK and USA have no joined offers for the eight placed products and therefore remain unresolved.

## Local anchor network

Each market needs more than a long-tail global catalogue. The V0 market gate requires at least one strong local route in each of these roles:

- home and furniture;
- building materials/home improvement;
- trade and MEP;
- manufacturer BIM and neutral identity.

The named suppliers in `config/market-anchor-suppliers-v0.1.json` are research targets, not claims of access. Spain currently has only a partial anchor connection through exact IKEA Spain product routes.

## Why there is no single universal ecommerce MCP

MCP standardizes how an agent calls tools; it does not grant catalogue licenses, normalize identities or create missing evidence. The valuable data is split across different systems:

- commerce/PIM: products, variants, images and base prices;
- store/ERP/WMS: local inventory, allocation and dispatch origin;
- checkout/freight: destination-specific shipping, tax and delivery promise;
- manufacturer/BIM: dimensions, technical documents and geometry;
- rights systems: permitted display, derivatives, storage and redistribution;
- building/project systems: technical fit, quantities, site access and required-on-site date.

Shopify Storefront MCP/UCP is a strong per-store commerce interface. WooCommerce provides per-store REST APIs. GS1 Digital Link helps resolve neutral identity. None of those alone emits a trustworthy, destination-ready Product Twin with a verified avatar and full project logistics.

The opportunity is therefore a federated Product Twin MCP, not an unauthorized universal scrape:

1. connect store, retailer, manufacturer, BIM and identity adapters;
2. normalize them into Product Twin, OfferSnapshot, DeliveryPromise and AvatarEvidence contracts;
3. preserve evidence, timestamps, unknowns and rights;
4. calculate client-specific design coverage;
5. propose fit-safe alternatives without silently changing the design;
6. route confirmed quantities to cart, trade account, RFQ, tender or local purchase.

## Execution order

1. Use the published Room Lab to compare the disclosed G2 VALNÄS planning avatar at the exact LISTERBY centre transform and resolve the 60 mm front/rear clearance reduction.
2. Present current coverage (87.5%) beside the conditional VALNÄS scenario (100%, +€50) for explicit design approval; do not auto-swap.
3. Fill seller/dispatch origin and clean landed-cost evidence without supplier email outreach; refresh all mutable availability before approval or purchase.
4. Promote alternatives only after fit, finish, rights, client and destination-delivery gates pass.
5. Connect one home/furniture, one building-materials and one trade/MEP anchor in Spain.
6. Repeat the market-adapter benchmark through Munin/Sweden, then UK and USA.
7. Keep improving avatars in parallel; geometry quality never overwrites supply uncertainty.
