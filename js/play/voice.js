// ============================================================
// VOICE
// What a vowel *is*, as plain data: two formant peaks, and how to stand
// between two of them. The rest of the stage's theory lives in harmony.js
// (pitch) and rhythm.js (time); this is the third axis, and it is the one the
// voice owns — no other instrument here changes timbre while it sounds.
//
// A vowel is a resonance, not a waveform. Sing "ah" and "ee" on the same note
// and the vocal cords do exactly the same thing; what moves is the mouth,
// which is a filter. So the whole table is two bandpass peaks — F1 roughly
// tracks how open the jaw is, F2 how far forward the tongue sits — and moving
// between two vowels is just moving those two peaks.
//
// This file imports nothing, on purpose, for harmony.js's reason: a wrong
// formant is silent-but-wrong. It still makes a sound, just not the vowel on
// the label, and nothing in the running app would surface that.
// ============================================================

/**
 * The five vowels Ukrainian singing actually drills, in the order the ribbon
 * lays them out — which is F2 descending, so the axis is one continuous
 * tongue movement front to back rather than five unrelated stops.
 *
 * Each entry is `[frequency, Q, gain]` per peak. Q rises as the vowel closes:
 * a narrow mouth is a sharper resonator, and a flat Q across all five made І
 * sound like a muffled Е.
 */
export const VOWELS = [
  { label: 'І', formants: [[350, 7.0, 1], [2100, 9.0, 0.40]] },
  { label: 'Е', formants: [[500, 6.0, 1], [1750, 8.0, 0.45]] },
  { label: 'А', formants: [[800, 5.0, 1], [1200, 7.0, 0.45]] },
  { label: 'О', formants: [[520, 5.5, 1], [900, 6.5, 0.42]] },
  { label: 'У', formants: [[330, 6.5, 1], [750, 7.5, 0.38]] },
];

export const VOWEL_COUNT = VOWELS.length;

/**
 * The vowel at a point on the axis, `x` in 0..1, interpolated between its two
 * neighbours. Formant frequency is interpolated in log space because pitch
 * perception is logarithmic — a linear sweep from 350 Hz to 2100 Hz spends
 * almost all of its travel in the top vowel and lurches out of the bottom one.
 */
export function vowelAt(x) {
  const clamped = Math.max(0, Math.min(1, x));
  const position = clamped * (VOWEL_COUNT - 1);
  const low = Math.min(VOWEL_COUNT - 2, Math.floor(position));
  const t = position - low;
  const a = VOWELS[low].formants;
  const b = VOWELS[low + 1].formants;
  return a.map(([frequency, q, gain], index) => {
    const [frequency2, q2, gain2] = b[index];
    return [
      Math.exp(Math.log(frequency) * (1 - t) + Math.log(frequency2) * t),
      q + (q2 - q) * t,
      gain + (gain2 - gain) * t,
    ];
  });
}

/** Nearest named vowel to a point on the axis — for labels and mouth shapes. */
export function vowelLabelAt(x) {
  const clamped = Math.max(0, Math.min(1, x));
  return VOWELS[Math.round(clamped * (VOWEL_COUNT - 1))].label;
}

/**
 * How open the mouth is at a point on the axis, 0..1. The mascot has three
 * carved mouths and no morph targets, so this is what picks between them —
 * openness tracks F1, which is what "open" physically means here.
 */
export function vowelOpenness(x) {
  const [[f1]] = vowelAt(x);
  const low = Math.log(330);   // У, the most closed
  const high = Math.log(800);  // А, the most open
  return Math.max(0, Math.min(1, (Math.log(f1) - low) / (high - low)));
}

// ============================================================
// THE SINGING RANGE
// An octave and a half from middle C. Deliberately not the piano's two
// octaves: past G5 the formant synth stops reading as a voice and starts
// reading as a siren, because the harmonics a vowel is *made of* climb above
// its own second formant and there is nothing left for the filter to shape.
// ============================================================
export const VOICE_LOW_MIDI = 60;  // C4
export const VOICE_HIGH_MIDI = 79; // G5

/** Continuous MIDI from a 0..1 axis, 0 at the bottom of the range. */
export const pitchAt = (y) => (
  VOICE_LOW_MIDI + Math.max(0, Math.min(1, y)) * (VOICE_HIGH_MIDI - VOICE_LOW_MIDI)
);

/** The inverse — where a MIDI note sits on the axis. */
export const axisAtPitch = (midi) => (
  Math.max(0, Math.min(1, (midi - VOICE_LOW_MIDI) / (VOICE_HIGH_MIDI - VOICE_LOW_MIDI)))
);

/**
 * How hard the pitch axis pulls towards the notes of the key. Set by ear:
 * below ~0.4 a beginner's slide sounds sour, above ~0.8 the bend disappears
 * and it stops reading as a voice at all.
 */
export const PITCH_DETENT = 0.62;

/**
 * The pull for the *press*, and only the press. A drag earns its detent — the
 * finger is steering, so the axis has to leave room to bend — but a tap has
 * stated no intention beyond "this note", and the note it starts is the one
 * thing the surface cannot afford to get wrong: a first touch that lands sour
 * says the instrument is broken, not that the singer is early. Near 1 the
 * curve still never quantises (midpoints stay fixed, the axis stays onto its
 * range and monotonic), it just flattens hard enough that only a press exactly
 * between two notes stays between them. The first move re-enters the drag
 * detent; the step between the two curves peaks near a tenth of a semitone,
 * which the glide time swallows whole.
 */
export const PITCH_DETENT_PRESS = 0.94;

/**
 * How long a glide takes to reach a new pitch, in seconds. Not zero: an
 * instant jump clicks, and a voice that steps between notes is a synthesizer.
 * Short enough that a fast slide still tracks the finger.
 */
export const GLIDE_SECONDS = 0.055;

/** The same, for the vowel — slower, because a mouth is heavier than a pitch. */
export const VOWEL_GLIDE_SECONDS = 0.09;
