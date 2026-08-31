// ============================================================
// MULTI-INSTRUMENT LOOP PEDAL
// A single free-running bar that every instrument can overdub into. The first
// pass sets the loop length; later passes are quantised against the same epoch
// and scheduled a beat ahead on the audio clock, so playback stays in time
// even while the main thread is busy rendering.
// `playMusicalEvent` is the one road every note takes — pointer, ribbon,
// keyboard and loop playback alike — which is what makes recording transparent.
// ============================================================
import { session } from '../core/session.js?v=20260831-01';
import { ui, audio, drums, piano, guitar, mic } from '../core/studio.js?v=20260831-01';
import { mascotMove } from '../mascot/state.js?v=20260831-01';
import { play, heldPianoNotes } from './state.js?v=20260831-01';
import { addVibe, queuePriceChip } from './vibe.js?v=20260831-01';
import { freqFromMidi } from './harmony.js?v=20260831-01';
import { vowelAt } from './voice.js?v=20260831-01';

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
  captureHeldVocalIntoLoop: () => {},
  finishHeldLoopCapture: () => {},
  captureHeldPianoIntoLoop: () => {},
  finishHeldPianoLoopCaptures: () => {},
  finalizeHeldPianoLoopCapture: () => {},
  // The groove wheel sits above this module, so its bar arrives as a hook. All
  // three return null whenever no groove is sounding, which is what leaves the
  // loop free-running exactly as it was.
  grooveBarSeconds: () => null,
  grooveBeatSeconds: () => null,
  grooveDownbeatAt: () => null,
};
export function initLoopPedal(next) {
  hooks = { ...hooks, ...next };
}

// ---- multi-instrument loop pedal ----
export const LOOP_MAX_SECONDS = 12;
// The least runway a count-in may give before the take opens. One beat of
// warning is a stumble, not a count-in — and zero is the finger happening to
// land on the downbeat, which is the luck the count-in exists to replace.
const COUNT_IN_MIN_BEATS = 2;
// The groove wheel runs its own scheduler against the same audio clock. Sharing
// these two rather than copying them is what stops the pair drifting apart the
// first time either is tuned.
export const LOOP_LOOKAHEAD = 0.12;
export const LOOP_TICK_MS = 25;
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
  countdownStartedAt: 0,
  countdownEndsAt: 0,
  countdownBeat: 0,
  countdownTimer: null,
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
  // A replayed vocal used to pop the pad open, back when the pad was also the
  // only thing that advertised the instrument. The ribbon is focus-gated like
  // both wheels, and opening it from a loop would put two surfaces in one dock.
  addVibe(event.vibe ?? ({ drums: 4, piano: 3.5, guitar: 5, mic: 4 }[kind] || 3));
  if (event.showPrice !== false) queuePriceChip(kind);
}

// `visualBucket` is where a scheduled-ahead visual parks its timer. It defaults
// to the loop's own set, but the groove wheel passes its own: clearing the loop
// runs clearLoopVisualTimers(), which would otherwise swallow the groove's next
// look-ahead window of animation along with the loop's.
export function playMusicalEvent(event, { record = true, at = null, feedback = true, visualBucket = loop.visualTimers } = {}) {
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
    // Every part is named. The `else audio.tom(...)` this replaced turned a
    // typo or an unhandled new part into a silent 120 Hz tom rather than into
    // anything a reader would notice — tests/rhythm.test.mjs now holds the
    // rhythm library's part names against this exact list.
    if (event.part === 'kick') audio.kick(velocity, startAt);
    else if (event.part === 'snare') audio.snare(velocity, startAt);
    else if (event.part === 'hihat') audio.hihat(false, velocity, startAt);
    else if (event.part === 'hihatOpen') audio.hihat(true, velocity, startAt);
    else if (event.part === 'crash') audio.crash(velocity, startAt);
    else if (event.part === 'tom1') audio.tom(150, velocity, startAt);
    else if (event.part === 'tom2') audio.tom(120, velocity, startAt);
    else if (event.part === 'floor') audio.tom(95, velocity, startAt);
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
    // A sung line is a shape, not a pitch. `glide` is optional and absent on
    // every steady note — a held keyboard vowel records exactly what it always
    // did — so only a phrase that actually moved pays for the conversion here.
    const glide = event.glide?.map(([offset, midi, vowelX]) => (
      [offset, freqFromMidi(midi), vowelAt(vowelX)]
    ));
    voice = audio.vocalTone(
      event.freq, vowelAt(event.vowel), velocity, startAt, event.duration ?? 0.68, glide,
    );
    if (!record && voice) {
      loop.activeVoices.add(voice);
      const cleanupDelay = Math.max(0, (((startAt ?? audio.ctx.currentTime) - audio.ctx.currentTime) + (event.duration ?? 0.68) + 0.36) * 1000);
      setTimeout(() => loop.activeVoices.delete(voice), cleanupDelay);
    }
  }

  const visualDelay = startAt === null ? 0 : Math.max(0, (startAt - audio.ctx.currentTime) * 1000);
  if (visualDelay > 5) {
    const timer = setTimeout(() => {
      visualBucket.delete(timer);
      runMusicalVisual(event, feedback);
    }, visualDelay);
    visualBucket.add(timer);
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
    counting: ['ВІДЛІК', 'ГОТУЙСЯ', 'Скасувати відлік', 'Відлік до запису'],
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
  if (loop.state === 'counting') {
    const now = audio.ctx.currentTime;
    if (now >= loop.countdownEndsAt - 0.06) {
      // The count-in timer's frame-driven twin: setTimeout is throttled in
      // background tabs while this loop keeps pumping (headless included), so
      // whichever of the two arrives first opens the take. openBaseLoop-
      // Recording clears the timer, which is what makes the pair idempotent.
      openBaseLoopRecording(loop.countdownEndsAt);
      return;
    }
    const total = loop.countdownEndsAt - loop.countdownStartedAt;
    progress = total > 0 ? Math.min(1, (now - loop.countdownStartedAt) / total) : 0;
    const beatsLeft = Math.max(1, Math.ceil((loop.countdownEndsAt - now) / loop.countdownBeat));
    loopMeta.textContent = `${beatsLeft} · ГОТУЙСЯ`;
  } else if (loop.state === 'recording') {
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
  // Against a running groove the press ARMS rather than records: the beats
  // count down and the take opens exactly on the next downbeat, so the first
  // bar is the visitor's first bar, entered on beat one instead of wherever
  // the finger landed. With no groove there is no grid to count, so the pedal
  // records from the press exactly as it always did.
  const beat = hooks.grooveBeatSeconds();
  const bar = hooks.grooveBarSeconds();
  if (beat && bar) {
    let downbeat = hooks.grooveDownbeatAt(audio.ctx.currentTime);
    if (downbeat - audio.ctx.currentTime < beat * COUNT_IN_MIN_BEATS) downbeat += bar;
    beginLoopCountIn(downbeat, beat);
    return;
  }
  openBaseLoopRecording(audio.ctx.currentTime);
}

function beginLoopCountIn(downbeat, beat) {
  loop.state = 'counting';
  loop.countdownStartedAt = audio.ctx.currentTime;
  loop.countdownEndsAt = downbeat;
  loop.countdownBeat = beat;
  loopProgressBar.style.width = '0%';
  // The LED pulses in the groove's own tempo — the count the visitor hears.
  loopPedal.style.setProperty('--count-beat', `${beat.toFixed(3)}s`);
  // Notes played during the count-in sound but are not captured; that needs no
  // code here, because captureLoopEvent already no-ops outside recording /
  // overdubbing and 'counting' is neither.
  //
  // The flip fires a hair EARLY on purpose: an eager entrance just before beat
  // one meant beat one, and captureLoopEvent's max(0, …) clamp lands it at
  // offset 0 exactly. updateLoopProgress carries a frame-driven twin of this
  // timer, because timers are throttled in background tabs while the headless
  // frame loop keeps pumping — whichever arrives first opens the take.
  const wait = Math.max(0, (downbeat - audio.ctx.currentTime) * 1000 - 60);
  loop.countdownTimer = setTimeout(() => {
    if (loop.state === 'counting') openBaseLoopRecording(loop.countdownEndsAt);
  }, wait);
  renderLoopState();
  navigator.vibrate?.(18);
}

function cancelLoopCountIn() {
  clearTimeout(loop.countdownTimer);
  loop.countdownTimer = null;
  loop.state = 'empty';
  loopProgressBar.style.width = '0%';
  renderLoopState();
  ui.toast('Відлік скасовано', 1400);
}

function openBaseLoopRecording(startAt) {
  clearTimeout(loop.countdownTimer);
  loop.countdownTimer = null;
  loop.state = 'recording';
  loop.events = [];
  loop.duration = 0;
  loop.layers = 0;
  loop.activeLayer = 1;
  loop.layerStartCount = 0;
  // Every captured offset is measured from here. After a count-in this is the
  // downbeat itself — possibly a few ms in the future, which the offset clamp
  // absorbs — so offsets are bar-relative with no snap-back needed.
  loop.recordStartedAt = startAt;
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
  // Against a groove the loop is whole bars, not a grid of eighths of a second.
  // That grid is 16 ms out per bar at 92 BPM — half a sixteenth inside two
  // minutes — and nothing errors or logs while it drifts: the snare you played
  // on the backbeat is simply on the "and" when you come back to it.
  // Round, never ceil: a finger that lifts a hair early meant this bar, and
  // ceiling would hand back a bar of silence.
  const grooveBar = hooks.grooveBarSeconds();
  loop.duration = grooveBar
    ? Math.min(
      Math.max(1, Math.floor(LOOP_MAX_SECONDS / grooveBar)),
      Math.max(1, Math.round(rawDuration / grooveBar)),
    ) * grooveBar
    : Math.max(1, Math.ceil(rawDuration / 0.125) * 0.125);
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
  // Forward to the groove's next downbeat, so the loop's bar one and the
  // wheel's 12 o'clock are the same instant. Safe to sit in the future: the
  // scheduler's floor and look-ahead guards simply idle until it arrives.
  loop.epoch = hooks.grooveDownbeatAt(audio.ctx.currentTime + 0.08) ?? (audio.ctx.currentTime + 0.08);
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

/**
 * Re-time the recorded loop by `ratio` (new length / old length) — the groove
 * wheel's tempo stepper calls this instead of locking itself while a loop has
 * content. Duration, every event offset, every held note's duration and every
 * glide point scale together, and the epoch is re-snapped so the note under
 * the playhead stays under it.
 */
export function rescaleRecordedLoop(ratio) {
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio === 1) return;
  // An open take never reaches here — the stepper stays locked while recording
  // or overdubbing, because captured offsets are distances in the old bar and
  // moving the ruler mid-measurement would bend them silently.
  if ((loop.state !== 'playing' && loop.state !== 'paused') || !loop.duration) return;
  const oldDuration = loop.duration;
  loop.duration = oldDuration * ratio;
  for (const event of loop.events) {
    event.offset *= ratio;
    if (event.duration != null) event.duration *= ratio;
    // A sung line is a shape; its bend has to stretch with the bar it lives in.
    if (event.glide) for (const point of event.glide) point[0] *= ratio;
  }
  if (loop.state === 'paused') {
    loop.pausedOffset *= ratio;
    return;
  }
  // Re-anchor keeping BOTH the phase and the cycle count. Restarting cycles at
  // zero (epoch = now - fraction · duration) looks equivalent and is not:
  // playFromCycle gates would strand every overdub layer, and the scheduler's
  // `cycle:id` dedup keys would collide with their old namesakes bars later.
  // Preserving the count means events already scheduled into the look-ahead
  // window keep their keys, so nothing double-fires at the seam either.
  const now = audio.ctx.currentTime;
  const cycles = Math.floor((now - loop.epoch) / oldDuration);
  const fraction = positiveModulo(now - loop.epoch, oldDuration) / oldDuration;
  loop.epoch = now - (cycles + fraction) * loop.duration;
  // Put bar one back on the groove's 12 o'clock *exactly* — but only as a
  // float repair (the stepper and this call read the clock microseconds
  // apart). A take recorded free and only joined by a groove later was never
  // bar-aligned, and yanking it up to half a bar onto that grid would be a
  // jump the visitor did not ask for — hence the 10 ms ceiling.
  const bar = hooks.grooveBarSeconds();
  if (bar) {
    const cycleStart = loop.epoch + cycles * loop.duration;
    const before = hooks.grooveDownbeatAt(cycleStart, { before: true });
    if (before !== null) {
      const snapped = cycleStart - before > bar / 2 ? before + bar : before;
      if (Math.abs(snapped - cycleStart) < 0.01) loop.epoch += snapped - cycleStart;
    }
  }
  renderLoopState(false);
}

export function clearRecordedLoop() {
  // Mid-count-in there is nothing recorded to clear; the press means "stand
  // down", and the cancel toast says what actually happened.
  if (loop.state === 'counting') { cancelLoopCountIn(); return; }
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
  else if (loop.state === 'counting') cancelLoopCountIn();
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

