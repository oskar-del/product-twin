# Build, Procurement & Logistics OS — Persistent Chat Handoff

## Role

This is the long-lived chat for turning an approved Site/Design/Room scenario into something that can be sourced, delivered, installed, manufactured and handed over. It carries forward the 3D-printed-house supply-chain work without mixing it into geometry creation or storefront UX.

Repository branch: `agent/build-procurement-logistics-v1`

Read first:

- root `AGENTS.md`
- `docs/PLOT-TO-PROJECT-TWIN-ARCHITECTURE.md`
- `docs/DESIGN-SUPPLY-COVERAGE.md`
- `docs/LOGISTICS-AND-SOLAR.md`
- `docs/HOUSE-EXE-BRIDGE-ROADMAP-2026-08-17.md`

## Owns

- project BoM and package structure from site/building/room/product graphs;
- destination-specific offers and routes for ES, SE, GB and US;
- local/short-lead/long-lead/unavailable coverage;
- substitution options that preserve fit, intent, budget and schedule;
- freight, consolidation, customs, delivery constraints, installation and commissioning;
- material/component procurement for conventional, prefab and additive construction;
- RFQ/cart/quote handoff, landed cost and lead-time evidence;
- construction sequencing, supplier risk and as-built/provenance handover.

## Does not own

- raw Product Twin/Design Asset geometry or G-level promotion (Avatar Factory);
- plot/terrain/planning truth (Spatial Studio);
- storefront and room interaction UI (Commerce Showroom);
- final acceptance of its own claims (Verification chat and scripted gates).

## Starting truth

- Spain living-room design: 7/8 original products destination-deliverable to 29660; one unavailable.
- VALNÄS is a conditional substitution scenario that can move coverage from 87.5% to 100%, but is not client-approved.
- Current procurement-ready furniture Twins: 0, because exact lead time, landed cost and checkout evidence remain incomplete.
- ES is the active evidence market; SE/GB/US are benchmark contexts and may not inherit ES claims.
- Existing `90/5/3/2` coverage arithmetic is a planning framework, not a claim about actual supply until evidence fills each bucket.

## First milestone

Build one executable procurement plan from a frozen room or compact-house scene:

1. generate line items and quantities from placements/bundles;
2. resolve one primary and at least one fit-safe substitute per blocked role;
3. classify each line as local, <=10-day, >10-day, unavailable or unverified;
4. calculate merchandise, freight, tax/duty, installation and contingency separately;
5. show destination, observation time and evidence freshness;
6. produce schedule and risk changes for every proposed substitution;
7. refuse purchase-ready status until deterministic gates pass.

## Next three prompts

1. Define the canonical BoM/package/procurement-route schema shared by rooms, houses and hotels.
2. Turn the current living-room supply board into a destination-specific executable plan for Spain without overstating checkout readiness.
3. Map how structural shells, MEP, finishes, furniture and landscape packages reuse the same supplier/substitution logic.

## Boundaries

- Never call a supplier local because a national retailer can deliver.
- Never copy price, stock, tax or lead-time evidence between markets or destinations.
- Never replace a specified product silently; show fit, visual, cost, carbon and schedule deltas and require approval.
- Never contact individual suppliers unless the user explicitly asks.
- Keep mutable checkout/order payloads ephemeral.

