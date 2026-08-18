# Twin-engine audit & v0.1 extraction plan
*Platform & 3D Engine session · branch `agent/platform-engine` · 2026-08-19 (UTC 2026-08-18T23:06Z)*

Milestone 1 of `docs/handoffs/PLATFORM-ENGINE.md`. Audits every browser surface in the repository and
states exactly what becomes **twin-engine v0.1**, what stays surface-specific, and which gates prove it.

## 0. How to re-derive this document

```sh
npm ci
mkdir -p .runtime/reference-viewers/svartinge-neighbourhood
git show origin/agent/spatial-studio-claude:prototype/svartinge-neighbourhood/index.html \
  > .runtime/reference-viewers/svartinge-neighbourhood/index.html
npm run engine:audit -- .runtime/reference-viewers/svartinge-neighbourhood/index.html
```

The Svärtinge viewer is staged from another branch because **it does not exist on `main`** (see §5, decision D1).

## 1. Capability matrix (measured, not remembered)

Output of `npm run engine:audit` at 2026-08-18T23:06:11Z:

```
capability                     developer-orbit  house-inspector  project-control  showroom         svartinge-neigh
--------------------------------------------------------------------------------------------------------------------
three.js runtime               yes              yes              ·                yes              yes
orbit camera                   yes              yes              ·                ·                yes
walk camera                    ·                ·                ·                yes              ·
glTF avatar loading            ·                ·                ·                yes              ·
click picking                  yes              yes              ·                yes              yes
inspect panel                  yes              yes              ·                yes              yes
scene from external data       ·                ·                ·                yes              yes
lens / mode switching          ·                yes              ·                ·                yes
staged camera tween            ·                ·                ·                ·                yes
evidence classes               ·                ·                ·                ·                yes
stage visibility contract      ·                ·                ·                ·                yes
terrain mesh                   ·                ·                ·                ·                yes
interactive sun / time-of-day  ·                ·                ·                ·                yes
sprite labels                  ·                ·                ·                ·                yes
split-screen compare           ·                ·                ·                ·                yes
live map context               ·                ·                ·                ·                yes
procedural textures            ·                ·                ·                ·                yes
shadows                        yes              yes              ·                yes              yes
commerce / offer state         ·                ·                ·                yes              ·
resize handling                yes              yes              ·                yes              yes
--------------------------------------------------------------------------------------------------------------------
script bytes                   5184             9621             382              9875             37081
inline geometry ctors          3                2                0                1                37
```

## 2. What each surface actually is

| Surface | Path | What it is | Reusable core? |
|---|---|---|---|
| **Svärtinge neighbourhood** | `prototype/svartinge-neighbourhood/index.html` (branch `agent/spatial-studio-claude`) | The only real engine. 37 KB of module script driving a **data-driven scene** (`neighbourhood-scene-v0.2.json`, 37 elements, 8 geometry primitives, 7 navigation stages, 5 evidence classes) with INTELLIGENCE/REALISTIC/COMPARE profiles, split-screen scissor render, stage camera tweens, stage visibility contract, sun study, sprite labels, procedural terrain/road textures, Mapbox live-context adapter, municipal aerial history. | **Yes — this is twin-engine v0.1.** |
| **Showroom** | `prototype/showroom/index.html` | First-person walkthrough of a shoppable scene. Loads `data/showrooms/v0-shoppable-dining-scene.json`, `GLTFLoader` avatars, product swap, offer/budget panel. Room shell is hardcoded boxes. | Partly: the **camera rig is a second mode** (walk), and the **product/offer panel contract** generalizes. Room shell does not. |
| **House inspector** | `prototype/house-inspector/index.html` | 7-lens dissection of a hand-authored house (experience / architecture / build / products / procurement / systems / regulation) + explode. **No external data at all** — every element is a `box(...)` literal with inline metadata. | The **lens concept** generalizes and is the origin of the SYSTEMS profile. The geometry does not. |
| **Developer orbit** | `prototype/developer-orbit/index.html` | Delivery-status massing of a 5-floor block, status colour ramp, week timeline. Fully hardcoded. | The **status-colouring-by-attribute** and **timeline scrubber** patterns generalize. Geometry does not. |
| **Project control** | `prototype/project-control.html` | Not a 3D viewer — a generated 2D dashboard (382 script bytes) built by `scripts/build-project-control.mjs` from `data/dashboard/project-control.json`. | Not engine. It is the **precedent for the publish pipeline**: data → generated self-contained HTML. |

**Finding:** there are not five engines. There is **one engine (Svärtinge)** and four single-purpose demos,
three of which have no scene contract at all. The duplication cost is therefore lower than the handoff assumed,
but the *generalization* cost is real: the one engine is welded to one site.

**Second finding:** every 3D surface independently re-implements the same five things — renderer bootstrap,
click picking, inspect panel, shadows, resize. That is the smallest honest v0.1 core. Everything above it
exists exactly once, in Svärtinge.

## 3. What is welded to Svärtinge (must be generalized, not copied)

| Weld | Where | Fix in v0.1 |
|---|---|---|
| Scene schema hardcodes the site | `config/spatial/svartinge-neighbourhood-scene-v0.2.schema.json` — `scene_id`, `subject.working_property_identity`, `municipality`, `prototype.viewer_path`, `navigation` length and step ids are all `const` | New **site-agnostic** `config/spatial/twin-scene-v0.1.schema.json`; the Svärtinge schema becomes a site profile that `allOf`-extends it |
| Six hardcoded data paths | `const DATA=…, PROVIDERS=…, STREET=…` at viewer top | Engine takes a **scene manifest**; the viewer passes URLs, the engine never names a site |
| Realism decor is site-specific code | `buildExactListingCharacter`, `addHouseDetails`, `addStreetDetail`, `addExactPlotWorkingCharacter`, `buildRealismDecor` (≈9 KB) | Stays **outside** the engine as a per-site `decor` plugin the engine mounts into `realismDecor` |
| Sweden-only geodesy | `geographic-alignment.mjs` guards 10–25°E / 54–70°N and implements SWEREF99 TM | Engine keeps the generic `localHorizontalToWgs84` / `deriveLiveContextView`; SWEREF99 stays a **Sweden projection module** (Spain/Essence needs ETRS89/UTM30N) |
| Stage `visible_groups` uses site element types | `applyStageVisibility` matches `userData.item.type` | Keep — element `type` is already a free string in the schema; only the *values* are site vocabulary |
| Hardcoded step indices | `stepTo()` opens a panel when `i===6`; `stageLabelsAllowed` excludes `['STREET_VIEW','PLOT_ORBIT']` by id | Move to the scene: `navigation[].on_enter_open_element`, `navigation[].labels` |
| Validator asserts on viewer **source text** | `scripts/validate-svartinge-neighbourhood-prototype-v0.2.mjs:260` — ~14 `html.includes("…")` checks against `index.html`, incl. `addStreetDetail`, `renderPass`, `proceduralTexture`, `realismDecor.visible=realistic` | **Blocking constraint** (see D2). Moving code out of `index.html` fails these greps even when behaviour is identical |

## 4. twin-engine v0.1 — scope and module map

Location: `engine/` at repo root (peer of `prototype/`, `scripts/`, `config/`).
Zero new runtime dependencies. Bare `three` specifier — resolves from `node_modules` in Node *and* via importmap
in the browser (verified: `node -e "import('three/addons/controls/OrbitControls.js')"` → OK, `three` REVISION 185).

```
engine/
  twin-engine.mjs            composition root: createTwinViewer({mount, scene, options})
  core/
    evidence.mjs        [P]  evidence class → colour/CSS/order; the honesty palette, one definition
    stages.mjs          [P]  stage list → visibility sets, camera keyframes, tween state machine
    scene-contract.mjs  [P]  parse + assert a twin-scene document; no three.js, no DOM
    profiles.mjs             INTELLIGENCE / REALISTIC / COMPARE / SYSTEMS material + lighting profiles
    viewer.mjs               renderer/scene/camera/controls/resize/loop + scissor split render
    picking.mjs              raycast → element (split-screen aware) → panel contract
  geometry/
    primitives.mjs           GRID_SURFACE · EXTRUDED_POLYGON · POLYLINE_RIBBON · BOX · ROOM_VOLUME ·
                             MARKER · DIAGRAMMATIC_MARKER · DIRECTION_CONE
    labels.mjs               canvas sprite labels
    textures.mjs             procedural grass / gravel / asphalt
  studies/
    sun.mjs             [P]  solar direction + intensity for a time of day
  geo/
    local-enu.mjs       [P]  local ENU ↔ WGS84, camera → map view derivation (site-agnostic half of
                             geographic-alignment.mjs)
  ui/
    panel.mjs                element → inspect panel (evidence badge, source refs, limitations)
    legend.mjs               evidence legend
    dock.mjs                 mode dock + stage steps
```

`[P]` = **pure**: no DOM, no WebGL, importable by a Node gate. That is what makes the engine testable at all.

### In v0.1
Scene contract · evidence layers · 8 geometry primitives · stage navigation with camera tweens and visibility
contract · INTELLIGENCE / REALISTIC / COMPARE profiles · sun study · sprite labels · click→panel contract ·
split-screen compare · orbit camera · local-ENU ↔ WGS84.

### Deferred out of v0.1 (named, not forgotten)
SYSTEMS profile (needs the House-inspector lens vocabulary promoted to scene data) · walk camera + glTF
avatars (Showroom's contribution — v0.2, needed by Room/Showroom, not by Essence) · Mapbox live-context layer
(stays a per-surface adapter until a second surface needs it) · availability-status colouring (needs the
developer microsite unit model) · viewshed overlay · terrain COG/DEM loader · OSM/vector extrusion ·
timeline scrubber.

### Gates (AGENTS.md §2 — every rule has a command that returns non-zero)
1. `npm run engine:validate` — the pure modules against a committed conformance fixture: every primitive,
   every evidence class, stage visibility sets, camera tween endpoints, sun elevation at fixed hours,
   ENU↔WGS84 round-trip tolerance.
2. `npm run engine:mutations` — deliberate-failure fixtures (bad evidence class, unknown primitive, stage
   referencing a missing group, non-finite camera) **must** be rejected; a mutation that passes fails the gate.
3. `npm run engine:audit` — the matrix above, so capability drift is visible.
4. Adoption gate, per consuming surface: that surface's own validators still pass, unchanged.

## 5. Decisions for the Brain session (above this session's scope)

- **D1 · `main` is behind the spatial branches.** `origin/main` has no `prototype/svartinge-neighbourhood/`,
  no `data/sites/sweden/`, no `data/sites/essence-moraira/`. The engine's reference scene *and* its first
  consumer both live on `agent/spatial-studio-claude` / `agent/essence-moraira-pilot`, which forked before
  main's Room-Lab work landed (merge-base `cda6b7d`; main and spatial each hold files the other never had —
  a merge is additive, not destructive, verified per-file). **Ask: who merges the spatial line into `main`,
  and when?** Until that happens the engine cannot be gated against the real Svärtinge scene in CI, and
  Milestone 2 (Essence adoption) has to happen on a branch that contains both. Nothing in v0.1 is blocked;
  adoption is.
- **D2 · The Svärtinge validator asserts on viewer source strings.** ~14 `html.includes(...)` checks pin
  function *names* inside `index.html`. Any extraction that moves those functions into modules fails the gate
  with behaviour unchanged. Options: (a) engine adoption for Svärtinge is a joint change with the Spatial
  session that also updates the validator to follow ES imports; (b) Svärtinge keeps its viewer and only new
  surfaces use the engine; (c) validator reads viewer + transitively imported modules as one text. **This
  session recommends (c) + (a) — but it is Spatial's write surface, so Brain should assign it.**
- **D3 · three.js delivery.** Viewers currently importmap to `cdn.jsdelivr.net/npm/three@0.185.1` while
  `package.json` pins `three@0.185.0` — a live surface running a version nobody tests. Recommendation: engine
  surfaces importmap to the **repo-local** `node_modules/three` (already served by the dev server), CDN only
  as a documented fallback, and the bundle command inlines the local copy. Needs no approval unless Brain
  wants CDN kept for embed/iframe surfaces.
- **D4 · Where the engine lives.** `engine/` at repo root, not under `prototype/`. The engine is product, the
  prototypes are demos.

## 6. Sequence after this document

1. `engine/` pure core + conformance fixture + `engine:validate` / `engine:mutations` gates.
2. Browser layer + `prototype/twin-engine-demo/` rendering the fixture scene — first visible proof.
3. Verify against the **real** Svärtinge scene staged in `.runtime/` (proof without a cross-branch commit).
4. Milestone 2: Essence microsite consumes the engine (needs D1 resolved).
5. Milestone 3: `npm run engine:bundle -- <scene>` → self-contained HTML.
6. Milestone 4: perf budget doc.

## 7. NOT checked

- The engine has **not** rendered anything yet — this document is an audit and a plan, no engine code exists at
  the time of writing.
- The four `prototype/` surfaces were **read**, not **run**. No browser session, no screenshot, no runtime
  verification of any existing viewer.
- The Svärtinge viewer was read from `origin/agent/spatial-studio-claude` at the commit fetched 2026-08-18;
  it was never executed here, and its own gate (`site:sweden:svartinge:prototype:gate`) was not run on this
  branch (its data files are absent from `main`).
- Mobile/device performance was not measured for any surface. Milestone 4 is untouched.
- The Essence branch was inspected for data and handoff only; no Essence viewer exists to audit.
