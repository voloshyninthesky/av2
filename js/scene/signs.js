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
import {
  registerDimmableEmissive,
  prefersReducedMotion,
  usesLowMobileSceneBudget,
} from '../core/quality.js?v=20260808-03';

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
  // 4×3 rather than a denser grid: the wall is the furthest surface from the
  // camera, so its tags were always the smallest and hardest to read. Fewer,
  // larger ones carry better, and 12 + 25 + 30 is the 67-slot stage.
  cols: 4,
  rows: 3,
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

// Three sign canvases at full size are ~16 MB of VRAM once mipmapped, which
// is real money on a phone that is already on the low budget — and the tier
// scales pixel ratio, shadows and AA but would otherwise leave these alone.
// Half dimensions is a quarter of the memory, and at device pixel ratio 1 the
// tags are still sampled at roughly screen resolution.
const TEXTURE_SCALE = usesLowMobileSceneBudget() ? 0.5 : 1;

function makeSurface(spec) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(spec.canvasW * TEXTURE_SCALE);
  canvas.height = Math.round(spec.canvasH * TEXTURE_SCALE);
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
    // The wall band glows — it reads as a lit sign hanging in the dark. The
    // floor surfaces are paint on boards: enough emissive to stay legible
    // where the spotlights do not reach, not enough to look like neon lying
    // on the stage.
    emissiveIntensity: spec.flat ? 0.3 : 0.85,
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
  const ctx = canvas.getContext('2d');
  // Everything downstream lays tags out in the spec's nominal pixel space, so
  // the tier scaling lives here and nowhere else.
  ctx.scale(TEXTURE_SCALE, TEXTURE_SCALE);
  return { spec, mesh, tex, ctx };
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
  ctx.globalAlpha = alpha * (spec.flat ? 0.86 : 0.92);
  // Only the wall band carries a halo. On the boards a glow reads as light
  // spilling out of the floor; the fade-in still gets a brief one so a fresh
  // sign announces itself.
  if (!spec.flat || alpha < 1) {
    ctx.shadowColor = color;
    ctx.shadowBlur = size * (spec.flat ? (1 - alpha) * 0.6 : 0.5 + (1 - alpha) * 0.7);
  }
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

/**
 * Redraw the sign surfaces. `onlyKey` restricts the work to one of them,
 * which matters more than it looks: marking a texture `needsUpdate` re-uploads
 * it, so repainting all three to animate one fading tag pushed ~16 MB per
 * frame across the bus for no reason.
 */
function repaint(onlyKey = null) {
  if (!surfaces) return;
  const touched = onlyKey ? [surfaces[onlyKey]] : Object.values(surfaces);
  for (const surface of touched) {
    surface.ctx.clearRect(0, 0, surface.spec.canvasW, surface.spec.canvasH);
  }
  const used = new Set();
  for (const [slot, sign] of slotAssignments()) {
    const key = placementForSlot(slot).spec.key;
    used.add(key);
    if (onlyKey && key !== onlyKey) continue;
    const alpha = appearing && appearing.id === sign.id
      ? appearing.t * appearing.t * (3 - 2 * appearing.t)
      : 1;
    drawSign(slot, sign, alpha);
  }
  for (const surface of touched) {
    surface.mesh.visible = used.has(surface.spec.key);
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
  const before = signs.length;
  signs.push(sign);
  signs = signs.slice(-TOTAL_SLOTS);
  if (!surfaces) return;
  const place = placementForSlot(
    Number.isInteger(sign.slot) && sign.slot >= 0 && sign.slot < TOTAL_SLOTS ? sign.slot : 0,
  );
  const key = place?.spec.key ?? null;
  // The fade is a flourish, and it costs a texture upload every third frame.
  // Devices on the low budget get the sign immediately instead — the same
  // trade reduced motion already makes.
  appearing = prefersReducedMotion.matches || usesLowMobileSceneBudget()
    ? null
    : { id: sign.id, t: 0, key };
  fadeFrame = 0;
  // Nothing was pushed off the end, so no other surface can have changed.
  repaint(signs.length > before ? key : null);
}

/** Advances the fade-in of a freshly left sign; a no-op the rest of the time. */
export function updateSigns(dt) {
  if (!appearing) return;
  appearing.t = Math.min(1, appearing.t + dt / FADE_S);
  const done = appearing.t >= 1;
  const key = appearing.key;
  if (done) appearing = null;
  // Repainting means re-uploading a texture, so do it on every third frame and
  // only for the surface the new tag landed on. At this speed it reads the same.
  fadeFrame += 1;
  if (done || fadeFrame % FADE_REPAINT_EVERY === 0) repaint(key);
}

/** Full redraw — called once fonts settle so tags don't keep a fallback face. */
export function repaintSigns() {
  if (surfaces) repaint();
}
