// ============================================================
// MASCOT EDITOR (ОБРАЗ modal)
// A live wardrobe: every choice applies to the real mascot immediately, with
// the camera framed on it so the change is visible while the panel is open.
// Edits are undoable and only committed on confirm, so backing out restores
// exactly the look the visitor arrived with.
// ============================================================
import * as THREE from 'three';
import { session } from '../core/session.js?v=20260807-06';
import { camera, controls } from '../view/rig.js?v=20260807-06';
import { ui, mascot, mascotLabel, instruments, applyMascotConfig } from '../core/studio.js?v=20260807-06';
import { instrumentView } from '../view/instrument-presets.js?v=20260807-06';
import { leaveInstrumentView } from '../view/instrument-view.js?v=20260807-06';
import { resetMascotPose, setDancing } from './pose.js?v=20260807-06';
import { mascotMove } from './state.js?v=20260807-06';
import {
  MASCOT_DEFAULTS,
  MASCOT_HEIGHT_RANGE,
  MASCOT_WIDTH_RANGE,
  MASCOT_HAIR_STYLES,
  MASCOT_OUTFITS,
  MASCOT_EYE_COLORS,
  MASCOT_SHOE_COLORS,
  MASCOT_SKIN_TONES,
  MASCOT_SMILES,
  MASCOT_HAIR_COLOR_VALUES,
  MASCOT_ACCESSORIES,
  MASCOT_PRIMARY_COLORS,
  MASCOT_ACCENT_COLORS,
  validateMascotAppearance,
  mascotAppearanceSnapshot,
  mascotCfg,
  saveMascotConfig,
} from './appearance.js?v=20260807-06';

// Opening the wardrobe borrows the camera and has to quiet whatever else was
// using it; main.js supplies those so this module stays a leaf.
let hooks = {
  respawnMascot: () => {},
  closeSoundMixer: () => {},
  syncInstrumentExposure: () => {},
};
export function initMascotEditor(next) {
  hooks = { ...hooks, ...next };
}

// ---- mascot customization (ОБРАЗ modal) ----
const mascotModal = document.getElementById('modal-mascot');
const mascotPanel = mascotModal?.querySelector('.mascot-panel');
const mascotPreviewZone = document.getElementById('mascot-preview-zone');
const mascotHeightInput = document.getElementById('mascot-height');
const mascotWidthInput = document.getElementById('mascot-width');
const mascotCommitButton = document.getElementById('mascot-commit');
const mascotUndoButton = document.getElementById('mascot-undo');

const MASCOT_UI_NAMES = {
  hair: { long: 'ДОВГЕ', bob: 'БОБ', short: 'КОРОТКЕ', bald: 'ЛИСИЙ' },
  smile: { soft: 'ЛЕГКА', wide: 'ШИРОКА', neutral: 'РІВНА' },
  hairColor: {
    '5a2f22': 'КАШТАНОВЕ', '241a14': 'ЧОРНЕ', c9a35f: 'БЛОНД',
    a14d2d: 'РУДЕ', b04a68: 'РОЖЕВЕ',
  },
  eyeColor: { dark: 'ТЕМНІ', green: 'ЗЕЛЕНІ', blue: 'БЛАКИТНІ' },
  outfit: { stage: 'СЦЕНА', vibe: 'ФІРМОВИЙ', denim: 'ДЖИНС', night: 'НІЧ' },
  skinTone: {
    'tone-3': 'ТЕПЛИЙ', 'tone-5': 'СВІТЛИЙ', 'tone-4': 'ЗОЛОТИЙ', 'tone-7': 'ЧОРНИЙ',
  },
  accessory: {
    none: 'НЕМАЄ', hoops: 'СЕРЕЖКИ', glasses: 'ОКУЛЯРИ', headphones: 'НАВУШНИКИ',
  },
  outfitColor: {
    default: 'З ПАЛІТРИ', purple: 'ФІОЛЕТОВИЙ', gold: 'ЗОЛОТИЙ',
    cream: 'КРЕМОВИЙ', denim: 'ДЖИНСОВИЙ',
  },
  shoeColor: {
    default: 'З ПАЛІТРИ', ink: 'ЧОРНІ', cream: 'БІЛІ', red: 'ЧЕРВОНІ',
  },
};

function cloneMascotState(source = mascotCfg) {
  return mascotAppearanceSnapshot(source);
}

function restoreMascotState(snapshot) {
  if (!snapshot) return;
  Object.assign(mascotCfg, mascotAppearanceSnapshot(snapshot));
}

export const mascotEditor = {
  active: false,
  committing: false,
  category: 'face',
  openingConfig: null,
  undoConfig: null,
  openingYaw: 0,
  baseYaw: 0,
  previewAngle: 0,
  dragPointer: null,
  dragStartX: 0,
  dragStartAngle: 0,
  refitFrame: 0,
  viewDirection: new THREE.Vector3(0, 0, 1),
};

function syncMascotModal() {
  if (!mascotModal) return;
  const syncGroup = (selector, attr, value) => {
    mascotModal.querySelectorAll(selector).forEach((btn) => {
      const on = btn.dataset[attr]?.toLowerCase() === String(value).toLowerCase();
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
    });
  };
  syncGroup('[data-mascot-hair]', 'mascotHair', mascotCfg.hair);
  syncGroup('[data-mascot-color]', 'mascotColor', mascotCfg.hairColor);
  syncGroup('[data-mascot-smile]', 'mascotSmile', mascotCfg.smile);
  syncGroup('[data-mascot-eyes]', 'mascotEyes', mascotCfg.eyeColor);
  syncGroup('[data-mascot-outfit]', 'mascotOutfit', mascotCfg.outfit);
  syncGroup('[data-mascot-skin]', 'mascotSkin', mascotCfg.skinTone);
  syncGroup('[data-mascot-accessory]', 'mascotAccessory', mascotCfg.accessory);
  syncGroup('[data-mascot-primary]', 'mascotPrimary', mascotCfg.outfitPrimary);
  syncGroup('[data-mascot-accent]', 'mascotAccent', mascotCfg.outfitAccent);
  syncGroup('[data-mascot-shoes]', 'mascotShoes', mascotCfg.shoeColor);
  if (mascotHeightInput) mascotHeightInput.value = String(mascotCfg.height);
  if (mascotWidthInput) mascotWidthInput.value = String(mascotCfg.width);
  const setName = (id, group, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = MASCOT_UI_NAMES[group][value] || String(value).toUpperCase();
  };
  setName('mascot-hair-name', 'hair', mascotCfg.hair);
  setName('mascot-smile-name', 'smile', mascotCfg.smile);
  setName('mascot-color-name', 'hairColor', mascotCfg.hairColor.toLowerCase());
  setName('mascot-eyes-name', 'eyeColor', mascotCfg.eyeColor);
  setName('mascot-outfit-name', 'outfit', mascotCfg.outfit);
  setName('mascot-skin-name', 'skinTone', mascotCfg.skinTone);
  setName('mascot-accessory-name', 'accessory', mascotCfg.accessory);
  setName('mascot-primary-name', 'outfitColor', mascotCfg.outfitPrimary);
  setName('mascot-accent-name', 'outfitColor', mascotCfg.outfitAccent);
  setName('mascot-shoes-name', 'shoeColor', mascotCfg.shoeColor);
  if (mascotUndoButton) mascotUndoButton.hidden = !mascotEditor.undoConfig;
}

export function queueMascotRefit() {
  if (!mascotEditor.active || mascotEditor.refitFrame) return;
  mascotEditor.refitFrame = requestAnimationFrame(() => {
    mascotEditor.refitFrame = 0;
    frameMascotForCustomize();
  });
}

function setMascotConfig(patch, { undoable = false } = {}) {
  if (undoable) mascotEditor.undoConfig = cloneMascotState();
  const next = validateMascotAppearance({ ...mascotCfg, ...patch });
  Object.assign(mascotCfg, next);
  applyMascotConfig();
  syncMascotModal();
  if (!mascotEditor.active) saveMascotConfig();
  else queueMascotRefit();
}

function setMascotCategory(category, { focus = false } = {}) {
  if (!['face', 'outfit', 'shape'].includes(category)) return;
  mascotEditor.category = category;
  mascotModal?.querySelectorAll('[data-mascot-tab]').forEach((tab) => {
    const selected = tab.dataset.mascotTab === category;
    tab.setAttribute('aria-selected', selected ? 'true' : 'false');
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  });
  mascotModal?.querySelectorAll('[data-mascot-section]').forEach((section) => {
    const selected = section.dataset.mascotSection === category;
    section.hidden = !selected;
    section.classList.toggle('is-active', selected);
  });
  mascotPanel?.querySelector('.mascot-editor-scroll')?.scrollTo({ top: 0, behavior: 'instant' });
  queueMascotRefit();
}

function pickMascotValue(values) {
  return values[(Math.random() * values.length) | 0];
}

function randomizeMascot() {
  const hairColors = [...MASCOT_HAIR_COLOR_VALUES];
  const heights = [82, 90, 100, 110, 122, 132];
  const widths = [78, 88, 100, 112, 125, 138];
  setMascotConfig({
    hair: pickMascotValue(Object.keys(MASCOT_HAIR_STYLES)),
    hairColor: pickMascotValue(hairColors),
    smile: pickMascotValue([...MASCOT_SMILES]),
    eyeColor: pickMascotValue(Object.keys(MASCOT_EYE_COLORS)),
    outfit: pickMascotValue(Object.keys(MASCOT_OUTFITS)),
    outfitPrimary: pickMascotValue([...MASCOT_PRIMARY_COLORS]),
    outfitAccent: pickMascotValue([...MASCOT_ACCENT_COLORS]),
    shoeColor: pickMascotValue(Object.keys(MASCOT_SHOE_COLORS)),
    skinTone: pickMascotValue(Object.keys(MASCOT_SKIN_TONES)),
    accessory: pickMascotValue([...MASCOT_ACCESSORIES]),
    height: pickMascotValue(heights),
    width: pickMascotValue(widths),
  }, { undoable: true });
}

function bindMascotRadioGroup(group) {
  group.addEventListener('keydown', (event) => {
    const buttons = [...group.querySelectorAll('[role="radio"]')];
    const current = event.target.closest('[role="radio"]');
    const index = buttons.indexOf(current);
    if (index < 0) return;
    let nextIndex = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % buttons.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = buttons.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    buttons[nextIndex].focus();
    buttons[nextIndex].click();
  });
}

if (mascotModal) {
  mascotModal.querySelectorAll('[data-mascot-hair]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ hair: btn.dataset.mascotHair })));
  mascotModal.querySelectorAll('[data-mascot-color]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ hairColor: btn.dataset.mascotColor })));
  mascotModal.querySelectorAll('[data-mascot-smile]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ smile: btn.dataset.mascotSmile })));
  mascotModal.querySelectorAll('[data-mascot-eyes]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ eyeColor: btn.dataset.mascotEyes })));
  mascotModal.querySelectorAll('[data-mascot-shoes]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ shoeColor: btn.dataset.mascotShoes })));
  mascotModal.querySelectorAll('[data-mascot-outfit]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ outfit: btn.dataset.mascotOutfit })));
  mascotModal.querySelectorAll('[data-mascot-skin]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ skinTone: btn.dataset.mascotSkin })));
  mascotModal.querySelectorAll('[data-mascot-accessory]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ accessory: btn.dataset.mascotAccessory })));
  mascotModal.querySelectorAll('[data-mascot-primary]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ outfitPrimary: btn.dataset.mascotPrimary })));
  mascotModal.querySelectorAll('[data-mascot-accent]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ outfitAccent: btn.dataset.mascotAccent })));
  mascotHeightInput?.addEventListener('input', () => setMascotConfig({ height: Number(mascotHeightInput.value) }));
  mascotWidthInput?.addEventListener('input', () => setMascotConfig({ width: Number(mascotWidthInput.value) }));
  document.getElementById('mascot-reset')?.addEventListener('click', () => {
    mascotEditor.undoConfig = cloneMascotState();
    setMascotConfig({ ...MASCOT_DEFAULTS });
  });
  mascotUndoButton?.addEventListener('click', () => {
    const snapshot = mascotEditor.undoConfig;
    mascotEditor.undoConfig = null;
    restoreMascotState(snapshot);
    applyMascotConfig();
    syncMascotModal();
    queueMascotRefit();
  });
  document.getElementById('mascot-random')?.addEventListener('click', randomizeMascot);
  mascotModal.querySelectorAll('[data-mascot-tab]').forEach((tab) => {
    tab.addEventListener('click', () => setMascotCategory(tab.dataset.mascotTab));
    tab.addEventListener('keydown', (event) => {
      const tabs = [...mascotModal.querySelectorAll('[data-mascot-tab]')];
      const index = tabs.indexOf(tab);
      let nextIndex = null;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabs.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      setMascotCategory(tabs[nextIndex].dataset.mascotTab, { focus: true });
    });
  });
  mascotModal.querySelectorAll('[role="radiogroup"]').forEach(bindMascotRadioGroup);
  mascotCommitButton?.addEventListener('click', () => {
    mascotEditor.committing = true;
    saveMascotConfig();
    ui.closeAll();
  });
  syncMascotModal();
}

// Camera frames the mascot while the ОБРАЗ modal is open (live preview).
export const mascotCam = {
  active: false, returning: false, framed: false, t: 0,
  fromPos: new THREE.Vector3(), fromTgt: new THREE.Vector3(),
  toPos: new THREE.Vector3(), toTgt: new THREE.Vector3(),
  savedPos: new THREE.Vector3(), savedTgt: new THREE.Vector3(),
};

function startMascotCam(toPos, toTgt, returning) {
  mascotCam.fromPos.copy(camera.position);
  mascotCam.fromTgt.copy(controls.target);
  mascotCam.toPos.copy(toPos);
  mascotCam.toTgt.copy(toTgt);
  mascotCam.t = 0;
  mascotCam.returning = returning;
  mascotCam.active = true;
}

function mascotObjectBounds(root) {
  const bounds = new THREE.Box3();
  const meshBounds = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    let current = object;
    while (current && current !== root.parent) {
      if (!current.visible) return;
      current = current.parent;
    }
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    if (!object.geometry.boundingBox) return;
    meshBounds.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
    bounds.union(meshBounds);
  });
  return bounds;
}

function mascotPreviewSafeRect() {
  const vv = window.visualViewport;
  const viewport = {
    left: vv?.offsetLeft || 0,
    top: vv?.offsetTop || 0,
    right: (vv?.offsetLeft || 0) + (vv?.width || window.innerWidth),
    bottom: (vv?.offsetTop || 0) + (vv?.height || window.innerHeight),
  };
  const hud = document.getElementById('hud');
  const hudRect = hud && !hud.classList.contains('hidden') ? hud.getBoundingClientRect() : null;
  const top = Math.max(viewport.top + 12, hudRect ? hudRect.bottom + 8 : viewport.top + 12);
  const panelRect = mascotPanel?.getBoundingClientRect();
  if (!panelRect) return { left: viewport.left + 12, top, right: viewport.right - 12, bottom: viewport.bottom - 12 };
  const gap = 14;
  const candidates = [
    { left: viewport.left + 12, top, right: panelRect.left - gap, bottom: viewport.bottom - 12 },
    { left: panelRect.right + gap, top, right: viewport.right - 12, bottom: viewport.bottom - 12 },
    { left: viewport.left + 12, top, right: viewport.right - 12, bottom: panelRect.top - gap },
    { left: viewport.left + 12, top: panelRect.bottom + gap, right: viewport.right - 12, bottom: viewport.bottom - 12 },
  ].filter((rect) => rect.right - rect.left >= 120 && rect.bottom - rect.top >= 120);
  if (!candidates.length) return { left: viewport.left + 12, top, right: viewport.right - 12, bottom: viewport.bottom - 12 };
  return candidates.sort((a, b) =>
    ((b.right - b.left) * (b.bottom - b.top)) - ((a.right - a.left) * (a.bottom - a.top)))[0];
}

function positionMascotPreviewZone(rect) {
  if (!mascotPreviewZone) return;
  mascotPreviewZone.style.left = `${rect.left}px`;
  mascotPreviewZone.style.top = `${rect.top}px`;
  mascotPreviewZone.style.width = `${rect.right - rect.left}px`;
  mascotPreviewZone.style.height = `${rect.bottom - rect.top}px`;
}

function frameMascotForCustomize() {
  if (!mascotEditor.active) return;
  const safeRect = mascotPreviewSafeRect();
  positionMascotPreviewZone(safeRect);
  const root = mascotEditor.category === 'face' ? mascot.head : mascot.group;
  const bounds = mascotObjectBounds(root);
  if (bounds.isEmpty()) return;
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const safeCenterX = (safeRect.left + safeRect.right) / 2;
  const safeCenterY = (safeRect.top + safeRect.bottom) / 2;
  const margin = 18;
  const availableHalfX = Math.max(40, (safeRect.right - safeRect.left) / 2 - margin);
  const availableHalfY = Math.max(40, (safeRect.bottom - safeRect.top) / 2 - margin);
  const tanHalfV = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const tanHalfH = tanHalfV * camera.aspect;
  const ndcHalfX = Math.max(0.08, availableHalfX / (viewportWidth / 2));
  const ndcHalfY = Math.max(0.08, availableHalfY / (viewportHeight / 2));
  const distanceX = (size.x * 0.5) / (tanHalfH * ndcHalfX);
  const distanceY = (size.y * 0.5) / (tanHalfV * ndcHalfY);
  const distance = Math.max(1.35, distanceX, distanceY) * 1.12 + size.z * 0.55;
  const eyeDirection = mascotEditor.viewDirection.clone();
  eyeDirection.y = mascotEditor.category === 'face' ? 0.06 : 0.12;
  eyeDirection.normalize();
  const position = center.clone().addScaledVector(eyeDirection, distance);
  const target = center.clone();
  const right = new THREE.Vector3().crossVectors(camera.up, eyeDirection).normalize();
  const viewUp = new THREE.Vector3().crossVectors(eyeDirection, right).normalize();
  const desiredNdcX = (safeCenterX / viewportWidth) * 2 - 1;
  const desiredNdcY = 1 - (safeCenterY / viewportHeight) * 2;
  const halfHeight = distance * tanHalfV;
  const halfWidth = halfHeight * camera.aspect;
  const targetShift = right.multiplyScalar(-desiredNdcX * halfWidth)
    .add(viewUp.multiplyScalar(-desiredNdcY * halfHeight));
  // Aim below / beside the mascot to place it inside the safe screen rectangle
  // without translating the camera below the stage top at tall scale values.
  target.add(targetShift);
  startMascotCam(position, target, false);
}

function beginMascotEditor() {
  if (instrumentView.phase !== 'idle') leaveInstrumentView({ immediate: true, offerPriceChip: false });
  if (mascotMove.fall) hooks.respawnMascot();
  setDancing(false);
  resetMascotPose();
  for (const instrument of instruments) instrument.group.visible = false;
  if (mascotLabel) mascotLabel.visible = false;
  controls.autoRotate = false;
  mascotCam.savedPos.copy(camera.position);
  mascotCam.savedTgt.copy(controls.target);
  mascotEditor.active = true;
  document.documentElement.classList.add('mascot-editor-open');
  mascotEditor.committing = false;
  mascotEditor.openingConfig = cloneMascotState();
  mascotEditor.undoConfig = null;
  mascotEditor.openingYaw = mascot.group.rotation.y;
  mascotEditor.previewAngle = 0;
  mascotEditor.viewDirection.copy(camera.position).sub(controls.target);
  mascotEditor.viewDirection.y = 0;
  if (mascotEditor.viewDirection.lengthSq() < 0.01) mascotEditor.viewDirection.set(0, 0, 1);
  mascotEditor.viewDirection.normalize();
  mascotEditor.baseYaw = Math.atan2(mascotEditor.viewDirection.x, mascotEditor.viewDirection.z);
  mascot.group.rotation.y = mascotEditor.baseYaw;
  mascotCam.framed = true;
  controls.enabled = false;
  setMascotCategory('face');
  syncMascotModal();
  requestAnimationFrame(frameMascotForCustomize);
}

function finishMascotEditor(committed) {
  if (!mascotEditor.active) return;
  if (!committed) {
    restoreMascotState(mascotEditor.openingConfig);
    applyMascotConfig();
  }
  if (mascotEditor.refitFrame) cancelAnimationFrame(mascotEditor.refitFrame);
  mascotEditor.refitFrame = 0;
  mascotEditor.active = false;
  document.documentElement.classList.remove('mascot-editor-open');
  mascotEditor.dragPointer = null;
  resetMascotPose();
  mascot.group.rotation.y = mascotEditor.openingYaw;
  for (const instrument of instruments) instrument.group.visible = true;
  hooks.syncInstrumentExposure();
  if (mascotLabel) mascotLabel.visible = true;
  mascotCam.framed = false;
  startMascotCam(mascotCam.savedPos, mascotCam.savedTgt, true);
  mascotEditor.openingConfig = null;
  mascotEditor.undoConfig = null;
  mascotEditor.committing = false;
  syncMascotModal();
}

mascotPreviewZone?.addEventListener('pointerdown', (event) => {
  if (!mascotEditor.active) return;
  event.preventDefault();
  mascotEditor.dragPointer = event.pointerId;
  mascotEditor.dragStartX = event.clientX;
  mascotEditor.dragStartAngle = mascotEditor.previewAngle;
  mascotPreviewZone.setPointerCapture?.(event.pointerId);
});
mascotPreviewZone?.addEventListener('pointermove', (event) => {
  if (event.pointerId !== mascotEditor.dragPointer) return;
  const delta = event.clientX - mascotEditor.dragStartX;
  mascotEditor.previewAngle = mascotEditor.dragStartAngle + delta * 0.012;
  mascot.group.rotation.y = mascotEditor.baseYaw + mascotEditor.previewAngle;
});
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  mascotPreviewZone?.addEventListener(eventName, (event) => {
    if (event.pointerId === mascotEditor.dragPointer) mascotEditor.dragPointer = null;
  });
}
mascotPanel?.addEventListener('animationend', () => {
  if (mascotEditor.active) queueMascotRefit();
});

window.addEventListener('av2:modal', (event) => {
  if (event.detail?.name !== 'mascot' || !session.started) return;
  if (event.detail.open) {
    beginMascotEditor();
  } else if (mascotEditor.active) {
    finishMascotEditor(mascotEditor.committing);
  }
});

