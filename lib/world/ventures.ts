// The ventures in the world: three cast-metal monoliths rise out of the lava as the journey reaches them
// (place `ventures`, skimming the night sea). Module `ventures` (ARCHITECTURE.md): GLSL hooks hit / shade / env / sea in
// lib/world/glsl/monolith.glsl; this file computes their poses on the CPU every frame, owns the section's behaviour
// (hover, focus, touch and press heat a monolith; each link's hit area is laid over its monolith's projection, so the
// monolith and its words are one link that works by tap), and queues a ripple for the lava on a press.
// Framework-free (no React). The section's markup is components/world/Ventures.tsx (static).

import type { WorldModule } from './modules';
import type { Frame, V3 } from './frame';
import { V, clamp } from './frame';
import type { Uniforms } from './gl';
import { haptic } from '@/lib/haptic';
import monolithGlsl from './glsl/monolith.glsl';
import { keys, type Key } from './journey';

export type Vec3 = V3;

/** Half width, half height, half depth, fillet radius: a monolith is 10 units tall, times SCALE world units. */
export const MONO_E: [number, number, number, number] = [1.6, 5.0, 0.42, 0.12];
/** World units (~m) per monolith unit: 11 makes them 110 m tall, against a camera 3 m above the sea. */
const SCALE = 11;
/** Where they stand: this far along the circle past the ventures place's first key, and the layouts in
 * monolith units in the place's frame (x right, z toward the camera), yaw offsets from the hero angle (rad). */
const AHEAD = 30 + 420;
const LAYOUT = {
  // desktop: right of the heading, at about 42%, 62% and 82% of the width, the two still forging a little further back
  wide: { pos: [[-3.4, 0], [5.6, -3], [14.6, -1]] as const, aim: [-0.075, 0.075, -0.11] },
  // phones: the live one in front, centred; the two forging ones behind it to either side
  narrow: { pos: [[0.4, 11], [-5.0, -1], [5.0, -12]] as const, aim: [-0.06, 0.08, -0.1] },
};
const KINDS = [0, 1, 1];
/** The monoliths' own light (heat, the pool, the lava-lit air) in the world's radiance unit. */
const GAIN = 4;
/** What the faces mirror of the lava (the sea, the pool at the foot, the lava-lit air), kept low so above the foot the
 * metal reads as bare metal under the moon, not as a glowing slab. */
const ENVK = 1.4;
/** Forward lean of each monolith (rad, toward the camera). */
const LEAN = [0.05, 0.035, 0.06]; // Crucible Sites cooled (live), Verge and Trellis still forging

// ---- state fed by the DOM -------------------------------------------------------------------------------------------
const S = {
  hoverT: [0, 0, 0],
  hover: [0, 0, 0],
  hoverV: [0, 0, 0],
  press: [0, 0, 0],
  lift: [0, 0, 0],
  liftV: [0, 0, 0],
};
/** Screen boxes (CSS px, viewport) of each monolith's part above the sea, and its rise; written every frame. */
export const ventureBoxes = [0, 1, 2].map(() => ({ x: 0, y: 0, w: 0, h: 0, vis: false, rise: 0 }));
/** Ripple requests for the lava (world position on the sea, strength 0..1); lava drains this queue. */
export const ventureRipples: { p: V3; k: number }[] = [];
const feet: V3[] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

/** The monoliths' reflections in the sea, for lava's crisp pass: per monolith from its waterline down to 1.2x its
 * visible height (or the screen bottom), a little wider for the ripples; the union, viewport CSS px, or null. */
export function ventureReflectBoxes(f: Frame): [number, number, number, number] | null {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const b of ventureBoxes) {
    if (!b.vis) continue;
    const pad = b.w * 0.08 + 4;
    x0 = Math.min(x0, b.x - pad);
    x1 = Math.max(x1, b.x + b.w + pad);
    y0 = Math.min(y0, b.y + b.h - 4);
    y1 = Math.max(y1, Math.min(f.h, b.y + b.h + 1.2 * b.h));
  }
  return x1 > x0 && y1 > y0 ? [Math.max(0, x0), Math.max(0, y0), Math.min(f.w, x1), y1] : null;
}

export function setVentureHover(i: number, on: boolean) {
  S.hoverT[i] = on ? 1 : 0;
}
export function pressVenture(i: number) {
  S.press[i] = 1;
  ventureRipples.push({ p: feet[i], k: 1 });
  if (ventureRipples.length > 8) ventureRipples.shift();
}

/** The rise of monolith i for the section's pin progress p: one after another over the first ~65% of the pin. */
export const riseAt = (p: number, i: number) => {
  const c = clamp((p - (0.0 + i * 0.05)) / 0.16);
  return c * c * (3 - 2 * c);
};

function spring(x: number, v: number, to: number, dt: number, tau: number): [number, number] {
  if (dt <= 0) return [x, v];
  const w = 1 / tau,
    d = x - to,
    c = v + w * d,
    e = Math.exp(-w * dt);
  return [to + (d + c * dt) * e, (v - c * w * dt) * e];
}

// Planck at three wavelengths with the compressed brightness of the GLSL (for the analytic environment's colours)
function bb(T: number): V3 {
  if (T < 600) return [0, 0, 0];
  const lam = [0.61, 0.55, 0.465];
  const b = lam.map((l) => 1 / (l ** 5 * (Math.exp(14388 / (l * T)) - 1)));
  const x = T / 1811,
    s = clamp((T - 640) / 220),
    k = x ** 6 * s * s * (3 - 2 * s);
  return [k, (b[1] / b[0]) * k, (b[2] / b[0]) * k];
}

const U = {
  P: new Float32Array(12),
  M: new Float32Array(27),
  K: new Float32Array(12),
  E: new Float32Array(4),
};

// the ventures place's first key along the circle (journey.ts), so the monoliths follow wherever the lead puts it
let s0: number | null = null;
function placeS() {
  if (s0 === null) s0 = (keys().find((k) => k.at[0] === 'ventures' && k.at[1] === 0)?.s as number | undefined) ?? (150 * Math.PI) / 180 * 6000;
  return s0;
}

function moonDir(f: Frame): V3 {
  if (!((f.ch['look.moon'] ?? 0) > 0)) return f.sun.dir;
  const up = f.cam.up, fw = f.cam.f;
  const h = V.norm(V.madd(fw, up, -V.dot(fw, up)));
  const side = V.cross(up, h);
  const az = ((f.ch['look.moonAz'] ?? 150) * Math.PI) / 180,
    el = ((f.ch['look.moonEl'] ?? 14) * Math.PI) / 180;
  return V.norm(V.madd(V.mul(V.add(V.mul(h, Math.cos(az)), V.mul(side, Math.sin(az))), Math.cos(el)), up, Math.sin(el)));
}

function frameUpdate(f: Frame, u: Uniforms) {
  const p = f.at('ventures');
  // they sink back into the sea over the end of their own pin, so the thesis opens on an empty sea (continuous,
  // reversible; the words leave with them)
  const th = clamp((p - 0.84) / 0.12);
  const sinkK = 1 - th * th * (3 - 2 * th);
  const L = f.narrow ? LAYOUT.narrow : LAYOUT.wide;
  const s = SCALE;
  const H = 2 * MONO_E[1];
  const v0 = placeS() + AHEAD;
  const origin = f.surf(0, v0, 0);
  const up = V.norm(origin);
  // the place's frame: z toward the camera's side (back along the circle), x to the right as seen from the camera
  const along = V.norm(V.sub(f.surf(0, v0 + 1, 0), origin));
  const z = V.mul(along, -1);
  const x = V.cross(up, z);
  U.E.set([MONO_E[0] * s, MONO_E[1] * s, MONO_E[2] * s, MONO_E[3] * s]);
  const dt = f.still ? 0 : f.dt;
  const t = f.still ? 0 : f.t;
  let any = false;
  for (let i = 0; i < 3; i++) {
    [S.hover[i], S.hoverV[i]] = spring(S.hover[i], S.hoverV[i], S.hoverT[i], dt, 0.12);
    S.press[i] *= dt > 0 ? Math.exp(-dt / 0.35) : 1;
    // the camera is far from them anywhere else on the journey: risen only inside their own pin
    const rise = riseAt(p, i) * sinkK;
    const liftTo = S.hover[i] * 0.22 - S.press[i] * 0.3;
    [S.lift[i], S.liftV[i]] = spring(S.lift[i], S.liftV[i], liftTo, dt, 0.16);
    const bob = Math.sin(t * 0.6 + i * 2.1) * 0.035 * rise;
    const lift = (-(1 - rise) * (H + 0.6) + S.lift[i] + bob) * s;
    const [px, pz] = L.pos[i];
    const foot = V.add(origin, V.add(V.mul(x, px * s), V.mul(z, pz * s)));
    const fup = V.norm(foot);
    feet[i] = foot;
    const vis = rise > 0.001;
    any ||= vis;
    U.P.set([foot[0], foot[1], foot[2], vis ? 1 : 0], i * 4);
    // the hero angle: the face turned so its normal sits just off the half vector between the camera and the sun, so
    // the crown of the cast face carries a vertical highlight band (never the whole face lit, never all dark)
    const toCam = V.sub(f.cam.pos, foot);
    const hc = V.norm(V.madd(toCam, fup, -V.dot(toCam, fup)));
    // the light the faces are aimed at: look's moon at this place (the same direction look computes), else the sun
    const sd = moonDir(f);
    const hs = V.madd(sd, fup, -V.dot(sd, fup));
    const hh = V.norm(V.add(hc, V.mul(V.norm(hs), clamp(V.dot(sd, fup) * 6 + 1, 0, 1))));
    const zx = V.dot(hh, x),
      zz = V.dot(hh, z);
    const yaw = Math.atan2(zx, zz) + L.aim[i] + Math.sin(t * 0.21 + i) * 0.006;
    const Zf = V.norm(V.add(V.mul(z, Math.cos(yaw)), V.mul(x, Math.sin(yaw))));
    const Xf0 = V.cross(fup, Zf);
    const tilt = Math.sin(t * 0.37 + i * 1.7) * 0.004 * rise;
    // each leans a few degrees toward the viewer, as if set down by the sea that cast it: a face tipped forward mirrors
    // the glowing sea (the reflected horizon crosses it about two thirds up) instead of the black night sky above
    const Y = V.norm(V.madd(V.madd(fup, Xf0, tilt), Zf, LEAN[i]));
    const Z = V.norm(V.cross(Xf0, Y));
    const X = V.cross(Y, Z);
    U.M.set([...X, ...Y, ...Z], i * 9);
    U.K.set([lift, S.hover[i], KINDS[i], S.press[i]], i * 4);

    // the screen box of the part above the sea
    const b = ventureBoxes[i];
    b.rise = rise;
    b.vis = false;
    if (!vis) continue;
    const base = V.madd(foot, Y, lift);
    const lo = Math.max(-lift, -0.3 * H * s),
      hi = H * s;
    if (hi <= lo) continue;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        for (const hy of [lo, hi]) {
          const q = f.project(V.add(base, V.add(V.add(V.mul(X, sx * MONO_E[0] * s), V.mul(Z, sz * MONO_E[2] * s)), V.mul(Y, hy))));
          if (!q) continue;
          x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]);
          y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
        }
    // clipped to the viewport, so a hit area never reaches over the nav or off screen
    x0 = Math.max(x0, 0); y0 = Math.max(y0, 0); x1 = Math.min(x1, f.w); y1 = Math.min(y1, f.h);
    if (x1 > x0 && y1 > y0) Object.assign(b, { x: x0, y: y0, w: x1 - x0, h: y1 - y0, vis: true });
  }
  // only near the place: elsewhere on the journey they are behind the planet, and every ray would still test them
  const near = V.len(V.sub(f.cam.pos, origin)) < 8000;
  if (!near) for (let i = 0; i < 3; i++) U.P[i * 4 + 3] = 0;
  any &&= near;
  u.set('ventures_uOn', any ? 1 : 0);
  u.set('ventures_uGain', GAIN);
  // the near sea cools through the place (fades in and out at the pin's ends, so the neighbours are untouched)
  // V2 (never black): the near sea is no longer cooled here; the words stay AA as solid bone over the night sea
  u.set('ventures_uCool', 0);
  u.set('ventures_uP', U.P);
  u.set('ventures_uM', U.M);
  u.set('ventures_uK', U.K);
  u.set('ventures_uE', U.E);
  // the analytic environment (only what the sea's reflections of the monoliths see): night over a glowing sea, and
  // the sun's radiance for the direct lobe (irradiance ~3 from a disc of the engine's size)
  const sr = Math.max(f.sun.rad, 1e-3);
  const sunK = 3 / (Math.PI * sr * sr);
  u.set('ventures_uSunL', [sunK, sunK * 0.62, sunK * 0.36]);
  // night over a molten sea: the low air over the horizon is lit from below by the lava (a warm band), the zenith is
  // black; the band is what the metal mirrors as its bright line
  u.set('ventures_uZen', [0.0025, 0.003, 0.0055]);
  u.set('ventures_uHorW', V.mul([0.5, 0.13, 0.035], ENVK));
  u.set('ventures_uHorC', V.mul([0.42, 0.11, 0.03], ENVK));
  u.set('ventures_uSea', V.mul(bb(900), 14 * 0.96 * ENVK));
  u.set('ventures_uPool', V.mul(bb(1320), 14 * ENVK));
}

// ---- the section's DOM ------------------------------------------------------------------------------------------------
let sec: HTMLElement | null = null;
let links: HTMLAnchorElement[] = [];
let hits: HTMLElement[] = [];
let items: HTMLElement[] = [];
let parents: DOMRect[] = [];
let armed = false;
let lastFrame: Frame | null = null;
let view = { w: 0, narrow: true };
const offs: (() => void)[] = [];

function bindDom(root: HTMLElement) {
  sec = root.querySelector<HTMLElement>('[data-ventures]');
  if (!sec) return;
  links = [...sec.querySelectorAll<HTMLAnchorElement>('.wv-link')];
  hits = links.map((a) => a.querySelector<HTMLElement>('.wv-hit')!);
  items = links.map((a) => a.closest<HTMLElement>('.wv-item')!);
  const on = (el: EventTarget, ev: string, fn: () => void) => {
    el.addEventListener(ev, fn, { passive: true });
    offs.push(() => el.removeEventListener(ev, fn));
  };
  links.forEach((a, i) => {
    const hot = (v: boolean) => () => {
      setVentureHover(i, v);
      a.toggleAttribute('data-hot', v);
    };
    on(a, 'pointerenter', hot(true));
    on(a, 'pointerleave', hot(false));
    on(a, 'focus', hot(true));
    on(a, 'blur', hot(false));
    on(a, 'touchstart', hot(true));
    on(a, 'touchend', () => setTimeout(hot(false), 500));
    on(a, 'touchcancel', hot(false));
    on(a, 'pointerdown', () => {
      pressVenture(i);
      haptic(8);
    });
  });
}

/** The camera through the ventures place: the lead's path (same s, h, sun) with the horizon lower in frame, so the
 * monoliths stand in the middle of the screen between the heading and the list (phones look up a little). */
export function venturesKeys(R: number): Key[] {
  const deg = (a: number) => (a * Math.PI * R) / 180;
  const FAR = { sunU: 0, sunV: -deg(80), sunY: 1e6, sunR: 1.2e4 };
  // look's cold moon, low behind the camera's shoulder (fades in from story-3 and out into the thesis)
  const MOON = { 'look.moon': 1.2, 'look.moonAz': 150, 'look.moonEl': 12 };
  return [
    { at: ['ventures', 0], s: deg(150), h: 3.2, yaw: 0, pitch: -3, fov: 50, ...FAR, ...MOON, ph: { fov: 58, pitch: 11.5, h: 1.5 } },
    // phones travel half as far through the place, so the live monolith grows less and stays clear of the lede
    { at: ['ventures', 0.85], s: deg(150) + 51, h: 3.37, yaw: 0, pitch: -3, fov: 50, ...FAR, ...MOON, ph: { fov: 58, pitch: 11.5, h: 1.5, s: deg(150) + 25.5 } },
    // as they sink, phones tip down a little so the glowing horizon band holds the frame (never black)
    { at: ['ventures', 1], s: deg(150) + 60, h: 3.4, yaw: 0, pitch: -3, fov: 50, ...FAR, ...MOON, ph: { fov: 58, pitch: 5, h: 1.5, s: deg(150) + 30 } },
  ];
}

export const ventures: WorldModule = {
  id: 'ventures',
  keys: venturesKeys,
  glsl: monolithGlsl,
  hooks: ['hit', 'shade', 'env', 'sea', 'crisp'],
  // the crisp pass's box: the union of the monoliths' screen boxes, a few px wider for the anti-aliased edges
  crispBox(f) {
    lastFrame = f;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const b of ventureBoxes) {
      if (!b.vis) continue;
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
    }
    if (!(x1 > x0)) return null;
    // ...and their reflections below (drawn in the crisp pass too)
    const r = lastFrame ? ventureReflectBoxes(lastFrame) : null;
    if (r) { x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]); x1 = Math.max(x1, r[2]); y1 = Math.max(y1, r[3]); }
    return [x0 - 4, y0 - 4, x1 + 4, y1 + 4];
  },
  init({ root }) {
    bindDom(root);
  },
  update(f, u) {
    frameUpdate(f, u);
    // layout reads before the frame's writes (after())
    view = { w: f.w, narrow: f.narrow };
    parents = hits.map((h) => (h.offsetParent as HTMLElement | null)?.getBoundingClientRect() ?? new DOMRect());
  },
  after() {
    if (!sec) return;
    // desktop: the words stand under their monoliths; keep them apart (one item's width + a gap) and on screen
    const cx = ventureBoxes.map((b) => b.x + b.w / 2);
    if (!view.narrow) {
      const iw = Math.min(17 * 16, 0.21 * view.w),
        gap = iw + 24;
      const order = [0, 1, 2].sort((a, b) => cx[a] - cx[b]);
      for (let k = 1; k < 3; k++) cx[order[k]] = Math.max(cx[order[k]], cx[order[k - 1]] + gap);
      const over = cx[order[2]] - (view.w - iw / 2 - 24);
      if (over > 0) for (const k of order) cx[k] -= over;
    }
    // armed from the first frame the world draws (not from the first rise), so the layout never jumps mid-scroll
    if (!armed) {
      armed = true;
      sec.setAttribute('data-armed', '');
    }
    ventureBoxes.forEach((b, i) => {
      const h = hits[i],
        r = parents[i],
        it = items[i];
      if (!h || !it) return;
      it.style.setProperty('--r', b.rise.toFixed(3));
      it.style.pointerEvents = !armed || b.rise > 0.6 ? '' : 'none';
      if (!b.vis || !r) {
        h.style.visibility = 'hidden';
        return;
      }
      h.style.visibility = '';
      h.style.transform = `translate(${(b.x - r.left).toFixed(1)}px, ${(b.y - r.top).toFixed(1)}px)`;
      h.style.width = `${b.w.toFixed(1)}px`;
      h.style.height = `${b.h.toFixed(1)}px`;
      it.style.setProperty('--cx', `${cx[i].toFixed(1)}px`);
    });
  },
  dispose() {
    offs.splice(0).forEach((fn) => fn());
    sec?.removeAttribute('data-armed');
  },
};
