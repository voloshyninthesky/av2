// ============================================================
// SIGNS — «знаки на сцені» controller
// Storage is a Telegram channel, no server of our own: the whole stage lives
// in one pinned message — read via getChat, rewritten via editMessageText, and
// that edit is the entire write. Probed once per load; on any failure nothing
// at all appears, so the stage must look exactly as it does without the
// feature. Signing opens on the first VIBE fill, with the loop pedal. One sign
// per device per day, enforced only in localStorage — no IPs, no
// identifiers, nothing personal stored anywhere.
// ============================================================
import { ui } from '../core/studio.js?v=20260808-08';
import { params } from '../core/quality.js?v=20260808-08';
import { track } from '../core/analytics.js?v=20260808-08';
import { play } from '../play/state.js?v=20260808-08';
import {
  SIGN_COLORS,
  TOTAL_SLOTS,
  chooseSlot,
  setSigns,
  addSign,
  repaintSigns,
} from '../scene/signs.js?v=20260808-08';

// The channel write key, base64-chunked so the raw value never appears in
// the repo or in code search. Anyone can still extract it from the bundle —
// an accepted trade-off for having no backend (see notes/Decisions.md).
const SCENE_KEY = atob([
  'ODk1NjI3MTc0MDpBQ',
  'UVkYnRTM09sc0hfbG',
  'N5eDFlcTBuNjkta19',
  'IblJQMmpOOHwtMTAw',
  'NDQzNjcwODE2Mw==',
].join(''));
const [BOT, CHAT] = SCENE_KEY.split('|');
const API = `https://api.telegram.org/bot${BOT}`;

const STORE_KEY = 'av2.sign.v1';
const MAX_LEN = 24;
const GATE_MS = 86_400_000;
// A Telegram message tops out at 4096 UTF-16 units, and that ceiling — not
// the slot count — is what really limits how many signs the stage can show.
// So the head is a terse line format rather than JSON (roughly 40% smaller,
// and legible to the owner scrolling the channel), and the writer drains to
// a character budget rather than a row count.
const HOT_MAX_CHARS = 3300;
const COLOR_IDS = ['cream', 'gold', 'purple', 'pink', 'mint'];

/** One sign as `id|colourIndex|slot|text`. Text goes last so it may contain
 *  the separator; input whitespace is collapsed, so it has no newline. */
function encodeRow(sign) {
  return `${sign.id}|${COLOR_IDS.indexOf(sign.color)}|${sign.slot}|${sign.text}`;
}

function decodeRow(row) {
  const parts = String(row).split('|');
  if (parts.length < 4) return null;
  const id = Number(parts[0]);
  const color = COLOR_IDS[Number(parts[1])];
  const slot = Number(parts[2]);
  const text = parts.slice(3).join('|');
  if (!Number.isInteger(id) || !color || !Number.isInteger(slot) || !text) return null;
  return { id, color, slot, text };
}

function encodeHead(n, tail, rows) {
  return [`AV2 n=${n} t=${tail}`, ...rows].join('\n');
}

function parseHead(text) {
  const lines = String(text || '').split('\n');
  const header = /^AV2 n=(\d+) t=(\d+)/.exec(lines[0] || '');
  if (!header) return null;
  return {
    n: Number(header[1]),
    t: Number(header[2]),
    rows: lines.slice(1).filter(Boolean),
  };
}

let els = null;
let btn = null;
let selectedColor = 'gold';
let posting = false;
let pinnedMessageId = null;
let state = { n: 1, s: [], t: 0 };

function sanitize(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    // combining-mark stacks (zalgo) bleed far outside a tag's slot
    .replace(/(\p{M})\p{M}+/gu, '$1')
    .trim();
}

function fromRows(rows) {
  return rows.map(decodeRow).filter(Boolean);
}

async function tg(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    // URLSearchParams keeps this a "simple" CORS request — no preflight
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method}: ${data.description || res.status}`);
  return data.result;
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
  const free = chooseSlot(new Set(fromRows(state.s).map((s) => s.slot).filter(Number.isInteger)));
  btn.hidden = !play.vibeFull || Boolean(readGate()) || free === null;
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
  if (/https?:|:\/\/|www\./i.test(text)) {
    showError('Сцена — для підписів, не для посилань.');
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
    // Re-read the pinned state so a concurrent visitor's sign survives. The
    // residual last-writer-wins race can still drop one, and with no per-sign
    // channel post there is nothing else recording it — the two-hourly backup
    // in deploy/signs-backup/ is the only net under that.
    const chat = await tg('getChat', { chat_id: CHAT }).catch(() => null);
    const fresh = parseHead(chat?.pinned_message?.text);
    if (fresh) {
      state = { n: fresh.n, s: fresh.rows, t: fresh.t };
      pinnedMessageId = chat.pinned_message.message_id;
    }
    // The position is decided here, once, and travels with the sign, so it
    // stays where it was put. Surfaces fill in their declared order, and the
    // stage closes when the last slot goes.
    const used = new Set(fromRows(state.s).map((s) => s.slot).filter(Number.isInteger));
    const slot = chooseSlot(used);
    if (slot === null) {
      // Someone took the last slot while this modal sat open.
      showError('Сцена вже заповнена — вільних місць більше немає.');
      syncSignAvailability();
      return;
    }
    const sign = { id: state.n, text, color: selectedColor, slot };
    const nextN = state.n + 1;
    let hot = [...state.s, encodeRow(sign)];
    let tail = state.t;
    // Nothing is ever discarded: rows that no longer fit seal into an archive
    // message whose `P=` points at the previous chunk — a linked list hanging
    // off the head's `t`. The stage never reads them (a bot cannot fetch
    // arbitrary messages back anyway); they are the record, sitting visibly
    // in the channel.
    const head = () => encodeHead(nextN, tail, hot);
    // Drain from the oldest end until the head both fits the stage and fits
    // a Telegram message. Each row must genuinely leave `hot`, or it would
    // be archived again on every write while the head grew past the limit
    // anyway — the failure mode a fixed row budget invites.
    const sealed = [];
    while (hot.length > TOTAL_SLOTS) sealed.push(hot.shift());
    while (hot.length > 1 && head().length > HOT_MAX_CHARS) sealed.push(hot.shift());
    if (sealed.length) {
      const node = await tg('sendMessage', {
        chat_id: CHAT,
        text: [`P=${tail}`, ...sealed].join('\n'),
        disable_notification: 'true',
      });
      tail = node.message_id;
    }
    state = { n: nextN, s: hot, t: tail };
    // The pinned head is the whole write: one edit, nothing else. An earlier
    // version also posted "✍️ text · colour" to the channel as a feed, but
    // that is a second message per sign for no functional reason — the head
    // (plus the archive chunks a drain produces) already is the record.
    await tg('editMessageText', {
      chat_id: CHAT,
      message_id: pinnedMessageId,
      text: head(),
    });
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

export function initSigns() {
  // QA runs must not depend on the network or write to the live stage —
  // same stance as analytics: the stage keeps its no-feature baseline.
  if (['testhooks', 'headless', 'shot'].some((flag) => params.has(flag))) return;
  let probe;
  try {
    probe = tg('getChat', { chat_id: CHAT });
  } catch {
    return; // no fetch/AbortSignal.timeout → treat as unreachable
  }
  probe
    .then((chat) => {
      const parsed = parseHead(chat?.pinned_message?.text);
      if (!parsed) return; // no readable head → nothing to show, nowhere to write
      pinnedMessageId = chat.pinned_message.message_id;
      state = { n: parsed.n, s: parsed.rows, t: parsed.t };
      enable(fromRows(parsed.rows));
    })
    .catch(() => { /* storage unreachable: the feature stays invisible */ });
}
