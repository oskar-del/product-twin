/**
 * Click picking.
 *
 * Split-screen aware: in COMPARE the canvas holds two viewports sharing one camera, so a click
 * must be resolved against the half it landed in or the ray misses by half a screen.
 *
 * Browser module: requires WebGL.
 */
import * as THREE from "three";

export function createPicker({renderer, camera, targets}) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  /**
   * @param {PointerEvent} event
   * @param {boolean} split  true when the canvas is showing two viewports side by side
   * @returns {object|null}  the scene element under the cursor
   */
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
    const hit = raycaster.intersectObjects(targets, false).find(candidate => candidate.object.userData.element);
    camera.aspect = previousAspect;
    camera.updateProjectionMatrix();

    return hit ? hit.object.userData.element : null;
  }

  return {pick};
}
