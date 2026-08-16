# External commerce references

Product Twin persists stable external identifiers needed to re-resolve selected products, not mutable third-party catalog payloads.

For Shopify Global Catalog selections, project files may retain:

- canonical Product Twin/project slot linkage
- Shopify UPID/product reference
- Shopify variant reference
- timestamps and our own verification state

They do **not** persist Shopify search-result titles, descriptions, images, prices, availability, seller presentation or inferred metadata as a local catalog mirror.

Use `lookup_catalog` / `get_product` to refresh the stored reference live when a project is opened, repriced, carted or procured.
