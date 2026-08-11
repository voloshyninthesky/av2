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

Slogan: *Вчись творити і твори навчаючись.*

---

## 1. Product goals

1. Let a visitor **feel the studio** (stage, instruments, sound) in under a minute.
2. Teach play in two complementary ways:
   - **Pointer / touch:** approach an instrument, then play while focused.
   - **Desktop keyboard:** jam **several instruments at once** from disjoint hotkeys — focus is optional for keyboard sound.
3. Convert interest into a booking path: **ціни / як записатися → Instagram або Messenger**.

Non-goals: accounts, payments, CMS, sample libraries, native apps.

---

## 2. Brand

| Token | Value |
|-------|--------|
| Purple | `#9E33CA` |
| Gold | `#D1A13B` |
| Cream | `#FDFBF7` |
| Ink | `#17121c` |
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
  mascot/           # appearance, model state, poses, walk collision, editor, per-frame update
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

**Audio buses:** `drums` | `piano` | `guitar` | `mic` → master. Default guitar level **0.6** (40% quieter than the others). Every mixer fader displays **0–100%** and reaches a gain of 2.0 at 100%; defaults remain at 50% for drums, piano, and vocals, and 30% for guitar.

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

| Kind | Pointer / touch play | Desktop keyboard play |
|------|----------------------|------------------------|
| `mic` / vocal | Vocal pad / mesh hits **only while mic-focused** | `N M , . /` → ДО РЕ МІ ФА СОЛЬ (hold to sustain; see §5 Desktop keyboard jam) |
| `guitar` | Two-hand chord + strum / pluck **only while guitar-focused**. Six **visitor-chosen** chord slots (✎ → quality × root picker) | Chord row `Q W E R T Y` = pad slots 1–6 + Space strum — works **with or without** guitar focus; focused it is select-only, see § Guitar performance mode |
| `piano` | Mesh keys + `#piano-pad` **only while piano-focused** (multitouch). Hold sustains; release / cancel / exit / mute / background releases. Cabinet / lid / bench do not play. | `1–8` whites — with or without piano focus. **Piano-focused only:** `A–L` + upper row, real-keyboard shape (§ Piano interaction roadmap) |
| `drums` | Kit parts **only while drums-focused** (multitouch) | `Z X C V B` kit — with or without drums focus |

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
- This layout **takes priority over the global guitar-chord map** for the four letters they share (`W E T Y`) — for as long as piano focus holds, those keys strike piano notes instead of `Am / C / G / F`. `Q` and `R` are untouched (guitar's other two chord letters) since the piano layout has no use for them. Leaving focus restores the global chord map on those keys immediately.
- The global `1–8` digits keep working too, focused or not — this layout is additive, not a replacement.
- Held notes, sustain, and release follow the same rules as pointer/pad play (§ above); `keyup` / focus-exit teardown is shared with the `1–8` path.

#### Piano interaction roadmap

These items are planned, but they are not blockers for the current framing / pose milestone:

1. **Reliable key surface:** piano-local hit plane, dead-gap removal, black-key priority, captured pointers, held key state, ordered glissando, and robust multi-finger chords.
2. **Gesture ownership:** a pointer on keys, drums, guitar strings / frets, or the chord pad claims that finger so OrbitControls cannot rotate or zoom from it; empty canvas still orbits / pinches. Loop-pedal + key multitouch stays supported.
3. **Performance feedback:** one piano-note event driving audio, key travel, glow, note-following hands, VIBE, haptics, and loop capture; at least `16` voices and click-free same-pitch replacement. First play queues a once-per-instrument price chip shown after leaving focus.
4. **Discoverability and access:** an accessible DOM `#piano-pad` strip for `C4–C5`. Desktop `#keys-hint` advertises the `1–8` jam digits, since those work without focus and the real-shape layout does not. (A first-focus how-to hint was built and removed; `notes/Decisions.md` has the reasoning.)
5. **Expressive controls still open:** sustain pedal, MIDI input, velocity-sensitive touch / pen input, and selectable octave (the two-octave keybed itself now has a focused computer-keyboard mapping — see above — though it covers C4–D5, not the full two octaves).
6. **Learning layer:** optional guided phrases, hand-separated exercises, metronome, and note-name overlays. These may read `piano-notes.json`, but focus itself remains silent.

### Guitar performance mode

The primary mental model is **two hands**: the fretting hand chooses the sound; the picking hand creates it. Chord / fret input alone stays silent.

- **Pointer / pad / mesh guitar input** is accepted only during stable guitar focus — never while idle, approaching, entering, returning, or focused on another instrument.
- **Desktop keyboard** chord + strum keys follow the global jam map (§5): they may sound while idle, while focused on any instrument, and during approach / enter / return camera moves. They stay silent only when the stage has not started, a modal is open, or the event target is editable / a control.
- **The QWERTY row addresses pad *slots*, not chord names.** `Q W E R T Y` map to pad positions 1–6 in both modes. Position is the only unambiguous handle once chords are generated (`C`, `Cm`, `C7`, `Cm7` and `Cmaj7` all start with `C`), so a chord's name never determines its key.
- **Focused, those keys are select-only.** While guitar is focused, pressing a chord key arms the chord **silently** — exactly like holding its on-screen pad — and Space (Shift+Space upstroke) strums it; releasing returns to open strings. That is the two-hand model above, applied to the keyboard. **Unfocused**, the same key still selects *and* strums immediately, because there is no visible pad to read and a silent arm would look broken.

#### Chord slots and the chord maker

The pad has **six slots**, and which chord sits in each is the visitor's choice.

- **Chords are generated, not listed:** 12 roots × 5 qualities (major, `m`, `7`, `m7`, `maj7`) = **60 chords**. A quality is defined by its intervals above the root, and the fret shape comes from sliding one of two open forms (root on the low E string, or on the A string) up the neck — which is what a movable barre chord already is. The lower of the two positions wins, so nothing reaches past fret 8.
- Every generated voicing must sound **exactly** its chord tones — no extra notes, none missing. This is checkable in Node against the intervals and the open-string pitches, and should be, since a wrong shape is silent-but-wrong.
- A table of **preferred open voicings** overrides the generated shape for the chords a beginner reaches for (`E Em Em7 A Am Am7 C Cmaj7 D Dm D7 G G7 F B7`). Purely a tone choice: the generated form is correct too, just thinner and higher up.
- **Editing:** ✎ on the pad arms slot-editing (a separate mode, because *holding* a chord button is already the play gesture). Tapping a slot opens a picker of **quality × root** — 5 + 12 controls rather than 60 — which opens on the slot's current chord. A chord already sitting on another slot cannot be picked twice.
- Slots persist in `localStorage` `av2.guitar-chords.v2`, with **per-slot** fallback: an unknown or corrupt entry restores that one slot's default (`Em Am C D G F`) rather than discarding the layout.
- A swap clears any held / latched / key-armed chord, so pad state and sound never disagree, and rewrites the QWERTY row in place — every module reads the same object.
- Global instrument shortcuts ignore key events originating from buttons, links, form fields, or editable content; the focused control handles those events itself.
- Focus is a **player's view**: during the entry transition the guitar lerps off its stand into the mascot's hands — held against the chest, low E nearest the viewer, face tipped up toward a steep overhead camera (the stand fades out; on exit both lerp back). A measured fitter frames the strings band from nut to below the bridge, reserves the chord-pad gutter, opens **two `+` zoom steps inside the fit**, and refits on resize / orientation change.
- **The camera azimuth follows the viewport**, because a guitar is long and thin and a diagonal one wastes the frame: each orientation lays the instrument along the screen's long axis. Landscape / desktop is the guitarist's own **first-person view** — looking down from behind the head, neck to the screen left, low E nearest the viewer — so strings read horizontally (strum = vertical swipe). Phone portrait stands the guitar up — body low and to the right, neck rising, mascot head at the left edge — so strings read vertically (strum = horizontal swipe). Strum detection works in guitar-local space, so it is unaffected by which framing is active.
- The held pose adapts to mascot customization: the whole hold rides the mascot's chest — height with the height scale, and the forward/side offset with the build scale, so a broad build carries the guitar forward with it instead of leaning its face through the soundboard — while a bigger body also steps farther back.
- **The mascot can never block or clutter the strings.** Tall or wide builds physically overhang the play band, and a headless body seen from inside reads as floating debris — so in the landscape first-person view, whenever the camera→strings sight line passes through the head's hair shell, the whole mascot is hidden and only the held guitar remains (you are looking out of that body). Hysteresis keeps the boundary from flickering; orbiting away from the sight line, portrait, and every non-guitar phase bring the body straight back.
- In portrait (and while the body is visible) the mascot and guitar must read as one performance pose: fretting hand along the neck, strum hand over the soundhole. String motion and strum-arm motion carry the action; whole-body guitar wobble stays subtle.
- Use separate guitar-local raycast proxies for approach, strum, and fret selection (all pose-invariant: they ride the guitar body). A pointer captured by a play zone or by the chord pad cannot orbit / zoom the camera until it ends.
- Start from a composed focused frame, then leave horizontal orbit available from empty canvas within the fitted distance / pitch envelope (pinch / wheel zoom included).

#### Strum and pluck

- An enlarged invisible strum plane surrounds the soundhole (at least `120 × 160` CSS px on a supported phone). A stroke may start just outside the string fan.
- Only motion mainly **across** the strings counts. Motion along the strings, a body tap, headstock tap, or slow orbit gesture stays silent.
- A stroke excites every crossed, non-muted string exactly once, at its interpolated crossing time. Bass → treble and treble → bass preserve opposite string order.
- Reversal starts a new stroke only after direction hysteresis; moving outside the play zone cannot keep retriggering.
- Gesture speed — not accumulated distance alone — controls level, attack brightness, decay, and inter-string spread. A soft stroke and hard stroke must be clearly different without clipping.
- A fine-pointer tap on one explicit string plucks that string using the active chord / fret state. It does not fall back to a whole-chord strum; touch string picking belongs to the assisted Solo mode.

#### Chords and fretting

`#chord-pad` uses six-string voicings ordered low E → high E; `×` is muted:

| Chord | E | A | D | G | B | e |
|-------|---|---|---|---|---|---|
| Em | 0 | 2 | 2 | 0 | 0 | 0 |
| Am | × | 0 | 2 | 2 | 1 | 0 |
| C | × | 3 | 2 | 0 | 1 | 0 |
| D | × | × | 0 | 2 | 3 | 2 |
| G | 3 | 2 | 0 | 0 | 0 | 3 |
| F | 1 | 3 | 3 | 2 | 1 | 1 |

- The chord pad is laid out like a real guitar during focus: a **vertical rail on the left** (fretting hand) on landscape / desktop, with the strum zone to the right (picking hand); on portrait it stays a bottom row, sitting lower than the vocal pad and offset left of the zoom column so the two never overlap. The guitar fitter reserves that gutter so chords never cover the strings.
- **Touch:** tap a chord to latch it for one-finger playing, or hold it with one pointer and strum with another. A quick tap on the string fan plucks the nearest string. Releasing a genuinely held chord returns to the previously latched chord (or open strings); cancel, exit, background, or lost capture clears transient holds.
- **Fine pointer / pen:** clicking a chord latches it so the same pointer can strum repeatedly; clicking it again clears it.
- **Desktop keyboard (jam map):** hold the QWERTY top row — `Q` / `W` / `E` / `R` / `T` / `Y` — for Em / Am / C / D / G / F. Pressing a chord key also **strums it immediately** — on a computer keyboard the chord key is the play gesture, so the two-hand rule applies to touch/pad input only. Key release returns to open strings. Space re-strums (downstroke); Shift+Space is an upstroke. Mascot movement is not bound to keyboard keys; it uses click-to-move or the mobile joystick.
- Chord buttons expose visible focus, `aria-pressed`, and `aria-keyshortcuts` (matching the jam map); color is not the only signal.
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

### Mascot

Low-poly avatar labeled «Ти» (matched skin hands on both arms; no jacket-panel “fake hand”). Starts **downstage, nudged stage-left toward the guitar, inside the key spotlight pool** (`MASCOT_START`, also the fall respawn point), held back off the footlight row so those point lights cannot blow the costume out; the guitar sits in easy reach with every other instrument behind the visitor. Walk with click-to-move on the floor or the mobile stick. Can fall off stage edge (short recovery). Instrument focus poses or seats the mascot and reframes the camera.

**Customization** (HUD person icon button next to the settings gear → `#modal-mascot`): three categories **ОБЛИЧЧЯ / ОДЯГ / ФОРМА** with deliberately small, curated groups: four authored hairstyles (**Довге / Боб / Коротке / Мінімум** — side-swept fringe, blunt-fringe bob, clean crop, and bald with every hair piece hidden so the skin-toned scalp shows through; a shared fringe shell is restyled per hairstyle, and each style also places its side locks, which must fall beside and behind the jaw so long hair never reads as a beard), three smiles (**Легка / Широка / Стримана** — Широка is an open singing mouth with teeth, Стримана a calm closed lip with a hint of curve; default is Легка), five hair colors (also recolor brows), three eye colors (dedicated iris material; glasses/badge ink stays shared), four skin tones (**Теплий / Світлий / Золотий / Чорний**, applied to face and both hands), four coherent varsity palettes (**Сцена / Фірмовий / Джинс / Ніч** — matched sleeves, base + one primary + one accent on a placket / chest-stripe / hem-band / cuffs garment), four-option primary and accent overrides, a shoe-color override (**З ПАЛІТРИ / Чорні / Білі / Червоні**), four accessories (**немає / сережки / окуляри з дужками / навушники**), and height / build sliders. Removed legacy values (`buzz`, `tied`, `sunset` palette, `chain`, `cap`, the `blush` field, skin tones 1/2/6, dropped colors) fall back per-field to defaults when loading an older save. The procedural parts are created once and toggled or recolored in place. **РАНДОМ** chooses a compatible look; horizontal drag remains the sole orientation control.

Only the mascot's major masses cast shadows (torso, neck, face, hair, limbs, shoes). Trim, stripes, collar, eyes and pins are excluded: they add nothing to the shadow map and would roughly double the shadow-pass draw calls now that the mascot stands in the key light. The guitar and mic follow the same rule inside that pool.

Opening the editor creates a draft. Changes apply live to the 3D mascot; **ГОТОВО** commits them to `localStorage` `av2.mascot.v3`, while **✕ / Esc** restores the opening appearance. **СКИНУТИ** resets the draft and exposes **ПОВЕРНУТИ**. The measured unobscured canvas rectangle—not a fixed breakpoint offset—frames either head / shoulders or the full body around the actual HUD and panel bounds. Horizontal preview drag rotates the mascot without moving the stage camera. The camera returns to its saved frame on close. Instruments and stage hints are temporarily hidden so they cannot obscure the preview. Background controls are inert, and backdrop taps never close the editor.

Opening the editor while an instrument is focused leaves that focus immediately (no return animation): the instrument settles into its resting pose (the guitar drops back onto its stand) and the camera snaps straight to its pre-focus stage frame before the editor's own preview camera takes over. That snap must land exactly on the saved frame — any orbit drag made just before opening the editor must not leave a residual offset — since the editor saves this exact position as the frame to restore on close.

**Dance** (click the HUD logo): toggles a **tektonik** routine — procedural 8-beat loop (overhead arm sweeps + bounce, full spin on the last two beats). Limbs relax smoothly on stop. Walk input, instrument approach, or a stage fall stops the dance.

---

## 5. Interaction map

### Desktop keyboard jam

On desktop (fine pointer / hover-capable, not the mobile game shell), the computer keyboard is a **multi-instrument jam surface**. After Enter, with no modal open and the event not from an editable / button target, instrument maps stay live **regardless of which instrument is focused** (including idle / walking). Pointer and on-screen pads remain focus-gated as today.

**Why this layout:** mascot movement stays pointer/touch based, leaving the desktop keyboard free for instruments and approach (`Enter`).

| Layer | Keys | Behavior |
|-------|------|----------|
| Walk | Arrows + `W` `A` `S` `D` | Idle only; ignored while any instrument view phase ≠ `idle`. `W` forward, `S` back, `A` left, `D` right (same as arrows). |
| Approach | `Enter` | Idle only → nearest instrument in reach (no auto melody) |
| Loop | `L` / Shift+`L` | Pedal toggle / clear (after unlock rules unchanged) |
| Piano | `1`–`8` | White keys C4–C5; press-and-hold sustains; multi-key chords OK |
| Drums | `Z` `X` `C` `V` `B` | kick / snare / hihat / tom / crash |
| Guitar chords | `Q` `W` `E` `R` `T` `Y` | Em / Am / C / D / G / F — press strums the chord immediately and holds it; release → open strings |
| Guitar strum | Space / Shift+Space | Downstroke / upstroke using the active keyboard (or pad) chord |
| Vocal | `N` `M` `,` `.` `/` | ДО / РЕ / МІ / ФА / СОЛЬ; hold sustains like the vocal pad |

Rules:

1. **Simultaneous:** held piano notes, drum hits, a held guitar chord + Space strums, and a held vocal may all be active in the same window. Audio buses already mix; do not mute sibling instruments when one receives a key. Walk keys never steal instrument codes.
2. **No focus required for keyboard sound.** Focus still reframes the camera, shows pads, and enables mesh / pad pointer play.
3. **One owner per physical key.** Never bind the same `KeyboardEvent.code` to two instruments or to both walk and play.
4. **Release hygiene:** `keyup`, window blur, visibility hidden, and focus exit clear held piano notes, keyboard guitar chord, and held keyboard vocal for that session path. Walk key sets clear on `keyup` / blur as today.
5. **Price chips:** first audible play of an instrument (keyboard or pointer) still queues the once-per-instrument chip. If that play happened without focus, show the chip after the visitor next leaves any instrument focus, or after ~2 s of silence from that instrument if they never focused it.
6. **`#keys-hint` (desktop-only):** reflect the jam map, e.g. клік · `Enter` · `L` · `Z X C V B` ударні · `1–8` піаніно · `Q W E R T Y`+пробіл гітара · `N M , . /` вокал.
7. **Mobile unchanged:** no jam keyboard; pads + focused multitouch only. Hide `#keys-hint` as today.

### Desktop

| Input | Action |
|-------|--------|
| Click floor / mobile joystick | Move mascot (idle) |
| Click instrument | Approach if not focused; mesh / pad play only when focused |
| `Enter` while idle | Approach nearest instrument in reach (no auto melody) |
| Drag / wheel / `+` `−` | Orbit / zoom (buttons stay visible while focused) |
| `Z` `X` `C` `V` `B` | Drums (jam — any focus / idle) |
| `1`–`8` | Piano whites (jam — hold sustains) |
| `Q` `W` `E` `R` `T` `Y` | Guitar chord strum + hold (jam) |
| Space / Shift+Space | Guitar downstroke / upstroke (jam) |
| `N` `M` `,` `.` `/` | Vocal notes (jam — hold sustains) |
| Drag across strings while guitar-focused | Directional guitar strum (pointer) |
| `L` | Loop pedal (after first VIBE fill unlock) |
| HUD logo click | Toggle mascot tektonik dance |
| Esc | Close settings mixer (does **not** dismiss the onboarding tip or leave instrument focus) |
| ✕ (`#mobile-exit`) | Leave instrument focus (desktop + mobile) |

### Mobile

- Small left **move zone** + floating stick under finger.
- **By default (КАМЕРА → Вільна, § Камера) one finger orbits** and two fingers pinch to dolly. Choosing **Не дуже** swaps one-finger orbit for the older one-finger pan with scout-and-spring-back. The mascot stays followed either way.
- **ГРАТИ** when in reach → approach / focus. Outside reach it stays visually disabled but remains an accessible tap target: the first unavailable tap shows, once, `Підійди до інструмента ближче щоб заграти`.
- ✕ exit when entering / focused, never during approaching. Two guards rather than a timing window: ✕ stays hidden while `approaching`, and the **ГРАТИ** press arms a **one-shot** swallower for the single click the browser synthesizes after it — otherwise that click lands on ✕, which takes the same pixels once the play button hides, and cancels the approach the same gesture just started. A keyboard activation (`detail === 0`) is never swallowed.
- Leaving any instrument focus must reset the floating joystick, thumb, active pointer identity, and movement vector before the walk controls return. This includes a lost / cancelled iOS pointer while the joystick is hidden during guitar focus.
- Touch instruments when focused (multitouch piano / drums; chord hold + independent strum / pluck for guitar).
- Focused piano / drums / guitar play surfaces claim their fingers: taps and glissandi / strums play without rotating or pinching the camera. Orbit and pinch stay available from empty canvas around the instrument.
- **Pedal / pads + instrument multitouch:** one finger on loop pedal, chord pad, vocal pad, or other HUD chrome and another on the kit/keys/strings must both work. Chord-pad presses also claim their finger so they cannot drive orbit. Do **not** `preventDefault` multitouch `touchstart` when any finger is on UI chrome (that drops the second finger’s pointer events). Loop pedal binds **`pointerdown`**, not `click`.
- Chord pad while guitar-focused; vocal pad while mic-focused.
- HUD collapses to menu drawer on small screens.
- Keyboard key legend (`#keys-hint`) and drag hint are **desktop-only** — hidden on phones and tablets (`max-width: 720px` or coarse pointer / no hover).

### VIBE meter

Playing adds vibe. Each play route carries a nominal weight (drums `4`, guitar strum `5`, piano `3.5`…) which are **relative** values; a single `VIBE_NOTE_GAIN` scales all of them, so how long a full meter takes is one number rather than eight call sites. **Reaching 100% is a one-way door**: fireworks, the loop-pedal unlock, and the announcement fire exactly once, and the meter then *stays* full for the rest of the visit — it never settles back to be re-earned, and the idle decay stands down. Because the maxed state is now permanent, its flash is a finite burst that settles into a brighter steady rail rather than an endless strobe. The maximum-vibe toast appears below the HUD, never over instrument pads, and claims its own taps so it cannot trigger browser double-tap zoom. Below 100% the meter decays when idle. Passing `12%`, `40%` and `60%` cheers once each (§9 Praise).

### Loop pedal

Unlocked once after first vibe fill. Record layers while playing; pause / clear tools. Key `L` on desktop. Must remain usable while another finger is playing an instrument. A vocal-pad hold records its actual sustained duration; if recording or overdubbing begins while a vocal is already held, capture starts at the pedal press and continues until release or loop closure.

---

## 6. UI overlays

| Overlay | Purpose |
|---------|---------|
| Intro | Brand splash; **ВИЙТИ НА СЦЕНУ** starts the visual fly-in while audio stays dormant. A reload / same-tab return bypasses the splash and also leaves audio dormant until a real sound action. |
| Onboard | Second step of the first run, after mascot customization: one tip (`localStorage` `av2.onboard.v2`) dismissed only by **ЗРОЗУМІЛО**; mic pulse cue |
| HUD | Logo (click = mascot dance), VIBE, **pricing button** (gold graduation-cap icon, **Уроки та ціни**), **mascot button**, **settings mixer** (gear) |
| Settings mixer | Opens from the gear (**Налаштування**): **Світло** fader (0–100%, `av2.lights.v2`, default `78`; **GLAMOUR** defaults to `67` and **PIXEL** to `100` when unset), **Гучність** with per-instrument faders (0–100%; 100% is boosted gain), then the **Камера** selector and the minimal **Графіка** selector |
| Modals | **Mascot customization**, graphics-reload confirmation, steps, rules, **interactive pricing mixer**, **sign form** (`#modal-sign`, § Signs — reachable from the below-HUD marker button when storage is alive) |
| Chord / strum / vocal pads | Instrument play helpers while focused |
| Chip | Once-per-instrument price teaser: a compact tag-style pill reading as one line — instrument emoji + «Уроки» + a CTA button carrying the price, «від N зл ›» — fading in/out softly. The price is the CTA label; there is no separate «ЦІНИ» word. Before `prices.json` lands (or when an instrument has no single lesson) the button reads «в Art Vibe ›» and is rewritten in place the moment the file arrives. **Placement:** on desktop it hangs under the HUD's lessons-and-prices button, their right edges aligned (measured on each show, so it follows the nav when the sign button appears); at the phone breakpoint it stays bottom-centre, above the pads. **N is that instrument's own cheapest single lesson**, read from `prices.json`. Its full non-control surface opens its CTA; carousel arrows are hidden chrome — swipe still changes slides (the hidden arrow buttons are driven programmatically). The chip is queued on first play (pointer or keyboard), shown after leaving that instrument's focus — or after ~2 s of silence from that instrument if the play was keyboard-only without focus. **A shown chip buys a 3-minute global quiet period** — however it ended (read, dismissed, or timed out on its own) — before the next one, of any instrument, is allowed to show; a visitor who quickly samples several instruments gets one nudge at a time. Skipped on fall, instrument switch, and mascot-editor leave. |
| Toast / tooltip | Short feedback |

### Графіка

- The settings mixer (gear icon) contains a minimal inline **ГРАФІКА** selector below the volume faders: **GLAMOUR**, **PIXEL**, and **AUTO**. Internally they retain the persisted values `high`, `low`, and `auto` in `localStorage` key `av2.quality.v2`.
- Choosing a different option opens the **Змінити якість графіки?** confirmation modal, which states that the page will reload. **СКАСУВАТИ** leaves the current mode unchanged; **ПЕРЕЗАВАНТАЖИТИ** immediately shows a spinner and **Застосовуємо зміни…**, locks the selector, then reloads the scene with that quality budget.
- **AUTO** uses a two-stage frame-pacing probe on every device (desktop, iPhone / iPad, and Android). It begins without expensive shadows or postprocessing, promotes only sustained smooth devices, and returns to the stable low budget if full effects miss cadence.
- A tier switch is **never applied while the intro fly-in is running** — the probe keeps sampling and the verdict waits for the camera to land. Switching rebuilds every lit material's shader program, and the frame loop pauses while the driver links them in the background, so the cost lands as a short hold on a still camera instead of a multi-second stall mid-zoom. AUTO also fetches the postprocessing modules during boot, so a later promotion never waits on the network.
- **GLAMOUR** and **PIXEL** are explicit overrides. PIXEL is the stable 30 FPS, no-shadows / no-bloom budget; GLAMOUR enables the full scene budget.
- A live horizontal **Світло** fader sits at the top of the settings mixer (gear icon → **Налаштування**) and scales stage lights, footlight emissives, and beam opacity from **0–100%** without a reload. The value persists in `localStorage` key `av2.lights.v2` (default `78`); on **GLAMOUR** the default is `67` and on **PIXEL** `100`, each only when no saved light preference exists — GLAMOUR carries bloom, which turns the brighter stage into glare inside a close-up. Instrument volumes remain in the same panel below the light fader.

### Камера

- The settings mixer carries a **КАМЕРА** selector directly above **ГРАФІКА**, with two options persisted in `localStorage` key `av2.camera.v1` (**default `free`**). `?camera=follow|free` overrides it for a single load. The labels are **Вільна** and **Не дуже**, in that order and in that casing — the second reads as an answer to the first, so reordering them or shouting them in caps breaks the phrase.
- **Вільна** (`free`, the default) frees the **angle, not the subject**, on every device: one pointer — mouse drag or one finger — rotates, two fingers pinch to dolly, panning is off, and the pitch opens to roughly **25°–93°**, enough to read the stage from overhead and to get behind the backdrop.
- **Не дуже** (`follow`) is the calmer opt-out — the original framed camera: the pursuit rig keeps the mascot composed low-centre, a drag temporarily scouts, and the spring recentres on release. Mobile pans on one finger, desktop orbits, pitch stays at **40°–84°**.
- **The mascot stays in frame in both modes.** The follow spring runs underneath Вільна too, and must: it applies one delta to *both* `controls.target` and `camera.position`, so it is a rigid translation that leaves azimuth, polar and distance untouched and cannot disturb an orbit. The only gesture it ever pulled against is the mobile pan of Не дуже, which is why that mode suspends it while scouting and Вільна — having no pan — never needs to. **This is what makes `free` safe to default to:** a free camera that dropped the spring would let a first-time visitor walk their mascot off-frame with no way back except changing a setting they have not found yet, and would strand them after a fall-respawn.
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

### `av2.mascot.v3` (localStorage)

Mascot customization, merged over defaults and validated on load (unknown / malformed values fall back per field). Older `av2.mascot.v1` / `av2.mascot.v2` values are intentionally ignored so a key bump resets appearance for returning visitors:

```js
{
  hair: "long",             // "long" | "bob" | "short" | "buzz" | "tied"
  hairColor: "5a2f22",      // 6-digit hex, no '#'
  smile: "neutral",         // "soft" | "wide" | "neutral"
  outfit: "stage",          // "stage" | "vibe" | "denim" | "night"
  outfitPrimary: "default", // "default" | "purple" | "gold" | "denim" | "ink"
  outfitAccent: "default",  // "default" | "purple" | "gold" | "cream" | "green"
  skinTone: "tone-3",       // "tone-1" … "tone-7"
  accessory: "hoops",      // "none" | "hoops" | "glasses" | "headphones"
  height: 100,              // percent, 70–145
  width: 100                // percent, 65–150
}
```

### First-run UI state (localStorage / sessionStorage)

- `av2.onboard.v2` gates the whole first-run sequence (mascot customization, then the tip) and is written only by **ЗРОЗУМІЛО**. Leaving before that click replays both steps on the next visit.
- `av2.guitar-chords.v2` holds the six chosen chord-pad slots (§ Chord slots and the chord maker); unknown names fall back per slot.
- `av2.mobile-play-hint.v2` records the one-time unavailable-**ГРАТИ** proximity hint.
- `av2.sign.v1` holds the visitor's last stage sign (`{ text, color, ts }`): prefill plus the rolling 24-hour gate.
- `av2.intro.v2` (`sessionStorage`) records that the splash was already entered in this tab so a same-tab reload can skip the intro.

---

## 8. URL query flags

| Param | Effect |
|-------|--------|
| `nointro` | Skip splash; land on stage + HUD |
| `autoenter` | Auto-click enter after load |
| `skiponboard` | Never show the first run — no mascot editor and no tip |
| `shot=pricing\|rules\|steps\|chip\|toast` | Open overlay / demo UI |
| `anchor=vocal\|guitar\|drums\|piano` | Preselect pricing instrument |
| `sstime` | Slideshow timing override (debug) |
| `camera=follow\|free` | Force the stage camera for one load, ignoring `av2.camera.v1` (does not persist) |
| `testhooks` | Headless QA only: exposes `__THREE_GAME_TEST_HOOKS__` (setState: stage/piano/guitar/drums/mic/vibe/dance, debug `pick(clientX, clientY)` raycast listing, a `scene` handle for isolation toggles, a `state` snapshot of the view / walk / mascot / camera-distance limits, and `captureFrame()` for synchronous canvas capture) + `__THREE_GAME_DIAGNOSTICS__` (renderer counts) for the canvas inspector; never active for visitors |
| `headless` | With `testhooks` only: pumps the frame loop from a worker interval so hidden/backgrounded QA tabs still simulate and render |

`testhooks`, `headless` and `shot` also stop analytics events being **sent** — QA
runs drive the funnel deliberately and must not land in the dashboard. Events are
still recorded into `window.__av2Events`, which is how headless checks assert them.

---

## 9. Onboarding

**Two steps, in this order,** once the camera fly-in lands:

1. **Mascot customization** opens on its own (`#modal-mascot`, §Mascot). The visitor leaves it by any of its normal routes — **ГОТОВО**, **✕**, Esc.
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
- Every live play route reaches `addVibe(n)`; the vocal pad and keyboard vocal call it directly rather than through `playMusicalEvent`.

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

| Event | Fires |
|-------|-------|
| `stage-enter` | Scene starts. **Not** a click — the stage auto-enters when assets finish loading, so this reads as "session started", not "button pressed" |
| `stage-first-play` | First note on any instrument (all play routes funnel through `addVibe`) |
| `stage-pricing-open` | Pricing overlay opened by any route |
| `book-{instagram\|messenger}-{home\|vocal\|guitar\|piano\|drums\|stage}` | Outbound booking link clicked |
| `book-{instagram\|messenger}-pl-{home\|vocal\|guitar\|piano\|drums\|privacy}` | The same, from a Polish page (§3 Polish pages) |
| `stage-sign-left` | A sign was accepted onto the stage (at most once a day per device by construction) |

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
- **A control never has its `touchend` cancelled.** Cancelling it suppresses the synthesized `click`, and for every `click`-bound control — the whole HUD — that click *is* the activation. Double-tap suppression is therefore proximity-gated (two taps within `320 ms` **and** `44 px`) and skips interactive elements entirely; those carry `touch-action: manipulation`, so the compositor already refuses to zoom from them.
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
- **Desktop keyboard** guitar chords (`Q W E R T Y`) and Space / Shift+Space follow the jam map: they may sound while idle or while focused on any instrument, and must remain silent only when the stage has not started, a modal is open, or the event target is editable / a control.
- A complete stroke excites each crossed eligible string once and in directional order; motion along the strings stays silent. Muted strings neither sound nor animate.
- Soft and hard strokes are audibly distinct. Reversing direction can immediately produce the reverse string order without false retriggers.
- Twenty consecutive chord-hold + second-pointer strums work on supported iPhone Safari and Android Chrome without page zoom, orbit motion, lost pointers, or a stuck chord.
- Chord targets are at least `48 × 48` CSS px with `8 px` separation on roomy viewports, never dropping below `42 px` on the narrowest phones, and never overlap the zoom column or loop pedal. The strum zone remains usable at the smallest supported viewport and after portrait / landscape changes — including the orientation-dependent guitar framing, where a stroke crosses the strings horizontally on portrait and vertically on landscape.
- Pointer cancel, focus exit, visibility loss, and page backgrounding clear every held chord, active stroke, and captured guitar pointer.
- Repeated guitar focus → ✕ exits on iPhone Safari restore the joystick to its non-floating home state; a lost joystick pointer-up may never leave only the blurred stick backdrop behind.
- Input-to-audio scheduling is at most `16 ms`; target measured input-to-audible latency is at most `50 ms` desktop and `80 ms` on reference mobile devices.
- Audio and per-string visual onset differ by at most `33 ms`. Reduced motion removes idle shimmer, not essential play feedback.
- A physical string has at most one active voice; retrigger and mute ramps do not click. First play performs no synchronous synthesis-table generation in the input handler.

### Desktop keyboard jam acceptance

- After Enter on a desktop viewport, with no modal open, holding `1` + tapping `Z` + holding `Q` and pressing Space produces piano + drum + guitar audio in one gesture sequence without focusing any instrument.
- Holding `N` (vocal) together with `3` (piano) and tapping `X` (snare) keeps all three buses audible; focusing piano must not silence drums / vocal / guitar keyboard routes.
- Mascot movement has no keyboard bindings: use click-to-move or the mobile joystick. No `KeyboardEvent.code` is shared across the **global** approach, loop, piano, drums, guitar, or vocal maps (`Enter` is approach-only while idle; the QWERTY row belongs to guitar, so slot 1 is `Q` and `E` is slot 3). The one **focus-only** layer — the piano's `A–L` + upper row — deliberately reuses four QWERTY chord letters (`W E T Y`) and wins over them for exactly as long as piano is focused; that shadowing is scoped, deterministic, and reversed on exit. Guitar focus adds no letters of its own: it reuses the same QWERTY row and only changes what a press *does* (select, not select-and-strum).
- A visitor can hold `W` to walk and tap `Z` / `1` / Space in the same session without the walk key stealing instrument input (play keys fire; walk continues on remaining held walk keys).
- `keyup`, blur, `visibilitychange` → hidden, and ✕ exit clear held piano keys, keyboard guitar chord, and held keyboard vocal without stuck sustains.
- Mobile / coarse-pointer shells ignore the jam keyboard and keep focus-gated pads; `#keys-hint` stays desktop-only and lists the jam map.

---

## 13. Mascot customization v2

### Outcomes

The editor should feel like a small dressing room inside the stage, not a settings form.

1. A first-time visitor can make a recognizable change and return to play in **under 30 seconds**.
2. Every change is visible on the real mascot at a useful scale; the panel never covers the face or the body part being edited.
3. Exploration is reversible. **ГОТОВО** commits the draft; **✕ / Esc** cancels it and restores the configuration from when the editor opened.
4. The feature stays lightweight: procedural geometry, shared materials and build-time canvas micro-textures (knit, rib, hair strands), curated choices, local persistence, and no account or asset download.

### Information architecture and flow

- Use three short categories: **ОБЛИЧЧЯ** (hair, hair color, smile, skin tone), **ОДЯГ** (outfit, color overrides, accessories), and **ФОРМА** (height, build). Do not force a step-by-step wizard; the visitor may switch categories in any order.
- Keep the category rail, title / close control, and bottom action bar visible. Only the category contents scroll.
- The first-run handoff after **ЗРОЗУМІЛО** uses this same editor and never requires a choice. **ГОТОВО** is visible immediately so the visitor can keep the default and reach the stage.
- Selecting an option updates an in-memory draft and the 3D preview immediately. It does not write `localStorage` on every tap or slider tick.
- **ГОТОВО** writes the validated draft, closes the editor, and restores the previous stage camera. It shows no toast — the mascot standing there in its new look is the confirmation.
- **✕ / Esc** restores the opening snapshot in 3D and storage before closing. Backdrop taps remain inert.
- **СКИНУТИ** changes the draft to defaults but does not close or persist it. Offer an inline **ПОВЕРНУТИ** action until the next edit; committing still requires **ГОТОВО**.
- **РАНДОМ** chooses a random look only from curated compatible options. It updates the draft and supports the same undo / cancel behavior.

### Responsive composition

| Viewport | Editor | Preview |
|----------|--------|---------|
| Desktop / wide tablet | Right rail, `380–440 px`; sticky header and action bar | Safe rectangle in the remaining canvas, centered on the mascot |
| Phone portrait | Bottom sheet, normally `50–58dvh`; sticky header / categories / actions | Safe rectangle between the HUD and the measured top edge of the sheet |
| Phone landscape / short viewport | Side rail instead of a bottom sheet when the upper preview strip would be too shallow | Largest unobscured canvas rectangle |

- Derive the preview rectangle from `visualViewport`, safe-area insets, HUD bounds, and the actual panel bounding box. Do not rely on a width breakpoint plus hard-coded camera offsets.
- Frame **ОБЛИЧЧЯ** as head and shoulders. Frame **ОДЯГ** and **ФОРМА** as a full-body view with a small amount of stage floor visible.
- Offset the preview by shifting the camera look target, never by lowering the camera with its target. This keeps the camera above the platform edge at every height / build value, so the stage floor cannot occlude the mascot.
- Refit on open, category change, resize, orientation change, `visualViewport` change, and after height / build changes. Slider movement may use a throttled refit and settle once input ends so the camera does not visibly jitter.
- The complete relevant mascot bounds must remain inside the preview rectangle with at least `16 px` visual margin. Hair, shoes, and the customized height extremes count toward those bounds.
- Horizontal drag in the unobscured preview rotates the mascot around its own Y axis. Preview gestures never orbit the stage camera, move the mascot, or start a dance.
- Background stage controls are disabled while editing. Panel gestures never leak into raycasting, walking, orbit, zoom, or instrument play.
- Under `prefers-reduced-motion`, use a short dissolve or immediate reframe instead of a long camera tween; essential live appearance feedback remains.

### Control design

- Use a minimum target of **48 × 48 CSS px** with `8 px` separation for category, choice, swatch, close, and action controls.
- Replace ambiguous visible hair labels with **Довге / Боб / Коротке / Мінімум** while retaining the existing runtime IDs.
- Each group label also exposes its selected value, for example `КОЛІР ВОЛОССЯ · КАШТАНОВЕ`.
- Hair-color and future skin-tone swatches show a selected checkmark and a visible or screen-reader label; color is never the only signal.
- Outfit choices show the name plus a small 2–3-color palette preview so visitors can predict the result without cycling through every option.
- Height and build are labeled sliders without numeric or endpoint descriptions.
- Arrow keys move within radio groups; Home / End select the first / last option. Sliders retain native keyboard behavior. Focus returns to the HUD mascot button after close.
- The modal uses `role="dialog"`, `aria-modal="true"`, an accessible title, a focus trap, and an inert background. Live slider updates do not flood an `aria-live` region.

### Feature set

| Layer | Scope |
|-------|-------|
| **Editor foundation** | Measured preview safe rectangle; category rail; sticky actions; draft / commit / cancel model; reset undo; accessible dialog and radio behavior; compact landscape layout |
| **Identity and delight** | Four curated skin tones applied to face and both hands; five hair colors; three eye colors on a dedicated iris material inside a layered sclera / iris / pupil eye, so the chosen color reads at stage distance; three authored smiles (soft default, open singing wide, calm neutral); drag-to-rotate preview; compatible random look |
| **Wardrobe** | Accessories `немає / сережки / окуляри / навушники` (glasses have temple arms and tinted lens fills); four authored hairstyles (including bald) with a restyled shared fringe, per-style lock placement, and a long-style back fall; four varsity palettes (**Сцена / Фірмовий / Джинс / Ніч**) on the placket / chest-stripe / hem-band / cuffs garment; four-option primary / accent overrides; shoe-color override with a palette-default option |

All options reuse or toggle cached geometry and shared materials. Changing a choice must not allocate new meshes, materials, textures, or synthesis work inside the input handler. Arbitrary uploads, AI avatars, an unrestricted color picker, accounts, and a downloadable wardrobe remain out of scope.

### Persistence and migration

- `av2.mascot.v3` is the source contract. Prior mascot keys are not migrated. A malformed v3 field falls back independently and never invalidates the whole look.
- The editor holds `openingConfig` and a live draft separately; only **ГОТОВО** writes storage.

- `openingConfig`, drafts, undo state, and preview angle are session-only. Preview angle is not part of the saved appearance.
- The current appearance must keep working if v3 is removed or storage is unavailable; fall back to defaults without blocking entry to the stage.

### Acceptance

- Validate at `320×568`, `390×844`, `430×932`, `844×390`, and `1280×720`, including browser chrome / `visualViewport` changes. The relevant mascot bounds never intersect the editor panel or HUD.
- **ГОТОВО**, **✕**, and the active category remain reachable without scrolling the control body.
- **ГОТОВО** survives reload. **✕ / Esc** leaves storage unchanged and restores every opening value. Reset → undo returns the exact preceding draft.
- All combinations remain readable at the height / build extremes and do not detach hands, pointer label, fall scaling, or instrument poses. At 145% height / 150% build and 131% height / 65% build, the stage floor must not cross in front of the mascot. Test idle, walk, dance, fall, and each instrument focus pose.
- A 20-change stress pass creates no additional mascot meshes or materials and causes no visible frame hitch.
- Keyboard-only and screen-reader passes can identify the dialog, current category, selected values, slider values, reset, cancel, and commit controls. Focus never escapes behind the dialog.
- In a five-person first-use test, at least four visitors change hair or outfit, inspect the preview, and return to the stage within **30 seconds** without verbal help.

---

## 14. Change checklist

When changing behavior:

1. Update code + `?v=` cache query.
2. Update this `SPEC.md` if contracts or UX change.
3. Push to `main` (Pages deploy) and verify live HTML contains the new `?v=` and expected markup (`onboard`, pricing mixer, chord pad, settings mixer, etc.).
