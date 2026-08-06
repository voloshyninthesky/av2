// The chord library is generated from movable barre shapes rather than listed,
// so a wrong shape is silent-but-wrong: it sounds like a chord, just not the
// one on the label. Nothing in the running app would surface that, which is
// exactly why it is pinned here.
//
// `js/play/guitar.js` imports three.js and the studio singleton, neither of
// which loads under plain node, so the chord-maker slice is extracted from the
// source and evaluated on its own — the same trick `audio-lifecycle.test.mjs`
// uses to assert on code it cannot import.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SOURCE = new URL('../js/play/guitar.js', import.meta.url);
const src = readFileSync(SOURCE, 'utf8');

function loadChordMaker() {
  const start = src.indexOf('export const CHORD_ROOTS');
  const end = src.indexOf('// ---- the six pad slots ----');
  assert.ok(start !== -1 && end > start,
    'chord-maker slice not found — did the CHORD_ROOTS / pad-slots markers move?');
  const body = src.slice(start, end).replaceAll('export const ', 'const ')
    + '\nreturn { CHORD_ROOTS, CHORD_QUALITIES, GUITAR_CHORDS, CHORD_NAMES };';
  return new Function(body)();
}

// Open strings, low to high: E A D G B E, as pitch classes (0 = C).
const OPEN_PITCH_CLASSES = [4, 9, 2, 7, 11, 4];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Split a generated name back into its root index and quality suffix. */
function parseChordName(name, roots) {
  // Sharp roots are two characters ("C#"), naturals one.
  const rootIndex = roots.includes(name.slice(0, 2))
    ? roots.indexOf(name.slice(0, 2))
    : roots.indexOf(name[0]);
  assert.notEqual(rootIndex, -1, `${name}: no root`);
  return { rootIndex, quality: name.slice(roots[rootIndex].length) };
}

const chords = loadChordMaker();

test('every chord sounds exactly its own chord tones', () => {
  for (const name of chords.CHORD_NAMES) {
    const shape = chords.GUITAR_CHORDS[name];
    const { rootIndex, quality } = parseChordName(name, chords.CHORD_ROOTS);
    const intervals = chords.CHORD_QUALITIES[quality].intervals;

    const sounded = new Set();
    shape.forEach((fret, string) => {
      if (fret !== null) sounded.add((OPEN_PITCH_CLASSES[string] + fret) % 12);
    });
    const expected = new Set(intervals.map((i) => (rootIndex + i) % 12));

    const extra = [...sounded].filter((pc) => !expected.has(pc)).map((pc) => NOTE_NAMES[pc]);
    const missing = [...expected].filter((pc) => !sounded.has(pc)).map((pc) => NOTE_NAMES[pc]);
    assert.deepEqual(extra, [], `${name} sounds notes outside the chord: ${extra}`);
    assert.deepEqual(missing, [], `${name} is missing chord tones: ${missing}`);
  }
});

test('every voicing is six strings of playable frets', () => {
  for (const name of chords.CHORD_NAMES) {
    const shape = chords.GUITAR_CHORDS[name];
    assert.equal(shape.length, 6, `${name}: expected six strings`);
    for (const fret of shape) {
      assert.ok(fret === null || (Number.isInteger(fret) && fret >= 0),
        `${name}: fret ${fret} is neither a muted string nor a real fret`);
    }
    const frets = shape.filter((f) => f !== null);
    assert.ok(frets.length >= 3, `${name}: only ${frets.length} strings sound`);
    // The guitar mesh draws a finite neck, and high barres thin out badly.
    assert.ok(Math.max(...frets) <= 12, `${name}: reaches fret ${Math.max(...frets)}`);
    // Four frets is about one hand span.
    const stretch = Math.max(...frets) - Math.min(...frets);
    assert.ok(stretch <= 4, `${name}: ${stretch}-fret stretch is unplayable`);
  }
});

test('the default pad chords keep their open voicings', () => {
  // These are what a beginner actually plays; the generated barre forms are
  // correct too, just thinner and higher up, so the open ones are pinned.
  const open = {
    Em: [0, 2, 2, 0, 0, 0],
    Am: [null, 0, 2, 2, 1, 0],
    C: [null, 3, 2, 0, 1, 0],
    D: [null, null, 0, 2, 3, 2],
    G: [3, 2, 0, 0, 0, 3],
    F: [1, 3, 3, 2, 1, 1],
  };
  for (const [name, shape] of Object.entries(open)) {
    assert.deepEqual(chords.GUITAR_CHORDS[name], shape, `${name} lost its open voicing`);
  }
});

test('the library covers every root in every quality', () => {
  const qualities = Object.keys(chords.CHORD_QUALITIES);
  assert.equal(
    chords.CHORD_NAMES.length,
    chords.CHORD_ROOTS.length * qualities.length,
    'generated name count does not match roots x qualities',
  );
  for (const quality of qualities) {
    for (const root of chords.CHORD_ROOTS) {
      assert.ok(chords.GUITAR_CHORDS[root + quality], `missing ${root + quality}`);
    }
  }
});

test('the six pad slots default to chords the library actually has', () => {
  const defaults = /const DEFAULT_PAD_CHORDS = \[([^\]]*)\]/.exec(src);
  assert.ok(defaults, 'DEFAULT_PAD_CHORDS not found');
  const names = defaults[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  assert.equal(names.length, 6, 'the pad has six slots');
  for (const name of names) {
    assert.ok(chords.GUITAR_CHORDS[name], `default slot chord ${name} is not in the library`);
  }
});
