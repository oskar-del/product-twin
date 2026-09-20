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
