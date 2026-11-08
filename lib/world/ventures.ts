// The ventures in the world: three cast-metal monoliths rise out of the lava as the journey reaches them.
// Framework-free (no React). The DOM side (components/world/VenturesClient.tsx) feeds the section's progress and each
// link's hover/focus/press in; the world calls `venturesFrame()` once per clock tick with its camera and the ventures'
// place on the planet, gets the shader uniforms back, and this module projects each monolith to the screen so the
// links' hit areas lie exactly over them. The GLSL (trace + shade) is lib/world/glsl/monolith.glsl, exported as a string
// by lib/world/glsl/monolith.ts.

export type Vec3 = [number, number, number];

/** The ventures' place on the planet, from the journey: a point on the sea surface and its frame. */
export type VenturePlace = {
  origin: Vec3; // on the sea surface, where the middle monolith stands
  up: Vec3; // the surface normal there
  fwd: Vec3; // horizontal, from the place toward the camera's side (monolith faces turn to it)
  scale: number; // world units per monolith unit (a monolith is 10 units tall)
};
export type VentureCamera = {
  /** world -> CSS px in the viewport (x right, y down), or null behind the camera */
  project: (p: Vec3) => [number, number] | null;
  narrow: boolean; // portrait phone layout
};

export const MONO_E: [number, number, number, number] = [1.6, 5.0, 0.42, 0.12]; // half w, half h, half d, fillet
const KINDS = [0, 1, 1]; // Crucible Sites cooled (live), Verge and Trellis still forging
// Layouts, in monolith units in the place's frame (x right, z toward the camera), yaw in radians (+ turns the face
// right). Desktop: three in a row, the outer two turned in. Phone: staggered in depth, the live one nearest.
const LAYOUT = {
  wide: { pos: [[-5.6, 0], [0, -1.5], [5.6, 0]], yaw: [0.32, 0.0, -0.32] },
  narrow: { pos: [[-0.2, 0], [-4.6, -9], [4.2, -16]], yaw: [0.18, 0.35, -0.3] },
} as const;

// state fed by the DOM
const S = {
  progress: 0, // the section's pin progress 0..1 (rises happen in its first part)
  on: false, // the section is near the viewport
  hoverT: [0, 0, 0],
  hover: [0, 0, 0],
  hoverV: [0, 0, 0],
  press: [0, 0, 0], // 1 on press, decays
  lift: [0, 0, 0],
  liftV: [0, 0, 0],
};
/** Hit boxes for the DOM (CSS px, viewport), written each frame. */
export const ventureBoxes = [0, 1, 2].map(() => ({ x: 0, y: 0, w: 0, h: 0, vis: false, rise: 0 }));
/** Ripple requests for the lava module: world position and strength; the lava module drains this queue. */
export const ventureRipples: { p: Vec3; k: number }[] = [];

export function setVenturesProgress(p: number, on = true) {
  S.progress = p < 0 ? 0 : p > 1 ? 1 : p;
  S.on = on;
}
export function setVentureHover(i: number, on: boolean) {
  S.hoverT[i] = on ? 1 : 0;
}
let lastPlace: VenturePlace | null = null;
export function pressVenture(i: number) {
  S.press[i] = 1;
  if (lastPlace) ventureRipples.push({ p: footOf(lastPlace, i, false), k: 1 });
}

/** The rise of monolith i for section progress p: one after another over the first 60% of the pin. */
export const riseAt = (p: number, i: number) => {
  const x = (p - (0.04 + i * 0.12)) / 0.3;
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
};

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => mul(a, 1 / Math.hypot(a[0], a[1], a[2]));

function frameOf(pl: VenturePlace) {
  const up = norm(pl.up);
  const z = norm(add(pl.fwd, mul(up, -(pl.fwd[0] * up[0] + pl.fwd[1] * up[1] + pl.fwd[2] * up[2]))));
  const x = cross(up, z);
  return { x, up, z };
}
let narrowNow = false;
function footOf(pl: VenturePlace, i: number, narrow = narrowNow): Vec3 {
  const { x, z } = frameOf(pl);
  const L = narrow ? LAYOUT.narrow : LAYOUT.wide;
  const [px, pz] = L.pos[i];
  return add(pl.origin, add(mul(x, px * pl.scale), mul(z, pz * pl.scale)));
}

// critically damped spring step (exact), time constant tau
function spring(x: number, v: number, to: number, dt: number, tau: number): [number, number] {
  const w = 1 / tau, d = x - to, c = v + w * d, e = Math.exp(-w * dt);
  return [to + (d + c * dt) * e, (v - c * w * dt) * e];
}

export type VentureUniforms = {
  uMonoP: Float32Array; // 3 x vec4
  uMonoM: Float32Array; // 3 x mat3 (column major)
  uMonoK: Float32Array; // 3 x vec4
  uMonoE: Float32Array; // vec4 (world units)
  any: boolean; // any monolith visible (skip the trace otherwise)
};
const U: VentureUniforms = {
  uMonoP: new Float32Array(12),
  uMonoM: new Float32Array(27),
  uMonoK: new Float32Array(12),
  uMonoE: new Float32Array(4),
  any: false,
};

/** One clock tick: springs, the monoliths' poses, their screen boxes. `t` seconds, `dt` the tick. */
export function venturesFrame(t: number, dt: number, place: VenturePlace, cam: VentureCamera): VentureUniforms {
  lastPlace = place;
  narrowNow = cam.narrow;
  const L = cam.narrow ? LAYOUT.narrow : LAYOUT.wide;
  const { x, up, z } = frameOf(place);
  const s = place.scale;
  const H = 2 * MONO_E[1];
  U.uMonoE.set([MONO_E[0] * s, MONO_E[1] * s, MONO_E[2] * s, MONO_E[3] * s]);
  U.any = false;
  for (let i = 0; i < 3; i++) {
    [S.hover[i], S.hoverV[i]] = spring(S.hover[i], S.hoverV[i], S.hoverT[i], dt, 0.12);
    S.press[i] *= Math.exp(-dt / 0.35);
    const rise = S.on ? riseAt(S.progress, i) : 0;
    // hover lifts it a little; a press sinks it with a kick (the spring carries the bob back)
    const liftTo = S.hover[i] * 0.22 - S.press[i] * 0.3;
    [S.lift[i], S.liftV[i]] = spring(S.lift[i], S.liftV[i], liftTo, dt, 0.16);
    // a slow bob while it stands in the lava (tiny: it is huge)
    const bob = Math.sin(t * 0.6 + i * 2.1) * 0.035 * rise;
    const lift = (-(1 - rise) * (H + 0.6) + S.lift[i] + bob) * s;
    const foot = footOf(place, i, cam.narrow);
    const vis = rise > 0.001;
    if (vis) U.any = true;
    U.uMonoP.set([...foot, vis ? 1 : 0], i * 4);
    // yaw about the up axis, plus the faintest list as it floats (never a wobble)
    const a = L.yaw[i] + Math.sin(t * 0.21 + i) * 0.006;
    const X = add(mul(x, Math.cos(a)), mul(z, -Math.sin(a)));
    const tilt = Math.sin(t * 0.37 + i * 1.7) * 0.004 * rise;
    const Y = norm(add(up, mul(X, tilt)));
    const Z = cross(X, Y);
    U.uMonoM.set([...X, ...Y, ...Z], i * 9);
    U.uMonoK.set([lift, S.hover[i], KINDS[i], S.press[i]], i * 4);

    // the screen box: project the eight corners of the part above the sea
    const b = ventureBoxes[i];
    b.rise = rise;
    b.vis = false;
    if (!vis) continue;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const base = add(foot, mul(up, lift));
    // the part above the sea: local heights from the waterline (-lift) to the top
    const lo = Math.max(-lift, -0.3 * H * s), hi = H * s;
    if (hi <= lo) continue;
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        for (const hy of [lo, hi]) {
          const p = add(base, add(add(mul(X, sx * MONO_E[0] * s), mul(Z, sz * MONO_E[2] * s)), mul(Y, hy)));
          const q = cam.project(p);
          if (!q) continue;
          x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]);
          y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
        }
    if (x1 > x0 && y1 > y0) Object.assign(b, { x: x0, y: y0, w: x1 - x0, h: y1 - y0, vis: true });
  }
  return U;
}

/** Extra lava emission near the feet is in GLSL (monoSeaGlow); the world can also ask here for its own CPU use. */
export const venturesHot = () => S.hover.some((h) => h > 0.01) || S.press.some((p) => p > 0.01);
