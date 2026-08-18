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
- explicitly prohibits evidence promotion;
- has no effect unless called with explicit runtime configuration.

The adapter is not yet mounted inside the production viewer. Correct geographic camera alignment and overlay integration remain a separate acceptance step.

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

## Evidence state

Still not verified:

- legal cadastral boundary;
- registered area and title;
- source terrain raster and RH2000 elevation values;
- legal access point;
- utility capacity;
- current entitlement and buildable envelope;
- exact municipal imagery source/date/coverage;
- exact contextual building geometry and heights.

The current procedural terrain, roads, trees and building massing remain `DERIVED` or local visualisation context. The house and room remain `CONCEPT`.

## Next acceptance sequence

1. Obtain source-qualified imagery coverage for the exact property and record date, licence, CRS, bounds and attribution.
2. Obtain the accepted Lantmäteriet 1 m terrain asset and bind its byte hash, horizontal CRS and RH2000 vertical datum.
3. Transform every accepted source into the common site origin while preserving the source artifact and lineage.
4. Mount Mapbox as live licensed context and synchronize its camera with the seven-stage Product Twin navigation.
5. Add Google Street View only as a live attributed reference panel; do not cache it or derive geometry from it.
6. Run alignment checks at neighbourhood, street, plot, building and room scales.
7. Submit visual/evidence separation and source licences to Verification before promotion.

## Verification

`npm run site:sweden:svartinge:prototype:gate` now includes the adapter test. It rejects credential persistence, tile persistence, evidence promotion, invalid WGS84 origins and missing runtime configuration while preserving the existing scene, provider and mutation gates.
