// ============================================================
// FOCUS FRAMING
// Solves the close-up camera by projection rather than by hand-tuned numbers:
// measure where the play surface lands on screen, subtract the on-screen
// chrome that must not cover it, and move the camera until the subject fills
// what is left. That keeps the piano keybed and the guitar strings playable at
// any aspect ratio, notch or browser chrome height.
// ============================================================
import * as THREE from 'three';
import { camera, controls, FOCUS_ZOOM_FACTOR, ZOOM_IN_STEP } from './rig.js?v=20260813-15';
import { isMobileGameMode } from '../core/quality.js?v=20260813-15';
import { stage, drums, piano, guitar, mascot } from '../core/studio.js?v=20260813-15';
import { instrumentView } from './instrument-presets.js?v=20260813-15';
import { instrumentLocalToWorld, instrumentViewCameraPoint } from './instrument-presets.js?v=20260813-15';

const loopPedal = document.getElementById('loop-pedal');
const mobileExit = document.getElementById('mobile-exit');

const PIANO_FRAME_MARGIN = 16;
export const PIANO_HAND_ANCHORS = {
  armL: new THREE.Vector3(0.38, 0.72, 0.67),
  armR: new THREE.Vector3(-0.38, 0.72, 0.67),
};
const focusFitCamera = camera.clone();
export let pianoFrameDebug = null;

function objectBoundsInAncestor(objects, ancestor) {
  const bounds = new THREE.Box3();
  const objectBounds = new THREE.Box3();
  const inverse = new THREE.Matrix4();
  ancestor.updateWorldMatrix(true, true);
  inverse.copy(ancestor.matrixWorld).invert();
  for (const object of objects) {
    if (!object?.isMesh || !object.geometry) continue;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    if (!object.geometry.boundingBox) continue;
    object.updateWorldMatrix(true, false);
    objectBounds.copy(object.geometry.boundingBox)
      .applyMatrix4(object.matrixWorld)
      .applyMatrix4(inverse);
    bounds.union(objectBounds);
  }
  return bounds;
}

export const pianoKeybedLocalBounds = objectBoundsInAncestor(piano.keys, piano.group);

export function boxCorners(box) {
  const { min, max } = box;
  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, max.y, max.z),
  ];
}

function visibleChromeRect(element) {
  if (!element || element.hidden) return null;
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0.03) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  };
}

function rectIntersection(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function validPianoSafeRect(rect) {
  return rect.right - rect.left >= 160 && rect.bottom - rect.top >= 150;
}

function pianoSafeRectScore(rect, viewport) {
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  const viewportWidth = viewport.right - viewport.left;
  const centerX = (rect.left + rect.right) * 0.5;
  const viewportCenterX = (viewport.left + viewport.right) * 0.5;
  // The keybed is intrinsically wide: prefer a shorter full-width region above
  // controls over a tall narrow strip beside them on phone portrait.
  const widthBias = Math.pow(width / viewportWidth, 3);
  return width * height * widthBias - Math.abs(centerX - viewportCenterX) * 18;
}

function focusSafeRect(reservedRects = []) {
  const vv = window.visualViewport;
  const viewport = {
    left: (vv?.offsetLeft || 0) + PIANO_FRAME_MARGIN,
    top: (vv?.offsetTop || 0) + PIANO_FRAME_MARGIN,
    right: (vv?.offsetLeft || 0) + (vv?.width || window.innerWidth) - PIANO_FRAME_MARGIN,
    bottom: (vv?.offsetTop || 0) + (vv?.height || window.innerHeight) - PIANO_FRAME_MARGIN,
  };
  const blockers = [
    document.getElementById('hud'),
    loopPedal,
    mobileExit,
    document.getElementById('chip'),
    document.getElementById('toast'),
  ].map(visibleChromeRect).filter(Boolean).map((rect) => ({
    left: rect.left - 8,
    top: rect.top - 8,
    right: rect.right + 8,
    bottom: rect.bottom + 8,
  })).concat(reservedRects);

  let candidates = [viewport];
  for (const blocker of blockers) {
    const next = [];
    for (const rect of candidates) {
      if (!rectIntersection(rect, blocker)) {
        next.push(rect);
        continue;
      }
      const splits = [
        { ...rect, bottom: Math.min(rect.bottom, blocker.top) },
        { ...rect, top: Math.max(rect.top, blocker.bottom) },
        { ...rect, right: Math.min(rect.right, blocker.left) },
        { ...rect, left: Math.max(rect.left, blocker.right) },
      ];
      next.push(...splits.filter(validPianoSafeRect));
    }
    candidates = next
      .sort((a, b) => pianoSafeRectScore(b, viewport) - pianoSafeRectScore(a, viewport))
      .slice(0, 48);
  }
  return candidates[0] || viewport;
}

// A docked play surface appears only after the entry fit has already run, so
// its footprint is reserved from the layout constants that style.css sizes it
// by instead of a DOM measurement — entry fit and later refits then agree on
// the same play area. THE NUMBERS BELOW ARE THE TWIN OF `--wheel-size` /
// `--wheel-gap` in style.css; change one and you must change the other.
//
// One reserve serves all three surfaces, because all three share one dock and
// one size formula: the chord wheel (guitar, piano), the groove wheel (drums)
// and the voice ribbon (mic). Only the two fitted instruments actually consult
// it — drums and the mic use raw presets — but the reserve does not need to
// know which surface is showing, and that is the point of sharing the tokens.
const WHEEL_GAP = 12;
const wheelSize = (portrait, width, height) => (portrait
  ? Math.min(width - 100, 0.44 * height, 300)
  : Math.min(0.3 * height + 120, 236));

function playSurfaceReservedRects() {
  const vv = window.visualViewport;
  const left = vv?.offsetLeft || 0;
  const top = vv?.offsetTop || 0;
  const width = vv?.width || window.innerWidth;
  const height = vv?.height || window.innerHeight;
  const portrait = height > width;
  const size = wheelSize(portrait, width, height);
  const bottom = portrait ? (isMobileGameMode() ? 16 : 14) : WHEEL_GAP;
  // The wheel docks bottom-left in both orientations, so the reserve is that
  // corner rather than a full-height rail. The piano is the reason a rail was
  // never an option: pianoSafeRectScore cubes the width ratio, so a rail would
  // cost the keybed a quarter of its width and be punished far harder than a
  // corner that leaves the full-width strip above it intact.
  return [{
    left,
    top: top + height - (bottom + size + WHEEL_GAP),
    right: left + WHEEL_GAP + size + WHEEL_GAP,
    bottom: top + height,
  }];
}

export function pianoFocusSafeRect() {
  return focusSafeRect(playSurfaceReservedRects());
}

function guitarFocusSafeRect() {
  return focusSafeRect(playSurfaceReservedRects());
}

export function projectedBounds(points, projectionCamera) {
  const bounds = {
    left: Infinity,
    top: Infinity,
    right: -Infinity,
    bottom: -Infinity,
  };
  for (const point of points) {
    const ndc = point.clone().project(projectionCamera);
    const x = (ndc.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-ndc.y * 0.5 + 0.5) * window.innerHeight;
    bounds.left = Math.min(bounds.left, x);
    bounds.top = Math.min(bounds.top, y);
    bounds.right = Math.max(bounds.right, x);
    bounds.bottom = Math.max(bounds.bottom, y);
  }
  bounds.width = bounds.right - bounds.left;
  bounds.height = bounds.bottom - bounds.top;
  bounds.centerX = (bounds.left + bounds.right) * 0.5;
  bounds.centerY = (bounds.top + bounds.bottom) * 0.5;
  return bounds;
}

export function pianoWorldPoints(localPoints) {
  return localPoints.map((point) => instrumentLocalToWorld('piano', point));
}

/**
 * Shared measured-framing core: place the camera along eyeDirection so
 * widthPoints project to desiredWidthRatio of the safe rect while
 * subjectPoints stay contained, then shift the target so the subject centers
 * on the safe rect. All points are world-space.
 */
function fitProjectedFocusFrame({
  safeRect,
  widthPoints,
  subjectPoints,
  subjectCenter,
  eyeDirection,
  desiredWidthRatio,
  initialDistance,
  minDistance,
  maxDistance,
  // 0.5 centers the subject in the safe rect; larger values sit it lower.
  // Portrait screens read better with the play surface near the thumbs and
  // the instrument body filling the headroom instead of bare stage floor.
  centerBiasY = 0.5,
  // Applied after fitting, so the subject stays centered on the safe rect
  // while filling more of it. Below 1 the outer edges crop — the same trade
  // as pressing "+", and "−" / pinch still reach the full fitted frame.
  zoomFactor = 1,
}) {
  const right = new THREE.Vector3().crossVectors(camera.up, eyeDirection).normalize();
  const viewUp = new THREE.Vector3().crossVectors(eyeDirection, right).normalize();
  const safeWidth = safeRect.right - safeRect.left;
  const safeHeight = safeRect.bottom - safeRect.top;
  const safeCenterX = (safeRect.left + safeRect.right) * 0.5;
  const safeCenterY = THREE.MathUtils.lerp(safeRect.top, safeRect.bottom, centerBiasY);
  const desiredWidth = safeWidth * desiredWidthRatio;
  const tanHalfV = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const desiredNdcX = (safeCenterX / window.innerWidth) * 2 - 1;
  const desiredNdcY = 1 - (safeCenterY / window.innerHeight) * 2;
  const position = new THREE.Vector3();
  const target = new THREE.Vector3();

  const placeCamera = (distance) => {
    const halfHeight = distance * tanHalfV;
    const halfWidth = halfHeight * camera.aspect;
    position.copy(subjectCenter).addScaledVector(eyeDirection, distance);
    target.copy(subjectCenter)
      .addScaledVector(right, -desiredNdcX * halfWidth)
      .addScaledVector(viewUp, -desiredNdcY * halfHeight);
    focusFitCamera.copy(camera);
    focusFitCamera.position.copy(position);
    focusFitCamera.up.copy(camera.up);
    focusFitCamera.lookAt(target);
    focusFitCamera.updateMatrixWorld(true);
  };

  let distance = THREE.MathUtils.clamp(initialDistance, minDistance, maxDistance);
  for (let iteration = 0; iteration < 8; iteration++) {
    placeCamera(distance);
    const widthBounds = projectedBounds(widthPoints, focusFitCamera);
    const subjectBounds = projectedBounds(subjectPoints, focusFitCamera);
    const widthScale = widthBounds.width / desiredWidth;
    const fitScale = Math.max(subjectBounds.width / safeWidth, subjectBounds.height / safeHeight);
    const scale = Math.max(widthScale, fitScale);
    if (Math.abs(scale - 1) < 0.004) break;
    distance = THREE.MathUtils.clamp(distance * scale, minDistance, maxDistance);
  }

  distance = Math.max(minDistance, distance * zoomFactor);
  placeCamera(distance);
  for (let iteration = 0; iteration < 2; iteration++) {
    const bounds = projectedBounds(subjectPoints, focusFitCamera);
    const dx = safeCenterX - bounds.centerX;
    const dy = safeCenterY - bounds.centerY;
    const worldPerPixelY = (2 * distance * tanHalfV) / window.innerHeight;
    const worldPerPixelX = worldPerPixelY * camera.aspect;
    const shift = right.clone().multiplyScalar(-dx * worldPerPixelX)
      .addScaledVector(viewUp, dy * worldPerPixelY);
    position.add(shift);
    target.add(shift);
    focusFitCamera.position.copy(position);
    focusFitCamera.lookAt(target);
    focusFitCamera.updateMatrixWorld(true);
  }

  return { position: position.clone(), target: target.clone(), distance };
}

function fitPianoFocusFrame(preset) {
  const safeRect = pianoFocusSafeRect();
  const keyLocalPoints = boxCorners(pianoKeybedLocalBounds);
  const subjectLocalPoints = [
    ...keyLocalPoints,
    PIANO_HAND_ANCHORS.armL,
    PIANO_HAND_ANCHORS.armR,
  ];
  const keyPoints = pianoWorldPoints(keyLocalPoints);
  // The behind-the-player view crops the mascot at the frame bottom on
  // purpose (same as drums), so only keys + hands drive the framing.
  const subjectPoints = pianoWorldPoints(subjectLocalPoints);
  const subjectLocalBounds = new THREE.Box3().setFromPoints(subjectLocalPoints);
  const subjectCenterLocal = subjectLocalBounds.getCenter(new THREE.Vector3());
  subjectCenterLocal.y += 0.035;
  subjectCenterLocal.z += 0.055;
  const subjectCenter = instrumentLocalToWorld('piano', subjectCenterLocal);
  const pianoWorldQuaternion = piano.group.getWorldQuaternion(new THREE.Quaternion());
  const eyeDirection = preset.camera.clone().sub(preset.target).normalize()
    .applyQuaternion(pianoWorldQuaternion).normalize();
  const portrait = window.innerHeight > window.innerWidth;
  const fit = fitProjectedFocusFrame({
    safeRect,
    widthPoints: keyPoints,
    subjectPoints,
    subjectCenter,
    eyeDirection,
    desiredWidthRatio: portrait ? 0.88 : 0.81,
    initialDistance: preset.camera.distanceTo(preset.target),
    minDistance: 0.95,
    maxDistance: 6.2,
    centerBiasY: portrait ? 0.62 : 0.52,
    zoomFactor: FOCUS_ZOOM_FACTOR,
  });

  pianoFrameDebug = {
    safeRect: { ...safeRect },
    keybedBounds: projectedBounds(keyPoints, focusFitCamera),
    subjectBounds: projectedBounds(subjectPoints, focusFitCamera),
    targetWidthRatio: portrait ? 0.88 : 0.81,
    keybedLocalBounds: {
      min: pianoKeybedLocalBounds.min.toArray(),
      max: pianoKeybedLocalBounds.max.toArray(),
    },
    distance: fit.distance,
    position: fit.position.toArray(),
    target: fit.target.toArray(),
  };
  document.documentElement.dataset.pianoFrameDebug = JSON.stringify(pianoFrameDebug);
  return { position: fit.position, target: fit.target };
}

// Playable band of the held guitar in body-local space: all six strings from
// just past the nut to below the bridge, with the soundhole strum area.
const GUITAR_SUBJECT_LOCAL_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-0.1, -0.36, 0.02),
  new THREE.Vector3(0.1, 1.26, 0.18),
);

function guitarPerformanceMatrix() {
  // Full mascot scale: the chest-riding hold shifts with build (x) as well as
  // height (y), and the fitter must frame the guitar where it will actually
  // sit for this body.
  const pose = guitar.getPerformancePose(mascot.group.scale);
  const local = new THREE.Matrix4().compose(
    pose.position,
    new THREE.Quaternion().setFromEuler(pose.euler),
    new THREE.Vector3(1, 1, 1),
  );
  guitar.group.updateWorldMatrix(true, false);
  return local.premultiply(guitar.group.matrixWorld);
}

function fitGuitarFocusFrame(preset) {
  const safeRect = guitarFocusSafeRect();
  // Project the strings band under the FINAL performance pose, not whatever
  // blend the entry transition happens to be at.
  const matrix = guitarPerformanceMatrix();
  const stringsPoints = boxCorners(GUITAR_SUBJECT_LOCAL_BOUNDS)
    .map((point) => point.applyMatrix4(matrix));
  const subjectCenter = GUITAR_SUBJECT_LOCAL_BOUNDS.getCenter(new THREE.Vector3())
    .applyMatrix4(matrix);
  const guitarWorldQuaternion = guitar.group.getWorldQuaternion(new THREE.Quaternion());
  const portrait = window.innerHeight > window.innerWidth;
  const eyePreset = portrait && preset.cameraPortrait ? preset.cameraPortrait : preset.camera;
  const eyeDirection = eyePreset.clone().sub(preset.target).normalize()
    .applyQuaternion(guitarWorldQuaternion).normalize();
  const fit = fitProjectedFocusFrame({
    safeRect,
    widthPoints: stringsPoints,
    subjectPoints: stringsPoints,
    subjectCenter,
    eyeDirection,
    desiredWidthRatio: portrait ? 0.94 : 0.86,
    initialDistance: eyePreset.distanceTo(preset.target),
    minDistance: 0.75,
    maxDistance: 5.6,
    centerBiasY: portrait ? 0.6 : 0.5,
    // A phone screen carries the strings much smaller than a desktop one, and
    // the wheel now takes a corner of it, so mobile opens one further "+" step
    // inside the fit than the shared two. Cropping the outer edges is the same
    // trade the zoom control makes, and pinch still reaches the full frame.
    zoomFactor: isMobileGameMode() ? FOCUS_ZOOM_FACTOR * ZOOM_IN_STEP : FOCUS_ZOOM_FACTOR,
  });
  document.documentElement.dataset.guitarFrameDebug = JSON.stringify({
    safeRect: { ...safeRect },
    subjectBounds: projectedBounds(stringsPoints, focusFitCamera),
    distance: fit.distance,
  });
  return { position: fit.position, target: fit.target };
}

export function instrumentViewFrame(kind, preset) {
  if (kind === 'piano') return fitPianoFocusFrame(preset);
  if (kind === 'guitar') return fitGuitarFocusFrame(preset);
  const target = isMobileGameMode() && preset.targetMobile ? preset.targetMobile : preset.target;
  return {
    position: instrumentLocalToWorld(kind, instrumentViewCameraPoint(kind, preset)),
    target: instrumentLocalToWorld(kind, target),
  };
}

// Debug: what the piano fit actually solved for, in screen space.
window.__pianoDebug = () => {
  piano.group.updateWorldMatrix(true, true);
  mascot.group.updateWorldMatrix(true, true);
  camera.updateMatrixWorld(true);
  const keyPoints = pianoWorldPoints(boxCorners(pianoKeybedLocalBounds));
  const handScreen = [mascot.handL, mascot.handR].map((hand) => {
    const world = hand.getWorldPosition(new THREE.Vector3());
    const ndc = world.clone().project(camera);
    return {
      world: world.toArray(),
      screen: [
        (ndc.x * 0.5 + 0.5) * window.innerWidth,
        (-ndc.y * 0.5 + 0.5) * window.innerHeight,
      ],
    };
  });
  const safeRect = pianoFocusSafeRect();
  const keybedBounds = projectedBounds(keyPoints, camera);
  return {
    phase: instrumentView.phase,
    kind: instrumentView.kind,
    safeRect,
    keybedBounds,
    keybedWidthRatio: keybedBounds.width / Math.max(1, safeRect.right - safeRect.left),
    hands: handScreen,
    camera: camera.position.toArray(),
    target: controls.target.toArray(),
    pose: {
      mascotPosition: mascot.group.position.toArray(),
      torso: mascot.torso.rotation.toArray(),
      head: mascot.head.rotation.toArray(),
      armL: mascot.armL.rotation.toArray(),
      armR: mascot.armR.rotation.toArray(),
      legL: mascot.legL.rotation.toArray(),
      legR: mascot.legR.rotation.toArray(),
    },
    fitted: pianoFrameDebug,
  };
};
