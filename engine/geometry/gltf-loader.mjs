/**
 * glTF/GLB avatar loader for the twin-engine.
 *
 * Loads a .glb file and wraps it as a scene-graph object dressed with dual materials
 * and picking, matching the engine's evidence/profile contract. A loaded avatar is
 * still subject to evidence rules: the intelligence profile shows it in its evidence
 * colour, and the realistic profile shows its own PBR materials.
 *
 * Browser module: requires WebGL + three.js GLTFLoader.
 */

import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {evidenceHex} from "../core/evidence.mjs";

const loader = new GLTFLoader();

/**
 * Load a glTF/GLB asset.
 *
 * @param {string} url            path to the .glb file
 * @param {object} element        scene element this avatar belongs to
 * @param {object} materials      material factory from core/profiles.mjs
 * @returns {Promise<{group: THREE.Group, meshes: THREE.Mesh[]}>}
 */
export function loadAvatar({url, element, materials}) {
  return new Promise((resolve, reject) => {
    loader.load(url, gltf => {
      const group = new THREE.Group();
      group.name = `avatar-${element.id}`;
      const meshes = [];

      gltf.scene.traverse(child => {
        if (!child.isMesh) return;

        child.userData.element = element;
        child.userData.realisticMaterial = child.material;

        child.userData.intelligenceMaterial = new THREE.MeshStandardMaterial({
          color: evidenceHex(element.evidence_class),
          roughness: 0.8,
          metalness: 0.02,
          side: THREE.DoubleSide
        });

        child.castShadow = true;
        child.receiveShadow = true;
        meshes.push(child);
      });

      // Apply placement from geometry spec
      const geometry = element.geometry;
      if (geometry.position) {
        group.position.set(...geometry.position);
      }
      if (geometry.rotation_y_deg != null) {
        group.rotation.y = THREE.MathUtils.degToRad(geometry.rotation_y_deg);
      }
      if (geometry.scale) {
        const s = Array.isArray(geometry.scale) ? geometry.scale : [geometry.scale, geometry.scale, geometry.scale];
        group.scale.set(...s);
      }

      group.add(gltf.scene);
      group.userData.element = element;
      group.userData.elementType = element.type;

      resolve({group, meshes});
    }, undefined, reject);
  });
}

/**
 * Load all GLTF elements from a parsed scene.
 *
 * @param {object} scene           parsed scene from scene-contract
 * @param {object} materials       material factory
 * @param {string} [basePath]      prefix for asset_path resolution
 * @returns {Promise<Map<string, {group, meshes}>>}  element id → loaded avatar
 */
export async function loadSceneAvatars({scene, materials, basePath = ""}) {
  const avatars = new Map();
  const loads = [];

  for (const element of scene.elements) {
    const assetPath = element.geometry?.asset_path;
    if (!assetPath) continue;

    const url = basePath ? `${basePath}/${assetPath}` : assetPath;
    loads.push(
      loadAvatar({url, element, materials})
        .then(result => avatars.set(element.id, result))
        .catch(error => {
          console.warn(`avatar load failed for ${element.id}: ${error.message}`);
        })
    );
  }

  await Promise.all(loads);
  return avatars;
}
