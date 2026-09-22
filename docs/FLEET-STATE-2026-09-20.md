# Fleet state — SPRINT DAY 2026-09-20 (Brain, verified unless marked)

## Delivered (Brain-verified)
- Platform: ink chrome package (engine/ui/chrome: tokens.css, chrome.mjs strings API, chrome-css.mjs node-only, room-panel.mjs) + demo; both rooms re-skinned, 18/18 BUY links verbatim; Glanrummet room inside Vinkelhuset; Cycles still. Stage inside rooms still old sky/ground (open).
- Avatar: dimensions_mm on 66,375 twins. CORRECTED 20:xx — the 4.5% / Newport 28.2% figures counted a populated field, not provenance: 3,645 Newport 'measured' twins are proxy envelopes invented on all axes. Source-stated full W×D×H: 197 → 6,364 (2.8%). Height-default table (33 cats + 13 refusals) applied: Kungsängen 0 → 93% WD_SOURCE_H_DEFAULT. Placeability is now reported by TIER, never summed. Brain's recount shared the blind spot (ruling 9). 98.1% of 121k CATALOG_ONLY rows classified. Bedroom proxies. Material cues → Blender.
- MIMER: Screen 6 Numbers on chrome; FF&E from the real room (THIS 208 760 · MID 147 701 · PREMIUM 317 267 SEK); Djurö dry-run.
- BRAGE: house-v0.3-geometry-spec.json (13 rooms, 18 openings, roof explicit) + validator; The House re-skinned + republished (Brain-verified: 210 gone, 206.4 ×4).
- Djurö: official footprints (4 on parcel), DTM, strandskydd/plan, viewshed; findings.json + gates.json; label fix kn0581→kn0120.
- Platform: whole-house Vinkelhuset model (dollhouse) from v0.3 — BRAGE→Essence handoff closed by re-route.
- Spatial (executor reassigned from the idle Platform session): build-site.py — one command → screens 1+2 for any plot; acceptance run on Djurö exit 0. Captures in docs/screens/build-site-*.png.

## Rulings (fleet-wide)
1. Computed beats typed: Vinkelhuset heated = 206.4 m² (supersedes 210).
2. Terrain products = DERIVED (derived_from AUTHORITATIVE); AUTHORITATIVE only for the register/survey object.
3. Null provenance ≠ pass → NOT ESTABLISHED; build fails on null-pass.
4. A rendered horizon is never a view claim; stills labelled VISUALIZATION; views only from DTM viewshed.
5. Missing heights may be category defaults, stamped category_default, rendered INDICATIVE, never quoted.
6. Template key: sightline_profile (glan_* alias only).
7. Whole-house 3D model → Platform (Essence idle since 08-28).
9. Maker≠checker must re-derive what a label TESTED, not recompute the number (Avatar dimensions: Brain recounted the same field). Tiers: SOURCE > WD_SOURCE_H_DEFAULT > ALL_DEFAULT > NONE; only SOURCE+native mesh is AUTHORITATIVE.
8. Brain confession: the restored Svärtinge front door's "4 satisfied · 14 open" was typed by Brain 09-16. RESOLVED 62e66af982: canonical 26-gate registry (union), Svärtinge 6 closed / 20 open, all 18 original gates retained, counts computed. Root cause of 4-vs-0-vs-2: two vocabularies (SATISFIED vs CLOSED); canonical emits CLOSED only. validate-sweden-plot-intelligence's "18 open gates" printed registry SIZE, not status — never a count; a real ledger validator is being written. BOUNDARY_FOR_DESIGN and PROPERTY_REGISTER stay OPEN by rule: registered extent ≠ monument positions; a clip ≠ a title extract.

## 2026-09-21 additions
- RISK CLOSED: Platform tier report — 36 placed items across 4 rooms: 7 SOURCE (vidaXL title, no twin) · 2 WD_SOURCE_H_DEFAULT · 27 ALL_DEFAULT · 0 AUTHORITATIVE emitted. Platform overclaim found+fixed: GLB_BOUNDS had been stamped AUTHORITATIVE since the first Newport room (unearned green chips); now SOURCE+native mesh only, negative case asserted.
- Bedroom look #3 (Kungsängen bed + Lampemesteren lamp + Newport), 7 tracked, 210 604 SEK; height-default disclosure on the panel.
- Wing roof: BRAGE v0.3 wing_roof does not close (15° mono from 3.0 m plate passes through 2.5 m rooms; the other reading tops the bar ridge). Routed to BRAGE for v0.4 + validator clearance rule.
- vidaXL under-stamped: ~11,336 titles state three axes vs 6,131 SOURCE stamped → Avatar reconciles.
- Consumer gotchas: tier lives at physical.dimensions_tier; repo-platform/data/twins is a stale 85-file subset.
- Djurö on canonical registry 8/18/26, survival verified; jurisdiction rule ADDED (registry requires_pattern on the property-division product kn code; 598b1132ab). Svärtinge stays 6/20/26 (closure upgraded carried-forward→authoritative, hashes re-derived 3→5); Djurö 8→9 pending its run. Note: Brain relayed "both sites gain a closure" unchecked — wrong; second time a gate figure travelled unchecked. Rule: no gate count leaves Brain without the validator line behind it.

- Stills audit (Platform b835819dc6): 2 of 3 committed Blender stills shipped WITHOUT the VISUALIZATION label — exported before the stamp existed (the exporter was fine; the artefacts were stale). Rule 10: GATE THE ARTEFACT, NOT THE TOOL — assert on committed files, per file; a render manifest (png sha + script sha + stamp) ties every PNG to a stamped script. Ink stage now default on every bundled surface.
- Spatial: validate-gate-ledger.py with 8 mutation tests (rule 11: a validator that has only passed is untested). Vinkelhuset card reads v0.3 area_summary; archive-read naming unified; live re-ingest ordered. Storeys ruling: souterrain is conditional, not a storey.

- vidaXL reconciled (Avatar f0d5f7fd): the 11,336-vs-6,131 gap was two populations (2+3-axis vs 3-axis); the real defect: proxy builder wrote scale_state "category_default" unconditionally → it was never provenance. Rule 12: scale_state is decorative; dimensions_tier is the field of record; a stamp is evidence only where title numbers MATCH stored dims. Re-stamp: SOURCE 6,390 · WD+H 35,474 · ALL_DEFAULT 3,634 · NONE 179,837 (re-read verified). Platform emits a per-build disagreement list for Avatar.
- BRAGE v0.4 (bb453b8a28): wing gets its own 15° gable (eaves 3.0, ridge 4.07 < bar 5.02); shared roof-planes.mjs in generator+validator; validator indicts v0.3 (3 rooms) and passes v0.4. Platform/Spatial rebuilding. Share pin on artifact 2f790a57 points at an OLD version — Oskar must move it.
- Djurö 9/17/26 (32ee4a97e6), diffed: one status change. Validator ergonomics: partial run must fail loudly → Spatial.

- Live re-ingest (Spatial 23012eef76): first real run FAILED (emit() signature drift; three green self-tests exercised the function, not the program). Rule 13: self-tests exercise the PROGRAM path. Svärtinge re-ingested from real archives: every evidence field byte-identical; validator 108/0; 6/20/26 unchanged. Djurö property division reproduces identically. Buildings receipts hash differently despite identical data. Brain's diagnosis ('document hash') was WRONG — Djurö (005699f812) proved both scripts already hash geometry only; the real causes are json.dumps default separators (', '/': ' vs compact) and list ORDER (on-parcel-first vs query order). Fix stands (canonical serialisation, sorted by object id, explicit separators) but the lesson is 'json.dumps defaults are invisible in review'. Expect Djurö's committed 1af0d502… → 1b60b232… on re-run: that is the fix landing, not drift. Rulings: ONE buildings ingest (Spatial script, Djurö's richer receipt shape + kommun); hash via shared helper. Souterrain condition becomes a computed gate, not prose.

- Platform 868ead1225 (Brain-verified screenshot): v0.4 compiles with 0 clearance conflicts, wing gable rendered; stills re-rendered from stamped scripts with manifest (png sha + script sha + stamp; both failure modes proven); disagreements.json = 0 traced; 36 placed / 7 SOURCE / 4 WD+H / 25 ALL_DEFAULT / 0 AUTHORITATIVE. Rule 14 (Platform): NO second copies of a supplier's spec — record sha of bytes compiled + supplier commit (specProvenance). Rule 15 (Platform): assert the CONTRACT, not the snapshot — four of its own gates broke when BRAGE shipped a fix; a gate that fails on a supplier's improvement trains people to ignore it.

- Spatial items 1–3 (4576f4fae7, c01608a0fe, a502332b07), Brain-verified by CDP capture: bar gable now spans the 7 m depth with ridge E–W (Brain's 09-16 ridge:'width' literal had it across the short axis, rising 5.93 m — Brain's bug); wing own 15° gable per v0.4; terrace + vindficka from the scene patch; cameras derived at build; DTM hillshade in INTELLIGENCE. Open on the VH card: inherited Eksjöhus limitation text; top chip still 1,938.2 municipal → must be computed 1 936,8; no south-facing stage. Capture rule for WebGL pages: CDP + readiness flag (repo-platform/scripts/shoot.mjs), never --screenshot.

- Spatial 9d81010cdc: vendored specs DELETED; build reads BRAGE's newest spec + patch from repo-brage as bytes, records provenance, emits only needed facts into scene.design; validator asserts contract (7 mutations proven), 861 assertions. Rule 16 (Spatial): STALE-CACHE — receipt fetches on static hosts had no cache-busting; a rebuilt scene served stale rendered perfectly with the design silently missing. Every fetch carries a content-derived buster; every surface exposes a counts probe. Platform checking its bundles.

- 09-22: Spatial 483c7b309c + c6c7b2d131: VH card footer now states BRAGE v0.4 + provenance (was falsely "modelled after Eksjöhus"); area chip computed 1 936,8 (in-scene chip had a TYPED 1 938 fallback — removed; "area unavailable" instead); stage 5 "From the lake side" (Brain-captured: glazed south gable, terrace, windbreaks visible); validator printed a typed "7 stages" — now computed. Rule 16 amended: build_id excludes volatile fields at any depth (proven stable/moves/returns). Provenance: read_commit + source_file_commit. CDN no-store: UNPROVEN, no deploy yet.
- 09-22: Platform d89f9444c5: rooms surface fetched 33 GLBs at runtime → inlined; COFFEE_TABLE proxy silently missing (placeholder sphere, log unread) → bundler resolves both checkouts, 11/11; bundler had re-introduced AUTHORITATIVE on measured meshes → rendered_size_source; __twinCounts() probe caught it on first run. All looks ext_assets=0 auth=0.

- Platform f6aa048db4: "0 MISSING" is an assertion (missing / not inlined / left as runtime URL); AUTHORITATIVE fenced by SOURCE SCAN — only catalog-row.mjs may grant it. Rule 17: fences use an EXPLICIT allowlist (patterns re-admit offenders) and assert the owner still grants (a fence around an empty field protects nothing). Both proven to bite. Platform holds.

- 09-22 Spatial e6776244d2 + 563cf073e8: CORRECTION — the hillshade Brain "confirmed" from a 600 px pane was invisible (flat mint); re-tuned exaggeration 3.2→9, shade 0.18×–5.5×, confirmed at NEW values only. Rule 18: a number being present ≠ visible. First real capture found a clipped top bar and "1 937" vs "1 936,8" on one screen (fixed). Deep link #stage=N,MODE. Spatial owns captures (swiftshader flags mandatory; silent failure without them; frames software-rendered). build-site pages: zero fetches, build_id stable/moves, __siteCounts()/__twinCounts() — NOT yet asserted against the generator (validator follow-up).

## Process
- Session titles ≠ roles: two Platform sessions collided; no Spatial session existed. Reassigned by message. Rename sessions to roles.
- Capture recipe: docs/CAPTURE-RECIPE.md (headless Chrome writes PNG then hangs → poll+kill).
- Brain now briefs sessions directly via session messaging; Oskar pushes.

## Open
Platform: cleanup, ink stage, house model, v0.3 re-run · Avatar: height defaults · MIMER: re-derive §6 from v0.3 · Spatial: front-door computed gates, ledger re-run, item 4, Vinkelhuset card from v0.3, visual pass · Djurö: regenerate + republish 7a1359ec.
