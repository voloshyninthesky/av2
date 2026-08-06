---
tags: [decisions, history]
---

# Decisions

Why things are the way they are. Newest first.

The commit messages in this repo are unusually good — they carry the reasoning, not just the
change. `git show <hash>` is the primary source; this note is the index into it, so you know
*which* commit to read.

---

## The site learned to count — 2026-08-06

The engineering was polished and the site was **commercially blind**: no analytics of any
kind, so nobody could say whether the 3D stage — the expensive half of the product — produced
a single booking.

**GoatCounter, because it is cookieless.** The audience is in the EU; a cookie-based tool
would owe them a consent banner, which is both work and a blot on the 2007-era skin. That
constraint, not a feature comparison, picked the tool. Swapping in anything cookie-based
re-opens the banner question. → [[Lesson site]]

**Clicks, not pageviews, are the number.** Booking happens inside Instagram and Messenger
DMs, so the outbound click is the last thing this site can observe — it *is* the conversion.
Hence `book-{channel}-{page}` on every `ig.me` / `m.me` anchor, delegated so it survives
markup changes. The plain profile links (footer, «відгуки та викладачі», JSON-LD `sameAs`)
are deliberately excluded — they are browsing, not booking, which is the same distinction
`2be3a1a` drew.

**`stage-enter` measures a session starting, not a button being pressed.** Worth knowing
before reading the dashboard: since `7602710` the scene enters itself once assets load and
nothing ever enables `#enter-btn`, so the funnel head hooks `startExperience()` and
`startWithoutIntro()`. `stage-first-play` hooks `addVibe()` because *every* play route —
close-up, pad, keyboard — funnels through it; anything narrower would miss the keyboard jam.
The stale "click enter" instruction in [[Dev workflows]], [[Gotchas]] and `AGENTS.md` was
corrected in passing — it had been telling readers to click a button that cannot be clicked.

**No analytics call may sit in the path of a booking link.** The beacon is blocked for a fair
share of visitors, so both modules swallow their own failures and a test pins that they do.
QA runs (`testhooks` / `headless` / `shot`) record into `window.__av2Events` but never send,
so headless checks can assert the funnel without writing to the dashboard.

Hits go to `https://count.artvibe.com.pl/count`, a CNAME onto the GoatCounter site. **That
domain needs a certificate covering it, not just the DNS record** — at time of writing it
serves the default `goatcounter.com` cert, so browsers refuse the connection and every hit is
lost while the pages look perfectly healthy. The failure mode of analytics is always silence,
which is exactly why it is worth a check rather than a glance. → [[SPEC]] §11

Same change, smaller pieces:

- **A branded `404.html`.** The deploy artifact list is a hand-written `cp -R`, so a new
  top-level file silently never ships — the drums page lost its `og:image` to the same class
  of invisible failure. A test now asserts the workflow copies it. Note `python3 -m
  http.server` has no fallback-document support, so locally an unmatched path always shows
  Python's own error page; only GitHub Pages routes to `404.html`. → [[Dev workflows]]
- **The WebGL-fail panel stops being a dead end** — it now offers the lesson site and the
  Instagram booking link, so an unsupported device can still book. Analytics never load on
  that path, because the module graph dies at the renderer throw.
- **The stage ships minified Three.js.** It was serving the unminified dev build: 258 KB gzip
  down to 167 KB, importmap swap only. The unminified build stays in the repo for debugging.
- **`og:image` removed from every page**, by owner decision — share previews are now plain
  links. The schema.org `"image"` field and the stage's `twitter:image` were left in place.

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
