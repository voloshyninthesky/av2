// ============================================================
// ART VIBE — WebAudio synth engine (no samples, all synthesized)
// ============================================================

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._noise = null;
    this._ksCache = new Map();
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;

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
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.02);
  }

  _env(gainNode, t, peak, attack, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
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

  kick(vel = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    this._env(g, t, 0.95 * vel, 0.004, 0.34);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + 0.4);

    // beater click
    const n = this._noiseSrc(t, 0.03);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1200;
    const ng = this.ctx.createGain();
    this._env(ng, t, 0.25 * vel, 0.001, 0.03);
    n.connect(hp).connect(ng).connect(this.master);
  }

  snare(vel = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this._noiseSrc(t, 0.22);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8;
    const ng = this.ctx.createGain();
    this._env(ng, t, 0.55 * vel, 0.002, 0.19);
    n.connect(bp).connect(ng).connect(this.master);

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(195, t);
    this._env(g, t, 0.32 * vel, 0.002, 0.1);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + 0.15);
  }

  hihat(open = false, vel = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = open ? 0.32 : 0.06;
    const n = this._noiseSrc(t, dur);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 7800;
    const g = this.ctx.createGain();
    this._env(g, t, 0.28 * vel, 0.001, dur);
    n.connect(hp).connect(g).connect(this.master);
  }

  crash(vel = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this._noiseSrc(t, 1.4);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 4600;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 8200; bp.Q.value = 1.6;
    const g = this.ctx.createGain();
    this._env(g, t, 0.4 * vel, 0.004, 1.3);
    n.connect(hp).connect(bp).connect(g).connect(this.master);
  }

  tom(freq = 120, vel = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.4, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.72, t + 0.16);
    this._env(g, t, 0.6 * vel, 0.004, 0.42);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + 0.5);
  }

  // ---------------- PIANO ----------------

  piano(freq, vel = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.ctx.createGain();
    this._env(out, t, 0.5 * vel, 0.006, 1.6);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(4200, freq * 6), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(600, freq * 1.5), t + 1.1);
    out.connect(lp).connect(this.master);

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

  pluck(freq, vel = 1, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this._ksBuffer(freq);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.75 * vel, t);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 5200;
    src.connect(lp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 2.2);
  }

  strum(freqs, vel = 1) {
    freqs.forEach((f, i) => this.pluck(f, vel * (0.85 + Math.random() * 0.3), i * 0.042));
  }

  // ---------------- MIC / VOCAL ----------------

  micCheck() {
    if (!this.ctx) return;
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
    osc.connect(bp).connect(g).connect(this.master);
    osc.start(t); vib.start(t);
    osc.stop(t + 0.65); vib.stop(t + 0.65);

    // pop "1-2" tick
    const n = this._noiseSrc(t + 0.02, 0.02);
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
    const ng = this.ctx.createGain();
    this._env(ng, t + 0.02, 0.12, 0.001, 0.02);
    n.connect(hp).connect(ng).connect(this.master);
  }
}
