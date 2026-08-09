// ============================================================
// GUITAR PLAY
// Chord shapes as fret offsets over the six open strings, so a chord is just a
// transposition of the same pitch table. A strum is fired as one loop event
// with per-string offsets, which keeps the recorded version identical to the
// live one, and fret hit-testing maps a touch on the neck back to a string.
// ============================================================
import * as THREE from 'three';
import { ui, audio, guitar } from '../core/studio.js?v=20260809-09';
import { play } from './state.js?v=20260809-09';
import { playMusicalEvent } from './loop.js?v=20260809-09';

// Whether a strum should sound at all depends on the current focus view, which
// main.js owns; the touch-chord bookkeeping lives with the chord pad.
let hooks = {
  isGuitarPlayFocus: () => false,
  markHeldTouchGuitarChordUsed: () => {},
};
export function initGuitarPlay(next) {
  hooks = { ...hooks, ...next };
}

const GUITAR_OPEN_FREQS = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63];
const GUITAR_OPEN_SHAPE = [0, 0, 0, 0, 0, 0];

// ============================================================
// CHORD MAKER
// Chords are generated, not listed: any root × any supported quality. That is
// what a movable barre shape *is* on a guitar — one fingering slid up the neck —
// so the same trick covers all 12 roots from two shape families instead of an
// unmaintainable table of 60 hand-written voicings.
// ============================================================
export const CHORD_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** Semitones above the root, per quality. The theory these voicings must match. */
export const CHORD_QUALITIES = {
  '':     { label: 'major', intervals: [0, 4, 7] },
  m:      { label: 'minor', intervals: [0, 3, 7] },
  7:      { label: 'dominant 7', intervals: [0, 4, 7, 10] },
  m7:     { label: 'minor 7', intervals: [0, 3, 7, 10] },
  maj7:   { label: 'major 7', intervals: [0, 4, 7, 11] },
};
// Open-position forms whose root sits on string 0 (E, pitch class 4) and
// string 1 (A, pitch class 9). Sliding one up N frets transposes it N
// semitones, which is the whole mechanism.
const E_SHAPES = {
  '':   [0, 2, 2, 1, 0, 0],
  m:    [0, 2, 2, 0, 0, 0],
  7:    [0, 2, 0, 1, 0, 0],
  m7:   [0, 2, 0, 0, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0],
};
const A_SHAPES = {
  '':   [null, 0, 2, 2, 2, 0],
  m:    [null, 0, 2, 2, 1, 0],
  7:    [null, 0, 2, 0, 2, 0],
  m7:   [null, 0, 2, 0, 1, 0],
  maj7: [null, 0, 2, 1, 2, 0],
};
const shiftShape = (shape, frets) => shape.map((f) => (f === null ? null : f + frets));

// Better-sounding open voicings for the chords a beginner actually reaches
// for. These win over the generated barre form purely on tone — the generated
// one is correct too, just thinner and higher up the neck.
const OPEN_VOICINGS = {
  E: [0, 2, 2, 1, 0, 0],
  Em: [0, 2, 2, 0, 0, 0],
  Em7: [0, 2, 0, 0, 0, 0],
  A: [null, 0, 2, 2, 2, 0],
  Am: [null, 0, 2, 2, 1, 0],
  Am7: [null, 0, 2, 0, 1, 0],
  C: [null, 3, 2, 0, 1, 0],
  Cmaj7: [null, 3, 2, 0, 0, 0],
  D: [null, null, 0, 2, 3, 2],
  Dm: [null, null, 0, 2, 3, 1],
  D7: [null, null, 0, 2, 1, 2],
  G: [3, 2, 0, 0, 0, 3],
  G7: [3, 2, 0, 0, 0, 1],
  F: [1, 3, 3, 2, 1, 1],
  B7: [null, 2, 1, 2, 0, 2],
};

/** Playable fret shape for a root + quality, lowest position that fits. */
function makeChordShape(rootIndex, quality) {
  const eFrets = (rootIndex - 4 + 12) % 12; // open E is pitch class 4
  const aFrets = (rootIndex - 9 + 12) % 12; // open A is pitch class 9
  const fromE = shiftShape(E_SHAPES[quality], eFrets);
  const fromA = shiftShape(A_SHAPES[quality], aFrets);
  // Lowest top fret wins: barre chords get unplayable and thin high up, and
  // the guitar mesh only draws so many frets.
  const top = (shape) => Math.max(...shape.filter((f) => f !== null));
  return top(fromE) <= top(fromA) ? fromE : fromA;
}

/** Every chord this build can play, `name -> six fret offsets`. */
export const GUITAR_CHORDS = {};
export const CHORD_NAMES = [];
for (const suffix of Object.keys(CHORD_QUALITIES)) {
  CHORD_ROOTS.forEach((root, rootIndex) => {
    const name = root + suffix;
    GUITAR_CHORDS[name] = OPEN_VOICINGS[name] || makeChordShape(rootIndex, suffix);
    CHORD_NAMES.push(name);
  });
}

// ---- the six pad slots ----
// Which chords currently sit on the pad, in slot order. The QWERTY jam row and
// both pads re-derive from this array via syncGuitarKeymaps().
const PAD_CHORDS_KEY = 'av2.guitar-chords.v2';
const DEFAULT_PAD_CHORDS = ['Em', 'Am', 'C', 'D', 'G', 'F'];
export const padChords = [...DEFAULT_PAD_CHORDS];
try {
  const saved = JSON.parse(localStorage.getItem(PAD_CHORDS_KEY) || 'null');
  if (Array.isArray(saved)) {
    // Per-slot fallback, mascot-style: an unknown name (library changed, bad
    // write) restores that slot's default rather than discarding the rest.
    saved.slice(0, 6).forEach((name, slot) => {
      if (GUITAR_CHORDS[name]) padChords[slot] = name;
    });
  }
} catch { /* storage is optional */ }

// The literal QWERTY top row — six keys, six slots, no gaps to memorize.
// Disjoint from approach (Enter), loop (L), drums, piano, and vocal controls.
// This is the map in both modes: chord *names* can no longer supply a stable
// mnemonic now that the library generates them (C, Cm, C7, Cm7 and Cmaj7 all
// start with C), so position on the pad is the only unambiguous handle.
// Values follow the pad slots; syncGuitarKeymaps() rewrites them in place so
// every importer sees the current assignment through the same object.
export const GUITAR_KEY_CHORDS = {};
const QWERTY_ROW = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY'];

export function syncGuitarKeymaps() {
  QWERTY_ROW.forEach((code, slot) => { GUITAR_KEY_CHORDS[code] = padChords[slot]; });
}
syncGuitarKeymaps();

/** The QWERTY letter a pad slot answers to, for labels and aria-keyshortcuts. */
export const slotKeyLabel = (slot) => QWERTY_ROW[slot]?.slice(3) || '';

/** Swap one pad slot to another chord; keymaps and storage follow. */
export function setPadChord(slot, name) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 5 || !GUITAR_CHORDS[name]) return false;
  padChords[slot] = name;
  syncGuitarKeymaps();
  try { localStorage.setItem(PAD_CHORDS_KEY, JSON.stringify(padChords)); } catch { /* optional */ }
  return true;
}

export function currentGuitarChordName() {
  return play.keyboardGuitarChord || play.heldGuitarChord || play.latchedGuitarChord || null;
}

export function currentGuitarShape() {
  return GUITAR_CHORDS[currentGuitarChordName()] || GUITAR_OPEN_SHAPE;
}

function guitarPitchForString(stringIndex, fret = currentGuitarShape()[stringIndex]) {
  if (fret === null || fret === undefined) return null;
  return GUITAR_OPEN_FREQS[stringIndex] * (2 ** (fret / 12));
}

export function allGuitarPitches() {
  const seen = new Set();
  const pitches = [];
  // Prewarm only what the pad can actually sound right now — the six active
  // slots plus open strings — not the whole library; a swapped-in chord is
  // warmed by the next strum's prewarm call.
  for (const shape of [GUITAR_OPEN_SHAPE, ...padChords.map((name) => GUITAR_CHORDS[name])]) {
    shape.forEach((fret, stringIndex) => {
      const freqHz = guitarPitchForString(stringIndex, fret);
      if (!freqHz) return;
      const key = `${stringIndex}:${Math.round(freqHz * 10)}`;
      if (seen.has(key)) return;
      seen.add(key);
      pitches.push({ stringIndex, freqHz });
    });
  }
  return pitches;
}

function createGuitarStringEvent(stringIndex, fret, offsetMs = 0) {
  const freqHz = guitarPitchForString(stringIndex, fret);
  if (!freqHz) return null;
  return { stringIndex, fret, freqHz, offsetMs: Math.max(0, offsetMs) };
}

export function fireGuitarStrum(
  vel = 0.72,
  direction = 'bass-to-treble',
  stringIndices = null,
  offsetByString = null,
  feedback = true,
  { focusRequired = true } = {},
) {
  if (focusRequired && !hooks.isGuitarPlayFocus()) return false;
  const shape = currentGuitarShape();
  const order = stringIndices || (
    direction === 'treble-to-bass'
      ? [5, 4, 3, 2, 1, 0]
      : [0, 1, 2, 3, 4, 5]
  );
  const spread = 8 + (1 - THREE.MathUtils.clamp(vel, 0, 1)) * 24;
  const strings = order.map((stringIndex, orderIndex) => createGuitarStringEvent(
    stringIndex,
    shape[stringIndex],
    offsetByString?.get(stringIndex) ?? orderIndex * spread,
  )).filter(Boolean);
  if (!strings.length) return false;
  hooks.markHeldTouchGuitarChordUsed();
  playMusicalEvent({
    type: 'guitar-strum',
    direction,
    strings,
    vel: THREE.MathUtils.clamp(vel, 0.16, 1),
    vibe: 5,
  }, { feedback });
  play.guitarStrokeDirection = direction === 'treble-to-bass' ? -1 : 1;
  play.guitarStrokeMotion = Math.max(play.guitarStrokeMotion, vel);
  return true;
}

export function pluckGuitarString(stringIndex, fret, vel = 0.7, feedback = true) {
  if (!hooks.isGuitarPlayFocus()) return false;
  const stringEvent = createGuitarStringEvent(stringIndex, fret, 0);
  if (!stringEvent) return false;
  hooks.markHeldTouchGuitarChordUsed();
  playMusicalEvent({
    type: 'guitar-pluck',
    ...stringEvent,
    freq: stringEvent.freqHz,
    vel: THREE.MathUtils.clamp(vel, 0.16, 1),
    vibe: 3,
  }, { feedback });
  return true;
}

export function playTokenForMesh(mesh) {
  if (!mesh) return null;
  const u = mesh.userData;
  if (u.freq !== undefined) return `piano:${u.freq}`;
  if (u.part) return `drum:${u.part}`;
  return `id:${mesh.id}`;
}

export function guitarLocalPoint(hit) {
  return hit.object.worldToLocal(hit.point.clone());
}

export function nearestGuitarString(stringXs, localX) {
  let closest = 0;
  let distance = Infinity;
  for (let index = 0; index < stringXs.length; index++) {
    const nextDistance = Math.abs(stringXs[index] - localX);
    if (nextDistance < distance) {
      closest = index;
      distance = nextDistance;
    }
  }
  return closest;
}

export function guitarFretHit(hit) {
  const local = guitarLocalPoint(hit);
  const data = hit.object.userData;
  const bodyY = data.centerY + local.y;
  let fret = 1;
  for (let candidate = 1; candidate <= data.fretCount; candidate++) {
    const upper = data.fretYs[candidate - 1];
    const lower = data.fretYs[candidate];
    if (bodyY <= upper && bodyY >= lower) {
      fret = candidate;
      break;
    }
  }
  const neckHalfWidth = 0.045;
  const normalized = THREE.MathUtils.clamp((local.x + neckHalfWidth) / (neckHalfWidth * 2), 0, 1);
  const stringIndex = Math.round(normalized * 5);
  // A selected chord owns the fretting: touching any point on its string keeps
  // the chord voicing rather than falling back to the visual fret position.
  const chordFret = currentGuitarChordName() ? currentGuitarShape()[stringIndex] : fret;
  return {
    stringIndex,
    fret: chordFret,
    freqHz: chordFret === null ? null : data.openFreqs[stringIndex] * (2 ** (chordFret / 12)),
    token: `${stringIndex}:${chordFret}`,
  };
}

