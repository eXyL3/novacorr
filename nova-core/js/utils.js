export const TAU = Math.PI * 2;

export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const chance = (p) => Math.random() < p;

export function dist2(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  return dx * dx + dy * dy;
}

const UNITS = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];

export function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) {
    return n < 10 && n % 1 !== 0 ? n.toFixed(1) : String(Math.floor(n));
  }
  let u = -1;
  while (n >= 1000 && u < UNITS.length - 1) {
    n /= 1000;
    u++;
  }
  return (n >= 100 ? String(Math.floor(n)) : n.toFixed(1)) + UNITS[u];
}
