/**
 * Procedural surface textures.
 *
 * Generated in a canvas rather than shipped as image files: a twin scene must stay
 * self-contained enough to bundle into one HTML file, and grass that is a 3 KB function beats
 * grass that is a 400 KB JPEG nobody has rights to.
 *
 * Browser module: requires document + WebGL.
 */
import * as THREE from "three";

/** Deterministic PRNG so a scene renders identically every load and in every bundle. */
export function seededRandom(seed) {
  let state = seed | 0;
  return () => {
    state = (state * 1664525 + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
}

const RECIPES = {
  grass: {seed: 5401, base: "#6f8c59", flecks: 1800, dark: "rgba(40,69,36,.19)", light: "rgba(198,207,139,.12)", streak: 3, repeat: 18},
  gravel: {seed: 5402, base: "#817967", flecks: 2600, dark: "rgba(30,30,28,.14)", light: "rgba(235,224,197,.14)", streak: 1, repeat: 8},
  asphalt: {seed: 5403, base: "#575855", flecks: 2600, dark: "rgba(30,30,28,.14)", light: "rgba(235,224,197,.14)", streak: 1, repeat: 8, seams: true},
  sand: {seed: 5404, base: "#c9b896", flecks: 2200, dark: "rgba(120,100,70,.12)", light: "rgba(245,235,210,.16)", streak: 1, repeat: 12}
};

export const TEXTURE_KINDS = Object.freeze(Object.keys(RECIPES));

export function proceduralTexture(kind) {
  const recipe = RECIPES[kind];
  if (!recipe) throw new RangeError(`unknown texture kind "${kind}" (${TEXTURE_KINDS.join(", ")})`);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d");
  const random = seededRandom(recipe.seed);

  context.fillStyle = recipe.base;
  context.fillRect(0, 0, 256, 256);
  for (let i = 0; i < recipe.flecks; i += 1) {
    context.fillStyle = random() < 0.5 ? recipe.dark : recipe.light;
    const width = 0.5 + random() * 1.5;
    context.fillRect(random() * 256, random() * 256, width, width * recipe.streak);
  }
  if (recipe.seams) {
    context.strokeStyle = "rgba(245,240,223,.035)";
    for (let i = 0; i < 26; i += 1) {
      context.beginPath();
      context.moveTo(random() * 256, 0);
      context.lineTo(random() * 256, 256);
      context.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(recipe.repeat, recipe.repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Lazily built, shared across every mesh in a page. */
export function createTextureLibrary() {
  const cache = new Map();
  return {
    get(kind) {
      if (!cache.has(kind)) cache.set(kind, proceduralTexture(kind));
      return cache.get(kind);
    },
    dispose() {
      for (const texture of cache.values()) texture.dispose();
      cache.clear();
    }
  };
}
