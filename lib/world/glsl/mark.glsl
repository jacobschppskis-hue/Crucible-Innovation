// mark.glsl: the hero's mark (role: mark). Jacob's Split Ring as one huge cast structure around its core, which is the
// sun, always whole and still, and the "stronger together" beat: a confluence on the sea below (mark_sea): two rivers
// of molten metal run toward each other and join into one river that runs hotter (lib/world/together.ts).
//
// Geometry: lib/splitRing.ts exactly (64-unit box, centred on the core, y up here): rings r 26.667 and 16, stroke
// 3.467, squares 4.267 (7 on the outer ring 22.5 deg apart, 4 on the inner 36 deg apart, after one empty step), core
// 4.8; each arc a half circle ending on the core's centre line. Extruded 2.4 deep with a rounded 0.8 bevel (a cast
// edge, inside the outline: the silhouette is the 2D mark exactly), ray-marched inside its slab box only (two squares
// per ring evaluated, by angle).
//
// The mark hangs round the sun, which is a world point (lib/world/mark.ts centres it on frame.sun.pos, scaled so the
// core is exactly the sun's sphere): near over the sea in the hero (real parallax, its reflection on the sea), a far
// star elsewhere. This file draws the core (an incandescent body: Planck from a yellow-white heart to an Ember limb;
// look's disc is off) and lights the pieces with it (a sphere light: GGX with the representative point, inverse-square
// falloff, the inner ring's shadow on the outer ring, analytic).
//
// Linear HDR radiance. Sand-cast bone metal: a pale conductor under a rough cast skin, the faces a little pillowed, the
// bevels worn smoother; lit by the core and by the world it mirrors (the night above, the sea's glow below, the
// afterglow behind it), all analytic. No grain or normal noise (at this scale it read as specks and mottling).
//
// The loop's arrival: on the way home the sun is a blaze (mark_glare, a lens's veil over everything) that draws in to
// the core as the exposure settles; the mark resolves out of it from the outside in (mark_reveal). Driven by
// presence() in lib/world/mark.ts; exactly off at the seam.
//
// Hooks: hit (secondary rays only: the sea's reflections), env (cheap shade for those), over (camera rays: the mark is
// composited here, so its silhouette is anti-aliased; and the glare's veil), sky (the glare as the sea mirrors it),
// sea (the rivers), crisp (the mark at the screen's resolution).
// The confluence timeline is lib/world/together.ts (fronts and flash arrive as uniforms).

uniform vec4 mark_uC;     // xyz: the core's centre (world); w: world units per mark unit
uniform mat3 mark_uB;     // mark -> world (columns: right, up, toward the viewer)
uniform vec4 mark_uBeat;  // x: beat 0..1 (scroll), y, z: unused, w: clock (s)
uniform vec4 mark_uLook;  // x: visibility 0..1, y: size (1 = the core is the sun), z: shadow quality 0..1, w: unused
uniform vec3 mark_uSky;   // fill radiance from the sky above (cool)
uniform vec3 mark_uSea;   // fill radiance from the glowing sea below (warm)
uniform vec3 mark_uCoreL; // the core's radiance as a light on the pieces
uniform vec4 mark_uRiv;   // the confluence: x the along-coord origin (world v at the together start), y source rivers' front
                          // 0..1, z joined river's front 0..1, w the meeting flash 0..1
uniform vec2 mark_uRivT;  // x: clock (s), y: on (0/1)
uniform float mark_uBrand; // 0..1: the Split Ring -> the brand mark (small on screen)
uniform vec3 mark_uGlow;  // the afterglow along the horizon behind the mark (what its rims mirror)
uniform vec4 mark_uGlare; // the sun's glare on the way home (the loop's arrival): x amount 0..1, y its width (1 = full)

const float MARK_RO = 26.6667, MARK_RI = 16.0, MARK_HS = 1.73333, MARK_HP = 2.13333, MARK_RC = 4.8, MARK_HD = 1.2, MARK_BEV = 0.8;

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
// The inner ring's shadow on the outer ring, from the core: analytic, one 2D distance where the line to the core
// crosses the inner ring's radius (was a 20-step march). The penumbra is the core's size; the core stands taller than
// the pieces, so its cap still shines over the inner ring onto the faces turned to the viewer.
float mark_shadow(vec3 p, vec3 n) {
  float l = length(p.xy);
  if (mark_uLook.z <= 0. || mark_gGeom == 1 || l < MARK_RI + MARK_HP + 1.2) return 1.;
  vec2 q = p.xy * (MARK_RI / l);
  float d = mark_arc(q, MARK_RI);
  if (q.x > -MARK_HP - 1.) d = min(d, mark_ringSq(q, MARK_RI, 4., 9.).x);
  float s = smoothstep(-1.5, 1.1, d);
  float over = mix(0.3, 0.8, smoothstep(0.3, 0.95, abs(n.z)));
  return mix(1., mix(over, 1., s), mark_uLook.z);
}

// ---------------------------------------------------------------- shading
float mark_ggx(float nh, float a) { float a2 = a * a; float d = nh * nh * (a2 - 1.) + 1.; return a2 / (PI * d * d); }
float mark_vis(float nv, float nl, float a) { float k = a * 0.5; return 0.25 / ((nv * (1. - k) + k) * (nl * (1. - k) + k)); }
vec3 mark_coreL() { return mark_uCoreL; }
vec3 mark_corePos() { return mark_uC.xyz; }
vec3 mark_toWorld(vec3 v) { return mark_uB * v; }

// A casting shrinks toward its middle as it cools: the faces are a little pillowed (a smooth dome across each square,
// a soft crown across each stroke), so every face mirrors a spread of the world and takes the core's light on the side
// turned to it. `face`: 1 on the cast faces, 0 on the bevels and walls.
vec3 mark_faceN(vec3 p, vec3 n, float id, out float face) {
  face = smoothstep(0.72, 0.985, abs(n.z));
  if (face <= 0. || id > 19.5) return n;
  vec2 o;
  if (id < 1.5) { float l = max(length(p.xy), 1e-4); o = p.xy / l * clamp((l - (id < 0.5 ? MARK_RO : MARK_RI)) / MARK_HS, -1., 1.); }
  else { float th, R; o = clamp((p.xy - mark_cellOf(id, th, R)) / MARK_HP, -1., 1.); }
  return normalize(n + vec3(o * (0.22 * face), 0.));
}

// The world as the metal mirrors it, blurred by the skin's roughness (analytic: no sky lookup, no stars to glint as
// specks): the night above, the sea's glow below, the afterglow along the horizon, strongest behind the mark where the
// sun sets (so the rims that turn away from the viewer catch it).
vec3 mark_envSoft(vec3 dW, float rough) {
  float e = dot(dW, mark_uB[1]);
  float w = 0.07 + 0.8 * rough;
  float toSun = 0.5 - 0.5 * dot(dW, mark_uB[2]);
  vec3 sky = mark_uSky * mix(1., 0.7, smoothstep(0., 0.9, e));
  vec3 sea = mark_uSea * mix(0.12, 1., toSun);
  vec3 glow = mark_uGlow * exp(-e * e / (w * w * 0.6 + 0.012)) * mix(0.03, 1., toSun * toSun);
  return mix(sea, sky, smoothstep(-w, w, e)) + glow;
}

// Sand-cast bone metal lit by its own core. A pale conductor (bone-tinted F0) under a rough cast skin on the faces,
// worn smoother on the bevels, which catch the light as lines. The core is a sphere light at the origin: its light
// falls off with the square of the distance (the inner ring glows, the outer ring keeps to bone), crosses each pillowed
// face from its core side to its far side, mirrors as a hot rim on the bevels turned to it, and is shadowed by the
// inner ring. Everything else is the world mirrored: night on the top bevels, the sea's glow on the lower ones.
vec3 mark_shadeL(vec3 p, vec3 rd, float id, float px, bool cheap) {
  vec3 n0 = mark_normal(p, clamp(px * 1.1, 0.01, 0.45));
  float face;
  vec3 n = mark_faceN(p, n0, id, face);
  vec3 v = -rd;
  float nv = max(dot(n, v), 1e-3);
  // the skin drifts slowly in roughness and tone across each piece (one or two gentle changes, never a pattern)
  float skinV = cheap ? 0.5 : mark_noise(vec3(p.xy * 0.11, id * 1.7)) * 0.65 + mark_noise(vec3(p.xy * 0.27, id * 3.1 + 5.)) * 0.35;
  float rough = mix(0.2, 0.42, face) + 0.08 * (skinV - 0.5);
  float a = rough * rough;
  vec3 bone = vec3(0.84, 0.79, 0.69) * (0.95 + 0.1 * skinV);
  vec3 F0 = bone * 0.78;
  vec3 alb = bone * mix(0.24, 0.55, face);
  // the core
  vec3 L = -p; float dl = length(L); vec3 l = L / dl;
  float sh = cheap ? 1. : mark_shadow(p, n0);
  float sa = MARK_RC / dl, sa2 = sa * sa;
  float nlS = clamp((dot(n, l) + sa) / (1. + sa), 0., 1.);            // its cap above a face still lights it
  vec3 r = reflect(-v, n);
  vec3 cr = dot(L, r) * r - L; vec3 cp = L + cr * clamp(MARK_RC / max(length(cr), 1e-4), 0., 1.); vec3 ls = normalize(cp);
  vec3 hv = normalize(ls + v);
  float nls = max(dot(n, ls), 0.);
  float aS = clamp(a + 0.5 * sa, 0., 1.);
  vec3 F = F0 + (1. - F0) * pow(1. - max(dot(hv, v), 0.), 5.);
  vec3 spec = F * mark_ggx(max(dot(n, hv), 0.), aS) * mark_vis(nv, nls, a) * nls * (a * a) / (aS * aS);
  // (the body takes the core's light with a gain: the rough skin scatters the grazing light a smooth plate would lose,
  // and warms it to gold rather than the core's own orange: the skin is pale)
  vec3 col = mark_coreL() * PI * sa2 * (spec + alb / PI * nlS * 6.5 * vec3(1., 1.25, 1.6)) * sh;
  // the world: the skin's body lit by the hemisphere it faces, and the mirror
  vec3 nW = mark_toWorld(n);
  col += alb * mark_envSoft(nW, 1.);
  vec3 Fe = F0 + (1. - F0) * pow(1. - nv, 5.) * (1. - 0.6 * rough);
  col += Fe * mark_envSoft(mark_toWorld(r), rough);
  // starlight: a thin cool line where a bevel turns up to the night
  col += vec3(0.07, 0.09, 0.15) * pow(max(dot(nW, mark_uB[1]), 0.), 6.) * (1. - face);
  return col;
}

// ---------------------------------------------------------------- the glare (the loop's arrival)
// On the way home the camera comes down out of the day onto the evening sea facing the sun, and the sun is a blaze: a
// hot heart over the core and a long veil round it, as a lens gives any light far brighter than the scene. As the
// exposure settles the blaze draws in to the core, and what it veiled resolves from the outside in: the mark, whole,
// hanging round the core. x: distance from the core in core radii; returns the veil's radiance (linear).
vec3 mark_glareX(float x) {
  float g = mark_uGlare.x;
  float xs = x / max(mark_uGlare.y, 0.05);
  float heart = exp(-xs * xs * 0.2);
  float skirt = 1. / (1. + xs * xs * 0.08);
  float fade = exp(-xs / 20.);                              // a long soft tail: no edge anywhere
  return (vec3(1.0, 0.64, 0.3) * (6. * heart) + vec3(1.0, 0.4, 0.11) * (2.6 * skirt * fade)) * g * g;
}
vec3 mark_glare(vec3 rd) {
  if (mark_uGlare.x <= 0.001) return vec3(0.);
  float c = dot(rd, uSunDir);
  if (c < 0.5) return vec3(0.);
  return mark_glareX(acos(clamp(c, -1., 1.)) / max(uSunRad, 1e-4));
}
// how much of the mark shows through the glare at a point (local): nothing where the veil is far brighter than the
// metal, all of it once the veil has thinned
float mark_reveal(vec3 pL) {
  if (mark_uGlare.x <= 0.001) return 1.;
  vec3 gl = mark_glareX(length(pL.xy) / MARK_RC);
  return 1. - smoothstep(0.02, 0.25, dot(gl, vec3(0.2126, 0.7152, 0.0722)));
}

bool mark_boxHit(vec3 ro, vec3 rd, vec3 b, out float t0, out float t1) {
  vec3 inv = 1. / rd; vec3 a = (-b - ro) * inv, c = (b - ro) * inv;
  vec3 mn = min(a, c), mx = max(a, c);
  t0 = max(max(mn.x, mn.y), mn.z); t1 = min(min(mx.x, mx.y), mx.z);
  return t1 > max(t0, 0.);
}

// The core: an incandescent body. We see deeper, hotter layers face-on and the cooler skin at the edge, so it rolls
// off continuously from a yellow-white heart to an Ember limb (temperature, then Planck: no painted rings), with a slow
// boil of large cells a few percent warmer or cooler (never a dark mark). Radiance in the mark's own HDR scale.
vec3 mark_coreShade(vec3 p, vec3 rd) {
  vec3 n = normalize(p);
  float mu = max(dot(n, -rd), 0.);
  float t = mark_uBeat.w;
  float boil = mark_noise(n * 2.6 + vec3(0., t * 0.04, 0.)) * 0.6 + mark_noise(n * 5.5 - vec3(t * 0.06)) * 0.4;
  float k = mu * mu * (0.55 + 0.45 * mu);                   // a sphere's heart: it falls off all the way across the disc
  float T = mix(1150., 2100., k) * (1. + 0.05 * (boil - 0.5) * smoothstep(0.05, 0.6, mu));
  float I = 2.0 * pow(T / 2100., 4.6) + 0.06;
  return look_bbColor(T) * I;
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
  if (h.id == MARK_ID + 1) return mark_coreShade(h.data.xyz, rd) * mark_uLook.x + mark_glare(r.rd) * 0.6;
  // (under the glare the mirrored pieces give way to the mirrored blaze, as the pieces themselves do)
  return mark_shadeL(h.data.xyz, rd, h.data.w, 0.05, true) * mark_uLook.x * mark_reveal(h.data.xyz) + mark_glare(r.rd) * 0.6;
}

// Camera rays: composited over whatever is behind (the sky; the sea where it is nearer wins), anti-aliased, fading.
void mark_overMark(Ray r, Hit h, inout vec3 col) {
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
    if (cs > 0.) col = mix(col, acc / cs, cs * 0.25 * mark_uLook.x * mark_reveal(pL));
    return;
  }
  vec3 s = mark_shadeL(pL, rd, m.y, m.x * r.pa, false);
  col = mix(col, s, m.w * mark_uLook.x * mark_reveal(pL));
}
void mark_over(Ray r, Hit h, inout vec3 col) {
  // the crisp pass draws the mark at the screen's resolution; here only where there is none
  if (mark_uLook.x > 0.002 && uCrispOn < 0.5) mark_overMark(r, h, col);
  col += mark_glare(r.rd);   // the lens's veil lies over everything
}

// The sky hook: the sun's blaze as the sea mirrors it (camera rays get the lens's veil in mark_over instead).
void mark_sky(Ray r, inout vec3 col) {
  if (r.depth > 0) col += mark_glare(r.rd) * 0.6;
}

// ---------------------------------------------------------------- the confluence (stronger together)
// Two rivers of molten metal on the sea run toward each other and join into one that runs on hotter (brighter, more
// yellow: colour is temperature). Drawn as heat added to lava's own sea (SeaMod.heat; lava turns it into blackbody
// light under its skin), so it is the world's own material. Local coords in world units on the surface: x across (u),
// y ahead of the together start (origin - v), the camera looking toward +y and down onto it.
// distance from p to a quadratic Bezier (a, c, b) by an 8-segment polyline; t = where along it (0..1), sd = the
// distance signed by the side of the course p is on
float mark_bez(vec2 p, vec2 a, vec2 c, vec2 b, out float t, out float sd) {
  float best = 1e9; t = 0.; sd = 1e9;
  vec2 q0 = a;
  for (int i = 1; i <= 8; i++) {
    float s1 = float(i) / 8.;
    vec2 q1 = mix(mix(a, c, s1), mix(c, b, s1), s1);
    vec2 e = q1 - q0; float h = clamp(dot(p - q0, e) / dot(e, e), 0., 1.);
    vec2 dv = p - q0 - e * h;
    float d = length(dv);
    if (d < best) { best = d; t = (float(i - 1) + h) / 8.; sd = d * sign(e.x * dv.y - e.y * dv.x); }
    q0 = q1;
  }
  return best;
}
// One river: heat at p for a river (a, c, b) of mean half-width w that has run as far as `front` (0..1) from a.
// Molten metal in a channel, not a glowing line: a broad surface that is hottest along a thread wandering from bank to
// bank (the fastest water), cooler toward the banks, with a wide faint warmth in the sea beside it; its width breathes
// along the course; long, soft drifts of hotter and cooler metal ride downstream (stretched along the flow: never
// specks; faded where a pixel can't resolve them); the front thins to a point as it advances (never a rounded cap).
// `stir` (added to): the flowing metal stirs the sea's skin along its course, so the sun's glitter gives way there
// and the river reads against a quiet margin instead of fighting the sun's path.
float mark_river(vec2 p, vec2 a, vec2 c, vec2 b, float w, float front, float fw, float T, float seed, inout float stir) {
  float t, sd; float d = mark_bez(p, a, c, b, t, sd);
  if (front <= 0.) return 0.;
  float len = length(c - a) + length(b - c);
  float behind = (front - t) * len;                       // world units behind the tip
  if (behind < -2. * w || d > 9. * w + 2. * fw) return 0.;
  float u = t * len;
  float wk = w * (0.68 + 0.64 * world_noise(vec2(u * 0.035 + seed, seed * 3.1)));
  wk *= smoothstep(0., 9. * w, behind) * 0.85 + 0.15 * step(0., behind); // the front tapers to a thread
  wk = max(wk, fw * 0.7);
  // the channel snakes a little inside its course (long S-bends; none at the confluence, so the three meet cleanly)
  sd += w * 0.95 * sin(u * 0.17 + seed * 1.7) * smoothstep(0., 14., min(u, len - u));
  float x = sd / wk, x2 = x * x;
  float time = mark_uRivT.x;
  float fine = smoothstep(1.2, 0.25, fw / wk);              // detail the pixel can resolve
  float thread = (world_noise(vec2(u * 0.045 - time * 0.07 + seed * 2.3, seed)) - 0.5) * 1.2 * fine;
  // the channel's surface: hottest mid-stream (the fastest metal), cooling toward banks you can see
  float body = (1. - 0.38 * min(x2, 1.6)) * exp(-x2 * x2 * x2 * 0.7);
  float hot = exp(-(x - thread) * (x - thread) * 7.);       // the hot thread
  float bank = exp(-x2 * 0.2);                              // warmth in the sea beside it
  float drift = world_noise(vec2(u * 0.09 - time * 0.26, x * 1.7 + seed * 5.)) - 0.5
              + 0.6 * (world_noise(vec2(u * 0.24 - time * 0.4, x * 3.3 - seed)) - 0.5);
  float on = smoothstep(-0.5 * w, 1.5 * w, behind);        // the tip's heat fades in, no hard end
  stir = max(stir, on * exp(-x2 * 0.07));
  return T * on * ((0.78 * body + 0.42 * hot * body) * (1. + 0.34 * drift * fine) + 0.1 * bank);
}
void mark_sea(Ray r, Sea s, inout SeaMod m) {
  if (mark_uRivT.y < 0.001) return;
  vec2 p = vec2(s.w.x, mark_uRiv.x - s.w.y);
  if (p.y < -60. || p.y > 420. || abs(p.x) > 340.) return;
  // meanders: a slow, smooth warp of the plane (large: bends, never wiggles), gentler near the viewer
  vec2 q = p * 0.018;
  vec2 warp = vec2(world_noise(q + 3.7) - 0.5, world_noise(q * 1.9 + 8.1) - 0.5) * 20. * smoothstep(0., 110., p.y);
  vec2 pw = p + warp;
  float fw = s.fw;
  vec2 J = vec2(7., 48.);   // (+x is screen-left: the camera looks back along the travel)
  float stir = 0.;
  float hL = mark_river(pw, vec2(190., 215.), vec2(46., 104.), J, 1.5, mark_uRiv.y, fw, 0.22, 1.3, stir);
  float hR = mark_river(pw, vec2(-185., 230.), vec2(-60., 118.), J, 1.5, mark_uRiv.y, fw, 0.22, 7.9, stir);
  float hJ = mark_river(pw, J, vec2(-0.5, 16.), vec2(-19., -34.), 1.8, mark_uRiv.z, fw, 0.325, 4.4, stir);
  m.rough = max(m.rough, 0.3 * stir * mark_uRivT.y);
  // where they meet: a brief brightening that spreads into the joined river (soft, no disc)
  float pool = mark_uRiv.w * 0.16 * exp(-dot(pw - J, pw - J) / 40.);
  // the joined river carries both: its heat sits on top of the two it came from, never a seam at the junction
  float h = max(max(hL, hR), hJ) + pool;
  if (h <= 0.002) return;
  m.heat = max(m.heat, h * mark_uRivT.y);
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
  float cov = m.w * mark_reveal(pL);
  return vec4(mark_shadeL(pL, rd, m.y, m.x * pa, false) * cov, cov);
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
  acc = (m + acc * (1. - m.a)) * mark_uLook.x;
  acc.rgb += mark_glare(r.rd) * acc.a;   // the veil lies over the mark too (the scene under it already carries it)
  return acc;
}
