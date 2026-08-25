import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, ".runtime/sites/sweden/saterdalsvagen-14/raw");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "lst-ebh-context-2km-2026-08-17.geojson");
const longitude = 16.0317063331;
const latitude = 58.6522414431;
const service = "https://ext-geodata-nationella-visning.lansstyrelsen.se/arcgis/rest/services/LST/LST_Potentiellt_fororenade_omraden_EBH_EXT/MapServer/1/query";
const parameters = new URLSearchParams({
  f: "geojson",
  where: "1=1",
  geometry: `${longitude},${latitude}`,
  geometryType: "esriGeometryPoint",
  inSR: "4326",
  spatialRel: "esriSpatialRelIntersects",
  distance: "2000",
  units: "esriSRUnit_Meter",
  outFields: "*",
  returnGeometry: "true",
  outSR: "4326",
});
const requestUrl = `${service}?${parameters}`;

await fs.mkdir(OUTPUT_DIR, { recursive: true });
try {
  await fs.access(OUTPUT_PATH);
  throw new Error(`${path.relative(ROOT, OUTPUT_PATH)} already exists; evidence captures are immutable`);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const response = await fetch(requestUrl, {
  headers: { "user-agent": "ProductTwin-SpatialStudio/0.1 evidence-capture" },
});
if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${requestUrl}`);
const bytes = Buffer.from(await response.arrayBuffer());
const body = JSON.parse(bytes.toString("utf8"));
if (body.type !== "FeatureCollection" || !Array.isArray(body.features)) {
  throw new Error("EBH response is not a GeoJSON FeatureCollection");
}
await fs.writeFile(OUTPUT_PATH, bytes);

console.log(JSON.stringify({
  output: path.relative(ROOT, OUTPUT_PATH),
  request_url: requestUrl,
  captured_at: new Date().toISOString(),
  content_type: response.headers.get("content-type"),
  sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  byte_count: bytes.length,
  feature_count: body.features.length,
  object_ids: body.features.map((feature) => feature.properties?.Object_Id),
}, null, 2));
