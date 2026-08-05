// ============================================================
// PERFORMANCE STATE
// What is being held down right now, across every input route: a chord under
// a finger, a chord latched by a tap, the keyboard's chord and vowel, and how
// hard the strum arm is still swinging. Pointer, keyboard, pad and loop
// playback all read and write these, so they live in one place rather than
// being threaded between the modules that own each route.
// ============================================================

// Track each finger separately so pads and instrument play remain independent.
export const activePointers = new Map();

/** Piano keys held down by a pointer, and by a desktop key (code -> note). */
export const heldPianoNotes = new Set();
export const keyboardPianoNotes = new Map();

export const play = {
  /** Chord held under a finger on the chord pad, if any. */
  heldGuitarChord: null,
  heldGuitarChordPointer: null,
  /** Chord latched by a quick tap, which survives the finger lifting. */
  latchedGuitarChord: null,
  /** Chord held by a desktop key in the chord row. */
  keyboardGuitarChord: null,
  /** Vocal note held by a desktop key, and its repeat-pulse timer. */
  keyboardVocal: null,
  keyboardVocalPulseTimer: null,
  /** Residual strum-arm swing, decayed every frame by the mascot update. */
  guitarStrokeMotion: 0,
  guitarStrokeDirection: 1,

  /** Vocal note held on the pad: the voice, its button, and its pointer. */
  heldVocal: null,
  heldVocalButton: null,
  heldVocalPointer: null,
  heldVocalPulseTimer: null,
  /** Open loop-pedal capture for a held note, stamped with its real duration
   *  only once the note is released. */
  heldLoopCapture: null,

  /** Vibe meter: current level, when it last rose, and the reward cooldown. */
  vibe: 0,
  lastVibeAdd: 0,
  vibeCooldown: 0,
  /** The loop pedal stays hidden until the meter has been filled once. */
  loopUnlocked: false,
};
