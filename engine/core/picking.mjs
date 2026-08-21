/**
 * Click picking.
 *
 * Split-screen aware: in COMPARE the canvas holds two viewports sharing one camera, so a click
 * must be resolved against the half it landed in or the ray misses by half a screen.
 *
 * Merged-context aware: context buildings are merged into a few batched geometries for draw-call
 * efficiency. A hit on a merged mesh is resolved back to its source element via the triangle
 * index map attached to the mesh by merge-context.mjs.
 *
 * Browser module: requires WebGL.
 */
import * as THREE from "three";
import {resolveContextPick} from "../geometry/merge-context.mjs";

export function createPicker({renderer, camera, targets, sceneElements = []}) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function pick(event, {split = false} = {}) {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const halfWidth = split ? rect.width / 2 : rect.width;
    const offset = split && x >= halfWidth ? halfWidth : 0;

    pointer.x = ((x - offset) / halfWidth) * 2 - 1;
    pointer.y = -(y / rect.height) * 2 + 1;

    const previousAspect = camera.aspect;
    camera.aspect = halfWidth / rect.height;
    camera.updateProjectionMatrix();
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(targets, false).find(candidate =>
      candidate.object.userData.element || candidate.object.userData.mergedContext
    );
    camera.aspect = previousAspect;
    camera.updateProjectionMatrix();

    if (!hit) return null;
    if (hit.object.userData.element) return hit.object.userData.element;
    if (hit.object.userData.mergedContext) {
      const elementId = resolveContextPick(hit);
      if (elementId) return sceneElements.find(e => e.id === elementId) ?? null;
    }
    return null;
  }

  return {pick};
}
