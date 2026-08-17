# Product Twin V0 · Continuation Status · 2026-08-16

## Exact workspace handoff

- Repository: `oskar-del/product-twin`
- Main baseline inspected: `5c1bb12` (`geometry: add Roca exact G4 project-use target`)
- Continuation branch: `agent/v0-shoppable-dining-scene`
- Current implementation range: `5c1bb12..6a7a46a`
- Final handoff revision: the current `HEAD` of `agent/v0-shoppable-dining-scene`
- Publication state: local commits are complete and validated but were not pushed from this workspace because the required authenticated GitHub CLI workflow was unavailable.

The focus remains locked to the original Product Twin loop:

`REAL PRODUCT / SYSTEM → CANONICAL IDENTITY → VERIFIED DIGITAL AVATAR → PROJECT PLACEMENT → TECHNICAL / REGULATORY FIT → LIVE OFFER OR RFQ → PROCUREMENT`

Acoustics, developer orbit, facility operations, large showroom expansion and prefab-marketplace work remain parked in `docs/IDEA-PARKING.md`.

Core implementation commits, oldest first: `ee798d8` scene swap, `27bcdd9` offer refresh, `351d739` exit board, `a4a6e13` Arper packet, `908b2d3` Roca intake, `5d73128` GF intake, `7fd0d00` photo preflight, `1f48a25` photo QA, `5d6cb3e` hardened validation/handoff, `5881c35` private gallery link, `37c7974` postcode/checkout evidence gate and `6a7a46a` authorized exact-geometry QA.

## What this continuation completed

1. Added `V0_SHOPPABLE_DINING_001`, joining exact IKEA Spain identities to disclosed dimension-verified G2 pendant proxies, same-transform substitution and a €14.00 budget reduction.
2. Added official-page offer refresh logic that persists only minimal dated price/availability/checkout signals and never mistakes generic page availability for postcode stock.
3. Added a machine V0 exit board with 10 explicit gates and ranked external actions.
4. Prepared—but did not send—the Arper Ply #3853 commercial rendering/derivative permission packet.
5. Added no-copy authorized geometry intake for Roca and GF Sanipex. The intake verifies approved source, identity, access basis, file type/signature, size and SHA-256 while leaving manufacturer binaries outside Git.
6. Added a controlled photo-to-avatar preflight before Meshy and a separate 17-check post-generation QA gate with a hard G2 claim ceiling.
7. Added read-only CI coverage for the core scene, intake, photo preflight, photo QA and V0 exit-board evaluators.
8. Published a private interactive inspection gallery for all rights-safe G2 GLBs: `https://product-twin-avatar-gallery.adored-elm-4393.chatgpt.site`. The gallery now contains 18 viewable G2 avatars, including an eight-product residential starter pack. Arper remains a locked G3 candidate card because its exact manufacturer file was transient and cannot be retained or displayed before written permission.
9. Added a privacy-safe IKEA Spain live-session evidence gate for postcode 29660. It requires a fresh exact-article availability, cart and checkout observation, rejects private identifiers and updates the scene/exit board only after all 13 checks pass.
10. Added post-intake exact-geometry QA for Roca and GF Sanipex. It binds converted GLBs to the authorized intake hash, measures transformed mesh bounds, verifies target identity and interfaces, and blocks redistribution or persistent derivative storage.
11. Added a house-ready residential G2 pack: KIVIK sofa, POÄNG armchair, LISABO table/chair, MALM bed, BILLY bookcase, BESTÅ media unit and SÄLJAN countertop. The local Avatar Factory generates true-scale GLBs with realistic non-proprietary PBR materials, placement anchors and measured-envelope QA; it does not treat retail imagery or Shopify results as geometry.
12. On 2026-08-17, expanded that pack with LISTERBY coffee table, LOHALS natural-jute rug, GLADOM dark grey-green tray table and LAUTERS ash/white floor lamp. All four exact IKEA Spain article identities have separate generated GLBs, variant-specific material cues and scale QA passes. The prepared multi-avatar Room Lab now composes eight living-room Product Twins at once; its publication remains pending explicit approval.

## Visual inspection

Open the private gallery at:

`https://product-twin-avatar-gallery.adored-elm-4393.chatgpt.site`

The gallery supports avatar selection, mouse/touch orbit, zoom, pan, wireframe and camera reset in WebGL-capable browsers. It also includes static fallbacks, verified dimensions, evidence disclosures and the next promotion gate for each avatar.

## Honest V0 board

| Gate | State | Evidence / blocker |
|---|---|---|
| Source graph V0 | PASS | Source census closed |
| At least 10 mixed avatars | PASS | 22 promoted G2 + 1 G3 candidate |
| 3 fully promoted G3+ | BLOCKED | 0/3 |
| 2 fully promoted G4+ | BLOCKED | 0/2 |
| Exact identity + authorized geometry + live offer/RFQ | BLOCKED | Arper rights and Roca/GF authorized geometry remain external gates |
| Photo-to-avatar multi-view QA | BLOCKED | Capture/credential/job not yet supplied |
| Material repeat/takeoff | PASS | MOSO proof |
| System interfaces/configuration | PASS | VELUX + GF proxy/interface proof |
| Shoppable scene contract | PASS | 28/28 structural checks |
| Fully live shoppable scene exit | BLOCKED | IKEA postcode availability and checkout health unresolved |

Current total: **5/10 passed, 5/10 blocked**. No candidate was promoted by this continuation without the missing evidence.

The twelve residential assets remain G2. Their improved appearance does not promote them to G3: exact manufacturer visual geometry and appearance rights are still separate gates.

## Remaining actions in order

1. **Arper:** fill the project-owner legal name, contact name/role, reply email and project/platform description in `docs/requests/ARPER-PLY-3853-PERMISSION-REQUEST.md`; send only after explicit owner authorization. Written approval can unlock the first fully promoted G3 and the exact authorized geometry/RFQ gate.
2. **Roca:** use qualifying project/professional access to download the exact A32727500B/327275XXB BIM file, run the authorized intake manifest, convert under `.runtime`, then run `GEOMETRY_QA_EVIDENCE=.runtime/<file>.json npm run geometry:qa`. Do not bypass login or add either binary to Git.
3. **GF Sanipex:** use an authorized Uponor/GF account to download product-bound 1158140 geometry, then run the authorized intake and the same post-conversion `geometry:qa` identity/scale/interface/rights gate.
4. **Photo experiment:** capture at least front/rear/left/right/three-quarter views of one owned opaque product, measure width/depth/height, provide temporary HTTPS image references, and configure `MESHY_API_KEY` as a secret. Run preflight, reconstruction and post-generation QA in that order.
5. **IKEA live session:** resolve SKURUP/MELODI delivery or store availability for postcode 29660 and verify checkout health immediately before procurement. Put the temporary observation under `.runtime`, then run `MERCHANT_SESSION_EVIDENCE=.runtime/<file>.json npm run scene:v0:session`; only the minimal validated metric is persisted.

## Commands

```bash
npm run scene:v0:refresh:test
npm run scene:v0:validate
npm run scene:v0:session:test
npm run geometry:intake:test
npm run geometry:qa:test
npm run avatar:photo:preflight:test
npm run avatar:photo:qa:test
npm run avatar:residential:build
npm run v0:gates
```

Authorized geometry intake requires `GEOMETRY_INTAKE_MANIFEST`, `GEOMETRY_FILE`, `GEOMETRY_ACCESS_BASIS`, `GEOMETRY_TERMS_REF`, `GEOMETRY_PROJECT_REF` and `GEOMETRY_CONFIRMED_IDENTITY`; post-conversion QA uses `GEOMETRY_QA_EVIDENCE` pointing under `.runtime`. Fill the matching starting document under `config/geometry/qa-evidence-templates/`, but keep the completed evidence file under `.runtime`. Live merchant evidence uses `MERCHANT_SESSION_EVIDENCE` pointing under `.runtime`. Photo reconstruction uses `AVATAR_JOB` and an environment-secret `MESHY_API_KEY`; post-generation QA uses `PHOTO_AVATAR_QA`.

## Working rule

Do not resume broad source research or promote proxies as exact assets. Execute the five evidence-bearing actions above, rerun `npm run v0:gates`, and only change a gate when the required file, rights, QA or live-session evidence exists.
