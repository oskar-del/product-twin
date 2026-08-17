# Room Lab — persistent Work-chat handoff

## Purpose

Room Lab is the narrow, playable proof that a real room can contain multiple independently selectable furniture records while keeping geometry fidelity, product identity and destination supply evidence honest. The long-lived Work chat is the command centre for design decisions; this Site is the inspectable product surface, not a generic dashboard project.

## Current state

- Route: `/room`
- Shell: explicitly assumed 6.0 × 4.6 m Marbella living room; it is not presented as a surveyed client room.
- Baseline: eight Product Twin placement records / eight visible avatars.
- Furniture can be selected from the 3D scene or the shared top-plan fallback, moved in 100 mm steps, rotated by 15°, reset or removed.
- `Add to room` and `Add another` create unique placement IDs and select the new placement.
- New placements use a deterministic centre-first 100 mm grid search and are only created when their G2 planning envelopes fit inside the shell without overlapping another obstacle.
- Product bundles are explicit: one LISABO chair set is one placement record and four placed chair avatars.
- WebGL and fallback plan use the same placement transforms.
- Selected WebGL placements receive a box highlight and floor-envelope outline; the fallback highlights the selected footprint.
- VALNÄS remains a comparison-only, client-approval-gated replacement for unavailable LISTERBY. The hard-coded evidence is still the 17 Aug 2026 Spain/29660 snapshot.
- Geometry remains G2 proxy geometry. No avatar GLBs or material textures were changed in this slice.

## Decisions that must remain true

1. Every placed catalogue copy is an explicit record with a unique `placementId`, `productId`, `sourceLane`, live transform and reset transform.
2. `record_lane` is either `PRODUCT_TWIN` or `DESIGN_ASSET`. Generic Design Assets are forbidden from carrying article/SKU, commerce, price, stock, offer, supplier, checkout or Product Twin identity fields.
3. Exact commerce identity never promotes geometry. Muuto can remain an exact G0 identity while authorized geometry is missing.
4. G2 collision output is described as an axis-aligned planning envelope, never as an engineering clearance certificate.
5. Quantity and visible avatar count are separate. A bundle can be one set and four avatars.
6. Adding is explicit. Clicking a catalogue card inspects/selects; the labelled add action creates another placement.

## Files

- `app/room/room-lab.tsx` — Room Lab UI, Three.js scene, selection and placement actions.
- `app/room/room-contract.ts` — record, product, transform and envelope types.
- `app/room/room-data.ts` — current Product Twin catalogue and baseline placements.
- `app/room/room-state.mjs` — truth gate, placement creation, shared transforms, fit and deterministic spawn logic.
- `app/room/room-state.d.mts` — TypeScript declarations for the shared state module.
- `app/globals.css` — Room Lab selection, fallback plan, catalogue and inspector presentation.
- `tests/room-state.test.mjs` — deterministic truth, ID, spawn, bundle, transform and fit tests.
- `tests/room-model-scale.test.mjs` — metre-scale GLB and Room Lab contract checks.

## Verification commands

```bash
node --test tests/*.test.mjs
npm run build
npm test
npm run validate:artifact
git diff --check
```

Agent-preview QA must cover: add one table; add a second table; confirm unique selected ID; move it 100 mm and observe the fallback footprint move; add one and two four-chair sets; verify set/avatar counts; remove the selected placement; test collision/outside feedback; reset to eight baseline records.

## Current blockers

- None for the v9 interaction slice.
- Photoreal material fidelity is blocked on rights-safe PBR textures / authorized or QA-promoted avatars. The current G2 GLBs contain flat material factors, not product-grade upholstery, timber or jute textures.
- The supply panel is still a fixed Spain snapshot. SE/GB/US evidence is not live in this Site.

## Next three decision prompts

1. Should the next visible milestone be the first rights-safe textured G2/G3 furniture set, or a data-driven Spain supply tray?
2. When generic Sweet Home 3D Design Assets arrive, should they appear in a separate catalogue filter by default or only as gap-fill suggestions when no Product Twin fits?
3. For the first real client room, do we import a measured room shell first or preserve this assumed shell and build a separate project route?

## Do not do

- Do not add drag gizmos, undo/redo, saved-room persistence or a broad dashboard before the avatar/supply core needs them.
- Do not copy commerce fields onto a Design Asset or call generic geometry a purchasable product.
- Do not label a G2 proxy as exact visual geometry or photoreal G3.
- Do not change avatar GLBs in the dashboard workstream.
- Do not claim Spanish-local supply from an IKEA Spain storefront when seller/dispatch origin is unresolved.
- Do not contact individual suppliers by email; use the mapped commerce/manufacturer evidence routes.

## Deployment

- Live Room Lab: https://product-twin-avatar-gallery.adored-elm-4393.chatgpt.site/room
- Room Lab interaction release: version 9.
- Sites version ID: `appgprj_6a822d27eeb08191ab5be5783925f742~appgver_8519495f2a3481918d74bf8832393550`
- Deployment ID: `appgdep_6a8311a8df8481918212a9c2fc9edab5`
- Source commit: `3d36f07c32e42b168a74c5bc03a263e8c63e6eab`
- Status: succeeded, verified by the main-agent deployment-status call.
