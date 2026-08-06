---
tags: [subsystem, fragile]
---

# Audio

`js/audio.js` (916 lines, the biggest file in the project). Full contract: [[SPEC]] §3
"Audio activation and external media" and the quality bar in §12.

**Treat this as the most rule-bound part of the codebase.** Almost every rule here exists
because a real device broke in a specific way, and most of them are *negative* rules —
things the code must **not** do — which no amount of reading the happy path will reveal.

## The one idea everything follows from

> The default experience is **play along with the visitor's own music.**

Someone arrives with Spotify or Apple Music already playing. Entering the stage, walking,
orbiting the camera, focusing an instrument, picking a chord, opening settings and dragging
faders must all leave that audio **completely untouched** — and must not even *create* an
`AudioContext`.

Two consequences that are easy to get wrong:

1. **No page-wide gesture listener may claim audio.** The tempting pattern — one
   `pointerdown` handler that unlocks audio on first touch anywhere — is explicitly
   forbidden. The instrument handler that will actually synthesize the sound owns
   activation and recovery. Nothing else.
2. **`ambient` first, then the context.** Immediately before the first real sound, request
   the mobile Audio Session `ambient` route where the browser exposes it, *then* create or
   resume the context inside the same trusted gesture. `ambient` is what makes supporting
   platforms mix rather than claim exclusive playback. Unsupported? Fall back silently — no
   error. The OS may then duck the external source, but only once real sound is intended.

Activation happens on every real sound path: drum hit, piano note, guitar pluck / strum,
vocal, loop playback, **ТЕСТ ЗВУКУ**. Loop *record* may reuse an already-live context,
since unlocking the pedal requires having played something first.

Also: prime with a tiny silent buffer inside the gesture turn, and honour a mute chosen
before the context existed once `init` runs.

## Why the context keeps dying

Mobile and in-app browsers can leave an activated `AudioContext` **suspended** — silent
until a page refresh, which a visitor will never think to do. The engine therefore assumes
the route is untrustworthy and rebuilds defensively:

- Mark the route for a **guarded rebuild** after backgrounding, page restore, window blur,
  or an interrupted Audio Session — *even if the old context still reports `running`.*
  A lying `running` flag is the actual failure mode.
- Detect a `running` context whose `currentTime` clock has **stopped**, and rebuild on the
  next trusted gesture.
- Retry `resume()` shortly after wake; recreate if `closed` or still blocked.
- Audio Session `inactive` is *normal* silence between notes. Only `interrupted`
  independently means a broken route. Conflating the two causes pointless rebuilds.
- A rebuild must **preserve loop phase and active vocal state**, or the pedal desyncs.

The escape hatch when physical output can't be inferred: **ТЕСТ ЗВУКУ** in the mixer
force-rebuilds and plays C5–E5–G5–C6 straight through the master bus, bypassing instrument
faders, then tells the visitor to check device silent mode. This is the "why can't I hear
anything" button, and bypassing the faders is the point — it must make noise even with
every fader at zero.

The acceptance bar: **no stuck-silent sessions.** After backgrounding or a route
interruption, the next user gesture rebuilds and unlocks without a page refresh.

## Buses and levels

`drums` | `piano` | `guitar` | `mic` → master.

Every fader reads **0–100%** and reaches a gain of **2.0** at 100% — so 100% is *boosted*,
not unity. Defaults: 50% for drums, piano and vocals, **30% for guitar** (≈0.6 gain, ~40%
quieter than the others, because the strum stack is dense and otherwise dominates).

## No soundtrack

Do not autoplay a built-in track. If a game-like background track is ever added it must be
an explicit, persisted, **default-off** setting on its own mixer bus, using the same
`ambient` session.

## How this is protected

`tests/audio-lifecycle.test.mjs` asserts on **source text across all of `js/**/*.js`**
rather than on runtime behaviour — there is no browser in the test run. That is a deliberate
trade: it means the suite keeps working when code moves between modules, and it means a
refactor that quietly reintroduces a page-wide unlock listener gets caught. It also means
the assertions are string-shaped, so read the test before renaming things in `audio.js`.

Run it with the rest: `node --test tests/*.test.mjs` → [[Dev workflows]]

## Related

- [[Gotchas]] — audio needs a gesture; the stage is silent until you interact
- [[Architecture]] — where audio sits in the layering
