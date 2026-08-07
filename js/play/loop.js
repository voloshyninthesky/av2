// ============================================================
// MULTI-INSTRUMENT LOOP PEDAL
// A single free-running bar that every instrument can overdub into. The first
// pass sets the loop length; later passes are quantised against the same epoch
// and scheduled a beat ahead on the audio clock, so playback stays in time
// even while the main thread is busy rendering.
// `playMusicalEvent` is the one road every note takes — pointer, pad, keyboard
// and loop playback alike — which is what makes recording transparent.
// ============================================================
import { session } from '../core/session.js?v=20260807-04';
import { ui, audio, drums, piano, guitar, mic } from '../core/studio.js?v=20260807-04';
import { mascotMove } from '../mascot/state.js?v=20260807-04';
import { play, heldPianoNotes } from './state.js?v=20260807-04';
import { addVibe, queuePriceChip } from './vibe.js?v=20260807-04';

const loopPedal = document.getElementById('loop-pedal');
const loopToggle = document.getElementById('loop-toggle');
const loopLabel = document.getElementById('loop-label');
const loopMeta = document.getElementById('loop-meta');
const loopProgressBar = document.getElementById('loop-progress-bar');
const loopTools = document.getElementById('loop-tools');
const loopPause = document.getElementById('loop-pause');
const loopClear = document.getElementById('loop-clear');
const loopStatus = document.getElementById('loop-status');

// Recording a note means closing whatever hold that note belongs to, and the
// pad / keyboard modules own those holds. main.js wires them in at boot.
let hooks = {
  activateAudioForSound: () => {},
  allGuitarPitches: () => [],
  showVocalPad: () => {},
  hideVocalPad: () => {},
  captureHeldVocalIntoLoop: () => {},
  finishHeldLoopCapture: () => {},
  captureHeldPianoIntoLoop: () => {},
  finishHeldPianoLoopCaptures: () => {},
  finalizeHeldPianoLoopCapture: () => {},
};
export function initLoopPedal(next) {
  hooks = { ...hooks, ...next };
}

// ---- multi-instrument loop pedal ----
export const LOOP_MAX_SECONDS = 12;
const LOOP_LOOKAHEAD = 0.12;
const LOOP_TICK_MS = 25;
const LOOP_EVENT_LIMIT = 192;
export const loop = {
  state: 'empty',
  events: [],
  duration: 0,
  epoch: 0,
  recordStartedAt: 0,
  pausedOffset: 0,
  layers: 0,
  activeLayer: 0,
  layerStartCount: 0,
  nextId: 1,
  autoCloseTimer: null,
  schedulerTimer: null,
  scheduled: new Set(),
  activeVoices: new Set(),
  visualTimers: new Set(),
  lastUiAt: 0,
};

export const positiveModulo = (value, modulus) => ((value % modulus) + modulus) % modulus;
const loopLayerWord = (count) => count === 1 ? 'шар' : (count < 5 ? 'шари' : 'шарів');

function cloneLoopEvent(event) {
  const clone = { ...event };
  if (event.freqs) clone.freqs = [...event.freqs];
  if (event.strings) clone.strings = event.strings.map((stringEvent) => ({ ...stringEvent }));
  return clone;
}

export function captureLoopEvent(event, at = audio.ctx?.currentTime) {
  if (!audio.ctx || (loop.state !== 'recording' && loop.state !== 'overdubbing')) return null;
  if (loop.events.length >= LOOP_EVENT_LIMIT) {
    ui.toast('Loop заповнений — замкни цей шар', 1800);
    return null;
  }
  const now = Number.isFinite(at) ? at : audio.ctx.currentTime;
  const recordingBase = loop.state === 'recording';
  const offset = recordingBase
    ? Math.max(0, now - loop.recordStartedAt)
    : positiveModulo(now - loop.epoch, loop.duration);
  const captured = {
    ...cloneLoopEvent(event),
    id: loop.nextId++,
    offset,
    layer: loop.activeLayer,
    playFromCycle: recordingBase ? 0 : Math.floor((now - loop.epoch) / loop.duration) + 1,
  };
  loop.events.push(captured);
  return captured;
}

function clearLoopVisualTimers() {
  for (const timer of loop.visualTimers) clearTimeout(timer);
  loop.visualTimers.clear();
}

function stopLoopVoices() {
  for (const voice of loop.activeVoices) voice?.cancel?.();
  loop.activeVoices.clear();
}

export function runMusicalVisual(event, feedback) {
  let kind = null;
  if (event.type === 'drum') {
    drums.hit(event.part);
    kind = 'drums';
  } else if (event.type === 'piano') {
    const key = piano.keys.find((candidate) => Math.abs(candidate.userData.freq - event.freq) < 0.01);
    if (key) piano.press(key);
    kind = 'piano';
  } else if (event.type === 'guitar-pluck') {
    guitar.pluck(event.stringIndex ?? 0, event.vel ?? 1, event.offsetMs ?? 0);
    kind = 'guitar';
  } else if (event.type === 'guitar-strum') {
    guitar.strum(event.strings || [], event.direction, event.vel ?? 1);
    play.guitarStrokeDirection = event.direction === 'treble-to-bass' ? -1 : 1;
    play.guitarStrokeMotion = Math.max(play.guitarStrokeMotion, event.vel ?? 0.72);
    kind = 'guitar';
  } else if (event.type === 'vocal') {
    mic.sing();
    kind = 'mic';
  }

  if (!feedback || !kind) return;
  if (kind !== 'mic') hooks.hideVocalPad();
  if (kind === 'mic' && event.showPad !== false) hooks.showVocalPad();
  addVibe(event.vibe ?? ({ drums: 4, piano: 3.5, guitar: 5, mic: 4 }[kind] || 3), kind);
  if (event.showPrice !== false) queuePriceChip(kind);
}

export function playMusicalEvent(event, { record = true, at = null, feedback = true } = {}) {
  // Live input may repair a stale mobile route. Look-ahead loop events only
  // resume the existing context; rebuilding must wait for a trusted gesture.
  hooks.activateAudioForSound({ allowRecovery: record });
  if (record) {
    captureLoopEvent(event);
  }

  const startAt = Number.isFinite(at) ? at : null;
  const velocity = event.vel ?? 1;
  let voice = null;
  if (event.type === 'drum') {
    if (event.part === 'kick') audio.kick(velocity, startAt);
    else if (event.part === 'snare') audio.snare(velocity, startAt);
    else if (event.part === 'hihat') audio.hihat(false, velocity, startAt);
    else if (event.part === 'crash') audio.crash(velocity, startAt);
    else audio.tom(event.part === 'tom1' ? 150 : (event.part === 'floor' ? 95 : 120), velocity, startAt);
  } else if (event.type === 'piano') {
    audio.piano(event.freq, velocity, startAt, event.duration ?? 1.6);
  } else if (event.type === 'guitar-pluck') {
    audio.pluck(event.freqHz ?? event.freq, velocity, startAt, {
      stringIndex: event.stringIndex ?? 0,
      // Loop playback must survive muteGuitar() when leaving focus / falling.
      track: record,
    });
    audio.prewarmGuitar(hooks.allGuitarPitches());
  } else if (event.type === 'guitar-strum') {
    audio.strum(event.strings ?? event.freqs, velocity, startAt, { track: record });
    audio.prewarmGuitar(hooks.allGuitarPitches());
  } else if (event.type === 'vocal') {
    voice = audio.vocalTone(event.freq, event.vowel, velocity, startAt, event.duration ?? 0.68);
    if (!record && voice) {
      loop.activeVoices.add(voice);
      const cleanupDelay = Math.max(0, (((startAt ?? audio.ctx.currentTime) - audio.ctx.currentTime) + (event.duration ?? 0.68) + 0.36) * 1000);
      setTimeout(() => loop.activeVoices.delete(voice), cleanupDelay);
    }
  }

  const visualDelay = startAt === null ? 0 : Math.max(0, (startAt - audio.ctx.currentTime) * 1000);
  if (visualDelay > 5) {
    const timer = setTimeout(() => {
      loop.visualTimers.delete(timer);
      runMusicalVisual(event, feedback);
    }, visualDelay);
    loop.visualTimers.add(timer);
  } else {
    runMusicalVisual(event, feedback);
  }
  return voice;
}

function schedulerTick() {
  if (!audio.ctx || (loop.state !== 'playing' && loop.state !== 'overdubbing') || !loop.duration) return;
  const now = audio.ctx.currentTime;
  const firstCycle = Math.max(0, Math.floor((now - loop.epoch - 0.02) / loop.duration));
  const lastCycle = Math.max(firstCycle, Math.floor((now + LOOP_LOOKAHEAD - loop.epoch) / loop.duration));

  for (let cycle = firstCycle; cycle <= lastCycle; cycle++) {
    for (const event of loop.events) {
      if (event.durationPending) continue;
      if (cycle < event.playFromCycle) continue;
      const eventAt = loop.epoch + cycle * loop.duration + event.offset;
      if (eventAt < now - 0.02 || eventAt > now + LOOP_LOOKAHEAD) continue;
      const key = `${cycle}:${event.id}`;
      if (loop.scheduled.has(key)) continue;
      loop.scheduled.add(key);
      playMusicalEvent(event, { record: false, at: eventAt, feedback: false });
    }
  }

  if (loop.scheduled.size > Math.max(80, loop.events.length * 6)) {
    for (const key of loop.scheduled) {
      if (Number(key.slice(0, key.indexOf(':'))) < firstCycle - 1) loop.scheduled.delete(key);
    }
  }
}

function startLoopScheduler() {
  clearInterval(loop.schedulerTimer);
  loop.scheduled.clear();
  schedulerTick();
  loop.schedulerTimer = setInterval(schedulerTick, LOOP_TICK_MS);
}

function stopLoopScheduler() {
  clearInterval(loop.schedulerTimer);
  loop.schedulerTimer = null;
  loop.scheduled.clear();
  clearLoopVisualTimers();
  stopLoopVoices();
}

/** After fall / muteGuitar / audio suspend — re-queue upcoming loop notes. */
export function resyncLoopPlayback() {
  if (loop.state !== 'playing' && loop.state !== 'overdubbing') return;
  audio.init();
  audio.resume();
  loop.scheduled.clear();
  stopLoopVoices();
  if (!loop.schedulerTimer) startLoopScheduler();
  else schedulerTick();
}

function renderLoopState(announce = true) {
  const state = loop.state;
  loopPedal.dataset.state = state;
  loopTools.hidden = loop.duration <= 0;
  loopPause.textContent = state === 'paused' ? '▶' : 'Ⅱ';
  loopPause.setAttribute('aria-pressed', String(state === 'paused'));
  loopPause.setAttribute('aria-label', state === 'paused' ? 'Продовжити loop' : 'Призупинити loop');
  loopToggle.disabled = state === 'paused';

  const layers = `${loop.layers} ${loopLayerWord(loop.layers)}`;
  const states = {
    empty: ['LOOP', 'ЗАПИСАТИ', 'Почати запис музичного циклу', 'Loop порожній'],
    recording: ['ЗАПИС', 'ГРАЙ ЗАРАЗ', 'Завершити запис і відтворити loop', 'Запис першого шару'],
    playing: ['+ ШАР', layers, 'Записати новий шар поверх loop', `Loop грає, ${layers}`],
    overdubbing: ['ДУБЛЬ', 'ГРАЙ ПОВЕРХ', 'Завершити запис нового шару', `Запис нового шару, ${layers}`],
    paused: ['LOOP', 'ПАУЗА', 'Loop призупинено', `Loop призупинено, ${layers}`],
  };
  const [label, meta, aria, status] = states[state];
  loopLabel.textContent = label;
  loopMeta.textContent = meta;
  loopToggle.setAttribute('aria-label', aria);
  if (announce) loopStatus.textContent = status;
}

export function updateLoopProgress() {
  if (!audio.ctx || audio.ctx.currentTime - loop.lastUiAt < 0.08) return;
  loop.lastUiAt = audio.ctx.currentTime;
  let progress = 0;
  if (loop.state === 'recording') {
    const elapsed = Math.max(0, audio.ctx.currentTime - loop.recordStartedAt);
    progress = Math.min(1, elapsed / LOOP_MAX_SECONDS);
    loopMeta.textContent = `${elapsed.toFixed(1)} С · ГРАЙ`;
  } else if (loop.duration > 0) {
    const offset = loop.state === 'paused'
      ? loop.pausedOffset
      : positiveModulo(audio.ctx.currentTime - loop.epoch, loop.duration);
    progress = offset / loop.duration;
    if (loop.state === 'playing') loopMeta.textContent = `${loop.layers} ${loopLayerWord(loop.layers)} · ${loop.duration.toFixed(1)} С`;
    else if (loop.state === 'overdubbing') loopMeta.textContent = `ГРАЙ · ${loop.duration.toFixed(1)} С`;
  }
  loopProgressBar.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
}

function startBaseLoopRecording() {
  if (!play.loopUnlocked) return;
  hooks.activateAudioForSound();
  stopLoopScheduler();
  clearTimeout(loop.autoCloseTimer);
  loop.state = 'recording';
  loop.events = [];
  loop.duration = 0;
  loop.layers = 0;
  loop.activeLayer = 1;
  loop.layerStartCount = 0;
  loop.recordStartedAt = audio.ctx.currentTime;
  loopProgressBar.style.width = '0%';
  loop.autoCloseTimer = setTimeout(() => finishBaseLoopRecording(true), LOOP_MAX_SECONDS * 1000);
  hooks.captureHeldVocalIntoLoop();
  hooks.captureHeldPianoIntoLoop();
  renderLoopState();
  navigator.vibrate?.(30);
}

export function finishBaseLoopRecording(automatic = false) {
  if (loop.state !== 'recording') return;
  clearTimeout(loop.autoCloseTimer);
  if (!loop.events.length && !play.heldLoopCapture && !heldPianoNotes.size) {
    loop.state = 'empty';
    loop.duration = 0;
    renderLoopState();
    ui.toast('Зіграй щось під час запису', 1800);
    return;
  }
  const rawDuration = Math.min(LOOP_MAX_SECONDS, Math.max(0, audio.ctx.currentTime - loop.recordStartedAt));
  loop.duration = Math.max(1, Math.ceil(rawDuration / 0.125) * 0.125);
  // Finalize sustain after loop length is known so held vocals cap correctly.
  hooks.finishHeldLoopCapture();
  hooks.finishHeldPianoLoopCaptures();
  if (!loop.events.length) {
    loop.state = 'empty';
    loop.duration = 0;
    renderLoopState();
    ui.toast('Зіграй щось під час запису', 1800);
    return;
  }
  loop.layers = 1;
  loop.state = 'playing';
  loop.epoch = audio.ctx.currentTime + 0.08;
  loop.events.sort((a, b) => a.offset - b.offset);
  renderLoopState();
  startLoopScheduler();
  ui.toast(automatic ? 'Loop замкнено автоматично' : 'Loop грає · додай ще один інструмент', 2100);
  navigator.vibrate?.([24, 35, 24]);
}

function startLoopOverdub() {
  if (loop.state !== 'playing') return;
  loop.state = 'overdubbing';
  loop.activeLayer = loop.layers + 1;
  loop.layerStartCount = loop.events.length;
  hooks.captureHeldVocalIntoLoop();
  hooks.captureHeldPianoIntoLoop();
  renderLoopState();
  ui.toast('Новий шар — грай поверх loop', 1700);
  navigator.vibrate?.(24);
}

function finishLoopOverdub() {
  if (loop.state !== 'overdubbing') return;
  hooks.finishHeldLoopCapture();
  hooks.finishHeldPianoLoopCaptures();
  const added = loop.events.length - loop.layerStartCount;
  if (added > 0) {
    loop.layers = loop.activeLayer;
    loop.events.sort((a, b) => a.offset - b.offset);
    ui.toast(`Шар ${loop.layers} додано`, 1600);
  } else {
    ui.toast('У цьому шарі немає нот', 1500);
  }
  loop.state = 'playing';
  renderLoopState();
}

function pauseLoop() {
  if (loop.state === 'overdubbing') finishLoopOverdub();
  if (loop.state !== 'playing') return;
  loop.pausedOffset = positiveModulo(audio.ctx.currentTime - loop.epoch, loop.duration);
  loop.state = 'paused';
  stopLoopScheduler();
  renderLoopState();
}

function resumeLoop() {
  if (loop.state !== 'paused') return;
  hooks.activateAudioForSound();
  loop.epoch = audio.ctx.currentTime - loop.pausedOffset;
  for (const event of loop.events) event.playFromCycle = 0;
  loop.state = 'playing';
  renderLoopState();
  startLoopScheduler();
}

export function clearRecordedLoop() {
  clearTimeout(loop.autoCloseTimer);
  hooks.finishHeldLoopCapture();
  for (const held of heldPianoNotes) hooks.finalizeHeldPianoLoopCapture(held, { cancel: true });
  stopLoopScheduler();
  loop.state = 'empty';
  loop.events = [];
  loop.duration = 0;
  loop.layers = 0;
  loop.activeLayer = 0;
  loop.pausedOffset = 0;
  loopProgressBar.style.width = '0%';
  renderLoopState();
  ui.toast('Loop очищено', 1500);
}

export function toggleLoopRecording() {
  if (!session.started || ui.modalOpen || mascotMove.fall) return;
  if (!play.loopUnlocked) {
    ui.toast('Заповни VIBE-метр, щоб відкрити loop-педаль', 1800);
    return;
  }
  if (loop.state === 'empty') startBaseLoopRecording();
  else if (loop.state === 'recording') finishBaseLoopRecording();
  else if (loop.state === 'playing') startLoopOverdub();
  else if (loop.state === 'overdubbing') finishLoopOverdub();
  else if (loop.state === 'paused') resumeLoop();
}

// pointerdown (not click): click is often dropped when another finger is already
// down on the canvas, because multitouch touchstart preventDefault kills synthesis.
function bindLoopPedalPress(el, fn) {
  el.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    fn(event);
  });
}
bindLoopPedalPress(loopToggle, toggleLoopRecording);
bindLoopPedalPress(loopPause, () => (loop.state === 'paused' ? resumeLoop() : pauseLoop()));
bindLoopPedalPress(loopClear, clearRecordedLoop);
renderLoopState(false);

