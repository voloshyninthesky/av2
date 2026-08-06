---
tags: [subsystem, pattern]
---

# Focus framing

How the stage composes an instrument close-up. `js/view/focus-frame.js` (432 lines) plus
`js/view/instrument-view.js` (416) and `js/view/instrument-presets.js`. Contract:
[[SPEC]] §4 (piano / guitar) and §13 (mascot editor).

This is the project's most reusable idea, and worth understanding once rather than three
times — **piano focus, guitar focus and the mascot editor preview all use the same
pattern**, and any new close-up should too.

## The pattern: measure, don't hard-code

A naive close-up picks camera offsets per breakpoint. That fails here because the usable
area is not the viewport: HUD, loop pedal, zoom column, ✕ exit, chord-pad gutter, safe-area
insets and browser chrome all eat into it, and `visualViewport` moves under you on mobile.

So instead:

1. **Derive a safe rectangle** from `visualViewport`, safe-area insets and the *actual
   measured bounds* of the HUD, loop pedal, zoom controls and ✕ control.
2. **Define the subject in instrument-local space** — keybed bounds plus hand anchors,
   or the string band from nut to below the bridge — then transform to world space. Never
   viewport-specific world offsets.
3. **A base preset establishes only the eye direction.** The fitter owns the final distance
   and target offset.
4. **Fit the subject to a fraction of the safe rect**, then deliberately overshoot: open
   **two `+` zoom steps inside the fit** so the subject fills the screen and the outer edge
   crops. `−` / pinch must always reach back past the uncropped fit, so the full subject
   stays recoverable.
5. **Refit** on focus, resize, orientation change and `visualViewport` change.

Two subtleties that are easy to lose in a refactor:

- **The camera transition endpoint is the authoritative frame.** Derive the focused
  azimuth / polar limits *from that endpoint* before re-enabling OrbitControls, or the first
  controls update snaps the view. "The first stable focused frame exactly matches the
  transition endpoint" is an explicit acceptance criterion for both piano and guitar.
- **Refit during an active entry transition updates its destination** rather than
  teleporting the camera. Once focused, refit in one short eased correction — immediate
  under `prefers-reduced-motion`.

## Piano: the player's-eye view

Camera behind and above the seated mascot, steep ~72° pitch, slight side offset, so the
two-octave keybed reads as a near-horizontal GarageBand-like strip with the mascot's head,
shoulders and both hands below it. The mascot deliberately **crops at the frame bottom**,
same language as the drums.

- Keybed fits ~81% of safe width on desktop / landscape, ~88% on phone portrait.
- On portrait the subject sits slightly *below* the safe-rect centre (`centerBiasY`) so the
  play surface lands near the thumbs instead of floating over bare floor.
- **The head must never cover the keybed** — and the guarantee is the *bench standoff*, not
  the camera: a bigger mascot sits farther from the keys, clamped to the bench depth. This
  is why it holds at every saved height / build value.
- Seated poses (piano bench, drums throne) place the pelvis by subtracting the scaled hip
  height from the seat top, so the mascot rests *on* the seat rather than floating above or
  sinking through it.
- Keep the cabinet clean in focus: no music book, sheet pages, note lines or music rest.
- Focus, `Enter` and **ГРАТИ** never start a melody. `piano-notes.json` exists but nothing
  auto-plays it.

## Guitar: the azimuth follows the viewport

A guitar is long and thin, so a diagonal one wastes the frame. **Each orientation lays the
instrument along the screen's long axis:**

| Viewport            | Composition                                                     | Strum gesture      |
| ------------------- | --------------------------------------------------------------- | ------------------ |
| Landscape / desktop | First-person: down from behind the head, neck to screen-left, low E nearest | vertical swipe |
| Phone portrait      | Guitar stands up: body low-right, neck rising, mascot head at left edge | horizontal swipe |

Strum detection works in **guitar-local space**, so it is unaffected by which framing is
active — that is what makes the two compositions cheap.

During the entry transition the guitar **lerps off its stand into the mascot's hands** (the
stand fades out; exit reverses both). The hold rides the mascot's chest: height with the
height scale, forward / side offset with the build scale, so a broad build carries the
guitar forward instead of leaning its face through the soundboard.

The clever bit: **the mascot can never block the strings.** Tall or wide builds physically
overhang the play band, and a headless body seen from inside reads as floating debris — so
in the landscape first-person view, whenever the camera→strings sight line passes through
the head's hair shell, the **whole mascot is hidden** and only the held guitar remains. You
are looking out of that body. Hysteresis stops the boundary flickering; orbiting away,
portrait, and any non-guitar phase bring the body straight back.

## Mascot editor preview

Same measurement discipline, different subject — see [[Mascot]]. One rule specific to it:
offset the preview by shifting the camera **look target**, never by lowering the camera with
its target, so the camera stays above the platform edge at every height / build value and
the stage floor can't occlude the mascot.

## Verifying framing changes

Framing is deterministic given viewport + fov, so it can be checked **in Node** by importing
`vendor/three/build/three.module.js` and porting the relevant math. That is usually faster
and always more reliable than fighting a browser — see [[Gotchas]] for why the in-app
browser pane is a poor place to check this.

The acceptance viewports are fixed: `320×568`, `390×844`, `430×932`, `844×390`, `1280×720`.

## Related

- [[Mascot]] — the poses being framed
- [[Gotchas]] — headless verification, dead GPU processes
- [[SPEC]] — the full acceptance lists for piano and guitar framing
