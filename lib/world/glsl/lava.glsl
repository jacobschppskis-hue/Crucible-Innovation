// lava.glsl (role: lava): the molten sea. Smooth and glossy like water, glowing like lava: no crust, no plates, no
// specks, no noise texture anywhere.
//
// Shape: a sum of long-crested deep-water waves (the swell, never still) plus what the visitor makes (a boat's wake
// along the pointer's path, clean rings from taps) plus the other modules' SeaMod.g. Every wave is filtered by the
// pixel's footprint, anisotropically (waves running toward the eye are foreshortened most); what the pixel can't resolve
// becomes roughness (LEAN), so the far sea turns into a soft glitter path and the planet from orbit into one smooth
// glowing body with a broad sun glint. Nothing aliases.
//
// Light (linear radiance; the engine applies exposure, look's post the tone curve):
//   L = (1 - F) * Planck(T_seen) + F * world_env(reflected ray) + sun GGX
// - emission obeys Kirchhoff (emissivity = 1 - Fresnel): faces turned away and the grazing far sea glow less and
//   mirror the sky more, like hot glass;
// - the glow is seen through a thin, cooler skin whose path grows as 1/cos: faces turned to the eye glow hotter, the far
//   sea cools to deep crimson (this, not texture, is what makes the swell read);
// - where the skin is pulled thin (long-wave troughs, the visitor's waves stirring it) the glow is hotter;
// - slow convection currents (a few warped sine bands per scale, from metres to the whole planet, filtered) keep the
//   body alive without a single speck.
// Temperature: heat 0..1 maps to 950..1800 K (1 ~ the thesis' 1811 K). The hue is the true blackbody (Planck x CIE
// 1931, lab/lava/tools/blackbody.mjs); the brightness keeps Planck's order but compresses its log range.
//
// Units: world units ~ metres at the low swoops; the surface coords s.w (u across, v along) are where the waves live.
// Wave vectors are quantised so the sea is seamless round the lap (v wraps at +-PI R).

#define LAVA_NW 24
uniform vec4 lava_uSw[LAVA_NW];   // swell: k (u, v components, rad/unit), amplitude (units), phase now (rad, wrapped)
uniform vec4 lava_uA;             // x swell gain, y heat (0..1), z interaction gain (0 far .. 1 close), w currents time (s)
uniform vec4 lava_uTone;          // x emission scale, y brightness compression, z skin dT (K), w skin depth (1/cos units)
uniform vec4 lava_uCur;           // currents: amplitude (K), base scale (units), drift (units/s), planet-scale amplitude (K)
uniform vec4 lava_uLook;          // x base roughness (alpha^2), y F0, z sun glint gain, w env (reflection) gain
uniform vec3 lava_uSunL;          // the sun disc's radiance (linear), for its glint
// the wake: N samples of the pointers' recent paths, three texels each (see wake.ts): (u, v, A, R), (e.u, e.v, W, sg),
// (sc, energy scale, 0, 0); A, R, W, sg in CSS px, sc = units per CSS px where the sample was laid
uniform sampler2D lava_uWake;
uniform int lava_uWN;
uniform vec4 lava_uWB;            // bounds of everything the wake can reach (u0, v0, u1, v1)
uniform vec4 lava_uRing[8];       // rings: u, v, radius, amplitude (units)
uniform vec4 lava_uRingW[2];      // ring widths (units), packed
uniform int lava_uRingN;

// blackbody table: linear sRGB chroma (unit luminance) and ln(Y / Y(1300 K)), 700..2700 K in 50 K steps
const vec4 LAVA_BB[41] = vec4[41](
  vec4(4.7037, 0.0000, 0.0000, -15.3571), vec4(4.7037, 0.0000, 0.0000, -13.1937), vec4(4.7037, 0.0000, 0.0000, -11.2868),
  vec4(4.7032, 0.0001, 0.0000, -9.5930), vec4(4.5667, 0.0407, 0.0000, -8.0782), vec4(4.4279, 0.0820, 0.0000, -6.7153),
  vec4(4.2897, 0.1231, 0.0000, -5.4823), vec4(4.1542, 0.1633, 0.0000, -4.3613), vec4(4.0227, 0.2024, 0.0000, -3.3378),
  vec4(3.8960, 0.2401, 0.0000, -2.3993), vec4(3.7746, 0.2762, 0.0000, -1.5358), vec4(3.6587, 0.3106, 0.0000, -0.7385),
  vec4(3.5484, 0.3434, 0.0000, 0.0000), vec4(3.4435, 0.3746, 0.0000, 0.6859), vec4(3.3439, 0.4042, 0.0000, 1.3248),
  vec4(3.2494, 0.4323, 0.0000, 1.9213), vec4(3.1598, 0.4589, 0.0000, 2.4794), vec4(3.0749, 0.4842, 0.0000, 3.0029),
  vec4(2.9944, 0.5081, 0.0000, 3.4948), vec4(2.9180, 0.5308, 0.0000, 3.9580), vec4(2.8456, 0.5523, 0.0000, 4.3948),
  vec4(2.7768, 0.5728, 0.0000, 4.8075), vec4(2.7115, 0.5922, 0.0000, 5.1980), vec4(2.6495, 0.6106, 0.0000, 5.5681),
  vec4(2.5905, 0.6282, 0.0000, 5.9193), vec4(2.5328, 0.6445, 0.0086, 6.2531), vec4(2.4775, 0.6598, 0.0190, 6.5707),
  vec4(2.4248, 0.6744, 0.0298, 6.8732), vec4(2.3744, 0.6883, 0.0410, 7.1618), vec4(2.3263, 0.7014, 0.0524, 7.4373),
  vec4(2.2804, 0.7139, 0.0640, 7.7007), vec4(2.2364, 0.7257, 0.0759, 7.9526), vec4(2.1943, 0.7370, 0.0881, 8.1940),
  vec4(2.1541, 0.7478, 0.1004, 8.4253), vec4(2.1154, 0.7580, 0.1129, 8.6473), vec4(2.0784, 0.7677, 0.1256, 8.8604),
  vec4(2.0429, 0.7770, 0.1384, 9.0652), vec4(2.0088, 0.7858, 0.1513, 9.2622), vec4(1.9760, 0.7942, 0.1643, 9.4518),
  vec4(1.9445, 0.8023, 0.1775, 9.6344), vec4(1.9142, 0.8099, 0.1907, 9.8105));

/** The glow of molten rock at T kelvin (linear radiance). Other modules may use it for anything molten. */
vec3 lava_planck(float T) {
  float f = clamp((T - 700.) / 50., 0., 39.999);
  int i = int(f);
  vec4 b = mix(LAVA_BB[i], LAVA_BB[i + 1], f - float(i));
  return b.rgb * exp(b.w * lava_uTone.y) * lava_uTone.x;
}
/** heat (lava's 0..1 scale) -> kelvin */
float lava_kelvin(float heat) { return 950. + 850. * heat; }

/** The sea's shape: height, slope (d/du, d/dv), unresolved slope variance, skin stretch (+ = thin, ~ steepness),
 *  crest (signed, the visitor's crests) and energy (the visitor's waves, 0..~1). */
struct LavaSurf { float h; vec2 g; float var; float stretch; float crest; float energy; };

// dPx, dPy: the pixel's footprint on the surface (units, two axes of its ellipse)
void lava_swell(vec2 P, vec2 dPx, vec2 dPy, float gain, inout LavaSurf s) {
  for (int i = 0; i < LAVA_NW; i++) {
    vec4 w = lava_uSw[i];
    float k = length(w.xy);
    float a = w.z * gain;
    vec2 pp = vec2(dot(w.xy, dPx), dot(w.xy, dPy));   // this wave's phase step per pixel
    float at = exp(-0.25 * dot(pp, pp));                // the pixel's box, as a Gaussian, applied to this wave
    if (at < 0.003) { s.var += 0.5 * a * a * k * k; continue; }
    float ph = dot(w.xy, P) + w.w;
    float sn = sin(ph), cs = cos(ph);
    s.h += a * at * sn;
    s.g += a * at * cs * w.xy;
    s.stretch -= a * k * at * sn * smoothstep(0.35, 0.08, k);   // only the long swell pulls the skin visibly
    s.var += 0.5 * a * a * k * k * (1. - at * at);
  }
}

// ---------- the visitor's waves ----------
// The wake (after the production liquid, lib/liquid/wake.ts, which Jacob approved): the pointer's path as samples a
// few px apart; each carries a cross-section of the wake as it is `age` s after the pointer passed: two arms leaving
// the path sideways at 0.33x the pointer's speed (a ~19 deg V at any speed), each a short ridge train broadening and
// fading; along the path each sample is a normalised Gaussian weighted by the path length it stands for, so the sum is
// one continuous surface along any path (no beads, no rings, no seams). All in CSS px, scaled by the sample's sc.
void lava_interact(vec2 P, float fp, inout LavaSurf s) {
  float gain = lava_uA.z;
  if (gain < 0.001) return;
  float h = 0.;
  vec2 g = vec2(0.);
  float en = 0., cr = 0.;
  for (int i = 0; i < 8; i++) {
    if (i >= lava_uRingN) break;
    vec4 R = lava_uRing[i];
    float W = lava_uRingW[i / 4][i % 4];
    vec2 q = P - R.xy;
    float rr = length(q) + 1e-6;
    float x = (rr - R.z) / W;
    if (abs(x) > 3.5) continue;
    float ga = exp(-x * x), c = cos(2.4 * x), sn = sin(2.4 * x);
    float a = R.w * smoothstep(0.45, 1.3, W / fp);
    h += a * ga * c;
    g += a * ga * (-2. * x * c - 2.4 * sn) / W * q / rr;
    en += abs(a * ga * c) / W * 6.;
    cr += a * ga * c / W * 5.;
  }
  if (lava_uWN > 0 && P.x > lava_uWB.x && P.y > lava_uWB.y && P.x < lava_uWB.z && P.y < lava_uWB.w) {
    const float KAPPA = 6.28318530718 / 46.;            // the arms' ridge wavelength: 46 px
    for (int i = 0; i < 128; i++) {
      if (i >= lava_uWN) break;
      vec4 t0 = texelFetch(lava_uWake, ivec2(i * 3, 0), 0);
      vec4 t1 = texelFetch(lava_uWake, ivec2(i * 3 + 1, 0), 0);
      vec4 t2 = texelFetch(lava_uWake, ivec2(i * 3 + 2, 0), 0);
      float sc = t2.x;
      vec2 q = (P - t0.xy) / sc;                         // CSS px from the sample
      float a = dot(q, t1.xy);                           // along the path
      float d = q.x * t1.y - q.y * t1.x;                 // across it
      float Rr = t0.w, W = t1.z, sg = t1.w;
      if (abs(a) > 3. * sg || abs(d) > Rr + 3. * W) continue;
      float ia = 1. / (2. * sg * sg), iw = 1. / (2. * W * W);
      float u1 = d - Rr, u2 = d + Rr;
      float e1 = exp(-u1 * u1 * iw), e2 = exp(-u2 * u2 * iw);
      float c1 = cos(KAPPA * u1), c2 = cos(KAPPA * u2);
      float s1 = sin(KAPPA * u1), s2 = sin(KAPPA * u2);
      // the ridges fade out where the pixel can't resolve them
      float aa = smoothstep(1.2, 3., (46. * sc) / fp);
      float v = (e1 * c1 + e2 * c2) * aa;
      float dvd = (e1 * (-2. * u1 * iw * c1 - KAPPA * s1) + e2 * (-2. * u2 * iw * c2 - KAPPA * s2)) * aa;
      float ga = exp(-a * a * ia);
      float A = t0.z;
      h += A * ga * v * sc;
      // slope (dimensionless): d/d(across) and d/d(along), back to (u, v)
      float hd = A * ga * dvd, ha = A * ga * v * (-2. * a * ia);
      g += hd * vec2(t1.y, -t1.x) + ha * t1.xy;
      en += abs(A * ga * v) * t2.y;
      cr += A * ga * v * t2.y;
    }
  }
  s.h += h * gain;
  s.g += g * gain;
  s.energy += en * gain;
  s.crest += cr * gain;
}

LavaSurf lava_surface(vec2 P, vec2 dPx, vec2 dPy, float calm) {
  LavaSurf s = LavaSurf(0., vec2(0.), 0., 0., 0., 0.);
  lava_swell(P, dPx, dPy, lava_uA.x * (1. - calm), s);
  lava_interact(P, sqrt(length(dPx) * length(dPy)), s);
  return s;
}

// slow convection: smooth warped sine bands at five scales (filtered by the footprint), roughly -1..1; never a noise
// texture, so it can't speckle. The largest scales use the unit-sphere point q (seamless round the planet).
float lava_currents(vec2 P, vec3 q, float fp) {
  float sc = lava_uCur.y, t = lava_uA.w * lava_uCur.z;
  float v = 0., tot = 0.;
  for (int i = 0; i < 3; i++) {
    float f = float(i);
    float m = exp2(f * 2.3);                            // 1, ~5, ~24 x the base scale
    vec2 p = P / (sc * m);
    float fa = exp(-pow(fp / (sc * m) * 1.2, 2.));
    float tt = t / (sc * m);
    float w1 = sin(p.x * 0.83 + 1.7 * sin(p.y * 0.61 + tt * 0.9 + f * 2.1) + f);
    float w2 = sin(p.y * 0.71 - 1.4 * sin(p.x * 0.57 - tt * 0.7 + f * 1.3) + 2.0 * f);
    float a = 1. / (1. + f * 0.6);
    v += a * fa * (0.6 * w1 + 0.4 * w2);
    tot += a;
  }
  // planet scale: bands that wrap the sphere (seen from orbit)
  float tq = lava_uA.w * 0.004;
  float b1 = sin(q.y * 5.0 + 1.3 * sin(q.x * 4.0 + q.z * 3.0 + tq) + tq * 0.5);
  float b2 = sin(q.z * 7.0 - 1.1 * sin(q.y * 6.0 - q.x * 2.0 - tq * 0.7));
  return v / tot + (lava_uCur.w / max(lava_uCur.x, 1.)) * (0.6 * b1 + 0.4 * b2);
}

// the pixel's footprint ellipse on the surface, in (u, v): across the view and along it (foreshortened by 1/graz)
void lava_footprint(Ray r, Sea s, out vec2 dPx, out vec2 dPy) {
  vec2 dl = vec2(dot(r.rd, s.eU), dot(r.rd, s.eV));
  float l = length(dl);
  vec2 along = l > 1e-5 ? dl / l : vec2(0., 1.);
  float lat = r.pa * s.t;
  dPx = vec2(-along.y, along.x) * lat;
  dPy = along * lat / s.graz;
}

vec3 lava_shade(Ray r, Sea s, SeaMod m) {
  vec2 dPx, dPy;
  lava_footprint(r, s, dPx, dPy);
  float fp = sqrt(length(dPx) * length(dPy));
  LavaSurf L = lava_surface(s.w, dPx, dPy, m.calm);
  L.h += m.g.x;
  L.g += m.g.yz;
  vec3 n = normalize(s.up - L.g.x * s.eU - L.g.y * s.eV);
  vec3 v = -r.rd;
  float NoV = max(dot(n, v), 1e-4);
  float a2 = lava_uLook.x + 2. * L.var + m.rough * m.rough;
  float rough = sqrt(sqrt(a2));
  float F0 = lava_uLook.y;
  float Fc = pow(1. - NoV, 5.);
  float F = F0 + (max(1. - rough, F0) - F0) * Fc;      // rough-surface Fresnel (Lazarov)

  // the temperature the eye sees
  float T = lava_kelvin(lava_uA.y + m.heat);
  T += lava_uCur.x * lava_currents(s.w, s.q, fp);
  T += 900. * clamp(L.stretch, -0.12, 0.12);
  float fresh = 1. - exp(-1.6 * max(L.energy, 0.));
  T += 150. * fresh + 90. * clamp(L.crest, -0.6, 1.);
  float skin = lava_uTone.z * (1. - 0.7 * fresh);
  float Tseen = T - skin * (1. - exp(-lava_uTone.w / NoV));
  vec3 col = lava_planck(Tseen) * (1. - F);

  // what the skin mirrors: the sky, the mark, the monoliths (their cheap env shading), the sea itself
  vec3 rd = reflect(r.rd, n);
  float up = dot(rd, s.up);
  if (up < 0.002) rd = normalize(rd + s.up * (0.002 - up));
  // the reflected cone: the pixel's own, widened by the skin's roughness (sqrt(a2) ~ the lobe's half-angle), so point
  // lights (stars) in the sky are averaged over it instead of glinting as specks
  Ray rr; rr.ro = s.p + s.up * 0.02; rr.rd = rd; rr.pa = r.pa / s.graz + sqrt(a2); rr.depth = 1;
  col += world_env(rr) * F * lava_uLook.w;

  // the sun as a light: GGX widened by the unresolved slopes and the sun's own disc (a glitter path, never a dot)
  vec3 Ls = uSunDir;
  vec3 H = normalize(Ls + v);
  float NoH = max(dot(n, H), 0.), NoL = max(dot(n, Ls), 0.);
  float as2 = a2 + uSunRad * uSunRad * 0.5;
  float D = as2 / (PI * pow(NoH * NoH * (as2 - 1.) + 1., 2.));
  float k = sqrt(as2) * 0.5;
  float Vis = 0.25 / ((NoL * (1. - k) + k) * (NoV * (1. - k) + k));
  float Fs = F0 + (1. - F0) * pow(1. - max(dot(v, H), 0.), 5.);
  // irradiance from the sun: its disc radiance times its solid angle
  col += lava_uSunL * (lava_uLook.z * D * Vis * Fs * NoL * PI * uSunRad * uSunRad);
  return col + m.emit;
}

/** The sea in reflections (the mark, the monoliths): its glow at the mean temperature through the skin; no waves. */
vec3 lava_env(Ray r, Sea s) {
  float NoV = s.graz;
  float F = lava_uLook.y + (1. - lava_uLook.y) * pow(1. - NoV, 5.);
  float T = lava_kelvin(lava_uA.y) - lava_uTone.z * (1. - exp(-lava_uTone.w / NoV));
  return lava_planck(T) * (1. - F);
}
