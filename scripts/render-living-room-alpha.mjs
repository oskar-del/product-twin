#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { once } from "node:events";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const MEDIA_DIR = "data/media/room-alpha/v0.1";
const OUTPUT_DIR = `${MEDIA_DIR}/outputs`;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FFMPEG = "/opt/homebrew/bin/ffmpeg";
const FFPROBE = "/opt/homebrew/bin/ffprobe";
const EXPECTED_ENVIRONMENT = {
  node: { version: "v22.14.0" },
  chrome: { version: "Google Chrome 151.0.7922.138", path: CHROME, sha256: "ee37661755341e9fc1babf9c20ec09d6a36e50aa8713ceb08082f8bbe2d8217d" },
  three: { version: "0.185.0", module_sha256: "bbf5ed13fe4373f5bd38b14ea8e62e9f157327da5638edc6d3863e08b167c9c7", core_sha256: "78b2c4218834ca8670547ed2315bfc21a00ff4dc3403bbffc8c31493d31d14de", gltf_loader_sha256: "97642d720f16cc9a0c9844934198e4d0c023bea8e89576d0f7545d03b2d103d2" },
  ffmpeg: { version_prefix: "ffmpeg version 8.1.2", path: FFMPEG, sha256: "882dc3dcaabd4262465def19f4eb0a2968f23ab9bbaeb8f2566a61c603e4ed43" },
  ffprobe: { version_prefix: "ffprobe version 8.1.2", path: FFPROBE, sha256: "1f87f6c4bf4f48b25000a1e0a0eb70dca93d17d3d6628749c69cff481d13cc78" }
};

const STILL_FILES = new Map([
  ["CAM_ROOM_ALPHA_CLEARANCE_V0_1", "verification/side-clearance.png"],
  ["CAM_ROOM_ALPHA_SELECTED_KIVIK_V0_1", "verification/selected-kivik.png"]
]);
const VIDEO_FILE = "room-control-20s.mp4";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function commandOutput(command, args, input = null) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: [input == null ? "ignore" : "pipe", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", reject);
    child.once("exit", (code) => {
      const out = Buffer.concat(stdout).toString("utf8");
      const err = Buffer.concat(stderr).toString("utf8");
      if (code === 0) resolve({ stdout: out, stderr: err });
      else reject(new Error(`${command} exited ${code}: ${err || out}`));
    });
    if (input != null) child.stdin.end(input);
  });
}

async function runnerDigest() {
  const files = [
    "scripts/render-living-room-alpha.mjs",
    "scripts/media/living-room-alpha-renderer-browser.mjs"
  ];
  const parts = await Promise.all(files.map((file) => readFile(path.join(ROOT, file))));
  return sha256(Buffer.concat(parts));
}

async function assertEnvironment({ video }) {
  if (process.version !== EXPECTED_ENVIRONMENT.node.version) throw new Error(`Node version mismatch: ${process.version}`);
  const threePackage = JSON.parse(await readFile(path.join(ROOT, "node_modules/three/package.json"), "utf8"));
  if (threePackage.version !== EXPECTED_ENVIRONMENT.three.version) throw new Error(`Three version mismatch: ${threePackage.version}`);
  const files = [
    [path.join(ROOT, "node_modules/three/build/three.module.js"), EXPECTED_ENVIRONMENT.three.module_sha256],
    [path.join(ROOT, "node_modules/three/build/three.core.js"), EXPECTED_ENVIRONMENT.three.core_sha256],
    [path.join(ROOT, "node_modules/three/examples/jsm/loaders/GLTFLoader.js"), EXPECTED_ENVIRONMENT.three.gltf_loader_sha256],
    [CHROME, EXPECTED_ENVIRONMENT.chrome.sha256]
  ];
  if (video) files.push([FFMPEG, EXPECTED_ENVIRONMENT.ffmpeg.sha256], [FFPROBE, EXPECTED_ENVIRONMENT.ffprobe.sha256]);
  for (const [file, expected] of files) {
    const actual = sha256(await readFile(file));
    if (actual !== expected) throw new Error(`Environment hash mismatch: ${file}`);
  }
  const chromeVersion = (await commandOutput(CHROME, ["--version"])).stdout.trim();
  if (chromeVersion !== EXPECTED_ENVIRONMENT.chrome.version) throw new Error(`Chrome version mismatch: ${chromeVersion}`);
  if (video) {
    const ffmpegVersion = (await commandOutput(FFMPEG, ["-version"])).stdout.split("\n")[0];
    const ffprobeVersion = (await commandOutput(FFPROBE, ["-version"])).stdout.split("\n")[0];
    if (!ffmpegVersion.startsWith(EXPECTED_ENVIRONMENT.ffmpeg.version_prefix) || !ffprobeVersion.startsWith(EXPECTED_ENVIRONMENT.ffprobe.version_prefix)) throw new Error("ffmpeg/ffprobe version mismatch");
  }
}

async function preflight() {
  const [scene, cameraPack, orientation] = await Promise.all([
    readJson("data/media/room-lab/v0.1/scene-manifest.json"),
    readJson(`${MEDIA_DIR}/camera-pack.json`),
    readJson("data/media/room-lab/v0.1/orientation-evidence.json")
  ]);
  if (sha256(await readFile(path.join(ROOT, "data/media/room-lab/v0.1/scene-manifest.json"))) !== "fc47dadcf08c4e8172d93b07397c4325851560da57d3c713f99a18065ee2b181") throw new Error("Frozen scene manifest hash mismatch");
  if (cameraPack.cameras.length !== 6) throw new Error("Alpha camera pack must contain six cameras");
  if (scene.rendering.loader_floor_contact_contract.orientation_gate_status !== "PASS") throw new Error("Orientation gate is not PASS");
  if (orientation.status !== "VERIFIED" || orientation.approval.state !== "APPROVED") throw new Error("Orientation evidence is not independently approved");
  const digest = await runnerDigest();
  await assertEnvironment({ video: false });
  return { runner_sha256: digest };
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(ROOT, relativePath), "utf8"));
}

function mimeType(file) {
  if (file.endsWith(".js") || file.endsWith(".mjs")) return "text/javascript";
  if (file.endsWith(".json")) return "application/json";
  if (file.endsWith(".glb")) return "model/gltf-binary";
  if (file.endsWith(".html")) return "text/html";
  return "application/octet-stream";
}

async function startServer() {
  const scene = await readJson("data/media/room-lab/v0.1/scene-manifest.json");
  const exactFiles = new Set([
    "data/media/room-lab/v0.1/scene-manifest.json",
    `${MEDIA_DIR}/camera-pack.json`,
    ...scene.placements.map((placement) => placement.avatar.asset_path)
  ]);
  const requests = [];
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'"><style>html,body{margin:0;padding:0;overflow:hidden;background:#e9e6dc}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/vendor/three.module.js","three/addons/":"/vendor/examples/jsm/"}}</script></head><body><canvas id="living-room-alpha-canvas"></canvas><script type="module" src="/renderer.mjs"></script></body></html>`;
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      requests.push(url.pathname);
      let bytes;
      let file = url.pathname;
      if (file === "/") bytes = Buffer.from(html);
      else if (file === "/favicon.ico") {
        response.writeHead(204, { "cache-control": "no-store" });
        response.end();
        return;
      }
      else if (file === "/renderer.mjs") bytes = await readFile(path.join(ROOT, "scripts/media/living-room-alpha-renderer-browser.mjs"));
      else if (file === "/vendor/three.module.js") bytes = await readFile(path.join(ROOT, "node_modules/three/build/three.module.js"));
      else if (file === "/vendor/three.core.js") bytes = await readFile(path.join(ROOT, "node_modules/three/build/three.core.js"));
      else if (file.startsWith("/vendor/examples/jsm/")) {
        const relative = file.slice("/vendor/".length);
        const resolved = path.resolve(ROOT, "node_modules/three", relative);
        const vendorRoot = path.resolve(ROOT, "node_modules/three/examples/jsm");
        if (!resolved.startsWith(`${vendorRoot}${path.sep}`)) throw new Error("Vendor path escape");
        bytes = await readFile(resolved);
      } else if (file.startsWith("/files/")) {
        const relative = decodeURIComponent(file.slice("/files/".length));
        if (!exactFiles.has(relative)) throw new Error(`File is outside the renderer allowlist: ${relative}`);
        bytes = await readFile(path.join(ROOT, relative));
      } else throw new Error(`Unknown renderer request: ${file}`);
      response.writeHead(200, { "content-type": file === "/" ? "text/html" : mimeType(file), "cache-control": "no-store", "x-content-type-options": "nosniff" });
      response.end(bytes);
    } catch (error) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end(error.message);
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return { server, origin: `http://127.0.0.1:${address.port}`, requests };
}

class CdpConnection {
  static async connect(url) {
    const instance = new CdpConnection(url);
    await instance.opened;
    return instance;
  }

  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(url);
    this.opened = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) ?? []) listener(message.params);
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 30000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function waitForDevTools(profile, child) {
  const activePort = path.join(profile, "DevToolsActivePort");
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (child.exitCode != null) throw new Error(`Chrome exited before DevTools became available: ${child.exitCode}`);
    try {
      const [port] = (await readFile(activePort, "utf8")).trim().split("\n");
      if (port) return Number(port);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await delay(50);
  }
  throw new Error("Timed out waiting for Chrome DevTools");
}

async function launchCapture(origin) {
  const profile = await mkdtemp(path.join(os.tmpdir(), "room-lab-chrome-"));
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--force-device-scale-factor=1",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-domain-reliability",
    "--disable-sync",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-features=MediaRouter,OptimizationHints,Translate",
    "--metrics-recording-only",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    "about:blank"
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const stderr = [];
  chrome.stderr.on("data", (chunk) => stderr.push(chunk));
  const port = await waitForDevTools(profile, chrome);
  const pageInfo = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" }).then((response) => response.json());
  const cdp = await CdpConnection.connect(pageInfo.webSocketDebuggerUrl);
  const networkUrls = [];
  const pageErrors = [];
  cdp.on("Network.requestWillBeSent", ({ request }) => networkUrls.push(request.url));
  cdp.on("Network.loadingFailed", ({ errorText, blockedReason }) => pageErrors.push(`network failed: ${errorText}${blockedReason ? ` (${blockedReason})` : ""}`));
  cdp.on("Network.responseReceived", ({ response }) => {
    if (response.status >= 400) pageErrors.push(`HTTP ${response.status}: ${response.url}`);
  });
  cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => pageErrors.push(exceptionDetails.exception?.description ?? exceptionDetails.text));
  cdp.on("Runtime.consoleAPICalled", ({ type, args }) => {
    if (type === "error") pageErrors.push(args.map((entry) => entry.value ?? entry.description).join(" "));
  });
  const cleanup = async () => {
    try { await cdp.send("Browser.close"); } catch {}
    cdp.close();
    if (chrome.exitCode == null) chrome.kill("SIGTERM");
    await Promise.race([new Promise((resolve) => chrome.once("exit", resolve)), delay(2000)]);
    if (chrome.exitCode == null) chrome.kill("SIGKILL");
    await rm(profile, { recursive: true, force: true });
  };
  await Promise.all([cdp.send("Page.enable"), cdp.send("Runtime.enable"), cdp.send("Network.enable")]);
  await cdp.send("Page.navigate", { url: `${origin}/` });
  const readyExpression = `new Promise((resolve,reject)=>{const started=Date.now();const poll=()=>{if(window.roomAlphaMedia?.ready)return resolve(true);if(Date.now()-started>30000)return reject(new Error('renderer ready timeout'));setTimeout(poll,25)};poll()})`;
  const ready = await cdp.send("Runtime.evaluate", { expression: readyExpression, awaitPromise: true, returnByValue: true });
  if (ready.exceptionDetails) {
    const details = [ready.exceptionDetails.exception?.description ?? ready.exceptionDetails.text, ...pageErrors, Buffer.concat(stderr).toString("utf8")].filter(Boolean).join("\n");
    await cleanup();
    throw new Error(details);
  }
  return {
    cdp,
    networkUrls,
    pageErrors,
    stderr,
    close: cleanup
  };
}

async function evaluate(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  return response.result.value;
}

function pngDimensions(bytes) {
  const signature = "89504e470d0a1a0a";
  if (bytes.subarray(0, 8).toString("hex") !== signature || bytes.toString("ascii", 12, 16) !== "IHDR") throw new Error("Captured artifact is not a valid PNG");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

async function capturePng(capture, method, args, width, height) {
  await capture.cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false, screenWidth: width, screenHeight: height });
  const result = await evaluate(capture.cdp, `window.roomAlphaMedia.${method}(...${JSON.stringify(args)})`);
  if (!result.pixels.all_opaque || !result.pixels.nonblank) throw new Error(`${method} produced invalid pixels`);
  const screenshot = await capture.cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  const bytes = Buffer.from(screenshot.data, "base64");
  const dimensions = pngDimensions(bytes);
  if (dimensions[0] !== width || dimensions[1] !== height) throw new Error(`PNG dimensions mismatch: ${dimensions.join("x")}`);
  return { bytes, sha256: sha256(bytes), result };
}

function assertLoopbackOnly(capture, origin) {
  const prohibited = capture.networkUrls.filter((url) => !url.startsWith(origin) && url !== "about:blank" && !url.startsWith("data:"));
  if (prohibited.length) throw new Error(`Non-loopback renderer request: ${prohibited.join(", ")}`);
  if (capture.pageErrors.length) throw new Error(`Browser exception: ${capture.pageErrors.join("; ")}`);
}

async function stillSpecs() {
  const cameras = (await readJson(`${MEDIA_DIR}/camera-pack.json`)).cameras;
  return [...STILL_FILES].map(([cameraId, file]) => {
    const camera = cameras.find((entry) => entry.camera_id === cameraId);
    if (!camera) throw new Error(`Missing alpha camera contract for ${cameraId}`);
    return { camera_id: cameraId, role: camera.role, visibility_policy: camera.visibility_policy, file, ...camera.resolution_px };
  });
}

async function captureStillsOnce(server, specs) {
  const capture = await launchCapture(server.origin);
  const records = [];
  try {
    for (const spec of specs) {
      const captured = await capturePng(capture, "renderCamera", [spec.camera_id, spec.width, spec.height], spec.width, spec.height);
      records.push({ ...spec, ...captured });
      process.stdout.write(`captured ${spec.role} ${spec.width}x${spec.height}\n`);
    }
    assertLoopbackOnly(capture, server.origin);
    return records;
  } finally {
    await capture.close();
  }
}

async function renderStills(preflightResult, server, overwrite) {
  const specs = await stillSpecs();
  const first = await captureStillsOnce(server, specs);
  const second = await captureStillsOnce(server, specs);
  for (let index = 0; index < first.length; index += 1) {
    if (first[index].sha256 !== second[index].sha256 || first[index].result.pixels.rgba_sha256 !== second[index].result.pixels.rgba_sha256) throw new Error(`Determinism mismatch: ${first[index].camera_id}`);
  }
  await mkdir(path.join(ROOT, OUTPUT_DIR), { recursive: true });
  const records = [];
  for (const entry of first) {
    const target = path.join(ROOT, OUTPUT_DIR, entry.file);
    await mkdir(path.dirname(target), { recursive: true });
    if (!overwrite) {
      try { await stat(target); throw new Error(`Refusing to overwrite ${target}`); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    await writeFile(target, entry.bytes);
    records.push({
      camera_id: entry.camera_id,
      role: entry.role,
      visibility_policy: entry.visibility_policy,
      uri: `${OUTPUT_DIR}/${entry.file}`,
      sha256: entry.sha256,
      rgba_sha256: entry.result.pixels.rgba_sha256,
      bytes: entry.bytes.length,
      dimensions_px: { width: entry.width, height: entry.height },
      duplicate_render_sha256: second.find((candidate) => candidate.camera_id === entry.camera_id).sha256,
      visible_placement_ids: entry.result.visible_placement_ids,
      camera_collision: entry.result.camera_collision,
      audit: entry.result.audit
    });
  }
  const run = {
    schema_version: "0.1.0",
    run_id: "LIVING_ROOM_ALPHA_NATIVE_STILLS_RUN_V0_1",
    runner_version: "LIVING_ROOM_ALPHA_RENDERER_V1",
    runner_sha256: preflightResult.runner_sha256,
    deterministic_duplicate_pass: true,
    network_policy: "LOOPBACK_ONLY",
    cost_usd: 0,
    environment: EXPECTED_ENVIRONMENT,
    outputs: records
  };
  await writeFile(path.join(ROOT, OUTPUT_DIR, "alpha-native-stills-run.json"), `${JSON.stringify(run, null, 2)}\n`);
  return run;
}

async function captureVideoFrames(server, encoders) {
  const frames = new Array(480);
  const batchSize = 48;
  for (let batchStart = 0; batchStart < 480; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, 480);
    let completed = false;
    let lastError;
    for (let attempt = 1; attempt <= 2 && !completed; attempt += 1) {
      const capture = await launchCapture(server.origin);
      const batchRecords = [];
      try {
        for (let frame = batchStart; frame < batchEnd; frame += 1) {
          const captured = await capturePng(capture, "renderFrame", [frame, 1920, 1080], 1920, 1080);
          batchRecords.push({ frame, bytes: captured.bytes, sha256: captured.sha256, rgba_sha256: captured.result.pixels.rgba_sha256, sample: captured.result.sample });
          if (frame % 24 === 0 || frame === 479) process.stdout.write(`video frames ${frame + 1}/480\n`);
        }
        assertLoopbackOnly(capture, server.origin);
        for (const record of batchRecords) {
          await Promise.all(encoders.map((encoder) => encoder.write(record.bytes)));
          frames[record.frame] = { frame: record.frame, sha256: record.sha256, rgba_sha256: record.rgba_sha256, sample: record.sample };
        }
        completed = true;
      } catch (error) {
        lastError = error;
        process.stdout.write(`retrying video batch ${batchStart}-${batchEnd - 1} after attempt ${attempt}\n`);
      } finally {
        await capture.close();
      }
    }
    if (!completed) throw new Error(`Video batch ${batchStart}-${batchEnd - 1} failed: ${lastError?.message}`);
  }
  if (frames.some((frame) => !frame)) throw new Error("Video frame set is incomplete");
  return frames;
}

async function verifyVideoSamples(server, frames) {
  const sampleFrames = [0, 120, 240, 360, 479];
  const capture = await launchCapture(server.origin);
  const samples = [];
  try {
    for (const frame of sampleFrames) {
      const captured = await capturePng(capture, "renderFrame", [frame, 1920, 1080], 1920, 1080);
      const expected = frames[frame];
      if (captured.sha256 !== expected.sha256 || captured.result.pixels.rgba_sha256 !== expected.rgba_sha256) throw new Error(`Independent frame mismatch: ${frame}`);
      samples.push({ frame, sha256: captured.sha256, rgba_sha256: captured.result.pixels.rgba_sha256 });
    }
    assertLoopbackOnly(capture, server.origin);
    return samples;
  } finally {
    await capture.close();
  }
}

function startVideoEncoder() {
  const child = spawn(FFMPEG, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "image2pipe",
    "-framerate", "24",
    "-i", "pipe:0",
    "-frames:v", "480",
    "-an",
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-threads", "1",
    "-color_primaries", "bt709",
    "-color_trc", "bt709",
    "-colorspace", "bt709",
    "-map_metadata", "-1",
    "-metadata", "creation_time=1970-01-01T00:00:00Z",
    "-movflags", "frag_keyframe+empty_moov+default_base_moof",
    "-f", "mp4",
    "pipe:1"
  ], { stdio: ["pipe", "pipe", "pipe"] });
  const stdout = [];
  const stderr = [];
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  const done = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(stderr).toString("utf8")}`)));
  });
  done.catch(() => {});
  return {
    async write(bytes) {
      if (!child.stdin.write(bytes)) await once(child.stdin, "drain");
    },
    async finish() {
      child.stdin.end();
      await done;
      return Buffer.concat(stdout);
    },
    abort() {
      child.stdin.destroy();
      if (child.exitCode == null) child.kill("SIGTERM");
    }
  };
}

async function probeVideo(file) {
  const output = await commandOutput(FFPROBE, ["-v", "error", "-count_frames", "-show_entries", "stream=index,codec_type,codec_name,pix_fmt,width,height,avg_frame_rate,nb_frames,nb_read_frames,duration:format=duration", "-of", "json", file]);
  const probe = JSON.parse(output.stdout);
  const video = probe.streams.filter((stream) => stream.codec_type === "video");
  const audio = probe.streams.filter((stream) => stream.codec_type === "audio");
  if (video.length !== 1 || audio.length !== 0) throw new Error("Video stream count/audio invariant failed");
  const stream = video[0];
  if (stream.codec_name !== "h264" || stream.pix_fmt !== "yuv420p" || stream.width !== 1920 || stream.height !== 1080 || stream.avg_frame_rate !== "24/1" || stream.nb_read_frames !== "480" || Math.abs(Number(stream.duration) - 20) > 1e-6 || Math.abs(Number(probe.format.duration) - 20) > 1e-6) throw new Error(`Video probe invariant failed: ${JSON.stringify(probe)}`);
  return probe;
}

async function renderVideo(preflightResult, server, overwrite) {
  const target = path.join(ROOT, OUTPUT_DIR, VIDEO_FILE);
  if (!overwrite) {
    try { await stat(target); throw new Error(`Refusing to overwrite ${target}`); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const encoders = [startVideoEncoder(), startVideoEncoder()];
    let frames;
    let encoded;
    try {
      frames = await captureVideoFrames(server, encoders);
      encoded = await Promise.all(encoders.map((encoder) => encoder.finish()));
    } catch (error) {
      encoders.forEach((encoder) => encoder.abort());
      throw error;
    }
    const independent_samples = await verifyVideoSamples(server, frames);
    const [firstBytes, secondBytes] = encoded;
    const firstHash = sha256(firstBytes);
    const secondHash = sha256(secondBytes);
    if (firstHash !== secondHash) throw new Error("Deterministic MP4 encode hashes differ");
    await mkdir(path.join(ROOT, OUTPUT_DIR), { recursive: true });
    const part = `${target}.part`;
    let probe;
    try {
      await writeFile(part, firstBytes);
      probe = await probeVideo(part);
      await rename(part, target);
    } catch (error) {
      await rm(part, { force: true });
      throw error;
    }
    const run = {
      schema_version: "0.1.0",
      run_id: "ROOM_LAB_CONTROL_VIDEO_RUN_V1",
      runner_version: "ROOM_LAB_MEDIA_RUNNER_V1",
      runner_sha256: preflightResult.runner_sha256,
      output: { output_asset_id: "OUTPUT_ROOM_CONTROL_VIDEO_V0_1", uri: `${OUTPUT_DIR}/${VIDEO_FILE}`, sha256: firstHash, bytes: firstBytes.length, dimensions_px: { width: 1920, height: 1080 }, duration_s: 20, frame_rate_fps: 24, frame_count: 480 },
      deterministic_duplicate_sha256: secondHash,
      independent_samples,
      frames,
      probe,
      network_policy: "LOOPBACK_ONLY",
      cost_usd: 0,
      environment: EXPECTED_ENVIRONMENT
    };
    await writeFile(path.join(ROOT, OUTPUT_DIR, "room-lab-video-run.json"), `${JSON.stringify(run, null, 2)}\n`);
    return run;
}

const args = new Set(process.argv.slice(2));
const overwrite = args.has("--overwrite");
const preflightResult = await preflight();
const server = await startServer();
try {
  const stills = await renderStills(preflightResult, server, overwrite);
  await writeFile(path.join(ROOT, MEDIA_DIR, "render-environment.json"), `${JSON.stringify({ schema_version: "0.1.0", runner_version: "LIVING_ROOM_ALPHA_RENDERER_V1", runner_sha256: preflightResult.runner_sha256, environment: EXPECTED_ENVIRONMENT }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ ok: true, native_stills: stills.outputs.length, provider_cost_usd: 0 })}\n`);
} catch (error) {
  throw new Error(`${error.message}\nLoopback requests:\n${server.requests.join("\n")}`);
} finally {
  await new Promise((resolve) => server.server.close(resolve));
}
