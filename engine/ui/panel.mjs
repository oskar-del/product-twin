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
      <div class="twin-row"><b>Scene parameters</b><pre>${escapeHtml(summarizeGeometry(element.geometry))}</pre></div>`;
    panel.dataset.open = "true";
  }

  return {element: panel, open, close, get isOpen() { return panel.dataset.open === "true"; }};
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
