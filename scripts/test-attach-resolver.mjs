/**
 * Attach-point resolver gate.
 *
 *   node scripts/test-attach-resolver.mjs
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {resolveComposition} from "../engine/compose/attach-resolver.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const twinsDir = path.join(root, "data/twins");

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) { passed++; }
  else { failed++; console.error(`FAIL  ${label}`); }
}

function loadTwin(filename) {
  return JSON.parse(fs.readFileSync(path.join(twinsDir, filename), "utf8"));
}

// §1 Basic composition — sofa with pillows
console.log("§1 basic composition");
{
  const sofa = loadTwin("PT_IKEA_KIVIK_49440597.json");
  const pillow = {
    twin_id: "PILLOW_TEST_1",
    category_id: "FFE.TEXTILES.CUSHION",
    identity: {name: "Test cushion"},
    attach: {role: "attach", accepts_slot_type: "pillow", footprint_mm: {width: 450, depth: 450, height: 450}},
    physical: {dimensions_mm: {width: 450, depth: 450, height: 150}}
  };

  const index = new Map([
    [sofa.twin_id, sofa],
    [pillow.twin_id, pillow]
  ]);

  const {positioned, errors} = resolveComposition({
    items: [
      {twin_id: sofa.twin_id, position: [0, 0, -1.8], rotation_y_deg: 0},
      {twin_id: pillow.twin_id, attach_to: sofa.twin_id, slot_id: "seat_back"}
    ],
    twinIndex: index
  });

  check("no errors", errors.length === 0);
  check("2 positioned items", positioned.length === 2);
  check("sofa at origin position", positioned[0].position[0] === 0 && positioned[0].position[2] === -1.8);
  check("pillow has position", Array.isArray(positioned[1].position) && positioned[1].position.length === 3);
  check("pillow y > 0 (elevated to seat)", positioned[1].position[1] > 0);
  check("pillow attach_to set", positioned[1].attach_to === sofa.twin_id);
  check("pillow slot_id set", positioned[1].slot_id === "seat_back");
}

// §2 Multiple pillows on sofa (capacity 3)
console.log("§2 multiple pillows");
{
  const sofa = loadTwin("PT_IKEA_KIVIK_49440597.json");
  const mkPillow = (id) => ({
    twin_id: id,
    category_id: "FFE.TEXTILES.CUSHION",
    identity: {name: `Cushion ${id}`},
    attach: {role: "attach", accepts_slot_type: "pillow", footprint_mm: {width: 400, depth: 400, height: 120}}
  });

  const p1 = mkPillow("P1"), p2 = mkPillow("P2"), p3 = mkPillow("P3");
  const index = new Map([[sofa.twin_id, sofa], [p1.twin_id, p1], [p2.twin_id, p2], [p3.twin_id, p3]]);

  const {positioned, errors} = resolveComposition({
    items: [
      {twin_id: sofa.twin_id, position: [0, 0, 0]},
      {twin_id: p1.twin_id, attach_to: sofa.twin_id, slot_id: "seat_back"},
      {twin_id: p2.twin_id, attach_to: sofa.twin_id, slot_id: "seat_back"},
      {twin_id: p3.twin_id, attach_to: sofa.twin_id, slot_id: "seat_back"}
    ],
    twinIndex: index
  });

  check("no errors for 3 pillows", errors.length === 0);
  check("4 positioned items", positioned.length === 4);
  const pillowPositions = positioned.filter(p => p.attach_to).map(p => p.position[0]);
  check("pillows have different x positions", new Set(pillowPositions.map(x => x.toFixed(3))).size === 3);
}

// §3 Capacity exceeded
console.log("§3 capacity exceeded");
{
  const sofa = loadTwin("PT_IKEA_KIVIK_49440597.json");
  const mkPillow = (id) => ({
    twin_id: id, category_id: "FFE.TEXTILES.CUSHION",
    attach: {role: "attach", accepts_slot_type: "pillow"}
  });
  const p1 = mkPillow("P1"), p2 = mkPillow("P2"), p3 = mkPillow("P3"), p4 = mkPillow("P4");
  const index = new Map([[sofa.twin_id, sofa], ...["P1","P2","P3","P4"].map(id => [id, {P1:p1,P2:p2,P3:p3,P4:p4}[id]])]);

  const {positioned, errors} = resolveComposition({
    items: [
      {twin_id: sofa.twin_id, position: [0, 0, 0]},
      {twin_id: "P1", attach_to: sofa.twin_id, slot_id: "seat_back"},
      {twin_id: "P2", attach_to: sofa.twin_id, slot_id: "seat_back"},
      {twin_id: "P3", attach_to: sofa.twin_id, slot_id: "seat_back"},
      {twin_id: "P4", attach_to: sofa.twin_id, slot_id: "seat_back"}
    ],
    twinIndex: index
  });

  check("capacity error for 4th pillow", errors.length === 1 && errors[0].includes("capacity"));
  check("4 positioned (sofa + 3 pillows)", positioned.length === 4);
}

// §4 Table with centerpiece
console.log("§4 table with centerpiece");
{
  const table = loadTwin("PT_IKEA_LISTERBY_30513904.json");
  const vase = {
    twin_id: "VASE_1", category_id: "FFE.DECOR.VASE",
    identity: {name: "Test vase"},
    attach: {role: "attach", accepts_slot_type: "centerpiece", footprint_mm: {width: 120, depth: 120, height: 250}}
  };
  const index = new Map([[table.twin_id, table], [vase.twin_id, vase]]);

  const {positioned, errors} = resolveComposition({
    items: [
      {twin_id: table.twin_id, position: [0, 0, -0.2]},
      {twin_id: vase.twin_id, attach_to: table.twin_id, slot_id: "top"}
    ],
    twinIndex: index
  });

  check("no errors", errors.length === 0);
  check("vase positioned on table top", positioned[1].position[1] > 0.3);
}

// §5 Slot type mismatch
console.log("§5 slot type mismatch");
{
  const table = loadTwin("PT_IKEA_GLADOM_70578451.json");
  const pillow = {
    twin_id: "BAD_PILLOW", category_id: "FFE.TEXTILES.CUSHION",
    attach: {role: "attach", accepts_slot_type: "pillow"}
  };
  const index = new Map([[table.twin_id, table], [pillow.twin_id, pillow]]);

  const {positioned, errors} = resolveComposition({
    items: [
      {twin_id: table.twin_id, position: [0, 0, 0]},
      {twin_id: "BAD_PILLOW", attach_to: table.twin_id, slot_id: "top"}
    ],
    twinIndex: index
  });

  check("type mismatch error", errors.length === 1 && errors[0].includes("pillow"));
}

// §6 Missing twin
console.log("§6 missing twin");
{
  const sofa = loadTwin("PT_IKEA_KIVIK_49440597.json");
  const index = new Map([[sofa.twin_id, sofa]]);

  const {errors} = resolveComposition({
    items: [
      {twin_id: sofa.twin_id, position: [0, 0, 0]},
      {twin_id: "NONEXISTENT", attach_to: sofa.twin_id, slot_id: "seat_back"}
    ],
    twinIndex: index
  });

  check("missing twin error", errors.length === 1 && errors[0].includes("not found"));
}

// §7 Rotated base — attached items rotate with it
console.log("§7 rotated base");
{
  const sofa = loadTwin("PT_IKEA_KIVIK_49440597.json");
  const pillow = {
    twin_id: "ROT_PILLOW", category_id: "FFE.TEXTILES.CUSHION",
    attach: {role: "attach", accepts_slot_type: "pillow"}
  };
  const index = new Map([[sofa.twin_id, sofa], [pillow.twin_id, pillow]]);

  const {positioned: p0} = resolveComposition({
    items: [
      {twin_id: sofa.twin_id, position: [5, 0, 3], rotation_y_deg: 0},
      {twin_id: "ROT_PILLOW", attach_to: sofa.twin_id, slot_id: "seat_back"}
    ],
    twinIndex: index
  });

  const {positioned: p90} = resolveComposition({
    items: [
      {twin_id: sofa.twin_id, position: [5, 0, 3], rotation_y_deg: 90},
      {twin_id: "ROT_PILLOW", attach_to: sofa.twin_id, slot_id: "seat_back"}
    ],
    twinIndex: index
  });

  const pill0 = p0.find(p => p.twin.twin_id === "ROT_PILLOW");
  const pill90 = p90.find(p => p.twin.twin_id === "ROT_PILLOW");
  check("pillow position changes with rotation", pill0.position[0] !== pill90.position[0] || pill0.position[2] !== pill90.position[2]);
  check("pillow rotation matches base", pill90.rotation_y_deg === 90);
}

// §8 Free-standing items
console.log("§8 free-standing items");
{
  const rug = loadTwin("PT_IKEA_LOHALS_30511288.json");
  const lamp = loadTwin("PT_IKEA_LAUTERS_30405042.json");
  const index = new Map([[rug.twin_id, rug], [lamp.twin_id, lamp]]);

  const {positioned, errors} = resolveComposition({
    items: [
      {twin_id: rug.twin_id, position: [0, 0, 0]},
      {twin_id: lamp.twin_id, position: [2, 0, -1]}
    ],
    twinIndex: index
  });

  check("no errors for free items", errors.length === 0);
  check("2 positioned", positioned.length === 2);
  check("lamp at specified position", positioned[1].position[0] === 2);
}

console.log(`\n${passed} passed, ${failed} failed (${passed + failed} checks)`);
if (failed) process.exit(1);
