/**
 * Canvas sprite labels.
 *
 * A label carries its element's evidence colour as a border, so reading the scene never
 * requires reading the legend: a violet-edged label is a proposal, a green-edged one is
 * authority.
 *
 * Browser module: requires document + WebGL.
 */
import * as THREE from "three";
import {evidenceCss} from "../core/evidence.mjs";

const MAX_CHARACTERS = 42;

export function createLabelSprite(text, evidenceClass, {scale = 1} = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext("2d");

  context.fillStyle = "rgba(247,244,236,.94)";
  context.beginPath();
  context.roundRect(4, 4, 504, 88, 18);
  context.fill();
  context.strokeStyle = evidenceCss(evidenceClass);
  context.lineWidth = 5;
  context.stroke();

  context.fillStyle = "#14231d";
  context.font = "600 28px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(text).slice(0, MAX_CHARACTERS), 256, 48);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: texture, transparent: true, depthTest: false}));
  sprite.scale.set(16 * scale, 3 * scale, 1);
  sprite.userData.isLabel = true;
  return sprite;
}
