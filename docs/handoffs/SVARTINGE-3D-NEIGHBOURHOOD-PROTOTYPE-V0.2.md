# Svärtinge 54:28 · 3D Neighbourhood Twin prototype v0.2

Checkpoint date: 2026-08-18

Branch: `agent/plot-to-project-spatial-studio`

## Outcome

This checkpoint converts the evidence-only alpha into a usable concept-level 3D prototype without upgrading unresolved legal claims.

The viewable progression is:

```text
NEIGHBOURHOOD VIEW
→ STREET VIEW
→ PLOT ORBIT
→ CONCEPT HOUSE ON PLOT
→ BUILDING ORBIT
→ ENTER BUILDING
→ ROOM
```

The viewer supports orbit/zoom, camera-step transitions, cutaway entry, object selection, evidence inspection, terrain/POI/label toggles and an interactive derived solar-time study.

## Run it

From the repository root:

```sh
npm run site:sweden:svartinge:prototype:gate
npm run site:sweden:svartinge:prototype:serve
```

Then open:

`http://127.0.0.1:4173/prototype/svartinge-neighbourhood/`

The viewer imports Three.js from jsDelivr and therefore needs internet access for the rendering library. The scene data itself is committed and served locally.

## Scene content

The deterministic export contains 37 spatial elements:

- working property/address anchor for `SVÄRTINGE 54:28`;
- indicative plot trace scaled to 1,938.198844 m²;
- derived local-relative terrain surface;
- two derived road alignments;
- twelve derived surrounding-building masses;
- six diagrammatic neighbourhood POIs with no invented distances;
- reported-unverified Glan view cone;
- derived solar path;
- concept house slab, walls, roof, openings and two room volumes; and
- concept furniture proxies for room-scale navigation.

## Evidence classes

Every spatial element has exactly one class:

| Class | Used for |
| --- | --- |
| `AUTHORITATIVE` | Dated municipal address-to-property observation, within its stated scope. |
| `INDICATIVE` | NOKA municipal-map surface, the visual plot trace and diagrammatic POI marker positions; never legal/surveyed coordinates. |
| `DERIVED` | Terrain estimate, map-traced roads/context massing and analytical solar direction. |
| `REPORTED_UNVERIFIED` | Listing area corroboration and seller-reported Glan view. |
| `CONCEPT` | House placement, building shell, openings, room volumes and furniture proxies. |

The plot polygon is a derived visual trace scaled uniformly to the municipal-map area. It is deliberately suitable for navigation and concept placement, but forbidden for cadastral, setback, registered-area, entitlement or set-out use.

The terrain is a deterministic local-relative surface. It has no RH2000 elevations and cannot support contour, slope, drainage, foundation or finished-floor claims.

Context building heights are visual massing estimates only. No surveyed height, storey, address, use, ownership or lawful-status claim is made.

## Legal/evidence gate behavior

Open gates block only claims that require authoritative evidence:

- legal boundary and registered area;
- entitlement and buildable envelope;
- legal access and driveway approval;
- utility route/capacity/paid status;
- surveyed terrain and finished-floor level; and
- construction/geotechnical/environmental clearance.

They do not block concept visualization, house placement, sun/view studies, navigation or POI analysis when every object retains its evidence class and limitations.

`design-scenario-v0.1.json` therefore uses `CONCEPT_VISUALISATION_ACTIVE_LEGAL_GATES_OPEN`. Its authoritative `site_boundary`, `buildable_envelope`, `building_geometry`, `access_point` and `finished_floor_level` fields remain null. Concept geometry lives only in the v0.2 scene export.

## Files

- viewer: `prototype/svartinge-neighbourhood/index.html`
- scene export: `data/sites/sweden/saterdalsvagen-14/neighbourhood-scene-v0.2.json`
- schema: `config/spatial/svartinge-neighbourhood-scene-v0.2.schema.json`
- builder: `scripts/build-svartinge-neighbourhood-prototype-v0.2.mjs`
- validator: `scripts/validate-svartinge-neighbourhood-prototype-v0.2.mjs`
- mutations: `scripts/test-svartinge-neighbourhood-prototype-v0.2.mjs`
- local server: `scripts/serve-svartinge-neighbourhood-prototype.mjs`

## Verification

`npm run site:sweden:svartinge:prototype:gate` currently proves:

- deterministic scene rebuild;
- 37 populated spatial elements;
- all seven ordered navigation stages;
- all five evidence classes used and enforced;
- plot-trace area within 0.05 m² of the NOKA surface;
- derived terrain/roads/context massing cannot be promoted;
- concept building/room geometry cannot be presented as measured or authoritative;
- POIs cannot gain invented coordinates/distances;
- legal claim blockers remain present;
- source hashes remain bound; and
- no owner, price, transaction, valuation or comparable payload can enter the scene.

Current results:

- validator: PASS · 244 assertions;
- mutations: PASS · 23 attacks;
- viewer module syntax: PASS;
- local viewer route: HTTP 200;
- local scene route: HTTP 200.

Automated browser visual inspection was not available because the application browser security policy blocks localhost and local-file URLs. The runtime and interaction code were therefore verified through HTTP delivery, module parsing and deterministic interaction/data assertions. A human visual QA pass remains recommended before any polished presentation checkpoint.

## Next spatial improvements

1. Replace the hand-derived plot trace with an exported NOKA/Lantmäteriet vector while retaining `INDICATIVE` until legal/survey evidence arrives.
2. Replace derived terrain with the identified Lantmäteriet 1 m raster and RH2000 lineage.
3. Replace context massing with source-bound building footprints and measured/official heights where available.
4. Add real POI coordinates and route metrics only from a permissioned, source-bound acquisition.
5. Add multiple explicitly named concept-house options after the user selects a programme/profile.

No merge or deployment is part of this checkpoint.
