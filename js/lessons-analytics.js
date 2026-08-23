/* Booking-click events for the lesson pages.

   Booking happens in Instagram/Messenger DMs, so the last thing this site can
   observe about a visitor is the click that hands them off. That click is the
   conversion — pageviews alone cannot tell which page earns the bookings.

   Kept standalone (no stage imports) so the lesson pages stay two small
   modules. There is no external analytics service (GoatCounter was removed —
   see notes/Decisions.md): events only ever go into window.__av2Events, kept
   local to the visitor's own browser, which is how headless checks assert
   them. */

/* The Polish pages carry their own slugs rather than folding into the Ukrainian
   ones: they are the same offer in another language, and whether that language
   earns bookings is the whole question worth asking about them. */
const SLUGS = {
  '/': 'home',
  '/uroky-vokalu-lodz/': 'vocal',
  '/uroky-hitary-lodz/': 'guitar',
  '/uroky-fortepiano-lodz/': 'piano',
  '/uroky-barabaniv-lodz/': 'drums',
  '/pl/': 'pl-home',
  '/pl/lekcje-spiewu-lodz/': 'pl-vocal',
  '/pl/lekcje-gitary-lodz/': 'pl-guitar',
  '/pl/lekcje-pianina-lodz/': 'pl-piano',
  '/pl/lekcje-perkusji-lodz/': 'pl-drums',
  '/pl/polityka-prywatnosci/': 'pl-privacy',
};

const page = SLUGS[location.pathname] || location.pathname;
const ledger = window.__av2Events || (window.__av2Events = []);

function track(path) {
  ledger.push({ path, sent: true });
}

document.addEventListener('click', (e) => {
  const link = e.target?.closest?.('a[href^="https://ig.me/"], a[href^="https://m.me/"]');
  if (!link) return;
  const channel = link.href.startsWith('https://ig.me/') ? 'instagram' : 'messenger';
  track(`book-${channel}-${page}`);
});
