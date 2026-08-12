---
tags: [status]
updated: 2026-08-12
---

# Current state

Snapshot as of **2026-08-12**. This is the one note that goes stale by design — update it or
delete it, don't trust it blind. Check `git log` and `git status` first.

## In flight

Working tree clean, `main` pushed, and **both surfaces are on `20260813-06`** — production
`artvibe.com.pl` and the VPS preview `vibe2.ton.zone` (release `20260812T135148Z`). 98 Node
tests pass.

```bash
curl -s https://artvibe.com.pl/stage/ | grep -o 'v=[0-9-]*' | sort -u   # expect 20260813-06
curl -s https://vibe2.ton.zone/stage/  | grep -o 'v=[0-9-]*' | sort -u   # preview should match
```

A green Actions run is still not proof — the curl is, because the run can succeed while the
CDN serves the previous build.

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

Newest first (see [[Decisions]] for the reasoning). All live on `main` and on both surfaces.

| Commit    | Change                                                        |
| --------- | ------------------------------------------------------------- |
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

- Nine test suites, 98 tests, all dependency-free: `node --test tests/*.test.mjs` →
  [[Dev workflows]]. Every one of them guards something that fails *silently* in a running
  app: `site-meta.test.mjs` covers a missing analytics tag, a `404.html` the deploy workflow
  forgets to copy, a funnel hook that stops being called, an unguarded `:hover`, and a
  partial cache-stamp sweep; `guitar-chords.test.mjs` covers a voicing that sounds like a
  chord but not the one on its label; `touch-guards.test.mjs` covers the two predicates
  behind tap activation.
- `js/audio.js` is 916 lines against the ~1000-line split rule — the next substantial audio
  change should probably split it → [[Module map]]
- Cache stamps are **uniform**: 233 occurrences of `20260813-06` across `js/` and
  `stage/index.html`, `css/style.css` included (it is stamped from `stage/index.html`, so it
  moves with the sweep). `prices.json` keeps its own, deliberately independent stamp — it
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
