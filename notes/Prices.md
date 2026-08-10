---
tags: [subsystem, data]
---

# Prices

`prices.json` is the single source. Schema and field meanings: [[SPEC]] §7.

> **Editing `prices.json` alone is a complete price change.** No HTML edit, no red build.

That sentence is the whole design goal, and it is aimed at a specific person: the studio
owner, changing a number without a developer.

## How it holds together

```
prices.json
├── js/core/prices.js  ── single fetch ──► pricing mixer + price chips   (runtime)
└── tools/sync-prices.mjs ── generates ──► index.html, uroky-*-lodz/     (build-time)
                                           pl/index.html, pl/lekcje-*/
                                          └── tests/lesson-prices.test.mjs verifies
```

The stage reads the JSON at runtime. The static lesson pages **cannot** — they load no JS —
so `tools/sync-prices.mjs` writes the numbers into them. The deploy workflow runs it
**before** the tests, so a price-only edit regenerates the pages and ships green without
anyone touching HTML.

Run it locally after editing:

```bash
node tools/sync-prices.mjs
```

```bash
node tools/sync-prices.mjs --check
```

`--check` reports drift, changes nothing, exits 1. Run the plain form after touching
`prices.json` so the committed pages match too — otherwise the deploy quietly regenerates
them and your working tree disagrees with production.

### What the script writes

- each price cell — `data-price="single:<id>:<minutes>"` and
  `data-price="pack:<id>:<minutes>:<lessons>"`
- the payment note — `data-payment-note`
- the promotions list — `data-promotions`, with badge and plural derived from the promotion
- the JSON-LD `lowPrice` / `highPrice` / `priceRange` (Ukrainian pages only — the Polish
  ones carry no structured data)

### The Polish pages are the same contract, in another language

A page prints words around the numbers, so those words are data too and live in the same
file: `currency.displayPl` (`zł`), `promotions[].descriptionPl`, `paymentNotePl`. Each page
is generated **and checked** against its own locale, and the badge plural follows it —
`+1 урок` / `+1 lekcja`.

They are in `prices.json` rather than in a table inside `tools/sync-prices.mjs` for the same
reason as everything else here: the studio owner edits one file. And a promotion added
without its `descriptionPl` **fails the script by name** — a half-translated page is the
failure mode worth being loud about, because it looks fine to anyone who does not read
Polish. → [[Lesson site]], [[Decisions]]

## Two rules that are enforced by tests

**1. Amounts appear only in price tables.** Marketing copy names no price — a test fails if
one appears outside a `data-price` cell. Rationale: nothing would keep a hand-written number
current, so the guard is "there is no such thing as a price outside the generated cells".

The one sanctioned exception is the trial-lesson strip in [[Lesson site]], which reads
«50 зл» as part of the offer — check how it's marked up before adding anything similar.

**2. Structural drift fails loudly.** `tests/lesson-prices.test.mjs` fails only on
*structural* change — a tier added or removed changes **which cells exist**, and the script
can't invent a cell that isn't in the HTML. It names the offending key. So:

| Change                                   | Who does it        |
| ---------------------------------------- | ------------------ |
| A number moves                           | anyone, JSON only  |
| A duration tier / package size / instrument added or removed | a developer, HTML + JSON |

## Every instrument is priced separately

`vocal`, `guitar`, `drums`, `piano` each own a **full** price list, even where two currently
quote identical numbers (`4e8e35f`). No consumer groups them, so changing one instrument's
price stays a one-place edit. Resist the urge to factor out the duplication — the duplication
*is* the feature.

- `id` matches the stage instrument keys. `mic` → `vocal` is the one alias.
- `name` is the label the mixer board prints; `theme` picks the board skin (`vocal` | `rhythm`).

## Where prices surface

- **The pricing mixer** (`js/pricing.js`) — pick instrument → format (разовий / абонемент) →
  duration → package size, with a live ticket board (total + ≈ per lesson) themed purple or
  gold from the instrument's `theme`. Opening it defaults to the **cheapest** option, and if
  the current duration is unavailable for the newly chosen format it falls back to the first
  (cheapest) duration.
- **The price chip** — a once-per-instrument teaser pill showing that instrument's **own
  cheapest single lesson**, queued on first play and shown after leaving focus, at most one
  every 3 minutes across all instruments. Details and timing rules: [[SPEC]] §6.
- **The lesson pages** — generated tables, per above.

## Related

- [[Lesson site]] — the generated pages and their JSON-LD
- [[Dev workflows]] — where `sync-prices` sits in the deploy pipeline
