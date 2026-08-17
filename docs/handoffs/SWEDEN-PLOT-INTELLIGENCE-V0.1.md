# Sweden plot intelligence v0.1 handoff

Date: 2026-08-17

Branch: `agent/plot-to-project-spatial-studio`

## Svärtinge Neighbourhood Twin Alpha checkpoint (2026-08-18)

The first versioned Neighbourhood Twin Alpha now binds the existing `SVÄRTINGE 54:28` discovery record without promoting its unresolved geometry or planning claims. The authoritative checkpoint is `docs/handoffs/NEIGHBOURHOOD-TWIN-ALPHA-V0.1.md`.

Implemented artifacts:

- `config/spatial/neighbourhood-twin-alpha-v0.1.schema.json`
- `data/sites/sweden/saterdalsvagen-14/neighbourhood-twin-alpha-v0.1.json`
- `data/sites/sweden/saterdalsvagen-14/neighbourhood-context-indicative-v0.1.geojson`
- `scripts/build-svartinge-neighbourhood-twin-alpha.mjs`
- `scripts/validate-svartinge-neighbourhood-twin-alpha.mjs`
- `scripts/test-svartinge-neighbourhood-twin-alpha.mjs`

The interface exposes `REGION → NEIGHBOURHOOD → STREET → PLOT → BUILDING → UNIT → ROOM`, but only region/neighbourhood labels, a street name, the verified point anchor and an explicitly non-legal area-equivalent uncertainty disc are currently renderable. Ten hard gates prohibit legal boundary, terrain, surrounding-building, road, entitlement, access, utility, flood/drainage, soil/groundwater and heritage/environment promotion. Building orbit, unit entry and room entry remain blocked. Munin carries zero persisted payloads and no opaque ID is invented.

Run `npm run site:sweden:svartinge:neighbourhood:gate` for the deterministic builder, validator and negative mutations.

## Outcome

The repository now has a reusable national Sweden adapter for Plot-to-Project.
It does not contain a fabricated Swedish parcel. The starter profile remains
`INTAKE_REQUIRED`, with all 18 evidence gates open, until a municipality and
complete `fastighetsbeteckning` are supplied or a coordinate/address/listing is
resolved to one official property.

The adapter keeps the same Project → immutable Site Twin → Design Scenario
separation used by CANOPUS. HouseKit H30 and H50 are comparison scenarios. They
cannot rewrite the property boundary, plan status, access, terrain or utility
facts.

## Why the Sweden profile is richer

Sweden offers more reusable national discovery layers than the first CANOPUS
run:

- 1 m national ground-height data and orthophoto distribution through STAC;
- indicative national property-division and building vectors;
- national digital detailed-plan exchange, with municipality-produced records;
- an open controlled catalogue of plan provisions;
- soil, soil-depth, well, aquifer and groundwater-quality services;
- flood, landslide, erosion, quick-clay and ground-movement screening;
- protected areas, Natura 2000, water protection and shoreline law;
- archaeology with explicit position-uncertainty information;
- contaminated-land screening;
- road width, bearing class, road manager and other NVDB logistics attributes;
- electricity network development/reliability context;
- national meteorological observations and gridded analyses.

The extra availability does not make every fact open or automatic. Current
ownership, mortgages, tax, joint facilities and some other register facts are
request-based. Full servitude/right interpretation can require additional
register records and cadastral acts. Municipal plan archives and permit history
vary. Utility locations require a Ledningskollen case; utility capacity requires
separate provider responses. Design boundary, topography, geotechnical,
groundwater, radon and contamination proof remain field work.

## Evidence ladder

| Level | Typical evidence | What it can do | What it cannot do |
|---|---|---|---|
| Open national context | Lantmäteriet, SGU, SGI, MCF, Naturvårdsverket, RAÄ, Trafikverket, SMHI | Automate discovery, spatial screening and reproducible context | Prove title, entitlement, legal access, capacity or field conditions |
| Municipal planning | Governing plan, legal-force status, amendments, permit archive, municipal interpretation | Establish the controlling planning basis when the complete record is bound | Prove ownership, surveyed boundary or capacity |
| Authoritative property record | Register extract, full rights records, cadastral acts | Establish dated register facts and burdens/benefits | Convert the register-map polygon into a surveyed legal boundary |
| Field/provider proof | Survey, geotechnical/radon/environmental testing, line marking, connection responses | Supply the design and construction basis for the investigated scope | Upgrade unrelated or untested conditions |

## H30/H50 decision profile

The adapter uses the current national rule profile based on PBL changes that
took effect on 2025-12-01:

| Context | Maximum individual area | Aggregate cap | Maximum ridge height |
|---|---:|---:|---:|
| Inside detailed plan | 30 m² | 45 m² | 4.0 m |
| Outside detailed plan | 50 m² | 65 m² | 4.5 m |

These values are not a permit decision. The validator also requires a
qualifying principal building, the new building to be smaller than the building
it complements, placement within the plot, aggregate accounting for prior
permit-exempt buildings, expanded-permit and plan checks, special protection
checks, and separate notification/start-clearance review. An H30 or H50 label
cannot close the eligibility gate.

## Gate set

The 18 gates span:

1. property identity and municipal jurisdiction;
2. indicative property geometry;
3. property-register facts, rights and joint facilities;
4. design boundary/topography;
5. governing plan and current law profile;
6. H30/H50 eligibility and defensible buildable envelope;
7. terrain and ground conditions;
8. flood/geohazard and environmental restrictions;
9. culture/contamination;
10. legal access;
11. utility capacity; and
12. pre-construction clearance.

Every gate starts `OPEN`. Screening layers contribute evidence but cannot close
a higher-order gate unless the source registry explicitly allows it.

## Current-source safeguards

- The Lantmäteriet property-division vector is labelled indicative and not
  legally binding.
- NGP may omit plans begun before 2022-01-01 and may contain plans without legal
  force, so municipal records remain necessary.
- The Boverket plan-provision catalogue explains vocabulary; it does not select
  the plot's governing provision.
- SGU and SGI layers define investigation scope and cannot become bearing
  capacity, foundation design or a no-risk conclusion.
- MCF flood coverage and scenarios vary; absence from a layer is not zero risk.
- Fornsök can be outdated and positions/extents can be uncertain; unknown
  remains are possible.
- EBH presence means potential contamination, not confirmed contamination;
  absence is not a clean-land certificate.
- NVDB road proximity cannot establish legal access.
- Ledningskollen does not prove capacity and does not cover every possible line
  owner or overhead line.
- Electricity network plans are strategic context; the provider must confirm
  the plot connection.
- Shoreline protection is a legal case check, not a simple distance buffer.

## Version watch

- Lantmäteriet is transitioning property-division, provisions and rights product
  models, with old versions scheduled for withdrawal on 2026-11-30.
- SMHI Mesan2gv3 replaces Mesan2gv2, which is scheduled for withdrawal on
  2026-11-01.
- Pre-2025 Attefall summaries are rejected for current H30/H50 decisions.

## Verification

`npm run site:sweden:gate` passes:

- 496 deterministic assertions;
- 29 registered source classes;
- 18 open evidence gates; and
- 28 mutation attacks.

The attacks cover source removal, non-official endpoints, legal-boundary
promotion, NGP completeness/entitlement promotion, PBL date and threshold drift,
H30/H50 automatic eligibility, NVDB legal access, Ledningskollen capacity,
overview soil as geotechnical proof, falsely automated field work, silent gate
closure, invented external permissions, coordinate axis/range errors, evidence-
free promotion and scenario/site separation violations.

The read-only live probe returned HTTP 200 for all 19 public URLs marked
probeable. It did not retrieve a plot, submit a property-record request, contact
a municipality, create a Ledningskollen case or order work.

## Exact next intake

Provide one of:

1. municipality plus complete `fastighetsbeteckning` — preferred;
2. WGS84 longitude/latitude plus municipality;
3. address plus municipality; or
4. a listing URL that can be resolved to an official property.

Once the locator is supplied, the first executable pass should acquire only
credentialless/open discovery evidence and return the resolved identity,
indicative boundary, 1 m terrain, context, plan-index search and risk overlays.
Any property-register request, municipal contact, Ledningskollen case or field
order remains a separate permissioned action.
