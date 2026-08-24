# Product Twin

Standalone Product Twin infrastructure repo.

**This repository is intentionally separate from all existing real-estate, storyboard, agency, and email-asset repositories.**

## First hypothesis test

A persistent ingestion flow:

`Shopify Global Catalog MCP → Twin Candidates → GitHub dataset → Twin Factory → Product Twins`

The GitHub Action calls Shopify from GitHub-hosted infrastructure, normalizes the returned catalogue, and commits the refreshed candidate dataset back into this repository.

## Data layout

- `data/shopify/candidates/latest.json` — current deduplicated Twin Candidate universe
- `data/shopify/raw/` — raw MCP response snapshots
- `data/shopify/snapshots/` — normalized historical snapshots
- `data/shopify/latest-run.json` — ingest metrics

## Run manually

GitHub → Actions → **Shopify Product Twin Ingest** → Run workflow.

No local Terminal is required.

## Product Twin MCP

The repository now exposes a local stdio MCP server:

```bash
npm run mcp:serve
```

The contract deliberately separates `search_product_twins` / `get_product_twin` from `search_design_assets` / `get_design_asset`. Product Twins may carry exact identity, offer and logistics evidence; generic Design Assets may support composition and fit only and never inherit SKU, GTIN, price, stock, supplier or checkout claims.

The rights-safe Design Asset factory accepts Sweet Home 3D SH3F/OBJ libraries through `design:asset:intake`, then emits scale-normalized, material-aware GLBs through `design:asset:convert`. Conversion reaches G1; visual QA is required for generic G2.

## Current scope

This first workflow only proves:

1. real MCP call,
2. real products,
3. persistent normalization,
4. repeatable ingestion,
5. GitHub-backed product graph seed.

The first living-room proof now includes exact Product Twin identities, verified-scale G2 planning avatars, destination supply evidence, substitution scoring and Room Lab placement. Exact visual likeness, rights-cleared photo reconstruction, authoritative checkout logistics across all four benchmark markets, and G3+ geometry remain active gates.

## Svärtinge Spatial Studio

The Norrköping proof at Säterdalsvägen 14 now renders one evidence-labelled Twin through `INTELLIGENCE`, `REALISTIC` and synchronized `COMPARE` modes. The focused Street Room uses exact-address listing character and nearby July 2022 Street View character without storing provider pixels or deriving provider geometry. Legal boundary, surveyed terrain, legal access, utility capacity, entitlement and buildable envelope remain open gates.

Run `npm run site:sweden:svartinge:prototype:gate` for the scene, evidence-separation and mutation checks.
