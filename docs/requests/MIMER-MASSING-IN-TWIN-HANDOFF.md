# Handoff → Spatial: MIMER house massing in the interactive twin

**From:** MIMER Svärtinge project session · **To:** Spatial Studio session · **Date:** 2026-08-19
**Status:** REQUEST — MIMER supplies the design intent + data; Spatial owns the viewer geometry. No duplication.

## Ask
Place the MIMER concept house as massing in the interactive Svärtinge twin (the three.js/Mapbox scene), reading the design intent below. MIMER produced a still section + a matplotlib massing only; the *interactive* massing is Spatial's lane.

## Design intent (source of truth)
All parameters in [`data/sites/sweden/saterdalsvagen-14/mimer/house-concept-v0.1.json`](../../data/sites/sweden/saterdalsvagen-14/mimer/house-concept-v0.1.json):
- Typology: souterräng 1.5-plan; **long axis NW–SE along the contour**, cut against the NE bank, opening SW.
- Footprint ~15 × 9 m; centred on the building shelf ~11 m downslope (az 207°) of the listing pin.
- Level datums (CONCEPT, RH2000): terrace 66.3 · lower FF 66.8 · upper FF 69.7.
- Mono-pitch roof high-NE → low-SW (the SW PV plane).
- Orientation faces the measured Glan axis (see `terrain-dem-derived-v0.1.json` glan_sightline_profile) + SW sun (see `mimer/sun-study-v0.1.json`).

## Truth constraints
Label the massing **CONCEPT** on **DERIVED** terrain; `GATE_SE_TERRAIN` open. Do not present finished-floor levels as surveyed. Boundary is the indicative municipal trace, not a survey.

## Not requested
MIMER is not asking Spatial to redo the analysis — only to render the massing. Analysis stays in `mimer/`.
