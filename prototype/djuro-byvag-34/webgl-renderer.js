// WebGL renderer for Djurö byväg 34 — adapted from the Svärtinge neighbourhood viewer.
// Uses window.THREE and window.OrbitControls (inlined IIFE bundle, no CDN).
// Reads scene data from window.__SCENE__ and geometry sources from window.__GEOM__.
(function () {
  "use strict";
  const data = window.__SCENE__;
  const officialGeometrySources = window.__GEOM__;
  if (!data || !officialGeometrySources) {
    document.getElementById("loading").classList.add("error");
    document.getElementById("loading").innerHTML = "Scene data not found.";
    return;
  }

  const colors = { AUTHORITATIVE: 0x176b52, INDICATIVE: 0xc18a2d, DERIVED: 0x497aa2, REPORTED_UNVERIFIED: 0xa65b68, CONCEPT: 0x735a9e };
  const cssColors = { AUTHORITATIVE: "#176b52", INDICATIVE: "#c18a2d", DERIVED: "#497aa2", REPORTED_UNVERIFIED: "#a65b68", CONCEPT: "#735a9e" };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 1400);
  camera.position.set(150, 125, 185);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.body.prepend(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.maxDistance = 600;
  controls.minDistance = 0.7;

  const backgrounds = { INTELLIGENCE: new THREE.Color(0xd9e0db), REALISTIC: new THREE.Color(0x9fc1cf) };
  const fogs = { INTELLIGENCE: new THREE.Fog(0xd9e0db, 260, 620), REALISTIC: new THREE.Fog(0xb8ced0, 235, 720) };

  const hemi = new THREE.HemisphereLight(0xffffff, 0x68766e, 1.65);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1cf, 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -180;
  sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180;
  sun.shadow.camera.bottom = -180;
  scene.add(sun, sun.target);

  const root = new THREE.Group();
  const labelGroup = new THREE.Group();
  const poiGroup = new THREE.Group();
  const realismDecor = new THREE.Group();
  scene.add(root, labelGroup, poiGroup, realismDecor);

  const clickable = [];
  const byId = new Map();
  let currentStep = 0, terrainObject = null, tween = null, mode = "INTELLIGENCE", labelsEnabled = true, stageLabelsAllowed = true;

  const panel = document.getElementById("panel");
  const panelType = document.getElementById("panelType");
  const panelTitle = document.getElementById("panelTitle");
  const panelBadge = document.getElementById("panelBadge");
  const panelBody = document.getElementById("panelBody");
  const closeButton = document.getElementById("close");
  const sourcesButton = document.getElementById("sourcesButton");
  const steps = document.getElementById("steps");
  const solarTime = document.getElementById("solarTime");
  const timeLabel = document.getElementById("timeLabel");
  const terrainToggle = document.getElementById("terrainToggle");
  const poiToggle = document.getElementById("poiToggle");
  const labelsToggle = document.getElementById("labelsToggle");
  const divider = document.getElementById("divider");
  const leftLabel = document.getElementById("leftLabel");
  const rightLabel = document.getElementById("rightLabel");
  const modeCaption = document.getElementById("modeCaption");
  const loading = document.getElementById("loading");
  const livePanel = document.getElementById("livePanel");
  const liveContextButton = document.getElementById("liveContextButton");
  const liveClose = document.getElementById("liveClose");
  const liveToken = document.getElementById("liveToken");
  const liveConnect = document.getElementById("liveConnect");
  const liveDisconnect = document.getElementById("liveDisconnect");
  const liveStatus = document.getElementById("liveStatus");
  const liveMap = document.getElementById("liveMap");

  function seededRandom(seed) {
    let x = seed | 0;
    return () => { x = (x * 1664525 + 1013904223) | 0; return (x >>> 0) / 4294967296; };
  }

  const intelligenceMat = (e, opacity) => {
    opacity = opacity === undefined ? 1 : opacity;
    return new THREE.MeshStandardMaterial({ color: colors[e], roughness: 0.8, metalness: 0.02, transparent: opacity < 1, opacity: opacity, side: THREE.DoubleSide });
  };

  const naturalPalette = {
    TERRAIN: 0x71905f, PLOT: 0x9fb47f, ROAD: 0x525554,
    CONTEXT_BUILDING: 0xddd4c5, CONCEPT_BUILDING: 0xe6dfd1,
    SITE_BUILDING_MAIN: 0xc83e2e, SITE_BUILDING_OUT: 0xd8cbb7,
    ROOM: 0xd6cab3, OPENING: 0x83b2bd, FURNITURE: 0x936e55,
    POI: 0xd3a14c, VIEW_DIRECTION: 0x9c6171,
    ENVIRONMENTAL_ANCHOR: 0xe2b85f, ADDRESS_MARKER: 0x2f765f,
    ANCHOR: 0x2f765f
  };

  function proceduralTexture(kind) {
    const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    canvas.width = canvas.height = 256;
    const random = seededRandom(kind === "grass" ? 5401 : kind === "gravel" ? 5402 : 5403);
    ctx.fillStyle = kind === "grass" ? "#6f8c59" : kind === "gravel" ? "#817967" : "#575855";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < (kind === "grass" ? 1800 : 2600); i++) {
      const shade = kind === "grass" ? (random() < 0.5 ? "rgba(40,69,36,.19)" : "rgba(198,207,139,.12)") : (random() < 0.5 ? "rgba(30,30,28,.14)" : "rgba(235,224,197,.14)");
      ctx.fillStyle = shade;
      const s = kind === "gravel" ? 0.6 + random() * 2 : 0.5 + random() * 1.2;
      ctx.fillRect(random() * 256, random() * 256, s, s * (kind === "grass" ? 3 : 1));
    }
    if (kind === "asphalt") {
      ctx.strokeStyle = "rgba(245,240,223,.035)";
      for (let i = 0; i < 26; i++) { ctx.beginPath(); ctx.moveTo(random() * 256, 0); ctx.lineTo(random() * 256, 256); ctx.stroke(); }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(kind === "grass" ? 18 : 8, kind === "grass" ? 18 : 8);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  const surfaceTextures = { grass: proceduralTexture("grass"), gravel: proceduralTexture("gravel"), asphalt: proceduralTexture("asphalt") };

  const naturalMat = (item, opacity, variant) => {
    opacity = opacity === undefined ? 1 : opacity;
    variant = variant || "base";
    let color = naturalPalette[item.type] || 0xb6aa91;
    if (item.type === "CONTEXT_BUILDING") {
      const palette = [0xb84e3f, 0xd8cbb7, 0xe4ddca, 0xb99d79];
      const index = [...item.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
      color = palette[index];
    }
    if (variant === "roof") {
      color = item.type === "CONTEXT_BUILDING"
        ? [0x3f4241, 0x6d4032, 0x7e5140][[...item.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3]
        : item.type === "SITE_BUILDING_MAIN" ? 0x3a2520 : 0x3a4943;
    }
    const material = new THREE.MeshStandardMaterial({
      color: color, roughness: item.type === "OPENING" ? 0.16 : 0.92, metalness: item.type === "OPENING" ? 0.08 : 0.01,
      transparent: opacity < 1 || item.type === "OPENING", opacity: item.type === "OPENING" ? 0.62 : opacity, side: THREE.DoubleSide
    });
    if (item.type === "TERRAIN") material.map = surfaceTextures.grass;
    if (item.type === "ROAD") material.map = surfaceTextures.asphalt;
    return material;
  };

  function profile(mesh, item, intelOpacity, naturalOpacity, variant) {
    intelOpacity = intelOpacity === undefined ? 1 : intelOpacity;
    naturalOpacity = naturalOpacity === undefined ? 1 : naturalOpacity;
    variant = variant || "base";
    mesh.userData.item = item;
    mesh.userData.intelligenceMaterial = intelligenceMat(item.evidence_class, intelOpacity);
    mesh.userData.realisticMaterial = naturalMat(item, naturalOpacity, variant);
    mesh.material = mesh.userData.intelligenceMaterial;
    return mesh;
  }

  function labelSprite(text, evidence, scale) {
    scale = scale || 1;
    const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    canvas.width = 512; canvas.height = 96;
    ctx.fillStyle = "rgba(247,244,236,.94)";
    ctx.roundRect(4, 4, 504, 88, 18); ctx.fill();
    ctx.strokeStyle = cssColors[evidence]; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = "#14231d"; ctx.font = "600 28px Inter, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text.slice(0, 42), 256, 48);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }));
    sprite.scale.set(16 * scale, 3 * scale, 1);
    sprite.userData.isLabel = true;
    labelGroup.add(sprite);
    return sprite;
  }

  function attach(mesh, item) {
    mesh.userData.item = item;
    clickable.push(mesh);
    byId.set(item.id, mesh);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  let _hf = null;
  function groundY(x, z) {
    if (_hf === null) {
      const t = data.elements.find(e => e.id === "TERRAIN_CONTEXT");
      _hf = (t && t.geometry.height_reference === "RH2000_MINUS_LOCATOR_DATUM")
        ? { size: t.geometry.size_m, seg: t.geometry.segments, v: t.geometry.vertices } : { flat: true };
    }
    if (_hf.flat) return 0;
    const n = _hf.seg, step = _hf.size / n, half = _hf.size / 2;
    const fx = Math.min(n, Math.max(0, (x + half) / step)), fz = Math.min(n, Math.max(0, (z + half) / step));
    const ix = Math.min(n - 1, Math.floor(fx)), iz = Math.min(n - 1, Math.floor(fz)), tx = fx - ix, tz = fz - iz;
    const at = (cx, cz) => _hf.v[cz * (n + 1) + cx][1];
    return (at(ix, iz) * (1 - tx) + at(ix + 1, iz) * tx) * (1 - tz) + (at(ix, iz + 1) * (1 - tx) + at(ix + 1, iz + 1) * tx) * tz;
  }

  function box(item, g) {
    const mesh = profile(new THREE.Mesh(new THREE.BoxGeometry(...g.size), new THREE.MeshStandardMaterial()), item, 1, 1);
    mesh.position.set(...g.position);
    mesh.rotation.y = THREE.MathUtils.degToRad(g.rotation_y_deg || 0);
    attach(mesh, item);
    root.add(mesh);
    if (item.type === "CONTEXT_BUILDING") {
      const roof = profile(new THREE.Mesh(new THREE.ConeGeometry(Math.max(g.size[0], g.size[2]) * 0.72, 1.7, 4), new THREE.MeshStandardMaterial()), item, 1, 1, "roof");
      roof.position.set(g.position[0], g.position[1] + g.size[1] / 2 + 0.85, g.position[2]);
      roof.rotation.y = Math.PI / 4 + mesh.rotation.y;
      roof.userData.item = item;
      clickable.push(roof);
      roof.castShadow = true;
      root.add(roof);
    }
    return mesh;
  }

  function terrain(item, g) {
    const geo = new THREE.BufferGeometry(), verts = [], indices = [], n = g.segments + 1;
    g.vertices.forEach(v => verts.push(...v));
    for (let z = 0; z < g.segments; z++)
      for (let x = 0; x < g.segments; x++) {
        const a = z * n + x, b = a + 1, c = a + n, d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = profile(new THREE.Mesh(geo, new THREE.MeshStandardMaterial()), item, 0.86, 1);
    attach(mesh, item);
    root.add(mesh);
    terrainObject = mesh;
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(geo), new THREE.LineBasicMaterial({ color: 0x82968a, transparent: true, opacity: 0.18 }));
    wire.userData.intelligenceOnly = true;
    mesh.add(wire);
    return mesh;
  }

  function polygon(item, g) {
    const shape = new THREE.Shape();
    g.points_xz.forEach(([x, z], i) => i ? shape.lineTo(x, z) : shape.moveTo(x, z));
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: g.height, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);
    const mesh = profile(new THREE.Mesh(geo, new THREE.MeshStandardMaterial()), item, 0.72, item.type === "PLOT" ? 0.18 : 1);
    mesh.position.y = g.base_y;
    attach(mesh, item);
    root.add(mesh);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: colors[item.evidence_class] }));
    edge.userData.alwaysVisible = true;
    mesh.add(edge);
    const l = labelSprite(item.label, item.evidence_class, 0.9);
    l.position.set(0, g.base_y + g.height + 2, 0);

    // For site buildings, add a pitched roof in realism mode
    if (item.type === "SITE_BUILDING_MAIN" || item.type === "SITE_BUILDING_OUT") {
      const centroid = g.points_xz.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
      centroid[0] /= (g.points_xz.length - 1);
      centroid[1] /= (g.points_xz.length - 1);
      const r = Math.sqrt(g.area_m2 / Math.PI) * 0.85;
      const roofHeight = item.type === "SITE_BUILDING_MAIN" ? 2.2 : 1.5;
      const roof = profile(
        new THREE.Mesh(new THREE.ConeGeometry(r, roofHeight, 4), new THREE.MeshStandardMaterial()),
        item, 1, 1, "roof"
      );
      roof.position.set(centroid[0], g.base_y + g.height + roofHeight / 2, centroid[1]);
      roof.rotation.y = Math.PI / 4;
      roof.userData.item = item;
      clickable.push(roof);
      roof.castShadow = true;
      root.add(roof);
    }
    return mesh;
  }

  function marker(item, g) {
    const group = new THREE.Group();
    const stem = profile(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 3, 10), new THREE.MeshStandardMaterial()), item);
    stem.position.y = 1.5;
    group.add(stem);
    const head = profile(new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 12), new THREE.MeshStandardMaterial()), item);
    head.position.y = 3.3;
    head.userData.item = item;
    clickable.push(head);
    group.add(head);
    group.position.set(...g.position);
    group.userData.item = item;
    root.add(group);
    byId.set(item.id, group);
    const l = labelSprite(item.label, item.evidence_class, 0.75);
    l.position.copy(group.position).add(new THREE.Vector3(0, 5.4, 0));
    return group;
  }

  function poi(item, g) {
    const group = marker(item, g);
    root.remove(group);
    poiGroup.add(group);
    return group;
  }

  function direction(item, g) {
    const group = new THREE.Group();
    const len = g.length_m;
    const line = profile(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, len, 10), new THREE.MeshStandardMaterial()), item, 0.7, 0.35);
    line.rotation.z = Math.PI / 2;
    line.position.x = len / 2;
    group.add(line);
    const cone = profile(new THREE.Mesh(new THREE.ConeGeometry(2.1, 5, 20), new THREE.MeshStandardMaterial()), item, 0.78, 0.5);
    cone.rotation.z = -Math.PI / 2;
    cone.position.x = len;
    cone.userData.item = item;
    clickable.push(cone);
    group.add(cone);
    group.position.set(...g.origin);
    group.rotation.y = THREE.MathUtils.degToRad(90 - g.azimuth_deg);
    group.userData.item = item;
    root.add(group);
    byId.set(item.id, group);
    return group;
  }

  function buildElement(item) {
    const g = item.geometry;
    if (g.primitive === "GRID_SURFACE") terrain(item, g);
    else if (g.primitive === "EXTRUDED_POLYGON") polygon(item, g);
    else if (g.primitive === "BOX" || g.primitive === "ROOM_VOLUME") box(item, g);
    else if (g.primitive === "MARKER") marker(item, g);
    else if (g.primitive === "DIAGRAMMATIC_MARKER") poi(item, g);
    else if (g.primitive === "DIRECTION_CONE") direction(item, g);
  }

  // --- Realism layer ---
  function pineTree(scale) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.24 * scale, 3.4 * scale, 7), new THREE.MeshStandardMaterial({ color: 0x694b35, roughness: 1 }));
    trunk.position.y = 1.7 * scale; trunk.castShadow = true; tree.add(trunk);
    for (let tier = 0; tier < 4; tier++) {
      const crown = new THREE.Mesh(new THREE.ConeGeometry((1.45 - 0.18 * tier) * scale, 2.7 * scale, 9), new THREE.MeshStandardMaterial({ color: tier % 2 ? 0x355a3b : 0x466c43, roughness: 1 }));
      crown.position.y = (3.2 + tier * 0.95) * scale; crown.castShadow = true; tree.add(crown);
    }
    return tree;
  }

  function birchTree(scale) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * scale, 0.2 * scale, 5.8 * scale, 8), new THREE.MeshStandardMaterial({ color: 0xd8d5c7, roughness: 1 }));
    trunk.position.y = 2.9 * scale; trunk.castShadow = true; tree.add(trunk);
    for (let band = 0; band < 5; band++) {
      const mark = new THREE.Mesh(new THREE.CylinderGeometry(0.205 * scale, 0.205 * scale, 0.08 * scale, 8), new THREE.MeshBasicMaterial({ color: 0x4c4b43 }));
      mark.position.y = (1.25 + band * 0.85) * scale; tree.add(mark);
    }
    for (const [x, y, z, s] of [[0, 6, 0, 1.6], [-0.8, 5.7, 0.25, 1.1], [0.8, 5.5, -0.2, 1.15], [0.2, 6.8, 0.2, 0.95]]) {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(s * scale, 1), new THREE.MeshStandardMaterial({ color: 0x668954, roughness: 1 }));
      crown.position.set(x * scale, y * scale, z * scale); crown.castShadow = true; tree.add(crown);
    }
    return tree;
  }

  function pointInPolygon(x, z, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, zi] = points[i], [xj, zj] = points[j];
      const cross = (zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi;
      if (cross) inside = !inside;
    }
    return inside;
  }

  function skyGradientTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 16; canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "#5b8fbd");
    grad.addColorStop(0.42, "#8fb7cd");
    grad.addColorStop(0.72, "#c2d4d5");
    grad.addColorStop(1, "#e4ebe2");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function isWater(x, z) {
    return groundY(x, z) <= -6.5;
  }

  function buildRealismDecor() {
    // Sky dome
    const dome = new THREE.Mesh(new THREE.SphereGeometry(780, 32, 20), new THREE.MeshBasicMaterial({ map: skyGradientTexture(), side: THREE.BackSide, fog: false, depthWrite: false }));
    dome.position.y = -70; dome.renderOrder = -1; realismDecor.add(dome);

    // Sea plane where DEM goes below sea level
    const seaMat = new THREE.MeshBasicMaterial({ color: 0x4a7a96, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
    const seaPlane = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), seaMat);
    seaPlane.rotation.x = -Math.PI / 2;
    seaPlane.position.y = -6.35;
    realismDecor.add(seaPlane);
    const shimmer = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshBasicMaterial({ color: 0x8bb8cc, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
    shimmer.rotation.x = -Math.PI / 2;
    shimmer.position.y = -6.3;
    realismDecor.add(shimmer);

    // Trees — placed only on land
    const random = seededRandom(4147);
    for (let i = 0; i < 220; i++) {
      const x = -120 + random() * 240, z = -120 + random() * 240;
      if (isWater(x, z)) continue;
      const onPlot = pointInPolygon(x, z, data.elements.find(e => e.id === "PLOT_4_147").geometry.points_xz);
      if (onPlot && Math.hypot(x, z) < 25) continue;
      const scale = 0.45 + random() * 1.1;
      const tree = random() < 0.6 ? pineTree(scale) : birchTree(scale);
      tree.position.set(x, groundY(x, z), z);
      tree.rotation.y = random() * Math.PI;
      realismDecor.add(tree);
    }

    // Rocks and shrubs on the parcel
    const plot = data.elements.find(e => e.id === "PLOT_4_147");
    const plotPts = plot.geometry.points_xz;
    for (let i = 0, placed = 0; i < 200 && placed < 45; i++) {
      const x = -80 + random() * 120, z = -60 + random() * 100;
      if (!pointInPolygon(x, z, plotPts) || isWater(x, z)) continue;
      const scale = 0.1 + random() * 0.35;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 0), new THREE.MeshStandardMaterial({ color: random() < 0.6 ? 0x77756d : 0x625d50, roughness: 1 }));
      rock.position.set(x, groundY(x, z) + 0.4 + scale * 0.35, z);
      rock.rotation.set(random(), random() * Math.PI, random());
      rock.castShadow = true;
      realismDecor.add(rock);
      placed++;
    }
    for (let i = 0; i < 20; i++) {
      const x = -70 + random() * 110, z = -50 + random() * 80;
      if (!pointInPolygon(x, z, plotPts) || isWater(x, z)) continue;
      const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25 + random() * 0.5, 1), new THREE.MeshStandardMaterial({ color: 0x6f8252, roughness: 1 }));
      shrub.position.set(x, groundY(x, z) + 0.55, z);
      shrub.scale.y = 0.55;
      shrub.castShadow = true;
      realismDecor.add(shrub);
    }

    // Horizon disc
    const horizon = new THREE.Mesh(new THREE.CircleGeometry(560, 64), new THREE.MeshBasicMaterial({ color: 0x708668, side: THREE.DoubleSide }));
    horizon.rotation.x = -Math.PI / 2;
    horizon.position.y = -2.2;
    realismDecor.add(horizon);

    // House detail — windows on site buildings
    const windowMat = new THREE.MeshStandardMaterial({ color: 0x9dc2c8, roughness: 0.18, metalness: 0.08, emissive: 0x172426, emissiveIntensity: 0.14 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xe9e3d5, roughness: 0.8 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x51443a, roughness: 0.92 });
    for (const item of data.elements.filter(e => e.type === "CONTEXT_BUILDING")) {
      const [w, h, d] = item.geometry.size;
      const [x, , z] = item.geometry.position;
      const group = new THREE.Group();
      group.position.set(x, groundY(x, z), z);
      group.rotation.y = THREE.MathUtils.degToRad(item.geometry.rotation_y_deg || 0);
      const count = w > 14 ? 3 : 2;
      for (let i = 0; i < count; i++) {
        const px = -w * 0.27 + (count === 1 ? 0 : i * (w * 0.54 / (count - 1)));
        const win = new THREE.Mesh(new THREE.BoxGeometry(Math.min(1.6, w * 0.13), 1.28, 0.11), windowMat);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(Math.min(1.85, w * 0.15), 1.5, 0.07), frameMat);
        frame.position.set(px, Math.min(h - 1, 1.7), d / 2 + 0.045);
        win.position.set(px, frame.position.y, d / 2 + 0.09);
        group.add(frame, win);
      }
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.05, 0.12), doorMat);
      door.position.set(w * 0.36, 1.05, d / 2 + 0.1);
      group.add(door);
      realismDecor.add(group);
    }
  }

  // --- UI ---
  function openPanel(item) {
    panel.classList.add("open");
    panelType.textContent = item.type + " · " + item.id;
    panelTitle.textContent = item.label;
    panelBadge.innerHTML = '<span class="badge" style="background:' + cssColors[item.evidence_class] + '">' + item.evidence_class + "</span>";
    const g = JSON.stringify(item.geometry, null, 2);
    panelBody.innerHTML =
      '<div class="row"><b>Geometry / method</b><code>' + item.geometry.primitive + "</code></div>" +
      '<div class="row"><b>Source references</b>' + (item.source_refs.length ? item.source_refs.join("<br>") : "None") + "</div>" +
      '<div class="row"><b>Limitations</b><ul class="limitations">' + item.limitations.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div>" +
      '<div class="row"><b>Scene parameters</b><pre style="white-space:pre-wrap;font-size:9px">' + g + "</pre></div>";
  }

  function openSources() {
    livePanel.classList.remove("open");
    panel.classList.add("open");
    panelType.textContent = "DATA SOURCE INTERFACE · CREDENTIAL-SAFE";
    panelTitle.textContent = "Evidence source stack";
    panelBadge.innerHTML = '<span class="badge" style="background:#14231d">NO CREDENTIALS OR PROVIDER PIXELS COMMITTED</span>';

    var ds = officialGeometrySources.datasets || {};
    var bld = ds.buildings || {};
    var prop = ds.property_division || {};
    var denied = officialGeometrySources.denied_datasets || [];

    panelBody.innerHTML =
      '<div class="provider"><div class="provider-head"><b>Official geometry (Lantmäteriet Geotorget)</b><span class="state CONNECTED">RECEIPTED</span></div>' +
      '<div class="row">Buildings kommun 0120 · ' + (bld.horizontal_crs || "SWEREF99 TM") + " · " + ((bld.asset_size_bytes || 0) / 1e6).toFixed(1) + " MB<br>" +
      "Property division kommun 0120 · " + ((prop.asset_size_bytes || 0) / 1e6).toFixed(1) + " MB</div>" +
      '<ul class="limitations"><li>Geometry is the official LM register extract for Värmdö kommun (0120).</li>' +
      "<li>Building footprints are AUTHORITATIVE; heights are CONCEPT (LM carries no height field).</li></ul></div>" +
      '<div class="provider"><div class="provider-head"><b>Official terrain (Lantmäteriet 1 m DTM)</b><span class="state CONNECTED">RECEIPTED</span></div>' +
      '<div class="row">Collection mhm-65_7 · 10 tiles · SHA-256 receipted<br>Pin elevation 7.00 m RH2000 · slope 8.1° WNW</div>' +
      '<ul class="limitations"><li>Heights are official RH2000 from receipted 1 m airborne-laser-scan grid.</li></ul></div>' +
      (denied.length ? '<div class="provider"><div class="provider-head"><b>Denied datasets</b><span class="state KEY_REQUIRED">HTTP 403</span></div>' +
        '<div class="row">' + denied.map(function (d) { return d.product + " — " + d.reason; }).join("<br>") + "</div></div>" : "") +
      '<div class="row"><b>Rendering policy</b>The local procedural WebGL layer is active. No external provider geometry or imagery is stored or committed. Evidence class is set per element, not per view.</div>';
  }

  closeButton.onclick = function () { panel.classList.remove("open"); };
  sourcesButton.onclick = openSources;

  function setLiveStatus(text, isError) { liveStatus.textContent = text; liveStatus.style.color = isError ? "#ffb1a5" : "#d7c695"; }
  liveContextButton.onclick = function () { panel.classList.remove("open"); livePanel.classList.add("open"); liveContextButton.classList.add("active"); };
  liveClose.onclick = function () { livePanel.classList.remove("open"); liveContextButton.classList.remove("active"); };
  liveConnect.onclick = function () { setLiveStatus("MAPBOX INTEGRATION NOT AVAILABLE IN ARTIFACT MODE", true); };
  liveDisconnect.onclick = function () { setLiveStatus("KEY REQUIRED · TOKEN STAYS IN THIS PAGE MEMORY ONLY"); };

  function applyStageVisibility(stage) {
    const allowed = new Set(stage.visible_groups);
    root.traverse(function (object) {
      const type = object.userData.item && object.userData.item.type;
      if (type) object.visible = allowed.has(type);
    });
  }

  function stepTo(i, instant) {
    currentStep = i;
    const s = data.navigation[i];
    stageLabelsAllowed = !["STREET_VIEW", "PLOT_ORBIT"].includes(s.id);
    document.querySelectorAll(".step").forEach(function (b, n) { b.classList.toggle("active", n === i); });
    applyStageVisibility(s);
    const pos = new THREE.Vector3(...s.camera), target = new THREE.Vector3(...s.target);
    tween = instant ? null : { fromPos: camera.position.clone(), toPos: pos, fromTarget: controls.target.clone(), toTarget: target, start: performance.now(), duration: 900 };
    if (instant) { camera.position.copy(pos); controls.target.copy(target); }
    if (s.on_enter_open_element) {
      const focus = byId.get(s.on_enter_open_element);
      if (focus) openPanel(focus.userData.item);
    } else {
      panel.classList.remove("open");
    }
  }

  function makeSteps() {
    data.navigation.forEach(function (s, i) {
      const b = document.createElement("button");
      b.className = "step";
      b.textContent = (i + 1) + ". " + s.label;
      b.onclick = function () { stepTo(i); };
      steps.appendChild(b);
    });
  }

  function solarPosition(hour) {
    const t = (hour - 6) / 14;
    const az = THREE.MathUtils.degToRad(70 + 220 * t);
    const alt = THREE.MathUtils.degToRad(Math.max(2, 54 * Math.sin(Math.PI * t)));
    return new THREE.Vector3(Math.sin(az) * Math.cos(alt) * 150, Math.sin(alt) * 150, Math.cos(az) * Math.cos(alt) * 150);
  }

  function setSun() {
    const h = +solarTime.value;
    timeLabel.textContent = String(Math.floor(h)).padStart(2, "0") + ":" + (h % 1 ? String(Math.round((h % 1) * 60)).padStart(2, "0") : "00");
    sun.position.copy(solarPosition(h));
    sun.target.position.set(0, 0, 0);
    sun.intensity = Math.max(0.25, 3 * Math.sin(Math.PI * (h - 6) / 14));
  }

  function applyProfile(name) {
    const realistic = name === "REALISTIC";
    scene.background = backgrounds[name];
    scene.fog = fogs[name];
    hemi.color.set(realistic ? 0xeaf5ff : 0xffffff);
    hemi.groundColor.set(realistic ? 0x55684b : 0x68766e);
    hemi.intensity = realistic ? 1.3 : 1.65;
    renderer.toneMappingExposure = realistic ? 1.18 : 1.03;
    realismDecor.visible = realistic;
    labelGroup.visible = labelsEnabled && stageLabelsAllowed && !realistic;
    root.traverse(function (o) {
      if (o.isMesh && o.userData.intelligenceMaterial) o.material = realistic ? o.userData.realisticMaterial : o.userData.intelligenceMaterial;
      if (o.userData.intelligenceOnly) o.visible = !realistic;
    });
  }

  function setMode(next) {
    mode = next;
    document.querySelectorAll(".mode").forEach(function (b) { b.classList.toggle("active", b.dataset.mode === mode); });
    const compare = mode === "COMPARE";
    divider.classList.toggle("hidden", !compare);
    leftLabel.classList.toggle("hidden", !compare);
    rightLabel.classList.toggle("hidden", !compare);
    modeCaption.textContent = {
      INTELLIGENCE: "Evidence colours expose source status and uncertainty.",
      REALISTIC: "Archipelago landscape context · no provider geometry.",
      COMPARE: "One Twin · one camera · analytical evidence beside realistic context."
    }[mode];
  }

  document.querySelectorAll(".mode").forEach(function (b) { b.onclick = function () { setMode(b.dataset.mode); }; });

  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  renderer.domElement.addEventListener("click", function (e) {
    const half = mode === "COMPARE" ? innerWidth / 2 : innerWidth;
    const offset = mode === "COMPARE" && e.clientX >= half ? half : 0;
    mouse.x = (e.clientX - offset) / half * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
    camera.aspect = half / innerHeight;
    camera.updateProjectionMatrix();
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(clickable, false).find(function (h) { return h.object.userData.item; });
    if (hit) openPanel(hit.object.userData.item);
  });

  solarTime.oninput = setSun;
  terrainToggle.onclick = function (e) { terrainObject.visible = !terrainObject.visible; e.currentTarget.classList.toggle("active", terrainObject.visible); };
  poiToggle.onclick = function (e) { poiGroup.visible = !poiGroup.visible; e.currentTarget.classList.toggle("active", poiGroup.visible); };
  labelsToggle.onclick = function (e) { labelsEnabled = !labelsEnabled; e.currentTarget.classList.toggle("active", labelsEnabled); };

  addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") stepTo(Math.min(data.navigation.length - 1, currentStep + 1));
    if (e.key === "ArrowLeft") stepTo(Math.max(0, currentStep - 1));
    if (e.key === "1") setMode("INTELLIGENCE");
    if (e.key === "2") setMode("REALISTIC");
    if (e.key === "3") setMode("COMPARE");
  });
  addEventListener("resize", function () { renderer.setSize(innerWidth, innerHeight); });

  function renderPass(name, x, width) {
    renderer.setViewport(x, 0, width, innerHeight);
    renderer.setScissor(x, 0, width, innerHeight);
    camera.aspect = width / innerHeight;
    camera.fov = mode === "COMPARE" ? 62 : 45;
    camera.updateProjectionMatrix();
    applyProfile(name);
    renderer.render(scene, camera);
  }

  // --- Boot ---
  data.elements.forEach(buildElement);
  buildRealismDecor();
  makeSteps();
  setSun();
  setMode("INTELLIGENCE");
  stepTo(0, true);
  loading.remove();

  renderer.setAnimationLoop(function () {
    if (tween) {
      const t = Math.min(1, (performance.now() - tween.start) / tween.duration);
      const k = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, k);
      if (t === 1) tween = null;
    }
    controls.update();
    renderer.setScissorTest(true);
    if (mode === "COMPARE") {
      const left = Math.floor(innerWidth / 2);
      renderPass("INTELLIGENCE", 0, left);
      renderPass("REALISTIC", left, innerWidth - left);
    } else {
      renderPass(mode, 0, innerWidth);
    }
    renderer.setScissorTest(false);
  });
})();
