import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const audioSource = await readFile(new URL('../js/audio.js', import.meta.url), 'utf8');
const audioModuleUrl = `data:text/javascript;base64,${Buffer.from(audioSource).toString('base64')}`;
const { AudioEngine } = await import(audioModuleUrl);

// The audio-activation policy is spread across the app's modules, so scan the
// whole tree rather than a single file — that keeps these assertions about the
// policy itself and not about where a given function currently lives.
const appSources = await (async () => {
  const root = fileURLToPath(new URL('../js/', import.meta.url));
  const names = await readdir(root, { recursive: true });
  const files = names.filter((name) => name.endsWith('.js')).map((name) => join(root, name));
  return Promise.all(files.map((file) => readFile(file, 'utf8')));
})();

if (!globalThis.navigator) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {},
  });
}

class FakeAudioSession extends EventTarget {
  constructor(state = 'inactive') {
    super();
    this.state = state;
    this.type = 'auto';
  }

  setState(state) {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}

function withAudioSession(session, run) {
  const previous = navigator.audioSession;
  navigator.audioSession = session;
  try {
    run();
  } finally {
    navigator.audioSession = previous;
  }
}

test('normal AudioSession inactivity does not request a context rebuild', () => {
  withAudioSession(new FakeAudioSession('inactive'), () => {
    const engine = new AudioEngine();
    engine.ctx = { state: 'running', currentTime: 1 };

    engine._configureAudioSession();
    navigator.audioSession.setState('active');
    navigator.audioSession.setState('inactive');

    assert.equal(engine._needsRecovery, false);
    assert.equal(navigator.audioSession.type, 'ambient');
  });
});

function functionSource(name) {
  for (const source of appSources) {
    const start = source.indexOf(`function ${name}(`);
    if (start === -1) continue;
    const end = source.indexOf('\n}', start + 1);
    assert.notEqual(end, -1, `unterminated function ${name}`);
    return source.slice(start, end + 2);
  }
  assert.fail(`missing function ${name}`);
}

test('enter and non-playing UI paths leave Web Audio dormant', () => {
  for (const name of [
    'startExperience',
    'activateInstrumentView',
    'playNearestInstrument',
    'openSoundMixer',
  ]) {
    assert.doesNotMatch(functionSource(name), /audio\.(?:init|resume|unlock)\(/, name);
  }
});

test('generic stage gestures do not own audio activation', () => {
  for (const source of appSources) {
    assert.doesNotMatch(source, /unlockAudioFromGesture|resumeAudioFromActivation/);
  }
  assert.match(functionSource('playMusicalEvent'), /activateAudioForSound\(\{ allowRecovery: record \}\)/);
  assert.match(functionSource('activateAudioForSound'), /audio\.unlock\(\)/);
});

test('an AudioSession interruption requests recovery even if already interrupted', () => {
  withAudioSession(new FakeAudioSession('interrupted'), () => {
    const engine = new AudioEngine();
    engine.ctx = { state: 'running', currentTime: 1 };

    engine._configureAudioSession();

    assert.equal(engine._needsRecovery, true);
    assert.equal(engine._recoveryReason, 'audio-session-interrupted');
  });
});

test('a running context with a frozen clock is treated as stalled', () => {
  const engine = new AudioEngine();
  engine.ctx = { state: 'running', currentTime: 5 };

  assert.equal(engine._checkContextClock(1000), false);
  assert.equal(engine._checkContextClock(1400), true);
  assert.equal(engine._needsRecovery, true);
  assert.equal(engine._recoveryReason, 'context-clock-stalled');
});

test('instrument bus levels support the boosted mixer ceiling', () => {
  const engine = new AudioEngine();

  engine.setLevel('piano', 2);
  assert.equal(engine.getLevel('piano'), 2);

  engine.setLevel('piano', 3);
  assert.equal(engine.getLevel('piano'), 2);
});

test('every fader starts at the same place — the balance is the trim', () => {
  const engine = new AudioEngine();

  for (const key of AudioEngine.BUS_KEYS) {
    assert.equal(engine.getLevel(key), 1, `${key} should default to the 50% fader`);
    assert.ok(AudioEngine.BUS_TRIM[key] > 0, `${key} needs a measured loudness trim`);
  }
});

test('the fader is scaled by the bus loudness trim', () => {
  const engine = new AudioEngine();
  const written = [];
  engine.ctx = { currentTime: 0 };
  engine.buses.mic = {
    gain: {
      cancelScheduledValues() {},
      setValueAtTime: (value) => written.push(value),
    },
  };

  engine.setLevel('mic', 1);
  assert.equal(written.at(-1), AudioEngine.BUS_TRIM.mic);

  engine.setLevel('mic', 0.5);
  assert.equal(written.at(-1), 0.5 * AudioEngine.BUS_TRIM.mic);
});

test('the piano voice is a struck acoustic string model, not a sustained e-piano oscillator', () => {
  const start = audioSource.indexOf('  startPiano(');
  const end = audioSource.indexOf('  mutePiano(', start);
  const pianoSource = audioSource.slice(start, end);

  assert.match(pianoSource, /const hammer = this\._noiseSrc/);
  assert.match(pianoSource, /const unisonCents =/);
  assert.match(pianoSource, /og\.gain\.exponentialRampToValueAtTime\(0\.0001, t \+ p\.decay\)/);
  assert.doesNotMatch(pianoSource, /type: 'triangle'/);
});

test('an advancing context clock remains healthy', () => {
  const engine = new AudioEngine();
  engine.ctx = { state: 'running', currentTime: 5 };

  assert.equal(engine._checkContextClock(1000), false);
  engine.ctx.currentTime = 5.4;
  assert.equal(engine._checkContextClock(1400), false);
  assert.equal(engine._needsRecovery, false);
});

function resumableContext(resume) {
  return {
    state: 'suspended',
    currentTime: 0,
    sampleRate: 48_000,
    destination: {},
    createBuffer: () => ({}),
    createBufferSource: () => ({
      connect() {},
      start() {},
    }),
    resume,
  };
}

test('an async resume cannot report ready while recovery remains pending', async () => {
  const context = resumableContext(function resume() {
    this.state = 'running';
    return Promise.resolve();
  });
  const engine = new AudioEngine();
  engine.ctx = context;
  engine.markForRecovery('audio-session-interrupted');

  const ready = await engine.resume();
  engine._clearResumeWatch();

  assert.equal(ready, false);
  assert.equal(engine._needsRecovery, true);
  assert.equal(engine._recoveryReason, 'audio-session-interrupted');
});

test('a late resume from a replaced context cannot overwrite new context health', async () => {
  let finishOldResume;
  const oldContext = resumableContext(() => new Promise((resolve) => {
    finishOldResume = resolve;
  }));
  const engine = new AudioEngine();
  engine.ctx = oldContext;
  const pending = engine.resume();

  const replacement = { state: 'running', currentTime: 12 };
  engine.ctx = replacement;
  engine._resumeFailures = 4;
  engine._seedContextClock(replacement, 1000);
  oldContext.state = 'running';
  finishOldResume();

  assert.equal(await pending, false);
  assert.equal(engine._resumeFailures, 4);
  assert.equal(engine._clockSample.context, replacement);
  engine._clearResumeWatch();
});

test('unlock rebuilds a marked context exactly once and records why', async () => {
  let closeCount = 0;
  const oldContext = {
    state: 'running',
    currentTime: 3,
    close() {
      closeCount++;
      this.state = 'closed';
      return Promise.resolve();
    },
  };
  const replacement = { state: 'running', currentTime: 0 };
  const engine = new AudioEngine();
  engine.ctx = oldContext;
  engine._contextGeneration = 1;
  engine.markForRecovery('visibility-hidden');
  engine.init = () => {
    if (engine.ctx) return;
    engine.ctx = replacement;
    engine._contextGeneration++;
  };
  engine.resume = () => Promise.resolve(engine.ctx === replacement);

  assert.equal(await engine.unlock(), true);
  assert.equal(closeCount, 1);
  assert.equal(engine.contextGeneration, 2);
  assert.equal(engine._lastRebuildReason, 'visibility-hidden');

  assert.equal(await engine.unlock(), true);
  assert.equal(closeCount, 1);
  assert.equal(engine.contextGeneration, 2);
});
