# Composite Release Evidence Gate

## Purpose

The composite manifest joins independent workstream outputs without allowing one lane to prove another. The deterministic validator, not the manifest's prose or a successful build, decides whether the recorded state is internally honest and whether the release is ready.

Files:

- contract: `config/release/composite-release-manifest.schema.json`
- observed milestone manifest: `data/releases/composite-release-manifest-v0.1.json`
- invariant gate: `scripts/lib/composite-release-gate.mjs`
- command-line gate: `scripts/validate-composite-release-manifest.mjs`
- mutation suite: `scripts/test-composite-release-manifest.mjs`
- pinned-artifact adapters: `scripts/lib/composite-artifact-bindings.mjs`
- pinned-artifact replay: `scripts/verify-composite-release-artifacts.mjs`
- pinned-artifact mutations: `scripts/test-composite-artifact-bindings.mjs`

## Two decisions, kept separate

`status` answers whether the manifest is structurally and semantically honest. `release_decision` answers whether all required release lanes are ready.

An honest manifest may therefore return:

```json
{
  "status": "PASS",
  "release_decision": "BLOCKED"
}
```

The regular validator exits zero for that state because the blockers are explicit and machine-consistent. The release command adds `--require-ready` and exits non-zero until the deterministic decision is `READY`.

## Cross-workstream invariants

### Source lane and identity

- `DESIGN_ASSET` is recursively forbidden from carrying Product Twin identity, merchant, offer, price, stock, supplier, checkout, logistics or procurement fields, including compact and camel-case aliases.
- A Product Twin must carry a verified product identity and at least one canonical identifier.
- A Design Asset can never make an exact-product claim.

### G0-G5, appearance and rights

- Claimed geometry level and independently verified level are separate.
- G1+ requires verified real-world dimensions, units, orientation, floor contact, clearance and anchor/pivot.
- G2+ additionally requires recognizable form, independent scale verification and explicit proxy disclosure.
- Render-ready G2+ also requires evidenced display rights.
- G3+ requires exact form, canonical-view/material/likeness evidence and cleared display/derivative rights.
- G4 requires verified technical interfaces; G5 requires manufacturer/configurator authority.
- Publication independently requires rights and, when applicable, verified attribution display.

The current Kator/Legaz batch is intentionally recorded as `claimed_level: G1`, `verified_level: G0`, `promotion_state: BLOCKED`. The Avatar checkpoint proves conversion and fail-closed lane handling, but its declared-envelope normalization does not satisfy the repository's canonical G1 definition without independent dimension/orientation/floor QA.

The replay adapter reads the index and conversion JSON directly from the manifest's full Avatar commit SHA. It derives IDs, counts, publication status and geometry promotion, and requires exact SHA-256 bindings for the source files. A hand-edited summary therefore cannot substitute for the pinned checkpoint artifacts.

### Site Twin

- Boundary and CRS cannot become verified while the official Catastro gate is open.
- Terrain cannot become authoritative without official IGN source, vertical datum and verified CRS.
- Planning entitlement and legal access cannot be inferred while their authority gates are open.
- Verified sun/view results require authoritative parcel, CRS, terrain and obstruction inputs.

The CANOPUS replay adapter reads its source, project, Site Twin and scenario JSON directly from the full spatial checkpoint SHA. It independently counts assertions and hard gates, derives claim states, hashes the four-file artifact set and rejects contradictory geometry, terrain, entitlement or access inserted beneath an open hard gate.

### Room placement

- Placement IDs must be unique.
- Every transform must be finite and the fallback transform must match the WebGL transform.
- Source lane and referenced ID must agree.
- Collision/fit states and bundle item/avatar counts are explicit.
- A room cannot be `VERIFIED` without an exported placement manifest, matching record count and deterministic collision/fallback results.

### Market, freshness and procurement

- Market evidence is bound to its market and exact destination; evidence from another country or postcode fails.
- A `CURRENT` price, stock or delivery claim requires a source, observation time, matching destination, freshness state and unexpired validity.
- A national catalogue does not prove local supplier status; seller or dispatch origin must match the destination country.
- An unapproved substitution cannot count as current coverage.
- Procurement readiness requires every gate in `PRODUCT_TWIN_READINESS_CARD_V0_1`, including lead time, landed cost and destination delivery.

### Deployment

- A current deployment claim requires the exact version, deployment ID, full source commit, production URL, observation time and unexpired status evidence.
- Deployment success does not promote geometry, rights, planning, supply or procurement.

## Commands

```sh
npm run release:composite:validate
npm run release:composite:test
npm run release:artifacts:verify
npm run release:artifacts:test
npm run release:composite:gate
```

The first four must pass in verification CI. The last command is the release vote and is expected to fail while the milestone manifest is honestly blocked.

## Current deterministic blockers

1. Kator/Legaz's reported G1 conflicts with the canonical G1 evidence minimum and remains independently accepted at G0.
2. CANOPUS has 11 open hard gates, including official parcel, terrain, planning and access evidence.
3. Room Lab version 10 has deployment provenance but no versioned placement manifest in this repository for composite replay.
4. The previous version 10 deployment snapshot is no longer claimed current after Brain reported public version 11; an exact version 11 deployment ID is required for independent replay.
5. Spain/29660 supply evidence requires live refresh before it can be called current.
6. Procurement readiness remains zero because configuration, technical fit, current offer/stock, delivery, lead time, landed cost and executable route gates are incomplete.

## Observed repository naming drift

The persistent-topology document names the active specialist branches correctly, but four individual handoffs still name older branches: Verification names `agent/verification-evidence-v1`, CANOPUS names `agent/canopus-site-twin-v0`, Build names `agent/build-procurement-logistics-v1`, and Visual names `agent/visual-media-studio-v1`. This is not treated as product evidence or a release blocker, but the Brain/integration workstream should reconcile it before those handoffs are used to start more sessions.

## Next implementation slice

Export one versioned Room Lab scene manifest from source commit `04cc6237ba6aeaf4a15f47d9cf5b5e2632abd1c0`, including placement IDs, transforms, reset/fallback transforms, collision/fit state and bundle counts. Feed that export directly into this gate. Avatar and CANOPUS now have pinned checkpoint adapters; Room Lab remains fail-closed until it exposes equivalent replayable evidence.
