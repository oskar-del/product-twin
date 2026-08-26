# BRAGE brief — three real concept designs for Svärtinge 54:28

Produce **three** house designs (A / B / C) for the plot **Svärtinge 54:28**, Norrköping,
each as a JSON object matching the `mountDesign(spec)` contract in
`DESIGN-SELECTOR-MOUNT-CONTRACT.md`. They replace the placeholder designs in the twin's
concept studio with zero code changes — the studio already renders whatever you emit here.

## The land the designs MUST respond to (measured, authoritative 1 m DTM)
- **Slope / aspect:** ~13° falling to the **south-west**
- **View:** the ground falls **~43 m over 800 m** toward **Lake Glan** (SW) — the value asset
- **Elevation at the plot pin:** ~70 m RH2000
- **Orientation:** south / south-west is both the downhill and the view/sun direction

"Know the land before designing" is the whole pitch — every design's `summary` must name
*why* its massing suits this slope/aspect/view, not generic prose.

## Output shape (emit exactly this — one object per design)
```json
{
  "id": "A",
  "lang": "LÅNGHUS",                 // short typology label, uppercase
  "name": "Long house along the slope",
  "summary": "Why this form fits THIS land (slope 13° SW, 43 m Glan fall, sun).",
  "footprint": 112,                   // m², ground-floor coverage
  "storeys": 1,
  "gfa": 112,                         // m², total gross floor area
  "boxes": [                          // massing volumes, metres, relative to plot pin
    { "p": [0, 0, -1], "s": [16, 3.2, 7], "roof": "gable" }
  ]
}
```

### Field rules
- `boxes[].p` = `[x, y, z]` metre offset from the plot pin. `+x` = east, `+z` = south,
  `y` = vertical (use `y` to step volumes for split-levels on the SW fall).
- `boxes[].s` = `[width, height, depth]` in metres. Storey height ≈ 3.0–3.2 m.
- `roof` = `"gable"` or `"flat"`.
- Keep total footprint realistic for a single-family plot (≈ 90–130 m²).
- Give the three designs genuinely different strategies for the SW slope + Glan view
  (e.g. low ridge-parallel long house · two-storey lifting living space to the view ·
  split-level tracking the gradient). No fabricated setbacks, FFL, or entitlement claims —
  massing studies only.

## Deliver
Three JSON objects (ids `A`, `B`, `C`), or a JSON array of them. Paste them back and they
drop straight into `DESIGNS[]` in
`prototype/svartinge-neighbourhood/index.html`, replacing the placeholders.
