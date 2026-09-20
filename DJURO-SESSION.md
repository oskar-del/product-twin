# Djurö by väg 34 · DJURÖ 4:147 — session handoff

> ## ⛳ SPRINT DAY — 2026-09-20 (Brain; Oskar runs all sessions today. Supersedes every earlier pin — the 2026-09-15
> CONSOLIDATION decisions still stand: one site per address · six screens · ink chrome · Platform owns the chrome.)
> RULES OF THE DAY: pull first · work the queue in order · each item ends with a screenshot in docs/screens/ + numbers ·
> commit after every item (Oskar pushes hourly) · nothing invented; every figure computed from receipts · report
> "DONE / NOT checked" per item in your handoff at end of day. Chrome tokens until Platform ships the package:
> bg #101916 · card #17241f · paper #f5f1e8 · bronze #d8b874 · serif display · Inter labels · evidence chips
> authoritative #176b52 / indicative #c18a2d / derived #497aa2 / reported #a65b68 / concept #735a9e.
>
> **DJURÖ — build the data today; the page gets regenerated from Spatial's template, not patched.**
> 1. Official building footprints: pull `byggnad_kn0120.zip` (STAC, same pattern as Svärtinge, receipts) → clip 200 m
>    around DJURÖ 4:147 → `buildings-official-derived-v0.1.json` with REAL rings (today's file has none). DoD: count + sha.
> 2. DTM tile for the plot (stac-hojd) → `terrain-dem-derived-v0.1.json` with receipts; real relief/slope, not the 8.1° guess.
> 3. Strandskydd + plan status from Värmdö kommun (detaljplan / områdesbestämmelser), receipted. Close what you can.
> 4. Sea-view sightline geometry from the DTM (the 43.3% arc must be derived, not stated).
> 5. When Spatial's `scripts/build-site.py` lands (this afternoon): run it on your data dir → screens 1+2 → replace the
>    current page → republish to the SAME artifact URL (7a1359ec-…). DoD: screenshot beside Svärtinge's.
> Nothing invented — this goes to a real family.


## ✅ SPRINT DAY 2026-09-20 — END OF DAY REPORT (Claude, Djurö session)

Branch `agent/djuro-site-intelligence-v2`, rebased on `origin/main`. Four commits, one per queue item.
Every figure below is printed by a committed script and re-derivable with the command shown.

### Item 1 — Official building footprints · **DONE**
`python3 scripts/ingest-buildings-official.py --site data/sites/sweden/djuro-byvag-34 --zip "../lm-data/byggnad_kn0120.zip" --buffer 200`

| | |
|---|---|
| raw sha256 | `fbeea328dfab88995e1126396660d47a697071899dcf9ac52a892b4b7950878c` |
| raw bytes | 15 280 624 |
| bbox candidates → within 200 m | 51 → 35 |
| on parcel | **4** — 416.0 m² of footprint on a 5 156.3 m² parcel |
| derived geom sha256 | `a41f5dfe3b7d3e9afe711767adf0c9d7d200f2e2d999134259ec2a3c1f4f0e98` |

Bostad 119.7 · Komplementbyggnad 190.2 / 84.6 / 21.5 m². The four areas independently confirm the
figures already on the page, which until today had **no rings behind them**. Real rings now exist.
Screen `docs/screens/djuro-01-buildings-official.svg`.

**NOT checked:** no building heights exist in the LM byggnad product — storeys, volume and roof form
remain NOT established. `huvudbyggnad` is `Nej` on all four features; which is legally the main
building was not resolved.

### Item 2 — DTM terrain · **DONE, and it corrects a published figure**
`python3 scripts/derive-terrain-dem.py --site data/sites/sweden/djuro-byvag-34 --receipt .runtime/receipts/lantmateriet-terrain-djuro-2026-08-31.json`

| | |
|---|---|
| tile integrity | 10/10 receipted tiles re-verified by sha256 before any pixel was read |
| parcel mask | 5 155 px = 5 155.0 m² vs 5 156.3 m² registered — **0.03%**, an independent check that the boundary and DTM frames align |
| height at site pin | 6.9 m RH2000 (dwelling sits at 7.00 m) |
| parcel heights | 0.15 → 11.68 m · relief **11.53 m** · mean 5.23 · sd 2.51 |
| whole-parcel plane | **3.94° falling NE**, 1.46 m RMS residual |
| ground underfoot | median **8.29°**, p90 23.77°, max 57.2° |
| below 1 / 2 / 3 / 5 m | 214 / 617 / 937 / 2 806 m² (4.2 / 12.0 / 18.2 / 54.4%) |
| derived sha256 | `8fde130522f67737731d8af528c7d1afd105ff7e53f8313b30b273e2b729670c` |

⚠️ **CORRECTED 2026-09-20 evening — I was wrong; the page is right.** I originally reported the
published 8.1° WNW as an error. It is not. Conforming to Svärtinge's template forced me to implement
its `slope_aspect_at_pin` field — Horn 3×3 on the 1 m grid at the pin — and it returns **8.15°,
aspect 294.8° WNW**, the page's figure, by the template's own method. I checked both aspect formulas
on the same 3×3 window and they agree to 0.01°.

**Three measures, three different questions, all correct:**

| measure | value | answers |
|---|---|---|
| at the pin, Horn 3×3 | **8.1° WNW** | the local microslope — *what the page states* |
| across the whole parcel | 3.94° NE | plane fit, 1.46 m RMS residual |
| ground underfoot | 8.29° median · p90 23.77° · max 57.2° | what you stand on |

What still stands: the parcel is **not planar**, so no single slope describes it, and it falls to the
water across its whole extent. What does not stand: calling the pin figure an error. The escalation
on this point is **withdrawn**. `terrain-dem-derived` now carries a `reconciliation_with_pin_slope`
field and the screen no longer prints a correction banner.
Screen `docs/screens/djuro-02-terrain-dtm.svg`.

**NOT checked:** heights are bare-earth ground, not roof or canopy. This is a derivation from a
verified source, not an official terrain survey, and it is not finished-floor or foundation input.

### Item 3 — Strandskydd + plan status · **DONE — three gates closed**
`python3 scripts/derive-shoreline-strandskydd.py --site data/sites/sweden/djuro-byvag-34`
`python3 scripts/query-varmdo-planning.py --site data/sites/sweden/djuro-byvag-34`

Geometry. LM's ground model carries one constant height across open water. The script does not assume
that value — it finds the modal height in the lowest metre and accepts it as water only because it
covers an implausible share of a coastal window (0.15 m RH2000 over 20.9% of a 1 400 m window).
Shoreline = the edge of that region, 8 233 cells at 1 m.

| | |
|---|---|
| nearest point parcel → shoreline | **0.2 m** — the parcel reaches the water |
| farthest boundary point | **94.8 m** — no corner escapes 100 m |
| parcel inside the 100 m band | **5 155.0 m² = 100.0%** |
| the four registered buildings | 12.4 / 30.2 / 32.8 / 70.6 m from the water — all inside |
| derived sha256 | `72359bd81cab55d26508c064e9610c744f23c3ed55b196ba4d33977d7e4b63d1` |

Plan status. Värmdö publishes a **public WFS** at `karta.varmdo.se/geoserver/wfs`. The authoritative
parcel polygon is reprojected EPSG:3006 → EPSG:3011 and used as an `INTERSECTS` filter, so the answer
covers the whole property, not a centre point. **Every layer was queried unfiltered first as a
control**; a zero counts as a verified negative only where that control returned features.

| layer | result | control |
|---|---|---|
| Utvidgat strandskydd 300 m (Länsstyrelsen) | NONE | 240 |
| Utvidgat strandskydd (kommunens kopia) | NONE | 241 |
| Utökat strandskydd 300 m (ÖP 2022–2035) | NONE | 241 |
| Gällande detaljplaner | NONE | 559 |
| Pågående detaljplaner | NONE | 38 |
| Upphävda detaljplaner efter 2023-01-01 | NONE | 2 |

**GATES**
- `STRANDSKYDD_GEOMETRY` — **CLOSED.** Measured, not presumed.
- `STRANDSKYDD_EXTENSION` — **CLOSED (negative).** No 300 m extension here, across three independent
  layers. The base 100 m applies, and it already covers all of it.
- `DETALJPLAN` — **CLOSED (negative).** Unplanned land. Bygglov is judged against översiktsplan,
  strandskydd and PBL, not a plan map.
- `STRANDSKYDD_DISPENS` — **OPEN.** A case record, not a map layer. Not retrieved.

Screen `docs/screens/djuro-03-strandskydd.svg`.

**NOT checked:** the WFS is the kommun's published depiction, not the plan document or the
Länsstyrelsen decision itself — a transaction answer should quote the decision. No dispens,
förhandsbesked or bygglov history for this property was queried. The shoreline is DERIVED from the
ground model, not the cadastral shoreline and not the legal strandlinje.

### Item 4 — Sea-view sightlines · **DONE — the claim survives**
`python3 scripts/derive-sea-view.py --site data/sites/sweden/djuro-byvag-34`

720 rays at 0.5° from the dwelling centroid at 1.6 m eye height, 1 m samples to 2 500 m, running-maximum
horizon angle, earth curvature + refraction (k = 0.13). Nine receipted tiles re-verified first.

| | |
|---|---|
| computed arc | **43.9%** = 158.0°, ONE unbroken arc **319.0° → 117.0°** (NW–ESE) |
| previously stated | 43.3%, 321°–114° — a 153° span written as a percentage, never computed |
| nearest visible water | 41.0 m |
| derived sha256 | `97e0e729085e530765102390637eed507102a169aa85b3433b615194ca968e49` |

The estimate was good. It is now derived and reproducible. Screen `docs/screens/djuro-04-sea-view.svg`.

⚠️ **NOT checked — and this is the ceiling that matters:** the ground model is bare earth. No trees,
no buildings, no boathouses, no neighbouring roofs. Every one of those blocks a real view and none is
in this calculation. **43.9% is an UPPER BOUND** — the view on cleared ground, not the view from a
window. One viewpoint, one eye height; this is not a room-by-room analysis.

### Item 5 — Run Spatial's `scripts/build-site.py` · **BLOCKED, not started**
`scripts/build-site.py` is **not on `origin/main`** as of the last fetch this evening
(`git ls-tree -r origin/main --name-only | grep build-site` → nothing). Nothing was run, no page was
replaced, and **nothing was republished to artifact `7a1359ec-…`**.

Per the mandate — *"the page gets regenerated from Spatial's template, not patched"* — I did **not**
patch the live page. The data it needs is committed and waiting.

🔴 **ESCALATION FOR OSKAR — now narrower than I first reported.** The slope line on the page is
**fine** (see the correction under item 2; I withdrew that). What remains is that the page calls
strandskydd **"presumed"** when item 3 has measured it at **100% of the parcel**, and that it carries
the 43.3% sea-view figure without its bare-earth ceiling. This goes to a real family. Either
Spatial's generator lands and the page is regenerated, or that one line needs pulling — your call,
because patching the page is what the mandate rules out.

### What today changed about the site
The parcel runs down to the water — 0.2 m at its nearest, 0.15 m RH2000 at its lowest. That single
fact drives the rest: strandskydd covers all of it, the sea view is real and unbroken across 158°,
and the ground is broken archipelago rock — 57° at its steepest, and not planar, so the pin's
correct 8.1° WNW describes a microslope rather than the site. It is unplanned land with four
registered buildings, all inside the 100 m zone.

## 🌙 EVENING — Brain prep tasks (a) schema conformance · (b) findings/gates as data · **BOTH DONE**

**(a) Schema conformance.** Diffed against `repo-spatial-studio/data/sites/sweden/saterdalsvagen-14/`.
Now **zero missing keys, zero type mismatches** on all three files — `property-division` already
conformed; `buildings-official` and `terrain-dem` were reshaped to the template (my extra fields kept
as additions, never renaming the template). Re-check with:
`python3 scripts/build-findings-and-gates.py --site data/sites/sweden/djuro-byvag-34`

Conforming is what caught my slope error — implementing the template's `slope_aspect_at_pin`
reproduced the page's 8.1° WNW exactly. Worth noting: matching the template was what verified it.

**Two things referred to Brain — both RULED 2026-09-20 evening, both in favour of what Djurö emits:**
1. `glan_sightline_profile` → **the template key is renamed `sightline_profile`**, which is what Djurö
   already emits; the generator will read only that. The `glan_sightline_profile` alias here
   (`alias_of`, `target_is_not_glan`) is fine to keep and harmless once the rename lands.
2. `evidence_class` → **`DERIVED` with `derived_from_evidence_class: AUTHORITATIVE` is the correct
   label for terrain products fleet-wide.** Svärtinge's terrain doc gets relabelled to match Djurö,
   not the reverse. No change needed here.
3. `provenance_qa` nulls → **null now renders as NOT ESTABLISHED, enforced as a generator assertion.**
   Djurö's nulls are correct as they stand: the ursprung/brytgeometri polygons were never downloaded.

Brain also noted the slope self-correction will **not** be propagated as "8.1° was wrong", and that
recording all three measures is the intended behaviour, not a workaround.

**(b) findings.json + gates.json.** `scripts/build-findings-and-gates.py` reads the six derived
products and emits both in the template's `plot-intelligence` shape. Nothing hand-typed, so a finding
cannot drift from the number it claims. **4 receipts · 10 findings · 11 gates (7 closed / 4 open).**
Open: `BUILDING_HEIGHTS`, `TERRAIN_PROVENANCE`, `STRANDSKYDD_DISPENS`, `VIEW_OCCLUSION`.

Brain's rule is enforced in the data, not just in prose: `GATE_SE_SEA_VIEW` is CLOSED **only** as a
terrain result and a ceiling, `GATE_SE_VIEW_OCCLUSION` stays OPEN, and both the finding and
`terrain-dem`'s limitations carry *"a rendered horizon in any image is never a view claim."*

**NOT checked:** the generator does not exist yet, so nothing has been proved to render from these
files — conformance is a key/type diff against the reference site, not a successful generator run.
The current page was not touched.

**NEXT SESSION PICKS UP HERE.** Item 5 is still the only open work and it is unblocked-but-waiting:
when Spatial reports `scripts/build-site.py` runs on `data/sites/sweden/djuro-byvag-34/`, run it,
replace the page, and republish to the **same** artifact URL
(`claude.ai/code/artifact/7a1359ec-193a-48dd-a434-8dc530333f87`). Do not patch the page by hand, and
do not publish to a new URL. Everything the generator needs is committed: six derived products plus
`findings.json` and `gates.json`, all schema-conformant with `saterdalsvagen-14`.

> ## ⛳ CURRENT MANDATE — 2026-09-15 · CONSOLIDATION (Brain; Oskar decided. Supersedes 2026-09-08.)
>
> DECISIONS: one product = one site per address, SIX screens, ONE chrome ("ink"): bg #101916,
> paper cards, serif display (Georgia/Cormorant), Inter labels, bronze kicker #d8b874, five fixed
> evidence-chip colours (authoritative #176b52 · indicative #c18a2d · derived #497aa2 · reported
> #a65b68 · concept #735a9e). Screens: 1 Site Intelligence (FRONT DOOR, reading first) · 2 Spatial
> Lab (3D) · 3 The House · 4 Rooms (shoppable; separate stage ships first, then inside the house)
> · 5 Stills · 6 Numbers · plus an index of plots. Platform OWNS the chrome; everyone consumes it.
>
> HONEST VERDICT: your page is a skeleton — gradient hero, schematic canvases, no twin, no photos.
> It was built without Spatial's template because none existed. DO NOT patch the page.
> YOUR QUEUE:
> 1. **Build the DATA the template will need**: official byggnad footprints
>    (`../lm-data/byggnad_kn0120.zip` — pull via the same STAC pattern, receipts), DTM terrain tile,
>    sea-view sightline geometry, strandskydd + plan status from Värmdö (receipts). Close gates.
> 2. When Spatial's site generator lands, RUN IT for DJURÖ 4:147 → screens 1 + 2 with a real twin
>    hero. Replace the current page. Republish to the SAME artifact URL
>    (claude.ai/code/artifact/7a1359ec-193a-48dd-a434-8dc530333f87).
> 3. Nothing invented. This goes to a real family about their real house.
> ## ⛳ CURRENT MANDATE — 2026-09-08 (Brain; your rebuild is VERIFIED and PUBLISHED)
>
> Brain checked your output: authoritative boundary 5,156.3 m² / 10 vertices / 10 context
> parcels, and the landing page now matches the Svärtinge design language. Brain applied two
> honesty relabels (depth figures are typical archipelago ranges, not site observations; the
> elevation profile SHAPE is schematic — only the 8.1° slope is DTM-derived). Page is live.
>
> NEXT:
> 1. **CLOSE THE OPEN GATES THAT ARE CHEAP.** 14 of 16 are open. Strandskydd is only "presumed" —
>    resolve Värmdö's actual shoreline-protection zone and the plan status (detaljplan /
>    områdesbestämmelser) from official sources, with receipts. Those two decide what can be built.
> 2. **THE 3D TWIN.** `prototype/djuro-neighbourhood/` should stand up like Svärtinge's: real
>    boundary, official byggnad footprints (pull `byggnad_kn0120.zip` the same way), DTM terrain,
>    sea-view sightlines (the 43.3% arc claim should be shown, not just stated).
> 3. **NO INVENTED FACTS.** This goes to a real person about their real summer house. Anything
>    not sourced is labelled or absent.
> Commit every block; Oskar pushes.
