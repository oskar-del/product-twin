# Shopify native-MODEL_3D census — 1 → ~20 merchant expansion · 2026-08-18 (Claude)

Audit priority #2: broaden the native-3D census from one merchant (Design Public Group) to ~20. Pure compute, rights resolved with the **merchant**.

## Method (unchanged from the proven baseline)

Shopify exposes native 3D as `MODEL_3D` media on the Storefront GraphQL API. The baseline census discovers products from the merchant's `sitemap_products_*.xml`, then runs a **token-less** `product(handle){ media{ ...Model3d } }` query per handle. This works only where a merchant (a) publishes Shopify product sitemaps and (b) leaves the Storefront API reachable without an access token — **neither is universal**, so viability is probed live, never assumed.

## Step 1 — capability probe (live, done)

`npm run avatar:shopify:model3d:capability` tests each candidate in `config/geometry/shopify-merchant-model3d-candidates.json` with a few requests (sitemap → first product sitemap → sample of `product(handle)` queries) and records real HTTP evidence.

**Result — 11 of 22 candidates census-viable:**

| viable (11) | not viable (11) — reason |
|---|---|
| design_public_group_trade (baseline) | burrow — no Shopify product sitemaps (headless) |
| maiden_home | industry_west — no Shopify product sitemaps |
| benchmade_modern | hem — no Shopify product sitemaps |
| sabai | joybird — no Shopify product sitemaps |
| inside_weather | rove_concepts — no Shopify product sitemaps |
| lulu_and_georgia | castlery — no Shopify product sitemaps |
| the_citizenry | thuma — no Shopify product sitemaps |
| branch | poly_and_bark — no Shopify product sitemaps |
| medley | floyd — sitemap fetch timed out repeatedly |
| gus_modern | kardiel — sitemap 403 (bot block) |
| blu_dot | campaign — sitemap fetch failed |

"Not viable" means the token-less-sitemap method doesn't reach them; several are likely headless Shopify or on another platform and would need a different adapter (authenticated Storefront token, or a headless product API).

## Step 2 — multi-merchant census (built, generalized)

`npm run avatar:shopify:model3d:multi-census` runs the identical discovery + detection over every `probe_verdict: "viable"` merchant in `config/geometry/shopify-multi-merchant-model3d-census.json` (the 11 above). It reports `coverage_capped` whenever caps truncate a merchant, so partial 3D counts are never read as complete. The proven single-merchant DPG script is left untouched as the baseline.

### Live evidence (2026-08-18, node v22.14.0)

- **Discovery generalizes:** capped run on a *new* merchant surfaced real catalogues — `blu_dot: discovered=491`, `design_public_group_trade: discovered=6470` relevant products.
- **Detection is correct end-to-end:** the new query+filter path, run against the 4 known-3D DPG handles, returned **4/4 `3D-DETECTED`** with `glb,usdz` formats (Man Day Bed, Man 2-Seater Sofa, Man Lounge Chair, Lobby Sofa).
- **Capped random sweeps found 0** MODEL_3D (40 probes at blu_dot; 200 at DPG). This is **sampling depth, not a bug**: native 3D is ~0.1–0.5% of a catalogue (DPG = 8 finds in ~1594 probes), so a few-hundred-probe cap has <1 expected hit. The sandbox 45 s/command limit prevents a full per-merchant crawl here.

## Step 3 — full harvest (run outside the sandbox)

To actually collect 3D candidates across the 11 merchants, run uncapped (no per-command time limit):

```bash
CENSUS_MAX_SITEMAPS=999 CENSUS_MAX_PROBES=100000 npm run avatar:shopify:model3d:multi-census
```

Outputs (git-ignored-safe to inspect, not auto-committed):
- `data/identity/shopify-multi-merchant-model3d-candidates.json` — all MODEL_3D candidates, merchant-scoped IDs, no model source URLs.
- `data/metrics/shopify-multi-merchant-model3d-census-latest.json` — per-merchant discovered/probed/model3d counts + `any_coverage_capped`.

Then, per candidate: inspect the GLB envelope for scale, resolve **merchant** render/redistribution rights (commercial incentive lies with the merchant, not the manufacturer), and only then feed the scale-QA + promotion pipeline. Nothing here promotes past CANDIDATE.

## NOT done / honest state

- No 3D candidates harvested yet — the harvest run needs an unthrottled environment (documented command above).
- 11 merchants are method-viable; whether each actually *uses* native Shopify 3D is unknown until the full crawl. DPG is the only confirmed-3D merchant so far.
- The 11 "not viable" merchants need a different adapter (token/headless) — out of scope for this pure-sitemap method.
- All counts above are from **capped** runs and are labelled capped; do not read them as catalogue-complete.
