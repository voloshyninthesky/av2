// ============================================================
// VOCAL + CHORD PADS
// The on-screen instruments that appear in a close-up. Both are held-note
// surfaces: sound starts on press and its real duration is only known on
// release, so loop capture opens an entry on press and stamps it on release.
// The chord pad also supports latching, so a quick tap frees the strum hand.
// ============================================================
import { ui, audio, guitar, mic } from '../core/studio.js?v=20260807-01';
import { isQuickGuitarTap } from '../guitar-gestures.js?v=20260807-01';
import { canvas } from '../view/rig.js?v=20260807-01';
import { play, activePointers } from './state.js?v=20260807-01';
import {
  CHORD_QUALITIES,
  CHORD_ROOTS,
  GUITAR_CHORDS,
  padChords,
  setPadChord,
  slotKeyLabel,
} from './guitar.js?v=20260807-01';
import { addVibe } from './vibe.js?v=20260807-01';
import { LOOP_MAX_SECONDS, loop, captureLoopEvent, playMusicalEvent } from './loop.js?v=20260807-01';

// Pad gestures compete with the stage's own pointer handling; main.js supplies
// the predicates and teardown that only it can answer.
let hooks = {
  activateAudioForSound: () => {},
  isGuitarPlayFocus: () => false,
  isLiveStageZoomLocked: () => false,
  eventInvolvesUiChrome: () => false,
  releaseKeyboardVocal: () => {},
  currentGuitarChordName: () => null,
};
export function initPads(next) {
  hooks = { ...hooks, ...next };
}

// ---- microphone note pad ----
const vocalPad = document.getElementById('vocal-pad');
const vocalButtons = [...vocalPad.querySelectorAll('[data-vocal-freq]')];
let vocalPadTimer = null;
const chordPad = document.getElementById('chord-pad');
const chordButtons = [...(chordPad?.querySelectorAll('[data-chord]') || [])];
const chordEditBtn = document.getElementById('chord-edit-btn');
const chordPicker = document.getElementById('chord-picker');
// Slot editing: ✎ arms it, a slot tap opens the picker, ✓ / focus exit ends it.
// A separate mode instead of long-press, because holding a chord button IS the
// play gesture — the pad cannot give "hold" a second meaning.
const chordEdit = { on: false, slot: null };

// The six button elements are permanent (touch bookkeeping is keyed on them);
// a slot change restyles them in place rather than replacing nodes.
function renderChordPad() {
  chordButtons.forEach((button, slot) => {
    const name = padChords[slot];
    button.dataset.chord = name;
    button.textContent = name;
    button.setAttribute('aria-label', `Акорд ${name}`);
    // Position, not the chord's name, is what the keyboard addresses — a
    // generated library has too many same-initial names to key off.
    button.setAttribute('aria-keyshortcuts', slotKeyLabel(slot));
  });
  syncChordPadHeld();
}

function closeChordPicker() {
  if (!chordPicker) return;
  chordPicker.hidden = true;
  chordEdit.slot = null;
  for (const button of chordButtons) button.classList.remove('editing');
}

function setChordEditMode(on) {
  if (!chordEditBtn || chordEdit.on === on) return;
  chordEdit.on = on;
  chordEditBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  chordEditBtn.textContent = on ? '✓' : '✎';
  chordPad?.classList.toggle('editing', on);
  if (!on) closeChordPicker();
}

// 84 chords will not fit in a flat list, and they do not need to: a chord is
// a root plus a quality, so the picker asks for those two separately — 12 + 7
// controls instead of 84. The quality row is sticky within one open picker so
// picking "m" then trying several roots is one tap each.
function openChordPicker(slot) {
  if (!chordPicker) return;
  chordEdit.slot = slot;
  chordButtons.forEach((button, index) => button.classList.toggle('editing', index === slot));

  const current = padChords[slot];
  // Split the current chord back into root + quality so the picker opens on it.
  const currentRoot = CHORD_ROOTS.find((r) => current === r || (current.startsWith(r)
    && CHORD_QUALITIES[current.slice(r.length)] !== undefined
    // "C#..." must not match root "C"
    && !CHORD_ROOTS.includes(current.slice(0, r.length + 1)))) || 'C';
  let quality = current.slice(currentRoot.length);
  if (CHORD_QUALITIES[quality] === undefined) quality = '';

  const qualityRow = document.createElement('div');
  qualityRow.className = 'chord-picker-qualities';
  qualityRow.setAttribute('role', 'radiogroup');
  qualityRow.setAttribute('aria-label', 'Тип акорду');
  const rootRow = document.createElement('div');
  rootRow.className = 'chord-picker-roots';
  rootRow.setAttribute('role', 'radiogroup');
  rootRow.setAttribute('aria-label', 'Нота акорду');

  const paint = () => {
    for (const button of qualityRow.children) {
      const on = button.dataset.quality === quality;
      button.classList.toggle('current', on);
      button.setAttribute('aria-checked', on ? 'true' : 'false');
    }
    for (const button of rootRow.children) {
      const name = button.dataset.root + quality;
      const isCurrent = name === padChords[slot];
      button.classList.toggle('current', isCurrent);
      button.setAttribute('aria-checked', isCurrent ? 'true' : 'false');
      // Already on another slot: a second pad with the same chord just wastes
      // one of six. Harmless now that keys are positional, still pointless.
      button.disabled = !isCurrent && padChords.includes(name);
      button.title = name;
    }
  };

  for (const [suffix, { label }] of Object.entries(CHORD_QUALITIES)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.quality = suffix;
    button.textContent = suffix || 'maj';
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-label', label);
    button.addEventListener('click', () => { quality = suffix; paint(); });
    qualityRow.appendChild(button);
  }
  for (const root of CHORD_ROOTS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.root = root;
    button.textContent = root;
    button.setAttribute('role', 'radio');
    button.addEventListener('click', () => {
      if (!setPadChord(slot, root + quality)) return;
      // The swapped-out chord may still be held / latched / key-armed;
      // clearing selection keeps pad state and sound in agreement.
      clearGuitarInteractionState();
      renderChordPad();
      closeChordPicker();
    });
    rootRow.appendChild(button);
  }

  chordPicker.replaceChildren(qualityRow, rootRow);
  paint();
  chordPicker.hidden = false;
}

chordEditBtn?.addEventListener('click', () => setChordEditMode(!chordEdit.on));
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && chordEdit.on) setChordEditMode(false);
});
chordPad?.addEventListener('pointerdown', (event) => {
  // Swallow pad chrome only — chord buttons handle their own pointer claim.
  if (event.target.closest?.('[data-chord]')) return;
  event.stopPropagation();
  event.stopImmediatePropagation();
  // The ✎ toggle and the picker options are ordinary buttons driven by click:
  // keep their pointer off the canvas, but do NOT preventDefault, or touch
  // never gets the synthesized click and the controls read as dead.
  if (event.target.closest?.('#chord-edit-btn, #chord-picker')) return;
  if (event.pointerType === 'touch') event.preventDefault();
}, { capture: true });

export function stampHeldLoopCaptureDuration() {
  if (!play.heldLoopCapture || play.heldLoopCapture.finished || !audio.ctx) return;
  const elapsed = Math.max(0.12, audio.ctx.currentTime - play.heldLoopCapture.startedAt);
  const maximum = loop.duration > 0 ? Math.max(0.12, loop.duration - 0.06) : LOOP_MAX_SECONDS;
  play.heldLoopCapture.event.duration = Math.min(maximum, elapsed);
}

export function beginHeldLoopCapture(freq, vowel) {
  const startedAt = audio.ctx?.currentTime;
  const event = captureLoopEvent({ type: 'vocal', freq, vowel, vel: 1, duration: 0.12 }, startedAt);
  if (event) event.durationPending = true;
  return event ? { event, startedAt, finished: false } : null;
}

export function captureHeldVocalIntoLoop() {
  if (play.heldLoopCapture) return;
  if (play.heldVocal && play.heldVocalButton && play.heldVocalPointer !== null) {
    play.heldLoopCapture = beginHeldLoopCapture(
      Number(play.heldVocalButton.dataset.vocalFreq),
      Number(play.heldVocalButton.dataset.vocalVowel),
    );
    stampHeldLoopCaptureDuration();
    return;
  }
  if (play.keyboardVocal) {
    play.heldLoopCapture = beginHeldLoopCapture(play.keyboardVocal.freq, play.keyboardVocal.vowel);
    stampHeldLoopCaptureDuration();
  }
}

export function deferHeldLoopEventPlayback(event) {
  if (!event || !audio.ctx || loop.duration <= 0) return;
  // Base take closes while state is still "recording" and epoch is unset.
  // Defer to cycle 1 so live holds do not double with the first playback.
  // Overdub / playing use a real epoch to skip the current cycle only.
  if (loop.state === 'recording') {
    event.playFromCycle = Math.max(event.playFromCycle, 1);
    return;
  }
  const currentCycle = Math.max(0, Math.floor((audio.ctx.currentTime - loop.epoch) / loop.duration));
  event.playFromCycle = Math.max(event.playFromCycle, currentCycle + 1);
}

export function finishHeldLoopCapture() {
  if (!play.heldLoopCapture || play.heldLoopCapture.finished) return;
  play.heldLoopCapture.finished = true;
  stampHeldLoopCaptureDuration();
  delete play.heldLoopCapture.event.durationPending;
  deferHeldLoopEventPlayback(play.heldLoopCapture.event);
  play.heldLoopCapture = null;
}

function syncPadsOpenClass() {
  const padsOpen = Boolean(
    (vocalPad && !vocalPad.hidden)
    || (chordPad && !chordPad.hidden),
  );
  document.documentElement.classList.toggle('pads-open', padsOpen);
}

export function showVocalPad(autoHide = true) {
  vocalPad.hidden = false;
  syncPadsOpenClass();
  clearTimeout(vocalPadTimer);
  if (autoHide) vocalPadTimer = setTimeout(() => { vocalPad.hidden = true; syncPadsOpenClass(); }, 7600);
}

export function hideVocalPad() {
  clearTimeout(vocalPadTimer);
  clearInterval(play.heldVocalPulseTimer);
  finishHeldLoopCapture();
  audio.stopVocal(play.heldVocal);
  play.heldVocalButton?.classList.remove('playing');
  play.heldVocal = null;
  play.heldVocalButton = null;
  play.heldVocalPointer = null;
  vocalPad.hidden = true;
  syncPadsOpenClass();
}

export function syncChordPadHeld() {
  const activeChord = hooks.currentGuitarChordName();
  for (const button of chordButtons) {
    const isActive = button.dataset.chord === activeChord;
    button.classList.toggle('held', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  }
  document.documentElement.classList.toggle('guitar-fretting', Boolean(activeChord));
}

export function showChordPad() {
  if (!chordPad) return;
  syncChordPadHeld();
  chordPad.hidden = false;
  syncPadsOpenClass();
}

export function hideChordPad() {
  if (!chordPad) return;
  clearGuitarInteractionState();
  setChordEditMode(false); // leaving focus also leaves slot editing
  chordPad.hidden = true;
  syncPadsOpenClass();
}

function holdGuitarChord(name, pointerId) {
  if (!GUITAR_CHORDS[name]) return;
  play.heldGuitarChord = name;
  play.heldGuitarChordPointer = pointerId;
  syncChordPadHeld();
  navigator.vibrate?.(10);
}

function releaseHeldGuitarChord(event) {
  if (event && play.heldGuitarChordPointer !== null && event.pointerId !== play.heldGuitarChordPointer) return;
  play.heldGuitarChord = null;
  play.heldGuitarChordPointer = null;
  syncChordPadHeld();
}

function toggleLatchedGuitarChord(name) {
  if (!GUITAR_CHORDS[name]) return;
  play.latchedGuitarChord = play.latchedGuitarChord === name ? null : name;
  play.heldGuitarChord = null;
  play.heldGuitarChordPointer = null;
  syncChordPadHeld();
}

export function clearGuitarInteractionState() {
  for (const [pointerId, info] of activePointers) {
    if (!info.mode?.startsWith('guitar-')) continue;
    activePointers.delete(pointerId);
    try {
      if (canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture(pointerId);
    } catch (_) { /* ignore */ }
  }
  for (const [pointerId, interaction] of activeTouchChordPointers) {
    try {
      if (interaction.button?.hasPointerCapture?.(pointerId)) {
        interaction.button.releasePointerCapture(pointerId);
      }
    } catch (_) { /* ignore */ }
  }
  activeTouchChordPointers.clear();
  play.heldGuitarChord = null;
  play.heldGuitarChordPointer = null;
  play.latchedGuitarChord = null;
  play.keyboardGuitarChord = null;
  play.guitarStrokeMotion = 0;
  syncChordPadHeld();
}

const recentTouchChordAt = new WeakMap();
const activeTouchChordPointers = new Map();

export function markHeldTouchGuitarChordUsed() {
  if (play.heldGuitarChordPointer === null) return;
  const interaction = activeTouchChordPointers.get(play.heldGuitarChordPointer);
  if (interaction) interaction.usedForPlay = true;
}

function finishTouchGuitarChord(event, { cancelled = false } = {}) {
  const interaction = activeTouchChordPointers.get(event.pointerId);
  if (!interaction) {
    releaseHeldGuitarChord(event);
    return;
  }
  activeTouchChordPointers.delete(event.pointerId);
  releaseHeldGuitarChord(event);
  if (!isQuickGuitarTap({
    elapsedMs: performance.now() - interaction.startedAt,
    distancePx: interaction.distancePx,
    cancelled,
    usedForPlay: interaction.usedForPlay,
  })) return;
  toggleLatchedGuitarChord(interaction.name);
}

for (const button of chordButtons) {
  button.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    event.stopImmediatePropagation();
    // Edit mode repurposes the tap: no hold, no capture, and no preventDefault
    // so the browser still synthesizes the click that opens the picker.
    if (chordEdit.on) return;
    if (event.pointerType === 'touch') {
      event.preventDefault();
      recentTouchChordAt.set(button, performance.now());
      activeTouchChordPointers.set(event.pointerId, {
        name: button.dataset.chord,
        button,
        startedAt: performance.now(),
        startX: event.clientX,
        startY: event.clientY,
        distancePx: 0,
        usedForPlay: false,
      });
      holdGuitarChord(button.dataset.chord, event.pointerId);
      button.setPointerCapture?.(event.pointerId);
    }
  });
  button.addEventListener('pointermove', (event) => {
    const interaction = activeTouchChordPointers.get(event.pointerId);
    if (!interaction) return;
    interaction.distancePx = Math.max(
      interaction.distancePx,
      Math.hypot(event.clientX - interaction.startX, event.clientY - interaction.startY),
    );
  });
  button.addEventListener('click', (event) => {
    if (chordEdit.on) {
      openChordPicker(chordButtons.indexOf(button));
      return;
    }
    if (event.detail !== 0 && performance.now() - (recentTouchChordAt.get(button) || 0) < 700) return;
    toggleLatchedGuitarChord(button.dataset.chord);
  });
  button.addEventListener('pointerup', (event) => finishTouchGuitarChord(event));
  button.addEventListener('pointercancel', (event) => finishTouchGuitarChord(event, { cancelled: true }));
  button.addEventListener('lostpointercapture', (event) => finishTouchGuitarChord(event, { cancelled: true }));
}

// Hold chord + second-finger strum: stop Safari/Chrome page pinch-zoom (not orbit dolly).
// Do not preventDefault on pad↔canvas multitouch touchstart — that drops the strum finger.
function blockGuitarBrowserPageZoom(event) {
  if (!hooks.isGuitarPlayFocus()) return;
  if (hooks.eventInvolvesUiChrome(event)) return;
  if (event.touches && event.touches.length >= 2 && event.cancelable) event.preventDefault();
}
document.addEventListener('touchstart', blockGuitarBrowserPageZoom, { passive: false, capture: true });
document.addEventListener('touchmove', blockGuitarBrowserPageZoom, { passive: false, capture: true });
// iOS Safari still fires gesture* for page pinch even with user-scalable=no.
for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(name, (event) => {
    if (hooks.isGuitarPlayFocus()) event.preventDefault();
  }, { passive: false, capture: true });
}

// Prevent rapid cross-control taps from being promoted to page zoom by mobile
// browsers. Informational panels remain zoomable / scrollable.
document.addEventListener('dblclick', (event) => {
  if (hooks.isLiveStageZoomLocked() || event.target.closest?.('#vocal-pad, #chord-pad, #toast')) {
    event.preventDefault();
  }
}, { passive: false, capture: true });

export function playVocalNote(freq, vowel, showPrice = false) {
  playMusicalEvent({ type: 'vocal', freq, vowel, duration: 0.68, vibe: 4, showPrice });
}

function releaseHeldVocal(event) {
  if (event && play.heldVocalPointer !== null && event.pointerId !== play.heldVocalPointer) return;
  clearInterval(play.heldVocalPulseTimer);
  finishHeldLoopCapture();
  audio.stopVocal(play.heldVocal);
  play.heldVocalButton?.classList.remove('playing');
  play.heldVocal = null;
  play.heldVocalButton = null;
  play.heldVocalPointer = null;
  showVocalPad();
}

for (const button of vocalButtons) {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    releaseHeldVocal();
    hooks.releaseKeyboardVocal();
    const freq = Number(button.dataset.vocalFreq);
    const vowel = Number(button.dataset.vocalVowel);
    hooks.activateAudioForSound();
    mic.sing();
    play.heldVocal = audio.startVocal(freq, vowel);
    play.heldLoopCapture = beginHeldLoopCapture(freq, vowel);
    play.heldVocalButton = button;
    play.heldVocalPointer = event.pointerId;
    button.setPointerCapture?.(event.pointerId);
    button.classList.add('playing');
    addVibe(3, 'mic');
    showVocalPad(false);
    play.heldVocalPulseTimer = setInterval(() => {
      mic.sing();
      // Stamp sustain while held so a cancelled pointer still keeps the length.
      stampHeldLoopCaptureDuration();
    }, 120);
    navigator.vibrate?.(16);
  });
  button.addEventListener('pointerup', releaseHeldVocal);
  button.addEventListener('pointercancel', releaseHeldVocal);
  button.addEventListener('lostpointercapture', releaseHeldVocal);
  button.addEventListener('touchend', (event) => event.preventDefault(), { passive: false });
}


// Restore any saved chord-slot layout onto the pad's permanent buttons.
renderChordPad();
