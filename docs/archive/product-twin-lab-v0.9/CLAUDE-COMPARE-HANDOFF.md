# Claude comparison handoff — working notes

Use this file when Claude access returns.

## What ChatGPT changed
1. Product Twin is treated as a standalone sibling module until schema stabilizes.
2. Real Spanish property remains the demand/distribution wedge; Shopify/Amazon are supply/commerce connectors, not the product.
3. One canonical Twin model with `kind`; Product and Material twins share graph infrastructure.
4. Introduced **Twin Candidate**: catalog results can be commerce-ready while geometry/render/rights are missing.
5. Introduced independent readiness dimensions: identity, commerce, geometry, render, specification, rights.
6. First proof narrowed to 20–50 excellent candidates / 5–10 render-ready twins in one room before scaling to hundreds.
7. Materials included in first demonstration.
8. Every swap is a first-class behavioural event.
9. UI direction: left spatial hierarchy, center persistent 3D, right contextual product inspector/chat, bottom budget/state.
10. Shopify visual/image similarity is proposed as one candidate generator for “similar / cheaper”; our own graph applies dimensions, design and rights constraints afterward.

## Why
The core risk is not catalog size. It is whether:
real design state → exact twin → real substitute → correct placement → updated budget → preserved commerce attribution
works cleanly.

## Important implementation finding
Shopify Global Catalog supports current UCP search/lookup/get-product, offer/availability data, image/item-reference similarity, and pagination up to 1,000 search results. Promoted affiliate placements exist but remain invite-led Developer Preview.

## Current artifact
`prototype/index.html` is a functional interaction mock:
- select product/material
- swap product
- swap material
- update room/project budget
- store swap events
- simple conversational commands
- Designer / Smart Value / Sale modes

## v0.4 additions — 2026-08-16
11. Added **Spatial Twin → Renovation Plan → Proposed State** architecture. Proposed state is not a duplicated model; it is an intervention layer over measured truth.
12. Added intervention types: retain / remove / replace / add.
13. Added explicit **unknown-price state**. Measured quantities can exist without invented demolition/labour prices.
14. Added procurement/BOM readiness gates: ready / no_offer / rights_hold / spec_hold.
15. Added signed, idempotent Polycam webhook core using HMAC-SHA256 + event-ID deduplication.
16. Added basic scan-to-takeoff pipeline stages and takeoff items.
17. Added MCP contract covering twin search, substitutes, swaps, budget, spatial capture, renovation and BOM generation.
18. Verified the local Product Twin store demo runs under Node 22 and records before/after price + behavioural swap event correctly.

### Key comparison question for Claude
Would Claude keep a second full proposed-building graph, or use interventions over the Spatial Twin? ChatGPT currently prefers interventions because they preserve measured truth and make diffs/BOM/scenarios easier.

## v0.5 additions — Existing-object intelligence
19. RoomPlan object classifications become `ExistingObjectCandidate`, not exact Product Twins.
20. Candidate states: unreviewed / keep_existing / replace / remove / matched_to_twin.
21. Matching ranks category + dimensions + captured attributes + optional visual similarity.
22. Reuse / relocation / refurbishment is treated as a first-class alternative to buying new.
23. Added a mobile capture-interface prototype that shows scan progress, detected object confidence and Twin matching.

### Important external validation
Apple's RoomPlan documentation explicitly describes using captured object attributes to filter furniture catalogs and replacing captured bounding boxes with detailed 3D models chosen by the app. That is almost exactly the Product Twin bridge being proposed here.
