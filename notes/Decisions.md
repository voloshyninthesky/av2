---
tags: [decisions, history]
---

# Decisions

Why things are the way they are. Newest first.

The commit messages in this repo are unusually good — they carry the reasoning, not just the
change. `git show <hash>` is the primary source; this note is the index into it, so you know
*which* commit to read.

---

## The bar became a wheel, and the kit stopped playing itself — 2026-08-13

Drums was the richest mesh in the repo and the thinnest instrument: no `play/` module at all,
no helper surface, no SPEC section, no tests. The gap that rhymes with the chord wheel is
**time**, not pitch — and [[SPEC]] already had "metronome" and "backing groove" on the piano
*and* guitar roadmaps, so a time surface is shared the same way the wheel is.

**A wheel, not a step sequencer.** The obvious drum surface is a grid of cells you fill in.
That is the six-slot chord pad again — a settings task wearing a play surface's clothes — and
this repo already replaced that once (see below). So the wedges are whole *grooves*, twelve of
them, and one tap is one bar of music. The visitor never fills a cell.

**The generator is Euclidean rhythm, and that is not a metaphor.** `E(k, n)` places `k` onsets
maximally evenly by adding `n/k` steps mod `n` — the same arithmetic the circle of fifths uses
adding 7 semitones mod 12. It really is the same object on a different circle: `E(3,8)` is the
tresillo, `E(5,16)` the bossa clave, `E(8,12)` the shuffle, and `E(7,12)` turned seven steps is
the major scale. So the timeline half of every groove is generated and the backbone half is
authored — where the kick lands *is* the style and has no formula — which is also what lets the
tests check one against the definition and the other against its own invariants, with nothing
checking itself. `rhythm.js` imports nothing, for `harmony.js`'s reason.

**The kit is the score.** Forty-eight cells on a 220px circle are unreadable, and the stage
already owns a notation surface: the drums themselves. A playing groove strikes the real heads
and cymbals, so you read the pattern off the instrument rather than off a grid. That is also
the discoverability layer the three removed ones (below, 2026-08-06/07) were reaching for —
except it shows instead of telling, and being the instrument rather than chrome printed over
it, it cannot swallow a tap.

**The wedge is the transport, and there is no silent mode.** The first build had a three-state
sound pill in the hub — silence, a click, the whole groove — with the kit animating in all
three, on the theory that a muted groove teaches you the pattern. Watching it settled it: **a
drum that recoils without a sound reads as broken**, not as notation. So the pill is gone, a
tap on a wedge plays that groove, a tap on the playing one stops it, and nothing on the kit
moves unless it is making a noise. Stopped, the wheel shows nothing at all — no lit wedge, no
playhead — because there is no groove going on for one of them to be the subject of.

That also keeps "focus never starts a melody" without needing a mute: reaching the kit opens a
still wheel, and the tap that starts a groove is as deliberate as the tap that sounds a chord
at the piano. `av2.groove.v1` carries the groove and the tempo and deliberately **not** whether
it was playing — a remembered playing state would start drums at a returning stranger.

**Stopping does not pause the bar.** The transport froze the phase at first — stop on beat 3,
tap again, resume on beat 3 — which needed a whole second frame-clock (`silentElapsed`) and two
adopt-the-other-clock functions to arrange. It was also the wrong answer for the thing the wheel
is most useful for. **Practising fills** means dropping the groove out, playing a fill of
whatever length, and bringing it back: what you want then is the beat where the room is, not the
beat you left on. So the epoch is pinned once per visit and never moved, and stopping merely
stops the scheduler.

The pay-off is that the groove is permanently locked to one grid, so tapping back in at any
instant lands in time *however sloppy the tap* — which is why the obvious alternative,
re-entering on the next downbeat, is not worth building: it would buy nothing here, and a tap
that visibly does nothing for up to a bar reads as broken. It was also a net deletion: one clock
instead of two, and `updateGroovePlayhead` no longer takes a `dt`, so a slow frame moves the
playhead further rather than putting it out of step with what you are hearing. Leaving the kit
still drops the bar — a phantom bar surviving a walk across the stage would be counting nothing.

**A take over a groove contains the groove.** The first cut kept groove hits out of `loop.events`
entirely, which was tidy and wrong: record a bar over РОК, walk away, and the loop is your own
sparse hits with the beat gone. The scheduler now captures each hit at its *scheduled* time
(not at "now" — a look-ahead capture at `currentTime` lands up to 120 ms early), and the groove
stops itself as the take closes, because the loop is playing it now and two of them is just
doubling. `feedback: false` still holds throughout: a machine playing itself earns no vibe,
recording or not.

**Its own scheduler, sharing the road and the constants.** `schedulerTick` early-returns unless
the loop is playing, and `clearRecordedLoop()` stops its timer — sharing either would tie the
groove's life to the loop's, when the groove has to run while the loop is empty, recording and
paused alike. What *is* shared is `playMusicalEvent(…, { record: false, feedback: false })` and
the look-ahead constants, imported rather than copied.

**The loop now quantises to bars, and the number is the argument.** The free-running pedal
rounds to an eighth of a second. At 92 BPM a 4/4 bar is 2.6087 s and that grid gives 2.625 —
**16 ms out per bar**, half a sixteenth inside two minutes, with nothing erroring or logging
while it drifts. Against a groove the take rounds to the nearest whole bar (`Math.round`, never
`ceil`: a finger that lifts early meant *this* bar, and ceiling hands back a bar of silence),
and `recordStartedAt` snaps *back* to the downbeat so every captured offset is already
bar-relative. Tempo is then locked while a loop has content; rescaling it instead is the
follow-up, and is ~8 lines nobody has tested yet.

**`1`–`7` in pitch order, and `1` = kick is the drums' tonic.** In a close-up the number row is
the instrument's own seven things — seven scale degrees at the guitar and piano, seven kit
pieces here. Pitch order rather than screen order because it is the one order that survives
every camera preset, and because the kick is the home of a bar the way the tonic is the home of
a key. `Space` therefore gets a second owner as the hi-hat pedal, which does not break §5's
one-owner rule but did need it rewritten: the rule is per *scope*, and two close-ups can never
be live at once.

**The wheel is capped smaller than the chord wheel (220px vs 300px).** Not taste — the guitar
stands to the right and the keybed is a mid-screen strip, but the drums close-up is
over-the-shoulder with the kit centred and running to the bottom of a portrait frame. At the
shared size a 290px wheel on a 390px phone sat straight over the lower kit and the mascot's
hands. Drums has no measured fitter to reserve against, so the cap is the whole answer, and
220px is its floor too: any smaller and the groove ring drops under the 32px touch thickness.

Two things that were *not* built, and why. **Per-part hover glow**: `setGlow` lights the whole
kit, which looks like a bug until you read `main.js` — hover glow is off inside a close-up by
design ("the glow says *walk over here*"), so the only case where it runs is from a distance,
where the target really is the kit. There is nothing to fix. **A measured `drumsFocusSafeRect()`**:
deliberately out of scope; the raw preset is the framing the piano's was copied *from*.

`git show a3a8b50` for the whole change. → [[Audio]], [[Module map]], [[Current state]]

---

## The chord row counts, and a key can be minor — 2026-08-13

Two changes that turned out to be one.

**The row is `1`–`7` in a close-up, and the number is the scale degree.** Letters were
considered again — press `C` for the C chord — and the objection that killed them in 2026-08-06
really had gone away: the row now holds one key's diatonic chords, so a root letter no longer
collides with itself. What killed them the second time is the piano, whose close-up spends
`A S D F G H J K L` on white notes and `W E T Y U O` on blacks; there is no letter left to
name a chord with. A digit has no such problem, reads as the degree it *is*, and — because
focus made the keyboard exclusive — is free in both close-ups. Away from a close-up the digits
are still the piano's white keys, so the letter row keeps the chords there.

That bought the seventh degree, which the six-slot row never had room for. It also cost two new
chord qualities: **`dim` and `m7b5`**, because degree 7 of a major key and degree 2 of a minor
one are diminished. The library is 84 chords now, and neither of those two has a wedge —
a diminished chord is neither a major nor a relative minor, so the circle of fifths has nowhere
to put it. Six of the seven light; the seventh is reachable only from the row.

**A key can now be minor**, and it costs almost nothing, because a major key and its relative
minor are the same seven notes. They light **the same six wedges** and take **the same
sevenths** — asserted in the tests, not assumed. All that changes is which wedge is home
(outer in major, inner in minor, marked with a gold outline), what the degrees are called, and
where the row starts counting. So mode is one field, not a second set of chords.

The mode control is the key readout itself: tapping `C` makes it `Am`. The hub is 79 px across
on a 320 px phone and already holds a stepper and a 7 toggle; a third pill does not fit, and
the readout already spells the answer. Switching moves the tonic to the *relative* key rather
than the same letter, so the sector under your hand does not move — which is what a musician
means by "the relative minor".

One more thing the phone forced: everything in the hub is sized as a fraction of the wheel now.
Fixed pixel controls fill the hub at exactly one wheel size and leave a hole at every other,
and portrait has the larger wheel — which is why the core looked empty there after it had been
tightened on desktop.

---

## A close-up owns the keyboard — 2026-08-13

The jam surface was written for a visitor standing in the middle of the stage: every
instrument on disjoint hotkeys, focus optional ([[SPEC]] §1 goal 2). Inside a close-up that
same rule reads as a bug. You walk to the piano, sit down, and the drum row still fires, the
strum keys still strum, and the piano's own chord row — this is the part that was actually
broken — **armed a guitar chord and strummed the guitar**, because the "unfocused, so also
strum" branch tested only whether the *guitar* was focused. Measured: `guitarStrokeMotion`
0.85, zero piano keys moving. The instrument in front of you was the one thing the keyboard
would not play.

So focus now makes the keyboard exclusive: outside a close-up nothing changes, inside one
only that instrument answers. The jam survives where it was designed to live, and the goal it
serves is intact — it just stops leaking into a decision the visitor already made.

What fell out of it:

- **The piano's chord row plays piano chords**, routed through the wheel's own
  `pressPianoChord` rather than around it, so a key and a wedge voice, roll, press the same
  meshes and capture into the loop identically. Chords under the left hand on `1–6`, melody
  under the right on `A–L`, which is the first time the close-up has been a two-handed
  instrument.
- **The chord row is the one map two instruments share**, because the wheel is shared. It
  answers under guitar and piano focus and goes quiet under drums and mic. Everything else
  is one instrument's.
- **Strum moved to `↓` / `↑`.** Alternating strokes were `Space` and `Shift+Space`, a held
  modifier in the middle of a rhythm. Adjacent arrows make it two fingers. The arrows were
  free for the same reason the whole keyboard is: mascot movement has no keyboard binding.
- **The legend follows the mode.** `#keys-hint` listed the full jam map everywhere, so in a
  close-up it advertised keys that no longer answer. One `<span>` per mode, swapped in CSS off
  `data-instrument` — no JS, and the Ukrainian stays in `index.html` with the rest of the copy.
  It also stopped being hidden outright at the piano; that rule existed because the long jam
  list crossed the keybed in short landscape windows, and a per-instrument line is a fraction
  of its width, so it now stands down only there.

The reversed acceptance criterion is worth knowing about: §12 used to require that "focusing
piano must not silence drums / vocal / guitar keyboard routes". It now requires the opposite
inside a close-up, and the old guarantee survives only outside one.

---

## The chord pad became a wheel, and the wheel does not scatter — 2026-08-13

Six slots was the wrong unit. Choosing which six chords you own is a *settings* task, and it had
grown a settings UI inside a play surface: a ✎ mode, a quality × root picker, per-slot storage.
The ✎ mode only existed because *holding* a button was already the play gesture and could not be
given a second meaning — so deleting the slots deleted the reason for the mode along with it.

The replacement is a **circle of fifths**, and the argument for it is one geometric fact: with the
tonic at 12 o'clock, a key's six chords are **three neighbouring positions on the outer ring with
their relative minors directly inside** — `IV I V` over `ii vi iii`. One contiguous block, the
same six places in all twelve keys. Which chords belong together becomes visible before it is
nameable, which six free slots could never show however well they were chosen.

Consequences worth knowing:

- **The wheel turns; the block stays.** Stepping the key rotates the ring group and counter-rotates
  the labels. Seeing the tonic travel to the top is what makes "a fifth" a distance rather than a
  word — and it is the same step `‹ ›`, `[` and `]` take.
- **The key is a stepper, not a drag.** Dragging the ring is the same gesture as holding a wedge to
  play it, and a finger drifting during a hold would spin the key out from under the chord. This
  surface has learned that lesson once already (see ✎, above).
- **The seventh rule is one sentence and the diatonic answer falls out of it.** `maj7` on I and IV,
  `7` on V, `m7` on the minors; outside the key a major takes `7` and a minor `m7`, which is what a
  borrowed chord gets reached for. Nothing is special-cased, so the test asserts the general rule
  and gets the specific one free.
- **Degrees restored the mnemonic that generated names destroyed.** `Q W E R T Y` addressed slot
  *positions* because `C`, `Cm`, `C7`, `Cm7` and `Cmaj7` all start with `C` (the mnemonic-key
  attempt below, reverted the same day). A degree is a name that survives the chord changing under
  it, so `Q` is the tonic in every key.
- **Radial thickness, not arc, is the touch target.** A 30° wedge is ~50–60 px across its arc at
  every size; what a fingertip misses is the band's thickness. That is why the hub is only 42 % of
  the radius: every point it gives back goes to the rings, which come out ~35 px on a 320×568 phone
  instead of ~27 px. The honest cost is that the wheel is roughly four times the pad's footprint,
  and on the smallest phone it is half the screen height.
- **The same wedge means two things, and that follows from the instruments.** On guitar it only
  *arms* — the neck makes the sound, so holding and latching stay silent. On piano it *plays*, and
  presses the voiced key meshes, because there is no second surface to strike; it is therefore
  momentary and never latches, since a latched piano chord would sustain forever.
- **The piano chord pad that was built and cut before shipping is back** (see 2026-08-06, below) —
  but shared with the guitar rather than piano-only, and it depresses the keys instead of
  highlighting them. A highlight was decoration; a chord that moves four keys under one finger is
  the connection between the wheel and the instrument.
- **`harmony.js` imports nothing on purpose.** That is what lets `node --test` load it through a
  `data:` URL and check all 60 chords, all 24 wedges in all 12 keys, and every piano voicing for
  real — retiring the source-slicing hack the chord tests used to need. A wrong wheel is
  silent-but-wrong in exactly the way a wrong barre shape is.

Two things moved out of the way rather than being redesigned: the onboarding tip now rides the
existing `html.pads-open` rule to the top of the screen (the wheel is big enough to swallow it),
and `view/mobile-controls.js` stopped importing `play/pads.js` upward — `hideChordWheel` is
injected from `main.js` like every other back-reference.

---

## The mascot became a gift, not a wardrobe — 2026-08-12

The dressing-room editor asked the visitor to author a character before they had any reason
to care about one. The median first run cost half a minute of form-filling and produced
something barely distinguishable from the default — because the default was already good,
and nobody has taste for a character they haven't met yet. Worse, it was the *first* thing
the stage did: a form, standing between the fly-in and the music.

A gift inverts the order. You receive someone — hatched out of an egg, named, with a story
attached (a tier) — in about seven seconds, having chosen nothing. The whole editor is gone:
three tabs, ten control groups, the draft/commit/undo model, ~480 lines.

**No HUD button, and the only reroll costs the character you have.** A tier you can re-roll
on a whim is not a tier — it is a slot machine, and the character stops being *yours* the
moment a button can replace it. But making it strictly permanent was the wrong end of the
same argument: the one thing every visitor eventually does is walk off the stage edge, and
that used to earn a «Не втечеш ;)» toast telling them off for finding it. Now it hatches a
new character. The reroll exists, it is discovered rather than offered, and it costs the
character you had — which is what keeps the tier meaning something.

The first-run gift is re-offered only until a character actually exists in storage, which is
a separate gate from the onboarding tip on purpose: abandoning the ceremony writes nothing,
and sharing the tip's key would have stranded that visitor with the default look forever.

**Rarity is drawn tier-first, not scored from the traits.** A score over twelve independent
draws produces statistically rare looks that nobody can *read* as rare — a 1-in-3000
combination of an extreme height and blue eyes is, to the eye, a thin person. Tier-first lets
each tier own a pool that looks like its tier, and the legendary tier is six authored looks
rather than a weighted draw, so the rarest result is always unmistakable. The corollary trap,
worth stating because it is easy to walk into: **a skin tone must never be a rarity signal.**
All four are drawn evenly at every tier, and a test enforces it.

**Every tier gets the same ceremony, and it is the loud one.** Scaling the spectacle to the
roll is the obvious design and the wrong one here: with a single lifetime pull, 58% of
visitors would only ever see the cheap version of the only reveal they get. The tier lives in
the glow colour and on the card instead. For the same reason there is no pity counter and no
repeat-guard — both only made sense while rerolls existed, and the draw is now pure.

**Every character is named, even a common one.** A name is what makes a character something
you can talk about; a look with no name is just an outfit. The card shows the tier and the
name and nothing else — the trait list it used to print described the outfit, which the
visitor can already see standing in front of them.

**The gift saves at the reveal, not on a confirm button.** The draft/commit model existed so
exploration was reversible; a gacha has nothing to explore. What is on disk now always
matches what is on stage — the invariant the editor deliberately broke and paid for with
`openingConfig` bookkeeping.

**`av2.mascot.v4`.** v3 looks were authored and carry no tier; per the standing rule below,
the key bump is how returning visitors get reset.

### Why the ceremony is procedural, not an `AnimationMixer`

Three.js ships a keyframe system — `AnimationClip` / `AnimationMixer` / `KeyframeTrack` — and
the reveal looks exactly like what it is for: a fixed, multi-track, time-addressable sequence.
It was evaluated and declined on two specifics.

The anticipation beat is a **frequency sweep**: `sin(t·ω)·amp` with both ω and amp ramping
through the strain. Keyframes can't express that analytically, so it would have to be baked at
~60 keys per tier × 4 tiers — more authoring, more memory, and visibly worse than two lines of
trigonometry (the phase is integrated per frame, precisely so ω can move). And the beats that
actually carry the moment — `fireworks.spawn`, `bumpHitPulse`, the pre-scheduled audio batch,
`applyMascotConfig()` on the burst frame — are discrete events, not tracks. A mixer would have
owned the box's transform and nothing else, leaving two clocks to keep in sync in a codebase
that has exactly one.

What the mixer *did* earn: `timeScale`, reproduced as `giftReveal.rate`, which collapses
reduced-motion and the `giftfast` test flag into one number instead of two parallel sets of
durations that could drift from each other. The cost of declining the rest is
`applyCeremonyEndState()`, which `action.time = duration` would have given for free.

→ [[Mascot]], [[SPEC]] §13

## The free camera is a setting, not a replacement — 2026-08-12

The pursuit camera is right for the visitor this site is built for: someone who lands on a
music school's page, walks a mascot around for forty seconds, and leaves. It keeps the hero
in frame and never lets you get lost. It is wrong for the visitor who wants to *look at the
room* — and the stage rewards that visitor specifically, with a maker's mark on the reverse
of the backdrop that is reachable only by orbiting behind the stage. Mobile could not reach
it at all: one finger panned, `enableRotate` was off.

**КАМЕРА** joins the mixer beside **ГРАФІКА**: the original framed camera (one pointer
rotates the mascot into a fixed low-centre composition; mobile pans and scouts back) and a
second option that rotates freely on every device, pitch opening to ~25°–93°. Which of the
two ships as the default moved twice on the day this landed — see the two addenda below —
so treat this section as describing the mechanism, not the current default; [[SPEC]] § Камера
is the source of truth for that.

**Вільна frees the angle, not the subject** — and the first cut got this wrong. It stood the
follow spring down entirely, on the assumption that "free" and "follows" were opposed. They
are not: the spring applies one delta to *both* `controls.target` and `camera.position`, so
it is a rigid translation that leaves azimuth, polar and distance exactly as the visitor set
them. It cannot fight an orbit. The only gesture it ever pulled against is Не дуже's
mobile pan, which drags the target off the mascot — which is why that mode suspends the
spring while scouting and Вільна, having no pan at all, never needs to.

Cutting it cost real things and bought none: walk the mascot and they left the frame with no
way back short of changing the setting, and the fall-respawn path restored the pre-fall
camera while teleporting the mascot to spawn, so a visitor could fall off the lip and be left
looking at empty stage holding a «Не втечеш ;)» toast. Nothing was gained in exchange —
orbiting past ~8 units of distance still carries the camera behind the back wall (`z ≈ -5.85`
against a mascot near `z ≈ 2.15`), so the maker's mark stays reachable with the subject
locked. The honest consequence is that on desktop the two modes now differ only in pitch;
the setting earns its keep on phones, where it is pan-across versus orbit-around.

Three things this shape forced, each of which is the general rule:

- **A runtime-switchable branch must be total.** `applyMobileOrbitPolicy()` had a mobile
  branch that never assigned `rotateSpeed`, harmlessly inheriting OrbitControls' `1.0`
  because the branch was chosen once at boot and never changed. The moment the mode became
  a live toggle, that omission turned into hysteresis — flip to free and back and mobile
  close-ups would silently keep desktop's `0.48`. Every branch now assigns every property
  it cares about, including the inherited default, pinned explicitly.
- **"Free" still has one floor.** The upper pitch bound is not taste; it is derived. Eye
  height is `target.y + distance · cos(polar)`, so the limit sits where the camera still
  clears the platform at the portrait maximum distance of 22. Below it you are looking up
  at the under-stage venue plane, which is deliberately unlit and reads as a bug.
- **Live, but not mid-focus.** Unlike ГРАФІКА there is no reload gate — the rig re-reads
  its limits in place. But a close-up owns the rig outright, so a switch made while an
  instrument is focused is *deferred* to the exit path, which already calls back into the
  orbit policy. Applying it immediately would drag the measured play surface out from under
  the visitor's fingers.

**Addendum, same day: named Вільна / Не дуже, and made Вільна the default.** The labels
ЗА ГЕРОЄМ / ВІЛЬНА described mechanism (what the camera tracks); Вільна / Не дуже reads as a
question and its answer, which is friendlier for a settings row nobody is required to
understand — «Вільна?» «Не дуже.» Order matters here specifically: Не дуже only parses
following Вільна, so it has to render second or the pair stops being a phrase.

The default flip only became defensible *because* of the fix above. While "free" also meant
"the mascot can leave the frame with no way back", defaulting to it would have handed every
first-time visitor a broken-feeling camera before they had found the setting to undo it. With
the follow spring running underneath both modes, Вільна costs nothing a visitor would notice
losing and gains the view this whole feature was built for, so it became the shipped default
and Не дуже became the opt-out for whoever prefers the calmer, fixed composition.

**Second addendum, same day: reverted the default back to Не дуже.** No defect drove this
one — the follow-spring fix above stands, and Вільна remains exactly as safe to *offer* as
it was when it briefly shipped as the default. This was a plain preference call on which
camera a first-time visitor should land on, made after seeing Вільна live: the studio wanted
the calmer, familiar framing as the thing nobody has to choose, with the free-orbit view kept
one tap away for whoever goes looking for it. `av2.camera.v1` still defaults to `follow`;
existing `free` preferences already saved in a visitor's `localStorage` are untouched — this
only changes what a visitor with no saved preference gets.

→ [[SPEC]] § Камера

---

## A zoom guard that cancels `touchend` is a guard that cancels the tap — 2026-08-12

Reported as "click detection is not always working, mostly the HUD, and sometimes the button
just selects." Four separate defects wearing one symptom, and each is a general rule worth
keeping:

- **`preventDefault()` on `touchend` suppresses the synthesized `click`.** The double-tap-zoom
  blocker kept one document-wide timestamp and cancelled any touchend within 320 ms of the
  previous one, anywhere on the page. Every HUD control is bound to plain `click`, so a tap
  that followed a joystick release, a canvas tap, or another HUD tap was silently dead. A
  blanket `touchend` blocker and a `click`-bound UI cannot coexist. Controls are now exempt.
- **`touch-action` does not inherit** — which is why the CSS did not already cover this, and
  why the guard is narrowed rather than deleted. `button, a, .pill-btn, .icon-btn` carry
  `manipulation`, but their *containers* (`#mobile-controls`, `.vibe-track`, `.hud-right`) are
  still `auto`, and those are what the JS guard is for.
- **A double tap is a place as well as a time.** Two taps 200 px apart are two intentions; the
  old check only compared timestamps. 44 px of slop — the minimum touch target.
- **An unguarded `:hover` is a touch bug.** iOS applies `:hover` on tap and holds it until the
  next tap elsewhere, so `.icon-btn:hover` left a HUD icon latched gold and lifted and
  `.close-btn:hover` left ✕ rotated 90°: chosen-looking, not fired. All 25 rules moved under
  `@media (hover: hover)`; the `:focus-visible` halves stayed out of it. Wrapping beat a
  neutralizing `(hover: none)` block because a media query changes neither specificity nor
  source order, so no cascade could shift — and because a neutralizer would have had to
  restate every property forever, silently repainting `.is-on` states as unselected.
  The only durable fix is the test, because the symptom is a stuck highlight nobody files.
- **`.panel *  { user-select: text }` applied to buttons too**, so a press with a little drag
  highlighted the label instead of activating. Prose stays copyable; controls are excluded.

The **ГРАТИ** guard from `4c29cc7` had a hole this made visible: it was two timestamps checked
in two places, at 700 ms on ГРАТИ and 500 ms on ✕, so between the two the original bug still
fired — and the old blocker above was accidentally acting as a fourth guard, so fixing it
first would have widened the gap. Both windows are gone, replaced by one swallower armed by
the press: it self-clears on the click it was armed for, so ✕ is not dead once legitimately
seated, and `detail === 0` lets a real keyboard Enter through. `syncMobileInstrumentChrome()`
stays as the companion guard. Same one-shot shape replaced the chip's flat 400 ms swallower,
which had been eating the visitor's next deliberate tap.

`tests/touch-guards.test.mjs` pins the two predicates; `tests/site-meta.test.mjs` gained three
source scans — every `:hover` guarded, panel controls excluded, and one cache stamp across the
module graph. That last one found existing drift the first time it ran.

---

## The site speaks Polish too, and the Polish half stays out of search — 2026-08-11

`/pl/` mirrors the hub and the four lesson pages on Polish slugs, plus one page the
Ukrainian side does not have: `/pl/polityka-prywatnosci/`, a RODO notice. The studio is in
Łódź; half the people who walk past it read Polish.

- **Root stays Ukrainian.** The indexed URLs and every bookmark keep working, and the new
  language is added rather than negotiated — no redirect, no `Accept-Language` guessing.
  A visitor who wanted Ukrainian and got Polish because of a browser setting is a bug that
  is invisible to whoever shipped it.
- **`noindex`, deliberately.** The Ukrainian slugs carry the search intent this studio is
  found by ("уроки гітари Лодзь"), and a second set of pages for the same four lessons in
  the same city would compete with them rather than add reach. So: `noindex`, no canonical,
  no `hreflang`, no JSON-LD, out of `sitemap.xml` — but **`robots.txt` still allows
  crawling**, because a crawler that is blocked never gets to read the `noindex`. Every one
  of those is asserted in `tests/site-meta.test.mjs`; none of them shows on the page, so
  none of them fails visibly.
- **The switch is pairwise and is a link.** Guitar-UA goes to guitar-PL, not to the home
  page. A switch that dumps everyone on the hub still "works" — nothing errors, so nothing
  complains — which is exactly why the test names all twelve pairs. The current language is
  a `<span>`, not a self-link: it is not a destination.
- **Prices stayed one file.** `prices.json` gained `displayPl` / `descriptionPl` /
  `paymentNotePl` beside the Ukrainian originals rather than a Polish string table inside
  `tools/sync-prices.mjs`. The studio owner edits one file to change a price; adding a
  promotion without its Polish line fails the sync script **by name** instead of shipping a
  half-translated page. → [[Prices]]
- **The RODO page is a notice, not a banner.** The site sets no cookies, which is the whole
  reason it needs no consent gate (see the GoatCounter entry below) — so the notice opens by
  saying so and then describes, honestly, what actually happens: cookieless statistics, the
  Open-Meteo request the visitor's own browser makes, Meta as a separate administrator once
  a booking button is pressed, and the stage's `localStorage` and public signs. Administrator
  contact is the Instagram / Messenger DM, because that is the only contact the studio
  publishes and inventing an e-mail would be worse than naming the real channel.
- **Words in CSS were the one thing HTML review could not catch.** `.lesson-card::after`
  printed «детальніше »» from `content:`, so the Polish cards spoke Ukrainian while every
  page looked correct in the diff. Fixed with `:lang(pl)`, and `tests/site-meta.test.mjs`
  now fails on any Cyrillic `content:` that has no `:lang(pl)` counterpart.

The 3D stage stays Ukrainian. Translating ~12k lines of stage UI is a different project, and
both languages link to it as it is.

---

## Telegram is gone from the signs feature entirely — 2026-08-09

The mirror, the seed, the bot token and the credentials file are all removed. The backend
now makes **no outbound calls at all** and holds no secrets; `signs.db` is the whole store.

The mirror had been kept on the theory that the channel was still "the record a human
reads". In practice it was a write-only copy nobody read: the stage stopped reading it the
moment the backend landed, and the seed only ran when the database was empty — so owner
edits in Telegram never flowed back anyway (recorded as a known drift the same day). It was
paying a per-write API call, a rate-limit exposure and a stored credential for a copy that
was already advisory.

**The part that actually mattered was the backup, and that is now explicit rather than
incidental.** The pinned message doubled as the off-server copy of the wall; deleting the
mirror would have left `signs.db` as the only artefact anywhere, with nothing snapshotting
it. So `deploy/signs-backup/` was repurposed rather than deleted — same two-hourly cron,
now snapshotting the database instead of the channel. **Two things it must do that a naive
version gets wrong:**

- **`sqlite3 .backup`, never `cp`.** The database runs in WAL mode and is written live, so
  copying the file can catch a torn page and strand the `-wal`. `.backup` takes a
  consistent snapshot of a running database.
- **Write to a temp file and promote only after the snapshot opens.** A failed backup must
  never overwrite a good one — the same rule the Telegram-era script had, for the same
  reason.

Verified end to end: the snapshot restores and reads back its rows, a second run correctly
skips because nothing changed, and a write to the live API now leaves the pinned message
untouched — which is the proof the mirror is really gone.

**What this costs.** The VPS disk is now genuinely the single point of failure for the
signature wall, mitigated only by that cron. Before, a lost disk still left the pin. Judged
worth it: a backup that is designed as a backup beats a side-effect that happened to serve
as one.

**Not touched:** `js/core/telegram.js` and [[SPEC]] §10. Those are the in-app browser /
Mini App guards for visitors who open the site *from* a Telegram link — swipe-dismiss
protection and touch claiming. Unrelated to storage, and user-facing.

---

## Links are allowed on the stage again — 2026-08-09

The signature wall rejected anything matching `https?:`, `://` or `www.`, client-side and
then server-side. Both checks are gone, by owner decision.

Worth recording because the original reasoning was sound and is now simply outranked: the
rule existed to keep the wall "a signature, not a link board". What it actually did at 24
characters was reject strings that were never a viable link anyway — `www.a.co` fits, a
real URL does not — while catching honest signatures that happened to contain `://` or a
domain-shaped fragment. **The character cap was always doing the work the link rule was
credited with.**

What still holds the line: 24 code points, five curated colours, whitespace collapse, and
the invisibles / zalgo strip. All server-side since the backend landed, so none of it is
bypassable. Nothing about moderation changed either — the owner still edits the pinned
message or the database directly.

The client-side pre-check went with it, so a link no longer produces «Сцена — для підписів,
не для посилань.» There is no replacement message: the input is simply accepted.

---

## The signs race needed a server, so it got the smallest one — 2026-08-09

«Хтось підписався одночасно — спробуй ще раз.» was an honest report of a design that could
not do better, and it is now deleted because the case cannot arise.

The browser-writes-Telegram design had every client rewrite the **whole** pinned message.
Two visitors signing at once overwrote one another and the Bot API reported success to
both. A read-back check added earlier could *detect* the loss after the fact; nothing
client-side could prevent it, because **read-modify-write from N browsers has no
serialisation point**. That is the entire argument for a backend here — not scale, not
features.

`deploy/av2-signs/server.js` is the smallest thing that provides one: a single Node file,
no dependencies, the built-in `node:sqlite`, behind the nginx + Let's Encrypt setup that
was already sitting on the VPS from the first-cut backend. Slot allocation and insert
happen in **one synchronous transaction in a single process**, so the event loop cannot
interleave two writers; `slot INTEGER UNIQUE` is the backstop if that ever stops being
true. 100 concurrent writes against a 67-slot stage: exactly 67 accepted, 67 distinct
slots, 33 refused as full, zero duplicates.

What fell out of it, none of which was the goal:

- **The write key stopped shipping.** [[SPEC]] §12's «one deliberate exception: no secrets
  in repo» is retired outright — the browser now holds a URL. The credential lives in
  `/etc/av2-signs.env`, mode 600.
- **Validation became enforcement.** The 24-character cap, curated colours and the
  zalgo/invisibles strip all ran client-side, where DevTools walks past them. They
  now run where they cannot be bypassed. The client keeps its copies purely so the visitor
  gets an answer without a round trip.
- **`chooseSlot()` disappeared from `js/scene/signs.js`.** Slot allocation *was* the
  read-modify-write; moving it server-side left the function with no callers. That module
  now renders the slot a sign already carries and nothing more.

**The channel keeps its job.** The backend rewrites the pinned message from the database
after every accepted sign, so the pin mirrors the authority rather than racing it — the
owner still reads and moderates in Telegram, and `deploy/signs-backup/` still snapshots
that pin as the copy held off the server. On first boot with an empty database the server
seeds itself *from* the pin, which is how «Це що, стіна????» carried across with its slot
intact and why the migration needed no import step.

**Rate limiting came back, in memory only.** Per-IP throttling was dropped in the original
move to Telegram because storing IPs is what forces a cookie banner. A throttle that is
never written to disk is transient rather than stored, so the no-banner position holds, and
it is the difference between "one script fills the wall in a minute" and "it cannot".
nginx overwrites `X-Real-IP`, so it cannot be spoofed.

**The honest limits.** The VPS is now a single point of failure the stage did not have when
Telegram was the store — if it goes down the feature vanishes, which the absent-if-
unreachable contract already covers, but a *lost disk* would cost every sign not in the
last pin mirror. And a hand-edited pin is only re-read when the database is empty, so owner
moderation in Telegram and the database can drift until someone reconciles them.

`git show` on this commit has the full reasoning; the unit, nginx conf and install steps
live in `deploy/av2-signs/`.

---

## The AUTO tier switch waits for the camera to land — 2026-08-08

The freeze visitors hit mid-zoom on a fresh browser was never the fly-in. It was the AUTO
probe promoting on top of it. The probe's first window closes ~1.35 s after the first
frame; the fly-in runs 0 → 2.6 s from the same instant, so the promotion landed almost
exactly halfway through the camera move. And promotion is not a cheap flag flip: shadow
casting is part of the light state every lit material compiles against, so turning it back
on **rebuilds essentially every shader program in the scene** — measured 39 → 56 programs,
a single 1120 ms blocking frame with a *warm* driver cache. On a fresh browser the GPU
program cache is cold too, and bloom's own passes, a 1 → 2 pixel-ratio reallocation and a
cold fetch of the five postprocessing modules all pile onto the same frame. That is the
2–3 s.

Three changes, none of which touch the AUTO policy in [[SPEC]]:

- The verdict is **held while `session.flyT >= 0`**. The probe keeps sampling — the extra
  second only sharpens p90 — and applies once the camera is at rest.
- The switch warms through `renderer.compileAsync()` rather than the next render.
  `KHR_parallel_shader_compile` lets the driver link on background threads; `main.js` holds
  the frame loop on `qualityWarmup` so no frame blocks on a half-linked program. The 1120 ms
  block became ~990 ms of *responsive* wall-clock plus one 187 ms frame.
- The postprocessing modules are fetched during boot instead of at promotion, so a cold
  network round-trip never stacks on the rebuild.

The alternative was holding the splash until the tier settled, which buys a perfectly smooth
zoom for ~2.3 s of extra time-to-stage. Rejected: the whole commercial goal is feeling the
studio inside a minute, and the residual hold is one frame on a still camera.

---

## Variant quality is a rendering pass, not a new wardrobe — 2026-08-07

The mascot's customization options kept their exact IDs and sets, but each variant now
renders richer: eyes are layered sclera / iris / pupil so ЗЕЛЕНІ and БЛАКИТНІ read as
colors instead of dark blobs (the iris hexes brightened with them, swatches in
`stage/index.html` updated to match); ДОВГЕ gets an authored back-fall mass so long hair
exists from behind; окуляри get tinted lens fills; and the garment and hair carry
build-time canvas micro-textures (knit weave, ribbed trim, strands) that are near-white so
every recolor slot tints exactly as before. Nothing new allocates on change — geometry and
textures are built once in `buildMascot()` and toggled or recolored in place, which keeps
the 20-change stress contract and the curated-shadow-caster rule intact (the back fall
joined the casters as a major hair mass). Saved `av2.mascot.v3` configs render unchanged
in identity, just better — that's why no key bump.

---

## The full meter is the stage's one unlock — 2026-08-07

Signing used to be available the moment the Telegram storage answered, which put it on
screen before the visitor had done anything. It now opens on the **first VIBE fill**,
alongside the loop pedal, so the stage has a single unlock beat instead of two unrelated
ones — and the wall gets signed by someone who actually played, which is the whole point of
a signature on a stage.

The toast lost its inventory: **Максимальний вайб! Тепер ти можеш більше.** replaces
naming the loop pedal. Two controls appearing at once say what opened better than a list
does, and the copy no longer has to be rewritten every time the fill unlocks something
new — which had already happened once.

`js/play/vibe.js` sits below `js/shell/`, so it cannot reach the sign button directly.
main.js injects the reveal through `initVibe({ onFirstFill })`, the same pattern the rest
of the play modules use — see [[Architecture]] on why an upward import here would be a
silent `undefined` rather than an error. The button's visibility is recomputed rather than
flipped on, because the meter can fill either side of the storage probe resolving and both
orders have to land correctly.

---

## Signs live in a Telegram channel, not on a server — 2026-08-07

Visitors can now sign the stage: short glowing tags, one per visitor per 7 days, on the
back-wall band under the screen — spilling onto the stage floor once the wall's twenty
slots are taken. The first cut ran on the VPS (nginx + a Node file at
`back.artvibe.com.pl`, per-IP rate limits); it was replaced the same day, and the reasons
are worth keeping:

- **No personal data beats rate-limit rigor.** Per-IP limiting means storing IPs. Dropping
  it makes the privacy story trivial — no cookies, nothing personal, no banner needed —
  and the gate lives in `localStorage` on the device instead. A determined
  visitor can clear it; the stage survives that. (**2026-08-08:** the gate was a week at
  first and is now 24 hours. A week is a punishment on a stage nobody visits daily, and the
  real ceiling was never the gate — it is the slot count and Telegram's 4096-char head.)
- **A Telegram channel is the whole backend.** The aggregate the stage loads is one pinned
  message — read via `getChat`, rewritten via `editMessageText`, straight from the browser
  (`api.telegram.org` sends `Access-Control-Allow-Origin: *`). Bots cannot read channel
  history, which is why the aggregate is a pinned message and not "sum the messages".
  When the head nears Telegram's 4096-char ceiling, rows older than the displayed 45 seal
  into archive messages chained by `p` pointers — a linked list hanging off the head, so
  the ceiling caps nothing and no sign is ever discarded. Zero servers to keep alive; if
  the token dies, the feature silently vanishes — the same absent-if-unreachable contract
  as before.
- **The write key ships in the bundle, and that is accepted.** It is base64-chunked so the
  token never appears in the repo or GitHub code search as plain text, but anyone who opens
  DevTools can extract it and spam or wipe the wall. At this scale the blast radius is one
  pinned message — restorable from `deploy/signs-backup/`'s two-hourly snapshot, since
  nothing else records it once the per-sign channel post was dropped (below); a real secret
  would require the server we just deleted. This is the one deliberate exception to
  «no secrets in repo» (SPEC §12).
- **The per-sign channel post was dropped.** Every accepted sign used to also land as a
  plain `✍️ text · colour` post, meant as a human-readable feed for the owner. It was a
  second Telegram message per sign buying nothing the head didn't already have, so it is
  gone — the write is exactly one edit. The trade-off is real: a sign lost to the
  last-writer-wins race (§ Concurrency) is now recorded nowhere until the next backup runs,
  where before the feed post would have caught it. Accepted, because the race is already
  rare and the backup already exists.
- **If storage doesn't answer — or the run is QA (`testhooks`/`headless`/`shot`) — the
  feature doesn't exist.** One probe gates the button, modal and both surfaces; the stage's
  core promise must not inherit a network dependency.
- **The stage is the canvas, not just the wall.** Signs now cover three surfaces — the
  wall band, the front strip the visitor stands on, and the mid-stage boards the drum kit
  and piano sit on. Only the wall glows; on the boards a halo read as light leaking out of
  the floor, so those are plain paint. Running tags *under* the instruments is deliberate: a kit parked over
  old graffiti is what a real stage looks like, and that middle band is both the largest
  bare patch of the platform and better framed than the front strip, because it sits
  further from the camera where the frustum opens out.
- **Budget the head in the unit the limit is actually in.** The seal rule was originally
  written as "more than 70 rows", which was fine while the stage had 45 slots and silently
  wrong the moment it had 75: it archived rows *without removing them*, so the same rows
  were re-archived on every write while the head grew toward Telegram's 4096-character
  ceiling anyway. It now drains from the oldest end until the head fits both the slot count
  and a character budget. **A limit expressed in one unit (rows) that really exists in
  another (characters) will drift the moment either side moves.**
- **A control that cannot do anything should not be on screen.** The marker button is
  present only while the storage answered, the visitor has not signed today, and a slot is
  free. The first version dimmed the button and answered a tap with a toast; a disabled-
  looking control still invites the tap, and the refusal is the reply. Absence says the
  same thing without the round trip.
- **67 slots, and the wall gave them up.** Capacity is deliberately small enough that a
  signature means something. The reduction came out of the wall rather than the floors: it
  is the surface furthest from the camera, so its tags were always the smallest and hardest
  to read, and 4×3 makes the remaining ones markedly bigger.
- **The stage fills once and closes.** Slots are not recycled, so the wall is
  first-come-first-served rather than a rolling window — which is what makes leaving a sign
  worth anything. When it is full the owner clears it from Telegram.
- **The head is a line format, not JSON.** `id|colour|slot|text` per line under an
  `AV2 n=… t=…` header is ~25% smaller than the equivalent JSON, which directly buys
  displayed signs against Telegram's 4096-character ceiling — and it is readable to the
  owner scrolling the channel, which JSON was not.
- **A sign's position is decided once, at creation, and stored with it.** The first cut
  derived positions from ids on every render — which meant a sign could shift when an
  older neighbour retired and the layout re-flowed around it. Now the creating client
  picks the first free slot (wall slots before floor slots — that ordering is what makes
  the floor open only after the wall is full) and writes it into the sign's row, so a
  sign stays exactly where it was put for as long as it lives.

Curated colors, a 24-character cap, zalgo squeeze and link rejection keep it a signature
wall rather than a message board — the same "curated, not configurable" stance as the
mascot editor. The copy says «сцена», never «стіна».

*(Link rejection was dropped on 2026-08-09 — see the entry at the top of this file. The
other three still stand; 24 characters is what actually keeps this a signature rather than
a message board, and a URL does not fit in 24 characters anyway.)*

---

## A full VIBE meter stays full — 2026-08-07

The meter used to hit 100, celebrate, then drop to 55 and be re-earned, with a 4-second
cooldown throttling repeat celebrations. It now latches: reaching 100 is a one-way door, the
idle decay stands down, and the fireworks + unlock + announcement fire exactly once.

Two things fell *out* of that rather than being decided separately, which is the interesting
part:

- **The cooldown deleted itself.** It existed only to stop repeat celebrations. With one fill
  per visit there is nothing to throttle, so `play.vibeCooldown` and the branch reading it are
  gone and `addVibe` reads as a straight line.
- **An `infinite` animation became a bug the moment the class became permanent.**
  `#vibe.max #vibe-fill` was `animation: vibeFlash .5s linear infinite` — perfectly fine while
  `.max` lasted 3.6 seconds, a 2 Hz strobe in the HUD for the rest of the session once `.max`
  never goes away. Now a finite 6-iteration burst settling into a brighter steady rail.
  **Worth generalising: any `infinite` animation is a bet on how long its class lives.**

Same day, the meter got ~40% harder to fill via a single `VIBE_NOTE_GAIN` (0.7) applied in
`addVibe`. The per-event weights scattered across the play modules (drums 4, guitar strum 5,
piano 3.5…) are *relative* values worth keeping as they are; scaling them at the one point
they converge means retuning the reward loop is one number, not eight call sites. The
`setState('vibe')` test hook divides by the gain so it still fills outright.

## Praise, but only where it means something — 2026-08-06/07

Short cheers — **Супер! / Потужно! / Клас!** — on the **third** live note out of each
instrument. Four times a session at most, then silence. Rules that keep it from becoming
wallpaper, each of which cost an iteration to find:

- **Never the same word twice running.** A repeat reads as a canned response rather than as
  someone reacting to what you just played.
- **The third note, not the first.** It fired on the first two notes of a *visit* initially,
  which cheered one instrument twice and left the other three silent; then on each
  instrument's first note. Third is better than first because on the first a visitor may not
  be sure they caused the sound at all — by the third they are deliberately playing, so it
  reads as "you've got this" rather than "something happened".
- **Yields to a toast already on screen** — anything else the stage chose to say carries more
  than a cheer. But a yielded cheer is **retried on the next note, not spent**: the first
  version marked the instrument praised even when the toast was swallowed, so an instrument
  whose moment collided with another message never got one at all.

Loop playback can't congratulate you on a loop: replayed notes carry `feedback: false` and
never reach `addVibe()`. Getting the instrument to the cheer meant `addVibe(n, kind)` — most
routes get it free from `runMusicalVisual`, but the vocal pad and keyboard vocal reach
`addVibe` directly and pass `'mic'` themselves.

Filling the meter keeps its own name, **МАКСИМАЛЬНИЙ ВАЙБ!**, announced once — a cheer there
competed with what the meter already says.

*The third-note trigger was replaced on 2026-08-08 — see below. The rules in this entry
(never twice running, yields to a toast, retried not spent) all survived it.*

## Three discovery layers, all removed — 2026-08-06/07

Worth recording as one decision because it only reads as a decision in aggregate. Within about
a day the stage grew, and then shed, **three separate ways of telling a visitor what to do**:

1. **Screen-space arrows** over all four instruments, under a «Це все грає» caption.
2. **Cloud-shaped thought bubbles** for the onboarding card and hints — a 9-slice
   `border-image` scallop, so the outline survived arbitrary text width.
3. **Per-instrument how-to hints**, one casual line at each first close-up.

Plus, in the same stretch, the `+` / `−` zoom buttons and two confirmation toasts
(**Неперевершено!** after ГОТОВО, and the repeated **МАКСИМАЛЬНИЙ ВАЙБ!**).

The pattern is the point: **the stage is small enough to poke at, and every layer of
instruction printed over it bought less than the clutter cost.** Four instruments that glow on
hover and make noise when clicked do not need a caption. Before adding another, know that this
ground has been walked.

Two things worth keeping from the wreckage:

- **Describe the gesture, not the UI.** The hint copy that worked said «по них треба бити», not
  "use the drum pads" — someone new does not yet know there *are* pads, so naming them explains
  the wrong thing.
- **A one-time nudge must never swallow a tap.** The arrows were `pointer-events: none` and
  `aria-hidden` for exactly this reason.

`git log -S instrument-arrows`, `-S showFirstFocusInstrumentHint` and `-S "--cloud"` find the
three implementations if any of it is ever wanted back.

## The stage's architecture became a reusable skill chain — 2026-08-06

Every new-experience idea ("what if a forest? a warehouse?") was re-deriving the same
answers this repo already paid for: the layering, the test hooks, the funnel-survives-WebGL
rule. Six skills under `.claude/skills/` (`xp`, `xp-scene`, `xp-objects`, `xp-mascot`,
`xp-customize`, `xp-funnel`) now encode them as a staged pipeline. Two choices carry the
design: a per-experience `experience.json` manifest makes every stage **re-runnable**
(iteration is a manifest diff, not a rebuild), and the optional stages record a
`skipped` decision instead of a silent absence, so "no mascot" reads as a choice, not an
oversight. Not site behaviour — [[SPEC]] untouched. → [[Experience chain]]

The engineering was polished and the site was **commercially blind**: no analytics of any
kind, so nobody could say whether the 3D stage — the expensive half of the product — produced
a single booking.

**GoatCounter, because it is cookieless.** The audience is in the EU; a cookie-based tool
would owe them a consent banner, which is both work and a blot on the 2007-era skin. That
constraint, not a feature comparison, picked the tool. Swapping in anything cookie-based
re-opens the banner question. → [[Lesson site]]

**Clicks, not pageviews, are the number.** Booking happens inside Instagram and Messenger
DMs, so the outbound click is the last thing this site can observe — it *is* the conversion.
Hence `book-{channel}-{page}` on every `ig.me` / `m.me` anchor, delegated so it survives
markup changes. The plain profile links (footer, «відгуки та викладачі», JSON-LD `sameAs`)
are deliberately excluded — they are browsing, not booking, which is the same distinction
`2be3a1a` drew.

**`stage-enter` measures a session starting, not a button being pressed.** Worth knowing
before reading the dashboard: since `7602710` the scene enters itself once assets load and
nothing ever enables `#enter-btn`, so the funnel head hooks `startExperience()` and
`startWithoutIntro()`. `stage-first-play` hooks `addVibe()` because *every* play route —
close-up, pad, keyboard — funnels through it; anything narrower would miss the keyboard jam.
The stale "click enter" instruction in [[Dev workflows]], [[Gotchas]] and `AGENTS.md` was
corrected in passing — it had been telling readers to click a button that cannot be clicked.

**No analytics call may sit in the path of a booking link.** The beacon is blocked for a fair
share of visitors, so both modules swallow their own failures and a test pins that they do.
QA runs (`testhooks` / `headless` / `shot`) record into `window.__av2Events` but never send,
so headless checks can assert the funnel without writing to the dashboard.

Hits go to `https://count.artvibe.com.pl/count`, a CNAME onto the GoatCounter site. **That
domain needs a certificate covering it, not just the DNS record** — at time of writing it
serves the default `goatcounter.com` cert, so browsers refuse the connection and every hit is
lost while the pages look perfectly healthy. The failure mode of analytics is always silence,
which is exactly why it is worth a check rather than a glance. → [[SPEC]] §11

Same change, smaller pieces:

- **A branded `404.html`.** The deploy artifact list is a hand-written `cp -R`, so a new
  top-level file silently never ships — the drums page lost its `og:image` to the same class
  of invisible failure. A test now asserts the workflow copies it. Note `python3 -m
  http.server` has no fallback-document support, so locally an unmatched path always shows
  Python's own error page; only GitHub Pages routes to `404.html`. → [[Dev workflows]]
- **The WebGL-fail panel stops being a dead end** — it now offers the lesson site and the
  Instagram booking link, so an unsupported device can still book. Analytics never load on
  that path, because the module graph dies at the renderer throw.
- **The stage ships minified Three.js.** It was serving the unminified dev build: 258 KB gzip
  down to 167 KB, importmap swap only. The unminified build stays in the repo for debugging.
- **`og:image` removed from every page**, by owner decision — share previews are now plain
  links. The schema.org `"image"` field and the stage's `twitter:image` were left in place.

## The lesson site became the front door — `b259446`, 2026-08-06

The lesson hub was at `/uk/` while the 3D stage sat at `/`. But the lesson pages are what
search traffic and bookings need to land on, so they swapped: `/uk/` → `/`, the four
`uroky-*-lodz` pages dropped their prefix, and the stage moved to `/stage/` with a HUD exit
back to the site. `/uk/*` survives as redirect stubs.

**The knock-on effect is the one to remember:** the stage used *document-relative* asset
paths, which only worked because it lived at the root. Under `/stage/` those would 404, so
its HTML, import map and both runtime `fetch()` calls (`prices.json`, `img/slides.json`)
became **site-absolute**. Canonicals, hreflang, JSON-LD, `sitemap.xml`, the price-sync tool,
the tests and the deploy list all followed. → [[Architecture]], [[Gotchas]]

## The credit heart beats — `6e28441` / `861dafa`, 2026-08-05/06

The only affordance was a hover underline, which touch never sees and a mouse finds by
accident, so nobody knew the line did anything. The heart now beats — **lub, dub, then nine
tenths of the cycle perfectly still.** The stillness is the design: a pulse that never stops
moving reads as a demand. With motion off, the underline stops waiting to be hovered and
simply stays. → [[Lesson site]]

## GLAMOUR opens on a dimmer stage — `233f3ea`, 2026-08-06

The **Світло** fader defaulted to 78 everywhere except PIXEL. GLAMOUR carries bloom, and
that brightness becomes glare once a close-up fills the frame with the guitar. GLAMOUR's
unset default is now **67**; PIXEL keeps 100, AUTO keeps 78, and any *saved* preference still
wins over all three.

## Hover glow lives on the material, not the mesh — `7949b11`, 2026-08-06

A genuinely instructive bug. `setGlow` remembered each mesh's rest colour **on the mesh** —
but instruments **share materials**: the piano's 28 cabinet meshes run on 8 of them. So the
second mesh of a shared material recorded the *first* mesh's glow as its own base; releasing
the hover restored mesh 1 to dark and mesh 2 immediately repainted the glow onto the same
material. Hovering the piano lit it forever.

Measured against the real `buildPiano()` in Node: **20 of 28 cabinet meshes stayed lit after
one hover, 0 after the fix.** Rest colour now lives on the material in `js/view/emissive.js`.
The mic's onboarding pulse had the identical bug and shares the helper.

Same commit: a close-up no longer glows on hover. The glow means "walk over here" — once the
camera has committed you are already there and the pointer *plays* instead, so lighting the
whole instrument only smears it.

Also a good example of the honesty norm in this repo: the commit states plainly that WebGL
could not start in the preview pane on that machine, so the material bookkeeping was covered
by tests and a Node check while the close-up suppression was reviewed by reading. → [[Gotchas]]

## Every instrument gets its own price list — `4e8e35f`, 2026-08-05

`prices.json` grouped instruments into two shared categories, so vocal and guitar (and drums
and piano) couldn't be repriced independently and **every consumer had to know which group an
instrument fell into**. Instruments became top-level entries owning a full list, display name
and board theme. Numbers unchanged.

Payoff: the mixer dropped its hardcoded label map and its "does this group contain drums or
piano?" theme test; price chips stopped hardcoding «від 50 зл» and now quote that
instrument's own cheapest single lesson. Both read through `js/core/prices.js` — one shared
fetch — **so a chip can never contradict the modal it opens.** → [[Prices]]

## Prices are generated, not restated — `3c3f5b9`, 2026-08-05

The static pages restate `prices.json`, and the tests failed when the two disagreed — which
made a price change a *developer* task and a red build. `tools/sync-prices.mjs` now writes
the data into the pages, and the deploy workflow runs it **before** the tests, so the studio
can edit `prices.json` alone. Only structural drift, which the script cannot invent, still
fails the build.

Same commit introduced the rule that **no amount lives outside a price cell**, with a test to
keep it that way. → [[Prices]]

## Booking links point at a conversation, not a profile — `2be3a1a` / `5b7c1f3`, 2026-08-05

Step 4 tells visitors what to write — «Напиши нам у директ "Хочу на урок"» — so the buttons
beside it should land where that message goes. The Instagram ones opened the profile feed;
both now use the `ig.me` deep link, and the Messenger prefill repeats the same phrase.
Browsing links (footer, «відгуки та викладачі», JSON-LD `sameAs`) deliberately keep the plain
profile URL. → [[Lesson site]]

## The `+` / `−` zoom buttons are gone — 2026-08-06

Removed on request, and cheap because they were never the zoom *mechanism* — just two callers
of `zoomScene()`. Pinch and wheel go through OrbitControls' own `enableZoom`, so zoom is
unchanged on every device; only the on-screen buttons went. `zoomScene()` had no other caller
and went with them.

The knock-on worth knowing: the focus fitter measured `#zoom-controls` as one of the chrome
rectangles it frames the keybed *around* ([[Focus framing]]). One fewer blocker on the right
edge means slightly more usable width in a close-up. `visibleChromeRect()` was already
null-safe, so nothing depended on the element existing — but [[SPEC]] named it in the framing
contract in four places, and those had to move too.

## The cache stamp is global, and per-module bumping is the trap — 2026-08-06

Worth writing down because the wrong model *looks* more careful. Bumping only the modules you
edited, plus every import of them, seems tidier than a repo-wide find-and-replace — and it is
broken. A file you did **not** edit keeps its own stamp, so a returning visitor serves it from
cache, and that cached body still names the *old* dependency stamp. `mascot/state.js` was
pinning an old `core/studio.js` exactly this way.

Caught by reading `performance.getEntriesByType('resource')` on a freshly-loaded page and
grouping the module URLs by path: twelve modules were being fetched at two stamps at once.
Grepping the source finds nothing, because the stale reference only exists inside a cached
copy — **the live document is the only place this shows up.** Worth re-running after any bump.

One stamp for the whole of `js/` + `stage/index.html`, always. The same pass closed the
pre-existing `vibe.js` split (one import lagged five others), which had been quietly giving
`piano-notes.js` its own copy of the keyboard-jam chip timer. → [[Gotchas]]

## Chords are generated, and the visitor picks six — 2026-08-06

The pad's six chords were hardcoded, which made "let me play something else" impossible and
"add more chords" an ever-growing table. Both problems have the same answer: **a chord is a
root plus a quality**, and on a guitar a quality is one movable shape slid up the neck. Two
shape families (root on low E, root on A) × 12 roots × 5 qualities = **60 chords from ~10
lines**, lowest position winning so nothing passes fret 8. A short table of preferred *open*
voicings still overrides the common chords — the generated form is correct, just thinner.

**The correctness argument is why this is safe.** A wrong barre shape is silent-but-wrong: it
sounds like a chord, just not the one on the label, and nothing in the running app would ever
show you that. So every voicing is checked against its own interval definition and the
open-string pitches — all 60 sound exactly their chord tones, no extras, none missing. That
check is the reason to trust generation over a hand-written table, not the line count, so it
lives in `tests/guitar-chords.test.mjs` rather than in someone's scratch file. Mutating one
shape (minor's major third) fails it on `Fm`, so it is not passing vacuously.

**Keys stopped being mnemonic.** `E A C D G F` (each chord's first letter) was tried and
reverted the same day: once the visitor can put `Cmaj7` next to `C`, initials collide and the
map becomes unpredictable. `Q W E R T Y` now addresses pad *positions*, which cannot collide.
Focused, those keys are **select-only** like the touch pad — the fretting hand chooses, Space
strums; unfocused they still strum on press, because with no pad on screen a silent arm looks
broken. → [[SPEC]] §Guitar performance mode

A piano chord pad that highlighted the chord's keys was built alongside this and removed
before it shipped — worth knowing it was tried. `git log -S setChordHighlight` finds it.

## The first run dresses you before it explains anything — 2026-08-06

The order was: tip, then **ЗРОЗУМІЛО** opens the mascot editor. It is now the reverse — editor
first, tip after it closes — so the visitor has something of their own on stage *before* being
told they can walk it around.

Two consequences worth keeping:

- **The tip only closes on ЗРОЗУМІЛО.** Playing, walking, Esc and tapping the card all leave it
  standing. It is the last thing the first run says, and every one of those dismissal routes
  was a way to walk past it unread. This deleted `finishOnboard` calls from five modules — and
  with them two genuinely upward imports (`mascot/update.js` and `view/mobile-controls.js` both
  reached into `shell/intro.js`, the second forming a real cycle). Removing a feature removed
  the layering violation, which is the usual shape of these.
- **One key gates the whole sequence.** `av2.onboard.v2` is written only by that click, so
  quitting halfway replays both steps rather than stranding someone who saw the wardrobe but
  never the tip. The old second key (`av2.mascot.after-onboard.v2`) existed only because the
  editor was a *consequence* of a dismissal that had several other routes; with one route it
  is redundant. → [[SPEC]] §9

## The pricing control sells lessons, not a price list — 2026-08-06

The HUD entry point was a gold **ЦІНИ** pill and the panel behind it was headed **Ціни.** —
both framed the studio's one conversion step as a number to compare. It is now a graduation-cap
icon button titled **Уроки та ціни**, and the panel matches. «Уроки» leads because that is what
a visitor is buying; the price is the second word, not the whole proposition.

It stays a **solid gold disc** while every sibling control is a dark circle. That is the point:
losing the word costs it the width that made it read as primary, and the fill is what buys that
back. `.icon-btn.gold` mirrors `.pill-btn.gold` exactly — same fill, same purple hover — so
there is one gold-CTA treatment in the stylesheet rather than two. A glow was tried and
removed: a gold disc is already the brightest thing in the nav. `.nav-btn` had no other user
and went with the pill.

**The price chip lost the word too — 2026-08-08.** Its button said «ЦІНИ ›» beside a title
already reading «Уроки від 50 зл», so the chip spent its gold on naming the panel behind the
press. The number moved onto the button: «🎸 Уроки [ВІД 50 ЗЛ ›]» reads as one line, and the
thing you press is the thing you want to know. Same rule as the HUD control — the label names
what you get, not where you land.

On desktop it also moved up under that HUD button, right edges aligned, so the teaser and the
control it opens read as one thing. `ui._anchorChip()` measures the button on each show rather
than hard-coding an offset: the nav grows a button when the sign form unlocks. **Phones keep
it on the floor** — up there the HUD is a cramped strip and the bottom is where the thumb
already is; the stylesheet owns the phone position and the measured offsets stand down at that
breakpoint. (A same-day detour had the anchor hold on phones too — reverted a few hours later:
the floor position tests better for a control that far up a small screen.) → [[SPEC]] §6

**The chip earns quiet, not a bigger bar to clear — 2026-08-08.** A same-day detour tried
gating the chip behind the visitor's *second* instrument focus — nothing would queue on the
first thing anyone touched. Reverted a few hours later in favor of a simpler rule that does not
change *when* a chip becomes eligible, only how often one actually lands: any shown chip —
however it ended, read, dismissed, or left to time out on its own — buys a 3-minute quiet
period before the next one, of any instrument, is allowed to show (`CHIP_COOLDOWN_MS` in
`vibe.js`, checked in `chipFor` and skipped for forced calls — carousel prev/next, the
`shot=chip` QA hook — since those are a deliberate ask to show one right now). A visitor who
quickly samples several instruments gets one nudge at a time instead of a chip on every focus,
without making the first instrument they ever touch feel unrewarded. → [[SPEC]] §6

---

## The mascot got tailoring, not new options — 2026-08-08

An elegance pass on `js/scene/mascot-model.js` that changes construction, not vocabulary:
every editor option, recolor slot, joint pivot and hair-piece base dimension survives, so
`applyMascotConfig`, the style tables and every solved pose keep working unchanged.

- **The torso is a lathe, not a can.** Shoulder roll, waist, hem flare — profile authored
  around the old y=1.08 pivot so torso-lean poses behave identically.
- **Trim conforms and rides the torso.** Placket and chest stripe are lathe arcs following
  the body surface (phi 0 faces +Z, so a front arc is `phiStart = -len/2`), parented to the
  torso mesh so a lean carries them — the old box trim silently stayed behind.
- **The belt is gone.** Hem rib + waistband torus + gold buckle was three stacked belts of
  visual noise; a varsity jacket ends at its hem band. The freed meshes paid for the ribbed
  stand collar and sneaker heel counters.
- **Shoulder yokes became saddle caps at the arm joins.** They keep carrying the palette's
  `shoulder` slot, and they mask the arm-pivot seam through every swing — which is why they
  stay group-space siblings of the arms, not torso children.
- **The long style's back fall moved from z −0.17 to −0.205** (`appearance.js`): the
  tailored chest bulge (max r 0.293) swallowed it at the old depth.
- Arched torus brows were tried and rejected: at stage distance, under every fringe tilt,
  they read worse than the proven box brows. The elegance lives in silhouette and cloth.

Design was iterated outside the repo in a deterministic Node harness (side-by-side
current/elegant lineup across seven customization variants, PNG contact sheets) — the same
before/after eye that the in-app editor cannot give.

---

## Praise moved onto the meter — 2026-08-08

Cheers now fire as the VIBE meter passes **12 / 40 / 60 %**, not on the third note out of
each instrument. Same three words, same rules; only the trigger changed.

The meter is the thing the visitor is filling, and it is on screen the whole time. Praise
hung off it reads as progress on that bar — the cheer and the thing that moved are the same
object. The per-instrument version had no such anchor: four cheers arrived on a schedule the
visitor could not see, and someone who stayed on one instrument got exactly one of them no
matter how long they played.

- **12% first, deliberately early.** A few notes in, while the visitor is still deciding
  whether this is worth their time. 40 and 60 then mark a bar that is visibly moving.
- **Nothing between 60 and 100.** The fill has its own announcement and its own fireworks;
  a cheer just before it would be talking over the thing it is leading up to.
- **The marker only moves forward.** The idle decay in `main.js` walks the meter back down,
  so a threshold gets re-crossed routinely — tracking *marks passed*, not *the current
  value*, is what keeps a visitor who hovers around 12% from being cheered every few notes.
- **Two marks in one note collapse to one cheer**, rather than stacking two toasts.

`addVibe` lost its `kind` argument with the note counters — nothing else read it, and the
price chips track instruments through their own `queuePriceChip(kind)`.

---

## Standing decisions (not from one commit)

- **No build step.** Vendored Three.js, import maps, manual `?v=` cache stamps. What is in
  the repo is what ships — which is why the layering rules in [[Architecture]] are conventions
  enforced by review rather than by tooling.
- **Audio never pre-empts the visitor's music.** The whole of [[Audio]] follows from this.
- **Mascot movement has no keyboard binding.** That frees the entire desktop keyboard to be a
  multi-instrument jam surface, which is product goal #2 in [[SPEC]] §1.
- **Curated, not configurable.** Small authored pools behind the mascot gift; no colour
  picker, no uploads, no AI avatars, no downloadable wardrobe. The visitor's control is the
  reroll, not a form. → [[Mascot]]
- **Measure the viewport, don't branch on breakpoints.** → [[Focus framing]]
- **`av2.*` storage keys are versioned and deliberately not migrated.** A key bump (e.g.
  `av2.mascot.v4`) is the intended way to reset returning visitors.
