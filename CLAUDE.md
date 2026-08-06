# CLAUDE.md

Project knowledge lives in `notes/` — an Obsidian vault rooted at this repo. Read
`notes/Art Vibe Studio.md` first; it is a map, and it routes to the subsystem note that
matters. Don't read the whole vault. Read `notes/Gotchas.md` before debugging anything
visual — a black canvas here is usually a hidden-tab artefact, not a bug.

`SPEC.md` is the contract and wins over any note. `AGENTS.md` has the layout and conventions
in full; two rules from it have no tooling to catch a violation, so they are repeated here:

- **Imports go one way** (`main.js` → `shell/` → `play/` → `instruments/` / `mascot/` →
  `scene/` → `view/` → `core/`). A back-reference is injected through the module's `init*()`,
  never imported upward. There is no bundler, so a cycle fails as a silent runtime
  `undefined`.
- **Paths are site-absolute** (`/js/…`, `/prices.json`, `/img/…`). The stage is served from
  `/stage/`, so a document-relative path resolves inside that directory and 404s.

When behaviour changes: update `SPEC.md`, and add a line to `notes/Decisions.md` if the
reasoning is new.
