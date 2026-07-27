# Art Vibe Studio — Specification

Interactive marketing experience for **Art Vibe Studio** (music lessons): a WebGL 3D stage where visitors walk a mascot, play instruments, and open booking info (steps, rules, prices).

- **Live:** https://vibe.ton.zone  
- **Repo / Pages:** https://github.com/voloshyninthesky/av2 → GitHub Pages (`custom domain` `vibe.ton.zone`)  
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
deploy/nginx/       # legacy VPS nginx conf (optional / historical)
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

- Wooden platform, gold front trim, footlights (emissive + point lights).
- Back wall, curtains, valance, speaker stacks.
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
- Focus frames the soundhole, all six strings, and the first five frets from a near-front angle. On resize / orientation change, fit that play area again.
- The mascot and guitar must read as one performance pose: fretting hand at the neck, picking hand at the soundhole. String motion and hand motion carry the action; whole-body guitar wobble stays subtle.
- Use separate guitar-local raycast proxies for approach, strum, and fret selection. A pointer captured by a play zone cannot orbit the camera until it ends.
- Keep a narrow focused azimuth range so the strings remain readable. Zoom buttons remain available.

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
- **ГРАТИ** when in reach → approach / focus.
- ✕ exit when approaching / entering / focused.
- Touch instruments when focused (multitouch piano / drums; chord hold + independent strum / pluck for guitar).
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
| Intro | Brand splash; **ВИЙТИ НА СЦЕНУ** starts audio + fly-in |
| Onboard | One first-run tip (`localStorage` `av2.onboard.v1`); mic pulse cue |
| HUD | Logo (click = mascot dance), VIBE, nav (кроки / правила / ціни), **sound mixer** |
| Sound mixer | Per-instrument faders + master mute (speaker button) |
| Modals | Steps, rules, **interactive pricing mixer** |
| Chord / strum / vocal pads | Instrument play helpers while focused |
| Chip | Once-per-instrument price teaser carousel → opens pricing |
| Toast / tooltip | Short feedback |

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

Dismiss: play, move, **ЗРОЗУМІЛО**, Esc. Persists via `localStorage`. Soft purple pulse on the mic while active (disabled under reduced motion).

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

**Legacy (optional):** nginx release dirs under `/var/www/vibe.ton.zone/releases/<UTC>/` via `deploy/nginx/` — superseded by Pages for the live custom domain.

Local: `python3 -m http.server 8000 --bind 127.0.0.1` → http://127.0.0.1:8000

---

## 12. Quality bar

- Works on desktop and mobile Safari / Chrome (and best-effort Telegram in-app browser).
- Keyboard focus visible on overlay controls.
- `prefers-reduced-motion`: cut ambient / onboard pulse animations.
- WebGL fail → `#webgl-fail` panel.
- Scope Mobile Safari / Chrome pinch and double-tap guards to live instrument controls and status toasts. Preserve chord↔canvas multitouch and allow normal zoom / scroll inside informational overlays.
- No stuck-silent sessions after backgrounding or a mobile audio-route interruption: the next user gesture can rebuild and unlock the graph without a page refresh.
- No secrets in repo; prices are public marketing data.

### Guitar acceptance

- In a five-person first-use test, at least four players make an open strum within `8 s` and a chorded strum within `20 s` after the camera settles, without verbal help.
- No guitar sound occurs outside stable guitar focus, including Space, chord keys, distant taps, camera transitions, and focus on another instrument.
- A complete stroke excites each crossed eligible string once and in directional order; motion along the strings stays silent. Muted strings neither sound nor animate.
- Soft and hard strokes are audibly distinct. Reversing direction can immediately produce the reverse string order without false retriggers.
- Twenty consecutive chord-hold + second-pointer strums work on supported iPhone Safari and Android Chrome without page zoom, orbit motion, lost pointers, or a stuck chord.
- Chord targets are at least `48 × 48` CSS px with `8 px` separation. The strum zone remains usable at the smallest supported viewport and after portrait / landscape changes.
- Pointer cancel, focus exit, visibility loss, and page backgrounding clear every held chord, active stroke, and captured guitar pointer.
- Input-to-audio scheduling is at most `16 ms`; target measured input-to-audible latency is at most `50 ms` desktop and `80 ms` on reference mobile devices.
- Audio and per-string visual onset differ by at most `33 ms`. Reduced motion removes idle shimmer, not essential play feedback.
- A physical string has at most one active voice; retrigger and mute ramps do not click. First play performs no synchronous synthesis-table generation in the input handler.

---

## 13. Change checklist

When changing behavior:

1. Update code + `?v=` cache query.
2. Update this `SPEC.md` if contracts or UX change.
3. Push to `main` (Pages deploy) and verify live HTML contains the new `?v=` and expected markup (`onboard`, pricing mixer, chord pad, sound mixer, etc.).
