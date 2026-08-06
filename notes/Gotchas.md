---
tags: [gotchas, debugging]
---

# Gotchas

Traps that have actually cost time. Read this before debugging anything visual.

## The canvas is black and it is not a bug

Tabs in the **in-app Browser pane always report `document.hidden === true`**. Two
consequences:

- `requestAnimationFrame` never fires → black canvas, `window.__sceneReady` never flips.
- `setTimeout` is clamped to roughly **1 Hz**. A 50-step in-page script that sleeps on
  `setTimeout` takes minutes and blows the tool timeout.

**Fix:** load `/stage/?testhooks=1&headless=1`. The `headless` hook pumps frames from a
worker interval (~31 ms). Write in-page waits as `requestAnimationFrame` loops, never
`setTimeout`. → [[Dev workflows]]

## WebGL can die mid-session and never come back

The in-app browser pane's GPU process can start failing with
`THREE.WebGLRenderer: Could not create a WebGL context … BindToCurrentSequence failed
(Sandboxed = yes)`. Once it happens, new tabs, restarting the preview server and reloads
**all** keep failing — every load lands on `#webgl-fail`.

It is a wedged pane GPU process, not a bug in the site; the same build rendered fine minutes
earlier. **Don't burn time restarting the pane.** Verify camera framing, fitter and pose
geometry in Node against `vendor/three/build/three.module.js` instead, and ask for a human to
eyeball the live result. → [[Focus framing]]

## The stage is served from `/stage/`

Every path it reaches for — HTML, import map, `fetch()` — must be **site-absolute**:
`/js/…`, `/prices.json`, `/img/…`. A document-relative path resolves inside `/stage/` and
404s. This bites hardest on `fetch()`, because the failure is a runtime `undefined` rather
than a missing-asset warning. → [[Architecture]]

## The enter button is dead code

`#enter-btn` ships `disabled`, reading `ЗАВАНТАЖЕННЯ…`, and **nothing ever enables it** —
since `7602710` the scene calls `startExperience()` / `startWithoutIntro()` itself once assets
load, and the button's click listener is vestigial. Waiting for it, or scripting a click on
it, will hang; wait for `window.__sceneReady`. A same-tab reload skips the splash
(`av2.intro.v2` in `sessionStorage`) — so "the intro didn't show" is expected on the second
load, not a regression.

## Silence is the default, and it is deliberate

Audio stays dormant through Enter, reload, walking, camera gestures, instrument focus, chord
selection, opening settings and dragging faders. **Do not "fix" this.** The site must not
create an `AudioContext` until a real sound action, so it never interrupts the visitor's
Spotify. If you need to hear something, play an instrument or hit **ТЕСТ ЗВУКУ**.
→ [[Audio]]

Corollary: a `running` `AudioContext` can still be silent, and can lie about it. Check
whether `currentTime` is actually advancing.

## Multitouch is easy to break with one line

- **Do not `preventDefault` a multitouch `touchstart` when any finger is on UI chrome.** It
  drops the second finger's pointer events, and the symptom is "the loop pedal works but the
  keys stop responding while it's held".
- The **loop pedal binds `pointerdown`, not `click`** — for the same reason.
- Page-zoom / pinch guards must **skip events involving UI chrome**.
- A focused play surface *claims* its fingers so OrbitControls can't rotate from them, but
  empty canvas must still orbit and pinch.

Pointer routing lives in `js/view/pointer.js`; it is 458 lines and it is load-bearing.

## Adding an upward import is silently fatal

No bundler means no cycle warning. An upward import gets you `undefined` at runtime, often
far from the cause. Inject the callback through the module's `init*()` instead —
[[Architecture]] explains the pattern.

## The cache stamp is a find-and-replace

~187 copies of the current `?v=` across `js/`. Miss some and the browser can hold two
versions of the same module at once, which produces genuinely baffling behaviour. Bump
`audio.js` whenever unlock behaviour changes.

## A new top-level directory does not deploy

`.github/workflows/deploy-pages.yml` copies an **explicit list** into `_site/`. Add a
directory to the repo and it silently never ships. (Conveniently, this is also why `notes/`
and `.obsidian/` stay out of production.)

## Editing prices in HTML is the wrong move

The lesson pages are generated from `prices.json`. Hand-edit a cell and the next deploy
overwrites it. → [[Prices]]

## `#keys-hint` and the drag hint are desktop-only

Hidden at `max-width: 720px` or coarse pointer / no hover. Mobile has no jam keyboard at
all — pads plus focused multitouch only. If you're testing the keyboard map on a narrow
window, the hint being gone is correct.

## Related

- [[Dev workflows]] — the commands
- [[Audio]], [[Focus framing]] — the two subsystems most of these touch
