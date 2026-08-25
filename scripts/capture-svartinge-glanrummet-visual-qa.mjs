#!/usr/bin/env node

import {createHash} from "node:crypto";
import {spawn, spawnSync} from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {renderPlan} from "./render-svartinge-glanrummet-visual-plan.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const qa = JSON.parse(fs.readFileSync(path.join(root, "data/showrooms/svartinge-glanrummet-visual-qa-v0.1.json"), "utf8"));
const outputDir = path.resolve(root, process.env.VISUAL_QA_OUTPUT || ".runtime/visual-qa/svartinge-glanrummet-v0.3");
const planOnly = process.argv.includes("--plan-only");
const visualQaRoot = path.join(root, ".runtime/visual-qa");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function findChrome() {
  const candidates = [
    process.env.VISUAL_QA_CHROME,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);
  return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

function command(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {cwd: root, stdio: ["ignore", "pipe", "pipe"]});
    const stdout = [];
    const stderr = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${path.basename(command)} timed out after 45 seconds`));
    }, 45000);
    child.stdout.on("data", chunk => stdout.push(chunk));
    child.stderr.on("data", chunk => stderr.push(chunk));
    child.once("error", reject);
    child.once("exit", code => {
      clearTimeout(timer);
      const out = Buffer.concat(stdout).toString("utf8");
      const err = Buffer.concat(stderr).toString("utf8");
      if (code === 0) resolve({stdout: out, stderr: err});
      else reject(new Error(`${path.basename(command)} exited ${code}: ${err || out}`));
    });
  });
}

class CdpConnection {
  static async connect(url) {
    const connection = new CdpConnection(url);
    await connection.opened;
    return connection;
  }

  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(url);
    this.opened = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, {once: true});
      this.socket.addEventListener("error", reject, {once: true});
    });
    this.socket.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 30000);
      this.pending.set(id, {resolve, reject, timer});
      this.socket.send(JSON.stringify({id, method, params}));
    });
  }

  close() {
    this.socket.close();
  }
}

async function waitForDevTools(profile, child) {
  const activePort = path.join(profile, "DevToolsActivePort");
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (child.exitCode != null) throw new Error(`Chrome exited before DevTools was ready: ${child.exitCode}`);
    try {
      const [port] = fs.readFileSync(activePort, "utf8").trim().split("\n");
      if (port) return Number(port);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("Chrome DevTools did not become ready within 15 seconds");
}

async function openChromeCapture(chrome, viewId) {
  const profile = profileDir(viewId, "cdp");
  const child = spawn(chrome, [
    "--headless=new",
    "--no-sandbox",
    "--hide-scrollbars",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--run-all-compositor-stages-before-draw",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0",
    `--window-size=${qa.viewport.width_px},${qa.viewport.height_px}`,
    `--user-data-dir=${profile}`,
    "about:blank"
  ], {cwd: root, stdio: ["ignore", "ignore", "pipe"]});
  const stderr = [];
  child.stderr.on("data", chunk => stderr.push(chunk));
  try {
    const port = await waitForDevTools(profile, child);
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
    const target = targets.find(candidate => candidate.type === "page");
    if (!target?.webSocketDebuggerUrl) throw new Error("Chrome page target is unavailable");
    const cdp = await CdpConnection.connect(target.webSocketDebuggerUrl);
    return {profile, child, cdp, stderr};
  } catch (error) {
    child.kill("SIGKILL");
    fs.rmSync(profile, {recursive: true, force: true});
    throw error;
  }
}

async function closeChromeCapture(session) {
  session.cdp.close();
  if (session.child.exitCode == null) session.child.kill("SIGTERM");
  await new Promise(resolve => {
    if (session.child.exitCode != null) resolve();
    else {
      const timer = setTimeout(() => { session.child.kill("SIGKILL"); resolve(); }, 3000);
      session.child.once("exit", () => { clearTimeout(timer); resolve(); });
    }
  });
  fs.rmSync(session.profile, {recursive: true, force: true});
}

function startServer() {
  const server = http.createServer((request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      let requested = decodeURIComponent(url.pathname);
      if (requested === "/") requested = "/prototype/showroom-living/index.html";
      const target = path.resolve(root, `.${requested}`);
      if (!target.startsWith(`${root}${path.sep}`) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
        response.writeHead(404, {"content-type": "text/plain; charset=utf-8"});
        response.end("Not found");
        return;
      }
      response.writeHead(200, {
        "content-type": mime[path.extname(target).toLowerCase()] || "application/octet-stream",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff"
      });
      fs.createReadStream(target).pipe(response);
    } catch (error) {
      response.writeHead(500, {"content-type": "text/plain; charset=utf-8"});
      response.end(error.message);
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function pngDimensions(bytes) {
  if (bytes.length < 24 || bytes.subarray(1, 4).toString("ascii") !== "PNG") throw new Error("Capture is not a PNG");
  return {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
}

function profileDir(view, phase) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `product-twin-${view}-${phase}-`));
}

export async function captureReadyPage({cdp, url, view, qaContract = qa, pollIntervalMs = 100, timeoutMs = 30000}) {
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: qaContract.viewport.width_px,
    height: qaContract.viewport.height_px,
    deviceScaleFactor: qaContract.viewport.device_scale_factor,
    mobile: false
  });
  await cdp.send("Page.navigate", {url});
  let state = null;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const result = await cdp.send("Runtime.evaluate", {
        expression: "JSON.stringify(window.__PRODUCT_TWIN_VISUAL_QA__ || null)",
        returnByValue: true
      });
      state = JSON.parse(result.result?.value || "null");
      if (state?.state === "ready" || state?.state === "failed") break;
    } catch {
      // The execution context can change once while navigation commits.
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  if (!state) throw new Error(`${view.id} readiness timed out`);
  if (state.state !== "ready") throw new Error(`${view.id} readiness failed: ${JSON.stringify(state)}`);
  if (state.view !== view.id || state.loaded !== qaContract.acceptance.placed_product_count || state.assetLoadFailures.length !== 0 || state.clippedTags !== 0) {
    throw new Error(`${view.id} readiness contract mismatch: ${JSON.stringify(state)}`);
  }
  await cdp.send("Runtime.evaluate", {
    expression: "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
    awaitPromise: true
  });
  const captured = await cdp.send("Page.captureScreenshot", {format: "png", fromSurface: true, captureBeyondViewport: false});
  return {state, captured};
}

async function captureView({chrome, origin, view}) {
  const url = `${origin}/prototype/showroom-living/index.html?context=svartinge-glanrummet&qa=1&view=${encodeURIComponent(view.id)}`;
  const session = await openChromeCapture(chrome, view.id);
  try {
    const {state, captured} = await captureReadyPage({cdp: session.cdp, url, view});
    const screenshotPath = path.join(outputDir, `${view.id}.png`);
    const bytes = Buffer.from(captured.data, "base64");
    fs.writeFileSync(screenshotPath, bytes);
    const dimensions = pngDimensions(bytes);
    if (dimensions.width !== qa.viewport.width_px || dimensions.height !== qa.viewport.height_px) {
      throw new Error(`${view.id} viewport mismatch: ${dimensions.width}x${dimensions.height}`);
    }
    return {id: view.id, label: view.label, path: path.relative(root, screenshotPath), sha256: sha256(bytes), bytes: bytes.length, dimensions, readiness: state};
  } finally {
    await closeChromeCapture(session);
  }
}

function evidenceInputs() {
  const tracked = [
    "data/showrooms/svartinge-glanrummet-living-room-v0.3.json",
    "data/showrooms/svartinge-glanrummet-visual-qa-v0.1.json",
    "data/showrooms/norr11-marbella-living-room-v0.1.json",
    "data/geometry/native-3d-showcase-manifest.json",
    "prototype/showroom-living/index.html",
    "prototype/showroom-living/visual-framing.mjs",
    "prototype/showroom-living/vendor/three.module.js",
    "prototype/showroom-living/vendor/addons/controls/OrbitControls.js",
    "prototype/showroom-living/vendor/addons/loaders/GLTFLoader.js",
    "prototype/showroom-living/vendor/addons/environments/RoomEnvironment.js",
    "scripts/capture-svartinge-glanrummet-visual-qa.mjs",
    "scripts/render-svartinge-glanrummet-visual-plan.mjs"
  ];
  const base = JSON.parse(fs.readFileSync(path.join(root, tracked[2]), "utf8"));
  const native = JSON.parse(fs.readFileSync(path.join(root, tracked[3]), "utf8"));
  const runtime = new Set();
  for (const product of base.products) runtime.add(product.avatar.runtime_glb || product.avatar.asset_path);
  for (const entry of native.entries || []) if (entry.glb?.runtime_path) runtime.add(entry.glb.runtime_path);
  return [
    ...tracked.map(relative => ({kind: "tracked", path: relative, sha256: sha256(fs.readFileSync(path.join(root, relative)))})),
    ...[...runtime].sort().map(relative => {
      const absolute = path.join(root, relative);
      return {kind: "runtime", path: relative, state: fs.existsSync(absolute) ? "PRESENT" : "MISSING", sha256: fs.existsSync(absolute) ? sha256(fs.readFileSync(absolute)) : null};
    })
  ];
}

export async function capture() {
  if (!outputDir.startsWith(`${visualQaRoot}${path.sep}`)) throw new Error(`Unsafe visual QA output directory: ${outputDir}`);
  fs.rmSync(outputDir, {recursive: true, force: true});
  fs.mkdirSync(outputDir, {recursive: true});
  const generatedAt = new Date().toISOString();
  const inputs = evidenceInputs();
  fs.writeFileSync(path.join(outputDir, "run-state.json"), `${JSON.stringify({state: "RUNNING", generated_at: generatedAt, inputs}, null, 2)}\n`);
  const plan = renderPlan();
  if (planOnly) {
    const report = {state: "PLAN_ONLY", generated_at: generatedAt, inputs, plan};
    fs.writeFileSync(path.join(outputDir, "plan-report.json"), `${JSON.stringify(report, null, 2)}\n`);
    fs.rmSync(path.join(outputDir, "run-state.json"), {force: true});
    return report;
  }
  let server = null;
  try {
    const chrome = findChrome();
    if (!chrome) {
      throw new Error("Chrome not found. On macOS use the standard Google Chrome install, or set VISUAL_QA_CHROME to the exact executable path. The deterministic plan was still generated.");
    }
    server = await startServer();
    const address = server.address();
    const origin = `http://127.0.0.1:${address.port}`;
    const views = [];
    for (const view of qa.views) views.push(await captureView({chrome, origin, view}));
    const chromeVersionResult = await command(chrome, ["--version"]);
    const chromeVersion = (chromeVersionResult.stdout || chromeVersionResult.stderr).trim();
    const gitCommit = spawnSync("git", ["rev-parse", "HEAD"], {cwd: root, encoding: "utf8"}).stdout.trim();
    const report = {
      version: "svartinge-glanrummet-visual-qa-run/v0.1",
      qa_id: qa.qa_id,
      composition_manifest: qa.composition_manifest,
      generated_at: generatedAt,
      git_commit: gitCommit,
      inputs,
      capture_state: "CAPTURED_AWAITING_HUMAN_PIXEL_REVIEW",
      publication_state: "BLOCK",
      chrome: {path: chrome, version: chromeVersion},
      viewport: qa.viewport,
      views,
      plan: {
        svg: path.relative(root, plan.svgPath),
        png: plan.pngPath ? path.relative(root, plan.pngPath) : null
      }
    };
    fs.writeFileSync(path.join(outputDir, "capture-report.json"), `${JSON.stringify(report, null, 2)}\n`);
    fs.rmSync(path.join(outputDir, "run-state.json"), {force: true});
    return report;
  } catch (error) {
    fs.writeFileSync(path.join(outputDir, "capture-failure.json"), `${JSON.stringify({state: "FAILED", generated_at: generatedAt, error: error.message, inputs}, null, 2)}\n`);
    fs.rmSync(path.join(outputDir, "run-state.json"), {force: true});
    throw error;
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  capture().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
