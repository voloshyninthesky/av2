// ============================================================
// ART VIBE — HUD & overlay UI manager
// ============================================================

import { PricingPicker } from './pricing.js?v=20260725-02';

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
    };
    this.current = null;
    this._toastTimer = null;
    this._chipTimer = null;
    this.pricing = new PricingPicker(this.modals.pricing);
    this.pricing.init();
    this._bind();
  }

  _bind() {
    document.querySelectorAll('[data-open]').forEach((b) =>
      b.addEventListener('click', () => this.open(b.dataset.open)));
    document.querySelectorAll('[data-goto]').forEach((b) =>
      b.addEventListener('click', () => this.open(b.dataset.goto)));
    document.querySelectorAll('[data-close]').forEach((b) =>
      b.addEventListener('click', () => this.closeAll()));

    for (const key of ['steps', 'rules', 'pricing']) {
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
      if (e.key === 'Escape') { this.closeAll(); this.closeNav(); }
    });
  }

  open(name, anchor) {
    this.closeAll();
    this.closeNav();
    const m = this.modals[name];
    if (!m) return;
    m.hidden = false;
    this.current = name;
    window.dispatchEvent(new CustomEvent('av2:modal', { detail: { open: true } }));
    if (name === 'pricing') {
      this.pricing.selectInstrument(anchor || this.pricing.state.instrument);
      requestAnimationFrame(() => {
        this.modals.pricing.querySelector('#price-board')?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
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

  closeAll() {
    for (const key in this.modals) this.modals[key].hidden = true;
    this.current = null;
    window.dispatchEvent(new CustomEvent('av2:modal', { detail: { open: false } }));
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

  setSoundMuted(m) { this.el.soundBtn.classList.toggle('off', m); }
}
