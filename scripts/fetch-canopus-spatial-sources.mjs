import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve(".runtime/sites/canopus/raw");
const sources = [
  {
    file: "canopus-catastro.gml",
    sourceId: "SRC_CATASTRO_PARCEL_GML",
    url: "https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx?service=wfs&version=2&request=getfeature&STOREDQUERIE_ID=GetParcel&refcat=5410501UF2451S&srsname=EPSG::25830",
    verify: (bytes) => bytes.toString("latin1").includes("<cp:nationalCadastralReference>5410501UF2451S</cp:nationalCadastralReference>"),
  },
  {
    file: "canopus-catastro-reference-wgs84.xml",
    sourceId: "SRC_CATASTRO_REFERENCE_WGS84",
    url: "https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCoordenadas.svc/rest/Consulta_CPMRC?Provincia=&Municipio=&SRS=EPSG%3A4326&RefCat=5410501UF2451S",
    verify: (bytes) => bytes.toString("utf8").includes("<srs>EPSG:4326</srs>"),
  },
  {
    file: "canopus-catastro-capabilities.xml",
    sourceId: "SRC_CATASTRO_CAPABILITIES",
    url: "https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx?service=WFS&version=2.0.0&request=GetCapabilities",
    verify: (bytes) => bytes.toString("utf8").includes("WFS_Capabilities") && bytes.toString("utf8").includes("CadastralParcel"),
  },
  {
    file: "canopus-catastro-service-metadata.xml",
    sourceId: "SRC_CATASTRO_SERVICE_METADATA",
    url: "https://www.idee.es/csw-inspire-idee/srv/spa/csw?SERVICE=CSW&VERSION=2.0.2&REQUEST=GetRecordById&outputSchema=http%3A%2F%2Fwww.isotc211.org%2F2005%2Fgmd&ElementSetName=full&ID=ES_SDGC_CP_WFS",
    verify: (bytes) => bytes.toString("utf8").includes("ES_SDGC_CP_WFS"),
  },
  {
    file: "catastro-dataset-metadata.xml",
    sourceId: "SRC_CATASTRO_DATASET_METADATA",
    url: "https://www.idee.es/csw-inspire-idee/srv/spa/csw?SERVICE=CSW&VERSION=2.0.2&REQUEST=GetRecordById&outputSchema=http%3A%2F%2Fwww.isotc211.org%2F2005%2Fgmd&ElementSetName=full&ID=ES_SDGC_CP",
    verify: (bytes) => bytes.toString("utf8").includes("ES_SDGC_CP"),
  },
  {
    file: "canopus-mdt05-buffer1000-cog.tif",
    sourceId: "SRC_IGN_MDT05_COG",
    url: "https://api-coverages.idee.es/collections/EL.ElevationGridCoverage_25830_5_PB/coverage?bbox=324170,4039735,326505,4042050&bbox-crs=25830&f=COG",
    verify: (bytes) => bytes.length > 100_000 && ["II", "MM"].includes(bytes.subarray(0, 2).toString("ascii")),
  },
  {
    file: "ign-mdt05-ogc-collection.json",
    sourceId: "SRC_IGN_MDT05_COLLECTION_METADATA",
    url: "https://api-coverages.idee.es/collections/EL.ElevationGridCoverage_25830_5_PB",
    verify: (bytes) => JSON.parse(bytes.toString("utf8")).id === "EL.ElevationGridCoverage_25830_5_PB",
  },
  {
    file: "canopus-catastro-buildings-100m.gml",
    sourceId: "SRC_CATASTRO_BUILDINGS_GML",
    url: "https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx?service=wfs&version=2&request=getfeature&typenames=BU.BUILDING&bbox=325074,4040637,325603,4041145&srsname=EPSG::25830",
    verify: (bytes) => bytes.toString("latin1").includes("<bu-ext2d:Building"),
  },
  {
    file: "canopus-roadlink-context.geojson",
    sourceId: "SRC_IDEE_ROADLINK_GEOJSON",
    url: "https://api-features.idee.es/collections/roadlink/items?bbox=-4.9615,36.4882,-4.9389,36.5062&limit=1000&f=json",
    verify: (bytes) => {
      const value = JSON.parse(bytes.toString("utf8"));
      return value.type === "FeatureCollection" && value.numberReturned > 0;
    },
  },
];

await fs.mkdir(outputDir, { recursive: true });
const downloaded = [];
const results = [];
for (const source of sources) {
  const response = await fetch(source.url, { headers: { "user-agent": "product-twin-spatial-evidence/0.2" } });
  if (!response.ok) throw new Error(`${source.file}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!source.verify(bytes)) throw new Error(`${source.file}: response signature/identity check failed`);
  downloaded.push({
    source,
    bytes,
    receipt: {
      source_id: source.sourceId,
      request_url: source.url,
      retrieved_at: new Date().toISOString(),
      byte_count: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      http: {
        status: response.status,
        content_type: response.headers.get("content-type") ?? "application/octet-stream",
        etag: response.headers.get("etag"),
        last_modified: response.headers.get("last-modified"),
      },
    },
  });
}
for (const { source } of downloaded) {
  await fs.access(path.join(outputDir, source.file)).then(() => {
    throw new Error(`${source.file}: immutable runtime source already exists; compare hashes before replacing it`);
  }).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
}
await fs.access(path.join(outputDir, "fetch-receipts.json")).then(() => {
  throw new Error("fetch-receipts.json: immutable runtime receipt already exists; use a new empty runtime directory");
}).catch((error) => {
  if (error.code !== "ENOENT") throw error;
});
for (const { source, bytes } of downloaded) {
  await fs.writeFile(path.join(outputDir, source.file), bytes, { flag: "wx" }).catch((error) => {
    if (error.code !== "EEXIST") throw error;
    throw new Error(`${source.file}: immutable runtime source already exists; compare hashes before replacing it`);
  });
  results.push({ file: source.file, bytes: bytes.length, url: source.url });
}
await fs.writeFile(
  path.join(outputDir, "fetch-receipts.json"),
  `${JSON.stringify({ schema_version: "0.2", sources: downloaded.map(({ receipt }) => receipt) }, null, 2)}\n`,
  { flag: "wx" },
);

console.log(JSON.stringify({ status: "PASS", output_dir: outputDir, sources: results }, null, 2));
