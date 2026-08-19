# CANOPUS Site Twin - persistent Work chat handoff

## Purpose of the chat

Use a long-lived Work chat as the CANOPUS plot, terrain, climate, planning and 3D-mapping workstream inside the shared Product Twin / House intelligence repository. The chat should keep the land model evidence-first, explain progress while working, and make changes only in its dedicated worktree/branch until an integration review.

The objective is not to redraw the hotel presentation. It is to build a traceable Site Twin that can later support:

- verified terrain and access analysis;
- seasonal sun, shade and view optimisation;
- planning-envelope tests;
- survey-aligned LA CONCHA GARDENS concept options;
- room, window, garden and Product Twin decisions tied to the real plot.

## Repository boundary

- Repository: `product-twin`
- Branch: `agent/canopus-site-twin-v0`
- Worktree: `/workspace/worktrees/canopus-site-twin`
- Base used for this slice: `81b6662`
- Do not edit the dirty `/workspace/product-twin` working tree from this chat.
- Do not merge, commit, push or deploy without the coordinating chat's instruction.

## Reviewed source set

The following four PDFs were reviewed page by page on 2026-08-17:

1. `CANOPUS - Land Report.pdf` - 5 pages.
2. `LA CONCHA GARDENS - Master Presentation.pdf` - 18 pages.
3. `LA CONCHA GARDENS - THE STUDY.pdf` - 25 pages.
4. `CANOPUS - Benchmark.pdf` - 4 pages.

Their stable names, SHA-256 hashes, page counts and document dates are recorded in `data/sites/canopus/evidence-sources-v0.1.json`. The PDFs report evidence derived from Catastro, IGN, EU-DEM, PNOA and other sources, but none of the underlying machine-readable official artefacts is present in the repository yet.

`official_source_reported` therefore means that the dossier identifies an official source. It does not mean this implementation independently re-fetched that source.

## Entity model

### Project - `PRJ_CANOPUS`

Contains the internal project identity, location label, seller asking price, unverified seller programme and unverified underwriting outputs.

The following remain seller-stated:

- hotel/tertiary use;
- `32,000 m2` buildable area;
- 250 hotel keys;
- four storeys;
- `9,000 m2` commercial area;
- EUR 35 million asking price.

### Site Twin - `SITE_CANOPUS_5410501UF2451S`

Contains the reported cadastral identity, surface, cadastral class/use, extent summaries, terrain summaries, solar calculations, view calculations and physical road context.

It intentionally contains no boundary polygon, vertices, centroid, CRS, DEM, terrain mesh, permitted entrance, planning entitlement or buildable envelope.

### Design Scenario - `SCN_LA_CONCHA_GARDENS_2026_08`

Contains the LA CONCHA GARDENS concept programme and rules. It is explicitly `CONCEPT_ONLY` and `NOT_ASSESSED_ENTITLEMENT_GATED`.

Key concept assertions include:

- a 165 m water axis on a reported 349.4-degree bearing;
- low northern courtyard edges and height accumulating south;
- northern-tip arrival intent;
- southern public paseo;
- approximately 50% green-site target;
- `9,000 m2` public-realm target;
- reported revised massing area of `29,680 m2`.

The design scenario has no machine-readable model and no survey alignment.

## Evidence rules

Every domain assertion stores:

- value and unit;
- evidence class;
- PDF document, page, section and authority;
- method;
- as-of date;
- verification status and explanation;
- confidence and limitations.

The validator enforces compatible evidence and verification states. It also protects important semantic boundaries:

- `9,000 m2 commercial` remains a seller statement.
- `9,000 m2 public realm` remains a separate concept assertion.
- The mountain bearing is stored as `349.4 degrees`, not the presentation's looser phrase "due north".
- The sea-view conclusion remains conditional on missing obstruction geometry and unverified permitted height.
- RUSTICA/Agrario is a reported cadastral record, not a planning classification decision.

## Open hard gates

The Site Twin contains 11 machine-readable hard gates:

1. official Catastro boundary response;
2. official IGN terrain source and vertical datum;
3. north/south context obstruction surface;
4. current certificado urbanistico;
5. governing planning instrument at licence date;
6. A-7 building line and access determination;
7. authority-confirmed entrance;
8. rooftop/cornice rules;
9. nota simple and charges;
10. SNCZI flood and sectoral/environmental overlays;
11. utility connection capacity.

These gates block the corresponding geometry, compliance and investment claims. They must not be closed by interpretation of the PDF artwork.

## Files implemented

Schemas:

- `config/site/evidence-assertion.schema.json`
- `config/site/evidence-source-manifest.schema.json`
- `config/site/project.schema.json`
- `config/site/site-twin.schema.json`
- `config/site/design-scenario.schema.json`

Datasets:

- `data/sites/canopus/evidence-sources-v0.1.json`
- `data/sites/canopus/project-v0.1.json`
- `data/sites/canopus/site-twin-v0.1.json`
- `data/sites/canopus/design-scenarios/la-concha-gardens-v0.1.json`
- `data/sites/canopus/README.md`

Validation:

- `scripts/validate-canopus-site-twin.mjs`
- `scripts/test-canopus-site-twin.mjs`
- `npm run site:canopus:validate`
- `npm run site:canopus:validate:test`

At the publication-review checkpoint, 5,092 deterministic schema, evidence and integrity checks pass across 72 assertions and 11 hard gates. Sixteen mutation tests prove that fabricated boundary geometry, CRS, DEM, access and entitlement are rejected, together with WKT/vertex bypasses, assertion-level geometry, unknown schema versions and unknown fields. The authored JSON Schemas are executed at runtime, including external assertion references and `additionalProperties: false`.

## First official-source import

The first implementation task after this checkpoint is the Catastro/IGN land base, not hotel massing:

1. Re-fetch the official Catastro INSPIRE/OVC record for `5410501UF2451S`.
2. Store the raw response and complete request/retrieval provenance under `.runtime/sites/canopus/raw/catastro/<date>/`.
3. Read and preserve the source CRS; validate parcel identity and polygon validity.
4. Derive metric and WGS84 copies without altering the official vertices. Compare the polygon area with the reported `52,733 m2` and stop on unexplained mismatch.
5. Fetch the applicable official IGN MDT05/LiDAR-derived terrain source for the verified polygon plus a documented buffer.
6. Preserve source tile IDs, dates, licence, CRS, vertical datum and hashes under `.runtime/sites/canopus/raw/ign/<date>/`.
7. Generate clipped terrain, 1 m contours, summary metrics and a lightweight display mesh reproducibly.
8. Version the schema/data promotion only after replayable QA passes. Do not commit heavy raw source binaries.

If the previous Claude/API work already contains the original GML, DEM, GeoJSON or command logs, import and hash those artefacts first rather than re-digitising any PDF image.

## Next three design/mapping prompts

### Prompt 1 - authoritative parcel base

> Continue CANOPUS Site Twin in `/workspace/worktrees/canopus-site-twin`. Import the official Catastro parcel response for `5410501UF2451S` with full request provenance and hashes. Validate polygon identity, CRS, geometry and area against the reported 52,733 m2. Do not import a screenshot-traced boundary. Keep any mismatch open and explained.

### Prompt 2 - reproducible terrain twin

> Using only the verified parcel polygon, import the applicable official IGN MDT05/LiDAR terrain source with CRS and vertical datum. Clip it with a documented context buffer, reproduce elevation/slope/aspect summaries, generate 1 m contours and a lightweight terrain GLB, and show which PDF-era values reproduce or differ. Do not coerce the terrain to 4-15 m or 2.5%.

### Prompt 3 - evidence-aware Land Lab

> Build the first CANOPUS Land Lab view from the verified boundary and terrain: true north, parcel outline, 1 m contours, spot levels, A-A section, 349.4-degree La Concha ray and seasonal sun controls. Add LA CONCHA GARDENS only as a switchable concept layer with visible evidence labels. Keep planning envelope, access permission and sea/mountain visibility marked unresolved until their hard gates close.

## Do-not-claim boundaries

Until the relevant gates close, the chat and UI must not claim:

- exact parcel coordinates, vertices, centroid or CRS;
- authoritative terrain geometry, survey levels or vertical datum;
- a lawful entrance at the northern tip or from the A-7;
- hotel/tertiary entitlement, 32,000 m2 buildability, 250 keys or four-storey permission;
- a planning-compliant southern paseo or rooftop terrace;
- guaranteed mountain visibility or absence of sea view;
- flood, environmental, title, easement or utility clearance;
- that the illustrated masterplan is dimensionally or survey aligned;
- that the 9,000 m2 seller commercial allowance and 9,000 m2 public-realm concept are interchangeable;
- that a cadastral RUSTICA/Agrario record alone proves the parcel's planning status.

The safe current description is: **a source-bound evidence model of the reported parcel and design study, ready for official geometry intake, not yet a legal survey, planning certificate or compliant hotel BIM.**
