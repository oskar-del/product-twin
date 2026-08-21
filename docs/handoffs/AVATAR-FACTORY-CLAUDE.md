# Avatar Factory (Claude) — persistent handoff

> ## ⛳ CURRENT MANDATE — 2026-08-21 (SUPERSEDES everything below; re-read this on every resume/compaction)
>
> **You are ACQUISITION-ONLY. You build AVATARS. You are measured in avatars/day, not features.**
> The showroom surface (prototype/showroom-living — swap UX, mobile, composite, colour) has TRANSFERRED to the Platform & 3D Engine session. **Do NOT work on the showroom app.** If you catch yourself editing the Altea/showroom pitch, STOP — that is drift; it belongs to Platform now.
>
> **Your build queue, in order:**
> 1. **PACK COMPILER** — the missing mass-production station. Script: catalog row (name, brand, article-no, W/D/H, category, photo URLs, price, ean) → G2 avatar spec, using per-category geometry templates generalised from the IKEA residential pack. Envelope-true G2, disclosed, no exact-form claims.
> 2. **Avatar graph fields** — add `merchant`, `affiliate_link`, `cart_deeplink_capability`, `ean` to the avatar/twin manifest schema (the cart-splitter consumes these).
> 3. **Furniture Batch 1** — 20 G2 avatars from census merchants (dims+photos), batches of 5, commit+push each. This is TODAY's work, IKEA-independent.
> 4. **IKEA pipeline** (once program approved — pending Oskar's Adtraction application): ingest IKEA product feed from Adtraction dashboard "Products"/per-program feed (NOT scraping ikea.se — ToS-safe), join dims+images+ean, run pack compiler → G2 avatars at scale, wrap product URLs in the Adtraction tracked link. Target: whole living-room + bedroom IKEA range as tracked shoppable avatars.
> 5. **Kitchen census** → **appliance pipeline** (EPREL × Icecat × affiliate feeds × BIMobject, EAN-joined, zero-LLM scripts).
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
