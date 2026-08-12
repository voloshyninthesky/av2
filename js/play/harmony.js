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
  // The seventh degree of a major key is diminished, and so is the second of a
  // minor one. Neither is a major or a relative minor, so neither has a wedge
  // on the wheel — but a keyboard row that counts scale degrees has to be able
  // to reach them, which is the whole reason these two exist.
  dim:    { label: 'diminished', intervals: [0, 3, 6] },
  m7b5:   { label: 'half-diminished', intervals: [0, 3, 6, 10] },
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
  // Both diminished forms drop the top strings rather than mute an inner one:
  // a stacked minor third has no comfortable octave up there, and muting an
  // outer string is the only kind a hand does without thinking.
  dim:  [0, 1, 2, 0, null, null],
  m7b5: [0, 1, 0, 0, null, null],
};
const A_SHAPES = {
  '':   [null, 0, 2, 2, 2, 0],
  m:    [null, 0, 2, 2, 1, 0],
  7:    [null, 0, 2, 0, 2, 0],
  m7:   [null, 0, 2, 0, 1, 0],
  maj7: [null, 0, 2, 1, 2, 0],
  dim:  [null, 0, 1, 2, 1, null],
  m7b5: [null, 0, 1, 0, 1, null],
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

export const MODES = ['major', 'minor'];

// A major key and its relative minor are the same seven notes, so they light
// the same six wedges AND take the same sevenths. Mode changes only which
// wedge is home, what the degrees are called, and where the row starts
// counting — which is why nothing below needs a second set of chords.
//
// `ring` + `offset` locate a degree on the wheel relative to the key
// signature's position. `semitones` is for the one degree in each mode that is
// diminished: it is neither a major nor a relative minor, so it has no wedge,
// and only a keyboard row that counts scale degrees can reach it.
const MODE_DEGREES = {
  major: [
    { degree: 'I', ring: 'major', offset: 0 },
    { degree: 'ii', ring: 'minor', offset: -1 },
    { degree: 'iii', ring: 'minor', offset: 1 },
    { degree: 'IV', ring: 'major', offset: -1 },
    { degree: 'V', ring: 'major', offset: 1 },
    { degree: 'vi', ring: 'minor', offset: 0 },
    { degree: 'vii°', ring: null, semitones: 11 },
  ],
  minor: [
    { degree: 'i', ring: 'minor', offset: 0 },
    { degree: 'ii°', ring: null, semitones: 2 },
    { degree: 'III', ring: 'major', offset: 0 },
    { degree: 'iv', ring: 'minor', offset: -1 },
    { degree: 'v', ring: 'minor', offset: 1 },
    { degree: 'VI', ring: 'major', offset: -1 },
    { degree: 'VII', ring: 'major', offset: 1 },
  ],
};

/** The major key whose signature this one shares — where the wheel points. */
export const keySignaturePc = (tonicPc, mode = 'major') => (
  mode === 'minor' ? (tonicPc + 3) % 12 : tonicPc
);

// How far a wedge sits from home, in fifths, signed and wrapped to -6..+5 so
// "one step counter-clockwise" is -1 rather than 11.
function fifthsFromHome(fifthIndex, tonicPc, mode) {
  const offset = fifthIndex - fifthIndexOf(keySignaturePc(tonicPc, mode));
  return ((offset + 18) % 12) - 6;
}

/** Degree name if this wedge belongs to the key, else null. */
export function wedgeDegree(ring, fifthIndex, tonicPc, mode = 'major') {
  const offset = fifthsFromHome(fifthIndex, tonicPc, mode);
  return MODE_DEGREES[mode].find((d) => d.ring === ring && d.offset === offset)?.degree ?? null;
}

// Sevenths are diatonic, not one blanket quality: the tonic and subdominant
// take a major 7th, the dominant takes a flat 7th (that tension is what makes
// it a dominant), the minors take a minor 7th, and the diminished degree takes
// a half-diminished. A wedge outside the key has no degree to follow, so a
// major there becomes a plain dominant 7 — what a borrowed chord is used for.
const SEVENTH_BY_DEGREE = {
  I: 'maj7', ii: 'm7', iii: 'm7', IV: 'maj7', V: '7', vi: 'm7', 'vii°': 'm7b5',
  i: 'm7', 'ii°': 'm7b5', III: 'maj7', iv: 'm7', v: 'm7', VI: 'maj7', VII: '7',
};
export function qualityFor(ring, fifthIndex, tonicPc, sevenths = false, mode = 'major') {
  if (!sevenths) return ring === 'minor' ? 'm' : '';
  const degree = wedgeDegree(ring, fifthIndex, tonicPc, mode);
  if (degree) return SEVENTH_BY_DEGREE[degree];
  return ring === 'minor' ? 'm7' : '7';
}

/** Library name for a wedge, e.g. 'A#m7'. */
export function wedgeChordName(ring, fifthIndex, tonicPc, sevenths = false, mode = 'major') {
  const quality = qualityFor(ring, fifthIndex, tonicPc, sevenths, mode);
  return CHORD_ROOTS[wedgeRootPc(ring, fifthIndex)] + quality;
}

/** What the wedge reads on screen — flat-spelled, and 'Am7' not 'Am' + 'm7'. */
export function wedgeLabel(ring, fifthIndex, tonicPc, sevenths = false, mode = 'major') {
  const quality = qualityFor(ring, fifthIndex, tonicPc, sevenths, mode);
  const entry = FIFTHS[fifthIndex];
  // The minor label already carries its 'm'; the quality's leading 'm' would
  // double it ("Amm7").
  return ring === 'minor'
    ? entry.minorLabel + quality.slice(1)
    : entry.majorLabel + quality;
}

/**
 * The key's seven chords, in scale-degree order — the order the number row
 * counts in, so `1` is always the tonic in either mode. Six of them carry a
 * `fifthIndex` and light a wedge; the diminished one carries `ring: null`.
 */
export function keyDegrees(tonicPc, { mode = 'major', sevenths = false } = {}) {
  const homeIndex = fifthIndexOf(keySignaturePc(tonicPc, mode));
  return MODE_DEGREES[mode].map((entry) => {
    if (!entry.ring) {
      const rootPc = (tonicPc + entry.semitones) % 12;
      const quality = sevenths ? 'm7b5' : 'dim';
      const name = CHORD_ROOTS[rootPc] + quality;
      return { degree: entry.degree, ring: null, fifthIndex: null, rootPc, name, label: name };
    }
    const fifthIndex = (homeIndex + entry.offset + 12) % 12;
    return {
      degree: entry.degree,
      ring: entry.ring,
      fifthIndex,
      rootPc: wedgeRootPc(entry.ring, fifthIndex),
      name: wedgeChordName(entry.ring, fifthIndex, tonicPc, sevenths, mode),
      label: wedgeLabel(entry.ring, fifthIndex, tonicPc, sevenths, mode),
    };
  });
}

/** The key's own name, for the hub readout: 'C' major, 'Am' minor. */
export const keyLabel = (tonicPc, mode = 'major') => (
  mode === 'minor'
    ? MINOR_LABELS[fifthIndexOf(keySignaturePc(tonicPc, mode))]
    : MAJOR_LABELS[fifthIndexOf(tonicPc)]
);

/** Step the key by a fifth. +1 clockwise (C -> G), -1 counter-clockwise. */
export const stepKey = (tonicPc, direction) => (tonicPc + direction * 7 + 84) % 12;

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
