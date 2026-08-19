/**
 * Evidence legend + claim policy.
 *
 * Two halves of the same honesty UI. The legend is generated from the evidence module so it can
 * never drift from the colours it explains. Below it, collapsed, sits what the scene itself says
 * it may NOT claim — carried by every surface the engine renders, not bolted onto whichever page
 * happened to remember it. "Publish the gaps" is a feature, so it ships with the engine.
 *
 * Browser module: requires document.
 */
import {evidenceLegend} from "../core/evidence.mjs";

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));

const humanizeClaim = value => String(value).replace(/_/g, " ").toLowerCase();

export function createLegend({mount, title = "Evidence class", claimPolicy = null}) {
  const legend = document.createElement("aside");
  legend.className = "twin-legend";

  const rows = evidenceLegend()
    .map(row => `<li><span class="twin-dot" style="background:${row.css}"></span>${escapeHtml(row.evidence_class.replace(/_/g, " ").toLowerCase())}</li>`)
    .join("");

  const blocked = claimPolicy?.blocked_claims ?? [];
  const policy = claimPolicy && (blocked.length || claimPolicy.rule)
    ? `<details class="twin-policy">
         <summary>What this twin does not claim</summary>
         ${blocked.length ? `<ul class="twin-blocked">${blocked.map(claim => `<li>${escapeHtml(humanizeClaim(claim))}</li>`).join("")}</ul>` : ""}
         ${claimPolicy.rule ? `<p>${escapeHtml(claimPolicy.rule)}</p>` : ""}
       </details>`
    : "";

  // The legend is a <details> so a phone can collapse it: on a 375 px screen an always-open
  // legend plus claim policy covers half the scene, and a twin nobody can see is not honest,
  // just unusable. Open by default on anything wider.
  legend.innerHTML = `<details class="twin-legend-body"><summary>${escapeHtml(title)}</summary><ul>${rows}</ul>${policy}</details>`;
  const body = legend.querySelector(".twin-legend-body");
  const narrow = globalThis.matchMedia?.("(max-width: 760px)");
  body.open = !(narrow?.matches ?? false);
  narrow?.addEventListener?.("change", event => { body.open = !event.matches; });
  mount.append(legend);
  return {element: legend};
}
