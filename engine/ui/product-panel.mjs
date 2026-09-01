/**
 * Product panel contract.
 *
 * When the user clicks a scene object the engine resolves the hit to an element.
 * If that element carries a `commerce` block this module extracts the panel data
 * the host surface renders: product name, price, image, BUY link.
 *
 * Pure module: no DOM. The host surface owns rendering.
 */

/**
 * @param {object} element  a scene element (from parseScene().elements or the
 *                          click-resolve path)
 * @returns {object|null}   panel payload, or null if the element is not shoppable
 */
export function productPanel(element) {
  const commerce = element?.commerce;
  if (!commerce) return null;

  return {
    element_id: element.id,
    label: element.label,
    evidence_class: element.evidence_class,
    product_name: commerce.product_name ?? element.label,
    brand: commerce.brand ?? null,
    price: commerce.price ?? null,
    currency: commerce.currency ?? null,
    image_url: commerce.image_url ?? null,
    buy_url: commerce.buy_url ?? null,
    product_url: commerce.product_url ?? null,
    category: commerce.category ?? null,
    color: commerce.color ?? null,
    dimensions_label: commerce.dimensions_label ?? null,
    limitations: element.limitations
  };
}

/**
 * Extract all shoppable elements from a parsed scene.
 * @param {object} scene  parsed scene from parseScene()
 * @returns {Map<string, object>}  element id → panel payload
 */
export function shoppablePanels(scene) {
  const panels = new Map();
  for (const element of scene.elements) {
    const panel = productPanel(element);
    if (panel) panels.set(element.id, panel);
  }
  return panels;
}
