# Hyperframes Composition Brief: Art Vibe Studio

## Objective
Create a short launch-style brag video for Art Vibe Studio — the music school site that
looks like 2007 and hides a WebGL theatre.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 22 seconds

## Source Material
- Project root: `/Users/vadymvoloshyn/fun/av2`
- Primary files read: `index.html`, `css/lessons.css` (2007 skin values), `css/style.css`
  (stage design tokens), `notes/` vault (Mascot, Decisions, Lesson site), `prices.json`
- Product name: Art Vibe Studio
- Tagline / strongest claim: «Вчись творити і твори навчаючись.»
- Key UI or visual moment to recreate: the cream 2007 `.window` with gold ★ title bar and
  blink ◄ ►; the reveal card («Знайомся, це Вайбер Легендарний.» + ЗРОЗУМІЛО)
- Real captures (already in `brag-output/assets/`, 1280×720 PNG, from the live stage):
  `wardrobe.png`, `strain.png`, `burst.png`, `legendary-stage.png`, `guitar.png`,
  `drums.png`, `mic.png`, `piano.png`, `outro-stage.png`
- Copy that must appear verbatim:
  - «★ Ласкаво просимо ★»
  - «Art Vibe Studio — культурно-освітній простір у Лодзі»
  - «Вийти на 3D-сцену»
  - «Знайомся, це Вайбер Легендарний.»
  - «Вайбери люблять ходити по сцені та грати на інструментах.»
  - «ЗРОЗУМІЛО»
  - «Напиши в директ: „Хочу на пробний урок"»
  - «Вчись творити і твори навчаючись.»
  - artvibe.com.pl
- Ticker text: «★ Уроки музики у Лодзі ★ вокал ★ гітара ★ фортепіано ★ ударні ★ для дітей
  і дорослих ★ Art Vibe Studio · Łódź ★»
- Prices row (from prices.json): Вокал — 30 хв 50 зл · 45 хв 75 зл · 55 хв 90 зл; trial
  strip «Пробний урок — 50 зл»

## Creative Direction
- Tone preset: deadpan
- Creative direction: "the tone of the project style itself" — period-correct 2007 web
  chrome as the frame, the vault's dry craftsman voice in captions, Ukrainian throughout
- Interpretation: no exclamation in copy; energy from cuts and the burst, not the writing;
  2007 chrome rendered faithfully (real CSS values), never winked at
- Angle: «Виглядає як 2007. Працює як театр.» Opens as a straight-faced 2007 page, one
  click drops the act (wardrobe → burst → legendary → instruments), then folds back into
  2007 windows for prices and the DM CTA as if nothing happened
- Hook: hero window pop with «★ Ласкаво просимо ★», ticker crawling, caption «Сайт — як у 2007.»
- Outro / punchline: prices table → «Напиши в директ: „Хочу на пробний урок"» → end card
  with slogan «Вчись творити і твори навчаючись.»
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign; the 2007 skin is the design

## Visual Identity
- 2007-frame background: `#4a1263` (purple-deep); optional scattered quaver-note wallpaper feel
- Window surface: `#fdfbf7` cream / `#ffffff` paper; gold lines `#b9a06a` / `#d8cbae`
- Accent: gold `#d1a13b` / `#f0d17d`; purple `#9e33ca`; window title gradient purple accent
  (`#ad52d2` → `#7e29a2`)
- Text: ink `#241a2b`, soft `#5b4b66`; links `#0b3fa8`
- Stage-scene background: `#0a0612`
- Display font (2007 frame): Trebuchet MS / Lucida Grande / Verdana stack
- Body font (2007 frame): Verdana / Geneva / Tahoma stack
- Reveal card / stage HUD: bold rounded geometric sans (site uses Unbounded-like display);
  card surface cream with gold button, tier word in gold
- Visual references: `.window` + `.window-title` chrome, `.ticker`, `.retro-table`,
  `.trial-offer` gold strip, `.badge-new` NEW! badge, blinking ◄ ►

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. «Сайт — як у 2007» — 3.5s — hero window pop, ticker, caption
2. Клік — 2.5s — cursor clicks «Вийти на 3D-сцену», hard cut to wardrobe capture
3. Шафа віддає героя — 4.5s — strain punch-in + rattle → burst on cue → reveal card HTML
4. Чотири інструменти — 6.5s — beat-cut montage guitar/drums/mic/piano, headline
   «Чотири інструменти. Усі грають.», gold footnotes per cut
5. Ціни, директ, слоган — 5.0s — prices window, DM CTA, end card with slogan

## Audio
- Audio role: upbeat rhythmic bed carrying the cuts (music school — music must be confident)
- Audio arc: full posture from 0s → slight duck under strain → hit on burst → groove under
  montage → fade out over last 1.5s under the slogan
- Music: `happy-beats-business-moves-vol-11-by-ende-dot-app.mp3` (bundled, ~115 BPM)
- Music treatment: start 0s; duck ~-3dB during strain (7–9.5s); full on burst; fade 21→22.5s
- Music cue guidance: preset at
  `~/.claude/skills/brag/assets/music/cues/happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.json`
  Strong cues to consider: 1.60s (caption), 3.70s (click/cut), 8.96–9.50s (burst),
  12.65s (mic shot), 17.91s (prices pop), 22.65s (end). Beat grid ~0.525s.
- Audio-reactive treatment: none — deadpan restraint; the cuts carry the rhythm
- Audio-coupled moments:
  - Scene 1 — window pop + caption on beats
  - Scene 2 — cursor click on 3.70s strong cue, hard cut with it
  - Scene 3 — rattle crescendo into burst at ~9.50s (beat-locked), card whoosh after
  - Scene 4 — montage cuts on the beat grid (~every 3rd beat), footnote swaps with cuts
  - Scene 5 — prices window pop at 17.91s; soft logo hit on end card
- SFX selection guidance: dry UI pops for windows, one clean click, low rattle for strain,
  one impact for burst, soft whoosh for card, subtle final hit; match motion, keep sparse
- SFX analysis guidance: `~/.claude/skills/brag/assets/sfx/sfx-analysis.md`; prefer low
  high-frequency-risk files for repeated pops
- Exact SFX choice: Hyperframes decides filenames, timestamps, density, volume
- Audio files: copy chosen music + SFX into `brag-output/composition/assets/`

## Hyperframes Instructions
Follow `hyperframes-core` / `hyperframes-animation` / `hyperframes-creative` /
`hyperframes-keyframes` / `hyperframes-cli`. /brag is its own workflow — no intent
interview. Requirements: show real UI/copy (captures + verbatim lines above); keep text
readable (floors in brag-plan); 22s total; music + sparse SFX; 1–3 beat-locks max;
`npx hyperframes check` must pass with zero errors before render.
