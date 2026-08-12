// ============================================================
// SIGNS — «знаки на сцені» controller
// Storage is a small service of our own: deploy/av2-signs/server.js, SQLite
// behind nginx at back.artvibe.com.pl. GET /signs to read, POST /signs to
// leave one — the server picks the slot inside a transaction, so two visitors
// signing at once can no longer overwrite each other. That race is why the
// stage stopped writing its store straight from the browser.
//
// No write key ships here: the browser holds nothing but a URL, and validation
// is enforced server-side rather than merely encouraged.
//
// Probed once per load; on any failure nothing at all appears, so the stage
// must look exactly as it does without the feature. Signing opens on the first
// VIBE fill, with the loop pedal. One sign per device per day, enforced in
// localStorage — no identifiers, nothing personal stored in the browser.
// ============================================================
import { ui } from '../core/studio.js?v=20260813-06';
import { params } from '../core/quality.js?v=20260813-06';
import { track } from '../core/analytics.js?v=20260813-06';
import { play } from '../play/state.js?v=20260813-06';
import {
  SIGN_COLORS,
  TOTAL_SLOTS,
  setSigns,
  addSign,
  repaintSigns,
} from '../scene/signs.js?v=20260813-06';

const API = 'https://back.artvibe.com.pl';

const STORE_KEY = 'av2.sign.v1';
const MAX_LEN = 24;
const GATE_MS = 86_400_000;

let els = null;
let btn = null;
let selectedColor = 'gold';
let posting = false;
/** Last state read from the backend: the signs on the stage and its capacity. */
let state = { signs: [], total: TOTAL_SLOTS };

function sanitize(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    // combining-mark stacks (zalgo) bleed far outside a tag's slot
    .replace(/(\p{M})\p{M}+/gu, '$1')
    .trim();
}

/** Everything currently on the stage. Rejects a malformed row rather than
 *  letting it reach the renderer, the same as the line format used to. */
async function readSigns() {
  const res = await fetch(`${API}/signs`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`GET /signs: ${res.status}`);
  const data = await res.json();
  const signs = (Array.isArray(data?.signs) ? data.signs : []).filter((s) => (
    Number.isInteger(s?.id) && Number.isInteger(s?.slot)
    && typeof s?.text === 'string' && s.text && SIGN_COLORS[s?.color]
  ));
  return { signs, total: Number(data?.total) || TOTAL_SLOTS };
}

/**
 * Leave a sign. The server assigns the slot inside a transaction, so this can
 * no longer lose a race with a concurrent visitor — the reason storage stopped
 * being written from the browser at all.
 *
 * Form-encoded keeps it a "simple" CORS request, so there is no preflight.
 * Returns the stored sign, or a reason string the caller turns into copy.
 */
async function postSign(text, color) {
  const res = await fetch(`${API}/signs`, {
    method: 'POST',
    body: new URLSearchParams({ text, color }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json().catch(() => null);
  if (res.ok && data?.sign) return { sign: data.sign };
  return { reason: data?.reason || String(res.status) };
}

function readGate() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    return typeof saved?.ts === 'number' && Date.now() - saved.ts < GATE_MS ? saved : null;
  } catch {
    return null;
  }
}

/**
 * The button exists only while a visitor can actually use it: they have filled
 * the vibe meter once, the storage answered, they have not signed in the last
 * day, and the stage still has a free slot. A control that is visible but
 * cannot do anything is worse than no control — it invites a tap and answers
 * with a refusal.
 *
 * The vibe gate is why this is a function rather than a one-time reveal: the
 * meter can fill before or after the storage probe resolves, and either order
 * has to end with the right thing on screen.
 */
function syncSignAvailability() {
  if (!btn) return;
  // The backend owns capacity, so its `total` is what the badge quotes and
  // what decides whether the stage is full — the client's TOTAL_SLOTS is a
  // layout constant and only a fallback here.
  const free = Math.max(0, state.total - state.signs.length);
  btn.hidden = !play.vibeFull || Boolean(readGate()) || free === 0;
  // Lives inside the modal rather than gated with the button: if the stage
  // fills while the modal is already open, this is what tells the visitor why
  // their tap just got refused, alongside the error text. Two nodes rather
  // than one string so the count can carry its own weight in the badge.
  els.freeCount.textContent = String(free);
  els.freeTotal.textContent = `/ ${state.total} вільних місць`;
}

/** Called when the vibe meter first fills — signing opens with the loop pedal. */
export function revealSigns() {
  syncSignAvailability();
}

function showError(message) {
  els.error.textContent = message;
  els.error.hidden = !message;
}

function selectColor(color) {
  if (!SIGN_COLORS[color]) return;
  selectedColor = color;
  for (const b of els.swatches) {
    const on = b.dataset.color === color;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  }
  syncPreview();
}

function syncPreview() {
  const hex = SIGN_COLORS[selectedColor];
  const text = sanitize(els.input.value);
  els.preview.textContent = text || 'Твій підпис';
  els.preview.style.color = hex;
  els.preview.style.opacity = text ? '1' : '.45';
  els.preview.style.textShadow = `0 0 18px ${hex}88, 0 0 5px ${hex}66`;
}

function rememberSign(text, color) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ text, color, ts: Date.now() }));
  } catch { /* storage may be unavailable; the daily gate just relaxes */ }
}

function recallSign() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (typeof saved?.text === 'string') els.input.value = saved.text.slice(0, MAX_LEN);
    if (SIGN_COLORS[saved?.color]) selectedColor = saved.color;
  } catch { /* corrupt or absent — start blank */ }
}

/** What each server refusal means to a visitor. `full` is the only one they
 *  can do anything about, and even then only by giving up. */
const REFUSALS = {
  full: 'Сцена вже заповнена — вільних місць більше немає.',
  rate: 'Трохи зачекай — і спробуй ще раз.',
  invalid: 'Такий підпис не підходить — спробуй інший.',
};

async function submitSign(event) {
  event.preventDefault();
  if (posting) return;
  const text = sanitize(els.input.value);
  if (!text) {
    showError('Спершу напиши щось — хоч пару літер.');
    return;
  }
  if ([...text].length > MAX_LEN) {
    showError(`До ${MAX_LEN} символів — як тег, не як лист.`);
    return;
  }
  if (readGate()) {
    showError('Спробуй завтра.');
    return;
  }
  posting = true;
  els.submit.disabled = true;
  els.submit.textContent = 'ЛИШАЄМО…';
  try {
    // One request, and the server decides everything that used to be decided
    // here: which slot, whether there is one left, whether the text passes.
    // There is no read-modify-write from the browser any more, so there is no
    // race to lose and nothing to verify afterwards — the response either
    // carries the stored sign or says why not.
    const { sign, reason } = await postSign(text, selectedColor);
    if (!sign) {
      // Deliberately not remembered on a refusal: the daily gate must not burn
      // a visitor's day for a sign that was never stored. The modal stays open
      // with their text, so a retry is one more press.
      showError(REFUSALS[reason] || 'ой, не сьогодні :(');
      // A refusal usually means our picture of the stage is stale — reread it,
      // so the badge and the button agree with the server.
      await refresh().catch(() => {});
      return;
    }
    state.signs = [...state.signs, sign];
    rememberSign(text, selectedColor);
    syncSignAvailability();
    showError('');
    addSign(sign);
    ui.closeAll();
    ui.toast('Готово! Шукай свій підпис на сцені.', 4200);
    track('stage-sign-left');
  } catch {
    showError('ой, не сьогодні :(');
  } finally {
    posting = false;
    els.submit.disabled = false;
    els.submit.textContent = 'ЗАЛИШИТИ НА СЦЕНІ';
  }
}

function wireForm() {
  els.form.addEventListener('submit', submitSign);
  els.input.addEventListener('input', () => {
    showError('');
    syncPreview();
  });
  for (const b of els.swatches) {
    b.addEventListener('click', () => selectColor(b.dataset.color));
  }
  // Roving arrows + Home/End inside the color radiogroup, mirroring the
  // mascot editor's swatch rows.
  els.swatchRow.addEventListener('keydown', (e) => {
    const order = els.swatches.map((b) => b.dataset.color);
    let next = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = order[(order.indexOf(selectedColor) - 1 + order.length) % order.length];
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = order[(order.indexOf(selectedColor) + 1) % order.length];
    } else if (e.key === 'Home') {
      next = order[0];
    } else if (e.key === 'End') {
      next = order[order.length - 1];
    }
    if (!next) return;
    e.preventDefault();
    selectColor(next);
    els.swatches.find((b) => b.dataset.color === next)?.focus();
  });
}

function enable(signs) {
  btn = document.getElementById('sign-btn');
  const modal = document.getElementById('modal-sign');
  if (!btn || !modal) return;
  els = {
    form: modal.querySelector('#sign-form'),
    input: modal.querySelector('#sign-text'),
    preview: modal.querySelector('#sign-preview-text'),
    error: modal.querySelector('#sign-error'),
    submit: modal.querySelector('#sign-submit'),
    freeCount: modal.querySelector('#sign-free-count'),
    freeTotal: modal.querySelector('#sign-free-total'),
    swatchRow: modal.querySelector('.sign-swatches'),
    swatches: [...modal.querySelectorAll('.sign-swatches .swatch')],
  };
  setSigns(signs);
  // Studio assembly can outrun the webfonts; repaint once they settle so the
  // tags don't keep a fallback face (same reason drums.refreshLogo exists).
  document.fonts?.ready?.then(() => repaintSigns());
  recallSign();
  wireForm();
  selectColor(selectedColor);
  btn.addEventListener('click', () => ui.open('sign', null, btn));
  syncSignAvailability();
}

/** Re-read the stage and repaint from it. Used after a refusal, when what the
 *  server knows and what this tab believes have visibly diverged. */
async function refresh() {
  state = await readSigns();
  setSigns(state.signs);
  syncSignAvailability();
}

export function initSigns() {
  // QA runs must not depend on the network or write to the live stage —
  // same stance as analytics: the stage keeps its no-feature baseline.
  if (['testhooks', 'headless', 'shot'].some((flag) => params.has(flag))) return;
  let probe;
  try {
    probe = readSigns();
  } catch {
    return; // no fetch/AbortSignal.timeout → treat as unreachable
  }
  probe
    .then((fresh) => {
      state = fresh;
      enable(fresh.signs);
    })
    .catch(() => { /* storage unreachable: the feature stays invisible */ });
}
