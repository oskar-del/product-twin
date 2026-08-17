# Photo → Product Twin Avatar Pipeline

## Principle
A photo-derived avatar is a reconstruction hypothesis until hidden geometry, scale, identity and rights are independently verified. One photograph cannot prove the unseen sides of a product.

## Evidence tiers

### P1 — Single image
Useful for silhouette, visible materials, proportions and style classification.
Not sufficient for exact 3D geometry.
Allowed output: G1/G2 proxy only, clearly marked reconstructed/hypothesized.

### P2 — Multi-view product imagery
Front / side / rear / detail / 360-spin imagery can support multi-view reconstruction.
If at least one physical dimension is authoritative, the model can be scale-constrained.
Allowed output: G2, potentially G3 after visual QA and rights review.

### P3 — Controlled capture
A deliberate photo/video orbit around the real object with strong overlap and known scale can use photogrammetry / structure-from-motion + multi-view stereo.
Allowed output: G2/G3 after cleanup; G4 only if engineering interfaces are separately verified.

### P4 — Manufacturer CAD/BIM/3D
Preferred source for exact identity and engineering geometry.
Allowed output: G3/G4/G5 depending on authority, configuration depth and rights.

## Automated pipeline
1. Resolve canonical product identity.
2. Collect authorized images / 360 spin / video / manufacturer media.
3. Segment object from background and detect transparent/reflective problem regions.
4. Estimate camera poses and image overlap when multiple views exist.
5. Reconstruct visual geometry:
   - photogrammetry / multi-view stereo for controlled multi-view imagery,
   - neural / generative reconstruction only for missing visual surfaces,
   - radiance-field / Gaussian representations may be used for visual-reference capture but are not the canonical engineering Twin.
6. Constrain scale using authoritative W/H/D and other known dimensions.
7. Fit critical interfaces separately: feet, wall mounts, pipe ports, electrical connections, clearances, anchors.
8. Clean mesh: remove floating geometry, fill only justified holes, correct normals, simplify/retopologize, create LODs.
9. Build material representation: base color, roughness, metallic, normal, AO, transparency/transmission where relevant.
10. Canonicalize orientation, origin, pivot, bounding box and units.
11. QA:
    - re-render from source-camera views,
    - compare silhouettes / landmarks,
    - compare bounding dimensions,
    - check scale and placement anchors,
    - flag unseen/generated surface percentage.
12. Rights/provenance gate.
13. Export runtime GLB/glTF and optional USDZ; retain BIM/CAD separately where authoritative.
14. Assign Product Twin avatar level G0–G5.

## Inventory factory layer

The executable factory now sits above the generation and QA steps:

1. `npm run avatar:reconstruction:score` audits each media kit across seven independent axes: identity, dimensions, view coverage, image quality, material evidence, geometry prior and rights.
2. It assigns an input band: `STRONG_P2_MULTI_VIEW_INPUT`, `USABLE_P2_INPUT_WITH_LIMITS`, `P1_VISUAL_REFERENCE_ONLY` or `INSUFFICIENT_INPUT`.
3. It selects a route: native-model enrichment, multi-image AI reconstruction, evidence request or G1 proxy.
4. `npm run avatar:reconstruction:job` resolves only preselected stable image IDs to temporary live URLs and creates a runtime Meshy job only when reconstruction and render rights are both explicitly `yes`.
5. The existing preflight, generation and post-generation QA commands then enforce the output gates.

There is deliberately no single confidence number. A compact card may say `strong input`, `usable with limits` or `presentation blocked`, but it must show the separate axis scores. High image quality cannot compensate for missing dimensions, an unbound visible variant or unresolved rights.

The first audited Shopify seating batch contains five strong P2 inputs, two usable P2 inputs with limits and one P1-only input. All eight remain outside the public generation queue while reconstruction/render rights are `review`. This demonstrates inventory capacity without converting unresolved evidence into a false public-ready claim.

Every resulting avatar is joined back to the full Product Twin readiness card. `npm run twin:readiness:evaluate` keeps identity, selected finish, geometry, dimensions, technical evidence, rights, supplier/offer, Spain/postcode delivery, logistics/landed cost, procurement route and attribution as separate lanes. The avatar never becomes a standalone product record.

## V0 executable controlled-capture route

The V0 route is deliberately narrower than the general pipeline above. It requires one owned or otherwise reconstruction-cleared product, five cleared views (`front`, `rear`, `left`, `right`, `three_quarter`), measured or manufacturer-verified width/depth/height, rights evidence and temporary HTTPS image references.

1. Copy `config/geometry/photo-avatar-job.schema.json` into a runtime-only job file under `.runtime/avatars/` and fill it with the real capture evidence. Do not place credentials in that file.
2. Set `AVATAR_JOB` to the runtime job path and run `npm run avatar:photo:preflight`.
3. Configure `MESHY_API_KEY` as an environment/repository secret, never in Git or chat.
4. Run `npm run avatar:photo:run`. Source images and the resulting GLB stay under `.runtime`; only minimal status/QA metrics are persisted.
5. Re-render the result from every captured view, validate silhouette/landmarks and physical dimensions, record observed/inferred/unresolved surface coverage, and require human acceptance before promotion.

Post-generation evidence is checked by `npm run avatar:photo:qa` with `PHOTO_AVATAR_QA` pointing to a runtime-only QA report. The enforced thresholds live in `config/geometry/photo-avatar-qa-contract.json`: all five views, per-view and mean silhouette/landmark limits, no axis more than 3% off measured scale, at least 70% observed surfaces, at most 10% unresolved surfaces, coverage totalling 100%, explicit render rights and human acceptance. Passing this gate still claims no more than G2 and no engineering-interface authority.

The checked-in capture contract is `config/geometry/photo-avatar-controlled-capture.json`. A successful reconstruction remains blocked from promotion until the separate multi-view QA evidence is complete.

## QA fields
- source_image_count
- controlled_capture: true/false
- authoritative_dimensions
- dimension_error_mm
- silhouette_error_by_view
- unseen_surface_percent
- generated_surface_percent
- scale_confidence
- likeness_confidence
- interface_confidence
- reconstruction_method
- geometry_source
- rights_state
- exact_product_claim_allowed

## Important distinction
A photo-real reconstruction can look more convincing than an engineering model while being less useful for specification. Product Twin therefore separates:

VISUAL LIKENESS
from
PHYSICAL SCALE
from
ENGINEERING INTERFACES
from
MANUFACTURER AUTHORITY.

A Gaussian/radiance-field representation can be excellent for free-viewpoint visual capture, but a clean mesh/BIM/configuration model remains preferable for placement, collisions, quantities, editing and manufacturing.
