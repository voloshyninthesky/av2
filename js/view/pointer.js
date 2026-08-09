// ============================================================
// STAGE POINTER ROUTER
// One canvas, many meanings: a tap can walk the mascot, open a close-up, play
// a drum, hold a piano key, or strum across guitar strings. Each finger is
// tracked separately so a held chord and a strum can coexist, and any pointer
// resting on a play surface is withheld from OrbitControls so playing never
// rotates the stage.
// ============================================================
import * as THREE from 'three';
import { session } from '../core/session.js?v=20260809-10';
import { isMobileGameMode } from '../core/quality.js?v=20260809-10';
import { isQuickGuitarTap } from '../guitar-gestures.js?v=20260809-10';
import { canvas, camera, controls } from './rig.js?v=20260809-10';
import { ui, drums, piano, guitar, mic, instruments, interactables } from '../core/studio.js?v=20260809-10';
import { instrumentView } from './instrument-presets.js?v=20260809-10';
import { raycaster, pointer } from './pick.js?v=20260809-10';
import { glowMesh, unglowMesh } from './emissive.js?v=20260809-10';
import { walkMascotToInstrument } from './mobile-controls.js?v=20260809-10';
import { resetBrowserPageZoom } from './viewport.js?v=20260809-10';
import { activePointers } from '../play/state.js?v=20260809-10';
import {
  currentGuitarShape,
  fireGuitarStrum,
  pluckGuitarString,
  playTokenForMesh,
  guitarLocalPoint,
  nearestGuitarString,
  guitarFretHit,
} from '../play/guitar.js?v=20260809-10';
import {
  trigger,
  beginHeldPianoNote,
  releaseHeldPianoNote,
  handleClick,
} from '../play/piano-notes.js?v=20260809-10';

export const INSTRUMENT_STYLE = {
  drums: { glow: 0x9E33CA },
  piano: { glow: 0xD1A13B },
  guitar: { glow: 0xD1A13B },
  mic: { glow: 0x9E33CA },
};

export function setGlow(mesh, on) {
  const inst = mesh.userData.instrument;
  const apply = (m) => {
    if (on) glowMesh(m, INSTRUMENT_STYLE[inst].glow, inst === 'piano' ? 0.5 : 0.3);
    else unglowMesh(m);
  };
  if (inst === 'piano') {
    if (mesh.userData.freq !== undefined) apply(mesh);
    else piano.group.traverse((o) => { if (o.isMesh && o.userData.freq === undefined) apply(o); });
  } else {
    const root = instruments.find((i) => i.group === mesh.userData.root || i.label.toLowerCase().includes(inst)) ||
      { group: mesh };
    const group = { drums: drums.group, guitar: guitar.group, mic: mic.group }[inst] || mesh;
    group.traverse((o) => { if (o.isMesh) apply(o); });
    void root;
  }
}

export function onPointerMove(e) {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

export function pointerNdc(clientX, clientY, target = pointer) {
  target.x = (clientX / window.innerWidth) * 2 - 1;
  target.y = -(clientY / window.innerHeight) * 2 + 1;
  return target;
}

export function hitInteractableDetailsAt(clientX, clientY, guitarZone = null) {
  pointerNdc(clientX, clientY);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(interactables, false);
  for (const hit of hits) {
    const zone = hit.object.userData.guitarZone;
    if (hit.object.userData.instrument !== 'guitar') {
      if (guitarZone) continue;
      return hit;
    }
    if (guitarZone && zone !== guitarZone) continue;
    if (isGuitarPlayFocus()) {
      if (zone === 'strum' || zone === 'fretboard') return hit;
      continue;
    }
    if (zone === 'approach') return hit;
  }
  return null;
}

export function hitInteractableAt(clientX, clientY) {
  return hitInteractableDetailsAt(clientX, clientY)?.object || null;
}

/** True from the moment the camera commits to a close-up until it lets go. */
export function isInstrumentCloseUp() {
  return instrumentView.phase === 'entering'
    || instrumentView.phase === 'focused'
    || instrumentView.phase === 'returning';
}

export function isMultiTouchInstrumentFocus() {
  return instrumentView.phase === 'focused'
    && (instrumentView.kind === 'piano' || instrumentView.kind === 'drums');
}

export function isGuitarPlayFocus() {
  return instrumentView.phase === 'focused' && instrumentView.kind === 'guitar';
}

export function canPlayInstrument(kind) {
  return instrumentView.phase === 'focused' && instrumentView.kind === kind;
}

/** Desktop keyboard jam: sound without focus. Mobile keeps focus-gated pads only. */
export function canKeyboardJamPlay() {
  return session.started && !ui.modalOpen && !isMobileGameMode();
}

// Six-string voicings, low E → high E. null is a muted string.
/** Play-surface pointers must not drive OrbitControls rotate / zoom. */
function blocksOrbitPointer(info) {
  return info?.mode === 'play'
    || info?.mode === 'guitar-strum'
    || info?.mode === 'guitar-fret'
    || info?.mode === 'guitar-approach';
}

/**
 * Sounding surfaces only. The piano cabinet / lid / bench carry instrument:
 * 'piano' so a distant tap can walk over, but while focused they are scenery —
 * claiming them would swallow the pinch that should zoom the view.
 */
function isPlaySurfaceMesh(mesh) {
  const data = mesh?.userData;
  if (!data) return false;
  if (data.instrument === 'piano') return Number.isFinite(data.freq);
  return true;
}

/**
 * Pinch-zoom stays live except while a finger rests on a key / string / drum:
 * OrbitControls counts every canvas pointer, so a two-finger play gesture would
 * otherwise dolly the camera.
 */
export function syncOrbitZoom() {
  let playing = false;
  for (const info of activePointers.values()) {
    if (blocksOrbitPointer(info)) { playing = true; break; }
  }
  controls.enableZoom = !playing;
}

export function handleCanvasPointerDown(e) {
  if (!session.started || ui.modalOpen || session.flyT >= 0) return;

  if (isMultiTouchInstrumentFocus()) {
    const mesh = hitInteractableAt(e.clientX, e.clientY);
    if (mesh && mesh.userData.instrument === instrumentView.kind && isPlaySurfaceMesh(mesh)) {
      // Claim the pointer so OrbitControls cannot rotate / zoom from keys / drums.
      e.preventDefault();
      e.stopImmediatePropagation();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      const pointerInfo = {
        mode: 'play',
        x: e.clientX,
        y: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        t: performance.now(),
        token: playTokenForMesh(mesh),
        pointerType: e.pointerType,
        pianoHold: null,
      };
      activePointers.set(e.pointerId, pointerInfo);
      if (instrumentView.kind === 'piano') pointerInfo.pianoHold = beginHeldPianoNote(mesh);
      else trigger(mesh);
      return;
    }
  }

  {
    const hit = hitInteractableDetailsAt(e.clientX, e.clientY);
    const mesh = hit?.object;
    if (mesh?.userData.instrument === 'guitar') {
      e.preventDefault();
      e.stopImmediatePropagation();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }

      if (!isGuitarPlayFocus()) {
        activePointers.set(e.pointerId, {
          mode: 'guitar-approach',
          x: e.clientX,
          y: e.clientY,
          t: performance.now(),
          approached: false,
        });
        return;
      }

      if (mesh.userData.guitarZone === 'fretboard') {
        const fretHit = guitarFretHit(hit);
        activePointers.set(e.pointerId, {
          mode: 'guitar-fret',
          token: fretHit.token,
        });
        pluckGuitarString(fretHit.stringIndex, fretHit.fret, 0.72);
        return;
      }

      const local = guitarLocalPoint(hit);
      activePointers.set(e.pointerId, {
        mode: 'guitar-strum',
        x: e.clientX,
        y: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        t: performance.now(),
        lastAt: performance.now(),
        lastLocalX: local.x,
        stringXs: [...mesh.userData.stringXs],
        seenStrings: new Set(),
        strummed: false,
        dir: 0,
        strokeFeedbackPending: true,
        strokeCompletionReported: false,
        pointerType: e.pointerType,
        hitMesh: mesh,
      });
      return;
    }
  }

  activePointers.set(e.pointerId, {
    mode: 'tap',
    x: e.clientX,
    y: e.clientY,
    currentX: e.clientX,
    currentY: e.clientY,
    t: performance.now(),
    pointerType: e.pointerType,
  });
}

canvas.addEventListener('pointerdown', (e) => {
  handleCanvasPointerDown(e);
  syncOrbitZoom();
}, { capture: true, passive: false });

canvas.addEventListener('pointermove', (e) => {
  const info = activePointers.get(e.pointerId);
  if (!info) return;
  info.currentX = e.clientX;
  info.currentY = e.clientY;

  if (blocksOrbitPointer(info)) {
    e.stopImmediatePropagation();
  }

  if (info.mode === 'guitar-approach') {
    if (info.approached) return;
    if (Math.hypot(e.clientX - info.x, e.clientY - info.y) >= 18) {
      info.approached = true;
      walkMascotToInstrument('guitar');
    }
    return;
  }

  if (info.mode === 'guitar-fret') {
    if (!isGuitarPlayFocus()) return;
    const hit = hitInteractableDetailsAt(e.clientX, e.clientY, 'fretboard');
    if (!hit) return;
    const fretHit = guitarFretHit(hit);
    if (fretHit.token === info.token) return;
    info.token = fretHit.token;
    pluckGuitarString(fretHit.stringIndex, fretHit.fret, 0.64, false);
    return;
  }

  if (info.mode === 'play') {
    if (!isMultiTouchInstrumentFocus()) return;
    const mesh = hitInteractableAt(e.clientX, e.clientY);
    if (!mesh || mesh.userData.instrument !== instrumentView.kind) return;
    const token = playTokenForMesh(mesh);
    if (token === info.token) return;
    info.token = token;
    if (instrumentView.kind === 'piano') {
      releaseHeldPianoNote(info.pianoHold);
      info.pianoHold = beginHeldPianoNote(mesh);
    } else {
      trigger(mesh);
    }
    return;
  }

  if (info.mode === 'guitar-strum') {
    if (!isGuitarPlayFocus()) return;
    const samples = e.getCoalescedEvents?.() || [e];
    for (const sample of samples.length ? samples : [e]) {
      const now = sample.timeStamp || performance.now();
      const hit = hitInteractableDetailsAt(sample.clientX, sample.clientY, 'strum');
      if (!hit) {
        info.lastLocalX = null;
        info.lastX = sample.clientX;
        info.lastY = sample.clientY;
        info.lastAt = now;
        continue;
      }
      const localX = guitarLocalPoint(hit).x;
      if (info.lastLocalX === null) {
        info.lastLocalX = localX;
        info.lastX = sample.clientX;
        info.lastY = sample.clientY;
        info.lastAt = now;
        continue;
      }
      const localDelta = localX - info.lastLocalX;
      const dtMs = Math.max(1, now - info.lastAt);
      const screenDistance = Math.hypot(sample.clientX - info.lastX, sample.clientY - info.lastY);
      const sign = Math.sign(localDelta);
      if (!sign || Math.abs(localDelta) < 0.0015) {
        info.lastLocalX = localX;
        info.lastX = sample.clientX;
        info.lastY = sample.clientY;
        info.lastAt = now;
        continue;
      }
      if (info.dir && sign !== info.dir) {
        if (Math.abs(localDelta) < 0.004) continue;
        info.dir = sign;
        info.seenStrings.clear();
        info.strokeFeedbackPending = true;
        info.strokeCompletionReported = false;
      } else if (!info.dir) {
        info.dir = sign;
      }

      const crossed = info.stringXs.filter((stringX, stringIndex) => {
        if (info.seenStrings.has(stringIndex)) return false;
        return sign > 0
          ? stringX > info.lastLocalX && stringX <= localX
          : stringX < info.lastLocalX && stringX >= localX;
      }).map((stringX) => ({
        stringX,
        stringIndex: info.stringXs.indexOf(stringX),
      }));
      crossed.sort((a, b) => sign > 0 ? a.stringX - b.stringX : b.stringX - a.stringX);

      if (crossed.length) {
        const firstFraction = Math.abs((crossed[0].stringX - info.lastLocalX) / localDelta);
        const offsets = new Map();
        for (const crossing of crossed) {
          const fraction = Math.abs((crossing.stringX - info.lastLocalX) / localDelta);
          offsets.set(crossing.stringIndex, Math.max(0, (fraction - firstFraction) * Math.min(dtMs, 42)));
          info.seenStrings.add(crossing.stringIndex);
        }
        const speed = screenDistance / dtMs;
        const velocity = THREE.MathUtils.clamp(0.18 + speed * 0.74, 0.18, 1);
        const direction = sign > 0 ? 'bass-to-treble' : 'treble-to-bass';
        const gaveFeedback = info.strokeFeedbackPending;
        if (fireGuitarStrum(
          velocity,
          direction,
          crossed.map((crossing) => crossing.stringIndex),
          offsets,
          gaveFeedback,
        )) {
          info.strummed = true;
          if (gaveFeedback) {
            info.strokeFeedbackPending = false;
          }
          if (!info.strokeCompletionReported && info.seenStrings.size >= 3) {
            info.strokeCompletionReported = true;
            navigator.vibrate?.(Math.round(4 + velocity * 7));
          }
        }
      }
      info.lastLocalX = localX;
      info.lastX = sample.clientX;
      info.lastY = sample.clientY;
      info.lastAt = now;
    }
  }
}, { capture: true, passive: true });

export function endActivePointer(e) {
  const info = activePointers.get(e.pointerId);
  releaseHeldPianoNote(info?.pianoHold);
  activePointers.delete(e.pointerId);
  if (!info) return;

  if (info.mode === 'guitar-approach') {
    if (!info.approached) walkMascotToInstrument('guitar');
    return;
  }

  if (info.mode === 'guitar-strum') {
    if (info.strummed || !isGuitarPlayFocus()) return;
    if (!isQuickGuitarTap({
      elapsedMs: performance.now() - info.t,
      distancePx: Math.hypot(e.clientX - info.x, e.clientY - info.y),
    })) return;
    const hit = hitInteractableDetailsAt(e.clientX, e.clientY, 'strum');
    if (!hit) return;
    const localX = guitarLocalPoint(hit).x;
    const stringIndex = nearestGuitarString(info.stringXs, localX);
    pluckGuitarString(stringIndex, currentGuitarShape()[stringIndex], 0.62);
    return;
  }

  if (info.mode !== 'tap') return;
  const dx = e.clientX - info.x;
  const dy = e.clientY - info.y;
  const dt = performance.now() - info.t;
  const tapTolerance = isMobileGameMode() ? 28 : 8;
  if (Math.hypot(dx, dy) < tapTolerance && dt < 600) handleClick(e);
}

canvas.addEventListener('pointerup', (e) => {
  endActivePointer(e);
  syncOrbitZoom();
}, { capture: true });
canvas.addEventListener('pointercancel', (e) => {
  const info = activePointers.get(e.pointerId);
  releaseHeldPianoNote(info?.pianoHold, { cancel: true });
  activePointers.delete(e.pointerId);
  syncOrbitZoom();
}, { capture: true });
window.addEventListener('pointermove', onPointerMove, { passive: true });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Block accidental text selection / iOS callouts on game chrome (not modal panels).
document.addEventListener('selectstart', (e) => {
  if (e.target.closest?.('.panel, input, textarea, [contenteditable="true"]')) return;
  e.preventDefault();
}, { capture: true });
document.addEventListener('dragstart', (e) => {
  if (e.target.closest?.('.panel, input, textarea, [contenteditable="true"]')) return;
  e.preventDefault();
}, { capture: true });

// Block stage double-tap zoom. Play chrome (pads / toast / pedal) must ALSO
// claim double-taps — skipping them was letting vocal-pad ↔ vibe-toast taps zoom.
{
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    if (e.target.closest?.('.panel, input, textarea, [contenteditable="true"]')) return;
    const now = performance.now();
    if (now - lastTouchEnd < 320 && e.cancelable) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false, capture: true });
  document.addEventListener('touchend', () => {
    requestAnimationFrame(resetBrowserPageZoom);
  }, { passive: true, capture: true });
}

