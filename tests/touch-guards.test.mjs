import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DOUBLE_TAP_SLOP_PX,
  DOUBLE_TAP_WINDOW_MS,
  judgeDoubleTap,
  swallowNextClick,
} from '../js/core/gesture-guards.js';

const tap = (over = {}) => ({ now: 1000, x: 100, y: 100, exempt: false, ...over });

test('two taps close in time and place are a double tap', () => {
  const first = judgeDoubleTap(null, tap());
  assert.equal(first.block, false, 'a first tap has nothing to pair with');
  const second = judgeDoubleTap(first.next, tap({ now: 1100, x: 108, y: 104 }));
  assert.equal(second.block, true);
});

test('taps far apart on screen are two intentions, not a zoom', () => {
  const first = judgeDoubleTap(null, tap());
  const second = judgeDoubleTap(first.next, tap({ now: 1010, x: 300, y: 100 }));
  assert.equal(second.block, false, 'this cancelled the tap the visitor meant');
});

test('taps far apart in time are two intentions', () => {
  const first = judgeDoubleTap(null, tap());
  const second = judgeDoubleTap(first.next, tap({
    now: 1000 + DOUBLE_TAP_WINDOW_MS + 1,
    x: 100,
    y: 100,
  }));
  assert.equal(second.block, false);
});

test('the slop boundary is inclusive and the window is not', () => {
  const first = judgeDoubleTap(null, tap());
  assert.equal(
    judgeDoubleTap(first.next, tap({ now: 1100, x: 100 + DOUBLE_TAP_SLOP_PX, y: 100 })).block,
    true,
  );
  assert.equal(
    judgeDoubleTap(first.next, tap({ now: 1100, x: 100 + DOUBLE_TAP_SLOP_PX + 1, y: 100 })).block,
    false,
  );
  assert.equal(
    judgeDoubleTap(first.next, tap({ now: 1000 + DOUBLE_TAP_WINDOW_MS })).block,
    false,
  );
});

test('a control is never half of a double tap, and never arms one', () => {
  const control = judgeDoubleTap(null, tap({ exempt: true }));
  assert.equal(control.block, false);
  assert.equal(control.next, null, 'a HUD tap must not arm the guard for the next tap');

  const stage = judgeDoubleTap(null, tap());
  const onControl = judgeDoubleTap(stage.next, tap({ now: 1050, exempt: true }));
  assert.equal(onControl.block, false, 'a canvas tap must not cancel the HUD tap after it');
});

test('a touchend with no usable coordinates is left alone', () => {
  const first = judgeDoubleTap(null, tap());
  const multi = judgeDoubleTap(first.next, tap({ now: 1050, x: undefined, y: undefined }));
  assert.equal(multi.block, false);
  assert.equal(multi.next, null);
});

/** Minimal EventTarget stand-in: records what is listening and dispatches by hand. */
function makeTarget() {
  const handlers = new Set();
  return {
    handlers,
    addEventListener(type, fn, capture) {
      handlers.add({ type, fn, capture });
    },
    removeEventListener(type, fn) {
      for (const entry of handlers) if (entry.type === type && entry.fn === fn) handlers.delete(entry);
    },
    dispatch(event) {
      for (const entry of [...handlers]) if (entry.type === 'click') entry.fn(event);
      return event;
    },
  };
}

const clickEvent = (detail = 1) => {
  const event = { detail, prevented: false, stopped: false };
  event.preventDefault = () => { event.prevented = true; };
  event.stopPropagation = () => { event.stopped = true; };
  return event;
};

test('the ghost click is swallowed exactly once', () => {
  const target = makeTarget();
  swallowNextClick({ target, within: 500 });
  assert.equal(target.handlers.size, 1);

  const ghost = target.dispatch(clickEvent());
  assert.equal(ghost.prevented, true);
  assert.equal(ghost.stopped, true);
  assert.equal(target.handlers.size, 0, 'the guard must not outlive the click it ate');

  const deliberate = target.dispatch(clickEvent());
  assert.equal(deliberate.prevented, false, 'the next real tap must get through');
});

test('a keyboard activation is not swallowed and does not spend the shot', () => {
  const target = makeTarget();
  swallowNextClick({ target, within: 500 });

  const keyboard = target.dispatch(clickEvent(0));
  assert.equal(keyboard.prevented, false);
  assert.equal(target.handlers.size, 1, 'detail === 0 must leave the guard armed');

  assert.equal(target.dispatch(clickEvent()).prevented, true);
});

test('release removes the guard even when no click ever arrives', () => {
  const target = makeTarget();
  const release = swallowNextClick({ target, within: 500 });
  release();
  assert.equal(target.handlers.size, 0);
  release();
  assert.equal(target.dispatch(clickEvent()).prevented, false);
});

test('the guard lifts on its own once the ceiling passes', async () => {
  const target = makeTarget();
  swallowNextClick({ target, within: 10 });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(target.handlers.size, 0);
});
