/**
 * INK CHROME — the stylesheet, for node-side consumers.
 *
 * Kept OUT of chrome.mjs on purpose. chrome.mjs is imported by browser code
 * (the runtime product panel) and bundled by esbuild with platform:browser; a
 * top-level `node:fs` import there fails the bundle outright. So the component
 * builders stay isomorphic and the only node-only thing — reading tokens.css
 * off disk — lives here.
 *
 * Browser pages link tokens.css instead of calling this.
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const TOKENS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "tokens.css");
let cached = null;

/** chromeCss() → tokens.css as text, for inlining into a self-contained page. */
export function chromeCss() {
  if (cached == null) cached = fs.readFileSync(TOKENS_PATH, "utf8");
  return cached;
}

/** Where tokens.css lives, for a consumer that wants to copy or link it. */
export const TOKENS_CSS_PATH = TOKENS_PATH;
