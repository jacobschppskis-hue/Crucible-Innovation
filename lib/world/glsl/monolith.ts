// GENERATED from monolith.glsl by lab/ventures/glsl2ts.mjs: edit the .glsl, then regenerate.
/** The ventures' monoliths: monoTrace / monoShade / monoSeaGlow and their uniforms (see the .glsl header). */
export const MONOLITH_GLSL = /* glsl */ `
// monolith.glsl: the three venture monoliths (role: ventures). Cast metal rising out of the lava.
//
// Physically based, linear HDR radiance out (the composer's tone curve does the rest):
// - conductor Fresnel: Schlick with Hoffman/Kutz F82 edge tint, measured F0 (iron 0.56/0.57/0.58; the live monolith is
//   a warm nickel-silver, the colour bone is in metal), GGX microfacets with height-correlated Smith, split-sum
//   environment term (Karis' analytic DFG fit), no diffuse at all (metals have none);
// - the environment it mirrors is the scene's own light, integrated analytically so a rough face blurs it instead of
//   sampling it noisily: the night/dusk sky with its horizon band and the sun's disc, and the molten sea below, which is
//   found by intersecting the reflected ray with the sea plane (so the glow pooled at the foot reflects exactly where it
//   is, and the horizon line runs across every face, which is what makes a big metal surface read as metal);
// - the micro-surface is scale-aware: a cast face's slow waviness (visible as a gently bending reflected horizon) and a
//   faint vertical draw (anisotropic roughness), both faded by pixel footprint into plain roughness, so nothing ever
//   aliases or reads as noise; edges are real fillets on a drafted (tapered) casting, never outlines;
// - heat is blackbody: chromaticity from Planck's law at three wavelengths, brightness compressed for the eye, emitted
//   through Kirchhoff (emissivity = 1 - reflectance), hottest at the waterline and falling off up the shaft through
//   white-yellow, orange, cherry and dull red to bare metal; a smooth film of lava drains down off it as it rises.
// No crust, no flakes, no pits, no blotches, no outlines: every term above is smooth by construction.
//
// Contract (the host defines nothing; it sets these uniforms and calls monoTrace / monoShade):
//   monoTrace(ro, rd, tMax, out MonoHit) -> true on a hit (world space ray, unit rd)
//   monoShade(MonoHit, rd, pixAng)       -> linear radiance (pixAng: radians per pixel, for filtering)
//   monoSeaGlow(worldPos)                -> extra sea emission near each foot (the lava module adds it to the sea)

#define MONO_N 3
uniform vec4 uMonoP[MONO_N];  // xyz: the foot's centre on the sea surface (world); w: visible 0/1
uniform mat3 uMonoM[MONO_N];  // local -> world (columns: X across the face, Y up (the surface normal), Z out of the face)
uniform vec4 uMonoK[MONO_N];  // x: lift (local y of the sea surface is -lift; 0 = the foot sits at the sea surface),
                              // y: heat 0..1 (hover/focus), z: kind (0 = cooled live, 1 = still forging), w: press 0..1
uniform vec4 uMonoE;          // xyz: half extents at the foot (half width, half height, half depth); w: fillet radius
uniform vec4 uMonoSun;        // xyz: direction to the sun (world, unit); w: its angular radius (rad)
uniform vec3 uMonoSunL;       // the sun's radiance (linear)
uniform vec3 uMonoZen;        // sky radiance at the zenith
uniform vec3 uMonoHorW;       // the horizon band toward the sun (sunset)
uniform vec3 uMonoHorC;       // the horizon away from the sun (cool, dim)
uniform vec3 uMonoSea;        // the far sea's radiance (as seen at grazing, already including its own reflection)
uniform vec3 uMonoPool;       // the molten pool at a foot (radiance at the waterline)
uniform float uMonoT;         // the clock, seconds

const float MONO_TAPER = 0.035;   // draft: the casting narrows 3.5% toward its top, as a real one does to leave the mould
const float MONO_PI = 3.14159265;
const float MONO_SINK = 0.3;      // the shaft continues this fraction of its height below the foot

struct MonoHit { int id; float t; vec3 lp; vec3 wp; };

float monoSat(float x) { return clamp(x, 0.0, 1.0); }
vec2 monoHash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453) * 2.0 - 1.0;
}
// gradient noise with its analytic derivative (value, d/dx, d/dy): smooth, no grid artefacts at the amplitudes used
vec3 monoNoised(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  vec2 ga = monoHash2(i), gb = monoHash2(i + vec2(1, 0)), gc = monoHash2(i + vec2(0, 1)), gd = monoHash2(i + vec2(1, 1));
  float va = dot(ga, f), vb = dot(gb, f - vec2(1, 0)), vc = dot(gc, f - vec2(0, 1)), vd = dot(gd, f - vec2(1, 1));
  float v = va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * (va - vb - vc + vd);
  vec2 d = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd)
         + du * (vec2(vb - va, vc - va) + u.yx * (va - vb - vc + vd));
  return vec3(v, d);
}

/* ---------- geometry: a drafted casting with fillets ---------- */
// p local: origin at the foot's centre, y up the shaft. The SDF is a rounded box whose x/z half extents shrink with y.
float monoSdf(vec3 p) {
  vec3 E = uMonoE.xyz; float r = uMonoE.w;
  float tap = 1.0 - MONO_TAPER * monoSat(p.y / (2.0 * E.y));
  // the shaft runs on below the foot (MONO_SINK of its height), so a lift on hover never shows its underside
  float hy = E.y * (1.0 + MONO_SINK), cy = E.y * (1.0 - MONO_SINK);
  vec3 b = vec3(E.x * tap, hy, E.z * tap);
  vec3 q = abs(vec3(p.x, p.y - cy, p.z)) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}
vec3 monoNormalL(vec3 p, float h) {
  const vec2 k = vec2(1, -1);
  return normalize(k.xyy * monoSdf(p + k.xyy * h) + k.yyx * monoSdf(p + k.yyx * h) +
                   k.yxy * monoSdf(p + k.yxy * h) + k.xxx * monoSdf(p + k.xxx * h));
}

vec3 monoOrigin(int i) { return uMonoP[i].xyz + uMonoM[i][1] * uMonoK[i].x; }

// slab test against the bound (local), returns (tNear, tFar)
vec2 monoBound(vec3 o, vec3 d) {
  vec3 E = uMonoE.xyz * vec3(1.0, 1.0 + MONO_SINK, 1.0) + vec3(0.002);
  vec3 c = vec3(0.0, uMonoE.y * (1.0 - MONO_SINK), 0.0);
  vec3 m = 1.0 / d, n = m * (o - c), k = abs(m) * E;
  vec3 t1 = -n - k, t2 = -n + k;
  return vec2(max(max(t1.x, t1.y), t1.z), min(min(t2.x, t2.y), t2.z));
}

bool monoTrace(vec3 ro, vec3 rd, float tMax, out MonoHit h) {
  h.id = -1; h.t = tMax; h.lp = vec3(0.0); h.wp = vec3(0.0);
  for (int i = 0; i < MONO_N; i++) {
    if (uMonoP[i].w < 0.5) continue;
    mat3 M = uMonoM[i];
    vec3 o = (ro - monoOrigin(i)) * M, d = rd * M;   // world -> local (M is orthonormal)
    vec2 tb = monoBound(o, d);
    if (tb.x > tb.y || tb.y < 0.0 || tb.x > h.t) continue;
    float t = max(tb.x, 0.0), tEnd = min(tb.y, h.t);
    float eps = uMonoE.x * 2e-4;
    for (int s = 0; s < 64; s++) {
      float dist = monoSdf(o + d * t);
      if (dist < eps + t * 2e-5) { h.id = i; h.t = t; h.lp = o + d * t; h.wp = ro + rd * t; break; }
      t += dist * 0.92;
      if (t > tEnd) break;
    }
  }
  return h.id >= 0;
}

/* ---------- the mark (Jacob's Split Ring, lib/splitRing.ts, 48-unit grid) ---------- */
// p in grid units, centred on the core, y up (the mark is mirror-symmetric about the horizontal axis, so y up or down
// is the same). Returns (distance to the ring+squares, distance to the core), negative inside.
vec2 monoMarkD(vec2 q) {
  float d = 1e3;
  for (int i = 0; i < 2; i++) {
    float r = i == 0 ? 20.0 : 12.0;
    d = min(d, max(abs(length(q) - r) - 1.3, q.x)); // the human half: exact half circle, flat ends on the centre line
  }
  for (int ri = 0; ri < 2; ri++) {
    float r = ri == 0 ? 20.0 : 12.0; float n = ri == 0 ? 7.0 : 4.0;
    for (int k = 1; k <= 7; k++) {
      if (float(k) > n) break;
      float a = -MONO_PI * 0.5 + float(k) * MONO_PI / (n + 1.0);
      vec2 e = abs(q - r * vec2(cos(a), sin(a))) - 1.6; // upright squares, centred on the circle
      d = min(d, length(max(e, 0.0)) + min(max(e.x, e.y), 0.0));
    }
  }
  return vec2(d, length(q) - 3.6);
}

/* ---------- light ---------- */
// Planck at three wavelengths (R 610, G 550, B 465 nm) for the chromaticity; the brightness is compressed (T^6
// instead of the eye's ~T^20 near 1000 K) so the fade from the waterline up reads over a long stretch, not a step.
vec3 monoBB(float T) {
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
vec3 monoFresnel(vec3 F0, vec3 tint, float c) {
  float m = 1.0 - c, m5 = m * m * m * m * m;
  vec3 fs = F0 + (1.0 - F0) * m5;
  const float cb = 1.0 / 7.0, mb = 1.0 - cb;
  float mb5 = mb * mb * mb * mb * mb, mb6 = mb5 * mb;
  vec3 fb = F0 + (1.0 - F0) * mb5;
  vec3 a = fb * (1.0 - tint) / (cb * mb6);
  return clamp(fs - a * c * m5 * m, 0.0, 1.0);
}
vec2 monoDFG(float rough, float NoV) { // Karis' analytic fit of the split-sum's environment BRDF
  const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022), c1 = vec4(1.0, 0.0425, 1.04, -0.04);
  vec4 r = rough * c0 + c1;
  float a004 = min(r.x * r.x, exp2(-9.28 * NoV)) * r.x + r.y;
  return vec2(-1.04, 1.04) * a004 + r.zw;
}

// The sky, blurred over a lobe of half-width w (rad), analytically: a horizon band (warm toward the sun) under a dark
// zenith, plus the sun's disc as a soft lobe. Blurring keeps the band's energy (wider = dimmer), so roughness changes
// sharpness, never brightness.
vec3 monoSky(vec3 d, vec3 up, float w) {
  float e = asin(clamp(dot(d, up), -1.0, 1.0));
  vec3 S = uMonoSun.xyz;
  vec3 dh = d - up * dot(d, up), sh = S - up * dot(S, up);
  float az = dot(normalize(dh + up * 1e-4), normalize(sh + up * 1e-4)) * 0.5 + 0.5;
  float warm = az * az * az;
  float bw = 0.07 + w;                               // band thickness grows with the blur, energy kept
  float band = exp(-max(e, 0.0) / bw) * (0.07 / bw);
  band *= smoothstep(-w - 0.01, w + 0.01, e);        // the band sits on the horizon, not under it
  vec3 hor = mix(uMonoHorC, uMonoHorW, warm);
  vec3 c = mix(uMonoZen, uMonoZen * 0.6, smoothstep(0.2, 1.4, e)) + hor * band;
  // the sun as a lobe: an angular Gaussian whose width is the disc plus the blur, whose integral is the disc's
  float sr = uMonoSun.w, sw = sr + w;
  float ca = dot(d, S);
  float ang = acos(clamp(ca, -1.0, 1.0));
  c += uMonoSunL * (sr * sr) / (sw * sw) * exp(-(ang * ang) / (sw * sw));
  // the sun's own glow around it (forward scatter): wide and faint
  c += uMonoSunL * 2.5e-5 * exp(-ang * 4.0) * warm + uMonoSunL * 2e-4 * exp(-ang * 40.0);
  return c;
}

// Everything a ray leaving the metal at p (world) in direction d sees, blurred over half-width w: the sea where it
// points down (hit on the plane through the foot, so the pool glows exactly where it lies), the sky above.
vec3 monoEnv(int i, vec3 p, vec3 d, float w) {
  vec3 up = uMonoM[i][1];
  vec3 foot = uMonoP[i].xyz;
  float hs = max(dot(p - foot, up), 0.0);
  float dy = dot(d, up);
  // fraction of the lobe below the horizon (a step blurred by the lobe)
  float below = smoothstep(w + 0.004, -w - 0.004, dy);
  vec3 sky = monoSky(d, up, w);
  vec3 sea = uMonoSea;
  if (below > 0.0) {
    float sd = max(-dy, 0.0) + w * 0.5;
    float dist = hs / max(sd, 1e-3);
    vec3 hit = p + d * dist;
    // distance of the reflected sea point from the foot's outline (roughly), in half widths
    vec3 lc = (hit - foot) * uMonoM[i];
    float rr = length(max(abs(lc.xz) - uMonoE.xz, 0.0)) / uMonoE.x;
    float pool = exp(-rr * 1.6) * (1.0 + uMonoK[i].y * 0.8);
    // the sea's own grazing reflection of the horizon band: brighter toward the horizon
    float graze = exp(-sd * 9.0);
    sea = uMonoSea * (0.35 + 0.65 * graze) + uMonoPool * pool * (0.35 + 0.65 * uMonoK[i].z * 0.6 + 0.35);
  }
  return mix(sky, sea, below);
}

// GGX + height-correlated Smith, the sun as one light with the lobe widened by its disc (energy kept)
float monoGGX(float NoH, float a) { float a2 = a * a; float d = NoH * NoH * (a2 - 1.0) + 1.0; return a2 / (MONO_PI * d * d); }
float monoVis(float NoV, float NoL, float a) {
  float a2 = a * a;
  float gv = NoL * sqrt(NoV * NoV * (1.0 - a2) + a2), gl = NoV * sqrt(NoL * NoL * (1.0 - a2) + a2);
  return 0.5 / max(gv + gl, 1e-5);
}

/* ---------- shading ---------- */
vec3 monoShade(MonoHit h, vec3 rd, float pixAng) {
  int i = h.id;
  mat3 M = uMonoM[i];
  vec3 E = uMonoE.xyz;
  vec3 lp = h.lp;
  float kind = uMonoK[i].z, heat = uMonoK[i].y, press = uMonoK[i].w;
  float foot = 1.0 / E.x;                              // local units -> half widths
  float px = h.t * pixAng;                             // world size of a pixel here
  vec3 up = M[1];
  float hs = lp.y + uMonoK[i].x;                       // height above the sea surface
  float H = 2.0 * E.y;

  vec3 nl = monoNormalL(lp, max(px * 0.6, E.x * 1e-3));
  float tap = 1.0 - MONO_TAPER * monoSat(lp.y / H);
  float face = smoothstep(0.85, 0.99, abs(nl.z));      // on the broad faces
  float onTop = step(H - uMonoE.w * 3.0, lp.y);

  // --- the cast face's slow waviness and the draw marks, faded by footprint ---
  vec2 fuv = vec2(lp.x, lp.y) * foot;                  // face coordinates in half widths
  float wav = 1.0 - smoothstep(0.03, 0.12, px * foot); // waviness only while a wave spans several pixels
  vec3 n1 = monoNoised(fuv * vec2(1.3, 0.55) + float(i) * 7.31);
  vec3 n2 = monoNoised(fuv * vec2(3.1, 1.2) + float(i) * 3.17 + 11.0);
  vec2 g = (n1.yz * vec2(1.3, 0.55) * 0.005 + n2.yz * vec2(3.1, 1.2) * 0.0012) * wav * face;
  // a cast face is never optically flat: it crowns slightly (a few hundredths of a radian across the face), so the
  // reflected sky changes across its width and the horizon line bends gently near the edges
  g += vec2(fuv.x * 0.035, (fuv.y * E.x / E.y - 1.0) * 0.012) * face;
  vec3 nlp = normalize(nl + vec3(g.x, g.y, 0.0) * sign(nl.z) * vec3(1.0, 1.0, 0.0));

  // --- materials (measured F0, linear) ---
  // live: a warm nickel-silver (bone, in metal); forging: iron/steel. Polish varies slowly: high points and edges are
  // smoother (as on any metal object that is handled or dressed); never patchy.
  vec3 F0 = kind < 0.5 ? vec3(0.80, 0.76, 0.68) : vec3(0.56, 0.57, 0.58);
  vec3 tint = kind < 0.5 ? vec3(0.95, 0.93, 0.88) : vec3(0.92, 0.93, 0.95);
  float rough = kind < 0.5 ? 0.34 : 0.2;
  float edgeL = smoothstep(0.92, 0.6, max(abs(nl.x), max(abs(nl.y), abs(nl.z))));
  rough += 0.04 * n1.x - 0.08 * edgeL;
  // the draw: grooves run vertically, so highlights stretch across them (horizontally); seen from afar they become
  // plain roughness
  float draw = face * (1.0 - smoothstep(0.002, 0.02, px * foot));

  // --- the mark, cast into the live monolith's front face ---
  float markIn = 0.0, coreIn = 0.0, coreR = 1.0;
  vec3 nMark = vec3(0.0);
  if (kind < 0.5 && nl.z > 0.5) {
    float ms = (E.x * tap * 0.62) / 21.3;              // world units per grid unit: the outer ring spans 62% of the face
    vec2 mc = vec2(0.0, H * 0.70);
    vec2 q = (lp.xy - mc) / ms;
    if (dot(q, q) < 26.0 * 26.0) {
      float fw = max(px / ms, 0.02);                   // a pixel in grid units
      float wch = max(0.45, fw);                       // the chamfer of the cut
      vec2 d0 = monoMarkD(q);
      float e = 0.12;
      float dx = monoMarkD(q + vec2(e, 0.0)).x - monoMarkD(q - vec2(e, 0.0)).x;
      float dy = monoMarkD(q + vec2(0.0, e)).x - monoMarkD(q - vec2(0.0, e)).x;
      vec2 gd = vec2(dx, dy) / (2.0 * e);
      // groove: height drops across the chamfer; its slope tilts the normal toward the cut's centre
      float wall = 1.0 - abs(clamp(d0.x / wch, -1.0, 1.0));
      wall = smoothstep(0.0, 1.0, wall);
      nMark = vec3(gd * wall * 0.9, 0.0);
      markIn = smoothstep(fw, -fw, d0.x);
      coreIn = smoothstep(fw, -fw, d0.y + 0.15);
      coreR = length(q) / 3.6;
      float coreWall = 1.0 - abs(clamp((d0.y + 0.6) / max(0.6, fw), -1.0, 1.0));
      nMark += vec3(normalize(q + 1e-4) * coreWall * 0.8, 0.0) * step(d0.y, 1.0);
    }
  }
  nlp = normalize(nlp + nMark);
  vec3 n = M * nlp;
  vec3 v = -rd;
  float NoV = max(dot(n, v), 1e-4);

  // inside the cut: sand-cast, rougher and a touch darker
  rough = mix(rough, 0.55, markIn);
  F0 = mix(F0, F0 * 0.82, markIn);
  rough = clamp(rough + px * foot * 0.6, 0.06, 1.0);   // unresolved detail becomes roughness
  float a = rough * rough;

  // --- heat: hottest at the waterline, up the shaft through orange, cherry and dull red to bare metal ---
  float Lh = H * (kind < 0.5 ? 0.035 : 0.10) * (1.0 + heat * 0.9 + press * 0.6);
  float Tw = (kind < 0.5 ? 1280.0 : 1520.0) + heat * 120.0 + press * 120.0;
  float Tfloor = kind < 0.5 ? 0.0 : 700.0;             // forging bars keep a faint body heat (just under visible)
  float T = Tfloor + (Tw - Tfloor) * exp(-max(hs, 0.0) / Lh);
  // a slow breath of heat in the forging ones (smooth, large, never patchy)
  T += kind * 40.0 * sin(uMonoT * 0.7 + float(i) * 2.0 + lp.y * foot * 0.4);

  // --- the lava draining off it while it rises (scroll-reversible: a function of the rise and the metal's height
  // above the sea, not of time). A coating of melt: thickest and hottest at the waterline, thinning and cooling up the
  // shaft; long soft streaks where it runs down in sheets. It only shifts temperature and gloss, so it can never draw
  // an edge: no tubes, no blobs.
  float rise = monoSat(1.0 + uMonoK[i].x / H);         // 0 submerged .. 1 fully out
  float fresh = 1.0 - smoothstep(0.45, 1.0, rise);
  float Lf = H * (0.015 + 0.22 * fresh);
  float st = monoNoised(vec2(lp.x * foot * 2.2 + float(i) * 5.0, lp.y * foot * 0.12 + rise * 0.8)).x;
  float st2 = monoNoised(vec2(lp.x * foot * 4.7 + float(i) * 9.0, lp.y * foot * 0.2 - rise * 1.3)).x;
  float th = exp(-max(hs, 0.0) / (Lf * (1.0 + 0.35 * st + 0.15 * st2))) * smoothstep(0.0, 0.05, fresh + 0.02);
  float film = smoothstep(0.02, 0.5, th) * (1.0 - onTop);
  T = max(T, 600.0 + 950.0 * th);
  rough = mix(rough, 0.08, film * 0.7);                 // the melt is glossy
  a = rough * rough;

  // --- the reflection ---
  vec3 r = reflect(rd, n);
  // anisotropic draw: widen the lobe across the grooves only, by bending the reflection toward the face's x
  float w = a * 0.9 + 0.002;
  vec3 F = monoFresnel(F0, tint, NoV);
  vec2 dfg = monoDFG(rough, NoV);
  vec3 env = monoEnv(i, h.wp, r, w);
  if (draw > 0.0) {
    vec3 X = M[0];
    env = mix(env, 0.5 * (monoEnv(i, h.wp, normalize(r + X * a * 0.5), w) + monoEnv(i, h.wp, normalize(r - X * a * 0.5), w)), draw * 0.6);
  }
  vec3 spec = env * (F0 * dfg.x + dfg.y) * mix(vec3(1.0), F / max(F0 + (1.0 - F0) * pow(1.0 - NoV, 5.0), 1e-3), 0.5);

  // the sun, direct (its disc widens the lobe; energy kept)
  vec3 L = uMonoSun.xyz;
  float NoL = dot(n, L);
  if (NoL > 0.0) {
    vec3 hv = normalize(v + L);
    float NoH = max(dot(n, hv), 0.0), VoH = max(dot(v, hv), 0.0);
    float a2 = clamp(a + uMonoSun.w * 0.5, 0.0, 1.0);
    float norm = (a * a) / (a2 * a2);
    vec3 Fs = monoFresnel(F0, tint, VoH);
    float solid = MONO_PI * uMonoSun.w * uMonoSun.w;
    spec += Fs * monoGGX(NoH, a2) * norm * monoVis(NoV, NoL, a2) * NoL * uMonoSunL * solid;
  }
  // the pool's light on the metal's lower faces, as a broad area light below (it is in the environment too, but the
  // blurred env underestimates a large bright source at close range): only on faces turned down or out
  float poolLit = exp(-max(hs, 0.0) / (H * 0.12)) * monoSat(0.3 - dot(n, up) * 0.7);
  spec += uMonoPool * F * poolLit * 0.25 * (1.0 + heat);

  // --- emission (Kirchhoff: what it does not reflect it emits) ---
  vec3 emis = (1.0 - F) * monoBB(T) * 14.0;
  vec3 col = spec + emis;

  // the core: liquid metal still glowing in its pocket, a smooth dielectric skin over Ember heat
  if (coreIn > 0.0) {
    // a hotter heart under the skin, cooling toward the pocket's wall; a slow breath
    float Tc = 1080.0 + 190.0 * (1.0 - coreR * coreR) + 120.0 * heat + 40.0 * sin(uMonoT * 1.3);
    vec3 cem = monoBB(Tc) * 16.0;
    vec3 csk = monoEnv(i, h.wp, reflect(rd, M * normalize(nl + nMark * 0.6)), 0.01) * (0.04 + 0.96 * pow(1.0 - NoV, 5.0));
    col = mix(col, cem + csk, coreIn);
  }

  return col;
}

// Extra emission for the sea near each foot: the metal heats the lava it stands in (a pool) and the lava rises around
// it in a meniscus. Radiance multiplier for the sea at world position p (0 = none).
float monoSeaGlow(vec3 p) {
  float g = 0.0;
  for (int i = 0; i < MONO_N; i++) {
    if (uMonoP[i].w < 0.5) continue;
    vec3 lc = (p - uMonoP[i].xyz) * uMonoM[i];
    float rr = length(max(abs(lc.xz) - uMonoE.xz, 0.0)) / uMonoE.x;
    float rise = monoSat(1.0 + uMonoK[i].x / (2.0 * uMonoE.y));
    g += exp(-rr * 1.6) * (0.6 + 0.4 * uMonoK[i].z) * smoothstep(0.0, 0.15, rise) * (1.0 + uMonoK[i].y * 0.8 + uMonoK[i].w);
  }
  return g;
}
`;
