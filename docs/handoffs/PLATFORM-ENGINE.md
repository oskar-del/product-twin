# Platform & 3D Engine — Claude Session Handoff

> ## ⛳ SPRINT DAY — 2026-09-20 (Brain; Oskar runs all sessions today. Supersedes every earlier pin — the 2026-09-15
> CONSOLIDATION decisions still stand: one site per address · six screens · ink chrome · Platform owns the chrome.)
> RULES OF THE DAY: pull first · work the queue in order · each item ends with a screenshot in docs/screens/ + numbers ·
> commit after every item (Oskar pushes hourly) · nothing invented; every figure computed from receipts · report
> "DONE / NOT checked" per item in your handoff at end of day. Chrome tokens until Platform ships the package:
> bg #101916 · card #17241f · paper #f5f1e8 · bronze #d8b874 · serif display · Inter labels · evidence chips
> authoritative #176b52 / indicative #c18a2d / derived #497aa2 / reported #a65b68 / concept #735a9e.
>
> **PLATFORM — you unblock everyone. Ship item 1 by midday.**
> 1. `engine/ui/chrome/` — tokens.css + chrome.mjs: topBar(plot, modes) · sidePanel() · evidenceChip(cls) · card() ·
>    metricStrip() · sectionHead(). Extract from Spatial's Site-Intelligence page CSS (prototype/svartinge-neighbourhood
>    /index.html, the `.intel-*` rules) — do not invent. Demo page `engine/ui/chrome/demo.html` showing every component.
>    DoD: demo renders, screenshot, `docs/CHROME.md` with import instructions for the other sessions.
> 2. Re-skin BOTH shoppable rooms (Newport living, vidaXL terrace) on the chrome: dark stage, serif labels, product
>    panel = sidePanel(name · brand · dimensions + chip AUTHORITATIVE(GLB bounds)/INDICATIVE(title) · price · BUY
>    verbatim affiliate_link). "Looks" switcher. DoD: both rooms rebuilt in dist/twins, screenshots, links diffed
>    byte-identical to the catalog.
> 3. Room INSIDE Vinkelhuset: read BRAGE's room spec (geometry/house-v0.3-* on agent/brage-design, landing today) —
>    build the living room volume from it and place the Newport set inside. DoD: one rendered room with real walls/openings.
> 4. Stills gallery (screen 5): run engine/export/blender-scene.mjs on the Newport room → Cycles PNG committed under
>    dist/stills/, labelled VISUALIZATION. DoD: PNG + the command that made it.


> ## ⛳ CURRENT MANDATE — 2026-09-15 · CONSOLIDATION (Brain; Oskar decided. Supersedes 2026-09-08.)
>
> DECISIONS: one product = one site per address, SIX screens, ONE chrome ("ink"): bg #101916,
> paper cards, serif display (Georgia/Cormorant), Inter labels, bronze kicker #d8b874, five fixed
> evidence-chip colours (authoritative #176b52 · indicative #c18a2d · derived #497aa2 · reported
> #a65b68 · concept #735a9e). Screens: 1 Site Intelligence (FRONT DOOR, reading first) · 2 Spatial
> Lab (3D) · 3 The House · 4 Rooms (shoppable; separate stage ships first, then inside the house)
> · 5 Stills · 6 Numbers · plus an index of plots. Platform OWNS the chrome; everyone consumes it.
>
> YOUR QUEUE (blocking everyone — do 1 first, ship it in a day):
> 1. **THE CHROME PACKAGE** `engine/ui/chrome/`: tokens.css + chrome.mjs exporting topBar(plot,
>    modes), sidePanel(), evidenceChip(class), card(), metricStrip(), sectionHead(). Reference
>    = the Svärtinge Site-Intelligence page (its CSS is the source of the tokens — extract, don't
>    invent). A demo page showing every component. Doc: `docs/CHROME.md`. Gate: every component
>    renders in the demo + one screenshot committed.
> 2. **RE-SKIN THE TWO SHOPPABLE ROOMS** with the chrome: dark stage, serif labels, product panel =
>    sidePanel with name / brand / dimensions + evidence chip (AUTHORITATIVE if from GLB bounds,
>    INDICATIVE if parsed from title) / price / BUY (verbatim affiliate link). Looks switcher.
> 3. Then rooms INSIDE Vinkelhuset (BRAGE room spec), then stills gallery (screen 5) from your
>    Blender export. Commit each; Oskar pushes.
> ## ⛳ CURRENT MANDATE — 2026-09-08 (Brain; verified your Newport+vidaXL rooms — links are real, geometry hydrates. Supersedes the 2026-09-06 redirect.)
>
> The money loop now exists. Next: make it a PRODUCT, not a demo.
> 1. **PUT THE ROOM IN A HOUSE.** The shoppable room floats in an abstract box. Mount it inside
>    BRAGE's Vinkelhuset (`house-v0.2-geometry-spec.json` on agent/brage-design) — real room
>    dimensions, real window openings, real orientation. A buyer walks THEIR house and shops it.
>    This is the whole plot-to-project promise in one surface.
> 2. **ONE ROOM, MANY LOOKS.** Same room geometry, 3 furnishing sets from different catalogs
>    (Newport / vidaXL-outdoor for the terrace / Kungsängen+Lampemesteren for a bedroom).
>    Switchable in the UI. Proves the engine scales past one hand-built scene.
> 3. **HERO STILL FROM THE REAL ROOM.** You built `engine/export/blender-scene.mjs`; run it on the
>    Newport room, render with Cycles, commit the PNG. Interactive twin + Archevio-grade still
>    from ONE graph — end-to-end, proven, not just wired.
> 4. Keep every link verbatim from the catalog; keep the gates green.
> Deliverable-first: end each block with a rendered surface + numbers.

> ## ⛳ REDIRECT — 2026-09-06 (Brain; verified your shoppable room — good build, WRONG inventory)
>
> The room uses 8 IKEA twins with BUY→ikea.com. IKEA is NOT an approved channel; those links
> earn nothing. The mandate said Newport first. Swap the inventory: read
> `../repo-avatar-factory/data/newport/newport-catalog.jsonl` (13,036 rows; FURNITURE bucket
> has G2 proxies at `../repo-avatar-factory/data/geometry/avatars/newport-<id>-g2-proxy.glb`)
> and rebuild the same living room from Newport pieces — BUY = the row's `affiliate_link`
> (channel-tracked, verbatim). Decor attach layer from Newport DECOR rows. Then a second
> room from `vidaxl-outdoor` (terrace). Keep everything else you built. Same gates.

> ## ⛳ CURRENT MANDATE — 2026-09-01 (Brain; supersedes earlier pins; re-read every resume)
>
> THE BOTTLENECK IS NOW YOU: we hold ~226k channel-tracked SKUs (9 catalogs in
> repo-avatar-factory/data/) + 3,849 GLBs + 8 native manufacturer meshes, but NO consumer
> surface composes them. Build the SHOPPABLE ROOM surface on the one engine:
> 1. **Consume the avatar library at scale**: load twin catalog rows (Newport first) +
>    their GLB proxies into the engine's scene contract; render a furnished room with
>    click-object → product panel (name, price, image, BUY = affiliate_link). The
>    twin-consumption path you built (GLTF_ASSET + adapter) is the base — feed it real data.
> 2. **Attach-point rendering**: Avatar is defining base+slot layering (sofa→pillows,
>    table→vase, floor→rug). Render composed vignettes from that schema — swap any item.
> 3. **Hero-still hook**: repo-avatar-factory/scripts/hero_still_poc.py proves scene→Cycles
>    (~3min/frame, Archevio format). Add an engine export so ANY composed scene emits the
>    Blender scene for a photoreal still. Interactive twin + hero still from one graph.
> 4. Then: Site Intelligence template absorption + gate '9' derivation (unchanged backlog).
> Deliverable-first: end every block with a rendered, clickable, shoppable room. Commit;
> Oskar pushes.

> ## ⛳ UPDATE 2026-08-27 — Lantmäteriet data landed
> The LM vector grants delivered (parcels + buildings, `"../lm-data/"`, repo-external).
> Spatial derived the authoritative SVÄRTINGE 54:28 boundary (1 936.8 m²,
> `data/sites/sweden/saterdalsvagen-14/property-division-derived-v0.1.json` on its
> branch). Engine implication: the twin-scene contract should carry an
> AUTHORITATIVE-boundary layer (polygon overlay + evidence chip) and, later, an LM
> byggnad-footprint context source next to OSM. Slot after item 1 below — the mount-
> contract review is still first.

> ## ⛳ CURRENT MANDATE — 2026-08-25 (from Brain fleet sweep; re-read on every resume/compaction)
>
> **1. You owe Spatial a review you haven't seen.** Spatial Studio drafted
> `docs/DESIGN-SELECTOR-MOUNT-CONTRACT.md` (on branch `agent/spatial-studio-claude`,
> ~64 lines, "Status: DRAFT for Platform review") and is blocked waiting for you to
> freeze it before implementing `mountDesign()/clearDesign()`. BRAGE's geometry spec
> for all three Svärtinge houses already exists
> (`OPEN AI/Säterdalsvägen 14 - Svärtinge/04-House-Design/BRAGE/geometry/house-v0.2-geometry-spec.json`
> on `agent/brage-design`). Both halves of the design-selector integration exist —
> only your review connects them. ~1 hour. Do this first.
> **2. Twin-consumption path** (per SESSION-GOALS): glTF/GLB avatar loader + SYSTEMS
> profile so `data/twins` records render as contract-valid scene elements — retires the
> legacy showroom viewer.
> **3. Gate housekeeping:** branch `fix/gate-grep-fallback` (from origin/main) swaps the
> gate's rg call to grep (rg missing on this machine). The hard-coded "expected 9 stale
> offer blockers" snapshot assertion in `scripts/gate-integration-sprint.sh` is yours to
> make derived instead of typed.
> Full verified fleet state: `docs/FLEET-STATE-2026-08-25.md` on `agent/brain`.


## SPRINT DAY 2026-09-20 — Platform status (written during the day, not at close)

Two sessions were live in this one worktree (`repo-platform`, `agent/platform-engine`)
against the rule "one checkout = one executor". ai-c6 and I found each other mid-build on
item 1, both having written `engine/ui/chrome/`. We split by message: I took items 1 and 2,
ai-c6 took item 4 and the screenshot tooling. `tokens.css` is ai-c6's and I kept it; the
component API is mine. Nothing was lost, but the overlap cost about an hour — worth a
dispatcher rule before the next sprint day.

**Item 1 — chrome package · DONE** (`a5e2f177e5`, `50438a61cf`)
`engine/ui/chrome/{tokens.css,chrome.mjs,chrome-css.mjs,build-demo.mjs,demo.html}` +
`docs/CHROME.md`. Screenshot `docs/screens/chrome-demo-2026-09-20.png`.
Verified in-browser: topBar 1 · modes 6 · metricStrip 4 · evidenceChip 21 · card 5 ·
sectionHead 7 · sidePanel 1 · evidenceLegend 1; body background `rgb(16,25,22)` = #101916;
`--ink-bronze` resolves #d8b874. Demo figures are computed from receipts — parcel area is
recomputed by shoelace from the clip's own ring and independently lands on Lantmäteriet's
**1 936,8 m²** (6 vertices, 75 context rings, raw sha256 `839f729f63d8…`).
Components return HTML **strings**, not DOM nodes: the consumers are node-side generators
(the bundler, build-demo) and neither has a DOM.
*NOT checked:* no visual-regression baseline, so drift from the `.intel-*` source is caught
only by eye; untested in Safari/Firefox (chips use `color-mix()`); I did not re-derive every
value in ai-c6's `tokens.css` against the source page myself.

**Item 2 — re-skin both rooms · DONE** (`dc0ff62be9`)
Dark ground, chrome topBar, "Looks" switcher (each look is the other bundled room), product
panel = `sidePanel()` via the engine's existing `onElementOpen` seam.
  newport-living  14 elements · 11 GLB inlined (137 KB) · 11 measured from mesh
  vidaxl-terrace   9 elements ·  7 GLB inlined  (44 KB) ·  7 measured from mesh
  BUY links **18/18 byte-identical** to the catalog twins' `affiliate_link`.
The dimension chip needed something true behind it — scene elements carried no dimension
provenance, so AUTHORITATIVE/INDICATIVE would have been asserted rather than known.
`engine/geometry/glb-bounds.mjs` reads POSITION accessor min/max out of the GLB JSON chunk:
measured off the mesh = AUTHORITATIVE, catalog title or category default = INDICATIVE.
Screenshots `docs/screens/room-{newport-living,vidaxl-terrace}-2026-09-20.png`.
*NOT checked:* headless Chrome cannot create a WebGL context, so screenshots use
`--use-angle=swiftshader` — they prove the page, not GPU parity. The 3D environment is still
the engine's REALISTIC sky/ground; only the chrome around the stage is dark. `dist/` is
gitignored so the bundles are not committed. No BUY click-through to a live merchant.
A substring grep over the bundle under-reports links 5/7 because esbuild escapes "ä" as
`\xE4` in the JS literal — that is a source encoding, not a URL change; the runtime href is
exact, which is what I verified.

**Item 3 — room inside Vinkelhuset · DONE** (`bb45589906`) — picked up by ai-c6 [c3cd6a] after
the other session ended.
`scripts/compile-room-in-house.mjs` reads `ROOM_GLANRUMMET` out of
`house-in-scene-v0.3-patch.json` — the real **7 × 3 × 7 m** volume — and re-seats the same
Newport products inside it. The openings are BRAGE's as well: the room element states *"Fully
glazed south+west"*, so the compiler emits one wall-sized opening per glazed face and **refuses
to build** if the spec claims no glazing. The spec's note that the glazing is splayed toward the
lake is carried as a limitation on those openings rather than modelled, since this volume is
orthogonal.
  15 elements · 11 shoppable · **BUY links 11/11 byte-identical** to the source scene (the
  compiler diffs them and exits non-zero if one moves)
  `dist/stills/glanrummet-newport.png` · 1600×1000 · 160 samples · **1 m 40 s**
  `npm run engine:gate` — all suites green
The exporter had only ever cut openings in north/south walls; it now resolves each opening to
its wall by axis (a 90°-rotated opening lies in an east/west wall, width running along z) and
lights it in that wall's own plane.
*NOT checked:* the room is compiled at its **own origin** and is not yet mounted in the Svärtinge
house scene at its real place (`room_origin_in_house [-7.5, 1.5, -0.5]` is recorded but unused),
so the lake horizon in the render is Blender's sky — **not** a view solved against the real
terrain or Glan; the interior walls BRAGE defines around this room
(`WALL_INT_LIVING_KITCHEN` et al) are not rendered — the shell is the room volume's own faces;
no doorway is modelled, because the patch specifies none for this room; the seating positions
are my layout, not BRAGE's — the spec gives the volume and the glazing, not a furniture plan.

### End of day — all four items

| # | Item | State | Evidence |
|---|------|-------|----------|
| 1 | Chrome package | DONE | `a5e2f177e5`, `50438a61cf` · `docs/screens/chrome-demo-2026-09-20.png` |
| 2 | Re-skin both rooms | DONE | `dc0ff62be9` · `docs/screens/room-*-2026-09-20.png` · BUY 18/18 byte-identical |
| 3 | Room inside Vinkelhuset | DONE | `bb45589906` · `docs/screens/still-glanrummet-newport-2026-09-20.png` |
| 4 | Stills gallery | DONE | `fe523f1fc1` · `docs/screens/still-newport-living-2026-09-20.png` |

Full-resolution stills live in `dist/stills/` (item 4's DoD asks for them there); `docs/screens/`
carries 1000 px copies so the day's screenshot rule is satisfied in one place.

**Biggest thing left undone:** the room is not yet *in the house in the world*. Items 3 and 4
render a room at its own origin. Mounting `ROOM_GLANRUMMET` into the Svärtinge scene at
`[-7.5, 1.5, -0.5]`, with the real terrain and a real Glan sightline through the south glazing,
is what turns this from a furnished box into the plot-to-project promise. That is the next move,
and it needs Spatial's scene, not just BRAGE's patch.

**Item 4 — stills gallery · DONE** (`fe523f1fc1`) — ai-c6 [c3cd6a], the other session.
`dist/stills/newport-living.png` · 1600×1000 · Cycles · 160 samples · **5 m 42 s**, plus the
`.py` that produced it, both committed. The command:

    node scripts/export-blender-scene.mjs \
      data/scenes/shoppable-room-newport-living/scene-v0.1.json \
      --out dist/stills/newport-living.py --samples 160
    blender --background --python dist/stills/newport-living.py

The export had never been run end to end. Doing so surfaced four defects, all fixed:
`BASE_PATH` was the scene's own directory while `asset_path` is repo-relative, so all 11 GLB
imports resolved to paths that do not exist and the render was an empty room; the shell was a
hardcoded 12 m plane instead of the scene's `ROOM_VOLUME`; `slab()` scaled a unit cube by
`size/2`, so every wall came out half-size and the room did not close; and the stage camera at
(4.5, 4.5, 3.2) is outside the volume and above the ceiling, which shoots through a wall once
the walls are real. The shell is now built from `ROOM_VOLUME` (6 × 2.7 × 5 m) with each
`OPENING` cut out of its wall as segments and lit by an area light matched to the opening's own
size and plane; the camera is derived — a corner at 1.42 m on a 30 mm lens aimed at the
centroid of the furniture actually placed. Surfaces come from each catalog row's own
`color`/`material` text through a fixed word table ("Mässing / Marmor / Valnöt" → brass,
marble, walnut); nothing is styled per product by hand.
`npm run engine:blender:test` — **37 passed, 0 failed**. §5 had asserted the old hardcoded
`primitive_plane_add`; it now asserts the room dimensions reaching Blender, the opening being
cut and lit, and the camera landing inside the volume.
**LABEL: VISUALIZATION** — G2 planning proxies with representative surfaces: real footprint
and height, not manufacturer industrial design or artwork. Not a photograph of these products.
*NOT checked:* the vidaXL terrace still is unrendered (open-air scene, no `ROOM_VOLUME`, so it
takes the untested stage-camera path); no perceptual or regression check on the image beyond
my looking at it; the colour word table is hand-authored and exercised only by the Swedish
words these two catalogs happen to use; no GPU/denoiser parity check against another machine.

**`.gitignore` changed — read this before committing build output.** `dist/` was ignored, so
"PNG committed under `dist/stills/`" was impossible as written. Line 5 is now `dist/*` plus
`!dist/stills/`. **`dist/twins/` is therefore still ignored** — item 2's bundles are not
committed, and whoever wants them committed must add `!dist/twins/` deliberately.

**One claim above needs narrowing.** Item 1 records that the demo's shoelace area
"independently lands on Lantmäteriet's 1 936,8 m²". The shoelace runs over derived geometry
from the same clip file, so it establishes that the ring survived the pipeline uncorrupted —
not that our figure independently agrees with Lantmäteriet's own registered area. Related: the
subject ring stores **7 points whose last repeats the first**, so the parcel has **6 distinct
corners**; the Spatial page's "7 vertices" is counting the closing point.

## Why this session exists
Three workstreams are each building their own three.js viewer (Svärtinge twin, Essence microsite, Avatar showroom) plus four legacy prototypes. That's the same engine written five times. This session owns the SHARED technology so every surface gets the best stack once: one twin-engine, one design system, one bundling/publish pipeline.

- Repository: `oskar-del/product-twin` · Branch: **`agent/platform-engine`** (create from main)
- Worktree: `git worktree add "../repo-platform" -b agent/platform-engine origin/main` — work ONLY there.
- Read first: `AGENTS.md`, `docs/OPENAI-ERA-AUDIT-2026-08-18.md`, `docs/VALUE-STORY-AND-IDEA-LEDGER.md`, the three viewer implementations (`prototype/svartinge-neighbourhood/`, `prototype/showroom/`, Essence branch), and the Gemini harvest verdict in the ledger.

## Owns
- **twin-engine**: one reusable module (scene graph, evidence-class layers, camera presets/tweens, INTELLIGENCE/REALISTIC/COMPARE/SYSTEMS profiles, terrain mesh loader for LM COG/DEM, OSM/vector context extrusion, Mapbox context layer, clickable-object → panel contract, availability-status coloring, sun/time, viewshed overlay).
- **Stack decisions with evidence**: three.js vs alternatives, 3d-tiles-renderer, COPC/point-cloud viewing, gaussian splats (parked-watch), state management, perf budgets (mobile!), embed/iframe architecture, artifact-vs-deploy bundling (esbuild single-file = proven pattern).
- **Design system for buyer surfaces**: H&H light/serif aesthetic tokens + the locked showroom language (white modular furniture, round + hotspots, real-listing header card) as reusable UI components.
- **Publish pipeline**: one command from scene-data → bundled self-contained HTML → artifact link or safe_deploy target.

## Does NOT own
Product decisions (Brain), evidence/G-promotion (Avatar Factory + Verification), site truth (Spatial), client scope (Essence). It serves them.

## First milestones
1. **Audit the five viewers** → extraction plan: what becomes twin-engine v0.1 (probably the Svärtinge viewer core, generalized).
2. **twin-engine v0.1** consumed by ONE surface (Essence microsite is nearest) without regressions — gate: its validators still pass.
3. **Bundle command**: `npm run engine:bundle -- <scene>` → self-contained HTML (the manual esbuild dance from 2026-08-18, automated).
4. **Perf budget doc**: target devices, poly/texture budgets per surface class (twin / microsite / showroom / portal).

## Rules
One checkout = one executor. Deliverable-first: every block ends with something visible or a merged reusable module. Decisions >scope → Brain. Never edit other worktrees or `~/.codex/`.

## Current state

### 2026-09-21 — BRAGE v0.4, dimension tiers, and two overclaims removed

**The wing roof clash is closed.** v0.3's `wing_roof` was a 15° monopitch falling
north; taken literally it landed at Y 0.64 while the garage and utility beneath
reach 2.40–2.50 m, so the roof passed through the rooms. The other reading
(rising south) overtopped the bar ridge. I built the literal reading, detected
the clash and disclosed it rather than re-pitching someone else's roof; BRAGE's
v0.4 makes the wing **its own 15° gable** — ridge z=7 at Y 4.07, eaves level with
the bar's at 3.0 — and its `supersedes` note records the reason. Compiling v0.4
now yields **0 spec conflicts** and four roof planes.

`compile-house.mjs` is shape-aware: GABLE and MONOPITCH both compile, so an older
spec still compiles as what it says it is.

**Spec provenance instead of a vendored copy.** Brain asked for a re-vendored
spec carrying source_commit + sha. A second copy is the thing that goes stale, so
the file stays BRAGE's and `specProvenance()` records the sha256 of the exact
bytes compiled plus the brage commit. Reproducible, cannot drift.

**Dimension tiers (the bigger correction).** This compiler had stamped
`GLB_BOUNDS → AUTHORITATIVE` since the first Newport room. Avatar established
that 3,645 of Newport's 3,673 "measured" twins are category-default envelopes,
so that bounding box is exact about a guess — every Newport item wore a green
AUTHORITATIVE chip it had not earned. AUTHORITATIVE now requires SOURCE *and* a
manufacturer-native mesh and is unreachable otherwise, asserted including the
negative case. Two gotchas for other consumers: the stamp is at
`physical.dimensions_tier`, **not** top-level, and `data/twins` here is a stale
unstamped subset — read Avatar's checkout.

Placed-item tiers, from the stamps:

| room | placed | SOURCE | WD_S+H_DEF | ALL_DEFAULT |
|---|---|---|---|---|
| Newport living | 11 | 0 | 1 | 10 |
| vidaXL terrace | 7 | 7 | 0 | 0 |
| Bedroom (3 channels) | 7 | 0 | 2 | 5 |
| Glanrummet | 11 | 0 | 1 | 10 |
| **TOTAL** | **36** | **7** | **4** | **25** |

AUTHORITATIVE emitted: **0**.

**The disagreement loop worked.** I flagged that vidaXL titles state all three
axes while their twins were stamped ALL_DEFAULT, and deferred to the stamp rather
than promoting locally. Avatar re-stamped; those rows are now SOURCE and the
terrace picks better-provenanced SKUs. `scripts/dimension-disagreements.mjs`
records any future such gap per build and the gate asserts it is current —
currently **0 disagreements**.

**"Gate the artefact, not the tool."** The stills exporter was already correct,
but 2 of 3 committed `.py` files had been shipping with no VISUALIZATION stamp —
they were exported before it existed. Asserting on the exporter could not see
that. The gate now asserts on the committed files, and
`scripts/stills-manifest.mjs` records png sha + script sha + stamp per still so a
re-export without a re-render is caught too. The stamp was also shortened to one
line: the first version wrapped and its second line fell off its background strip
onto light pixels, which made the disclaimer the least readable thing in frame.

**Bedroom look #3** — Kungsängen bed + Lampemesteren lamp + 5 Newport, three
channels in one room, and the first real exercise of "height: category default".
Needed title-based role selection (Kungsängen ships an empty category on all
23,822 rows) and a per-role minimum tier (Lampemesteren is mostly NONE).

**NOT checked:** no browser but the CDP/preview Chrome; narrow viewports; scene
teardown between Looks switches; `dist/twins` is gitignored so the interactive
pages are build outputs only.



### 2026-09-20 POST-CLOSE — sole Platform executor from here

Brain's dispatcher moved the second session to Spatial's queue: **repo-platform
is now a single-executor checkout again.** Three commits land after the
"all four items DONE" close above, so treat that close as a snapshot that
predates them:

- `b916c0f96f` **ink stage.** `INK_STAGE_ENVIRONMENT` in `core/profiles.mjs` —
  dark neutral ground, warm low-key hemisphere, contact shadows. Opt-in per
  surface via `stageEnvironment`; it is **not** a new profile and does **not**
  touch `REALISTIC`'s shared defaults, which every other surface renders
  against. Scoped to REALISTIC by construction: INTELLIGENCE is the evidence
  view and is never restyled to suit a surface. vidaXL terrace default profile
  INTELLIGENCE → REALISTIC (it defaulted to the evidence view back when every
  piece was a CONCEPT box; those rows now carry G2 proxies).
- `ef3c9ebce0` **Glanrummet canonicalised.** `data/scenes/room-glanrummet-newport`
  is the one scene; the `shoppable-room-glanrummet` duplicate is deleted and the
  Rooms surface repointed. Two defects fixed while adopting it: the room volume
  had no `picking:false` (third instance of that bug — it swallowed every click,
  so no product panel could open), and the scene inherited the Newport room's
  claim policy by spread, which understated a CONCEPT house sold on a lake
  outlook. `blocked_claims` now carries BUILDABLE_ENVELOPE, VIEW_OR_OUTLOOK and
  FLOOR_LEVEL, and both glazing elements state that anything seen through them
  is a VISUALIZATION.

**Standing rule (Brain, 2026-09-20):** a rendered horizon in any still is never
a view claim — label VISUALIZATION.

**Gate: 13 suites, 928 checks, green. Working tree clean.**

**NOT checked:** `dist/stills/*.py` and the committed still are not yet audited
against the VISUALIZATION rule — the rooms surface and the Glanrummet scene
carry the label, the stills pipeline was the other session's and I have not
read its output text. Also unchecked: any browser but the CDP/preview Chrome,
narrow viewports, and scene teardown between Looks switches (not audited for
leaks).

**Next:** re-run `node scripts/compile-room-in-house.mjs` when BRAGE's
house-v0.3 spec lands (it keeps ROOM_GLANRUMMET); the vendored copy is
`data/house/brage-house-in-scene-v0.3-patch.json` with its source commit in
`data/house/PROVENANCE.md`.



### 2026-09-20 SPRINT DAY — session B (the second Platform session) · end-of-day report

**⚠️ READ THIS FIRST: two Platform sessions ran the same queue today.** A second
session was working the identical 4-item queue in this same worktree. It
overwrote `engine/ui/chrome/chrome.mjs` + `tokens.css` (18:55), then
`scripts/compile-vidaxl-terrace.mjs`, then `scripts/compile-room-in-house.mjs`
(19:41) while I had them open, and it has committed items 1, 2 and 4
(`3da5edc5dc`, `fe523f1fc1`, `a8d4ca2f01`). Oskar was asked at 19:0x which lane
to take and said "take item 2, verify theirs". Everything below is from that
split. **The two item-2 implementations overlap and need reconciling — Brain's
call, not mine.**

**Item 1 — the chrome package: NOT MINE.** Built and committed by the other
session. My only contribution was verification: at 19:02 their `demo.html`
rendered **blank** (`demo.html` imported a `section` export that `chrome.mjs`
did not provide — console `SyntaxError`, screenshot blank). They rewrote
`chrome.mjs` twice afterwards; the version at 19:20 loads and its string API
(`topBar`/`sidePanel`/`evidenceChip`/`card`/`metricStrip`/`sectionHead`) is what
item 2 consumes.
- **NOT checked:** the final demo.html after their fixes; `docs/CHROME.md`;
  whether every component actually renders in their committed demo. I verified
  the broken state, not the fixed one — someone other than them still needs to
  open it.

**Item 2 — re-skin both rooms: DONE (mine, `1a5774609e`).**
`scripts/build-rooms-surface.mjs` → `dist/twins/rooms.html`, one page, three
looks. Engine chrome off (`chrome:false`); the ink package is the only chrome.
- Newport living  14 elements · 11 shoppable · 11 tracked · 208 760 SEK
- vidaXL terrace   9 elements ·  7 shoppable ·  7 tracked ·  18 911 SEK
- Glanrummet      17 elements · 11 shoppable · 11 tracked · 208 760 SEK
- **18/18 BUY links byte-identical to their catalog rows**, now asserted in the
  gate (§11) so a future "URL cleanup" fails loudly instead of earning nothing.
- Dimension provenance is explicit and chipped: GLB bounds → AUTHORITATIVE,
  title-stated cm → INDICATIVE, nominal → CONCEPT. One chip, describing the
  dimensions it sits beside; geometry evidence is a separate row.
- Screenshots: `docs/screens/2026-09-20-rooms-newport-panel.png`,
  `docs/screens/2026-09-20-rooms-vidaxl-panel.png` (1600×1000@2x, panel open).
- Three real defects fixed on the way: `ROOM_VOLUME` swallowed every click
  (container shells can now opt out of picking — this had been worked around
  twice by switching stages); the self-contained bundle had gained an external
  Google-Fonts `<link>`, breaking the one-request guarantee the bundle gate
  enforces; deep links went through `viewer.elements`, which is a Map of
  three.js objects, not scene elements.
- **NOT checked:** any browser other than the CDP/preview Chrome; mobile or
  narrow viewports; the Looks switcher under rapid repeated switching (scene
  teardown between looks is not audited for leaks); whether the other session's
  parallel item-2 surface and this one can coexist; prices/availability are the
  catalog's at build time and were not re-fetched.

**Item 3 — room inside Vinkelhuset: NOT MINE, INCOMPLETE ON MY SIDE.** I read
BRAGE's `house-in-scene-v0.3-patch.json`, vendored it to `data/house/` with
`PROVENANCE.md` (source commit + refresh command, since reading across branches
is not reproducible), and built a compiler from `ROOM_GLANRUMMET` (7×7×3 m at
[-7.5, 1.5, -0.5], 120 mm east wall from `WALL_INT_LIVING_KITCHEN`, south+west
glazing from the room's own `feature` string) with 0 pieces outside the room
volume. The other session overwrote that file at 19:41 with their own version;
theirs is what is on disk and in the Looks switcher.
- **NOT checked / NOT DONE:** my interior stage fix never applied (the file was
  replaced mid-edit), so **the DoD "one rendered room with real walls/openings"
  is NOT met by anything I produced** — my only Glanrummet render showed the
  furniture with the walls culled, so I deleted it rather than pass it off.
  Their version is unverified by me.

**Item 4 — stills gallery: NOT MINE.** Committed by the other session
(`fe523f1fc1`). I verified the artefact: `dist/stills/newport-living.png` is a
genuine 1 600 × 1 000 Cycles render — real GI, soft contact shadows, the Newport
G2 proxies in a shell — not a placeholder.
- **NOT checked:** the exact command/seed that produced it; whether it is
  reproducible from the committed `.py`; whether it is labelled VISUALIZATION
  where a buyer would see it; render time.

**Gate at end of day: 13 suites, 928 checks, all green** (`npm run engine:gate`,
re-run after every change above). `engine:catalog:test` grew 124 → 139: the
vidaXL assertions that claimed "no proxies exist" were stale once the other
session generated vidaXL G2 proxies, and were rewritten to assert the new truth
(proxy-backed → INDICATIVE + asset on disk; proxy-less → CONCEPT + says so;
dimensions still trace to the title either way) rather than deleted.

**Tooling added:** `scripts/shoot.mjs` — screenshots a live page over CDP and
waits for the page's own readiness flag. `--virtual-time-budget` never exhausts
against a continuous render loop (it hangs), and a fixed delay captures whatever
had painted rather than a known state. Note for anyone reusing it: macOS has no
`timeout`, and `--disable-gpu` kills the WebGL context outright.


- 2026-08-19: seeded by Brain. Nothing built.
- 2026-08-19 (Platform session, branch `agent/platform-engine`, worktree `../repo-platform`):
  - **Milestone 1 DONE** — `docs/TWIN-ENGINE-AUDIT-2026-08-19.md`: measured capability matrix of
    all five surfaces (`npm run engine:audit` re-derives it), what each surface actually is, the
    seven welds tying the one real engine to Svärtinge, the v0.1 module map, and four decisions
    escalated to Brain (D1 `main` is behind the spatial branches · D2 the Svärtinge validator
    asserts on viewer source strings · D3 three.js CDN-vs-local drift · D4 `engine/` at repo root).
    Headline finding: there is **one** engine (Svärtinge) and four single-purpose demos, three
    with no scene contract at all.
  - **twin-engine v0.1 BUILT and RUNNING** — `engine/` (see `engine/README.md`),
    `config/spatial/twin-scene-v0.1.schema.json`, demo at `npm run engine:demo`.
    Gates: `npm run engine:gate` → validate 93/93, mutations 35/35.
    The generic schema is a structural superset of the Svärtinge site profile: the production
    scene validates against it unmodified, and the gate cross-checks the engine's map-view
    derivation against all 7 of that scene's stored `live_context_view` values.
  - **Milestone 3 DONE** — `npm run engine:bundle -- <scene.json>` → one self-contained HTML
    (engine + three.js + scene + styles inline, zero network requests). Verified in a browser
    served from an isolated directory where `/engine` and `/node_modules` both 404: exactly one
    request, fully functional twin. Gated by `scripts/test-twin-scene-bundle.mjs` (18 checks,
    context-aware self-containment, refusal of contract-violating scenes, byte-identical
    rebuilds). esbuild 0.28.2 pinned, build-time only.
  - **Milestone 4 DONE** — `docs/TWIN-ENGINE-PERF-BUDGET.md`: budgets for four surface classes
    from real measurements of the production Svärtinge scene on the engine (worst stage 7,320
    triangles / 98 draw calls / 0.71 ms; graph build 2.83 ms; bundle 803 KB ≈ 5–25 % of the Twin
    budget). Names where headroom goes (1 m DEM terrain ≈ 259k triangles = over budget; OSM
    extrusion at 500 buildings = 1,000 draw calls vs a 400 ceiling). Explicit that no phone was
    used and no sustained frame rate was sampled.
  - **The engine renders the real Svärtinge scene.** Bundled from the copy staged in `.runtime/`
    (no cross-branch commit): all 37 elements, 7 stages, evidence layers, INTELLIGENCE/REALISTIC/
    COMPARE, claim policy in the legend. The engine is ready for a consumer; only the branch base
    (D1) is in the way.
  - **Scene compiler built (not in the original milestone list, but it is what Milestone 2
    actually needed).** `engine/compile/` turns the evidence a site workstream holds into a
    validated twin-scene: GeoJSON parcels → local ENU rings with an area cross-check against the
    authority's own stated area; scattered elevation samples → an interpolated GRID_SURFACE that
    ships its own limitations; an assembler that frames cameras from real extents and refuses
    anything unsourced or unrenderable. Gate `engine:compiler:test`, 47 checks.
  - **Essence compiles and renders TODAY.** `scripts/compile-essence-site-scene.mjs` (the
    reference site adapter, ~40 lines of site-specific joins) compiles the pilot's real Catastro
    + IGN data into a scene: 11 parcels AUTHORITATIVE, terrain DERIVED, every ring within 0.73 %
    of Catastro's stated area, **no villa massing** because villa-to-parcel assignment is not
    evidenced. Bundles to 805 KB and renders. It reads its inputs from a `--data` directory, so
    the Essence session can run it the moment the data and this branch meet.
  - **For the Spatial session:** the Svärtinge scene's stored `live_context_view` centres were
    derived with flat equator constants and are up to ~1.8 m off at 230 m from the origin. The
    engine's values are the corrected ones; the gate proves the difference is exactly the
    geodesy-model correction (±2 cm). Worth regenerating those stored values.
  - **Measured claims (`engine/studies/`)** — the Essence showcase thesis, made real: sightlines
    and sun-hours computed by raycasting the twin's own geometry. `viewer.measure.sightline()`,
    `.sunHours()`, `.sightlineMatrix()`, `.drawSightline()`. Every result is DERIVED, names its
    method, and ships limitations saying what the model cannot see. Runs headless (three.js
    raycasting needs no WebGL), so `npm run engine:studies:test` gates 53 known-answer checks.
    On the real Essence block: all 55 pairwise parcel relations computed, 51 open / 4 blocked by
    terrain; 14.83 h of sun on parcel 13 on 21 June, 06:40→21:30 local.
  - **Viewshed (`engine/studies/viewshed.mjs`)** — the compute half of the ledger's "view
    certificate". Compass sweep + bisection for the horizon per azimuth → open-sky fraction
    (exact, from the solid angle above the horizon), per-sector summary, clear sectors, and
    principal blockers with their share of the compass. Directions still blocked at the top of
    the search contribute zero sky and are reported as unresolved rather than credited.
    `viewer.measure.viewshed()` / `.drawViewshed()`; 19 more known-answer checks in the studies
    gate. On the Essence block from 1.6 m: parcel 21 = 98.7 % open sky, mean horizon 0.74°,
    clear to N/NE/SW/W/NW, derived terrain accounting for 83 % of what blocks it.
  - **Terrain decimation (`engine/compile/height-field.mjs`)** — the perf budget's single named
    risk, solved before it lands: a dense DEM → a GRID_SURFACE decimated to a triangle budget,
    reporting the RMS/max height error the coarsening cost. The 259k-triangle 1 m-DEM case
    decimates to 149,058 (under the 150k Twin ceiling), losing 0.7 mm RMS on a smooth surface,
    and the terrain's limitations say so. Gate `engine:heightfield:test`, 29 known-answer checks
    incl. a curved surface where decimation MUST report nonzero, monotonically shrinking, error.
    Verified rendering: a synthetic ridge-and-valley DEM decimates and renders at 0.2 ms/frame.
    The COG/DEM byte reader stays a per-site adapter (same split as the Essence GeoJSON adapter).
  - **OSM context buildings (`engine/compile/osm-buildings.mjs` + `engine/geometry/merge-context.mjs`)**
    — the perf budget's second named risk (500 buildings × 2 meshes = 1,000 draw calls vs 400
    ceiling), solved: OSM GeoJSON footprints → projected CONTEXT_BUILDING elements with estimated
    heights (levels×3 m, height tag, or 7 m default), terrain draping, footprint-area filter, and
    nearest-to-origin budget cap. Evidence class: REPORTED_UNVERIFIED for every building (OSM is
    crowd-sourced). The **renderer-side merge** (`merge-context.mjs`) collapses N individual
    context meshes into ~6–8 batched geometries grouped by material colour, so the GPU draws
    hundreds of buildings in a handful of calls. Picking preserved: each triangle in the merged
    geometry is mapped back to its source element, so clicking a context building still opens
    its inspect panel. Gate `engine:osm:test`, 54 checks across 10 sections. Engine wired: the
    merge runs automatically after scene build; picking resolves merged hits.
    Seven suites, 341 checks, all green.
  - **Design-selector mount contract REVIEWED (2026-08-27)** — `docs/DESIGN-SELECTOR-MOUNT-CONTRACT-REVIEW.md`:
    cross-checked Spatial's draft against BRAGE's v0.2 geometry spec. Verdict APPROVE with 6
    required changes (type vocabulary mismatch, anchor-relative coordinates, unknown primitives,
    invalid CONCEPT_OPTIONAL evidence class, field name mismatches, anchor value placeholder).
    Answers all 4 open items. Spatial unblocked to implement `mountDesign`/`clearDesign`.
  - **Authoritative boundary layer (`engine/compile/authoritative-boundary.mjs`)** — the LM data
    arrived (SVÄRTINGE 54:28 boundary extracted from `fastighetsindelning_kn0581.gpkg`, SWEREF 99 TM
    → WGS84, 1 938.1 m² projected vs 1 936.8 m² stated = 0.07% drift). The compiler produces a
    `PROPERTY_BOUNDARY` element with `AUTHORITATIVE` evidence class, thin slab overlay (0.15 m),
    area cross-check, and terrain draping. Renderer profiles updated with `PROPERTY_BOUNDARY`
    colour and opacity. Gate `engine:boundary:test`, 22 checks incl. real LM boundary, scene
    contract compliance, area tolerance failure path, and terrain draping.
    Nine suites, 277 checks, all green.
  - **Twin-consumption path (2026-08-27)** — `engine/geometry/gltf-loader.mjs` (GLTFLoader wrapper
    with dual intelligence/realistic materials), `engine/compile/twin-record.mjs` (twin record →
    scene element adapter, G0→CONCEPT through G3→AUTHORITATIVE), GLTF_ASSET primitive in scene
    contract + JSON schema + primitives builder (placeholder sphere until async load), SYSTEMS
    render profile (dark environment for technical layers). Conformance fixture now 15 elements,
    10/10 primitives. `data/twins/*.json` records can now render as contract-valid scene elements.
    Nine suites, 277 checks, all green.
  - **Shoppable room surface (2026-09-01, mandate tasks 1–3):**
    1. **Click-object → product panel with BUY link** — `scripts/compile-shoppable-room.mjs` places
       8 IKEA twins (sofa, armchair, coffee table, side table, TV bench, bookcase, rug, floor lamp)
       in a 6×5m living room. Commerce overlay on every element (product name, brand, dimensions,
       BUY url from twin external_identities). `engine/ui/product-panel.mjs` extracts panel payload;
       `engine/ui/panel.mjs` extended with product section (name, brand, price, BUY button).
       Verified in browser: click sphere → panel with "IKEA Tray table" + INDICATIVE + BUY→ikea.com.
    2. **Attach-point rendering** — `engine/compose/attach-resolver.mjs`: resolves base+slot
       composition (sofa→pillows, table→vase) into world-space positions. 17 twin records updated
       with attach blocks (role/slots from Avatar Factory schema). Shoppable room now 15 elements:
       8 base + 4 attached decor (2 pillows, 1 throw, 1 vase) + 3 shell.
    3. **Hero-still hook** — `engine/export/blender-scene.mjs`: any composed scene → Blender Python
       script for Cycles rendering. Maps GLTF_ASSET→import_scene.gltf, Y-up swap, stage camera→
       Blender camera with look-at, sky/sun, INTELLIGENCE/REALISTIC profiles.
       `npm run engine:blender:export -- scene.json` → .py runnable with `blender --background`.
    Gate: 12 suites, 461 checks, all green.
  - **Task 4 (2026-09-03, mandate item 4):**
    1. **Site Intelligence template absorption** — `engine/ui/site-intelligence-template.mjs`:
       extracted the reusable UI chrome from the Djurö prototype (mode dock, step nav, evidence
       legend, detail panel, tools bar, gate notice, top bar, responsive breakpoints) into
       parameterized builders. `composeSiteIntelligence()` emits a full skeleton any site can
       use. Wiring JS helpers for mode switching, step navigation, and panel open/close.
    2. **Gate '9' derivation** — `scripts/gate-integration-sprint.sh`: rg→grep (rg missing on
       this machine), and the hard-coded "expected 9 stale offer blockers" now derives the
       expected count from the manifest's `line_items.length + substitutions.length`.
    Gate: 13 suites, 622 checks, all green.
  - **REDIRECT executed (2026-09-08) — Newport + vidaXL inventory, IKEA retired as the shoppable surface:**
    - **Catalog-driven rooms.** `engine/compile/catalog-room.mjs` selects real rows per role and
      `engine/compile/catalog-row.mjs` turns them into elements. BUY = the row's `affiliate_link`
      **verbatim** — verified byte-identical to the catalog for all 11 Newport picks and in the
      live DOM (`a=1884564186&as=2106320328&tk=1&cupa_sku=100112`).
    - **Selection is derived, not typed.** For each role the compiler filters the catalog
      (leaf category · in stock · proxy where required · envelope caps) and picks the best
      *dimensional fit*, ties broken by catalog id — so the same catalog always yields the same
      room. Emergent result: fit-scoring converged on one coherent sand-toned "San Francisco"
      series across sofa/armchair/footstool without any styling rule.
    - **Dimensions come from geometry.** `engine/compile/glb-bounds.mjs` parses the GLB JSON chunk
      and unions the node hierarchy → real AABB (sofa 2000×900×850 mm). No dimension is typed.
      For vidaXL, which ships no proxies, size is parsed from the title's stated cm (12.7% of rows
      carry it) and only three-axis rows are eligible.
    - **GLB hydration wired (this was broken).** `GLTF_ASSET` elements had always rendered as
      placeholder spheres — `gltf-loader.mjs` existed but nothing consumed `isGltfPlaceholder`.
      The engine now hydrates each placeholder in place, keeps a failed load visible as its
      evidence-coloured placeholder, and exposes `viewer.avatarsReady`. Bundler gained
      `--asset-base`. **Verified in browser: 11/11 GLBs fetched 200 and hydrated.**
    - **Newport living room** — 14 elements, 11 shoppable, 11 channel-tracked, 11 INDICATIVE (G2)
      + 3 CONCEPT shell. **vidaXL terrace** — 9 elements, 7 shoppable, 7 channel-tracked, all
      CONCEPT (boxes at title-stated size; the claim policy says "not a fit claim").
    - Gate `engine:catalog:test`, 124 checks. Suites 14.
  - **⚠️ TWO EXECUTORS IN ONE CHECKOUT (2026-09-08).** While this session worked, another session
    was executing the *same* redirect in `../repo-platform` via a different design (config-driven
    `config/shoppable-rooms.json` + approved-channel guard, Newport GLBs copied into the repo),
    leaving `scripts/compile-shoppable-room.mjs`, `scripts/test-shoppable-room.mjs` and
    `scripts/test-blender-export.mjs` modified and uncommitted. **This session committed only its
    own files and left that work untouched.** The two approaches overlap and need reconciling —
    Brain's call, not mine. NOT checked: whether the other session's tests pass on their own.
  - **NOT done:** Milestone 2's formal exit (Essence consuming the engine *on a branch that has
    both*) is still blocked on D1. Commits are on `agent/platform-engine` in `../repo-platform`.
