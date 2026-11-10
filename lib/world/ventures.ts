// The ventures in the world: three cast-metal monoliths rise out of the lava as the journey reaches them
// (place `ventures`, low over the night sea). Module `ventures` (ARCHITECTURE.md): GLSL hooks hit / shade / sea / crisp
// in lib/world/glsl/monolith.glsl; this file computes their poses on the CPU every frame, owns the camera through the
// place (venturesKeys: a low camera, a long lens, one slow push and arc), the section's behaviour (hover, focus, touch
// and press heat a monolith; each link's hit area is laid over its monolith's projection, so the monolith and its
// words are one link that works by tap), and queues a ripple for the lava on a press.
// Framework-free (no React). The section's markup is components/world/Ventures.tsx (static).

import type { WorldModule } from './modules';
import type { Frame, V3 } from './frame';
import { V, clamp } from './frame';
import type { Uniforms } from './gl';
import { haptic } from '@/lib/haptic';
import monolithGlsl from './glsl/monolith.glsl';
import type { Key } from './journey';

export type Vec3 = V3;

/** World units (~m) per monolith unit: the live casting is 10 units = 150 m tall and stands 600-750 m from the camera,
 * filmed low and through a long lens (venturesKeys): three monuments on the horizon, not three props on a table. */
const SCALE = 15;
/** Each casting's own shape, monolith units: half width, half height, half depth, arris radius. Three castings, not
 * three copies: Crucible Sites the tall machined stele, Verge narrower with a softer cast fillet, Trellis shorter and
 * thicker. */
export const MONO_SHAPE: [number, number, number, number][] = [
  [1.6, 5.0, 0.44, 0.075],
  [1.36, 4.6, 0.52, 0.15],
  [1.5, 4.25, 0.6, 0.105],
];
/** The live casting's shape (for callers that want one size). */
export const MONO_E = MONO_SHAPE[0];
/** Finish: base roughness of the broad faces (machined satin, as-cast, dressed). */
const FINISH = [0.22, 0.33, 0.2];
/** Where they stand: the place's origin this far along the circle past the ventures place's first key, and each
 * casting's position in metres in the place's frame (x right, z back toward the camera). */
const AHEAD = 760;
/** The camera's ground position at the shot's peak (venturesKeys, f 0.84), metres past the first key: the castings
 * face it (plus their own turn), fixed in the world, so the camera's arc moves the light across their faces. */
const PEAK = 116;
const LAYOUT = {
  // desktop: right of the heading, at about 44%, 63% and 82% of the width, the two still forging a little further back
  wide: { pos: [[-29, 0], [70, -70], [162, -24]] as const },
  // phones: the live one in front, centred; the two forging ones well behind it to either side (haze between)
  narrow: { pos: [[0, 22], [-62, -205], [52, -265]] as const },
};
/** Each face's turn away from the camera's peak position (rad, + = toward the right): the moon stands behind the
 * camera's left shoulder, so a face turned left carries its sheen, one turned right stays dark and reads by its edges. */
const AIM = [-0.13, -0.02, -0.4];
/** Forward lean toward the camera beyond the camera's own vertical (rad): the faces mirror the horizon and a strip of
 * the glowing sea under it, not only the night sky. */
const LEAN = [0.004, -0.039, -0.049];
const KINDS = [0, 1, 1];
/** The monoliths' own light (heat, the pool, the lava-lit air) in the world's radiance unit. */
const GAIN = 4;
/** What the faces mirror of the lava (the sea, the pool at the foot, the lava-lit air), kept low so above the foot the
 * metal reads as bare metal under the moon, not as a glowing slab. */
const ENVK = 1.4;

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
/** The same boxes widened by the sea's bulge while a casting rises: what the crisp pass must cover. */
const drawBoxes = [0, 1, 2].map(() => ({ x0: 0, y0: 0, x1: 0, y1: 0, vis: false }));
/** Ripple requests for the lava (world position on the sea, strength 0..1); lava drains this queue. */
export const ventureRipples: { p: V3; k: number }[] = [];
const feet: V3[] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

export function setVentureHover(i: number, on: boolean) {
  S.hoverT[i] = on ? 1 : 0;
}
export function pressVenture(i: number) {
  S.press[i] = 1;
  ventureRipples.push({ p: feet[i], k: 1 });
  if (ventureRipples.length > 8) ventureRipples.shift();
}

/** The rise of monolith i for the section's pin progress p: one after another, each over 36% of the pin (150 m of
 * metal coming up through a sea is slow), all three standing by 0.6. */
export const riseAt = (p: number, i: number) => {
  const c = clamp((p - (0.015 + i * 0.1)) / 0.36);
  return c * c * (3 - 2 * c);
};
/** The sea's bulge over a rising casting (monolith units): it swells before the top breaks through, then drains away. */
const domeAt = (rise: number) => {
  const a = clamp(rise / 0.035),
    b = clamp((rise - 0.05) / 0.3);
  return 0.95 * a * a * (3 - 2 * a) * (1 - b * b * (3 - 2 * b));
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
  E: new Float32Array(12),
  D: new Float32Array(12),
};

// the ventures place's first key along the circle, so the monoliths follow wherever the camera's path starts
let s0: number | null = null;
function placeS() {
  if (s0 === null) s0 = venturesKeys(6000)[0].s as number;
  return s0;
}

function frameUpdate(f: Frame, u: Uniforms) {
  const p = f.at('ventures');
  // they sink back into the sea over the end of their own pin, so the thesis opens on an empty sea (continuous,
  // reversible; the words leave with them)
  const th = clamp((p - 0.895) / 0.1);
  const sinkK = 1 - th * th * (3 - 2 * th);
  const L = f.narrow ? LAYOUT.narrow : LAYOUT.wide;
  const s = SCALE;
  const v0 = placeS() + AHEAD;
  const origin = f.surf(0, v0, 0);
  const up = V.norm(origin);
  // the place's frame: z back toward the camera's side (against the travel), x to the right as seen from the camera
  const along = V.norm(V.sub(f.surf(0, v0 + 1, 0), origin));
  const z = V.mul(along, -1);
  const x = V.cross(up, z);
  // where the camera stands at the shot's peak (on the sea): the castings face it, fixed in the world
  const ref = f.surf(0, placeS() + PEAK, 0);
  const dt = f.still ? 0 : f.dt;
  let any = false;
  for (let i = 0; i < 3; i++) {
    const E = MONO_SHAPE[i];
    const H = 2 * E[1];
    U.E.set([E[0] * s, E[1] * s, E[2] * s, E[3] * s], i * 4);
    [S.hover[i], S.hoverV[i]] = spring(S.hover[i], S.hoverV[i], S.hoverT[i], dt, 0.12);
    S.press[i] *= dt > 0 ? Math.exp(-dt / 0.35) : 1;
    // the camera is far from them anywhere else on the journey: risen only inside their own pin
    const rise = riseAt(p, i) * sinkK;
    // a monument does not bob: hover and press show as heat (and a breath of lift, a few tenths of a metre)
    const liftTo = S.hover[i] * 0.03 - S.press[i] * 0.05;
    [S.lift[i], S.liftV[i]] = spring(S.lift[i], S.liftV[i], liftTo, dt, 0.16);
    const lift = (-(1 - rise) * (H + 0.6) + S.lift[i] * rise) * s;
    const [px, pz] = L.pos[i];
    const foot = V.add(origin, V.add(V.mul(x, px), V.mul(z, pz)));
    const fup = V.norm(foot);
    feet[i] = foot;
    const vis = rise > 0.0005;
    any ||= vis;
    U.P.set([foot[0], foot[1], foot[2], vis ? 1 : 0], i * 4);
    // the face looks at the camera's peak position, turned by its own angle; fixed in the world, so the camera's arc
    // and push move the moon's sheen and the reflected horizon across it
    const toRef = V.sub(ref, foot);
    const dist = V.len(toRef);
    const hc = V.norm(V.madd(toRef, fup, -V.dot(toRef, fup)));
    const side = V.cross(fup, hc);
    const Zf = V.norm(V.add(V.mul(hc, Math.cos(AIM[i])), V.mul(side, Math.sin(AIM[i]))));
    // upright as the camera sees it (the planet's curve tips a far thing away by dist / R: taken out, as an architect's
    // lens would), plus a degree or two toward the viewer
    const Y = V.norm(V.madd(fup, hc, Math.tan(dist / f.R + LEAN[i])));
    const X = V.norm(V.cross(Y, Zf));
    const Z = V.cross(X, Y);
    U.M.set([...X, ...Y, ...Z], i * 9);
    U.K.set([lift, S.hover[i], KINDS[i], S.press[i]], i * 4);
    const dome = domeAt(rise) * s;
    U.D.set([dome, rise, FINISH[i], 0], i * 4);

    // the screen box of the part above the sea (the link's hit area), and the box the crisp pass draws in (the same,
    // plus the sea's bulge over the casting while it rises)
    const b = ventureBoxes[i],
      d = drawBoxes[i];
    b.rise = rise;
    b.vis = d.vis = false;
    if (!vis) continue;
    const base = V.madd(foot, Y, lift);
    const lo = Math.max(-lift, -0.3 * H * s),
      hi = H * s;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const corner = (q: V3) => {
      const c = f.project(q);
      if (!c) return;
      x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]);
      y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]);
    };
    if (hi > lo)
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          for (const hy of [lo, hi]) corner(V.add(base, V.add(V.add(V.mul(X, sx * E[0] * s), V.mul(Z, sz * E[2] * s)), V.mul(Y, hy))));
    // clipped to the viewport, so a hit area never reaches over the nav or off screen
    const bx0 = Math.max(x0, 0), by0 = Math.max(y0, 0), bx1 = Math.min(x1, f.w), by1 = Math.min(y1, f.h);
    if (bx1 > bx0 && by1 > by0) Object.assign(b, { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0, vis: true });
    if (dome > 0)
      for (const sx of [-1, 1])
        for (const hy of [-0.2 * dome, dome * 1.05]) corner(V.add(foot, V.add(V.mul(X, sx * E[0] * s * 2.3), V.mul(Y, hy))));
    if (x1 > x0 && y1 > y0) Object.assign(d, { x0, y0, x1, y1, vis: true });
  }
  // only near the place: elsewhere on the journey they are behind the planet, and every ray would still test them
  const near = V.len(V.sub(f.cam.pos, origin)) < 9000;
  if (!near) for (let i = 0; i < 3; i++) U.P[i * 4 + 3] = 0;
  any &&= near;
  u.set('ventures_uOn', any ? 1 : 0);
  u.set('ventures_uGain', GAIN);
  u.set('ventures_uP', U.P);
  u.set('ventures_uM', U.M);
  u.set('ventures_uK', U.K);
  u.set('ventures_uE', U.E);
  u.set('ventures_uD', U.D);
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

/**
 * The camera through the ventures place: one shot. It comes in low over the night sea with a long lens (the castings
 * are 150 m tall and 600-750 m away: the lens, not a small world, makes them fill the frame), sinks lower and pushes in
 * while they rise, arcing a little from left to right so the moon's sheen and the reflected horizon travel across the
 * faces; over the last sixth it lifts and widens into the first key of the thesis' climb (thesisKeys: keep the last
 * key here equal to that one). Phones: a narrower frame, the live casting centred between the heading and the list.
 */
export function venturesKeys(R: number): Key[] {
  const deg = (a: number) => (a * Math.PI * R) / 180;
  const FAR = { sunU: 0, sunV: -deg(80), sunY: 1e6, sunR: 1.2e4 };
  // look's cold moon, low behind the camera's left shoulder (fades in from story-3 and out into the thesis)
  // (it drifts round and down through the shot, as the camera's arc would have it: the sheen passes from Trellis to
  // Crucible Sites and sinks down their faces)
  const MOON = { 'look.moon': 0.6, 'look.moonAz': 141, 'look.moonEl': 8.5 };
  const MOON2 = { 'look.moon': 0.6, 'look.moonAz': 158, 'look.moonEl': 5.8 };
  const s = deg(150);
  return [
    { at: ['ventures', 0], s, h: 24, x: -30, yaw: 2.3, pitch: 0.4, fov: 30, ...FAR, ...MOON, ph: { fov: 31, pitch: 4.4, x: -24, yaw: 1.9 } },
    { at: ['ventures', 0.84], s: s + PEAK, h: 14, x: 30, yaw: -2.6, pitch: 0.85, fov: 26, ...FAR, ...MOON2, ph: { fov: 25, pitch: 3.7, x: 24, yaw: -2.2 } },
    // = the thesis' first key (lib/world/thesis.ts): the lift and the widening lens are the start of its climb
    { at: ['ventures', 1], s: deg(151.5), h: 30, x: 0, yaw: 0, pitch: -2, fov: 50, ...FAR, ...MOON2, ph: { fov: 64, pitch: -3, x: 0, yaw: 0 } },
  ];
}

export const ventures: WorldModule = {
  id: 'ventures',
  keys: venturesKeys,
  glsl: monolithGlsl,
  hooks: ['hit', 'shade', 'sea', 'crisp'],
  // the crisp pass's box: the union of the monoliths' screen boxes, a few px wider for the anti-aliased edges (their
  // reflections are soft and belong to the sea: the scene pass draws them)
  crispBox(f) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const b of drawBoxes) {
      if (!b.vis) continue;
      x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1);
    }
    x0 = Math.max(x0 - 4, 0); y0 = Math.max(y0 - 4, 0); x1 = Math.min(x1 + 4, f.w); y1 = Math.min(y1 + 4, f.h);
    return x1 > x0 && y1 > y0 ? [x0, y0, x1, y1] : null;
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
      it.style.pointerEvents = !armed || b.rise > 0.5 ? '' : 'none';
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
    armed = false;
  },
};
