// A wrong vowel is silent-but-wrong in the same way a wrong barre shape is: the
// ribbon still sings, just not the vowel under the finger, and nothing in the
// running app would ever say so. The detent has the same problem one layer up —
// it can be subtly non-monotonic and only ever feel "a bit sticky".
//
// So both get re-derived here rather than compared against themselves: the
// formant table is checked against what a vowel physically is, and the detent
// against the three properties it has to have to be a pitch axis at all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './load-module.mjs';

const v = await loadModule(new URL('../js/play/voice.js', import.meta.url));
const h = await loadModule(new URL('../js/play/harmony.js', import.meta.url));

const MODES = ['major', 'minor'];
const ROOTS = Array.from({ length: 12 }, (_, pc) => pc);

// ============================================================
// THE VOWEL TABLE
// ============================================================

test('every vowel is two rising formants with a dominant first peak', () => {
  for (const { label, formants } of v.VOWELS) {
    assert.equal(formants.length, 2, `${label}: a vowel here is two peaks`);
    const [[f1, q1, gain1], [f2, q2, gain2]] = formants;
    assert.ok(f2 > f1, `${label}: F2 (${f2}) must sit above F1 (${f1})`);
    assert.ok(f1 >= 250 && f1 <= 1000, `${label}: F1 ${f1} is outside any human vowel`);
    assert.ok(f2 >= 700 && f2 <= 2600, `${label}: F2 ${f2} is outside any human vowel`);
    assert.equal(gain1, 1, `${label}: F1 carries the vowel and must be the loud one`);
    assert.ok(gain2 < gain1, `${label}: F2 ${gain2} must sit under F1`);
    assert.ok(q1 > 0 && q2 > 0, `${label}: a bandpass needs a positive Q`);
  }
});

test('the five vowels are ordered as one continuous tongue movement', () => {
  // The axis is F2 descending — front vowels (І) to back vowels (У). If any
  // pair swaps, dragging across the ribbon doubles back through a vowel it
  // already passed, which is the whole thing the ordering buys.
  const f2s = v.VOWELS.map(({ formants }) => formants[1][0]);
  for (let i = 1; i < f2s.length; i++) {
    assert.ok(f2s[i] < f2s[i - 1], `${v.VOWELS[i].label}: F2 must keep falling across the axis`);
  }
  assert.deepEqual(v.VOWELS.map((entry) => entry.label), ['І', 'Е', 'А', 'О', 'У']);
});

test('vowelAt lands exactly on each named vowel at its own position', () => {
  v.VOWELS.forEach((vowel, index) => {
    const x = index / (v.VOWEL_COUNT - 1);
    const got = v.vowelAt(x);
    got.forEach((peak, peakIndex) => {
      peak.forEach((value, field) => {
        assert.ok(
          Math.abs(value - vowel.formants[peakIndex][field]) < 1e-9,
          `${vowel.label} at x=${x}: peak ${peakIndex} field ${field} drifted`,
        );
      });
    });
  });
});

test('vowelAt moves monotonically and stays inside the table', () => {
  const lowest = Math.min(...v.VOWELS.map(({ formants }) => formants[0][0]));
  const highest = Math.max(...v.VOWELS.map(({ formants }) => formants[0][0]));
  let previousF2 = Infinity;
  for (let step = 0; step <= 200; step++) {
    const [[f1], [f2]] = v.vowelAt(step / 200);
    assert.ok(f1 >= lowest - 1e-9 && f1 <= highest + 1e-9, `F1 ${f1} left the table`);
    assert.ok(f2 <= previousF2 + 1e-9, `F2 rose at x=${step / 200} — the axis doubled back`);
    previousF2 = f2;
  }
});

test('vowelAt clamps rather than extrapolating off either end', () => {
  assert.deepEqual(v.vowelAt(-3), v.vowelAt(0));
  assert.deepEqual(v.vowelAt(4), v.vowelAt(1));
});

test('openness runs from У closed to А open', () => {
  const openness = v.VOWELS.map((_, index) => v.vowelOpenness(index / (v.VOWEL_COUNT - 1)));
  const byLabel = Object.fromEntries(v.VOWELS.map((vowel, i) => [vowel.label, openness[i]]));
  assert.ok(byLabel['А'] > byLabel['Е'], 'А must read more open than Е');
  assert.ok(byLabel['Е'] > byLabel['І'], 'Е must read more open than І');
  assert.ok(byLabel['О'] > byLabel['У'], 'О must read more open than У');
  for (const value of openness) assert.ok(value >= 0 && value <= 1, `openness ${value} out of range`);
});

// ============================================================
// THE PITCH AXIS
// ============================================================

test('the singing range is an octave and a half, and the axis is its inverse', () => {
  assert.equal(v.VOICE_HIGH_MIDI - v.VOICE_LOW_MIDI, 19);
  assert.equal(v.pitchAt(0), v.VOICE_LOW_MIDI);
  assert.equal(v.pitchAt(1), v.VOICE_HIGH_MIDI);
  for (let step = 0; step <= 40; step++) {
    const y = step / 40;
    assert.ok(Math.abs(v.axisAtPitch(v.pitchAt(y)) - y) < 1e-9, `round trip failed at y=${y}`);
  }
});

test('the axis clamps at both ends so a finger off the field cannot shout', () => {
  assert.equal(v.pitchAt(-1), v.VOICE_LOW_MIDI);
  assert.equal(v.pitchAt(9), v.VOICE_HIGH_MIDI);
  assert.equal(v.axisAtPitch(0), 0);
  assert.equal(v.axisAtPitch(200), 1);
});

test('the feel constants stay inside the range they were tuned in', () => {
  assert.ok(v.PITCH_DETENT > 0.4 && v.PITCH_DETENT < 0.8, 'detent left its tuned window');
  assert.ok(v.GLIDE_SECONDS > 0 && v.GLIDE_SECONDS < 0.12, 'a glide this long stops tracking the finger');
  assert.ok(v.VOWEL_GLIDE_SECONDS > v.GLIDE_SECONDS, 'a mouth is heavier than a pitch');
});

// ============================================================
// THE DETENT (harmony.js, but it exists for this surface)
// ============================================================

test('a key has seven distinct notes in both modes', () => {
  for (const mode of MODES) {
    for (const tonicPc of ROOTS) {
      const pcs = h.scalePitchClasses(tonicPc, mode);
      assert.equal(pcs.length, 7);
      assert.equal(new Set(pcs).size, 7, `${tonicPc} ${mode}: a note repeats`);
      assert.equal(pcs[0], tonicPc, `${tonicPc} ${mode}: does not start on the tonic`);
    }
  }
});

test('a minor key is the same seven notes as its relative major', () => {
  // The same fact the wedges already rely on — asserted here because the
  // ribbon would silently disagree with the wheel if it ever stopped being true.
  for (const tonicPc of ROOTS) {
    const minor = [...h.scalePitchClasses(tonicPc, 'minor')].sort((a, b) => a - b);
    const major = [...h.scalePitchClasses(h.keySignaturePc(tonicPc, 'minor'), 'major')]
      .sort((a, b) => a - b);
    assert.deepEqual(minor, major, `${tonicPc}: relative major disagrees`);
  }
});

test('nearestScaleMidi always returns an in-key note within a whole step', () => {
  for (const mode of MODES) {
    for (const tonicPc of ROOTS) {
      for (let midi = 60; midi <= 79; midi += 0.25) {
        const nearest = h.nearestScaleMidi(midi, tonicPc, mode);
        assert.ok(h.isInScale(nearest, tonicPc, mode), `${nearest} is not in ${tonicPc} ${mode}`);
        assert.ok(Math.abs(midi - nearest) <= 1 + 1e-9, `${midi} snapped ${Math.abs(midi - nearest)} away`);
      }
    }
  }
});

test('the detent is monotonic — dragging up never lowers the pitch', () => {
  // The failure this catches is not a wrong note, it is a finger that moves up
  // the ribbon while the pitch dips. It would read as the surface being broken.
  for (const mode of MODES) {
    for (const tonicPc of ROOTS) {
      let previous = -Infinity;
      for (let midi = 60; midi <= 79; midi += 0.05) {
        const snapped = h.snapToScale(midi, tonicPc, mode, v.PITCH_DETENT);
        assert.ok(
          snapped >= previous - 1e-9,
          `${tonicPc} ${mode}: pitch fell from ${previous} to ${snapped} at ${midi}`,
        );
        previous = snapped;
      }
    }
  }
});

test('the detent bends towards the note and never past it', () => {
  for (const mode of MODES) {
    for (const tonicPc of ROOTS) {
      for (let midi = 60.05; midi <= 79; midi += 0.1) {
        const nearest = h.nearestScaleMidi(midi, tonicPc, mode);
        const snapped = h.snapToScale(midi, tonicPc, mode, v.PITCH_DETENT);
        const before = Math.abs(midi - nearest);
        const after = Math.abs(snapped - nearest);
        assert.ok(after <= before + 1e-9, `${midi} in ${tonicPc} ${mode}: detent pushed it away`);
        // Crossing the note would mean the axis folds back on itself.
        assert.ok(
          Math.sign(snapped - nearest) === Math.sign(midi - nearest) || after < 1e-9,
          `${midi} in ${tonicPc} ${mode}: detent overshot the note`,
        );
      }
    }
  }
});

test('the detent leaves in-key notes and the midpoints between them alone', () => {
  // Both ends of the interval are fixed points, which is what keeps the axis
  // onto its own range — no pitch becomes unreachable however hard it pulls.
  for (const mode of MODES) {
    for (const tonicPc of ROOTS) {
      for (const { midi } of h.scaleDegreeMidis(60, 79, tonicPc, mode)) {
        assert.ok(
          Math.abs(h.snapToScale(midi, tonicPc, mode, 1) - midi) < 1e-9,
          `${midi} in ${tonicPc} ${mode}: an in-key note moved`,
        );
      }
    }
  }
});

test('pull 0 is the identity, and a stronger pull is always at least as strong', () => {
  for (const mode of MODES) {
    for (const tonicPc of [0, 3, 7, 10]) {
      for (let midi = 60.1; midi <= 79; midi += 0.3) {
        assert.equal(h.snapToScale(midi, tonicPc, mode, 0), midi);
        const nearest = h.nearestScaleMidi(midi, tonicPc, mode);
        const weak = Math.abs(h.snapToScale(midi, tonicPc, mode, 0.3) - nearest);
        const strong = Math.abs(h.snapToScale(midi, tonicPc, mode, 0.9) - nearest);
        assert.ok(strong <= weak + 1e-9, `${midi}: a stronger pull pulled less`);
      }
    }
  }
});

test('the degree ticks agree with the degree the number row presses', () => {
  for (const mode of MODES) {
    for (const tonicPc of ROOTS) {
      const ticks = h.scaleDegreeMidis(v.VOICE_LOW_MIDI, v.VOICE_HIGH_MIDI, tonicPc, mode);
      assert.ok(ticks.length >= 11, `${tonicPc} ${mode}: only ${ticks.length} notes in range`);
      for (const { midi, degree } of ticks) {
        assert.ok(degree >= 1 && degree <= 7, `degree ${degree} out of range`);
        assert.ok(h.isInScale(midi, tonicPc, mode));
      }
      // `1` is the tonic in either mode — the promise the chord row already makes.
      for (let degree = 1; degree <= 7; degree++) {
        const midi = h.degreeMidi(degree, tonicPc, mode, v.VOICE_LOW_MIDI);
        assert.ok(h.isInScale(midi, tonicPc, mode), `degree ${degree} of ${tonicPc} ${mode} is out of key`);
        assert.ok(
          midi >= v.VOICE_LOW_MIDI && midi < v.VOICE_LOW_MIDI + 12,
          `degree ${degree} landed at ${midi}, outside the first octave`,
        );
        const expected = ticks.find((tick) => tick.degree === degree)?.midi;
        assert.equal(midi, expected, `degree ${degree} of ${tonicPc} ${mode} disagrees with its tick`);
      }
      assert.equal(h.degreeMidi(1, tonicPc, mode, v.VOICE_LOW_MIDI) % 12, tonicPc % 12);
    }
  }
});
