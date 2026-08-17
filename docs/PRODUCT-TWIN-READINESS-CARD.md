# Product Twin Readiness Card

The visual avatar is one evidence lane inside the Product Twin. It never replaces procurement, logistics or supplier evidence.

The canonical relationship remains:

`Site → Building → Space/Room → Placed Object → Product Twin → Configuration/Finish → Manufacturer → Supplier/Retailer → Offer → Logistics Route → Attribution → Quote/Order`

One stable `twin_id` persists from discovery and design placement through rendering, substitution, price/availability refresh, procurement and order evidence.

## Independent lanes

Every furniture Twin now exposes eleven states:

1. Identity.
2. Exact configuration and visible finish.
3. Avatar and geometry.
4. Dimensions and spatial fit.
5. Technical evidence.
6. Rights and provenance.
7. Supplier and offer.
8. Spain and postcode delivery.
9. Logistics and landed cost.
10. Procurement route.
11. Attribution and affiliate state.

There is no global confidence score. A visually strong G2 avatar can remain commercially unusable, while an exact offer can remain unsuitable for rendering or technical placement.

## Spain distinction

These states must not be collapsed:

- `SPAIN_COUNTRY_CATALOG_CANDIDATE`: the exact product appeared through a Spain-filtered catalogue query.
- `POSTCODE_CATALOG_CANDIDATE`: the discovery filter included `29660`; checkout still has to confirm allocation, tax, freight and delivery.
- `SPANISH_SUPPLIER_PROVEN`: seller or dispatch origin is independently verified in Spain.
- `PROCUREMENT_READY`: exact configuration, current offer, stock, delivery, lead time, landed cost and a ready cart/trade/RFQ route all pass.

## Current audited furniture batch

The eight NORR11/Wendelbo Twins all have exact merchant variants, dated prices and availability observations. All eight are Spain catalogue candidates; two passed a postcode-filtered discovery query. None currently proves a Spanish supplier/dispatch origin, authoritative postcode checkout, lead time or landed cost, so none is procurement-ready.

Run `npm run twin:readiness:evaluate` whenever avatar, offer, supplier or logistics evidence changes. The detailed cards are written to `data/procurement/living-room-furniture-twin-readiness-v0.1.json`.
