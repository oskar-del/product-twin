/**
 * The Rooms product panel, on the ink chrome.
 *
 * The engine's default panel is the light buyer-surface chrome. A room stage is
 * dark, so the room mounts this instead (the engine's own panel is hidden by
 * the bundled page's CSS) and feeds it through `onElementOpen`.
 *
 * What the panel must say, per the sprint mandate: name · brand · dimensions
 * with an evidence chip · price · BUY verbatim.
 *
 * The dimension chip is the interesting one. `scripts/bundle-twin-scene.mjs`
 * measures each GLB's POSITION accessors at bundle time and writes
 * `geometry.dimension_evidence`, so the chip reflects where the number came
 * from — AUTHORITATIVE when it was measured off the mesh the viewer is
 * showing, INDICATIVE when it is a catalog title or a category default. It is
 * never asserted here.
 *
 * Browser module: requires document.
 */
import {sidePanel} from "./chrome.mjs";

export function createRoomPanel({mount}) {
  const host = document.createElement("div");
  host.className = "room-panel";
  mount.append(host);

  function close() {
    host.classList.remove("is-open");
    host.innerHTML = "";
  }

  function open(element) {
    if (!element) return close();
    const commerce = element.commerce ?? null;
    const geometry = element.geometry ?? {};

    // Non-product elements (floor, room volume, openings) still open, so the
    // room stays inspectable rather than only shoppable.
    const rows = commerce
      ? [
          {label: "Brand", value: commerce.brand},
          {label: "Merchant", value: commerce.merchant},
          {label: "Dimensions", value: geometry.dimensions_label ?? commerce.dimensions_label},
          {label: "Dimension source", value: geometry.dimension_source},
          {label: "Colour", value: commerce.color},
          {label: "Material", value: commerce.material},
          {label: "SKU", value: commerce.sku},
          {label: "Observed", value: commerce.observed_at}
        ]
      : [
          {label: "Element", value: element.id},
          {label: "Geometry", value: geometry.primitive},
          {label: "Sources", value: (element.source_refs ?? []).join(" · ")}
        ];

    const chips = [element.evidence_class];
    if (commerce && geometry.dimension_evidence) chips.push(geometry.dimension_evidence);

    host.innerHTML = sidePanel({
      kicker: `${element.type} · ${element.id}`,
      title: commerce?.product_name ?? element.label ?? element.id,
      brand: commerce?.brand ?? null,
      chips,
      price: commerce?.price != null
        ? `${Number(commerce.price).toLocaleString("sv-SE")} ${commerce.currency ?? ""}`.trim()
        : null,
      rows,
      action: commerce?.buy_url ? {label: "Buy", href: commerce.buy_url} : null,
      notes: [
        ...(element.limitations ?? []),
        ...(commerce ? ["BUY is the catalog affiliate_link, emitted byte-for-byte."] : [])
      ],
      open: true
    });

    const close_ = document.createElement("button");
    close_.className = "ink-mode";
    close_.type = "button";
    close_.textContent = "Close";
    close_.style.cssText = "margin-top:12px;width:100%";
    close_.addEventListener("click", close);
    host.querySelector(".ink-side")?.append(close_);

    host.classList.add("is-open");
  }

  return {element: host, open, close};
}
