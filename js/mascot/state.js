// ============================================================
// MASCOT RUNTIME STATE
// Where the mascot is heading and what it is doing, shared by the walk loop,
// the focus-view transitions, the mobile joystick and the dance routine.
// Appearance lives in appearance.js; this is only the moment-to-moment part.
// ============================================================
import { MASCOT_START } from '../core/studio.js?v=20260806-19';

export const mascotMove = {
  keys: new Set(), destination: null, destinationKind: null, waypoints: [], speed: 2.45, phase: 0,
  travelBounds: { minX: -8.35, maxX: 8.35, minZ: -4.65, maxZ: 4.35 },
  stageEdge: { minX: -7.72, maxX: 7.72, frontZ: 3.78 },
  spawn: MASCOT_START.clone(),
  fall: null,
};

// HUD logo click: tektonik routine state (only toggled via the logo).
export const dance = { active: false, t: 0, yaw: 0, loop: 0 };
