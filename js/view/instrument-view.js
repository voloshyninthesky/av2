// ============================================================
// INSTRUMENT FOCUS VIEW
// Owns the trip in and out of an instrument close-up: walk the mascot over,
// blend it into the solved performance pose, fly the camera to the measured
// frame, and hand orbit control back with limits that suit the subject. The
// hooks it calls back into (pads, held notes, price chips) are injected so
// this module stays downstream of the features it interrupts.
// ============================================================
import * as THREE from 'three';
import { session, easeInOut } from '../core/session.js?v=20260831-01';
import { isMobileGameMode, prefersReducedMotion } from '../core/quality.js?v=20260831-01';
import {
  camera,
  controls,
  FOCUSED_MIN_DISTANCE,
  applyMobileOrbitPolicy,
} from './rig.js?v=20260831-01';
import { ui, audio, mascot, guitar } from '../core/studio.js?v=20260831-01';
import {
  INSTRUMENT_VIEW_PRESETS,
  instrumentView,
  instrumentLocalToWorld,
} from './instrument-presets.js?v=20260831-01';
import { instrumentViewFrame } from './focus-frame.js?v=20260831-01';
import { mascotMove } from '../mascot/state.js?v=20260831-01';
import {
  resetMascotPose,
  captureMascotInstrumentPose,
  applyMascotInstrumentPose,
  interpolateMascotInstrumentPose,
  createPianoMascotPose,
  createGuitarMascotPose,
  setDancing,
  poseMascotAtInstrument,
} from '../mascot/pose.js?v=20260831-01';
import {
  projectMascotToWalkablePoint,
  planMascotWalkRoute,
  nearestInstrumentWalkPoint,
} from '../mascot/walk.js?v=20260831-01';


// Entering or leaving a close-up interrupts whatever else was mid-gesture.
// main.js supplies those teardowns so this module does not have to import the
// play features that sit downstream of it.
let hooks = {
  setInstrumentViewPhase: () => {},
  releaseAllHeldPianoNotes: () => {},
  clearGuitarInteractionState: () => {},
  releaseMoveJoystick: () => {},
  resetMobileFollowCamera: () => {},
  flushPendingPriceChip: () => {},
};
export function initInstrumentView(next) {
  hooks = { ...hooks, ...next };
}

function captureInstrumentViewHome() {
  return {
    position: camera.position.clone(),
    target: controls.target.clone(),
    minDistance: controls.minDistance,
    maxDistance: controls.maxDistance,
    minPolarAngle: controls.minPolarAngle,
    maxPolarAngle: controls.maxPolarAngle,
    minAzimuthAngle: controls.minAzimuthAngle,
    maxAzimuthAngle: controls.maxAzimuthAngle,
  };
}

function restoreInstrumentControlLimits(home = instrumentView.home) {
  if (!home) return;
  controls.minDistance = home.minDistance;
  controls.maxDistance = home.maxDistance;
  controls.minPolarAngle = home.minPolarAngle;
  controls.maxPolarAngle = home.maxPolarAngle;
  controls.minAzimuthAngle = home.minAzimuthAngle;
  controls.maxAzimuthAngle = home.maxAzimuthAngle;
}

export function applyFocusedControlLimits() {
  controls.enableRotate = true;
  controls.enablePan = false;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.maxTargetRadius = Infinity;
  controls.minDistance = FOCUSED_MIN_DISTANCE;
  controls.maxDistance = isMobileGameMode() ? 5.5 : 4.4;
  controls.minPolarAngle = 0.42;
  controls.maxPolarAngle = 1.48;
  if (instrumentView.kind === 'piano') {
    const offset = camera.position.clone().sub(controls.target);
    const distance = Math.max(0.001, offset.length());
    const azimuth = Math.atan2(offset.x, offset.z);
    const polar = Math.acos(THREE.MathUtils.clamp(offset.y / distance, -1, 1));
    // The opening frame is already zoomed in, so keep real "+" headroom below
    // it and enough "−" range to recover the full uncropped keybed.
    controls.minDistance = Math.max(FOCUSED_MIN_DISTANCE, distance * 0.56);
    controls.maxDistance = Math.max(controls.minDistance + 0.2, distance * 1.72);
    // Keep the measured distance envelope, but leave horizontal orbit free so
    // the focused frame remains a starting composition rather than a lock.
    // The polar floor must sit below the fitted ~72° pitch or re-enabling
    // OrbitControls would snap the first frame.
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.minPolarAngle = Math.max(0.14, polar - 0.12);
    controls.maxPolarAngle = Math.min(1.42, polar + 0.12);
  } else if (instrumentView.kind === 'guitar') {
    // Same policy as piano: keep the fitted distance/pitch envelope so the
    // strings stay readable, leave horizontal orbit free.
    const offset = camera.position.clone().sub(controls.target);
    const distance = Math.max(0.001, offset.length());
    const polar = Math.acos(THREE.MathUtils.clamp(offset.y / distance, -1, 1));
    controls.minDistance = Math.max(FOCUSED_MIN_DISTANCE, distance * 0.56);
    controls.maxDistance = Math.max(controls.minDistance + 0.2, distance * 1.75);
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.minPolarAngle = Math.max(0.3, polar - 0.12);
    controls.maxPolarAngle = Math.min(1.45, polar + 0.12);
  } else {
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
  }
}

export function syncControlsAtInstrumentFrame(position, target) {
  const damping = controls.enableDamping;
  controls.enableDamping = false;
  camera.position.copy(position);
  controls.target.copy(target);
  // Flush a stale damped orbit delta, then restore and synchronize the exact
  // transition endpoint so the first enabled frame cannot visibly snap.
  controls.update();
  camera.position.copy(position);
  controls.target.copy(target);
  controls.update();
  controls.enableDamping = damping;
}

function startInstrumentCameraTransition(
  phase,
  kind,
  position,
  target,
  duration,
  { mascotPose = null, guitarBlend = null } = {},
) {
  controls.autoRotate = false;
  controls.enabled = false;
  instrumentView.refit = null;
  instrumentView.transition = {
    elapsed: 0,
    duration,
    fromPosition: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPosition: position.clone(),
    toTarget: target.clone(),
    mascotPose,
    guitarBlend,
  };
  hooks.setInstrumentViewPhase(phase, kind);
}

export function activateInstrumentView(kind) {
  const preset = INSTRUMENT_VIEW_PRESETS[kind];
  if (!preset || instrumentView.phase !== 'approaching' || instrumentView.kind !== kind) return;
  instrumentView.home = captureInstrumentViewHome();
  instrumentView.homeMascotPosition = mascot.group.position.clone();
  mascotMove.destination = null;
  mascotMove.destinationKind = null;
  mascotMove.waypoints.length = 0;
  mascotMove.keys.clear();
  hooks.releaseMoveJoystick();
  let mascotPose = null;
  let guitarBlend = null;
  if (kind === 'piano') {
    mascotPose = {
      from: captureMascotInstrumentPose(),
      to: createPianoMascotPose(),
    };
  } else if (kind === 'guitar') {
    // The guitar swings up from its stand into the mascot's hands while the
    // camera flies behind the shoulder — both lerp with the same easing.
    mascotPose = {
      from: captureMascotInstrumentPose(),
      to: createGuitarMascotPose(),
    };
    guitarBlend = { from: 0, to: 1 };
  } else {
    poseMascotAtInstrument(kind);
  }
  const frame = instrumentViewFrame(kind, preset);
  startInstrumentCameraTransition(
    'entering',
    kind,
    frame.position,
    frame.target,
    prefersReducedMotion.matches ? 0.18 : 0.78,
    { mascotPose, guitarBlend },
  );
}

function finishInstrumentReturn() {
  // The walk control is hidden while seated. Safari can lose its pointer-up
  // when that happens, so restoring free movement must also restore its home UI.
  hooks.releaseMoveJoystick();
  // Covers immediate exits (falls, instrument switches) where no returning
  // transition lerped the guitar back onto its stand.
  guitar.setPerformBlend(0);
  const home = instrumentView.home;
  const offerPriceChipKind = instrumentView.offerPriceChipOnIdle;
  if (instrumentView.phase === 'returning') {
    resetMascotPose();
    mascot.group.position.y = 0;
  }
  // Focus poses deliberately place the mascot at an instrument (on a piano
  // bench or drum throne, for example). Restore its pre-focus walk position so
  // it returns to the visible spot the visitor was using before the focus view.
  const returnPosition = instrumentView.homeMascotPosition || mascot.group.position;
  mascot.group.position.copy(projectMascotToWalkablePoint(returnPosition));
  mascot.group.position.y = 0;
  if (home) {
    restoreInstrumentControlLimits(home);
    // A damped OrbitControls carries residual sphericalDelta / panOffset from
    // any orbit gesture made while focused. A plain position/target set +
    // update() would re-apply that stale delta on top of the restored home
    // frame — invisible on a normal ✕ exit (the return transition runs with
    // controls disabled long enough for it to decay), but very visible on an
    // immediate exit (e.g. opening the mascot editor mid-focus), which has no
    // decay time at all. Flush it the same way instrument-focus entry does.
    syncControlsAtInstrumentFrame(home.position, home.target);
  }
  applyMobileOrbitPolicy();
  hooks.resetMobileFollowCamera();
  controls.enabled = session.started && session.flyT < 0;
  controls.autoRotate = false;
  controls.update();
  instrumentView.transition = null;
  instrumentView.refit = null;
  instrumentView.home = null;
  instrumentView.homeMascotPosition = null;
  instrumentView.offerPriceChipOnIdle = null;
  hooks.setInstrumentViewPhase('idle');
  if (offerPriceChipKind) hooks.flushPendingPriceChip(offerPriceChipKind);
}

export function leaveInstrumentView({ immediate = false, offerPriceChip = true } = {}) {
  if (instrumentView.phase === 'idle') return;
  // Reset without a pointer id so a captured/lost iOS touch cannot leave the
  // floating joystick visible after returning from an instrument.
  hooks.releaseMoveJoystick();
  const leavingKind = instrumentView.kind;
  if (leavingKind === 'piano') hooks.releaseAllHeldPianoNotes();
  if (leavingKind === 'guitar') {
    hooks.clearGuitarInteractionState();
    audio.muteGuitar();
  }
  mascotMove.destinationKind = null;
  mascotMove.waypoints.length = 0;
  if (instrumentView.phase === 'approaching') {
    mascotMove.destination = null;
    instrumentView.transition = null;
    instrumentView.refit = null;
    instrumentView.home = null;
    instrumentView.offerPriceChipOnIdle = null;
    hooks.setInstrumentViewPhase('idle');
    return;
  }
  const shouldOfferPriceChip = offerPriceChip
    && leavingKind
    && ['entering', 'focused', 'returning'].includes(instrumentView.phase);
  instrumentView.offerPriceChipOnIdle = shouldOfferPriceChip ? leavingKind : null;
  if (instrumentView.phase === 'returning') {
    if (immediate) {
      resetMascotPose();
      mascot.group.position.y = 0;
      finishInstrumentReturn();
    }
    return;
  }
  const home = instrumentView.home;
  if (!home) {
    resetMascotPose();
    mascot.group.position.y = 0;
    controls.enabled = true;
    const offerKind = instrumentView.offerPriceChipOnIdle;
    instrumentView.offerPriceChipOnIdle = null;
    hooks.setInstrumentViewPhase('idle');
    if (offerKind) hooks.flushPendingPriceChip(offerKind);
    return;
  }
  if (immediate) {
    resetMascotPose();
    mascot.group.position.y = 0;
    finishInstrumentReturn();
    return;
  }
  startInstrumentCameraTransition(
    'returning',
    instrumentView.kind,
    home.position,
    home.target,
    prefersReducedMotion.matches ? 0.12 : 0.52,
    { guitarBlend: leavingKind === 'guitar' ? { from: 1, to: 0 } : null },
  );
}

export function updateInstrumentViewCamera(dt) {
  const transition = instrumentView.transition;
  if (transition) {
    transition.elapsed += dt;
    const k = Math.min(1, transition.elapsed / transition.duration);
    const eased = easeInOut(k);
    camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
    controls.target.lerpVectors(transition.fromTarget, transition.toTarget, eased);
    if (transition.mascotPose) {
      interpolateMascotInstrumentPose(
        transition.mascotPose.from,
        transition.mascotPose.to,
        eased,
      );
    }
    if (transition.guitarBlend) {
      guitar.setPerformBlend(THREE.MathUtils.lerp(
        transition.guitarBlend.from,
        transition.guitarBlend.to,
        eased,
      ), mascot.group.scale);
    }
    camera.lookAt(controls.target);
    if (k >= 1) {
      if (transition.mascotPose) applyMascotInstrumentPose(transition.mascotPose.to);
      if (transition.guitarBlend) guitar.setPerformBlend(transition.guitarBlend.to, mascot.group.scale);
      instrumentView.transition = null;
      if (instrumentView.phase === 'entering') {
        applyFocusedControlLimits();
        syncControlsAtInstrumentFrame(transition.toPosition, transition.toTarget);
        controls.enabled = true;
        hooks.setInstrumentViewPhase('focused', instrumentView.kind);
      } else if (instrumentView.phase === 'returning') {
        finishInstrumentReturn();
      }
    }
    return true;
  }

  const refit = instrumentView.refit;
  if (!refit) return false;
  refit.elapsed += dt;
  const k = Math.min(1, refit.elapsed / refit.duration);
  const eased = easeInOut(k);
  camera.position.lerpVectors(refit.fromPosition, refit.toPosition, eased);
  controls.target.lerpVectors(refit.fromTarget, refit.toTarget, eased);
  camera.lookAt(controls.target);
  if (k >= 1) {
    instrumentView.refit = null;
    applyFocusedControlLimits();
    syncControlsAtInstrumentFrame(refit.toPosition, refit.toTarget);
    controls.enabled = true;
  }
  return true;
}

export function requestInstrumentView(kind) {
  const preset = INSTRUMENT_VIEW_PRESETS[kind];
  if (!preset || mascotMove.fall || session.flyT >= 0) return;
  if (instrumentView.kind === kind && ['approaching', 'entering', 'focused'].includes(instrumentView.phase)) return;
  if (instrumentView.phase !== 'idle') leaveInstrumentView({ immediate: true, offerPriceChip: false });
  setDancing(false);
  hooks.setInstrumentViewPhase('approaching', kind);
  mascotMove.keys.clear();
  hooks.releaseMoveJoystick();
  controls.autoRotate = false;
  const route = [];
  let routeStart = mascot.group.position.clone();
  for (const point of preset.approach) {
    const world = instrumentLocalToWorld(kind, point);
    world.y = 0;
    const segment = planMascotWalkRoute(routeStart, world);
    route.push(...segment);
    routeStart = segment[segment.length - 1] || routeStart;
  }
  const walkTarget = nearestInstrumentWalkPoint(kind, routeStart)
    || instrumentLocalToWorld(kind, preset.mascot).setY(0);
  const finalSegment = planMascotWalkRoute(routeStart, walkTarget);
  route.push(...finalSegment);
  mascotMove.waypoints = route;
  mascotMove.destinationKind = kind;
  mascotMove.destination = mascotMove.waypoints.shift() || null;
  if (!mascotMove.destination) activateInstrumentView(kind);
}

