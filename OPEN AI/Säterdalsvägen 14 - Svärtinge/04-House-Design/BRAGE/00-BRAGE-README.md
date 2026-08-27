# BRAGE — Svärtinge 54:28 · Design Study (first assignment)

> ## ⛳ CURRENT MANDATE — 2026-08-27 (Brain; SITE DATA UPGRADED; re-read every resume)
>
> Two of your presentation's open evidence caveats just closed:
> 1. **Plot area is now AUTHORITATIVE: 1 936.8 m²** (Lantmäteriet fastighetsindelning,
>    delivered 2026-08-27; 7-corner polygon in
>    `repo-spatial-studio: data/sites/sweden/saterdalsvagen-14/property-division-derived-v0.1.json`).
>    Your chip "~1 938 m² indikativ yta" → update to the authoritative figure.
> 2. **Terrain is measured**: Spatial's closed terrain gate gives 13° SW slope/aspect,
>    43 m fall to Glan over 800 m, ~70 m RH2000 at the pin. Your chip "Sluttning okänd
>    (DTM väntar)" is stale — THE SLOPE IS CONFIRMED, which validates the suterräng
>    logic in House A and House B's optional suterräng west gable.
> QUEUE: (a) update the tre-hus presentation's evidence chips + footer — DONE; (b) House
> A undervåning plan — DONE.
> **(c) ⭐ WINNER CALLED 2026-08-27: VINKELHUSET (House B).** Oskar picked it; Brain added
> the "Vald riktning: Vinkelhuset" decision section to the presentation (id="valt", with
> the 4-point rationale) and republished the artifact. YOUR JOB NOW: draw Vinkelhuset's
> FULL ritningsuppsättning — all four fasader at detail scale, sections, construction
> details, materialspecifikation, dimensioned plan(s) incl. the optional west-gable
> suterräng — architect-portfolio quality — then hand the geometry to (1) Essence's
> floorplan→dollhouse pipeline for 3D and (2) Spatial's design-selector mount (spec:
> geometry/house-v0.2-geometry-spec.json). Refine/expand the decision rationale I drafted
> if you want it sharper — it's grounded but it's your voice.
> After Vinkelhuset ships: the 10-type Swedish classics library.
> Commit every block; Oskar pushes.

BRAGE is the creative counterpart to MIMER: MIMER measures the site, BRAGE argues **what deserves to stand on it**, then develops the chosen concept into a spatial + systems spec the engine can build.

- Property: `SVÄRTINGE 54:28` — Säterdalsvägen 14, 605 70 Svärtinge, Norrköping
- Evidence source: MIMER vault (`OPEN AI/Säterdalsvägen 14 - Svärtinge/`) + scene `neighbourhood-scene-v0.2.json`
- Stage: **CONCEPT**. Nothing here is engineered, permitted, or surveyed. Every claim carries an evidence class.
- Branch: `agent/brage-design`. Decisions above scope → Brain.

## The BRAGE loop (this study)
1. **Read the evidence** → [`01-EVIDENCE-READ.md`](01-EVIDENCE-READ.md) — sun/wind/view/terrain, each with its evidence class, including what is *not* verified.
2. **Diverge** → [`02-FOUR-DIRECTIONS-CHALLENGED.md`](02-FOUR-DIRECTIONS-CHALLENGED.md) — the Brain's four directions challenged from the data, plus two it missed.
3. **Judge** → [`03-JUDGED-MATRIX.md`](03-JUDGED-MATRIX.md) — trade-off matrix, one recommendation, graftable ideas from the losers.
4. **Develop** → [`04-WINNER-DEVELOPED.md`](04-WINNER-DEVELOPED.md) — parti, level program, section logic, material family, one memorable move, House Heart placement.
5. **Hand to engine** → [`geometry/house-v0.2-geometry-spec.json`](geometry/house-v0.2-geometry-spec.json) — machine-readable geometry in scene-v0.2 coordinates (interior walls, House Heart placed) for Platform to render.

## Honesty note (truth law)
The Brain's handoff said "MIMER data is complete." It is **not** — and BRAGE's first duty was to say so. The 1 m terrain raster returned HTTP 401 (no slope, no fall line), the Glan view is **seller-reported, not viewshed-verified**, and legal boundary/area/access/utility gates are all open. So this study is designed to be **robust to the unknowns**: the winner works on a flat plot and *upgrades* if terrain later confirms a south fall — it does not *depend* on a slope nobody has measured. Sun and wind, by contrast, are derivable from latitude and regional climate (labelled `DERIVED` / `REGIONAL`) and carry the design.
