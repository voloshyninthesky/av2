// ============================================================
// PRICES
// The one place `prices.json` is fetched and read. Both consumers on the stage
// — the ЦІНИ mixer (`js/pricing.js`) and the price chips (`js/play/vibe.js`) —
// share this single request, so a chip can never advertise a number the modal
// it opens then contradicts.
//
// Every instrument is priced on its own in the file; nothing here groups them.
// ============================================================

const SOURCE = 'prices.json?v=20260805-03';

let loaded = null;
let request = null;

/** Resolves to the parsed prices.json — or to `null` if it could not be read. */
export function loadPrices() {
  if (request) return request;
  request = fetch(SOURCE)
    .then((res) => {
      if (!res.ok) throw new Error(`prices.json ${res.status}`);
      return res.json();
    })
    .then((data) => {
      loaded = data;
      return data;
    })
    .catch((err) => {
      console.warn('prices: failed to load prices.json', err);
      request = null; // a later modal open / chip is free to try again
      return null;
    });
  return request;
}

/** What `loadPrices()` has already resolved, or null. Never starts a request. */
export function pricesNow() {
  return loaded;
}

export function instrumentPrices(id) {
  return loaded?.instruments.find((entry) => entry.id === id) || null;
}

/** The «від N зл» teaser number: the cheapest single lesson of one instrument. */
export function lowestSinglePrice(id) {
  const lessons = instrumentPrices(id)?.singleLessons;
  if (!lessons?.length) return null;
  return Math.min(...lessons.map((lesson) => lesson.price));
}
