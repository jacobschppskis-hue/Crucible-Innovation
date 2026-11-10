// PayPal → six companies (role `paypal`; storyboard, research and decisions in lab/paypal/NOTES.md).
//
// Seen from orbit over the night side, PayPal is one vent of molten metal in the sea: a white-hot heart, a pool cooling
// round it. One after another it throws six beads of molten metal on ballistic arcs over the planet's curve (a small
// white-hot head, a tail that cools from yellow through Ember to dull red as it stretches). Where a bead lands the sea
// answers: a ring of heat runs out and fades, a molten spring stays, and a new river starts to run from it until it
// meets the planet's own rivers. YouTube, LinkedIn, Yelp, Palantir; then Elon's share: SpaceX on one high throw that
// clears the atmosphere, and Tesla. By the end the night side carries six new sources feeding one glowing system,
// which is the sentence the frame is for: "So much came out of a single company". The camera never stops: a slow
// orbital drift and push through the whole pin. At the end everything cools back into the planet's normal look.
//
// Everything visible is a pure function of the beat progress p = frame.at('paypal') (0..1), so it scrubs both ways;
// the clock only adds life at rest (the rivers' slow flow, the vent's breathing, the beads' shimmer) and lets the new
// rivers follow look's slowly drifting ones.
//
// How it draws (lib/world/ARCHITECTURE.md):
// - `sea` hook: TEMPERATURE added to the sea (SeaMod.heat), never a sprite: look's own Planck curve turns it into
//   light, so a spring has a hot core and a falloff that follows the blackbody law, sits in the surface (foreshortened
//   by the curve, dimmed toward the limb by look's Fresnel and air) and adds up with look's rivers where they meet;
// - `crisp` hook (canvas resolution, analytic anti-aliasing): the beads and their tails, traced per pixel against
//   their sampled paths (a float texture of short chunks, each with a tight screen box), hidden behind the planet;
//   `over` adds each bead's soft glare to the scene so the bloom carries it;
// - `after`: the captions' opacity and the names (small annotations on a bone hairline) on the section's own DOM.
// The camera for this place is `paypalKeys()`.

import { cameraFrom, rayAt, seaT } from './camera';
import planetGlsl from './glsl/planet.glsl';
import type { Channels, Frame, V3 } from './frame';
import type { Uniforms } from './gl';
import type { Key } from './journey';
import type { WorldModule } from './modules';

// ---------------------------------------------------------------- vectors
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const D2R = Math.PI / 180;

// ---------------------------------------------------------------- the story
/** When each caption shows ([in, out] in p). The words are in data/home.ts (`paypal.steps`), rendered by PayPal.tsx;
 * index 3 is the display line (the section's heading): it holds for over a fifth of the pin, with all six burning. */
export const CAPTION_AT: [number, number][] = [
  [0.012, 0.092],
  [0.108, 0.372],
  [0.388, 0.6],
  [0.616, 0.868],
  [0.884, 0.992], // gone just before the pin releases (it would otherwise ride up under the nav)
];
const CAP_FADE = 0.022;
export function captionOpacity(i: number, p: number) {
  const [a, b] = CAPTION_AT[i] ?? [2, 2];
  return smooth(a, a + CAP_FADE, p) * (1 - smooth(b - CAP_FADE, b, p));
}

/** Where a name sits relative to its place: at the end of a hairline going left, right, up or down. */
type Pos = 'l' | 'r' | 'u' | 'd';
/** A ballistic throw from the vent (unit direction `o`) along the unit tangent `t` there. */
export interface Throw {
  o: V3;
  t: V3;
  range: number; // radians of great circle
  apex: number; // in radii
  launch: number; // p
  flight: number; // p
  land: number; // p
  seed: number;
}
export interface Site extends Throw {
  name: string;
  /** Where the place sits in the frame at p = REF_P: [x, y] viewport fractions, y down. Phones, then wide. */
  pt: [number, number];
  ls: [number, number];
  /** The throw's height as a fraction of its range. */
  loft: number;
  /** The sides its name may take (no throw crosses them), best first; phones and wide. */
  labP: string;
  labD: string;
  /** Where its river heads at first (a screen offset from the place at REF_P, viewport fractions), phones and wide. */
  rivP: [number, number];
  rivD: [number, number];
  dir: V3; // the landing place (unit)
}
const site = (
  name: string, pt: [number, number], ls: [number, number], launch: number, flight: number, loft: number, seed: number,
  labP: string, labD: string, rivP: [number, number], rivD: [number, number],
): Site => ({
  name, pt, ls, launch, flight, land: launch + flight, loft, seed, labP, labD, rivP, rivD,
  dir: [0, 1, 0], o: [0, 1, 0], t: [0, 0, 1], range: 0, apex: 0,
});
/** The six, in the order of data/home.ts `paypal.companies`. The vent sits to one side and throws ACROSS the frame, so
 * every arc is seen side-on (a throw straight away from the camera is a straight line, however high it goes). */
export const SITES: Site[] = [
  // the four its people founded: one after another, unequal throws
  site('YouTube', [0.43, 0.78], [0.56, 0.83], 0.1, 0.13, 0.75, 0.13, 'dl', 'd', [0.12, 0.02], [0.08, 0.02]),
  site('LinkedIn', [0.7, 0.475], [0.6, 0.61], 0.135, 0.15, 0.8, 0.75, 'r', 'r', [0.02, 0.08], [0.0, 0.08]),
  site('Yelp', [0.83, 0.655], [0.75, 0.68], 0.17, 0.15, 0.7, 0.37, 'dl', 'rd', [-0.06, 0.12], [0.08, 0.03]),
  site('Palantir', [0.68, 0.85], [0.72, 0.87], 0.205, 0.13, 0.48, 0.99, 'rd', 'rd', [-0.08, 0.1], [0.08, 0.06]),
  // Elon's share: SpaceX first and highest (it clears the atmosphere); Tesla later and short
  site('SpaceX', [0.5, 0.405], [0.88, 0.72], 0.385, 0.19, 0.9, 0.61, 'rl', 'dl', [0.1, 0.0], [0.06, 0.05]),
  site('Tesla', [0.15, 0.85], [0.33, 0.86], 0.47, 0.11, 0.3, 0.23, 'rd', 'ld', [0.1, 0.08], [-0.07, 0.07]),
];
/** PayPal's vent: where it sits at REF_P, its name's side, where its own river runs. */
const VENT = {
  pt: [0.27, 0.6] as [number, number], ls: [0.45, 0.7] as [number, number],
  labP: 'l', labD: 'l',
  rivP: [-0.1, 0.1] as [number, number], rivD: [-0.08, 0.1] as [number, number],
  dir: [0, 1, 0] as V3,
};
/** Wide screens see the throws far more side-on (a shallower look at the planet): lower them there. */
const LOFT_WIDE = 0.64;
/** The frame the layout is composed for: the heading's held moment. */
export const REF_P = 0.74;
const TAU_HOT = 0.027; // p: the head's white-gold cools to orange
const TAU_TRAIN = 0.036; // p: the red tail fades (gone by 3·TAU after landing)
/** ?ppall: every throw drawn whole and every name shown, to compose the layout (lab only). */
const DBG_ALL = typeof location !== 'undefined' && /[?&]ppall\b/.test(location.search);
/** Everything cools back into the planet's own look over the last stretch of the pin. */
const gone = (p: number) => 1 - smooth(0.885, 1, p);

/** PayPal's vent. heat 0..1 (it warms as the camera arrives, pulses with every throw, and cools once it has given
 * everything away: "long after PayPal itself was gone"); flash >= 0. */
export function vent(p: number) {
  const warm = smooth(0, 0.045, p);
  let flash = 0;
  for (const s of SITES) flash += Math.exp(-(((p - s.launch) / 0.012) ** 2));
  const spent = smooth(0.52, 0.86, p);
  // every throw takes some of it: the vent opens the scene twice the size of a spring and ends no bigger than one
  let thrown = 0;
  for (const s of SITES) thrown += smooth(s.launch - 0.005, s.launch + 0.04, p) / SITES.length;
  return { heat: warm * mix(1, 0.5, spent) * gone(p), flash: 0.55 * flash, grow: smooth(0, 0.1, p), size: mix(2.2, 1.15, thrown) };
}

// ---------------------------------------------------------------- the camera
// A slow orbital drift (s) and push (h) through the whole pin; the pitch follows so the planet's limb keeps its line
// in the frame (high enough on phones that the sky is a band for the captions, not half the picture).
const CAMS = {
  ph: { s0: 18.4, s1: 24.2, h0: 3500, h1: 2650, fov: 60, limb0: 0.35, limb1: 0.3, roll: 0, aspect: 390 / 844 },
  dt: { s0: 17.4, s1: 24.6, h0: 2950, h1: 2300, fov: 44, limb0: 0.5, limb1: 0.46, roll: -7, aspect: 1440 / 900 },
};
/** The move's own time (0..1 over MOVE): constant speed, eased in and out over its first and last 7% (it meets its
 * neighbours' segments at rest). */
export function drive(f: number) {
  const r = 0.07;
  const ramp = (x: number) => {
    const t = clamp(x / r);
    return r * (t * t * t - 0.5 * t * t * t * t);
  };
  const I = f < r ? ramp(f) : f <= 1 - r ? 0.5 * r + (f - r) : 1 - r - ramp(1 - f);
  return I / (1 - r);
}
/** The vertical field of view cameraFrom() ends up with (portrait screens keep the frame's width). */
const effFov = (fov: number, aspect: number) => (aspect < 0.6 ? (2 * Math.atan((Math.tan(0.5 * fov * D2R) * 0.6) / aspect)) / D2R : fov);
/** The move runs over this part of the pin. Before it the camera is still arriving from the story's climb and after
 * it it is already leaving for the next place: the module sets no keys there, so each neighbour's one eased segment
 * spans its gap AND that stretch of the pin (about 1.4 viewports each instead of a 1-viewport lurch). */
const MOVE: [number, number] = [0.1, 0.9];
/** The beat's camera as journey channels (f inside MOVE; clamped outside). */
export function beatChannels(f: number, narrow: boolean, R: number): Channels {
  const C = narrow ? CAMS.ph : CAMS.dt;
  const k = drive(clamp((f - MOVE[0]) / (MOVE[1] - MOVE[0])));
  const h = Math.exp(mix(Math.log(C.h0), Math.log(C.h1), k));
  const dip = Math.acos(R / (R + h));
  const L = mix(C.limb0, C.limb1, k);
  const pitch = -(dip + Math.atan((1 - 2 * L) * Math.tan(0.5 * effFov(C.fov, C.aspect) * D2R))) / D2R;
  // a slight bank on wide screens (the limb rises to the right, the captions have the sky on the left); it comes and
  // goes inside the move, since the neighbours' keys do not set a roll
  const roll = C.roll * smooth(MOVE[0], 0.3, f) * (1 - smooth(0.72, MOVE[1], f));
  return { s: R * D2R * mix(C.s0, C.s1, k), h, yaw: 0, pitch, roll, fov: C.fov };
}
/** Journey keys for the `paypal` place (desktop values, phones in `ph`): the move, sampled densely (no kinks). */
export function paypalKeys(R: number): Key[] {
  const out: Key[] = [];
  const us = [0, 0.0175, 0.035, 0.0525, 0.07];
  for (let k = 1; k <= 17; k++) us.push(0.07 + (0.86 * k) / 17);
  us.push(0.9475, 0.965, 0.9825, 1);
  us.forEach((u, n) => {
    const f = mix(MOVE[0], MOVE[1], u);
    const d = beatChannels(f, false, R), m = beatChannels(f, true, R);
    const k: Key = {
      // quiet: look's own rivers at about half their radiance, so the six new sources are what burns on the night side
      at: ['paypal', f], s: d.s, h: d.h, yaw: d.yaw, pitch: d.pitch, roll: d.roll, fov: d.fov, quiet: 0.5,
      ph: { s: m.s, h: m.h, yaw: m.yaw, pitch: m.pitch, roll: m.roll, fov: m.fov },
    };
    if (n > 0) k.ease = 'linear';
    out.push(k);
  });
  return out;
}

// ---------------------------------------------------------------- layout
/** Unit direction at great-circle angle a from `o` along the unit tangent `t`. */
const dirAt = (o: V3, t: V3, a: number): V3 => add(mul(o, Math.cos(a)), mul(t, Math.sin(a)));
/** World position on a throw at u (0..1): great circle in angle (constant horizontal speed), parabola in height. */
export function arcPos(R: number, th: Throw, u: number): V3 {
  return mul(dirAt(th.o, th.t, th.range * u), R * (1 + 4 * th.apex * u * (1 - u)));
}
/** A river from a place. `head`: the unit tangent it leaves along by design (the layout); `far`: where the layout
 * alone would end it; `j`: the point on one of look's own rivers it runs to (found and followed in `joinRiver`). */
type River = { head: V3; far: V3; j: V3 | null; wait: number; e: V3; len: number; amp: number; phase: number; k: number; seed: number };
const RIVERS: River[] = [0, 1, 2, 3, 4, 5, 6].map((i) => ({
  head: [0, 0, 1], far: [0, 1, 0], j: null, wait: 0, e: [0, 0, 1], len: 0,
  amp: 0.11 + 0.035 * Math.sin(i * 2.1), phase: i * 2.4, k: 4.2 + 1.9 * ((i * 0.618) % 1), seed: i * 1.7,
}));
/** [PayPal, ...SITES]: the sides each name may take in this layout, and the one it has. */
const LAB_OK: string[] = ['l', 'd', 'd', 'd', 'd', 'd', 'd'];
const LAB_POS: Pos[] = ['l', 'd', 'd', 'd', 'd', 'd', 'd'];
let layoutKey = '';
let layoutVer = 0;
/** Place the vent, the six landings and their rivers from screen targets (cast onto the sphere from the camera of the
 * heading's moment, REF_P), for this viewport. */
export function layout(R: number, narrow: boolean, w: number, h: number) {
  const key = `${R}|${narrow}|${Math.round(w)}|${Math.round(h)}`;
  if (key === layoutKey) return;
  layoutKey = key;
  layoutVer++;
  const cam = cameraFrom(R, beatChannels(REF_P, narrow, R), w, h);
  const cast = (x: number, y: number): V3 => {
    const rd = rayAt(cam, w, h, x * w, y * h);
    let t = seaT(R, cam, rd);
    if (t <= 0) t = -dot(cam.pos, rd); // a miss lands on the limb
    return norm(add(cam.pos, mul(rd, t)));
  };
  const river = (i: number, at: [number, number], by: [number, number], dir: V3) => {
    const end = cast(at[0] + by[0], at[1] + by[1]);
    const rv = RIVERS[i];
    rv.head = norm(sub(end, mul(dir, dot(dir, end))));
    rv.far = end;
    rv.j = null;
    rv.wait = 0;
  };
  const vp = narrow ? VENT.pt : VENT.ls;
  VENT.dir = cast(vp[0], vp[1]);
  river(0, vp, narrow ? VENT.rivP : VENT.rivD, VENT.dir);
  LAB_OK[0] = narrow ? VENT.labP : VENT.labD;
  LAB_POS[0] = LAB_OK[0][0] as Pos;
  SITES.forEach((s, i) => {
    const k = narrow ? s.pt : s.ls;
    s.dir = cast(k[0], k[1]);
    const d = clamp(dot(s.dir, VENT.dir), -1, 1);
    s.o = VENT.dir;
    s.t = norm(sub(s.dir, mul(VENT.dir, d)));
    s.range = Math.acos(d);
    s.apex = s.loft * s.range * (narrow ? 1 : LOFT_WIDE);
    river(i + 1, k, narrow ? s.rivP : s.rivD, s.dir);
    LAB_OK[i + 1] = narrow ? s.labP : s.labD;
    LAB_POS[i + 1] = LAB_OK[i + 1][0] as Pos;
  });
}

// ---------------------------------------------------------------- look's rivers
// The planet's own rivers are the zero set of a field in lib/world/glsl/planet.glsl (look_seaTemp). This is that field
// on the CPU (the same hash, value noise, meander and 3 octaves; double precision differs from the GPU's by far less
// than a river's width), so each new river can be run to the nearest of look's rivers and follow it as it drifts:
// the join is real, not a lucky overlap. Keep in step with planet.glsl if look changes its field.
/** How fast look's network drifts (field units per second of uTime). Read off planet.glsl's own text, so the join
 * holds whether look_seaTemp advects the field (`look_meander(p + vec3(t, 0.0, -t), q)`, t = uTime * 0.003) or lets
 * the network stand still (`look_meander(p, q)`). */
export const LOOK_DRIFT = /look_meander\(\s*p\s*\+\s*vec3\(\s*t\s*,/.test(planetGlsl) ? 0.003 : 0;
const fr = (x: number) => x - Math.floor(x);
function h13(x: number, y: number, z: number) {
  let a = fr(x * 0.1031), b = fr(y * 0.1031), c = fr(z * 0.1031);
  const d = a * (c + 31.32) + b * (b + 31.32) + c * (a + 31.32);
  a += d; b += d; c += d;
  return fr((a + b) * c);
}
function vnoise(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const q = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const ux = q(x - ix), uy = q(y - iy), uz = q(z - iz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const n = (dz: number) =>
    l(l(h13(ix, iy, iz + dz), h13(ix + 1, iy, iz + dz), ux), l(h13(ix, iy + 1, iz + dz), h13(ix + 1, iy + 1, iz + dz), ux), uy);
  return l(n(0), n(1), uz) * 2 - 1;
}
/** look_riverField(look_meander(q * Rg / 700 + (ts, 0, -ts), q)) at unit point q; ts = uTime * LOOK_DRIFT. */
export function lookField(q: V3, ts: number): number {
  let px = q[0] * (2000 / 700) + ts, py = q[1] * (2000 / 700), pz = q[2] * (2000 / 700) - ts;
  let g: V3 = [vnoise(px * 0.7, py * 0.7, pz * 0.7), vnoise(px * 0.7 + 17.3, py * 0.7 + 17.3, pz * 0.7 + 17.3), vnoise(px * 0.7 + 31.7, py * 0.7 + 31.7, pz * 0.7 + 31.7)];
  let c = cross(g, q);
  px += c[0] * 0.55; py += c[1] * 0.55; pz += c[2] * 0.55;
  g = [vnoise(px * 1.3 + 5.1, py * 1.3 + 5.1, pz * 1.3 + 5.1), vnoise(px * 1.3 + 23.9, py * 1.3 + 23.9, pz * 1.3 + 23.9), vnoise(px * 1.3 + 41.3, py * 1.3 + 41.3, pz * 1.3 + 41.3)];
  c = cross(g, q);
  px += c[0] * 0.22; py += c[1] * 0.22; pz += c[2] * 0.22;
  // look_fbm(pw * 0.8 + 2.0, 3, 0.0, 0.5)
  let x = px * 0.8 + 2, y = py * 0.8 + 2, z = pz * 0.8 + 2, sum = 0, a = 0.5;
  for (let i = 0; i < 3; i++) {
    sum += a * vnoise(x, y, z);
    const nx = (-0.8 * y - 0.6 * z) * 2.03, ny = (0.8 * x + 0.36 * y - 0.48 * z) * 2.03, nz = (0.6 * x - 0.48 * y + 0.64 * z) * 2.03;
    x = nx; y = ny; z = nz;
    a *= 0.5;
  }
  return sum;
}
/** Newton steps from unit point q toward the field's zero set (a river's centre line). Returns the point and |f| there. */
function toRiver(q: V3, ts: number, steps: number): { q: V3; f: number } {
  let f = lookField(q, ts);
  for (let k = 0; k < steps && Math.abs(f) > 1e-4; k++) {
    const tA = norm(cross(q, Math.abs(q[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])), tB = cross(q, tA);
    const h = 0.003;
    const ga = (lookField(norm(add(q, mul(tA, h))), ts) - f) / h, gb = (lookField(norm(add(q, mul(tB, h))), ts) - f) / h;
    const g2 = Math.max(ga * ga + gb * gb, 0.3);
    let sa = (-f * ga) / g2, sb = (-f * gb) / g2;
    const sl = Math.hypot(sa, sb);
    if (sl > 0.035) { sa *= 0.035 / sl; sb *= 0.035 / sl; }
    q = norm(add(q, add(mul(tA, sa), mul(tB, sb))));
    f = lookField(q, ts);
  }
  return { q, f: Math.abs(f) };
}
const JOIN_MIN = 0.075, JOIN_MAX = 0.3; // radians: how short and how long a new river may be
/** Runs river i (from unit point `from`) to one of look's rivers at field time ts. A river that is showing (`shown`)
 * only follows its meeting point as look's rivers drift (continuous); one that is not may pick a new one. */
function joinRiver(i: number, from: V3, ts: number, shown: boolean) {
  const rv = RIVERS[i];
  const ok = (j: V3) => {
    const a = Math.acos(clamp(dot(from, j), -1, 1));
    return a >= JOIN_MIN && a <= JOIN_MAX;
  };
  if (rv.j) {
    const r = toRiver(rv.j, ts, 3);
    if (r.f < 0.02 && (shown || ok(r.q))) rv.j = r.q;
    else rv.j = null;
  }
  if (!rv.j && --rv.wait < 0) {
    rv.wait = 40; // frames before another search, should none of look's rivers be in reach
    const side = cross(from, rv.head);
    for (const deg of [0, 45, -45, 90, -90, 135, -135, 180]) {
      const hd = add(mul(rv.head, Math.cos(deg * D2R)), mul(side, Math.sin(deg * D2R)));
      const r = toRiver(dirAt(from, hd, 0.15), ts, 14);
      if (r.f < 0.004 && ok(r.q)) { rv.j = r.q; break; }
    }
  }
  const end = rv.j ?? rv.far;
  const c = clamp(dot(from, end), -1, 1);
  rv.e = norm(sub(end, mul(from, c)));
  // (a meeting point that has drifted far while its river was showing: the river ends short of it, tapering out)
  rv.len = Math.min(Math.acos(c), 0.36);
}

// ---------------------------------------------------------------- per frame: the trails texture
// Rows of TW texels (RGBA32F): [0] screen box (tangent space x0, y0, x1, y1, padded), [1] (points, throw id, head
// intensity, head radius in world units), then per point two texels: (position relative to the camera xyz, K) and
// (intensity, half-width in world units, 0, 0).
export const CH_PTS = 9; // points per chunk (8 segments)
export const TW = 2 + 2 * CH_PTS;
export const ROWS = 40;
const SAMPLES = 44; // fixed grid points along a throw
const trail = new Float32Array(TW * ROWS * 4);
const boxes = new Float32Array(ROWS * 4);
const heads = new Float32Array(6 * 4);
/** The union of this frame's trail boxes (viewport CSS px): the crisp pass's box. */
const cssBox: [number, number, number, number] = [1e9, 1e9, -1e9, -1e9];
type Pt = { P: V3; K: number; I: number; w: number };

export interface Cam {
  pos: V3;
  /** world -> viewport CSS px (y down) and depth, or null behind */
  project(p: V3): [number, number, number] | null;
  w: number; // viewport CSS px
  h: number;
  focal: number; // CSS px
}

/** Fills the trails texture (and the heads) for beat progress p; returns the number of rows used. */
export function packTrails(p: number, t: number, cam: Cam, R: number): number {
  let row = 0;
  cssBox[0] = cssBox[1] = 1e9;
  cssBox[2] = cssBox[3] = -1e9;
  heads.fill(0);
  const out = gone(p);
  SITES.forEach((s, id) => {
    if (DBG_ALL) p = s.land - 1e-4;
    const uHead = (p - s.launch) / s.flight;
    const TH = TAU_HOT, TT = DBG_ALL ? 1 : TAU_TRAIN;
    if (uHead < 0 || p > s.land + 3 * TT || row >= ROWS || out <= 0) return;
    const pHead = Math.min(p, s.land);
    const after = Math.max(0, p - s.land); // after landing there is no head: everything ages on
    const span = Math.min(3 * TT, pHead - s.launch);
    const pts: Pt[] = [];
    // Points on a FIXED grid along the arc (plus the exact head and tail), so the drawn line never crawls as p moves:
    // scrolling only changes where it starts and ends and how hot each point is, never the polyline itself.
    const G = SAMPLES;
    const uH = (pHead - s.launch) / s.flight;
    const uT = Math.max(0, (pHead - span - s.launch) / s.flight);
    const us: number[] = [uH];
    for (let k = Math.ceil(uH * G) - 1; k / G > uT; k--) if (k / G < uH - 1e-6) us.push(k / G);
    us.push(uT);
    // the bead leaves the vent's pool and sinks into its spring: no pop at either end
    const lift = smooth(0, 0.035, uHead);
    for (const u of us) {
      const a = (uH - u) * s.flight; // how long ago the head was here
      const age = a + after;
      const P = arcPos(R, s, u);
      const hot = Math.exp(-age / TH);
      // white-hot at the bead, through yellow and Ember to a dull red as the tail stretches and thins
      const K = 900 + 1500 * hot;
      const fade = Math.exp(-age / TT) * (1 - smooth(2 * TT, 3 * TT, age));
      const I = (0.7 + 4.2 * hot) * fade * out * lift;
      const w = (0.0009 + 0.0027 * Math.exp(-age / 0.014)) * R; // half-width (world): thick by the bead, a thread behind
      pts.push({ P, K, I, w });
    }
    if (pts.length < 2) return;
    const shimmer = 0.9 + 0.1 * Math.sin(t * 2.3 + s.seed * 9) * Math.sin(t * 1.3 + s.seed * 50);
    const flying = after <= 0 && uHead <= 1;
    const headI = flying ? shimmer * 3.4 * out * lift * (1 - smooth(0.985, 1, uHead)) : 0;
    if (headI > 0) {
      const P = pts[0].P;
      heads[id * 4] = P[0] - cam.pos[0];
      heads[id * 4 + 1] = P[1] - cam.pos[1];
      heads[id * 4 + 2] = P[2] - cam.pos[2];
      heads[id * 4 + 3] = headI;
    }
    // chunks of CH_PTS points sharing their end points
    for (let c0 = 0; c0 < pts.length - 1 && row < ROWS; c0 += CH_PTS - 1) {
      const c1 = Math.min(c0 + CH_PTS, pts.length);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, any = false;
      const base = row * TW * 4;
      for (let j = c0; j < c1; j++) {
        const q = pts[j];
        const pr = cam.project(q.P);
        if (pr) {
          const pad = ((q.w * cam.focal) / pr[2]) * 2.5 + 5;
          x0 = Math.min(x0, pr[0] - pad);
          x1 = Math.max(x1, pr[0] + pad);
          y0 = Math.min(y0, pr[1] - pad);
          y1 = Math.max(y1, pr[1] + pad);
          any = true;
        }
        const o = base + (2 + 2 * (j - c0)) * 4;
        trail[o] = q.P[0] - cam.pos[0];
        trail[o + 1] = q.P[1] - cam.pos[1];
        trail[o + 2] = q.P[2] - cam.pos[2];
        trail[o + 3] = q.K;
        trail[o + 4] = q.I;
        trail[o + 5] = q.w;
        trail[o + 6] = 0;
        trail[o + 7] = 0;
      }
      if (!any) continue;
      // CSS px (y down) -> the camera's tangent space (y up), the same in both passes whatever their resolution
      boxes[row * 4] = trail[base] = (x0 - cam.w / 2) / cam.focal;
      boxes[row * 4 + 1] = trail[base + 1] = -(y1 - cam.h / 2) / cam.focal;
      boxes[row * 4 + 2] = trail[base + 2] = (x1 - cam.w / 2) / cam.focal;
      boxes[row * 4 + 3] = trail[base + 3] = -(y0 - cam.h / 2) / cam.focal;
      cssBox[0] = Math.min(cssBox[0], x0); cssBox[1] = Math.min(cssBox[1], y0);
      cssBox[2] = Math.max(cssBox[2], x1); cssBox[3] = Math.max(cssBox[3], y1);
      trail[base + 4] = c1 - c0;
      trail[base + 5] = id;
      trail[base + 6] = c0 === 0 ? headI : 0;
      trail[base + 7] = 0.0044 * R; // the bead's radius (world): bigger near the camera, a point far away
      row++;
    }
  });
  return row;
}

// ---------------------------------------------------------------- GLSL
export const PAYPAL_GLSL = /* glsl */ `
uniform float paypal_uOn;       // 0: nothing of the beat is on screen (every hook returns at once)
uniform float paypal_uT;        // the clock, for the rivers' slow flow
uniform vec4 paypal_uSpot[7];   // xyz unit direction of the place (0 = PayPal), w heat 0..1
uniform vec4 paypal_uSpotB[7];  // x ring radius (rad; PayPal: its size), y ring strength, z flash, w how far its river has run (0..1)
uniform vec4 paypal_uRiv[7];    // xyz the river's heading at the place (unit tangent), w its length (rad)
uniform vec4 paypal_uRivB[7];   // x meander amplitude (of its length), y phase, z turns, w flow phase
uniform vec4 paypal_uJoin[7];   // xyz where its river meets one of look's (unit), w how much it feeds it (0..1)
uniform vec4 paypal_uHead[6];   // the beads in the air: xyz relative to the camera, w intensity
uniform float paypal_uRows;     // rows used in the trails texture
uniform float paypal_uMinPx;    // thinnest line (render px)
uniform float paypal_uMinPxCrisp; // thinnest line in the crisp pass (canvas px)
uniform highp sampler2D paypal_uTrail;
uniform vec4 paypal_uBox[${ROWS}]; // each row's screen box (tangent space x0, y0, x1, y1), so a pixel only reads rows it is inside
#define PAYPAL_ROWS ${ROWS}
// One gain on every kelvin the beat adds to the sea: the place to rebalance it if look's sea gets hotter or cooler
// (Planck: +-10% here is about a factor 2 in the springs' radiance).
const float PAYPAL_HEAT = 1.0;

// blackbody: linear sRGB chroma (unit luminance) x a compressed power curve relative to 1500 K
vec3 paypal_bbChroma(float K){
  float t = K/100.;
  float r = t<=66. ? 1. : clamp(1.292936*pow(t-60., -0.1332047), 0., 1.);
  float g = t<=66. ? clamp(0.390082*log(t)-0.631841, 0., 1.) : clamp(1.129891*pow(t-60., -0.0755148), 0., 1.);
  float b = t>=66. ? 1. : (t<=19. ? 0. : clamp(0.543207*log(t-10.)-1.196254, 0., 1.));
  vec3 c = pow(vec3(r,g,b), vec3(2.2));
  return c / max(dot(c, vec3(.2126,.7152,.0722)), 1e-4);
}
vec3 paypal_bb(float K){ return paypal_bbChroma(max(K, 700.)) * pow(K/1500., 4.5); }

// Kelvin added to the sea at unit point q (fpr: the pixel's footprint in radians). Each place is a spring (a hot core
// in a cooling pool), the ring of heat its landing sent out, and the river that runs from it: a meander with a hot
// core, cooler banks and slow pulses moving downstream. Features thinner than a pixel are spread over it (energy
// kept), so nothing aliases toward the limb. No sprite, no outline: only temperature, which look's Planck curve turns
// into light.
float paypal_kelvin(vec3 q, float fpr){
  float K = 0., fed = 0.;
  for (int i = 0; i < 7; i++){
    vec4 sp = paypal_uSpot[i];
    vec4 sb = paypal_uSpotB[i];
    if (sp.w <= 0.001 && sb.z <= 0.001 && sb.y <= 0.001) continue;
    float cs = dot(q, sp.xyz);
    if (cs < 0.9) continue;                       // beyond ~26 deg nothing of this place reaches
    vec3 d = q - sp.xyz * cs;
    float rr = length(d);
    float big = i == 0 ? sb.x : 1.;                // the vent's size (it has no ring: x is free)
    float rc = 0.0058 * big, rcE = max(rc, 1.2 * fpr);
    float core = exp(-rr*rr/(rcE*rcE)) * (rc/rcE);
    float pool = exp(-rr/(0.021 * big)) * (1. - smoothstep(0.08, 0.2, rr));
    K += sp.w * ((i == 0 ? 560. : 400.) * core + 125. * big * pool);
    K += sb.z * 210. * exp(-rr*rr/(0.012*0.012));           // the landing (or the throw): a brief wide flush
    if (sb.y > 0.001){                                       // the ring of heat running out
      float rw = max(0.007 + 0.34 * sb.x, 1.5 * fpr);
      float x = (rr - sb.x) / rw;
      K += sb.y * 105. * exp(-x*x);
    }
    // where its river has reached one of look's, the sea is a little warmer for a stretch: Planck's law does the rest
    // (the dark sea barely shows 30 K, a river already glowing gains a third), so the network itself burns a little
    // hotter round every confluence; several close together saturate (fed, below) instead of adding up to a blaze
    vec4 jn = paypal_uJoin[i];
    if (jn.w > 0.001){
      float dj = 2. * (1. - dot(q, jn.xyz));               // squared chord to the meeting point
      fed += jn.w * exp(-dj / (0.06*0.06));
    }
    vec4 rv = paypal_uRiv[i];
    float L = rv.w;
    if (L > 0.004 && sb.w > 0.001){
      float a = dot(d, rv.xyz), b = dot(d, cross(sp.xyz, rv.xyz));
      float u = a / L;
      if (u > -0.1 && u < 1.2 && abs(b) < 0.35 * L + 0.09){
        vec4 rb = paypal_uRivB[i];
        float uc = clamp(u, 0., 1.);
        float se = sin(PI*uc), ce = cos(PI*uc), ph = rb.z*uc + rb.y;
        float M = rb.x * L * se * sin(ph);
        float dM = rb.x * (PI*ce*sin(ph) + rb.z*se*cos(ph));
        float dist = abs(b - M) / sqrt(1. + dM*dM);
        float tip = (L + 0.014) * sb.w;
        float along = smoothstep(-0.004, 0.008, a) * (1. - smoothstep(tip - 0.04, tip, a));
        // a tributary: finer than look's rivers at its spring, nearly their width where it meets them
        float wc = mix(0.0034, 0.0066, uc), wcE = max(wc, 1.2 * fpr);
        float wh = max(mix(0.009, 0.019, uc), 2. * fpr);
        float flow = 0.78 + 0.22 * sin(a*95. - paypal_uT*0.8 + rb.w);   // slow pulses of hotter metal running downstream
        // it runs into one of look's own rivers at its end: there look's heat takes over (two full rivers would add
        // up to a white knot at every confluence)
        float meet = 1. - 0.82 * smoothstep(0.66, 1., u);
        K += sp.w * along * meet * (mix(190., 130., uc) * exp(-dist*dist/(wcE*wcE)) * (wc/wcE) * flow + mix(95., 100., uc) * exp(-dist/wh));
      }
    }
  }
  return (K + 34. * (1. - exp(-fed))) * PAYPAL_HEAT;
}

void paypal_sea(Ray r, Sea s, inout SeaMod m){
  if (paypal_uOn < 0.5) return;
  m.heat += paypal_kelvin(s.q, s.fw * sqrt(s.graz) / uR) / 850.;   // SeaMod.heat: 850 K per unit (lava.glsl)
  // a bead in the air lights the sea under it: a soft pool of its glow that travels with it and tightens as it comes
  // down (inverse square), which is what tells the eye how high it flies
  if (paypal_uRows > 0.5){
    vec3 P = s.p - uCamPos;
    for (int i = 0; i < 6; i++){
      vec4 hd = paypal_uHead[i];
      if (hd.w <= 0.) continue;
      vec3 v = hd.xyz - P;
      float d2 = dot(v, v);
      if (d2 > 6.0e6) continue;
      m.emit += paypal_bb(1750.) * hd.w * 1300. * max(dot(v, s.up), 0.) / ((d2 + 1.6e5) * sqrt(d2 + 1.));
    }
  }
}

// The throws in the air: per pixel, the nearest point of each throw's sampled path (ray-segment closest approach),
// a gaussian cross-section in pixels (never thinner than minPx; a widened line keeps its energy), coloured by the
// blackbody of that point. One contribution per throw (no double counting at joints); hidden behind the planet.
vec3 paypal_trails(Ray r, float tMax, float minPx){
  int rows = int(paypal_uRows + 0.5);
  if (rows <= 0) return vec3(0);
  vec3 v = r.rd * uCam; // the pixel in the camera's tangent space (resolution independent), like the CPU's boxes
  vec2 ndc = v.xy / v.z;
  vec3 ro = r.ro - uCamPos;
  vec3 acc = vec3(0);
  float curId = -1.; float bestV = 0.; float bestK = 1000.;
  for (int i = 0; i < PAYPAL_ROWS; i++){
    if (i >= rows) break;
    vec4 box = paypal_uBox[i];
    if (ndc.x < box.x || ndc.x > box.z || ndc.y < box.y || ndc.y > box.w) continue;
    vec4 info = texelFetch(paypal_uTrail, ivec2(1, i), 0);
    // rows of one throw are contiguous: one contribution per throw (its brightest point here)
    if (info.y != curId){ acc += paypal_bb(bestK) * bestV; bestV = 0.; curId = info.y; }
    int n = int(info.x + 0.5);
    vec4 a0 = texelFetch(paypal_uTrail, ivec2(2, i), 0);
    vec4 a1 = texelFetch(paypal_uTrail, ivec2(3, i), 0);
    if (info.z > 0.){ // the bead: a small white-hot drop with its real size (bigger near the camera)
      vec3 w = a0.xyz - ro; float t = dot(w, r.rd);
      if (t > 0. && t < tMax){
        float dpx = length(w - r.rd*t) / (t * r.pa);
        float rpx = max(info.w / (t * r.pa), minPx * 0.8);
        float v = info.z * exp(-2.8*pow(dpx/rpx, 2.));
        if (v > bestV){ bestV = v; bestK = 2450.; }
      }
    }
    for (int j = 1; j < ${CH_PTS}; j++){
      if (j >= n) break;
      vec4 b0 = texelFetch(paypal_uTrail, ivec2(2 + 2*j, i), 0);
      vec4 b1 = texelFetch(paypal_uTrail, ivec2(3 + 2*j, i), 0);
      vec3 u = b0.xyz - a0.xyz, w0 = ro - a0.xyz;
      float b = dot(r.rd, u), c = dot(u, u), d = dot(r.rd, w0), e = dot(u, w0);
      float den = c - b*b;
      float sp = den > 1e-9*c ? clamp((e - b*d) / den, 0., 1.) : 0.;
      vec3 q = a0.xyz + u*sp;
      float t = dot(q - ro, r.rd);
      if (t > 0. && t < tMax){
        float dpx = length(ro + r.rd*t - q) / (t * r.pa);
        float wpx = mix(a1.y, b1.y, sp) / (t * r.pa);
        float wc = max(wpx, minPx);
        float x = dpx / wc;
        if (x < 2.5){
          float v = mix(a1.x, b1.x, sp) * (wpx / wc) * exp(-4.*x*x);
          if (v > bestV){ bestV = v; bestK = mix(a0.w, b0.w, sp); }
        }
      }
      a0 = b0; a1 = b1;
    }
  }
  return acc + paypal_bb(bestK) * bestV;
}

// scene pass: each bead's soft glare (the bloom carries it; the crisp pass has no bloom of its own), and the trails
// themselves only when there is no crisp pass this frame
void paypal_over(Ray r, Hit h, inout vec3 col){
  if (paypal_uOn < 0.5 || paypal_uRows < 0.5) return;
  for (int i = 0; i < 6; i++){
    vec4 hd = paypal_uHead[i];
    if (hd.w <= 0.) continue;
    float t = dot(hd.xyz, r.rd);
    if (t <= 0. || t > h.t) continue;
    float dpx = length(hd.xyz - r.rd*t) / (t * r.pa);
    if (dpx < 10.) col += paypal_bb(2100.) * hd.w * 0.55 * exp(-dpx*dpx/7.);
  }
  if (uCrispOn > 0.5) return;
  col += paypal_trails(r, h.t, paypal_uMinPx);
}
// crisp pass: light adds (an emitter covers nothing), hidden behind the planet by the exact sea sphere
vec4 paypal_crisp(Ray r, float tScene){
  if (paypal_uRows < 0.5) return vec4(0.);
  float ts = world_seaT(r);
  return vec4(paypal_trails(r, ts > 0. ? ts : 1e30, paypal_uMinPxCrisp), 0.);
}
`;

// ---------------------------------------------------------------- the module
const S = {
  section: null as HTMLElement | null,
  caps: [] as HTMLElement[],
  names: [] as HTMLElement[],
  labels: [0, 1, 2, 3, 4, 5, 6].map(() => ({ x: 0, y: 0, o: 0, po: 0, a: 0 })), // [PayPal, ...SITES]; o = a (how far it has come in) x the beat's fade-out; po: o of the frame before
  caps01: [0, 0, 0, 0, 0],
  rows: 0,
  ver: 0,
  on: false,
  posVer: -1,
  box: null as DOMRect | null,
};
const SPOT = new Float32Array(28), SPOTB = new Float32Array(28), RIV = new Float32Array(28), RIVB = new Float32Array(28), JOIN = new Float32Array(28); // reused every frame
/** The beat's labels, captions and trail rows of the last frame (tests, lab). */
export const paypalDebug = () => ({ rows: S.rows, labels: S.labels.map((l) => ({ ...l })), caps: [...S.caps01], box: [...cssBox] });

export const paypal: WorldModule = {
  id: 'paypal',
  glsl: PAYPAL_GLSL,
  hooks: ['sea', 'over', 'crisp'],
  crispBox(f: Frame) {
    if (!S.rows) return null;
    return [Math.max(0, cssBox[0]), Math.max(0, cssBox[1]), Math.min(f.w, cssBox[2]), Math.min(f.h, cssBox[3])];
  },
  keys: paypalKeys,
  init({ root }) {
    S.section = root.querySelector<HTMLElement>('[data-place="paypal"]');
    S.caps = S.section ? [...S.section.querySelectorAll<HTMLElement>('[data-pp-step]')] : [];
    S.names = S.section ? [...S.section.querySelectorAll<HTMLElement>('[data-pp-name]')] : [];
    if (S.section) S.section.dataset.live = '';
  },
  update(f: Frame, u: Uniforms) {
    const R = f.R;
    const p = f.places.paypal ? f.at('paypal') : 0;
    const on = p > 0 && p < 1;
    if (on !== S.on || !S.ver) u.set('paypal_uOn', on ? 1 : 0);
    S.on = on;
    S.caps01 = S.caps01.map((_, i) => captionOpacity(i, p));
    if (!on) {
      if (S.rows || !S.ver) {
        S.rows = 0;
        u.set('paypal_uRows', 0);
        u.tex('paypal_uTrail', { w: TW, h: ROWS, data: trail, format: 'rgba32f' }, ++S.ver);
      } else u.tex('paypal_uTrail', { w: TW, h: ROWS, data: trail, format: 'rgba32f' }, S.ver);
      for (const L of S.labels) L.o = L.po = 0;
      return;
    }
    layout(R, f.narrow, f.w, f.h);
    const t = f.still ? 0 : f.t;
    const out = gone(p);
    // the places: PayPal's vent, then the six
    const v = vent(p);
    const breathe = 1 + 0.035 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1);
    SPOT.set([...VENT.dir, v.heat * breathe], 0);
    SPOTB.set([v.size, 0, v.flash * out, v.grow], 0);
    SITES.forEach((s, i) => {
      const age = p - s.land;
      const lit = smooth(-0.004, 0.03, age) * out * (1 + 0.03 * Math.sin(t * 0.8 + s.seed * 20));
      const flash = age > -0.004 ? smooth(-0.004, 0.002, age) * Math.exp(-Math.max(age, 0) / 0.016) * out : 0;
      // the ring: out fast, then it slows and settles as it fades
      const ringR = age > 0 ? 0.075 * (1 - Math.exp(-age / 0.04)) : 0;
      const ringS = age > 0 ? smooth(0, 0.006, age) * Math.exp(-age / 0.04) * (1 - smooth(0.1, 0.17, age)) * out : 0;
      // the river: off quickly, then slower and slower as it nears the network
      const g = clamp((age - 0.012) / 0.2);
      SPOT.set([...s.dir, lit], (i + 1) * 4);
      SPOTB.set([ringR, ringS, flash, 1 - (1 - g) ** 2.5], (i + 1) * 4);
    });
    RIVERS.forEach((rv, i) => {
      joinRiver(i, i ? SITES[i - 1].dir : VENT.dir, t * LOOK_DRIFT, SPOTB[i * 4 + 3] > 0.001 && SPOT[i * 4 + 3] > 0.001);
      RIV.set([...rv.e, rv.len], i * 4);
      RIVB.set([rv.amp, rv.phase, rv.k, rv.seed], i * 4);
      // it feeds the network once it has arrived (the last fifth of its run)
      const end = rv.j ?? rv.far;
      JOIN.set([end[0], end[1], end[2], rv.j ? smooth(0.8, 1, SPOTB[i * 4 + 3]) * SPOT[i * 4 + 3] : 0], i * 4);
    });
    u.set('paypal_uJoin', JOIN);
    u.set('paypal_uSpot', SPOT);
    u.set('paypal_uSpotB', SPOTB);
    u.set('paypal_uRiv', RIV);
    u.set('paypal_uRivB', RIVB);
    u.set('paypal_uT', t % 1e4);
    // the throws (uploaded only while some are in the air, and once more to clear)
    const cam: Cam = { pos: f.cam.pos, project: (q) => f.project(q), w: f.w, h: f.h, focal: f.cam.focal };
    const rows = packTrails(p, t, cam, R);
    if (rows || S.rows || !S.ver) u.tex('paypal_uTrail', { w: TW, h: ROWS, data: trail, format: 'rgba32f' }, ++S.ver);
    else u.tex('paypal_uTrail', { w: TW, h: ROWS, data: trail, format: 'rgba32f' }, S.ver);
    if (rows || S.rows) {
      u.set('paypal_uBox', boxes);
      u.set('paypal_uHead', heads);
    }
    S.rows = rows;
    u.set('paypal_uRows', rows);
    u.set('paypal_uMinPx', Math.max(1.2, 0.75 * f.quality.scale));
    u.set('paypal_uMinPxCrisp', 1.6); // canvas px: ~0.55 CSS px at dpr 3, a hairline that stays solid
    // read layout here, before any module writes the DOM this frame (a read in after() would force a layout)
    S.box = S.names[0]?.parentElement?.getBoundingClientRect() ?? null;
    const labOut = 1 - smooth(0.9, 0.985, p);
    const lab = (dir: V3, a: number, k: number) => {
      const pr = f.project(mul(dir, R));
      const L = S.labels[k];
      L.po = L.o;
      if (pr) {
        L.x = pr[0];
        L.y = pr[1];
        L.a = a;
        L.o = a * labOut;
      } else L.o = 0;
    };
    // a name that is not showing yet takes, of the sides no throw crosses, the one that lies darkest: away from look's
    // rivers (they drift) and from the place's own new river. Legibility by composition, nothing behind the text.
    const side = (k: number, from: V3) => {
      const L = S.labels[k], ok = LAB_OK[k];
      if (L.po > 0.001 || ok.length < 2) return; // it was showing: it keeps its side
      const tw = (f.narrow ? 7.4 : 8.6) * (k ? SITES[k - 1].name.length : 6), off = (f.narrow ? 35 : 43) + 8;
      const rv = RIVERS[k];
      let best = -1e9, pick = ok[0] as Pos;
      for (let n = 0; n < ok.length; n++) {
        const c = ok[n] as Pos;
        const cx = L.x + (c === 'r' ? off + tw / 2 - 8 : c === 'l' ? -off - tw / 2 + 8 : 0), cy = L.y + (c === 'd' ? off : c === 'u' ? -off : 0);
        let sc = 1e9;
        for (const dx of [-0.45, 0, 0.45]) {
          const hit = f.hitSea(cx + dx * tw, cy);
          if (!hit) { sc = Math.min(sc, 0.05); continue; }
          const q = norm(hit.p);
          sc = Math.min(sc, Math.abs(lookField(q, t * LOOK_DRIFT)));
          for (let m = 1; m <= 4; m++) if (dot(q, dirAt(from, rv.e, (rv.len * m) / 4)) > Math.cos(0.035)) sc -= 1;
        }
        sc -= 0.04 * n;
        if (sc > best) { best = sc; pick = c; }
      }
      if (pick !== LAB_POS[k]) { LAB_POS[k] = pick; layoutVer++; }
    };
    lab(VENT.dir, smooth(0.012, 0.05, p), 0);
    SITES.forEach((s, i) => {
      lab(s.dir, DBG_ALL ? 1 : smooth(s.land + 0.03, s.land + 0.085, p), i + 1);
      side(i + 1, s.dir);
    });
  },
  after() {
    S.caps.forEach((c, i) => {
      const o = S.caps01[i] ?? 0;
      c.style.opacity = o.toFixed(3);
      c.style.translate = `0 ${((1 - o) * 10).toFixed(1)}px`;
      c.style.visibility = o > 0.001 ? 'visible' : 'hidden';
    });
    if (S.posVer !== layoutVer) {
      S.posVer = layoutVer;
      S.names.forEach((n, i) => (n.dataset.pos = LAB_POS[i] ?? 'd'));
    }
    // the names' container scrolls away with the section once the pin releases; the labels are in viewport px
    const box = S.box;
    const ox = box ? box.left : 0, oy = box ? box.top : 0;
    // all the names leave together as the pin releases (rather than being clipped one by one)
    const leave = box ? Math.min(1, Math.max(0, 1 + box.top / (0.25 * window.innerHeight))) : 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const snap = (x: number) => Math.round(x * dpr) / dpr; // hairlines stay on the pixel grid
    S.names.forEach((n, i) => {
      const L = S.labels[i];
      if (!L) return;
      const o = L.o * leave, a = L.o > 0 ? L.a : 0;
      n.style.translate = `${snap(L.x - ox)}px ${snap(L.y - oy)}px`;
      // the hairline draws out over the first 60% of the fade, the whole annotation dims as one on the way out
      n.style.opacity = (a > 0 ? Math.min(1, a * 2.5) * (o / a) : 0).toFixed(3);
      n.style.setProperty('--in', a.toFixed(3));
      n.style.visibility = o > 0.001 ? 'visible' : 'hidden';
    });
  },
  dispose() {
    if (S.section) delete S.section.dataset.live;
    S.caps.forEach((c) => {
      c.style.opacity = '';
      c.style.translate = '';
      c.style.visibility = '';
    });
    S.names.forEach((n) => {
      n.style.opacity = '';
      n.style.translate = '';
      n.style.visibility = '';
      n.style.removeProperty('--in');
    });
  },
};

