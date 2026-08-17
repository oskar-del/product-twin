import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const canvas = document.querySelector("#living-room-alpha-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const [sceneManifest, cameraPack] = await Promise.all([
  fetch("/files/data/media/room-lab/v0.1/scene-manifest.json", { cache: "no-store" }).then(assertResponse).then((response) => response.json()),
  fetch("/files/data/media/room-alpha/v0.1/camera-pack.json", { cache: "no-store" }).then(assertResponse).then((response) => response.json())
]);

function assertResponse(response) {
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.url}`);
  return response;
}

function standardMaterial(spec) {
  return new THREE.MeshStandardMaterial({ color: spec.colour_hex, roughness: spec.roughness });
}

function physicalMaterial(spec) {
  return new THREE.MeshPhysicalMaterial({
    color: spec.colour_hex,
    roughness: spec.roughness,
    transmission: spec.transmission,
    transparent: spec.transparent,
    opacity: spec.opacity
  });
}

function addBox(scene, id, centre, size, material, castShadow, receiveShadow) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = id;
  mesh.position.fromArray(centre);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  scene.add(mesh);
  return mesh;
}

function buildRoomShell(scene) {
  const shell = sceneManifest.shell;
  addBox(scene, "ROOM_FLOOR", shell.floor.centre_m, shell.floor.size_m, standardMaterial(shell.floor.material), shell.floor.cast_shadow, shell.floor.receive_shadow);
  for (const wall of shell.walls) addBox(scene, wall.id, wall.centre_m, wall.size_m, standardMaterial(wall.material), wall.cast_shadow, wall.receive_shadow);
  for (const fixture of shell.fixed_fixtures) addBox(scene, fixture.id, fixture.centre_m, fixture.size_m, standardMaterial(fixture.material), fixture.cast_shadow, fixture.receive_shadow);
  for (const overlay of shell.visual_overlays) {
    addBox(scene, overlay.id, overlay.centre_m, overlay.size_m, physicalMaterial(overlay.material), false, false);
    const frameMaterial = standardMaterial(overlay.frame_material);
    overlay.frame_bars.forEach((bar, index) => addBox(scene, `${overlay.id}_FRAME_${index + 1}`, bar.centre_m, bar.size_m, frameMaterial, false, false));
  }
}

function buildLighting(scene) {
  for (const lightSpec of sceneManifest.lighting.lights) {
    let light;
    if (lightSpec.kind === "hemisphere") {
      light = new THREE.HemisphereLight(lightSpec.sky_hex, lightSpec.ground_hex, lightSpec.intensity);
    } else {
      light = new THREE.DirectionalLight(lightSpec.colour_hex, lightSpec.intensity);
      light.position.fromArray(lightSpec.position_m);
      light.castShadow = lightSpec.casts_shadow;
      if (lightSpec.shadow) {
        light.shadow.mapSize.set(...lightSpec.shadow.map_size_px);
        Object.assign(light.shadow.camera, lightSpec.shadow.camera_bounds_m);
        light.shadow.camera.near = 0.1;
        light.shadow.camera.far = 30;
      }
    }
    light.name = lightSpec.id;
    scene.add(light);
  }
}

function materialTuple(material) {
  const list = Array.isArray(material) ? material : [material];
  return list.map((entry) => ({
    type: entry.type,
    color: entry.color?.getHexString() ?? null,
    roughness: entry.roughness ?? null,
    metalness: entry.metalness ?? null,
    opacity: entry.opacity,
    transparent: entry.transparent,
    transmission: entry.transmission ?? null,
    map: Boolean(entry.map),
    normalMap: Boolean(entry.normalMap)
  }));
}

function immutableMeshSignature(root) {
  const entries = [];
  root.traverse((object) => {
    if (!object.isMesh) return;
    entries.push({
      name: object.name,
      position_count: object.geometry?.attributes?.position?.count ?? 0,
      index_count: object.geometry?.index?.count ?? 0,
      materials: materialTuple(object.material)
    });
  });
  return JSON.stringify(entries);
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(sceneManifest.lighting.background_hex);
scene.fog = new THREE.Fog(sceneManifest.lighting.fog.colour_hex, sceneManifest.lighting.fog.near_m, sceneManifest.lighting.fog.far_m);
buildRoomShell(scene);
buildLighting(scene);

const gltfLoader = new GLTFLoader();
const placementRoots = new Map();

await Promise.all(sceneManifest.placements.map(async (placement) => {
  const gltf = await gltfLoader.loadAsync(`/files/${placement.avatar.asset_path}`);
  const root = gltf.scene;
  root.name = placement.placement_id;
  root.userData.placementId = placement.placement_id;
  root.userData.twinRef = placement.twin_ref;
  root.rotation.y = placement.transform.rotation_y_rad;
  root.scale.fromArray(placement.transform.scale);
  root.updateMatrixWorld(true);

  let bounds = new THREE.Box3().setFromObject(root);
  const centre = bounds.getCenter(new THREE.Vector3());
  root.position.x += placement.transform.translation_m[0] - centre.x;
  root.position.z += placement.transform.translation_m[2] - centre.z;
  root.updateMatrixWorld(true);

  bounds = new THREE.Box3().setFromObject(root);
  root.position.y += placement.transform.translation_m[1] - bounds.min.y;
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = sceneManifest.rendering.loader_floor_contact_contract.mesh_cast_shadow;
    object.receiveShadow = sceneManifest.rendering.loader_floor_contact_contract.mesh_receive_shadow;
  });
  root.userData.immutableMeshSignature = immutableMeshSignature(root);
  root.userData.expectedTransform = structuredClone(placement.transform);
  scene.add(root);
  placementRoots.set(placement.placement_id, root);
}));

if (placementRoots.size !== 8) throw new Error(`Expected 8 placement roots, found ${placementRoots.size}`);

function rounded(number) {
  return Math.abs(number) < 1e-14 ? 0 : Number(number.toFixed(12));
}

function auditScene() {
  const placements = sceneManifest.placements.map((placement) => {
    const root = placementRoots.get(placement.placement_id);
    const bounds = new THREE.Box3().setFromObject(root);
    const centre = bounds.getCenter(new THREE.Vector3());
    return {
      placement_id: placement.placement_id,
      twin_ref: root.userData.twinRef,
      rotation_y_rad: rounded(root.rotation.y),
      bounds_centre_xz_m: [rounded(centre.x), rounded(centre.z)],
      bounds_min_y_m: rounded(bounds.min.y),
      expected_translation_m: placement.transform.translation_m,
      geometry_and_material_unchanged: immutableMeshSignature(root) === root.userData.immutableMeshSignature
    };
  });
  const failures = [];
  for (const placement of placements) {
    const expected = placement.expected_translation_m;
    if (Math.abs(placement.bounds_centre_xz_m[0] - expected[0]) > 1e-9 || Math.abs(placement.bounds_centre_xz_m[1] - expected[2]) > 1e-9) failures.push(`${placement.placement_id}: XZ centre drift`);
    if (Math.abs(placement.bounds_min_y_m - expected[1]) > 1e-9) failures.push(`${placement.placement_id}: floor contact drift`);
    const expectedRotation = sceneManifest.placements.find((entry) => entry.placement_id === placement.placement_id).transform.rotation_y_rad;
    if (Math.abs(placement.rotation_y_rad - expectedRotation) > 1e-9) failures.push(`${placement.placement_id}: rotation drift`);
    if (!placement.geometry_and_material_unchanged) failures.push(`${placement.placement_id}: geometry/material drift`);
  }
  if (placements.length !== 8 || new Set(placements.map((placement) => placement.twin_ref)).size !== 8) failures.push("placement identity/count drift");
  if (sceneManifest.shell.opening_claims.length !== 0 || sceneManifest.shell.visual_overlays.length !== 1) failures.push("shell opening/overlay drift");
  return {
    pass: failures.length === 0,
    failures,
    placement_count: placements.length,
    unique_twin_count: new Set(placements.map((placement) => placement.twin_ref)).size,
    placements,
    shell_dimensions_m: [sceneManifest.shell.width_m, sceneManifest.shell.depth_m, sceneManifest.shell.height_m],
    authoritative_opening_count: sceneManifest.shell.opening_claims.length,
    assumed_overlay_count: sceneManifest.shell.visual_overlays.length,
    mutation_counts: { geometry: 0, material: 0, placement: 0, light: 0 }
  };
}

function auditCameraCollision(camera) {
  const inside_placement_ids = [];
  for (const [placementId, root] of placementRoots) {
    if (new THREE.Box3().setFromObject(root).containsPoint(camera.position)) inside_placement_ids.push(placementId);
  }
  return { pass: inside_placement_ids.length === 0, inside_placement_ids };
}

function applyVisibilityPolicy(cameraSpec) {
  const visible = cameraSpec.visibility_policy === "ALL_PLACEMENTS"
    ? new Set(sceneManifest.placements.map((placement) => placement.placement_id))
    : cameraSpec.visibility_policy === "CLEARANCE_PAIR_PLUS_SHELL"
      ? new Set(["kivik-placement-01", "listerby-placement-01"])
      : new Set([cameraSpec.selected_placement_id]);
  for (const [placementId, root] of placementRoots) root.visible = visible.has(placementId);
  return [...visible].sort();
}

function makeCamera(spec, width, height) {
  let camera;
  if (spec.projection === "ORTHOGRAPHIC") {
    const bounds = spec.orthographic_bounds_m;
    camera = new THREE.OrthographicCamera(bounds.left, bounds.right, bounds.top, bounds.bottom, spec.near_m, spec.far_m);
  } else {
    camera = new THREE.PerspectiveCamera(spec.vertical_fov_deg, width / height, spec.near_m, spec.far_m);
  }
  camera.position.fromArray(spec.position_m);
  camera.up.fromArray(spec.up_vector);
  camera.lookAt(new THREE.Vector3().fromArray(spec.target_m));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

function renderWithCamera(camera, width, height) {
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  if (camera.isPerspectiveCamera) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  renderer.getContext().finish();
}

async function pixelAudit(width, height) {
  const pixels = new Uint8Array(width * height * 4);
  const context = renderer.getContext();
  context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels);
  let allOpaque = true;
  let minimum = 255;
  let maximum = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    minimum = Math.min(minimum, pixels[index], pixels[index + 1], pixels[index + 2]);
    maximum = Math.max(maximum, pixels[index], pixels[index + 1], pixels[index + 2]);
    if (pixels[index + 3] !== 255) allOpaque = false;
  }
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", pixels));
  return { rgba_sha256: [...hash].map((value) => value.toString(16).padStart(2, "0")).join(""), all_opaque: allOpaque, nonblank: maximum > minimum, rgb_min: minimum, rgb_max: maximum };
}

async function renderCamera(cameraId, width, height) {
  const cameraSpec = cameraPack.cameras.find((entry) => entry.camera_id === cameraId);
  if (!cameraSpec) throw new Error(`Unknown alpha camera ${cameraId}`);
  if (width !== cameraSpec.resolution_px.width || height !== cameraSpec.resolution_px.height) throw new Error(`Resolution mismatch for ${cameraId}`);
  const visible_placement_ids = applyVisibilityPolicy(cameraSpec);
  const camera = makeCamera(cameraSpec, width, height);
  renderWithCamera(camera, width, height);
  const audit = auditScene();
  if (!audit.pass) throw new Error(audit.failures.join("; "));
  const camera_collision = auditCameraCollision(camera);
  if (!camera_collision.pass) throw new Error(`Camera is inside: ${camera_collision.inside_placement_ids.join(", ")}`);
  return { camera_id: cameraId, role: cameraSpec.role, visibility_policy: cameraSpec.visibility_policy, visible_placement_ids, width, height, camera: { position_m: camera.position.toArray(), projection: cameraSpec.projection }, camera_collision, audit, pixels: await pixelAudit(width, height) };
}

window.roomAlphaMedia = {
  ready: true,
  renderer_version: THREE.REVISION,
  renderCamera,
  auditScene
};
