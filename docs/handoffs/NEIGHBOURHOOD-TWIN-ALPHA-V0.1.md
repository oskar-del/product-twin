# Norrköping / Svärtinge Neighbourhood Twin Alpha v0.1

Checkpoint date: 2026-08-18

Branch: `agent/plot-to-project-spatial-studio`

Subject working identity: `SVÄRTINGE 54:28`

## Outcome

This checkpoint is the first truthful neighbourhood-scale interface for the Säterdalsvägen 14 investigation. It does not create a cadastral parcel, terrain model, building model or entitlement. It binds the existing 20-receipt / 18-finding plot-intelligence record to:

- an explicit WGS84 address/property locator and municipal EPSG:3010 query point;
- a translucent area-equivalent uncertainty disc that is mechanically forbidden from being called a parcel boundary;
- source-labelled street, neighbourhood and proximity context;
- ten blocking gates covering legal boundary, terrain, buildings, roads, planning, access, utilities, flood/drainage, soil/groundwater and heritage/environment;
- the complete `REGION → NEIGHBOURHOOD → STREET → PLOT → BUILDING → UNIT → ROOM` interface; and
- four deterministic camera/LOD modes, with building orbit and room entry blocked.

```mermaid
flowchart LR
  R["REGION"] --> N["NEIGHBOURHOOD\nanchor + context labels"]
  N --> S["STREET\ntext context only"]
  S --> P["PLOT\nuncertainty disc only"]
  P -->|"blocked: no building geometry"| B["BUILDING"]
  B --> U["UNIT"]
  U --> O["ROOM"]
```

## Evidence register

| Domain | State | Extracted truth | Limitation / blocker |
|---|---|---|---|
| Working identity | VERIFIED | Municipal point query maps Säterdalsvägen 14 to `SVÄRTINGE 54:28` | Not a property-register/title extract |
| Coordinate anchor | VERIFIED | `[16.0317063331, 58.6522414431]` in EPSG:4326; `[122807, 6504014]` in EPSG:3010 | Not surveyed control; no vertical coordinate |
| Municipal map surface | INDICATIVE | 1,938.198844 m² | NOKA map has no legal effect |
| Parcel shape | UNKNOWN | No source geometry | Area-equivalent disc is not a boundary or design base |
| Seller context | REPORTED_UNVERIFIED | Remains in separated Project record | No price, owner, listing or transaction payload enters this Twin |
| Terrain | BLOCKED | 1 m item `650_55`, EPSG:3006 + RH2000 identified | Raster returned HTTP 401; no values, contours, slope or mesh |
| Existing buildings | BLOCKED | Municipal narrative supports villa-settlement context | No footprint, height, use or lawful-status geometry |
| Roads | BLOCKED | Subject street name and historic road context exist | No current centreline, width, gradient, manager or legal-access proof |
| Schools/childcare | VERIFIED | Two municipal F-6 schools and Utsikten preschool exist in Svärtinge | Presence only; no distance or route measurement |
| Healthcare | INDICATIVE | Municipal draft says Svärtinge currently lacks a health centre | No named alternative, capacity or travel measurement |
| Transport | VERIFIED | Official Svärtinge skogsbacke stop page; line 410 observed | Volatile; no distance, route or frequency claim |
| Shops | VERIFIED | ICA Nära Svärtinge operator page | No price, stock, opening-hours or distance claim |
| Nature | VERIFIED | Municipal material describes Glan/nature locality context | No sightline, shoreline access or distance proof |
| Historic planning | INDICATIVE | `0581K-22D:1008`, legal-force date 1936-05-26, found at point locator | Current property mapping, amendments and legal effect unresolved |
| Strategic planning | VERIFIED | 2025 municipal plan adopted; 1984 Svärtinge plan continues; 2026 proposal is consultation draft | Strategic context is not entitlement |
| Entitlement | BLOCKED | None established | No buildable envelope or H30/H50 eligibility |
| Munin interface | UNKNOWN | Zero opaque references available | Zero payloads persisted; no identifier invented |

Proximity `distance_m` values are deliberately null. A coordinate-based third-party query was denied because it would disclose the exact property locator. The register therefore records locality presence and the exact non-distance method instead of fabricating proximity measurements.

## Prototype display contract

The first prototype can display:

- regional/locality context and the verified locator;
- explicit CRS and axis order;
- a translucent area-equivalent uncertainty disc;
- text-only street and neighbourhood character;
- source/date/method-labelled proximity cards;
- planning chronology and hard-gate overlays.

It cannot display:

- legal, cadastral or surveyed parcel geometry;
- terrain, contours, slopes, drainage or finished-floor levels;
- source-bound surrounding buildings or road geometry;
- setbacks, buildable envelope or entitlement;
- legal access, utility routes or capacity;
- verified flood absence; or
- building, unit or room geometry.

## Files

- schema: `config/spatial/neighbourhood-twin-alpha-v0.1.schema.json`
- manifest: `data/sites/sweden/saterdalsvagen-14/neighbourhood-twin-alpha-v0.1.json`
- indicative GeoJSON: `data/sites/sweden/saterdalsvagen-14/neighbourhood-context-indicative-v0.1.geojson`
- builder: `scripts/build-svartinge-neighbourhood-twin-alpha.mjs`
- validator: `scripts/validate-svartinge-neighbourhood-twin-alpha.mjs`
- mutations: `scripts/test-svartinge-neighbourhood-twin-alpha.mjs`

## Deterministic gate

```sh
npm run site:sweden:svartinge:neighbourhood:gate
```

The gate rebuilds the area-equivalent disc and manifest, verifies pinned source and geometry hashes, enforces all five evidence states, rejects Munin payload fields, and attacks every premature geometry/legal promotion.

## Verification and monitoring

Verification must independently confirm source hashes, CRS/axis handling, the disc's non-boundary labelling, all ten hard gates, the absence of Munin payloads, and the source/date/method status of each proximity row. Planning/access/regulatory evidence should be rechecked monthly while actively relied on and immediately after authority-document changes. Transit/service pages require re-observation before customer-facing use.

No merge, deployment, dashboard or polished 3D scene is part of this checkpoint.
