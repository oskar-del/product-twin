// One definition of how geometry.scale_state and geometry.shape_claim are written,
// derived from the twin's ACTUAL dimension provenance.
//
// Background (Brain rule 12, 2026-09-21): scale_state used to be a hardcoded string.
// build-newport-proxies.mjs wrote "category_default ..." even when it had just parsed
// the size out of the merchant title, and build-all-proxies.mjs wrote
// "verified ...mm envelope" / "dimension-verified proxy" for dimensions that were
// often pure category defaults -- a claim of VERIFICATION over invented numbers.
// A later reader (me) trusted scale_state as provenance and mis-stamped 53 twins.
//
// physical.dimensions_tier is the field of record. scale_state now merely restates it
// in human-readable form and must never contradict it.
export function scaleStateFor(twin, w_mm, d_mm, h_mm) {
  const tier = twin.physical?.dimensions_tier;
  const dims = `${w_mm}x${d_mm}x${h_mm}mm`;
  switch (tier) {
    case 'SOURCE': {
      // SOURCE covers two different origins; keep them distinguishable rather than
      // flattening a measured envelope into "merchant-stated".
      const measured = /verified_envelope/.test(twin.physical?.dimensions_source || '');
      return measured
        ? { scale_state: `verified_measured ${dims}`,
            shape_claim: 'category-shape proxy at a verified measured envelope; not exact manufacturer geometry' }
        : { scale_state: `source_stated ${dims}`,
            shape_claim: 'category-shape proxy at merchant-stated dimensions; not exact manufacturer geometry' };
    }
    case 'WD_SOURCE_H_DEFAULT':
      return { scale_state: `wd_source_stated + h_category_default ${dims}`,
               shape_claim: 'category-shape proxy; width/depth merchant-stated, height is a category default (INDICATIVE)' };
    case 'ALL_DEFAULT':
      return { scale_state: `category_default ${dims}`,
               shape_claim: 'category-default proxy; no dimension is merchant-stated (INDICATIVE)' };
    default:
      // No tier stamped yet: say so rather than implying either verification or default.
      return { scale_state: `unstamped_provenance ${dims}`,
               shape_claim: 'category-shape proxy; dimension provenance not stamped -- see physical.dimensions_tier' };
  }
}
