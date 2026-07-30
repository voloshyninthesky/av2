import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NATIVE_TOUCH_ACTIVATION_SELECTOR,
  shouldPreserveNativeTouchActivation,
} from '../js/touch-guards.mjs';

test('HUD buttons preserve their native touch activation click', () => {
  const target = {
    closest(selector) {
      return selector.includes('#hud button') ? { id: 'sound-btn' } : null;
    },
  };

  assert.match(NATIVE_TOUCH_ACTIVATION_SELECTOR, /#hud button/);
  assert.equal(shouldPreserveNativeTouchActivation(target), true);
});

test('stage touches remain eligible for double-tap suppression', () => {
  const canvas = { closest: () => null };

  assert.equal(shouldPreserveNativeTouchActivation(canvas), false);
});
