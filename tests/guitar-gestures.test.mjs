import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GUITAR_TAP_MAX_DISTANCE_PX,
  GUITAR_TAP_MAX_DURATION_MS,
  isQuickGuitarTap,
} from '../js/guitar-gestures.js';

test('a short stationary guitar gesture is a tap', () => {
  assert.equal(isQuickGuitarTap({ elapsedMs: 120, distancePx: 4 }), true);
});

test('a held chord gesture stays momentary', () => {
  assert.equal(isQuickGuitarTap({
    elapsedMs: GUITAR_TAP_MAX_DURATION_MS + 1,
    distancePx: 0,
  }), false);
});

test('a chord used by the second finger does not latch on release', () => {
  assert.equal(isQuickGuitarTap({
    elapsedMs: 150,
    distancePx: 0,
    usedForPlay: true,
  }), false);
});

test('cancelled and dragged guitar gestures do not count as taps', () => {
  assert.equal(isQuickGuitarTap({ elapsedMs: 100, distancePx: 0, cancelled: true }), false);
  assert.equal(isQuickGuitarTap({
    elapsedMs: 100,
    distancePx: GUITAR_TAP_MAX_DISTANCE_PX + 1,
  }), false);
});
