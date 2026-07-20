// ============================================================
// ART VIBE STUDIO — interactive 3D stage
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { AudioEngine } from './audio.js';
import { buildDrumKit, buildPiano, buildGuitar, buildMic } from './instruments.js';
import { UI } from './ui.js';

// ---- error collector (debug / headless testing) ----
const errlog = document.getElementById('errlog');
window.addEventListener('error', (e) => { errlog.textContent += `ERR: ${e.message} @ ${e.filename}:${e.lineno}\n`; });
window.addEventListener('unhandledrejection', (e) => { errlog.textContent += `REJ: ${e.reason}\n`; });

const params = new URLSearchParams(location.search);
const ui = new UI();
const audio = new AudioEngine();

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
const CAM_END = new THREE.Vector3(0, 3.1, 11.2);
const TARGET = new THREE.Vector3(0, 1.45, -0.3);

function fitCameraToViewport() {
  const portrait = window.innerWidth / window.innerHeight < 1;
  if (portrait) {
    CAM_START.set(0, 10.5, 23);
    CAM_END.set(0, 4.2, 17.4);
    camera.fov = 68;
    controls.maxDistance = 26;
  } else {
    CAM_START.set(0, 9.5, 18.5);
    CAM_END.set(0, 3.1, 11.2);
    camera.fov = 55;
    controls.maxDistance = 16;
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
controls.maxDistance = 16;
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
  x.fillStyle = '#7a5433';
  x.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 8; row++) {
    const y0 = row * 64;
    const shade = 0.88 + Math.random() * 0.24;
    x.fillStyle = `rgb(${122 * shade | 0},${84 * shade | 0},${51 * shade | 0})`;
    x.fillRect(0, y0, 512, 64);
    x.strokeStyle = 'rgba(40,22,10,.8)';
    x.lineWidth = 3;
    x.strokeRect(-2, y0, 516, 64);
    // grain
    x.strokeStyle = 'rgba(60,35,15,.25)';
    x.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      x.beginPath();
      const gy = y0 + 8 + Math.random() * 48;
      x.moveTo(0, gy);
      x.bezierCurveTo(150, gy + Math.random() * 8 - 4, 350, gy + Math.random() * 8 - 4, 512, gy);
      x.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 2);
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

function bannerTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#160a20';
  x.fillRect(0, 0, 1024, 256);
  x.strokeStyle = '#D1A13B';
  x.lineWidth = 5;
  x.strokeRect(14, 14, 996, 228);
  x.strokeStyle = 'rgba(209,161,59,.4)';
  x.lineWidth = 2;
  x.strokeRect(26, 26, 972, 204);
  x.textAlign = 'center';
  x.fillStyle = '#D1A13B';
  x.shadowColor = '#9E33CA';
  x.shadowBlur = 34;
  x.font = 'italic 900 118px "Playfair Display", Georgia, serif';
  x.fillText('ART VIBE', 512, 138);
  x.shadowBlur = 12;
  x.fillStyle = '#c988f0';
  x.font = '500 44px "Unbounded", sans-serif';
  x.fillText('S T U D I O', 512, 208);
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

  // footlights
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0x332211, emissive: 0xD1A13B, emissiveIntensity: 1.6, roughness: 0.5,
  });
  const bulbGeom = new THREE.SphereGeometry(0.05, 10, 8);
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(bulbGeom, bulbMat);
    b.position.set(-6 + i * 1.5, 0.06, 3.9);
    g.add(b);
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
  const curtMat = new THREE.MeshStandardMaterial({ map: curt, roughness: 0.9 });
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 9.4), curtMat);
    c.position.set(s * 7.9, 4.1, -3.9);
    c.rotation.y = -s * 0.3;
    g.add(c);
  }
  const valance = new THREE.Mesh(new THREE.PlaneGeometry(19.5, 1.7), curtMat.clone());
  valance.position.set(0, 8.15, -4.1);
  g.add(valance);
  const valanceTrim = new THREE.Mesh(
    new THREE.BoxGeometry(19.5, 0.09, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xD1A13B, metalness: 0.8, roughness: 0.35 })
  );
  valanceTrim.position.set(0, 7.32, -4.06);
  g.add(valanceTrim);

  // ART VIBE banner
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(7.6, 1.9),
    new THREE.MeshBasicMaterial({ map: bannerTexture(), fog: false })
  );
  banner.position.set(0, 5.4, -5.5);
  g.add(banner);

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

// ---- truss + spotlights + visible cones ----
const spotHeads = [];
function buildLights() {
  const g = new THREE.Group();
  g.add(new THREE.AmbientLight(0x584a74, 1.15));

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
    { x: 0, color: 0x7a1fa2, intensity: 550, target: new THREE.Vector3(0, 4.6, -5.4), coneR: 2.6, y: 7.6, z: -2.5 },
  ];

  // broad warm front fill (no visible cone) so instruments read well
  const fill = new THREE.SpotLight(0xffe8c8, 130, 45, 0.62, 1.0, 1.8);
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
      spot.shadow.mapSize.set(1024, 1024);
      spot.shadow.bias = -0.0004;
      spot.shadow.camera.near = 2;
      spot.shadow.camera.far = 20;
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
function addLabels() {
  for (const inst of instruments) {
    const spr = makeLabel(inst.label);
    const anchor = inst.labelAnchor.clone();
    inst.group.localToWorld(anchor);
    spr.position.copy(anchor);
    spr.userData.baseY = anchor.y;
    spr.userData.ph = Math.random() * Math.PI * 2;
    scene.add(spr);
    labels.push(spr);
  }
}

// ============================================================
// INTERACTION
// ============================================================
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-10, -10);
let pointerClient = { x: 0, y: 0 };
let hovered = null;
let started = false;

const INSTRUMENT_STYLE = {
  drums: { glow: 0x9E33CA, tip: 'УДАРНІ <em>клік — бити · A S D F G</em>' },
  piano: { glow: 0xD1A13B, tip: 'ПІАНІНО <em>клік по клавішах · 1–8</em>' },
  guitar: { glow: 0xD1A13B, tip: 'ГІТАРА <em>клік — акорд · ПРОБІЛ</em>' },
  mic: { glow: 0x9E33CA, tip: 'ВОКАЛ <em>клік — чек 1-2</em>' },
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
  pointerClient = { x: e.clientX, y: e.clientY };
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

let downInfo = null;
canvas.addEventListener('pointerdown', (e) => {
  downInfo = { x: e.clientX, y: e.clientY, t: performance.now() };
});
canvas.addEventListener('pointerup', (e) => {
  if (!downInfo) return;
  const dx = e.clientX - downInfo.x, dy = e.clientY - downInfo.y;
  const dt = performance.now() - downInfo.t;
  downInfo = null;
  if (Math.hypot(dx, dy) < 8 && dt < 600) handleClick(e);
});
window.addEventListener('pointermove', onPointerMove, { passive: true });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---- vibe ----
let vibe = 0, lastVibeAdd = 0, vibeCooldown = 0;
function addVibe(n) {
  vibe = Math.min(100, vibe + n);
  lastVibeAdd = performance.now();
  ui.setVibe(vibe);
  if (vibe >= 100 && performance.now() > vibeCooldown) {
    vibeCooldown = performance.now() + 4000;
    const spots = [new THREE.Vector3(-2, 4.6, 0), new THREE.Vector3(2.2, 5.2, -1), new THREE.Vector3(0, 5.6, 1)];
    spots.forEach((p, i) => setTimeout(() => fireworks.spawn(p), i * 260));
    ui.toast('МАКСИМАЛЬНИЙ ВАЙБ! <span class="hl">Сцена — твоя</span>', 4200);
    vibe = 55;
    setTimeout(() => ui.setVibe(vibe), 600);
  }
}

// ---- chip content ----
let drumsToastShown = false;
function chipFor(kind) {
  if (ui.modalOpen) return;
  if (kind === 'guitar') {
    ui.showChip(
      'ГІТАРА <span class="accent">· від 190 зл</span>',
      'абонементи 30 / 45 / 55 хв — 4, 6 або 8 уроків',
      'ЦІНИ ›', () => ui.open('pricing', 'guitar'));
  } else if (kind === 'mic') {
    ui.showChip(
      'ВОКАЛ <span class="accent">· від 190 зл</span>',
      'абонементи 30 / 45 / 55 хв — 4, 6 або 8 уроків',
      'ЦІНИ ›', () => ui.open('pricing', 'vocal'));
  } else if (kind === 'drums' && !drumsToastShown) {
    drumsToastShown = true;
    ui.toast('Ударні — чисто для душі. У розкладі студії — <span class="hl">вокал і гітара</span>', 4200);
  }
}

// ---- trigger instruments ----
function trigger(mesh) {
  const u = mesh.userData;
  audio.resume();
  switch (u.instrument) {
    case 'drums': {
      const part = u.part;
      drums.hit(part);
      addVibe(4);
      chipFor('drums');
      if (part === 'kick') audio.kick();
      else if (part === 'snare') audio.snare();
      else if (part === 'hihat') audio.hihat(false);
      else if (part === 'crash') audio.crash();
      else if (part === 'tom1') audio.tom(150);
      else if (part === 'tom2') audio.tom(120);
      else if (part === 'floor') audio.tom(95);
      break;
    }
    case 'piano': {
      if (u.freq !== undefined) {
        piano.press(mesh);
        audio.piano(u.freq);
        addVibe(3.5);
      }
      break;
    }
    case 'guitar': {
      guitar.strum();
      // Em9 strum
      audio.strum([164.81, 246.94, 329.63, 392.0, 493.88, 659.25]);
      addVibe(7);
      chipFor('guitar');
      break;
    }
    case 'mic': {
      mic.sing();
      audio.micCheck();
      addVibe(6);
      chipFor('mic');
      break;
    }
  }
}

function handleClick(e) {
  if (!started || ui.modalOpen) return;
  onPointerMove(e);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(interactables, false);
  if (hits.length) trigger(hits[0].object);
}

// ---- keyboard ----
const DRUM_KEYS = { KeyA: 'kick', KeyS: 'snare', KeyD: 'hihat', KeyF: 'tom2', KeyG: 'crash' };
window.addEventListener('keydown', (e) => {
  if (!started || ui.modalOpen || e.repeat) return;
  if (e.code in DRUM_KEYS) {
    const part = DRUM_KEYS[e.code];
    drums.hit(part);
    audio.resume();
    addVibe(4);
    chipFor('drums');
    if (part === 'kick') audio.kick();
    else if (part === 'snare') audio.snare();
    else if (part === 'hihat') audio.hihat(false);
    else if (part === 'crash') audio.crash();
    else audio.tom(120);
  } else if (/^Digit[1-8]$/.test(e.code)) {
    const idx = Number(e.code.slice(5)) - 1;
    const key = whiteKeys[idx];
    if (key) {
      piano.press(key);
      audio.resume();
      audio.piano(key.userData.freq);
      addVibe(3.5);
    }
  } else if (e.code === 'Space') {
    e.preventDefault();
    guitar.strum();
    audio.resume();
    audio.strum([164.81, 246.94, 329.63, 392.0, 493.88, 659.25]);
    addVibe(7);
    chipFor('guitar');
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
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.5, 0.85);
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
  idleTimer = setTimeout(() => { if (!ui.modalOpen) controls.autoRotate = true; }, 9000);
});

// ticker
(() => {
  const unit = 'СЦЕНА • МУЗИКА • ВАЙБ • УКРАЇНСЬКА МОВА • ВОКАЛ • ГІТАРА • ';
  document.getElementById('ticker-track').textContent = unit.repeat(8);
})();

// ============================================================
// RESIZE
// ============================================================
window.addEventListener('resize', () => {
  fitCameraToViewport();
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
      idleTimer = setTimeout(() => { if (!ui.modalOpen) controls.autoRotate = true; }, 6000);
    }
  } else if (controls.enabled) {
    controls.update();
  }

  // instruments
  for (const inst of instruments) inst.update(dt, t);

  // labels bob
  for (const spr of labels) {
    spr.position.y = spr.userData.baseY + Math.sin(t * 1.4 + spr.userData.ph) * 0.07;
  }

  // dust drift
  {
    const p = dust.geometry.attributes.position.array;
    const meta = dust.userData.meta;
    for (let i = 0; i < meta.length; i++) {
      const m = meta[i];
      p[i * 3 + 1] += m.sp * dt;
      p[i * 3] += Math.sin(t * m.sw + m.ph) * dt * 0.06;
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
  if (started && !ui.modalOpen) {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(interactables, false);
    const hit = hits.length ? hits[0].object : null;
    if (hit !== hovered) {
      if (hovered) setGlow(hovered, false);
      hovered = hit;
      if (hovered) setGlow(hovered, true);
      canvas.style.cursor = hovered ? 'pointer' : '';
    }
    if (hovered) {
      ui.setTooltip(INSTRUMENT_STYLE[hovered.userData.instrument].tip, pointerClient.x, pointerClient.y);
    } else {
      ui.setTooltip(null);
    }
  } else {
    if (hovered) { setGlow(hovered, false); hovered = null; }
    ui.setTooltip(null);
  }

  fireworks.update(dt);

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
  addLabels();
  renderer.compile(scene, camera);
  animate();

  if (params.has('nointro')) {
    started = true;
    intro.classList.add('gone');
    camera.position.copy(CAM_END);
    camera.lookAt(TARGET);
    controls.enabled = true;
    ui.showHUD();
  } else {
    enterBtn.disabled = false;
    enterBtn.classList.add('ready');
    enterLabel.textContent = 'УВІЙТИ НА СЦЕНУ ›';
  }

  if (params.has('autoenter')) {
    setTimeout(() => startExperience(false), 300);
  }

  const shot = params.get('shot');
  if (shot) {
    setTimeout(() => {
      if (shot === 'help') ui.el.help.hidden = false;
      else if (shot === 'chip') {
        ui.showChip('ГІТАРА <span class="accent">· від 190 зл</span>', 'абонементи 30 / 45 / 55 хв — 4, 6 або 8 уроків', 'ЦІНИ ›', () => {});
        clearTimeout(ui._chipTimer);
      }
      else if (shot === 'toast') ui.toast('Ударні — чисто для душі. У розкладі студії — <span class="hl">вокал і гітара</span>', 60000);
      else ui.open(shot, params.get('anchor') || undefined);
    }, 400);
  }
});
