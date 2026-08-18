# Svärtinge synchronized Twin — live context adapter checkpoint v0.4

Date: 2026-08-18  
Branch: `agent/plot-to-project-spatial-studio`

## Product model

The viewer is one evidence-labelled spatial Twin rendered through three synchronized lenses:

1. `INTELLIGENCE` exposes provenance, evidence class, limitations and open gates.
2. `REALISTIC` applies natural materials, vegetation, atmosphere, roofs, roads, sun and shadows to the same geometry.
3. `COMPARE` renders the two presentations with one camera and one scene graph.

Realism is presentation. It does not establish a legal boundary, registered area, surveyed terrain, legal access, utility capacity, entitlement or a buildable envelope.

## Rendering stack

The intended stack is deliberately separable:

1. Product Twin geometry and evidence overlays.
2. Accepted official site context, including cadastral, terrain and municipal context products.
3. Live licensed visual context, such as Mapbox satellite/terrain or Google reference surfaces.
4. Concept design geometry and Room Twin navigation.

Each provider can be connected, removed or replaced without changing Product Twin identity or evidence state.

## Runtime adapter delivered

`prototype/svartinge-neighbourhood/live-context-adapter.mjs` defines the first Mapbox runtime adapter contract. It:

- accepts a restricted public token only as an in-memory runtime argument;
- uses no local storage, session storage, cookies or URL parameters;
- requests live satellite and terrain context without tile persistence;
- requires provider attribution;
- binds the live map to the recorded WGS84 origin `[16.0317063331, 58.6522414431]`;
- exposes deterministic camera synchronization inputs;
- accepts only navigation stages carrying `LOCAL_EAST_UP_NORTH_STAGE_REFERENCE` and `evidence_effect: NONE`;
- clears the runtime token when the map is disconnected and destroyed;
- explicitly prohibits evidence promotion;
- has no effect unless called with explicit runtime configuration.

The adapter is now mounted as an optional right-side reference window in the prototype viewer. The user must explicitly open it and provide a temporary Mapbox public token. Mapbox GL JS and its stylesheet are loaded only after that action. The token is cleared from the input immediately, remains in page memory only while the map is connected and is forgotten on disconnect. Provider attribution remains inside the live map.

The reference camera follows all seven Product Twin navigation stages. It is intentionally a synchronized side reference rather than a pixel overlay: the local model can be compared with aerial/terrain character without implying that provider pixels, the indicative parcel trace or the local-relative terrain are surveyed or co-registered evidence.

## Exact terrain-source metadata

The exact WGS84 locator deterministically transforms to SWEREF 99 TM easting/northing `[559868.9999, 6501790.311]`. The transform is checked against Lantmäteriet's published SWEREF 99 TM control example.

That locator lies in official Lantmäteriet DTM COG item `650_55`:

- horizontal CRS: `EPSG:3006`;
- vertical datum: `RH2000`;
- compound CRS: `EPSG:5845`;
- grid resolution: 1 m;
- tile extent: 10 × 10 km;
- exact-locator source measurement: airborne laser scan dated 2020-11-20;
- reported source uncertainty: 0.3 m horizontal and 0.1 m vertical.

The public STAC item, info, provenance and thumbnail artifacts have runtime receipts and SHA-256 hashes. The 246,140,605-byte terrain raster itself returns HTTP 401 without credentials and has not been acquired. Therefore the source identity/date are verified, but no RH2000 elevations, contours, slopes or drainage claims are available and the terrain gate remains `OPEN`.

Norrköping's 2026 tariff separately documents municipal laser terrain data and a 1 × 1 m grid, with 5 cm published height accuracy where covered. Exact property coverage, currency and supply terms still require municipal confirmation; this alternative remains `DOCUMENTED_NOT_CONNECTED`.

## Norrköping source discovery

The public GeoWebCache WMS capabilities endpoint was observed on 2026-08-18. It exposes:

- service: WMS 1.1.1;
- endpoint: `https://kartor-cache.norrkoping.se/geowebcache/service/wms`;
- layer: `extwms_lm_ortofoto`;
- CRS: `EPSG:3010`;
- advertised bounds: `[76800.0, 6320025.6, 286515.2, 7001600.0]`.

The capabilities record is not sufficient for promotion: the layer title is only its machine name, and no acquisition date or meaningful attribution is provided. An arbitrary target GetMap request around the recorded municipal point `[122807, 6504014]` returned HTTP 200 with zero bytes because the endpoint is a tile cache. A subsequent grid-aligned request returned a valid 256 × 256 PNG covering the point:

- EPSG:3010 tile bounds: `[122675.2, 6503526.4, 123494.4, 6504345.6]`;
- GeoWebCache tile index: `[56, 189, 6]`;
- byte count: `123575`;
- SHA-256: `bb67a2ecefe1f5bdb9aaa6b1fc0695cab72fdb4c726e6b1f73e704bf71902c3f`.

A closer aligned tile also returned valid imagery at bounds `[122777.6, 6503936.0, 122880.0, 6504038.4]`. These observations prove exact-point cache coverage, not acquisition date, legal provenance or permission to embed the tile. No provider image is stored in the repository.

Norrköping's official published material describes municipal orthophoto and oblique-image products, but the exposed cache layer name suggests a Lantmäteriet source. The exact source, date and reuse terms must therefore be reconciled before the WMS is used in the viewer.

## Immediate Street Room observation

Google Maps resolved the number-14 address but its Street View action snapped to a panorama labelled `8 Säterdalsvägen`, dated July 2022. Four live directions were inspected without persisting imagery or panorama identifiers. The nearby context shows a narrow uncurbed local road, asphalt with gravel shoulders and driveways, mature birch/pine woodland, overhead lines on timber poles, informal vegetation-led frontages, detached timber houses with gable roofs, and a downhill long-view opening.

`street-context-v0.1.json` records these only as `REFERENCE_ONLY_NEARBY`. It explicitly does not confirm the exact number-14 frontage, current condition, dimensions, plot access, building positions or provider-derived geometry. The realistic renderer may use the species mix, palette, material character and archetypes, while Product Twin remains the sole owner of geometry.

The exact-address Hemnet gallery was also inspected live on 2026-08-18. Its five listing images show a cleared descending plot with exposed soil and rock, retained pine/birch edges, neighbouring low-rise roofs below the main view line, a surfaced road edge and gravelled working area, overhead lines, brush/cut-timber piles and a broad outlook over Lake Glan. Capped conduits are visible, but their function, connection and capacity are unknown.

This second observation is `LISTED_REFERENCE`, not survey or official-source evidence. No listing pixels, image URLs or extracted geometry are stored. The renderer uses only the qualitative character—clearing, scattered rock, vegetation edges, pitched-roof context and lake-facing outlook—and keeps the visual plot line, road geometry, building positions, access and utilities unverified.

## Evidence state

Still not verified:

- legal cadastral boundary;
- registered area and title;
- source terrain raster and RH2000 elevation values;
- legal access point;
- utility capacity;
- current entitlement and buildable envelope;
- exact municipal imagery source/date and reuse terms;
- exact contextual building geometry and heights.

The current procedural terrain, roads, trees and building massing remain `DERIVED` or local visualisation context. The house and room remain `CONCEPT`.

## Next acceptance sequence

1. Obtain source-qualified imagery coverage for the exact property and record date, licence, CRS, bounds and attribution.
2. Obtain the identified Lantmäteriet `650_55` 1 m terrain asset, verify its advertised byte hash, and clip it to the plot only after the legal boundary is accepted.
3. Transform every accepted source into the common site origin while preserving the source artifact and lineage.
4. Verification must inspect the mounted Mapbox reference at neighbourhood, street and plot stages and confirm that its side-reference treatment cannot be mistaken for survey evidence.
5. Add Google Street View and the listing gallery only as live attributed reference panels; do not cache them or derive geometry from them.
6. Run alignment checks at neighbourhood, street, plot, building and room scales.
7. Submit visual/evidence separation and source licences to Verification before promotion.

## Verification

`npm run site:sweden:svartinge:prototype:gate` now includes the adapter and geographic-alignment tests. It rejects credential persistence, token retention after disconnect, tile persistence, evidence promotion, invalid WGS84 origins, camera drift, invalid axis orientation and missing runtime configuration while preserving the existing scene, provider and mutation gates.
