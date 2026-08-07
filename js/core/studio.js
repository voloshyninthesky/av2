// ============================================================
// STUDIO
// Boot assembly: builds the stage, its lighting and every instrument, dresses
// the mascot from the saved appearance, and publishes the resulting handles.
// Feature modules import what they need from here instead of having the whole
// cast threaded through them, which keeps the module graph a tree.
// ============================================================
import * as THREE from 'three';
import { AudioEngine } from '../audio.js?v=20260807-03';
import { buildDrumKit } from '../instruments/drums.js?v=20260807-03';
import { buildPiano } from '../instruments/piano.js?v=20260807-03';
import { buildGuitar } from '../instruments/guitar.js?v=20260807-03';
import { buildMic } from '../instruments/mic.js?v=20260807-03';
import { UI } from '../ui.js?v=20260807-03';
import { scene, renderer } from '../view/rig.js?v=20260807-03';
import {
  adaptiveQualityScene,
  applyStageLightLevel,
  stageLightLevel,
} from './quality.js?v=20260807-03';
import { buildStage } from '../scene/stage.js?v=20260807-03';
import {
  installStageEnvironment,
  buildLights,
  buildDust,
  applyLowMobileSceneBudget,
} from '../scene/lighting.js?v=20260807-03';
import { buildMascot, makeMascotPointer } from '../scene/mascot-model.js?v=20260807-03';
import { Fireworks, NoteBursts, bumpHitPulse } from '../scene/effects.js?v=20260807-03';
import {
  MASCOT_BASE_SCALE,
  MASCOT_DEFAULTS,
  MASCOT_HAIR_STYLES,
  MASCOT_OUTFITS,
  MASCOT_EYE_COLORS,
  MASCOT_SHOE_COLORS,
  MASCOT_SKIN_TONES,
  MASCOT_OUTFIT_COLORS,
  mascotCfg,
} from '../mascot/appearance.js?v=20260807-03';

export const ui = new UI();
export const audio = new AudioEngine();
window.__audioDebug = () => audio.debugState();

export const stage = buildStage();
scene.add(stage);
scene.add(buildLights());
installStageEnvironment(scene, renderer);
export const dust = buildDust();
adaptiveQualityScene.dust = dust;
applyLowMobileSceneBudget();
applyStageLightLevel(stageLightLevel);
scene.add(dust);
export const fireworks = new Fireworks(scene);

// instruments
export const drums = buildDrumKit();
drums.group.position.set(-2.8, 0, -1.7);
drums.group.rotation.y = 0.22;
scene.add(drums.group);

export const piano = buildPiano();
piano.group.position.set(3.5, 0, -1.3);
piano.group.rotation.y = -0.62;
scene.add(piano.group);

export const guitar = buildGuitar();
guitar.group.position.set(-1.35, 0, 1.75);
guitar.group.rotation.y = 0.38;
scene.add(guitar.group);

export const mic = buildMic();
mic.group.position.set(1.0, 0, 2.4);
scene.add(mic.group);

// Per-play feedback: every audible route already calls these instrument
// methods, so wrapping them once covers pointer, pads, keyboard jam, and loop
// playback without touching any call site.
export const noteBursts = new NoteBursts(scene);
{
  const wrapPlayFeedback = (owner, method, kind, chance = 1, pulse = 1) => {
    const original = owner[method].bind(owner);
    owner[method] = (...args) => {
      original(...args);
      bumpHitPulse(pulse);
      if (chance >= 1 || Math.random() < chance) noteBursts.spawn(kind);
    };
  };
  wrapPlayFeedback(drums, 'hit', 'drums', 1, 1);
  wrapPlayFeedback(piano, 'press', 'piano', 1, 0.7);
  wrapPlayFeedback(guitar, 'strum', 'guitar', 1, 1);
  wrapPlayFeedback(guitar, 'pluck', 'guitar', 0.34, 0.5);
  wrapPlayFeedback(mic, 'sing', 'mic', 1, 0.8);
}

export const mascot = buildMascot();

// Height/width come from the saved customization; fallFactor shrinks during a stage fall.
export function applyMascotScale(fallFactor = 1) {
  const w = MASCOT_BASE_SCALE * (mascotCfg.width / 100) * fallFactor;
  mascot.group.scale.set(w, MASCOT_BASE_SCALE * (mascotCfg.height / 100) * fallFactor, w);
}

export function applyMascotConfig() {
  const cu = mascot.custom;
  const style = MASCOT_HAIR_STYLES[mascotCfg.hair] || MASCOT_HAIR_STYLES.long;
  cu.hairBack.visible = Boolean(style.back);
  if (style.back) {
    cu.hairBack.scale.set(...style.back.s);
    cu.hairBack.position.set(...style.back.p);
  }
  cu.hairCap.visible = Boolean(style.cap);
  if (style.cap) {
    cu.hairCap.scale.set(...style.cap.s);
    cu.hairCap.position.set(...style.cap.p);
  }
  for (const lock of cu.locks) {
    lock.visible = Boolean(style.locks);
    if (style.locks) {
      lock.scale.set(...style.locks.s);
      lock.position.set(lock.userData.side * style.locks.x, style.locks.y, style.locks.z);
    }
  }
  cu.fringe.visible = Boolean(style.fringe);
  if (style.fringe) {
    cu.fringe.scale.set(...style.fringe.s);
    cu.fringe.position.set(...style.fringe.p);
    cu.fringe.rotation.z = style.fringe.rz;
  }
  cu.hairMat.color.setHex(parseInt(mascotCfg.hairColor, 16));
  cu.skinMat.color.setHex(MASCOT_SKIN_TONES[mascotCfg.skinTone] ?? MASCOT_SKIN_TONES[MASCOT_DEFAULTS.skinTone]);
  for (const [smile, mouth] of Object.entries(cu.mouths)) mouth.visible = smile === mascotCfg.smile;
  cu.eyeMat.color.setHex(MASCOT_EYE_COLORS[mascotCfg.eyeColor] ?? MASCOT_EYE_COLORS.dark);
  const outfit = MASCOT_OUTFITS[mascotCfg.outfit] || MASCOT_OUTFITS.stage;
  for (const slot in outfit) cu.mats[slot].color.setHex(outfit[slot]);
  const primary = MASCOT_OUTFIT_COLORS[mascotCfg.outfitPrimary];
  const accent = MASCOT_OUTFIT_COLORS[mascotCfg.outfitAccent];
  if (primary !== null && primary !== undefined) {
    for (const slot of ['panel', 'sleeveL', 'sleeveR']) cu.mats[slot].color.setHex(primary);
  }
  if (accent !== null && accent !== undefined) {
    for (const slot of ['stripes', 'shoulder', 'collar']) cu.mats[slot].color.setHex(accent);
  }
  const shoeOverride = MASCOT_SHOE_COLORS[mascotCfg.shoeColor];
  if (shoeOverride !== null && shoeOverride !== undefined) cu.mats.shoes.color.setHex(shoeOverride);
  cu.headphoneMats.shell.color.setHex(primary ?? outfit.panel);
  cu.headphoneMats.detail.color.setHex(accent ?? outfit.stripes);
  for (const [name, accessory] of Object.entries(cu.accessoryGroups)) {
    accessory.visible = name === mascotCfg.accessory;
  }
  applyMascotScale();
}

// Downstage, standing in the key spotlight pool and nudged toward the guitar
// (stage left) — the visitor arrives as the performer, guitar in easy reach,
// every other instrument behind them. Held back off the footlight row — those
// are point lights with inverse-square falloff and would blow the costume out
// up close.
export const MASCOT_START = new THREE.Vector3(-0.5, 0, 2.15);
mascot.group.position.copy(MASCOT_START);
scene.add(mascot.group);
applyMascotConfig();
export const mascotFallMeshes = [];
export const mascotFallMaterialStates = new Map();
mascot.group.traverse((object) => {
  if (!object.isMesh) return;
  mascotFallMeshes.push({ object, renderOrder: object.renderOrder });
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  for (const material of materials) {
    if (!mascotFallMaterialStates.has(material)) {
      mascotFallMaterialStates.set(material, {
        transparent: material.transparent,
        opacity: material.opacity,
        depthTest: material.depthTest,
        depthWrite: material.depthWrite,
      });
    }
  }
});

export const instruments = [drums, piano, guitar, mic];
export const whiteKeys = piano.keys.filter((k) => !k.userData.black).sort((a, b) => a.userData.whiteIdx - b.userData.whiteIdx);
// Black keys carry no index of their own, but `buildPiano()` places them
// left-to-right in build order, so x position sorts them the same way.
export const blackKeys = piano.keys.filter((k) => k.userData.black).sort((a, b) => a.position.x - b.position.x);

// interactable meshes
export const interactables = [];
for (const inst of instruments) {
  inst.group.traverse((o) => {
    if (o.isMesh && o.userData.instrument) interactables.push(o);
  });
}

// The only scene-space label left is the pointer above the mascot.
export let mascotLabel = null;
export const MASCOT_LABEL_Y = 1.92;
// The pointer floats above the head — keep the gap proportional to the customized height.
export const mascotLabelY = () => MASCOT_LABEL_Y * (mascotCfg.height / 100);
export function addLabels() {
  // Arrow-only marker above the mascot (no "Ти" text).
  mascotLabel = makeMascotPointer();
  mascotLabel.position.set(mascot.group.position.x, mascotLabelY(), mascot.group.position.z);
  scene.add(mascotLabel);
}
