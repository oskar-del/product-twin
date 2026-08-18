# Renovation Engine v0.4

## Core principle
The scan is the measured truth. We do not duplicate it into a separate proposed-building model.

Instead:

Spatial Twin (existing truth)
+ Renovation Plan (retain / remove / replace / add interventions)
+ Product / Material Twin placements
= Proposed state

This gives us an auditable diff, scenario comparison, undo/redo, take-off, cost delta and procurement generation.

## Unknown is a first-class state
A scan can give us a measured quantity without giving us a verified price.

Example:
- 76 m² flooring to remove: measured
- demolition €/m²: unresolved until a trusted labour/rate-card/RFQ source is attached

The system must never invent a cost just to make the budget look complete.

## Procurement gates
BOM status:
- `ready`
- `no_offer`
- `rights_hold`
- `spec_hold`

A visually usable Twin is not automatically procurement-ready.

## Capture pipeline
`capture_received → artifacts_resolved → geometry_normalized → spaces_extracted → takeoff_generated → ready_for_design`
