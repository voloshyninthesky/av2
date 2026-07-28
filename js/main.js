// ============================================================
// ART VIBE STUDIO — interactive 3D stage
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AudioEngine } from './audio.js?v=20260727-16';
import { buildDrumKit, buildPiano, buildGuitar, buildMic } from './instruments.js?v=20260728-11';
import { UI } from './ui.js?v=20260728-20';

// ---- error collector (debug / headless testing) ----
const errlog = document.getElementById('errlog');
window.addEventListener('error', (e) => { errlog.textContent += `ERR: ${e.message} @ ${e.filename}:${e.lineno}\n`; });
window.addEventListener('unhandledrejection', (e) => { errlog.textContent += `REJ: ${e.reason}\n`; });

const params = new URLSearchParams(location.search);
const QUALITY_PREFERENCE_KEY = 'av2.quality.v1';
const QUALITY_OPTIONS = new Set(['auto', 'high', 'low']);
let savedQuality = null;
try { savedQuality = localStorage.getItem(QUALITY_PREFERENCE_KEY); } catch (_) { /* storage is optional */ }
const queryQuality = params.get('quality');
const forcedQuality = QUALITY_OPTIONS.has(queryQuality)
  ? queryQuality
  : (QUALITY_OPTIONS.has(savedQuality) ? savedQuality : 'auto');
const ui = new UI();
const audio = new AudioEngine();
window.__audioDebug = () => audio.debugState();
const qualityNames = { auto: 'AUTO', high: 'GLAMOUR', low: 'PIXEL' };
const qualityCurrent = document.getElementById('quality-current');
const qualitySwitch = document.querySelector('.quality-switch');
const qualitySwitchValue = document.getElementById('quality-switch-value');
const qualityButtons = [...document.querySelectorAll('[data-quality]')];

function syncQualityPreferenceUi() {
  for (const button of qualityButtons) {
    const selected = button.dataset.quality === forcedQuality;
    button.classList.toggle('is-on', selected);
    button.setAttribute('aria-checked', selected ? 'true' : 'false');
  }
  if (qualityCurrent) qualityCurrent.textContent = qualityNames[forcedQuality] || qualityNames.auto;
  if (qualitySwitch) {
    const qualityName = qualityNames[forcedQuality] || qualityNames.auto;
    qualitySwitch.dataset.qualityTier = forcedQuality;
    qualitySwitch.setAttribute('aria-label', `Стиль сцени: ${qualityName}. Змінити`);
    qualitySwitch.title = `Стиль сцени: ${qualityName}`;
    if (qualitySwitchValue) qualitySwitchValue.textContent = qualityName;
  }
}

function setQualityPreference(nextQuality) {
  if (!QUALITY_OPTIONS.has(nextQuality) || nextQuality === forcedQuality) return;
  try { localStorage.setItem(QUALITY_PREFERENCE_KEY, nextQuality); } catch (_) { /* storage is optional */ }
  const nextUrl = new URL(location.href);
  nextUrl.searchParams.set('quality', nextQuality);
  location.assign(nextUrl.href);
}

for (const button of qualityButtons) {
  button.addEventListener('click', () => setQualityPreference(button.dataset.quality));
}
window.addEventListener('av2:modal', (event) => {
  if (event.detail?.open && event.detail.name === 'quality') syncQualityPreferenceUi();
});
syncQualityPreferenceUi();
const coarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)');
const isAndroid = /Android/i.test(navigator.userAgent || '');
// iPadOS may present itself as macOS, so use touch capability as a fallback.
const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent || '')
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const deviceMemory = Number(navigator.deviceMemory) || null;
const hardwareConcurrency = Number(navigator.hardwareConcurrency) || null;
const isMobileGameMode = () => window.innerWidth <= 720 || coarsePointer.matches;
const hasForcedQuality = forcedQuality === 'low' || forcedQuality === 'high';
const autoMobileQuality = (isAndroid || isAppleMobile)
  && !hasForcedQuality
  && navigator.connection?.saveData !== true;
// Mobile browser CPU/RAM hints are intentionally coarse or absent, so never use
// them as a proxy for GPU power. Phones begin without expensive effects, then
// earn full quality by sustaining a representative two-stage render probe.
let lowMobileQuality = forcedQuality === 'low'
  || (!hasForcedQuality && (navigator.connection?.saveData === true || autoMobileQuality));
const mobileQualityProbe = {
  active: autoMobileQuality,
  phase: autoMobileQuality ? 'medium' : 'complete',
  startedAt: 0,
  lastFrameAt: 0,
  samples: [],
  p90: null,
};
const canUpgradeMobileQuality = autoMobileQuality;
const isLowEndMobileGameMode = () => lowMobileQuality;
const isMobileQualityProbe = () => mobileQualityProbe.active;
const usesLowMobileSceneBudget = () => isLowEndMobileGameMode() && !isMobileQualityProbe();
const MOBILE_MAX_PIXEL_RATIO = 1.5;
const LOW_END_MOBILE_MAX_PIXEL_RATIO = 1;
const DESKTOP_MAX_PIXEL_RATIO = 2;
const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const stageAmbience = { curtains: [], valance: null };
const creditLinks = [];
const adaptiveQualityScene = { bulbLights: [], lowPrioritySpots: [], shadowSpots: [], dust: null };
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
  const maximum = isMobileGameMode()
    ? (usesLowMobileSceneBudget() ? LOW_END_MOBILE_MAX_PIXEL_RATIO : MOBILE_MAX_PIXEL_RATIO)
    : DESKTOP_MAX_PIXEL_RATIO;
  return Math.min(window.devicePixelRatio || 1, maximum);
}

renderer.setPixelRatio(renderPixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !isLowEndMobileGameMode();
document.documentElement.dataset.shadows = renderer.shadowMap.enabled ? 'on' : 'off';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const BG = 0x0a0612;
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.FogExp2(BG, 0.036);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 120);
const CAM_START = new THREE.Vector3(0, 9.5, 18.5);
const CAM_END = new THREE.Vector3(0, 3.05, 10.45);
const TARGET = new THREE.Vector3(0, 1.45, -0.3);
const ZOOM_IN_STEP = 0.82;
// Match three "+" presses for a closer stage start.
const START_ZOOM_FACTOR = ZOOM_IN_STEP ** 3;
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
    renderer.toneMappingExposure = 0.98;
  } else {
    CAM_START.set(0, 9.5, 18.5);
    CAM_END.set(0, 3.05, 10.45);
    camera.fov = 55;
    controls.maxDistance = 16;
    renderer.toneMappingExposure = 1.12;
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

// Classic orbit on all devices; keep it soft so kids don't overshoot.
function applyMobileOrbitPolicy() {
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  if (isMobileGameMode()) {
    controls.rotateSpeed = 0.3;
    controls.zoomSpeed = 0.42;
    controls.dampingFactor = 0.16;
    controls.minPolarAngle = 0.55;
    controls.maxPolarAngle = 1.52;
  } else {
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
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#6e4a2d';
  x.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 8; row++) {
    const y0 = row * 64;
    const shade = 0.82 + Math.random() * 0.28;
    x.fillStyle = `rgb(${110 * shade | 0},${74 * shade | 0},${42 * shade | 0})`;
    x.fillRect(0, y0, 512, 64);
    x.strokeStyle = 'rgba(32,16,8,.72)';
    x.lineWidth = 3;
    x.strokeRect(-2, y0, 516, 64);
    x.strokeStyle = 'rgba(55,30,12,.3)';
    x.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      x.beginPath();
      const gy = y0 + 6 + Math.random() * 50;
      x.moveTo(0, gy);
      x.bezierCurveTo(140, gy + Math.random() * 10 - 5, 360, gy + Math.random() * 10 - 5, 512, gy);
      x.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 2);
  t.anisotropy = 4;
  return t;
}

function curtainTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const x = c.getContext('2d');
  for (let i = 0; i < 16; i++) {
    const x0 = i * 16;
    const g = x.createLinearGradient(x0, 0, x0 + 16, 0);
    g.addColorStop(0, '#1c0a28');
    g.addColorStop(0.45, '#4b1c66');
    g.addColorStop(0.6, '#5c2478');
    g.addColorStop(1, '#1c0a28');
    x.fillStyle = g;
    x.fillRect(x0, 0, 16, 512);
  }
  // gold top band
  x.fillStyle = '#D1A13B';
  x.fillRect(0, 0, 256, 14);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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

// soft neon credit on the slideshow's back face
function signatureTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 1024, 256);
  x.textAlign = 'center';
  x.textBaseline = 'middle';

  const left = 'created by ';
  const name = 'vadymbek';
  const font = '500 40px "Unbounded", sans-serif';
  x.font = font;
  const leftW = x.measureText(left).width;
  const nameW = x.measureText(name).width;
  const totalW = leftW + nameW;
  const startX = 512 - totalW / 2;
  const leftCenter = startX + leftW / 2;
  const nameCenter = startX + leftW + nameW / 2;
  const nameUvMin = (startX + leftW) / 1024;

  const drawLine = (text, cx, fill, blur) => {
    x.shadowColor = 'rgba(158, 51, 202, 0.85)';
    x.shadowBlur = blur;
    x.fillStyle = fill;
    x.fillText(text, cx, 128);
  };

  // Soft violet bloom, kept quiet so it doesn't compete with the stage.
  x.font = '500 42px "Unbounded", sans-serif';
  drawLine(left + name, 512, 'rgba(158, 51, 202, 0.22)', 36);
  x.font = font;
  drawLine(left, leftCenter, 'rgba(201, 136, 240, 0.45)', 14);
  drawLine(name, nameCenter, 'rgba(232, 210, 255, 0.9)', 16);
  x.shadowBlur = 0;

  // Subtle neon underline under the linked name.
  const underlineY = 148;
  x.strokeStyle = 'rgba(209, 161, 59, 0.55)';
  x.lineWidth = 2;
  x.shadowColor = 'rgba(158, 51, 202, 0.7)';
  x.shadowBlur = 10;
  x.beginPath();
  x.moveTo(startX + leftW, underlineY);
  x.lineTo(startX + leftW + nameW, underlineY);
  x.stroke();
  x.shadowBlur = 0;

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData = { nameUvMin };
  return t;
}

function buildStage() {
  const g = new THREE.Group();

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
  const topMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.65, metalness: 0.08 });
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
    emissiveIntensity: 1.6,
    roughness: 0.5,
  });
  const bulbGeom = new THREE.SphereGeometry(0.05, 10, 8);
  const bulbs = new THREE.InstancedMesh(bulbGeom, bulbMat, 9);
  const bulbMatrix = new THREE.Matrix4();
  for (let i = 0; i < 9; i++) {
    const x = -6 + i * 1.5;
    bulbs.setMatrixAt(i, bulbMatrix.makeTranslation(x, 0.06, 3.9));
    // Bulbs retain their emissive look. The five tiny point lights, however,
    // are evaluated by every PBR fragment and are not perceptible on a phone.
    if (i % 2 === 0 && (!lowEndLighting || canUpgradeMobileQuality)) {
      const pl = new THREE.PointLight(0xffc878, 16, 4.2, 2);
      pl.position.set(x, 0.22, 3.65);
      g.add(pl);
      adaptiveQualityScene.bulbLights.push(pl);
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

  // curtains
  const curt = curtainTexture();
  const curtMat = new THREE.MeshStandardMaterial({ map: curt, roughness: 0.88 });
  const sideCurtainGeometry = new THREE.PlaneGeometry(3.4, 9.4);
  stageAmbience.curtains.length = 0;
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(sideCurtainGeometry, curtMat);
    c.position.set(s * 7.9, 4.1, -3.9);
    c.rotation.y = -s * 0.3;
    c.userData.baseRotY = c.rotation.y;
    c.userData.side = s;
    g.add(c);
    stageAmbience.curtains.push(c);
  }
  const valance = new THREE.Mesh(new THREE.PlaneGeometry(19.5, 1.7), curtMat.clone());
  valance.position.set(0, 8.15, -4.1);
  valance.userData.baseY = valance.position.y;
  g.add(valance);
  stageAmbience.valance = valance;
  const valanceTrim = new THREE.Mesh(
    new THREE.BoxGeometry(19.5, 0.09, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xD1A13B, metalness: 0.8, roughness: 0.35 })
  );
  valanceTrim.position.set(0, 7.32, -4.06);
  g.add(valanceTrim);

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
  for (const s of [-1, 1]) {
    const spk = new THREE.Group();
    const box = new THREE.Mesh(speakerBoxGeometry, spkMat);
    box.position.y = 1.0;
    box.castShadow = true;
    spk.add(box);
    for (const [ry, rr] of [[1.45, 0.34], [0.75, 0.24]]) {
      const woofer = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr * 0.7, 0.08, 24), coneMat);
      woofer.rotation.x = Math.PI / 2;
      woofer.position.set(0, ry, 0.5);
      spk.add(woofer);
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
  }

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

  // Quiet neon credit on the reverse side of the screen.
  const sigMap = signatureTexture();
  const signature = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.65),
    new THREE.MeshBasicMaterial({
      map: sigMap,
      transparent: true,
      depthWrite: false,
      fog: false,
      side: THREE.FrontSide,
    })
  );
  signature.position.set(0, 5.35, -5.52);
  signature.rotation.y = Math.PI;
  signature.name = 'credit-signature';
  // Invisible hit target over the linked name only (local +X = "vadymbek").
  const nameHit = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.45),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  nameHit.position.set(0.52, 0, 0.01);
  // Raycaster still tests invisible meshes, while the renderer skips this collider.
  nameHit.visible = false;
  nameHit.userData.link = 'https://vadymbek.top';
  nameHit.name = 'credit-link';
  signature.add(nameHit);
  creditLinks.push(nameHit);
  g.add(signature);

  return g;
}

// ---- slideshow state ----
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
    opacity: 0.05,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });
  if (!clipToStage) return material;

  // The volumetric shell is decorative, so keep it within the actual platform
  // footprint. A short fade avoids a hard shader cut at the wooden stage edge.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.stageBeamBounds = { value: STAGE_BEAM_BOUNDS };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vBeamWorldPosition;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvBeamWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec4 stageBeamBounds;\nvarying vec3 vBeamWorldPosition;',
      )
      .replace(
        '#include <opaque_fragment>',
        `
          float beamFade = 0.24;
          float beamStageMask =
            smoothstep(stageBeamBounds.x, stageBeamBounds.x + beamFade, vBeamWorldPosition.x) *
            (1.0 - smoothstep(stageBeamBounds.y - beamFade, stageBeamBounds.y, vBeamWorldPosition.x)) *
            smoothstep(stageBeamBounds.z, stageBeamBounds.z + beamFade, vBeamWorldPosition.z) *
            (1.0 - smoothstep(stageBeamBounds.w - beamFade, stageBeamBounds.w, vBeamWorldPosition.z));
          diffuseColor.a *= beamStageMask;
          if (diffuseColor.a < 0.001) discard;
          #include <opaque_fragment>
        `,
      );
  };
  material.customProgramCacheKey = () => 'stage-clipped-visible-beam-v1';
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
  g.add(new THREE.HemisphereLight(0x6a4a88, 0x1a0e22, 0.55));
  g.add(new THREE.AmbientLight(0x584a74, 0.22));

  // truss bar
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x1a1420, metalness: 0.7, roughness: 0.4 });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 13, 10), trussMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 6.7, 1.6);
  g.add(bar);

  const spots = [
    { x: -4.6, color: 0x9E33CA, intensity: 950, target: new THREE.Vector3(-2.8, 1.0, -1.7), coneR: 1.7, coneFloorY: 0.025 },
    { x: -1.55, color: 0xD1A13B, intensity: 800, target: new THREE.Vector3(-1.35, 0.8, 1.75), coneR: 1.3, coneFloorY: 0.025, lowPriority: true },
    { x: 1.55, color: 0xfff0d8, intensity: 700, target: new THREE.Vector3(1.0, 1.2, 2.4), coneR: 1.4, coneFloorY: 0.025, shadow: true },
    { x: 4.6, color: 0x9E33CA, intensity: 950, target: new THREE.Vector3(3.5, 1.0, -1.3), coneR: 1.7, coneFloorY: 0.025 },
    { x: 0, color: 0x7a1fa2, intensity: 420, target: new THREE.Vector3(0, 5.35, -5.45), coneR: 2.6, y: 7.6, z: -2.5, lowPriority: true },
  ];

  // broad warm front fill (no visible cone) so instruments read well
  const fill = new THREE.SpotLight(0xffe8c8, 130, 45, 0.62, 0.9, 1.8);
  fill.position.set(0, 7.5, 14);
  fill.target.position.set(0, 0.8, 0);
  g.add(fill, fill.target);

  const spotlightHousingGeometry = new THREE.CylinderGeometry(0.09, 0.13, 0.3, 12);
  const spotlightLensGeometry = new THREE.CircleGeometry(0.1, 16);
  for (const s of spots) {
    const head = new THREE.Group();
    const y = s.y ?? 6.62, z = s.z ?? 1.6;
    const housing = new THREE.Mesh(spotlightHousingGeometry, trussMat);
    head.add(housing);
    const lens = new THREE.Mesh(
      spotlightLensGeometry,
      new THREE.MeshBasicMaterial({ color: s.color, fog: false })
    );
    lens.position.y = -0.16;
    lens.rotation.x = Math.PI / 2;
    head.add(lens);
    head.position.set(s.x, y, z);
    head.lookAt(s.target);
    head.rotateX(Math.PI / 2);
    g.add(head);
    spotHeads.push({ head, lensMat: lens.material, base: s.color });

    // Keep every visible fixture and beam but omit the two least noticeable
    // real light sources on the low tier. This reduces per-fragment PBR work
    // without making the truss look incomplete.
    if (!isLowEndMobileGameMode() || !s.lowPriority || canUpgradeMobileQuality) {
      const spot = new THREE.SpotLight(s.color, s.intensity, 30, 0.5, 0.65, 1.6);
      spot.position.set(s.x, y, z);
      spot.target.position.copy(s.target);
      if (s.shadow) {
        spot.castShadow = !isLowEndMobileGameMode();
        const shadowSize = isMobileGameMode() ? 512 : 2048;
        spot.shadow.mapSize.set(shadowSize, shadowSize);
        spot.shadow.bias = -0.0002;
        spot.shadow.normalBias = 0.035;
        spot.shadow.focus = 1;
        spot.shadow.camera.near = 1.5;
        spot.shadow.camera.far = 16;
        spot.shadow.camera.updateProjectionMatrix();
        adaptiveQualityScene.shadowSpots.push(spot);
      }
      if (s.lowPriority) adaptiveQualityScene.lowPrioritySpots.push(spot);
      g.add(spot, spot.target);
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
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, coneEndRadius, len, usesLowMobileSceneBudget() ? 12 : 24, 1, true),
      visibleBeamMaterial(s.color, Number.isFinite(s.coneFloorY)),
    );
    cone.position.copy(from).add(coneEnd).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(coneEnd, from).normalize();
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    g.add(cone);
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
    color: 0xe8c169, size: 0.035, transparent: true, opacity: 0.55,
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
    top: new THREE.MeshStandardMaterial({ color: 0xFDFBF7, roughness: 0.75 }),
    panel: new THREE.MeshStandardMaterial({ color: 0x233f9d, roughness: 0.72 }),
    stripes: new THREE.MeshStandardMaterial({ color: 0x008542, roughness: 0.76 }),
    sleeveL: new THREE.MeshStandardMaterial({ color: 0x008542, roughness: 0.76 }),
    sleeveR: new THREE.MeshStandardMaterial({ color: 0x7fa1bd, roughness: 0.82 }),
    shoulder: new THREE.MeshStandardMaterial({ color: 0xb93a3a, roughness: 0.76 }),
    collar: new THREE.MeshStandardMaterial({ color: 0xFFD100, roughness: 0.7 }),
    pants: new THREE.MeshStandardMaterial({ color: 0x5B82A6, roughness: 0.82 }),
    shoes: new THREE.MeshStandardMaterial({ color: 0x17121c, roughness: 0.7 }),
  };
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x5a2f22, roughness: 0.88 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xf2c4a6, roughness: 0.82 });
  const ink = new THREE.MeshStandardMaterial({ color: 0x17121c, roughness: 0.7 });
  const rose = new THREE.MeshStandardMaterial({ color: 0xb86d72, roughness: 0.8 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xd7d9dd, roughness: 0.22, metalness: 0.88 });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.58, 14), mats.top);
  torso.position.y = 1.08;
  group.add(torso);
  const rightJerseyPanel = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.49, 0.035), mats.panel);
  rightJerseyPanel.position.set(0.135, 1.08, 0.285);
  group.add(rightJerseyPanel);
  for (const y of [0.98, 1.08, 1.18]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.038, 0.04), mats.stripes);
    stripe.position.set(-0.13, y, 0.29);
    group.add(stripe);
  }
  const shoulderAccent = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.04), mats.shoulder);
  shoulderAccent.position.set(-0.23, 1.28, 0.27);
  group.add(shoulderAccent);
  for (const side of [-1, 1]) {
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.04), mats.collar);
    collar.position.set(side * 0.07, 1.31, 0.3);
    collar.rotation.z = side * 0.58;
    group.add(collar);
  }
  const waistband = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.028, 7, 22), mats.pants);
  waistband.rotation.x = Math.PI / 2;
  waistband.position.y = 0.78;
  group.add(waistband);

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
  const locks = [];
  for (const x of [-0.255, 0.255]) {
    const lock = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), hairMat);
    lock.scale.set(0.72, 3.3, 0.7);
    lock.position.set(x, -0.28, 0.08);
    head.add(lock);
    locks.push(lock);
  }
  for (const x of [-0.09, 0.09]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), ink);
    eye.scale.set(1.4, 0.72, 0.7);
    eye.position.set(x, 0.025, 0.286);
    head.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.012), hairMat);
    brow.position.set(x, 0.085, 0.284);
    brow.rotation.z = -Math.sign(x) * 0.1;
    head.add(brow);
  }
  const lips = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.016, 0.014), rose);
  lips.position.set(0, -0.085, 0.29);
  head.add(lips);
  for (const x of [-0.285, 0.285]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 6, 14), silver);
    hoop.position.set(x, -0.02, 0.035);
    hoop.rotation.y = Math.PI / 2;
    head.add(hoop);
  }
  group.add(head);

  const makeLimb = (x, y, material, radius, length, { hand = false } = {}) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.92, length, 9), material);
    limb.position.y = -length / 2;
    pivot.add(limb);
    if (hand) {
      const palm = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.05, 10, 8), skin);
      palm.scale.set(1.05, 0.85, 1.15);
      palm.position.y = -length - radius * 0.35;
      pivot.add(palm);
    }
    group.add(pivot);
    return pivot;
  };

  const armL = makeLimb(-0.34, 1.28, mats.sleeveL, 0.085, 0.5, { hand: true });
  const armR = makeLimb(0.34, 1.28, mats.sleeveR, 0.09, 0.5, { hand: true });
  armL.rotation.z = -0.12;
  armR.rotation.z = 0.12;
  const legL = makeLimb(-0.15, 0.76, mats.pants, 0.145, 0.64);
  const legR = makeLimb(0.15, 0.76, mats.pants, 0.145, 0.64);

  for (const leg of [legL, legR]) {
    const sneaker = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.16, 0.38), mats.shoes);
    sneaker.position.set(0, -0.64, 0.08);
    sneaker.castShadow = true;
    leg.add(sneaker);
    for (const x of [-0.07, 0, 0.07]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.06, 0.012), mats.top);
      stripe.position.set(x, -0.64, 0.276);
      leg.add(stripe);
    }
  }

  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.055, 14), ink);
  badge.position.set(-0.14, 1.22, 0.312);
  group.add(badge);

  group.traverse((object) => {
    if (object.isMesh) object.castShadow = true;
  });

  return { group, torso, head, armL, armR, legL, legR, custom: { mats, hairMat, hairBack, hairCap, locks } };
}

// ============================================================
// MASCOT CUSTOMIZATION (persisted in localStorage)
// ============================================================
const MASCOT_KEY = 'av2.mascot.v1';
const MASCOT_DEFAULTS = { hair: 'long', hairColor: '5a2f22', outfit: 'stage', height: 100, width: 100 };

const MASCOT_HAIR_STYLES = {
  long: { back: { s: [1.08, 1.55, 0.82], p: [0, -0.13, -0.05] }, cap: { s: [1, 1, 1], p: [0, 0.04, 0.05] }, locks: { s: [0.72, 3.3, 0.7], y: -0.28 } },
  bob: { back: { s: [1.1, 1.02, 0.88], p: [0, -0.02, -0.04] }, cap: { s: [1, 1, 1], p: [0, 0.04, 0.05] }, locks: { s: [0.78, 1.6, 0.75], y: -0.16 } },
  short: { back: { s: [1.05, 0.6, 0.85], p: [0, 0.07, -0.03] }, cap: { s: [1.03, 0.95, 1.03], p: [0, 0.04, 0.05] }, locks: null },
  buzz: { back: null, cap: { s: [1.01, 0.52, 1.01], p: [0, 0.06, 0.05] }, locks: null },
};

const MASCOT_OUTFITS = {
  stage: { top: 0xFDFBF7, panel: 0x233f9d, stripes: 0x008542, sleeveL: 0x008542, sleeveR: 0x7fa1bd, shoulder: 0xb93a3a, collar: 0xFFD100, pants: 0x5B82A6, shoes: 0x17121c },
  vibe: { top: 0xFDFBF7, panel: 0x9E33CA, stripes: 0xD1A13B, sleeveL: 0x9E33CA, sleeveR: 0xD1A13B, shoulder: 0xD1A13B, collar: 0x9E33CA, pants: 0x2a0f3a, shoes: 0x17121c },
  denim: { top: 0xFDFBF7, panel: 0x5B82A6, stripes: 0xFDFBF7, sleeveL: 0x5B82A6, sleeveR: 0x5B82A6, shoulder: 0xD1A13B, collar: 0xFDFBF7, pants: 0x3a5a8c, shoes: 0xFDFBF7 },
  night: { top: 0x241a2e, panel: 0x9E33CA, stripes: 0xD1A13B, sleeveL: 0x241a2e, sleeveR: 0x241a2e, shoulder: 0x9E33CA, collar: 0xD1A13B, pants: 0x17121c, shoes: 0x9E33CA },
};

const mascotCfg = (() => {
  const cfg = { ...MASCOT_DEFAULTS };
  try {
    const raw = localStorage.getItem(MASCOT_KEY);
    if (!raw) return cfg;
    const saved = JSON.parse(raw);
    if (saved && typeof saved === 'object') {
      if (saved.hair in MASCOT_HAIR_STYLES) cfg.hair = saved.hair;
      if (typeof saved.hairColor === 'string' && /^[0-9a-fA-F]{6}$/.test(saved.hairColor)) cfg.hairColor = saved.hairColor;
      if (saved.outfit in MASCOT_OUTFITS) cfg.outfit = saved.outfit;
      if (Number.isFinite(saved.height)) cfg.height = THREE.MathUtils.clamp(Math.round(saved.height), 85, 115);
      if (Number.isFinite(saved.width)) cfg.width = THREE.MathUtils.clamp(Math.round(saved.width), 80, 125);
    }
  } catch { /* ignore */ }
  return cfg;
})();

function saveMascotConfig() {
  try { localStorage.setItem(MASCOT_KEY, JSON.stringify(mascotCfg)); } catch { /* ignore */ }
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
// BOOT
// ============================================================
const stage = buildStage();
scene.add(stage);
scene.add(buildLights());
installStageEnvironment();
const dust = buildDust();
adaptiveQualityScene.dust = dust;
applyLowMobileSceneBudget();
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
  cu.hairCap.scale.set(...style.cap.s);
  cu.hairCap.position.set(...style.cap.p);
  for (const lock of cu.locks) {
    lock.visible = Boolean(style.locks);
    if (style.locks) {
      lock.scale.set(...style.locks.s);
      lock.position.y = style.locks.y;
    }
  }
  cu.hairMat.color.setHex(parseInt(mascotCfg.hairColor, 16));
  const outfit = MASCOT_OUTFITS[mascotCfg.outfit] || MASCOT_OUTFITS.stage;
  for (const slot in outfit) cu.mats[slot].color.setHex(outfit[slot]);
  applyMascotScale();
}

// Start close to the visual center and just upstage: drums are first on mobile.
mascot.group.position.set(-0.75, 0, -0.6);
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
  spawn: new THREE.Vector3(-0.75, 0, -0.6),
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
const mobileFollowTarget = new THREE.Vector3();
const mobileFollowDelta = new THREE.Vector3();
let joystickPointer = null;
const stageWalkPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const instrumentGroups = { drums: drums.group, piano: piano.group, guitar: guitar.group, mic: mic.group };
const instrumentWorldPositions = Object.fromEntries(
  Object.keys(instrumentGroups).map((kind) => [kind, new THREE.Vector3()]),
);

const INSTRUMENT_VIEW_PRESETS = {
  drums: {
    mascot: new THREE.Vector3(0, 0.15, -1.05),
    yaw: 0,
    seated: true,
    approach: [],
    camera: new THREE.Vector3(1.2, 2.18, -2.2),
    cameraMobile: new THREE.Vector3(1.42, 2.52, -2.75),
    target: new THREE.Vector3(0, 0.94, 0.05),
    arms: [-0.88, -1.05],
  },
  piano: {
    mascot: new THREE.Vector3(0, 0.07, 1.15),
    yaw: Math.PI,
    seated: true,
    approach: [],
    // Steeper overhead: look down onto keys from behind-left.
    camera: new THREE.Vector3(1.25, 3.55, 2.45),
    cameraMobile: new THREE.Vector3(1.4, 4.05, 2.9),
    target: new THREE.Vector3(-0.05, 0.52, 0.32),
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
  home: null,
};

function setSceneLabelsVisible(visible) {
  if (mascotLabel && !mascotMove.fall) mascotLabel.visible = visible;
}

function syncMobileInstrumentChrome() {
  const busy = ['approaching', 'entering', 'focused', 'returning'].includes(instrumentView.phase);
  // ✕ is the only way out of instrument focus (desktop + mobile).
  const showExit = busy && instrumentView.phase !== 'returning';
  if (mobileExit) mobileExit.hidden = !showExit;
}

function syncInstrumentExposure() {
  const portrait = window.innerWidth / window.innerHeight < 1;
  const baseExposure = portrait ? 0.98 : 1.12;
  renderer.toneMappingExposure = instrumentView.phase === 'focused' && instrumentView.kind === 'guitar'
    ? baseExposure * 0.78
    : baseExposure;
}

function setInstrumentViewPhase(phase, kind = instrumentView.kind) {
  instrumentView.phase = phase;
  instrumentView.kind = phase === 'idle' ? null : kind;
  document.documentElement.dataset.instrumentView = phase;
  if (instrumentView.kind) document.documentElement.dataset.instrument = instrumentView.kind;
  else delete document.documentElement.dataset.instrument;
  setSceneLabelsVisible(!['entering', 'focused'].includes(phase));
  syncMobileInstrumentChrome();
  syncInstrumentExposure();
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
  } else if (phase !== 'focused') {
    hideVocalPad();
    hideChordPad();
    controls.enableZoom = true;
    document.documentElement.classList.remove('guitar-focused', 'guitar-fretting');
    clearGuitarInteractionState();
    audio.muteGuitar();
  }
}

function instrumentLocalToWorld(kind, point) {
  const group = instrumentGroups[kind];
  group.updateWorldMatrix(true, false);
  return group.localToWorld(point.clone());
}

function resetMascotPose() {
  applyMascotScale();
  mascot.group.rotation.x = 0;
  mascot.group.rotation.z = 0;
  mascot.torso.rotation.set(0, 0, 0);
  mascot.head.rotation.set(0, 0, 0);
  mascot.armL.rotation.set(0, 0, -0.12);
  mascot.armR.rotation.set(0, 0, 0.12);
  mascot.legL.rotation.set(0, 0, 0);
  mascot.legR.rotation.set(0, 0, 0);
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
    ui.closeNav();
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
  controls.minDistance = FOCUSED_MIN_DISTANCE;
  controls.maxDistance = isMobileGameMode() ? 5.5 : 4.4;
  controls.minPolarAngle = 0.42;
  controls.maxPolarAngle = 1.48;
  if (instrumentView.kind === 'guitar') {
    // OrbitControls' cached spherical angle can still describe the pre-focus
    // camera until its first update. Anchor the lock to the animation endpoint
    // itself so enabling controls cannot reframe the guitar.
    const offset = camera.position.clone().sub(controls.target);
    const azimuth = Math.atan2(offset.x, offset.z);
    controls.minAzimuthAngle = azimuth - 0.18;
    controls.maxAzimuthAngle = azimuth + 0.18;
  } else {
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
  }
}

function startInstrumentCameraTransition(phase, kind, position, target, duration) {
  clearTimeout(idleTimer);
  controls.autoRotate = false;
  controls.enabled = false;
  instrumentView.transition = {
    elapsed: 0,
    duration,
    fromPosition: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPosition: position.clone(),
    toTarget: target.clone(),
  };
  setInstrumentViewPhase(phase, kind);
}

function activateInstrumentView(kind) {
  const preset = INSTRUMENT_VIEW_PRESETS[kind];
  if (!preset || instrumentView.phase !== 'approaching' || instrumentView.kind !== kind) return;
  instrumentView.home = captureInstrumentViewHome();
  mascotMove.destination = null;
  mascotMove.destinationKind = null;
  mascotMove.waypoints.length = 0;
  mascotMove.keys.clear();
  releaseMoveJoystick();
  poseMascotAtInstrument(kind);
  if (kind === 'guitar') {
    audio.init();
    audio.resume();
    audio.prewarmGuitar(allGuitarPitches());
  }
  const cameraPoint = isMobileGameMode() && preset.cameraMobile ? preset.cameraMobile : preset.camera;
  startInstrumentCameraTransition(
    'entering',
    kind,
    instrumentLocalToWorld(kind, cameraPoint),
    instrumentLocalToWorld(kind, preset.target),
    prefersReducedMotion.matches ? 0.18 : 0.78,
  );
}

function finishInstrumentReturn() {
  const home = instrumentView.home;
  if (instrumentView.phase === 'returning') {
    resetMascotPose();
    mascot.group.position.y = 0;
  }
  if (home) {
    camera.position.copy(home.position);
    controls.target.copy(home.target);
    restoreInstrumentControlLimits(home);
  }
  controls.enabled = started && flyT < 0;
  controls.autoRotate = false;
  controls.update();
  instrumentView.transition = null;
  instrumentView.home = null;
  setInstrumentViewPhase('idle');
}

function leaveInstrumentView({ immediate = false } = {}) {
  if (instrumentView.phase === 'idle') return;
  const leavingKind = instrumentView.kind;
  if (leavingKind === 'guitar') {
    clearGuitarInteractionState();
    audio.muteGuitar();
  }
  mascotMove.destinationKind = null;
  mascotMove.waypoints.length = 0;
  if (instrumentView.phase === 'approaching') {
    mascotMove.destination = null;
    instrumentView.transition = null;
    instrumentView.home = null;
    setInstrumentViewPhase('idle');
    return;
  }
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
    setInstrumentViewPhase('idle');
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
  if (!transition) return false;
  transition.elapsed += dt;
  const k = Math.min(1, transition.elapsed / transition.duration);
  const eased = easeInOut(k);
  camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
  controls.target.lerpVectors(transition.fromTarget, transition.toTarget, eased);
  camera.lookAt(controls.target);
  if (k >= 1) {
    instrumentView.transition = null;
    if (instrumentView.phase === 'entering') {
      applyFocusedControlLimits();
      controls.enabled = true;
      controls.update();
      setInstrumentViewPhase('focused', instrumentView.kind);
    } else if (instrumentView.phase === 'returning') {
      finishInstrumentReturn();
    }
  }
  return true;
}

function requestInstrumentView(kind) {
  const preset = INSTRUMENT_VIEW_PRESETS[kind];
  if (!preset || mascotMove.fall || flyT >= 0) return;
  if (instrumentView.kind === kind && ['approaching', 'entering', 'focused'].includes(instrumentView.phase)) return;
  if (instrumentView.phase !== 'idle') leaveInstrumentView({ immediate: true });
  setDancing(false);
  setInstrumentViewPhase('approaching', kind);
  mascotMove.keys.clear();
  releaseMoveJoystick();
  controls.autoRotate = false;
  clearTimeout(idleTimer);
  const route = [...preset.approach, preset.mascot].map((point) => {
    const world = instrumentLocalToWorld(kind, point);
    world.y = 0;
    return clampMascotPoint(world);
  });
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
  const maxRadius = rect.width * 0.31;
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

mobileExit?.addEventListener('pointerdown', () => {
  mobileExit.classList.add('pressed');
});
mobileExit?.addEventListener('click', () => {
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
  mascotMove.waypoints.length = 0;
  mascotMove.destination = clampMascotPoint(point.clone());
  controls.autoRotate = false;
  finishOnboard();
}

function beginMascotFall(direction) {
  if (mascotMove.fall) return;
  setDancing(false);
  leaveInstrumentView({ immediate: true });
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
  if (isMobileGameMode()) {
    mobileFollowTarget.set(mascotMove.spawn.x, 1.35, mascotMove.spawn.z - 0.25);
    mobileFollowDelta.subVectors(mobileFollowTarget, controls.target);
    controls.target.add(mobileFollowDelta);
    camera.position.add(mobileFollowDelta);
  }
  // Fall leaves focus (muteGuitar) and can suspend WebAudio — wake + re-queue loop.
  audio.init();
  audio.resume();
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
  audio.init();
  audio.resume();
  const alreadyInPosition = instrumentView.kind === nearest.kind
    && ['entering', 'focused'].includes(instrumentView.phase);
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
  mobilePlay.disabled = !available;
  mobilePlayHint.hidden = !started || available;
  mobilePlay.setAttribute('aria-label', label);
}
updateMobilePlayAvailability.lastCheck = -Infinity;
updateMobilePlayAvailability.available = null;
updateMobilePlayAvailability.label = '';
updateMobilePlayAvailability.started = null;

mobilePlay.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  if (mobilePlay.disabled) return;
  mobilePlay.classList.add('pressed');
  playNearestInstrument();
  navigator.vibrate?.(22);
});
for (const eventName of ['pointerup', 'pointercancel', 'pointerleave']) {
  mobilePlay.addEventListener(eventName, () => mobilePlay.classList.remove('pressed'));
}

function updateMascot(dt) {
  if (!started || ui.modalOpen || flyT >= 0) return;
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
  const direction = new THREE.Vector3(
    (mascotMove.keys.has('ArrowRight') ? 1 : 0) - (mascotMove.keys.has('ArrowLeft') ? 1 : 0),
    0,
    (mascotMove.keys.has('ArrowDown') ? 1 : 0) - (mascotMove.keys.has('ArrowUp') ? 1 : 0),
  );

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
    mascot.group.position.addScaledVector(direction, mascotMove.speed * dt * moveStrength);
    clampMascotPoint(mascot.group.position);
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

  if (isMobileGameMode() && flyT < 0 && (instrumentView.phase === 'idle' || instrumentView.phase === 'approaching')) {
    mobileFollowTarget.set(mascot.group.position.x, 1.35, mascot.group.position.z - 0.25);
    mobileFollowDelta.subVectors(mobileFollowTarget, controls.target)
      .multiplyScalar(Math.min(1, dt * 2.2));
    controls.target.add(mobileFollowDelta);
    camera.position.add(mobileFollowDelta);
  }
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
const GUITAR_KEY_CHORDS = {
  KeyE: 'Em',
  KeyA: 'Am',
  KeyC: 'C',
  KeyD: 'D',
  KeyG: 'G',
  KeyF: 'F',
};
let heldGuitarChord = null;
let heldGuitarChordPointer = null;
let latchedGuitarChord = null;
let keyboardGuitarChord = null;
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
) {
  if (!isGuitarPlayFocus()) return false;
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
const FOCUSED_ORBIT_THRESHOLD = 12;
const FOCUSED_PINCH_THRESHOLD = 9;
let focusedInstrumentPinch = null;

function focusedTouchPointers() {
  if (!isMultiTouchInstrumentFocus()) return [];
  return [...activePointers.entries()]
    .filter(([, info]) => info.pointerType === 'touch' && (info.mode === 'play' || info.mode === 'tap'))
    .map(([pointerId, info]) => ({ pointerId, info }));
}

function seedFocusedInstrumentPinch() {
  const touches = focusedTouchPointers();
  if (touches.length < 2 || !touches.some(({ info }) => info.mode === 'play')) {
    focusedInstrumentPinch = null;
    return;
  }
  const pair = touches.slice(0, 2);
  const ids = pair.map(({ pointerId }) => pointerId);
  if (focusedInstrumentPinch
    && focusedInstrumentPinch.ids.every((pointerId) => ids.includes(pointerId))) return;
  const [a, b] = pair.map(({ info }) => new THREE.Vector2(info.currentX, info.currentY));
  focusedInstrumentPinch = {
    ids,
    startDistance: a.distanceTo(b),
    active: false,
  };
}

/**
 * Decide whether a focused piano/drum touch belongs to playing or the camera.
 * OrbitControls still receives pointerdown, but movement is held until intent
 * is clear: horizontal piano travel plays, vertical travel orbits, pinch zooms.
 */
function focusedInstrumentGesture(e, info) {
  if (info.pointerType !== 'touch' || !isMultiTouchInstrumentFocus()) return 'pass';
  info.currentX = e.clientX;
  info.currentY = e.clientY;

  const pinch = focusedInstrumentPinch;
  if (pinch?.ids.includes(e.pointerId)) {
    const participants = pinch.ids.map((pointerId) => activePointers.get(pointerId));
    if (participants.every(Boolean)) {
      const [a, b] = participants.map((pointer) => (
        new THREE.Vector2(pointer.currentX, pointer.currentY)
      ));
      if (!pinch.active && Math.abs(a.distanceTo(b) - pinch.startDistance) >= FOCUSED_PINCH_THRESHOLD) {
        pinch.active = true;
        for (const pointer of participants) {
          pointer.usedCameraGesture = true;
          if (pointer.mode === 'play') pointer.gestureIntent = 'orbit';
        }
      }
      if (pinch.active) return 'camera';
      return info.mode === 'play' ? 'instrument' : 'block';
    }
  }

  if (info.mode !== 'play') return 'pass';
  if (info.gestureIntent === 'orbit') return 'camera';
  if (info.gestureIntent === 'play') return 'instrument';

  const dx = e.clientX - info.x;
  const dy = e.clientY - info.y;
  if (Math.hypot(dx, dy) >= FOCUSED_ORBIT_THRESHOLD) {
    const pianoGliss = instrumentView.kind === 'piano' && Math.abs(dx) >= Math.abs(dy) * 0.9;
    info.gestureIntent = pianoGliss ? 'play' : 'orbit';
    if (info.gestureIntent === 'orbit') info.usedCameraGesture = true;
  }
  return info.gestureIntent === 'orbit' ? 'camera' : 'instrument';
}

canvas.addEventListener('pointerdown', (e) => {
  if (!started || ui.modalOpen || flyT >= 0) return;

  if (isMultiTouchInstrumentFocus()) {
    const mesh = hitInteractableAt(e.clientX, e.clientY);
    if (mesh && mesh.userData.instrument === instrumentView.kind) {
      // Mouse/pen stays instrument-only. Touch pointerdown also reaches
      // OrbitControls; pointermove arbitration below decides play vs camera.
      e.preventDefault();
      if (e.pointerType !== 'touch') e.stopImmediatePropagation();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      activePointers.set(e.pointerId, {
        mode: 'play',
        x: e.clientX,
        y: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        t: performance.now(),
        token: playTokenForMesh(mesh),
        pointerType: e.pointerType,
        gestureIntent: 'pending',
      });
      seedFocusedInstrumentPinch();
      trigger(mesh);
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
  seedFocusedInstrumentPinch();
}, { capture: true, passive: false });

canvas.addEventListener('pointermove', (e) => {
  const info = activePointers.get(e.pointerId);
  if (!info) return;
  info.currentX = e.clientX;
  info.currentY = e.clientY;

  const focusedGesture = focusedInstrumentGesture(e, info);
  if (focusedGesture === 'camera') return;
  if (focusedGesture === 'instrument' || focusedGesture === 'block') {
    e.stopImmediatePropagation();
    if (focusedGesture === 'block') return;
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
    trigger(mesh);
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
  activePointers.delete(e.pointerId);
  seedFocusedInstrumentPinch();
  if (!info) return;

  if (info.mode === 'guitar-approach') {
    if (!info.approached) walkMascotToInstrument('guitar');
    return;
  }

  if (info.mode === 'guitar-strum') {
    if (info.strummed || info.pointerType === 'touch' || !isGuitarPlayFocus()) return;
    const hit = hitInteractableDetailsAt(e.clientX, e.clientY, 'strum');
    if (!hit) return;
    const localX = guitarLocalPoint(hit).x;
    const stringIndex = nearestGuitarString(info.stringXs, localX);
    pluckGuitarString(stringIndex, currentGuitarShape()[stringIndex], 0.62);
    return;
  }

  if (info.mode !== 'tap' || info.usedCameraGesture) return;
  const dx = e.clientX - info.x;
  const dy = e.clientY - info.y;
  const dt = performance.now() - info.t;
  const tapTolerance = isMobileGameMode() ? 28 : 8;
  if (Math.hypot(dx, dy) < tapTolerance && dt < 600) handleClick(e);
}

canvas.addEventListener('pointerup', endActivePointer, { capture: true });
canvas.addEventListener('pointercancel', (e) => {
  activePointers.delete(e.pointerId);
  seedFocusedInstrumentPinch();
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
  const cameraPoint = isMobileGameMode() && preset.cameraMobile ? preset.cameraMobile : preset.camera;
  const nextPosition = instrumentLocalToWorld(kind, cameraPoint);
  const nextTarget = instrumentLocalToWorld(kind, preset.target);
  syncInstrumentExposure();
  if (instrumentView.phase === 'entering' && instrumentView.transition) {
    instrumentView.transition.toPosition.copy(nextPosition);
    instrumentView.transition.toTarget.copy(nextTarget);
    return;
  }
  camera.position.copy(nextPosition);
  controls.target.copy(nextTarget);
  controls.update();
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
  if (instrumentView.phase === 'entering' || instrumentView.phase === 'focused') applyFocusedControlLimits();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) {
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(window.innerWidth, window.innerHeight);
  }
  refitActiveInstrumentView();
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

function blockStageBrowserPageZoom(event) {
  if (eventInvolvesUiChrome(event)) return;
  const inTelegram = document.documentElement.classList.contains('telegram-webview');
  // Telegram: claim single-finger drags so the shell doesn't treat them as
  // dismiss / back gestures. Multi-touch still blocked after stage start —
  // but only when every finger is on the stage (not pedal + instrument).
  if (inTelegram && event.cancelable) {
    if (event.type === 'touchmove' || (event.touches && event.touches.length >= 2)) {
      event.preventDefault();
      return;
    }
  }
  if (!started) return;
  if (event.touches && event.touches.length >= 2) event.preventDefault();
}
document.addEventListener('touchstart', blockStageBrowserPageZoom, { passive: false, capture: true });
document.addEventListener('touchmove', blockStageBrowserPageZoom, { passive: false, capture: true });
document.addEventListener('gesturestart', (e) => {
  if (!document.documentElement.classList.contains('telegram-webview') && !started) return;
  if (eventInvolvesUiChrome(e)) return;
  if (e.cancelable) e.preventDefault();
}, { passive: false, capture: true });
document.addEventListener('gesturechange', (e) => {
  if (!document.documentElement.classList.contains('telegram-webview') && !started) return;
  if (eventInvolvesUiChrome(e)) return;
  if (e.cancelable) e.preventDefault();
}, { passive: false, capture: true });
document.addEventListener('gestureend', (e) => {
  if (!document.documentElement.classList.contains('telegram-webview') && !started) return;
  if (eventInvolvesUiChrome(e)) return;
  if (e.cancelable) e.preventDefault();
}, { passive: false, capture: true });

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    resetBrowserPageZoom();
    syncRendererToWindow();
  });
  window.visualViewport.addEventListener('scroll', resetBrowserPageZoom);
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
    ui.toast(
      justUnlocked
        ? 'МАКСИМАЛЬНИЙ ВАЙБ! <span class="hl">LOOP-ПЕДАЛЬ ВІДКРИТО</span>'
        : 'МАКСИМАЛЬНИЙ ВАЙБ! <span class="hl">Сцена — твоя</span>',
      4200,
      'vibe-max',
    );
    vibe = 55;
    setTimeout(() => ui.setVibe(vibe), 600);
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

function chipFor(kind, { force = false } = {}) {
  if (ui.modalOpen) return;
  if (!force && shownPriceChips.has(kind)) return;
  shownPriceChips.add(kind);
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
  if (event.showPrice !== false) chipFor(kind);
}

function playMusicalEvent(event, { record = true, at = null, feedback = true } = {}) {
  audio.init();
  audio.resume();
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
    audio.piano(event.freq, velocity, startAt);
  } else if (event.type === 'guitar-pluck') {
    audio.pluck(event.freqHz ?? event.freq, velocity, startAt, {
      stringIndex: event.stringIndex ?? 0,
      // Loop playback must survive muteGuitar() when leaving focus / falling.
      track: record,
    });
  } else if (event.type === 'guitar-strum') {
    audio.strum(event.strings ?? event.freqs, velocity, startAt, { track: record });
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
  audio.init();
  audio.resume();
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
  renderLoopState();
  navigator.vibrate?.(30);
}

function finishBaseLoopRecording(automatic = false) {
  if (loop.state !== 'recording') return;
  clearTimeout(loop.autoCloseTimer);
  if (!loop.events.length && !heldLoopCapture) {
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
  renderLoopState();
  ui.toast('Новий шар — грай поверх loop', 1700);
  navigator.vibrate?.(24);
}

function finishLoopOverdub() {
  if (loop.state !== 'overdubbing') return;
  finishHeldLoopCapture();
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
  audio.resume();
  loop.epoch = audio.ctx.currentTime - loop.pausedOffset;
  for (const event of loop.events) event.playFromCycle = 0;
  loop.state = 'playing';
  renderLoopState();
  startLoopScheduler();
}

function clearRecordedLoop() {
  clearTimeout(loop.autoCloseTimer);
  finishHeldLoopCapture();
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
  if (heldLoopCapture || !heldVocal || !heldVocalButton || heldVocalPointer === null) return;
  heldLoopCapture = beginHeldLoopCapture(
    Number(heldVocalButton.dataset.vocalFreq),
    Number(heldVocalButton.dataset.vocalVowel),
  );
  stampHeldLoopCaptureDuration();
}

function finishHeldLoopCapture() {
  if (!heldLoopCapture || heldLoopCapture.finished) return;
  heldLoopCapture.finished = true;
  stampHeldLoopCaptureDuration();
  delete heldLoopCapture.event.durationPending;
  if (loop.duration > 0 && audio.ctx) {
    const currentCycle = Math.floor((audio.ctx.currentTime - loop.epoch) / loop.duration);
    heldLoopCapture.event.playFromCycle = Math.max(heldLoopCapture.event.playFromCycle, currentCycle + 1);
  }
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
  heldGuitarChord = null;
  heldGuitarChordPointer = null;
  latchedGuitarChord = null;
  keyboardGuitarChord = null;
  guitarStrokeMotion = 0;
  syncChordPadHeld();
}

const recentTouchChordAt = new WeakMap();
for (const button of chordButtons) {
  button.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    audio.init();
    audio.resume();
    if (event.pointerType === 'touch') {
      event.preventDefault();
      recentTouchChordAt.set(button, performance.now());
      holdGuitarChord(button.dataset.chord, event.pointerId);
      button.setPointerCapture?.(event.pointerId);
    }
  });
  button.addEventListener('click', (event) => {
    if (event.detail !== 0 && performance.now() - (recentTouchChordAt.get(button) || 0) < 700) return;
    toggleLatchedGuitarChord(button.dataset.chord);
  });
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(eventName, releaseHeldGuitarChord);
  }
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
  if (!event.target.closest?.('#vocal-pad, #chord-pad, #toast')) return;
  event.preventDefault();
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
    const freq = Number(button.dataset.vocalFreq);
    const vowel = Number(button.dataset.vocalVowel);
    audio.init();
    audio.resume();
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

function openCreditLink(hit) {
  const url = hit?.object?.userData?.link;
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

function creditLinkAtPointer(rayReady = false) {
  if (!creditLinks.length) return null;
  if (!rayReady) raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(creditLinks, false);
  return hits[0] || null;
}

function handleClick(e) {
  if (!started || ui.modalOpen || flyT >= 0) return;
  onPointerMove(e);
  if (openCreditLink(creditLinkAtPointer())) return;
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

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    finishOnboard();
  }
  if (!started || ui.modalOpen) return;
  if (isEditableHotkeyTarget(e.target)) return;
  const guitarChord = GUITAR_KEY_CHORDS[e.code];
  if (guitarChord && isGuitarPlayFocus()) {
    e.preventDefault();
    if (!e.repeat) {
      keyboardGuitarChord = guitarChord;
      syncChordPadHeld();
    }
    return;
  }
  if (e.code.startsWith('Arrow')) {
    e.preventDefault();
    if (instrumentView.phase !== 'idle') return;
    mascotMove.keys.add(e.code);
  }
  if (e.code === 'KeyE' && !e.repeat && instrumentView.phase === 'idle') {
    playNearestInstrument();
  }
  if (e.code === 'KeyL' && !e.repeat) {
    e.preventDefault();
    if (!loopUnlocked) {
      toggleLoopRecording();
      return;
    }
    if (e.shiftKey && loop.state !== 'empty') clearRecordedLoop();
    else toggleLoopRecording();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code.startsWith('Arrow')) mascotMove.keys.delete(e.code);
  const guitarChord = GUITAR_KEY_CHORDS[e.code];
  if (guitarChord && keyboardGuitarChord === guitarChord) {
    keyboardGuitarChord = null;
    syncChordPadHeld();
  }
});

// ---- keyboard ----
const DRUM_KEYS = { KeyA: 'kick', KeyS: 'snare', KeyD: 'hihat', KeyF: 'tom2', KeyG: 'crash' };
window.addEventListener('keydown', (e) => {
  if (!started || ui.modalOpen || e.repeat || isEditableHotkeyTarget(e.target)) return;
  if (e.code in DRUM_KEYS && canPlayInstrument('drums')) {
    const part = DRUM_KEYS[e.code];
    playMusicalEvent({ type: 'drum', part, vel: 1, vibe: 4 });
  } else if (/^Digit[1-8]$/.test(e.code) && canPlayInstrument('piano')) {
    const idx = Number(e.code.slice(5)) - 1;
    const key = whiteKeys[idx];
    if (key) {
      playMusicalEvent({ type: 'piano', freq: key.userData.freq, vel: 1, vibe: 3.5 });
    }
  } else if (e.code === 'Space' && isGuitarPlayFocus()) {
    e.preventDefault();
    fireGuitarStrum(1, e.shiftKey ? 'treble-to-bass' : 'bass-to-treble');
  }
});

// ---- sound mixer (HUD) — per-instrument levels + master mute ----
const soundMixer = document.getElementById('sound-mixer');
const soundMuteBtn = document.getElementById('sound-mute-btn');
const soundFaders = [...(soundMixer?.querySelectorAll('input[data-bus]') || [])];
let muted = false;

function silenceHeldVocal() {
  clearInterval(heldVocalPulseTimer);
  finishHeldLoopCapture();
  audio.stopVocal(heldVocal);
  heldVocalButton?.classList.remove('playing');
  heldVocal = null;
  heldVocalButton = null;
}

function syncSoundMuteUi() {
  ui.setSoundMuted(muted);
  if (soundMuteBtn) {
    soundMuteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    soundMuteBtn.textContent = muted ? 'УВІМК' : 'ВИМК';
  }
}

function setMasterMuted(next) {
  muted = Boolean(next);
  audio.init();
  audio.setMuted(muted);
  if (!muted) audio.resume();
  if (muted) silenceHeldVocal();
  syncSoundMuteUi();
}

function closeSoundMixer() {
  if (!soundMixer || soundMixer.hidden) return;
  soundMixer.hidden = true;
  ui.el.soundBtn?.setAttribute('aria-expanded', 'false');
}

function openSoundMixer() {
  if (!soundMixer) return;
  ui.closeNav();
  audio.init();
  audio.resume();
  for (const fader of soundFaders) {
    fader.value = String(Math.round((audio.getLevel(fader.dataset.bus) ?? 1) * 100));
  }
  soundMixer.hidden = false;
  ui.el.soundBtn?.setAttribute('aria-expanded', 'true');
  syncSoundMuteUi();
}

ui.el.soundBtn?.addEventListener('click', (event) => {
  event.stopPropagation();
  if (soundMixer?.hidden) openSoundMixer();
  else closeSoundMixer();
});

soundMuteBtn?.addEventListener('click', (event) => {
  event.stopPropagation();
  setMasterMuted(!muted);
});

for (const fader of soundFaders) {
  fader.addEventListener('pointerdown', (event) => event.stopPropagation());
  fader.addEventListener('input', () => {
    audio.init();
    audio.setLevel(fader.dataset.bus, Number(fader.value) / 100);
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

// ---- mascot customization (ОБРАЗ modal) ----
const mascotModal = document.getElementById('modal-mascot');
const mascotHeightInput = document.getElementById('mascot-height');
const mascotWidthInput = document.getElementById('mascot-width');

function syncMascotModal() {
  if (!mascotModal) return;
  const syncGroup = (selector, attr, value) => {
    mascotModal.querySelectorAll(selector).forEach((btn) => {
      const on = btn.dataset[attr] === String(value);
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  };
  syncGroup('[data-mascot-hair]', 'mascotHair', mascotCfg.hair);
  syncGroup('[data-mascot-color]', 'mascotColor', mascotCfg.hairColor);
  syncGroup('[data-mascot-outfit]', 'mascotOutfit', mascotCfg.outfit);
  if (mascotHeightInput) mascotHeightInput.value = String(mascotCfg.height);
  if (mascotWidthInput) mascotWidthInput.value = String(mascotCfg.width);
  const hv = document.getElementById('mascot-height-val');
  const wv = document.getElementById('mascot-width-val');
  if (hv) hv.textContent = `${mascotCfg.height}%`;
  if (wv) wv.textContent = `${mascotCfg.width}%`;
}

function setMascotConfig(patch) {
  Object.assign(mascotCfg, patch);
  saveMascotConfig();
  applyMascotConfig();
  syncMascotModal();
}

if (mascotModal) {
  mascotModal.querySelectorAll('[data-mascot-hair]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ hair: btn.dataset.mascotHair })));
  mascotModal.querySelectorAll('[data-mascot-color]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ hairColor: btn.dataset.mascotColor })));
  mascotModal.querySelectorAll('[data-mascot-outfit]').forEach((btn) =>
    btn.addEventListener('click', () => setMascotConfig({ outfit: btn.dataset.mascotOutfit })));
  mascotHeightInput?.addEventListener('input', () => setMascotConfig({ height: Number(mascotHeightInput.value) }));
  mascotWidthInput?.addEventListener('input', () => setMascotConfig({ width: Number(mascotWidthInput.value) }));
  document.getElementById('mascot-reset')?.addEventListener('click', () => setMascotConfig({ ...MASCOT_DEFAULTS }));
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

function frameMascotForCustomize() {
  if (instrumentView.phase !== 'idle') leaveInstrumentView({ immediate: true });
  setDancing(false);
  controls.autoRotate = false;
  clearTimeout(idleTimer);
  mascotCam.savedPos.copy(camera.position);
  mascotCam.savedTgt.copy(controls.target);
  const mp = mascot.group.position;
  const dir = camera.position.clone().sub(controls.target);
  dir.y = 0;
  if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
  dir.normalize();
  // Face the camera so outfit / hair / face changes are visible while editing.
  mascot.group.rotation.y = Math.atan2(dir.x, dir.z);
  let target;
  let position;
  if (window.innerWidth <= 900) {
    // Compact layout docks the panel as a bottom sheet — project the mascot
    // into the open strip above it instead of screen center.
    target = new THREE.Vector3(mp.x, mp.y - 0.3, mp.z);
    position = target.clone().addScaledVector(dir, 3.3);
    position.y = mp.y + 1.35;
  } else {
    target = new THREE.Vector3(mp.x, mp.y + 0.82 * (mascotCfg.height / 100), mp.z);
    position = target.clone().addScaledVector(dir, 2.7);
    position.y = target.y + 0.55;
  }
  controls.enabled = false;
  startMascotCam(position, target, false);
}

window.addEventListener('av2:modal', (event) => {
  if (event.detail?.name !== 'mascot' || !started) return;
  if (event.detail.open) {
    mascotCam.framed = true;
    frameMascotForCustomize();
  } else if (mascotCam.framed) {
    mascotCam.framed = false;
    startMascotCam(mascotCam.savedPos, mascotCam.savedTgt, true);
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

const _uiToggleNav = ui.toggleNav.bind(ui);
ui.toggleNav = (...args) => {
  closeSoundMixer();
  return _uiToggleNav(...args);
};
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
    ] = modules;
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      isMobileGameMode() ? 0.28 : 0.45,
      0.5,
      0.85,
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
    tier: qualityTierLabel(),
    deviceMemory,
    hardwareConcurrency,
    pixelRatio: renderer.getPixelRatio(),
    postprocessing: Boolean(composer),
    bloom: Boolean(bloomPass),
    shadows: renderer.shadowMap.enabled,
    frameRateCap: isMobileQualityProbe() ? 'probe' : (isLowEndMobileGameMode() ? 30 : null),
    mobileProbe: { phase: mobileQualityProbe.phase, p90: mobileQualityProbe.p90 },
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
const ONBOARD_KEY = 'av2.onboard.v1';
const INTRO_SESSION_KEY = 'av2.intro.v1';
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

onboardOk?.addEventListener('click', finishOnboard);
onboardEl?.addEventListener('click', (e) => {
  if (e.target !== onboardEl && e.target !== onboardText) return;
  finishOnboard();
});

function startExperience(withAudio = true) {
  if (started) return;
  started = true;
  markIntroSeen();
  document.documentElement.classList.add('stage-live');
  syncViewportMeta();
  if (withAudio) audio.unlock();
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

enterBtn.addEventListener('click', () => startExperience(true));
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
  }
  resyncLoopPlayback();
}

function unlockAudioFromGesture() {
  if (!started && !audio.ctx) return;
  const generation = audio.contextGeneration;
  const snapshot = captureAudioRecoverySnapshot();
  audio.unlock();
  if (audio.contextGeneration !== generation) {
    restoreAfterAudioContextRebuild(snapshot);
  }
}
window.addEventListener('pointerdown', unlockAudioFromGesture, { capture: true, passive: true });
window.addEventListener('touchstart', unlockAudioFromGesture, { capture: true, passive: true });
window.addEventListener('keydown', unlockAudioFromGesture, { capture: true });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && audio.ctx) {
    audio.resume();
    resyncLoopPlayback();
  }
  if (document.visibilityState === 'hidden') {
    audio.markForRecovery();
    clearGuitarInteractionState();
    audio.muteGuitar();
  }
});
window.addEventListener('blur', () => {
  audio.markForRecovery();
  clearGuitarInteractionState();
  audio.muteGuitar();
});
window.addEventListener('pagehide', () => audio.markForRecovery());
window.addEventListener('pageshow', () => {
  if (audio.ctx) {
    audio.resume();
    resyncLoopPlayback();
  }
});

// idle auto-rotate
let idleTimer = null;
controls.addEventListener('start', () => {
  controls.autoRotate = false;
  clearTimeout(idleTimer);
});
controls.addEventListener('end', () => {
  clearTimeout(idleTimer);
  if (!isMobileGameMode() && instrumentView.phase === 'idle') {
    idleTimer = setTimeout(() => {
      if (!ui.modalOpen && instrumentView.phase === 'idle') controls.autoRotate = true;
    }, 9000);
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
      if (!isMobileGameMode()) {
        idleTimer = setTimeout(() => {
          if (!ui.modalOpen && instrumentView.phase === 'idle') controls.autoRotate = true;
        }, 6000);
      }
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
    for (let i = 0; i < spotHeads.length; i++) {
      const lens = spotHeads[i].lensMat;
      const pulse = 0.72 + Math.sin(t * 1.4 + i * 1.1) * 0.28;
      lens.color.setHex(spotHeads[i].base);
      lens.color.multiplyScalar(0.75 + pulse * 0.35);
    }
  }

  // Dust motion is evaluated in the vertex shader; only one scalar changes.
  dust.userData.time.value = t;

  // vibe decay
  if (vibe > 0 && performance.now() - lastVibeAdd > 1500) {
    vibe = Math.max(0, vibe - 6 * dt);
    ui.setVibe(vibe);
  }

  // hover raycast
  if (started && !ui.modalOpen && canHover.matches) {
    raycaster.setFromCamera(pointer, camera);
    const overLink = creditLinkAtPointer(true);
    const hits = raycaster.intersectObjects(interactables, false);
    const hit = hits.length ? hits[0].object : null;
    if (hit !== hovered) {
      if (hovered) setGlow(hovered, false);
      hovered = hit;
      if (hovered) setGlow(hovered, true);
    }
    canvas.style.cursor = (overLink || hovered) ? 'pointer' : '';
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
  const credit = stage.getObjectByName('credit-signature');
  if (credit?.material?.map) {
    const next = signatureTexture();
    credit.material.map.dispose();
    credit.material.map = next;
    credit.material.needsUpdate = true;
  }
  loadSlideTextures().then((loaded) => {
    if (!loaded) window.__dbg = 'no photos loaded';
  }).catch((e) => { window.__dbg = `load err: ${e}`; });
  addLabels();
  renderer.compile(scene, camera);
  animate();

  if (shouldSkipIntro()) {
    startWithoutIntro();
  } else {
    enterBtn.disabled = false;
    enterBtn.classList.add('ready');
    enterLabel.textContent = 'ВИЙТИ НА СЦЕНУ ›';
  }

  if (params.has('autoenter')) {
    setTimeout(() => startExperience(false), 300);
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
