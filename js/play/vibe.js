// ============================================================
// VIBE METER + PRICE CHIPS
// The reward loop: playing raises the meter, filling it once unlocks the loop
// pedal and sets off fireworks. Price chips ride on the same signal but are
// deliberately quiet — one per instrument, queued by playing it or by simply
// reaching its close-up, and shown only once the visitor has left the focus or
// stopped playing long enough to read one.
// ============================================================
import * as THREE from 'three';
import { ui, audio, fireworks, mascot } from '../core/studio.js?v=20260807-03';
import { loadPrices, pricesNow, lowestSinglePrice } from '../core/prices.js?v=20260807-03';
import { bumpHitPulse } from '../scene/effects.js?v=20260807-03';
import { instrumentView } from '../view/instrument-presets.js?v=20260807-03';
import { play, keyboardPianoNotes } from './state.js?v=20260807-03';
import { trackOnce } from '../core/analytics.js?v=20260807-03';

const loopPedal = document.getElementById('loop-pedal');
const loopStatus = document.getElementById('loop-status');
const loopKeyHint = document.getElementById('loop-key-hint');

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
 * Cheer once per instrument, on the third note rather than the first. By the
 * third the visitor is deliberately playing, so it reads as "you've got this";
 * on the first they may not even be sure they caused the sound. Four times a
 * visit at most, then silence — praise that keeps arriving stops meaning
 * anything.
 *
 * Yields to a toast already on screen rather than replacing it: anything else
 * the stage chose to say carries more than a cheer does. A cheer swallowed
 * that way is retried on the next note instead of being spent, so each
 * instrument still gets its one. (Price chips live in `#chip`, a separate
 * element, and are unaffected either way.)
 */
const PRAISE_AFTER_NOTES = 3;
const notesPerKind = new Map();
const praisedKinds = new Set();
function praiseNthNote(kind) {
  if (!kind || praisedKinds.has(kind)) return;
  const played = (notesPerKind.get(kind) || 0) + 1;
  notesPerKind.set(kind, played);
  if (played < PRAISE_AFTER_NOTES) return;
  if (!ui.el.toast.hidden) return;
  praisedKinds.add(kind);
  ui.toast(praiseWord(), 1500);
}

/**
 * How much of a note's nominal vibe actually lands. The per-event weights in
 * the play modules (drums 4, guitar 5, piano 3.5…) are *relative* values worth
 * keeping as they are; this one number sets how long a full meter takes, so
 * retuning the reward loop never means editing eight call sites.
 */
export const VIBE_NOTE_GAIN = 0.7;

export function addVibe(n, kind = null) {
  trackOnce('stage-first-play');
  praiseNthNote(kind);
  // Filling is a one-way door: the meter stays at 100 for the rest of the
  // visit rather than settling back and being re-earned. So this fires exactly
  // once — no cooldown needed to throttle repeat celebrations, and the idle
  // decay in main.js stands down (see `play.vibeFull`).
  if (play.vibeFull) return;
  play.vibe = Math.min(100, play.vibe + n * VIBE_NOTE_GAIN);
  play.lastVibeAdd = performance.now();
  ui.setVibe(play.vibe);
  if (play.vibe < 100) return;

  play.vibeFull = true;
  unlockLoopPedal();
  const spots = [new THREE.Vector3(-2, 4.6, 0), new THREE.Vector3(2.2, 5.2, -1), new THREE.Vector3(0, 5.6, 1)];
  spots.forEach((p, i) => setTimeout(() => fireworks.spawn(p), i * 260));
  bumpHitPulse(1.35);
  ui.toast(
    'МАКСИМАЛЬНИЙ ВАЙБ! <span class="hl">LOOP-ПЕДАЛЬ ВІДКРИТО</span>',
    4200,
    'vibe-max',
  );
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

function priceChipTitle(slide) {
  const from = lowestSinglePrice(slide.anchor);
  const teaser = from === null
    ? 'в Art Vibe'
    : `від ${from} ${pricesNow().currency.display}`;
  return `<span class="chip-icon" aria-hidden="true">${slide.icon}</span>Уроки <span class="accent">${teaser}</span>`;
}

export function chipFor(kind, { force = false } = {}) {
  if (ui.modalOpen) return;
  if (!force && shownPriceChips.has(kind)) return;
  shownPriceChips.add(kind);
  pendingPriceChips.delete(kind);
  const index = Math.max(0, PRICE_SLIDES.findIndex((slide) => slide.kind === kind));
  const slide = PRICE_SLIDES[index];
  const showAt = (nextIndex) => chipFor(PRICE_SLIDES[(nextIndex + PRICE_SLIDES.length) % PRICE_SLIDES.length].kind, { force: true });
  ui.showChip(
    priceChipTitle(slide),
    '',
    'ЦІНИ ›',
    () => ui.open('pricing', slide.anchor),
    { onPrev: () => showAt(index - 1), onNext: () => showAt(index + 1) },
  );
  // Queueing normally loads the prices long before this, but a chip forced
  // straight up (carousel, screenshot hooks) can beat them here: show it now
  // and fill the number in the moment the file lands.
  chipAwaitingPrices = pricesNow() ? null : kind;
  if (chipAwaitingPrices) {
    loadPrices().then(() => {
      if (chipAwaitingPrices === kind) ui.setChipTitle(priceChipTitle(slide));
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

