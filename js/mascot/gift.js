// ============================================================
// MASCOT GIFT — THE DRAW
// The visitor receives a character rather than authoring one, so this module
// owns the whole question of *who shows up*: the rarity tiers, the per-tier
// weights over the appearance vocabulary, and the six authored legendary looks.
//
// A visitor draws once, on their first visit, and keeps that character forever —
// so this is pure: same rng in, same character out, no accumulated state.
//
// Deliberately imports nothing — not even ./appearance.js, which pulls in three
// and so cannot load under plain `node`. Zero imports makes the draw directly
// testable (tests/mascot-gift.test.mjs), and the price is that trait values are
// spelled here as well as in appearance.js. That duplication is pinned by the
// vocabulary-agreement test, which reads appearance.js as text and fails the
// moment the two drift.
// ============================================================

// A tier carries only what tells it apart: its label and its accent colour.
// The ceremony itself is identical for everyone — see js/mascot/reveal.js. A
// visitor gets exactly one gift in their life, so scaling the spectacle to the
// roll would mean most people never see the good version of the only reveal
// they will ever get.
// `name` is sentence-case because it is read inside a sentence — «це Вайбер
// Звичайний» — rather than shouted as a label. It parses as a species epithet,
// which is the joke: every character is a Вайбер, and the tier says which kind.
// Weights loosened once, deliberately: a marked character is the interesting
// one to receive, and at 58% common a clear majority of visitors met a Вайбер
// with no companion at all. Every marked tier moved up a step and common paid
// for all of it. Legendary stays scarce enough to mean something — it is still
// the rarest thing on the stage by a factor of five.
export const GIFT_TIERS = [
  { id: 'common', name: 'Звичайний', weight: 0.50, accent: 0xFDFBF7 },
  { id: 'rare', name: 'Рідкісний', weight: 0.30, accent: 0x5B82A6 },
  { id: 'epic', name: 'Епічний', weight: 0.14, accent: 0x9E33CA },
  { id: 'legendary', name: 'Легендарний', weight: 0.06, accent: 0xD1A13B },
];

export const GIFT_TIERS_BY_ID = Object.fromEntries(GIFT_TIERS.map((tier) => [tier.id, tier]));

// Every tier draws from all four skin tones with equal weight. A skin tone is
// not a rarity signal and must never become one; the tiers are told apart by
// hair, stagewear and accessories.
const SKIN_TONES_EVEN = { 'tone-3': 0.25, 'tone-5': 0.25, 'tone-4': 0.25, 'tone-7': 0.25 };

// Weights shift toward the loud end of the vocabulary as the tier climbs:
// `bald` is the one silhouette change in the hair set, `night` the one dark
// stagewear palette, `headphones` the biggest added mass, `b04a68` the loudest
// swatch. Common keeps the whole vocabulary so the ordinary population stays
// varied rather than becoming a set of near-defaults.
const TIER_POOLS = {
  common: {
    hair: { long: 0.34, bob: 0.30, short: 0.30, bald: 0.06 },
    hairColor: { '5a2f22': 0.34, '241a14': 0.30, c9a35f: 0.18, a14d2d: 0.15, b04a68: 0.03 },
    smile: { soft: 0.45, wide: 0.30, neutral: 0.25 },
    eyeColor: { dark: 0.60, green: 0.20, blue: 0.20 },
    outfit: { stage: 0.40, vibe: 0.30, denim: 0.25, night: 0.05 },
    outfitPrimary: { default: 0.70, purple: 0.12, denim: 0.12, gold: 0.06 },
    outfitAccent: { default: 0.62, purple: 0.16, cream: 0.14, gold: 0.08 },
    shoeColor: { default: 0.62, ink: 0.18, cream: 0.14, red: 0.06 },
    skinTone: SKIN_TONES_EVEN,
    accessory: { none: 0.30, hoops: 0.40, glasses: 0.22, headphones: 0.08 },
    heights: [92, 96, 100, 104, 108],
    widths: [92, 96, 100, 104, 108],
  },
  rare: {
    hair: { long: 0.30, bob: 0.26, short: 0.28, bald: 0.16 },
    hairColor: { '5a2f22': 0.20, '241a14': 0.20, c9a35f: 0.24, a14d2d: 0.24, b04a68: 0.12 },
    smile: { soft: 0.34, wide: 0.36, neutral: 0.30 },
    eyeColor: { dark: 0.34, green: 0.33, blue: 0.33 },
    outfit: { stage: 0.24, vibe: 0.32, denim: 0.26, night: 0.18 },
    outfitPrimary: { default: 0.34, purple: 0.28, denim: 0.24, gold: 0.14 },
    outfitAccent: { default: 0.30, purple: 0.26, cream: 0.24, gold: 0.20 },
    shoeColor: { default: 0.28, ink: 0.24, cream: 0.24, red: 0.24 },
    skinTone: SKIN_TONES_EVEN,
    accessory: { none: 0.14, hoops: 0.28, glasses: 0.32, headphones: 0.26 },
    heights: [82, 88, 100, 112, 120],
    widths: [82, 90, 100, 112, 122],
  },
  epic: {
    hair: { long: 0.30, bob: 0.24, short: 0.24, bald: 0.22 },
    hairColor: { b04a68: 0.28, c9a35f: 0.26, a14d2d: 0.22, '241a14': 0.14, '5a2f22': 0.10 },
    smile: { soft: 0.28, wide: 0.42, neutral: 0.30 },
    eyeColor: { dark: 0.30, green: 0.35, blue: 0.35 },
    outfit: { night: 0.45, vibe: 0.35, denim: 0.12, stage: 0.08 },
    outfitPrimary: { purple: 0.45, gold: 0.25, denim: 0.18, default: 0.12 },
    outfitAccent: { gold: 0.40, purple: 0.30, cream: 0.22, default: 0.08 },
    shoeColor: { red: 0.30, cream: 0.26, ink: 0.26, default: 0.18 },
    skinTone: SKIN_TONES_EVEN,
    accessory: { headphones: 0.45, glasses: 0.35, hoops: 0.20 },
    heights: [76, 84, 116, 126, 134],
    widths: [76, 86, 114, 126, 136],
  },
};

// Legendary is not a weighted draw. Six authored looks, picked uniformly, so
// the rarest result is always unmistakable. skinTone is deliberately absent — it
// is drawn evenly like every other tier, which keeps the authored identity in
// the hair, stagewear and silhouette. The comments name them only for us.
export const LEGENDARY_LOOKS = [
  // золотий соліст
  { hair: 'long', hairColor: 'c9a35f', smile: 'wide', eyeColor: 'blue', outfit: 'night', outfitPrimary: 'gold', outfitAccent: 'gold', shoeColor: 'cream', accessory: 'headphones', height: 118, width: 104 },
  // панк
  { hair: 'bald', hairColor: '241a14', smile: 'wide', eyeColor: 'green', outfit: 'vibe', outfitPrimary: 'purple', outfitAccent: 'gold', shoeColor: 'red', accessory: 'hoops', height: 96, width: 126 },
  // нічний діджей
  { hair: 'short', hairColor: '241a14', smile: 'neutral', eyeColor: 'dark', outfit: 'night', outfitPrimary: 'purple', outfitAccent: 'cream', shoeColor: 'ink', accessory: 'headphones', height: 108, width: 98 },
  // рожева зірка
  { hair: 'bob', hairColor: 'b04a68', smile: 'wide', eyeColor: 'blue', outfit: 'vibe', outfitPrimary: 'purple', outfitAccent: 'cream', shoeColor: 'red', accessory: 'glasses', height: 92, width: 92 },
  // велетень
  { hair: 'long', hairColor: 'a14d2d', smile: 'soft', eyeColor: 'dark', outfit: 'stage', outfitPrimary: 'gold', outfitAccent: 'gold', shoeColor: 'ink', accessory: 'glasses', height: 145, width: 138 },
  // тінь
  { hair: 'bald', hairColor: '241a14', smile: 'neutral', eyeColor: 'green', outfit: 'night', outfitPrimary: 'default', outfitAccent: 'purple', shoeColor: 'ink', accessory: 'none', height: 134, width: 78 },
];

// The traits that read as "not an ordinary person" at stage distance. Used by
// the legendary-legibility test; the card describes a look rather than scoring it.
export const SIGNATURE_TRAITS = [
  (cfg) => cfg.hair === 'bald',
  (cfg) => cfg.hairColor === 'b04a68',
  (cfg) => cfg.outfit === 'night',
  (cfg) => cfg.outfitPrimary === 'gold',
  (cfg) => cfg.accessory === 'headphones',
  (cfg) => cfg.shoeColor === 'red',
  (cfg) => cfg.height >= 130 || cfg.height <= 80,
  (cfg) => cfg.width >= 130 || cfg.width <= 80,
];

export function countSignatureTraits(cfg) {
  return SIGNATURE_TRAITS.reduce((total, matches) => total + (matches(cfg) ? 1 : 0), 0);
}

function pickWeighted(table, rng) {
  let roll = rng();
  let last = null;
  for (const key in table) {
    last = key;
    roll -= table[key];
    if (roll <= 0) return key;
  }
  // Floating-point remainder only; the tables are asserted to sum to 1.
  return last;
}

function pickFrom(values, rng) {
  return values[Math.min(values.length - 1, (rng() * values.length) | 0)];
}

// Each visitor draws exactly once, ever, so there is no pity counter and no
// repeat-guard: both only made sense while rerolls existed. 4% legendary is the
// true one-shot rate, which is what makes the tier worth having.
function pickTier(rng) {
  let roll = rng();
  let last = GIFT_TIERS[0];
  for (const tier of GIFT_TIERS) {
    last = tier;
    roll -= tier.weight;
    if (roll <= 0) return tier;
  }
  return last;
}

function drawLook(tier, rng) {
  if (tier.id === 'legendary') {
    const look = pickFrom(LEGENDARY_LOOKS, rng);
    return { cfg: { ...look, skinTone: pickWeighted(SKIN_TONES_EVEN, rng) } };
  }
  const pool = TIER_POOLS[tier.id];
  return {
    cfg: {
      hair: pickWeighted(pool.hair, rng),
      hairColor: pickWeighted(pool.hairColor, rng),
      smile: pickWeighted(pool.smile, rng),
      eyeColor: pickWeighted(pool.eyeColor, rng),
      outfit: pickWeighted(pool.outfit, rng),
      outfitPrimary: pickWeighted(pool.outfitPrimary, rng),
      outfitAccent: pickWeighted(pool.outfitAccent, rng),
      shoeColor: pickWeighted(pool.shoeColor, rng),
      skinTone: pickWeighted(pool.skinTone, rng),
      accessory: pickWeighted(pool.accessory, rng),
      height: pickFrom(pool.heights, rng),
      width: pickFrom(pool.widths, rng),
    },
  };
}

// Returns { tier, cfg }. Characters are not named individually — every one of
// them is a Вайбер, and the tier is the only thing that distinguishes them.
export function drawMascotGift(rng = Math.random) {
  const tier = pickTier(rng);
  return { tier, cfg: { ...drawLook(tier, rng).cfg, tier: tier.id } };
}
