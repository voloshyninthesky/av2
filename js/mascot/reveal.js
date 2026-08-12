// ============================================================
// MASCOT GIFT — THE REVEAL (ПОДАРУНОК modal)
// An egg lands in the spotlight, rocks and strains for a few seconds, then
// cracks open along its seam to reveal the character the visitor was given. The suspense is the point:
// nothing about the drawn look is legible until the glow takes the tier's
// colour, late in the strain.
//
// Replaces the old dressing-room editor and inherits its camera machinery —
// measuring a safe screen rectangle and framing the subject inside it is the
// same problem whether the subject is a mascot being dressed or an egg about to
// hatch.
//
// The whole ceremony is procedural, driven from main.js's single frame loop.
// Three.js's AnimationMixer was considered and declined: the anticipation is a
// frequency sweep (sin(t·ω) with ω itself ramping), which keyframes can only
// approximate by baking, and the beats that carry the moment — fireworks, the
// footlight pulse, the audio schedule, the config swap — are discrete events
// rather than tracks. See notes/Decisions.md.
// ============================================================
import * as THREE from 'three';
import { session, easeInOut } from '../core/session.js?v=20260813-07';
import { prefersReducedMotion, params } from '../core/quality.js?v=20260813-07';
import { trackOnce } from '../core/analytics.js?v=20260813-07';
import { camera, controls, CAM_END, TARGET } from '../view/rig.js?v=20260813-07';
import {
  ui, mascot, mascotLabel, audio, fireworks, giftEgg,
  applyMascotConfig, applyMascotScale,
} from '../core/studio.js?v=20260813-07';
import { bumpHitPulse } from '../scene/effects.js?v=20260813-07';
import { instrumentView } from '../view/instrument-presets.js?v=20260813-07';
import { leaveInstrumentView } from '../view/instrument-view.js?v=20260813-07';
import { resetMascotPose, setDancing } from './pose.js?v=20260813-07';
import { mascotMove } from './state.js?v=20260813-07';
import {
  validateMascotAppearance, mascotCfg, saveMascotConfig, hasSavedMascot,
} from './appearance.js?v=20260813-07';
import { drawMascotGift, GIFT_TIERS_BY_ID } from './gift.js?v=20260813-07';

// Opening the gift borrows the camera and has to quiet whatever else was using
// it. The bloom pass lives in shell/, above this module, so main.js injects it
// rather than this file importing upward.
let hooks = {
  respawnMascot: () => {},
  markOnboardSeen: () => {},
  syncInstrumentExposure: () => {},
  setBloomStrength: () => {},
  bloomBaseStrength: () => null,
};
export function initMascotGift(next) {
  hooks = { ...hooks, ...next };
}

const giftModal = document.getElementById('modal-gift');
const giftStageZone = document.getElementById('gift-stage-zone');
const giftCard = giftModal?.querySelector('.gift-card');
const giftStatus = document.getElementById('gift-status');
const giftTierLabel = document.getElementById('gift-tier');
const giftLead = document.getElementById('gift-lead');
const giftDoneButton = document.getElementById('gift-keep');

// ---- timeline ----
// Beats are in ceremony seconds. Everything up to the burst is fixed except the
// strain, which is the tier's own anticipation length.
const T_FLY_END = 0.90;
const T_SETTLE_END = 1.25;
const T_CARD_AFTER_BURST = 0.55;
const T_POSE_AFTER_BURST = 1.40;
// One ceremony for everyone, pitched at what used to be the legendary version.
// A visitor receives exactly one gift, ever: tuning the spectacle down for a
// common roll would mean most people never see the good version of the only
// reveal they will ever get. The tier is carried by the glow colour and the
// card, not by how much show you are allowed.
const STRAIN = 3.8;
const WOBBLE_AMP = 0.14;
const WOBBLE_OMEGA = 30;
const THUMPS = 5;
const BURSTS = 5;
const BLOOM_RAMP = 0.48;
const HIT_PULSE = 1.35;
const T_LANDING = 0.45;
const T_SHELL_FADE = 0.25;
const T_LID_FLIGHT = 0.60;
// A skip that fires on the same tap that opened the gift would eat the whole
// ceremony; the visitor has to have seen something first.
const SKIP_GRACE = 0.40;
const ARM_REST_Z = 0.12;
const ARM_RAISED_Z = 2.2;

const easeOutBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

export const giftReveal = {
  active: false,
  phase: 'idle', // idle | fly | settle | strain | pose | card | held
  t: 0,
  rate: 1,
  tier: null,
  cfg: null,
  bursted: false,
  cardShown: false,
  preplaced: false,
  posePushed: false,
  wobblePhase: 0,
  lidVelocity: 0,
  bloomBase: null,
  burstTimes: [],
  burstIndex: 0,
  openingYaw: 0,
  baseYaw: 0,
  previewAngle: 0,
  dragPointer: null,
  dragStartX: 0,
  dragStartAngle: 0,
  refitFrame: 0,
  viewDirection: new THREE.Vector3(0, 0, 1),
};

// Camera framing while the ПОДАРУНОК modal is open. Same shape the editor's
// tween used, so main.js's frame-loop branch is unchanged apart from the name.
export const giftCam = {
  active: false, returning: false, framed: false, t: 0,
  fromPos: new THREE.Vector3(), fromTgt: new THREE.Vector3(),
  toPos: new THREE.Vector3(), toTgt: new THREE.Vector3(),
};

// Scratch objects — the ceremony runs every frame and must not allocate.
const scratchBounds = new THREE.Box3();
const scratchMeshBounds = new THREE.Box3();
const scratchSize = new THREE.Vector3();
const scratchCenter = new THREE.Vector3();
const scratchEye = new THREE.Vector3();
const scratchPos = new THREE.Vector3();
const scratchTarget = new THREE.Vector3();
const scratchRight = new THREE.Vector3();
const scratchUp = new THREE.Vector3();
const scratchBurstOrigin = new THREE.Vector3();
const scratchFramePos = new THREE.Vector3();
const scratchFrameTgt = new THREE.Vector3();
const COLOR_NEUTRAL = new THREE.Color(0xFDFBF7);
const COLOR_TIER = new THREE.Color();

// `?gift=<tier>` pins the draw and `?giftfast` replays the same timeline fast;
// both are testhooks-only and never reachable for a visitor.
let forcedTier = null;
export function forceGiftTier(tierId) {
  forcedTier = GIFT_TIERS_BY_ID[tierId] ? tierId : null;
}
const qaEnabled = params.has('testhooks');
if (qaEnabled && params.get('gift')) forceGiftTier(params.get('gift'));

// Whether this visitor is still owed their one gift. Decided once at boot,
// because the fly-in starts rendering long before startOnboard() runs: without
// this the visitor would watch the *default* mascot stand on stage for the whole
// 2.6 s approach and then be swapped for an egg, which gives away that the
// character was never theirs to begin with.
export const giftPending = !params.has('skiponboard') && !hasSavedMascot();

// Called from main.js once the labels exist, still before the first frame.
export function prepareGiftStage() {
  if (!giftPending) return;
  mascot.group.visible = false;
  if (mascotLabel) mascotLabel.visible = false;
  giftReveal.preplaced = true;
  // Reset the shell too, not just the group: the lid, the body scale and the
  // glow all live on after a ceremony, and showing the egg without clearing them
  // would present a half-hatched shell as if it were sealed.
  resetEggVisuals();
  giftEgg.group.position.copy(mascot.group.position);
  giftEgg.group.visible = true;
  // Lock the viewing angle now, from where the approach ends, and keep it for
  // the ceremony. Recomputing it later from the live camera would shift the
  // framing and show up as a jolt exactly when the ceremony takes over.
  giftReveal.viewDirection.copy(CAM_END).sub(TARGET);
  giftReveal.viewDirection.y = 0;
  if (giftReveal.viewDirection.lengthSq() < 0.01) giftReveal.viewDirection.set(0, 0, 1);
  giftReveal.viewDirection.normalize();
  giftReveal.baseYaw = Math.atan2(giftReveal.viewDirection.x, giftReveal.viewDirection.z);
  giftApproach.ok = computeGiftFraming(giftEgg.group, giftApproach.pos, giftApproach.tgt);
}

// Where the intro fly-in should end so the ceremony can pick the camera up
// without moving it. Resolved once in prepareGiftStage(); the approach reads it
// every frame and must not recompute (giftSafeRect() measures the DOM).
const giftApproach = { ok: false, pos: new THREE.Vector3(), tgt: new THREE.Vector3() };
export function giftApproachFraming(outPos, outTgt) {
  if (!giftPending) return false;
  // Retried until it lands rather than resolved once: a viewport still settling
  // at boot reports 0×0, and a single failed attempt would strand the approach
  // on the default framing — which is precisely the camera jolt this exists to
  // remove. computeGiftFraming() bails before touching the DOM while the
  // viewport is degenerate, so retrying costs nothing until it can succeed.
  if (!giftApproach.ok) {
    giftApproach.ok = computeGiftFraming(giftEgg.group, giftApproach.pos, giftApproach.tgt);
  }
  if (!giftApproach.ok) return false;
  outPos.copy(giftApproach.pos);
  outTgt.copy(giftApproach.tgt);
  return true;
}

function ceremonyRate() {
  if (qaEnabled && params.has('giftfast')) return 40;
  if (prefersReducedMotion.matches) return 5;
  return 1;
}

function strainEndTime() {
  return T_SETTLE_END + STRAIN;
}

function ceremonyEndTime() {
  return strainEndTime() + Math.max(T_CARD_AFTER_BURST, T_POSE_AFTER_BURST);
}

export function isGiftCeremonyRunning() {
  return giftReveal.active && giftReveal.phase !== 'held' && giftReveal.phase !== 'idle';
}

// ---- camera framing (ported from the dressing-room editor) ----
function startGiftCam(toPos, toTgt, returning) {
  giftCam.fromPos.copy(camera.position);
  giftCam.fromTgt.copy(controls.target);
  giftCam.toPos.copy(toPos);
  giftCam.toTgt.copy(toTgt);
  giftCam.t = 0;
  giftCam.returning = returning;
  giftCam.active = true;
}

const isFiniteVector = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

function visibleObjectBounds(root) {
  scratchBounds.makeEmpty();
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
    scratchMeshBounds.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
    scratchBounds.union(scratchMeshBounds);
  });
  return scratchBounds;
}

// The largest free quadrant left over once the HUD and the reveal card are
// accounted for — the subject is framed inside it so the card never covers it.
function giftSafeRect() {
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
  const cardRect = giftCard && !giftCard.hidden ? giftCard.getBoundingClientRect() : null;
  if (!cardRect || !cardRect.width) {
    return { left: viewport.left + 12, top, right: viewport.right - 12, bottom: viewport.bottom - 12 };
  }
  const gap = 14;
  const candidates = [
    { left: viewport.left + 12, top, right: cardRect.left - gap, bottom: viewport.bottom - 12 },
    { left: cardRect.right + gap, top, right: viewport.right - 12, bottom: viewport.bottom - 12 },
    { left: viewport.left + 12, top, right: viewport.right - 12, bottom: cardRect.top - gap },
    { left: viewport.left + 12, top: cardRect.bottom + gap, right: viewport.right - 12, bottom: viewport.bottom - 12 },
  ].filter((rect) => rect.right - rect.left >= 120 && rect.bottom - rect.top >= 120);
  if (!candidates.length) {
    return { left: viewport.left + 12, top, right: viewport.right - 12, bottom: viewport.bottom - 12 };
  }
  return candidates.sort((a, b) =>
    ((b.right - b.left) * (b.bottom - b.top)) - ((a.right - a.left) * (a.bottom - a.top)))[0];
}

function positionGiftStageZone(rect) {
  if (!giftStageZone) return;
  giftStageZone.style.left = `${rect.left}px`;
  giftStageZone.style.top = `${rect.top}px`;
  giftStageZone.style.width = `${rect.right - rect.left}px`;
  giftStageZone.style.height = `${rect.bottom - rect.top}px`;
}

// Splits the framing maths out of the tween so the intro approach can land on
// exactly the pose the ceremony would have tweened to — no angle change when the
// ceremony takes the camera.
function computeGiftFraming(root, outPos, outTgt) {
  if (!root) return false;
  // A backgrounded or mid-transition viewport can report 0×0, which makes
  // camera.aspect NaN and every distance below infinite. That would latch into
  // camera.position permanently — a black canvas with no error in the console
  // (notes/Gotchas.md). Skip the refit; the resize that follows re-runs it.
  if (!window.innerWidth || !window.innerHeight || !Number.isFinite(camera.aspect)) return false;
  const safeRect = giftSafeRect();
  positionGiftStageZone(safeRect);
  const bounds = visibleObjectBounds(root);
  if (bounds.isEmpty()) return false;
  bounds.getSize(scratchSize);
  bounds.getCenter(scratchCenter);
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
  const distanceX = (scratchSize.x * 0.5) / (tanHalfH * ndcHalfX);
  const distanceY = (scratchSize.y * 0.5) / (tanHalfV * ndcHalfY);
  // Clamped to the orbit minimum, not just to a nice-looking number: this pose
  // is handed straight to OrbitControls when the gift closes, and anything
  // nearer makes it clamp on its first update — the camera lurching outward a
  // frame after ГОТОВО. Framing that the controls cannot hold is not framing.
  const distance = Math.max(
    controls.minDistance + 0.05,
    Math.max(1.35, distanceX, distanceY) * 1.12 + scratchSize.z * 0.55,
  );
  scratchEye.copy(giftReveal.viewDirection);
  scratchEye.y = 0.12;
  scratchEye.normalize();
  scratchPos.copy(scratchCenter).addScaledVector(scratchEye, distance);
  scratchTarget.copy(scratchCenter);
  scratchRight.crossVectors(camera.up, scratchEye).normalize();
  scratchUp.crossVectors(scratchEye, scratchRight).normalize();
  const desiredNdcX = (safeCenterX / viewportWidth) * 2 - 1;
  const desiredNdcY = 1 - (safeCenterY / viewportHeight) * 2;
  const halfHeight = distance * tanHalfV;
  const halfWidth = halfHeight * camera.aspect;
  // Aim beside / below the subject to place it inside the safe rectangle rather
  // than translating the camera, which would drop it below the stage top.
  scratchTarget
    .addScaledVector(scratchRight, -desiredNdcX * halfWidth)
    .addScaledVector(scratchUp, -desiredNdcY * halfHeight);
  // Last line of defence: a degenerate bound or a zero-length view direction
  // would otherwise hand NaN straight to the tween.
  if (!isFiniteVector(scratchPos) || !isFiniteVector(scratchTarget)) return false;
  outPos.copy(scratchPos);
  outTgt.copy(scratchTarget);
  return true;
}

function frameGiftSubject(root) {
  if (!giftReveal.active) return;
  if (computeGiftFraming(root, scratchFramePos, scratchFrameTgt)) {
    startGiftCam(scratchFramePos, scratchFrameTgt, false);
  }
}

function currentSubject() {
  return giftReveal.bursted ? mascot.group : giftEgg.group;
}

export function queueGiftRefit() {
  if (!giftReveal.active || giftReveal.refitFrame) return;
  giftReveal.refitFrame = requestAnimationFrame(() => {
    giftReveal.refitFrame = 0;
    frameGiftSubject(currentSubject());
  });
}

// ---- audio ----
// Scheduled once, in absolute AudioContext time, so the fanfare never drifts
// with frame pacing. With no context (the silent onboarding gift) there is
// nothing to schedule and every synth call would no-op anyway.
// Percussion only — no melody. A pitched line turns the hatch into a jingle and
// competes with whatever the visitor is about to play; the knocking from inside
// the shell is the whole point, and the crash is the payoff.
function scheduleGiftAudio() {
  const ctx = audio.ctx;
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const strainStart = T_SETTLE_END / giftReveal.rate;
  const strainLength = STRAIN / giftReveal.rate;
  for (let i = 0; i < THUMPS; i++) {
    const at = t0 + strainStart + (strainLength * (i + 1)) / (THUMPS + 1);
    audio.tom(78 + i * 14, 0.55, at);
  }
  audio.crash(1.0, t0 + (T_SETTLE_END + STRAIN) / giftReveal.rate);
}

// ---- ceremony ----
function resetEggVisuals() {
  const { group, body, lid, glow, mats, lidRestY } = giftEgg;
  // A pre-placed egg has been on stage through the whole fly-in; scaling it back
  // to nothing so the ceremony can pop it in would read as a glitch.
  group.scale.setScalar(giftReveal.preplaced ? 1 : 0.001);
  group.rotation.set(0, 0, 0);
  group.position.y = 0;
  group.visible = true;
  body.scale.setScalar(1);
  glow.visible = true;
  lid.position.set(0, lidRestY, 0);
  lid.rotation.set(0, 0, 0);
  lid.visible = true;
  mats.glow.opacity = 0;
  mats.glow.color.copy(COLOR_NEUTRAL);
}

// `?gift=<tier>` has to produce a look genuinely from the requested tier, not
// relabel whatever was drawn. Every tier is reachable, so rejection-sampling
// terminates in a handful of draws.
function drawGift() {
  if (!forcedTier) return drawMascotGift();
  for (let attempt = 0; attempt < 500; attempt++) {
    const drawn = drawMascotGift();
    if (drawn.tier.id === forcedTier) return drawn;
  }
  return drawMascotGift();
}

function beginPull() {
  const drawn = drawGift();
  giftReveal.tier = drawn.tier;
  giftReveal.cfg = drawn.cfg;
  giftReveal.t = 0;
  giftReveal.rate = ceremonyRate();
  giftReveal.phase = 'fly';
  giftReveal.bursted = false;
  giftReveal.cardShown = false;
  giftReveal.posePushed = false;
  giftReveal.wobblePhase = 0;
  giftReveal.lidVelocity = 0;
  giftReveal.burstIndex = 0;
  COLOR_TIER.setHex(giftReveal.tier.accent);

  if (giftCard) giftCard.hidden = true;
  if (giftStatus) giftStatus.textContent = 'Відкриваємо подарунок…';
  mascot.group.visible = false;
  giftEgg.group.position.copy(mascot.group.position);
  resetEggVisuals();
  // Captured before the ramp starts, so an abandoned ceremony can put it back.
  if (giftReveal.bloomBase === null) giftReveal.bloomBase = hooks.bloomBaseStrength();
  scheduleGiftAudio();
  frameGiftSubject(giftEgg.group);
}

function beginGiftCeremony() {
  if (instrumentView.phase !== 'idle') leaveInstrumentView({ immediate: true, offerPriceChip: false });
  if (mascotMove.fall) hooks.respawnMascot();
  setDancing(false);
  resetMascotPose();
  // The instruments deliberately stay visible. The editor hid them because its
  // preview filled the frame; the egg stands downstage in its own spotlight with
  // the band behind it, so hiding them only produces a pop on the exact frame
  // the approach hands over — the seam this whole framing exists to smooth.
  if (mascotLabel) mascotLabel.visible = false;
  controls.autoRotate = false;
  giftReveal.active = true;
  document.documentElement.classList.add('gift-open');
  giftReveal.openingYaw = mascot.group.rotation.y;
  giftReveal.previewAngle = 0;
  // Pre-placed: prepareGiftStage() already locked the angle the approach flew to.
  if (!giftReveal.preplaced) {
    giftReveal.viewDirection.copy(camera.position).sub(controls.target);
    giftReveal.viewDirection.y = 0;
    if (giftReveal.viewDirection.lengthSq() < 0.01) giftReveal.viewDirection.set(0, 0, 1);
    giftReveal.viewDirection.normalize();
    giftReveal.baseYaw = Math.atan2(giftReveal.viewDirection.x, giftReveal.viewDirection.z);
  }
  mascot.group.rotation.y = giftReveal.baseYaw;
  giftCam.framed = true;
  controls.enabled = false;
  // Never unlocks audio: the gift only ever opens from the camera fly-in, which
  // is not a user gesture, and silence before a real sound action is a standing
  // rule (notes/Gotchas.md). scheduleGiftAudio() therefore finds no context and
  // no-ops — the ceremony is silent by design.
  trackOnce('stage-gift-open');
  beginPull();
}

function fireBurst() {
  giftReveal.bursted = true;
  giftReveal.phase = 'pose';
  giftReveal.lidVelocity = 2.6;

  // The character becomes real here: validated, applied, and written to storage
  // in the same frame the visitor first sees it.
  Object.assign(mascotCfg, validateMascotAppearance(giftReveal.cfg));
  applyMascotConfig();
  saveMascotConfig();
  mascot.group.visible = true;
  applyMascotScale(0.35);

  scratchBurstOrigin.copy(giftEgg.group.position);
  scratchBurstOrigin.y += giftEgg.topY;
  giftReveal.burstTimes.length = 0;
  const bursts = prefersReducedMotion.matches ? 1 : BURSTS;
  for (let i = 0; i < bursts; i++) giftReveal.burstTimes.push(i * 0.09);
  giftReveal.burstIndex = 0;
  bumpHitPulse(HIT_PULSE);
  if (giftReveal.bloomBase !== null && !prefersReducedMotion.matches) {
    hooks.setBloomStrength(giftReveal.bloomBase + BLOOM_RAMP * 2.2);
  }
  trackOnce(`stage-gift-${giftReveal.tier.id}`);
}

function showGiftCard() {
  giftReveal.cardShown = true;
  giftReveal.phase = 'card';
  const tier = giftReveal.tier;
  if (giftCard) {
    giftCard.dataset.tier = tier.id;
    giftCard.hidden = false;
  }
  if (giftTierLabel) giftTierLabel.textContent = tier.name;
  // The card is the first run's only text, so the announcement carries the whole
  // of it — the introduction and what the visitor can do next.
  if (giftStatus) {
    giftStatus.textContent = `Знайомся, це Вайбер ${tier.name}. ${giftLead?.textContent ?? ''}`.trim();
  }
  giftDoneButton?.focus();
}

// Everything the ceremony would have done by its last frame, applied at once.
// Used by the skip gesture and by any path that has to land the pull early.
function applyCeremonyEndState() {
  if (!giftReveal.bursted) fireBurst();
  giftReveal.burstIndex = giftReveal.burstTimes.length;
  giftEgg.group.visible = false;
  mascot.group.visible = true;
  applyMascotScale(1);
  mascot.armL.rotation.z = -ARM_REST_Z;
  mascot.armR.rotation.z = ARM_REST_Z;
  mascot.group.rotation.y = giftReveal.baseYaw + giftReveal.previewAngle;
  if (giftReveal.bloomBase !== null) hooks.setBloomStrength(giftReveal.bloomBase);
  giftReveal.t = ceremonyEndTime();
  if (!giftReveal.cardShown) showGiftCard();
  giftReveal.phase = 'held';
  queueGiftRefit();
}

export function skipGiftCeremony() {
  if (!giftReveal.active || giftReveal.phase === 'held') return;
  if (giftReveal.t < SKIP_GRACE) return;
  applyCeremonyEndState();
}

// Relaxes whatever pose the mascot arrived in back to a neutral stand. The
// reveal owns the mascot for the whole ceremony, so update.js steps aside.
function relaxMascotToStanding(dt) {
  const relax = Math.min(1, dt * 10);
  mascot.legL.rotation.x = THREE.MathUtils.lerp(mascot.legL.rotation.x, 0, relax);
  mascot.legR.rotation.x = THREE.MathUtils.lerp(mascot.legR.rotation.x, 0, relax);
  mascot.armL.rotation.x = THREE.MathUtils.lerp(mascot.armL.rotation.x, 0, relax);
  mascot.armR.rotation.x = THREE.MathUtils.lerp(mascot.armR.rotation.x, 0, relax);
  mascot.armL.rotation.z = THREE.MathUtils.lerp(mascot.armL.rotation.z, -ARM_REST_Z, relax);
  mascot.armR.rotation.z = THREE.MathUtils.lerp(mascot.armR.rotation.z, ARM_REST_Z, relax);
  mascot.torso.rotation.z = THREE.MathUtils.lerp(mascot.torso.rotation.z, 0, relax);
  mascot.head.rotation.z = THREE.MathUtils.lerp(mascot.head.rotation.z, 0, relax);
  mascot.group.position.y = THREE.MathUtils.lerp(mascot.group.position.y, 0, relax);
}

function updateStrain(progress) {
  const { group, lid, mats, lidRestY } = giftEgg;
  const amp = WOBBLE_AMP * progress;
  group.rotation.z = Math.sin(giftReveal.wobblePhase) * amp;
  group.position.y = Math.abs(Math.sin(giftReveal.wobblePhase * 2)) * 0.02 * progress;
  // The cap lifts off the jagged seam so the glow leaks out through the crack.
  lid.position.y = lidRestY + progress * 0.05 + Math.sin(giftReveal.wobblePhase * 1.7) * 0.008 * progress;
  mats.glow.opacity = progress;
  // The tier's colour only leaks out late — early enough to build, late enough
  // that it lands as a payoff rather than a spoiler.
  const tint = Math.max(0, (progress - 0.6) / 0.4);
  mats.glow.color.copy(COLOR_NEUTRAL).lerp(COLOR_TIER, tint);
  if (giftReveal.bloomBase !== null) {
    hooks.setBloomStrength(giftReveal.bloomBase + BLOOM_RAMP * progress);
  }
}

function updateAfterBurst(sinceBurst, scaledDt) {
  const { group, body, lid, glow } = giftEgg;

  // The cap arcs away; the lower shell shrinks out behind it.
  if (sinceBurst < T_LID_FLIGHT) {
    giftReveal.lidVelocity -= 6.2 * scaledDt;
    lid.position.y += giftReveal.lidVelocity * scaledDt;
    lid.rotation.x += 3.4 * scaledDt;
    lid.rotation.z += 1.1 * scaledDt;
  } else {
    lid.visible = false;
  }
  const fade = Math.min(1, sinceBurst / T_SHELL_FADE);
  body.scale.setScalar(Math.max(0.001, 1 - fade));
  glow.visible = false;
  if (fade >= 1 && sinceBurst >= T_LID_FLIGHT) group.visible = false;

  // Landing pop — through applyMascotScale, so it rides on top of the drawn
  // height/build rather than fighting it.
  if (sinceBurst < T_LANDING) {
    applyMascotScale(THREE.MathUtils.lerp(0.35, 1, easeOutBack(sinceBurst / T_LANDING)));
  } else {
    applyMascotScale(1);
  }

  if (giftReveal.bloomBase !== null) {
    const decay = Math.min(1, sinceBurst / 0.9);
    hooks.setBloomStrength(giftReveal.bloomBase + BLOOM_RAMP * 2.2 * (1 - decay));
  }

  // Arms up, hold, relax. Suppressed under reduced motion, where the card and
  // the accent colour carry the tier instead.
  if (!prefersReducedMotion.matches) {
    let raise = 0;
    if (sinceBurst >= 0.10 && sinceBurst < 0.35) raise = (sinceBurst - 0.10) / 0.25;
    else if (sinceBurst < 0.75) raise = 1;
    else if (sinceBurst < 1.15) raise = 1 - (sinceBurst - 0.75) / 0.4;
    mascot.armL.rotation.z = THREE.MathUtils.lerp(-ARM_REST_Z, -ARM_RAISED_Z, raise);
    mascot.armR.rotation.z = THREE.MathUtils.lerp(ARM_REST_Z, ARM_RAISED_Z, raise);
    const spin = Math.min(1, sinceBurst / T_POSE_AFTER_BURST);
    mascot.group.rotation.y = giftReveal.baseYaw + easeInOut(spin) * Math.PI * 2;
  }
}

export function updateGiftReveal(dt) {
  if (!giftReveal.active) return;
  if (giftReveal.phase === 'held') {
    relaxMascotToStanding(dt);
    return;
  }
  const scaledDt = dt * giftReveal.rate;
  giftReveal.t += scaledDt;
  const t = giftReveal.t;
  const burstAt = strainEndTime();

  if (!giftReveal.bursted) {
    if (t < T_FLY_END) {
      giftReveal.phase = 'fly';
      if (!giftReveal.preplaced) {
        giftEgg.group.scale.setScalar(Math.max(0.001, easeOutBack(t / T_FLY_END)));
      }
    } else if (t < T_SETTLE_END) {
      giftReveal.phase = 'settle';
      giftEgg.group.scale.setScalar(1);
    } else {
      giftReveal.phase = 'strain';
      giftEgg.group.scale.setScalar(1);
      const progress = Math.min(1, (t - T_SETTLE_END) / STRAIN);
      // Phase is integrated rather than evaluated as sin(t·ω): ω itself ramps,
      // and evaluating it directly would jump the phase every frame.
      if (!prefersReducedMotion.matches) {
        const omega = 4 + (WOBBLE_OMEGA - 4) * progress;
        giftReveal.wobblePhase += omega * scaledDt;
      }
      updateStrain(progress);
    }
    if (t >= burstAt) fireBurst();
  }

  if (giftReveal.bursted) {
    const sinceBurst = t - burstAt;
    // Fireworks are drained against the ceremony clock — setTimeout clamps to
    // ~1 Hz in a hidden tab and would strand the whole burst.
    while (giftReveal.burstIndex < giftReveal.burstTimes.length
      && sinceBurst >= giftReveal.burstTimes[giftReveal.burstIndex]) {
      fireworks.spawn(scratchBurstOrigin);
      giftReveal.burstIndex += 1;
    }
    updateAfterBurst(sinceBurst, scaledDt);
    // One push from the box frame onto the revealed character; re-firing it
    // every frame the tween happened to be idle would fight the drag handler.
    if (!giftReveal.posePushed && sinceBurst >= 0.10) {
      giftReveal.posePushed = true;
      frameGiftSubject(mascot.group);
    }
    if (!giftReveal.cardShown && sinceBurst >= T_CARD_AFTER_BURST) showGiftCard();
    if (t >= ceremonyEndTime()) {
      applyMascotScale(1);
      giftReveal.phase = 'held';
      giftEgg.group.visible = false;
    }
  }
}

function endGiftCeremony() {
  if (!giftReveal.active) return;
  if (giftReveal.refitFrame) cancelAnimationFrame(giftReveal.refitFrame);
  giftReveal.refitFrame = 0;
  giftReveal.active = false;
  giftReveal.phase = 'idle';
  document.documentElement.classList.remove('gift-open');
  giftReveal.dragPointer = null;
  // Only the first-run egg is pre-placed by prepareGiftStage(); a gift that
  // follows a fall has to pop in like any other, so retire the flag with the
  // ceremony that earned it.
  giftReveal.preplaced = false;
  giftEgg.group.visible = false;
  // A ceremony abandoned mid-ramp would otherwise leave the stage permanently
  // over-bloomed.
  if (giftReveal.bloomBase !== null) hooks.setBloomStrength(giftReveal.bloomBase);
  giftReveal.bloomBase = null;
  // Nothing was written before the burst, so backing out early simply leaves
  // the visitor with the look they arrived with.
  mascot.group.visible = true;
  applyMascotScale(1);
  resetMascotPose();
  mascot.group.rotation.y = giftReveal.openingYaw;
  hooks.syncInstrumentExposure();
  if (mascotLabel) mascotLabel.visible = true;
  giftCam.framed = false;
  // The reveal offsets controls.target so the character sits beside the card,
  // and that offset tips the camera past controls.maxPolarAngle — OrbitControls
  // swings it back on its first update, which is the lurch after ГОТОВО. With
  // the card gone there is nothing to sit beside, so ease the target onto the
  // character: it re-centres them and lands inside every orbit limit, leaving
  // the controls nothing to correct. The camera itself does not move.
  const subject = visibleObjectBounds(mascot.group);
  if (!subject.isEmpty()) {
    subject.getCenter(scratchFrameTgt);
    startGiftCam(camera.position, scratchFrameTgt, true);
  } else {
    giftCam.active = false;
    controls.enabled = true;
  }
  if (giftCard) giftCard.hidden = true;
}

// ---- input ----
// The card carries the onboarding text, so ЗРОЗУМІЛО is the same acknowledgement
// the standalone tip used to collect — it has to satisfy the same gate, or the
// tip would appear again on the next visit saying what this card just said.
giftDoneButton?.addEventListener('click', () => hooks.markOnboardSeen());
// A tap anywhere on the overlay skips ahead. The card's own controls stop
// propagation so pressing ГОТОВО is never also a skip.
giftModal?.addEventListener('click', (event) => {
  if (giftCard && !giftCard.hidden && giftCard.contains(event.target)) return;
  skipGiftCeremony();
});
giftModal?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (document.activeElement && document.activeElement !== giftModal) return;
  event.preventDefault();
  skipGiftCeremony();
});
giftCard?.addEventListener('click', (event) => event.stopPropagation());

giftStageZone?.addEventListener('pointerdown', (event) => {
  if (!giftReveal.active) return;
  event.preventDefault();
  giftReveal.dragPointer = event.pointerId;
  giftReveal.dragStartX = event.clientX;
  giftReveal.dragStartAngle = giftReveal.previewAngle;
  giftStageZone.setPointerCapture?.(event.pointerId);
});
giftStageZone?.addEventListener('pointermove', (event) => {
  if (event.pointerId !== giftReveal.dragPointer) return;
  // Spinning the character you were just given is the one editor interaction
  // that still earns its place. Session-only: never persisted.
  const delta = event.clientX - giftReveal.dragStartX;
  giftReveal.previewAngle = giftReveal.dragStartAngle + delta * 0.012;
  if (giftReveal.phase === 'held') {
    mascot.group.rotation.y = giftReveal.baseYaw + giftReveal.previewAngle;
  }
});
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  giftStageZone?.addEventListener(eventName, (event) => {
    if (event.pointerId === giftReveal.dragPointer) giftReveal.dragPointer = null;
  });
}
giftCard?.addEventListener('animationend', () => {
  if (giftReveal.active) queueGiftRefit();
});

window.addEventListener('av2:modal', (event) => {
  if (event.detail?.name !== 'gift' || !session.started) return;
  if (event.detail.open) beginGiftCeremony();
  else endGiftCeremony();
});
