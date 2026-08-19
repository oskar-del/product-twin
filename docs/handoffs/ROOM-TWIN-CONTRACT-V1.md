# Room Twin Contract v1 · Brain Checkpoint

Checkpoint date: 2026-08-17

Spatial Studio branch: `agent/plot-to-project-spatial-studio`

Room Lab compatibility target: `3daea697deabe6c53bb161c9ed5f42031f4fde41`

## Outcome

Spatial Studio now owns a strict, versioned `room-twin/v1` contract for the canonical hierarchy:

```text
Site Twin
  → Building frame
    → Level frame
      → Room frame and Room Twin
        → deterministic room-scene/v1 export
          → Room Lab interaction and explicit placements
```

Room Lab does not infer site, building, level or room truth. It receives only the supported Room Lab scene projection. Unknown upstream transforms and geometry remain null and hard-gated in the Room Twin.

## Contract package

| Purpose | Path |
| --- | --- |
| Room Twin JSON Schema 2020-12 | `config/room/room-twin-manifest-v1.schema.json` |
| Spatial intent JSON Schema 2020-12 | `config/room/spatial-intent-record-v1.schema.json` |
| Strict validator and deterministic Room Lab exporter | `scripts/room-twin-manifest.mjs` |
| Bundle, lineage and compatibility validator | `scripts/validate-room-twins.mjs` |
| Mutation suite | `scripts/test-room-twin-manifest.mjs` |

The schemas and strict importer reject unknown fields. The executable validator additionally enforces cross-record relationships that JSON Schema alone cannot prove: hierarchy, evidence bindings, gate status, geometry consistency, exact upstream gate preservation, source hashes, profile isolation and deterministic export.

## Canonical identity and transform chain

Every Room Twin contains:

- Project, Site Twin, Design Scenario, Building, Level and Room identity.
- Room version, type, intended use and evidence-aware room state.
- Site CRS/origin and building → site, level → building and room → level transforms.
- Metre/radian units, axis convention and optional room-to-true-north yaw.
- A hard gate and evidence reference for every transform.

A populated transform is rejected unless its gate is `SATISFIED` and its evidence state is not `UNKNOWN`. A room true-north angle is rejected while the room transform is null.

## Geometry and semantic anchors

The contract can represent bounds, floor, ceiling, walls, Room Lab surfaces, openings, columns, fixed elements, service zones, protected paths and verified clearances. It can anchor walls, room centre, doors, windows, view directions/cones, morning/evening sun, focal points, services, furniture relationships and garden/terrace relationships.

Null is meaningful. Unknown ceiling, services, clearances, openings, hierarchy transforms or site placement remain null; the validator rejects fields that attempt to smuggle boundary, terrain, access, entitlement or a buildable envelope into Room Twin ownership.

## Evidence states

Supported evidence states are:

- `SURVEYED`
- `OFFICIAL_SOURCE_DERIVED`
- `MEASURED_FROM_SUPPLIED_EVIDENCE`
- `ASSUMED`
- `CONCEPT_DESIGN`
- `UNKNOWN`

Each evidence record contains its source kind and locator, observation date, confidence, method and limitations. The room-level state constrains which evidence states may support its geometry. For example, `ASSUMED_DESIGN_ROOM` geometry cannot be relabelled surveyed, and `CONCEPT_DESIGN_ROOM` geometry cannot be relabelled measured or official.

## Example A · Marbella Living Room baseline

Path: `data/room-twins/marbella-living-room-v1.json`

Room Lab export: `data/room-twins/exports/marbella-living-room.room-scene.v1.json`

- State: `ASSUMED_DESIGN_ROOM`.
- Bounds: 6.0 × 4.6 m, 27.6 m² room-local rectangle.
- Preserves the frozen Room Lab floor, four surfaces, garden window, protected entry path, room-centre anchor and eight explicit baseline placements exactly.
- Adds only semantic relationships supported by those named Room Lab objects.
- Site CRS/origin, building/level/room transforms, true north, ceiling, wall assemblies, services and required clearances remain unknown/null.
- This is not a survey, approved BIM model or as-built record.

## Example B · CANOPUS Deluxe Guest Room concept

Path: `data/room-twins/canopus-deluxe-guest-room-v1.json`

Room Lab export: `data/room-twins/exports/canopus-deluxe-guest-room.room-scene.v1.json`

- State: `CONCEPT_DESIGN_ROOM`.
- Bounds: approximate 6 × 8 m, 48 m² centred room-local concept rectangle.
- Includes a concept floor, four abstract room edges, room centre and edge relationships only.
- Ceiling, wall assemblies, doors, windows, columns, fixed elements, services, protected circulation and required clearances remain null.
- The verified Site Twin v0.2 CRS/origin is hash-bound by reference. Building, level and room transforms remain null, so the concept is not placed on the parcel and cannot yet support solar/view ranking.
- The CANOPUS PDFs remain creative/reference evidence. The room is not surveyed, approved BIM, entitled or built geometry.

## Spatial-intent extension

The v1 intent record covers morning/evening sun, views, privacy, glare/overheating, window constraints, adjacency/circulation and garden sun/shade/wind/water/planting zones.

```text
User/design intent
  → hard constraints
    → soft objectives
      → deterministic candidates
        → evidence-backed ranking
          → explicit user selection
```

Candidate generation or ranking remains `BLOCKED` when required transforms, glazing, obstruction or environmental evidence is absent. No broad intent UI is included in this checkpoint.

## Domain ownership

| Domain | Owner |
| --- | --- |
| Site/building/level/room geometry and environmental anchors | Spatial Studio |
| Furniture geometry and product spatial semantics | Avatar Factory |
| Destination-specific supply | Procurement |
| Interaction and explicit placements | Room Lab |
| Final acceptance | Verification |

Room Twin exports explicit placements only as Room Lab-owned compatibility data. It does not acquire furniture geometry or commerce fields.

## Frozen Room Lab compatibility

The Room Lab branch was inspected read-only and was not edited.

- Frozen Room Lab scene SHA-256: `361c172dabe595353635112cda066e96efce8cb6e7da13972929cd8feb85c64c`
- Frozen importer SHA-256: `9ebcd0f264d9e8e86b5e8a41170bdbbe075792c7cd6fdb44728e115ca2b8d836`
- Marbella Room Twin export is canonically identical to the frozen `marbella-living-room.v1.json` scene.
- Both Marbella and CANOPUS exports are accepted by the exact frozen `room-manifest.mjs` importer.
- Their scene IDs and bounds stay isolated after import.

## Test checkpoint

| Gate | Result |
| --- | --- |
| Room Twin bundle | PASS · 2,402 assertions |
| Frozen Room Lab compatibility | PASS · 2,411 assertions |
| Room Twin mutation suite | PASS · 18/18 attacks rejected |
| Deterministic export | PASS · 2/2 room profiles, two clean runs each |
| Frozen Room Lab native tests | PASS · 6/6 tests |

The mutation suite covers hierarchy, gated transforms, units, missing/invalid evidence state, invented geometry, upstream-null preservation, bounds, openings, protected paths, evidence promotion, room/profile isolation, unknown fields, schema version, CANOPUS gate drift and content-hash drift.

## Current CANOPUS hard gates

The Room Twin preserves the exact Site Twin v0.2 upstream state: 2 satisfied and 9 open.

Satisfied:

- `GATE_CATASTRO_BOUNDARY`
- `GATE_IGN_TERRAIN`

Open:

- `GATE_CONTEXT_OBSTRUCTIONS`
- `GATE_CERTIFICADO_URBANISTICO`
- `GATE_GOVERNING_PLAN`
- `GATE_A7_BUILDING_LINE_AND_ACCESS`
- `GATE_PERMITTED_ACCESS`
- `GATE_ROOFTOP_RULES`
- `GATE_TITLE_AND_CHARGES`
- `GATE_FLOOD_AND_OVERLAYS`
- `GATE_UTILITY_CAPACITY`

Additional room gates remain open for building placement, level assignment, room placement/orientation, approved BIM or survey evidence, and openings/services/circulation/clearances.

The Room Twin deliberately keeps `site_boundary_geometry`, `terrain_dem`, `permitted_access_point`, `planning_entitlement` and `buildable_envelope` null. Boundary and terrain live in the referenced Site Twin; access, entitlement and envelope remain unresolved there.

## What remains assumed versus verified

Verified official-source derived:

- CANOPUS Site Twin v0.2 parcel boundary and coordinate frame.
- CANOPUS official 5 m context terrain, explicitly not survey-grade topography.
- Hash bindings to the Site Twin, spatial export and Design Scenario source record.
- Fidelity of both deterministic exports to the frozen Room Lab importer contract.

Assumed or concept-only:

- Marbella room bounds, opening, paths, anchors and placements are preserved assumptions from Room Lab Alpha.
- CANOPUS 48 m² / approximate 6 × 8 m rectangle is a design concept.
- All Marbella hierarchy/site transforms and all CANOPUS building/level/room transforms.
- CANOPUS room orientation, views, solar exposure, privacy, glare, openings, services and clearances.

## Verification approval required

Verification must approve before promotion:

1. Schema and strict-validator semantics, including fail-closed unknown-field behaviour.
2. Content hashes and hierarchy IDs for every referenced upstream artifact.
3. Transform composition, CRS/unit handling and true-north convention once transforms exist.
4. Survey/BIM evidence classification and observation/currentness dates.
5. Bounds, surface, opening, protected-path and verified-clearance consistency.
6. No promotion of assumed/concept geometry to surveyed, approved or built status.
7. Exact CANOPUS upstream gate preservation and absence of invented site truth.
8. Deterministic export fidelity and Room Lab profile isolation.
9. An explicit user selection record before any intent-ranked candidate becomes a placement.

## Next official CANOPUS source

The next acquisition is a parcel-specific municipal planning response from the Ayuntamiento de Marbella's Urbanismo/OIAU for cadastral parcel `5410501UF2451S`, tied to the current governing instrument and applicable development-plan files. It must establish classification, qualification, use, buildability/occupancy/height/setback rules and any applicable planning or management expediente; it must not be inferred from a generic map screenshot.

Official discovery starting points:

- OIAU: `https://urbanismo.marbella.es/oiau.html`
- Current municipal planning portal: `https://urbanismo.marbella.es/plan-general.html`
- SITMA planning and expediente layers: `https://urbanismo.marbella.es/sistema-de-informacion-territorial-de-marbella/sitma.html`

The municipal portal currently identifies PGOU 1986 and its updates as the current planning basis while a new PGOM/POU process is in progress. OIAU explicitly handles property-specific PGOU classification, qualification, development conditions, permitted uses and licences. A formal request may require an authorised applicant, municipal registration and/or a fee; no request was submitted in this checkpoint.

## Commands

```sh
npm run room:twin:validate
npm run room:twin:mutations
npm run room:twin:compat
npm run room:twin:gate
```

`room:twin:compat` is the explicit cross-workstream check and requires the frozen Room Lab checkout at `../room-lab-site`. The self-contained `room:twin:gate` runs the contract and mutation profiles without depending on another worktree.

No merge, deployment, Room Lab edit or broad Room Twin UI is part of this checkpoint.
