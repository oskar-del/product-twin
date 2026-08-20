# Request · BRAGE → Brain — Svärtinge 54:28, unblock design v0.3

From: BRAGE (`agent/brage-design`) · Date: 2026-08-20 · Re: `SVÄRTINGE 54:28`

BRAGE has produced the first design package — the judged four-directions study and the developed winner **"Vinkelhuset mot Glan"** (see `OPEN AI/Säterdalsvägen 14 - Svärtinge/04-House-Design/BRAGE/`). The concept is deliberately built to survive the open evidence gates: it is correct on a flat plot and orients to a reported view. To promote it from **CONCEPT** toward a checkable v0.3, two data requests sit **above BRAGE's scope** and need the Brain to route them to MIMER / Platform (both require external access / credentials the design session does not hold).

## Correction to the seeding brief
The handoff stated *"MIMER data is complete."* It is **not**, and the design study says so plainly. Verified today: address→property locator, governing-plan signal, SGU soil, RAÄ, EBH screens. **Not** verified: registered boundary/area, buildable envelope (BYA/BTA), legal access, utility capacity, **terrain (1 m raster returned HTTP 401)**, and the **Glan view (seller-reported, no viewshed)**. Sun and wind are derivable from latitude + regional climate and carry the parti honestly.

## Request 1 — the 1 m DTM (terrain)
- **What:** Lantmäteriet Markhöjdmodell 1 m item `650_55` (SWEREF 99 TM + RH2000). The advertised raster returned **401 without credentials**.
- **Unlocks:** slope, fall line, cut/fill, and the **finished-floor datum** — and specifically **confirms or kills the west-end walk-out souterräng**, currently held as a *conditional toggle* (`WEST_SOUTERRANG`, fires only if south fall ≳ 2.5 m across the bar footprint). Until then the section is drawn flat.
- **Route:** requires the Lantmäteriet download-access grant (the LM parcel/building GDPR grants already pending — `LM2026/114814`, `/114822` — are the same access class).

## Request 2 — Glan viewshed
- **What:** a measured viewshed from the proposed **south glass at eye height** (~1.6 m standing, ~1.2 m seated) over the terrain + context buildings, per the CANOPUS "view from here" method.
- **Unlocks:** promotes `VIEW_GLAN` from `REPORTED_UNVERIFIED` → `DERIVED`; tells us whether the Glanrummet actually *sees* the lake or whether trees/future build occlude it (a design-changing answer). Doubles as a productisable **View Certificate** for the listing (already in the idea ledger).
- **Route:** Platform can run it on the existing scene once the DTM lands (Req 1 is a soft dependency for accuracy, but a context-massing viewshed can run now as a first pass).

## Ready for Platform now (no permission needed)
- `geometry/house-v0.2-geometry-spec.json` — developed house geometry in scene-v0.2 coordinates.
- `geometry/house-in-scene-v0.3-patch.json` — a remove/add patch that swaps the v0.1 single-box concept for the developed L in the neighbourhood scene, context untouched. **Platform can apply this to render v0.3 today**; the two requests above then upgrade the evidence class of the ground it stands on.

## Decision asked of the Brain
1. Approve routing Requests 1 & 2 (both need external access / credentials).
2. Confirm the vault path: BRAGE placed sheets at `OPEN AI/Säterdalsvägen 14 - Svärtinge/04-House-Design/BRAGE/` (the real MIMER project folder), not the handoff's non-existent `Opero/Concept Casa/...` path.
