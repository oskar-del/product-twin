/**
 * Builds engine/ui/chrome/demo.html — every chrome component on one page.
 *
 *   node engine/ui/chrome/build-demo.mjs
 *
 * The page is GENERATED rather than hand-written so its figures are computed
 * from receipts, not typed: the parcel numbers come from Spatial's
 * AUTHORITATIVE property-division clip (with its sha-256), the room numbers
 * from the compiled Newport scene, and the product panel from a real catalog
 * row with its affiliate link. A demo with invented numbers teaches the wrong
 * habit to every surface that copies it.
 *
 * A receipt that cannot be read is reported as UNAVAILABLE on the page instead
 * of being replaced with a plausible number.
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {
  chromeCss, topBar, sectionHead, metricStrip, card, cards,
  sidePanel, evidenceChip, evidenceLegend, esc, EVIDENCE_CLASSES
} from "./chrome.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");

function readJson(relative) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(root, relative), "utf8"));
  } catch {
    return null;
  }
}

/* ── receipts ──────────────────────────────────────────────────────────── */

const parcel = readJson("../repo-spatial-studio/data/sites/sweden/saterdalsvagen-14/property-division-derived-v0.1.json");
const room = readJson("data/scenes/shoppable-room-newport-living/scene-v0.1.json");

/** Shoelace area of a local-ENU ring [[x,z],…] in m². */
function ringArea(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, z1] = ring[i];
    const [x2, z2] = ring[(i + 1) % ring.length];
    sum += x1 * z2 - x2 * z1;
  }
  return Math.abs(sum) / 2;
}

const subjectRing = parcel?.subject_rings_local?.[0] ?? null;
const parcelArea = ringArea(subjectRing);
const parcelVertices = Array.isArray(subjectRing)
  ? subjectRing.length - (samePoint(subjectRing[0], subjectRing[subjectRing.length - 1]) ? 1 : 0)
  : null;
const contextParcels = parcel?.context_rings_local?.length ?? null;

function samePoint(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && a[1] === b[1];
}

const products = (room?.elements ?? []).filter(e => e.commerce?.buy_url);
const withGlb = (room?.elements ?? []).filter(e => e.geometry?.primitive === "GLTF_ASSET");
const basket = products.reduce((sum, e) => sum + (e.commerce.price ?? 0), 0);
const currency = products[0]?.commerce?.currency ?? "";
const tracked = products.filter(e => /cupa_sku=/.test(e.commerce.buy_url ?? "")).length;

/** The real sofa row, for the product panel. */
const sofa = products.find(e => e.id === "SOFA") ?? products[0] ?? null;

function num(value, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "UNAVAILABLE";
  return value.toLocaleString("sv-SE", {minimumFractionDigits: digits, maximumFractionDigits: digits});
}
function int(value) {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("sv-SE") : "UNAVAILABLE";
}

/* ── page ──────────────────────────────────────────────────────────────── */

const METRICS = [
  {
    label: "Registered boundary",
    value: parcelArea ? `${num(parcelArea)} m²` : "UNAVAILABLE",
    note: parcel ? `Recomputed from ${parcel.authority} ${parcel.source_product}` : "receipt unreadable",
    chip: parcel?.evidence_class ?? null
  },
  {
    label: "Boundary vertices",
    value: int(parcelVertices),
    note: "subject_rings_local, closing point dropped",
    chip: "AUTHORITATIVE"
  },
  {
    label: "Context parcels",
    value: int(contextParcels),
    note: "neighbouring rings in the same clip",
    chip: "AUTHORITATIVE"
  },
  {
    label: "Room basket",
    value: basket ? `${int(basket)} ${currency}` : "UNAVAILABLE",
    note: `${products.length} products · ${tracked} channel-tracked · ${withGlb.length} GLB proxies`,
    chip: "INDICATIVE"
  }
];

const SOFA_PANEL = sofa ? sidePanel({
  kicker: `FURNITURE · ${sofa.id}`,
  title: sofa.commerce.product_name ?? sofa.label,
  brand: [sofa.commerce.brand, sofa.commerce.merchant].filter(Boolean).join(" · "),
  chips: [sofa.evidence_class],
  price: sofa.commerce.price != null ? `${int(sofa.commerce.price)} ${sofa.commerce.currency ?? ""}`.trim() : null,
  open: true,
  rows: [
    {label: "Dimensions", value: sofa.commerce.dimensions_label},
    {label: "Dimension source", value: sofa.geometry?.asset_source_path || sofa.geometry?.asset_path ? "G2 PROXY BOUNDS" : "TITLE PARSE"},
    {label: "Colour", value: sofa.commerce.color},
    {label: "Material", value: sofa.commerce.material},
    {label: "Availability", value: sofa.commerce.available === true ? "In stock at ingest" : sofa.commerce.available === false ? "Out of stock at ingest" : null},
    {label: "Observed", value: sofa.commerce.observed_at}
  ],
  action: {label: "Buy", href: sofa.commerce.buy_url},
  notes: [
    ...(sofa.limitations ?? []),
    "BUY href is the catalog affiliate_link, emitted byte-for-byte."
  ]
}) : `<aside class="ink-side"><div class="ink-side-note">Newport scene not compiled — run node scripts/compile-newport-room.mjs</div></aside>`;

const FINDING_CARDS = parcel ? cards([
  card({
    tag: "Property identity",
    title: parcel.subject,
    chip: parcel.evidence_class,
    body: `${parcel.authority}'s property division ties this address to a registered parcel. The clip carries its source product, CRS and a sha-256 of the raw asset, so the boundary is citable rather than indicative.`,
    stateLine: `RAW sha256 ${String(parcel.raw_asset?.sha256 ?? "").slice(0, 12)}… · ${parcel.source_crs}`
  }),
  card({
    tag: "Derivation",
    title: "Area is recomputed, not quoted",
    chip: "DERIVED",
    body: `The ${num(parcelArea)} m² above is the shoelace area of the clip's own local-ENU ring, computed at build time. Nothing on this page repeats a number a document claimed without re-deriving it.`,
    stateLine: `GEOMETRY sha256 ${String(parcel.derived_geometry_sha256 ?? "").slice(0, 12)}…`
  }),
  card({
    tag: "Limits",
    title: "What the clip does not settle",
    chip: "REPORTED_UNVERIFIED",
    body: (parcel.limitations ?? [])[0] ?? "Boundary geometry does not establish buildable envelope, access or utility capacity.",
    stateLine: "NO ABSENCE INFERENCE PERMITTED"
  })
]) : cards([card({tag: "Receipt", title: "Parcel clip unavailable", chip: "REPORTED_UNVERIFIED", body: "property-division-derived-v0.1.json could not be read from repo-spatial-studio.", stateLine: "FIGURES WITHHELD"})]);

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ink chrome — component demo</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap">
<style>
${chromeCss()}
.demo-src{font-size:9px;color:var(--ink-text-faint);letter-spacing:.06em;margin:16px 0 0}
.demo-swatches{display:grid;grid-template-columns:repeat(5,1fr);gap:var(--ink-gap)}
.demo-swatch{border-radius:var(--ink-radius);padding:16px;min-height:96px;display:flex;flex-direction:column;justify-content:flex-end;color:#fff}
.demo-swatch b{font-size:9px;letter-spacing:.08em}
.demo-swatch code{font-size:8px;opacity:.8}
.demo-split{display:grid;grid-template-columns:1fr 340px;gap:var(--ink-gap);align-items:start}
.demo-foot{padding:24px var(--ink-gutter) 60px;font-size:9px;letter-spacing:.06em;color:var(--ink-text-faint);line-height:1.7}
@media(max-width:1050px){.demo-swatches{grid-template-columns:repeat(2,1fr)}.demo-split{grid-template-columns:1fr}}
</style>
<body class="ink">

${topBar(
  {name: "Säterdalsvägen 14", kicker: "Platform · ink chrome", sub: parcel ? parcel.subject : "receipt unavailable"},
  [
    {id: "INTELLIGENCE", label: "Site intelligence", active: true},
    {id: "LAB", label: "Spatial lab"},
    {id: "HOUSE", label: "The house"},
    {id: "ROOMS", label: "Rooms"},
    {id: "STILLS", label: "Stills"},
    {id: "NUMBERS", label: "Numbers"}
  ],
  {actions: [{id: "enter", label: "Enter the 3D twin →", primary: true}]}
)}

<div class="ink-body">

  <section class="ink-section">
    ${sectionHead({kicker: "01", title: "metricStrip()", intro: "The four-up figure row. Every value here was computed at build time from a receipt on disk; an unreadable receipt prints UNAVAILABLE rather than a plausible number."})}
    ${metricStrip(METRICS)}
    <p class="demo-src">src: .intel-metrics / .intel-metric — span 9px bronze · b 34px Georgia · small 10px faint</p>
  </section>

  <section class="ink-section">
    ${sectionHead({kicker: "02", title: "sectionHead()", intro: "Display serif heading, optional bronze kicker, dim intro column capped at 520px. This heading is itself the component."})}
    <p class="demo-src">src: .intel-section-head — h2 500 clamp(28px,4vw,48px)/1 Georgia · p 11px/1.6 rgba(255,255,255,.55)</p>
  </section>

  <section class="ink-section">
    ${sectionHead({kicker: "03", title: "evidenceChip()", intro: "Five fixed classes from the 2026-09-15 consolidation. There is no sixth; an unknown class takes CONCEPT's colour but keeps its own text, so the mistake stays visible."})}
    <div class="demo-swatches">
      ${EVIDENCE_CLASSES.map(e => `<div class="demo-swatch" style="background:var(${e.token})"><b>${esc(e.id)}</b><code>${esc(e.hex)}</code></div>`).join("")}
    </div>
    <p style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">${EVIDENCE_CLASSES.map(e => evidenceChip(e.id)).join("")}${evidenceChip("NOT_A_REAL_CLASS")}</p>
    <p class="demo-src">src: .intel-gate-row span (8px · .11em · pill) + the five consolidation colours</p>
  </section>

  <section class="ink-section">
    ${sectionHead({kicker: "04", title: "card()", intro: "Evidence-finding card: bronze tag, serif title, dim body, footer pairing a source line with the chip. Text below is drawn from the parcel clip itself."})}
    ${FINDING_CARDS}
    <p class="demo-src">src: .intel-card + .tag + h3 + p + .state-line</p>
  </section>

  <section class="ink-section">
    ${sectionHead({kicker: "05", title: "sidePanel()", intro: "The click-target detail panel. In Rooms it is the product: name · brand · dimensions + the chip that says where the dimensions came from · price · BUY."})}
    <div class="demo-split">
      ${cards([
        card({tag: "Rule", title: "The BUY href is never rewritten", chip: "AUTHORITATIVE", body: "safeHref() checks only that the scheme is http(s). It returns the string unchanged or nothing at all — no normalising, no re-encoding, no appended parameters. A rewritten affiliate link earns nothing.", stateLine: "VERBATIM FROM commerce.affiliate_link"}),
        card({tag: "Rule", title: "A refused link shows no button", chip: "CONCEPT", body: "If a catalog row gives a non-http(s) target the action is dropped and the panel says the link was withheld. A dead BUY button is worse than an absent one.", stateLine: "FAIL VISIBLY, NOT SILENTLY"})
      ])}
      ${SOFA_PANEL}
    </div>
    <p class="demo-src">src: .intel-gates panel language + .intel-gate-row rows · panel content from ${esc(room?.scene_id ?? "no compiled scene")}</p>
  </section>

  <section class="ink-section">
    ${sectionHead({kicker: "06", title: "topBar()", intro: "Live at the top of this page: plot name with bronze kicker and sub-line, the six-screen mode switcher, and a right-hand primary action."})}
    <p class="demo-src">src: .intel-nav / .intel-brand / .intel-actions / .intel-button(.primary)</p>
  </section>

  <section class="ink-section" style="border:0">
    ${sectionHead({kicker: "07", title: "evidenceLegend()", intro: "The palette key, identical on every surface so the colours mean one thing product-wide."})}
    ${evidenceLegend("One chrome · six screens · click any element for its evidence")}
  </section>

</div>

<div class="demo-foot">
  GENERATED ${new Date().toISOString()} · node engine/ui/chrome/build-demo.mjs<br>
  PARCEL RECEIPT ${esc(parcel ? `${parcel.authority} · ${parcel.source_product} · raw sha256 ${String(parcel.raw_asset?.sha256 ?? "").slice(0, 16)}…` : "UNAVAILABLE")}<br>
  ROOM RECEIPT ${esc(room ? `${room.scene_id} · ${products.length} products · ${tracked} channel-tracked` : "UNAVAILABLE")}
</div>

<script>
document.querySelectorAll(".ink-mode[data-mode]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".ink-mode[data-mode]").forEach(other => {
      other.setAttribute("aria-pressed", String(other === button));
    });
  });
});
</script>
`;

const out = path.join(here, "demo.html");
fs.writeFileSync(out, html);
console.log(`wrote engine/ui/chrome/demo.html  ${(html.length / 1024).toFixed(1)} KB`);
console.log(`  parcel   ${parcel ? `${num(parcelArea)} m² · ${parcelVertices} vertices · ${contextParcels} context rings` : "UNAVAILABLE"}`);
console.log(`  room     ${room ? `${products.length} products · ${tracked} tracked · ${int(basket)} ${currency} basket · ${withGlb.length} GLB` : "UNAVAILABLE"}`);
console.log(`  components topBar · sectionHead · metricStrip · evidenceChip · card · sidePanel · evidenceLegend`);
