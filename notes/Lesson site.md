---
tags: [subsystem, seo]
---

# Lesson site

The static half of the project, and since 2026-08-06 (`b259446`) the **front door**.

```
index.html                    the hub
uroky-vokalu-lodz/            вокал
uroky-hitary-lodz/            гітара
uroky-fortepiano-lodz/        фортепіано
uroky-barabaniv-lodz/         ударні
uk/…                          redirect stubs for the old /uk/* URLs
css/lessons.css               the skin
```

Slugs are Ukrainian-transliterated and city-suffixed (`uroky-<instrument>-lodz`) because the
search intent they serve is "уроки гітари Лодзь". That is also why there are four separate
pages rather than one page with tabs.

## Deliberately plain

`css/lessons.css` is described in [[AGENTS]] as a "deliberate 2007-era skin", and the pages
load **no JavaScript** other than two tiny progressive enhancements. Consequences worth
knowing before you improve anything here:

- Every price the pages display is a **copy of data**, so it is generated rather than
  hand-maintained → [[Prices]].
- The pages carry JSON-LD (`MusicSchool` / `LocalBusiness` + an `ItemList` of the four
  directions, with `priceRange` and `sameAs`). Editing a price without regenerating leaves
  the structured data lying to Google.
- Nothing here shares code with the stage. The stage's design system is `css/style.css`;
  these use `css/lessons.css`.

## The two enhancements

Both are written the same way on purpose: **the markup ships complete, and the script only
folds or fills.** If the script fails to load, the page is still correct.

- `js/lessons-credit.js` (19 lines) — the designer credit ships with **the name visible**;
  the script folds it behind a heart that reveals it on click. The comment in the file says
  it plainly: an easter egg is a nice thing to have and a poor thing to depend on, so the
  *enhancement* is what gets added, never the credit. State lives in `data-state`, which the
  CSS reads; no attribute at all is the plain-name fallback. The heart beats, so the click is
  worth finding (`6e28441`).
- `js/lessons-weather.js` (69 lines) — Łódź weather in the sidebar via **Open-Meteo**: no API
  key, CORS headers, plain JSON, so the pages stay free of trackers and iframes. It fills a
  placeholder that ships in the HTML, and on failure it **removes itself** rather than leaving
  a broken box. WMO condition codes are grouped into Ukrainian bands (neighbouring codes
  differ only by intensity). Kept on phones and tablets (`dee588b`).

## Booking CTAs split by intent

Every booking button deep-links into a **conversation**, not a profile:

- `https://ig.me/m/artvibe.pl`
- `https://m.me/61564874125852?text=<prefilled message naming the instrument, no emoji>`

Instagram has no text-prefill parameter, so its booking link carries no per-page context.
**Browsing** links — the footer, and the «відгуки та викладачі» notes pointing at student
reviews and teacher posts — keep the plain profile URL, as does JSON-LD `sameAs`.

The lead offer is the **50-зл trial lesson**: a `.trial-offer` gold strip above the
lesson-hero CTAs (on the hub, above the price-section CTAs). Because Instagram can't
prefill, the strip closes by telling visitors what to type — «Напиши в директ "Хочу на
пробний урок"» — and the Messenger prefill beside it repeats that exact phrase. Button
labels stay the neutral «Записатися через …» everywhere.

## The `/uk/` stubs

Before 2026-08-06 the lesson pages lived under `/uk/`. Those URLs are indexed and
bookmarked, so `uk/index.html` and `uk/uroky-*-lodz/index.html` are redirect stubs:

- `<link rel="canonical">` to the new URL
- `<meta http-equiv="refresh" content="0; url=/">` for no-JS clients
- `location.replace('/' + location.search + location.hash)` — **`replace`, not `assign`**,
  so Back doesn't bounce the visitor straight back to the stub. Search and hash are carried
  through, which keeps `?anchor=guitar`-style links alive.

They are in the deploy artifact list, so don't drop `uk` from it.

## Related

- [[Prices]] — why the price cells are generated, and what breaks if you hand-edit them
- [[Decisions]] — why the stage stopped being the front door
- [[Dev workflows]] — `tools/sync-prices.mjs`, and the test that guards these pages
