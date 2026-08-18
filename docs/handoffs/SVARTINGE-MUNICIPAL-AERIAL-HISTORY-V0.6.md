# Svärtinge municipal aerial history checkpoint v0.6

Date: 2026-08-18  
Branch: `agent/plot-to-project-spatial-studio`

## Outcome

The Svärtinge viewer now has a credential-free live `Aerial history` drawer. It loads exact-point imagery directly from Norrköping's public WMS/GeoWebCache for municipal layer labels 2008, 2010, 2017 and 2025. No provider image, tile or derived trace is committed.

The drawer is a visual reference surface. It does not alter the Product Twin geometry graph, close a gate, establish a capture date, or verify a boundary, building, access point, height, terrain value or entitlement.

## Verified service evidence

The public WMS capability record was captured from `https://kartdata.norrkoping.se/wms?servicename=kartor`:

- service title: `SpatialMap 4.3.0`;
- protocol: WMS 1.3.0;
- CRS: EPSG:3010;
- WMS 1.3.0 request axis order: northing, easting;
- capability bytes: 609,850;
- SHA-256: `de938fb1cd269fed257e66ee32bfaa79c06912a076f1c3cbb80f07747339cd03`.

Three WMS responses were verified at the municipal locator using a common 1 km window:

| Layer | Official service title | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `ortofoto_aldre_norrkoping_2008` | Norrköping, Åby, Svärtinge 2008 | 767,978 | `c4a205bfb082d0c41833af118cc8569ba070690f126b8f0369f141ed728e07a1` |
| `ortofoto_aldre_norrkoping_2010` | Norrköping, Åby, Svärtinge 2010 | 804,720 | `5b687e5f372aee18044efbe60a269b487858a5060c0f2051fbf4fed54664d8e4` |
| `ortofoto_orter_lm` | Hela kommunen 2017 | 686,340 | `d9e3298846736dbe2374358ba06ae6e24cb464579785660906e2e84d80952516` |

The current cache layer `extwms_lm_ortofoto` is now associated with the official parent title `Flygfoto 2025`. Its previously validated exact-point cache response remains 123,575 bytes with SHA-256 `bb67a2ecefe1f5bdb9aaa6b1fc0695cab72fdb4c726e6b1f73e704bf71902c3f`.

These year values are official service titles. They are not promoted to independently verified capture dates because the WMS metadata does not expose capture timestamps or full underlying-imagery provenance.

## Product integration

- `data/sites/sweden/saterdalsvagen-14/municipal-aerial-history-v0.1.json` is the source-bound live-reference contract.
- `config/spatial/svartinge-municipal-aerial-history-v0.1.schema.json` is the strict schema.
- `context-providers-v0.1.json` now marks `NORRKOPING_ORTHOPHOTO` as `CONNECTED` only for live visual context.
- `prototype/svartinge-neighbourhood/index.html` mounts the drawer on explicit user interaction and places the known municipal locator over each live extent.
- The provider URLs contain no credential and the application uses no local storage, session storage or cookies for the reference.

## Property-boundary service discovery

Norrköping also publishes a free single-property DWG extract service. The official page states that the geometry comes from the municipal database in SWEREF 99 16 30 and expressly warns that it has no legal effect, can be positionally misleading, and may have incomplete rights/joint-facility content.

The service performs a POST to `createorder.php` and generates a ZIP. No order was submitted in this checkpoint because that would create external service state. If explicitly authorised, `SVÄRTINGE 54:28` can be requested and stored only under ignored runtime evidence, then treated as municipal indicative geometry—not a legal or surveyed boundary.

## Open gate

`GATE_SE_AERIAL_PROVENANCE_AND_PUBLICATION_RIGHTS` remains open until capture dates, underlying imagery origin and layer-specific publication/reuse terms are reconciled. All existing site, terrain, access, utility and planning gates remain unchanged.

