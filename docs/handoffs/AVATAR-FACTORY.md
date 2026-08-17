# Avatar Factory — persistent Work chat handoff

## Purpose

This workstream turns rights-safe source geometry and product media into correctly classified, scaled, coloured and viewable room assets without blurring evidence lanes. It should keep improving the usable residential inventory while preserving four independent truths:

1. **Product Twin** — an identified product with its own identity evidence.
2. **Generic Design Asset** — reusable composition geometry, explicitly not a product.
3. **Commerce and logistics evidence** — offer, price, stock, route and lead-time evidence attached only to a Product Twin.
4. **Rights and attribution evidence** — licence, creator, source and display obligations attached to every reusable asset.

The next useful outcome is a visually checked living-room pack, not another dashboard expansion.

## Exact checkpoint (2026-08-17)

Independent review blocked publication twice while probing fail-closed boundaries. The first review identified gate/semantic/MCP-envelope weaknesses; the second identified value-type and compact-alias bypasses. Both sets are corrected in the worktree and awaiting re-review; publication remains blocked throughout.

| Inventory lane | Count | Geometry state | Publication state |
|---|---:|---|---|
| Product Twins in `data/twins` | 21 | 17 × G2, 4 × G0 | Existing repository state; not changed by this workstream |
| Kator/Legaz generic Design Assets selected | 12 | 12 × G1 converted from OBJ/MTL to GLB | 0 publishable; all runtime-only pending rights and visual/independent-scale QA |
| Embedded textures in the 12 GLBs | 5 | 4 bookcase textures + 1 rug texture | Runtime-only |
| Source library coverage | 90 records | 12 selected, 12 matched, 0 dependency-blocked | Archive remains runtime-only |

The 12 selected Design Assets are: mid-century sofa, mid-century armchair, armchair/ottoman, dining chair, café table, glass dining table, full bookcase, oriental rug, office chair, desk, fridge and pedestal vase lamp. Together they contain 58,010 source triangles after triangulation. All are labelled `GENERIC_DESIGN_ASSET`; none may inherit SKU, GTIN, merchant IDs, price, stock, supplier, checkout, procurement or logistics data.

## Official Kator/Legaz provenance

- Official catalogue page: <https://www.sweethome3d.com/free-3d-models/>
- Official download route: <https://sourceforge.net/projects/sweethome3d/files/SweetHome3D-models/3DModels-1.9.3/3DModels-KatorLegaz-1.9.3.zip/download>
- Download result: official SourceForge archive succeeded; **no mirror was used**.
- Licence found inside `LICENSE.TXT`: Creative Commons Attribution 3.0 United States, Andrew Kator & Jennifer Legaz.
- Runtime archive: `.runtime/source/3DModels-KatorLegaz-1.9.3.zip`
- Archive bytes: `8,945,617`
- Archive SHA-256: `9aa9c6befc3da59c20e4bb1e0d7caadef8d99773a8aedba173cb284c9db838c5`
- Embedded library: `.runtime/source/kator-legaz/KatorLegaz.sh3f`
- SH3F SHA-256: `28898a70fc831825eb4e0bc0ec06f5e1b731c05a42f32190f6b14063fd58281d`
- Heavy archives and converted GLBs stay in `.runtime` and are not committed.

## Decisions now encoded

- Sweet Home 3D `modelRotation` is captured as a finite row-major 3×3 matrix and applied before bounds/envelope work.
- `backFaceShown` controls GLB `doubleSided`; it is not forced on globally.
- `multiPartModel` is retained as source metadata.
- Every OBJ-referenced MTL and every MTL-referenced texture is a required dependency. Missing, unsafe or unsupported dependencies block conversion instead of silently degrading appearance.
- Library-declared dimensions are a **target envelope**. Non-uniform envelope normalization is recorded, but it is not called independent scale verification and cannot produce a G2 pass by itself.
- G1 means converted/viewable. G2 still requires independent scale QA plus canonical-view visual QA, material/texture checks, floor contact/orientation checks and visible attribution.
- Legacy Product Twin categories are normalized through explicit aliases; the canonical taxonomy is not expanded to preserve old drift.
- Publication requires all gates in `config/geometry/design-asset-publication-contract-v0.1.json`. Current index truth is 12 assets, 0 publishable.
- The index builder requires the exact nine-gate publication set. Missing, empty, duplicated, incomplete or extended gate lists fail closed before indexing; an empty list can never publish vacuously.
- A recursive semantic guard rejects exact commerce keys and aliases such as `unit_price_eur`, `availability_stock`, `destination_supplier_name`, camel-case equivalents, merchant keys, lead time and landed cost at any nesting depth.
- MCP Design Asset records pass strict top-level and nested runtime allowlists for licence, dimensions, transform, attribution and conversion/material records. Unknown fields fail closed even when their names do not look commercial.
- Every allowed runtime field is type-checked. Required strings/booleans/numbers/objects must have the declared type; dimensions and matrices must be finite; `style_tags`, `room_roles`, `replacement_benchmarks` and remaining gates must be arrays of strings only.
- Defense-in-depth semantic aliases include MSRP/RRP, vendor, quantity/qty, amount, cost and rate, plus compact or camel variants such as `unitpriceeur`, `unitPriceEUR`, `msrpeur` and `availabilitystock`.
- `get_design_asset` returns neutral `replacement_search_guidance`, never a procurement object. The recursive commerce guard runs over the complete search/get MCP response as well as each asset record.

## Files and evidence

Core implementation:

- `scripts/intake-sweet-home-design-assets.mjs`
- `scripts/convert-design-asset-obj-to-glb.mjs`
- `scripts/build-design-asset-index.mjs`
- `scripts/lib/design-asset-truth.mjs`
- `scripts/lib/taxonomy-aliases.mjs`
- `scripts/product-twin-mcp-server.mjs`
- `scripts/validate-design-asset-pilot.mjs`

Contracts/configuration:

- `config/geometry/design-asset.schema.json`
- `config/geometry/design-asset-publication-contract-v0.1.json`
- `config/taxonomy-aliases.json`
- `config/geometry/sweet-home-3d-design-asset-pilot-v0.1.json`

Generated lightweight evidence (no binaries):

- `data/metrics/sweet-home-3d-design-asset-intake-latest.json`
- `data/metrics/sweet-home-3d-design-asset-conversion-latest.json`
- `data/metrics/design-asset-index-latest.json`

Focused tests:

- `scripts/test-design-asset-truth.mjs`
- `scripts/test-taxonomy-aliases.mjs`
- `scripts/test-validate-design-asset-pilot.mjs`
- `scripts/test-intake-sweet-home-design-assets.mjs`
- `scripts/test-convert-design-asset-obj-to-glb.mjs`
- `scripts/test-product-twin-mcp-server.mjs`
- `scripts/test-build-design-asset-index.mjs`

The truth test includes semantic-alias, compact-alias, nested-allowlist and field-type bypass mutations. The MCP test builds a real temporary repository root whose `style_tags` contains `{msrp: 299, vendor: "Injected"}`; both complete search and get tool calls must reject it. The index test mutates the publication contract to empty, missing, incomplete, extended and duplicate gate sets; every mutation must fail closed.

## Blocked promotions

All 12 Kator/Legaz assets are blocked from G2/publication. Conversion proves that a GLB can be produced with dependencies and declared target envelope applied. It does **not** yet prove:

- that each author-declared envelope is independently correct;
- that front/back/up orientation and floor contact look right in canonical views;
- that colour, transparency, texture UVs and material roughness look faithful;
- that the attribution is actually visible on every required UI/export surface;
- that the licence/provenance review has been signed off for the intended distribution surface.

## Next three decision prompts

1. **Visual-QA batch:** approve rendering the 12 runtime GLBs from front, rear, side, top and room-perspective views, then score orientation, floor contact, colour/material and silhouette.
2. **Living-room first pack:** choose whether the first G2 push should be the six room-critical pieces (sofa, armchair, café/glass table, bookcase, rug) or all 12 at once.
3. **Product replacement bridge:** choose the first benchmark market (recommended: Spain) for matching each approved generic silhouette to independently sourced Product Twins with transparent availability and lead-time evidence.

## Do-not-do boundaries

- Do not publish or move runtime GLBs into public/site asset folders before every publication gate passes.
- Do not call declared-envelope normalization “verified scale”.
- Do not silently ignore a missing MTL, texture or unsupported image encoding.
- Do not attach Product Twin, merchant, commerce, procurement or logistics keys to generic Design Assets.
- Do not represent these generic models as exact retail products or manufacturer-authoritative geometry.
- Do not commit the 8.9 MB source archive, SH3F, extracted OBJ/MTL/textures or converted GLBs.
- Do not force fuzzy commerce joins merely because a generic Design Asset resembles a product.
- Do not expand dashboard scope until the living-room asset pack is visually usable.
