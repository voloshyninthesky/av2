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
index.html          # shell, modals, HUD, pads, sound mixer
css/style.css       # design system + overlays
fonts/              # self-hosted faces
img/                # slideshow photos
js/
  main.js           # scene, interaction, loop, onboard, pads
  instruments.js    # procedural drums / piano / guitar / mic
  audio.js          # Web Audio synth + per-instrument buses
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

---

## 4. Scene

### Stage

- Wooden platform, gold front trim, footlights (emissive + point lights).
- Back wall, curtains, valance, speaker stacks.
- Backdrop **slideshow** (shader crossfade + Ken Burns) with gold frame and brand plate.
- Soft neon **vadymbek** credit on the **back** of the screen (clickable link hit target).
- Procedural dust; gentle idle motion on curtains / instruments (respects `prefers-reduced-motion`).
- Start camera is pulled in by three “+” zoom steps (`START_ZOOM_FACTOR = 0.82³`). Soft orbit (lower rotate/zoom speed, higher damping). Extra zoom-in headroom vs older builds.

### Instruments (procedural meshes)

| Kind | Play (only while **focused** on that instrument) |
|------|------|
| `mic` / vocal | Vocal pad notes; formant-ish synth |
| `guitar` | Fretted neck taps; body swipe-strum; hold chord pad while strumming; Space strum |
| `piano` | Keys + `1–8` whites (multitouch when focused) |
| `drums` | Kit parts + `A–G` (multitouch when focused) |

Hover (fine pointer): emissive glow.  
Distant tap / swipe on an instrument: **walk + camera approach only** — no preview sound. Sound starts after focus.

### Guitar chord pad

`#chord-pad` (Em, Am, C, D, G, F):

- **Hold** a chord button → that voicing applies to the next strum.
- **Release** → open strings again (no sticky “selected chord”).
- Pad press alone does **not** strum.
- While guitar-focused: browser pinch-zoom blocked (`guitar-focused` / `guitar-fretting`, Safari `gesture*`, orbit `enableZoom = false`).

### Mascot

Low-poly avatar labeled «Ти» (matched skin hands on both arms; no jacket-panel “fake hand”). Walk with arrows / click floor / mobile stick. Can fall off stage edge (short recovery). Instrument focus seats the mascot and reframes the camera.

---

## 5. Interaction map

### Desktop

| Input | Action |
|-------|--------|
| Arrows / click floor | Move mascot |
| Click instrument | Approach if not focused; play only when focused |
| `E` | Approach nearest instrument in reach (no auto melody) |
| Drag / wheel / `+` `−` | Orbit / zoom (buttons stay visible while focused) |
| `A–G` | Drums |
| `1–8` | Piano whites |
| Space | Guitar strum (held chord or open strings) |
| `L` | Loop pedal (after first VIBE fill unlock) |
| Esc | Dismiss onboard / close sound mixer (does **not** leave instrument focus) |
| ✕ (`#mobile-exit`) | Leave instrument focus (desktop + mobile) |

### Mobile

- Small left **move zone** + floating stick under finger.
- Soft one-finger orbit; two-finger dolly/pan.
- **ГРАТИ** when in reach → approach / focus.
- ✕ exit when approaching / entering / focused.
- Touch instruments when focused (multitouch piano / drums / fretted guitar).
- Chord pad while guitar-focused; vocal pad while mic-focused.
- HUD collapses to menu drawer on small screens.

### VIBE meter

Playing adds vibe. At 100%: surprise (fireworks / loop unlock). Meter decays when idle.

### Loop pedal

Unlocked once after first vibe fill. Record layers while playing; pause / clear tools. Key `L` on desktop.

---

## 6. UI overlays

| Overlay | Purpose |
|---------|---------|
| Intro | Brand splash; **ВИЙТИ НА СЦЕНУ** starts audio + fly-in |
| Onboard | One first-run tip (`localStorage` `av2.onboard.v1`); mic pulse cue |
| HUD | Logo, VIBE, nav (кроки / правила / ціни), **sound mixer** |
| Sound mixer | Per-instrument faders + master mute (speaker button) |
| Modals | Steps, rules, **interactive pricing mixer** |
| Chord / vocal pads | Instrument play helpers while focused |
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

---

## 10. Deploy

**Primary:** GitHub Pages (Actions).

- Workflow: `.github/workflows/deploy-pages.yml` on push to `main`.
- Artifact: `css fonts img js vendor index.html prices.json piano-notes.json .nojekyll CNAME`.
- Custom domain: `vibe.ton.zone` → CNAME `voloshyninthesky.github.io` (Porkbun DNS).
- Enforce HTTPS in Pages settings after DNS verifies.
- **Cache bust:** bump `?v=` on `css/style.css`, `js/main.js`, and module imports as needed.

**Legacy (optional):** nginx release dirs under `/var/www/vibe.ton.zone/releases/<UTC>/` via `deploy/nginx/` — superseded by Pages for the live custom domain.

Local: `python3 -m http.server 8000 --bind 127.0.0.1` → http://127.0.0.1:8000

---

## 11. Quality bar

- Works on desktop and mobile Safari / Chrome.
- Keyboard focus visible on overlay controls.
- `prefers-reduced-motion`: cut ambient / onboard pulse animations.
- WebGL fail → `#webgl-fail` panel.
- Block Mobile Safari page pinch / double-tap zoom that breaks the fixed layout; guitar focus blocks page pinch while fretting/strumming.
- No secrets in repo; prices are public marketing data.

---

## 12. Change checklist

When changing behavior:

1. Update code + `?v=` cache query.
2. Update this `SPEC.md` if contracts or UX change.
3. Push to `main` (Pages deploy) and verify live HTML contains the new `?v=` and expected markup (`onboard`, pricing mixer, chord pad, sound mixer, etc.).
