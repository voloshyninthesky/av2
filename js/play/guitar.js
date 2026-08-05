// ============================================================
// GUITAR PLAY
// Chord shapes as fret offsets over the six open strings, so a chord is just a
// transposition of the same pitch table. A strum is fired as one loop event
// with per-string offsets, which keeps the recorded version identical to the
// live one, and fret hit-testing maps a touch on the neck back to a string.
// ============================================================
import * as THREE from 'three';
import { ui, audio, guitar } from '../core/studio.js?v=20260804-10';
import { play } from './state.js?v=20260804-10';
import { playMusicalEvent } from './loop.js?v=20260804-10';

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
export const GUITAR_CHORDS = {
  Em: [0, 2, 2, 0, 0, 0],
  Am: [null, 0, 2, 2, 1, 0],
  C: [null, 3, 2, 0, 1, 0],
  D: [null, null, 0, 2, 3, 2],
  G: [3, 2, 0, 0, 0, 3],
  F: [1, 3, 3, 2, 1, 1],
};
const GUITAR_OPEN_SHAPE = [0, 0, 0, 0, 0, 0];
// Disjoint from approach (E), loop (L), drums, piano, and vocal controls.
export const GUITAR_KEY_CHORDS = {
  KeyQ: 'Em',
  KeyR: 'Am',
  KeyT: 'C',
  KeyY: 'D',
  KeyU: 'G',
  KeyI: 'F',
};

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
  for (const shape of [GUITAR_OPEN_SHAPE, ...Object.values(GUITAR_CHORDS)]) {
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

