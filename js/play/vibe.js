// ============================================================
// VIBE METER + PRICE CHIPS
// The reward loop: playing raises the meter, filling it once unlocks the loop
// pedal and sets off fireworks. Price chips ride on the same signal but are
// deliberately quiet — one per instrument, queued by playing it or by simply
// reaching its close-up, and shown only once the visitor has left the focus or
// stopped playing long enough to read one.
// ============================================================
import * as THREE from 'three';
import { ui, audio, fireworks, mascot } from '../core/studio.js?v=20260813-08';
import { loadPrices, pricesNow, lowestSinglePrice } from '../core/prices.js?v=20260813-08';
import { bumpHitPulse } from '../scene/effects.js?v=20260813-08';
import { instrumentView } from '../view/instrument-presets.js?v=20260813-08';
import { play, keyboardPianoNotes } from './state.js?v=20260813-08';
import { trackOnce } from '../core/analytics.js?v=20260813-08';

const loopPedal = document.getElementById('loop-pedal');
const loopStatus = document.getElementById('loop-status');
const loopKeyHint = document.getElementById('loop-key-hint');

// Filling the meter opens more than the loop pedal now, and the other things
// it opens live above this module. main.js injects them rather than this
// importing upward — see AGENTS.md on keeping the module graph a tree.
let hooks = { onFirstFill: () => {} };
export function initVibe(next) {
  hooks = { ...hooks, ...next };
}

// ---- vibe ----

export function unlockLoopPedal() {
  if (play.loopUnlocked) return false;
  play.loopUnlocked = true;
  loopPedal.hidden = false;
  loopKeyHint.hidden = false;
  loopPedal.classList.remove('unlocking');
  void loopPedal.offsetWidth;
  loopPedal.classList.add('unlocking');
  loopStatus.textContent = 'Loop-педаль відкрито';
  return true;
}

// ---- praise ----
// Short, warm, and never twice in a row: the same word repeating reads as a
// canned response rather than someone reacting to what you just played.
const PRAISE = ['Супер!', 'Потужно!', 'Клас!'];
let lastPraise = -1;
function praiseWord() {
  let index = Math.floor(Math.random() * PRAISE.length);
  if (index === lastPraise) index = (index + 1) % PRAISE.length;
  lastPraise = index;
  return PRAISE[index];
}

/**
 * Cheer as the meter passes 12 / 40 / 60 %. The meter is the thing the visitor
 * is actually filling, so praise tied to it lands as progress on that bar
 * rather than as a reaction to one note. 12 comes early — a few notes in, while
 * they are still deciding whether this is worth their time; 40 and 60 mark a
 * bar that is visibly moving. Three cheers, then silence until the fill speaks
 * for itself — praise that keeps arriving stops meaning anything.
 *
 * The marker only moves forward, so the idle decay can walk the meter back
 * across a threshold without buying a second cheer for the same ground. When
 * one note crosses two marks, they collapse into a single cheer rather than
 * stacking.
 *
 * Yields to a toast already on screen rather than replacing it: anything else
 * the stage chose to say carries more than a cheer does. A cheer swallowed
 * that way is retried on the next note instead of being spent, so no milestone
 * is lost to a collision. (Price chips live in `#chip`, a separate element, and
 * are unaffected either way.)
 */
const PRAISE_AT = [12, 40, 60];
let praisedThrough = -1;
function praiseAtMilestone(vibe) {
  let reached = praisedThrough;
  while (reached + 1 < PRAISE_AT.length && vibe >= PRAISE_AT[reached + 1]) reached += 1;
  if (reached === praisedThrough) return;
  if (!ui.el.toast.hidden) return;
  praisedThrough = reached;
  ui.toast(praiseWord(), 1500);
}

/**
 * How much of a note's nominal vibe actually lands. The per-event weights in
 * the play modules (drums 4, guitar 5, piano 3.5…) are *relative* values worth
 * keeping as they are; this one number sets how long a full meter takes, so
 * retuning the reward loop never means editing eight call sites.
 */
export const VIBE_NOTE_GAIN = 0.7;

export function addVibe(n) {
  trackOnce('stage-first-play');
  // Filling is a one-way door: the meter stays at 100 for the rest of the
  // visit rather than settling back and being re-earned. So this fires exactly
  // once — no cooldown needed to throttle repeat celebrations, and the idle
  // decay in main.js stands down (see `play.vibeFull`).
  if (play.vibeFull) return;
  play.vibe = Math.min(100, play.vibe + n * VIBE_NOTE_GAIN);
  play.lastVibeAdd = performance.now();
  ui.setVibe(play.vibe);
  if (play.vibe < 100) {
    praiseAtMilestone(play.vibe);
    return;
  }

  play.vibeFull = true;
  unlockLoopPedal();
  // Everything the first fill opens arrives at once: the loop pedal, and the
  // sign button where the storage is up. The toast stays deliberately vague
  // about what "more" is — the controls appearing say it better than a list.
  hooks.onFirstFill();
  const spots = [new THREE.Vector3(-2, 4.6, 0), new THREE.Vector3(2.2, 5.2, -1), new THREE.Vector3(0, 5.6, 1)];
  spots.forEach((p, i) => setTimeout(() => fireworks.spawn(p), i * 260));
  bumpHitPulse(1.35);
  ui.toast('Максимальний вайб! Тепер ти можеш більше.', 4200, 'vibe-max');
}

// ---- price carousel ----
// The icon carries the instrument; each slide quotes that instrument's own
// cheapest single lesson, straight out of prices.json.
export const PRICE_SLIDES = [
  { kind: 'mic', icon: '🎤', anchor: 'vocal' },
  { kind: 'guitar', icon: '🎸', anchor: 'guitar' },
  { kind: 'drums', icon: '🥁', anchor: 'drums' },
  { kind: 'piano', icon: '🎹', anchor: 'piano' },
];
const shownPriceChips = new Set();
const pendingPriceChips = new Set();
let chipAwaitingPrices = null;

// However a shown chip ends — read, ignored, swiped away, or timed out on its
// own 8 s — it bought the visitor's attention once already. Nothing else
// queues on top of it for a while, so a visitor who quickly samples several
// instruments gets one nudge at a time rather than a chip every focus.
const CHIP_COOLDOWN_MS = 3 * 60_000;
let lastChipShownAt = -Infinity;

// The chip reads as one line — «🎸 Уроки [ВІД 50 ЗЛ ›]» — with the price sitting
// on the button. «ЦІНИ ›» there only named the panel behind the press, which the
// number does anyway; the number is also the reason to press.
function priceChipTitle(slide) {
  return `<span class="chip-icon" aria-hidden="true">${slide.icon}</span>Уроки`;
}

function priceChipCta(slide) {
  const from = lowestSinglePrice(slide.anchor);
  if (from === null) return 'в Art Vibe ›';
  return `від ${from} ${pricesNow().currency.display} ›`;
}

export function chipFor(kind, { force = false } = {}) {
  if (ui.modalOpen) return;
  if (!force && shownPriceChips.has(kind)) return;
  // The cooldown only throttles the organic flush path. A forced call —
  // carousel prev/next on a chip already open, or the `shot=chip` QA hook —
  // is a deliberate ask to show one right now, not a competing focus event.
  if (!force && performance.now() - lastChipShownAt < CHIP_COOLDOWN_MS) return;
  shownPriceChips.add(kind);
  pendingPriceChips.delete(kind);
  const index = Math.max(0, PRICE_SLIDES.findIndex((slide) => slide.kind === kind));
  const slide = PRICE_SLIDES[index];
  const showAt = (nextIndex) => chipFor(PRICE_SLIDES[(nextIndex + PRICE_SLIDES.length) % PRICE_SLIDES.length].kind, { force: true });
  ui.showChip(
    priceChipTitle(slide),
    '',
    priceChipCta(slide),
    () => ui.open('pricing', slide.anchor),
    { onPrev: () => showAt(index - 1), onNext: () => showAt(index + 1) },
  );
  lastChipShownAt = performance.now();
  // Queueing normally loads the prices long before this, but a chip forced
  // straight up (carousel, screenshot hooks) can beat them here: show it now
  // and fill the number in the moment the file lands.
  chipAwaitingPrices = pricesNow() ? null : kind;
  if (chipAwaitingPrices) {
    loadPrices().then(() => {
      if (chipAwaitingPrices === kind) ui.setChipCta(priceChipCta(slide));
    });
  }
}

export function queuePriceChip(kind) {
  if (!kind || shownPriceChips.has(kind)) return;
  pendingPriceChips.add(kind);
  loadPrices();
}

export function flushPendingPriceChip(kind) {
  if (!kind || !pendingPriceChips.has(kind) || ui.modalOpen) return;
  pendingPriceChips.delete(kind);
  clearKeyboardJamChipTimer(kind);
  chipFor(kind);
}

const KEYBOARD_CHIP_SILENCE_MS = 2000;
const keyboardJamChipTimers = new Map();

export function clearKeyboardJamChipTimer(kind) {
  if (!kind) return;
  const timer = keyboardJamChipTimers.get(kind);
  if (timer) clearTimeout(timer);
  keyboardJamChipTimers.delete(kind);
}

function hasActiveKeyboardJamSound(kind) {
  if (kind === 'piano') return keyboardPianoNotes.size > 0;
  if (kind === 'guitar') return Boolean(play.keyboardGuitarChord);
  if (kind === 'mic') return Boolean(play.keyboardVocal);
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
export function noteKeyboardJamActivity(kind) {
  if (!kind || !pendingPriceChips.has(kind)) return;
  if (instrumentView.phase === 'focused' && instrumentView.kind === kind) {
    clearKeyboardJamChipTimer(kind);
    return;
  }
  scheduleKeyboardJamChip(kind);
}

