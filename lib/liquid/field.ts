// The wave field. The page is a dark liquid; this is its surface height, computed analytically (no simulation, no
// readback): a sum of wave humps, each a ring that spreads from where something touched, plus an idle swell that is
// always there. Sources live in PAGE CSS px (x, docY), so scrolling drags the liquid past the viewport.
// `sample()` here and the fragment shader in render.ts evaluate exactly the same formula (constants below are shared).

import { clock } from './loop';

export const LIFE = 4.5; // seconds a packet lives
export const SPEED = 320; // px/s the ring spreads at
export const DISP = 0.8; // how fast the packet widens (dispersion)
export const DECAY = 0.9; // amplitude decay per second
export const SPREAD = 80; // px over which the ring's energy thins as 1/sqrt

/** Idle swell: a few long directional waves [angle rad, wavelength px, speed px/s, amplitude, phase]. */
export const SWELL: number[][] = [
  [0.5, 760, 22, 0.07, 0.3],
  [2.3, 540, 18, 0.012, 1.9],
  [-0.9, 900, 26, 0.012, 4.1],
];

export const SLOTS = 40; // pointer / click / scroll packets
export const FLOAT_SLOTS = 8; // reserved for floating things' own small ripples
export const MAX_SOURCES = SLOTS + FLOAT_SLOTS;

export type Source = { x: number; y: number; t0: number; amp: number; size: number };

/** Set by the worker renderer's host: called with every new packet so it can be forwarded (a tiny message). */
export const hooks: { onAdd: ((s: Source, kind: 'ring' | 'float') => void) | null; also: Set<(s: Source, kind: 'ring' | 'float') => void> } = { onAdd: null, also: new Set() };

const main: (Source | null)[] = new Array(SLOTS).fill(null);
const floats: (Source | null)[] = new Array(FLOAT_SLOTS).fill(null);
let mi = 0;
let fi = 0;

/** Drop a packet at page position (x, docY). amp ~0.3 (a light touch) to ~1.6 (a click); size = packet width in px. */
export function addSource(x: number, docY: number, amp = 0.6, size = 14, opts: { kind?: 'ring' | 'float'; t?: number } = {}) {
  const s: Source = { x, y: docY, t0: opts.t ?? clock.t, amp, size };
  if (opts.kind === 'float') floats[fi++ % FLOAT_SLOTS] = s;
  else main[mi++ % SLOTS] = s;
  const kind = opts.kind === 'float' ? 'float' : 'ring';
  hooks.onAdd?.(s, kind);
  for (const f of hooks.also) f(s, kind);
}

/** Live sources, newest first, at most `max` (a quality knob), written as two vec4 arrays for the shader:
 *  a = (x, y, age, amp), b = (size, 0, 0, 0). Returns how many. */
export function packSources(t: number, max: number, a: Float32Array, b: Float32Array) {
  const live: Source[] = [];
  for (const s of main) if (s && t - s.t0 < LIFE) live.push(s);
  for (const s of floats) if (s && t - s.t0 < LIFE) live.push(s);
  live.sort((p, q) => q.t0 - p.t0);
  const n = Math.min(live.length, max);
  for (let i = 0; i < n; i++) {
    const s = live[i];
    a.set([s.x, s.y, t - s.t0, s.amp], i * 4);
    b[i * 4] = s.size;
  }
  return n;
}

export type Sample = { h: number; gx: number; gy: number };
const out: Sample = { h: 0, gx: 0, gy: 0 };

/** Surface height h (about -1..1) and slope (gx, gy) per px at page position (x, docY). The returned object is reused. */
export function sample(x: number, docY: number, t = clock.t): Sample {
  let h = 0;
  let gx = 0;
  let gy = 0;
  for (const list of [main, floats]) {
    for (const s of list) {
      if (!s) continue;
      const age = t - s.t0;
      if (age < 0 || age > LIFE) continue;
      const dx = x - s.x;
      const dy = docY - s.y;
      const r = Math.hypot(dx, dy);
      const sig = s.size * (1 + DISP * age);
      const R = SPEED * age;
      const d = r - R;
      if (Math.abs(d) > 3 * sig) continue;
      const A = (s.amp * Math.exp(-DECAY * age)) / Math.sqrt((1 + R / SPREAD) * (1 + DISP * age));
      const e = Math.exp(-0.5 * (d / sig) * (d / sig));
      h += A * e;
      const dh = (A * e * -(d / (sig * sig))) / Math.max(r, 0.001);
      gx += dh * dx;
      gy += dh * dy;
    }
  }
  for (const [ang, len, spd, a, ph] of SWELL) {
    const kx = (Math.cos(ang) * 2 * Math.PI) / len;
    const ky = (Math.sin(ang) * 2 * Math.PI) / len;
    const arg = kx * x + ky * docY - ((2 * Math.PI) / len) * spd * t + ph;
    h += a * Math.sin(arg);
    const c = a * Math.cos(arg);
    gx += c * kx;
    gy += c * ky;
  }
  out.h = h;
  out.gx = gx;
  out.gy = gy;
  return out;
}

/** Number of live packets (tests, debugging). */
export function liveCount(t = clock.t) {
  let n = 0;
  for (const list of [main, floats]) for (const s of list) if (s && t - s.t0 < LIFE) n++;
  return n;
}

const SPACING = 15; // px of travel between packets
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Pointer, touch and scroll make waves. Moving or dragging emits a packet every ~24 px along the path, stronger when
 * faster; a click or tap is a bigger ring; scrolling moves the page under a resting cursor, so the cursor's path in
 * page space is a line and emits the same way (the scroll wake).
 */
export function bindInput() {
  let ax = 0; // last emission anchor, page px
  let ay = 0;
  let has = false;
  let speed = 0; // px/ms, smoothed
  let at = 0;
  let mx = -1; // mouse, viewport px
  let my = -1;
  let mouseIn = false;
  let lastScroll = scrollY;

  const reset = (x: number, y: number, now: number) => {
    ax = x;
    ay = y;
    at = now;
    has = true;
    speed = 0;
  };
  const moveTo = (x: number, y: number, now: number, touch: boolean) => {
    if (!has) return reset(x, y, now);
    const dist = Math.hypot(x - ax, y - ay);
    if (dist < SPACING) return;
    const inst = dist / Math.max(6, now - at);
    speed = speed ? speed * 0.5 + inst * 0.5 : inst;
    const amp = clamp(0.22 + speed * 0.3, 0.22, 0.95) * (touch ? 1.15 : 1);
    const steps = Math.min(8, Math.floor(dist / SPACING));
    const ux = (x - ax) / dist;
    const uy = (y - ay) / dist;
    for (let i = 0; i < steps; i++) {
      ax += ux * SPACING;
      ay += uy * SPACING;
      addSource(ax, ay, amp * 0.8, 15 + clamp(speed * 3, 0, 8));
    }
    if (steps === 8) {
      ax = x;
      ay = y;
    }
    at = now;
  };

  const onMove = (e: PointerEvent) => {
    const touch = e.pointerType === 'touch';
    if (!touch) {
      mx = e.clientX;
      my = e.clientY;
      mouseIn = true;
    }
    moveTo(e.pageX, e.pageY, e.timeStamp, touch);
  };
  const onDown = (e: PointerEvent) => {
    reset(e.pageX, e.pageY, e.timeStamp);
    addSource(e.pageX, e.pageY, e.pointerType === 'touch' ? 1.7 : 1.4, 24);
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') has = false;
  };
  const onLeave = () => {
    mouseIn = false;
    has = false;
  };
  const onScroll = () => {
    const dy = scrollY - lastScroll;
    lastScroll = scrollY;
    if (!mouseIn || Math.abs(dy) < 0.5) return;
    moveTo(mx + scrollX, my + scrollY, performance.now(), false);
  };

  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onDown, { passive: true });
  addEventListener('pointerup', onUp, { passive: true });
  addEventListener('pointercancel', onUp, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  addEventListener('scroll', onScroll, { passive: true });
  return () => {
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerdown', onDown);
    removeEventListener('pointerup', onUp);
    removeEventListener('pointercancel', onUp);
    document.removeEventListener('pointerleave', onLeave);
    removeEventListener('scroll', onScroll);
  };
}
