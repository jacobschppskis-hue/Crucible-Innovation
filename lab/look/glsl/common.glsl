// Shared helpers for the look modules: hashes, a physically scaled blackbody, value noise on 3D directions.
#ifndef LOOK_COMMON
#define LOOK_COMMON

float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec3 h33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}
vec2 h22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// Interleaved gradient noise (Jimenez): per-pixel jitter with good spectral properties.
float ign(vec2 px) { return fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715)))); }

// Blackbody spectral radiance sampled at three wavelengths (R 600, G 550, B 460 nm) and mapped to linear sRGB-ish
// primaries, relative to a 1500 K body's green channel = 1. Both colour AND intensity follow Planck's law, so a cooler
// region is darker as well as redder (the physical cue that keeps lava from looking painted).
vec3 planck3(float T) {
  const vec3 lam = vec3(600e-9, 550e-9, 460e-9);
  const float c2 = 1.4388e-2;
  vec3 l5 = lam * lam * lam * lam * lam;
  vec3 b = 1.0 / (l5 * (exp(c2 / (lam * max(T, 300.0))) - 1.0));
  // normalise to 1500 K, 550 nm
  float l5g = 550e-9 * 550e-9 * 550e-9 * 550e-9 * 550e-9;
  float ref = 1.0 / (l5g * (exp(c2 / (550e-9 * 1500.0)) - 1.0));
  vec3 rgb = b / ref;
  // the three samples overstate saturation for a broad spectrum: blend 12% toward their mean
  return mix(rgb, vec3(dot(rgb, vec3(0.3333))), 0.12);
}

// Chromaticity only (unit luminance): for stars and the sun, whose brightness is set separately.
vec3 bbColor(float T) {
  vec3 c = planck3(T);
  return c / max(1e-6, dot(c, vec3(0.2126, 0.7152, 0.0722)));
}

// Smooth value noise in 3D (quintic), and a rotated fbm, for low-frequency fields on the sphere.
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = h13(i), b = h13(i + vec3(1, 0, 0)), c = h13(i + vec3(0, 1, 0)), d = h13(i + vec3(1, 1, 0));
  float e = h13(i + vec3(0, 0, 1)), f1 = h13(i + vec3(1, 0, 1)), g = h13(i + vec3(0, 1, 1)), h = h13(i + vec3(1, 1, 1));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, f1, u.x), mix(g, h, u.x), u.y), u.z) * 2.0 - 1.0;
}

const mat3 ROT3 = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);

// fbm with octave count faded by a footprint (size of a pixel in the noise's units): octaves finer than the pixel fade
// out instead of aliasing.
float fbmF(vec3 p, int oct, float fp) {
  float s = 0.0, a = 0.5, w = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    float fade = clamp(1.5 - fp * w * 1.5, 0.0, 1.0); // fp * w = pixel size relative to this octave's wavelength
    s += a * vnoise(p) * fade;
    p = ROT3 * p * 2.03;
    a *= 0.5;
    w *= 2.03;
  }
  return s;
}

#endif
