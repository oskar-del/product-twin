import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {parseScene} from "../engine/core/scene-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const basePath = "data/sites/sweden/saterdalsvagen-14/neighbourhood-scene-v0.2.json";
const patchPath = "OPEN AI/Säterdalsvägen 14 - Svärtinge/04-House-Design/BRAGE/geometry/house-in-scene-v0.3-patch.json";
const specPath = "OPEN AI/Säterdalsvägen 14 - Svärtinge/04-House-Design/BRAGE/geometry/house-v0.2-geometry-spec.json";
const commercePath = "data/integration/svartinge-glanrummet-commerce-v0.1.json";
const outputPath = "data/sites/sweden/saterdalsvagen-14/neighbourhood-scene-brage-v0.3.json";

const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const sha256 = relative => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex");
const round = (value, digits = 3) => Number(value.toFixed(digits));

function terrainHeight(scene, x, z) {
  const terrain = scene.elements.find(element => element.id === "TERRAIN_CONTEXT")?.geometry;
  if (!terrain || terrain.primitive !== "GRID_SURFACE") throw new Error("TERRAIN_CONTEXT GRID_SURFACE is required");
  const segments = terrain.segments;
  const step = terrain.size_m / segments;
  const half = terrain.size_m / 2;
  const fx = Math.min(segments, Math.max(0, (x + half) / step));
  const fz = Math.min(segments, Math.max(0, (z + half) / step));
  const ix = Math.min(segments - 1, Math.floor(fx));
  const iz = Math.min(segments - 1, Math.floor(fz));
  const tx = fx - ix;
  const tz = fz - iz;
  const at = (column, row) => terrain.vertices[row * (segments + 1) + column][1];
  return round(
    (at(ix, iz) * (1 - tx) + at(ix + 1, iz) * tx) * (1 - tz)
      + (at(ix, iz + 1) * (1 - tx) + at(ix + 1, iz + 1) * tx) * tz
  );
}

function polygonCentre(points) {
  return points.reduce((sum, [x, z]) => [sum[0] + x / points.length, sum[1] + z / points.length], [0, 0]);
}

function wallSegmentToBox(geometry, ground) {
  const [[x1, z1], [x2, z2]] = [geometry.from_xz, geometry.to_xz];
  const length = Math.hypot(x2 - x1, z2 - z1);
  return {
    primitive: "BOX",
    position: [round((x1 + x2) / 2), round(ground + geometry.height_m / 2), round((z1 + z2) / 2)],
    size: [round(length), geometry.height_m, geometry.thickness_m],
    rotation_y_deg: round(-Math.atan2(z2 - z1, x2 - x1) * 180 / Math.PI)
  };
}

function normalizeElement(scene, source) {
  const element = structuredClone(source);
  element.original_evidence_class = element.evidence_class;
  element.evidence_class = "CONCEPT";
  element.limitations = [
    "BRAGE concept geometry only; no planning, cadastral, structural, access, utility, foundation or buildability claim.",
    "The complete house is held rigid at one terrain sample; finished-floor level and earthworks remain unresolved.",
    ...(source.evidence_class === "CONCEPT_OPTIONAL" ? ["Optional phase only; excluded from the selected-house baseline."] : [])
  ];

  const geometry = structuredClone(source.geometry);
  if (geometry.primitive === "EXTRUDED_POLYGON") {
    const [x, z] = polygonCentre(geometry.points_xz);
    const ground = terrainHeight(scene, x, z);
    geometry.height = geometry.height ?? geometry.height_m ?? geometry.thickness_m;
    geometry.base_y = round(ground + (geometry.base_y ?? geometry.top_Y ?? 0));
    delete geometry.height_m;
    delete geometry.thickness_m;
    delete geometry.top_Y;
  } else if (geometry.primitive === "BOX" || geometry.primitive === "ROOM_VOLUME") {
    const [x, y, z] = geometry.position;
    geometry.position = [x, round(y + terrainHeight(scene, 1, 1)), z];
  } else if (geometry.primitive === "WALL_SEGMENT") {
    const x = (geometry.from_xz[0] + geometry.to_xz[0]) / 2;
    const z = (geometry.from_xz[1] + geometry.to_xz[1]) / 2;
    element.geometry = wallSegmentToBox(geometry, terrainHeight(scene, x, z));
    return element;
  }
  element.geometry = geometry;
  return element;
}

function updateNavigation(scene, ground) {
  const houseGroups = ["CONCEPT_BUILDING", "SERVICE_CORE", "INTERIOR_WALL", "ROOM", "OUTDOOR_DECK", "WINDBREAK", "OPTIONAL_OUTBUILDING"];
  return scene.navigation.map(stage => {
    const next = structuredClone(stage);
    if (["CONCEPT_HOUSE_ON_PLOT", "BUILDING_ORBIT", "ENTER_BUILDING", "ROOM"].includes(stage.id)) {
      next.visible_groups = [...new Set([...stage.visible_groups.filter(group => !["FURNITURE", "OPENING"].includes(group)), ...houseGroups])];
    }
    if (stage.id === "CONCEPT_HOUSE_ON_PLOT") {
      next.camera = [35, round(ground + 25), 38];
      next.target = [0, round(ground + 2), 2];
    } else if (stage.id === "BUILDING_ORBIT") {
      next.camera = [22, round(ground + 13), 21];
      next.target = [0, round(ground + 2), 2];
    } else if (stage.id === "ENTER_BUILDING") {
      next.camera = [7.5, round(ground + 1.75), 1.8];
      next.target = [-4.5, round(ground + 1.5), -0.5];
    } else if (stage.id === "ROOM") {
      next.label = "Enter Glanrummet";
      next.camera = [-9.6, round(ground + 1.65), 1.9];
      next.target = [-7.4, round(ground + 1.45), -3.2];
      next.on_enter_open_element = "ROOM_GLANRUMMET";
    }
    return next;
  });
}

export function buildIntegratedScene({base = read(basePath), patch = read(patchPath)} = {}) {
  if (base.scene_version !== "svartinge-neighbourhood-scene/v0.2") {
    throw new Error(`BRAGE patch requires v0.2 base, received ${base.scene_version}`);
  }
  const removals = new Set(patch.remove_elements);
  for (const id of removals) {
    if (!base.elements.some(element => element.id === id)) throw new Error(`BRAGE removal target is missing: ${id}`);
  }

  const retained = base.elements.filter(element => !removals.has(element.id));
  const additions = patch.add_elements.map(element => normalizeElement(base, element));
  const ground = terrainHeight(base, 1, 1);
  const room = additions.find(element => element.id === "ROOM_GLANRUMMET");
  room.linked_experience = {
    label: "Open Glanrummet furniture study",
    href: "../showroom-living/index.html?context=svartinge-glanrummet",
    manifest: commercePath,
    state: "DESIGN_STUDY_NOT_PROCUREMENT_READY"
  };

  const document = {
    ...structuredClone(base),
    scene_version: patch.produces_scene_version,
    scene_id: "SCENE_SE_NORRKOPING_SVARTINGE_54_28_BRAGE_V03",
    generated_at: "2026-08-24T00:00:00Z",
    source_bindings: [
      ...base.source_bindings,
      {path: patchPath, sha256: sha256(patchPath), role: "BRAGE_SCENE_PATCH"},
      {path: specPath, sha256: sha256(specPath), role: "BRAGE_GEOMETRY_SPEC"},
      {path: commercePath, sha256: sha256(commercePath), role: "ROOM_COMMERCE_HANDOFF"}
    ],
    navigation: updateNavigation(base, ground),
    elements: [...retained, ...additions],
    prototype: {
      ...base.prototype,
      viewer_hash: "#brage",
      default_step: "NEIGHBOURHOOD_VIEW"
    },
    project_status: {
      ...base.project_status,
      design_scenario: "BRAGE_VINKELHUSET_CONCEPT_ACTIVE_LEGAL_GATES_OPEN",
      selected_house_profile: "BRAGE_SE_SVARTINGE_54_28_HOUSE_V02"
    },
    integration: {
      state: "SPATIAL_HOUSE_ROOM_COMMERCE_HANDOFF_READY",
      room_id: "ROOM_GLANRUMMET",
      commerce_manifest: commercePath,
      blocked_promotions: ["LEGAL_BOUNDARY", "BUILDABLE_ENVELOPE", "FINISHED_FLOOR_LEVEL", "G3_AVATAR", "CURRENT_COMMERCE", "PUBLIC_NATIVE_GLBS"]
    }
  };
  parseScene(document);
  return document;
}

export function build() {
  const scene = buildIntegratedScene();
  fs.writeFileSync(path.join(root, outputPath), `${JSON.stringify(scene, null, 2)}\n`);
  return scene;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const scene = build();
  console.log(JSON.stringify({output: outputPath, scene_id: scene.scene_id, elements: scene.elements.length, selected_house_profile: scene.project_status.selected_house_profile}, null, 2));
}
