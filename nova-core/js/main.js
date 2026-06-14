import { Game } from './game.js';
import { Sfx } from './audio.js';
import { draw, invalidateCache } from './render.js';
import { initUI } from './ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const audio = new Sfx();
const game = new Game(audio);
const ui = initUI(game, audio);

let W = 0, H = 0;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  game.view.w = W;
  game.view.h = H;
  invalidateCache();
}
window.addEventListener('resize', resize);
resize();

// Pointer: press ON an enemy to grab & fling it; tap empty space to Nova Blast.
let dragging = false;
let lastX = 0, lastY = 0, lastT = 0, velX = 0, velY = 0;

function worldPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left - W / 2, y: e.clientY - r.top - H / 2 };
}

canvas.addEventListener('pointerdown', (e) => {
  audio.ensure();
  ui.hideHint();
  const p = worldPos(e);
  // armed building placement takes priority, then grabbing, then blasting
  if (game.buildSelect) {
    if (game.tryBuild(game.buildSelect, p.x, p.y)) {
      game.buildSelect = null;
      ui.syncBuildBar();
    }
    return;
  }
  if (game.startGrab(p.x, p.y)) {
    dragging = true;
    velX = velY = 0;
    lastX = p.x;
    lastY = p.y;
    lastT = performance.now();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  } else {
    game.tryBlast(p.x, p.y);
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const p = worldPos(e);
  const now = performance.now();
  const dt = (now - lastT) / 1000;
  if (dt > 0.004) {
    // smoothed throw velocity
    velX = velX * 0.5 + ((p.x - lastX) / dt) * 0.5;
    velY = velY * 0.5 + ((p.y - lastY) / dt) * 0.5;
    lastX = p.x;
    lastY = p.y;
    lastT = now;
  }
  game.moveGrab(p.x, p.y);
});

function release() {
  if (!dragging) return;
  dragging = false;
  game.endGrab(velX, velY);
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

// Unlock audio on the first interaction anywhere (buttons included).
document.addEventListener('pointerdown', () => audio.ensure(), { once: true });

let last = performance.now();
let saveT = 0;

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!game.paused) {
    game.update(dt);
    game.particles.update(dt * game.speed * game.timeMult);
  }
  draw(ctx, game, W, H);
  ui.tick(dt);
  saveT += dt;
  if (saveT > 5 && game.state === 'play') {
    saveT = 0;
    game.save();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.save();
});
