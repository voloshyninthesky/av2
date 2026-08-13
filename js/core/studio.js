// ============================================================
// STUDIO
// Boot assembly: builds the stage, its lighting and every instrument, dresses
// the mascot from the saved appearance, and publishes the resulting handles.
// Feature modules import what they need from here instead of having the whole
// cast threaded through them, which keeps the module graph a tree.
// ============================================================
import * as THREE from 'three';
import { AudioEngine } from '../audio.js?v=20260813-20';
import { buildDrumKit } from '../instruments/drums.js?v=20260813-20';
import { buildPiano } from '../instruments/piano.js?v=20260813-20';
import { buildGuitar } from '../instruments/guitar.js?v=20260813-20';
import { buildMic } from '../instruments/mic.js?v=20260813-20';
import { UI } from '../ui.js?v=20260813-20';
import { scene, renderer } from '../view/rig.js?v=20260813-20';
import {
  adaptiveQualityScene,
  applyStageLightLevel,
  stageLightLevel,
} from './quality.js?v=20260813-20';
import { buildStage } from '../scene/stage.js?v=20260813-20';
import { buildSigns } from '../scene/signs.js?v=20260813-20';
import {
  installStageEnvironment,
  buildLights,
  buildDust,
  applyLowMobileSceneBudget,
} from '../scene/lighting.js?v=20260813-20';
import { buildMascot, makeMascotPointer } from '../scene/mascot-model.js?v=20260813-20';
import { buildMascotCompanion } from '../scene/mascot-companion.js?v=20260813-20';
import { buildGiftWardrobe, loadGiftWardrobeModel } from '../scene/gift-wardrobe.js?v=20260813-20';
import { Fireworks, NoteBursts, bumpHitPulse } from '../scene/effects.js?v=20260813-20';
import {
  MASCOT_BASE_SCALE,
  MASCOT_DEFAULTS,
  MASCOT_HAIR_STYLES,
  MASCOT_OUTFITS,
  MASCOT_EYE_COLORS,
  MASCOT_SHOE_COLORS,
  MASCOT_SKIN_TONES,
  MASCOT_OUTFIT_COLORS,
  MASCOT_SMILES,
  mascotCfg,
} from '../mascot/appearance.js?v=20260813-20';
import { GIFT_TIERS_BY_ID } from '../mascot/gift.js?v=20260813-20';

export const ui = new UI();
export const audio = new AudioEngine();
window.__audioDebug = () => audio.debugState();

export const stage = buildStage();
scene.add(stage);
// Built empty + invisible so renderer.compile sees them; js/shell/signs.js
// fills the surfaces only when the signs storage answers.
scene.add(buildSigns());
scene.add(buildLights());
installStageEnvironment(scene, renderer);
export const dust = buildDust();
adaptiveQualityScene.dust = dust;
applyLowMobileSceneBudget();
applyStageLightLevel(stageLightLevel);
scene.add(dust);
export const fireworks = new Fireworks(scene);
// Added invisible at boot for the same reason as the sign boards: renderer.compile
// only sees what is already in the scene, and a first gift that had to link its
// programs mid-ceremony would stall on the frame it matters most. The generated
// shell dresses the procedural base whenever its download lands — the ceremony
// never waits on it.
export const giftWardrobe = buildGiftWardrobe();
giftWardrobe.group.visible = false;
scene.add(giftWardrobe.group);
loadGiftWardrobeModel(giftWardrobe, '/stage/assets/wardrobe.glb');

// instruments
export const drums = buildDrumKit();
drums.group.position.set(-2.8, 0, -1.7);
drums.group.rotation.y = 0.22;
scene.add(drums.group);

export const piano = buildPiano();
piano.group.position.set(3.5, 0, -1.3);
piano.group.rotation.y = -0.62;
// Trimmed 8%: the upright stands in the middle of the sign band and its
// cabinet was hiding the boards behind it. Uniform rather than squashed on Y
// alone, so the keybed keeps its proportions — the focus framing and the
// seated pose both derive from measured piano-local bounds, so they follow.
piano.group.scale.setScalar(0.92);
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
// The tier's companion creature (mouse / cat / golden bird). A child of
// mascot.group: it rides walks, poses and the fall fade for free, and the
// reveal's group-hide keeps it from spoiling the wardrobe. Attached before the
// fall-material traverse below so its materials restore on respawn like any
// other part of the body. Built now — before the first renderer.compile — so
// no program links mid-ceremony.
export const mascotCompanion = buildMascotCompanion();
mascot.group.add(mascotCompanion.group);

// Height/width come from the saved customization; fallFactor shrinks during a stage fall.
export function applyMascotScale(fallFactor = 1) {
  const w = MASCOT_BASE_SCALE * (mascotCfg.width / 100) * fallFactor;
  mascot.group.scale.set(w, MASCOT_BASE_SCALE * (mascotCfg.height / 100) * fallFactor, w);
}

// A sung vowel opens the mascot's mouth — the voice ribbon's notation surface,
// the way the kit is the groove wheel's. It is deliberately an *override* and
// not a config change: the gifted character's own smile is what it must return
// to, and `null` is what puts it back. Nothing here is persisted.
let mouthOverride = null;
export function setMascotMouth(name) {
  if (name === mouthOverride) return;
  mouthOverride = MASCOT_SMILES.has(name) ? name : null;
  const shown = mouthOverride || mascotCfg.smile;
  for (const [smile, mouth] of Object.entries(mascot.custom.mouths)) mouth.visible = smile === shown;
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
  cu.tail.visible = Boolean(style.tail);
  if (style.tail) {
    cu.tail.scale.set(...style.tail.s);
    cu.tail.position.set(...style.tail.p);
    cu.tail.rotation.x = style.tail.rx || 0;
  }
  cu.hairMat.color.setHex(parseInt(mascotCfg.hairColor, 16));
  cu.skinMat.color.setHex(MASCOT_SKIN_TONES[mascotCfg.skinTone] ?? MASCOT_SKIN_TONES[MASCOT_DEFAULTS.skinTone]);
  // A sung vowel wins while it lasts, so a config repaint mid-note (a gift
  // reveal, a tier change) does not snap the mouth shut under the voice.
  const shownMouth = mouthOverride || mascotCfg.smile;
  for (const [smile, mouth] of Object.entries(cu.mouths)) mouth.visible = smile === shownMouth;
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
  // The rarity's persistent presence: aura pieces per tier, plus a trim glow
  // (stripes + collar slots) in the tier accent on epic and legendary. Reset
  // to black on the way down — a reroll can lower the tier.
  const tier = GIFT_TIERS_BY_ID[mascotCfg.tier] ?? GIFT_TIERS_BY_ID.common;
  mascotCompanion.setTier(tier);
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
