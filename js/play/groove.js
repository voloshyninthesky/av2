// ============================================================
// GROOVE WHEEL
// The bar as a circle, because that is what a bar is. Twelve grooves on the
// outer ring — four families of three, busier clockwise inside each — and the
// bar itself on the ring within, with 12 o'clock as beat one exactly as the
// tonic sits at 12 o'clock on the chord wheel next door.
//
// Two things this deliberately is not:
//
//   * It is not a step sequencer. The wedges are whole grooves; the visitor
//     never fills a cell. A grid you fill is the six-slot chord pad again — a
//     settings task wearing a play surface's clothes — and the wheel replaced
//     that once already. One tap here is one bar of music.
//   * It does not draw the pattern. The stage already owns a notation surface:
//     the kit. runMusicalVisual(event, false) animates a hit without rewarding
//     it, so a *muted* groove is the real drums playing themselves in silence —
//     heads punching, cymbals swinging, in time. Forty-eight cells on a 220px
//     circle would be unreadable, and this is legible from across the room.
//
// A wedge PLAYS, the way a wedge does at the piano and unlike the guitar's,
// which only arms. Tapping one starts that groove — audible, animated, turning
// — and tapping it again stops. There is no third state and no silent-but-
// moving mode: a drum that is animating and not sounding reads as broken, so
// nothing on the kit moves unless it is making a noise.
//
// Stopped, the wheel shows nothing at all: no lit wedge, no playhead, no
// recoil. That also keeps the shipped promise that focus never starts a
// melody — reaching the kit opens a still wheel, and only a deliberate tap on a
// groove creates an AudioContext or makes a sound.
//
// The theory is all in rhythm.js; this file is geometry, pointers and state.
// ============================================================
import { audio } from '../core/studio.js?v=20260813-17';
import { prefersReducedMotion } from '../core/quality.js?v=20260813-17';
import {
  LOOP_LOOKAHEAD,
  LOOP_TICK_MS,
  captureLoopEvent,
  playMusicalEvent,
  positiveModulo,
  runMusicalVisual,
} from './loop.js?v=20260813-17';
import {
  GROOVES,
  GROOVE_COUNT,
  TEMPO_DEFAULT,
  TEMPO_MAX,
  TEMPO_MIN,
  barSeconds,
  grooveAt,
  grooveHits,
  stepGroove,
  stepSeconds,
  stepTempo,
} from './rhythm.js?v=20260813-17';
import { syncPadsOpenClass } from './pads.js?v=20260813-17';

// Choosing a groove must not wake audio, and stepping it from the keyboard is
// the drums close-up's alone. main.js owns both answers.
let hooks = {
  activateAudioForSound: () => {},
  canPlayInstrument: () => false,
  canKeyboardJamPlay: () => false,
  loopHasContent: () => false,
  loopIsRecording: () => false,
  toast: () => {},
};
export function initGroove(next) {
  hooks = { ...hooks, ...next };
}

const wheel = document.getElementById('groove-wheel');
const rings = document.getElementById('groove-wheel-rings');
const tempoLabel = document.getElementById('groove-tempo');

// ---- state ----
// Which groove was last chosen, and at what tempo. Whether it was *playing*
// deliberately does not persist: a remembered playing state would start drums
// at a returning stranger who has not asked for any.
const GROOVE_STORAGE = 'av2.groove.v1';
let grooveIndex = 0;
let bpm = TEMPO_DEFAULT;
let playing = false;
try {
  const saved = JSON.parse(localStorage.getItem(GROOVE_STORAGE) || 'null');
  if (Number.isInteger(saved?.groove) && saved.groove >= 0 && saved.groove < GROOVE_COUNT) {
    grooveIndex = saved.groove;
  }
  if (Number.isFinite(saved?.bpm) && saved.bpm >= TEMPO_MIN && saved.bpm <= TEMPO_MAX) {
    bpm = saved.bpm;
  }
} catch { /* storage is optional */ }

function storeGroove() {
  try {
    localStorage.setItem(GROOVE_STORAGE, JSON.stringify({ groove: grooveIndex, bpm }));
  } catch { /* storage is optional */ }
}

const current = () => grooveAt(grooveIndex);
const currentBar = () => barSeconds(bpm, current().beats);

// ============================================================
// GEOMETRY
// A 200-unit viewBox shared with the chord wheel, so radii read as percentages.
// Only the groove ring is a touch target, so it takes the fat band: at 320x568
// the wheel is 220px across, making that ring ~34px thick radially — the axis a
// fingertip actually misses, and over the 32px floor §12 sets. The bar ring is
// read-only and may therefore be thin.
//
// Unlike the chord wheel a wedge SPANS its slot rather than being centred on
// it, so the four family boundaries land exactly on 0/90/180/270° — the same
// four spokes as the beats on the ring inside. The two circles then share their
// heavy lines instead of disagreeing by half a wedge.
// ============================================================
const WEDGE_DEGREES = 360 / GROOVE_COUNT;
const GROOVE_HUB_RADIUS = 36;
const BAR_RING = [GROOVE_HUB_RADIUS, 64];
const GROOVE_RING = [68, 99];

function polar(radius, degrees) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [radius * Math.cos(radians), radius * Math.sin(radians)];
}

function wedgePath(index) {
  const [inner, outer] = GROOVE_RING;
  const from = index * WEDGE_DEGREES;
  const to = from + WEDGE_DEGREES;
  const [ax, ay] = polar(outer, from);
  const [bx, by] = polar(outer, to);
  const [cx, cy] = polar(inner, to);
  const [dx, dy] = polar(inner, from);
  // Every wedge is 30°, so the large-arc flag is always 0.
  return `M${ax} ${ay}A${outer} ${outer} 0 0 1 ${bx} ${by}`
    + `L${cx} ${cy}A${inner} ${inner} 0 0 0 ${dx} ${dy}Z`;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
};

// ---- bar ring: a backing disc, the ticks, and the one moving thing ----
const barRingGroup = el('g', { class: 'bar-ring-group' });
barRingGroup.append(el('circle', {
  class: 'bar-ring', cx: 0, cy: 0, r: (BAR_RING[0] + BAR_RING[1]) / 2,
  fill: 'none', 'stroke-width': BAR_RING[1] - BAR_RING[0],
}));
const tickGroup = el('g', { class: 'bar-ticks' });
barRingGroup.append(tickGroup);

const playhead = el('g', { class: 'playhead' });
playhead.append(el('line', { x1: 0, y1: -BAR_RING[0], x2: 0, y2: -BAR_RING[1] }));
barRingGroup.append(playhead);

// ---- groove ring ----
const wedgeGroup = el('g', { class: 'groove-wedges' });
const wedges = [];
for (let index = 0; index < GROOVE_COUNT; index++) {
  // role + tabindex rather than a real <button>: the shape is the control, and
  // the global hotkey router already skips [role="button"] targets so a focused
  // wedge cannot also fire the Space hi-hat pedal underneath it.
  const group = el('g', { class: 'wedge', role: 'button', tabindex: '0', 'aria-pressed': 'false' });
  group.dataset.groove = String(index);
  if (index % 3 === 0) group.classList.add('family-start');
  const midAngle = index * WEDGE_DEGREES + WEDGE_DEGREES / 2;
  const [x, y] = polar((GROOVE_RING[0] + GROOVE_RING[1]) / 2, midAngle);
  // Labels run along their wedge, not across it. A groove's name is a word
  // rather than the chord wheel's one or two characters, and horizontal text
  // in a wedge at 3 or 9 o'clock is bounded by the 31-unit band instead of the
  // 44-unit arc — so it spills over the rings. Turned tangentially the arc is
  // always the constraint. The far half is flipped upright rather than left to
  // read upside down.
  const upright = midAngle > 90 && midAngle < 270 ? midAngle - 180 : midAngle;
  const text = el('text', { x, y, transform: `rotate(${upright} ${x} ${y})` });
  group.append(el('path', { d: wedgePath(index) }), text);
  wedgeGroup.append(group);
  wedges.push({ group, text, x, y });
}

rings?.append(barRingGroup, wedgeGroup);

// ============================================================
// PAINT
// ============================================================
let ticks = [];
const lit = [];   // ticks currently showing a strike

/** The bar ring is rebuilt only when the grid changes — 16 steps or 12. */
function paintBarRing() {
  const { steps, beats } = current();
  if (ticks.length === steps) return;
  tickGroup.replaceChildren();
  ticks = [];
  lit.length = 0;
  const perBeat = steps / beats;
  for (let step = 0; step < steps; step++) {
    const angle = (step / steps) * 360;
    const isBeat = step % perBeat === 0;
    const [x1, y1] = polar(BAR_RING[0], angle);
    const [x2, y2] = polar(BAR_RING[1], angle);
    const tick = el('line', { class: 'bar-tick', x1, y1, x2, y2 });
    if (isBeat) tick.classList.add('beat');
    if (step === 0) tick.classList.add('downbeat');
    tickGroup.append(tick);
    ticks.push(tick);
  }
}

function paintWheel() {
  const groove = current();
  wedges.forEach((wedge, index) => {
    const entry = GROOVES[index];
    // Only a *playing* groove is lit. Stopped, every wedge reads the same,
    // because there is nothing going on for one of them to be the subject of.
    const live = playing && index === grooveIndex;
    wedge.group.classList.toggle('chosen', live);
    wedge.group.setAttribute('aria-pressed', String(live));
    wedge.text.textContent = entry.name;
    wedge.text.classList.toggle('long', entry.name.length > 5);
    wedge.group.setAttribute('aria-label', live
      ? `Ґрув ${entry.name}, ${entry.family} — грає, зупинити`
      : `Ґрув ${entry.name}, ${entry.family} — увімкнути`);
  });
  tempoLabel.textContent = String(bpm);
  wheel.dataset.playing = String(playing);
  paintBarRing();
  paintTempoLock();
  wheel.setAttribute('aria-label', playing
    ? `Ґрув ${groove.name}, ${bpm} уд/хв, грає`
    : `Ґрув, ${bpm} уд/хв, зупинено`);
}

// Tempo is locked once a loop exists: loop.duration is already whole bars of
// the old tempo, and moving it underneath would re-open the drift the bar
// quantisation exists to close. The loop pedal is not ours to listen to, and it
// changes state from four different places, so this is re-read from the frame
// loop instead — guarded, so it writes only when the answer actually flips.
let tempoLocked = null;
function paintTempoLock() {
  const locked = hooks.loopHasContent();
  if (locked === tempoLocked) return;
  tempoLocked = locked;
  for (const button of wheel.querySelectorAll('[data-tempo-step]')) {
    button.setAttribute('aria-disabled', String(locked));
  }
}

// ============================================================
// ONE BAR, ALWAYS RUNNING
// The bar is pinned to the audio clock once — the first time a groove is
// started in this visit — and from then on it simply runs. Stopping does not
// pause it and starting does not reset it; the transport only joins and leaves
// a bar that was going anyway.
//
// That is what makes the wheel usable for practising fills. Because the epoch
// never moves, the groove is permanently locked to one grid: drop it out, play
// a fill of whatever length, tap back in, and it lands in time even if the tap
// was sloppy — the beat is exactly where it always was. Freezing the phase
// instead (which this used to do) meant the groove came back on the beat you
// left on rather than the beat the room is on, and a whole second layer of
// frame-clock bookkeeping existed to arrange that.
//
// `null` means not yet pinned. Only two things pin it: the first start of a
// visit, which lands the groove on the downbeat, and a tempo change, which
// re-pins to hold the phase across the new bar length.
// ============================================================
let audioEpoch = null;   // audio-clock time of bar zero
let lastVisualStep = -1;
const scheduled = new Set();
const grooveVisualTimers = new Set();
let schedulerTimer = null;

const barPinned = () => Boolean(audio.ctx) && audioEpoch !== null;

function barPhase() {
  if (!barPinned()) return 0;
  const bar = currentBar();
  return positiveModulo(audio.ctx.currentTime - audioEpoch, bar) / bar;
}

// ============================================================
// SCHEDULER
// Its own, not the loop's. schedulerTick() there early-returns unless the loop
// is playing, and clearRecordedLoop() stops its timer — either would tie the
// groove's life to the loop's, when the groove has to run while the loop is
// empty, recording and paused alike. What IS shared is the road every note
// takes (playMusicalEvent) and the look-ahead constants, imported rather than
// copied so the two cannot drift apart in a later tuning pass.
// ============================================================
function scheduleAhead() {
  if (!audio.ctx || !playing || wheel.hidden) return;
  const groove = current();
  const bar = currentBar();
  const stepLength = stepSeconds(bpm, groove);
  const now = audio.ctx.currentTime;
  const firstBar = Math.max(0, Math.floor((now - audioEpoch - 0.02) / bar));
  const lastBar = Math.max(firstBar, Math.floor((now + LOOP_LOOKAHEAD - audioEpoch) / bar));
  const hits = grooveHits(groove);

  for (let barIndex = firstBar; barIndex <= lastBar; barIndex++) {
    for (const hit of hits) {
      const at = audioEpoch + barIndex * bar + hit.step * stepLength;
      if (at < now - 0.02 || at > now + LOOP_LOOKAHEAD) continue;
      const key = `${barIndex}:${hit.part}:${hit.step}`;
      if (scheduled.has(key)) continue;
      scheduled.add(key);
      {
        const event = { type: 'drum', part: hit.part, vel: hit.vel };
        // `feedback: false` is what keeps a running groove from filling the
        // VIBE meter and unlocking the loop pedal on its own — that stays true
        // even while the take below is recording, because a machine playing
        // itself is not the visitor earning anything.
        //
        // `record: false` stays too, but for the audio route rather than the
        // capture: it is what tells playMusicalEvent this is a look-ahead event
        // that may resume a context but must never rebuild one (loop.js says
        // so — rebuilding waits for a trusted gesture). The capture is then
        // made explicitly below, at the scheduled time rather than at "now".
        playMusicalEvent(event, {
          record: false, at, feedback: false, visualBucket: grooveVisualTimers,
        });
        // Roll the groove into the take. captureLoopEvent is itself a no-op
        // unless the pedal is recording, so this is the whole condition.
        if (captureLoopEvent(event, at)) capturedIntoLoop = true;
      }
    }
  }

  if (scheduled.size > 256) {
    for (const key of scheduled) {
      if (Number(key.slice(0, key.indexOf(':'))) < firstBar - 1) scheduled.delete(key);
    }
  }
}

function startScheduler() {
  clearInterval(schedulerTimer);
  scheduled.clear();
  scheduleAhead();
  schedulerTimer = setInterval(scheduleAhead, LOOP_TICK_MS);
}

function stopScheduler() {
  clearInterval(schedulerTimer);
  schedulerTimer = null;
  scheduled.clear();
  for (const timer of grooveVisualTimers) clearTimeout(timer);
  grooveVisualTimers.clear();
}

/** After a tab switch or an audio rebuild — re-pin the bar and re-queue it. */
export function resyncGroove() {
  if (wheel.hidden || !playing) return;
  audio.init();
  audio.resume();
  scheduled.clear();
  if (!schedulerTimer) startScheduler();
  else scheduleAhead();
}

// ============================================================
// THE FRAME LOOP
// The playhead, and only while the groove is sounding. The hits themselves are
// animated by the scheduled events on their way through playMusicalEvent, so
// nothing is drawn here — a drum that recoils without a sound reads as a bug,
// and there is no longer any mode that would produce one.
//
// It takes no `dt`: the bar is read from the audio clock rather than integrated
// frame by frame, so a slow frame moves the playhead further instead of putting
// it out of step with what you are hearing.
// ============================================================
export function updateGroovePlayhead() {
  if (wheel.hidden) return;
  paintTempoLock();
  syncLoopHandover();
  if (!playing) return;

  const groove = current();
  const phase = barPhase();
  const reduced = prefersReducedMotion.matches;
  // Reduced motion steps the playhead beat to beat instead of sweeping it.
  const shown = reduced ? Math.floor(phase * groove.beats) / groove.beats : phase;
  playhead.setAttribute('transform', `rotate(${shown * 360})`);

  const step = Math.min(groove.steps - 1, Math.floor(phase * groove.steps));
  if (step === lastVisualStep) return;
  const crossed = new Set();
  for (let cursor = lastVisualStep; cursor !== step;) {
    cursor = (cursor + 1) % groove.steps;
    crossed.add(cursor);
  }
  lastVisualStep = step;

  // Only the steps struck since the last crossing stay lit, so the ring reads
  // as a pulse rather than filling up over a bar.
  for (const tick of lit) tick.classList.remove('sounding');
  lit.length = 0;
  for (const hit of grooveHits(groove)) {
    if (!crossed.has(hit.step)) continue;
    const tick = ticks[hit.step];
    if (tick && !lit.includes(tick)) { tick.classList.add('sounding'); lit.push(tick); }
  }
}

// ============================================================
// CONTROLS
// ============================================================
/**
 * Choosing a groove plays it. Choosing the one already playing stops it — the
 * wedge is the transport, so there is no separate play control to look for.
 */
function chooseGroove(index) {
  const next = ((index % GROOVE_COUNT) + GROOVE_COUNT) % GROOVE_COUNT;
  if (playing && next === grooveIndex) { stopPlaying(); return; }
  grooveIndex = next;
  // A different grid means a different step count, so the crossing cursor and
  // everything queued against the old bar have to go.
  lastVisualStep = -1;
  scheduled.clear();
  storeGroove();
  if (playing) paintWheel();
  else startPlaying();
}

function startPlaying() {
  if (playing) return;
  playing = true;
  // The one place this module wakes audio, and only ever from a real gesture.
  hooks.activateAudioForSound();
  // Pin the bar only if nothing has pinned it yet, so the first groove of a
  // visit starts on the downbeat and every later one joins the bar in progress.
  if (audio.ctx && audioEpoch === null) audioEpoch = audio.ctx.currentTime;
  lastVisualStep = -1;
  startScheduler();
  paintWheel();
}

function stopPlaying() {
  if (!playing) return;
  playing = false;
  stopScheduler();
  lastVisualStep = -1;
  for (const tick of lit) tick.classList.remove('sounding');
  lit.length = 0;
  paintWheel();
}

function setTempo(direction) {
  if (hooks.loopHasContent()) {
    hooks.toast('Темп замкнено, поки є loop', 1700);
    return;
  }
  const next = stepTempo(bpm, direction);
  if (next === bpm) return;
  // Keep the phase where it is across the tempo change, or the bar jumps. This
  // has to hold while stopped too, since the bar is still running then.
  const phase = barPhase();
  bpm = next;
  if (barPinned()) audioEpoch = audio.ctx.currentTime - phase * currentBar();
  scheduled.clear();
  storeGroove();
  paintWheel();
}

// ---- handing the bar to the loop ----
// A take recorded over a groove contains that groove: the scheduler captures
// every hit as it schedules it. So when the take closes the groove stops on its
// own, because the loop is playing it now and two of them is just doubling.
let capturedIntoLoop = false;
let wasRecording = false;
function syncLoopHandover() {
  const recording = hooks.loopIsRecording();
  // Only hand over a groove that is still going. Stopping one by hand partway
  // through a take used to leave these two flags stale, because this ran inside
  // the playing-only half of the frame loop — so the *next* groove started was
  // handed over the instant it began, and stopped itself.
  if (wasRecording && !recording && capturedIntoLoop && playing) {
    stopPlaying();
    hooks.toast('Ґрув записано в loop', 1700);
  }
  if (!recording) capturedIntoLoop = false;
  wasRecording = recording;
}

// ---- pointer routing ----
// pointerdown, not click, and for the loop pedal's reason: a synthesized click
// is often dropped when another finger is already down on the canvas, and here
// the other finger is very likely resting on a drum.
function bindPress(node, handler) {
  node.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    handler(event);
  });
}

rings?.addEventListener('pointerdown', (event) => {
  const wedge = event.target.closest?.('.wedge');
  if (!wedge) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  chooseGroove(Number(wedge.dataset.groove));
  navigator.vibrate?.(10);
}, { passive: false });

// A wedge is a button, so it answers the keys a button answers.
rings?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const wedge = event.target.closest?.('.wedge');
  if (!wedge) return;
  event.preventDefault();
  chooseGroove(Number(wedge.dataset.groove));
});

for (const button of wheel?.querySelectorAll('[data-tempo-step]') ?? []) {
  bindPress(button, () => setTempo(Number(button.dataset.tempoStep)));
}

// ---- keyboard ----
// `;` and `'` step the groove, the twin of `[` and `]` stepping the key, and
// backtick starts or stops it the way `\` toggles sevenths. Unlike those three
// these are scoped to the drums close-up rather than global: a key signature is
// a tuning that outlives focus, while a groove exists only where its surface
// does. SPEC §5's "always live, in every mode" list therefore does not grow.
window.addEventListener('keydown', (event) => {
  if (!hooks.canKeyboardJamPlay() || !hooks.canPlayInstrument('drums')) return;
  if (event.target?.closest?.('button, a, input, textarea, select, [contenteditable="true"], [role="button"]')) return;
  if (event.repeat) return;
  // Stepping always leaves a groove playing — there is no silent selection to
  // move around, so `;` and `'` walk the circle audibly.
  if (event.code === 'Semicolon') chooseGroove(stepGroove(grooveIndex, -1));
  else if (event.code === 'Quote') chooseGroove(stepGroove(grooveIndex, 1));
  else if (event.code === 'Backquote') (playing ? stopPlaying() : startPlaying());
  else return;
  event.preventDefault();
});

// ============================================================
// SHOW / HIDE
// ============================================================
export function showGrooveWheel() {
  wheel.hidden = false;
  paintWheel();
  syncPadsOpenClass();
}

export function hideGrooveWheel() {
  wheel.hidden = true;
  syncPadsOpenClass();
}

/**
 * Leaving the kit keeps the choice but drops the bar. Stopping a groove at the
 * kit leaves its bar running so you can practise fills against it, but walking
 * away is a real break — a phantom bar that survived a trip across the stage
 * would be counting nothing — so the next visit starts on the downbeat again.
 */
export function stopGroove() {
  stopPlaying();
  audioEpoch = null;
}

// ---- what the loop pedal needs to know ----
/** Null when no groove is sounding, which is what tells the loop to stay free. */
export const grooveBarSeconds = () => (wheel.hidden || !playing ? null : currentBar());

/**
 * The downbeat at or after `time`, or the one at or before it with
 * `{ before: true }`. Null whenever grooveBarSeconds() is.
 */
export function grooveDownbeatAt(time, { before = false } = {}) {
  if (grooveBarSeconds() === null || !audio.ctx) return null;
  const bar = currentBar();
  const bars = (time - audioEpoch) / bar;
  return audioEpoch + (before ? Math.floor(bars) : Math.ceil(bars)) * bar;
}

// ---- headless QA reads the wheel as data ----
window.__grooveDebug = () => ({
  groove: current().name,
  family: current().family,
  index: grooveIndex,
  bpm,
  playing,
  steps: current().steps,
  beats: current().beats,
  phase: +barPhase().toFixed(4),
  bar: +currentBar().toFixed(4),
  hidden: wheel.hidden,
  scheduled: scheduled.size,
  barPinned: barPinned(),
  // Two docked wheels at once would be a layout bug the eye catches late and a
  // headless run catches immediately.
  bothWheelsOpen: !wheel.hidden && !document.getElementById('chord-wheel')?.hidden,
});

paintWheel();
