import { TAU, rand, clamp } from './utils.js';
import { CORE_R, THEMES, PICKUPS } from './config.js';

let twinkles = [];
const cache = { w: 0, h: 0, bg: null, vig: null };

export function invalidateCache() {
  cache.w = 0;
}

// Pre-render the background (nebula blobs + star field) once per resize.
function rebuild(ctx, w, h) {
  cache.w = w;
  cache.h = h;
  const dpr = ctx.canvas.width / Math.max(1, w);
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);

  const base = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
  base.addColorStop(0, '#0c1226');
  base.addColorStop(0.6, '#080b18');
  base.addColorStop(1, '#04060c');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);

  const blobs = [
    { x: w * 0.22, y: h * 0.28, r: Math.min(w, h) * 0.55, col: 'rgba(90,45,170,0.14)' },
    { x: w * 0.80, y: h * 0.70, r: Math.min(w, h) * 0.60, col: 'rgba(20,120,160,0.12)' },
    { x: w * 0.70, y: h * 0.18, r: Math.min(w, h) * 0.40, col: 'rgba(170,40,120,0.09)' },
    { x: w * 0.30, y: h * 0.82, r: Math.min(w, h) * 0.45, col: 'rgba(30,90,200,0.10)' },
  ];
  for (const b of blobs) {
    const ng = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    ng.addColorStop(0, b.col);
    ng.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = ng;
    g.fillRect(0, 0, w, h);
  }

  // static stars baked in
  const n = Math.floor((w * h) / 9000);
  for (let i = 0; i < n; i++) {
    g.globalAlpha = rand(0.1, 0.5);
    g.fillStyle = '#fff';
    g.fillRect(rand(0, w), rand(0, h), rand(0.5, 1.6), rand(0.5, 1.6));
  }
  g.globalAlpha = 1;
  cache.bgCanvas = c;

  // a few live twinkling stars on top
  twinkles = [];
  for (let i = 0; i < 26; i++) {
    twinkles.push({ x: rand(0, w), y: rand(0, h), s: rand(1, 2.2), tw: rand(0.6, 2.5), ph: rand(0, TAU) });
  }

  cache.vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) / 2);
  cache.vig.addColorStop(0, 'rgba(0,0,0,0)');
  cache.vig.addColorStop(1, 'rgba(0,0,0,0.55)');
}

function polygon(ctx, x, y, r, sides, rot) {
  ctx.beginPath();
  if (sides < 3) {
    ctx.arc(x, y, r, 0, TAU);
  } else {
    for (let i = 0; i < sides; i++) {
      const a = rot + TAU * i / sides;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
}

export function draw(ctx, game, w, h) {
  if (cache.w !== w || cache.h !== h) rebuild(ctx, w, h);
  const t = game.time;
  const pt = game.particles;
  const st = game.stats;
  const lowQ = game.opts && game.opts.quality === 'low';

  // core theme colors (prism cycles hue)
  const th = THEMES.find((x) => x.id === (game.opts && game.opts.theme)) || THEMES[0];
  const glow = th.rgb
    ? (a) => `rgba(${th.rgb[0]},${th.rgb[1]},${th.rgb[2]},${a})`
    : (a) => `hsla(${(t * 40) % 360},90%,65%,${a})`;
  const cMain = glow(1);

  // background (pre-rendered)
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(cache.bgCanvas, 0, 0);
  ctx.restore();
  ctx.fillStyle = '#fff';
  for (const s of twinkles) {
    ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph));
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;

  const off = pt.shakeOffset();
  ctx.save();
  ctx.translate(w / 2 + off.x, h / 2 + off.y);

  // ambient rings
  ctx.strokeStyle = 'rgba(125,249,255,0.05)';
  ctx.lineWidth = 1;
  for (const r of [110, 220, 330]) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
  }

  // repulsor aura
  if (st.repulsorLvl > 0) {
    const R = st.repulsorRadius * (1 + 0.02 * Math.sin(t * 4));
    ctx.strokeStyle = `rgba(125,249,255,${0.10 + 0.05 * Math.sin(t * 4)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(125,249,255,0.025)';
    ctx.fill();
  }

  // surge warning arrow at the screen edge
  if (game.warning) {
    const a = game.warning.angle;
    const R = Math.min(w, h) / 2 - 46;
    const wx = Math.cos(a) * R, wy = Math.sin(a) * R;
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(a + Math.PI); // point toward the core (incoming direction)
    ctx.globalAlpha = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 14));
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-9, -12);
    ctx.lineTo(-9, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // --- glow layer (additive) ---
  ctx.globalCompositeOperation = 'lighter';

  // enemy halos
  if (!lowQ) {
    for (const e of game.enemies) {
      ctx.globalAlpha = e.elite ? 0.22 : 0.13;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * (e.elite ? 2.3 : 1.9), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // core glow (overdrive turns it furnace-orange)
  const od = game.odActive > 0;
  const pulse = 1 + (od ? 0.12 : 0.06) * Math.sin(t * (od ? 9 : 3));
  const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, CORE_R * 3.2 * pulse);
  if (od) {
    cg.addColorStop(0, 'rgba(255,177,61,0.6)');
    cg.addColorStop(0.4, 'rgba(255,110,40,0.22)');
    cg.addColorStop(1, 'rgba(255,110,40,0)');
  } else {
    cg.addColorStop(0, glow(0.5));
    cg.addColorStop(0.4, glow(0.18));
    cg.addColorStop(1, glow(0));
  }
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, 0, CORE_R * 3.2 * pulse, 0, TAU);
  ctx.fill();

  // singularity: dark heart, hungry swirl
  if (game.singActive) {
    const s = game.singActive;
    const sg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 120);
    sg.addColorStop(0, 'rgba(199,125,255,0.45)');
    sg.addColorStop(0.5, 'rgba(120,40,200,0.15)');
    sg.addColorStop(1, 'rgba(120,40,200,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 120, 0, TAU);
    ctx.fill();
  }

  // muzzle flash
  if (game.muzzle) {
    const m = game.muzzle;
    const mx = Math.cos(m.a) * (CORE_R + 6);
    const my = Math.sin(m.a) * (CORE_R + 6);
    ctx.globalAlpha = clamp(m.t / 0.07, 0, 1);
    ctx.fillStyle = '#dffaff';
    ctx.beginPath();
    ctx.arc(mx, my, 9, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // projectile glow trails
  ctx.lineCap = 'round';
  if (!lowQ) {
    for (const p of game.projectiles) {
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // particles (sparks + spinning shards)
  for (const p of pt.list) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    if (p.tri) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.moveTo(p.size, 0);
      ctx.lineTo(-p.size * 0.6, -p.size * 0.7);
      ctx.lineTo(-p.size * 0.6, p.size * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // shockwave rings
  for (const r of pt.rings) {
    ctx.globalAlpha = clamp(r.life, 0, 1) * 0.9;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.width;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.globalCompositeOperation = 'source-over';

  // --- projectile cores ---
  ctx.lineWidth = 2.5;
  for (const p of game.projectiles) {
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  // --- enemy bullets ---
  if (game.enemyProjectiles) {
    for (const ep of game.enemyProjectiles) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,138,90,0.3)';
      ctx.beginPath();
      ctx.arc(ep.x, ep.y, ep.r * 2.2, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ff8a5a';
      ctx.beginPath();
      ctx.arc(ep.x, ep.y, ep.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ep.x, ep.y, ep.r * 0.4, 0, TAU);
      ctx.fill();
    }
  }

  // singularity event horizon
  if (game.singActive) {
    const s = game.singActive;
    ctx.fillStyle = '#05030a';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 16 + 2 * Math.sin(t * 10), 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(199,125,255,0.9)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, 24 + i * 12, t * (3 + i), t * (3 + i) + 2.2);
      ctx.stroke();
    }
  }

  // --- enemies ---
  for (const e of game.enemies) {
    const ghost = e.type === 'wraith';
    if (ghost) ctx.globalAlpha = 0.55 + 0.3 * Math.sin(t * 6 + e.phase);
    polygon(ctx, e.x, e.y, e.r, e.sides, e.rot);
    ctx.fillStyle = e.color;
    ctx.fill();
    // inner shading
    polygon(ctx, e.x, e.y, e.r * 0.55, e.sides, e.rot);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    // elite outline
    if (e.elite) {
      polygon(ctx, e.x, e.y, e.r + 3, e.sides, e.rot);
      ctx.strokeStyle = `rgba(255,255,255,${0.6 + 0.3 * Math.sin(t * 5 + e.phase)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // boss inner spinner
    if (e.type === 'boss') {
      polygon(ctx, e.x, e.y, e.r * 0.8, e.sides, -e.rot * 1.5);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // frost tint
    if (e.slowT > 0) {
      polygon(ctx, e.x, e.y, e.r + 1.5, e.sides, e.rot);
      ctx.strokeStyle = 'rgba(140,220,255,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // hit flash
    if (e.flash > 0) {
      polygon(ctx, e.x, e.y, e.r, e.sides, e.rot);
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, e.flash * 7)})`;
      ctx.fill();
    }
    if (ghost) ctx.globalAlpha = 1;
    // grabbed: show the player's grip
    if (game.grab && game.grab.id === e.id) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 7, t * 4, t * 4 + TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(game.grab.x, game.grab.y);
      ctx.stroke();
    }
    // hp bar (only when damaged)
    if (e.hp < e.maxHp) {
      const bw = e.r * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - bw / 2, e.y - e.r - 8, bw, 3);
      ctx.fillStyle = e.type === 'boss' ? '#ff3df0' : e.elite ? '#fff' : '#4dff88';
      ctx.fillRect(e.x - bw / 2, e.y - e.r - 8, bw * clamp(e.hp / e.maxHp, 0, 1), 3);
    }
  }

  // --- turrets ---
  if (game.turretState) {
    for (const tr of game.turretState) {
      if (tr.x === undefined) continue;
      ctx.fillStyle = '#1a2440';
      ctx.strokeStyle = '#7df9ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, 8, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tr.x, tr.y);
      ctx.lineTo(tr.x + Math.cos(tr.aim) * 13, tr.y + Math.sin(tr.aim) * 13);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  // --- orbitals ---
  if (game.orbitalPos) {
    for (const o of game.orbitalPos) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(199,125,255,0.25)';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 17, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#c77dff';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 8, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 3.5, 0, TAU);
      ctx.fill();
    }
  }

  // --- meteors: target reticle + falling rock ---
  if (game.meteors) {
    for (const m of game.meteors) {
      const prog = 1 - m.t / 0.85; // 0 → 1 as it falls
      // ground warning
      ctx.strokeStyle = `rgba(255,90,90,${0.35 + 0.4 * Math.sin(t * 16)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * (0.5 + 0.5 * prog), 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      // incoming rock
      const rx = m.x + (1 - prog) * 200;
      const ry = m.y - (1 - prog) * 440;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,157,61,0.6)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(rx + 40, ry - 90);
      ctx.lineTo(rx, ry);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#b07a4d';
      ctx.beginPath();
      ctx.arc(rx, ry, 9, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffb13d';
      ctx.beginPath();
      ctx.arc(rx, ry, 4, 0, TAU);
      ctx.fill();
    }
  }

  // --- drones: little triangle wingmen ---
  if (game.droneState) {
    for (const dr of game.droneState) {
      const ang = Math.atan2(dr.vy, dr.vx);
      ctx.save();
      ctx.translate(dr.x, dr.y);
      ctx.rotate(Math.hypot(dr.vx, dr.vy) > 20 ? ang : dr.aim);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = glow(0.18);
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#1a2440';
      ctx.strokeStyle = cMain;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(-7, -6);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-7, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // --- deployed buildings ---
  if (game.buildings) {
    for (const b of game.buildings) {
      if (b.type === 'mine') {
        ctx.fillStyle = '#3a1020';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#ff5a5a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = `rgba(255,90,90,${0.4 + 0.6 * (Math.sin(t * 6) > 0 ? 1 : 0)})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, TAU);
        ctx.fill();
      } else if (b.type === 'tesla') {
        // range hint + pylon
        ctx.strokeStyle = 'rgba(125,249,255,0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 190, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = '#10243a';
        polygon(ctx, b.x, b.y, b.r, 3, -Math.PI / 2);
        ctx.fill();
        ctx.strokeStyle = '#7df9ff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = `rgba(125,249,255,${0.5 + 0.4 * Math.sin(t * 8)})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y - 2, 3.5, 0, TAU);
        ctx.fill();
        // lifetime arc
        ctx.strokeStyle = 'rgba(125,249,255,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 4, -Math.PI / 2, -Math.PI / 2 + TAU * (b.t / 30));
        ctx.stroke();
      } else if (b.type === 'barrier') {
        polygon(ctx, b.x, b.y, b.r, 6, Math.PI / 6);
        ctx.fillStyle = '#2a3548';
        ctx.fill();
        ctx.strokeStyle = '#9ab0c8';
        ctx.lineWidth = 2;
        ctx.stroke();
        polygon(ctx, b.x, b.y, b.r * 0.55, 6, Math.PI / 6);
        ctx.strokeStyle = 'rgba(154,176,200,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (b.hp < b.maxHp) {
          const bw = b.r * 2;
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(b.x - bw / 2, b.y - b.r - 8, bw, 3);
          ctx.fillStyle = '#9ab0c8';
          ctx.fillRect(b.x - bw / 2, b.y - b.r - 8, bw * clamp(b.hp / b.maxHp, 0, 1), 3);
        }
      }
    }
  }

  // --- tesla / chain lightning ---
  if (game.zaps && game.zaps.length) {
    ctx.globalCompositeOperation = 'lighter';
    for (const z of game.zaps) {
      ctx.globalAlpha = clamp(z.t / 0.12, 0, 1);
      ctx.strokeStyle = '#bdf6ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(z.x1, z.y1);
      const segs = 4;
      for (let i = 1; i < segs; i++) {
        const f = i / segs;
        const mx = z.x1 + (z.x2 - z.x1) * f + rand(-9, 9);
        const my = z.y1 + (z.y2 - z.y1) * f + rand(-9, 9);
        ctx.lineTo(mx, my);
      }
      ctx.lineTo(z.x2, z.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // --- pickups (floating power-ups) ---
  if (game.pickups) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const pu of game.pickups) {
      const def = PICKUPS[pu.type];
      const bob = Math.sin(t * 4 + pu.phase) * 3;
      const blink = pu.t < 2.5 ? (Math.sin(t * 14) > 0 ? 0.35 : 1) : 1;
      ctx.globalAlpha = blink;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = def.color;
      ctx.globalAlpha = 0.22 * blink;
      ctx.beginPath();
      ctx.arc(pu.x, pu.y + bob, 16 + 2 * Math.sin(t * 6 + pu.phase), 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = blink;
      ctx.font = '15px "Segoe UI", sans-serif';
      ctx.fillStyle = def.color;
      ctx.fillText(def.icon, pu.x, pu.y + bob);
    }
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
  }

  // --- core body ---
  ctx.fillStyle = '#0e1830';
  ctx.beginPath();
  ctx.arc(0, 0, CORE_R, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = cMain;
  ctx.lineWidth = 2;
  ctx.stroke();
  polygon(ctx, 0, 0, CORE_R * 0.62, 6, t * 0.6);
  ctx.strokeStyle = glow(0.7);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  polygon(ctx, 0, 0, CORE_R * 0.85, 6, -t * 0.35);
  ctx.strokeStyle = glow(0.3);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = glow(0.55 + 0.25 * Math.sin(t * 3));
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, TAU);
  ctx.fill();

  // hp ring around core
  const frac = clamp(game.coreHp / st.coreMaxHp, 0, 1);
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.arc(0, 0, CORE_R + 9, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = `hsl(${frac * 120}, 90%, 60%)`;
  ctx.beginPath();
  ctx.arc(0, 0, CORE_R + 9, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
  ctx.stroke();

  // aegis shield ring
  if (st.shieldMax > 0) {
    const sFrac = clamp(game.shield / st.shieldMax, 0, 1);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(77,166,255,0.15)';
    ctx.beginPath();
    ctx.arc(0, 0, CORE_R + 15, 0, TAU);
    ctx.stroke();
    if (sFrac > 0) {
      ctx.strokeStyle = `rgba(77,166,255,${0.6 + 0.25 * Math.sin(t * 4)})`;
      ctx.beginPath();
      ctx.arc(0, 0, CORE_R + 15, -Math.PI / 2, -Math.PI / 2 + TAU * sFrac);
      ctx.stroke();
    }
  }

  // blast cooldown ring
  const cdFrac = 1 - clamp(game.blastTimer / st.blastCooldown, 0, 1);
  const cdR = CORE_R + (st.shieldMax > 0 ? 21 : 15);
  ctx.lineWidth = 2.5;
  if (cdFrac >= 1) {
    ctx.strokeStyle = glow(0.55 + 0.35 * Math.sin(t * 6));
    ctx.beginPath();
    ctx.arc(0, 0, cdR, 0, TAU);
    ctx.stroke();
  } else {
    ctx.strokeStyle = glow(0.3);
    ctx.beginPath();
    ctx.arc(0, 0, cdR, -Math.PI / 2, -Math.PI / 2 + TAU * cdFrac);
    ctx.stroke();
  }

  // floating numbers
  ctx.textAlign = 'center';
  for (const txt of pt.texts) {
    ctx.globalAlpha = clamp(txt.life * 1.6, 0, 1);
    ctx.font = txt.big ? '700 17px Orbitron, "Segoe UI", sans-serif' : '700 12px Rajdhani, "Segoe UI", sans-serif';
    ctx.fillStyle = txt.color;
    ctx.fillText(txt.str, txt.x, txt.y);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // --- boss hp bar (screen space) ---
  const bosses = game.enemies.filter((e) => e.type === 'boss');
  if (bosses.length) {
    let hp = 0, max = 0;
    for (const b of bosses) { hp += b.hp; max += b.maxHp; }
    const bw = Math.min(380, w * 0.62);
    const bx = (w - bw) / 2, by = 66;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx - 2, by - 2, bw + 4, 12);
    ctx.fillStyle = '#ff3df0';
    ctx.fillRect(bx, by, bw * clamp(hp / max, 0, 1), 8);
    ctx.strokeStyle = 'rgba(255,61,240,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - 2, by - 2, bw + 4, 12);
    ctx.textAlign = 'center';
    ctx.font = '700 10px Orbitron, "Segoe UI", sans-serif';
    ctx.fillStyle = '#ff9df7';
    ctx.fillText('BOSS', w / 2, by - 6);
  }

  // vignette
  ctx.fillStyle = cache.vig;
  ctx.fillRect(0, 0, w, h);

  // ultimate flash
  if (game.ultFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, game.ultFlash * 1.8)})`;
    ctx.fillRect(0, 0, w, h);
  }

  // low-hp warning pulse
  if (game.state === 'play' && frac < 0.35) {
    const danger = (0.35 - frac) / 0.35;
    const dg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) / 2);
    dg.addColorStop(0, 'rgba(255,40,40,0)');
    dg.addColorStop(1, `rgba(255,40,40,${danger * (0.22 + 0.12 * Math.sin(t * 6))})`);
    ctx.fillStyle = dg;
    ctx.fillRect(0, 0, w, h);
  }
}
