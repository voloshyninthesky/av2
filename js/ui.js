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
      helpBtn: document.getElementById('help-btn'),
      menuBtn: document.getElementById('menu-btn'),
      help: document.getElementById('help'),
    };
    this.modals = {
      steps: document.getElementById('modal-steps'),
      rules: document.getElementById('modal-rules'),
      pricing: document.getElementById('modal-pricing'),
    };
    this.current = null;
    this._toastTimer = null;
    this._chipTimer = null;
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
    this.el.help.addEventListener('click', (e) => {
      if (e.target === this.el.help) this.el.help.hidden = true;
    });
    this.el.helpBtn.addEventListener('click', () => { this.el.help.hidden = !this.el.help.hidden; });
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

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.closeAll(); this.el.help.hidden = true; this.closeNav(); }
    });
  }

  open(name, anchor) {
    this.closeAll();
    this.closeNav();
    const m = this.modals[name];
    if (!m) return;
    m.hidden = false;
    this.current = name;
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
  }

  get modalOpen() { return this.current !== null || !this.el.help.hidden; }

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
  toast(html, dur = 3200) {
    const t = this.el.toast;
    t.innerHTML = html;
    t.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { t.hidden = true; }, dur);
  }

  // ---- vibe ----
  setVibe(v) {
    this.el.vibeFill.style.width = `${Math.max(0, Math.min(100, v))}%`;
    this.el.vibe.classList.toggle('max', v >= 100);
  }

  setSoundMuted(m) { this.el.soundBtn.classList.toggle('off', m); }
}
