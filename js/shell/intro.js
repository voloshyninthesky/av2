// ============================================================
// INTRO / START FLOW + AUDIO RECOVERY
// The fly-in from the wide stage shot to the playing position, the one-time
// onboarding nudge toward the microphone, and the audio unlock. Mobile
// browsers can tear an audio context down while backgrounded, so a rebuild
// captures what was sounding and restores it afterwards.
// ============================================================
import { session, easeInOut } from '../core/session.js?v=20260813-20';
import { params, prefersReducedMotion } from '../core/quality.js?v=20260813-20';
import { isFreeCamera } from '../core/camera-mode.js?v=20260813-20';
import { camera, controls, CAM_START, CAM_END, TARGET } from '../view/rig.js?v=20260813-20';
import { ui, audio, mic, mascot } from '../core/studio.js?v=20260813-20';
import { instrumentView } from '../view/instrument-presets.js?v=20260813-20';
import { glowMesh, unglowMesh } from '../view/emissive.js?v=20260813-20';
import { mobileFollow } from '../view/mobile-controls.js?v=20260813-20';
import { mascotMove } from '../mascot/state.js?v=20260813-20';
import { giftPending } from '../mascot/reveal.js?v=20260813-20';
import { play } from '../play/state.js?v=20260813-20';
import { vowelAt } from '../play/voice.js?v=20260813-20';
import {
  LOOP_MAX_SECONDS,
  loop,
  positiveModulo,
  resyncLoopPlayback,
  finishBaseLoopRecording,
} from '../play/loop.js?v=20260813-20';
import { clearGuitarInteractionState } from '../play/chord-wheel.js?v=20260813-20';
import { resyncGroove } from '../play/groove.js?v=20260813-20';
import { releaseAllHeldPianoNotes } from '../play/piano-notes.js?v=20260813-20';
import { releaseKeyboardVocal } from '../play/mixer.js?v=20260813-20';
import { trackOnce } from '../core/analytics.js?v=20260813-20';

const mobileControls = document.getElementById('mobile-controls');

// Starting the experience takes over the viewport and the render loop, both of
// which main.js owns; `hovered` is the stage's own hover tracking.
let hooks = {
  syncViewportMeta: () => {},
  syncRendererToWindow: () => {},
  resetBrowserPageZoom: () => {},
  hoveredMesh: () => null,
};
export function initIntro(next) {
  hooks = { ...hooks, ...next };
}

export const FLY_DUR = 2.6;

const enterBtn = document.getElementById('enter-btn');
const enterLabel = document.getElementById('enter-label');
const intro = document.getElementById('intro');
const onboardEl = document.getElementById('onboard');
const onboardText = document.getElementById('onboard-text');
const onboardOk = document.getElementById('onboard-ok');
const ONBOARD_KEY = 'av2.onboard.v2';
const INTRO_SESSION_KEY = 'av2.intro.v2';
export const onboard = { active: false, pulsing: false };

function markIntroSeen() {
  try { sessionStorage.setItem(INTRO_SESSION_KEY, '1'); } catch { /* storage is optional */ }
}

export function shouldSkipIntro() {
  if (params.has('nointro')) return true;
  const navigation = performance.getEntriesByType?.('navigation')[0];
  if (navigation?.type === 'reload') return true;
  try { return sessionStorage.getItem(INTRO_SESSION_KEY) === '1'; } catch { return false; }
}

function shouldOfferOnboard() {
  if (new URLSearchParams(location.search).has('skiponboard')) return false;
  try { return !localStorage.getItem(ONBOARD_KEY); } catch { return true; }
}

function clearOnboardPulse() {
  if (!onboard.pulsing) return;
  onboard.pulsing = false;
  mic.group.traverse((o) => {
    if (o.isMesh) unglowMesh(o);
  });
}

// ЗРОЗУМІЛО is the only way out: the tip is the last step of the first run, and
// a visitor who walks or plays past it would never have read it. Nothing else —
// walking, playing, Esc, a tap on the card — dismisses it.
function finishOnboard() {
  if (!onboard.active) return;
  onboard.active = false;
  markOnboardSeen();
  if (onboardEl) onboardEl.hidden = true;
  clearOnboardPulse();
}

// The gift card says what the tip used to say, so its ЗРОЗУМІЛО closes the first
// run just as the tip's does. Shared so there is one definition of "seen".
export function markOnboardSeen() {
  try { localStorage.setItem(ONBOARD_KEY, '1'); } catch { /* ignore */ }
}

function showOnboardTip() {
  onboard.active = true;
  onboardText.textContent = 'Вітаємо на сцені Art Vibe! Сьогодні вона повністю твоя. По ній можна ходити, а на інструментах — грати.';
  onboardEl.hidden = false;
}

// First run is one step now: the gift introduces the character *and* says what
// the stage lets you do with it. Two cards in a row, the second repeating the
// first, was one beat too many for a visitor who has not touched anything yet.
//
// The standalone tip survives for the one case the gift cannot cover: a visitor
// who already has a character but never acknowledged the text — they closed the
// card with ✕ or Esc rather than ЗРОЗУМІЛО. The gates stay separate for that
// reason. `giftPending` is resolved at boot by reveal.js, which needs the same
// answer before the first frame to hide the unearned mascot; one source, so the
// stage it prepares and the sequence run here can never disagree.
export function startOnboard() {
  if (giftPending) {
    requestAnimationFrame(() => ui.open('gift'));
    return;
  }
  if (shouldOfferOnboard() && onboardEl) requestAnimationFrame(showOnboardTip);
}

export function updateOnboardPulse(t) {
  if (!onboard.active || prefersReducedMotion.matches) return;
  const hovered = hooks.hoveredMesh();
  if (hovered && hovered.userData.instrument !== 'mic') return;
  const intensity = 0.12 + 0.22 * (0.5 + 0.5 * Math.sin(t * 2.6));
  mic.group.traverse((o) => {
    if (o.isMesh) glowMesh(o, 0x9E33CA, intensity);
  });
  onboard.pulsing = true;
}

onboardOk?.addEventListener('click', finishOnboard);

export function startExperience() {
  if (session.started) return;
  session.started = true;
  trackOnce('stage-enter');
  markIntroSeen();
  document.documentElement.classList.add('stage-live');
  hooks.syncViewportMeta();
  intro.classList.add('gone');
  mobileControls.classList.add('active');
  session.flyT = 0;
  hooks.resetBrowserPageZoom();
  hooks.syncRendererToWindow();
}

export function startWithoutIntro() {
  if (session.started) return;
  session.started = true;
  trackOnce('stage-enter');
  markIntroSeen();
  document.documentElement.classList.add('stage-live');
  hooks.syncViewportMeta();
  intro.classList.add('gone');
  mobileControls.classList.add('active');
  camera.position.copy(CAM_END);
  camera.lookAt(TARGET);
  controls.enabled = true;
  ui.showHUD();
  startOnboard();
  hooks.resetBrowserPageZoom();
  hooks.syncRendererToWindow();
}

enterBtn.addEventListener('click', startExperience);
window.addEventListener('av2:modal', () => hooks.syncViewportMeta());

// Keep WebAudio alive across backgrounding / flaky in-app browsers (Telegram).
// Stuck "suspended" contexts are the usual cause of silent sessions until refresh.
export function captureAudioRecoverySnapshot() {
  const previousTime = audio.ctx?.currentTime;
  if (!Number.isFinite(previousTime)) return null;
  return {
    previousTime,
    recordingElapsed: loop.state === 'recording'
      ? Math.max(0, previousTime - loop.recordStartedAt)
      : null,
    loopOffset: loop.duration > 0 && (loop.state === 'playing' || loop.state === 'overdubbing')
      ? positiveModulo(previousTime - loop.epoch, loop.duration)
      : null,
    heldCaptureElapsed: play.heldLoopCapture
      ? Math.max(0, previousTime - play.heldLoopCapture.startedAt)
      : null,
  };
}

export function restoreAfterAudioContextRebuild(snapshot) {
  if (!snapshot || !audio.ctx) return;
  const now = audio.ctx.currentTime;
  if (snapshot.recordingElapsed !== null) {
    const elapsed = Math.min(LOOP_MAX_SECONDS, snapshot.recordingElapsed);
    loop.recordStartedAt = now - elapsed;
    clearTimeout(loop.autoCloseTimer);
    loop.autoCloseTimer = setTimeout(
      () => finishBaseLoopRecording(true),
      Math.max(0, LOOP_MAX_SECONDS - elapsed) * 1000,
    );
  }
  if (snapshot.loopOffset !== null) {
    loop.epoch = now - snapshot.loopOffset;
  }
  if (play.heldLoopCapture && snapshot.heldCaptureElapsed !== null) {
    play.heldLoopCapture.startedAt = now - snapshot.heldCaptureElapsed;
  }
  // A rebuild has to hand back the note that was sounding, and for the ribbon
  // that means where the glide had reached — not where the phrase started.
  // `heldVocalNote` is kept live for exactly this.
  if (play.heldVocal && play.heldVocalNote) {
    play.heldVocal = audio.startVocal(
      play.heldVocalNote.freq, vowelAt(play.heldVocalNote.vowel),
    );
  } else if (play.keyboardVocal) {
    play.keyboardVocal.voice = audio.startVocal(
      play.keyboardVocal.freq, vowelAt(play.keyboardVocal.vowel),
    );
  }
  resyncLoopPlayback();
}

export function activateAudioForSound({ allowRecovery = true } = {}) {
  const generation = audio.contextGeneration;
  const snapshot = captureAudioRecoverySnapshot();
  let pending;
  if (allowRecovery) {
    pending = audio.unlock();
  } else {
    audio.init();
    pending = audio.resume();
  }
  if (audio.contextGeneration !== generation) {
    restoreAfterAudioContextRebuild(snapshot);
  }
  return pending;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (loop.state === 'playing' || loop.state === 'overdubbing') resyncLoopPlayback();
    // A hidden tab clamps setInterval to ~1 Hz, so a 0.12 s look-ahead drops
    // almost every groove hit while the tab is away. Re-pin the bar on return.
    resyncGroove();
  }
  if (document.visibilityState === 'hidden') {
    audio.markForRecovery('visibility-hidden');
    releaseAllHeldPianoNotes();
    releaseKeyboardVocal();
    clearGuitarInteractionState();
    audio.muteGuitar();
  }
});
window.addEventListener('blur', () => {
  audio.markForRecovery('window-blur');
  releaseAllHeldPianoNotes();
  releaseKeyboardVocal();
  clearGuitarInteractionState();
  audio.muteGuitar();
});
window.addEventListener('pagehide', () => audio.markForRecovery('pagehide'));
window.addEventListener('pageshow', () => {
  if (audio.ctx) {
    // BFCache/WebView restores do not always deliver the expected pagehide or
    // context state transition. Treat the route as stale even if it says running.
    audio.markForRecovery('pageshow');
    if (loop.state === 'playing' || loop.state === 'overdubbing') {
      audio.resume();
      resyncLoopPlayback();
    }
  }
});

// Scouting is the pursuit camera's "held off while you drag" state. The free
// camera is never holding anything off, so it keeps its own `cameraMode` and
// stays out of this entirely.
controls.addEventListener('start', () => {
  controls.autoRotate = false;
  if (isFreeCamera()) return;
  if (instrumentView.phase === 'idle' || instrumentView.phase === 'approaching') {
    mobileFollow.scouting = true;
    document.documentElement.dataset.cameraMode = 'scout';
  }
});
controls.addEventListener('end', () => {
  if (mobileFollow.scouting) {
    mobileFollow.scouting = false;
    document.documentElement.dataset.cameraMode = 'follow';
  }
});

// ticker
(() => {
  const unit = 'СЦЕНА • МУЗИКА • ВАЙБ • ВОКАЛ • ГІТАРА • БАРАБАНИ • ФОРТЕПІАНО • ';
  document.getElementById('ticker-track').textContent = unit.repeat(8);
})();
