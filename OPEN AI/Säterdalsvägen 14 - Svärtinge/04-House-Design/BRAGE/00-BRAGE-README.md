# BRAGE — Svärtinge 54:28 · Design Study (first assignment)

> ## ⛳ SPRINT DAY — 2026-09-20 (Brain; Oskar runs all sessions today. Supersedes every earlier pin — the 2026-09-15
> CONSOLIDATION decisions still stand: one site per address · six screens · ink chrome · Platform owns the chrome.)
> RULES OF THE DAY: pull first · work the queue in order · each item ends with a screenshot in docs/screens/ + numbers ·
> commit after every item (Oskar pushes hourly) · nothing invented; every figure computed from receipts · report
> "DONE / NOT checked" per item in your handoff at end of day. Chrome tokens until Platform ships the package:
> bg #101916 · card #17241f · paper #f5f1e8 · bronze #d8b874 · serif display · Inter labels · evidence chips
> authoritative #176b52 / indicative #c18a2d / derived #497aa2 / reported #a65b68 / concept #735a9e.
>
> **BRAGE — Vinkelhuset becomes machine-readable today.**
> 1. `geometry/house-v0.3-geometry-spec.json`: every ROOM a named volume — id, use, floor area, ceiling height, wall
>    segments, window/door openings (sill + head heights, orientation), finishes per surface. Platform builds the interior
>    from this file (it starts this afternoon) — no typed dimensions anywhere. DoD: JSON validates (write a 20-line
>    validator), room areas sum to the 210 m² heated figure or the diff is explained.
> 2. Roof: pitch 30°, ridge line, eaves heights, wing roof type — explicit in the spec (Spatial renders from it today).
> 3. Screen 3 "The House": tre-hus-presentation.html re-skinned to the chrome tokens above (topBar, sectionHead, cards),
>    winner + rationale + plans + facades + sections + 4 details as inline SVG. Same file, republish to the SAME artifact
>    URL (2f790a57-…). DoD: screenshot.
> 4. If time: classics library entry #1 in the same spec format.


> ## ⛳ CURRENT MANDATE — 2026-09-15 · CONSOLIDATION (Brain; Oskar decided. Supersedes 2026-09-08.)
>
> DECISIONS: one product = one site per address, SIX screens, ONE chrome ("ink"): bg #101916,
> paper cards, serif display (Georgia/Cormorant), Inter labels, bronze kicker #d8b874, five fixed
> evidence-chip colours (authoritative #176b52 · indicative #c18a2d · derived #497aa2 · reported
> #a65b68 · concept #735a9e). Screens: 1 Site Intelligence (FRONT DOOR, reading first) · 2 Spatial
> Lab (3D) · 3 The House · 4 Rooms (shoppable; separate stage ships first, then inside the house)
> · 5 Stills · 6 Numbers · plus an index of plots. Platform OWNS the chrome; everyone consumes it.
>
> YOUR QUEUE:
> 1. **ROOM-LEVEL GEOMETRY SPEC** (unchanged, top): every room a named volume with openings,
>    heights, orientation, finishes. Platform builds the interior from it.
> 2. **Screen 3 "The House"**: the tre-hus presentation becomes a CHAPTER on the chrome (topBar,
>    sectionHead, cards) — winner, rationale, plans, facades, sections, details as inline SVG.
>    Not a separate design. Republish to the SAME artifact URL.
> 3. Then the classics library.
> ## ⛳ CURRENT MANDATE — 2026-09-08 (Brain; drawing set + 4 details verified. Supersedes the 2026-09-01 pin.)
>
> Vinkelhuset is drawn. Now make it MACHINE-READABLE — Platform is about to mount your house
> as the shell for shoppable rooms, and MIMER prices it.
> 1. **ROOM SCHEDULE + GEOMETRY EXPORT.** Update `geometry/house-v0.2-geometry-spec.json` (or
>    v0.3) so every ROOM is a named volume: id, use, floor area, ceiling height, wall segments,
>    window/door openings with sill+head heights and orientation. Platform reads this to build
>    the interior — no hand-typed dimensions. This is your top item.
> 2. **MATERIAL + FINISH SCHEDULE** per surface (floor/wall/ceiling per room, facade per
>    elevation) so renders and the BoM read the same source.
> 3. Then: the 10-type Swedish classics library, same spec format from day one.
> Every dimension traceable to your drawings. Commit each block; Oskar pushes.


> ## ⛳ CURRENT MANDATE — 2026-09-01 (Brain; supersedes earlier pins; re-read every resume)
>
> WINNER IS CALLED: **VINKELHUSET**. Your only job now is the winner's FULL
> ritningsuppsättning, architect-portfolio grade: dimensioned plans (incl. optional
> west-gable suterräng — slope 13° SV is MEASURED), all four facades at detail scale,
> two sections, construction details, materialspecifikation. Ground every number in the
> authoritative site data (1 936,8 m² Lantmäteriet parcel; DTM terrain).
> Then hand geometry to: (1) Spatial's design-selector mount
> (geometry/house-v0.2-geometry-spec.json format), (2) Essence's floorplan→dollhouse
> pipeline for the 3D model. Update the tre-hus presentation's winner section if your
> developed drawings change any figure. After Vinkelhuset ships: the 10-type Swedish
> classics library. Commit every block; Oskar pushes.


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


## SPRINT DAY 2026-09-20 — BRAGE status

**Item 1 — room-level geometry spec · DONE** (`7a37f92978`)
`geometry/house-v0.3-geometry-spec.json` + `build-house-v0.3.mjs` (generator),
`validate-house-v0.3.mjs` (validator), `draw-house-v0.3.mjs` (plan renderer).
13 rooms (12 heated, 1 cold) · 18 openings with sill/head heights and orientation ·
finishes per surface · wall segments derived from each polygon. No typed dimensions:
rooms are footprint polygons and every area, perimeter, volume and glazing ratio is
computed from them. `ROOM_GLANRUMMET` keeps its v0.2 id and 7×7 m footprint so the
room Platform already built still resolves.
`node geometry/validate-house-v0.3.mjs` → `PASS · 13 rooms · 18 openings · heated
206.4 m² (brief 210, diff -3.6)`, exit 0. It re-derives each stated area from its own
polygon rather than trusting the file.
Upper floor is counted only where headroom clears 1.9 m under the 30° roof — 4.23 m of
the 7 m span. Counting the full span would have added ~40 m² nobody can stand up in.
Brain ruled 206,4 m² supersedes the brief's 210.
*NOT checked:* no BYA/BTA or H30/H50 check (gates open); the souterrain's −2.5 m floor
level is still the v0.2 assumption, not re-derived against the DTM; openings are design
intent, not daylight- or egress-checked; MIMER has not re-priced from v0.3.

**Item 2 — roof · DONE** (same commit)
30° gable, ridge E–W at Y 5.02 m, eaves Y 3.0 m, 0.5 m overhang, standing-seam metal;
cold wing 15° mono-pitch falling north. Supersedes the asymmetric-ridge sketch in
`04-WINNER-DEVELOPED.md`, which now carries that note. Spatial renders from this.

**Item 3 — screen 3 on the chrome · DONE** (`8ba8e6fc56`)
Republished to the same artifact URL (2f790a57-…), name and 🏡 favicon unchanged.
Tokens mirrored from `repo-platform/engine/ui/chrome/tokens.css`, not invented. The
re-skin is one indirection, not 31 edits: the drawings paint with this file's own
variable names, so re-pointing those at the ink tokens re-skins every drawing at once.
Areas propagated — markplan 164 m² heated + 40 m² cold = 204 m² footprint, exploatering
10,5 %; winner room labels 49 / 42 / 9 / 42 / 14 / 14; zero remaining hits for
"210 m²", "~30 m² garage" or "markplan ~140".
*Full-page inspection done after the first commit* (14 000 px render, cropped into bands).
Contrast holds throughout — details, A/B/C facades, material swatches and footer all read
on the dark ground. It caught three propagation misses the first pass left behind, now
fixed and republished: the takfot detail still claimed an "Asymmetrisk sadeltak" after the
roof became a 30° symmetric gable; house B's data chip still read "~165–185 m² + 35 m²
garage"; and the footer still dated the figures 2026-08-27.
*NOT checked:* no browser other than headless Chrome; Mirrored tokens can drift from Platform's package with
nothing detecting it. The artifact is shared by link and viewers stay pinned to the
previous version until the share pin is moved.

**Item 4 — classics library entry #1 · NOT STARTED** (it was "if time"; the time went on
items 1–3 and on verifying them).

Nothing is pushed — Oskar pushes.

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
