import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const audioSource = await readFile(new URL('../js/audio.js', import.meta.url), 'utf8');
const mainSource = await readFile(new URL('../js/main.js', import.meta.url), 'utf8');
const audioModuleUrl = `data:text/javascript;base64,${Buffer.from(audioSource).toString('base64')}`;
const { AudioEngine } = await import(audioModuleUrl);

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
  const start = mainSource.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = mainSource.indexOf('\n}', start + 1);
  assert.notEqual(end, -1, `unterminated function ${name}`);
  return mainSource.slice(start, end + 2);
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
  assert.doesNotMatch(mainSource, /unlockAudioFromGesture|resumeAudioFromActivation/);
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
