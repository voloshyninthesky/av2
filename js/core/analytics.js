// ============================================================
// ANALYTICS (GoatCounter events)
// The stage is a lead-gen toy, so the only numbers worth having are the funnel:
// scene started → first note played → prices opened → booking link clicked.
// Sending is best-effort by design — the beacon is blocked for plenty of
// visitors, and nothing here may ever break the scene. QA runs record events
// into `window.__av2Events` but never send them, so headless checks can assert
// the funnel without writing to the dashboard.
// ============================================================
import { params } from './quality.js?v=20260807-02';

const QA_RUN = ['testhooks', 'headless', 'shot'].some((flag) => params.has(flag));

const ledger = [];
window.__av2Events = ledger;

export function track(path) {
  const sent = !QA_RUN;
  ledger.push({ path, sent });
  if (!sent) return;
  try {
    window.goatcounter?.count?.({ path, event: true });
  } catch (_) { /* analytics is never worth an exception */ }
}

const tracked = new Set();
export function trackOnce(path) {
  if (tracked.has(path)) return;
  tracked.add(path);
  track(path);
}

// ui.js announces every route into a modal (HUD button, price chip, deep link).
window.addEventListener('av2:modal', (e) => {
  if (e.detail?.open && e.detail.name === 'pricing') trackOnce('stage-pricing-open');
});

// The booking links are static anchors in the "як записатися" and pricing
// overlays; delegation keeps this working whichever one the visitor reaches.
document.addEventListener('click', (e) => {
  const link = e.target?.closest?.('a[href^="https://ig.me/"], a[href^="https://m.me/"]');
  if (!link) return;
  track(link.href.startsWith('https://ig.me/') ? 'book-instagram-stage' : 'book-messenger-stage');
});
