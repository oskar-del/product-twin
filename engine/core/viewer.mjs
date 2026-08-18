/**
 * Renderer, camera, controls, loop.
 *
 * The five lines every viewer in this repository re-wrote by hand, written once: colour space,
 * tone mapping, pixel-ratio cap, soft shadows, resize. Plus the scissor split-render that makes
 * COMPARE a single camera showing two profiles rather than two cameras pretending to agree.
 *
 * Browser module: requires WebGL.
 */
import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";

export const DEFAULT_PIXEL_RATIO_CAP = 2;

export function createViewer({
  mount,
  fov = 45,
  near = 0.1,
  far = 1400,
  minDistance = 0.7,
  maxDistance = 600,
  pixelRatioCap = DEFAULT_PIXEL_RATIO_CAP
} = {}) {
  if (!mount) throw new TypeError("createViewer requires a mount element");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, mount.clientWidth / mount.clientHeight || 1, near, far);

  const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: "high-performance"});
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, pixelRatioCap));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;
  mount.prepend(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = minDistance;
  controls.maxDistance = maxDistance;

  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x68766e, 1.65);
  const sun = new THREE.DirectionalLight(0xfff1cf, 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -180, right: 180, top: 180, bottom: -180});
  // Without a bias, a low sun over a large terrain self-shadows into stripes (shadow acne).
  // normalBias offsets along the surface normal, which suits big flat ground planes.
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.9;
  scene.add(hemisphere, sun, sun.target);

  function size() {
    const width = mount.clientWidth || globalThis.innerWidth;
    const height = mount.clientHeight || globalThis.innerHeight;
    return {width, height};
  }

  function resize() {
    const {width, height} = size();
    // updateStyle must stay on: with it off the canvas keeps its drawing-buffer size as its
    // CSS size, so on a 2x display the scene renders twice as large as the viewport.
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const onResize = () => resize();
  globalThis.addEventListener("resize", onResize);
  resize();

  let loop = null;

  return {
    scene,
    camera,
    renderer,
    controls,
    hemisphere,
    sun,
    size,
    resize,

    /**
     * Render one frame. `passes` is a list of {profile, applyProfile} — one entry paints the
     * whole canvas, two split it down the middle.
     */
    render(passes) {
      const {width, height} = size();
      if (passes.length === 1) {
        renderer.setScissorTest(false);
        camera.aspect = width / height;
        camera.fov = fov;
        camera.updateProjectionMatrix();
        passes[0].applyProfile(passes[0].profile);
        renderer.setViewport(0, 0, width, height);
        renderer.render(scene, camera);
        return;
      }
      renderer.setScissorTest(true);
      const left = Math.floor(width / 2);
      const widths = [left, width - left];
      let x = 0;
      passes.forEach((pass, index) => {
        renderer.setViewport(x, 0, widths[index], height);
        renderer.setScissor(x, 0, widths[index], height);
        camera.aspect = widths[index] / height;
        camera.fov = fov * 1.38;
        camera.updateProjectionMatrix();
        pass.applyProfile(pass.profile);
        renderer.render(scene, camera);
        x += widths[index];
      });
      renderer.setScissorTest(false);
    },

    start(onFrame) {
      loop = onFrame;
      renderer.setAnimationLoop(() => loop?.(performance.now()));
    },

    stop() {
      renderer.setAnimationLoop(null);
      loop = null;
    },

    dispose() {
      this.stop();
      globalThis.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
