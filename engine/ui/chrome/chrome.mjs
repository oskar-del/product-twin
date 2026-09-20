/**
 * INK CHROME — the component package. Platform owns it; every surface consumes it.
 *
 *   chromeCss()             the stylesheet, as text, for inlining into a bundle
 *   topBar(plot, modes)     header: plot identity · mode switcher · actions
 *   sidePanel(spec)         the click-target detail panel (in Rooms: the product)
 *   evidenceChip(cls)       one of the five fixed evidence classes
 *   card(spec)              evidence-finding card
 *   metricStrip(metrics)    the four-up figure row
 *   sectionHead(spec)       serif section title + intro column
 *   evidenceLegend(hint)    the pinned palette key
 *
 * Every component returns an HTML STRING, not a DOM node. That is deliberate:
 * the consumers are node-side generators — the room bundler
 * (scripts/bundle-twin-scene.mjs) emits self-contained HTML, and build-demo.mjs
 * writes a static page. A DOM-factory API cannot run in either. Strings work in
 * node and in the browser, so there is one chrome instead of two.
 *
 * All interpolated text is escaped. The one exception is documented at
 * `sidePanel`: a BUY href is emitted byte-for-byte.
 *
 * Styling lives in tokens.css and nowhere else — this module emits class names
 * only, so re-theming is a token override, never a fork. Values in tokens.css
 * were extracted from Spatial's Site-Intelligence page
 * (repo-spatial-studio/prototype/svartinge-neighbourhood/index.html, the
 * `.intel-*` rules); each one names its source rule in a comment there.
 */

import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

export const INK_CLASS = "ink";

/**
 * The five fixed evidence classes — id, CSS custom property, hex.
 * There is no sixth. A surface needing one is making a claim the language
 * does not support, and should say so in words instead of inventing a colour.
 */
export const EVIDENCE_CLASSES = [
  {id: "AUTHORITATIVE",       token: "--ink-authoritative", hex: "#176b52"},
  {id: "INDICATIVE",          token: "--ink-indicative",    hex: "#c18a2d"},
  {id: "DERIVED",             token: "--ink-derived",       hex: "#497aa2"},
  {id: "REPORTED_UNVERIFIED", token: "--ink-reported",      hex: "#a65b68"},
  {id: "CONCEPT",             token: "--ink-concept",       hex: "#735a9e"}
];

const EVIDENCE_IDS = new Set(EVIDENCE_CLASSES.map(e => e.id));

/** What each class claims. One wording everywhere, so a chip explains itself. */
export const EVIDENCE_MEANING = {
  AUTHORITATIVE: "Official register or survey. Citable.",
  INDICATIVE: "Official-adjacent source; correct in kind, not survey-grade.",
  DERIVED: "Computed from other evidence; carries its inputs' limits.",
  REPORTED_UNVERIFIED: "Someone told us. Not checked.",
  CONCEPT: "Our proposal. Not a claim about anything that exists."
};

/* ── text safety ───────────────────────────────────────────────────────── */

/** Escape for HTML text and double-quoted attribute values. */
export function esc(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A link target we are willing to emit.
 *
 * The affiliate link is the thing that earns, so it is never rewritten,
 * re-encoded, shortened or appended to — `safeHref` either returns the input
 * unchanged or returns null. The only judgement it makes is the scheme: an
 * http(s) URL passes, anything else (javascript:, data:) is refused, because a
 * catalog is third-party data and a product panel is not a place to execute it.
 */
export function safeHref(href) {
  if (typeof href !== "string" || href === "") return null;
  let parsed;
  try {
    parsed = new URL(href);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return href;
}

/* ── stylesheet ────────────────────────────────────────────────────────── */

const TOKENS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "tokens.css");
let cachedCss = null;

/**
 * chromeCss() → tokens.css as text, for inlining into a self-contained page.
 *
 * Reads from disk, so it is node-only. A browser page links tokens.css instead.
 * Cached: a bundler calls this once per scene and there may be many scenes.
 */
export function chromeCss() {
  if (cachedCss == null) cachedCss = fs.readFileSync(TOKENS_PATH, "utf8");
  return cachedCss;
}

/** Where tokens.css lives, for a consumer that wants to copy or link it. */
export const TOKENS_CSS_PATH = TOKENS_PATH;

/* ── components ────────────────────────────────────────────────────────── */

/**
 * evidenceChip(cls, label?) → the chip for one of the five classes.
 *
 * An unknown class renders in CONCEPT's colour but keeps the text it was given,
 * so a surface inventing a class looks wrong rather than quietly borrowing a
 * colour it has not earned.
 */
export function evidenceChip(cls, label) {
  const known = EVIDENCE_IDS.has(cls);
  const resolved = known ? cls : "CONCEPT";
  const text = label ?? (known ? cls.replace(/_/g, " ") : `${cls} → CONCEPT`);
  const title = EVIDENCE_MEANING[resolved];
  return `<span class="ink-chip" data-evidence="${esc(resolved)}" title="${esc(title)}">${esc(text)}</span>`;
}

/**
 * topBar(plot, modes, {kicker, actions}) → the fixed header.
 *
 * `plot`    the plot name, or {name, kicker, sub}
 * `modes`   [{id, label, active, disabled}] — rendered as aria-pressed buttons
 * `actions` [{id, label, href, primary}]
 *
 * Mode buttons carry ids and aria-pressed but no behaviour; the host wires
 * them, because what a mode does differs per screen.
 */
export function topBar(plot = {}, modes = [], {kicker, actions = []} = {}) {
  const spec = typeof plot === "string" ? {name: plot} : plot;
  const kick = spec.kicker ?? kicker;

  const id = [
    kick ? `<span class="ink-kicker">${esc(kick)}</span>` : "",
    `<b>${esc(spec.name ?? "Untitled plot")}</b>`,
    spec.sub ? `<span class="ink-side-note">${esc(spec.sub)}</span>` : ""
  ].join("");

  const modeButtons = modes.map(mode => {
    const attrs = [
      `class="ink-mode"`,
      `type="button"`,
      `data-mode="${esc(mode.id)}"`,
      `aria-pressed="${mode.active ? "true" : "false"}"`,
      mode.disabled ? "disabled" : ""
    ].filter(Boolean).join(" ");
    return `<button ${attrs}>${esc(mode.label ?? mode.id)}</button>`;
  }).join("");

  const actionButtons = actions.map(action => {
    const href = safeHref(action.href);
    const cls = `ink-mode${action.primary ? " is-primary" : ""}`;
    if (href) {
      return `<a class="${cls}" href="${href}" data-action="${esc(action.id ?? "")}">${esc(action.label ?? "")}</a>`;
    }
    return `<button class="${cls}" type="button" data-action="${esc(action.id ?? "")}">${esc(action.label ?? "")}</button>`;
  }).join("");

  const right = [
    modeButtons ? `<nav class="ink-modes" aria-label="Screens">${modeButtons}</nav>` : "",
    actionButtons ? `<div class="ink-modes">${actionButtons}</div>` : ""
  ].filter(Boolean).join("");

  return `<header class="ink-topbar"><div class="ink-topbar-id">${id}</div>${right}</header>`;
}

/**
 * sectionHead({kicker, title, intro}) → serif title with an intro column.
 */
export function sectionHead({kicker, title, intro} = {}) {
  const left = [
    kicker ? `<span class="ink-kicker">${esc(kicker)}</span>` : "",
    `<h2>${esc(title ?? "")}</h2>`
  ].join("");
  const right = intro ? `<p>${esc(intro)}</p>` : "";
  return `<div class="ink-section-head"><div>${left}</div>${right}</div>`;
}

/**
 * metricStrip(metrics) → the four-up figure row.
 *
 * Each {label, value, note, chip}. A metric with no chip renders without one —
 * an unsourced number should look unsourced, not inherit a class it lacks.
 */
export function metricStrip(metrics = []) {
  const cells = metrics.map(metric => [
    `<div class="ink-metric">`,
    `<span>${esc(metric.label ?? "")}</span>`,
    `<b>${esc(metric.value ?? "—")}</b>`,
    metric.note ? `<small>${esc(metric.note)}</small>` : "",
    metric.chip ? evidenceChip(metric.chip) : "",
    `</div>`
  ].join("")).join("");
  return `<div class="ink-metrics">${cells}</div>`;
}

/**
 * card({tag, title, chip, body, stateLine, paper}) → evidence-finding card.
 * `paper: true` flips it to the light surface for reading-first screens.
 */
export function card({tag, title, chip, body, stateLine, paper = false} = {}) {
  const foot = (stateLine || chip)
    ? `<div class="ink-state-line">${stateLine ? `<span>${esc(stateLine)}</span>` : ""}${chip ? evidenceChip(chip) : ""}</div>`
    : "";
  return [
    `<article class="ink-card${paper ? " paper" : ""}">`,
    tag ? `<span class="ink-tag">${esc(tag)}</span>` : "",
    title ? `<h3>${esc(title)}</h3>` : "",
    body ? `<p>${esc(body)}</p>` : "",
    foot,
    `</article>`
  ].join("");
}

/** cards(list) → the three-up grid the cards are designed to sit in. */
export function cards(list = []) {
  return `<div class="ink-cards">${list.join("")}</div>`;
}

/**
 * sidePanel(spec) → the click-target detail panel.
 *
 * spec {kicker, title, brand, chip, chips[], price, rows[{label,value}],
 *       notes[], action{label,href}, paper, open}
 *
 * THE BUY HREF IS EMITTED VERBATIM. `safeHref` checks the scheme is http(s)
 * and otherwise returns the string untouched — no normalising, no encoding, no
 * appended parameters. A rewritten affiliate link earns nothing, so a gate can
 * diff what is rendered against the catalog row byte-for-byte. If the scheme is
 * refused the action is dropped and a visible note says so, because a dead BUY
 * button is worse than an absent one.
 */
export function sidePanel(spec = {}) {
  const head = [
    `<div class="ink-side-head">`,
    spec.kicker ? `<span class="ink-kicker">${esc(spec.kicker)}</span>` : "",
    `<b>${esc(spec.title ?? "")}</b>`,
    spec.brand ? `<span class="ink-brand">${esc(spec.brand)}</span>` : "",
    `</div>`
  ].join("");

  const chipList = spec.chips ?? (spec.chip ? [spec.chip] : []);
  const chips = chipList.length
    ? `<div class="ink-side-chips">${chipList.map(c => evidenceChip(c)).join("")}</div>`
    : "";

  const price = spec.price != null ? `<div class="ink-side-price">${esc(spec.price)}</div>` : "";

  const rows = (spec.rows ?? []).filter(r => r && r.value != null && r.value !== "");
  const rowHtml = rows.length
    ? `<div class="ink-side-rows">${rows.map(r =>
        `<div class="ink-side-row"><span>${esc(r.label ?? "")}</span><b>${esc(r.value)}</b></div>`
      ).join("")}</div>`
    : "";

  let action = "";
  if (spec.action?.label) {
    const href = safeHref(spec.action.href);
    action = href
      ? `<a class="ink-buy" href="${href}" target="_blank" rel="noopener">${esc(spec.action.label)}</a>`
      : `<div class="ink-side-note">Link withheld: the catalog gave a non-http(s) target, so no BUY is shown.</div>`;
  }

  const notes = (spec.notes ?? []).map(n => `<div class="ink-side-note">${esc(n)}</div>`).join("");

  const cls = ["ink-side", spec.paper ? "paper" : "", spec.open ? "is-open" : ""].filter(Boolean).join(" ");
  return `<aside class="${cls}">${head}${chips}${price}${rowHtml}${action}${notes}</aside>`;
}

/**
 * evidenceLegend(hint) → the pinned palette key.
 * Same five rows, same order, on every surface.
 */
export function evidenceLegend(hint) {
  const rows = EVIDENCE_CLASSES.map(e =>
    `<div class="ink-legend-row">${evidenceChip(e.id)}<span>${esc(EVIDENCE_MEANING[e.id])}</span></div>`
  ).join("");
  return [
    `<aside class="ink-legend" aria-label="Evidence class key">`,
    rows,
    hint ? `<div class="ink-side-note">${esc(hint)}</div>` : "",
    `</aside>`
  ].join("");
}
