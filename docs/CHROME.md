# Ink chrome — the one chrome, and how to consume it

Platform owns the chrome. Every surface imports it; nobody re-implements it.
If a screen needs a look the package does not have, the fix is a token override
or a new component **here**, never a local stylesheet.

- Package: `engine/ui/chrome/` — `tokens.css` (all styling) + `chrome.mjs` (markup)
- Demo: `engine/ui/chrome/demo.html`, regenerate with `node engine/ui/chrome/build-demo.mjs`
- Screenshot: `docs/screens/chrome-demo-2026-09-20.png`
- Source of the values: Spatial's Site-Intelligence page,
  `repo-spatial-studio/prototype/svartinge-neighbourhood/index.html` — the `.intel-*`
  rules. Every token in `tokens.css` names the rule it came from. Nothing was invented.

## Import

```js
import {
  chromeCss, topBar, sectionHead, metricStrip,
  evidenceChip, card, cards, sidePanel, evidenceLegend
} from "../ui/chrome/chrome.mjs";
```

**Components return HTML strings, not DOM nodes.** That is deliberate: the
consumers are node-side generators — `scripts/bundle-twin-scene.mjs` emits
self-contained HTML and `build-demo.mjs` writes a static page, and neither has a
DOM. Strings work in node *and* in the browser, so there is one chrome rather
than two.

Two ways to get the CSS in:

```js
// self-contained page (bundler): inline it
`<style>${chromeCss()}</style>`        // node-only, reads tokens.css off disk

// ordinary page: link it
`<link rel="stylesheet" href="./tokens.css">`
```

Then scope your markup with the `ink` class — `<body class="ink">` is the usual
place. Nothing styles itself outside that scope.

## Components

| Call | Renders |
|---|---|
| `topBar(plot, modes, {actions})` | Header: plot identity + the six-screen switcher + right-hand actions. `plot` is a string or `{name, kicker, sub}`; `modes` is `[{id, label, active, disabled}]`. |
| `sectionHead({kicker, title, intro})` | Serif display heading with bronze kicker and a 520px intro column. |
| `metricStrip(metrics)` | The four-up figure row. Each `{label, value, note, chip}`. |
| `evidenceChip(cls, label?)` | One of the five fixed classes. |
| `card({tag, title, chip, body, stateLine, paper})` | Evidence-finding card. `paper: true` for the light reading surface. |
| `cards([...])` | The three-up grid those cards are built for. |
| `sidePanel(spec)` | The click-target detail panel — in Rooms, the product panel. |
| `evidenceLegend(hint)` | The palette key. Add `is-pinned` to fix it bottom-left. |

`sidePanel` spec: `{kicker, title, brand, chip | chips[], price, rows:[{label,value}],
notes:[], action:{label, href}, paper, open}`.

## Two rules the package enforces for you

**1. The BUY href is emitted byte-for-byte.** `safeHref()` checks one thing —
that the scheme is `http(s)` — and then returns the string *unchanged*. No
normalising, no re-encoding, no appended parameters. A rewritten affiliate link
earns nothing, so a gate can diff what rendered against the catalog row:

```
catalog  commerce.affiliate_link
rendered <a class="ink-buy" href="…">
identical ✓   (verified 2026-09-20 for SOFA / cupa_sku=100112)
```

If the scheme is refused the action is dropped and the panel prints "Link
withheld". A dead BUY button is worse than an absent one.

**2. There are five evidence classes and no sixth.** `AUTHORITATIVE` ·
`INDICATIVE` · `DERIVED` · `REPORTED_UNVERIFIED` · `CONCEPT`. An unknown class
renders in CONCEPT's colour but keeps the text it was given
(`FOO → CONCEPT`), so an invented class looks wrong on the page instead of
quietly borrowing a colour it has not earned. `EVIDENCE_MEANING` carries the
one-line definition of each; use it rather than writing your own wording.

A metric with no `chip` renders without one, on purpose: an unsourced number
should look unsourced.

## Re-theming

Override tokens on a host element. Never fork the file.

```css
.ink { --ink-bronze: #c9a24a; --ink-radius: 12px; }
```

## Demo figures come from receipts

`build-demo.mjs` computes every number on the demo page at build time rather
than typing it — the parcel area is the shoelace area of the clip's own
local-ENU ring, the room figures come from the compiled Newport scene, and the
product panel is a real catalog row. A receipt that cannot be read prints
`UNAVAILABLE` rather than a plausible substitute. Copy that habit into your
surface.

As of 2026-09-20 the demo reports: parcel 1 936,8 m² · 6 vertices · 75 context
rings (Lantmäteriet `fastighetsindelning_kn0581`, raw sha256 `839f729f63d8…`);
room 11 products · 11 channel-tracked · 208 760 SEK basket · 11 GLB proxies.
The recomputed area independently matches Lantmäteriet's stated 1 936,8 m².
