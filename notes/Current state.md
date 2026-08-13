---
tags: [status]
updated: 2026-08-13
---

# Current state

Snapshot as of **2026-08-13**. This is the one note that goes stale by design — update it or
delete it, don't trust it blind. Check `git log` and `git status` first.

`main` is on **`7f680a9`** plus the one-bird commit, the tree is on stamp
**`20260813-19`** (265 occurrences), 142 Node
tests pass across 11 suites, and the working tree is clean. Both of the changes below are
deployed and **verified live**, not just green in Actions:

```bash
curl -s https://artvibe.com.pl/stage/ | grep -o 'v=[0-9-]*' | sort -u          # expect 20260813-19
curl -sI https://artvibe.com.pl/stage/assets/wardrobe.glb                       # 200, 2.0 MB ✓
curl -sI https://artvibe.com.pl/vendor/three/examples/jsm/loaders/GLTFLoader.js # 200 ✓
```

That second curl matters more than it looks: `stage/assets/` is a **new directory**, and the
deploy workflow copies an explicit file list. It ships because `stage` and `vendor` are
already on that list — a new *top-level* directory would not have been.

## In flight

**The gift hatches out of a wardrobe now, and the tier is worn on stage.** Two commits,
`408e43f` and `4f92483`, both on `main` and live. Together they answer "make rare / epic /
legendary actually feel rare" without a single new post-processing pass.

*The reveal* ([[Decisions]] "The egg became a magic wardrobe"): a magic wardrobe rattles,
light forces its way out of the door seam, and the doors fling open with the character in the
doorway. Every beat, the rate scalar and the write-on-burst rule are unchanged. The prop is
**two layers on purpose** — a procedural cabinet built at boot that the ceremony always runs
on, plus a generated GLB (`threejs-3d-generator` / Tripo, 10.7k tris) that dresses it when it
lands. The generated mesh is fused so its doors cannot hinge; it owns the shut states and
hands back to the procedural carcass on the burst frame, under the flash.

*The tier on stage* ([[Decisions]] "The aura became a companion bird", which supersedes "A tier is
worn" and "The tier mark had to move"): the additive aura was built, quieted, and then
**deleted whole** in favour of the companion birds it shipped alongside —
`js/scene/mascot-aura.js` is gone, `js/scene/mascot-companion.js` owns the mark, and the
outfit trim glow went with it. The ladder is **species + landing spot + glow**, one bird per
tier: a timid sparrow that keeps to the boards for rare, a swallow that lands on the shoulder
for epic, the crested golden songbird that perches on the crown of the head for legendary —
each over a halo that brightens with the tier (0.30 / 0.46 / 0.66). Common stays alone. The
count ladder (one / two / three birds) was tried and pulled: a flock made the stage busy, and
the count was doing work the glow does more quietly. Legendary now costs +10 draw calls /
+621 triangles over common, with geometry and texture counts identical at every tier.
Verified in the pane at 1280×720: all four tiers, the wider epic orbit clearing the resting
hands, the head perch, and zero allocations across tier switches. Generation was declined
for both the birds and a regenerated mascot body under the user's "don't use if it makes no
sense" rule — reasoning in the [[Decisions]] entry. The three species come from one
builder with authored silhouette options (crest, tail, slimness, cap), and a **quiet accent
halo** sits under the bird's owner (one additive ring, breathing ±8%) — it took over the rung
the bird count used to hold, and must never regrow the runes, ripple, rays or trim it once
had. Verified on all three marked tiers; common stays bare.

What to remember:

- **The dress-up window closes at the strain, not at ceremony start.** A first-run gift opens
  straight out of the boot fly-in, so gating the swap on "is the wardrobe visible" meant the
  only visitor who ever watches a ceremony always got the procedural prop.
- **The generator ignores "front facing."** Both generated wardrobes came out on different
  local axes. The facing is a measured constant, verified by rendering the asset at four yaws
  under the stage lights, and the shell is scaled *per axis* into the procedural box so the
  burst-frame cut cannot jump size or footprint.
- **No new attribute slots.** A per-tier headpiece was built, looked good, and was thrown
  away; the rule is now in [[SPEC]] §13. Tier upgrades go into what the character already has.
- **The tier mark went through five shapes in one session** — aura, quieter aura, creatures,
  a bird-count ladder, and finally one bird per tier. Every intermediate was verified in the
  pane before the next one replaced it; read the [[Decisions]] entry before re-proposing any
  of the discarded ones.

Verified over CDP in local Chrome at 1000×680 and 900×620: all four tiers, a full first-run
legendary ceremony beat by beat (including a slowed-clock pass over the burst frame), the
shell→carcass handover, the wardrobe facing the camera at four azimuths (facing dot 1.000
each), and the renderer counters above. **Not** verified: a real touch device, mobile
viewports, `prefers-reduced-motion` in a live browser (the reduced branch is read but not
rendered), and how the 2 MB wardrobe download behaves on a slow mobile connection — the
procedural fallback is what covers that case, and it has not been exercised against a real
throttled network.

**The Browser pane's GPU wedged mid-session again** — every load landed on `#webgl-fail` with
`BindToCurrentSequence failed`, new tabs included. The whole verification above ran through
local headless Chrome over CDP with `--use-angle=swiftshader`, PIXEL pinned from `/404.html`
first. → [[Gotchas]], and the memory note that already carried this recipe.

**The voice got its axis** ([[Decisions]] "The voice stopped being five buttons"). Vocals was
the last hard-coded instrument on the stage — five `data-vocal-freq` attributes in
`stage/index.html`, frozen in C major — and now it has `#voice-ribbon`: one continuous field,
pitch up and vowel across, in the same dock the two wheels share. **One dock, three surfaces,
exactly one shown**, asserted by `__ribbonDebug().docked`. New `js/play/voice.js` (the vowel
table, zero imports) and `js/play/key.js` (the stage key, lifted out of `chord-wheel.js` so the
ribbon and the wheel cannot disagree); `js/play/pads.js` keeps only the held-note capture the
piano shares. 140 Node tests passed at the time, 17 of them new (the count is 142 now).

What to remember:

- **The detent is the feature.** The pitch axis bends towards the key's notes without
  quantising, and it is monotonic with in-key notes *and* their midpoints as fixed points —
  all three checked in Node across 12 keys × 2 modes. Its strength is a feel number set by ear.
- **The key is the stage's now**, not the wheel's. Same `av2.chord-key.v1` storage, so an
  existing visitor keeps their key; either surface's stepper moves it.
- **A steady note records no `glide` key at all**, which is what keeps every pre-ribbon loop
  take and every keyboard vocal byte-for-byte what they were.
- **`js/audio.js` cannot be split.** `tests/audio-lifecycle.test.mjs` loads it through a
  `data:` URL, which only works because it imports nothing — so the ~1000-line split rule has
  no move available here. Moving the vowel table *out* (into `voice.js`, caller-supplied) was
  the reduction actually available; the file is now ~1000 lines and this is a known standoff.
- **`js/play/pads.js` has no pads.** The name is stale on purpose: renaming touches six
  importers and there is no bundler to catch a missed one.

Verified in the pane at 1280×720, 844×390, 430×932, 390×844 and 320×568: silent-on-focus, the
one-dock invariant across all four instruments, press-glide-release, the detent landing on
scale notes, glide capture and the steady-note exemption, the `1`–`7` degree row with `↓ ↑`
gliding, and the mascot mouth following the vowel and restoring. **Not** verified: a real touch
device, and audible judgement of the synth — the pane gives no way to hear it.

**The chord wheel's labels are sized from geometry now**, not from a character count
([[Decisions]] "A label's size is a fact about the geometry"). With sevenths on, the inner
ring's four-character names (`C#m7`, `F#m7`, `G#m7`) collided — the old rule only shrank at
five characters, and the inner ring's gap between neighbouring labels is 62% of the outer's.
[[SPEC]] now asserts no two labels overlap in any key, either mode, sevenths either way.

### What the pane missed and a user caught

Five defects the pane's synthetic drags never surfaced, all fixed, all in [[Gotchas]]:

1. **A stuck droning note.** Move and up were bound to the field, copying the wheels. A wedge is
   pressed and released in one place; a sung line is a drag and the finger leaves a 236px square
   constantly, so the release never reached the module and the note ran to the ten-second safety
   timer. Now window-bound and filtered by pointer id, plus `blur`.
2. **`lostpointercapture` was still in the release set.** Valid while the drag was element-bound,
   a second way to cut a phrase short once it was not.
3. **A long press became a context menu.** A sung note *is* a long press — that is the
   instrument — and the browser turns one into a callout and takes the gesture with it. Every
   other surface here is tapped, so none of them had to care.
4. **The degree row released the wrong note.** Hold `1`, press `3`, let go of `1`, and `3` died.
   It cannot match on the degree either, because the arrow glide moves the degree out from under
   the key that started it — it matches the owning `code`.
5. **Two code paths owned one voice.** Under mic focus both `1`–`7` and `N M , . /` were live,
   and `beginKeyboardVocal` silences `play.heldVocal` *directly* — killing the ribbon's note
   without the ribbon hearing about it. The jam row now routes through the ribbon in the close-up.

### Open: the vowel-axis crackle

**Still unresolved, and worth knowing before touching the synth.** A crackle while swiping the
vowel axis, on a desktop mouse — the note keeps tracking, the sound breaks up. It **could not be
reproduced in the pane**, and the measurements say it is not what it looks like:

| Measured | Result | Rules out |
| --- | --- | --- |
| Held vs swept, sample-to-sample discontinuity | 0.382 held vs 0.337 swept | Movement adding glitches — a *still* note is worse |
| Audio clock vs wall clock, to 120 moves/frame | 1–3 ms | Dropouts / main-thread starvation |
| RMS envelope, held vs swept | 19 dB vs 17.4 dB | Resonances sweeping across harmonics |
| Offline render of the same graph | peak 0.066, 0 clipped | Clipping, and any automation step |

An earlier "3× worse than offline" reading was **wrong** — it was measuring the breath noise, not
glitches. Correcting that is what killed the theory. Three changes went in anyway, each
defensible on its own terms and **none proven against the symptom**: the live automation path
moved to `setTargetAtTime`, vibrato moved from hertz to cents (a real defect: ±36 cents at C4
against ±12 at G5, and 19 dB → 16 dB of wobble at the bottom once fixed), and the breath was
dialled back. → [[Decisions]]

The untried lever is a three-line A/B in the running app — mute the breath, then the vibrato,
then the vowel morph, and see which one takes the crackle with it. The breath is the first
suspect: it is a looping white-noise buffer and the one thing added to a synth that was fine
without it.

The ribbon commit and this label fix are both pushed. **A green Actions run is not proof the
CDN moved** — curl after it lands (the header of this note carries the current check). The VPS
preview `vibe2.ton.zone` is further behind again: it is pinned to release `20260812T135148Z`
and needs its own release cut.

```bash
curl -s https://vibe2.ton.zone/stage/ | grep -o 'v=[0-9-]*' | sort -u   # 20260813-06, behind
```

A green Actions run is still not proof — the curl is, because the run can succeed while the
CDN serves the previous build. Note `prices.json` carries its own **data** stamp
(`20260805-03`) on a separate cadence, so "one stamp everywhere" is a claim about modules, not
about every `?v=` on the page.

**Drums grew a play surface** ([[Decisions]] "The bar became a wheel, and the kit stopped
playing itself"). It was the richest mesh in the repo and the thinnest instrument — no `play/`
module at all. Now: `js/play/rhythm.js` (12 Euclidean-backed grooves, zero imports, 25 Node
tests) and `js/play/groove.js` (`#groove-wheel`, its own look-ahead scheduler). A wedge plays,
playing it again stops, and nothing on the kit moves unless it is sounding. A loop take
recorded over a groove **contains** that groove and the groove then stops itself, because the
loop is playing it. Also landed with it: strike velocity from where a pointer lands on a head,
a hi-hat pedal that finally reaches `audio.hihat`'s open branch, `1`–`7` as the whole kit in a
close-up, head-only recoil, and `reducedMotion` honoured in `drums.update()`.

Verified in the pane at 1280×720 and 390×844: silent-on-focus, tap-to-play, the loop capture
and playback, the bar quantisation, and both keyboard rows. **Not** verified: the remaining
three acceptance viewports (320×568, 430×932, 844×390) and a real touch device. The groove
wheel is capped to 220px for drums, against the chord wheel's 300px, because the kit is
centred in a portrait frame where the guitar and piano are not — at the shared size it sat
over the lower kit. Drums still has no measured fitter, so that corner is verified by eye.

**The mascot became a gift** (`3910ca2` → `685e383`, [[Decisions]] "The mascot became a gift,
not a wardrobe", [[Mascot]]). The dressing-room editor is retired: an egg hatches on the
fly-in and hands the visitor a drawn character with a rarity tier. Every character is a
**Вайбер** and the tier reads as a species epithet; the reveal card absorbed the onboarding
tip, and walking off the stage lip hatches a new one instead of scolding you. `js/mascot/
editor.js` is gone in favour of `gift.js` + `reveal.js`. Two gates that look like one and are
not: the **gift** keys on whether a character exists in storage, the **tip** on
`av2.onboard.v2`. Backing out of the ceremony writes nothing, so sharing a gate would have
stranded that visitor with the default look and no way to ever be offered another.

**The chord pad became a wheel** (`48bb64e` → `896c52a`, three [[Decisions]] entries). The
six-slot guitar-only pad is gone; a circle-of-fifths wheel now serves **both** guitar (a wedge
*arms*, silently — the neck still sounds it) and piano (a wedge *sounds* the chord and
depresses the keys it voices). New `js/play/harmony.js`, which imports nothing so the tests can
load it for real, and `js/play/chord-wheel.js`. What to remember:

- **A close-up owns the keyboard.** Outside one the multi-instrument jam is unchanged; inside
  one only that instrument's keys answer. This *reversed* a §12 acceptance criterion — focusing
  the piano must now silence the drum, vocal and strum keys, where it previously must not have.
- **The chord row is `1`–`7` in a close-up**, counting scale degrees, so `1` is the tonic in
  either mode. Away from one it falls back to `Q W E R T Y U`, because the digits are already
  the piano's white keys there. Strum is `↓` / `↑` (Space and Shift+Space still work).
- **Keys can be minor**, toggled by tapping the key readout itself (`C` ↔ `Am`). A relative
  pair shares its six wedges *and* its sevenths, so mode is one stored field rather than a
  second set of chords.
- The library is **84 chords** (12 roots × 7 qualities): `dim` and `m7b5` exist because degree
  7 of a major key and degree 2 of a minor one are diminished. Neither has a wedge — a
  diminished chord is neither a major nor a relative minor — so six of the seven degrees light
  and the seventh is reachable only from the row.

**A warning this session earned the hard way.** `3910ca2` deleted all three chord-wheel
entries from `notes/Decisions.md` and both new rows from `notes/Module map.md`; they were
restored from `f8f7fa0`. The cause was not a stale copy — it was that commit's own conflict
resolution taking one side of a prose file wholesale (`git checkout --theirs -- notes/…`).
**On an append-only note that both branches added sections to, `--ours` / `--theirs` is always
wrong**: each side's "change" is its own new section, so picking a side silently drops the
other's. Merge the two by hand, then `git show <commit> -- notes/` to confirm nothing left —
nothing in the tests or the build catches a note that quietly lost a section.

The same rebase hid two *code* changes for a related reason, and one of them shipped a page
that died on load. → [[Gotchas]] "It also makes every merge look like a conflict"

**Local branch state.** `main` is the only branch that matters; the gift work reached it by
cherry-pick, so `mascot-gift`, `mascot-gift-backup` and `gift-onto-main` hold the *same
content* under different SHAs and are **not** ancestors of `main`. `git branch -d` will refuse
them for that reason — they are safe to `-D` once you have confirmed `main` is pushed, which
it is.

**Also landed 2026-08-11: the Polish mirror** (`f61d9c0`). `/pl/` carries the hub, the four
lesson pages and a RODO notice on Polish slugs, deliberately `noindex` so it cannot compete
with the Ukrainian slugs the studio is actually found by — while `robots.txt` still allows
crawling, because a blocked crawler never reads the `noindex`. Asserted in
`tests/site-meta.test.mjs`. → [[Decisions]], [[Lesson site]]

**Landed 2026-08-09, still the biggest structural change of the week: the signs wall runs on
a backend of ours.** Storage moved off the Telegram pinned message into SQLite on the VPS —
`deploy/av2-signs/server.js`, one dependency-free Node file behind nginx at
`https://back.artvibe.com.pl`. Every browser used to rewrite the whole pinned message, so
two visitors signing at once overwrote each other and Telegram reported success to both;
read-modify-write from N browsers has no serialisation point. What is easy to forget now:

- **No credential ships anywhere any more** — [[SPEC]] §12's "one deliberate exception" is
  retired outright, and Telegram is gone from the feature entirely.
- **`signs.db` is the only copy of the wall**, so `deploy/signs-backup/` is load-bearing (a
  two-hourly sqlite3 `.backup` into `/var/backups/av2-signs/`). **A lost VPS disk now costs
  the signatures**, where the pinned message used to survive. Moderation is SQL over SSH.
- **`js/core/telegram.js` is a different feature and is untouched** — in-app browser /
  Mini App guards for visitors arriving from a Telegram link ([[SPEC]] §10).
- Testing against the live endpoint collects `429`s fast: 30 s per IP / 10 per day, and
  nginx overwrites `X-Real-IP` so it cannot be spoofed.
- A **gear-surface experiment** (sign tags on the kick drum head and piano panels) shipped
  and was reverted the same day; it survives on `todays-work-backup`.

**A human eyeball of the sign modal and its scarcity badge is also still pending**, for the
same wedged-GPU reason.

The signs backend has its own liveness check, separate from the stamp curls above:

```bash
curl -s https://back.artvibe.com.pl/healthz   # {"ok":true,...} — verified, 67 signs
```

**VPS rollback, as it stands:** `.previous-release-for-rollback` holds
`20260812T133258Z` and the nginx conf it replaced is saved beside the live one as
`.bak.20260812T135148Z`. Both are written by hand at deploy time, so they are only as true as
the last person who remembered — check them, don't assume.

**A trap in that hand-written step.** The release pointer is rewritten with `sed` on
`deploy/nginx/vibe2.ton.zone.conf`, matching the release it is replacing — and a `sed` that
matches nothing exits `0`. Switching branches between deploys changes what that file holds,
so the substitution silently no-ops and you upload a conf aimed at the *previous* release,
which `nginx -t` happily passes. Rewrite by pattern and assert the count instead:

```bash
python3 - <<'EOF'
import re
s = open('deploy/nginx/vibe2.ton.zone.conf').read()
s, n = re.subn(r'/var/www/vibe2\.ton\.zone/releases/\d{8}T\d{6}Z', NEW_ROOT, s)
assert n == 3, f'expected 3 root entries, rewrote {n}'
EOF
```

**Resolved — analytics are no longer dark.** `count.artvibe.com.pl` used to serve a
certificate for `goatcounter.com`, so every hit was dropped in silence while the pages
looked healthy; the custom domain is now registered and the endpoint answers over TLS. The
check still belongs in any "why is the dashboard empty" investigation:

```bash
curl -sI https://count.artvibe.com.pl/   # a cert error here means analytics are dark again
```

A `405` is the healthy answer — GoatCounter refuses `HEAD` on `/`, which means the handshake
succeeded. Note that the dashboard only starts counting from the fix, so the early weeks are
genuinely empty rather than broken.

**Worth doing before it bites:** every action in `deploy-pages.yml` (`checkout@v4`,
`setup-node@v4`, `upload-artifact@v4`, `configure-pages@v5`, `deploy-pages@v4`) targets the
deprecated Node 20 and is being force-run on Node 24. Deploys still succeed and only warn, but
the fallback will not last.

**Resolved — the deploy outage of 2026-08-06.** GitHub had a major Actions + Pages incident
from 15:22 UTC; it recovered by 00:05 UTC on the 7th. Two things it left behind, both worth
recognising if it happens again:

- **A zombie run.** One run sat `queued` for twelve hours after the incident closed, holding
  the `pages` concurrency group. It never would have started. `gh run cancel <id>` cleared it.
- **Dropped webhooks.** Pushes made *during* the incident never created runs at all, so five
  commits sat on `main` with no run to wait for. `gh run list` looked idle, not broken.

The fix for both is the same and is in the deploy note below: cancel the zombie, then
`gh workflow run` a fresh one on the current tip. Pushes trigger runs normally again.

**Also resolved:** the `$` HUD experiment was reverted — the control kept its Ukrainian
wording, and it has since become the gold graduation-cap button titled **Уроки та ціни**
([[SPEC]] §6). The one lesson that outlived the experiment: whatever this control is, it is
not a currency glyph. → [[Decisions]]

**Deploy note:** deploys have failed on GitHub's side several times now — a timeout inside
`actions/deploy-pages`, a runner never acquired, a run stuck in `waiting`, and a run stuck in
`queued` long after the incident ended. Do **not** fix any of them with `gh run rerun` — it
re-runs the upload step too and the run then holds two artifacts named `github-pages`, which
the deploy action refuses. Cancel the stuck run and start a fresh one:

```bash
gh run cancel <stuck-run-id>
gh workflow run "Deploy to GitHub Pages" --ref main
```

Check [githubstatus.com](https://www.githubstatus.com) before assuming the workflow is at
fault. → [[Dev workflows]]

## Recently landed

Newest first (see [[Decisions]] for the reasoning). All on `main` and live on GitHub Pages;
the VPS preview is pinned to an older release and does **not** carry the recent ones.

| Commit    | Change                                                        |
| --------- | ------------------------------------------------------------- |
| `4f92483` | The tier mark moves: rune ring, pulse ripple, rising embers   |
| `408e43f` | The gift hatches out of a magic wardrobe instead of an egg    |
| `720e452` | Rare's aura accent saturated so it reads blue, not as glare   |
| `680d96e` | The tier is worn on stage, not only announced in the reveal   |
| *(pre)*   | The vocal pad becomes a continuous pitch × vowel ribbon        |
| `a3a8b50` | Drums get a groove wheel, dynamics, a hi-hat pedal and the kit row |
| `685e383` | Falling off the stage hatches a new Вайбер instead of scolding |
| `883273c` | Every character is a Вайбер; onboarding folded into the reveal |
| `499638f` | Camera no longer lurches when the gift card closes            |
| `3910ca2` | Mascot wardrobe retired for a one-time gift reveal            |
| `896c52a` | Chord row counts scale degrees `1`–`7`; keys can be minor      |
| `0ce3cca` | A close-up owns the keyboard; piano chord row plays the piano |
| `45d8706` | Wheel to the bottom corner, smaller hub, mobile guitar zoom   |
| `48bb64e` | Six chord slots replaced by a shared circle-of-fifths wheel   |
| `ee67aeb` | Touch activation: dropped HUD taps, latched `:hover`, ГРАТИ ghost click |
| `f61d9c0` | Polish mirror under `/pl/`, deliberately `noindex`            |
| `ea67b5f` | Telegram removed from the signs feature entirely              |
| `abbc94b` | Links allowed on the signature wall                           |
| `01f9fd1` | Signs move to a SQLite backend, so the race cannot happen     |
| `789ce82` | Confirm the sign is really on the stage before saying Готово  |
| `16873bc` | The first signature can never be pushed off the stage         |
| `8508ee3` | Chip anchoring reverted; chips paced with a 3-minute cooldown |
| `22d3f3d` | Signing gated behind the first VIBE fill                      |
| `0edf3ab` | Let visitors sign the stage                                   |

**The through-line of the last two weeks is the signature wall** — roughly twenty commits
from first sketch to its own backend, including two reverts (overflow signs into the void,
gear-surface tags). Before extending it, read [[Decisions]]: the storage design was rebuilt
twice and the current shape exists because read-modify-write from N browsers cannot
serialise.

**Before that, the through-line was subtraction.** Three discovery layers were built and
removed within hours of each other — screen-space arrows, cloud-shaped bubbles, and
per-instrument how-to hints — plus the `+` / `−` zoom buttons and two confirmation toasts. If
you are about to add another layer of instruction over the scene, this ground has been walked.

Two structural changes are still recent enough to be the likely source of a fresh regression:
the `/stage/` move (anything document-relative under `/stage/` will 404) and the cache-stamp
reset (a module loaded twice behaves in genuinely baffling ways). → [[Gotchas]]

## Roadmap, per [[SPEC]]

### Drums — the groove wheel just landed

Drums went from the richest mesh and the thinnest instrument to having its own play surface,
its own [[SPEC]] section and its own tests, on 2026-08-13. What shipped: `#groove-wheel` (12
Euclidean-backed grooves in 4 families, a wedge plays and playing it again stops), strike
velocity from where a pointer lands on a head, a working hi-hat pedal, `1`–`7` as the whole kit
in a close-up, head-only recoil, and a loop pedal that quantises to whole bars against a
running groove and absorbs it into the take. → [[Decisions]]

Still open, in the order [[SPEC]] lists them: rescale a loop on tempo change instead of locking
the stepper; a count-in; the groove as a stage-wide backbone under the guitar and piano too
(both their roadmaps already ask for a metronome and a backing groove); ride / rimshot / choke
/ flam; and a measured `drumsFocusSafeRect()` if the framing ever needs to reserve rather than
cap. Drums still uses the **raw camera preset** — that is deliberate, and the wheel's corner is
verified by eye rather than derived.

### Piano interaction — the biggest open area

The current milestone delivered **framing and pose only** ([[Focus framing]]). Explicitly
*not* blockers for it, and still to do:

1. **Reliable key surface** — piano-local hit plane, dead-gap removal, black-key priority,
   captured pointers, held key state, ordered glissando, robust multi-finger chords
2. **Gesture ownership** — a pointer on keys / drums / strings / frets / chord wheel claims that
   finger so OrbitControls can't rotate from it; empty canvas still orbits
3. **Performance feedback** — one piano-note event driving audio, key travel, glow,
   note-following hands, VIBE, haptics and loop capture; ≥16 voices, click-free same-pitch
   replacement. Event shape is already specced ([[SPEC]] §7 "Roadmap: piano runtime event")
4. **Discoverability** — still open: the accessible DOM `#piano-pad` strip for C4–C5. Note
   that a first-focus how-to hint and an arrow overlay were both built and removed on
   2026-08-06 — read [[Decisions]] before rebuilding either.
5. **Expressive controls** — sustain pedal, MIDI, velocity-sensitive touch / pen, selectable
   octave. ~~computer-keyboard mapping~~ **done** in `314464b`: `A–L` whites + upper-row
   blacks while piano-focused, covering C4–D5 (not the full two octaves) → [[SPEC]]
6. **Learning layer** — guided phrases, hand-separated exercises, metronome, note-name
   overlays. May finally read `piano-notes.json`; focus itself stays silent

Note that the guitar already has #2 and #3 done — its six-string event and raycast-proxy
ownership are the working reference for what piano needs.

### Mascot — deferred: a generated body

Asked for and **not** done, deliberately. Replacing the procedural rig with a generated
character is not an asset swap: every instrument pose, hand anchor, measured focus frame,
walk cycle, dance, fall scaling and the aura's own attachment are authored against
`buildMascot()`'s joints. A generated humanoid means auto-rigging, retargeting, and
re-authoring the whole play layer — a project, not a feature, and the rig-validation notes in
the `threejs-3d-generator` skill are blunt about auto-rigging being "80-90% of the way there"
on hero characters. The affordable version of the same wish is what shipped instead: generated
*props* (the wardrobe) and richer tier presence around the existing body.

### Later guitar enhancements

Explicit **АКОРДИ / СОЛО** modes; true held fretting with separate plucks, slides, bends,
hammer-ons, pull-offs, palm mute, damping; left-handed layout; capo / alternate tuning; pick
vs fingerstyle; metronome; backing groove; guided chord progressions. Plus higher-fidelity
body modelling or one compact body-resonance impulse if the download budget allows.

The chord library is now generative (`314464b`), so several of these got cheaper: **capo** is a
constant added to every fret offset, and **alternate tuning** is a different
`GUITAR_OPEN_FREQS`. Both would need the Node voicing check re-pointed at the new baseline.
Adding a quality (`dim`, `aug`, `6`, `add9`…) means one interval list plus its two movable
shapes — and the check will catch a wrong shape.

### Deferred by design

A game-like background soundtrack. If it ever ships it must be an explicit, persisted,
**default-off** setting on its own mixer bus using the same `ambient` session. → [[Audio]]

## Health

- Eleven test suites, 142 tests, all dependency-free: `node --test tests/*.test.mjs` →
  [[Dev workflows]]. Every one of them guards something that fails *silently* in a running
  app: `site-meta.test.mjs` covers a missing analytics tag, a `404.html` the deploy workflow
  forgets to copy, a funnel hook that stops being called, an unguarded `:hover`, and a
  partial cache-stamp sweep; `guitar-chords.test.mjs` covers a voicing that sounds like a
  chord but not the one on its label; `touch-guards.test.mjs` covers the two predicates
  behind tap activation.
- `js/audio.js` is ~1000 lines against the ~1000-line split rule, and **the split is blocked**:
  `tests/audio-lifecycle.test.mjs` imports it through a `data:` URL, which works only while the
  file imports nothing. Any reduction has to move data *out* to a caller, the way the vowel
  table went to `js/play/voice.js` → [[Module map]]
- Cache stamps are **uniform**: 265 occurrences of `20260813-19` across `js/` and
  `stage/index.html`, `css/style.css` included (it is stamped from `stage/index.html`, so it
  moves with the sweep). The vendored `GLTFLoader.js` / `BufferGeometryUtils.js` are
  deliberately **unstamped** — they are pinned vendor files at three r160, imported through
  the `three/addons/` import map like every other addon, and the sweep skips `vendor/`. `prices.json` keeps its own, deliberately independent stamp — it
  changes on a different cadence and a stale one only serves stale prices, not two versions
  of one module.

  An earlier version of this note said mixed stamps were "expected — files are stamped as
  they change." **That was wrong and it cost a real bug.** Per-module stamping leaves
  untouched files cached, and a cached body still imports the *old* stamp of whatever you did
  change; twelve modules were being loaded twice, including a `vibe.js` split that gave
  `piano-notes.js` its own copy of the keyboard-jam chip timer. Stamps move together, always.

  **`site-meta.test.mjs` now fails on a partial sweep**, so this is a build error rather than
  a live-page mystery — and it caught real drift the first time it ran. The live-page check
  in [[Gotchas]] is still the last word, because a stale reference can live only inside a
  cached response. → [[Gotchas]], [[Decisions]]
