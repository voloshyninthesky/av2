---
tags: [tooling, skills]
---

# Experience chain

A family of six Claude Code skills in `.claude/skills/` (mirrored to `.agents/skills/`)
that turn this repo's proven shape — themed scene → responsive objects → mascot →
customization → funnel — into a repeatable, **iterable** pipeline for building new
interactive 3D experiences ("Forest", "Warehouse", anything).

| skill | stage |
| --- | --- |
| `xp` | orchestrator: brief → manifest → routes to stages; status + iteration entry point |
| `xp-scene` | base world: lighting archetype, set pieces, camera, test hooks |
| `xp-objects` | interactive objects with plain-language response contracts |
| `xp-mascot` | the character — or the recorded decision not to have one |
| `xp-customize` | curated visitor personalization — or the recorded decision to skip |
| `xp-funnel` | one goal, earned CTA, WebGL-failure fallback, honest counting |

Each generated experience carries an `experience.json` manifest: stage statuses
(`todo/done/skipped`), per-stage design sections, and an append-only log. Stage skills
read it, build, **verify in a browser** (the scaffold ships `testhooks.js` with the
headless worker pump, so hidden agent tabs can still see frames), and write their
section back. Re-running any stage refines it — that is the iterability.

The skills are distilled from this repo's scars: one-way imports with `init*()`
injection, the `/stage/` path lesson, silence-by-default audio, multitouch pointer
rules, "curated, not configurable", and the [[Gotchas]] about hidden tabs and wedged
WebGL. Av2 itself is the living reference implementation of a completed chain.

Usage: `/xp <brief>` for a new experience (state a target directory, or it scaffolds
`./<slug>/`); with an existing `experience.json`, `/xp` reports status and routes
iteration. To use outside this repo, copy the six `xp*` directories into that project's
`.claude/skills/`.

These directories never deploy (the Pages workflow copies an explicit list), and
`SPEC.md` is untouched — the chain is tooling, not site behaviour. → [[Decisions]]
