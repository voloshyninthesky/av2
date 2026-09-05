// Named, keyboard-accessible routes into the existing walk / focus flow.
// Choosing a destination is deliberately silent.
import { session } from '../core/session.js?v=20260905-02';
import { ui } from '../core/studio.js?v=20260905-02';
import { instrumentView } from '../view/instrument-presets.js?v=20260905-02';
import { requestInstrumentView } from '../view/instrument-view.js?v=20260905-02';
import { mascotMove } from '../mascot/state.js?v=20260905-02';

const nav = document.getElementById('stage-nav');
const buttons = [...nav.querySelectorAll('[data-stage-instrument]')];
const status = document.getElementById('stage-nav-status');
let previousState = '';
let pendingButton = null;

for (const button of buttons) {
  button.addEventListener('click', () => {
    if (!session.started || ui.modalOpen || mascotMove.fall || session.flyT >= 0) return;
    pendingButton = button;
    requestInstrumentView(button.dataset.stageInstrument);
    updateStageNav();
  });
}

export function updateStageNav() {
  const phase = instrumentView.phase;
  const hidden = !session.started || session.flyT >= 0 || ui.modalOpen
    || (phase !== 'idle' && phase !== 'approaching');
  const state = `${hidden}/${phase}/${instrumentView.kind}/${!!mascotMove.fall}`;
  if (state === previousState) return;
  previousState = state;
  nav.hidden = hidden;
  for (const button of buttons) {
    const active = phase === 'approaching' && button.dataset.stageInstrument === instrumentView.kind;
    button.classList.toggle('is-approaching', active);
    button.disabled = !!mascotMove.fall;
    if (active) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  }
  status.textContent = phase === 'approaching' ? 'Йдемо до інструмента…' : '';
  // A route button disappears on entry. Carry keyboard focus to the existing
  // exit control, and back to that route when the visitor leaves the close-up.
  if (hidden && phase === 'entering' && nav.contains(document.activeElement)) {
    document.getElementById('mobile-exit')?.focus({ preventScroll: true });
  }
  if (!hidden && phase === 'idle' && pendingButton) {
    if (document.activeElement === document.body || document.activeElement?.id === 'mobile-exit') {
      pendingButton.focus({ preventScroll: true });
    }
    pendingButton = null;
  }
}
