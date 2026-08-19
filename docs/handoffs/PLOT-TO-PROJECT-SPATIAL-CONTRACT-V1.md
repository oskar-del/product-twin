# Plot-to-Project Spatial Contract v1 · Munin Boundary Handoff

Checkpoint date: 2026-08-17

Branch: `agent/plot-to-project-spatial-studio`

## Outcome

Spatial Studio now extends the compiler hierarchy without rebuilding or ingesting Munin:

```text
SiteTwin
  → NeighbourhoodTwin
    → BuildingTwin
      → UnitTwin
        → ExistingConditionTwin
          → SpaceTwin
            → optional versioned RoomTwin reference

ExistingConditionTwin
  → ExistingPropertyDesignScenario
```

The hierarchy is graph-safe and transform-aware. Every child resolves to one parent, frame parentage must match the hierarchy, cross-links are reciprocal, IDs are isolated, and the compiler emits a deterministic node/edge graph.

## Schemas

| Contract | Version | Path |
| --- | --- | --- |
| Shared spatial definitions | `plot-to-project-defs/v1` | `config/spatial/plot-to-project-defs-v1.schema.json` |
| External Munin reference interface | `munin-external-reference/v1` | `config/spatial/munin-external-reference-v1.schema.json` |
| Neighbourhood Twin | `neighbourhood-twin/v1` | `config/spatial/neighbourhood-twin-v1.schema.json` |
| Building Twin | `building-twin/v1` | `config/spatial/building-twin-v1.schema.json` |
| Unit Twin | `unit-twin/v1` | `config/spatial/unit-twin-v1.schema.json` |
| Existing Condition Twin | `existing-condition-twin/v1` | `config/spatial/existing-condition-twin-v1.schema.json` |
| Space Twin | `space-twin/v1` | `config/spatial/space-twin-v1.schema.json` |
| Existing-property Design Scenario | `existing-property-design-scenario/v1` | `config/spatial/existing-property-design-scenario-v1.schema.json` |
| Hierarchy bundle | `plot-to-project-spatial/v1` | `config/spatial/plot-to-project-spatial-bundle-v1.schema.json` |

All schemas use JSON Schema 2020-12. Entity, interface, scenario and bundle objects reject unknown fields.

## Entity responsibilities

### SiteTwin

Remains the upstream site identity, boundary, CRS, terrain and site-evidence authority. The new bundle references an immutable Site Twin by ID, version, path and SHA-256. An unbound compiler fixture must keep version/path/hash null.

### NeighbourhoodTwin

Owns the spatial context around a Site Twin: context frame and reference to context geometry. It does not own market comparables or neighbourhood pricing. Those stay external Munin references.

### BuildingTwin

Owns building placement, frame and envelope geometry. A Munin building or BRF ID can be linked by reference, but ownership, association, valuation and cost facts are not copied locally.

### UnitTwin

Owns unit placement and boundary geometry within a Building Twin. It links to dated Existing Condition Twins and can reference—but cannot copy—Munin unit, listing, sales or comparable-set records.

### ExistingConditionTwin

Owns a dated spatial baseline for a Unit Twin: condition geometry, element observations, evidence state and Space Twin decomposition. `RECORDED` does not automatically mean surveyed or accepted; Verification remains required. An unbound condition has no observation date or asserted geometry.

### SpaceTwin

Owns a spatial subdivision of an Existing Condition Twin, including its frame, geometry and semantic-anchor references. It can bind to a versioned Room Twin without taking over Room Lab, furniture or commerce ownership.

### ExistingPropertyDesignScenario

Owns spatial transformation intent and deterministic result geometry relative to one Existing Condition Twin. It never owns value uplift, costs or ownership facts.

## Munin external reference interface

The interface supports exactly these reference types:

1. `PROPERTY`
2. `BUILDING`
3. `UNIT`
4. `BRF`
5. `HISTORIC_SALES`
6. `CURRENT_LISTING`
7. `COMPARABLE_SET`

Each reference contains only:

- an internal reference ID;
- reference type and opaque external ID;
- external record version;
- optional canonical URI and content hash;
- evidence state and observation timestamp;
- fixed `MUNIN` source ownership; and
- `payload_persisted: false`.

There are no prices, ownership names, sale amounts, listing descriptions, valuation figures, renovation budgets or comparable records in the interface. Unconsumed references are rejected to prevent the bundle from becoming a local Munin cache.

## Evidence states

The contract preserves exactly four evidence states:

| State | Meaning in this interface |
| --- | --- |
| `RECORDED` | Present in a referenced record; not automatically accepted as spatial truth. |
| `LISTED` | Presented by a current listing or listing-linked source. |
| `INFERRED` | Derived interpretation whose method and evidence must remain visible. |
| `FORECAST` | Scenario or future-state projection. |

Unknown information is absent/null and blocked. The contract does not introduce an `UNKNOWN`, `VERIFIED` or `ASSUMED` evidence state. `VERIFIED` may appear as a lifecycle/acceptance status, not as a fifth evidence class.

## Ownership boundary

| Domain | Owner |
| --- | --- |
| Property, building, unit and BRF identity | Munin |
| Historic sales, current listings and comparable sets | Munin |
| Market values and value forecasts | Munin/external evidence system |
| Project and construction costs | Munin/external evidence system |
| Ownership facts | Munin/external evidence system |
| Site → Space hierarchy and coordinate transforms | Plot-to-Project Spatial Studio #3 |
| Applicability of an external reference to a spatial target | Plot-to-Project Spatial Studio #3 |
| Existing-condition and scenario transformation geometry | Plot-to-Project Spatial Studio #3 |
| Final evidence and geometry acceptance | Verification |

Spatial applicability is stored as a separate binding with target ID, status, optional applicability geometry, evidence state, evidence references, date and rationale. The binding explicitly uses `SPATIAL_APPLICABILITY_ONLY_NO_FACT_VALUE`; it cannot carry the external fact's value.

The executable validator recursively rejects local keys representing market value, prices, costs or owner identity. Strict allowlists reject equivalent invented fields elsewhere in the graph.

## Existing-property scenario modes

The scenario schema supports:

- `AS_IS`
- `COSMETIC_RENOVATION`
- `FULL_RENOVATION`
- `RECONFIGURATION`
- `ENERGY_RETROFIT`
- `EXTENSION`

Transformation operations are spatial only: keep, remove, add, move, replace, reconfigure, retrofit envelope or extend. Every operation needs deterministic result geometry, one of the four evidence states and evidence references. `AS_IS` cannot contain transformation operations.

Cost, value, ownership and market-impact facts may be linked only through external evidence bindings. The committed contract-only scenarios contain no operations because no existing-property evidence is bound.

## Coordinate and geometry rules

- Linear units are metres.
- Each child frame declares its exact parent frame.
- A transform is translation + normalized quaternion + unit scale.
- Non-unit scaling is rejected.
- A populated transform needs an evidence state and evidence references.
- An absent transform cannot claim evidence.
- Available geometry needs URI, SHA-256, CRS, valid 3D bounds, evidence state and evidence references.
- Absent geometry keeps URI, hash, CRS, bounds and evidence null.
- The compiler never invents geometry to complete a hierarchy.

## Contract-only fixture

Paths:

- `data/spatial-contract/v1/contract-only-fixture-v1.json`
- `data/spatial-contract/v1/contract-only-compiled-graph-v1.json`

The fixture is synthetic and explicitly unbound. It exists only to exercise the hierarchy and all six scenario modes. It contains:

- zero Swedish properties;
- zero Munin external IDs;
- zero market, cost or ownership facts;
- zero geometry artifacts;
- null transforms and evidence; and
- blockers on every spatial layer.

The committed deterministic graph contains 12 nodes and 11 edges. Two clean compilations must match that export byte-for-byte after canonicalization.

## Deterministic verification

Commands:

```sh
npm run spatial:compiler:validate
npm run spatial:compiler:mutations
npm run spatial:compiler:gate
```

Current checkpoint:

- contract/schema/hierarchy validation: PASS · 1,010 assertions;
- deterministic graph: PASS · 12 nodes / 11 edges;
- mutation suite: PASS · 34/34 attacks rejected;
- external interface: PASS · seven ID types / four evidence states / zero payloads; and
- persisted Munin records in the committed fixture: zero.

Mutations cover schema and evidence-state drift, unsupported reference types, ownership drift, payload persistence, unconsumed/unresolved references, fact-domain mismatch, local values/costs/owners, hierarchy and reciprocal-link errors, transform evidence/quaternion/scale errors, geometry promotion, scenario modes/scope/baseline errors, dashboard scope and deployment state.

## Verification handoff

Before a real existing property is bound, Verification must approve:

1. The identity mapping between each opaque Munin ID and its external record version.
2. Evidence-state classification without upgrading `LISTED`, `INFERRED` or `FORECAST` facts.
3. Content hashes/currentness for bound Site Twin, Room Twin and geometry artifacts.
4. Transform composition and CRS/unit handling across all hierarchy levels.
5. Existing-condition observation scope and observation date.
6. Applicability decisions separately from the underlying external fact.
7. Scenario transformation geometry and its baseline Existing Condition Twin.
8. Absence of locally persisted market, cost and ownership payloads.

## Explicit non-goals

- No Munin service, graph, resolver or database was rebuilt.
- No Swedish market data was searched, ingested or fabricated.
- No property, building, unit, BRF, sales, listing or comparable ID was persisted.
- No dashboard component or route was changed.
- No deployment or merge is part of this checkpoint.

## Revisit when integrating Munin

The first real integration should supply a read-only resolver contract for reference existence, record version/currentness and content hashing. Only then should the compiler bind real IDs. If Munin later exposes event/version semantics, add a new interface version rather than changing v1 in place.
