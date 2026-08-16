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

## Current scope

This first workflow only proves:

1. real MCP call,
2. real products,
3. persistent normalization,
4. repeatable ingestion,
5. GitHub-backed product graph seed.

3D, rights, dimension enrichment, merchant-specific resolution, substitution scoring, and room placement remain subsequent gates.
