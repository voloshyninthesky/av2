import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The commercial layer of the site is all in <head> and in the deploy workflow,
// where nothing renders and so nothing looks broken when it goes missing: a page
// without the analytics tag simply reports no visits, a page without og:image
// simply shares as a bare link, and 404.html not being copied into _site fails
// completely silently — the drums page shipped without og:image for exactly that
// reason. These tests make each of those a visible failure instead.

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const GOATCOUNTER = 'https://count.artvibe.com.pl/count';

const LESSON_PAGES = [
  'index.html',
  'uroky-vokalu-lodz/index.html',
  'uroky-hitary-lodz/index.html',
  'uroky-fortepiano-lodz/index.html',
  'uroky-barabaniv-lodz/index.html',
];
const ALL_PAGES = [...LESSON_PAGES, 'stage/index.html'];

test('every page carries the analytics tag', async () => {
  for (const page of ALL_PAGES) {
    const html = await read(page);
    assert.ok(html.includes(`data-goatcounter="${GOATCOUNTER}"`), `${page} is missing the GoatCounter site code`);
    assert.ok(html.includes('gc.zgo.at/count.js'), `${page} is missing the GoatCounter script`);
  }
});

test('lesson pages load the booking-click module', async () => {
  for (const page of LESSON_PAGES) {
    const html = await read(page);
    assert.match(html, /src="\/js\/lessons-analytics\.js\?v=/, `${page} does not load lessons-analytics.js`);
  }
});

test('404 page recovers the visitor', async () => {
  const html = await read('404.html');
  assert.match(html, /<html lang="uk">/);
  assert.match(html, /<meta name="robots" content="noindex/, '404 must not be indexed');
  assert.match(html, /\/css\/lessons\.css/, '404 should wear the same skin as the rest of the site');
  assert.match(html, /href="\/"/, '404 needs a way home');
  assert.match(html, /https:\/\/ig\.me\/m\/artvibe\.pl/, '404 needs a booking link');
  for (const path of ['/uroky-vokalu-lodz/', '/uroky-hitary-lodz/', '/uroky-fortepiano-lodz/', '/uroky-barabaniv-lodz/']) {
    assert.ok(html.includes(`href="${path}"`), `404 does not link to ${path}`);
  }
  // Prices live in the tables that sync-prices.mjs owns; a hand-written amount
  // here would go stale the first time prices.json changes.
  assert.doesNotMatch(html, /\d+\s*зл/, '404 must not quote prices');
});

test('the deploy workflow actually ships the 404 page', async () => {
  const workflow = await read('.github/workflows/deploy-pages.yml');
  const copyLine = workflow.split('\n').find((line) => line.trim().startsWith('cp -R '));
  assert.ok(copyLine, 'no cp -R line found in the deploy workflow');
  assert.match(copyLine, /\s404\.html\s/, '404.html is not copied into _site, so GitHub Pages will never serve it');
});

test('the 404 page stays out of the sitemap', async () => {
  const sitemap = await read('sitemap.xml');
  assert.doesNotMatch(sitemap, /404/);
});

// The stage funnel can only be watched in a browser with a live WebGL context,
// and a hook that quietly stops being called reports "no visitors" rather than
// failing — so pin the call sites here instead. Scanning the whole tree keeps
// these about the funnel and not about which module the function lives in.
const appSources = await (async () => {
  const root = fileURLToPath(new URL('../js/', import.meta.url));
  const names = await readdir(root, { recursive: true });
  const files = names.filter((name) => name.endsWith('.js')).map((name) => join(root, name));
  return Promise.all(files.map((file) => readFile(file, 'utf8')));
})();

function functionSource(name) {
  for (const source of appSources) {
    const start = source.indexOf(`function ${name}(`);
    if (start === -1) continue;
    const end = source.indexOf('\n}', start + 1);
    assert.notEqual(end, -1, `unterminated function ${name}`);
    return source.slice(start, end + 2);
  }
  assert.fail(`missing function ${name}`);
}

test('the stage funnel is wired to the paths visitors actually take', () => {
  // The scene auto-enters once assets load — #enter-btn is never enabled — so
  // both start paths have to report, or a whole session goes uncounted.
  for (const name of ['startExperience', 'startWithoutIntro']) {
    assert.match(functionSource(name), /trackOnce\('stage-enter'\)/, name);
  }
  // Every instrument route funnels through addVibe; hooking anything narrower
  // would miss the keyboard and pad paths.
  assert.match(functionSource('addVibe'), /trackOnce\('stage-first-play'\)/);
});

test('booking links never depend on analytics succeeding', async () => {
  for (const file of ['js/core/analytics.js', 'js/lessons-analytics.js']) {
    const source = await read(file);
    assert.match(source, /try\s*\{[^}]*goatcounter/s, `${file} must not let a blocked beacon throw`);
    assert.match(source, /catch/, `${file} must swallow analytics failures`);
  }
});

test('the stage loads the minified three build', async () => {
  const html = await read('stage/index.html');
  assert.match(html, /"three":\s*"\/vendor\/three\/build\/three\.module\.min\.js"/, 'importmap does not point at the minified build');
  // The addons under three/addons/ are the unminified r160 sources and import
  // bare 'three', so the minified build has to stay on the same revision.
  const min = await import(new URL('../vendor/three/build/three.module.min.js', import.meta.url));
  assert.equal(min.REVISION, '160', 'vendored minified three is not r160');
});
