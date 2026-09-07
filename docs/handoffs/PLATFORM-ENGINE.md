# Platform & 3D Engine — Claude Session Handoff

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
