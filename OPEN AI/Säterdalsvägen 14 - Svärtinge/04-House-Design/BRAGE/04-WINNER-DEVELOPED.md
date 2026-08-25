# 04 · Develop — "Vinkelhuset mot Glan" (house v0.2 concept)

Everything here is `CONCEPT`. Coordinates in scene-v0.2 metres (South/lake = −Z, East = +X). Geometry is machine-encoded in [`geometry/house-v0.2-geometry-spec.json`](geometry/house-v0.2-geometry-spec.json).

## Parti — one diagram
```
              N  (Säterdalsvägen / access)  +Z
        ┌──────────────┐ GARAGE + entry court
        │   N WING     │  (cold volume, screens NE/E wind)
        │  garage/util │
   ┌────┤◼ HEART ├─────┘        ◼ = prefab wet-service core
   │    │   (hinge)   │            at the L hinge = shortest runs
   │ BAR (heated, E–W along south frontage) │
   │ living/kitchen/dining ── main bed ─────│
   └───────┬───────────────────────┬────────┘
   glass   │   S G L A S S   F A C E        │
  west  ▓▓▓│                                │
 view-room ▓  T E R R A C E  (kvällssol)    │
  (splay)  ▓▓▒ vindficka windbreak (SW)
        open to WNW evening sun ↖      ↓ S view to Glan (az 185°)  −Z
```
- **Bar** runs E–W on the south edge → maximal lake view + winter sun + a solar-ready south roof plane.
- **West end left open** → low WNW summer-evening sun reaches the terrace (the hours that get used).
- **North wing** (cold garage/utility) steps off the **east** end → shortens the heated envelope, forms the arrival court, screens NE/E wind — and keeps the west clear for that evening sun.
- **Vindficka**: a built glazed windbreak + planting turns the SW terrace corner into a sheltered suntrap without adding heated floor (SW gust solved, W sun kept).
- **House Heart** sits at the hinge of bar and wing → kitchen, main bath, WC/laundry and the wing all cluster on one prefab wet core (systems truth-law: short, checkable runs → BoM).

## Level program

**Ground (main level) — the whole life of the house on one floor (resale + aging-in-place):**
| Zone | Approx footprint | Placement logic |
|---|---|---|
| Living + west view-room | X[−11,−4], Z[−4,+3] | SW corner = view **and** evening sun; the one gesture (below) |
| Dining / kitchen | X[−4,+2], Z[−4,+3] | south glass, served by Heart to the north |
| House Heart (wet core) | X[+2.5,+5.5], Z[+0.5,+3.5] | central hinge; feeds kitchen, main bath, wing laundry/WC |
| Main bedroom + ensuite | X[+5,+9], Z[−4,+3] | quiet east end, morning light, buffered by wing |
| Entry / hall + WC + laundry | X[+3,+6], Z[+3,+9] | north wing, off the arrival court |
| Garage (double) | X[+6,+11], Z[+4,+11] | cold volume, north; the resale checkbox + wind screen |

**Upper (1.5-plan, in the roof) — family bedroom count without growing footprint:**
- 2 children's rooms + bath over the **east** half of the bar; south dormer/gable for view. Keeping the footprint small holds down BYA risk, drift and cost — all three flagged in sheet 01.

## Section logic
```
 S (lake) ─────────────────────────────────── N (road)
  terrace   [ 1.5-plan BAR ]         [ N WING / garage ]
  ┌─vindficka                ridge (E–W, asymmetric)
  ▒▒▒░░░  ╱▔▔▔▔▔▔▔╲___            ╱▔▔╲
        ╱ upper ½   ╲ (steeper N)╱    ╲
  ═════╱  main level ╲══════════╱ cold ╲════  ← flat-plot datum
     [ optional west-end walk-out IF DTM confirms S fall ]
```
- Big south glass, low winter sun (7.9°) reaches deep into living; ~0.4–0.6 m eave overhang cuts the 54.7° summer noon sun → passive comfort, no machinery.
- Asymmetric ridge: **long low south plane = the PV-ready roof** (ties to the solar-readiness product); steeper north plane sheds snow (58.6°N load).
- **Slope-robustness built into the section:** drawn correct on a flat datum. *If* MIMER's 1 m DTM later shows a south fall ≳2.5 m across the footprint, the west social end drops to a walk-out souterräng onto the terrace — an upgrade toggle, not a dependency. Finished-floor stays open until the DTM/survey close.

## Material family (`TASTE`, market-reasoned)
- **Cladding:** vertical stained/tjärsvart timber (contemporary Svensk trähus, low-maintenance, on-trend for this market) with a warm timber-soffit reveal at the south glass.
- **South face:** large aluminium-clad timber glazing (thermal + durable); the west view-room fully glazed.
- **Roof:** standing-seam / folded sheet metal (snow, longevity, PV-ready plane).
- **Base:** low stone or board-marked concrete plinth (grounds the house, absorbs the flat-vs-slope toggle cleanly).
- Palette photographs *warm and ordinary-plus* — the resale target from sheet 01, not magazine-cold.

## The one memorable move — **"Glanrummet"**
The west end of the bar reaches out as a single-storey, fully-glazed **evening room / kvällsrum**, its glass *splayed* toward the lake (F's graft — glass splayed, structure kept orthogonal). The terrace wraps it on two sides inside the vindficka. Result: the entire social life of the house sits in the one corner that holds **both** the lake view **and** the low evening sun — and the listing writes itself: *"kvällssol och sjöutsikt från vardagsrummet."* One move, resale-legible, near-zero cost.

## Hand-off to the engine
`geometry/house-v0.2-geometry-spec.json` encodes the bar, north wing, interior walls (room program above), the placed **House Heart**, terrace and vindficka in scene-v0.2 coordinates so Platform can drop it into the neighbourhood scene and MIMER can verify it against rules once the envelope gates close. Open before v0.3: **DTM (slope/FFL)** and **viewshed (Glan view class)** — both above BRAGE's scope, flagged to the Brain in sheet 03.
