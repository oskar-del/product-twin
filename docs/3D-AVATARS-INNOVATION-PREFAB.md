# 3D Avatars, Innovation Radar and Prefab Systems

## 1. Product Twin avatar model

A Product Twin does not have one universal 3D representation.

- Object products use object avatars.
- Surface/material products use physically scaled material avatars.
- Configurable building products use system avatars.

The maturity ladder is G0 identity-only → G1 bounding proxy → G2 design proxy → G3 render avatar → G4 specification/BIM avatar → G5 manufacturing/configuration twin.

The platform may create an AI/design proxy when authorized manufacturer geometry is unavailable, but it must never present a proxy as the exact purchasable product until identity, dimensions, likeness and rights are verified.

## 2. Innovation Radar

Emerging products should not be given a separate parallel taxonomy just because they are new or visually interesting. They map into the canonical building taxonomy and receive cross-cutting innovation tags.

Example:

`PVC marble-look sheet`
- physical category: wall finish / cladding
- innovation archetype: PVC/UV marble-look sheet
- appearance target: marble
- avatar type: material
- commercial sources: marketplace / manufacturer / distributor
- risk gates: fire, VOC, wet-area suitability, durability and truthful material disclosure

A TikTok video, social post or marketplace listing is a discovery signal only. It can create a radar lead but cannot verify performance, compliance or installation suitability.

## 3. Prefab as a Product Twin system

Prefab is a separate product line because the digital twin contains design rules.

A prefab manufacturer should provide or be enriched with:

- valid module dimensions
- structural grid and connection logic
- storey/height/span limits
- opening rules
- wall/roof/floor assemblies
- U-values / fire / acoustic performance
- MEP interfaces
- options and finishes
- BIM / IFC / configurator geometry
- packing and containerization
- factory location and lead time
- port/inland logistics
- crane/site requirements
- local regulatory evidence
- commercial configuration and RFQ route

The generative-design engine can then design *inside* a manufacturer's valid configuration space.

This creates two modes:

1. **Configure existing prefab system** — faster, lower engineering uncertainty, factory-valid.
2. **Design custom prefab system** — Product Twin creates an RFQ/manufacturing brief because the house falls outside the existing configuration envelope.

## 4. Strategic product lines

### Product Twin Core
Identity + compatibility + project + evidence + procurement graph.

### Product Twin Objects
Furniture, lighting, equipment, appliances, fixtures and other discrete products.

### Product Twin Materials
Flooring, wall systems, stone alternatives, boards, coatings, membranes, insulation and other surface/build-up materials.

### Product Twin Systems
Windows, kitchens, pools, HVAC, solar, facades and other configured systems.

### Product Twin Prefab
Whole houses, volumetric modules, cabins, bathroom/kitchen pods, LSF/SIP/CLT systems and prefabricated facade/MEP assemblies.

### Innovation Radar
A discovery view across all categories for emerging materials, systems and manufacturing methods.

## 5. Next avatar milestone

The next useful milestone is not to generate thousands of approximate meshes. It is to build a mixed first avatar set:

- 3 exact/authorized object avatars
- 3 real material avatars with physically correct scale
- 2 configurable system avatars
- 1 prefab system avatar

Then place them in one project and prove:

`real identity → correct representation → project placement → visual render → specification → live offer/RFQ`.
