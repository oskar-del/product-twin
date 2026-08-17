# Product Twin · Idea Parking Lot

This file preserves promising ideas that are intentionally parked while V0 focuses on the core loop:

`REAL PRODUCT/SYSTEM → CANONICAL IDENTITY → VERIFIED DIGITAL AVATAR → PROJECT PLACEMENT → TECHNICAL/REGULATORY FIT → LIVE OFFER OR RFQ → PROCUREMENT`

Nothing in this file is discarded. Ideas move back into active development only when they directly support the V0 core or after the V0 exit criteria in `docs/V0-FOCUS-LOCK.md` are met.

## Showroom / inspiration layer

- IKEA-like guided digital showrooms built from Product Twin scenes.
- Curated style worlds such as Marbella Warm Modern, Nordic Mediterranean, Andalusian Contemporary, Resort at Home, Smart Value.
- Save whole-room vibe, reject individual products, set budget, request cheaper/local/more innovative versions.
- Style / Intent Graph based on scenes viewed, objects inspected, saves, rejects, budget reactions and substitutions.
- Apply a showroom's style DNA to the user's real house.

## Garden / landscape intelligence

- Extend the canonical graph from `SITE → BUILDING → SPACE/ROOM` to outdoor rooms, planting zones and garden Product Twins.
- Intersect plot/building geometry, seasonal sun/shade, CTE/PVGIS climate context, wind/salt exposure, soil, drainage and irrigation budget.
- Plant Twin fields: botanical identity, mature height/spread, form, bloom/interest calendar, sun/shade, water, soil/pH, salinity, toxicity, biodiversity value, pruning/maintenance and local sourcing.
- Design layers: arrival, privacy, shade, scent, colour, edible planting, pool safety, play/pets, habitat and year-round structure.
- Let users inspect a plant or outdoor product, preview mature size and season, swap alternatives and refresh nursery/landscape-supplier offers.
- Never produce a site-specific planting prescription from regional climate alone; plot, soil, water, microclimate and user constraints remain required inputs.

## Project Lens / house inspector

- One canonical spatial graph with Experience, Architecture, Build, Product, Procurement, Systems, Regulation, Performance and As-built lenses.
- Click a wall and dissect every layer: finish, board, service zone, insulation, structure, membrane and facade.
- Exploded Product view grouped by category, room, supplier, construction package, procurement state, system or cost band.
- Architect sees linework and geometry; homeowner sees finishes/products; contractor sees assemblies/status; procurement manager sees supply/order state.

## Construction timeline / developer orbit

- Orbitable 3D building or development with status colors projected directly onto floors, units, packages and products.
- Green = installed/accepted; blue = on site; yellow = ordered/in production/in transit; red = late/blocked; grey = not required yet; purple = review; orange = change/substitution.
- Planned versus actual time slider from design through handover.
- Spatial queries such as `show all red`, `show everything needed in next 14 days`, `show everything from supplier X`.
- B2B software-only mode where procurement remains in the developer's ERP/contractor systems but status maps back into Product Twin.

## Performance Graph

### Acoustics

- Predict airborne sound insulation from complete wall/floor/door/window assemblies and junctions.
- Predict impact/footfall transmission from slabs, floating floors, finishes, ceilings and flanking paths.
- Room acoustics: reverberation, speech clarity, absorption maps and treatment options.
- Building-services noise: pumps, fans, ducting, pipework and vibration paths.
- `predicted → engineer review → field measured → verified as-built` workflow.
- Product substitution can trigger recalculation: e.g. acoustic underlay swap → cost/build-up/acoustic impact update.

### Thermal / energy / daylight

- Heating/cooling load, energy use and comfort from exact building geometry and assemblies.
- Solar/daylight/glare simulations connected to Product Twins for glazing, shading and PV.
- Design optimization before product selection.

### View, light and window-intent engine

- Add an `optimise for views and light` mode to the plot-to-house compiler rather than treating windows as decorative holes added after the plan.
- Ask the client for human priorities: morning or evening sun, winter warmth, cool afternoon rooms, sunrise from the bed, sunset from the living room, framed mountain/sea/garden views, privacy, glare tolerance and whether a view should be seated, standing or panoramic.
- Intersect those preferences with the Site Twin: true north, seasonal solar paths, terrain/slope, eye levels, view corridors, trees and mature planting, neighbouring buildings, roads/noise, privacy, planning envelope and room programme.
- Emit explainable window intents such as `BREAKFAST_EAST_MORNING_LIGHT`, `LIVING_WEST_SUNSET_VIEW` or `BEDROOM_NORTH_COOL_DIFFUSE_LIGHT`, each bound to a room, wall, target view cone, desired time/season and performance limits.
- Optimize multiple outcomes together: view quality, daylight autonomy, direct-sun hours, glare, overheating/cooling load, winter solar gain, privacy, acoustic exposure, facade composition, structure, waterproofing, cost, local availability and delivery.
- Recommend a real Window/System Twin only after intent is known: opening type, width/height, sill/head level, frame depth, glazing, solar-control coating, U-value, acoustic rating, shading/reveal and insect/security options.
- Feed the chosen Twin into the Product-to-Building Adapter: validated bay/opening, lintel or frame implications, rough opening, fixing, sill, drainage, flashing, insulation, shading and bill-of-material changes.
- Respect the certified platform/configuration grammar. For a HouseKit, prefer validated bay sizes such as 600/1200/1800/2400 mm and reject unsupported openings instead of allowing the AI to invent structurally impossible facades.
- Interface idea: seasonal sun animation plus visible view cones; let the client compare `morning-light`, `balanced`, `sunset-view` and `low-cooling-load` schemes and ask `why is this window here?`.
- Preserve uncertainty: regional climate or a map view is not enough for final specification. Surveyed terrain, obstructions, accurate orientation, room eye levels, local code and verified Window Twin evidence remain gates.
- Commercial link: show locally available window systems that can achieve the chosen intent, with performance, adapter, price, lead-time and procurement effects visible before approval.
- Park implementation until Product Twin V0 is stable; first active proof should use the planned G4 window/system Twin and adapter generator rather than a separate visualization-only feature.

### Moisture / durability

- Condensation and moisture-risk analysis using full layer stacks and climate.
- Waterproofing/wet-area system checks.
- Durability/replacement-cycle modeling.

### Embodied carbon / sustainability

- EPD-linked embodied-carbon calculations using exact quantities and transport.
- Compare alternative products/systems by whole-project carbon impact.

## Movement and route simulation

- Accessibility and navigable clearances.
- Occupant flow / egress scenarios with appropriate professional review for life-safety decisions.
- Product delivery/installation route simulation using real 3D envelopes.
- Test whether bathroom pods, glazing, kitchens, plant, furniture or replacement equipment can travel from delivery point to final position.
- Future maintainability query: can a replacement heat pump/pump/module be removed and replaced without demolition?

## Prefab room pods

- Hotel bathroom pods, kitchen pods and utility/plant pods as configurable room-system Twins.
- Geometry, mass, centre of gravity, lifting points and clearance envelopes.
- Structural, plumbing, electrical, ventilation, fire and acoustic interfaces.
- Compare conventional hotel bathroom renovation against pod programme, room downtime and site labour.
- Route-aware phased installation.

## Prefab building / manufacturing network

- Existing prefab model adaptation.
- Design inside known manufacturer configuration rules.
- Manufacturer-neutral bespoke prefab tender: `Who can manufacture this design?`
- Factories return feasibility, required changes, structural system, factory price, freight, programme and compliance evidence.
- Design-fidelity score between architectural concept and factory proposal.
- Supplier-engineered revision comparison before approval.
- Alibaba/manufacturer network as configured manufacturing/RFQ source rather than only product marketplace.

## Spatial compiler / House.exe

The prioritized bridge from the active Room Lab to the first house-scale proof is maintained in `docs/HOUSE-EXE-BRIDGE-ROADMAP-2026-08-17.md`.

- Treat plot-first, house-first, room-first and product-first as different entry routes into one bidirectional spatial compiler.
- Preserve a flexible `house design DNA`—room relationships, courtyard/view intent, architectural language and performance goals—while adapting footprint, orientation, levels, foundation and roof to a candidate plot.
- Plot matching hard-gates planning envelope, setbacks, height, access and basic buildability, then scores slope, orientation, utilities, land-plus-build budget, views, climate and supply-chain feasibility.
- Connect the Product Twin room configurator to the building compiler: real windows, kitchens, furniture, equipment and finish systems can change bay sizes, room dimensions, service routing, adapters, quantities and procurement.
- Carry forward the four-layer HouseKit concept: `TwinBox` configures/rehearses; `HouseKit` is manufactured/procured; `Build Agent` guides/verifies; `House Brain` operates/remembers; the `Digital Atelier` makes a standardized platform feel bespoke.
- First platform hypothesis: roughly 10% printed intelligence, 50% commodity structure/envelope, 20% prefabricated services and 20% purchased finished products. Printing creates complex nodes/adapters/interfaces rather than bulk mass.
- Freeze action compiles `DESIGN → ENGINEERING → PRINT FILES → CUT LIST → PURCHASE ORDERS → CONTAINER PACK → ASSEMBLY SEQUENCE`.
- Pack containers in execution order rather than density order; bind every component to QR/NFC/RFID identity, rack/stage, tool, fastener, torque, QA and lifetime history.
- Use red/amber/green construction states: ordinary installer/owner step, AI/remote-professional review, or licensed-professional work according to jurisdiction and risk.
- Product-to-building adapters are the bridge prototype: a real Product Twin such as a window supplies size, weight, fixing, thermal, drainage and finish inputs; the compiler generates the standardized-skeleton interface.
- Window placement can later be generated from explicit view/light intent: client time-of-day and view preferences intersect the Site Twin's sun, terrain, obstruction and privacy data, then the chosen real Window Twin compiles the valid opening and adapter.
- Candidate first complete building proof remains a compact Swedish H30/Attefall-scale HouseKit because it is small enough to test TwinBox, compiler, microfactory, procurement, packed sequence, assisted assembly and lifetime Twin as one closed loop.
- Existing-house renovation is the second major route: scan irregular reality, combine standard products/modules with computationally manufactured adapters and bespoke joinery, then guide and document installation.

## Innovation Radar

- China/new-construction materials: PVC/UV marble sheets, WPC panels, SPC floors, flexible stone/MCM, lightweight faux stone, thin poured overlays, modular partitions, smart glass and future discoveries.
- Innovation remains a discovery tag; every product still maps to its canonical Product Twin category.
- Social/TikTok/video discovery can create leads but never technical or regulatory evidence.

## Avatar research extensions

- Photo/multi-view → 3D reconstruction pipeline with observed versus inferred geometry coverage.
- Gaussian-splat visual avatar alongside clean design mesh and BIM/technical avatar.
- Product re-render QA against source camera views.
- Material PBR extraction at real-world scale.
- Exact manufacturer geometry whenever authorized.

## As-built / operations

- Installed Twin stores exact model/SKU, serial/batch/lot, installer, install date, warranty, manuals and commissioning result.
- Maintenance schedule and replacement search.
- Product successor mapping when original item is obsolete.
- Whole building remains queryable after handover.

## Commercial extensions

- B2C self-purchase, coordinated procurement and managed procurement.
- B2B software-only, procurement-connected and managed-procurement models.
- Affiliate, direct trade, RFQ referral, procurement margin and manufacturer SaaS opportunities.
- Conventional browsable Product Twin catalogue connected to `add to room/house/garden`, not a separate product silo.
- Evidence-rich SEO pages for products, rooms, styles, comparisons and climate-fit garden collections.
- Shoppable room and garden stories where affiliate/RFQ value comes from real fit, scale, provenance and substitution evidence rather than thin catalogue duplication.

## Rule for new ideas

Add the idea here immediately, then ask:

> Does this improve source coverage, canonical identity, avatar quality, compatibility or the live procurement loop right now?

If not, park it until V0 core completion.
