import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// The lesson pages print prices as static HTML — they load no JavaScript, so the
// numbers cannot be read from prices.json at render time. That makes prices.json
// and the pages two copies of the same facts. These tests make the copies a
// checked contract: every price cell carries data-price="<key>", and the key set
// plus every value has to match prices.json exactly. Editing prices.json without
// republishing the pages fails here instead of silently quoting stale prices.
//
// The Polish pages are the same facts in another language, so they are the same
// contract with different words: prices.json carries the Polish currency symbol,
// promotion copy and payment note beside the Ukrainian ones, and a page is
// checked against its own locale. Half a translation fails here too.

const prices = JSON.parse(await readFile(new URL('../prices.json', import.meta.url), 'utf8'));

const LOCALES = {
  uk: {
    currency: prices.currency.display,
    promotion: (p) => p.description,
    paymentNote: prices.paymentNote,
  },
  pl: {
    currency: prices.currency.displayPl,
    promotion: (p) => p.descriptionPl,
    paymentNote: prices.paymentNotePl,
  },
};

const pricesFor = (id) => prices.instruments.find((instrument) => instrument.id === id);

/** Every price key the source data implies, as key -> rendered cell text. */
function expectedFor(instruments, { packages = true, lang = 'uk' } = {}) {
  const { currency } = LOCALES[lang];
  const expected = new Map();
  for (const instrument of instruments) {
    for (const lesson of instrument.singleLessons) {
      expected.set(`single:${instrument.id}:${lesson.durationMinutes}`, `${lesson.price} ${currency}`);
    }
    if (!packages) continue;
    for (const tier of instrument.subscriptions) {
      for (const pack of tier.packages) {
        expected.set(
          `pack:${instrument.id}:${tier.durationMinutes}:${pack.lessons}`,
          `${pack.price} ${currency}`,
        );
      }
    }
  }
  return expected;
}

/** Every price cell the page actually renders, as key -> cell text. */
function renderedIn(html) {
  const found = new Map();
  const cell = /<td data-price="([^"]+)">([^<]+)<\/td>/g;
  for (const [, key, value] of html.matchAll(cell)) {
    assert.equal(found.has(key), false, `duplicate price cell for "${key}"`);
    found.set(key, value.trim());
  }
  return found;
}

const pages = [
  { file: 'uroky-vokalu-lodz/index.html', instrument: 'vocal', lang: 'uk' },
  { file: 'uroky-hitary-lodz/index.html', instrument: 'guitar', lang: 'uk' },
  { file: 'uroky-fortepiano-lodz/index.html', instrument: 'piano', lang: 'uk' },
  { file: 'uroky-barabaniv-lodz/index.html', instrument: 'drums', lang: 'uk' },
  { file: 'pl/lekcje-spiewu-lodz/index.html', instrument: 'vocal', lang: 'pl' },
  { file: 'pl/lekcje-gitary-lodz/index.html', instrument: 'guitar', lang: 'pl' },
  { file: 'pl/lekcje-pianina-lodz/index.html', instrument: 'piano', lang: 'pl' },
  { file: 'pl/lekcje-perkusji-lodz/index.html', instrument: 'drums', lang: 'pl' },
];

const hubs = [
  { file: 'index.html', lang: 'uk' },
  { file: 'pl/index.html', lang: 'pl' },
];

// JSON-LD lives only on the Ukrainian pages: the Polish ones are deliberately
// outside the SEO surface (tests/site-meta.test.mjs pins that), so there is no
// structured data on them to keep in step with prices.json.
const structured = pages.filter((page) => page.lang === 'uk');

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

for (const { file, instrument, lang } of pages) {
  test(`${file} prices match prices.json`, async () => {
    const html = await read(file);
    const priced = pricesFor(instrument);
    assert.ok(priced, `prices.json does not price "${instrument}"`);

    const expected = expectedFor([priced], { lang });
    const rendered = renderedIn(html);

    assert.deepEqual(
      [...rendered.keys()].sort(),
      [...expected.keys()].sort(),
      'page shows a different set of prices than prices.json defines',
    );
    for (const [key, value] of expected) {
      assert.equal(rendered.get(key), value, `stale price for "${key}"`);
    }
  });

  test(`${file} shows no other instrument's prices`, async () => {
    const html = await read(file);
    // Keys are single:<instrument>:<minutes> / pack:<instrument>:<minutes>:<lessons>.
    for (const key of renderedIn(html).keys()) {
      assert.equal(key.split(':')[1], instrument, `page quotes another instrument in "${key}"`);
    }
  });
}

for (const { file, lang } of hubs) {
  test(`${file} shows the single-lesson price of every instrument`, async () => {
    const html = await read(file);
    const expected = expectedFor(prices.instruments, { packages: false, lang });
    const rendered = renderedIn(html);

    assert.deepEqual(
      [...rendered.keys()].sort(),
      [...expected.keys()].sort(),
      'hub shows a different set of prices than prices.json defines',
    );
    for (const [key, value] of expected) {
      assert.equal(rendered.get(key), value, `stale price for "${key}"`);
    }
  });
}

test('every page carries the promotions in its own language', async () => {
  for (const { file, lang } of [...pages, ...hubs]) {
    const html = await read(file);
    const other = lang === 'uk' ? 'pl' : 'uk';
    for (const promotion of prices.promotions) {
      assert.ok(
        html.includes(LOCALES[lang].promotion(promotion)),
        `${file} is missing the ${lang} promotion "${LOCALES[lang].promotion(promotion)}"`,
      );
      assert.ok(
        !html.includes(LOCALES[other].promotion(promotion)),
        `${file} still carries the ${other} promotion copy`,
      );
    }
  }
});

test('pages listing subscriptions explain what the package price covers', async () => {
  for (const { file, lang } of pages) {
    const html = await read(file);
    assert.ok(html.includes(LOCALES[lang].paymentNote), `${file} is missing the ${lang} payment note`);
  }
});

// Prices appear only in the price tables. Marketing copy elsewhere on the page
// deliberately names no amount, so there is no second place for one to go stale.

test('marketing copy outside the price tables quotes no amount', async () => {
  for (const { file, lang } of [...pages, ...hubs]) {
    const html = await read(file);
    const { currency } = LOCALES[lang];
    const outside = html.replace(/<td data-price="[^"]+">[^<]*<\/td>/g, '');
    // \b is ASCII-only in JS, so it never matches after a Cyrillic «зл» —
    // a Unicode lookahead is what actually ends the word here. The Polish «zł»
    // ends in a letter too, so the same lookahead does the same job.
    const quoted = outside.match(new RegExp(`\\d+\\s*${currency}(?!\\p{L})`, 'gu'));
    assert.equal(
      quoted,
      null,
      `${file} quotes ${quoted?.join(', ')} outside the price table — ` +
        'prices.json can no longer keep it current',
    );
  }
});

// --- JSON-LD: the structured data quotes the same prices as prices.json ---

const everyPrice = (instrument) => [
  ...instrument.singleLessons.map((l) => l.price),
  ...instrument.subscriptions.flatMap((s) => s.packages.map((p) => p.price)),
];

function jsonLdGraph(html, file) {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
  assert.equal(scripts.length, 1, `${file} should carry exactly one JSON-LD block`);
  const parsed = JSON.parse(scripts[0][1]);
  assert.ok(Array.isArray(parsed['@graph']), `${file} JSON-LD has no @graph`);
  return parsed['@graph'];
}

test('lesson pages carry an AggregateOffer matching prices.json', async () => {
  for (const { file, instrument } of structured) {
    const graph = jsonLdGraph(await read(file), file);
    const service = graph.find((n) => n['@type'] === 'Service');
    assert.ok(service, `${file} has no Service node`);
    const all = everyPrice(pricesFor(instrument));
    assert.equal(service.offers['@type'], 'AggregateOffer');
    assert.equal(service.offers.priceCurrency, prices.currency.code, `${file} wrong currency`);
    assert.equal(service.offers.lowPrice, Math.min(...all), `${file} stale lowPrice`);
    assert.equal(service.offers.highPrice, Math.max(...all), `${file} stale highPrice`);
  }
});

test('every page names the school with a priceRange matching prices.json', async () => {
  const all = prices.instruments.flatMap(everyPrice);
  const expected = `${Math.min(...all)}-${Math.max(...all)} PLN`;
  for (const { file } of [...structured, { file: 'index.html' }]) {
    const graph = jsonLdGraph(await read(file), file);
    const school = graph.find((n) => Array.isArray(n['@type']) && n['@type'].includes('MusicSchool'));
    assert.ok(school, `${file} has no MusicSchool node`);
    assert.equal(school.priceRange, expected, `${file} stale priceRange`);
  }
});

test('lesson-page breadcrumbs point at the canonical URLs', async () => {
  for (const { file } of structured) {
    const html = await read(file);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)[1];
    const graph = jsonLdGraph(html, file);
    const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList');
    assert.ok(crumbs, `${file} has no BreadcrumbList`);
    assert.equal(crumbs.itemListElement.at(-1).item, canonical, `${file} breadcrumb != canonical`);
  }
});
