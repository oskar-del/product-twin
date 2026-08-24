# CANOPUS Site Twin v0.1

The official boundary/terrain promotion is documented under
`data/sites/canopus/spatial/README.md`; the original v0.1 evidence-only records
remain unchanged.

This directory is an evidence-first seed for parcel `5410501UF2451S`. It separates:

- `PRJ_CANOPUS`: the project/deal and its seller brief and underwriting assumptions;
- `SITE_CANOPUS_5410501UF2451S`: reported parcel and analysis evidence, with raw geometry gated;
- `SCN_LA_CONCHA_GARDENS_2026_08`: a concept-only hotel design scenario.

Run:

```bash
npm run site:canopus:validate
npm run site:canopus:validate:test
```

The validator executes the authored JSON Schemas at runtime, including version constants, required properties, type constraints, external assertion references and `additionalProperties: false`. Domain-specific gates and arithmetic checks then run on top.

## Next reproducible official-source import

1. Request the parcel from the official Catastro INSPIRE/OVC service using cadastral reference `5410501UF2451S`. Save the unmodified response, request URL/parameters, response metadata, retrieval time and SHA-256 under `.runtime/sites/canopus/raw/catastro/<date>/`.
2. Read the CRS from the response metadata. Do not hardcode coordinates or a CRS from the rendered PDFs. Validate parcel identity, polygon validity and official area before transforming it to a local metric working CRS.
3. Derive a GeoJSON copy and compare its geodesic/projected area with the reported `52,733 m2`. Stop on unexplained mismatch; do not force the polygon to fit the reported value.
4. Use the verified polygon plus a documented context buffer to obtain the applicable official IGN MDT05/LiDAR-derived terrain source. Preserve tile identifiers, acquisition date, licence, CRS, vertical datum and SHA-256 under `.runtime/sites/canopus/raw/ign/<date>/`.
5. Clip and derive terrain statistics, 1 m contours and a lightweight display mesh reproducibly. Compare, but do not coerce, the results to the reported `4-15 m`, `11 m` fall, `2.5%` mean gradient and `80 degrees` aspect.
6. Promote the evidence state only in a schema-versioned change after the source hashes, commands, outputs and QA are present. Keep heavy raw raster/LiDAR files out of Git.

The illustrated parcel and masterplan pages are visual references only. They are not acceptable geometry sources.
