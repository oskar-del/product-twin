/**
 * Catalog-driven shoppable room gate.
 *
 * Covers the GLB bounds reader, the catalog-row adapter, the fit-based
 * selector, and both compiled rooms (Newport living room, vidaXL terrace).
 *
 *   node scripts/test-catalog-rooms.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseScene } from "../engine/core/scene-contract.mjs";
import { glbBounds, parseGlbJson, gltfBounds, boundsToDimensionsMm } from "../engine/compile/glb-bounds.mjs";
import { parsePrice, leafCategory, commerceFromRow, rowElement, dimensionsFromTitle } from "../engine/compile/catalog-row.mjs";
import { fitScore, selectForRoles, twinFromSelection } from "../engine/compile/catalog-room.mjs";
import { buildNewportRoom, loadCatalog as loadNewport, resolveNewportGeometry } from "./compile-newport-room.mjs";
import { buildVidaxlTerrace, resolveVidaxlGeometry } from "./compile-vidaxl-terrace.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AVATAR_DIR = path.resolve(root, "../repo-avatar-factory/data/geometry/avatars");

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) { passed++; }
  else { failed++; console.error(`FAIL  ${label}`); }
}

// §1 GLB bounds reader
console.log("§1 GLB bounds");
const sofaGlb = fs.readFileSync(path.join(AVATAR_DIR, "newport-10445-g2-proxy.glb"));
const gltf = parseGlbJson(sofaGlb);
check("parses glTF JSON", typeof gltf === "object" && Array.isArray(gltf.nodes));
check("asset generator names Product Twin", String(gltf.asset?.generator ?? "").includes("Product Twin"));

const sofaBounds = glbBounds(sofaGlb);
check("bounds returned", sofaBounds !== null);
check("sofa width 2.0 m", Math.abs(sofaBounds.size[0] - 2.0) < 1e-6);
check("sofa height 0.85 m", Math.abs(sofaBounds.size[1] - 0.85) < 1e-6);
check("sofa depth 0.9 m", Math.abs(sofaBounds.size[2] - 0.9) < 1e-6);
check("sofa sits on floor (min y = 0)", Math.abs(sofaBounds.min[1]) < 1e-6);

const mm = boundsToDimensionsMm(sofaBounds);
check("mm width 2000", mm.width === 2000);
check("mm height 850", mm.height === 850);
check("mm depth 900", mm.depth === 900);
check("null bounds → null mm", boundsToDimensionsMm(null) === null);

// Multi-node model (table with legs) unions correctly
const tableBounds = glbBounds(fs.readFileSync(path.join(AVATAR_DIR, "newport-10397-g2-proxy.glb")));
check("table width 1.2 m", Math.abs(tableBounds.size[0] - 1.2) < 1e-6);
check("table height includes legs (0.4 m)", Math.abs(tableBounds.size[1] - 0.4) < 1e-6);
check("table centre x is 0", Math.abs(tableBounds.centre[0]) < 1e-6);

check("rejects non-GLB", (() => {
  try { parseGlbJson(Buffer.from("not a glb at all!!")); return false; }
  catch { return true; }
})());

// §2 Price parsing
console.log("§2 price parsing");
check("plain price", parsePrice({ price: "34395 SEK" }).amount === 34395);
check("currency captured", parsePrice({ price: "34395 SEK" }).currency === "SEK");
check("sale price wins", parsePrice({ price: "100 SEK", sale_price: "80 SEK" }).amount === 80);
check("empty price → null", parsePrice({ price: "", currency: "SEK" }).amount === null);
check("empty price keeps currency", parsePrice({ price: "", currency: "SEK" }).currency === "SEK");
check("thousands separator", parsePrice({ price: "1 299 SEK" }).amount === 1299);
check("garbage → null", parsePrice({ price: "call us" }).amount === null);

// §3 Category + commerce
console.log("§3 category and commerce");
check("leaf category", leafCategory({ category: "Möbler  >  Fåtöljer  >  Skinnfåtöljer" }) === "Skinnfåtöljer");
check("no category → empty", leafCategory({}) === "");

const sampleRow = {
  source: "newport", id: "10058", gtin: "7340172900740", title: "AW44 skinnfåtölj",
  brand: "Artwood", category: "Möbler > Fåtöljer > Skinnfåtöljer", price: "34395 SEK",
  currency: "SEK", image: "https://cdn.example/x.jpg",
  product_url: "https://www.newport.se/shop/x",
  affiliate_link: "https://at.newport.se/t/t?a=1884564186&as=2106320328&t=2&tk=1&cupa_sku=10058",
  color: "Brun", material: "Läder", availability: "in_stock"
};
const commerce = commerceFromRow(sampleRow);
check("buy_url is affiliate verbatim", commerce.buy_url === sampleRow.affiliate_link);
check("product_url separate from buy_url", commerce.product_url !== commerce.buy_url);
check("price parsed", commerce.price === 34395);
check("sku carried", commerce.sku === "10058");
check("gtin carried", commerce.gtin === "7340172900740");
check("channel carried", commerce.channel === "newport");
check("falls back to product_url when no affiliate",
  commerceFromRow({ ...sampleRow, affiliate_link: undefined }).buy_url === sampleRow.product_url);

// §4 Element construction
console.log("§4 element construction");
const withGeom = rowElement({
  row: sampleRow, id: "CHAIR", position: [1, 0, 2], rotation_y_deg: 30,
  assetPath: "data/geometry/avatars/newport-10058-g2-proxy.glb",
  bounds: { size: [0.8, 0.9, 0.85] }
});
check("GLTF_ASSET when proxy exists", withGeom.geometry.primitive === "GLTF_ASSET");
check("INDICATIVE with proxy", withGeom.evidence_class === "INDICATIVE");
check("position preserved", withGeom.geometry.position[0] === 1);
check("rotation preserved", withGeom.geometry.rotation_y_deg === 30);
check("label carries dimensions", /800×850×900 mm/.test(withGeom.label));
check("source_refs cite catalog row", withGeom.source_refs.some(r => r.includes("10058")));
check("source_refs cite gtin", withGeom.source_refs.some(r => r.includes("GTIN")));

const noGeom = rowElement({ row: sampleRow, id: "X", position: [0, 0, 0], bounds: { size: [0.5, 0.4, 0.5] } });
check("BOX when no proxy", noGeom.geometry.primitive === "BOX");
check("CONCEPT without proxy", noGeom.evidence_class === "CONCEPT");
check("box lifted to sit on floor", Math.abs(noGeom.geometry.position[1] - 0.2) < 1e-9);
check("no-proxy limitation stated", noGeom.limitations.some(l => l.includes("No 3D proxy")));

// §5 Title dimensions
console.log("§5 title dimensions");
const d3 = dimensionsFromTitle("vidaXL Trädgårdspall 70x70x30 cm massiv furu");
check("three axes parsed", d3.axes === 3);
check("width 0.7 m", Math.abs(d3.size[0] - 0.7) < 1e-9);
check("height from third number", Math.abs(d3.size[1] - 0.3) < 1e-9);
check("depth from second number", Math.abs(d3.size[2] - 0.7) < 1e-9);
const d2 = dimensionsFromTitle("vidaXL Markis 600 × 300 cm");
check("two axes flagged", d2.axes === 2);
check("two-axis height unknown", d2.size[1] === null);
check("decimal comma", Math.abs(dimensionsFromTitle("Solstol 200,5 x 70 x 30 cm").size[0] - 2.005) < 1e-9);
check("no dims → null", dimensionsFromTitle("vidaXL Trädgårdsstol antracit") === null);
check("empty → null", dimensionsFromTitle("") === null);

// §6 Fit scoring and selection
console.log("§6 fit scoring");
check("exact fit scores 0", fitScore([1.2, 0.4, 0.6], { width_m: 1.2, depth_m: 0.6 }) === 0);
check("width error dominates", fitScore([1.4, 0.4, 0.6], { width_m: 1.2, depth_m: 0.6 }) > 0);
check("null size → Infinity", fitScore(null, { width_m: 1 }) === Number.POSITIVE_INFINITY);
check("closer width wins",
  fitScore([1.25, 0, 0.6], { width_m: 1.2 }) < fitScore([1.6, 0, 0.6], { width_m: 1.2 }));

const fakeRows = [
  { source: "t", id: "b", title: "Wide 200x80x90 cm", category: "X > Sofas", availability: "in_stock", affiliate_link: "u" },
  { source: "t", id: "a", title: "Narrow 140x80x90 cm", category: "X > Sofas", availability: "in_stock", affiliate_link: "u" },
  { source: "t", id: "c", title: "Gone 200x80x90 cm", category: "X > Sofas", availability: "out_of_stock", affiliate_link: "u" }
];
const resolveFake = row => {
  const d = dimensionsFromTitle(row.title);
  return d && d.axes === 3 ? { assetPath: null, bounds: { size: d.size } } : null;
};
const sel = selectForRoles({
  rows: fakeRows,
  roles: [{ id: "SOFA", categories: ["Sofas"], require_asset: false, target: { width_m: 2.0 } }],
  resolveGeometry: resolveFake
});
check("best fit selected", sel.selected.get("SOFA").row.id === "b");
check("out-of-stock excluded", sel.report[0].candidates === 2);
check("report records sku", sel.report[0].sku === "b");

// Determinism: identical input yields identical choice
const sel2 = selectForRoles({
  rows: [...fakeRows].reverse(),
  roles: [{ id: "SOFA", categories: ["Sofas"], require_asset: false, target: { width_m: 2.0 } }],
  resolveGeometry: resolveFake
});
check("selection is order-independent", sel2.selected.get("SOFA").row.id === "b");

const selTie = selectForRoles({
  rows: [
    { source: "t", id: "z", title: "T 100x50x50 cm", category: "X > Y", availability: "in_stock" },
    { source: "t", id: "a", title: "T 100x50x50 cm", category: "X > Y", availability: "in_stock" }
  ],
  roles: [{ id: "R", categories: ["Y"], require_asset: false, target: { width_m: 1.0 } }],
  resolveGeometry: resolveFake
});
check("ties break on id", selTie.selected.get("R").row.id === "a");

const selNone = selectForRoles({
  rows: fakeRows,
  roles: [{ id: "R", categories: ["Nonexistent"], require_asset: false, target: { width_m: 1 } }],
  resolveGeometry: resolveFake
});
check("missing category reports NO_CANDIDATE", selNone.report[0].state === "NO_CANDIDATE");

// Envelope rejection
const selCap = selectForRoles({
  rows: fakeRows,
  roles: [{ id: "R", categories: ["Sofas"], require_asset: false, target: { width_m: 2.0 }, max_width_m: 1.5 }],
  resolveGeometry: resolveFake
});
check("oversize rejected by max_width_m", selCap.selected.get("R").row.id === "a");

// §7 Twin synthesis for attach
console.log("§7 twin synthesis");
const twin = twinFromSelection({
  row: sampleRow,
  geom: { assetPath: "p.glb", bounds: { size: [2.0, 0.85, 0.9] } },
  role: { id: "SOFA", base_kind: "sofa" }
});
check("dimensions in mm", twin.physical.dimensions_mm.width === 2000);
check("base role", twin.attach.role === "base");
check("sofa has seat_back slot", twin.attach.slots.some(s => s.slot_id === "seat_back"));
check("seat_back capacity 3", twin.attach.slots.find(s => s.slot_id === "seat_back").capacity === 3);
check("seat height derived", twin.physical.secondary_dimensions_mm.seat_height === 442);

const freeTwin = twinFromSelection({ row: sampleRow, geom: null, role: { id: "R", base_kind: null, nominal_size_m: [1, 1, 1] } });
check("no slots → free role", freeTwin.attach.role === "free");

// §8 Newport room
console.log("§8 Newport living room");
const newportRows = loadNewport();
check("catalog loads 13,036 rows", newportRows.length === 13036);
check("every row has an affiliate_link", newportRows.every(r => typeof r.affiliate_link === "string" && r.affiliate_link.length > 0));

const { scene: npScene, report: npReport, errors: npErrors } = buildNewportRoom();
const npParsed = parseScene(npScene);
check("Newport scene is contract-valid", npParsed.elements.length > 0);
check("no attach errors", npErrors.length === 0);

const npShoppable = npParsed.elements.filter(e => e.commerce);
check("at least 10 shoppable elements", npShoppable.length >= 10);
check("every role selected", npReport.every(r => r.state === "SELECTED"));

const rowById = new Map(newportRows.map(r => [r.id, r]));
let verbatim = 0;
for (const el of npShoppable) {
  const src = rowById.get(el.commerce.sku);
  if (src && el.commerce.buy_url === src.affiliate_link) verbatim++;
}
check("every BUY url is the affiliate link verbatim", verbatim === npShoppable.length);
check("no BUY points at ikea.com", npShoppable.every(e => !/ikea\.com/i.test(e.commerce.buy_url ?? "")));
check("every BUY carries channel tracking", npShoppable.every(e => /[?&]as=/.test(e.commerce.buy_url ?? "")));
check("every selected row is in stock", npShoppable.every(e => rowById.get(e.commerce.sku)?.availability === "in_stock"));

const npGltf = npParsed.elements.filter(e => e.geometry.primitive === "GLTF_ASSET");
check("furniture uses real G2 proxies", npGltf.length >= 8);
check("proxy files exist on disk", npGltf.every(e =>
  fs.existsSync(path.resolve(root, "../repo-avatar-factory", e.geometry.asset_path))));

// Attach layer landed on its bases
const byId = new Map(npParsed.elements.map(e => [e.id, e]));
const sofaEl = byId.get("SOFA");
const cushionA = byId.get("CUSHION_A");
const coffee = byId.get("COFFEE_TABLE");
const vase = byId.get("VASE");
const sideTable = byId.get("SIDE_TABLE");
const lamp = byId.get("TABLE_LAMP");
check("cushion sits above the floor", cushionA.geometry.position[1] > 0.2);
check("cushion is near the sofa in z", Math.abs(cushionA.geometry.position[2] - sofaEl.geometry.position[2]) < 0.7);
check("vase rests on the coffee table", vase.geometry.position[1] > 0.2);
check("vase shares the table's z", Math.abs(vase.geometry.position[2] - coffee.geometry.position[2]) < 0.5);
check("lamp rests on the side table", lamp.geometry.position[1] > 0.3);
check("lamp shares the side table x", Math.abs(lamp.geometry.position[0] - sideTable.geometry.position[0]) < 0.01);

check("scene declares three stages", npParsed.stages.length === 3);
check("room shell present", byId.has("ROOM_FLOOR") && byId.has("ROOM_VOLUME"));
check("shell is not shoppable", !byId.get("ROOM_FLOOR").commerce);

// Rebuild determinism
const second = buildNewportRoom();
check("same catalog yields the same room",
  JSON.stringify(second.report) === JSON.stringify(npReport));

// §9 vidaXL terrace
console.log("§9 vidaXL terrace");
const { scene: vxScene, report: vxReport, errors: vxErrors } = buildVidaxlTerrace();
const vxParsed = parseScene(vxScene);
check("terrace scene is contract-valid", vxParsed.elements.length > 0);
check("no attach errors", vxErrors.length === 0);
check("every terrace role selected", vxReport.every(r => r.state === "SELECTED"));

const vxShoppable = vxParsed.elements.filter(e => e.commerce);
check("at least 6 shoppable elements", vxShoppable.length >= 6);
check("every BUY carries channel tracking", vxShoppable.every(e => /[?&]as=/.test(e.commerce.buy_url ?? "")));
check("terrace BUY goes to the vidaXL network",
  vxShoppable.every(e => /adt267\.com|vidaxl/i.test(e.commerce.buy_url ?? "")));
check("no proxies claimed for vidaXL",
  vxParsed.elements.every(e => e.geometry.primitive !== "GLTF_ASSET"));
check("shoppable terrace pieces are CONCEPT",
  vxShoppable.every(e => e.evidence_class === "CONCEPT"));
check("terrace states the no-proxy limitation",
  vxShoppable.every(e => e.limitations.some(l => /No 3D proxy/.test(l))));
check("claim policy names the box caveat", /not a fit claim/.test(vxScene.legal_claim_policy.rule));

// Every terrace piece got its size from its own title
for (const el of vxShoppable) {
  const stated = dimensionsFromTitle(el.commerce.product_name);
  if (el.id === "SEAT_CUSHION") continue; // nominal by design
  check(`${el.id} size traces to its title`, stated !== null && stated.axes === 3);
}

// §10 Cross-room invariants
console.log("§10 cross-room invariants");
for (const [name, parsed] of [["newport", npParsed], ["vidaxl", vxParsed]]) {
  const shop = parsed.elements.filter(e => e.commerce);
  check(`${name}: every shoppable has a product name`, shop.every(e => e.commerce.product_name));
  check(`${name}: every shoppable has a brand`, shop.every(e => e.commerce.brand));
  check(`${name}: every shoppable has an image`, shop.every(e => /^https?:\/\//.test(e.commerce.image_url ?? "")));
  check(`${name}: every shoppable has a price`, shop.every(e => Number.isFinite(e.commerce.price)));
  check(`${name}: every shoppable has a currency`, shop.every(e => e.commerce.currency));
  check(`${name}: every BUY is https`, shop.every(e => (e.commerce.buy_url ?? "").startsWith("https://")));
  check(`${name}: element ids are unique`, new Set(parsed.elements.map(e => e.id)).size === parsed.elements.length);
  check(`${name}: no element sits below the floor`, parsed.elements.every(e => {
    const p = e.geometry.position;
    return !p || p[1] >= -0.001;
  }));
  check(`${name}: no duplicate skus`, (() => {
    const skus = shop.map(e => e.commerce.sku);
    return new Set(skus).size === skus.length;
  })());
}

console.log(`\n${passed} passed, ${failed} failed (${passed + failed} checks)`);
if (failed) process.exit(1);
