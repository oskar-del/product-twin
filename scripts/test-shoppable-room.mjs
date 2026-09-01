/**
 * Shoppable room gate.
 *
 *   node scripts/test-shoppable-room.mjs
 */
import {buildShoppableRoom} from "./compile-shoppable-room.mjs";
import {parseScene} from "../engine/core/scene-contract.mjs";
import {productPanel, shoppablePanels} from "../engine/ui/product-panel.mjs";

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) { passed++; }
  else { failed++; console.error(`FAIL  ${label}`); }
}

// §1 Scene contract compliance
console.log("§1 scene contract compliance");
let scene, parsed;
try {
  scene = buildShoppableRoom();
  parsed = parseScene(scene);
  check("scene parses without violations", true);
} catch (e) {
  check(`scene parses: ${e.message}`, false);
  process.exit(1);
}

check("scene_id is set", parsed.scene_id === "SCENE_SHOPPABLE_ROOM_IKEA_LIVING_V01");
check("at least 10 elements", parsed.elements.length >= 10);
check("at least 3 stages", parsed.stages.length >= 3);
check("default profile is REALISTIC", parsed.presentation.default_profile === "REALISTIC");

// §2 Furniture elements
console.log("§2 furniture elements");
const furniture = parsed.elements.filter(e => e.type === "FURNITURE");
check("at least 8 furniture elements", furniture.length >= 8);

for (const el of furniture) {
  check(`${el.id} has GLTF_ASSET primitive`, el.geometry.primitive === "GLTF_ASSET");
  check(`${el.id} has asset_path`, typeof el.geometry.asset_path === "string" && el.geometry.asset_path.length > 0);
  check(`${el.id} has position`, Array.isArray(el.geometry.position) && el.geometry.position.length === 3);
  check(`${el.id} evidence class is valid`, ["CONCEPT", "REPORTED_UNVERIFIED", "INDICATIVE", "AUTHORITATIVE"].includes(el.evidence_class));
}

// §3 Commerce data
console.log("§3 commerce data");
const commerceElements = scene.elements.filter(e => e.commerce);
check("at least 8 elements have commerce", commerceElements.length >= 8);

for (const el of commerceElements) {
  const c = el.commerce;
  check(`${el.id} has product_name`, typeof c.product_name === "string" && c.product_name.length > 0);
  check(`${el.id} has brand`, typeof c.brand === "string" && c.brand.length > 0);
  check(`${el.id} has product_url or buy_url`, c.product_url || c.buy_url);
}

// §4 Product panel extraction
console.log("§4 product panel extraction");
const panels = shoppablePanels(parsed);
check("shoppablePanels returns a Map", panels instanceof Map);
check("at least 8 panels", panels.size >= 8);

for (const [id, panel] of panels) {
  check(`panel ${id} has element_id`, panel.element_id === id);
  check(`panel ${id} has product_name`, typeof panel.product_name === "string");
  check(`panel ${id} has evidence_class`, typeof panel.evidence_class === "string");
  check(`panel ${id} has buy_url or product_url`, panel.buy_url || panel.product_url);
}

// §5 Non-shoppable elements don't produce panels
console.log("§5 non-shoppable elements");
const nonShoppable = parsed.elements.filter(e => !e.commerce);
check("room shell elements exist", nonShoppable.length >= 2);
for (const el of nonShoppable) {
  const panel = productPanel(el);
  check(`${el.id} returns null panel`, panel === null);
}

// §6 Room shell
console.log("§6 room shell");
check("has floor", parsed.elements.some(e => e.type === "TERRAIN"));
check("has room volume", parsed.elements.some(e => e.type === "ROOM"));
check("has window", parsed.elements.some(e => e.type === "OPENING"));

console.log(`\n${passed} passed, ${failed} failed (${passed + failed} checks)`);
if (failed) process.exit(1);
