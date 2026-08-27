/**
 * Render profiles.
 *
 * One geometry graph, several ways of seeing it. The profile decides materials, sky, fog and
 * lighting — never what exists. Switching from INTELLIGENCE to REALISTIC changes presentation,
 * not evidence: the same objects, the same positions, the same claims.
 *
 * Browser module: requires WebGL.
 */
import * as THREE from "three";
import {evidenceHex} from "./evidence.mjs";

export const PROFILE_INTELLIGENCE = "INTELLIGENCE";
export const PROFILE_REALISTIC = "REALISTIC";
export const PROFILE_COMPARE = "COMPARE";

export const PROFILE_CAPTIONS = Object.freeze({
  INTELLIGENCE: "Evidence colours expose source status and uncertainty.",
  REALISTIC: "Natural materials and daylight. Presentation only — the geometry and its claims are unchanged.",
  COMPARE: "One twin, one camera: analytical evidence beside realistic context."
});

/** Default natural palette by element type. A scene's own vocabulary can override any entry. */
export const DEFAULT_REALISTIC_PALETTE = Object.freeze({
  TERRAIN: 0x71905f,
  PLOT: 0x9fb47f,
  ROAD: 0x525554,
  CONTEXT_BUILDING: 0xddd4c5,
  CONCEPT_BUILDING: 0xe6dfd1,
  ROOM: 0xd6cab3,
  OPENING: 0x83b2bd,
  FURNITURE: 0x936e55,
  POI: 0xd3a14c,
  VIEW_DIRECTION: 0x9c6171,
  ENVIRONMENTAL_ANCHOR: 0xe2b85f,
  ANCHOR: 0x2f765f,
  PROPERTY_BOUNDARY: 0x1a6b4a
});

const CONTEXT_BUILDING_WALLS = [0xb84e3f, 0xd8cbb7, 0xe4ddca, 0xb99d79];
const CONTEXT_BUILDING_ROOFS = [0x3f4241, 0x6d4032, 0x7e5140];

const FALLBACK_COLOR = 0xb6aa91;

export const PROFILE_ENVIRONMENTS = Object.freeze({
  INTELLIGENCE: {
    background: 0xd9e0db,
    fog: {color: 0xd9e0db, near: 260, far: 620},
    hemisphere: {sky: 0xffffff, ground: 0x68766e, intensity: 1.65},
    exposure: 1.03
  },
  REALISTIC: {
    background: 0x9fc1cf,
    fog: {color: 0xb8ced0, near: 235, far: 720},
    hemisphere: {sky: 0xeaf5ff, ground: 0x55684b, intensity: 1.3},
    exposure: 1.18
  }
});

/** Stable per-id variation, so neighbouring context buildings are not all the same colour. */
function idHash(id) {
  return [...String(id)].reduce((sum, character) => sum + character.charCodeAt(0), 0);
}

export function createMaterialFactory({realisticPalette = {}} = {}) {
  const palette = {...DEFAULT_REALISTIC_PALETTE, ...realisticPalette};
  const owned = new Set();

  function track(material) {
    owned.add(material);
    return material;
  }

  function intelligence(element, {opacity = 1} = {}) {
    return track(new THREE.MeshStandardMaterial({
      color: evidenceHex(element.evidence_class),
      roughness: 0.8,
      metalness: 0.02,
      transparent: opacity < 1,
      opacity,
      side: THREE.DoubleSide
    }));
  }

  function realistic(element, {opacity = 1, variant = "base", textures = null} = {}) {
    const type = element.type;
    let color = palette[type] ?? FALLBACK_COLOR;
    if (type === "CONTEXT_BUILDING") {
      color = variant === "roof"
        ? CONTEXT_BUILDING_ROOFS[idHash(element.id) % CONTEXT_BUILDING_ROOFS.length]
        : CONTEXT_BUILDING_WALLS[idHash(element.id) % CONTEXT_BUILDING_WALLS.length];
    } else if (variant === "roof") {
      color = 0x3a4943;
    }
    const isGlazing = type === "OPENING";
    const material = track(new THREE.MeshStandardMaterial({
      color,
      roughness: isGlazing ? 0.16 : 0.92,
      metalness: isGlazing ? 0.08 : 0.01,
      transparent: opacity < 1 || isGlazing,
      opacity: isGlazing ? 0.62 : opacity,
      side: THREE.DoubleSide
    }));
    if (textures) {
      if (type === "TERRAIN") material.map = textures.get("grass");
      if (type === "ROAD") material.map = textures.get("asphalt");
    }
    return material;
  }

  return {
    intelligence,
    realistic,
    dispose() {
      for (const material of owned) material.dispose();
      owned.clear();
    }
  };
}

/**
 * Apply a profile to a built scene graph. Meshes carry both materials from construction, so
 * switching is a pointer swap rather than a rebuild — profile changes must be free.
 */
export function applyProfile(profileName, {scene, root, realismDecor, labelGroup, hemisphere, renderer, labelsVisible = true, depth = null}) {
  const name = profileName === PROFILE_COMPARE ? PROFILE_INTELLIGENCE : profileName;
  const environment = PROFILE_ENVIRONMENTS[name] ?? PROFILE_ENVIRONMENTS.INTELLIGENCE;
  const realistic = name === PROFILE_REALISTIC;

  scene.background = new THREE.Color(environment.background);
  // Fog distances come from the scene's own extents when it declares them: hardcoded distances
  // tuned on one site turn a larger site into haze and give a smaller one no depth cue at all.
  scene.fog = new THREE.Fog(
    environment.fog.color,
    depth?.fogNear ?? environment.fog.near,
    depth?.fogFar ?? environment.fog.far
  );
  hemisphere.color.set(environment.hemisphere.sky);
  hemisphere.groundColor.set(environment.hemisphere.ground);
  hemisphere.intensity = environment.hemisphere.intensity;
  renderer.toneMappingExposure = environment.exposure;

  if (realismDecor) realismDecor.visible = realistic;
  if (labelGroup) labelGroup.visible = labelsVisible && !realistic;

  root.traverse(object => {
    if (object.isMesh && object.userData.intelligenceMaterial) {
      object.material = realistic ? object.userData.realisticMaterial : object.userData.intelligenceMaterial;
    }
    if (object.userData.intelligenceOnly) object.visible = !realistic;
  });
}
