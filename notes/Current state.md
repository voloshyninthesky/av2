---
tags: [status]
updated: 2026-08-06
---

# Current state

Snapshot as of **2026-08-06**. This is the one note that goes stale by design — update it or
delete it, don't trust it blind. Check `git log` and `git status` first.

## In flight

**Uncommitted:** `stage/index.html` — the HUD **ЦІНИ** button label changed to `$`.

```diff
-<button class="pill-btn nav-btn gold" data-open="pricing">ЦІНИ</button>
+<button class="pill-btn nav-btn gold" data-open="pricing">$</button>
```

Looks like a live experiment in trimming the HUD. Worth deciding deliberately: [[SPEC]] §6
lists the HUD nav as «кроки / ціни», and the pricing mixer's instrument buttons are specified
as **text-only, no icons** — a bare `$` is closer to an icon, and it also drops the Ukrainian.
Either commit it *and* update [[SPEC]], or revert it.

## Recently landed

The last five commits (see [[Decisions]] for the reasoning):

| Commit    | Change                                                    |
| --------- | --------------------------------------------------------- |
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

- Four test suites, all dependency-free: `node --test tests/*.test.mjs` → [[Dev workflows]]
- `js/audio.js` is 916 lines against the ~1000-line split rule — the next substantial audio
  change should probably split it → [[Module map]]
- Cache stamps are mixed across the tree (`20260804-10` dominates at ~187 uses, with a few
  `20260805-*` and `20260806-01`). Expected — files are stamped as they change — but worth a
  glance if module behaviour looks stale.
