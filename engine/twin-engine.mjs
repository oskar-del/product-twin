/**
 * twin-engine v0.1 — the composition root.
 *
 * One call turns a twin-scene document into a working evidence-bearing 3D surface: geometry,
 * stages, profiles, sun, picking, panel, legend, dock. A consuming surface supplies a scene
 * URL and a mount element; everything a viewer used to hand-write lives here.
 *
 *   import {createTwinViewer} from "../../engine/twin-engine.mjs";
 *   const viewer = await createTwinViewer({mount: document.getElementById("stage"),
 *                                          sceneUrl: "../../data/scenes/…/scene-v0.1.json"});
 *
 * What the engine deliberately does NOT do: invent geometry, soften a limitation, or let a
 * profile change what a claim says. Presentation changes; evidence does not.
 *
 * Browser module. The pure half (core/evidence, core/scene-contract, core/stages, geo/local-enu,
 * studies/sun) is importable from Node and gated by `npm run engine:gate`.
 */
import * as THREE from "three";

import {parseScene, evidenceProfile} from "./core/scene-contract.mjs";
import {extentsOf, depthSettingsFor, maxStageDistance} from "./core/extents.mjs";
import {compileStages, createStageMachine, DEFAULT_TWEEN_MS} from "./core/stages.mjs";
import {createMaterialFactory, applyProfile, PROFILE_COMPARE, PROFILE_INTELLIGENCE, PROFILE_REALISTIC} from "./core/profiles.mjs";
import {createViewer} from "./core/viewer.mjs";
import {createPicker} from "./core/picking.mjs";
import {createSceneBuilder} from "./geometry/primitives.mjs";
import {createTextureLibrary} from "./geometry/textures.mjs";
import {mergeContextBuildings} from "./geometry/merge-context.mjs";
import {sunLightRig, localHourToUtc} from "./studies/sun.mjs";
import {createGeometryIndex} from "./studies/geometry-queries.mjs";
import {sightline, sightlineMatrix} from "./studies/sightline.mjs";
import {sunHours} from "./studies/sun-hours.mjs";
import {viewshed} from "./studies/viewshed.mjs";
import {deriveMapView} from "./geo/local-enu.mjs";
import {installStyles, ENGINE_CLASS} from "./ui/styles.mjs";
import {createPanel} from "./ui/panel.mjs";
import {createLegend} from "./ui/legend.mjs";
import {createDock, createTools} from "./ui/dock.mjs";

export {ENGINE_VERSION_STRING as ENGINE_VERSION} from "./version.mjs";
import {ENGINE_VERSION_STRING} from "./version.mjs";

export {parseScene, evidenceProfile} from "./core/scene-contract.mjs";
export {deriveMapView} from "./geo/local-enu.mjs";
export {solarPosition, solarDirection} from "./studies/sun.mjs";
export {sightline, sightlineMatrix} from "./studies/sightline.mjs";
export {sunHours} from "./studies/sun-hours.mjs";
export {viewshed} from "./studies/viewshed.mjs";

const DEFAULT_HOUR = 13;
const TIME_CONTROL_LABEL = "Time of day";

async function loadScene(sceneUrl, sceneDocument) {
  if (sceneDocument) return sceneDocument;
  const response = await fetch(sceneUrl);
  if (!response.ok) throw new Error(`scene ${sceneUrl} failed to load: ${response.status} ${response.statusText}`);
  return response.json();
}

/**
 * @param {object} options
 * @param {HTMLElement} options.mount          element the canvas and chrome are mounted into
 * @param {string}  [options.sceneUrl]         URL of a twin-scene document
 * @param {object}  [options.sceneDocument]    an already-loaded scene, instead of a URL
 * @param {object}  [options.realisticPalette] element type → colour overrides for REALISTIC
 * @param {function}[options.decor]            per-site realism plugin: ({THREE, scene, group}) => void
 * @param {string}  [options.brand]            short label shown top-left (scene subject by default)
 * @param {boolean} [options.chrome=true]      mount the engine's own dock/legend/panel/tools
 * @param {function}[options.onElementOpen]    called with each opened element
 */
export async function createTwinViewer({
  mount,
  sceneUrl,
  sceneDocument,
  realisticPalette,
  brand,
  decor = null,
  chrome = true,
  onElementOpen = null,
  tweenMs = DEFAULT_TWEEN_MS
}) {
  if (!mount) throw new TypeError("createTwinViewer requires a mount element");
  mount.classList.add(ENGINE_CLASS);
  installStyles();

  const scene = parseScene(await loadScene(sceneUrl, sceneDocument));
  const stages = compileStages(scene);

  // The scene's real size decides clipping, fog and shadow coverage.
  const extents = extentsOf(scene.elements);
  const depth = depthSettingsFor(extents.radius_m, maxStageDistance(scene.stages));
  const viewer = createViewer({
    mount,
    far: depth.cameraFar,
    near: depth.cameraNear,
    maxDistance: depth.maxDistance,
    shadowExtent: depth.shadowExtent
  });
  const textures = createTextureLibrary();
  const materials = createMaterialFactory({realisticPalette});
  const builder = createSceneBuilder({materials, textures});
  const built = builder.build(scene);

  mergeContextBuildings(built.root, built.byId, built.clickable);

  const realismDecor = new THREE.Group();
  realismDecor.name = "twin-realism-decor";
  realismDecor.visible = false;
  const measurementGroup = new THREE.Group();
  measurementGroup.name = "twin-measurements";
  viewer.scene.add(built.root, built.labelGroup, realismDecor, measurementGroup);
  decor?.({THREE, scene, group: realismDecor, viewer});

  // ── state ────────────────────────────────────────────────────────────────────────────────
  let profile = scene.presentation.default_profile;
  let labelsEnabled = true;
  let hour = clampToStudy(DEFAULT_HOUR);
  let panel = null;
  let dock = null;
  let tools = null;

  const solarStudy = scene.studies?.solar ?? null;
  const [longitude, latitude] = scene.origin_wgs84;
  const solarDate = solarStudy?.date ?? "2026-06-21";

  function clampToStudy(value) {
    const [min, max] = solarStudyRange();
    return Math.min(max, Math.max(min, value));
  }

  function solarStudyRange() {
    const range = scene.studies?.solar?.interactive_hour_range;
    return Array.isArray(range) && range.length === 2 ? range : [5, 21];
  }

  function applyStageVisibility(stage) {
    for (const element of scene.elements) {
      const object = built.byId.get(element.id);
      if (object) object.visible = stage.visibleElementIds.has(element.id);
    }
    for (const sprite of built.labelGroup.children) {
      sprite.visible = stage.visibleElementIds.has(sprite.userData.elementId);
    }
    built.labelGroup.visible = labelsEnabled && stage.labels && profile !== PROFILE_REALISTIC;
  }

  function applyCurrentProfile(name) {
    applyProfile(name, {
      scene: viewer.scene,
      root: built.root,
      realismDecor,
      labelGroup: built.labelGroup,
      hemisphere: viewer.hemisphere,
      renderer: viewer.renderer,
      labelsVisible: labelsEnabled && machine.current.labels,
      depth
    });
  }

  function setSun(nextHour) {
    hour = clampToStudy(nextHour);
    const {utcHour} = localHourToUtc({
      hour,
      utcOffsetHours: solarStudy?.utc_offset_hours,
      longitude
    });
    tools?.setRange(TIME_CONTROL_LABEL, hour);
    const rig = sunLightRig({latitude, longitude, date: solarDate, utcHour, distance: Math.max(150, extents.radius_m * 1.2)});
    if (!rig) {
      viewer.sun.intensity = 0;
      return null;
    }
    viewer.sun.position.set(...rig.position);
    viewer.sun.target.position.set(0, 0, 0);
    viewer.sun.target.updateMatrixWorld();
    viewer.sun.intensity = rig.intensity;
    return rig;
  }

  const machine = createStageMachine({
    stages,
    durationMs: tweenMs,
    onStage(stage) {
      applyStageVisibility(stage);
      dock?.setStage(stage.index);
      if (stage.openElementId) {
        const element = scene.elements.find(item => item.id === stage.openElementId);
        openElement(element);
      } else {
        panel?.close();
      }
    }
  });

  function openElement(element) {
    if (!element) return;
    panel?.open(element);
    onElementOpen?.(element);
  }

  // ── chrome ───────────────────────────────────────────────────────────────────────────────
  let hud = null;
  if (chrome) {
    hud = document.createElement("div");
    hud.className = "twin-hud";
    mount.append(hud);
    const brandLabel = brand ?? scene.subject?.label ?? scene.scene_id;
    if (brandLabel) {
      const chip = document.createElement("div");
      chip.className = "twin-brand";
      chip.textContent = brandLabel;
      chip.title = brandLabel;
      hud.append(chip);
    }
    panel = createPanel({mount: hud});
    createLegend({mount: hud, claimPolicy: scene.legal_claim_policy});
    dock = createDock({
      mount: hud,
      profiles: scene.presentation.profiles,
      stages,
      onProfile: setProfile,
      onStage: index => machine.goTo(index, {now: performance.now()})
    });
    const [minHour, maxHour] = solarStudyRange();
    tools = createTools({
      mount: hud,
      controls: [
        {kind: "toggle", label: "Labels", value: true, onChange: value => { labelsEnabled = value; applyStageVisibility(machine.current); }},
        {kind: "toggle", label: "Points of interest", value: true, onChange: value => { built.poiGroup.visible = value; }},
        {
          kind: "range",
          label: TIME_CONTROL_LABEL,
          min: minHour,
          max: maxHour,
          step: 0.25,
          value: hour,
          format: value => `${String(Math.floor(value)).padStart(2, "0")}:${String(Math.round((value % 1) * 60)).padStart(2, "0")}`,
          onChange: setSun
        }
      ]
    });
  }

  function setProfile(next) {
    profile = next;
    dock?.setProfile(next);
    applyStageVisibility(machine.current);
    return profile;
  }

  // ── picking ──────────────────────────────────────────────────────────────────────────────
  const picker = createPicker({renderer: viewer.renderer, camera: viewer.camera, targets: built.clickable, sceneElements: scene.elements});
  viewer.renderer.domElement.addEventListener("click", event => {
    const element = picker.pick(event, {split: profile === PROFILE_COMPARE});
    if (element) openElement(element);
  });

  const onKey = event => {
    if (event.key === "ArrowRight") machine.next({now: performance.now()});
    if (event.key === "ArrowLeft") machine.previous({now: performance.now()});
    const index = Number(event.key);
    if (Number.isInteger(index) && index >= 1 && index <= scene.presentation.profiles.length) {
      setProfile(scene.presentation.profiles[index - 1]);
    }
  };
  globalThis.addEventListener("keydown", onKey);

  // ── first frame ──────────────────────────────────────────────────────────────────────────
  setSun(hour);
  setProfile(profile);
  machine.goToId(scene.presentation.default_stage, {instant: true});

  viewer.start(now => {
    const pose = machine.pose(now);
    if (pose.apply) {
      viewer.camera.position.set(...pose.camera);
      viewer.controls.target.set(...pose.target);
    }
    viewer.controls.update();
    viewer.render(
      profile === PROFILE_COMPARE
        ? [
            {profile: PROFILE_INTELLIGENCE, applyProfile: applyCurrentProfile},
            {profile: PROFILE_REALISTIC, applyProfile: applyCurrentProfile}
          ]
        : [{profile, applyProfile: applyCurrentProfile}]
    );
  });

  return {
    version: ENGINE_VERSION_STRING,
    scene,
    extents,
    depth,
    stages,
    viewer,
    elements: built.byId,
    evidenceProfile: () => evidenceProfile(scene),
    get profile() { return profile; },
    get stage() { return machine.current; },
    get hour() { return hour; },
    setProfile,
    setHour: setSun,
    goToStage: (index, options = {}) => machine.goTo(index, {now: performance.now(), ...options}),
    goToStageId: (id, options = {}) => machine.goToId(id, {now: performance.now(), ...options}),
    openElementById: id => openElement(scene.elements.find(element => element.id === id)),
    /**
     * Measured spatial claims, computed against the geometry on screen — not estimated, and not
     * a second model that can drift from the picture. The ray index is built on first use.
     */
    measure: (() => {
      let rayIndex = null;
      const ensureIndex = () => (rayIndex ??= createGeometryIndex(scene));
      return {
        sightline: options => sightline({index: ensureIndex(), ...options}),
        sightlineMatrix: points => sightlineMatrix({index: ensureIndex(), points}),
        sunHours: options => sunHours({
          index: ensureIndex(),
          latitude,
          longitude,
          date: solarDate,
          utcOffsetHours: solarStudy?.utc_offset_hours,
          ...options
        }),
        viewshed: options => viewshed({index: ensureIndex(), ...options}),

        /**
         * Draw a viewshed's horizon as a ring around the observer: the ring rides at each
         * azimuth's horizon angle, so a high skyline lifts it and open sky flattens it.
         */
        drawViewshed({from, radiusM = 60, ...options}) {
          const result = viewshed({index: ensureIndex(), from, ...options});
          const points = result.horizon.map(sample => {
            const azimuth = (sample.azimuth_deg * Math.PI) / 180;
            const elevation = (Math.max(0, sample.horizon_elevation_deg) * Math.PI) / 180;
            return new THREE.Vector3(
              from[0] + radiusM * Math.sin(azimuth),
              from[1] + radiusM * Math.tan(elevation),
              from[2] + radiusM * Math.cos(azimuth)
            );
          });
          // A tube, for the same reason drawSightline uses one: THREE.Line ignores line width on
          // most platforms, so a horizon drawn as a line is invisible at site scale.
          const curve = new THREE.CatmullRomCurve3(points, true);
          const ring = new THREE.Mesh(
            new THREE.TubeGeometry(curve, Math.max(64, points.length), Math.max(0.15, radiusM * 0.006), 6, true),
            new THREE.MeshBasicMaterial({color: 0x497aa2})
          );
          ring.userData.isMeasurement = true;
          ring.renderOrder = 2;
          measurementGroup.add(ring);
          return result;
        },

        /**
         * Draw a sightline into the scene: green when open, red as far as the blocker when not.
         *
         * Drawn as a solid tube rather than a THREE.Line, because line width is ignored on most
         * platforms and a one-pixel claim disappears at site scale — a measured relation the
         * viewer cannot see is not evidence, it is trivia.
         */
        drawSightline({from, to, ignoreElementIds = [], radiusM}) {
          const result = sightline({index: ensureIndex(), from, to, ignoreElementIds});
          const start = new THREE.Vector3(...from);
          const finish = result.blocked_by
            ? start.clone().lerp(new THREE.Vector3(...to), result.blocked_by.at_m / result.distance_m)
            : new THREE.Vector3(...to);

          const span = finish.clone().sub(start);
          const length = span.length();
          const radius = radiusM ?? Math.max(0.12, length * 0.004);
          const tube = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, length, 8),
            new THREE.MeshBasicMaterial({color: result.visible ? 0x2f8f63 : 0xa65b68})
          );
          tube.position.copy(start).add(span.clone().multiplyScalar(0.5));
          tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), span.clone().normalize());
          tube.userData.isMeasurement = true;
          tube.renderOrder = 2;
          measurementGroup.add(tube);

          // A marker at the blocker, so "blocked" reads as a place rather than a colour.
          if (result.blocked_by) {
            const marker = new THREE.Mesh(
              new THREE.SphereGeometry(radius * 3, 12, 8),
              new THREE.MeshBasicMaterial({color: 0xa65b68})
            );
            marker.position.copy(finish);
            marker.userData.isMeasurement = true;
            measurementGroup.add(marker);
          }
          return result;
        },
        clear() {
          for (const child of [...measurementGroup.children]) {
            child.geometry?.dispose();
            child.material?.dispose();
            measurementGroup.remove(child);
          }
        },
        dispose() {
          rayIndex?.dispose();
          rayIndex = null;
        }
      };
    })(),

    /** Slippy-map camera for the current stage — for a live context layer that follows the twin. */
    mapView: (zoom = 15.5) => deriveMapView({
      originWgs84: scene.origin_wgs84,
      camera: machine.current.camera,
      target: machine.current.target,
      zoom
    }),
    dispose() {
      this.measure.clear();
      this.measure.dispose();
      globalThis.removeEventListener("keydown", onKey);
      viewer.dispose();
      builder.dispose();
      materials.dispose();
      textures.dispose();
      hud?.remove();
      mount.classList.remove(ENGINE_CLASS);
    }
  };
}
