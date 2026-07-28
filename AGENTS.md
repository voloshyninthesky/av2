# AGENTS.md

## Cursor Cloud specific instructions

This is a **static WebGL site** (Art Vibe Studio) — no build step, no package manager, no
automated tests, and no lint config. Three.js is vendored under `vendor/three/`, loaded via an
import map in `index.html`. See `SPEC.md` for the full product/architecture spec.

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
- Lint / test / build: none exist. Deployment (`.github/workflows/deploy-pages.yml`) just copies
  static files to GitHub Pages; there is no build to run locally.
