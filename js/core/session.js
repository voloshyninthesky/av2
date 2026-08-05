// ============================================================
// SESSION STATE
// The handful of flags that describe "what the visit is doing right now" and
// that several subsystems both read and write. Keeping them on one object
// means a module can observe them without importing whichever feature happens
// to own the transition that flips them.
// ============================================================

export const session = {
  /** The visitor has entered the stage; input and the sim are live. */
  started: false,
  /** Progress through the intro fly-in, or -1 when not flying. */
  flyT: -1,
};

/** Cubic in/out — the house easing for camera moves and pose blends. */
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
