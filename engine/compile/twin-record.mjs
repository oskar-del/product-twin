/**
 * Product Twin record → scene element.
 *
 * Converts a `data/twins/*.json` record into a scene element the engine can render.
 * The twin's geometry level (G0–G3) maps to an evidence class; its .glb asset is
 * declared as a GLTF_ASSET primitive.
 *
 * Pure module: no DOM, no WebGL.
 */

const GEOMETRY_LEVEL_TO_EVIDENCE = {
  G0: "CONCEPT",
  G1: "REPORTED_UNVERIFIED",
  G2: "INDICATIVE",
  G3: "AUTHORITATIVE"
};

/**
 * @param {object} twin          a parsed twin record from data/twins/
 * @param {object} placement     {position: [x,y,z], rotation_y_deg, scale}
 * @returns {object}             a scene element ready for assembleScene
 */
export function twinToElement({twin, placement = {}}) {
  if (!twin?.twin_id) throw new TypeError("twin must have a twin_id");
  if (!twin.geometry?.asset_path) throw new TypeError(`twin ${twin.twin_id} has no geometry.asset_path`);

  const level = twin.geometry.level ?? "G0";
  const evidenceClass = GEOMETRY_LEVEL_TO_EVIDENCE[level] ?? "CONCEPT";

  const dimensions = twin.physical?.dimensions_mm;
  const dimStr = dimensions
    ? ` (${dimensions.width}×${dimensions.depth}×${dimensions.height} mm)`
    : "";

  const sourceRefs = [
    `Product Twin ${twin.twin_id}`,
    ...(twin.identity?.manufacturer ? [`${twin.identity.manufacturer} ${twin.identity.product_family ?? ""}`] : [])
  ];

  const limitations = [
    `Geometry level ${level}: ${twin.geometry.shape_claim ?? twin.geometry.state ?? "proxy"}`,
    ...(twin.geometry.rights?.exact_likeness_claimed === false
      ? ["Not an exact manufacturer likeness."]
      : []),
    ...(twin.geometry.appearance?.exact_manufacturer_texture_or_finish_claimed === false
      ? ["Textures are representative, not manufacturer artwork."]
      : [])
  ];

  return {
    id: twin.twin_id.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    type: "FURNITURE",
    label: `${twin.identity?.manufacturer ?? ""} ${twin.identity?.model ?? twin.twin_id}${dimStr}`.trim(),
    evidence_class: evidenceClass,
    geometry: {
      primitive: "GLTF_ASSET",
      asset_path: twin.geometry.asset_path,
      position: placement.position ?? [0, 0, 0],
      rotation_y_deg: placement.rotation_y_deg ?? 0,
      ...(placement.scale ? {scale: placement.scale} : {})
    },
    source_refs: sourceRefs,
    limitations
  };
}

/**
 * Batch convert twin records to scene elements.
 * @param {Array<{twin, placement}>} items
 * @returns {object[]}
 */
export function twinsToElements(items) {
  return items.map(item => twinToElement(item));
}
