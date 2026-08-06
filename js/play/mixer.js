// ============================================================
// SOUND MIXER + KEYBOARD VOCAL
// Per-instrument levels in the HUD, and the desktop vocal keys. Touching a
// fader is also the app's "sound is broken, fix it" affordance: it can rebuild
// a stalled audio context and restore what was playing.
// ============================================================
import { AudioEngine } from '../audio.js?v=20260806-18';
import { ui, audio, mic } from '../core/studio.js?v=20260806-18';
import { play } from './state.js?v=20260806-18';
import { addVibe, queuePriceChip, noteKeyboardJamActivity } from './vibe.js?v=20260806-18';
import {
  stampHeldLoopCaptureDuration,
  beginHeldLoopCapture,
  finishHeldLoopCapture,
} from './pads.js?v=20260806-18';
import { VOCAL_KEYS } from './piano-notes.js?v=20260806-18';

// Recovering audio has to re-arm whatever the visit had going; the intro flow
// owns those snapshots and main.js owns the jam gate.
let hooks = {
  activateAudioForSound: () => {},
  canKeyboardJamPlay: () => false,
  captureAudioRecoverySnapshot: () => null,
  restoreAfterAudioContextRebuild: () => {},
};
export function initMixer(next) {
  hooks = { ...hooks, ...next };
}

// ---- sound mixer (HUD) — per-instrument levels ----
export const soundMixer = document.getElementById('sound-mixer');
const soundRecoverBtn = document.getElementById('sound-recover-btn');
const soundFaders = [...(soundMixer?.querySelectorAll('input[data-bus]') || [])];

function silenceHeldVocal() {
  clearInterval(play.heldVocalPulseTimer);
  play.heldVocalPulseTimer = null;
  finishHeldLoopCapture();
  audio.stopVocal(play.heldVocal);
  play.heldVocalButton?.classList.remove('playing');
  play.heldVocal = null;
  play.heldVocalButton = null;
  play.heldVocalPointer = null;
  releaseKeyboardVocal();
}

export function releaseKeyboardVocal() {
  if (!play.keyboardVocal && !play.keyboardVocalPulseTimer) return;
  clearInterval(play.keyboardVocalPulseTimer);
  play.keyboardVocalPulseTimer = null;
  if (play.keyboardVocal) {
    finishHeldLoopCapture();
    audio.stopVocal(play.keyboardVocal.voice);
    noteKeyboardJamActivity('mic');
  }
  play.keyboardVocal = null;
}

export function beginKeyboardVocal(code) {
  const note = VOCAL_KEYS[code];
  if (!note || !hooks.canKeyboardJamPlay()) return false;
  clearInterval(play.heldVocalPulseTimer);
  play.heldVocalPulseTimer = null;
  if (play.heldVocal) {
    finishHeldLoopCapture();
    audio.stopVocal(play.heldVocal);
    play.heldVocalButton?.classList.remove('playing');
    play.heldVocal = null;
    play.heldVocalButton = null;
    play.heldVocalPointer = null;
  }
  releaseKeyboardVocal();
  hooks.activateAudioForSound();
  mic.sing();
  const voice = audio.startVocal(note.freq, note.vowel);
  play.heldLoopCapture = beginHeldLoopCapture(note.freq, note.vowel);
  play.keyboardVocal = { code, freq: note.freq, vowel: note.vowel, voice };
  addVibe(3, 'mic');
  queuePriceChip('mic');
  noteKeyboardJamActivity('mic');
  play.keyboardVocalPulseTimer = setInterval(() => {
    mic.sing();
    stampHeldLoopCaptureDuration();
  }, 120);
  return true;
}

export function closeSoundMixer() {
  if (!soundMixer || soundMixer.hidden) return;
  soundMixer.hidden = true;
  ui.el.soundBtn?.setAttribute('aria-expanded', 'false');
}

export function openSoundMixer() {
  if (!soundMixer) return;
  for (const fader of soundFaders) {
    fader.value = String(Math.round(
      ((audio.getLevel(fader.dataset.bus) ?? 1) / AudioEngine.BUS_LEVEL_MAX) * 100,
    ));
  }
  soundMixer.hidden = false;
  ui.el.soundBtn?.setAttribute('aria-expanded', 'true');
}

ui.el.soundBtn?.addEventListener('click', (event) => {
  event.stopPropagation();
  if (soundMixer?.hidden) openSoundMixer();
  else closeSoundMixer();
});

soundRecoverBtn?.addEventListener('click', async (event) => {
  if (event.isTrusted === false) return;
  event.preventDefault();
  event.stopPropagation();
  const defaultLabel = 'ТЕСТ ЗВУКУ';
  soundRecoverBtn.disabled = true;
  soundRecoverBtn.textContent = 'ЗАПУСК…';

  const generation = audio.contextGeneration;
  const snapshot = hooks.captureAudioRecoverySnapshot();
  audio.markForRecovery('manual-sound-test');

  try {
    const pending = audio.unlock();
    if (audio.contextGeneration !== generation) {
      hooks.restoreAfterAudioContextRebuild(snapshot);
    }
    const ready = await Promise.race([
      pending,
      new Promise((resolve) => setTimeout(() => resolve(false), 900)),
    ]);
    if (ready && audio.isRunning() && audio.testTone()) {
      ui.toast('Не чуєш мелодію? Вимкни беззвучний режим і натисни «ТЕСТ ЗВУКУ» ще раз.', 3600);
    } else {
      audio.markForRecovery('manual-sound-test-timeout');
      ui.toast('Торкнися «ТЕСТ ЗВУКУ» ще раз', 2200);
    }
  } catch (_) {
    audio.markForRecovery('manual-sound-test-error');
    ui.toast('Торкнися «ТЕСТ ЗВУКУ» ще раз', 2200);
  } finally {
    soundRecoverBtn.disabled = false;
    soundRecoverBtn.textContent = defaultLabel;
  }
});

for (const fader of soundFaders) {
  fader.addEventListener('pointerdown', (event) => event.stopPropagation());
  fader.addEventListener('input', () => {
    audio.setLevel(fader.dataset.bus, (Number(fader.value) / 100) * AudioEngine.BUS_LEVEL_MAX);
    if (fader.dataset.bus === 'mic' && Number(fader.value) <= 0) silenceHeldVocal();
  });
}

// Any pointer outside the mixer, Escape, or opening another modal dismisses it.
document.addEventListener('pointerdown', (event) => {
  if (!soundMixer || soundMixer.hidden) return;
  if (event.target.closest('.sound-wrap')) return;
  closeSoundMixer();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeSoundMixer();
});

const _uiOpen = ui.open.bind(ui);
ui.open = (...args) => {
  closeSoundMixer();
  return _uiOpen(...args);
};

