# Room Twins

This directory contains canonical Spatial Studio `room-twin/v1` manifests and their deterministic Room Lab `room-scene/v1` projections.

- `marbella-living-room-v1.json` is an `ASSUMED_DESIGN_ROOM` preserving Room Lab Alpha's existing scene values.
- `canopus-deluxe-guest-room-v1.json` is a `CONCEPT_DESIGN_ROOM` limited to the 48 m² / approximate 6 × 8 m brief.
- `exports/` contains generated Room Lab scenes; they are output projections, not independent sources of spatial truth.

Validate with `npm run room:twin:gate`. See `docs/handoffs/ROOM-TWIN-CONTRACT-V1.md` for ownership, evidence and verification rules.
