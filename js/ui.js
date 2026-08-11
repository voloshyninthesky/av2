// ============================================================
// ART VIBE — HUD & overlay UI manager
// ============================================================
import { swallowNextClick } from './core/gesture-guards.js?v=20260812-04';

// The stylesheet's phone breakpoint, verbatim. The chip's position is CSS on
// phones and measured here on desktop, so the two have to agree on which is
// which — a mismatch leaves an inline offset overriding the phone rule.
const PHONE_LAYOUT = window.matchMedia(
  '(max-width: 720px), (hover: none) and (pointer: coarse) and (max-height: 900px)',
);

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
      pricingBtn: document.getElementById('pricing-btn'),
      toast: document.getElementById('toast'),
      vibe: document.getElementById('vibe'),
      vibeFill: document.getElementById('vibe-fill'),
      soundBtn: document.getElementById('sound-btn'),
    };
    this.modals = {
      steps: document.getElementById('modal-steps'),
      rules: document.getElementById('modal-rules'),
      pricing: document.getElementById('modal-pricing'),
      mascot: document.getElementById('modal-mascot'),
      sign: document.getElementById('modal-sign'),
    };
    this.current = null;
    this._toastTimer = null;
    this._chipTimer = null;
    this._chipAction = null;
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
      this._pricingPromise = import('./pricing.js?v=20260812-04')
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

    for (const key of ['steps', 'rules', 'pricing', 'sign']) {
      this.modals[key]?.addEventListener('click', (e) => {
        if (e.target === this.modals[key]) this.closeAll();
      });
    }

    this.el.chipClose.addEventListener('click', () => this.hideChip());
    let swipeStart = null;
    this.el.chip.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      swipeStart = { x: e.clientX, y: e.clientY };
    });
    this.el.chip.addEventListener('pointerup', (e) => {
      if (!swipeStart) return;
      if (e.target.closest('button')) {
        swipeStart = null;
        return;
      }
      const dx = e.clientX - swipeStart.x;
      const dy = e.clientY - swipeStart.y;
      swipeStart = null;
      if (Math.hypot(dx, dy) < 18) {
        this._activateChip();
        return;
      }
      if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy)) return;
      (dx < 0 ? this.el.chipNext : this.el.chipPrev).click();
    });
    this.el.chip.addEventListener('pointercancel', () => { swipeStart = null; });
    // A rotate or a resized window moves the button the chip hangs from.
    window.addEventListener('resize', () => {
      if (!this.el.chip.hidden) this._anchorChip();
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
      if (e.key === 'Escape') this.closeAll();
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

  showHUD() {
    this.el.hud.inert = false;
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
    clearTimeout(this._chipLeaveTimer);
    this.el.chip.classList.remove('leaving');
    this.el.chipTitle.innerHTML = titleHtml;
    this.el.chipDesc.textContent = desc;
    this.el.chipDesc.hidden = !desc;
    this.el.chipCta.textContent = ctaText;
    this._chipAction = onCta || null;
    this.el.chip.dataset.actionable = this._chipAction ? 'true' : 'false';
    this.el.chipCta.onclick = () => this._activateChip();
    this.el.chipPrev.hidden = !navigation;
    this.el.chipNext.hidden = !navigation;
    this.el.chipPrev.onclick = () => navigation?.onPrev?.();
    this.el.chipNext.onclick = () => navigation?.onNext?.();
    this.el.chip.hidden = false;
    this._anchorChip();
    clearTimeout(this._chipTimer);
    this._chipTimer = setTimeout(() => this.hideChip(), 8000);
  }

  /**
   * On desktop, hang the chip under the lessons-and-prices button with their
   * right edges aligned, so it points at the control it opens. Measured on
   * every show rather than fixed in CSS, because the nav gains a button when
   * the sign form unlocks. If the HUD is away — hidden during the intro, or the
   * button missing entirely — the CSS fallback stands.
   *
   * Phones keep the chip at the bottom of the screen, where the stylesheet puts
   * it: up there it would sit under a cramped strip and far from the thumb.
   */
  _anchorChip() {
    const chip = this.el.chip;
    if (PHONE_LAYOUT.matches) {
      // An inline offset written on a wider viewport would outrank the phone rule.
      chip.style.top = '';
      chip.style.right = '';
      return;
    }
    const rect = this.el.pricingBtn?.getBoundingClientRect();
    if (!rect?.width || rect.bottom <= 0) return;
    chip.style.top = `${Math.round(rect.bottom + 10)}px`;
    chip.style.right = `${Math.round(Math.max(8, window.innerWidth - rect.right))}px`;
  }
  /** Rewrite the CTA of a chip that is already up (prices arriving late). */
  setChipCta(text) {
    if (this.el.chip.hidden || this.el.chip.classList.contains('leaving')) return;
    this.el.chipCta.textContent = text;
  }
  _activateChip() {
    const action = this._chipAction;
    if (!action) return;
    this.hideChip();
    this._swallowGhostClick();
    action();
  }

  // Touch browsers fire a synthesized click ~300ms after pointerup, and the chip
  // activates on pointerup. Without this the stray click lands on whatever the
  // freshly opened modal put under the finger — the price board's «Записатись»
  // sits right where the chip CTA was, so the chip opened «як записатися».
  // Exactly one click, then out of the way: holding the guard for a flat 400 ms
  // also ate the visitor's next deliberate tap.
  _swallowGhostClick() {
    this._releaseGhostGuard?.();
    this._releaseGhostGuard = swallowNextClick({ within: 400 });
  }

  hideChip() {
    clearTimeout(this._chipTimer);
    const chip = this.el.chip;
    if (chip.hidden || chip.classList.contains('leaving')) return;
    // Soft fade-out instead of an abrupt vanish; `hidden` lands after it ends.
    chip.classList.add('leaving');
    clearTimeout(this._chipLeaveTimer);
    this._chipLeaveTimer = setTimeout(() => {
      chip.hidden = true;
      chip.classList.remove('leaving');
    }, 240);
  }

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
