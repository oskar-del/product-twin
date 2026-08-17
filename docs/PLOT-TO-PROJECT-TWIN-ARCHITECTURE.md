# Plot-to-Project Twin Architecture

## Purpose

The Product Twin platform should support two valid starting points:

1. start with a known plot and ask AI to develop a viable project; or
2. start with a house/room/product idea and search for plots, designs and supply routes that fit it.

Both journeys use the same evidence graph. They differ only in which node the user enters first.

## Canonical chain

```text
Project
  -> Site Twin
  -> Design Scenario
  -> Space / Room Twin
  -> Placement
  -> Product Twin or Design Asset
  -> Offer / Procurement Route
  -> Delivery / Installation / As-Built Evidence
```

No downstream object may upgrade an upstream claim. For example, a hotel render cannot prove a parcel boundary, a generic sofa mesh cannot prove a SKU, and a national product page cannot prove delivery to a project postcode.

## Entity boundaries

### Project

Commercial and decision context: client, programme, target markets, budget, schedule, approvals and scenario comparisons.

### Site Twin

The measured and sourced land object: parcel identity, boundary, CRS, terrain, climate, solar exposure, sightlines, roads, legal access, utilities, environmental overlays and planning evidence.

CANOPUS and parcel `5410501UF2451S` are the first real Site Twin candidate. The current PDFs report useful facts, but the Catastro polygon, source DEM/LiDAR and planning certificate remain explicit gates.

### Design Scenario

A proposal placed on a Site Twin. LA CONCHA GARDENS is a Design Scenario, not a parcel fact. It may contain massing, water axes, courtyards, programme, room schedules, landscape and financial assumptions. Multiple scenarios can reference one immutable Site Twin.

### Space / Room Twin

A bounded interior or exterior space with dimensions, openings, orientation, clearances, environmental conditions and placement records. Room Lab is the first interactive Space Twin client.

### Placement

An instance in a space, with its own ID, transform, fit state and optional bundle membership. A placement references one Product Twin or one Design Asset; it does not copy commerce data into the scene.

### Product Twin

An evidence-bearing identity that can connect geometry, technical data, rights, offers, supply routes and lifecycle records. Geometry level and procurement readiness are independent axes.

### Design Asset

A rights-cleared generic geometry object used for composition, spatial testing and visual breadth. It has no SKU, GTIN, retailer, price, stock, delivery or procurement claim. It can be used as a search target for replacement by a Product Twin.

### Offer / Procurement Route

A dated, destination-specific path to buy, quote, deliver and install a Product Twin. Spain, Sweden, Great Britain and the United States are separate market contexts; evidence from one must not leak into another.

## Evidence contract

Every material assertion carries:

```json
{
  "value": 52733,
  "unit": "m2",
  "evidence_class": "official_source_reported",
  "source_ref": "study_pdf_p3",
  "authority": "Catastro",
  "method": "INSPIRE parcel lookup",
  "observed_at": "2026-08",
  "verification": "underlying_source_pending",
  "confidence": "high"
}
```

`confidence` never replaces `verification`. High confidence with a missing source remains unverified.

## AI design loop

The AI may propose and compare, but deterministic gates control promotion:

1. read the immutable Site Twin and project brief;
2. generate one or more Design Scenarios;
3. test planning envelope, terrain, sun, views, access and programme numerically;
4. generate Space Twins and place Product Twins or generic Design Assets;
5. resolve each generic placement against destination-ready Product Twins;
6. report coverage transparently: local, short-lead, long-lead, unavailable and substitutable;
7. re-run budget, logistics, carbon, installation and schedule after every accepted substitution;
8. retain the approved scenario and procurement evidence as the project moves toward as-built operation.

The AI can optimize for goals such as morning sun, evening light, framed views, privacy, garden species, circulation, budget or local supply. It must show the trade-off and the evidence used; it must not silently invent entitlement, availability or geometry.

## Repository and session topology

`oskar-del/product-twin` remains the canonical GitHub repository for contracts, evidence, pipelines and project/site data.

| Workstream | Isolated branch/worktree | Write surface |
| --- | --- | --- |
| Integration | `agent/v0-shoppable-dining-scene` | shared contracts, decisions, final merges |
| Avatar Factory | `agent/avatar-factory-v1` | geometry intake, rights, QA, Design Asset and Product Twin indexes |
| CANOPUS Site Twin | `agent/canopus-site-twin-v0` | site schemas, evidence, derived terrain/view/solar data |
| Room Lab | Sites deployment repository, exclusive checkout | interactive room client and deployment tests |

The Room Lab deployment repository remains a delivery shell temporarily. It consumes a versioned exported manifest from Product Twin; it must not hard-code a competing truth model or runtime-import another checkout. Migration into a monorepo can happen after the current live deployment and contracts are stable.

## Integration order

1. Land evidence schemas and explicit gates.
2. Placement and source-lane contract shared by Product Twin and Room Lab.
3. Rights-safe Design Assets with visible attribution and no commerce fields.
4. Product Twin replacement matching by category, envelope, style/material intent and destination supply.
5. True terrain and parcel geometry from reproducible official-source imports.
6. Design Scenario overlays and AI optimization tools.
7. Market-specific procurement, installation and as-built lifecycle evidence.

## First end-to-end proof

The first complete proof is not a larger dashboard. It is one CANOPUS space or compact residential room where a user can:

- inspect the source Site/Space Twin;
- add multiple visibly distinct furniture placements;
- distinguish generic Design Assets from exact Product Twins;
- see honest geometry/appearance/rights/supply states;
- replace a generic placement with a destination-ready Product Twin without changing the approved location;
- recalculate fit, budget, lead time and coverage;
- export a reproducible scene and evidence manifest.

