// look (post pass): the point stars, drawn at the canvas's own resolution.
//
// In the scene pass a star was a gaussian half a render pixel wide, sampled once per render pixel: an iPhone renders
// ~1.1 render px per CSS px and shows them on a 3x screen, so each star became a soft, roughly square blob (the
// Catmull-Rom upscale rings around a single bright pixel) that blinked as the camera moved it across pixel centres:
// Jacob's "flashing dull yellow squares" in the sky. Here each star is integrated exactly over each canvas pixel
// (a gaussian's share of the pixel's box), so it is a sharp point that keeps its brightness however it moves.
//
// The field is the scene's own (sky.glsl look_starLayer: the same hashes, cells, densities and fluxes), so the stars the
// sea mirrors (still drawn by the scene pass) stand where these are. Only the points move here: the Milky Way's diffuse
// glow is smooth, so the scene keeps it (sky.glsl look_starBand). The scene pass hands over which pixels are sky and the
// air's transmittance along them in its alpha (compose.ts: 60000 + 4000 T on the sky, T in green; the other channels
// follow from the air's extinction ratios, look.ts); a pixel that is not sky, or that the scene-drawn mark covers, gets
// no stars. With no float render targets (WORLD_LDR), and under software GL (look.ts), the scene keeps drawing its own.

uniform mat3 uCam;              // columns: right, up, forward
uniform float uFocal;           // focal length in render px
uniform float look_uStarGainPost; // 0: off (the scene draws the stars)
uniform float look_uStarTint;   // 0..1: how much of the star's blackbody colour shows (white-ish points: ~0.3)
uniform float look_uStarSigma;  // the star's point spread, canvas px
uniform vec3 look_uStarTRatio;  // the air's extinction per channel over green's (T_c = T_g ^ ratio_c)
uniform float uExposure;        // stops: the scene applies it to everything, so the stars take it too

const float STARS_PI = 3.14159265359;
const vec3 STARS_GAL_N = vec3(0.2665, 0.8489, -0.4562);

// the scene's hashes (atmosphere.glsl look_h11 / look_h33 / look_h22), copied exactly: the same field
float stars_h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
vec3 stars_h33(vec3 p3) { p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }
vec2 stars_h22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }

// atmosphere.glsl look_planck / look_bbColor
vec3 stars_bbColor(float T) {
  const vec3 lam = vec3(600e-9, 550e-9, 460e-9);
  const float c2 = 1.4388e-2;
  vec3 l5 = lam * lam * lam * lam * lam;
  vec3 b = 1.0 / (l5 * (exp(c2 / (lam * max(T, 300.0))) - 1.0));
  float g5 = 550e-9 * 550e-9 * 550e-9 * 550e-9 * 550e-9;
  vec3 rgb = b * (g5 * (exp(c2 / (550e-9 * 1500.0)) - 1.0));
  rgb = mix(rgb, vec3(dot(rgb, vec3(0.3333))), 0.12);
  return rgb / max(1e-6, dot(rgb, vec3(0.2126, 0.7152, 0.0722)));
}

// sky.glsl look_face / look_faceDir / look_band
float stars_face(vec3 d, out vec2 w) {
  vec3 a = abs(d);
  vec2 uv; float f;
  if (a.x >= a.y && a.x >= a.z) { uv = d.zy / a.x * vec2(-sign(d.x), 1.0); f = d.x > 0.0 ? 0.0 : 1.0; }
  else if (a.y >= a.z) { uv = d.xz / a.y * vec2(1.0, -sign(d.y)); f = d.y > 0.0 ? 2.0 : 3.0; }
  else { uv = d.xy / a.z * vec2(sign(d.z), 1.0); f = d.z > 0.0 ? 4.0 : 5.0; }
  w = atan(uv) * (4.0 / STARS_PI);
  return f;
}
vec3 stars_faceDir(float f, vec2 w) {
  vec2 uv = tan(w * (STARS_PI / 4.0));
  vec3 d;
  if (f < 0.5) d = vec3(1.0, uv.y, -uv.x);
  else if (f < 1.5) d = vec3(-1.0, uv.y, uv.x);
  else if (f < 2.5) d = vec3(uv.x, 1.0, -uv.y);
  else if (f < 3.5) d = vec3(uv.x, -1.0, uv.y);
  else if (f < 4.5) d = vec3(uv.x, uv.y, 1.0);
  else d = vec3(-uv.x, uv.y, -1.0);
  return normalize(d);
}
float stars_band(vec3 d) { float z = dot(d, STARS_GAL_N); return exp(-z * z / 0.018); }

// erf (Abramowitz-Stegun style, max error ~1e-4) and a gaussian's share of the pixel [-0.5, 0.5] at offset x
float stars_erf(float x) {
  float x2 = x * x;
  return sign(x) * sqrt(1.0 - exp(-x2 * (1.2732395 + 0.147 * x2) / (1.0 + 0.147 * x2)));
}
float stars_box(float x, float s) {
  float k = 0.70710678 / s;
  return 0.5 * (stars_erf((x + 0.5) * k) - stars_erf((x - 0.5) * k));
}

// one layer of the field (sky.glsl look_starLayer): the star in this pixel's cell, integrated over the pixel. The face
// `f`, its equi-angular coordinates `w` and the galactic band come from the caller (once per pixel); `scr` is the pixel
// centre and `focal` the focal length, both canvas px; `reach` bounds how far (in face coordinates) a star can be and
// still touch this pixel. Returns the star's flux on this pixel.
vec3 stars_layer(float f, vec2 w, float band, vec2 scr, float focal, float reach, float n, float p, float fmin, float fmax, float seed, float boost) {
  vec2 q = (w * 0.5 + 0.5) * n;
  vec2 cell = floor(q);
  vec3 hs = stars_h33(vec3(cell, f * 17.0 + seed));
  if (hs.x > p * (1.0 + boost * band)) return vec3(0.0);
  vec2 sp = cell + 0.22 + 0.56 * stars_h22(cell + f * 31.7 + seed * 7.0);
  // cheap and conservative: a star more than the pixel window away in face coordinates can't reach this pixel (the
  // angle is at least 0.707 * pi/4 * |dw| on an equi-angular face, the screen distance at least focal * angle)
  if (max(abs(q.x - sp.x), abs(q.y - sp.y)) > reach * n) return vec3(0.0);
  vec3 cs = transpose(uCam) * stars_faceDir(f, sp / n * 2.0 - 1.0); // camera space: x right, y up, z forward
  if (cs.z <= 1e-4) return vec3(0.0);
  vec2 off = cs.xy / cs.z * focal - scr; // from this pixel's centre to the star, canvas px
  float s = look_uStarSigma;
  if (max(abs(off.x), abs(off.y)) > 0.5 + 4.0 * s) return vec3(0.0);
  float F = min(fmin * pow(max(stars_h11(hs.y * 91.7 + seed), 1e-4), -0.6667), fmax);
  float tq = stars_h11(hs.z * 53.1 + seed);
  float T = tq < 0.12 ? mix(3100.0, 4200.0, tq / 0.12) : tq < 0.86 ? mix(4400.0, 7600.0, (tq - 0.12) / 0.74) : mix(8500.0, 22000.0, (tq - 0.86) / 0.14);
  vec3 tint = look_uStarTint > 0.0 ? mix(vec3(1.0), stars_bbColor(T), look_uStarTint) : vec3(1.0);
  return tint * F * stars_box(off.x, s) * stars_box(off.y, s);
}

/** The point stars on this canvas pixel (linear HDR radiance, the scene's units, exposed), 0 where the scene is not sky. */
vec3 look_postStars(vec2 fc) {
  if (look_uStarGainPost <= 0.0) return vec3(0.0);
  vec2 sres = vec2(textureSize(uScene, 0));
  float a = texelFetch(uScene, ivec2(fc * sres / uCanvas), 0).a;
  if (a < 59999.0) return vec3(0.0); // not sky (or no float targets: alpha is 1)
  float Tg = clamp((a - 60000.0) / 4000.0, 0.0, 1.0); // the air's transmittance in green along this ray
  if (Tg < 0.002) return vec3(0.0);
  float focal = uFocal * uCanvas.y / sres.y;
  vec2 scr = fc - 0.5 * uCanvas;
  vec3 d = normalize(uCam * vec3(scr / focal, 1.0));
  vec2 w;
  float f = stars_face(d, w);
  float band = stars_band(d);
  float reach = (0.5 + 4.0 * look_uStarSigma) / (STARS_PI * 0.25 * focal); // per cell of a 1-cell face, see stars_layer
  vec3 c = stars_layer(f, w, band, scr, focal, reach, 128.0, 0.16, 1.2e-8, 6.0e-7, 1.0, 1.8);
  c += stars_layer(f, w, band, scr, focal, reach, 52.0, 0.22, 4.0e-8, 9.0e-7, 2.0, 0.8);
  c += stars_layer(f, w, band, scr, focal, reach, 18.0, 0.3, 1.5e-7, 3.0e-6, 3.0, 0.3);
  // the air reddens them low down (the scene hands over green only), flux over the pixel's solid angle = radiance
  vec3 Tair = pow(vec3(Tg), look_uStarTRatio);
  return c * Tair * (look_uStarGainPost * focal * focal * exp2(uExposure));
}
