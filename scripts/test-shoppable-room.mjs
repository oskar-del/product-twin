/**
 * Shoppable room gate.
 *
 * Runs every room in config/shoppable-rooms.json. The commerce checks are the
 * point of this gate: a room that renders beautifully on an unapproved channel,
 * or whose BUY buttons are plain product links, earns nothing — so those are
 * failures here, not warnings.
 *
 *   node scripts/test-shoppable-room.mjs
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {buildRoom} from "./compile-shoppable-room.mjs";
import {parseScene} from "../engine/core/scene-contract.mjs";
import {productPanel, shoppablePanels} from "../engine/ui/product-panel.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(root, "config/shoppable-rooms.json"), "utf8"));
const APPROVED = new Set(CONFIG.approved_channels);

// Channels we must never ship a BUY link to, whatever the room config says.
const FORBIDDEN_HOSTS = [/ikea\.com/i];

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) { passed++; }
  else { failed++; console.error(`FAIL  ${label}`); }
}

check("at least two rooms defined", CONFIG.rooms.length >= 2);

for (const roomDef of CONFIG.rooms) {
  console.log(`\n══ ${roomDef.room_id}`);

  let scene, parsed, problems;
  try {
    ({scene, problems} = buildRoom(roomDef));
    parsed = parseScene(scene);
    check(`${roomDef.room_id}: scene parses without violations`, true);
  } catch (e) {
    check(`${roomDef.room_id}: scene parses: ${e.message}`, false);
    continue;
  }

  // §0 Compiler gates
  console.log("§0 compiler gates");
  check(`${roomDef.room_id}: compiler reports no problems`, problems.length === 0);
  for (const p of problems) console.error(`      ${p}`);

  // §1 Scene contract compliance
  console.log("§1 scene contract compliance");
  check(`${roomDef.room_id}: scene_id matches config`, parsed.scene_id === roomDef.scene_id);
  check(`${roomDef.room_id}: at least 8 elements`, parsed.elements.length >= 8);
  check(`${roomDef.room_id}: at least 3 stages`, parsed.stages.length >= 3);
  check(`${roomDef.room_id}: default profile is REALISTIC`, parsed.presentation.default_profile === "REALISTIC");

  // §2 Furniture elements
  console.log("§2 furniture elements");
  const furniture = parsed.elements.filter(e => e.type === "FURNITURE");
  check(`${roomDef.room_id}: at least 7 furniture elements`, furniture.length >= 7);
  for (const el of furniture) {
    check(`${el.id} has GLTF_ASSET primitive`, el.geometry.primitive === "GLTF_ASSET");
    check(`${el.id} has asset_path`, typeof el.geometry.asset_path === "string" && el.geometry.asset_path.length > 0);
    check(`${el.id} asset file exists`, fs.existsSync(path.join(root, el.geometry.asset_path)));
    check(`${el.id} has position`, Array.isArray(el.geometry.position) && el.geometry.position.length === 3);
    check(`${el.id} evidence class is valid`, ["CONCEPT", "REPORTED_UNVERIFIED", "INDICATIVE", "AUTHORITATIVE"].includes(el.evidence_class));
  }

  // §3 Commerce — the revenue gates
  console.log("§3 commerce (revenue gates)");
  check(`${roomDef.room_id}: channel is approved`, APPROVED.has(scene.commerce_channel.channel));

  const commerceElements = scene.elements.filter(e => e.commerce);
  check(`${roomDef.room_id}: at least 7 elements have commerce`, commerceElements.length >= 7);

  for (const el of commerceElements) {
    const c = el.commerce;
    check(`${el.id} has product_name`, typeof c.product_name === "string" && c.product_name.length > 0);
    check(`${el.id} has a BUY url`, typeof c.buy_url === "string" && c.buy_url.length > 0);
    check(`${el.id} BUY url is channel-tracked`, /cupa_sku=/.test(c.buy_url ?? ""));
    check(`${el.id} BUY url is not a forbidden channel`, !FORBIDDEN_HOSTS.some(rx => rx.test(c.buy_url ?? "")));
    check(`${el.id} has a price`, typeof c.price === "number" && c.price > 0);
    check(`${el.id} has a currency`, typeof c.currency === "string" && c.currency.length > 0);
    check(`${el.id} carries a live-recheck limitation`, el.limitations.some(l => /re-check live/i.test(l)));
  }

  // §4 Product panel extraction
  console.log("§4 product panel extraction");
  const panels = shoppablePanels(parsed);
  check(`${roomDef.room_id}: shoppablePanels returns a Map`, panels instanceof Map);
  check(`${roomDef.room_id}: at least 7 panels`, panels.size >= 7);
  for (const [id, panel] of panels) {
    check(`panel ${id} has element_id`, panel.element_id === id);
    check(`panel ${id} has product_name`, typeof panel.product_name === "string");
    check(`panel ${id} has evidence_class`, typeof panel.evidence_class === "string");
    check(`panel ${id} has buy_url`, Boolean(panel.buy_url));
  }

  // §5 Non-shoppable elements don't produce panels
  console.log("§5 non-shoppable elements");
  const nonShoppable = parsed.elements.filter(e => !e.commerce);
  check(`${roomDef.room_id}: room shell elements exist`, nonShoppable.length >= 2);
  for (const el of nonShoppable) {
    check(`${el.id} returns null panel`, productPanel(el) === null);
  }

  // §6 Room shell
  console.log("§6 room shell");
  check(`${roomDef.room_id}: has floor`, parsed.elements.some(e => e.type === "TERRAIN"));
  check(`${roomDef.room_id}: has room volume`, parsed.elements.some(e => e.type === "ROOM"));
}

console.log(`\n${passed} passed, ${failed} failed (${passed + failed} checks)`);
if (failed) process.exit(1);
