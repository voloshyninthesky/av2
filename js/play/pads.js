// ============================================================
// VOCAL PAD
// The on-screen note strip that appears in the microphone close-up. It is a
// held-note surface: sound starts on press and its real duration is only known
// on release, so loop capture opens an entry on press and stamps it on
// release. Those capture helpers are shared — the piano's held keys work the
// same way and import them from here.
//
// The guitar's chord surface used to live in this file too; it is now the
// circle of fifths in chord-wheel.js, which serves the piano as well.
// ============================================================
import { audio, mic } from '../core/studio.js?v=20260813-08';
import { play } from './state.js?v=20260813-08';
import { addVibe } from './vibe.js?v=20260813-08';
import { LOOP_MAX_SECONDS, loop, captureLoopEvent, playMusicalEvent } from './loop.js?v=20260813-08';

// Pad gestures compete with the stage's own pointer handling; main.js supplies
// the predicates and teardown that only it can answer.
let hooks = {
  activateAudioForSound: () => {},
  isLiveStageZoomLocked: () => false,
  releaseKeyboardVocal: () => {},
};
export function initPads(next) {
  hooks = { ...hooks, ...next };
}

const vocalPad = document.getElementById('vocal-pad');
const vocalButtons = [...vocalPad.querySelectorAll('[data-vocal-freq]')];
let vocalPadTimer = null;
const chordWheel = document.getElementById('chord-wheel');

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

// Every docked play surface shares one "something is at the bottom" class, so
// the toast knows to move. The wheels live in other modules; reading their
// hidden state off the DOM keeps that a one-way call rather than a cycle.
export function syncPadsOpenClass() {
  const padsOpen = Boolean(
    (vocalPad && !vocalPad.hidden)
    || (chordWheel && !chordWheel.hidden)
    || !document.getElementById('groove-wheel')?.hidden,
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

// Prevent rapid cross-control taps from being promoted to page zoom by mobile
// browsers. Informational panels remain zoomable / scrollable.
document.addEventListener('dblclick', (event) => {
  if (hooks.isLiveStageZoomLocked() || event.target.closest?.('#vocal-pad, #chord-wheel, #groove-wheel, #toast')) {
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
