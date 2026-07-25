# Art Vibe Studio — Specification

Interactive marketing experience for **Art Vibe Studio** (music lessons): a WebGL 3D stage where visitors walk a mascot, play instruments, and open booking info (steps, rules, prices).

- **Live:** https://vibe.ton.zone  
- **Locale:** Ukrainian (`lang="uk"`)  
- **Currency:** PLN (displayed as «зл»)  
- **Contact CTA:** Instagram [@artvibe.pl](https://www.instagram.com/artvibe.pl/)  
- **Credit:** «created by vadymbek» on the slideshow reverse → https://vadymbek.top  

Slogan: *Вчись творити і твори навчаючись.*

---

## 1. Product goals

1. Let a visitor **feel the studio** (stage, instruments, sound) in under a minute.
2. Teach one action: **approach / tap an instrument to play**.
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
index.html          # shell, modals, HUD
css/style.css       # design system + overlays
fonts/              # self-hosted faces
img/                # slideshow photos
js/
  main.js           # scene, interaction, loop, onboard
  instruments.js    # procedural drums / piano / guitar / mic
  audio.js          # Web Audio synth (no samples)
  ui.js             # HUD, modals, chip, toast
  pricing.js        # interactive price mixer
prices.json         # lesson prices + promos
piano-notes.json    # E / ГРАТИ piano phrase
vendor/three/       # vendored Three.js
deploy/nginx/       # vibe.ton.zone release root
```

**Stack:** Three.js (WebGL), OrbitControls, EffectComposer + UnrealBloomPass, Web Audio API.

---

## 4. Scene

### Stage

- Wooden platform, gold front trim, footlights (emissive + point lights).
- Back wall, curtains, valance, speaker stacks.
- Backdrop **slideshow** (shader crossfade + Ken Burns) with gold frame and brand plate.
- Soft neon **vadymbek** credit on the **back** of the screen (clickable link hit target).
- Procedural dust; gentle idle motion on curtains / instruments (respects `prefers-reduced-motion`).

### Instruments (procedural meshes)

| Kind | Play |
|------|------|
| `mic` / vocal | Pad notes + click; formant-ish synth |
| `guitar` | Fretted neck taps (12-TET), body swipe-strum, Space chord |
| `piano` | Keys + `1–8` whites; melody from `piano-notes.json` on E / ГРАТИ |
| `drums` | Kit parts + `A–G` shortcuts |

Hover (fine pointer): emissive glow. Click / tap: sound + optional walk-to-instrument focus camera.

### Mascot

Low-poly avatar labeled «Ти». Walk with arrows / click floor / mobile stick. Can fall off stage edge (short recovery). Instrument focus seats the mascot and reframes the camera.

---

## 5. Interaction map

### Desktop

| Input | Action |
|-------|--------|
| Arrows / click floor | Move mascot |
| Click instrument | Play + approach |
| `E` | Play nearest instrument (performance phrase) |
| Drag / wheel | Orbit / zoom |
| `A–G` | Drums |
| `1–8` | Piano whites |
| Space | Guitar chord |
| `L` | Loop pedal (after first VIBE fill unlock) |
| Esc | Leave instrument view / dismiss tip |

### Mobile

- Virtual stick + **ГРАТИ** button.
- Touch instruments (multitouch on piano / drums / fretted guitar when focused).
- HUD collapses to menu drawer; stick/zoom quiet when instrument-focused.

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
| HUD | Logo, VIBE, nav (кроки / правила / ціни), sound mute |
| Modals | Steps, rules, **interactive pricing mixer** |
| Chip | Once-per-instrument price teaser carousel → opens pricing |
| Toast / tooltip | Short feedback |

### Pricing mixer

Driven by `prices.json`:

1. Pick instrument (maps to vocal-guitar or drums-piano category).
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

Ordered list of `{ "note", "freqHz" }` for the piano performance phrase.

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

- **Host:** nginx on VPS, site `vibe.ton.zone`.
- **Pattern:** immutable release dirs  
  `/var/www/vibe.ton.zone/releases/<UTC-timestamp>/`
- **Config:** `deploy/nginx/vibe.ton.zone.conf` points `root` at current release.
- **Ship:** tar `css fonts img js prices.json piano-notes.json vendor index.html` → release; scp nginx conf; `nginx -t && systemctl reload nginx`.
- **Cache bust:** bump `?v=` on `css/style.css`, `js/main.js`, and module imports as needed. Force-upload `index.html` if CDN/browser shows a stale shell.

Local: `python3 -m http.server 8000 --bind 127.0.0.1` → http://127.0.0.1:8000

---

## 11. Quality bar

- Works on desktop and mobile Safari / Chrome.
- Keyboard focus visible on overlay controls.
- `prefers-reduced-motion`: cut ambient / onboard pulse animations.
- WebGL fail → `#webgl-fail` panel.
- No secrets in repo; prices are public marketing data.

---

## 12. Change checklist

When changing behavior:

1. Update code + `?v=` cache query.
2. Update this `SPEC.md` if contracts or UX change.
3. Deploy release + verify live HTML contains the new `?v=` and expected markup (`onboard`, pricing mixer, etc.).
