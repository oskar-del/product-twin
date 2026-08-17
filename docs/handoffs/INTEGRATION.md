# Product Twin Integration — Persistent Chat Handoff

## Purpose

This is the long-lived coordination chat for Product Twin, Room Lab, Avatar Factory and Plot-to-Project/Site Twin work. It owns shared contracts, priorities, cross-workstream review, merge order and promotion decisions. It does not replace the specialist chats.

The current numbered workstream directives and integrated milestone are maintained in `docs/BRAIN-CONTROL-BOARD.md`.

## Canonical repository state

- Repository: `oskar-del/product-twin`
- Integration branch: `agent/product-twin-integration`
- Tested continuation baseline: `e2b528f`
- Work-protocol commit: `64d0316`
- Plot-to-Project architecture commit: `beb014b`
- Nothing in this handoff implies a push, merge or deployment.

The tested continuation baseline contains the Shopify/native-model census, residential G2 proxies, photo reconstruction readiness, Sweet Home Design Asset intake/conversion, Product Twin MCP, living-room supply board and market benchmark contracts.

## Persistent workstreams

| Chat | Branch / repository | Owns |
| --- | --- | --- |
| Product Twin Integration | `agent/product-twin-integration` | shared contracts, decisions, reviews and merge order |
| Avatar Factory & Source Graph | `agent/avatar-factory-source-graph` | identity, geometry intake, materials, rights, attribution, QA, G-level and source-lane separation |
| Plot-to-Project Spatial Studio | `agent/plot-to-project-spatial-studio` | parcel/site evidence, terrain, solar, views, planning gates, Design Scenarios and Room Twin export |
| Room Lab & Commerce Showroom | Sites project `appgprj_6a822d27eeb08191ab5be5783925f742` | product/3D UX, placement state, fit feedback, manifests and deployment |
| Build, Procurement & Logistics OS | `agent/build-procurement-logistics` | BoM, destination supply, substitutions, cost, logistics and construction packages |
| Visual Media Studio | `agent/visual-media-studio` | reproducible stills, walkthroughs, video, cost and generation provenance |
| Verification, Evidence & Monitoring | `agent/verification-evidence-monitoring` | independent review, release gates, evidence freshness and monitoring |

Each persistent chat may launch bounded subagents, but it keeps the ongoing product/design conversation and its own decision history.

## Shared contract

The canonical chain is:

```text
Site Twin -> Design Scenario -> Space/Room Twin -> Placement
          -> Product Twin or Design Asset -> Offer/Procurement Route
```

Critical separations:

- Product Twin identity is independent from geometry, appearance, rights and supply readiness.
- Design Assets are generic composition/fit objects and may not contain commerce fields.
- A Design Scenario references a Site Twin but may not mutate its measured evidence.
- Offers are destination- and observation-time-specific; ES, SE, GB and US evidence cannot leak across markets.
- Confidence never replaces source verification.

## Verified baseline gates

At `e2b528f`, the following passed locally:

- eight Avatar Factory/MCP/design-supply test suites;
- living-room supply board: `18/18`;
- V0 scene contract: `28/28`;
- `git diff --check`.

The supply gate remains honest: `0` procurement-ready furniture Twins because lead time, landed cost and checkout evidence are incomplete.

## Current priority order

1. Finish and independently review the Room Lab explicit-placement slice.
2. Finish and review Avatar Factory truth hardening; promote only visually and rights-cleared Kator assets.
3. Land the CANOPUS evidence schemas and explicit hard gates.
4. Define/export the versioned Room Lab manifest shared by Product Twin and the Sites shell.
5. Pull/recover official Catastro polygon and IGN terrain sources reproducibly.
6. Add Product Twin replacement matching for generic placements by category, fit, style/material intent and market supply.
7. Only then expand dashboard surfaces or add new performance engines.

## Integration rules

- Read and follow root `AGENTS.md`.
- Inspect each specialist diff; do not merge solely because its own agent reports success.
- Run deterministic gates after integration, not only on the source branch.
- Preserve `PRODUCT_TWIN` versus `DESIGN_ASSET` in every manifest and UI.
- Do not call G2 photoreal, G3 rights-cleared, or a product locally supplied without the corresponding evidence.
- Do not call CANOPUS entitled, accessible or accurately meshed until the named source gates clear.

## Next prompts for this chat

1. Review the three specialist checkpoints and decide merge order.
2. Choose whether to migrate Room Lab into the canonical monorepo or keep the Sites repository as a versioned delivery shell for the next milestone.
3. Select the first complete proof: residential living room, one CANOPUS guest room, or both sharing the same manifest contract.
