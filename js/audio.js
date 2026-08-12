// ============================================================
// ART VIBE — WebAudio synth engine (no samples, all synthesized)
// ============================================================

export class AudioEngine {
  static BUS_KEYS = ['drums', 'piano', 'guitar', 'mic'];
  static BUS_LEVEL_MAX = 2;

  constructor() {
    this.ctx = null;
    this.master = null;
    this.buses = { drums: null, piano: null, guitar: null, mic: null };
    this.levels = { drums: 1, piano: 1, guitar: 0.6, mic: 1 };
    this.muted = false;
    this._noise = null;
    this._ksCache = new Map();
    this._guitarVariant = 0;
    this._activeGuitarStrings = new Map();
    this._guitarPrewarmQueue = [];
    this._guitarPrewarmScheduled = false;
    this._activeVocals = new Set();
    this._activePianoVoices = new Set();
    this._contextGeneration = 0;
    this._needsRecovery = false;
    this._resumeFailures = 0;
    this._resumeWatchContext = null;
    this._lastRebuildAt = -Infinity;
    this._clockSample = null;
    this._clockStalled = false;
    this._recoveryReason = null;
    this._lastRebuildReason = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this._configureAudioSession();
    try {
      this.ctx = new AC({ latencyHint: 'interactive' });
    } catch (_) {
      this.ctx = new AC();
    }
    const context = this.ctx;
    this._contextGeneration++;
    this._primed = false;

    this.master = this.ctx.createGain();
    // Honor mute chosen before the context existed (HUD sound button).
    this.master.gain.value = this.muted ? 0 : 0.9;

    for (const key of AudioEngine.BUS_KEYS) {
      const bus = this.ctx.createGain();
      bus.gain.value = this.levels[key];
      if (key === 'guitar') {
        // Compact acoustic-body colour: a low shelf into two broad resonances.
        const bodyLow = this.ctx.createBiquadFilter();
        bodyLow.type = 'lowshelf';
        bodyLow.frequency.value = 145;
        bodyLow.gain.value = 3.5;
        const bodyMid = this.ctx.createBiquadFilter();
        bodyMid.type = 'peaking';
        bodyMid.frequency.value = 235;
        bodyMid.Q.value = 0.9;
        bodyMid.gain.value = 2.4;
        const bodyTop = this.ctx.createBiquadFilter();
        bodyTop.type = 'peaking';
        bodyTop.frequency.value = 920;
        bodyTop.Q.value = 0.7;
        bodyTop.gain.value = 1.4;
        bus.connect(bodyLow).connect(bodyMid).connect(bodyTop).connect(this.master);
      } else {
        bus.connect(this.master);
      }
      this.buses[key] = bus;
    }

    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;

    this.master.connect(comp).connect(this.ctx.destination);

    // shared 2s white-noise buffer
    const len = this.ctx.sampleRate * 2;
    this._noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this._noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Mobile / Telegram WebViews often re-suspend after backgrounding.
    let hasRun = context.state === 'running';
    context.addEventListener('statechange', () => {
      if (this.ctx !== context) return;
      if (context.state === 'running') {
        hasRun = true;
        this._resumeFailures = 0;
        this._seedContextClock(context);
        this._clearResumeWatch();
      } else {
        this._primed = false;
        // Once output has worked, an unsolicited suspend/interruption/close can
        // leave iOS and in-app WebViews with a dead route that still looks valid.
        if (hasRun || context.state === 'interrupted' || context.state === 'closed') {
          this.markForRecovery(`context-${context.state}`);
        }
      }
    });
  }

  get contextGeneration() {
    return this._contextGeneration;
  }

  debugState() {
    return {
      contextState: this.ctx?.state ?? 'uninitialized',
      generation: this._contextGeneration,
      muted: this.muted,
      recoveryPending: this._needsRecovery,
      recoveryReason: this._recoveryReason,
      lastRebuildReason: this._lastRebuildReason,
      resumeFailures: this._resumeFailures,
      currentTime: this.ctx?.currentTime ?? null,
      clockStalled: this._clockStalled,
      activePianoVoices: this._activePianoVoices.size,
      audioSessionState: navigator.audioSession?.state ?? 'unsupported',
      audioSessionType: navigator.audioSession?.type ?? 'unsupported',
      userActivationActive: navigator.userActivation?.isActive ?? 'unsupported',
      userActivationSeen: navigator.userActivation?.hasBeenActive ?? 'unsupported',
    };
  }

  _configureAudioSession() {
    try {
      const session = navigator.audioSession;
      if (!session) return;
      // Art Vibe is a play-along instrument, not exclusive media playback.
      // `ambient` lets supporting mobile platforms mix our instruments with
      // Spotify, Apple Music, and other audio already playing on the device.
      if (session.type !== 'ambient') session.type = 'ambient';
      const recoverInterruptedSession = () => {
        // "inactive" is normal between notes. Only an actual interruption is
        // evidence that the OS route must be rebuilt on the next gesture.
        if (session.state === 'interrupted') {
          this.markForRecovery('audio-session-interrupted');
        }
      };
      if (!this._audioSessionBound && session.addEventListener) {
        session.addEventListener('statechange', recoverInterruptedSession);
        this._audioSessionBound = true;
      }
      // The state may already be interrupted before the listener is attached.
      recoverInterruptedSession();
    } catch (_) { /* experimental API or WebView may reject assignment */ }
  }

  _seedContextClock(context = this.ctx, wallTime = performance.now()) {
    if (!context || context.state !== 'running' || !Number.isFinite(context.currentTime)) {
      this._clockSample = null;
      this._clockStalled = false;
      return;
    }
    this._clockSample = { context, wallTime, audioTime: context.currentTime };
    this._clockStalled = false;
  }

  /**
   * WebKit can leave state="running" while currentTime and the hardware route
   * are frozen. Sample over a generous wall-clock interval so the next trusted
   * gesture can rebuild instead of trusting the stale state string.
   */
  _checkContextClock(wallTime = performance.now()) {
    const context = this.ctx;
    if (!context || context.state !== 'running' || !Number.isFinite(context.currentTime)) {
      this._clockSample = null;
      this._clockStalled = false;
      return false;
    }

    const previous = this._clockSample;
    if (!previous || previous.context !== context) {
      this._seedContextClock(context, wallTime);
      return false;
    }

    const wallElapsed = wallTime - previous.wallTime;
    if (wallElapsed < 300) return this._clockStalled;

    const audioElapsed = context.currentTime - previous.audioTime;
    this._clockSample = { context, wallTime, audioTime: context.currentTime };
    this._clockStalled = audioElapsed < 0.02;
    if (this._clockStalled) this.markForRecovery('context-clock-stalled');
    return this._clockStalled;
  }

  /** Tiny silent buffer start — must run inside a user-gesture turn on iOS. */
  _prime() {
    if (!this.ctx || this._primed) return;
    try {
      const buf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
      this._primed = true;
    } catch (_) { /* ignore */ }
  }

  _resetContext({ close = false } = {}) {
    const previous = this.ctx;
    this._clearResumeWatch();
    for (const voice of [...this._activeVocals]) voice.cancel?.();
    this._activeVocals.clear();
    for (const voice of [...this._activePianoVoices]) voice.cancel?.();
    this._activePianoVoices.clear();
    this.ctx = null;
    this.master = null;
    this.buses = { drums: null, piano: null, guitar: null, mic: null };
    this._noise = null;
    this._ksCache.clear();
    this._activeGuitarStrings.clear();
    this._guitarPrewarmQueue.length = 0;
    this._guitarPrewarmScheduled = false;
    this._primed = false;
    this._resumeFailures = 0;
    this._needsRecovery = false;
    this._recoveryReason = null;
    this._clockSample = null;
    this._clockStalled = false;
    if (close && previous?.state !== 'closed') {
      try {
        previous.close()?.catch?.(() => {});
      } catch (_) { /* closing a broken WebView context may throw */ }
    }
  }

  /**
   * Mobile browsers can report a running context while its output route is dead
   * after Control Center, a phone call, tab backgrounding, or WebView restore.
   * Rebuilding on the next trusted gesture is the only dependable recovery.
   */
  markForRecovery(reason = 'lifecycle') {
    if (!this.ctx) return;
    this._needsRecovery = true;
    this._recoveryReason = reason;
    this._primed = false;
  }

  unlock() {
    this._configureAudioSession();
    const clockStalled = this._checkContextClock();

    const stuck = this.ctx
      && this.ctx.state !== 'running'
      && this._resumeFailures > 0;
    const unusable = this.ctx?.state === 'closed';
    const needsRebuild = this.ctx && (this._needsRecovery || clockStalled || stuck || unusable);
    // A single touch can emit both pointerdown and touchstart. Deduplicate only
    // the destructive rebuild, never the recovery request itself.
    if (needsRebuild && performance.now() - this._lastRebuildAt >= 80) {
      const rebuildReason = this._recoveryReason
        || (clockStalled ? 'context-clock-stalled' : (stuck ? 'resume-blocked' : 'context-closed'));
      this._resetContext({ close: true });
      this._lastRebuildReason = rebuildReason;
      this._lastRebuildAt = performance.now();
    }
    this.init();
    return this.resume();
  }

  _clearResumeWatch() {
    clearTimeout(this._resumeRetry1);
    clearTimeout(this._resumeRetry2);
    clearTimeout(this._resumeCheck);
    this._resumeRetry1 = null;
    this._resumeRetry2 = null;
    this._resumeCheck = null;
    this._resumeWatchContext = null;
  }

  /**
   * Unlock / wake the AudioContext. Fire-and-forget resume() was leaving mobile
   * WebViews stuck suspended (silent until hard refresh).
   */
  resume() {
    if (!this.ctx || this.ctx.state === 'closed') {
      this._resetContext();
      this.init();
    }
    if (!this.ctx) return Promise.resolve(false);
    this._configureAudioSession();
    this._prime();
    if (this.ctx.state === 'running') {
      const stalled = this._checkContextClock();
      this._resumeFailures = 0;
      return Promise.resolve(!stalled && !this._needsRecovery);
    }

    const context = this.ctx;
    const recordFailure = () => {
      if (this.ctx !== context || context.state === 'running' || context.state === 'closed') return;
      this._resumeFailures = Math.max(1, this._resumeFailures + 1);
      this.markForRecovery('resume-blocked');
      this._primed = false;
    };
    const wake = () => {
      if (this.ctx !== context || context.state === 'closed') return Promise.resolve(false);
      if (context.state === 'running') {
        const stalled = this._checkContextClock();
        return Promise.resolve(!stalled && !this._needsRecovery);
      }
      this._prime();
      return context.resume()
        .then(() => {
          // A delayed resume from a discarded context must not mutate the
          // replacement context's health counters or retry window.
          if (this.ctx !== context) return false;
          const running = context.state === 'running';
          if (!running) {
            recordFailure();
            return false;
          }

          const stalled = this._checkContextClock();
          const ready = !stalled && !this._needsRecovery;
          if (ready) {
            this._resumeFailures = 0;
            this._seedContextClock(context);
            this._clearResumeWatch();
          }
          return ready;
        })
        .catch(() => {
          recordFailure();
          return false;
        });
    };

    const pending = wake();
    // Start one context-scoped retry window. Repeated notes must not postpone
    // failure detection forever while the visitor keeps trying to make sound.
    if (this._resumeWatchContext !== context) {
      this._clearResumeWatch();
      this._resumeWatchContext = context;
      this._resumeRetry1 = setTimeout(() => { wake(); }, 120);
      this._resumeRetry2 = setTimeout(() => { wake(); }, 450);
      this._resumeCheck = setTimeout(recordFailure, 850);
    }
    return pending;
  }

  setMuted(m) {
    this.muted = Boolean(m);
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.muted ? 0 : 0.9, t);
    if (this.muted) {
      for (const voice of [...this._activeVocals]) voice.cancel?.();
      this.mutePiano();
      this.muteGuitar();
    } else {
      this.resume();
    }
  }

  getLevel(kind) {
    return this.levels[kind] ?? 1;
  }

  setLevel(kind, value) {
    if (!AudioEngine.BUS_KEYS.includes(kind)) return;
    const level = Math.max(0, Math.min(AudioEngine.BUS_LEVEL_MAX, Number(value)));
    this.levels[kind] = Number.isFinite(level) ? level : 1;
    if (this.buses[kind] && this.ctx) {
      const t = this.ctx.currentTime;
      this.buses[kind].gain.cancelScheduledValues(t);
      this.buses[kind].gain.setValueAtTime(this.levels[kind], t);
    }
    if (kind === 'mic' && this.levels.mic <= 0.001) {
      for (const voice of [...this._activeVocals]) voice.cancel?.();
    }
  }

  _bus(kind) {
    return this.buses[kind] || this.master;
  }

  _silent() {
    return !this.ctx || this.muted;
  }

  isRunning() {
    return Boolean(this.ctx && this.ctx.state === 'running');
  }

  _env(gainNode, t, peak, attack, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  _at(at) {
    return Number.isFinite(at) ? Math.max(this.ctx.currentTime, at) : this.ctx.currentTime;
  }

  _noiseSrc(t, dur) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise;
    src.loop = true;
    src.start(t);
    src.stop(t + dur + 0.05);
    return src;
  }

  /** Short route-check melody that bypasses per-instrument faders. */
  testTone() {
    if (this._silent() || !this.master) return false;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 · E5 · G5 · C6
    const noteLength = 0.16;
    const noteGap = 0.03;
    osc.type = 'sine';
    notes.forEach((frequency, index) => {
      const start = t + index * (noteLength + noteGap);
      const end = start + noteLength;
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.24, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
    });
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + notes.length * (noteLength + noteGap));
    return true;
  }

  // ---------------- DRUMS ----------------

  kick(vel = 1, at = null) {
    if (this._silent()) return;
    const t = this._at(at);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    this._env(g, t, 0.95 * vel, 0.004, 0.34);
    osc.connect(g).connect(this._bus('drums'));
    osc.start(t); osc.stop(t + 0.4);

    // beater click
    const n = this._noiseSrc(t, 0.03);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1200;
    const ng = this.ctx.createGain();
    this._env(ng, t, 0.25 * vel, 0.001, 0.03);
    n.connect(hp).connect(ng).connect(this._bus('drums'));
  }

  snare(vel = 1, at = null) {
    if (this._silent()) return;
    const t = this._at(at);
    const n = this._noiseSrc(t, 0.22);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8;
    const ng = this.ctx.createGain();
    this._env(ng, t, 0.55 * vel, 0.002, 0.19);
    n.connect(bp).connect(ng).connect(this._bus('drums'));

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(195, t);
    this._env(g, t, 0.32 * vel, 0.002, 0.1);
    osc.connect(g).connect(this._bus('drums'));
    osc.start(t); osc.stop(t + 0.15);
  }

  hihat(open = false, vel = 1, at = null) {
    if (this._silent()) return;
    const t = this._at(at);
    const dur = open ? 0.32 : 0.06;
    const n = this._noiseSrc(t, dur);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 7800;
    const g = this.ctx.createGain();
    this._env(g, t, 0.28 * vel, 0.001, dur);
    n.connect(hp).connect(g).connect(this._bus('drums'));
  }

  crash(vel = 1, at = null) {
    if (this._silent()) return;
    const t = this._at(at);
    const n = this._noiseSrc(t, 1.4);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 4600;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 8200; bp.Q.value = 1.6;
    const g = this.ctx.createGain();
    this._env(g, t, 0.4 * vel, 0.004, 1.3);
    n.connect(hp).connect(bp).connect(g).connect(this._bus('drums'));
  }

  tom(freq = 120, vel = 1, at = null) {
    if (this._silent()) return;
    const t = this._at(at);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.4, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.72, t + 0.16);
    this._env(g, t, 0.6 * vel, 0.004, 0.42);
    osc.connect(g).connect(this._bus('drums'));
    osc.start(t); osc.stop(t + 0.5);
  }

  // ---------------- PIANO ----------------

  startPiano(freq, vel = 1, at = null) {
    if (this._silent()) return null;
    const t = this._at(at);
    const peak = Math.max(0.0001, 0.5 * vel);
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(peak, t + 0.006);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(4200, freq * 6), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(600, freq * 1.5), t + 1.1);
    out.connect(lp).connect(this._bus('piano'));

    const partials = [
      { mult: 1, type: 'triangle', gain: 1 },
      { mult: 2, type: 'sine', gain: 0.32 },
      { mult: 3.01, type: 'sine', gain: 0.1 },
    ];
    const sources = [];
    for (const p of partials) {
      const o = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      o.type = p.type;
      o.frequency.value = freq * p.mult;
      o.detune.value = (Math.random() - 0.5) * 4;
      og.gain.value = p.gain;
      o.connect(og).connect(out);
      o.start(t);
      sources.push(o);
    }

    const voice = {
      released: false,
      cleanupTimer: null,
      release: (atTime = null, release = 0.34) => {
        if (voice.released || !this.ctx) return;
        voice.released = true;
        clearTimeout(voice.cleanupTimer);
        const now = this.ctx.currentTime;
        const releaseAt = Number.isFinite(atTime) ? Math.max(now, atTime) : now;
        try {
          // Live finger-up: hold the current level, then fade.
          // Ahead-of-time (loop playback): pin the sustain peak at releaseAt.
          // cancelAndHoldAtTime + an early exponentialRamp attaches to the
          // attack peak in Chromium and decays across the whole hold window.
          if (releaseAt > now + 0.02) {
            out.gain.cancelScheduledValues(releaseAt);
            out.gain.setValueAtTime(peak, releaseAt);
          } else if (out.gain.cancelAndHoldAtTime) {
            out.gain.cancelAndHoldAtTime(releaseAt);
          } else {
            out.gain.cancelScheduledValues(releaseAt);
            out.gain.setValueAtTime(Math.max(0.0001, out.gain.value || peak), releaseAt);
          }
          out.gain.exponentialRampToValueAtTime(0.0001, releaseAt + release);
          for (const source of sources) source.stop(releaseAt + release + 0.04);
        } catch (_) { /* oscillator may already be stopped */ }
        voice.cleanupTimer = setTimeout(() => {
          this._activePianoVoices.delete(voice);
        }, Math.max(0, (releaseAt + release + 0.08 - now) * 1000));
      },
      cancel: () => {
        if (voice.released || !this.ctx) return;
        voice.released = true;
        clearTimeout(voice.cleanupTimer);
        const now = this.ctx.currentTime;
        try {
          out.gain.cancelScheduledValues(now);
          out.gain.setValueAtTime(Math.max(0.0001, out.gain.value || 0.0001), now);
          out.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
          for (const source of sources) source.stop(now + 0.06);
        } catch (_) { /* oscillator may already be stopped */ }
        this._activePianoVoices.delete(voice);
      },
    };
    this._activePianoVoices.add(voice);
    return voice;
  }

  mutePiano(at = null) {
    if (!this.ctx) return;
    const t = this._at(at);
    for (const voice of [...this._activePianoVoices]) voice.release?.(t, 0.06);
  }

  piano(freq, vel = 1, at = null, duration = 1.6) {
    const startAt = this.ctx ? this._at(at) : null;
    const voice = this.startPiano(freq, vel, startAt);
    if (voice) voice.release(startAt + Math.max(0.08, duration));
    return voice;
  }

  // ---------------- GUITAR (Karplus–Strong) ----------------

  _ksBuffer(freq, variant = 0, stringIndex = 0) {
    const pitchKey = Math.round(freq * 10);
    const key = `${pitchKey}:${variant}:${stringIndex}`;
    if (this._ksCache.has(key)) return this._ksCache.get(key);
    const sr = this.ctx.sampleRate;
    const period = Math.max(2, Math.round(sr / freq));
    const dur = 1.65 + (5 - Math.max(0, Math.min(5, stringIndex))) * 0.11;
    const len = Math.floor(sr * dur);
    const buf = this.ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const ring = new Float32Array(period);
    let seed = ((pitchKey * 2654435761) ^ ((variant + 1) * 2246822519) ^ ((stringIndex + 1) * 3266489917)) >>> 0;
    const random = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 4294967295;
    };
    for (let i = 0; i < period; i++) ring[i] = random() * 2 - 1;
    let idx = 0;
    const damping = 0.9969 - Math.max(0, Math.min(5, stringIndex)) * 0.00016;
    for (let i = 0; i < len; i++) {
      const cur = ring[idx];
      const nxt = ring[(idx + 1) % period];
      ring[idx] = damping * 0.5 * (cur + nxt);
      const tail = i > len - 768 ? (len - i) / 768 : 1;
      out[i] = cur * tail;
      idx = (idx + 1) % period;
    }
    this._ksCache.set(key, buf);
    return buf;
  }

  prewarmGuitar(stringPitches = []) {
    if (!this.ctx || !Array.isArray(stringPitches)) return;
    const queued = new Set(this._guitarPrewarmQueue.map((item) => item.key));
    for (const pitch of stringPitches) {
      const freq = Number(pitch.freqHz ?? pitch.freq);
      const stringIndex = Number(pitch.stringIndex ?? 0);
      if (!Number.isFinite(freq)) continue;
      for (let variant = 0; variant < 2; variant++) {
        const key = `${Math.round(freq * 10)}:${variant}:${stringIndex}`;
        if (this._ksCache.has(key) || queued.has(key)) continue;
        queued.add(key);
        this._guitarPrewarmQueue.push({ key, freq, stringIndex, variant });
      }
    }
    if (this._guitarPrewarmScheduled || !this._guitarPrewarmQueue.length) return;
    this._guitarPrewarmScheduled = true;
    const work = (deadline) => {
      this._guitarPrewarmScheduled = false;
      let processed = 0;
      while (this._guitarPrewarmQueue.length && processed < 2) {
        if (processed > 0 && deadline?.timeRemaining && deadline.timeRemaining() < 2) break;
        const item = this._guitarPrewarmQueue.shift();
        this._ksBuffer(item.freq, item.variant, item.stringIndex);
        processed++;
      }
      if (!this._guitarPrewarmQueue.length) return;
      this._guitarPrewarmScheduled = true;
      if ('requestIdleCallback' in window) window.requestIdleCallback(work, { timeout: 80 });
      else setTimeout(() => work(null), 12);
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(work, { timeout: 80 });
    else setTimeout(() => work(null), 12);
  }

  _releaseGuitarVoice(voice, at = this.ctx?.currentTime ?? 0, release = 0.018) {
    if (!voice || voice.released || !this.ctx) return;
    voice.released = true;
    const t = Math.max(at, this.ctx.currentTime);
    try {
      voice.gain.gain.cancelScheduledValues(t);
      voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value), t);
      voice.gain.gain.exponentialRampToValueAtTime(0.0001, t + release);
      voice.source.stop(t + release + 0.025);
    } catch (_) { /* source may already be stopped */ }
  }

  muteGuitar(at = null) {
    if (!this.ctx) return;
    const t = this._at(at);
    for (const voice of this._activeGuitarStrings.values()) {
      this._releaseGuitarVoice(voice, t, 0.025);
    }
    this._activeGuitarStrings.clear();
  }

  pluck(freq, vel = 1, at = null, options = {}) {
    if (this._silent()) return;
    const t = this._at(at);
    const stringIndex = Math.max(0, Math.min(5, Number(options.stringIndex ?? 0)));
    // Live fretting tracks voices so muteGuitar() can cut them. Loop playback
    // must NOT register here — leaving focus / falling would cancel lookahead notes
    // that stay marked as scheduled and never replay that cycle.
    const track = options.track !== false;
    if (track) {
      const previous = this._activeGuitarStrings.get(stringIndex);
      if (previous) this._releaseGuitarVoice(previous, t);
    }

    const src = this.ctx.createBufferSource();
    const variant = this._guitarVariant++ % 2;
    src.buffer = this._ksBuffer(freq, variant, stringIndex);
    src.detune.value = (Math.random() - 0.5) * (2.2 + (1 - vel) * 1.8);
    const g = this.ctx.createGain();
    const level = 0.18 + Math.max(0, Math.min(1.2, vel)) * 0.52;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.0025);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.max(1800, 2600 + vel * 4300 - stringIndex * 120);
    lp.Q.value = 0.45;
    src.connect(lp).connect(g);
    if (this.ctx.createStereoPanner) {
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = (stringIndex - 2.5) / 12;
      g.connect(pan).connect(this._bus('guitar'));
    } else {
      g.connect(this._bus('guitar'));
    }
    src.start(t);
    src.stop(t + src.buffer.duration + 0.04);
    const voice = { source: src, gain: g, released: false };
    if (track) {
      this._activeGuitarStrings.set(stringIndex, voice);
      src.onended = () => {
        if (this._activeGuitarStrings.get(stringIndex) === voice) {
          this._activeGuitarStrings.delete(stringIndex);
        }
      };
    }
    return voice;
  }

  strum(strings, vel = 1, at = null, options = {}) {
    if (this._silent()) return;
    const base = this._at(at);
    const events = (strings || []).map((item, index) => (
      typeof item === 'number'
        ? { freqHz: item, stringIndex: index, offsetMs: index * 22 }
        : item
    ));
    for (const stringEvent of events) {
      this.pluck(
        stringEvent.freqHz,
        vel * (0.9 + Math.random() * 0.16),
        base + Math.max(0, stringEvent.offsetMs ?? 0) / 1000,
        { stringIndex: stringEvent.stringIndex, track: options.track },
      );
    }
  }

  // ---------------- MIC / VOCAL ----------------

  /**
   * A sung note. `formants` is a pair of `[frequency, Q, gain]` bandpass peaks
   * — the engine executes a vowel, it does not know which vowel it is. The
   * table lives in js/play/voice.js, where the Node tests can reach it and
   * where a wrong peak is a caught mistake rather than a silent one.
   *
   * The returned voice can be re-pitched and re-shaped while it sounds. That
   * is the whole difference between this and every other instrument here: a
   * key, a string and a drum head are all done deciding once they are struck.
   */
  startVocal(freq = 329.63, formants = [[800, 5, 1], [1200, 7, 0.45]], vel = 1, at = null) {
    if (this._silent()) return null;
    const t = this._at(at);
    const peak = Math.max(0.0001, 0.26 * vel);
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(peak, t + 0.035);
    out.connect(this._bus('mic'));

    const filters = formants.map(([frequency, q, gain]) => {
      const filter = this.ctx.createBiquadFilter();
      const formantGain = this.ctx.createGain();
      filter.type = 'bandpass';
      filter.frequency.value = frequency;
      filter.Q.value = q;
      formantGain.gain.value = gain;
      filter.connect(formantGain).connect(out);
      return { filter, formantGain };
    });

    // Vibrato modulates `detune`, in CENTS, not `frequency` in hertz.
    //
    // Hertz was the old shape and it was survivable while the voice had five
    // fixed notes; the ribbon spans nineteen semitones and glides through all
    // of them, and a constant ±5.5 Hz is ±36 cents at the bottom of that range
    // and ±12 at the top — three times as deep on a low note as a high one.
    // Worse, deep pitch modulation through a resonant formant turns into
    // *amplitude* modulation: measured at 19 dB of level wobble on a note that
    // was not even moving, which is the roughness under a held tone.
    // Cents keep it even across the range, and 18 is a singer's vibrato rather
    // than a siren's.
    const vibrato = this.ctx.createOscillator();
    const vibratoGain = this.ctx.createGain();
    vibrato.frequency.value = 5.5;
    vibratoGain.gain.setValueAtTime(4, t);
    vibratoGain.gain.linearRampToValueAtTime(18, t + 0.9);
    vibrato.connect(vibratoGain);

    const sources = [];
    const tones = [];
    for (const [type, level, detune] of [['sawtooth', 0.55, -4], ['triangle', 0.42, 4]]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      gain.gain.value = level;
      // Into `detune`, which is cents and sums with the static value above.
      vibratoGain.connect(osc.detune);
      osc.connect(gain);
      for (const { filter } of filters) gain.connect(filter);
      osc.start(t);
      sources.push(osc);
      tones.push(osc);
    }
    vibrato.start(t);
    sources.push(vibrato);

    // Breath, and only at the onset. A sung note starts with air moving before
    // it starts with a pitch, which is the one thing the voice was missing next
    // to the drums and the guitar — but it has to go to **silence**, not to a
    // trace. Held at a trace it is a hiss under every note, and a long note
    // then sounds like a fault rather than like breath.
    const breath = this.ctx.createBufferSource();
    breath.buffer = this._noise;
    breath.loop = true;
    const breathFilter = this.ctx.createBiquadFilter();
    breathFilter.type = 'highpass';
    breathFilter.frequency.value = 1800;
    const breathGain = this.ctx.createGain();
    breathGain.gain.setValueAtTime(0.0001, t);
    breathGain.gain.linearRampToValueAtTime(0.035 * vel, t + 0.03);
    breathGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    breath.connect(breathFilter).connect(breathGain).connect(out);
    breath.start(t);
    sources.push(breath);

    // What has been *scheduled*, which is not what the params read: a ramp
    // aimed into the future leaves `.value` on the old number until it gets
    // there. Glides chain off each other, so they have to chain off this.
    let scheduledFreq = freq;
    let scheduledFormants = formants;

    // A finger and a recording want opposite things from an AudioParam, and
    // using one mechanism for both is what made the ribbon crackle.
    //
    // A *recorded* breakpoint has to ARRIVE at an exact time, so it cancels
    // what was scheduled and ramps to land on the beat. A *finger* has no
    // arrival time at all — it just moves, sixty times a second — and doing
    // the same thing for it meant cancelling and re-aiming an in-flight ramp
    // on every frame, at `currentTime`, which is a moment the audio thread has
    // already rendered. Automation written into the past gets clamped, and the
    // clamp is a step in the parameter: a click. Measured at ~3x the
    // sample-to-sample discontinuity of the same sweep rendered offline, on
    // the pitch axis as well as the vowel one.
    //
    // `setTargetAtTime` is the automation built for a control that is being
    // moved: it never cancels anything, it starts from wherever the value
    // actually is, and it is continuous by construction. Re-aiming it is just
    // moving the target.
    const LIVE_LOOKAHEAD = 0.012;

    /** A finger moved. Continuous, no cancellation, no arrival time. */
    const followParam = (param, target, glide) => {
      param.setTargetAtTime(target, this.ctx.currentTime + LIVE_LOOKAHEAD, Math.max(0.004, glide / 3));
    };

    /** A recorded breakpoint. Must land exactly on `when`. */
    const rampParam = (param, previous, target, when, glide, exponential) => {
      param.cancelScheduledValues(when);
      param.setValueAtTime(previous, when);
      const until = when + Math.max(0.005, glide);
      if (exponential) param.exponentialRampToValueAtTime(Math.max(1, target), until);
      else param.linearRampToValueAtTime(target, until);
    };

    const voice = {
      stopped: false,
      get freq() { return scheduledFreq; },
      /** Glide to a new pitch. Exponential, because that is what "in tune" is. */
      setPitch: (nextFreq, glide = 0.05, atTime = null) => {
        if (voice.stopped || !Number.isFinite(nextFreq) || nextFreq <= 0) return;
        if (atTime === null) {
          for (const osc of tones) followParam(osc.frequency, nextFreq, glide);
        } else {
          const when = this._at(atTime);
          for (const osc of tones) rampParam(osc.frequency, scheduledFreq, nextFreq, when, glide, true);
        }
        scheduledFreq = nextFreq;
      },
      /**
       * Morph the mouth. Same pair shape `startVocal` took.
       *
       * Q is deliberately **not** ramped, only the peak frequency and its
       * level. Re-solving a biquad's resonance a hundred times a second is
       * where the zipper comes from — the filter's own coefficients are being
       * rewritten under a signal already ringing inside it — and it buys
       * nothing audible, because what tells two vowels apart is where the
       * peaks are, not how sharp they are. Q is set once, at the vowel the
       * note started on.
       */
      setVowel: (nextFormants, glide = 0.09, atTime = null) => {
        if (voice.stopped || !Array.isArray(nextFormants)) return;
        const when = atTime === null ? null : this._at(atTime);
        filters.forEach(({ filter, formantGain }, index) => {
          const [frequency, , gain] = nextFormants[index] || scheduledFormants[index];
          const [wasFrequency, , wasGain] = scheduledFormants[index];
          if (when === null) {
            followParam(filter.frequency, frequency, glide);
            followParam(formantGain.gain, gain, glide);
          } else {
            rampParam(filter.frequency, wasFrequency, frequency, when, glide, true);
            rampParam(formantGain.gain, wasGain, gain, when, glide, false);
          }
        });
        scheduledFormants = nextFormants;
      },
      safetyTimer: null,
      cleanupTimer: null,
      stopAt: null,
      stop: (atTime = null) => {
        if (voice.stopped) return;
        const now = this.ctx.currentTime;
        const releaseAt = Number.isFinite(atTime) ? Math.max(now, atTime) : now;
        if (voice.stopAt !== null && releaseAt >= voice.stopAt) return;
        clearTimeout(voice.safetyTimer);
        clearTimeout(voice.cleanupTimer);
        voice.stopAt = releaseAt;
        // Same as piano: ahead-of-time stop must pin the sustain peak.
        // cancelAndHoldAtTime + early ramp decays across the whole hold in Chromium.
        if (releaseAt > now + 0.02) {
          out.gain.cancelScheduledValues(releaseAt);
          out.gain.setValueAtTime(peak, releaseAt);
        } else if (out.gain.cancelAndHoldAtTime) {
          out.gain.cancelAndHoldAtTime(releaseAt);
        } else {
          out.gain.cancelScheduledValues(releaseAt);
          out.gain.setValueAtTime(Math.max(0.0001, out.gain.value || peak), releaseAt);
        }
        out.gain.exponentialRampToValueAtTime(0.0001, releaseAt + 0.24);
        for (const source of sources) {
          try { source.stop(releaseAt + 0.27); } catch { /* already stopped */ }
        }
        voice.cleanupTimer = setTimeout(() => {
          voice.stopped = true;
          this._activeVocals.delete(voice);
        }, Math.max(0, (releaseAt + 0.3 - now) * 1000));
      },
      cancel: () => {
        if (voice.stopped) return;
        clearTimeout(voice.safetyTimer);
        clearTimeout(voice.cleanupTimer);
        const now = this.ctx.currentTime;
        out.gain.cancelScheduledValues(now);
        out.gain.setValueAtTime(Math.max(0.0001, out.gain.value || 0.0001), now);
        out.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
        for (const source of sources) {
          try { source.stop(now + 0.055); } catch { /* already stopped */ }
        }
        voice.stopped = true;
        this._activeVocals.delete(voice);
      },
    };
    voice.safetyTimer = setTimeout(() => voice.cancel(), Math.max(10000, (t - this.ctx.currentTime + 10) * 1000));
    this._activeVocals.add(voice);
    return voice;
  }

  stopVocal(voice) {
    voice?.stop?.();
  }

  /**
   * A sung note of known length. `glide` replays a recorded line: breakpoints
   * of `[secondsFromStart, freq, formants]`, each ramping from the one before
   * it so the curve arrives where it was drawn rather than stepping. Already
   * converted out of scale degrees by the caller — this layer knows about
   * hertz, not about keys.
   */
  vocalTone(freq = 329.63, formants = [[800, 5, 1], [1200, 7, 0.45]], vel = 1, at = null, duration = 0.68, glide = null) {
    const startAt = this.ctx ? this._at(at) : null;
    const voice = this.startVocal(freq, formants, vel, startAt);
    if (!voice) return null;
    let previous = 0;
    for (const [offset, breakFreq, breakFormants] of glide || []) {
      if (!(offset > previous) || offset >= duration) continue;
      const span = offset - previous;
      voice.setPitch(breakFreq, span, startAt + previous);
      if (breakFormants) voice.setVowel(breakFormants, span, startAt + previous);
      previous = offset;
    }
    voice.stop(startAt + duration);
    return voice;
  }

  micCheck() {
    if (this._silent()) return;
    const t = this.ctx.currentTime;
    // little feedback-ish "woo" — a gliding saw through a formant bandpass
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(392, t + 0.18);
    osc.frequency.linearRampToValueAtTime(330, t + 0.42);
    const vib = this.ctx.createOscillator();
    const vibG = this.ctx.createGain();
    vib.frequency.value = 6.5; vibG.gain.value = 9;
    vib.connect(vibG).connect(osc.frequency);

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1050; bp.Q.value = 2.2;
    const g = this.ctx.createGain();
    this._env(g, t, 0.34, 0.03, 0.55);
    osc.connect(bp).connect(g).connect(this._bus('mic'));
    osc.start(t); vib.start(t);
    osc.stop(t + 0.65); vib.stop(t + 0.65);

    // pop "1-2" tick
    const n = this._noiseSrc(t + 0.02, 0.02);
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
    const ng = this.ctx.createGain();
    this._env(ng, t + 0.02, 0.12, 0.001, 0.02);
    n.connect(hp).connect(ng).connect(this._bus('mic'));
  }
}
