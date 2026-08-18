# Platform access applications · BIMobject Developer API + pCon

Audit priority #4: *platform applications, not manufacturer emails.* One application to each platform replaces dozens of individual manufacturer requests. These are **drafts held for Oskar's go** — nothing here is submitted automatically.

Both are geometry/technical-content **G4 routes** (manufacturer-authoritative CAD/BIM), distinct from the photo-capture (G2) and Shopify-3D (candidate) routes.

Fill every `[insert ...]` before submitting. Where a fact below is marked *(verify at portal)*, confirm it on the live portal at submission time — portals change.

---

## A. BIMobject Developer API

### What it is / why this route
BIMobject hosts manufacturer-published BIM objects (Revit, IFC, SketchUp, 3DS, etc.) with technical metadata. Best-fit categories for Product Twin: **windows, sanitaryware, HVAC, lighting, doors, envelope systems, structure and building products** — exactly the G4 lanes the photo/Shopify routes don't reach. One developer app gives programmatic search + file access across many manufacturers at once, replacing per-manufacturer outreach.

### How access works (researched 2026-08-18)
- Register as a developer and **create an app** at `https://developer.bimobject.com/` — requires a `bimobject.com` account and an access application/approval step.
- Auth is **standard OAuth 2.0**; on approval the app receives a **client id + client secret** *(verify scopes at portal)*.
- Documented API surfaces (`github.com/bimobject/api-documentation`):
  - **Search API** — search products and **download files** ← primary need (identity + geometry retrieval).
  - **Embed API** — embed 3D preview + download into an external app.
  - **Publish API** — brand/product publishing (manufacturer side; not our consumer need).
- Reference desktop OAuth PKCE proof-of-concept: `github.com/bimobject/public-api-desktop-app-proof-of-concept`.

### Application draft

> **Portal:** developer.bimobject.com → register → create app → apply for API access.
> **Requested APIs:** Search API (product search + file download); Embed API (3D preview/embed).

Application text (adapt into the portal's form fields):

> **Applicant / legal entity:** [insert legal name]
> **Contact & role:** [insert name, role, email]
> **Product / platform:** Product Twin — an architectural product-identity and placement workflow that links verified manufacturer geometry to real for-sale properties for visualization and procurement.
> **Intended use of the API:** Programmatically resolve manufacturer product identity and retrieve authorized BIM/3D geometry for building products (windows, sanitaryware, HVAC, lighting, doors, envelope), to render exact Product Twins in client/project scenes and link each back to the manufacturer's official product/RFQ route.
> **Requested scopes:** product search; authorized model/file download; 3D embed. [confirm exact scope names at portal]
> **Data-use commitments:**
> - We display manufacturer geometry as an identified manufacturer asset; we never claim Product Twin authored or owns it.
> - We do not redistribute, resell or sublicense downloaded BIM/CAD source; converted runtime assets stay within the authorized display scope.
> - We do not use downloaded assets for AI-model training.
> - We persist source reference, product identity, file hash, scale/QA and attribution — not a mirror of the catalogue.
> - Mutable price/availability is requested live from the manufacturer's official route, never invented.
> **Territory / volume:** [insert — e.g. Spain + Nordics; expected request volume]

### Response-ingestion checklist (on approval)
Record only, into `data/rights/bimobject-developer-api-access.json` *(create on approval)*:
1. App client id (secret to secret store/env only, never Git).
2. Granted scopes + any rate/volume limits.
3. Terms-of-use / redistribution + derivative constraints (exact clauses).
4. AI-training clause.
5. Attribution requirement.
6. Territory/duration limits.
7. Per-manufacturer opt-outs, if any (some brands restrict download).
8. Renewal/expiry + monitoring owner.

**Gate:** a downloaded BIMobject asset is a G3/G4 **candidate** until its manufacturer identity, units/scale and material config are validated and the redistribution/derivative scope is recorded. Portal access ≠ per-object commercial-render right where a brand restricts it.

---

## B. pCon (EasternGraphics)

### What it is / why this route
pCon (EasternGraphics) is the contract/office/hospitality furniture configuration ecosystem. It solves the **many-finishes / many-configurations** problem that defeats a single static model: one `product` carries all its dimensions, finishes and options as authoritative manufacturer (OFML) data. Best-fit: **contract & hospitality FF&E** with deep configuration.

### How access works (researched 2026-08-18)
- **pCon.catalog** exposes standardized data (OFML **or** public) across the pCon ecosystem.
- **EAIWS** (Eastern Application Integration Web Service) is the backend that serves the article list + OFML article data; **pCon.login** authenticates users and **controls per-user access to each manufacturer's OFML data**.
- Manufacturers expose live commercial data via the **PI-API** (Product Information interface, v3.2); each manufacturer needs a **DLM** file for EAIWS to process its OFML.
- **pCon.basket integration** API embeds configured articles into an external app; **custom catalogs** handle non-OFML articles.
- Access route: an **EasternGraphics partner / pCon.login account**, plus per-manufacturer OFML-data authorization granted through pCon.login. There is no single public token that unlocks all manufacturer data — access is granted per manufacturer/partner. *(verify current partner-onboarding terms with EasternGraphics.)*

### Application draft

> **Route:** EasternGraphics partner enquiry (pCon.login business account) — request integration access to pCon.catalog / EAIWS + pCon.basket integration, and clarify per-manufacturer OFML authorization.
> **Contact:** EasternGraphics via pcon-solutions.com partner/contact channel [confirm current address at portal].

Application text:

> **Applicant / legal entity:** [insert legal name]
> **Contact & role:** [insert name, role, email]
> **What we're building:** Product Twin — links verified manufacturer product data to real for-sale properties for visualization and procurement, focused on contract/hospitality FF&E where products have many finishes and configurations.
> **What we're requesting:**
> 1. A pCon.login business account and partner access to **pCon.catalog / EAIWS** for authorized article data + geometry.
> 2. **pCon.basket integration** access to embed configured articles + their commercial data.
> 3. Guidance on obtaining **per-manufacturer OFML authorization** for the brands we work with [insert target brands].
> **Data-use commitments:** same as the BIMobject list above — identified manufacturer data only, no redistribution of source OFML, no AI-training use, live price/availability via the official route, evidence-and-attribution persistence not a catalogue mirror.
> **Territory / scale:** [insert].

### Response-ingestion checklist (on access)
Record into `data/rights/pcon-access.json` *(create on access)*:
1. pCon.login account + partner tier.
2. Which manufacturers' OFML data is authorized (list) and each brand's use scope.
3. EAIWS / PI-API / basket-integration endpoints granted.
4. Redistribution / derivative / storage constraints on OFML + geometry.
5. Attribution requirement.
6. Any licence/fee.
7. Renewal/expiry + monitoring owner.

**Gate:** pCon geometry is a G3/G4 candidate until manufacturer identity, configuration binding (the exact finish/option set), units/scale and per-brand OFML rights are recorded. Per-manufacturer authorization is the true gate, not platform membership.

---

## Why applications beat emails (audit rationale)
- BIMobject: one app → many manufacturers' building-product geometry (windows/sanitary/HVAC), the lanes the owned-product and Shopify routes can't cover.
- pCon: one partner relationship → the many-finishes contract-furniture problem solved structurally, with live commercial data.
- CADENAS 3Dfindit partnership (noted in the audit) is the same pattern for a third catalogue — worth a parallel application later.

## NOT done / honest state
- Neither application is submitted — held for Oskar's go; both need the `[insert ...]` fields and a target-brand list.
- Portal specifics marked *(verify at portal)* must be reconfirmed live at submission — API terms/scopes drift.
- Access to either platform grants **candidates**, not promotions: per-object / per-manufacturer rights are the real gate and are recorded on the response checklists above.
