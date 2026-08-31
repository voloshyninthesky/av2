// ============================================================
// ANALYTICS (internal event ledger)
// The stage is a lead-gen toy, so the only numbers worth having are the funnel:
// scene started → first note played → prices opened → booking link clicked.
// There is no external analytics service (GoatCounter was removed — see
// notes/Decisions.md): events only ever go into `window.__av2Events`, kept
// local to the visitor's own browser. `sent` still marks whether a QA run
// produced the event, so headless checks can tell a real funnel completion
// from a driven one.
// ============================================================
import { params } from './quality.js?v=20260831-01';

const QA_RUN = ['testhooks', 'headless', 'shot'].some((flag) => params.has(flag));

const ledger = [];
window.__av2Events = ledger;

export function track(path) {
  ledger.push({ path, sent: !QA_RUN });
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
