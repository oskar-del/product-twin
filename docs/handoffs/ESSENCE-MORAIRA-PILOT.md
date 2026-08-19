# Essence Moraira Pilot — Claude Session Handoff
*The Spanish sibling of the Svärtinge Spatial Studio. Seeded 2026-08-18.*

## Role

Persistent **Claude** specialist session for the Essence Moraira pilot: showcase the plot-to-project **spatial
flow** to a real builder (Grupo Turis Promociones) using their live multi-villa off-plan project in Moraira.

- Repository: `oskar-del/product-twin`
- **Branch: `agent/essence-moraira-pilot`** (branched from `agent/spatial-studio-claude`)
- **Checkout: `/Users/oskarpeterson/Documents/AI/product twin/repo/`** — work ONLY here.
- ⛔ Never edit anything under `~/.codex/.chatgpt-projects/` — ChatGPT's worktrees, possibly mid-task.
- Sync: GitHub is the only shared truth. Pull before starting, push after every coherent step.
- Client-facing media (films, decks) go to the **vault**: `~/Documents/Opero/Concept Casa/Projects/Essence Moraira ( TURIS )/`
  (create on first use). The repo carries code, geometry, evidence and docs — no heavy media, no client negotiations.

## Scope — LOCKED

**Spatial showcase ONLY.** Video + 3D mapping of the neighbourhood. Explicitly OUT: commerce, furniture/avatars,
any change to their designs. Their architecture is the fixed input — we never restyle it. Their photography is
used wherever it exists (it is good); generative media only for what cannot exist yet: the assembled street from
above, the drive-by, motion. The product being demonstrated is OUR FLOW, on THEIR project, as a gift-shaped pitch.

## Why this project

- Grupo Turis: 12 projects on their site, strong photography, **zero videos** (verified 2026-08-15).
- We are their sales agent — their projects are in the H&H feed WITH floorplans and specs. Using their public
  assets to market their villas is our normal agency activity. Near-zero rights friction.
- Essence Moraira Villas: small multi-villa off-plan cluster — the exact scale where "how do the houses relate?"
  is the buyer's unanswered question, and small enough to model completely.

## The buyer question we answer (the showcase thesis)

Off-plan buyers fear what they cannot see: *what will stand around me?* No builder video shows it. We deliver:
- the street from above with every villa placed on its real plot,
- the drive-by along the real road,
- **measured** relations: "from villa A's terrace you see villa B's roof, N m away", sun on each terrace by season,
  privacy angles between plots.
Every spatial claim computed from geometry, never eyeballed — that is the differentiator we are showcasing.

## Pipeline (every stage has a proven precedent)

| Stage | Method | Precedent |
|---|---|---|
| 1 · Locate plots | Listing/feed address → Catastro INSPIRE WFS parcels (refs, areas, exact polygons) + OVC per-parcel record | CANOPUS parcel lock (area+proximity match, never eyeballed) |
| 2 · Survey | IGN MDT05 5 m LiDAR via IDEE WCS (`Elevacion4258_5`), cross-check EU-DEM; PNOA aerials + time-series | `canopus_survey.py` |
| 3 · Massing | Villa volumes from THEIR floorplans (footprint + storey heights + roof), placed on real terrain, all villas + street in one scene | `canopus_model.py`; NEIGHBOURHOOD-TWIN-ALPHA contract |
| 4 · Measured claims | Inter-villa sightlines, per-plot sun path, privacy angles, view analysis (Moraira: sea visibility per floor is worth testing — elevation decides it) | CANOPUS sightline/solar engine |
| 5 · Stills | Geometry-true cameras from the scene (aerial, drive-by frames, terrace views), composed FOR their camera move | 3D views + composition-for-the-move |
| 6 · Motion | Image-to-video (Replicate), scene-life-first prompts, model-per-shot budget, edited film + score | `canopus_film.py` / `canopus_edit.py` |
| 7 · Optional viewer | Interactive street walk, INTELLIGENCE/REALISTIC profiles | `prototype/svartinge-neighbourhood/` 7-stage viewer |

## Hard rules (inherited)

- Evidence-bearing claims only; every source receipted; seller/builder-stated figures labelled as such.
- "Checked" = opened and looked at. Video QC = watch sampled playback + vision-model review; a metric where bad
  output scores well is worse than none.
- Never feed annotated images to generative models. Clean + annotated variants always.
- Prompt order: scene life first, camera last. Compose each still for its intended move.
- Deliverables built from a required-contents list, not from available assets. Publish the gaps.

## First milestones

### M1 · Asset + plot acquisition
Pull Essence Moraira from the H&H feed (floorplans, specs, photos, price list) + their public site. Resolve the
exact parcels via Catastro; confirm villa count and positions. **Open input from Oskar: exact address/urbanisation
if the listing is ambiguous.**

> **M1 progress (2026-08-18) — evidence in `data/sites/essence-moraira/`:**
> - Feed pull **DONE (negative):** Essence Moraira is *not* in the current H&H Janela feed
>   (`0500015622.xml`, 36 props; no Turis/Benicolet/titled Essence). Primary source = the developer
>   microsite `essencemoraira.com`: **4 villas**, Calle Benicolet Teulada-Moraira, architect Pepe Giner.
>   Builder-stated plots/builts: V1 1413/346 · V2 1128/410 · V3 1223/373 · V4 "Essence Patio" 5147/443 m²
>   (Villa 4 reserved). All 4-bed.
> - Parcel lock **PARTIAL:** street + all 16 Calle Benicolet parcels locked with authoritative Catastro
>   geometry (area, WGS84+ETRS89 centroids, use, build year). Cluster centre ≈ 38.700505 N, 0.119172 E.
>   Exact 4 Essence parcels **NOT** locked — the villa plot sizes don't reconcile with current parcels and
>   every candidate still carries a 1987–2000 building; the re-parcelling/demolition hasn't propagated into
>   Catastro. See `data/sites/essence-moraira/catastro/README.md`.
> - **Close-out input needed:** Turis plot plan / cadastral refs, or a geolocated plot boundary
>   (point-in-polygon closes it deterministically). Until then, M2 site envelope = the Benicolet block;
>   per-villa boundaries PROVISIONAL.

### M2 · Site twin
Survey pack (terrain, aerials, boundaries) + all villas massed on the real street. Sightline/sun/privacy matrix
computed. This alone is showable.

### M3 · The film
Per-villa hero moments (their photos + motion) + the neighbourhood assembly (aerial, drive-by, terrace relations)
with measured callouts. Vault delivery + a one-page showcase note for the Turis meeting.

### Exit criteria
A Turis-ready showcase: film + aerial stills + relations matrix, all claims measured, nothing invented about
their architecture. Success = Turis meeting booked with it; stretch = they commission it for the next project.
