# Living Room Alpha — Verification review package

## Checkpoint

- Repository: `oskar-del/product-twin`
- Worktree: `product-twin-visual-media`
- Branch: `agent/visual-media-studio-v1`
- HEAD/base commit: `4a32e4cc397bffb3a665ceae2d4fe3e4d5c12143`
- State: dirty; all Living Room Alpha files are uncommitted and nothing is pushed, merged, deployed or published.
- Brain control board: `agent/product-twin-integration` commit `ef1d52d53aa4d6c3b8cbd5f99c456c5d219a1a4c`, `data/dashboard/project-control.json`, SHA-256 `f5850d8ed3df1db60d1708e6492cc9513c7c34fbebb950d14b70a8d2126049c5`.
- Frozen Room Lab authority: source commit `3d36f07c32e42b168a74c5bc03a263e8c63e6eab`; scene manifest SHA-256 `fc47dadcf08c4e8172d93b07397c4325851560da57d3c713f99a18065ee2b181`.

The room remains the assumed 6.0 × 4.6 × 2.8 m demo shell. It has zero authoritative openings and one assumed garden-window overlay. The exact eight existing Product Twin placements and transforms are frozen. No VALNÄS substitution, Design Asset, geometry beautification or Room Lab change is present.

## Six-camera contract

All units are metres/degrees, near/far are 0.02/100 m, DPR is 1, and the frozen Room Lab lighting/environment is used without geometry, material or placement overrides.

| Stable camera | Purpose | Position → target | Lens/projection | Output |
|---|---|---|---|---|
| `CAM_ROOM_ALPHA_TOP_PLAN_V0_1` | top-plan placement/circulation | `[0,9,.01] → [0,0,0]` | orthographic 5.2 m, bounds ±3.4666666667 × ±2.6 | 1600×1200, 4:3 |
| `CAM_ROOM_ALPHA_WIDE_V0_1` | whole-room scale/orientation | `[5.4,3.2,5.2] → [0,.72,-.15]` | 39° vFOV, 24 mm sensor, 33.88695462721 mm | 1600×1000, 16:10 |
| `CAM_ROOM_ALPHA_SEATING_V0_1` | principal seating relationship | `[2.55,1.25,2.05] → [-.15,.65,-.5]` | 42° vFOV, 24 mm sensor, 31.261068776326 mm | 1600×1000, 16:10 |
| `CAM_ROOM_ALPHA_CLEARANCE_V0_1` | KIVIK–LISTERBY side clearance | `[8,1.35,-.85] → [0,.65,-.85]` | orthographic bounds `[-2.6,2.6,1.75,-1.5]` | 1600×1000, 16:10 |
| `CAM_ROOM_ALPHA_SELECTED_KIVIK_V0_1` | canonical KIVIK world-front inspection | `[0,1.1,1.2] → [0,.42,-1.78]` | 35° vFOV, 24 mm sensor, 38.059137628359 mm | 1600×1000, 16:10 |
| `CAM_ROOM_ALPHA_HERO_V0_1` | final composition verification | `[7.2,5.5,7.5] → [0,.75,0]` | 39° vFOV, 24 mm sensor, 33.88695462721 mm | 1920×1200, 16:10 |

The clearance camera hides six furniture roots only for visibility; the KIVIK and LISTERBY remain at their exact transforms and all eight assets stay loaded and hash-audited. The verified envelope gap is exactly 0.785 m. The selected-product camera similarly shows only KIVIK plus the shell. Visibility filtering on any other camera fails validation.

## Manifest package

- Camera contract: `data/media/room-alpha/v0.1/camera-pack.json`
- Room manifest: `data/media/room-alpha/v0.1/room-manifest.json`
- Furniture manifest: `data/media/room-alpha/v0.1/furniture-manifest.json`
- Dated ES-29660 manifest: `data/media/room-alpha/v0.1/es-29660-manifest.json`
- Versioned schema: `config/media/room-alpha-media-manifest.schema.json`
- Camera schema: `config/media/room-alpha-camera-pack.schema.json`
- Example/output manifest: `data/media/room-alpha/v0.1/media-manifest.example.json`
- Native render evidence: `data/media/room-alpha/v0.1/outputs/alpha-native-stills-run.json`
- Environment lock: `data/media/room-alpha/v0.1/render-environment.json`
- Contact sheet: `data/media/room-alpha/v0.1/outputs/verification-contact-sheet.png`

Every manifest output binds the room, furniture, market and camera manifests by ID/revision/SHA-256; the exact placement/transform/asset set by SHA-256; every asset URI/revision; source lane; G2/A1 fidelity; rights state; camera; local renderer/settings; output bytes/hash; disclosure; generation date; and expected/actual cost.

## Output classes

`VERIFICATION_RENDER` contains six available local PNGs. They are internal QA only, use G2 planning proxies, claim no exact texture/finish or surveyed room, and cost USD 0. Four are byte-identical reuse from the prior independently verified Room Lab run; the clearance and KIVIK frames were rendered twice in fresh Chrome processes with matching PNG/RGBA evidence.

`CONCEPT_MARKETING_RENDER` is present as a separate blocked record with no URI/hash. It must not reuse a verification PNG. It remains blocked because public publication, derivative and provider-processing rights are `REVIEW`, redistribution is `NO`, an independent rights reviewer is absent, and a visible approximation disclosure has not been rendered.

## Available output hashes

| Camera | SHA-256 |
|---|---|
| top plan | `421bd408aac3154f8bdd6c67c3b4f00f113d3d1940c6a74277df4fd2b63adbd7` |
| wide room | `3f2c266359cf0182e7f8ef45b73eaef3153072e4dda5f77748f4cdaea5de94db` |
| seating relationship | `323784e3a5af8f24fc64c1df80e00e60c5ef660b183ed2e4b6f46feef6dbdd06` |
| side clearance | `88f6f060c1b0af0bdbdc782f36890b5d61722beed42b588bfe0f9448500e556e` |
| selected KIVIK | `d5c9078f55fc33743ef1bc75ea03890380f86df2548d17d898b703ef5546ccfd` |
| verification hero | `951f5f4e2b569df08d8cee9211ccbf35bc8555ff1cd0b385622f8539d06a4042` |
| 2400×1200 contact sheet | `d440992fd12244d2d00e4f9480b8f421f04e052648b819a15d0ba2ef6f5adcde` |

## Avatar Factory adapter

`furniture-avatar-manifest-v0.1` is absent at Avatar Factory checkpoint `2a959d4f8e270d150b74e3f43daf624a4ed06c9c`. The active adapter is the frozen inline eight-placement set. Future activation may change only asset URI/revision/hash, geometry/appearance level and rights reference. It must provide a bijective eight-record match and may not change cameras, scene, placement IDs, transforms, Product Twin IDs or source lanes. Missing/blocked furniture remains unresolved; silent substitution is forbidden.

## ES-29660 and cost truth

- Source snapshot: `IKEA_ES_ROOM_LAB_29660_2026_08_17`, observed 2026-08-17.
- State: dated context only; refresh before approval or purchase.
- LISTERBY remains `CURRENTLY_UNAVAILABLE`; it is not silently replaced.
- No current price, stock, delivery, lead-time, landed-cost, procurement-ready or supplier-origin claim is copied into media outputs.
- Expected generation cost: USD 0.
- Actual generation cost: USD 0.
- Paid/provider calls: 0.

## Verification commands

Run from the repository worktree:

```sh
node scripts/build-living-room-alpha-pack.mjs
node scripts/test-living-room-alpha.mjs
node scripts/validate-living-room-alpha.mjs
git diff --check
```

Current results: pack build exit 0; exact fixture pass; 73 negative mutations pass; validator exit 0 with six cameras, eight placements and seven output records; `git diff --check` exit 0. The mutation suite includes full camera-frustum changes, output/camera substitution, artifact and environment falsification, source-identity drift, disclosure overclaim, blocker removal, release-state weakening and future-adapter fallback. The local renderer command is `node scripts/render-living-room-alpha.mjs --overwrite`; its final duplicate run exited 0 with two native stills and USD 0 provider cost. One sandbox loopback denial and one transient Chrome abort occurred before successful retries; neither failed attempt promoted output evidence.

## Review decision requested from #2 Verification

Attempt to falsify: exact source/governance hashes; six unique numeric cameras; FOV/focal/aspect consistency; exact placement and crosswalk bijection; 0.785 m clearance; selected KIVIK orientation; output hash/dimensions; duplicate render and visibility evidence; strict output-class separation; conservative rights/disclosures; zero provider cost; dated ES context; inactive future adapter; and reviewer/executor independence.

Approval is for internal QA evidence only. It must not approve marketing publication, Room Lab consumption, provider generation, deployment or merge.

## Monitoring

- Re-run on any source scene, Twin JSON, GLB, camera, renderer or environment hash change.
- Re-check rights before every new publication channel or derivative/provider action.
- Refresh ES-29660 before any approval, quote or purchase.
- Re-validate and obtain independent approval before activating `furniture-avatar-manifest-v0.1`.
- Stop when the alpha pack is retired or replaced by an approved revision.
