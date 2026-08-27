# Design Selector Mount Contract — Platform Review

**Reviewer:** Platform & 3D Engine session  
**Document reviewed:** `docs/DESIGN-SELECTOR-MOUNT-CONTRACT.md` on `agent/spatial-studio-claude` (DRAFT)  
**Cross-checked against:** BRAGE `house-v0.2-geometry-spec.json` on `agent/brage-design`  
**Date:** 2026-08-27  
**Verdict:** APPROVE with 6 required changes (below). Freeze after these; Spatial implements `mountDesign`/`clearDesign`.

---

## What works (no changes needed)

- **Mount stage = Stage 4 `CONCEPT_HOUSE_ON_PLOT`.** Correct — the camera already frames the plot.
- **`mountDesign(spec)` / `clearDesign()` as the API shape.** Platform agrees: the selector passes the object in, no cross-checkout import. This is the right split.
- **Evidence class forced to CONCEPT.** Correct. The engine enforces 5 evidence classes; CONCEPT is one. Nothing mounted may claim AUTHORITATIVE/INDICATIVE/DERIVED.
- **`groundY(x,z)` for terrain draping with one rigid-body offset for the shell.** Correct — same approach the current viewer uses.
- **Plot-boundary envelope warning (warn, don't clip).** Correct — the boundary is INDICATIVE (and now moving to AUTHORITATIVE with LM data, but the principle holds).
- **No legal/entitlement/FFL claim text.** Correct.

## Required changes (6)

### R1. Type vocabulary mismatch — the contract says types the spec doesn't use

The contract says the concept house is `type ∈ {CONCEPT_BUILDING, ROOM, OPENING, FURNITURE}`. BRAGE's v0.2 spec uses different types: `CONCEPT_BUILDING_MASS`, `SERVICE_CORE`, `INTERIOR_WALL`, `OUTDOOR_DECK`, `WINDBREAK`, `OPTIONAL_OUTBUILDING`.

Neither side is wrong — they just haven't met.

**Resolution:** The mount contract should not enumerate types. Replace the type whitelist with: "All mounted elements must have `evidence_class: CONCEPT`. The engine renders any element type that maps to a known primitive. The selector must not touch elements whose type is `TERRAIN`, `PLOT`, `ROAD`, `CONTEXT_BUILDING`, `POI`, `VIEW_DIRECTION`, or `ANCHOR`." This is a *deny-list* on what NOT to touch, not a *permit-list* on what to add.

BRAGE: map your types to engine primitives. `CONCEPT_BUILDING_MASS` → the engine's `BOX` builder handles it. `INTERIOR_WALL` → `BOX`. `SERVICE_CORE` → `BOX`. `ROOM` → `ROOM_VOLUME`. `OUTDOOR_DECK` → `EXTRUDED_POLYGON`. `WINDBREAK` / `SCREEN_L` → see R3.

### R2. Coordinate frame conflict — relative-to-anchor vs scene-absolute

The mount contract says: "Positions are relative to `anchor_local` (selector adds the anchor + terrain drape)."

BRAGE's spec says: "Same frame as neighbourhood-scene-v0.2.json so Platform can drop these elements straight into the scene graph." Its positions are scene-absolute.

These are contradictory. If we keep anchor-relative (the contract's proposal), BRAGE must subtract the anchor from every position. If we go scene-absolute (BRAGE's assumption), the selector does no translation and terrain draping is per-element, which breaks the rigid-body drape promise.

**Resolution:** Use anchor-relative. Reasons:
1. Designs should be reusable across plots (same design on plot A or B, different anchor).
2. The rigid-body terrain drape requires a single reference point.
3. Scene-absolute couples the spec to a specific scene version.

BRAGE: translate all element positions by subtracting the anchor. The anchor is the house's plan origin — `[1, 0, 1]` or whatever Spatial declares. Most of your elements already use small coordinates near the origin, so this is likely already approximately right; confirm the anchor value with Spatial.

### R3. Unknown primitives — BRAGE uses shapes the engine doesn't have

BRAGE's `VINDFICKA_SW` uses `primitive: "SCREEN_L"` — a segmented vertical screen. The engine has 9 primitives; `SCREEN_L` is not one of them.

BRAGE's `HOUSE_BAR` and `HOUSE_WING_N` use `footprint_xz` + `wall_height_m` instead of the engine's `BOX` primitive (`position` + `size`). This is a different representation of the same thing.

**Resolution:**
- `SCREEN_L` → approximate as a thin `EXTRUDED_POLYGON` (or two `BOX` walls). If the design selector needs a real screen primitive, Platform adds it to the engine — file the request. Don't block the A/B/C swap on it.
- `footprint_xz` + `wall_height_m` → convert to `EXTRUDED_POLYGON` (the engine already renders these). The selector does the conversion: `points_xz = footprint_xz`, `height = wall_height_m`, `base_y = 0` (anchor-relative, before terrain drape). This is strictly more correct than `BOX` anyway — a footprint polygon captures L-plans.

### R4. Invalid evidence class `CONCEPT_OPTIONAL`

BRAGE's `OPT_SAUNA_POD` uses `evidence_class: "CONCEPT_OPTIONAL"`. The engine enforces exactly 5 classes: `AUTHORITATIVE`, `INDICATIVE`, `DERIVED`, `REPORTED_UNVERIFIED`, `CONCEPT`. `CONCEPT_OPTIONAL` is not one.

**Resolution:** Use `evidence_class: "CONCEPT"` and express optionality in a field like `optional: true` or in the element's `limitations`. The engine will not add a sixth evidence class for one sauna pod.

### R5. EXTRUDED_POLYGON geometry fields don't match the contract

BRAGE's `TERRACE_SOUTH` uses `thickness_m` and `top_Y`. The engine's `EXTRUDED_POLYGON` expects `height` and `base_y`.

**Resolution:** The spec must use the engine's field names: `height` (= `thickness_m`), `base_y` (= `top_Y - thickness_m`, anchor-relative). The mount contract should state: "All element geometries must use the engine's primitive schemas exactly. See `engine/core/scene-contract.mjs` for the per-primitive rules."

### R6. `anchor_local` spec — add the actual anchor value

The mount contract shows `"anchor_local": [1, "<groundY(1,1)>", 1]` — a placeholder. To freeze the contract, the anchor must be a real coordinate, confirmed with BRAGE (it defines the house plan origin) and Spatial (it exposes the mount point).

**Resolution:** Spatial fills in the real anchor from the current scene's concept house position. BRAGE confirms their plan's [0,0,0] maps to that anchor. Document it; don't leave it as a template.

## Answers to the 4 open items

1. **Exact A/B/C spec JSON:** Use the mount contract's proposed shape with the fixes above. Add `footprint_xz` as an alternative to `position`+`size` for building masses (engine renders both as `EXTRUDED_POLYGON`). Platform will write a `designSpecToElements(spec, anchor, groundY)` adapter that normalises the spec into engine elements — neither BRAGE nor Spatial needs to know the engine's internal types.

2. **`rotation_y_deg` — per-design or inherited?** Per-design. BRAGE's spec already carries `rotation_y_deg` on several elements. The anchor's `rotation_y_deg` is added as a base rotation; the element's is relative to that.

3. **Room/opening/furniture detail:** Shell-only first. The mount contract should state: "v0.1 mounts building masses only; room/opening/furniture detail is a later addition." BRAGE's ROOM element is ready; openings and furniture are not in the v0.2 spec. Don't block on them.

4. **Transport:** `mountDesign(spec)` with the object passed in. Confirmed — both sides agree. The selector fetches or receives specs from wherever the product decides; the viewer's API is `mountDesign(spec)`.

## What Platform will build (after freeze)

- `engine/ui/design-selector.mjs` — the selector UI (A/B/C buttons or cards), calling `mountDesign(spec)` on Spatial's viewer.
- `designSpecToElements(spec, anchor, groundY)` — the adapter from BRAGE's spec shape to engine elements, handling coordinate translation, primitive normalisation, and evidence-class enforcement.
- Gate check: mounted elements pass `parseScene()`, all `CONCEPT`, no id collisions with non-concept elements.

## After freeze

Spatial implements `mountDesign(spec)` / `clearDesign()` per the frozen contract. Platform builds the adapter and selector UI. BRAGE adjusts v0.3 to use anchor-relative coordinates and engine-compatible field names. All three sessions can work in parallel from that point.
