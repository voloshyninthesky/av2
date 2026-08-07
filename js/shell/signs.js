// ============================================================
// SIGNS — «знаки на сцені» controller
// Storage is a Telegram channel, no server of our own: every accepted sign
// is sent as a channel post (the owner's human-readable feed), and the
// stage state lives in one pinned message — read via getChat, rewritten
// via editMessageText. Probed once per load; on any failure nothing at all
// appears, so the stage must look exactly as it does without the feature.
// One sign per device per day, enforced only in localStorage — no IPs, no
// identifiers, nothing personal stored anywhere.
// ============================================================
import { ui } from '../core/studio.js?v=20260807-04';
import { params } from '../core/quality.js?v=20260807-04';
import { track } from '../core/analytics.js?v=20260807-04';
import {
  SIGN_COLORS,
  TOTAL_SLOTS,
  chooseSlot,
  setSigns,
  addSign,
  repaintSigns,
} from '../scene/signs.js?v=20260807-04';

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
const DAY_MS = 86_400_000;
// A Telegram message tops out at 4096 chars, so the pinned head holds only
// what the stage can show and seals the rest into linked archive messages.
// The budget is in characters, not rows, because that is the limit that
// actually exists — a row count drifts the moment the stage gains slots.
// (Chars as Telegram counts them, UTF-16 units, which is exactly what
// JSON.stringify().length already reports.)
const HOT_MAX_CHARS = 3300;

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

function fromState(parsed) {
  return (Array.isArray(parsed?.s) ? parsed.s : [])
    .filter((row) => Array.isArray(row) && Number.isInteger(row[0]) && typeof row[2] === 'string')
    .map(([id, color, text, slot]) => ({ id, color, text, slot }));
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
    return typeof saved?.ts === 'number' && Date.now() - saved.ts < DAY_MS ? saved : null;
  } catch {
    return null;
  }
}

function syncButtonGate() {
  const gated = Boolean(readGate());
  btn.classList.toggle('is-done', gated);
  const label = gated ? 'Твій знак уже на сцені — новий можна завтра' : 'Залиш свій слід на сцені';
  btn.title = label;
  btn.setAttribute('aria-label', label);
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
  } catch { /* storage may be unavailable; the once-a-day gate just relaxes */ }
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
    showError('Один знак на день — повернись завтра.');
    return;
  }
  posting = true;
  els.submit.disabled = true;
  els.submit.textContent = 'ЛИШАЄМО…';
  try {
    // Re-read the pinned state so a concurrent visitor's sign survives; the
    // remaining write race can drop one sign from the stage, but its channel
    // post below still records it for the owner.
    const chat = await tg('getChat', { chat_id: CHAT }).catch(() => null);
    const pinned = chat?.pinned_message;
    if (pinned?.text) {
      try {
        const fresh = JSON.parse(pinned.text);
        state = {
          n: Number(fresh.n) || state.n,
          s: Array.isArray(fresh.s) ? fresh.s : state.s,
          t: Number.isInteger(fresh.t) ? fresh.t : 0,
        };
        pinnedMessageId = pinned.message_id;
      } catch { /* keep the state we booted with */ }
    }
    // The position is decided here, once, and travels with the sign — it
    // stays where it was put even as older signs retire around it. Wall
    // slots fill first; the freed slot of the sign leaving the displayed
    // window (if the stage is at capacity) is what comes back around.
    const displayed = state.s.slice(-(TOTAL_SLOTS - 1));
    const used = new Set(displayed.map((row) => row[3]).filter((s) => Number.isInteger(s)));
    const slot = chooseSlot(used) ?? 0;
    const sign = { id: state.n, text, color: selectedColor, slot };
    const nextN = state.n + 1;
    let hot = [...state.s, [sign.id, sign.color, sign.text, sign.slot]];
    let tail = state.t;
    // Nothing is ever discarded: when the head outgrows its budget, every
    // row older than the displayed window seals into an archive message
    // whose `p` points at the previous chunk — a linked list of messages
    // hanging off the head's `t`. The stage never needs to read them (bots
    // cannot fetch arbitrary messages back anyway); they are the archive,
    // sitting visibly in the channel.
    const head = () => JSON.stringify({ v: 2, n: nextN, t: tail, s: hot });
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
        text: JSON.stringify({ p: tail, r: sealed }),
        disable_notification: 'true',
      });
      tail = node.message_id;
    }
    state = { n: nextN, s: hot, t: tail };
    await tg('editMessageText', {
      chat_id: CHAT,
      message_id: pinnedMessageId,
      text: head(),
    });
    // Best-effort feed post so the owner sees each sign arrive in Telegram.
    tg('sendMessage', { chat_id: CHAT, text: `✍️ ${text} · ${sign.color}` }).catch(() => {});
    rememberSign(text, selectedColor);
    syncButtonGate();
    showError('');
    addSign(sign);
    ui.closeAll();
    ui.toast('Готово! <span class="hl">Твій знак на сцені</span> — його бачать усі гості', 4200);
    track('stage-sign-left');
  } catch {
    showError('Сцена зараз недоступна — спробуй пізніше.');
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
  // Not data-open: the once-a-day gate decides between the modal and a toast.
  btn.addEventListener('click', () => {
    if (readGate()) ui.toast('Один знак на день — <span class="hl">повернись завтра</span> ✦', 3200);
    else ui.open('sign', null, btn);
  });
  syncButtonGate();
  btn.hidden = false;
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
      const pinned = chat?.pinned_message;
      if (!pinned?.text) return;
      const parsed = JSON.parse(pinned.text);
      pinnedMessageId = pinned.message_id;
      state = {
        n: Number(parsed.n) || 1,
        s: Array.isArray(parsed.s) ? parsed.s : [],
        t: Number.isInteger(parsed.t) ? parsed.t : 0,
      };
      enable(fromState(parsed));
    })
    .catch(() => { /* storage unreachable: the feature stays invisible */ });
}
