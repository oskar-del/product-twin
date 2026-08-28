// Stamp attach-point slots on FURNITURE base twins and attach_role on DECOR/LIGHTING twins.
// Usage: node scripts/stamp-attach-points.mjs
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TWINS_DIR = path.join(ROOT, 'data/twins');

// Base type from category
function baseType(cat) {
  if (cat.includes('SOFA')) return 'sofa';
  if (cat.includes('ARMCHAIR') || cat.includes('SEATING.LOUNGE')) return 'armchair';
  if (cat.includes('TABLE')) return 'table';
  if (cat.includes('BED')) return 'bed';
  if (cat.includes('SHELF') || cat.includes('BOOKCASE')) return 'shelf';
  if (cat.includes('CONSOLE')) return 'console';
  if (cat.includes('CABINET') || cat.includes('DRESSER') || cat.includes('STORAGE')) return 'console';
  if (cat.includes('BENCH')) return 'sofa';
  return null;
}

// Generate slots for a base type using dimensions
function slotsFor(type, dims) {
  const w = (dims?.width || 600) / 1000;
  const h = (dims?.height || 600) / 1000;
  const d = (dims?.depth || dims?.width || 400) / 1000;
  const slots = [];

  if (type === 'sofa') {
    const seatH = h * 0.52;
    const cushionW = w * 0.35;
    slots.push(
      { slot_id: 'seat_left', slot_type: 'surface', position: { x: -w*0.3, y: seatH, z: 0 }, accepts: ['FFE.TEXTILES.CUSHION'], max_items: 2,
        size_constraint_mm: { max_width: cushionW*1000, max_depth: cushionW*1000, max_height: 200 } },
      { slot_id: 'seat_right', slot_type: 'surface', position: { x: w*0.3, y: seatH, z: 0 }, accepts: ['FFE.TEXTILES.CUSHION'], max_items: 2,
        size_constraint_mm: { max_width: cushionW*1000, max_depth: cushionW*1000, max_height: 200 } },
      { slot_id: 'back_center', slot_type: 'lean', position: { x: 0, y: h*0.65, z: -d*0.35 }, accepts: ['FFE.TEXTILES.CUSHION'], max_items: 1 },
      { slot_id: 'arm_drape', slot_type: 'drape', position: { x: w*0.45, y: h*0.6, z: 0 }, accepts: ['FFE.TEXTILES.THROW'], max_items: 1 },
    );
  }

  if (type === 'armchair') {
    const seatH = h * 0.48;
    slots.push(
      { slot_id: 'seat', slot_type: 'surface', position: { x: 0, y: seatH, z: 0 }, accepts: ['FFE.TEXTILES.CUSHION'], max_items: 1,
        size_constraint_mm: { max_width: 450, max_depth: 450, max_height: 150 } },
      { slot_id: 'arm_drape', slot_type: 'drape', position: { x: w*0.4, y: h*0.55, z: 0 }, accepts: ['FFE.TEXTILES.THROW'], max_items: 1 },
    );
  }

  if (type === 'table') {
    slots.push(
      { slot_id: 'tabletop_center', slot_type: 'surface', position: { x: 0, y: h, z: 0 }, accepts: ['FFE.DECOR.VASE', 'FFE.DECOR.CANDLE', 'FFE.DECOR.BOOK', 'FFE.DECOR.PLANT', 'FFE.DECOR.FRAGRANCE'], max_items: 3,
        size_constraint_mm: { max_width: w*500, max_depth: d*500, max_height: 500 } },
      { slot_id: 'tabletop_left', slot_type: 'surface', position: { x: -w*0.3, y: h, z: 0 }, accepts: ['FFE.DECOR', 'ELECTRICAL.LUMINAIRES.TABLE'], max_items: 1 },
      { slot_id: 'tabletop_right', slot_type: 'surface', position: { x: w*0.3, y: h, z: 0 }, accepts: ['FFE.DECOR', 'ELECTRICAL.LUMINAIRES.TABLE'], max_items: 1 },
    );
  }

  if (type === 'bed') {
    slots.push(
      { slot_id: 'pillow_left', slot_type: 'surface', position: { x: -w*0.25, y: h*0.45, z: -d*0.35 }, accepts: ['FFE.TEXTILES.CUSHION'], max_items: 2 },
      { slot_id: 'pillow_right', slot_type: 'surface', position: { x: w*0.25, y: h*0.45, z: -d*0.35 }, accepts: ['FFE.TEXTILES.CUSHION'], max_items: 2 },
      { slot_id: 'foot_drape', slot_type: 'drape', position: { x: 0, y: h*0.45, z: d*0.4 }, accepts: ['FFE.TEXTILES.THROW'], max_items: 1 },
      { slot_id: 'bedside_left', slot_type: 'surface', position: { x: -w*0.6, y: 0, z: -d*0.3 }, accepts: ['ELECTRICAL.LUMINAIRES.TABLE', 'FFE.DECOR'], max_items: 1 },
    );
  }

  if (type === 'shelf' || type === 'console') {
    const shelfCount = type === 'shelf' ? 4 : 1;
    for (let i = 0; i < shelfCount; i++) {
      const sy = type === 'shelf' ? h * (0.2 + i * 0.22) : h;
      slots.push(
        { slot_id: `shelf_${i}`, slot_type: 'surface', position: { x: 0, y: sy, z: 0 },
          accepts: ['FFE.DECOR.VASE', 'FFE.DECOR.CANDLE', 'FFE.DECOR.BOOK', 'FFE.DECOR.PLANT', 'FFE.DECOR.ART', 'FFE.DECOR.FRAGRANCE', 'ELECTRICAL.LUMINAIRES.TABLE'],
          max_items: type === 'shelf' ? 2 : 3 },
      );
    }
  }

  return slots;
}

// Attach role from category
function attachRole(cat) {
  if (cat.includes('CUSHION')) return 'pillow';
  if (cat.includes('THROW')) return 'throw';
  if (cat.includes('VASE')) return 'vase';
  if (cat.includes('CANDLE')) return 'candle';
  if (cat.includes('BOOK')) return 'book';
  if (cat.includes('PLANT')) return 'plant';
  if (cat.includes('ART') || cat.includes('MIRROR')) return 'art';
  if (cat.includes('FRAGRANCE')) return 'fragrance';
  if (cat.includes('LUMINAIRES.TABLE')) return 'lamp_table';
  if (cat.includes('LUMINAIRES.FLOOR')) return 'lamp_floor';
  if (cat.includes('LUMINAIRES.PENDANT')) return 'lamp_pendant';
  if (cat.includes('RUG')) return 'rug';
  if (cat.includes('DECOR')) return 'centerpiece';
  return null;
}

async function main() {
  const files = (await fs.readdir(TWINS_DIR)).filter(f => f.startsWith('PT_NEWPORT_') && f.endsWith('.json')).sort();
  let baseStamped = 0, attachStamped = 0, skipped = 0;

  for (const file of files) {
    const p = path.join(TWINS_DIR, file);
    const twin = JSON.parse(await fs.readFile(p, 'utf8'));
    const cat = twin.category_id || '';
    let dirty = false;

    if (twin.bucket === 'FURNITURE') {
      const bt = baseType(cat);
      if (bt && !twin.attach_points) {
        const dims = twin.physical?.dimensions_mm;
        twin.attach_points = {
          base_type: bt,
          slots: slotsFor(bt, dims),
        };
        dirty = true;
        baseStamped++;
      }
    } else {
      const role = attachRole(cat);
      if (role && !twin.attach_role) {
        twin.attach_role = role;
        dirty = true;
        attachStamped++;
      }
    }

    if (dirty) {
      await fs.writeFile(p, JSON.stringify(twin, null, 2) + '\n');
    } else {
      skipped++;
    }

    if ((baseStamped + attachStamped) % 2000 === 0 && (baseStamped + attachStamped) > 0)
      process.stderr.write(`... ${baseStamped} bases, ${attachStamped} attach\n`);
  }

  console.log(JSON.stringify({ baseStamped, attachStamped, skipped, total: baseStamped + attachStamped + skipped }));
}

await main();
