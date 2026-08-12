---
tags: [architecture, reference]
---

# Module map

Which directory owns what, and where the weight sits. Line counts are a snapshot
(2026-08-06, ~11.9k lines of JS total) — useful for spotting what is close to the ~1000-line
split rule from [[Architecture]], not for citing precisely.

## Root of `js/`

| File                  | Lines | Owns                                                        |
| --------------------- | ----: | ----------------------------------------------------------- |
| `main.js`             |   522 | Boot order, cross-module wiring, hover, the frame loop       |
| `audio.js`            |   916 | Web Audio synth, buses, unlock / resume → [[Audio]]          |
| `ui.js`               |   330 | HUD, modals, price chip, toast                               |
| `pricing.js`          |   269 | The interactive price mixer → [[Prices]]                     |
| `guitar-gestures.js`  |    16 | Tap-vs-hold classification for chord touches                 |
| `lessons-weather.js`  |    69 | Lesson-site sidebar weather → [[Lesson site]]                |
| `lessons-credit.js`   |    19 | Lesson-site designer credit easter egg → [[Lesson site]]     |

The last two are the **only** JS the static lesson pages load. Everything else is stage code.

## Themed directories

| Directory          | Owns                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------- |
| `js/core/`         | Error collector, Telegram guards, quality tier + stage lighting, camera mode, session flags, prices fetch, gesture guards, studio assembly |
| `js/view/`         | Render rig, focus framing, close-up cameras, pointer routing, viewport guards           |
| `js/scene/`        | Procedural textures, stage geometry, lighting, backdrop screen + slideshow, particles    |
| `js/instruments/`  | Procedural drums / piano / guitar / mic meshes and their shared materials                |
| `js/mascot/`       | Appearance, poses, walk collision, gift draw + reveal, per-frame update → [[Mascot]]     |
| `js/play/`         | Vibe meter, loop pedal, guitar play, pads, piano notes, mixer, shared performance state  |
| `js/shell/`        | Post-processing probe, intro flow, headless QA hooks                                     |

## The heavy files worth knowing about

| File                        | Lines | Why it matters                                                    |
| --------------------------- | ----: | ----------------------------------------------------------------- |
| `js/audio.js`               |   916 | Every rule in [[Audio]] lives here. Largest file; split candidate  |
| `js/scene/stage.js`         |   513 | Platform, trim, footlights, back wall, curtains, speaker stacks     |
| `js/mascot/gift.js`         |   190 | The draw — rarity tiers and per-tier pools, pure (zero imports)     |
| `js/mascot/reveal.js`       |   480 | The gift ceremony — egg, hatch, reveal, card                        |
| `js/scene/gift-egg.js`      |   110 | The egg — two shell halves split on a jagged seam                   |
| `js/view/pointer.js`        |   458 | Pointer routing: who claims a finger, so orbit and play coexist     |
| `js/view/mobile-controls.js`|   449 | Joystick, **ГРАТИ**, ✕ exit, and their reset-on-exit discipline     |
| `js/view/focus-frame.js`    |   432 | The measured safe-rectangle fitter → [[Focus framing]]             |
| `js/instruments/guitar.js`  |   429 | Guitar mesh + raycast proxies                                      |
| `js/play/loop.js`           |   428 | Loop pedal: layered record, pause / clear, phase across rebuilds    |
| `js/view/instrument-view.js`|   416 | Focus phase machine (`idle` → approach → enter → focused → return)  |

That phase machine in `instrument-view.js` is the gate most rules key off: pointer play is
allowed only during **stable** focus, walk keys only during `idle`, and desktop keyboard
play is deliberately allowed in *every* phase ([[SPEC]] §5).

## Where the small-but-load-bearing files are

- `js/core/prices.js` (52) — the **single** fetch of `prices.json`; mixer and chips share it
- `js/core/gesture-guards.js` (80) — double-tap predicate + one-shot ghost-click swallower. **Imports nothing on purpose**: that is what makes it reachable from `ui.js`, `view/` and `core/` alike without an upward import, and loadable under `node --test`
- `js/play/state.js` (47) — what is held down on every input route
- `js/core/camera-mode.js` (62) — the Вільна / Не дуже preference (Вільна default), its storage and its mixer row. `rig.js` and the follow spring read it; `main.js` injects what to re-apply on change, since `core/` cannot import `view/`
- `js/core/telegram.js` (45) — Telegram Mini App detection and touch claiming
- `js/view/emissive.js` (31) — hover glow; had a bug where glow stuck to shared materials (`7949b11`)
- `js/shell/qa-hooks.js` (112) — `__THREE_GAME_TEST_HOOKS__`, the only way to drive the stage headlessly → [[Gotchas]]
- `js/core/errlog.js` (8) — collects errors so a broken boot is visible

## Non-JS layout

```
index.html            lesson hub — the front door
uroky-*-lodz/         four instrument-specific SEO lesson pages
uk/                   redirect stubs for pre-2026-08-06 /uk/* URLs
stage/index.html      the 3D stage: shell, modals, HUD, pads, import map
css/style.css         stage design system + overlays
css/lessons.css       the deliberate 2007-era lesson-page skin
prices.json           per-instrument prices + promos → [[Prices]]
piano-notes.json      optional phrase data; nothing auto-plays it
tools/sync-prices.mjs generates prices into the static pages
tests/*.test.mjs      four Node test-runner suites → [[Dev workflows]]
vendor/three/         vendored Three.js
deploy/nginx/         the vibe2.ton.zone release target
```
