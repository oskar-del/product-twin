/**
 * Static server for the twin-engine demo.
 *
 * Serves the repository root so the demo can import /engine/*, /node_modules/three (the pinned
 * local copy, not a CDN) and /data/scenes/*. Module scripts and JSON fetches need real HTTP;
 * opening the file directly will not work.
 *
 *   npm run engine:demo   →  http://127.0.0.1:8181/prototype/twin-engine-demo/
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT ?? 8181);
const host = process.env.HOST ?? "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml"
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  let relative = decodeURIComponent(url.pathname);
  if (relative.endsWith("/")) relative += "index.html";
  const target = path.join(root, path.normalize(relative));

  if (!target.startsWith(root)) {
    response.writeHead(403).end("forbidden");
    return;
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    response.writeHead(404, {"content-type": "text/plain"}).end(`not found: ${relative}`);
    return;
  }
  response.writeHead(200, {
    "content-type": TYPES[path.extname(target)] ?? "application/octet-stream",
    "cache-control": "no-store"
  });
  fs.createReadStream(target).pipe(response);
});

server.listen(port, host, () => {
  console.log(`twin-engine demo  →  http://${host}:${port}/prototype/twin-engine-demo/`);
  console.log(`serving            ${root}`);
});
