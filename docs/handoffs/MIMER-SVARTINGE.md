# MIMER (Svärtinge 54:28) — persistent handoff

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
