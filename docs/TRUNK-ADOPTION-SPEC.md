# Site Intelligence (trunk) — adoption spec from the Spatial Studio data/viewer work

The **Site Intelligence** microsite is the trunk (published artifact `d700a89d…`, "extend, never fork"). Its source lives OpenAI/Codex-side, not in this repo, so this is a **hand-over spec**: what the trunk should adopt from the Spatial Studio data layer + prototype viewer to (1) fix its blank photos and (2) stop being stale on terrain. All of it is already committed in this repo for the trunk build to consume.

## 1. Fix the missing photos (blank image slots)

**Symptom:** in the shared artifact only the hero (embedded data-URI JPEG) renders; the four aerial-history tiles, the main aerial map, and the "photorealistic reconstruction" are blank.

**Cause:** those 7 `<img>` are loaded live at view-time — `src="/runtime/norrkoping-aerial/{2008,2010,2017,2025}"` (a proxy to the Norrköping municipal aerial WMS) and JS-filled Mapbox slots. In the shared artifact the runtime network layer is off (no `network` capability provisioned; Mapbox needs a runtime token), so nothing loads. The artifact CSP also blocks direct fetches to `norrkoping.se` / `api.mapbox.com`, which is why the proxy pattern exists.

**Fix options (trunk owner):**
- **Preferred — live, evidence-safe:** declare the artifact's `network` runtime capability so `/runtime/norrkoping-aerial/*` can proxy the municipal WMS, and supply a **URL-restricted** Mapbox public token for the satellite slots. Keeps "no provider pixels committed"; imagery stays live + attributed. (See `artifact-capabilities` for the exact capability declaration.)
- **Fallback — static share:** embed the handful of key photos as data-URIs like the hero. Simpler for a static share, but commits provider pixels → resolve licence/attribution first (municipal orthophoto terms are still `unresolved` per `context-providers-v0.1.json`), so this is weaker on the evidence bar.

Either way, add visible attribution ("© Mapbox · © Maxar", "© Norrköpings kommun", "© Lantmäteriet").

## 2. Adopt the closed terrain gate (trunk is stale here)

The trunk's embedded provider registry still says terrain `KEY_REQUIRED` / `LOCAL_RELATIVE_UNCALIBRATED`. That is out of date. In this repo **`GATE_SE_TERRAIN` is CLOSED**:
- Gate-tracked DTM COG `m650_55.tif` acquired + multihash-verified (`1220789c…`); provenance QA passed.
- `data/sites/sweden/saterdalsvagen-14/terrain-source-metadata-v0.1.json` → `raster_access: ACQUIRED_VERIFIED`, gate `CLOSED`.
- `terrain-dem-derived-v0.1.json` carries the authoritative heightfield (54 m relief, pin 69.96 m RH2000, slope 13.1° SW, Glan fall 42.95 m/800 m), reproducible via `scripts/derive_svartinge_terrain.py`.

**Trunk action:** rebuild from current repo data; surface terrain as AUTHORITATIVE (RH2000-relative), and render the real heightfield instead of a flat/uncalibrated surface. The prototype's `drapeOnTerrain`/`groundY` shows the pattern (drape context + concept + cameras onto the real surface; rigid concept shell shares one offset).

## 3. Adopt the real neighbourhood + satellite ground (from the prototype)

Both are committed, DERIVED, attributed, and evidence-safe:
- **OSM context** — `osm-context-derived-v0.1.json` (`scripts/derive_svartinge_osm_context.py`): 60 real building footprints (PCA-oriented boxes) + 18 real roads (Säterdalsvägen, Gamla Landsvägen, Utsiktsvägen…), ODbL © OSM contributors. Replaces diagrammatic massing. Superseded by the Lantmäteriet `byggnad` vector when ordered.
- **Live satellite ground drape** — Mapbox Static Images API for the study bbox, applied as the terrain material in the realistic view; runtime token only, no pixels committed, "© Mapbox · © Maxar" shown. Prototype fn: `drapeSatelliteTerrain(token)`; wire to the trunk's existing Mapbox token flow.

## 4. The last data pillar — real BOUNDARY (needs an order, not code)

The plot is still an INDICATIVE trace. The authoritative parcel polygon + building footprints are the Lantmäteriet vectors, currently **403 (not ordered)** on the Geotorget account (kundnr 30056732) — the download credential (`lantmateriet.env`) authenticates fine; the products just aren't granted. **Action (Oskar):** order **`Fastighetsindelning nedladdning, vektor`** + **`Byggnad nedladdning, vektor`** in Geotorget (free, accepts terms). Then Spatial Studio downloads + integrates them exactly like terrain (verify feature identity → replace the trace with the registered polygon → re-run the point-only risk screens against real geometry), and the OSM buildings are superseded by authoritative footprints. This is the pillar that turns "indicative" into "real boundary".

## Status
Data layer (terrain closed, OSM, satellite): **done, committed, trunk-consumable.** Boundary: **blocked on the order above.** Photos + trunk look: **trunk-owner action per §1–3.** Spatial Studio will implement the design-selector `mountDesign` hook (see `DESIGN-SELECTOR-MOUNT-CONTRACT.md`) once Platform freezes the A/B/C spec.
