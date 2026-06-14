// Tiny WebAudio synth — no asset files, works offline.
export class Sfx {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this._last = {};
  }

  // Must be called from a user gesture (autoplay policy).
  ensure() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      } catch (e) { /* no audio available */ }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone(f1, f2, dur, type = 'sine', vol = 0.05, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(1, f1), t);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (e) { /* ignore */ }
  }

  play(name) {
    if (!this.enabled || !this.ctx) return;
    const throttle = { shoot: 70, hit: 50, kill: 80 }[name] || 0;
    if (throttle) {
      const now = performance.now();
      if (now - (this._last[name] || 0) < throttle) return;
      this._last[name] = now;
    }
    switch (name) {
      case 'shoot':  this.tone(420, 180, 0.05, 'triangle', 0.012); break;
      case 'hit':    this.tone(150, 70, 0.04, 'square', 0.018); break;
      case 'kill':   this.tone(240, 50, 0.15, 'sawtooth', 0.04); break;
      case 'boss':   this.tone(120, 25, 0.5, 'sawtooth', 0.09); break;
      case 'blast':
        this.tone(95, 28, 0.3, 'sine', 0.14);
        this.tone(60, 20, 0.4, 'square', 0.05, 0.02);
        break;
      case 'buy':    this.tone(520, 840, 0.09, 'sine', 0.05); break;
      case 'deny':   this.tone(160, 110, 0.1, 'square', 0.035); break;
      case 'hurt':   this.tone(90, 45, 0.18, 'square', 0.09); break;
      case 'wave':
        this.tone(660, 660, 0.1, 'sine', 0.04);
        this.tone(880, 880, 0.12, 'sine', 0.04, 0.1);
        break;
      case 'over':   this.tone(220, 40, 1.0, 'sawtooth', 0.1); break;
      case 'shard':  this.tone(700, 1400, 0.25, 'sine', 0.06); break;
      case 'warn':
        this.tone(880, 440, 0.12, 'square', 0.05);
        this.tone(880, 440, 0.12, 'square', 0.05, 0.18);
        break;
      case 'break':  this.tone(1200, 200, 0.2, 'sawtooth', 0.07); break;
      case 'sing':
        this.tone(320, 35, 0.7, 'sine', 0.12);
        this.tone(160, 25, 0.9, 'triangle', 0.06, 0.05);
        break;
      case 'odrive':
        this.tone(220, 660, 0.25, 'sawtooth', 0.06);
        this.tone(330, 990, 0.25, 'sawtooth', 0.04, 0.08);
        break;
      case 'pickup':
        this.tone(620, 930, 0.1, 'sine', 0.05);
        this.tone(930, 1240, 0.1, 'sine', 0.04, 0.08);
        break;
      case 'ult':
        this.tone(60, 18, 0.8, 'sawtooth', 0.14);
        this.tone(1200, 100, 0.5, 'sine', 0.08, 0.05);
        this.tone(400, 50, 0.7, 'square', 0.05, 0.1);
        break;
      case 'zap':    this.tone(800, 180, 0.06, 'square', 0.03); break;
      case 'meteor':
        this.tone(55, 18, 0.35, 'sine', 0.13);
        this.tone(140, 40, 0.2, 'square', 0.05);
        break;
      case 'event':
        this.tone(440, 880, 0.14, 'triangle', 0.06);
        this.tone(660, 1320, 0.14, 'triangle', 0.05, 0.14);
        break;
      case 'alarm':
        this.tone(70, 55, 0.12, 'sine', 0.1);
        this.tone(70, 55, 0.12, 'sine', 0.07, 0.18);
        break;
    }
  }
}
