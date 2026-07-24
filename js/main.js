// ============================================================
// ART VIBE STUDIO — interactive 3D stage
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { AudioEngine } from './audio.js?v=20260721-15';
import { buildDrumKit, buildPiano, buildGuitar, buildMic } from './instruments.js?v=20260724-68';
import { UI } from './ui.js?v=20260724-65';

// ---- error collector (debug / headless testing) ----
const errlog = document.getElementById('errlog');
window.addEventListener('error', (e) => { errlog.textContent += `ERR: ${e.message} @ ${e.filename}:${e.lineno}\n`; });
window.addEventListener('unhandledrejection', (e) => { errlog.textContent += `REJ: ${e.reason}\n`; });

const params = new URLSearchParams(location.search);
const ui = new UI();
const audio = new AudioEngine();
const isMobileGameMode = () => window.innerWidth <= 720 ||
  window.matchMedia('(hover: none) and (pointer: coarse)').matches;
const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const stageAmbience = { curtains: [], valance: null };

// ============================================================
// RENDERER / SCENE / CAMERA
// ============================================================
const canvas = document.getElementById('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  if (!renderer.getContext()) throw new Error('no webgl');
} catch (err) {
  document.getElementById('webgl-fail').hidden = false;
  document.getElementById('intro').style.display = 'none';
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
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

function fitCameraToViewport() {
  const portrait = window.innerWidth / window.innerHeight < 1;
  if (portrait) {
    // Portrait intentionally crops the far stage wings and brings the player
    // into the action, closer to a third-person mobile game camera.
    CAM_START.set(0, 7.8, 20);
    CAM_END.set(0, 2.9, 14.6);
    camera.fov = 62;
    controls.maxDistance = 22;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMappingExposure = 0.98;
  } else {
    CAM_START.set(0, 9.5, 18.5);
    CAM_END.set(0, 3.05, 10.45);
    camera.fov = 55;
    controls.maxDistance = 16;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMappingExposure = 1.12;
  }
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
controls.minDistance = 5;
controls.minPolarAngle = 0.7;
controls.maxPolarAngle = 1.47;
controls.autoRotateSpeed = 0.55;
controls.enabled = false;

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

function buildStage() {
  const g = new THREE.Group();

  // venue floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0x120d1a, roughness: 0.4, metalness: 0.2 })
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

  // footlights — emissive bulbs + real PointLights on every other fixture
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0x332211, emissive: 0xD1A13B, emissiveIntensity: 1.6, roughness: 0.5,
  });
  const bulbGeom = new THREE.SphereGeometry(0.05, 10, 8);
  const footIntensity = isMobileGameMode() ? 10 : 16;
  for (let i = 0; i < 9; i++) {
    const x = -6 + i * 1.5;
    const b = new THREE.Mesh(bulbGeom, bulbMat);
    b.position.set(x, 0.06, 3.9);
    g.add(b);
    if (i % 2 === 0) {
      const pl = new THREE.PointLight(0xffc878, footIntensity, 4.2, 2);
      pl.position.set(x, 0.22, 3.65);
      g.add(pl);
    }
  }

  // backdrop wall
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 12),
    new THREE.MeshStandardMaterial({ color: 0x15091f, roughness: 0.95 })
  );
  wall.position.set(0, 5, -5.6);
  g.add(wall);

  // curtains
  const curt = curtainTexture();
  const curtMat = new THREE.MeshStandardMaterial({ map: curt, roughness: 0.88 });
  stageAmbience.curtains.length = 0;
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 9.4), curtMat);
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
  for (const s of [-1, 1]) {
    const spk = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.0, 0.95), spkMat);
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
      new THREE.BoxGeometry(0.4, 0.12, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xD1A13B, metalness: 0.8, roughness: 0.3 })
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

function updateSlideshowNavLayout() {
  if (slideshowNav.hidden || !slideshowScreen) return;
  slideshowScreen.updateWorldMatrix(true, false);
  slideshowScreen.getWorldPosition(screenCenterWorld);
  slideshowScreen.getWorldQuaternion(screenQuaternionWorld);
  screenNormalWorld.set(0, 0, 1).applyQuaternion(screenQuaternionWorld);
  const towardCamera = camera.position.clone().sub(screenCenterWorld).normalize();
  const facingCamera = screenNormalWorld.dot(towardCamera);
  if (facingCamera <= 0.02) {
    slideshowNav.style.visibility = 'hidden';
    return;
  }

  const projected = screenCorners.map((corner) => {
    const point = slideshowScreen.localToWorld(corner.clone()).project(camera);
    return {
      x: (point.x * 0.5 + 0.5) * window.innerWidth,
      y: (-point.y * 0.5 + 0.5) * window.innerHeight,
      z: point.z,
    };
  });
  const xs = projected.map((point) => point.x);
  const ys = projected.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const width = right - left;
  const height = bottom - top;
  const onScreen = right > 0 && left < window.innerWidth && bottom > 0 && top < window.innerHeight;
  const inFront = projected.every((point) => point.z > -1 && point.z < 1);
  if (!onScreen || !inFront || width < 70 || height < 45) {
    slideshowNav.style.visibility = 'hidden';
    return;
  }

  slideshowNav.style.visibility = 'visible';
  slideshowNav.style.left = `${left}px`;
  slideshowNav.style.top = `${top}px`;
  slideshowNav.style.width = `${width}px`;
  slideshowNav.style.height = `${height}px`;
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

function loadSlideTextures() {
  const loader = new THREE.TextureLoader();
  const fallbackFiles = ['img/wicked-ensemble.jpg', 'img/wicked-cast.jpg', 'img/wicked-duet.jpg', 'img/stage-guitar.jpg'];

  // `slides.json` is the complete manifest of images in /img that belong in the slideshow.
  // Keeping it separate lets the stage load every supplied slide without bundling a stale list in the app.
  return fetch('img/slides.json', { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : fallbackFiles)
    .then((files) => Array.isArray(files) && files.length ? files : fallbackFiles)
    .catch(() => fallbackFiles)
    .then((files) => Promise.allSettled(
      files.map((file) => new Promise((res, rej) =>
        loader.load(file, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          res(texture);
        }, undefined, rej)))
    ))
    .then((results) => results.filter((result) => result.status === 'fulfilled').map((result) => result.value));
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
    { x: -4.6, color: 0x9E33CA, intensity: 950, target: new THREE.Vector3(-2.8, 1.0, -1.7), coneR: 1.7 },
    { x: -1.55, color: 0xD1A13B, intensity: 800, target: new THREE.Vector3(-1.35, 0.8, 1.75), coneR: 1.3 },
    { x: 1.55, color: 0xfff0d8, intensity: 700, target: new THREE.Vector3(1.0, 1.2, 2.4), coneR: 1.4, shadow: true },
    { x: 4.6, color: 0x9E33CA, intensity: 950, target: new THREE.Vector3(3.5, 1.0, -1.3), coneR: 1.7 },
    { x: 0, color: 0x7a1fa2, intensity: 420, target: new THREE.Vector3(0, 5.35, -5.45), coneR: 2.6, y: 7.6, z: -2.5 },
  ];

  // broad warm front fill (no visible cone) so instruments read well
  const fill = new THREE.SpotLight(0xffe8c8, 130, 45, 0.62, 0.9, 1.8);
  fill.position.set(0, 7.5, 14);
  fill.target.position.set(0, 0.8, 0);
  g.add(fill, fill.target);

  for (const s of spots) {
    const head = new THREE.Group();
    const y = s.y ?? 6.62, z = s.z ?? 1.6;
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.3, 12), trussMat);
    head.add(housing);
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.1, 16),
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

    const spot = new THREE.SpotLight(s.color, s.intensity, 30, 0.5, 0.65, 1.6);
    spot.position.set(s.x, y, z);
    spot.target.position.copy(s.target);
    if (s.shadow) {
      spot.castShadow = true;
      const shadowSize = isMobileGameMode() ? 512 : 2048;
      spot.shadow.mapSize.set(shadowSize, shadowSize);
      spot.shadow.bias = -0.0002;
      spot.shadow.normalBias = 0.035;
      spot.shadow.focus = 1;
      spot.shadow.camera.near = 1.5;
      spot.shadow.camera.far = 16;
      spot.shadow.camera.updateProjectionMatrix();
    }
    g.add(spot, spot.target);

    // visible light cone
    const from = new THREE.Vector3(s.x, y, z);
    const len = from.distanceTo(s.target);
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, s.coneR, len, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: s.color, transparent: true, opacity: 0.05,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        depthWrite: false, fog: false,
      })
    );
    cone.position.copy(from).add(s.target).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(s.target, from).normalize();
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    g.add(cone);
  }
  return g;
}

// ---- dust particles ----
function buildDust() {
  const N = 320;
  const pos = new Float32Array(N * 3);
  const meta = [];
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 16;
    pos[i * 3 + 1] = Math.random() * 6.5 + 0.2;
    pos[i * 3 + 2] = Math.random() * 10 - 4.5;
    meta.push({ sp: 0.05 + Math.random() * 0.12, ph: Math.random() * Math.PI * 2, sw: 0.2 + Math.random() * 0.5 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xe8c169, size: 0.035, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.userData.meta = meta;
  return pts;
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

  const denim = new THREE.MeshStandardMaterial({ color: 0x5B82A6, roughness: 0.82 });
  const denimLight = new THREE.MeshStandardMaterial({ color: 0x7fa1bd, roughness: 0.82 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x5a2f22, roughness: 0.88 });
  const green = new THREE.MeshStandardMaterial({ color: 0x008542, roughness: 0.76 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xFFD100, roughness: 0.7 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x233f9d, roughness: 0.72 });
  const red = new THREE.MeshStandardMaterial({ color: 0xb93a3a, roughness: 0.76 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xf2c4a6, roughness: 0.82 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xFDFBF7, roughness: 0.75 });
  const ink = new THREE.MeshStandardMaterial({ color: 0x17121c, roughness: 0.7 });
  const rose = new THREE.MeshStandardMaterial({ color: 0xb86d72, roughness: 0.8 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xd7d9dd, roughness: 0.22, metalness: 0.88 });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.58, 14), cream);
  torso.position.y = 1.08;
  group.add(torso);
  const rightJerseyPanel = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.49, 0.035), blue);
  rightJerseyPanel.position.set(0.135, 1.08, 0.285);
  group.add(rightJerseyPanel);
  for (const y of [0.98, 1.08, 1.18]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.038, 0.04), green);
    stripe.position.set(-0.13, y, 0.29);
    group.add(stripe);
  }
  const shoulderAccent = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.04), red);
  shoulderAccent.position.set(-0.23, 1.28, 0.27);
  group.add(shoulderAccent);
  for (const side of [-1, 1]) {
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.04), yellow);
    collar.position.set(side * 0.07, 1.31, 0.3);
    collar.rotation.z = side * 0.58;
    group.add(collar);
  }
  const waistband = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.028, 7, 22), denim);
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
  for (const x of [-0.255, 0.255]) {
    const lock = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), hairMat);
    lock.scale.set(0.72, 3.3, 0.7);
    lock.position.set(x, -0.28, 0.08);
    head.add(lock);
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

  const makeLimb = (x, y, material, radius, length) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.92, length, 9), material);
    limb.position.y = -length / 2;
    pivot.add(limb);
    group.add(pivot);
    return pivot;
  };

  const armL = makeLimb(-0.34, 1.28, green, 0.085, 0.5);
  const armR = makeLimb(0.34, 1.28, denimLight, 0.105, 0.56);
  armL.rotation.z = -0.12;
  armR.rotation.z = 0.12;
  for (const arm of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), skin);
    hand.position.y = -0.51;
    arm.add(hand);
  }
  const jacketPanel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.62, 0.11), denimLight);
  jacketPanel.position.set(0.38, 0.96, 0.02);
  jacketPanel.rotation.z = -0.08;
  group.add(jacketPanel);
  const legL = makeLimb(-0.15, 0.76, denim, 0.145, 0.64);
  const legR = makeLimb(0.15, 0.76, denim, 0.145, 0.64);

  for (const leg of [legL, legR]) {
    const sneaker = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.16, 0.38), ink);
    sneaker.position.set(0, -0.64, 0.08);
    sneaker.castShadow = true;
    leg.add(sneaker);
    for (const x of [-0.07, 0, 0.07]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.06, 0.012), cream);
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

  return { group, torso, head, armL, armR, legL, legR };
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
mascot.group.scale.setScalar(mascotBaseScale);
// Start close to the visual center and just upstage: drums are first on mobile.
mascot.group.position.set(-0.75, 0, -0.6);
scene.add(mascot.group);
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

// E / ГРАТИ piano phrase — source of truth is piano-notes.json
const PIANO_MELODY_FALLBACK = [
  { note: 'F#4', freqHz: 370.00 },
  { note: 'E4', freqHz: 329.63 },
  { note: 'A4', freqHz: 440.01 },
  { note: 'C#5', freqHz: 554.37 },
  { note: 'C#5', freqHz: 554.37 },
  { note: 'B4', freqHz: 493.89 },
  { note: 'A4', freqHz: 440.01 },
];
let pianoMelody = PIANO_MELODY_FALLBACK;

function normalizePianoMelody(data) {
  if (!Array.isArray(data) || !data.length) return null;
  const notes = data
    .map((entry) => {
      const freqHz = Number(entry?.freqHz);
      if (!Number.isFinite(freqHz) || freqHz <= 0) return null;
      return { note: entry.note || null, freqHz };
    })
    .filter(Boolean);
  return notes.length ? notes : null;
}

function loadPianoMelody() {
  return fetch('piano-notes.json', { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      const notes = normalizePianoMelody(data);
      if (notes) pianoMelody = notes;
    })
    .catch(() => { /* keep fallback */ });
}

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
function addLabels() {
  // Arrow-only marker above the mascot (no "Ти" text).
  mascotLabel = makeMascotPointer();
  mascotLabel.position.set(mascot.group.position.x, MASCOT_LABEL_Y, mascot.group.position.z);
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
const mobileControls = document.getElementById('mobile-controls');
const moveStick = document.getElementById('move-stick');
const moveThumb = document.getElementById('move-thumb');
const mobilePlay = document.getElementById('mobile-play');
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
    approach: [new THREE.Vector3(-1.55, 0, -1.3)],
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
    camera: new THREE.Vector3(-1.55, 1.8, 2.45),
    cameraMobile: new THREE.Vector3(-1.9, 2.14, 3.08),
    target: new THREE.Vector3(0, 0.94, 0.05),
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
  queuedPerformance: null,
};

function setSceneLabelsVisible(visible) {
  if (mascotLabel && !mascotMove.fall) mascotLabel.visible = visible;
}

function setInstrumentViewPhase(phase, kind = instrumentView.kind) {
  instrumentView.phase = phase;
  instrumentView.kind = phase === 'idle' ? null : kind;
  document.documentElement.dataset.instrumentView = phase;
  if (instrumentView.kind) document.documentElement.dataset.instrument = instrumentView.kind;
  else delete document.documentElement.dataset.instrument;
  setSceneLabelsVisible(!['entering', 'focused'].includes(phase));
}

function instrumentLocalToWorld(kind, point) {
  const group = instrumentGroups[kind];
  group.updateWorldMatrix(true, false);
  return group.localToWorld(point.clone());
}

function resetMascotPose() {
  mascot.group.scale.setScalar(mascotBaseScale);
  mascot.group.rotation.x = 0;
  mascot.group.rotation.z = 0;
  mascot.torso.rotation.set(0, 0, 0);
  mascot.head.rotation.set(0, 0, 0);
  mascot.armL.rotation.set(0, 0, -0.12);
  mascot.armR.rotation.set(0, 0, 0.12);
  mascot.legL.rotation.set(0, 0, 0);
  mascot.legR.rotation.set(0, 0, 0);
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
    mascotLabel.position.set(mascot.group.position.x, mascot.group.position.y + MASCOT_LABEL_Y, mascot.group.position.z);
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
  };
}

function restoreInstrumentControlLimits(home = instrumentView.home) {
  if (!home) return;
  controls.minDistance = home.minDistance;
  controls.maxDistance = home.maxDistance;
  controls.minPolarAngle = home.minPolarAngle;
  controls.maxPolarAngle = home.maxPolarAngle;
}

function applyFocusedControlLimits() {
  controls.minDistance = 1.05;
  controls.maxDistance = isMobileGameMode() ? 5.5 : 4.4;
  controls.minPolarAngle = 0.42;
  controls.maxPolarAngle = 1.48;
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
  releaseJoystick();
  poseMascotAtInstrument(kind);
  if (instrumentView.queuedPerformance === kind) {
    instrumentView.queuedPerformance = null;
    playInstrumentPerformance(kind);
  }
  const cameraPoint = isMobileGameMode() && preset.cameraMobile ? preset.cameraMobile : preset.camera;
  startInstrumentCameraTransition(
    'entering',
    kind,
    instrumentLocalToWorld(kind, cameraPoint),
    instrumentLocalToWorld(kind, preset.target),
    0.78,
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
  mascotMove.destinationKind = null;
  mascotMove.waypoints.length = 0;
  if (instrumentView.phase === 'approaching') {
    instrumentView.queuedPerformance = null;
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
  startInstrumentCameraTransition('returning', instrumentView.kind, home.position, home.target, 0.52);
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
  setInstrumentViewPhase('approaching', kind);
  mascotMove.keys.clear();
  releaseJoystick();
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
  zoomScene(0.82);
});
zoomOut.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  zoomScene(1.22);
});

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

function releaseJoystick(event) {
  if (event && joystickPointer !== null && event.pointerId !== joystickPointer) return;
  joystickPointer = null;
  joystickInput.set(0, 0);
  moveStick.classList.remove('engaged');
  moveThumb.style.transform = 'translate(-50%, -50%)';
}

moveStick.addEventListener('pointerdown', (event) => {
  if (!started || ui.modalOpen) return;
  event.preventDefault();
  leaveInstrumentView({ immediate: true });
  controls.autoRotate = false;
  clearTimeout(idleTimer);
  joystickPointer = event.pointerId;
  moveStick.classList.add('engaged');
  moveStick.setPointerCapture?.(event.pointerId);
  setJoystickFromPointer(event);
});
moveStick.addEventListener('pointermove', (event) => {
  if (event.pointerId === joystickPointer) setJoystickFromPointer(event);
});
moveStick.addEventListener('pointerup', releaseJoystick);
moveStick.addEventListener('pointercancel', releaseJoystick);
moveStick.addEventListener('lostpointercapture', releaseJoystick);

function clampMascotPoint(point) {
  point.x = THREE.MathUtils.clamp(point.x, mascotMove.travelBounds.minX, mascotMove.travelBounds.maxX);
  point.z = THREE.MathUtils.clamp(point.z, mascotMove.travelBounds.minZ, mascotMove.travelBounds.maxZ);
  point.y = 0;
  return point;
}

function setMascotDestination(point) {
  if (mascotMove.fall) return;
  leaveInstrumentView();
  mascotMove.destinationKind = null;
  mascotMove.waypoints.length = 0;
  mascotMove.destination = clampMascotPoint(point.clone());
  controls.autoRotate = false;
}

function beginMascotFall(direction) {
  if (mascotMove.fall) return;
  leaveInstrumentView({ immediate: true });
  mascotMove.destination = null;
  mascotMove.destinationKind = null;
  mascotMove.waypoints.length = 0;
  mascotMove.keys.clear();
  releaseJoystick();
  ui.hideChip();
  hideVocalPad();
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
  mascot.group.scale.setScalar(mascotBaseScale);
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
    mascotLabel.position.set(mascotMove.spawn.x, MASCOT_LABEL_Y, mascotMove.spawn.z);
  }
  if (isMobileGameMode()) {
    mobileFollowTarget.set(mascotMove.spawn.x, 1.35, mascotMove.spawn.z - 0.25);
    mobileFollowDelta.subVectors(mobileFollowTarget, controls.target);
    controls.target.add(mobileFollowDelta);
    camera.position.add(mobileFollowDelta);
  }
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

let performanceUntil = 0;

function playInstrumentPerformance(kind) {
  if (performance.now() < performanceUntil) return;
  audio.init();
  audio.resume();
  chipFor(kind);
  if (kind !== 'mic') hideVocalPad();
  mobilePlay.classList.add('performing');

  const later = (delay, fn) => setTimeout(() => {
    if (started && !ui.modalOpen) fn();
  }, delay);
  const finish = (duration) => {
    performanceUntil = performance.now() + duration;
    setTimeout(() => mobilePlay.classList.remove('performing'), duration);
  };

  if (kind === 'drums') {
    const beat = [
      [0, 'kick'], [0, 'hihat'], [240, 'hihat'], [480, 'snare'], [480, 'hihat'],
      [720, 'hihat'], [960, 'kick'], [960, 'hihat'], [1200, 'kick'], [1200, 'hihat'],
      [1440, 'snare'], [1440, 'hihat'], [1680, 'tom2'], [1860, 'floor'], [2040, 'crash'],
    ];
    for (const [delay, part] of beat) later(delay, () => {
      playMusicalEvent({ type: 'drum', part, vel: part === 'hihat' ? 0.78 : 1, vibe: 1.15, showPrice: false });
    });
    navigator.vibrate?.([35, 205, 25, 205, 45]);
    finish(2350);
  } else if (kind === 'piano') {
    const melody = pianoMelody.length ? pianoMelody : PIANO_MELODY_FALLBACK;
    melody.forEach((entry, step) => later(step * 245, () => {
      playMusicalEvent({ type: 'piano', freq: entry.freqHz, vel: 0.82, vibe: 1.35, showPrice: false });
    }));
    finish(Math.max(900, melody.length * 245 + 250));
  } else if (kind === 'guitar') {
    const chords = [
      [130.81, 196.0, 261.63, 329.63, 392.0, 523.25],
      [98.0, 146.83, 196.0, 246.94, 293.66, 392.0],
      [110.0, 164.81, 220.0, 261.63, 329.63, 440.0],
      [87.31, 130.81, 174.61, 220.0, 261.63, 349.23],
    ];
    chords.forEach((chord, step) => later(step * 620, () => {
      playMusicalEvent({ type: 'guitar-strum', freqs: chord, vel: 0.8, vibe: 2.2, showPrice: false });
    }));
    finish(2600);
  } else if (kind === 'mic') {
    showVocalPad();
    const phrase = [
      [261.63, 0], [293.66, 1], [329.63, 2], [392.0, 1],
      [349.23, 0], [329.63, 2], [293.66, 1], [261.63, 0],
    ];
    phrase.forEach(([freq, vowel], step) => later(step * 285, () => {
      playMusicalEvent({ type: 'vocal', freq, vowel, duration: 0.68, vibe: 1.3, showPrice: false, showPad: false });
    }));
    finish(2500);
  }
}

const mobileInstrumentReach = () => 2.36;

function playNearestInstrument({ focus = false } = {}) {
  if (!started || ui.modalOpen || mascotMove.fall) return false;
  const nearest = nearestInstrument();
  if (!nearest || nearest.distance > mobileInstrumentReach()) {
    if (!isMobileGameMode()) ui.toast('Підійди ближче до інструмента', 1800);
    return false;
  }
  const look = new THREE.Vector3().subVectors(nearest.position, mascot.group.position);
  mascot.group.rotation.y = Math.atan2(look.x, look.z);
  if (!focus) {
    playInstrumentPerformance(nearest.kind);
    return true;
  }

  // Unlock audio from the tap itself, then wait for the mascot to reach the instrument.
  audio.init();
  audio.resume();
  const alreadyInPosition = instrumentView.kind === nearest.kind
    && ['entering', 'focused'].includes(instrumentView.phase);
  if (alreadyInPosition) {
    playInstrumentPerformance(nearest.kind);
    return true;
  }
  requestInstrumentView(nearest.kind);
  // `requestInstrumentView` may cancel a previous approach; queue after that reset.
  if (instrumentView.phase === 'approaching' && instrumentView.kind === nearest.kind) {
    instrumentView.queuedPerformance = nearest.kind;
  }
  return true;
}

function updateMobilePlayAvailability() {
  const now = performance.now();
  if (now - updateMobilePlayAvailability.lastCheck < 90) return;
  updateMobilePlayAvailability.lastCheck = now;
  const nearest = started && !ui.modalOpen && !mascotMove.fall ? nearestInstrument() : null;
  const available = Boolean(nearest && nearest.distance <= mobileInstrumentReach());
  mobilePlay.disabled = !available;
  mobilePlayHint.hidden = !started || available;
  mobilePlay.setAttribute('aria-label', available
    ? `Грати на інструменті: ${nearest.kind}`
    : 'Підійди ближче до інструмента щоб заграти');
}
updateMobilePlayAvailability.lastCheck = -Infinity;

mobilePlay.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  if (mobilePlay.disabled) return;
  mobilePlay.classList.add('pressed');
  playNearestInstrument({ focus: true });
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
    mascot.group.scale.setScalar(mascotBaseScale * (1 - fallProgress * 0.24));
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
      mascotLabel.position.set(mascot.group.position.x, mascot.group.position.y + MASCOT_LABEL_Y, mascot.group.position.z);
    }
    if (fall.t >= fall.duration) respawnMascot();
    return;
  }
  if (instrumentView.phase === 'entering' || instrumentView.phase === 'focused' || instrumentView.phase === 'returning') {
    if (mascotLabel) {
      mascotLabel.visible = instrumentView.phase === 'returning';
      if (mascotLabel.visible) {
        mascotLabel.position.set(mascot.group.position.x, mascot.group.position.y + MASCOT_LABEL_Y, mascot.group.position.z);
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

  if (direction.lengthSq() > 0) {
    if (instrumentView.phase === 'approaching') leaveInstrumentView({ immediate: true });
    mascotMove.destination = null;
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

  const walking = direction.lengthSq() > 0;
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

  const stride = walking ? Math.sin(mascotMove.phase) * 0.58 : 0;
  const relax = Math.min(1, dt * 10);
  mascot.legL.rotation.x = THREE.MathUtils.lerp(mascot.legL.rotation.x, stride, relax);
  mascot.legR.rotation.x = THREE.MathUtils.lerp(mascot.legR.rotation.x, -stride, relax);
  mascot.armL.rotation.x = THREE.MathUtils.lerp(mascot.armL.rotation.x, -stride * 0.75, relax);
  mascot.armR.rotation.x = THREE.MathUtils.lerp(mascot.armR.rotation.x, stride * 0.75, relax);
  mascot.group.position.y = walking ? Math.abs(Math.sin(mascotMove.phase * 2)) * 0.035 : 0;
  mascot.torso.rotation.z = walking ? Math.sin(mascotMove.phase) * 0.035 : 0;
  mascot.head.rotation.z = walking ? -Math.sin(mascotMove.phase) * 0.025 : 0;

  if (mascotLabel) {
    const bob = prefersReducedMotion.matches ? 0 : Math.sin(performance.now() * 0.003) * 0.04;
    mascotLabel.position.set(
      mascot.group.position.x,
      mascot.group.position.y + MASCOT_LABEL_Y + bob,
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

function hitInteractableAt(clientX, clientY) {
  pointerNdc(clientX, clientY);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(interactables, false);
  return hits[0]?.object || null;
}

function isMultiTouchInstrumentFocus() {
  return instrumentView.phase === 'focused'
    && (instrumentView.kind === 'piano' || instrumentView.kind === 'drums');
}

function isGuitarPlayFocus() {
  return instrumentView.phase === 'focused' && instrumentView.kind === 'guitar';
}

const GUITAR_STRUM_FREQS = [164.81, 246.94, 329.63, 392.0, 493.88, 659.25];
const GUITAR_STRUM_THRESHOLD = 24;
const GUITAR_STRUM_COOLDOWN = 105;

function fireGuitarStrum(vel = 1) {
  playMusicalEvent({
    type: 'guitar-strum',
    freqs: GUITAR_STRUM_FREQS,
    vel,
    vibe: 5,
  });
}

function playTokenForMesh(mesh) {
  if (!mesh) return null;
  const u = mesh.userData;
  if (u.freq !== undefined) return `piano:${u.freq}`;
  if (u.part) return `drum:${u.part}`;
  return `id:${mesh.id}`;
}

// Track each finger separately so piano chords / drum kits can be played multitouch.
const activePointers = new Map();

canvas.addEventListener('pointerdown', (e) => {
  if (!started || ui.modalOpen || flyT >= 0) return;

  if (isMultiTouchInstrumentFocus()) {
    const mesh = hitInteractableAt(e.clientX, e.clientY);
    if (mesh && mesh.userData.instrument === instrumentView.kind) {
      // Steal this finger from OrbitControls so a second finger can play too.
      e.preventDefault();
      e.stopImmediatePropagation();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      activePointers.set(e.pointerId, {
        mode: 'play',
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
        token: playTokenForMesh(mesh),
      });
      trigger(mesh);
      return;
    }
  }

  {
    const mesh = hitInteractableAt(e.clientX, e.clientY);
    if (mesh && mesh.userData.instrument === 'guitar') {
      // Prefer strum gestures over orbit whenever the finger starts on the guitar.
      e.preventDefault();
      e.stopImmediatePropagation();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      activePointers.set(e.pointerId, {
        mode: 'guitar-strum',
        x: e.clientX,
        y: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        t: performance.now(),
        travel: 0,
        lastStrumAt: 0,
        strummed: false,
        dir: 0,
        hitMesh: mesh,
      });
      return;
    }
  }

  activePointers.set(e.pointerId, {
    mode: 'tap',
    x: e.clientX,
    y: e.clientY,
    t: performance.now(),
  });
}, { capture: true, passive: false });

canvas.addEventListener('pointermove', (e) => {
  const info = activePointers.get(e.pointerId);
  if (!info) return;

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
    const dx = e.clientX - info.lastX;
    const dy = e.clientY - info.lastY;
    info.lastX = e.clientX;
    info.lastY = e.clientY;
    const step = Math.hypot(dx, dy);
    if (step < 0.4) return;

    // Primary axis of this sample — either direction counts as a stroke.
    const primary = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
    const sign = Math.sign(primary) || info.dir || 1;
    if (info.dir && sign !== info.dir) {
      // Reverse swipe starts a fresh stroke immediately.
      info.travel = step;
      info.dir = sign;
    } else {
      info.dir = sign;
      info.travel += step;
    }

    const now = performance.now();
    if (info.travel < GUITAR_STRUM_THRESHOLD || now - info.lastStrumAt < GUITAR_STRUM_COOLDOWN) return;

    const over = hitInteractableAt(e.clientX, e.clientY);
    if (over?.userData.instrument !== 'guitar' && !info.strummed) return;

    const vel = Math.min(1.15, 0.72 + info.travel / 90);
    fireGuitarStrum(vel);
    info.lastStrumAt = now;
    info.travel = 0;
    info.strummed = true;
    if (!isGuitarPlayFocus()) walkMascotToInstrument('guitar');
  }
}, { capture: true, passive: true });

function endActivePointer(e) {
  const info = activePointers.get(e.pointerId);
  activePointers.delete(e.pointerId);
  if (!info) return;

  if (info.mode === 'guitar-strum') {
    if (info.strummed) return;
    const dx = e.clientX - info.x;
    const dy = e.clientY - info.y;
    const dt = performance.now() - info.t;
    const tapTolerance = isMobileGameMode() ? 16 : 8;
    if (Math.hypot(dx, dy) < tapTolerance && dt < 600) {
      const mesh = hitInteractableAt(e.clientX, e.clientY) || info.hitMesh;
      if (mesh) {
        trigger(mesh);
        if (!isGuitarPlayFocus()) walkMascotToInstrument('guitar');
      }
    }
    return;
  }

  if (info.mode !== 'tap') return;
  const dx = e.clientX - info.x;
  const dy = e.clientY - info.y;
  const dt = performance.now() - info.t;
  const tapTolerance = isMobileGameMode() ? 16 : 8;
  if (Math.hypot(dx, dy) < tapTolerance && dt < 600) handleClick(e);
}

canvas.addEventListener('pointerup', endActivePointer, { capture: true });
canvas.addEventListener('pointercancel', (e) => { activePointers.delete(e.pointerId); }, { capture: true });
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
    guitar.pluck(event.stringIndex ?? 0);
    kind = 'guitar';
  } else if (event.type === 'guitar-strum') {
    guitar.strum();
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
  if (record) captureLoopEvent(event);

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
    audio.pluck(event.freq, velocity, startAt);
  } else if (event.type === 'guitar-strum') {
    audio.strum(event.freqs, velocity, startAt);
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
  renderLoopState();
  navigator.vibrate?.(30);
}

function finishBaseLoopRecording(automatic = false) {
  if (loop.state !== 'recording') return;
  finishHeldLoopCapture();
  clearTimeout(loop.autoCloseTimer);
  if (!loop.events.length) {
    loop.state = 'empty';
    loop.duration = 0;
    renderLoopState();
    ui.toast('Зіграй щось під час запису', 1800);
    return;
  }
  const rawDuration = Math.min(LOOP_MAX_SECONDS, Math.max(0, audio.ctx.currentTime - loop.recordStartedAt));
  loop.duration = Math.max(1, Math.ceil(rawDuration / 0.125) * 0.125);
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

loopToggle.addEventListener('click', toggleLoopRecording);
loopPause.addEventListener('click', () => loop.state === 'paused' ? resumeLoop() : pauseLoop());
loopClear.addEventListener('click', clearRecordedLoop);
renderLoopState(false);

// ---- microphone note pad ----
const vocalPad = document.getElementById('vocal-pad');
const vocalButtons = [...vocalPad.querySelectorAll('[data-vocal-freq]')];
let vocalPadTimer = null;
let heldVocal = null;
let heldVocalButton = null;
let heldVocalPointer = null;
let heldVocalPulseTimer = null;
let heldLoopCapture = null;

function beginHeldLoopCapture(freq, vowel) {
  const startedAt = audio.ctx?.currentTime;
  const event = captureLoopEvent({ type: 'vocal', freq, vowel, vel: 1, duration: 0.12 }, startedAt);
  if (event) event.durationPending = true;
  return event ? { event, startedAt, finished: false } : null;
}

function finishHeldLoopCapture() {
  if (!heldLoopCapture || heldLoopCapture.finished) return;
  heldLoopCapture.finished = true;
  const elapsed = Math.max(0.12, (audio.ctx?.currentTime ?? heldLoopCapture.startedAt) - heldLoopCapture.startedAt);
  const maximum = loop.duration > 0 ? Math.max(0.12, loop.duration - 0.06) : LOOP_MAX_SECONDS;
  heldLoopCapture.event.duration = Math.min(maximum, elapsed);
  delete heldLoopCapture.event.durationPending;
  if (loop.duration > 0 && audio.ctx) {
    const currentCycle = Math.floor((audio.ctx.currentTime - loop.epoch) / loop.duration);
    heldLoopCapture.event.playFromCycle = Math.max(heldLoopCapture.event.playFromCycle, currentCycle + 1);
  }
  heldLoopCapture = null;
}

function showVocalPad(autoHide = true) {
  vocalPad.hidden = false;
  clearTimeout(vocalPadTimer);
  if (autoHide) vocalPadTimer = setTimeout(() => { vocalPad.hidden = true; }, 7600);
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
}

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
    heldVocalPulseTimer = setInterval(() => mic.sing(), 480);
    navigator.vibrate?.(16);
  });
  button.addEventListener('pointerup', releaseHeldVocal);
  button.addEventListener('pointercancel', releaseHeldVocal);
  button.addEventListener('lostpointercapture', releaseHeldVocal);
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
      if (u.freq !== undefined) {
        playMusicalEvent({ type: 'piano', freq: u.freq, vel: 1, vibe: 3.5 });
      } else {
        playMusicalEvent({ type: 'piano', freq: 523.25, vel: 0.82, vibe: 3.5 });
      }
      break;
    }
    case 'guitar': {
      if (u.stringFreq !== undefined) {
        playMusicalEvent({ type: 'guitar-pluck', freq: u.stringFreq, stringIndex: u.stringIndex, vel: 1, vibe: 3 });
      } else {
        fireGuitarStrum(1);
      }
      break;
    }
    case 'mic': {
      playVocalNote(u.vocalFreq ?? 329.63, u.vocalVowel ?? 1, true);
      break;
    }
  }
}

function handleClick(e) {
  if (!started || ui.modalOpen || flyT >= 0) return;
  onPointerMove(e);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(interactables, false);
  if (hits.length) {
    const hit = hits[0].object;
    trigger(hit);
    walkMascotToInstrument(hit.userData.instrument);
    return;
  }
  const walkPoint = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(stageWalkPlane, walkPoint)) setMascotDestination(walkPoint);
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') leaveInstrumentView();
  if (!started || ui.modalOpen) return;
  if (e.code.startsWith('Arrow')) {
    e.preventDefault();
    leaveInstrumentView({ immediate: true });
    mascotMove.keys.add(e.code);
  }
  if (e.code === 'KeyE' && !e.repeat) {
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
});

// ---- keyboard ----
const DRUM_KEYS = { KeyA: 'kick', KeyS: 'snare', KeyD: 'hihat', KeyF: 'tom2', KeyG: 'crash' };
window.addEventListener('keydown', (e) => {
  if (!started || ui.modalOpen || e.repeat) return;
  if (e.code in DRUM_KEYS) {
    const part = DRUM_KEYS[e.code];
    playMusicalEvent({ type: 'drum', part, vel: 1, vibe: 4 });
  } else if (/^Digit[1-8]$/.test(e.code)) {
    const idx = Number(e.code.slice(5)) - 1;
    const key = whiteKeys[idx];
    if (key) {
      playMusicalEvent({ type: 'piano', freq: key.userData.freq, vel: 1, vibe: 3.5 });
    }
  } else if (e.code === 'Space') {
    e.preventDefault();
    fireGuitarStrum(1);
  }
});

// ---- sound toggle ----
let muted = false;
ui.el.soundBtn.addEventListener('click', () => {
  muted = !muted;
  audio.setMuted(muted);
  ui.setSoundMuted(muted);
});

// ============================================================
// POST-PROCESSING
// ============================================================
let composer = null;
try {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), isMobileGameMode() ? 0.28 : 0.45, 0.5, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
} catch (e) {
  composer = null;
}

// ============================================================
// INTRO / START FLOW
// ============================================================
let flyT = -1; // -1 = not flying
const FLY_DUR = 2.6;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const enterBtn = document.getElementById('enter-btn');
const enterLabel = document.getElementById('enter-label');
const intro = document.getElementById('intro');

function startExperience(withAudio = true) {
  if (started) return;
  started = true;
  if (withAudio) { audio.init(); audio.resume(); }
  intro.classList.add('gone');
  mobileControls.classList.add('active');
  zoomControls.hidden = false;
  flyT = 0;
}

enterBtn.addEventListener('click', () => startExperience(true));

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
window.addEventListener('resize', () => {
  fitCameraToViewport();
  if (instrumentView.home && instrumentView.phase !== 'idle') {
    instrumentView.home.maxDistance = controls.maxDistance;
  }
  if (instrumentView.phase === 'entering' || instrumentView.phase === 'focused') applyFocusedControlLimits();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer && composer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================
// MAIN LOOP
// ============================================================
const clock = new THREE.Clock();
let firstFrame = true;

function animate() {
  requestAnimationFrame(animate);
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
      if (!isMobileGameMode()) {
        idleTimer = setTimeout(() => {
          if (!ui.modalOpen && instrumentView.phase === 'idle') controls.autoRotate = true;
        }, 6000);
      }
    }
  } else if (!updateInstrumentViewCamera(dt) && controls.enabled) {
    controls.update();
  }

  // instruments
  for (const inst of instruments) inst.update(dt, t);
  updateMascot(dt);
  updateMobilePlayAvailability();

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

  // dust drift
  {
    const p = dust.geometry.attributes.position.array;
    const meta = dust.userData.meta;
    for (let i = 0; i < meta.length; i++) {
      const m = meta[i];
      p[i * 3 + 1] += m.sp * dt;
      p[i * 3] += Math.sin(t * 0.35 + m.ph) * m.sw * dt * 0.35;
      p[i * 3 + 2] += Math.cos(t * 0.28 + m.ph) * m.sw * dt * 0.22;
      if (p[i * 3 + 1] > 7) p[i * 3 + 1] = 0.1;
    }
    dust.geometry.attributes.position.needsUpdate = true;
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
      canvas.style.cursor = hovered ? 'pointer' : '';
    }
  } else {
    if (hovered) { setGlow(hovered, false); hovered = null; }
  }

  fireworks.update(dt);
  updateSlideshow(dt);
  updateSlideshowNavLayout();
  updateLoopProgress();

  if (composer) composer.render();
  else renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    window.__sceneReady = true;
  }
}

// ============================================================
// INIT (wait for fonts so canvas textures look right)
// ============================================================
Promise.race([
  document.fonts ? document.fonts.ready : Promise.resolve(),
  new Promise((r) => setTimeout(r, 3500)),
]).then(() => {
  drums.refreshLogo?.();
  loadSlideTextures().then((photos) => {
    if (photos.length) startSlideshow(photos);
    else window.__dbg = 'no photos loaded';
  }).catch((e) => { window.__dbg = `load err: ${e}`; });
  loadPianoMelody();
  addLabels();
  renderer.compile(scene, camera);
  animate();

  if (params.has('nointro')) {
    started = true;
    intro.classList.add('gone');
    mobileControls.classList.add('active');
    zoomControls.hidden = false;
    camera.position.copy(CAM_END);
    camera.lookAt(TARGET);
    controls.enabled = true;
    ui.showHUD();
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
      if (shot === 'help') ui.el.help.hidden = false;
      else if (shot === 'chip') {
        chipFor('guitar', { force: true });
        clearTimeout(ui._chipTimer);
      }
      else if (shot === 'toast') ui.toast('У студії доступні <span class="hl">вокал, гітара, барабани та фортепіано</span>', 60000);
      else ui.open(shot, params.get('anchor') || undefined);
    }, 400);
  }
});
