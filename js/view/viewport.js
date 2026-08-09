// ============================================================
// VIEWPORT + BROWSER-ZOOM GUARDS
// Keeps the render target matched to a viewport that mobile browsers resize
// out from under us, and refits any active close-up so a rotation or an
// address bar sliding away never leaves the play surface off-screen. The zoom
// guards let pinch work where it helps (inspecting an instrument) while
// blocking the double-tap zoom that would otherwise eat a drum hit.
// ============================================================
import { session } from '../core/session.js?v=20260809-06';
import { prefersReducedMotion, isLowEndMobileGameMode } from '../core/quality.js?v=20260809-06';
import {
  renderer,
  camera,
  controls,
  fitCameraToViewport,
  applyMobileOrbitPolicy,
} from './rig.js?v=20260809-06';
import { ui } from '../core/studio.js?v=20260809-06';
import { invalidateSlideshowNavLayout } from '../scene/slideshow.js?v=20260809-06';
import { INSTRUMENT_VIEW_PRESETS, instrumentView } from './instrument-presets.js?v=20260809-06';
import { instrumentViewFrame } from './focus-frame.js?v=20260809-06';
import { applyFocusedControlLimits, syncControlsAtInstrumentFrame } from './instrument-view.js?v=20260809-06';
import { syncMobileInstrumentChrome } from './mobile-controls.js?v=20260809-06';
import { mascotEditor, queueMascotRefit } from '../mascot/editor.js?v=20260809-06';

// Resizing has to re-post the composer and re-sync chrome that main.js owns.
let hooks = {
  syncInstrumentExposure: () => {},
  resizeComposer: () => {},
};
export function initViewport(next) {
  hooks = { ...hooks, ...next };
}

const VIEWPORT_META_BASE = 'width=device-width, initial-scale=1, maximum-scale=5, minimum-scale=1, user-scalable=yes, viewport-fit=cover';
const VIEWPORT_META_GAME = 'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover';
let viewportResetTimer = 0;

export function syncViewportMeta() {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  // Allow pinch only inside readable modals; lock zoom on the live stage.
  meta.setAttribute('content', (session.started && !ui.modalOpen) ? VIEWPORT_META_GAME : VIEWPORT_META_BASE);
}

export function resetBrowserPageZoom() {
  if (ui.modalOpen) return;
  const vv = window.visualViewport;
  if (!vv || Math.abs(vv.scale - 1) < 0.01) {
    syncViewportMeta();
    return;
  }
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  meta.setAttribute('content', 'width=device-width, initial-scale=1.0001, maximum-scale=1.0001, user-scalable=no, viewport-fit=cover');
  clearTimeout(viewportResetTimer);
  viewportResetTimer = window.setTimeout(() => {
    syncViewportMeta();
    syncRendererToWindow();
  }, 16);
}

export function refitActiveInstrumentView() {
  const kind = instrumentView.kind;
  if (!kind || !['entering', 'focused'].includes(instrumentView.phase)) return;
  const preset = INSTRUMENT_VIEW_PRESETS[kind];
  if (!preset) return;
  const frame = instrumentViewFrame(kind, preset);
  const nextPosition = frame.position;
  const nextTarget = frame.target;
  hooks.syncInstrumentExposure();
  if (instrumentView.phase === 'entering' && instrumentView.transition) {
    instrumentView.transition.toPosition.copy(nextPosition);
    instrumentView.transition.toTarget.copy(nextTarget);
    return;
  }
  if ((kind === 'piano' || kind === 'guitar') && !prefersReducedMotion.matches) {
    controls.enabled = false;
    instrumentView.refit = {
      elapsed: 0,
      duration: 0.22,
      fromPosition: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPosition: nextPosition.clone(),
      toTarget: nextTarget.clone(),
    };
    return;
  }
  instrumentView.refit = null;
  camera.position.copy(nextPosition);
  controls.target.copy(nextTarget);
  applyFocusedControlLimits();
  syncControlsAtInstrumentFrame(nextPosition, nextTarget);
  controls.enabled = true;
}

export function syncRendererToWindow() {
  fitCameraToViewport();
  applyMobileOrbitPolicy();
  renderer.shadowMap.enabled = !isLowEndMobileGameMode();
  document.documentElement.dataset.shadows = renderer.shadowMap.enabled ? 'on' : 'off';
  invalidateSlideshowNavLayout();
  syncMobileInstrumentChrome();
  if (instrumentView.home && instrumentView.phase !== 'idle') {
    instrumentView.home.maxDistance = controls.maxDistance;
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
  hooks.resizeComposer();
  refitActiveInstrumentView();
  if (mascotEditor.active) queueMascotRefit();
}

// Pedal / pads / HUD sit above the canvas. preventDefault on a 2nd-finger
// touchstart suppresses that finger's pointer events — so never claim multitouch
// when any active touch is on UI chrome (loop pedal + drum must work together).
const UI_TOUCH_CHROME = '#loop-pedal, #vocal-pad, #chord-pad, #mobile-controls, #mobile-exit, #hud, #onboard, #toast, #chip, .overlay';

export function isUiChromeElement(el) {
  return Boolean(el?.closest?.(`${UI_TOUCH_CHROME}, .panel, input, textarea, [contenteditable="true"]`));
}

function touchListHitsChrome(touchList) {
  if (!touchList?.length) return false;
  for (let i = 0; i < touchList.length; i++) {
    const t = touchList[i];
    if (isUiChromeElement(document.elementFromPoint(t.clientX, t.clientY))) return true;
  }
  return false;
}

export function eventInvolvesUiChrome(event) {
  return isUiChromeElement(event.target)
    || touchListHitsChrome(event.touches)
    || touchListHitsChrome(event.changedTouches);
}

export function isLiveStageZoomLocked() {
  return session.started && !ui.modalOpen;
}

export function blockStageBrowserPageZoom(event) {
  const zoomLocked = isLiveStageZoomLocked();
  const touchCount = event.touches?.length || 0;
  // Do not claim a UI chrome touchstart: on mobile Safari that can suppress a
  // second control's pointer events. The pinch is blocked on touchmove instead,
  // which covers joystick + +/- without stealing either control's tap.
  if (zoomLocked && event.type === 'touchmove' && touchCount >= 2 && event.cancelable) {
    event.preventDefault();
    return;
  }
  if (eventInvolvesUiChrome(event)) return;
  const inTelegram = document.documentElement.classList.contains('telegram-webview');
  // Telegram: claim single-finger stage drags so the shell doesn't treat them
  // as dismiss / back gestures. Live-stage multi-touch is handled above.
  if (inTelegram && event.cancelable) {
    if (event.type === 'touchmove' || (event.touches && event.touches.length >= 2)) {
      event.preventDefault();
      return;
    }
  }
  if (!zoomLocked) return;
  if (touchCount >= 2 && event.cancelable) event.preventDefault();
}
document.addEventListener('touchstart', blockStageBrowserPageZoom, { passive: false, capture: true });
document.addEventListener('touchmove', blockStageBrowserPageZoom, { passive: false, capture: true });
for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(name, (event) => {
    // Safari emits gesture* even with user-scalable=no. Never exempt HUD
    // controls here: simultaneous joystick + zoom-button touches are a pinch.
    if (isLiveStageZoomLocked() && event.cancelable) event.preventDefault();
  }, { passive: false, capture: true });
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    resetBrowserPageZoom();
    syncRendererToWindow();
  });
  window.visualViewport.addEventListener('scroll', resetBrowserPageZoom);
  window.visualViewport.addEventListener('scroll', () => {
    if (mascotEditor.active) queueMascotRefit();
  });
}

