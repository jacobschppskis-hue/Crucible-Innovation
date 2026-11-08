// look: the sky. Stars that read as real, a faint galactic band, the sun's disc, and the two functions the engine asks
// look for: look_sky (sky pixels and reflected sky) and look_atmo (aerial perspective over every primary pixel).
// Needs atmosphere.glsl and the engine prelude (Ray, Hit, ID_SKY, uTime).
//
// Stars: N(>F) ~ F^-1.5, so a few bright ones and a dust of faint ones; blackbody colours at ~55% of their chroma;
// each star an energy-conserving gaussian about one pixel wide, so it never twinkles (no air in the way), never
// shimmers as the camera turns and never turns blocky at a low render scale. The galaxy is unresolved light with dust
// lanes and more faint stars along it.

uniform float look_uStarGain;
uniform float look_uHighW;      // 0: the sky-view LUT (camera low), 1: the per-pixel march (camera high)
uniform int look_uSteps;        // march steps
uniform float look_uLimb;       // extra width of the orbital limb line (0..1, art direction)

// ---- noise (also used by planet.glsl) -------------------------------------------------------------------------------
float look_vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = look_h13(i), b = look_h13(i + vec3(1, 0, 0)), c = look_h13(i + vec3(0, 1, 0)), d = look_h13(i + vec3(1, 1, 0));
  float e = look_h13(i + vec3(0, 0, 1)), f1 = look_h13(i + vec3(1, 0, 1)), g = look_h13(i + vec3(0, 1, 1)), h = look_h13(i + vec3(1, 1, 1));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, f1, u.x), mix(g, h, u.x), u.y), u.z) * 2.0 - 1.0;
}
const mat3 LOOK_ROT = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
// fbm whose octaves fade out at the pixel footprint fp (in the noise's units) instead of aliasing; gain = amplitude
// ratio per octave (0.5 smooth, ~0.6 keeps contrast at fine scales)
float look_fbm(vec3 p, int oct, float fp, float gain) {
  float s = 0.0, a = 0.5, w = 1.0;
  for (int i = 0; i < 10; i++) {
    if (i >= oct) break;
    float fade = clamp(1.5 - fp * w * 1.5, 0.0, 1.0);
    if (fade <= 0.0) break;
    s += a * look_vnoise(p) * fade;
    p = LOOK_ROT * p * 2.03;
    a *= gain;
    w *= 2.03;
  }
  return s;
}

// ---- stars -----------------------------------------------------------------------------------------------------------
float look_face(vec3 d, out vec2 w) {
  vec3 a = abs(d);
  vec2 uv; float f;
  if (a.x >= a.y && a.x >= a.z) { uv = d.zy / a.x * vec2(-sign(d.x), 1.0); f = d.x > 0.0 ? 0.0 : 1.0; }
  else if (a.y >= a.z) { uv = d.xz / a.y * vec2(1.0, -sign(d.y)); f = d.y > 0.0 ? 2.0 : 3.0; }
  else { uv = d.xy / a.z * vec2(sign(d.z), 1.0); f = d.z > 0.0 ? 4.0 : 5.0; }
  w = atan(uv) * (4.0 / LOOK_PI);
  return f;
}
vec3 look_faceDir(float f, vec2 w) {
  vec2 uv = tan(w * (LOOK_PI / 4.0));
  vec3 d;
  if (f < 0.5) d = vec3(1.0, uv.y, -uv.x);
  else if (f < 1.5) d = vec3(-1.0, uv.y, uv.x);
  else if (f < 2.5) d = vec3(uv.x, 1.0, -uv.y);
  else if (f < 3.5) d = vec3(uv.x, -1.0, uv.y);
  else if (f < 4.5) d = vec3(uv.x, uv.y, 1.0);
  else d = vec3(-uv.x, uv.y, -1.0);
  return normalize(d);
}
const vec3 LOOK_GAL_N = vec3(0.2665, 0.8489, -0.4562);  // galactic pole (unit)
const vec3 LOOK_GAL_C = vec3(0.93, -0.12, 0.35);        // toward the bulge
float look_band(vec3 d) { float z = dot(d, LOOK_GAL_N); return exp(-z * z / 0.018); }

vec3 look_starLayer(vec3 d, float pa, float n, float p, float fmin, float fmax, float seed, float boost) {
  vec2 w;
  float f = look_face(d, w);
  vec2 cell = floor((w * 0.5 + 0.5) * n);
  vec3 hs = look_h33(vec3(cell, f * 17.0 + seed));
  if (hs.x > p * (1.0 + boost * look_band(d))) return vec3(0.0);
  vec2 sp = cell + 0.22 + 0.56 * look_h22(cell + f * 31.7 + seed * 7.0);
  vec3 sd = look_faceDir(f, sp / n * 2.0 - 1.0);
  float ang = acos(clamp(dot(sd, d), -1.0, 1.0));
  float sig = max(pa * 0.5, 1e-6); // a one-pixel point spread
  float F = min(fmin * pow(max(look_h11(hs.y * 91.7 + seed), 1e-4), -0.6667), fmax);
  float tq = look_h11(hs.z * 53.1 + seed);
  float T = tq < 0.12 ? mix(3100.0, 4200.0, tq / 0.12) : tq < 0.86 ? mix(4400.0, 7600.0, (tq - 0.12) / 0.74) : mix(8500.0, 22000.0, (tq - 0.86) / 0.14);
  return mix(vec3(1.0), look_bbColor(T), 0.55) * F * exp(-0.5 * ang * ang / (sig * sig)) / (6.2831853 * sig * sig);
}

vec3 look_stars(vec3 d, float pa) {
  vec3 c = look_starLayer(d, pa, 128.0, 0.16, 1.2e-8, 6.0e-7, 1.0, 1.8);
  c += look_starLayer(d, pa, 52.0, 0.22, 4.0e-8, 2.0e-6, 2.0, 0.8);
  c += look_starLayer(d, pa, 18.0, 0.3, 2.0e-7, 1.0e-5, 3.0, 0.3);
  float band = look_band(d);
  if (band > 0.002) {
    vec3 q = d * 6.0;
    float fp = pa * 24.0;
    float clump = 0.55 + 0.45 * look_fbm(q, 5, fp, 0.5);
    float lane = smoothstep(0.05, 0.45, look_fbm(q * 1.7 + 3.1, 5, fp * 1.7, 0.5) + 0.25);
    float zc = dot(d, LOOK_GAL_N);
    float lane2 = 1.0 - 0.7 * exp(-zc * zc / 0.0016) * smoothstep(-0.1, 0.3, look_fbm(q * 2.3 + 7.0, 4, fp * 2.3, 0.5));
    float bulge = 1.0 + 2.2 * pow(max(0.0, dot(d, LOOK_GAL_C)), 6.0);
    vec3 tint = mix(vec3(0.86, 0.9, 1.0), vec3(1.0, 0.9, 0.76), smoothstep(0.2, 0.9, dot(d, LOOK_GAL_C)));
    c += tint * 2.2e-5 * band * clump * lane * lane2 * bulge;
  }
  return c * look_uStarGain;
}

// ---- transmittance from a point along a ray to space (1 outside the air) --------------------------------------------
vec3 look_Tray(vec3 ro, vec3 rd) {
  vec2 ta = look_sphere(ro, rd, look_uRt);
  if (ta.y <= 0.0) return vec3(1.0);
  vec3 p0 = ro + rd * max(ta.x, 0.0);
  float r = length(p0);
  return look_T(r, dot(p0 / r, rd));
}

// cheap single + multiple scattering estimate of the sky seen from a point low in the air (reflections in the sea when
// the sky-view LUT, made at a high camera, does not apply)
vec3 look_skyCheap(vec3 ro, vec3 rd) {
  float lr = length(ro);
  float r = max(lr, look_uRg);
  vec3 up = ro / lr;
  float mu = dot(up, rd), muS = dot(up, look_uSun);
  float m = 1.0 / (max(mu, 0.0) + 0.1);
  vec3 Ts = look_T(r, muS) * look_sunVis(r, muS);
  float c = dot(rd, look_uSun);
  vec3 colR = look_uRayS * look_uRayH, colM = look_uMieS * look_uMieH;
  vec3 tau = (colR + (look_uMieS + look_uMieA) * look_uMieH) * m;
  vec3 tr = (1.0 - exp(-tau)) / max(tau, vec3(1e-5));
  vec3 single = Ts * (colR * look_phaseR(c) + colM * look_phaseM(c, look_uMieG)) * m * tr;
  vec3 multi = look_msL(r, muS) * (colR + colM) * m * tr;
  return look_uSunE * (single + multi);
}

vec3 look_sky(Ray r) {
  vec3 ro = r.ro / look_uK, rd = r.rd;
  vec3 L = vec3(0.0);
  float w = look_uHighW;
  if (r.depth == 0) {
    if (w < 1.0) L = look_skyView(rd) * (1.0 - w);
    if (w > 0.0) {
      vec3 Lm, Tm;
      look_march(ro, rd, 1e9, look_uSteps, look_ign(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0), Lm, Tm);
      L += Lm * w;
    }
  } else {
    L = w < 1.0 ? look_skyView(rd) * (1.0 - w) : vec3(0.0);
    if (w > 0.0) L += look_skyCheap(ro, rd) * w;
  }
  vec3 T = look_Tray(ro, rd);
  return L + T * (look_sunDisc(rd, r.pa) * look_uSunDisc + look_stars(rd, r.pa) * (r.depth == 0 ? 1.0 : 0.6));
}

vec3 look_atmo(vec3 col, Ray r, Hit h) {
  if (h.id == ID_SKY) return col;
  vec3 ro = r.ro / look_uK, rd = r.rd;
  float t = h.t / look_uK;
  vec3 p = ro + rd * t;
  float w = look_uHighW;
  vec3 L = vec3(0.0), T = vec3(1.0);
  if (w < 1.0) {
    // camera low: the sky-view LUT holds the in-scatter all the way along rd (to the sea or to space); a nearer hit
    // takes the share its own transmittance implies (the source is close to uniform along such short paths)
    vec3 Tl = look_Tseg(ro, p);
    vec2 tg = look_sphere(ro, rd, look_uRg);
    float tEnd = tg.x > 0.0 ? tg.x : max(look_sphere(ro, rd, look_uRt).y, t);
    vec3 Tf = look_Tseg(ro, ro + rd * max(tEnd, t));
    vec3 Ll = look_skyView(rd) * clamp((1.0 - Tl) / max(1.0 - Tf, vec3(1e-4)), 0.0, 1.0);
    L = Ll * (1.0 - w);
    T = mix(vec3(1.0), Tl, 1.0 - w);
  }
  if (w > 0.0) {
    vec3 Lm, Tm;
    look_march(ro, rd, t, look_uSteps, look_ign(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0), Lm, Tm);
    L += Lm * w;
    T *= mix(vec3(1.0), Tm, w);
  }
  return col * T + L;
}
