---
tags: [decisions, history]
---

# Decisions

Why things are the way they are. Newest first.

The commit messages in this repo are unusually good — they carry the reasoning, not just the
change. `git show <hash>` is the primary source; this note is the index into it, so you know
*which* commit to read.

---

## The lesson site became the front door — `b259446`, 2026-08-06

The lesson hub was at `/uk/` while the 3D stage sat at `/`. But the lesson pages are what
search traffic and bookings need to land on, so they swapped: `/uk/` → `/`, the four
`uroky-*-lodz` pages dropped their prefix, and the stage moved to `/stage/` with a HUD exit
back to the site. `/uk/*` survives as redirect stubs.

**The knock-on effect is the one to remember:** the stage used *document-relative* asset
paths, which only worked because it lived at the root. Under `/stage/` those would 404, so
its HTML, import map and both runtime `fetch()` calls (`prices.json`, `img/slides.json`)
became **site-absolute**. Canonicals, hreflang, JSON-LD, `sitemap.xml`, the price-sync tool,
the tests and the deploy list all followed. → [[Architecture]], [[Gotchas]]

## The credit heart beats — `6e28441` / `861dafa`, 2026-08-05/06

The only affordance was a hover underline, which touch never sees and a mouse finds by
accident, so nobody knew the line did anything. The heart now beats — **lub, dub, then nine
tenths of the cycle perfectly still.** The stillness is the design: a pulse that never stops
moving reads as a demand. With motion off, the underline stops waiting to be hovered and
simply stays. → [[Lesson site]]

## GLAMOUR opens on a dimmer stage — `233f3ea`, 2026-08-06

The **Світло** fader defaulted to 78 everywhere except PIXEL. GLAMOUR carries bloom, and
that brightness becomes glare once a close-up fills the frame with the guitar. GLAMOUR's
unset default is now **67**; PIXEL keeps 100, AUTO keeps 78, and any *saved* preference still
wins over all three.

## Hover glow lives on the material, not the mesh — `7949b11`, 2026-08-06

A genuinely instructive bug. `setGlow` remembered each mesh's rest colour **on the mesh** —
but instruments **share materials**: the piano's 28 cabinet meshes run on 8 of them. So the
second mesh of a shared material recorded the *first* mesh's glow as its own base; releasing
the hover restored mesh 1 to dark and mesh 2 immediately repainted the glow onto the same
material. Hovering the piano lit it forever.

Measured against the real `buildPiano()` in Node: **20 of 28 cabinet meshes stayed lit after
one hover, 0 after the fix.** Rest colour now lives on the material in `js/view/emissive.js`.
The mic's onboarding pulse had the identical bug and shares the helper.

Same commit: a close-up no longer glows on hover. The glow means "walk over here" — once the
camera has committed you are already there and the pointer *plays* instead, so lighting the
whole instrument only smears it.

Also a good example of the honesty norm in this repo: the commit states plainly that WebGL
could not start in the preview pane on that machine, so the material bookkeeping was covered
by tests and a Node check while the close-up suppression was reviewed by reading. → [[Gotchas]]

## Every instrument gets its own price list — `4e8e35f`, 2026-08-05

`prices.json` grouped instruments into two shared categories, so vocal and guitar (and drums
and piano) couldn't be repriced independently and **every consumer had to know which group an
instrument fell into**. Instruments became top-level entries owning a full list, display name
and board theme. Numbers unchanged.

Payoff: the mixer dropped its hardcoded label map and its "does this group contain drums or
piano?" theme test; price chips stopped hardcoding «від 50 зл» and now quote that
instrument's own cheapest single lesson. Both read through `js/core/prices.js` — one shared
fetch — **so a chip can never contradict the modal it opens.** → [[Prices]]

## Prices are generated, not restated — `3c3f5b9`, 2026-08-05

The static pages restate `prices.json`, and the tests failed when the two disagreed — which
made a price change a *developer* task and a red build. `tools/sync-prices.mjs` now writes
the data into the pages, and the deploy workflow runs it **before** the tests, so the studio
can edit `prices.json` alone. Only structural drift, which the script cannot invent, still
fails the build.

Same commit introduced the rule that **no amount lives outside a price cell**, with a test to
keep it that way. → [[Prices]]

## Booking links point at a conversation, not a profile — `2be3a1a` / `5b7c1f3`, 2026-08-05

Step 4 tells visitors what to write — «Напиши нам у директ "Хочу на урок"» — so the buttons
beside it should land where that message goes. The Instagram ones opened the profile feed;
both now use the `ig.me` deep link, and the Messenger prefill repeats the same phrase.
Browsing links (footer, «відгуки та викладачі», JSON-LD `sameAs`) deliberately keep the plain
profile URL. → [[Lesson site]]

---

## Standing decisions (not from one commit)

- **No build step.** Vendored Three.js, import maps, manual `?v=` cache stamps. What is in
  the repo is what ships — which is why the layering rules in [[Architecture]] are conventions
  enforced by review rather than by tooling.
- **Audio never pre-empts the visitor's music.** The whole of [[Audio]] follows from this.
- **Mascot movement has no keyboard binding.** That frees the entire desktop keyboard to be a
  multi-instrument jam surface, which is product goal #2 in [[SPEC]] §1.
- **Curated, not configurable.** Small authored option sets in the mascot editor; no colour
  picker, no uploads, no AI avatars, no downloadable wardrobe. → [[Mascot]]
- **Measure the viewport, don't branch on breakpoints.** → [[Focus framing]]
- **`av2.*` storage keys are versioned and deliberately not migrated.** A key bump (e.g.
  `av2.mascot.v3`) is the intended way to reset returning visitors.
