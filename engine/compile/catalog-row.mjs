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
    type = "FURNITURE"
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

  const limitations = hasGeometry
    ? [
        "Geometry level G2: promoted universal proxy — real footprint and height, representative shape.",
        "Textures and finish are representative, not manufacturer artwork."
      ]
    : [
        "No 3D proxy exists for this row; shown as a box at nominal scale.",
        "Dimensions are not derived from geometry and are not a fit claim."
      ];

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
    commerce: commerceFromRow(row)
  };
}

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
