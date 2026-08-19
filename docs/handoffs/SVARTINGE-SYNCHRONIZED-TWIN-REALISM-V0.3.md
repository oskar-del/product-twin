# Svärtinge Synchronized Twin Realism v0.3

Date: 2026-08-18

Branch: `agent/plot-to-project-spatial-studio`

Subject: working property identity `SVÄRTINGE 54:28`

## Outcome

The existing evidence-labelled scene now drives three synchronized render profiles:

1. `INTELLIGENCE` — evidence-class materials, labels, uncertainty and source inspection.
2. `REALISTIC` — naturalistic materials, Swedish contextual vegetation, roofs, roads, atmosphere, lighting and shadows.
3. `COMPARE` — intelligence and realistic profiles rendered side-by-side with one camera, one navigation state and one scene graph.

The upgrade does not duplicate geometry. Changing camera, navigation stage, solar time, terrain visibility, POIs, plot selection or room cutaway changes the same underlying Twin in every profile.

## Evidence rule

Realism is a presentation profile, not an evidence state. The five spatial evidence classes remain exactly:

- `AUTHORITATIVE`
- `INDICATIVE`
- `DERIVED`
- `REPORTED_UNVERIFIED`
- `CONCEPT`

Procedural vegetation, materials and atmosphere are local visualisation. They do not create a tree survey, façade survey, orthophoto, legal boundary, terrain datum, road survey, access confirmation, entitlement or utility record.

## Files

- Viewer: `prototype/svartinge-neighbourhood/index.html`
- Scene: `data/sites/sweden/saterdalsvagen-14/neighbourhood-scene-v0.2.json`
- Provider registry: `data/sites/sweden/saterdalsvagen-14/context-providers-v0.1.json`
- Provider schema: `config/spatial/svartinge-context-providers-v0.1.schema.json`
- Scene validator: `scripts/validate-svartinge-neighbourhood-prototype-v0.2.mjs`
- Mutation suite: `scripts/test-svartinge-neighbourhood-prototype-v0.2.mjs`

## Context provider states

| Provider | State | Intended role |
|---|---|---|
| Local procedural realism | `CONNECTED` | Immediate naturalistic presentation without new evidence |
| Norrköping oblique imagery | `DOCUMENTED_NOT_CONNECTED` | Dated roof, vegetation, road and neighbourhood reference |
| Norrköping orthophoto | `DOCUMENTED_NOT_CONNECTED` | High-resolution ground texture and plan context |
| Norrköping 3D city model | `DOCUMENTED_NOT_CONNECTED` | Municipal terrain, buildings and draped imagery |
| Norrköping property extract | `DOCUMENTED_NOT_CONNECTED` | Municipal geometry with explicit no-legal-effect limitation |
| Mapbox Standard Satellite/Terrain | `KEY_REQUIRED` | Live satellite, terrain, buildings, lighting and shadows |
| Google Street View | `RESEARCH_ONLY` | Separate synchronized live street-reference surface |
| Google Photorealistic 3D Tiles | `KEY_REQUIRED` | Live photorealistic background; never geometry extraction |
| Lantmäteriet Terrain Model grid 1+ | `DOCUMENTED_NOT_CONNECTED` | Candidate source for accepted terrain |

All `credential_configured` values are redacted booleans and currently `false`. No key, token, password, connection string or external-system write is present.

## Interaction

The seven-stage path remains:

`NEIGHBOURHOOD VIEW → STREET VIEW → PLOT ORBIT → CONCEPT HOUSE ON PLOT → BUILDING ORBIT → ENTER BUILDING → ROOM`

Keyboard shortcuts:

- `1`: Intelligence
- `2`: Realistic
- `3`: Compare
- Left/right arrows: previous/next navigation stage

The Sources drawer explains provider state and limitations inside the viewer.

## Hard gates still open

- Legal boundary
- Registered area
- Entitlement
- Buildable envelope
- Legal access
- Utility capacity
- Surveyed terrain
- Finished-floor level

These gates block authoritative claims only. They do not block the explicitly labelled concept visualisation, sun/view study, navigation or room experience.

## Verification target

`npm run site:sweden:svartinge:prototype:gate`

The gate validates the scene, all five evidence classes, seven navigation stages, one-Twin renderer binding, three render profiles, provider safety policy, provider state isolation, absent credentials and tamper attacks. The local server must return the viewer, scene and provider registry independently.

## Next evidence-backed realism step

Acquire the exact Norrköping municipal oblique imagery/orthophoto and determine 3D city-model coverage for the working plot. Each artifact must receive a dated source receipt, licence, CRS, coverage and hash before it can replace procedural context. A runtime-restricted Mapbox token can later enable live satellite and terrain without committing credentials. Google surfaces should remain separately attributed live reference/background layers and must not be used to extract geometry.
