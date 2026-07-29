# AGENTS.md

## Cursor Cloud specific instructions

This is a **static WebGL site** (Art Vibe Studio) — no build step, no package manager, and no lint
config. Three.js is vendored under `vendor/three/`, loaded via an import map in `index.html`.
The dependency-free audio lifecycle tests use Node's built-in test runner. See `SPEC.md` for the
full product/architecture spec.

### Running (development)

Serve the repo root over HTTP (opening `index.html` via `file://` breaks ES module import maps):

```
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open http://127.0.0.1:8000. `python3` is preinstalled; there is nothing to install, so the
startup update script is effectively a no-op.

### Notes / gotchas

- The intro screen shows an "enter" button (`#enter-btn`) that starts as `ЗАВАНТАЖЕННЯ…` (loading)
  and becomes enabled (`ВИЙТИ НА СЦЕНУ ›`) once assets load — you must click it to render the 3D stage.
- Audio needs a user gesture to unlock; sound stays silent until you enter the scene / interact.
- Desktop keyboard plays instruments without focusing them: `1–8` piano, `Z X C V B` drums,
  chord row + `Space` guitar, `N M , . /` vocal. Toasts like `Звучить: Гітара` confirm play.
- Test: `node --test tests/audio-lifecycle.test.mjs`. Deployment runs this check, then copies the
  static files to GitHub Pages; there is no build to run locally.
