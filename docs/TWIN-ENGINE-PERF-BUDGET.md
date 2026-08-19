# twin-engine performance budget v0.1
*Platform & 3D Engine session · 2026-08-19 · measured, not estimated*

Milestone 4 of `docs/handoffs/PLATFORM-ENGINE.md`. Budgets per surface class, derived from real
measurements of the engine rendering a real scene — not from round numbers that felt safe.

## 1. What was measured, on what

| | |
|---|---|
| Engine | twin-engine v0.1, commit at time of writing |
| Scenes | `twin-engine-conformance/scene-v0.1` (14 elements) and the production `svartinge-neighbourhood-scene/v0.2` (37 elements, 625-vertex terrain, 7 stages) |
| Delivery | self-contained bundle (`npm run engine:bundle`), served from an isolated directory |
| Machine | Apple M4, Chrome, `devicePixelRatio` 2 (ANGLE Metal renderer) |
| Viewports | desktop 1280×720 (2560×1440 drawing buffer) · phone 375×812 (750×1624 buffer) |
| Method | `renderer.render()` called in a tight loop with `gl.finish()` around it, 40–60 iterations, so the number is real render cost rather than whatever vsync allowed |

**Not measured** — see §5 before trusting any of this on a phone.

## 2. Measured: the Svärtinge scene, per stage (desktop 1280×720, dpr 2)

| Stage | triangles | draw calls | render ms |
|---|---:|---:|---:|
| Neighbourhood view | 7,320 | 98 | 0.71 |
| Street room | 7,906 | 77 | 0.30 |
| Plot outlook | 4,010 | 50 | 0.19 |
| Concept house on plot | 4,270 | 72 | 0.39 |
| Building orbit | 374 | 26 | 0.21 |
| Enter building | 312 | 26 | 0.13 |
| Room | 456 | 31 | 0.13 |

Scene-wide: 59 geometries · 8 textures · 7 shader programs.

Phone viewport (375×812, dpr 2), same scene: 0.35 ms single pass, 0.60 ms for the two-pass
COMPARE profile — smaller because the drawing buffer is 8× smaller, and this engine is
fill-bound, not geometry-bound.

**The headline: a whole neighbourhood twin costs well under 1 ms of render per frame.** A 60 fps
frame has 16.7 ms. The engine is nowhere near the limit, which means the budgets below are about
protecting *future* scenes and weaker devices, not about rescuing this one.

## 3. Measured: CPU cost before the first frame

| Scene | JSON | `parseScene` | `compileStages` | scene-graph build |
|---|---:|---:|---:|---:|
| conformance (14 elements) | 14 KB | 0.038 ms | 0.008 ms | 1.32 ms |
| Svärtinge (37 elements) | 81 KB | 0.033 ms | 0.040 ms | 2.83 ms |

Contract validation is free. Graph construction dominates boot and scales with element count.

Bundle boot, 824 KB single file over localhost: DOM interactive 41 ms · DOMContentLoaded 69 ms ·
load 71 ms. Over a real network the transfer dominates — see the bundle budget below.

## 4. Budgets by surface class

Four classes, because a sales microsite on a phone and an internal control room have nothing in
common except the engine. Each budget is a **ceiling that fails a gate**, not a target to hit.

| | **Twin** (site/neighbourhood) | **Microsite** (developer, buyer-facing) | **Showroom** (walkable interior) | **Portal** (many twins, one page) |
|---|---|---|---|---|
| Primary device | desktop | **phone first** | desktop | phone |
| Bundle (self-contained HTML) | ≤ 1.5 MB | **≤ 1.2 MB** | ≤ 3 MB (glTF avatars) | ≤ 800 KB shell |
| Triangles, worst stage | ≤ 150k | ≤ 60k | ≤ 400k | ≤ 40k per twin |
| Draw calls, worst stage | ≤ 400 | ≤ 200 | ≤ 600 | ≤ 150 |
| Textures | ≤ 24 | ≤ 12 | ≤ 60 | ≤ 8 |
| Render, desktop dpr 2 | ≤ 6 ms | ≤ 4 ms | ≤ 8 ms | ≤ 4 ms |
| Time to first frame, mid-range phone, 4G | ≤ 5 s | **≤ 3 s** | ≤ 8 s | ≤ 3 s |
| Scene-graph build | ≤ 40 ms | ≤ 25 ms | ≤ 80 ms | ≤ 20 ms |

Svärtinge today: 7.9k triangles, 98 calls, 8 textures, 0.71 ms, 2.8 ms build, 803 KB. It sits at
roughly **5–25 % of the Twin budget on every axis**. There is a large amount of headroom for
real terrain, OSM context extrusion and viewshed overlays before anything here binds.

### Where the budget will actually get spent
1. **Terrain resolution.** The Svärtinge terrain is 24×24 (1,152 triangles). A 1 m DEM over the
   same 360 m is 360×360 → ~259k triangles, alone over the Twin budget. Terrain needs LOD or
   decimation before the COG/DEM loader lands — this is the single biggest future cost.
2. **OSM/vector context extrusion.** Hundreds of buildings, one draw call each unless merged.
   The `CONTEXT_BUILDING` path already makes 2 meshes per building; at 500 buildings that is
   1,000 draw calls against a 400 ceiling. Merge by material before that ships.
3. **glTF avatars in showrooms.** A single unoptimised manufacturer model can exceed the whole
   Twin triangle budget by itself. This is why Showroom is its own class.
4. **Shadow map.** One 2048² directional map at ±180 m covers the neighbourhood. A larger site
   needs cascades, not a bigger map.

## 5. NOT measured — read this before quoting any number above

- **No phone was used.** The "phone" figures are a 375×812 viewport on an M4 desktop GPU. A
  mid-range Android will be several times slower and is the device the microsite class actually
  targets. Every phone number in §4 is a **budget set by judgement, not a measurement**.
- **No sustained frame-rate measurement.** `requestAnimationFrame` only advanced while the
  automated browser tab was foregrounded, so median/p95 frame time could not be sampled. Render
  cost was measured directly instead, which excludes browser compositing and OrbitControls
  damping. To measure properly: open the demo in a real browser and sample
  `performance.now()` deltas inside the loop for ≥ 5 s.
- **No network profile.** Boot was measured over localhost. Time-to-first-frame on 4G is an
  arithmetic estimate from bundle size, not an observation.
- **No memory ceiling and no thermal/battery behaviour.** A twin left open on a phone for ten
  minutes has not been tested.
- **No measurement of the four legacy viewers**, so "the engine is faster/slower than what we
  had" is not a claim anyone can make yet.

## 6. How to re-derive

```sh
npm ci
npm run engine:demo                       # http://127.0.0.1:8181/prototype/twin-engine-demo/
npm run engine:bundle -- <scene.json> --out <file.html>
```

Then in the page console:

```js
const v = globalThis.twinViewer, r = v.viewer.renderer, gl = r.getContext();
const one = () => r.render(v.viewer.scene, v.viewer.camera);
one(); gl.finish();
const t0 = performance.now(); for (let i = 0; i < 60; i++) one(); gl.finish();
console.log((performance.now() - t0) / 60, "ms", r.info.render);
```

CPU-side costs (parse, stage compile, graph build) are measurable in Node without a browser,
because the pure modules and the scene-graph builder both run headless — see the headless
section of `scripts/validate-twin-engine.mjs`.
