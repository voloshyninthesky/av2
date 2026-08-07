// ============================================================
// ART VIBE — interactive pricing mixer (driven by prices.json)
// Every instrument carries its own prices, name and board theme in the data,
// so this module never has to know which instruments happen to cost the same.
// ============================================================
import { loadPrices } from './core/prices.js?v=20260807-04';

/** Chip / close-up kinds that name an instrument differently than the data. */
const ANCHOR_MAP = {
  mic: 'vocal',
};

function pluralLessons(n) {
  if (n === 1) return '1 урок';
  if (n >= 2 && n <= 4) return `${n} уроки`;
  return `${n} уроків`;
}

export class PricingPicker {
  constructor(root) {
    this.root = root;
    this.data = null;
    this.ready = false;
    this._initPromise = null;
    this.state = {
      instrument: 'vocal',
      format: 'single',
      duration: 30,
      lessons: 4,
    };
    this.el = {
      mixer: root.querySelector('#price-mixer'),
      instruments: root.querySelectorAll('[data-instrument]'),
      formats: root.querySelectorAll('[data-format]'),
      durations: root.querySelector('#price-durations'),
      packs: root.querySelector('#price-packs'),
      packSection: root.querySelector('#price-pack-section'),
      board: root.querySelector('#price-board'),
      value: root.querySelector('#price-board-value'),
      kicker: root.querySelector('#price-board-kicker'),
      meta: root.querySelector('#price-board-meta'),
      note: root.querySelector('#price-board-note'),
      per: root.querySelector('#price-board-per'),
      promos: root.querySelector('#price-promos'),
      foot: root.querySelector('#price-foot'),
    };
  }

  init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._load();
    return this._initPromise;
  }

  async _load() {
    this.data = await loadPrices();
    if (!this.data) return;
    this._bind();
    this._renderPromos();
    this.ready = true;
    this.render();
  }

  selectInstrument(anchor) {
    this.state.instrument = ANCHOR_MAP[anchor] || anchor;
    if (this.ready) {
      this._applyCheapestDefaults();
      this.render({ flash: true });
    }
  }

  _bind() {
    this.el.instruments.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.instrument = btn.dataset.instrument;
        this._applyCheapestDefaults();
        this.render();
      });
    });
    this.el.formats.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.format = btn.dataset.format;
        this.render();
      });
    });
    this.el.durations.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-duration]');
      if (!btn) return;
      this.state.duration = Number(btn.dataset.duration);
      this.render();
    });
    this.el.packs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lessons]');
      if (!btn) return;
      this.state.lessons = Number(btn.dataset.lessons);
      this.render();
    });
  }

  /** Prefer the first / cheapest duration and pack for the current instrument. */
  _applyCheapestDefaults() {
    this.state.format = 'single';
    const instrument = this._instrument();
    if (!instrument) return;
    const cheapest = instrument.singleLessons.reduce((best, row) => {
      if (!best) return row;
      return row.price < best.price ? row : best;
    }, null);
    this.state.duration = cheapest?.durationMinutes
      ?? instrument.singleLessons[0]?.durationMinutes
      ?? this.state.duration;
    const sub = instrument.subscriptions.find((r) => r.durationMinutes === this.state.duration)
      || instrument.subscriptions[0];
    const packs = sub?.packages || [];
    const cheapestPack = packs.reduce((best, pack) => {
      if (!best) return pack;
      return pack.price < best.price ? pack : best;
    }, null);
    this.state.lessons = cheapestPack?.lessons ?? packs[0]?.lessons ?? this.state.lessons;
  }

  /** The active instrument's prices — an unknown anchor falls back to the first. */
  _instrument() {
    const list = this.data.instruments;
    return list.find((entry) => entry.id === this.state.instrument) || list[0];
  }

  _renderPromos() {
    if (!this.el.promos || !this.data.promotions?.length) return;
    this.el.promos.innerHTML = this.data.promotions.map((p) => {
      if (p.type === 'loyaltyBonus') {
        return `<p><b>Бонусний урок</b> ${p.description}</p>`;
      }
      return `<p><b>−${p.valuePercent}%</b> ${p.description}</p>`;
    }).join('');
  }

  _syncChoiceButtons() {
    this.el.instruments.forEach((btn) => {
      const on = btn.dataset.instrument === this.state.instrument;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    this.el.formats.forEach((btn) => {
      const on = btn.dataset.format === this.state.format;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  _fillDurations(instrument) {
    const source = this.state.format === 'single'
      ? instrument.singleLessons
      : instrument.subscriptions;
    const durations = source.map((row) => row.durationMinutes);
    if (!durations.includes(this.state.duration)) {
      this.state.duration = durations[0];
    }
    this.el.durations.innerHTML = durations.map((d) => {
      const on = d === this.state.duration;
      return `<button type="button" class="choice-chip${on ? ' is-on' : ''}" data-duration="${d}" role="radio" aria-checked="${on}">${d} хв</button>`;
    }).join('');
  }

  _fillPacks(subRow) {
    const packs = subRow?.packages || [];
    if (!packs.length) {
      this.el.packSection.hidden = true;
      return;
    }
    if (!packs.some((p) => p.lessons === this.state.lessons)) {
      this.state.lessons = packs[0].lessons;
    }
    this.el.packSection.hidden = false;
    this.el.packs.innerHTML = packs.map((p) => {
      const on = p.lessons === this.state.lessons;
      return `<button type="button" class="choice-chip${on ? ' is-on' : ''}" data-lessons="${p.lessons}" role="radio" aria-checked="${on}">${pluralLessons(p.lessons)}</button>`;
    }).join('');
  }

  _quote(instrument) {
    const cur = this.data.currency.display;
    const inst = instrument.name;
    const theme = instrument.theme || 'vocal';

    if (this.state.format === 'single') {
      const row = instrument.singleLessons.find((r) => r.durationMinutes === this.state.duration)
        || instrument.singleLessons[0];
      return {
        theme,
        price: row.price,
        kicker: `${inst} · разовий`,
        meta: `${row.durationMinutes} хв · 1 урок`,
        note: row.audience || '',
        per: '',
        cur,
      };
    }

    const sub = instrument.subscriptions.find((r) => r.durationMinutes === this.state.duration)
      || instrument.subscriptions[0];
    const pack = sub.packages.find((p) => p.lessons === this.state.lessons)
      || sub.packages[0];
    const per = Math.round(pack.price / pack.lessons);
    return {
      theme,
      price: pack.price,
      kicker: `${inst} · абонемент`,
      meta: `${sub.durationMinutes} хв · ${pluralLessons(pack.lessons)}`,
      note: sub.audience || 'ціна за весь пакет',
      per: `≈ ${per} ${cur} / урок`,
      cur,
    };
  }

  render({ flash = false } = {}) {
    if (!this.ready) return;
    const instrument = this._instrument();
    if (!instrument) return;
    // An anchor the data does not price (or a stale id) settles on the fallback
    // instrument here, so the buttons highlight what the board actually quotes.
    this.state.instrument = instrument.id;

    // First paint (and any path that never called _applyCheapestDefaults) still
    // lands on the cheapest duration / pack for the active instrument.
    if (!this._defaultsReady) {
      this._applyCheapestDefaults();
      this._defaultsReady = true;
    }

    this._syncChoiceButtons();
    this._fillDurations(instrument);

    if (this.state.format === 'sub') {
      const sub = instrument.subscriptions.find((r) => r.durationMinutes === this.state.duration)
        || instrument.subscriptions[0];
      this._fillPacks(sub);
    } else {
      this.el.packSection.hidden = true;
    }

    const q = this._quote(instrument);
    this.el.mixer.dataset.theme = q.theme;
    this.el.board.dataset.theme = q.theme;
    this.el.kicker.textContent = q.kicker;
    this.el.meta.textContent = q.meta;
    this.el.note.textContent = q.note;
    this.el.note.hidden = !q.note;
    this.el.per.textContent = q.per;
    this.el.per.hidden = !q.per;
    if (this.el.foot && this.data.paymentNote) {
      this.el.foot.textContent = `${this.data.paymentNote.toLowerCase()} · перша оплата на картку, далі — карткою або готівкою`;
    }

    const next = String(q.price);
    if (this.el.value.textContent !== next) {
      this.el.board.classList.remove('is-tick');
      void this.el.board.offsetWidth;
      this.el.board.classList.add('is-tick');
      this.el.value.textContent = next;
    }

    if (flash) {
      this.el.board.classList.remove('flash');
      void this.el.board.offsetWidth;
      this.el.board.classList.add('flash');
    }
  }
}
