# Art Vibe Studio — Specification

Interactive marketing experience for **Art Vibe Studio** (music lessons): a WebGL 3D stage where visitors walk a mascot, play instruments, and open booking info (steps, rules, prices).

- **Live:** https://vibe2.ton.zone  
- **Repo / release:** https://github.com/voloshyninthesky/av2 → versioned Nginx releases (`vibe2.ton.zone`)  
- **Locale:** Ukrainian (`lang="uk"`)  
- **Currency:** PLN (displayed as «зл»)  
- **Contact CTA:** Instagram [@artvibe.pl](https://www.instagram.com/artvibe.pl/)  
- **Credit:** «created by vadymbek» on the slideshow reverse → https://vadymbek.top  

Slogan: *Вчись творити і твори навчаючись.*

---

## 1. Product goals

1. Let a visitor **feel the studio** (stage, instruments, sound) in under a minute.
2. Teach one action: **approach an instrument, then play while focused**.
3. Convert interest into a booking path: **як записатися → правила → ціни → Instagram**.

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
index.html          # shell, modals, HUD, pads, sound mixer; loads telegram-web-app.js
css/style.css       # design system + overlays
fonts/              # self-hosted faces
img/                # slideshow photos
js/
  main.js           # scene, interaction, loop, onboard, pads, audio unlock
  instruments.js    # procedural drums / piano / guitar / mic
  audio.js          # Web Audio synth + buses + unlock/resume
  ui.js             # HUD, modals, chip, toast
  pricing.js        # interactive price mixer
prices.json         # lesson prices + promos
piano-notes.json    # optional piano phrase data (kept; not auto-played on focus)
vendor/three/       # vendored Three.js
CNAME               # vibe.ton.zone for GitHub Pages
.nojekyll
.github/workflows/  # Deploy to GitHub Pages
deploy/nginx/       # live VPS nginx release target
```

**Stack:** Three.js (WebGL), OrbitControls, EffectComposer + UnrealBloomPass, Web Audio API.

**Audio buses:** `drums` | `piano` | `guitar` | `mic` → master (mute). Default guitar level **0.6** (40% quieter than the others).

### Audio unlock

Mobile / in-app browsers often leave `AudioContext` **suspended** (silent until refresh). Engine must:

- Unlock on Enter and every play path (`init` + `resume`).
- Prime with a tiny silent buffer inside the user-gesture turn.
- Retry `resume()` shortly after wake; recreate context if `closed` or still blocked on the next trusted gesture.
- Re-wake on `pointerdown` / `touchstart` / `keydown`, `visibilitychange` → visible, and `pageshow`.
- Mark the audio route for a guarded context rebuild after backgrounding, page restore, window blur, or an interrupted mobile Audio Session—even if the old context incorrectly still reports `running`.
- Request the mobile Audio Session `playback` route where the browser exposes that API, and preserve loop phase / active vocal state across a context rebuild.
- Resume when unmuting the master.

Mute chosen before the context exists is honored when `init` runs.

---

## 4. Scene

### Stage

- Wooden platform, gold front trim, footlights (emissive + point lights). Downward volumetric spotlight shells meet the platform top and fade at its finite X/Z footprint; no beam geometry hangs over the surrounding void. The larger under-stage venue plane is intentionally unlit so non-shadow-casting mobile spotlights cannot create false beam spill below the platform.
- Back wall, curtains, valance, speaker stacks.
- Mascot walking uses X/Z colliders around the instruments and speaker stacks. Keyboard / stick movement slides along their edges; instrument approaches stop at the closest clear edge before focus, and exiting a seated focus pose returns the mascot to clear floor.
- Backdrop **slideshow** (shader crossfade + Ken Burns) with gold frame and brand plate.
- Soft neon **vadymbek** credit on the **back** of the screen (clickable link hit target).
- Procedural dust; gentle idle motion on curtains / instruments (respects `prefers-reduced-motion`).
- Start camera is pulled in by three “+” zoom steps (`START_ZOOM_FACTOR = 0.82³`). Soft orbit (lower rotate/zoom speed, higher damping). Extra zoom-in headroom vs older builds.
- After Enter: `html.stage-live` — fixed layout, `touch-action` guards, `visualViewport` scale reset to fight Chrome iOS letterboxing from stuck page zoom.

### Instruments (procedural meshes)

| Kind | Play (only while **focused** on that instrument) |
|------|------|
| `mic` / vocal | Vocal pad notes; formant-ish synth |
| `guitar` | Two-hand chord play: choose / hold a chord, then cross or pluck the strings; fret taps are a secondary solo shortcut |
| `piano` | **Keys only** (`freq` on mesh) + `1–8` whites (multitouch when focused). Cabinet / lid / bench do not play. |
| `drums` | Kit parts + `A–G` (multitouch when focused) |

Hover (fine pointer): emissive glow.  
Distant tap / swipe on an instrument: **walk + camera approach only** — no preview sound. Sound starts after focus.

### Guitar performance mode

The primary mental model is **two hands**: the fretting hand chooses the sound; the picking hand creates it. Chord / fret input alone stays silent.

- Guitar input is accepted only during stable guitar focus — never while idle, approaching, entering, returning, or focused on another instrument.
- Global instrument shortcuts ignore key events originating from buttons, links, form fields, or editable content; the focused control handles those events itself.
- Focus frames the soundhole, all six strings, and the first five frets from a near-front angle, two `+` zoom steps closer than the base guitar framing. On resize / orientation change, fit that play area again.
- The mascot and guitar must read as one performance pose: fretting hand at the neck, picking hand at the soundhole. String motion and hand motion carry the action; whole-body guitar wobble stays subtle.
- Use separate guitar-local raycast proxies for approach, strum, and fret selection. A pointer captured by a play zone cannot orbit the camera until it ends.
- Keep a narrow focused azimuth range so the strings remain readable. Derive that range from the camera transition endpoint so enabling orbit controls does not shift the settled frame. Zoom buttons remain available.

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

- **Touch:** hold a chord with one pointer and strum with another. Release, cancel, exit, background, or lost capture returns to open strings.
- **Fine pointer / pen:** clicking a chord latches it so the same pointer can strum repeatedly; clicking it again clears it.
- **Keyboard:** while guitar-focused, hold `E`, `A`, `C`, `D`, `G`, or `F` for the matching chord (`E` = Em, `A` = Am). Key release returns to open strings.
- Chord buttons expose visible focus, `aria-pressed`, and `aria-keyshortcuts`; color is not the only signal. Space is a downstroke; Shift+Space is an upstroke.
- Use one fretboard plane and derive the nearest string from its local hit point; while a chord is selected, its shape owns the fretting so every fretboard hit uses that string’s chord pitch and mute state. With no chord selected, a fretboard hit uses its local fret.

#### Guitar sound and feedback

- One six-string event drives audio, visuals, haptics, and loop playback. It preserves string indices, frets / mutes, direction, gesture velocity, and per-string onset offsets.
- Each audible string vibrates at its own scheduled onset and amplitude; muted strings neither sound nor animate. Visual and audible onsets stay aligned.
- Replucking a physical string releases its previous voice over `10–30 ms` instead of stacking unlimited tails. All-string mute and focus exit use click-free ramps.
- Vary excitation, damping, brightness, and stereo position by string and stroke. Add shared acoustic-body resonance; do not replay one byte-identical buffer for every occurrence of a pitch.
- Progressively pre-warm common guitar pitches during the approach / camera transition without stalling the animation. No synthesis-table generation runs inside the pointer stroke handler.
- Optional haptic feedback fires once per completed stroke. It scales gently with velocity and never fires per string.
- Guitar price chips follow normal instrument-play behavior.

#### Later guitar enhancements

- Explicit **АКОРДИ / СОЛО** modes.
- True held fretting with separate plucks, slides, bends, hammer-ons, pull-offs, palm mute, and damping.
- Left-handed layout, capo / alternate tuning, pick versus fingerstyle, metronome, backing groove, and guided chord progressions.
- Higher-fidelity procedural body modelling or one compact body-resonance impulse where the download budget permits.

### Mascot

Low-poly avatar labeled «Ти» (matched skin hands on both arms; no jacket-panel “fake hand”). Walk with arrows / click floor / mobile stick. Can fall off stage edge (short recovery). Instrument focus poses or seats the mascot and reframes the camera.

**Customization** (HUD person icon button next to the sound mixer → `#modal-mascot`): three categories **ОБЛИЧЧЯ / ОДЯГ / ФОРМА** cover five hairstyles (**Довге / Боб / Коротке / Мінімум / Зібране**), three smiles, five hair colors (also recolor brows), six skin tones (face + both hands), four outfit palettes, curated primary / accent overrides, four accessories, and height (70–145%) / build (65–150%) sliders. The procedural parts are created once and toggled or recolored in place. **РАНДОМ** chooses a compatible look, while **В РУСІ** toggles the walk-in-place preview; horizontal drag remains the sole orientation control.

Opening the editor creates a draft. Changes apply live to the 3D mascot; **ГОТОВО** commits them to `localStorage` `av2.mascot.v2`, while **✕ / Esc** restores the opening appearance. **СКИНУТИ** resets the draft and exposes **ПОВЕРНУТИ**. The measured unobscured canvas rectangle—not a fixed breakpoint offset—frames either head / shoulders or the full body around the actual HUD and panel bounds. Horizontal preview drag rotates the mascot without moving the stage camera. The camera returns to its saved frame on close. Instruments and stage hints are temporarily hidden so they cannot obscure the preview. Background controls are inert, and backdrop taps never close the editor.

**Dance** (click the HUD logo): toggles a **tektonik** routine — procedural 8-beat loop (overhead arm sweeps + bounce, full spin on the last two beats). Limbs relax smoothly on stop. Walk input, instrument approach, or a stage fall stops the dance.

---

## 5. Interaction map

### Desktop

| Input | Action |
|-------|--------|
| Arrows / click floor | Move mascot |
| Click instrument | Approach if not focused; play only when focused |
| `E` while idle | Approach nearest instrument in reach (no auto melody) |
| Drag / wheel / `+` `−` | Orbit / zoom (buttons stay visible while focused) |
| `A–G` while drums-focused | Drums |
| `1–8` while piano-focused | Piano whites |
| Hold `E` / `A` / `C` / `D` / `G` / `F` while guitar-focused | Guitar chord |
| Space / Shift+Space while guitar-focused | Guitar downstroke / upstroke |
| Drag across strings while guitar-focused | Directional guitar strum |
| `L` | Loop pedal (after first VIBE fill unlock) |
| HUD logo click | Toggle mascot tektonik dance |
| Esc | Dismiss onboard / close sound mixer (does **not** leave instrument focus) |
| ✕ (`#mobile-exit`) | Leave instrument focus (desktop + mobile) |

### Mobile

- Small left **move zone** + floating stick under finger.
- Soft one-finger orbit; two-finger dolly/pan.
- **ГРАТИ** when in reach → approach / focus. Outside reach it stays visually disabled but remains an accessible tap target: the first unavailable tap shows, once, `Підійди до інструмента ближче щоб заграти`.
- ✕ exit when approaching / entering / focused.
- Leaving any instrument focus must reset the floating joystick, thumb, active pointer identity, and movement vector before the walk controls return. This includes a lost / cancelled iOS pointer while the joystick is hidden during guitar focus.
- Touch instruments when focused (multitouch piano / drums; chord hold + independent strum / pluck for guitar).
- Focused piano/drums arbitrate play vs camera without requiring an empty-screen start: taps play immediately; a horizontal piano slide keeps glissando; a vertical drag beyond `12 px` orbits; two-finger distance change beyond `9 px` zooms and suppresses further note traversal until release.
- **Pedal / pads + instrument multitouch:** one finger on loop pedal, chord pad, vocal pad, or other HUD chrome and another on the kit/keys must both work. Do **not** `preventDefault` multitouch `touchstart` when any finger is on UI chrome (that drops the second finger’s pointer events). Loop pedal binds **`pointerdown`**, not `click`.
- Chord pad while guitar-focused; vocal pad while mic-focused.
- HUD collapses to menu drawer on small screens.
- Keyboard key legend (`#keys-hint`) and drag hint are **desktop-only** — hidden on phones and tablets (`max-width: 720px` or coarse pointer / no hover).

### VIBE meter

Playing adds vibe. At 100%: surprise (fireworks / loop unlock). The maximum-vibe toast appears below the HUD, never over instrument pads, and claims its own taps so it cannot trigger browser double-tap zoom. Meter decays when idle.

### Loop pedal

Unlocked once after first vibe fill. Record layers while playing; pause / clear tools. Key `L` on desktop. Must remain usable while another finger is playing an instrument. A vocal-pad hold records its actual sustained duration; if recording or overdubbing begins while a vocal is already held, capture starts at the pedal press and continues until release or loop closure.

---

## 6. UI overlays

| Overlay | Purpose |
|---------|---------|
| Intro | Brand splash; **ВИЙТИ НА СЦЕНУ** starts audio + fly-in. A reload / same-tab return bypasses the splash and lands on the stage without unlocking audio until a gesture. |
| Onboard | One first-run tip (`localStorage` `av2.onboard.v1`); mic pulse cue |
| HUD | Logo (click = mascot dance), VIBE, nav (кроки / правила / ціни), **mascot button**, **sound mixer** |
| Sound mixer | Per-instrument faders + master mute (speaker button) |
| Modals | **Mascot customization**, compact **scene-style** picker, steps, rules, **interactive pricing mixer** |
| Chord / strum / vocal pads | Instrument play helpers while focused |
| Chip | Once-per-instrument price teaser carousel → opens pricing |
| Toast / tooltip | Short feedback |

### Scene style

- A separate three-position `3D` HUD switch opens the compact **Стиль сцени** modal; it is not a nav-menu item.
- The visible styles are ordered **GLAMOUR** (maximum details), **PIXEL** (energy saving), then **AUTO**. The style names carry the primary visual emphasis; their Ukrainian descriptions are secondary. Internally they retain the persisted values `high`, `low`, and `auto` in `localStorage` key `av2.quality.v1`.
- Choosing a different style immediately locks the three options, shows a loader inside the chosen option, and announces the pending style before the scene reloads with that quality budget.
- **AUTO** uses a two-stage frame-pacing probe on iPhone / iPad and Android. It begins without expensive shadows or postprocessing, promotes only sustained smooth devices, and returns to the stable low budget if full effects miss cadence. Desktop AUTO is full quality.
- **GLAMOUR** and **PIXEL** are explicit overrides. PIXEL is the stable 30 FPS, no-shadows / no-bloom budget; GLAMOUR enables the full scene budget.

### Pricing mixer

Driven by `prices.json`:

1. Pick instrument (**text-only** buttons — no SVG icons).
2. Format: разовий / абонемент.
3. Duration; package size if абонемент.
4. Live ticket board (total + ≈ per lesson). Theme: purple vs gold by category.

### Rules

Numbered “score rail”: language policy, single-lesson cancels, subscription rules, acceptance.

---

## 7. Data contracts

### `prices.json`

```json
{
  "currency": { "code": "PLN", "display": "зл" },
  "categories": [
    {
      "id": "vocal-guitar",
      "instruments": ["vocal", "guitar"],
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

### `piano-notes.json`

Ordered list of `{ "note", "freqHz" }` kept for possible phrases; focus / `E` / ГРАТИ do **not** auto-play a default melody.

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

### `av2.mascot.v2` (localStorage)

Mascot customization, migrated from `av2.mascot.v1`, merged over defaults, and validated on load (unknown / malformed values fall back per field):

```js
{
  hair: "long",             // "long" | "bob" | "short" | "buzz" | "tied"
  hairColor: "5a2f22",      // 6-digit hex, no '#'
  smile: "soft",            // "soft" | "wide" | "neutral"
  outfit: "stage",          // "stage" | "vibe" | "denim" | "night"
  outfitPrimary: "default", // "default" | "purple" | "gold" | "denim" | "ink"
  outfitAccent: "default",  // "default" | "purple" | "gold" | "cream" | "green"
  skinTone: "tone-3",       // "tone-1" … "tone-6"
  accessory: "hoops",      // "none" | "hoops" | "glasses" | "headphones"
  height: 100,              // percent, 70–145
  width: 100                // percent, 65–150
}
```

### First-run UI state (localStorage)

- `av2.onboard.v1` records dismissal of the onboarding tip.
- A first-run click on **ЗРОЗУМІЛО** closes onboarding and opens the mascot customization modal once; `av2.mascot.after-onboard.v1` records that handoff. Other onboarding dismissals do not open it.
- `av2.mobile-play-hint.v1` records the one-time unavailable-**ГРАТИ** proximity hint.

---

## 8. URL query flags

| Param | Effect |
|-------|--------|
| `nointro` | Skip splash; land on stage + HUD |
| `autoenter` | Auto-click enter after load |
| `skiponboard` | Never show first-run tip |
| `shot=pricing\|rules\|steps\|chip\|toast` | Open overlay / demo UI |
| `anchor=vocal\|guitar\|drums\|piano` | Preselect pricing instrument |
| `sstime` | Slideshow timing override (debug) |

---

## 9. Onboarding

**As simple as possible:** one tip after camera fly-in.

Default copy:

> Вітаємо на сцені Art Vibe! Сьогодні вона повністю твоя. По ній можна ходити, а на інструментах — грати.

Dismiss: play, move, **ЗРОЗУМІЛО**, Esc. Persists via `localStorage`. A first-run **ЗРОЗУМІЛО** then opens mascot customization once; the other dismissal routes do not. Soft purple pulse on the mic while active (disabled under reduced motion).

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
- Artifact: `css fonts img js vendor index.html prices.json piano-notes.json .nojekyll CNAME`.
- Custom domain: `vibe.ton.zone` → CNAME `voloshyninthesky.github.io` (Porkbun DNS).
- Enforce HTTPS in Pages settings after DNS verifies.
- **Cache bust:** bump `?v=` on `css/style.css`, `js/main.js`, and module imports as needed (including `audio.js` when unlock behavior changes).

**Live VPS release:** nginx release dirs under `/var/www/vibe2.ton.zone/releases/<UTC>/` via `deploy/nginx/`. Update all three Nginx `root` entries, validate with `nginx -t`, reload, and move `current` only after the new release is ready.

Local: `python3 -m http.server 8000 --bind 127.0.0.1` → http://127.0.0.1:8000

---

## 12. Quality bar

- Works on desktop and mobile Safari / Chrome (and best-effort Telegram in-app browser).
- Keyboard focus visible on overlay controls.
- `prefers-reduced-motion`: cut ambient / onboard pulse animations.
- WebGL fail → `#webgl-fail` panel.
- Lock page-level pinch and double-tap zoom for the whole live stage, including simultaneous joystick + `+` / `−` touches. Keep initial UI control pointer dispatch intact (claim multi-touch on move / Safari `gesture*`, not a chrome `touchstart`) so two-control and pad↔canvas interaction still works. Informational overlays retain normal zoom / scroll.
- In focused piano/drums, one-finger orbit and two-finger zoom work even when the gesture begins on playable geometry; short taps and intentional piano glissando remain playable.
- No stuck-silent sessions after backgrounding or a mobile audio-route interruption: the next user gesture can rebuild and unlock the graph without a page refresh.
- No secrets in repo; prices are public marketing data.

### Guitar acceptance

- In a five-person first-use test, at least four players make an open strum within `8 s` and a chorded strum within `20 s` after the camera settles, without verbal help.
- The first stable guitar-focused frame must match the camera transition endpoint; enabling orbit controls and the focused azimuth limits must not snap, reframe, or otherwise move the view after the animation.
- No guitar sound occurs outside stable guitar focus, including Space, chord keys, distant taps, camera transitions, and focus on another instrument.
- A complete stroke excites each crossed eligible string once and in directional order; motion along the strings stays silent. Muted strings neither sound nor animate.
- Soft and hard strokes are audibly distinct. Reversing direction can immediately produce the reverse string order without false retriggers.
- Twenty consecutive chord-hold + second-pointer strums work on supported iPhone Safari and Android Chrome without page zoom, orbit motion, lost pointers, or a stuck chord.
- Chord targets are at least `48 × 48` CSS px with `8 px` separation. The strum zone remains usable at the smallest supported viewport and after portrait / landscape changes.
- Pointer cancel, focus exit, visibility loss, and page backgrounding clear every held chord, active stroke, and captured guitar pointer.
- Repeated guitar focus → ✕ exits on iPhone Safari restore the joystick to its non-floating home state; a lost joystick pointer-up may never leave only the blurred stick backdrop behind.
- Input-to-audio scheduling is at most `16 ms`; target measured input-to-audible latency is at most `50 ms` desktop and `80 ms` on reference mobile devices.
- Audio and per-string visual onset differ by at most `33 ms`. Reduced motion removes idle shimmer, not essential play feedback.
- A physical string has at most one active voice; retrigger and mute ramps do not click. First play performs no synchronous synthesis-table generation in the input handler.

---

## 13. Mascot customization v2

### Outcomes

The editor should feel like a small dressing room inside the stage, not a settings form.

1. A first-time visitor can make a recognizable change and return to play in **under 30 seconds**.
2. Every change is visible on the real mascot at a useful scale; the panel never covers the face or the body part being edited.
3. Exploration is reversible. **ГОТОВО** commits the draft; **✕ / Esc** cancels it and restores the configuration from when the editor opened.
4. The feature stays lightweight: procedural geometry, shared materials, curated choices, local persistence, and no account or asset download.

### Information architecture and flow

- Use three short categories: **ОБЛИЧЧЯ** (hair, hair color, smile, skin tone), **ОДЯГ** (outfit, color overrides, accessories), and **ФОРМА** (height, build). Do not force a step-by-step wizard; the visitor may switch categories in any order.
- Keep the category rail, title / close control, and bottom action bar visible. Only the category contents scroll.
- The first-run handoff after **ЗРОЗУМІЛО** uses this same editor and never requires a choice. **ГОТОВО** is visible immediately so the visitor can keep the default and reach the stage.
- Selecting an option updates an in-memory draft and the 3D preview immediately. It does not write `localStorage` on every tap or slider tick.
- **ГОТОВО** writes the validated draft, closes the editor, restores the previous stage camera, and may show the short toast `ОБРАЗ ЗБЕРЕЖЕНО`.
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
- Height and build keep their exact percentage output, but also show semantic endpoints. Example: `НИЖЧИЙ — БАЗОВИЙ — ВИЩИЙ` and `ВУЖЧА — БАЗОВА — ШИРША`.
- Arrow keys move within radio groups; Home / End select the first / last option. Sliders retain native keyboard behavior. Focus returns to the HUD mascot button after close.
- The modal uses `role="dialog"`, `aria-modal="true"`, an accessible title, a focus trap, and an inert background. Live slider updates do not flood an `aria-live` region.

### Feature set

| Layer | Scope |
|-------|-------|
| **Editor foundation** | Measured preview safe rectangle; category rail; sticky actions; draft / commit / cancel model; reset undo; accessible dialog and radio behavior; compact landscape layout |
| **Identity and delight** | Six curated skin tones applied to face and both hands; drag-to-rotate preview; compatible random look; toggleable **В РУСІ** preview that demonstrates walk motion without changing stage state |
| **Wardrobe** | Accessories `немає / сережки / окуляри / навушники`; tied hairstyle; curated outfit primary / accent variants |

All options reuse or toggle cached geometry and shared materials. Changing a choice must not allocate new meshes, materials, textures, or synthesis work inside the input handler. Arbitrary uploads, AI avatars, an unrestricted color picker, accounts, and a downloadable wardrobe remain out of scope.

### Persistence and migration

- `av2.mascot.v2` is the source contract. If it is absent and a valid `av2.mascot.v1` value exists, migrate it once by copying every valid v1 field and applying defaults for new fields. A malformed v2 field falls back independently and never invalidates the whole look.
- The editor holds `openingConfig` and a live draft separately; only **ГОТОВО** writes storage.

- `openingConfig`, drafts, undo state, and preview angle are session-only. Preview angle is not part of the saved appearance.
- The current appearance must keep working if v2 is removed or storage is unavailable; fall back to defaults without blocking entry to the stage.

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
3. Push to `main` (Pages deploy) and verify live HTML contains the new `?v=` and expected markup (`onboard`, pricing mixer, chord pad, sound mixer, etc.).
