// ============================================================
// VOCAL + CHORD PADS
// The on-screen instruments that appear in a close-up. Both are held-note
// surfaces: sound starts on press and its real duration is only known on
// release, so loop capture opens an entry on press and stamps it on release.
// The chord pad also supports latching, so a quick tap frees the strum hand.
// ============================================================
import { ui, audio, guitar, mic } from '../core/studio.js?v=20260804-10';
import { isQuickGuitarTap } from '../guitar-gestures.js?v=20260802-1';
import { canvas } from '../view/rig.js?v=20260804-10';
import { play, activePointers } from './state.js?v=20260804-10';
import { GUITAR_CHORDS } from './guitar.js?v=20260804-10';
import { addVibe } from './vibe.js?v=20260804-10';
import { LOOP_MAX_SECONDS, loop, captureLoopEvent, playMusicalEvent } from './loop.js?v=20260804-10';

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
chordPad?.addEventListener('pointerdown', (event) => {
  // Swallow pad chrome only — chord buttons handle their own pointer claim.
  if (event.target.closest?.('[data-chord]')) return;
  event.stopPropagation();
  event.stopImmediatePropagation();
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
    addVibe(3);
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

