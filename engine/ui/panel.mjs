/**
 * Element inspect panel.
 *
 * The click-an-object contract: every renderable element can be opened, and what opens is
 * always the same shape — what it is, how strong the evidence is, where it came from, what it
 * does NOT establish, and the raw scene parameters. Limitations are not fine print here; they
 * are a titled section, because the honesty UI is the product.
 *
 * Browser module: requires document.
 */
import {evidenceCss, evidenceDescription} from "../core/evidence.mjs";
import {productPanel} from "./product-panel.mjs";

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));

export function createPanel({mount}) {
  const panel = document.createElement("aside");
  panel.className = "twin-panel";
  panel.dataset.open = "false";
  panel.setAttribute("aria-label", "Element details");
  panel.innerHTML = `
    <button class="twin-close" type="button" aria-label="Close details">×</button>
    <div class="twin-eyebrow"></div>
    <h2></h2>
    <div class="twin-badge-row"></div>
    <div class="twin-body"></div>`;
  mount.append(panel);

  const eyebrow = panel.querySelector(".twin-eyebrow");
  const title = panel.querySelector("h2");
  const badgeRow = panel.querySelector(".twin-badge-row");
  const body = panel.querySelector(".twin-body");
  panel.querySelector(".twin-close").addEventListener("click", () => close());

  function close() {
    panel.dataset.open = "false";
  }

  function open(element) {
    if (!element) return close();
    eyebrow.textContent = `${element.type} · ${element.id}`;
    title.textContent = element.label;
    badgeRow.innerHTML = `<span class="twin-badge" style="background:${evidenceCss(element.evidence_class)}">${escapeHtml(element.evidence_class)}</span>`;
    body.innerHTML = `
      <div class="twin-row"><b>What this evidence class means</b>${escapeHtml(evidenceDescription(element.evidence_class))}</div>
      <div class="twin-row"><b>Geometry / method</b><code>${escapeHtml(element.geometry.primitive)}</code></div>
      <div class="twin-row"><b>Source references</b>${
        element.source_refs.length ? element.source_refs.map(escapeHtml).join("<br>") : "None"
      }</div>
      <div class="twin-row"><b>Limitations</b>${
        element.limitations.length
          ? `<ul>${element.limitations.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
          : "None stated"
      }</div>
      <div class="twin-row"><b>Scene parameters</b><pre>${escapeHtml(summarizeGeometry(element.geometry))}</pre></div>
      ${commerceSection(element)}`;
    panel.dataset.open = "true";
  }

  return {element: panel, open, close, get isOpen() { return panel.dataset.open === "true"; }};
}

function commerceSection(element) {
  const panel = productPanel(element);
  if (!panel) return "";
  const parts = [];
  if (panel.image_url) {
    parts.push(`<img src="${escapeHtml(panel.image_url)}" alt="${escapeHtml(panel.product_name)}" style="max-width:100%;border-radius:6px;margin-bottom:8px">`);
  }
  parts.push(`<div style="font-weight:600;font-size:1.05em">${escapeHtml(panel.product_name)}</div>`);
  if (panel.brand) parts.push(`<div style="opacity:0.7">${escapeHtml(panel.brand)}</div>`);
  if (panel.price) {
    const priceStr = panel.currency ? `${panel.price} ${panel.currency}` : String(panel.price);
    parts.push(`<div style="font-size:1.1em;font-weight:700;margin:4px 0">${escapeHtml(priceStr)}</div>`);
  }
  if (panel.dimensions_label) parts.push(`<div style="opacity:0.6;font-size:0.85em">${escapeHtml(panel.dimensions_label)}</div>`);
  if (panel.buy_url) {
    parts.push(`<a href="${escapeHtml(panel.buy_url)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;padding:8px 20px;background:#2a7a5a;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">BUY</a>`);
  } else if (panel.product_url) {
    parts.push(`<a href="${escapeHtml(panel.product_url)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;padding:8px 20px;background:#2a7a5a;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">View product</a>`);
  }
  return `<div class="twin-row" style="border-top:1px solid rgba(128,128,128,0.2);padding-top:12px;margin-top:8px"><b>Product</b>${parts.join("")}</div>`;
}

/** Vertex soups are summarized rather than dumped — a 625-point terrain helps nobody as JSON. */
function summarizeGeometry(geometry) {
  const compact = {};
  for (const [key, value] of Object.entries(geometry)) {
    compact[key] = Array.isArray(value) && value.length > 8
      ? `[${value.length} entries]`
      : value;
  }
  return JSON.stringify(compact, null, 2);
}
