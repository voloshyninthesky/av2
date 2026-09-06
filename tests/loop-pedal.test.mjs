import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Execute the real pedal with a deterministic audio clock and browser ports.
// Only module linkage is replaced; transport, capture, scheduling and handlers
// all run unchanged. Each test owns a fresh context and independent timers.
function pedal() {
  const nodes = new Map();
  const timers = new Map();
  const intervals = new Map();
  const voices = [];
  let id = 0;
  let wall = 0;
  function node() {
    return { dataset: {}, style: {}, listeners: {}, attrs: {},
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); },
      setAttribute(name, value) { this.attrs[name] = value; },
      fire(type, extra = {}) {
        const event = { pointerType: 'touch', pointerId: 1, button: 0, detail: 1,
          preventDefault() {}, stopPropagation() {}, ...extra };
        for (const fn of this.listeners[type] ?? []) fn(event);
      },
    };
  }
  const audio = { ctx: { currentTime: 10 }, init() {}, resume() {}, prewarmGuitar() {} };
  for (const kind of ['kick', 'snare', 'hihat', 'crash', 'tom', 'piano', 'pluck', 'strum', 'vocalTone']) {
    audio[kind] = (...args) => {
      const voice = { kind, args, cancelled: false, cancel() { this.cancelled = true; } };
      voices.push(voice);
      return voice;
    };
  }
  const window = node();
  const context = vm.createContext({
    audio, window, document: { getElementById(name) {
      if (!nodes.has(name)) nodes.set(name, node());
      return nodes.get(name);
    } },
    session: { started: true }, ui: { toast() {}, modalOpen: false },
    drums: { hit() {} }, piano: { keys: [] }, guitar: { pluck() {}, strum() {} }, mic: { sing() {} },
    mascotMove: {}, play: { loopUnlocked: true }, heldPianoNotes: new Set(),
    addVibe() {}, queuePriceChip() {}, freqFromMidi: n => n, vowelAt: n => n,
    navigator: {}, performance: { now: () => wall },
    setTimeout(fn, ms) { timers.set(++id, { fn, ms }); return id; },
    clearTimeout(key) { timers.delete(key); },
    setInterval(fn) { intervals.set(++id, fn); return id; },
    clearInterval(key) { intervals.delete(key); },
  });
  const source = readFileSync(new URL('../js/play/loop.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?;\n/gm, '').replace(/\bexport /g, '');
  vm.runInContext(source + '\nglobalThis.api = { loop, initLoopPedal, toggleLoopRecording, captureLoopEvent, finishBaseLoopRecording, clearRecordedLoop, updateLoopProgress, playMusicalEvent, rescaleRecordedLoop };', context);
  const api = context.api;
  return { ...api, audio, voices, nodes, window, timers, context,
    advance(seconds) { audio.ctx.currentTime += seconds; wall += seconds * 1000; },
    tick() { for (const fn of intervals.values()) fn(); },
    press(name = 'loop-toggle') { nodes.get(name).fire('pointerdown'); window.fire('pointerup'); },
    record(seconds = 2.037) {
      api.toggleLoopRecording();
      api.captureLoopEvent({ type: 'drum', part: 'kick' });
      audio.ctx.currentTime += seconds; wall += seconds * 1000;
      api.toggleLoopRecording();
    },
  };
}

test('two presses define exact duration and replay immediately, even with a groove', () => {
  const p = pedal();
  p.initLoopPedal({ grooveBarSeconds: () => 2.4, grooveBeatSeconds: () => 0.6, grooveDownbeatAt: () => 99 });
  p.record();
  assert.equal(p.loop.state, 'playing');
  assert.ok(Math.abs(p.loop.duration - 2.037) < 1e-10);
  assert.equal(p.loop.epoch, p.audio.ctx.currentTime);
  assert.equal(p.voices.length, 1);
  assert.equal(p.voices[0].args[1], p.loop.epoch);
  p.advance(p.loop.duration); p.tick();
  assert.equal(p.voices.length, 2);
});

test('overdubs retain length and timing and first replay on the next pass', () => {
  const p = pedal(); p.record(2);
  p.advance(0.5); p.toggleLoopRecording();
  const event = p.captureLoopEvent({ type: 'drum', part: 'snare' });
  assert.equal(p.loop.state, 'overdubbing');
  assert.equal(event.offset, 0.5);
  p.tick(); assert.equal(p.voices.length, 1);
  p.advance(0.5); p.toggleLoopRecording();
  assert.equal(p.loop.layers, 2); assert.equal(p.loop.duration, 2);
  p.advance(1.5); p.tick();
  assert.equal(p.voices.at(-1).kind, 'snare');
});

test('double tap stops, and the main pedal restarts at the beginning', () => {
  const p = pedal(); p.record(); p.advance(1);
  p.press(); p.advance(0.12); p.press();
  assert.equal(p.loop.state, 'paused');
  assert.equal(p.loop.pausedOffset, 0);
  assert.equal(p.nodes.get('loop-toggle').disabled, false);
  assert.ok(p.voices.every(v => v.cancelled));
  p.advance(1); p.press();
  assert.equal(p.loop.state, 'playing');
  assert.equal(p.loop.epoch, p.audio.ctx.currentTime);
  assert.equal(p.voices.at(-1).cancelled, false);
});

test('stop and clear cancel every instrument but leave live input and the groove alone', () => {
  const p = pedal(); p.record();
  const events = [{ type: 'drum', part: 'snare' }, { type: 'piano', freq: 440 },
    { type: 'guitar-pluck', freq: 220 }, { type: 'guitar-strum', strings: [] }, { type: 'vocal', freq: 440 }];
  const loopVoices = events.map(event => p.playMusicalEvent(event, { record: false, at: p.audio.ctx.currentTime + 0.1 }));
  const live = p.playMusicalEvent(events[1]);
  const groove = p.playMusicalEvent(events[0], { record: false, visualBucket: new Set() });
  p.press('loop-pause');
  assert.ok(loopVoices.every(v => v.cancelled));
  assert.equal(live.cancelled, false); assert.equal(groove.cancelled, false);
  p.clearRecordedLoop(); assert.equal(p.loop.events.length, 0); assert.equal(p.loop.state, 'empty');
});

test('holding clears, releasing or cancelling the pointer prevents accidental clears', () => {
  const p = pedal(); p.record(); p.advance(1);
  p.nodes.get('loop-toggle').fire('pointerdown');
  const hold = [...p.timers.values()].find(timer => timer.ms === 650);
  assert.ok(hold); hold.fn();
  assert.equal(p.loop.state, 'empty');
  p.window.fire('pointerup'); p.advance(1); p.record(); p.advance(1);
  p.nodes.get('loop-toggle').fire('pointerdown');
  p.window.fire('pointercancel');
  assert.equal([...p.timers.values()].some(timer => timer.ms === 650), false);
  assert.notEqual(p.loop.state, 'empty');
});

test('native keyboard activation and explicit stop work during the first take', () => {
  const p = pedal();
  p.nodes.get('loop-toggle').fire('click', { detail: 0 });
  assert.equal(p.loop.state, 'recording');
  assert.equal(p.nodes.get('loop-tools').hidden, false);
  p.advance(1); p.nodes.get('loop-pause').fire('click', { detail: 0 });
  assert.equal(p.loop.state, 'paused');
  p.nodes.get('loop-toggle').fire('click', { detail: 0 });
  assert.equal(p.loop.state, 'playing');
});

test('silence is preserved, sub-second loops work, and switch bounce does not disarm the limit', () => {
  const p = pedal(); p.toggleLoopRecording(); p.advance(0.03); p.toggleLoopRecording();
  assert.equal(p.loop.state, 'recording');
  assert.ok(p.timers.has(p.loop.autoCloseTimer));
  p.advance(0.42); p.toggleLoopRecording();
  assert.equal(p.loop.state, 'playing');
  assert.ok(Math.abs(p.loop.duration - 0.45) < 1e-10);
  assert.equal(p.loop.events.length, 0);
});

test('held first-take notes replay on the first pass; future groove hits are excluded', () => {
  const p = pedal();
  p.initLoopPedal({ finishHeldPianoLoopCaptures() {
    for (const event of p.loop.events) { event.durationPending = false; event.duration = 0.8; event.playFromCycle = 1; }
  } });
  p.toggleLoopRecording();
  p.captureLoopEvent({ type: 'piano', freq: 440, durationPending: true });
  p.advance(2); p.captureLoopEvent({ type: 'drum', part: 'snare' }, p.audio.ctx.currentTime + 0.1);
  p.toggleLoopRecording();
  assert.equal(p.loop.events.length, 1); assert.equal(p.voices[0].kind, 'piano');
});

test('longer takes survive the former 12-second limit and close at the safety limit', () => {
  const p = pedal(); p.toggleLoopRecording(); p.advance(15); p.updateLoopProgress();
  assert.equal(p.loop.state, 'recording');
  p.advance(105); p.updateLoopProgress();
  assert.equal(p.loop.state, 'playing'); assert.equal(p.loop.duration, 120);
});
