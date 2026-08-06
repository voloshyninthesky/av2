// ============================================================
// MOBILE CONTROLS + PURSUIT CAMERA
// A floating joystick that spawns wherever the thumb lands, a context ГРАТИ
// button that plays whatever the mascot is standing next to, and a follow
// camera that keeps the mascot composed low-centre while looking slightly
// into the travel direction. Also owns walking off the stage lip: the fall,
// the fade, and the respawn.
// ============================================================
import * as THREE from 'three';
import { session } from '../core/session.js?v=20260806-16';
import { isMobileGameMode } from '../core/quality.js?v=20260806-16';
import { camera, controls } from './rig.js?v=20260806-16';
import {
  ui,
  stage,
  mascot,
  mascotLabel,
  mascotLabelY,
  applyMascotScale,
  mascotFallMeshes,
  mascotFallMaterialStates,
} from '../core/studio.js?v=20260806-16';
import { instrumentGroups, instrumentWorldPositions, instrumentView } from './instrument-presets.js?v=20260806-16';
import { leaveInstrumentView, requestInstrumentView } from './instrument-view.js?v=20260806-16';
import { mascotMove } from '../mascot/state.js?v=20260806-16';
import { setDancing } from '../mascot/pose.js?v=20260806-16';
import { configureWalkColliders, planMascotWalkRoute } from '../mascot/walk.js?v=20260806-16';
import { resyncLoopPlayback } from '../play/loop.js?v=20260806-16';
import { hideVocalPad, hideChordPad } from '../play/pads.js?v=20260806-16';

const mobileControls = document.getElementById('mobile-controls');
const moveZone = document.getElementById('move-zone');
const moveStick = document.getElementById('move-stick');
const moveThumb = document.getElementById('move-thumb');
const mobilePlay = document.getElementById('mobile-play');
const mobileExit = document.getElementById('mobile-exit');
const mobilePlayHint = document.getElementById('mobile-play-hint');
const MOBILE_PLAY_HINT_KEY = 'av2.mobile-play-hint.v2';
let lastMobilePlayPointerAt = -Infinity;

// Playing whatever is in reach runs through the stage's own trigger path.
let hooks = { playNearestInstrument: () => {} };
export function initMobileControls(next) {
  hooks = { ...hooks, ...next };
}

export const joystickInput = new THREE.Vector2();
export const cameraForwardXZ = new THREE.Vector3();
export const cameraRightXZ = new THREE.Vector3();
// Game-style pursuit camera: the rig keeps the mascot composed near the lower
// centre of the frame, looks slightly in the travel direction, and catches up
// without a frame-rate-dependent snap on both mobile and desktop.
export const mobileFollow = {
  desiredTarget: new THREE.Vector3(),
  delta: new THREE.Vector3(),
  previousMascotPosition: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  lookAhead: new THREE.Vector3(),
  desiredLookAhead: new THREE.Vector3(),
  initialized: false,
  scouting: false,
};
const MOBILE_FOLLOW_HEIGHT = 1.35;
const MOBILE_FOLLOW_DEPTH_OFFSET = -0.25;
const MOBILE_FOLLOW_MAX_LOOK_AHEAD = 0.82;
const MOBILE_FOLLOW_RESPONSE = 5.2;
const MOBILE_FOLLOW_IDLE_RESPONSE = 3.6;
let joystickPointer = null;
const walkColliderRoots = [
  ...Object.entries(instrumentGroups).map(([id, root]) => ({ id, root })),
  ...(stage.userData.walkColliderRoots || []),
];

export function resetMobileFollowCamera({ snap = false } = {}) {
  mobileFollow.previousMascotPosition.copy(mascot.group.position);
  mobileFollow.velocity.set(0, 0, 0);
  mobileFollow.lookAhead.set(0, 0, 0);
  mobileFollow.desiredLookAhead.set(0, 0, 0);
  mobileFollow.initialized = true;
  mobileFollow.scouting = false;
  if (snap) updateMobileFollowCamera(0, true);
}

export function updateMobileFollowCamera(dt, immediate = false) {
  if (session.flyT >= 0) {
    mobileFollow.initialized = false;
    return;
  }
  if (instrumentView.phase !== 'idle' && instrumentView.phase !== 'approaching') {
    // Focus cameras own the rig until the mascot returns to free movement.
    mobileFollow.initialized = false;
    return;
  }

  if (!mobileFollow.initialized) resetMobileFollowCamera();

  if (dt > 0) {
    mobileFollow.velocity
      .subVectors(mascot.group.position, mobileFollow.previousMascotPosition)
      .divideScalar(dt);
    // A short low-pass removes walk-bob/collision jitter from the look-ahead.
    const speed = Math.hypot(mobileFollow.velocity.x, mobileFollow.velocity.z);
    if (speed > 0.001) {
      const lookAhead = Math.min(
        MOBILE_FOLLOW_MAX_LOOK_AHEAD,
        (speed / mascotMove.speed) * MOBILE_FOLLOW_MAX_LOOK_AHEAD,
      );
      mobileFollow.desiredLookAhead
        .copy(mobileFollow.velocity)
        .setY(0)
        .setLength(lookAhead);
    } else {
      mobileFollow.desiredLookAhead.set(0, 0, 0);
    }
    mobileFollow.lookAhead.lerp(
      mobileFollow.desiredLookAhead,
      1 - Math.exp(-dt * 9),
    );
  }
  mobileFollow.previousMascotPosition.copy(mascot.group.position);

  mobileFollow.desiredTarget.set(
    mascot.group.position.x + mobileFollow.lookAhead.x,
    MOBILE_FOLLOW_HEIGHT,
    mascot.group.position.z + MOBILE_FOLLOW_DEPTH_OFFSET + mobileFollow.lookAhead.z,
  );
  // OrbitControls uses cursor as the centre of its target-radius clamp. Updating
  // it with the moving hero makes the scout range travel with the action.
  controls.cursor.copy(mobileFollow.desiredTarget);

  if (mobileFollow.scouting) {
    mobileFollow.previousMascotPosition.copy(mascot.group.position);
    return;
  }
  mobileFollow.delta.subVectors(mobileFollow.desiredTarget, controls.target);

  const distance = mobileFollow.delta.length();
  const moving = distance > 0.12 || joystickInput.lengthSq() > 0 || mascotMove.destination;
  const response = moving ? MOBILE_FOLLOW_RESPONSE : MOBILE_FOLLOW_IDLE_RESPONSE;
  // Large teleports/respawns catch up more firmly, while normal walking remains
  // soft. Exponential damping gives the same feel at 30 and 60 fps.
  const catchUp = 1 + Math.max(0, distance - 1.15) * 1.8;
  const alpha = immediate ? 1 : 1 - Math.exp(-Math.max(0, dt) * response * catchUp);
  mobileFollow.delta.multiplyScalar(alpha);
  controls.target.add(mobileFollow.delta);
  camera.position.add(mobileFollow.delta);
}


function placeFloatingStick(clientX, clientY) {
  const size = moveStick.offsetWidth || 108;
  const half = size * 0.55;
  const maxX = window.innerWidth * 0.52;
  const x = THREE.MathUtils.clamp(clientX, half, Math.max(half, maxX));
  const y = THREE.MathUtils.clamp(clientY, half, window.innerHeight - half);
  moveStick.classList.add('floating');
  moveStick.style.left = `${x}px`;
  moveStick.style.top = `${y}px`;
}

function resetStickHome() {
  moveStick.classList.remove('floating', 'engaged');
  moveStick.style.left = '';
  moveStick.style.top = '';
  moveThumb.style.transform = 'translate(-50%, -50%)';
}

function setJoystickFromPointer(event) {
  const rect = moveStick.getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  const maxRadius = rect.width * 0.33;
  const rawLength = Math.hypot(dx, dy);
  const clamped = Math.min(maxRadius, rawLength);
  const angle = Math.atan2(dy, dx);
  const visualX = Math.cos(angle) * clamped;
  const visualY = Math.sin(angle) * clamped;
  const strength = rawLength < maxRadius * 0.14
    ? 0
    : Math.min(1, (rawLength / maxRadius - 0.14) / 0.86);
  joystickInput.set(Math.cos(angle) * strength, Math.sin(angle) * strength);
  moveThumb.style.transform = `translate(-50%, -50%) translate(${visualX}px, ${visualY}px)`;
}

export function releaseMoveJoystick(event) {
  if (event && joystickPointer !== null && event.pointerId !== joystickPointer) return;
  joystickPointer = null;
  joystickInput.set(0, 0);
  resetStickHome();
}

function beginMoveJoystick(event) {
  if (!session.started || ui.modalOpen || mascotMove.fall) return;
  if (instrumentView.phase !== 'idle') return;
  event.preventDefault();
  controls.autoRotate = false;
  joystickPointer = event.pointerId;
  placeFloatingStick(event.clientX, event.clientY);
  moveStick.classList.add('engaged');
  (moveZone || moveStick).setPointerCapture?.(event.pointerId);
  setJoystickFromPointer(event);
}

const moveSurface = moveZone || moveStick;
moveSurface?.addEventListener('pointerdown', beginMoveJoystick);
moveSurface?.addEventListener('pointermove', (event) => {
  if (event.pointerId === joystickPointer) setJoystickFromPointer(event);
});
moveSurface?.addEventListener('pointerup', releaseMoveJoystick);
moveSurface?.addEventListener('pointercancel', releaseMoveJoystick);
moveSurface?.addEventListener('lostpointercapture', releaseMoveJoystick);

mobileExit?.addEventListener('pointerdown', (event) => {
  // Ignore a ghost click-through from the ГРАТИ tap that just started approach.
  if (performance.now() - lastMobilePlayPointerAt < 500) {
    event.preventDefault();
    return;
  }
  mobileExit.classList.add('pressed');
});
mobileExit?.addEventListener('click', (event) => {
  if (performance.now() - lastMobilePlayPointerAt < 500) {
    event.preventDefault();
    return;
  }
  leaveInstrumentView();
  navigator.vibrate?.(18);
});
for (const eventName of ['pointerup', 'pointercancel', 'pointerleave']) {
  mobileExit?.addEventListener(eventName, () => mobileExit.classList.remove('pressed'));
}

// Instruments plus whatever the stage dressing registered (speakers, wedges).
configureWalkColliders({
  roots: [
    ...Object.entries(instrumentGroups).map(([id, root]) => ({ id, root })),
    ...(stage.userData.walkColliderRoots || []),
  ],
  clampPoint: clampMascotPoint,
});

export function syncMobileInstrumentChrome() {
  // Show ✕ only once seated (entering/focused). Revealing it during approaching
  // would put it under the same finger that just pressed ГРАТИ, and the
  // synthesized click would instantly cancel the approach.
  const showExit = instrumentView.phase === 'entering' || instrumentView.phase === 'focused';
  if (mobileExit) mobileExit.hidden = !showExit;
}

export function clampMascotPoint(point) {
  point.x = THREE.MathUtils.clamp(point.x, mascotMove.travelBounds.minX, mascotMove.travelBounds.maxX);
  point.z = THREE.MathUtils.clamp(point.z, mascotMove.travelBounds.minZ, mascotMove.travelBounds.maxZ);
  point.y = 0;
  return point;
}

export function setMascotDestination(point) {
  if (mascotMove.fall || instrumentView.phase !== 'idle') return;
  mascotMove.destinationKind = null;
  const route = planMascotWalkRoute(mascot.group.position, point);
  mascotMove.waypoints = route;
  mascotMove.destination = mascotMove.waypoints.shift() || null;
  controls.autoRotate = false;
}

export function beginMascotFall(direction) {
  if (mascotMove.fall) return;
  setDancing(false);
  leaveInstrumentView({ immediate: true, offerPriceChip: false });
  mascotMove.destination = null;
  mascotMove.destinationKind = null;
  mascotMove.waypoints.length = 0;
  mascotMove.keys.clear();
  releaseMoveJoystick();
  ui.hideChip();
  hideVocalPad();
  hideChordPad();
  mascotMove.fall = {
    t: 0,
    duration: 2.7,
    velocity: direction.clone().setY(0).normalize().multiplyScalar(0.48),
    cameraPosition: camera.position.clone(),
    cameraTarget: controls.target.clone(),
    controlsEnabled: controls.enabled,
    autoRotate: controls.autoRotate,
  };
  controls.enabled = false;
  controls.autoRotate = false;
  for (const { object } of mascotFallMeshes) object.renderOrder = 18;
  for (const material of mascotFallMaterialStates.keys()) {
    material.transparent = true;
    material.opacity = 0.92;
    material.depthTest = false;
    material.depthWrite = false;
    material.needsUpdate = true;
  }
  mascot.group.rotation.x = 0;
  navigator.vibrate?.([45, 35, 70]);
}

export function respawnMascot() {
  const completedFall = mascotMove.fall;
  mascotMove.fall = null;
  mascot.group.position.copy(mascotMove.spawn);
  applyMascotScale();
  mascot.group.rotation.x = 0;
  mascot.group.rotation.z = 0;
  mascot.torso.rotation.z = 0;
  mascot.head.rotation.z = 0;
  mascot.legL.rotation.x = 0;
  mascot.legR.rotation.x = 0;
  mascot.armL.rotation.x = 0;
  mascot.armR.rotation.x = 0;
  for (const { object, renderOrder } of mascotFallMeshes) object.renderOrder = renderOrder;
  for (const [material, state] of mascotFallMaterialStates) {
    material.transparent = state.transparent;
    material.opacity = state.opacity;
    material.depthTest = state.depthTest;
    material.depthWrite = state.depthWrite;
    material.needsUpdate = true;
  }
  if (completedFall?.cameraPosition && completedFall?.cameraTarget) {
    camera.position.copy(completedFall.cameraPosition);
    controls.target.copy(completedFall.cameraTarget);
    controls.enabled = completedFall.controlsEnabled;
    controls.autoRotate = completedFall.autoRotate;
    camera.lookAt(controls.target);
    controls.update();
  }
  if (mascotLabel) {
    mascotLabel.visible = true;
    mascotLabel.position.set(mascotMove.spawn.x, mascotLabelY(), mascotMove.spawn.z);
  }
  resetMobileFollowCamera({ snap: true });
  // A playing loop may need re-queuing after the fall. Do not claim an audio
  // session when the visitor has not produced site audio.
  resyncLoopPlayback();
  ui.toast('Не втечеш ;)', 2200);
}

export function walkMascotToInstrument(kind) {
  requestInstrumentView(kind);
}

function nearestInstrument() {
  let nearest = null;
  for (const [kind, group] of Object.entries(instrumentGroups)) {
    const position = instrumentWorldPositions[kind];
    group.getWorldPosition(position);
    const distance = Math.hypot(position.x - mascot.group.position.x, position.z - mascot.group.position.z);
    if (!nearest || distance < nearest.distance) nearest = { kind, distance, position };
  }
  return nearest;
}

const mobileInstrumentReach = () => 2.36;

export function playNearestInstrument() {
  if (!session.started || ui.modalOpen || mascotMove.fall) return false;
  const nearest = nearestInstrument();
  if (!nearest || nearest.distance > mobileInstrumentReach()) {
    if (!isMobileGameMode()) ui.toast('Підійди ближче до інструмента', 1800);
    return false;
  }
  const look = new THREE.Vector3().subVectors(nearest.position, mascot.group.position);
  mascot.group.rotation.y = Math.atan2(look.x, look.z);
  const alreadyInPosition = instrumentView.kind === nearest.kind
    && ['approaching', 'entering', 'focused'].includes(instrumentView.phase);
  if (alreadyInPosition) return true;
  requestInstrumentView(nearest.kind);
  return true;
}

export function updateMobilePlayAvailability() {
  if (!isMobileGameMode()) return;
  const now = performance.now();
  if (now - updateMobilePlayAvailability.lastCheck < 90) return;
  updateMobilePlayAvailability.lastCheck = now;
  const nearest = session.started && !ui.modalOpen && !mascotMove.fall ? nearestInstrument() : null;
  const available = Boolean(nearest && nearest.distance <= mobileInstrumentReach());
  const label = available
    ? `Грати на інструменті: ${nearest.kind}`
    : 'Підійди ближче до інструмента щоб заграти';
  if (
    updateMobilePlayAvailability.available === available
    && updateMobilePlayAvailability.label === label
    && updateMobilePlayAvailability.started === session.started
  ) return;
  updateMobilePlayAvailability.available = available;
  updateMobilePlayAvailability.label = label;
  updateMobilePlayAvailability.started = session.started;
  mobilePlay.disabled = false;
  mobilePlay.classList.toggle('is-disabled', !available);
  mobilePlay.setAttribute('aria-disabled', available ? 'false' : 'true');
  mobilePlay.setAttribute('aria-label', label);
}
updateMobilePlayAvailability.lastCheck = -Infinity;
updateMobilePlayAvailability.available = null;
updateMobilePlayAvailability.label = '';
updateMobilePlayAvailability.started = null;

function showMobilePlayHintOnce() {
  let shown = false;
  try {
    shown = localStorage.getItem(MOBILE_PLAY_HINT_KEY) === '1';
    if (!shown) localStorage.setItem(MOBILE_PLAY_HINT_KEY, '1');
  } catch { /* storage is optional */ }
  if (shown || !mobilePlayHint) return;
  mobilePlayHint.hidden = false;
  clearTimeout(showMobilePlayHintOnce.timer);
  showMobilePlayHintOnce.timer = setTimeout(() => { mobilePlayHint.hidden = true; }, 3200);
}

export function mobilePlayIsUnavailable() {
  return mobilePlay.getAttribute('aria-disabled') === 'true';
}

mobilePlay.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (mobilePlayIsUnavailable()) {
    showMobilePlayHintOnce();
    return;
  }
  mobilePlay.classList.add('pressed');
  lastMobilePlayPointerAt = performance.now();
  playNearestInstrument();
  navigator.vibrate?.(22);
});
// Keyboard / accessibility activation only — pointer path already ran on pointerdown.
mobilePlay.addEventListener('click', (event) => {
  if (performance.now() - lastMobilePlayPointerAt < 700) {
    event.preventDefault();
    return;
  }
  if (mobilePlayIsUnavailable()) {
    showMobilePlayHintOnce();
    return;
  }
  playNearestInstrument();
  navigator.vibrate?.(22);
});
for (const eventName of ['pointerup', 'pointercancel', 'pointerleave']) {
  mobilePlay.addEventListener(eventName, () => mobilePlay.classList.remove('pressed'));
}

