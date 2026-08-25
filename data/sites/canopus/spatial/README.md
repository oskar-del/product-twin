# CANOPUS spatial evidence

`v0.2/` is the first stage-aware promotion of the CANOPUS Site Twin. It keeps
the v0.1 absence-gated record unchanged and closes only two hard gates:

- the exact official Catastro parcel boundary for `5410501UF2451S`;
- official IGN MDT05 context terrain bound to that parcel hash.

The other nine hard gates remain open. Road proximity candidates are analysis
overlays only. They do not establish a permitted access point. No planning
entitlement or buildable envelope is present, and no concept massing has been
used to redefine the site.

## Evidence lifecycle

Raw official responses are immutable runtime inputs under
`.runtime/sites/canopus/raw/` and are ignored by Git. The committed manifest
records each exact request, retrieval time, authority, dataset, licence, byte
count, SHA-256, runtime locator and replay command. Transformed evidence is
committed with its input hashes, pinned toolchain and deterministic hash.

```text
npm run site:canopus:spatial:fetch
/path/to/python3.12.13 -m venv .runtime/sites/canopus/venv
.runtime/sites/canopus/venv/bin/pip install -r config/site/requirements-spatial-v0.2.txt
npm run site:canopus:spatial:build
npm run site:canopus:source:validate
npm run site:canopus:gate
```

The fetcher will not overwrite an existing raw response. Compare hashes and
capture a new receipt before deliberately accepting changed official bytes.
It also writes `fetch-receipts.json`; the builder verifies that receipt against
every input and uses its actual retrieval/HTTP metadata rather than guessing.
The committed derivation was run with Python 3.12.13, NumPy 2.3.5 and Pillow
12.3.0; the builder fails closed on any toolchain drift.

## Coordinate and terrain contract

- Raw parcel coordinates remain in their official order and CRS.
- Canonical projected data is EPSG:25830, easting/northing metres.
- RFC 7946 web data is WGS84 longitude/latitude.
- The IGN coverage collection is labelled EPSG:25830, while the returned COG
  declares EPSG:3042 (the north/east-axis form of the same ETRS89/UTM zone).
  The numeric raster model is demonstrably easting/northing; the bundle records
  this discrepancy and normalizes it without swapping coordinates.
- Heights are orthometric, Alicante datum realised by EGM2008-REDNAP.
- The 1 m contours are a contour interval derived from a 5 m DEM; they do not
  claim 1 m accuracy.
- The dossier's 2.5%/80° pair reproduces as a fitted whole-parcel trend plane.
  Local 5 m terrain remains separate: its mean cell slope is about 8.23% and
  its slope-weighted circular aspect is about 61.37°.

The terrain mesh uses metres, a local EPSG:25830 origin, `+X` east, `+Y` up and
`-Z` north. It contains only terrain evidence and no scenario massing.
