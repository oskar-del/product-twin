# Sweden Neighbourhood Cell Compiler and Property Price History v1

Checkpoint date: 2026-08-24
Branch: `agent/plot-to-project-spatial-studio`
Status: contract and deterministic plan only; no dashboard expansion, source execution, market ingestion or deployment

## Outcome

The scalable product is an address-triggered, cell-cached and evidence-versioned neighbourhood compiler. It does not generate an isolated scene for every address and it does not use postcode as the geometry key.

```text
Address request
  -> canonical address ID
  -> property ID and parcel lineage
  -> SWEREF 99 TM neighbourhood cells
  -> reuse compiled cell versions by source hash
  -> compile only missing or stale layers
  -> bind the Property Twin and private project overlays
  -> resolve market timelines from Munin by opaque reference
  -> Verification controls promotion to current-world geometry
```

One compiled neighbourhood cell can serve every property request inside it. New verified projects improve the shared world without allowing a private proposal to overwrite existing condition.

## Requirements

### Functional

- Accept a Swedish address as the user entrypoint.
- Resolve canonical address, property, property-lineage, building, unit and BRF identities as applicable.
- Load a continuous 3D neighbourhood around the property.
- Reuse existing terrain, building, road, vegetation and environmental artifacts across properties.
- Produce adaptive context: at least ten street segments plus view-relevant terrain and landmarks.
- Keep Intelligence, Realistic and Compare profiles on one georeferenced world and camera.
- Attach property transaction, listing, tax, comparable, index and valuation timelines through Munin references.
- Preserve `RECORDED`, `LISTED`, `INFERRED` and `FORECAST` as different evidence states.
- Maintain time-aware project states without treating proposals as current reality.

### Non-functional

- Progressive delivery: immediate live context, asynchronous source-bound compilation, later property verification.
- Deterministic cell compilation from versioned source artifacts and normalized parameters.
- Cell-edge continuity with a 100 m halo and stable-source-ID deduplication.
- Streamable multi-resolution geometry rather than one monolithic scene.
- No Google tile persistence or geometry extraction.
- No price, cost, buyer, seller, owner or personal-identifier payload in Spatial Studio.
- No dashboard work or deployment in this milestone.

## Key decision: cells, not postcodes

Postcodes remain useful for rollout, demand analysis, market aggregation and acquisition planning. They are unsuitable as spatial compilation units because they are irregular, can change and do not align with rendering or official source tiles.

The v1 Sweden compiler uses:

| Field | Decision |
| --- | --- |
| Native index | projected square grid |
| CRS | `EPSG:3006` / SWEREF 99 TM |
| Cell size | 1,000 x 1,000 m |
| Stitching halo | 100 m |
| Stable cell template | `SE_EPSG3006_1KM_{EASTING_KM}_{NORTHING_KM}` |
| Postcode role | discovery, analytics and rollout only |
| Context selection | street network plus view horizon |

The renderer can request adjacent cells when the subject or camera approaches a boundary. Source geometry is clipped with the halo and deduplicated by stable source ID before export.

## Adaptive context

A fixed radius is not sufficient. The compiler starts with a density profile and expands when terrain, water or important views require it.

| Context | Working radius |
| --- | --- |
| Urban | 300-500 m |
| Suburban | 600-800 m |
| Rural | 1-3 km |
| All | at least ten relevant street segments |

Svärtinge should use the suburban profile, with lightweight distant terrain and Lake Glan context when it affects views.

## Delivery states

### 1. Instant context

- Existing compiled cells.
- Address locator and property working identity.
- Live municipal or commercial visual context where permitted.
- Explicit source and confidence disclosure.

### 2. Compiled context

- Source-bound terrain and orthophoto.
- Property division, buildings and roads.
- Derived roof and height geometry from permitted official sources.
- Vegetation, hydrography, planning and environmental overlays.
- Solar, shadow, privacy and viewshed calculations.

### 3. Verified Property Twin

- Accepted property boundary and lineage.
- Accepted terrain and coordinate basis.
- Planning, access and utility interpretation.
- Surveyed or otherwise accepted existing condition.
- Verified design, approval, construction and as-built transitions.

## Cell layers and current contract state

| Layer | Current state | Intended persistence | Principal blocker |
| --- | --- | --- | --- |
| Terrain | `KEY_REQUIRED` | source-bound geometry | Lantmäteriet Markhöjdmodell cell bytes |
| Orthophoto | `CONNECTED` | live display only today | persistent source-authorized artifact |
| Property division | `DOCUMENTED_NOT_CONNECTED` | source-bound geometry | cell-wide municipal or Lantmäteriet package |
| Buildings | `KEY_REQUIRED` | source-bound geometry | official vectors plus height/surface evidence |
| Roads | `DOCUMENTED_NOT_CONNECTED` | source-bound geometry | authoritative street/path extract |
| Vegetation | `RESEARCH_ONLY` | source-bound geometry | canopy/surface source and generalization method |
| Hydrography | `DOCUMENTED_NOT_CONNECTED` | source-bound geometry | water geometry and level semantics |
| Planning | `DOCUMENTED_NOT_CONNECTED` | reference/overlay | current applicability interpretation |
| Environment | `DOCUMENTED_NOT_CONNECTED` | reference/overlay | dated national and municipal clips |
| Live photorealistic context | `KEY_REQUIRED` | live display only | runtime credentials and attribution |

Norrköping documents a base map containing buildings, canopies, terraces and other detailed objects in SWEREF 99 16 30 and RH2000. Its free property-boundary export is property-by-property and explicitly lacks legal effect, so it is evidence for a working property outline but is not the scalable cell-wide acquisition route. See [Norrköping open map data](https://norrkoping.se/boende-trafik-och-miljo/lantmateri-och-kartor/oppna-kartdata-och-tjanster) and [Norrköping base map](https://norrkoping.se/boende-trafik-och-miljo/lantmateri-och-kartor/baskarta).

Lantmäteriet's Markhöjdmodell supplies a one-metre height grid and is the correct persistent terrain basis when access and exact bytes are acquired. See [technical description](https://www.lantmateriet.se/globalassets/geodata/geodataprodukter/hojddata/tk_markhojdmodell_nedladdning_v1.0.pdf).

Google Photorealistic 3D Tiles can be displayed live behind Product Twin overlays with required attribution. Google prohibits using its tiles for extraction, tracing, object detection or persistent offline geometry. See [Map Tiles API policies](https://developers.google.com/maps/documentation/tile/policies).

## Property price history

Price history is a property-identity timeline, not an address string lookup and not a Spatial Studio payload.

```text
Typed address
  -> canonical address ID
  -> property ID
  -> predecessor/successor parcel graph
  -> building, unit or BRF identity
  -> Munin timeline references
```

The v2 Munin reference interface adds these reference types without changing the existing v1 interface:

- `PROPERTY_LINEAGE`
- `ADDRESS`
- `TRANSACTION_HISTORY`
- `LISTING_HISTORY`
- `TAX_ASSESSMENT_HISTORY`
- `MARKET_INDEX`
- `VALUATION`

It retains property, building, unit, BRF, historic-sales, current-listing and comparable-set references.

### Timeline events

- `LISTING_CREATED`
- `ASKING_PRICE_CHANGED`
- `LISTING_WITHDRAWN`
- `LISTING_RELISTED`
- `BROKER_REPORTED_SALE`
- `FINAL_BID_REPORTED`
- `DEED_TRANSFER_RECORDED`
- `TAX_ASSESSMENT_RECORDED`
- `PROPERTY_SUBDIVIDED`
- `PROPERTY_MERGED`
- `BUILDING_COMPLETED`

### Transaction allocation safeguards

An official transfer may cover one property, multiple properties or a parent property that was later subdivided. The interface therefore requires one of:

- `EXACT_SINGLE_PROPERTY`
- `MULTI_PROPERTY_UNALLOCATED`
- `PARENT_PROPERTY_ONLY`
- `NOT_APPLICABLE`

The compiler must never divide a multi-property purchase price or assign a parent-property transfer price to a child parcel without explicit evidence and a recorded method.

## Swedish price connectors

| Connector | Role | State | Evidence use |
| --- | --- | --- | --- |
| Lantmäteriet Fastighetsprisregistret | official transfers | `KEY_REQUIRED` | `RECORDED` |
| Valueguard | commercial property/sales/AVM | `KEY_REQUIRED` | `RECORDED`, `INFERRED`, `FORECAST` |
| Svensk Mäklarstatistik | market statistics and detailed object data | `PARTNERSHIP_REQUIRED` | `INFERRED`, `FORECAST` |
| Booli | listing and published sale reference | `PARTNERSHIP_REQUIRED` | `LISTED` until authorized feed exists |
| Hemnet | listing and consented sale reference | `PARTNERSHIP_REQUIRED` | `LISTED` until authorized feed exists |
| Skatteverket | tax assessment | `DOCUMENTED_NOT_CONNECTED` | `RECORDED`, but not a sale price |

Lantmäteriet's Fastighetsprisregistret contains transfer type, date, purchase price, property designation, linked addresses, coordinates and taxation information. The integration product is delivered for system use and documents loaded records after 29 September 2014. It may contain buyer and seller data, but this Product Twin route must request and persist none of that personal information. See [Fastighetsprisuttag](https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/fastighetsprisuttag/) and [register contents](https://www2.lantmateriet.se/sv/fastighet-och-mark/information-om-fastigheter/Fastighetsprisregistret/).

Valueguard documents an authenticated API/SDK for property registers, historical transactions, sales, price indices and automated valuation. See [Valueguard SDK](https://valueguard.se/erbjudande/valueguard-sdk/). Svensk Mäklarstatistik offers commercial detailed object data and an API for aggregated historical prices and sales. See [business data](https://www.maklarstatistik.se/for-foretag-organisationer/) and [aggregate API](https://www.maklarstatistik.se/svensk-maklarstatistiks-api-aggregerad-statistik/).

Booli states that its housing-data API for listings and final prices is closed to new users. Hemnet's BostadsAPI requires a signed contract and is broker-oriented. Their public pages can support dated human research, but must not be treated as authorized scalable ingestion feeds. See [Booli API status](https://www.booli.se/vanliga-fragor/sv/articles/16412380-api-for-maklare-vad-kan-jag-komma-at) and [Hemnet BostadsAPI](https://integration.hemnet.se/documentation/v1).

## Svärtinge market binding state

Public research confirmed that exact-address listing and area-level transaction sources exist, but no asking price, sale price, listing duration, market value or transaction payload is copied into this repository checkpoint. No real Munin property, lineage, listing, transaction or comparable-set ID is bound in the contract-only fixture.

Because the subject is reported externally as a recently formed plot, predecessor-property lineage is a mandatory identity gate before any historic transfer can be attributed to it. The next market step is a read-only Munin resolver backed by an authorized Lantmäteriet or commercial connector; the returned values remain in Munin and are rendered only at request time.

## Domain ownership

| Domain | Owner |
| --- | --- |
| Property/address/building/unit/BRF identity | Munin |
| Parcel-lineage facts | Munin |
| Transactions, listings, tax history and comparables | Munin |
| Market values and forecasts | Munin |
| Cell terrain, geometry and coordinate transforms | Spatial Studio #3 |
| Applicability of a Munin reference to spatial geometry | Spatial Studio #3 |
| Private design and transformation geometry | Spatial Studio #3 |
| Promotion of a proposal or as-built state to the current world | Verification |

Spatial Studio persists only opaque external IDs, record versions, timestamps and optional content hashes. It persists no market payload and no personal data.

## Progressive runtime design

```text
Address API
  -> identity resolver
  -> coverage registry
  -> cell manifest cache
      -> current compiled artifacts
      -> source adapter queue for missing/stale layers
  -> streamable 3D cell set
  -> Property Twin overlay
  -> live Munin reference resolver
  -> one orbitable client scene
```

The first request in an area pays the compilation cost. Later requests reuse the same immutable cell versions. A demand signal can precompile adjacent cells, but only source-authorized artifacts may enter the persistent cache.

## Reliability and observability

Each compiled layer should report:

- requested and resolved cell IDs;
- source authority, dataset version and acquisition time;
- raw and derived content hashes;
- CRS, units and bounds;
- compile duration and artifact size;
- feature counts and rejected features;
- cell-edge mismatch count;
- source staleness and next refresh date;
- deterministic rerun result;
- evidence and promotion state.

Retries must be idempotent by cell ID, source version and normalized parameters. A failed layer must not invalidate already verified layers; the client should degrade to live or lower-detail context with the missing layer disclosed.

## Trade-offs

| Decision | Benefit | Cost |
| --- | --- | --- |
| 1 km native cells | alignment with Swedish precision and manageable artifacts | requires global routing adapter for other countries |
| 100 m halo | clean roads, terrain and roofs at cell edges | some duplicated source processing |
| demand-driven compilation | controls acquisition and compute costs | first property in an area is slower |
| live Google context | immediate realism | not persistent or usable as geometry evidence |
| Munin reference-only market binding | one market source of truth | requires a live resolver for UI values |
| property lineage before price attribution | prevents false historic prices | identity resolution is more complex |

Revisit cell size, halo and precompilation policy after measuring real source-artifact sizes, compile duration, camera range and repeated-demand patterns across urban, suburban and rural projects.

## Contract and test paths

| Artifact | Path |
| --- | --- |
| Sweden cell schema | `config/spatial/sweden-neighbourhood-cell-v1.schema.json` |
| Munin market-reference v2 schema | `config/spatial/munin-property-market-reference-v2.schema.json` |
| Cell availability schema | `config/spatial/sweden-neighbourhood-cell-availability-v1.schema.json` |
| Contract-only fixture | `data/neighbourhood-cell/v1/sweden-contract-only-fixture-v1.json` |
| Deterministic plan | `data/neighbourhood-cell/v1/sweden-contract-only-compiled-plan-v1.json` |
| Svärtinge nine-cell availability manifest | `data/sites/sweden/saterdalsvagen-14/neighbourhood-cell-availability-v0.1.json` |
| Validator | `scripts/validate-sweden-neighbourhood-cell-contract.mjs` |
| Mutation suite | `scripts/test-sweden-neighbourhood-cell-contract.mjs` |

Run `npm run site:sweden:cell:gate`.

## Svärtinge availability checkpoint and next milestone

The verified EPSG:3006 locator and the 800 m suburban context plus 100 m stitching halo resolve deterministically to nine 1 km cells. The subject cell is `SE_EPSG3006_1KM_559_6501`; eight adjoining cells provide the compilation context. All nine remain `INDEXED_NOT_COMPILED`, with zero compiled artifacts and zero market references.

Next:

1. Acquire authorized Lantmäteriet terrain bytes and verify RH2000 values across the nine-cell selection.
2. Acquire the cell-wide municipal base map or Lantmäteriet property/building/road packages.
3. Compile terrain, property, building and road layers with source manifests and deterministic hashes.
4. Keep current live municipal aerial and future Google 3D context as attributed live-only layers.
5. Add a read-only Munin resolver interface for property, lineage, transaction-history, listing-history and comparable-set IDs.
6. Ask Verification to accept cell stitching, identity applicability and evidence states before any cell is marked reusable by another property.

Do not extend the dashboard or present the current twelve derived houses as official context geometry while these gates remain open.
