---
tags: [status]
updated: 2026-08-06
---

# Current state

Snapshot as of **2026-08-06**. This is the one note that goes stale by design — update it or
delete it, don't trust it blind. Check `git log` and `git status` first.

## In flight

**Three commits are pushed to `main` but NOT live — GitHub Pages never deployed them.**
`00baf4a`, `314464b`, `fb68d7d`. Production still serves whatever `c69e846` left there, so
none of the stage work below is visible to a visitor yet.

The cause is entirely GitHub's, confirmed on their status page: a **major Actions + Pages
incident that began 2026-08-06 15:22 UTC** and was still unresolved at 18:46 UTC — hosted
runner jobs "may remain queued indefinitely", and the Pages build servers are down. Our two
runs show both failure modes: `00baf4a` failed with *"The job was not acquired by Runner of
type hosted"*, and `fb68d7d` sat in `waiting` for over two hours, gated on the `github-pages`
environment with an empty reviewer list.

Nothing is misconfigured on our side — checked: the environment's branch policy allows `main`,
the run is on `main`, and Pages is workflow-sourced. **When Actions recovers, start a fresh
run** (not `gh run rerun` — see the deploy note below):

```bash
gh workflow run "Deploy to GitHub Pages" --ref main
```

Then verify the live HTML actually carries the new stamp, because a green run is not proof the
CDN caught up:

```bash
curl -s https://artvibe.com.pl/stage/ | grep -o 'main.js?v=[0-9a-z-]*'   # expect 20260806-13
```

What is waiting to ship, all in `314464b` (reasoning in [[Decisions]]): the first run reversed
so the mascot editor opens before the welcome tip, and that tip now waits for **ЗРОЗУМІЛО**
alone; a generated guitar chord library (60 chords) with six visitor-chosen pad slots; the
piano close-up's real-keyboard `A–L` layout; a maker's mark on the back of the LED wall; and
the repo-wide cache-stamp reset described under Health. `fb68d7d` is notes only.

**The one thing still outstanding — the analytics are collecting nothing.**
`count.artvibe.com.pl` resolves (CNAME onto the GoatCounter site) but serves a certificate for
`goatcounter.com`, so browsers refuse the connection and every hit is dropped in silence while
the pages look perfectly healthy. GoatCounter needs the **custom domain registered**, not just
the DNS record.

```bash
curl -sI https://count.artvibe.com.pl/   # cert error here means analytics are dark
```

Until that is fixed the dashboard will read zero, which is indistinguishable from having no
visitors — do not conclude anything from an empty dashboard before this check passes.

**Resolved:** the `$` HUD experiment was reverted — the control kept its Ukrainian wording, and
it has since become the gold graduation-cap button titled **Уроки та ціни** ([[SPEC]] §6).
The one lesson that outlived the experiment: whatever this control is, it is not a currency
glyph. → [[Decisions]]

**Deploy note:** deploys have failed on GitHub's side more than once now — a timeout inside
`actions/deploy-pages`, a runner never acquired, and a run stuck in `waiting`. Do **not** fix
any of them with `gh run rerun` — it re-runs the upload step too and the run then holds two
artifacts named `github-pages`, which the deploy action refuses. Start a fresh run instead:
`gh workflow run "Deploy to GitHub Pages" --ref main`. Check
[githubstatus.com](https://www.githubstatus.com) before assuming the workflow is at fault.
→ [[Dev workflows]]

## Recently landed

Newest first (see [[Decisions]] for the reasoning). The top three are **pushed but not
deployed** — see In flight.

| Commit    | Change                                                     |
| --------- | ---------------------------------------------------------- |
| `fb68d7d` | Vault routed at the `xp` skill chain (notes only)           |
| `314464b` | First run reversed; chord maker + slots; piano `A–L`; stamps |
| `00baf4a` | Pricing pill → gold cap icon, **Уроки та ціни**             |
| `daf5980` | Recorded what the deploy actually did                       |
| `c69e846` | GoatCounter, `404.html`, funnel events, minified Three.js    |
| `b259446` | Lesson site became the front door; stage moved to `/stage/`  |

Two structural changes are recent enough to be the likely source of a fresh regression: the
`/stage/` move (anything document-relative under `/stage/` will 404) and the cache-stamp reset
(a module loaded twice behaves in genuinely baffling ways). → [[Gotchas]]

## Roadmap, per [[SPEC]]

### Piano interaction — the biggest open area

The current milestone delivered **framing and pose only** ([[Focus framing]]). Explicitly
*not* blockers for it, and still to do:

1. **Reliable key surface** — piano-local hit plane, dead-gap removal, black-key priority,
   captured pointers, held key state, ordered glissando, robust multi-finger chords
2. **Gesture ownership** — a pointer on keys / drums / strings / frets / chord pad claims that
   finger so OrbitControls can't rotate from it; empty canvas still orbits
3. **Performance feedback** — one piano-note event driving audio, key travel, glow,
   note-following hands, VIBE, haptics and loop capture; ≥16 voices, click-free same-pitch
   replacement. Event shape is already specced ([[SPEC]] §7 "Roadmap: piano runtime event")
4. **Discoverability** — first-focus hints and an accessible DOM `#piano-pad` strip for C4–C5.
   Note `js/shell/instrument-hints.js` exists **untracked and unwired** — nothing imports it
   and `#instrument-arrows` is not in the markup, so it currently does nothing. Finish or
   delete it; do not assume the hints ship.
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

- Six test suites, all dependency-free: `node --test tests/*.test.mjs` → [[Dev workflows]].
  The two newest both guard things that fail *silently*: `site-meta.test.mjs` covers a missing
  analytics tag, a `404.html` the deploy workflow forgets to copy, or a funnel hook that stops
  being called; `guitar-chords.test.mjs` covers a generated chord voicing that sounds like a
  chord but not the one on its label — nothing in the running app would ever show you that.
- `js/audio.js` is 916 lines against the ~1000-line split rule — the next substantial audio
  change should probably split it → [[Module map]]
- Cache stamps are **uniform again**: all 209 `?v=` across `js/` and `stage/index.html` read
  `20260806-13`. `css/style.css` carries its own (`20260806-03`), which is fine — it is one
  file with no import graph.

  The old note here said mixed stamps were "expected — files are stamped as they change."
  **That was wrong and it cost a real bug.** Per-module stamping leaves untouched files
  cached, and a cached body still imports the *old* stamp of whatever you did change; twelve
  modules were being loaded twice, including a `vibe.js` split that gave `piano-notes.js` its
  own copy of the keyboard-jam chip timer. Stamps move together, always. The check is on the
  live page, not in grep → [[Gotchas]], [[Decisions]].
