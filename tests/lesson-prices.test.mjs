import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// The /uk SEO pages print prices as static HTML — they load no JavaScript, so the
// numbers cannot be read from prices.json at render time. That makes prices.json
// and the pages two copies of the same facts. These tests make the copies a
// checked contract: every price cell carries data-price="<key>", and the key set
// plus every value has to match prices.json exactly. Editing prices.json without
// republishing the pages fails here instead of silently quoting stale prices.

const prices = JSON.parse(await readFile(new URL('../prices.json', import.meta.url), 'utf8'));
const currency = prices.currency.display;

const categoryFor = (instrument) =>
  prices.categories.find((category) => category.instruments.includes(instrument));

/** Every price key the source data implies, as key -> rendered cell text. */
function expectedFor(categories, { packages = true } = {}) {
  const expected = new Map();
  for (const category of categories) {
    for (const lesson of category.singleLessons) {
      expected.set(`single:${category.id}:${lesson.durationMinutes}`, `${lesson.price} ${currency}`);
    }
    if (!packages) continue;
    for (const tier of category.subscriptions) {
      for (const pack of tier.packages) {
        expected.set(
          `pack:${category.id}:${tier.durationMinutes}:${pack.lessons}`,
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
  { file: 'uk/uroky-vokalu-lodz/index.html', instrument: 'vocal' },
  { file: 'uk/uroky-hitary-lodz/index.html', instrument: 'guitar' },
  { file: 'uk/uroky-fortepiano-lodz/index.html', instrument: 'piano' },
  { file: 'uk/uroky-barabaniv-lodz/index.html', instrument: 'drums' },
];

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

for (const { file, instrument } of pages) {
  test(`${file} prices match prices.json`, async () => {
    const html = await read(file);
    const category = categoryFor(instrument);
    assert.ok(category, `no price category covers "${instrument}"`);

    const expected = expectedFor([category]);
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

  test(`${file} shows no price from the other category`, async () => {
    const html = await read(file);
    const other = prices.categories.find((c) => c.id !== categoryFor(instrument).id);
    for (const key of renderedIn(html).keys()) {
      assert.equal(key.includes(other.id), false, `page quotes ${other.id} prices`);
    }
  });
}

test('uk/index.html shows the single-lesson price of every category', async () => {
  const html = await read('uk/index.html');
  const expected = expectedFor(prices.categories, { packages: false });
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

test('every page carries the promotions verbatim', async () => {
  for (const { file } of [...pages, { file: 'uk/index.html' }]) {
    const html = await read(file);
    for (const promotion of prices.promotions) {
      assert.ok(
        html.includes(promotion.description),
        `${file} is missing promotion "${promotion.description}"`,
      );
    }
  }
});

test('pages listing subscriptions explain what the package price covers', async () => {
  for (const { file } of pages) {
    const html = await read(file);
    assert.ok(html.includes(prices.paymentNote), `${file} is missing the payment note`);
  }
});

// --- JSON-LD: the structured data quotes the same prices as prices.json ---

const categoryPrices = (category) => [
  ...category.singleLessons.map((l) => l.price),
  ...category.subscriptions.flatMap((s) => s.packages.map((p) => p.price)),
];

function jsonLdGraph(html, file) {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
  assert.equal(scripts.length, 1, `${file} should carry exactly one JSON-LD block`);
  const parsed = JSON.parse(scripts[0][1]);
  assert.ok(Array.isArray(parsed['@graph']), `${file} JSON-LD has no @graph`);
  return parsed['@graph'];
}

test('lesson pages carry an AggregateOffer matching prices.json', async () => {
  for (const { file, instrument } of pages) {
    const graph = jsonLdGraph(await read(file), file);
    const service = graph.find((n) => n['@type'] === 'Service');
    assert.ok(service, `${file} has no Service node`);
    const all = categoryPrices(categoryFor(instrument));
    assert.equal(service.offers['@type'], 'AggregateOffer');
    assert.equal(service.offers.priceCurrency, prices.currency.code, `${file} wrong currency`);
    assert.equal(service.offers.lowPrice, Math.min(...all), `${file} stale lowPrice`);
    assert.equal(service.offers.highPrice, Math.max(...all), `${file} stale highPrice`);
  }
});

test('every page names the school with a priceRange matching prices.json', async () => {
  const all = prices.categories.flatMap(categoryPrices);
  const expected = `${Math.min(...all)}-${Math.max(...all)} PLN`;
  for (const { file } of [...pages, { file: 'uk/index.html' }]) {
    const graph = jsonLdGraph(await read(file), file);
    const school = graph.find((n) => Array.isArray(n['@type']) && n['@type'].includes('MusicSchool'));
    assert.ok(school, `${file} has no MusicSchool node`);
    assert.equal(school.priceRange, expected, `${file} stale priceRange`);
  }
});

test('lesson-page breadcrumbs point at the canonical URLs', async () => {
  for (const { file } of pages) {
    const html = await read(file);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)[1];
    const graph = jsonLdGraph(html, file);
    const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList');
    assert.ok(crumbs, `${file} has no BreadcrumbList`);
    assert.equal(crumbs.itemListElement.at(-1).item, canonical, `${file} breadcrumb != canonical`);
  }
});
