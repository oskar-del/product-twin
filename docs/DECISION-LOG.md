# Product Twin — Decision Log

This file is the shared reasoning record for the ChatGPT build and the later Claude comparison.

## Repository boundary
**Decision:** Product Twin lives only in `oskar-del/product-twin`.

**Reason:** It is infrastructure work with different data, rights, commerce, and ingestion concerns. It must not be mixed into existing real-estate, storyboard, email, or agency repos.

## Product Twin is source-neutral
**Decision:** Our canonical Twin ID is independent of Shopify, Amazon, manufacturers, BIM libraries, or retailers.

**Reason:** Geometry, specification, price, stock, affiliate attribution, and purchase path can all come from different sources.

## Candidate is not a Twin
**Decision:** Shopify Global Catalog results enter the system as **Twin Candidates**.

**Reason:** A catalogue result can have excellent commerce data but no verified dimensions, 3D geometry, rendering rights, or authoritative specification.

## Multi-dimensional readiness
Track independently:
- identity
- commerce
- dimensions
- geometry
- rights
- render
- specification

A product is not render-ready just because it is purchasable.

## Shopify MCP runs in GitHub Actions
**Decision:** Persistent ingestion runs from GitHub-hosted Actions rather than the user's laptop or either chat runtime.

**Reason:** No local setup, repeatable, auditable, schedulable, and both ChatGPT and Claude can inspect the same repository state.

## First real MCP proof
**Result:** The first GitHub-hosted Shopify Global Catalog run succeeded and persisted **495 unique Twin Candidates** from ten curated searches (500 returned before deduplication).

**Implication:** The core hypothesis that we can connect the real Shopify MCP, extract real products, normalize them, and persist the result in our own graph seed is proven.

## Curated universe, not blind mirroring
**Decision:** Shopify is the candidate/offer universe; the Product Twin graph is the curated design universe.

**Reason:** We do not need or want to mirror Shopify wholesale. Products are promoted only when useful for a project/design and when downstream gates can be solved.

## First-room focus
**Decision:** Triage prioritizes living-room categories first: sofas, lounge chairs, coffee tables, side tables, pendants, floor lamps, and rugs.

**Reason:** One excellent room can prove selection → placement → substitution → budget → commerce before we build catalogue scale.

## Commercial ranking integrity
**Decision:** Commission may be a small tie-breaker later, never the primary ranking signal.

**Reason:** Physical fit, design quality, availability, customer price/value, and readiness must come first.

## 3D geometry gate
**Decision:** Downloadable CAD/Model3d means `geometry found`, not `rights cleared`.

**Reason:** Model availability does not automatically grant derivative, rendering, or redistribution rights.

## Behavioural graph
**Decision:** Every product swap should eventually be stored as an event: from Twin, to Twin, project/room, price before/after, reason.

**Reason:** This creates proprietary substitution/preference intelligence and potential manufacturer analytics.

## Spatial Twin / Polycam
**Decision:** Keep Spatial Twin as a documented future input lane but park active development while Shopify/Product Twin closed-loop is being proven.

**Reason:** Existing-building capture is strategically valuable, but it should not distract from the first commerce/product hypothesis test.
