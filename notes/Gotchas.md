---
tags: [gotchas, debugging]
---

# Gotchas

Traps that have actually cost time. Read this before debugging anything visual.

## An SVG presentation attribute loses to any CSS rule

`text.setAttribute('font-size', …)` on a chord-wheel label changed the number in the DOM and
not one glyph on screen: `css/style.css` sets the `font:` shorthand on `#chord-wheel .wedge
text`, and **any** CSS declaration outranks a presentation attribute, which sits at the bottom
of the cascade with the author's zero-specificity styles. The measurement is what caught it —
the reported `font-size` was 6.42 while `getBBox().width` had not moved. Use
`text.style.fontSize` when a stylesheet already touches that property.

The same trap is waiting on `fill`, `stroke` and `text-anchor`, all of which the wheel styles
in CSS.

## A drag surface binds its pointer to the window, not to itself

The two wheels bind `pointermove` / `pointerup` to their own SVG, and that is correct for
them: a wedge is pressed and let go in one place. Copying it onto the voice ribbon
(`js/play/ribbon.js`) shipped a **stuck droning note**. A sung line is a drag across a 236px
square and the finger leaves it constantly; off the element there were no more moves, so the
note froze mid-phrase, and the release happened somewhere else entirely, so `pointerup` never
reached the module and the voice sustained until `startVocal`'s ten-second safety timer.

`setPointerCapture` is what is supposed to make element-bound listeners safe, and it is why
the wheels get away with it — but every call site here wraps it in `try`/`catch` on purpose,
because a pointer the browser has stopped tracking must not take an already-sounding note
down with it. **That means capture is a best case, never the mechanism.** Anything held across
a drag binds move / up / cancel to the window, filters by `pointerId`, and treats `blur` as a
release too.

## A held note is owned by the key that started it, not by the note it is on

Two bugs in the mic close-up's row, both reported as "it cuts out, especially on other keys",
and both the same mistake: the release asked *"is anything held?"* instead of *"is this mine?"*

- **The row released the wrong note.** `releaseRibbonDegree()` matched on nothing, so holding
  `1`, pressing `3`, then letting go of `1` stopped the note `3` was singing. It cannot match on
  the *degree* either, because the arrow-key glide moves the degree out from under the key that
  started it. It matches on the **`KeyboardEvent.code`** that owns the note.
- **Two code paths owned one voice.** Under mic focus both the close-up row (`1`–`7`, through
  `ribbon.js`) and the jam row (`N M , . /`, through `mixer.js`'s `beginKeyboardVocal`) were
  live, and `beginKeyboardVocal` silences `play.heldVocal` **directly** — stopping the ribbon's
  note without the ribbon ever hearing about it, which left it pulsing `mic.sing()` and stamping
  loop duration for a note that had gone. The jam row now routes through the ribbon inside the
  close-up, so there is one owner. Drums gets away with keeping both of its rows because both
  end in the same `playDrumFromKeyboard`.

Note `canKeyboardJamPlay()` is false in mobile game mode, so *no* keyboard test reproduces
anything below ~900px wide — a keyboard bug that "will not reproduce" may just be the viewport.

The same report produced two smaller ones worth recognising:

- **`preventDefault` on a `touchend` you did not check is cancelable** logs
  `[Intervention] Ignored attempt to cancel a touchend event with cancelable=false`. On a
  `touch-action: none` drag surface that handler has no job at all — it was copied from the
  vocal pad, where it suppressed a 48px button's synthesized click. Neither wheel has one.
- **Ramping a `BiquadFilterNode`'s `Q` at pointer rate is a zipper generator.** Frequency and
  gain ramp cleanly; `Q` re-solves the filter's coefficients under a signal already ringing
  inside it. The vowel morph now moves the peaks and leaves their sharpness where the note
  started, which is inaudible as a difference and removes the artefact entirely.

## A "when did X last happen" flag needs a home outside the thing it watches

`syncLoopHandover()` in `js/play/groove.js` compares the loop's recording state against the last
frame's, and it lived inside the half of the frame loop that only runs while the groove plays.
Stop a groove by hand partway through a take and its `wasRecording` / `capturedIntoLoop` pair
froze mid-transition — so the *next* groove started was handed over the instant it began and
stopped itself. Edge-detectors have to run on every frame their input can change, not only on
the frames their output is wanted.

## An unknown drum part used to play a tom, silently

`playMusicalEvent`'s drum branch in `js/play/loop.js` ended in `else audio.tom(...)`, so a
typo or a newly added part name was not an error — it was a 120 Hz tom, in time, sounding
almost right. Every part is now named explicitly and `tests/rhythm.test.mjs` holds the rhythm
library's part vocabulary against those exact branches. Add a part to one and you must add it
to the other, or the test says so.

## Glowing one drum lights the whole kit

`buildDrumKit` shares `shellMat`, `headMat`, `goldMetal`, `chrome` and the rest across every
part, and `glowMesh` remembers rest state *per material* (`js/view/emissive.js` documents the
class of bug). So per-part emissive on the drums needs the materials cloned per part group
first — which is a `buildDrumKit` change, not a `setGlow` one. Nothing needs this today: hover
glow is deliberately off inside a close-up, and from a distance the whole kit *is* the target.

## Object3D.userData cannot hold an Object3D

`Object3D.copy()` does `JSON.parse(JSON.stringify(source.userData))`, so a node stored in its
own subtree's userData turns any future `clone()` of that subtree into a circular-reference
throw — far from the code that stored it. The drum kit hands out its measurement frames through
a plain `heads` map on the returned object instead, and keeps only numbers and strings in
userData.

## The canvas is black and it is not a bug

Tabs in the **in-app Browser pane always report `document.hidden === true`**. Two
consequences:

- `requestAnimationFrame` never fires → black canvas, `window.__sceneReady` never flips.
- `setTimeout` is clamped to roughly **1 Hz**. A 50-step in-page script that sleeps on
  `setTimeout` takes minutes and blows the tool timeout.

**Fix:** load `/stage/?testhooks=1&headless=1`. The `headless` hook pumps frames from a
worker interval (~31 ms). Write in-page waits as `requestAnimationFrame` loops, never
`setTimeout`. → [[Dev workflows]]

## The pane viewport can collapse to 0×0 and NaN the camera

A backgrounded in-app Browser pane can report `window.innerWidth === 0` and
`innerHeight === 0` (`visualViewport` too). The resize handler then computes
`camera.aspect = 0/0 = NaN`, and anything that does math with the camera afterwards — the
gift-reveal fit, `lookAt` — silently propagates NaN until the canvas is black with **no
console error**. The scene state, bounds and DOM all measure finite, which makes it look
like a geometry bug; it never is. Check `window.innerWidth` first. Front the pane (take a
screenshot / `resize_window`), then reload so the load-time layout runs at a real size.
Not a site bug: a real browser window never reports 0×0.

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

~209 copies of the current `?v=` across `js/` and `stage/index.html`, and they all move
**together**. Miss some and the browser can hold two versions of the same module at once,
which produces genuinely baffling behaviour. Bump `audio.js` whenever unlock behaviour
changes.

Bumping "just the modules I changed, plus their importers" is the tempting wrong answer: an
untouched file keeps its own stamp, so it is served from cache, and that cached body still
imports the *old* stamp of the thing you did change.

**Grep cannot see this** — the stale reference lives only inside a cached response. Check the
live page instead, after any bump:

```js
// paste in the console on a freshly loaded /stage/
const by = {};
for (const e of performance.getEntriesByType('resource')) {
  if (!e.name.includes('/js/') || !e.name.includes('?v=')) continue;
  const [p, v] = e.name.split('?v='); (by[p] ??= new Set()).add(v);
}
console.log(Object.entries(by).filter(([, s]) => s.size > 1));
```

Anything printed is a module loaded twice. The correct result is one stamp across all ~48
loaded modules.

### It also makes every merge look like a conflict

Two branches that both bumped the stamp conflict in **every file they touch**, so a long-lived
branch lands ~40 conflicts of which only a handful are real. The tempting shortcut is to
classify each one — "does this file differ by anything other than `?v=`?" — and auto-resolve
the rest. That works, and it has one blind spot big enough to break the build:

**an import line contains `?v=`, so a filter that ignores stamped lines also ignores every
import that was added, removed, or repointed.** Rebasing the gift branch onto the chord-wheel
work hid exactly two changes that way — `pads.js` → `chord-wheel.js`, and a dead
`updateMascotEditorPreview` import whose export no longer existed. The second one shipped a
page that died on load with `does not provide an export named …`.

Neither `node --test` nor a grep catches it: the tests import modules directly and never
resolve `main.js`'s graph. **Boot the real page after any merge** — the browser is the only
thing that resolves every import, and it names the missing export precisely.

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
