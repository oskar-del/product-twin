/**
 * Profile dock, stage steps, caption and tools.
 *
 * The navigation chrome every twin surface needs: which way of seeing, which stage, what time
 * of day, labels on or off. Built from the scene, so a surface never hardcodes a stage list
 * that can fall out of step with the data.
 *
 * Browser module: requires document.
 */
import {PROFILE_CAPTIONS} from "../core/profiles.mjs";

export function createDock({mount, profiles, stages, onProfile, onStage}) {
  const dock = document.createElement("div");
  dock.className = "twin-dock";
  dock.setAttribute("role", "group");
  dock.setAttribute("aria-label", "View mode");
  for (const profile of profiles) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = profile;
    button.dataset.profile = profile;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => onProfile(profile));
    dock.append(button);
  }

  const steps = document.createElement("nav");
  steps.className = "twin-steps";
  steps.setAttribute("aria-label", "Stages");
  stages.forEach((stage, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${index + 1}. ${stage.label}`;
    button.dataset.stage = stage.id;
    button.setAttribute("aria-current", "false");
    button.addEventListener("click", () => onStage(index));
    steps.append(button);
  });

  const caption = document.createElement("div");
  caption.className = "twin-caption";

  mount.append(dock, steps, caption);

  return {
    element: dock,
    setProfile(profile) {
      for (const button of dock.querySelectorAll("button")) {
        button.setAttribute("aria-pressed", String(button.dataset.profile === profile));
      }
      caption.textContent = PROFILE_CAPTIONS[profile] ?? "";
    },
    setStage(index) {
      steps.querySelectorAll("button").forEach((button, position) => {
        button.setAttribute("aria-current", String(position === index));
      });
    }
  };
}

export function createTools({mount, controls}) {
  const tools = document.createElement("div");
  tools.className = "twin-tools";
  const ranges = new Map();

  for (const control of controls) {
    if (control.kind === "toggle") {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = control.label;
      button.setAttribute("aria-pressed", String(control.value !== false));
      button.addEventListener("click", () => {
        const next = button.getAttribute("aria-pressed") !== "true";
        button.setAttribute("aria-pressed", String(next));
        control.onChange(next);
      });
      tools.append(button);
    } else if (control.kind === "range") {
      const label = document.createElement("label");
      const readout = document.createElement("span");
      const input = document.createElement("input");
      input.type = "range";
      input.min = control.min;
      input.max = control.max;
      input.step = control.step ?? 0.25;
      input.value = control.value;
      input.setAttribute("aria-label", control.label);
      readout.textContent = control.format(Number(input.value));
      input.addEventListener("input", () => {
        readout.textContent = control.format(Number(input.value));
        control.onChange(Number(input.value));
      });
      label.append(input, readout);
      tools.append(label);
      ranges.set(control.label, {input, readout, format: control.format});
    }
  }

  mount.append(tools);
  return {
    element: tools,
    /** Keep a slider honest when its value is changed through the API rather than by dragging. */
    setRange(label, value) {
      const range = ranges.get(label);
      if (!range) return;
      range.input.value = String(value);
      range.readout.textContent = range.format(value);
    }
  };
}
