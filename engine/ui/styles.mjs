/**
 * Engine chrome stylesheet.
 *
 * Shipped by the engine so a consuming surface gets the whole viewer — panel, legend, dock —
 * without copying CSS between projects. Everything is expressed in custom properties on
 * `.twin-engine`, so a host page restyles the chrome by overriding tokens, never by forking it.
 *
 * The default tokens are the light/serif buyer-surface language: paper, ink, glass, serif
 * headings on sans body.
 *
 * Browser module: requires document.
 */

export const ENGINE_CLASS = "twin-engine";

const STYLE_ID = "twin-engine-styles";

const CSS = `
.${ENGINE_CLASS}{
  --twin-ink:#14231d;
  --twin-paper:#f5f1e8;
  --twin-glass:rgba(247,244,236,.94);
  --twin-line:rgba(20,35,29,.15);
  --twin-muted:#6d7b73;
  --twin-radius:14px;
  --twin-sans:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;
  --twin-serif:Georgia,"Times New Roman",serif;
  position:relative;color:var(--twin-ink);font-family:var(--twin-sans);
}
.${ENGINE_CLASS} canvas{display:block}
.${ENGINE_CLASS} .twin-hud{position:absolute;inset:0;pointer-events:none;z-index:4}
.${ENGINE_CLASS} .twin-hud > *{pointer-events:auto}

.${ENGINE_CLASS} .twin-brand{position:absolute;left:16px;top:14px;background:var(--twin-ink);color:#fff;border-radius:12px;padding:10px 13px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;max-width:min(320px,32vw);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.${ENGINE_CLASS} .twin-dock{position:absolute;left:50%;top:14px;transform:translateX(-50%);display:flex;gap:4px;background:rgba(20,35,29,.9);padding:5px;border-radius:var(--twin-radius);box-shadow:0 8px 28px rgba(0,0,0,.18)}
.${ENGINE_CLASS} .twin-dock button{border:0;background:transparent;color:rgba(255,255,255,.68);padding:8px 12px;border-radius:10px;font-size:9px;letter-spacing:.08em;cursor:pointer;font-family:inherit}
.${ENGINE_CLASS} .twin-dock button[aria-pressed="true"]{background:#fff;color:var(--twin-ink)}

.${ENGINE_CLASS} .twin-steps{position:absolute;left:50%;top:64px;transform:translateX(-50%);display:flex;gap:5px;background:rgba(20,35,29,.86);padding:6px;border-radius:15px;max-width:calc(100% - 32px);overflow:auto}
.${ENGINE_CLASS} .twin-steps button{border:0;background:transparent;color:rgba(255,255,255,.68);padding:8px 10px;border-radius:10px;font-size:9px;white-space:nowrap;cursor:pointer;font-family:inherit}
.${ENGINE_CLASS} .twin-steps button[aria-current="true"]{background:#fff;color:var(--twin-ink)}

.${ENGINE_CLASS} .twin-caption{position:absolute;left:50%;top:110px;transform:translateX(-50%);background:var(--twin-glass);border:1px solid var(--twin-line);border-radius:999px;padding:7px 12px;font-size:10px;backdrop-filter:blur(12px);max-width:calc(100% - 32px);text-align:center}

.${ENGINE_CLASS} .twin-legend{position:absolute;left:16px;bottom:16px;background:var(--twin-glass);border:1px solid var(--twin-line);border-radius:var(--twin-radius);padding:12px 14px;font-size:10px;line-height:1.7;backdrop-filter:blur(12px);max-width:290px}
.${ENGINE_CLASS} .twin-legend-body > summary{list-style:none;cursor:pointer;margin-bottom:5px;letter-spacing:.06em;text-transform:uppercase;font-size:9px;color:var(--twin-muted)}
.${ENGINE_CLASS} .twin-legend-body > summary::-webkit-details-marker{display:none}
.${ENGINE_CLASS} .twin-legend-body > summary::after{content:" ▾";opacity:.6}
.${ENGINE_CLASS} .twin-legend-body[open] > summary::after{content:" ▴"}
.${ENGINE_CLASS} .twin-legend .twin-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.${ENGINE_CLASS} .twin-legend li{list-style:none}
.${ENGINE_CLASS} .twin-legend ul{margin:0;padding:0}
.${ENGINE_CLASS} .twin-policy{margin-top:9px;border-top:1px solid var(--twin-line);padding-top:8px}
.${ENGINE_CLASS} .twin-policy summary{cursor:pointer;font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:var(--twin-muted)}
.${ENGINE_CLASS} .twin-policy ul.twin-blocked{margin:7px 0 0;padding-left:15px}
.${ENGINE_CLASS} .twin-policy ul.twin-blocked li{list-style:disc;line-height:1.5}
.${ENGINE_CLASS} .twin-policy p{margin:8px 0 0;line-height:1.5;color:var(--twin-muted)}

.${ENGINE_CLASS} .twin-tools{position:absolute;right:16px;bottom:16px;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;max-width:60%}
.${ENGINE_CLASS} .twin-tools button,.${ENGINE_CLASS} .twin-tools label{background:var(--twin-glass);border:1px solid var(--twin-line);border-radius:999px;padding:8px 11px;font-size:10px;cursor:pointer;backdrop-filter:blur(12px);font-family:inherit;color:var(--twin-ink);display:flex;align-items:center;gap:7px}
.${ENGINE_CLASS} .twin-tools button[aria-pressed="true"]{background:var(--twin-ink);color:#fff;border-color:var(--twin-ink)}
.${ENGINE_CLASS} .twin-tools input[type="range"]{width:118px}

.${ENGINE_CLASS} .twin-panel{position:absolute;right:16px;top:110px;bottom:70px;width:min(360px,calc(100% - 32px));background:rgba(247,244,236,.97);border:1px solid var(--twin-line);border-radius:18px;padding:20px;box-sizing:border-box;overflow:auto;transform:translateX(calc(100% + 24px));transition:transform .22s;backdrop-filter:blur(20px)}
.${ENGINE_CLASS} .twin-panel[data-open="true"]{transform:none}
.${ENGINE_CLASS} .twin-panel h2{font:500 25px/1.08 var(--twin-serif);margin:8px 0 10px}
.${ENGINE_CLASS} .twin-panel .twin-eyebrow{font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:var(--twin-muted)}
.${ENGINE_CLASS} .twin-panel .twin-badge{display:inline-block;color:#fff;font-size:9px;letter-spacing:.09em;padding:5px 9px;border-radius:999px}
.${ENGINE_CLASS} .twin-panel .twin-row{padding:10px 0;border-bottom:1px solid var(--twin-line);font-size:11px;line-height:1.55}
.${ENGINE_CLASS} .twin-panel .twin-row b{display:block;font-size:9px;letter-spacing:.09em;text-transform:uppercase;color:var(--twin-muted);margin-bottom:4px}
.${ENGINE_CLASS} .twin-panel ul{margin:0;padding-left:16px}
.${ENGINE_CLASS} .twin-panel pre{white-space:pre-wrap;word-break:break-word;font-size:9px;margin:0;color:#3d4a44}
.${ENGINE_CLASS} .twin-panel .twin-close{float:right;border:0;background:none;font-size:20px;line-height:1;cursor:pointer;color:var(--twin-ink)}

@media (max-width:900px){
  .${ENGINE_CLASS} .twin-panel{top:auto;bottom:0;left:0;right:0;width:auto;max-height:56%;border-radius:18px 18px 0 0;transform:translateY(calc(100% + 24px))}
  .${ENGINE_CLASS} .twin-panel[data-open="true"]{transform:none}
}

/* Phone layout. Nothing overlaps anything: brand and dock share the top row, stages scroll on
   the second, the legend collapses, and the tools own the bottom edge. */
@media (max-width:760px){
  .${ENGINE_CLASS} .twin-brand{left:12px;top:12px;max-width:44vw;font-size:9px;padding:8px 10px;letter-spacing:.08em}
  .${ENGINE_CLASS} .twin-dock{left:auto;right:12px;top:12px;transform:none;padding:4px;gap:2px}
  .${ENGINE_CLASS} .twin-dock button{padding:7px 8px;font-size:8px;letter-spacing:.04em}
  .${ENGINE_CLASS} .twin-steps{left:12px;right:12px;top:56px;transform:none;max-width:none;justify-content:flex-start;-webkit-overflow-scrolling:touch}
  .${ENGINE_CLASS} .twin-caption{display:none}
  .${ENGINE_CLASS} .twin-legend{left:12px;right:auto;bottom:64px;max-width:min(260px,72vw);max-height:44vh;overflow:auto;font-size:9px}
  .${ENGINE_CLASS} .twin-tools{left:12px;right:12px;bottom:12px;max-width:none;justify-content:space-between;gap:5px}
  .${ENGINE_CLASS} .twin-tools button,.${ENGINE_CLASS} .twin-tools label{padding:8px 9px;font-size:9px;gap:5px}
  .${ENGINE_CLASS} .twin-tools input[type="range"]{width:82px}
}
`;

export function installStyles(documentRef = document) {
  if (documentRef.getElementById(STYLE_ID)) return;
  const style = documentRef.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  documentRef.head.append(style);
}

export const ENGINE_CSS = CSS;
