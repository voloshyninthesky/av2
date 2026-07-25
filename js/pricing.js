// ============================================================
// ART VIBE — interactive pricing mixer (driven by prices.json)
// ============================================================

const INSTRUMENT_LABELS = {
  vocal: 'Вокал',
  guitar: 'Гітара',
  drums: 'Барабани',
  piano: 'Фортепіано',
};

const ANCHOR_MAP = {
  mic: 'vocal',
  vocal: 'vocal',
  guitar: 'guitar',
  drums: 'drums',
  piano: 'piano',
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
    this.state = {
      instrument: 'vocal',
      format: 'single',
      duration: 45,
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

  async init() {
    try {
      const res = await fetch('prices.json?v=20260725-02');
      if (!res.ok) throw new Error(`prices.json ${res.status}`);
      this.data = await res.json();
    } catch (err) {
      console.warn('PricingPicker: failed to load prices.json', err);
      return;
    }
    this._bind();
    this._renderPromos();
    this.ready = true;
    this.render();
  }

  selectInstrument(anchor) {
    const key = ANCHOR_MAP[anchor] || 'vocal';
    this.state.instrument = key;
    if (this.ready) {
      this.render({ flash: true });
    }
  }

  _bind() {
    this.el.instruments.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.instrument = btn.dataset.instrument;
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

  _category() {
    return this.data.categories.find((c) => c.instruments.includes(this.state.instrument));
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

  _fillDurations(category) {
    const source = this.state.format === 'single'
      ? category.singleLessons
      : category.subscriptions;
    const durations = source.map((row) => row.durationMinutes);
    if (!durations.includes(this.state.duration)) {
      this.state.duration = durations[Math.min(1, durations.length - 1)] ?? durations[0];
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

  _quote(category) {
    const cur = this.data.currency.display;
    const inst = INSTRUMENT_LABELS[this.state.instrument];
    const theme = category.instruments.includes('drums') || category.instruments.includes('piano')
      ? 'rhythm'
      : 'vocal';

    if (this.state.format === 'single') {
      const row = category.singleLessons.find((r) => r.durationMinutes === this.state.duration)
        || category.singleLessons[0];
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

    const sub = category.subscriptions.find((r) => r.durationMinutes === this.state.duration)
      || category.subscriptions[0];
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
    const category = this._category();
    if (!category) return;

    this._syncChoiceButtons();
    this._fillDurations(category);

    if (this.state.format === 'sub') {
      const sub = category.subscriptions.find((r) => r.durationMinutes === this.state.duration)
        || category.subscriptions[0];
      this._fillPacks(sub);
    } else {
      this.el.packSection.hidden = true;
    }

    const q = this._quote(category);
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
