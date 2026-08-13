# Art Vibe Studio — Specification

Interactive marketing experience for **Art Vibe Studio**, a cultural and educational space in Łódź offering vocal, guitar, piano, and drum lessons: a WebGL 3D stage where visitors walk a mascot, play instruments, and open booking info (steps, rules, prices).

- **Live:** https://artvibe.com.pl
- **Repo / release:** https://github.com/voloshyninthesky/av2 → GitHub Pages (`artvibe.com.pl`) + versioned Nginx preview (`vibe2.ton.zone`)
- **Locale:** Ukrainian (`lang="uk"`) at the root, with a Polish mirror of the lesson pages under `/pl/` (§3 Polish pages)
- **Location:** Łódź, Poland
- **Currency:** PLN (displayed as «зл»)
- **Contact CTAs:** Instagram [@artvibe.pl](https://www.instagram.com/artvibe.pl/) and [Messenger](https://m.me/61564874125852?text=%D0%9F%D1%80%D0%B8%D0%B2%D1%96%D1%82%2C%20%D1%85%D0%BE%D1%87%D1%83%20%D0%BD%D0%B0%20%D1%83%D1%80%D0%BE%D0%BA%21)

Both the stage and the lesson pages split those two CTAs by intent. **Booking** buttons deep-link into a
conversation: `https://ig.me/m/artvibe.pl` and `https://m.me/61564874125852?text=<prefilled
message naming the instrument, no emoji>`. Instagram has no text-prefill parameter, so its
booking link carries no per-page context. **Browsing** links — the footer, and the “відгуки та
викладачі” notes pointing visitors at student reviews and teacher posts — keep the plain profile
URL, as does JSON-LD `sameAs`.

The primary offer on those pages is the **50-зл trial lesson**: a `.trial-offer` gold strip
(«Пробний урок — 30 хв за 50 зл…») sits above the lesson-hero CTAs (on the hub, above the
price-section CTAs). Because Instagram cannot prefill a message, the strip closes by telling
visitors what to type — «Напиши в директ «Хочу на пробний урок», щоб записатися» — and the
Messenger prefill beside it repeats that same phrase. Button labels stay the neutral
«Записатися через …» everywhere; the lesson pages' lower price-section CTAs also keep the plain
booking prefill, since that context includes subscriptions.

Slogan: _Вчись творити і твори навчаючись._

---

## 1. Product goals

1. Let a visitor **feel the studio** (stage, instruments, sound) in under a minute.
2. Teach play in two complementary ways:
   - **Pointer / touch:** approach an instrument, then play while focused.
   - **Desktop keyboard:** away from a close-up, jam **several instruments at once** from disjoint hotkeys — focus is optional for keyboard sound. **Inside** a close-up the keyboard is that instrument's alone.
3. Convert interest into a booking path: **ціни / як записатися → Instagram або Messenger**.

Non-goals: accounts, payments, CMS, sample libraries, native apps.

---

## 2. Brand

| Token    | Value     |
| -------- | --------- |
| Purple   | `#9E33CA` |
| Gold     | `#D1A13B` |
| Cream    | `#FDFBF7` |
| Ink      | `#17121c` |
| Scene bg | `#0a0612` |

**Type:** Unbounded (UI/display), Playfair Display (titles/prices), Manrope (body), JetBrains Mono (meta).

**Tone:** Friendly, short Ukrainian; active voice; no filler.

---

## 3. Architecture

Static site, no build step. ES modules + import map for Three.js.

```
index.html          # lesson hub — the site's front door (static, no stage JS)
404.html            # branded not-found page (GitHub Pages serves it automatically)
uroky-*-lodz/       # instrument-specific SEO lesson pages
pl/                 # Polish mirror: hub, four lesson pages, RODO notice (§ Polish pages)
stage/index.html    # 3D stage: shell, modals, HUD, pads, settings mixer; loads telegram-web-app.js
uk/                 # redirect stubs for the pre-2026-08-06 /uk/* URLs
css/style.css       # design system + overlays
css/lessons.css     # lightweight static lesson pages (deliberate 2007-era skin)
fonts/              # self-hosted faces
img/                # slideshow photos
js/
  main.js           # boot order, cross-module wiring, hover + frame loop
  audio.js          # Web Audio synth + buses + unlock/resume
  ui.js             # HUD, modals, chip, toast
  pricing.js        # interactive price mixer
  guitar-gestures.js# tap-vs-hold classification for chord touches
  lessons-weather.js# Łódź weather widget for the lesson pages
  lessons-credit.js # footer credit fold (lesson pages)
  lessons-analytics.js # booking-click events for the lesson pages
  core/             # errlog, telegram guards, quality tier, session flags, prices, studio boot, analytics
  view/             # render rig, camera framing, focus views, pointer routing, viewport
  scene/            # procedural textures, stage, lighting, screen + slideshow, effects, sign surfaces
  instruments/      # procedural drums / piano / guitar / mic (+ shared materials)
  mascot/           # appearance, model state, poses, walk collision, gift draw + reveal, per-frame update
  play/             # vibe meter, loop pedal, guitar, pads, piano notes, mixer, shared state
  shell/            # post-processing probe, intro flow, signs controller, headless QA hooks
prices.json         # per-instrument lesson prices + promos
piano-notes.json    # optional piano phrase data (kept; not auto-played on focus)
vendor/three/       # vendored Three.js r160 — the importmap loads `three.module.min.js`;
                    # the unminified build stays for debugging (swap the importmap to use it)
CNAME               # artvibe.com.pl for GitHub Pages
.nojekyll
.github/workflows/  # Deploy to GitHub Pages
deploy/nginx/       # live VPS nginx release target
```

**Stack:** Three.js (WebGL), OrbitControls, EffectComposer + UnrealBloomPass, Web Audio API.

### Polish pages (`/pl/`)

The lesson site is served twice: Ukrainian at the root, Polish under `/pl/`. Same offer, same
prices, same 2007 skin — the studio is in Łódź and half the people who walk past it read Polish.

- **Five pages plus a privacy notice**, on Polish slugs: `/pl/`, `/pl/lekcje-spiewu-lodz/`,
  `/pl/lekcje-gitary-lodz/`, `/pl/lekcje-pianina-lodz/`, `/pl/lekcje-perkusji-lodz/`, and
  `/pl/polityka-prywatnosci/`.
- **They are deliberately outside the SEO surface.** Every Polish page carries
  `<meta name="robots" content="noindex, follow">`, no `canonical`, no `hreflang` annotation
  and **no JSON-LD**, and none of them is in `sitemap.xml`. The Ukrainian slugs carry the search
  intent this studio is found by, and a second set of pages for the same four lessons in the same
  city would only compete with them. `robots.txt` still **allows** crawling: a crawler has to
  fetch the page to read the `noindex`, and a `Disallow` would leave it guessing instead.
  `tests/site-meta.test.mjs` pins each of those, since nothing renders when one slips.
- **The switch is pairwise.** Both languages carry a `.lang-switch` in the banner — one link
  and one `<span class="is-current" aria-current="true">` for the language already showing — and
  the link names **the same page** in the other language, not the home page. The one exception
  is the RODO notice, which has no Ukrainian twin and so points at the hub. No JavaScript, no
  `Accept-Language` redirect: the visitor chooses, and the choice is a plain link.
  Desktop places it last in the banner, after **3D-сцена**; at the phone breakpoint the header
  actions become `display: contents` so it takes the banner's first row on its own, top-right —
  first thing on the page rather than buried under the full-width stage button.
- **Analytics keeps them separate:** `pl-home`, `pl-vocal`, `pl-guitar`, `pl-piano`, `pl-drums`,
  `pl-privacy` (§11 Analytics). Whether Polish earns bookings is the whole question about it.
- **The 3D stage stays Ukrainian.** Both languages link to `/stage/` as it is.

#### RODO notice

`/pl/polityka-prywatnosci/`, linked from every Polish page's footer. It names Art Vibe Studio,
Łódź as administrator with the Instagram / Messenger DM as the contact route — the same channel
the studio books through, and the only contact the site has — and covers, honestly, everything
the pages actually do: cookieless GoatCounter statistics, the Open-Meteo request the visitor's
own browser makes, Meta as a separate administrator once a booking button is clicked, the
stage's `localStorage` and its public signs, the visitor's rights and the PUODO complaint route.

**It is not a cookie banner and must not become one.** The site sets no cookies at all
(§11 Analytics), which is why no consent is required — the notice says so in its first
paragraph. Swapping in a cookie-based tool would change that and would change what this page
owes its visitors.

**Audio buses:** `drums` | `piano` | `guitar` | `mic` → master. Every mixer fader displays **0–100%**, starts at **50%**, and reaches a gain of 2.0 at 100% — so 100% is _boosted_, not unity. **All four instruments must sound equally loud with every fader at its default**, which the raw synths do not: the engine applies a measured per-bus loudness trim (`AudioEngine.BUS_TRIM`) under the fader, so a fader position means the same thing on every bus. Balance is verified as K-weighted loudness (BS.1770) of a realistic phrase per instrument, measured through the full chain including the master compressor: the four phrases must land within **~2 dB** of each other and the whole band playing at once must peak **below 0 dBFS**. Retuning a synth's own level means re-measuring and changing its trim, not its default.

### Audio activation and external media

The default experience is **play along with the visitor's music**. Entering and exploring the stage must not pause Spotify, Apple Music, or another external source. Mobile / in-app browsers can also leave an activated `AudioContext` **suspended** (silent until refresh), so the engine must:

- Keep audio completely dormant on **ВИЙТИ НА СЦЕНУ**, reload / same-tab entry, walking, camera gestures, instrument focus, chord selection, settings open, and fader changes. These visual / configuration actions must not create or resume an `AudioContext`.
- Immediately before the first real site sound, request the mobile Audio Session `ambient` route where the browser exposes that API, then create / resume the context inside the same trusted gesture. `ambient` is the play-along mode: supporting platforms mix the instruments with external media instead of claiming exclusive playback.
- Activate on every real sound path: drum hit, piano note, guitar pluck / strum, vocal, loop playback, and **ТЕСТ ЗВУКУ**. A loop-record action may reuse an already-activated context because loop unlock requires earlier instrument play.
- Prime with a tiny silent buffer inside the user-gesture turn.
- Retry `resume()` shortly after wake; recreate context if `closed` or still blocked on the next trusted gesture.
- Do not use page-wide pointer / touch / click / key listeners to claim audio. The instrument handler that will actually synthesize sound owns activation and recovery.
- Mark the audio route for a guarded context rebuild after backgrounding, page restore, window blur, or an interrupted mobile Audio Session—even if the old context incorrectly still reports `running`.
- Treat Audio Session `inactive` as normal silence between notes; only `interrupted` independently marks a broken route.
- Detect a `running` context whose `currentTime` clock has stopped, and rebuild it on the next trusted gesture.
- Preserve loop phase / active vocal state across a context rebuild, and expose a mixer **ТЕСТ ЗВУКУ** action that force-rebuilds when physical output cannot be inferred. It plays a short C5–E5–G5–C6 melody directly through the master bus (bypassing instrument faders) and tells visitors to disable device silent mode and try again if they cannot hear it.
- If `navigator.audioSession` or `ambient` is unsupported, fall back to normal Web Audio behavior without error. The browser / OS may pause or duck external media when the first site sound plays, but the site must never interrupt it before that sound intent.

Do not autoplay a built-in soundtrack. A future game-like background track must be an explicit, persisted, default-off setting on its own mixer bus and must use the same `ambient` session.

Mute chosen before the context exists is honored when `init` runs.

---

## 4. Scene

### Stage

- Wooden platform, gold front trim, footlights (emissive + point lights). Downward volumetric spotlight shells meet the platform top and fade at its finite X/Z footprint; no beam geometry hangs over the surrounding void. The larger under-stage venue plane is intentionally unlit so non-shadow-casting mobile spotlights cannot create false beam spill below the platform.
- Back wall, curtains, valance, speaker stacks.
- Mascot walking uses convex X/Z footprints derived from the visible meshes of instruments and speaker stacks, expanded by the mascot's rounded clearance. Rotated and irregular objects keep silhouette-following borders instead of oversized axis-aligned boxes. Keyboard / stick movement slides along angled edges; click routes use expanded footprint corners; instrument approaches stop at the nearest clear silhouette edge before focus, and exiting a seated focus pose returns the mascot to clear floor.
- Backdrop **slideshow** (shader crossfade + Ken Burns) with gold frame and brand plate. On the **reverse** of that wall, a maker's mark reading **made by @vadymbek** — the screen stack and the backdrop are all front-facing, so it is invisible from the audience side and only found by orbiting behind the stage.
- Procedural dust; gentle idle motion on curtains / instruments (respects `prefers-reduced-motion`).
- Start camera is pulled in by three “+” zoom steps (`START_ZOOM_FACTOR = 0.82³`). The game-style mascot-follow camera and temporary scout-on-drag behavior run on both mobile and desktop; focused instrument views retain their own cameras. Extra zoom-in headroom vs older builds.
- After Enter: `html.stage-live` — fixed layout, `touch-action` guards, `visualViewport` scale reset to fight Chrome iOS letterboxing from stuck page zoom.

### Signs («знаки на сцені»)

Visitors can leave one short glowing sign per day and see everyone else's. The feature is
**absent unless its storage answers**: one boot-time probe gates the button, the modal and
both sign surfaces together; on any failure — and in `testhooks` / `headless` / `shot` QA
runs, which must not read or write the live stage — the stage looks exactly as it does
without the feature. No retry, no error surface.

- **Three surfaces, filled in order — 67 slots.** The back-wall band takes the first
  **12** (a 4×3 grid: it is the surface furthest from the camera, so its tags were always
  the smallest — fewer and larger carry better) (X ±4.05, Y 0.35–2.30 at z −5.78, clear of the brand plate above, the upstage
  curtain legs beside, the star drop and the platform). Only once it is full do signs
  reach the **front strip** the visitor stands on (**25** — X ±4.7, Z 0.55–3.25, with the
  guitar stand and mic rising out of it), and last the **mid-stage band** (**30** — X ±5.1,
  Z −3.5…0.55): the widest bare patch of the platform, and the boards the drum kit and
  piano stand on. Signs run underneath them on purpose — a kit parked over old graffiti is
  how a real stage looks. All three are transparent `CanvasTexture` planes, emissive-driven
  and registered dimmable so the **Світло** fader dims the tags with the stage; each stays
  invisible while it has nothing to show. **Only the wall band glows**: it reads as a lit
  sign hanging in the dark, while the two floor surfaces are paint on boards — a halo there
  looked like light spilling out of the stage. The floor keeps just enough emissive to stay
  legible outside the spotlight pools, and a fresh sign still gets a brief glow as it fades
  in, so it announces itself. The mid band is wider than the front strip
  because it sits further from the camera, where the frame opens out — measured through the
  settled follow camera, it spills the frame far less than the front strip already does.
- **A sign's position is part of the sign.** At creation the client picks the first free
  slot — wall (`0–11`), then front strip (`12–36`), then mid band (`37–66`) — and stores it
  in the sign's row, so a sign stays where it was put for as long as it lives. Within its
  slot, each surface's fixed shuffle plus id-seeded jitter, rotation, size variance and an
  occasional underline flourish keep the fill organic (stable, since id and slot never
  change).
- **The stage is first-come-first-served, and the first signature outlives everything.**
  Slots are never recycled: at capacity the write is refused rather than displacing anyone
  (§ Signs storage). Every read path follows from that. Signs are ordered **by id, not by
  the order rows sit in the stored head**, so a hand-edited or out-of-order message renders
  identically; and where a head somehow carries more rows than the stage has slots, it is
  the **newest** that do not fit — the head keeps the earliest, and the write path seals
  the newest end into the archive. Taking the other end would drop sign `0` off the stage.
- **A stored slot belongs to the sign that stored it.** Placement runs in two passes: rows
  with a valid, unclaimed slot take it first (earliest id wins a collision), and only then
  do rows without a usable slot (legacy or hand-tampered state) fall back to a derived
  `(id − 1) % 67` home with a deterministic probe — filling what is left free, never
  displacing an honest row. One pass let a row whose slot no longer existed probe its way
  onto slot `0` and stand where the first signature belongs. Every visitor still computes
  the same stage.
- **Signing is earned, not offered.** The button stays hidden until the visitor fills the
  VIBE meter for the first time — the same moment that opens the loop pedal (§9 Praise), so
  the stage has exactly one unlock beat rather than two. Playing comes first; the stage is
  signed by someone who played it.
- **The stage fills once.** Slots are never recycled: when the last one goes, the stage is
  closed and the marker button is gone. A visitor who cannot sign is never shown a control
  that refuses them — the button is present only once the meter has been filled, the
  storage answered, the visitor has not signed in the last day, and a slot is free.
  (A sign draining out of the head on the character budget frees its slot again, which is
  the one way the stage reopens.) The meter can fill before or after the storage probe
  resolves, so availability is recomputed rather than revealed once — either order has to
  end with the right thing on screen.
- **Cost.** Three extra draw calls, and three canvas textures — ~16 MB of VRAM once
  mipmapped at full size, **quartered on the low budget** (`usesLowMobileSceneBudget()`
  halves each dimension), since the tier scales pixel ratio, shadows and AA but would
  otherwise leave these untouched. A redraw is ~1 ms of 2D canvas work; the real cost is
  that marking a texture `needsUpdate` re-uploads it, so a repaint is scoped to the one
  surface that changed — leaving a sign uploads ~3.6 MB, not 16 — and the fade-in, which
  repaints on every third frame, is skipped entirely under reduced motion and on the low
  budget.
- **Leaving a sign:** a marker button in the **HUD's right nav** (`#sign-btn`, after
  **Твій образ**, hidden until the meter has been filled and the probe passes) opens
  `#modal-sign`:
  one text input (≤ 24 code points; whitespace collapsed, zalgo stacks squeezed), five
  curated color swatches (крейда / золото / пурпур / рожевий / м'ята), a
  live glowing preview, **ЗАЛИШИТИ НА СЦЕНІ**. The panel carries no explanatory lead — the
  title, the field and the preview say what it is. Success closes the modal, fades the sign in
  (~0.9 s; instant under reduced motion) and shows a toast; failures surface as friendly
  inline one-liners and never block the stage.
- **Once a day, on the device only.** `localStorage` `av2.sign.v1` (`{ text, color, ts }`)
  prefills the form and arms a rolling 24-hour gate; while gated the button carries
  no state at all — it is simply absent until tomorrow. No IPs, no identifiers,
  nothing personal is stored anywhere, and the site stays cookie-less — no consent banner
  required.
- Copy speaks of the **сцена**, never «стіна»: «Залиш свій слід», «Твій знак на сцені»,
  «Сцена зараз недоступна».

### Instruments (procedural meshes)

| Kind          | Pointer / touch play                                                                                                                                                                                                                                 | Desktop keyboard play                                                                                                                                                                                                                                                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mic` / vocal | The **voice ribbon** — one continuous field, pitch up, vowel across — plus the stand's three zones, **only while mic-focused** (§ Vocal performance mode)                                                                                            | `1`–`7` in a close-up are the key's seven degrees, sung, with `↓ ↑` gliding a step. `N M , . /` → ДО РЕ МІ ФА СОЛЬ are degrees 1–5 of the stage key and answer **with or without mic focus**, the same courtesy `Z X C V B` gets at the drums — inside the close-up they route through the ribbon, so one thing owns the voice (hold to sustain; see §5 Desktop keyboard jam) |
| `guitar`      | Two-hand chord + strum / pluck **only while guitar-focused**. Chords come from the shared circle-of-fifths wheel                                                                                                                                     | Chord row = the key's seven degrees — `1`–`7` in a close-up, `Q W E R T Y U` outside one — strum on `↓ ↑ / Space`. Live while idle or guitar-focused, silent inside another instrument's close-up; focused the chord row is select-only, see § Guitar performance mode                                                                                                        |
| `piano`       | Mesh keys **only while piano-focused** (multitouch). Hold sustains; release / cancel / exit / mute / background releases. Cabinet / lid / bench do not play. Plus the shared chord wheel, which sounds whole chords (§ The chord wheel at the piano) | `1–8` whites while idle. **Piano-focused:** `A–L` + upper row, real-keyboard shape, and `1–6` become a chord row that **sounds piano chords** (§ Piano-focused keyboard layout)                                                                                                                                                                                               |
| `drums`       | Kit parts **only while drums-focused** (multitouch). A strike is louder at the centre of a head than at its rim, and the hi-hat pedal opens the cymbals. Plus the shared groove wheel (§ Drums performance mode)                                     | `1`–`7` in a close-up are the seven kit pieces low to high, `Space` the hi-hat pedal; `Z X C V B` five of them with or without drums focus                                                                                                                                                                                                                                    |

The upright piano is drawn at **0.92 scale**: it stands in the middle of the mid-stage
sign band and its full-height cabinet hid the boards behind it. Uniform, not squashed on Y,
so the keybed keeps its proportions — focus framing and the seated pose both derive from
measured piano-local bounds, so they follow it.

Seated focus poses (drums throne, piano bench) place the pelvis by subtracting the scaled hip height from the seat top, so the mascot rests on the seat at every saved height / build value instead of floating above it or sinking through it.

Hover (fine pointer): emissive glow.
Distant tap / swipe on an instrument: **walk + camera approach only** — no preview sound. Pointer sound still starts after focus.
Desktop keyboard sound does **not** require instrument focus (see §5).

### Piano performance mode

**Current milestone:** the piano focus is a **player's-eye view** — the same over-the-shoulder language as the drums — plus reliable held-note sustain for direct key play. Focus / `Enter` / **ГРАТИ** still never starts a melody.

#### Focus framing — current

- The camera sits **behind and above the seated mascot** (steep ~72° pitch, slight side offset) so the two-octave keybed reads as a near-horizontal GarageBand-like strip across the screen, with the mascot's head, shoulders, and both hands visible below it — the pianist's own view.
- Keys plus hand anchors are the fitted subject; the mascot deliberately crops at the frame bottom (same as drums). The head must never cover the keybed: a bigger mascot sits farther from the keys (bench standoff scales with mascot size, clamped to the bench depth).
- Keep the piano cabinet clean in focus: no music book, sheet pages, note lines, or music-rest board.
- Frame the complete two-octave keybed plus both hands inside a measured safe rectangle. Derive that rectangle from `visualViewport`, safe-area insets, and the actual bounds of the HUD, loop pedal, and ✕ exit control.
- Fit the keybed to roughly `81%` of the safe width on desktop / landscape and `88%` on phone portrait, then open **two zoom steps inside that fit** so the keys fill the screen. The outer key or two therefore crop at the frame edges; pinch / wheel must always reach past the uncropped fit so the complete two-octave keybed is recoverable.
- Use piano-local bounds and anchors, transformed to world space, instead of viewport-specific world offsets. A base camera preset establishes the eye direction; safe-rectangle fitting owns the final distance and target offset. On portrait the subject sits slightly below the safe-rect center (`centerBiasY`) so the play surface lands near the thumbs instead of floating over bare floor.
- The camera transition endpoint is the authoritative focused frame. Derive focused azimuth / polar limits from that endpoint before re-enabling OrbitControls so the first controls update cannot snap or reframe it (the polar floor sits below the fitted steep pitch).
- Keep the focused distance envelope that preserves key readability, while leaving horizontal orbit and pinch / wheel zoom available. The envelope allows roughly three further steps in and enough range out to clear the opening crop. Zoom must not move the keyboard behind fixed UI.
- Refit on focus, resize, orientation change, and `visualViewport` change. During an active entry transition, update its destination rather than teleporting the camera. Once focused, refit in one short eased correction; use an immediate correction under `prefers-reduced-motion`.

#### Mascot performance pose — current

- Build the pose in piano-local space so it remains correct when the piano moves / rotates and across all saved mascot height and build values.
- Center the pelvis over the bench, keep the seat contact believable, and place both feet on or just above the stage floor in front of the bench. Legs must not pass through the bench, piano base, or pedal assembly.
- Use a small forward torso lean and a gentle downward head angle so the mascot reads as watching the keys. Keep the shoulders relaxed rather than lifted toward the ears.
- Keep the head centered over the torso and slightly toward the keybed. Include the posed head and visible hair bounds in the measured focus subject so rear-perspective magnification or viewport clipping cannot make the head appear detached or oversized.
- Place the left hand above the lower half of the keybed and the right hand above the upper half, each roughly one key-height above the key tops. Keep wrists inside the keyboard width and elbows slightly open so the arms do not cross through the torso.
- Both hands and enough of each forearm must remain visible in the focused safe rectangle. The arms may overlap the cabinet, but must not cover a large continuous section of playable keys.
- Solve arm orientation toward piano-local hand anchors and clamp the result to comfortable ranges. Avoid one fixed pair of arm Euler angles that only works for the default mascot proportions.
- Blend from the walk / idle pose into the seated ready pose during the existing camera transition. There must be no one-frame position, scale, limb, or yaw pop when entering focus.
- Hold a calm ready pose while focused. This milestone does not add note-following hands; only a subtle breathing / wrist settle is allowed, and it is disabled under `prefers-reduced-motion`.
- On ✕ exit, restore the neutral mascot pose before returning control and project the mascot to clear walkable floor as today. Repeated focus / exit cycles must not accumulate transform drift.

#### Piano-focused keyboard layout — current

While piano is focused (`canPlayInstrument('piano')`), the computer keyboard switches from the global `1–8` jam digits to a **real-piano-shaped** layout spanning C4–D5 (an octave plus a whole step — the classic GarageBand "Musical Typing" span):

- **White keys**, left to right: `A S D F G H J K L` → `C4 D4 E4 F4 G4 A4 B4 C5 D5`.
- **Black keys** sit on the row above, physically between the two white keys they fall between — gaps included, so nothing sits above the `D/F` or `J/K` pairs (matching the missing sharp between E-F and B-C on a real keyboard): `W E _ T Y U _ O` → `C#4 D#4 (gap) F#4 G#4 A#4 (gap) C#5`.
- This layout **takes priority over the letter chord row**, and takes it whole. It shares four letters with it (`W E T Y`), and a row that answers on two keys in seven is worse than one that stands down: for as long as piano focus holds, **`Q W E R T Y U` play no chords at all** — `W E T Y U` strike piano notes and `Q` / `R` do nothing. Leaving focus restores the letter row immediately.
- **The chord row is `1–7`** here as in every close-up, addressing the seven degrees of the key, and it **plays piano chords** — the same voicing, roll, key dip and loop capture a wheel wedge produces, held for as long as the key is. That is what makes the close-up a two-handed instrument: chords under the left hand, melody under the right. It shadows the global white-key digits, which are redundant here because `A–L` already covers a wider span of the same keybed; `7` and `8` keep striking their white keys.
- `[` / `]` step the wheel's key and `\` toggles sevenths, in piano focus as everywhere else.
- Held notes, sustain, and release follow the same rules as pointer/pad play (§ above); `keyup` / focus-exit teardown is shared with the `1–8` path.

#### The chord wheel at the piano

The same circle of fifths that serves the guitar (§ The chord wheel) appears in the piano close-up, but a wedge means something different here — and the difference follows from the instrument, not from taste.

- **On guitar a wedge only chooses; on piano it plays.** The guitar has a second surface — the neck — to make the sound, so arming stays silent. The piano has none, so the wedge itself must sound, and pressing one starts the chord on press and stops it on release.
- **It is therefore momentary, and never latches.** Latching is coherent on guitar precisely because it is silent arming; a latched piano chord would sustain indefinitely.
- **The voiced keys physically depress** on the 3D keybed — the same press dip a played key gets, not a highlight. A chord is one gesture that moves four keys, which is the connection between the wheel and the instrument that a highlight-only version could not make.
- **Voicing:** the root is placed in the lowest octave of the keybed and the chord stacked above it; a triad doubles its root an octave up so a chord is always four keys under the hand, while a seventh is already four notes. The keybed is C4–C6 — MIDI 60–84, exactly 25 semitones for its 25 keys — so every voicing is inside it by construction rather than by luck, and this is checkable in Node.
- The notes are struck as a short **roll** rather than a block, a few milliseconds apart, low to high. Each opens its own loop capture at its own onset, so a recorded chord replays with the roll it was played with.
- One chord is worth **one note's** vibe, not four: it is a single gesture.

#### Piano interaction roadmap

These items are planned, but they are not blockers for the current framing / pose milestone:

1. **Reliable key surface:** piano-local hit plane, dead-gap removal, black-key priority, captured pointers, held key state, ordered glissando, and robust multi-finger chords.
2. **Gesture ownership:** a pointer on keys, drums, guitar strings / frets, or the chord wheel claims that finger so OrbitControls cannot rotate or zoom from it; empty canvas still orbits / pinches. Loop-pedal + key multitouch stays supported.
3. **Performance feedback:** one piano-note event driving audio, key travel, glow, note-following hands, VIBE, haptics, and loop capture; at least `16` voices and click-free same-pitch replacement. First play queues a once-per-instrument price chip shown after leaving focus.
4. **Discoverability and access:** an accessible DOM `#piano-pad` strip for `C4–C5`. Desktop `#keys-hint` advertises the `1–8` jam digits, since those work without focus and the real-shape layout does not. (A first-focus how-to hint was built and removed; `notes/Decisions.md` has the reasoning.)
5. **Expressive controls still open:** sustain pedal, MIDI input, velocity-sensitive touch / pen input, and selectable octave (the two-octave keybed itself now has a focused computer-keyboard mapping — see above — though it covers C4–D5, not the full two octaves).
6. **Learning layer:** optional guided phrases, hand-separated exercises, metronome, and note-name overlays. These may read `piano-notes.json`, but focus itself remains silent.

### Guitar performance mode

The primary mental model is **two hands**: the fretting hand chooses the sound; the picking hand creates it. Chord / fret input alone stays silent.

- **Pointer / pad / mesh guitar input** is accepted only during stable guitar focus — never while idle, approaching, entering, returning, or focused on another instrument.
- **Desktop keyboard** chord + strum keys follow the jam map (§5): they sound while idle and during approach / enter / return camera moves, and while the **guitar** is focused. A close-up of another instrument silences them, as it silences every map that is not its own. They also stay silent when the stage has not started, a modal is open, or the event target is editable / a control.
- **The chord row addresses scale _degrees_, and inside a close-up it is the number row.** `1`–`7` are the seven degrees of the current key, so `1` is the tonic in either mode and `7` the diminished one. A number _is_ a degree, which no letter can claim: chord names collide once the library is generated (`C`, `Cm`, `C7`, `Cm7` and `Cmaj7` all start with `C`), and a degree stays stable while the chords under it change. Away from a close-up the digits are already the piano's white keys, so the row falls back to the letters `Q W E R T Y U` there.
- **Focused, those keys are select-only.** While guitar is focused, pressing a chord key arms the chord **silently** — exactly like holding its wedge on the wheel — and Space (Shift+Space upstroke) strums it; releasing returns to open strings. That is the two-hand model above, applied to the keyboard. **Unfocused**, the same key still selects _and_ strums immediately, because there is no visible wheel to read and a silent arm would look broken.

#### The chord wheel

`#chord-wheel` is a **circle of fifths**, and it is the stage's only chord surface — shared by the guitar and the piano. Twelve major wedges on the outer ring, their relative minors directly inside, rendered as one SVG whose 24 wedges are generated rather than authored.

- **Major or minor.** The key readout in the hub is also the mode control: tapping it swaps a key for its relative minor and back, `C` becoming `Am`. Because relative keys are the same seven notes, the lit sector does not move and the sevenths do not change — only **home** does, from an outer wedge to the inner one beneath it, marked with a gold outline. Degrees relabel `I ii iii IV V vi vii°` → `i ii° III iv v VI VII`, and the chord row re-counts from the new tonic.
- **The wheel turns so the current key's tonic sits at 12 o'clock.** Its six chords are then not six arbitrary buttons but **one contiguous three-wide block across both rings** — `IV I V` on the outer ring with `ii vi iii` directly beneath them. That block is the whole reason the layout is worth its size: which chords belong together is visible before it is nameable. The other eighteen wedges dim but stay playable; dimming says _not from here_, not _not allowed_.
- **Chords are generated, not listed:** 12 roots × 7 qualities (major, `m`, `7`, `m7`, `maj7`, `dim`, `m7b5`) = **84 chords**. The two diminished qualities exist for one reason: the seventh degree of a major key and the second of a minor one are diminished, and a row that counts scale degrees has to reach them even though neither has a wedge. A quality is defined by its intervals above the root, and the fret shape comes from sliding one of two open forms (root on the low E string, or on the A string) up the neck — which is what a movable barre chord already is. The lower of the two positions wins, so nothing reaches past fret 8.
- Every generated voicing must sound **exactly** its chord tones — no extra notes, none missing. This is checkable in Node against the intervals and the open-string pitches, and should be, since a wrong shape is silent-but-wrong. The same applies to the wheel itself: a wrong rotation, relative minor or seventh still plays _a_ chord, just not the one the lit sector promises.
- A table of **preferred open voicings** overrides the generated shape for the chords a beginner reaches for (`E Em Em7 A Am Am7 C Cmaj7 D Dm D7 G G7 F B7`). Purely a tone choice: the generated form is correct too, just thinner and higher up.
- **Display spelling and identity are separate.** The circle prints flats where a printed chart does (`Gb Db Ab Eb Bb`, and `Ebm Bbm` inside), while the chord's internal name stays sharp-spelled so the library lookup is unchanged.
- **The key is a stepper, not a drag.** `‹ ›` in the hub move it one fifth at a time — the step the layout is _made of_ — and `[` / `]` do the same from the keyboard. Dragging the ring is deliberately not a gesture: on guitar, holding a wedge already **is** the play gesture, and a finger drifting during a hold would spin the key out from under the chord.
- **One `7` toggle** in the hub, also `\` on the keyboard, adds the **diatonic** seventh: `maj7` on I and IV, dominant `7` on V, `m7` on ii / iii / vi. Outside the key a major wedge takes a plain `7` and a minor `m7`, which is what a borrowed chord is reached for.
- The key, its mode and the seventh toggle persist together in `localStorage` `av2.chord-key.v1`, defaulting to C major with sevenths off. The key is the **stage's**, not the wheel's — the voice ribbon reads and sets the same value, so a vocal line over a chord loop is in tune.
- Changing either clears any held / latched / key-armed chord, so what is lit, what is armed and what would sound never disagree — and rewrites the QWERTY row in place, so every module reads the same object.
- Global instrument shortcuts ignore key events originating from buttons, links, form fields, or editable content; the focused control handles those events itself.
- **Mobile focus opens one further zoom step** than the shared two, because a phone carries the strings much smaller than a desktop does and the wheel now takes a corner of the screen. Cropping the outer edges is the same trade the zoom control makes, and pinch still reaches the full fitted frame.
- Focus is a **player's view**: during the entry transition the guitar lerps off its stand into the mascot's hands — held against the chest, low E nearest the viewer, face tipped up toward a steep overhead camera (the stand fades out; on exit both lerp back). A measured fitter frames the strings band from nut to below the bridge, reserves the chord wheel's corner, opens **two `+` zoom steps inside the fit**, and refits on resize / orientation change.
- **The camera azimuth follows the viewport**, because a guitar is long and thin and a diagonal one wastes the frame: each orientation lays the instrument along the screen's long axis. Landscape / desktop is the guitarist's own **first-person view** — looking down from behind the head, neck to the screen left, low E nearest the viewer — so strings read horizontally (strum = vertical swipe). Phone portrait stands the guitar up — body low and to the right, neck rising, mascot head at the left edge — so strings read vertically (strum = horizontal swipe). Strum detection works in guitar-local space, so it is unaffected by which framing is active.
- The held pose adapts to mascot customization: the whole hold rides the mascot's chest — height with the height scale, and the forward/side offset with the build scale, so a broad build carries the guitar forward with it instead of leaning its face through the soundboard — while a bigger body also steps farther back.
- **The mascot can never block or clutter the strings.** Tall or wide builds physically overhang the play band, and a headless body seen from inside reads as floating debris — so in the landscape first-person view, whenever the camera→strings sight line passes through the head's hair shell, the whole mascot is hidden and only the held guitar remains (you are looking out of that body). Hysteresis keeps the boundary from flickering; orbiting away from the sight line, portrait, and every non-guitar phase bring the body straight back.
- In portrait (and while the body is visible) the mascot and guitar must read as one performance pose: fretting hand along the neck, strum hand over the soundhole. String motion and strum-arm motion carry the action; whole-body guitar wobble stays subtle.
- Use separate guitar-local raycast proxies for approach, strum, and fret selection (all pose-invariant: they ride the guitar body). A pointer captured by a play zone or by the chord wheel cannot orbit / zoom the camera until it ends.
- Start from a composed focused frame, then leave horizontal orbit available from empty canvas within the fitted distance / pitch envelope (pinch / wheel zoom included).

#### Strum and pluck

- An enlarged invisible strum plane surrounds the soundhole (at least `120 × 160` CSS px on a supported phone). A stroke may start just outside the string fan.
- Only motion mainly **across** the strings counts. Motion along the strings, a body tap, headstock tap, or slow orbit gesture stays silent.
- A stroke excites every crossed, non-muted string exactly once, at its interpolated crossing time. Bass → treble and treble → bass preserve opposite string order.
- Reversal starts a new stroke only after direction hysteresis; moving outside the play zone cannot keep retriggering.
- Gesture speed — not accumulated distance alone — controls level, attack brightness, decay, and inter-string spread. A soft stroke and hard stroke must be clearly different without clipping.
- A fine-pointer tap on one explicit string plucks that string using the active chord / fret state. It does not fall back to a whole-chord strum; touch string picking belongs to the assisted Solo mode.

#### Chords and fretting

- The wheel docks **bottom-left** in both orientations (fretting-hand side, strum zone free to the right — the same split as a real guitar), low enough to almost touch the ✕ exit. It cannot be the vertical rail the six-button pad was, so a corner takes that role. The guitar fitter reserves the footprint, and does so from layout constants rather than a DOM measurement, because the wheel only appears after the entry fit has run.
- **Touch:** tap a wedge to latch it for one-finger playing, or hold it with one pointer and strum with another. A quick tap on the string fan plucks the nearest string. Releasing a genuinely held chord returns to the previously latched chord (or open strings); cancel, exit, background, or lost capture clears transient holds.
- **Fine pointer / pen:** clicking a wedge latches it so the same pointer can strum repeatedly; clicking it again clears it.
- **Desktop keyboard (jam map):** hold `1`–`7` in a close-up, or `Q W E R T Y U` away from one, for the current key's seven degrees. **Unfocused**, pressing a chord key also strums it immediately, because with no visible wheel to read a silent arm looks broken; **focused**, it is select-only and the strum keys play it. **The strum keys are `↓` (downstroke) and `↑` (upstroke)** — adjacent, so an alternating pattern is two fingers rather than a held modifier — with `Space` a downstroke and `Shift+Space` an upstroke, both kept from before. Key release returns to open strings. Mascot movement is not bound to keyboard keys; it uses click-to-move or the mobile joystick.
- Wedges are `role="button"` with visible focus, `aria-pressed`, and `aria-keyshortcuts` on the six that the jam row addresses; their `aria-label` names the chord **and its degree**. Colour is never the only signal.
- Use one fretboard plane and derive the nearest string from its local hit point; while a chord is selected, its shape owns the fretting so every fretboard hit uses that string’s chord pitch and mute state. With no chord selected, a fretboard hit uses its local fret.

#### Guitar sound and feedback

- One six-string event drives audio, visuals, haptics, and loop playback. It preserves string indices, frets / mutes, direction, gesture velocity, and per-string onset offsets.
- Each audible string vibrates at its own scheduled onset and amplitude; muted strings neither sound nor animate. Visual and audible onsets stay aligned.
- Replucking a physical string releases its previous voice over `10–30 ms` instead of stacking unlimited tails. All-string mute and focus exit use click-free ramps.
- Vary excitation, damping, brightness, and stereo position by string and stroke. Add shared acoustic-body resonance; do not replay one byte-identical buffer for every occurrence of a pitch.
- Progressively pre-warm common guitar pitches during the approach / camera transition without stalling the animation. No synthesis-table generation runs inside the pointer stroke handler.
- Optional haptic feedback fires once per completed stroke. It scales gently with velocity and never fires per string.
- Guitar price chips follow normal instrument behavior: queued on first play, shown after leaving focus.

#### Later guitar enhancements

- Explicit **АКОРДИ / СОЛО** modes.
- True held fretting with separate plucks, slides, bends, hammer-ons, pull-offs, palm mute, and damping.
- Left-handed layout, capo / alternate tuning, pick versus fingerstyle, metronome, backing groove, and guided chord progressions.
- Higher-fidelity procedural body modelling or one compact body-resonance impulse where the download budget permits.

### Drums performance mode

The kit is what the visitor hits; the wheel is the bar it is hit inside. Focus / `Enter` / **ГРАТИ** still never starts a groove: reaching the kit opens a **stopped** wheel, and only a deliberate tap on a wedge makes a sound.

#### Focus framing — current

- Drums keeps the **raw camera preset**: `instrumentViewFrame()` returns a measured fit for the piano and guitar only, so `playSurfaceReservedRects()` is never consulted here and there is nothing for the groove wheel to reserve into. This is a deliberate scope line, not an oversight — the drums close-up is the over-the-shoulder framing the piano's was copied _from_, and it works.
- The consequence is that the wheel's footprint is **verified rather than derived**. It docks bottom-left at a cap of its own (`220px`, against the chord wheel's `300px`), because the kit is centred and runs to the bottom of a portrait frame where the guitar stands to the right and the keybed is a mid-screen strip. If it ever collides, the fix is a nudge to the drums camera preset or that cap — not a new fitter.

#### The kit

- Seven playable pieces — kick, snare, two rack toms, floor tom, hi-hat and crash — plus a hi-hat **pedal** that is its own target. The throne is scenery.
- **A strike carries a dynamic.** Where a pointer lands on a head decides how hard it sounds: full at the centre, falling towards the rim, and never silent there. That is the one dynamic a tap can genuinely express, so it is the one modelled — cymbals and the pedal have no such gradient, because edge-versus-bell is a different sound rather than a quieter one. Dragging across the kit is a roll, and there the stroke's speed counts as well. A key press carries no dynamic and stays at full rather than having one invented for it.
- **The pedal opens the hi-hat.** Lifting the foot parts the cymbals and the next strike washes; putting it down closes them with the "chick" a real pedal makes. Closing is worth no vibe — it is a foot, not a hit.
- **A hit squashes the drum, never its hardware.** Stands, tripods, spurs and pedals sit outside the part that recoils. At one hit per tap a pumping tripod is a curiosity; under a groove hitting the snare eight times a bar it is the only thing you can look at.
- Reduced motion removes the endless idle sway of the cymbals and steps the playhead beat to beat instead of sweeping it. The hit recoil and the crash swing stay: they are the response to a gesture, not shimmer.

#### Drums-focused keyboard layout — current

- **The number row is the kit**, as it is the chord row in every other close-up: `1`–`7` are kick, floor tom, tom 2, tom 1, snare, hi-hat, crash. Ordered by **pitch, low to high**, because that is the one order that survives every camera preset, because it matches the piano and guitar rows where a number is a musical index rather than a screen coordinate, and because `1` is the kick — the home of a bar the way the tonic is the home of a key.
- `Z X C V B` is unchanged **outside** a close-up, where it reaches five of the seven. That the floor tom and one rack tom are unreachable there is the point: the close-up is where you get the whole instrument.
- **`Space` held opens the hi-hat**, and releasing it closes. A pedal is a held foot control and Space is the pedal-shaped key. Held means _open_, which inverts a real kit — deliberately, because the default has to be the common sound and closed is the common sound. Space is the guitar's downstroke everywhere else and the two never overlap (§5 rule 3).
- `;` / `'` step the groove — audibly, since there is no silent selection to move around — and `` ` `` starts or stops it. Drums close-up only.
- A tempo change holds the bar's position, stopped or playing, so the beat does not jump under a groove that is only paused.

#### The groove wheel

`#groove-wheel` is the bar drawn as a circle, and it is to time what the circle of fifths is to pitch. Twelve grooves on the outer ring, the bar and its playhead on the ring inside, **12 o'clock is beat one** exactly as the tonic sits at 12 o'clock next door.

- **The wedges are grooves, not steps.** The visitor never fills a cell. A grid you fill is the six-slot chord pad again — a settings task wearing a play surface's clothes — and one tap here is one whole bar of music instead.
- **The library is twelve: four families of three**, and both axes are position. The family boundaries land on 12 / 3 / 6 / 9 o'clock, which are also the four beat marks on the ring inside, so the two circles share their heavy spokes. Clockwise inside a family is strictly busier, so a wedge's position predicts what it will sound like before it can be named — which is the same claim the chord wheel's contiguous block makes.
- **Half of every groove is generated.** The part that keeps time is a **Euclidean rhythm** `E(k, n)` — the maximally even set, produced by adding `n/k` steps mod `n` the way the circle of fifths adds 7 semitones mod 12. It is the same object on a different circle: `E(3,8)` is the tresillo, `E(5,16)` the bossa clave, `E(8,12)` the shuffle, and `E(7,12)` turned seven steps is the major scale itself. The backbone — where the kick and snare land — is authored, because that is the style and there is no formula for it. Both halves are checkable in Node, and should be, since a wrong groove is silent-but-wrong in the same way a wrong barre shape is.
- **The kit is the score.** Nothing here draws the pattern: a chosen groove strikes the real heads and cymbals whether it is audible or not, so the groove is readable before it is audible. Forty-eight cells on a 220px circle would not be.
- **The wedge is the transport.** Tapping one plays that groove — audible, animated, turning; tapping the one already playing stops it. There is no separate play control to find, and no third state: a groove is going or it is not. Choosing a different wedge while one plays switches without stopping.
- **The bar keeps running while the groove is stopped.** Stopping does not pause it and starting does not reset it: the transport only joins and leaves a bar that is going anyway, pinned to the audio clock once per visit. That is what makes the wheel usable for practising **fills** — drop the groove out, play a fill of whatever length, tap back in, and it lands in time even if the tap was sloppy, because the beat never moved. Walking away from the kit is a real break and does drop the bar, so the next visit starts on the downbeat again.
- **Stopped, the wheel shows nothing** — no lit wedge, no playhead, no beat marks picked out, and nothing on the kit moving. **A drum that recoils without a sound reads as broken**, so there is deliberately no silent-but-animating mode; every recoil on the kit arrives with the noise that caused it. A wheel that looked half-live would also invite a tap it would not answer the way you expect.
- **Nothing sounds until a wedge is tapped**, and until then no `AudioContext` exists. Which groove and which tempo were last chosen persist; **whether it was playing does not** — a remembered playing state would start drums at a returning stranger, which is what "focus never starts a melody" exists to prevent.
- **Tempo is a stepper, not a drag**, `60`–`160` in steps of `4`, and its readout is plain text rather than a button because — unlike the chord wheel's key readout, which doubles as the mode control — it has no second meaning.
- Wedges are `role="button"` with visible focus, `aria-pressed`, and an `aria-label` naming the groove **and its family**. Colour is never the only signal.
- **No two wedge labels overlap**, in any of the twelve keys, in either mode, with sevenths on or off. Label size is derived from the straight-line gap to the neighbouring label on the same ring — not from a character count, which cannot see that the inner ring's gap is 62% of the outer's while a seventh's name is the same length in both.
- The groove wheel, the chord wheel and the voice ribbon share their dock, their size tokens and their corner. **One dock, three surfaces, exactly one shown**: drums gets this one, guitar and piano the chord wheel, the mic the ribbon. `window.__ribbonDebug().docked` asserts it rather than trusting it.

#### The groove and the loop pedal

- **Recording a take over a groove records the groove.** Every scheduled hit is captured at its scheduled time, so a loop laid down over РОК contains РОК — and when the take closes the groove **stops on its own**, because the loop is playing it now and two of them is just doubling. A toast says so.
- **A groove still earns nothing.** Its hits carry no vibe whether or not a take is running, so a groove can never fill the VIBE meter or unlock the loop pedal by itself: a machine playing itself is not the visitor earning anything.
- Clearing the loop does not stop the groove, and stopping the groove does not touch the loop.
- **With a groove sounding, a loop take is whole bars.** The free-running pedal quantises to an eighth of a second, which is `16 ms` out per bar at 92 BPM — half a sixteenth inside two minutes, drifting silently until the snare you played on the backbeat is on the "and". Against a groove the take rounds to the nearest whole bar instead (never up: a finger that lifts early meant _this_ bar), and the loop's downbeat is snapped to the groove's, so bar one and 12 o'clock are the same instant.
- **Tempo is locked while a loop has content**, with a toast that says so. The loop's length is already whole bars of the old tempo, and moving it underneath would re-open exactly the drift the quantisation closes.
- With no groove sounding the pedal is unchanged in every respect.

#### Drums interaction roadmap

1. **Rescale instead of lock:** changing tempo against an existing loop rescales its duration, every event offset and every held note's duration, then re-snaps the epoch — replacing the lock above.
2. **A count-in** before the first loop bar, so a take can start on the downbeat rather than wherever the finger landed.
3. **The groove as a stage-wide backbone**, available under the guitar and piano close-ups too — both roadmaps already ask for a metronome and a backing groove.
4. **More of the kit's voice:** ride, rimshot, choke, flam, and a second hi-hat degree between open and closed.
5. **A measured `drumsFocusSafeRect()`** if the framing ever needs to reserve rather than cap.

### Vocal performance mode

**Current milestone:** the mic close-up docks the **voice ribbon** (`#voice-ribbon`) — one
continuous field where the finger's height is the pitch and its side-to-side is the vowel.
It replaces the five-button vocal pad, whose notes were hard-coded in `stage/index.html` and
fixed in C major.

The argument for a field is the instrument. Every other thing on this stage is quantised by
its own construction — frets, keys, drum heads — and the voice is the only one that is not:
it slides between notes and changes shape while it holds. A grid of buttons can express
neither, which is the same objection that retired the six chord slots.

#### The ribbon

- **Pitch is the vertical axis, high up, continuous over C4–G5.** An octave and a half, not
  the piano's two: past G5 a formant voice reads as a siren, because the harmonics a vowel is
  _made of_ climb above its own second formant and the filter has nothing left to shape.
- **The vowel is the horizontal axis** — А О Е І У as one continuous tongue movement, F2
  descending, so dragging across never doubles back through a vowel it already passed.
  Formant frequency interpolates in **log** space; linear spends almost all its travel in the
  top vowel.
- **Not a wheel, because pitch is not a circle.** A voice has a top and a bottom, and wrapping
  the axis would claim an octave equivalence that singing a line does not have.
- **The detent.** The pitch axis bends towards the notes of the **stage key** without ever
  quantising: flat where a singer means the note, steep between. It is monotonic (dragging up
  never lowers the pitch) and both an in-key note and the midpoint between two of them are
  fixed points, so no pitch becomes unreachable however hard it pulls. Strength is a _feel_
  number, set by ear and asserted only to stay inside the window it was tuned in.
- **Press starts a note where the finger lands** — never sliding in from a default, so the
  first touch is never wrong on its way somewhere right. Drag glides pitch and morphs vowel
  live; release stops. **One voice at a time**: a second finger is ignored, because a second
  throat is not a thing a singer has.
- **The key is shared with the chord wheel** (§ The chord wheel), so a vocal line over a chord
  loop you just recorded is in tune. The two surfaces are never visible together, so the
  ribbon carries its own `‹ key ›` readout — which doubles as the major/minor control exactly
  as the wheel's does. It docks in the **top-right corner** of the field, the highest note of
  the most closed vowel: the corner a sung line reaches for least.
- **The instrument is the notation.** The mic's head lifts with the pitch — its three tap
  zones already climb the stand in pitch order — and the **mascot's mouth opens with the
  vowel**, using the three carved mouths it already has. The mouth is an override and is
  restored to the gifted character's own smile the moment the note ends; nothing is persisted.
- **The line you sang stays on the field** for a moment after the finger leaves. It is the
  only notation the surface has.
- **Nothing sounds until the field is pressed**, and until then no `AudioContext` exists.
  Reaching the mic opens a silent field, exactly as reaching the kit opens a stopped wheel.
- The field is `role="application"` with a live `aria-label` naming the key. The **32px touch
  floor** that governs the two wheels' rings does not apply here and must not be read across:
  a ring is a set of discrete targets a fingertip can miss between, and a continuous field has
  nothing to miss — the detent, not the target size, is what makes a press land on a note.
- **A held note belongs to the key that started it.** The row is seven keys that can overlap,
  and the arrow glide moves the sounding degree away from the key that pressed it, so a release
  matches the originating `code` — never "something is held". Inside the close-up the jam row
  (`N M , . /`) routes through the ribbon as well, so exactly one thing owns the voice.
- **A drag binds to the window, not to the field.** Move, up, cancel and window `blur` are all
  window-level and filtered by pointer id, because the finger leaves a 236px square constantly:
  bound to the element, a wandering drag stops tracking and its release never arrives, and the
  note sustains to the engine's safety timer. `setPointerCapture` is attempted and allowed to
  fail, so it can never be the only mechanism. A finger past an edge **clamps** to it rather
  than doing nothing. A long press is the _instrument_ here, so `contextmenu` is suppressed
  over the ribbon and every child of the field refuses selection and the iOS callout —
  otherwise the browser turns a sustained note into a context menu and takes the gesture with
  it. → [[Gotchas]]
- The mic's three tap zones (base, pole, head) carry **scale degrees 1, 3 and 5** rather than
  fixed frequencies, and brighten the vowel as they climb. `js/instruments/` sits below
  `js/play/` and cannot know the key, so the degree is resolved one layer up.

#### The voice and the loop pedal

- **A sung line is a shape, not a pitch.** A vocal loop event carries an optional `glide` of
  `[secondsFromStart, midi, vowel]` breakpoints, sampled while held and decimated as it goes.
- **A steady note records no `glide` key at all**, so a held keyboard vowel and every take
  that predates the ribbon keep exactly the event shape they had.
- Playback ramps between breakpoints so the curve arrives where it was drawn rather than
  stepping. The conversion out of scale degrees happens in `js/play/`; the engine knows hertz.
- A take opened **mid-phrase** by the loop pedal starts its own clock at the note the voice is
  on right now, not the one the phrase began on.
- An audio-context rebuild restores the pitch and vowel the glide had **reached**, not the
  ones it started from (§3 Audio activation).

#### Vocal interaction roadmap

1. **A breath control** — the one expressive axis a finger has left, once pitch and vowel are
   spent. Pressure or contact size where the browser reports it.
2. **A choir**: stacking the key's diatonic third and fifth under the sung line, so one finger
   is three voices. It reads the same key the ribbon already does.
3. **Consonants** — the ribbon sings vowels only, and a phrase is not made of vowels.
4. **A metronome and the groove as a backing** — the same item the guitar, piano and drums
   roadmaps all carry.
5. **Real microphone input** (`getUserMedia` + pitch detection) is _not_ on this roadmap and
   is a separate decision: a permission prompt on a marketing page, and a fallback owed to
   everyone who declines. The ribbon does not block it later.

### Mascot

Low-poly avatar labeled «Ти» (matched skin hands on both arms; no jacket-panel “fake hand”). Starts **downstage, nudged stage-left toward the guitar, inside the key spotlight pool** (`MASCOT_START`, also the fall respawn point), held back off the footlight row so those point lights cannot blow the costume out; the guitar sits in easy reach with every other instrument behind the visitor. Walk with click-to-move on the floor or the mobile stick. Can fall off stage edge (short recovery). Instrument focus poses or seats the mascot and reframes the camera.

**The gift** (`#modal-gift`, opened by the first run only — there is no HUD control for it): the visitor **receives** a character rather than building one. A magic wardrobe stands in the spotlight, rattles and strains for a few seconds with light forcing its way out of the door seam, then its doors fling open and the character steps out. **There is no HUD control and no reroll button.** The gift runs on the first visit, and again **whenever the mascot falls off the stage** — walking off the lip costs you the character you had and hatches a new one. That is the only route to a different tier, and it has a price, which is what keeps the drawn tier worth something. On first run the gift is offered on every visit until a character has actually been saved.

**A visitor who has no character never sees one.** The wardrobe is placed on stage and the mascot hidden **before the first frame** — the intro fly-in renders for 2.6 s before onboarding runs, and showing the default mascot for that whole approach would give away that the character was never theirs.

**The reveal pose must be a legal orbit state, and one the follow camera holds.** The framing distance is clamped to `controls.minDistance`, and closing the card eases the rig off its safe-rect target offset and onto the default stage pose at the pursuit camera's resting offset — that target offset alone tips the camera past `controls.maxPolarAngle`, and the resting offset is what keeps the follow spring from re-staging the shot the moment it wakes. `controls.cursor` moves with that handover, so the `maxTargetRadius` scout clamp measures the new target against the hero rather than against wherever the cursor was left. Any of the three left unhandled shows up a frame after **ГОТОВО** — as a clamp, a lurch, or a second unexplained camera move. Nothing but the gift's own tween may write to the rig while it is running.

**The approach lands on the ceremony's own framing**, so the handover is invisible: `prepareGiftStage()` locks the viewing angle and resolves the exact camera pose the ceremony would frame the wardrobe with, and the fly-in tweens to _that_ instead of the default stage pose. There must be no change of angle when the ceremony takes the camera — the approach and the reveal are one continuous move. Two things break this and are guarded: **OrbitControls must not be enabled** for the frame between the approach landing and the gift opening (its own stale spherical state would snap the camera back), and **the instruments stay visible** throughout — hiding them, as the retired editor did, pops the whole band out of the scene on exactly that frame.

**Characters are not named individually.** Every one of them is a **Вайбер**; the tier is the only thing that tells them apart, read as a species epithet — «Знайомся, це Вайбер Звичайний.» Tier names are therefore sentence case, not the all-caps a standalone label would use. Nothing about a name is stored. The draw covers the same twelve appearance fields as before: four authored hairstyles (**Довге / Боб / Коротке / Мінімум** — side-swept fringe, blunt-fringe bob, clean crop, and bald with every hair piece hidden so the skin-toned scalp shows through; a shared fringe shell is restyled per hairstyle, and each style also places its side locks, which must fall beside and behind the jaw so long hair never reads as a beard), three smiles (**Легка / Широка / Стримана**), five hair colors (also recolor brows), three eye colors (dedicated iris material; glasses/badge ink stays shared), four skin tones (**Теплий / Світлий / Золотий / Чорний**, applied to face and both hands), four coherent varsity palettes (**Сцена / Фірмовий / Джинс / Ніч**), four-option primary and accent overrides, a shoe-color override (**З ПАЛІТРИ / Чорні / Білі / Червоні**), four accessories (**немає / сережки / окуляри з дужками / навушники**), and a height / build pair. Removed legacy values (`buzz`, `tied`, `sunset` palette, `chain`, `cap`, the `blush` field, skin tones 1/2/6, dropped colors) fall back per-field to defaults when loading an older save. The procedural parts are created once and toggled or recolored in place. Horizontal drag over the stage rotates the revealed character and is the sole orientation control.

Only the mascot's major masses cast shadows (torso, neck, face, hair, limbs, shoes). Trim, stripes, collar, eyes and pins are excluded: they add nothing to the shadow map and would roughly double the shadow-pass draw calls now that the mascot stands in the key light. The guitar and mic follow the same rule inside that pool.

The character is written to `localStorage` `av2.mascot.v4` **on the reveal frame**, not on a later confirm: there is no draft to back out of, so what is on disk always matches what is standing on stage. **✕ / Esc** before the burst abandons the ceremony and writes nothing — so the visitor still has no character, and the gift is offered again on their next visit. After the burst the character is already saved and **ЗРОЗУМІЛО** simply closes the card. A tap anywhere outside the card (or Enter / Space) skips ahead to the reveal, after a short grace period so the tap that opened the gift cannot also skip it. The measured unobscured canvas rectangle — not a fixed breakpoint offset — frames the wardrobe, and then the character, around the actual HUD and card bounds. On close the camera eases back out to the **default stage frame** (`CAM_END` / `TARGET`) — the ceremony framing is a close portrait measured to sit beside the card, and leaving the visitor inside it hides the stage they are about to walk. The first run therefore ends on exactly the frame every later visit begins on. That destination is **translated by the pursuit camera's resting offset** before the tween starts, so the close is a single camera move: the follow spring wakes on the frame after it lands and finds nothing to catch up to. Aiming at the bare stage pose instead costs a second, slower move the visitor is never shown the start of. Instruments and stage hints are temporarily hidden so they cannot obscure the ceremony. Background controls are inert, and backdrop taps never close the modal.

Opening the editor while an instrument is focused leaves that focus immediately (no return animation): the instrument settles into its resting pose (the guitar drops back onto its stand) and the camera snaps straight to its pre-focus stage frame before the editor's own preview camera takes over. That snap must land exactly on the saved frame — any orbit drag made just before opening the editor must not leave a residual offset — since the editor saves this exact position as the frame to restore on close.

**Dance** (click the HUD logo): toggles a **tektonik** routine — procedural 8-beat loop (overhead arm sweeps + bounce, full spin on the last two beats). Limbs relax smoothly on stop. Walk input, instrument approach, or a stage fall stops the dance.

---

## 5. Interaction map

### Desktop keyboard jam

On desktop (fine pointer / hover-capable, not the mobile game shell), the computer keyboard is a **multi-instrument jam surface**. After Enter, with no modal open and the event not from an editable / button target, every instrument map is live while idle, walking, approaching, entering or returning. Pointer and on-screen pads remain focus-gated as today.

**A close-up makes the keyboard exclusive.** While an instrument is focused, only that instrument's keys answer; every other instrument's keys fall silent for exactly as long as focus holds, and are restored on exit. Choosing to stand at one instrument is a statement about what you are playing, and a drum row still firing underneath a piano performance made the keyboard read as the stage's rather than the instrument's. The chord row is the one map two instruments share, because the wheel is shared: it answers under guitar **and** piano focus, and goes quiet under drums and mic like anything else that is not theirs.

**Always live, in every mode:** `Enter` (approach, while idle), `L` / `Shift+L` (loop), and `[` `]` `\\` (the chord wheel's key and sevenths). These are transport and tuning, not an instrument's voice. The groove wheel's `;` `'` `` ` `` deliberately do **not** join them: a key signature is a tuning that outlives a close-up, while a groove exists only where its surface does.

**Why this layout:** mascot movement stays pointer/touch based, leaving the desktop keyboard free for instruments and approach (`Enter`).

| Layer            | Keys                     | Behavior                                                                                                                                        |
| ---------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Walk             | Arrows + `W` `A` `S` `D` | Idle only; ignored while any instrument view phase ≠ `idle`. `W` forward, `S` back, `A` left, `D` right (same as arrows).                       |
| Approach         | `Enter`                  | Idle only → nearest instrument in reach (no auto melody)                                                                                        |
| Loop             | `L` / Shift+`L`          | Pedal toggle / clear (after unlock rules unchanged)                                                                                             |
| Piano            | `1`–`8`                  | White keys C4–C5; press-and-hold sustains; multi-key chords OK                                                                                  |
| Drums            | `Z` `X` `C` `V` `B`      | kick / snare / hihat / tom / crash                                                                                                              |
| Drums (close-up) | `1`–`7`                  | kick / floor / tom2 / tom1 / snare / hihat / crash — the whole kit, low to high                                                                 |
| Hi-hat pedal     | `Space`                  | Drums close-up only; held = open, release closes with a "chick"                                                                                 |
| Groove wheel     | `;` `'` `` ` ``          | Drums close-up only; previous / next groove (plays it), and start / stop                                                                        |
| Guitar chords    | `Q` `W` `E` `R` `T` `Y`  | Em / Am / C / D / G / F — press strums the chord immediately and holds it; release → open strings                                               |
| Guitar strum     | Space / Shift+Space      | Downstroke / upstroke using the active keyboard (or pad) chord                                                                                  |
| Vocal            | `N` `M` `,` `.` `/`      | ДО / РЕ / МІ / ФА / СОЛЬ — degrees 1–5 of the stage key; hold sustains like the ribbon. Live in the mic close-up too, routed through the ribbon |

Rules:

1. **Simultaneous:** held piano notes, drum hits, a held guitar chord + Space strums, and a held vocal may all be active in the same window. Audio buses already mix; do not mute sibling instruments when one receives a key. Walk keys never steal instrument codes.
2. **No focus required for keyboard sound.** Focus still reframes the camera, shows pads, and enables mesh / pad pointer play.
3. **One owner per physical key** — per _scope_. Never bind the same `KeyboardEvent.code` to two instruments that can answer at the same time, or to both walk and play. Two close-ups may share a code, because a close-up owns the keyboard outright and the two can never be live together: `Space` is the guitar's downstroke everywhere the jam map is live, and the hi-hat pedal inside the drums close-up, where the strum keys are already silent. The number row is the same arrangement seen from the other side — seven scale degrees at the guitar and piano, seven kit pieces at the drums, one meaning per close-up.
4. **Release hygiene:** `keyup`, window blur, visibility hidden, and focus exit clear held piano notes, keyboard guitar chord, and held keyboard vocal for that session path. Walk key sets clear on `keyup` / blur as today.
5. **Price chips:** first audible play of an instrument (keyboard or pointer) still queues the once-per-instrument chip. If that play happened without focus, show the chip after the visitor next leaves any instrument focus, or after ~2 s of silence from that instrument if they never focused it.
6. **`#keys-hint` (desktop-only):** show the map that is actually live, not the full one. Away from a close-up it lists the jam surface; inside one it lists only that instrument's keys, because advertising keys that no longer answer is worse than saying nothing. The loop key rides every variant once the pedal is unlocked.
7. **Mobile unchanged:** no jam keyboard; pads + focused multitouch only. Hide `#keys-hint` as today.

### Desktop

| Input                                    | Action                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| Click floor / mobile joystick            | Move mascot (idle)                                                                       |
| Click instrument                         | Approach if not focused; mesh / pad play only when focused                               |
| `Enter` while idle                       | Approach nearest instrument in reach (no auto melody)                                    |
| Drag / wheel / `+` `−`                   | Orbit / zoom (buttons stay visible while focused)                                        |
| `Z` `X` `C` `V` `B`                      | Drums (jam — any focus / idle)                                                           |
| `1`–`8`                                  | Piano whites (jam — hold sustains)                                                       |
| `Q` `W` `E` `R` `T` `Y`                  | Guitar chord strum + hold (jam)                                                          |
| Space / Shift+Space                      | Guitar downstroke / upstroke (jam)                                                       |
| `N` `M` `,` `.` `/`                      | Vocal notes (jam — hold sustains), counting degrees of the stage key                     |
| Drag across strings while guitar-focused | Directional guitar strum (pointer)                                                       |
| `L`                                      | Loop pedal (after first VIBE fill unlock)                                                |
| HUD logo click                           | Toggle mascot tektonik dance                                                             |
| Esc                                      | Close settings mixer (does **not** dismiss the onboarding tip or leave instrument focus) |
| ✕ (`#mobile-exit`)                       | Leave instrument focus (desktop + mobile)                                                |

### Mobile

- Small left **move zone** + floating stick under finger.
- **By default (КАМЕРА → Не дуже, § Камера) one finger pans and scouts back to the mascot.** Choosing **Вільна** swaps that for one-finger orbit and two-finger pinch-dolly, with the pitch opened up. The mascot stays followed either way.
- **ГРАТИ** when in reach → approach / focus. Outside reach it stays visually disabled but remains an accessible tap target: the first unavailable tap shows, once, `Підійди до інструмента ближче щоб заграти`.
- ✕ exit when entering / focused, never during approaching. Two guards rather than a timing window: ✕ stays hidden while `approaching`, and the **ГРАТИ** press arms a **one-shot** swallower for the single click the browser synthesizes after it — otherwise that click lands on ✕, which takes the same pixels once the play button hides, and cancels the approach the same gesture just started. A keyboard activation (`detail === 0`) is never swallowed.
- Leaving any instrument focus must reset the floating joystick, thumb, active pointer identity, and movement vector before the walk controls return. This includes a lost / cancelled iOS pointer while the joystick is hidden during guitar focus.
- Touch instruments when focused (multitouch piano / drums; chord hold + independent strum / pluck for guitar).
- Focused piano / drums / guitar play surfaces claim their fingers: taps and glissandi / strums play without rotating or pinching the camera. Orbit and pinch stay available from empty canvas around the instrument.
- **Pedal / pads + instrument multitouch:** one finger on loop pedal, chord wheel, voice ribbon, or other HUD chrome and another on the kit/keys/strings must both work. Wedge presses also claim their finger so they cannot drive orbit. Do **not** `preventDefault` multitouch `touchstart` when any finger is on UI chrome (that drops the second finger’s pointer events). Loop pedal binds **`pointerdown`**, not `click`.
- Chord wheel while guitar- **or piano**-focused; voice ribbon while mic-focused.
- HUD collapses to menu drawer on small screens.
- Keyboard key legend (`#keys-hint`) and drag hint are **desktop-only** — hidden on phones and tablets (`max-width: 720px` or coarse pointer / no hover).

### VIBE meter

Playing adds vibe. Each play route carries a nominal weight (drums `4`, guitar strum `5`, piano `3.5`…) which are **relative** values; a single `VIBE_NOTE_GAIN` scales all of them, so how long a full meter takes is one number rather than eight call sites. **Reaching 100% is a one-way door**: fireworks, the loop-pedal unlock, and the announcement fire exactly once, and the meter then _stays_ full for the rest of the visit — it never settles back to be re-earned, and the idle decay stands down. Because the maxed state is now permanent, its flash is a finite burst that settles into a brighter steady rail rather than an endless strobe. The maximum-vibe toast appears below the HUD, never over instrument pads, and claims its own taps so it cannot trigger browser double-tap zoom. Below 100% the meter decays when idle. Passing `12%`, `40%` and `60%` cheers once each (§9 Praise).

### Loop pedal

Unlocked once after first vibe fill. Record layers while playing; pause / clear tools. Key `L` on desktop. Must remain usable while another finger is playing an instrument. A ribbon hold records its actual sustained duration, and its glide (§ The voice and the loop pedal); if recording or overdubbing begins while a vocal is already held, capture starts at the pedal press — from the note the voice is on at that instant — and continues until release or loop closure.

---

## 6. UI overlays

| Overlay                                   | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intro                                     | Brand splash; **ВИЙТИ НА СЦЕНУ** starts the visual fly-in while audio stays dormant. A reload / same-tab return bypasses the splash and also leaves audio dormant until a real sound action.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Onboard                                   | Second step of the first run, after the first gift: one tip (`localStorage` `av2.onboard.v2`) dismissed only by **ЗРОЗУМІЛО**; mic pulse cue                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| HUD                                       | Logo (click = mascot dance), VIBE, **pricing button** (gold graduation-cap icon, **Уроки та ціни**), **settings mixer** (gear). No gift control — the gift is a first-run event, not a feature to revisit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Settings mixer                            | Opens from the gear (**Налаштування**): **Світло** fader (0–100%, `av2.lights.v2`, default `78`; **GLAMOUR** defaults to `67` and **PIXEL** to `100` when unset), **Гучність** with per-instrument faders (0–100%; 100% is boosted gain), then the **Камера** selector and the minimal **Графіка** selector                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Modals                                    | **Mascot gift** (`#modal-gift`), graphics-reload confirmation, steps, rules, **interactive pricing mixer**, **sign form** (`#modal-sign`, § Signs — reachable from the below-HUD marker button when storage is alive)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Chord wheel / groove wheel / voice ribbon | The one docked play surface, per instrument, while focused                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Chip                                      | Once-per-instrument price teaser: a compact tag-style pill reading as one line — instrument emoji + «Уроки» + a CTA button carrying the price, «від N зл ›» — fading in/out softly. The price is the CTA label; there is no separate «ЦІНИ» word. Before `prices.json` lands (or when an instrument has no single lesson) the button reads «в Art Vibe ›» and is rewritten in place the moment the file arrives. **Placement:** on desktop it hangs under the HUD's lessons-and-prices button, their right edges aligned (measured on each show, so it follows the nav when the sign button appears); at the phone breakpoint it stays bottom-centre, above the pads. **N is that instrument's own cheapest single lesson**, read from `prices.json`. Its full non-control surface opens its CTA; carousel arrows are hidden chrome — swipe still changes slides (the hidden arrow buttons are driven programmatically). The chip is queued on first play (pointer or keyboard), shown after leaving that instrument's focus — or after ~2 s of silence from that instrument if the play was keyboard-only without focus. **A shown chip buys a 3-minute global quiet period** — however it ended (read, dismissed, or timed out on its own) — before the next one, of any instrument, is allowed to show; a visitor who quickly samples several instruments gets one nudge at a time. Skipped on fall, instrument switch, and leaving the gift reveal. |
| Toast / tooltip                           | Short feedback                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### Графіка

- The settings mixer (gear icon) contains a minimal inline **ГРАФІКА** selector below the volume faders: **GLAMOUR**, **PIXEL**, and **AUTO**. Internally they retain the persisted values `high`, `low`, and `auto` in `localStorage` key `av2.quality.v2`.
- Choosing a different option opens the **Змінити якість графіки?** confirmation modal, which states that the page will reload. **СКАСУВАТИ** leaves the current mode unchanged; **ПЕРЕЗАВАНТАЖИТИ** immediately shows a spinner and **Застосовуємо зміни…**, locks the selector, then reloads the scene with that quality budget.
- **AUTO** uses a two-stage frame-pacing probe on every device (desktop, iPhone / iPad, and Android). It begins without expensive shadows or postprocessing, promotes only sustained smooth devices, and returns to the stable low budget if full effects miss cadence.
- A tier switch is **never applied while the intro fly-in is running** — the probe keeps sampling and the verdict waits for the camera to land. Switching rebuilds every lit material's shader program, and the frame loop pauses while the driver links them in the background, so the cost lands as a short hold on a still camera instead of a multi-second stall mid-zoom. AUTO also fetches the postprocessing modules during boot, so a later promotion never waits on the network.
- **GLAMOUR** and **PIXEL** are explicit overrides. PIXEL is the stable 30 FPS, no-shadows / no-bloom budget; GLAMOUR enables the full scene budget.
- A live horizontal **Світло** fader sits at the top of the settings mixer (gear icon → **Налаштування**) and scales stage lights, footlight emissives, and beam opacity from **0–100%** without a reload. The value persists in `localStorage` key `av2.lights.v2` (default `78`); on **GLAMOUR** the default is `67` and on **PIXEL** `100`, each only when no saved light preference exists — GLAMOUR carries bloom, which turns the brighter stage into glare inside a close-up. Instrument volumes remain in the same panel below the light fader.

### Камера

- The settings mixer carries a **КАМЕРА** selector directly above **ГРАФІКА**, with two options persisted in `localStorage` key `av2.camera.v1` (**default `follow`**). `?camera=follow|free` overrides it for a single load. The labels are **Вільна** and **Не дуже**, in that order and in that casing — the second reads as an answer to the first, so reordering them or shouting them in caps breaks the phrase. The button order is fixed regardless of which one is the current default; only `aria-checked` / the highlighted pill moves.
- **Не дуже** (`follow`, the default) is the original framed camera: the pursuit rig keeps the mascot composed low-centre, a drag temporarily scouts, and the spring recentres on release. Mobile pans on one finger, desktop orbits, pitch stays at **40°–84°**.
- **Вільна** (`free`) is the opt-in and frees the **angle, not the subject**, on every device: one pointer — mouse drag or one finger — rotates, two fingers pinch to dolly, panning is off, and the pitch opens to roughly **25°–93°**, enough to read the stage from overhead and to get behind the backdrop.
- **The mascot stays in frame in both modes.** The follow spring runs underneath Вільна too, and must: it applies one delta to _both_ `controls.target` and `camera.position`, so it is a rigid translation that leaves azimuth, polar and distance untouched and cannot disturb an orbit. The only gesture it ever pulled against is the mobile pan of Не дуже, which is why that mode suspends it while scouting and Вільна — having no pan — never needs to. A free camera that dropped the spring would let a visitor walk their mascot off-frame with no way back short of changing the setting, and would strand them after a fall-respawn — the spring is why Вільна is safe to offer at all, independent of which option ships as the default.
- Orbiting round at any distance past roughly **8 units** still carries the camera behind the back wall (`z ≈ -5.85`, against a mascot near `z ≈ 2.15`), so the `@vadymbek` maker's mark on the backdrop's reverse stays reachable with the subject locked.
- The upper pitch bound is a **stage floor, not a taste call**: eye height is `target.y + distance · cos(polar)`, so the limit is set where the camera still clears the platform top at the portrait maximum distance. Free must never mean looking up at the deliberately unlit under-stage venue plane.
- Unlike **ГРАФІКА**, switching camera **applies live with no reload and no confirmation** — the rig re-reads its limits in place. A change made while an instrument is focused is deferred rather than applied: the close-up owns the rig, and re-fitting mid-focus would drag the play surface out from under the visitor's fingers. It takes effect when they leave focus.
- On **desktop** the two modes differ only in pitch range, because the desktop camera already rotates and already follows. The setting earns its place on **phones**, where it is the difference between panning across the stage and orbiting around it.

### Pricing mixer

Driven by `prices.json`:

1. Pick instrument (**text-only** buttons — no SVG icons). Selecting an instrument (or opening the mixer on one) defaults to the cheapest option: разовий · shortest / lowest-priced duration (and the cheapest pack size for later абонемент).
2. Format: разовий / абонемент.
3. Duration; package size if абонемент. If the current duration is unavailable for the active format, fall back to the first (cheapest) duration.
4. Live ticket board (total + ≈ per lesson). Theme: purple vs gold, from each instrument's `theme`. Every ticket includes a prominent comic-style **ЗАПИСАТИСЬ →** CTA that opens **Як записатися?**.
5. Both **Як записатися?** and **Уроки та ціни** show a clear **Напиши нам** block with separate Instagram and Messenger buttons. The steps panel also keeps **Правила студії →** as a secondary link.

### Rules

Numbered “score rail”: language policy, single-lesson cancels, subscription rules, acceptance.

---

## 7. Data contracts

### `prices.json`

Every instrument is priced **separately** — `vocal`, `guitar`, `drums`, `piano` each own a full
price list, even where two of them currently quote the same numbers. No consumer groups them, so
changing one instrument's price is a one-place edit.

```json
{
  "currency": { "code": "PLN", "display": "зл" },
  "instruments": [
    {
      "id": "vocal",
      "name": "Вокал",
      "theme": "vocal",
      "singleLessons": [{ "durationMinutes": 30, "audience": "…", "price": 50 }],
      "subscriptions": [{
        "durationMinutes": 30,
        "audience": "…",
        "packages": [{ "lessons": 4, "price": 190 }]
      }]
    }
  ],
  "promotions": […],
  "paymentNote": "…"
}
```

- `id` matches the instrument keys used across the stage (`mic` is the one alias, → `vocal`).
- `name` is the label the mixer board prints; `theme` picks the board skin (`vocal` | `rhythm`).
- `js/core/prices.js` is the single fetch of this file; the mixer and the price chips share it.
- The lesson pages are static HTML and re-state these numbers, but they are **generated**
  from this file, not maintained beside it. `tools/sync-prices.mjs` writes prices.json into
  the pages and the deploy workflow runs it before the tests, so **editing prices.json alone
  is a complete price change** — no HTML edit, no red build. Run it locally (`node
tools/sync-prices.mjs`, or `--check` to only report drift) after touching this file so the
  committed pages match too.
- **The Polish pages are the same contract in another language**, so the words a page prints
  around the numbers live here too, beside their Ukrainian originals: `currency.displayPl`
  (`zł`), `promotions[].descriptionPl`, and `paymentNotePl`. Each page is generated and checked
  against its own locale, and the plural in a bonus badge follows it (`+1 урок` / `+1 lekcja`).
  Adding a promotion without its `descriptionPl` **fails the sync script by name** rather than
  shipping a half-translated page. The Polish pages carry no JSON-LD, so nothing of that layer
  applies to them.
- What it writes: each price cell (`data-price="single:<id>:<minutes>"` /
  `data-price="pack:<id>:<minutes>:<lessons>"`), the payment note (`data-payment-note`), the
  promotions list (`data-promotions`, badge and Ukrainian plural derived from the promotion),
  and the JSON-LD `lowPrice` / `highPrice` / `priceRange`.
- Amounts appear **only** in the price tables. Marketing copy names no price — a test fails
  if one appears outside a `data-price` cell, since nothing would keep it current.
- `tests/lesson-prices.test.mjs` then verifies the result. It fails only on **structural**
  drift — a tier added or removed changes which cells exist, which the script cannot invent —
  and names the offending key.

### Signs storage (SQLite backend)

The store is `deploy/av2-signs/server.js`: one dependency-free Node file using the built-in
`node:sqlite`, behind nginx at `https://back.artvibe.com.pl`, run by the `av2-signs` systemd
unit. The browser holds a URL and nothing else.

- **The API is two calls.** `GET /signs` → `{ total, signs: [{ id, slot, color, text }] }`,
  and `POST /signs` with a form-encoded `text` + `color` → `201 { sign }`, or `409 full`,
  `400 invalid`, `429 rate`. Form-encoding keeps the POST a "simple" CORS request, so there
  is no preflight round trip. Origins are allowlisted (the live hosts plus any localhost
  port, because dev serves the repo on 8000–8040).
- **The concurrency race is structurally impossible, not merely unlikely.** The server picks
  the lowest free slot and inserts it inside **one synchronous SQLite transaction** in a
  **single-process** server, so the event loop cannot interleave two writers between
  choosing a slot and taking it; `slot INTEGER UNIQUE` holds the line even if it were ever
  run as more than one process. This is the whole reason storage moved off the browser:
  every client used to rewrite one shared document wholesale, so two visitors signing at
  once silently overwrote one another and the store reported success to both.
  Read-modify-write from N browsers has no serialisation point; this does. Measured: 100 concurrent writes
  against a 67-slot stage yield exactly 67 accepted with 67 distinct slots.
- **Validation is enforced, not encouraged.** 24 code points after whitespace collapse,
  curated colours only, control / zero-width / bidi characters and zalgo stacks stripped —
  server-side, where DevTools cannot reach it.
- **Capacity lives in the backend.** Its `TOTAL_SLOTS` must match the layout constant in
  `js/scene/signs.js`; `GET /signs` reports it so the "N / 67 вільних місць" badge always
  quotes the number that will actually be enforced. The stage fills once and closes: a full
  stage answers `409`, and nothing is retired to make room.
- **The database is the only copy of the wall.** Nothing mirrors it and nothing stands
  behind it, so `deploy/signs-backup/` is load-bearing rather than a convenience: it
  snapshots `signs.db` every two hours via sqlite3 `.backup` (a live WAL database cannot
  be safely `cp`-ed), keeps ~20 days, and skips runs where nothing changed.
- **Rate limiting is in memory and never written to disk**, so it stays transient rather than
  stored personal data and the no-cookie-banner position in `notes/Decisions.md` survives.
  nginx overwrites `X-Real-IP`, so a client cannot spoof it.
- **If the backend does not answer, the feature does not exist** — one boot probe gates the
  button, the modal and every surface, exactly as before. QA runs
  (`testhooks` / `headless` / `shot`) never touch it.
- **The backend makes no outbound calls at all** and holds no credentials. Moderation is
  SQL against `/var/lib/av2-signs/signs.db` over SSH; `sqlite3` is installed on the box.

### `piano-notes.json`

Ordered list of `{ "note", "freqHz" }` kept for possible phrases; focus / `Enter` / ГРАТИ do **not** auto-play a default melody.

### Guitar runtime event

Chord voicings are six slots ordered low E → high E; `null` means muted. Derive pitch from one shared open-tuning table and the fret number.

A recorded strum carries serializable per-string data. `direction` is `bass-to-treble` or `treble-to-bass`; `velocity` is normalized from `0` to `1`:

```js
{
  type: "guitar-strum",
  direction: "bass-to-treble",
  velocity: 0.72,
  strings: [
    { stringIndex: 0, fret: 0, freqHz: 82.41, offsetMs: 0 }
  ]
}
```

The loop pedal preserves this order, velocity, and timing instead of rebuilding a generic chord on playback.

### Roadmap: piano runtime event

The planned piano feedback / loop milestone will use one attack event. `key` is the stable note identity; `freqHz` is serialized so loop playback does not depend on a later mesh lookup:

```js
{
  type: "piano",
  key: "C4",
  freqHz: 261.63,
  velocity: 0.78
}
```

A glissando emits one event for each newly crossed key in order. The loop pedal preserves each event's timing and velocity; pointer identity and camera-gesture state are never recorded.

### `av2.mascot.v4` (localStorage)

The character the visitor was given, written on the reveal frame, merged over defaults and validated on load (unknown / malformed values fall back **per field**, so one bad value never invalidates the whole look). Older `av2.mascot.v1` … `v3` values are intentionally ignored — a key bump is how returning visitors get reset, and v3 looks were hand-authored in the retired editor so they carry no tier:

```js
{
  tier: "common",           // "common" | "rare" | "epic" | "legendary"
  hair: "long",             // "long" | "bob" | "short" | "bald"
  hairColor: "5a2f22",      // 5a2f22 | 241a14 | c9a35f | a14d2d | b04a68
  smile: "soft",            // "soft" | "wide" | "neutral"
  eyeColor: "dark",         // "dark" | "green" | "blue"
  outfit: "stage",          // "stage" | "vibe" | "denim" | "night"
  outfitPrimary: "default", // "default" | "purple" | "gold" | "denim"
  outfitAccent: "default",  // "default" | "purple" | "gold" | "cream"
  shoeColor: "default",     // "default" | "ink" | "cream" | "red"
  skinTone: "tone-3",       // "tone-3" | "tone-4" | "tone-5" | "tone-7"
  accessory: "hoops",       // "none" | "hoops" | "glasses" | "headphones"
  height: 100,              // percent, 70–145
  width: 100                // percent, 65–150
}
```

### First-run UI state (localStorage / sessionStorage)

- `av2.onboard.v2` gates the whole first-run sequence (the first gift, then the tip) and is written only by **ЗРОЗУМІЛО**. Leaving before that click replays both steps on the next visit.
- `av2.chord-key.v1` holds the **stage key** as `{ tonic, mode, sevenths }` — `tonic` a pitch class `0–11`, `mode` `major` | `minor` (§ The chord wheel). Each field falls back on its own, so an out-of-range or corrupt one lands on C major with sevenths off without discarding the rest. The name is the chord wheel's, kept so an existing visitor keeps the key they chose, but the value is now the whole stage's: the voice ribbon sings in it too, and either surface's stepper moves it (§ Vocal performance mode).
- `av2.groove.v1` holds the groove wheel's choice as `{ groove, bpm }` — `groove` an index `0–11`, `bpm` `60–160` (§ The groove wheel). Each field falls back on its own, to ПУЛЬС at 92. **The sound state is deliberately absent**: it resets to silence on every load, because a remembered unmute would start drums at a returning visitor who has not asked for any.
- A vocal event's `vowel` is a position on the ribbon's axis, `0` (І) to `1` (У) — not an index into a preset list. An optional `glide` carries `[secondsFromStart, midi, vowel]` breakpoints and is **absent entirely** on a steady note.
- A drum event's `part` is one of `kick`, `snare`, `hihat`, `hihatOpen`, `tom1`, `tom2`, `floor`, `crash`. Every one is named explicitly on the audio path — an unhandled name must not fall through to whatever branch happens to be last.
- `av2.mobile-play-hint.v2` records the one-time unavailable-**ГРАТИ** proximity hint.
- `av2.sign.v1` holds the visitor's last stage sign (`{ text, color, ts }`): prefill plus the rolling 24-hour gate.
- `av2.intro.v2` (`sessionStorage`) records that the splash was already entered in this tab so a same-tab reload can skip the intro.

---

## 8. URL query flags

| Param                                     | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nointro`                                 | Skip splash; land on stage + HUD                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `autoenter`                               | Auto-click enter after load                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `skiponboard`                             | Never show the first run — no gift and no tip                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `shot=pricing\|rules\|steps\|chip\|toast` | Open overlay / demo UI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `anchor=vocal\|guitar\|drums\|piano`      | Preselect pricing instrument                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `sstime`                                  | Slideshow timing override (debug)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `camera=follow\|free`                     | Force the stage camera for one load, ignoring `av2.camera.v1` (does not persist)                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `testhooks`                               | Headless QA only: exposes `__THREE_GAME_TEST_HOOKS__` (setState: stage/piano/guitar/drums/mic/vibe/dance, debug `pick(clientX, clientY)` raycast listing, a `scene` handle for isolation toggles, a `state` snapshot of the view / walk / mascot / camera-distance limits, `captureFrame()` for synchronous canvas capture, `seed(n)` to pin the gift RNG, and a `gift` group with `draw(seed)` / `open(tier)` / `skip()` / `state`) + `__THREE_GAME_DIAGNOSTICS__` (renderer counts) for the canvas inspector; never active for visitors |
| `gift=common\|rare\|epic\|legendary`      | With `testhooks` only: pins every draw to that tier                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `giftfast`                                | With `testhooks` only: replays the same reveal timeline at ~40× so a headless run can drive many pulls                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `headless`                                | With `testhooks` only: pumps the frame loop from a worker interval so hidden/backgrounded QA tabs still simulate and render                                                                                                                                                                                                                                                                                                                                                                                                               |

`testhooks`, `headless` and `shot` also stop analytics events being **sent** — QA
runs drive the funnel deliberately and must not land in the dashboard. Events are
still recorded into `window.__av2Events`, which is how headless checks assert them.

---

## 9. Onboarding

**Two steps, in this order,** once the camera fly-in lands:

1. **The first gift** opens on its own (`#modal-gift`, §Mascot) and asks nothing of the visitor — it hands them a character in a few seconds and, on the same card, tells them what the stage affords. The wardrobe is already standing in the spotlight when the fly-in lands (§Mascot), so it does not pop in. **ЗРОЗУМІЛО** ends the first run; **✕** / Esc leave the text unacknowledged, so the standalone tip is offered on the next visit. This opening rides the camera fly-in rather than a tap, so it is **silent**: creating an `AudioContext` without a user gesture is forbidden (§ Audio activation), and every synth call no-ops until one arrives.
2. **The tip** appears one frame later.

Default copy:

> Вітаємо на сцені Art Vibe! Сьогодні вона повністю твоя. По ній можна ходити, а на інструментах — грати.

**Only ЗРОЗУМІЛО dismisses the tip.** Playing, walking, Esc and tapping the card all leave it standing — it is the last thing the first run says, and a visitor who walks past it never reads it. Soft purple pulse on the mic while active (disabled under reduced motion).

That click is also what writes `av2.onboard.v2`, so the sequence is all-or-nothing: quit partway and the next visit offers both steps again. `skiponboard` suppresses the whole of §9.

### Praise

Short spoken-aloud cheers — **Супер! / Потужно! / Клас!**, never the same word twice running — as the VIBE meter passes **12%**, **40%** and **60%**. Three cheers a visit, then silence until the fill announces itself: praise that keeps arriving stops meaning anything. Tied to the meter rather than to note counts because the meter is what the visitor is filling, so each cheer reads as progress on that bar; `12%` lands a few notes in, early enough to answer "is this worth my time", and the later two mark a bar that is visibly moving.

- Each mark fires **once a visit**. The marker only moves forward, so the idle decay can walk the meter back across a threshold without buying a second cheer for the same ground; a single note crossing two marks collapses into one cheer rather than stacking.
- Praise **yields to a toast already on screen** rather than replacing it: anything else the stage chose to say carries more than a cheer does. A cheer swallowed that way is retried on the next note rather than spent, so no mark is lost to a collision.
- Loop playback never counts — replayed notes pass `feedback: false` and so never reach `addVibe()`, so a loop cannot congratulate you on itself.
- Every live play route reaches `addVibe(n)`; the voice ribbon and keyboard vocal call it directly rather than through `playMusicalEvent`. The ribbon awards **per press, never per glide sample** — otherwise a wiggling finger farms the meter.

Filling the VIBE meter announces itself **once** — **Максимальний вайб! Тепер ти можеш більше.** on the first fill, the one that actually changes something. That fill is the stage's single unlock moment: it opens the **loop pedal** and, where the signs storage answered, the **sign button** — both appear together as the toast lands. The copy names neither, deliberately: two controls arriving on screen say it better than a list, and the wording no longer needs editing each time the fill unlocks something new. Later fills keep the fireworks and the meter flash but say nothing: by then a full meter is self-explanatory, and repeating the words would make the unlock read as routine in hindsight.

## 10. Telegram / in-app browser

Best-effort only when opened inside Telegram:

- Load `https://telegram.org/js/telegram-web-app.js`; call `ready()`, `expand()`, and `disableVerticalSwipes()` when available (**Mini App** API 7.7+).
- Detect Telegram UA / `Telegram.WebApp` → `html.telegram-webview` + touch claiming so the shell is less likely to steal stage drags.
- **Limit:** a plain in-app browser link cannot fully block native header / edge dismiss gestures. Full control requires wrapping the site as a Telegram Mini App, not only opening the URL.

Pinch / page-zoom guards must **skip** events that involve UI chrome so pedal + instrument multitouch keeps working.

---

## 11. Deploy

**Primary:** GitHub Pages (Actions).

- Workflow: `.github/workflows/deploy-pages.yml` on push to `main`.
- Artifact: `css fonts img js pl stage uk uroky-*-lodz vendor index.html 404.html prices.json piano-notes.json robots.txt sitemap.xml .nojekyll CNAME`. The list is hand-written, so a new top-level file that is not added here simply never ships — `tests/site-meta.test.mjs` guards `404.html` and `pl` specifically.
- **Paths are site-absolute** (`/js/…`, `/prices.json`, `/img/…`). The stage is served from
  `/stage/`, so a document-relative path resolves under that directory instead of the root.
- Custom domain: `artvibe.com.pl` → GitHub Pages (`voloshyninthesky.github.io`).
- Enforce HTTPS in Pages settings after DNS verifies.
- **Cache bust:** bump `?v=` on `css/style.css`, `js/main.js`, and module imports as needed (including `audio.js` when unlock behavior changes).

**Live VPS release:** nginx release dirs under `/var/www/vibe2.ton.zone/releases/<UTC>/` via `deploy/nginx/`. Update all three Nginx `root` entries, validate with `nginx -t`, reload, and move `current` only after the new release is ready.

Local: `python3 -m http.server 8000 --bind 127.0.0.1` → http://127.0.0.1:8000 (lesson site),
http://127.0.0.1:8000/stage/ (3D stage)

### Analytics

GoatCounter, site `stephan-geega` (dashboard: https://stephan-geega.goatcounter.com).
Cookieless and storing no personal data, so the site needs **no consent banner** —
that is the reason for the choice, and swapping in a cookie-based tool would
change what the site owes its EU visitors.

Hits are sent to the first-party endpoint `https://count.artvibe.com.pl/count`, a
CNAME onto the GoatCounter site. **That domain needs a TLS certificate covering it**
— GoatCounter must have the custom domain configured, not just the DNS record. If it
serves the default `goatcounter.com` certificate the name will not match, browsers
will refuse the connection, and every hit is lost silently while the pages still
look fine. Verify with `curl -sI https://count.artvibe.com.pl/`; a certificate error
there means the analytics are dark.

The endpoint is one identical `data-goatcounter` string on every page; changing it is
a find-and-replace across the HTML and `tests/site-meta.test.mjs`. Note the script
itself still loads from `gc.zgo.at`, so blockers targeting that host stop collection
regardless of the counting domain. Sending is best-effort everywhere: no analytics
call may ever sit in the path of a booking link.

Events (`js/core/analytics.js` for the stage, `js/lessons-analytics.js` for the
lesson pages):

| Event                                                                         | Fires                                                                                                                                      |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `stage-enter`                                                                 | Scene starts. **Not** a click — the stage auto-enters when assets finish loading, so this reads as "session started", not "button pressed" |
| `stage-first-play`                                                            | First note on any instrument (all play routes funnel through `addVibe`)                                                                    |
| `stage-pricing-open`                                                          | Pricing overlay opened by any route                                                                                                        |
| `book-{instagram\|messenger}-{home\|vocal\|guitar\|piano\|drums\|stage}`      | Outbound booking link clicked                                                                                                              |
| `book-{instagram\|messenger}-pl-{home\|vocal\|guitar\|piano\|drums\|privacy}` | The same, from a Polish page (§3 Polish pages)                                                                                             |
| `stage-sign-left`                                                             | A sign was accepted onto the stage (at most once a day per device by construction)                                                         |

The first three fire at most once per page load; booking clicks fire every time.
Booking happens inside Instagram/Messenger DMs, so the click is the last thing
this site can observe — it is the conversion number.

---

## 12. Quality bar

- Works on desktop and mobile Safari / Chrome (and best-effort Telegram in-app browser).
- Keyboard focus visible on overlay controls.
- `prefers-reduced-motion`: cut ambient / onboard pulse animations.
- WebGL fail → `#webgl-fail` panel, with links back to `/` and to Instagram booking so an unsupported device is not a dead end.
- Lock page-level pinch and double-tap zoom for the whole live stage. Keep initial UI control pointer dispatch intact (claim multi-touch on move / Safari `gesture*`, not a chrome `touchstart`) so two-control and pad↔canvas interaction still works. Informational overlays retain normal zoom / scroll.
- **A control never has its `touchend` cancelled.** Cancelling it suppresses the synthesized `click`, and for every `click`-bound control — the whole HUD — that click _is_ the activation. Double-tap suppression is therefore proximity-gated (two taps within `320 ms` **and** `44 px`) and skips interactive elements entirely; those carry `touch-action: manipulation`, so the compositor already refuses to zoom from them.
- **Hover affordances are `@media (hover: hover)` only.** A touch browser applies `:hover` on tap and holds it until the next tap elsewhere, so an unguarded rule leaves a control looking chosen but not fired. `:focus-visible` styling stays unconditional.
- **Panel body copy is selectable; panel controls are not.** A button whose label can be selected answers a press-with-a-little-drag by highlighting itself instead of activating.
- In focused piano/drums, one-finger orbit and two-finger zoom work even when the gesture begins on playable geometry; short taps and intentional piano glissando remain playable.
- With Spotify / Apple Music already playing, Enter, walking, camera controls, instrument focus, chord selection, and settings changes leave external audio uninterrupted and do not create an `AudioContext`.
- On platforms supporting Audio Session `ambient`, the external source continues while Art Vibe instruments play over it. On unsupported platforms, external audio remains uninterrupted at least until the first real Art Vibe sound action.
- No stuck-silent sessions after backgrounding or a mobile audio-route interruption: the next user gesture can rebuild and unlock the graph without a page refresh.
- No secrets in repo, and **no exceptions**: prices are public marketing data, and the
  browser holds nothing but the backend's URL. The signs feature used to ship a third-party
  write key in the bundle; moving storage behind `back.artvibe.com.pl` (§7 Signs storage)
  retired it, and the backend itself now holds no credentials and makes no outbound calls.

### Piano framing / pose acceptance

- At `320×568`, `390×844`, `430×932`, `844×390`, and `1280×720`, both hands and the great majority of the keybed remain in frame, with the mascot's head clear of the keys. Only the outermost key or two may crop, and `−` recovers the complete keybed.
- Black / white key relationships and the white-key front edge remain readable, and white keys are large enough to hit confidently with a fingertip.
- The first stable piano-focused frame exactly matches the camera transition endpoint. Re-enabling OrbitControls does not snap, rotate, zoom, or shift the target.
- HUD, loop pedal, safe-area insets, and ✕ do not cover the keybed or either hand. Opening a VIBE toast does not make the play area unusable. Price chips appear only after leaving focus, so they never cover the keybed during play.
- The seated pose remains believable at the mascot height / build extremes: pelvis on the bench, feet near the floor, hands over separate keyboard regions, relaxed shoulders, and no visible body / furniture intersections. At every height / build value the head stays below the keybed on screen — the scale-aware bench standoff, not the camera distance, guarantees this.
- Entering focus blends cleanly from the preceding walk / idle pose. Ten consecutive piano focus → ✕ cycles produce no transform drift, stuck seated limbs, or return-position regression.
- Resize, orientation, and `visualViewport` changes during entry update the transition destination; the focused frame never flashes through an obsolete preset or teleports between compositions.
- Under `prefers-reduced-motion`, framing and pose remain complete and readable without breathing / wrist motion or a long transition.

### Guitar acceptance

- In a five-person first-use test, at least four players make an open strum within `8 s` and a chorded strum within `20 s` after the camera settles, without verbal help.
- The first stable guitar-focused frame must match the camera transition endpoint; enabling orbit controls and the focused azimuth limits must not snap, reframe, or otherwise move the view after the animation.
- No **pointer / pad / mesh** guitar sound occurs outside stable guitar focus, including distant taps, camera transitions, and focus on another instrument.
- **Desktop keyboard** guitar chords (`1`–`7` in a close-up, `Q W E R T Y U` outside one) and the strum keys (`↓` `↑` `Space` `Shift+Space`) follow the jam map: they may sound while idle or while the guitar is focused, and must be silent inside another instrument's close-up, before the stage has started, while a modal is open, or when the event target is editable / a control.
- A complete stroke excites each crossed eligible string once and in directional order; motion along the strings stays silent. Muted strings neither sound nor animate.
- Soft and hard strokes are audibly distinct. Reversing direction can immediately produce the reverse string order without false retriggers.
- Twenty consecutive chord-hold + second-pointer strums work on supported iPhone Safari and Android Chrome without page zoom, orbit motion, lost pointers, or a stuck chord.
- **Chord targets are wedges, so the rule is about the narrow axis.** A 30° wedge is already ~50–60 CSS px across its arc at every supported size; what a fingertip misses is its radial thickness, which must never drop below `32 px` (it is ~35 px at 320×568 and ~44 px on a typical phone). The hub is the _residue_: it is kept to the smallest circle its stepper and 7 toggle fit in, and the rings split what is left. The wheel's width is capped by what the right-hand control column needs rather than a flat `vw` fraction, so it never overlaps the loop pedal, the ✕ exit, or the onboarding tip — it sits just clear of the ✕, within a few px at the narrowest size. The strum zone remains usable at the smallest supported viewport and after portrait / landscape changes — including the orientation-dependent guitar framing, where a stroke crosses the strings horizontally on portrait and vertically on landscape.
- Every wedge, in every key, with sevenths on and off, names a chord the library has and sounds exactly that chord's tones — on the guitar's fret shape and in the piano's voicing alike. All three are checkable in Node and are checked, because a wrong wheel is silent-but-wrong.
- Changing the key or the seventh toggle while a chord is held clears the hold: what is lit, what is armed and what would sound never disagree.
- A chord fired at the piano depresses exactly the voiced keys and releases all of them, including when the pointer is cancelled mid-roll.
- Pointer cancel, focus exit, visibility loss, and page backgrounding clear every held chord, active stroke, and captured guitar pointer.
- Repeated guitar focus → ✕ exits on iPhone Safari restore the joystick to its non-floating home state; a lost joystick pointer-up may never leave only the blurred stick backdrop behind.
- Input-to-audio scheduling is at most `16 ms`; target measured input-to-audible latency is at most `50 ms` desktop and `80 ms` on reference mobile devices.
- Audio and per-string visual onset differ by at most `33 ms`. Reduced motion removes idle shimmer, not essential play feedback.
- A physical string has at most one active voice; retrigger and mute ramps do not click. First play performs no synchronous synthesis-table generation in the input handler.

### Drums acceptance

- **Silence through focus.** Reaching the drums opens a stopped wheel: no `AudioContext`, no sound, no lit wedge, no playhead, and a motionless kit. Changing tempo while stopped still creates none. A reload returns the wheel to stopped with the groove and tempo remembered.
- **Tap to play, tap again to stop.** A wedge starts that groove sounding _and_ animating in the same instant; the same wedge stops it and the kit goes still. Nothing on the kit ever recoils without a sound.
- **Stopping does not pause the bar.** Stop a groove, wait any length of time, tap it again: it resumes where a bar that never stopped would be, not where it was left. Leaving the close-up and returning does start on the downbeat. A tempo change while stopped holds the position.
- **A groove earns nothing.** The VIBE meter does not move while one runs, whether or not a take is recording, and a groove alone can never unlock the loop pedal.
- **A take over a groove contains it.** Record four bars of РОК and the loop holds its kicks, snares and hats at the right offsets; the groove stops itself as the take closes, and the loop plays the beat from then on.
- The groove ring — the only touch target on the wheel — is at least `32 px` thick radially at `320×568` and `844×390`. The bar ring inside it is read-only and may be thinner.
- The wheel does not cover the kit, the mascot's hands or the ✕ exit at `320×568`, `390×844`, `430×932`, `844×390` and `1280×720`. Verified by eye at the drums preset, since drums has no measured fitter to derive it from.
- The three docked surfaces are never two: drums shows the groove wheel, guitar and piano the chord wheel, the mic the voice ribbon, and idle shows none. `__ribbonDebug().docked` names what is open.
- The ribbon's pitch axis is monotonic and its in-key notes and midpoints are fixed points, checked in Node across all 12 keys in both modes; a wrong detent is silent-but-wrong the way a wrong voicing is.
- A sung glide records breakpoints and replays as a curve; **a steady note records no `glide` key at all**, so pre-ribbon takes keep their event shape byte for byte.
- The mascot's mouth follows the vowel while a note sounds and returns to the gifted character's own smile on release.
- Recording four bars over a sounding groove yields a loop whose duration is a whole number of bars and whose downbeat coincides with 12 o'clock. Three minutes later they still coincide. `clearRecordedLoop()` does not stop the groove or swallow its pending animation.
- `1`–`7` play all seven kit pieces in a close-up, including the floor tom and the rack tom that `Z X C V B` cannot reach. `Space` opens the hi-hat while held and closes it on release; outside the drums close-up the same key is the guitar's downstroke and touches no cymbal. `;` `'` `` ` `` are inert outside the close-up.
- A snare struck at its centre and at its rim are clearly different in level without clipping, and a drag across the kit is a roll with dynamics. A rim strike is quiet, never silent.
- Reduced motion removes the cymbals' idle sway and steps the playhead beat to beat; the hit recoil and crash swing remain. A hit squashes the drum and never its stand.
- `;` / `'` step the groove audibly and `` ` `` starts / stops it; all three are inert outside the drums close-up.
- Switching tabs for 30 s and returning leaves the groove in phase rather than dropping its hits.

### Desktop keyboard jam acceptance

- After Enter on a desktop viewport, with no modal open, holding `1` + tapping `Z` + holding `Q` and pressing Space produces piano + drum + guitar audio in one gesture sequence without focusing any instrument.
- `[` / `]` step the chord wheel's key and `\\` toggles its sevenths from anywhere the jam map is live; the lit sector, the wedge labels and the chord row all follow in the same frame. Tapping the key readout swaps the key for its relative minor and back, moving home between the rings without moving the lit sector.
- **Away from a close-up**, holding `N` (vocal) together with `3` (piano) and tapping `X` (snare) keeps all three buses audible. **Inside one**, the opposite is required: focusing the piano must silence the drum, vocal and strum keys, and leaving must restore them on the next press.
- Mascot movement has no keyboard bindings: use click-to-move or the mobile joystick. No `KeyboardEvent.code` is shared across the **global** approach, loop, piano, drums, guitar, or vocal maps (`Enter` is approach-only while idle; the QWERTY row belongs to the chord wheel, so `Q` is the tonic and `E` the iii). The one **focus-only** layer — the piano's `A–L` + upper row — claims four QWERTY chord letters, so for exactly as long as piano is focused the whole chord row stands down and moves to `1–6`; that shadowing is scoped, deterministic, and reversed on exit. Guitar focus adds no letters of its own: it reuses the same QWERTY row and only changes what a press _does_ (select, not select-and-strum).
- A visitor can hold `W` to walk and tap `Z` / `1` / Space in the same session without the walk key stealing instrument input (play keys fire; walk continues on remaining held walk keys).
- `keyup`, blur, `visibilitychange` → hidden, and ✕ exit clear held piano keys, keyboard guitar chord, and held keyboard vocal without stuck sustains.
- Mobile / coarse-pointer shells ignore the jam keyboard and keep focus-gated pads; `#keys-hint` stays desktop-only and lists the jam map.

---

## 13. Mascot gift (гача)

### Outcomes

The gift should feel like being handed someone, not like filling in a form. The editor it replaced asked visitors to design a character before they had any reason to care about one.

1. A first-time visitor meets their character in **under five seconds**, having chosen nothing.
2. The reveal is legible as an event: several seconds of building anticipation, then a payoff loud enough to be worth having waited for.
3. **No HUD entry point, and the only reroll costs something.** A tier you can re-roll on a whim is not a tier, so there is no button; but walking off the stage edge hatches a new character, trading the one you had. On first run the gift is re-offered until a character actually exists in storage.
4. The feature stays lightweight: procedural geometry, shared materials, curated pools, local persistence, no account or asset download.

### The draw

- **Tier first, then a constrained draw from that tier's pools.** Rarity is never scored from the drawn traits: a score model produces looks that are statistically rare but read as ordinary, and the reveal then promises something the character cannot deliver.

| Tier            | Weight | Accent            |
| --------------- | ------ | ----------------- |
| **ЗВИЧАЙНИЙ**   | 58%    | cream `0xFDFBF7`  |
| **РІДКІСНИЙ**   | 27%    | denim `0x5B82A6`  |
| **ЕПІЧНИЙ**     | 11%    | purple `0x9E33CA` |
| **ЛЕГЕНДАРНИЙ** | 4%     | gold `0xD1A13B`   |

- **The ceremony is identical at every tier** — the same ~7 s timeline, five thumps, five bursts, bloom ramp and closing spin that used to be reserved for a legendary. A visitor receives one gift in their life, so scaling the spectacle to the roll would mean most people never see the good version of the only reveal they will ever get. A `GIFT_TIERS` entry carries **only** a label and an accent colour, and must never grow timing or intensity fields again; the persistent on-stage presence below is keyed off the tier *id* elsewhere (`js/scene/mascot-aura.js`) and never feeds back into the ceremony.
- **The card is the whole of the first run.** It introduces the character and says what the stage lets you do with it — «Вайбери люблять ходити по сцені та грати на інструментах.» — and its **ЗРОЗУМІЛО** writes `av2.onboard.v2`. Two cards in a row, the second restating the first, was one beat too many for a visitor who has not touched anything yet. The standalone tip survives only for the visitor who has a character but never acknowledged the text (closed with ✕ or Esc), which is why the two gates stay separate.

- The card shows the tier inside the sentence and nothing else — no name, no trait list. Higher tiers weight toward the traits that read as distinctive at stage distance — `bald`, the `night` palette, `headphones`, the pink hair swatch, `gold` overrides, wider height / build ladders. Common keeps the whole vocabulary so the ordinary population stays varied.
- **`skinTone` is drawn evenly at every tier and must never become a rarity signal.**
- **Legendary is six authored looks**, picked uniformly, each carrying at least two signature traits and its own name. A tier a visitor cannot recognise on sight is not a tier.
- There is **no pity counter and no repeat-guard**: both only made sense with rerolls. 4% is the true one-shot rate, and the draw is pure — same rng in, same character out.
- Two identical characters never arrive back to back; an exact repeat is redrawn once.

### The reveal

Driven from the single frame loop, never from `setTimeout` (timers clamp to ~1 Hz in a hidden tab, which would strand the burst).

| Beat              | What                                                                                                                                                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fly` 0 → 0.9 s   | Camera tweens to the wardrobe; on a reroll it pops in with overshoot                                                                                                                                                                                           |
| `settle` → 1.25 s | The wardrobe rests, doors shut. Seam glow stays neutral cream **at every tier** — no tell yet                                                                                                                                                                  |
| `strain` → +3.8 s | The rocking escalates; the upper shell lifts off the seam and the glow leaks through the crack. From 60% through the strain the glow lerps toward the tier accent — the tell, late enough to land as a payoff. Bloom ramps with it. Five thumps, evenly spaced |

**The ceremony is percussion only — no melody.** Knocking from inside the shell and a crash at the hatch. A pitched line turns the reveal into a jingle and competes with the instruments the visitor is about to play.
| `burst` | The cap flies off; five firework bursts; footlight pulse; crash. **The config is validated, applied and written to storage on this frame.** The character lands with a scale overshoot |
| `pose` +0.1 → ~1.4 s | Camera pushes onto the character; arms up, hold, relax. Legendary gets a full turn |
| `card` +0.55 s | The card introduces the character by tier and says what the stage affords; focus moves to **ЗРОЗУМІЛО** |
| `held` | Idle. Horizontal drag rotates the character |

- **One rate scalar (`giftReveal.rate`) owns every time distortion** — `1` normally, `~5` under `prefers-reduced-motion`, `~40` under `?giftfast`. The timeline is authored once at real speed and replayed faster, so no second set of durations can drift from it. Audio is scheduled in absolute `AudioContext` time before the rate is applied, so it never drifts with frame pacing.
- The ceremony is **exempt from the 15 fps modal render budget**; the `held` phase is not.
- Under `prefers-reduced-motion` the whole thing collapses to about a second: no wobble, one burst, no bloom ramp, no pose. **Audio is unchanged** — it is action feedback, not ambient shimmer. The tier is still carried by the card and the accent colour.
- A tap outside the card, or Enter / Space, skips to the reveal after a 400 ms grace so the opening tap cannot also skip it.
- The wardrobe is **built once at boot** and kept invisible, **no lights**: a light added lazily would relink every lit program mid-ceremony, and the additive seam glow plus the bloom ramp do the same job for free.
- **The prop is two layers.** A procedural cabinet (carcass, cornice, legs, two hinged doors) exists synchronously at boot, so the ceremony is fully playable offline and never waits on the network. A generated GLB shell (`/stage/assets/wardrobe.glb`) dresses it when it arrives, fitted to the procedural box exactly — front rotated to +z, then scaled per axis to the same W × H × D. The generated mesh is fused and cannot hinge, so it owns every shut state and hands back to the procedural carcass on the burst frame, under the flash, when the doors pass their open threshold.
- **The dress-up window closes at the strain, not at ceremony start.** A first-run gift opens straight out of the boot fly-in; gating on "is the wardrobe visible" would mean the one visitor who actually watches a ceremony never sees the generated art. A shell that lands mid-strain waits for the ceremony to end.
- The wardrobe is **yawed to the ceremony camera and stood back by its own front extent**, so it reads front-on from whatever angle the visitor left the camera at, and the character lands in the doorway rather than inside the cabinet.

### The tier on stage

The reveal used to be the only place a tier existed; after ГОТОВО every character looked
common. Rare and above are now accompanied by **companion birds** in the tier's accent
colour, with the character for as long as they are kept. One bird family, and the ladder is
the **count** — legible from the back row:

| Tier            | Companions                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------ |
| **ЗВИЧАЙНИЙ**   | Nobody — the unmarked bottom rung is what makes the ladder read                             |
| **РІДКІСНИЙ**   | **One** small crestless sparrow: low, timid flights under the resting hands, resting on the boards twice as long as it flies |
| **ЕПІЧНИЙ**     | **Two different birds** — a crested songbird and a slim forked-tail swallow — on opposite orbits, landing on the character, one shoulder each while they play |
| **ЛЕГЕНДАРНИЙ** | **Three different birds, in gold**: the pair plus a third, smallest — a round dark-capped tit — whose perch is the **crown of the head**; shoulders and head occupied while they play |

The flock is **three authored species-silhouettes from one builder** (crest, tail shape —
long / forked / fan — slimness, a dark cap), so it reads as a flock rather than clones. The
differences are the ones that carry at stage distance; keep new variety in that vocabulary
rather than new meshes.

- One on the boards < two on your shoulders < three golden ones crowning you. The count is
  the ladder; gold and the head-perch are what keep legendary unmistakable at a glance.
- Under the birds' owner sits a **soft accent halo** on the boards — one additive ring in
  the tier colour, breathing barely (±8%), intensities 0.30 / 0.38 / 0.48. It is an
  underline, not a ladder: the one piece of the deleted aura that came back, and it must
  never regrow the runes, ripples, rays or trim that were removed with it. It follows the
  floor in seated poses and is absent for common.
- The companions appear **at the burst**, with the character — never before. The wardrobe's
  seam glow stays the sole tell during the strain.
- **Budget rules.** All four birds (sparrow + the flock of three; epic and legendary share
  the same two flock birds, recoloured) are built once at boot in the scene before the first
  `renderer.compile`, then only toggled and recoloured per tier: a reroll allocates no
  geometry, no texture, no program link. No new lights, no post passes, no shadow casters
  (the curated shadow rule). Measured against common: legendary +27 draw calls / +1743
  triangles, epic +18, rare +8. Geometry and texture counts are identical at every tier and
  across a 20-pull stress. Replacing the additive aura with creatures *removed* four
  full-screen-blended ground layers.
- Per-frame animation is transform-level only — positions, rotations, wing pivots. Material
  **opacity is never written** by the companion — the stage-fall fade owns opacity for
  everything under `mascot.group` and restores it on respawn.
- The sparrow's floor rest counters the group's lift in seated poses and the dance bounce so
  its feet stay on the boards; in a fall the companions ride the body and fade with it.
- Companions settle while the visitor is at an instrument (nothing may orbit through a piano
  cabinet): the sparrow lands beside them, the flock lands **on** them — shoulders, and for
  the trio the head. Under `prefers-reduced-motion` they hold those same settled poses.
- Companions are **procedural, not generated**: a generated bird is a fused mesh whose wings
  cannot hinge, and the avian auto-rig has no flight preset to retarget — the
  generated-asset budget belongs to static hero props like the wardrobe.
- **A tier's presence never adds a slot to the appearance vocabulary.** It is carried by the
  companion and the weighting of traits the character already has — never by a new wearable
  (a crown, a cape, a pet *item*) added for the tier alone. A new slot has to be drawn,
  validated, persisted, fitted to every height / build extreme and checked against every
  instrument pose, and it makes the tier a costume instead of a rarity. Upgrades go into what
  is already there. (The companion is scenery attached to the character, not a drawn,
  persisted trait — the saved config still carries only `tier`.)

### Persistence

- `av2.mascot.v4` is the source contract (§7). Prior mascot keys are not migrated. A malformed field falls back independently and never invalidates the whole look.
- Storage is written **at the reveal**, not on a later confirm. There is no draft: the pull the visitor is looking at is the pull they have.
- Preview rotation angle is session-only and never part of the saved appearance.
- The stage must keep working if `v4` is removed or storage is unavailable; fall back to defaults without blocking entry.

### Accessibility and framing

- Derive the framing rectangle from `visualViewport`, safe-area insets, HUD bounds, and the measured card bounding box — never a width breakpoint plus hard-coded camera offsets. Refit on open, resize, orientation change, `visualViewport` change, and when the card appears.
- Offset by shifting the camera look target, never by lowering the camera with its target, so the stage floor cannot occlude the subject at any height / build value.
- The complete relevant bounds stay inside that rectangle with at least `16 px` margin, hair and shoes included.
- Minimum target **48 × 48 CSS px** for the card's controls. The modal uses `role="dialog"`, `aria-modal="true"`, an accessible title, a focus trap and an inert background.
- A polite `aria-live` status announces the start of the ceremony and then the tier and name — never per frame.
- Background stage controls are disabled while open; gestures never leak into raycasting, walking, orbit, zoom or instrument play.

### Acceptance

- Validate at `320×568`, `390×844`, `430×932`, `844×390`, and `1280×720`. The character never intersects the card or the HUD.
- The full ceremony renders at the display frame rate, not the 15 fps modal budget.
- On a first run the **mascot is never visible at any point before the reveal** — not during the fly-in, not for a single frame — and the wardrobe is on stage at full scale throughout the approach.
- The wardrobe presents its front to the camera at **every** azimuth, and the ceremony still completes with the generated shell missing (procedural fallback).
- The camera moves **zero units and turns zero degrees** on the frames where the ceremony takes over from the approach, and the instruments never disappear.
- Closing the card moves the camera **not at all**: the reveal pose already satisfies every OrbitControls limit, so control passes across without a correction. The only motion afterwards is the standard damped follow-settle.
- **ЗРОЗУМІЛО** writes `av2.onboard.v2` and no second tip follows; closing with **✕** leaves it unwritten so the tip appears next visit.
- **A 20-pull stress pass creates no additional geometries or textures** (`__THREE_GAME_DIAGNOSTICS__.renderer`) and causes no visible frame hitch.
- Reload after a reveal restores the same character. **Esc** mid-strain leaves storage untouched, restores the previous look, and returns bloom to its base — an abandoned ramp must never leave the stage permanently over-bloomed.
- The first-run gift creates **no `AudioContext`** (no user gesture has happened yet) and still completes normally.
- Every tier is reachable via `?gift=`, renders its accent, is named, and reports `stage-gift-<tier>` into `window.__av2Events`. A common draw runs the same ~7 s ceremony as a legendary.
- The tier mark is visible on stage after the card closes for rare and above, absent for common, and never visible before the burst. Switching tier via `applyMascotConfig()` adds **zero** geometries and textures to `__THREE_GAME_DIAGNOSTICS__.renderer`.
- All drawn combinations stay readable at the height / build extremes and do not detach hands, pointer label, fall scaling, or instrument poses. Test idle, walk, dance, fall, and each instrument focus pose.
- Keyboard-only and screen-reader passes can identify the dialog, the tier, the character, and both actions. Focus never escapes behind the dialog.

## 14. Change checklist

When changing behavior:

1. Update code + `?v=` cache query.
2. Update this `SPEC.md` if contracts or UX change.
3. Push to `main` (Pages deploy) and verify live HTML contains the new `?v=` and expected markup (`onboard`, pricing mixer, chord wheel, settings mixer, etc.).
