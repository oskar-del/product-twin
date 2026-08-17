# Säterdalsvägen 14 — Sweden plot-intelligence discovery

Assessment date: 2026-08-17. Working locator: `SVÄRTINGE 54:28`, Norrköping, using the listing pin `[16.0317063331, 58.6522414431]`. NOKA now confirms the municipal address-to-property locator; this is still not a property-register extract or surveyed-boundary record.

## Entity separation

- `project-v0.1.json` retains price, area, seller statements, the market pin and working designation as `REPORTED_UNVERIFIED`.
- `plot-intelligence-v0.1.json` contains only source-bound Site Twin discovery evidence, limitations and stage gates.
- `design-scenario-v0.1.json` is deliberately blocked with all geometry, envelope, access and finished-floor fields null.
- `intake-v0.1.json` records the locator and keeps all permissions for external requests, contacts, cases and field orders false.

The Project and Design Scenario pin the exact Site Twin file hash. Seller claims cannot close Site Twin gates.

## Material discovery findings

- The seller reports 1,939 m², freehold, a recent subdivision, a Glan view, intended Eksjöhus cooperation and paid municipal VA. None is provider-, municipality- or property-register verified. NOKA's indicative map surface is 1,938.198844 m², leaving a 0.801156 m² difference open pending the registered legal area.
- Norrköping's public NOKA point query confirms that `Säterdalsvägen 14 (Adress)` maps to `SVÄRTINGE 54:28`, returns an indicative map-surface area of 1,938.198844 m² and identifies one legally effective `Avstyckningsplan`, `0581K-22D:1008`, in force since 1936-05-26. The municipal map warns that its displayed property boundaries have no legal effect, so registered area remains open.
- Both linked municipal plan files are now captured and reviewed. The historic approval record repeatedly signals one dwelling house per plot, an original average lot pattern of about 3,000 m², a maximum road gradient of 1:12, a 40 m high-voltage corridor, open roadside drainage and water provision before sale or construction. These are material historic signals, not yet present property-specific entitlements or prohibitions: today's `54:28` boundary is not labelled on the 1936 map and the amendment/current-interpretation chain is still unresolved.
- SGU maps the listing pin as `Isälvssediment` and gives a modelled 9 m depth to bedrock. Nearby official inputs range from about 0–22 m, including 10 m at 58.9 m, 1.5 m at 78.1 m, 16 m at 83.7 m and 22 m at 106.6 m. This is a strong variability signal, not a plot geotechnical result.
- The SGU well archive returned 140 context records. Nearest records are mostly energy wells, with stated position accuracy under 100 m, so historic depths and water levels are screening only.
- RAÄ returned two published capture-pit records about 472 m from the market pin: one possible ancient monument and one ancient monument. Full protection/uncertainty geometry and unknown remains still require case review.
- Lantmäteriet STAC identifies current 1 m item `650_55` in SWEREF 99 TM + RH2000 (`EPSG:5845`), but the advertised raster asset returned HTTP 401 without credentials. No terrain values, contours, drainage, plot clip or mesh were created.
- The 2025 Svärtinge Udde amendment concerns lifting shoreline protection on its mapped plan land and expressly does not change building rights or land use. The map appears to cover the lakeside udde south of town, but its non-application to this plot is not formally closed without NOKA/municipal overlay evidence.
- The national protected-area WFS services returned zero records with `numberMatched="unknown"` while municipal evidence confirms Natura 2000 site `SE0230206` in the wider Svärtinge Udde locality. The zero responses are therefore treated as inconclusive, never as proof of absence.
- The Glan water-protection decision has primary, secondary and tertiary zones. The plot's exact zone is unresolved.

## Current gate state

`GATE_SE_MUNICIPAL_JURISDICTION` and `GATE_SE_CURRENT_LAW_PROFILE` are satisfied. The other 16 gates remain open, including registered identity/area, legal boundary, complete governing-plan basis, H30/H50 eligibility, buildable envelope, terrain, ground, flood/geohazards, environment, heritage/contamination, legal access, utility capacity and construction clearance.

The current H30/H50 national profile is retained for comparison only. It is not a permission or a design brief for this plot.

## Validation

```bash
npm run site:sweden:saterdalsvagen14:gate
```

The strict source profile verifies every captured runtime file against the receipt SHA-256. The mutation suite rejects seller-to-authority promotion, invented scenario geometry, stale Site Twin hashes, premature gate closure, erased geology variability and protected-area zero-result misinterpretation.

## Next promotion evidence

1. Authoritative property identity/registered area and the relevant cadastral acts, rights and joint facilities.
2. Reconcile NOKA record `0581K-22D:1008` to the present `SVÄRTINGE 54:28` parcel, including the historic lot/notation, amendment chain and a current property-specific municipal interpretation.
3. Provider confirmation for VA connection point, capacity, paid status, remaining charges and stormwater treatment.
4. Property rights and road-manager/driveway approval for legal access.
5. Plot-specific survey, geotechnical/groundwater/radon/infiltration work and environmental/heritage completion.

Steps 1–5 include external requests, contacts or commissioned work and therefore require explicit user permission.
