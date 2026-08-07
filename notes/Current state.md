---
tags: [status]
updated: 2026-08-07
---

# Current state

Snapshot as of **2026-08-07**. This is the one note that goes stale by design — update it or
delete it, don't trust it blind. Check `git log` and `git status` first.

## In flight

**Nothing. `main` is deployed and live**, tip `abae451`, verified rather than assumed:

```bash
curl -s https://artvibe.com.pl/stage/ | grep -o 'main.js?v=[0-9a-z-]*'   # 20260807-03
```

A green Actions run is *not* proof — that curl is, because the run can succeed while the CDN
still serves the previous build.

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

Newest first, all live (see [[Decisions]] for the reasoning).

| Commit    | Change                                                       |
| --------- | ------------------------------------------------------------ |
| `abae451` | A full VIBE meter stays full; flash no longer strobes forever |
| `ec1a9c7` | Praise on the third note; meter fills ~40% slower             |
| `78a2a65` | **МАКСИМАЛЬНИЙ ВАЙБ** announced once, not per fill            |
| `741bbfa` | Instrument how-to hints removed                               |
| `ffa6f64` | **Неперевершено!** toast dropped after ГОТОВО                 |
| `4fc010c` | Praise per instrument; vocal hint double-entrance fixed       |
| `73722c0` | Casual hint copy + praise cheers                              |
| `0f7c5fd` | Discovery hints wired; `+` / `−` zoom buttons removed         |
| `314464b` | First run reversed; chord maker + slots; piano `A–L`; stamps  |
| `00baf4a` | Pricing pill → gold cap icon, **Уроки та ціни**               |

**The through-line of the last day is subtraction.** Three separate discovery layers were
built and removed within hours of each other — screen-space arrows, cloud-shaped bubbles, and
per-instrument how-to hints — plus the `+` / `−` zoom buttons and two confirmation toasts. If
you are about to add another layer of instruction over the scene, read [[Decisions]] first;
this ground has been walked.

Two structural changes are still recent enough to be the likely source of a fresh regression:
the `/stage/` move (anything document-relative under `/stage/` will 404) and the cache-stamp
reset (a module loaded twice behaves in genuinely baffling ways). → [[Gotchas]]

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

- Six test suites, all dependency-free: `node --test tests/*.test.mjs` → [[Dev workflows]].
  The two newest both guard things that fail *silently*: `site-meta.test.mjs` covers a missing
  analytics tag, a `404.html` the deploy workflow forgets to copy, or a funnel hook that stops
  being called; `guitar-chords.test.mjs` covers a generated chord voicing that sounds like a
  chord but not the one on its label — nothing in the running app would ever show you that.
- `js/audio.js` is 916 lines against the ~1000-line split rule — the next substantial audio
  change should probably split it → [[Module map]]
- Cache stamps are **uniform again**: every `?v=` across `js/` and `stage/index.html` read
  `20260807-03`. `css/style.css` carries its own (`20260807-01`), which is fine — it is one
  file with no import graph.

  The old note here said mixed stamps were "expected — files are stamped as they change."
  **That was wrong and it cost a real bug.** Per-module stamping leaves untouched files
  cached, and a cached body still imports the *old* stamp of whatever you did change; twelve
  modules were being loaded twice, including a `vibe.js` split that gave `piano-notes.js` its
  own copy of the keyboard-jam chip timer. Stamps move together, always. The check is on the
  live page, not in grep → [[Gotchas]], [[Decisions]].
