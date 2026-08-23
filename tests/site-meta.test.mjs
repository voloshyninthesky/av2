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

const UK_PAGES = [
  'index.html',
  'uroky-vokalu-lodz/index.html',
  'uroky-hitary-lodz/index.html',
  'uroky-fortepiano-lodz/index.html',
  'uroky-barabaniv-lodz/index.html',
];
const PL_PAGES = [
  'pl/index.html',
  'pl/lekcje-spiewu-lodz/index.html',
  'pl/lekcje-gitary-lodz/index.html',
  'pl/lekcje-pianina-lodz/index.html',
  'pl/lekcje-perkusji-lodz/index.html',
  'pl/polityka-prywatnosci/index.html',
];
const LESSON_PAGES = [...UK_PAGES, ...PL_PAGES];
const ALL_PAGES = [...LESSON_PAGES, 'stage/index.html'];

/** Every page, and the page the other language serves it from. */
const COUNTERPARTS = [
  ['index.html', '/pl/'],
  ['404.html', '/pl/'],
  ['uroky-vokalu-lodz/index.html', '/pl/lekcje-spiewu-lodz/'],
  ['uroky-hitary-lodz/index.html', '/pl/lekcje-gitary-lodz/'],
  ['uroky-fortepiano-lodz/index.html', '/pl/lekcje-pianina-lodz/'],
  ['uroky-barabaniv-lodz/index.html', '/pl/lekcje-perkusji-lodz/'],
  ['pl/index.html', '/'],
  ['pl/lekcje-spiewu-lodz/index.html', '/uroky-vokalu-lodz/'],
  ['pl/lekcje-gitary-lodz/index.html', '/uroky-hitary-lodz/'],
  ['pl/lekcje-pianina-lodz/index.html', '/uroky-fortepiano-lodz/'],
  ['pl/lekcje-perkusji-lodz/index.html', '/uroky-barabaniv-lodz/'],
  // No Ukrainian privacy notice exists, so this one switch lands on the hub.
  ['pl/polityka-prywatnosci/index.html', '/'],
];

test('no page loads a third-party analytics script', async () => {
  for (const page of ALL_PAGES) {
    const html = await read(page);
    assert.doesNotMatch(html, /data-goatcounter=|gc\.zgo\.at/, `${page} still loads GoatCounter`);
  }
});

test('lesson pages load the booking-click module', async () => {
  for (const page of LESSON_PAGES) {
    const html = await read(page);
    assert.match(html, /src="\/js\/lessons-analytics\.js\?v=/, `${page} does not load lessons-analytics.js`);
  }
});

// The Polish pages are deliberately outside the SEO surface: the Ukrainian
// slugs carry the search intent this studio is found by, and a second set of
// pages for the same four lessons in the same city would only compete with
// them. Nothing renders when that slips — a page just quietly starts ranking —
// so each of the ways back into the index is pinned here. Crawling stays
// allowed in robots.txt on purpose: a crawler has to fetch the page to read the
// noindex, and a Disallow would leave it guessing instead.
test('the Polish pages stay out of search', async () => {
  for (const page of PL_PAGES) {
    const html = await read(page);
    assert.match(html, /<html lang="pl">/, `${page} is not marked as Polish`);
    assert.match(html, /<meta name="robots" content="noindex/, `${page} must be noindex`);
    assert.doesNotMatch(html, /rel="canonical"/, `${page} must not claim a canonical URL`);
    assert.doesNotMatch(html, /rel="alternate"/, `${page} must not annotate a language alternate`);
    assert.doesNotMatch(html, /application\/ld\+json/, `${page} must carry no structured data`);
  }
});

test('the sitemap submits only the Ukrainian pages', async () => {
  const sitemap = await read('sitemap.xml');
  assert.doesNotMatch(sitemap, /\/pl\//, 'the Polish pages must not be submitted for indexing');
});

test('the deploy workflow actually ships the Polish pages', async () => {
  const workflow = await read('.github/workflows/deploy-pages.yml');
  const copyLine = workflow.split('\n').find((line) => line.trim().startsWith('cp -R '));
  assert.ok(copyLine, 'no cp -R line found in the deploy workflow');
  assert.match(copyLine, /\spl\s/, 'pl is not copied into _site, so the Polish pages never ship');
});

// A switch that drops everyone on the home page is the usual way a two-language
// site rots: it still "works", so nothing complains, and the visitor loses their
// place every time they use it. Each page names its own counterpart instead.
test('every page offers the same page in the other language', async () => {
  for (const [page, counterpart] of COUNTERPARTS) {
    const html = await read(page);
    // The label is UA, the language code is uk — the country and the language
    // do not share an abbreviation, and the visitor is looking for the flag-ish
    // one while the markup owes browsers the correct one.
    const other = page.startsWith('pl/') ? 'uk' : 'pl';
    const label = other === 'uk' ? 'UA' : 'PL';
    assert.ok(
      html.includes(`<a href="${counterpart}" lang="${other}" hreflang="${other}">${label}</a>`),
      `${page} does not offer ${counterpart} as its ${label} counterpart`,
    );
    assert.match(
      html,
      /<span class="is-current" aria-current="true">(UA|PL)<\/span>/,
      `${page} does not mark which language is showing`,
    );
  }
});

// Words in a stylesheet are invisible to every check that reads the HTML, and
// one stylesheet now dresses two languages: the lesson cards' «детальніше »»
// shipped on the Polish pages for exactly that reason. Any Cyrillic `content:`
// needs a :lang(pl) counterpart, or the Polish pages quietly speak Ukrainian.
test('every Cyrillic label generated by CSS has a Polish counterpart', async () => {
  const css = await read('css/lessons.css');
  const cyrillic = /[Ѐ-ӿ]/;
  let checked = 0;
  for (const [, block, body] of css.matchAll(/([^{}]+)\{([^{}]*content:[^{}]*)\}/g)) {
    const label = body.match(/content:\s*'([^']*)'/)?.[1];
    if (!label || !cyrillic.test(label)) continue;
    // The capture runs back to the previous brace, so it carries the rule's
    // comment and blank lines with it; the selector is its last line.
    const selector = block.trim().split('\n').pop().trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      css,
      new RegExp(`:lang\\(pl\\)\\s*${selector}\\s*\\{`),
      `${selector} prints "${label}" on the Polish pages too — it needs a :lang(pl) rule`,
    );
    checked++;
  }
  assert.ok(checked > 0, 'found no CSS-generated labels at all — has the regex stopped matching?');
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
  // The gift is the first-run step, so it reports on open. `trackOnce`, never
  // `track`: a visitor with cleared storage could otherwise re-report on every
  // visit and skew the four-step funnel this dashboard exists to show.
  assert.match(functionSource('beginGiftCeremony'), /trackOnce\('stage-gift-open'\)/);
  assert.doesNotMatch(functionSource('beginGiftCeremony'), /[^e]track\(/);
  assert.doesNotMatch(functionSource('fireBurst'), /[^e]track\(/);
});

test('the gift ceremony never creates an AudioContext', () => {
  // The gift only ever opens from the camera fly-in, which is not a user
  // gesture, so it must not unlock audio by any route — silence before a real
  // sound action is a standing rule. There is no longer a gesture-opened path.
  const source = functionSource('beginGiftCeremony');
  assert.doesNotMatch(source, /audio\.(unlock|init|resume)\(/,
    'beginGiftCeremony must not touch the audio context directly');
  assert.doesNotMatch(source, /activateAudioForSound/,
    'the gift has no gesture-opened path left, so it must never unlock audio');
});

// A latched :hover is the quietest bug the stage can ship. iOS applies :hover on
// tap and keeps it until the next tap elsewhere, so an unguarded rule leaves the
// control looking chosen-but-not-fired — which nobody files, because it looks
// like a design decision. `:focus-visible` must stay outside the query (SPEC §12
// wants keyboard focus visible), so splitting a combined rule is the trap here.
test('every :hover on the stage is behind @media (hover: hover)', async () => {
  const css = await read('css/style.css');
  const open = [];
  const unguarded = [];
  let seen = 0;
  css.split('\n').forEach((line, index) => {
    let pending = null;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '@') {
        const rest = line.slice(i);
        const brace = rest.indexOf('{');
        pending = (brace === -1 ? rest : rest.slice(0, brace)).trim();
      }
      if (line[i] === '{') { open.push(pending); pending = null; }
      if (line[i] === '}') open.pop();
    }
    if (!line.includes(':hover')) return;
    seen++;
    if (!open.some((rule) => rule && /hover:\s*hover/.test(rule))) {
      unguarded.push(`${index + 1}: ${line.trim()}`);
    }
  });
  assert.ok(seen > 0, 'found no :hover rules at all — has the stylesheet moved?');
  assert.deepEqual(unguarded, [], 'these latch on touch:');
});

// `.panel *` keeps rules and pricing copyable. Applied to a control it means a
// press with a little drag highlights the label instead of firing the button.
test('panel controls are exempt from the panel text-selection rule', async () => {
  const css = await read('css/style.css');
  assert.match(
    css,
    /\.panel\s*:is\([^)]*button[^)]*\)\s*\{[^}]*user-select:\s*none/s,
    '.panel * makes every modal button selectable — controls need an exclusion',
  );
});

// Two stamps in one module graph and the browser holds two copies of the same
// module, each importing the other's ghosts. Grep cannot see it on a running
// page — the stale reference lives only inside a cached response — but it can
// see it here. `notes/Gotchas.md` — "The cache stamp is a find-and-replace".
// Data files (`/prices.json`) carry their own stamp on purpose: they change on
// a different cadence and a stale one only serves stale prices, not two
// versions of one module.
test('the whole module graph carries one cache stamp', async () => {
  const stageHtml = await read('stage/index.html');
  const stamps = new Map();
  for (const source of [...appSources, stageHtml]) {
    for (const [, path, value] of source.matchAll(/([\w./-]+\.(?:js|css))\?v=([0-9A-Za-z.-]+)/g)) {
      if (!stamps.has(value)) stamps.set(value, path);
    }
  }
  const found = [...stamps].map(([value, path]) => `${value} (${path})`).sort();
  assert.equal(stamps.size, 1, `the stage must load one stamp, found: ${found.join(', ')}`);
});

test('the stage loads the minified three build', async () => {
  const html = await read('stage/index.html');
  assert.match(html, /"three":\s*"\/vendor\/three\/build\/three\.module\.min\.js"/, 'importmap does not point at the minified build');
  // The addons under three/addons/ are the unminified r160 sources and import
  // bare 'three', so the minified build has to stay on the same revision.
  const min = await import(new URL('../vendor/three/build/three.module.min.js', import.meta.url));
  assert.equal(min.REVISION, '160', 'vendored minified three is not r160');
});
