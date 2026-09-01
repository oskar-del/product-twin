// Validates a scene JSON against the attach-point schema: every attach_to twin exists,
// exposes the referenced slot, slot type matches the attaching item's accepts_slot_type,
// and slot capacity is not exceeded. Usage: node scripts/validate-scene.mjs <scene.json>
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const scenePath = process.argv[2];
if (!scenePath) { console.error('Usage: node scripts/validate-scene.mjs <scene.json>'); process.exit(1); }

const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
const twinCache = new Map();
function loadTwin(id) {
  if (twinCache.has(id)) return twinCache.get(id);
  const p = path.join(ROOT, 'data/twins', `${id}.json`);
  if (!fs.existsSync(p)) { twinCache.set(id, null); return null; }
  const t = JSON.parse(fs.readFileSync(p, 'utf8'));
  twinCache.set(id, t);
  return t;
}

const errors = [];
const slotUsage = new Map(); // `${base}:${slot_id}` -> count

for (const item of scene.items) {
  const twin = loadTwin(item.twin_id);
  if (!twin) { errors.push(`${item.twin_id}: twin not found`); continue; }

  if (!item.attach_to) continue; // free-standing placement, always valid

  const base = loadTwin(item.attach_to);
  if (!base) { errors.push(`${item.twin_id}: attach_to ${item.attach_to} not found`); continue; }
  if (base.attach?.role !== 'base') { errors.push(`${item.twin_id}: attach_to ${item.attach_to} is not a base (role=${base.attach?.role})`); continue; }

  const slot = (base.attach.slots || []).find(s => s.slot_id === item.slot_id);
  if (!slot) { errors.push(`${item.twin_id}: slot "${item.slot_id}" not found on ${item.attach_to}`); continue; }

  const attachAs = twin.attach?.accepts_slot_type;
  if (attachAs !== slot.type) { errors.push(`${item.twin_id}: accepts_slot_type "${attachAs}" != slot type "${slot.type}" on ${item.attach_to}.${item.slot_id}`); continue; }

  const key = `${item.attach_to}:${item.slot_id}`;
  const used = (slotUsage.get(key) || 0) + 1;
  slotUsage.set(key, used);
  if (used > slot.capacity) { errors.push(`${item.twin_id}: slot ${key} over capacity (${used}/${slot.capacity})`); }
}

const result = { scene_id: scene.scene_id, items: scene.items.length, errors, status: errors.length === 0 ? 'PASS' : 'FAIL' };
console.log(JSON.stringify(result, null, 2));
process.exit(errors.length === 0 ? 0 : 1);
