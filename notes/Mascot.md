---
tags: [subsystem]
---

# Mascot

The low-poly avatar labelled «Ти» — the visitor's body on stage. `js/mascot/` (appearance,
state, pose, walk, gift, reveal, update) plus `js/scene/mascot-model.js`. Contract: [[SPEC]] §4
and the whole of §13.

## On stage

Starts **downstage, nudged stage-left toward the guitar, inside the key spotlight pool**
(`MASCOT_START`, also the fall respawn point) and held back off the footlight row so those
point lights can't blow the costume out. The guitar is in easy reach; every other instrument
sits behind the visitor. That placement is a soft tutorial — the first thing within reach is
the thing most people want to touch.

- Movement is **click-to-move on the floor, or the mobile stick**. Deliberately *not*
  keyboard-bound — the desktop keyboard is reserved for the multi-instrument jam ([[SPEC]] §5).
  (Arrows / WASD do walk while idle, but no play key is ever shared with them.)
- Can fall off the stage edge, with a short recovery.
- Instrument focus poses or seats it and reframes the camera → [[Focus framing]].
- Clicking the HUD logo toggles a **tektonik dance**: procedural 8-beat loop, overhead arm
  sweeps + bounce, full spin on the last two beats. Limbs relax smoothly on stop; walk
  input, instrument approach or a fall stops it.

### Walk collision

Footprints are **convex X/Z hulls derived from the visible meshes** of instruments and
speaker stacks, expanded by the mascot's rounded clearance — not axis-aligned boxes. That
matters because several objects are rotated: a bounding box around an angled piano would
block floor a visitor can see is empty. Keyboard / stick movement slides along angled edges;
click routes use expanded footprint corners; approaches stop at the nearest clear silhouette
edge before focus; exiting a seated pose projects the mascot back to clear floor.

### Shadows are curated

Only the major masses cast: torso, neck, face, hair, limbs, shoes. Trim, stripes, collar,
eyes and pins are excluded — they add nothing to the shadow map and would roughly double the
shadow-pass draw calls now that the mascot stands in the key light. The guitar and mic follow
the same rule inside that pool.

## The gift

HUD person icon → `#modal-gift`. `js/mascot/gift.js` (the draw) and `js/mascot/reveal.js`
(the ceremony), which together replaced the ~480-line dressing-room editor.

> You receive a character. You don't build one.

The editor asked visitors to author a mascot before they had any reason to care about one,
and the median first run cost half a minute of form-filling to land somewhere near the
default. The gift inverts the order: an egg lands in the spotlight, rocks, cracks open,
and hands you someone — with a rarity tier attached — in about four seconds. *Then* you can
keep them. There is no reroll and no HUD button to reopen it — the tier you were given only
means something because you cannot roll it away.

Every character is a **Вайбер** — none of them is named individually, and the tier reads as a
species epithet («це Вайбер Звичайний»). The card is also the whole of the first run: it says
what the stage affords, and its ЗРОЗУМІЛО closes onboarding. The standalone tip is now only a
fallback for someone who got a character but dismissed the card with ✕.

Exact tier weights, pools and the beat-by-beat timeline: [[SPEC]] §13. They change
more often than this note will.

**The ceremony does not vary by tier.** Everyone gets the full ~7 s version — the one that
used to be reserved for a legendary. You receive one gift in your life; grading the spectacle
to the roll would mean most visitors never see the good version of the only reveal they get.
The tier shows up in the glow colour and on the card, nowhere else.

### Why the tier is drawn first

Rarity is drawn **tier first**, then each field from that tier's own pool — never scored from
the traits after the fact. A score model happily emits a genuinely 1-in-3000 combination that
reads, to the eye, as a thin person with blue eyes; the gold burst then writes a cheque the
character can't cash. Tier-first lets each tier own a pool that *looks* like its tier, and the
legendary tier is six authored looks rather than a weighted draw.

One trap worth naming: **`skinTone` is drawn evenly at every tier and must never become a
rarity signal.** There is a test for it.

### The model that makes it safe

- The draw happens at t=0, so the whole ceremony — its length, its glow colour, its audio
  schedule — is decided before the first frame. Nothing is decided mid-flight.
- Storage is written **on the reveal frame**, not on a later confirm. There is no draft: what
  is on disk always matches what is standing on stage. That is the invariant the editor
  deliberately broke and paid for with `openingConfig` bookkeeping.
- **✕ / Esc** before the burst abandons the pull — nothing was written, so the previous look
  simply stands — and, because nothing was written, the gift is offered again next visit.
  After the burst the character is already saved and **ГОТОВО** just closes.

Three constraints worth protecting in any edit here:

1. **No allocation per pull.** Procedural parts — the mascot's and the egg's — are created
   once and toggled or recoloured in place. A 20-pull stress pass must add no geometries or
   textures and cause no frame hitch.
2. **Per-field fallback on load.** A malformed `av2.mascot.v4` field falls back
   independently and never invalidates the whole look. Removed legacy values (`buzz`,
   `tied`, `sunset`, `chain`, `cap`, `blush`, dropped tones and colours) each fall back to a
   default. `v1`–`v3` keys are deliberately **not** migrated — the key bump is how returning
   visitors get reset. The mascot must also keep working if v4 is absent or storage is
   unavailable.
3. **The first gift is silent.** It opens from the camera fly-in, not a tap, so no
   `AudioContext` may be created — see [[Gotchas]]. Nothing in the ceremony unlocks audio;
   the synth calls find no context and no-op harmlessly.
4. **The stage is prepared before the first frame.** `prepareGiftStage()` runs in `main.js`
   between `addLabels()` and `animate()`: with no character saved it hides the mascot and its
   label and stands the egg in their place. Do this any later and the visitor watches the
   *default* mascot through the whole 2.6 s approach, which gives the whole thing away.
   It also locks the viewing angle and resolves the framing the approach flies to, so the
   ceremony inherits the camera without moving it — approach and reveal are one move. Two
   things used to break that seam and are now guarded: enabling OrbitControls for the one
   frame before the gift opens (it snaps the camera to its own stale state), and hiding the
   instruments on ceremony start (the whole band pops out of the scene on that frame).
5. **No melody.** The ceremony is percussion only. A pitched line makes it a jingle and
   competes with the instruments the visitor is about to play.
6. **The reveal pose has to be one OrbitControls will hold.** It is handed straight to the
   controls when the card closes, so the framing distance is clamped to `minDistance` and the
   safe-rect target offset is eased away on close — that offset alone tips the camera past
   `maxPolarAngle`. Miss either and the camera lurches a frame after ГОТОВО. The follow
   camera is also held off while the gift's tween owns the rig; two eased motions writing to
   one camera is what a stutter actually is.

### Opening the gift from a focused instrument

It leaves focus **immediately, with no return animation**: the instrument settles to rest
(the guitar drops back on its stand) and the camera snaps straight to its pre-focus stage
frame before the ceremony camera takes over.

That snap **must land exactly on the saved frame** — an orbit drag made just before opening
must not leave a residual offset — because the reveal saves this exact position as the frame
to restore on close. A drift here is invisible until the visitor closes the card and the
stage is subtly wrong.

While the gift is open: instruments and stage hints are hidden so they can't obscure the
ceremony, background controls are inert, and backdrop taps never close the modal. Horizontal
drag over the stage rotates the character around its own Y axis and never touches the stage
camera. That angle is session-only — not part of the saved appearance.

Two more things that are easy to break:

- `js/mascot/gift.js` **imports nothing**, deliberately — that is what lets
  `tests/mascot-gift.test.mjs` import it under plain `node`. It therefore spells the
  appearance vocabulary a second time, and a test reads `appearance.js` as text to keep the
  two from drifting. Don't "fix" the duplication by importing.
- The ceremony is **exempt from the 15 fps modal render budget** (`renderIntervalMs()` in
  `js/main.js`). Without that exemption its few seconds of suspense play as a slideshow.

## Related

- [[Focus framing]] — the measured preview rectangle, and the seated / held poses
- [[SPEC]] §13 — outcomes, responsive composition, control design, full acceptance list
