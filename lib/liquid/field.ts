// The wave field. The page is a dark liquid; this is its surface height, computed analytically (no simulation, no
// readback): a sum of wave humps, each a ring that spreads from where something touched, plus an idle swell that is
// always there. Sources live in PAGE CSS px (x, docY), so scrolling drags the liquid past the viewport.
// `sample()` here and the fragment shader in render.ts evaluate exactly the same formula (constants below are shared).

import { clock } from './loop';

export const LIFE = 4; // seconds a packet lives
export const SPEED = 320; // px/s the ring spreads at (also the speed every wake disk grows at)
export const DISP = 0.8; // how fast the packet widens (dispersion)
export const DECAY = 0.45; // amplitude decay per second
export const SPREAD = 80; // px over which the ring's energy thins as 1/sqrt
export const SEGSIG = 20; // px: width of a wake's hump (refraction), before it widens with age
export const TAPGAP = 40; // px between a tap's two rings
export const TRAIL = 28; // px a wake's fainter trailing line sits inside its front

/** Idle swell: a few long directional waves [angle rad, wavelength px, speed px/s, amplitude, phase]. The first one also
 *  draws a faint straight crest line (never closed loops); the others only refract. */
export const SWELL: number[][] = [
  [0.5, 760, 22, 0.07, 0.3],
  [2.3, 540, 18, 0.012, 1.9],
  [-0.9, 900, 26, 0.012, 4.1],
];

export const SLOTS = 96; // pointer / click / scroll vertices
export const FLOAT_SLOTS = 8; // reserved for floating things' own small ripples
export const MAX_SOURCES = 48; // entries the shader reads (taps, wake segments, floats)

// A source is one of: a tap ring (size >= 24), a floater's ripple (kind 'float'), or one vertex of a pointer / scroll
// wake. A wake vertex is told apart by its size (this travels unchanged to the 3D workers): VERT_START begins a new stroke,
// VERT_CONT continues the previous vertex. A stroke is a polyline whose every vertex is a disk growing at SPEED.
export const VERT_START = 21;
export const VERT_CONT = 20;
export type Source = { x: number; y: number; t0: number; amp: number; size: number; f?: boolean; sid?: number; px?: number; py?: number; pt?: number };

/** Set by the worker renderer's host: called with every new packet so it can be forwarded (a tiny message). */
export const hooks: { onAdd: ((s: Source, kind: 'ring' | 'float') => void) | null; also: Set<(s: Source, kind: 'ring' | 'float') => void> } = { onAdd: null, also: new Set() };

const main: (Source | null)[] = new Array(SLOTS).fill(null);
const floats: (Source | null)[] = new Array(FLOAT_SLOTS).fill(null);
let mi = 0;
let fi = 0;
let sidN = 0;
let lastV: Source | null = null;
let version = 0;

// Birth time on the rAF clock. clock.t only moves while a frame callback runs (not before the float loop starts, and
// slowly on a starved phone), so a stale value would make a fresh packet look old and expire at once.
const now = () => (typeof performance === 'undefined' ? clock.t : Math.max(clock.t, performance.now() / 1000));

/** Drop a source at page position (x, docY). A tap: amp ~1.9, size 24. A wake vertex: size VERT_START / VERT_CONT. */
export function addSource(x: number, docY: number, amp = 0.6, size = 24, opts: { kind?: 'ring' | 'float'; t?: number } = {}) {
  const s: Source = { x, y: docY, t0: opts.t ?? now(), amp, size, f: opts.kind === 'float' };
  if (opts.kind === 'float') floats[fi++ % FLOAT_SLOTS] = s;
  else {
    if (size === VERT_START || size === VERT_CONT) {
      if (size === VERT_CONT && lastV) {
        s.sid = lastV.sid;
        s.px = lastV.x;
        s.py = lastV.y;
        s.pt = lastV.t0;
      } else s.sid = ++sidN;
      lastV = s;
    }
    main[mi++ % SLOTS] = s;
  }
  version++;
  const kind = opts.kind === 'float' ? 'float' : 'ring';
  hooks.onAdd?.(s, kind);
  for (const f of hooks.also) f(s, kind);
}

type Pt = { x: number; y: number; t: number; amp: number };
type Frame = { taps: Source[]; floats: Source[]; strokes: Pt[][]; key: string };
let cached: Frame | null = null;

/** What is alive at time t: taps, floaters' ripples and the strokes as polylines (points not yet born are cut off at the
 *  moment's position along their segment). Cached per (t, version): the CPU `sample()` and the packer share it. */
function collect(t: number): Frame {
  const key = t + ':' + version;
  if (cached && cached.key === key) return cached;
  const taps: Source[] = [];
  const fl: Source[] = [];
  const byId = new Map<number, Source[]>();
  for (const s of main) {
    if (!s || t - s.t0 >= LIFE) continue;
    if (s.sid !== undefined) {
      let l = byId.get(s.sid);
      if (!l) byId.set(s.sid, (l = []));
      l.push(s);
    } else if (t >= s.t0) taps.push(s);
  }
  for (const s of floats) if (s && t >= s.t0 && t - s.t0 < LIFE) fl.push(s);
  taps.sort((p, q) => q.t0 - p.t0);
  fl.sort((p, q) => q.t0 - p.t0);
  const strokes: Pt[][] = [];
  for (const l of byId.values()) {
    l.sort((p, q) => p.t0 - q.t0);
    const pts: Pt[] = [];
    const f0 = l[0];
    if (f0.px !== undefined && t - f0.pt! < LIFE) pts.push({ x: f0.px, y: f0.py!, t: f0.pt!, amp: f0.amp });
    for (const s of l) pts.push({ x: s.x, y: s.y, t: s.t0, amp: s.amp });
    // cut at "now": the head of a wake born in the future (a flick is laid down at VCAP) is where it has got to
    const live: Pt[] = [];
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].t <= t) live.push(pts[i]);
      else {
        if (live.length) {
          const a = live[live.length - 1];
          const k = (t - a.t) / Math.max(1e-6, pts[i].t - a.t);
          live.push({ x: a.x + (pts[i].x - a.x) * k, y: a.y + (pts[i].y - a.y) * k, t, amp: pts[i].amp });
        }
        break;
      }
    }
    if (live.length) strokes.push(live);
  }
  strokes.sort((p, q) => q[q.length - 1].t - p[p.length - 1].t);
  cached = { taps, floats: fl, strokes, key };
  return cached;
}

/** Live entries for the shader, as two vec4 arrays: a = (x, y, age, amp); b = tap/float: (size, 0, 0, kind 0|1), wake
 *  segment: (x1, y1, age1, kind 2 = same stroke as the previous segment | 3 = a new stroke). Newest first; a wake is cut
 *  to its budget by dropping the in-between vertices (never its ends), so the tail is not chopped off. `max` is the quality
 *  knob. Returns how many entries. */
export function packSources(t: number, max: number, a: Float32Array, b: Float32Array) {
  const fr = collect(t);
  const nf = Math.min(fr.floats.length, max >= 16 ? 4 : max >= 12 ? 2 : 1);
  const nt = Math.min(fr.taps.length, max >= 24 ? 6 : max >= 12 ? 3 : 2);
  const budget = Math.max(1, max - nf - nt);
  let k = 1;
  const count = (kk: number) => fr.strokes.reduce((n, s) => n + Math.ceil(Math.max(0, s.length - 1) / kk) + (s.length === 1 ? 1 : 0), 0);
  while (k < 64 && count(k) > budget) k++;
  let n = 0;
  const put = (x: number, y: number, age: number, amp: number, b0: number, b1: number, b2: number, b3: number) => {
    a[n * 4] = x;
    a[n * 4 + 1] = y;
    a[n * 4 + 2] = age;
    a[n * 4 + 3] = amp;
    b[n * 4] = b0;
    b[n * 4 + 1] = b1;
    b[n * 4 + 2] = b2;
    b[n * 4 + 3] = b3;
    n++;
  };
  for (let i = 0; i < nt; i++) put(fr.taps[i].x, fr.taps[i].y, t - fr.taps[i].t0, fr.taps[i].amp, fr.taps[i].size, 0, 0, 0);
  for (const st of fr.strokes) {
    if (n >= max - nf) break;
    const idx: number[] = [];
    for (let i = 0; i < st.length - 1; i += k) idx.push(i);
    idx.push(st.length - 1);
    if (idx.length === 1) {
      const p = st[idx[0]];
      put(p.x, p.y, t - p.t, p.amp, p.x, p.y, t - p.t, 3);
      continue;
    }
    for (let j = 0; j + 1 < idx.length && n < max - nf; j++) {
      const p = st[idx[j]];
      const q = st[idx[j + 1]];
      put(p.x, p.y, t - p.t, q.amp, q.x, q.y, t - q.t, j === 0 ? 3 : 2);
    }
  }
  for (let i = 0; i < nf; i++) put(fr.floats[i].x, fr.floats[i].y, t - fr.floats[i].t0, fr.floats[i].amp, fr.floats[i].size, 0, 0, 1);
  return n;
}

/** Calm zones (page px rects x, y, w, h, e.g. the ASCII portraits): crest lines fade out inside them. Max CALM_MAX. */
export const CALM_MAX = 6;
export const calm: number[] = [];
export function setCalm(rects: number[]) {
  calm.length = 0;
  for (let i = 0; i < Math.min(rects.length, CALM_MAX * 4); i++) calm.push(rects[i]);
}

export type Sample = { h: number; gx: number; gy: number };
const out: Sample = { h: 0, gx: 0, gy: 0 };

// --- the wave formula. Everything below is written twice, here and in GLSL (shader.ts): keep them the same. ---

const co = { d: 0, gx: 0, gy: 0, s: 0 };
/** Signed distance from (px, py) to the union of disks that grow along the segment a->b (radius r1 at a, r2 at b, linear):
 *  a cone segment. co.{gx,gy} = direction of increasing distance, co.s = where along the segment the nearest point is. */
export function cone(px: number, py: number, ax: number, ay: number, bx: number, by: number, r1: number, r2: number) {
  const bax = bx - ax;
  const bay = by - ay;
  const h = Math.hypot(bax, bay);
  const qx = px - ax;
  const qy = py - ay;
  if (h < 0.5 || Math.abs(r1 - r2) >= 0.999 * h) {
    // one disk holds the other (or a point): the bigger one
    if (r1 >= r2) {
      const l = Math.max(Math.hypot(qx, qy), 0.001);
      co.gx = qx / l;
      co.gy = qy / l;
      co.s = 0;
      return (co.d = l - r1);
    }
    const q2x = px - bx;
    const q2y = py - by;
    const l = Math.max(Math.hypot(q2x, q2y), 0.001);
    co.gx = q2x / l;
    co.gy = q2y / l;
    co.s = 1;
    return (co.d = l - r2);
  }
  const ux = bax / h;
  const uy = bay / h;
  const nx = -uy;
  const ny = ux;
  const y = qx * ux + qy * uy;
  const x = qx * nx + qy * ny;
  const sx = x < 0 ? -1 : 1;
  const axx = Math.abs(x);
  const bb = (r1 - r2) / h;
  const aa = Math.sqrt(1 - bb * bb);
  const k = -bb * axx + aa * y;
  if (k < 0) {
    const l = Math.max(Math.hypot(axx, y), 0.001);
    co.gx = (nx * x + ux * y) / l;
    co.gy = (ny * x + uy * y) / l;
    co.s = 0;
    return (co.d = l - r1);
  }
  if (k > aa * h) {
    const l = Math.max(Math.hypot(axx, y - h), 0.001);
    co.gx = (nx * x + ux * (y - h)) / l;
    co.gy = (ny * x + uy * (y - h)) / l;
    co.s = 1;
    return (co.d = l - r2);
  }
  co.gx = nx * aa * sx + ux * bb;
  co.gy = ny * aa * sx + uy * bb;
  co.s = Math.min(1, Math.max(0, y / h));
  return (co.d = aa * axx + bb * y - r1);
}

/** Crest strength 0..1 of a front of this age and amplitude: it fades with age and is gone by ~2.8 s. */
export function strength(age: number, amp: number) {
  const f = Math.min(1, (age - 1.8) / 1.0);
  const sm = f <= 0 ? 0 : f * f * (3 - 2 * f);
  return Math.min(1, amp * 1.3 * Math.exp(-0.4 * age)) * (1 - sm);
}

/** Surface height h (about -1..1) and slope (gx, gy) per px at page position (x, docY). The returned object is reused. */
export function sample(x: number, docY: number, t = clock.t): Sample {
  let h = 0;
  let gx = 0;
  let gy = 0;
  const fr = collect(t);
  // a tap or a floater's ripple: a ring hump
  const ring = (s: Source) => {
    const age = t - s.t0;
    const dx = x - s.x;
    const dy = docY - s.y;
    const r = Math.hypot(dx, dy);
    const sig = s.size * (1 + DISP * age);
    const d = r - SPEED * age;
    if (Math.abs(d) > 3 * sig) return;
    const R = SPEED * age;
    const A = (s.amp * Math.exp(-DECAY * age)) / Math.sqrt((1 + R / SPREAD) * (1 + DISP * age));
    const e = Math.exp(-0.5 * (d / sig) * (d / sig));
    h += A * e;
    const dh = (A * e * -(d / (sig * sig))) / Math.max(r, 0.001);
    gx += dh * dx;
    gy += dh * dy;
  };
  for (const s of fr.taps) ring(s);
  for (const s of fr.floats) ring(s);
  // a wake: the hump rides the boundary of the union of its growing disks
  for (const stroke of fr.strokes) {
    const st = stroke.length === 1 ? [stroke[0], stroke[0]] : stroke;
    let dS = 1e3;
    let gsx = 0;
    let gsy = 0;
    let aS = 0;
    let mS = 0;
    for (let i = 0; i + 1 < st.length; i++) {
      const p = st[i];
      const q = st[i + 1];
      const a0 = t - p.t;
      const a1 = t - q.t;
      const r1 = SPEED * a0;
      const r2 = SPEED * a1;
      const mx = (p.x + q.x) * 0.5;
      const my = (p.y + q.y) * 0.5;
      const bound = Math.hypot(x - mx, docY - my) - (Math.hypot(q.x - p.x, q.y - p.y) * 0.5 + Math.max(r1, r2));
      if (bound > 3 * SEGSIG * (1 + DISP * Math.max(a0, a1))) continue;
      const d = cone(x, docY, p.x, p.y, q.x, q.y, r1, r2);
      if (d < dS) {
        dS = d;
        gsx = co.gx;
        gsy = co.gy;
        aS = a0 + (a1 - a0) * co.s;
        mS = q.amp;
      }
    }
    if (dS < 1e2) {
      const sig = SEGSIG * (1 + DISP * aS);
      if (Math.abs(dS) < 3 * sig) {
        const R = SPEED * aS;
        const A = (mS * Math.exp(-DECAY * aS)) / Math.sqrt((1 + R / SPREAD) * (1 + DISP * aS));
        const e = Math.exp(-0.5 * (dS / sig) * (dS / sig));
        h += A * e;
        gx += gsx * (A * e * (-dS / (sig * sig)));
        gy += gsy * (A * e * (-dS / (sig * sig)));
      }
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

/** Number of live sources (tests, debugging). */
export function liveCount(t = clock.t) {
  let n = 0;
  for (const list of [main, floats]) for (const s of list) if (s && t - s.t0 < LIFE) n++;
  return n;
}

const SPACING = 22; // px of travel between wake vertices
const VCAP = 1100; // px/s: a wake is laid down at this speed at most (births stagger into the future), so a flick is a V
const MAXSTEPS = 80;
const TAP_PX = 10; // travel between down and up above which it was a drag, not a tap
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Pointer, touch and scroll make waves. Moving or dragging lays a stroke: a vertex every ~22 px along the path, each a disk
 * that grows at wave speed, so the front is the boundary of their union (a V behind a fast pointer, a teardrop as it slows,
 * nothing at all where it stops). A tap (down and up in place) is a ring. Scrolling moves the page under a resting cursor,
 * so the cursor's path in page space is a line and lays a stroke the same way (the scroll wake).
 */
export function bindInput() {
  let ax = 0; // last vertex, page px
  let ay = 0;
  let has = false;
  let fresh = true; // the next vertex starts a new stroke
  let speed = 0; // px/ms, smoothed
  let tv = 0; // birth time of the newest vertex
  let at = 0; // time of the last movement (event clock)
  let mx = -1; // mouse, viewport px
  let my = -1;
  let mouseIn = false;
  let lastScroll = scrollY;
  let down: { x: number; y: number; t: number } | null = null;

  const vertex = (x: number, y: number, amp: number, start: boolean, t: number) =>
    addSource(x, y, amp, start ? VERT_START : VERT_CONT, { t });
  const reset = (x: number, y: number, ts: number) => {
    ax = x;
    ay = y;
    at = ts;
    has = true;
    fresh = true;
    speed = 0;
  };
  const moveTo = (x: number, y: number, ts: number, touch: boolean) => {
    if (!has) reset(x, y, ts);
    const dist = Math.hypot(x - ax, y - ay);
    if (dist < SPACING) return;
    const inst = dist / Math.max(6, ts - at);
    speed = speed ? speed * 0.5 + inst * 0.5 : inst;
    const amp = clamp(0.5 + speed * 0.3, 0.5, 1.0) * (touch ? 1.15 : 1);
    const steps = Math.min(MAXSTEPS, Math.floor(dist / SPACING));
    const ux = (x - ax) / dist;
    const uy = (y - ay) / dist;
    const t1 = now();
    if (fresh) {
      tv = t1;
      vertex(ax, ay, amp, true, tv);
      fresh = false;
    }
    for (let i = 0; i < steps; i++) {
      ax += ux * SPACING;
      ay += uy * SPACING;
      tv = Math.max(t1, tv + SPACING / VCAP);
      vertex(ax, ay, amp, false, tv);
    }
    if (steps === MAXSTEPS) {
      ax = x;
      ay = y;
    }
    at = ts;
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
    down = { x: e.pageX, y: e.pageY, t: e.timeStamp };
    reset(e.pageX, e.pageY, e.timeStamp);
  };
  // A tap is one ring, made when the pointer comes up where it went down. Anything that travelled is a drag (it already
  // laid its wake): no ring at its end.
  const onUp = (e: PointerEvent) => {
    const d = down;
    down = null;
    if (e.type === 'pointerup' && d && Math.hypot(e.pageX - d.x, e.pageY - d.y) <= TAP_PX && e.timeStamp - d.t < 800) {
      addSource(e.pageX, e.pageY, e.pointerType === 'touch' ? 2.1 : 1.9, 24);
    }
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
