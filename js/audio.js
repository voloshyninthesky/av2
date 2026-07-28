// ============================================================
// ART VIBE — WebAudio synth engine (no samples, all synthesized)
// ============================================================

export class AudioEngine {
  static BUS_KEYS = ['drums', 'piano', 'guitar', 'mic'];

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
        this._clearResumeWatch();
      } else {
        this._primed = false;
        // Once output has worked, an unsolicited suspend/interruption/close can
        // leave iOS and in-app WebViews with a dead route that still looks valid.
        if (hasRun || context.state === 'interrupted' || context.state === 'closed') {
          this.markForRecovery();
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
      resumeFailures: this._resumeFailures,
      activePianoVoices: this._activePianoVoices.size,
      audioSessionState: navigator.audioSession?.state ?? 'unsupported',
      audioSessionType: navigator.audioSession?.type ?? 'unsupported',
    };
  }

  _configureAudioSession() {
    try {
      const session = navigator.audioSession;
      if (!session) return;
      if (session.type !== 'playback') session.type = 'playback';
      if (!this._audioSessionBound && session.addEventListener) {
        session.addEventListener('statechange', () => {
          if (session.state !== 'active') this.markForRecovery();
        });
        this._audioSessionBound = true;
      }
    } catch (_) { /* experimental API or WebView may reject assignment */ }
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
  markForRecovery() {
    if (!this.ctx) return;
    this._needsRecovery = true;
    this._primed = false;
  }

  unlock() {
    this._configureAudioSession();

    const stuck = this.ctx
      && this.ctx.state !== 'running'
      && this._resumeFailures > 0;
    const unusable = this.ctx?.state === 'closed';
    const needsRebuild = this.ctx && (this._needsRecovery || stuck || unusable);
    // A single touch can emit both pointerdown and touchstart. Deduplicate only
    // the destructive rebuild, never the recovery request itself.
    if (needsRebuild && performance.now() - this._lastRebuildAt >= 80) {
      this._resetContext({ close: true });
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
      this._resumeFailures = 0;
      return Promise.resolve(true);
    }

    const context = this.ctx;
    const recordFailure = () => {
      if (this.ctx !== context || context.state === 'running' || context.state === 'closed') return;
      this._resumeFailures = Math.max(1, this._resumeFailures + 1);
      this._primed = false;
    };
    const wake = () => {
      if (this.ctx !== context || context.state === 'closed') return Promise.resolve(false);
      if (context.state === 'running') return Promise.resolve(true);
      this._prime();
      return context.resume()
        .then(() => {
          const running = context.state === 'running';
          if (running) {
            this._resumeFailures = 0;
            this._clearResumeWatch();
          } else {
            recordFailure();
          }
          return running;
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
    const level = Math.max(0, Math.min(1, Number(value)));
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

  startVocal(freq = 329.63, vowel = 1, vel = 1, at = null) {
    if (this._silent()) return null;
    const t = this._at(at);
    const peak = Math.max(0.0001, 0.26 * vel);
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(peak, t + 0.035);
    out.connect(this._bus('mic'));

    const formants = [
      [[800, 5, 1], [1200, 7, 0.45]],
      [[500, 6, 1], [1750, 8, 0.45]],
      [[350, 7, 1], [2100, 9, 0.4]],
    ][Math.abs(vowel) % 3];
    const filters = formants.map(([frequency, q, gain]) => {
      const filter = this.ctx.createBiquadFilter();
      const formantGain = this.ctx.createGain();
      filter.type = 'bandpass';
      filter.frequency.value = frequency;
      filter.Q.value = q;
      formantGain.gain.value = gain;
      filter.connect(formantGain).connect(out);
      return filter;
    });

    const vibrato = this.ctx.createOscillator();
    const vibratoGain = this.ctx.createGain();
    vibrato.frequency.value = 5.5;
    vibratoGain.gain.value = 5.5;
    vibrato.connect(vibratoGain);

    const sources = [];
    for (const [type, level, detune] of [['sawtooth', 0.55, -4], ['triangle', 0.42, 4]]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      gain.gain.value = level;
      vibratoGain.connect(osc.frequency);
      osc.connect(gain);
      for (const filter of filters) gain.connect(filter);
      osc.start(t);
      sources.push(osc);
    }
    vibrato.start(t);
    sources.push(vibrato);

    const voice = {
      stopped: false,
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

  vocalTone(freq = 329.63, vowel = 1, vel = 1, at = null, duration = 0.68) {
    const startAt = this.ctx ? this._at(at) : null;
    const voice = this.startVocal(freq, vowel, vel, startAt);
    if (voice) voice.stop(startAt + duration);
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
