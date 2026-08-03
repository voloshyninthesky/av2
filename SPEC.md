# Art Vibe Studio — Specification

Interactive marketing experience for **Art Vibe Studio**, a cultural and educational space in Łódź offering vocal, guitar, piano, and drum lessons: a WebGL 3D stage where visitors walk a mascot, play instruments, and open booking info (steps, rules, prices).

- **Live:** https://artvibe.com.pl
- **Repo / release:** https://github.com/voloshyninthesky/av2 → GitHub Pages (`artvibe.com.pl`) + versioned Nginx preview (`vibe2.ton.zone`)
- **Locale:** Ukrainian (`lang="uk"`)  
- **Location:** Łódź, Poland
- **Currency:** PLN (displayed as «зл»)  
- **Contact CTAs:** Instagram [@artvibe.pl](https://www.instagram.com/artvibe.pl/) and [Messenger](https://m.me/61564874125852?text=%D0%9F%D1%80%D0%B8%D0%B2%D1%96%D1%82%2C%20%D1%85%D0%BE%D1%87%D1%83%20%D0%BD%D0%B0%20%D1%83%D1%80%D0%BE%D0%BA%21)

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
index.html          # shell, modals, HUD, pads, settings mixer; loads telegram-web-app.js
css/style.css       # design system + overlays
css/lessons.css     # lightweight static lesson pages
fonts/              # self-hosted faces
img/                # slideshow photos
uk/                 # Ukrainian lesson hub + instrument-specific SEO pages
js/
  main.js           # scene, interaction, loop, onboard, pads, audio unlock
  instruments.js    # procedural drums / piano / guitar / mic
  audio.js          # Web Audio synth + buses + unlock/resume
  ui.js             # HUD, modals, chip, toast
  pricing.js        # interactive price mixer
prices.json         # lesson prices + promos
piano-notes.json    # optional piano phrase data (kept; not auto-played on focus)
vendor/three/       # vendored Three.js
CNAME               # artvibe.com.pl for GitHub Pages
.nojekyll
.github/workflows/  # Deploy to GitHub Pages
deploy/nginx/       # live VPS nginx release target
```

**Stack:** Three.js (WebGL), OrbitControls, EffectComposer + UnrealBloomPass, Web Audio API.

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
- Backdrop **slideshow** (shader crossfade + Ken Burns) with gold frame and brand plate.
- Procedural dust; gentle idle motion on curtains / instruments (respects `prefers-reduced-motion`).
- Start camera is pulled in by three “+” zoom steps (`START_ZOOM_FACTOR = 0.82³`). The game-style mascot-follow camera and temporary scout-on-drag behavior run on both mobile and desktop; focused instrument views retain their own cameras. Extra zoom-in headroom vs older builds.
- After Enter: `html.stage-live` — fixed layout, `touch-action` guards, `visualViewport` scale reset to fight Chrome iOS letterboxing from stuck page zoom.

### Instruments (procedural meshes)

| Kind | Pointer / touch play | Desktop keyboard play |
|------|----------------------|------------------------|
| `mic` / vocal | Vocal pad / mesh hits **only while mic-focused** | `N M , . /` → ДО РЕ МІ ФА СОЛЬ (hold to sustain; see §5 Desktop keyboard jam) |
| `guitar` | Two-hand chord + strum / pluck **only while guitar-focused** | Chord row + Space strum — works **with or without** guitar focus |
| `piano` | Mesh keys + `#piano-pad` **only while piano-focused** (multitouch). Hold sustains; release / cancel / exit / mute / background releases. Cabinet / lid / bench do not play. | `1–8` whites — with or without piano focus |
| `drums` | Kit parts **only while drums-focused** (multitouch) | `Z X C V B` kit — with or without drums focus |

Hover (fine pointer): emissive glow.  
Distant tap / swipe on an instrument: **walk + camera approach only** — no preview sound. Pointer sound still starts after focus.  
Desktop keyboard sound does **not** require instrument focus (see §5).

### Piano performance mode

**Current milestone:** improve the piano focus composition and the mascot's seated performance pose, plus reliable held-note sustain for direct key play. Focus / `E` / **ГРАТИ** still never starts a melody.

#### Focus framing — current

- Treat the keybed as the primary subject, the mascot's hands / forearms as the secondary subject, and the upper body / face as supporting context. Do not shrink the keys merely to keep the entire mascot in frame.
- Use a high oblique-overhead camera from the pianist's opposite side: the complete keybed reads along the left and the seated mascot / bench read on the right. Clearly separate black and white keys; avoid a flat side view or a perfectly vertical top-down view.
- Keep the piano cabinet clean in focus: no music book, sheet pages, note lines, or music-rest board.
- Frame the complete two-octave keybed plus both hands inside a measured safe rectangle. Derive that rectangle from `visualViewport`, safe-area insets, and the actual bounds of the HUD, loop pedal, zoom controls, and ✕ exit control.
- Target roughly `76–86%` of the safe width for the projected keybed on desktop / landscape and `84–92%` on phone portrait. Preserve at least `16 px` of visual margin around the keys and hands.
- Use piano-local bounds and anchors, transformed to world space, instead of viewport-specific world offsets. A base camera preset may establish the angle, but safe-rectangle fitting owns the final distance and target offset.
- The camera target should sit near the visual center of the keybed, biased slightly toward the mascot so the hands and seated posture remain legible. Shift the camera target to place the subject in the safe rectangle; do not tilt by moving the camera below the keybed.
- The camera transition endpoint is the authoritative focused frame. Derive focused azimuth / polar limits from that endpoint before re-enabling OrbitControls so the first controls update cannot snap or reframe it.
- Keep the focused distance envelope that preserves key readability, while leaving horizontal orbit, pinch / wheel zoom, and the `+` / `−` controls available. Zoom must not move the keyboard behind fixed UI.
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

#### Piano interaction roadmap

These items are planned, but they are not blockers for the current framing / pose milestone:

1. **Reliable key surface:** piano-local hit plane, dead-gap removal, black-key priority, captured pointers, held key state, ordered glissando, and robust multi-finger chords.
2. **Gesture ownership:** a pointer on keys, drums, guitar strings / frets, or the chord pad claims that finger so OrbitControls cannot rotate or zoom from it; empty canvas still orbits / pinches. Loop-pedal + key multitouch stays supported.
3. **Performance feedback:** one piano-note event driving audio, key travel, glow, note-following hands, VIBE, haptics, and loop capture; at least `16` voices and click-free same-pitch replacement. First play queues a once-per-instrument price chip shown after leaving focus.
4. **Discoverability and access:** first-focus hints (`Торкайся клавіш — можна кількома пальцями` / `Клікай клавіші або грай 1–8`) and an accessible DOM `#piano-pad` strip for `C4–C5`. Desktop `#keys-hint` also advertises jam play without focus.
5. **Expressive controls:** sustain pedal, full two-octave computer-keyboard mapping, MIDI input, velocity-sensitive touch / pen input, and selectable octave.
6. **Learning layer:** optional guided phrases, hand-separated exercises, metronome, and note-name overlays. These may read `piano-notes.json`, but focus itself remains silent.

### Guitar performance mode

The primary mental model is **two hands**: the fretting hand chooses the sound; the picking hand creates it. Chord / fret input alone stays silent.

- **Pointer / pad / mesh guitar input** is accepted only during stable guitar focus — never while idle, approaching, entering, returning, or focused on another instrument.
- **Desktop keyboard** chord + strum keys follow the global jam map (§5): they may sound while idle, while focused on any instrument, and during approach / enter / return camera moves. They stay silent only when the stage has not started, a modal is open, or the event target is editable / a control.
- Global instrument shortcuts ignore key events originating from buttons, links, form fields, or editable content; the focused control handles those events itself.
- Focus frames the soundhole, all six strings, and the first five frets from a near-front angle, two `+` zoom steps closer than the base guitar framing. On resize / orientation change, fit that play area again.
- The mascot and guitar must read as one performance pose: fretting hand at the neck, picking hand at the soundhole. String motion and hand motion carry the action; whole-body guitar wobble stays subtle.
- Use separate guitar-local raycast proxies for approach, strum, and fret selection. A pointer captured by a play zone or by the chord pad cannot orbit / zoom the camera until it ends.
- Start from a composed focused frame, then leave horizontal orbit and zoom available from empty canvas (and the `+` / `−` controls). Zoom buttons remain available.

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

- **Touch:** tap a chord to latch it for one-finger playing, or hold it with one pointer and strum with another. A quick tap on the string fan plucks the nearest string. Releasing a genuinely held chord returns to the previously latched chord (or open strings); cancel, exit, background, or lost capture clears transient holds.
- **Fine pointer / pen:** clicking a chord latches it so the same pointer can strum repeatedly; clicking it again clears it.
- **Desktop keyboard (jam map):** hold `Q` / `R` / `T` / `Y` / `U` / `I` for Em / Am / C / D / G / F. Key release returns to open strings. Space is a downstroke; Shift+Space is an upstroke. Mascot movement is not bound to keyboard keys; it uses click-to-move or the mobile joystick.
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

**Customization** (HUD person icon button next to the settings gear → `#modal-mascot`): three categories **ОБЛИЧЧЯ / ОДЯГ / ФОРМА** with deliberately small, curated groups: three authored hairstyles (**Довге / Боб / Коротке** — side-swept fringe, blunt-fringe bob, clean crop; a shared fringe shell is restyled per hairstyle, and each style also places its side locks, which must fall beside and behind the jaw so long hair never reads as a beard), three smiles (**Легка / Широка / Рівна** — Широка is an open singing mouth with teeth, Рівна a calm closed lip with a hint of curve; default is Легка), five hair colors (also recolor brows), three eye colors (dedicated iris material; glasses/badge ink stays shared), four skin tones (**Теплий / Світлий / Золотий / Чорний**, applied to face and both hands), four coherent varsity palettes (**Сцена / Фірмовий / Джинс / Ніч** — matched sleeves, base + one primary + one accent on a placket / chest-stripe / hem-band / cuffs garment), four-option primary and accent overrides, a shoe-color override (**З ПАЛІТРИ / Чорні / Білі / Червоні**), four accessories (**немає / сережки / окуляри з дужками / навушники**), and height / build sliders. Removed legacy values (`buzz`, `tied`, `sunset` palette, `chain`, `cap`, the `blush` field, skin tones 1/2/6, dropped colors) fall back per-field to defaults when loading an older save. The procedural parts are created once and toggled or recolored in place. **РАНДОМ** chooses a compatible look; horizontal drag remains the sole orientation control.

Only the mascot's major masses cast shadows (torso, neck, face, hair, limbs, shoes). Trim, stripes, collar, eyes and pins are excluded: they add nothing to the shadow map and would roughly double the shadow-pass draw calls now that the mascot stands in the key light. The guitar and mic follow the same rule inside that pool.

Opening the editor creates a draft. Changes apply live to the 3D mascot; **ГОТОВО** commits them to `localStorage` `av2.mascot.v3`, while **✕ / Esc** restores the opening appearance. **СКИНУТИ** resets the draft and exposes **ПОВЕРНУТИ**. The measured unobscured canvas rectangle—not a fixed breakpoint offset—frames either head / shoulders or the full body around the actual HUD and panel bounds. Horizontal preview drag rotates the mascot without moving the stage camera. The camera returns to its saved frame on close. Instruments and stage hints are temporarily hidden so they cannot obscure the preview. Background controls are inert, and backdrop taps never close the editor.

**Dance** (click the HUD logo): toggles a **tektonik** routine — procedural 8-beat loop (overhead arm sweeps + bounce, full spin on the last two beats). Limbs relax smoothly on stop. Walk input, instrument approach, or a stage fall stops the dance.

---

## 5. Interaction map

### Desktop keyboard jam

On desktop (fine pointer / hover-capable, not the mobile game shell), the computer keyboard is a **multi-instrument jam surface**. After Enter, with no modal open and the event not from an editable / button target, instrument maps stay live **regardless of which instrument is focused** (including idle / walking). Pointer and on-screen pads remain focus-gated as today.

**Why this layout:** mascot movement stays pointer/touch based, leaving the desktop keyboard free for instruments and approach (`E`).

| Layer | Keys | Behavior |
|-------|------|----------|
| Walk | Arrows + `W` `A` `S` `D` | Idle only; ignored while any instrument view phase ≠ `idle`. `W` forward, `S` back, `A` left, `D` right (same as arrows). |
| Approach | `E` | Idle only → nearest instrument in reach (no auto melody) |
| Loop | `L` / Shift+`L` | Pedal toggle / clear (after unlock rules unchanged) |
| Piano | `1`–`8` | White keys C4–C5; press-and-hold sustains; multi-key chords OK |
| Drums | `Z` `X` `C` `V` `B` | kick / snare / hihat / tom / crash |
| Guitar chords | `Q` `R` `T` `Y` `U` `I` | Em / Am / C / D / G / F (hold); release → open strings |
| Guitar strum | Space / Shift+Space | Downstroke / upstroke using the active keyboard (or pad) chord |
| Vocal | `N` `M` `,` `.` `/` | ДО / РЕ / МІ / ФА / СОЛЬ; hold sustains like the vocal pad |

Rules:

1. **Simultaneous:** held piano notes, drum hits, a held guitar chord + Space strums, and a held vocal may all be active in the same window. Audio buses already mix; do not mute sibling instruments when one receives a key. Walk keys never steal instrument codes.
2. **No focus required for keyboard sound.** Focus still reframes the camera, shows pads, and enables mesh / pad pointer play.
3. **One owner per physical key.** Never bind the same `KeyboardEvent.code` to two instruments or to both walk and play.
4. **Release hygiene:** `keyup`, window blur, visibility hidden, and focus exit clear held piano notes, keyboard guitar chord, and held keyboard vocal for that session path. Walk key sets clear on `keyup` / blur as today.
5. **Price chips:** first audible play of an instrument (keyboard or pointer) still queues the once-per-instrument chip. If that play happened without focus, show the chip after the visitor next leaves any instrument focus, or after ~2 s of silence from that instrument if they never focused it.
6. **`#keys-hint` (desktop-only):** reflect the jam map, e.g. клік · `E` · `L` · `Z X C V B` ударні · `1–8` піаніно · `Q R T Y U I`+пробіл гітара · `N M , . /` вокал.
7. **Mobile unchanged:** no jam keyboard; pads + focused multitouch only. Hide `#keys-hint` as today.

### Desktop

| Input | Action |
|-------|--------|
| Click floor / mobile joystick | Move mascot (idle) |
| Click instrument | Approach if not focused; mesh / pad play only when focused |
| `E` while idle | Approach nearest instrument in reach (no auto melody) |
| Drag / wheel / `+` `−` | Orbit / zoom (buttons stay visible while focused) |
| `Z` `X` `C` `V` `B` | Drums (jam — any focus / idle) |
| `1`–`8` | Piano whites (jam — hold sustains) |
| `Q` `R` `T` `Y` `U` `I` | Guitar chord hold (jam) |
| Space / Shift+Space | Guitar downstroke / upstroke (jam) |
| `N` `M` `,` `.` `/` | Vocal notes (jam — hold sustains) |
| Drag across strings while guitar-focused | Directional guitar strum (pointer) |
| `L` | Loop pedal (after first VIBE fill unlock) |
| HUD logo click | Toggle mascot tektonik dance |
| Esc | Dismiss onboard / close settings mixer (does **not** leave instrument focus) |
| ✕ (`#mobile-exit`) | Leave instrument focus (desktop + mobile) |

### Mobile

- Small left **move zone** + floating stick under finger.
- Soft one-finger orbit; two-finger dolly/pan.
- **ГРАТИ** when in reach → approach / focus. Outside reach it stays visually disabled but remains an accessible tap target: the first unavailable tap shows, once, `Підійди до інструмента ближче щоб заграти`.
- ✕ exit when entering / focused (not during approaching — avoids the same tap that pressed **ГРАТИ** hitting ✕ after the play button hides).
- Leaving any instrument focus must reset the floating joystick, thumb, active pointer identity, and movement vector before the walk controls return. This includes a lost / cancelled iOS pointer while the joystick is hidden during guitar focus.
- Touch instruments when focused (multitouch piano / drums; chord hold + independent strum / pluck for guitar).
- Focused piano / drums / guitar play surfaces claim their fingers: taps and glissandi / strums play without rotating or pinching the camera. Orbit and pinch stay available from empty canvas around the instrument.
- **Pedal / pads + instrument multitouch:** one finger on loop pedal, chord pad, vocal pad, or other HUD chrome and another on the kit/keys/strings must both work. Chord-pad presses also claim their finger so they cannot drive orbit. Do **not** `preventDefault` multitouch `touchstart` when any finger is on UI chrome (that drops the second finger’s pointer events). Loop pedal binds **`pointerdown`**, not `click`.
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
| Intro | Brand splash; **ВИЙТИ НА СЦЕНУ** starts the visual fly-in while audio stays dormant. A reload / same-tab return bypasses the splash and also leaves audio dormant until a real sound action. |
| Onboard | One first-run tip (`localStorage` `av2.onboard.v2`); mic pulse cue |
| HUD | Logo (click = mascot dance), VIBE, nav (кроки / ціни), **mascot button**, **settings mixer** (gear) |
| Settings mixer | Opens from the gear (**Налаштування**): **Світло** fader (0–100%, `av2.lights.v2`, default `78`; **PIXEL** defaults to `100` when unset), **Гучність** with per-instrument faders (0–100%; 100% is boosted gain), then the minimal **Графіка** selector |
| Modals | **Mascot customization**, graphics-reload confirmation, steps, rules, **interactive pricing mixer** |
| Chord / strum / vocal pads | Instrument play helpers while focused |
| Chip | Once-per-instrument price teaser carousel. Its full non-control surface opens its CTA; arrow controls retain carousel navigation and swipe still changes slides. The chip is queued on first play (pointer or keyboard), shown after leaving that instrument’s focus — or after ~2 s of silence from that instrument if the play was keyboard-only without focus. Skipped on fall, instrument switch, and mascot-editor leave. |
| Toast / tooltip | Short feedback |

### Графіка

- The settings mixer (gear icon) contains a minimal inline **ГРАФІКА** selector below the volume faders: **GLAMOUR**, **PIXEL**, and **AUTO**. Internally they retain the persisted values `high`, `low`, and `auto` in `localStorage` key `av2.quality.v2`.
- Choosing a different option opens the **Змінити якість графіки?** confirmation modal, which states that the page will reload. **СКАСУВАТИ** leaves the current mode unchanged; **ПЕРЕЗАВАНТАЖИТИ** immediately shows a spinner and **Застосовуємо зміни…**, locks the selector, then reloads the scene with that quality budget.
- **AUTO** uses a two-stage frame-pacing probe on every device (desktop, iPhone / iPad, and Android). It begins without expensive shadows or postprocessing, promotes only sustained smooth devices, and returns to the stable low budget if full effects miss cadence.
- **GLAMOUR** and **PIXEL** are explicit overrides. PIXEL is the stable 30 FPS, no-shadows / no-bloom budget; GLAMOUR enables the full scene budget.
- A live horizontal **Світло** fader sits at the top of the settings mixer (gear icon → **Налаштування**) and scales stage lights, footlight emissives, and beam opacity from **0–100%** without a reload. The value persists in `localStorage` key `av2.lights.v2` (default `78`); on **PIXEL**, the default is `100` only when no saved light preference exists. Instrument volumes remain in the same panel below the light fader.

### Pricing mixer

Driven by `prices.json`:

1. Pick instrument (**text-only** buttons — no SVG icons). Selecting an instrument (or opening the mixer on one) defaults to the cheapest option: разовий · shortest / lowest-priced duration (and the cheapest pack size for later абонемент).
2. Format: разовий / абонемент.
3. Duration; package size if абонемент. If the current duration is unavailable for the active format, fall back to the first (cheapest) duration.
4. Live ticket board (total + ≈ per lesson). Theme: purple vs gold by category. Every ticket includes a prominent comic-style **ЗАПИСАТИСЬ →** CTA that opens **Як записатися?**.
5. Both **Як записатися?** and **Ціни** show a clear **Напиши нам** block with separate Instagram and Messenger buttons. The steps panel also keeps **Правила студії →** as a secondary link.

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

- `av2.onboard.v2` records dismissal of the onboarding tip.
- A first-run click on **ЗРОЗУМІЛО** closes onboarding and opens the mascot customization modal once; `av2.mascot.after-onboard.v2` records that handoff. Other onboarding dismissals do not open it.
- `av2.mobile-play-hint.v2` records the one-time unavailable-**ГРАТИ** proximity hint.
- `av2.intro.v2` (`sessionStorage`) records that the splash was already entered in this tab so a same-tab reload can skip the intro.

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
| `testhooks` | Headless QA only: exposes `__THREE_GAME_TEST_HOOKS__` (setState: stage/piano/guitar/drums/mic/vibe/dance) + `__THREE_GAME_DIAGNOSTICS__` (renderer counts) for the canvas inspector; never active for visitors |

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
- Artifact: `css fonts img js uk vendor index.html prices.json piano-notes.json robots.txt sitemap.xml .nojekyll CNAME`.
- Custom domain: `artvibe.com.pl` → GitHub Pages (`voloshyninthesky.github.io`).
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
- With Spotify / Apple Music already playing, Enter, walking, camera controls, instrument focus, chord selection, and settings changes leave external audio uninterrupted and do not create an `AudioContext`.
- On platforms supporting Audio Session `ambient`, the external source continues while Art Vibe instruments play over it. On unsupported platforms, external audio remains uninterrupted at least until the first real Art Vibe sound action.
- No stuck-silent sessions after backgrounding or a mobile audio-route interruption: the next user gesture can rebuild and unlock the graph without a page refresh.
- No secrets in repo; prices are public marketing data.

### Piano framing / pose acceptance

- At `320×568`, `390×844`, `430×932`, `844×390`, and `1280×720`, the complete keybed and both hands remain inside the measured safe rectangle with at least `16 px` of visual margin.
- The projected keybed occupies `76–86%` of safe width on desktop / landscape and `84–92%` on phone portrait. Black / white key relationships and the white-key front edge remain readable.
- The first stable piano-focused frame exactly matches the camera transition endpoint. Re-enabling OrbitControls does not snap, rotate, zoom, or shift the target.
- HUD, loop pedal, zoom controls, safe-area insets, and ✕ do not cover the keybed or either hand. Opening a VIBE toast does not make the play area unusable. Price chips appear only after leaving focus, so they never cover the keybed during play.
- The seated pose remains believable at the mascot height / build extremes: pelvis on the bench, feet near the floor, hands over separate keyboard regions, relaxed shoulders, and no visible body / furniture intersections.
- Entering focus blends cleanly from the preceding walk / idle pose. Ten consecutive piano focus → ✕ cycles produce no transform drift, stuck seated limbs, or return-position regression.
- Resize, orientation, and `visualViewport` changes during entry update the transition destination; the focused frame never flashes through an obsolete preset or teleports between compositions.
- Under `prefers-reduced-motion`, framing and pose remain complete and readable without breathing / wrist motion or a long transition.

### Guitar acceptance

- In a five-person first-use test, at least four players make an open strum within `8 s` and a chorded strum within `20 s` after the camera settles, without verbal help.
- The first stable guitar-focused frame must match the camera transition endpoint; enabling orbit controls and the focused azimuth limits must not snap, reframe, or otherwise move the view after the animation.
- No **pointer / pad / mesh** guitar sound occurs outside stable guitar focus, including distant taps, camera transitions, and focus on another instrument.
- **Desktop keyboard** guitar chords (`Q R T Y U I`) and Space / Shift+Space follow the jam map: they may sound while idle or while focused on any instrument, and must remain silent only when the stage has not started, a modal is open, or the event target is editable / a control.
- A complete stroke excites each crossed eligible string once and in directional order; motion along the strings stays silent. Muted strings neither sound nor animate.
- Soft and hard strokes are audibly distinct. Reversing direction can immediately produce the reverse string order without false retriggers.
- Twenty consecutive chord-hold + second-pointer strums work on supported iPhone Safari and Android Chrome without page zoom, orbit motion, lost pointers, or a stuck chord.
- Chord targets are at least `48 × 48` CSS px with `8 px` separation. The strum zone remains usable at the smallest supported viewport and after portrait / landscape changes.
- Pointer cancel, focus exit, visibility loss, and page backgrounding clear every held chord, active stroke, and captured guitar pointer.
- Repeated guitar focus → ✕ exits on iPhone Safari restore the joystick to its non-floating home state; a lost joystick pointer-up may never leave only the blurred stick backdrop behind.
- Input-to-audio scheduling is at most `16 ms`; target measured input-to-audible latency is at most `50 ms` desktop and `80 ms` on reference mobile devices.
- Audio and per-string visual onset differ by at most `33 ms`. Reduced motion removes idle shimmer, not essential play feedback.
- A physical string has at most one active voice; retrigger and mute ramps do not click. First play performs no synchronous synthesis-table generation in the input handler.

### Desktop keyboard jam acceptance

- After Enter on a desktop viewport, with no modal open, holding `1` + tapping `Z` + holding `Q` and pressing Space produces piano + drum + guitar audio in one gesture sequence without focusing any instrument.
- Holding `N` (vocal) together with `3` (piano) and tapping `X` (snare) keeps all three buses audible; focusing piano must not silence drums / vocal / guitar keyboard routes.
- Mascot movement has no keyboard bindings: use click-to-move or the mobile joystick. No `KeyboardEvent.code` is shared across approach, loop, piano, drums, guitar, or vocal maps (`E` stays approach-only while idle; guitar Em is `Q`).
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
4. The feature stays lightweight: procedural geometry, shared materials, curated choices, local persistence, and no account or asset download.

### Information architecture and flow

- Use three short categories: **ОБЛИЧЧЯ** (hair, hair color, smile, skin tone), **ОДЯГ** (outfit, color overrides, accessories), and **ФОРМА** (height, build). Do not force a step-by-step wizard; the visitor may switch categories in any order.
- Keep the category rail, title / close control, and bottom action bar visible. Only the category contents scroll.
- The first-run handoff after **ЗРОЗУМІЛО** uses this same editor and never requires a choice. **ГОТОВО** is visible immediately so the visitor can keep the default and reach the stage.
- Selecting an option updates an in-memory draft and the 3D preview immediately. It does not write `localStorage` on every tap or slider tick.
- **ГОТОВО** writes the validated draft, closes the editor, restores the previous stage camera, and may show the short toast `Неперевершено!`.
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
- Replace ambiguous visible hair labels with **Довге / Боб / Коротке** while retaining the existing runtime IDs.
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
| **Identity and delight** | Four curated skin tones applied to face and both hands; five hair colors; three eye colors on a dedicated iris material; three authored smiles (soft default, open singing wide, calm neutral); drag-to-rotate preview; compatible random look |
| **Wardrobe** | Accessories `немає / сережки / окуляри / навушники` (glasses have temple arms); three authored hairstyles with a restyled shared fringe and per-style lock placement; four varsity palettes (**Сцена / Фірмовий / Джинс / Ніч**) on the placket / chest-stripe / hem-band / cuffs garment; four-option primary / accent overrides; shoe-color override with a palette-default option |

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
