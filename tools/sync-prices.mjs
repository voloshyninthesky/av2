#!/usr/bin/env node
// Writes prices.json into the static lesson pages.
//
// The pages load no JavaScript, so every price they show is a copy of the data.
// This script makes prices.json the single source those copies are generated
// from: the studio edits prices.json alone, the deploy workflow runs this
// before the tests, and the published pages already agree. Nothing about a
// price change needs a developer or a red build.
//
//   node tools/sync-prices.mjs            rewrite the pages in place
//   node tools/sync-prices.mjs --check    report drift, change nothing, exit 1
//
// Structural edits — a new duration tier, a new instrument, a dropped package
// size — add or remove price *cells*, which this script cannot invent. Those
// still need a developer, and tests/lesson-prices.test.mjs names the missing
// key when it happens.

import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const CHECK = process.argv.includes('--check');

const prices = JSON.parse(await readFile(new URL('prices.json', ROOT), 'utf8'));

// Each locale prints the same numbers in its own words: the currency symbol, the
// promotion copy, the payment note, and the plural of "lesson" in a bonus badge.
// Those live in prices.json beside the Ukrainian originals rather than in this
// script, so adding a promotion is still a one-file edit for the studio — and a
// missing Polish string fails here instead of shipping a half-translated page.
const LOCALES = {
  uk: {
    currency: prices.currency.display,
    promotion: (p) => p.description,
    paymentNote: prices.paymentNote,
    /** 1 урок · 2 уроки · 5 уроків */
    lessonWord(n) {
      const tens = n % 100;
      const ones = n % 10;
      if (ones === 1 && tens !== 11) return 'урок';
      if (ones >= 2 && ones <= 4 && (tens < 12 || tens > 14)) return 'уроки';
      return 'уроків';
    },
  },
  pl: {
    currency: prices.currency.displayPl,
    promotion: (p) => p.descriptionPl,
    paymentNote: prices.paymentNotePl,
    /** 1 lekcja · 2 lekcje · 5 lekcji */
    lessonWord(n) {
      const tens = n % 100;
      const ones = n % 10;
      if (ones === 1 && tens !== 11) return 'lekcja';
      if (ones >= 2 && ones <= 4 && (tens < 12 || tens > 14)) return 'lekcje';
      return 'lekcji';
    },
  },
};

const PAGES = [
  { file: 'index.html', instrument: null, lang: 'uk' },
  { file: 'uroky-vokalu-lodz/index.html', instrument: 'vocal', lang: 'uk' },
  { file: 'uroky-hitary-lodz/index.html', instrument: 'guitar', lang: 'uk' },
  { file: 'uroky-fortepiano-lodz/index.html', instrument: 'piano', lang: 'uk' },
  { file: 'uroky-barabaniv-lodz/index.html', instrument: 'drums', lang: 'uk' },
  // The Polish pages carry no JSON-LD (they are noindex), so only their cells,
  // note and promotions get written; the JSON-LD replaces below miss harmlessly.
  { file: 'pl/index.html', instrument: null, lang: 'pl' },
  { file: 'pl/lekcje-spiewu-lodz/index.html', instrument: 'vocal', lang: 'pl' },
  { file: 'pl/lekcje-gitary-lodz/index.html', instrument: 'guitar', lang: 'pl' },
  { file: 'pl/lekcje-pianina-lodz/index.html', instrument: 'piano', lang: 'pl' },
  { file: 'pl/lekcje-perkusji-lodz/index.html', instrument: 'drums', lang: 'pl' },
];

for (const [lang, locale] of Object.entries(LOCALES)) {
  const missing = [
    !locale.currency && 'currency display',
    !locale.paymentNote && 'payment note',
    ...prices.promotions.map((p, i) => !locale.promotion(p) && `promotions[${i}]`),
  ].filter(Boolean);
  if (missing.length) {
    console.error(`prices.json has no ${lang} text for: ${missing.join(', ')}`);
    process.exit(1);
  }
}

const priceOf = (id) => prices.instruments.find((i) => i.id === id);
const everyPrice = (i) => [
  ...i.singleLessons.map((l) => l.price),
  ...i.subscriptions.flatMap((s) => s.packages.map((p) => p.price)),
];

/** key -> rendered cell text, for every price the data defines. */
const amounts = new Map();
for (const instrument of prices.instruments) {
  for (const lesson of instrument.singleLessons) {
    amounts.set(`single:${instrument.id}:${lesson.durationMinutes}`, lesson.price);
  }
  for (const tier of instrument.subscriptions) {
    for (const pack of tier.packages) {
      amounts.set(`pack:${instrument.id}:${tier.durationMinutes}:${pack.lessons}`, pack.price);
    }
  }
}

const render = (key, locale) => `${amounts.get(key)} ${locale.currency}`;

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function promotionBadge(promotion, locale) {
  if (typeof promotion.valuePercent === 'number') return `−${promotion.valuePercent}%`;
  if (typeof promotion.freeLessons === 'number') {
    return `+${promotion.freeLessons} ${locale.lessonWord(promotion.freeLessons)}`;
  }
  return '★';
}

const unknownKeys = [];

function syncPage(html, instrument, locale) {
  // Price cells in the tables.
  html = html.replace(/(<td data-price=")([^"]+)(">)([^<]*)(<\/td>)/g, (all, a, key, b, _v, c) => {
    if (!amounts.has(key)) return unknownKeys.push(key), all;
    return `${a}${key}${b}${render(key, locale)}${c}`;
  });

  // The note explaining what a package price covers.
  html = html.replace(
    /(<p class="price-note" data-payment-note>)[^<]*(<\/p>)/,
    `$1${escape(locale.paymentNote)}$2`,
  );

  // The discounts / bonuses list.
  html = html.replace(
    /([ \t]*)(<ul class="price-perks" data-promotions>)[\s\S]*?(<\/ul>)/,
    (_all, indent, open, close) => {
      const items = prices.promotions
        .map(
          (p) =>
            `${indent}  <li><b class="perk-badge">${escape(promotionBadge(p, locale))}</b> ` +
            `${escape(locale.promotion(p))}</li>`,
        )
        .join('\n');
      return `${indent}${open}\n${items}\n${indent}${close}`;
    },
  );

  // JSON-LD, edited in place so the block's formatting and key order survive.
  if (instrument) {
    const all = everyPrice(priceOf(instrument));
    html = html
      .replace(/"lowPrice":\d+/, `"lowPrice":${Math.min(...all)}`)
      .replace(/"highPrice":\d+/, `"highPrice":${Math.max(...all)}`);
  }
  const global = prices.instruments.flatMap(everyPrice);
  html = html.replace(
    /"priceRange":"[^"]*"/,
    `"priceRange":"${Math.min(...global)}-${Math.max(...global)} ${prices.currency.code}"`,
  );

  return html;
}

let drifted = 0;
for (const { file, instrument, lang } of PAGES) {
  const url = new URL(file, ROOT);
  const before = await readFile(url, 'utf8');
  const after = syncPage(before, instrument, LOCALES[lang]);
  if (before === after) continue;
  drifted++;
  if (CHECK) console.error(`stale: ${file}`);
  else {
    await writeFile(url, after);
    console.log(`synced: ${file}`);
  }
}

if (unknownKeys.length) {
  console.error(
    `\nprices.json does not define: ${[...new Set(unknownKeys)].join(', ')}\n` +
      'The pages carry a price cell the data no longer has. Adding or removing a\n' +
      'tier changes the table markup, which this script cannot do — edit the pages.',
  );
  process.exit(1);
}

if (CHECK && drifted) {
  console.error(`\n${drifted} page(s) disagree with prices.json — run: node tools/sync-prices.mjs`);
  process.exit(1);
}
if (!drifted) console.log('prices already in sync');
