// ============================================================
// RENDER RIG
// The single WebGL renderer, scene, camera and orbit controls, plus the
// framing rules that keep the stage readable: portrait crops the wings and
// pulls the player in, landscape opens out, and the pixel-ratio cap follows
// the device tier. Every view module reads the rig from here rather than
// having it threaded through boot.
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  isMobileGameMode,
  isLowEndMobileGameMode,
  usesLowMobileSceneBudget,
  MOBILE_MAX_PIXEL_RATIO,
  LOW_END_MOBILE_MAX_PIXEL_RATIO,
  DESKTOP_MAX_PIXEL_RATIO,
} from '../core/quality.js?v=20260813-24';
import { isFreeCamera } from '../core/camera-mode.js?v=20260813-24';

export const canvas = document.getElementById('scene');
export let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    // MSAA multiplies the memory bandwidth of every scene render. At native
    // device resolution it has little practical benefit on the low tier.
    antialias: !isLowEndMobileGameMode(),
    powerPreference: 'high-performance',
  });
  if (!renderer.getContext()) throw new Error('no webgl');
} catch (err) {
  document.getElementById('webgl-fail').hidden = false;
  document.getElementById('intro').style.display = 'none';
  throw err;
}
export function renderPixelRatio() {
  let maximum = DESKTOP_MAX_PIXEL_RATIO;
  if (isMobileGameMode()) {
    maximum = usesLowMobileSceneBudget()
      ? LOW_END_MOBILE_MAX_PIXEL_RATIO
      : MOBILE_MAX_PIXEL_RATIO;
  } else if (usesLowMobileSceneBudget()) {
    // Desktop PIXEL / settled AUTO-low: ease GPU fill-rate pressure.
    maximum = LOW_END_MOBILE_MAX_PIXEL_RATIO;
  }
  return Math.min(window.devicePixelRatio || 1, maximum);
}

renderer.setPixelRatio(renderPixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !isLowEndMobileGameMode();
document.documentElement.dataset.shadows = renderer.shadowMap.enabled ? 'on' : 'off';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// Exposure discipline: whites (piano keys, jersey, drum heads) must hold texture
// under the key light instead of clipping into bloom.
renderer.toneMappingExposure = 1.02;

const BG = 0x0a0612;
export const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.FogExp2(BG, 0.036);

export const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 120);
export const CAM_START = new THREE.Vector3(0, 9.5, 18.5);
export const CAM_END = new THREE.Vector3(0, 3.05, 10.45);
export const TARGET = new THREE.Vector3(0, 1.45, -0.3);
export const ZOOM_IN_STEP = 0.82;
// Start two "+" presses closer than the original stage framing.
const START_ZOOM_FACTOR = ZOOM_IN_STEP ** 5;
// Focused piano / guitar open two "+" presses inside their measured fit, so
// the play surface fills the screen instead of sitting in a safe-rect box.
export const FOCUS_ZOOM_FACTOR = ZOOM_IN_STEP ** 2;
// Allow two extra "+" presses past the previous closest zoom.
const EXTRA_ZOOM_IN_LEVELS = 2;
export const STAGE_MIN_DISTANCE = 5 * (ZOOM_IN_STEP ** EXTRA_ZOOM_IN_LEVELS);
export const FOCUSED_MIN_DISTANCE = 1.05 * (ZOOM_IN_STEP ** EXTRA_ZOOM_IN_LEVELS);

export function pullCameraTowardTarget(point, factor = START_ZOOM_FACTOR) {
  point.sub(TARGET).multiplyScalar(factor).add(TARGET);
}

export function fitCameraToViewport() {
  const portrait = window.innerWidth / window.innerHeight < 1;
  if (portrait) {
    // Portrait intentionally crops the far stage wings and brings the player
    // into the action, closer to a third-person mobile game camera.
    CAM_START.set(0, 7.8, 20);
    CAM_END.set(0, 2.9, 14.6);
    camera.fov = 62;
    controls.maxDistance = 22;
    renderer.toneMappingExposure = 0.92;
  } else {
    CAM_START.set(0, 9.5, 18.5);
    CAM_END.set(0, 3.05, 10.45);
    camera.fov = 55;
    controls.maxDistance = 16;
    renderer.toneMappingExposure = 1.02;
  }
  // A coarse-pointer phone stays capped in landscape as well as portrait.
  renderer.setPixelRatio(renderPixelRatio());
  pullCameraTowardTarget(CAM_END);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

camera.position.copy(CAM_START);
camera.lookAt(TARGET);

export const controls = new OrbitControls(camera, renderer.domElement);
fitCameraToViewport();
camera.position.copy(CAM_START);
camera.lookAt(TARGET);
controls.target.copy(TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = STAGE_MIN_DISTANCE;
controls.minPolarAngle = 0.7;
controls.maxPolarAngle = 1.47;
controls.autoRotateSpeed = 0.55;
controls.enabled = false;

// The free camera opens the pitch well past the framed range, but not so far
// that "free" starts meaning "underneath the stage". Eye height is
// `target.y + distance * cos(polar)`, so the 1.62 rad floor (cos ≈ -0.049)
// bottoms out at 1.35 - 22 * 0.049 ≈ 0.27 even at the portrait maximum
// distance — still above the platform top, so the deliberately unlit
// under-stage venue plane never becomes the view. 0.44 rad is a true overhead
// look-down; the framed camera only reaches 0.7.
const FREE_MIN_POLAR = 0.44;
const FREE_MAX_POLAR = 1.62;

// Three branches, one function. Вільна (opt-in, any device) rotates on a
// single pointer and is clamped only by the stage floor. Otherwise mobile gets
// the default MOBA-style tactical camera (Не дуже) — one-finger drag scouts,
// then the follow spring recentres on the mascot — and desktop orbits.
// Instrument close-ups override all three and call back here on exit.
//
// What Вільна frees is the *angle*, not the subject: the follow spring keeps
// running underneath it, because it only ever translates the rig and so cannot
// disturb an orbit. Cutting it would mean walking the mascot clean out of
// frame with no way back short of changing the setting.
//
// Every branch sets every property it cares about: the mode can now change at
// runtime, so anything left unassigned would silently inherit the branch the
// visitor happened to come from.
export function applyMobileOrbitPolicy() {
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  if (isFreeCamera()) {
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.enableRotate = true;
    controls.enablePan = false;
    controls.screenSpacePanning = true;
    controls.maxTargetRadius = Infinity;
    controls.rotateSpeed = 0.48;
    controls.zoomSpeed = 0.58;
    controls.dampingFactor = 0.12;
    controls.minPolarAngle = FREE_MIN_POLAR;
    controls.maxPolarAngle = FREE_MAX_POLAR;
  } else if (isMobileGameMode()) {
    controls.touches.ONE = THREE.TOUCH.PAN;
    controls.enableRotate = false;
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controls.maxTargetRadius = 2.65;
    controls.panSpeed = 0.72;
    // Pinned to OrbitControls' own default, which this branch used to inherit
    // by never assigning it. It reaches only instrument close-ups, where
    // rotation is re-enabled regardless of which stage camera is active.
    controls.rotateSpeed = 1;
    controls.zoomSpeed = 0.42;
    controls.dampingFactor = 0.16;
    controls.minPolarAngle = 0.55;
    controls.maxPolarAngle = 1.52;
  } else {
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.enableRotate = true;
    controls.enablePan = false;
    controls.screenSpacePanning = true;
    controls.maxTargetRadius = Infinity;
    controls.rotateSpeed = 0.48;
    controls.zoomSpeed = 0.58;
    controls.dampingFactor = 0.12;
    controls.minPolarAngle = 0.7;
    controls.maxPolarAngle = 1.47;
  }
}
applyMobileOrbitPolicy();
