# Plot-to-Project Spatial Contract v1 fixtures

`contract-only-fixture-v1.json` is a synthetic, unbound compiler fixture. It contains no Swedish property or Munin market data. Its only purpose is to exercise the SiteTwin → NeighbourhoodTwin → BuildingTwin → UnitTwin → ExistingConditionTwin → SpaceTwin hierarchy and all six existing-property scenario modes.

`contract-only-compiled-graph-v1.json` is the deterministic graph projection used by the mutation gate. It is not property evidence.

Run `npm run spatial:compiler:gate` and read `docs/handoffs/PLOT-TO-PROJECT-SPATIAL-CONTRACT-V1.md` before binding a real external reference.
