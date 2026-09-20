# Avatar Factory (Claude) — persistent handoff

> ## ⛳ SPRINT DAY — 2026-09-20 (Brain; Oskar runs all sessions today. Supersedes every earlier pin — the 2026-09-15
> CONSOLIDATION decisions still stand: one site per address · six screens · ink chrome · Platform owns the chrome.)
> RULES OF THE DAY: pull first · work the queue in order · each item ends with a screenshot in docs/screens/ + numbers ·
> commit after every item (Oskar pushes hourly) · nothing invented; every figure computed from receipts · report
> "DONE / NOT checked" per item in your handoff at end of day. Chrome tokens until Platform ships the package:
> bg #101916 · card #17241f · paper #f5f1e8 · bronze #d8b874 · serif display · Inter labels · evidence chips
> authoritative #176b52 / indicative #c18a2d / derived #497aa2 / reported #a65b68 / concept #735a9e.
>
> **AVATAR — placeability is the number that matters.**
> 1. `dimensions_mm` + `dimensions_source` on EVERY twin, cascade: GLB bounds > Shopify options > description regex >
>    title regex. Zero-LLM. DoD: per-catalog table "% placeable before → after" in the handoff (Newport, Kungsängen,
>    Mjuk, Lampemesteren, Lampan, Golvpoolen, Gripsholm, vidaxl-outdoor).
> 2. Category/role mapping for the 6 CATALOG_ONLY catalogs via the title classifier → base/attach/free roles stamped.
>    DoD: counts per role per catalog.
> 3. Bedroom hero proxies: Kungsängen beds (top 20 by fit) + Lampemesteren pendants/table lamps (top 20). DoD: GLBs in
>    data/geometry/avatars/, list in handoff. (Raw feeds + Meshy test meshes live under .runtime/, never git.)
> 4. Material truth: material_cues → Blender overrides in scripts/hero_still_poc.py; one re-render committed.


## 📓 SPRINT DAY 2026-09-20 — DONE / NOT checked (Avatar Factory)

Commits on `agent/avatar-factory-claude` (Oskar pushes): `5d4475cf` · `cf771182` · `3b97ef01` · `485d6fad` · `b98cf3a4`
Screens: `docs/screens/01-placeability.png` · `02-classification.png` · `03-bedroom-heroes.png` · `04-material-truth.png`

### Item 1 — dimensions_mm + dimensions_source on every twin
**DONE.** `scripts/extract-dimensions.mjs` (zero-LLM). Placeability (full W×D×H):

| catalog | before | after | footprint only (W×D, height unknown) |
|---|---|---|---|
| vidaxl-outdoor | 0.0% (42) | **6.9%** (6,131) | 11,011 |
| golvpoolen | 0.0% (0) | 0.1% (47) | 1,539 |
| kungsangen | 0.0% (0) | 0.0% (0) | 22,842 |
| lampemesteren | 0.0% (0) | 0.0% (3) | 3,181 |
| newport | 28.0% (3,645) | **28.2%** (3,673) | 73 |
| lampan | 0.0% (0) | 0.0% (0) | 3,448 |
| mjuk | 0.0% (0) | 0.0% (0) | 4,653 |
| gripsholm | 0.0% (0) | 0.0% (0) | 116 |
| **TOTAL** | **1.7%** (3,687) | **4.4%** (9,854) | **46,863 (21.0%)** |

Any usable dims: **56,717 (25.4%)**. Re-prove: `node scripts/extract-dimensions.mjs` (dry) → `.runtime/dims-report.json`.

Two cascade tiers measured and found EMPTY rather than assumed:
- **GLB bounds yields 0.** All 3,882 twins with an `asset_path` already had full W/D/H — the proxies were built *from* dims, so the tier is circular.
- **description regex is a no-op for 7 of 8 catalogs.** Only Newport ships a `desc` field (3,945/4,000 sampled); the rest have none, so the cascade is title-only there.

**NOT checked:** heights for the 46,863 footprint-only rows do not exist in any source field — these are NOT placeable and the room compiler must not treat them as such. `double_wd_cm_assumed` reads a unitless "80x200" as cm by Swedish market convention (mm would be absurd at that magnitude); not independently verified against a Kungsängen spec sheet. No dimension was checked against a physical product.

### Item 2 — category + attach-role for the 6 CATALOG_ONLY catalogs
**DONE.** `scripts/classify-catalogs.mjs`. **98.1%** of 121,382 classified — 95,422 REPORTED (merchant's own taxonomy) / 23,594 DERIVED (title keywords) / 2,366 unmatched. Roles: **91,245 base · 21,940 attach · 5,831 free**.

| catalog | twins | taxonomy | title | unmatched | cov% | base | attach | free |
|---|---|---|---|---|---|---|---|---|
| golvpoolen | 59,720 | 59,472 | 3 | 245 | 99.6% | 47,598 | 6,888 | 4,989 |
| kungsangen | 23,822 | 0 | 23,160 | 662 | 97.2% | 21,860 | 1,182 | 118 |
| lampemesteren | 19,516 | 19,194 | 175 | 147 | 99.2% | 12,817 | 6,180 | 372 |
| lampan | 10,874 | 9,574 | 185 | 1,115 | 89.7% | 6,419 | 2,990 | 350 |
| mjuk | 7,284 | 7,028 | 71 | 185 | 97.5% | 2,551 | 4,546 | 2 |
| gripsholm | 166 | 154 | 0 | 12 | 92.8% | 0 | 154 | 0 |

kungsängen's `category` field is empty on all 23,822 rows — title-derived by necessity, not by choice.

**NOT checked:** accuracy was audited by SAMPLING leaf→category decisions, not exhaustively. 2,366 unmatched rows are unclassified and invisible to the room compiler. `attach.role` is a category default, not a per-SKU judgement — no slot geometry is implied.

### Item 3 — bedroom hero proxies
**DONE.** 40 GLBs in `data/geometry/avatars/`: 20 Kungsängen beds (19 × 1600×2000, 1 × 1400×2000) + 20 Lampemesteren pendants (Ø950–Ø1200). List: `.runtime/bedroom-heroes.json`.

Footprint is REAL (parsed from title). **Heights are CATEGORY DEFAULTS** — bed 600mm, pendant 300mm, table lamp 420mm — used for geometry only; the twins' `dimensions_mm.height` stays `null`. Recorded in `geometry.scale_state` + `geometry.height_source`.

**NOT checked:** no bed height verified against a Kungsängen spec. 19 of 20 bed proxies are byte-identical geometry (same footprint, different model names) — distinct SKUs, indistinguishable shapes. Pendant drop/cable length is not modelled, so these hang at origin.

### Item 4 — material truth into Blender
**DONE.** `scripts/material_truth_lib.py` + `hero_still_poc.py` (v4). `material_cues` stamped on **132,745 twins with a colour** and **29,311 with a material**, copied verbatim from the merchant feed (evidence `REPORTED`). Demo still: 11 of 13 pieces resolved from the merchant's own colour word; 2 controls fell back to a flagged neutral.

Feeds shipping NO colour at all: kungsangen, golvpoolen, gripsholm (0 rows) — they get nothing rather than a guess.

**NOT checked:** the colour NAME → RGB palette is our own reading of a Swedish colour word, not a merchant swatch, hex or finish code — no feed publishes one. Compound strings resolve on the first word ("Guld / Brun" → guld), which is an assumption about ordering. Metals render poorly against a dark world (no reflection environment). `hero_still_poc.py` v4 was NOT executed this sprint — the NORR11 GLBs live in gitignored `.runtime/` and were not regenerated; only the Newport-driven still was rendered.

### Bugs found and fixed (all by auditing output, not by the summary %)
1. **Cylinder cap winding inverted** in `build-all-proxies.mjs` — top cap wound to geometric −Y while shading +Y, so every flat cap rendered BLACK. Verified numerically (−0.0647 vs declared +1). Affected **490 already-committed proxies**, rebuilt via `scripts/rebuild-cylinder-proxies.mjs`.
2. **15,170 bathroom vanities → bedroom dressers** (`...-och-kommod` matched the generic furniture rule first). Bathroom block now runs first; golvpoolen DRESSER is 0.
3. **`Taklampor > Spotlights` → PENDANT** — matching the whole taxonomy path let the PARENT beat the leaf. Leaf-first matching recovered 411 SPOT rows.
4. **`Ø550` → 5,500 mm** (a 5.5-metre pendant). Bare diameters switch unit by magnitude — measured: bare Ø<100 is cm (4,575 rows), Ø≥100 is mm (314). Applied to diameters ONLY; "249 x 338" on a rug is genuinely cm.
5. **Luminaire `78x334 cm` read as a footprint** — it is diameter × cable DROP. 174 rows now held as `dimensions_axes: "AMBIGUOUS"` instead of asserting a false footprint.
6. **`Madrasskydd` (protector) → MATTRESS** — a `(?!skydd)` lookahead can never fire because `madrass`+`skydd` share the double-s. Fixed by ordering.
7. **Baseline self-erasure** — the placeability chart read `before_placeable` from the extractor's own report, which is rewritten each run; re-running would have silently redrawn the "before" bar as 4.4% and erased the improvement. True baseline pinned in `.runtime/dims-baseline.json`.

### ⚠️ Verification owed (CLAUDE.md §7d — maker ≠ checker)
Every item above was built AND measured by this session. This supply line feeds Platform's shoppable rooms (affiliate-revenue surfaces), so **a different session must verify before any of this is treated as done**. I have not ticked anything off in a coordination doc. Suggested checks: re-run `scripts/extract-dimensions.mjs` and `classify-catalogs.mjs` dry and diff the reports; open 10 random classified twins per catalog against their live product pages; confirm the 490 rebuilt proxies render non-black.



### Item 1 follow-up — Brain maker≠checker ruling applied (2026-09-20, commit `e5816844`)
Brain VERIFIED item 1 independently (recount matched to the unit) and ruled that heights no source
states may be filled from a per-category table as INDICATIVE. Done:
`config/geometry/category-height-defaults.json` — 33 categories each with a one-line rationale, and
13 explicit REFUSALS. Applied as `dimensions_axes: "WD+H_DEFAULT"`, `dimensions_indicative: true`.

Placeability by evidence tier — **these are never summed into one "placeable" number**:

| tier | count | share |
|---|---|---|
| W×D×H stated by source | 6,364 | 2.8% |
| W×D source + H category default (INDICATIVE) | 35,447 | 15.7% |
| envelope fully invented by proxy build (INDICATIVE) | 3,687 | 1.6% |
| footprint with no default (refused) | 11,416 | 5.1% |

Kungsängen **0% → 93.0%** (22,149 beds). Per catalog: vidaxl-outdoor 8.2% · golvpoolen 2.4% ·
kungsangen 93.0% · lampemesteren 15.7% · newport 28.4% · lampan 28.4% · mjuk 62.6% · gripsholm 48.8%.

**⚠️ This re-labels the item 1 headline.** Brain asked me to stamp the 3,645 source-less Newport
dimensions as `proxy_build:pre-existing`. They are not pre-existing measurements — their
`geometry.scale_state` reads `category_default 800x800x750mm`, i.e. the universal proxy builder
invented all three axes. They are stamped `proxy_build:category_default` + `WDH_DEFAULT` +
indicative instead. **Newport's 28.2% "placeable" is 3,645 of 3,673 invented; only 28 Newport twins
state a size in their source text.** The 1.7% baseline was likewise ~95% invented. Both my item-1
table and Brain's independent recount matched because we counted the same FIELD without checking
PROVENANCE — a shared blind spot, not a cross-check.

**NOT checked:** no default height verified against a manufacturer spec sheet — every value is a
market-convention judgement carrying its rationale string. Whether Platform actually renders the
INDICATIVE chip for `dimensions_indicative: true` is unverified on the Platform side.



### Reporting standard (Brain ruling 2026-09-20, commit `c181c772a2`) — the single "placeable %" is RETIRED
Every twin now carries `physical.dimensions_tier`, so no consumer parses `dimensions_source` strings:

| tier | meaning | count | consumer rule |
|---|---|---|---|
| `SOURCE` | all three axes stated by source, or verified measured envelope | 6,364 | safe to quote as a product fact |
| `WD_SOURCE_H_DEFAULT` | W/D from source, height from the category table | 35,447 | INDICATIVE — panel says "height: category default" |
| `ALL_DEFAULT` | every axis invented by the universal proxy builder | 3,687 | INDICATIVE and WEAKER — panel says "size: category default (all three axes)" |
| `NONE` | no usable envelope | 179,837 | not placeable |

Room-compiler selection order: `SOURCE` > `WD_SOURCE_H_DEFAULT` > `ALL_DEFAULT`, and `ALL_DEFAULT`
is never chosen while a source-stated candidate exists for the same role.

**Report the tiered table, never a single blended percentage.** The blend is what let "1.7% → 4.4%"
stand for a month-equivalent of confidence when the real source-backed movement was 197 → 6,364.

The 11,416 footprint-only rows with no category default stay UNFILLED (Brain confirmed). The 13
refusal rationales in `config/geometry/category-height-defaults.json` are a deliverable, not a gap.

**Lesson carried forward for maker≠checker (both sessions hit it):** re-derive what the label
TESTED, not the number it printed. Brain's recount matched mine to the unit because we both counted
`dimensions_mm` populated without reading `geometry.scale_state`.



### ⚠️ CONSUMER GOTCHAS — read before using dimensions (verbatim from Platform, 2026-09-21)
- **the stamp lives at `physical.dimensions_tier`, not top-level**
- **`repo-platform/data/twins` is a stale 85-file subset — consumers must read your checkout**
  (i.e. `product twin/repo-avatar-factory/data/twins`, 225,335 files on branch `agent/avatar-factory-claude`)

### Tier reconciliation (2026-09-21, commit `90b50e7047`) — Platform's vidaXL disagreement
Platform counted ~11,336 vidaXL titles "stating all three axes" against my 6,131 SOURCE. **Neither the
regex nor the count was wrong; the two numbers measure different things.**

| definition (measured on data/vidaxl-outdoor, 89,595 rows) | count |
|---|---|
| titles with 3 numbers separated by x/×/X — genuine three-axis | **6,124** |
| titles with an x-pattern AND a `cm` token — 2-axis *and* 3-axis together | **11,254** ← matches Platform's ~11,336 |
| of those: 3-axis 5,326 · 2-axis 5,927 | |

So ~5,900 of Platform's population state only W×D. Those are correctly NOT `SOURCE`. Alternative
notations were checked and are all **zero** in this feed: `*`-separated, dash-separated, and labelled
`L/B/H` forms. **No pattern was missed.**

**But Platform's underlying instinct was right, and found a real defect.** `build-newport-proxies.mjs`
DOES parse dimensions out of the title and override the category defaults with them (lines 217-221) —
then writes `scale_state: "category_default …"` **unconditionally**, whether the numbers came from the
merchant's title or from `CATEGORY_DEFAULTS`. `scale_state` is therefore not a provenance record, and
the backfill in `e5816844` trusted it. Compounding it, `extract-dimensions.mjs` skips any twin that
already has all three axes, so those titles were never examined at all.

`scripts/reconcile-dimension-tier.mjs` re-reads the title and re-stamps only where the title's numbers
MATCH the stored dimensions (the match is the evidence):

| tier | before | after | delta |
|---|---|---|---|
| `SOURCE` | 6,364 | **6,390** | +26 |
| `WD_SOURCE_H_DEFAULT` | 35,447 | **35,474** | +27 |
| `ALL_DEFAULT` | 3,687 | **3,634** | −53 |
| `NONE` | 179,837 | 179,837 | 0 |

By catalog: newport 4→SOURCE, 21→WD+H (3,620 stay); vidaxl-outdoor 22→SOURCE, 6→WD+H (14 stay).
Screen 05 now reads **live tier counts from `data/twins`** (`scripts/tier-counts.mjs`) rather than a
report file, so it cannot drift from the data after a later correction.

**NOT checked:** the 3,634 remaining `ALL_DEFAULT` were not individually confirmed to lack a stated
size — they are the rows whose titles either state nothing or state numbers that do NOT match the
stored dimensions. `scale_state` remains unreliable across the corpus and should be treated as
decorative; `dimensions_tier` is the field of record.



### scale_state made truthful + dangling geometry cleared (2026-09-21, commit `50979c4dbf`)
Per Brain rule 12. `scripts/scale-state-lib.mjs` is now the single definition, derived from
`physical.dimensions_tier`, and both proxy builders use it:

| old string | written by | what was wrong |
|---|---|---|
| `category_default …` | `build-newport-proxies.mjs` | written even when the size had just been parsed out of the merchant title |
| `verified …mm envelope` + `shape_claim: "dimension-verified proxy"` | `build-all-proxies.mjs` | claimed VERIFICATION over numbers that were often pure category defaults — the stronger false claim of the two |

Backfilled across all 3,947 twins carrying geometry, so the misleading strings on disk are corrected,
not merely avoided in future writes: `verified_measured` 195 · `source_stated` 26 ·
`wd_source_stated` 90 · `category_default` 3,634. **Contradictions between `scale_state` and
`dimensions_tier`: 0** (checked by re-reading every twin with geometry after the write).
`verified_measured` is kept distinct from `source_stated` so an IKEA measured envelope is not
flattened into "merchant-stated".

**Separate defect found while verifying this — my own, from item 3.** The hero rebuild deleted every
`*lampemesteren*`/`*kungsangen*`-g2-proxy.glb and regenerated only the newly-selected 20 per catalog.
**25 twins from the earlier selection kept a geometry block pointing at a deleted file** — advertising
G2 geometry no consumer could load. `scripts/fix-dangling-geometry.mjs` reverted them to
`G0 / catalog_only`. Dangling references now 0; twins with a loadable GLB: 3,922.

**NOT checked:** 14 GLBs on disk are referenced by no twin (IKEA/Roca/Longi assets from earlier
sessions). They are harmless and may be referenced by other manifests, so they were left alone — not
deleted, not verified as needed.


> ## ⛳ CURRENT MANDATE — 2026-09-15 · CONSOLIDATION (Brain; Oskar decided. Supersedes 2026-09-08.)
>
> DECISIONS: one product = one site per address, SIX screens, ONE chrome ("ink"): bg #101916,
> paper cards, serif display (Georgia/Cormorant), Inter labels, bronze kicker #d8b874, five fixed
> evidence-chip colours (authoritative #176b52 · indicative #c18a2d · derived #497aa2 · reported
> #a65b68 · concept #735a9e). Screens: 1 Site Intelligence (FRONT DOOR, reading first) · 2 Spatial
> Lab (3D) · 3 The House · 4 Rooms (shoppable; separate stage ships first, then inside the house)
> · 5 Stills · 6 Numbers · plus an index of plots. Platform OWNS the chrome; everyone consumes it.
>
> YOUR QUEUE (unchanged priorities, you are the supply line):
> 1. **dimensions_mm + source on every twin** (GLB bounds > Shopify options > description > title).
>    Placeability = this field. Report % of each catalog now placeable.
> 2. Category/role mapping for the 6 CATALOG_ONLY catalogs (163k rows) via your title classifier.
> 3. Bedroom hero proxies (Kungsängen + Lampemesteren) for room look #3.
> 4. Material truth into Blender renders for screen 5.
> ## ⛳ CURRENT MANDATE — 2026-09-08 (Brain; verified vidaXL classify + G2 proxies. Supersedes the 2026-09-01 pin.)
>
> Platform now renders real rooms from YOUR catalogs — you are the supply line. Queue:
> 1. **CATEGORY MAPPING for the 6 unmapped catalogs** (the gap you flagged yourself): mjuk,
>    lampemesteren, lampan, golvpoolen, kungsangen, gripsholm are stamped CATALOG_ONLY, so
>    163k twins are invisible to the room compiler. Reuse the vidaXL title-classifier you just
>    built. Target: every FURNITURE/LIGHTING/DECOR row carries a real leaf category + role.
> 2. **PROXIES FOR A BEDROOM SET** — Kungsängen (23,822 beds/furniture) + Lampemesteren
>    (19,516 lighting) hero pieces, so Platform can build room #3 from a different catalog.
> 3. **DIMENSIONS ARE THE BOTTLENECK.** Platform can only place a SKU whose real size it knows
>    (vidaXL: only 12.7% of titles state cm). Mine dimensions from every field you have
>    (description, title, GLB bounds, Shopify options) and stamp `dimensions_mm` + its source
>    on the twin. This single field decides how much of the 226k catalog is placeable.
> Report NUMBERS every block. Zero-LLM bulk scripts. Commit each batch; Oskar pushes.


> ## ⛳ CURRENT MANDATE — 2026-09-01 (Brain; supersedes earlier pins; re-read every resume)
>
> DONE so far: 13,036 Newport catalog twins + 3,640 furniture G2 proxies; Valostore ingest;
> generic catalog ingester. Brain added 7 more catalogs under data/: mjuk (7,284),
> lampemesteren (19,516), lampan (10,874), golvpoolen (59,720), kungsangen (23,822),
> gripsholm (166), vidaxl-outdoor (89,595). ~226k SKUs total, all channel-tracked.
>
> QUEUE, in order:
> 1. **ATTACH-POINT / LAYERING SCHEMA (top priority — the product's edge).** Define on the
>    twin manifest: FURNITURE = base objects exposing slots (sofa/chair → pillow slots on
>    seat/back; table → centerpiece; floor → rug; shelf/console → vignette). DECOR +
>    table/pendant LIGHTING declare attach_as + footprint. Emit a validated example scene:
>    "sofa + 2 pillows + throw + coffee table + vase + rug" composed purely from schema.
>    Platform renders it — coordinate via docs/DESIGN-SELECTOR-MOUNT-CONTRACT pattern.
> 2. **Ingest the 7 new catalogs** with your generic ingester (bucket field ready).
>    Proxy FURNITURE for mjuk + kungsangen + vidaxl-outdoor hero pieces next (batch, not all).
> 3. **Material truth into renders:** wire each twin's material_cues/spine colour into
>    scripts/hero_still_poc.py overrides (no hardcoded guesses) so Cycles stills show
>    documented materials. PoC renders in .runtime/renders/.
> Report NUMBERS every block. Commit every batch; Oskar pushes. Zero-LLM bulk scripts.


> ## ⭐ NEWPORT DEEP-MAP — 2026-08-28 (Oskar priority; Newport = first APPROVED Adtraction program + warm relationship)
>
> Newport SE is APPROVED (9% commission, tracking link live at.newport.se). Product feed
> = **13,036 SKUs**, Adtraction feed ID **2175** ("Standard"). Newport is furniture AND
> heavy decor (sample: Marbella rattan armchair 859kr · Kate terracotta pot 499kr ·
> Hortensia artificial flower 129kr · pillows/throws/vases/candles). This is the flagship
> catalog to map deep.
>
> DELIVERABLES:
> 1. **Ingest Newport feed 2175** (get the tokened feed URL from the dashboard "Copy feed
>    URL" on the Newport brand page — Oskar/Brain hands it over; do NOT commit the tokened
>    URL, store in .runtime). Zero-LLM script: parse → catalog rows (name, price, image,
>    product_url, EAN/GTIN if present, category). Report the EXACT category breakdown:
>    how many are FLOOR-STANDING FURNITURE (sofa/chair/table/bed/cabinet/shelf) vs
>    ATTACH-DECOR (pillow/throw/vase/pot/flower/candle/tray/textile) vs other.
> 2. **Map ALL 13,036 as shoppable catalog entries** (cheap: identity+price+image+affiliate).
>    Wire the Newport tracked affiliate link (program now approved) — this is the first
>    real monetized catalog.
> 3. **Geometry in tiers** per Oskar's layering thesis (see below): hero furniture → G2
>    proxies first; attach-decor → lightweight (billboard/plane or simple proxy).
> 4. **LAYERING / ATTACH-POINT model (Oskar's core idea):** a scene composes as base →
>    attach: sofa is a base piece with pillow attach-slots on the seat/back; table has a
>    centerpiece slot; floor has a rug slot; shelf/console has vignette slots. Decor snaps
>    to slots so you build "sofa + 3 pillows + throw + coffee-table + vase" as one styled,
>    fully-shoppable scene. This is where Newport's decor density becomes the product's
>    superpower (most configurators only do the big piece). Define the attach-point schema
>    on the twin manifest; Platform renders it.
> Report a NUMBER (Newport SKUs mapped / by tier) each block. Commit every batch; Oskar pushes.



> ## ⛳ CURRENT MANDATE — 2026-08-25 (from Brain fleet sweep; SUPERSEDES everything below; re-read on every resume/compaction)
>
> **1. FIX THE 7f72563 REGRESSION FIRST — before anything else.** Your unpushed commit
> "universal proxy builder — all 203 twins promoted to G2" silently DOWNGRADED 11 twins
> that had richer geometry: 9 material-cued IKEA GLBs (e.g. LISTERBY oak veneer, POÄNG,
> KIVIK) plus the NORR11 FAVE and Wendelbo ATLI **native** GLBs — all overwritten with
> generic category-colour proxies while the richer files still sit in
> `data/geometry/avatars/`. This violates the materials-from-spine rule. Fix = follow-up
> commit: (a) re-point the 11 twin JSONs back to their richer GLBs (no regeneration
> needed), (b) fix the skip logic in `scripts/build-all-proxies.mjs` to detect existing
> material-cued/native geometry, (c) make `avatar-index.json` counts derived, not typed.
> Then flag Oskar to push both commits together.
> **2. Commerce truth, not commerce theatre.** Verified 2026-08-25: `affiliate_link`
> 0/203 (hardcoded null at `scripts/backfill-commerce.mjs:49`), `ean` 2/203,
> cart_deeplinks are plain untracked URLs. Pre-write the Adtraction link-wrapping in
> backfill-commerce.mjs behind a config flag NOW so approval day = backfill day; backfill
> EAN from the IKEA feed rows you already have.
> **3. Reality check on IKEA:** the Adtraction application was NEVER SUBMITTED (API shows
> no channels + no applications — Oskar must register a channel first). Don't block on
> it; don't claim it's pending.
> Full verified state: `docs/FLEET-STATE-2026-08-25.md` on `agent/brain`.
> Everything below (2026-08-21 queue: pack compiler, graph fields, BIMobject) remains
> your backlog AFTER items 1-2.

> ## ⛳ PREVIOUS MANDATE — 2026-08-21 (backlog after the block above)
>
> **You are ACQUISITION-ONLY. You build AVATARS. You are measured in avatars/day, not features.**
> The showroom surface (prototype/showroom-living — swap UX, mobile, composite, colour) has TRANSFERRED to the Platform & 3D Engine session. **Do NOT work on the showroom app.** If you catch yourself editing the Altea/showroom pitch, STOP — that is drift; it belongs to Platform now.
>
> **Your build queue, in order:**
> 1. **PACK COMPILER** — the missing mass-production station. Script: catalog row (name, brand, article-no, W/D/H, category, photo URLs, price, ean) → G2 avatar spec, using per-category geometry templates generalised from the IKEA residential pack. Envelope-true G2, disclosed, no exact-form claims.
> 2. **Avatar graph fields** — add `merchant`, `affiliate_link`, `cart_deeplink_capability`, `ean` to the avatar/twin manifest schema (the cart-splitter consumes these).
> 3. **Furniture Batch 1** — 20 G2 avatars from census merchants (dims+photos), batches of 5, commit+push each. This is TODAY's work, IKEA-independent.
> 4. **IKEA pipeline** (once program approved — pending Oskar's Adtraction application): ingest IKEA product feed from Adtraction dashboard "Products"/per-program feed (NOT scraping ikea.se — ToS-safe), join dims+images+ean, run pack compiler → G2 avatars at scale, wrap product URLs in the Adtraction tracked link. Target: whole living-room + bedroom IKEA range as tracked shoppable avatars.
> 5. **BIMobject access — PRIORITY (Oskar 2026-08-21).** BIMobject = real manufacturer BIM/CAD = **G4 geometry** for kitchen/appliance/tap brands (Marbodal, Ballingslöv, HTH, Vedum, Sigdal, Norema, Grohe, Hansgrohe, Franke, V&B, Miele, Bosch…). This is the realism uplift (G2→G4) for the category we care most about. Actions: (a) finalise the drafted BIMobject Developer API application; (b) confirm the COMMERCIAL-USE license for embedding models in our consumer app (AEC models — terms differ); (c) build the BIM→avatar ingestion (download model → normalise scale → attach spine identity/EAN/affiliate link). Needs an Oskar step: BIMobject account/API-key (human signup) — prep the application, flag when ready for him.
> 6. **Kitchen census** → **appliance pipeline** (EPREL × Icecat × affiliate feeds × BIMobject, EAN-joined, zero-LLM scripts).
>
> **Feedstock is ready:** `docs/inventory-map/` on `agent/brain` (~96 brands, START-HERE-TOP20.md, live affiliate rails). Full rationale + commerce/checkout model: `docs/VALUE-STORY-AND-IDEA-LEDGER.md` on `agent/brain` (read the 2026-08-20/21 entries).
> **Report a NUMBER (total avatars in library) at the end of every work block.** Blockers → one line to Brain immediately.
> **Hard rule unchanged:** no supplier/manufacturer email ever sent without Oskar's explicit go.

---

Standing session for **Acquisition / Avatar Factory** on `oskar-del/product-twin`.

## Session facts

- **Worktree branch:** `agent/avatar-factory-claude` (worktree at `../repo-avatar-factory`, created from `origin/main` @ `667ffc1`).
- **Mandate:** OpenAI-era audit §1 (`docs/OPENAI-ERA-AUDIT-2026-08-18.md`, lives on other branches). Permission-light acquisition first.
- **Hard rule:** no supplier/manufacturer email is ever sent without Oskar's explicit go on exact content.
- Nothing in this handoff implies a push, merge or deployment beyond what the "Status" lines state.

## Priorities (audit order)

1. Photo-to-avatar end-to-end on an owned product — Anatomic SITT as exact-twin target. **← done (infra + proof); waiting on Oskar's photos + measurements + `MESHY_API_KEY`.**
2. Broaden Shopify Model3D census from 1 merchant to ~20.
3. Draft BIMobject Developer API + pCon applications (docs, not emails).
4. Finish the 8 missing Kator/Legaz review claims.
5. One-page manufacturer value-offer doc.

---

## P1 — Photo-to-avatar for Anatomic SITT · STATUS: infra complete + wiring-proven

**What "done" means here:** the pipeline is fully built and wired; the *only* remaining inputs are real photos, real measurements, and the `MESHY_API_KEY` secret. Verified below.

### Files added

| file | role |
|---|---|
| `config/geometry/anatomic-sitt-zitzi-delfi-pro-target.json` | exact-twin target (photo-capture route), grounded in real Zitzi Delfi Pro registry data |
| `config/geometry/intake/anatomic-sitt-photo-avatar-job.template.json` | turnkey runtime job template — copy to gitignored `.runtime/avatars/`, fill only `<<FILL>>` fields |
| `docs/ANATOMIC-SITT-PHOTO-CAPTURE-GUIDE.md` | step-by-step: pick subject → shoot 5 views → measure → clear rights → run |
| `docs/legal/anatomic-sitt-reconstruction-authorization.md` | one-signature family-firm rights authorization (TEMPLATE, unsigned, unsent) |

### Why Anatomic SITT

Family firm (org 556411-7348; brother-in-law is CEO). Real manufacturer, rigid physical products, **rights clear with one internal signature** — the cheapest exact-G3 rights path in the corpus, zero cold-outreach. Grounded reference product: **Zitzi Delfi Pro** (real registry entries HMI 53369–53371 / 85704–85705, sizes 0–4, internal widths 30/34/38 cm, max user 90 kg; sources: hmi-basen.dk, portale.siva.it, medicalexpo). The exact SKU + full W/D/H envelope are **capture-confirmed** (measured), never fabricated.

### P1 end-to-end proof (2026-08-18, node v22.14.0, no key, no real photos)

Run from the worktree root:

```sh
# 1) Unfilled template correctly BLOCKS on exactly the fields Oskar supplies:
AVATAR_JOB=config/geometry/intake/anatomic-sitt-photo-avatar-job.template.json npm run avatar:photo:preflight
#   → status: BLOCKED · blocked: [temporary_https_image_references, known_physical_scale]

# 2) A filled job PASSES preflight 13/13 (synthetic values used for the proof only):
#    (copy template to .runtime/avatars/, fill https URLs + numeric dims + rights ref)
#   → status: PASS · 13/13

# 3) Generation without the key reaches the credential gate, not a code error:
npm run avatar:photo:run
#   → status: CREDENTIAL_REQUIRED · reason: MESHY_API_KEY is not configured
```

Interpretation: the pipeline is fully wired. Preflight gate → generation gate → QA gate all execute. The only missing inputs are (a) real HTTPS-hosted photos of the 5 views, (b) measured W/D/H, (c) `MESHY_API_KEY`, and (d) a signed authorization for redistribution scope.

Baseline tests still green: `avatar:photo:preflight:test` (6), `avatar:photo:qa:test` (5), `avatar:reconstruction:score:test` (3), `avatar:reconstruction:job:test` (2).

**NOT checked / still blocked:**
- No real avatar generated (no photos, no key, by design).
- Registry envelope is internal-width only; full W/D/H must be measured — not sourced from registry.
- Rights authorization is an unsigned template; redistribution stays `review` until signed.
- Meshy reconstruction quality on Zitzi's foam/fabric/strap surfaces is unproven — guide recommends a rigid subject first.
- Claim ceiling is G2 pre-QA; G3 needs multi-view QA PASS + verified exact SKU + recorded rights scope. Photo capture never grants G4/engineering authority.

---

## P2 — Shopify MODEL_3D census 1 → ~20 · STATUS: viability proven, harvest deferred

- `npm run avatar:shopify:model3d:capability` — live-probed 22 candidate merchants; **11 census-viable** (token-less Storefront + Shopify product sitemaps), 11 not (headless/non-Shopify/bot-blocked), each with a recorded reason. Configs: `shopify-merchant-model3d-candidates.json`.
- `npm run avatar:shopify:model3d:multi-census` — generalizes the proven DPG discovery+detect over the viable set (`shopify-multi-merchant-model3d-census.json`); leaves the single-merchant baseline untouched; reports `coverage_capped`.
- **Live proof:** discovery generalizes (blu_dot 491, DPG 6470 discovered); detection correct end-to-end (**4/4 known-3D DPG handles → 3D-DETECTED**, glb+usdz). Capped sweeps found 0 by sampling depth (native 3D ~0.1–0.5%/catalogue), not a bug.
- **NOT done:** actual 3D harvest across the 11 needs an unthrottled env (sandbox 45 s/cmd). Command: `CENSUS_MAX_SITEMAPS=999 CENSUS_MAX_PROBES=100000 npm run avatar:shopify:model3d:multi-census`. Doc: `docs/SHOPIFY-MODEL3D-CENSUS-EXPANSION-2026-08-18.md`. Commit `18befb1`.

## P3 — BIMobject + pCon applications · STATUS: drafted, held for Oskar's go

`docs/requests/PLATFORM-ACCESS-BIMOBJECT-PCON.md`. Researched live access mechanics 2026-08-18 (BIMobject: developer.bimobject.com app + OAuth2 + Search/Embed API; pCon: EasternGraphics partner + pCon.login per-manufacturer OFML + EAIWS/PI-API/basket). Scopes, data-use commitments, response-ingestion checklists. Nothing submitted. Commit `7b4b16c`.

## P4 — Kator/Legaz review claims · STATUS: rights review complete, geometry blocked

On main none of the 12 pilot assets had review records. Completed the **rights half** for all 12 (licence **CC BY 3.0 US** verified live 2026-08-18) in `data/rights/sweet-home-3d-kator-legaz-design-asset-review.json`. **Geometry half stays BLOCKED** (assets not downloaded, no visual QA) → **0/12 publishable stays honest** per the audit landmine. Deterministic gate `npm run avatar:design-asset:review:validate` (PASS 12/12 rights, 0 publishable) with proven negative tests. Commit `e7ee032`.

## P5 — Manufacturer value-offer · STATUS: written

`docs/MANUFACTURER-VALUE-OFFER.md` — one page, reward-not-dependency framing (audit §1.5). "Already running" claims trace to `data/geometry/avatar-index.json` + exact-cart proof; internal notes cap over-claiming. Held for Oskar's go with a named manufacturer + proof scene.

## Landmines respected (from audit §2)
Agent-authored visual QA (e.g. Furniture Avatar Package #2) must be independently re-derived or human-viewed before any PASS — I did **not** promote any avatar or assert visual-QA PASS. Kator/Legaz kept at G0/0-publishable. No live price/stock/rights asserted as current.

## COURSE CORRECTION (2026-08-18, later) — the real job: showcase MCP products in a real house

The Anatomic SITT / census / paperwork work above was the WRONG track (Oskar: "anatomic sitt has nothing to do with this project… we need the products from the mcp to showcase"). The real job: take the real purchasable products the Product Twin MCP already holds and showcase them **staged in a real for-sale house, client-pitch quality**.

Delivered + verified in-browser:
- `scripts/resolve-native-3d-showcase.mjs` → pulls the 8 NORR11/Wendelbo twins' **native manufacturer GLB** from Shopify by the gid each twin stores; 8/8 resolved to gitignored `.runtime` (rights review; Man Day Bed sha matches the twin record). Manifest: `data/geometry/native-3d-showcase-manifest.json`.
- `data/showrooms/norr11-marbella-living-room-v0.1.json` → shoppable scene; `property` block bound to a **real live H&H listing**: Villa in Altea Hills, ref **R5355265**, **€6,490,000**, 5 bed/6 bath/470 m², sea views (pulled from hanssonhertzell.com 2026-08-18).
- `prototype/showroom-living/index.html` → three.js villa living room (oak floor, plaster, sea-view window, IBL + soft shadows) with the real products staged; real villa hero photo + specs in the pitch card; tap a piece → real identity + live trade offer ($10,500 Man 3-Seater) + honest gates.
- Serve locally: `python3 -m http.server 8756 --directory "$(pwd)"` → `http://127.0.0.1:8756/prototype/showroom-living/index.html`. GLBs + villa photos live only in `.runtime` (regenerate via the resolver + the referer'd photo download; not committed).

### Full shoppable loop (built + verified in-browser, commits 15fac40 → bf8bed6)

`prototype/showroom-living/index.html` is now a complete client pitch:
- **Real house**: Villa in Altea Hills, H&H `R5355265`, €6,490,000, 470 m², sea views — real hero photo + specs in the pitch card (pulled live from hanssonhertzell.com; photos in gitignored `.runtime`, referer-header download).
- **7 real products, two lanes**: NORR11 + Wendelbo (native manufacturer GLB, USD trade) + IKEA LISTERBY €199 / LOHALS €49.99 / LAUTERS €59.99 (committed G2 proxies, real IKEA.es offers). Native vs proxy disclosed on every card.
- **Swap** (hero sofa: 3-Seater/2-Seater/Mammoth/Lobby; lounge: Man/Fave) with a **currency-aware furnished-room total** ($24,757 USD + €308.98 EUR) that recomputes live. Verified: 3-Seater→Mammoth moved total $24,757→$19,857.
- **Per-product "View live offer / RFQ →"** to the real merchant page (verified 200) and a **whole-room "Request room quote"** BOM (all 7 pieces + subtotals + property, Copy/Print, nothing auto-sent).

Serve: `python3 -m http.server 8756 --directory "$(pwd)"` → `/prototype/showroom-living/index.html`.

Honest gaps: products in default finish (variant fabric not bound); room is a built 3D villa interior matched to the listing's style, NOT the listing's actual photo (composite blocked — every H&H luxury interior is furnished / new-builds are CGI, so no clean empty room; needs an empty-room image); EUR/ES checkout is a live gate; native-GLB redistribution rights are review (so this is an on-screen/internal pitch, not a public URL until rights clear). Data files: `data/showrooms/norr11-marbella-living-room-v0.1.json`, `data/geometry/native-3d-showcase-manifest.json`, resolver `scripts/resolve-native-3d-showcase.mjs`.

## Session state
Branch `agent/avatar-factory-claude`, 6 commits ahead of `origin/main`. **Not pushed** — `git push` denied this session; Oskar pushes from terminal:
```sh
cd "…/repo-avatar-factory" && git push -u origin agent/avatar-factory-claude
```
No merge/deploy performed.

## Handoff contract (per AGENTS.md §5)

- Branch/commit: see "Session facts". Dirty/clean state stated per commit in git log.
- Monitoring: none of the added files assert live price/stock/rights — no recurring monitor required yet. When a real authorization is signed, its scope + revocation condition become a monitored fact.
- Merge/deploy: none performed.
