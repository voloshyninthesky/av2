// ============================================================
// CAMERA MODE PREFERENCE
// Two ways to watch the stage. **Не дуже** is the default: the original
// framed pursuit camera, which on a phone pans on one finger and scouts back
// to the mascot. **Вільна** is the opt-in — one pointer rotates on every
// device and the pitch opens far enough to read the stage from overhead and
// from behind the backdrop. Both keep the mascot in frame: the follow spring
// only translates the rig, so it never disturbs an orbit, and cutting it
// would strand a walking visitor off-camera.
//
// This file owns only the preference, its storage and the mixer control. The
// rig and the follow spring read the mode from here; what to re-apply when it
// changes is injected through onCameraModeChange, because `core/` must never
// import `view/`.
// ============================================================
const CAMERA_MODE_KEY = 'av2.camera.v1';
const CAMERA_MODES = new Set(['follow', 'free']);

let savedCameraMode = null;
try { savedCameraMode = localStorage.getItem(CAMERA_MODE_KEY); } catch (_) { /* storage is optional */ }
const queryCameraMode = new URLSearchParams(location.search).get('camera');
export let cameraMode = CAMERA_MODES.has(queryCameraMode)
  ? queryCameraMode
  : (CAMERA_MODES.has(savedCameraMode) ? savedCameraMode : 'follow');

/** The framed pursuit camera is the default; free orbit is opt-in and remembered. */
export const isFreeCamera = () => cameraMode === 'free';

const listeners = new Set();
export function onCameraModeChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const cameraButtons = [...document.querySelectorAll('[data-camera]')];

function syncCameraModeUi() {
  // `scout` is written by the drag handler while the pursuit camera is held
  // off; free mode has nothing to scout away from, so it owns the attribute.
  document.documentElement.dataset.cameraMode = cameraMode === 'free' ? 'free' : 'follow';
  for (const button of cameraButtons) {
    const on = button.dataset.camera === cameraMode;
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-checked', String(on));
  }
}

export function setCameraMode(mode, { persist = true } = {}) {
  if (!CAMERA_MODES.has(mode) || mode === cameraMode) return;
  cameraMode = mode;
  if (persist) {
    try { localStorage.setItem(CAMERA_MODE_KEY, cameraMode); } catch (_) { /* storage is optional */ }
  }
  syncCameraModeUi();
  // Unlike ГРАФІКА, a camera change needs no reload — the rig re-reads its
  // limits in place, so the switch is visible on the frame after the tap.
  for (const listener of listeners) listener(cameraMode);
}

for (const button of cameraButtons) {
  button.addEventListener('click', () => setCameraMode(button.dataset.camera));
}
syncCameraModeUi();
