/**
 * Scene-element → three.js geometry.
 *
 * Nine primitives, one builder each. Every mesh is constructed with BOTH profile materials
 * attached to userData, tagged with its source element, and registered for picking — so
 * "click a thing, see its evidence" and "switch profile" are properties of the engine rather
 * than of any one viewer.
 *
 * SOLAR_ARC is implemented here for the first time: the Svärtinge viewer declared the element
 * in its scene and silently dropped it on the floor (its buildElement had no branch for it).
 *
 * Browser module: requires WebGL.
 */
import * as THREE from "three";
import {evidenceHex} from "../core/evidence.mjs";
import {createLabelSprite} from "./labels.mjs";
import {solarDirection} from "../studies/sun.mjs";

const OPACITY = {
  ROOM: {intelligence: 0.15, realistic: 0.08},
  OPENING: {intelligence: 0.48, realistic: 1},
  TERRAIN: {intelligence: 0.86, realistic: 1},
  PLOT: {intelligence: 0.72, realistic: 0.18},
  ROAD: {intelligence: 0.84, realistic: 1},
  PROPERTY_BOUNDARY: {intelligence: 0.55, realistic: 0.25}
};

const opacityFor = element => OPACITY[element.type] ?? {intelligence: 1, realistic: 1};

/**
 * @param {object} options
 * @param {object} options.materials    material factory from core/profiles.mjs
 * @param {object} [options.textures]   texture library from geometry/textures.mjs; omit to build
 *                                      without canvas textures (lets a Node gate build the graph)
 * @param {boolean} [options.labels]    false skips canvas sprite labels, for the same reason
 */
export function createSceneBuilder({materials, textures = null, labels: labelsEnabled = true}) {
  const root = new THREE.Group();
  const labelGroup = new THREE.Group();
  const poiGroup = new THREE.Group();
  const clickable = [];
  const byId = new Map();
  const geometries = new Set();
  let terrainMesh = null;

  root.name = "twin-scene";
  poiGroup.name = "twin-poi";
  labelGroup.name = "twin-labels";
  root.add(poiGroup);

  function ownGeometry(geometry) {
    geometries.add(geometry);
    return geometry;
  }

  /** Attach dual materials + element identity. Every visible object goes through here. */
  function dress(mesh, element, {variant = "base"} = {}) {
    const opacity = opacityFor(element);
    mesh.userData.element = element;
    mesh.userData.intelligenceMaterial = materials.intelligence(element, {opacity: opacity.intelligence});
    mesh.userData.realisticMaterial = materials.realistic(element, {opacity: opacity.realistic, variant, textures});
    mesh.material = mesh.userData.intelligenceMaterial;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function pickable(object, element) {
    object.userData.element = element;
    clickable.push(object);
    return object;
  }

  function label(text, element, {scale = 1, position = [0, 0, 0]} = {}) {
    if (!labelsEnabled) return null;
    const sprite = createLabelSprite(text, element.evidence_class, {scale});
    sprite.position.set(...position);
    sprite.userData.elementId = element.id;
    labelGroup.add(sprite);
    return sprite;
  }

  const BUILDERS = {
    GRID_SURFACE(element, geometry) {
      const bufferGeometry = ownGeometry(new THREE.BufferGeometry());
      const positions = [];
      for (const vertex of geometry.vertices) positions.push(...vertex);
      const stride = geometry.segments + 1;
      const indices = [];
      for (let z = 0; z < geometry.segments; z += 1) {
        for (let x = 0; x < geometry.segments; x += 1) {
          const a = z * stride + x;
          indices.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1);
        }
      }
      bufferGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      bufferGeometry.setIndex(indices);
      bufferGeometry.computeVertexNormals();

      const mesh = pickable(dress(new THREE.Mesh(bufferGeometry), element), element);
      const wireframe = new THREE.LineSegments(
        ownGeometry(new THREE.WireframeGeometry(bufferGeometry)),
        new THREE.LineBasicMaterial({color: 0x82968a, transparent: true, opacity: 0.18})
      );
      wireframe.userData.intelligenceOnly = true;
      mesh.add(wireframe);
      terrainMesh = mesh;
      return mesh;
    },

    EXTRUDED_POLYGON(element, geometry) {
      const shape = new THREE.Shape();
      geometry.points_xz.forEach(([x, z], index) => (index ? shape.lineTo(x, z) : shape.moveTo(x, z)));
      shape.closePath();
      const extruded = ownGeometry(new THREE.ExtrudeGeometry(shape, {depth: geometry.height, bevelEnabled: false}));
      extruded.rotateX(Math.PI / 2);

      const mesh = pickable(dress(new THREE.Mesh(extruded), element), element);
      mesh.position.y = geometry.base_y;
      const outline = new THREE.LineSegments(
        ownGeometry(new THREE.EdgesGeometry(extruded)),
        new THREE.LineBasicMaterial({color: evidenceHex(element.evidence_class)})
      );
      mesh.add(outline);
      label(element.label, element, {scale: 0.9, position: [0, geometry.base_y + 5, 0]});
      return mesh;
    },

    POLYLINE_RIBBON(element, geometry) {
      const group = new THREE.Group();
      for (let i = 0; i < geometry.points.length - 1; i += 1) {
        const from = new THREE.Vector3(...geometry.points[i]);
        const to = new THREE.Vector3(...geometry.points[i + 1]);
        const segment = dress(
          new THREE.Mesh(ownGeometry(new THREE.BoxGeometry(geometry.width_m, 0.12, from.distanceTo(to)))),
          element
        );
        segment.position.copy(from).add(to).multiplyScalar(0.5);
        segment.lookAt(to);
        segment.castShadow = false;
        pickable(segment, element);
        group.add(segment);
      }
      return group;
    },

    BOX(element, geometry) {
      const mesh = pickable(
        dress(new THREE.Mesh(ownGeometry(new THREE.BoxGeometry(...geometry.size))), element),
        element
      );
      mesh.position.set(...geometry.position);
      mesh.rotation.y = THREE.MathUtils.degToRad(geometry.rotation_y_deg ?? 0);
      if (element.type !== "CONTEXT_BUILDING") return mesh;

      // A context building is body + roof. They must be ONE object: a roof parented to the
      // root outlives its body when a stage hides the building, and a roof floating over an
      // empty plot is a false claim about what stands there.
      const building = new THREE.Group();
      const roof = pickable(
        dress(
          new THREE.Mesh(ownGeometry(new THREE.ConeGeometry(Math.max(geometry.size[0], geometry.size[2]) * 0.72, 1.7, 4))),
          element,
          {variant: "roof"}
        ),
        element
      );
      roof.position.set(geometry.position[0], geometry.position[1] + geometry.size[1] / 2 + 0.85, geometry.position[2]);
      roof.rotation.y = Math.PI / 4 + mesh.rotation.y;
      building.add(mesh, roof);
      return building;
    },

    MARKER(element, geometry) {
      const group = new THREE.Group();
      const stem = dress(new THREE.Mesh(ownGeometry(new THREE.CylinderGeometry(0.11, 0.11, 3, 10))), element);
      stem.position.y = 1.5;
      group.add(stem);
      const head = pickable(dress(new THREE.Mesh(ownGeometry(new THREE.SphereGeometry(0.55, 18, 12))), element), element);
      head.position.y = 3.3;
      group.add(head);
      group.position.set(...geometry.position);
      label(element.label, element, {
        scale: 0.75,
        position: [geometry.position[0], geometry.position[1] + 5.4, geometry.position[2]]
      });
      return group;
    },

    DIRECTION_CONE(element, geometry) {
      const group = new THREE.Group();
      const length = geometry.length_m;
      const shaft = dress(new THREE.Mesh(ownGeometry(new THREE.CylinderGeometry(0.12, 0.18, length, 10))), element);
      shaft.rotation.z = Math.PI / 2;
      shaft.position.x = length / 2;
      group.add(shaft);
      const head = pickable(dress(new THREE.Mesh(ownGeometry(new THREE.ConeGeometry(2.1, 5, 20))), element), element);
      head.rotation.z = -Math.PI / 2;
      head.position.x = length;
      group.add(head);
      group.position.set(...geometry.origin);
      group.rotation.y = THREE.MathUtils.degToRad(90 - geometry.azimuth_deg);
      return group;
    },

    SOLAR_ARC(element, geometry) {
      const group = new THREE.Group();
      const radius = 90;
      const points = [];
      const marks = [];
      for (const hour of geometry.hours) {
        const direction = solarDirection({
          latitude: geometry.latitude_deg,
          longitude: geometry.longitude_deg,
          date: geometry.study_date,
          utcHour: hour
        });
        if (!direction) continue;
        const point = new THREE.Vector3(...direction).multiplyScalar(radius);
        points.push(point);
        marks.push({hour, point});
      }
      if (points.length > 1) {
        const line = new THREE.Line(
          ownGeometry(new THREE.BufferGeometry().setFromPoints(points)),
          new THREE.LineBasicMaterial({color: evidenceHex(element.evidence_class), transparent: true, opacity: 0.75})
        );
        line.userData.intelligenceOnly = true;
        group.add(line);
      }
      for (const {point} of marks) {
        const bead = pickable(dress(new THREE.Mesh(ownGeometry(new THREE.SphereGeometry(1.1, 10, 8))), element), element);
        bead.position.copy(point);
        bead.castShadow = false;
        bead.receiveShadow = false;
        group.add(bead);
      }
      group.userData.solarMarks = marks;
      return group;
    },

    GLTF_ASSET(element, geometry) {
      const group = new THREE.Group();
      group.name = `gltf-placeholder-${element.id}`;
      if (geometry.position) group.position.set(...geometry.position);
      if (geometry.rotation_y_deg != null) group.rotation.y = THREE.MathUtils.degToRad(geometry.rotation_y_deg);
      if (geometry.scale) {
        const s = Array.isArray(geometry.scale) ? geometry.scale : [geometry.scale, geometry.scale, geometry.scale];
        group.scale.set(...s);
      }
      // A placeholder sphere until the async GLTFLoader replaces this
      const placeholder = dress(new THREE.Mesh(
        ownGeometry(new THREE.SphereGeometry(0.3, 12, 8)), element
      ), element);
      placeholder.position.y = 0.3;
      pickable(placeholder, element);
      group.add(placeholder);
      group.userData.isGltfPlaceholder = true;
      group.userData.assetPath = geometry.asset_path;
      return group;
    }
  };
  BUILDERS.ROOM_VOLUME = BUILDERS.BOX;
  BUILDERS.DIAGRAMMATIC_MARKER = BUILDERS.MARKER;

  return {
    root,
    labelGroup,
    poiGroup,
    clickable,
    byId,
    get terrain() { return terrainMesh; },

    build(scene) {
      for (const element of scene.elements) {
        const builder = BUILDERS[element.geometry.primitive];
        if (!builder) throw new RangeError(`no builder for primitive ${element.geometry.primitive}`);
        const object = builder(element, element.geometry);
        object.userData.element = element;
        object.userData.elementType = element.type;
        byId.set(element.id, object);
        (element.geometry.primitive === "DIAGRAMMATIC_MARKER" ? poiGroup : root).add(object);
      }
      return {root, labelGroup, poiGroup, clickable, byId, terrain: terrainMesh};
    },

    dispose() {
      for (const geometry of geometries) geometry.dispose();
      geometries.clear();
      for (const sprite of labelGroup.children) {
        sprite.material.map?.dispose();
        sprite.material.dispose();
      }
    }
  };
}
