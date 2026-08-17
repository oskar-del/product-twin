# Sweden plot intelligence

This directory is the national Sweden adapter for Plot-to-Project. It is ready
to start an exact Site Twin, but it contains no plot facts yet because no
Swedish property has been identified.

## Minimum intake

Preferred:

- municipality (`kommun`); and
- complete property designation (`fastighetsbeteckning`).

A WGS84 coordinate, street address or listing URL can start locator resolution,
but none of them may be promoted to the property identity without an official
match. Copy `plot-intake-template-v0.1.json` to the runtime workspace and fill
only facts supplied by the user.

The template deliberately denies permission to request property-register
records, contact a municipality, create a Ledningskollen case or commission
field work. Those are external actions and require explicit permission.

## Evidence ladder

1. Open national context: 1 m height model, imagery, indicative property
   division, buildings, roads, geology, wells, flood, protected areas,
   archaeology, contaminated-land screening and climate.
2. Municipal planning: the complete governing plan record, legal-force status,
   amendments, permit history and municipal interpretation.
3. Authoritative property record: owner, mortgage, tax, rights, servitudes,
   joint facilities and relevant cadastral acts.
4. Field and provider proof: boundary/topographic survey, geotechnical and
   environmental testing, utility line response and confirmed connection
   capacity.

Higher levels do not erase lower-level evidence. They close different gates.

## H30/H50 rule

The old shorthand “Attefall = 30 m²” is not used as a decision rule. Under the
current PBL profile effective 2025-12-01, the national maximum individual
building area is 30 m² inside a detailed-plan area and 50 m² outside one, with
45 m² and 65 m² aggregate caps and 4.0 m and 4.5 m ridge-height limits. These
numbers are only the start of the check. Existing principal building, relative
size, placement, aggregate prior buildings, expanded permit requirements,
special protections, plan provisions, notification and start-clearance rules
all remain explicit plot-specific tests.

## Commands

```sh
npm run site:sweden:validate
npm run site:sweden:validate:test
npm run site:sweden:gate
npm run site:sweden:sources:probe
```

The probe is read-only and checks only public URLs marked as probeable in the
registry. It does not search for a plot, submit a request or create an external
case. Add `-- --write` only when a runtime availability receipt is wanted; it
is written beneath ignored `.runtime/sites/sweden/`.

## Promotion rule

`plot-intelligence-template-v0.1.json` begins with every gate open. An H30/H50
house, other building or massing option is a Design Scenario pinned to an
immutable Site Twin. It may never redefine the boundary, convert planning
screening into entitlement, infer legal access from road proximity, infer
utility capacity from a line map, or replace a field investigation with a
national geology layer.
