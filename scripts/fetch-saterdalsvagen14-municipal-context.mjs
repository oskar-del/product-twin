import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(
  ROOT,
  ".runtime/sites/sweden/saterdalsvagen-14/raw",
);
const OUTPUT_PATH = path.join(
  OUTPUT_DIR,
  "municipal-fop-point-screen-2026-08-17.json",
);
const PAGE_PATH = path.join(
  OUTPUT_DIR,
  "municipal-oversiktsplanering-2026-08-17.html",
);

const LOCATOR = {
  role: "UNVERIFIED_MARKET_ADDRESS_LOCATOR",
  address: "Säterdalsvägen 14, 605 70 Svärtinge",
  crs: "EPSG:4326",
  longitude: 16.0317063331,
  latitude: 58.6522414431,
};

const SERVICE =
  "https://services-eu1.arcgis.com/ybtpypCYbjFNbjiX/arcgis/rest/services/F%C3%96P_Sv%C3%A4rtinge_Karta_Sam_WFL1/FeatureServer";

const LAYERS = [
  [39, "Proposed residential land use"],
  [96, "Extreme-rain areas"],
  [94, "BHF flood risk, other land"],
  [93, "BHF flood risk, built-up land"],
  [92, "100-year flood risk, other land"],
  [91, "100-year flood risk, built-up land"],
  [88, "Geotechnical zone 1"],
  [87, "Geotechnical zone 2"],
  [86, "Geotechnical zone 3"],
  [82, "Existing Glan water-protection area"],
  [70, "Local-interest nature value"],
  [67, "Municipal-interest nature value"],
  [68, "Regional-interest nature value"],
  [71, "National-interest nature value"],
  [69, "Kvillingeforkastningen nature reserve"],
  [66, "Ringstad mosse nature reserve"],
  [65, "Hermit-beetle priority landscape"],
  [61, "Potential future hermit-beetle corridor"],
  [62, "Existing hermit-beetle corridor"],
  [64, "Potential future hermit-beetle core"],
  [72, "Existing hermit-beetle core"],
  [59, "Municipal cultural environment"],
  [55, "National-interest nature conservation"],
  [54, "Natura 2000 birds"],
  [53, "Natura 2000 habitats"],
  [52, "National-interest cultural environment"],
  [51, "National-interest outdoor recreation"],
  [50, "Total-defence influence area"],
  [47, "Svartinge groundwater body"],
  [46, "Upper Svartinge groundwater body"],
];

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

async function fetchBytes(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "ProductTwin-SpatialStudio/0.1 evidence-capture" },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type"),
  };
}

async function assertAbsent(filePath) {
  try {
    await fs.access(filePath);
    throw new Error(`${path.relative(ROOT, filePath)} already exists; evidence captures are immutable`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

await fs.mkdir(OUTPUT_DIR, { recursive: true });
await Promise.all([assertAbsent(OUTPUT_PATH), assertAbsent(PAGE_PATH)]);

const pageUrl =
  "https://norrkoping.se/boende-trafik-och-miljo/planer-och-byggprojekt/oversiktsplanering";
const page = await fetchBytes(pageUrl);
await fs.writeFile(PAGE_PATH, page.bytes);

const observations = [];
for (const [layerId, layerLabel] of LAYERS) {
  const parameters = new URLSearchParams({
    f: "json",
    where: "1=1",
    geometry: `${LOCATOR.longitude},${LOCATOR.latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    returnGeometry: "false",
  });
  const requestUrl = `${SERVICE}/${layerId}/query?${parameters}`;
  const response = await fetchBytes(requestUrl);
  const body = JSON.parse(response.bytes.toString("utf8"));
  if (body.error) throw new Error(`Layer ${layerId}: ${JSON.stringify(body.error)}`);
  observations.push({
    layer_id: layerId,
    layer_label: layerLabel,
    request_url: requestUrl,
    response_content_type: response.contentType,
    response_sha256: sha256(response.bytes),
    response_byte_count: response.bytes.length,
    response: body,
  });
}

const capturedAt = new Date().toISOString();
const bundle = {
  schema_version: "0.1",
  capture_type: "MUNICIPAL_PUBLIC_DRAFT_FOP_POINT_SCREEN",
  authority: "Norrkopings kommun",
  municipal_plan_stage: "CONSULTATION_DRAFT_NOT_ADOPTED",
  captured_at: capturedAt,
  locator: LOCATOR,
  source_page: {
    url: pageUrl,
    runtime_locator: path.relative(ROOT, PAGE_PATH),
    content_type: page.contentType,
    sha256: sha256(page.bytes),
    byte_count: page.bytes.length,
  },
  source_webmap: {
    story_collection_item_id: "d29abaa7e6c64a8e9b2d0f0f1c0267bd",
    consideration_webmap_item_id: "eddba58d92ce4317b257c510e094ad85",
    land_use_webmap_item_id: "4833a8d9f07b47e9a1c8fbacb7e740e2",
    feature_service_item_id: "3446a9a533f8455fac933f626220a985",
  },
  observations,
  interpretation_limits: [
    "The queried coordinate is an address/market locator, not verified parcel geometry.",
    "A zero point intersection cannot establish absence across the parcel or a context buffer.",
    "The 2026 Svartinge FOP is a consultation proposal and is not property entitlement.",
    "No result changes the null legal boundary, buildable envelope, access, terrain or approval state.",
  ],
};

const serialized = Buffer.from(`${JSON.stringify(bundle, null, 2)}\n`);
await fs.writeFile(OUTPUT_PATH, serialized);

console.log(
  JSON.stringify(
    {
      output: path.relative(ROOT, OUTPUT_PATH),
      sha256: sha256(serialized),
      byte_count: serialized.length,
      source_page: bundle.source_page,
      non_empty_layers: observations
        .filter((entry) => entry.response.features?.length)
        .map((entry) => ({
          layer_id: entry.layer_id,
          label: entry.layer_label,
          feature_count: entry.response.features.length,
        })),
    },
    null,
    2,
  ),
);
