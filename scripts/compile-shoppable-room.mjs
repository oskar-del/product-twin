/**
 * Shoppable room scene compiler.
 *
 * Reads twin records from data/twins/, places them per config/shoppable-rooms.json,
 * and emits a twin-scene/v0.1 document with commerce overlays on every element.
 * The scene is contract-valid and renders in the engine with click → product panel.
 *
 * BUY links come from the twin's commerce.affiliate_link VERBATIM — those are the
 * channel-tracked links that actually earn. A room built on an unapproved channel
 * (IKEA, for one) is a rendering with no revenue behind it, so the channel guard
 * below is a hard failure, not a warning.
 *
 *   node scripts/compile-shoppable-room.mjs [--room <id>|all] [--out path]
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {parseScene} from "../engine/core/scene-contract.mjs";
import {resolveComposition} from "../engine/compose/attach-resolver.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const twinsDir = path.join(root, "data/twins");
const roomsConfigPath = path.join(root, "config/shoppable-rooms.json");

const CONFIG = JSON.parse(fs.readFileSync(roomsConfigPath, "utf8"));
const APPROVED = new Set(CONFIG.approved_channels);

function loadTwin(twinId) {
  const p = path.join(twinsDir, `${twinId}.json`);
  if (!fs.existsSync(p)) throw new Error(`twin not found: ${twinId} (${path.relative(root, p)})`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** The channel a twin's revenue is tracked through, derived from its twin_id family. */
function channelOf(twin) {
  const m = /^PT_([A-Z0-9-]+)_/.exec(twin.twin_id ?? "");
  return m ? m[1].toLowerCase() : "unknown";
}

function formatDimensions(twin) {
  const d = twin.physical?.dimensions_mm;
  if (!d) return null;
  return `${d.width}×${d.depth}×${d.height} mm`;
}

function commerceFromTwin(twin) {
  const c = twin.commerce ?? {};
  const price = c.sale_price ?? c.unit_price ?? null;
  return {
    product_name: twin.identity?.name ?? twin.twin_id,
    brand: twin.identity?.manufacturer ?? null,
    merchant: c.merchant ?? null,
    product_url: c.product_url ?? null,
    // Channel-tracked, verbatim. Never rewritten, never substituted.
    buy_url: c.affiliate_link ?? null,
    image_url: twin.image?.primary_url ?? null,
    price,
    list_price: c.sale_price != null ? c.unit_price : null,
    currency: c.currency ?? null,
    category: twin.category_id ?? null,
    color: twin.appearance?.color ?? null,
    material: twin.appearance?.material ?? null,
    available: c.available ?? null,
    observed_at: c.observed_at ?? null,
    dimensions_label: formatDimensions(twin)
  };
}

const GEOMETRY_LEVEL_TO_EVIDENCE = {
  G0: "CONCEPT",
  G1: "REPORTED_UNVERIFIED",
  G2: "INDICATIVE",
  G3: "AUTHORITATIVE"
};

function twinElement(twin, placement, id) {
  const level = twin.geometry?.level ?? "G0";
  const dims = twin.physical?.dimensions_mm;
  const dimStr = dims ? ` (${dims.width}×${dims.depth}×${dims.height} mm)` : "";
  const derivedCat = twin.classification?.method === "DETERMINISTIC_TITLE_KEYWORD";

  return {
    id,
    type: "FURNITURE",
    label: `${twin.identity?.name ?? twin.twin_id}${dimStr}`.trim(),
    evidence_class: GEOMETRY_LEVEL_TO_EVIDENCE[level] ?? "CONCEPT",
    geometry: {
      primitive: "GLTF_ASSET",
      asset_path: twin.geometry.asset_path,
      position: placement.position,
      rotation_y_deg: placement.rotation_y_deg ?? 0
    },
    source_refs: [`Product Twin ${twin.twin_id}`, `Channel ${channelOf(twin)}`],
    limitations: [
      `Geometry level ${level}: ${twin.geometry.shape_claim ?? "proxy"}`,
      ...(twin.geometry.appearance?.exact_manufacturer_texture_or_finish_claimed === false
        ? ["Textures are representative, not manufacturer artwork."]
        : []),
      ...(derivedCat
        ? ["Category DERIVED from merchant title text, not a feed taxonomy field."]
        : []),
      "Price and availability observed at ingest — re-check live before quote or purchase."
    ],
    commerce: commerceFromTwin(twin)
  };
}

function roomShell(shell) {
  const [w, h, d] = shell.size;
  const half = Math.max(w, d) / 2 + 1;
  const elements = [
    {
      id: "ROOM_FLOOR",
      type: "TERRAIN",
      label: shell.open_air ? "Terrace deck" : "Room floor",
      evidence_class: "CONCEPT",
      geometry: {
        primitive: "GRID_SURFACE", size_m: half * 2, segments: 1,
        vertices: [[-half, 0, -half], [half, 0, -half], [-half, 0, half], [half, 0, half]],
        method: "FLAT", height_reference: "LOCAL_RELATIVE"
      },
      source_refs: ["SHOPPABLE_ROOM_COMPILER"],
      limitations: ["Synthetic room shell for product display."]
    },
    {
      id: "ROOM_VOLUME",
      type: "ROOM",
      label: shell.open_air ? "Terrace" : "Living room",
      evidence_class: "CONCEPT",
      geometry: {primitive: "ROOM_VOLUME", size: [w, h, d], position: [0, h / 2, 0], rotation_y_deg: 0, intended_use: shell.intended_use},
      source_refs: ["SHOPPABLE_ROOM_COMPILER"],
      limitations: ["Synthetic room for product display."]
    }
  ];
  if (shell.window) {
    elements.push({
      id: "ROOM_WINDOW",
      type: "OPENING",
      label: shell.window.label ?? "Window",
      evidence_class: "CONCEPT",
      geometry: {primitive: "BOX", size: shell.window.size, position: shell.window.position, rotation_y_deg: 0},
      source_refs: ["SHOPPABLE_ROOM_COMPILER"],
      limitations: ["Synthetic opening for light."]
    });
  }
  return elements;
}

export function buildRoom(roomDef) {
  const twinIndex = new Map();
  const problems = [];

  // A layout may place the same twin more than once (a pair of chairs), so the
  // element id — not the twin_id — is what identifies a placement.
  const placements = [];
  for (const item of roomDef.layout) {
    const twin = loadTwin(item.twin);
    const ch = channelOf(twin);
    if (!APPROVED.has(ch)) problems.push(`${twin.twin_id}: channel "${ch}" is not an approved channel`);
    if (!twin.commerce?.affiliate_link) problems.push(`${twin.twin_id}: no affiliate_link — BUY would earn nothing`);
    if (twin.geometry?.level !== "G2" && twin.geometry?.level !== "G3") {
      problems.push(`${twin.twin_id}: geometry level ${twin.geometry?.level ?? "none"} — no renderable proxy`);
    }
    const asset = path.join(root, twin.geometry?.asset_path ?? "");
    if (!fs.existsSync(asset)) problems.push(`${twin.twin_id}: asset missing at ${twin.geometry?.asset_path}`);
    twinIndex.set(twin.twin_id, twin);
    placements.push({id: item.id, twin, position: item.position, rotation_y_deg: item.rotation_y_deg ?? 0});
  }

  // Attached decor resolves its position from the base's slot geometry.
  const attachItems = [];
  for (const a of roomDef.attach ?? []) {
    const twin = loadTwin(a.twin);
    const ch = channelOf(twin);
    if (!APPROVED.has(ch)) problems.push(`${twin.twin_id}: channel "${ch}" is not an approved channel`);
    if (!twin.commerce?.affiliate_link) problems.push(`${twin.twin_id}: no affiliate_link — BUY would earn nothing`);
    twinIndex.set(twin.twin_id, twin);
    attachItems.push({twin_id: a.twin, attach_to: a.attach_to, slot_id: a.slot_id});
  }

  const baseItems = placements.map(p => ({twin_id: p.twin.twin_id, position: p.position, rotation_y_deg: p.rotation_y_deg}));
  const {positioned, errors} = resolveComposition({items: [...baseItems, ...attachItems], twinIndex});
  if (errors.length) problems.push(...errors.map(e => `attach-resolver: ${e}`));

  // Base elements keep their configured ids; attached ones are derived from the twin.
  const baseIds = new Set(placements.map(p => p.twin.twin_id));
  const usedBase = new Map();
  const furnitureElements = [];
  for (const item of positioned) {
    const tid = item.twin.twin_id;
    let id;
    if (baseIds.has(tid) && !attachItems.some(a => a.twin_id === tid)) {
      const seen = usedBase.get(tid) ?? 0;
      id = placements.filter(p => p.twin.twin_id === tid)[seen]?.id
        ?? `${tid}_${seen}`;
      usedBase.set(tid, seen + 1);
    } else {
      id = tid.replace(/^PT_/, "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
    }
    furnitureElements.push(twinElement(item.twin, {position: item.position, rotation_y_deg: item.rotation_y_deg}, id));
  }

  const scene = {
    scene_version: "twin-scene/v0.1",
    entity_type: "ShoppableRoomSceneExport",
    scene_id: roomDef.scene_id,
    generated_at: new Date().toISOString(),
    subject: {
      label: roomDef.label,
      identity_evidence_class: "CONCEPT",
      identity_scope: "SYNTHETIC_SHOPPABLE_ROOM"
    },
    commerce_channel: {
      channel: roomDef.channel,
      approved: APPROVED.has(roomDef.channel),
      buy_link_policy: "commerce.affiliate_link verbatim — channel-tracked; never rewritten or substituted",
      price_policy: "observed_at ingest; live re-check required before quote or purchase"
    },
    coordinate_system: {
      frame: "LOCAL_ENU",
      axes: {x: "EAST", y: "UP", z: "NORTH"},
      origin_wgs84: [0, 0],
      horizontal_reference: "SYNTHETIC — not a real location",
      vertical_reference: "LOCAL_RELATIVE_UNCALIBRATED",
      linear_units: "metre",
      evidence_class: "CONCEPT",
      limitations: ["Synthetic room — not a real site."]
    },
    source_bindings: [
      {path: "scripts/compile-shoppable-room.mjs", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "ROOM_COMPILER"},
      {path: "config/shoppable-rooms.json", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "ROOM_DEFINITION"},
      {path: "data/twins/", sha256: "RUNTIME_ONLY_NOT_COMMITTED", role: "PRODUCT_TWIN_CATALOG"}
    ],
    evidence_classes: ["AUTHORITATIVE", "INDICATIVE", "DERIVED", "REPORTED_UNVERIFIED", "CONCEPT"],
    legal_claim_policy: {
      visualisation_allowed: true,
      concept_design_allowed: true,
      blocked_claims: ["LEGAL_BOUNDARY", "REGISTERED_AREA", "ENTITLEMENT"],
      rule: "A shoppable room claims nothing about any real site. Product twins carry their own evidence classes for geometry fidelity."
    },
    presentation: {
      profiles: ["INTELLIGENCE", "REALISTIC", "SYSTEMS"],
      default_profile: "REALISTIC",
      default_stage: roomDef.navigation[0].id
    },
    navigation: roomDef.navigation,
    elements: [...roomShell(roomDef.shell), ...furnitureElements]
  };

  return {scene, problems};
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  const roomArg = process.argv.indexOf("--room");
  const wanted = roomArg !== -1 && process.argv[roomArg + 1] ? process.argv[roomArg + 1] : "all";
  const rooms = wanted === "all" ? CONFIG.rooms : CONFIG.rooms.filter(r => r.room_id === wanted);
  if (!rooms.length) {
    console.error(`no such room: ${wanted} (have ${CONFIG.rooms.map(r => r.room_id).join(", ")})`);
    process.exit(1);
  }

  let failed = false;
  for (const roomDef of rooms) {
    const {scene, problems} = buildRoom(roomDef);
    const parsed = parseScene(scene);

    const shoppable = parsed.elements.filter(e => e.commerce?.buy_url);
    const totalValue = shoppable.reduce((s, e) => s + (e.commerce.price ?? 0), 0);
    const currency = shoppable[0]?.commerce?.currency ?? "";

    const outputPath = path.join(root, `data/scenes/shoppable-room-${roomDef.room_id}/scene-v0.1.json`);
    fs.mkdirSync(path.dirname(outputPath), {recursive: true});
    fs.writeFileSync(outputPath, `${JSON.stringify(scene, null, 2)}\n`);

    console.log(`\n${roomDef.room_id} → ${path.relative(root, outputPath)}`);
    console.log(`  channel        ${roomDef.channel} (${APPROVED.has(roomDef.channel) ? "APPROVED" : "NOT APPROVED"})`);
    console.log(`  elements       ${parsed.elements.length} · ${shoppable.length} shoppable with BUY links`);
    console.log(`  basket value   ${totalValue.toLocaleString("sv-SE")} ${currency}`);
    console.log(`  stages         ${parsed.stages.length} · profiles ${parsed.presentation.profiles.join(", ")}`);
    if (problems.length) {
      failed = true;
      console.log(`  PROBLEMS (${problems.length}):`);
      for (const p of problems) console.log(`    ✗ ${p}`);
    } else {
      console.log("  gates          channel OK · every BUY is an affiliate_link · every proxy present");
    }
  }
  if (failed) process.exit(1);
}
