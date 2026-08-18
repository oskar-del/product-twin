/**
 * Evidence legend.
 *
 * Generated from the evidence module, never hand-written into a page — a legend that can drift
 * from the colours it explains is worse than no legend.
 *
 * Browser module: requires document.
 */
import {evidenceLegend} from "../core/evidence.mjs";

export function createLegend({mount, title = "Evidence class"}) {
  const legend = document.createElement("aside");
  legend.className = "twin-legend";
  legend.innerHTML = `<b>${title}</b><ul>${
    evidenceLegend()
      .map(row => `<li><span class="twin-dot" style="background:${row.css}"></span>${row.evidence_class.replace(/_/g, " ").toLowerCase()}</li>`)
      .join("")
  }</ul>`;
  mount.append(legend);
  return {element: legend};
}
