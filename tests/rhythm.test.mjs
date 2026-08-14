// A wrong groove is silent-but-wrong, the same failure mode a wrong barre shape
// has: the kit still plays *a* pattern, just not the one the wedge promises. So
// it gets the same treatment the chord wheel got — the theory re-derived here,
// independently, rather than compared against itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './load-module.mjs';

const r = await loadModule(new URL('../js/play/rhythm.js', import.meta.url));

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

// These modules explain themselves at length, and half the things asserted
// below are named in those explanations — so a source-text check has to read
// the code and not the prose, or it passes on a comment that says the right
// thing above code that does not. `://` is spared so a URL survives.
const code = (path) => source(path)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');
const onsetSteps = (pattern) => [...pattern]
  .map((char, step) => (char === '-' ? null : step))
  .filter((step) => step !== null);

/** Gaps between consecutive onsets, all the way round the circle. */
function gapsOf(hits) {
  const steps = hits.length;
  const onsets = hits.map((hit, i) => (hit ? i : null)).filter((i) => i !== null);
  return onsets.map((onset, i) => (i === onsets.length - 1
    ? steps - onset + onsets[0]
    : onsets[i + 1] - onset));
}

// ============================================================
// THE GENERATOR
// ============================================================

test('a Euclidean rhythm is maximally even at every size', () => {
  for (let steps = 1; steps <= 16; steps++) {
    for (let onsets = 1; onsets <= steps; onsets++) {
      const hits = r.euclid(onsets, steps);
      const where = `E(${onsets},${steps})`;
      assert.equal(hits.length, steps, `${where}: wrong length`);
      assert.equal(hits.filter(Boolean).length, onsets, `${where}: wrong onset count`);
      assert.equal(hits[0], true, `${where}: does not start on a hit`);

      const gaps = new Set(gapsOf(hits));
      assert.ok(gaps.size <= 2, `${where}: gaps take ${gaps.size} values, ${[...gaps]}`);
      if (gaps.size === 2) {
        const [low, high] = [...gaps].sort((a, b) => a - b);
        assert.equal(high - low, 1, `${where}: gaps ${low} and ${high} differ by more than one`);
      }
    }
  }
});

test('rotation turns the necklace without changing what it is', () => {
  for (let rotation = 0; rotation < 16; rotation++) {
    const hits = r.euclid(5, 16, rotation);
    assert.equal(hits.filter(Boolean).length, 5, `rotation ${rotation}: lost a hit`);
    assert.deepEqual(
      gapsOf(hits).sort(), gapsOf(r.euclid(5, 16)).sort(),
      `rotation ${rotation}: changed the gap multiset`);
  }
  // A full turn is no turn, and rotation reads the circle both ways.
  assert.deepEqual(r.euclid(5, 16, 16), r.euclid(5, 16, 0));
  assert.deepEqual(r.euclid(5, 16, -6), r.euclid(5, 16, 10));
});

test('the named rhythms of the literature fall out of it', () => {
  // Each is E(k,n) at the turn the tradition calls "one". If a refactor keeps
  // the evenness but flips the rotation convention, these are what notice.
  assert.equal(r.euclidPattern(3, 8, 0), 'x--x--x-', 'tresillo');
  assert.equal(r.euclidPattern(5, 8, 2), 'x-xx-xx-', 'cinquillo');
  assert.equal(r.euclidPattern(5, 16, 10), 'x--x--x---x--x--', 'bossa clave');
  assert.equal(r.euclidPattern(8, 12, 0), 'x-xx-xx-xx-x', 'shuffle');
  // The circle of fifths' own set: E(7,12) turned seven steps is the major
  // scale, which is why this file and harmony.js are the same idea twice.
  assert.deepEqual(onsetSteps(r.euclidPattern(7, 12, 7)), [0, 2, 4, 5, 7, 9, 11], 'major scale');
});

test('a step pattern reads back as its hits', () => {
  assert.deepEqual(r.parseStepPattern('--o-X---'), [
    { step: 2, vel: r.STEP_CHARS.o },
    { step: 4, vel: r.STEP_CHARS.X },
  ]);
  assert.deepEqual(r.parseStepPattern('--------'), []);
});

// ============================================================
// THE LIBRARY
// ============================================================

test('every pattern is exactly one character per step', () => {
  // One short shifts the whole bar and every onset after it, silently.
  for (const groove of r.GROOVES) {
    for (const [part, pattern] of Object.entries(groove.parts)) {
      assert.equal(pattern.length, groove.steps,
        `${groove.name} / ${part}: ${pattern.length} characters for ${groove.steps} steps`);
      for (const char of pattern) {
        assert.ok(char in r.STEP_CHARS, `${groove.name} / ${part}: unknown character ${char}`);
      }
    }
  }
});

test('every velocity is playable', () => {
  for (const groove of r.GROOVES) {
    for (const hit of r.grooveHits(groove)) {
      assert.ok(hit.vel > 0 && hit.vel <= 1,
        `${groove.name} / ${hit.part} step ${hit.step}: velocity ${hit.vel}`);
    }
  }
});

test('every part is one the audio path can play', () => {
  // The kit vocabulary, hard-coded here rather than imported, so a name added
  // to the library without a branch in loop.js fails instead of falling
  // through to whatever the last `else` happens to be.
  assert.deepEqual([...r.KIT_PARTS].sort(),
    ['crash', 'floor', 'hihat', 'hihatOpen', 'kick', 'snare', 'tom1', 'tom2'].sort());

  const loop = code('../js/play/loop.js');
  for (const part of r.KIT_PARTS) {
    assert.ok(loop.includes(`event.part === '${part}'`),
      `js/play/loop.js has no branch for '${part}' — it would play something else`);
  }
  for (const groove of r.GROOVES) {
    for (const part of Object.keys(groove.parts)) {
      assert.ok(r.KIT_PARTS.includes(part), `${groove.name}: '${part}' is not a kit part`);
    }
  }
});

test('every groove sounds something on step 0', () => {
  // Otherwise the playhead at 12 o'clock is telling the truth about nothing.
  for (const groove of r.GROOVES) {
    assert.ok(r.grooveHits(groove).some((hit) => hit.step === 0),
      `${groove.name}: bar one, beat one is silent`);
  }
});

test('every generated part really is the Euclidean rhythm it declares', () => {
  // The pattern strings are written out so the shape is visible in the source;
  // this is what stops a hand edit from quietly breaking the evenness. Only the
  // onset positions have to match — the characters may still name an accent or
  // a ghost, which the generator has no opinion about.
  for (const groove of r.GROOVES) {
    for (const line of groove.timeline) {
      const written = groove.parts[line.part];
      assert.ok(written, `${groove.name}: declares a ${line.part} timeline but has no pattern`);
      assert.deepEqual(
        onsetSteps(written),
        onsetSteps(r.euclidPattern(line.onsets, groove.steps, line.rotation)),
        `${groove.name} / ${line.part} is not E(${line.onsets},${groove.steps}) turned ${line.rotation}`);
    }
  }
});

test('the wheel is twelve grooves, four families of three', () => {
  assert.equal(r.GROOVES.length, 12);
  assert.equal(r.GROOVE_COUNT, 12);
  assert.equal(r.GROOVE_FAMILIES.length, 4);
  assert.equal(new Set(r.GROOVES.map((g) => g.name)).size, 12, 'a groove name appears twice');

  r.GROOVE_FAMILIES.forEach((family, index) => {
    const wedges = r.GROOVES.slice(index * 3, index * 3 + 3);
    for (const groove of wedges) {
      assert.equal(groove.family, family,
        `${groove.name} sits in the ${family} quadrant but calls itself ${groove.family}`);
    }
    // Position predicts the sound: clockwise inside a family is busier. This is
    // the claim the layout is built on, so it is asserted and not just written.
    const densities = wedges.map((g) => r.grooveDensity(g));
    for (let i = 1; i < densities.length; i++) {
      assert.ok(densities[i] > densities[i - 1],
        `${family}: ${wedges[i].name} (${densities[i]}) is not busier than ${wedges[i - 1].name} (${densities[i - 1]})`);
    }
  });
});

test('every groove names a tempo the stepper can reach', () => {
  // A genre carries its own tempo, so a value off the grid or outside the
  // stepper's range would be one the visitor can never step back to after
  // nudging it — and one the stepper silently clamps on the way in.
  for (const groove of r.GROOVES) {
    assert.ok(Number.isFinite(groove.bpm), `${groove.name}: no bpm`);
    assert.equal(groove.bpm % r.TEMPO_STEP, 0,
      `${groove.name}: ${groove.bpm} is off the ${r.TEMPO_STEP} BPM grid`);
    assert.ok(groove.bpm >= r.TEMPO_MIN && groove.bpm <= r.TEMPO_MAX,
      `${groove.name}: ${groove.bpm} is outside ${r.TEMPO_MIN}–${r.TEMPO_MAX}`);
  }
  // The wheel opens on the first wedge, so its tempo is the one the label shows
  // before anything is chosen.
  assert.equal(r.TEMPO_DEFAULT, r.GROOVES[0].bpm,
    'TEMPO_DEFAULT and ПУЛЬС disagree about where the wheel opens');
  // The ceiling exists for the fastest groove on the wheel; if that groove ever
  // slows down, the ceiling is free to come back down with it.
  assert.ok(Math.max(...r.GROOVES.map((g) => g.bpm)) <= r.TEMPO_MAX);
});

test('a family shares one grid, and a beat is whole steps', () => {
  for (const groove of r.GROOVES) {
    assert.ok(groove.beats > 0, `${groove.name}: no beats`);
    assert.equal(groove.steps % groove.beats, 0,
      `${groove.name}: ${groove.steps} steps do not divide into ${groove.beats} beats`);
  }
});

test('no groove double-strikes one part on one step, or overruns the budget', () => {
  for (const groove of r.GROOVES) {
    const hits = r.grooveHits(groove);
    const seen = new Set();
    for (const hit of hits) {
      const key = `${hit.part}:${hit.step}`;
      assert.ok(!seen.has(key), `${groove.name}: ${hit.part} hit twice on step ${hit.step}`);
      seen.add(key);
    }
    assert.ok(hits.length <= 32, `${groove.name}: ${hits.length} hits in a bar`);
    for (let i = 1; i < hits.length; i++) {
      assert.ok(hits[i].step >= hits[i - 1].step, `${groove.name}: hits are not step-sorted`);
    }
  }
});

test('grooveAt and stepGroove wrap the circle', () => {
  assert.equal(r.grooveAt(0), r.GROOVES[0]);
  assert.equal(r.grooveAt(12), r.GROOVES[0]);
  assert.equal(r.grooveAt(-1), r.GROOVES[11]);
  assert.equal(r.stepGroove(11, 1), 0);
  assert.equal(r.stepGroove(0, -1), 11);
});

// ============================================================
// TIME
// ============================================================

test('a bar is its beats at its tempo', () => {
  assert.equal(r.barSeconds(60, 4), 4);
  assert.equal(r.barSeconds(120, 4), 2);
  assert.equal(r.barSeconds(120, 3), 1.5);
  for (const groove of r.GROOVES) {
    const bar = r.barSeconds(92, groove.beats);
    assert.ok(Math.abs(r.stepSeconds(92, groove) * groove.steps - bar) < 1e-9,
      `${groove.name}: steps do not fill the bar`);
  }
});

test('step times run forward and never cross a bar line', () => {
  for (const groove of r.GROOVES) {
    const bar = r.barSeconds(92, groove.beats);
    assert.equal(r.stepTime(groove, 92, 0, 0), 0);
    assert.ok(Math.abs(r.stepTime(groove, 92, 3, 0) - 3 * bar) < 1e-9);
    for (let step = 1; step < groove.steps; step++) {
      assert.ok(r.stepTime(groove, 92, 2, step) > r.stepTime(groove, 92, 2, step - 1),
        `${groove.name}: step ${step} does not follow ${step - 1}`);
    }
    assert.ok(r.stepTime(groove, 92, 2, groove.steps - 1) < r.stepTime(groove, 92, 3, 0),
      `${groove.name}: the last step spills past the bar line`);
  }
});

test('step 0 sits at 12 o clock', () => {
  assert.equal(r.stepAngle(0, 16), 0);
  assert.equal(r.stepAngle(4, 16), 90);
  assert.equal(r.stepAngle(3, 12), 90);
});

test('the tempo stepper clamps and stays on its grid', () => {
  assert.equal(r.stepTempo(r.TEMPO_DEFAULT, 1), r.TEMPO_DEFAULT + r.TEMPO_STEP);
  assert.equal(r.stepTempo(r.TEMPO_DEFAULT, -1), r.TEMPO_DEFAULT - r.TEMPO_STEP);
  assert.equal(r.stepTempo(r.TEMPO_MIN, -1), r.TEMPO_MIN);
  assert.equal(r.stepTempo(r.TEMPO_MAX, 1), r.TEMPO_MAX);
  for (let bpm = r.TEMPO_MIN; bpm <= r.TEMPO_MAX; bpm += 1) {
    for (const direction of [-1, 1]) {
      const next = r.stepTempo(bpm, direction);
      assert.equal(next % r.TEMPO_STEP, 0, `${bpm} ${direction > 0 ? 'up' : 'down'} left the grid`);
      assert.ok(next >= r.TEMPO_MIN && next <= r.TEMPO_MAX, `${bpm} stepped out of range`);
    }
  }
});

test('a take rounds to whole bars, at least one and never past the cap', () => {
  const groove = r.GROOVES[1];          // РОК, four beats
  const bar = r.barSeconds(92, groove.beats);
  assert.equal(r.barsForDuration(bar * 2.4, 92, groove, 12), 2, 'rounds down');
  assert.equal(r.barsForDuration(bar * 2.6, 92, groove, 12), 3, 'rounds up');
  assert.equal(r.barsForDuration(0, 92, groove, 12), 1, 'never zero bars');
  assert.equal(r.barsForDuration(bar * 99, 92, groove, 12), Math.floor(12 / bar), 'capped');

  // The cap has to leave at least one whole bar at every tempo the wheel offers.
  for (let bpm = r.TEMPO_MIN; bpm <= r.TEMPO_MAX; bpm += r.TEMPO_STEP) {
    for (const g of r.GROOVES) {
      const bars = r.barsForDuration(999, bpm, g, 12);
      assert.ok(bars >= 1, `${g.name} at ${bpm}: no whole bar fits`);
      assert.ok(bars * r.barSeconds(bpm, g.beats) <= 12 + 1e-9,
        `${g.name} at ${bpm}: ${bars} bars overrun the 12 s cap`);
    }
  }
});

// ============================================================
// DYNAMICS
// ============================================================

test('a hit is quieter towards the rim, and never silent', () => {
  let previous = Infinity;
  for (let radius = 0; radius <= 1.0001; radius += 0.05) {
    const vel = r.drumHitVelocity({ radiusFraction: radius });
    assert.ok(vel <= previous, `radius ${radius}: got louder towards the rim`);
    assert.ok(vel >= r.DRUM_VEL_MIN, `radius ${radius}: below the floor`);
    assert.ok(vel <= 1, `radius ${radius}: above full`);
    previous = vel;
  }
  assert.equal(r.drumHitVelocity({ radiusFraction: 0 }), 1, 'dead centre is full');
  // Out-of-range input is clamped, not trusted.
  assert.equal(r.drumHitVelocity({ radiusFraction: 4 }), r.drumHitVelocity({ radiusFraction: 1 }));
  assert.equal(r.drumHitVelocity({ radiusFraction: -4 }), r.drumHitVelocity({ radiusFraction: 0 }));
});

test('a tap with no stroke behind it reads its place alone', () => {
  for (const radiusFraction of [0, 0.3, 0.7, 1]) {
    assert.equal(
      r.drumHitVelocity({ radiusFraction, speedPxPerMs: null }),
      r.drumHitVelocity({ radiusFraction }),
      `radius ${radiusFraction}: a null speed changed the result`);
  }
  // Dragging across the kit: slower is softer, and the floor still holds.
  const slow = r.drumHitVelocity({ radiusFraction: 0, speedPxPerMs: 0 });
  const fast = r.drumHitVelocity({ radiusFraction: 0, speedPxPerMs: 2 });
  assert.ok(slow < fast, 'a slow drag is not softer than a fast one');
  assert.ok(slow >= r.DRUM_VEL_MIN && fast <= 1);
  assert.ok(r.drumHitVelocity({ radiusFraction: 1, speedPxPerMs: 0 }) >= r.DRUM_VEL_MIN);
});

// ============================================================
// THE CONTRACTS THAT ARE NOT ARITHMETIC
// ============================================================

test('the comment stripper actually strips', () => {
  const stripped = code('../js/play/groove.js');
  assert.ok(!stripped.includes('It is not a step sequencer'), 'line comments survived');
  assert.ok(stripped.includes("import { audio }"), 'the stripper ate real code');
  assert.ok(stripped.includes("'../core/studio.js?v="), 'the stripper ate an import path');
});

test('a running groove cannot farm vibe, and only records when asked', () => {
  const groove = code('../js/play/groove.js');
  const loop = code('../js/play/loop.js');

  // A machine playing itself must never fill the VIBE meter — that is what
  // unlocks the loop pedal, so without this a groove buys its own pedal.
  assert.match(groove, /feedback:\s*false/,
    'groove.js must schedule with feedback: false');
  assert.doesNotMatch(groove, /feedback:\s*true/);

  // record: false is about the *audio route*, not the capture: it tells
  // playMusicalEvent this is a look-ahead event that may resume a context but
  // must never rebuild one. The capture is made separately, at the scheduled
  // time rather than at "now".
  assert.match(groove, /record:\s*false/, 'groove.js must schedule with record: false');
  assert.doesNotMatch(groove, /record:\s*true/);
  assert.match(groove, /captureLoopEvent\(event,\s*at\)/,
    'the groove must capture at the scheduled time, or a recorded bar lands early');

  // captureLoopEvent is a no-op unless the pedal is recording, which is the
  // whole guard — so it must be the real one, not a copy of the condition.
  assert.match(loop, /if \(!audio\.ctx \|\| \(loop\.state !== 'recording' && loop\.state !== 'overdubbing'\)\) return null;/,
    'captureLoopEvent no longer guards on the recording state');

  // ...and the reverse: clearing the loop must not stop the groove.
  const clear = loop.slice(loop.indexOf('export function clearRecordedLoop'));
  assert.doesNotMatch(clear.slice(0, clear.indexOf('\n}')), /groove/i,
    'clearRecordedLoop touches the groove');

  // The groove parks its scheduled visuals in its own bucket, or clearing the
  // loop swallows a look-ahead window of its animation.
  assert.match(groove, /visualBucket:/, 'groove.js must pass its own visualBucket');
  assert.match(loop, /visualBucket = loop\.visualTimers/, 'playMusicalEvent lost the visualBucket option');
});

test('nothing on the kit moves unless it is sounding', () => {
  const groove = code('../js/play/groove.js');
  // A drum that recoils in silence reads as broken, so the frame loop draws the
  // playhead and the bar ticks and nothing else: every recoil arrives through a
  // scheduled event, which by definition also made a noise.
  const fn = groove.slice(groove.indexOf('export function updateGroovePlayhead'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.doesNotMatch(body, /runMusicalVisual|playMusicalEvent/,
    'updateGroovePlayhead animates the kit directly — it would do so without sound');
  assert.match(body, /if \(!playing\) return;/,
    'updateGroovePlayhead must stand down entirely while stopped');
});

test('choosing a genre brings its tempo, unless the loop has locked it', () => {
  const groove = code('../js/play/groove.js');
  const fn = groove.slice(groove.indexOf('function chooseGroove'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.match(body, /if \(!hooks\.loopHasContent\(\)\) applyTempo\(tempoFor\(next\)\);/,
    'chooseGroove no longer carries the genre tempo, or no longer checks the lock');

  // Both ways in must go through applyTempo: it is the only thing that holds
  // the bar's phase across the change, and a tempo written straight to `bpm`
  // makes the beat jump under a groove that is merely paused.
  const apply = groove.slice(groove.indexOf('function applyTempo'));
  assert.match(apply.slice(0, apply.indexOf('\n}')), /audioEpoch = audio\.ctx\.currentTime - phase \* currentBar\(\)/,
    'applyTempo no longer re-pins the bar to hold the phase');
  for (const name of ['chooseGroove', 'setTempo']) {
    const start = groove.indexOf(`function ${name}`);
    assert.doesNotMatch(groove.slice(start, groove.indexOf('\n}', start)), /\bbpm = /,
      `${name} writes bpm directly instead of going through applyTempo`);
  }
});

test('a tempo the visitor set outlives leaving the groove and coming back', () => {
  const groove = code('../js/play/groove.js');
  const body = (name) => {
    const start = groove.indexOf(`function ${name}`);
    assert.ok(start >= 0, `js/play/groove.js has no ${name}`);
    return groove.slice(start, groove.indexOf('\n}', start));
  };

  // Stepping the tempo is the visitor saying "this style, at *this* speed".
  // Without the record, choosing the wedge again — which is also how a stopped
  // groove is restarted — would put the genre's own tempo straight back, and
  // the stepper would be a control that undoes itself the moment it is used.
  assert.match(body('setTempo'), /tempoByGroove\.set\(grooveIndex, bpm\)/,
    'setTempo no longer remembers the visitor tempo for this groove');
  assert.match(body('chooseGroove'), /applyTempo\(tempoFor\(next\)\)/,
    'chooseGroove takes the genre tempo directly and would overwrite a chosen one');
  assert.match(groove, /tempoByGroove\.get\(index\) \?\? grooveAt\(index\)\.bpm/,
    'tempoFor must prefer the visitor tempo and fall back to the genre default');

  // Per groove, or re-tuning one style would drag every other one with it.
  assert.match(groove, /const tempoByGroove = new Map\(\)/);
  assert.match(body('storeGroove'), /tempos: Object\.fromEntries\(tempoByGroove\)/,
    'the chosen tempos are not persisted alongside the groove');
});

test('a switch repairs the audio route and never leaves the bar on a dead clock', () => {
  const groove = code('../js/play/groove.js');
  const body = (name) => {
    const start = groove.indexOf(`function ${name}`);
    assert.ok(start >= 0, `js/play/groove.js has no ${name}`);
    return groove.slice(start, groove.indexOf('\n}', start));
  };

  // A wedge is a trusted gesture, and only a gesture may rebuild a context that
  // was marked for recovery. Without this, every switch after a blur or a tab
  // away schedules into a dead route and the wheel plays nothing.
  assert.match(body('chooseGroove'), /hooks\.activateAudioForSound\(\)/,
    'chooseGroove no longer recovers audio — a switch after a blur will be silent');
  assert.match(body('chooseGroove'), /scheduleAhead\(\)/,
    'a switch waits for the next tick, which can drop the first hit of the new groove');

  // The epoch is a reading of one context's clock. A rebuilt context counts
  // from zero, so an epoch from the old one is in the future of the new one and
  // every hit is scheduled for a bar that never comes.
  const pin = body('pinBar');
  assert.match(pin, /epochGeneration !== audio\.contextGeneration/,
    'pinBar no longer notices a rebuilt context');
  assert.match(pin, /scheduled\.clear\(\)/,
    're-pinning must drop keys minted against the old bar zero, or they silence the new one');
  assert.match(body('scheduleAhead'), /pinBar\(\)/,
    'the scheduler must re-pin, since a rebuild can land between any two ticks');
});

test('the loop locks to the groove bar when one is running', () => {
  const loop = code('../js/play/loop.js');
  // Both hooks default to null, which is what leaves the loop free-running.
  assert.match(loop, /grooveBarSeconds:\s*\(\)\s*=>\s*null/);
  assert.match(loop, /grooveDownbeatAt:\s*\(\)\s*=>\s*null/);
  // And loop.js must never import the groove: it sits below it, so an upward
  // import is a silent `undefined` rather than an error.
  assert.doesNotMatch(loop, /from '\.\/groove\.js/, 'loop.js imports upward from groove.js');
});

test('rhythm.js stands alone, so Node can load it', () => {
  assert.ok(!/^\s*import\s/m.test(source('../js/play/rhythm.js')),
    'js/play/rhythm.js imports something — tests/load-module.mjs cannot load it');
  assert.ok(!/^\s*import\s/m.test(source('../js/play/harmony.js')),
    'js/play/harmony.js imports something — tests/load-module.mjs cannot load it');
});
