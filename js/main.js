// ============================================================
// ART VIBE STUDIO — interactive 3D stage
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AudioEngine } from './audio.js?v=20260802-21';
import { buildDrumKit, buildPiano, buildGuitar, buildMic } from './instruments.js?v=20260803-02';
import { UI } from './ui.js?v=20260804-01';
import { isQuickGuitarTap } from './guitar-gestures.js?v=20260802-1';

// ---- error collector (debug / headless testing) ----
const errlog = document.getElementById('errlog');
window.addEventListener('error', (e) => { errlog.textContent += `ERR: ${e.message} @ ${e.filename}:${e.lineno}\n`; });
window.addEventListener('unhandledrejection', (e) => { errlog.textContent += `REJ: ${e.reason}\n`; });

const params = new URLSearchParams(location.search);
const QUALITY_PREFERENCE_KEY = 'av2.quality.v2';
const LIGHT_LEVEL_KEY = 'av2.lights.v2';
const LIGHT_LEVEL_MIN = 0;
const LIGHT_LEVEL_MAX = 100;
const LIGHT_LEVEL_DEFAULT = 78;
const LOW_QUALITY_LIGHT_LEVEL_DEFAULT = 100;
function readStoredLightLevel() {
  try {
    const raw = localStorage.getItem(LIGHT_LEVEL_KEY);
    if (raw == null || raw === '') return null;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return Math.min(LIGHT_LEVEL_MAX, Math.max(LIGHT_LEVEL_MIN, Math.round(parsed)));
    }
  } catch (_) { /* storage is optional */ }
  return null;
}
const QUALITY_OPTIONS = new Set(['auto', 'high', 'low']);
let savedQuality = null;
try { savedQuality = localStorage.getItem(QUALITY_PREFERENCE_KEY); } catch (_) { /* storage is optional */ }
const queryQuality = params.get('quality');
const forcedQuality = QUALITY_OPTIONS.has(queryQuality)
  ? queryQuality
  : (QUALITY_OPTIONS.has(savedQuality) ? savedQuality : 'auto');
const storedLightLevel = readStoredLightLevel();
let stageLightLevel = storedLightLevel ?? (forcedQuality === 'low'
  ? LOW_QUALITY_LIGHT_LEVEL_DEFAULT
  : LIGHT_LEVEL_DEFAULT);
const ui = new UI();
const audio = new AudioEngine();
window.__audioDebug = () => audio.debugState();
const qualityOptions = document.querySelector('.quality-options');
const qualityButtons = [...document.querySelectorAll('[data-quality]')];
const qualityConfirm = document.getElementById('quality-confirm');
const qualityConfirmPanel = qualityConfirm?.querySelector('.quality-confirm-panel');
const qualityConfirmLoader = document.getElementById('quality-confirm-loader');
const qualityConfirmCancel = document.getElementById('quality-confirm-cancel');
const qualityConfirmApply = document.getElementById('quality-confirm-apply');
const lightLevelInput = document.getElementById('stage-light-level');
const lightLevelValue = document.getElementById('stage-light-level-val');
let qualityChangePending = false;
let pendingQuality = null;

function syncLightLevelUi() {
  if (lightLevelInput) {
    if (Number(lightLevelInput.value) !== stageLightLevel) {
      lightLevelInput.value = String(stageLightLevel);
    }
    lightLevelInput.setAttribute('aria-valuetext', `${stageLightLevel} відсотків`);
  }
  if (lightLevelValue) lightLevelValue.textContent = `${stageLightLevel}%`;
}

function syncQualityPreferenceUi() {
  for (const button of qualityButtons) {
    const selected = button.dataset.quality === forcedQuality;
    button.classList.toggle('is-on', selected);
    button.setAttribute('aria-checked', selected ? 'true' : 'false');
  }
  syncLightLevelUi();
}

function resetQualityPendingUi() {
  qualityChangePending = false;
  qualityOptions?.classList.remove('is-loading');
  for (const button of qualityButtons) {
    button.disabled = false;
    button.classList.remove('is-loading');
    button.removeAttribute('aria-busy');
  }
  syncQualityPreferenceUi();
}

function closeQualityConfirm() {
  pendingQuality = null;
  qualityConfirmPanel?.classList.remove('is-loading');
  if (qualityConfirmLoader) qualityConfirmLoader.hidden = true;
  if (qualityConfirmCancel) qualityConfirmCancel.disabled = false;
  if (qualityConfirmApply) qualityConfirmApply.disabled = false;
  if (qualityConfirm) qualityConfirm.hidden = true;
}

function showQualityConfirm(nextQuality) {
  if (qualityChangePending || !QUALITY_OPTIONS.has(nextQuality) || nextQuality === forcedQuality) return;
  pendingQuality = nextQuality;
  if (qualityConfirm) {
    qualityConfirm.hidden = false;
    qualityConfirmApply?.focus();
  }
}

function setQualityPreference(nextQuality, button) {
  if (qualityChangePending || !QUALITY_OPTIONS.has(nextQuality) || nextQuality === forcedQuality) return;
  qualityChangePending = true;
  qualityConfirmPanel?.classList.add('is-loading');
  if (qualityConfirmLoader) qualityConfirmLoader.hidden = false;
  if (qualityConfirmCancel) qualityConfirmCancel.disabled = true;
  if (qualityConfirmApply) qualityConfirmApply.disabled = true;
  qualityOptions?.classList.add('is-loading');
  for (const option of qualityButtons) option.disabled = true;
  button?.classList.add('is-loading');
  button?.setAttribute('aria-busy', 'true');
  try { localStorage.setItem(QUALITY_PREFERENCE_KEY, nextQuality); } catch (_) { /* storage is optional */ }
  const nextUrl = new URL(location.href);
  nextUrl.searchParams.set('quality', nextQuality);
  requestAnimationFrame(() => {
    window.setTimeout(() => location.assign(nextUrl.href), 350);
  });
}

for (const button of qualityButtons) {
  button.addEventListener('click', () => showQualityConfirm(button.dataset.quality));
}
qualityConfirmCancel?.addEventListener('click', closeQualityConfirm);
qualityConfirmApply?.addEventListener('click', () => {
  const option = qualityButtons.find((button) => button.dataset.quality === pendingQuality);
  if (pendingQuality) setQualityPreference(pendingQuality, option);
});
qualityConfirm?.addEventListener('click', (event) => {
  if (event.target === qualityConfirm) closeQualityConfirm();
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !qualityConfirm?.hidden) closeQualityConfirm();
});
if (lightLevelInput) {
  lightLevelInput.min = String(LIGHT_LEVEL_MIN);
  lightLevelInput.max = String(LIGHT_LEVEL_MAX);
  lightLevelInput.value = String(stageLightLevel);
  const onLightLevelInput = () => setStageLightLevel(lightLevelInput.value);
  lightLevelInput.addEventListener('input', onLightLevelInput);
  lightLevelInput.addEventListener('change', onLightLevelInput);
}
window.addEventListener('pageshow', (event) => {
  if (event.persisted && qualityChangePending) resetQualityPendingUi();
});
syncQualityPreferenceUi();
const coarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)');
// iPadOS may present itself as macOS, so use touch capability as a fallback.
const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent || '')
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const deviceMemory = Number(navigator.deviceMemory) || null;
const hardwareConcurrency = Number(navigator.hardwareConcurrency) || null;
const isMobileGameMode = () => window.innerWidth <= 720 || coarsePointer.matches;
const hasForcedQuality = forcedQuality === 'low' || forcedQuality === 'high';
// AUTO begins without expensive effects on every device, then earns full quality
// by sustaining a representative two-stage render probe. Never treat coarse
// CPU/RAM browser hints as a proxy for GPU power.
const autoQualityProbe = !hasForcedQuality;
let lowMobileQuality = forcedQuality === 'low' || autoQualityProbe;
const mobileQualityProbe = {
  active: autoQualityProbe,
  phase: autoQualityProbe ? 'medium' : 'complete',
  startedAt: 0,
  lastFrameAt: 0,
  samples: [],
  p90: null,
};
const canUpgradeMobileQuality = autoQualityProbe;
const isLowEndMobileGameMode = () => lowMobileQuality;
const isMobileQualityProbe = () => mobileQualityProbe.active;
const usesLowMobileSceneBudget = () => isLowEndMobileGameMode() && !isMobileQualityProbe();
const MOBILE_MAX_PIXEL_RATIO = 1.5;
const LOW_END_MOBILE_MAX_PIXEL_RATIO = 1;
const DESKTOP_MAX_PIXEL_RATIO = 2;
const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const stageAmbience = { curtains: [], valance: null };
const adaptiveQualityScene = {
  bulbLights: [],
  lowPrioritySpots: [],
  shadowSpots: [],
  dimmableLights: [],
  dimmableEmissives: [],
  dimmableBeams: [],
  // Decorative dressing hidden on the low mobile tier (cables, upstage truss
  // heads, star-drop overdraw) — visible fidelity trimmed before frame rate.
  lowTierDressing: [],
  starDrop: null,
  dust: null,
};
function registerDimmableLight(light) {
  adaptiveQualityScene.dimmableLights.push({ light, base: light.intensity });
}
function registerDimmableEmissive(material) {
  adaptiveQualityScene.dimmableEmissives.push({
    material,
    base: material.emissiveIntensity ?? 1,
  });
}
function registerDimmableBeam(material) {
  adaptiveQualityScene.dimmableBeams.push({
    material,
    base: material.opacity,
  });
}
function applyStageLightLevel(level = stageLightLevel) {
  const next = Math.min(LIGHT_LEVEL_MAX, Math.max(LIGHT_LEVEL_MIN, Math.round(Number(level) || 0)));
  stageLightLevel = next;
  const scale = next / 100;
  for (const entry of adaptiveQualityScene.dimmableLights) {
    entry.light.intensity = entry.base * scale;
  }
  for (const entry of adaptiveQualityScene.dimmableEmissives) {
    entry.material.emissiveIntensity = entry.base * scale;
  }
  for (const entry of adaptiveQualityScene.dimmableBeams) {
    entry.material.opacity = entry.base * scale;
  }
}
function setStageLightLevel(level, { persist = true } = {}) {
  applyStageLightLevel(level);
  if (persist) {
    try { localStorage.setItem(LIGHT_LEVEL_KEY, String(stageLightLevel)); } catch (_) { /* storage is optional */ }
  }
  syncLightLevelUi();
}
const qualityTierLabel = () => isMobileQualityProbe()
  ? 'mobile-probe'
  : (isLowEndMobileGameMode() ? 'low-mobile' : 'full');
document.documentElement.dataset.qualityTier = qualityTierLabel();
document.documentElement.dataset.postprocessing = 'off';
document.documentElement.dataset.frameRateCap = isMobileQualityProbe()
  ? 'probe'
  : (isLowEndMobileGameMode() ? '30' : 'native');
document.documentElement.classList.toggle('low-mobile', isLowEndMobileGameMode());
let postprocessingModules = null;
function loadPostprocessingModules() {
  if (!postprocessingModules) {
    postprocessingModules = Promise.all([
    import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js'),
    import('three/addons/postprocessing/OutputPass.js'),
    import('three/addons/postprocessing/ShaderPass.js'),
    ]);
  }
  return postprocessingModules;
}

// ---- Telegram in-app browser / Mini App ----
// Vertical/side swipes can dismiss Telegram's webview. Mini Apps can call
// disableVerticalSwipes(); plain in-app browser only gets best-effort touch claiming.
function isTelegramEnvironment() {
  const tg = window.Telegram?.WebApp;
  if (tg && (typeof tg.initData === 'string' || tg.platform)) return true;
  return /Telegram/i.test(navigator.userAgent || '');
}

function initTelegramEnvironment() {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    try {
      tg.ready?.();
      tg.expand?.();
      if (typeof tg.disableVerticalSwipes === 'function') tg.disableVerticalSwipes();
    } catch (_) { /* older Telegram clients */ }
  }
  if (isTelegramEnvironment()) {
    document.documentElement.classList.add('telegram-webview');
  }
}
initTelegramEnvironment();
window.__telegramReady?.then(initTelegramEnvironment);

// ============================================================
// RENDERER / SCENE / CAMERA
// ============================================================
const canvas = document.getElementById('scene');
let renderer;
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
function renderPixelRatio() {
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
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.FogExp2(BG, 0.036);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 120);
const CAM_START = new THREE.Vector3(0, 9.5, 18.5);
const CAM_END = new THREE.Vector3(0, 3.05, 10.45);
const TARGET = new THREE.Vector3(0, 1.45, -0.3);
const ZOOM_IN_STEP = 0.82;
// Start two "+" presses closer than the original stage framing.
const START_ZOOM_FACTOR = ZOOM_IN_STEP ** 5;
// Guitar performance starts two "+" presses closer than its framing preset.
const GUITAR_FOCUS_ZOOM_FACTOR = ZOOM_IN_STEP ** 2;
// Allow two extra "+" presses past the previous closest zoom.
const EXTRA_ZOOM_IN_LEVELS = 2;
const STAGE_MIN_DISTANCE = 5 * (ZOOM_IN_STEP ** EXTRA_ZOOM_IN_LEVELS);
const FOCUSED_MIN_DISTANCE = 1.05 * (ZOOM_IN_STEP ** EXTRA_ZOOM_IN_LEVELS);

function pullCameraTowardTarget(point, factor = START_ZOOM_FACTOR) {
  point.sub(TARGET).multiplyScalar(factor).add(TARGET);
}

function fitCameraToViewport() {
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

const controls = new OrbitControls(camera, renderer.domElement);
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

// Mobile uses a MOBA-style tactical camera: one-finger drag scouts across the
// stage, then the follow spring recentres on the mascot. Instrument close-ups
// temporarily restore orbiting so every play surface can still be inspected.
function applyMobileOrbitPolicy() {
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  if (isMobileGameMode()) {
    controls.touches.ONE = THREE.TOUCH.PAN;
    controls.enableRotate = false;
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controls.maxTargetRadius = 2.65;
    controls.panSpeed = 0.72;
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

// ============================================================
// STAGE ENVIRONMENT
// ============================================================
function woodTexture() {
  // Staggered varnished planks + matching roughness map so the key light
  // produces streaky lacquer highlights instead of one flat pink wash.
  const SIZE = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const x = c.getContext('2d');
  const rough = document.createElement('canvas');
  rough.width = rough.height = SIZE;
  const rx = rough.getContext('2d');
  rx.fillStyle = '#8c8c8c';
  rx.fillRect(0, 0, SIZE, SIZE);

  const ROWS = 12;
  const H = SIZE / ROWS;
  for (let row = 0; row < ROWS; row++) {
    const y0 = row * H;
    const stagger = ((row % 3) / 3) * SIZE * 0.5;
    for (let seg = -1; seg < 3; seg++) {
      const x0 = seg * (SIZE / 2) + stagger;
      const w = SIZE / 2;
      const shade = 0.78 + Math.random() * 0.34;
      const warm = 0.92 + Math.random() * 0.16;
      const grad = x.createLinearGradient(x0, y0, x0, y0 + H);
      grad.addColorStop(0, `rgb(${118 * shade * warm | 0},${76 * shade | 0},${44 * shade | 0})`);
      grad.addColorStop(0.5, `rgb(${128 * shade * warm | 0},${84 * shade | 0},${50 * shade | 0})`);
      grad.addColorStop(1, `rgb(${106 * shade * warm | 0},${68 * shade | 0},${40 * shade | 0})`);
      x.fillStyle = grad;
      x.fillRect(x0, y0, w, H);
      // grain
      x.strokeStyle = `rgba(58,32,14,${0.16 + Math.random() * 0.18})`;
      x.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        const gy = y0 + 4 + Math.random() * (H - 8);
        x.beginPath();
        x.moveTo(x0, gy);
        x.bezierCurveTo(
          x0 + w * 0.3, gy + Math.random() * 8 - 4,
          x0 + w * 0.7, gy + Math.random() * 8 - 4,
          x0 + w, gy,
        );
        x.stroke();
      }
      // occasional knot
      if (Math.random() < 0.16) {
        const kx = x0 + 40 + Math.random() * (w - 80);
        const ky = y0 + H * (0.3 + Math.random() * 0.4);
        x.strokeStyle = 'rgba(52,28,12,.26)';
        x.lineWidth = 1.2;
        for (let r = 3; r < 9; r += 3.2) {
          x.beginPath();
          x.ellipse(kx, ky, r * 1.5, r, 0.15, 0, Math.PI * 2);
          x.stroke();
        }
      }
      // butt seam + nails
      x.fillStyle = 'rgba(28,14,7,.85)';
      x.fillRect(x0 + w - 2, y0, 3, H);
      x.fillStyle = 'rgba(30,20,14,.9)';
      x.beginPath();
      x.arc(x0 + w - 12, y0 + H * 0.28, 2.2, 0, Math.PI * 2);
      x.arc(x0 + w - 12, y0 + H * 0.72, 2.2, 0, Math.PI * 2);
      x.fill();
      // roughness: varnish streaks along the plank (dark = glossy)
      const glossy = 96 + ((Math.random() * 70) | 0);
      rx.fillStyle = `rgb(${glossy},${glossy},${glossy})`;
      rx.fillRect(x0, y0 + 2, w, H - 4);
      rx.fillStyle = 'rgba(215,215,215,.9)';
      rx.fillRect(x0, y0, w, 2.5);
    }
    // long row gap
    x.fillStyle = 'rgba(30,16,8,.7)';
    x.fillRect(0, y0 - 1, SIZE, 1.8);
    rx.fillStyle = 'rgb(225,225,225)';
    rx.fillRect(0, y0 - 1, SIZE, 1.8);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.6, 2.1);
  t.anisotropy = 8;
  const r = new THREE.CanvasTexture(rough);
  r.wrapS = r.wrapT = THREE.RepeatWrapping;
  r.repeat.set(2.6, 2.1);
  r.anisotropy = 4;
  return { map: t, roughnessMap: r };
}

function curtainTexture() {
  // Velvet with asymmetric fold lighting: broad lit face, tight shadow core,
  // subtle nap sparkle, and slight fold drift so pleats do not tile visibly.
  const c = document.createElement('canvas');
  c.width = 512; c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = '#1c0a28';
  x.fillRect(0, 0, 512, 1024);
  const FOLDS = 12;
  const fw = 512 / FOLDS;
  for (let i = 0; i < FOLDS; i++) {
    const x0 = i * fw;
    const drift = Math.sin(i * 2.7) * fw * 0.1;
    const g = x.createLinearGradient(x0 + drift, 0, x0 + fw + drift, 0);
    g.addColorStop(0, '#160722');
    g.addColorStop(0.22, '#3b1554');
    g.addColorStop(0.48, '#5c2478');
    g.addColorStop(0.58, '#6b2f88');
    g.addColorStop(0.72, '#43185e');
    g.addColorStop(1, '#160722');
    x.fillStyle = g;
    x.fillRect(x0 - 2, 0, fw + 4, 1024);
  }
  // velvet nap: faint vertical noise streaks
  for (let i = 0; i < 340; i++) {
    const sx = Math.random() * 512;
    const sy = Math.random() * 1024;
    const len = 20 + Math.random() * 90;
    x.strokeStyle = `rgba(${Math.random() < 0.5 ? '201,136,240' : '90,40,120'},${0.03 + Math.random() * 0.05})`;
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(sx, sy);
    x.lineTo(sx + Math.random() * 4 - 2, sy + len);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Plane with sinusoidal pleat depth so curtain silhouettes read as cloth from
// oblique camera angles, not as flat posters.
function makeCurtainGeometry(width, height, folds, depth) {
  const geo = new THREE.PlaneGeometry(width, height, folds * 6, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const u = (px / width + 0.5) * folds * Math.PI * 2;
    const taper = 0.75 + 0.25 * Math.sin((px / width) * Math.PI);
    pos.setZ(i, (Math.sin(u) * 0.5 + Math.sin(u * 0.5 + 1.3) * 0.5) * depth * taper);
  }
  geo.computeVertexNormals();
  return geo;
}

// title slide (first frame of the backdrop slideshow + fallback)
function titleSlideTexture() {
  const c = document.createElement('canvas');
  c.width = 1600; c.height = 900;
  const x = c.getContext('2d');
  x.fillStyle = '#160a20';
  x.fillRect(0, 0, 1600, 900);
  const glow = x.createRadialGradient(800, 430, 60, 800, 430, 700);
  glow.addColorStop(0, 'rgba(158,51,202,.4)');
  glow.addColorStop(1, 'rgba(158,51,202,0)');
  x.fillStyle = glow;
  x.fillRect(0, 0, 1600, 900);
  x.strokeStyle = '#D1A13B';
  x.lineWidth = 6;
  x.strokeRect(36, 36, 1528, 828);
  x.strokeStyle = 'rgba(209,161,59,.35)';
  x.lineWidth = 2;
  x.strokeRect(56, 56, 1488, 788);
  x.textAlign = 'center';
  x.fillStyle = '#D1A13B';
  x.shadowColor = '#9E33CA';
  x.shadowBlur = 60;
  x.font = 'italic 900 210px "Playfair Display", Georgia, serif';
  x.fillText('ART VIBE', 800, 445);
  x.shadowBlur = 22;
  x.fillStyle = '#c988f0';
  x.font = '500 62px "Unbounded", sans-serif';
  x.fillText('S T U D I O', 800, 560);
  x.shadowBlur = 0;
  x.fillStyle = '#FDFBF7';
  x.font = '700 38px "Unbounded", sans-serif';
  x.fillText('ВЧИСЬ ТВОРИТИ І ТВОРИ НАВЧАЮЧИСЬ', 800, 690);
  x.fillStyle = '#D1A13B';
  x.font = '400 30px "JetBrains Mono", monospace';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// small brand plate under the screen
function plateTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#160a20';
  x.fillRect(0, 0, 1024, 160);
  x.strokeStyle = '#D1A13B';
  x.lineWidth = 5;
  x.strokeRect(8, 8, 1008, 144);
  x.textAlign = 'center';
  x.fillStyle = '#D1A13B';
  x.font = '700 62px "Unbounded", sans-serif';
  x.fillText('ART VIBE STUDIO', 512, 103);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// speaker/monitor cloth: perforated grille with a soft top sheen
function perforatedTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const base = x.createLinearGradient(0, 0, 0, 256);
  base.addColorStop(0, '#242030');
  base.addColorStop(1, '#141018');
  x.fillStyle = base;
  x.fillRect(0, 0, 256, 256);
  for (let gy = 6; gy < 256; gy += 12) {
    for (let gx = 6 + ((gy / 12) % 2) * 6; gx < 256; gx += 12) {
      x.fillStyle = 'rgba(5,3,8,.9)';
      x.beginPath();
      x.arc(gx, gy, 3.1, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = 'rgba(120,105,140,.24)';
      x.beginPath();
      x.arc(gx - 0.8, gy - 0.8, 1.1, 0, Math.PI * 2);
      x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// soft round sprite shared by dust motes and star-drop pins so additive
// particles read as light points, not hard screen-space squares
let softDiscTextureCache = null;
function softDiscTexture() {
  if (softDiscTextureCache) return softDiscTextureCache;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const grad = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grad;
  x.fillRect(0, 0, 64, 64);
  softDiscTextureCache = new THREE.CanvasTexture(c);
  return softDiscTextureCache;
}

// soft radial blob for fake contact shadows under props and instruments
function contactShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const grad = x.createRadialGradient(128, 128, 12, 128, 128, 126);
  grad.addColorStop(0, 'rgba(4,2,8,.62)');
  grad.addColorStop(0.55, 'rgba(4,2,8,.4)');
  grad.addColorStop(1, 'rgba(4,2,8,0)');
  x.fillStyle = grad;
  x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

// ---- stage dressing: skirt, footlight hoods, proscenium, star drop,
// upstage truss, monitor wedges, cable runs, contact shadows ----
function buildStageDressing(g, { curtainMaterial, curtainLegGeometry } = {}) {
  const dressing = new THREE.Group();
  const aubergine = new THREE.MeshStandardMaterial({ color: 0x241433, roughness: 0.52, metalness: 0.12 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xD1A13B, metalness: 0.88, roughness: 0.3 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0x9a7428, metalness: 0.92, roughness: 0.38 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0c0913, roughness: 0.7 });
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const eul = new THREE.Euler();
  const vec = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);

  // -- stage skirt: paneled front + gold beading
  const skirtPanels = new THREE.InstancedMesh(new THREE.BoxGeometry(1.9, 0.5, 0.05), aubergine, 8);
  for (let i = 0; i < 8; i++) {
    matrix.makeTranslation(-7 + i * 2, -0.33, 4.03);
    skirtPanels.setMatrixAt(i, matrix);
  }
  skirtPanels.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  skirtPanels.computeBoundingSphere();
  dressing.add(skirtPanels);
  const beading = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.52, 6), goldMat, 9);
  for (let i = 0; i < 9; i++) {
    matrix.makeTranslation(-8 + i * 2, -0.33, 4.05);
    beading.setMatrixAt(i, matrix);
  }
  beading.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  beading.computeBoundingSphere();
  dressing.add(beading);

  // -- brass footlight hoods behind each bulb
  const hoods = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI),
    brassMat,
    9,
  );
  eul.set(-1.25, 0, 0);
  quat.setFromEuler(eul);
  for (let i = 0; i < 9; i++) {
    vec.set(-6 + i * 1.5, 0.055, 3.96);
    matrix.compose(vec, quat, one);
    hoods.setMatrixAt(i, matrix);
  }
  hoods.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  hoods.computeBoundingSphere();
  dressing.add(hoods);

  // -- proscenium: fluted columns + gold-trimmed header framing the stage
  const columnShaftGeometry = new THREE.CylinderGeometry(0.3, 0.36, 7.7, 14);
  const columnPlinthGeometry = new THREE.BoxGeometry(0.92, 0.52, 0.92);
  const columnCapitalGeometry = new THREE.BoxGeometry(0.95, 0.35, 0.95);
  const collarGeometry = new THREE.TorusGeometry(0.34, 0.035, 8, 18);
  for (const s of [-1, 1]) {
    const col = new THREE.Group();
    const plinth = new THREE.Mesh(columnPlinthGeometry, aubergine);
    plinth.position.y = -0.34;
    col.add(plinth);
    const shaft = new THREE.Mesh(columnShaftGeometry, aubergine);
    shaft.position.y = 3.77;
    col.add(shaft);
    for (const cy of [0.05, 7.45]) {
      const collar = new THREE.Mesh(collarGeometry, goldMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = cy;
      col.add(collar);
    }
    const capital = new THREE.Mesh(columnCapitalGeometry, aubergine);
    capital.position.y = 7.72;
    col.add(capital);
    col.position.set(s * 8.55, 0, 2.5);
    dressing.add(col);
  }
  const header = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.85, 0.7), aubergine);
  header.position.set(0, 8.32, 2.5);
  dressing.add(header);
  const headerTrim = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.1, 0.74), goldMat);
  headerTrim.position.set(0, 7.87, 2.5);
  dressing.add(headerTrim);
  const crest = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), goldMat);
  crest.position.set(0, 8.32, 2.87);
  dressing.add(crest);

  // -- star drop: pin lights across the back wall, instanced as one draw
  const starCount = 140;
  const starMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: softDiscTexture(),
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const stars = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.07, 0.07), starMat, starCount);
  const starColor = new THREE.Color();
  for (let i = 0; i < starCount; i++) {
    vec.set(
      (Math.random() - 0.5) * 27,
      0.5 + Math.random() * 9.6,
      -5.8,
    );
    matrix.makeTranslation(vec.x, vec.y, vec.z);
    stars.setMatrixAt(i, matrix);
    const warm = Math.random();
    starColor.setRGB(
      0.55 + warm * 0.45,
      0.45 + warm * 0.4,
      0.65 + Math.random() * 0.35,
    ).multiplyScalar(0.3 + Math.random() * 0.7);
    stars.setColorAt(i, starColor);
  }
  stars.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  if (stars.instanceColor) stars.instanceColor.setUsage(THREE.StaticDrawUsage);
  stars.computeBoundingSphere();
  dressing.add(stars);
  adaptiveQualityScene.starDrop = stars;
  stageAmbience.starMat = starMat;

  // -- upstage truss + clamps so the hanging screen spot reads as rigged
  const trussMat2 = new THREE.MeshStandardMaterial({ color: 0x1a1420, metalness: 0.7, roughness: 0.4 });
  const upstageBar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 13, 10), trussMat2);
  upstageBar.rotation.z = Math.PI / 2;
  upstageBar.position.set(0, 7.9, -2.5);
  dressing.add(upstageBar);
  const drops = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.045, 1.6, 8), trussMat2, 4);
  let dropIndex = 0;
  for (const dx of [-6.2, 6.2]) {
    for (const dz of [1.6, -2.5]) {
      const dy = dz > 0 ? 7.5 : 8.7;
      matrix.makeTranslation(dx, dy, dz);
      drops.setMatrixAt(dropIndex++, matrix);
    }
  }
  drops.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  drops.computeBoundingSphere();
  dressing.add(drops);
  const clamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.09, 0.13), darkMat, 5);
  const clampXs = [-4.6, -1.55, 1.55, 4.6, 0];
  for (let i = 0; i < clampXs.length; i++) {
    const cz = i === 4 ? -2.5 : 1.6;
    const cy = i === 4 ? 7.86 : 6.66;
    matrix.makeTranslation(clampXs[i], cy, cz);
    clamps.setMatrixAt(i, matrix);
  }
  clamps.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  clamps.computeBoundingSphere();
  dressing.add(clamps);

  // -- monitor wedges at the stage lip, angled back toward the performers
  const grilleTex = perforatedTexture();
  const grilleMat = new THREE.MeshStandardMaterial({ map: grilleTex, roughness: 0.85, metalness: 0.05 });
  for (const s of [-1, 1]) {
    const wedge = new THREE.Group();
    // No cast shadow: a 0.4-tall wedge at the stage lip throws its shadow off
    // the front edge, so it would only cost a shadow-pass draw call.
    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.4, 0.58), darkMat);
    wedge.add(shell);
    const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.32), grilleMat);
    grille.position.set(0, 0.03, -0.295);
    grille.rotation.y = Math.PI;
    wedge.add(grille);
    const jack = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.03), trussMat2);
    jack.position.set(0.3, -0.08, 0.295);
    wedge.add(jack);
    wedge.position.set(s * 2.35, 0.23, 3.42);
    wedge.rotation.x = 0.6;
    wedge.rotation.y = s * 0.14;
    dressing.add(wedge);
    g.userData.walkColliderRoots.push({ id: `monitor-${s < 0 ? 'left' : 'right'}`, root: wedge });
  }

  // -- cable runs + gaffer tape (hidden on the low tier)
  const cableGroup = new THREE.Group();
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x131019, roughness: 0.9, metalness: 0.05 });
  const cablePaths = [
    [[-6.1, 3.15], [-6.9, 2.2], [-7.4, 0.2], [-7.7, -2.2], [-7.8, -3.6]],
    [[6.1, 3.15], [7.0, 2.4], [7.5, 0.4], [7.7, -2.0], [7.8, -3.6]],
    [[1.15, 2.32], [2.4, 2.15], [4.2, 1.4], [6.2, 0.4], [7.5, -0.6]],
  ];
  for (const path of cablePaths) {
    const curve = new THREE.CatmullRomCurve3(path.map(([px, pz]) => new THREE.Vector3(px, 0.016, pz)));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 22, 0.021, 6), cableMat);
    cableGroup.add(tube);
  }
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0x2e2937, roughness: 0.6 });
  const tape = new THREE.InstancedMesh(new THREE.BoxGeometry(0.17, 0.006, 0.11), tapeMat, 6);
  const tapeSpots = [[-6.9, 2.2, 0.5], [-7.5, -1.0, 0.15], [6.95, 2.35, -0.4], [7.6, -0.8, 0.1], [3.2, 1.85, -0.9], [5.9, 0.55, -0.75]];
  for (let i = 0; i < tapeSpots.length; i++) {
    eul.set(0, tapeSpots[i][2], 0);
    quat.setFromEuler(eul);
    vec.set(tapeSpots[i][0], 0.03, tapeSpots[i][1]);
    matrix.compose(vec, quat, one);
    tape.setMatrixAt(i, matrix);
  }
  tape.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  tape.computeBoundingSphere();
  cableGroup.add(tape);
  dressing.add(cableGroup);
  adaptiveQualityScene.lowTierDressing.push(cableGroup, drops, clamps);

  // -- off-stage wing fill so wide framings never read as empty void:
  // extra drape stacks, stacked road cases, and a lighting boom
  if (curtainMaterial && curtainLegGeometry) {
    for (const [wx, wz, wr] of [[-9.9, -2.3, 0.4], [9.9, -2.3, -0.4], [-11.2, -0.4, 0.55], [11.2, -0.4, -0.55]]) {
      const wingDrape = new THREE.Mesh(curtainLegGeometry, curtainMaterial);
      wingDrape.position.set(wx, 3.75, wz);
      wingDrape.rotation.y = wr;
      dressing.add(wingDrape);
    }
  }
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x191423, roughness: 0.62, metalness: 0.22 });
  const caseTrimMat = new THREE.MeshStandardMaterial({ color: 0x8f93a5, roughness: 0.35, metalness: 0.85 });
  const roadCases = new THREE.InstancedMesh(new THREE.BoxGeometry(1.15, 0.78, 0.62), caseMat, 5);
  const caseLids = new THREE.InstancedMesh(new THREE.BoxGeometry(1.19, 0.05, 0.66), caseTrimMat, 5);
  const caseSpots = [
    [-9.55, 0.32, 0.7, 0.28], [-9.55, 1.12, 0.7, 0.28], [-9.35, 0.32, 1.9, -0.15],
    [9.65, 0.32, 1.1, -0.3], [9.5, 1.12, 1.1, -0.3],
  ];
  for (let i = 0; i < caseSpots.length; i++) {
    const [cx, cy, cz, cr] = caseSpots[i];
    eul.set(0, cr, 0);
    quat.setFromEuler(eul);
    vec.set(cx, cy - 0.6, cz);
    matrix.compose(vec, quat, one);
    roadCases.setMatrixAt(i, matrix);
    vec.y += 0.41;
    matrix.compose(vec, quat, one);
    caseLids.setMatrixAt(i, matrix);
  }
  for (const inst of [roadCases, caseLids]) {
    inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    inst.computeBoundingSphere();
    dressing.add(inst);
  }
  const boomMat = new THREE.MeshStandardMaterial({ color: 0x1a1420, metalness: 0.7, roughness: 0.4 });
  const boomPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 6.2, 8), boomMat);
  boomPole.position.set(-9.15, 2.5, 1.9);
  dressing.add(boomPole);
  const boomArm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.6, 8), boomMat);
  boomArm.rotation.z = Math.PI / 2.3;
  boomArm.position.set(-8.75, 5.35, 1.9);
  dressing.add(boomArm);
  const boomHead = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.3, 10), boomMat);
  boomHead.position.set(-8.25, 5.05, 1.9);
  boomHead.rotation.z = 0.7;
  dressing.add(boomHead);

  // -- fake contact shadows grounding instruments and props
  const shadowTex = contactShadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const contacts = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), shadowMat, 8);
  const contactSpots = [
    [-2.8, -1.7, 3.1, 2.6],   // drums
    [-1.35, 1.75, 1.5, 1.3],  // guitar
    [1.0, 2.4, 1.05, 1.05],   // mic
    [3.5, -1.3, 3.2, 2.2],    // piano
    [-6.4, 3.2, 1.9, 1.7],    // speaker L
    [6.4, 3.2, 1.9, 1.7],     // speaker R
    [-2.35, 3.42, 1.15, 0.85],// monitor L
    [2.35, 3.42, 1.15, 0.85], // monitor R
  ];
  eul.set(-Math.PI / 2, 0, 0);
  quat.setFromEuler(eul);
  for (let i = 0; i < contactSpots.length; i++) {
    const [cx, cz, sx, sz] = contactSpots[i];
    vec.set(cx, 0.014, cz);
    matrix.compose(vec, quat, new THREE.Vector3(sx, sz, 1));
    contacts.setMatrixAt(i, matrix);
  }
  contacts.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  contacts.computeBoundingSphere();
  contacts.renderOrder = 1;
  dressing.add(contacts);

  g.add(dressing);
}

function buildStage() {
  const g = new THREE.Group();
  g.userData.walkColliderRoots = [];

  // venue floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    // Keep the under-stage floor visually neutral. Real spotlights without
    // mobile shadow maps otherwise shine through the platform onto this plane,
    // which looks like volumetric beam geometry hanging over the void.
    new THREE.MeshBasicMaterial({ color: 0x07040d, fog: true })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.6;
  g.add(floor);

  // stage platform
  const wood = woodTexture();
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x2a1038, roughness: 0.6 });
  const topMat = new THREE.MeshStandardMaterial({
    map: wood.map,
    roughnessMap: wood.roughnessMap,
    roughness: 1.0,
    metalness: 0.06,
  });
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.6, 9),
    [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]
  );
  platform.position.set(0, -0.3, -0.5);
  platform.receiveShadow = true;
  g.add(platform);

  // gold trim on front edge
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.07, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xD1A13B, metalness: 0.85, roughness: 0.3 })
  );
  trim.position.set(0, -0.02, 4.02);
  g.add(trim);

  const lowEndLighting = isLowEndMobileGameMode();
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0x332211,
    emissive: 0xD1A13B,
    emissiveIntensity: 1.3,
    roughness: 0.5,
  });
  registerDimmableEmissive(bulbMat);
  stageAmbience.footPulse = { mat: bulbMat, matBase: 1.3, lights: [], lightBase: 6 };
  const bulbGeom = new THREE.SphereGeometry(0.05, 10, 8);
  const bulbs = new THREE.InstancedMesh(bulbGeom, bulbMat, 9);
  const bulbMatrix = new THREE.Matrix4();
  for (let i = 0; i < 9; i++) {
    const x = -6 + i * 1.5;
    bulbs.setMatrixAt(i, bulbMatrix.makeTranslation(x, 0.06, 3.9));
    // Bulbs retain their emissive look. The five tiny point lights, however,
    // are evaluated by every PBR fragment and are not perceptible on a phone.
    if (i % 2 === 0 && (!lowEndLighting || canUpgradeMobileQuality)) {
      const pl = new THREE.PointLight(0xffc878, 6, 4.2, 2);
      pl.position.set(x, 0.22, 3.65);
      g.add(pl);
      adaptiveQualityScene.bulbLights.push(pl);
      stageAmbience.footPulse.lights.push(pl);
      registerDimmableLight(pl);
    }
  }
  bulbs.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  bulbs.computeBoundingSphere();
  g.add(bulbs);

  // backdrop wall
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 12),
    new THREE.MeshStandardMaterial({ color: 0x15091f, roughness: 0.95 })
  );
  wall.position.set(0, 5, -5.85);
  g.add(wall);

  // curtains — pleated velvet with a warm sheen response
  const curt = curtainTexture();
  const curtMat = new THREE.MeshStandardMaterial({
    map: curt,
    roughness: 0.86,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const sideCurtainGeometry = makeCurtainGeometry(3.4, 9.4, 6, 0.22);
  stageAmbience.curtains.length = 0;
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(sideCurtainGeometry, curtMat);
    c.position.set(s * 7.9, 4.1, -3.9);
    c.rotation.y = -s * 0.3;
    c.userData.baseRotY = c.rotation.y;
    c.userData.side = s;
    c.castShadow = false;
    g.add(c);
    stageAmbience.curtains.push(c);
  }
  // upstage curtain legs: a second wing layer that gives the stage depth
  const legGeometry = makeCurtainGeometry(2.6, 9.2, 5, 0.18);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(legGeometry, curtMat);
    leg.position.set(s * 5.7, 4.05, -5.1);
    leg.rotation.y = -s * 0.12;
    g.add(leg);
  }
  const valance = new THREE.Mesh(makeCurtainGeometry(19.5, 1.7, 14, 0.14), curtMat.clone());
  valance.position.set(0, 8.15, -4.1);
  valance.userData.baseY = valance.position.y;
  g.add(valance);
  stageAmbience.valance = valance;
  const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xD1A13B, metalness: 0.85, roughness: 0.32 });
  const valanceTrim = new THREE.Mesh(new THREE.BoxGeometry(19.5, 0.09, 0.05), goldTrimMat);
  valanceTrim.position.set(0, 7.32, -4.06);
  g.add(valanceTrim);
  // gold fringe under the valance: instanced tassel drops
  const fringe = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.014, 0.008, 0.22, 5),
    goldTrimMat,
    64,
  );
  const fringeMatrix = new THREE.Matrix4();
  for (let i = 0; i < 64; i++) {
    fringeMatrix.makeTranslation(-9.45 + i * 0.3, 7.22, -4.08);
    fringe.setMatrixAt(i, fringeMatrix);
  }
  fringe.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  fringe.computeBoundingSphere();
  g.add(fringe);

  // backdrop slideshow screen (replaces the old static banner)
  g.add(buildScreen());

  // speaker stacks
  const spkMat = new THREE.MeshStandardMaterial({ color: 0x0d0a12, roughness: 0.55 });
  const coneMat = new THREE.MeshStandardMaterial({ color: 0x1f1a26, roughness: 0.8 });
  const speakerBoxGeometry = new THREE.BoxGeometry(1.15, 2.0, 0.95);
  const speakerPlateGeometry = new THREE.BoxGeometry(0.4, 0.12, 0.02);
  const speakerPlateMaterial = new THREE.MeshStandardMaterial({
    color: 0xD1A13B,
    metalness: 0.8,
    roughness: 0.3,
  });
  const speakerGrilleMaterial = new THREE.MeshStandardMaterial({
    map: perforatedTexture(),
    roughness: 0.85,
    metalness: 0.05,
  });
  const speakerPipingGeometry = new THREE.BoxGeometry(0.04, 2.0, 0.04);
  const casterGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10);
  const casterMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1722, metalness: 0.6, roughness: 0.5 });
  for (const s of [-1, 1]) {
    const spk = new THREE.Group();
    const box = new THREE.Mesh(speakerBoxGeometry, spkMat);
    box.position.y = 1.0;
    box.castShadow = true;
    spk.add(box);
    // recessed cloth grille behind the cones
    const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 1.8), speakerGrilleMaterial);
    grille.position.set(0, 1.0, 0.477);
    spk.add(grille);
    for (const [ry, rr] of [[1.45, 0.34], [0.75, 0.24]]) {
      const woofer = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr * 0.7, 0.08, 24), coneMat);
      woofer.rotation.x = Math.PI / 2;
      woofer.position.set(0, ry, 0.5);
      spk.add(woofer);
      const dustCap = new THREE.Mesh(new THREE.SphereGeometry(rr * 0.28, 10, 8), spkMat);
      dustCap.position.set(0, ry, 0.53);
      spk.add(dustCap);
    }
    // gold piping down the front corners + casters grounding the cab
    const piping = new THREE.InstancedMesh(speakerPipingGeometry, speakerPlateMaterial, 2);
    const casters = new THREE.InstancedMesh(casterGeometry, casterMaterial, 4);
    const hardwareMatrix = new THREE.Matrix4();
    [[-0.55], [0.55]].forEach(([px], i) => {
      piping.setMatrixAt(i, hardwareMatrix.makeTranslation(px, 1.0, 0.46));
    });
    [[-0.45, 0.35], [0.45, 0.35], [-0.45, -0.35], [0.45, -0.35]].forEach(([cx, cz], i) => {
      casters.setMatrixAt(i, hardwareMatrix.makeTranslation(cx, 0.02, cz));
    });
    for (const inst of [piping, casters]) {
      inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      inst.computeBoundingSphere();
      spk.add(inst);
    }
    const plate = new THREE.Mesh(
      speakerPlateGeometry,
      speakerPlateMaterial,
    );
    plate.position.set(0, 1.92, 0.49);
    spk.add(plate);
    spk.position.set(s * 6.4, 0, 3.2);
    spk.rotation.y = -s * 0.35;
    g.add(spk);
    g.userData.walkColliderRoots.push({ id: `speaker-${s < 0 ? 'left' : 'right'}`, root: spk });
  }

  buildStageDressing(g, { curtainMaterial: curtMat, curtainLegGeometry: legGeometry });

  return g;
}

// ---- backdrop screen: shader slideshow w/ crossfade + Ken Burns ----
const screenUniforms = {
  texA: { value: null },
  texB: { value: null },
  progress: { value: 0 },
  slideT: { value: 0 },
  pan: { value: new THREE.Vector2(0.02, 0.008) },
  dim: { value: 0.94 },
};
let slideshowScreen = null;

function buildScreen() {
  const g = new THREE.Group();

  const frameBack = new THREE.Mesh(
    new THREE.PlaneGeometry(8.06, 4.68),
    new THREE.MeshBasicMaterial({ color: 0x0d0714, fog: false })
  );
  frameBack.position.set(0, 5.35, -5.5);
  g.add(frameBack);

  const frameGold = new THREE.Mesh(
    new THREE.PlaneGeometry(7.9, 4.52),
    new THREE.MeshBasicMaterial({ color: 0xD1A13B, fog: false })
  );
  frameGold.position.set(0, 5.35, -5.48);
  g.add(frameGold);

  const titleTex = titleSlideTexture();
  screenUniforms.texA.value = titleTex;
  screenUniforms.texB.value = titleTex;

  const screenMat = new THREE.ShaderMaterial({
    uniforms: screenUniforms,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D texA, texB;
      uniform float progress, slideT, dim;
      uniform vec2 pan;
      varying vec2 vUv;
      vec2 kenburns(vec2 uv, float t, vec2 p) {
        float z = 1.0 + 0.09 * t;
        return (uv - 0.5 - p * t) / z + 0.5;
      }
      void main() {
        vec4 a = texture2D(texA, kenburns(vUv, slideT, pan));
        vec4 b = texture2D(texB, kenburns(vUv, 0.0, -pan));
        vec4 c = mix(a, b, smoothstep(0.0, 1.0, progress));
        float vig = smoothstep(1.0, 0.45, distance(vUv, vec2(0.5)));
        gl_FragColor = vec4(c.rgb * dim * (0.72 + 0.28 * vig), 1.0);
      }`,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 4.275), screenMat);
  screen.position.set(0, 5.35, -5.45);
  slideshowScreen = screen;
  g.add(screen);

  // brand plate under the screen
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(3.5, 0.55),
    new THREE.MeshBasicMaterial({ map: plateTexture(), fog: false })
  );
  plate.position.set(0, 2.62, -5.45);
  g.add(plate);

  return g;
}

// ---- slideshow state ----
// Temporary launch setting: keep the branded Art Vibe title on the stage screen
// and do not load or rotate through promotional photos.
const PHOTO_SLIDES_ENABLED = false;
const ss = { texs: [], i: -1, t: 0, SLIDE: 5.5, FADE: 1.5, started: false };
const slideshowNav = document.getElementById('slideshow-nav');
const screenCorners = [
  new THREE.Vector3(-3.8, -2.1375, 0),
  new THREE.Vector3(3.8, -2.1375, 0),
  new THREE.Vector3(3.8, 2.1375, 0),
  new THREE.Vector3(-3.8, 2.1375, 0),
];
const screenCenterWorld = new THREE.Vector3();
const screenNormalWorld = new THREE.Vector3();
const screenQuaternionWorld = new THREE.Quaternion();
const screenTowardCamera = new THREE.Vector3();
const projectedScreenCorners = screenCorners.map(() => new THREE.Vector3());
const slideshowLayoutCache = {
  initialized: false,
  width: 0,
  height: 0,
  cameraWorld: new THREE.Matrix4(),
  projection: new THREE.Matrix4(),
  screenWorld: new THREE.Matrix4(),
};

function setSlideshowNavStyle(property, value) {
  if (slideshowNav.style[property] !== value) slideshowNav.style[property] = value;
}

function updateSlideshowNavLayout() {
  if (slideshowNav.hidden || !slideshowScreen) return;
  slideshowScreen.updateWorldMatrix(true, false);
  camera.updateMatrixWorld();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  if (
    slideshowLayoutCache.initialized
    && slideshowLayoutCache.width === viewportWidth
    && slideshowLayoutCache.height === viewportHeight
    && slideshowLayoutCache.cameraWorld.equals(camera.matrixWorld)
    && slideshowLayoutCache.projection.equals(camera.projectionMatrix)
    && slideshowLayoutCache.screenWorld.equals(slideshowScreen.matrixWorld)
  ) return;
  slideshowLayoutCache.initialized = true;
  slideshowLayoutCache.width = viewportWidth;
  slideshowLayoutCache.height = viewportHeight;
  slideshowLayoutCache.cameraWorld.copy(camera.matrixWorld);
  slideshowLayoutCache.projection.copy(camera.projectionMatrix);
  slideshowLayoutCache.screenWorld.copy(slideshowScreen.matrixWorld);

  slideshowScreen.getWorldPosition(screenCenterWorld);
  slideshowScreen.getWorldQuaternion(screenQuaternionWorld);
  screenNormalWorld.set(0, 0, 1).applyQuaternion(screenQuaternionWorld);
  screenTowardCamera.copy(camera.position).sub(screenCenterWorld).normalize();
  const facingCamera = screenNormalWorld.dot(screenTowardCamera);
  if (facingCamera <= 0.02) {
    setSlideshowNavStyle('visibility', 'hidden');
    return;
  }

  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  let inFront = true;
  for (let i = 0; i < screenCorners.length; i++) {
    const point = projectedScreenCorners[i]
      .copy(screenCorners[i])
      .applyMatrix4(slideshowScreen.matrixWorld)
      .project(camera);
    const x = (point.x * 0.5 + 0.5) * viewportWidth;
    const y = (-point.y * 0.5 + 0.5) * viewportHeight;
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
    inFront &&= point.z > -1 && point.z < 1;
  }
  const width = right - left;
  const height = bottom - top;
  const onScreen = right > 0 && left < viewportWidth && bottom > 0 && top < viewportHeight;
  if (!onScreen || !inFront || width < 70 || height < 45) {
    setSlideshowNavStyle('visibility', 'hidden');
    return;
  }

  setSlideshowNavStyle('visibility', 'visible');
  setSlideshowNavStyle('left', `${left}px`);
  setSlideshowNavStyle('top', `${top}px`);
  setSlideshowNavStyle('width', `${width}px`);
  setSlideshowNavStyle('height', `${height}px`);
}

function setSlide(index) {
  if (!ss.started || !ss.texs.length) return;
  const count = ss.texs.length;
  ss.i = ((index % count) + count) % count;
  ss.t = 0;
  screenUniforms.texA.value = ss.texs[ss.i];
  screenUniforms.texB.value = ss.texs[(ss.i + 1) % count];
  screenUniforms.progress.value = 0;
  screenUniforms.slideT.value = 0;
  screenUniforms.pan.value.set(
    (ss.i % 2 ? -1 : 1) * 0.025,
    ((ss.i % 3) - 1) * 0.012
  );
}

function stepSlide(delta) {
  if (!ss.started) return;
  const visibleIndex = screenUniforms.progress.value > 0.5 ? ss.i + 1 : ss.i;
  setSlide(visibleIndex + delta);
}

let slideSwipe = null;
slideshowNav.addEventListener('pointerdown', (event) => {
  slideSwipe = { x: event.clientX, y: event.clientY, id: event.pointerId };
  slideshowNav.setPointerCapture?.(event.pointerId);
});
slideshowNav.addEventListener('pointerup', (event) => {
  if (!slideSwipe || slideSwipe.id !== event.pointerId) return;
  const dx = event.clientX - slideSwipe.x;
  const dy = event.clientY - slideSwipe.y;
  slideSwipe = null;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.25) stepSlide(dx < 0 ? 1 : -1);
});
slideshowNav.addEventListener('pointercancel', () => { slideSwipe = null; });

function loadSlideImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load slide: ${file}`));
    image.src = file;
  });
}

async function makeSlideTexture(file) {
  const image = await loadSlideImage(file);
  const maxDimension = isMobileGameMode() ? 1024 : 1600;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvasImage = document.createElement('canvas');
  canvasImage.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvasImage.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvasImage.getContext('2d', { alpha: false });
  context.drawImage(image, 0, 0, canvasImage.width, canvasImage.height);

  const texture = new THREE.CanvasTexture(canvasImage);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = isMobileGameMode()
    ? 1
    : Math.min(4, renderer.capabilities.getMaxAnisotropy());
  texture.userData.sourceFile = file;
  return texture;
}

function waitForSlideLoadBudget() {
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => resolve(), { timeout: 800 });
    } else {
      window.setTimeout(resolve, 80);
    }
  });
}

async function loadSlideTextures() {
  const fallbackFiles = ['img/wicked-ensemble.jpg', 'img/wicked-cast.jpg', 'img/wicked-duet.jpg', 'img/stage-guitar.jpg'];

  // `slides.json` is the complete manifest of images in /img that belong in the slideshow.
  // Keeping it separate lets the stage load every supplied slide without bundling a stale list in the app.
  const files = await fetch('img/slides.json')
    .then((response) => response.ok ? response.json() : fallbackFiles)
    .then((files) => Array.isArray(files) && files.length ? files : fallbackFiles)
    .catch(() => fallbackFiles);

  let loaded = 0;
  const debugTimelineTextures = [];
  const deferDebugTimeline = params.has('sstime');
  for (const file of files) {
    if (loaded > 0) await waitForSlideLoadBudget();
    try {
      const texture = await makeSlideTexture(file);
      if (deferDebugTimeline) debugTimelineTextures.push(texture);
      else if (!ss.started) startSlideshow([texture]);
      else ss.texs.push(texture);
      loaded++;
      window.__dbg = `slideshow loaded: ${loaded}/${files.length}`;
    } catch (_) {
      /* A missing promotional image should not block the scene. */
    }
  }
  if (deferDebugTimeline && debugTimelineTextures.length) {
    startSlideshow(debugTimelineTextures);
  }
  return loaded;
}

function startSlideshow(photos) {
  ss.texs = [screenUniforms.texA.value, ...photos]; // title slide stays in rotation
  ss.i = 0; // texs[0] (title) is currently shown
  ss.t = 0; // hold frame 0 (the Art Vibe title) for a complete slide interval
  screenUniforms.progress.value = 0;
  screenUniforms.texB.value = ss.texs[1] || ss.texs[0];
  ss.started = true;
  slideshowNav.hidden = false;
  window.__dbg = `slideshow started: ${ss.texs.length} slides`;

  // debug: fast-forward slideshow timeline (?sstime=SECONDS)
  const ff = Number(params.get('sstime') || 0);
  if (ff > 0) {
    const cycle = ss.SLIDE + ss.FADE;
    const wraps = Math.floor(ff / cycle);
    ss.i = wraps % ss.texs.length;
    screenUniforms.texA.value = ss.texs[ss.i];
    screenUniforms.texB.value = ss.texs[(ss.i + 1) % ss.texs.length];
    ss.t = ff % cycle;
  }
}

function updateSlideshow(dt) {
  if (!ss.started || ss.texs.length < 2) return;
  ss.t += dt;
  const cycle = ss.SLIDE + ss.FADE;
  if (ss.t >= cycle) {
    ss.t -= cycle;
    ss.i = (ss.i + 1) % ss.texs.length;
    screenUniforms.texA.value = ss.texs[ss.i];
    screenUniforms.texB.value = ss.texs[(ss.i + 1) % ss.texs.length];
    screenUniforms.pan.value.set(
      (ss.i % 2 ? -1 : 1) * 0.025,
      ((ss.i % 3) - 1) * 0.012
    );
  }
  screenUniforms.progress.value = THREE.MathUtils.clamp((ss.t - ss.SLIDE) / ss.FADE, 0, 1);
  screenUniforms.slideT.value = Math.min(1, ss.t / cycle);
}

// ---- truss + spotlights + visible cones ----
const spotHeads = [];
const STAGE_BEAM_BOUNDS = new THREE.Vector4(-7.98, 7.98, -4.98, 3.98);

function visibleBeamMaterial(color, clipToStage = false) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.06,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });

  // Every beam dissolves toward its wide base instead of terminating in a hard
  // cut: the open cylinder's bright rim otherwise reads as a dark circle
  // "sitting" at the base of the light against the backdrop. Cylinder UV v runs
  // 1 at the fixture (narrow top) to 0 at the base, so fading on v kills the
  // rim while the upper beam keeps its punch. The clipped variant additionally
  // masks the shell to the platform footprint so nothing hangs over the void.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.stageBeamBounds = { value: STAGE_BEAM_BOUNDS };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vBeamWorldPosition;\nvarying float vBeamAxial;',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vBeamWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vBeamAxial = uv.y;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec4 stageBeamBounds;\nvarying vec3 vBeamWorldPosition;\nvarying float vBeamAxial;',
      )
      .replace(
        '#include <opaque_fragment>',
        `
          diffuseColor.a *= smoothstep(0.0, 0.55, vBeamAxial);
          ${clipToStage ? `
          float beamFade = 0.24;
          float beamStageMask =
            smoothstep(stageBeamBounds.x, stageBeamBounds.x + beamFade, vBeamWorldPosition.x) *
            (1.0 - smoothstep(stageBeamBounds.y - beamFade, stageBeamBounds.y, vBeamWorldPosition.x)) *
            smoothstep(stageBeamBounds.z, stageBeamBounds.z + beamFade, vBeamWorldPosition.z) *
            (1.0 - smoothstep(stageBeamBounds.w - beamFade, stageBeamBounds.w, vBeamWorldPosition.z));
          diffuseColor.a *= beamStageMask;` : ''}
          if (diffuseColor.a < 0.001) discard;
          #include <opaque_fragment>
        `,
      );
  };
  material.customProgramCacheKey = () => `axial-fade-visible-beam-v2-${clipToStage ? 'clipped' : 'open'}`;
  return material;
}

/** Dim procedural HDR for lacquer/chrome reflections (no external assets). */
function installStageEnvironment() {
  try {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, '#2e163f');
    sky.addColorStop(0.42, '#160e22');
    sky.addColorStop(0.55, '#0c0714');
    sky.addColorStop(1, '#05030a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 512, 256);
    // Soft key / fill panels — keep alpha modest (r160 has no environmentIntensity).
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#ffe2b0';
    ctx.fillRect(10, 88, 72, 52);
    ctx.fillRect(430, 88, 72, 52);
    ctx.fillStyle = '#9E33CA';
    ctx.fillRect(208, 22, 96, 38);
    ctx.fillStyle = '#D1A13B';
    ctx.fillRect(228, 198, 56, 30);
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
    pmrem.dispose();
  } catch (_) {
    /* env is optional polish */
  }
}

function buildLights() {
  const g = new THREE.Group();
  // Soft sky/ground gradient instead of flat wash — spots keep their punch.
  const hemi = new THREE.HemisphereLight(0x6a4a88, 0x1a0e22, 0.48);
  const ambient = new THREE.AmbientLight(0x584a74, 0.16);
  g.add(hemi);
  g.add(ambient);
  registerDimmableLight(hemi);
  registerDimmableLight(ambient);

  // Cool rim from upstage separates performers/instruments from the backdrop
  // without lifting the overall exposure. Culled on the low mobile tier.
  if (!isLowEndMobileGameMode() || canUpgradeMobileQuality) {
    const rim = new THREE.SpotLight(0x7a5cff, 185, 26, 0.72, 0.9, 1.5);
    rim.position.set(0, 7.4, -5.2);
    rim.target.position.set(0, 1.1, 2.4);
    g.add(rim, rim.target);
    adaptiveQualityScene.lowPrioritySpots.push(rim);
    registerDimmableLight(rim);
  }

  // truss bar
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x1a1420, metalness: 0.7, roughness: 0.4 });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 13, 10), trussMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 6.7, 1.6);
  g.add(bar);

  const spots = [
    { x: -4.6, color: 0x9E33CA, intensity: 540, target: new THREE.Vector3(-2.8, 1.0, -1.7), coneR: 1.7, coneFloorY: 0.025, sweep: 0.05 },
    { x: -1.55, color: 0xD1A13B, intensity: 450, target: new THREE.Vector3(-1.35, 0.8, 1.75), coneR: 1.3, coneFloorY: 0.025, lowPriority: true },
    // Key light: the only shadow caster, aimed at the downstage performer spot
    // so the mascot starts lit and grounded. Its pool also washes the mic.
    { x: 1.05, color: 0xfff0d8, intensity: 300, target: new THREE.Vector3(0.25, 1.15, 2.3), coneR: 1.55, coneFloorY: 0.025, shadow: true },
    { x: 4.6, color: 0xD1A13B, intensity: 500, target: new THREE.Vector3(3.5, 1.0, -1.3), coneR: 1.7, coneFloorY: 0.025, sweep: -0.05 },
    { x: 0, color: 0x7a1fa2, intensity: 250, target: new THREE.Vector3(0, 5.35, -5.45), coneR: 2.6, y: 7.6, z: -2.5, lowPriority: true },
  ];

  // broad warm front fill (no visible cone) so instruments read well
  // Front-of-house fill: the key light comes from the truss above, so this is
  // what actually keeps faces readable under a hairline. Broad and soft.
  const fill = new THREE.SpotLight(0xffe8c8, 125, 45, 0.62, 0.9, 1.8);
  fill.position.set(0, 7.5, 14);
  fill.target.position.set(0, 0.8, 0);
  g.add(fill, fill.target);
  registerDimmableLight(fill);

  const spotlightHousingGeometry = new THREE.CylinderGeometry(0.09, 0.13, 0.3, 12);
  const spotlightLensGeometry = new THREE.CircleGeometry(0.1, 16);
  const spotlightYokeGeometry = new THREE.TorusGeometry(0.11, 0.016, 6, 14, Math.PI);
  for (const s of spots) {
    const y = s.y ?? 6.62, z = s.z ?? 1.6;
    // Fixture mount: head, light, target, and beam share one pivot so the two
    // outer spots can sweep as a unit like concert moving heads.
    const mount = new THREE.Group();
    mount.position.set(s.x, y, z);
    g.add(mount);
    mount.updateMatrixWorld(true);

    const head = new THREE.Group();
    const housing = new THREE.Mesh(spotlightHousingGeometry, trussMat);
    head.add(housing);
    const yokeArm = new THREE.Mesh(spotlightYokeGeometry, trussMat);
    yokeArm.position.y = 0.2;
    head.add(yokeArm);
    const lens = new THREE.Mesh(
      spotlightLensGeometry,
      new THREE.MeshBasicMaterial({ color: s.color, fog: false })
    );
    lens.position.y = -0.16;
    lens.rotation.x = Math.PI / 2;
    head.add(lens);
    mount.add(head);
    head.lookAt(s.target);
    head.rotateX(Math.PI / 2);
    spotHeads.push({ head, lensMat: lens.material, base: s.color, mount, sweep: s.sweep || 0 });

    // Keep every visible fixture and beam but omit the two least noticeable
    // real light sources on the low tier. This reduces per-fragment PBR work
    // without making the truss look incomplete.
    if (!isLowEndMobileGameMode() || !s.lowPriority || canUpgradeMobileQuality) {
      // Shadow-casting fixtures get a tighter cone: it reads more like a real
      // followspot and shrinks the shadow frustum to the performers in it.
      const spot = new THREE.SpotLight(s.color, s.intensity, 30, s.shadow ? 0.4 : 0.47, 0.78, 1.6);
      spot.position.set(0, 0, 0);
      spot.target.position.set(s.target.x - s.x, s.target.y - y, s.target.z - z);
      if (s.shadow) {
        spot.castShadow = !isLowEndMobileGameMode();
        const shadowSize = isMobileGameMode() ? 512 : 2048;
        spot.shadow.mapSize.set(shadowSize, shadowSize);
        spot.shadow.bias = -0.0002;
        spot.shadow.normalBias = 0.035;
        spot.shadow.focus = 1;
        spot.shadow.camera.near = 1.5;
        // Tight far plane: the pool is ~7 units below the truss, so anything
        // past this cannot cast into it and would only cost shadow draw calls.
        spot.shadow.camera.far = 9.5;
        spot.shadow.camera.updateProjectionMatrix();
        adaptiveQualityScene.shadowSpots.push(spot);
      }
      if (s.lowPriority) adaptiveQualityScene.lowPrioritySpots.push(spot);
      mount.add(spot, spot.target);
      registerDimmableLight(spot);
    }

    // Visible beam: SpotLight targets steer the light but do not stop it.
    // Extend stage beams along the same ray until they meet the platform top,
    // otherwise the decorative cone appears to hover above the illuminated floor.
    const from = new THREE.Vector3(s.x, y, z);
    const targetVector = new THREE.Vector3().subVectors(s.target, from);
    const coneEnd = s.target.clone();
    let coneEndRadius = s.coneR;
    if (Number.isFinite(s.coneFloorY) && Math.abs(targetVector.y) > 0.0001) {
      const floorScale = (s.coneFloorY - from.y) / targetVector.y;
      if (floorScale > 0) {
        coneEnd.copy(from).addScaledVector(targetVector, floorScale);
        coneEndRadius = 0.09 + (s.coneR - 0.09) * floorScale;
      }
    }
    const len = from.distanceTo(coneEnd);
    const beamMat = visibleBeamMaterial(s.color, Number.isFinite(s.coneFloorY));
    registerDimmableBeam(beamMat);
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, coneEndRadius, len, usesLowMobileSceneBudget() ? 12 : 24, 1, true),
      beamMat,
    );
    cone.position.copy(from).add(coneEnd).multiplyScalar(0.5).sub(from);
    const dir = new THREE.Vector3().subVectors(coneEnd, from).normalize();
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    mount.add(cone);
  }
  return g;
}

// ---- dust particles ----
function buildDust() {
  const N = usesLowMobileSceneBudget() ? 120 : 320;
  const pos = new Float32Array(N * 3);
  const motion = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 16;
    pos[i * 3 + 1] = Math.random() * 6.5 + 0.2;
    pos[i * 3 + 2] = Math.random() * 10 - 4.5;
    motion[i * 3] = 0.05 + Math.random() * 0.12;
    motion[i * 3 + 1] = Math.random() * Math.PI * 2;
    motion[i * 3 + 2] = 0.2 + Math.random() * 0.5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aDustMotion', new THREE.BufferAttribute(motion, 3));
  const dustTime = { value: 0 };
  const mat = new THREE.PointsMaterial({
    color: 0xe8c169, size: 0.04, map: softDiscTexture(), transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDustTime = dustTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec3 aDustMotion;
        uniform float uDustTime;`,
      )
      .replace(
        '#include <begin_vertex>',
        `float dustSpeed = aDustMotion.x;
        float dustPhase = aDustMotion.y;
        float dustSway = aDustMotion.z;
        vec3 transformed = vec3(position);
        transformed.x += dustSway * (cos(dustPhase) - cos(uDustTime * 0.35 + dustPhase));
        transformed.y = mod(position.y - 0.1 + dustSpeed * uDustTime, 6.9) + 0.1;
        transformed.z += 0.7857143 * dustSway
          * (sin(uDustTime * 0.28 + dustPhase) - sin(dustPhase));`,
      );
  };
  mat.customProgramCacheKey = () => 'gpu-dust-drift-v1';
  const pts = new THREE.Points(geo, mat);
  pts.userData.time = dustTime;
  return pts;
}

function applyLowMobileSceneBudget() {
  const reduced = usesLowMobileSceneBudget();
  for (const light of adaptiveQualityScene.bulbLights) light.visible = !reduced;
  for (const light of adaptiveQualityScene.lowPrioritySpots) light.visible = !reduced;
  for (const light of adaptiveQualityScene.shadowSpots) light.castShadow = !isLowEndMobileGameMode();
  for (const dressing of adaptiveQualityScene.lowTierDressing) dressing.visible = !reduced;
  const stars = adaptiveQualityScene.starDrop;
  if (stars) stars.count = reduced ? 70 : 140;
  const dust = adaptiveQualityScene.dust;
  if (dust) dust.geometry.setDrawRange(0, reduced ? 120 : dust.geometry.attributes.position.count);
}

// ---- text sprite labels ----
function makeLabel(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 192;
  const x = c.getContext('2d');
  x.textAlign = 'center';
  x.font = '700 62px "Unbounded", sans-serif';
  x.shadowColor = '#9E33CA';
  x.shadowBlur = 26;
  x.lineWidth = 10;
  x.strokeStyle = '#2a0f3a';
  x.strokeText(text.toUpperCase(), 256, 86);
  x.fillStyle = '#D1A13B';
  x.fillText(text.toUpperCase(), 256, 86);
  // little pointer triangle
  x.shadowBlur = 0;
  x.fillStyle = '#9E33CA';
  x.beginPath();
  x.moveTo(236, 128); x.lineTo(276, 128); x.lineTo(256, 160);
  x.closePath(); x.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  spr.scale.set(2.3, 0.86, 1);
  return spr;
}

function makeMascotPointer() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 256, 256);
  x.shadowColor = '#9E33CA';
  x.shadowBlur = 18;
  x.fillStyle = '#9E33CA';
  x.beginPath();
  x.moveTo(78, 72); x.lineTo(178, 72); x.lineTo(128, 188);
  x.closePath();
  x.fill();
  x.shadowBlur = 0;
  x.strokeStyle = '#D1A13B';
  x.lineWidth = 8;
  x.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  spr.scale.set(0.55, 0.55, 1);
  return spr;
}

// ---- compact young stage mascot ----
function buildMascot() {
  const group = new THREE.Group();
  group.name = 'Ти';

  // Recolorable outfit slots (mascot customization recolors these in place).
  const mats = {
    top: new THREE.MeshStandardMaterial({ color: 0xFDFBF7, roughness: 0.75, envMapIntensity: 0.65 }),
    panel: new THREE.MeshStandardMaterial({ color: 0x233f9d, roughness: 0.72 }),
    stripes: new THREE.MeshStandardMaterial({ color: 0x008542, roughness: 0.76 }),
    sleeveL: new THREE.MeshStandardMaterial({ color: 0x008542, roughness: 0.76 }),
    sleeveR: new THREE.MeshStandardMaterial({ color: 0x7fa1bd, roughness: 0.82 }),
    shoulder: new THREE.MeshStandardMaterial({ color: 0xb93a3a, roughness: 0.76 }),
    collar: new THREE.MeshStandardMaterial({ color: 0xFFD100, roughness: 0.7 }),
    pants: new THREE.MeshStandardMaterial({ color: 0x5B82A6, roughness: 0.82 }),
    shoes: new THREE.MeshStandardMaterial({ color: 0x17121c, roughness: 0.7 }),
  };
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x5a2f22, roughness: 0.72 });
  // Skin tones come from the customization config; keep env response low so
  // close-up palms/faces do not clip to white under stacked warm spots.
  const skin = new THREE.MeshStandardMaterial({ color: 0xf2c4a6, roughness: 0.88, envMapIntensity: 0.5 });
  const ink = new THREE.MeshStandardMaterial({ color: 0x17121c, roughness: 0.7 });
  const rose = new THREE.MeshStandardMaterial({ color: 0xb86d72, roughness: 0.8 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xd7d9dd, roughness: 0.22, metalness: 0.88 });
  const headphoneMats = {
    shell: new THREE.MeshStandardMaterial({ color: 0x233f9d, roughness: 0.42, metalness: 0.12 }),
    detail: new THREE.MeshStandardMaterial({ color: 0x008542, roughness: 0.55, metalness: 0.08 }),
  };

  // Varsity-jacket read: center placket, chest stripe, hem band, symmetric
  // shoulder yokes. Same recolorable slots, calmer composition.
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.58, 14), mats.top);
  torso.position.y = 1.08;
  group.add(torso);
  const placket = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.5, 0.03), mats.panel);
  placket.position.set(0, 1.06, 0.298);
  group.add(placket);
  const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.03), mats.stripes);
  chestStripe.position.set(0, 1.2, 0.29);
  group.add(chestStripe);
  const hemBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.317, 0.327, 0.06, 14, 1, true),
    mats.stripes,
  );
  hemBand.position.y = 0.82;
  group.add(hemBand);
  for (const side of [-1, 1]) {
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.05), mats.shoulder);
    yoke.position.set(side * 0.21, 1.3, 0.26);
    yoke.rotation.z = -side * 0.28;
    group.add(yoke);
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.04), mats.collar);
    collar.position.set(side * 0.07, 1.31, 0.3);
    collar.rotation.z = side * 0.58;
    group.add(collar);
  }
  const waistband = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.028, 7, 22), mats.pants);
  waistband.rotation.x = Math.PI / 2;
  waistband.position.y = 0.78;
  group.add(waistband);
  const buckle = new THREE.Mesh(
    new THREE.CircleGeometry(0.035, 12),
    new THREE.MeshStandardMaterial({ color: 0xD1A13B, metalness: 0.85, roughness: 0.35 }),
  );
  buckle.position.set(0, 0.78, 0.315);
  group.add(buckle);
  // neck fills the head/torso gap during walk and seated poses
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.12, 10), skin);
  neck.position.y = 1.4;
  group.add(neck);

  const head = new THREE.Group();
  head.position.y = 1.56;
  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), hairMat);
  hairBack.scale.set(1.08, 1.55, 0.82);
  hairBack.position.set(0, -0.13, -0.05);
  head.add(hairBack);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 14), skin);
  face.position.z = 0.035;
  head.add(face);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.287, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat);
  hairCap.position.set(0, 0.04, 0.05);
  head.add(hairCap);
  // Side locks. Each style places them itself (x/y/z) — long hair must fall
  // beside and behind the jaw, never across the chin, or it reads as a beard.
  const locks = [];
  for (const side of [-1, 1]) {
    const lock = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), hairMat);
    lock.userData.side = side;
    lock.scale.set(0.72, 3.3, 0.7);
    lock.position.set(side * 0.255, -0.28, 0.08);
    head.add(lock);
    locks.push(lock);
  }
  // Fringe/bangs: a curved shell patch hugging the front of the skull, so the
  // hairline arcs over the brow instead of the hair cap's flat cut edge.
  // Styles restyle it by scale/rotation, never by new geometry.
  const fringe = new THREE.Mesh(
    new THREE.SphereGeometry(0.305, 22, 14, Math.PI / 2 - 1.05, 2.1, 0.3, 0.98),
    hairMat,
  );
  fringe.position.set(0, 0.04, 0.045);
  head.add(fringe);
  // Dedicated iris material so eye color can be customized without touching
  // the shared ink material (glasses, badge) — recolored in place.
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x17121c, roughness: 0.45 });
  const eyeShine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const x of [-0.09, 0.09]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), eyeMat);
    eye.scale.set(1.4, 0.72, 0.7);
    eye.position.set(x, 0.025, 0.286);
    head.add(eye);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 5), eyeShine);
    shine.position.set(x + 0.011, 0.034, 0.304);
    head.add(shine);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.012), hairMat);
    brow.position.set(x, 0.085, 0.284);
    brow.rotation.z = -Math.sign(x) * 0.1;
    head.add(brow);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), skin);
  nose.scale.set(0.85, 0.7, 0.55);
  nose.position.set(0, -0.028, 0.298);
  head.add(nose);
  // Three curated mouths. Neutral is a calm closed lip with a hint of curve —
  // a wide, shallow arc rather than a flat bar, so it still reads as a face.
  const neutralMouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.115, 0.0068, 6, 14, Math.PI * 0.36),
    rose,
  );
  neutralMouth.position.set(0, 0.023, 0.288);
  neutralMouth.rotation.z = Math.PI * 1.32;
  head.add(neutralMouth);
  const softSmile = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.0075, 6, 12, Math.PI), rose);
  softSmile.position.set(0, -0.062, 0.292);
  softSmile.rotation.z = Math.PI;
  head.add(softSmile);
  const wideSmile = new THREE.Group();
  const mouthOpen = new THREE.Mesh(
    new THREE.CircleGeometry(0.052, 14, Math.PI, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x5e2430, roughness: 0.7 }),
  );
  mouthOpen.position.set(0, -0.058, 0.291);
  wideSmile.add(mouthOpen);
  const teeth = new THREE.Mesh(
    new THREE.BoxGeometry(0.078, 0.015, 0.008),
    new THREE.MeshStandardMaterial({ color: 0xe9e2d4, roughness: 0.5 }),
  );
  teeth.position.set(0, -0.063, 0.293);
  wideSmile.add(teeth);
  const wideLip = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.007, 6, 12, Math.PI), rose);
  wideLip.position.set(0, -0.058, 0.292);
  wideLip.rotation.z = Math.PI;
  wideSmile.add(wideLip);
  head.add(wideSmile);
  const accessoryGroups = {
    none: new THREE.Group(),
    hoops: new THREE.Group(),
    glasses: new THREE.Group(),
    headphones: new THREE.Group(),
  };
  for (const x of [-0.285, 0.285]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 6, 14), silver);
    hoop.position.set(x, -0.02, 0.035);
    hoop.rotation.y = Math.PI / 2;
    accessoryGroups.hoops.add(hoop);
  }
  for (const x of [-0.095, 0.095]) {
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.012, 6, 18), ink);
    lens.position.set(x, 0.018, 0.304);
    accessoryGroups.glasses.add(lens);
  }
  const glassesBridge = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.012, 0.012), ink);
  glassesBridge.position.set(0, 0.018, 0.304);
  accessoryGroups.glasses.add(glassesBridge);
  for (const x of [-1, 1]) {
    const temple = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.19), ink);
    temple.position.set(x * 0.163, 0.02, 0.21);
    temple.rotation.y = -x * 0.08;
    accessoryGroups.glasses.add(temple);
  }
  const headphoneBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.305, 0.026, 7, 24, Math.PI),
    headphoneMats.shell,
  );
  headphoneBand.position.set(0, 0.015, 0);
  accessoryGroups.headphones.add(headphoneBand);
  const headphoneBandDetail = new THREE.Mesh(
    new THREE.TorusGeometry(0.305, 0.01, 5, 24, Math.PI),
    headphoneMats.detail,
  );
  headphoneBandDetail.position.set(0, 0.015, 0.025);
  accessoryGroups.headphones.add(headphoneBandDetail);
  for (const x of [-0.295, 0.295]) {
    const cup = new THREE.Mesh(new THREE.CapsuleGeometry(0.057, 0.07, 5, 10), headphoneMats.shell);
    cup.scale.set(0.78, 1, 0.9);
    cup.position.set(x, -0.07, 0.04);
    cup.rotation.z = x < 0 ? -0.08 : 0.08;
    accessoryGroups.headphones.add(cup);
    const cupDetail = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.052, 4, 9), headphoneMats.detail);
    cupDetail.scale.set(0.7, 1, 0.55);
    cupDetail.position.set(x, -0.07, 0.097);
    cupDetail.rotation.z = cup.rotation.z;
    accessoryGroups.headphones.add(cupDetail);
  }
  for (const accessory of Object.values(accessoryGroups)) {
    accessory.visible = accessory === accessoryGroups.hoops;
    head.add(accessory);
  }
  group.add(head);

  const makeLimb = (x, y, material, radius, length, { hand = false } = {}) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.92, length, 9), material);
    limb.position.y = -length / 2;
    limb.userData.majorMass = true;
    pivot.add(limb);
    if (hand) {
      const palm = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.05, 10, 8), skin);
      palm.scale.set(1.05, 0.85, 1.15);
      palm.position.y = -length - radius * 0.35;
      pivot.add(palm);
      pivot.userData.hand = palm;
    }
    group.add(pivot);
    return pivot;
  };

  const armL = makeLimb(-0.34, 1.28, mats.sleeveL, 0.085, 0.5, { hand: true });
  const armR = makeLimb(0.34, 1.28, mats.sleeveR, 0.09, 0.5, { hand: true });
  armL.rotation.z = -0.12;
  armR.rotation.z = 0.12;
  // ribbed varsity cuffs at the wrists (accent slot, rides limb poses)
  for (const [pivot, radius] of [[armL, 0.085], [armR, 0.09]]) {
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.18, radius * 1.14, 0.06, 10), mats.stripes);
    cuff.position.y = -0.44;
    pivot.add(cuff);
  }
  const legL = makeLimb(-0.15, 0.76, mats.pants, 0.145, 0.64);
  const legR = makeLimb(0.15, 0.76, mats.pants, 0.145, 0.64);

  const soleMat = new THREE.MeshStandardMaterial({ color: 0xf5f1e8, roughness: 0.6 });
  const sneakerStripeGeometry = new THREE.BoxGeometry(0.025, 0.06, 0.012);
  for (const leg of [legL, legR]) {
    const sneaker = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.16, 0.38), mats.shoes);
    sneaker.position.set(0, -0.64, 0.08);
    sneaker.userData.majorMass = true;
    leg.add(sneaker);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.045, 0.4), soleMat);
    sole.position.set(0, -0.7, 0.08);
    leg.add(sole);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), mats.shoes);
    toe.scale.set(1.05, 0.62, 0.62);
    toe.position.set(0, -0.655, 0.24);
    leg.add(toe);
    // three identical toe stripes per shoe — one instanced draw instead of three
    const stripes = new THREE.InstancedMesh(sneakerStripeGeometry, mats.top, 3);
    const stripeMatrix = new THREE.Matrix4();
    [-0.07, 0, 0.07].forEach((x, i) => {
      stripes.setMatrixAt(i, stripeMatrix.makeTranslation(x, -0.64, 0.276));
    });
    stripes.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    stripes.computeBoundingSphere();
    leg.add(stripes);
  }

  // small accent pin on the chest stripe (reads as a band badge, not a blob)
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.028, 14), mats.collar);
  badge.position.set(-0.135, 1.2, 0.303);
  group.add(badge);

  // Only the major masses cast shadows. Trim, stripes, eyes, collar and pins
  // are too small to read in the shadow map and would roughly double the
  // shadow-pass draw calls now that the mascot stands in the key light.
  const shadowCasters = new Set([torso, neck, face, hairBack, hairCap, fringe, ...locks]);
  group.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = shadowCasters.has(object) || object.userData.majorMass === true;
  });

  return {
    group, torso, head, armL, armR, legL, legR,
    handL: armL.userData.hand,
    handR: armR.userData.hand,
    custom: {
      mats, hairMat, skinMat: skin, hairBack, hairCap, fringe, locks, accessoryGroups, headphoneMats,
      eyeMat,
      mouths: { soft: softSmile, wide: wideSmile, neutral: neutralMouth },
    },
  };
}

// ============================================================
// MASCOT CUSTOMIZATION (persisted in localStorage)
// ============================================================
const MASCOT_KEY = 'av2.mascot.v3';
const MASCOT_DEFAULTS = {
  hair: 'long',
  hairColor: '5a2f22',
  smile: 'soft',
  eyeColor: 'dark',
  outfit: 'stage',
  outfitPrimary: 'default',
  outfitAccent: 'default',
  shoeColor: 'default',
  skinTone: 'tone-3',
  accessory: 'hoops',
  height: 100,
  width: 100,
};
const MASCOT_HEIGHT_RANGE = { min: 70, max: 145 };
const MASCOT_WIDTH_RANGE = { min: 65, max: 150 };

// Three curated hairstyles, each with an authored fringe treatment:
// long — side-swept bangs, full back, long face-framing locks;
// bob — blunt straight fringe, rounded jaw-length shell, tucked locks;
// short — clean crop, no fringe, tiny sideburn wisps.
const MASCOT_HAIR_STYLES = {
  long: {
    back: { s: [1.2, 1.52, 0.94], p: [0, -0.11, -0.085] },
    cap: { s: [1.02, 1, 1.02], p: [0, 0.04, 0.05] },
    // wide, set back, and stopping at the jaw so the face stays open
    locks: { s: [0.88, 2.75, 0.82], x: 0.288, y: -0.2, z: -0.035 },
    fringe: { s: [1.0, 1.02, 1.0], p: [0, 0.04, 0.045], rz: -0.22 },
  },
  bob: {
    back: { s: [1.16, 1.05, 0.95], p: [0, -0.03, -0.055] },
    cap: { s: [1.03, 1, 1.03], p: [0, 0.04, 0.05] },
    locks: { s: [0.82, 1.62, 0.8], x: 0.272, y: -0.14, z: -0.01 },
    fringe: { s: [1.02, 1.08, 1.02], p: [0, 0.04, 0.045], rz: 0 },
  },
  short: {
    back: { s: [1.06, 0.62, 0.88], p: [0, 0.06, -0.03] },
    cap: { s: [1.04, 0.96, 1.04], p: [0, 0.04, 0.05] },
    locks: { s: [0.4, 0.75, 0.45], x: 0.255, y: 0.02, z: 0.045 },
    fringe: { s: [1.0, 0.82, 1.0], p: [0, 0.045, 0.045], rz: 0.14 },
  },
  // No hair pieces at all: the skin-toned face sphere shows through on top,
  // reading as a bald scalp. Brows stay on (they're not part of this set).
  bald: {
    back: null,
    cap: null,
    locks: null,
    fringe: null,
  },
};

// Four coherent stagewear palettes on the varsity garment. Each keeps sleeves
// matched and limits itself to base + one primary + one accent.
const MASCOT_OUTFITS = {
  stage: { top: 0xFDFBF7, panel: 0x17121c, stripes: 0xD1A13B, sleeveL: 0x233f9d, sleeveR: 0x233f9d, shoulder: 0x233f9d, collar: 0xD1A13B, pants: 0x2e3a52, shoes: 0x17121c },
  vibe: { top: 0xFDFBF7, panel: 0x9E33CA, stripes: 0xD1A13B, sleeveL: 0x9E33CA, sleeveR: 0x9E33CA, shoulder: 0x9E33CA, collar: 0xD1A13B, pants: 0x2a0f3a, shoes: 0x17121c },
  denim: { top: 0xFDFBF7, panel: 0x3a5a8c, stripes: 0xf2e6cc, sleeveL: 0x5B82A6, sleeveR: 0x5B82A6, shoulder: 0x5B82A6, collar: 0xf2e6cc, pants: 0x3a5a8c, shoes: 0xFDFBF7 },
  night: { top: 0x241a2e, panel: 0x9E33CA, stripes: 0xD1A13B, sleeveL: 0x241a2e, sleeveR: 0x241a2e, shoulder: 0x9E33CA, collar: 0xD1A13B, pants: 0x17121c, shoes: 0x9E33CA },
};
const MASCOT_SMILES = new Set(['soft', 'wide', 'neutral']);
// Curated hair palette — retired swatch values fall back to the default so no
// look ever shows a color the editor can no longer name.
const MASCOT_HAIR_COLOR_VALUES = new Set(['5a2f22', '241a14', 'c9a35f', 'a14d2d', 'b04a68']);
const MASCOT_EYE_COLORS = {
  dark: 0x17121c,
  green: 0x2e6b4f,
  blue: 0x3c5f9e,
};
const MASCOT_SHOE_COLORS = {
  default: null,
  ink: 0x17121c,
  cream: 0xFDFBF7,
  red: 0xb93a3a,
};
// Four tones: warm (default), light, golden, deep. Retired IDs (tone-1/2/6)
// fall back to the default. tone-7 is lifted off pure black so it reads as
// skin under the stage key light instead of a silhouette.
const MASCOT_SKIN_TONES = {
  'tone-3': 0xf2c4a6,
  'tone-5': 0xf6d7c5,
  'tone-4': 0xd99b72,
  'tone-7': 0x4a3128,
};
const MASCOT_ACCESSORIES = new Set(['none', 'hoops', 'glasses', 'headphones']);
const MASCOT_OUTFIT_COLORS = {
  default: null,
  purple: 0x9E33CA,
  gold: 0xD1A13B,
  cream: 0xFDFBF7,
  denim: 0x5B82A6,
  ink: 0x17121c,
  green: 0x008542,
};
const MASCOT_PRIMARY_COLORS = new Set(['default', 'purple', 'gold', 'denim']);
const MASCOT_ACCENT_COLORS = new Set(['default', 'purple', 'gold', 'cream']);

function validateMascotAppearance(saved) {
  const cfg = { ...MASCOT_DEFAULTS };
  if (!saved || typeof saved !== 'object') return cfg;
  if (saved.hair in MASCOT_HAIR_STYLES) cfg.hair = saved.hair;
  if (typeof saved.hairColor === 'string' && MASCOT_HAIR_COLOR_VALUES.has(saved.hairColor.toLowerCase())) cfg.hairColor = saved.hairColor.toLowerCase();
  if (MASCOT_SMILES.has(saved.smile)) cfg.smile = saved.smile;
  if (saved.eyeColor in MASCOT_EYE_COLORS) cfg.eyeColor = saved.eyeColor;
  if (saved.outfit in MASCOT_OUTFITS) cfg.outfit = saved.outfit;
  if (MASCOT_PRIMARY_COLORS.has(saved.outfitPrimary)) cfg.outfitPrimary = saved.outfitPrimary;
  if (MASCOT_ACCENT_COLORS.has(saved.outfitAccent)) cfg.outfitAccent = saved.outfitAccent;
  if (saved.shoeColor in MASCOT_SHOE_COLORS) cfg.shoeColor = saved.shoeColor;
  if (saved.skinTone in MASCOT_SKIN_TONES) cfg.skinTone = saved.skinTone;
  if (MASCOT_ACCESSORIES.has(saved.accessory)) cfg.accessory = saved.accessory;
  if (Number.isFinite(saved.height)) cfg.height = THREE.MathUtils.clamp(Math.round(saved.height), MASCOT_HEIGHT_RANGE.min, MASCOT_HEIGHT_RANGE.max);
  if (Number.isFinite(saved.width)) cfg.width = THREE.MathUtils.clamp(Math.round(saved.width), MASCOT_WIDTH_RANGE.min, MASCOT_WIDTH_RANGE.max);
  return cfg;
}

function mascotAppearanceSnapshot(source = mascotCfg) {
  return validateMascotAppearance(source);
}

const mascotCfg = (() => {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(MASCOT_KEY) || 'null');
  } catch { /* storage is optional */ }
  return validateMascotAppearance(saved);
})();

function saveMascotConfig() {
  const saved = mascotAppearanceSnapshot(mascotCfg);
  try { localStorage.setItem(MASCOT_KEY, JSON.stringify(saved)); } catch { /* ignore */ }
}

// ============================================================
// FIREWORKS (vibe reward)
// ============================================================
class Fireworks {
  constructor(scene) { this.scene = scene; this.bursts = []; }
  spawn(origin) {
    const N = 150;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const vel = [];
    const palette = [new THREE.Color(0x9E33CA), new THREE.Color(0xD1A13B), new THREE.Color(0xFDFBF7), new THREE.Color(0xc988f0)];
    for (let i = 0; i < N; i++) {
      pos.set([origin.x, origin.y, origin.z], i * 3);
      const dir = new THREE.Vector3().randomDirection();
      const speed = 2.5 + Math.random() * 4.5;
      vel.push(dir.multiplyScalar(speed));
      const c = palette[(Math.random() * palette.length) | 0];
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.09, vertexColors: true, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    this.bursts.push({ pts, vel, life: 1.9, max: 1.9 });
  }
  update(dt) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.pts);
        b.pts.geometry.dispose();
        b.pts.material.dispose();
        this.bursts.splice(i, 1);
        continue;
      }
      const p = b.pts.geometry.attributes.position.array;
      for (let j = 0; j < b.vel.length; j++) {
        const v = b.vel[j];
        v.y -= 5.2 * dt;
        v.multiplyScalar(1 - 0.9 * dt);
        p[j * 3] += v.x * dt;
        p[j * 3 + 1] += v.y * dt;
        p[j * 3 + 2] += v.z * dt;
      }
      b.pts.geometry.attributes.position.needsUpdate = true;
      b.pts.material.opacity = b.life / b.max;
    }
  }
}

// ============================================================
// NOTE BURSTS (per-play feedback) + FOOTLIGHT HIT PULSE
// ============================================================
function noteGlyphTexture(glyph) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.shadowColor = 'rgba(255,255,255,.9)';
  x.shadowBlur = 14;
  x.fillStyle = '#ffffff';
  x.font = '700 84px "Georgia", serif';
  x.fillText(glyph, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const NOTE_COLORS = {
  drums: 0xc988f0,
  piano: 0xD1A13B,
  guitar: 0xf0b264,
  mic: 0xc988f0,
  loop: 0xFDFBF7,
};
const NOTE_ANCHORS = {
  drums: new THREE.Vector3(-2.8, 2.3, -1.7),
  piano: new THREE.Vector3(3.5, 2.2, -1.3),
  guitar: new THREE.Vector3(-1.35, 1.95, 1.75),
  mic: new THREE.Vector3(1.0, 2.05, 2.4),
};

class NoteBursts {
  constructor(sceneRef) {
    this.pool = [];
    this.textures = [noteGlyphTexture('♪'), noteGlyphTexture('♫')];
    for (let i = 0; i < 18; i++) {
      const material = new THREE.SpriteMaterial({
        map: this.textures[i % 2],
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(0.34, 0.34, 1);
      sprite.visible = false;
      sceneRef.add(sprite);
      this.pool.push({ sprite, life: 0, max: 1.05, sway: 0, drift: 0 });
    }
    this.cursor = 0;
  }

  spawn(kind) {
    const anchor = NOTE_ANCHORS[kind];
    if (!anchor) return;
    const item = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    item.life = item.max;
    item.sway = Math.random() * Math.PI * 2;
    item.drift = 0.25 + Math.random() * 0.3;
    item.sprite.visible = true;
    item.sprite.material.color.setHex(NOTE_COLORS[kind] ?? 0xFDFBF7);
    item.sprite.material.opacity = 0.95;
    item.sprite.position.set(
      anchor.x + (Math.random() - 0.5) * 0.9,
      anchor.y + Math.random() * 0.25,
      anchor.z + (Math.random() - 0.5) * 0.5,
    );
    item.base = 0.28 + Math.random() * 0.16;
    item.pop = 1;
    item.sprite.scale.set(item.base * 1.35, item.base * 1.35, 1);
  }

  update(dt, reducedMotion) {
    for (const item of this.pool) {
      if (item.life <= 0) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.sprite.visible = false;
        item.sprite.material.opacity = 0;
        continue;
      }
      const k = item.life / item.max;
      item.sprite.position.y += item.drift * dt * (reducedMotion ? 0.4 : 1);
      if (!reducedMotion) {
        item.sprite.position.x += Math.sin(item.sway + (1 - k) * 5.2) * 0.13 * dt;
      }
      // spawn pop that eases back to base scale
      item.pop *= Math.pow(0.001, dt);
      const scale = item.base * (1 + 0.35 * item.pop);
      item.sprite.scale.set(scale, scale, 1);
      item.sprite.material.opacity = k < 0.75 ? k / 0.75 * 0.95 : 0.95;
    }
  }
}

// Footlight response to play events: quick bump that decays. Play feedback is
// kept under prefers-reduced-motion (only ambient shimmer is culled there).
const hitPulse = { value: 0 };
function bumpHitPulse(strength = 1) {
  hitPulse.value = Math.min(1.35, hitPulse.value + 0.55 * strength);
}

// ============================================================
// BOOT
// ============================================================
const stage = buildStage();
scene.add(stage);
scene.add(buildLights());
installStageEnvironment();
const dust = buildDust();
adaptiveQualityScene.dust = dust;
applyLowMobileSceneBudget();
applyStageLightLevel(stageLightLevel);
scene.add(dust);
const fireworks = new Fireworks(scene);

// instruments
const drums = buildDrumKit();
drums.group.position.set(-2.8, 0, -1.7);
drums.group.rotation.y = 0.22;
scene.add(drums.group);

const piano = buildPiano();
piano.group.position.set(3.5, 0, -1.3);
piano.group.rotation.y = -0.62;
scene.add(piano.group);

const guitar = buildGuitar();
guitar.group.position.set(-1.35, 0, 1.75);
guitar.group.rotation.y = 0.38;
scene.add(guitar.group);

const mic = buildMic();
mic.group.position.set(1.0, 0, 2.4);
scene.add(mic.group);

// Per-play feedback: every audible route already calls these instrument
// methods, so wrapping them once covers pointer, pads, keyboard jam, and loop
// playback without touching any call site.
const noteBursts = new NoteBursts(scene);
{
  const wrapPlayFeedback = (owner, method, kind, chance = 1, pulse = 1) => {
    const original = owner[method].bind(owner);
    owner[method] = (...args) => {
      original(...args);
      bumpHitPulse(pulse);
      if (chance >= 1 || Math.random() < chance) noteBursts.spawn(kind);
    };
  };
  wrapPlayFeedback(drums, 'hit', 'drums', 1, 1);
  wrapPlayFeedback(piano, 'press', 'piano', 1, 0.7);
  wrapPlayFeedback(guitar, 'strum', 'guitar', 1, 1);
  wrapPlayFeedback(guitar, 'pluck', 'guitar', 0.34, 0.5);
  wrapPlayFeedback(mic, 'sing', 'mic', 1, 0.8);
}

const mascot = buildMascot();
const mascotBaseScale = 0.68;

// Height/width come from the saved customization; fallFactor shrinks during a stage fall.
function applyMascotScale(fallFactor = 1) {
  const w = mascotBaseScale * (mascotCfg.width / 100) * fallFactor;
  mascot.group.scale.set(w, mascotBaseScale * (mascotCfg.height / 100) * fallFactor, w);
}

function applyMascotConfig() {
  const cu = mascot.custom;
  const style = MASCOT_HAIR_STYLES[mascotCfg.hair] || MASCOT_HAIR_STYLES.long;
  cu.hairBack.visible = Boolean(style.back);
  if (style.back) {
    cu.hairBack.scale.set(...style.back.s);
    cu.hairBack.position.set(...style.back.p);
  }
  cu.hairCap.visible = Boolean(style.cap);
  if (style.cap) {
    cu.hairCap.scale.set(...style.cap.s);
    cu.hairCap.position.set(...style.cap.p);
  }
  for (const lock of cu.locks) {
    lock.visible = Boolean(style.locks);
    if (style.locks) {
      lock.scale.set(...style.locks.s);
      lock.position.set(lock.userData.side * style.locks.x, style.locks.y, style.locks.z);
    }
  }
  cu.fringe.visible = Boolean(style.fringe);
  if (style.fringe) {
    cu.fringe.scale.set(...style.fringe.s);
    cu.fringe.position.set(...style.fringe.p);
    cu.fringe.rotation.z = style.fringe.rz;
  }
  cu.hairMat.color.setHex(parseInt(mascotCfg.hairColor, 16));
  cu.skinMat.color.setHex(MASCOT_SKIN_TONES[mascotCfg.skinTone] ?? MASCOT_SKIN_TONES[MASCOT_DEFAULTS.skinTone]);
  for (const [smile, mouth] of Object.entries(cu.mouths)) mouth.visible = smile === mascotCfg.smile;
  cu.eyeMat.color.setHex(MASCOT_EYE_COLORS[mascotCfg.eyeColor] ?? MASCOT_EYE_COLORS.dark);
  const outfit = MASCOT_OUTFITS[mascotCfg.outfit] || MASCOT_OUTFITS.stage;
  for (const slot in outfit) cu.mats[slot].color.setHex(outfit[slot]);
  const primary = MASCOT_OUTFIT_COLORS[mascotCfg.outfitPrimary];
  const accent = MASCOT_OUTFIT_COLORS[mascotCfg.outfitAccent];
  if (primary !== null && primary !== undefined) {
    for (const slot of ['panel', 'sleeveL', 'sleeveR']) cu.mats[slot].color.setHex(primary);
  }
  if (accent !== null && accent !== undefined) {
    for (const slot of ['stripes', 'shoulder', 'collar']) cu.mats[slot].color.setHex(accent);
  }
  const shoeOverride = MASCOT_SHOE_COLORS[mascotCfg.shoeColor];
  if (shoeOverride !== null && shoeOverride !== undefined) cu.mats.shoes.color.setHex(shoeOverride);
  cu.headphoneMats.shell.color.setHex(primary ?? outfit.panel);
  cu.headphoneMats.detail.color.setHex(accent ?? outfit.stripes);
  for (const [name, accessory] of Object.entries(cu.accessoryGroups)) {
    accessory.visible = name === mascotCfg.accessory;
  }
  applyMascotScale();
}

// Downstage, standing in the key spotlight pool and nudged toward the guitar
// (stage left) — the visitor arrives as the performer, guitar in easy reach,
// every other instrument behind them. Held back off the footlight row — those
// are point lights with inverse-square falloff and would blow the costume out
// up close.
const MASCOT_START = new THREE.Vector3(-0.5, 0, 2.15);
mascot.group.position.copy(MASCOT_START);
scene.add(mascot.group);
applyMascotConfig();
const mascotFallMeshes = [];
const mascotFallMaterialStates = new Map();
mascot.group.traverse((object) => {
  if (!object.isMesh) return;
  mascotFallMeshes.push({ object, renderOrder: object.renderOrder });
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  for (const material of materials) {
    if (!mascotFallMaterialStates.has(material)) {
      mascotFallMaterialStates.set(material, {
        transparent: material.transparent,
        opacity: material.opacity,
        depthTest: material.depthTest,
        depthWrite: material.depthWrite,
      });
    }
  }
});

const instruments = [drums, piano, guitar, mic];
const whiteKeys = piano.keys.filter((k) => !k.userData.black).sort((a, b) => a.userData.whiteIdx - b.userData.whiteIdx);

// interactable meshes
const interactables = [];
for (const inst of instruments) {
  inst.group.traverse((o) => {
    if (o.isMesh && o.userData.instrument) interactables.push(o);
  });
}

// labels
const labels = [];
let mascotLabel = null;
const MASCOT_LABEL_Y = 1.92;
// The pointer floats above the head — keep the gap proportional to the customized height.
const mascotLabelY = () => MASCOT_LABEL_Y * (mascotCfg.height / 100);
function addLabels() {
  // Arrow-only marker above the mascot (no "Ти" text).
  mascotLabel = makeMascotPointer();
  mascotLabel.position.set(mascot.group.position.x, mascotLabelY(), mascot.group.position.z);
  scene.add(mascotLabel);
}

// ============================================================
// INTERACTION
// ============================================================
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-10, -10);
let hovered = null;
let started = false;

const mascotMove = {
  keys: new Set(), destination: null, destinationKind: null, waypoints: [], speed: 2.45, phase: 0,
  travelBounds: { minX: -8.35, maxX: 8.35, minZ: -4.65, maxZ: 4.35 },
  stageEdge: { minX: -7.72, maxX: 7.72, frontZ: 3.78 },
  spawn: MASCOT_START.clone(),
  fall: null,
};
// HUD logo click: tektonik routine state (only toggled via the logo).
const dance = { active: false, t: 0, yaw: 0, loop: 0 };
const mobileControls = document.getElementById('mobile-controls');
const moveZone = document.getElementById('move-zone');
const moveStick = document.getElementById('move-stick');
const moveThumb = document.getElementById('move-thumb');
const mobilePlay = document.getElementById('mobile-play');
const mobileExit = document.getElementById('mobile-exit');
const mobilePlayHint = document.getElementById('mobile-play-hint');
const MOBILE_PLAY_HINT_KEY = 'av2.mobile-play-hint.v2';
let lastMobilePlayPointerAt = -Infinity;
const zoomControls = document.getElementById('zoom-controls');
const zoomIn = document.getElementById('zoom-in');
const zoomOut = document.getElementById('zoom-out');
const loopPedal = document.getElementById('loop-pedal');
const loopToggle = document.getElementById('loop-toggle');
const loopLabel = document.getElementById('loop-label');
const loopMeta = document.getElementById('loop-meta');
const loopProgressBar = document.getElementById('loop-progress-bar');
const loopTools = document.getElementById('loop-tools');
const loopPause = document.getElementById('loop-pause');
const loopClear = document.getElementById('loop-clear');
const loopStatus = document.getElementById('loop-status');
const loopKeyHint = document.getElementById('loop-key-hint');
const danceBtn = document.getElementById('logo-btn'); // HUD logo doubles as the dance toggle
const joystickInput = new THREE.Vector2();
const cameraForwardXZ = new THREE.Vector3();
const cameraRightXZ = new THREE.Vector3();
// Game-style pursuit camera: the rig keeps the mascot composed near the lower
// centre of the frame, looks slightly in the travel direction, and catches up
// without a frame-rate-dependent snap on both mobile and desktop.
const mobileFollow = {
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
const stageWalkPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const instrumentGroups = { drums: drums.group, piano: piano.group, guitar: guitar.group, mic: mic.group };
const instrumentWorldPositions = Object.fromEntries(
  Object.keys(instrumentGroups).map((kind) => [kind, new THREE.Vector3()]),
);
const walkColliderRoots = [
  ...Object.entries(instrumentGroups).map(([id, root]) => ({ id, root })),
  ...(stage.userData.walkColliderRoots || []),
];
const walkColliders = [];
const WALK_COLLISION_STEP = 0.08;
const WALK_ROUTE_CLEARANCE = 0.1;

function resetMobileFollowCamera({ snap = false } = {}) {
  mobileFollow.previousMascotPosition.copy(mascot.group.position);
  mobileFollow.velocity.set(0, 0, 0);
  mobileFollow.lookAhead.set(0, 0, 0);
  mobileFollow.desiredLookAhead.set(0, 0, 0);
  mobileFollow.initialized = true;
  mobileFollow.scouting = false;
  if (snap) updateMobileFollowCamera(0, true);
}

function updateMobileFollowCamera(dt, immediate = false) {
  if (flyT >= 0) {
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

function convexHullXZ(points) {
  const sorted = points
    .map((point) => ({ x: point.x, z: point.z }))
    .sort((a, b) => a.x - b.x || a.z - b.z)
    .filter((point, index, all) => (
      index === 0
      || Math.abs(point.x - all[index - 1].x) > 1e-6
      || Math.abs(point.z - all[index - 1].z) > 1e-6
    ));
  if (sorted.length <= 2) return sorted;
  const cross = (a, b, c) => (
    (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
  );
  const lower = [];
  for (const point of sorted) {
    while (
      lower.length >= 2
      && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 1e-8
    ) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = sorted.length - 1; index >= 0; index--) {
    const point = sorted[index];
    while (
      upper.length >= 2
      && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 1e-8
    ) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function visibleWalkFootprint(root) {
  const points = [];
  const corner = new THREE.Vector3();
  const instanceMatrix = new THREE.Matrix4();
  const worldMatrix = new THREE.Matrix4();
  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    if (!object.isMesh || !object.visible || object.userData.walkCollider === false) return;
    const geometry = object.geometry;
    if (!geometry) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    const appendBox = (matrix) => {
      for (const x of [geometry.boundingBox.min.x, geometry.boundingBox.max.x]) {
        for (const y of [geometry.boundingBox.min.y, geometry.boundingBox.max.y]) {
          for (const z of [geometry.boundingBox.min.z, geometry.boundingBox.max.z]) {
            corner.set(x, y, z).applyMatrix4(matrix);
            points.push({ x: corner.x, z: corner.z });
          }
        }
      }
    };
    if (object.isInstancedMesh) {
      for (let index = 0; index < object.count; index++) {
        object.getMatrixAt(index, instanceMatrix);
        worldMatrix.multiplyMatrices(object.matrixWorld, instanceMatrix);
        appendBox(worldMatrix);
      }
    } else {
      appendBox(object.matrixWorld);
    }
  });
  return convexHullXZ(points);
}

function refreshWalkColliders() {
  walkColliders.length = 0;
  for (const { id, root } of walkColliderRoots) {
    const points = visibleWalkFootprint(root);
    if (points.length < 3) continue;
    walkColliders.push({
      id,
      points,
      minX: Math.min(...points.map((point) => point.x)),
      maxX: Math.max(...points.map((point) => point.x)),
      minZ: Math.min(...points.map((point) => point.z)),
      maxZ: Math.max(...points.map((point) => point.z)),
    });
  }
}

function mascotWalkRadius() {
  return 0.29 * mascotBaseScale * (mascotCfg.width / 100) + 0.075;
}

function closestPointOnWalkEdge(point, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  const amount = lengthSq > 1e-10
    ? THREE.MathUtils.clamp(((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSq, 0, 1)
    : 0;
  return {
    point: new THREE.Vector3(a.x + dx * amount, 0, a.z + dz * amount),
    edge: new THREE.Vector3(dx, 0, dz),
  };
}

function pointInsideWalkPolygon(point, points) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const a = points[index];
    const b = points[previous];
    if (
      ((a.z > point.z) !== (b.z > point.z))
      && point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x
    ) inside = !inside;
  }
  return inside;
}

function closestWalkColliderContact(point, collider) {
  let closest = null;
  for (let index = 0; index < collider.points.length; index++) {
    const a = collider.points[index];
    const b = collider.points[(index + 1) % collider.points.length];
    const contact = closestPointOnWalkEdge(point, a, b);
    const distanceSq = contact.point.distanceToSquared(point);
    if (!closest || distanceSq < closest.distanceSq) {
      contact.edge.normalize();
      // Convex hull vertices are counter-clockwise: the right-hand edge normal
      // points away from the visible object.
      contact.normal = new THREE.Vector3(contact.edge.z, 0, -contact.edge.x);
      closest = { ...contact, distanceSq };
    }
  }
  const inside = pointInsideWalkPolygon(point, collider.points);
  if (!inside && closest?.distanceSq > 1e-10) {
    closest.normal.subVectors(point, closest.point).normalize();
  }
  return { ...closest, inside };
}

function pointHitsWalkCollider(point, padding = mascotWalkRadius()) {
  for (const collider of walkColliders) {
    if (
      point.x < collider.minX - padding || point.x > collider.maxX + padding
      || point.z < collider.minZ - padding || point.z > collider.maxZ + padding
    ) continue;
    const contact = closestWalkColliderContact(point, collider);
    if (contact.inside || contact.distanceSq <= padding * padding) {
      return { collider, contact };
    }
  }
  return null;
}

function walkSegmentsIntersect(a, b, c, d) {
  const cross = (p, q, r) => (
    (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x)
  );
  const onSegment = (p, q, r) => (
    q.x >= Math.min(p.x, r.x) - 1e-8 && q.x <= Math.max(p.x, r.x) + 1e-8
    && q.z >= Math.min(p.z, r.z) - 1e-8 && q.z <= Math.max(p.z, r.z) + 1e-8
  );
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  if (
    ((abC > 1e-8 && abD < -1e-8) || (abC < -1e-8 && abD > 1e-8))
    && ((cdA > 1e-8 && cdB < -1e-8) || (cdA < -1e-8 && cdB > 1e-8))
  ) return true;
  return (
    (Math.abs(abC) <= 1e-8 && onSegment(a, c, b))
    || (Math.abs(abD) <= 1e-8 && onSegment(a, d, b))
    || (Math.abs(cdA) <= 1e-8 && onSegment(c, a, d))
    || (Math.abs(cdB) <= 1e-8 && onSegment(c, b, d))
  );
}

function walkSegmentHitsCollider(a, b, collider, padding) {
  if (
    Math.max(a.x, b.x) < collider.minX - padding
    || Math.min(a.x, b.x) > collider.maxX + padding
    || Math.max(a.z, b.z) < collider.minZ - padding
    || Math.min(a.z, b.z) > collider.maxZ + padding
  ) return false;
  const paddingSq = padding * padding;
  if (
    pointInsideWalkPolygon(a, collider.points)
    || pointInsideWalkPolygon(b, collider.points)
  ) return true;
  for (let index = 0; index < collider.points.length; index++) {
    const c = collider.points[index];
    const d = collider.points[(index + 1) % collider.points.length];
    if (walkSegmentsIntersect(a, b, c, d)) return true;
    const distanceSq = Math.min(
      closestPointOnWalkEdge(a, c, d).point.distanceToSquared(a),
      closestPointOnWalkEdge(b, c, d).point.distanceToSquared(b),
      closestPointOnWalkEdge(c, a, b).point.distanceToSquared(new THREE.Vector3(c.x, 0, c.z)),
      closestPointOnWalkEdge(d, a, b).point.distanceToSquared(new THREE.Vector3(d.x, 0, d.z)),
    );
    if (distanceSq <= paddingSq) return true;
  }
  return false;
}

function mascotWalkSegmentIsClear(a, b, padding = mascotWalkRadius()) {
  return !walkColliders.some((collider) => walkSegmentHitsCollider(a, b, collider, padding));
}

function expandedWalkColliderPoints(collider, padding) {
  return collider.points.map((point, index, points) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const previousEdge = new THREE.Vector2(point.x - previous.x, point.z - previous.z).normalize();
    const nextEdge = new THREE.Vector2(next.x - point.x, next.z - point.z).normalize();
    const previousNormal = new THREE.Vector2(previousEdge.y, -previousEdge.x);
    const nextNormal = new THREE.Vector2(nextEdge.y, -nextEdge.x);
    const bisector = previousNormal.add(nextNormal);
    const denominator = Math.max(0.2, bisector.dot(nextNormal));
    bisector.multiplyScalar(padding / denominator);
    return new THREE.Vector3(point.x + bisector.x, 0, point.z + bisector.y);
  });
}

function projectMascotToWalkablePoint(point) {
  const projected = clampMascotPoint(point.clone());
  const edgeGap = 0.015;
  for (let attempt = 0; attempt < walkColliders.length * 2; attempt++) {
    const hit = pointHitsWalkCollider(projected);
    if (!hit) break;
    projected.copy(hit.contact.point)
      .addScaledVector(hit.contact.normal, mascotWalkRadius() + edgeGap);
    projected.copy(clampMascotPoint(projected));
  }
  return projected;
}

function planMascotWalkRoute(start, destination) {
  const from = clampMascotPoint(start.clone());
  const to = projectMascotToWalkablePoint(destination);
  const radius = mascotWalkRadius();
  if (mascotWalkSegmentIsClear(from, to, radius)) return [to];

  const nodes = [from, to];
  for (const collider of walkColliders) {
    const corners = expandedWalkColliderPoints(collider, radius + WALK_ROUTE_CLEARANCE);
    for (const point of corners) {
      const corner = clampMascotPoint(point);
      if (!pointHitsWalkCollider(corner, radius)) nodes.push(corner);
    }
  }

  const costs = Array(nodes.length).fill(Infinity);
  const previous = Array(nodes.length).fill(-1);
  const visited = Array(nodes.length).fill(false);
  costs[0] = 0;
  for (let pass = 0; pass < nodes.length; pass++) {
    let current = -1;
    for (let index = 0; index < nodes.length; index++) {
      if (!visited[index] && (current < 0 || costs[index] < costs[current])) current = index;
    }
    if (current < 0 || !Number.isFinite(costs[current]) || current === 1) break;
    visited[current] = true;
    for (let next = 0; next < nodes.length; next++) {
      if (visited[next] || !mascotWalkSegmentIsClear(nodes[current], nodes[next], radius)) continue;
      const cost = costs[current] + nodes[current].distanceTo(nodes[next]);
      if (cost < costs[next]) {
        costs[next] = cost;
        previous[next] = current;
      }
    }
  }
  if (!Number.isFinite(costs[1])) return [to];
  const route = [];
  for (let index = 1; index !== 0; index = previous[index]) {
    if (index < 0) return [to];
    route.push(nodes[index].clone());
  }
  return route.reverse();
}

function nearestInstrumentWalkPoint(kind, origin) {
  const collider = walkColliders.find((candidate) => candidate.id === kind);
  if (!collider) return null;

  // Arrive at the closest clear edge of an instrument rather than walking to
  // the seated/performance pose inside its geometry. The focus transition can
  // then place the mascot precisely, without making their visible route take
  // an arbitrary long way around the same instrument.
  const contact = closestWalkColliderContact(origin, collider);
  const point = contact.point.clone()
    .addScaledVector(contact.normal, mascotWalkRadius() + 0.06);
  return clampMascotPoint(point);
}

function moveMascotWithColliders(direction, distance) {
  const steps = Math.max(1, Math.ceil(distance / WALK_COLLISION_STEP));
  const step = direction.clone().multiplyScalar(distance / steps);
  const radius = mascotWalkRadius();
  for (let index = 0; index < steps; index++) {
    const position = mascot.group.position;
    const proposed = clampMascotPoint(position.clone().add(step));
    if (!pointHitsWalkCollider(proposed, radius)) {
      position.copy(proposed);
      continue;
    }
    const hit = pointHitsWalkCollider(proposed, radius);
    const slide = step.clone();
    const intoSurface = slide.dot(hit.contact.normal);
    if (intoSurface < 0) slide.addScaledVector(hit.contact.normal, -intoSurface);
    const slid = clampMascotPoint(position.clone().add(slide));
    if (!pointHitsWalkCollider(slid, radius)) position.copy(slid);
  }
}

refreshWalkColliders();

const INSTRUMENT_VIEW_PRESETS = {
  drums: {
    mascot: new THREE.Vector3(0, 0.15, -1.05),
    yaw: 0,
    seated: true,
    approach: [],
    camera: new THREE.Vector3(1.2, 2.18, -2.2),
    cameraMobile: new THREE.Vector3(0.92, 3.5, -3.55),
    target: new THREE.Vector3(0, 0.94, 0.05),
    targetMobile: new THREE.Vector3(0, 0.8, -0.05),
    arms: [-0.88, -1.05],
  },
  piano: {
    mascot: new THREE.Vector3(0, 0.07, 1.02),
    yaw: Math.PI,
    seated: true,
    approach: [],
    // Base direction only: the measured piano fitter owns distance and offset.
    camera: new THREE.Vector3(-2.1, 3.85, 1.45),
    cameraMobile: new THREE.Vector3(-1.75, 3.95, 1.55),
    target: new THREE.Vector3(0, 0.78, 0.55),
    arms: [-0.94, -0.98],
  },
  guitar: {
    mascot: new THREE.Vector3(0.62, 0, 0.78),
    yaw: -2.32,
    seated: false,
    approach: [],
    // Near-front performance view: keep soundhole, strings, and first frets legible.
    camera: new THREE.Vector3(0.08, 1.72, 2.02),
    cameraMobile: new THREE.Vector3(0.08, 1.72, 2.34),
    target: new THREE.Vector3(0, 0.91, 0.07),
    arms: [-1.05, -0.66],
  },
  mic: {
    mascot: new THREE.Vector3(0.42, 0, 0.58),
    yaw: -2.52,
    seated: false,
    approach: [],
    camera: new THREE.Vector3(-1.45, 1.75, 2),
    cameraMobile: new THREE.Vector3(-1.82, 2.05, 2.58),
    target: new THREE.Vector3(0, 1.2, 0),
    arms: [-0.42, -0.78],
  },
};

const instrumentView = {
  phase: 'idle',
  kind: null,
  transition: null,
  refit: null,
  home: null,
  homeMascotPosition: null,
  offerPriceChipOnIdle: null,
};

function instrumentViewCameraPoint(kind, preset) {
  const point = isMobileGameMode() && preset.cameraMobile ? preset.cameraMobile : preset.camera;
  if (kind !== 'guitar') return point;
  return point.clone().sub(preset.target).multiplyScalar(GUITAR_FOCUS_ZOOM_FACTOR).add(preset.target);
}

function setSceneLabelsVisible(visible) {
  if (mascotLabel && !mascotMove.fall) mascotLabel.visible = visible;
}

function syncMobileInstrumentChrome() {
  // Show ✕ only once seated (entering/focused). Revealing it during approaching
  // would put it under the same finger that just pressed ГРАТИ, and the
  // synthesized click would instantly cancel the approach.
  const showExit = instrumentView.phase === 'entering' || instrumentView.phase === 'focused';
  if (mobileExit) mobileExit.hidden = !showExit;
}

function syncInstrumentExposure() {
  const portrait = window.innerWidth / window.innerHeight < 1;
  const baseExposure = portrait ? 0.98 : 1.12;
  const performancePhase = instrumentView.phase === 'entering' || instrumentView.phase === 'focused';
  if (performancePhase && instrumentView.kind === 'piano') {
    renderer.toneMappingExposure = baseExposure * 0.48;
  } else if (performancePhase && instrumentView.kind === 'guitar') {
    renderer.toneMappingExposure = baseExposure * 0.78;
  } else {
    renderer.toneMappingExposure = baseExposure;
  }
}

function setInstrumentViewPhase(phase, kind = instrumentView.kind) {
  const previousPhase = instrumentView.phase;
  instrumentView.phase = phase;
  instrumentView.kind = phase === 'idle' ? null : kind;
  document.documentElement.dataset.instrumentView = phase;
  if (instrumentView.kind) document.documentElement.dataset.instrument = instrumentView.kind;
  else delete document.documentElement.dataset.instrument;
  setSceneLabelsVisible(!['entering', 'focused'].includes(phase));
  syncMobileInstrumentChrome();
  syncInstrumentExposure();
  if (phase === 'focused' && kind) clearKeyboardJamChipTimer(kind);
  if (phase === 'focused' && kind === 'mic') {
    hideChordPad();
    showVocalPad(false);
    controls.enableZoom = true;
    document.documentElement.classList.remove('guitar-focused', 'guitar-fretting');
  } else if (phase === 'focused' && kind === 'guitar') {
    hideVocalPad();
    showChordPad();
    // Prefer finger strum over page/orbit pinch-zoom while at the guitar.
    controls.enableZoom = false;
    document.documentElement.classList.add('guitar-focused');
  } else if (previousPhase === 'focused' && phase !== 'focused') {
    // Leaving focus: clear performance holds. Keep keyboard jam alive while
    // merely approaching / entering from idle so multi-instrument play continues.
    hideVocalPad();
    hideChordPad();
    releaseAllHeldPianoNotes();
    releaseKeyboardVocal();
    controls.enableZoom = true;
    document.documentElement.classList.remove('guitar-focused', 'guitar-fretting');
    clearGuitarInteractionState();
    audio.muteGuitar();
  } else if (phase !== 'focused') {
    hideVocalPad();
    hideChordPad();
    controls.enableZoom = true;
    document.documentElement.classList.remove('guitar-focused', 'guitar-fretting');
  }
}

function instrumentLocalToWorld(kind, point) {
  const group = instrumentGroups[kind];
  group.updateWorldMatrix(true, false);
  return group.localToWorld(point.clone());
}

const PIANO_FRAME_MARGIN = 16;
const PIANO_HAND_ANCHORS = {
  armL: new THREE.Vector3(0.38, 0.72, 0.67),
  armR: new THREE.Vector3(-0.38, 0.72, 0.67),
};
const pianoFitCamera = camera.clone();
let pianoFrameDebug = null;

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

const pianoKeybedLocalBounds = objectBoundsInAncestor(piano.keys, piano.group);

function boxCorners(box) {
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

function pianoFocusSafeRect() {
  const vv = window.visualViewport;
  const viewport = {
    left: (vv?.offsetLeft || 0) + PIANO_FRAME_MARGIN,
    top: (vv?.offsetTop || 0) + PIANO_FRAME_MARGIN,
    right: (vv?.offsetLeft || 0) + (vv?.width || window.innerWidth) - PIANO_FRAME_MARGIN,
    bottom: (vv?.offsetTop || 0) + (vv?.height || window.innerHeight) - PIANO_FRAME_MARGIN,
  };
  const blockers = [
    document.getElementById('hud'),
    zoomControls,
    loopPedal,
    mobileExit,
    document.getElementById('chip'),
    document.getElementById('toast'),
  ].map(visibleChromeRect).filter(Boolean).map((rect) => ({
    left: rect.left - 8,
    top: rect.top - 8,
    right: rect.right + 8,
    bottom: rect.bottom + 8,
  }));

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

function projectedBounds(points, projectionCamera) {
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

function pianoWorldPoints(localPoints) {
  return localPoints.map((point) => instrumentLocalToWorld('piano', point));
}

function pianoMascotHeadWorldPoints() {
  const pose = createPianoMascotPose();
  const mascotMatrix = new THREE.Matrix4().compose(
    pose.position,
    pose.group,
    mascot.group.scale,
  );
  const headMatrix = new THREE.Matrix4().compose(
    pose.headPosition,
    pose.head,
    new THREE.Vector3(1, 1, 1),
  ).premultiply(mascotMatrix);
  // Cover the face, cap, back hair, and the visible root of the long locks.
  // The framing fitter can then protect the head across appearance presets
  // without depending on whichever pose happens to be applied this frame.
  const headBounds = new THREE.Box3(
    new THREE.Vector3(-0.34, -0.6, -0.32),
    new THREE.Vector3(0.34, 0.35, 0.34),
  );
  return boxCorners(headBounds).map((point) => point.applyMatrix4(headMatrix));
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
  const subjectPoints = [
    ...pianoWorldPoints(subjectLocalPoints),
    ...pianoMascotHeadWorldPoints(),
  ];
  const subjectLocalBounds = new THREE.Box3().setFromPoints(subjectLocalPoints);
  const subjectCenterLocal = subjectLocalBounds.getCenter(new THREE.Vector3());
  subjectCenterLocal.y += 0.035;
  subjectCenterLocal.z += 0.055;
  const subjectCenter = instrumentLocalToWorld('piano', subjectCenterLocal);
  const pianoWorldQuaternion = piano.group.getWorldQuaternion(new THREE.Quaternion());
  const eyeDirection = preset.camera.clone().sub(preset.target).normalize()
    .applyQuaternion(pianoWorldQuaternion).normalize();
  const right = new THREE.Vector3().crossVectors(camera.up, eyeDirection).normalize();
  const viewUp = new THREE.Vector3().crossVectors(eyeDirection, right).normalize();
  const safeWidth = safeRect.right - safeRect.left;
  const safeHeight = safeRect.bottom - safeRect.top;
  const safeCenterX = (safeRect.left + safeRect.right) * 0.5;
  const safeCenterY = (safeRect.top + safeRect.bottom) * 0.5;
  const portrait = window.innerHeight > window.innerWidth;
  const desiredKeyWidth = safeWidth * (portrait ? 0.88 : 0.81);
  const tanHalfV = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const desiredNdcX = (safeCenterX / window.innerWidth) * 2 - 1;
  const desiredNdcY = 1 - (safeCenterY / window.innerHeight) * 2;
  let position = new THREE.Vector3();
  let target = new THREE.Vector3();

  const placeCamera = (distance) => {
    const halfHeight = distance * tanHalfV;
    const halfWidth = halfHeight * camera.aspect;
    position.copy(subjectCenter).addScaledVector(eyeDirection, distance);
    target.copy(subjectCenter)
      .addScaledVector(right, -desiredNdcX * halfWidth)
      .addScaledVector(viewUp, -desiredNdcY * halfHeight);
    pianoFitCamera.copy(camera);
    pianoFitCamera.position.copy(position);
    pianoFitCamera.up.copy(camera.up);
    pianoFitCamera.lookAt(target);
    pianoFitCamera.updateMatrixWorld(true);
  };

  let distance = THREE.MathUtils.clamp(preset.camera.distanceTo(preset.target), 1.6, 5.4);
  for (let iteration = 0; iteration < 8; iteration++) {
    placeCamera(distance);
    const keyBounds = projectedBounds(keyPoints, pianoFitCamera);
    const subjectBounds = projectedBounds(subjectPoints, pianoFitCamera);
    const widthScale = keyBounds.width / desiredKeyWidth;
    const fitScale = Math.max(subjectBounds.width / safeWidth, subjectBounds.height / safeHeight);
    const scale = Math.max(widthScale, fitScale);
    if (Math.abs(scale - 1) < 0.004) break;
    distance = THREE.MathUtils.clamp(distance * scale, 1.35, 6.2);
  }

  placeCamera(distance);
  for (let iteration = 0; iteration < 2; iteration++) {
    const bounds = projectedBounds(subjectPoints, pianoFitCamera);
    const dx = safeCenterX - bounds.centerX;
    const dy = safeCenterY - bounds.centerY;
    const worldPerPixelY = (2 * distance * tanHalfV) / window.innerHeight;
    const worldPerPixelX = worldPerPixelY * camera.aspect;
    const shift = right.clone().multiplyScalar(-dx * worldPerPixelX)
      .addScaledVector(viewUp, dy * worldPerPixelY);
    position.add(shift);
    target.add(shift);
    pianoFitCamera.position.copy(position);
    pianoFitCamera.lookAt(target);
    pianoFitCamera.updateMatrixWorld(true);
  }

  pianoFrameDebug = {
    safeRect: { ...safeRect },
    keybedBounds: projectedBounds(keyPoints, pianoFitCamera),
    subjectBounds: projectedBounds(subjectPoints, pianoFitCamera),
    targetWidthRatio: desiredKeyWidth / safeWidth,
    keybedLocalBounds: {
      min: pianoKeybedLocalBounds.min.toArray(),
      max: pianoKeybedLocalBounds.max.toArray(),
    },
    distance,
    position: position.toArray(),
    target: target.toArray(),
  };
  document.documentElement.dataset.pianoFrameDebug = JSON.stringify(pianoFrameDebug);
  return { position: position.clone(), target: target.clone() };
}

function instrumentViewFrame(kind, preset) {
  if (kind === 'piano') return fitPianoFocusFrame(preset);
  const target = isMobileGameMode() && preset.targetMobile ? preset.targetMobile : preset.target;
  return {
    position: instrumentLocalToWorld(kind, instrumentViewCameraPoint(kind, preset)),
    target: instrumentLocalToWorld(kind, target),
  };
}

function resetMascotPose() {
  applyMascotScale();
  mascot.group.rotation.x = 0;
  mascot.group.rotation.z = 0;
  mascot.torso.rotation.set(0, 0, 0);
  mascot.head.position.set(0, 1.56, 0);
  mascot.head.rotation.set(0, 0, 0);
  mascot.armL.position.set(-0.34, 1.28, 0);
  mascot.armR.position.set(0.34, 1.28, 0);
  mascot.armL.rotation.set(0, 0, -0.12);
  mascot.armR.rotation.set(0, 0, 0.12);
  mascot.legL.rotation.set(0, 0, 0);
  mascot.legR.rotation.set(0, 0, 0);
}

function captureMascotInstrumentPose() {
  return {
    position: mascot.group.position.clone(),
    group: mascot.group.quaternion.clone(),
    torso: mascot.torso.quaternion.clone(),
    headPosition: mascot.head.position.clone(),
    head: mascot.head.quaternion.clone(),
    armLPosition: mascot.armL.position.clone(),
    armRPosition: mascot.armR.position.clone(),
    armL: mascot.armL.quaternion.clone(),
    armR: mascot.armR.quaternion.clone(),
    legL: mascot.legL.quaternion.clone(),
    legR: mascot.legR.quaternion.clone(),
  };
}

function applyMascotInstrumentPose(pose) {
  mascot.group.position.copy(pose.position);
  mascot.group.quaternion.copy(pose.group);
  mascot.torso.quaternion.copy(pose.torso);
  mascot.head.position.copy(pose.headPosition);
  mascot.head.quaternion.copy(pose.head);
  mascot.armL.position.copy(pose.armLPosition);
  mascot.armR.position.copy(pose.armRPosition);
  mascot.armL.quaternion.copy(pose.armL);
  mascot.armR.quaternion.copy(pose.armR);
  mascot.legL.quaternion.copy(pose.legL);
  mascot.legR.quaternion.copy(pose.legR);
}

function interpolateMascotInstrumentPose(from, to, amount) {
  mascot.group.position.lerpVectors(from.position, to.position, amount);
  mascot.group.quaternion.slerpQuaternions(from.group, to.group, amount);
  mascot.torso.quaternion.slerpQuaternions(from.torso, to.torso, amount);
  mascot.head.position.lerpVectors(from.headPosition, to.headPosition, amount);
  mascot.head.quaternion.slerpQuaternions(from.head, to.head, amount);
  mascot.armL.position.lerpVectors(from.armLPosition, to.armLPosition, amount);
  mascot.armR.position.lerpVectors(from.armRPosition, to.armRPosition, amount);
  mascot.armL.quaternion.slerpQuaternions(from.armL, to.armL, amount);
  mascot.armR.quaternion.slerpQuaternions(from.armR, to.armR, amount);
  mascot.legL.quaternion.slerpQuaternions(from.legL, to.legL, amount);
  mascot.legR.quaternion.slerpQuaternions(from.legR, to.legR, amount);
}

function pianoArmQuaternion(shoulderPosition, targetWorld, inverseMascotMatrix) {
  const targetLocal = targetWorld.clone().applyMatrix4(inverseMascotMatrix);
  const direction = targetLocal.sub(shoulderPosition).normalize();
  const downward = Math.max(0.08, -direction.y);
  const x = THREE.MathUtils.clamp(-Math.atan2(direction.z, downward), -1.24, -0.48);
  const z = THREE.MathUtils.clamp(Math.atan2(direction.x, downward), -0.32, 0.32);
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(x, 0, z, 'XYZ'));
}

function createPianoMascotPose() {
  const preset = INSTRUMENT_VIEW_PRESETS.piano;
  const scaleY = mascot.group.scale.y;
  const benchTop = 0.585;
  const hipLocalY = 0.76;
  const mascotLocalPosition = preset.mascot.clone();
  mascotLocalPosition.y = benchTop - hipLocalY * scaleY;
  const position = instrumentLocalToWorld('piano', mascotLocalPosition);
  const pianoQuaternion = piano.group.getWorldQuaternion(new THREE.Quaternion());
  const groupQuaternion = pianoQuaternion.multiply(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), preset.yaw),
  );
  const targetMatrix = new THREE.Matrix4().compose(
    position,
    groupQuaternion,
    mascot.group.scale,
  );
  const inverseTargetMatrix = targetMatrix.clone().invert();
  const normalizedHeight = THREE.MathUtils.clamp(
    (mascotCfg.height - MASCOT_HEIGHT_RANGE.min) / (MASCOT_HEIGHT_RANGE.max - MASCOT_HEIGHT_RANGE.min),
    0,
    1,
  );
  const legAngle = THREE.MathUtils.lerp(-0.38, -0.92, normalizedHeight);
  const armLPosition = new THREE.Vector3(-0.4, 1.26, 0.08);
  const armRPosition = new THREE.Vector3(0.4, 1.26, 0.08);

  return {
    position,
    group: groupQuaternion,
    torso: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0, 0)),
    // Keep the head over the torso and slightly toward the keybed. A negative
    // local Z moves it toward the behind-player focus camera, exaggerating the
    // hair shell and hiding the face through perspective.
    headPosition: new THREE.Vector3(0, 1.52, 0.04),
    head: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0, 0)),
    armLPosition,
    armRPosition,
    armL: pianoArmQuaternion(
      armLPosition,
      instrumentLocalToWorld('piano', PIANO_HAND_ANCHORS.armL),
      inverseTargetMatrix,
    ),
    armR: pianoArmQuaternion(
      armRPosition,
      instrumentLocalToWorld('piano', PIANO_HAND_ANCHORS.armR),
      inverseTargetMatrix,
    ),
    legL: new THREE.Quaternion().setFromEuler(new THREE.Euler(legAngle, 0, -0.08)),
    legR: new THREE.Quaternion().setFromEuler(new THREE.Euler(legAngle - 0.04, 0, 0.08)),
  };
}

// ---- mascot dance (HUD logo click — tektonik routine) ----
const DANCE_BPM = 122;

function setDancing(next) {
  const on = Boolean(next) && started && !ui.modalOpen && !mascotMove.fall
    && flyT < 0 && instrumentView.phase === 'idle';
  if (on === dance.active) return;
  dance.active = on;
  if (on) {
    dance.t = 0;
    dance.loop = 0;
    dance.yaw = mascot.group.rotation.y;
  }
  danceBtn?.classList.toggle('dancing', on);
  danceBtn?.setAttribute('aria-pressed', on ? 'true' : 'false');
}

// 8-beat tektonik loop: overhead arm sweeps + bounce, spin on the last two beats.
function updateMascotDance(dt) {
  dance.t += dt;
  const beat = dance.t * (DANCE_BPM / 60);
  const rad = beat * Math.PI * 2;
  const loop = beat % 8; // 8-beat routine
  if (loop < dance.loop) dance.yaw = mascot.group.rotation.y; // wrapped after a spin
  dance.loop = loop;

  const sweep = Math.sin(rad);
  const raise = Math.sin(rad * 0.5);

  // tektonik arms: alternating overhead sweeps with a quick flick
  mascot.armL.rotation.z = -(0.35 + Math.max(0, raise) * 2.1) + Math.sin(rad * 2) * 0.16;
  mascot.armR.rotation.z = 0.35 + Math.max(0, -raise) * 2.1 + Math.cos(rad * 2) * 0.16;
  mascot.armL.rotation.x = Math.cos(rad * 0.5) * 0.5 + sweep * 0.3;
  mascot.armR.rotation.x = Math.sin(rad * 0.5) * 0.5 - sweep * 0.3;

  // bounce on the beat + hips / head groove
  mascot.group.position.y = Math.abs(sweep) * 0.085;
  mascot.torso.rotation.z = sweep * 0.13;
  mascot.head.rotation.z = -sweep * 0.1;
  mascot.head.rotation.x = Math.sin(rad * 2) * 0.05;

  // alternating footwork
  mascot.legL.rotation.x = Math.max(0, sweep) * 0.55;
  mascot.legR.rotation.x = Math.max(0, -sweep) * 0.55;
  mascot.legL.rotation.z = -0.06;
  mascot.legR.rotation.z = 0.06;

  // gentle sway, full spin on the last two beats of the loop
  if (loop >= 6) {
    const k = easeInOut(Math.min(1, (loop - 6) / 2));
    mascot.group.rotation.y = dance.yaw + k * Math.PI * 2;
  } else {
    mascot.group.rotation.y = dance.yaw + Math.sin(rad * 0.25) * 0.3;
  }
}

function poseMascotAtInstrument(kind) {
  const preset = INSTRUMENT_VIEW_PRESETS[kind];
  const group = instrumentGroups[kind];
  if (!preset || !group) return;
  resetMascotPose();
  if (kind === 'piano') {
    applyMascotInstrumentPose(createPianoMascotPose());
    if (mascotLabel) {
      mascotLabel.visible = false;
      mascotLabel.position.set(
        mascot.group.position.x,
        mascot.group.position.y + mascotLabelY(),
        mascot.group.position.z,
      );
    }
    return;
  }
  mascot.group.position.copy(instrumentLocalToWorld(kind, preset.mascot));
  mascot.group.rotation.y = group.rotation.y + preset.yaw;
  mascot.armL.rotation.x = preset.arms[0];
  mascot.armR.rotation.x = preset.arms[1];
  mascot.armL.rotation.z = -0.24;
  mascot.armR.rotation.z = 0.24;
  if (preset.seated) {
    mascot.legL.rotation.x = -1.08;
    mascot.legR.rotation.x = -1.14;
    mascot.legL.rotation.z = -0.08;
    mascot.legR.rotation.z = 0.08;
    mascot.torso.rotation.x = -0.06;
  } else if (kind === 'guitar') {
    mascot.torso.rotation.z = 0.05;
    mascot.head.rotation.z = -0.08;
  } else if (kind === 'mic') {
    mascot.head.rotation.x = -0.08;
    mascot.head.rotation.z = 0.05;
  }
  if (mascotLabel) {
    mascotLabel.visible = false;
    mascotLabel.position.set(mascot.group.position.x, mascot.group.position.y + mascotLabelY(), mascot.group.position.z);
  }
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

function applyFocusedControlLimits() {
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
    controls.minDistance = Math.max(FOCUSED_MIN_DISTANCE, distance * 0.7);
    controls.maxDistance = Math.max(controls.minDistance + 0.2, distance * 1.38);
    // Keep the measured distance envelope, but leave horizontal orbit free so
    // the focused frame remains a starting composition rather than a lock.
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.minPolarAngle = Math.max(0.34, polar - 0.12);
    controls.maxPolarAngle = Math.min(1.42, polar + 0.12);
  } else if (instrumentView.kind === 'guitar') {
    // Guitar focus also starts from a composed frame, but horizontal orbit is
    // intentionally unrestricted once the transition has settled.
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
  } else {
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
  }
}

function syncControlsAtInstrumentFrame(position, target) {
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
  { mascotPose = null } = {},
) {
  clearTimeout(idleTimer);
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
  };
  setInstrumentViewPhase(phase, kind);
}

function activateInstrumentView(kind) {
  const preset = INSTRUMENT_VIEW_PRESETS[kind];
  if (!preset || instrumentView.phase !== 'approaching' || instrumentView.kind !== kind) return;
  instrumentView.home = captureInstrumentViewHome();
  instrumentView.homeMascotPosition = mascot.group.position.clone();
  mascotMove.destination = null;
  mascotMove.destinationKind = null;
  mascotMove.waypoints.length = 0;
  mascotMove.keys.clear();
  releaseMoveJoystick();
  let mascotPose = null;
  if (kind === 'piano') {
    mascotPose = {
      from: captureMascotInstrumentPose(),
      to: createPianoMascotPose(),
    };
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
    { mascotPose },
  );
}

function finishInstrumentReturn() {
  // The walk control is hidden while seated. Safari can lose its pointer-up
  // when that happens, so restoring free movement must also restore its home UI.
  releaseMoveJoystick();
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
    camera.position.copy(home.position);
    controls.target.copy(home.target);
    restoreInstrumentControlLimits(home);
  }
  applyMobileOrbitPolicy();
  resetMobileFollowCamera();
  controls.enabled = started && flyT < 0;
  controls.autoRotate = false;
  controls.update();
  instrumentView.transition = null;
  instrumentView.refit = null;
  instrumentView.home = null;
  instrumentView.homeMascotPosition = null;
  instrumentView.offerPriceChipOnIdle = null;
  setInstrumentViewPhase('idle');
  if (offerPriceChipKind) flushPendingPriceChip(offerPriceChipKind);
}

function leaveInstrumentView({ immediate = false, offerPriceChip = true } = {}) {
  if (instrumentView.phase === 'idle') return;
  // Reset without a pointer id so a captured/lost iOS touch cannot leave the
  // floating joystick visible after returning from an instrument.
  releaseMoveJoystick();
  const leavingKind = instrumentView.kind;
  if (leavingKind === 'piano') releaseAllHeldPianoNotes();
  if (leavingKind === 'guitar') {
    clearGuitarInteractionState();
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
    setInstrumentViewPhase('idle');
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
    setInstrumentViewPhase('idle');
    if (offerKind) flushPendingPriceChip(offerKind);
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
  );
}

function updateInstrumentViewCamera(dt) {
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
    camera.lookAt(controls.target);
    if (k >= 1) {
      if (transition.mascotPose) applyMascotInstrumentPose(transition.mascotPose.to);
      instrumentView.transition = null;
      if (instrumentView.phase === 'entering') {
        applyFocusedControlLimits();
        syncControlsAtInstrumentFrame(transition.toPosition, transition.toTarget);
        controls.enabled = true;
        setInstrumentViewPhase('focused', instrumentView.kind);
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

function requestInstrumentView(kind) {
  const preset = INSTRUMENT_VIEW_PRESETS[kind];
  if (!preset || mascotMove.fall || flyT >= 0) return;
  if (instrumentView.kind === kind && ['approaching', 'entering', 'focused'].includes(instrumentView.phase)) return;
  if (instrumentView.phase !== 'idle') leaveInstrumentView({ immediate: true, offerPriceChip: false });
  setDancing(false);
  setInstrumentViewPhase('approaching', kind);
  mascotMove.keys.clear();
  releaseMoveJoystick();
  controls.autoRotate = false;
  clearTimeout(idleTimer);
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

function zoomScene(factor) {
  if (!started || !controls.enabled || ui.modalOpen) return;
  const offset = camera.position.clone().sub(controls.target);
  const nextDistance = THREE.MathUtils.clamp(
    offset.length() * factor,
    controls.minDistance,
    controls.maxDistance,
  );
  if (Math.abs(nextDistance - offset.length()) < 0.001) return;
  controls.autoRotate = false;
  clearTimeout(idleTimer);
  camera.position.copy(controls.target).add(offset.setLength(nextDistance));
  controls.update();
}

zoomIn.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  zoomScene(ZOOM_IN_STEP);
});
zoomOut.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  zoomScene(1.22);
});

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

function releaseMoveJoystick(event) {
  if (event && joystickPointer !== null && event.pointerId !== joystickPointer) return;
  joystickPointer = null;
  joystickInput.set(0, 0);
  resetStickHome();
}

function beginMoveJoystick(event) {
  if (!started || ui.modalOpen || mascotMove.fall) return;
  if (instrumentView.phase !== 'idle') return;
  event.preventDefault();
  controls.autoRotate = false;
  clearTimeout(idleTimer);
  finishOnboard();
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

function clampMascotPoint(point) {
  point.x = THREE.MathUtils.clamp(point.x, mascotMove.travelBounds.minX, mascotMove.travelBounds.maxX);
  point.z = THREE.MathUtils.clamp(point.z, mascotMove.travelBounds.minZ, mascotMove.travelBounds.maxZ);
  point.y = 0;
  return point;
}

function setMascotDestination(point) {
  if (mascotMove.fall || instrumentView.phase !== 'idle') return;
  mascotMove.destinationKind = null;
  const route = planMascotWalkRoute(mascot.group.position, point);
  mascotMove.waypoints = route;
  mascotMove.destination = mascotMove.waypoints.shift() || null;
  controls.autoRotate = false;
  finishOnboard();
}

function beginMascotFall(direction) {
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
  clearTimeout(idleTimer);
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

function respawnMascot() {
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

function walkMascotToInstrument(kind) {
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

function playNearestInstrument() {
  if (!started || ui.modalOpen || mascotMove.fall) return false;
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

function updateMobilePlayAvailability() {
  if (!isMobileGameMode()) return;
  const now = performance.now();
  if (now - updateMobilePlayAvailability.lastCheck < 90) return;
  updateMobilePlayAvailability.lastCheck = now;
  const nearest = started && !ui.modalOpen && !mascotMove.fall ? nearestInstrument() : null;
  const available = Boolean(nearest && nearest.distance <= mobileInstrumentReach());
  const label = available
    ? `Грати на інструменті: ${nearest.kind}`
    : 'Підійди ближче до інструмента щоб заграти';
  if (
    updateMobilePlayAvailability.available === available
    && updateMobilePlayAvailability.label === label
    && updateMobilePlayAvailability.started === started
  ) return;
  updateMobilePlayAvailability.available = available;
  updateMobilePlayAvailability.label = label;
  updateMobilePlayAvailability.started = started;
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

function mobilePlayIsUnavailable() {
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

function updateMascotEditorPreview(dt) {
  const relax = Math.min(1, dt * 10);
  mascot.legL.rotation.x = THREE.MathUtils.lerp(mascot.legL.rotation.x, 0, relax);
  mascot.legR.rotation.x = THREE.MathUtils.lerp(mascot.legR.rotation.x, 0, relax);
  mascot.armL.rotation.x = THREE.MathUtils.lerp(mascot.armL.rotation.x, 0, relax);
  mascot.armR.rotation.x = THREE.MathUtils.lerp(mascot.armR.rotation.x, 0, relax);
  mascot.armL.rotation.z = THREE.MathUtils.lerp(mascot.armL.rotation.z, -0.12, relax);
  mascot.armR.rotation.z = THREE.MathUtils.lerp(mascot.armR.rotation.z, 0.12, relax);
  mascot.torso.rotation.z = THREE.MathUtils.lerp(mascot.torso.rotation.z, 0, relax);
  mascot.head.rotation.z = THREE.MathUtils.lerp(mascot.head.rotation.z, 0, relax);
  mascot.group.position.y = THREE.MathUtils.lerp(mascot.group.position.y, 0, relax);
}

function updateMascot(dt) {
  if (!started || flyT >= 0) return;
  if (mascotEditor.active) {
    updateMascotEditorPreview(dt);
    return;
  }
  if (ui.modalOpen) return;
  if (mascotMove.fall) {
    const fall = mascotMove.fall;
    fall.t += dt;
    const fallProgress = Math.min(1, fall.t / fall.duration);
    mascot.group.position.addScaledVector(fall.velocity, dt);
    mascot.group.position.y = -0.05 - 0.48 * fall.t - 0.38 * fall.t * fall.t;
    applyMascotScale(1 - fallProgress * 0.24);
    mascot.group.rotation.z += dt * 1.7;
    mascot.group.rotation.x += dt * 0.82;
    for (const material of mascotFallMaterialStates.keys()) {
      material.opacity = THREE.MathUtils.lerp(0.92, 0.3, fallProgress);
    }
    const cameraDrop = THREE.MathUtils.smoothstep(fallProgress, 0, 1) * 3.35;
    camera.position.copy(fall.cameraPosition);
    camera.position.y -= cameraDrop;
    controls.target.copy(fall.cameraTarget);
    controls.target.y -= cameraDrop;
    camera.lookAt(controls.target);
    if (mascotLabel) {
      mascotLabel.visible = fall.t < 0.42;
      mascotLabel.position.set(mascot.group.position.x, mascot.group.position.y + mascotLabelY(), mascot.group.position.z);
    }
    if (fall.t >= fall.duration) respawnMascot();
    return;
  }
  if (instrumentView.phase === 'entering' || instrumentView.phase === 'focused' || instrumentView.phase === 'returning') {
    if (instrumentView.kind === 'guitar' && instrumentView.phase !== 'returning') {
      guitarStrokeMotion *= Math.pow(0.012, dt);
      if (guitarStrokeMotion < 0.002) guitarStrokeMotion = 0;
      const motion = prefersReducedMotion.matches ? 0 : guitarStrokeMotion;
      mascot.armR.rotation.x = -0.66 + motion * 0.12;
      mascot.armR.rotation.z = 0.24 + guitarStrokeDirection * motion * 0.34;
    }
    if (mascotLabel) {
      mascotLabel.visible = instrumentView.phase === 'returning';
      if (mascotLabel.visible) {
        mascotLabel.position.set(mascot.group.position.x, mascot.group.position.y + mascotLabelY(), mascot.group.position.z);
      }
    }
    return;
  }
  const direction = new THREE.Vector3();

  if (joystickInput.lengthSq() > 0) {
    camera.getWorldDirection(cameraForwardXZ);
    cameraForwardXZ.y = 0;
    if (cameraForwardXZ.lengthSq() < 0.001) cameraForwardXZ.set(0, 0, -1);
    cameraForwardXZ.normalize();
    cameraRightXZ.crossVectors(cameraForwardXZ, camera.up).normalize();
    direction.addScaledVector(cameraRightXZ, joystickInput.x);
    direction.addScaledVector(cameraForwardXZ, -joystickInput.y);
  }

  // Any walk input / queued destination takes the mascot out of the dance.
  if (dance.active && (direction.lengthSq() > 0 || mascotMove.destination || instrumentView.phase !== 'idle')) {
    setDancing(false);
  }

  if (direction.lengthSq() > 0) {
    if (instrumentView.phase !== 'idle') {
      // Focus stays until ✕ — ignore walk input while approaching / seated.
      direction.set(0, 0, 0);
    } else {
      mascotMove.destination = null;
      if (mascotMove.keys.size || joystickInput.lengthSq() > 0) finishOnboard();
    }
  }
  else if (mascotMove.destination) {
    direction.subVectors(mascotMove.destination, mascot.group.position).setY(0);
    if (direction.length() < 0.08) {
      if (mascotMove.waypoints.length) {
        mascotMove.destination = mascotMove.waypoints.shift();
        direction.subVectors(mascotMove.destination, mascot.group.position).setY(0);
      } else {
        const arrivedKind = mascotMove.destinationKind;
        mascotMove.destination = null;
        mascotMove.destinationKind = null;
        direction.set(0, 0, 0);
        if (arrivedKind) {
          activateInstrumentView(arrivedKind);
          return;
        }
      }
    }
  }

  const walking = !dance.active && direction.lengthSq() > 0;
  if (walking) {
    const moveStrength = Math.min(1, direction.length());
    direction.normalize();
    moveMascotWithColliders(direction, mascotMove.speed * dt * moveStrength);
    const targetRotation = Math.atan2(direction.x, direction.z);
    const rotationDelta = Math.atan2(Math.sin(targetRotation - mascot.group.rotation.y), Math.cos(targetRotation - mascot.group.rotation.y));
    mascot.group.rotation.y += rotationDelta * Math.min(1, dt * 10);
    mascotMove.phase += dt * 10;
    if (
      mascot.group.position.x < mascotMove.stageEdge.minX ||
      mascot.group.position.x > mascotMove.stageEdge.maxX ||
      mascot.group.position.z > mascotMove.stageEdge.frontZ
    ) {
      beginMascotFall(direction);
      return;
    }
  }

  if (dance.active) {
    updateMascotDance(dt);
  } else {
    const stride = walking ? Math.sin(mascotMove.phase) * 0.58 : 0;
    const relax = Math.min(1, dt * 10);
    mascot.legL.rotation.x = THREE.MathUtils.lerp(mascot.legL.rotation.x, stride, relax);
    mascot.legR.rotation.x = THREE.MathUtils.lerp(mascot.legR.rotation.x, -stride, relax);
    mascot.armL.rotation.x = THREE.MathUtils.lerp(mascot.armL.rotation.x, -stride * 0.75, relax);
    mascot.armR.rotation.x = THREE.MathUtils.lerp(mascot.armR.rotation.x, stride * 0.75, relax);
    // Relax dance-only rotations back to neutral (no-ops outside the dance).
    mascot.armL.rotation.z = THREE.MathUtils.lerp(mascot.armL.rotation.z, -0.12, relax);
    mascot.armR.rotation.z = THREE.MathUtils.lerp(mascot.armR.rotation.z, 0.12, relax);
    mascot.legL.rotation.z = THREE.MathUtils.lerp(mascot.legL.rotation.z, 0, relax);
    mascot.legR.rotation.z = THREE.MathUtils.lerp(mascot.legR.rotation.z, 0, relax);
    mascot.head.rotation.x = THREE.MathUtils.lerp(mascot.head.rotation.x, 0, relax);
    mascot.group.position.y = walking ? Math.abs(Math.sin(mascotMove.phase * 2)) * 0.035 : 0;
    mascot.torso.rotation.z = walking ? Math.sin(mascotMove.phase) * 0.035 : 0;
    mascot.head.rotation.z = walking ? -Math.sin(mascotMove.phase) * 0.025 : 0;
  }

  if (mascotLabel) {
    const bob = prefersReducedMotion.matches ? 0 : Math.sin(performance.now() * 0.003) * 0.04;
    mascotLabel.position.set(
      mascot.group.position.x,
      mascot.group.position.y + mascotLabelY() + bob,
      mascot.group.position.z,
    );
    const pulse = prefersReducedMotion.matches ? 1 : 1 + Math.sin(performance.now() * 0.004) * 0.06;
    mascotLabel.scale.setScalar(0.55 * pulse);
  }

  updateMobileFollowCamera(dt);
}

const INSTRUMENT_STYLE = {
  drums: { glow: 0x9E33CA },
  piano: { glow: 0xD1A13B },
  guitar: { glow: 0xD1A13B },
  mic: { glow: 0x9E33CA },
};

function setGlow(mesh, on) {
  const inst = mesh.userData.instrument;
  const apply = (m) => {
    if (!m.material || !m.material.emissive) return;
    if (m.userData._baseEmissive === undefined) {
      m.userData._baseEmissive = m.material.emissive.getHex();
      m.userData._baseEI = m.material.emissiveIntensity ?? 1;
    }
    if (on) {
      m.material.emissive.setHex(INSTRUMENT_STYLE[inst].glow);
      m.material.emissiveIntensity = inst === 'piano' ? 0.5 : 0.3;
    } else {
      m.material.emissive.setHex(m.userData._baseEmissive);
      m.material.emissiveIntensity = m.userData._baseEI;
    }
  };
  if (inst === 'piano') {
    if (mesh.userData.freq !== undefined) apply(mesh);
    else piano.group.traverse((o) => { if (o.isMesh && o.userData.freq === undefined) apply(o); });
  } else {
    const root = instruments.find((i) => i.group === mesh.userData.root || i.label.toLowerCase().includes(inst)) ||
      { group: mesh };
    const group = { drums: drums.group, guitar: guitar.group, mic: mic.group }[inst] || mesh;
    group.traverse((o) => { if (o.isMesh) apply(o); });
    void root;
  }
}

function onPointerMove(e) {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

function pointerNdc(clientX, clientY, target = pointer) {
  target.x = (clientX / window.innerWidth) * 2 - 1;
  target.y = -(clientY / window.innerHeight) * 2 + 1;
  return target;
}

function hitInteractableDetailsAt(clientX, clientY, guitarZone = null) {
  pointerNdc(clientX, clientY);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(interactables, false);
  for (const hit of hits) {
    const zone = hit.object.userData.guitarZone;
    if (hit.object.userData.instrument !== 'guitar') {
      if (guitarZone) continue;
      return hit;
    }
    if (guitarZone && zone !== guitarZone) continue;
    if (isGuitarPlayFocus()) {
      if (zone === 'strum' || zone === 'fretboard') return hit;
      continue;
    }
    if (zone === 'approach') return hit;
  }
  return null;
}

function hitInteractableAt(clientX, clientY) {
  return hitInteractableDetailsAt(clientX, clientY)?.object || null;
}

function isMultiTouchInstrumentFocus() {
  return instrumentView.phase === 'focused'
    && (instrumentView.kind === 'piano' || instrumentView.kind === 'drums');
}

function isGuitarPlayFocus() {
  return instrumentView.phase === 'focused' && instrumentView.kind === 'guitar';
}

function canPlayInstrument(kind) {
  return instrumentView.phase === 'focused' && instrumentView.kind === kind;
}

/** Desktop keyboard jam: sound without focus. Mobile keeps focus-gated pads only. */
function canKeyboardJamPlay() {
  return started && !ui.modalOpen && !isMobileGameMode();
}

// Six-string voicings, low E → high E. null is a muted string.
const GUITAR_OPEN_FREQS = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63];
const GUITAR_CHORDS = {
  Em: [0, 2, 2, 0, 0, 0],
  Am: [null, 0, 2, 2, 1, 0],
  C: [null, 3, 2, 0, 1, 0],
  D: [null, null, 0, 2, 3, 2],
  G: [3, 2, 0, 0, 0, 3],
  F: [1, 3, 3, 2, 1, 1],
};
const GUITAR_OPEN_SHAPE = [0, 0, 0, 0, 0, 0];
// Disjoint from approach (E), loop (L), drums, piano, and vocal controls.
const GUITAR_KEY_CHORDS = {
  KeyQ: 'Em',
  KeyR: 'Am',
  KeyT: 'C',
  KeyY: 'D',
  KeyU: 'G',
  KeyI: 'F',
};
let heldGuitarChord = null;
let heldGuitarChordPointer = null;
let latchedGuitarChord = null;
let keyboardGuitarChord = null;
let keyboardVocal = null;
let keyboardVocalPulseTimer = null;
let guitarStrokeMotion = 0;
let guitarStrokeDirection = 1;

function currentGuitarChordName() {
  return keyboardGuitarChord || heldGuitarChord || latchedGuitarChord || null;
}

function currentGuitarShape() {
  return GUITAR_CHORDS[currentGuitarChordName()] || GUITAR_OPEN_SHAPE;
}

function guitarPitchForString(stringIndex, fret = currentGuitarShape()[stringIndex]) {
  if (fret === null || fret === undefined) return null;
  return GUITAR_OPEN_FREQS[stringIndex] * (2 ** (fret / 12));
}

function allGuitarPitches() {
  const seen = new Set();
  const pitches = [];
  for (const shape of [GUITAR_OPEN_SHAPE, ...Object.values(GUITAR_CHORDS)]) {
    shape.forEach((fret, stringIndex) => {
      const freqHz = guitarPitchForString(stringIndex, fret);
      if (!freqHz) return;
      const key = `${stringIndex}:${Math.round(freqHz * 10)}`;
      if (seen.has(key)) return;
      seen.add(key);
      pitches.push({ stringIndex, freqHz });
    });
  }
  return pitches;
}

function createGuitarStringEvent(stringIndex, fret, offsetMs = 0) {
  const freqHz = guitarPitchForString(stringIndex, fret);
  if (!freqHz) return null;
  return { stringIndex, fret, freqHz, offsetMs: Math.max(0, offsetMs) };
}

function fireGuitarStrum(
  vel = 0.72,
  direction = 'bass-to-treble',
  stringIndices = null,
  offsetByString = null,
  feedback = true,
  { focusRequired = true } = {},
) {
  if (focusRequired && !isGuitarPlayFocus()) return false;
  const shape = currentGuitarShape();
  const order = stringIndices || (
    direction === 'treble-to-bass'
      ? [5, 4, 3, 2, 1, 0]
      : [0, 1, 2, 3, 4, 5]
  );
  const spread = 8 + (1 - THREE.MathUtils.clamp(vel, 0, 1)) * 24;
  const strings = order.map((stringIndex, orderIndex) => createGuitarStringEvent(
    stringIndex,
    shape[stringIndex],
    offsetByString?.get(stringIndex) ?? orderIndex * spread,
  )).filter(Boolean);
  if (!strings.length) return false;
  markHeldTouchGuitarChordUsed();
  playMusicalEvent({
    type: 'guitar-strum',
    direction,
    strings,
    vel: THREE.MathUtils.clamp(vel, 0.16, 1),
    vibe: 5,
  }, { feedback });
  guitarStrokeDirection = direction === 'treble-to-bass' ? -1 : 1;
  guitarStrokeMotion = Math.max(guitarStrokeMotion, vel);
  return true;
}

function pluckGuitarString(stringIndex, fret, vel = 0.7, feedback = true) {
  if (!isGuitarPlayFocus()) return false;
  const stringEvent = createGuitarStringEvent(stringIndex, fret, 0);
  if (!stringEvent) return false;
  markHeldTouchGuitarChordUsed();
  playMusicalEvent({
    type: 'guitar-pluck',
    ...stringEvent,
    freq: stringEvent.freqHz,
    vel: THREE.MathUtils.clamp(vel, 0.16, 1),
    vibe: 3,
  }, { feedback });
  return true;
}

function playTokenForMesh(mesh) {
  if (!mesh) return null;
  const u = mesh.userData;
  if (u.freq !== undefined) return `piano:${u.freq}`;
  if (u.part) return `drum:${u.part}`;
  return `id:${mesh.id}`;
}

function guitarLocalPoint(hit) {
  return hit.object.worldToLocal(hit.point.clone());
}

function nearestGuitarString(stringXs, localX) {
  let closest = 0;
  let distance = Infinity;
  for (let index = 0; index < stringXs.length; index++) {
    const nextDistance = Math.abs(stringXs[index] - localX);
    if (nextDistance < distance) {
      closest = index;
      distance = nextDistance;
    }
  }
  return closest;
}

function guitarFretHit(hit) {
  const local = guitarLocalPoint(hit);
  const data = hit.object.userData;
  const bodyY = data.centerY + local.y;
  let fret = 1;
  for (let candidate = 1; candidate <= data.fretCount; candidate++) {
    const upper = data.fretYs[candidate - 1];
    const lower = data.fretYs[candidate];
    if (bodyY <= upper && bodyY >= lower) {
      fret = candidate;
      break;
    }
  }
  const neckHalfWidth = 0.045;
  const normalized = THREE.MathUtils.clamp((local.x + neckHalfWidth) / (neckHalfWidth * 2), 0, 1);
  const stringIndex = Math.round(normalized * 5);
  // A selected chord owns the fretting: touching any point on its string keeps
  // the chord voicing rather than falling back to the visual fret position.
  const chordFret = currentGuitarChordName() ? currentGuitarShape()[stringIndex] : fret;
  return {
    stringIndex,
    fret: chordFret,
    freqHz: chordFret === null ? null : data.openFreqs[stringIndex] * (2 ** (chordFret / 12)),
    token: `${stringIndex}:${chordFret}`,
  };
}

// Track each finger separately so pads and instrument play remain independent.
const activePointers = new Map();
const heldPianoNotes = new Set();
const keyboardPianoNotes = new Map();
/** Play-surface pointers must not drive OrbitControls rotate / zoom. */
function blocksOrbitPointer(info) {
  return info?.mode === 'play'
    || info?.mode === 'guitar-strum'
    || info?.mode === 'guitar-fret'
    || info?.mode === 'guitar-approach';
}

canvas.addEventListener('pointerdown', (e) => {
  if (!started || ui.modalOpen || flyT >= 0) return;

  if (isMultiTouchInstrumentFocus()) {
    const mesh = hitInteractableAt(e.clientX, e.clientY);
    if (mesh && mesh.userData.instrument === instrumentView.kind) {
      // Claim the pointer so OrbitControls cannot rotate / zoom from keys / drums.
      e.preventDefault();
      e.stopImmediatePropagation();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      const pointerInfo = {
        mode: 'play',
        x: e.clientX,
        y: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        t: performance.now(),
        token: playTokenForMesh(mesh),
        pointerType: e.pointerType,
        pianoHold: null,
      };
      activePointers.set(e.pointerId, pointerInfo);
      if (instrumentView.kind === 'piano') pointerInfo.pianoHold = beginHeldPianoNote(mesh);
      else trigger(mesh);
      return;
    }
  }

  {
    const hit = hitInteractableDetailsAt(e.clientX, e.clientY);
    const mesh = hit?.object;
    if (mesh?.userData.instrument === 'guitar') {
      e.preventDefault();
      e.stopImmediatePropagation();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }

      if (!isGuitarPlayFocus()) {
        activePointers.set(e.pointerId, {
          mode: 'guitar-approach',
          x: e.clientX,
          y: e.clientY,
          t: performance.now(),
          approached: false,
        });
        return;
      }

      if (mesh.userData.guitarZone === 'fretboard') {
        const fretHit = guitarFretHit(hit);
        activePointers.set(e.pointerId, {
          mode: 'guitar-fret',
          token: fretHit.token,
        });
        pluckGuitarString(fretHit.stringIndex, fretHit.fret, 0.72);
        return;
      }

      const local = guitarLocalPoint(hit);
      activePointers.set(e.pointerId, {
        mode: 'guitar-strum',
        x: e.clientX,
        y: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        t: performance.now(),
        lastAt: performance.now(),
        lastLocalX: local.x,
        stringXs: [...mesh.userData.stringXs],
        seenStrings: new Set(),
        strummed: false,
        dir: 0,
        strokeFeedbackPending: true,
        strokeCompletionReported: false,
        pointerType: e.pointerType,
        hitMesh: mesh,
      });
      return;
    }
  }

  activePointers.set(e.pointerId, {
    mode: 'tap',
    x: e.clientX,
    y: e.clientY,
    currentX: e.clientX,
    currentY: e.clientY,
    t: performance.now(),
    pointerType: e.pointerType,
  });
}, { capture: true, passive: false });

canvas.addEventListener('pointermove', (e) => {
  const info = activePointers.get(e.pointerId);
  if (!info) return;
  info.currentX = e.clientX;
  info.currentY = e.clientY;

  if (blocksOrbitPointer(info)) {
    e.stopImmediatePropagation();
  }

  if (info.mode === 'guitar-approach') {
    if (info.approached) return;
    if (Math.hypot(e.clientX - info.x, e.clientY - info.y) >= 18) {
      info.approached = true;
      walkMascotToInstrument('guitar');
    }
    return;
  }

  if (info.mode === 'guitar-fret') {
    if (!isGuitarPlayFocus()) return;
    const hit = hitInteractableDetailsAt(e.clientX, e.clientY, 'fretboard');
    if (!hit) return;
    const fretHit = guitarFretHit(hit);
    if (fretHit.token === info.token) return;
    info.token = fretHit.token;
    pluckGuitarString(fretHit.stringIndex, fretHit.fret, 0.64, false);
    return;
  }

  if (info.mode === 'play') {
    if (!isMultiTouchInstrumentFocus()) return;
    const mesh = hitInteractableAt(e.clientX, e.clientY);
    if (!mesh || mesh.userData.instrument !== instrumentView.kind) return;
    const token = playTokenForMesh(mesh);
    if (token === info.token) return;
    info.token = token;
    if (instrumentView.kind === 'piano') {
      releaseHeldPianoNote(info.pianoHold);
      info.pianoHold = beginHeldPianoNote(mesh);
    } else {
      trigger(mesh);
    }
    return;
  }

  if (info.mode === 'guitar-strum') {
    if (!isGuitarPlayFocus()) return;
    const samples = e.getCoalescedEvents?.() || [e];
    for (const sample of samples.length ? samples : [e]) {
      const now = sample.timeStamp || performance.now();
      const hit = hitInteractableDetailsAt(sample.clientX, sample.clientY, 'strum');
      if (!hit) {
        info.lastLocalX = null;
        info.lastX = sample.clientX;
        info.lastY = sample.clientY;
        info.lastAt = now;
        continue;
      }
      const localX = guitarLocalPoint(hit).x;
      if (info.lastLocalX === null) {
        info.lastLocalX = localX;
        info.lastX = sample.clientX;
        info.lastY = sample.clientY;
        info.lastAt = now;
        continue;
      }
      const localDelta = localX - info.lastLocalX;
      const dtMs = Math.max(1, now - info.lastAt);
      const screenDistance = Math.hypot(sample.clientX - info.lastX, sample.clientY - info.lastY);
      const sign = Math.sign(localDelta);
      if (!sign || Math.abs(localDelta) < 0.0015) {
        info.lastLocalX = localX;
        info.lastX = sample.clientX;
        info.lastY = sample.clientY;
        info.lastAt = now;
        continue;
      }
      if (info.dir && sign !== info.dir) {
        if (Math.abs(localDelta) < 0.004) continue;
        info.dir = sign;
        info.seenStrings.clear();
        info.strokeFeedbackPending = true;
        info.strokeCompletionReported = false;
      } else if (!info.dir) {
        info.dir = sign;
      }

      const crossed = info.stringXs.filter((stringX, stringIndex) => {
        if (info.seenStrings.has(stringIndex)) return false;
        return sign > 0
          ? stringX > info.lastLocalX && stringX <= localX
          : stringX < info.lastLocalX && stringX >= localX;
      }).map((stringX) => ({
        stringX,
        stringIndex: info.stringXs.indexOf(stringX),
      }));
      crossed.sort((a, b) => sign > 0 ? a.stringX - b.stringX : b.stringX - a.stringX);

      if (crossed.length) {
        const firstFraction = Math.abs((crossed[0].stringX - info.lastLocalX) / localDelta);
        const offsets = new Map();
        for (const crossing of crossed) {
          const fraction = Math.abs((crossing.stringX - info.lastLocalX) / localDelta);
          offsets.set(crossing.stringIndex, Math.max(0, (fraction - firstFraction) * Math.min(dtMs, 42)));
          info.seenStrings.add(crossing.stringIndex);
        }
        const speed = screenDistance / dtMs;
        const velocity = THREE.MathUtils.clamp(0.18 + speed * 0.74, 0.18, 1);
        const direction = sign > 0 ? 'bass-to-treble' : 'treble-to-bass';
        const gaveFeedback = info.strokeFeedbackPending;
        if (fireGuitarStrum(
          velocity,
          direction,
          crossed.map((crossing) => crossing.stringIndex),
          offsets,
          gaveFeedback,
        )) {
          info.strummed = true;
          if (gaveFeedback) {
            info.strokeFeedbackPending = false;
          }
          if (!info.strokeCompletionReported && info.seenStrings.size >= 3) {
            info.strokeCompletionReported = true;
            navigator.vibrate?.(Math.round(4 + velocity * 7));
          }
        }
      }
      info.lastLocalX = localX;
      info.lastX = sample.clientX;
      info.lastY = sample.clientY;
      info.lastAt = now;
    }
  }
}, { capture: true, passive: true });

function endActivePointer(e) {
  const info = activePointers.get(e.pointerId);
  releaseHeldPianoNote(info?.pianoHold);
  activePointers.delete(e.pointerId);
  if (!info) return;

  if (info.mode === 'guitar-approach') {
    if (!info.approached) walkMascotToInstrument('guitar');
    return;
  }

  if (info.mode === 'guitar-strum') {
    if (info.strummed || !isGuitarPlayFocus()) return;
    if (!isQuickGuitarTap({
      elapsedMs: performance.now() - info.t,
      distancePx: Math.hypot(e.clientX - info.x, e.clientY - info.y),
    })) return;
    const hit = hitInteractableDetailsAt(e.clientX, e.clientY, 'strum');
    if (!hit) return;
    const localX = guitarLocalPoint(hit).x;
    const stringIndex = nearestGuitarString(info.stringXs, localX);
    pluckGuitarString(stringIndex, currentGuitarShape()[stringIndex], 0.62);
    return;
  }

  if (info.mode !== 'tap') return;
  const dx = e.clientX - info.x;
  const dy = e.clientY - info.y;
  const dt = performance.now() - info.t;
  const tapTolerance = isMobileGameMode() ? 28 : 8;
  if (Math.hypot(dx, dy) < tapTolerance && dt < 600) handleClick(e);
}

canvas.addEventListener('pointerup', endActivePointer, { capture: true });
canvas.addEventListener('pointercancel', (e) => {
  const info = activePointers.get(e.pointerId);
  releaseHeldPianoNote(info?.pianoHold, { cancel: true });
  activePointers.delete(e.pointerId);
}, { capture: true });
window.addEventListener('pointermove', onPointerMove, { passive: true });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Block accidental text selection / iOS callouts on game chrome (not modal panels).
document.addEventListener('selectstart', (e) => {
  if (e.target.closest?.('.panel, input, textarea, [contenteditable="true"]')) return;
  e.preventDefault();
}, { capture: true });
document.addEventListener('dragstart', (e) => {
  if (e.target.closest?.('.panel, input, textarea, [contenteditable="true"]')) return;
  e.preventDefault();
}, { capture: true });

// Block stage double-tap zoom. Play chrome (pads / toast / pedal) must ALSO
// claim double-taps — skipping them was letting vocal-pad ↔ vibe-toast taps zoom.
{
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    if (e.target.closest?.('.panel, input, textarea, [contenteditable="true"]')) return;
    const now = performance.now();
    if (now - lastTouchEnd < 320 && e.cancelable) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false, capture: true });
  document.addEventListener('touchend', () => {
    requestAnimationFrame(resetBrowserPageZoom);
  }, { passive: true, capture: true });
}

const VIEWPORT_META_BASE = 'width=device-width, initial-scale=1, maximum-scale=5, minimum-scale=1, user-scalable=yes, viewport-fit=cover';
const VIEWPORT_META_GAME = 'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover';
let viewportResetTimer = 0;

function syncViewportMeta() {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  // Allow pinch only inside readable modals; lock zoom on the live stage.
  meta.setAttribute('content', (started && !ui.modalOpen) ? VIEWPORT_META_GAME : VIEWPORT_META_BASE);
}

function resetBrowserPageZoom() {
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

function refitActiveInstrumentView() {
  const kind = instrumentView.kind;
  if (!kind || !['entering', 'focused'].includes(instrumentView.phase)) return;
  const preset = INSTRUMENT_VIEW_PRESETS[kind];
  if (!preset) return;
  const frame = instrumentViewFrame(kind, preset);
  const nextPosition = frame.position;
  const nextTarget = frame.target;
  syncInstrumentExposure();
  if (instrumentView.phase === 'entering' && instrumentView.transition) {
    instrumentView.transition.toPosition.copy(nextPosition);
    instrumentView.transition.toTarget.copy(nextTarget);
    return;
  }
  if (kind === 'piano' && !prefersReducedMotion.matches) {
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

function syncRendererToWindow() {
  fitCameraToViewport();
  applyMobileOrbitPolicy();
  renderer.shadowMap.enabled = !isLowEndMobileGameMode();
  document.documentElement.dataset.shadows = renderer.shadowMap.enabled ? 'on' : 'off';
  slideshowLayoutCache.initialized = false;
  syncMobileInstrumentChrome();
  if (instrumentView.home && instrumentView.phase !== 'idle') {
    instrumentView.home.maxDistance = controls.maxDistance;
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) {
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(window.innerWidth, window.innerHeight);
  }
  refitActiveInstrumentView();
  if (mascotEditor.active) queueMascotRefit();
}

// Pedal / pads / HUD sit above the canvas. preventDefault on a 2nd-finger
// touchstart suppresses that finger's pointer events — so never claim multitouch
// when any active touch is on UI chrome (loop pedal + drum must work together).
const UI_TOUCH_CHROME = '#loop-pedal, #vocal-pad, #chord-pad, #mobile-controls, #zoom-controls, #mobile-exit, #hud, #onboard, #toast, #chip, .overlay';

function isUiChromeElement(el) {
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

function eventInvolvesUiChrome(event) {
  return isUiChromeElement(event.target)
    || touchListHitsChrome(event.touches)
    || touchListHitsChrome(event.changedTouches);
}

function isLiveStageZoomLocked() {
  return started && !ui.modalOpen;
}

function blockStageBrowserPageZoom(event) {
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

// ---- vibe ----
let vibe = 0, lastVibeAdd = 0, vibeCooldown = 0;
let loopUnlocked = false;

function unlockLoopPedal() {
  if (loopUnlocked) return false;
  loopUnlocked = true;
  loopPedal.hidden = false;
  loopKeyHint.hidden = false;
  loopPedal.classList.remove('unlocking');
  void loopPedal.offsetWidth;
  loopPedal.classList.add('unlocking');
  loopStatus.textContent = 'Loop-педаль відкрито';
  return true;
}

function addVibe(n) {
  vibe = Math.min(100, vibe + n);
  lastVibeAdd = performance.now();
  ui.setVibe(vibe);
  const justUnlocked = vibe >= 100 && unlockLoopPedal();
  if (vibe >= 100 && (justUnlocked || performance.now() > vibeCooldown)) {
    vibeCooldown = performance.now() + 4000;
    const spots = [new THREE.Vector3(-2, 4.6, 0), new THREE.Vector3(2.2, 5.2, -1), new THREE.Vector3(0, 5.6, 1)];
    spots.forEach((p, i) => setTimeout(() => fireworks.spawn(p), i * 260));
    bumpHitPulse(1.35);
    if (justUnlocked) {
      ui.toast(
        'МАКСИМАЛЬНИЙ ВАЙБ! <span class="hl">LOOP-ПЕДАЛЬ ВІДКРИТО</span>',
        4200,
        'vibe-max',
      );
    }
    // Meter celebrates at 100% while the fireworks/toast run, then settles.
    vibe = 55;
    lastVibeAdd = performance.now() + 3600;
    setTimeout(() => ui.setVibe(vibe), 3600);
  }
}

// ---- price carousel ----
const PRICE_SLIDES = [
  { kind: 'mic', title: 'Уроки вокалу', anchor: 'vocal' },
  { kind: 'guitar', title: 'Уроки гітари', anchor: 'guitar' },
  { kind: 'drums', title: 'Уроки гри на барабанах', anchor: 'drums' },
  { kind: 'piano', title: 'Уроки фортепіано', anchor: 'piano' },
];
const shownPriceChips = new Set();
const pendingPriceChips = new Set();

function chipFor(kind, { force = false } = {}) {
  if (ui.modalOpen) return;
  if (!force && shownPriceChips.has(kind)) return;
  shownPriceChips.add(kind);
  pendingPriceChips.delete(kind);
  const index = Math.max(0, PRICE_SLIDES.findIndex((slide) => slide.kind === kind));
  const slide = PRICE_SLIDES[index];
  const showAt = (nextIndex) => chipFor(PRICE_SLIDES[(nextIndex + PRICE_SLIDES.length) % PRICE_SLIDES.length].kind, { force: true });
  ui.showChip(
    `${slide.title} <span class="accent">від 50 зл</span>`,
    '',
    'ДЕТАЛІ',
    () => ui.open('pricing', slide.anchor),
    { onPrev: () => showAt(index - 1), onNext: () => showAt(index + 1) },
  );
}

function queuePriceChip(kind) {
  if (!kind || shownPriceChips.has(kind)) return;
  pendingPriceChips.add(kind);
}

function flushPendingPriceChip(kind) {
  if (!kind || !pendingPriceChips.has(kind) || ui.modalOpen) return;
  pendingPriceChips.delete(kind);
  clearKeyboardJamChipTimer(kind);
  chipFor(kind);
}

const KEYBOARD_CHIP_SILENCE_MS = 2000;
const keyboardJamChipTimers = new Map();

function clearKeyboardJamChipTimer(kind) {
  if (!kind) return;
  const timer = keyboardJamChipTimers.get(kind);
  if (timer) clearTimeout(timer);
  keyboardJamChipTimers.delete(kind);
}

function hasActiveKeyboardJamSound(kind) {
  if (kind === 'piano') return keyboardPianoNotes.size > 0;
  if (kind === 'guitar') return Boolean(keyboardGuitarChord);
  if (kind === 'mic') return Boolean(keyboardVocal);
  return false;
}

function scheduleKeyboardJamChip(kind) {
  if (!kind || !pendingPriceChips.has(kind) || shownPriceChips.has(kind)) return;
  clearKeyboardJamChipTimer(kind);
  keyboardJamChipTimers.set(kind, setTimeout(() => {
    keyboardJamChipTimers.delete(kind);
    if (hasActiveKeyboardJamSound(kind)) {
      scheduleKeyboardJamChip(kind);
      return;
    }
    if (instrumentView.phase === 'focused' && instrumentView.kind === kind) return;
    flushPendingPriceChip(kind);
  }, KEYBOARD_CHIP_SILENCE_MS));
}

/** Keyboard play without matching focus → chip after ~2s silence (SPEC). */
function noteKeyboardJamActivity(kind) {
  if (!kind || !pendingPriceChips.has(kind)) return;
  if (instrumentView.phase === 'focused' && instrumentView.kind === kind) {
    clearKeyboardJamChipTimer(kind);
    return;
  }
  scheduleKeyboardJamChip(kind);
}

// ---- multi-instrument loop pedal ----
const LOOP_MAX_SECONDS = 12;
const LOOP_LOOKAHEAD = 0.12;
const LOOP_TICK_MS = 25;
const LOOP_EVENT_LIMIT = 192;
const loop = {
  state: 'empty',
  events: [],
  duration: 0,
  epoch: 0,
  recordStartedAt: 0,
  pausedOffset: 0,
  layers: 0,
  activeLayer: 0,
  layerStartCount: 0,
  nextId: 1,
  autoCloseTimer: null,
  schedulerTimer: null,
  scheduled: new Set(),
  activeVoices: new Set(),
  visualTimers: new Set(),
  lastUiAt: 0,
};

const positiveModulo = (value, modulus) => ((value % modulus) + modulus) % modulus;
const loopLayerWord = (count) => count === 1 ? 'шар' : (count < 5 ? 'шари' : 'шарів');

function cloneLoopEvent(event) {
  const clone = { ...event };
  if (event.freqs) clone.freqs = [...event.freqs];
  if (event.strings) clone.strings = event.strings.map((stringEvent) => ({ ...stringEvent }));
  return clone;
}

function captureLoopEvent(event, at = audio.ctx?.currentTime) {
  if (!audio.ctx || (loop.state !== 'recording' && loop.state !== 'overdubbing')) return null;
  if (loop.events.length >= LOOP_EVENT_LIMIT) {
    ui.toast('Loop заповнений — замкни цей шар', 1800);
    return null;
  }
  const now = Number.isFinite(at) ? at : audio.ctx.currentTime;
  const recordingBase = loop.state === 'recording';
  const offset = recordingBase
    ? Math.max(0, now - loop.recordStartedAt)
    : positiveModulo(now - loop.epoch, loop.duration);
  const captured = {
    ...cloneLoopEvent(event),
    id: loop.nextId++,
    offset,
    layer: loop.activeLayer,
    playFromCycle: recordingBase ? 0 : Math.floor((now - loop.epoch) / loop.duration) + 1,
  };
  loop.events.push(captured);
  return captured;
}

function clearLoopVisualTimers() {
  for (const timer of loop.visualTimers) clearTimeout(timer);
  loop.visualTimers.clear();
}

function stopLoopVoices() {
  for (const voice of loop.activeVoices) voice?.cancel?.();
  loop.activeVoices.clear();
}

function runMusicalVisual(event, feedback) {
  let kind = null;
  if (event.type === 'drum') {
    drums.hit(event.part);
    kind = 'drums';
  } else if (event.type === 'piano') {
    const key = piano.keys.find((candidate) => Math.abs(candidate.userData.freq - event.freq) < 0.01);
    if (key) piano.press(key);
    kind = 'piano';
  } else if (event.type === 'guitar-pluck') {
    guitar.pluck(event.stringIndex ?? 0, event.vel ?? 1, event.offsetMs ?? 0);
    kind = 'guitar';
  } else if (event.type === 'guitar-strum') {
    guitar.strum(event.strings || [], event.direction, event.vel ?? 1);
    guitarStrokeDirection = event.direction === 'treble-to-bass' ? -1 : 1;
    guitarStrokeMotion = Math.max(guitarStrokeMotion, event.vel ?? 0.72);
    kind = 'guitar';
  } else if (event.type === 'vocal') {
    mic.sing();
    kind = 'mic';
  }

  if (!feedback || !kind) return;
  if (kind !== 'mic') hideVocalPad();
  if (kind === 'mic' && event.showPad !== false) showVocalPad();
  addVibe(event.vibe ?? ({ drums: 4, piano: 3.5, guitar: 5, mic: 4 }[kind] || 3));
  if (event.showPrice !== false) queuePriceChip(kind);
}

function playMusicalEvent(event, { record = true, at = null, feedback = true } = {}) {
  // Live input may repair a stale mobile route. Look-ahead loop events only
  // resume the existing context; rebuilding must wait for a trusted gesture.
  activateAudioForSound({ allowRecovery: record });
  if (record) {
    captureLoopEvent(event);
    finishOnboard();
  }

  const startAt = Number.isFinite(at) ? at : null;
  const velocity = event.vel ?? 1;
  let voice = null;
  if (event.type === 'drum') {
    if (event.part === 'kick') audio.kick(velocity, startAt);
    else if (event.part === 'snare') audio.snare(velocity, startAt);
    else if (event.part === 'hihat') audio.hihat(false, velocity, startAt);
    else if (event.part === 'crash') audio.crash(velocity, startAt);
    else audio.tom(event.part === 'tom1' ? 150 : (event.part === 'floor' ? 95 : 120), velocity, startAt);
  } else if (event.type === 'piano') {
    audio.piano(event.freq, velocity, startAt, event.duration ?? 1.6);
  } else if (event.type === 'guitar-pluck') {
    audio.pluck(event.freqHz ?? event.freq, velocity, startAt, {
      stringIndex: event.stringIndex ?? 0,
      // Loop playback must survive muteGuitar() when leaving focus / falling.
      track: record,
    });
    audio.prewarmGuitar(allGuitarPitches());
  } else if (event.type === 'guitar-strum') {
    audio.strum(event.strings ?? event.freqs, velocity, startAt, { track: record });
    audio.prewarmGuitar(allGuitarPitches());
  } else if (event.type === 'vocal') {
    voice = audio.vocalTone(event.freq, event.vowel, velocity, startAt, event.duration ?? 0.68);
    if (!record && voice) {
      loop.activeVoices.add(voice);
      const cleanupDelay = Math.max(0, (((startAt ?? audio.ctx.currentTime) - audio.ctx.currentTime) + (event.duration ?? 0.68) + 0.36) * 1000);
      setTimeout(() => loop.activeVoices.delete(voice), cleanupDelay);
    }
  }

  const visualDelay = startAt === null ? 0 : Math.max(0, (startAt - audio.ctx.currentTime) * 1000);
  if (visualDelay > 5) {
    const timer = setTimeout(() => {
      loop.visualTimers.delete(timer);
      runMusicalVisual(event, feedback);
    }, visualDelay);
    loop.visualTimers.add(timer);
  } else {
    runMusicalVisual(event, feedback);
  }
  return voice;
}

function schedulerTick() {
  if (!audio.ctx || (loop.state !== 'playing' && loop.state !== 'overdubbing') || !loop.duration) return;
  const now = audio.ctx.currentTime;
  const firstCycle = Math.max(0, Math.floor((now - loop.epoch - 0.02) / loop.duration));
  const lastCycle = Math.max(firstCycle, Math.floor((now + LOOP_LOOKAHEAD - loop.epoch) / loop.duration));

  for (let cycle = firstCycle; cycle <= lastCycle; cycle++) {
    for (const event of loop.events) {
      if (event.durationPending) continue;
      if (cycle < event.playFromCycle) continue;
      const eventAt = loop.epoch + cycle * loop.duration + event.offset;
      if (eventAt < now - 0.02 || eventAt > now + LOOP_LOOKAHEAD) continue;
      const key = `${cycle}:${event.id}`;
      if (loop.scheduled.has(key)) continue;
      loop.scheduled.add(key);
      playMusicalEvent(event, { record: false, at: eventAt, feedback: false });
    }
  }

  if (loop.scheduled.size > Math.max(80, loop.events.length * 6)) {
    for (const key of loop.scheduled) {
      if (Number(key.slice(0, key.indexOf(':'))) < firstCycle - 1) loop.scheduled.delete(key);
    }
  }
}

function startLoopScheduler() {
  clearInterval(loop.schedulerTimer);
  loop.scheduled.clear();
  schedulerTick();
  loop.schedulerTimer = setInterval(schedulerTick, LOOP_TICK_MS);
}

function stopLoopScheduler() {
  clearInterval(loop.schedulerTimer);
  loop.schedulerTimer = null;
  loop.scheduled.clear();
  clearLoopVisualTimers();
  stopLoopVoices();
}

/** After fall / muteGuitar / audio suspend — re-queue upcoming loop notes. */
function resyncLoopPlayback() {
  if (loop.state !== 'playing' && loop.state !== 'overdubbing') return;
  audio.init();
  audio.resume();
  loop.scheduled.clear();
  stopLoopVoices();
  if (!loop.schedulerTimer) startLoopScheduler();
  else schedulerTick();
}

function renderLoopState(announce = true) {
  const state = loop.state;
  loopPedal.dataset.state = state;
  loopTools.hidden = loop.duration <= 0;
  loopPause.textContent = state === 'paused' ? '▶' : 'Ⅱ';
  loopPause.setAttribute('aria-pressed', String(state === 'paused'));
  loopPause.setAttribute('aria-label', state === 'paused' ? 'Продовжити loop' : 'Призупинити loop');
  loopToggle.disabled = state === 'paused';

  const layers = `${loop.layers} ${loopLayerWord(loop.layers)}`;
  const states = {
    empty: ['LOOP', 'ЗАПИСАТИ', 'Почати запис музичного циклу', 'Loop порожній'],
    recording: ['ЗАПИС', 'ГРАЙ ЗАРАЗ', 'Завершити запис і відтворити loop', 'Запис першого шару'],
    playing: ['+ ШАР', layers, 'Записати новий шар поверх loop', `Loop грає, ${layers}`],
    overdubbing: ['ДУБЛЬ', 'ГРАЙ ПОВЕРХ', 'Завершити запис нового шару', `Запис нового шару, ${layers}`],
    paused: ['LOOP', 'ПАУЗА', 'Loop призупинено', `Loop призупинено, ${layers}`],
  };
  const [label, meta, aria, status] = states[state];
  loopLabel.textContent = label;
  loopMeta.textContent = meta;
  loopToggle.setAttribute('aria-label', aria);
  if (announce) loopStatus.textContent = status;
}

function updateLoopProgress() {
  if (!audio.ctx || audio.ctx.currentTime - loop.lastUiAt < 0.08) return;
  loop.lastUiAt = audio.ctx.currentTime;
  let progress = 0;
  if (loop.state === 'recording') {
    const elapsed = Math.max(0, audio.ctx.currentTime - loop.recordStartedAt);
    progress = Math.min(1, elapsed / LOOP_MAX_SECONDS);
    loopMeta.textContent = `${elapsed.toFixed(1)} С · ГРАЙ`;
  } else if (loop.duration > 0) {
    const offset = loop.state === 'paused'
      ? loop.pausedOffset
      : positiveModulo(audio.ctx.currentTime - loop.epoch, loop.duration);
    progress = offset / loop.duration;
    if (loop.state === 'playing') loopMeta.textContent = `${loop.layers} ${loopLayerWord(loop.layers)} · ${loop.duration.toFixed(1)} С`;
    else if (loop.state === 'overdubbing') loopMeta.textContent = `ГРАЙ · ${loop.duration.toFixed(1)} С`;
  }
  loopProgressBar.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
}

function startBaseLoopRecording() {
  if (!loopUnlocked) return;
  activateAudioForSound();
  stopLoopScheduler();
  clearTimeout(loop.autoCloseTimer);
  loop.state = 'recording';
  loop.events = [];
  loop.duration = 0;
  loop.layers = 0;
  loop.activeLayer = 1;
  loop.layerStartCount = 0;
  loop.recordStartedAt = audio.ctx.currentTime;
  loopProgressBar.style.width = '0%';
  loop.autoCloseTimer = setTimeout(() => finishBaseLoopRecording(true), LOOP_MAX_SECONDS * 1000);
  captureHeldVocalIntoLoop();
  captureHeldPianoIntoLoop();
  renderLoopState();
  navigator.vibrate?.(30);
}

function finishBaseLoopRecording(automatic = false) {
  if (loop.state !== 'recording') return;
  clearTimeout(loop.autoCloseTimer);
  if (!loop.events.length && !heldLoopCapture && !heldPianoNotes.size) {
    loop.state = 'empty';
    loop.duration = 0;
    renderLoopState();
    ui.toast('Зіграй щось під час запису', 1800);
    return;
  }
  const rawDuration = Math.min(LOOP_MAX_SECONDS, Math.max(0, audio.ctx.currentTime - loop.recordStartedAt));
  loop.duration = Math.max(1, Math.ceil(rawDuration / 0.125) * 0.125);
  // Finalize sustain after loop length is known so held vocals cap correctly.
  finishHeldLoopCapture();
  finishHeldPianoLoopCaptures();
  if (!loop.events.length) {
    loop.state = 'empty';
    loop.duration = 0;
    renderLoopState();
    ui.toast('Зіграй щось під час запису', 1800);
    return;
  }
  loop.layers = 1;
  loop.state = 'playing';
  loop.epoch = audio.ctx.currentTime + 0.08;
  loop.events.sort((a, b) => a.offset - b.offset);
  renderLoopState();
  startLoopScheduler();
  ui.toast(automatic ? 'Loop замкнено автоматично' : 'Loop грає · додай ще один інструмент', 2100);
  navigator.vibrate?.([24, 35, 24]);
}

function startLoopOverdub() {
  if (loop.state !== 'playing') return;
  loop.state = 'overdubbing';
  loop.activeLayer = loop.layers + 1;
  loop.layerStartCount = loop.events.length;
  captureHeldVocalIntoLoop();
  captureHeldPianoIntoLoop();
  renderLoopState();
  ui.toast('Новий шар — грай поверх loop', 1700);
  navigator.vibrate?.(24);
}

function finishLoopOverdub() {
  if (loop.state !== 'overdubbing') return;
  finishHeldLoopCapture();
  finishHeldPianoLoopCaptures();
  const added = loop.events.length - loop.layerStartCount;
  if (added > 0) {
    loop.layers = loop.activeLayer;
    loop.events.sort((a, b) => a.offset - b.offset);
    ui.toast(`Шар ${loop.layers} додано`, 1600);
  } else {
    ui.toast('У цьому шарі немає нот', 1500);
  }
  loop.state = 'playing';
  renderLoopState();
}

function pauseLoop() {
  if (loop.state === 'overdubbing') finishLoopOverdub();
  if (loop.state !== 'playing') return;
  loop.pausedOffset = positiveModulo(audio.ctx.currentTime - loop.epoch, loop.duration);
  loop.state = 'paused';
  stopLoopScheduler();
  renderLoopState();
}

function resumeLoop() {
  if (loop.state !== 'paused') return;
  activateAudioForSound();
  loop.epoch = audio.ctx.currentTime - loop.pausedOffset;
  for (const event of loop.events) event.playFromCycle = 0;
  loop.state = 'playing';
  renderLoopState();
  startLoopScheduler();
}

function clearRecordedLoop() {
  clearTimeout(loop.autoCloseTimer);
  finishHeldLoopCapture();
  for (const held of heldPianoNotes) finalizeHeldPianoLoopCapture(held, { cancel: true });
  stopLoopScheduler();
  loop.state = 'empty';
  loop.events = [];
  loop.duration = 0;
  loop.layers = 0;
  loop.activeLayer = 0;
  loop.pausedOffset = 0;
  loopProgressBar.style.width = '0%';
  renderLoopState();
  ui.toast('Loop очищено', 1500);
}

function toggleLoopRecording() {
  if (!started || ui.modalOpen || mascotMove.fall) return;
  if (!loopUnlocked) {
    ui.toast('Заповни VIBE-метр, щоб відкрити loop-педаль', 1800);
    return;
  }
  if (loop.state === 'empty') startBaseLoopRecording();
  else if (loop.state === 'recording') finishBaseLoopRecording();
  else if (loop.state === 'playing') startLoopOverdub();
  else if (loop.state === 'overdubbing') finishLoopOverdub();
  else if (loop.state === 'paused') resumeLoop();
}

// pointerdown (not click): click is often dropped when another finger is already
// down on the canvas, because multitouch touchstart preventDefault kills synthesis.
function bindLoopPedalPress(el, fn) {
  el.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    fn(event);
  });
}
bindLoopPedalPress(loopToggle, toggleLoopRecording);
bindLoopPedalPress(loopPause, () => (loop.state === 'paused' ? resumeLoop() : pauseLoop()));
bindLoopPedalPress(loopClear, clearRecordedLoop);
renderLoopState(false);

// ---- microphone note pad ----
const vocalPad = document.getElementById('vocal-pad');
const vocalButtons = [...vocalPad.querySelectorAll('[data-vocal-freq]')];
let vocalPadTimer = null;
const chordPad = document.getElementById('chord-pad');
const chordButtons = [...(chordPad?.querySelectorAll('[data-chord]') || [])];
chordPad?.addEventListener('pointerdown', (event) => {
  // Swallow pad chrome only — chord buttons handle their own pointer claim.
  if (event.target.closest?.('[data-chord]')) return;
  event.stopPropagation();
  event.stopImmediatePropagation();
  if (event.pointerType === 'touch') event.preventDefault();
}, { capture: true });
let heldVocal = null;
let heldVocalButton = null;
let heldVocalPointer = null;
let heldVocalPulseTimer = null;
let heldLoopCapture = null;

function stampHeldLoopCaptureDuration() {
  if (!heldLoopCapture || heldLoopCapture.finished || !audio.ctx) return;
  const elapsed = Math.max(0.12, audio.ctx.currentTime - heldLoopCapture.startedAt);
  const maximum = loop.duration > 0 ? Math.max(0.12, loop.duration - 0.06) : LOOP_MAX_SECONDS;
  heldLoopCapture.event.duration = Math.min(maximum, elapsed);
}

function beginHeldLoopCapture(freq, vowel) {
  const startedAt = audio.ctx?.currentTime;
  const event = captureLoopEvent({ type: 'vocal', freq, vowel, vel: 1, duration: 0.12 }, startedAt);
  if (event) event.durationPending = true;
  return event ? { event, startedAt, finished: false } : null;
}

function captureHeldVocalIntoLoop() {
  if (heldLoopCapture) return;
  if (heldVocal && heldVocalButton && heldVocalPointer !== null) {
    heldLoopCapture = beginHeldLoopCapture(
      Number(heldVocalButton.dataset.vocalFreq),
      Number(heldVocalButton.dataset.vocalVowel),
    );
    stampHeldLoopCaptureDuration();
    return;
  }
  if (keyboardVocal) {
    heldLoopCapture = beginHeldLoopCapture(keyboardVocal.freq, keyboardVocal.vowel);
    stampHeldLoopCaptureDuration();
  }
}

function deferHeldLoopEventPlayback(event) {
  if (!event || !audio.ctx || loop.duration <= 0) return;
  // Base take closes while state is still "recording" and epoch is unset.
  // Defer to cycle 1 so live holds do not double with the first playback.
  // Overdub / playing use a real epoch to skip the current cycle only.
  if (loop.state === 'recording') {
    event.playFromCycle = Math.max(event.playFromCycle, 1);
    return;
  }
  const currentCycle = Math.max(0, Math.floor((audio.ctx.currentTime - loop.epoch) / loop.duration));
  event.playFromCycle = Math.max(event.playFromCycle, currentCycle + 1);
}

function finishHeldLoopCapture() {
  if (!heldLoopCapture || heldLoopCapture.finished) return;
  heldLoopCapture.finished = true;
  stampHeldLoopCaptureDuration();
  delete heldLoopCapture.event.durationPending;
  deferHeldLoopEventPlayback(heldLoopCapture.event);
  heldLoopCapture = null;
}

function syncPadsOpenClass() {
  const padsOpen = Boolean(
    (vocalPad && !vocalPad.hidden)
    || (chordPad && !chordPad.hidden),
  );
  document.documentElement.classList.toggle('pads-open', padsOpen);
}

function showVocalPad(autoHide = true) {
  vocalPad.hidden = false;
  syncPadsOpenClass();
  clearTimeout(vocalPadTimer);
  if (autoHide) vocalPadTimer = setTimeout(() => { vocalPad.hidden = true; syncPadsOpenClass(); }, 7600);
}

function hideVocalPad() {
  clearTimeout(vocalPadTimer);
  clearInterval(heldVocalPulseTimer);
  finishHeldLoopCapture();
  audio.stopVocal(heldVocal);
  heldVocalButton?.classList.remove('playing');
  heldVocal = null;
  heldVocalButton = null;
  heldVocalPointer = null;
  vocalPad.hidden = true;
  syncPadsOpenClass();
}

function syncChordPadHeld() {
  const activeChord = currentGuitarChordName();
  for (const button of chordButtons) {
    const isActive = button.dataset.chord === activeChord;
    button.classList.toggle('held', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  }
  document.documentElement.classList.toggle('guitar-fretting', Boolean(activeChord));
}

function showChordPad() {
  if (!chordPad) return;
  syncChordPadHeld();
  chordPad.hidden = false;
  syncPadsOpenClass();
}

function hideChordPad() {
  if (!chordPad) return;
  clearGuitarInteractionState();
  chordPad.hidden = true;
  syncPadsOpenClass();
}

function holdGuitarChord(name, pointerId) {
  if (!GUITAR_CHORDS[name]) return;
  heldGuitarChord = name;
  heldGuitarChordPointer = pointerId;
  syncChordPadHeld();
  navigator.vibrate?.(10);
}

function releaseHeldGuitarChord(event) {
  if (event && heldGuitarChordPointer !== null && event.pointerId !== heldGuitarChordPointer) return;
  heldGuitarChord = null;
  heldGuitarChordPointer = null;
  syncChordPadHeld();
}

function toggleLatchedGuitarChord(name) {
  if (!GUITAR_CHORDS[name]) return;
  latchedGuitarChord = latchedGuitarChord === name ? null : name;
  heldGuitarChord = null;
  heldGuitarChordPointer = null;
  syncChordPadHeld();
}

function clearGuitarInteractionState() {
  for (const [pointerId, info] of activePointers) {
    if (!info.mode?.startsWith('guitar-')) continue;
    activePointers.delete(pointerId);
    try {
      if (canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture(pointerId);
    } catch (_) { /* ignore */ }
  }
  for (const [pointerId, interaction] of activeTouchChordPointers) {
    try {
      if (interaction.button?.hasPointerCapture?.(pointerId)) {
        interaction.button.releasePointerCapture(pointerId);
      }
    } catch (_) { /* ignore */ }
  }
  activeTouchChordPointers.clear();
  heldGuitarChord = null;
  heldGuitarChordPointer = null;
  latchedGuitarChord = null;
  keyboardGuitarChord = null;
  guitarStrokeMotion = 0;
  syncChordPadHeld();
}

const recentTouchChordAt = new WeakMap();
const activeTouchChordPointers = new Map();

function markHeldTouchGuitarChordUsed() {
  if (heldGuitarChordPointer === null) return;
  const interaction = activeTouchChordPointers.get(heldGuitarChordPointer);
  if (interaction) interaction.usedForPlay = true;
}

function finishTouchGuitarChord(event, { cancelled = false } = {}) {
  const interaction = activeTouchChordPointers.get(event.pointerId);
  if (!interaction) {
    releaseHeldGuitarChord(event);
    return;
  }
  activeTouchChordPointers.delete(event.pointerId);
  releaseHeldGuitarChord(event);
  if (!isQuickGuitarTap({
    elapsedMs: performance.now() - interaction.startedAt,
    distancePx: interaction.distancePx,
    cancelled,
    usedForPlay: interaction.usedForPlay,
  })) return;
  toggleLatchedGuitarChord(interaction.name);
}

for (const button of chordButtons) {
  button.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (event.pointerType === 'touch') {
      event.preventDefault();
      recentTouchChordAt.set(button, performance.now());
      activeTouchChordPointers.set(event.pointerId, {
        name: button.dataset.chord,
        button,
        startedAt: performance.now(),
        startX: event.clientX,
        startY: event.clientY,
        distancePx: 0,
        usedForPlay: false,
      });
      holdGuitarChord(button.dataset.chord, event.pointerId);
      button.setPointerCapture?.(event.pointerId);
    }
  });
  button.addEventListener('pointermove', (event) => {
    const interaction = activeTouchChordPointers.get(event.pointerId);
    if (!interaction) return;
    interaction.distancePx = Math.max(
      interaction.distancePx,
      Math.hypot(event.clientX - interaction.startX, event.clientY - interaction.startY),
    );
  });
  button.addEventListener('click', (event) => {
    if (event.detail !== 0 && performance.now() - (recentTouchChordAt.get(button) || 0) < 700) return;
    toggleLatchedGuitarChord(button.dataset.chord);
  });
  button.addEventListener('pointerup', (event) => finishTouchGuitarChord(event));
  button.addEventListener('pointercancel', (event) => finishTouchGuitarChord(event, { cancelled: true }));
  button.addEventListener('lostpointercapture', (event) => finishTouchGuitarChord(event, { cancelled: true }));
}

// Hold chord + second-finger strum: stop Safari/Chrome page pinch-zoom (not orbit dolly).
// Do not preventDefault on pad↔canvas multitouch touchstart — that drops the strum finger.
function blockGuitarBrowserPageZoom(event) {
  if (!isGuitarPlayFocus()) return;
  if (eventInvolvesUiChrome(event)) return;
  if (event.touches && event.touches.length >= 2 && event.cancelable) event.preventDefault();
}
document.addEventListener('touchstart', blockGuitarBrowserPageZoom, { passive: false, capture: true });
document.addEventListener('touchmove', blockGuitarBrowserPageZoom, { passive: false, capture: true });
// iOS Safari still fires gesture* for page pinch even with user-scalable=no.
for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(name, (event) => {
    if (isGuitarPlayFocus()) event.preventDefault();
  }, { passive: false, capture: true });
}

// Prevent rapid cross-control taps from being promoted to page zoom by mobile
// browsers. Informational panels remain zoomable / scrollable.
document.addEventListener('dblclick', (event) => {
  if (isLiveStageZoomLocked() || event.target.closest?.('#vocal-pad, #chord-pad, #toast')) {
    event.preventDefault();
  }
}, { passive: false, capture: true });

function playVocalNote(freq, vowel, showPrice = false) {
  playMusicalEvent({ type: 'vocal', freq, vowel, duration: 0.68, vibe: 4, showPrice });
}

function releaseHeldVocal(event) {
  if (event && heldVocalPointer !== null && event.pointerId !== heldVocalPointer) return;
  clearInterval(heldVocalPulseTimer);
  finishHeldLoopCapture();
  audio.stopVocal(heldVocal);
  heldVocalButton?.classList.remove('playing');
  heldVocal = null;
  heldVocalButton = null;
  heldVocalPointer = null;
  showVocalPad();
}

for (const button of vocalButtons) {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    releaseHeldVocal();
    releaseKeyboardVocal();
    const freq = Number(button.dataset.vocalFreq);
    const vowel = Number(button.dataset.vocalVowel);
    activateAudioForSound();
    mic.sing();
    heldVocal = audio.startVocal(freq, vowel);
    heldLoopCapture = beginHeldLoopCapture(freq, vowel);
    heldVocalButton = button;
    heldVocalPointer = event.pointerId;
    button.setPointerCapture?.(event.pointerId);
    button.classList.add('playing');
    addVibe(3);
    showVocalPad(false);
    heldVocalPulseTimer = setInterval(() => {
      mic.sing();
      // Stamp sustain while held so a cancelled pointer still keeps the length.
      stampHeldLoopCaptureDuration();
    }, 120);
    navigator.vibrate?.(16);
  });
  button.addEventListener('pointerup', releaseHeldVocal);
  button.addEventListener('pointercancel', releaseHeldVocal);
  button.addEventListener('lostpointercapture', releaseHeldVocal);
  button.addEventListener('touchend', (event) => event.preventDefault(), { passive: false });
}

// ---- trigger instruments ----
function trigger(mesh) {
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

function beginHeldPianoNote(key) {
  if (!key?.userData || !Number.isFinite(key.userData.freq)) return null;
  activateAudioForSound();
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
  finishOnboard();
  runMusicalVisual(event, true);
  return held;
}

function finalizeHeldPianoLoopCapture(held, { cancel = false } = {}) {
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

function releaseHeldPianoNote(held, { cancel = false } = {}) {
  if (!held) return;
  finalizeHeldPianoLoopCapture(held, { cancel });
  held.voice?.release?.();
  piano.hold(held.key, false);
  heldPianoNotes.delete(held);
}

function releaseAllHeldPianoNotes({ cancel = false } = {}) {
  for (const held of [...heldPianoNotes]) releaseHeldPianoNote(held, { cancel });
  keyboardPianoNotes.clear();
}

function finishHeldPianoLoopCaptures() {
  for (const held of heldPianoNotes) finalizeHeldPianoLoopCapture(held);
}

function captureHeldPianoIntoLoop() {
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

function handleClick(e) {
  if (!started || ui.modalOpen || flyT >= 0) return;
  onPointerMove(e);
  const details = hitInteractableDetailsAt(e.clientX, e.clientY);
  if (details) {
    const hit = details.object;
    const kind = hit.userData.instrument;
    // Sound only while focused on that instrument — distant tap just walks over.
    if (canPlayInstrument(kind)) trigger(hit);
    else walkMascotToInstrument(kind);
    return;
  }
  const walkPoint = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(stageWalkPlane, walkPoint)) setMascotDestination(walkPoint);
}

function isEditableHotkeyTarget(target) {
  return Boolean(target?.closest?.('button, a, input, textarea, select, [contenteditable="true"], [role="button"]'));
}

// Keyboard movement is intentionally absent; click-to-move and the joystick
// are the only mascot movement inputs.
// Disjoint from E approach / L loop / guitar / vocal / piano.
const DRUM_KEYS = { KeyZ: 'kick', KeyX: 'snare', KeyC: 'hihat', KeyV: 'tom2', KeyB: 'crash' };
const VOCAL_KEYS = {
  KeyN: { freq: 261.63, vowel: 0 },
  KeyM: { freq: 293.66, vowel: 1 },
  Comma: { freq: 329.63, vowel: 2 },
  Period: { freq: 349.23, vowel: 0 },
  Slash: { freq: 392.00, vowel: 1 },
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    finishOnboard();
  }
  if (!started || ui.modalOpen) return;
  if (isEditableHotkeyTarget(e.target)) return;

  if (e.code === 'KeyE' && !e.repeat && instrumentView.phase === 'idle') {
    playNearestInstrument();
    return;
  }

  if (e.code === 'KeyL' && !e.repeat) {
    e.preventDefault();
    if (!loopUnlocked) {
      toggleLoopRecording();
      return;
    }
    if (e.shiftKey && loop.state !== 'empty') clearRecordedLoop();
    else toggleLoopRecording();
    return;
  }

  if (!canKeyboardJamPlay()) return;

  const guitarChord = GUITAR_KEY_CHORDS[e.code];
  if (guitarChord) {
    e.preventDefault();
    if (!e.repeat) {
      keyboardGuitarChord = guitarChord;
      syncChordPadHeld();
      noteKeyboardJamActivity('guitar');
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
    if (e.repeat || keyboardVocal?.code === e.code) return;
    beginKeyboardVocal(e.code);
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
  if (guitarChord && keyboardGuitarChord === guitarChord) {
    keyboardGuitarChord = null;
    syncChordPadHeld();
    noteKeyboardJamActivity('guitar');
  }
  if (keyboardVocal?.code === e.code) {
    releaseKeyboardVocal();
  }
});

// ---- sound mixer (HUD) — per-instrument levels ----
const soundMixer = document.getElementById('sound-mixer');
const soundRecoverBtn = document.getElementById('sound-recover-btn');
const soundFaders = [...(soundMixer?.querySelectorAll('input[data-bus]') || [])];

function silenceHeldVocal() {
  clearInterval(heldVocalPulseTimer);
  heldVocalPulseTimer = null;
  finishHeldLoopCapture();
  audio.stopVocal(heldVocal);
  heldVocalButton?.classList.remove('playing');
  heldVocal = null;
  heldVocalButton = null;
  heldVocalPointer = null;
  releaseKeyboardVocal();
}

function releaseKeyboardVocal() {
  if (!keyboardVocal && !keyboardVocalPulseTimer) return;
  clearInterval(keyboardVocalPulseTimer);
  keyboardVocalPulseTimer = null;
  if (keyboardVocal) {
    finishHeldLoopCapture();
    audio.stopVocal(keyboardVocal.voice);
    noteKeyboardJamActivity('mic');
  }
  keyboardVocal = null;
}

function beginKeyboardVocal(code) {
  const note = VOCAL_KEYS[code];
  if (!note || !canKeyboardJamPlay()) return false;
  clearInterval(heldVocalPulseTimer);
  heldVocalPulseTimer = null;
  if (heldVocal) {
    finishHeldLoopCapture();
    audio.stopVocal(heldVocal);
    heldVocalButton?.classList.remove('playing');
    heldVocal = null;
    heldVocalButton = null;
    heldVocalPointer = null;
  }
  releaseKeyboardVocal();
  activateAudioForSound();
  mic.sing();
  const voice = audio.startVocal(note.freq, note.vowel);
  heldLoopCapture = beginHeldLoopCapture(note.freq, note.vowel);
  keyboardVocal = { code, freq: note.freq, vowel: note.vowel, voice };
  addVibe(3);
  queuePriceChip('mic');
  noteKeyboardJamActivity('mic');
  finishOnboard();
  keyboardVocalPulseTimer = setInterval(() => {
    mic.sing();
    stampHeldLoopCaptureDuration();
  }, 120);
  return true;
}

function closeSoundMixer() {
  if (!soundMixer || soundMixer.hidden) return;
  soundMixer.hidden = true;
  ui.el.soundBtn?.setAttribute('aria-expanded', 'false');
}

function openSoundMixer() {
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
  const snapshot = captureAudioRecoverySnapshot();
  audio.markForRecovery('manual-sound-test');

  try {
    const pending = audio.unlock();
    if (audio.contextGeneration !== generation) {
      restoreAfterAudioContextRebuild(snapshot);
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

// ---- dance (HUD logo click) — toggle mascot tektonik routine ----
danceBtn?.addEventListener('click', (event) => {
  event.stopPropagation();
  setDancing(!dance.active);
});

// debug hook (headless testing)
window.__mascotDebug = () => ({
  y: mascot.group.position.y,
  armLz: mascot.armL.rotation.z,
  armRz: mascot.armR.rotation.z,
  dancing: dance.active,
});
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

// ---- mascot customization (ОБРАЗ modal) ----
const mascotModal = document.getElementById('modal-mascot');
const mascotPanel = mascotModal?.querySelector('.mascot-panel');
const mascotPreviewZone = document.getElementById('mascot-preview-zone');
const mascotHeightInput = document.getElementById('mascot-height');
const mascotWidthInput = document.getElementById('mascot-width');
const mascotCommitButton = document.getElementById('mascot-commit');
const mascotUndoButton = document.getElementById('mascot-undo');

const MASCOT_UI_NAMES = {
  hair: { long: 'ДОВГЕ', bob: 'БОБ', short: 'КОРОТКЕ', bald: 'ЛИСИЙ' },
  smile: { soft: 'ЛЕГКА', wide: 'ШИРОКА', neutral: 'РІВНА' },
  hairColor: {
    '5a2f22': 'КАШТАНОВЕ', '241a14': 'ЧОРНЕ', c9a35f: 'БЛОНД',
    a14d2d: 'РУДЕ', b04a68: 'РОЖЕВЕ',
  },
  eyeColor: { dark: 'ТЕМНІ', green: 'ЗЕЛЕНІ', blue: 'БЛАКИТНІ' },
  outfit: { stage: 'СЦЕНА', vibe: 'ФІРМОВИЙ', denim: 'ДЖИНС', night: 'НІЧ' },
  skinTone: {
    'tone-3': 'ТЕПЛИЙ', 'tone-5': 'СВІТЛИЙ', 'tone-4': 'ЗОЛОТИЙ', 'tone-7': 'ЧОРНИЙ',
  },
  accessory: {
    none: 'НЕМАЄ', hoops: 'СЕРЕЖКИ', glasses: 'ОКУЛЯРИ', headphones: 'НАВУШНИКИ',
  },
  outfitColor: {
    default: 'З ПАЛІТРИ', purple: 'ФІОЛЕТОВИЙ', gold: 'ЗОЛОТИЙ',
    cream: 'КРЕМОВИЙ', denim: 'ДЖИНСОВИЙ',
  },
  shoeColor: {
    default: 'З ПАЛІТРИ', ink: 'ЧОРНІ', cream: 'БІЛІ', red: 'ЧЕРВОНІ',
  },
};

function cloneMascotState(source = mascotCfg) {
  return mascotAppearanceSnapshot(source);
}

function restoreMascotState(snapshot) {
  if (!snapshot) return;
  Object.assign(mascotCfg, mascotAppearanceSnapshot(snapshot));
}

const mascotEditor = {
  active: false,
  committing: false,
  category: 'face',
  openingConfig: null,
  undoConfig: null,
  openingYaw: 0,
  baseYaw: 0,
  previewAngle: 0,
  dragPointer: null,
  dragStartX: 0,
  dragStartAngle: 0,
  refitFrame: 0,
  viewDirection: new THREE.Vector3(0, 0, 1),
};

function syncMascotModal() {
  if (!mascotModal) return;
  const syncGroup = (selector, attr, value) => {
    mascotModal.querySelectorAll(selector).forEach((btn) => {
      const on = btn.dataset[attr]?.toLowerCase() === String(value).toLowerCase();
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
    });
  };
  syncGroup('[data-mascot-hair]', 'mascotHair', mascotCfg.hair);
  syncGroup('[data-mascot-color]', 'mascotColor', mascotCfg.hairColor);
  syncGroup('[data-mascot-smile]', 'mascotSmile', mascotCfg.smile);
  syncGroup('[data-mascot-eyes]', 'mascotEyes', mascotCfg.eyeColor);
  syncGroup('[data-mascot-outfit]', 'mascotOutfit', mascotCfg.outfit);
  syncGroup('[data-mascot-skin]', 'mascotSkin', mascotCfg.skinTone);
  syncGroup('[data-mascot-accessory]', 'mascotAccessory', mascotCfg.accessory);
  syncGroup('[data-mascot-primary]', 'mascotPrimary', mascotCfg.outfitPrimary);
  syncGroup('[data-mascot-accent]', 'mascotAccent', mascotCfg.outfitAccent);
  syncGroup('[data-mascot-shoes]', 'mascotShoes', mascotCfg.shoeColor);
  if (mascotHeightInput) mascotHeightInput.value = String(mascotCfg.height);
  if (mascotWidthInput) mascotWidthInput.value = String(mascotCfg.width);
  const setName = (id, group, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = MASCOT_UI_NAMES[group][value] || String(value).toUpperCase();
  };
  setName('mascot-hair-name', 'hair', mascotCfg.hair);
  setName('mascot-smile-name', 'smile', mascotCfg.smile);
  setName('mascot-color-name', 'hairColor', mascotCfg.hairColor.toLowerCase());
  setName('mascot-eyes-name', 'eyeColor', mascotCfg.eyeColor);
  setName('mascot-outfit-name', 'outfit', mascotCfg.outfit);
  setName('mascot-skin-name', 'skinTone', mascotCfg.skinTone);
  setName('mascot-accessory-name', 'accessory', mascotCfg.accessory);
  setName('mascot-primary-name', 'outfitColor', mascotCfg.outfitPrimary);
  setName('mascot-accent-name', 'outfitColor', mascotCfg.outfitAccent);
  setName('mascot-shoes-name', 'shoeColor', mascotCfg.shoeColor);
  if (mascotUndoButton) mascotUndoButton.hidden = !mascotEditor.undoConfig;
}

function queueMascotRefit() {
  if (!mascotEditor.active || mascotEditor.refitFrame) return;
  mascotEditor.refitFrame = requestAnimationFrame(() => {
    mascotEditor.refitFrame = 0;
    frameMascotForCustomize();
  });
}

function setMascotConfig(patch, { undoable = false } = {}) {
  if (undoable) mascotEditor.undoConfig = cloneMascotState();
  const next = validateMascotAppearance({ ...mascotCfg, ...patch });
  Object.assign(mascotCfg, next);
  applyMascotConfig();
  syncMascotModal();
  if (!mascotEditor.active) saveMascotConfig();
  else queueMascotRefit();
}

function setMascotCategory(category, { focus = false } = {}) {
  if (!['face', 'outfit', 'shape'].includes(category)) return;
  mascotEditor.category = category;
  mascotModal?.querySelectorAll('[data-mascot-tab]').forEach((tab) => {
    const selected = tab.dataset.mascotTab === category;
    tab.setAttribute('aria-selected', selected ? 'true' : 'false');
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  });
  mascotModal?.querySelectorAll('[data-mascot-section]').forEach((section) => {
    const selected = section.dataset.mascotSection === category;
    section.hidden = !selected;
    section.classList.toggle('is-active', selected);
  });
  mascotPanel?.querySelector('.mascot-editor-scroll')?.scrollTo({ top: 0, behavior: 'instant' });
  queueMascotRefit();
}

function pickMascotValue(values) {
  return values[(Math.random() * values.length) | 0];
}

function randomizeMascot() {
  const hairColors = [...MASCOT_HAIR_COLOR_VALUES];
  const heights = [82, 90, 100, 110, 122, 132];
  const widths = [78, 88, 100, 112, 125, 138];
  setMascotConfig({
    hair: pickMascotValue(Object.keys(MASCOT_HAIR_STYLES)),
    hairColor: pickMascotValue(hairColors),
    smile: pickMascotValue([...MASCOT_SMILES]),
    eyeColor: pickMascotValue(Object.keys(MASCOT_EYE_COLORS)),
    outfit: pickMascotValue(Object.keys(MASCOT_OUTFITS)),
    outfitPrimary: pickMascotValue([...MASCOT_PRIMARY_COLORS]),
    outfitAccent: pickMascotValue([...MASCOT_ACCENT_COLORS]),
    shoeColor: pickMascotValue(Object.keys(MASCOT_SHOE_COLORS)),
    skinTone: pickMascotValue(Object.keys(MASCOT_SKIN_TONES)),
    accessory: pickMascotValue([...MASCOT_ACCESSORIES]),
    height: pickMascotValue(heights),
    width: pickMascotValue(widths),
  }, { undoable: true });
}

function bindMascotRadioGroup(group) {
  group.addEventListener('keydown', (event) => {
    const buttons = [...group.querySelectorAll('[role="radio"]')];
    const current = event.target.closest('[role="radio"]');
    const index = buttons.indexOf(current);
    if (index < 0) return;
    let nextIndex = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % buttons.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = buttons.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    buttons[nextIndex].focus();
    buttons[nextIndex].click();
  });
}

if (mascotModal) {
  mascotModal.querySelectorAll('[data-mascot-hair]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ hair: btn.dataset.mascotHair })));
  mascotModal.querySelectorAll('[data-mascot-color]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ hairColor: btn.dataset.mascotColor })));
  mascotModal.querySelectorAll('[data-mascot-smile]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ smile: btn.dataset.mascotSmile })));
  mascotModal.querySelectorAll('[data-mascot-eyes]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ eyeColor: btn.dataset.mascotEyes })));
  mascotModal.querySelectorAll('[data-mascot-shoes]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ shoeColor: btn.dataset.mascotShoes })));
  mascotModal.querySelectorAll('[data-mascot-outfit]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ outfit: btn.dataset.mascotOutfit })));
  mascotModal.querySelectorAll('[data-mascot-skin]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ skinTone: btn.dataset.mascotSkin })));
  mascotModal.querySelectorAll('[data-mascot-accessory]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ accessory: btn.dataset.mascotAccessory })));
  mascotModal.querySelectorAll('[data-mascot-primary]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ outfitPrimary: btn.dataset.mascotPrimary })));
  mascotModal.querySelectorAll('[data-mascot-accent]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ outfitAccent: btn.dataset.mascotAccent })));
  mascotHeightInput?.addEventListener('input', () => setMascotConfig({ height: Number(mascotHeightInput.value) }));
  mascotWidthInput?.addEventListener('input', () => setMascotConfig({ width: Number(mascotWidthInput.value) }));
  document.getElementById('mascot-reset')?.addEventListener('click', () => {
    mascotEditor.undoConfig = cloneMascotState();
    setMascotConfig({ ...MASCOT_DEFAULTS });
  });
  mascotUndoButton?.addEventListener('click', () => {
    const snapshot = mascotEditor.undoConfig;
    mascotEditor.undoConfig = null;
    restoreMascotState(snapshot);
    applyMascotConfig();
    syncMascotModal();
    queueMascotRefit();
  });
  document.getElementById('mascot-random')?.addEventListener('click', randomizeMascot);
  mascotModal.querySelectorAll('[data-mascot-tab]').forEach((tab) => {
    tab.addEventListener('click', () => setMascotCategory(tab.dataset.mascotTab));
    tab.addEventListener('keydown', (event) => {
      const tabs = [...mascotModal.querySelectorAll('[data-mascot-tab]')];
      const index = tabs.indexOf(tab);
      let nextIndex = null;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabs.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      setMascotCategory(tabs[nextIndex].dataset.mascotTab, { focus: true });
    });
  });
  mascotModal.querySelectorAll('[role="radiogroup"]').forEach(bindMascotRadioGroup);
  mascotCommitButton?.addEventListener('click', () => {
    mascotEditor.committing = true;
    saveMascotConfig();
    ui.closeAll();
    ui.toast('Неперевершено!', 1800);
  });
  syncMascotModal();
}

// Camera frames the mascot while the ОБРАЗ modal is open (live preview).
const mascotCam = {
  active: false, returning: false, framed: false, t: 0,
  fromPos: new THREE.Vector3(), fromTgt: new THREE.Vector3(),
  toPos: new THREE.Vector3(), toTgt: new THREE.Vector3(),
  savedPos: new THREE.Vector3(), savedTgt: new THREE.Vector3(),
};

function startMascotCam(toPos, toTgt, returning) {
  mascotCam.fromPos.copy(camera.position);
  mascotCam.fromTgt.copy(controls.target);
  mascotCam.toPos.copy(toPos);
  mascotCam.toTgt.copy(toTgt);
  mascotCam.t = 0;
  mascotCam.returning = returning;
  mascotCam.active = true;
}

function mascotObjectBounds(root) {
  const bounds = new THREE.Box3();
  const meshBounds = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    let current = object;
    while (current && current !== root.parent) {
      if (!current.visible) return;
      current = current.parent;
    }
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    if (!object.geometry.boundingBox) return;
    meshBounds.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
    bounds.union(meshBounds);
  });
  return bounds;
}

function mascotPreviewSafeRect() {
  const vv = window.visualViewport;
  const viewport = {
    left: vv?.offsetLeft || 0,
    top: vv?.offsetTop || 0,
    right: (vv?.offsetLeft || 0) + (vv?.width || window.innerWidth),
    bottom: (vv?.offsetTop || 0) + (vv?.height || window.innerHeight),
  };
  const hud = document.getElementById('hud');
  const hudRect = hud && !hud.classList.contains('hidden') ? hud.getBoundingClientRect() : null;
  const top = Math.max(viewport.top + 12, hudRect ? hudRect.bottom + 8 : viewport.top + 12);
  const panelRect = mascotPanel?.getBoundingClientRect();
  if (!panelRect) return { left: viewport.left + 12, top, right: viewport.right - 12, bottom: viewport.bottom - 12 };
  const gap = 14;
  const candidates = [
    { left: viewport.left + 12, top, right: panelRect.left - gap, bottom: viewport.bottom - 12 },
    { left: panelRect.right + gap, top, right: viewport.right - 12, bottom: viewport.bottom - 12 },
    { left: viewport.left + 12, top, right: viewport.right - 12, bottom: panelRect.top - gap },
    { left: viewport.left + 12, top: panelRect.bottom + gap, right: viewport.right - 12, bottom: viewport.bottom - 12 },
  ].filter((rect) => rect.right - rect.left >= 120 && rect.bottom - rect.top >= 120);
  if (!candidates.length) return { left: viewport.left + 12, top, right: viewport.right - 12, bottom: viewport.bottom - 12 };
  return candidates.sort((a, b) =>
    ((b.right - b.left) * (b.bottom - b.top)) - ((a.right - a.left) * (a.bottom - a.top)))[0];
}

function positionMascotPreviewZone(rect) {
  if (!mascotPreviewZone) return;
  mascotPreviewZone.style.left = `${rect.left}px`;
  mascotPreviewZone.style.top = `${rect.top}px`;
  mascotPreviewZone.style.width = `${rect.right - rect.left}px`;
  mascotPreviewZone.style.height = `${rect.bottom - rect.top}px`;
}

function frameMascotForCustomize() {
  if (!mascotEditor.active) return;
  const safeRect = mascotPreviewSafeRect();
  positionMascotPreviewZone(safeRect);
  const root = mascotEditor.category === 'face' ? mascot.head : mascot.group;
  const bounds = mascotObjectBounds(root);
  if (bounds.isEmpty()) return;
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const safeCenterX = (safeRect.left + safeRect.right) / 2;
  const safeCenterY = (safeRect.top + safeRect.bottom) / 2;
  const margin = 18;
  const availableHalfX = Math.max(40, (safeRect.right - safeRect.left) / 2 - margin);
  const availableHalfY = Math.max(40, (safeRect.bottom - safeRect.top) / 2 - margin);
  const tanHalfV = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const tanHalfH = tanHalfV * camera.aspect;
  const ndcHalfX = Math.max(0.08, availableHalfX / (viewportWidth / 2));
  const ndcHalfY = Math.max(0.08, availableHalfY / (viewportHeight / 2));
  const distanceX = (size.x * 0.5) / (tanHalfH * ndcHalfX);
  const distanceY = (size.y * 0.5) / (tanHalfV * ndcHalfY);
  const distance = Math.max(1.35, distanceX, distanceY) * 1.12 + size.z * 0.55;
  const eyeDirection = mascotEditor.viewDirection.clone();
  eyeDirection.y = mascotEditor.category === 'face' ? 0.06 : 0.12;
  eyeDirection.normalize();
  const position = center.clone().addScaledVector(eyeDirection, distance);
  const target = center.clone();
  const right = new THREE.Vector3().crossVectors(camera.up, eyeDirection).normalize();
  const viewUp = new THREE.Vector3().crossVectors(eyeDirection, right).normalize();
  const desiredNdcX = (safeCenterX / viewportWidth) * 2 - 1;
  const desiredNdcY = 1 - (safeCenterY / viewportHeight) * 2;
  const halfHeight = distance * tanHalfV;
  const halfWidth = halfHeight * camera.aspect;
  const targetShift = right.multiplyScalar(-desiredNdcX * halfWidth)
    .add(viewUp.multiplyScalar(-desiredNdcY * halfHeight));
  // Aim below / beside the mascot to place it inside the safe screen rectangle
  // without translating the camera below the stage top at tall scale values.
  target.add(targetShift);
  startMascotCam(position, target, false);
}

function beginMascotEditor() {
  if (instrumentView.phase !== 'idle') leaveInstrumentView({ immediate: true, offerPriceChip: false });
  if (mascotMove.fall) respawnMascot();
  setDancing(false);
  resetMascotPose();
  for (const instrument of instruments) instrument.group.visible = false;
  if (mascotLabel) mascotLabel.visible = false;
  controls.autoRotate = false;
  clearTimeout(idleTimer);
  mascotCam.savedPos.copy(camera.position);
  mascotCam.savedTgt.copy(controls.target);
  mascotEditor.active = true;
  document.documentElement.classList.add('mascot-editor-open');
  mascotEditor.committing = false;
  mascotEditor.openingConfig = cloneMascotState();
  mascotEditor.undoConfig = null;
  mascotEditor.openingYaw = mascot.group.rotation.y;
  mascotEditor.previewAngle = 0;
  mascotEditor.viewDirection.copy(camera.position).sub(controls.target);
  mascotEditor.viewDirection.y = 0;
  if (mascotEditor.viewDirection.lengthSq() < 0.01) mascotEditor.viewDirection.set(0, 0, 1);
  mascotEditor.viewDirection.normalize();
  mascotEditor.baseYaw = Math.atan2(mascotEditor.viewDirection.x, mascotEditor.viewDirection.z);
  mascot.group.rotation.y = mascotEditor.baseYaw;
  mascotCam.framed = true;
  controls.enabled = false;
  setMascotCategory('face');
  syncMascotModal();
  requestAnimationFrame(frameMascotForCustomize);
}

function finishMascotEditor(committed) {
  if (!mascotEditor.active) return;
  if (!committed) {
    restoreMascotState(mascotEditor.openingConfig);
    applyMascotConfig();
  }
  if (mascotEditor.refitFrame) cancelAnimationFrame(mascotEditor.refitFrame);
  mascotEditor.refitFrame = 0;
  mascotEditor.active = false;
  document.documentElement.classList.remove('mascot-editor-open');
  mascotEditor.dragPointer = null;
  resetMascotPose();
  mascot.group.rotation.y = mascotEditor.openingYaw;
  for (const instrument of instruments) instrument.group.visible = true;
  syncInstrumentExposure();
  if (mascotLabel) mascotLabel.visible = true;
  mascotCam.framed = false;
  startMascotCam(mascotCam.savedPos, mascotCam.savedTgt, true);
  mascotEditor.openingConfig = null;
  mascotEditor.undoConfig = null;
  mascotEditor.committing = false;
  syncMascotModal();
}

mascotPreviewZone?.addEventListener('pointerdown', (event) => {
  if (!mascotEditor.active) return;
  event.preventDefault();
  mascotEditor.dragPointer = event.pointerId;
  mascotEditor.dragStartX = event.clientX;
  mascotEditor.dragStartAngle = mascotEditor.previewAngle;
  mascotPreviewZone.setPointerCapture?.(event.pointerId);
});
mascotPreviewZone?.addEventListener('pointermove', (event) => {
  if (event.pointerId !== mascotEditor.dragPointer) return;
  const delta = event.clientX - mascotEditor.dragStartX;
  mascotEditor.previewAngle = mascotEditor.dragStartAngle + delta * 0.012;
  mascot.group.rotation.y = mascotEditor.baseYaw + mascotEditor.previewAngle;
});
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  mascotPreviewZone?.addEventListener(eventName, (event) => {
    if (event.pointerId === mascotEditor.dragPointer) mascotEditor.dragPointer = null;
  });
}
mascotPanel?.addEventListener('animationend', () => {
  if (mascotEditor.active) queueMascotRefit();
});

window.addEventListener('av2:modal', (event) => {
  if (event.detail?.name !== 'mascot' || !started) return;
  if (event.detail.open) {
    beginMascotEditor();
  } else if (mascotEditor.active) {
    finishMascotEditor(mascotEditor.committing);
  }
});

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

// ============================================================
// POST-PROCESSING
// ============================================================
let composer = null;
let bloomPass = null;
let postprocessingInit = null;

async function initPostprocessing() {
  if (isLowEndMobileGameMode() || composer) return;
  if (postprocessingInit) return postprocessingInit;
  postprocessingInit = (async () => {
  let modules = null;
  try {
    modules = await loadPostprocessingModules();
  } catch (_) {
    return;
  }
  try {
    const [
      { EffectComposer },
      { RenderPass },
      { UnrealBloomPass },
      { OutputPass },
      { ShaderPass },
    ] = modules;
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // Bloom sells the authored emissives (footlights, star drop, lenses) only.
    // Threshold keeps lit cream/white surfaces out of the glow.
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      isMobileGameMode() ? 0.2 : 0.32,
      0.35,
      0.88,
    );
    // Bloom only processes fullscreen color. Depth/stencil attachments on its
    // eleven internal targets consume memory without affecting the result.
    const bloomTargets = [
      bloomPass.renderTargetBright,
      ...bloomPass.renderTargetsHorizontal,
      ...bloomPass.renderTargetsVertical,
    ];
    for (const target of bloomTargets) {
      target.depthBuffer = false;
      target.stencilBuffer = false;
    }
    composer.addPass(bloomPass);
    // Subtle theatre vignette (desktop only — mobile composers stay bloom-only
    // because every full-screen pass scales with DPR²).
    if (!isMobileGameMode()) {
      const vignettePass = new ShaderPass({
        uniforms: {
          tDiffuse: { value: null },
          uStrength: { value: 0.5 },
          uSize: { value: 0.78 },
        },
        vertexShader: /* glsl */`
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */`
          uniform sampler2D tDiffuse;
          uniform float uStrength, uSize;
          varying vec2 vUv;
          void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            float d = distance(vUv, vec2(0.5));
            c.rgb *= mix(1.0, smoothstep(uSize, uSize - 0.45, d), uStrength);
            gl_FragColor = c;
          }`,
      });
      composer.addPass(vignettePass);
    }
    composer.addPass(new OutputPass());
    document.documentElement.dataset.postprocessing = 'on';
  } catch (_) {
    composer?.dispose();
    composer = null;
    bloomPass = null;
  }
  })();
  try {
    await postprocessingInit;
  } finally {
    postprocessingInit = null;
  }
}

function disablePostprocessing() {
  composer?.dispose();
  composer = null;
  bloomPass = null;
  document.documentElement.dataset.postprocessing = 'off';
}

function syncQualityDomState() {
  document.documentElement.dataset.qualityTier = qualityTierLabel();
  document.documentElement.dataset.frameRateCap = isMobileQualityProbe()
    ? 'probe'
    : (isLowEndMobileGameMode() ? '30' : 'native');
  document.documentElement.classList.toggle('low-mobile', isLowEndMobileGameMode());
  document.documentElement.dataset.shadows = renderer.shadowMap.enabled ? 'on' : 'off';
}

function beginMobileProbeWindow(phase, frameTime) {
  mobileQualityProbe.phase = phase;
  mobileQualityProbe.startedAt = frameTime;
  mobileQualityProbe.lastFrameAt = frameTime;
  mobileQualityProbe.samples.length = 0;
}

function settleMobileQuality(low, p90) {
  mobileQualityProbe.active = false;
  mobileQualityProbe.phase = low ? 'low' : 'full';
  mobileQualityProbe.p90 = p90;
  lowMobileQuality = low;
  if (low) disablePostprocessing();
  applyLowMobileSceneBudget();
  syncRendererToWindow();
  syncQualityDomState();
}

function promoteMobileQuality(frameTime) {
  lowMobileQuality = false;
  applyLowMobileSceneBudget();
  syncRendererToWindow();
  syncQualityDomState();
  mobileQualityProbe.phase = 'promoting';
  void initPostprocessing().finally(() => {
    if (!mobileQualityProbe.active || mobileQualityProbe.phase !== 'promoting') return;
    beginMobileProbeWindow('full', performance.now());
  });
}

function updateMobileQualityProbe(frameTime) {
  if (!isMobileQualityProbe() || mobileQualityProbe.phase === 'promoting') return;
  if (!mobileQualityProbe.startedAt) {
    beginMobileProbeWindow(mobileQualityProbe.phase, frameTime);
    return;
  }
  const elapsed = frameTime - mobileQualityProbe.startedAt;
  const delta = frameTime - mobileQualityProbe.lastFrameAt;
  mobileQualityProbe.lastFrameAt = frameTime;
  // Ignore shader/texture warm-up, then take one second of actual frame pacing.
  if (elapsed > 350 && delta > 0 && delta < 100) mobileQualityProbe.samples.push(delta);
  if (elapsed < 1350 || !mobileQualityProbe.samples.length) return;
  const sorted = [...mobileQualityProbe.samples].sort((a, b) => a - b);
  const p90 = sorted[Math.floor((sorted.length - 1) * 0.9)];
  if (mobileQualityProbe.phase === 'medium') {
    if (p90 <= 19) promoteMobileQuality(frameTime);
    else settleMobileQuality(true, p90);
    return;
  }
  // Full effects need to remain close to display cadence. Otherwise the app
  // immediately returns to the stable 30 FPS low budget.
  settleMobileQuality(p90 > 22, p90);
}
window.__qualityDebug = () => {
  const lightCounts = { point: 0, spot: 0, shadowCasting: 0 };
  scene.traverse((object) => {
    if (object.isPointLight) lightCounts.point++;
    if (object.isSpotLight) lightCounts.spot++;
    if (object.isLight && object.castShadow) lightCounts.shadowCasting++;
  });
  return {
    mobile: isMobileGameMode(),
    appleMobile: isAppleMobile,
    autoProbe: autoQualityProbe,
    tier: qualityTierLabel(),
    deviceMemory,
    hardwareConcurrency,
    pixelRatio: renderer.getPixelRatio(),
    postprocessing: Boolean(composer),
    bloom: Boolean(bloomPass),
    shadows: renderer.shadowMap.enabled,
    frameRateCap: isMobileQualityProbe() ? 'probe' : (isLowEndMobileGameMode() ? 30 : null),
    mobileProbe: { phase: mobileQualityProbe.phase, p90: mobileQualityProbe.p90 },
    lightLevel: stageLightLevel,
    lightCounts,
    slidesLoaded: Math.max(0, ss.texs.length - 1),
  };
};

// ============================================================
// INTRO / START FLOW
// ============================================================
let flyT = -1; // -1 = not flying
const FLY_DUR = 2.6;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const enterBtn = document.getElementById('enter-btn');
const enterLabel = document.getElementById('enter-label');
const intro = document.getElementById('intro');
const onboardEl = document.getElementById('onboard');
const onboardText = document.getElementById('onboard-text');
const onboardOk = document.getElementById('onboard-ok');
const ONBOARD_KEY = 'av2.onboard.v2';
const INTRO_SESSION_KEY = 'av2.intro.v2';
const MASCOT_ONBOARD_KEY = 'av2.mascot.after-onboard.v2';
const onboard = { active: false, pulsing: false };

function markIntroSeen() {
  try { sessionStorage.setItem(INTRO_SESSION_KEY, '1'); } catch { /* storage is optional */ }
}

function shouldSkipIntro() {
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
    if (!o.isMesh || !o.material?.emissive || o.userData._baseEmissive === undefined) return;
    o.material.emissive.setHex(o.userData._baseEmissive);
    o.material.emissiveIntensity = o.userData._baseEI;
  });
}

function finishOnboard() {
  if (!onboard.active) return;
  onboard.active = false;
  try { localStorage.setItem(ONBOARD_KEY, '1'); } catch { /* ignore */ }
  if (onboardEl) onboardEl.hidden = true;
  clearOnboardPulse();
}

function startOnboard() {
  if (!shouldOfferOnboard() || !onboardEl) return;
  onboard.active = true;
  onboardText.textContent = 'Вітаємо на сцені Art Vibe! Сьогодні вона повністю твоя. По ній можна ходити, а на інструментах — грати.';
  onboardEl.hidden = false;
}

function openMascotAfterFirstOnboard() {
  let shouldOpen = false;
  try {
    shouldOpen = !localStorage.getItem(MASCOT_ONBOARD_KEY);
    if (shouldOpen) localStorage.setItem(MASCOT_ONBOARD_KEY, '1');
  } catch {
    shouldOpen = true;
  }
  if (shouldOpen) requestAnimationFrame(() => ui.open('mascot'));
}

function updateOnboardPulse(t) {
  if (!onboard.active || prefersReducedMotion.matches) return;
  if (hovered && hovered.userData.instrument !== 'mic') return;
  const intensity = 0.12 + 0.22 * (0.5 + 0.5 * Math.sin(t * 2.6));
  mic.group.traverse((o) => {
    if (!o.isMesh || !o.material?.emissive) return;
    if (o.userData._baseEmissive === undefined) {
      o.userData._baseEmissive = o.material.emissive.getHex();
      o.userData._baseEI = o.material.emissiveIntensity ?? 1;
    }
    o.material.emissive.setHex(0x9E33CA);
    o.material.emissiveIntensity = intensity;
  });
  onboard.pulsing = true;
}

onboardOk?.addEventListener('click', () => {
  const completedFirstOnboard = onboard.active;
  finishOnboard();
  if (completedFirstOnboard) openMascotAfterFirstOnboard();
});
onboardEl?.addEventListener('click', (e) => {
  if (e.target !== onboardEl && e.target !== onboardText) return;
  finishOnboard();
});

function startExperience() {
  if (started) return;
  started = true;
  markIntroSeen();
  document.documentElement.classList.add('stage-live');
  syncViewportMeta();
  intro.classList.add('gone');
  mobileControls.classList.add('active');
  zoomControls.hidden = false;
  flyT = 0;
  resetBrowserPageZoom();
  syncRendererToWindow();
}

function startWithoutIntro() {
  if (started) return;
  started = true;
  markIntroSeen();
  document.documentElement.classList.add('stage-live');
  syncViewportMeta();
  intro.classList.add('gone');
  mobileControls.classList.add('active');
  zoomControls.hidden = false;
  camera.position.copy(CAM_END);
  camera.lookAt(TARGET);
  controls.enabled = true;
  ui.showHUD();
  startOnboard();
  resetBrowserPageZoom();
  syncRendererToWindow();
}

enterBtn.addEventListener('click', startExperience);
window.addEventListener('av2:modal', () => syncViewportMeta());

// Keep WebAudio alive across backgrounding / flaky in-app browsers (Telegram).
// Stuck "suspended" contexts are the usual cause of silent sessions until refresh.
function captureAudioRecoverySnapshot() {
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
    heldCaptureElapsed: heldLoopCapture
      ? Math.max(0, previousTime - heldLoopCapture.startedAt)
      : null,
  };
}

function restoreAfterAudioContextRebuild(snapshot) {
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
  if (heldLoopCapture && snapshot.heldCaptureElapsed !== null) {
    heldLoopCapture.startedAt = now - snapshot.heldCaptureElapsed;
  }
  if (heldVocalButton && heldVocalPointer !== null) {
    heldVocal = audio.startVocal(
      Number(heldVocalButton.dataset.vocalFreq),
      Number(heldVocalButton.dataset.vocalVowel),
    );
  } else if (keyboardVocal) {
    keyboardVocal.voice = audio.startVocal(keyboardVocal.freq, keyboardVocal.vowel);
  }
  resyncLoopPlayback();
}

function activateAudioForSound({ allowRecovery = true } = {}) {
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
  if (document.visibilityState === 'visible'
    && (loop.state === 'playing' || loop.state === 'overdubbing')) {
    resyncLoopPlayback();
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

// idle auto-rotate
let idleTimer = null;
controls.addEventListener('start', () => {
  controls.autoRotate = false;
  clearTimeout(idleTimer);
  if (instrumentView.phase === 'idle' || instrumentView.phase === 'approaching') {
    mobileFollow.scouting = true;
    document.documentElement.dataset.cameraMode = 'scout';
  }
});
controls.addEventListener('end', () => {
  clearTimeout(idleTimer);
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

// ============================================================
// RESIZE
// ============================================================
window.addEventListener('resize', syncRendererToWindow);

// ============================================================
// MAIN LOOP
// ============================================================
const clock = new THREE.Clock();
let firstFrame = true;
let lastRenderedFrameAt = -Infinity;

function renderIntervalMs() {
  if (isMobileQualityProbe()) return 0;
  if (!started) return 1000 / 10;
  if (ui.modalOpen) return 1000 / 15;
  if (isLowEndMobileGameMode()) return 1000 / 30;
  return 0;
}

function animate(frameTime = performance.now()) {
  requestAnimationFrame(animate);
  if (document.hidden) return;
  const interval = renderIntervalMs();
  if (interval && frameTime - lastRenderedFrameAt < interval - 0.5) return;
  lastRenderedFrameAt = frameTime;
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // renderer.info accumulates across every composer pass in this frame;
  // autoReset would keep only the final output quad's numbers.
  renderer.info.reset();

  // camera fly-in
  if (flyT >= 0) {
    flyT += dt;
    const k = Math.min(1, flyT / FLY_DUR);
    const e = easeInOut(k);
    camera.position.lerpVectors(CAM_START, CAM_END, e);
    camera.lookAt(TARGET);
    if (k >= 1) {
      flyT = -1;
      controls.enabled = true;
      ui.showHUD();
      startOnboard();
    }
  } else if (mascotCam.active) {
    // ОБРАЗ modal camera framing (tween toward / away from the mascot).
    mascotCam.t += dt;
    const k = Math.min(1, mascotCam.t / (prefersReducedMotion.matches ? 0.01 : 0.6));
    const e = easeInOut(k);
    camera.position.lerpVectors(mascotCam.fromPos, mascotCam.toPos, e);
    controls.target.lerpVectors(mascotCam.fromTgt, mascotCam.toTgt, e);
    camera.lookAt(controls.target);
    if (k >= 1) {
      mascotCam.active = false;
      if (mascotCam.returning) controls.enabled = true;
    }
  } else if (!updateInstrumentViewCamera(dt) && controls.enabled) {
    controls.update();
  }

  // instruments
  for (const inst of instruments) inst.update(dt, t, prefersReducedMotion.matches);
  updateMascot(dt);
  updateMobilePlayAvailability();
  updateOnboardPulse(t);

  // stage atmosphere (materials/motion only — lights unchanged)
  if (!prefersReducedMotion.matches) {
    for (const curtain of stageAmbience.curtains) {
      curtain.rotation.y = curtain.userData.baseRotY + Math.sin(t * 0.55 + curtain.userData.side) * 0.035;
    }
    if (stageAmbience.valance) {
      stageAmbience.valance.position.y = stageAmbience.valance.userData.baseY + Math.sin(t * 0.7) * 0.025;
    }
    if (stageAmbience.starMat) {
      stageAmbience.starMat.opacity = 0.78 + Math.sin(t * 0.9) * 0.14;
    }
    for (let i = 0; i < spotHeads.length; i++) {
      const sh = spotHeads[i];
      const lens = sh.lensMat;
      const pulse = 0.72 + Math.sin(t * 1.4 + i * 1.1) * 0.28;
      const lightScale = Math.max(0.18, stageLightLevel / 100);
      lens.color.setHex(sh.base);
      lens.color.multiplyScalar((0.75 + pulse * 0.35) * lightScale);
      // Concert moving-head sweep: light, target, and clipped beam ride the mount.
      if (sh.sweep) sh.mount.rotation.z = Math.sin(t * 0.42 + i * 2.1) * sh.sweep * 2.8;
    }
  }

  // Dust motion is evaluated in the vertex shader; only one scalar changes.
  dust.userData.time.value = t;

  // play-feedback: floating notes + footlight bump (kept under reduced motion —
  // it is action feedback, not ambient shimmer)
  noteBursts.update(dt, prefersReducedMotion.matches);
  if (hitPulse.value > 0.001) {
    hitPulse.value *= Math.pow(0.008, dt);
    const fp = stageAmbience.footPulse;
    if (fp) {
      const dimScale = stageLightLevel / 100;
      const boost = 1 + hitPulse.value * 0.85;
      fp.mat.emissiveIntensity = fp.matBase * dimScale * boost;
      for (const bulbLight of fp.lights) {
        if (bulbLight.visible) bulbLight.intensity = fp.lightBase * dimScale * boost;
      }
    }
  }

  // vibe decay
  if (vibe > 0 && performance.now() - lastVibeAdd > 1500) {
    vibe = Math.max(0, vibe - 6 * dt);
    ui.setVibe(vibe);
  }

  // hover raycast
  if (started && !ui.modalOpen && canHover.matches) {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(interactables, false);
    const hit = hits.length ? hits[0].object : null;
    if (hit !== hovered) {
      if (hovered) setGlow(hovered, false);
      hovered = hit;
      if (hovered) setGlow(hovered, true);
    }
    canvas.style.cursor = hovered ? 'pointer' : '';
  } else {
    if (hovered) { setGlow(hovered, false); hovered = null; }
    if (!canHover.matches) canvas.style.cursor = '';
  }

  fireworks.update(dt);
  updateSlideshow(dt);
  updateSlideshowNavLayout();
  updateLoopProgress();

  if (composer) composer.render();
  else renderer.render(scene, camera);

  updateMobileQualityProbe(frameTime);

  if (firstFrame) {
    firstFrame = false;
    window.__sceneReady = true;
    document.documentElement.dataset.sceneReady = 'true';
  }
}

// ============================================================
// HEADLESS QA HOOKS (?testhooks=1)
// Deterministic state driving + renderer diagnostics for the
// packaged canvas inspector. Never active for real visitors.
// ============================================================
if (params.has('testhooks')) {
  renderer.info.autoReset = false;
  window.__THREE_GAME_DIAGNOSTICS__ = {
    get renderer() {
      return {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        programs: renderer.info.programs?.length ?? 0,
        pixelRatio: renderer.getPixelRatio(),
        shadows: renderer.shadowMap.enabled,
        postprocessing: !!composer,
      };
    },
  };
  window.__THREE_GAME_TEST_HOOKS__ = {
    seed() { /* stage has no gameplay RNG to pin */ },
    setState(name) {
      if (name === 'stage') { leaveInstrumentView({ immediate: true, offerPriceChip: false }); return; }
      if (name === 'dance') { setDancing(true); return; }
      if (name === 'vibe') { addVibe(100); return; }
      if (INSTRUMENT_VIEW_PRESETS[name]) requestInstrumentView(name);
    },
    // Debug-only scene handle for headless isolation (hide/show suspects).
    scene,
    // Debug picking: what is under this client-pixel? Lists every hit front to
    // back so soft/transparent artifacts can be identified, not just the top hit.
    pick(clientX, clientY) {
      const ndc = new THREE.Vector2(
        (clientX / window.innerWidth) * 2 - 1,
        -(clientY / window.innerHeight) * 2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      return ray.intersectObjects(scene.children, true).slice(0, 12).map((hit) => ({
        distance: Number(hit.distance.toFixed(2)),
        type: hit.object.type,
        geometry: hit.object.geometry?.type,
        material: Array.isArray(hit.object.material) ? 'multi' : hit.object.material?.type,
        name: hit.object.name || null,
        parentName: hit.object.parent?.name || null,
        worldPos: hit.point ? { x: +hit.point.x.toFixed(2), y: +hit.point.y.toFixed(2), z: +hit.point.z.toFixed(2) } : null,
      }));
    },
  };
}

// ============================================================
// INIT (wait for fonts so canvas textures look right)
// ============================================================
Promise.all([
  Promise.race([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise((r) => setTimeout(r, 3500)),
  ]),
  initPostprocessing(),
]).then(() => {
  drums.refreshLogo?.();
  if (PHOTO_SLIDES_ENABLED) {
    loadSlideTextures().then((loaded) => {
      if (!loaded) window.__dbg = 'no photos loaded';
    }).catch((e) => { window.__dbg = `load err: ${e}`; });
  } else {
    window.__dbg = 'photo slideshow disabled: Art Vibe title slide only';
  }
  addLabels();
  renderer.compile(scene, camera);
  animate();

  if (shouldSkipIntro()) {
    startWithoutIntro();
  } else {
    startExperience();
  }

  const shot = params.get('shot');
  if (shot) {
    setTimeout(() => {
      if (shot === 'chip') {
        chipFor('guitar', { force: true });
        clearTimeout(ui._chipTimer);
      }
      else if (shot === 'vibe-toast') ui.toast('<span class="hl">МАКСИМАЛЬНИЙ ВАЙБ!</span><br>ЛУП-ПЕДАЛЬ РОЗБЛОКОВАНО', 60000, 'vibe-max');
      else if (shot === 'toast') ui.toast('У студії доступні <span class="hl">вокал, гітара, барабани та фортепіано</span>', 60000);
      else ui.open(shot, params.get('anchor') || undefined);
    }, 400);
  }
});
