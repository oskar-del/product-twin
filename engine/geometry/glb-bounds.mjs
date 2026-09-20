/**
 * Measure the real bounding box of a .glb.
 *
 * The product panel claims a dimension. Until now that claim came from the
 * catalog title or, failing that, a category default — which is a guess wearing
 * a number. The mesh that actually renders has a measurable extent, and glTF
 * stores it: every POSITION accessor carries `min`/`max` in the asset's own
 * units, so the bounds can be read from the JSON chunk without decoding a
 * single vertex.
 *
 * That makes the distinction the chrome needs honest:
 *   AUTHORITATIVE — measured from the GLB the viewer is showing
 *   INDICATIVE    — parsed from a merchant title
 *   CONCEPT       — a category default; nobody measured anything
 *
 * Node-only (reads files).
 */
import fs from "node:fs";

const MAGIC = 0x46546c67;      // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"

/** Parse the JSON chunk out of a binary glTF container. */
function readGltfJson(buffer) {
  if (buffer.length < 12 || buffer.readUInt32LE(0) !== MAGIC) return null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (type === CHUNK_JSON) {
      try {
        return JSON.parse(buffer.subarray(start, start + length).toString("utf8"));
      } catch {
        return null;
      }
    }
    offset = start + length;
  }
  return null;
}

/** 4×4 column-major node matrix → the translation/scale we care about. */
function nodeScaleTranslation(node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) {
    const m = node.matrix;
    const sx = Math.hypot(m[0], m[1], m[2]);
    const sy = Math.hypot(m[4], m[5], m[6]);
    const sz = Math.hypot(m[8], m[9], m[10]);
    return {scale: [sx, sy, sz], translation: [m[12], m[13], m[14]]};
  }
  return {
    scale: Array.isArray(node.scale) ? node.scale : [1, 1, 1],
    translation: Array.isArray(node.translation) ? node.translation : [0, 0, 0]
  };
}

/**
 * glbBounds(file) → {min:[x,y,z], max:[x,y,z], size:{width,height,depth}} in
 * the asset's units (metres, for our proxies), or null if unreadable.
 *
 * Walks the node tree so a mesh placed by a node transform is measured where it
 * actually sits. Rotation is deliberately NOT applied: our proxies are
 * axis-aligned, and a half-correct rotated AABB would be a worse claim than an
 * honest axis-aligned one.
 */
export function glbBounds(file) {
  let buffer;
  try {
    buffer = fs.readFileSync(file);
  } catch {
    return null;
  }
  const gltf = readGltfJson(buffer);
  if (!gltf?.meshes || !gltf?.accessors) return null;

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let sawAny = false;

  const meshBounds = mesh => {
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    let ok = false;
    for (const primitive of mesh.primitives ?? []) {
      const index = primitive.attributes?.POSITION;
      if (index == null) continue;
      const accessor = gltf.accessors[index];
      if (!Array.isArray(accessor?.min) || !Array.isArray(accessor?.max)) continue;
      for (let axis = 0; axis < 3; axis++) {
        lo[axis] = Math.min(lo[axis], accessor.min[axis]);
        hi[axis] = Math.max(hi[axis], accessor.max[axis]);
      }
      ok = true;
    }
    return ok ? {lo, hi} : null;
  };

  const visit = (nodeIndex, parentScale, parentTranslation) => {
    const node = gltf.nodes?.[nodeIndex];
    if (!node) return;
    const {scale, translation} = nodeScaleTranslation(node);
    const s = [parentScale[0] * scale[0], parentScale[1] * scale[1], parentScale[2] * scale[2]];
    const t = [
      parentTranslation[0] + translation[0] * parentScale[0],
      parentTranslation[1] + translation[1] * parentScale[1],
      parentTranslation[2] + translation[2] * parentScale[2]
    ];
    if (node.mesh != null) {
      const bounds = meshBounds(gltf.meshes[node.mesh]);
      if (bounds) {
        for (let axis = 0; axis < 3; axis++) {
          const a = bounds.lo[axis] * s[axis] + t[axis];
          const b = bounds.hi[axis] * s[axis] + t[axis];
          min[axis] = Math.min(min[axis], a, b);
          max[axis] = Math.max(max[axis], a, b);
        }
        sawAny = true;
      }
    }
    for (const child of node.children ?? []) visit(child, s, t);
  };

  const scene = gltf.scenes?.[gltf.scene ?? 0];
  const roots = scene?.nodes ?? gltf.nodes?.map((_, i) => i) ?? [];
  for (const root of roots) visit(root, [1, 1, 1], [0, 0, 0]);

  if (!sawAny) return null;
  return {
    min,
    max,
    size: {
      width: max[0] - min[0],
      height: max[1] - min[1],
      depth: max[2] - min[2]
    }
  };
}

/** Millimetre label from measured metres, e.g. "2000 × 900 × 850 mm". */
export function boundsLabelMm(size) {
  if (!size) return null;
  const mm = value => Math.round(value * 1000);
  return `${mm(size.width)} × ${mm(size.depth)} × ${mm(size.height)} mm`;
}
