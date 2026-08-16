# Regulatory Graph

Product Twin must answer more than:
- does the product exist?
- can it be purchased?
- can it be delivered?

It must also answer:

> Is this product/system legally and technically suitable for this exact project, jurisdiction, application and installation context?

## Five connected graphs

1. Product Graph — what the thing is.
2. Commerce Graph — who sells it and at what price.
3. Spatial / Design Graph — where and how it is used.
4. Logistics Graph — where it comes from and how it reaches site.
5. Regulatory Graph — whether it may be selected, procured, installed, connected and commissioned for the proposed use.

## Jurisdiction inheritance

A project resolves a jurisdiction chain from its site location.

Example:

`EU → Spain → Andalucía → Málaga → Marbella → site-specific constraints`

Rules can apply at any level. More specific rules can narrow or add requirements without forcing external product sources to use our jurisdiction model.

## Regulatory state

Every relevant check returns one of:

- `PASS` — evidence indicates compliance for the proposed use.
- `BLOCK` — known incompatibility / prohibited use.
- `HOLD` — required documentation or evidence is missing/stale.
- `REVIEW` — professional or authority confirmation is required.
- `OPPORTUNITY` — non-mandatory incentive, efficiency improvement or preferred path.
- `NOT_APPLICABLE` — rule does not apply.

The system must never turn `unknown` into `PASS`.

## Separate product compliance from system / installation compliance

Example: a solar inverter may have appropriate product conformity evidence but the proposed installation can still require:
- compliant electrical design,
- approved system configuration,
- distributor/grid process,
- regional legalization/registration,
- commissioning documentation.

Therefore:

`PRODUCT PASS ≠ SYSTEM PASS ≠ INSTALLATION PASS`

## Evidence belongs to the Twin / offer / project

Examples:
- CE evidence,
- declaration of performance / conformity,
- ETA,
- test reports,
- fire classification,
- electrical certificates,
- water approvals,
- installer certificate,
- commissioning record,
- grid approval.

Evidence records include source, issuer, territory, declared use, validity dates and verification date.

## Procurement gate

Before a project purchase order is marked `ready`, the procurement engine combines:

`Twin + Offer + Project Application + Project Jurisdiction + Compliance Evidence + Logistics Route`

Possible outputs:

- `READY_TO_PROCURE`
- `REGULATORY_HOLD`
- `LOGISTICS_HOLD`
- `SPEC_HOLD`
- `RIGHTS_HOLD`
- `PROFESSIONAL_REVIEW`

A product being listed by Shopify or another merchant is never evidence that it is permitted for the intended building use.

## Spain / Andalucía seed

The first jurisdiction seed includes official authority references for:
- EU Construction Products Regulation,
- Spain CTE,
- Spain REBT,
- Spain RITE,
- CTE DB HE energy requirements,
- Andalucía self-consumption legalization / registration guidance.

This is a seed, not a substitute for professional legal/engineering sign-off.

## Solar as first end-to-end regulatory experiment

For a Marbella project:

`site geometry → solar potential → system requirement → real PV Product Twins → local offers → logistics → regulatory checks → installed-system review → procurement`

The Regulatory Graph should also surface `OPPORTUNITY` events such as eligible incentive programs or a higher-efficiency configuration, but incentives must have their own validity dates and official sources because they change frequently.

## Next implementation layer

Create a Project Context Resolver that derives from coordinates:
- country,
- region,
- province,
- municipality,
- postal code,
- climate / energy context,
- supply region,
- jurisdiction chain.

That one resolver feeds Product, Logistics, Solar and Regulatory engines together.
