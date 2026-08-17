# Verification, Evidence & Monitoring — Persistent Chat Handoff

## Role

This is the long-lived independent-judgement chat. It tries to falsify claims made by the other workstreams and turns acceptance rules into scripts/CI/monitors. It does not plan the product and must not approve its own feature implementation.

Repository branch: `agent/verification-evidence-v1`

Read first:

- root `AGENTS.md`
- `docs/PLOT-TO-PROJECT-TWIN-ARCHITECTURE.md`
- `docs/PRODUCT-TWIN-READINESS-CARD.md`
- `docs/DESIGN-SUPPLY-COVERAGE.md`

## Owns

- cross-workstream schemas, invariants, fixtures and mutation tests;
- G0–G5, rights, material, scale and source-lane promotion gates;
- Site Twin evidence, CRS, terrain, solar/view and planning/access falsification;
- Room placement, collision, bundle, fallback and manifest consistency tests;
- destination/freshness/landed-cost/procurement-readiness gates;
- CI composition and release/deployment acceptance;
- evidence freshness policy, monitoring state, alert ownership and expiry.

## Does not own

- feature scope or prioritisation (Brain chat);
- Product Twin/Design Asset creation (Avatar Factory);
- spatial/design generation (Spatial Studio);
- UI or media production;
- waiving a failed deterministic gate.

## Starting truth

At integration baseline `e2b528f`:

- eight Avatar Factory/MCP/design-supply test suites passed;
- living-room supply board passed 18/18;
- V0 scene contract passed 28/28;
- procurement-ready furniture Twins remained 0.

The work protocol requires independent review for L2 claims and monitoring only while consumers rely on a result.

## First milestone

Create one composite release gate that consumes versioned manifests rather than UI prose:

1. validate Product Twin versus Design Asset field separation;
2. validate geometry/appearance/rights/supply axes independently;
3. validate Site Twin source bindings and hard gates;
4. validate Room placement IDs, transforms, fit and bundle semantics;
5. validate market/destination/freshness isolation;
6. emit machine-readable pass/block reasons;
7. fail non-zero on any premature promotion or stale-current claim.

Add a small mutation suite proving every critical rule can fail.

## Next three prompts

1. Define the composite evidence manifest and minimum cross-workstream invariants.
2. Review Avatar Factory, CANOPUS Site Twin and Room Lab checkpoints independently before merge/deployment.
3. Implement monitoring schedules and expiry rules for price/stock, APIs, rights, planning, geometry and production deployments.

## Boundaries

- Reviewer prose is not a gate; a script/CI exit status casts the final vote.
- A passing build is not evidence of scale, rights, supply or planning truth.
- High confidence never substitutes for a missing authoritative source.
- Do not create endless daily monitors for experiments without an owner and stop condition.

