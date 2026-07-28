// ============================================================
// ART VIBE — HUD & overlay UI manager
// ============================================================

export class UI {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      keysHint: document.getElementById('keys-hint'),
      dragHint: document.getElementById('drag-hint'),
      tooltip: document.getElementById('tooltip'),
      chip: document.getElementById('chip'),
      chipTitle: document.getElementById('chip-title'),
      chipDesc: document.getElementById('chip-desc'),
      chipCta: document.getElementById('chip-cta'),
      chipClose: document.getElementById('chip-close'),
      chipPrev: document.getElementById('chip-prev'),
      chipNext: document.getElementById('chip-next'),
      toast: document.getElementById('toast'),
      vibe: document.getElementById('vibe'),
      vibeFill: document.getElementById('vibe-fill'),
      soundBtn: document.getElementById('sound-btn'),
      menuBtn: document.getElementById('menu-btn'),
    };
    this.modals = {
      steps: document.getElementById('modal-steps'),
      rules: document.getElementById('modal-rules'),
      pricing: document.getElementById('modal-pricing'),
      quality: document.getElementById('modal-quality'),
      mascot: document.getElementById('modal-mascot'),
    };
    this.current = null;
    this._toastTimer = null;
    this._chipTimer = null;
    this.pricing = null;
    this._pricingPromise = null;
    this._modalTrigger = null;
    this._isolatedElements = new Map();
    this._bind();
    const warmPricing = () => { this._ensurePricing(); };
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(warmPricing, { timeout: 1800 });
    } else {
      window.setTimeout(warmPricing, 400);
    }
  }

  async _ensurePricing() {
    if (!this._pricingPromise) {
      this._pricingPromise = import('./pricing.js?v=20260728-04')
        .then(({ PricingPicker }) => {
          this.pricing = new PricingPicker(this.modals.pricing);
          return this.pricing.init().then(() => this.pricing);
        })
        .catch((error) => {
          console.warn('UI: pricing module failed to initialize', error);
          this._pricingPromise = null;
          return null;
        });
    }
    return this._pricingPromise;
  }

  _bind() {
    document.querySelectorAll('[data-open]').forEach((b) =>
      b.addEventListener('click', () => this.open(b.dataset.open, null, b)));
    document.querySelectorAll('[data-goto]').forEach((b) =>
      b.addEventListener('click', () => this.open(b.dataset.goto, null, b)));
    document.querySelectorAll('[data-close]').forEach((b) =>
      b.addEventListener('click', () => this.closeAll()));

    for (const key of ['steps', 'rules', 'pricing', 'quality']) {
      this.modals[key].addEventListener('click', (e) => {
        if (e.target === this.modals[key]) this.closeAll();
      });
    }
    this.el.menuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleNav();
    });
    document.addEventListener('pointerdown', (e) => {
      if (!this.el.hud.classList.contains('nav-open')) return;
      if (e.target.closest('#hud')) return;
      this.closeNav();
    });

    this.el.chipClose.addEventListener('click', () => this.hideChip());
    let swipeStart = null;
    this.el.chip.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      swipeStart = { x: e.clientX, y: e.clientY };
    });
    this.el.chip.addEventListener('pointerup', (e) => {
      if (!swipeStart) return;
      const dx = e.clientX - swipeStart.x;
      const dy = e.clientY - swipeStart.y;
      swipeStart = null;
      if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy)) return;
      (dx < 0 ? this.el.chipNext : this.el.chipPrev).click();
    });

    // Status toasts are display-only chrome. Claim their gestures so a rapid
    // pad tap followed by a toast tap cannot become browser double-tap zoom.
    const dismissToastGesture = (event) => {
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      this.hideToast();
    };
    this.el.toast.addEventListener('pointerdown', dismissToastGesture, { passive: false });
    this.el.toast.addEventListener('touchstart', dismissToastGesture, { passive: false });
    this.el.toast.addEventListener('touchend', dismissToastGesture, { passive: false });
    this.el.toast.addEventListener('dblclick', dismissToastGesture, { passive: false });
    this.el.toast.addEventListener('gesturestart', dismissToastGesture, { passive: false });
    this.el.toast.addEventListener('gesturechange', dismissToastGesture, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && this.current) this._trapModalFocus(e);
      if (e.key === 'Escape') { this.closeAll(); this.closeNav(); }
    });
  }

  _focusableElements(modal) {
    if (!modal) return [];
    return [...modal.querySelectorAll(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((element) => !element.hidden && element.getClientRects().length > 0);
  }

  _trapModalFocus(event) {
    const modal = this.modals[this.current];
    const focusable = this._focusableElements(modal);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  _isolateModal(modal) {
    this._releaseModalIsolation();
    for (const element of document.body.children) {
      if (element === modal || element.tagName === 'SCRIPT') continue;
      this._isolatedElements.set(element, {
        inert: Boolean(element.inert),
        ariaHidden: element.getAttribute('aria-hidden'),
      });
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    }
  }

  _releaseModalIsolation() {
    for (const [element, previous] of this._isolatedElements) {
      element.inert = previous.inert;
      if (previous.ariaHidden === null) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', previous.ariaHidden);
    }
    this._isolatedElements.clear();
  }

  _focusModal(name) {
    if (this.current !== name) return;
    const modal = this.modals[name];
    const preferred = name === 'mascot'
      ? modal?.querySelector('[data-mascot-tab][aria-selected="true"]')
      : null;
    (preferred || this._focusableElements(modal)[0])?.focus();
  }

  open(name, anchor, trigger = null) {
    if (this.current) this.closeAll({ restoreFocus: false });
    this.closeNav();
    const m = this.modals[name];
    if (!m) return;
    this._modalTrigger = trigger
      || (name === 'mascot' ? document.getElementById('mascot-btn') : document.activeElement);
    m.hidden = false;
    this.current = name;
    this._focusModal(name);
    this._isolateModal(m);
    window.dispatchEvent(new CustomEvent('av2:modal', { detail: { open: true, name } }));
    requestAnimationFrame(() => this._focusModal(name));
    if (name === 'pricing') {
      const requestedInstrument = anchor || this.pricing?.state.instrument || 'vocal';
      this._ensurePricing().then((pricing) => {
        if (!pricing) return;
        pricing.selectInstrument(requestedInstrument);
        if (this.current !== 'pricing') return;
        requestAnimationFrame(() => {
          this.modals.pricing.querySelector('#price-board')?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        });
      });
      return;
    }
    if (anchor) {
      const target = m.querySelector(`#card-${anchor}`) || m.querySelector(`[data-instruments~="${anchor}"]`);
      if (target) {
        requestAnimationFrame(() => {
          target.scrollIntoView({ block: 'start', behavior: 'instant' });
          target.classList.remove('flash');
          void target.offsetWidth;
          target.classList.add('flash');
        });
      }
    }
  }

  closeAll({ restoreFocus = true } = {}) {
    const closed = this.current;
    for (const key in this.modals) this.modals[key].hidden = true;
    this.current = null;
    window.dispatchEvent(new CustomEvent('av2:modal', { detail: { open: false, name: closed } }));
    this._releaseModalIsolation();
    const trigger = this._modalTrigger;
    this._modalTrigger = null;
    if (restoreFocus && trigger?.isConnected) requestAnimationFrame(() => trigger.focus());
  }

  get modalOpen() { return this.current !== null; }

  toggleNav() {
    const open = !this.el.hud.classList.contains('nav-open');
    this.el.hud.classList.toggle('nav-open', open);
    if (this.el.menuBtn) this.el.menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  closeNav() {
    this.el.hud.classList.remove('nav-open');
    if (this.el.menuBtn) this.el.menuBtn.setAttribute('aria-expanded', 'false');
  }

  showHUD() {
    this.el.hud.classList.remove('hidden');
    // Phones / tablets use on-screen controls — keyboard & drag legends stay off.
    const touchUi = window.innerWidth <= 720
      || window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (touchUi) {
      this.el.keysHint.classList.add('hidden');
      this.el.dragHint.classList.add('hidden');
      return;
    }
    this.el.keysHint.classList.remove('hidden');
    this.el.dragHint.classList.remove('hidden');
    setTimeout(() => this.el.dragHint.classList.add('hidden'), 9000);
  }

  // ---- tooltip ----
  setTooltip(html, x, y) {
    const t = this.el.tooltip;
    if (!html) { t.hidden = true; return; }
    if (t.innerHTML !== html) t.innerHTML = html;
    t.hidden = false;
    t.style.left = `${x}px`;
    t.style.top = `${y}px`;
  }

  // ---- chip ----
  showChip(titleHtml, desc, ctaText, onCta, navigation = null) {
    this.el.chipTitle.innerHTML = titleHtml;
    this.el.chipDesc.textContent = desc;
    this.el.chipDesc.hidden = !desc;
    this.el.chipCta.textContent = ctaText;
    this.el.chipCta.onclick = () => { this.hideChip(); onCta && onCta(); };
    this.el.chipPrev.hidden = !navigation;
    this.el.chipNext.hidden = !navigation;
    this.el.chipPrev.onclick = () => navigation?.onPrev?.();
    this.el.chipNext.onclick = () => navigation?.onNext?.();
    this.el.chip.hidden = false;
    clearTimeout(this._chipTimer);
    this._chipTimer = setTimeout(() => this.hideChip(), 8000);
  }
  hideChip() { this.el.chip.hidden = true; clearTimeout(this._chipTimer); }

  // ---- toast ----
  toast(html, dur = 3200, kind = '') {
    const t = this.el.toast;
    t.innerHTML = html;
    t.dataset.kind = kind;
    t.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.hideToast(), dur);
  }

  hideToast() {
    this.el.toast.hidden = true;
    delete this.el.toast.dataset.kind;
    clearTimeout(this._toastTimer);
  }

  // ---- vibe ----
  setVibe(v) {
    this.el.vibeFill.style.width = `${Math.max(0, Math.min(100, v))}%`;
    this.el.vibe.classList.toggle('max', v >= 100);
  }
}
