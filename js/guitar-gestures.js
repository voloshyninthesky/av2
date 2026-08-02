export const GUITAR_TAP_MAX_DURATION_MS = 500;
export const GUITAR_TAP_MAX_DISTANCE_PX = 22;

export function isQuickGuitarTap({
  elapsedMs,
  distancePx,
  cancelled = false,
  usedForPlay = false,
}) {
  return !cancelled
    && !usedForPlay
    && Number.isFinite(elapsedMs)
    && Number.isFinite(distancePx)
    && elapsedMs <= GUITAR_TAP_MAX_DURATION_MS
    && distancePx <= GUITAR_TAP_MAX_DISTANCE_PX;
}
