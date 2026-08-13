// ============================================================
// MASCOT APPEARANCE (persisted in localStorage)
// The vocabulary of every look the gift can draw, plus the validator that keeps
// a hand-edited or outdated saved config from putting the mascot into a state
// the model builder cannot render. The draw itself lives in ./gift.js.
// ============================================================
import * as THREE from 'three';
import { GIFT_TIERS_BY_ID } from './gift.js?v=20260813-19';

// v4 adds `tier`, and v3 looks were hand-authored in the retired editor so they
// carry none. Per the standing rule, the key bump is how returning visitors get
// reset — old keys are deliberately not migrated.
export const MASCOT_KEY = 'av2.mascot.v4';
export const MASCOT_DEFAULTS = {
  tier: 'common',
  hair: 'long',
  hairColor: '5a2f22',
  smile: 'soft',
  eyeColor: 'dark',
  outfit: 'stage',
  outfitPrimary: 'default',
  outfitAccent: 'default',
  shoeColor: 'default',
  skinTone: 'tone-3',
  accessory: 'hoops',
  height: 100,
  width: 100,
};
// Base scale of the built rig; saved height/width are percentages of this.
export const MASCOT_BASE_SCALE = 0.68;
export const MASCOT_HEIGHT_RANGE = { min: 70, max: 145 };
export const MASCOT_WIDTH_RANGE = { min: 65, max: 150 };

// Three curated hairstyles, each with an authored fringe treatment:
// long — side-swept bangs, full back, long face-framing locks;
// bob — blunt straight fringe, rounded jaw-length shell, tucked locks;
// short — clean crop, no fringe, tiny sideburn wisps.
export const MASCOT_HAIR_STYLES = {
  long: {
    back: { s: [1.2, 1.52, 0.94], p: [0, -0.11, -0.085] },
    cap: { s: [1.02, 1, 1.02], p: [0, 0.04, 0.05] },
    // wide, set back, and stopping at the jaw so the face stays open
    locks: { s: [0.88, 2.75, 0.82], x: 0.288, y: -0.2, z: -0.035 },
    fringe: { s: [1.0, 1.02, 1.0], p: [0, 0.04, 0.045], rz: -0.22 },
    // The fall down the back, tilted in so the tip hugs the shoulder blades.
    // Length is capped so the face-category frame (head bounds) stays a
    // portrait — the tail is part of the head group and counts toward it.
    // Z sits behind the tailored torso's chest curve (max r 0.293) so the
    // fall stays visible from behind instead of sinking into the jacket.
    tail: { s: [1.12, 1.9, 0.72], p: [0, -0.41, -0.205], rx: 0.14 },
  },
  bob: {
    back: { s: [1.16, 1.05, 0.95], p: [0, -0.03, -0.055] },
    cap: { s: [1.03, 1, 1.03], p: [0, 0.04, 0.05] },
    locks: { s: [0.82, 1.62, 0.8], x: 0.272, y: -0.14, z: -0.01 },
    fringe: { s: [1.02, 1.08, 1.02], p: [0, 0.04, 0.045], rz: 0 },
    tail: null,
  },
  short: {
    back: { s: [1.06, 0.62, 0.88], p: [0, 0.06, -0.03] },
    cap: { s: [1.04, 0.96, 1.04], p: [0, 0.04, 0.05] },
    locks: { s: [0.4, 0.75, 0.45], x: 0.255, y: 0.02, z: 0.045 },
    fringe: { s: [1.0, 0.82, 1.0], p: [0, 0.045, 0.045], rz: 0.14 },
    tail: null,
  },
  // No hair pieces at all: the skin-toned face sphere shows through on top,
  // reading as a bald scalp. Brows stay on (they're not part of this set).
  bald: {
    back: null,
    cap: null,
    locks: null,
    fringe: null,
    tail: null,
  },
};

// Four coherent stagewear palettes on the varsity garment. Each keeps sleeves
// matched and limits itself to base + one primary + one accent.
export const MASCOT_OUTFITS = {
  stage: { top: 0xFDFBF7, panel: 0x17121c, stripes: 0xD1A13B, sleeveL: 0x233f9d, sleeveR: 0x233f9d, shoulder: 0x233f9d, collar: 0xD1A13B, pants: 0x2e3a52, shoes: 0x17121c },
  vibe: { top: 0xFDFBF7, panel: 0x9E33CA, stripes: 0xD1A13B, sleeveL: 0x9E33CA, sleeveR: 0x9E33CA, shoulder: 0x9E33CA, collar: 0xD1A13B, pants: 0x2a0f3a, shoes: 0x17121c },
  denim: { top: 0xFDFBF7, panel: 0x3a5a8c, stripes: 0xf2e6cc, sleeveL: 0x5B82A6, sleeveR: 0x5B82A6, shoulder: 0x5B82A6, collar: 0xf2e6cc, pants: 0x3a5a8c, shoes: 0xFDFBF7 },
  night: { top: 0x241a2e, panel: 0x9E33CA, stripes: 0xD1A13B, sleeveL: 0x241a2e, sleeveR: 0x241a2e, shoulder: 0x9E33CA, collar: 0xD1A13B, pants: 0x17121c, shoes: 0x9E33CA },
};
export const MASCOT_SMILES = new Set(['soft', 'wide', 'neutral']);
// Curated hair palette — retired swatch values fall back to the default so no
// look ever shows a color the editor can no longer name.
export const MASCOT_HAIR_COLOR_VALUES = new Set(['5a2f22', '241a14', 'c9a35f', 'a14d2d', 'b04a68']);
// Iris hexes are tuned for the layered eye: bright enough to read next to the
// dark pupil at stage distance, matched by the editor swatches in
// stage/index.html.
export const MASCOT_EYE_COLORS = {
  dark: 0x17121c,
  green: 0x3f8f63,
  blue: 0x4d7fd1,
};
export const MASCOT_SHOE_COLORS = {
  default: null,
  ink: 0x17121c,
  cream: 0xFDFBF7,
  red: 0xb93a3a,
};
// Four tones: warm (default), light, golden, deep. Retired IDs (tone-1/2/6)
// fall back to the default. tone-7 is lifted off pure black so it reads as
// skin under the stage key light instead of a silhouette.
export const MASCOT_SKIN_TONES = {
  'tone-3': 0xf2c4a6,
  'tone-5': 0xf6d7c5,
  'tone-4': 0xd99b72,
  'tone-7': 0x4a3128,
};
export const MASCOT_ACCESSORIES = new Set(['none', 'hoops', 'glasses', 'headphones']);
export const MASCOT_OUTFIT_COLORS = {
  default: null,
  purple: 0x9E33CA,
  gold: 0xD1A13B,
  cream: 0xFDFBF7,
  denim: 0x5B82A6,
  ink: 0x17121c,
  green: 0x008542,
};
export const MASCOT_PRIMARY_COLORS = new Set(['default', 'purple', 'gold', 'denim']);
export const MASCOT_ACCENT_COLORS = new Set(['default', 'purple', 'gold', 'cream']);

export function validateMascotAppearance(saved) {
  const cfg = { ...MASCOT_DEFAULTS };
  if (!saved || typeof saved !== 'object') return cfg;
  if (saved.tier in GIFT_TIERS_BY_ID) cfg.tier = saved.tier;
  if (saved.hair in MASCOT_HAIR_STYLES) cfg.hair = saved.hair;
  if (typeof saved.hairColor === 'string' && MASCOT_HAIR_COLOR_VALUES.has(saved.hairColor.toLowerCase())) cfg.hairColor = saved.hairColor.toLowerCase();
  if (MASCOT_SMILES.has(saved.smile)) cfg.smile = saved.smile;
  if (saved.eyeColor in MASCOT_EYE_COLORS) cfg.eyeColor = saved.eyeColor;
  if (saved.outfit in MASCOT_OUTFITS) cfg.outfit = saved.outfit;
  if (MASCOT_PRIMARY_COLORS.has(saved.outfitPrimary)) cfg.outfitPrimary = saved.outfitPrimary;
  if (MASCOT_ACCENT_COLORS.has(saved.outfitAccent)) cfg.outfitAccent = saved.outfitAccent;
  if (saved.shoeColor in MASCOT_SHOE_COLORS) cfg.shoeColor = saved.shoeColor;
  if (saved.skinTone in MASCOT_SKIN_TONES) cfg.skinTone = saved.skinTone;
  if (MASCOT_ACCESSORIES.has(saved.accessory)) cfg.accessory = saved.accessory;
  if (Number.isFinite(saved.height)) cfg.height = THREE.MathUtils.clamp(Math.round(saved.height), MASCOT_HEIGHT_RANGE.min, MASCOT_HEIGHT_RANGE.max);
  if (Number.isFinite(saved.width)) cfg.width = THREE.MathUtils.clamp(Math.round(saved.width), MASCOT_WIDTH_RANGE.min, MASCOT_WIDTH_RANGE.max);
  return cfg;
}

export function mascotAppearanceSnapshot(source = mascotCfg) {
  return validateMascotAppearance(source);
}

export const mascotCfg = (() => {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(MASCOT_KEY) || 'null');
  } catch { /* storage is optional */ }
  return validateMascotAppearance(saved);
})();

// Whether this visitor has already been given a character. Deliberately checks
// for the key rather than inspecting `mascotCfg`, which always validates to a
// full config — a visitor with no save is indistinguishable from one holding the
// defaults, and only the key can tell them apart.
export function hasSavedMascot() {
  try { return localStorage.getItem(MASCOT_KEY) !== null; } catch { return false; }
}

export function saveMascotConfig() {
  const saved = mascotAppearanceSnapshot(mascotCfg);
  try { localStorage.setItem(MASCOT_KEY, JSON.stringify(saved)); } catch { /* ignore */ }
}

