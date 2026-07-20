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
      toast: document.getElementById('toast'),
      vibe: document.getElementById('vibe'),
      vibeFill: document.getElementById('vibe-fill'),
      soundBtn: document.getElementById('sound-btn'),
      helpBtn: document.getElementById('help-btn'),
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

    this.el.chipClose.addEventListener('click', () => this.hideChip());

    const directToast = () => this.toast('Шукай <span class="hl">Art Vibe Studio</span> в Instagram і пиши у директ — відповімо на всі питання', 5200);
    document.getElementById('direct-btn-1').addEventListener('click', directToast);
    document.getElementById('direct-btn-2').addEventListener('click', directToast);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.closeAll(); this.el.help.hidden = true; }
    });
  }

  open(name, anchor) {
    this.closeAll();
    const m = this.modals[name];
    if (!m) return;
    m.hidden = false;
    this.current = name;
    if (anchor) {
      const target = m.querySelector(`#card-${anchor}`);
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
  showChip(titleHtml, desc, ctaText, onCta) {
    this.el.chipTitle.innerHTML = titleHtml;
    this.el.chipDesc.textContent = desc;
    this.el.chipCta.textContent = ctaText;
    this.el.chipCta.onclick = () => { this.hideChip(); onCta && onCta(); };
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
