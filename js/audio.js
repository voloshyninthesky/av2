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
    this._activeVocals = new Set();
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    // Honor mute chosen before the context existed (HUD sound button).
    this.master.gain.value = this.muted ? 0 : 0.9;

    for (const key of AudioEngine.BUS_KEYS) {
      const bus = this.ctx.createGain();
      bus.gain.value = this.levels[key];
      bus.connect(this.master);
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
  }

  resume() { this.ctx && this.ctx.state === 'suspended' && this.ctx.resume(); }

  setMuted(m) {
    this.muted = Boolean(m);
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.muted ? 0 : 0.9, t);
    if (this.muted) {
      for (const voice of [...this._activeVocals]) voice.cancel?.();
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

  piano(freq, vel = 1, at = null) {
    if (this._silent()) return;
    const t = this._at(at);
    const out = this.ctx.createGain();
    this._env(out, t, 0.5 * vel, 0.006, 1.6);
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
    for (const p of partials) {
      const o = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      o.type = p.type;
      o.frequency.value = freq * p.mult;
      o.detune.value = (Math.random() - 0.5) * 4;
      og.gain.value = p.gain;
      o.connect(og).connect(out);
      o.start(t); o.stop(t + 1.8);
    }
  }

  // ---------------- GUITAR (Karplus–Strong) ----------------

  _ksBuffer(freq) {
    const key = Math.round(freq * 10);
    if (this._ksCache.has(key)) return this._ksCache.get(key);
    const sr = this.ctx.sampleRate;
    const period = Math.max(2, Math.round(sr / freq));
    const dur = 2.2;
    const len = Math.floor(sr * dur);
    const buf = this.ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const ring = new Float32Array(period);
    for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const cur = ring[idx];
      const nxt = ring[(idx + 1) % period];
      ring[idx] = 0.9965 * 0.5 * (cur + nxt);
      out[i] = cur;
      idx = (idx + 1) % period;
    }
    this._ksCache.set(key, buf);
    return buf;
  }

  pluck(freq, vel = 1, at = null) {
    if (this._silent()) return;
    const t = this._at(at);
    const src = this.ctx.createBufferSource();
    src.buffer = this._ksBuffer(freq);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.75 * vel, t);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 5200;
    src.connect(lp).connect(g).connect(this._bus('guitar'));
    src.start(t);
    src.stop(t + 2.2);
  }

  strum(freqs, vel = 1, at = null) {
    if (this._silent()) return;
    const base = this._at(at);
    freqs.forEach((f, i) => this.pluck(f, vel * (0.85 + Math.random() * 0.3), base + i * 0.042));
  }

  // ---------------- MIC / VOCAL ----------------

  startVocal(freq = 329.63, vowel = 1, vel = 1, at = null) {
    if (this._silent()) return null;
    const t = this._at(at);
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.26 * vel, t + 0.035);
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
        if (out.gain.cancelAndHoldAtTime) out.gain.cancelAndHoldAtTime(releaseAt);
        else {
          out.gain.cancelScheduledValues(releaseAt);
          out.gain.setValueAtTime(Math.max(0.0001, Math.min(0.26 * vel, out.gain.value || 0.26 * vel)), releaseAt);
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
