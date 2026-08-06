---
tags: [status]
updated: 2026-08-06
---

# Current state

Snapshot as of **2026-08-06**. This is the one note that goes stale by design — update it or
delete it, don't trust it blind. Check `git log` and `git status` first.

## In flight

Working tree clean; `main` is pushed and **live** — `c69e846` ([[Decisions]] "The site learned
to count") shipped GoatCounter on all six pages, a branded `404.html`, booking-click and
stage-funnel events, escape links on the WebGL-fail panel, minified Three.js, and `og:image`
removed site-wide. Verified on production: the analytics tag is on all six pages, an unmatched
URL returns a real `404` with the branded page, and `/stage/` serves `three.module.min.js`.

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

**Resolved:** the `$` HUD experiment was reverted — the button reads **ЦІНИ** again, matching
[[SPEC]] §6 and keeping the Ukrainian.

**Deploy note:** the first push timed out inside `actions/deploy-pages` (GitHub side, nothing
in the artifact). Do **not** fix that with `gh run rerun` — it re-runs the upload step too and
the run then holds two artifacts named `github-pages`, which the deploy action refuses. Start a
fresh run instead: `gh workflow run "Deploy to GitHub Pages" --ref main`. → [[Dev workflows]]

## Recently landed

The last five commits (see [[Decisions]] for the reasoning):

| Commit    | Change                                                    |
| --------- | --------------------------------------------------------- |
| `0872d6e` | This vault arrived at the repo root (branch only)          |
| `b259446` | Lesson site became the front door; stage moved to `/stage/` |
| `6e28441` | Credit heart beats                                         |
| `233f3ea` | GLAMOUR opens dimmer (Світло default 67)                   |
| `7949b11` | Hover glow no longer sticks to shared materials            |
| `861dafa` | Designer credit folded behind a heart                      |

The `/stage/` move is the most recent structural change, so **path bugs are the most likely
class of fresh regression** — anything document-relative under `/stage/` will 404. → [[Gotchas]]

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
4. **Discoverability** — first-focus hints and an accessible DOM `#piano-pad` strip for C4–C5
5. **Expressive controls** — sustain pedal, full two-octave computer-keyboard mapping, MIDI,
   velocity-sensitive touch / pen, selectable octave
6. **Learning layer** — guided phrases, hand-separated exercises, metronome, note-name
   overlays. May finally read `piano-notes.json`; focus itself stays silent

Note that the guitar already has #2 and #3 done — its six-string event and raycast-proxy
ownership are the working reference for what piano needs.

### Later guitar enhancements

Explicit **АКОРДИ / СОЛО** modes; true held fretting with separate plucks, slides, bends,
hammer-ons, pull-offs, palm mute, damping; left-handed layout; capo / alternate tuning; pick
vs fingerstyle; metronome; backing groove; guided chord progressions. Plus higher-fidelity
body modelling or one compact body-resonance impulse if the download budget allows.

### Deferred by design

A game-like background soundtrack. If it ever ships it must be an explicit, persisted,
**default-off** setting on its own mixer bus using the same `ambient` session. → [[Audio]]

## Health

- Five test suites, all dependency-free: `node --test tests/*.test.mjs` → [[Dev workflows]].
  The newest, `tests/site-meta.test.mjs`, guards the things that fail *silently* — a missing
  analytics tag, a `404.html` the deploy workflow forgets to copy, a funnel hook that stops
  being called.
- `js/audio.js` is 916 lines against the ~1000-line split rule — the next substantial audio
  change should probably split it → [[Module map]]
- Cache stamps are mixed across the tree (`20260804-10` dominates at ~187 uses, with a few
  `20260805-*` and `20260806-01`). Expected — files are stamped as they change — but worth a
  glance if module behaviour looks stale.
