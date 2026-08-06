// ============================================================
// INSTRUMENT DISCOVERY HINTS
// Two one-time nudges that follow the first onboarding tip: screen-space
// arrows over all four instruments once the mascot editor closes for the
// first time ("це все грає"), and a short how-to toast the first time each
// instrument reaches its focused close-up. Both persist their dismissal, so
// a returning visitor never sees them twice.
// ============================================================
import * as THREE from 'three';
import { session } from '../core/session.js?v=20260806-14';
import { isMobileGameMode } from '../core/quality.js?v=20260806-14';
import { camera } from '../view/rig.js?v=20260806-14';
import { ui, drums, piano, guitar, mic } from '../core/studio.js?v=20260806-14';
import { instrumentView } from '../view/instrument-presets.js?v=20260806-14';
import { play } from '../play/state.js?v=20260806-14';
import { onboard } from './intro.js?v=20260806-14';

const ARROWS_KEY = 'av2.instrument-arrows.v1';
const FOCUS_HINT_KEY = 'av2.instrument-hint.v1';
// `skiponboard` means "no first-run tips at all" — arrows and focus hints included.
const skipOnboardHints = new URLSearchParams(location.search).has('skiponboard');

const arrowsEl = document.getElementById('instrument-arrows');
const arrowEls = arrowsEl ? [...arrowsEl.querySelectorAll('.instrument-arrow')] : [];
const instrumentByKind = { drums, piano, guitar, mic };

// Timers run on frame dt, not setTimeout — backgrounded/headless tabs clamp
// setTimeout to ~1 Hz while the worker pump keeps frames coming.
const ARROWS_SETTLE_SECONDS = 0.8; // covers the 0.6 s editor camera return
const ARROWS_LIFETIME_SECONDS = 14;
const ARROWS_FADE_SECONDS = 0.45;
const arrows = { state: 'off', wait: 0, timeLeft: 0, anchors: null };

function storageGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function storageSet(key, value) { try { localStorage.setItem(key, value); } catch { /* optional */ } }

// A point just above each instrument's world bounds; measured at show time so
// it holds for any instrument placement without hand-tuned offsets.
function measureArrowAnchors() {
  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  const anchors = new Map();
  for (const el of arrowEls) {
    const instrument = instrumentByKind[el.dataset.kind];
    if (!instrument) continue;
    box.setFromObject(instrument.group);
    box.getCenter(center);
    anchors.set(el, new THREE.Vector3(center.x, box.max.y + 0.3, center.z));
  }
  return anchors;
}

const projected = new THREE.Vector3();
function positionArrows() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  for (const [el, anchor] of arrows.anchors) {
    projected.copy(anchor).project(camera);
    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (-projected.y * 0.5 + 0.5) * height;
    const visible = projected.z > -1 && projected.z < 1
      && x > -20 && x < width + 20 && y > 10 && y < height + 50;
    el.style.visibility = visible ? 'visible' : 'hidden';
    if (visible) el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }
}

function beginArrowsFadeOut() {
  arrows.state = 'out';
  arrows.timeLeft = ARROWS_FADE_SECONDS;
  arrowsEl.classList.remove('on');
}

function endArrows() {
  arrows.state = 'off';
  arrows.anchors = null;
  if (arrowsEl) {
    arrowsEl.classList.remove('on');
    arrowsEl.hidden = true;
  }
}

// The first close of the mascot editor is the moment the visitor stands on
// stage with a character of their own — point at what the stage is for.
window.addEventListener('av2:modal', (event) => {
  if (event.detail?.name !== 'mascot' || event.detail.open) return;
  if (skipOnboardHints || !session.started || arrows.state !== 'off') return;
  if (!arrowsEl || storageGet(ARROWS_KEY)) return;
  storageSet(ARROWS_KEY, '1'); // strictly once, however this run ends
  arrows.state = 'pending';
  arrows.wait = ARROWS_SETTLE_SECONDS;
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && arrows.state === 'in') beginArrowsFadeOut();
});

export function updateInstrumentArrows(dt) {
  if (arrows.state === 'off') return;
  if (arrows.state === 'pending') {
    // On a first run the editor closes straight into the welcome tip, which is
    // the one thing on screen worth reading. Hold — don't even start the settle
    // timer — until ЗРОЗУМІЛО clears it, so these arrive as the next beat
    // rather than competing with it. A returning visitor who reopens the editor
    // has no tip up, so this costs them nothing.
    if (onboard.active) return;
    arrows.wait -= dt;
    if (arrows.wait > 0) return;
    // The visitor moved on before the camera settled (reopened a modal,
    // clicked an instrument) — the moment has passed, skip quietly.
    if (ui.modalOpen || instrumentView.phase !== 'idle') { endArrows(); return; }
    arrows.anchors = measureArrowAnchors();
    arrows.timeLeft = ARROWS_LIFETIME_SECONDS;
    arrowsEl.hidden = false;
    void arrowsEl.offsetWidth; // commit display before .on so the fade-in runs
    arrowsEl.classList.add('on');
    arrows.state = 'in';
  }
  if (arrows.state === 'out') {
    arrows.timeLeft -= dt;
    if (arrows.timeLeft <= 0) endArrows();
    return;
  }
  arrows.timeLeft -= dt;
  // Retire the moment the pointing is no longer needed: any focus approach,
  // any modal, or audible play (VIBE only rises from playing).
  if (arrows.timeLeft <= 0 || instrumentView.phase !== 'idle' || ui.modalOpen || play.vibe > 0) {
    beginArrowsFadeOut();
    return;
  }
  positionArrows();
}

// How to actually play, shown once per instrument at first focus. Touch copy
// matches the pads/multitouch surfaces; desktop copy adds the jam keys.
const FOCUS_HINTS = {
  piano: {
    touch: 'Торкайся клавіш — можна кількома пальцями',
    desktop: 'Клікай клавіші або грай <span class="hl">A–L</span>, чорні — верхній ряд',
  },
  guitar: {
    touch: 'Обери акорд і проведи пальцем по струнах',
    desktop: 'Обери акорд і проведи по струнах — або <span class="hl">Q–Y</span> та <span class="hl">пробіл</span>',
  },
  drums: {
    touch: 'Бий по барабанах — можна обома руками',
    desktop: 'Клікай по барабанах або грай <span class="hl">Z X C V B</span>',
  },
  mic: {
    touch: 'Затискай ноти внизу — і співай',
    desktop: 'Затискай ноти внизу або <span class="hl">N M , . /</span>',
  },
};

export function showFirstFocusInstrumentHint(kind) {
  if (skipOnboardHints) return;
  const hint = FOCUS_HINTS[kind];
  if (!hint) return;
  let seen = {};
  try { seen = JSON.parse(storageGet(FOCUS_HINT_KEY) || '{}') || {}; } catch { /* re-show */ }
  if (seen[kind]) return;
  seen[kind] = 1;
  storageSet(FOCUS_HINT_KEY, JSON.stringify(seen));
  ui.toast(hint[isMobileGameMode() ? 'touch' : 'desktop'], 4200);
}
