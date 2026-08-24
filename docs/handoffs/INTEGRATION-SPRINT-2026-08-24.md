# Product Twin integration sprint — 2026-08-24

## Scope and branch

- Integration branch: `agent/integration-sprint-2026-08-24`
- Base: `origin/main` at `44237e528ead122c2b344b1335deaa9f56461bcb`
- Source branches remain unchanged.
- No merge to `main`, deployment, purchase, cart, RFQ send, supplier contact or rights promotion occurred.

## Preserved source histories

| Workstream | Integrated source | Treatment |
| --- | --- | --- |
| Platform Engine | `origin/agent/platform-engine` at `9e87d8a43b429c757d56ab51ffad65f698a7ad9f` | history-preserving merge |
| BRAGE | `origin/agent/brage-design` at `28e7cc174c142a002d254182758f21aa581fbcb2e` | history-preserving merge |
| Spatial Studio | `origin/agent/spatial-studio-claude` at `a8de79857404c1a065c20e9c931752ede89ef454` | history-preserving merge; shared docs and package scripts reconciled |
| MIMER | `origin/agent/mimer-svartinge` at `08d519796eb504ba421fcd67a7ddc06e625f430f` | six unique MIMER commits cherry-picked; duplicated spatial history excluded |
| Avatar Factory | `origin/agent/avatar-factory-claude` at `99828f7b5dead9ddb26c6f3035e638ed016c025e` | history-preserving merge; native binaries remain ignored runtime assets |
| Build Procurement | `origin/agent/build-procurement-logistics` at `f51e2f073c1b9b800263524a099bfcdc438d07de` | history-preserving merge; ES-29660 evidence kept destination-specific |
| Verification | `origin/agent/verification-evidence-monitoring` | deliberately not merged; remains independent reviewer |

## Integrated user path

The repository now supports this evidence-labelled path:

`Svärtinge neighbourhood → verified 1 m terrain → BRAGE Vinkelhuset → Glanrummet → Svärtinge-specific seven-product composition → same-role swap → source-price inspection → review BOM`

Run from the repository root:

```sh
node scripts/resolve-native-3d-showcase.mjs
PORT=8876 node scripts/serve-svartinge-neighbourhood-prototype.mjs
```

Open:

```text
http://127.0.0.1:8876/prototype/svartinge-neighbourhood/index.html#brage
```

Use stage **7. Enter Glanrummet**, then select **Open Glanrummet furniture study**. The direct room URL is:

```text
http://127.0.0.1:8876/prototype/showroom-living/index.html?context=svartinge-glanrummet
```

The room study discloses that:

- the Altea listing context is not used for Svärtinge;
- Sweden supply, tax, freight, delivery and checkout are not evaluated;
- offer values are dated snapshots, not current quotes;
- native GLB rights remain `review`;
- proxy items remain dimension-verified proxies, not exact manufacturer geometry.

## New integration contract

- Scene compiler: `scripts/build-svartinge-brage-integrated-scene.mjs`
- Scene: `data/sites/sweden/saterdalsvagen-14/neighbourhood-scene-brage-v0.3.json`
- Svärtinge composition: `data/showrooms/svartinge-glanrummet-living-room-v0.2.json`
- Room/commerce handoff: `data/integration/svartinge-glanrummet-commerce-v0.2.json`
- Runtime asset validator: `scripts/validate-native-3d-showcase-runtime.mjs`
- Final scripted vote: `scripts/gate-integration-sprint.sh`

The compiler removes the original box-house, normalizes all BRAGE geometry to supported Platform Engine primitives, samples the verified terrain for a rigid concept-house datum, and refuses missing removal targets or an incompatible base-scene version. All BRAGE elements remain `CONCEPT`.

## Verification result

Run:

```sh
bash scripts/gate-integration-sprint.sh
```

Result at this checkpoint: `PASS`.

Key checks:

- Platform Engine: 86 validation, 35 mutation, 47 compiler, 29 terrain, 72 studies, 54 OSM and 18 bundle checks passed.
- Plot-to-Project: 1,010 spatial assertions and 34 mutation attacks passed.
- Sweden/Svärtinge: 510 national, 740 property, 91 neighbourhood and 518 viewer assertions passed; all mutation suites passed.
- BRAGE integration: 33 checks passed, including the Svärtinge-specific composition, appearance-cue, mixed-currency and design-study wording guards.
- Native showcase: 8/8 manifest entries valid; when runtime assets are present, 8/8 GLB magic, size and SHA-256 checks pass.
- Procurement structural and mutation gates passed.
- The `--current` commerce check is expected to fail with exactly 9 stale observations; the final gate fails if stale commerce is ever accepted as current.

No controlled-browser visual QA is claimed in this environment. A self-contained engine artifact was successfully generated at ignored path `dist/twins/svartinge-brage-v0.3.html` (823 KB, zero runtime network requests), but that bundle does not include rights-restricted furniture GLBs.

## Independent review repair

The first independent review found one user-facing context leak that the original gate did not cover: the Svärtinge query mode changed the labels to Glanrummet but retained the Spanish/Mediterranean window scene and RFQ wording. The integration branch now:

- renders a disclosed, concept-only Lake Glan/pine horizon in Svärtinge mode;
- keeps the Mediterranean composition only in the original Spanish listing mode;
- uses a Svärtinge-specific 7 × 3 × 7 m concept-room composition instead of the Marbella placement manifest;
- applies a disclosed Scandinavian appearance-cue layer without changing geometry or claiming exact sellable finishes;
- withholds the room subtotal because the dated source snapshots mix USD and EUR and are not Sweden-comparable;
- labels copied output as a design-study BOM, never an RFQ;
- labels outbound merchant links as product pages, not live Swedish offers; and
- fails the BRAGE integration test if these Svärtinge-specific guards disappear.

The cloud browser cannot reach the container-local preview (`ERR_BLOCKED_BY_CLIENT`), so this repair has deterministic coverage but still requires a real visual interaction pass on a reachable preview or local Mac browser before promotion.

## Claims still blocked

- Legal/surveyed plot boundary, registered area reconciliation and set-out geometry.
- Finished floor, earthworks, legal access, utilities and buildable envelope.
- Public redistribution/render rights for NORR11/Wendelbo native GLBs.
- Exact visible finish/colour binding for the selected variants.
- G3 avatar promotion.
- Current price, stock, Sweden delivery, tax, freight, landed cost, checkout or purchase readiness.
- MIMER's Mac-vault image outputs are not yet versioned in GitHub; the original generator commits are preserved.

## Monitoring

- Price/stock/delivery: refresh before any client use and immediately before purchase; current display remains blocked meanwhile.
- Native geometry rights: re-check before every new publication channel; stop delivery on revocation or scope mismatch.
- Static terrain and GLB hashes: re-check when a source file or pipeline revision changes.
- Planning/access: re-check monthly while the Svärtinge project is active and whenever authority evidence changes.

## Independent review request

Verification should review the exact integration branch commit, rerun `bash scripts/gate-integration-sprint.sh`, inspect the v0.3 scene diff against the BRAGE patch, and visually inspect the neighbourhood-to-room path with the eight runtime GLBs present. Verification may recommend promotion but may not waive legal, rights, G3 or current-commerce gates.
