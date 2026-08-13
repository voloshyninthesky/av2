# Brag Plan: Art Vibe Studio

## What is this app?

A music school's site in Łódź that is deliberately two things at once: four lesson pages
wearing a proud 2007-era skin (★ tickers, window chrome, retro tables, zero JS), and behind
one gold button — a WebGL theatre where a magic wardrobe hands you a character with a rarity
tier and you play four procedural instruments before booking a 50-зл trial lesson in a DM.

## The angle

**«Виглядає як 2007. Працює як театр.»** The video wears the site's own two costumes in
order: it opens as a straight-faced 2007 web page (real chrome, real copy, real ticker),
then one click on the real «Вийти на 3D-сцену» button drops the act — wardrobe, burst,
legendary Вайбер, four instruments — and then, deadpan, folds back into 2007 windows to
quote real prices and the real DM call-to-action. The joke is that nothing about the video
acknowledges the contrast. This is the project's own tone: the site really does this.

## Hook (first 2-3 seconds)

A cream `.window` pops onto the deep-purple quaver wallpaper: title bar
«★ Ласкаво просимо ★» with the blinking ◄ ►, headline «Art Vibe Studio», the real ticker
crawling underneath («★ Уроки музики у Лодзі ★ вокал ★ гітара ★ …»). Deadpan caption:
**«Сайт — як у 2007.»** It must look period-correct, not parodied — the site's actual CSS
values.

## Key moments (the middle)

- The real «Вийти на 3D-сцену» button (gold, NEW! badge) gets clicked by a cursor —
  hard cut to a real capture: the magic wardrobe alone in the key spotlight.
- The wardrobe strains — light through the door seam (real capture), punch-in — then the
  burst frame: doors flung open, arms spread, confetti (real capture `burst.png`).
- The reveal card, recreated crisp in HTML with the product's actual copy:
  **«Знайомся, це Вайбер Легендарний.»** + ЗРОЗУМІЛО button.
- Four fast real-capture cuts on the beat: guitar close-up, drums over-the-shoulder,
  mic + companion bird, walking to the piano. One deadpan line holds over them:
  **«Чотири інструменти. Усі грають.»** Small gold footnotes flick per cut, quoting the
  vault: «коло квінт — справжнє» / «ритми — евклідові» / «голос — безперервний» /
  «зведено у LUFS».

## Outro / punchline

Back to 2007 without comment: a retro price-table window pops (real prices: Вокал 50/75/90 зл),
then the gold trial strip with the site's literal CTA: **«Напиши в директ: „Хочу на пробний
урок"»**. End card on deep purple: AV logo mark, **artvibe.com.pl**, and the slogan
**«Вчись творити і твори навчаючись.»** The slogan is the last thing standing.

## User flow worth showing

1. **Entry** — land on the 2007 hub, click «Вийти на 3D-сцену» (simulated cursor click).
2. **Key action** — receive a character from the wardrobe (strain → burst → card), then
   play: the four instrument close-ups are the product doing its thing.
3. **Result** — prices window → DM CTA. Booking is a conversation, not a checkout.

## Tone

- Preset: **deadpan**
- Creative direction: user-directed — "the tone of the project style itself": period-correct
  2007 web chrome for the frame, the vault's dry craftsman voice for every caption,
  Ukrainian copy throughout (the site's language).
- Interpretation: long-enough holds, one line at a time, no exclamation in the writing —
  the energy comes from the cut to the stage and the burst, never from the copy. The 2007
  chrome is rendered faithfully, not winked at.

## Format: landscape — 1920x1080
## Duration: 22s

## Visual identity (from the project)

- Background (2007 frame): `#4a1263` (--purple-deep) with the quaver-note tiled wallpaper feel
- Window/card surface: `#fdfbf7` (--cream) / `#ffffff` (--paper)
- Accent: `#d1a13b` (--gold), `#f0d17d` (--gold-light), purple `#9e33ca`
- Text: `#241a2b` (--ink), soft `#5b4b66`
- Stage scenes bg: `#0a0612` (--scene-bg)
- Display font: Trebuchet MS stack (2007 frame); the stage/reveal card uses the site's
  rounded display feel (Unbounded-like) — bold geometric sans
- Body font: Verdana stack (2007 frame)
- Strongest visual element: the cream `.window` with gold ★ title bars vs. the real stage
  captures in `brag-output/assets/` (wardrobe, strain, burst, legendary, 4 instruments,
  outro stage)

## Share copy (draft)

Сайт музичної школи, який виглядає як 2007 — і ховає за однією кнопкою 3D-сцену, чарівну
шафу і легендарного Вайбера. Вчись творити і твори навчаючись → artvibe.com.pl

## Audio direction

- Role: upbeat rhythmic bed carrying the cuts; the video is for a music school, so the
  music must feel confident, not wallpaper.
- Music: `happy-beats-business-moves-vol-11-by-ende-dot-app.mp3` (~115 BPM, bundled).
- Music treatment: starts at full posture on frame 0 under the hook window pop, ducks
  slightly under the strain beat for suspense, hits hard on the burst, fades out over the
  last 1.5s on the slogan.
- Music cue guidance: preset cues read from the bundled cue file. Strong cues: 1.60s
  (hook settles), 3.70s (button click / cut to stage), 8.96–9.50s (burst), 12.65s
  (montage midpoint), 17.91s (prices window pop), 22.65s (end fade). Beat grid ~0.525s
  apart; montage cuts land on every third beat (~1.6s per cut) so footnote text keeps its
  0.8s settled floor.
- Audio-reactive treatment: none — deadpan restraint; the cuts carry the rhythm.
- SFX posture: sparse, motion-matched. Window pops (dry UI blip), one cursor click,
  wardrobe rattle under strain, one impact + confetti on burst, soft card whoosh for the
  reveal card, final soft logo hit. Exact files chosen at composition time from the
  skill's sfx library.
- Audio-coupled moments: window pops on beats; strain rattle crescendo into the 9.5s cue;
  the four montage cuts on the beat grid; ЗРОЗУМІЛО card arrival with the whoosh.
- Restraint rule: no risers, no whoosh-on-every-text, no comedy stingers — the deadpan
  reads only if the audio stays matter-of-fact.

## Storyboard

### Scene 1 — «Сайт — як у 2007» — 3.5s
Deep-purple wallpaper. The hero `.window` pops in (scale-settle): gold-gradient title bar
«★ Ласкаво просимо ★» + blinking ◄ ►, cream body with «Art Vibe Studio — культурно-освітній
простір у Лодзі», the real ticker crawling at the top edge. Caption bottom-left in cream:
«Сайт — як у 2007.» (settled ≥1.2s). A NEW! badge wiggles by the stage button.
Sequential/interaction: yes — window pops first, ticker already crawling, caption lands on
the 1.60s cue.
Audio intent: instant momentum; the pop is the downbeat.
Audio-coupled idea: window pop + caption land on beats.
Music: upbeat, full posture from 0s.
Transition mood: hard (the click IS the transition) → Scene 2

### Scene 2 — Клік — 2.5s
Close crop of the real gold button «Вийти на 3D-сцену» with NEW! badge. A cursor slides in,
clicks (button depresses). On the click: hard cut to `wardrobe.png` — the wardrobe alone
mid-stage in the spotlight, slow push-in. No caption; let the stage speak.
Sequential/interaction: yes — simulated cursor click on the real button.
Audio intent: one dry click, then the room opens (subtle low pad from the track's own bed).
Audio-coupled idea: click lands on the 3.70s strong cue.
Transition mood: hard cut on click → Scene 3

### Scene 3 — Шафа віддає героя — 4.5s
`strain.png` with a tight punch-in on the glowing door seam, small rattle shake (2–3px),
scale building — then on the 9.50s cue: `burst.png` slams in (doors open, arms wide,
confetti), quick white flash. The reveal card slides in from the right, recreated in HTML:
«ART VIBE STUDIO / ТВІЙ ГЕРОЙ», headline «Знайомся, це Вайбер Легендарний.», line «Вайбери
люблять ходити по сцені та грати на інструментах.», gold ЗРОЗУМІЛО button. Card holds ≥1.6s.
Sequential/interaction: yes — strain → burst → card, three beats in order.
Audio intent: suspense (rattle) → payoff (impact + confetti) → calm (card whoosh).
Audio-coupled idea: burst exactly on the 9.50s strong cue.
Transition mood: clean → Scene 4

### Scene 4 — Чотири інструменти — 6.5s
Four real captures cut on the beat (~1.6s each): `guitar.png` (slow pan), `drums.png`
(push-in), `mic.png` (hold — the companion bird is visible), `piano.png` (walking to the
piano, aura trailing). One steady headline holds across all four, lower third:
«Чотири інструменти. Усі грають.» Under it, a small gold footnote swaps per cut:
«коло квінт — справжнє» / «ритми — евклідові» / «голос — безперервний» / «зведено у LUFS».
Each footnote settled ≥0.9s (cuts at every third beat).
Sequential/interaction: yes — beat-cut montage, footnote swap per cut.
Audio intent: the groove section; the cuts are the percussion.
Audio-coupled idea: cuts on the beat grid; 12.65s strong cue lands on the mic shot.
Transition mood: hard cut back to 2007 chrome → Scene 5

### Scene 5 — Ціни, директ, слоган — 5.0s
The 2007 frame returns without comment. A `.window` titled «Ціни» pops with the real
retro-table row: Вокал — 50 зл / 75 зл / 90 зл, and the gold trial strip «Пробний урок —
50 зл». Then the CTA line in a second window: «Напиши в директ: „Хочу на пробний урок"»
(the site's literal instruction, settled ≥1.5s). Crossfade to the end card on deep purple:
AV logo mark, artvibe.com.pl, slogan «Вчись творити і твори навчаючись.» — the slogan
holds to the end as music fades.
Sequential/interaction: yes — prices window pops (17.91s cue), CTA window second, end card
crossfade at ~20.5s.
Audio intent: resolve; fade starts ~21s, out by 22.5s.
Audio-coupled idea: prices window pop on the 17.91s strong cue; soft logo hit on the end card.
Transition mood: soft crossfade → end.

**Music mood for this video:** upbeat, matter-of-fact — the deadpan is in the copy, not the track.
**Audio summary:** one continuous bed from frame 0; pops and cuts ride its grid; a single
suspense-and-payoff arc at the burst; clean fade under the slogan.

Scene sum: 3.5 + 2.5 + 4.5 + 6.5 + 5.0 = **22.0s**
