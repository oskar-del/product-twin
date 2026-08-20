# Design Selector — Stage 4 mount-point contract (v0.1)

Interface between the **Spatial Studio viewer** (this workstream) and the **Design Selector module** (Platform, consuming BRAGE's A/B/C specs). Spatial Studio owns the mount point and the swap hook; Platform owns the selector UI and the spec→scene mapping. Neither side hard-codes the other's internals.

## Where it mounts

Stage 4 `CONCEPT_HOUSE_ON_PLOT` ("Concept house on plot") is the mount stage. Its camera already frames the plot at the house anchor.

The current concept house is the set of scene elements with `type ∈ {CONCEPT_BUILDING, ROOM, OPENING, FURNITURE}` (ids `HOUSE_*`, `ROOM_*`, `WINDOW_*`, `DOOR_*`, `*_CONCEPT`). The selector **replaces this set** with the chosen design; it must not touch TERRAIN / PLOT / ROAD / CONTEXT_BUILDING / POI / VIEW_DIRECTION / ANCHOR elements.

## Mount anchor (viewer → selector)

The viewer exposes, at build time and at runtime, the plot mount anchor in the scene's local ENU frame (x=EAST, y=UP, z=NORTH, metres; origin = municipal pin):

```json
{
  "anchor_local": [1, "<groundY(1,1)>", 1],   // house centre on the plot; y is the real terrain height (RH2000-minus-pin)
  "rotation_y_deg": 0,                          // current concept orientation; selector may override per design
  "ground_reference": "RH2000_MINUS_LOCATOR_DATUM",
  "plot_element_id": "PLOT_54_28",              // INDICATIVE trace (boundary NOT authoritative yet)
  "terrain_element_id": "TERRAIN_CONTEXT",      // AUTHORITATIVE 1 m DTM; use groundY(x,z) to drape
  "view_axis_ref": "VIEW_GLAN"                  // reported (unverified) Glan direction, az 185°, for orientation cues
}
```

`groundY(x,z)` (already in the viewer) bilinearly samples the authoritative terrain heightfield; the selector must drape every placed design element by `groundY` at its plan position, sharing **one offset for the rigid building shell** (as the current `drapeOnTerrain`/`houseOffset` does) so designs don't distort on the slope.

## A/B/C spec shape (BRAGE → selector → viewer)

Each design option is a self-contained concept geometry bundle. Proposed minimum shape (Platform/BRAGE to confirm):

```json
{
  "option_id": "A|B|C",
  "label": "…",
  "evidence_class": "CONCEPT",                  // MUST stay CONCEPT — the selector promotes nothing
  "rotation_y_deg": 0,
  "elements": [ { "id": "…", "type": "CONCEPT_BUILDING|ROOM|OPENING|FURNITURE",
                  "geometry": { "primitive": "BOX|ROOM_VOLUME", "position": [x,y,z], "size": [w,h,d], "rotation_y_deg": 0 },
                  "source_refs": ["BRAGE_SPEC_<option>"], "limitations": ["Concept geometry only; no entitlement/setback/FFL claim."] } ]
}
```

Positions are relative to `anchor_local` (selector adds the anchor + terrain drape). Openings intended for the Glan view should reference `VIEW_GLAN`.

## Swap hook (selector → viewer)

Spatial Studio will expose (to be implemented when Platform's spec is frozen):

- `mountDesign(spec)` — remove current CONCEPT_* geometry, instantiate `spec.elements` at the anchor with terrain draping, keep evidence banner + INTELLIGENCE/COMPARE intact.
- `clearDesign()` — restore the default concept house.

Constraints the viewer will enforce on any mounted design:
- evidence_class forced to `CONCEPT`; no mounted element may set AUTHORITATIVE/INDICATIVE/DERIVED.
- geometry stays within the plot's indicative footprint envelope (warn, don't silently clip) — the boundary is not yet authoritative, so this is guidance not compliance.
- no legal/entitlement/FFL claim text; the "LEGAL GATES OPEN" banner remains.

## Open items to confirm with Platform / BRAGE
1. Exact A/B/C spec JSON (fields above are a proposal).
2. Whether designs carry their own `rotation_y_deg` (e.g. oriented to Glan/sun) or inherit the anchor's.
3. Whether room/opening/furniture detail is in-spec now or added later (viewer can mount shell-only first).
4. Transport: does the selector fetch specs, or does Platform inject them into the viewer? (Spatial Studio prefers `mountDesign(spec)` with the object passed in — no cross-checkout import.)

Status: **DRAFT for Platform review.** Spatial Studio has NOT built the selector; this defines the seam so Platform can. When the spec is frozen, Spatial Studio implements `mountDesign`/`clearDesign` and the Stage 4 wiring.
