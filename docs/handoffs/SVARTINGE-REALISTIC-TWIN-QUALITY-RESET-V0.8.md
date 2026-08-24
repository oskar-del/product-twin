# Svärtinge Realistic Twin quality reset v0.8

Date: 2026-08-24

Branch: `agent/plot-to-project-spatial-studio`

Subject: Säterdalsvägen 14 / working identity `SVÄRTINGE 54:28`

## Outcome

The viewer now presents one evidence-controlled Twin through two deliberately different lenses:

- **Intelligence** keeps the indicative/derived geometry graph visible without the dense terrain wireframe that previously produced broken-line and moiré artifacts.
- **Realistic** uses four distinct, stage-specific existing-condition reconstructions instead of recycling one image across the journey.

The viewer does not invent a house to complete the experience. `Building orbit`, `Enter building`, and `Room` are hard-locked while `selected_house_profile` is null. The design-scenario stage explicitly shows the existing condition and states that no house profile is selected.

## Existing-condition sequence

| Stage | View | Asset | SHA-256 |
|---|---|---|---|
| Neighbourhood | Aerial-oblique context | `neighbourhood-aerial-existing-condition-v0.1.png` | `45b6a7d4332e5359735acb075310423e88f178088917ccc99058cfcbd0891d41` |
| Street | Säterdalsvägen approach | `street-approach-existing-condition-v0.1.png` | `891a5749880b458aff87377325e53b0f2119789c3fc7765381660c9fc3ac463c` |
| Plot | Outlook toward Glan | `plot-outlook-existing-condition-v0.1.png` | `6df422ab0f4ba2059e6f2db83295610c52c36ca13beb26cbc3402c7815ee6bf4` |
| Design not selected | Existing-condition arrival | `street-arrival-existing-condition-v0.1.png` | `47c0ce69c29659c219f9c12d1cc1be08235a505ed941dad48e801ad0f8ccec13` |

All four are `CONCEPT_VISUAL_RECONSTRUCTION`, not source photographs, surveys, legal evidence, or current-condition verification. They contain no copied provider pixels and close no evidence gate.

## Contract and viewer changes

- The versioned visual-reconstruction contract now admits exactly four named viewpoints and binds each to an immutable asset hash.
- The main Realistic renderer maps each stage to one viewpoint deterministically.
- The Realistic-view drawer is a four-view gallery and opens synchronized to the active stage.
- Continuous road ribbons and gable-roof context massing remain in the analytical graph.
- The plot evidence edge remains intelligence-only and does not leak into the Realistic profile.
- The dense terrain wireframe was removed; it added no source truth and caused visible false linework.
- Unselected downstream design stages are disabled in both buttons and keyboard navigation.

## Verification

The complete Svärtinge prototype gate passes with:

- 591 validation assertions
- 91 deterministic mutation attacks
- runtime-only live-context token test
- official SWEREF origin and stage-camera alignment test
- clean `git diff --check`

The mutation suite now also rejects a removed viewpoint, duplicated viewpoint identity, and a stage/asset swap.

## Evidence gates still open

This visual reset does not promote spatial or legal truth. The following remain open:

- legal property designation and registered cadastral boundary
- registered land area reconciliation
- surveyed terrain and spot heights
- legally permitted access point
- planning entitlement and buildable envelope
- utility connection locations and available capacity
- approved building profile, placement, finished-floor level and room geometry
- source/capture dates and publication rights where the provider does not expose them

## Next official evidence needed

The next spatial promotion requires Lantmäteriet property-boundary/identity evidence tied to the exact address or confirmed fastighetsbeteckning. Survey-grade or official terrain acquisition must then bind to that immutable boundary before any design placement, access, earthwork, view-cone, building, level or room claim can be accepted.
