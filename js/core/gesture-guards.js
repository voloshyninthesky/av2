// ============================================================
// GESTURE GUARDS
// Two guards that several layers need and none of them owns: the predicate
// behind the stage's double-tap-zoom blocker, and the one-shot swallower for
// the click a touch browser synthesizes after a gesture that already did its
// work on pointerdown / pointerup.
//
// No imports, on purpose. That keeps the module reachable from `js/ui.js`,
// `view/` and `core/` alike without ever pointing an import upward (AGENTS.md),
// and it keeps it loadable under plain `node --test`, the same trick
// `js/guitar-gestures.js` uses.
// ============================================================

export const DOUBLE_TAP_WINDOW_MS = 320;
/**
 * A browser pairs two taps into a zoom only when they land close together.
 * 44px is the minimum touch target, so anything further apart is two separate
 * intentions — and treating them as one was silently killing the second tap.
 */
export const DOUBLE_TAP_SLOP_PX = 44;

/**
 * Everything `css/style.css` already gives `touch-action: manipulation` (or
 * `none`), plus text entry and panels. On these the synthesized click IS the
 * activation, so cancelling their `touchend` cancels the tap itself.
 */
export const DOUBLE_TAP_EXEMPT = 'button, a, input, textarea, select, label, summary,'
  + ' [contenteditable="true"], [role="button"], .pill-btn, .icon-btn, .swatch, .panel';

/**
 * Should this touchend be cancelled to stop a double-tap zoom?
 *
 * @param {{at: number, x: number, y: number}|null} previous the tap carried forward
 * @param {{now: number, x: number, y: number, exempt: boolean}} tap
 * @returns {{block: boolean, next: {at: number, x: number, y: number}|null}}
 *   `next` is what to carry forward. An exempt tap clears it: a control can be
 *   neither half of a zooming double tap, so it must not arm one either.
 */
export function judgeDoubleTap(previous, tap) {
  if (tap.exempt) return { block: false, next: null };
  if (!Number.isFinite(tap.now) || !Number.isFinite(tap.x) || !Number.isFinite(tap.y)) {
    return { block: false, next: null };
  }
  const pairs = Boolean(previous)
    && tap.now - previous.at < DOUBLE_TAP_WINDOW_MS
    && Math.hypot(tap.x - previous.x, tap.y - previous.y) <= DOUBLE_TAP_SLOP_PX;
  return { block: pairs, next: { at: tap.now, x: tap.x, y: tap.y } };
}

/**
 * Swallow at most ONE synthesized click, then get out of the way.
 *
 * `within` is a ceiling for the case where no click ever arrives (a cancelled
 * gesture, or a browser that suppressed it) — not a window: whenever the first
 * click lands it is eaten and the listener removes itself. Holding a document
 * capture listener for a flat few hundred milliseconds also eats the visitor's
 * *next* deliberate tap, which is the bug this shape exists to avoid.
 *
 * A keyboard activation carries `detail === 0`; it passes through untouched and
 * does not consume the shot.
 *
 * @returns {() => void} release, safe to call more than once
 */
export function swallowNextClick({ within = 700, target = document } = {}) {
  let timer = null;
  const release = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    target.removeEventListener('click', onClick, true);
  };
  const onClick = (event) => {
    if (event.detail === 0) return;
    event.stopPropagation();
    event.preventDefault();
    release();
  };
  target.addEventListener('click', onClick, true);
  timer = setTimeout(release, within);
  return release;
}
