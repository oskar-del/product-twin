# Twin Factory v0.6 — first real geometry path

## Goal
Convert a real product into a render-ready Product Twin without confusing three independent questions:
1. Is this the correct physical product identity?
2. Do we have usable geometry?
3. Are we authorized to use that geometry in our renderer/product?

## Geometry lanes in order

### 1. Shopify merchant-hosted Model3d — preferred when merchant cooperates
Merchant authorizes access/use.
Storefront API returns `MODEL_3D` sources.
Attach GLB/USDZ to the same canonical Twin as the UCP commerce product.

### 2. Manufacturer professional model library
Example: Herman Miller publishes Revit, SketchUp and AutoCAD 3D resources for products such as the Eames Lounge Chair.
Use these as geometry candidates only after reviewing allowed use/derivatives/redistribution.
Convert/optimize to our realtime GLB if permitted.

### 3. BIM / CAD aggregator
BIMobject, CADENAS, pCon, etc. Geometry identity is mapped into our Twin; source license stays attached.

### 4. Create geometry
Only after the first three fail. Use a commissioned/AI/photogrammetry workflow with merchant/manufacturer authorization.

## Promotion gate for FF&E MVP
A Candidate can become a render-ready Product Twin when:
- stable identity exists,
- at least one live/valid commercial offer exists,
- geometry is sufficiently accurate for the visual experience,
- render usage is permitted,
- scale/dimensions are known or verified.

BIM-grade technical specification is not required for the first furniture demo.

## Later validation gate for architectural products
Building products will need stricter specification/compliance gates before they can be recommended as substitutes.
