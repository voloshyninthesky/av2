// The wheel's whole claim is that position carries meaning: a chord's ring and
// its distance from the tonic decide what it is. Get the rotation, the
// relative minors or the diatonic sevenths wrong and the app still plays a
// chord — just not the one the label and the lit sector promise. Same failure
// mode as a wrong barre shape, so it gets the same treatment.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './load-module.mjs';

const h = await loadModule(new URL('../js/play/harmony.js', import.meta.url));

const ALL_KEYS = h.FIFTHS.map((entry) => entry.pc);
const RINGS = ['major', 'minor'];

// Read a printed label back to a pitch class, independently of the module —
// otherwise a wrong spelling table would agree with itself.
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function readLabel(label) {
  let pc = LETTER_PC[label[0]];
  assert.notEqual(pc, undefined, `${label}: not a note letter`);
  let rest = label.slice(1);
  if (rest[0] === '#') { pc += 1; rest = rest.slice(1); }
  else if (rest[0] === 'b') { pc -= 1; rest = rest.slice(1); }
  const minor = rest.startsWith('m') && rest !== 'maj7';
  return { pc: (pc + 12) % 12, minor, suffix: rest };
}

test('the circle is twelve perfect fifths', () => {
  assert.equal(h.FIFTHS.length, 12);
  h.FIFTHS.forEach((entry, index) => {
    const previous = h.FIFTHS[(index + 11) % 12];
    assert.equal(entry.pc, (previous.pc + 7) % 12,
      `position ${index} (${entry.majorLabel}) is not a fifth above ${previous.majorLabel}`);
  });
  assert.equal(new Set(h.FIFTHS.map((e) => e.pc)).size, 12, 'a pitch class appears twice');
});

test('every printed label spells its own pitch class', () => {
  for (const entry of h.FIFTHS) {
    const major = readLabel(entry.majorLabel);
    assert.equal(major.pc, entry.pc, `${entry.majorLabel} is not pitch class ${entry.pc}`);
    assert.equal(major.minor, false, `${entry.majorLabel} reads as a minor`);

    const minor = readLabel(entry.minorLabel);
    assert.equal(minor.pc, entry.minorPc, `${entry.minorLabel} is not pitch class ${entry.minorPc}`);
    assert.equal(minor.minor, true, `${entry.minorLabel} does not read as a minor`);
    // The inner ring is the relative minor: a minor third below its major.
    assert.equal(entry.minorPc, (entry.pc + 9) % 12, `${entry.majorLabel} has the wrong relative minor`);
  }
});

test('a key is six chords on the major scale, in degree order', () => {
  // I ii iii IV V vi, as semitones above the tonic and as chord quality.
  const DEGREES = [
    { degree: 'I', semitones: 0, quality: '' },
    { degree: 'ii', semitones: 2, quality: 'm' },
    { degree: 'iii', semitones: 4, quality: 'm' },
    { degree: 'IV', semitones: 5, quality: '' },
    { degree: 'V', semitones: 7, quality: '' },
    { degree: 'vi', semitones: 9, quality: 'm' },
  ];
  for (const tonic of ALL_KEYS) {
    const found = h.keyDegrees(tonic);
    assert.equal(found.length, 6, `key ${h.keyLabel(tonic)}: expected six chords`);
    found.forEach((chord, index) => {
      const want = DEGREES[index];
      assert.equal(chord.degree, want.degree, `key ${h.keyLabel(tonic)}: degree ${index} out of order`);
      const parsed = h.parseChordName(chord.name);
      assert.equal(parsed.rootPc, (tonic + want.semitones) % 12,
        `key ${h.keyLabel(tonic)} ${want.degree}: wrong root (${chord.name})`);
      assert.equal(parsed.quality, want.quality,
        `key ${h.keyLabel(tonic)} ${want.degree}: wrong quality (${chord.name})`);
      assert.ok(h.GUITAR_CHORDS[chord.name], `${chord.name} is not in the library`);
    });
  }
});

test('a key lights one contiguous three-wide sector of the wheel', () => {
  // This is the entire visual argument for the layout: IV I V neighbouring on
  // the outer ring with ii vi iii directly inside them. If the sector ever
  // scatters, the wheel stops teaching anything.
  for (const tonic of ALL_KEYS) {
    const tonicIndex = h.fifthIndexOf(tonic);
    const wanted = new Set([(tonicIndex + 11) % 12, tonicIndex, (tonicIndex + 1) % 12]);
    const byRing = { major: new Set(), minor: new Set() };
    for (const chord of h.keyDegrees(tonic)) byRing[chord.ring].add(chord.fifthIndex);

    for (const ring of RINGS) {
      assert.deepEqual([...byRing[ring]].sort(), [...wanted].sort(),
        `key ${h.keyLabel(tonic)}: the ${ring} ring is not the tonic's three neighbours`);
    }
  }
});

test('every wedge in the key reports its degree, and no wedge outside it does', () => {
  for (const tonic of ALL_KEYS) {
    const inKey = new Set(h.keyDegrees(tonic).map((chord) => `${chord.ring}:${chord.fifthIndex}`));
    let degreeCount = 0;
    for (const ring of RINGS) {
      for (let fifthIndex = 0; fifthIndex < 12; fifthIndex++) {
        const degree = h.wedgeDegree(ring, fifthIndex, tonic);
        const belongs = inKey.has(`${ring}:${fifthIndex}`);
        assert.equal(Boolean(degree), belongs,
          `key ${h.keyLabel(tonic)}: ${ring} ${fifthIndex} degree/membership disagree`);
        if (degree) degreeCount++;
      }
    }
    assert.equal(degreeCount, 6, `key ${h.keyLabel(tonic)}: expected exactly six degrees`);
  }
});

test('sevenths are diatonic, not one blanket quality', () => {
  const WANT = { I: 'maj7', ii: 'm7', iii: 'm7', IV: 'maj7', V: '7', vi: 'm7' };
  for (const tonic of ALL_KEYS) {
    for (const chord of h.keyDegrees(tonic, true)) {
      const parsed = h.parseChordName(chord.name);
      assert.equal(parsed.quality, WANT[chord.degree],
        `key ${h.keyLabel(tonic)} ${chord.degree}: expected ${WANT[chord.degree]}, got ${chord.name}`);
      assert.ok(h.GUITAR_CHORDS[chord.name], `${chord.name} is not in the library`);
    }
    // Outside the key there is no degree to follow: a major becomes a plain
    // dominant 7, a minor an m7.
    for (const ring of RINGS) {
      for (let fifthIndex = 0; fifthIndex < 12; fifthIndex++) {
        if (h.wedgeDegree(ring, fifthIndex, tonic)) continue;
        assert.equal(h.qualityFor(ring, fifthIndex, tonic, true), ring === 'minor' ? 'm7' : '7',
          `key ${h.keyLabel(tonic)}: ${ring} ${fifthIndex} took the wrong borrowed quality`);
      }
    }
  }
});

test('every wedge, in every key, names a chord the library has', () => {
  for (const tonic of ALL_KEYS) {
    for (const sevenths of [false, true]) {
      for (const ring of RINGS) {
        for (let fifthIndex = 0; fifthIndex < 12; fifthIndex++) {
          const name = h.wedgeChordName(ring, fifthIndex, tonic, sevenths);
          assert.ok(h.GUITAR_CHORDS[name], `${name} is not in the library`);
          assert.equal(h.parseChordName(name).rootPc, h.wedgeRootPc(ring, fifthIndex),
            `${name}: wrong root for ${ring} ${fifthIndex}`);
        }
      }
    }
  }
});

test('a wedge label spells the chord it plays', () => {
  for (const tonic of ALL_KEYS) {
    for (const sevenths of [false, true]) {
      for (const ring of RINGS) {
        for (let fifthIndex = 0; fifthIndex < 12; fifthIndex++) {
          const label = h.wedgeLabel(ring, fifthIndex, tonic, sevenths);
          const name = h.wedgeChordName(ring, fifthIndex, tonic, sevenths);
          const read = readLabel(label);
          assert.equal(read.pc, h.parseChordName(name).rootPc, `${label} does not spell ${name}`);
          assert.equal(read.minor, ring === 'minor', `${label} is on the ${ring} ring`);
          // "Am" + "m7" would print "Amm7".
          assert.ok(!label.includes('mm'), `${label} doubled its minor`);
        }
      }
    }
  }
});

test('stepping the key walks the circle in both directions', () => {
  for (const tonic of ALL_KEYS) {
    assert.equal(h.stepKey(tonic, 1), (tonic + 7) % 12, `${h.keyLabel(tonic)} +1 is not a fifth up`);
    assert.equal(h.stepKey(tonic, -1), (tonic + 5) % 12, `${h.keyLabel(tonic)} -1 is not a fifth down`);
    assert.equal(h.stepKey(h.stepKey(tonic, 1), -1), tonic, `${h.keyLabel(tonic)} does not step back`);
  }
});

test('every piano voicing fits the keybed and sounds exactly its chord', () => {
  // C4..C6 is MIDI 60..84 — 25 semitones for the keybed's 25 keys, so being
  // in range and having a key to press are the same statement.
  assert.equal(h.PIANO_HIGH_MIDI - h.PIANO_LOW_MIDI + 1, 25, 'the keybed is 25 keys');
  for (const name of h.CHORD_NAMES) {
    const notes = h.pianoVoicing(name);
    const { rootPc, quality } = h.parseChordName(name);
    const expected = new Set(h.CHORD_QUALITIES[quality].intervals.map((i) => (rootPc + i) % 12));

    assert.equal(notes.length, 4, `${name}: expected four notes under the hand, got ${notes.length}`);
    for (const midi of notes) {
      assert.ok(Number.isInteger(midi), `${name}: ${midi} is not a MIDI note`);
      assert.ok(midi >= h.PIANO_LOW_MIDI && midi <= h.PIANO_HIGH_MIDI,
        `${name}: ${midi} is off the keybed`);
    }
    assert.deepEqual(
      [...new Set(notes.map((midi) => midi % 12))].sort((a, b) => a - b),
      [...expected].sort((a, b) => a - b),
      `${name}: the voicing does not sound its own chord tones`,
    );
    // Root at the bottom: a chord whose lowest note is not the root reads as
    // an inversion, and the lit keys would stop matching the wedge's name.
    assert.equal(Math.min(...notes) % 12, rootPc, `${name}: root is not the lowest note`);
  }
});

test('a keybed frequency round-trips through MIDI', () => {
  // The key meshes carry a float frequency and nothing else, so the wheel can
  // only find them by deriving MIDI back from that number.
  const C4 = 261.63;
  for (let semitone = 0; semitone <= 24; semitone++) {
    const freq = C4 * (2 ** (semitone / 12));
    assert.equal(h.midiFromFreq(freq), 60 + semitone, `${freq} Hz did not read as MIDI ${60 + semitone}`);
  }
  assert.ok(Math.abs(h.freqFromMidi(69) - 440) < 1e-9, 'A4 is not 440 Hz');
});
