# Room Lab commerce procurement checkpoint — ES-29660

## Boundary

Build, Procurement & Logistics OS is the authoritative producer of the Spain commerce and supply snapshot for the frozen eight-product Marbella living room. Room Lab continues to own scene transforms, furniture/avatar truth, and the importer. No Room Lab component code is changed.

Upstream Room Lab checkpoint: `3daea697deabe6c53bb161c9ed5f42031f4fde41`.

Canonical procurement artifact:

- `data/procurement/marbella-living-room-commerce-es-29660.v1.json`
- Schema: `config/room-commerce-procurement-manifest.schema.json`
- Room Lab read-only adapter: `data/exports/room-lab/marbella-commerce-es-29660.v1.json`

The adapter includes all 14 Product Twin catalogue identities because the current Room Lab importer requires one offer record per Product Twin. Only eight are frozen selected lines, VALNÄS is a conditional unselected substitution, and the other five are explicit out-of-scope placeholders with no destination-supply claim. Design Assets are never emitted.

## Preserved truth

- Destination: Spain market, `ES-29660`.
- Original frozen population: 8 lines and 8 units.
- Destination-deliverable: 7/8, or 87.5%.
- LISTERBY `305.139.04`: selected original and unavailable.
- Original merchandise subtotal: EUR 1,126.96.
- Deliverable merchandise subtotal: EUR 927.96.
- VALNÄS `206.280.38`: conditional, not selected, and not client-approved.
- Conditional VALNÄS scenario: EUR 1,176.96.
- Purchase-ready lines: 0.
- Local lines: 0. IKEA Málaga stock is not treated as seller or dispatch locality.
- Sweden, Great Britain, and United States receive no Spain evidence.

The 17 August 2026 observations are day-precision source evidence. The manifest retains the exact source date, represents its observation window explicitly, and expires it at `2026-08-17T23:59:59+02:00`. Every selected and alternative offer is checked by current-time validation.

## Exact blocked gates

KIVIK, POÄNG, LOHALS, GLADOM, LAUTERS, BESTÅ, and BILLY each block on:

1. `TAX`
2. `LEAD_TIME_COMPLETE`
3. `FREIGHT`
4. `LANDED_COST`
5. `CHECKOUT_OR_RFQ`
6. `PROCUREMENT_APPROVAL`
7. `PURCHASE_TIME_REFRESH`

LISTERBY blocks on the same seven gates plus:

- `STOCK_AND_DESTINATION_DELIVERY`

The seven otherwise-deliverable products retain the 4–7 day combined-cart window only as aggregate, non-itemized evidence. The cart included two accidental accessories, so freight is withheld and lead time is not complete for purchase.

## VALNÄS substitution

State: `CONDITIONAL_NOT_APPROVED`. Automatic substitution is forbidden.

Deltas from LISTERBY:

- Price: +EUR 50.00.
- Width: −220 mm.
- Depth: +120 mm.
- Height: +130 mm.
- Same-centre sofa-side clearance: −60 mm.
- Same-centre opposite-side clearance: −60 mm.
- Scenario merchandise subtotal: EUR 1,176.96.

Blocked substitution gates:

- `PLACEMENT_AND_CIRCULATION_FIT`
- `TECHNICAL_COMPATIBILITY`
- `FINISH_MATCH`
- `CLIENT_DESIGN_APPROVAL`
- `LEAD_TIME_COMPLETE`
- `LANDED_COST`
- `CHECKOUT_OR_RFQ`
- `PURCHASE_TIME_REFRESH`

## Reproduction

From the Product Twin repository:

```sh
npm run procurement:room-commerce:build
npm run procurement:room-commerce:test
npm run procurement:room-commerce:validate -- --current-at=2026-08-17T20:00:00+02:00
```

A live validation is intentionally fail-closed after the evidence expires:

```sh
npm run procurement:room-commerce:validate -- --current
```

The mutation suite covers cross-market leakage, stale evidence shown as current, missing destination, missing timestamps, unknown costs represented as zero, Product Twin identity mismatch, Design Asset commerce leakage, silent substitution, client-approval bypass, and false purchase-ready status.

## Room Lab integration

After Brain and Verification approval:

1. Verify the canonical manifest content hash and Room Lab export hash.
2. Copy the procurement-owned read-only adapter to Room Lab's `app/room/manifests/marbella-commerce-es-29660.v1.json`.
3. Do not modify `room-manifest.mjs`, Room Lab components, scene data, or furniture/avatar data.
4. Keep the scene and furniture inputs pinned to Room Lab commit `3daea697deabe6c53bb161c9ed5f42031f4fde41` and compare their declared hashes.
5. Run Room Lab's existing `npm test`. Its importer should consume the adapter without component changes.
6. Do not publish or deploy until Verification records approval.

## Inputs required by Verification

Verification, Evidence & Monitoring needs:

- The producer commit, canonical manifest content hash, and Room Lab export hash.
- The three byte-for-byte Room Lab source snapshots from commit `3daea697deabe6c53bb161c9ed5f42031f4fde41`.
- The frozen design, dated Spain offer evidence, and dated IKEA Spain session evidence declared in `source_manifests`.
- Confirmation that all eight selected identities and quantities reconcile across scene, furniture, design, offer, and session sources.
- Confirmation that the export contains commerce only for Product Twins and that out-of-scope catalogue placeholders make no supply claim.
- A current-time expiry test covering every selected offer and VALNÄS.
- Independent recalculation of the EUR 1,126.96 and EUR 1,176.96 scenarios.
- Review of the locality rule, market isolation, null unknown costs, and mutable checkout-payload exclusion.
- For any future readiness promotion: itemized lead-time evidence, clean freight, tax treatment, complete landed cost, exact checkout or RFQ evidence, procurement approval, and a purchase-time refresh.
- For VALNÄS promotion: placement/circulation review, technical and finish approval, explicit client design approval, complete lead time, landed cost, and exact checkout/RFQ evidence.

No purchase, cart creation, checkout, RFQ, supplier contact, merge, publish, or deployment is authorized by this checkpoint.

