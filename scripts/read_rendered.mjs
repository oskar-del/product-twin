/**
 * Read numbers off a live page over CDP, so a validator never has to be told them.
 *
 * Djurö's stale "26" is why this exists: a --rendered-N flag is a human retyping what they
 * believe the page says, which is precisely the thing under test. This opens the page, waits for
 * a readiness expression, evaluates one expression and prints the result as JSON.
 *
 *   node scripts/read_rendered.mjs <url> <expression> [--ready <expr>] [--port 9222] [--settle 1500]
 *
 * CDP plumbing after Platform's scripts/shoot.mjs.
 */
const [url, expression] = process.argv.slice(2);
if (!url || !expression) {
  console.error("usage: node scripts/read_rendered.mjs <url> <expression> [--ready <expr>] [--port N] [--settle MS]");
  process.exit(2);
}
const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : dflt;
};
const ready = arg("--ready", "true");
const port = Number(arg("--port", 9222));
const settle = Number(arg("--settle", 1500));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// A fresh URL every time: a cached document cannot be told from a current one, and this tool
// exists to answer exactly that question.
const bust = url + (url.includes("?") ? "&" : "?") + "cdp=" + Date.now();

const res = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(bust)}`, { method: "PUT" });
if (!res.ok) { console.error(`cannot open a CDP target on port ${port}: HTTP ${res.status}`); process.exit(2); }
const target = await res.json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let seq = 0; const pending = new Map();
ws.addEventListener("message", ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id); pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  }
});
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", () => reject(new Error("CDP socket failed")), { once: true });
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expr => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.value;
};
await send("Runtime.enable");

const deadline = Date.now() + 60000;
let ok = false;
while (Date.now() < deadline) {
  try { if (await evaluate(ready) === true) { ok = true; break; } } catch {}
  await sleep(300);
}
await sleep(settle);
const value = await evaluate(expression);
await send("Page.close").catch(() => {});
ws.close();

if (!ok) { console.error(`readiness never became true: ${ready}`); process.exit(3); }
console.log(JSON.stringify(value));
