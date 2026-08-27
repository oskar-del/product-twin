# twin-engine v0.1

One engine for every twin surface: site twins, developer microsites, showrooms, embeds.
A surface supplies a **twin-scene document** and a mount element; the engine supplies the rest.

```js
import {createTwinViewer} from "/engine/twin-engine.mjs";

const viewer = await createTwinViewer({
  mount: document.getElementById("stage"),
  sceneUrl: "/data/scenes/twin-engine-conformance/scene-v0.1.json"
});
```

Run the reference surface:

```sh
npm ci
npm run engine:demo      # http://127.0.0.1:8181/prototype/twin-engine-demo/
```

## The contract

A scene is a `twin-scene/v0.x` document validated by `config/spatial/twin-scene-v0.1.schema.json`
and by `engine/core/scene-contract.mjs` — the schema for shape, the contract for the rules a
schema cannot express (per-primitive geometry, id uniqueness, stage↔element integrity,
degenerate cameras). A scene that violates either is refused with the full list of violations
rather than rendered wrong.

The schema is a structural **superset**: a per-site profile pins its own constants on top of it.
The production Svärtinge scene (`svartinge-neighbourhood-scene/v0.2`) validates against it
unmodified, and `npm run engine:validate` cross-checks against that scene whenever it is present
in the checkout.

| Concept | Where |
|---|---|
| Evidence classes (the honesty palette) | `core/evidence.mjs` |
| Scene parsing and refusal | `core/scene-contract.mjs` |
| Stages: visibility contract + camera keyframes | `core/stages.mjs` |
| Render profiles + materials | `core/profiles.mjs` |
| Renderer, camera, controls, split render | `core/viewer.mjs` |
| Click picking (split-screen aware) | `core/picking.mjs` |
| Nine geometry primitives | `geometry/primitives.mjs` |
| Sprite labels, procedural textures | `geometry/labels.mjs`, `geometry/textures.mjs` |
| Solar position (NOAA), light rig | `studies/sun.mjs` |
| Local ENU ↔ WGS84, map-view derivation | `geo/local-enu.mjs` |
| Panel, legend, dock, tools, stylesheet | `ui/*` |

`core/evidence`, `core/scene-contract`, `core/stages`, `studies/sun` and `geo/local-enu` are
**pure** — no DOM, no WebGL — and are importable by the Node gate. Everything else needs a browser.

## Geometry primitives

`GRID_SURFACE` · `EXTRUDED_POLYGON` · `POLYLINE_RIBBON` · `BOX` · `ROOM_VOLUME` · `MARKER` ·
`DIAGRAMMATIC_MARKER` · `DIRECTION_CONE` · `SOLAR_ARC`

## Options

| Option | Meaning |
|---|---|
| `mount` | element the canvas and chrome are mounted into (required) |
| `sceneUrl` / `sceneDocument` | where the scene comes from |
| `realisticPalette` | element type → colour overrides for the REALISTIC profile |
| `decor` | per-site realism plugin `({THREE, scene, group, viewer}) => void`; site-specific character (street furniture, trees, listing detail) belongs here, never in the engine |
| `chrome` | `false` to suppress the engine's own dock/legend/panel/tools and drive it yourself |
| `onElementOpen` | called with each opened element |

## What the engine returns

`scene` · `stages` · `viewer` (renderer/camera/controls) · `elements` (id → object3D) ·
`profile` · `stage` · `hour` · `setProfile` · `setHour` · `goToStage` · `goToStageId` ·
`openElementById` · `mapView(zoom)` · `evidenceProfile()` · `dispose()`

## Rules the engine keeps

- **Presentation changes; evidence does not.** A profile switch swaps materials and light. It
  never changes geometry, position, or what a claim says.
- **Nothing renders unsourced.** An element with no `source_refs` is a contract violation.
- **Limitations are a titled section of the panel**, not fine print.
- **A live map layer carries `evidence_effect: "NONE"`** and can never promote a claim.
- **The engine does not invent geometry.** Site-specific character goes in a `decor` plugin.

## Compiling a scene

The engine renders scenes; `engine/compile/` makes them.

| Transform | Module |
|---|---|
| GeoJSON polygons → local ENU rings (+ area cross-check vs the authority's stated area) | `compile/geo-polygons.mjs` |
| Scattered elevation samples → interpolated `GRID_SURFACE` (+ its own limitations) | `compile/terrain-interpolation.mjs` |
| Dense DEM height field → budgeted `GRID_SURFACE` decimated to a triangle ceiling (+ reported RMS/max error) | `compile/height-field.mjs` |
| OSM building footprints → `CONTEXT_BUILDING` elements (projected, height-estimated, budget-capped, terrain-draped) | `compile/osm-buildings.mjs` |
| Authoritative property boundary → `PROPERTY_BOUNDARY` element with area cross-check | `compile/authoritative-boundary.mjs` |
| Scene envelope, camera framing from real extents, contract enforcement | `compile/scene-assembler.mjs` |

A **site adapter** does the joins only that site's owner can do and calls the assembler.
`scripts/compile-essence-site-scene.mjs` is the reference one — copy it to start a new site.
The assembler will not default an evidence class, a source, or a limitation: if a site cannot
say where an element came from, the scene does not compile.

A **dense DEM** (from a COG, an ASCII grid, or a LiDAR raster — the site adapter reads the bytes)
goes through `heightFieldToGrid({heights, size, maxTriangles})`, which decimates it to stay under
a triangle budget and REPORTS the height error that cost, in metres RMS and worst-case. This is
the answer to the perf budget's named risk: a 1 m DEM over a 360 m site is 259,200 triangles,
over the Twin ceiling, and decimates to 149,058 — losing 0.7 mm RMS on a smooth surface, and
saying so in the terrain's own limitations.

**OSM context buildings** are compiled by `compileOsmBuildings({features, originWgs84, sourceRefs})`
from `engine/compile/osm-buildings.mjs`. Heights come from OSM tags (`building:levels` × 3 m, or
`height`) or default to 7 m; every building is `REPORTED_UNVERIFIED`. At render time,
`engine/geometry/merge-context.mjs` merges individual context meshes into a few batched geometries
grouped by material colour — 500 buildings go from ~1,000 draw calls to ~8. Clicking a merged
building still opens its inspect panel (triangle-index mapping back to the source element).

## Measured claims

The differentiator: spatial statements computed against the geometry on screen, never estimated
and never held in a second model that can drift from the picture.

```js
viewer.measure.sightline({from: [x, y, z], to: [x, y, z]});
// → {visible, distance_m, bearing_deg, elevation_deg, blocked_by: {element_id, label, at_m},
//    evidence_class: "DERIVED", method, limitations}

viewer.measure.sunHours({point: [x, y, z], date: "2026-03-21"});
// → {sunlit_hours, daylight_hours, first_sun_local, last_sun_local, intervals, …}

viewer.measure.viewshed({from: [x, y, z]});
// → {open_sky_fraction, mean_horizon_deg, clear_sectors, sectors, principal_blockers,
//    horizon: [{azimuth_deg, horizon_elevation_deg, blocked_by}], unresolved_azimuths, …}

viewer.measure.drawSightline({from, to});   // same result, drawn into the scene
viewer.measure.drawViewshed({from});        // horizon ring around the observer
viewer.measure.sightlineMatrix(points);     // every pairwise relation
```

Every result carries `evidence_class: "DERIVED"`, the method that produced it, and its own
limitations — a sightline is a claim about the MODEL, so vegetation, fences and anything
unmodelled cannot block it, and the result says so.

three.js raycasting is pure maths, so these run headless: `engine/studies/geometry-queries.mjs`
builds the ray index in Node, and `npm run engine:studies:test` checks the answers against known
physics (12 h of daylight at the equator, a point in a building's own shadow gets none, a 20-min
sampling step must agree with a 2-min one).

## Publishing

```sh
npm run engine:bundle -- data/scenes/twin-engine-conformance/scene-v0.1.json
# → dist/twins/<scene_id>.html — engine, three.js, scene and styles inline, zero network requests
```

One file that works as an Artifact link, an email attachment, an iframe in a developer's own
site, or a file opened offline. The bundler parses the scene against the contract first and
refuses to publish anything the engine would refuse to render; every bundle carries its scene id,
scene version, engine version and source bindings.

## Gates

```sh
npm run engine:gate        # build fixture → validate → mutations
npm run engine:audit       # capability matrix across every browser surface
```

`engine:validate` also runs a headless scene-graph build (three.js constructs a graph fine
without WebGL) and asserts the structural invariants that visual bugs hide behind — every
element maps to exactly one object, and every pickable object is a descendant of its element's
object.

## Not in v0.1

SYSTEMS profile · walk camera + glTF avatars · Mapbox live-context layer · availability-status
colouring · terrain COG/DEM loader · timeline scrubber.
See `docs/TWIN-ENGINE-AUDIT-2026-08-19.md` §4.
