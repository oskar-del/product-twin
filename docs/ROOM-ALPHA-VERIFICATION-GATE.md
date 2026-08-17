# Manifest-Driven Room Alpha Independent Gate

## Decision

The observed V14 candidate is `BLOCK` for integration testing and `BLOCK` for public deployment. This is a fail-closed evidence result, not a judgement that the reported Room Lab implementation is broken.

Independently observed:

- Sites version 14 exists and records source commit `a2e4b206742f4a742e8770cf71e7ca25a91cd674`.
- The saved 79-file Sites archive records SHA-256 `2df0b20d3012f2342d61eb310a7e217f0f3c752163762bbce724c1b431e70a1f`.
- Version 14 is saved and was not deployed by this verification workstream.
- The public Sites project remains active at its existing URL.
- GitHub rejects an exact fetch of V14 commit `a2e4b206742f4a742e8770cf71e7ca25a91cd674` as `not our ref`; the published Room Lab branch remains at `eb02c51ef35fec438ef3f0da29b5a39b43ed7791`.

Reported but not independently reproduced from accessible source:

- build pass;
- lint pass;
- artifact validation pass;
- 11/11 deterministic Room Lab tests pass;
- public deployment is version 11.

The gate preserves those reports as `REPORTED`; it does not promote them to independent `PASS` evidence.

## Four-party release rule

1. Room Lab and Avatar Factory propose their contracts.
2. Each workstream executes its own implementation and produces evidence artifacts.
3. Verification reads those artifacts without changing the workstream's claims.
4. `npm run room:alpha:gate` casts the final vote. No prose, verifier, model, or workstream flag can waive a failed script.

## Contract files

- `config/release/room-alpha-release-candidate.schema.json`
- `config/release/furniture-avatar-manifest.schema.json`
- `config/release/room-alpha-scene-manifest.schema.json`
- `config/release/room-alpha-supply-manifest.schema.json`
- `config/release/room-alpha-verification-result.schema.json`

All object shapes are closed. Missing fields and unknown or silently ignored fields fail validation.

## Independent checks

### Furniture Avatar Manifest

- Stable and unique avatar, evidence, anchor and QA IDs.
- Full source commits, valid asset URIs, binary hashes and aggregate asset-set hash.
- Product Twins require verified identity evidence and canonical IDs.
- Design Assets recursively forbid commerce and procurement aliases, including nested/camel-case variants.
- Geometry and appearance keep separate confidence states.
- G1-G5 promotions require their exact evidence flags; claimed level cannot exceed independently verified level.
- Unresolved rights block public use; rights-required attribution cannot be removed.
- Every promoted avatar requires passing visual, orientation and floor-anchor QA plus an independently inspected binary hash.
- Spatial footprint, collision envelope, clearances, anchors and conservative unknown-product behavior are explicit.

### Room Alpha Scene Manifest

- Stable scene, profile, surface, opening, path, placement and candidate IDs.
- Exact Avatar Manifest and room-geometry hashes.
- Finite room bounds, surfaces, openings and protected paths.
- Floor anchors reference a floor and agree with the placement transform.
- Rotated collision and functional-clearance envelopes remain within room bounds and outside openings/protected paths.
- Pairwise collision uses oriented boxes, so a rotation that creates a collision fails.
- Hard constraints and soft preferences are separate.
- Candidate generation requires an integer seed and deterministic algorithm version.
- Ranking is reproduced from score plus `CANDIDATE_ID_ASC` tie-breaking.
- Invalid candidates carry reasons, appear in the rejection set and cannot become placements.
- Drag, pickup, nudge and rotation must enforce both boundaries and collisions.
- Scene and profile IDs cannot leak between placements.
- Unknown products are rejected or use a conservative unpublished box with at least 0.3m clearance.

### Supply separation

- Commerce exists only in the optional supply manifest.
- Offers reference Product Twins, never Design Assets.
- Manifest, offer and evidence market/destination must agree exactly.
- Spain evidence cannot satisfy Sweden, Great Britain or United States destinations.
- Current evidence requires observation time and an unexpired validity time.

## Required input from Avatar Factory

Avatar Factory must publish, on `agent/avatar-factory-source-graph`:

1. `furniture-avatar-manifest-v0.1.json` matching the strict schema.
2. A full, GitHub-reachable source commit.
3. Repository-addressable `repo://` asset URIs for every promoted avatar.
4. SHA-256 for every binary and the derived aggregate asset-set hash.
5. Product identity evidence or an explicit `DESIGN_ASSET` lane.
6. Geometry level, evidence flags, dimensions, orientation, floor anchor and independent scale evidence.
7. Separate appearance evidence and confidence.
8. Rights evidence, publication flags and immutable attribution requirements.
9. Collision envelope, functional clearance, anchors and unknown-product fallback.
10. Passing visual, orientation and floor-anchor QA records for every promoted avatar.

No price, SKU, stock, merchant, supplier, delivery or procurement field may appear anywhere inside a Design Asset record.

## Required input from Room Lab

Room Lab must publish, on `agent/room-lab-commerce-showroom`:

1. The exact V14 source commit so `git fetch` and `git cat-file` can reproduce it.
2. `room-alpha-scene-manifest-v0.1.json` matching the strict scene schema.
3. A SHA-256-bound reference to the exact Avatar Factory manifest.
4. Room bounds, floor/wall surfaces, openings and protected paths.
5. Explicit placements with IDs, scene/profile IDs, transforms, floor anchors, collision envelopes and functional clearances.
6. Deterministic candidate set, integer seed, algorithm versions, hard failures, soft scores, stable ranking and rejection reasons.
7. Interaction policies for drag, pickup, nudge and rotation.
8. Hash-bound machine-readable outputs for build, lint, artifact validation and the 11 deterministic tests.
9. Browser/manual interaction evidence before any V14 public deployment vote can pass.

The saved Sites archive metadata is useful provenance but cannot substitute for these source artifacts.

## Reproduction

```sh
npm run room:alpha:validate
npm run room:alpha:test
npm run room:alpha:gate
```

`validate` emits an honest `BLOCK` with exit zero when blockers are correctly recorded. `test` proves the gate detects adversarial mutations. `gate` is the release vote and exits `2` while the requested target is blocked.

Machine-readable inputs and result:

- `data/releases/room-alpha-candidate-v0.1.json`
- `data/releases/room-alpha-verification-result-latest.json`

## Freshness and monitoring

- Source commits, manifests and static hashes: recheck on source or pipeline change.
- Rights and attribution: recheck on licence/source change and before each publication channel.
- Supply: daily while displayed as current and immediately before purchase.
- Sites deployment and critical interactions: after every deployment.
- Browser/manual interaction QA: required per promoted public version; it does not carry forward automatically from version 11 to version 14.
