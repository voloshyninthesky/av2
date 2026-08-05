// ============================================================
// VIBE METER + PRICE CHIPS
// The reward loop: playing raises the meter, filling it once unlocks the loop
// pedal and sets off fireworks. Price chips ride on the same signal but are
// deliberately quiet — one per instrument, queued by playing it or by simply
// reaching its close-up, and shown only once the visitor has left the focus or
// stopped playing long enough to read one.
// ============================================================
import * as THREE from 'three';
import { ui, audio, fireworks, mascot } from '../core/studio.js?v=20260804-10';
import { loadPrices, pricesNow, lowestSinglePrice } from '../core/prices.js?v=20260805-03';
import { bumpHitPulse } from '../scene/effects.js?v=20260804-10';
import { instrumentView } from '../view/instrument-presets.js?v=20260804-10';
import { play, keyboardPianoNotes } from './state.js?v=20260804-10';

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

export function addVibe(n) {
  play.vibe = Math.min(100, play.vibe + n);
  play.lastVibeAdd = performance.now();
  ui.setVibe(play.vibe);
  const justUnlocked = play.vibe >= 100 && unlockLoopPedal();
  if (play.vibe >= 100 && (justUnlocked || performance.now() > play.vibeCooldown)) {
    play.vibeCooldown = performance.now() + 4000;
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
    play.vibe = 55;
    play.lastVibeAdd = performance.now() + 3600;
    setTimeout(() => ui.setVibe(play.vibe), 3600);
  }
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

