/**
 * Catalog row → scene element adapter.
 *
 * Turns a channel-tracked catalog row (Newport, vidaXL, or any feed sharing the
 * same shape) into a contract-valid twin-scene element carrying a commerce
 * overlay. BUY is the row's `affiliate_link`, passed through VERBATIM — the
 * tracking parameters are the revenue, so this module never rewrites, trims,
 * or re-encodes that URL.
 *
 * Pure module: no filesystem, no DOM. Callers supply the row, the resolved
 * GLB path (if any) and its derived bounds.
 */

/** Rows whose geometry is a promoted proxy render as INDICATIVE (G2). */
const PROXY_EVIDENCE = "INDICATIVE";
/** Rows with no geometry at all are CONCEPT — a placed box, honestly labelled. */
const NO_GEOMETRY_EVIDENCE = "CONCEPT";

/**
 * Parse a catalog price string ("34395 SEK") into {amount, currency}.
 * Returns nulls rather than guessing when the field is empty or unparseable.
 */
export function parsePrice(row) {
  const raw = (row.sale_price || row.price || "").trim();
  if (!raw) return { amount: null, currency: row.currency || null };
  const match = raw.match(/^([\d\s.,]+)\s*([A-Z]{3})?$/);
  if (!match) return { amount: null, currency: row.currency || null };
  const amount = Number(match[1].replace(/[\s,]/g, ""));
  return {
    amount: Number.isFinite(amount) ? amount : null,
    currency: match[2] || row.currency || null
  };
}

/**
 * The leaf category ("Möbler > Fåtöljer > Skinnfåtöljer" → "Skinnfåtöljer").
 */
export function leafCategory(row) {
  return String(row.category ?? "").split(">").pop().trim();
}

/**
 * Commerce overlay for a catalog row.
 * `buy_url` is the affiliate link verbatim; `product_url` is the plain page.
 */
export function commerceFromRow(row) {
  const { amount, currency } = parsePrice(row);
  return {
    product_name: row.title ?? null,
    brand: row.brand ?? null,
    product_url: row.product_url ?? null,
    // Verbatim: channel tracking parameters must survive untouched.
    buy_url: row.affiliate_link ?? row.product_url ?? null,
    image_url: row.image ?? null,
    price: amount,
    currency,
    category: leafCategory(row) || null,
    color: row.color || null,
    material: row.material || null,
    availability: row.availability || null,
    sku: row.id ?? null,
    gtin: row.gtin || null,
    channel: row.source ?? null
  };
}

/**
 * Build a scene element from a catalog row.
 *
 * @param {object} opts
 * @param {object} opts.row            the catalog row
 * @param {string} opts.id             scene element id
 * @param {number[]} opts.position     [x, y, z] in metres
 * @param {number} [opts.rotation_y_deg]
 * @param {string} [opts.assetPath]    GLB path, when a proxy exists
 * @param {object} [opts.bounds]       derived bounds from glb-bounds
 * @param {string} [opts.type]         element type (default FURNITURE)
 * @param {string} [opts.dimensionSource] GLB_BOUNDS | TITLE_STATED_CM | NOMINAL
 * @returns {object} scene element
 */
export function rowElement(opts) {
  const {
    row,
    id,
    position,
    rotation_y_deg = 0,
    assetPath = null,
    bounds = null,
    type = "FURNITURE",
    dimensionSource = null
  } = opts;

  const hasGeometry = Boolean(assetPath);
  const evidence = hasGeometry ? PROXY_EVIDENCE : NO_GEOMETRY_EVIDENCE;

  const dimLabel = bounds
    ? ` (${Math.round(bounds.size[0] * 1000)}×${Math.round(bounds.size[2] * 1000)}×${Math.round(bounds.size[1] * 1000)} mm)`
    : "";

  const geometry = hasGeometry
    ? {
        primitive: "GLTF_ASSET",
        asset_path: assetPath,
        position,
        rotation_y_deg
      }
    : {
        // No proxy shipped for this row — a labelled box at catalog scale.
        primitive: "BOX",
        size: bounds ? bounds.size : [0.6, 0.6, 0.6],
        position: bounds
          ? [position[0], position[1] + bounds.size[1] / 2, position[2]]
          : [position[0], position[1] + 0.3, position[2]],
        rotation_y_deg
      };

  const resolvedSourceEarly = dimensionSource
    ?? (hasGeometry && bounds ? "GLB_BOUNDS" : bounds ? "TITLE_STATED_CM" : "NOMINAL");
  const tier = opts.dimensionTier ?? DIMENSION_SOURCE_TIER[resolvedSourceEarly] ?? "ALL_DEFAULT";
  const tierNote = DIMENSION_TIER_NOTE[bounds ? tier : "NONE"];

  const limitations = hasGeometry
    ? [
        tierNote,
        // "real footprint and height" was true only while we believed the proxy
        // was measured. For an invented envelope it is exactly the overclaim the
        // tier exists to stop, so the wording now follows the tier.
        tier === "ALL_DEFAULT"
          ? "Geometry level G2: promoted universal proxy at the category's default envelope — the shape is representative and the size is not the product's."
          : "Geometry level G2: promoted universal proxy — footprint and height as stated, shape representative.",
        "Textures and finish are representative, not manufacturer artwork."
      ]
    : [
        tierNote,
        "No 3D proxy exists for this row; shown as a box at nominal scale.",
        "Dimensions are not derived from geometry and are not a fit claim."
      ];

  // Where the numbers came from decides what the panel may claim about them.
  // Measured off the shipped geometry → AUTHORITATIVE. Read out of a title
  // string → INDICATIVE. Neither → nothing is claimed at all.
  const resolvedSource = resolvedSourceEarly;
  const dimensionEvidence = bounds
    ? dimensionEvidenceFor(tier, { nativeMesh: opts.nativeMesh === true })
    : "CONCEPT";

  return {
    id,
    type,
    label: `${row.title ?? id}${dimLabel}`,
    evidence_class: evidence,
    geometry,
    source_refs: [
      `${(row.source ?? "catalog").toUpperCase()} catalog row ${row.id}`,
      ...(row.gtin ? [`GTIN ${row.gtin}`] : []),
      ...(hasGeometry ? [`G2 proxy ${assetPath}`] : [])
    ],
    limitations,
    commerce: {
      ...commerceFromRow(row),
      dimensions_mm: bounds
        ? {
            width: Math.round(bounds.size[0] * 1000),
            height: Math.round(bounds.size[1] * 1000),
            depth: Math.round(bounds.size[2] * 1000)
          }
        : null,
      dimension_source: bounds ? resolvedSource : null,
      dimension_evidence: bounds ? dimensionEvidence : null,
      dimension_tier: bounds ? tier : "NONE",
      dimension_tier_label: DIMENSION_TIER_LABEL[bounds ? tier : "NONE"],
      dimension_native_mesh: opts.nativeMesh === true
    }
  };
}

/**
 * Dimension provenance → evidence class (2026-09-15 consolidation).
 * The chip beside a dimension describes how the number was obtained, which is a
 * different question from how trustworthy the product's SHAPE is — a G2 proxy
 * carries exact size with a representative silhouette.
 */
/**
 * Dimension provenance tiers (Brain contract, 2026-09-20).
 *
 * The distinction that matters: measuring a PROXY precisely does not make the
 * number a product fact. Avatar's G2 proxies are envelopes invented from a
 * per-category table, so their bounding box is exact about a guess. Only a
 * dimension the merchant or manufacturer actually stated is SOURCE.
 *
 *   SOURCE                 stated by the merchant/manufacturer
 *   WD_SOURCE_H_DEFAULT    W x D stated, height from the category table
 *   ALL_DEFAULT            envelope invented on all three axes
 *   NONE                   no usable dimension at all
 */
export const DIMENSION_TIERS = ["SOURCE", "WD_SOURCE_H_DEFAULT", "ALL_DEFAULT", "NONE"];

/** Lower sorts first: a room must never place an ALL_DEFAULT item over a SOURCE one. */
export const TIER_RANK = { SOURCE: 0, WD_SOURCE_H_DEFAULT: 1, ALL_DEFAULT: 2, NONE: 3 };

/**
 * The chip beside a dimension.
 *
 * AUTHORITATIVE is reserved for a stated dimension on a manufacturer-native
 * mesh, and nothing else can reach it — both defaults are INDICATIVE however
 * precisely their envelope was measured.
 */
export function dimensionEvidenceFor(tier, { nativeMesh = false } = {}) {
  if (tier === "SOURCE" && nativeMesh) return "AUTHORITATIVE";
  if (tier === "SOURCE" || tier === "WD_SOURCE_H_DEFAULT" || tier === "ALL_DEFAULT") return "INDICATIVE";
  return "CONCEPT";
}

/** What the product panel says beside the figures. Never phrased as a product fact. */
export const DIMENSION_TIER_LABEL = {
  SOURCE: "size: stated by the merchant",
  WD_SOURCE_H_DEFAULT: "height: category default",
  ALL_DEFAULT: "size: category default (all three axes)",
  NONE: "size: not stated"
};

export const DIMENSION_TIER_NOTE = {
  SOURCE: "Width, depth and height as the merchant states them.",
  WD_SOURCE_H_DEFAULT: "Width and depth are the merchant's; the height comes from the per-category default table and is not a product fact.",
  ALL_DEFAULT: "All three axes come from the per-category default table. The 3D proxy is an envelope at that size, so measuring it precisely does not make it a measurement of the product.",
  NONE: "No dimension is claimed for this item."
};

/**
 * Resolve a tier from whatever the twin record carries.
 *
 * Prefers an explicit `dimensions_tier` once Avatar stamps it. Until then it
 * reads the older free-text state fields, and — this is the important part —
 * treats an unrecognised or missing state as ALL_DEFAULT rather than SOURCE.
 * Guessing upwards is how an invented envelope becomes a quoted dimension.
 */
export function resolveDimensionTier(twin, { hasSize = true } = {}) {
  if (!hasSize) return "NONE";
  // Avatar stamps the tier at physical.dimensions_tier (commit 2cbc270b);
  // the top-level spelling is accepted too so either shape resolves.
  const stamped = twin?.physical?.dimensions_tier ?? twin?.dimensions_tier;
  if (stamped && TIER_RANK[stamped] !== undefined) return stamped;

  const state = `${twin?.geometry?.scale_state ?? ""} ${twin?.physical?.evidence_state ?? ""}`.toLowerCase();
  if (!state.trim()) return "ALL_DEFAULT";
  if (/wd[_ ]source|w.?d stated|height.*(default|category)/.test(state)) return "WD_SOURCE_H_DEFAULT";
  if (/category_default|proxy_envelope|no dimensions|category default/.test(state)) return "ALL_DEFAULT";
  if (/manufacturer|merchant|stated|source|verified/.test(state)) return "SOURCE";
  return "ALL_DEFAULT";
}

/** A proxy is never a manufacturer-native mesh, whatever its filename. */
export function isNativeMesh(twin, assetPath = "") {
  const state = `${twin?.geometry?.state ?? ""} ${twin?.geometry?.shape_claim ?? ""}`.toLowerCase();
  if (/proxy|envelope|placeholder/.test(state)) return false;
  if (/proxy/i.test(assetPath)) return false;
  return /native|manufacturer|exact/.test(state);
}

// Kept for the older call sites; every one of these is a tier underneath.
export const DIMENSION_EVIDENCE = {
  GLB_BOUNDS: "INDICATIVE",
  TITLE_STATED_CM: "INDICATIVE",
  CATEGORY_DEFAULT: "INDICATIVE",
  NOMINAL: "CONCEPT"
};

export const DIMENSION_SOURCE_TIER = {
  GLB_BOUNDS: "ALL_DEFAULT",
  TITLE_STATED_CM: "SOURCE",
  CATEGORY_DEFAULT: "ALL_DEFAULT",
  NOMINAL: "NONE"
};

export const DIMENSION_SOURCE_LABEL = {
  GLB_BOUNDS: "Bounding box of the shipped G2 proxy — an envelope, not a measurement",
  TITLE_STATED_CM: "Parsed from the product title's stated centimetres",
  CATEGORY_DEFAULT: "Per-category default table",
  NOMINAL: "Nominal placeholder — not a product dimension"
};

/**
 * Dimensions parsed out of a product title ("... 200x90x74 cm").
 *
 * Feeds that ship no geometry (vidaXL) often state size in the title. When a
 * title yields all three axes the result is a REPORTED size — good enough to
 * place and scale a box, never a fit claim. Titles with two numbers describe a
 * flat span (awnings, parasol canopies) and yield no height.
 *
 * @returns {{size: number[], axes: number, source: string} | null} metres
 */
export function dimensionsFromTitle(title) {
  if (!title) return null;
  const m = String(title).match(
    /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)(?:\s*[x×]\s*(\d+(?:[.,]\d+)?))?\s*cm/i
  );
  if (!m) return null;

  const num = s => Number(String(s).replace(",", ".")) / 100;
  const a = num(m[1]);
  const b = num(m[2]);
  const c = m[3] !== undefined ? num(m[3]) : null;

  if (![a, b].every(v => Number.isFinite(v) && v > 0)) return null;

  // Three axes: width × depth × height. Two: width × depth, height unknown.
  const size = c !== null && Number.isFinite(c) && c > 0
    ? [a, c, b]
    : [a, null, b];

  return { size, axes: c !== null ? 3 : 2, source: "TITLE_STATED_CM" };
}
