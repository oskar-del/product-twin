# Plot-to-Project Spatial Studio — Claude Session Handoff

> ## ⛳ CURRENT MANDATE — 2026-09-01 (Brain; supersedes earlier pins; re-read every resume)
>
> Boundary + byggnad + sightlines: DONE and verified. Now finish the CANONICAL EXPERIENCE:
> 1. **Trunk adoption**: fold COMPARE + the Site Intelligence rebuild into ONE experience —
>    no forked looks; a visitor flows Site-Intelligence page ↔ 3D twin seamlessly.
> 2. **Mount BRAGE's Vinkelhuset**: winner is called; when its developed geometry lands
>    (house-v0.2 spec format), mount it as THE design on the plot (A/C stay as alternates
>    in the selector).
> 3. Keep the ingest kommun-generic (a separate Djurö showcase session will reuse your
>    scripts for Värmdö 0120 — do not do that work here, just keep scripts parameterised).
> Every pixel honest. Gate every block (838-assertion validator). Commit; Oskar pushes.


> ## ⛳ CURRENT MANDATE — 2026-08-27 (Brain; LANTMÄTERIET DATA LANDED; re-read every resume)
>
> Your "Geotorget order is unavoidable" blocker is RESOLVED. Orders LM2026/114822
> (fastighetsindelning) + LM2026/114814 (byggnad) were delivered 2026-08-27; the zips
> live at `"../lm-data/"` (repo-external, NOT in git — LM license). Brain already ran
> YOUR drop-in (`scripts/ingest-property-division.py`) against the real data — one fix
> was needed (real LM schema splits designation into trakt+etikett; composed, fallback
> kept) — and GATE_SE_PROPERTY_DIVISION_CONTEXT is CLOSED:
> `data/sites/sweden/saterdalsvagen-14/property-division-derived-v0.1.json` — subject
> SVÄRTINGE 54:28, 1 ring (7 pts), **1 936.8 m² AUTHORITATIVE** (Lantmäteriet), 75
> context parcels, full sha256 receipt chain. Validator re-run: 838 PASS.
>
> YOUR QUEUE NOW:
> 1. **Wire the viewer overlay** to render the authoritative boundary (your own
>    script's final message) — replace the provisional developer trace everywhere;
>    evidence chip flips INDICATIVE → AUTHORITATIVE.
> 2. **Byggnad footprints**: `../lm-data/byggnad_kn0581.zip` (35 MB GPKG) = official
>    building geometry for the neighbourhood — upgrade/verify the OSM context with it
>    (same ingest pattern; receipts mandatory).
> 3. Nationwide: the grant serves EVERY kommun via
>    `api.lantmateriet.se/stac-vektor/v1/collections/{fastighetsindelning,byggnader}/items/<kommunkod>`
>    — keep the ingest generic; this is the plot-analysis SEO machine's data layer.
> Then continue trunk adoption (COMPARE + Site Intelligence = one experience).
> Commit every block; Oskar pushes.
>
> ### Claude progress — 2026-08-27 (mandate items 1 & 2 DONE, verified in browser)
> - **Item 1 — boundary overlay wired (`ded76d7`)**: the authoritative 7-point 54:28
>   polygon (1 937 m², EPSG:3006) renders as the AUTHORITATIVE green boundary fence +
>   75 context parcels; provisional `PLOT_54_28` indicative trace suppressed; source
>   chip flipped INDICATIVE → "✓ AUTHORITATIVE · 1937 m² · SHA 92ab23e77f…" (area via
>   shoelace, never typed).
> - **Item 2 — byggnad footprints (`c6933b8` ingest, `82f57b1` viewer)**:
>   `scripts/ingest-buildings.py` (reuses the proven helpers) clipped 153 official
>   footprints within 200 m (49 Bostad) → `buildings-official-derived-v0.1.json` with
>   receipts; viewer extrudes them through profile(), retires the OSM boxes. Footprint
>   AUTHORITATIVE, **height DERIVED** (LM byggnad has no height — never invented).
> - **Item 3 — generic/nationwide**: both ingest scripts are kommun-parameterised
>   (property-division pulls the STAC asset by kommunkod; buildings takes any
>   `byggnad_kn<NNNN>.zip`). Ready to fan out to other kommuner.
> - Gates/checks each block: `--self-test` PASS, validator 838 PASS, module syntax OK,
>   no forbidden storage APIs. NOT checked: heavy 5-min soak / all 153 footprints for
>   self-intersecting rings; COMPARE-mode trunk convergence still open.

## Role

This is the persistent **Claude** specialist session for the Plot-to-Project Spatial Studio workstream. It continues the ChatGPT chat "3: Plot-to-Project Spatial Studio" with the capabilities that environment lacked: full local filesystem, authenticated GitHub push, a real browser, and the ability to download and process official Swedish geodata.

- Repository: `oskar-del/product-twin`
- **Branch: `agent/spatial-studio-claude`** (branched from `agent/plot-to-project-spatial-studio` at `3f6040f`)
- **Checkout: `/Users/oskarpeterson/Documents/AI/product twin/repo/`** — work ONLY here.
- ⛔ Never edit anything under `~/.codex/.chatgpt-projects/` — those are ChatGPT's own worktrees and may be mid-task.
- Sync protocol: GitHub is the only shared truth between models. Pull before starting, push after every coherent step. Merges back into `agent/plot-to-project-spatial-studio` or `main` are decided by the Product Twin brain session, not here.

## Read first, in order

1. `AGENTS.md` — work protocol (planner/executor/reviewer/gate; evidence-bearing claims only).
2. `docs/PLOT-TO-PROJECT-TWIN-ARCHITECTURE.md`
3. `data/sites/sweden/saterdalsvagen-14/README.md` — the full Svärtinge 54:28 evidence state (20 source receipts, 2/18 gates closed).
4. `data/sites/sweden/saterdalsvagen-14/official-context-geometry-sources-v0.1.json` and `context-providers-v0.1.json`
5. `prototype/svartinge-neighbourhood/` — the 7-stage viewer (INTELLIGENCE / REALISTIC / COMPARE profiles).

## Subject

**SVÄRTINGE 54:28**, Säterdalsvägen 14, Norrköping. Real for-sale plot, seller-reported 1,939 m², Glan view. Listing pin `[16.0317063331, 58.6522414431]`. NOKA-confirmed address→parcel mapping; governing 1936 avstyckningsplan `0581K-22D:1008`; 2026 ÖP consultation layers queried at the point.

## Rules inherited from the evidence record

- Seller claims stay `REPORTED_UNVERIFIED`; they can never close Site Twin gates.
- Realism changes presentation, not evidence. No render promotes a source.
- No provider pixels, panorama IDs or provider-derived geometry are committed. Licensed/credentialed downloads live under gitignored `.runtime/` until their licence is receipted.
- Every captured source gets a SHA-256 receipt with date, URL and licence state.
- Point-query results are screens, never parcel-wide proof of absence.

## First milestones

### M1 · Lantmäteriet unlock (blocked on one human step)
The exact targets are already resolved in `official-context-geometry-sources-v0.1.json`:
- Terrain: STAC item `650_55`, Markhöjdmodell Nedladdning 1 m, EPSG:5845 — previous attempt returned HTTP 401.
- Buildings: vector package `byggnader/0581` (Norrköping, EPSG:3006).
- Parcels: vector package `fastighetsindelning/0581`.

Unlock = Oskar creates/logs into a free **Geotorget** account (geotorget.lantmateriet.se) and issues an API token for open data. Store the token OUTSIDE Git (e.g. `.runtime/credentials/` or shell env `LM_GEOTORGET_TOKEN`). Then: download all three, write SHA-256 receipts, clip terrain + parcel + surrounding building footprints to the study area, and promote the Street Room from diagrammatic to authoritative context. Roads: Trafikverket NVDB `Vägtrafiknät` (Lastkajen account may also be needed — same pattern).

### M2 · Terrain + parcel truth in the viewer
Replace the derived terrain and indicative municipal trace with the real 1 m DEM and the official (still legally indicative) fastighetsindelning polygon for 54:28, with evidence-class labels updated accordingly. Gate: a validation script that checks CRS, clip bounds, receipt hashes and that the parcel area is reported against NOKA's 1,938.198844 m² indicative figure.

### M3 · Sun/terrain analysis
With real DEM: slope, aspect, sun path for the plot (PVGIS pattern already exists in `scripts/pvgis-solar.mjs`), Glan view-axis check from actual heights. This feeds the window-intent / house-orientation work in `docs/HOUSE-EXE-BRIDGE-ROADMAP-2026-08-17.md`.

### M4 · Visual design pass (Claude-verified)
Use browser tooling to open the viewer, screenshot each of the 7 stages, and iterate the REALISTIC profile's look with actual visual inspection (the ChatGPT agent could not see its own renders). Keep the evidence-class banner and INTELLIGENCE/COMPARE profiles intact.

## Commands

```bash
npm install
npm run site:sweden:saterdalsvagen14:gate
npm run site:sweden:svartinge:prototype:gate
npm run site:sweden:svartinge:prototype:serve   # then open http://127.0.0.1:4173/prototype/svartinge-neighbourhood/
```

## Handoff contract

Every work session ends by reporting: branch + exact commit, files changed, commands run with exit status, claims promoted vs still blocked, and pushes it. Update this file's "Current state" section below as milestones land.

## Current state

- 2026-08-18: session founded. Baseline `3f6040f`. M1 blocked on Geotorget account/token. M2–M4 not started.
- 2026-08-18 (Claude, branch `agent/spatial-studio-claude`): re-derived the M1 block instead of trusting the label — live `curl -I` on both Lantmäteriet assets (`byggnad_kn0581.zip`, `fastighetsindelning_kn0581.zip`) still returns **HTTP 401 `WWW-Authenticate: Basic realm="Authorization Server"`**. M1 is genuinely credential-gated (no `.runtime/credentials`, no `LM_GEOTORGET_TOKEN`); M2 (real DEM/parcel) and M3 (sun/terrain on real DEM) are transitively blocked. First unblocked milestone is M4.
  - **M4 · first visual pass landed.** Browser-verified all 7 stages in INTELLIGENCE/REALISTIC/COMPARE. Two presentation-only REALISTIC improvements in `prototype/svartinge-neighbourhood/index.html`, both inside the realism-only `realismDecor` group (no evidence element touched, no source promoted):
    1. **Gradient sky dome** (`skyGradientTexture`/`skyDome`) replacing the flat solid `0x9fc1cf` background — atmospheric depth in every REALISTIC stage. Hidden in INTELLIGENCE (verified via COMPARE: evidence side unchanged).
    2. **Glan outlook legibility** — the PLOT_ORBIT camera already targets `[0,3.5,-230]` (straight at the existing decorative lake at z=-245) but the procedural tree wall occluded it. Opened a northward view corridor (skip scattered trees where `z<-22 && |x|<22`) and let the lake recede into fog with a light shimmer band. The lake now reads on the horizon in the neighbourhood and outlook stages — the plot's headline "Glan view" is finally visible.
  - Gate green after edits: `site:sweden:svartinge:prototype:gate` PASS (build; validate 518 assertions/7 stages/5 evidence classes; 80 mutation attacks; context adapter PASS; alignment PASS). `git diff --check` clean. Only `index.html` changed.
  - **NOT checked:** dark-mode/mobile viewport of the new sky; the shimmer band's look at non-noon sun angles; whether the corridor reads well from stages 4–7 close cameras (spot-checked 1/3/COMPARE only). M4 remains iterative — concept-house material and roof still plain white; road texture still flat.
  - Local-only (gitignored, not committed): `.claude/launch.json` for the preview server. The MCP preview launcher is intercepted by an unrelated global `oauth_catcher.py` hook; served the prototype via `node scripts/serve-svartinge-neighbourhood-prototype.mjs` on :4173 instead.
- 2026-08-18 (Claude, later): **M1 partially unblocked — Geotorget account is live** (kundnr 30056732, `oskar@hanssonhertzell.com`). Confirmed via read-only inspection of the account's Behörigheter: the **Markhöjdmodell Nedladdning** behörighet is granted (access point `api.lantmateriet.se/stac-hojd/v1`), and the 1 m DEM tiles are already downloaded + SHA-256 receipted under gitignored `.runtime/`. The **byggnader `0581`** and **fastighetsindelning `0581`** vector products (buildings + parcel polygon, on `stac-vektor`/`dl1`) are **not yet ordered** — those two legs of M1/M2 stay blocked until they are.
  - **M3 · real terrain evidence landed.** New reproducible `scripts/derive_svartinge_terrain.py` re-verifies the 4 tiles against the receipt SHA-256, cross-checks the pin transform (pyproj EPSG:4326→3006) against the viewer's SWEREF alignment control → **agreement 0.0000 m**. This also **corrected the download receipt**, whose pin was ~1.6 km north of truth and named the wrong tile; the true pin is **E559869.000 N6501790.310**, in tile `65000_5575_25`. Output committed as `data/sites/sweden/saterdalsvagen-14/terrain-dem-derived-v0.1.json` (derived product, HVD open-data licence + receipt hashes embedded; raw tiles stay in `.runtime/`): **pin 69.84 m RH2000; plot relief 13.93 m** (65.6→79.5, SW-low/NE-high); **slope 14.2°, aspect SW (207°)**; **Glan sightline (az 185°) descends 42.84 m over 800 m** — the "Glan view" has real topographic support (elevation/fall only; not an unobstructed sightline; legal gates stay OPEN). Gates green: saterdalsvagen14 740/28, prototype 518/80 + alignment PASS.
  - Deps: rasterio + pyproj in gitignored `.runtime/venv` (macOS Python 3.9). Re-run: `.runtime/venv/bin/python scripts/derive_svartinge_terrain.py`.
  - **⚠️ Branch collision resolved.** `repo/` was being shared concurrently by an active `agent/essence-moraira-pilot` session, which switched the shared checkout to its own branch mid-flight; the M4 (`6ef9ea6`) and terrain (`ab5b5cd`) commits therefore first landed in `essence-moraira-pilot`'s history. Recovered non-destructively: cherry-picked both onto `agent/spatial-studio-claude` in a **dedicated worktree** `../repo-spatial-studio` (new commits `fcf24b7`, `5d0dc7c`). **All spatial-studio work now happens ONLY in `repo-spatial-studio/`, never `repo/`.** Rescue tags `spatial-studio-rescue-{m4,terrain}` mark the originals. The two spatial commits still sit in `essence-moraira-pilot` history (harmless — different files); the Product Twin brain can strip them if it wants that branch clean. The `.runtime/` DEM tiles + venv currently live under `repo/.runtime/`; copy or symlink them into `repo-spatial-studio/.runtime/` before re-running the terrain script there.
  - **Correction (commit `36bad4d`):** the first terrain commit labelled the derived heights/slope/Glan profile `AUTHORITATIVE`. That was an over-promotion — `GATE_SE_TERRAIN` is deliberately OPEN and lists "RH2000 spot heights"/"slope or drainage conclusions"/"terrain mesh presented as official" as forbidden outputs, and the derivation used the `grid1m` tiles (different product path than the gate-tracked COG), skipping its QA. Downgraded to `evidence_class: DERIVED` with an explicit `gate_dependency` + `gate_tracked_asset_discrepancy`. Values unchanged; nothing promoted.
  - **M2 is NOT a quick viewer wiring — it is formal `GATE_SE_TERRAIN` closure (L2).** The gate/validator (`validate-svartinge-neighbourhood-prototype-v0.2.mjs` ~L180-198) are frozen at "metadata verified, raster NOT acquired" and pin the tracked asset to the single 10 km COG **`m650_55.tif` (246,140,605 bytes, multihash `1220789c7144…`)** — NOT the grid1m tiles already downloaded. Closing it requires: (1) acquire that exact COG and verify the multihash; (2) run the nodata/coverage + update-patch-boundary QA the metadata references (`source_at_plot.selection_method`); (3) flip `terrain-source-metadata` `raster_access` to acquired + add elevation/clip receipts; (4) **rewrite the gate's acceptance logic** in the validator + mutation suite (currently they *require* `KEY_REQUIRED`/`raster_bytes_acquired:false` and terrain `DERIVED`/`LOCAL_RELATIVE_UNCALIBRATED`); (5) then promote `TERRAIN_CONTEXT` heights + inject real vertices in the build. Changing a gate's closure criteria is significant — coordinate with the Product Twin brain before doing it.
  - **Also still open:** order the two vector products (fastighetsindelning + byggnad) in Geotorget to unblock the parcel/building legs of M2. Geotorget creds live in `repo/.runtime/credentials/` (LM_USER/LM_PASS, LM_GEOTORGET_*) — symlink `repo-spatial-studio/.runtime -> ../repo/.runtime` is set up (git-excluded) so scripts here can reach tiles + venv.
- 2026-08-18 (Claude, later still): **M1 terrain leg + M2 + M3 DONE — real authoritative terrain is live in the viewer.**
  - **Credentials:** two files in `repo/.runtime/credentials/`. `geotorget.env` (LM_USER/LM_PASS) is the **web login** (STAC API only). `lantmateriet.env` (LM_GEOTORGET_USER/LM_GEOTORGET_PASS) is the **download credential** — the one `dl1.lantmateriet.se` accepts (206). Use the latter for raster downloads.
  - **Raster acquired + verified:** the gate-tracked DTM COG `m650_55.tif` (246,140,605 B) is downloaded to `.runtime/lantmateriet/terrain-cog/` and its **sha256 `789c7144…` matches the tracked multihash `1220789c…`**. The four public-metadata companions (info/ursprung/thumbnail) match the validator's expected receipt hashes; provenance QA passes (pin in the 2020 base laser-scan polygon, east of every update patch, easternmost patch E556801).
  - **GATE_SE_TERRAIN CLOSED (commit `1604c62`).** `terrain-source-metadata` raster_access→ACQUIRED_VERIFIED (sha256 + byte-count tied to the tracked identity, credential NOT persisted), gate→CLOSED with closure_evidence + still_open_downstream. Validator now *requires* the acquired state and re-verifies the hash; mutation suite grew 80→**85** (forged hash, mismatched bytes, persisted credential, faked provenance, hidden downstream, demoted terrain — all rejected). Terrain element→AUTHORITATIVE + `RH2000_MINUS_LOCATOR_DATUM`; `drapeOnTerrain()` grounds context/concept elements + cameras on the real surface (54 m relief, −35..+19 m). Viewer decor draped via `groundY()` (commit `f005e7c`).
  - **Values:** pin 69.96 m RH2000; plot relief 13.5 m; slope 13.1° SW; Glan sightline falls 42.95 m/800 m. Far-east ~16% of the window clamped to the tile edge (m650_56 would fill it; not acquired — disk pressure).
  - **⚠️ maker≠checker:** this gate closure was authored in the producing session. The Product Twin brain should independently re-run `.runtime/venv/bin/python scripts/derive_svartinge_terrain.py` + `npm run site:sweden:svartinge:prototype:gate` (both re-verify the multihash) before relying on it. Boundary/access/utility/FFL gates remain OPEN.
  - **Remaining polish (cosmetic, non-blocking):** Plot Outlook camera wants retuning for the real descending hill; the flat plot clearing sits proud of the sloped plot; tiny street props (logs/conduits) not draped. Optional: acquire m650_56 for full east coverage; order fastighetsindelning+byggnad vectors for the parcel/building legs.
  - **Env note:** data volume was ~94% full mid-session (a 246 MB download briefly ENOSPC'd). `repo-spatial-studio/.runtime -> ../repo/.runtime` symlink (git-excluded) shares tiles+venv.
- 2026-08-18 (Claude, Brain-queue pass) — **realism ladder + real context, toward the goal "believe every pixel".**
  - **Live Mapbox satellite drape (commit `84b71d2`).** REALISTIC terrain textured with the Mapbox Static Images API (satellite-v9) for the 360 m window, over the real 3D relief. Terrain gains planar UVs; `drapeSatelliteTerrain(token)`/`undrapeSatelliteTerrain()` wired to the Live Context token flow (fires on valid token, decoupled from the heavier mapbox-gl connect). Evidence-safe: pixels live-only, **token never committed** (public `pk.` in `repo/.runtime/credentials/mapbox.env`), "© Mapbox · © Maxar" attribution shown. ⚠️ for a public deploy the token must be URL-restricted in the Mapbox dashboard; a visitor without a token sees procedural grass (satellite is opt-in).
  - **Real OSM neighbourhood (commit `260ec2d`).** `scripts/derive_svartinge_osm_context.py` (Overpass → `osm-context-derived-v0.1.json`, DERIVED, ODbL) replaces the 12 hand-placed blocks with **60 real building footprints (PCA-oriented boxes) + 18 real roads** (Säterdalsvägen, Gamla Landsvägen, Utsiktsvägen…), draped on the authoritative terrain. `ROAD_SATERDALSVAGEN` id preserved for the Street Room. Honest: crowd-sourced, superseded by the Lantmäteriet byggnad vector when acquired. Persistent ODbL+Lantmäteriet attribution added. Trees now respect building footprints (commit `027b07d`). Fixed a street-ribbon double-drape.
  - **Design-selector mount contract (commit `009a4b7`).** `docs/DESIGN-SELECTOR-MOUNT-CONTRACT.md` — Stage-4 mount anchor, proposed A/B/C spec shape, `mountDesign()/clearDesign()` hook, CONCEPT-only constraints. **Selector NOT built (Platform's job)**; Spatial Studio implements the hook once the spec is frozen. Coordinate with Platform + BRAGE.
  - **Also:** plot clearing draped onto slope + Plot Outlook camera retuned (`a8de798`).
  - **Goal scorecard** (goal: a 5-min visitor believes every pixel; extend the trunk look, don't fork): real terrain ✅ · real imagery ✅ (satellite) · real neighbourhood ✅ (OSM) · honest gates ✅ (COMPARE proves evidence≠presentation) · **real boundary ⏳ needs the `fastighetsindelning` vector (Oskar to order)** · **concept studio comparing designs on the land ⏳ needs Platform's selector (contract handed over)**. POIs intentionally stay diagrammatic (gate requires `DIAGRAMMATIC_NOT_GEOGRAPHIC`/`distance_m:null` — honest locality-presence, not surveyed position).
  - Full prototype gate: **838 assertions / 85 mutation attacks / context + alignment PASS.** All committed; push blocked in-session (Brain/Oskar push).
- 2026-08-18 branch state (superseded below): `agent/spatial-studio-claude` was ahead 5 of origin (`80e3d98` audit + `fcf24b7` M4 + `5d0dc7c` terrain + `aa9ed59` handoff + `36bad4d` correction). Push was permission-denied in-session; run `git push origin agent/spatial-studio-claude` from `repo-spatial-studio/`.
