---
tags: [status]
updated: 2026-08-11
---

# Current state

Snapshot as of **2026-08-11**. This is the one note that goes stale by design — update it or
delete it, don't trust it blind. Check `git log` and `git status` first.

## In flight

**Touch activation was unreliable on phones, and `ee67aeb` fixes four separate causes of
it.** Reported as "click detection is not always working, mostly the HUD, and sometimes the
button just selects". The reasoning is in [[Decisions]]; the short version of what to
remember:

- **`preventDefault()` on a `touchend` suppresses the synthesized `click`.** The
  double-tap-zoom blocker kept one document-wide timestamp and cancelled any touchend
  within 320 ms of the previous one *anywhere on the page* — and the whole HUD is bound to
  plain `click`. A tap after a joystick release or another HUD tap was simply dropped. A
  blanket `touchend` blocker and a `click`-bound UI cannot coexist.
- **Every `:hover` rule now lives under `@media (hover: hover)`.** iOS applies `:hover` on
  tap and holds it until the next tap elsewhere, so a HUD icon latched gold and lifted and
  a panel ✕ stayed rotated 90° — chosen-looking, not fired. `:focus-visible` halves stayed
  outside the query. **A new `:hover` added without the guard is now a test failure**, which
  is the only durable fix: nobody files a stuck highlight.
- **`.panel *  { user-select: text }` was applying to buttons too**, so a press with a little
  drag highlighted a control's label in purple instead of firing it. Prose stays copyable;
  controls are excluded, and the `selectstart` guard in `pointer.js` re-claims them.
- **The ГРАТИ guard from `4c29cc7` had a hole** — two disagreeing windows (700 ms on ГРАТИ,
  500 ms on ✕) that never cleared once seated. Replaced by one one-shot click swallower in
  the new `js/core/gesture-guards.js`, which self-clears on the click it ate and lets a real
  keyboard Enter (`detail === 0`) through. The same shape replaced the price chip's flat
  400 ms guard, which had been eating the visitor's *next* deliberate tap.

`js/core/gesture-guards.js` **imports nothing on purpose** — that is what keeps it reachable
from `ui.js`, `view/` and `core/` alike without an upward import, and loadable under
`node --test` → [[Module map]], [[Architecture]].

**Verified by tests and by reading, not on a phone.** 73 Node tests pass and the build is
live on the VPS preview, but the agent pane has no touch input and reports
`document.hidden` ([[Gotchas]]), so **a human thumb on a real device is pending.** The two
cases most worth trying: release the joystick then immediately tap a HUD icon; and stand the
mascot exactly on an instrument's walk point (so the approach seats synchronously) before
tapping ГРАТИ and then ✕.

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

Deploy state, verified rather than assumed:

```bash
curl -s https://artvibe.com.pl/stage/ | grep -o 'main.js?v=[0-9a-z-]*'   # expect 20260812-01
curl -s https://back.artvibe.com.pl/healthz   # {"ok":true,...} — signs are alive
```

A green Actions run is *not* proof — that curl is, because the run can succeed while the CDN
still serves the previous build.

**Open at the time of writing:** the `ee67aeb` Pages run (`31489443158`) had sat `queued`
for over five minutes against a ~24 s norm, with no runner acquired and
[githubstatus.com](https://www.githubstatus.com) reporting all systems operational — so it
is the recurring runner-acquisition stall, not an incident. Production was still serving
`20260809-10`. **Check the curl above before assuming this shipped**, and if the run is
still queued, cancel and start a fresh one per the deploy note below — not `gh run rerun`.

The **VPS preview is already on the new build** — `vibe2.ton.zone` release
`20260811T115728Z`, with the previous release recorded in
`/var/www/vibe2.ton.zone/.previous-release-for-rollback` and the old nginx conf saved
alongside it as `.bak.20260811T115728Z`.

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

Newest first (see [[Decisions]] for the reasoning). All live on `main`; `ee67aeb` was still
deploying to Pages when this was written, but is up on the VPS preview.

| Commit    | Change                                                        |
| --------- | ------------------------------------------------------------- |
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

- Seven test suites, 73 tests, all dependency-free: `node --test tests/*.test.mjs` →
  [[Dev workflows]]. Every one of them guards something that fails *silently* in a running
  app: `site-meta.test.mjs` covers a missing analytics tag, a `404.html` the deploy workflow
  forgets to copy, a funnel hook that stops being called, an unguarded `:hover`, and a
  partial cache-stamp sweep; `guitar-chords.test.mjs` covers a voicing that sounds like a
  chord but not the one on its label; `touch-guards.test.mjs` covers the two predicates
  behind tap activation.
- `js/audio.js` is 916 lines against the ~1000-line split rule — the next substantial audio
  change should probably split it → [[Module map]]
- Cache stamps are **uniform**: 217 occurrences of `20260812-01` across `js/` and
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
