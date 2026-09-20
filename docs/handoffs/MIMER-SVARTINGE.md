# MIMER (Svärtinge 54:28) — persistent handoff

> ## ⛳ SPRINT DAY — 2026-09-20 (Brain; Oskar runs all sessions today. Supersedes every earlier pin — the 2026-09-15
> CONSOLIDATION decisions still stand: one site per address · six screens · ink chrome · Platform owns the chrome.)
> RULES OF THE DAY: pull first · work the queue in order · each item ends with a screenshot in docs/screens/ + numbers ·
> commit after every item (Oskar pushes hourly) · nothing invented; every figure computed from receipts · report
> "DONE / NOT checked" per item in your handoff at end of day. Chrome tokens until Platform ships the package:
> bg #101916 · card #17241f · paper #f5f1e8 · bronze #d8b874 · serif display · Inter labels · evidence chips
> authoritative #176b52 / indicative #c18a2d / derived #497aa2 / reported #a65b68 / concept #735a9e.
>
> **MIMER — the numbers become a chapter, and they price the real interior.**
> 1. Screen 6 "Numbers": the Lender dossier generator emits an HTML chapter on the chrome tokens — cost lines, comps,
>    NOT-verified ledger rendered as evidence chips. Same generator, new skin. DoD: HTML in the vault + screenshot.
> 2. FF&E line: price the Vinkelhuset living room from Platform's actual room composition
>    (../repo-platform/data/scenes/shoppable-room-newport-living/ rows → price + source + date). One receipted number
>    per spec level (this set / a mid set / a premium set from the same catalog). DoD: table in dossier with receipts.
> 3. Rate-card skeleton for §6 (unit · quantity · rate slot · source slot) so a husleverantör offert drops straight in.
> 4. Generator takes `--site <dir> --geometry <spec>`; dry-run on Djurö 4:147 (5,156.3 m²) with all money NEEDS_SOURCE.


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
> 1. **Screen 6 "Numbers"**: the Lender dossier rendered as a chapter on the chrome — cost lines,
>    comps, NOT-verified ledger as evidence chips. Same generator, new skin.
> 2. FF&E line priced from the real catalogs (receipted rows), rate-card skeleton for the offert.
> 3. Generator takes any site + geometry spec (Djurö next).
> ## ⛳ CURRENT MANDATE — 2026-09-08 (Brain; Lender Edition verified — it correctly refuses to fake rates. Supersedes the 2026-09-01 pin.)
>
> §6 rates and §7 comps are blocked on owner input — do NOT invent them. Work the parts you own:
> 1. **INTERIOR COST FROM THE REAL CATALOG.** We now hold ~226k channel-tracked SKUs with live
>    prices (`../repo-avatar-factory/data/*/*.jsonl`) and Platform furnishes rooms from them.
>    Add a receipted **furnishing/FF&E line** to the dossier: priced from actual catalog rows
>    (price + source + date), per room, per spec level. That is a real number nobody has to quote.
> 2. **RATE-CARD SKELETON** for §6: structure every line so a husleverantör offert drops straight
>    in (unit, quantity, rate slot, source slot) — quantities are yours, rates stay NEEDS_SOURCE.
> 3. **REUSABILITY:** make the dossier generator take a site + geometry spec as input, so Djurö
>    4:147 (5,156.3 m², Värmdö) can produce one. Same truth law.
> Every claim receipted; NOT-verified ledger mandatory. Commit; Oskar pushes.


> ## ⛳ CURRENT MANDATE — 2026-09-01 (Brain; supersedes earlier pins; re-read every resume)
>
> Winner is called: VINKELHUSET. Finish the Lender Edition against the WINNER:
> 1. **§6 receipted cost BoM** — rebuild build_bom.py quantities from Vinkelhuset's
>    developed geometry (BRAGE is drawing it now; use the concept dims meanwhile, mark
>    CONCEPT, swap when developed dims land).
> 2. **§7 finished-value comps** — comparable sales for the area, receipted sources.
> 3. Fold the authoritative parcel receipt (#21) through every claim; keep the
>    NOT-verified ledger current.
> Deliverable: a bank-ready Vinkelhuset dossier PDF/HTML in the vault + code in repo.
> Truth law: every claim receipted. Commit; Oskar pushes.


> ## ⛳ CURRENT MANDATE — 2026-08-27 (Brain; LANTMÄTERIET DATA LANDED; re-read every resume)
>
> The LM grants (LM2026/114822 fastighetsindelning + LM2026/114814 byggnad) were
> DELIVERED 2026-08-27. Data: `"../lm-data/"` (repo-external, NOT in git — LM license);
> Spatial's ingest already derived the official parcel:
> `repo-spatial-studio: data/sites/sweden/saterdalsvagen-14/property-division-derived-v0.1.json`
> — SVÄRTINGE 54:28, **1 936.8 m² AUTHORITATIVE** (Lantmäteriet, source object
> registerenhetsomradesyta:51016844, senastandrad 2023-01-27, sha256 receipts inside).
>
> WHAT THIS MEANS FOR YOU:
> 1. **Lender Edition receipts upgrade**: the dossier's parcel identity/geometry claims
>    can now cite AUTHORITATIVE Lantmäteriet vector data instead of indicative sources.
>    Add the receipt (order numbers + file sha256 839f729f… + object id) to the
>    20-receipt register; move the parcel-boundary line OUT of the NOT-verified ledger.
> 2. **Official building footprints** (`byggnad_kn0581.gpkg`) — neighbour-context
>    claims in M-blocks can be re-grounded on LM data where they used OSM.
> 3. Continue the standing goal: Lender Edition §6 (receipted cost BoM) + §7
>    (finished-value comps) per docs/LENDER-DOSSIER-SPEC.md (on agent/brain).
> Truth law unchanged: every claim receipted; NOT-verified ledger mandatory.
> Commit every block; Oskar pushes.

State log 2026-09-01: Lender Edition finished against WINNER "Vinkelhuset mot Glan".
§6 BoM rebuilt from BRAGE v0.3 geometry (13 lines; BYA 204, heated 210 BTA, wall 222,
roof 227, terrace 136; rates all NEEDS_SOURCE, no total). §7 comps: receipt #22 added
(Svensk Mäklarstatistik Norrköping villa 31282 kr/m² 12-mo, data 2026-08-07); 5.8 Mkr
indicative-not-a-valuation; finished value NOT_VERIFIED pending adjusted sold comps.
Parcel #21 folded through. Money-figure audit passes. Dossier MD+HTML+2 JSON in vault
07-Lender-Dossier/. Commits 8640d45 (+ cd64527, 0ba8f38 earlier). OPEN for owner
go-ahead: husleverantör offert (fills §6 rates) + live Svärtinge sold comps (fills §7).

Standing goal: docs/SESSION-GOALS.md (agent/brain). State log 2026-08-25:
M1–M6 complete incl. microsite; data contributed to
data/sites/sweden/saterdalsvagen-14/mimer/; Lender Dossier v1 in the Opero vault
(07-Lender-Dossier/). Fleet state: docs/FLEET-STATE-2026-08-25.md (agent/brain).
