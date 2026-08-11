// ============================================================
// PIANO NOTES + DESKTOP KEYBOARD JAM
// Piano keys sustain while held, so each press opens a loop capture that is
// only stamped with its duration on release. The keyboard routes the same
// events as the pointer does — digits are piano, ZXCVB drums, the chord row
// plus Space guitar, NM,./ vocal — so desktop can play without focusing an
// instrument at all.
//
// Piano close-up additionally gets its own real-keyboard-shaped layout (see
// PIANO_FOCUS_WHITE/BLACK below), active only while focused there. It reuses
// four of the QWERTY chord letters (W E T Y), so for the duration of piano
// focus those specific keys strike piano notes instead of selecting chords —
// Q and R stay guitar throughout, and every other instrument's keys are
// untouched. Leaving focus restores the global map immediately.
// ============================================================
import * as THREE from 'three';
import { session } from '../core/session.js?v=20260812-04';
import { ui, audio, piano, whiteKeys, blackKeys } from '../core/studio.js?v=20260812-04';
import { instrumentView } from '../view/instrument-presets.js?v=20260812-04';
import { raycaster, stageWalkPlane } from '../view/pick.js?v=20260812-04';
import { play, heldPianoNotes, keyboardPianoNotes } from './state.js?v=20260812-04';
import { noteKeyboardJamActivity } from './vibe.js?v=20260812-04';
import {
  LOOP_MAX_SECONDS,
  loop,
  captureLoopEvent,
  playMusicalEvent,
  runMusicalVisual,
  clearRecordedLoop,
  toggleLoopRecording,
} from './loop.js?v=20260812-04';
import { GUITAR_KEY_CHORDS, fireGuitarStrum } from './guitar.js?v=20260812-04';
import { syncChordPadHeld, deferHeldLoopEventPlayback, playVocalNote } from './pads.js?v=20260812-04';

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

export function beginHeldPianoNote(key) {
  if (!key?.userData || !Number.isFinite(key.userData.freq)) return null;
  hooks.activateAudioForSound();
  const event = { type: 'piano', freq: key.userData.freq, vel: 1, vibe: 3.5 };
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

  const guitarChord = GUITAR_KEY_CHORDS[e.code];
  if (guitarChord) {
    e.preventDefault();
    if (!e.repeat) {
      play.keyboardGuitarChord = guitarChord;
      syncChordPadHeld();
      // Same QWERTY row in both modes, but it means different things:
      //
      // Focused, it is *select-only*, matching the on-screen pad you are
      // looking at — the fretting hand chooses, Space strums (§ Guitar
      // performance mode's two-hand model).
      //
      // Unfocused, the key IS the play gesture: there is no visible pad to
      // read, so arming silently would look broken. Space still re-strums.
      if (!hooks.canPlayInstrument('guitar')) {
        fireGuitarStrum(0.85, 'bass-to-treble', null, null, true, { focusRequired: false });
        noteKeyboardJamActivity('guitar');
      }
    }
    return;
  }

  if (e.code in DRUM_KEYS) {
    if (e.repeat) return;
    e.preventDefault();
    playMusicalEvent({ type: 'drum', part: DRUM_KEYS[e.code], vel: 1, vibe: 4 });
    noteKeyboardJamActivity('drums');
    return;
  }

  if (/^Digit[1-8]$/.test(e.code)) {
    if (e.repeat || keyboardPianoNotes.has(e.code)) return;
    e.preventDefault();
    const idx = Number(e.code.slice(5)) - 1;
    const key = whiteKeys[idx];
    if (!key) return;
    keyboardPianoNotes.set(e.code, beginHeldPianoNote(key));
    noteKeyboardJamActivity('piano');
    return;
  }

  if (e.code === 'Space') {
    e.preventDefault();
    if (e.repeat) return;
    fireGuitarStrum(
      1,
      e.shiftKey ? 'treble-to-bass' : 'bass-to-treble',
      null,
      null,
      true,
      { focusRequired: false },
    );
    noteKeyboardJamActivity('guitar');
    return;
  }

  if (e.code in VOCAL_KEYS) {
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
  const guitarChord = GUITAR_KEY_CHORDS[e.code];
  if (guitarChord && play.keyboardGuitarChord === guitarChord) {
    play.keyboardGuitarChord = null;
    syncChordPadHeld();
    noteKeyboardJamActivity('guitar');
  }
  if (play.keyboardVocal?.code === e.code) {
    hooks.releaseKeyboardVocal();
  }
});

