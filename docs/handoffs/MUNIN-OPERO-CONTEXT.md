# Munin / Opero context handoff

Date: 2026-08-18

Prepared by: Plot-to-Project Spatial Studio (#3)

Repository: `oskar-del/product-twin`

Branch: `agent/plot-to-project-spatial-studio`

## Purpose and safety boundary

This is a sanitized, read-only architectural handoff for the Brain. It records the local Munin and Opero context needed to continue the Norrköping Property/Neighbourhood Twin without rebuilding Munin.

The local AI folder and every Munin/Opero repository are evidence only. No importer, connector, synchronization, migration or audit script was executed while preparing this handoff. No external system was written to. No database, source payload, personal record, credential, connection string or environment value is copied here.

Credential state is represented only as `credential_configured: true|false|unknown`. `true` means a local configuration reference was observed; it does not prove that the credential is current, authorized for a particular dataset or successfully tested.

## Status vocabulary

| State | Meaning in this handoff |
| --- | --- |
| `CONNECTED` | A local application or evidence bundle is wired to the source, or the repository records a completed read-only acquisition. It was not re-executed in this review. |
| `EXECUTABLE_NOT_TESTED` | Runnable local code exists, but it was deliberately not run. Credentials and upstream availability may still block it. |
| `DOCUMENTED_NOT_CONNECTED` | Architecture, schema or product intent exists, but no working connector was found in the reviewed scope. |
| `KEY_REQUIRED` | Access requires a missing, expired or separately permissioned credential/account/request. |
| `RESEARCH_ONLY` | The source appears only in research, strategy, licensing or manual-evidence material and is not an operational connector. |

## 1. Munin Sweden architecture and current applications

Munin Sweden is conceived as a provenance-bearing graph of Swedish companies, people/roles, ownership edges, filings, procurement, properties and market relationships. Its product model is a shared graph with reusable capability “rooms” exposed through actor-specific editions/cockpits and eventually through API/MCP access.

The local architecture describes:

- graph nodes for companies and other market actors;
- ownership, transaction, finance, procurement and property edges;
- source/fetch date/confidence on every promoted fact;
- an entity lifecycle from identified to mapped, verified, monitored, engaged and client;
- a future Supabase/Postgres + pgvector system of record with scheduled connectors and a read-only MCP interface; and
- scope-based access, so each cockpit sees only the graph slice appropriate to its user.

Current local applications include static Munin company and academy pages, graph/cockpit concepts, Swedish market and GTM material, a credential-free Bolagsverket bulk importer, and actor editions described for developer, fund and advisor use. Strategy documents name land/byggrätt origination, valuation/comparables, KYC/UBO, procurement and distress monitoring as graph rooms. These descriptions are not proof that every room has an operational data pipeline.

The canonical Sweden graph was described as file-backed pending a deliberate Supabase promotion. The reviewed material does not establish that a complete production Munin Sweden graph, property resolver or public MCP service is currently live.

## 2. Munin UK architecture and current applications

Munin UK is a separate ownership-intelligence implementation focused on corporate and overseas-owned property titles. It uses:

```text
HM Land Registry CCOD/OCOD
  -> local acquisition and streaming loaders
  -> DuckDB title/owner graph
  -> owner, area and title resolvers
  -> optional Postgres/Supabase schema and RPC interface
  -> reports, web surfaces and MCP/API shell
```

The checked local architecture contains:

- `titles`: one row per registered title/dataset with title, tenure, address geography, recorded price-paid field, proprietor/company references and dataset month;
- `owners`: a normalized portfolio roll-up with company/overseas identifiers, title counts, price-paid aggregate and resolution fields;
- resolver functions for owner portfolio, postcode-area ownership and exact title; and
- Companies House and Register of Overseas Entities resolution fields.

The UK repository reports a locally built, queryable DuckDB graph and working command-line resolvers. Hosted cockpits and a production API are explicitly deferred. Raw licensed title data must not be committed, redistributed, republished as a standalone dataset or used for prohibited direct-marketing use.

Munin UK is useful as an implementation reference for provenance, licensing, local-first graph construction and opaque external references. Its UK records and identifiers must never be copied into the Swedish or Product Twin evidence domains.

## 3. Opero’s role and relationship to Munin

Opero is the agency/productization and operational layer around the intelligence assets. It contains research, cockpit concepts, dashboards, audit/lead capture, marketing operations and connector patterns. Munin is the reusable property/company/ownership intelligence graph; Opero turns graph capabilities into customer-facing editions, workflows and services.

The intended relationship is:

```text
Official and licensed sources
  -> provenance-controlled Munin graph
  -> read-only query/API/MCP contracts
  -> Opero cockpits and workflows
  -> client decisions and monitored events
```

Opero must not become a second source of truth for company, ownership, transaction, property or listing facts. A cockpit may cache presentation-safe projections, but corrections and promotions belong in the Munin data pipeline. Conversely, Munin should not own Plot-to-Project geometry, transforms, design scenarios, Room Twins, Product Twins or procurement placements.

## 4. Relevant local folders

All paths below are read-only evidence locations.

| Folder | Purpose |
| --- | --- |
| `/Users/oskarpeterson/Documents/AI/AGENCY /opero-intelligence/` | Munin/Opero strategy, graph architecture, Swedish opportunity research and UK ownership handoff material. |
| `/Users/oskarpeterson/Documents/AI/munin-pages/` | Static Munin company, academy, map and article surfaces. |
| `/Users/oskarpeterson/munin-sweden-bulk/` | Bolagsverket weekly-bulk acquisition and resumable Sweden-wide company processing. |
| `/Users/oskarpeterson/Documents/AI/munin-uk/` | UK title/owner graph, DuckDB/Postgres schemas, resolvers, API/MCP shell and web/report surfaces. |
| `/Users/oskarpeterson/Documents/AI/AGENCY /opero-dashboard/` | Opero dashboard and warehouse connector pattern for Airtable/MailerLite to Supabase. |
| `/Users/oskarpeterson/Documents/AI/AGENCY /opero-audit-tool/` | Opero audit and lead-capture functions using external AI/CRM services. |
| `/Users/oskarpeterson/Documents/AI/AGENCY /opero-site/` | Opero public website and published marketing content. |
| `/Users/oskarpeterson/Documents/AI/AGENCY /opero-marketing/` | Marketing brain, research, keyword and content pipelines. |
| `/Users/oskarpeterson/Documents/AI/AGENCY /munin-academy/` | Munin learning material and lessons. |
| `/Users/oskarpeterson/Documents/AI/AGENCY /munin-gtm/` | Munin go-to-market material and operational references. |
| `/Users/oskarpeterson/Documents/AI/AGENCY /munin-site/` | Munin public/experimental site surfaces. |
| `/Users/oskarpeterson/Documents/AI/product twin/` | Earlier Product Twin labs and commerce/Shopify adapters; not a Munin data store. |
| `/Users/oskarpeterson/.claude/scheduled-tasks/opero-airtable-sync/` | Read-only evidence of the Airtable synchronization task definition. |
| `/Users/oskarpeterson/.claude/scheduled-tasks/opero-mailerlite-sync/` | Read-only evidence of the MailerLite synchronization task definition. |

## 5. Property, company, ownership, transaction and listing schemas

### Implemented or explicitly defined

| Domain | Current schema/contract |
| --- | --- |
| Company | Munin Sweden architecture specifies company identity, filings, financial/source coverage, lifecycle stage and graph relations. Bolagsverket bulk code supplies the acquisition route, but this review did not validate a canonical committed Sweden company schema. |
| Ownership | Munin Sweden specifies people/company ownership edges and KYC/UBO graph rooms. Munin UK implements normalized title proprietors/owners and external Companies House/RoE resolution fields. |
| Property | Munin Sweden’s target graph includes `properties`. Munin UK implements title-level property records. Product Twin owns `SiteTwin -> NeighbourhoodTwin -> BuildingTwin -> UnitTwin -> ExistingConditionTwin -> SpaceTwin` for spatial applicability, not legal/market facts. |
| Transaction | Munin strategy describes deals/transactions as graph edges. Munin UK title records include a recorded price-paid field and acquisition/proprietor dates, but this is not a complete historic-sales time series. No canonical Swedish transaction ingest was found. |
| Current listing | Product Twin defines an opaque `CURRENT_LISTING` Munin reference. The Säterdalsvägen project keeps seller/listing claims `REPORTED_UNVERIFIED`. No canonical Swedish listing payload schema or live listing connector was found. |
| Historic sales | Product Twin defines an opaque `HISTORIC_SALES` Munin reference. No operational Swedish historic-sales pipeline was found. |
| Comparable set | Product Twin defines an opaque `COMPARABLE_SET` Munin reference. Munin strategy names valuation/comps as a room, but no operational Swedish comparable-set builder was found. |
| BRF | Product Twin defines an opaque `BRF` reference for Munin ownership. No local BRF ingestion pipeline was found in the reviewed scope. |

### Canonical Plot-to-Project interface

The committed `config/spatial/munin-external-reference-v1.schema.json` supports only opaque references of types:

`PROPERTY`, `BUILDING`, `UNIT`, `BRF`, `HISTORIC_SALES`, `CURRENT_LISTING`, `COMPARABLE_SET`.

Each reference carries external identity/version, optional URI/hash, observation time and exactly one evidence state: `RECORDED`, `LISTED`, `INFERRED` or `FORECAST`. `payload_persisted` is fixed false. Prices, owner names, listing prose, transaction values, valuation figures and comparable rows are forbidden locally.

Spatial applicability is a separate binding. It may say that an external Munin record applies to a Site/Neighbourhood/Building/Unit target, but it cannot copy the fact value.

## 6. Discovered APIs, sources and connectors

### Munin, Opero and adjacent infrastructure

| Source/connector | State | Credential configured | Role and limit |
| --- | --- | ---: | --- |
| Bolagsverket valuable-data weekly bulk ZIPs | `EXECUTABLE_NOT_TESTED` | false | Credential-free Swedish company/annual-report acquisition code exists; not executed. |
| Bolagsverket real-time/premium services | `DOCUMENTED_NOT_CONNECTED` | unknown | Mentioned as a possible higher-freshness tier; no operational connector established. |
| TED procurement API/data | `CONNECTED` | false | Existing Opero/Munin architecture identifies a proven credential-free procurement pipeline; not rerun. |
| hitta.se | `DOCUMENTED_NOT_CONNECTED` | false | Research names financial/board acquisition by scraping; no governed connector verified. |
| rating.se | `DOCUMENTED_NOT_CONNECTED` | false | Research names financial/board acquisition by scraping; no governed connector verified. |
| Roaring | `RESEARCH_ONLY` | false | Commercial enrichment option, deliberately deferred. |
| Supabase | `CONNECTED` | true | Opero warehouse and application connection patterns exist. No query or write was performed. |
| Airtable API | `CONNECTED` | true | Opero connector and scheduled-task definition exist. No synchronization was run. |
| MailerLite API | `CONNECTED` | true | Opero connector and scheduled-task definition exist. No synchronization was run. |
| n8n API/workflows | `CONNECTED` | true | Local orchestration configuration/workflows exist. No workflow was inspected for secrets or triggered. |
| Anthropic API | `CONNECTED` | true | Used by Opero audit/content code paths. No request was made. |
| Apify | `CONNECTED` | true | Locally configured acquisition capability; no actor/job was run and no listing was fetched. |
| GitHub app connector | `CONNECTED` | true | Repository read/write integration is available. Local CLI authentication is a separate state. |
| GitHub CLI credential | `KEY_REQUIRED` | false | Installed CLI reports an invalid active token and requires re-authentication. |
| Stripe | `DOCUMENTED_NOT_CONNECTED` | true | Credential presence exists outside Munin graph scope; no reviewed Munin/Opero data flow was established. |
| OpenAI embedding/API path | `KEY_REQUIRED` | false | Local handoff material explicitly records the embedding step as unconfigured. |
| Perplexity | `RESEARCH_ONLY` | unknown | Appears in marketing/search research, not as a governed Munin connector. |
| Shopify/UCP Product Twin adapters | `EXECUTABLE_NOT_TESTED` | false | Product/catalog integration belongs to Product Twin commerce, not Munin property intelligence. |

### Swedish national and provider source registry

| Registry source | State | What it can support |
| --- | --- | --- |
| Lantmäteriet 1 m ground-height STAC catalogue | `CONNECTED` | Current tile discovery, CRS and asset metadata. |
| Lantmäteriet 1 m raster asset download | `KEY_REQUIRED` | Terrain pixels; the identified asset rejected anonymous access. |
| Lantmäteriet orthophoto STAC/download | `KEY_REQUIRED` | Current official orthophoto after access/licence setup. |
| Lantmäteriet property-division vector | `KEY_REQUIRED` | Indicative parcel geometry only; not a surveyed legal boundary. |
| Lantmäteriet building vector | `KEY_REQUIRED` | Official building context after access/licence setup. |
| Lantmäteriet property-register extract | `KEY_REQUIRED` | Registered property identity, area and dated register facts through a permissioned request. |
| Lantmäteriet cadastral acts/rights/joint facilities | `KEY_REQUIRED` | Servitudes, joint facilities, cadastral history and legal interpretation. |
| Nationella geodataplattformen detailed plans | `DOCUMENTED_NOT_CONNECTED` | National discovery only; municipal completeness/legal-force confirmation remains necessary. |
| Boverket plan-provision catalogue | `CONNECTED` | Controlled vocabulary, not the governing plot provision. |
| Boverket current PBL/H30/H50 guidance | `CONNECTED` | Current national rule profile, not plot eligibility. |
| Municipal plan and permit archives | `CONNECTED` | Municipality-specific governing plan, amendments and permit history where captured. |
| SGU soil map | `CONNECTED` | Regional surface-geology screening. |
| SGU soil-depth model/observations | `CONNECTED` | Modelled depth and nearby variability screening. |
| SGU well archive | `CONNECTED` | Nearby bore/well context with positional limitations. |
| SGU groundwater/aquifer/quality services | `DOCUMENTED_NOT_CONNECTED` | Groundwater screening after plot/buffer query. |
| SGI landslide/erosion/quick-clay/ground-movement layers | `DOCUMENTED_NOT_CONNECTED` | Geohazard screening; never a design geotechnical conclusion. |
| MCF flood portal/downloads | `DOCUMENTED_NOT_CONNECTED` | Scenario-dependent flood screening. |
| Naturvårdsverket protected-area services | `CONNECTED` | National context; zero/unknown matches cannot prove absence. |
| Naturvårdsverket Natura 2000 services | `CONNECTED` | National context with known completeness/query limitations. |
| Naturvårdsverket shoreline-protection guidance | `CONNECTED` | Legal framework only; exact zone/case remains open. |
| RAÄ Fornsök/cultural-environment register | `CONNECTED` | Published heritage context with position/extent uncertainty. |
| Länsstyrelserna EBH contaminated-land layer | `CONNECTED` | Known/suspected activity context; not plot contamination proof. |
| Länsstyrelserna geodata catalogue | `DOCUMENTED_NOT_CONNECTED` | Additional county layers requiring targeted selection. |
| Trafikverket NVDB | `KEY_REQUIRED` | Road geometry/manager/logistics attributes after access setup; cannot prove legal access. |
| Ledningskollen | `KEY_REQUIRED` | Utility-owner response through a separately authorized account/case; cannot prove capacity. |
| Energimarknadsinspektionen grid plans/reliability | `DOCUMENTED_NOT_CONNECTED` | Strategic grid context, not connection capacity. |
| SMHI open observations and analyses | `DOCUMENTED_NOT_CONNECTED` | Weather/climate context after a version-pinned adapter. |
| Municipal VA/stormwater/waste/building response | `KEY_REQUIRED` | Property-specific provider facts through an authorized request/contact. |
| Utility-provider connection/capacity response | `KEY_REQUIRED` | Electricity/fibre/water/wastewater/district-energy route, capacity, cost and lead time. |
| Property-specific survey | `KEY_REQUIRED` | Design/legal boundary and topography through commissioned evidence. |
| Geotechnical/groundwater/radon/environmental field pack | `KEY_REQUIRED` | Construction/design basis through commissioned evidence. |

### Norrköping/Svärtinge-specific sources

| Source | State | Current evidence state |
| --- | --- | --- |
| Hemnet listing | `RESEARCH_ONLY` | Seller claims and market pin are retained as reported/unverified; no listing API connector was found. |
| Norrköping NOKA address/property/plan map | `CONNECTED` | Resolves the address to working designation `SVÄRTINGE 54:28`, indicative map area and plan locator; boundaries have no legal effect. |
| Norrköping municipal historic plan files | `CONNECTED` | Captured plan records provide historic constraints/signals; present property-specific interpretation remains open. |
| Norrköping strategic/consultation map services | `CONNECTED` | Point-screened proposed land use and risk/context layers; proposals are not effective entitlement. |
| Norrköping municipal VA/provider response | `KEY_REQUIRED` | Seller-reported paid VA and connection/capacity claims require direct provider evidence. |
| Booli | `DOCUMENTED_NOT_CONNECTED` | Mentioned as a market/listing/comparable source; no local governed connector or schema was found. |

### Munin UK sources

| Source | State | Limit |
| --- | --- | --- |
| HM Land Registry CCOD | `CONNECTED` | Local licensed corporate-owned-title dataset and graph are reported built; raw data cannot be committed or redistributed. |
| HM Land Registry OCOD | `CONNECTED` | Local licensed overseas-owned-title dataset and graph are reported built; same licence controls apply. |
| HM Land Registry download/API key | `KEY_REQUIRED` | Acquisition code expects a separate key for future downloads. |
| Companies House public lookup | `EXECUTABLE_NOT_TESTED` | Resolver architecture exists; not exercised in this review. |
| Register of Overseas Entities | `EXECUTABLE_NOT_TESTED` | Resolution target exists; not exercised in this review. |
| Munin UK DuckDB | `CONNECTED` | Local title/owner query implementation is reported operational; no database was opened or queried here. |
| Munin UK Postgres/Supabase load path | `EXECUTABLE_NOT_TESTED` | Schema/load path exists; hosted promotion is deliberately deferred. |
| Munin UK API/MCP shell | `EXECUTABLE_NOT_TESTED` | Local service code exists; no server was started. |

## 7. Relevant scripts

Scripts are listed for orientation only; none was executed.

| Script/path | Purpose | State |
| --- | --- | --- |
| `/Users/oskarpeterson/munin-sweden-bulk/sweden_bulk_pull.py` | Downloads and processes Bolagsverket weekly bulk ZIPs for a Sweden-wide company universe. | `EXECUTABLE_NOT_TESTED` |
| `/Users/oskarpeterson/Documents/AI/AGENCY /opero-dashboard/connectors/airtable_sync.py` | Reads Airtable records and projects them into the Opero Supabase warehouse. | `CONNECTED` |
| `/Users/oskarpeterson/Documents/AI/AGENCY /opero-dashboard/connectors/mailerlite_sync.py` | Reads MailerLite campaign data and projects it into the Opero Supabase warehouse. | `CONNECTED` |
| `/Users/oskarpeterson/Documents/AI/munin-uk/ingest/fetch.py` | Retrieves licensed UK Land Registry source files. | `KEY_REQUIRED` |
| `/Users/oskarpeterson/Documents/AI/munin-uk/ingest/build_duckdb.py` | Builds the local UK DuckDB graph from source files. | `EXECUTABLE_NOT_TESTED` |
| `/Users/oskarpeterson/Documents/AI/munin-uk/ingest/resolve.py` | Resolves title proprietors against external company/overseas-entity identities. | `EXECUTABLE_NOT_TESTED` |
| `/Users/oskarpeterson/Documents/AI/munin-uk/ingest/load.py` | Streams the UK dataset into hosted Postgres when promoted. | `EXECUTABLE_NOT_TESTED` |
| `/Users/oskarpeterson/Documents/AI/munin-uk/munin.py` | Local CLI for owner, area, title and graph statistics. | `CONNECTED` |
| `/Users/oskarpeterson/Documents/AI/munin-uk/api/mcp_server.py` | Read/query MCP service shell over the UK graph. | `EXECUTABLE_NOT_TESTED` |
| `scripts/fetch-saterdalsvagen14-*.mjs` in this branch | Read-only official-source acquisition for the Norrköping evidence bundle. | Existing uncommitted work; deliberately untouched by this handoff. |
| `scripts/validate-saterdalsvagen14-plot-intelligence.mjs` | Validates receipts, findings, evidence gates and Site/Scenario separation. | Existing uncommitted work; deliberately untouched by this handoff. |

## 8. Supabase, Airtable and n8n flows

Observed Opero flow:

```text
Airtable records -----------+
                            +-> read-only connector projection -> Supabase warehouse -> dashboard views
MailerLite campaign data ---+
```

The warehouse SQL defines presentation/operations tables including email campaigns, social posts, content ideas and traffic metrics. It is an Opero operational warehouse, not the canonical Munin company/property graph.

n8n is the orchestration layer for scheduled or event-driven workflows. Local configuration indicates that n8n, Supabase and external service credentials exist, but this review did not open workflow credentials, inspect payload records or trigger executions.

The intended future Munin flow is different:

```text
source-specific immutable receipts
  -> governed Munin acquisition/normalization pipeline
  -> canonical graph tables + provenance + version/freshness
  -> read-only resolver/API/MCP
  -> Opero cockpit projections and Product Twin opaque references
```

No Opero sync may write into Product Twin geometry. No Product Twin validator may write market facts back to Munin.

## 9. Historic prices, listings and comparable-property capability

Current capability is partial:

- Munin UK implements title-level recorded price fields and owner portfolio aggregates. It is not a Swedish historic-sales/comparable engine.
- Munin strategy includes valuation/comps as a reusable room, but no operational Swedish comparable-set generator was found.
- The Product Twin spatial contract already has opaque `HISTORIC_SALES`, `CURRENT_LISTING` and `COMPARABLE_SET` reference types, so a future read-only Munin resolver can integrate without changing geometry ownership.
- The Säterdalsvägen Hemnet advertisement is a listing evidence source only. Price, plot area, VA, ownership form, building concept and other seller statements remain `LISTED`/reported-unverified until independently sourced.
- No governed local Hemnet or Booli connector, Swedish historic transaction feed, canonical listing payload or verified comparable-set IDs were found.

Therefore the Norrköping project can preserve and reference the current listing now, but it cannot yet claim verified historic-price trends, current-market completeness, comparable valuations or ownership facts.

## 10. Support available for the Norrköping Property/Neighbourhood Twin now

Available now, without redesigning the current work:

1. Keep `SVÄRTINGE 54:28` as the municipality-confirmed working locator while registered identity/area remain open.
2. Use the existing NOKA and municipal plan receipts for NeighbourhoodTwin planning/context anchors with their legal limitations intact.
3. Use existing SGU, RAÄ, EBH, protected-area and consultation-map findings as dated contextual overlays, never as parcel-wide proof where only a point was queried.
4. Bind the Hemnet listing through an opaque future `CURRENT_LISTING` Munin reference; do not copy seller facts into SiteTwin truth.
5. Reserve opaque Munin `PROPERTY`, `BUILDING`, `UNIT`, `HISTORIC_SALES` and `COMPARABLE_SET` IDs in the interface only after a read-only resolver exists.
6. Continue the existing SiteTwin/NeighbourhoodTwin hierarchy and explicit blockers; do not create geometry from market pins, listing images or historic-plan illustrations.
7. Use Bolagsverket only after a company identifier is legitimately associated with the property by authoritative evidence. Company data cannot discover or prove the property owner by itself.

## 11. Domain ownership boundary

| Domain | Canonical owner |
| --- | --- |
| Swedish/UK property identity and external record version | Munin or authoritative external registry |
| Company, person/role, UBO and ownership graph | Munin |
| Historic sales, current listings and comparable sets | Munin/external evidence system |
| Market value, valuation forecast and transaction facts | Munin/external evidence system |
| Cockpit presentation and customer workflows | Opero |
| Site boundary, CRS, terrain and site evidence | Plot-to-Project SiteTwin |
| Neighbourhood, building, unit, existing condition and space geometry | Plot-to-Project Spatial Studio |
| Applicability of a Munin fact to a spatial target | Plot-to-Project Spatial Studio, as a value-free binding |
| Design scenario transformation geometry | Plot-to-Project Spatial Studio |
| Furniture/product geometry and product spatial semantics | Avatar Factory/Product Twin |
| Destination supply and procurement offers | Procurement |
| Interactive explicit placements | Room Lab |
| Final source, geometry and acceptance decisions | Verification |

Hard rule: every market value, cost, ownership, sales, listing and comparable fact remains external. Plot-to-Project stores only opaque references, evidence state and spatial applicability—never the payload.

## 12. Exact remaining access and evidence gaps

### Access/integration

1. A read-only Munin Sweden resolver endpoint with stable opaque IDs, record version, observation time, content hash and existence/currentness checks.
2. Lantmäteriet access/licence for 1 m terrain, indicative property-division and building vectors.
3. Permissioned Lantmäteriet property-register extract and cadastral acts/rights/joint-facility records.
4. A governed Swedish current-listing connector and canonical listing record/version contract.
5. A governed Swedish historic-sales source and comparable-set builder.
6. A BRF ingestion/resolution source if the hierarchy expands to cooperative units.
7. NVDB access setup and a municipality/road-manager workflow for access evidence.
8. Ledningskollen/provider workflows, each requiring separate user authorization before case creation or contact.
9. Valid local GitHub CLI authentication if local CLI publication is required; the GitHub app connector is separately available.

### Norrköping property evidence

1. Authoritative confirmation that the current property record is `SVÄRTINGE 54:28`, including registered area and record date.
2. Authoritative parcel geometry and reconciliation against NOKA's legally non-binding map polygon.
3. Full cadastral act, servitude, right and joint-facility chain.
4. Reconciliation of historic plan `0581K-22D:1008`, amendments and current property-specific municipal interpretation.
5. Effective buildable envelope and plot-specific H30/H50 eligibility; neither may be inferred from the national profile.
6. Downloaded, hashed 1 m terrain plus a plot-specific survey before design-grade topography.
7. Legal access, road manager and driveway approval.
8. VA connection point, capacity, paid status, remaining charges and stormwater response from the provider.
9. Electricity/fibre and other utility route/capacity responses.
10. Plot-specific geotechnical, groundwater, radon, infiltration, contamination and heritage clearance.
11. Parcel-wide reruns of all current point-only risk screens after authoritative geometry is available.
12. Verified historic sales, active-listing history and comparable-set evidence if market intelligence is later requested.

## 13. Continuation instruction

Continue the existing Norrköping evidence acquisition and Spatial Twin work from its current branch state. Do not restart the project, redesign the graph or ingest Munin payloads. The next promotion target remains authoritative property identity/area/geometry and the governing-plan chain, followed by terrain and provider evidence. All external requests, cases, contacts and commissioned work remain permissioned actions.
