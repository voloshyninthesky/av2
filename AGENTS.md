# AGENTS.md

## Cursor Cloud specific instructions

This is a **static WebGL site** (Art Vibe Studio) — no build step, no package manager, and no lint
config. Three.js is vendored under `vendor/three/`, loaded via an import map in `stage/index.html`.
The dependency-free audio lifecycle tests use Node's built-in test runner. See `SPEC.md` for the
full product/architecture spec.

### Code layout

The site root (`index.html` plus the `uroky-*-lodz/` pages) is the static lesson site — plain HTML,
no stage code. The 3D stage lives at `stage/index.html` and loads exactly one module, `js/main.js`,
which owns boot order, cross-module wiring and the frame loop. Because the stage is served from
`/stage/`, every asset path it reaches for — in HTML, in the import map, and in `fetch()` calls from
JS — is site-absolute (`/js/…`, `/prices.json`, `/img/…`); a document-relative one would look inside
`/stage/`. Everything else lives in a themed directory:

| directory | owns |
| --- | --- |
| `js/core/` | error collector, Telegram guards, quality tier + stage lighting, session flags, studio assembly |
| `js/view/` | render rig, focus framing, close-up camera, pointer routing, viewport guards |
| `js/scene/` | procedural textures, stage geometry, lighting, backdrop screen + slideshow, particle effects |
| `js/instruments/` | procedural drums / piano / guitar / mic and their shared materials |
| `js/mascot/` | appearance, poses, walk collision, wardrobe editor, per-frame update |
| `js/play/` | vibe meter, loop pedal, guitar, pads, piano notes, mixer, shared performance state |
| `js/shell/` | post-processing probe, intro flow, headless QA hooks |

Two conventions to preserve when editing:

- **Imports go one way.** A module imports only from modules below it in that chain. Where a feature
  genuinely needs a back-reference (recording has to close held notes; a close-up has to interrupt
  the pads), the callback is injected from `main.js` through that module's `init*()` function rather
  than imported. Adding an upward import re-introduces the cycle this layout exists to prevent.
- **Keep every file under ~1000 lines.** Split by responsibility when one grows past that.

Shared mutable state has explicit homes — `js/core/session.js` (started / fly-in), `js/play/state.js`
(what is held down on every input route), `js/mascot/state.js` — rather than being scattered `let`s.

### Running (development)

Serve the repo root over HTTP (opening the pages via `file://` breaks ES module import maps and the
site-absolute paths):

```
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open http://127.0.0.1:8000 for the lesson site, or http://127.0.0.1:8000/stage/ for the 3D
stage. `python3` is preinstalled; there is nothing to install, so the startup update script is
effectively a no-op.

### Notes / gotchas

- The intro screen shows an "enter" button (`#enter-btn`) reading `ЗАВАНТАЖЕННЯ…`, but the stage
  enters itself once assets load — nothing ever enables the button, and its click handler is
  vestigial. Wait for `window.__sceneReady` rather than trying to click it.
- Audio needs a user gesture to unlock; sound stays silent until you enter the scene / interact.
- Desktop keyboard plays instruments without focusing them: `1–8` piano, `Z X C V B` drums,
  chord row + `Space` guitar, `N M , . /` vocal. Toasts like `Звучить: Гітара` confirm play.
- Test: `node --test tests/*.test.mjs`. Deployment runs this check, then copies the static files to
  GitHub Pages; there is no build to run locally. The audio-lifecycle suite asserts on source text
  across all of `js/**/*.js`, so it follows code that moves between modules.
- Verifying the 3D stage in a headless / backgrounded browser: load
  `/stage/?testhooks=1&headless=1`. A hidden tab never fires `requestAnimationFrame` (black canvas, no
  `window.__sceneReady`), and `headless` pumps the frame loop from a worker instead. `setTimeout` is
  also throttled to ~1Hz there, so in-page test scripts should drive their waits off
  `requestAnimationFrame`. `window.__THREE_GAME_DIAGNOSTICS__.renderer` and
  `window.__THREE_GAME_TEST_HOOKS__.state` give a stable before/after fingerprint for refactors.
