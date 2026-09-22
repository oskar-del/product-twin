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

### Item 5 — Run Spatial's `scripts/build-site.py` · **DONE (late evening)**
Landed on `agent/spatial-studio-claude` (`8149d16bac`). First run exited non-zero with a **PROVENANCE
CONFLICT** banner caused by a label in *my* file — see the label fix below. After that fix:

```
python3 scripts/build-site.py <djuro site dir>        exit 0, no banner
receipts      10 files · 10 entity types
boundary      5 156.3 m² · 9 corners (10 stored points, ring closed) · 10 context parcels
terrain       11.5 m fall · slope 8.1°
buildings     35 official footprints · 4 on the parcel
shoreline     0.2 m to modelled shoreline
viewshed      43.9% open-water arc
findings      10 · gates 7 closed / 4 open (from findings.json + gates.json)
provenance QA 4 checks · 4 NOT ESTABLISHED
rendered      7 metrics · 5 evidence cards
archive check 2 re-hashed · 0 not on disk
```

**Republished to the same artifact URL** `claude.ai/code/artifact/7a1359ec-193a-48dd-a434-8dc530333f87`.
Verified in a browser, not just from the log: screen 1 renders metrics, findings and the full gate
table **including both VERIFIED_NEGATIVE results with their control counts**; screen 2 renders the
twin from the DTM heightfield with flat footprints and the footer *"building heights NOT established"*.

**The label fix was a script bug, not a file typo.** `property-division-derived-v0.1.json` said
`source_product: fastighetsindelning_kn0581` — Norrköping. The geometry was always right (raw sha256
`2dc19757…880` matches `lm-data/fastighetsindelning_kn0120.zip` byte-for-byte); only the label lied.
Root cause: `ingest-property-division.py` **hard-coded** the product name, so *every site it ever ran
on* would carry the same wrong label. It now derives the name from the `.gpkg` entry inside the
archive it just hashed and refuses an archive without exactly one. Copied `svartinge-*` schema
prefixes genericised in the scripts too. Two `Svärtinge` mentions remain and are **true statements,
not copied labels** — the Geotorget grant really is the same one, and the reconciliation prose really
does refer to the template.

**Four generator defects reported to Spatial (their file, not patched here):**
1. **Priority.** The ground card renders *"Plane slope 8.1° slope WNW"* — duplicated word, and it
   labels the Horn 3×3 **pin** measure as a **plane** measure, so the card contradicts its own next
   sentence. This is the conflation this session spent the day untangling, now in template wording.
2. `"in 1 separate arcs"` — plural agreement.
3. Metric tile `OFFICIAL FOOTPRINTS 35` has no sub-label; 35 is the 200 m context clip, 4 are on the
   parcel.
4. Nested finding values render as raw Python `repr`.
Plus: the generated `<title>` replaced the artifact's stable name. **Brain has adopted the stable
`<title>` rule fleet-wide.**

✅ **ESCALATION RESOLVED.** Both concerns are gone: the page was regenerated, so strandskydd is no
longer "presumed" (it reads *"Strandskydd reaches this parcel … 100.0% of the parcel lies inside the
100 m band"*) and the sea-view figure now carries its bare-earth ceiling (*"A viewshed from the height
model — no rendered horizon is a view claim"*). The slope concern was mine and was withdrawn.

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

**NEXT SESSION PICKS UP HERE.** Brain: *"nothing further queued for Djurö until the template fixes
land (then one regenerate + republish)."* When Spatial ships the four generator fixes, re-run:

```bash
python3 scripts/build-site.py "$PWD/data/sites/sweden/djuro-byvag-34" \
  --out data/sites/sweden/djuro-byvag-34/site-intelligence-landing.html
```
(from the `repo-spatial-studio` worktree), confirm exit 0 and no banner, then republish to the **same**
artifact URL `7a1359ec-193a-48dd-a434-8dc530333f87`. Never patch the page by hand; never publish to a
new URL.

**Two things left genuinely open, neither blocking:**
- `GATE_SE_STRANDSKYDD_DISPENS` and `GATE_SE_VIEW_OCCLUSION` (plus `BUILDING_HEIGHTS`,
  `TERRAIN_PROVENANCE`) — 4 open gates, all recorded in `gates.json` with reasons.
- **NOT CHECKED:** the genericised `schema_version` values have never been run against Svärtinge, so
  no one has proved they don't regress the reference site. Brain has routed that to Spatial as part
  of its item 4.

### ⏸ PENDING — canonical buildings ingest + geometry-hash helper (no action until Spatial ships it)
Spatial's live re-ingest reproduced the property division identically but the **buildings**
`derived_geometry_sha256` differs from theirs despite identical data (35 footprints, same raw sha).

**Brain's diagnosis — that this side hashed the receipt DOCUMENT rather than the geometry — is wrong
for this repo, and it is worth not building a helper on it.** Both scripts already hash geometry
only (`[b["footprint_rings_local"] for b in buildings]`); the blob here contains nothing but
coordinates — no `object_id`, no `type`, no `placement`. Verified by inspection of the blob.

The divergence is **two serialisation differences**, both demonstrated on this site's data:

| cause | this repo | repo-spatial-studio | effect |
|---|---|---|---|
| JSON separators | `separators=(",",":")` (compact) | default (`", "` / `": "`) | `1af0d502…` vs `7c22d248…` |
| list order | `ON_PARCEL` first, then distance | query order, unsorted | `1af0d502…` vs `1b60b232…` |

**Precision is NOT a cause** — both round `(x - e0, 3)` at ingest, so a fixed-precision rule is
harmless but addresses nothing.

Brain's proposed fix still works (canonical ring serialisation + sorted by object id), because it
pins exactly the two things that actually differ. Under it this site's hash becomes
**`1b60b2321eb8da9929dd0b45597aa91958ab4fc453b5e38e8bd794d4e80df505`** (sorted by `object_id`,
compact separators) — expect the committed `1af0d502…` to change to that on the re-run, and that
change is correct, not a regression.

When Spatial says the shared helper is in: re-run `scripts/ingest-buildings-official.py`, confirm the
geometry hash matches theirs byte-for-byte, and record `derived_geometry_sha256_method`. Nothing
changes here before then.

## ✅ DJURÖ IS COMPLETE. **9 CLOSED / 18 OPEN / 27** (validator 120 passed, 0 failed).

**Geometry hash is now shared by implementation, not by assertion** (2026-09-22). The canonical form
lives in `repo-spatial-studio/scripts/geometry_hash.py` and is **imported by relative path, never
copied** — a copied canonical form stops being canonical the moment one copy is edited.
`ingest-buildings-official.py` uses it and reproduces Spatial's hash byte-for-byte:

```
derived_geometry_sha256  1af0d502…  ->  50c2e422…6717   (matches Spatial exactly)
```

That change is **the fix landing, not drift** — the old hash used `json.dumps` defaults, whose
separators and list order are invisible in review. Nothing else in the receipt moved: counts, areas
and all 35 footprints are identical. 35 rows / 34 unique ids — one multi-part building (a single
`objektidentitet` with two rings), which the helper groups rather than rejects.

### ✅ Property division landed too — joint commit with Spatial (`bbb04cfa0a` + this one)
Both pipelines switched in one coordinated move, each pasting its hash before either committed.
They matched first time:

```
subject   e3e7baf4…   id registerenhetsomradesyta:3021261   (the register's id, never the designation)
context   27963a1f…   10 parcels, hashed SEPARATELY from the subject
method    geometry_hash/v1+p-3+c44.59.124.10+sorted_by_object_id+grouped_parts+xz_only
```

`context_clip_buffer_m: 250.0` travels **with** the context hash — two context hashes computed at
different buffers are two correct answers to different questions, and without the buffer beside them
they read as a disagreement. Same shape on both sides.

**Validator: 122 passed, 0 failed, 6 hashes re-derived** (was 4 — the buildings hash is now
recomputed too; before this it was declared and never checked by anything).

### ⛔ SUPERSEDED — the hold below is lifted; kept for the reasoning

`scripts/ingest-property-division.py` also hashes geometry and has **deliberately not** been
switched to the shared helper. Spatial's pipeline and this one **already reproduce `d5aaa775…`
identically**, so changing one side alone would *break* an agreement that currently holds. It needs
a **joint commit with Spatial**, who will ping when ready. Switching it unilaterally looks like
finishing the job and is the opposite.

Related, not adopted: the three `derive-*` scripts hash a *derivation* (statistics, slope, profile),
not geometry — the helper does not apply there. Their field name `derived_geometry_sha256` is a
misnomer; a fleet-wide rename to `derivation_sha256` is routed to Spatial.

`GATE_SE_MUNICIPAL_JURISDICTION` now closes on a registry rule I proposed (Spatial `598b1132ab`):
`requires_pattern` on the **kn code** inside the authoritative property-division `source_product`,
because Lantmäteriet publishes fastighetsindelning per kommun. The geocoded kommun **name** stays
REPORTED and closes nothing. Note the dependency — that rule only matches because the `kn0581`
mislabel was fixed first; a lying label would have silently kept this gate open.

Validated with `repo-spatial-studio/scripts/validate-gate-ledger.py`: **117 passed, 0 failed**,
4 hashes re-derived, 0 unresolvable refs. Pass the browser's own numbers or it records a
NOT-VERIFIED line rather than a pass:

```bash
python3 "../repo-spatial-studio/scripts/validate-gate-ledger.py" \
  --site "$PWD/data/sites/sweden/djuro-byvag-34" --rendered-closed 9 --rendered-total 26
```
 The page is generated end-to-end by
`build-site.py`, the gates are on the canonical registry, and the artifact is live at its stable URL
**claude.ai/code/artifact/7a1359ec-193a-48dd-a434-8dc530333f87**. Any future change is: edit a
**script**, re-run it, regenerate the page, republish to that **same** URL. Never hand-patch the page.

## 🌙 LATE — receipt-tolerant ledger generator · **DONE** (`0540b3a762`)

`scripts/build-findings-and-gates.py` could only ever run on Djurö: it loaded shoreline, viewshed and
municipal-planning receipts unconditionally, and Svärtinge has none of the three. Now **every receipt
is optional** — indexed by `entity_type`, never filename — and a finding or gate whose evidence is
absent is **emitted as OPEN carrying the reason**, never skipped and never inferred from the receipts
that *are* present.

**Field-level tolerance, which the Svärtinge run forced out.** A receipt can be present without
carrying the field a finding needs, because the two sites came off different pipeline versions.
Svärtinge's buildings have no `placement`; its terrain has no `parcel_height_statistics`,
`parcel_slope` or `tile_integrity`. Handled like absent receipts, but the reason **distinguishes the
two** rather than conflating them:

```
receipt not present: ShorelineAndStrandskyddDerivation
field not present in OfficialBuildingFootprintClip: placement
```

That distinction matters — Svärtinge *does* hold the buildings receipt, and saying otherwise would put
a false statement in its ledger.

**More of the kn0581 bug, found while doing this.** The generic generator still carried Djurö
literals: `5,156.3 m²`, `Värmdö kommun (0120)`, `KN0120`, `DJURO`, and a Djurö acquisition date.
Registered area is now shoelace-computed from the authoritative ring; kommun and the KN suffix come
from each site's own receipts; the site token from the directory name; and `derive-terrain-dem.py`
emits `source_retrieved_at` so no date is ever typed. The shoelace reproduces **5156.3 exactly**,
which is why Djurö's numbers did not move.

**Proof (run timestamps normalised):** findings array identical (10) · receipts identical (4) · gates
identical (11, 7 closed / 4 open) · counts identical. Three metadata lines differ deliberately —
`receipts_absent`, `fields_absent`, and an extended `rule`. **Brain ruled: keep them**; array
identity is the proof that matters.

**Svärtinge dry run** (on a *copy*; its repo untouched): exit 0, subject resolves, 2 receipts, all 10
findings and 11 gates emitted, 1 closed / 10 open. A sparse ledger is Svärtinge's honest state against
those receipts, not a regression.

### Follow-up landed — **DONE** (`8197fbb6e4`)
Spatial's canonical registry (`agent/spatial-studio-claude` `62e66af982`,
`scripts/build-gate-ledger.py`, `config/gate-registry.json`) is the union of Svärtinge's 18 and this
site's 11 = **26 gates**. Run it read-only with an **absolute** `--site` path (it resolves relative
paths against its own repo root, not yours):

```bash
python3 "../repo-spatial-studio/scripts/build-gate-ledger.py" --site "$PWD/data/sites/sweden/djuro-byvag-34"
```

**Djurö: 9 CLOSED / 17 OPEN / 26** — decided by generic 11 · registry rule 2 · carried forward 0 ·
open by default 13. (Was 8/18 until `GATE_SE_MUNICIPAL_JURISDICTION` gained a rule; see below.) Vocabulary is `CLOSED`/`OPEN` only; the old Svärtinge record's `SATISFIED` is gone.

**Survival was verified gate-by-gate, not assumed** — a silent drop is the real risk in a registry
swap. All 11 previous gates are accounted for: 7 still CLOSED (one renamed,
`GATE_SE_DETALJPLAN` → `GATE_SE_DETAIL_PLAN_AND_STATUS`), 4 still OPEN. The single new closure,
`GATE_SE_PLOT_IDENTITY`, is correctly scoped — title and ownership stay with `GATE_SE_PROPERTY_REGISTER`,
which remains open.

### Messaging note for the next session
`SendMessage` to a peer's **display name** does not resolve (`"3: Plot-to-Project Spatial Studio"` →
*no agent reachable*), and `ListAgents` shows only opaque `ai-XX` names. Use the **session id**:
- Brain — `local_04110150-7524-435e-ad0b-3b38fb1c0ccd`
- Spatial — `local_bc842a9e-d68c-4357-85a2-cfce16389cad`

**NOT checked:** Svärtinge's stale 2026-09-07 ledger is **not** regenerated in place — that is
Spatial's run, against its own directory. And nobody has checked how `build-site.py` renders a finding
with a null value and `verification: OPEN`; worth looking before any Svärtinge page is published from
this.

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
