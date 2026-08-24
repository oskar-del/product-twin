# Svärtinge Visual Reconstruction v0.7

Date: 2026-08-24

Branch: `agent/plot-to-project-spatial-studio`

Subject: working property identity `SVÄRTINGE 54:28`

## Outcome

The Svärtinge Site Intelligence viewer now contains its first photorealistic existing-condition reconstruction: **Street arrival**. It is a separate visual surface beside the analytical 3D Twin and the live municipal aerial history.

The view is grounded in the exact-address listing gallery and the recorded nearby street character. It depicts the observed cleared hillside, asphalt/gravel working edge, exposed stone and soil, retained pine and birch, brush pile, neighbouring low houses, overhead utilities and Lake Glan horizon.

## Evidence status

The asset is `CONCEPT_VISUAL_RECONSTRUCTION`.

It is not:

- a source photograph;
- a current-condition verification;
- surveyed geometry;
- an exact camera match;
- evidence of a legal boundary, access right, utility identity/capacity, entitlement, buildable envelope, elevation or finished-floor level.

The permanent viewer label is:

`VISUAL RECONSTRUCTION · NOT A SURVEY OR CURRENT PHOTOGRAPH`

## Files

- Manifest: `data/sites/sweden/saterdalsvagen-14/visual-reconstruction-v0.1.json`
- Schema: `config/spatial/svartinge-visual-reconstruction-v0.1.schema.json`
- Viewer: `prototype/svartinge-neighbourhood/index.html`
- Asset: `prototype/svartinge-neighbourhood/assets/street-arrival-existing-condition-v0.1.png`
- Validator: `scripts/validate-svartinge-neighbourhood-prototype-v0.2.mjs`
- Mutation suite: `scripts/test-svartinge-neighbourhood-prototype-v0.2.mjs`

## Deterministic asset identity

- Dimensions: 1672 × 941 px
- SHA-256: `47c0ce69c29659c219f9c12d1cc1be08235a505ed941dad48e801ad0f8ccec13`
- Provider pixels embedded: no
- Geometry extraction allowed: no
- Evidence gates closed: none

## Verification

`npm run site:sweden:svartinge:prototype:gate`

- 556 assertions passed
- 88 mutation attacks passed
- live-context credential and evidence-isolation checks passed
- geographic alignment guards passed
- browser visual QA passed with no console errors

The new attacks reject promotion of the reconstruction to source photograph, survey evidence or gate-closing evidence; provider-pixel claims; geometry extraction; hard-gate removal; asset hash drift; and unknown fields.

## Open hard gates

- Legal boundary
- Registered area
- Entitlement
- Buildable envelope
- Legal access
- Utility capacity
- Surveyed terrain
- Finished-floor level

## Next visual milestone

Build a short, coherent existing-condition sequence from the same evidence contract:

1. approach along Säterdalsvägen;
2. street edge looking into the plot;
3. plot outlook toward Lake Glan;
4. aerial-oblique neighbourhood context.

Each view must have its own manifest record, source bindings, stable asset hash and visible reconstruction warning. A proposed house may be composited only as a separate concept scenario after the existing-condition sequence is accepted.
