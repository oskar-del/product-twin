/**
 * Attach-point resolver.
 *
 * Given a scene composition (base items + attached items), resolves the
 * world-space positions for every attached item based on the base's slot
 * geometry and the attach item's footprint.
 *
 * Pure module: no DOM, no WebGL.
 */

/**
 * Default slot position offsets relative to the base's bounding box.
 * Y is up. Positions are fractions of the base dimensions (0–1).
 */
const SLOT_POSITION_TEMPLATES = {
  seat_back: (base, slotIndex, slotCapacity) => {
    const dims = baseDims(base);
    const spacing = dims.w / (slotCapacity + 1);
    return {
      x: -dims.w / 2 + spacing * (slotIndex + 1),
      y: dims.seatH ?? dims.h * 0.55,
      z: -dims.d / 2 + 0.15
    };
  },
  seat: (base, slotIndex) => {
    const dims = baseDims(base);
    return {x: 0, y: dims.seatH ?? dims.h * 0.55, z: 0};
  },
  top: (base, slotIndex, slotCapacity) => {
    const dims = baseDims(base);
    const spacing = dims.w / (slotCapacity + 1);
    return {
      x: -dims.w / 2 + spacing * (slotIndex + 1),
      y: dims.h,
      z: 0
    };
  },
  surface: (base, slotIndex, slotCapacity) => {
    const dims = baseDims(base);
    const spacing = dims.w / (slotCapacity + 1);
    return {
      x: -dims.w / 2 + spacing * (slotIndex + 1),
      y: dims.h,
      z: 0
    };
  },
  floor_footprint: (base) => {
    return {x: 0, y: 0, z: 0};
  }
};

function baseDims(twin) {
  const d = twin.physical?.dimensions_mm;
  if (!d) return {w: 1, d: 1, h: 0.5, seatH: null};
  const sd = twin.physical?.secondary_dimensions_mm;
  return {
    w: d.width / 1000,
    d: d.depth / 1000,
    h: d.height / 1000,
    seatH: sd?.seat_height ? sd.seat_height / 1000 : null
  };
}

/**
 * Resolve a scene composition into positioned items.
 *
 * @param {object} composition  {items: [{twin_id, attach_to?, slot_id?}]}
 * @param {Map<string, object>} twinIndex  twin_id → twin record
 * @returns {{positioned: Array<{twin, position, rotation_y_deg, attach_to?, slot_id?}>, errors: string[]}}
 */
export function resolveComposition({items, twinIndex}) {
  const errors = [];
  const positioned = [];
  const slotOccupancy = new Map();

  const freeItems = items.filter(i => !i.attach_to);
  const attachItems = items.filter(i => i.attach_to);

  for (const item of freeItems) {
    const twin = twinIndex.get(item.twin_id);
    if (!twin) { errors.push(`twin ${item.twin_id} not found`); continue; }
    positioned.push({
      twin,
      position: item.position ?? [0, 0, 0],
      rotation_y_deg: item.rotation_y_deg ?? 0
    });
  }

  for (const item of attachItems) {
    const twin = twinIndex.get(item.twin_id);
    if (!twin) { errors.push(`twin ${item.twin_id} not found`); continue; }

    const baseTwin = twinIndex.get(item.attach_to);
    if (!baseTwin) { errors.push(`base twin ${item.attach_to} not found for ${item.twin_id}`); continue; }

    const baseAttach = baseTwin.attach;
    if (!baseAttach || baseAttach.role !== "base") {
      errors.push(`${item.attach_to} is not a base (no attach.role=base)`);
      continue;
    }

    const slot = baseAttach.slots?.find(s => s.slot_id === item.slot_id);
    if (!slot) {
      errors.push(`${item.attach_to} has no slot "${item.slot_id}"`);
      continue;
    }

    const attachAs = twin.attach;
    if (attachAs?.accepts_slot_type && attachAs.accepts_slot_type !== slot.type) {
      errors.push(`${item.twin_id} accepts "${attachAs.accepts_slot_type}" but slot "${item.slot_id}" is type "${slot.type}"`);
      continue;
    }

    const key = `${item.attach_to}:${item.slot_id}`;
    const count = slotOccupancy.get(key) ?? 0;
    if (count >= slot.capacity) {
      errors.push(`slot ${item.slot_id} on ${item.attach_to} is at capacity (${slot.capacity})`);
      continue;
    }
    slotOccupancy.set(key, count + 1);

    const basePlacement = freeItems.find(fi => fi.twin_id === item.attach_to);
    const basePos = basePlacement?.position ?? [0, 0, 0];
    const baseRotDeg = basePlacement?.rotation_y_deg ?? 0;

    const template = SLOT_POSITION_TEMPLATES[slot.type] ?? SLOT_POSITION_TEMPLATES.top;
    const offset = template(baseTwin, count, slot.capacity);

    const rad = baseRotDeg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const worldX = basePos[0] + offset.x * cos - offset.z * sin;
    const worldZ = basePos[2] + offset.x * sin + offset.z * cos;
    const worldY = basePos[1] + offset.y;

    positioned.push({
      twin,
      position: [worldX, worldY, worldZ],
      rotation_y_deg: baseRotDeg,
      attach_to: item.attach_to,
      slot_id: item.slot_id
    });
  }

  return {positioned, errors};
}
