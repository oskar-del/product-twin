# Product Twin Brain Control Board

> **SUPERSEDED 2026-08-25.** This board describes the 7-chat ChatGPT-era structure.
> The fleet is now SIX sessions governed by docs/SESSION-GOALS.md; current verified
> state lives in docs/FLEET-STATE-2026-08-25.md. Kept for history — do not act on
> the directives below.

Last updated: 2026-08-17

## Purpose

This is the shared coordination surface for the seven persistent Product Twin chats. The Brain chat owns priorities, cross-workstream contracts, merge order and promotion decisions. Specialist chats own implementation inside their declared branches or Sites project.

At the start of a milestone and after every checkpoint, each specialist should read the latest version of this file from branch `agent/product-twin-integration`. A specialist may continue autonomously within its active directive. It must return to the Brain before merging, deploying, publishing, purchasing, contacting suppliers or changing another workstream's contract.

## Canonical numbering

| Number | Persistent chat | Primary ownership |
| --- | --- | --- |
| 1 | Brain / Product Twin Integration | Direction, shared contracts, sequencing, reviews and promotion decisions |
| 2 | Avatar Factory & Source Graph | Product identity, geometry, G0-G5, appearance, rights, attribution and source graph |
| 3 | Plot-to-Project Spatial Studio | Plot, terrain, neighbourhood, climate, views, planning, design scenarios and Room Twin export |
| 4 | Room Lab & Commerce Showroom | Customer-facing room interaction, explicit placements and manifest consumption |
| 5 | Build, Procurement & Logistics OS | BoM, destination supply, substitutions, cost, logistics and construction packages |
| 6 | Visual Media Studio | Reproducible stills, QA views, walkthroughs, video and generation provenance |
| 7 | Verification, Evidence & Monitoring | Independent review, schemas, mutation tests, release gates, freshness and monitors |

## Active integrated milestone

### Manifest-Driven Living Room Alpha

Prove one complete chain without duplicating truth:

```text
#3 Room Twin export
    -> #2 furniture/avatar manifest
    -> #7 independent gates
    -> #4 explicit placements and interaction
    -> #5 ES-29660 procurement overlay
    -> #6 reproducible QA media
```

Acceptance requires all of the following:

1. Room Lab imports one verified furniture revision without component-code changes.
2. `PRODUCT_TWIN` and `DESIGN_ASSET` remain distinct in every record and UI surface.
3. Geometry, appearance, rights and destination commerce remain separate evidence dimensions.
4. The Spain procurement overlay carries destination, observation time and freshness; it cannot leak into SE, GB or US.
5. Verification returns a deterministic `PASS` before any new public Room Lab release.
6. Media outputs reference the same scene, placement and asset manifest revisions.

## Current directives

### #2 Avatar Factory & Source Graph

Produce `furniture-avatar-manifest-v0.1` for a sofa, lounge chair, coffee/side table and floor lamp. Prefer one excellent textured and rights-safe asset over broad unverified inventory. Include geometry, scale, orientation, floor anchor, collision/clearance envelopes, appearance evidence, rights, attribution and placement semantics. Generic Design Assets must contain no commerce fields. Return a checkpoint before publication or merge.

### #3 Plot-to-Project Spatial Studio

Define the canonical Site -> Building -> Level -> Room Twin export contract compatible with Room Lab. Produce an assumed Marbella living-room record and a clearly labelled CANOPUS Deluxe guest-room concept record. Preserve null CANOPUS boundary/CRS/DEM/access/planning gates until authoritative evidence exists. Return a checkpoint before merge.

### #4 Room Lab & Commerce Showroom

Frozen at accepted commit `3daea697deabe6c53bb161c9ed5f42031f4fde41`. Public Sites remains verified v11. Do not create another Sites version or add new UI. Treat furniture and commerce manifests as imported versioned snapshots, not Room Lab-owned canonical truth. Wait for #2, #5 and #7 results.

### #5 Build, Procurement & Logistics OS

Produce the authoritative ES-29660 procurement manifest for the frozen eight-product room. Preserve the dated 7/8 destination-deliverable evidence and conditional LISTERBY -> VALNAS scenario without claiming purchase readiness. Separate merchandise, freight, tax/duty, installation, contingency and unknown amounts. Return a checkpoint before carts, RFQs, purchases, merge or publication.

### #6 Visual Media Studio

Define a six-camera Room Alpha QA pack and reproducible media manifest using the frozen scene. Separate verification renders from concept-marketing renders. Preserve geometry, placements, identities, rights and disclosures. Keep Replicate evaluation cost-controlled and return expected/actual cost with the checkpoint.

### #7 Verification, Evidence & Monitoring

Prepare independent fail-closed gates for the Room Lab manifest boundary and Avatar Factory furniture manifest. Test lane separation, provenance, G-level/appearance/rights claims, market isolation, deterministic placement, boundary/collision enforcement and unsafe fallbacks. A missing required visual or interaction check remains `BLOCK`; prose cannot waive a scripted failure.

## Current Room Lab evidence

- Accepted source commit: `3daea697deabe6c53bb161c9ed5f42031f4fde41`
- Public release: Sites v11
- Saved non-live research release: Sites v14
- Manifest baseline:
  - `app/room/manifests/marbella-living-room.v1.json`
  - `app/room/manifests/marbella-furniture.v1.json`
  - `app/room/manifests/marbella-commerce-es-29660.v1.json`
- Reported deterministic result: 17/17 Node tests pass; production build and artifact validation pass; no new lint errors.
- Public promotion remains blocked pending specialist inputs and independent review.

## Checkpoint contract

Every specialist checkpoint must report:

- chat number and workstream name;
- branch/worktree and exact commit or dirty state;
- files changed;
- commands run and exit status;
- claims promoted;
- claims blocked and exact failed gates;
- inputs needed from another numbered chat;
- monitoring owner, frequency and stop/renewal condition where applicable;
- merge, publication and deployment status.

## Brain decisions pending

1. Approve or reject the shared Room Twin and furniture manifest contracts after #7 review.
2. Choose the first furniture revision eligible for Room Lab integration.
3. Decide whether the next public Room Lab release includes the saved spatial-intent engine or only manifest ingestion.
4. After Living Room Alpha, start the compact-house compiler proof while CANOPUS continues as the flagship site/visual benchmark.

