---
tags: [architecture]
---

# Architecture

Static site. **No build step, no package manager, no bundler, no lint config.** Three.js
is vendored under `vendor/three/` and loaded through an import map declared in
`stage/index.html`. What is in the repo is what ships.

That constraint is the whole reason the conventions below exist: there is no tool to catch
a circular import or a broken path, so the layout has to prevent them by hand.

## One entry point

`stage/index.html` loads exactly one module: `js/main.js`. It owns three things and
delegates everything else:

1. **Boot order** — build the render rig, scene, instruments, mascot, HUD, in that order.
2. **Cross-module wiring** — see below.
3. **The frame loop** — one `requestAnimationFrame` driver; per-frame updates are called
   from it, never self-scheduled inside a subsystem.

`initPostprocessing()` runs late, after the scene exists, because it probes the device
before committing to bloom (see [[Decisions]] on quality tiers).

## The layering law

> A module imports only from modules **below** it in the chain.

`main.js` → `shell/` → `play/` → `instruments/` / `mascot/` → `scene/` → `view/` → `core/`

Some features genuinely need a back-reference: recording has to close held notes, a
close-up has to interrupt the pads, the gift reveal has to respawn the mascot. Those are
**not** solved with an upward import. `main.js` injects the callback through that module's
`init*()` function:

```js
initMascotEditor({ respawnMascot, closeSoundMixer, syncInstrumentExposure });
initGuitarPlay({ isGuitarPlayFocus, markHeldTouchGuitarChordUsed });
initLoopPedal({ /* … */ });
```

So the `init*({…})` signature of a module is a precise, readable list of everything it
needs from above it. Adding an upward `import` re-introduces the exact cycle this layout
exists to prevent — and with no bundler, the failure is a silent `undefined` at runtime,
not a build error.

## Shared mutable state has addresses

State that more than one module touches lives in a named module, never as scattered `let`s:

| Module              | Holds                                              |
| ------------------- | -------------------------------------------------- |
| `js/core/session.js`| started / fly-in flags                             |
| `js/play/state.js`  | what is currently held down on **every** input route |
| `js/mascot/state.js`| mascot move vector, dance flag                     |

`play/state.js` matters most: piano keys, drum pads, guitar chords and vocal notes arrive
from pointer, touch, on-screen pad *and* desktop keyboard, and the release-hygiene rules
in [[SPEC]] §5 only hold if all four routes write to one place.

## Two hard rules when editing

- **Imports go one way** (above).
- **Keep every file under ~1000 lines.** Split by responsibility when one grows past it.
  Current largest: `js/audio.js` at 916 — the next feature there should probably split it.
  See [[Module map]] for the sizes.

## Paths are site-absolute

The stage is served from `/stage/`, so every path it reaches for — in HTML, in the import
map, and in `fetch()` from JS — must be **site-absolute**: `/js/…`, `/prices.json`,
`/img/…`. A document-relative path resolves inside `/stage/` and 404s. This is the single
easiest way to break the stage; it is listed again in [[Gotchas]].

## Cache busting is manual

Every module import carries a `?v=` query, e.g. `import … from './core/session.js?v=20260804-10'`.
There are ~187 occurrences of the current stamp across `js/`, so a bump is a
find-and-replace across the tree — and an inconsistent stamp means the browser can load
two versions of the same module. Bumping is step 1 of the change checklist in
[[Dev workflows]].

## Rendering stack

Three.js (WebGL) + OrbitControls + EffectComposer / UnrealBloomPass, and the Web Audio API
for sound ([[Audio]]). Quality is tiered — **GLAMOUR** (full budget), **PIXEL** (stable
30 FPS, no shadows or bloom), **AUTO** (frame-pacing probe that promotes only sustained
smooth devices). Changing it reloads the page, by design, because the budget is chosen at
boot.

Shadow casting is curated rather than global: only the mascot's major masses cast, and
trim / stripes / collar / eyes / pins are excluded because they would roughly double the
shadow-pass draw calls for no visible gain. → [[Mascot]]
