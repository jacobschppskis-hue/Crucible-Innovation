// The shore (owner: shore): the last stretch of the lap, from the footer to the hero.
//
// 1. `shore` (the footer): first light. The camera climbs in orbit just short of the morning terminator while the sun
//    comes up over the limb ahead: the limb's thin line ignites (ember, gold, white where the sun breaks through, the
//    blue of the upper air), then the sun's glare stands over it. The footer's text sits in the dark sky above.
// 2. `dawn` (the giant wordmark): the day side, crossed high and fast, flying with the sun: it stands low over the limb
//    under the wordmark and slides across the frame as the camera banks into its turn, its warm path on the sea under
//    it; then the descent to the evening sea, where the mark gathers round the sun again.
// 3. The black-sand shore (Jacob: "a dark sand, like a black sand shoreline. The waves are going to be lapping against
//    the shore constantly"; "waves breaking on a shoreline, except glowing"): the camera comes down past a cape of wet
//    black sand and pulls back from it toward the hero, looking along its waterline at the setting sun.
//
// The sand is not geometry: it is the sea's own sphere with another material, set through the sea hook (cold, still,
// a little rough: a flat of wet black sand that mirrors the dusk like the sea does, with the lava's own Fresnel and
// sky). No raymarch, no silhouettes, nothing to stair-step; every edge is filtered by the pixel's footprint. The sand
// is a crescent whose cape comes beside the travel line ~1000 units before the hero and whose horns sweep away, so
// from the hero (and from the loop's last key) all of it is under the horizon.
// - the surf: smooth crests running in to the waterline, shoaling as they come in (shape only: they show in the sun's
//   glitter and the mirrored sky), the sea a little hotter and calmer in the shallows;
// - the swash: each wave sends a thin molten sheet up the sand, fast up and slow to drain, its front scalloped; the
//   front is a thin bright thread, the sand it leaves glows and cools to black; one wave clock for crests and swash.

import type { WorldModule } from './modules';
import type { Channels } from './frame';
import type { Key } from './journey';
import { cameraFrom, surfOf } from './camera';

const GLSL = /* glsl */ `
// the lava's glow (look's Planck radiance x the lava gain), as lava.glsl lights its sea
vec3 shore_planck(float T){ return look_planck(T) * look_uLavaGain; }
uniform float shore_uOn;    // 0 far away (all work skipped) .. 1 on the run home
uniform float shore_uT;     // the surf's clock (s)
uniform vec4 shore_uGlare;  // x: the sun's glare in the lens (strength x how much of its disc stands over the limb);
                            // y: the limb igniting round the sun; z: 0 while the sun is under the limb .. 1 over it; w: 0 .. 1 as it climbs clear
uniform float shore_uPath;  // the sun's long glitter path on the sea seen from orbit (gain, 0 = off)
const float SHORE_PER = 9.0;    // seconds per wave (slow: the sea is big)
const float SHORE_LAM = 30.0;   // crest spacing (units)
const float SHORE_W = 520.0;    // width of the sand flat (molten sea again behind it)
const float SHORE_V0 = -1000.0; // where the cape comes nearest the travel line (u = 0)

// the waterline: u = shore_c(v), sand on the +u side: a crescent of sand whose rounded cape comes within ~20 units of
// the travel line at SHORE_V0 (the sun's glitter column, straight down the travel line, stays on open sea beside it)
// and whose horns sweep away from it (toward the hero it stays > 500 units from the loop's last key, under
// its horizon; on the way down the camera comes in over the sea beside it, never over the sand)
float shore_c(float v){
  float q = v - SHORE_V0;
  return 22.0 + 0.0011 * q * q + 10.0 * sin(q * 0.0052) + 3.5 * sin(q * 0.0143);
}
float shore_cD(float v){
  float q = v - SHORE_V0;
  return 0.0022 * q + 10.0 * 0.0052 * cos(q * 0.0052) + 3.5 * 0.0143 * cos(q * 0.0143);
}

// the shore at a sea point: where it is across the shore and in the wave cycle, how much of the pixel is bare sand
struct ShoreK {
  float x;      // inland distance from the waterline (> 0 on the sand)
  vec2 nS;      // unit, landward, in (u, v)
  float fN;     // the pixel's footprint across the shore (units): every edge is filtered by it
  float tph;    // the wave clock here (cycles)
  float wobD;   // d(tph)/dv
  float edge;   // 1 .. 0 where the flat tapers out
  float ph;     // 0 when a crest reaches the waterline
  float L;      // how far this wave's sheet runs up the sand
  float xf;     // the sheet's front now
  float land;   // bare sand (1) vs the sheet and the sea (0)
  float a1, a2; // how much of the front's along-shore detail the pixel resolves
  float e1;     // the soft width of the sheet's edge
};
bool shore_k(Ray r, Sea s, out ShoreK k){
  vec2 w = s.w;
  if (w.y > 150.0 || w.y < -2500.0 || w.x < -320.0 || w.x > 2400.0) return false;
  float cd = shore_cD(w.y);
  float nrm = inversesqrt(1.0 + cd * cd);
  k.x = (w.x - shore_c(w.y)) * nrm;
  float W = SHORE_W * smoothstep(-2400.0, -1700.0, w.y) * smoothstep(130.0, -500.0, w.y);
  if (k.x < -300.0 || k.x > W + 60.0) return false;
  vec2 dl = vec2(dot(r.rd, s.eU), dot(r.rd, s.eV));
  float l = length(dl);
  vec2 al = l > 1e-5 ? dl / l : vec2(0.0, 1.0);
  k.nS = vec2(1.0, -cd) * nrm;
  k.fN = r.pa * s.t * length(vec2(dot(vec2(-al.y, al.x), k.nS), dot(al, k.nS) / s.graz));
  vec2 tS = vec2(-k.nS.y, k.nS.x);           // along the shore
  float fT = r.pa * s.t * length(vec2(dot(vec2(-al.y, al.x), tS), dot(al, tS) / s.graz));
  k.a1 = 1.0 - smoothstep(4.0, 16.0, fT);    // how much of the front's lobes (37 units) the pixel resolves along the shore
  k.a2 = 1.0 - smoothstep(2.5, 9.0, fT);     // and of its finer wander (20 units and less)
  // one wave clock: each stretch of coast a little out of step, so crests come in slightly oblique and bowed
  k.wobD = 0.3 * 0.021 * cos(w.y * 0.021 + 1.3) + 0.18 * 0.0063 * cos(w.y * 0.0063) + 0.05 * 0.071 * cos(w.y * 0.071 + 0.4);
  k.tph = shore_uT / SHORE_PER + 0.3 * sin(w.y * 0.021 + 1.3) + 0.18 * sin(w.y * 0.0063) + 0.05 * sin(w.y * 0.071 + 0.4);
  k.edge = smoothstep(0.0, 40.0, W);
  k.ph = fract(k.tph);
  // every wave runs up a different distance, its front scalloped (overlapping lobes, never a ruler line)
  float hw = world_hash12(vec2(floor(k.tph), 7.0));
  // (lobes the pixel cannot resolve along the shore fade to their mean and soften the edge instead: no zigzag far off)
  k.L = (11.0 + 4.0 * sin(w.y * 0.017 + 0.7)) * (0.7 + 0.5 * hw)
      * (0.72 + 0.42 * mix(0.6366, abs(sin(w.y * 0.085 + 6.2831853 * hw)), k.a1) + 0.1 * sin(w.y * 0.31 + 4.0 * hw) * k.a2);
  k.xf = k.ph < 0.25 ? k.L * sin(k.ph * 6.2831853) : k.L * pow(1.0 - (k.ph - 0.25) / 0.75, 1.6);
  k.e1 = max(0.2, k.fN * 0.75) + 0.2 * k.xf * (1.0 - k.a1);
  float e1 = k.e1, e2 = max(4.0, k.fN);
  k.land = smoothstep(-e1, e1, k.x - k.xf) * (1.0 - smoothstep(W - e2, W + e2, k.x)) * k.edge;
  return true;
}

void shore_sea(Ray r, Sea s, inout SeaMod m){
  // ---- from orbit: the sun's glitter path. A sea too far to resolve is a rough mirror (slope variance ~0.03): the low
  // sun lies on it as a warm path from the limb toward the camera, reddening into the terminator (look_sunLight)
  if (shore_uPath > 0.0) {
    vec3 v = -r.rd, hv = normalize(uSunDir + v);
    float nh = max(dot(s.up, hv), 1e-3), nl = dot(s.up, uSunDir), nv = max(dot(s.up, v), 0.0);
    float nh2 = nh * nh;
    float D = exp(-(1.0 - nh2) / (nh2 * 0.03)) / (PI * 0.03 * nh2 * nh2);
    float F = 0.05 + 0.95 * pow(1.0 - max(dot(v, hv), 0.0), 5.0);
    float G = smoothstep(0.0, 0.05, nl) * smoothstep(0.0, 0.06, nv);
    m.emit += look_sunLight(s.p) * vec3(1.0, 0.8, 0.55) * (shore_uPath * D * F * G / (4.0 * (nv + 0.12)));
  }
  float on = shore_uOn;
  if (on <= 0.0) return;
  ShoreK k;
  if (!shore_k(r, s, k)) return;
  vec2 w = s.w;
  float x = k.x;
  // the planet's rivers drift (look_seaTemp): one passing through would light the whole bay orange and drown the
  // swash's thin lines, so beside the sand the sea keeps its resting temperature (the rivers carry on further out)
  float low = 1.0 - smoothstep(60.0, 300.0, uCamH);
  if (low > 0.0) {
    float ex = look_seaTemp(s.q, s.fw / look_uK, -1.0) - 1075.0;
    m.heat -= max(ex, 0.0) / 850.0 * (0.9 * low * on * k.edge * smoothstep(-300.0, -140.0, x));
  }

  // ---- the sea: crests running in ----
  if (x < 2.0) {
    float d = max(-x, 0.0);                    // seaward distance
    float cyc = k.tph + d / SHORE_LAM;
    float idx = floor(cyc + 0.5);
    // a smooth, peaked crest (no cusp: a kink in the slope is a hard line in the glint), its landward face steeper
    float th = fract(cyc) * 6.2831853;
    float thw = th + 0.6 * (cos(th) - 1.0);
    float c = 0.5 + 0.5 * cos(thw), c4 = c * c * c * c;
    float shoal = smoothstep(260.0, 50.0, d) * (1.0 - 0.75 * smoothstep(9.0, 0.0, d)) * k.edge;
    float A = 0.6 * shoal * on * (0.65 + 0.35 * sin(idx * 2.4 + w.y * 0.011));
    float att = 1.0 - smoothstep(0.6, 2.4, k.fN);           // crests finer than a pixel fade to their mean
    float hc = A * 5.0 * c4 * (-0.5 * sin(thw)) * (1.0 - 0.6 * sin(th)) * 6.2831853;   // d(height)/d(cycle)
    m.g += vec3(A * (c4 * c - 0.25), hc * (-k.nS / SHORE_LAM + vec2(0.0, k.wobD))) * att;
    // the shallows: a thinner skin, a little hotter, and calmer water
    m.heat += 0.07 * smoothstep(110.0, 0.0, d) * on * k.edge;
    m.calm = max(m.calm, 0.6 * on * smoothstep(-30.0, 0.0, x) * k.edge);
  }

  // ---- the sand and the swash ----
  if (x > -1.0) {
    float ph = k.ph, L = k.L, xf = k.xf, land = k.land;
    // a tidal flat: mirror-wet by the water, damp all the way up (it mirrors the dusk, more softly the further up)
    float wet = 1.0 - 0.75 * smoothstep(L, L * 1.2 + 120.0, x);
    // black sand: cold (no glow) and still
    m.heat -= 0.55 * land * on;
    m.calm = max(m.calm, on * k.edge * smoothstep(-1.0, 0.5, x));
    m.rough += land * on * mix(0.24, 0.03, wet);
    // long, low undulations of the flat (they only show in what the sand mirrors)
    float und = (1.0 - smoothstep(6.0, 20.0, s.fw)) * land * on * (1.0 - 0.5 * wet);
    m.g.y += 0.03 * und * cos(w.x * 0.11 + 2.0 * sin(w.y * 0.013));
    m.g.z += 0.02 * und * cos(w.y * 0.07 + w.x * 0.03);
    // the sheet: a thin molten film, hottest behind its front while it runs up, cooling as it drains
    float e1 = k.e1;
    float inS = smoothstep(-e1, e1, x) * (1.0 - smoothstep(-e1, e1, x - xf));
    float upk = 1.0 - 0.55 * smoothstep(0.2, 0.42, ph);
    float lipd = max(xf - x, 0.0);
    vec3 e = shore_planck(1085.0 + 75.0 * exp(-lipd / 1.5) * upk - 30.0 * smoothstep(0.25, 1.0, ph)) * inS;
    float sg = max(0.3, k.fN * 0.9) + 0.5 * (e1 - max(0.2, k.fN * 0.75));
    float dx = x - xf;
    float thr = mix(0.78, 0.55 + 0.45 * world_noise(vec2(w.y * 0.11, floor(k.tph) * 1.7)), k.a2);   // the thread's brightness wanders along it
    // (a hot thin core in a cooler, wider glow: never a tube)
    e += (shore_planck(1270.0 + 70.0 * upk * thr) * exp(-dx * dx / (2.0 * sg * sg)) * min(1.0, 0.3 / sg)
        + shore_planck(1190.0) * exp(-dx * dx / (18.0 * sg * sg)) * 0.5) * upk * thr * smoothstep(-1.0, 0.3, x);
    // the sand the sheet just left glows and cools
    if (x > 0.0 && x < L) {
      float phx = 0.25 + 0.75 * (1.0 - pow(x / L, 0.625));
      float age = (ph >= phx ? ph - phx : ph + 1.0 - phx) * SHORE_PER;
      e += shore_planck(1160.0 - 60.0 * age) * exp(-age / 2.0) * land * 0.8;
    }
    m.emit += e * on * k.edge;
  }
}

void shore_over(Ray r, Hit h, inout vec3 col){
  // black sand does not glow: take the molten sea's ember floor (lava.glsl) back out of the bare sand, which leaves
  // what it mirrors and the sun's sheen
  if (shore_uOn > 0.0 && h.id == ID_SEA && uCamH < 400.0) {
    ShoreK k;
    // (and give its grains the dusk sky's faint cool fill: charcoal, not a hole)
    if (shore_k(r, world_seaAt(r, h.t), k))
      col = max(col - vec3(0.055, 0.0095, 0.0016) * (look_uLavaGain / 3.0) * (0.85 * k.land * shore_uOn * (1.0 - smoothstep(250.0, 400.0, uCamH))), vec3(0.0)) + vec3(0.0042, 0.0043, 0.0058) * (k.land * shore_uOn);
  }
  if (shore_uGlare.x + shore_uGlare.y <= 0.0) return;
  float ang = acos(clamp(dot(r.rd, uSunDir), -1.0, 1.0));
  // the sun's glare in the lens when it stands over the limb: a white heart that rolls off into a wide warm skirt, in
  // front of everything, in the sun's own colour after the air
  if (shore_uGlare.x > 0.0) {
    float a = ang / max(uSunRad, 1e-4), a2 = a * a;
    vec3 T = look_Tray(uCamPos / look_uK, uSunDir);
    vec3 g = vec3(6.0 * exp(-0.5 * a2)) + vec3(1.0, 0.86, 0.66) / (1.0 + 0.5 * a2) + vec3(1.0, 0.62, 0.34) * (0.032 / (1.0 + 0.012 * a2));
    col += look_uSunE * T * g * shore_uGlare.x;
  }
  // the limb igniting where the sun comes up behind it: sunlight scattered forward through the air's long grazing
  // column. By the height the ray passes over the sea: ember lowest (the longest, reddest path), gold, white, then the
  // blue of the thin upper air; hottest toward the sun, a long thin line either side. Analytic in that height, so the
  // line is smooth at any render scale; it carries on a pixel or two inside the limb (the same air in front of the sea)
  if (shore_uGlare.y > 0.0) {
    float b = dot(r.ro, r.rd);
    // closest approach above the sea (units), < 0: a hit; a ray heading up and away is closest where it starts
    float ht = b > 0.0 ? uCamH : sqrt(max(dot(r.ro, r.ro) - b * b, 0.0)) - uR;
    float px = r.pa * sqrt(uCamH * (2.0 * uR + uCamH)) / look_uK;  // one pixel at the limb, in air km
    float xk = ht / look_uK;
    float inside = xk < 0.0 ? exp(xk / max(1.5, 1.5 * px)) : 1.0;
    xk = max(xk, 0.0);
    // along the limb the line is measured by azimuth from the sun (so it stays lit under a sun that has climbed); the
    // white heart only where the sun itself is
    vec3 sh = uSunDir - uCamUp * dot(uSunDir, uCamUp), rh = r.rd - uCamUp * dot(r.rd, uCamUp);
    float da = acos(clamp(dot(sh, rh) * inversesqrt(max(dot(sh, sh) * dot(rh, rh), 1e-12)), -1.0, 1.0));
    float pn = 1.0 / (1.0 + ang * ang / 0.0009), pw = 1.0 / (1.0 + da * da / 0.0256), pv = 1.0 / (1.0 + da * da / 0.25);
    float wr = max(2.5, 1.2 * px), wg = max(4.5, 1.5 * px);
    vec3 L = vec3(1.0, 0.16, 0.02) * exp(-xk / wr) * (0.9 * pw + 0.22 * pv);
    L += vec3(1.0, 0.55, 0.16) * exp(-(xk - 5.0) * (xk - 5.0) / (wg * wg)) * (1.5 * pw + 0.1 * pv);
    L += vec3(1.0, 0.92, 0.8) * exp(-(xk - 11.0) * (xk - 11.0) / 49.0) * (5.0 * pn * shore_uGlare.z + 1.3 * pw * shore_uGlare.w);
    L += vec3(0.3, 0.5, 1.0) * exp(-(xk - 24.0) * (xk - 24.0) / 169.0) * (0.55 * pw + 0.1 * pv) * shore_uGlare.z;
    col += look_uSunE * L * (shore_uGlare.y * inside);
  }
}
`;

const D2R = Math.PI / 180;
const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** A smooth curve through (xs[i], ys[i]) (cubic Hermite, finite-difference tangents). */
function curve(xs: number[], ys: number[], x: number): number {
  const n = xs.length;
  let i = 0;
  while (i < n - 2 && x > xs[i + 1]) i++;
  const m = (j: number) => (j === 0 ? (ys[1] - ys[0]) / (xs[1] - xs[0]) : j === n - 1 ? (ys[n - 1] - ys[n - 2]) / (xs[n - 1] - xs[n - 2]) : (ys[j + 1] - ys[j - 1]) / (xs[j + 1] - xs[j - 1]));
  const hh = xs[i + 1] - xs[i];
  const t = Math.min(1, Math.max(0, (x - xs[i]) / hh));
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * hh * m(i) + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * hh * m(i + 1);
}

/** Camera keys for the footer places (they replace the lead's keys for `shore` and `dawn`). */
export function shoreKeys(R: number): Key[] {
  const LAP = 2 * Math.PI * R;
  const deg = (a: number) => a * D2R * R;
  const dip = (h: number) => Math.acos(R / (R + h)) / D2R;
  // tan(fov / 2) as the camera resolves it: desktop keeps the key's vertical fov; a 390 x 844 phone keeps its width
  // (camera.ts: aspect < 0.6)
  const tanD = (fov: number) => Math.tan(0.5 * fov * D2R);
  const tanP = (fov: number) => (Math.tan(0.5 * fov * D2R) * 0.6) / (390 / 844);
  /** The pitch that puts the limb (the sea's horizon) at fraction y of the frame's height (0 top .. 1 bottom). */
  const limb = (h: number, y: number, tanHalf: number) => -dip(h) + Math.atan((2 * y - 1) * tanHalf) / D2R;
  /** The far sun `el` degrees above the limb, `az` degrees to the right of the heading `yaw`, for a camera at s, h. */
  const sun = (s: number, h: number, yaw: number, az: number, el: number): Channels => {
    const cam = cameraFrom(R, { s, h, yaw: yaw + az, pitch: 0, fov: 50 }, 1, 1);
    const e = (el - dip(h)) * D2R;
    const p = [0, 1, 2].map((i) => cam.pos[i] + (cam.f[i] * Math.cos(e) + cam.up[i] * Math.sin(e)) * 1e6) as [number, number, number];
    const [u, v, y] = surfOf(R, p);
    return { sunU: u, sunV: v, sunY: y, sunR: 1.2e4 };
  };
  // one camera position per key: s, h, yaw, then where the limb sits (desktop, phone), the sun (az, el over the limb)
  const key = (
    at: [string, number],
    s: number,
    h: number,
    yaw: number,
    yD: number,
    yP: number,
    az: number,
    el: number,
    rest: Record<string, number | string> = {},
    fovP = 60,
    elP = el, // the sun's height over the limb on phones, when it differs
  ): Key => ({
    at,
    s,
    h,
    yaw,
    pitch: limb(h, yD, tanD(46)),
    fov: 46,
    ...sun(s, h, yaw, az, el),
    ...rest,
    ph: { fov: fovP, pitch: limb(h, yP, tanP(fovP)), ...(elP === el ? {} : sun(s, h, yaw, az, elP)) },
  });
  // in orbit the sun is the sky's own disc (look), not the mark: it rises through the air, with its glare in the lens,
  // the limb igniting round it and its glitter path on the sea. On the way down the mark comes back round it.
  const ORBIT = { 'mark.vis': 0, 'look.sunDisc': 0.3, 'shore.glare': 1, 'shore.ignite': 1, 'shore.path': 1, roll: 0 };
  const HOME = { 'mark.vis': 1, 'look.sunDisc': 0, 'shore.glare': 0, 'shore.ignite': 0, 'shore.path': 0, 'lava.heat': 0, roll: 0 };

  // dawn's run home, 0 .. RUN of the place: one smooth path, sampled into keys close enough together that the sun
  // (which slerps between world directions) stays where each key puts it. tau runs 0..1 along the path, easing out of
  // the shore's still and into the beach's.
  const RUN = 0.7;
  const T = [0, 0.3, 0.55, 0.75, 0.9, 1];
  const P = {
    s: [186, 232, 275, 312, 338, ((LAP - 940) / LAP) * 360], // degrees round the planet
    h: [3200, 3000, 2400, 1300, 200, 16].map(Math.log),
    yaw: [0, 28, 68, 108, 146, 167],
    yD: [0.78, 0.78, 0.76, 0.72, 0.69, 0.68], // the limb's place in the frame, desktop
    yP: [0.57, 0.56, 0.56, 0.6, 0.62, 0.56], // and on phones
    az: [-12, -3, 6, 9, 12, 13], // the sun, degrees right of the heading (at the cape: straight back down the travel line)
    el: [8, 8, 7.5, 5.5, 2.8, 4], // and over the limb (desktop: the giant wordmark fills the sky down to mid-frame)
    elP: [13, 13.5, 11, 6, 2.8, 4], // (phones: the wordmark is small, the sun can stand higher over the limb)
    roll: [0, -9, -11, -7, -2, 0], // banking into the turn
  };
  const run: Key[] = [];
  const N = 19;
  for (let i = 0; i <= N; i++) {
    const f = (RUN * i) / N;
    const tau = sstep(0, 1, i / N);
    const c = (k: keyof typeof P) => curve(T, P[k], tau);
    const low = sstep(0.6, 0.86, tau); // the mark takes the sun back from the sky's disc while the camera is still high
    run.push(
      key(
        ['dawn', f],
        deg(c('s')),
        Math.exp(c('h')),
        c('yaw'),
        c('yD'),
        c('yP'),
        c('az'),
        c('el'),
        {
          'mark.vis': low,
          'look.sunDisc': 0.3 * (1 - low),
          'shore.glare': 1 - sstep(0.6, 0.95, tau),
          'shore.ignite': 1 - sstep(0.7, 0.92, tau),
          'shore.path': 1 - sstep(0.7, 0.9, tau),
          'lava.heat': 0.05 * (1 - sstep(0.8, 1, tau)),
          roll: c('roll'),
          ...(i ? { ease: 'linear' } : {}),
        },
        60 + 2 * sstep(0.75, 1, tau),
        c('elP'),
      ),
    );
  }
  return [
    // shore (the footer): first light. A slow climb; the sun comes up over the limb ahead, a little right of centre,
    // under the footer's last line
    key(['shore', 0], deg(157.5), 900, -4, 0.8, 0.8, 5, -3.6, ORBIT),
    key(['shore', 0.5], deg(159), 1150, -2, 0.8, 0.8, 5, -0.5, { ...ORBIT, ease: 'linear' }),
    key(['shore', 1], deg(160.5), 1500, 0, 0.79, 0.79, 5, 2.3, { ...ORBIT, ease: 'out' }),
    // dawn (the wordmark): the day side, high and fast, flying with the sun, then the turn and the descent past the cape
    ...run,
    // beside the black sand, looking back along its waterline to the setting sun: a slow pull back, panning to the sun
    key(['dawn', 1], LAP - 895, 13, 170, 0.68, 0.56, 10, 4, HOME, 62),
  ];
}

export const shore: WorldModule & { keys: (R: number) => Key[] } = {
  id: 'shore',
  glsl: GLSL,
  hooks: ['sea', 'over'],
  channels: { 'shore.glare': 0, 'shore.ignite': 0, 'shore.path': 0 },
  keys: shoreKeys,
  update(f, u) {
    // on from the descent until the seam (the coast is beyond the horizon on the day side when it comes on, and under
    // the hero's horizon at the seam: neither switch can be seen)
    const on = f.place.name === 'loop' ? 1 : f.places.dawn ? sstep(0.3, 0.4, f.at('dawn')) : 0;
    u.set('shore_uOn', on);
    u.set('shore_uT', f.still ? 2.2 : f.t);
    const g = f.ch['shore.glare'] ?? 0;
    const ig = f.ch['shore.ignite'] ?? 0;
    if (g > 0 || ig > 0) {
      // the sun's elevation over the limb (rad)
      const d = f.sun.dir, up = f.cam.up;
      const el = Math.asin(Math.max(-1, Math.min(1, d[0] * up[0] + d[1] * up[1] + d[2] * up[2]))) + Math.acos(f.R / (f.R + f.cam.h));
      // the line lights up from 5 deg under the limb, is hottest as the sun breaks over it, then settles
      const s = sstep(-5 * D2R, 0.3 * D2R, el) * (1 - 0.35 * sstep(1 * D2R, 9 * D2R, el));
      u.set('shore_uGlare', [g * sstep(-f.sun.rad, f.sun.rad * 1.5, el), ig * s * sstep(150, 450, f.cam.h), sstep(-2 * D2R, 0.5 * D2R, el), sstep(1 * D2R, 7 * D2R, el)]);
    } else u.set('shore_uGlare', [0, 0, 0, 0]);
    // the glitter path belongs to the orbit view (low over the sea the lava has its own glint)
    u.set('shore_uPath', (f.ch['shore.path'] ?? 0) * sstep(300, 1200, f.cam.h));
  },
};
