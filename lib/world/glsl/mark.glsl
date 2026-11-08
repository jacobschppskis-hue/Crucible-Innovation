// mark.glsl: the hero's mark (role: mark). Jacob's Split Ring as one huge cast structure around its core, which is the
// sun, and the "stronger together" beat: two runs of metal leave the top together, one down the arcs (the human half,
// one continuous line), one filling the squares one by one (the machine half, steps); they meet at the bottom, the weld
// flashes, the ring blazes, then it sets to bone in the order it was poured. Nothing ever moves: the beat is light and
// heat on a rigid mark.
//
// Geometry: lib/splitRing.ts exactly (64-unit box, centred on the core, y up here): rings r 26.667 and 16, stroke
// 3.467, squares 4.267 (7 on the outer ring 22.5 deg apart, 4 on the inner 36 deg apart, after one empty step), core
// 4.8; each arc a half circle ending on the core's centre line. Extruded 2.4 deep with a rounded 0.5 bevel (lib/gl3d
// logoPieces), ray-marched inside its slab box only (two squares per ring evaluated, by angle).
//
// The mark hangs round the sun at a great distance (lib/world/mark.ts places it along uSunDir, scaled so the core is
// exactly the sun's disc): it is celestial, so it does not take the near haze. The core itself is look's sun disc;
// this file lights the pieces with it (a sphere light: GGX with the representative point, soft shadows of the pieces
// toward it with a penumbra from its size) and brightens the disc during the beat's flare (sky hook).
//
// Physically based, linear HDR radiance: cold, bone cast metal (a broad diffuse part, a bone-tinted sheen) filled by
// the sky above and the glowing sea below (stronger on the lower pieces) and a thin starlit line on the top bevels; no
// grain or normal noise (at this scale it read as specks and mottling). Hot, blackbody (Planck at three wavelengths,
// 750-3000 K, perceptual brightness), emitted through an emissivity that falls at grazing angles so glowing pieces keep
// their form; the liquid skin is glossy and nearly black but for its own light.
//
// Hooks: hit (secondary rays only: the sea's reflections), env (cheap shade for those), over (camera rays: the mark is
// composited here, so its silhouette is anti-aliased and it can fade), sky (the core's flare on the sun disc).
// The beat's timeline mirrors lib/world/together.ts: keep MARK_POUR / MARK_MEET and the set window in step.

uniform vec4 mark_uC;     // xyz: the core's centre (world); w: world units per mark unit
uniform mat3 mark_uB;     // mark -> world (columns: right, up, toward the viewer)
uniform vec4 mark_uBeat;  // x: beat 0..1 (scroll), y: weld flash 0..1, z: core flare 0..1, w: clock (s)
uniform vec4 mark_uLook;  // x: visibility 0..1, y: unused, z: shadow quality 0..1, w: unused
uniform vec3 mark_uSky;   // fill radiance from the sky above (cool)
uniform vec3 mark_uSea;   // fill radiance from the glowing sea below (warm)
uniform vec3 mark_uCoreL; // the core's radiance as a light on the pieces

vec3 mark_envDir(vec3 d);

const float MARK_RO = 26.6667, MARK_RI = 16.0, MARK_HS = 1.73333, MARK_HP = 2.13333, MARK_RC = 4.8, MARK_HD = 1.2, MARK_BEV = 0.5;

float mark_hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float mark_hash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float mark_noise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(mark_hash13(i), mark_hash13(i + vec3(1, 0, 0)), f.x), mix(mark_hash13(i + vec3(0, 1, 0)), mark_hash13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(mark_hash13(i + vec3(0, 0, 1)), mark_hash13(i + vec3(1, 0, 1)), f.x), mix(mark_hash13(i + vec3(0, 1, 1)), mark_hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

// ---------------------------------------------------------------- geometry
float mark_arc(vec2 p, float r) { // the left half-annulus of radius r, flat end faces on x = 0
  if (p.x < 0.) return abs(length(p) - r) - MARK_HS;
  float ey = abs(abs(p.y) - r) - MARK_HS;
  return length(max(vec2(p.x, ey), 0.)) + min(max(p.x, ey), 0.);
}
float mark_box(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
// square k (1..n) of a ring of n: its centre and its angle from the top (0) down the right side (pi)
vec2 mark_cell(float r, float n, float k, out float th) { th = k * PI / (n + 1.); return vec2(sin(th), cos(th)) * r; }
// id: 0 outer arc, 1 inner arc, 2..8 outer squares (top to bottom), 9..12 inner squares
vec2 mark_cellOf(float id, out float th, out float r) {
  if (id < 8.5) { r = MARK_RO; return mark_cell(MARK_RO, 7., id - 1., th); }
  r = MARK_RI; return mark_cell(MARK_RI, 4., id - 8., th);
}
// the nearest two squares of a ring (by angle): enough for a bound, 2 boxes instead of n
vec2 mark_ringSq(vec2 p, float r, float n, float id0) {
  float st = PI / (n + 1.);
  float th = atan(p.x, p.y);                                  // 0 at the top, pi at the bottom (right side)
  float f = th / st;
  float k0 = clamp(floor(f), 1., n), k1 = clamp(k0 + 1., 1., n);
  float t;
  vec2 b = vec2(mark_box(p - mark_cell(r, n, k0, t), vec2(MARK_HP)), id0 + k0 - 1.);
  float d1 = mark_box(p - mark_cell(r, n, k1, t), vec2(MARK_HP));
  if (d1 < b.x) b = vec2(d1, id0 + k1 - 1.);
  return b;
}
vec2 mark_sd2(vec2 p) {
  vec2 b = vec2(mark_arc(p, MARK_RO), 0.);
  float a1 = mark_arc(p, MARK_RI); if (a1 < b.x) b = vec2(a1, 1.);
  if (p.x > -MARK_HP - 1.) {
    vec2 o = mark_ringSq(p, MARK_RO, 7., 2.); if (o.x < b.x) b = o;
    vec2 i = mark_ringSq(p, MARK_RI, 4., 9.); if (i.x < b.x) b = i;
  }
  return b;
}
vec2 mark_sdf(vec3 p) { // rounded extrusion
  vec2 b = mark_sd2(p.xy);
  vec2 w = vec2(b.x + MARK_BEV, abs(p.z) - MARK_HD + MARK_BEV);
  return vec2(min(max(w.x, w.y), 0.) + length(max(w, 0.)) - MARK_BEV, b.y);
}
vec3 mark_normal(vec3 p, float e) {
  const vec2 k = vec2(1, -1);
  return normalize(k.xyy * mark_sdf(p + k.xyy * e).x + k.yyx * mark_sdf(p + k.yyx * e).x + k.yxy * mark_sdf(p + k.yxy * e).x + k.xxx * mark_sdf(p + k.xxx * e).x);
}
float mark_shadow(vec3 p, vec3 n) { // soft shadow toward the core (a sphere light of radius MARK_RC at the origin)
  if (mark_uLook.z <= 0.) return 1.;
  vec3 L = -p; float dl = length(L); vec3 l = L / dl;
  if (dot(n, l) < -0.3) return 1.;
  float sa = MARK_RC / dl, res = 1., t = 0.15;
  vec3 o = p + n * 0.06;
  for (int i = 0; i < 20; i++) {
    float h = mark_sdf(o + l * t).x;
    res = min(res, h / (sa * t));
    t += clamp(h, 0.12, 2.0);
    if (res < -1. || t > dl - MARK_RC) break;
  }
  res = clamp(res, -1., 1.);
  return mix(1., 0.25 * (1. + res) * (1. + res) * (2. - res), mark_uLook.z);
}

// ---------------------------------------------------------------- the beat
// mark_uBeat.x, 0..1, a pure function of scroll (so reversible): the pour B_POUR..B_MEET (two runs accelerate down both
// halves, as if by gravity), the weld (B_MEET), heat running back up both halves at once and the blaze, then a crisp
// bone front sets it in the order it was poured, gone by 0.97. Mirrors lib/world/together.ts (keep them in step).
const float MARK_POUR = 0.08, MARK_MEET = 0.60;
float mark_run(float b) { float u = clamp((b - MARK_POUR) / (MARK_MEET - MARK_POUR), 0., 1.); return PI * (0.3 * u + 0.7 * u * u); }
// x: temperature 0..1 (white-hot), y: liquid skin 0..1
vec2 mark_heat(vec3 p3, float id, float px) {
  float b = mark_uBeat.x;
  if (b <= MARK_POUR || b >= 0.97) return vec2(0.);
  vec2 p = p3.xy;
  float tf = mark_run(b);
  float th = PI - abs(atan(p.x, -p.y));                    // 0 at the top, pi at the bottom, either side
  bool inner = (id > 0.5 && id < 1.5) || id > 8.5;
  float T = 0., wet = 0.;
  if (id < 1.5) {
    // a run of liquid metal down the arc: a rounded tongue (ahead mid-stroke, held back at the walls), white-hot tip,
    // orange body, a tail already cooling
    float R = id < 0.5 ? MARK_RO : MARK_RI;
    float dr = clamp((length(p) - R) / MARK_HS, -1., 1.);
    float x = (tf - th) * R - 1.6 * dr * dr - 0.9 * max(MARK_HD - p3.z, 0.) / MARK_HD;
    float on = smoothstep(-px, px, x) * step(0.001, tf);
    T = on * (0.30 + 0.70 * exp(-max(x, 0.) / 7.0) + 0.25 * exp(-max(x, 0.) / 1.2));
    wet = on;
  } else {
    // a square: a little mould that fills from the bottom up (the level stays level) as the run reaches it, with a
    // short heat bloom, then the body's orange
    float thc, R; vec2 c = mark_cellOf(id, thc, R);
    float lead = thc - MARK_HP / R;
    float f = clamp((tf - lead) * R / 4.0, 0., 1.);
    float lvl = (c.y - MARK_HP) + 2. * MARK_HP * f * (2. - f) * 1.04 + 0.12 * sin(p.x * 2.1 + mark_uBeat.w * 3.) * f * (1. - f);
    float on = smoothstep(px, -px, p.y - lvl) * step(0.0001, f);
    float since = max((tf - lead) * R - 4.0, 0.);
    T = on * (0.30 + 0.62 * exp(-since / 5.0) + 0.08 * (1. - f));
    wet = on;
  }
  // the weld: one flash where they meet
  T += mark_uBeat.y * 0.55 * exp(-(PI - th) * 4.);
  // heat runs back up both halves at once: the whole ring blazes, hottest where they met, Ember toward the top
  float up = smoothstep(MARK_MEET, MARK_MEET + 0.06, b);
  float reach = PI * (1. - up);
  float blaze = smoothstep(reach + 0.15, reach - 0.15, th) * up;
  T = max(T, blaze * (0.50 + 0.36 * exp(-(PI - th) / 0.8)));
  wet = max(wet, blaze);
  // it sets in the order it was poured: a crisp bone front runs down both halves (the outer ring a little ahead), the
  // weld last; ahead of it the metal cools orange to dull red. Never an Ember-to-bone mix.
  float ts = PI * 1.12 * smoothstep(0.70, 0.95, b) - (inner ? 0.12 : 0.0);
  float set;
  if (id < 1.5) {
    float R = id < 0.5 ? MARK_RO : MARK_RI;
    set = smoothstep(px, -px, (th - ts) * R);
  } else {
    float thc, R; vec2 c = mark_cellOf(id, thc, R);
    float g = clamp((ts - (thc - MARK_HP / R)) * R / 4.0, 0., 1.);
    set = smoothstep(-px, px, p.y - (c.y + MARK_HP - 2. * MARK_HP * g * 1.04)) * step(0.0001, g);
  }
  T *= (1. - 0.5 * smoothstep(0.68, 0.92, b)) * (1. - set);
  wet *= 1. - set;
  // a slow shimmer in the molten skin, flowing down with the metal (smooth and large: never specks)
  float sh = mark_noise(vec3(th * 9. - mark_uBeat.w * 1.2, length(p) * 0.35, mark_uBeat.w * 0.4)) - 0.5;
  T = clamp(T + sh * 0.05 * wet * smoothstep(0.2, 0.5, T), 0., 1.);
  return vec2(T, wet);
}
// incandescence: Planck's chromaticity at three wavelengths, 750 K (T 0) to 3000 K (T 1), brightness compressed for
// the eye (real radiance spans 10^5 over this range)
vec3 mark_glow(float T) {
  if (T <= 0.001) return vec3(0.);
  float K = 750. + 2250. * T;
  vec3 lam = vec3(610., 549., 468.);
  vec3 bb = 1. / (pow(lam / 610., vec3(5.)) * (exp(1.4388e7 / (lam * K)) - 1.));
  return bb / bb.r * 6.0 * pow(T, 2.6);
}

// ---------------------------------------------------------------- shading
float mark_ggx(float nh, float a) { float a2 = a * a; float d = nh * nh * (a2 - 1.) + 1.; return a2 / (PI * d * d); }
float mark_vis(float nv, float nl, float a) { float k = a * 0.5; return 0.25 / ((nv * (1. - k) + k) * (nl * (1. - k) + k)); }
vec3 mark_coreL() { return mark_uCoreL * (1. + 1.0 * mark_uBeat.z); }
vec3 mark_corePos() { return mark_uC.xyz; }
vec3 mark_toWorld(vec3 v) { return mark_uB * v; }

vec3 mark_shadeL(vec3 p, vec3 rd, float id, float px, bool cheap) {
  vec3 n = mark_normal(p, max(px * 0.5, 0.01));
  vec3 v = -rd;
  vec2 H = mark_heat(p, id, px);
  float T = H.x, wet = H.y;
  // cold: bone cast metal; hot: a glossy liquid skin, nearly black but for its own light
  float rough = mix(0.30 + 0.10 * (1. - abs(n.z)), 0.06, wet);
  float a = rough * rough;
  vec3 bone = vec3(0.80, 0.77, 0.69) * (0.97 + 0.06 * mark_hash12(vec2(id, 3.1)));
  float liq = smoothstep(0.0, 0.3, wet);
  vec3 F0 = mix(bone * 0.62, vec3(0.05), liq);
  vec3 alb = bone * 0.55 * (1. - liq) * (1. - smoothstep(0.05, 0.35, T));
  float nv = max(dot(n, v), 1e-3);
  vec3 col = vec3(0.);
  // the core: a sphere light at the origin
  vec3 L = -p; float dl = length(L); vec3 l = L / dl;
  float sh = cheap ? 1. : mark_shadow(p, n);
  float sa = MARK_RC / dl, sa2 = sa * sa;
  float nlS = clamp((dot(n, l) + sa) / (1. + sa), 0., 1.); nlS *= nlS;  // its cap above a face still lights it
  vec3 r = reflect(-v, n);
  vec3 cr = dot(L, r) * r - L; vec3 cp = L + cr * clamp(MARK_RC / max(length(cr), 1e-4), 0., 1.); vec3 ls = normalize(cp);
  vec3 hv = normalize(ls + v);
  float nls = max(dot(n, ls), 0.);
  float aS = clamp(a + 0.5 * sa, 0., 1.);
  vec3 F = F0 + (1. - F0) * pow(1. - max(dot(hv, v), 0.), 5.);
  vec3 spec = F * mark_ggx(max(dot(n, hv), 0.), aS) * mark_vis(nv, nls, a) * nls * (a * a) / (aS * aS);
  col += mark_coreL() * PI * sa2 * (spec + alb / PI * nlS) * sh;
  // fill: the sky above, the glowing sea below, the afterglow ahead; mirrored and diffuse
  vec3 nW = mark_toWorld(n);
  float up = 0.5 + 0.5 * dot(nW, uCamUp);
  // the sea's light is stronger on the lower pieces (nearer it) and the sky's on the upper ones: a slow gradient down
  // the whole structure, warm at its foot, which is what makes it read as big and lit from below
  float hgt = clamp(p.y / 31. * 0.5 + 0.5, 0., 1.);
  vec3 irr = PI * (mark_uSky * up * up * mix(0.8, 1.2, hgt) + mark_uSea * (1. - up) * (1. - up) * 1.4 * mix(1.35, 0.6, hgt));
  col += alb / PI * irr;
  vec3 rW = mark_toWorld(r);
  float ru = dot(rW, uCamUp);
  // what it mirrors: the real sky (sharp on the liquid, blurred toward the fills on the rough cast skin)
  vec3 blur = mix(mark_uSea * 0.5, mark_uSky * 0.7, smoothstep(-0.3, 0.3, ru));
  vec3 e1 = cheap ? blur : mark_envDir(rW);
  vec3 Fe = F0 + (1. - F0) * pow(1. - nv, 5.) * 0.8;
  col += Fe * mix(e1, blur, smoothstep(0.08, 0.4, a));
  // starlight: a thin cool line where a bevel turns up to the night
  col += vec3(0.10, 0.13, 0.20) * pow(max(dot(nW, uCamUp), 0.), 6.) * (1. - abs(n.z)) * 0.6 * (1. - wet);
  // heat: emission dominates while hot; emissivity falls at grazing angles, so the glowing pieces keep their form
  col *= 1. - 0.85 * smoothstep(0.05, 0.45, T);
  col += mark_glow(T) * (0.62 + 0.38 * sqrt(nv));
  return col;
}


// what the metal mirrors in a world direction: the real sky above the horizon, the sea's glow below it
vec3 mark_envDir(vec3 d) {
  float e = dot(d, uCamUp);
  if (e < 0.) return mark_uSea * 0.6;
  Ray q; q.ro = uCamPos; q.rd = d; q.pa = 0.01; q.depth = 1;
  return look_sky(q);
}

bool mark_boxHit(vec3 ro, vec3 rd, vec3 b, out float t0, out float t1) {
  vec3 inv = 1. / rd; vec3 a = (-b - ro) * inv, c = (b - ro) * inv;
  vec3 mn = min(a, c), mx = max(a, c);
  t0 = max(max(mn.x, mn.y), mn.z); t1 = min(min(mx.x, mx.y), mx.z);
  return t1 > max(t0, 0.);
}

// March the pieces. Returns the hit (local point, piece id, local t) or the closest approach for the silhouette's
// anti-aliasing: x = local t, y = piece id, z = 1 hit / 0 miss, w = coverage (1 on a hit).
vec4 mark_march(vec3 ro, vec3 rd, float pa, int steps, out vec3 pL) {
  pL = vec3(0.);
  float t0, t1;
  if (!mark_boxHit(ro, rd, vec3(31.5, 31.5, MARK_HD + 0.01), t0, t1)) return vec4(-1.);
  float t = max(t0, 0.), best = 1e9, bestT = t;
  for (int i = 0; i < 64; i++) {
    if (i >= steps) break;
    vec3 p = ro + rd * t;
    vec2 d = mark_sdf(p);
    float pw = t * pa;
    if (d.x < best) { best = d.x; bestT = t; }
    if (d.x < pw * 0.25) { pL = p; return vec4(t, d.y, 1., 1.); }
    t += d.x;
    if (t > t1) break;
  }
  float pw = bestT * pa;
  float cov = clamp(0.5 - best / max(pw, 1e-5), 0., 1.);
  if (cov <= 0.) return vec4(-1.);
  pL = ro + rd * bestT;
  return vec4(bestT, mark_sdf(pL).y, 0., cov);
}
void mark_local(Ray r, out vec3 ro, out vec3 rd) {
  mat3 Bt = transpose(mark_uB);
  ro = Bt * (r.ro - mark_uC.xyz) / mark_uC.w;
  rd = Bt * r.rd;
}

// Secondary rays (the sea's reflections): a plain hit, shaded cheaply in mark_env.
void mark_hit(Ray r, inout Hit h) {
  if (r.depth == 0 || mark_uLook.x <= 0.002) return;
  vec3 ro, rd, pL; mark_local(r, ro, rd);
  vec4 m = mark_march(ro, rd, r.pa * 4., 24, pL);
  if (m.z < 0.5) return;
  float t = m.x * mark_uC.w;
  if (t >= h.t) return;
  h.t = t; h.id = MARK_ID; h.p = r.ro + r.rd * t; h.n = vec3(0.); h.data = vec4(pL, m.y);
}
vec3 mark_shade(Ray r, Hit h) { return vec3(0.); } // never: camera rays are composited in mark_over
vec3 mark_env(Ray r, Hit h) {
  vec3 ro, rd; mark_local(r, ro, rd);
  return mark_shadeL(h.data.xyz, rd, h.data.w, 0.05, true) * mark_uLook.x;
}

// Camera rays: composited over whatever is behind (the sky; the sea where it is nearer wins), anti-aliased, fading.
void mark_over(Ray r, Hit h, inout vec3 col) {
  if (mark_uLook.x <= 0.002) return;
  vec3 ro, rd, pL; mark_local(r, ro, rd);
  vec4 m = mark_march(ro, rd, r.pa, 24 + int(24. * uQ), pL);
  if (m.w <= 0.) return;
  if (m.x * mark_uC.w >= h.t) return;
  vec3 c = mark_shadeL(pL, rd, m.y, m.x * r.pa, false);
  col = mix(col, c, m.w * mark_uLook.x);
}

// The core is the sun: it flares with the blaze (look draws the disc; this brightens it and its glow).
void mark_sky(Ray r, inout vec3 col) {
  float f = mark_uBeat.z;
  if (f <= 0.001 || mark_uLook.x <= 0.002) return;
  float x = acos(clamp(dot(r.rd, uSunDir), -1., 1.)) / max(uSunRad, 1e-4);
  col += vec3(1.0, 0.55, 0.22) * f * mark_uLook.x * (smoothstep(1.05, 0.9, x) * 6.0 + 0.9 * exp(-(x - 1.) * 1.5) * step(1., x));
}
