# Svärtinge Visual Reconstruction v0.7

Date: 2026-08-24

Branch: `agent/plot-to-project-spatial-studio`

Subject: working property identity `SVÄRTINGE 54:28`

## Outcome

The Svärtinge Site Intelligence viewer now contains two photorealistic existing-condition reconstruction stages: **Neighbourhood aerial** and **Street arrival / Plot outlook**. They are mounted directly in the main Realistic navigation profile, while the analytical 3D Twin and live municipal aerial history remain separately inspectable.

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
- Street asset: `prototype/svartinge-neighbourhood/assets/street-arrival-existing-condition-v0.1.png`
- Aerial asset: `prototype/svartinge-neighbourhood/assets/neighbourhood-aerial-existing-condition-v0.1.png`
- Validator: `scripts/validate-svartinge-neighbourhood-prototype-v0.2.mjs`
- Mutation suite: `scripts/test-svartinge-neighbourhood-prototype-v0.2.mjs`

## Deterministic asset identity

- Street dimensions/hash: 1672 × 941 px · `47c0ce69c29659c219f9c12d1cc1be08235a505ed941dad48e801ad0f8ccec13`
- Aerial dimensions/hash: 1672 × 941 px · `45b6a7d4332e5359735acb075310423e88f178088917ccc99058cfcbd0891d41`
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

## Spatial-view repair

The prior Realistic profile still exposed low-detail analytical geometry. This checkpoint repairs that failure:

- road and verge ribbons use continuous joined meshes instead of disconnected boxes;
- context buildings use continuous gable roof prisms instead of pyramid caps;
- the indicative plot edge is intelligence-only and cannot leak into Realistic mode;
- Neighbourhood, Street and Plot Realistic stages use the matching full-stage reconstruction surface;
- the unselected design stage shows existing conditions and says `NO HOUSE PROFILE SELECTED` instead of displaying a crude house as if accepted.

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
2. a second plot-outlook camera distinct from the street-arrival frame;
3. seasonal and low-sun variants only after the existing-condition cameras are accepted.

Each view must have its own manifest record, source bindings, stable asset hash and visible reconstruction warning. A proposed house may be composited only as a separate concept scenario after the existing-condition sequence is accepted.
