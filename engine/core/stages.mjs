/**
 * Stage navigation.
 *
 * A twin scene is not a free-flight model; it is a sequence of stages — neighbourhood, street,
 * plot, building, room — each with a camera keyframe and a contract for what is allowed to be
 * visible. The visibility contract matters as much as the camera: standing in the living room
 * you must not see the plot boundary marker floating through the wall, and a stage that shows
 * concept geometry must say so.
 *
 * Pure module: no DOM, no WebGL. The camera tween is expressed as a function of normalized
 * time so the same code drives a render loop, a film camera path, or a test.
 */

const clamp01 = value => Math.min(1, Math.max(0, value));

/** Cubic ease-out. Matches the feel of the Svärtinge viewer's 1-(1-t)^3. */
export const easeOutCubic = t => 1 - Math.pow(1 - clamp01(t), 3);

export const DEFAULT_TWEEN_MS = 900;

/**
 * Compile a parsed scene's stages into the form the viewer drives.
 * Each stage gains a resolved visible-element id set, so visibility is decided once, not per frame.
 */
export function compileStages(scene) {
  return Object.freeze(scene.stages.map((stage, index) => {
    const visibleGroups = new Set(stage.visible_groups);
    const visibleElementIds = new Set(
      scene.elements.filter(element => visibleGroups.has(element.type)).map(element => element.id)
    );
    return Object.freeze({
      index,
      id: stage.id,
      label: stage.label,
      camera: Object.freeze([...stage.camera]),
      target: Object.freeze([...stage.target]),
      visibleGroups: Object.freeze([...visibleGroups]),
      visibleElementIds,
      cutaway: stage.cutaway === true,
      labels: stage.labels ?? true,
      openElementId: stage.on_enter_open_element ?? null,
      liveContextView: stage.live_context_view ?? null
    });
  }));
}

export function stageIndexById(stages, id) {
  const index = stages.findIndex(stage => stage.id === id);
  if (index === -1) throw new RangeError(`unknown stage "${id}"`);
  return index;
}

/** Is this element visible at this stage? Single source of truth for both meshes and labels. */
export function isElementVisible(stage, element) {
  return stage.visibleElementIds.has(element.id);
}

/**
 * Camera pose partway through a stage transition.
 * @param {number} t normalized 0..1; 0 = from, 1 = to.
 */
export function tweenPose(from, to, t) {
  const k = easeOutCubic(t);
  // Snap on completion: a + (b - a) * 1 is not exactly b in IEEE 754, and a camera that lands
  // 1e-14 off its keyframe is a camera that never quite arrives.
  if (k === 1) {
    return Object.freeze({
      camera: Object.freeze([...to.camera]),
      target: Object.freeze([...to.target]),
      progress: 1,
      done: true
    });
  }
  const lerp = (a, b) => a + (b - a) * k;
  return Object.freeze({
    camera: Object.freeze([0, 1, 2].map(i => lerp(from.camera[i], to.camera[i]))),
    target: Object.freeze([0, 1, 2].map(i => lerp(from.target[i], to.target[i]))),
    progress: k,
    done: false
  });
}

/**
 * Stage machine. Holds the current stage, runs transitions against a clock the caller owns
 * (performance.now in a browser, a counter in a test), and emits pose + visibility.
 */
export function createStageMachine({stages, durationMs = DEFAULT_TWEEN_MS, onStage} = {}) {
  if (!Array.isArray(stages) || !stages.length) throw new RangeError("createStageMachine requires at least one stage");
  let currentIndex = 0;
  let transition = null;
  // True while the caller still owes the camera a write. Without it, a loop that misses the
  // entire tween window — a backgrounded tab, a long frame, a paused rAF — reads a settled
  // pose, skips it as "done", and leaves the camera at the stage it was asked to leave.
  let pendingApply = true;

  function stageAt(index) {
    if (!Number.isInteger(index) || index < 0 || index >= stages.length) throw new RangeError(`stage index ${index} out of range`);
    return stages[index];
  }

  function goTo(index, {instant = false, now = 0} = {}) {
    const previous = stageAt(currentIndex);
    const next = stageAt(index);
    currentIndex = index;
    transition = instant ? null : {from: previous, to: next, start: now};
    pendingApply = true;
    onStage?.(next, {instant});
    return next;
  }

  return {
    get stages() { return stages; },
    get index() { return currentIndex; },
    get current() { return stages[currentIndex]; },
    get transitioning() { return transition !== null; },
    goTo,
    goToId(id, options) { return goTo(stageIndexById(stages, id), options); },
    next(options) { return goTo(Math.min(stages.length - 1, currentIndex + 1), options); },
    previous(options) { return goTo(Math.max(0, currentIndex - 1), options); },
    /**
     * Pose for the current instant, plus `apply`: whether the caller must write it to the
     * camera. `apply` stays true until a settled pose has been handed out once, so a missed
     * tween still lands, and false afterwards so it never fights a user orbiting the scene.
     */
    pose(now = 0) {
      const stage = stages[currentIndex];
      if (!transition) {
        const settled = Object.freeze({camera: stage.camera, target: stage.target, progress: 1, done: true, apply: pendingApply});
        pendingApply = false;
        return settled;
      }
      const t = durationMs <= 0 ? 1 : (now - transition.start) / durationMs;
      const pose = tweenPose(transition.from, transition.to, t);
      if (pose.done) {
        transition = null;
        pendingApply = false;
      }
      return Object.freeze({...pose, apply: true});
    }
  };
}
