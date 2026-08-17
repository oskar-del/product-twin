# Säterdalsvägen 14 - Golden Site Intelligence measurement register

Project: Säterdalsvägen 14, Svärtinge, Norrköping, Sweden
Working property locator: `SVÄRTINGE 54:28`
Assessment mode: Site Intelligence first; no architecture or buildable envelope before the evidence gates close.
Benchmark: the measurement logic and evidence discipline of *La Concha Gardens - The Study*, expanded for Swedish property, company and public-data systems.

## Evidence labels

Every value in the project must carry one of these labels:

| Label | Meaning |
|---|---|
| `OFFICIAL_VERIFIED` | Observed in an identified authority record or immutable official source receipt. |
| `DERIVED_VERIFIED` | Reproducibly calculated from pinned official source hashes. |
| `MUNICIPAL_CONFIRMED` | Confirmed for this property by the municipality, with record/date/contact channel. |
| `PROVIDER_CONFIRMED` | Confirmed for this property by the responsible utility or road provider. |
| `MARKET_REPORTED` | Listing, broker or seller statement; never allowed to close an evidence gate. |
| `REQUEST_REQUIRED` | Public or official record exists, but an order, account, fee, legal review or user-authorised contact is required. |
| `FIELD_REQUIRED` | Survey, investigation, marking or inspection must occur on site. |
| `UNRESOLVED` | No defensible conclusion yet. |

Retrieval time is never substituted for survey, imagery, plan, transaction or record-effective date.

## What the Marbella study measured

The CANOPUS benchmark established cadastral identity and area; plot extents and shape; public land class/use; terrain min/max/fall/slope/aspect; sections; historic aerial change; coastal and mountain sightlines; sun paths; a massing rule derived from a measured view angle; market asking price; development economics; and an explicit established/open due-diligence ledger.

Sweden retains every applicable measurement and adds the legal-property, cadastral-history, joint-facility, mortgage/tax, owner/company, permit, utility, groundwater, heritage and responsibility graphs below.

## 01. Listing and subject baseline

| Exact measurement | Output | Evidence route |
|---|---|---|
| Address, postal code, locality, municipality and county | Canonical address record | Listing plus official address/jurisdiction confirmation |
| Asking price and price changes | SEK and dated change series | Hemnet/Boneo/broker; `MARKET_REPORTED` |
| Listing publication date and days on market | Dates and elapsed days | Market sources |
| Reported tenure, plot area and subdivision status | Seller-fact ledger | Market sources |
| Reported paid VA, lake view and Eksjöhus relationship | Separate seller claims | Market sources; never provider facts |
| Market pin and map-image parcel label | WGS84 locator plus source image hash | Market locator only |
| Official-versus-market discrepancies | Delta register | Example: 1,939 m² listing versus approximately 1,938 m² public locator |
| Implied land price | SEK/m² of registered plot and, later, SEK/m² of buildable land | Derived only after official area/buildability is known |

## 02. Legal property identity and geometry

| Exact measurement | Output | Evidence route |
|---|---|---|
| Full fastighetsbeteckning | Exact identifier and municipality | Lantmäteriet property record; current working locator is `SVÄRTINGE 54:28` |
| Registered land area | m² | Property-register record |
| Official digital register-map geometry | Untouched source geometry and canonical EPSG:3006 derivative | Lantmäteriet Fastighetsindelning; access/legal review required |
| Geometry source date/version | Effective/release date, not retrieval date | Product metadata |
| Polygon topology | Parts, holes, ring closure, OGC validity | Derived QA |
| Computed planar area | m² in EPSG:3006 | Derived from verified source geometry |
| Perimeter | m | Derived |
| E-W and N-S extents | m | Derived |
| Minimum rotated rectangle | length, width, orientation and compactness | Derived |
| Centroid and interior label point | EPSG:3006 and WGS84 | Derived |
| Boundary-segment bearings and lengths | Degrees and metres per segment | Derived |
| Road-frontage candidate lengths | m per adjoining road edge | Derived; not legal access proof |
| Area reconciliation | Official registered area versus computed area delta | Gate blocks on unexplained mismatch |
| Boundary certainty | Register-map status, monument evidence and uncertainty | Register map plus cadastral acts and field survey |

The digital register map is not promoted to a legally determined or design-surveyed boundary.

## 03. Cadastral history and subdivision graph

| Exact measurement | Output | Evidence route |
|---|---|---|
| Formation method | Avstyckning, fastighetsreglering or other act | Cadastral dossier (`förrättningsakt`) |
| Formation/registration date | Exact dates | Cadastral act and register |
| Parent property | Property node and relation | Cadastral act |
| Land transferred in/out | Areas and source/target properties | Cadastral act |
| Boundary-point definitions | Point IDs, descriptions, monument types and coordinates | Act map/protocol |
| Act identifiers | Aktbeteckning and linked documents | Lantmäteriet |
| Historical property designations | Chronological identity chain | Register/acts |
| Rights created, changed or cancelled by subdivision | Right nodes with dates and purposes | Act text/map |
| Conditions attached to subdivision | Access, VA, joint facilities, compensation or implementation obligations | Act decision |

## 04. Title, acquisition, tax and mortgage graph

Requires explicit permission to order/handle the property-register extract.

| Exact measurement | Output | Evidence route |
|---|---|---|
| Registered owner (`lagfaren ägare`) | Person/company node and ownership share | Lantmäteriet standard/full record |
| Title registration date | Date | Property register |
| Acquisition type and date | Purchase, gift, inheritance or other | Property register/source deed where available |
| Registered purchase price | SEK | Title record where reported |
| Ownership history | Dated owner-property edges | Full/public records as lawfully available |
| Tax assessment year and type code | Year and typkod | Property register/Skatteverket data in extract |
| Assessed land value | SEK | Tax record |
| Assessed building value | SEK, if any | Tax record |
| Mortgage deeds (`inteckningar/pantbrev`) | Count, nominal SEK, dates and priority | Property register |
| Other registration notes | Bankruptcy, seizure, restrictions or relevant notices where lawfully included | Full registration section |
| Market-to-title reconciliation | Listing seller/tenure versus registered title | Derived comparison |

The free standard extract is not treated as the complete register. Older rights and pre-1970s records can require cadastral acts or additional public records.

## 05. Servitudes, rights and joint facilities

| Exact measurement | Output | Evidence route |
|---|---|---|
| Official servitudes | Benefited/burdened property, purpose, act and geometry | Property register/acts |
| Contractual servitudes | Parties/properties, purpose, registration and document reference | Registration section/document |
| Utility rights (`ledningsrätt`) | Holder, utility type, corridor and act | Register/right product |
| Rights of use and leases | Purpose, term and affected area where lawfully available | Register/documents |
| Joint facilities (`gemensamhetsanläggning`) | GA identifier, purpose, member properties and shares | Register/act |
| Community associations (`samfällighetsförening`) | Association identity, organisation number and management relation | Samfällighetsföreningsregistret/Bolagsverket where applicable |
| Road obligation | Owner/manager, share, maintenance and snow-clearing responsibility | GA/servitude/road records |
| VA obligation | Shared/private/municipal facility relation and share | GA/VA records |
| Common land/water rights | Samfällighet, beach, water, green area or facility relation | Register/acts |
| Spatial encumbrance coverage | m² and percentage of plot affected by each verified right | Derived from verified right geometry |

## 06. Owner and company intelligence graph - conditional

Only activated if the registered owner, seller, parent-property owner, joint-facility manager or relevant development counterparty is a legal entity.

| Exact measurement | Output | Evidence route |
|---|---|---|
| Organisation number and registered name | Canonical company node | Bolagsverket/SCB |
| Legal form and registration status | AB, association or other; active/liquidation/bankruptcy status | Bolagsverket |
| Registered office and municipality | Address/jurisdiction | Bolagsverket/SCB |
| Formation date and company history | Dated events | Bolagsverket |
| Business purpose and SNI codes | Registered purpose and current industry codes | Bolagsverket/SCB |
| Board, CEO and authorised signatories | Person-role edges with effective dates | Bolagsverket |
| Share capital | SEK and change history where available | Registration certificate/history |
| Beneficial owner | Person-control edges and control form | Bolagsverket; restricted/access-controlled after 1 July 2026 |
| Annual reports | Filing dates and source documents | Bolagsverket |
| Five-year financial series | Revenue, operating result, net result, assets, equity, liabilities and cash where filed | Annual reports |
| Solvency and leverage | Equity ratio, debt/equity and trend | Derived from filed accounts |
| Group and related-company links | Parent/subsidiary/board-overlap graph | Official filings; inference labelled |
| Property transaction counterparties | Buyer/seller/company-property edges | Title records and deeds where lawfully available |
| Development capacity signal | Evidence-led assessment of financial and organisational capacity | Derived; never a legal conclusion |

Bolagsverket API access, beneficial-owner access and documents may require an account, agreement and fees. SCB company data is currently free but still requires terms acceptance and credentials.

## 07. Governing planning framework

| Exact measurement | Output | Evidence route |
|---|---|---|
| Inside/outside detailed plan | Boolean plus intersection geometry | Norrköping NOKA and complete municipal record |
| Governing plan identity | Plan number, name, producer and archival locator | Municipality |
| Legal-force date and status | Exact date/status | Municipal decision/plan record |
| Amendment chain | All amendments with scope and dates | Municipality |
| Implementation period | Start/end and present consequence | Plan description |
| Land-use designation | Exact plan use | Plan map/provisions |
| Maximum building footprint (`BYA`) | m² and/or percentage | Governing provisions |
| Maximum gross floor area (`BTA`) | m² and calculation rule | Governing provisions |
| Number of buildings/dwellings | Count and applicable conditions | Governing provisions |
| Storeys, building height and ridge height | m/count and measurement method | Governing provisions/current law |
| Roof form and pitch | Permitted type/degrees | Provisions |
| Minimum plot size | m² | Provisions |
| Placement/setbacks | m from boundary, street, utilities, nature or other control lines | Provisions |
| Cross-marked/no-build land | Geometry, m² and percentage of plot | Plan geometry |
| Access/exit restrictions | Location and rule | Plan/NVDB/municipal decision |
| Parking requirements | Spaces/dwelling or applicable formula | Municipal policy/plan |
| Ground/vegetation protection | Tree, grading, blasting or ground-level rules | Plan |
| Stormwater/flood provisions | Required treatment, retention or levels | Plan/municipal VA |
| Noise provisions | Facade, outdoor-area or placement conditions | Plan/noise study |
| Cultural/environmental provisions | Triggered studies or protected features | Plan |
| Comprehensive-plan designation | Strategic direction and conflicts | Current ÖP/FÖP; not entitlement |
| Area regulations | Applicable `områdesbestämmelser` | Municipality |
| Current H30/H50 rule profile | National limits and case conditions | Boverket/PBL, rechecked on assessment date |
| Plot-specific H30/H50 eligibility | Yes/no/unresolved with every condition tested | Only after plan, principal-building and protection facts close |

The 2025 Svärtinge Udde shoreline amendment is retained as context but is not applied to this property unless the municipal overlay proves intersection.

## 08. Municipal permit and case history

Requires permission if a municipal archive request or direct contact is needed.

| Exact measurement | Output | Evidence route |
|---|---|---|
| Prior building permits | Case ID, scope, decision and date | Municipal archive |
| Prior demolition/ground/site permits | Case ID, decision and conditions | Municipal archive |
| Advance planning decisions (`förhandsbesked`) | Outcome, validity and conditions | Municipality |
| Technical notifications | Scope/status | Municipality |
| Start and final clearance | Dates/status | Municipality |
| Enforcement/open cases | Status and subject where publicly available | Municipality |
| Neighbouring permit pattern | Dated sample of nearby permissions/refusals | Municipal archive; context only |
| Municipal written interpretation | Property-specific answer on governing plan, access, VA, shoreline and H30/H50 | Dated response |

## 09. Plot dimensions and geometric character

Calculated only from verified source geometry.

| Exact measurement | Output |
|---|---|
| Area, perimeter and extents | m²/m |
| Long and short axes | m and bearing |
| Aspect ratio and compactness | Dimensionless metrics |
| Boundary complexity | Vertex count, concavity and narrow-point widths |
| Buildable-width transects | Clear width at fixed intervals after verified exclusions |
| Road frontage | m by road/edge |
| Cardinal exposure | Percentage of perimeter facing N/E/S/W sectors |
| Neighbour contact | Shared-boundary length per property |
| Distance to key edges | Road, water, protected areas, utilities and nearest buildings |

## 10. Terrain, contours and sections

| Exact measurement | Output | Evidence route |
|---|---|---|
| Source terrain item | Product, tile, acquisition/edition dates, 1 m pixel size, EPSG:3006 + RH2000 | Lantmäteriet Markhöjdmodell |
| Raw raster integrity | Byte count, media signature and SHA-256 | Source receipt |
| Coverage/nodata | Percentage coverage of parcel and 20/50/100 m buffers | Derived QA |
| Plot elevation statistics | Min, max, mean, median, P10/P90 and total fall in RH2000 m | Derived |
| High and low points | Coordinates and levels | Derived |
| Slope | Mean, median, P90, maximum and area in slope bands | Derived |
| Aspect | Circular mean and area by direction band | Derived |
| Contours | 0.5 m and 1 m analytical contours, labelled as derived from 1 m DTM | Derived |
| Principal fall line | Bearing, length and elevation loss | Derived |
| Cross/long sections | At least two cardinal and access-to-building transects | Derived |
| Local relief/roughness | Terrain roughness and break lines | Derived |
| Preliminary cut/fill sensitivity | Volumes for test datum levels, explicitly pre-survey | Derived scenario screen |
| Drainage surface | Flow direction, accumulation, depressions and outfall candidates | Derived screening |
| 3D terrain model | Georeferenced mesh/GLB with local origin, metres and RH2000 | Derived |

The terrain product closes context terrain only. Finished-floor levels, detailed drainage and construction earthworks require a field survey.

## 11. Imagery, land cover and change over time

| Exact measurement | Output | Evidence route |
|---|---|---|
| Current orthophoto | Acquisition date, resolution, coverage and hash | Lantmäteriet orthophoto |
| Historical image sequence | Every available verified vintage | Lantmäteriet/municipal archives |
| Land-cover fractions | Bare ground, grass, trees, hardscape, water and buildings | Derived classification with manual QA |
| Tree/canopy coverage | m², percentage and approximate canopy height where surface data allows | Derived screening |
| Existing structures | Footprint, visible use and change date candidates | Imagery/building data; lawful status checked separately |
| Ground disturbance | Clearing, filling, excavation or construction changes by date | Then/now comparison |
| Neighbourhood development | New buildings, roads and vegetation change | Then/now context |

## 12. Existing buildings and neighbouring form

| Exact measurement | Output |
|---|---|
| Building footprints within 50/100/250 m | Count and m² |
| Distance to each relevant building | m |
| Estimated heights/storeys | m/count with method and uncertainty |
| Window/overlook candidates | Direction and distance; visual screen only |
| Shadow contributors | Height/azimuth/distance inputs |
| Existing-use/lawful-status distinction | Map presence versus permit record |
| Neighbour typology | Detached, semi-detached, row or other context |
| Density context | Building coverage and dwelling density within defined buffers |

## 13. Ground, bedrock and groundwater

| Exact measurement | Output | Evidence route |
|---|---|---|
| Surficial soil class | SGU class and map scale | SGU |
| Modelled soil depth | m at pin and across verified plot polygon | SGU model |
| Nearest soil-depth observations | Distance, depth, method/source and end condition | SGU |
| Local depth variability | Min/max/median by distance band | Derived |
| Bedrock type and structures | Geological unit and mapped faults/fractures where available | SGU |
| Well inventory | Count and type within 100/250/500/1,000 m | SGU well archive |
| Well construction | Total depth, soil depth, casing and use | SGU |
| Reported groundwater levels | Level, measurement date and positional accuracy | SGU; historic screening only |
| Reported capacities | l/h and date where present | SGU |
| Groundwater body/status | Identity, chemical/quantitative status and protection | VISS/SGU |
| Radon screening | Ground/municipal risk class | Authority sources |
| Landslide/erosion/subsidence | Intersection/distance and coverage gaps | SGI/municipality |
| Frost and soil-water sensitivity | Climatic/geological screen | Derived guidance; field confirmation required |
| Geotechnical investigation requirement | Boreholes/CPT/test pits/lab/groundwater monitoring scope | Specialist/field |
| Infiltration suitability | Permeability, groundwater clearance and treatment feasibility | Field tests plus authority requirements |

Known discovery signal: SGU maps glaciofluvial sediment and a modelled 9 m soil depth at the market pin, while nearby observations vary from approximately 0-22 m. This is a foundation-cost uncertainty, not a design parameter.

## 14. Water, flood and stormwater

| Exact measurement | Output |
|---|---|
| Distance to Lake Glan and other water | Horizontal distance, bearing and level difference |
| Catchment membership | Catchment/subcatchment identifiers |
| Surface runoff path | Direction, accumulation and receiving point |
| Local low points/depressions | Coordinates, depth and affected area |
| National mapped flood exposure | Scenario, depth/extent and source coverage |
| Municipal cloudburst exposure | Depth/flow/ponding where available |
| Shoreline protection (`strandskydd`) | Exact intersection and decision status; no distance-only assumption |
| Glan water-protection zone | Primary/secondary/tertiary/none, proven by official overlay |
| Zone-specific restrictions | Excavation, fuel, infiltration, geothermal and other relevant rules |
| Stormwater service status | Municipal/private responsibility and permitted discharge route |
| Preliminary retention requirement | m³ for defined design storms after municipal criteria are known |
| Finished-floor flood margin | m above verified design level; field/municipal basis required |

## 15. Nature, species and environmental constraints

| Exact measurement | Output |
|---|---|
| Protected-area intersection | Name/type/area and m² overlap |
| Natura 2000 intersection and distance | Site code, habitat reasons and measured distance |
| Nature reserve/biotope/key habitat | Intersection/distance and legal basis |
| Protected trees/avenues/stone walls/ditches | Feature, legal protection and affected length/area |
| Species records | Public records by species/date/distance, with sensitive-location rules respected |
| Ecology survey triggers | Season, species group and authority basis |
| Contaminated sites (`EBH`) | Object, risk class, activity and distance |
| Historic potentially contaminating use | Aerial/map/archive chronology |
| Soil sampling requirement | Analyte plan and locations if screening triggers |
| Air/odour context | Identified sources and available mapped data |

An empty or malfunctioning map service is recorded as `UNRESOLVED`, never as evidence of absence.

## 16. Cultural heritage and archaeology

| Exact measurement | Output |
|---|---|
| RAÄ registered remains | Record number, type, legal assessment, geometry and uncertainty zone |
| Intersection/distance | m from verified parcel boundary, not just the market pin |
| Investigation history | Linked archaeological assignments/reports |
| County requirements | Consultation/investigation trigger and response |
| Unknown-remains residual risk | Explicit limitation after register screening |

Known discovery signal: two published capture-pit records lie approximately 472 m from the market pin. This does not establish parcel impact or absence.

## 17. Legal and physical access

| Exact measurement | Output |
|---|---|
| Adjoining road identity | Road/street ID and name |
| Road owner/manager | Municipality, state, association or private owner |
| Legal access basis | Direct ownership, servitude or joint facility |
| Frontage length | m |
| Existing/proposed driveway status | Decision/permit and position |
| Functional road class and speed limit | NVDB attributes |
| Traffic volume | AADT/heavy share/year where available |
| Access gradient | Percentage from road to candidate arrival area |
| Sight distance | m in both directions using verified geometry/terrain |
| Turning geometry | Passenger, service, waste and fire-vehicle swept paths |
| Emergency access | Width, height, bearing capacity, turning and hose-distance criteria |
| Construction access | Vehicle size, gradients, staging and delivery constraints |
| Maintenance/snow clearing | Responsible entity and obligations |

A road touching the parcel does not prove legal or permitted access.

## 18. Utilities and connection graph

Provider requests and Ledningskollen cases require explicit permission.

| Exact measurement | Output |
|---|---|
| Municipal VA service-area status | Inside/outside and effective decision |
| Water connection point | Coordinate, dimension, pressure/capacity and elevation |
| Wastewater connection point | Coordinate, dimension, invert/elevation and capacity |
| Stormwater connection/responsibility | Coordinate/route/requirements or on-site obligation |
| VA fees | Paid amount, remaining amount, tariff date and scope |
| Seller "VA paid" reconciliation | Provider-confirmed yes/no and what was actually paid |
| Electricity network owner | Provider identity |
| Grid connection point/capacity | kW/A, phase, lead time and quote |
| Electricity tariff and connection cost | SEK and effective date |
| Nearby substations/lines | Distance and voltage where public |
| Underground utility corridors | Type, owner and surveyed/response geometry |
| Ledningskollen response completeness | All providers responded, date and validity |
| Fibre provider and serviceability | Provider, speed, cost and lead time |
| Mobile coverage | Operator/technology/signal model as context |
| Waste collection | Pickup point, vehicle requirements and responsible provider |
| Geothermal feasibility | Well spacing, water-protection and permit constraints |

Line-location data does not prove spare capacity. Capacity must come from each provider.

## 19. Sun, climate, views, privacy and noise

| Exact measurement | Output |
|---|---|
| Latitude and true north | Degrees/source CRS |
| Solar altitude/azimuth | Hourly paths for solstices/equinoxes and selected dates |
| Sunrise/sunset | Time and azimuth by season |
| Existing-ground solar exposure | Annual/monthly sun hours before design |
| Terrain/building/tree horizon | Azimuth-elevation profile |
| Lake Glan line of sight | Visible/not visible from ground and test eye heights with obstruction model |
| View bearings and distances | Lake, landscape and other meaningful targets |
| Neighbour overlook | Bearings, distances and approximate vertical angles |
| Shadow from neighbours/terrain | Seasonal hours and affected plot areas |
| PV resource | kWh/m²/year and optimal orientation/tilt screening |
| Temperature normals/extremes | °C and reference period |
| Heating degree days | Degree days/year |
| Design rainfall/snow/frost context | Authority values and return periods where applicable |
| Wind | Prevailing directions, speeds and exposure |
| Road-traffic noise | Lden/Lnight/Lmax at plot and candidate facade/outdoor zones |
| Other noise sources | Rail, industry, sports or aircraft where applicable |
| Air quality | Available modelled pollutants and source year |

Sightline and solar models will distinguish bare terrain, current obstructions and hypothetical building heights.

## 20. Location, service and market context

Kept in the Project layer, not allowed to change Site Twin geometry or legal facts.

| Exact measurement | Output |
|---|---|
| Travel distance/time | Norrköping centre, transport, schools, shops, healthcare and recreation |
| Transit access | Stop distance, routes and service frequency |
| Population/household context | Defined statistical-area metrics and reference year |
| Nearby planning pipeline | Approved/proposed residential projects and dwelling counts |
| Comparable plot listings | Price, area, SEK/m², date and status |
| Verified sales/title prices | SEK, date, property and normalisation basis where lawfully available |
| Price trend | Area/property-type series with sample size |
| Build-cost assumptions | SEK/m² ranges, date and source; explicitly assumptions until quoted |
| Connection/sitework allowances | Separate VA, power, access, survey and ground-risk allowances |
| Residual land-value sensitivity | Planning capacity x sale value less costs, only after planning basis is known |

## 21. Buildability synthesis - generated last

No authoritative envelope is drawn until boundary, plan, rights and environmental gates close.

| Exact measurement | Output |
|---|---|
| Gross legal plot area | m² |
| Verified exclusion areas | m² by plan, right, road, water, nature and heritage constraint |
| Net buildable-envelope area | m² and percentage |
| Maximum permitted BYA/BTA | m², formula and evidence source |
| H30/H50 eligibility | Condition-by-condition result, not a footprint label |
| Candidate house fit | Footprint, boundary distances, height and access only after eligibility |
| Terrain fit | Cut/fill, retaining, gradients and FFL sensitivity |
| Solar/daylight fit | Sun hours and shadow implications |
| View/privacy fit | Sightline and overlook implications |
| Utility fit | Demand versus provider-confirmed capacity |
| Ground-cost risk | Low/base/high sitework range with evidence basis |
| Decision result | Proceed / price-adjust / investigate / stop, with open gates |

## Swedish Site Intelligence graph

The graph will store each node and edge with source ID, source record, effective date, retrieval time, SHA-256 and evidence label.

### Core nodes

- Property
- Boundary version
- Boundary point/monument
- Cadastral act
- Registered owner
- Company/association/person, subject to lawful handling
- Title/acquisition
- Mortgage
- Tax assessment
- Servitude/right/lease
- Joint facility
- Community association
- Detailed plan and amendment
- Permit/case
- Road/access decision
- VA/electricity/fibre provider and response
- Terrain/imagery/geology/flood/environment/heritage source artifact
- Market listing and comparable transaction
- Field survey/investigation
- Design scenario, always pinned to an immutable Site Twin version

### Required edges

- `PROPERTY FORMED_BY CADASTRAL_ACT`
- `PROPERTY DERIVED_FROM PARENT_PROPERTY`
- `OWNER HOLDS_TITLE_TO PROPERTY`
- `TITLE ACQUIRED_BY TRANSACTION`
- `PROPERTY BURDENED_BY RIGHT`
- `PROPERTY BENEFITS_FROM RIGHT`
- `PROPERTY MEMBER_OF JOINT_FACILITY`
- `JOINT_FACILITY MANAGED_BY ASSOCIATION`
- `PROPERTY INTERSECTS PLAN/PROTECTION/RISK_LAYER`
- `PROPERTY SERVED_BY PROVIDER`
- `PROPERTY ACCESSED_VIA ROAD/RIGHT`
- `COMPANY CONTROLLED_OR_REPRESENTED_BY PERSON`, where lawfully available
- `FINDING DERIVED_FROM SOURCE_ARTIFACT`
- `DESIGN_SCENARIO PINNED_TO SITE_TWIN_HASH`

## Planned Site Intelligence visual plates

1. The plot in its setting
2. Official/property-register boundary and source status
3. Fixed dimensions, bearings and road frontage
4. Terrain, contours and orientation
5. Long and cross sections
6. Drainage, depressions and water context
7. Current orthophoto
8. Land through time
9. Soil, bedrock and nearest observations
10. Groundwater/wells and uncertainty
11. Governing plan and provision map
12. Rights, servitudes and joint-facility map
13. Water, shoreline and environmental constraints
14. Heritage and contamination screen
15. Legal/physical access
16. Utility and provider graph
17. Sun, shadow and climate
18. Lake-view and privacy sightlines
19. Noise and traffic context
20. Ownership/company graph, only if applicable and lawfully sourced
21. Evidence ledger: established versus open
22. Buildable envelope and first capacity tests, only after upstream gates close

## Execution gates

### Automatic/open-source phase

- Listing baseline and discrepancies
- Public locator resolution
- Terrain catalogue and, when authorised access works, 1 m terrain processing
- SGU soil, depth observations, wells and groundwater context
- RAÄ heritage screen
- Public environmental, flood, road, climate and municipal planning discovery
- Derived dimensions, sections, slopes, drainage, solar and sightlines after geometry is verified

### Explicit user permission required

- Order Lantmäteriet standard/full property-register information
- Obtain cadastral acts beyond freely exposed records
- Apply for Lantmäteriet vector/orthophoto download access where required
- Open Bolagsverket/SCB account or paid company-document/API access
- Search beneficial-owner data under current access rules
- Contact Norrköping for property-specific planning, permits, VA and water-protection confirmation
- Create a Ledningskollen case
- Ask road or utility providers for capacity, cost and lead-time responses

### Field/commissioned evidence required

- Legal/design boundary and topographic survey
- Boundary-monument recovery where needed
- Geotechnical investigation and laboratory parameters
- Groundwater monitoring
- Radon, contamination and infiltration tests
- Tree/ecology survey if triggered
- Utility marking
- Access/sight-distance survey

## Current first-read signals

- Working identity: `SVÄRTINGE 54:28`; official property identity remains open.
- Listing area: 1,939 m²; a public locator reports approximately 1,938 m².
- Listing claims municipal VA is paid; provider confirmation is absent.
- SGU: glaciofluvial sediment and modelled 9 m soil depth at the market pin.
- Nearby soil-depth observations show strong local variation, approximately 0-22 m.
- Two RAÄ published capture-pit records occur approximately 472 m from the market pin; parcel impact is unresolved.
- The correct Lantmäteriet 1 m terrain item is identified, but the raster requires working download access before terrain metrics can be derived.
- Governing detailed-plan/outside-plan status is unresolved. The Svärtinge Udde shoreline amendment must not be applied without a proven intersection.
- Glan water-protection zone, Natura/protected-area intersection, legal access, rights and utility capacity remain open.

## Definition of a Golden Swedish Site Intelligence release

The release is complete only when:

1. Each published number has a source and evidence label.
2. Official raw files and requested records are immutable and hashed.
3. Seller statements remain visually and structurally separate.
4. Geometry is versioned in source CRS, EPSG:3006 and WGS84.
5. Derived outputs can be recreated from pinned source hashes and parameters.
6. Missing service results never become false absence claims.
7. Project, Site Twin and Design Scenario remain separate.
8. The final established/open ledger states exactly which unknowns can change price, feasibility or design.
