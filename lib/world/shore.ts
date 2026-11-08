// The shore (owner: story): the end of the journey. A black-sand beach with molten surf breaking on it, under the giant
// wordmark (components/world/Footer.tsx, place `dawn`). Jacob's one footer "like": "waves breaking on a shoreline,
// except glowing" (the old footer furnace, lib/gl/furnaceGL.ts).
//
// Where: across the travel direction, 1200 units before the hero (v = SHORE_V), land on the far side (v < shoreline).
// The hero camera stands at v = 0, 1.6 up, looking toward -v: the beach is below its horizon (curvature hides anything
// lower than ~90 units at 1200), so the hero is untouched. At the end of `dawn` the camera hangs over the sea just off
// the beach, facing the land with the setting sun off to one side; the loop's own keys (world) then pull it back over
// open sea into the hero, and the beach sinks below the horizon behind the move.
//
// What it draws (all smooth, glossy molten metal; no crust, no foam specks):
// - the sea hook: breaking crests running in to the shoreline (a long back slope, a steep front), shoaling as they come
//   in, with a white-hot rolling lip only where they break; same lava material (heat + emit into SeaMod);
// - the hit/shade hooks: the sand (a gentle beach rising to low dunes), black with a fine sheen, warm light from the
//   surf on it; the swash: a thin molten sheet that runs up the sand fast and drains slowly, its leading lip bright;
//   the sand it leaves glows and cools to black; wet sand mirrors the sky.
// The wave clock is one shared phase, so crests arrive exactly when each swash starts.

import type { WorldModule } from './modules';
import type { Key } from './journey';

/** Shoreline position along the travel direction (surface units, relative to the hero at v = 0). */
export const SHORE_V = -1200;

const GLSL = /* glsl */ `
// the lava's glow (look's Planck radiance x the lava gain), as lava.glsl lights its sea
vec3 shore_planck(float T){ return look_planck(T) * look_uLavaGain; }
uniform float shore_uOn;   // 0 far away (all work skipped), 1 near the beach
uniform float shore_uT;    // the surf's clock (s)
const float SHORE_V = ${SHORE_V.toFixed(1)};
const float SHORE_PER = 6.2;   // seconds per wave
const float SHORE_C = 7.5;     // crest speed toward the shore (units/s)

// the shoreline (v of the waterline) along u, and its slope dv/du
float shore_line(float u){ return SHORE_V + 16.0 * sin(u * 0.011) + 5.0 * sin(u * 0.037 + 1.0); }
float shore_lineD(float u){ return 16.0 * 0.011 * cos(u * 0.011) + 5.0 * 0.037 * cos(u * 0.037 + 1.0); }
// surface coords of a world point
vec3 shore_uvy(vec3 P){
  float r = length(P);
  return vec3(uR * asin(clamp(-P.x / r, -1.0, 1.0)), uR * atan(P.z, P.y), r - uR);
}
// inland distance x (>0 on land), from the waterline
float shore_x(vec2 w){ return shore_line(w.x) - w.y; }
// sand height above the sea at inland distance x: a gentle beach, then low dunes
float shore_sand(vec2 w, float x){
  float beach = x * 0.055 - 0.25;
  float dune = smoothstep(45.0, 150.0, x) * (5.0 + 3.0 * sin(w.x * 0.021 + x * 0.013) + 2.0 * sin(w.x * 0.047 - x * 0.031));
  return beach + dune;
}
// the wave phase along the shore (each stretch of beach a little out of step), 0..1
float shore_phase(float u){
  return fract(shore_uT / SHORE_PER + 0.11 * sin(u * 0.019) + 0.06 * sin(u * 0.053 + 2.0));
}
// how far up the sand the swash reaches at phase ph: fast up, slow drain; and its run-up length
float shore_runL(float u){ return 15.0 + 4.0 * sin(u * 0.029 + 0.7); }
float shore_front(float ph, float L){
  return ph < 0.28 ? L * sin(ph / 0.28 * 1.5707963) : L * pow(1.0 - (ph - 0.28) / 0.72, 1.7);
}
// seconds since the sand at inland distance x was uncovered by the draining swash this cycle (-1: covered or untouched)
float shore_age(float ph, float x, float L){
  if (x <= 0.0 || x >= L) return -1.0;
  float phx = 0.28 + 0.72 * (1.0 - pow(x / L, 1.0 / 1.7));
  return ph > phx ? (ph - phx) * SHORE_PER : -1.0;
}

// ---- the sea: breaking crests running in ----
void shore_sea(Ray r, Sea s, inout SeaMod m){
  if (shore_uOn <= 0.0) return;
  float d = s.w.y - shore_line(s.w.x); // seaward distance from the waterline
  if (d < -2.0 || d > 420.0) return;
  float ph = shore_phase(s.w.x);
  float lam = SHORE_C * SHORE_PER;     // crest spacing
  float cph = fract(ph + max(d, 0.0) / lam);
  // the crest at cph = 0: seaward of it (cph small) the long back slope, shoreward (cph near 1) the steep face
  float back = exp(-cph * 5.0), face = exp(-(1.0 - cph) * 18.0);
  float shoal = smoothstep(140.0, 40.0, d) * (1.0 - 0.6 * smoothstep(8.0, 0.0, d));
  float A = 0.22 * shoal * shore_uOn;
  float hgt = A * (back + face) - A * 0.25;
  float dh = A * (-5.0 * back + 18.0 * face) / lam; // d(height)/d(d)
  // footprint: crests finer than a pixel fade to their mean (no shimmer at the horizon)
  float att = 1.0 - smoothstep(0.5, 2.0, s.fw / 1.5);
  m.g += vec3(hgt, -dh * shore_lineD(s.w.x), dh) * att;
  // the rolling lip where it breaks: the crest line, white-hot, a little wider than a pixel at most
  float dc = min(cph, 1.0 - cph) * lam;
  float sig = max(0.6, s.fw * 0.8);
  float lip = exp(-dc * dc / (2.0 * sig * sig)) * (0.6 / sig);
  float brk = smoothstep(45.0, 12.0, d) * smoothstep(-1.0, 3.0, d);
  // the surf zone reads like the old footer furnace: dark molten troughs between the incoming crests, the crests' faces
  // warm, the breaking lips white-hot; the zone fades into the open sea's own glow seaward
  float zone = smoothstep(420.0, 60.0, d);
  float ridge = back * 0.35 + face;                     // 0 in the trough .. 1 at the crest
  float glowD = 0.55 * lip * brk + 0.45 * ridge * shoal;
  // The surf glows in its own right, at absolute temperatures (whatever the open sea around it is doing): the zone a
  // dull molten red, the crests' faces orange, the breaking lips white-hot, the water's edge bright (the swash sheet).
  // (look_planck is a true Planck curve: a few hundred kelvin is the whole range from ember to white.)
  float F = 0.05;
  vec3 e = shore_planck(1100.0 + 40.0 * zone) * zone * 0.6
         + shore_planck(1260.0) * ridge * shoal * 0.8
         + shore_planck(1550.0 + 150.0 * brk) * lip * brk * 0.9
         + shore_planck(1300.0) * smoothstep(8.0, 0.0, d) * 0.8;
  m.emit += e * (1.0 - F) * shore_uOn;
  m.heat += 0.05 * zone * shore_uOn;
  m.rough += 0.0 * glowD;
}

// ---- the sand ----
void shore_hit(Ray r, inout Hit h){
  if (shore_uOn <= 0.0) return;
  // only rays from near the beach: march the height field from the camera out to the sea hit (or the dunes' reach)
  vec3 o = shore_uvy(r.ro);
  if (abs(shore_x(o.xy)) > 1500.0 || o.z > 600.0) return;
  float tMax = min(h.t, 2500.0);
  float t = 0.05;
  int N = uQ > 0.5 ? 96 : 56;
  float prev = 1e9, tp = 0.0;
  for (int i = 0; i < 96; i++){
    if (i >= N || t > tMax) break;
    vec3 P = r.ro + r.rd * t;
    vec3 q = shore_uvy(P);
    float x = shore_x(q.xy);
    if (x < -2.0 && q.z < 1.0) { // over the sea: skip ahead toward the shoreline
      float dv = -x;
      t += max(0.5, min(dv * 0.7, 40.0 + t * 0.02));
      prev = 1e9; continue;
    }
    if (abs(q.x) > 2000.0 || q.z > 60.0 && dot(r.rd, normalize(P)) > 0.0) break;
    float dy = q.z - shore_sand(q.xy, x);
    if (dy < 0.0) {
      // refine between the last two samples
      float a = tp, b = t;
      for (int k = 0; k < 6; k++){
        float c = 0.5 * (a + b);
        vec3 Q = shore_uvy(r.ro + r.rd * c);
        if (Q.z - shore_sand(Q.xy, shore_x(Q.xy)) < 0.0) b = c; else a = c;
      }
      t = b;
      vec3 Pq = r.ro + r.rd * t;
      vec3 Q = shore_uvy(Pq);
      float xq = shore_x(Q.xy);
      if (xq < -0.5) return; // under the sea: the sea's own hit stands
      h.t = t; h.id = SHORE_ID; h.p = Pq;
      // normal from the height field (central differences in surface units)
      float e = max(0.05, r.pa * t);
      float hx = shore_sand(Q.xy + vec2(e, 0.0), shore_x(Q.xy + vec2(e, 0.0))) - shore_sand(Q.xy - vec2(e, 0.0), shore_x(Q.xy - vec2(e, 0.0)));
      float hv = shore_sand(Q.xy + vec2(0.0, e), shore_x(Q.xy + vec2(0.0, e))) - shore_sand(Q.xy - vec2(0.0, e), shore_x(Q.xy - vec2(0.0, e)));
      vec3 up = normalize(Pq);
      vec3 eu = normalize(vec3(-cos(Q.x / uR), -sin(Q.x / uR) * cos(Q.y / uR), -sin(Q.x / uR) * sin(Q.y / uR)));
      vec3 ev = normalize(vec3(0.0, -sin(Q.y / uR), cos(Q.y / uR)));
      h.n = normalize(up - (hx / (2.0 * e)) * eu - (hv / (2.0 * e)) * ev);
      h.data = vec4(Q.xy, xq, Q.z);
      return;
    }
    tp = t;
    t += clamp(dy * 0.6, 0.04 + t * 0.002, 25.0);
  }
}

// the sand's look at a point (shared by shade and env); refl: what a wet mirror would see (vec3(0) in env)
vec3 shore_sandCol(Ray r, Hit h, out vec3 rdir, out float rw){
  rw = 0.0; rdir = vec3(0.0, 1.0, 0.0);
  vec2 w = h.data.xy; float x = h.data.z;
  vec3 n = h.n, v = -r.rd;
  float NoV = max(dot(n, v), 1e-3);
  float ph = shore_phase(w.x), L = shore_runL(w.x);
  float xf = shore_front(ph, L);
  vec3 col = vec3(0.0);
  // the sun on black sand: dark, slightly glossy grains (a broad sheen, no sparkle noise)
  vec3 Ls = uSunDir;
  float NoL = max(dot(n, Ls), 0.0);
  vec3 sunE = look_sunLight(h.p);                        // irradiance from the disc (look)
  col += sunE * NoL * 0.035 / PI;
  vec3 hh = normalize(Ls + v);
  col += sunE * 0.02 * pow(max(dot(n, hh), 0.0), 40.0) * NoL;
  // the surf's warm light on the sand near it, falling off inland
  col += shore_planck(1250.0) * 0.04 * exp(-max(x, 0.0) / 9.0);
  // the sky's cool fill from above
  col += vec3(0.004, 0.005, 0.008) * max(n.y * 0.0 + dot(n, normalize(h.p)), 0.0);
  if (x < xf) {
    // under the swash: a thin molten sheet running up (or draining), its leading lip brightest
    float lipd = xf - x;
    float lip = exp(-lipd * lipd / (2.0 * 0.8 * 0.8));
    float up = ph < 0.28 ? 1.0 : 0.55;           // brighter while it surges up
    float T = 1130.0 + 300.0 * lip * up + 60.0 * smoothstep(L, 0.0, x);
    float F = 0.04 + 0.96 * pow(1.0 - NoV, 5.0);
    col = shore_planck(T) * (1.0 - F) * (0.55 + 0.45 * smoothstep(0.0, 0.6, lipd + lip));
    rdir = reflect(r.rd, normalize(h.p)); rw = F * 0.8;
    return col;
  }
  // the wet sand the drain just left: it glows and cools to black, mirroring the sky while wet
  float age = shore_age(ph, x, L);
  float wet = smoothstep(L + 2.0, 0.0, x);
  if (age >= 0.0) col += shore_planck(1120.0 - 120.0 * min(age, 3.0)) * 0.7 * exp(-age / 1.3);
  if (wet > 0.0) { rdir = reflect(r.rd, n); rw = (0.02 + 0.98 * pow(1.0 - NoV, 5.0)) * wet * 0.7; }
  return col;
}
vec3 shore_shade(Ray r, Hit h){
  vec3 rdir; float rw;
  vec3 col = shore_sandCol(r, h, rdir, rw);
  if (rw > 0.0) {
    float up = dot(rdir, normalize(h.p));
    if (up < 0.002) rdir = normalize(rdir + normalize(h.p) * (0.002 - up));
    Ray rr; rr.ro = h.p + normalize(h.p) * 0.03; rr.rd = rdir; rr.pa = r.pa + 0.06; rr.depth = 1;
    col += world_env(rr) * rw;
  }
  return col;
}
vec3 shore_env(Ray r, Hit h){ vec3 rdir; float rw; return shore_sandCol(r, h, rdir, rw); }
`;

/** Camera keys for the footer places (they replace the lead's keys for `shore` and `dawn`). */
export function shoreKeys(R: number): Key[] {
  const LAP = 2 * Math.PI * R;
  const deg = (a: number) => (a * Math.PI * R) / 180;
  const FAR = { sunU: 0, sunV: -deg(80), sunY: 1e6, sunR: 1.2e4 };
  const FAR2 = { ...FAR, sunV: deg(280) };
  const beach = LAP + SHORE_V; // the waterline, one lap on (the run home)
  return [
    // shore: the sunrise over the limb, made by the climb (world's keys, kept)
    { at: ['shore', 0], s: deg(158), h: 700, yaw: 0, pitch: -24, fov: 46, ...FAR, ph: { fov: 60, pitch: -22 } },
    { at: ['shore', 1], s: deg(160.5), h: 1300, yaw: 0, pitch: -27, fov: 46, ...FAR, ph: { fov: 60, pitch: -25 } },
    // dawn: high over the day side, then down out of the sky over the sea to the beach, turning to face it
    { at: ['dawn', 0], s: deg(235), h: 4600, yaw: 25, pitch: -38, fov: 46, ...FAR2, ph: { fov: 60 } },
    { at: ['dawn', 0.4], s: beach + 900, h: 160, yaw: 150, pitch: -10, fov: 46, ...FAR2, ph: { fov: 60, pitch: -11 } },
    // off the beach over the surf, facing the land with the setting sun off to the right: the sky and the dark dunes
    // carry the wordmark, the surf breaks across the lower half
    { at: ['dawn', 0.72], s: beach + 75, h: 22, yaw: 140, pitch: -8, fov: 46, ...FAR2, ph: { fov: 62, pitch: -9 } },
    { at: ['dawn', 1], s: beach + 92, h: 24, yaw: 146, pitch: -7.5, fov: 46, ...FAR2, ph: { fov: 62, pitch: -8.5 } },
  ];
}

export const shore: WorldModule & { keys: (R: number) => Key[] } = {
  id: 'shore',
  glsl: GLSL,
  hooks: ['sea', 'hit', 'shade', 'env'],
  keys: shoreKeys,
  update(f, u) {
    // on only from the descent to the beach until the seam (at the seam the beach is below the hero's horizon, so turning
    // it off there is invisible); the march is skipped everywhere else
    const name = f.place.name;
    const on = (name === 'dawn' && f.at('dawn') > 0.25) || name === 'loop' ? 1 : 0;
    u.set('shore_uOn', on);
    u.set('shore_uT', f.still ? 2.2 : f.t);
  },
};
