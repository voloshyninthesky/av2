import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function synth() {
  const sources = [];
  const param = () => ({ value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {},
    linearRampToValueAtTime() {}, cancelScheduledValues() {}, cancelAndHoldAtTime() {},
    setTargetAtTime() {}, setValueCurveAtTime() {} });
  const node = () => ({ frequency: param(), Q: param(), gain: param(), detune: param(), pan: param(),
    connect(target) { return target; }, disconnect() {} });
  const source = () => {
    const item = { ...node(), stops: [], start() {}, stop(at) { this.stops.push(at); } };
    sources.push(item); return item;
  };
  const context = vm.createContext({ setTimeout: () => 1, clearTimeout() {} });
  vm.runInContext(readFileSync(new URL('../js/audio.js', import.meta.url), 'utf8')
    .replace('export class AudioEngine', 'class AudioEngine') + '\nglobalThis.Engine = AudioEngine;', context);
  const engine = new context.Engine();
  engine.ctx = { currentTime: 10, sampleRate: 44100, createOscillator: source, createBufferSource: source,
    createGain: node, createBiquadFilter: node, createStereoPanner: node,
    createBuffer(channels, length, rate) {
      return { duration: length / rate, getChannelData: () => new Float32Array(length) };
    },
  };
  engine.master = node();
  engine._noise = {};
  return { engine, sources };
}

for (const [name, args] of [
  ['kick', [1, 10.1]], ['snare', [1, 10.1]], ['hihat', [true, 1, 10.1]],
  ['crash', [1, 10.1]], ['tom', [120, 1, 10.1]], ['piano', [440, 1, 10.1, 2]],
  ['pluck', [220, 1, 10.1, { track: false }]],
  ['strum', [[220, 330, 440], 1, 10.1, { track: false }]],
]) {
  test(`loop stop can cancel all scheduled ${name} sources`, () => {
    const { engine, sources } = synth();
    const voice = engine[name](...args);
    assert.equal(typeof voice.cancel, 'function');
    assert.ok(sources.length > 0);
    voice.cancel();
    for (const source of sources) {
      assert.ok(source.stops.at(-1) <= 10.061, `${name} source still scheduled after stop`);
    }
    assert.doesNotThrow(() => voice.cancel());
  });
}

test('cancelling a loop piano voice does not cancel a separately held live note', () => {
  const { engine, sources } = synth();
  const live = engine.startPiano(330);
  const liveStops = sources.map(source => source.stops.at(-1));
  engine.piano(440, 1, 10.1, 2).cancel();
  assert.equal(live.released, false);
  assert.deepEqual(sources.slice(0, liveStops.length).map(source => source.stops.at(-1)), liveStops);
});
