# Product Twin — ChatGPT Parallel Decision Log

Purpose: keep a precise record of decisions, differences from the Claude build, and why we made them.

## 2026-08-15 — D001: Treat this as a sibling infrastructure module, not code directly inside Munin yet
**Decision:** Build Product Twin as a standalone module with a clear adapter boundary, then plug it into the real-estate stack.
**Why:** The graph has different data/risk concerns (rights, assets, offers, attribution) and should not contaminate the production real-estate repo before its schema stabilizes.
**Compare with Claude:** Aligned with Claude's "Product Twin brain" separation.

## 2026-08-15 — D002: Demand wedge = real Spanish property; catalogue/commerce can still be global
**Decision:** Do not choose between Marbella/Spain and Shopify/Amazon. Use real property as the demand/distribution wedge and global catalogues as supply.
**Why:** Existing real-estate demand is an unfair advantage; global commerce gives catalogue breadth.
**Compare with Claude:** Extends Claude's correction to the earlier U.S.-only framing.

## 2026-08-15 — D003: One canonical Twin type, with `kind`, for v0.1
**Decision:** Use one `Twin` identity model with `kind = object | material | fixture | appliance | system`, rather than separate disconnected ProductTwin/MaterialTwin databases.
**Why:** Shared identity, offers, rights, placements and source mappings are the same. Kind-specific extensions can be added later.
**Compare with Claude:** Slightly different from the founding handoff, which described Product Twin and Material Twin as separate concepts.

## 2026-08-15 — D004: Geometry source and commerce source are first-class and separate
**Decision:** A twin can get geometry from a manufacturer/CAD source and offers from Shopify/Amazon/dealer feeds.
**Why:** Shopify product access is not a 3D-asset licence, and the best commercial offer rarely owns the best geometry.
**Compare with Claude:** Strongly aligned with the identity-graph thesis.

## 2026-08-15 — D005: Shopify is the first live commerce adapter
**Decision:** Build the Shopify Global Catalog adapter before manufacturer-specific adapters.
**Why:** Current Shopify Global Catalog MCP provides cross-merchant search, lookup, product details, availability, seller checkout links, pagination and agent-commerce primitives.
**Constraint:** Affiliate promoted placements are still invite-led Developer Preview; do not assume revenue access in MVP.
**Compare with Claude:** More implementation-specific; Claude correctly preferred a real property pilot but did not need to reject Shopify as a supply connector.

## 2026-08-15 — D006: MVP = small twin catalogue + one real room/property, not 1,000 assets before UX
**Decision:** First milestone should be ~20–50 excellent twins and one room/space. Scale to 300–1,000 only after click/swap/budget/commerce works.
**Why:** The risk is the closed loop, not our ability to accumulate SKUs.
**Compare with Claude:** More aggressive narrowing than the 300–1,000 founding MVP.

## 2026-08-15 — D007: Materials move into the first demo, but not at the expense of FF&E
**Decision:** Include at least one material twin (floor/stone/tile) alongside furniture in the first property demo.
**Why:** It proves this is construction/procurement infrastructure, not merely affiliate furniture.
**Compare with Claude:** Agrees with Claude that materials should move earlier; keeps a mixed demo rather than materials-only Phase 1.

## 2026-08-15 — D008: Behavioural swap events are a first-class table
**Decision:** Store every from-twin → to-twin swap with reason, price before/after, room and project.
**Why:** This creates the future preference/substitution intelligence moat and manufacturer analytics.
**Compare with Claude:** Directly adopts Claude's strongest new moat insight.

## 2026-08-15 — D009: Interface shell = Vyer-like spatial hierarchy + central 3D + conversational control
**Decision:** Left = property/room hierarchy; center = 3D spatial scene; right = contextual product inspector/chat; bottom/overlay = project budget and state.
**Why:** Vyer demonstrates a clean space/assets hierarchy around interactive 3D. Our difference is generative design + commerce + substitutions.
**Compare with Claude:** New UI definition from this session.


## 2026-08-15 — D010: Introduce Twin Candidate vs render-ready Twin
**Decision:** Results ingested from commerce/catalog feeds start as Twin Candidates. They can be identity/commerce-ready while geometry, render and rights remain missing.
**Why:** A catalogue result does not imply authorized 3D geometry. This lets us ingest/search at scale without pretending every SKU is already usable in the 3D world.
**Compare with Claude:** New refinement; reduces rights risk and makes the ingestion funnel explicit.

## 2026-08-15 — D011: Readiness is multi-dimensional, not one linear status
**Decision:** Track readiness independently for identity, commerce, geometry, rendering, specification and rights.
**Why:** One product can be excellent for commerce but have no usable 3D asset; another can have perfect CAD and no transactional offer.
**Compare with Claude:** Extends the founding graph thesis into an operational pipeline.

## 2026-08-15 — D012: Curated 1,000, not random 1,000
**Decision:** Use Shopify searches by category/room/style, potentially paginating up to the documented 1,000-result depth, but only promote selected candidates to full Twins.
**Why:** The design catalogue should be deliberately curated. The catalog feed is our candidate universe, not our product-quality standard.
**Compare with Claude:** Reconciles the original 300–1,000 twin idea with the narrower first-room proof.

## 2026-08-15 — D013: Use Shopify visual similarity as an offer-discovery primitive
**Decision:** Treat Shopify's image/product-reference similarity search as a candidate-generation source for “similar / cheaper / on sale”, while our graph applies dimension/design/rights constraints afterward.
**Why:** It avoids rebuilding all retrieval from zero, but keeps final design selection under our control.
**Compare with Claude:** New technical implementation path for Claude's substitution-data thesis.


## 2026-08-15 — D014: Add Spatial Twin as a sibling to Product Twin
**Decision:** Model the existing physical environment as a Spatial Twin, while Product/Material Twins remain the objects we add/specify.
**Why:** This unifies new-build and existing-building workflows and opens renovation, resale, commercial fit-out, hotels, offices and retail.
**Compare with Claude:** New expansion discovered from the user's prior Polycam workflow.

## 2026-08-15 — D015: Polycam Bridge before building our own scanner
**Decision:** First integration path is Polycam API/webhook → Spatial Twin import, not recreating scanning technology.
**Why:** Polycam already exposes captures, artifacts, floorplans, mesh exports, external IDs and capture webhooks. This tests the renovation workflow with minimal capture R&D.
**Compare with Claude:** New implementation lane.

## 2026-08-15 — D016: Branded iOS scanner is viable later via Apple RoomPlan
**Decision:** A future focused Product Twin Capture app should use RoomPlan/ARKit rather than clone all Polycam capabilities.
**Why:** Apple provides RoomCaptureView for turnkey capture and RoomCaptureSession explicitly for apps that want their own scanning UI; ARKit LiDAR can provide scene mesh when deeper geometry is needed.
**Compare with Claude:** New technical route.

## 2026-08-15 — D017: Existing ↔ Proposed becomes a first-class project state
**Decision:** Renovation projects maintain retained/removed/new state on top of a Spatial Twin and Product Twin placements.
**Why:** The key workflow is not just decorating a scan; it is controlled transformation with take-offs, budgeting and procurement.
**Compare with Claude:** New UX/business extension.


## 2026-08-16 — D018: Proposed renovation is an intervention layer, not a copied building model
**Decision:** Keep the Spatial Twin as measured truth; store retain/remove/replace/add interventions separately.
**Why:** Auditable diff, scenario comparison, undo/redo, take-off and procurement become simpler and more trustworthy.
**Compare with Claude:** New architecture decision to test Tuesday.

## 2026-08-16 — D019: Unknown cost is first-class; never invent labour/demolition prices
**Decision:** Emit unresolved demolition/labour lines until a trusted rate-card/RFQ source is attached.
**Why:** The system must distinguish measured quantity from verified price.
**Compare with Claude:** New reliability principle.

## 2026-08-16 — D020: BOM readiness gates procurement
**Decision:** Procurement lines carry `ready | no_offer | rights_hold | spec_hold`.
**Why:** A pretty Product Twin should not automatically be purchasable/specifiable.
**Compare with Claude:** Operationalizes the rights + commerce thesis.

## 2026-08-16 — D021: Polycam webhook ingestion must be signed and idempotent
**Decision:** Verify HMAC-SHA256 over raw request bytes and deduplicate on `X-Polycam-Event-Id`.
**Why:** Polycam retries failed deliveries and reuses event IDs.
**Compare with Claude:** New infrastructure implementation.

## 2026-08-16 — D022: Captured furniture becomes Existing Object Candidates, not automatic Product Twins
**Decision:** RoomPlan/scan objects enter the graph as `ExistingObjectCandidate` with category, attributes, dimensions, transform and confidence.
**Why:** A scan can confidently say “sofa” without proving the exact brand/SKU. Exact identity must remain a separate matching/confirmation step.
**Compare with Claude:** New scan-to-product identity layer.

## 2026-08-16 — D023: Reuse is a first-class renovation action
**Decision:** Existing objects can be keep / replace / remove / matched-to-twin; we do not assume renovation means buying everything new.
**Why:** Better budgets, sustainability, office/hotel refurbishment and future resale/circular-economy workflows.
**Compare with Claude:** New business and UX angle.

## 2026-08-16 — D024: Physical fit outranks visual similarity in scan matching
**Decision:** Category and dimensions dominate candidate matching; visual similarity is additive.
**Why:** A lookalike product that physically does not fit is not a valid replacement.
**Compare with Claude:** New matching principle.

## 2026-08-16 — D022: Shopify becomes three connectors, not one
**Decision:** Separate Global Catalog MCP, single-merchant Storefront Catalog MCP, and merchant-authorized Storefront API media enrichment.
**Why:** Each solves a different part of the Twin: cross-merchant discovery, merchant catalog depth, and 3D Model3d sources.
**Compare with Claude:** New refinement; avoids forcing Global Catalog to provide data it was not designed to expose.

## 2026-08-16 — D023: Prefer existing Shopify Model3d assets for first real 3D Twins
**Decision:** For cooperative merchants, inspect Shopify-hosted `Model3d` before creating geometry ourselves.
**Why:** Shopify can already host GLB/USDZ product media; authorized reuse collapses the Twin Factory workload.
**Compare with Claude:** New route to solve the first 5–10 renderable Twins faster.

## 2026-08-16 — D024: Affiliate revenue has fallback lanes
**Decision:** Product Twin `Offer` supports promoted-placement attribution, direct merchant referral, and other affiliate networks independently.
**Why:** Shopify promoted placements are still invite-led. Revenue architecture cannot depend on access to one preview program.
**Compare with Claude:** Reinforces Claude's concern that revenue attribution must be built into the pipe from day one.

## 2026-08-16 — D025: A real Shopify result is a candidate; merchant-authorized 3D + live offer is enough for MVP promotion
**Decision:** First promotion gate is `offer present + authorized geometry present`; full technical specification can remain candidate state for FF&E.
**Why:** For a sofa/chair visual-commerce demo we do not need BIM-grade specification to prove click/swap/buy.
**Compare with Claude:** Tightens MVP scope while preserving later specification requirements.

## 2026-08-16 — D026: First real geometry tests can be geometry-only candidates
**Decision:** Add real manufacturer geometry candidates even before a live Shopify offer is mapped to them.
**Why:** It lets us independently prove identity/geometry normalization while Shopify live POST access is unavailable; the commerce identity can be reconciled later.
**Compare with Claude:** Preserves the identity-graph thesis that geometry and commerce do not need to originate from the same source.


## 2026-08-16 — D022: Downloadable manufacturer CAD is geometry-found, not rights-cleared
**Decision:** Manufacturer model-library availability does not automatically authorize realtime conversion, derivatives or redistribution.
**Why:** Geometry and rights are separate facts. The Twin Factory must be able to stop promotion.
**Compare with Claude:** This is a stricter operational interpretation of the shared rights/provenance thesis.

## 2026-08-16 — D023: Verified scale becomes an FF&E render gate
**Decision:** Exact placement requires verified physical scale/dimensions before a candidate can become render-ready.
**Why:** A visually correct chair at the wrong scale breaks room design, substitution and take-off.
**Compare with Claude:** New concrete promotion requirement.

## 2026-08-16 — D024: Commission is only a 1% ranking tie-breaker
**Decision:** Product substitution scoring weights design/fit/value/readiness heavily and commission at 1%.
**Why:** Commercial incentives must not override suitability or customer value.
**Compare with Claude:** Operationalizes the earlier trust principle into code.

## 2026-08-16 — D025: First real-Twin trial uses manufacturer candidates even when they fail
**Decision:** Store real Herman Miller / Steelcase source records in the trial dataset without bundling their geometry and intentionally show HOLD status.
**Why:** We learn from the actual ingestion/gating process without making unsupported rights claims.
**Compare with Claude:** New experimental method for Tuesday comparison.


## 2026-08-16 — D026: Add a local live-Shopify bridge instead of waiting for Claude
**Decision:** Ship a zero-dependency local Node server + browser intake UI that calls Shopify MCP from the user's own machine.
**Why:** The hosted ChatGPT runtime cannot execute the outbound Shopify POST, but the architecture and current official endpoints are usable from a normal connected machine.
**Compare with Claude:** New execution workaround; allows the parallel ChatGPT track to generate real catalog data before Tuesday.

## 2026-08-16 — D027: Global vs Storefront Shopify are separate ingestion lanes
**Decision:** Global Catalog is for cross-merchant discovery; Storefront Catalog is for deep search inside one merchant.
**Why:** Their current official limits and scopes differ: Global search max 50/page; Storefront search max 250/page.
**Compare with Claude:** New implementation detail to preserve in adapter design.

## 2026-08-16 — D028: Shopify Model3d retrieval supports tokenless-or-token merchant media clients
**Decision:** Merchant media adapter accepts an optional Storefront token instead of assuming it is always mandatory.
**Why:** Current Storefront API supports tokenless access to core product/catalog capabilities, while tokens remain available for authenticated storefront access.
**Compare with Claude:** Correction/refinement to v0.6 assumptions.


## 2026-08-16 — D029: Global Shopify discovery must resolve into merchant-scoped identity before Model3d inspection
**Decision:** Use Global Catalog for discovery, then deep-dive into that merchant's Storefront Catalog to obtain merchant-scoped Product IDs before querying Storefront product media.
**Why:** Global product identity and store-specific Storefront identity are different layers; Model3d lives in the merchant product-media context.
**Compare with Claude:** New identity-resolution workflow.

## 2026-08-16 — D030: `Model3d found` is a geometry signal, not a promotion signal
**Decision:** The live UI reports Shopify Model3d independently from rights/scale status.
**Why:** We should celebrate discovery without collapsing geometry and permission into one state.
**Compare with Claude:** Continues the stricter gate architecture from v0.7.
