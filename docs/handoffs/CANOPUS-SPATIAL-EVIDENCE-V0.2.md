# CANOPUS spatial evidence v0.2 handoff

Date: 2026-08-17

Branch: `agent/plot-to-project-spatial-studio`

Base checkpoint: `656d9aebf1ac0410df2b1382e6e82663d6f49c23`

## Outcome

The official Catastro boundary and official IGN MDT05 context terrain are now
source-bound, reproducible spatial evidence for
`SITE_CANOPUS_5410501UF2451S`. The v0.1 absence-gated contract is unchanged.
The v0.2 profile closes only `GATE_CATASTRO_BOUNDARY` and
`GATE_IGN_TERRAIN`; the other nine hard gates remain open.

This is not a planning envelope, legal access determination, survey-grade
topographic survey, verified viewshed or design fit.

## Catastro parcel finding

- Reference: `5410501UF2451S`
- Raw GML SHA-256: `159602421da4b2666c6c3361d20d632031de935ed8c6a5a91b6bc2c216a62b9a`
- Source CRS: ETRS89 / UTM zone 30N, EPSG:25830
- One polygon, one exterior ring, no holes, 123 coordinate pairs including
  closure; source clockwise order preserved
- Closed, simple and free of self-intersections
- Official area: 52,733 m²
- Computed area: 52,732.1640625 m²
- Difference: 0.8359375 m² (approximately 0.001585%)
- Bounds: `[325174.43, 4040737.67, 325502.60, 4041045.16]`
- Extents: 328.17 m east-west and 307.49 m north-south
- Centroid: `[325328.708834, 4040864.575605]`
- Maximum CRS round-trip vertex error: 0.0000165 m
- Independent Catastro reference-coordinate residual: approximately 0.106 m

The dossier's 328 m east-west extent reproduces closely. Its 312 m
north-south figure differs from the metric bounding extent by 4.51 m (about
1.45%); it remains an approximate reported comparison, not source geometry.

### Date/currentness distinction

- WFS response timestamp: `2026-08-17T17:47:31`
- `cp:beginLifespanVersion`: `2010-08-05T00:00:00`
- `cp:endLifespanVersion`: unpopulated/null
- `validFrom`: absent/null
- `validTo`: absent/null
- Survey/currentness date: not supplied and not asserted

The response timestamp is retrieval time. `beginLifespanVersion` is the start
of this feature version, not a field-survey date. Continuous database updating
does not supply parcel survey currentness.

## IGN terrain finding

- Product: MDT05 first LiDAR coverage, 5 m float32 COG
- Request bounds: `[324170, 4039735, 326505, 4042050]` in EPSG:25830
- Raw COG SHA-256: `710b8ee75ab04353c06cce8e4633992bfebb7d49ec68687e51ef8c718e791020`
- Working CRS: EPSG:25830 easting/northing metres
- Vertical reference: orthometric metres, Alicante datum realised by
  EGM2008-REDNAP
- Parcel mask: pixel centres inside the authoritative polygon,
  `all_touched=false`
- Valid parcel cells: 2,105 (52,625 m² sample footprint); no parcel-mask nodata
- Elevation: 4.000 m minimum, 14.8113 m maximum, 10.8113 m fall
- Mean elevation: 9.5432 m

The OGC collection is titled EPSG:25830, while the COG GeoKey declares
EPSG:3042, the north/east-axis form of the same ETRS89/UTM zone. Raster model
coordinates are demonstrably easting/northing. v0.2 records the discrepancy and
normalizes the numeric grid to EPSG:25830 without swapping coordinates.

### Terrain-method reconciliation

The dossier's 2.5% gradient and 80° aspect reproduce as a least-squares plane
fitted over parcel pixel centres:

- east derivative: -0.02450390 m/m
- north derivative: -0.00439589 m/m
- fitted gradient: 2.489508%
- fitted downslope aspect: 79.82957°

Local 5 m terrain is materially steeper and more variable:

- mean local cell slope: 8.2304%
- median local cell slope: 6.7766%
- 95th percentile local cell slope: 22.9817%
- slope-weighted circular mean local aspect: 61.3651°

Both measurements are preserved with their methods. Neither is coerced to the
other. The 1 m contours are a 1 m interval derived from a 5 m DEM, not a claim
of 1 m accuracy.

## Context and separation

- 14 official Catastro building features are represented.
- 107 official SCNE/IGN RoadLink features remain after context filtering.
- Three parcel-boundary/road proximity candidates have geometric gaps of about
  3.85–4.57 m. Each is `UNVERIFIED_PHYSICAL_PROXIMITY_ONLY`.
- `permitted_access_point`, `planning.entitlement` and
  `planning.buildable_envelope` remain null.
- The La Concha ray remains reported scenario intent with no verified asset.
- No concept massing is present in the evidence terrain GLB.

## Licence and distribution

Current IDEE metadata declares CC BY 4.0 for DGC Catastro data. The live WFS
capabilities also link an older, more restrictive DGC licence. v0.2 records the
conflict and follows the conservative rule: raw Catastro GML is not committed
or redistributed; only hashes and transformed value-added products are
committed, with attribution.

IGN-derived outputs use:

`Obra derivada de MDT05-cob1 2008-2015 CC-BY 4.0 scne.es`

## Principal source hashes

| Source | SHA-256 |
|---|---|
| Catastro parcel GML | `159602421da4b2666c6c3361d20d632031de935ed8c6a5a91b6bc2c216a62b9a` |
| Catastro WGS84 reference | `c7fef54ec0537ba208eea509d65d96e90738ef641e167bb464aa11b99356eb44` |
| Catastro WFS capabilities | `85bb60ee4169b0620df42d40572bcd7d83f5cf0d2a7768fd3759359dd43f7d26` |
| Catastro service metadata | `12b63b4f4428a0c35bdffc51c750158e399d66a0bd659b469b99cfd3e4b12dda` |
| Catastro dataset metadata | `95ad0ef8582aa2ed20588e71af6c64a973734f2f2c254895d827e0275e8e9ed2` |
| IGN MDT05 COG | `710b8ee75ab04353c06cce8e4633992bfebb7d49ec68687e51ef8c718e791020` |
| IGN MDT05 collection metadata | `fc279fd54d2c2fe66fbf4c4b6176e57c0027b1e52f2952cf9771b74cb6a5e6bb` |
| Catastro buildings GML | `92c37b51a003bbed72934837b56078e9981f338fe30b1ee1cc8f6ff4011ea9c5` |
| SCNE/IGN RoadLink GeoJSON | `d8713b4976aefbd671d5886c3eae5e6e532c5663ea8ec5d4495dd110c6596a1f` |

The committed manifest is the authoritative receipt and derived-file hash
index. Raw source bytes stay in the ignored runtime path.

## Verification

The aggregate gate runs the unchanged v0.1 contract (5,092 checks), its 16
mutations, v0.2 committed-bundle validation (296 assertions) and the v0.2
falsification suite (24 attacks). The strict profile adds raw byte/hash/media
signature checks and passed 336 assertions against the captured sources.

The attacks cover source/hash tampering, wrong parcel ID, CRS loss, parcel
self-intersection and editing, WGS84 axis swap, invalid dates/licences, terrain
hash/resolution/datum drift, slope/aspect method swaps, contour/section lineage,
GLB up-axis drift, invented access/planning geometry, silent gate promotion,
sightline promotion and scenario separation violations.

See `data/sites/canopus/spatial/README.md` for exact reproduction commands.
