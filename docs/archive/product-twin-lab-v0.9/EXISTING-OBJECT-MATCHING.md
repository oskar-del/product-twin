# Existing Object → Product Twin Matching v0.5

## Why this exists
A room scan should not only tell us where the walls are. It should create structured candidates for what is already in the room.

Example:

RoomPlan detects:
- sofa
- approx dimensions
- confidence
- sofa attributes
- transform/location

We create:
`EO_01928 — existing sofa candidate`

Then the Product Twin graph can do one of four things:
1. **Keep existing** — no purchase; preserve in proposed state.
2. **Replace** — search compatible Product Twins.
3. **Remove** — demolition/disposal/reuse line.
4. **Match exact product** — if product recognition is sufficiently confident or user confirms it.

## Matching priority
V0.5 ranking:
1. category
2. physical fit / dimensions
3. captured attributes
4. optional visual similarity
5. commerce constraints later

Visual similarity should not override physical incompatibility.

## Strong new workflows
### Renovation
“Keep everything worth keeping and redesign around it.”

### Office / hotel refurbishment
Scan 200 existing chairs, desks and tables; identify what can be reused, what should be replaced and what can move to other rooms.

### Circular economy
Existing objects become potential inventory rather than waste.
- retain in project
- move to another room
- resell
- donate
- refurbish
- replace

### Manufacturer analytics
If an existing product can be identified/matched, we can learn replacement cycles and substitution behavior.

## Accuracy rule
A category-level scan is not an exact SKU identification.
`chair` ≠ `Herman Miller Aeron`.

Exact product identity requires additional evidence such as:
- visual/product recognition
- barcode / QR / NFC
- manufacturer label
- user confirmation
- existing asset register

The UI must make confidence explicit.
