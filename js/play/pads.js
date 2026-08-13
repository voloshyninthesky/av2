// ============================================================
// HELD NOTES
// A note whose length nobody knows until it ends. Sound starts on press and
// its real duration only exists on release, so loop capture opens an entry on
// press and stamps it on the way out — and has to keep stamping while the note
// is held, or a pointer the browser cancels loses the length it actually had.
//
// Two surfaces work this way and share these helpers: the piano's held keys
// and the voice ribbon's sung line.
//
// Both of the surfaces this file used to *own* have moved out. The guitar's
// chord pad became the circle of fifths in chord-wheel.js, which serves the
// piano as well; the five-button vocal pad became the field in ribbon.js. What
// is left is the capture lifecycle they all still run on, plus the one class
// that says something is docked at the bottom of the screen.
// ============================================================
import { audio } from '../core/studio.js?v=20260813-18';
import { play } from './state.js?v=20260813-18';
import { LOOP_MAX_SECONDS, loop, captureLoopEvent } from './loop.js?v=20260813-18';

// The zoom guard below has to know whether the stage is live; only main.js can
// answer that, so it arrives as a hook like every other back-reference.
let hooks = {
  isLiveStageZoomLocked: () => false,
};
export function initPads(next) {
  hooks = { ...hooks, ...next };
}

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
  // `lastGlide` is the ribbon's decimation cursor and belongs to the capture,
  // not to the finger: a take opened *mid-phrase* by the loop pedal starts its
  // own clock, and a cursor kept on the finger would still be measuring
  // against the previous one's.
  return event ? { event, startedAt, finished: false, lastGlide: null } : null;
}

/** The loop pedal, starting a take while a note is already being sung. */
export function captureHeldVocalIntoLoop() {
  if (play.heldLoopCapture) return;
  // Where the voice is *now*, not where the phrase began — the take starts
  // here, so this is its first note.
  const note = (play.heldVocal && play.heldVocalNote) || play.keyboardVocal;
  if (!note) return;
  play.heldLoopCapture = beginHeldLoopCapture(note.freq, note.vowel);
  stampHeldLoopCaptureDuration();
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
// the toast knows to move. All three live in other modules; reading their
// hidden state off the DOM keeps that a one-way call rather than a cycle.
export function syncPadsOpenClass() {
  const padsOpen = ['chord-wheel', 'groove-wheel', 'voice-ribbon']
    .some((id) => document.getElementById(id) && !document.getElementById(id).hidden);
  document.documentElement.classList.toggle('pads-open', padsOpen);
}

// Prevent rapid cross-control taps from being promoted to page zoom by mobile
// browsers. Informational panels remain zoomable / scrollable.
document.addEventListener('dblclick', (event) => {
  if (hooks.isLiveStageZoomLocked() || event.target.closest?.('#voice-ribbon, #chord-wheel, #groove-wheel, #toast')) {
    event.preventDefault();
  }
}, { passive: false, capture: true });
