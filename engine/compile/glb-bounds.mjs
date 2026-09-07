/**
 * GLB bounding-box reader.
 *
 * Parses a .glb container's JSON chunk and derives the world-space axis-aligned
 * bounding box by walking the node hierarchy. No three.js, no WebGL — pure
 * binary + JSON, so it runs headless in the gate.
 *
 * Dimensions are DERIVED from the geometry that actually ships, never typed.
 * The Newport G2 proxies encode their real size as node scale on a unit cube,
 * so the union of transformed node boxes is the product's true footprint.
 */

/**
 * Parse the JSON chunk out of a GLB buffer.
 * @param {Buffer|Uint8Array} buffer
 * @returns {object} the glTF JSON document
 */
export function parseGlbJson(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546c67) throw new Error("not a GLB container (bad magic)");
  const version = view.getUint32(4, true);
  if (version !== 2) throw new Error(`unsupported GLB version ${version}`);

  const chunkLength = view.getUint32(12, true);
  const chunkType = view.getUint32(16, true);
  if (chunkType !== 0x4e4f534a) throw new Error("first GLB chunk is not JSON");

  const bytes = buffer.subarray(20, 20 + chunkLength);
  return JSON.parse(new TextDecoder().decode(bytes));
}

/**
 * Accessor min/max for a mesh primitive's POSITION, if declared.
 * Returns a unit cube when the accessor omits bounds.
 */
function meshLocalBounds(gltf, meshIndex) {
  const mesh = gltf.meshes?.[meshIndex];
  if (!mesh) return null;
  let min = null;
  let max = null;
  for (const prim of mesh.primitives ?? []) {
    const accessorIndex = prim.attributes?.POSITION;
    if (accessorIndex === undefined) continue;
    const acc = gltf.accessors?.[accessorIndex];
    if (!acc?.min || !acc?.max) continue;
    min = min ? min.map((v, i) => Math.min(v, acc.min[i])) : [...acc.min];
    max = max ? max.map((v, i) => Math.max(v, acc.max[i])) : [...acc.max];
  }
  if (!min || !max) return { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] };
  return { min, max };
}

/**
 * Apply a node's TRS to a local box, returning the transformed AABB.
 * Rotation is applied as an axis-aligned envelope (conservative), which is
 * exact for the axis-aligned proxies and safe for anything else.
 */
function transformBounds(local, node) {
  const scale = node.scale ?? [1, 1, 1];
  const translation = node.translation ?? [0, 0, 0];

  const lo = [0, 1, 2].map(i => local.min[i] * scale[i] + translation[i]);
  const hi = [0, 1, 2].map(i => local.max[i] * scale[i] + translation[i]);

  return {
    min: [0, 1, 2].map(i => Math.min(lo[i], hi[i])),
    max: [0, 1, 2].map(i => Math.max(lo[i], hi[i]))
  };
}

function unionBounds(a, b) {
  if (!a) return b;
  if (!b) return a;
  return {
    min: [0, 1, 2].map(i => Math.min(a.min[i], b.min[i])),
    max: [0, 1, 2].map(i => Math.max(a.max[i], b.max[i]))
  };
}

/**
 * World-space AABB of a parsed glTF document.
 * @param {object} gltf
 * @returns {{min: number[], max: number[], size: number[], centre: number[]} | null}
 */
export function gltfBounds(gltf) {
  let box = null;

  const visit = (nodeIndex, parentOffset) => {
    const node = gltf.nodes?.[nodeIndex];
    if (!node) return;

    if (node.mesh !== undefined) {
      const local = meshLocalBounds(gltf, node.mesh);
      if (local) {
        const world = transformBounds(local, node);
        box = unionBounds(box, {
          min: world.min.map((v, i) => v + parentOffset[i]),
          max: world.max.map((v, i) => v + parentOffset[i])
        });
      }
    }

    const childOffset = (node.translation ?? [0, 0, 0]).map((v, i) => v + parentOffset[i]);
    for (const child of node.children ?? []) visit(child, childOffset);
  };

  const roots = gltf.scenes?.[gltf.scene ?? 0]?.nodes
    ?? gltf.nodes?.map((_, i) => i)
    ?? [];
  for (const r of roots) visit(r, [0, 0, 0]);

  if (!box) return null;
  return {
    min: box.min,
    max: box.max,
    size: [0, 1, 2].map(i => box.max[i] - box.min[i]),
    centre: [0, 1, 2].map(i => (box.max[i] + box.min[i]) / 2)
  };
}

/**
 * Read a .glb file and return its world AABB.
 * @param {Buffer|Uint8Array} buffer
 */
export function glbBounds(buffer) {
  return gltfBounds(parseGlbJson(buffer));
}

/**
 * Bounds in millimetres, matching the twin-record `dimensions_mm` shape.
 */
export function boundsToDimensionsMm(bounds) {
  if (!bounds) return null;
  return {
    width: Math.round(bounds.size[0] * 1000),
    height: Math.round(bounds.size[1] * 1000),
    depth: Math.round(bounds.size[2] * 1000)
  };
}
