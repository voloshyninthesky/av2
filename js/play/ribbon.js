// ============================================================
// VOICE RIBBON
// The vocal surface. Not a wheel and not a row of buttons: one continuous
// field, where the finger's height is the pitch and its side-to-side is the
// vowel.
//
// The argument for a field is the instrument. Every other thing on this stage
// is quantised by its own construction — frets, keys, drum heads — and the
// voice is the only one that is not. It slides between notes and it changes
// shape while it holds, and a grid of buttons can express neither. That is the
// same objection that retired the six chord slots: the surface was the wrong
// unit for the thing it was for.
//
// Two things keep a continuous axis from just sounding bad. The pitch axis has
// a detent (harmony.js) that bends towards the notes of the *stage* key
// without ever quantising, so a slide lands in tune and a deliberate bend
// still bends. And the note starts wherever the finger lands rather than
// sliding in from a default, so the first touch is never wrong on its way
// somewhere right.
//
// The theory is all in voice.js and harmony.js; this file is geometry,
// pointers and state.
// ============================================================
import { audio, mic, setMascotMouth } from '../core/studio.js?v=20260813-23';
import { play } from './state.js?v=20260813-23';
import { addVibe } from './vibe.js?v=20260813-23';
import {
  degreeMidi,
  freqFromMidi,
  keyLabel,
  midiFromFreq,
  scaleDegreeMidis,
  snapToScale,
} from './harmony.js?v=20260813-23';
import {
  onStageKeyChange,
  setStageSevenths,
  stageKey,
  stepStageKey,
  toggleStageMode,
} from './key.js?v=20260813-23';
import {
  GLIDE_SECONDS,
  PITCH_DETENT,
  VOICE_HIGH_MIDI,
  VOICE_LOW_MIDI,
  VOWELS,
  VOWEL_GLIDE_SECONDS,
  axisAtPitch,
  pitchAt,
  vowelAt,
  vowelOpenness,
} from './voice.js?v=20260813-23';
import {
  beginHeldLoopCapture,
  finishHeldLoopCapture,
  stampHeldLoopCaptureDuration,
  syncPadsOpenClass,
} from './pads.js?v=20260813-23';

// Ribbon gestures compete with the stage's own pointer handling, and a press
// has to know the mic is the instrument listening; main.js supplies both.
let hooks = {
  activateAudioForSound: () => {},
  canPlayInstrument: () => false,
  releaseKeyboardVocal: () => {},
};
export function initRibbon(next) {
  hooks = { ...hooks, ...next };
}

const ribbon = document.getElementById('voice-ribbon');
const field = document.getElementById('voice-ribbon-field');
const keyLabelEl = document.getElementById('voice-key-label');

const tonic = () => stageKey.tonicPc;
const mode = () => stageKey.mode;

// ============================================================
// GEOMETRY
// The same 200-unit viewBox the two wheels use, so a coordinate reads as a
// percentage of the dock at every size. The play area is inset on the left for
// the degree numbers and at the bottom for the vowel letters — labels *beside*
// the field rather than printed over it, because anything drawn inside it is
// something a fingertip is about to cover up.
//
// Pitch is the vertical axis and high is up. That is not a coin toss: it is
// how a singer already thinks, it is the axis the mic stand itself suggests,
// and it puts the in-key marks across the field as horizontal lines a player
// reads without being told what they are.
// ============================================================
// The right margin is wider than it looks like it needs to be. The ✕ exit sits
// just outside this corner on a 320px phone — the same collision `100vw - 100px`
// exists to keep the wheels clear of — and the last vowel's letter is centred on
// the field's edge, so at 4 units of margin it read as sitting under the button.
const FIELD = { left: -72, right: 88, top: -96, bottom: 70 };
const FIELD_WIDTH = FIELD.right - FIELD.left;
const FIELD_HEIGHT = FIELD.bottom - FIELD.top;
const DEGREE_LABEL_X = FIELD.left - 6;
const VOWEL_LABEL_Y = FIELD.bottom + 20;

const xForVowel = (vowel) => FIELD.left + vowel * FIELD_WIDTH;
const vowelForX = (x) => Math.max(0, Math.min(1, (x - FIELD.left) / FIELD_WIDTH));
const yForAxis = (axis) => FIELD.bottom - axis * FIELD_HEIGHT;
const axisForY = (y) => Math.max(0, Math.min(1, (FIELD.bottom - y) / FIELD_HEIGHT));
const yForMidi = (midi) => yForAxis(axisAtPitch(midi));

/** Client coordinates to viewBox units. The dock is square, so one scale. */
function fieldPoint(event) {
  const rect = field.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: ((event.clientX - rect.left) / rect.width) * 200 - 100,
    y: ((event.clientY - rect.top) / rect.height) * 200 - 100,
  };
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const el = (name, attributes = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
};

// Built once at module load. The degree lines are the only part that changes
// with the key, and they are rebuilt rather than hidden — a key change moves
// every one of them, so there is nothing to reuse.
const plate = el('rect', {
  x: FIELD.left, y: FIELD.top, width: FIELD_WIDTH, height: FIELD_HEIGHT, rx: 10, class: 'field-plate',
});
const vowelGuides = el('g', { class: 'vowel-guides' });
const degreeLines = el('g', { class: 'degree-lines' });
const trail = el('polyline', { class: 'voice-trail', points: '' });
const head = el('circle', { class: 'voice-head', r: 7, cx: 0, cy: 0 });
head.style.opacity = '0';

field?.append(plate, vowelGuides, degreeLines, trail, head);

VOWELS.forEach((vowel, index) => {
  const x = xForVowel(index / (VOWELS.length - 1));
  vowelGuides.append(el('line', {
    x1: x, y1: FIELD.top + 4, x2: x, y2: FIELD.bottom - 4, class: 'vowel-guide',
  }));
  const label = el('text', { x, y: VOWEL_LABEL_Y, class: 'vowel-label' });
  label.textContent = vowel.label;
  vowelGuides.append(label);
});

// ============================================================
// PAINT
// ============================================================
function paintDegrees() {
  degreeLines.replaceChildren();
  for (const { midi, degree } of scaleDegreeMidis(VOICE_LOW_MIDI, VOICE_HIGH_MIDI, tonic(), mode())) {
    const y = yForMidi(midi);
    // The tonic is drawn heavier wherever it falls, in every octave it falls
    // in. "Where is home" has to survive the key turning under it.
    const group = el('g', { class: degree === 1 ? 'degree tonic' : 'degree' });
    group.append(el('line', { x1: FIELD.left, y1: y, x2: FIELD.right, y2: y }));
    const label = el('text', { x: DEGREE_LABEL_X, y: y + 3 });
    label.textContent = String(degree);
    group.append(label);
    degreeLines.append(group);
  }
}

function paintKeyLabel() {
  if (!keyLabelEl) return;
  keyLabelEl.textContent = keyLabel(tonic(), mode());
  keyLabelEl.dataset.mode = mode();
  keyLabelEl.setAttribute('aria-label', mode() === 'minor'
    ? `Тональність ${keyLabel(tonic(), mode())}, мінор — перемкнути на мажор`
    : `Тональність ${keyLabel(tonic(), mode())}, мажор — перемкнути на мінор`);
}

function paintRibbon() {
  paintDegrees();
  paintKeyLabel();
  field?.setAttribute('aria-label', `Голос, тональність ${keyLabel(tonic(), mode())}`);
}

// A key change moves every line on the field, and the note in the air belongs
// to the key that is leaving. Dropping it is the same rule the wheel follows:
// what is drawn and what is sounding never disagree.
onStageKeyChange(() => {
  releaseVoice();
  paintRibbon();
});

// ============================================================
// THE SUNG NOTE
// One voice at a time, deliberately: a second finger on the field is a second
// throat, which is not a thing a singer has. The keyboard row and the field
// therefore share this single slot rather than stacking.
// ============================================================
let held = null;

const GLIDE_MIN_MS = 25;
const GLIDE_MIN_SEMITONES = 0.12;
const GLIDE_MIN_VOWEL = 0.04;
const TRAIL_POINTS = 44;

function pushTrail(x, y) {
  held.trail.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  if (held.trail.length > TRAIL_POINTS) held.trail.shift();
  trail.setAttribute('points', held.trail.join(' '));
}

function moveHead(x, y) {
  head.setAttribute('cx', x.toFixed(2));
  head.setAttribute('cy', y.toFixed(2));
}

/**
 * Record a breakpoint of the line being sung, if it says anything the last one
 * did not. Decimating here rather than on release means a steady note never
 * builds a list to throw away, and a `glide` key never appears on an event
 * that does not need one — which is what keeps every existing vocal take, and
 * every keyboard vocal, byte-for-byte what it was.
 */
function captureGlide(midi, vowelX) {
  const capture = play.heldLoopCapture;
  if (!capture || capture.finished || !audio.ctx) return;
  // The cursor belongs to the capture, not the finger: the loop pedal can open
  // a take part-way through a phrase, and that take's clock starts at its own
  // first note rather than at the one the finger began on.
  capture.lastGlide ||= { at: 0, midi: midiFromFreq(capture.event.freq), vowelX: capture.event.vowel };
  const at = audio.ctx.currentTime - capture.startedAt;
  const last = capture.lastGlide;
  if (at - last.at < GLIDE_MIN_MS / 1000) return;
  if (Math.abs(midi - last.midi) < GLIDE_MIN_SEMITONES
    && Math.abs(vowelX - last.vowelX) < GLIDE_MIN_VOWEL) return;
  (capture.event.glide ||= []).push([
    Number(at.toFixed(3)), Number(midi.toFixed(3)), Number(vowelX.toFixed(3)),
  ]);
  capture.lastGlide = { at, midi, vowelX };
}

// The mascot is the singer, so the mascot is the notation: an open vowel opens
// the mouth. Three carved mouths and no morph targets, so this picks between
// them rather than blending — and it is an override, restored to the gifted
// character's own smile the moment the note ends.
//
// Deliberately *not* on the pulse timer with mic.sing(): the mouth follows the
// finger across the vowel axis, and at 120 ms it visibly lagged the drag. The
// mic does stay on the pulse, because studio.js wraps `sing` in a note burst
// and a floor pulse — those are per-note punctuation, not a continuous read.
function syncMascotMouth(vowelX) {
  const openness = vowelOpenness(vowelX);
  setMascotMouth(openness > 0.66 ? 'wide' : (openness > 0.3 ? 'soft' : 'neutral'));
}

function startVoice(midi, vowelX, { fromField = false } = {}) {
  // Order matters, and it is not the obvious one. `activateAudioForSound` can
  // *rebuild* the audio route, and the rebuild re-creates whatever `play`
  // says is being held (intro.js) — so activating first would hand us a fresh
  // voice for the OLD note, which the line below then overwrites without ever
  // stopping. Let go of the current note first, then wake the route.
  releaseVoice();
  hooks.releaseKeyboardVocal();
  hooks.activateAudioForSound();
  const freq = freqFromMidi(midi);
  const voice = audio.startVocal(freq, vowelAt(vowelX));
  held = { voice, midi, vowelX, pointerId: null, fromField, trail: [], pulseTimer: null, audioFrame: 0 };
  play.heldVocal = voice;
  play.heldVocalNote = { freq, vowel: vowelX };
  play.heldLoopCapture = beginHeldLoopCapture(freq, vowelX);
  addVibe(3);
  mic.sing(axisAtPitch(midi));
  syncMascotMouth(vowelX);
  held.pulseTimer = setInterval(() => {
    mic.sing(axisAtPitch(held.midi));
    // Stamp the sustain as it runs, so a pointer the browser cancels still
    // keeps the length it actually had.
    stampHeldLoopCaptureDuration();
  }, 120);
  play.heldVocalPulseTimer = held.pulseTimer;
  navigator.vibrate?.(16);
  const x = xForVowel(vowelX);
  const y = yForMidi(midi);
  trail.style.opacity = '1';
  head.style.opacity = '1';
  moveHead(x, y);
  pushTrail(x, y);
  return held;
}

// A high-rate pointer fires well past 60 times a second, and every one of those
// was re-scheduling a ramp on six AudioParams — each cancelling the last one a
// third of the way through. Coalescing to one frame keeps the glide identical
// to the ear (the ramps are longer than a frame anyway) and stops the scheduler
// being rewritten faster than it can play. State, capture and the drawn line
// still update on every move; only the audio waits for the frame.
function flushVoiceAudio() {
  if (!held) return;
  held.audioFrame = 0;
  held.voice?.setPitch?.(freqFromMidi(held.midi), GLIDE_SECONDS);
  held.voice?.setVowel?.(vowelAt(held.vowelX), VOWEL_GLIDE_SECONDS);
}

function moveVoice(midi, vowelX) {
  if (!held) return;
  held.midi = midi;
  held.vowelX = vowelX;
  const freq = freqFromMidi(midi);
  // Where the voice is *now*, for anything that opens a capture mid-phrase.
  play.heldVocalNote = { freq, vowel: vowelX };
  if (!held.audioFrame) held.audioFrame = requestAnimationFrame(flushVoiceAudio);
  syncMascotMouth(vowelX);
  captureGlide(midi, vowelX);
  const x = xForVowel(vowelX);
  const y = yForMidi(midi);
  moveHead(x, y);
  pushTrail(x, y);
}

function releaseVoice() {
  if (!held) return;
  clearInterval(held.pulseTimer);
  if (held.audioFrame) cancelAnimationFrame(held.audioFrame);
  finishHeldLoopCapture();
  const voiceToStop = held.voice;
  audio.stopVocal(voiceToStop);
  held = null;
  // Stop whatever `play` thinks is held too, not only our own handle: a route
  // rebuild can swap a fresh voice in behind us, and only this object knows
  // that the note it belongs to is over.
  if (play.heldVocal && play.heldVocal !== voiceToStop) audio.stopVocal(play.heldVocal);
  play.heldVocal = null;
  play.heldVocalNote = null;
  play.heldVocalPointer = null;
  play.heldVocalPulseTimer = null;
  setMascotMouth(null);
  head.style.opacity = '0';
  // The line stays on the field for a moment after the finger leaves. It is
  // the only notation this surface has, and it is worth seeing what you just
  // sang for longer than you were singing it.
  trail.style.opacity = '0';
}

/** Called from main.js when focus ends, and by the audio-route teardown. */
export function stopRibbonVoice() {
  releaseVoice();
}

// ============================================================
// POINTER
// ============================================================
function pitchFromPoint(point) {
  const raw = pitchAt(axisForY(point.y));
  return snapToScale(raw, tonic(), mode(), PITCH_DETENT);
}

field?.addEventListener('pointerdown', (event) => {
  if (!hooks.canPlayInstrument('mic')) return;
  const point = fieldPoint(event);
  if (!point) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  // A second finger is ignored rather than stealing the note: one throat.
  if (held?.pointerId !== null && held?.pointerId !== undefined) return;
  keyboardDegree = null;
  keyboardCode = null;
  const current = startVoice(pitchFromPoint(point), vowelForX(point.x), { fromField: true });
  current.pointerId = event.pointerId;
  play.heldVocalPointer = event.pointerId;
  // Capture is the last thing a press does and is allowed to fail: the note is
  // already sounding, and a pointer the browser no longer tracks must not take
  // it down with it.
  try { field.setPointerCapture?.(event.pointerId); } catch (_) { /* the press stands */ }
});

// The move and the release listen on the WINDOW, not on the field, and that is
// the whole difference between a ribbon and a button.
//
// A wedge is pressed and let go in one place, so the wheels can bind to their
// own element. A sung line is a *drag*, and this field is 236px on a phone —
// the finger leaves it constantly. Bound to the field, a drag that wandered off
// stopped receiving moves (the note froze mid-phrase) and then released
// somewhere else entirely, so `pointerup` never reached this module at all and
// the note **sustained until the 10-second safety timer**. That is the droning
// note, and it is why pointer capture cannot be the only mechanism: capture is
// allowed to fail, and on the failure path there was nothing underneath it.
function pointerIsOurs(event) {
  return held && held.pointerId !== null && held.pointerId === event.pointerId;
}

window.addEventListener('pointermove', (event) => {
  if (!pointerIsOurs(event)) return;
  const point = fieldPoint(event);
  if (!point) return;
  if (event.cancelable) event.preventDefault();
  moveVoice(pitchFromPoint(point), vowelForX(point.x));
}, { passive: false });

function endFieldPointer(event) {
  if (!pointerIsOurs(event)) return;
  releaseVoice();
}
// Deliberately NOT `lostpointercapture`. It was in this list while the drag was
// element-bound, where losing capture really did mean the drag was over. Now
// that move and up come from the window, capture is an optimisation the note
// does not depend on — and capture can transfer for reasons that have nothing
// to do with the finger lifting, at which point ending the note is just a
// second way to cut a phrase short.
for (const name of ['pointerup', 'pointercancel']) {
  window.addEventListener(name, endFieldPointer);
}

// A sung note is a *long press* — that is the instrument, not an edge case —
// and a long press is exactly what a browser turns into a context menu or a
// selection callout. When it does, it takes the gesture with it and the phrase
// dies mid-slide. Every other surface here is tapped, so none of them had to
// care. Suppressed only over the ribbon, so a long press anywhere else is
// still the browser's.
ribbon?.addEventListener('contextmenu', (event) => event.preventDefault());
// Losing the window mid-drag is a release too — otherwise the note outlives the
// tab being switched away from, which is the same stuck-sustain by another route.
window.addEventListener('blur', () => releaseVoice());

// Hub controls are ordinary click-driven buttons: keep their pointer off the
// field and off the canvas, but do NOT preventDefault, or touch never gets the
// synthesized click and they read as dead.
ribbon?.addEventListener('pointerdown', (event) => {
  if (event.target === field || field?.contains(event.target)) return;
  event.stopPropagation();
  event.stopImmediatePropagation();
}, { capture: true });

for (const button of ribbon?.querySelectorAll('[data-key-step]') || []) {
  button.addEventListener('click', () => stepStageKey(Number(button.dataset.keyStep)));
}
keyLabelEl?.addEventListener('click', toggleStageMode);

// ============================================================
// KEYBOARD
// The field cannot be dragged with a keyboard, so the degrees are the keyboard
// path: `1`-`7` sing the seven notes of the key, exactly as they sound its
// seven chords at the guitar and piano and strike its seven kit pieces at the
// drums. `1` is the tonic in either mode, which is the promise the chord row
// already makes.
//
// The arrows are the glide. Holding a degree and pressing one slides a scale
// step without restarting the note — the one piece of portamento a keyboard
// can honestly express, and the reason the row is not just five buttons again.
// ============================================================
// The note is owned by the *key code* that started it, not by the degree it is
// currently on — and those two come apart the moment you glide. Holding `1`,
// pressing `3`, then letting go of `1` used to stop the note `3` was singing:
// the release matched on "is anything held" and the answer was yes. A row of
// seven held keys needs the release to be able to say "not mine".
let keyboardDegree = null;
let keyboardCode = null;

export function pressRibbonDegree(degree, code = null, vowel = null) {
  if (!hooks.canPlayInstrument('mic')) return false;
  const midi = degreeMidi(degree, tonic(), mode(), VOICE_LOW_MIDI);
  keyboardDegree = degree;
  keyboardCode = code;
  // A key with no vowel of its own sings wherever the mouth already was, so a
  // finger's vowel survives being handed to the keyboard mid-phrase.
  startVoice(midi, vowel ?? held?.vowelX ?? 0.5);
  return true;
}

export function releaseRibbonDegree(code = null) {
  if (keyboardDegree === null) return false;
  // A release from a key that did not start this note is not this note's.
  if (code !== null && keyboardCode !== null && code !== keyboardCode) return false;
  keyboardDegree = null;
  keyboardCode = null;
  releaseVoice();
  return true;
}

/** Glide the held keyboard note one scale step. Nothing restarts. */
export function glideRibbonDegree(direction) {
  if (!held || keyboardDegree === null) return false;
  const notes = scaleDegreeMidis(VOICE_LOW_MIDI, VOICE_HIGH_MIDI, tonic(), mode());
  const index = notes.findIndex(({ midi }) => Math.abs(midi - held.midi) < 0.5);
  const next = notes[Math.max(0, Math.min(notes.length - 1, index + direction))];
  if (!next || index === -1) return false;
  keyboardDegree = next.degree;
  moveVoice(next.midi, held.vowelX);
  return true;
}

export const ribbonHasKeyboardNote = () => keyboardDegree !== null;

// ============================================================
// SHOW / HIDE
// ============================================================
export function showRibbon() {
  if (!ribbon) return;
  paintRibbon();
  ribbon.hidden = false;
  syncPadsOpenClass();
}

export function hideRibbon() {
  if (!ribbon) return;
  releaseVoice();
  keyboardDegree = null;
  keyboardCode = null;
  ribbon.hidden = true;
  syncPadsOpenClass();
}

// Headless QA reads the ribbon as data rather than driving synthetic pointers —
// same role as __chordWheelDebug / __grooveDebug. `docked` is the assertion
// that matters most: three surfaces now share one corner and exactly one of
// them may ever be visible.
window.__ribbonDebug = () => ({
  open: Boolean(ribbon && !ribbon.hidden),
  tonic: tonic(),
  tonicLabel: keyLabel(tonic(), mode()),
  mode: mode(),
  singing: Boolean(held),
  midi: held?.midi ?? null,
  vowel: held?.vowelX ?? null,
  keyboardDegree,
  range: [VOICE_LOW_MIDI, VOICE_HIGH_MIDI],
  degrees: scaleDegreeMidis(VOICE_LOW_MIDI, VOICE_HIGH_MIDI, tonic(), mode()),
  glide: play.heldLoopCapture?.event?.glide?.length ?? 0,
  // Live voice count in the engine. If this climbs across presses, something
  // is being started without being stopped — the shape a drone has.
  voices: audio._activeVocals?.size ?? null,
  docked: ['chord-wheel', 'groove-wheel', 'voice-ribbon']
    .filter((id) => !document.getElementById(id)?.hidden),
});

paintRibbon();
