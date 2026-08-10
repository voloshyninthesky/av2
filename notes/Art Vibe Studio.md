---
tags: [moc, home]
---

# Art Vibe Studio

Interactive marketing site for a cultural / educational space in Łódź teaching **vocal,
guitar, piano and drums**. Ukrainian at the root with a Polish mirror of the lesson pages
under `/pl/`, PLN prices, booking happens in Instagram or Messenger DMs. There are no
accounts, no payments, no CMS, no sample libraries and no native apps — those are explicit
non-goals.

|          |                                                        |
| -------- | ------------------------------------------------------ |
| Live     | https://artvibe.com.pl (GitHub Pages, `CNAME`)         |
| Repo     | https://github.com/voloshyninthesky/av2                |
| Preview  | https://vibe2.ton.zone — versioned nginx releases      |
| Locale   | `lang="uk"`, plus `lang="pl"` under `/pl/`; PLN as «зл» / «zł» |
| Slogan   | *Вчись творити і твори навчаючись.*                    |

## The site is two things

1. **The lesson site** — `index.html` plus four `uroky-*-lodz/` pages, and the same five in
   Polish under `pl/` (plus a RODO notice). Plain static HTML, no JavaScript beyond two tiny
   progressive enhancements, a deliberate 2007-era skin. The Ukrainian pages are the front
   door and the **whole** SEO surface — the Polish ones are deliberately `noindex`.
   → [[Lesson site]]
2. **The 3D stage** — `stage/index.html`. A WebGL scene where a visitor walks a mascot
   around a stage and plays procedural instruments. ~12k lines of ES modules under `js/`.
   → [[Architecture]]

They **swapped places on 2026-08-06** (commit `b259446`): the stage used to be the front
door and the lesson pages lived under `/uk/`. See [[Decisions]] for why.

The commercial goal is narrow: let a visitor feel the studio in under a minute, teach two
ways to play, then convert into **ціни / як записатися → Instagram або Messenger**.

## Start here

- [[Architecture]] — module layering, boot order, the rules that keep `js/` from tangling
- [[Module map]] — which directory owns what
- [[Dev workflows]] — serve, test, verify the stage, deploy, bump caches
- [[Gotchas]] — the traps that cost real time, including *how to see the stage at all*
- [[Decisions]] — why things are the way they are

## Subsystems

- [[Audio]] — the play-along contract. The most fragile, most rule-bound part of the project
- [[Focus framing]] — how instrument close-ups get *measured* instead of hard-coded
- [[Mascot]] — the avatar, its dressing-room editor, its performance poses
- [[Prices]] — editing one JSON file is a complete price change
- [[Current state]] — what is in flight right now

## Tooling

- [[Experience chain]] — the `xp` skill family: this architecture, generalized into a
  staged, re-runnable pipeline for building *new* interactive 3D experiences

## Canonical docs (already notes in this vault)

- [[SPEC]] — the product / UX contract, 680 lines. **This is the authority.** These notes
  navigate and explain it; they never restate it as a second source of truth. If a note
  and `SPEC.md` disagree, `SPEC.md` wins and the note is stale.
- [[AGENTS]] — the short brief for coding agents: layout, conventions, how to run.
- [[CLAUDE]] — auto-loaded into every Claude Code session in this repo. Deliberately tiny:
  it points here, points at `notes/Gotchas.md`, and restates only the two invariants that
  have no tooling to catch a violation. Keep it that way — everything in it is paid for in
  context on every single session.

## How to keep this vault honest

The vault *is* the repo (root folder = vault), so notes travel with the code and show up
in diffs. Two habits keep them worth reading:

- Notes hold **orientation and rationale**. Contracts, acceptance criteria and exact
  values live in [[SPEC]]. Copying a number here creates drift — link instead.
- When behaviour changes, [[SPEC]] is step 2 of the [[Dev workflows]] change checklist.
  If the *reason* changed too, add a line to [[Decisions]].
