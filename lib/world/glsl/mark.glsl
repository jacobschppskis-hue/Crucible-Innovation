// mark.glsl: the hero's mark (role: mark). Jacob's Split Ring as one huge cast structure around its core, which is the
// sun, always whole and still, and the "stronger together" beat: a confluence on the sea below (mark_sea): two rivers
// of molten metal run toward each other and join into one river that runs hotter (lib/world/together.ts).
//
// Geometry: lib/splitRing.ts exactly (64-unit box, centred on the core, y up here): rings r 26.667 and 16, stroke
// 3.467, squares 4.267 (7 on the outer ring 22.5 deg apart, 4 on the inner 36 deg apart, after one empty step), core
// 4.8; each arc a half circle ending on the core's centre line. Extruded 2.4 deep with a rounded 0.5 bevel (lib/gl3d
// logoPieces), ray-marched inside its slab box only (two squares per ring evaluated, by angle).
//
// The mark hangs round the sun, which is a world point (lib/world/mark.ts centres it on frame.sun.pos, scaled so the
// core is exactly the sun's sphere): near over the sea in the hero (real parallax, its reflection on the sea), a far
// star elsewhere. This file draws the core (look's disc is off where the mark shows) and lights the pieces with it (a
// sphere light: GGX with the representative point, soft shadows of the pieces toward it with a penumbra from its
// size); the beat's flare brightens the core and its glow in the sky (sky hook).
//
// Physically based, linear HDR radiance: cold, bone cast metal (a broad diffuse part, a bone-tinted sheen) filled by
// the sky above and the glowing sea below (stronger on the lower pieces) and a thin starlit line on the top bevels; no
// grain or normal noise (at this scale it read as specks and mottling). Hot, blackbody (Planck at three wavelengths,
// 750-3000 K, perceptual brightness), emitted through an emissivity that falls at grazing angles so glowing pieces keep
// their form; the liquid skin is glossy and nearly black but for its own light.
//
// Hooks: hit (secondary rays only: the sea's reflections), env (cheap shade for those), over (camera rays: the mark is
// composited here, so its silhouette is anti-aliased and it can fade), sky (the core's flare on the sun disc).
// The confluence timeline is lib/world/together.ts (fronts and flash arrive as uniforms).

uniform vec4 mark_uC;     // xyz: the core's centre (world); w: world units per mark unit
uniform mat3 mark_uB;     // mark -> world (columns: right, up, toward the viewer)
uniform vec4 mark_uBeat;  // x: beat 0..1 (scroll), y: weld flash 0..1, z: core flare 0..1, w: clock (s)
uniform vec4 mark_uLook;  // x: visibility 0..1, y: size (1 = the core is the sun), z: shadow quality 0..1, w: unused
uniform vec3 mark_uSky;   // fill radiance from the sky above (cool)
uniform vec3 mark_uSea;   // fill radiance from the glowing sea below (warm)
uniform vec3 mark_uCoreL; // the core's radiance as a light on the pieces
uniform vec4 mark_uRiv;   // the confluence: x the along-coord origin (world v at the together start), y source rivers' front
                          // 0..1, z joined river's front 0..1, w the meeting flash 0..1
uniform vec2 mark_uRivT;  // x: clock (s), y: on (0/1)
uniform float mark_uBrand; // 0..1: the Split Ring -> the brand mark (small on screen)

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
// The brand mark (lib/splitRing.ts brandMarkSvg, 48 box with the core at the same 4.8 so it is still the sun): one
// ring r 15, stroke 5, its left half a half circle ending on the core's centre line; four upright squares 5.6 at 36 deg
// steps after one empty step. Used wherever the Split Ring's squares would be under ~3 CSS px (they merge into a blob).
vec2 mark_sd2B(vec2 p) {
  float d;
  if (p.x < 0.) d = abs(length(p) - 15.) - 2.5;
  else { float ey = abs(abs(p.y) - 15.) - 2.5; d = length(max(vec2(p.x, ey), 0.)) + min(max(p.x, ey), 0.); }
  vec2 b = vec2(d, 20.);
  if (p.x > -4.) {
    float st = PI / 5.;
    float k0 = clamp(floor(atan(p.x, p.y) / st), 1., 4.), k1 = clamp(k0 + 1., 1., 4.);
    vec2 c0 = vec2(sin(k0 * st), cos(k0 * st)) * 15., c1 = vec2(sin(k1 * st), cos(k1 * st)) * 15.;
    float d0 = mark_box(p - c0, vec2(2.8)), d1 = mark_box(p - c1, vec2(2.8));
    if (d0 < b.x) b = vec2(d0, 20. + k0);
    if (d1 < b.x) b = vec2(d1, 20. + k1);
  }
  return b;
}
int mark_gGeom = 0; // 0: the Split Ring, 1: the brand mark (set before marching)
vec2 mark_sdf(vec3 p) { // rounded extrusion
  vec2 b = mark_gGeom == 1 ? mark_sd2B(p.xy) : mark_sd2(p.xy);
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

// ---------------------------------------------------------------- shading
float mark_ggx(float nh, float a) { float a2 = a * a; float d = nh * nh * (a2 - 1.) + 1.; return a2 / (PI * d * d); }
float mark_vis(float nv, float nl, float a) { float k = a * 0.5; return 0.25 / ((nv * (1. - k) + k) * (nl * (1. - k) + k)); }
vec3 mark_coreL() { return mark_uCoreL * (1. + 1.0 * mark_uBeat.z); }
vec3 mark_corePos() { return mark_uC.xyz; }
vec3 mark_toWorld(vec3 v) { return mark_uB * v; }

vec3 mark_shadeL(vec3 p, vec3 rd, float id, float px, bool cheap) {
  vec3 n = mark_normal(p, clamp(px * 1.1, 0.01, 0.45));
  vec3 v = -rd;
  vec2 H = vec2(0.); // the mark is always cast and cooled: the beat lives on the sea now (mark_sea)
  float T = H.x, wet = H.y;
  // in the liquid: hotter along the middle of a stroke or square (thicker, it holds its heat), cooler at its edges; and
  // faint streamlines drawn out along the flow (smooth, stretched along the run: never specks)
  if (wet > 0.01) {
    float edge;
    if (id < 1.5) edge = abs(length(p.xy) - (id < 0.5 ? MARK_RO : MARK_RI)) / MARK_HS;
    else { float thc, R; vec2 c = mark_cellOf(id, thc, R); vec2 q = abs(p.xy - c) / MARK_HP; edge = max(q.x, q.y); }
    float th = PI - abs(atan(p.x, -p.y));
    float along = th * length(p.xy);
    float across = id < 1.5 ? (length(p.xy) - (id < 0.5 ? MARK_RO : MARK_RI)) : p.x;
    float stream = mark_noise(vec3(along * 0.22 - mark_uBeat.w * 0.9, across * 2.4, mark_uBeat.w * 0.15)) - 0.5;
    T *= 1. - 0.16 * edge * edge;
    T = clamp(T + stream * 0.07 * wet * smoothstep(0.15, 0.4, T), 0., 1.);
  }
  // cold: bone cast metal; hot: a glossy liquid skin, nearly black but for its own light
  // a cast skin at this scale: roughness and tone drift slowly across each face (one or two gentle changes per piece,
  // never a pattern, never specks), so the light's sheen breaks up a little as it would on a real casting
  float skinV = mark_noise(vec3(p.xy * 0.11, id * 1.7)) * 0.65 + mark_noise(vec3(p.xy * 0.27, id * 3.1 + 5.)) * 0.35;
  float rough = mix(0.27 + 0.10 * (1. - abs(n.z)) + 0.09 * (skinV - 0.5), 0.06, wet);
  float a = rough * rough;
  vec3 bone = vec3(0.80, 0.77, 0.69) * (0.97 + 0.06 * mark_hash12(vec2(id, 3.1))) * (0.96 + 0.08 * skinV);
  float liq = smoothstep(0.0, 0.3, wet);
  vec3 F0 = mix(bone * 0.62, vec3(0.32, 0.30, 0.28), liq);   // liquid metal is a mirror too
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
  float up = 0.5 + 0.5 * dot(nW, mark_uB[1]);
  // the sea's light is stronger on the lower pieces (nearer it) and the sky's on the upper ones: a slow gradient down
  // the whole structure, warm at its foot, which is what makes it read as big and lit from below
  float hgt = clamp(p.y / 31. * 0.5 + 0.5, 0., 1.);
  vec3 irr = 0.75 * PI * (mark_uSky * up * up * mix(0.8, 1.2, hgt) + mark_uSea * (1. - up) * (1. - up) * 1.4 * mix(1.35, 0.6, hgt));
  col += alb / PI * irr;
  // the core's glow falls across the front faces: warm near it, so every face shades from its core side to its far
  // side and the inner ring is lit more than the outer (a near light's falloff, which reads as size)
  col += alb * vec3(1.0, 0.80, 0.58) * 0.55 * exp(-dl / 13.) * smoothstep(-0.2, 0.8, n.z) * (1. + mark_uBeat.z);
  vec3 rW = mark_toWorld(r);
  float ru = dot(rW, mark_uB[1]);
  // what it mirrors: the real sky (sharp on the liquid, blurred toward the fills on the rough cast skin)
  vec3 blur = mix(mark_uSea * 0.5, mark_uSky * 0.7, smoothstep(-0.3, 0.3, ru));
  vec3 e1 = cheap ? blur : mark_envDir(rW);
  vec3 Fe = F0 + (1. - F0) * pow(1. - nv, 5.) * 0.8;
  col += Fe * mix(e1, blur, smoothstep(0.08, 0.4, a));
  // starlight: a thin cool line where a bevel turns up to the night
  col += vec3(0.10, 0.13, 0.20) * pow(max(dot(nW, mark_uB[1]), 0.), 6.) * (1. - abs(n.z)) * 0.6 * (1. - wet);
  // heat: emission dominates while hot; emissivity falls at grazing angles, so the glowing pieces keep their form
  col *= 1. - 0.55 * smoothstep(0.05, 0.45, T);
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

// The core: a sphere emitter (a yellow-white heart under an orange skin, a deep limb, a slow boil of large cells; no
// small-scale noise), flaring with the beat. Radiance in the mark's own HDR scale (its light on the pieces matches).
vec3 mark_coreShade(vec3 p, vec3 rd) {
  vec3 n = normalize(p);
  float mu = max(dot(n, -rd), 0.);
  float t = mark_uBeat.w;
  float boil = mark_noise(n * 3.0 + vec3(0., 0., t * 0.05)) * 0.6 + mark_noise(n * 7.0 - vec3(t * 0.08)) * 0.4;
  vec3 c = mix(vec3(1.1, 0.17, 0.025), vec3(3.4, 0.95, 0.20), smoothstep(0.0, 0.45, mu));
  c = mix(c, vec3(6.5, 3.9, 1.8), smoothstep(0.72, 1.0, mu) * (0.8 + 0.4 * boil));
  return c * (0.9 + 0.2 * boil) * (1. + 1.3 * mark_uBeat.z);
}
// The core along a local ray: t of the hit (or of the closest approach within a pixel), and its coverage.
vec2 mark_coreHit(vec3 ro, vec3 rd, float pa) {
  float b = dot(ro, rd);
  if (b > 0.) return vec2(-1.);
  float dc = sqrt(max(dot(ro, ro) - b * b, 0.));
  float pw = -b * pa;
  if (dc > MARK_RC + pw) return vec2(-1.);
  pw = max(pw, 1e-6);
  float m = min(dc, MARK_RC);
  float t = -b - sqrt(max(MARK_RC * MARK_RC - m * m, 0.));
  return vec2(t, clamp((MARK_RC - dc) / max(1.6 * pw, 1e-6) + 0.5, 0., 1.));
}

// March the pieces. Returns the hit (local point, piece id, local t) or the closest approach for the silhouette's
// anti-aliasing: x = local t, y = piece id, z = 1 hit / 0 miss, w = coverage (1 on a hit).
// The silhouette's coverage for a ray: the outline of the extruded pieces is their 2D shape on the planes just inside
// the bevels (front and back), so the signed 2D distance where the ray crosses those planes, over a footprint of `aa`
// render px, gives a coverage that is smooth on BOTH sides of every edge (a hit near an edge is partly covered too),
// footprint-aware: crisp at full quality, never a staircase at the low steps.
float mark_silCov(vec3 ro, vec3 rd, float pa, float aa) {
  float zp = MARK_HD - MARK_BEV * 0.5;
  float rz = abs(rd.z) < 1e-4 ? 1e-4 : rd.z;
  float tf = (zp - ro.z) / rz, tb = (-zp - ro.z) / rz;
  float d = 1e9, tw = 1e9;
  if (tf > 0.) { vec2 q = (ro + rd * tf).xy; d = min(d, (mark_gGeom == 1 ? mark_sd2B(q) : mark_sd2(q)).x); tw = tf; }
  if (tb > 0.) { vec2 q = (ro + rd * tb).xy; d = min(d, (mark_gGeom == 1 ? mark_sd2B(q) : mark_sd2(q)).x); tw = min(tw, tb); }
  if (tw > 1e8) return 0.;
  return clamp(0.5 - d / max(aa * tw * pa, 1e-5), 0., 1.);
}

// March the pieces. Returns x = local t, y = piece id, z = 1 hit / 0 miss, w = coverage. With aa > 0 (camera rays) the
// coverage is the silhouette's (mark_silCov) and a near miss still returns the closest point to shade; with aa 0
// (reflections) it is a plain hit.
vec4 mark_march(vec3 ro, vec3 rd, float pa, int steps, out vec3 pL, float aa) {
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
    if (d.x < pw * 0.25) {
      pL = p;
      return vec4(t, d.y, 1., aa > 0. ? max(mark_silCov(ro, rd, pa, aa), 0.5) : 1.);
    }
    t += d.x;
    if (t > t1) break;
  }
  if (aa <= 0.) return vec4(-1.);
  float cov = min(mark_silCov(ro, rd, pa, aa), clamp(0.5 - best / max(aa * bestT * pa, 1e-5), 0., 1.) * 2.);
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
  mark_gGeom = mark_uBrand > 0.5 ? 1 : 0;
  vec3 ro, rd, pL; mark_local(r, ro, rd);
  vec2 c = mark_coreHit(ro, rd, 0.);
  // a reflected ray's cone (pa) is widened by the sea's roughness; never let that grow the hit test, or every ray inside
  // the mark's box counts as a hit and the reflection shows the box. A fixed, small footprint: the sea's own normals
  // and the roughness break the reflection up.
  vec4 m = mark_march(ro, rd, min(r.pa, 0.002), 32, pL, 0.);
  if (c.x > 0. && (m.z < 0.5 || c.x < m.x)) {
    float t = c.x * mark_uC.w;
    if (t < h.t) { h.t = t; h.id = MARK_ID + 1; h.p = r.ro + r.rd * t; h.n = vec3(0.); h.data = vec4(ro + rd * c.x, -1.); }
    return;
  }
  if (m.z < 0.5) return;
  float t = m.x * mark_uC.w;
  if (t >= h.t) return;
  h.t = t; h.id = MARK_ID; h.p = r.ro + r.rd * t; h.n = vec3(0.); h.data = vec4(pL, m.y);
}
vec3 mark_shade(Ray r, Hit h) { return vec3(0.); } // never: camera rays are composited in mark_over
vec3 mark_env(Ray r, Hit h) {
  mark_gGeom = mark_uBrand > 0.5 ? 1 : 0;
  vec3 ro, rd; mark_local(r, ro, rd);
  if (h.id == MARK_ID + 1) return mark_coreShade(h.data.xyz, rd) * mark_uLook.x;
  return mark_shadeL(h.data.xyz, rd, h.data.w, 0.05, true) * mark_uLook.x;
}

// Camera rays: composited over whatever is behind (the sky; the sea where it is nearer wins), anti-aliased, fading.
void mark_over(Ray r, Hit h, inout vec3 col) {
  if (mark_uLook.x <= 0.002 || uCrispOn > 0.5) return; // the crisp pass draws it at the screen's resolution
  mark_gGeom = mark_uBrand > 0.5 ? 1 : 0;
  vec3 ro, rd, pL; mark_local(r, ro, rd);
  vec2 c = mark_coreHit(ro, rd, r.pa);
  if (c.y > 0. && c.x * mark_uC.w < h.t) col = mix(col, mark_coreShade(normalize(ro + rd * c.x) * MARK_RC, rd), c.y * mark_uLook.x);
  int steps = 24 + int(24. * uQ);
  vec4 m = mark_march(ro, rd, r.pa, steps, pL, 1.9);
  if (m.w <= 0.) return;
  if (m.x * mark_uC.w >= h.t) return;
  if (c.y >= 1. && c.x < m.x) return;
  // When a render pixel is magnified (the low quality steps on phones: more than ~0.8 CSS px each), the bevels and
  // walls are thinner than a pixel and their shading flips from pixel to pixel (a staircase along every edge). There,
  // the mark's own pixels take four sub-rays on a rotated grid, each with its own coverage and shading, averaged.
  if (uPx > 0.8) {
    mat3 Bt = transpose(mark_uB);
    vec3 R = Bt * uCam[0], U = Bt * uCam[1];
    vec3 acc = vec3(0.); float cs = 0.;
    for (int k = 0; k < 4; k++) {
      vec2 o = k == 0 ? vec2(0.125, 0.375) : k == 1 ? vec2(-0.375, 0.125) : k == 2 ? vec2(-0.125, -0.375) : vec2(0.375, -0.125);
      vec3 rk = normalize(rd + (R * o.x + U * o.y) * r.pa);
      vec3 pk; vec4 mk = mark_march(ro, rk, r.pa, steps, pk, 0.9);
      if (mk.w <= 0.) continue;
      acc += mark_shadeL(pk, rk, mk.y, mk.x * r.pa, false) * mk.w;
      cs += mk.w;
    }
    if (cs > 0.) col = mix(col, acc / cs, cs * 0.25 * mark_uLook.x);
    return;
  }
  vec3 s = mark_shadeL(pL, rd, m.y, m.x * r.pa, false);
  col = mix(col, s, m.w * mark_uLook.x);
}

// The core is the sun: it flares with the blaze (look draws the disc; this brightens it and its glow).
void mark_sky(Ray r, inout vec3 col) {
  float f = mark_uBeat.z; // 0 since V2 (no flare); kept so the hook list is stable
  if (f <= 0.001 || mark_uLook.x <= 0.002) return;
  float x = acos(clamp(dot(r.rd, uSunDir), -1., 1.)) / max(uSunRad, 1e-4);
  col += vec3(1.0, 0.55, 0.22) * f * mark_uLook.x * 0.9 * exp(-(x - 1.) * 1.5) * step(1., x);
}

// ---------------------------------------------------------------- the confluence (stronger together)
// Two rivers of molten metal on the sea run toward each other and join into one that runs on hotter (brighter, more
// yellow: colour is temperature). Drawn as heat added to lava's own sea (SeaMod.heat; lava turns it into blackbody
// light under its skin), so it is the world's own material. Local coords in world units on the surface: x across (u),
// y ahead of the together start (origin - v), the camera looking toward +y and down onto it.
// distance from p to a quadratic Bezier (a, c, b) by a 12-segment polyline; t = where along it (0..1)
float mark_bez(vec2 p, vec2 a, vec2 c, vec2 b, out float t) {
  float best = 1e9; t = 0.;
  vec2 q0 = a;
  for (int i = 1; i <= 12; i++) {
    float s1 = float(i) / 12.;
    vec2 q1 = mix(mix(a, c, s1), mix(c, b, s1), s1);
    vec2 e = q1 - q0; float h = clamp(dot(p - q0, e) / dot(e, e), 0., 1.);
    float d = length(p - q0 - e * h);
    if (d < best) { best = d; t = (float(i - 1) + h) / 12.; }
    q0 = q1;
  }
  return best;
}
// one river: heat at p for a river (a, c, b) of mean half-width w that has run as far as `front` (0..1) from a. Like the
// rivers in the reference frame: it meanders (the caller warps p), its width breathes along its course, its heat falls
// off softly from the centre line (no hard bank: a glow seen through the skin, with a faint wider warmth beneath),
// and its front thins to a point as it advances (never a rounded cap).
float mark_river(vec2 p, vec2 a, vec2 c, vec2 b, float w, float front, float fw, float T, float seed, out float along) {
  float t; float d = mark_bez(p, a, c, b, t);
  along = t;
  if (front <= 0.) return 0.;
  float len = length(c - a) + length(b - c);
  float behind = (front - t) * len;                       // world units behind the tip
  if (behind < -2. * w) return 0.;
  float wk = w * (0.75 + 0.5 * world_noise(vec2(t * len * 0.035 + seed, seed * 3.1)));
  wk *= smoothstep(0., 9. * w, behind) * 0.85 + 0.15 * step(0., behind); // the front tapers to a thread
  wk = max(wk, fw * 0.7);
  float x = d / wk;
  float core = exp(-x * x * 1.6);                          // the molten channel, soft-edged
  float under = 0.22 * exp(-x * x * 0.18);                 // warmth under the skin beside it
  float on = smoothstep(-0.5 * w, 1.5 * w, behind);        // the tip's heat fades in, no hard end
  return (core + under) * on * T;
}
void mark_sea(Ray r, Sea s, inout SeaMod m) {
  if (mark_uRivT.y < 0.5) return;
  vec2 p = vec2(s.w.x, mark_uRiv.x - s.w.y);
  if (p.y < -60. || p.y > 420. || abs(p.x) > 340.) return;
  // meanders: a slow, smooth warp of the plane (two octaves, large: bends, never wiggles)
  vec2 q = p * 0.018;
  vec2 warp = vec2(world_noise(q + 3.7) - 0.5, world_noise(q * 1.9 + 8.1) - 0.5) * 22. + vec2(world_noise(q * 3.3 + 1.3) - 0.5, 0.) * 6.;
  vec2 pw = p + warp;
  float fw = s.fw;
  vec2 J = vec2(-6., 82.);
  float aL, aR, aJ;
  float hL = mark_river(pw, vec2(-160., 215.), vec2(-40., 160.), J, 2.4, mark_uRiv.y, fw, 0.27, 1.3, aL);
  float hR = mark_river(pw, vec2(165., 225.), vec2(70., 120.), J, 2.4, mark_uRiv.y, fw, 0.27, 7.9, aR);
  float hJ = mark_river(pw, J, vec2(18., 45.), vec2(-30., -20.), 3.4, mark_uRiv.z, fw, 0.52, 4.4, aJ);
  // where they meet: a brief brightening that spreads into the joined river (soft, no disc)
  float pool = mark_uRiv.w * 0.22 * exp(-dot(pw - J, pw - J) / 90.);
  // the joined river carries both: its heat sits on top of the two it came from, never a seam at the junction
  float h = max(max(hL, hR), hJ) + pool;
  if (h <= 0.002) return;
  // the metal flows: slow, smooth brighter drifts carried downstream (large and soft: never specks)
  float flow = world_noise(vec2((aL + aR + aJ) * 30. - mark_uRivT.x * 0.6, length(pw) * 0.015));
  h *= 0.9 + 0.18 * flow;
  m.heat = max(m.heat, h);
}

// ---------------------------------------------------------------- the crisp pass (V2): the mark at the screen's resolution
// The core and the pieces, anti-aliased analytically at canvas px (r.pa), depth-tested against the scene (the sea in
// front below the horizon). Premultiplied linear radiance. Between the Split Ring and the brand mark (small on screen)
// both are drawn and crossfaded, so the switch never pops.
vec4 mark_crispGeom(vec3 ro, vec3 rd, float pa, float tS, int geom) {
  mark_gGeom = geom;
  vec3 pL;
  vec4 m = mark_march(ro, rd, pa, 24 + int(24. * uQ), pL, 1.25);
  if (m.w <= 0. || m.x * mark_uC.w >= tS) return vec4(0.);
  return vec4(mark_shadeL(pL, rd, m.y, m.x * pa, false) * m.w, m.w);
}
vec4 mark_crisp(Ray r, float tS) {
  if (mark_uLook.x <= 0.002) return vec4(0.);
  vec3 ro, rd; mark_local(r, ro, rd);
  vec4 acc = vec4(0.);
  vec2 c = mark_coreHit(ro, rd, r.pa * 0.8);
  if (c.y > 0. && c.x * mark_uC.w < tS) acc = vec4(mark_coreShade(normalize(ro + rd * c.x) * MARK_RC, rd) * c.y, c.y);
  float k = mark_uBrand;
  vec4 m = vec4(0.);
  if (k < 0.999) m += mark_crispGeom(ro, rd, r.pa, tS, 0) * (1. - k);
  if (k > 0.001) m += mark_crispGeom(ro, rd, r.pa, tS, 1) * k;
  acc = m + acc * (1. - m.a);
  return acc * mark_uLook.x;
}
