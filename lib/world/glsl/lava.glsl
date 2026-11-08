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
// One material with look's planet: the base temperature is look_seaTemp (its currents, wound like sea-surface-
// temperature maps), the glow look_planck x look_uLavaGain, the sun's light look_sunLight (reddened by the air), and the
// near sea hands over to look_planetFar by footprint (look_farMix). SeaMod.heat: +850 K per unit (lava's 0..1 scale;
// the thesis' 1811 K is about +0.7 on the base sea).
//
// Units: world units ~ metres at the low swoops; the surface coords s.w (u across, v along) are where the waves live.
// Wave vectors are quantised so the sea is seamless round the lap (v wraps at +-PI R).

#define LAVA_NW 24
uniform vec4 lava_uSw[LAVA_NW];   // swell: k (u, v components, rad/unit), amplitude (units), phase now (rad, wrapped)
uniform vec4 lava_uA;             // x swell gain, y heat (0..1), z interaction gain (0 far .. 1 close), w currents time (s)
uniform vec4 lava_uTone;          // x heat offset (K), y unused, z skin dT (K), w skin depth (1/cos units)
uniform vec4 lava_uLook;          // x base roughness (alpha^2), y F0, z sun glint gain, w env (reflection) gain
// the wake: N samples of the pointers' recent paths, three texels each (see wake.ts): (u, v, A, R), (e.u, e.v, W, sg),
// (sc, energy scale, 0, 0); A, R, W, sg in CSS px, sc = units per CSS px where the sample was laid
uniform sampler2D lava_uWake;
uniform int lava_uWN;
uniform vec4 lava_uWB;            // bounds of everything the wake can reach (u0, v0, u1, v1)
uniform vec4 lava_uRing[8];       // rings: u, v, radius, amplitude (units)
uniform vec4 lava_uRingW[2];      // ring widths (units), packed
uniform int lava_uRingN;

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
    // the pixel's box as a Gaussian, applied to this wave; cut well before Nyquist (pi per px): the glint is so non-linear
    // in slope that even a few % of a half-resolved wave shows as a crossed lattice in the glitter path
    float at = exp(-0.7 * dot(pp, pp));
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
  // far out, look's planet (currents, continents, shores); up close, this sea; the same temperature field in both
  float k = look_farMix(s);
  // look's far field at the same temperature offset as the near sea (the journey's 'lava.heat' and SeaMod.heat, both
  // 850 K per unit), so a place that cools the near sea (paypal's night side) cools the planet from orbit alike
  vec3 far = k > 0.001 ? look_planetFarT(r, s, lava_uTone.x + 850. * m.heat) + m.emit : vec3(0.);
  if (k >= 0.999) return far;
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
  float fpA = s.fw / look_uK;
  float land = look_land(s.q, fpA);
  float T = look_seaTemp(s.q, fpA, land) + lava_uTone.x + 850. * m.heat;
  T += 300. * clamp(L.stretch, -0.12, 0.12);         // (true Planck: +-36 K is already ~2x in brightness)
  float fresh = 1. - exp(-1.6 * max(L.energy, 0.));
  // the visitor's waves tear the skin open to the hot metal under it, whatever the place's own (cooled) temperature:
  // the stirred band glows at least ~1150 K, its crests ~1320 K (as hot as the monoliths' feet) (thin bright V lines; the troughs between them stay
  // the place's colour), so a wake reads on the darkest night sea and at every quality step
  float cw = clamp(L.crest * 1.4, 0., 1.);
  T = mix(T, max(T + 40., 1150.), fresh * 0.8);
  T = mix(T, max(T + 80., 1320.), cw);
  float skin = lava_uTone.z * (1. - 0.7 * max(fresh, cw));
  float Tseen = T - skin * (1. - exp(-lava_uTone.w / NoV));
  vec3 col = look_planck(Tseen) * look_uLavaGain * (1. - F);

  // what the skin mirrors: the sky, the mark, the monoliths (their cheap env shading), the sea itself. The reflected
  // cone is the pixel's own widened by the skin's roughness (sqrt(a2) ~ the lobe's half-angle), so point lights (stars)
  // are averaged over it, never glinting as specks
  vec3 rd = reflect(r.rd, n);
  float up = dot(rd, s.up);
  if (up < 0.002) rd = normalize(rd + s.up * (0.002 - up));
  Ray rr; rr.ro = s.p + s.up * 0.02; rr.rd = rd; rr.pa = r.pa / s.graz + sqrt(a2); rr.depth = 1;
  col += world_env(rr) * F * lava_uLook.w;

  // the sun as a light (look's, after the air): GGX widened by the unresolved slopes and the sun's own disc, so it is a
  // glitter path, never a dot
  vec3 Ls = uSunDir;
  vec3 H = normalize(Ls + v);
  float NoH = max(dot(n, H), 0.), NoL = max(dot(n, Ls), 0.);
  float as2 = a2 + uSunRad * uSunRad * 0.5;
  float D = as2 / (PI * pow(NoH * NoH * (as2 - 1.) + 1., 2.));
  float kk = sqrt(as2) * 0.5;
  float Vis = 0.25 / ((NoL * (1. - kk) + kk) * (NoV * (1. - kk) + kk));
  float Fs = F0 + (1. - F0) * pow(1. - max(dot(v, H), 0.), 5.);
  // glitter: the unresolved little facets of the swell each catch the sun or don't, so the glint path breaks into many
  // fine sparkles stretched toward the sun instead of a smooth smear. Each cell (a few pixels across, at every distance:
  // two octaves of the footprint, crossfaded) holds one small round glint at a random spot, or none; the factor's mean
  // is ~1, so the path's total light is unchanged. Anchored to the surface and drifting with the swell; only where the
  // slope is unresolved (L.var), so resolved waves keep their own clean highlights.
  float spk = 1.;
  float unres = smoothstep(0.0002, 0.003, L.var);
  if (unres > 0.001 && lava_uLook.z > 0.) {
    vec2 sv = normalize(vec2(dot(uSunDir, s.eU), dot(uSunDir, s.eV)) + 1e-5);
    vec2 drift = sv * lava_uA.w * 0.4 + vec2(-sv.y, sv.x) * lava_uA.w * 0.13;
    // stretch toward the sun: glints elongate along the reflection path
    vec2 sw = s.w + drift;
    vec2 gp0 = vec2(dot(sw, vec2(-sv.y, sv.x)), dot(sw, sv) * 0.4);
    float lvl = log2(max(fp * 5., 1e-4) / 0.05);
    float l0 = floor(lvl), fr = lvl - l0;
    float g = 0.;
    for (int o = 0; o < 2; o++) {
      float L = l0 + float(o);
      float cell = 0.05 * exp2(L);
      vec2 gp = gp0 / cell;
      vec2 ic = floor(gp), f = fract(gp);
      vec3 h = world_hash33(vec3(ic, L * 7.13));
      vec2 d = f - (0.25 + 0.5 * h.xy);
      float on = step(0.45, h.z) * (0.4 + 1.2 * (h.z - 0.45) / 0.55);
      // a Gaussian dot, sigma 0.15 cell; mean over the cell = 2 pi s^2 x P(on) x mean(on) ~ 0.141 x 0.55 x 1.0
      float gl = exp(-dot(d, d) / (2. * 0.15 * 0.15)) * on / 0.078;
      g += gl * (o == 0 ? 1. - fr : fr);
    }
    spk = mix(1., 0.3 + 0.7 * g, unres);
  }
  col += look_sunLight(s.p) * (lava_uLook.z * D * Vis * Fs * NoL * spk);
  return mix(col + m.emit, far, k);
}

/** The sea in reflections (the mark, the monoliths): look's planet (glow, currents, sun) without the waves. */
vec3 lava_env(Ray r, Sea s) { return look_planetFar(r, s); }
