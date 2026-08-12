// ============================================================
// HARMONY
// The music theory the stage plays by, as plain data: the chord library, the
// circle of fifths, and what belongs to a key. Chords are generated, not
// listed — any root × any supported quality — because that is what a movable
// barre shape already is, one fingering slid up the neck.
//
// This file imports nothing, on purpose. A wrong voicing is silent-but-wrong:
// it sounds like a chord, just not the one on the label, and nothing in the
// running app would surface that. Zero imports is what lets the Node tests
// load it for real and check every chord against its intervals.
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

// ---- the chord maker ----
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

/** Split a generated name back into its root pitch class and quality suffix. */
export function parseChordName(name) {
  // Sharp roots are two characters ("C#"), naturals one.
  const rootPc = CHORD_ROOTS.includes(name.slice(0, 2))
    ? CHORD_ROOTS.indexOf(name.slice(0, 2))
    : CHORD_ROOTS.indexOf(name[0]);
  if (rootPc === -1) return null;
  const quality = name.slice(CHORD_ROOTS[rootPc].length);
  if (CHORD_QUALITIES[quality] === undefined) return null;
  return { rootPc, quality };
}

// ============================================================
// THE CIRCLE OF FIFTHS
// Twelve positions, each a fifth above the last, with the relative minor a
// ring inside it. That geometry is the point: the chords of a key are not
// scattered around the wheel, they are three neighbouring positions and the
// three minors under them — one contiguous block you can see before you can
// name it.
//
// Display spellings are flats where the circle conventionally writes flats
// (Gb, not F#), while identity stays sharp-spelled so GUITAR_CHORDS lookups
// are unchanged. Label and name are separate fields for exactly that reason.
// ============================================================
const FIFTHS_PITCH_CLASSES = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
const MAJOR_LABELS = ['C', 'G', 'D', 'A', 'E', 'B', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
const MINOR_LABELS = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];

/** The minor a third below shares a key signature — the inner ring. */
export const relativeMinorPc = (pc) => (pc + 9) % 12;

export const FIFTHS = FIFTHS_PITCH_CLASSES.map((pc, index) => ({
  index,
  pc,
  minorPc: relativeMinorPc(pc),
  majorLabel: MAJOR_LABELS[index],
  minorLabel: MINOR_LABELS[index],
}));

export const fifthIndexOf = (pc) => FIFTHS_PITCH_CLASSES.indexOf(pc);

/** Root pitch class of a wedge. `ring` is 'major' (outer) or 'minor' (inner). */
export function wedgeRootPc(ring, fifthIndex) {
  const entry = FIFTHS[fifthIndex];
  return ring === 'minor' ? entry.minorPc : entry.pc;
}

// How far a wedge sits from the tonic, in fifths, signed and wrapped to
// -6..+5 so "one step counter-clockwise" is -1 rather than 11.
function fifthsFromTonic(fifthIndex, tonicPc) {
  const offset = fifthIndex - fifthIndexOf(tonicPc);
  return ((offset + 18) % 12) - 6;
}

// The six chords of a major key, by where they sit relative to its tonic.
// IV I V across the outer ring, ii vi iii directly inside them.
const DEGREE_BY_OFFSET = {
  major: { '-1': 'IV', 0: 'I', 1: 'V' },
  minor: { '-1': 'ii', 0: 'vi', 1: 'iii' },
};
/** Degree name if this wedge belongs to the key, else null. */
export function wedgeDegree(ring, fifthIndex, tonicPc) {
  return DEGREE_BY_OFFSET[ring][fifthsFromTonic(fifthIndex, tonicPc)] ?? null;
}

// Sevenths are diatonic, not one blanket quality: the tonic and subdominant
// take a major 7th, the dominant takes a flat 7th (that tension is what makes
// it a dominant), and the minors take a minor 7th. A wedge outside the key has
// no degree to follow, so a major there becomes a plain dominant 7 — which is
// what a borrowed major chord is used for.
const SEVENTH_BY_DEGREE = { I: 'maj7', IV: 'maj7', V: '7', ii: 'm7', iii: 'm7', vi: 'm7' };
export function qualityFor(ring, fifthIndex, tonicPc, sevenths = false) {
  if (!sevenths) return ring === 'minor' ? 'm' : '';
  const degree = wedgeDegree(ring, fifthIndex, tonicPc);
  if (degree) return SEVENTH_BY_DEGREE[degree];
  return ring === 'minor' ? 'm7' : '7';
}

/** Library name for a wedge, e.g. 'A#m7'. */
export function wedgeChordName(ring, fifthIndex, tonicPc, sevenths = false) {
  const quality = qualityFor(ring, fifthIndex, tonicPc, sevenths);
  return CHORD_ROOTS[wedgeRootPc(ring, fifthIndex)] + quality;
}

/** What the wedge reads on screen — flat-spelled, and 'Am7' not 'Am' + 'm7'. */
export function wedgeLabel(ring, fifthIndex, tonicPc, sevenths = false) {
  const quality = qualityFor(ring, fifthIndex, tonicPc, sevenths);
  const entry = FIFTHS[fifthIndex];
  // The minor label already carries its 'm'; the quality's leading 'm' would
  // double it ("Amm7").
  return ring === 'minor'
    ? entry.minorLabel + quality.slice(1)
    : entry.majorLabel + quality;
}

// Scale-degree order rather than wheel order: this is the row a visitor plays
// a progression from, and I–ii–iii–IV–V–vi is how those chords are counted.
const DEGREE_ORDER = [
  { degree: 'I', ring: 'major', offset: 0 },
  { degree: 'ii', ring: 'minor', offset: -1 },
  { degree: 'iii', ring: 'minor', offset: 1 },
  { degree: 'IV', ring: 'major', offset: -1 },
  { degree: 'V', ring: 'major', offset: 1 },
  { degree: 'vi', ring: 'minor', offset: 0 },
];

/** The key's six chords, in degree order. */
export function keyDegrees(tonicPc, sevenths = false) {
  const tonicIndex = fifthIndexOf(tonicPc);
  return DEGREE_ORDER.map(({ degree, ring, offset }) => {
    const fifthIndex = (tonicIndex + offset + 12) % 12;
    return {
      degree,
      ring,
      fifthIndex,
      name: wedgeChordName(ring, fifthIndex, tonicPc, sevenths),
      label: wedgeLabel(ring, fifthIndex, tonicPc, sevenths),
    };
  });
}

/** The key's own name, for the hub readout. */
export const keyLabel = (tonicPc) => MAJOR_LABELS[fifthIndexOf(tonicPc)];

/** Step the key by a fifth. +1 clockwise (C -> G), -1 counter-clockwise. */
export function stepKey(tonicPc, direction) {
  const next = (fifthIndexOf(tonicPc) + direction + 12) % 12;
  return FIFTHS_PITCH_CLASSES[next];
}

// ============================================================
// PIANO VOICING
// The keybed is two octaves, C4..C6 — MIDI 60..84, exactly 25 semitones for
// exactly 25 keys, so "inside the range" and "a key exists for it" are the
// same statement. Putting the root in the lowest octave and stacking the
// chord above it always lands inside that span: the highest possible note is
// a major 7th over B4, which is 83.
// ============================================================
export const PIANO_LOW_MIDI = 60;
export const PIANO_HIGH_MIDI = 84;

export const midiFromFreq = (freq) => Math.round(69 + 12 * Math.log2(freq / 440));
export const freqFromMidi = (midi) => 440 * (2 ** ((midi - 69) / 12));

/**
 * MIDI notes for a chord, voiced to fit the keybed. Triads double their root
 * an octave up so a chord is always four keys under the hand; sevenths are
 * already four notes and are left alone, since adding the octave would put a
 * doubled root a semitone above the major 7th.
 */
export function pianoVoicing(name) {
  const parsed = parseChordName(name);
  if (!parsed) return [];
  const { intervals } = CHORD_QUALITIES[parsed.quality];
  const base = PIANO_LOW_MIDI + parsed.rootPc;
  const notes = intervals.map((semitones) => base + semitones);
  if (intervals.length < 4) notes.push(base + 12);
  return notes;
}
