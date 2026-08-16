# Product Twin — Source Expansion Plan

Research checkpoint: 2026-08-16

## Core rule

A source is not Product Twin coverage merely because an API exists. It becomes coverage only after:

1. access/credentials are obtained,
2. a live project query succeeds,
3. data is normalized into source-neutral references,
4. identity/rights/technical authority are classified correctly,
5. a whole-building test demonstrates useful coverage.

Unconnected opportunities therefore live in `config/source-opportunities/` and do **not** count toward the live source matrix.

## What we learned about Alibaba

### 1. AliExpress Open Platform is the most immediately useful Alibaba-group commerce source

Current official API reference exposes affiliate product query/detail, smart matching, image search, sale-price and commission fields, destination-country / delivery-day filtering, and tracked affiliate links.

For Product Twin this is potentially a second global discovery/commerce lane beside Shopify:

`AliExpress search → Twin Candidate → canonical identity → technical evidence → project fit → affiliate purchase route`

It is still commerce evidence, not manufacturer technical truth.

**Next test after credentials:** replay the existing Marbella 10-slot test with `ship_to_country=ES` and compare:

- categories found,
- product identities,
- merchant/supplier diversity,
- price coverage,
- delivery-day signals,
- affiliate economics,
- overlap with Shopify.

### 2. Alibaba.com Open Platform is strategically different

Alibaba.com officially promotes a Buyer Solution for sourcing/procurement, but current public documentation does not prove an anonymous Shopify-Global-Catalog-style universal buyer search endpoint.

Treat this as a future **B2B sourcing / supplier / RFQ / order** adapter, particularly for:

- custom furniture,
- windows/glazing,
- stone fabrication,
- lighting manufacture,
- bathroom/kitchen OEM,
- solar packages,
- building components,
- project-scale configured products.

Do not build a fake search client before our application is approved and the actual Buyer Solution API permissions are visible.

### 3. Alibaba Group already has MCP infrastructure

Taobao Open Platform has official MCP interfaces and a usage billing model. This demonstrates that Alibaba Group is actively exposing agentic interfaces, but Taobao MCP is not the same as Alibaba.com global B2B inventory.

Keep this parked until either:

- China-domestic sourcing matters, or
- Alibaba.com / ICBU exposes comparable global-buyer MCP access.

## P0 integrations

### AliExpress Open Platform
Role: commerce + affiliate + cross-border discovery.

Blocker: app/program access + AppKey/AppSecret/tracking ID.

### Icecat MCP / API
Role: product identity + standardized specs + media + logistics dimensions.

This is especially valuable because marketplace product copy produced **zero authoritative technical matches** in our first Shopify engineering test. Icecat can sit between commerce and manufacturer evidence:

`marketplace offer → brand/MPN/GTIN → Icecat → manufacturer evidence → Product Twin`

### BIMobject Developer API
Role: BIM/geometry + manufacturer technical content.

High priority for windows, sanitaryware, HVAC, lighting, doors, envelope systems, structure and building products.

### Verified by GS1
Role: neutral canonical identity verification.

Use GTIN/GLN verification as a high-confidence identity signal. Never create a GTIN from marketplace text.

## P1 integrations

### eBay Browse API
Role: broad marketplace discovery + image/GTIN search + affiliate + delivery context.

Useful second-market comparison source after Shopify/AliExpress.

### Amazon Creators API
Role: Amazon catalog + OffersV2 + affiliate.

Strong for appliances, tools, electrical, smart-home and FF&E, but gated by Associates eligibility/API registration.

### pCon.catalog / pCon Community
Role: configurable FF&E + 3D + commercial manufacturer data.

Particularly strong for contract/hospitality furniture where one `product` has many finishes, dimensions and configurations.

### Alibaba.com Buyer Solution
Role: B2B sourcing / supplier / RFQ / configured-product procurement.

Likely more important to Product Twin long-term than an AliExpress-style retail feed, but access and exact API surface must be validated first.

## Recommended source graph

```text
                         PRODUCT TWIN
                              |
          +-------------------+-------------------+
          |                   |                   |
       IDENTITY            TECHNICAL           COMMERCE
          |                   |                   |
        GS1              Manufacturer        Shopify MCP
       Icecat             BIMobject          AliExpress
          |                 Icecat             eBay
          |                  pCon             Amazon
          |                   |                   |
          +-------------------+-------------------+
                              |
                         PROCUREMENT
                              |
                Direct trade / RFQ / tender
                              |
              Fluidra / CEMEX / Alibaba B2B
```

No source owns the Product Twin. The Twin links evidence from each graph.

## Immediate implementation sequence

1. Obtain/test AliExpress developer + affiliate access.
2. Obtain Icecat content-user/MCP/API access.
3. Apply for BIMobject Developer Search API.
4. Ask GS1 Spain about enterprise Verified-by-GS1 API access.
5. Create eBay developer application and Browse API credentials.
6. Check Amazon Associates / Creators API eligibility for Spain.
7. Register Alibaba.com Open Platform application and request Buyer Solution permissions.
8. Explore pCon Community B2B partner/data access.

## Success criteria

The next source is useful only if it improves one of these measurable Product Twin gaps:

- canonical identity resolution,
- authoritative specifications,
- geometry/BIM availability,
- compliant project fit,
- live price/availability,
- supplier locality,
- delivery/lead-time confidence,
- procurement execution,
- affiliate/procurement economics.

Raw product count is not the KPI.
