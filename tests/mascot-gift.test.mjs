// The gift draw decides who every visitor meets, and almost everything about it
// is invisible from the running app: a wrong weight still produces a plausible
// character, and a typo in a trait value still produces *a* mascot — just the
// default one, silently, because validateMascotAppearance falls back per field.
// That is exactly the shape of bug this file exists to catch.
//
// `js/mascot/gift.js` deliberately imports nothing, so unlike most of js/ it can
// be imported directly here instead of being sliced out of its own source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  GIFT_TIERS,
  GIFT_TIERS_BY_ID,
  GIFT_NAMES,
  LEGENDARY_LOOKS,
  countSignatureTraits,
  drawMascotGift,
} from '../js/mascot/gift.js';

const appearanceSrc = readFileSync(new URL('../js/mascot/appearance.js', import.meta.url), 'utf8');
const giftSrc = readFileSync(new URL('../js/mascot/gift.js', import.meta.url), 'utf8');

// Deterministic LCG — Math.random would make a failure unreproducible, and the
// distribution assertions need hundreds of thousands of draws.
function seededRng(seed) {
  let state = (seed >>> 0) || 1;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Every value the draw can emit, collected by walking the module's own tables
// rather than re-listing them here (which would just move the drift).
function drawnValues(field, count = 60000) {
  const rng = seededRng(4242);
  const seen = new Set();
  for (let i = 0; i < count; i++) {
    seen.add(drawMascotGift(rng).cfg[field]);
  }
  return seen;
}

// ---- the duplication guard ----
// gift.js spells the appearance vocabulary a second time so it can stay
// import-free. This is the test that makes that trade safe: it reads
// appearance.js as text and fails the moment the two drift apart.
test('every value the draw can emit exists in the appearance vocabulary', () => {
  const vocabularies = {
    hair: /export const MASCOT_HAIR_STYLES = \{([\s\S]*?)\n\};/,
    hairColor: /export const MASCOT_HAIR_COLOR_VALUES = new Set\(\[(.*?)\]\)/,
    smile: /export const MASCOT_SMILES = new Set\(\[(.*?)\]\)/,
    eyeColor: /export const MASCOT_EYE_COLORS = \{([\s\S]*?)\n\};/,
    outfit: /export const MASCOT_OUTFITS = \{([\s\S]*?)\n\};/,
    outfitPrimary: /export const MASCOT_PRIMARY_COLORS = new Set\(\[(.*?)\]\)/,
    outfitAccent: /export const MASCOT_ACCENT_COLORS = new Set\(\[(.*?)\]\)/,
    shoeColor: /export const MASCOT_SHOE_COLORS = \{([\s\S]*?)\n\};/,
    skinTone: /export const MASCOT_SKIN_TONES = \{([\s\S]*?)\n\};/,
    accessory: /export const MASCOT_ACCESSORIES = new Set\(\[(.*?)\]\)/,
  };
  for (const [field, pattern] of Object.entries(vocabularies)) {
    const match = appearanceSrc.match(pattern);
    assert.ok(match, `could not locate the ${field} vocabulary in appearance.js`);
    const block = match[1];
    for (const value of drawnValues(field)) {
      assert.ok(
        block.includes(`'${value}'`) || block.includes(`${value}:`) || block.includes(`'${value}':`),
        `gift.js can draw ${field}="${value}", which appearance.js does not accept`,
      );
    }
  }
});

test('drawn heights and builds stay inside the appearance clamps', () => {
  const range = (name) => {
    const match = appearanceSrc.match(new RegExp(`export const ${name} = \\{ min: (\\d+), max: (\\d+) \\}`));
    assert.ok(match, `could not locate ${name} in appearance.js`);
    return { min: Number(match[1]), max: Number(match[2]) };
  };
  const height = range('MASCOT_HEIGHT_RANGE');
  const width = range('MASCOT_WIDTH_RANGE');
  const rng = seededRng(7);
  for (let i = 0; i < 40000; i++) {
    const { cfg } = drawMascotGift(rng);
    assert.ok(cfg.height >= height.min && cfg.height <= height.max, `height ${cfg.height} out of range`);
    assert.ok(cfg.width >= width.min && cfg.width <= width.max, `width ${cfg.width} out of range`);
  }
});

// ---- the rarity contract ----
test('tier weights sum to 1 and every per-field pool does too', () => {
  const total = GIFT_TIERS.reduce((sum, tier) => sum + tier.weight, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `tier weights sum to ${total}`);

  // The pools are private, so they are read back out of the source: a pool that
  // sums to 0.98 silently starves its last option rather than throwing.
  const poolBlock = giftSrc.slice(giftSrc.indexOf('const TIER_POOLS'), giftSrc.indexOf('export const LEGENDARY_LOOKS'));
  const tables = poolBlock.match(/\{ [^{}]*: [\d.]+[^{}]*\}/g) ?? [];
  assert.ok(tables.length >= 27, `expected a weight table per field per tier, found ${tables.length}`);
  for (const table of tables) {
    const weights = [...table.matchAll(/:\s*([\d.]+)/g)].map((m) => Number(m[1]));
    const sum = weights.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `weight table sums to ${sum}: ${table}`);
  }
});

test('the tier distribution matches the published table', () => {
  // One draw per visitor, so the published weight *is* the rate a visitor sees.
  const rng = seededRng(31337);
  const counts = Object.fromEntries(GIFT_TIERS.map((tier) => [tier.id, 0]));
  const N = 400000;
  for (let i = 0; i < N; i++) {
    counts[drawMascotGift(rng).tier.id] += 1;
  }
  for (const tier of GIFT_TIERS) {
    const observed = (counts[tier.id] / N) * 100;
    const expected = tier.weight * 100;
    assert.ok(Math.abs(observed - expected) < 0.5,
      `${tier.id}: ${observed.toFixed(2)}% vs expected ${expected}%`);
  }
});

test('a legendary is always legible as one', () => {
  // Statistical rarity is not perceived rarity: a look that is merely unlikely
  // but reads as ordinary makes the gold burst a lie. Every authored legendary
  // has to carry at least two traits a visitor can actually point at.
  for (const look of LEGENDARY_LOOKS) {
    assert.ok(countSignatureTraits(look) >= 2,
      `legendary "${look.name}" carries only ${countSignatureTraits(look)} signature trait(s)`);
  }
  assert.equal(new Set(LEGENDARY_LOOKS.map((l) => l.name)).size, LEGENDARY_LOOKS.length,
    'legendary names must be distinct');
});

test('skin tone is never a rarity signal', () => {
  // Weighting a skin tone by tier would make it a marker of rarity. Every tier
  // must draw all four evenly, so the share stays flat across the whole range.
  const rng = seededRng(24);
  for (const tier of GIFT_TIERS) {
    const counts = {};
    let drawn = 0;
    for (let i = 0; i < 400000 && drawn < 20000; i++) {
        const gift = drawMascotGift(rng);
      if (gift.tier.id !== tier.id) continue;
      counts[gift.cfg.skinTone] = (counts[gift.cfg.skinTone] || 0) + 1;
      drawn += 1;
    }
    assert.equal(Object.keys(counts).length, 4, `${tier.id} does not reach all four skin tones`);
    for (const [tone, count] of Object.entries(counts)) {
      const share = count / drawn;
      assert.ok(Math.abs(share - 0.25) < 0.02,
        `${tier.id} draws ${tone} at ${(share * 100).toFixed(1)}%, not ~25%`);
    }
  }
});

// ---- determinism and presentation ----
test('the same seed always produces the same character', () => {
  const run = () => {
    const rng = seededRng(90210);
    return Array.from({ length: 50 }, () => JSON.stringify(drawMascotGift(rng)));
  };
  assert.deepEqual(run(), run());
});

test('the draw is stateless — a visitor draws once and nothing carries over', () => {
  // With rerolls gone there is no pity counter and no repeat-guard, so a draw
  // must depend on nothing but its rng. Interleaving two seeded streams has to
  // leave both identical to running them alone.
  const alone = (seed) => { const r = seededRng(seed);
    return Array.from({ length: 30 }, () => JSON.stringify(drawMascotGift(r))); };
  const a = seededRng(11), b = seededRng(22);
  const interleavedA = [], interleavedB = [];
  for (let i = 0; i < 30; i++) {
    interleavedA.push(JSON.stringify(drawMascotGift(a)));
    interleavedB.push(JSON.stringify(drawMascotGift(b)));
  }
  assert.deepEqual(interleavedA, alone(11));
  assert.deepEqual(interleavedB, alone(22));
});

test('every drawn character carries a tier and a name', () => {
  // The name is the only thing the card says about a character besides the
  // tier, so an unnamed draw would reveal a blank line where the identity goes.
  const rng = seededRng(88);
  for (let i = 0; i < 20000; i++) {
    const { tier, cfg, name } = drawMascotGift(rng);
    assert.ok(GIFT_TIERS_BY_ID[cfg.tier], `cfg.tier "${cfg.tier}" is not a real tier`);
    assert.equal(cfg.tier, tier.id, 'cfg.tier must match the drawn tier');
    assert.equal(typeof name, 'string', `${tier.id} produced no name`);
    assert.ok(name.length > 0, `${tier.id} produced an empty name`);
  }
});

test('names are distinct across every tier', () => {
  // A name shared between a common and a legendary would make the rarest
  // result indistinguishable from the most ordinary one in conversation.
  const all = [...Object.values(GIFT_NAMES).flat(), ...LEGENDARY_LOOKS.map((l) => l.name)];
  assert.equal(new Set(all).size, all.length, 'two characters share a name');
  for (const tier of GIFT_TIERS) {
    if (tier.id === 'legendary') continue;
    assert.ok((GIFT_NAMES[tier.id] ?? []).length >= 5,
      `${tier.id} has too few names to feel varied`);
  }
});

test('a tier carries only its label and its accent — never a ceremony', () => {
  // Every visitor gets one gift and the same full ceremony. If a tier ever grew
  // timing or intensity fields again, most people would be quietly downgraded
  // to a lesser version of the only reveal they will ever see.
  const CEREMONY = ['strain', 'amp', 'omega', 'thumps', 'bursts', 'bloom', 'pulse'];
  for (const tier of GIFT_TIERS) {
    for (const key of ['id', 'name', 'accent', 'weight']) {
      assert.ok(tier[key] !== undefined, `${tier.id} is missing ${key}`);
    }
    for (const key of CEREMONY) {
      assert.equal(tier[key], undefined,
        `${tier.id} carries "${key}" — the ceremony must not vary by tier`);
    }
  }
});
