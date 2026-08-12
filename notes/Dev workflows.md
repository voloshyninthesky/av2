---
tags: [workflow, reference]
---

# Dev workflows

There is nothing to install and nothing to build. `python3` and `node` are enough.

## Serve

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Serve the **repo root**, not a subdirectory:

- http://127.0.0.1:8000 — the lesson site
- http://127.0.0.1:8000/stage/ — the 3D stage

`file://` does not work: it breaks ES module import maps and the site-absolute paths
([[Architecture]]).

The stage enters itself once assets are ready — wait for it, don't hunt for a button. The
`#enter-btn` still ships reading `ЗАВАНТАЖЕННЯ…`, but since `7602710` nothing ever enables it
and its click handler is vestigial; `window.__sceneReady` is the signal to wait on. Audio
stays silent until you interact ([[Audio]]).

An unmatched URL shows Python's own "Error response" page, **not** `404.html` —
`http.server` has no fallback-document support, and only GitHub Pages routes to it. Open
`/404.html` directly to preview the real page.

Desktop keyboard, once on stage: `1–8` piano, `Z X C V B` drums, QWERTY row + `Space`
guitar, `N M , . /` vocal. Toasts like `Звучить: Гітара` confirm play. Focus is **not**
required for keyboard sound.

## Test

```bash
node --test tests/*.test.mjs
```

Six suites, no dependencies:

| Suite                        | Guards                                                        |
| ---------------------------- | ------------------------------------------------------------- |
| `audio-lifecycle.test.mjs`   | The [[Audio]] rules — by asserting on source text across `js/**/*.js` |
| `lesson-prices.test.mjs`     | Generated price cells and the no-prices-in-copy rule → [[Prices]] |
| `guitar-gestures.test.mjs`   | Tap-vs-hold classification for chord touches                   |
| `guitar-chords.test.mjs`     | Every generated chord voicing sounds its own chord tones        |
| `chord-wheel.test.mjs`       | The circle of fifths: rotation, relative minors, diatonic degrees and sevenths, piano voicings |
| `emissive-highlight.test.mjs`| Hover glow not leaking through shared materials                |
| `touch-guards.test.mjs`      | The one-shot ghost-click swallower and the double-tap predicate |
| `mascot-gift.test.mjs`       | The gift draw — tiers, pools, and the one-time gate → [[Mascot]] |
| `site-meta.test.mjs`         | Analytics tag, `404.html` shipping, funnel hooks, minified three |

`audio-lifecycle` asserts on **source text** rather than running anything: it reads across
`js/**/*.js`, which survives code moving between modules but can fail on a pure rename.

`guitar-chords` and `chord-wheel` used to need the same trick and no longer do. Both load
`js/play/harmony.js` for real, through `tests/load-module.mjs` — the repo has no `package.json`,
so node reads a `.js` file as CommonJS and cannot import one of the site's ES modules directly,
but a `data:` URL is always parsed as an ES module. That only works for a module importing
nothing itself, which is exactly why `harmony.js` is written that way. The old marker-comment
slicing, and its "chord-maker slice not found" failure mode, are gone with it.

## Verify the 3D stage headlessly

```
/stage/?testhooks=1&headless=1
```

**Both flags, always**, when checking in an automated or backgrounded browser. A hidden tab
never fires `requestAnimationFrame`, so the canvas stays black and `window.__sceneReady`
never flips; `headless` pumps the frame loop from a worker interval instead. `setTimeout` is
also throttled to ~1 Hz there, so in-page waits must be `requestAnimationFrame` loops.
See [[Gotchas]] — this is the single most time-wasting trap in the project.

What the hooks give you:

- `window.__THREE_GAME_TEST_HOOKS__` — `setState` (stage / piano / guitar / drums / mic /
  vibe / dance), a debug `pick(clientX, clientY)` raycast listing, a `scene` handle for
  isolation toggles, a `state` snapshot of view / walk / mascot / camera-distance limits, and
  `captureFrame()` for synchronous canvas capture
- `window.__THREE_GAME_DIAGNOSTICS__.renderer` — renderer counts

Together those two give a stable before/after fingerprint for refactors — capture `state` +
renderer counts before and after, and diff.

Other useful query flags (full table in [[SPEC]] §8): `nointro`, `autoenter`,
`skiponboard`, `shot=pricing|rules|steps|chip|toast`, `anchor=vocal|guitar|drums|piano`,
`sstime`. `testhooks` is never active for visitors.

For camera / fitter / pose math, prefer Node over a browser — import
`vendor/three/build/three.module.js` and port the math. It's deterministic given viewport +
fov. → [[Focus framing]]

## Change checklist

From [[SPEC]] §14, and it is in that order for a reason:

1. **Update code + the `?v=` cache query.** ~217 occurrences of the current stamp across
   `js/` and `stage/index.html`; an inconsistent bump can load two versions of one module.
   `tests/site-meta.test.mjs` now fails on a partial sweep. `prices.json` keeps its own,
   deliberately independent stamp. Bump `audio.js` whenever unlock behaviour changes.
2. **Update [[SPEC]] if contracts or UX change.** Add a line to [[Decisions]] if the
   *reason* changed.
3. **Push to `main`**, then verify the live HTML contains the new `?v=` and the expected
   markup (onboard, pricing mixer, chord wheel, settings mixer).

## Deploy

**Primary — GitHub Pages**, `.github/workflows/deploy-pages.yml`, on push to `main`:

1. `node tools/sync-prices.mjs` — prices land in the pages *before* anything checks them
2. `node --test tests/*.test.mjs`
3. copy an **explicit file list** into `_site/`, then upload + deploy

That list is explicit, which means **a new top-level directory does not ship unless you add
it.** (Also why `notes/` and `.obsidian/` stay out of production automatically.) Current
list: `css fonts img js stage uk uroky-*-lodz vendor index.html favicon.* apple-touch-icon.png
prices.json piano-notes.json robots.txt sitemap.xml .nojekyll CNAME`.

Custom domain `artvibe.com.pl` → `voloshyninthesky.github.io`. Enforce HTTPS in Pages
settings once DNS verifies.

**Live VPS release** — nginx release dirs under `/var/www/vibe2.ton.zone/releases/<UTC>/`
via `deploy/nginx/`. Update all **three** `root` entries, `nginx -t`, reload, and move
`current` only once the new release is ready.

## Related

- [[Gotchas]] — read before debugging anything visual
- [[Architecture]] — why there is no build step
