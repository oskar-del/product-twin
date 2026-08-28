# Fleet state — verified 2026-08-25 (Brain ultracode sweep)

Every claim below was re-derived today by a 12-agent survey (10 area surveyors + 2 gap
hunters, run wf_f4cfc6ca-b32) plus Brain's own inline checks. Where a claim in the
2026-08-25 handoff was wrong, the correction is stated. Mandate surface remains
docs/SESSION-GOALS.md (3a51430). This file is a snapshot — re-verify before relying on it.

## Per-session true state (vs handoff claims)

- **BRAGE** — AHEAD of claim. Tre-hus presentation is DONE, not "mid": 18 inline SVGs,
  all 3 houses × (plan + 4 facades + section), self-contained, artifact-ready, honest
  evidence labels. 2 unpushed commits (6c9ed17 + a5843c5), tree clean. Open: House A
  lower-floor plan missing (only asymmetry); docs 03/04 already declare Vinkelhuset the
  judged winner while the presentation re-opens the choice — Oskar decides which is
  authoritative. DTM still HTTP 401.
- **Avatar Factory** — claim stale in both directions. All 203 twins are at G2 (the
  "192 at G0" gap was closed by unpushed commit 7f72563: universal proxy builder + 197
  GLBs). BUT that commit contains a REGRESSION: 11 twins with richer geometry (9
  material-cued IKEA + NORR11 FAVE + Wendelbo ATLI native GLBs) were overwritten with
  generic category-colour proxies while their richer GLBs still sit on disk. Fix = re-point
  11 twins + fix skip logic in scripts/build-all-proxies.mjs, follow-up commit, then push.
  Commerce truth: merchant 195/203, product_url 194/203, cart_deeplink 191/203 (untracked
  plain URLs), ean 2/203, **affiliate_link 0/203** (hardcoded null in
  scripts/backfill-commerce.mjs:49). "203 shoppable" = shoppable-shaped, not monetized.
- **Platform** — claim TRUE, re-proven: 341 checks = 7 suites; 323 re-run green today
  (bundle suite's 18 verified statically only — it writes to disk, disk full). Perf budget
  real but no phone hardware ever measured. Engine does NOT consume avatar twins yet —
  that is the next build (glTF loader + SYSTEMS profile), plus absorbing the Site
  Intelligence page pattern.
- **Essence** — AHEAD of claim: showcase page BUILT and PUBLISHED. 1.95 MB self-contained,
  4 villa spreads, embedded film (md5-verified), fonts-only external. Artifact
  "Essence Moraira" 38777df1-c9a8-48c2-a422-9c7d325f1a15, updated today. 3 unpushed
  commits (~13 MB binaries). Needs: maker≠checker visual verify by a DIFFERENT session,
  then it goes to Nancy. Nothing left to build.
- **Spatial** — 2/3 true: COMPARE built and already on origin. 4 unpushed commits
  (satellite drape, mount contract, OSM neighbourhood, tree keepout); handoff session
  entry was dirty → Brain committed it today (spatial now ahead 5). BRAGE mount NOT done,
  deliberately: blocked on Platform reviewing docs/DESIGN-SELECTOR-MOUNT-CONTRACT.md
  (DRAFT) — Platform does not know it owes this review. BRAGE's
  geometry/house-v0.2-geometry-spec.json already covers all 3 houses; both halves exist.
- **MIMER** — AHEAD of claim: fully pushed (the "7 unpushed" was stale). Data ALREADY
  contributed to data/sites/sweden/saterdalsvagen-14/mimer/ (c6c48e2). Lender dossier v1
  ALREADY EXISTS in the Opero vault (07-Lender-Dossier/, as-of 2026-08-19, 20-receipt
  SHA-256 register + 12-item NOT-verified ledger). Next real work: §6 receipted cost BoM +
  §7 finished-value comps; and LENDER-DOSSIER-SPEC.md lives only on agent/brain — spec and
  dossier are on different branches.
- **Integration branches** — the "ahead 35 / behind 4" was a misconfigured upstream
  (tracked origin/agent/platform-engine). Everything is pushed; Brain re-pointed the
  upstream today. MERGE TRAP: the integration branch froze Essence at 5ecb3c5;
  origin/agent/essence-moraira-pilot (0052205) is the superset with 17 commits not in
  main. Any merge to main must use the PILOT branch, then delete/retire
  agent/engine-essence-integration. repo-sprint worktree = disposable (in main).
- **Living Room Alpha** — NOT lost. origin/agent/visual-media-studio (a635e88) holds the
  full 33-file evidence set. docs/handoffs/LIVING-ROOM-ALPHA-VERIFICATION.md's
  "uncommitted/dirty" is stale; the pending independent falsification review can be closed
  by any current session against origin.

## Money rails (checked live today)

- **Adtraction token: ALIVE** (HTTP 200). IKEA SE in catalog: id 1978727047, 9%, order
  threshold row visible. BUT the account API returns "No applications found" AND
  **"No channels found"** — so the handoff's "IKEA application PENDING" was wrong:
  per API + docs, IKEA is still on the APPLY-NOW list, never submitted, and a channel
  (site) must be registered before applying. Oskar: register channel → apply IKEA SE +
  Nordic Nest + Byggstart (925 SEK/lead house-build — direct fit for the Svärtinge funnel,
  missed by the opportunity scan) in one dashboard sitting. Awin signup still unfinished,
  no awin.env. Arper + Muuto rights letters drafted, unsent ~8 days — both block G3.
- **Lantmäteriet LM2026/114814 + /114822: STILL PENDING.** New since handoff: STAC
  metadata now answers 200 (collections fastighetsindelning, byggnader,
  belagenhetsadresser, marktacke, ortnamn, kommun-lan-rike listed, per-kommun items with
  dl1 hrefs). But the data zips (tested kn0581 Norrköping + kn2482 control) return 403.
  Re-test: ranged GET on https://dl1.lantmateriet.se/fastighet/fastighetsindelning_kn0581.zip
  with lantmateriet.env basic auth; 200 = granted.
- **Zero monitoring on the Adtraction token** (WhatsApp-silent-death pattern). TODO: weekly
  health check + chmod 600 adtraction.env.

## Artifact registry correction

- "Essence Moraira" **38777df1**-c9a8-48c2-a422-9c7d325f1a15 = the developer SHOWCASE page
  (canonical Nancy deliverable, updated 2026-08-25).
- "Essence Moraira Site Twin" 45eac3b0 (2026-08-19) = the older site twin, distinct.
- New: "Tre hus för Svärtinge 54:28" d795ea4f + "Svärtinge Site Intelligence" d700a89d
  both updated 2026-08-25.

## Infrastructure landmines (open)

1. **Disk ~100% full.** Git object writes and renders die first; all worktrees share ONE
   .git object store. ~13 GB reclaimable in caches per landmine survey (list in
   wf output). Clean BEFORE next render/gc.
2. **26+ unpushed commits existed only on this machine** at sweep time — including the only
   copy of SESSION-GOALS.md. Push sweep = top priority (command in Brain report).
3. Integration gate depended on rg (absent) — fixed on branch fix/gate-grep-fallback
   (6bd5867, from origin/main). The hard-coded "expected 9 stale blockers" snapshot
   assertion remains — Platform to decide derivation.
4. Opero vault (~/Documents/Opero — MIMER lender dossier, Concept Casa projects) is
   NOT in git and backup status unknown. Oskar to confirm Time Machine/iCloud coverage.
5. Coordination docs one generation behind: BRAIN-CONTROL-BOARD.md + 
   PERSISTENT-CHAT-TOPOLOGY.md describe the dead 7-chat era (banner added today);
   4/6 sessions have no handoff doc in docs/handoffs/.

## Verification record — Essence showcase (maker≠checker, Brain, 2026-08-25 ~19:15)

Checked the committed page (data/sites/essence-moraira/showcase/essence-moraira-showcase.html,
2,040,728 bytes) served locally in the automated browser pane. PASS on everything checkable:

- Structure: title "Essence Moraira"; sections = intro, Villa I, II, III, IV,
  "The site, in motion" (film), closing CTA. (JS section enumeration.)
- Images: 9/9 are inline data:image/jpeg and ALL decode to real pixels — hero 1400×787,
  4 renders 1000×600, 4 floorplans (308×581 / 441×567 / 343×364 / 299×700). 0 broken.
- Film: 1 video element, inline data URI, readyState 4, duration 6 s.
- Theme paints: body rgb(12,26,32), text rgb(234,239,236); scroll-reveal sections reach
  class "in" at opacity 1. Hero visually verified by screenshot (renders beautifully).
- Console: zero errors.

**NOT checked:** mid-page *pixel* rendering (the pane's screenshot pipeline returned black
frames for all below-fold captures — a hidden-pane compositing artifact, contradicted by
computed-style evidence; hero screenshots were clean) · the artifact URL 38777df1 itself
(login-gated — Oskar eyeballs per standing rule) · phone rendering. Caveat for humans: the
page uses smooth-scroll + ~1.6 MB of inline base64; aggressive programmatic scrolling
wedged the automated tab once. Normal human scrolling should be fine, but give it one
phone pass before Nancy. Re-run: serve the file locally (config kept in
/Users/oskarpeterson/Documents/AI/.claude/launch.json, "essence-showcase") and repeat.

## Update 2026-08-25 ~23:20 — Essence showcase v2 (real renders)

The Essence session rebuilt the showcase on the developer's REAL architect renders
(scraped+mapped per villa from essencemoraira.com; Blender massing scrapped) and
republished to the SAME artifact URL — Brain verified live: 8.8 MB served at 38777df1,
hero = real render, per-villa galleries + 4-col spec ledgers present, honest credits
footer. Commit f2e2395 is UNPUSHED (repo worktree ahead 1).
DEVELOPER-CREDIT QUESTION (Oskar decides before Nancy): page credits
"Developer: Orange Villas Development S.L." — that is the legal promoter SPV per
Essence's own M1 receipts (README line 25). But the project's public site credits
"GPC Group" as developer brand; our ledger's "Grupo Turis" looks stale. Recommend
crediting the public brand (GPC Group) or both; SPV-only can read oddly on a sales
page. One-line fix in showcase2.json + rebuild if changed.

## Update 2026-08-27 — LANTMÄTERIET GRANTS DELIVERED ✅

Geotorget orders LM2026/114822 (fastighetsindelning vektor) + LM2026/114814 (byggnad
vektor) flipped to "Lyckad". Brain downloaded + verified Norrköping (kn0581) same
morning: both GPKGs at "product twin/lm-data/" (NOT in git — LM license). PROOF:
registerenhetsomradesyta query returns Svärtinge 54:28 polygon (fid 51016844,
senastandrad 2023-01-27, geometry present; 1,231 Svärtinge parcels). See
lm-data/README.md for re-check command + NOT-checked list. Nationwide per-kommun
fetch available via the STAC API under the same grant.
UNBLOCKED: Spatial's authoritative boundary (its 2026-08-26 "Geotorget order is
unavoidable" finding is resolved — relay to the session) · MIMER official parcel
receipt · building footprints · plot-analysis SEO machine data layer.

## Update 2026-08-27 16:15 — FLEET WAVE on LM mandates, all Brain-verified

Five sessions restarted and executed their 2026-08-27 mandates; Brain independently
verified each (not just commit messages). All UNPUSHED (ahead counts noted):

- **Avatar** (ahead 1, dff4486): 11-twin regression FIXED — verified 17 richer twins
  now (8 native + 9 material-cued), generic proxies deleted, all 203 still G2; Adtraction
  wrapping pre-wired. Note: EAN still 2/203 (backfill is a separate follow-up).
- **Spatial** (ahead 4): boundary overlay (ded76d7) + byggnad footprints (c6933b8 ingest,
  82f57b1 viewer). Verified: validator 838 PASS; ingest-buildings --self-test PASS;
  153 footprints clipped, footprint AUTHORITATIVE / height DERIVED (heights never invented).
- **Platform** (ahead 4): froze Spatial's mount contract (d8bbc60), authoritative
  boundary layer element (b141d80), twin-consumption path GLTF_ASSET+SYSTEMS (f7d480c).
  Verified: engine:gate 22/22, bundle 18/18, compiler 47/47 all PASS.
- **MIMER** (ahead 2): authoritative parcel receipt #21 added, 54:28 moved OUT of the
  NOT-verified ledger (cd64527); §6 BoM build_bom.py + §7 comps framework (0ba8f38).
- **BRAGE** (ahead 1, 0ba2fcb): evidence chips updated (slope "13° SV — uppmätt", area
  authoritative — 4 mentions), House A undervåning plan added (SVG count 18→19).

Push all: `for d in repo-avatar-factory repo-brage repo-mimer repo-platform repo-spatial-studio; do git -C "$d" push; done`
Still open for Oskar: tre-hus winner call · Adtraction sitting · Essence credit + Nancy.

## Update 2026-08-28 ~13:30 — ADTRACTION CHANNEL APPROVED ✅

The "Hansson & Hertzell" channel (submitted 2026-08-27: Content type, hanssonhertzell.se,
1,000 monthly visitors) was APPROVED. The earlier rejection ("promotional method/traffic
source not verifiable") was cleared by the honest real-website + modest-real-number
submission. This unblocks the affiliate money rail end to end.
NEXT (Oskar-gated, dashboard): apply to individual brand programs — priority
IKEA SE (id 1978727047, 9%), Nordic Nest, Byggstart (925 SEK/lead, house-build → direct
fit for the Svärtinge/MIMER funnel). The moment ANY program approves, Avatar Factory's
pre-wired backfill-commerce.mjs (Adtraction link-wrapping behind its config flag) turns
the 203 twins' null affiliate_links into tracked links in one run.

## Update 2026-08-28 ~14:10 — Program applications submitted (Brain, via Chrome)

Applied via the approved "Hansson & Hertzell" channel:
- **Nordic Nest SE** (8% per sale, 69,895-product home-furnishing feed) — APPLICATION SENT,
  under review. Good IKEA-alternative catalog (Fritz Hansen, Stelton, Global, etc.).
- **Byggstart SE** (~71.56 GBP/lead new-build; 44.48 renovation; 11.60 other) —
  APPLICATION SENT, under review. Direct fit for the Svärtinge/MIMER house-build funnel.
- **IKEA SE — BLOCKED, cannot apply.** Adtraction shows: "This channel cannot apply to
  promote this brand due to Content channels are not allowed." Our channel is Content-type
  (the honest description of the Product Twin shoppable-content use). IKEA disallows content
  channels on Adtraction.
  ⚠️ STRATEGIC: the 203 twins are built on IKEA SKUs, but IKEA is not reachable with our
  channel type. Options for Oskar: (a) monetize via Nordic Nest instead (different catalog —
  Avatar would re-point/add Nordic Nest products); (b) investigate whether IKEA allows a
  DIFFERENT channel type we could honestly qualify for; (c) reach IKEA affiliate via another
  network. Do NOT create a mis-typed channel just to pass IKEA's filter.
Next: when Nordic Nest or Byggstart approves, Avatar's backfill wires those tracked links.

## Update 2026-08-28 ~14:40 — Adtraction application sweep (Brain, via Chrome)

Full SE catalog pulled via API (475 programs). Elgiganten, MediaMarkt, Power, NetOnNet,
Electrolux, Miele, Bauhaus, Jula, Clas Ohlson are NOT on Adtraction (they run on Awin/CJ —
Awin-list targets). IKEA SE is on Adtraction but its program restricts EVERY promotional
type (content/paid/direct/savings/other all "not allowed") — effectively closed to open
publishers; reach IKEA via Awin/other network, not Adtraction.

APPLIED (channel "Hansson & Hertzell", all "Application sent / under review"):
1. Nordic Nest SE 8% · 2. Byggstart SE ~72 GBP/lead · 3. Bosch Home SE 4% ·
4. Siemens Home SE 5% · 5. Elon SE 5% · 6. Vitvaror-Outlet.se 4% (Bosch/Siemens/NEFF) ·
7. Granit SE 10% · 8. Gripsholm SE 15% · 9. Newport SE 9%.

QUEUED priority brands (content-eligible unknown until checked; apply via
platform.adtraction.com/brands/<id>?channel=2106320328):
Kungsängen 1954031234 · Länna Möbler 1714020937 · Svenssons 1740247393 ·
Bobo Home 1963727346 · Chilli.se 1918738947 · Magasin 11 1960529814 · Mjuk 1670846950 ·
Designtorget 1105652945 · Bäddsofflagret 1960532773 · VidaXL 1680333337 ·
Lampan.se 1934366746 · Markslöjd 1409973979 · Lampemesteren 1690870362 ·
Valostore 1954031170 · KitchenTime 1871508222 · Bagaren och Kocken 1048502771 ·
Onyx Cookware 1974402616 · Trendcarpet 1962291457 · SE Mattor 1954031339 ·
Kilands 1960528772 · Beijer Bygg 1127510935 · P Lindberg 1954027466 · Golvpoolen 1954023645.
APPLY MECHANIC: 2-batch per brand (navigate+screenshot to get button-y [673 w/ badge row,
697 w/ multi-country row]; then click apply + click "Agree & apply" at (1231,520) +
screenshot). Single-batch-with-navigate fails on load timing — don't.
When any program approves → Avatar backfill wires tracked links.

## Update 2026-08-28 ~15:30 — Adtraction sweep COMPLETE (30 programs applied)

APPLIED (all "under review" unless noted). Appliances/white-goods: Bosch Home 4%,
Siemens Home 5%, Elon 5%, Vitvaror-Outlet 4%. Kitchen: KitchenTime 8%, Bagaren och
Kocken 5%, Onyx Cookware 15%. Furniture: Nordic Nest 8%, Granit 10%, Gripsholm 15%,
Newport 9% (**APPROVED** ✅ — feed 2175, 13,036 SKUs, tracking link live), Kungsängen 5%,
Länna Möbler 5%, Svenssons 8%, Bobo Home 7%, Chilli 7%, Magasin 11 5%, Mjuk 5%,
Designtorget 4%, Bäddsofflagret 6% (AOV 1225 GBP), VidaXL 6%. Lighting: Lampan 14%,
Markslöjd 10%, Lampemesteren 8%, Valostore 10%. Rugs/textile: Trendcarpet 9%, SE Mattor 9%.
Building/floor: Golvpoolen 3% (AOV 517 GBP, EPC 1.70 — highest). Garden/rural: P Lindberg 6%.
BLOCKED (content channels not allowed, like IKEA): IKEA SE, Kilands.
NOT FOUND (stale program id): Beijer Bygg (1127510935) — skip.
Not on Adtraction at all (→ Awin): Elgiganten, MediaMarkt, Power, NetOnNet, Electrolux,
Miele, Bauhaus, Jula, Clas Ohlson.
When each approves → Avatar backfill wires the tracked link. Newport is the flagship
deep-map (mandate in avatar handoff): 13,036 SKUs, layering/attach-point model.
STILL NEEDED: Newport product FEED url (dashboard "Copy feed URL", copied to Oskar's
clipboard 2026-08-28 — awaiting paste) → .runtime → Avatar ingestion.

## Decisions Oskar owns (queued)

1. Winner: confirm Vinkelhuset (per 03-JUDGED-MATRIX) or re-open via tre-hus artifact.
2. Adtraction: register channel + submit IKEA SE / Nordic Nest / Byggstart applications.
3. Awin signup finish; send Arper + Muuto letters (drafted).
4. Disk cleanup go-ahead; Opero vault backup confirmation.
5. Merge agent/essence-moraira-pilot → main (the superset), retire integration branch.
