# Newport catalog (Adtraction feed 2175 → catalog)

Source: Newport SE Adtraction product feed (pfid 2175), downloaded 2026-08-28.
Feed URL in repo/.runtime/credentials/newport-adtraction.env (tokened, gitignored).
Raw 24 MB XML kept repo-external at "product twin/newport-feed/" (NOT committed).

Built by Brain: `newport-catalog.jsonl` — 13,036 rows, one product per line.
Every row has: id, gtin/EAN, title, brand, category (Newport product_type path),
bucket, price, sale_price, currency, image, product_url, **affiliate_link**
(already fully tracked — Newport's feed wraps our channel as=2106320328; no wrapping
needed), color, material, availability, desc.

## Buckets (drive geometry tiering)
- FURNITURE 3,640 (27%) — hero floor pieces → real G2 3D first
- DECOR     6,107 (46%) — pillows/vases/textile/art → lightweight ATTACH layer
- LIGHTING  2,803 (21%) — lamps → placeable/attach
- OTHER       328 (2%)
- SEASONAL    158 (1%) — skip for 3D (Jul/Påsk/Outlet)

## Next (Avatar Factory)
1. Ingest this JSONL as shoppable twin catalog rows (all 13,036 — image+price+EAN+affiliate present).
2. Geometry: G2 proxies for FURNITURE first (dims from title/desc/category where present).
3. Attach-point/layering model: FURNITURE = base with slots; DECOR/LIGHTING snap on.
