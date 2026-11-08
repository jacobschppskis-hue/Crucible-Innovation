// GENERATED from mark.glsl by lab/mark/glsl2ts.mjs: edit the .glsl, then regenerate.
/** The hero's mark and the stronger-together beat: markTrace / markCorePos / markCoreRadiance and their uniforms (see the .glsl header). */
export const MARK_GLSL = /* glsl */ `
// mark.glsl: the hero's mark (role: mark). Jacob's Split Ring as one huge cast structure around its core, the sun, and
// the "stronger together" beat: two runs of metal leave the top together, one down the arcs (the human half, one
// continuous line), one filling the squares one by one (the machine half, steps); they meet at the bottom, the ring
// blazes, then sets to bone in the order it was poured. Nothing ever moves: the beat is light and heat on a rigid mark.
//
// Geometry: lib/splitRing.ts exactly (64-unit box, centred on the core, y up here): rings r 26.667 and 16, stroke
// 3.467, squares 4.267 (7 on the outer ring 22.5° apart, 4 on the inner 36° apart, after one empty step), core 4.8;
// each arc a half circle ending on the core's centre line. Extruded 2.4 deep with a rounded 0.5 bevel (lib/gl3d
// logoPieces), ray-marched inside its slab box only.
//
// Physically based, linear HDR radiance out (the composer's tone curve does the rest):
// - the core is a sphere emitter (heart, orange skin, deep limb, a slow large-scale boil) and a sphere light: GGX with
//   the representative-point specular, the pieces' soft shadows toward it (a penumbra from its size);
// - the cold metal is bone cast metal: a broad diffuse part and a bone-tinted sheen; filled by the sky above, the
//   glowing sea below and a thin starlit line on the top bevels; no grain or normal noise (at this scale it read as
//   specks and mottling);
// - heat is blackbody (Planck at three wavelengths, 750-3000 K, perceptual brightness), emitted through emissivity
//   that falls at grazing angles, so the glowing pieces keep their form; the liquid skin is glossy and nearly black
//   but for its own light.
//
// Contract (the host sets these uniforms, may define MARK_ENV, and calls markTrace):
//   vec4 markTrace(vec3 ro, vec3 rd, float pixAng, out float tHit)
//        world ray (unit rd), pixAng = radians per pixel -> linear radiance in .rgb and coverage in .a (anti-aliased
//        silhouette); tHit = world distance to the hit (1e9 on a miss). Composite: col = mix(col, m.rgb, m.a) when
//        tHit is nearer than what is behind. The core is included (it is part of the mark).
//   vec3 markCorePos(), markCoreRadiance()   the core as a light for the rest of the world (sea glitter etc.)
//   MARK_ENV(dir) -> radiance the metal mirrors in that world direction (define it before including this file to use
//        the world's own sky and sea; the default is a dusk sky over a glowing sea).
//
// Uniforms:
uniform vec4 uMarkC;      // xyz: the core's centre (world); w: world units per mark unit (outer ring radius = 26.67 w)
uniform mat3 uMarkB;      // mark -> world rotation (columns: right, up, toward the viewer)
uniform vec4 uMarkBeat;   // x: beat 0..1 (scroll), y: weld flash 0..1, z: core flare 0..1, w: clock (s)
uniform vec4 uMarkLook;   // x: visibility 0..1 (fades the whole mark and core), y: core brightness multiplier,
                          // z: shadow quality (0 = off, 1 = full), w: unused
uniform vec3 uMarkSky;    // fill radiance from the sky above (cool)
uniform vec3 uMarkSea;    // fill radiance from the glowing sea below (warm)

#define MK_PI 3.14159265
const float MK_RO = 26.6667, MK_RI = 16.0, MK_HS = 1.73333, MK_HP = 2.13333, MK_RC = 4.8, MK_HD = 1.2, MK_BEV = 0.5;

float mkHash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float mkHash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float mkNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(mkHash13(i), mkHash13(i + vec3(1, 0, 0)), f.x), mix(mkHash13(i + vec3(0, 1, 0)), mkHash13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(mkHash13(i + vec3(0, 0, 1)), mkHash13(i + vec3(1, 0, 1)), f.x), mix(mkHash13(i + vec3(0, 1, 1)), mkHash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

// ---------------------------------------------------------------- the environment the metal mirrors
vec3 mkEnvDefault(vec3 d) {
  float h = d.y;
  vec3 c = mix(vec3(0.30, 0.075, 0.022), vec3(0.035, 0.026, 0.045), smoothstep(0.0, 0.08, h));
  c = mix(c, vec3(0.018, 0.034, 0.072), smoothstep(0.06, 0.2, h));
  c = mix(c, vec3(0.002, 0.003, 0.006), smoothstep(0.2, 0.7, h));
  vec3 sea = vec3(0.16, 0.030, 0.006) * (0.6 + 0.4 * smoothstep(-0.05, -0.6, h));
  return h >= 0. ? c : sea;
}
#ifndef MARK_ENV
#define MARK_ENV(d) mkEnvDefault(d)
#endif

// ---------------------------------------------------------------- geometry
float mkArc(vec2 p, float r) { // the left half-annulus of radius r, flat end faces on x = 0
  if (p.x < 0.) return abs(length(p) - r) - MK_HS;
  float ey = abs(abs(p.y) - r) - MK_HS;
  return length(max(vec2(p.x, ey), 0.)) + min(max(p.x, ey), 0.);
}
float mkBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
// square k (1..n) of a ring of n: its centre and its angle from the top (0) down the right side (pi)
vec2 mkCell(float r, float n, float k, out float th) { th = k * MK_PI / (n + 1.); return vec2(sin(th), cos(th)) * r; }
// id: 0 outer arc, 1 inner arc, 2..8 outer squares (top to bottom), 9..12 inner squares
vec2 mkCellOf(float id, out float th, out float r) {
  if (id < 8.5) { r = MK_RO; return mkCell(MK_RO, 7., id - 1., th); }
  r = MK_RI; return mkCell(MK_RI, 4., id - 8., th);
}
// the nearest two squares of a ring (by angle): enough for a bound, 2 boxes instead of n
vec2 mkRingSq(vec2 p, float r, float n, float id0) {
  float st = MK_PI / (n + 1.);
  float th = atan(p.x, p.y);                                  // 0 at the top, pi at the bottom (right side)
  float f = th / st;
  float k0 = clamp(floor(f), 1., n), k1 = clamp(k0 + 1., 1., n);
  float t;
  vec2 b = vec2(mkBox(p - mkCell(r, n, k0, t), vec2(MK_HP)), id0 + k0 - 1.);
  float d1 = mkBox(p - mkCell(r, n, k1, t), vec2(MK_HP));
  if (d1 < b.x) b = vec2(d1, id0 + k1 - 1.);
  return b;
}
vec2 mkSd2(vec2 p) {
  vec2 b = vec2(mkArc(p, MK_RO), 0.);
  float a1 = mkArc(p, MK_RI); if (a1 < b.x) b = vec2(a1, 1.);
  if (p.x > -MK_HP - 1.) {
    vec2 o = mkRingSq(p, MK_RO, 7., 2.); if (o.x < b.x) b = o;
    vec2 i = mkRingSq(p, MK_RI, 4., 9.); if (i.x < b.x) b = i;
  }
  return b;
}
vec2 mkSdf(vec3 p) { // rounded extrusion
  vec2 b = mkSd2(p.xy);
  vec2 w = vec2(b.x + MK_BEV, abs(p.z) - MK_HD + MK_BEV);
  return vec2(min(max(w.x, w.y), 0.) + length(max(w, 0.)) - MK_BEV, b.y);
}
vec3 mkNormal(vec3 p, float e) {
  const vec2 k = vec2(1, -1);
  return normalize(k.xyy * mkSdf(p + k.xyy * e).x + k.yyx * mkSdf(p + k.yyx * e).x + k.yxy * mkSdf(p + k.yxy * e).x + k.xxx * mkSdf(p + k.xxx * e).x);
}
float mkShadow(vec3 p, vec3 n) { // soft shadow toward the core (a sphere light of radius MK_RC at the origin)
  if (uMarkLook.z <= 0.) return 1.;
  vec3 L = -p; float dl = length(L); vec3 l = L / dl;
  if (dot(n, l) < -0.3) return 1.;
  float sa = MK_RC / dl, res = 1., t = 0.15;
  vec3 o = p + n * 0.06;
  for (int i = 0; i < 20; i++) {
    float h = mkSdf(o + l * t).x;
    res = min(res, h / (sa * t));
    t += clamp(h, 0.12, 2.0);
    if (res < -1. || t > dl - MK_RC) break;
  }
  res = clamp(res, -1., 1.);
  return mix(1., 0.25 * (1. + res) * (1. + res) * (2. - res), uMarkLook.z);
}

// ---------------------------------------------------------------- the beat
// uMarkBeat.x, 0..1, a pure function of scroll (so reversible): the pour B_POUR..B_MEET (two runs accelerate down both
// halves, as if by gravity), the weld (B_MEET), heat running back up both halves at once and the blaze, then a crisp
// bone front sets it in the order it was poured, gone by 0.97. Mirrors lib/world/together.ts (keep them in step).
const float MK_POUR = 0.08, MK_MEET = 0.60;
float mkRun(float b) { float u = clamp((b - MK_POUR) / (MK_MEET - MK_POUR), 0., 1.); return MK_PI * (0.3 * u + 0.7 * u * u); }
// x: temperature 0..1 (white-hot), y: liquid skin 0..1
vec2 mkHeat(vec3 p3, float id, float px) {
  float b = uMarkBeat.x;
  if (b <= MK_POUR || b >= 0.97) return vec2(0.);
  vec2 p = p3.xy;
  float tf = mkRun(b);
  float th = MK_PI - abs(atan(p.x, -p.y));                    // 0 at the top, pi at the bottom, either side
  bool inner = (id > 0.5 && id < 1.5) || id > 8.5;
  float T = 0., wet = 0.;
  if (id < 1.5) {
    // a run of liquid metal down the arc: a rounded tongue (ahead mid-stroke, held back at the walls), white-hot tip,
    // orange body, a tail already cooling
    float R = id < 0.5 ? MK_RO : MK_RI;
    float dr = clamp((length(p) - R) / MK_HS, -1., 1.);
    float x = (tf - th) * R - 1.6 * dr * dr - 0.9 * max(MK_HD - p3.z, 0.) / MK_HD;
    float on = smoothstep(-px, px, x) * step(0.001, tf);
    T = on * (0.30 + 0.70 * exp(-max(x, 0.) / 7.0) + 0.25 * exp(-max(x, 0.) / 1.2));
    wet = on;
  } else {
    // a square: a little mould that fills from the bottom up (the level stays level) as the run reaches it, with a
    // short heat bloom, then the body's orange
    float thc, R; vec2 c = mkCellOf(id, thc, R);
    float lead = thc - MK_HP / R;
    float f = clamp((tf - lead) * R / 4.0, 0., 1.);
    float lvl = (c.y - MK_HP) + 2. * MK_HP * f * (2. - f) * 1.04 + 0.12 * sin(p.x * 2.1 + uMarkBeat.w * 3.) * f * (1. - f);
    float on = smoothstep(px, -px, p.y - lvl) * step(0.0001, f);
    float since = max((tf - lead) * R - 4.0, 0.);
    T = on * (0.30 + 0.62 * exp(-since / 5.0) + 0.08 * (1. - f));
    wet = on;
  }
  // the weld: one flash where they meet
  T += uMarkBeat.y * 0.55 * exp(-(MK_PI - th) * 4.);
  // heat runs back up both halves at once: the whole ring blazes, hottest where they met, Ember toward the top
  float up = smoothstep(MK_MEET, MK_MEET + 0.06, b);
  float reach = MK_PI * (1. - up);
  float blaze = smoothstep(reach + 0.15, reach - 0.15, th) * up;
  T = max(T, blaze * (0.50 + 0.36 * exp(-(MK_PI - th) / 0.8)));
  wet = max(wet, blaze);
  // it sets in the order it was poured: a crisp bone front runs down both halves (the outer ring a little ahead), the
  // weld last; ahead of it the metal cools orange to dull red. Never an Ember-to-bone mix.
  float ts = MK_PI * 1.12 * smoothstep(0.70, 0.95, b) - (inner ? 0.12 : 0.0);
  float set;
  if (id < 1.5) {
    float R = id < 0.5 ? MK_RO : MK_RI;
    set = smoothstep(px, -px, (th - ts) * R);
  } else {
    float thc, R; vec2 c = mkCellOf(id, thc, R);
    float g = clamp((ts - (thc - MK_HP / R)) * R / 4.0, 0., 1.);
    set = smoothstep(-px, px, p.y - (c.y + MK_HP - 2. * MK_HP * g * 1.04)) * step(0.0001, g);
  }
  T *= (1. - 0.5 * smoothstep(0.68, 0.92, b)) * (1. - set);
  wet *= 1. - set;
  // a slow shimmer in the molten skin, flowing down with the metal (smooth and large: never specks)
  float sh = mkNoise(vec3(th * 9. - uMarkBeat.w * 1.2, length(p) * 0.35, uMarkBeat.w * 0.4)) - 0.5;
  T = clamp(T + sh * 0.05 * wet * smoothstep(0.2, 0.5, T), 0., 1.);
  return vec2(T, wet);
}
// incandescence: Planck's chromaticity at three wavelengths, 750 K (T 0) to 3000 K (T 1), brightness compressed for
// the eye (real radiance spans 10^5 over this range)
vec3 mkGlow(float T) {
  if (T <= 0.001) return vec3(0.);
  float K = 750. + 2250. * T;
  vec3 lam = vec3(610., 549., 468.);
  vec3 bb = 1. / (pow(lam / 610., vec3(5.)) * (exp(1.4388e7 / (lam * K)) - 1.));
  return bb / bb.r * 6.0 * pow(T, 2.6);
}

// ---------------------------------------------------------------- shading
float mkGGX(float nh, float a) { float a2 = a * a; float d = nh * nh * (a2 - 1.) + 1.; return a2 / (MK_PI * d * d); }
float mkVis(float nv, float nl, float a) { float k = a * 0.5; return 0.25 / ((nv * (1. - k) + k) * (nl * (1. - k) + k)); }
vec3 markCoreRadiance() { return vec3(9.0, 4.6, 1.9) * (1. + 1.0 * uMarkBeat.z) * uMarkLook.y; }
vec3 markCorePos() { return uMarkC.xyz; }
vec3 mkToWorld(vec3 v) { return uMarkB * v; }

vec3 mkShade(vec3 p, vec3 rd, float id, float px) {
  vec3 n = mkNormal(p, max(px * 0.5, 0.01));
  vec3 v = -rd;
  vec2 H = mkHeat(p, id, px);
  float T = H.x, wet = H.y;
  // cold: bone cast metal; hot: a glossy liquid skin, nearly black but for its own light
  float rough = mix(0.30 + 0.10 * (1. - abs(n.z)), 0.06, wet);
  float a = rough * rough;
  vec3 bone = vec3(0.80, 0.77, 0.69) * (0.97 + 0.06 * mkHash12(vec2(id, 3.1)));
  float liq = smoothstep(0.0, 0.3, wet);
  vec3 F0 = mix(bone * 0.62, vec3(0.05), liq);
  vec3 alb = bone * 0.55 * (1. - liq) * (1. - smoothstep(0.05, 0.35, T));
  float nv = max(dot(n, v), 1e-3);
  vec3 col = vec3(0.);
  // the core: a sphere light at the origin
  vec3 L = -p; float dl = length(L); vec3 l = L / dl;
  float sh = mkShadow(p, n);
  float sa = MK_RC / dl, sa2 = sa * sa;
  float nlS = clamp((dot(n, l) + sa) / (1. + sa), 0., 1.); nlS *= nlS;  // its cap above a face still lights it
  vec3 r = reflect(-v, n);
  vec3 cr = dot(L, r) * r - L; vec3 cp = L + cr * clamp(MK_RC / max(length(cr), 1e-4), 0., 1.); vec3 ls = normalize(cp);
  vec3 hv = normalize(ls + v);
  float nls = max(dot(n, ls), 0.);
  float aS = clamp(a + 0.5 * sa, 0., 1.);
  vec3 F = F0 + (1. - F0) * pow(1. - max(dot(hv, v), 0.), 5.);
  vec3 spec = F * mkGGX(max(dot(n, hv), 0.), aS) * mkVis(nv, nls, a) * nls * (a * a) / (aS * aS);
  col += markCoreRadiance() * MK_PI * sa2 * (spec + alb / MK_PI * nlS) * sh;
  // fill: the sky above, the glowing sea below, the afterglow ahead; mirrored and diffuse
  vec3 nW = mkToWorld(n);
  float up = 0.5 + 0.5 * nW.y;
  // the sea's light is stronger on the lower pieces (nearer it) and the sky's on the upper ones: a slow gradient down
  // the whole structure, warm at its foot, which is what makes it read as big and lit from below
  float hgt = clamp(p.y / 31. * 0.5 + 0.5, 0., 1.);
  vec3 irr = MK_PI * (uMarkSky * up * up * mix(0.8, 1.2, hgt) + uMarkSea * (1. - up) * (1. - up) * 1.4 * mix(1.35, 0.6, hgt));
  col += alb / MK_PI * irr;
  vec3 rW = mkToWorld(r);
  vec3 e1 = MARK_ENV(rW);
  vec3 e2 = 0.5 * (MARK_ENV(normalize(rW + vec3(0., 0.35, 0.))) + MARK_ENV(normalize(rW - vec3(0., 0.35, 0.))));
  vec3 Fe = F0 + (1. - F0) * pow(1. - nv, 5.) * 0.8;
  col += Fe * mix(e1, e2, smoothstep(0.1, 0.5, a));
  // starlight: a thin cool line where a bevel turns up to the night
  col += vec3(0.10, 0.13, 0.20) * pow(max(nW.y, 0.), 6.) * (1. - abs(n.z)) * 0.6 * (1. - wet);
  // heat: emission dominates while hot; emissivity falls at grazing angles, so the glowing pieces keep their form
  col *= 1. - 0.85 * smoothstep(0.05, 0.45, T);
  col += mkGlow(T) * (0.62 + 0.38 * sqrt(nv));
  return col;
}

vec3 mkCoreShade(vec3 p, vec3 rd) {
  vec3 n = normalize(p);
  float mu = max(dot(n, -rd), 0.);
  float t = uMarkBeat.w;
  // a yellow-white heart under an orange skin, a deep limb, a slow boil of large cells (no small-scale noise)
  float boil = mkNoise(n * 3.0 + vec3(0., 0., t * 0.05)) * 0.6 + mkNoise(n * 7.0 - vec3(t * 0.08)) * 0.4;
  vec3 c = mix(vec3(1.1, 0.17, 0.025), vec3(3.4, 0.95, 0.20), smoothstep(0.0, 0.45, mu));
  c = mix(c, vec3(6.5, 3.9, 1.8), smoothstep(0.72, 1.0, mu) * (0.8 + 0.4 * boil));
  return c * (0.9 + 0.2 * boil) * (1. + 1.3 * uMarkBeat.z) * uMarkLook.y;
}

bool mkBoxHit(vec3 ro, vec3 rd, vec3 b, out float t0, out float t1) {
  vec3 inv = 1. / rd; vec3 a = (-b - ro) * inv, c = (b - ro) * inv;
  vec3 mn = min(a, c), mx = max(a, c);
  t0 = max(max(mn.x, mn.y), mn.z); t1 = min(min(mx.x, mx.y), mx.z);
  return t1 > max(t0, 0.);
}

vec4 markTrace(vec3 roW, vec3 rdW, float pixAng, out float tHit) {
  tHit = 1e9;
  if (uMarkLook.x <= 0.002) return vec4(0.);
  float S = uMarkC.w;
  mat3 Bt = transpose(uMarkB);
  vec3 ro = Bt * (roW - uMarkC.xyz) / S, rd = Bt * rdW;
  float pa = pixAng;
  // the core: hit, or within a pixel of its edge (anti-aliased against what is behind it)
  float bq = dot(ro, rd);
  float dc = sqrt(max(dot(ro, ro) - bq * bq, 0.));          // the ray's closest approach to the core's centre
  float tc = 1e9, cc = 0.;
  if (bq < 0. && dc < MK_RC + 2. * (-bq) * pa) {
    float hq = MK_RC * MK_RC - min(dc, MK_RC) * min(dc, MK_RC);
    tc = -bq - sqrt(max(hq, 0.));
    cc = clamp((MK_RC - dc) / max(-bq * pa, 1e-5) + 0.5, 0., 1.);
  }
  float t0, t1, best = 1e9, bestT = 0.;
  vec4 res = vec4(0.);
  if (mkBoxHit(ro, rd, vec3(31.5, 31.5, MK_HD + 0.01), t0, t1)) {
    float t = max(t0, 0.);
    for (int i = 0; i < 48; i++) {
      vec3 p = ro + rd * t;
      vec2 d = mkSdf(p);
      float pw = t * pa;
      if (d.x < best) { best = d.x; bestT = t; }
      if (d.x < pw * 0.25) {
        if (t < tc || cc < 1.) { tHit = t * S; return vec4(mkShade(p, rd, d.y, pw), uMarkLook.x); }
        break;
      }
      t += d.x;
      if (t > t1) break;
    }
  }
  if (tc < 1e8) {
    tHit = tc * S;
    vec3 pc = ro + rd * tc; pc = normalize(pc) * MK_RC;
    return vec4(mkCoreShade(pc, rd), cc * uMarkLook.x);
  }
  // a miss: the silhouette's anti-aliasing from the ray's closest approach
  if (best < 1e8) {
    float pw = bestT * pa;
    float cov = clamp(0.5 - best / max(pw, 1e-4), 0., 1.);
    if (cov > 0.) {
      vec3 p = ro + rd * bestT;
      tHit = bestT * S;
      return vec4(mkShade(p, rd, mkSdf(p).y, pw), cov * uMarkLook.x);
    }
  }
  return vec4(0.);
}
`;
