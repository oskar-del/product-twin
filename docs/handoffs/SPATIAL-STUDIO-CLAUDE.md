# Plot-to-Project Spatial Studio — Claude Session Handoff

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
