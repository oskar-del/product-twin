# Attach-point / layering schema (twin manifest `attach` block)

The product's edge: a scene composes as **base objects exposing slots** + **attach
items that snap into those slots**. This is additive to `schema_version 0.4.x` — twins
without an `attach` block are simply not yet classified (no breaking change).

## `attach.role`

- `"base"` — a floor-standing or wall/ceiling-mounted piece that exposes zero or more
  named slots for other twins to attach to. Bucket `FURNITURE` and floor/wall/table
  `LIGHTING` are bases.
- `"attach"` — a piece that has no slots of its own and instead declares where it
  attaches to a base. Bucket `DECOR` (cushion, throw, vase, candle, book, plant,
  fragrance, art, mirror, rug) is attach.
- `"free"` — stands alone, doesn't attach and doesn't expose slots (e.g. rugs sit on
  the floor, not truly "attached" to anything — treated as its own base with a
  `floor` slot type of one, see below). Default for anything unclassified.

## `attach.slots` (present when `role: "base"`)

Array of slot objects a base exposes:

```json
{ "slot_id": "seat_back_left", "type": "pillow", "capacity": 2 }
```

- `slot_id` — stable string, unique within the twin.
- `type` — the attach-item category the slot accepts: `pillow` | `throw` | `centerpiece`
  | `rug` | `vignette` | `plant` | `candle`.
- `capacity` — how many attach-items of that type the slot can hold at once (most are 1;
  a sofa back can hold multiple pillows).

Category → default slot template (used by the annotation script, category_id prefix match):

| category_id prefix | slots |
|---|---|
| `FFE.SEATING.SOFA` | `seat_back` (pillow, capacity 3), `seat` (throw, capacity 1) |
| `FFE.SEATING.ARMCHAIR`, `FFE.SEATING.CHAIR` | `seat_back` (pillow, capacity 1), `seat` (throw, capacity 1) |
| `FFE.TABLE.COFFEE`, `FFE.TABLE.SIDE` | `top` (centerpiece, capacity 1) |
| `FFE.TABLE.DINING` | `top` (centerpiece, capacity 1) |
| `FFE.STORAGE.SHELVING`, `FFE.STORAGE.BOOKCASE`, `FFE.STORAGE` (console-like) | `surface` (vignette, capacity 3) |
| any `FURNITURE` floor-standing piece | `floor_footprint` (rug, capacity 1) — the piece can sit *on* a rug base; modelled as the piece declaring an `attach_as: rug_anchor` reference, not a slot it owns |

## `attach.attach_as` (present when `role: "attach"`)

```json
{ "accepts_slot_type": "pillow", "footprint_mm": { "width": 450, "depth": 450, "height": 450 } }
```

- `accepts_slot_type` — which base slot `type` this item can occupy. Derived from
  `category_id`: `FFE.TEXTILES.CUSHION` → `pillow`, `FFE.TEXTILES.THROW`/`FFE.TEXTILES` →
  `throw`, `FFE.DECOR.VASE`/`FFE.DECOR.PLANT` → `centerpiece`, `FFE.TEXTILES.RUG` → `rug`
  (rugs attach to the *room floor*, not a slot on another twin — `accepts_slot_type: "rug"`
  with no base parent required), `FFE.DECOR.CANDLE`/`FFE.DECOR.BOOK`/`FFE.DECOR.FRAGRANCE`
  → `vignette`.
- `footprint_mm` — approximate bounding box for placement math; pulled from
  `physical.dimensions_mm` when present, else a category default (never a fabricated
  exact-manufacturer size — same G2 honesty rule as geometry).

## Scene composition (consumer-facing, Platform renders)

A scene is a flat list of `{ twin_id, slot_id? }` pairs:

```json
{
  "scene_id": "SCENE_EXAMPLE_SOFA_STYLED",
  "items": [
    { "twin_id": "PT_NEWPORT_47214" },
    { "twin_id": "PT_NEWPORT_101832", "attach_to": "PT_NEWPORT_47214", "slot_id": "seat_back" },
    { "twin_id": "PT_NEWPORT_95561",  "attach_to": "PT_NEWPORT_47214", "slot_id": "seat_back" },
    { "twin_id": "PT_NEWPORT_67134" },
    { "twin_id": "PT_NEWPORT_98646",  "attach_to": "PT_NEWPORT_67134", "slot_id": "top" },
    { "twin_id": "PT_NEWPORT_101561" }
  ]
}
```

Validation (`scripts/validate-scene.mjs`): every `attach_to` twin must exist, expose a
slot named `slot_id`, that slot's `type` must equal the attaching item's
`accepts_slot_type`, and per-slot `capacity` must not be exceeded. A twin with no
`attach_to` is placed free-standing (sofa, coffee table, rug — rugs are free/floor
items in this model, not attached to anything).
