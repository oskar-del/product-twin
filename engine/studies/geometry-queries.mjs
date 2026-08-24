/**
 * Ray queries against a twin's actual geometry.
 *
 * The foundation for every MEASURED claim: does this terrace see the sea, does that villa's roof
 * block this window, how many hours of sun does this terrace get in March. Each answer is
 * computed by shooting rays at the same triangles the viewer is looking at — so the claim and
 * the picture can never disagree.
 *
 * three.js raycasting is pure maths: it needs no WebGL and no DOM, so every study here runs in a
 * Node gate as well as in a browser. That is the whole point — a spatial claim nobody can
 * re-derive on a build server is a claim nobody should publish.
 */
import * as THREE from "three";

import {createSceneBuilder} from "../geometry/primitives.mjs";
import {createMaterialFactory} from "../core/profiles.mjs";

/**
 * Build a raycastable copy of a parsed scene, headless.
 * @param {object} scene parsed twin-scene
 * @param {object} [options]
 * @param {string[]} [options.excludeTypes] element types that must not block a ray — diagrammatic
 *        markers, direction cones and solar arcs are annotations, not built form.
 */
export function createGeometryIndex(scene, {excludeTypes = ["POI", "VIEW_DIRECTION", "ENVIRONMENTAL_ANCHOR", "ANCHOR"]} = {}) {
  const materials = createMaterialFactory({});
  const builder = createSceneBuilder({materials, textures: null, labels: false});
  const built = builder.build(scene);

  const excluded = new Set(excludeTypes);
  const targets = [];
  built.root.traverse(object => {
    const element = object.userData.element;
    if (object.isMesh && element && !excluded.has(element.type)) targets.push(object);
  });
  built.root.updateMatrixWorld(true);

  const raycaster = new THREE.Raycaster();

  return {
    root: built.root,
    targets,
    elementCount: scene.elements.length,
    blockingCount: targets.length,

    /**
     * First blocking hit along a ray.
     * @returns {{element, point:number[], distance_m:number}|null}
     */
    cast(originVec, directionVec, maxDistance = Infinity, ignoreElementIds = new Set()) {
      raycaster.set(originVec, directionVec.clone().normalize());
      raycaster.far = maxDistance;
      for (const hit of raycaster.intersectObjects(targets, false)) {
        const element = hit.object.userData.element;
        if (ignoreElementIds.has(element.id)) continue;
        return {element, point: hit.point.toArray(), distance_m: hit.distance};
      }
      return null;
    },

    dispose() {
      builder.dispose();
      materials.dispose();
    }
  };
}

export function vec3(value) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
    throw new TypeError("expected [x, y, z] of finite numbers");
  }
  return new THREE.Vector3(...value);
}
