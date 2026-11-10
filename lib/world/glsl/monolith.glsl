// monolith.glsl: the three venture monoliths (role: ventures). Cast metal, 150 m tall, rising out of the lava.
//
// Filmed, not rendered: each is a few hundred metres off across the sea, seen low through a long lens, so what makes
// the picture is light and air, not geometry. Physically based, linear HDR radiance out (look's tone curve does the rest):
// - conductor Fresnel: Schlick with the Hoffman/Kutz F82 edge tint, measured F0 (iron 0.56/0.57/0.58; the live monolith
//   is a warm nickel-silver, the colour bone is in metal), GGX with height-correlated Smith, split-sum environment term
//   (Karis' analytic DFG fit), no diffuse at all (metals have none);
// - the environment the faces mirror is the place itself: look's sky (star-dark zenith, the air's low glow) along the
//   mirror direction, a band of lava-lit air on the horizon (brighter ahead, where the sun is under the limb: the
//   edges turned to it carry a thin bright line), and below the horizon the glowing sea with the pool at the foot.
//   Blurred analytically over the lobe, so nothing is noisy;
// - light from below: the molten pool at the foot is an emissive plane under a vertical wall; its light climbs the
//   faces and falls off with height by its form factor;
// - heat is blackbody: chromaticity from Planck's law at three wavelengths, brightness compressed for the eye, emitted
//   through Kirchhoff (emissivity = 1 - reflectance), hottest at the waterline and falling off up the shaft through
//   white-yellow, orange, cherry and dull red to bare cool steel. Emission only where the metal is hot;
// - one cold light (look's moon, behind the camera's shoulder): a broad soft sheen, stretched ACROSS the face (the
//   billet's grain runs up it), and a cold line on the arris turned to it;
// - the micro-surface is scale-aware: a slow waviness (the reflected horizon bends gently), polish that varies only over
//   tens of metres, both faded by pixel footprint; edges are real fillets on a drafted casting, never outlines;
// - rising, the sea domes up over the casting, the top comes through it and the melt sheets off down the faces: a
//   coating that only changes temperature and gloss (no tubes, no blobs), a function of the rise, so it runs backwards;
// - the air between: the lowest part of each casting dissolves a little into the glow behind it (more for the far ones).
// No crust, no flakes, no pits, no blotches, no outlines: every term above is smooth by construction.
//
// Module `ventures` (lib/world/ventures.ts), hooks hit / shade / sea / crisp (lib/world/ARCHITECTURE.md). The crisp pass
// draws the castings at the canvas's resolution; their reflections are soft and belong to the sea (ventures_sea, scene
// pass): each a long column, sharp at the waterline and smeared toward the camera by the swell's slope.

#define VENTURES_N 3
uniform vec4 ventures_uP[VENTURES_N];  // xyz: the foot's centre on the sea surface (world); w: visible 0/1
uniform mat3 ventures_uM[VENTURES_N];  // local -> world (columns: X across the face, Y up the shaft, Z out of the face)
uniform vec4 ventures_uK[VENTURES_N];  // x: lift (local y of the sea surface is -lift; 0 = the foot sits at the sea surface),
                                       // y: heat 0..1 (hover/focus), z: kind (0 = cooled live, 1 = still forging), w: press 0..1
uniform vec4 ventures_uE[VENTURES_N];  // xyz: half extents at the foot (half width, half height, half depth); w: arris radius
uniform vec4 ventures_uD[VENTURES_N];  // x: height of the sea's bulge over it (world units), y: rise 0..1, z: finish (roughness)
uniform vec3 ventures_uZen;        // sky radiance at the zenith
uniform vec3 ventures_uHorW;       // the lava-lit air on the horizon, toward the sun under the limb
uniform vec3 ventures_uHorC;       // ...and away from it
uniform vec3 ventures_uSea;        // the far sea's radiance (as seen at grazing, already including its own reflection)
uniform float ventures_uGain;      // emission scale to the world's radiance unit (look's exposure)
uniform float ventures_uOn;        // any monolith is up (skips every ray's trace otherwise)
uniform vec3 ventures_uPool;       // the molten pool at a foot (radiance at the waterline)

const float VENTURES_TAPER = 0.03;    // draft: the casting narrows 3% toward its top, as a real one does to leave the mould
const float VENTURES_PI = 3.14159265;
const float VENTURES_SINK = 0.3;      // the shaft continues this fraction of its height below the foot
const float VENTURES_MARK = 0.74;     // the mark's diameter as a fraction of the face's width

struct VenturesHit { int id; float t; vec3 lp; vec3 wp; };

float ventures_sat(float x) { return clamp(x, 0.0, 1.0); }
vec2 ventures_hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453) * 2.0 - 1.0;
}
// gradient noise with its analytic derivative (value, d/dx, d/dy): smooth, no grid artefacts at the amplitudes used
vec3 ventures_noised(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  vec2 ga = ventures_hash2(i), gb = ventures_hash2(i + vec2(1, 0)), gc = ventures_hash2(i + vec2(0, 1)), gd = ventures_hash2(i + vec2(1, 1));
  float va = dot(ga, f), vb = dot(gb, f - vec2(1, 0)), vc = dot(gc, f - vec2(0, 1)), vd = dot(gd, f - vec2(1, 1));
  float v = va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * (va - vb - vc + vd);
  vec2 d = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd)
         + du * (vec2(vb - va, vc - va) + u.yx * (va - vb - vc + vd));
  return vec3(v, d);
}

/* ---------- geometry: a drafted casting with fillets, and the sea's bulge over it while it rises ---------- */
// p local: origin at the foot's centre, y up the shaft. A rounded box whose x/z half extents shrink with y.
float ventures_box(vec3 p, vec4 E4) {
  vec3 E = E4.xyz; float r = E4.w;
  float tap = 1.0 - VENTURES_TAPER * ventures_sat(p.y / (2.0 * E.y));
  // the shaft runs on below the foot (VENTURES_SINK of its height), so a lift never shows its underside
  float hy = E.y * (1.0 + VENTURES_SINK), cy = E.y * (1.0 - VENTURES_SINK);
  vec3 b = vec3(E.x * tap, hy, E.z * tap);
  vec3 q = abs(vec3(p.x, p.y - cy, p.z)) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}
// the bulge: a low dome of melt on the waterline (an ellipsoid; iq's distance bound), hb its height
float ventures_dome(vec3 p, vec4 E4, float lift, float hb) {
  vec3 r = vec3(E4.x * 1.9, hb, E4.z * 2.0 + E4.x * 0.55);
  vec3 q = vec3(p.x, p.y + lift, p.z);
  float k0 = length(q / r), k1 = length(q / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 1e-6);
}
// (the casting, the bulge): joined smoothly where the melt clings to the shaft
vec2 ventures_sdf2(vec3 p, int i) {
  float b = ventures_box(p, ventures_uE[i]);
  float hb = ventures_uD[i].x;
  if (hb <= 0.01) return vec2(b, 1e6);
  return vec2(b, ventures_dome(p, ventures_uE[i], ventures_uK[i].x, hb));
}
float ventures_sdf(vec3 p, int i) {
  vec2 d = ventures_sdf2(p, i);
  if (d.y > 1e5) return d.x;
  float k = ventures_uE[i].x * 0.7;
  float h = max(k - abs(d.x - d.y), 0.0) / k;
  return min(d.x, d.y) - h * h * k * 0.25;
}
vec3 ventures_normalL(vec3 p, int i, float h) {
  const vec2 k = vec2(1, -1);
  return normalize(k.xyy * ventures_sdf(p + k.xyy * h, i) + k.yyx * ventures_sdf(p + k.yyx * h, i) +
                   k.yxy * ventures_sdf(p + k.yxy * h, i) + k.xxx * ventures_sdf(p + k.xxx * h, i));
}

vec3 ventures_origin(int i) { return ventures_uP[i].xyz + ventures_uM[i][1] * ventures_uK[i].x; }

// slab test against the bound (local), returns (tNear, tFar); the bound grows to hold the bulge while there is one
vec2 ventures_bound(vec3 o, vec3 d, int i) {
  vec3 E = ventures_uE[i].xyz;
  float hb = ventures_uD[i].x;
  float on = step(0.01, hb);
  float top = max(2.0 * E.y, on * (hb - ventures_uK[i].x) + 0.5);
  vec3 lo = vec3(-E.x * (1.0 + on), -2.0 * VENTURES_SINK * E.y, -E.z * (1.0 + on * 1.1) - on * E.x * 0.6) - 0.002;
  vec3 hi = vec3(-lo.x, top, -lo.z) + 0.002;
  vec3 m = 1.0 / d;
  vec3 t1 = (lo - o) * m, t2 = (hi - o) * m;
  vec3 tn = min(t1, t2), tf = max(t1, t2);
  return vec2(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z));
}

bool ventures_trace(vec3 ro, vec3 rd, float tMax, float pa, int steps, out VenturesHit h) {
  h.id = -1; h.t = tMax; h.lp = vec3(0.0); h.wp = vec3(0.0);
  for (int i = 0; i < VENTURES_N; i++) {
    if (ventures_uP[i].w < 0.5) continue;
    mat3 M = ventures_uM[i];
    vec3 o = (ro - ventures_origin(i)) * M, d = rd * M;   // world -> local (M is orthonormal)
    vec2 tb = ventures_bound(o, d, i);
    if (tb.x > tb.y || tb.y < 0.0 || tb.x > h.t) continue;
    // the bound is the casting's box: start on it and only refine for the fillets and the draft (a few steps)
    float t = max(tb.x, 0.0), tEnd = min(tb.y, h.t);
    for (int s = 0; s < 24; s++) {
      if (s >= steps) break;
      float dist = ventures_sdf(o + d * t, i);
      float eps = max(ventures_uE[i].x * 2e-4, t * pa * 0.4);
      if (dist < eps) { h.id = i; h.t = t; h.lp = o + d * t; h.wp = ro + rd * t; break; }
      t += max(dist, eps * 0.5);
      if (t > tEnd) break;
    }
  }
  return h.id >= 0;
}

/* ---------- the mark (Jacob's Split Ring, lib/splitRing.ts, 48-unit grid) ---------- */
// p in grid units, centred on the core, y up (the mark is mirror-symmetric about the horizontal axis, so y up or down
// is the same). Returns (distance to the ring+squares, distance to the core), negative inside.
vec2 ventures_markD(vec2 q) {
  float d = 1e3;
  for (int i = 0; i < 2; i++) {
    float r = i == 0 ? 20.0 : 12.0;
    d = min(d, max(abs(length(q) - r) - 1.3, q.x)); // the left half: an exact half circle, flat ends on the centre line
  }
  for (int ri = 0; ri < 2; ri++) {
    float r = ri == 0 ? 20.0 : 12.0; float n = ri == 0 ? 7.0 : 4.0;
    for (int k = 1; k <= 7; k++) {
      if (float(k) > n) break;
      float a = -VENTURES_PI * 0.5 + float(k) * VENTURES_PI / (n + 1.0);
      vec2 e = abs(q - r * vec2(cos(a), sin(a))) - 1.6; // upright squares, centred on the circle
      d = min(d, length(max(e, 0.0)) + min(max(e.x, e.y), 0.0));
    }
  }
  return vec2(d, length(q) - 3.6);
}

// The brand mark (lib/splitRing.ts brandMarkSvg: one ring r 15, stroke 5, four squares 5.6 at 36 deg steps after one
// empty step, the core 4.8, on a 48 box), scaled so its outer edge matches the family mark's (35 -> 42.6 units).
vec2 ventures_brandD(vec2 q) {
  const float S = 42.6 / 35.0;
  vec2 b = q / S;
  float d = max(abs(length(b) - 15.0) - 2.5, b.x);
  for (int k = 1; k <= 4; k++) {
    float a = -VENTURES_PI * 0.5 + float(k) * VENTURES_PI / 5.0;
    vec2 e = abs(b - 15.0 * vec2(cos(a), sin(a))) - 2.8;
    d = min(d, length(max(e, 0.0)) + min(max(e.x, e.y), 0.0));
  }
  return vec2(d, length(b) - 4.8) * S;
}
vec2 ventures_markMix(vec2 q, float kb) {
  if (kb <= 0.0) return ventures_markD(q);
  if (kb >= 1.0) return ventures_brandD(q);
  return mix(ventures_markD(q), ventures_brandD(q), kb);
}

/* ---------- light ---------- */
// Planck at three wavelengths (R 610, G 550, B 465 nm) for the chromaticity; the brightness is compressed (T^6
// instead of the eye's ~T^20 near 1000 K) so the fade from the waterline up reads over a long stretch, not a step.
vec3 ventures_bB(float T) {
  if (T < 600.0) return vec3(0.0);
  const vec3 lam = vec3(0.610, 0.550, 0.465);
  vec3 l5 = lam * lam * lam * lam * lam;
  vec3 b = 1.0 / (l5 * (exp(14388.0 / (lam * T)) - 1.0));
  b /= max(b.r, 1e-30);                                  // chromaticity, red = 1
  float x = T / 1811.0;                                  // iron's melting point = 1
  float lum = x * x * x * x * x * x * smoothstep(640.0, 860.0, T); // Draper point: invisible below ~800 K
  return b * lum;
}

// conductor Fresnel: Schlick with the F82 edge tint (Kutz et al. 2021, after Hoffman 2019); tint 1 = plain Schlick
vec3 ventures_fresnel(vec3 F0, vec3 tint, float c) {
  float m = 1.0 - c, m5 = m * m * m * m * m;
  vec3 fs = F0 + (1.0 - F0) * m5;
  const float cb = 1.0 / 7.0, mb = 1.0 - cb;
  float mb5 = mb * mb * mb * mb * mb, mb6 = mb5 * mb;
  vec3 fb = F0 + (1.0 - F0) * mb5;
  vec3 a = fb * (1.0 - tint) / (cb * mb6);
  return clamp(fs - a * c * m5 * m, 0.0, 1.0);
}
vec2 ventures_dFG(float rough, float NoV) { // Karis' analytic fit of the split-sum's environment BRDF
  const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022), c1 = vec4(1.0, 0.0425, 1.04, -0.04);
  vec4 r = rough * c0 + c1;
  float a004 = min(r.x * r.x, exp2(-9.28 * NoV)) * r.x + r.y;
  return vec2(-1.04, 1.04) * a004 + r.zw;
}

// Everything a ray leaving the metal at p (world) in direction d sees, blurred over half-width w (rad): look's sky and
// the lava-lit air above the horizon (which, from up the shaft of a 150 m casting on a small planet, lies well below
// eye level: the dip), the sea below it (hit on the sphere, so the pool glows where it lies).
vec3 ventures_envA(int i, vec3 p, vec3 d, float w, bool fullSky) {
  vec3 up = normalize(p);
  vec3 foot = ventures_uP[i].xyz;
  float hs = max(length(p) - uR, 0.0);
  float dip = sqrt(2.0 * hs / uR);
  float e = asin(clamp(dot(d, up), -1.0, 1.0)) + dip;   // elevation over the sea's horizon
  // fraction of the lobe below the horizon (a step blurred by the lobe)
  float below = smoothstep(w + 0.004, -w - 0.004, e);
  vec3 sky;
  vec3 dh = d - up * dot(d, up), sh = uSunDir - up * dot(uSunDir, up);
  // the dusk: the glow where the sun stands under the limb, ahead and to the right of the camera's line
  vec3 sn = normalize(sh + up * 1e-5);
  float ahead = max(dot(normalize(dh + up * 1e-5), sn * 0.82 + cross(sn, up) * 0.57), 0.0);
  ahead *= ahead; ahead *= ahead;
  // (the sky behind the camera, away from the sun under the limb, is the darker half: the broad faces mirror that)
  if (fullSky) { Ray sr; sr.ro = p; sr.rd = d; sr.pa = max(w, 0.002); sr.depth = 1; sky = look_sky(sr) * mix(0.3, 1.0, ahead); }
  else sky = ventures_uZen * smoothstep(-0.05, 0.3, e);
  // the low air over the horizon lit from below by the molten sea: a warm band, blurred by the lobe with its energy
  // kept; brighter and taller ahead of the camera, where the sun stands under the limb (the dusk the far edges catch)
  float bw = 0.05 + w;
  float band = exp(-max(e, 0.0) / bw) * (0.05 / bw) * smoothstep(-w - 0.01, w + 0.01, e);
  sky += mix(ventures_uHorC, ventures_uHorW, 0.5) * band * (1.0 + 0.6 * ahead)
       + vec3(1.0, 0.36, 0.1) * (2.6 * ahead) * exp(-max(e, 0.0) / (0.22 + w)) * smoothstep(-w - 0.01, w + 0.01, e);
  vec3 sea = ventures_uSea;
  if (below > 0.0) {
    float sd = max(-e, 0.0) + w * 0.5 + dip * 0.5;
    float dist = (hs + 0.5) / max(sd, 1e-3);
    vec3 hit = p + d * dist;
    // distance of the reflected sea point from the foot's outline (roughly), in half widths
    vec3 lc = (hit - foot) * ventures_uM[i];
    float rr = length(max(abs(lc.xz) - ventures_uE[i].xz, 0.0)) / ventures_uE[i].x;
    float pool = exp(-rr * 2.2) * (1.0 + ventures_uK[i].y * 0.8);
    // the sea's own grazing reflection of the horizon band: brighter toward the horizon
    float graze = exp(-max(-e, 0.0) * 9.0);
    sea = ventures_uSea * (0.35 + 0.65 * graze) + ventures_uPool * pool * (0.4 + 0.3 * ventures_uK[i].z);
  }
  return mix(sky, sea, below);
}

float ventures_vis(float NoV, float NoL, float a) {
  float a2 = a * a;
  float gv = NoL * sqrt(NoV * NoV * (1.0 - a2) + a2), gl = NoV * sqrt(NoL * NoL * (1.0 - a2) + a2);
  return 0.5 / max(gv + gl, 1e-5);
}

/* ---------- shading ---------- */
vec3 ventures_surface(VenturesHit h, vec3 rd, float pixAng) {
  int i = h.id;
  mat3 M = ventures_uM[i];
  vec4 E4 = ventures_uE[i];
  vec3 E = E4.xyz;
  vec3 lp = h.lp;
  float kind = ventures_uK[i].z, heat = ventures_uK[i].y, press = ventures_uK[i].w;
  float foot = 1.0 / E.x;                              // local units -> half widths
  float px = h.t * pixAng;                             // world size of a pixel here
  float lift = ventures_uK[i].x;
  float hs = lp.y + lift;                              // height above the sea surface
  float H = 2.0 * E.y;
  float seed = float(i) * 7.31;

  vec3 nl = ventures_normalL(lp, i, max(px * 0.6, E.x * 1e-3));
  // how much of this point is the sea's bulge (melt) rather than the casting
  vec2 d2 = ventures_sdf2(lp, i);
  float melt = d2.y > 1e5 ? 0.0 : smoothstep(-0.25, 0.25, (d2.x - d2.y) * foot);
  float tap = 1.0 - VENTURES_TAPER * ventures_sat(lp.y / H);
  float face = smoothstep(0.85, 0.99, abs(nl.z)) * (1.0 - melt);   // on the broad faces
  float onTop = step(H - E4.w * 3.0, lp.y);

  // --- the face's slow waviness and its polish, faded by footprint ---
  vec2 fuv = vec2(lp.x, lp.y) * foot;                  // face coordinates in half widths
  float wav = 1.0 - smoothstep(0.03, 0.12, px * foot); // only while a wave spans several pixels
  // one slow, mostly vertical undulation (no plate this size is optically flat: the reflected horizon bends a little);
  // one octave only: a finer one shows as mottling inside a highlight
  vec3 n1 = ventures_noised(fuv * vec2(0.55, 0.2) + seed);
  vec2 g = n1.yz * vec2(0.55, 0.2) * 0.022 * wav * face;
  // ...and it crowns a hair across its width
  g += vec2(fuv.x * 0.018, 0.0) * face;
  vec3 nlp = normalize(nl + vec3(g.x, g.y, 0.0) * sign(nl.z));

  // --- materials (measured F0, linear) ---
  // live: a warm nickel-silver (bone, in metal); forging: iron/steel. The polish drifts over tens of metres (where the
  // billet was dressed harder) and the arrises are a little brighter; never patchy.
  vec3 F0 = kind < 0.5 ? vec3(0.80, 0.76, 0.68) : vec3(0.56, 0.57, 0.58);
  vec3 tint = kind < 0.5 ? vec3(0.95, 0.93, 0.88) : vec3(0.92, 0.93, 0.95);
  float rough = ventures_uD[i].z;
  float edgeL = smoothstep(0.92, 0.6, max(abs(nl.x), max(abs(nl.y), abs(nl.z))));
  float n2 = ventures_noised(fuv * vec2(0.23, 0.11) + seed * 1.7 + 3.1).x;
  rough += (0.1 * n1.x + 0.13 * n2) * wav - 0.06 * edgeL;

  // --- the mark, cut into the live monolith's front face ---
  float markIn = 0.0, coreIn = 0.0, coreR = 1.0, cutLit = 0.0;
  vec3 nMark = vec3(0.0);
  if (kind < 0.5 && nl.z > 0.5 && melt < 0.5) {
    float ms = (E.x * tap * VENTURES_MARK) / 21.3;     // world units per grid unit
    vec2 mc = vec2(0.0, H * 0.69);
    vec2 q = (lp.xy - mc) / ms;
    if (dot(q, q) < 26.0 * 26.0) {
      float fw = max(px / ms, 0.02);                   // a pixel in grid units
      float wch = max(0.55, fw);                       // the chamfer of the cut
      // small on screen (a far or tiny view at a low pixel ratio) the mark becomes the brand mark (one ring, four
      // squares, the core), so the 7 + 4 squares never merge into a blob; over a short range of sizes, no pop
      float ringPx = 42.6 / fw;                        // the mark's diameter in render px
      float kb = smoothstep(62.0, 46.0, ringPx);
      vec2 d0 = ventures_markMix(q, kb);
      float e = max(0.12, fw * 0.5);                   // the gradient's step grows with the pixel: no aliased normals
      // (the gradient only where a wall is: four more evaluations of the mark, on its edges alone)
      vec2 gd = vec2(0.0);
      if (abs(d0.x) < wch + e || abs(d0.y + 0.6) < max(0.6, fw) + e) {
        float dx = ventures_markMix(q + vec2(e, 0.0), kb).x - ventures_markMix(q - vec2(e, 0.0), kb).x;
        float dy = ventures_markMix(q + vec2(0.0, e), kb).x - ventures_markMix(q - vec2(0.0, e), kb).x;
        gd = vec2(dx, dy) / (2.0 * e);
      }
      // the cut's chamfered wall tilts the normal toward the cut's centre: the walls under each bar and square face up
      // and out (they catch the moon and the sky), the walls over them face down (they catch the sea's glow). Once the
      // chamfer is under about a pixel its tilt fades (a sub-pixel wall would flip the shading from pixel to pixel) and
      // the cut reads by its darker, rougher floor and the lit rim below
      float tiltK = 1.0 - smoothstep(0.5, 1.4, fw);
      float wall = 1.0 - abs(clamp(d0.x / wch, -1.0, 1.0));
      wall = smoothstep(0.0, 1.0, wall);
      nMark = vec3(gd * wall * 1.0 * tiltK, 0.0);
      markIn = smoothstep(fw * 0.7, -fw * 0.7, d0.x);
      // the lower lip of every cut, lit from above and behind the camera: a thin bright edge (the light a cut catches)
      cutLit = wall * ventures_sat(-gd.y) * smoothstep(-wch, 0.0, d0.x);
      coreIn = smoothstep(fw * 0.7, -fw * 0.7, d0.y + 0.15);
      coreR = length(q) / 3.6;
      float coreWall = 1.0 - abs(clamp((d0.y + 0.6) / max(0.6, fw), -1.0, 1.0));
      nMark += vec3(normalize(q + 1e-4) * coreWall * 0.8 * tiltK, 0.0) * step(d0.y, 1.0);
    }
  }
  nlp = normalize(nlp + nMark);
  vec3 n = M * nlp;
  vec3 v = -rd;
  float NoV = max(dot(n, v), 1e-4);
  vec3 up = normalize(h.wp);

  // inside the cut: sand-cast, rougher and darker (its floor stands in the shadow of its own walls)
  rough = mix(rough, 0.6, markIn);
  F0 = mix(F0, F0 * 0.55, markIn);
  rough = clamp(rough + px * foot * 0.6, 0.07, 1.0);   // unresolved detail becomes roughness

  // --- heat: hottest at the waterline, up the shaft through orange, cherry and dull red to bare metal ---
  float Lh = H * (kind < 0.5 ? 0.06 * (1.0 + heat * 1.6 + press * 1.0) : 0.16 * (1.0 + heat * 0.7 + press * 0.5));
  float Tw = (kind < 0.5 ? 1150.0 : 1250.0) + heat * 120.0 + press * 120.0;
  float Tfloor = 560.0;                                // above the glow the metal is cool steel: nothing emits there
  float T = Tfloor + (Tw - Tfloor) * exp(-max(hs, 0.0) / Lh);
  // a slow breath of heat in the forging ones (smooth, large, never patchy)
  T += kind * 30.0 * sin(uTime * 0.5 + float(i) * 2.0 + lp.y * foot * 0.25);

  // --- the melt sheeting off it while it rises (scroll-reversible: a function of the rise and of the height above the
  // sea, not of time). A coating: thickest and hottest at the waterline, thinning and cooling up the shaft; it drains
  // in long soft curtains. It only shifts temperature and gloss, so it can never draw an edge.
  float rise = ventures_uD[i].y;
  float fresh = 1.0 - smoothstep(0.3, 1.0, rise);
  float Lf = H * (0.012 + 0.2 * fresh);
  float st = 0.0, st2 = 0.0;
  if (fresh > 0.0) {
    st = ventures_noised(vec2(lp.x * foot * 0.85 + seed, hs * foot * 0.05 + rise * 1.1)).x;
    st2 = ventures_noised(vec2(lp.x * foot * 1.9 + seed * 2.0, hs * foot * 0.09 - rise * 1.7)).x;
  }
  float th = exp(-max(hs, 0.0) / (Lf * (1.0 + 0.55 * st + 0.2 * st2))) * smoothstep(0.0, 0.05, fresh + 0.02);
  th = max(th, melt);
  float film = smoothstep(0.02, 0.5, th) * (1.0 - onTop * (1.0 - melt));
  // (the coating: dull red where it has thinned, orange at the waterline; the bulge itself hottest at its crown)
  float Tfilm = (770.0 + 410.0 * pow(th, 0.8)) * smoothstep(0.015, 0.16, th);
  Tfilm = mix(Tfilm, 960.0 + 230.0 * ventures_sat(hs / max(ventures_uD[i].x, 1.0)) + 40.0 * st, melt);
  T = max(T, Tfilm);
  rough = mix(rough, 0.09, film * 0.75);                // the melt is glossy
  float a = rough * rough;
  // an arris narrower than a few pixels turns through its quarter circle inside one of them: that spread of normals is
  // roughness (its highlight is a soft line the width of the pixel, never a flicker or a dark outline)
  a = max(a, edgeL * (1.0 - melt) * min(0.5 * px / E4.w, 0.45));

  // --- the reflection: the billet's grain runs up the shaft, so the lobe is wide across the face and tight along it
  // (a highlight lies across the face as a soft band, never down it as a chrome stripe); fillets and the cut: isotropic
  vec3 Tg = up - n * dot(up, n);                        // along the face, upward
  float tl = length(Tg);
  Tg = tl > 1e-3 ? Tg / tl : M[0];
  vec3 Bg = cross(n, Tg);
  float an = 0.5 * face * (1.0 - markIn) * (1.0 - film);
  float aT = clamp(a * (1.0 - an * 0.7), 0.003, 1.0), aB = clamp(a * (1.0 + an * 1.9), 0.003, 1.0);
  vec3 r = reflect(rd, n);
  vec3 F = ventures_fresnel(F0, tint, NoV);
  vec2 dfg = ventures_dFG(rough, NoV);
  vec3 envW = (F0 * dfg.x + dfg.y) * mix(vec3(1.0), F / max(F0 + (1.0 - F0) * pow(1.0 - NoV, 5.0), 1e-3), 0.5);
  vec3 col = envW * ventures_envA(i, h.wp, r, aT * 1.3 + 0.004, true);

  // the moon (look's one cold light, on only at this place)
  vec3 Lm = look_moonDir();
  float NoLm = dot(n, Lm);
  vec3 Em = look_moonLight();
  // on metal the moon is silver, barely blue (a whole face in Quench would be a blue slab)
  Em = mix(vec3(dot(Em, vec3(0.2126, 0.7152, 0.0722))), Em, 0.16);
  if (NoLm > 0.0 && Em.r + Em.g + Em.b > 0.0) {
    vec3 hv = normalize(v + Lm);
    float NoH = max(dot(n, hv), 0.0), VoH = max(dot(v, hv), 0.0);
    float ToH = dot(Tg, hv), BoH = dot(Bg, hv);
    float dd = ToH * ToH / (aT * aT) + BoH * BoH / (aB * aB) + NoH * NoH;
    float D = 1.0 / (VENTURES_PI * aT * aB * dd * dd);
    col += ventures_fresnel(F0, tint, VoH) * min(D, 400.0) * ventures_vis(NoV, NoLm, sqrt(aT * aB)) * NoLm * Em;
    // the cut's lower lips, turned up to it
    col += F0 * Em * cutLit * 6.0;
  }
  // the pool's light on the wall above it: an emissive strip of half-width W under a vertical face lights it by the
  // form factor (1 - y / sqrt(y^2 + W^2)) / 2, strongest at the foot and gone by a third of the height
  float Wp = E.x * 0.9 * (1.0 + 0.5 * heat);
  float yy = max(hs, 0.0);
  float ff = 0.5 * (1.0 - yy / sqrt(yy * yy + Wp * Wp));
  col += ventures_uPool * F0 * ff * (0.5 + 0.5 * ventures_sat(0.4 - dot(n, up))) * (0.5 + 0.35 * kind) * (1.0 + heat) * (1.0 - markIn * 0.5);

  // --- emission (Kirchhoff: what it does not reflect it emits) ---
  col += (1.0 - F) * ventures_bB(T) * 14.0 * ventures_uGain;

  // the core: liquid metal still glowing in its pocket, a smooth skin over Ember heat
  if (coreIn > 0.0) {
    // a hotter heart under the skin, cooling toward the pocket's wall; a slow breath
    float Tc = 1100.0 + 200.0 * (1.0 - coreR * coreR) + 120.0 * heat + 30.0 * sin(uTime * 0.9);
    vec3 cem = ventures_bB(Tc) * 17.0 * ventures_uGain;
    vec3 csk = ventures_envA(i, h.wp, reflect(rd, M * normalize(nl + nMark * 0.6)), 0.01, false) * (0.04 + 0.96 * pow(1.0 - NoV, 5.0));
    col = mix(col, cem + csk, coreIn);
  }
  return col;
}

/* ---------- the sea around them ---------- */
// The reflections: for a sea point the mirrored ray is followed to each casting's middle plane. The swell's slope
// smears what it finds there along the height (the further the sea point from the casting, the longer the smear), so
// each reflection is one continuous column: a sharp image at the waterline that lengthens toward the camera into a
// soft pillar of the foot's glow. Closed form (a box kernel over an exponential glow profile and a flat face); a few
// slow sines of the surface ripple its edges, faded where a pixel cannot resolve them. Added light only: no mirrored
// geometry, no steps, nothing to band.
vec3 ventures_streak(Ray r, Sea s) {
  vec3 rr = reflect(r.rd, s.up);
  float m1 = 1.0 - s.graz;
  float F = 0.053 + 0.947 * m1 * m1 * m1 * m1 * m1;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < VENTURES_N; i++) {
    if (ventures_uP[i].w < 0.5) continue;
    mat3 M = ventures_uM[i];
    vec4 E4 = ventures_uE[i];
    vec3 o = (s.p - ventures_origin(i)) * M, d = rr * M;
    if (d.z > -1e-4 || o.z < 0.0) continue;
    float t = -o.z / d.z;
    vec3 q = o + d * t;
    float lift = ventures_uK[i].x;
    float H = 2.0 * E4.y;
    float hTop = H + lift;                              // the visible height
    float hb = ventures_uD[i].x;
    if (hTop <= 0.0 && hb <= 0.01) continue;
    float kind = ventures_uK[i].z, heat = ventures_uK[i].y;
    float y0 = q.y + lift;                              // where the mirrored ray meets it, above the sea
    float sy = 0.055 * t + 0.6;                         // the smear (the swell's slope, twice, times the distance)
    // ripple: the surface bends the column's edges sideways, slowly; anchored to the sea, faded by footprint
    vec2 w = s.w;
    float k1 = 1.0 - smoothstep(4.0, 11.0, s.fw), k2 = 1.0 - smoothstep(1.5, 4.5, s.fw);
    float tt = uTime * (1.0 - uStill);
    float rip = k1 * sin(w.y * 0.149 + w.x * 0.047 + tt * 0.55) + 0.6 * k2 * sin(w.y * 0.39 - w.x * 0.11 - tt * 0.9)
              + 0.35 * k2 * sin(w.y * 0.83 + w.x * 0.31 + tt * 1.3);
    float hw = E4.x * (1.0 - VENTURES_TAPER * ventures_sat(y0 / H));
    float x = q.x + rip * (0.3 + 0.0035 * t);
    float ew = E4.x * 0.05 + t * 0.012;                 // the edges soften with distance
    float wx = smoothstep(hw + ew, hw - ew, abs(x));
    if (wx <= 0.0) continue;
    // the kernel [y0 - sy, y0 + sy] over the casting's height [0, hTop]
    float ya = max(y0 - sy, 0.0), yb = min(y0 + sy, max(hTop, 0.0));
    vec3 col = vec3(0.0);
    if (yb > ya) {
      float Tw = (kind < 0.5 ? 1150.0 : 1250.0) + heat * 120.0;
      vec3 glow = ventures_bB(Tw) * 14.0 * ventures_uGain * 0.4;
      // the glow's profile up the shaft: brightness falls much faster than temperature (T^6 and the Draper point)
      float fresh = 1.0 - smoothstep(0.3, 1.0, ventures_uD[i].y);
      float Lg = H * ((kind < 0.5 ? 0.03 : 0.07) * (1.0 + heat) + 0.07 * fresh);
      float gI = Lg / (2.0 * sy) * (exp(-ya / Lg) - exp(-yb / Lg));
      // the lower faces lit by the pool (a longer profile), and the face itself (moonlit steel, the sky it mirrors)
      float Lw = H * 0.16;
      float wI = Lw / (2.0 * sy) * (exp(-ya / Lw) - exp(-yb / Lw));
      vec3 F0 = kind < 0.5 ? vec3(0.80, 0.76, 0.68) : vec3(0.56, 0.57, 0.58);
      // (the live one's face stands in the moon: its upper part mirrors as a pale length nearer the camera)
      vec3 face = F0 * (vec3(dot(look_moonLight(), vec3(0.2126, 0.7152, 0.0722))) * (kind < 0.5 ? 1.0 : 0.3) * smoothstep(0.2 * H, 0.75 * H, y0) + ventures_uHorC * 0.06);
      col = glow * gI * 2.2 + ventures_uPool * F0 * 0.7 * wI + face * (yb - ya) / (2.0 * sy);
    }
    // the bulge of melt over a rising casting mirrors too: a short bright smear under it
    if (hb > 0.01) {
      float yd = max(y0 - sy, 0.0), ye = min(y0 + sy, hb);
      if (ye > yd) col += ventures_bB(1050.0) * 14.0 * ventures_uGain * 0.5 * (ye - yd) / (2.0 * sy) * smoothstep(E4.x * 2.2, E4.x * 1.2, abs(q.x));
    }
    // the ripples catch it: brighter on the faces turned to the eye, never broken
    acc += col * wx * (1.0 + 0.3 * rip * ventures_sat(t * 0.01));
  }
  return acc * F;
}

// The metal heats the lava it stands in (a pool at each foot, widest and hottest while it rises: the melt it brings up).
float ventures_seaGlow(vec3 p) {
  float g = 0.0;
  for (int i = 0; i < VENTURES_N; i++) {
    if (ventures_uP[i].w < 0.5) continue;
    vec3 lc = (p - ventures_uP[i].xyz) * ventures_uM[i];
    float rr = length(max(abs(lc.xz) - ventures_uE[i].xz, 0.0)) / ventures_uE[i].x;
    float rise = ventures_uD[i].y;
    float fresh = 1.0 - smoothstep(0.3, 1.0, rise);
    g += exp(-rr * 1.5 / (1.0 + 1.2 * fresh)) * (0.6 + 0.4 * ventures_uK[i].z + 0.5 * fresh) * smoothstep(0.0, 0.04, rise)
       * (1.0 + ventures_uK[i].y * 0.8 + ventures_uK[i].w);
    // ...and the sea is a little hotter for a few hundred metres round each standing casting: they stand in a
    // clearing of brighter metal, the foreground darker (depth across the sea)
    g += 0.2 * exp(-rr * 0.14) * smoothstep(0.0, 0.5, rise);
  }
  return g;
}

/* ---------- the world's hooks (lib/world/ARCHITECTURE.md) ---------- */
void ventures_hit(Ray r, inout Hit h) {
  if (ventures_uOn < 0.5) return;
  // the primary view is drawn by the crisp pass (canvas resolution) when it runs; their reflections in the sea are
  // ventures_sea's (the sea's own mirror of them steps at the scene's scale)
  if (r.depth > 0 || uCrispOn > 0.5) return;
  VenturesHit vh;
  if (ventures_trace(r.ro, r.rd, h.t, max(r.pa, 1e-4), 24, vh)) {
    h.t = vh.t; h.id = VENTURES_ID + vh.id; h.p = vh.wp; h.n = ventures_uM[vh.id][1]; h.data = vec4(vh.lp, 0.0);
  }
}
vec3 ventures_shade(Ray r, Hit h) {
  VenturesHit v; v.id = h.id - VENTURES_ID; v.t = h.t; v.lp = h.data.xyz; v.wp = h.p;
  return ventures_surface(v, r.rd, r.pa);
}
void ventures_sea(Ray r, Sea s, inout SeaMod m) {
  if (ventures_uOn < 0.5) return;
  // the lava is hotter where the metal stands in it (lava's heat scale is 0..1)
  m.heat += 0.3 * min(ventures_seaGlow(s.p), 1.6);
  m.emit += ventures_streak(r, s);
}

/* ---------- the crisp pass: the monoliths at the canvas's own resolution ---------- */
// A march that also keeps the closest approach (in pixels) for the silhouettes' analytic coverage.
float ventures_traceCov(vec3 ro, vec3 rd, float tMax, float pa, out VenturesHit h) {
  h.id = -1; h.t = tMax; h.lp = vec3(0.0); h.wp = vec3(0.0);
  float best = 1e9; int bi = -1; float bt = 0.0; vec3 blp = vec3(0.0);
  for (int i = 0; i < VENTURES_N; i++) {
    if (ventures_uP[i].w < 0.5) continue;
    mat3 M = ventures_uM[i];
    vec3 o = (ro - ventures_origin(i)) * M, d = rd * M;
    vec2 tb = ventures_bound(o, d, i);
    // widen the bound by a pixel or two so the closest approach is seen just outside the box too
    if (tb.x > tb.y + 4.0 * pa * max(tb.y, 1.0) || tb.y < 0.0 || tb.x > h.t) continue;
    float t = max(tb.x, 0.0), tEnd = min(tb.y, h.t);
    for (int s = 0; s < 32; s++) {
      float dist = ventures_sdf(o + d * t, i);
      float pxd = dist / max(t * pa, 1e-6);
      if (pxd < best) { best = pxd; bi = i; bt = t; blp = o + d * t; }
      if (dist < max(ventures_uE[i].x * 2e-4, t * pa * 0.05)) { h.id = i; h.t = t; h.lp = o + d * t; h.wp = ro + rd * t; break; }
      t += max(dist, t * pa * 0.25);
      if (t > tEnd) break;
    }
  }
  if (h.id >= 0) return 1.0;
  if (bi >= 0 && best < 1.5) {                       // a silhouette pixel: shade the nearest point, partial coverage
    h.id = bi; h.t = bt; h.lp = blp; h.wp = ro + rd * bt;
    return clamp(0.5 - best, 0.0, 1.0);
  }
  return 0.0;
}
vec4 ventures_crisp(Ray r, float tScene) {
  if (ventures_uOn < 0.5) return vec4(0.0);
  float tSea = world_seaT(r);
  VenturesHit vh;
  float cov = ventures_traceCov(r.ro, r.rd, tSea > 0.0 ? tSea + 1e-3 : 1e30, max(r.pa, 1e-6), vh);
  if (cov <= 0.0) return vec4(0.0);
  // the waterline, sharp: the part under the sea is the sea's (lp.y + lift is the height above it)
  float hs = vh.lp.y + ventures_uK[vh.id].x;
  cov *= clamp(hs / max(vh.t * r.pa, 1e-6) + 0.5, 0.0, 1.0);
  if (cov <= 0.0) return vec4(0.0);
  vec3 col = ventures_surface(vh, r.rd, r.pa);
  // the air between (ours, not look_atmo: look's air is scaled to a 6 km planet, where 700 m is a continent's worth of
  // haze and the castings turn to ghosts): low over a molten sea it is thick with its glow, so the foot of a far
  // casting dissolves a little into what is behind it (the further, the more) while the top cuts clean into the stars
  float H = 2.0 * ventures_uE[vh.id].y;
  float haze = 0.8 * (1.0 - exp(-(vh.t / 1500.0) * exp(-max(hs, 0.0) / (0.07 * H))));
  // ...and the whole of a far one stands a little deeper in it than a near one: layers
  haze = 1.0 - (1.0 - haze) * exp(-max(vh.t - 560.0, 0.0) / 1500.0);
  if (haze > 0.01) {
    // what the air is lit to: the sky right behind (look's, stars averaged out; never from under the horizon)
    float eh = dot(r.rd, uCamUp) + sqrt(2.0 * uCamH / uR);
    Ray sr = r; sr.rd = normalize(r.rd + uCamUp * max(0.006 - eh, 0.0)); sr.pa = 0.02; sr.depth = 1;
    col = mix(col, look_sky(sr), haze);
  }
  // the bulge of melt meets the sea without an edge: its rim thins into the pool around it
  vec2 d2 = ventures_sdf2(vh.lp, vh.id);
  if (d2.y < 1e5) cov *= mix(1.0, smoothstep(0.0, 0.45 * ventures_uD[vh.id].x, hs), smoothstep(-0.25, 0.25, (d2.x - d2.y) / ventures_uE[vh.id].x));
  return vec4(col * cov, cov);
}
