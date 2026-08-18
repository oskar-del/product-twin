# Shopify strategy v0.6 — Product Twin MVP

## Three Shopify lanes

### A. Global Catalog MCP — discovery + offers
Use for cross-merchant discovery, similarity search, current price/availability, seller data, checkout URLs and (when enabled) promoted affiliate placements.

Canonical role: **candidate universe / offer universe**, not geometry truth.

### B. Storefront Catalog MCP — merchant deep dive
Endpoint: `https://{storedomain}/api/ucp/mcp`

No API key is required for the UCP catalog itself, although individual stores may restrict access. This lets us deeply explore one furniture/design merchant without building a custom merchant API adapter.

Canonical role: **merchant catalog discovery and current offer validation**.

### C. Merchant-authorized Storefront API — 3D enrichment
When a merchant cooperates, use the Storefront GraphQL API to retrieve richer product media. Shopify's `Model3d` media exposes model sources; Shopify supports GLB / USDZ product models.

Canonical role: **authorized geometry enrichment**.

## Candidate funnel

Global/Storefront UCP result
→ Shopify Twin Candidate
→ identity matched
→ 3D source found
→ rights cleared
→ render-ready
→ Product Twin promoted

Do not promote merely because a product has a price/image.

## Affiliate / revenue paths

### Path 1 — Global Catalog promoted placements
Best agent-native route, but Developer Preview / invite-led.
- base rate currently 0.3%
- merchant may add extra commission
- preserve the exact returned variant URL; attribution parameters cannot be rewritten

### Path 2 — direct merchant commercial agreement
Merchant authorizes catalog/media integration and separately agrees referral/procurement economics.
This is likely more attractive for high-ticket furniture and project packages.

### Path 3 — Shopify Collabs where applicable
Merchant-defined affiliate program and tracking. Useful as an existing Shopify-native mechanism, but new creator signups are currently closed, so do not make it an MVP dependency.

## Important product insight
Shopify itself already contains a hidden population of potential Product Twins: merchants who have uploaded 3D product media. The hard problem becomes *discover / get permission / normalize / attach AI + commerce*, not always *model from zero*.

A later manufacturer pitch can be:
> Install/connect Product Twin. We ingest your Shopify catalog, reuse your existing GLB/USDZ where authorized, make every SKU AI-searchable and renderable, then distribute it into real-property designs with tracked commerce.
