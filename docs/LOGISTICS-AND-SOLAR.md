# Logistics + Solar architecture

## 1. Shopify is not the logistics company
For Shopify-origin products, Shopify can expose shipping eligibility and merchant-origin signals in Global Catalog, and Shopify merchants can use Shopify shipping/local-delivery/fulfillment tooling. The physical shipment is still performed by the merchant, carrier, 3PL, local-delivery provider or specialist supplier.

Product Twin should therefore own the procurement/logistics orchestration layer above all commerce sources.

## 2. Product identity is separate from delivery
A Product Twin can have multiple offers. Each offer can have multiple logistics routes.

Example:

PT_TILE_001
- Offer A: Valencia distributor, €42/m², pallet delivery to Alicante in 2 days
- Offer B: Italian factory, €31/m², 14-day LTL freight
- Offer C: Marbella stockist, €49/m², same-day local pickup

The design AI can select the same physical product while procurement selects the best local route for the project.

## 3. Whole-house procurement is not one shopping cart
The project BOM is grouped into phase-aware purchase orders / delivery packages:

siteworks → foundations → structure → envelope → MEP rough-in → finishes → fixtures → FF&E → landscape

Each line has a `required_on_site_date`. The procurement engine groups compatible lines by supplier/origin and compares landed cost + lead time + project-site constraints.

Concrete is a good example: it is normally local, time-sensitive and delivery-radius constrained. A sofa can travel cross-border. A pool pump can come from a national distributor. These must not share one logistics model.

## 4. Local-first sourcing
For every project destination, rank offers by:
1. technical suitability
2. whether the supplier serves the exact site/postcode
3. availability
4. required-on-site date
5. landed cost, not product price alone
6. lead time
7. supplier reliability
8. distance / carbon signal
9. commercial terms

Shopify Global Catalog already supports `ships_to` and `ships_from` filters; other source adapters should normalize their location/delivery data into the same Product Twin logistics schema.

## 5. Solar is part of the design engine
Solar should not be only another product category. It has two layers:

### Solar design model
Inputs from the property / Spatial Twin / site model:
- latitude / longitude
- roof surfaces
- roof orientation / azimuth
- roof slope
- usable roof area
- obstructions
- shadowing / horizon
- local solar radiation
- estimated building load
- battery / EV requirements

Outputs:
- viable roof zones
- recommended PV capacity (kWp)
- expected monthly/yearly generation
- panel count
- inverter sizing
- battery options
- self-consumption estimate
- roof layout and spacing
- BOM

### Solar Product Twins
Canonical categories:
- ENERGY.SOLAR.PANEL
- ENERGY.SOLAR.MOUNTING
- ENERGY.SOLAR.INVERTER
- ENERGY.SOLAR.OPTIMIZER
- ENERGY.SOLAR.BOS
- ENERGY.BATTERY
- ENERGY.EV_CHARGER
- ENERGY.ENERGY_MANAGER

The design calculation chooses required performance first; Product Twin then resolves real panels/inverters/batteries that satisfy it and are available in the project region.

## 6. European solar data source
PVGIS (European Commission JRC) is a strong first analysis adapter for Spain/Europe. It exposes APIs for solar-radiation and photovoltaic-performance calculations, including location, slope, azimuth and horizon effects. Product Twin should store the calculation assumptions separately from the selected hardware Twin.

## 7. Future project graph

PROJECT SITE
→ geometry / sun / climate / demand
→ DESIGN REQUIREMENTS
→ canonical Product Twin categories
→ candidate products
→ regional offers
→ supply locations
→ logistics routes
→ landed cost + lead time
→ phase-aware purchase orders
→ delivery to site

The procurement moat is therefore not simply finding products. It is knowing which exact product can reach which exact project, at what total cost, and when.
