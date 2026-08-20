# 01 · Evidence read — what BRAGE designs *from*

BRAGE never designs against unread evidence. This sheet is the honest inventory: what the site tells us, and how firmly.

Scene coordinate convention (from `neighbourhood-scene-v0.2.json`): metres, local origin near plot centre. **South (the lake / view side) = negative Z. East = positive X.** Plot long axis runs E–W.

## Plot geometry — `INDICATIVE` (municipal map trace, no legal effect)
Trace polygon (X,Z metres): `[-27.58,-19.02] · [25.67,-16.17] · [29.48,16.17] · [-22.82,21.87]`

| Metric | Value | Note |
|---|---|---|
| Area | ~1,938 m² | INDICATIVE (NOKA map surface); listing says 1,939 m² (REPORTED) |
| E–W extent (long axis) | ~57 m | The plot is **wide, not deep** — invites a bar along the frontage |
| N–S extent (depth) | ~41 m | Room for house + generous south garden between house and lake |
| South edge (P1–P2) | lake / view / sun side | The whole design opportunity is here |
| North edge (P3–P4) | assumed street/access side | Access is **UNVERIFIED** — road-manager/driveway gate open |

## View — `REPORTED_UNVERIFIED`
- Glan lake view, direction cone **azimuth 185° (≈ due south)**, reported by seller. No viewshed / obstruction analysis has been run. Trees and future neighbouring build could occlude it.
- **Design consequence:** we orient *toward* the south view but do not stake the concept on a view we haven't measured. A [View Certificate](../../../../docs/VALUE-STORY-AND-IDEA-LEDGER.md) (measured viewshed per window) is the correct next MIMER step and would upgrade this from REPORTED to DERIVED.

## Sun — `DERIVED` (latitude 58.65°N, standard astronomy)
This is the design's real engine, and it is honestly computable.

| Season | Sunrise az | Sunset az | Noon altitude | Design meaning |
|---|---|---|---|---|
| Summer solstice | ~40° NE | ~320° NW | ~54.7° | ~18 h day. **Evening sun swings W→NW, low.** |
| Equinox | 90° E | 270° W | ~31° | Balanced. |
| Winter solstice | ~140° SE | ~220° SW | **~7.9°** | ~6 h day; sun hugs the **south** horizon all day. |

Two consequences the Brain missed:
1. **Winter light + passive gain + the lake view all point SOUTH** — they *align* (the opposite of the Marbella view-vs-sun conflict). A generous south glass wall is therefore triple-justified: view, scarce winter daylight, low-angle solar gain.
2. **The prime Swedish outdoor-living hours (≈18:00–21:00, May–Aug) are lit from the W/NW.** A terrace that only faces due south goes into the shadow of its own house exactly when the family sits out on a July evening. **"Kvällssol" (evening sun) must be an explicit design target, not an accident.**

## Wind — `REGIONAL` (Östergötland / lake-edge climate, not site-measured)
- Prevailing winds SW; add a cool katabatic/lake breeze off Glan on clear evenings from the S.
- A terrace lying open and flat to the SW lake is wind-raked in exactly the SW/W sector we also want open for evening sun — a real, resolvable tension (see winner: open the west to low sun, screen the SW gust with a *built* windbreak, not a heated wing).
- Site anemometry would upgrade REGIONAL → DERIVED; not required to set the parti.

## Terrain — `UNRESOLVED` (raster HTTP 401)
- Lantmäteriet 1 m DTM item `650_55` identified but the asset returned 401 without credentials. **No slope, no fall line, no cut/fill.**
- SGU: glaciofluvial sediment, modelled ~9 m to bedrock at the pin, but nearby observations swing 0–22 m → **foundation-cost uncertainty, not a design parameter.**
- **Design consequence (the key discipline):** any concept that *requires* a slope — e.g. a walk-out souterräng — is betting on unread evidence. The winner must be **slope-agnostic**: correct on a flat plot, *upgradeable* to a walk-out lower level only if the DTM later confirms a south fall of ≳2.5 m across the building footprint.

## Regulatory envelope — mostly `UNRESOLVED`, one strong signal
- Governing plan `0581K-22D:1008` (Avstyckningsplan, in force 1936) signals **one dwelling per plot** and an original ~3,000 m² average lot — historic signal, not a current entitlement; amendment chain unresolved.
- 2026 Svärtinge consultation proposal points at min plot 1,000–1,200 m² for `Övre Svärtinge`, "utvecklad användning" — consultation only, not effective.
- **Design consequence:** one house, one family — no subdivision fantasy. Footprint and height stay conservative (H30-style 1.5-plan trähus) until BYA/BTA and H30/H50 eligibility close. Keep the heated envelope compact — cheaper, and it de-risks the open BYA gate.

## Resale psychology — Svärtinge village (`TASTE` / market-reasoned)
Svärtinge is a lake-adjacent commuter village NW of Norrköping: buyers are Norrköping families and downsizers, conservative Östergötland market. What this buyer pays for, in listing language:
- **"Sjönära / sjöutsikt"** (lake proximity/view) and **"kvällssol"** (evening sun) — literal Hemnet keywords that move price here.
- Generous **single-level or 1.5-plan** living (families + aging-in-place), a **double garage/carport**, low **drift** (running cost), a genuinely usable garden.
- They do **not** pay a premium for fragmented pavilions (read as odd, cold, expensive to heat, slow to resell here) or for deep basement drama (reads as "damp"). Architecture that photographs warm and *ordinary-plus* beats architecture that photographs clever.

**Net brief for the diverge set:** one compact, warm, low-drift family house that takes the south lake view and winter sun through a big south face, *and* earns its evening-sun terrace against wind — on a plot whose slope we have not yet measured.
