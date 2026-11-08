// PayPal → six companies (role `paypal`; storyboard, research and decisions in lab/paypal/NOTES.md).
//
// Seen from over the night side, PayPal is one hot vent on the molten planet. eBay buys it, the pressure builds and it
// erupts: four molten embers go up on real ballistic throws over the planet's curve (a long exposure of Stromboli's lava
// bombs: a white-gold head, a trail cooling through gold and orange to a red train that widens, drifts and fades), each
// lands with a short flash and lights a new place with soft lava flows, like a city seen from orbit: YouTube, LinkedIn,
// Yelp, Palantir. Then Elon's share goes up in one high throw that clears the atmosphere (SpaceX) and a later, short one
// (Tesla). The camera rises as they spread (the scale reveal). At the end the six burn while PayPal's vent cools ("long
// after PayPal itself was gone").
//
// Everything visible is a pure function of the beat progress p = frame.at('paypal') (0..1), so it scrubs both ways and
// any frame can be reproduced; the clock t only adds life at rest (head flicker, train drift). Nothing is left sitting:
// every train is gone within 3·TAU_TRAIN of its landing; the lit places stay (part of the world from then on).
//
// How it draws (lib/world/ARCHITECTURE.md):
// - `sea` hook: the places' heat on the lava (`paypal_places(q)`), from 7 small uniform arrays;
// - `over` hook: the throws in the air, traced per pixel against their sampled paths (a float texture of short chunks,
//   each with a tight screen box, so a pixel only walks the few segments near it); depth-tested against the scene's hit,
//   so the planet hides what is behind its limb;
// - `after`: the captions' opacity and the names, written on the section's own DOM (components/world/PayPal.tsx).
// The camera move for this place is `paypalKeys()` (journey keys; the world lead splices them in).

import type { Frame, V3 } from './frame';
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
 * index 3 is the display line (the section's heading). */
export const CAPTION_AT: [number, number][] = [
  [0.02, 0.215],
  [0.235, 0.455],
  [0.475, 0.7],
  [0.715, 0.855],
  [0.865, 0.99], // gone just before the pin releases (it would otherwise ride up under the nav)
];
export function captionOpacity(i: number, p: number) {
  const [a, b] = CAPTION_AT[i] ?? [2, 2];
  return smooth(a, a + 0.03, p) * (1 - smooth(b - 0.03, b, p));
}

/** A ballistic throw from a unit direction `o` on the planet, in the tangent frame (tf, tr) there. */
export interface Throw {
  o: V3;
  tf: V3;
  tr: V3;
  bearing: number; // radians, 0 = tf, + = toward tr
  range: number; // radians of great circle
  apex: number; // in radii
  launch: number; // p
  flight: number; // p
  land: number; // p
  seed: number;
  /** intensity, width and cooling-time scales (spatter is small, dim and short-lived) */
  gain: number;
  size: number;
  tau: number;
  samples: number;
}
export interface Site extends Throw {
  name: string;
  /** Where the place sits in the frame once the camera has risen (p = END_P): [x, y] viewport fractions, y down. */
  pt: [number, number]; // phones (portrait)
  ls: [number, number]; // wide
  loft: number;
  dir: V3; // the landing place (unit)
}
const site = (name: string, pt: [number, number], ls: [number, number], launch: number, loft: number, seed: number): Site => ({
  name, pt, ls, launch, loft, seed, dir: [0, 1, 0], o: [0, 1, 0], tf: [0, 0, 1], tr: [-1, 0, 0],
  bearing: 0, range: 0, apex: 0, flight: 0, land: 1, gain: 1, size: 1, tau: 1, samples: 64,
});
/** The six, in the order of data/home.ts `paypal.companies`. */
export const SITES: Site[] = [
  // one eruption: the four its people founded, a split second apart, unequal throws
  site('YouTube', [0.2, 0.555], [0.38, 0.6], 0.23, 1.0, 0.13),
  site('LinkedIn', [0.6, 0.47], [0.56, 0.47], 0.237, 1.25, 0.75),
  site('Yelp', [0.84, 0.575], [0.76, 0.55], 0.243, 0.9, 0.37),
  site('Palantir', [0.74, 0.765], [0.79, 0.76], 0.25, 1.1, 0.99),
  // Elon's share: SpaceX first and highest (it clears the atmosphere); Tesla later and short
  site('SpaceX', [0.15, 0.475], [0.9, 0.62], 0.492, 2.6, 0.61),
  site('Tesla', [0.24, 0.8], [0.3, 0.8], 0.62, 0.9, 0.23),
];
export const END_P = 0.78;
export const ERUPT_P = 0.236;
const TAU_HOT = 0.022; // p: the head's white-gold cools to orange
const TAU_TRAIN = 0.05; // p: the red train fades (gone by 3·TAU after landing)

/** PayPal's vent: pressure builds, erupts (and again for Elon's throws), then cools. heat 0..1, flash ≥ 0. */
export function vent(p: number) {
  const swell = smooth(0.08, 0.228, p);
  const flash =
    0.5 * Math.exp(-(((p - ERUPT_P) / 0.008) ** 2)) +
    0.7 * Math.exp(-(((p - 0.494) / 0.01) ** 2)) +
    0.45 * Math.exp(-(((p - 0.622) / 0.01) ** 2));
  const cool = smooth(0.8, 0.97, p);
  return { heat: mix(0.55 + 0.45 * swell, 0.12, cool), flash };
}

// ---------------------------------------------------------------- the planet frame
/** Where PayPal is: round the journey's great circle (degrees), on its line (u = 0). */
export const PP_DEG = 34; // the camera starts 18-21 deg behind it: just past where story leaves off (deg 12)
export type Planet = { R: number; up: V3; fwd: V3; right: V3 };
export function planet(R: number): Planet {
  const th = PP_DEG * D2R;
  const up: V3 = [0, Math.cos(th), Math.sin(th)];
  const fwd: V3 = [0, -Math.sin(th), Math.cos(th)]; // the travel direction
  const right = cross(fwd, up); // = (-1, 0, 0): the journey's +u
  return { R, up, fwd, right };
}
/** Unit direction at great-circle angle a along bearing b (radians) from `o` in the frame (tf, tr). */
function dirAt(o: V3, tf: V3, tr: V3, b: number, a: number): V3 {
  const t = add(mul(tf, Math.cos(b)), mul(tr, Math.sin(b)));
  return add(mul(o, Math.cos(a)), mul(t, Math.sin(a)));
}
/** World position on a throw at u (0..1): great circle in angle (constant horizontal speed), parabola in height. */
export function arcPos(R: number, th: Throw, u: number): V3 {
  const d = dirAt(th.o, th.tf, th.tr, th.bearing, th.range * u);
  return mul(d, R * (1 + 4 * th.apex * u * (1 - u)));
}

/** The camera this beat wants. It opens low by the vent (the classic Stromboli viewpoint: the dome swells, the eruption
 * towers into the stars), then rises to orbit as the embers arc over the curve, which is the scale reveal; aimed so
 * PayPal holds its place in the frame all the way up. */
export function beatCamera(p: number, narrow: boolean, pl: Planet) {
  const approach = smooth(0, 0.22, p);
  const rise = smooth(0.245, 0.37, p);
  const lo = 0.026 + 0 * approach; // one altitude while low (its s must not drift backwards)
  const hi = narrow ? 0.62 : 0.34;
  const alt = Math.exp(mix(Math.log(lo), Math.log(hi), rise)); // even in log space, like the journey's h
  // a fixed distance behind the vent (the journey's s must never run backwards): it only climbs
  const back = mix(narrow ? 0.31 : 0.37, narrow ? 0.3 : 0.36, rise);
  const R = pl.R;
  const pos = add(mul(pl.up, R * (1 + alt)), mul(pl.fwd, -back * R));
  const fov = narrow ? 64 : 48;
  const vy = mix(narrow ? -0.26 : -0.32, narrow ? -0.34 : -0.42, rise); // PayPal's height in the frame (NDC)
  const dv = norm(sub(mul(pl.up, R), pos));
  const camUp = norm(pos);
  const perp = norm(sub(camUp, mul(dv, dot(camUp, dv))));
  const d = Math.atan(-vy * Math.tan((fov * D2R) / 2));
  const f = norm(add(mul(dv, Math.cos(d)), mul(perp, Math.sin(d))));
  return { pos, f, fov };
}
/** The same camera as journey channels (s, h, pitch, fov; yaw 0, x 0). */
export function beatChannels(p: number, narrow: boolean, R: number) {
  const c = beatCamera(p, narrow, planet(R));
  const r = len(c.pos);
  const up = mul(c.pos, 1 / r);
  return { s: R * Math.atan2(c.pos[2], c.pos[1]), h: r - R, pitch: Math.asin(clamp(dot(c.f, up), -1, 1)) / D2R, fov: c.fov };
}
/** Journey keys for the `paypal` place (desktop values, phones in `ph`), sampled from beatCamera. */
export function paypalKeys(R: number): Key[] {
  const out: Key[] = [];
  for (const f of [0, 0.06, 0.12, 0.18, 0.22, 0.245, 0.26, 0.275, 0.29, 0.305, 0.32, 0.335, 0.35, 0.37, 0.6, 0.8, 0.9, 0.95, 1]) {
    const d = beatChannels(f, false, R), m = beatChannels(f, true, R);
    const k: Key = {
      at: ['paypal', f], s: d.s, h: d.h, yaw: 0, pitch: d.pitch, fov: d.fov,
      // a cooler night sea under the beat (lava.heat is additive and carries on to later keys: back to 0 at the end)
      'lava.heat': -0.15 * smooth(0, 0.2, f) * (1 - smooth(0.9, 1, f)),
      ph: { s: m.s, h: m.h, pitch: m.pitch, fov: m.fov },
    };
    if (f > 0) k.ease = 'linear';
    out.push(k);
  }
  return out;
}

// ---------------------------------------------------------------- layout
/** Every throw of the beat: the six, plus spatter (a few short-lived sparks at each eruption and each landing, dying
 * within ~0.02 of p: real lava bombs and re-entries shed fragments of unequal brightness and lifetime). */
export const THROWS: Throw[] = [];
const hash = (x: number) => {
  const v = Math.sin(x * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
let layoutKey = '';
/** Place the six landings from their screen targets (cast onto the sphere from the beat's end camera). */
export function layout(R: number, narrow: boolean, aspect: number) {
  const key = `${R}|${narrow}|${aspect.toFixed(3)}`;
  if (key === layoutKey) return;
  layoutKey = key;
  const pl = planet(R);
  const c = beatCamera(END_P, narrow, pl);
  const cr = norm(cross(c.f, norm(c.pos))), cu = cross(cr, c.f);
  const tan = Math.tan((c.fov * D2R) / 2);
  for (const s of SITES) {
    const k = narrow ? s.pt : s.ls;
    const rd = norm(add(c.f, add(mul(cr, (k[0] * 2 - 1) * tan * aspect), mul(cu, (1 - k[1] * 2) * tan))));
    const b = dot(c.pos, rd), cc = dot(c.pos, c.pos) - R * R, disc = b * b - cc;
    const t = disc > 0 ? -b - Math.sqrt(disc) : -b; // a miss lands on the limb
    s.dir = norm(add(c.pos, mul(rd, t)));
    const d = clamp(dot(s.dir, pl.up), -1, 1);
    s.range = Math.acos(d);
    const tg = sub(s.dir, mul(pl.up, d));
    s.bearing = Math.atan2(dot(tg, pl.right), dot(tg, pl.fwd));
    s.o = pl.up;
    s.tf = pl.fwd;
    s.tr = pl.right;
    // a throw at a shallow fixed angle: apex ∝ range, flight time ∝ √range (capped so the last train is gone in time)
    s.apex = 0.12 * s.range * s.loft;
    s.flight = Math.min(0.125 * Math.sqrt(s.range / 0.3) * Math.pow(s.loft, 0.3), 0.17);
    s.land = s.launch + s.flight;
  }
  THROWS.length = 0;
  SITES.forEach((s, i) => {
    THROWS.push(s);
    for (let k = 0; k < 2; k++) {
      // spatter at the vent, short and steep around this ember's heading
      const h = (j: number) => hash(i * 17.3 + k * 5.1 + j * 1.37);
      const range = 0.006 + 0.01 * h(1), flight = 0.012 + 0.01 * h(2), launch = s.launch + 0.002 * h(4);
      THROWS.push({ o: pl.up, tf: pl.fwd, tr: pl.right, bearing: s.bearing + (h(3) - 0.5) * 1.4, range, apex: 0.45 * range,
        launch, flight, land: launch + flight, seed: h(5), gain: 0.35 + 0.3 * h(6), size: 0.5, tau: 0.35, samples: 9 });
    }
    // spatter at the landing: a splash that carries on forward
    const v = sub(s.dir, pl.up);
    const tf = norm(sub(v, mul(s.dir, dot(v, s.dir))));
    const tr = cross(s.dir, tf);
    for (let k = 0; k < 4; k++) {
      const h = (j: number) => hash(i * 31.7 + k * 7.9 + j * 2.11 + 3);
      const range = 0.003 + 0.008 * h(1), flight = 0.008 + 0.01 * h(2), launch = s.land + 0.0015 * h(4);
      THROWS.push({ o: s.dir, tf, tr, bearing: (h(3) - 0.5) * 2.4, range, apex: 0.5 * range, launch, flight,
        land: launch + flight, seed: h(5), gain: 0.3 + 0.35 * h(6), size: 0.45, tau: 0.3, samples: 9 });
    }
  });
}

// ---------------------------------------------------------------- per frame: the trails texture
// Rows of TW texels (RGBA32F): [0] screen box (NDC x0, y0, x1, y1, padded), [1] (points, throw id, head intensity, 0),
// then per point two texels: (position relative to the camera xyz, K) and (intensity, half-width in world units, 0, 0).
export const CH_PTS = 9; // points per chunk (8 segments)
export const TW = 2 + 2 * CH_PTS;
export const ROWS = 64;
const trail = new Float32Array(TW * ROWS * 4);
const boxes = new Float32Array(ROWS * 4);
type Pt = { P: V3; K: number; I: number; w: number };

export interface Cam {
  pos: V3;
  /** world -> viewport CSS px (y down) and depth, or null behind */
  project(p: V3): [number, number, number] | null;
  w: number; // viewport CSS px
  h: number;
  focal: number; // CSS px
}

/** Fills the trails texture for beat progress p; returns the number of rows used. */
export function packTrails(p: number, t: number, cam: Cam, R: number): number {
  let row = 0;
  THROWS.forEach((s, id) => {
    const uHead = (p - s.launch) / s.flight;
    const TH = TAU_HOT * s.tau, TT = TAU_TRAIN * s.tau;
    if (uHead < 0 || p > s.land + 3 * TT || row >= ROWS) return;
    const pHead = Math.min(p, s.land);
    const after = Math.max(0, p - s.land); // after landing there is no head: everything ages on
    const span = Math.min(3 * TT, pHead - s.launch);
    const pts: Pt[] = [];
    const N = s.samples;
    for (let i = 0; i <= N; i++) {
      const a = span * Math.pow(i / N, 1.7); // dense at the head, sparse in the old train
      const u = (pHead - a - s.launch) / s.flight;
      if (u < 0 || u > 1) continue;
      const age = a + after;
      let P = arcPos(R, s, u);
      // the train drifts: a slow sideways wander that grows with age (wind on a meteor train): alive at rest
      const wob = Math.min(age / 0.06, 1.5) * 0.004 * R * s.size;
      const nrm = norm(P);
      const side = norm(cross(nrm, sub(arcPos(R, s, Math.min(u + 0.01, 1)), P)));
      const ph = u * 9 + s.seed * 7 + t * 0.25;
      P = add(P, add(mul(side, wob * Math.sin(ph)), mul(nrm, wob * 0.5 * Math.cos(ph * 1.3))));
      const hot = Math.exp(-age / TH);
      const K = 900 + 1350 * hot + 200 * Math.exp(-age / (0.03 * s.tau));
      const fade = Math.exp(-age / TT) * (1 - smooth(2 * TT, 3 * TT, age)) * smooth(0, 0.004 * s.tau, a + 0.0005);
      // tumble: a lava bomb has a hot side, so its trail breathes a little (slow and shallow: never beads)
      const tumble = 1 + 0.07 * Math.sin((s.launch + u * s.flight) * 280 + s.seed * 20);
      const I = (0.9 + 3 * hot) * s.gain * fade * tumble;
      const w = (0.0003 + 0.0012 * (1 - Math.exp(-age / 0.04))) * R * s.size * 1.6; // half-width (world): ~2 m bombs, trains that spread
      pts.push({ P, K, I, w });
    }
    if (pts.length < 2) return;
    const flick = after > 0 ? 0 : (0.92 + 0.08 * Math.sin(t * 9 + s.seed * 9) * Math.sin(t * 5.3 + s.seed * 50)) * 2 * s.gain;
    // chunks of CH_PTS points sharing their end points
    for (let c0 = 0; c0 < pts.length - 1 && row < ROWS; c0 += CH_PTS - 1) {
      const c1 = Math.min(c0 + CH_PTS, pts.length);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, any = false;
      const base = row * TW * 4;
      for (let j = c0; j < c1; j++) {
        const q = pts[j];
        const pr = cam.project(q.P);
        if (pr) {
          const pad = ((q.w * cam.focal) / pr[2]) * 2.5 + 4;
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
      // CSS px (y down) -> NDC (y up)
      boxes[row * 4] = trail[base] = (x0 / cam.w) * 2 - 1;
      boxes[row * 4 + 1] = trail[base + 1] = 1 - (y1 / cam.h) * 2;
      boxes[row * 4 + 2] = trail[base + 2] = (x1 / cam.w) * 2 - 1;
      boxes[row * 4 + 3] = trail[base + 3] = 1 - (y0 / cam.h) * 2;
      trail[base + 4] = c1 - c0;
      trail[base + 5] = id;
      trail[base + 6] = c0 === 0 && uHead <= 1 ? flick : 0;
      trail[base + 7] = 0;
      row++;
    }
  });
  return row;
}

// ---------------------------------------------------------------- GLSL
export const PAYPAL_GLSL = /* glsl */ `
uniform vec4 paypal_uSpot[7];   // xyz unit direction of the place (0 = PayPal), w heat 0..1
uniform vec4 paypal_uSpotB[7];  // x age since landing (p), y ripple age (p), z flash, w seed
uniform vec4 paypal_uDome;      // x dome height, y dome radius, z wave radius, w wave height (world units)
uniform vec2 paypal_uVentW;     // PayPal's surface coords (u across, v along)
uniform float paypal_uRows;     // rows used in the trails texture
uniform float paypal_uMinPx;    // thinnest line (render px)
uniform highp sampler2D paypal_uTrail;
uniform vec4 paypal_uBox[${ROWS}]; // each row's screen box (NDC x0, y0, x1, y1), so a pixel only reads rows it is inside
#define PAYPAL_ROWS ${ROWS}

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
float paypal_hash(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float paypal_noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(paypal_hash(i),paypal_hash(i+vec3(1,0,0)),f.x),mix(paypal_hash(i+vec3(0,1,0)),paypal_hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(paypal_hash(i+vec3(0,0,1)),paypal_hash(i+vec3(1,0,1)),f.x),mix(paypal_hash(i+vec3(0,1,1)),paypal_hash(i+vec3(1,1,1)),f.x),f.y),f.z); }

// The places on the lava: a hot core, a soft halo, and a few soft flows that meander out from the new vent as it ages
// (like lava running out, or a city's lights seen from orbit). No spikes, no crust, no outlines. q: unit sphere point.
vec3 paypal_places(vec3 q){
  vec3 emit = vec3(0);
  float ripple = 0.;
  for (int i=0;i<7;i++){
    float heat = paypal_uSpot[i].w, flash = paypal_uSpotB[i].z;
    if (heat <= 0.001 && flash <= 0.001) continue;
    vec3 sd = paypal_uSpot[i].xyz;
    float cs = dot(q, sd);
    if (cs < 0.99) continue; // beyond ~8 deg nothing of this place reaches
    float ang = acos(min(cs, 1.));
    vec3 tx = normalize(cross(sd, abs(sd.x) < .9 ? vec3(1,0,0) : vec3(0,1,0)));
    vec3 ty = cross(sd, tx);
    vec3 d = q - sd*cs;
    float phi = atan(dot(d, ty), dot(d, tx));
    float age = paypal_uSpotB[i].x, seed = paypal_uSpotB[i].w;
    float grow = 1. - exp(-age*14.);
    float lobes = 0.;
    for (int k=0;k<4;k++){
      float fk = float(k);
      float L = (0.035 + 0.06*fract(seed*7.3+fk*.37)) * grow;
      if (L < 1e-4) continue;
      float along = ang / L;
      float a0 = seed*6.283 + fk*1.9 + 0.5*sin(seed*31.+fk) + 0.9*(fract(seed*3.1+fk*.71)-.5)*along;
      float dphi = atan(sin(phi-a0), cos(phi-a0));
      float wdt = (0.42 - 0.22*clamp(along, 0., 1.)) * (0.8 + 0.4*paypal_noise(q*540. + fk*7.));
      lobes += exp(-dphi*dphi/(wdt*wdt)) * smoothstep(1.05, 0.2, along) * smoothstep(0.0, 0.25, along)
             * (0.6 + 0.4*paypal_noise(q*960. + fk*3.));
    }
    float core = exp(-pow(ang/0.005, 2.));
    float mid = exp(-pow(ang/0.022, 2.));
    float halo = exp(-ang/0.05);
    float Ks = mix(900., 1650., core) + 250.*mid;
    emit += paypal_bb(Ks) * heat * (2.2*core + 0.55*mid + 0.1*halo + 0.5*lobes);
    emit += vec3(1.,.93,.82) * flash * 1.5 * exp(-pow(ang/0.005, 2.));
    float ra = paypal_uSpotB[i].y; // a faint heat ripple running out from a landing, gone fast
    if (ra > 0. && ra < 0.12) ripple += exp(-pow((ang - ra*0.55)/(0.004 + ra*0.05), 2.)) * exp(-ra*60.) * 0.12;
  }
  return emit + paypal_bb(1250.) * ripple * 0.9;
}

void paypal_sea(Ray r, Sea s, inout SeaMod m){
  m.emit += paypal_places(s.q);
  // before the eruption the lava over the vent swells into a smooth dome; after it, one wave runs out on the sea
  vec2 d = s.w - paypal_uVentW;
  float r2 = dot(d, d);
  if (r2 < 4e6 && (paypal_uDome.x > 0.001 || paypal_uDome.w > 0.001)){
    float rr = sqrt(r2) + 1e-3;
    float sg = paypal_uDome.y;
    float h = paypal_uDome.x * exp(-r2/(sg*sg));
    float dh = -2.*rr/(sg*sg) * h; // dh/dr
    float rw = paypal_uDome.z, ww = 6. + 0.06*rw;
    float x = (rr - rw)/ww;
    float hw = paypal_uDome.w * (exp(-x*x) - 0.45*exp(-pow(x + 1.6, 2.))); // a crest with a shallow trough behind
    dh += paypal_uDome.w * (-2.*x/ww*exp(-x*x) + 0.45*2.*(x + 1.6)/ww*exp(-pow(x + 1.6, 2.)));
    m.g += vec3(h + hw, dh * d / rr);
    m.heat += 0.06 * h; // the dome warms a little; the wave is shape only (no glowing ring)
  }
}

// The throws in the air: per pixel, the nearest point of each throw's sampled path (ray-segment closest approach),
// a gaussian cross-section in pixels (never thinner than paypal_uMinPx; a widened line keeps its energy), coloured by
// the blackbody of that point. One contribution per throw (no double counting at joints); hidden behind the planet.
void paypal_over(Ray r, Hit h, inout vec3 col){
  int rows = int(paypal_uRows + 0.5);
  if (rows <= 0) return;
  vec2 ndc = gl_FragCoord.xy / uRes * 2. - 1.;
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
    if (info.z > 0.){ // the head: a tight white-gold point (bloom carries its glare)
      vec3 w = a0.xyz - ro; float t = dot(w, r.rd);
      if (t > 0. && t < h.t){
        float dpx = length(w - r.rd*t) / (t * r.pa);
        float v = info.z * exp(-4.*pow(dpx/(paypal_uMinPx*0.8), 2.));
        if (v > bestV){ bestV = v; bestK = 2500.; }
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
      if (t > 0. && t < h.t){
        float dpx = length(ro + r.rd*t - q) / (t * r.pa);
        float wpx = mix(a1.y, b1.y, sp) / (t * r.pa);
        float wc = max(wpx, paypal_uMinPx);
        float x = dpx / wc;
        if (x < 2.5){
          float v = mix(a1.x, b1.x, sp) * (wpx / wc) * exp(-4.*x*x);
          if (v > bestV){ bestV = v; bestK = mix(a0.w, b0.w, sp); }
        }
      }
      a0 = b0; a1 = b1;
    }
  }
  acc += paypal_bb(bestK) * bestV;
  col += acc;
}
`;

// ---------------------------------------------------------------- the module
const S = {
  section: null as HTMLElement | null,
  caps: [] as HTMLElement[],
  names: [] as HTMLElement[],
  labels: [0, 1, 2, 3, 4, 5, 6].map(() => ({ x: 0, y: 0, o: 0 })), // [PayPal, ...SITES]
  caps01: [0, 0, 0, 0, 0],
  rows: 0,
  ver: 0,
};
/** The beat's labels, captions and trail rows of the last frame (tests, lab). */
export const paypalDebug = () => ({ rows: S.rows, labels: S.labels.map((l) => ({ ...l })), caps: [...S.caps01] });

export const paypal: WorldModule = {
  id: 'paypal',
  glsl: PAYPAL_GLSL,
  hooks: ['sea', 'over'],
  keys: paypalKeys,
  init({ root }) {
    S.section = root.querySelector<HTMLElement>('[data-place="paypal"]');
    S.caps = S.section ? [...S.section.querySelectorAll<HTMLElement>('[data-pp-step]')] : [];
    S.names = S.section ? [...S.section.querySelectorAll<HTMLElement>('[data-pp-name]')] : [];
    if (S.section) S.section.dataset.live = '';
  },
  update(f: Frame, u: Uniforms) {
    const R = f.R;
    const pl = planet(R);
    layout(R, f.narrow, f.w / f.h);
    const p = f.places.paypal ? f.at('paypal') : 0;
    const t = f.still ? 0 : f.t;
    // the places
    const v = vent(p);
    const spot = new Float32Array(28), spotB = new Float32Array(28);
    spot.set([...pl.up, v.heat], 0);
    spotB.set([1, p - ERUPT_P, v.flash, 0.42], 0);
    SITES.forEach((s, i) => {
      const age = p - s.land;
      spot.set([...s.dir, smooth(0, 0.012, age)], (i + 1) * 4);
      spotB.set([Math.max(age, 0), age, age > 0 ? Math.exp(-age / 0.008) : 0, s.seed], (i + 1) * 4);
    });
    u.set('paypal_uSpot', spot);
    // the dome over the vent (grows with the pressure, gone in the burst) and the one wave the burst sends out
    const age = p - ERUPT_P;
    const domeH = 5 * smooth(0.06, 0.228, p) * (1 - smooth(-0.004, 0.004, age));
    const waveR = age > 0 ? 9000 * age : 0;
    const waveH = age > 0 ? 1.2 * Math.exp(-age / 0.04) * smooth(0, 0.004, age) : 0;
    u.set('paypal_uDome', [domeH, 40, waveR, waveH]);
    u.set('paypal_uVentW', [0, R * PP_DEG * D2R]);
    u.set('paypal_uSpotB', spotB);
    // the throws (uploaded only while some are in the air, and once more to clear)
    const cam: Cam = { pos: f.cam.pos, project: (q) => f.project(q), w: f.w, h: f.h, focal: f.cam.focal };
    const rows = p > 0 && p < 1 ? packTrails(p, t, cam, R) : 0;
    if (rows || S.rows || !S.ver) u.tex('paypal_uTrail', { w: TW, h: ROWS, data: trail, format: 'rgba32f' }, ++S.ver);
    else u.tex('paypal_uTrail', { w: TW, h: ROWS, data: trail, format: 'rgba32f' }, S.ver);
    S.rows = rows;
    u.set('paypal_uRows', rows);
    if (rows || S.rows) u.set('paypal_uBox', boxes);
    u.set('paypal_uMinPx', Math.max(1.2, 0.75 * f.quality.scale));
    // captions and names
    S.caps01 = S.caps01.map((_, i) => captionOpacity(i, p));
    const lab = (dir: V3, o: number, k: number) => {
      const pr = f.project(mul(dir, R));
      const L = S.labels[k];
      if (pr) {
        L.x = pr[0];
        L.y = pr[1];
        L.o = o;
      } else L.o = 0;
    };
    lab(pl.up, smooth(0.03, 0.08, p) * (1 - 0.85 * smooth(0.2, 0.232, p) * (1 - smooth(0.3, 0.34, p))) * (1 - 0.55 * smooth(0.82, 0.97, p)), 0);
    SITES.forEach((s, i) => lab(s.dir, smooth(s.land + 0.004, s.land + 0.03, p), i + 1));
  },
  after() {
    S.caps.forEach((c, i) => {
      const o = S.caps01[i] ?? 0;
      c.style.opacity = o.toFixed(3);
      c.style.translate = `0 ${((1 - o) * 10).toFixed(1)}px`;
      c.style.visibility = o > 0.001 ? 'visible' : 'hidden';
    });
    // the names' container scrolls away with the section once the pin releases; the labels are in viewport px
    const box = S.names[0]?.parentElement?.getBoundingClientRect();
    const ox = box ? box.left : 0, oy = box ? box.top : 0;
    // all the names leave together as the pin releases (rather than being clipped one by one)
    const leave = box ? Math.min(1, Math.max(0, 1 + box.top / (0.25 * window.innerHeight))) : 1;
    S.names.forEach((n, i) => {
      const L = S.labels[i];
      if (!L) return;
      n.style.translate = `${(L.x - ox).toFixed(1)}px ${(L.y - oy - 12).toFixed(1)}px`;
      n.style.opacity = (L.o * leave).toFixed(3);
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
    });
  },
};
