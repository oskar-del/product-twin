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
