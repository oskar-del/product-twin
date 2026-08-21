/**
 * Merge context-building meshes into a small number of batched geometries.
 *
 * The scene document keeps one element per building — honest, inspectable, evidence-class per
 * building. But the renderer must not create one draw call per building: at 500 buildings with
 * body + roof each, that's 1000 draw calls against a 400 ceiling.
 *
 * This module runs AFTER the scene builder has created individual meshes. It replaces them
 * with merged geometries grouped by material bucket (wall colour / roof colour), so the GPU
 * draws hundreds of buildings in ~6–8 calls.
 *
 * Picking is preserved: each triangle in the merged geometry carries an element index in a
 * vertex attribute, so a raycaster hit can be traced back to the original element.
 *
 * Browser module: requires WebGL (three.js).
 */

import * as THREE from "three";

const MERGE_THRESHOLD = 20;

/**
 * Merge context buildings in a built scene graph.
 *
 * @param {THREE.Group} root        the twin-scene root group
 * @param {Map} byId                element id → three.js object map (mutated: merged entries point to merged mesh)
 * @param {Array} clickable         picking list (mutated: individual meshes replaced by merged)
 * @returns {{merged: boolean, draws_before: number, draws_after: number}}
 */
export function mergeContextBuildings(root, byId, clickable) {
  const contextObjects = [];
  const contextElementIds = new Set();

  for (const [id, object] of byId.entries()) {
    if (object.userData.elementType === "CONTEXT_BUILDING") {
      contextObjects.push({id, object});
      contextElementIds.add(id);
    }
  }

  if (contextObjects.length < MERGE_THRESHOLD) {
    return {merged: false, draws_before: contextObjects.length * 2, draws_after: contextObjects.length * 2};
  }

  const drawsBefore = countDrawCalls(contextObjects.map(o => o.object));

  // Collect all meshes grouped by their material color (our proxy for material bucket).
  // Context buildings have body (wall colour) + roof (roof colour) — group by hex to merge
  // all same-coloured bodies together, and all same-coloured roofs together.
  const buckets = new Map();

  for (const {id, object} of contextObjects) {
    object.traverse(child => {
      if (!child.isMesh) return;
      const material = child.material;
      const key = materialKey(material);
      if (!buckets.has(key)) {
        buckets.set(key, {material: material.clone(), meshes: [], elementIds: []});
      }
      const bucket = buckets.get(key);
      bucket.meshes.push(child);
      bucket.elementIds.push(id);
    });
  }

  const mergedGroup = new THREE.Group();
  mergedGroup.name = "twin-context-merged";
  const newClickables = [];

  for (const [, bucket] of buckets) {
    const {geometry, elementIndexMap} = mergeGeometries(bucket.meshes, bucket.elementIds);
    const merged = new THREE.Mesh(geometry, bucket.material);
    merged.castShadow = true;
    merged.receiveShadow = true;
    merged.userData.mergedContext = true;
    merged.userData.elementIndexMap = elementIndexMap;
    merged.userData.intelligenceMaterial = bucket.material;
    merged.userData.realisticMaterial = bucket.material;
    mergedGroup.add(merged);
    newClickables.push(merged);
  }

  // Remove individual context objects from root
  for (const {id, object} of contextObjects) {
    object.removeFromParent();
    disposeObject(object);
    byId.delete(id);
  }

  // Remove old context buildings from clickable list
  const oldClickableSet = new Set();
  for (const {object} of contextObjects) {
    object.traverse(child => { if (child.isMesh) oldClickableSet.add(child); });
  }
  for (let i = clickable.length - 1; i >= 0; i--) {
    if (oldClickableSet.has(clickable[i])) clickable.splice(i, 1);
  }

  // Add merged meshes
  root.add(mergedGroup);
  for (const mesh of newClickables) clickable.push(mesh);

  // Update byId to point to the merged group for each element
  for (const {id} of contextObjects) {
    byId.set(id, mergedGroup);
  }

  const drawsAfter = buckets.size;

  return {merged: true, draws_before: drawsBefore, draws_after: drawsAfter, buckets: buckets.size, buildings: contextObjects.length};
}

/**
 * Resolve which element was clicked in a merged context mesh.
 * @param {THREE.Intersection} intersection  raycaster intersection
 * @returns {string|null}  element id or null
 */
export function resolveContextPick(intersection) {
  const mesh = intersection.object;
  if (!mesh.userData.mergedContext) return null;
  const map = mesh.userData.elementIndexMap;
  if (!map) return null;
  const faceIndex = intersection.faceIndex;
  if (faceIndex == null) return null;
  const triIndex = faceIndex;
  for (const {elementId, startTriangle, triangleCount} of map) {
    if (triIndex >= startTriangle && triIndex < startTriangle + triangleCount) {
      return elementId;
    }
  }
  return null;
}

function materialKey(material) {
  const c = material.color;
  return `${c.r.toFixed(4)}_${c.g.toFixed(4)}_${c.b.toFixed(4)}_${material.opacity.toFixed(2)}`;
}

function mergeGeometries(meshes, elementIds) {
  const positions = [];
  const normals = [];
  const indices = [];
  const elementIndexMap = [];
  let vertexOffset = 0;

  for (let m = 0; m < meshes.length; m++) {
    const mesh = meshes[m];
    const geo = mesh.geometry;
    if (!geo) continue;

    mesh.updateWorldMatrix(true, false);
    const matrix = mesh.matrixWorld;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);

    const pos = geo.getAttribute("position");
    const norm = geo.getAttribute("normal");
    if (!pos) continue;

    const startVertex = vertexOffset;
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
      v.applyMatrix4(matrix);
      positions.push(v.x, v.y, v.z);

      if (norm) {
        const n = new THREE.Vector3(norm.getX(i), norm.getY(i), norm.getZ(i));
        n.applyMatrix3(normalMatrix).normalize();
        normals.push(n.x, n.y, n.z);
      }
    }
    vertexOffset += pos.count;

    const idx = geo.getIndex();
    const startTriangle = indices.length / 3;
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getComponent(i) + startVertex);
      }
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices.push(startVertex + i);
      }
    }
    const triangleCount = (indices.length / 3) - startTriangle;

    elementIndexMap.push({elementId: elementIds[m], startTriangle, triangleCount});
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length) merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setIndex(indices);
  if (!normals.length) merged.computeVertexNormals();

  return {geometry: merged, elementIndexMap};
}

function countDrawCalls(objects) {
  let count = 0;
  for (const object of objects) {
    object.traverse(child => { if (child.isMesh) count++; });
  }
  return count;
}

function disposeObject(object) {
  object.traverse(child => {
    if (child.isMesh) {
      child.geometry?.dispose();
    }
  });
}
