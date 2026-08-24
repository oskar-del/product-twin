/**
 * Essence Moraira → twin-scene v0.1.
 *
 * The reference SITE ADAPTER: it does the joins only this site's owner can do (which IGN
 * elevation sample belongs to which Catastro parcel), and leaves everything generic to
 * engine/compile/*. Copy this file to start a new site; the parts worth copying are ~40 lines.
 *
 * Evidence discipline, because this compiles a real client's project:
 *   - parcel boundaries are AUTHORITATIVE (Catastro INSPIRE), and every projected ring is
 *     cross-checked against the area Catastro states for that parcel;
 *   - the terrain is DERIVED — 16 measured points interpolated, not surveyed;
 *   - NO villa massing is emitted, because the four Essence plots are NOT yet locked to
 *     cadastral parcels (see the pilot's catastro/README.md). Inventing four villas on
 *     provisional parcels is exactly the kind of confident-looking wrong picture this
 *     repository exists to prevent.
 *
 *   node scripts/compile-essence-site-scene.mjs --data <dir> [--out <scene.json>]
 *
 * <dir> holds the pilot's data/sites/essence-moraira JSON. Those files live on
 * `agent/essence-moraira-pilot`; on a branch without them, stage them and pass --data.
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {wgs84ToLocal} from "../engine/geo/local-enu.mjs";
import {projectFeature, checkStatedArea} from "../engine/compile/geo-polygons.mjs";
import {interpolateTerrainGrid, sampleHeightAt} from "../engine/compile/terrain-interpolation.mjs";
import {assembleScene, parcelElement} from "../engine/compile/scene-assembler.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) if (argv[i].startsWith("--")) options[argv[i].slice(2)] = argv[++i];
  return options;
}

const AREA_TOLERANCE = 0.05;
const TERRAIN_SIZE_M = 300;
const TERRAIN_SEGMENTS = 24;

export function compileEssenceScene({dataDir, generatedAt}) {
  const read = name => JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
  const boundaries = read("boundary-benicolet-parcels-wgs84-v0.1.geojson");
  const inventory = read("benicolet-parcel-inventory-v0.1.json");
  const terrain = read("terrain-mdt05-samples-v0.1.json");

  const originWgs84 = inventory.cluster_centroid_wgs84;
  const byRefcat = new Map(inventory.parcels.map(parcel => [parcel.refcat, parcel]));

  // ── terrain samples first: the parcels are draped onto them ──────────────────────────────
  const samples = terrain.samples
    .map(sample => {
      const record = byRefcat.get(sample.refcat);
      if (!record?.centroid_wgs84_lonlat) return null;
      const [x, z] = wgs84ToLocal({originWgs84, lonLat: record.centroid_wgs84_lonlat});
      return {x, z, elevation: sample.terrain_m};
    })
    .filter(Boolean);

  // ── parcels ───────────────────────────────────────────────────────────────────────────────
  const areaChecks = [];
  const elements = boundaries.features.map(feature => {
    const refcat = feature.properties.refcat;
    const record = byRefcat.get(refcat);
    const projected = projectFeature({feature, originWgs84});
    const check = checkStatedArea({
      projected,
      statedAreaM2: record?.plot_area_m2_catastro,
      tolerance: AREA_TOLERANCE
    });
    areaChecks.push({refcat, parcel_no: feature.properties.parcel_no, ...check});

    // A flat plate cannot sit on sloping ground. Draped at the centroid height, the uphill half
    // of every parcel here disappears under the terrain — these plots fall several metres. So
    // sample the ground around the whole boundary, place the plate at the HIGHEST point so the
    // full outline stays visible, and say in the limitations that it is not a level.
    const ringHeights = projected.ring.map(([x, z]) => sampleHeightAt({samples, x, z}).height);
    const groundMax = Math.max(...ringHeights);
    const groundMin = Math.min(...ringHeights);
    const fall = groundMax - groundMin;

    return parcelElement({
      id: `PARCEL_${refcat}`,
      label: `Parcel ${feature.properties.parcel_no} · ${refcat}`,
      type: "PLOT",
      evidenceClass: "AUTHORITATIVE",
      ring: projected.ring,
      heightM: 0.4,
      baseY: Number((groundMax + 0.15).toFixed(3)),
      areaM2: projected.area_m2,
      sourceRefs: ["SRC_CATASTRO_INSPIRE_CP", `CATASTRO_REFCAT_${refcat}`],
      limitations: [
        "Cadastral boundary as published by Catastro; not a surveyed legal boundary and not a title plan.",
        `Drawn as a flat plate at the highest interpolated ground point on its boundary so the whole outline stays visible; the interpolated ground falls ${fall.toFixed(1)} m across this parcel, and the plate is not a level.`,
        check.checked
          ? `Projected area ${check.computed_m2} m² against Catastro's stated ${check.stated_m2} m² (${(check.drift * 100).toFixed(2)} % difference).`
          : "No Catastro-stated area was available to cross-check this ring against.",
        ...(record?.cadastral_address ? [`Cadastral address on record: ${record.cadastral_address}.`] : []),
        ...(record?.record_year ? [`Catastro records ${record.built_m2_on_record ?? 0} m² built, year ${record.record_year}; the Essence re-parcelling and demolition have not propagated into Catastro.`] : [])
      ]
    });
  });

  // ── terrain, interpolated from IGN MDT05 point samples at parcel centroids ────────────────
  const surface = interpolateTerrainGrid({samples, size: TERRAIN_SIZE_M, segments: TERRAIN_SEGMENTS});
  elements.unshift({
    id: "TERRAIN_BENICOLET",
    type: "TERRAIN",
    label: "Derived terrain · IGN MDT05 5 m LiDAR",
    evidence_class: "DERIVED",
    geometry: surface.geometry,
    source_refs: ["SRC_IGN_MDT05_OGC_COVERAGES", "SRC_CATASTRO_INSPIRE_CP"],
    limitations: [...surface.limitations, terrain.source]
  });

  // ── assemble ─────────────────────────────────────────────────────────────────────────────
  const assembled = assembleScene({
    sceneId: "SCENE_ES_TEULADA_MORAIRA_ESSENCE_BENICOLET_V01",
    entityType: "SiteSceneExport",
    generatedAt,
    subject: {
      label: "Essence Moraira · Calle Benicolet block",
      developer: "Grupo Turis Promociones",
      municipality: "Teulada-Moraira",
      identity_evidence_class: "AUTHORITATIVE",
      identity_scope: "CADASTRAL_BLOCK_OBSERVATION_NOT_PROJECT_PLOT_ASSIGNMENT"
    },
    originWgs84,
    elements,
    horizontalReference: "EPSG:4326 origin (Catastro cluster centroid, ETRS89-derived)",
    verticalReference: "LOCAL_RELATIVE_TO_IGN_MDT05_SAMPLE_MEAN",
    coordinateLimitations: [
      "Local east/up/north frame on the Catastro cluster centroid; not survey control.",
      "Heights are relative to the mean of the IGN MDT05 samples, not to any finished floor level."
    ],
    sourceBindings: [
      {path: "data/sites/essence-moraira/boundary-benicolet-parcels-wgs84-v0.1.geojson", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "AUTHORITATIVE_PARCEL_GEOMETRY"},
      {path: "data/sites/essence-moraira/benicolet-parcel-inventory-v0.1.json", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "CADASTRAL_RECORD"},
      {path: "data/sites/essence-moraira/terrain-mdt05-samples-v0.1.json", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "DERIVED_TERRAIN_SAMPLES"}
    ],
    legalClaimPolicy: {
      visualisation_allowed: true,
      concept_design_allowed: false,
      blocked_claims: [
        "LEGAL_BOUNDARY", "REGISTERED_AREA", "ENTITLEMENT", "BUILDABLE_ENVELOPE",
        "LEGAL_ACCESS", "UTILITY_CAPACITY", "SURVEYED_TERRAIN", "FINISHED_FLOOR_LEVEL",
        "VILLA_TO_PARCEL_ASSIGNMENT"
      ],
      rule: "Cadastral block shown as published. The four Essence villa plots are NOT yet locked to cadastral parcels, so no villa is placed and no plot is labelled as a villa's."
    },
    studies: {
      solar: {
        evidence_class: "DERIVED",
        coordinate: originWgs84,
        date: "2026-06-21",
        interactive_hour_range: [6, 21],
        utc_offset_hours: 2,
        limitations: ["Analytical sun direction on derived terrain; no shading from vegetation or neighbouring built form."]
      }
    },
    navigationPlan: [
      {id: "BLOCK", label: "Benicolet block", types: ["TERRAIN", "PLOT"], bearing_deg: 215, elevation_deg: 34, labels: false},
      {id: "PARCELS", label: "Parcels", types: ["PLOT"], bearing_deg: 200, elevation_deg: 46, labels: true},
      {id: "TERRAIN", label: "Terrain", types: ["TERRAIN"], bearing_deg: 250, elevation_deg: 18, labels: false}
    ]
  });

  return {...assembled, areaChecks, terrainMetadata: surface.metadata};
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  const options = parseArgs(process.argv.slice(2));
  const dataDir = path.resolve(root, options.data ?? ".runtime/reference-data/essence");
  if (!fs.existsSync(dataDir)) {
    console.error(`Essence site data not found at ${dataDir}.`);
    console.error("These files live on agent/essence-moraira-pilot. Stage them and pass --data <dir>.");
    process.exit(2);
  }

  const result = compileEssenceScene({dataDir, generatedAt: new Date().toISOString()});
  const failed = result.areaChecks.filter(check => check.checked && !check.within_tolerance);
  const unchecked = result.areaChecks.filter(check => !check.checked);

  console.log(`compiled ${result.scene.scene_id}`);
  console.log(`  ${result.scene.elements.length} elements · ${result.scene.stages.length} stages · extents radius ${result.extents.radius_m.toFixed(0)} m`);
  console.log(`  parcel area cross-check: ${result.areaChecks.filter(c => c.checked && c.within_tolerance).length}/${result.areaChecks.filter(c => c.checked).length} within ${(AREA_TOLERANCE * 100).toFixed(0)} % of Catastro`);
  if (unchecked.length) console.log(`  NOT checked: ${unchecked.length} parcel(s) had no Catastro-stated area`);
  console.log(`  terrain: ${result.terrainMetadata.sample_count} IGN samples spanning ${result.terrainMetadata.sample_span_m} m, interpolated over ${TERRAIN_SIZE_M} m`);
  console.log("  no villa massing emitted: villa-to-parcel assignment is not evidenced");

  if (failed.length) {
    console.error(`  ${failed.length} parcel(s) disagree with Catastro beyond tolerance: ${failed.map(c => `${c.parcel_no} ${(c.drift * 100).toFixed(1)} %`).join(", ")}`);
    process.exit(1);
  }

  const outPath = path.resolve(root, options.out ?? ".runtime/essence-scene-v0.1.json");
  fs.mkdirSync(path.dirname(outPath), {recursive: true});
  fs.writeFileSync(outPath, `${JSON.stringify(result.document, null, 2)}\n`);
  console.log(`  → ${path.relative(root, outPath)}`);
}
