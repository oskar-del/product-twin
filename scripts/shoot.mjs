/**
 * Screenshot a live page over the Chrome DevTools Protocol.
 *
 * The twin surfaces run a continuous render loop, so Chrome's
 * --virtual-time-budget never exhausts and `--screenshot` hangs forever.
 * CDP lets us wait for an explicit readiness flag instead of a timer, which is
 * also what makes the shot deterministic: we capture a known state, not
 * "whatever had painted by second 14".
 *
 *   node scripts/shoot.mjs <url> <out.png> [--ready globalThis.roomsReady] [--w 1600] [--h 1000] [--settle 2500]
 */
import fs from "node:fs";
import path from "node:path";

const [url, out] = process.argv.slice(2);
if (!url || !out) {
  console.error("usage: node scripts/shoot.mjs <url> <out.png> [--ready <expr>] [--w N] [--h N] [--settle MS] [--port N]");
  process.exit(1);
}
const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : dflt;
};
const ready = arg("--ready", "globalThis.roomsReady === true");
const width = Number(arg("--w", 1600));
const height = Number(arg("--h", 1000));
const settle = Number(arg("--settle", 2500));
const port = Number(arg("--port", 9222));

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function cdpTarget() {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!res.ok) throw new Error(`cannot open target: HTTP ${res.status}`);
  return res.json();
}

const target = await cdpTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();

ws.addEventListener("message", ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
});
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", () => reject(new Error("CDP socket failed")), { once: true });
});

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});

const evaluate = async expression => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r.result?.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width, height, deviceScaleFactor: 2, mobile: false
});

// Wait for the page's own readiness flag rather than a fixed delay.
const deadline = Date.now() + 90000;
let ok = false;
while (Date.now() < deadline) {
  try { if (await evaluate(ready) === true) { ok = true; break; } } catch {}
  await sleep(400);
}
if (!ok) {
  console.error(`readiness expression never became true: ${ready}`);
  process.exitCode = 1;
}

await sleep(settle);
const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(shot.data, "base64"));

const bytes = fs.statSync(out).size;
console.log(`wrote ${out}  ${(bytes / 1024).toFixed(0)} KB  ${width}×${height}@2x  ready=${ok}`);

await send("Page.close").catch(() => {});
ws.close();
