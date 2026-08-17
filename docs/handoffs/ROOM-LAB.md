# Room Lab — persistent Work-chat handoff

## Purpose

Room Lab is the narrow, playable proof that a real room can contain multiple independently selectable furniture records while keeping geometry fidelity, product identity and destination supply evidence honest. The long-lived Work chat is the command centre for design decisions; this Site is the inspectable product surface, not a generic dashboard project.

## Current state

- Route: `/room`
- Shell: explicitly assumed 6.0 × 4.6 m Marbella living room; it is not presented as a surveyed client room.
- Baseline: eight Product Twin placement records / eight visible avatars.
- Furniture already in the room can be selected directly in the 3D scene and moved continuously across the floor plane.
- Direct movement uses gentle magnetic alignment to room centre lines, walls, neighbouring centres and edges, 100 mm clear gaps and the 100 mm planning grid.
- A released overlapping placement searches deterministically for the nearest clear position and otherwise returns to its prior clear transform.
- The selected-placement buttons remain available for 100 mm nudges, 15° rotation and reset.
- Furniture can also be selected from the shared top-plan fallback.
- `Add to room` and `Add another` create unique placement IDs and select the new placement.
- New placements use a deterministic centre-first 100 mm grid search and are only created when their G2 planning envelopes fit inside the shell without overlapping another obstacle.
- Product bundles are explicit: one LISABO chair set is one placement record and four placed chair avatars.
- WebGL and fallback plan use the same placement transforms.
- Selected WebGL placements receive a box highlight and floor-envelope outline; the fallback highlights the selected footprint.
- VALNÄS remains a comparison-only, client-approval-gated replacement for unavailable LISTERBY. The hard-coded evidence is still the 17 Aug 2026 Spain/29660 snapshot.
- Geometry remains G2 proxy geometry. No avatar GLBs, material textures, Product Twin identities, supply, price, rights or procurement claims changed in version 11.

## Decisions that must remain true

1. Every placed catalogue copy is an explicit record with a unique `placementId`, `productId`, `sourceLane`, live transform and reset transform.
2. `record_lane` is either `PRODUCT_TWIN` or `DESIGN_ASSET`. Generic Design Assets are forbidden from carrying article/SKU, commerce, price, stock, offer, supplier, checkout or Product Twin identity fields.
3. Exact commerce identity never promotes geometry. Muuto can remain an exact G0 identity while authorized geometry is missing.
4. G2 collision output is described as an axis-aligned planning envelope, never as an engineering clearance certificate.
5. Quantity and visible avatar count are separate. A bundle can be one set and four avatars.
6. Adding is explicit. Clicking a catalogue card inspects/selects; the labelled add action creates another placement.

## Files

- `app/room/room-lab.tsx` — Room Lab UI, Three.js scene, selection, direct movement and placement actions.
- `app/room/room-contract.ts` — record, product, transform and envelope types.
- `app/room/room-data.ts` — current Product Twin catalogue and baseline placements.
- `app/room/room-state.mjs` — truth gate, placement creation, shared transforms, magnetic alignment, fit and deterministic settling/spawn logic.
- `app/room/room-state.d.mts` — TypeScript declarations for the shared state module.
- `app/globals.css` — Room Lab selection, movement feedback, fallback plan, catalogue and inspector presentation.
- `tests/room-state.test.mjs` — deterministic truth, ID, spawn, bundle, transform, fit and magnetic movement tests.
- `tests/room-model-scale.test.mjs` — metre-scale GLB and Room Lab contract checks.

## Verification

Source commit `f00270c0f93d64531782dfb73abf6bfe7a247331` passed:

- 9/9 Node tests.
- vinext production build.
- Sites artifact validation.
- `git diff --check`.
- Direct Sites deployment-status verification after publish.

Required production browser QA remains **not completed**. Two attempts to open the public `/room` route in the controlled browser were denied because the administrator-enforced browser security policy could not be verified. No security control was bypassed, and none of the following should be reported as production-verified yet:

- Desktop and mobile/touch selection.
- Continuous floor-plane drag.
- Magnetic guide appearance.
- Valid release and collision recovery.
- Wall and room-boundary constraints.
- Orbit/navigation coexistence.
- Adding another product.
- 100 mm nudges and 15° rotation.
- Room reset.

The failed browser access is not evidence that the production interaction is broken, so version 10 was not restored.

## Current blockers

- Controlled-browser production interaction QA is blocked by an administrator-enforced browser security check.
- Photoreal material fidelity is blocked on rights-safe PBR textures / authorized or QA-promoted avatars. The current G2 GLBs contain flat material factors, not product-grade upholstery, timber or jute textures.
- The supply panel is still a fixed Spain snapshot. SE/GB/US evidence is not live in this Site.

## Next priority

Stop general dashboard expansion. The next Room Lab slice is:

1. Consume versioned furniture/avatar manifests instead of hard-coded dashboard geometry bindings.
2. Improve truthful, rights-safe furniture realism with Avatar Factory while preserving explicit geometry-level evidence.
3. Re-run the full desktop and mobile/touch production interaction matrix when controlled browser access is available.

## Do not do

- Do not add unrelated dashboard UI, broad analytics, saved-room persistence or general expansion before the manifest and Avatar Factory work.
- Do not copy commerce fields onto a Design Asset or call generic geometry a purchasable product.
- Do not label a G2 proxy as exact visual geometry or photoreal G3.
- Do not change avatar GLBs in the dashboard workstream; consume Avatar Factory outputs through versioned manifests.
- Do not claim Spanish-local supply from an IKEA Spain storefront when seller/dispatch origin is unresolved.
- Do not contact individual suppliers by email; use the mapped commerce/manufacturer evidence routes.

## Deployment

- Live Room Lab: https://product-twin-avatar-gallery.adored-elm-4393.chatgpt.site/room
- Current live Sites version: `appgprj_6a822d27eeb08191ab5be5783925f742~appgver_510ade2367d88191ab348521c68b04c0` (version 11).
- Live source commit: `f00270c0f93d64531782dfb73abf6bfe7a247331`.
- Live deployment: `appgdep_6a8339a5a1cc8191973575b93fa1b8eb`.
- Provider deployment: `site---6a822d27eeb08191ab5be5783925f742`.
- Deployment status: `succeeded`, directly verified after terminal completion on 17 Aug 2026.
- Known-good fallback: version 10 deployment `appgdep_6a8314641d24819192bce5da824b5749`.
- Saved version 12 remains non-live; this approval intentionally published version 11.
- Public interaction status: deployed successfully, browser-smoke-test pending because the controlled browser security policy denied access.
