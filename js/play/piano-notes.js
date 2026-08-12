// ============================================================
// PIANO NOTES + DESKTOP KEYBOARD JAM
// Piano keys sustain while held, so each press opens a loop capture that is
// only stamped with its duration on release. The keyboard routes the same
// events as the pointer does — digits are piano, ZXCVB drums, the chord row
// plus the strum keys guitar, NM,./ vocal — so away from a close-up desktop
// can play every instrument at once without focusing anything.
//
// A close-up reverses that: it makes the keyboard exclusive, and only the
// focused instrument's keys answer. See "WHO OWNS THE KEYBOARD" below for why.
//
// The piano close-up also brings its own real-keyboard-shaped layout (see
// PIANO_FOCUS_WHITE/BLACK), which claims the letter rows outright — including
// four of the QWERTY chord letters — so rather than leave a chord row that
// works two keys in six, the whole row steps aside and the chords move to the
// digits, where they play *piano* chords through the wheel's own route.
// ============================================================
import * as THREE from 'three';
import { session } from '../core/session.js?v=20260813-06';
import { ui, audio, piano, whiteKeys, blackKeys } from '../core/studio.js?v=20260813-06';
import { instrumentView } from '../view/instrument-presets.js?v=20260813-06';
import { raycaster, stageWalkPlane } from '../view/pick.js?v=20260813-06';
import { play, heldPianoNotes, keyboardPianoNotes } from './state.js?v=20260813-06';
import { noteKeyboardJamActivity } from './vibe.js?v=20260813-06';
import {
  LOOP_MAX_SECONDS,
  loop,
  captureLoopEvent,
  playMusicalEvent,
  runMusicalVisual,
  clearRecordedLoop,
  toggleLoopRecording,
} from './loop.js?v=20260813-06';
import { GUITAR_KEY_CHORDS, keyChordNames, fireGuitarStrum } from './guitar.js?v=20260813-06';
import {
  syncChordWheelHeld,
  pressPianoChordFromKeyboard,
  releasePianoChordFromKeyboard,
} from './chord-wheel.js?v=20260813-06';
import { deferHeldLoopEventPlayback, playVocalNote } from './pads.js?v=20260813-06';

// Routing a key or a click needs to know what the stage will allow right now,
// and can move the mascot; main.js owns both and wires them in at boot.
let hooks = {
  activateAudioForSound: () => {},
  canPlayInstrument: () => false,
  canKeyboardJamPlay: () => false,
  hitInteractableDetailsAt: () => null,
  onPointerMove: () => {},
  playNearestInstrument: () => {},
  walkMascotToInstrument: () => {},
  setMascotDestination: () => {},
  beginKeyboardVocal: () => {},
  releaseKeyboardVocal: () => {},
};
export function initPianoNotes(next) {
  hooks = { ...hooks, ...next };
}

// ---- trigger instruments ----
export function trigger(mesh) {
  const u = mesh.userData;
  switch (u.instrument) {
    case 'drums': {
      playMusicalEvent({ type: 'drum', part: u.part, vel: 1, vibe: 4 });
      break;
    }
    case 'piano': {
      // Keys only — cabinet / lid / bench must not trigger a fallback note.
      if (u.freq === undefined) return;
      playMusicalEvent({ type: 'piano', freq: u.freq, vel: 1, vibe: 3.5 });
      break;
    }
    case 'guitar': {
      if (u.stringFreq !== undefined) {
        playMusicalEvent({ type: 'guitar-pluck', freq: u.stringFreq, stringIndex: u.stringIndex, vel: 1, vibe: 3 });
      }
      break;
    }
    case 'mic': {
      playVocalNote(u.vocalFreq ?? 329.63, u.vocalVowel ?? 1, true);
      break;
    }
  }
}

// `vibe` is an option because the chord wheel presses four keys for one
// gesture: only its first note carries the reward, or a chord would be worth
// four times a note for the same single tap.
export function beginHeldPianoNote(key, { vibe = 3.5 } = {}) {
  if (!key?.userData || !Number.isFinite(key.userData.freq)) return null;
  hooks.activateAudioForSound();
  const event = { type: 'piano', freq: key.userData.freq, vel: 1, vibe };
  const startedAt = audio.ctx?.currentTime ?? 0;
  const captured = captureLoopEvent({ ...event, duration: 0.12 }, startedAt);
  if (captured) captured.durationPending = true;

  const held = {
    key,
    voice: audio.startPiano(event.freq, event.vel),
    captured,
    startedAt,
    captureFinished: false,
  };
  heldPianoNotes.add(held);
  piano.hold(key, true);
  runMusicalVisual(event, true);
  return held;
}

export function finalizeHeldPianoLoopCapture(held, { cancel = false } = {}) {
  if (!held?.captured || held.captureFinished) return;
  held.captureFinished = true;
  const event = held.captured;
  if (cancel) {
    const index = loop.events.indexOf(event);
    if (index !== -1) loop.events.splice(index, 1);
    return;
  }
  const now = audio.ctx?.currentTime ?? held.startedAt;
  const maximum = loop.duration > 0 ? Math.max(0.12, loop.duration - 0.06) : LOOP_MAX_SECONDS;
  event.duration = Math.min(maximum, Math.max(0.12, now - held.startedAt));
  delete event.durationPending;
  deferHeldLoopEventPlayback(event);
}

export function releaseHeldPianoNote(held, { cancel = false } = {}) {
  if (!held) return;
  finalizeHeldPianoLoopCapture(held, { cancel });
  held.voice?.release?.();
  piano.hold(held.key, false);
  heldPianoNotes.delete(held);
}

export function releaseAllHeldPianoNotes({ cancel = false } = {}) {
  for (const held of [...heldPianoNotes]) releaseHeldPianoNote(held, { cancel });
  keyboardPianoNotes.clear();
  // A chord the keyboard is holding lives half here and half in the wheel, and
  // the loop above only reaches this half — leave the other set standing and
  // the next press would release notes that have already gone.
  releaseKeyboardPianoChord();
}

export function finishHeldPianoLoopCaptures() {
  for (const held of heldPianoNotes) finalizeHeldPianoLoopCapture(held);
}

export function captureHeldPianoIntoLoop() {
  if (!audio.ctx) return;
  for (const held of heldPianoNotes) {
    if (held.captured && !held.captureFinished) continue;
    const startedAt = audio.ctx.currentTime;
    const captured = captureLoopEvent({
      type: 'piano',
      freq: held.key.userData.freq,
      vel: 1,
      vibe: 3.5,
      duration: 0.12,
    }, startedAt);
    if (!captured) continue;
    captured.durationPending = true;
    held.captured = captured;
    held.startedAt = startedAt;
    held.captureFinished = false;
  }
}

export function handleClick(e) {
  if (!session.started || ui.modalOpen || session.flyT >= 0) return;
  hooks.onPointerMove(e);
  const details = hooks.hitInteractableDetailsAt(e.clientX, e.clientY);
  if (details) {
    const hit = details.object;
    const kind = hit.userData.instrument;
    // Sound only while focused on that instrument — distant tap just walks over.
    if (hooks.canPlayInstrument(kind)) trigger(hit);
    else hooks.walkMascotToInstrument(kind);
    return;
  }
  const walkPoint = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(stageWalkPlane, walkPoint)) hooks.setMascotDestination(walkPoint);
}

function isEditableHotkeyTarget(target) {
  return Boolean(target?.closest?.('button, a, input, textarea, select, [contenteditable="true"], [role="button"]'));
}

// Keyboard movement is intentionally absent; click-to-move and the joystick
// are the only mascot movement inputs.
// Disjoint from E approach / L loop / guitar / vocal / piano.
const DRUM_KEYS = { KeyZ: 'kick', KeyX: 'snare', KeyC: 'hihat', KeyV: 'tom2', KeyB: 'crash' };
export const VOCAL_KEYS = {
  KeyN: { freq: 261.63, vowel: 0 },
  KeyM: { freq: 293.66, vowel: 1 },
  Comma: { freq: 329.63, vowel: 2 },
  Period: { freq: 349.23, vowel: 0 },
  Slash: { freq: 392.00, vowel: 1 },
};

// Real-keyboard-shaped piano jam, active only in focused close-up
// (canPlayInstrument('piano')). Home row is nine white keys C4..D5 left to
// right — the GarageBand "Musical Typing" span — and the row above carries
// each black key exactly where it sits on a physical keyboard, gaps
// included: nothing above the D/F or J/K pairs, because C4..D5 has no C#/D#
// sharp between E-F or B-C either. Verified against the built keybed's real
// frequencies, not hand-derived — see the Node check referenced in
// notes/Decisions.md.
const PIANO_FOCUS_WHITE = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'];
const PIANO_FOCUS_BLACK = ['KeyW', 'KeyE', 'KeyT', 'KeyY', 'KeyU', 'KeyO']; // C#4 D#4 F#4 G#4 A#4 C#5
const pianoFocusKeymap = new Map([
  ...PIANO_FOCUS_WHITE.map((code, i) => [code, whiteKeys[i]]),
  ...PIANO_FOCUS_BLACK.map((code, i) => [code, blackKeys[i]]),
]);

// In a close-up the chord row is the number row, and the number *is* the scale
// degree: `1` is the tonic in either mode, `7` the degree that has no wedge on
// the wheel because it is diminished. Nothing else can spell a degree as
// plainly, and the digits are free here — the piano's own notes have moved to
// the letters, and outside a close-up the letter row keeps the chords instead.
const FOCUS_CHORD_DIGITS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7'];
const STRUM_KEYS = new Set(['Space', 'ArrowDown', 'ArrowUp']);
const digitChord = (code) => keyChordNames[FOCUS_CHORD_DIGITS.indexOf(code)] || null;

// ============================================================
// WHO OWNS THE KEYBOARD
// Away from a close-up the keyboard is the multi-instrument jam surface every
// map is written for (§1 goal 2): drums, piano, chords and vocal all live at
// once. Inside one, it is that instrument's alone — a close-up is a decision
// about what you are playing, and having the drum row still fire underneath a
// piano performance made the keyboard feel like it belonged to the stage
// rather than to the instrument in front of you.
//
// The chord row is the one map two instruments share, because the wheel is
// shared: it answers under guitar and piano focus, and falls silent under
// drums and mic like everything else that is not theirs.
// ============================================================
function focusedKeyboardInstrument() {
  for (const kind of ['piano', 'guitar', 'drums', 'mic']) {
    if (hooks.canPlayInstrument(kind)) return kind;
  }
  return null;
}
/** True while nothing is focused (jam), or while `kind` is what is focused. */
const keyboardOwnedBy = (kind) => {
  const focused = focusedKeyboardInstrument();
  return focused === null || focused === kind;
};
const chordRowIsLive = () => {
  const focused = focusedKeyboardInstrument();
  return focused === null || focused === 'guitar' || focused === 'piano';
};

/** Which chord a key event arms right now, given where the visitor is. */
function chordForKeyEvent(code) {
  // Inside a close-up the row is the digits, for guitar and piano alike; the
  // letter row is what the unfocused jam surface uses, where the digits are
  // already the piano's white keys.
  return focusedKeyboardInstrument() ? digitChord(code) : (GUITAR_KEY_CHORDS[code] || null);
}

// A keyboard-held piano chord is one at a time and belongs to the key that
// started it, so a second chord key replaces the first and only that key's
// release lets it go.
let keyboardPianoChordCode = null;
function releaseKeyboardPianoChord() {
  if (!keyboardPianoChordCode) return;
  keyboardPianoChordCode = null;
  releasePianoChordFromKeyboard();
}

window.addEventListener('keydown', (e) => {
  if (!session.started || ui.modalOpen) return;
  if (isEditableHotkeyTarget(e.target)) return;

  // Enter approaches the nearest instrument; KeyE now belongs to the QWERTY
  // guitar chord row, so approach lives on a key no instrument map can claim.
  if (e.code === 'Enter' && !e.repeat && instrumentView.phase === 'idle') {
    hooks.playNearestInstrument();
    return;
  }

  if (e.code === 'KeyL' && !e.repeat) {
    e.preventDefault();
    if (!play.loopUnlocked) {
      toggleLoopRecording();
      return;
    }
    if (e.shiftKey && loop.state !== 'empty') clearRecordedLoop();
    else toggleLoopRecording();
    return;
  }

  if (!hooks.canKeyboardJamPlay()) return;

  // Piano close-up's own layout wins over the global chord/digit maps for the
  // keys it claims, so W/E/T/Y strike piano notes instead of guitar chords
  // for as long as focus holds — see the comment on PIANO_FOCUS_WHITE.
  if (hooks.canPlayInstrument('piano')) {
    const key = pianoFocusKeymap.get(e.code);
    if (key) {
      if (e.repeat || keyboardPianoNotes.has(e.code)) return;
      e.preventDefault();
      keyboardPianoNotes.set(e.code, beginHeldPianoNote(key));
      noteKeyboardJamActivity('piano');
      return;
    }
  }

  const chordName = chordRowIsLive() ? chordForKeyEvent(e.code) : null;
  if (chordName) {
    e.preventDefault();
    if (!e.repeat) {
      // One row, three meanings — each one the wheel's own, so a key and a
      // wedge never disagree about what the same chord does:
      //
      // Piano-focused, the chord SOUNDS and presses the keys it voices, held
      // for as long as the key is. The piano has no second surface to strike.
      //
      // Guitar-focused, it is *select-only*: the fretting hand chooses and the
      // strum keys play (§ Guitar performance mode's two-hand model).
      //
      // Unfocused, the key IS the play gesture — with no visible wheel to
      // read, arming silently would look broken — so it selects and strums.
      if (focusedKeyboardInstrument() === 'piano') {
        releaseKeyboardPianoChord();
        keyboardPianoChordCode = e.code;
        pressPianoChordFromKeyboard(chordName);
        noteKeyboardJamActivity('piano');
      } else {
        play.keyboardGuitarChord = chordName;
        syncChordWheelHeld();
        if (focusedKeyboardInstrument() !== 'guitar') {
          fireGuitarStrum(0.85, 'bass-to-treble', null, null, true, { focusRequired: false });
          noteKeyboardJamActivity('guitar');
        }
      }
    }
    return;
  }

  if (e.code in DRUM_KEYS && keyboardOwnedBy('drums')) {
    if (e.repeat) return;
    e.preventDefault();
    playMusicalEvent({ type: 'drum', part: DRUM_KEYS[e.code], vel: 1, vibe: 4 });
    noteKeyboardJamActivity('drums');
    return;
  }

  // The digits are the global white-key row, and only that: inside any
  // close-up 1-7 were claimed as the chord row above, and at the piano A..L
  // covers those notes over a wider span anyway.
  if (/^Digit[1-8]$/.test(e.code) && !focusedKeyboardInstrument() && keyboardOwnedBy('piano')) {
    if (e.repeat || keyboardPianoNotes.has(e.code)) return;
    e.preventDefault();
    const idx = Number(e.code.slice(5)) - 1;
    const key = whiteKeys[idx];
    if (!key) return;
    keyboardPianoNotes.set(e.code, beginHeldPianoNote(key));
    noteKeyboardJamActivity('piano');
    return;
  }

  // Strum: the arrows are the picking hand, down and up on adjacent keys so an
  // alternating pattern is two fingers rather than a held modifier. Space stays
  // a downstroke, and Shift+Space an upstroke, because both already shipped.
  if (STRUM_KEYS.has(e.code) && keyboardOwnedBy('guitar')) {
    e.preventDefault();
    if (e.repeat) return;
    const upstroke = e.code === 'ArrowUp' || (e.code === 'Space' && e.shiftKey);
    fireGuitarStrum(
      1,
      upstroke ? 'treble-to-bass' : 'bass-to-treble',
      null,
      null,
      true,
      { focusRequired: false },
    );
    noteKeyboardJamActivity('guitar');
    return;
  }

  if (e.code in VOCAL_KEYS && keyboardOwnedBy('mic')) {
    e.preventDefault();
    if (e.repeat || play.keyboardVocal?.code === e.code) return;
    hooks.beginKeyboardVocal(e.code);
  }
});

window.addEventListener('keyup', (e) => {
  if (keyboardPianoNotes.has(e.code)) {
    const heldPiano = keyboardPianoNotes.get(e.code);
    releaseHeldPianoNote(heldPiano);
    keyboardPianoNotes.delete(e.code);
    noteKeyboardJamActivity('piano');
  }
  // Release is deliberately unconditional on focus: it can change between the
  // press and the release, and whatever a key started still has to let go.
  if (keyboardPianoChordCode === e.code) {
    releaseKeyboardPianoChord();
    noteKeyboardJamActivity('piano');
  }
  const guitarChord = GUITAR_KEY_CHORDS[e.code] || digitChord(e.code);
  if (guitarChord && play.keyboardGuitarChord === guitarChord) {
    play.keyboardGuitarChord = null;
    syncChordWheelHeld();
    noteKeyboardJamActivity('guitar');
  }
  if (play.keyboardVocal?.code === e.code) {
    hooks.releaseKeyboardVocal();
  }
});

