// ============================================================
// THE STAGE KEY
// One key for the whole stage: the chord wheel sets it, and the voice ribbon
// sings in it. Before this existed the key was private to chord-wheel.js,
// which was fine while it was the only surface that had one — the moment a
// second surface needed a tonic, two of them could disagree, and a vocal line
// over your own chord loop would be out of tune with nothing on screen saying
// why.
//
// The two surfaces are never visible at the same time (each instrument's
// close-up docks exactly one), so each carries its own readout of the same
// value rather than sharing a control.
//
// Storage keeps chord-wheel.js's original key name: a visitor who has already
// chosen a key keeps it, and the sevenths toggle still travels with the key it
// applies to.
// ============================================================
import { keyLabel, stepKey } from './harmony.js?v=20260813-11';

const STORAGE_KEY = 'av2.chord-key.v1';

export const stageKey = {
  tonicPc: 0,
  mode: 'major',
  sevenths: false,
};

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (Number.isInteger(saved?.tonic) && saved.tonic >= 0 && saved.tonic < 12) stageKey.tonicPc = saved.tonic;
  if (saved?.mode === 'major' || saved?.mode === 'minor') stageKey.mode = saved.mode;
  if (typeof saved?.sevenths === 'boolean') stageKey.sevenths = saved.sevenths;
} catch { /* storage is optional */ }

function store() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tonic: stageKey.tonicPc, mode: stageKey.mode, sevenths: stageKey.sevenths,
    }));
  } catch { /* storage is optional */ }
}

// Each surface registers what it needs done when the key moves — repaint, and
// drop anything armed or sounding in the old key. A listener list rather than
// direct calls, because key.js sits *below* both surfaces and must not import
// either of them.
const listeners = new Set();
export function onStageKeyChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function announce() {
  store();
  for (const listener of listeners) listener(stageKey);
}

export function setStageKey(nextTonicPc) {
  if (nextTonicPc === stageKey.tonicPc) return;
  stageKey.tonicPc = nextTonicPc;
  announce();
}

export function setStageMode(next) {
  if (next === stageKey.mode || (next !== 'major' && next !== 'minor')) return;
  // Home moves to the *relative* key, not to the same letter — that is what a
  // musician means by "the relative minor", and it keeps the same six wedges
  // lit and the same seven notes under the voice.
  stageKey.tonicPc = next === 'minor' ? (stageKey.tonicPc + 9) % 12 : (stageKey.tonicPc + 3) % 12;
  stageKey.mode = next;
  announce();
}

export function setStageSevenths(on) {
  if (on === stageKey.sevenths) return;
  stageKey.sevenths = on;
  announce();
}

export const stepStageKey = (direction) => setStageKey(stepKey(stageKey.tonicPc, direction));
export const toggleStageMode = () => setStageMode(stageKey.mode === 'major' ? 'minor' : 'major');
export const stageKeyLabel = () => keyLabel(stageKey.tonicPc, stageKey.mode);
