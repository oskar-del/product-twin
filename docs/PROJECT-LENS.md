# Product Twin · Project Lens

## Thesis

A project should not have separate disconnected models for architecture, products, procurement, construction and operations. It should have one canonical spatial graph and multiple lenses over that graph.

`SITE → BUILDING → SPACE → ELEMENT → ASSEMBLY → PRODUCT/SYSTEM TWIN → OFFER/ORDER → INSTALLATION → AS-BUILT ASSET`

A lens changes what is visible, how it is styled and which questions/actions are surfaced. It does not fork the building state.

## Core interaction

Clicking any spatial element resolves a canonical `element_id`. The inspector can then expose:

- geometry and architectural role;
- assembly/layer stack;
- Product Twin placements and unresolved product roles;
- technical evidence and fit;
- regulatory state and evidence;
- supplier/offer/procurement route;
- quantity, ordered quantity and remaining quantity;
- order/factory/logistics state and ETA;
- installation status;
- installed serial/batch/lot where relevant;
- manuals, warranty and maintenance after handover.

## Wall example

The user selects one external wall.

### Architecture lens

Shows linework, dimensions, openings, levels and relation to spaces.

### Build lens

Explodes the wall into:

1. interior finish;
2. board/plaster;
3. service zone;
4. insulation;
5. structure;
6. weather barrier;
7. external finish.

### Product lens

Each layer resolves to either a Product Twin, configured-system Twin, or explicit unresolved specification role.

### Procurement lens

The same layers show `not_sourced → quoted → selected → ordered → in_production → shipped → on_site → installed`.

### Regulation lens

Each layer shows `PASS / REVIEW / HOLD / BLOCK / OPPORTUNITY` and the evidence/rule causing the state.

### As-built lens

Shows what was actually installed rather than what was merely designed.

## Exploded Product view

The whole building can be temporarily exploded by:

- category;
- room/space;
- construction package;
- construction phase;
- supplier;
- procurement state;
- system;
- cost band.

The exploded transform is a visualization only. Canonical spatial transforms remain unchanged.

## Role presets

The platform should open with sensible lens presets rather than expose every control to everyone.

- Homeowner: Experience + Products + Procurement.
- Architect: Architecture + Build + Regulation + Performance.
- Interior designer: Experience + Products + Architecture.
- Contractor: Build + Procurement + Systems + Regulation.
- Procurement manager: Products + Procurement + Build.
- Facility manager: As-built + Systems + Product history.

A user may still switch to any lens they have permission to view.

## Construction timeline

A future time slider should allow the exact same spatial graph to be viewed at a project date/milestone:

`design → tender → ordered → foundations → structure → envelope → first fix → finishes → FF&E → commissioning → handover`

Objects may therefore expose both `planned_state_at(t)` and `actual_state_at(t)`.

This creates a visual answer to questions such as:

- What should already be on site?
- What has not been ordered?
- What is installed but not approved?
- Which delayed item blocks the next package?
- What changed from the original specification?

## As-built Product Twin

At installation, a Product Twin placement may be promoted into an as-built asset record containing exact model/SKU, serial or batch/lot where applicable, install date, installer, warranty, manuals, commissioning result, maintenance cycle and approved substitutions.

This allows Product Twin to survive beyond procurement into building operations and future renovation.
