// ============================================================
// SIGNS — «знаки на сцені»
// Transparent canvas-texture surfaces where visitors' short signs render as
// glowing marker tags. They fill in order: the band on the back wall under
// the screen frame, then the floor strip downstage of the instruments, then
// the mid-stage boards the drum kit and piano stand on. Built empty and
// invisible at studio assembly; js/shell/signs.js populates them only after
// the storage probe succeeds, so an unreachable store leaves the stage
// looking exactly as it does without the feature.
// ============================================================
import * as THREE from 'three';
import { registerDimmableEmissive, prefersReducedMotion } from '../core/quality.js?v=20260807-04';

// Render hexes for the curated color ids a sign may carry. Brighter than
// the brand ink-on-cream palette on purpose: these glow against 0x15091f.
export const SIGN_COLORS = {
  cream: '#FDFBF7',
  gold: '#E8B54C',
  purple: '#C87BFF',
  pink: '#FF7CC3',
  mint: '#6FE7C0',
};

// Back-wall band (wall plane z=-5.85): below the brand plate (bottom
// y≈2.35), above the platform top (y=0), inside the upstage curtain legs
// (|x|≈4.4). The star drop sits at z=-5.8, so -5.78 floats clear of both.
const WALL = {
  key: 'wall',
  w: 8.1,
  h: 1.95,
  pos: new THREE.Vector3(0, 1.32, -5.78),
  canvasW: 2048,
  canvasH: 492,
  cols: 5,
  rows: 4,
  maxRot: 0.12,
  shuffleSeed: 0xa11ce,
};
// Front-apron strip, downstage of the instruments: the guitar stand
// (-1.35, 1.75) and mic (1.0, 2.4) rise out of it. Clear of the monitor
// wedges (±2.35, 3.42) and the front trim (z 4.02).
const FRONT = {
  key: 'front',
  flat: true,
  w: 9.4,
  h: 2.7,
  pos: new THREE.Vector3(0, 0.012, 1.9), // Z 0.55 … 3.25
  canvasW: 2048,
  canvasH: 588,
  cols: 5,
  rows: 5,
  maxRot: 0.3,
  shuffleSeed: 0xf10a7,
};
// The mid-stage boards between the back wall and that strip — the widest
// bare patch on the platform, and the one the drum kit (-2.8, -1.7) and
// piano (3.5, -1.3) stand on. Signs run under them: a kit parked on top of
// old graffiti is how a real stage looks. Wider than the front strip
// because it sits further from the camera, where the frame opens out.
const MID = {
  key: 'mid',
  flat: true,
  w: 10.2,
  h: 4.05,
  pos: new THREE.Vector3(0, 0.012, -1.475), // Z -3.5 … 0.55
  canvasW: 1536,
  canvasH: 610,
  cols: 5,
  rows: 6,
  maxRot: 0.3,
  shuffleSeed: 0x5ca1e,
};

// Fill order, and it is the whole seating plan: wall, then the strip the
// visitor is standing on, then the boards behind it.
const SURFACES = [WALL, FRONT, MID];
export const WALL_SLOTS = WALL.cols * WALL.rows;
export const TOTAL_SLOTS = SURFACES.reduce((n, s) => n + s.cols * s.rows, 0);

const FADE_S = 0.9; // fade-in of a freshly left sign
const FADE_REPAINT_EVERY = 3; // texture re-uploads are the cost — skip frames

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledOrder(count, seed) {
  const order = Array.from({ length: count }, (_, i) => i);
  const rng = mulberry32(seed);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

const ORDERS = Object.fromEntries(
  SURFACES.map((spec) => [spec.key, shuffledOrder(spec.cols * spec.rows, spec.shuffleSeed)]),
);

/** Which surface a slot lives on, and which grid cell inside it. The
 *  shuffle scatters consecutive ids so a busy evening does not paint one
 *  tidy line across the boards. */
function placementForSlot(slot) {
  let base = 0;
  for (const spec of SURFACES) {
    const count = spec.cols * spec.rows;
    if (slot < base + count) return { spec, cell: ORDERS[spec.key][slot - base] };
    base += count;
  }
  return null;
}

function makeSurface(spec) {
  const canvas = document.createElement('canvas');
  canvas.width = spec.canvasW;
  canvas.height = spec.canvasH;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // Emissive-driven like the footlights, so the Світло fader dims the tags
  // with the rest of the stage instead of leaving them hovering in the dark.
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    roughness: 1,
    emissive: 0xffffff,
    emissiveMap: tex,
    emissiveIntensity: 0.85,
    // A surface lying on the boards has to win against the contact shadows
    // already painted there; one standing on the wall does not.
    ...(spec.flat ? {
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    } : {}),
  });
  registerDimmableEmissive(mat);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.h), mat);
  mesh.position.copy(spec.pos);
  mesh.visible = false;
  if (spec.flat) {
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 1; // above the contact shadows on the boards
  }
  return { spec, mesh, tex, ctx: canvas.getContext('2d') };
}

let surfaces = null;
let signs = [];
/** Fade-in state of the sign just left from this device, or null. */
let appearing = null;
let fadeFrame = 0;

export function buildSigns() {
  surfaces = {};
  const group = new THREE.Group();
  for (const spec of SURFACES) {
    const surface = makeSurface(spec);
    surfaces[spec.key] = surface;
    group.add(surface.mesh);
  }
  return group;
}

/** The slot a new sign takes: the lowest free one, so the surfaces fill in
 *  the declared order. Returns null only if the stage is full, which the
 *  caller prevents by retiring the oldest sign first. */
export function chooseSlot(usedSlots) {
  for (let slot = 0; slot < TOTAL_SLOTS; slot++) {
    if (!usedSlots.has(slot)) return slot;
  }
  return null;
}

// A sign's slot is chosen once, at creation, and stored with it, so it
// stays where it was put. The derived fallback plus probe below only
// covers legacy or hand-tampered rows with no valid slot — honest data
// never collides, and the probe keeps even dishonest data deterministic.
function slotAssignments() {
  const taken = new Map();
  for (const sign of signs) {
    let slot = Number.isInteger(sign.slot) && sign.slot >= 0 && sign.slot < TOTAL_SLOTS
      ? sign.slot
      : (((sign.id - 1) % TOTAL_SLOTS) + TOTAL_SLOTS) % TOTAL_SLOTS;
    for (let i = 0; i < TOTAL_SLOTS && taken.has(slot); i++) slot = (slot + 1) % TOTAL_SLOTS;
    taken.set(slot, sign);
  }
  return taken;
}

function drawSign(slot, sign, alpha) {
  const { spec, cell } = placementForSlot(slot);
  const { ctx } = surfaces[spec.key];
  const cellW = spec.canvasW / spec.cols;
  const cellH = spec.canvasH / spec.rows;
  const rng = mulberry32(Math.imul(sign.id, 0x9e3779b9));
  const cx = ((cell % spec.cols) + 0.5) * cellW + (rng() - 0.5) * cellW * 0.18;
  const cy = (Math.floor(cell / spec.cols) + 0.5) * cellH + (rng() - 0.5) * cellH * 0.22;
  const rot = (rng() - 0.5) * spec.maxRot;
  const base = 50 * (0.85 + rng() * 0.3);
  const flourish = rng() < 0.35;
  const color = SIGN_COLORS[sign.color] || SIGN_COLORS.cream;

  ctx.save();
  ctx.font = `700 ${base}px "Unbounded", "Manrope", sans-serif`;
  const fit = Math.min(1, (cellW * 0.92) / Math.max(1, ctx.measureText(sign.text).width));
  const size = base * fit;
  ctx.font = `700 ${size}px "Unbounded", "Manrope", sans-serif`;
  // Edge slots plus jitter can push a long tag past the canvas, where it
  // would clip to a hard cut — pull the center back inside the surface.
  const half = ctx.measureText(sign.text).width / 2 + size * 0.4;
  ctx.translate(
    Math.min(Math.max(cx, half), spec.canvasW - half),
    Math.min(Math.max(cy, size * 0.8), spec.canvasH - size * 1.1),
  );
  ctx.rotate(rot);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = alpha * 0.92;
  ctx.shadowColor = color;
  ctx.shadowBlur = size * (0.5 + (1 - alpha) * 0.7);
  ctx.fillStyle = color;
  ctx.fillText(sign.text, 0, 0);
  if (flourish) {
    const w = ctx.measureText(sign.text).width * 0.5;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, size * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w, size * 0.62);
    ctx.quadraticCurveTo(0, size * 0.78, w * 1.05, size * 0.58);
    ctx.stroke();
  }
  ctx.restore();
}

function repaint() {
  if (!surfaces) return;
  for (const surface of Object.values(surfaces)) {
    surface.ctx.clearRect(0, 0, surface.spec.canvasW, surface.spec.canvasH);
  }
  const used = new Set();
  for (const [slot, sign] of slotAssignments()) {
    const alpha = appearing && appearing.id === sign.id
      ? appearing.t * appearing.t * (3 - 2 * appearing.t)
      : 1;
    drawSign(slot, sign, alpha);
    used.add(placementForSlot(slot).spec.key);
  }
  for (const [key, surface] of Object.entries(surfaces)) {
    surface.mesh.visible = used.has(key);
    surface.tex.needsUpdate = true;
  }
}

export function setSigns(list) {
  signs = [...list]
    .filter((s) => s && typeof s.text === 'string' && Number.isInteger(s.id))
    .sort((a, b) => a.id - b.id)
    .slice(-TOTAL_SLOTS);
  if (surfaces) repaint();
}

export function addSign(sign) {
  signs.push(sign);
  signs = signs.slice(-TOTAL_SLOTS);
  if (!surfaces) return;
  appearing = prefersReducedMotion.matches ? null : { id: sign.id, t: 0 };
  fadeFrame = 0;
  repaint();
}

/** Advances the fade-in of a freshly left sign; a no-op the rest of the time. */
export function updateSigns(dt) {
  if (!appearing) return;
  appearing.t = Math.min(1, appearing.t + dt / FADE_S);
  const done = appearing.t >= 1;
  if (done) appearing = null;
  // Repainting means re-uploading a 2048-wide texture — every third frame
  // reads identically at this speed.
  fadeFrame += 1;
  if (done || fadeFrame % FADE_REPAINT_EVERY === 0) repaint();
}

/** Full redraw — called once fonts settle so tags don't keep a fallback face. */
export function repaintSigns() {
  if (surfaces) repaint();
}
