export const NATIVE_TOUCH_ACTIVATION_SELECTOR =
  '.panel, #hud button, #hud a[href], input, textarea, select, [contenteditable="true"]';

export function shouldPreserveNativeTouchActivation(target) {
  return Boolean(target?.closest?.(NATIVE_TOUCH_ACTIVATION_SELECTOR));
}
