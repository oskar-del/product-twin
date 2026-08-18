# Svärtinge official context geometry checkpoint v0.5

Date: 2026-08-18  
Branch: `agent/plot-to-project-spatial-studio`

## Outcome

Spatial Studio has resolved the exact official source packages needed to replace the current diagrammatic Street Room context for Säterdalsvägen 14. Public source metadata is captured and hash-bound. Protected geometry assets have not been acquired, so the visible plot line, road and neighbouring buildings retain their existing `INDICATIVE` or `DERIVED` states.

## Exact official packages

- Lantmäteriet vector STAC collection `byggnader`, item `0581`: Buildings for Norrköping municipality, EPSG:3006, updated 2026-08-14. The advertised 14,122,089-byte ZIP contains a GeoPackage. The asset returned HTTP 401 without approved Geotorget access.
- Lantmäteriet vector STAC collection `fastighetsindelning`, item `0581`: Property division for Norrköping municipality, EPSG:3006, updated 2026-08-15. The advertised 44,443,839-byte ZIP contains a GeoPackage. The asset returned HTTP 401 without approved Geotorget access.
- Trafikverket NVDB `Vägtrafiknät`: documented current road-network source. Public metadata is available, but the exact Säterdalsvägen registered-account extract is absent.

Both Lantmäteriet item bboxes contain the recorded municipal locator in WGS84 and projected EPSG:3006 coordinates. This verifies catalogue coverage, not the presence, identity or shape of the `SVÄRTINGE 54:28` feature.

## Contract and viewer integration

- `data/sites/sweden/saterdalsvagen-14/official-context-geometry-sources-v0.1.json` records source identity, timestamps, CRS, bboxes, asset sizes, access state, immutable metadata receipts and promotion gates.
- `config/spatial/svartinge-official-context-geometry-sources-v0.1.schema.json` is the strict versioned schema.
- `data/sites/sweden/saterdalsvagen-14/context-providers-v0.1.json` now exposes the building, property-division and road sources as `KEY_REQUIRED`.
- The Street Room Sources panel now distinguishes verified official package metadata from absent protected geometry bytes.

## Deterministic import requirements

When approved runtime access exists, acquisition must preserve raw ZIP hashes and byte counts, list ZIP entries, verify GeoPackage integrity, parse the source CRS, preserve source object IDs and clip a 250 m context around the verified locator. The local transform is EPSG:3006 east/north offsets to the established local east/up/north frame. Derived outputs require their own stable hashes.

The importer may not invent building heights, road width or legal access. Property geometry may not close the legal-boundary gate without property-feature identity, relevant cadastral acts and Verification acceptance.

## Open gates

- `GATE_SE_EXISTING_BUILDINGS`
- `GATE_SE_PROPERTY_DIVISION_CONTEXT`
- `GATE_SE_ROAD_GEOMETRY`

These are context-quality gates. The existing legal boundary, registered area, surveyed terrain, legal access, utility, entitlement and buildable-envelope gates remain open and unchanged.

## Next evidence action

Use an approved Geotorget account/system account to acquire the two exact Lantmäteriet assets into ignored runtime storage, then execute the bounded import contract and QA the local clips. Use a registered Trafikverket data-exchange account for the exact NVDB road extract. No credential should be committed or persisted by the viewer.

