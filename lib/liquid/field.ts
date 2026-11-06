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
export const APPROACH_WINDOW = 1.0; // s before a tap in which the pointer's approach wake is weakened near the tap
export const APPROACH_AHEAD = 0.12; // s after: a flick is laid down with births staggered into the future
export const APPROACH_NEAR = 140; // px: no approach wake at all within this of the tap ...
export const APPROACH_FAR = 380; // ... full strength beyond this
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
export type Source = { x: number; y: number; t0: number; amp: number; size: number; f?: boolean; fade?: number; sid?: number; px?: number; py?: number; pt?: number };

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
type Frame = { taps: Source[]; floats: Source[]; strokes: Pt[][]; hulls: Piece[][]; key: string };
let cached: Frame | null = null;

type Disk = { x: number; y: number; r: number; amp: number; age: number };
/** A disk of the wake's convex hull, in order around it. (nax, nay) = normal of the straight bridge that arrives at this disk
 *  from the previous one; (0, 0) when the hull is this one disk. The disk's arc runs from that normal to the next disk's. */
export type Piece = Disk & { nax: number; nay: number };
const TAU = Math.PI * 2;

/** The convex hull of a stroke's disks (every vertex is a disk of radius SPEED * age): bridges (tangent lines) and arcs. Wave
 *  fronts that cross make creases and cusps where a path bends (the inside of a turn); the hull has none, so a wake is always
 *  one smooth teardrop. `k` keeps every k-th vertex (and both ends) when the shader's entry budget is small. */
function hullOf(st: Pt[], t: number, k: number): Piece[] {
  const ds: Disk[] = [];
  for (let i = 0; i < st.length; i += k) ds.push({ x: st[i].x, y: st[i].y, r: SPEED * (t - st[i].t), amp: st[i].amp, age: t - st[i].t });
  if (k > 1 && (st.length - 1) % k) ds.push({ x: st[st.length - 1].x, y: st[st.length - 1].y, r: SPEED * (t - st[st.length - 1].t), amp: st[st.length - 1].amp, age: t - st[st.length - 1].t });
  // drop disks that lie inside another
  const keep: Disk[] = [];
  for (let i = 0; i < ds.length; i++) {
    let inside = false;
    for (let j = 0; j < ds.length && !inside; j++) {
      if (j === i) continue;
      const m = Math.hypot(ds[i].x - ds[j].x, ds[i].y - ds[j].y) + ds[i].r - ds[j].r;
      inside = m < -0.05 || (m <= 0.05 && j < i);
    }
    if (!inside) keep.push(ds[i]);
  }
  if (keep.length <= 1) return [{ ...keep[0], nax: 0, nay: 0 }];
  // gift wrapping around the disks: from the one furthest along +x, always to the disk whose bridge turns next
  let i0 = 0;
  for (let i = 1; i < keep.length; i++) if (keep[i].x + keep[i].r > keep[i0].x + keep[i0].r) i0 = i;
  const order = [i0];
  const norm: number[] = []; // angle of the bridge leaving order[n]
  let cur = i0;
  let th = 0;
  for (let it = 0; it <= keep.length + 1; it++) {
    let best = -1;
    let bd = 1e9;
    let bphi = 0;
    const c = keep[cur];
    for (let j = 0; j < keep.length; j++) {
      if (j === cur) continue;
      const dx = keep[j].x - c.x;
      const dy = keep[j].y - c.y;
      const h = Math.hypot(dx, dy);
      const phi = Math.atan2(dy, dx) - Math.acos(Math.max(-1, Math.min(1, (c.r - keep[j].r) / h)));
      let dd = (((phi - th) % TAU) + TAU) % TAU;
      if (dd > TAU - 1e-7) dd = 0;
      if (dd < bd) {
        bd = dd;
        best = j;
        bphi = phi;
      }
    }
    if (best < 0) break;
    norm.push(bphi);
    th = bphi;
    if (best === i0) break;
    order.push(best);
    cur = best;
  }
  if (order.length < 2 || norm.length !== order.length) {
    const big = keep.reduce((a, b) => (b.r > a.r ? b : a));
    return [{ ...big, nax: 0, nay: 0 }];
  }
  const out: Piece[] = [];
  order.forEach((o, n) => {
    const a = norm[(n + order.length - 1) % order.length];
    const b = norm[n];
    // a disk whose arc has no extent (collinear disks all touch the same two bridges) adds nothing: the bridges are one line
    if (order.length > 3 && (((b - a) % TAU) + TAU) % TAU < 1e-3) return;
    out.push({ ...keep[o], nax: Math.cos(a), nay: Math.sin(a) });
  });
  return out.length >= 2 ? out : [{ ...keep[order[0]], nax: 0, nay: 0 }];
}

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
  // The pointer's approach to a click is part of the click: wake vertices born just before a tap and near it are weakened
  // (the closer, the more), so the tap reads as one set of centred rings instead of rings plus an offset wake front.
  for (const l of byId.values()) {
    for (const v of l) {
      let w = 1;
      if (taps.length) {
        for (const tp of taps) {
          const dt = tp.t0 - v.t0;
          if (dt < -APPROACH_AHEAD || dt > APPROACH_WINDOW) continue;
          const u = Math.min(1, Math.max(0, (Math.hypot(v.x - tp.x, v.y - tp.y) - APPROACH_NEAR) / (APPROACH_FAR - APPROACH_NEAR)));
          w = Math.min(w, u * u * (3 - 2 * u));
        }
      }
      v.fade = w;
    }
  }
  fl.sort((p, q) => q.t0 - p.t0);
  const strokes: Pt[][] = [];
  for (const l of byId.values()) {
    l.sort((p, q) => p.t0 - q.t0);
    const pts: Pt[] = [];
    const f0 = l[0];
    if (f0.px !== undefined && t - f0.pt! < LIFE) pts.push({ x: f0.px, y: f0.py!, t: f0.pt!, amp: f0.amp * (f0.fade ?? 1) });
    for (const s of l) pts.push({ x: s.x, y: s.y, t: s.t0, amp: s.amp * (s.fade ?? 1) });
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
    // vertices weakened to nothing (the approach to a tap) are not part of the wake
    const kept = live.filter((p) => p.amp > 0.03);
    if (kept.length) strokes.push(kept);
  }
  strokes.sort((p, q) => q[q.length - 1].t - p[p.length - 1].t);
  const hulls = strokes.map((st) => hullOf(st, t, 1));
  cached = { taps, floats: fl, strokes, hulls, key };
  return cached;
}

/** Live entries for the shader, as two vec4 arrays: a = (x, y, age, amp); b = tap/float: (size, 0, 0, kind 0|1), wake: one
 *  entry per disk of the stroke's convex hull, in order (b = (nax, nay, 0, kind 2 = same stroke as the previous entry | 3 = a
 *  new stroke), (nax, nay) = the bridge normal arriving at the disk, see `Piece`). Newest first. `max` is the quality knob: a
 *  wake that would not fit is thinned (every k-th vertex, never its ends) before its hull is taken. Returns how many entries. */
export function packSources(t: number, max: number, a: Float32Array, b: Float32Array) {
  const fr = collect(t);
  const nf = Math.min(fr.floats.length, max >= 16 ? 4 : max >= 12 ? 2 : 1);
  const nt = Math.min(fr.taps.length, max >= 24 ? 6 : max >= 12 ? 3 : 2);
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
  for (let si = 0; si < fr.strokes.length; si++) {
    const room = max - nf - n;
    if (room < 1) break;
    let hull = fr.hulls[si];
    for (let k = 2; hull.length > room && k < 64; k++) hull = hullOf(fr.strokes[si], t, k);
    if (hull.length > room) continue;
    hull.forEach((p, i) => put(p.x, p.y, p.age, p.amp, p.nax, p.nay, 0, i === 0 ? 3 : 2));
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

const co = { d: 0, gx: 0, gy: 0, age: 0, amp: 0 };
/** Signed distance from (px, py) to the convex hull of a wake's disks (negative inside), exact: the hull's support function is
 *  c.n + r over each disk's arc of normals, so the distance is the largest over every bridge line and every disk whose arc
 *  faces the point. co.{gx,gy} = direction of increasing distance, co.{age,amp} = what the front there is made of (a bridge
 *  blends its two disks'). */
export function hullD(px: number, py: number, h: Piece[]) {
  let d = -1e9;
  const n = h.length;
  for (let k = 0; k < n; k++) {
    const P = h[k];
    const Q = h[(k + 1) % n];
    const vx = px - P.x;
    const vy = py - P.y;
    const l = Math.max(Math.hypot(vx, vy), 0.001);
    const r = SPEED * P.age;
    if (n === 1) {
      co.gx = vx / l;
      co.gy = vy / l;
      co.age = P.age;
      co.amp = P.amp;
      return (co.d = l - r);
    }
    const ux = P.nax;
    const uy = P.nay;
    const wx = Q.nax;
    const wy = Q.nay;
    // arc: the disk is the nearest part when the point's direction lies between the arriving and the leaving normal
    const inr = ux * wy - uy * wx >= 0 ? ux * vy - uy * vx >= 0 && vx * wy - vy * wx >= 0 : !(wx * vy - wy * vx > 0 && vx * uy - vy * ux > 0);
    if (inr && l - r > d) {
      d = l - r;
      co.gx = vx / l;
      co.gy = vy / l;
      co.age = P.age;
      co.amp = P.amp;
    }
    // bridge to the next disk (its tangent line)
    const dl = vx * wx + vy * wy - r;
    if (dl > d) {
      d = dl;
      co.gx = wx;
      co.gy = wy;
      const tx = -wy;
      const ty = wx;
      const r2 = SPEED * Q.age;
      const len = (Q.x + r2 * wx - P.x - r * wx) * tx + (Q.y + r2 * wy - P.y - r * wy) * ty;
      const s = len > 0.001 ? Math.min(1, Math.max(0, ((px - P.x - r * wx) * tx + (py - P.y - r * wy) * ty) / len)) : 0;
      co.age = P.age + (Q.age - P.age) * s;
      co.amp = P.amp + (Q.amp - P.amp) * s;
    }
  }
  return (co.d = d);
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
  // a wake: the hump rides the boundary of the convex hull of its growing disks
  for (const hull of fr.hulls) {
    const dS = hullD(x, docY, hull);
    const aS = co.age;
    const sig = SEGSIG * (1 + DISP * aS);
    if (Math.abs(dS) < 3 * sig) {
      const R = SPEED * aS;
      const A = (co.amp * Math.exp(-DECAY * aS)) / Math.sqrt((1 + R / SPREAD) * (1 + DISP * aS));
      const e = Math.exp(-0.5 * (dS / sig) * (dS / sig));
      h += A * e;
      gx += co.gx * (A * e * (-dS / (sig * sig)));
      gy += co.gy * (A * e * (-dS / (sig * sig)));
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
 * that grows at wave speed, so the front is the boundary of their convex hull (a V behind a fast pointer, a teardrop as it slows,
 * nothing at all where it stops). A tap (down and up in place) is a ring. Scrolling moves the page under a resting cursor,
 * so the cursor's path in page space is a line and lays a stroke the same way (the scroll wake).
 */
export function bindInput() {
  let ax = 0; // last vertex, page px
  let ay = 0;
  let ex = 0; // last event, page px
  let ey = 0;
  let cx = 0; // start of the next smoothed curve piece (midpoint of the last two events)
  let cy = 0;
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
    ex = x;
    ey = y;
    cx = x;
    cy = y;
    at = ts;
    has = true;
    fresh = true;
    speed = 0;
  };
  // Lay vertices every SPACING px along the straight way from the last vertex to (x, y).
  const lay = (x: number, y: number, amp: number) => {
    const dist = Math.hypot(x - ax, y - ay);
    if (dist < SPACING) return;
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
  };
  // The path is smoothed: events are corners, the wake follows the quadratic curve through the midpoints between them (so
  // sparse or uneven touch/mouse events cannot make a kink), laid at even arc length. It trails the pointer by half an event;
  // `flush` lays the rest once the pointer has paused or lifted.
  let flushT = 0;
  let amp0 = 0.5;
  const flush = () => {
    clearTimeout(flushT);
    if (!has) return;
    lay(ex, ey, amp0);
    cx = ex;
    cy = ey;
  };
  const moveTo = (x: number, y: number, ts: number, touch: boolean) => {
    if (!has) reset(x, y, ts);
    const dist = Math.hypot(x - ex, y - ey);
    if (dist < 4) return;
    const inst = dist / Math.max(6, ts - at);
    speed = speed ? speed * 0.5 + inst * 0.5 : inst;
    const amp = (amp0 = clamp(0.5 + speed * 0.3, 0.5, 1.0) * (touch ? 1.15 : 1));
    const mx1 = (ex + x) * 0.5;
    const my1 = (ey + y) * 0.5;
    const K = Math.min(24, Math.max(2, Math.ceil(dist / 10)));
    for (let j = 1; j <= K; j++) {
      const u = j / K;
      const w0 = (1 - u) * (1 - u);
      const w1 = 2 * u * (1 - u);
      const w2 = u * u;
      lay(w0 * cx + w1 * ex + w2 * mx1, w0 * cy + w1 * ey + w2 * my1, amp);
    }
    cx = mx1;
    cy = my1;
    ex = x;
    ey = y;
    at = ts;
    clearTimeout(flushT);
    flushT = setTimeout(flush, 60) as unknown as number;
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
    flush();
    if (e.type === 'pointerup' && d && Math.hypot(e.pageX - d.x, e.pageY - d.y) <= TAP_PX && e.timeStamp - d.t < 800) {
      addSource(e.pageX, e.pageY, e.pointerType === 'touch' ? 2.1 : 1.9, 24);
    }
    if (e.pointerType === 'touch') has = false;
  };
  const onLeave = () => {
    flush();
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
