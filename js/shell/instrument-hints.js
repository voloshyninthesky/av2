// ============================================================
// INSTRUMENT HOW-TO HINTS
// One short, plain-spoken line the first time each instrument reaches its
// focused close-up — the moment the visitor is looking straight at it and has
// not yet worked out what to do. Dismissal is persisted per instrument, so a
// returning visitor never reads the same one twice.
//
// The copy is deliberately casual and describes the *gesture*, not the UI:
// someone who has never used the stage needs "hit them", not "use the pads".
// ============================================================
import { isMobileGameMode } from '../core/quality.js?v=20260806-16';
import { ui } from '../core/studio.js?v=20260806-16';

const FOCUS_HINT_KEY = 'av2.instrument-hint.v2';
// `skiponboard` means "no first-run tips at all" — these included.
const skipOnboardHints = new URLSearchParams(location.search).has('skiponboard');

function storageGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function storageSet(key, value) { try { localStorage.setItem(key, value); } catch { /* optional */ } }

// Touch copy matches the pads / multitouch surfaces; desktop copy adds that
// instrument's jam keys after the same sentence, so both read the same way.
const FOCUS_HINTS = {
  drums: {
    touch: 'Щоб барабани застукали — по них треба бити',
    desktop: 'Щоб барабани застукали — по них треба бити. Або тисни <span class="hl">Z X C V B</span>',
  },
  guitar: {
    touch: 'Затисни акорд і проведи по струнах',
    desktop: 'Затисни акорд і проведи по струнах. Або <span class="hl">Q–Y</span> і <span class="hl">пробіл</span>',
  },
  piano: {
    touch: 'Звук на піаніно дають натиски на клавіші',
    desktop: 'Звук на піаніно дають натиски на клавіші. Або <span class="hl">A–L</span>, чорні — верхній ряд',
  },
  mic: {
    touch: 'Щоб заспівати — подумай про ноту і натисни на неї',
    desktop: 'Щоб заспівати — подумай про ноту і натисни на неї. Або <span class="hl">N M , . /</span>',
  },
};

export function showFirstFocusInstrumentHint(kind) {
  if (skipOnboardHints) return;
  const hint = FOCUS_HINTS[kind];
  if (!hint) return;
  let seen = {};
  try { seen = JSON.parse(storageGet(FOCUS_HINT_KEY) || '{}') || {}; } catch { /* re-show */ }
  if (seen[kind]) return;
  seen[kind] = 1;
  storageSet(FOCUS_HINT_KEY, JSON.stringify(seen));
  ui.toast(hint[isMobileGameMode() ? 'touch' : 'desktop'], 5200);
}
