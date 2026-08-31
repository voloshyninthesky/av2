// ============================================================
// CHORD WHEEL
// The circle of fifths, as the stage's one chord surface. Twelve major wedges
// on the outer ring, their relative minors directly inside, rotated so the
// current key's tonic sits at the top. A key's six chords are then not six
// arbitrary buttons but one contiguous block of the wheel — you can see which
// chords belong together before you can name them, which six free slots could
// never show.
//
// The same wedge means different things to the two instruments it serves, and
// that follows from the instruments rather than from taste:
//   * Guitar — a wedge only *arms* a chord. The neck still makes the sound, so
//     holding and latching stay silent, exactly as the two-hand model requires.
//   * Piano — a wedge sounds the chord itself and presses those keys on the
//     3D keybed, because there is no second surface to strike. It is therefore
//     momentary: a latched piano chord would sustain forever.
//
// The theory is all in harmony.js; this file is geometry, pointers and state.
// ============================================================
import { piano } from '../core/studio.js?v=20260831-01';
import { isQuickGuitarTap } from '../guitar-gestures.js?v=20260831-01';
import { canvas } from '../view/rig.js?v=20260831-01';
import { play, activePointers } from './state.js?v=20260831-01';
import {
  GUITAR_CHORDS,
  fifthIndexOf,
  keyDegrees,
  keyLabel,
  keySignaturePc,
  midiFromFreq,
  pianoVoicing,
  wedgeChordName,
  wedgeDegree,
  wedgeLabel,
} from './harmony.js?v=20260831-01';
import {
  onStageKeyChange,
  setStageSevenths,
  stageKey,
  stepStageKey,
  toggleStageMode,
} from './key.js?v=20260831-01';
import { degreeKeyLabel, setKeyChords } from './guitar.js?v=20260831-01';
import { syncPadsOpenClass } from './pads.js?v=20260831-01';

// Wheel gestures compete with the stage's own pointer handling, and a wedge
// press has to know which instrument is listening; main.js supplies both, plus
// the piano note route it owns above this layer.
let hooks = {
  activateAudioForSound: () => {},
  canPlayInstrument: () => false,
  canKeyboardJamPlay: () => false,
  isGuitarPlayFocus: () => false,
  eventInvolvesUiChrome: () => false,
  currentGuitarChordName: () => null,
  beginHeldPianoNote: () => null,
  releaseHeldPianoNote: () => {},
};
export function initChordWheel(next) {
  hooks = { ...hooks, ...next };
}

const wheel = document.getElementById('chord-wheel');
const rings = document.getElementById('chord-wheel-rings');
const keyLabelEl = document.getElementById('chord-key-label');
const seventhsBtn = document.getElementById('chord-sevenths');


// ---- key state ----
// The key is the stage's, not the wheel's — the voice ribbon sings in it too.
// key.js owns the value, the storage and who to tell; this file keeps three
// local reads of it so the paint code below stays about geometry.
const tonic = () => stageKey.tonicPc;
const mode = () => stageKey.mode;
const sevenths = () => stageKey.sevenths;

// Any key change invalidates what is armed: the chord under the hand belongs
// to the old key, and keeping it would leave what is lit, what is armed and
// what would sound disagreeing.
onStageKeyChange(() => {
  clearGuitarInteractionState();
  paintWheel();
});

// ============================================================
// GEOMETRY
// A 200-unit viewBox, so radii read as percentages of the wheel. Wedges are
// contiguous within a ring and separated by a drawn line rather than a gap:
// a gap between two 30° targets is a dead strip the finger keeps finding.
//
// The band widths are what set the touch target, not the arc: a 30° wedge is
// already ~60px wide across at these sizes, while its radial thickness is the
// narrow axis a fingertip actually misses. So the hub is kept to the smallest
// circle its two controls fit in — 36% of the radius — and every point it
// gives back goes into the rings, which split what is left evenly.
// ============================================================
const WEDGE_DEGREES = 30;
const HUB_RADIUS = 36;
const RING_RADII = {
  major: [67.5, 99],
  minor: [HUB_RADIUS, 67.5],
};
const RINGS = ['major', 'minor'];

function polar(radius, degrees) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [radius * Math.cos(radians), radius * Math.sin(radians)];
}

function wedgePath(ring, fifthIndex) {
  const [inner, outer] = RING_RADII[ring];
  const from = fifthIndex * WEDGE_DEGREES - WEDGE_DEGREES / 2;
  const to = from + WEDGE_DEGREES;
  const [ax, ay] = polar(outer, from);
  const [bx, by] = polar(outer, to);
  const [cx, cy] = polar(inner, to);
  const [dx, dy] = polar(inner, from);
  // Every wedge is 30°, so the large-arc flag is always 0.
  return `M${ax} ${ay}A${outer} ${outer} 0 0 1 ${bx} ${by}`
    + `L${cx} ${cy}A${inner} ${inner} 0 0 0 ${dx} ${dy}Z`;
}

const labelRadius = (ring) => (RING_RADII[ring][0] + RING_RADII[ring][1]) / 2;

function wedgeLabelPoint(ring, fifthIndex) {
  return polar(labelRadius(ring), fifthIndex * WEDGE_DEGREES);
}

// ---- how big a label may be ----
// Labels are counter-rotated to stay upright as the wheel turns, so what limits
// them is NOT the wedge's arc — it is the straight-line gap between one label's
// centre and its neighbour's. That gap is a chord, and on the inner ring it is
// only 62% of the outer's, while a seventh's name is exactly as long in both.
//
// A character count cannot express that. The old rule shrank a label at five
// characters, which is why the outer ring looked fine and the inner ring did
// not: with sevenths on, `C#m7` is four characters and never shrank, so at 9px
// it measured 34 units against a 27-unit gap and sat straight on `F#m7`.
//
// So the size comes from the geometry instead. GLYPH_EM is Unbounded 700's
// advance measured off the rendered text (34.4 units for four glyphs at 9px),
// not guessed — this font is much wider than a character count assumes.
const GLYPH_EM = 0.96;
// 0.82, not 0.92: the outer ring's five-character names were the one size that
// already worked at 7px, and a looser fill grew them past it into the ring below.
const LABEL_FILL = 0.82;
const LABEL_MIN = 5;
const LABEL_MAX = 9;
const labelGap = (ring) => 2 * labelRadius(ring) * Math.sin((WEDGE_DEGREES / 2) * (Math.PI / 180));

function labelFontSize(ring, label) {
  const room = labelGap(ring) * LABEL_FILL;
  const wanted = room / (Math.max(1, label.length) * GLYPH_EM);
  return Math.max(LABEL_MIN, Math.min(LABEL_MAX, wanted));
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const wedges = [];
// The key rotation goes on an inner group, not on the <svg> itself: a
// transform attribute on a root <svg> is SVG2 and browsers disagree about it.
const ringsGroup = document.createElementNS(SVG_NS, 'g');
ringsGroup.setAttribute('class', 'wheel-rings');
rings?.append(ringsGroup);

for (const ring of RINGS) {
  for (let fifthIndex = 0; fifthIndex < 12; fifthIndex++) {
    const group = document.createElementNS(SVG_NS, 'g');
    group.classList.add('wedge');
    group.dataset.ring = ring;
    group.dataset.fifth = String(fifthIndex);
    // role + tabindex rather than a real <button>: the shape is the control.
    // The global hotkey router already skips [role="button"] targets, so a
    // focused wedge cannot also fire the Space strum underneath it.
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', '0');
    group.setAttribute('aria-pressed', 'false');

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', wedgePath(ring, fifthIndex));
    const text = document.createElementNS(SVG_NS, 'text');
    const [x, y] = wedgeLabelPoint(ring, fifthIndex);
    text.setAttribute('x', String(x));
    text.setAttribute('y', String(y));

    group.append(path, text);
    ringsGroup.append(group);
    wedges.push({ group, text, ring, fifthIndex, x, y });
  }
}

// ============================================================
// PAINT
// ============================================================
const chordNameFor = (ring, fifthIndex) => wedgeChordName(ring, fifthIndex, tonic(), sevenths(), mode());

// A pressed piano chord is the wheel's own; a guitar chord is held elsewhere
// (pad, latch or keyboard) and read back through the hook.
let pianoChordName = null;
const activeChordName = () => pianoChordName || hooks.currentGuitarChordName();

function paintActive() {
  const active = activeChordName();
  for (const wedge of wedges) {
    const on = wedge.group.dataset.chord === active;
    wedge.group.classList.toggle('held', on);
    wedge.group.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  document.documentElement.classList.toggle('guitar-fretting', Boolean(hooks.currentGuitarChordName()));
}

/** Repaint after a key or seventh change: rotation, labels, lit sector, aria. */
function paintWheel() {
  // The wheel points at the key *signature*, not the tonic: a minor key shares
  // its six chords with the relative major, so both put the same sector at the
  // top and only the home wedge differs — outer in major, inner in minor.
  const homeIndex = fifthIndexOf(keySignaturePc(tonic(), mode()));
  // Labels carry the opposite rotation so the text stays upright as it turns.
  ringsGroup.setAttribute('transform', `rotate(${-homeIndex * WEDGE_DEGREES})`);
  const upright = homeIndex * WEDGE_DEGREES;

  const degrees = keyDegrees(tonic(), { mode: mode(), sevenths: sevenths() });
  const degreeSlot = new Map();
  degrees.forEach((chord, index) => {
    if (chord.ring) degreeSlot.set(`${chord.ring}:${chord.fifthIndex}`, index);
  });
  const tonicKey = degrees[0].ring ? `${degrees[0].ring}:${degrees[0].fifthIndex}` : null;

  for (const wedge of wedges) {
    const { group, text, ring, fifthIndex, x, y } = wedge;
    const name = chordNameFor(ring, fifthIndex);
    const degree = wedgeDegree(ring, fifthIndex, tonic(), mode());
    group.dataset.chord = name;
    group.classList.toggle('in-key', Boolean(degree));
    group.classList.toggle('tonic', `${ring}:${fifthIndex}` === tonicKey);
    group.setAttribute('aria-label', degree ? `Акорд ${name}, ступінь ${degree}` : `Акорд ${name}`);

    const slot = degreeSlot.get(`${ring}:${fifthIndex}`);
    if (slot === undefined) group.removeAttribute('aria-keyshortcuts');
    else group.setAttribute('aria-keyshortcuts', degreeKeyLabel(slot));

    const label = wedgeLabel(ring, fifthIndex, tonic(), sevenths(), mode());
    text.textContent = label;
    // Sized from the gap to the neighbouring label, per ring — see labelFontSize.
    // It has to be an inline STYLE, not a font-size attribute: the stylesheet
    // sets the `font:` shorthand, and any CSS declaration beats an SVG
    // presentation attribute. Setting the attribute changed the number in the
    // DOM and not one glyph on screen.
    text.style.fontSize = `${labelFontSize(ring, label).toFixed(2)}px`;
    text.setAttribute('transform', `rotate(${upright} ${x} ${y})`);
  }

  if (keyLabelEl) keyLabelEl.textContent = keyLabel(tonic(), mode());
  seventhsBtn?.setAttribute('aria-pressed', sevenths() ? 'true' : 'false');
  seventhsBtn?.classList.toggle('is-on', sevenths());
  if (keyLabelEl) {
    keyLabelEl.dataset.mode = mode();
    keyLabelEl.setAttribute('aria-label', mode() === 'minor'
      ? `Тональність ${keyLabel(tonic(), mode())}, мінор — перемкнути на мажор`
      : `Тональність ${keyLabel(tonic(), mode())}, мажор — перемкнути на мінор`);
  }
  // The chord rows follow the wheel: key 1 is always the tonic, in either mode.
  setKeyChords(degrees.map((chord) => chord.name));
  paintActive();
}

/** Called from the keyboard router when a chord is armed or released. */
export const syncChordWheelHeld = paintActive;

/**
 * The keyboard's chord row at the piano goes through the wheel rather than
 * around it: a key press and a wedge press must voice, roll, press the same
 * meshes and capture into the loop identically, or the two ways of playing the
 * same chord would drift apart.
 */
export function pressPianoChordFromKeyboard(name) {
  pressPianoChord(name, null);
}
export function releasePianoChordFromKeyboard() {
  releasePianoChord();
}

// ============================================================
// KEY CONTROLS
// A stepper rather than a draggable ring: dragging the wheel would be the same
// gesture as holding a wedge to play it, and this surface has already learned
// once that a play gesture cannot be given a second meaning.
// ============================================================
// Setting the key is key.js's job now; the repaint and the clearing happen in
// the onStageKeyChange listener above, so these controls only have to say what
// the visitor asked for. The voice ribbon's own stepper calls the same three.
for (const button of wheel?.querySelectorAll('[data-key-step]') || []) {
  button.addEventListener('click', () => stepStageKey(Number(button.dataset.keyStep)));
}
seventhsBtn?.addEventListener('click', () => setStageSevenths(!sevenths()));
// The key readout *is* the mode control: it already spells the answer ("C"
// against "Am"), and the hub has no room for a third pill at the size a
// 320px phone gives it.
keyLabelEl?.addEventListener('click', toggleStageMode);

// One adjacent cluster on the desktop keyboard, claimed by no instrument: the
// brackets walk the circle and the backslash toggles sevenths, so the key is
// steerable without letting go of the jam row. It stays live at the mic too —
// the ribbon sings in the same key, so the same two keys should move it.
window.addEventListener('keydown', (event) => {
  if (event.repeat || !hooks.canKeyboardJamPlay()) return;
  if (event.target?.closest?.('button, a, input, textarea, select, [contenteditable="true"]')) return;
  if (event.code === 'BracketLeft') stepStageKey(-1);
  else if (event.code === 'BracketRight') stepStageKey(1);
  else if (event.code === 'Backslash') setStageSevenths(!sevenths());
  else return;
  event.preventDefault();
});

// Hub controls are ordinary click-driven buttons: keep their pointer off the
// canvas, but do NOT preventDefault, or touch never gets the synthesized click
// and they read as dead.
wheel?.addEventListener('pointerdown', (event) => {
  if (event.target.closest?.('.wedge')) return;
  event.stopPropagation();
  event.stopImmediatePropagation();
}, { capture: true });

// ============================================================
// PIANO: the wedge sounds
// ============================================================
// The key meshes carry a bare frequency, so the only way back from a voicing
// to a mesh is through MIDI.
const keyByMidi = new Map();
for (const key of piano.keys) {
  if (Number.isFinite(key.userData?.freq)) keyByMidi.set(midiFromFreq(key.userData.freq), key);
}

// A hand does not put four notes down at the same instant. The stagger is
// small enough to read as one chord and large enough to stop it sounding like
// a machine — and because each note opens its own loop capture, the roll is
// recorded exactly as it was played.
const PIANO_ROLL_MS = 14;
const pianoChordVoices = new Set();
const pianoChordTimers = new Set();
let pianoChordPointer = null;

function releasePianoChord() {
  for (const timer of pianoChordTimers) clearTimeout(timer);
  pianoChordTimers.clear();
  for (const held of pianoChordVoices) hooks.releaseHeldPianoNote(held);
  pianoChordVoices.clear();
  pianoChordPointer = null;
  if (!pianoChordName) return;
  pianoChordName = null;
  paintActive();
}

function startChordNote(key, vibe) {
  const held = hooks.beginHeldPianoNote(key, { vibe });
  if (held) pianoChordVoices.add(held);
}

function pressPianoChord(name, pointerId) {
  releasePianoChord();
  hooks.activateAudioForSound();
  pianoChordName = name;
  pianoChordPointer = pointerId;
  pianoVoicing(name).forEach((midi, index) => {
    const key = keyByMidi.get(midi);
    if (!key) return;
    // One chord is worth one note's vibe. Letting all four count would make a
    // chord four times the reward of a note for the same single gesture.
    const vibe = index === 0 ? undefined : 0;
    if (index === 0) {
      startChordNote(key, vibe);
      return;
    }
    const timer = setTimeout(() => {
      pianoChordTimers.delete(timer);
      startChordNote(key, vibe);
    }, index * PIANO_ROLL_MS);
    pianoChordTimers.add(timer);
  });
  navigator.vibrate?.(10);
  paintActive();
}

// ============================================================
// GUITAR: the wedge arms
// ============================================================
function holdGuitarChord(name, pointerId) {
  if (!GUITAR_CHORDS[name]) return;
  play.heldGuitarChord = name;
  play.heldGuitarChordPointer = pointerId;
  paintActive();
  navigator.vibrate?.(10);
}

function releaseHeldGuitarChord(event) {
  if (event && play.heldGuitarChordPointer !== null && event.pointerId !== play.heldGuitarChordPointer) return;
  play.heldGuitarChord = null;
  play.heldGuitarChordPointer = null;
  paintActive();
}

function toggleLatchedGuitarChord(name) {
  if (!GUITAR_CHORDS[name]) return;
  play.latchedGuitarChord = play.latchedGuitarChord === name ? null : name;
  play.heldGuitarChord = null;
  play.heldGuitarChordPointer = null;
  paintActive();
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

export function clearGuitarInteractionState() {
  for (const [pointerId, info] of activePointers) {
    if (!info.mode?.startsWith('guitar-')) continue;
    activePointers.delete(pointerId);
    try {
      if (canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture(pointerId);
    } catch (_) { /* ignore */ }
  }
  for (const pointerId of activeTouchChordPointers.keys()) {
    try {
      if (rings?.hasPointerCapture?.(pointerId)) rings.releasePointerCapture(pointerId);
    } catch (_) { /* ignore */ }
  }
  activeTouchChordPointers.clear();
  releasePianoChord();
  play.heldGuitarChord = null;
  play.heldGuitarChordPointer = null;
  play.latchedGuitarChord = null;
  play.keyboardGuitarChord = null;
  play.guitarStrokeMotion = 0;
  paintActive();
}

// ============================================================
// POINTER ROUTING
// One delegated listener rather than 24 sets: the wedges are generated, and a
// listener per wedge would be 24 more places for the touch bookkeeping below
// to drift out of step.
// ============================================================
const wedgeAt = (target) => target?.closest?.('.wedge') || null;
const isPianoChordFocus = () => hooks.canPlayInstrument('piano');

// Capture is the last thing a press does, and it is allowed to fail: the chord
// is already armed by then, so a pointer the browser no longer considers
// active must not take the hold down with it.
function captureWedgePointer(pointerId) {
  try {
    rings?.setPointerCapture?.(pointerId);
  } catch (_) { /* the press stands without it */ }
}

rings?.addEventListener('pointerdown', (event) => {
  const wedge = wedgeAt(event.target);
  if (!wedge) return;
  event.stopPropagation();
  event.stopImmediatePropagation();
  const name = wedge.dataset.chord;

  if (isPianoChordFocus()) {
    // Every pointer type sounds on press here: on the piano the wedge is the
    // instrument, so waiting for a click would put the chord behind the tap.
    event.preventDefault();
    pressPianoChord(name, event.pointerId);
    captureWedgePointer(event.pointerId);
    return;
  }

  if (event.pointerType !== 'touch') return;
  event.preventDefault();
  recentTouchChordAt.set(wedge, performance.now());
  activeTouchChordPointers.set(event.pointerId, {
    name,
    startedAt: performance.now(),
    startX: event.clientX,
    startY: event.clientY,
    distancePx: 0,
    usedForPlay: false,
  });
  holdGuitarChord(name, event.pointerId);
  captureWedgePointer(event.pointerId);
});

rings?.addEventListener('pointermove', (event) => {
  const interaction = activeTouchChordPointers.get(event.pointerId);
  if (!interaction) return;
  interaction.distancePx = Math.max(
    interaction.distancePx,
    Math.hypot(event.clientX - interaction.startX, event.clientY - interaction.startY),
  );
});

function endWedgePointer(event, options) {
  if (pianoChordPointer === event.pointerId) {
    releasePianoChord();
    return;
  }
  finishTouchGuitarChord(event, options);
}
rings?.addEventListener('pointerup', (event) => endWedgePointer(event));
rings?.addEventListener('pointercancel', (event) => endWedgePointer(event, { cancelled: true }));
rings?.addEventListener('lostpointercapture', (event) => endWedgePointer(event, { cancelled: true }));

rings?.addEventListener('click', (event) => {
  const wedge = wedgeAt(event.target);
  if (!wedge || isPianoChordFocus()) return;
  // Ignore the click a touch synthesizes after its own hold has been resolved.
  if (event.detail !== 0 && performance.now() - (recentTouchChordAt.get(wedge) || 0) < 700) return;
  toggleLatchedGuitarChord(wedge.dataset.chord);
});

// A wedge is a role="button", so Enter / Space have to be wired by hand. On
// guitar that latches; on piano it is momentary, held for as long as the key.
let keyboardWedge = null;
rings?.addEventListener('keydown', (event) => {
  const wedge = wedgeAt(event.target);
  if (!wedge || (event.key !== 'Enter' && event.key !== ' ')) return;
  event.preventDefault();
  if (event.repeat) return;
  if (!isPianoChordFocus()) {
    toggleLatchedGuitarChord(wedge.dataset.chord);
    return;
  }
  keyboardWedge = wedge;
  pressPianoChord(wedge.dataset.chord, null);
});
rings?.addEventListener('keyup', (event) => {
  if (!keyboardWedge || (event.key !== 'Enter' && event.key !== ' ')) return;
  keyboardWedge = null;
  releasePianoChord();
});

// ============================================================
// SHOW / HIDE
// ============================================================
export function showChordWheel() {
  if (!wheel) return;
  paintActive();
  wheel.hidden = false;
  syncPadsOpenClass();
}

export function hideChordWheel() {
  if (!wheel) return;
  clearGuitarInteractionState();
  wheel.hidden = true;
  syncPadsOpenClass();
}

// ============================================================
// BROWSER ZOOM GUARDS
// Moved here with the chord code they protect. Hold chord + second-finger
// strum must not become a Safari/Chrome page pinch — but never preventDefault
// a pad↔canvas multitouch touchstart, which drops the strum finger. Piano
// focus is deliberately excluded: two-finger zoom stays available there.
// ============================================================
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

// Headless QA reads the wheel as data rather than driving synthetic pointers —
// same role as __pianoDebug / __audioDebug.
window.__chordWheelDebug = () => ({
  tonic: tonic(),
  tonicLabel: keyLabel(tonic(), mode()),
  mode: mode(),
  sevenths: sevenths(),
  open: Boolean(wheel && !wheel.hidden),
  held: play.heldGuitarChord,
  latched: play.latchedGuitarChord,
  keyboard: play.keyboardGuitarChord,
  active: activeChordName(),
  pianoChord: pianoChordName,
  pianoVoicing: pianoChordName ? pianoVoicing(pianoChordName) : null,
  degrees: keyDegrees(tonic(), { mode: mode(), sevenths: sevenths() }).map((chord) => `${chord.degree}:${chord.name}`),
  wedges: wedges.map(({ group, ring, fifthIndex }) => ({
    ring,
    fifthIndex,
    chord: group.dataset.chord,
    label: group.querySelector('text')?.textContent,
    inKey: group.classList.contains('in-key'),
    tonic: group.classList.contains('tonic'),
  })),
});

paintWheel();
