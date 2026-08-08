---
tags: [decisions, history]
---

# Decisions

Why things are the way they are. Newest first.

The commit messages in this repo are unusually good — they carry the reasoning, not just the
change. `git show <hash>` is the primary source; this note is the index into it, so you know
*which* commit to read.

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
  and the 7-day gate lives in `localStorage` on the device instead. A determined
  visitor can clear it; the stage survives that.
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

## Standing decisions (not from one commit)

- **No build step.** Vendored Three.js, import maps, manual `?v=` cache stamps. What is in
  the repo is what ships — which is why the layering rules in [[Architecture]] are conventions
  enforced by review rather than by tooling.
- **Audio never pre-empts the visitor's music.** The whole of [[Audio]] follows from this.
- **Mascot movement has no keyboard binding.** That frees the entire desktop keyboard to be a
  multi-instrument jam surface, which is product goal #2 in [[SPEC]] §1.
- **Curated, not configurable.** Small authored option sets in the mascot editor; no colour
  picker, no uploads, no AI avatars, no downloadable wardrobe. → [[Mascot]]
- **Measure the viewport, don't branch on breakpoints.** → [[Focus framing]]
- **`av2.*` storage keys are versioned and deliberately not migrated.** A key bump (e.g.
  `av2.mascot.v3`) is the intended way to reset returning visitors.
