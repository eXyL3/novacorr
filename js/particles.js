import { rand, TAU } from './utils.js';

const MAX_PARTICLES = 500;
const MAX_TEXTS = 48;

export class Particles {
  constructor() {
    this.list = [];   // sparks, dots, homing coins
    this.rings = [];  // expanding shockwave circles
    this.texts = [];  // floating damage / gold numbers
    this.shake = 0;
    this.shakeOn = true; // settings toggle
    this.quality = 1;    // 1 = high, 0.5 = low (halves particle counts)
  }

  spark(x, y, color, n = 8, speed = 160, size = 3, life = 0.5) {
    n = Math.ceil(n * this.quality);
    for (let i = 0; i < n; i++) {
      if (this.list.length >= MAX_PARTICLES) this.list.shift();
      const a = rand(0, TAU);
      const s = speed * rand(0.3, 1.1);
      this.list.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life * rand(0.6, 1.3),
        maxLife: life,
        size: size * rand(0.6, 1.4),
        color,
        homing: false,
      });
    }
  }

  // gold motes that get sucked into the core
  coin(x, y, n = 1) {
    n = Math.ceil(n * this.quality);
    for (let i = 0; i < n; i++) {
      if (this.list.length >= MAX_PARTICLES) this.list.shift();
      const a = rand(0, TAU);
      const s = rand(40, 140);
      this.list.push({
        x: x + rand(-6, 6), y: y + rand(-6, 6),
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 1.6,
        maxLife: 1.6,
        size: rand(2, 3),
        color: '#ffd24d',
        homing: true,
      });
    }
  }

  // spinning debris chunks for big deaths
  shard(x, y, color, n = 6) {
    n = Math.ceil(n * this.quality);
    for (let i = 0; i < n; i++) {
      if (this.list.length >= MAX_PARTICLES) this.list.shift();
      const a = rand(0, TAU);
      const s = rand(90, 280);
      this.list.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.6, 1.1),
        maxLife: 1.1,
        size: rand(4, 8),
        color,
        tri: true,
        rot: rand(0, TAU),
        rotSpd: rand(-9, 9),
        homing: false,
      });
    }
  }

  ring(x, y, color, maxR = 80, width = 3) {
    if (this.rings.length > 24) this.rings.shift();
    this.rings.push({ x, y, color, r: 6, maxR, width, life: 1 });
  }

  text(x, y, str, color, big = false) {
    if (this.texts.length >= MAX_TEXTS) {
      if (!big) return; // drop ordinary numbers first when crowded
      this.texts.shift();
    }
    this.texts.push({
      x: x + rand(-8, 8), y: y - 6,
      vy: -55, str, color, big,
      life: big ? 1.1 : 0.8,
    });
  }

  addShake(a) {
    if (!this.shakeOn) return;
    this.shake = Math.min(22, this.shake + a);
  }

  shakeOffset() {
    if (this.shake <= 0.1) return { x: 0, y: 0 };
    return { x: rand(-this.shake, this.shake), y: rand(-this.shake, this.shake) };
  }

  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 30);

    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      if (p.homing) {
        // accelerate toward the core at (0,0), die on arrival
        const d = Math.hypot(p.x, p.y) || 1;
        if (d < 30) { this.list.splice(i, 1); continue; }
        const k = Math.min(1, dt * 4);
        p.vx += ((-p.x / d) * 560 - p.vx) * k;
        p.vy += ((-p.y / d) * 560 - p.vy) * k;
      } else {
        p.vx *= 1 - 2.4 * dt;
        p.vy *= 1 - 2.4 * dt;
      }
      if (p.tri) p.rot += p.rotSpd * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt * 2.2;
      if (r.life <= 0) { this.rings.splice(i, 1); continue; }
      r.r += (r.maxR - r.r) * Math.min(1, dt * 9);
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) { this.texts.splice(i, 1); continue; }
      t.y += t.vy * dt;
      t.vy *= 1 - 1.5 * dt;
    }
  }
}
