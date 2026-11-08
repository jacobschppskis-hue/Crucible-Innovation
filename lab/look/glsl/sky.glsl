// The night sky behind the atmosphere: stars that read as real (a steep magnitude distribution, so a few bright ones
// and a dust of faint ones; blackbody colours mostly near white, a few warm and a few blue; every star an energy-
// conserving gaussian about one pixel wide, so it never twinkles, shimmers or grows blocky with resolution; no
// twinkle in vacuum) and a faint galactic band with dust lanes, made mostly of unresolved stars rather than a smear.
//
// uPixAng: angular size of one pixel (rad). uStarGain: overall brightness (exposure is set for the sun and the lava,
// so stars need their own gain). uSkyRot: world -> celestial frame (the sky turns slowly as we orbit).
#ifndef SKY_GLSL
#define SKY_GLSL

uniform float uPixAng;
uniform float uStarGain;
uniform mat3 uSkyRot;

// Direction -> (face, w) with w in [-1,1]^2 spread by angle (atan warp), so cells are close to equal in angle.
vec3 s_face(vec3 d, out vec2 w) {
  vec3 a = abs(d);
  vec2 uv; float f;
  if (a.x >= a.y && a.x >= a.z) { uv = d.zy / a.x * vec2(-sign(d.x), 1.0); f = d.x > 0.0 ? 0.0 : 1.0; }
  else if (a.y >= a.z) { uv = d.xz / a.y * vec2(1.0, -sign(d.y)); f = d.y > 0.0 ? 2.0 : 3.0; }
  else { uv = d.xy / a.z * vec2(sign(d.z), 1.0); f = d.z > 0.0 ? 4.0 : 5.0; }
  w = atan(uv) * (4.0 / 3.14159265);
  return vec3(f, 0, 0);
}

vec3 s_dir(float f, vec2 w) {
  vec2 uv = tan(w * (3.14159265 / 4.0));
  vec3 d;
  if (f < 0.5) d = vec3(1.0, uv.y, -uv.x);
  else if (f < 1.5) d = vec3(-1.0, uv.y, uv.x);
  else if (f < 2.5) d = vec3(uv.x, 1.0, -uv.y);
  else if (f < 3.5) d = vec3(uv.x, -1.0, uv.y);
  else if (f < 4.5) d = vec3(uv.x, uv.y, 1.0);
  else d = vec3(-uv.x, uv.y, -1.0);
  return normalize(d);
}

// the galactic plane in the celestial frame
const vec3 GAL_N = vec3(0.27, 0.86, -0.43);
const vec3 GAL_C = vec3(0.93, -0.12, 0.35); // direction of the bright centre (roughly in the plane)

float s_band(vec3 d) {
  float z = dot(d, normalize(GAL_N));
  return exp(-z * z / 0.018);
}

// One layer of stars in cells of `n` per face; p = chance of a star in a cell; fmin = faintest flux.
vec3 s_layer(vec3 d, float n, float p, float fmin, float fmax, float seed, float bandBoost) {
  vec2 w;
  float f = s_face(d, w).x;
  vec2 g = (w * 0.5 + 0.5) * n;
  vec2 cell = floor(g);
  vec3 hs = h33(vec3(cell, f * 17.0 + seed));
  float band = s_band(d);
  if (hs.x > p * (1.0 + bandBoost * band)) return vec3(0.0);
  // star position inside the central part of its cell, so its gaussian never crosses into a neighbour
  vec2 sp = cell + 0.22 + 0.56 * h22(cell + f * 31.7 + seed * 7.0);
  vec3 sd = s_dir(f, sp / n * 2.0 - 1.0);
  float ang = acos(clamp(dot(sd, d), -1.0, 1.0));
  float sig = max(uPixAng * 0.62, 1e-6);
  // flux: N(>F) ~ F^-1.5 (a uniform population in space): F = fmin u^(-2/3)
  float u = h11(hs.y * 91.7 + seed);
  float F = min(fmin * pow(max(u, 1e-4), -0.6667), fmax);
  // temperature: most stars are K/G/F (4500-7500 K), a few M (3200) and a few B/A (10000-20000)
  float tq = h11(hs.z * 53.1 + seed);
  float T = tq < 0.12 ? mix(3100.0, 4200.0, tq / 0.12) : tq < 0.86 ? mix(4400.0, 7600.0, (tq - 0.12) / 0.74) : mix(8500.0, 22000.0, (tq - 0.86) / 0.14);
  // cameras and eyes see star colour faintly: keep 55% of the chroma
  vec3 col = mix(vec3(1.0), bbColor(T), 0.55);
  float k = exp(-0.5 * ang * ang / (sig * sig)) / (6.2831853 * sig * sig);
  return col * F * k;
}

vec3 starsAndGalaxy(vec3 rdWorld) {
  vec3 d = uSkyRot * rdWorld;
  vec3 c = vec3(0.0);
  // flux units: solid-angle-integrated, so an unresolved star keeps its energy at every resolution
  c += s_layer(d, 128.0, 0.42, 2.0e-8, 1.2e-6, 1.0, 1.8);
  c += s_layer(d, 52.0, 0.55, 6.0e-8, 4.0e-6, 2.0, 0.8);
  c += s_layer(d, 18.0, 0.62, 3.0e-7, 1.6e-5, 3.0, 0.3);
  // galactic band: unresolved starlight with dust lanes; a brighter bulge toward GAL_C
  float band = s_band(d);
  if (band > 0.002) {
    vec3 q = d * 6.0;
    float clump = 0.55 + 0.45 * fbmF(q, 5, uPixAng * 6.0 * 4.0);
    float lane = smoothstep(0.05, 0.45, fbmF(q * 1.7 + 3.1, 5, uPixAng * 10.0 * 4.0) + 0.25);
    float zc = dot(d, normalize(GAL_N));
    float lane2 = 1.0 - 0.7 * exp(-zc * zc / 0.0016) * smoothstep(-0.1, 0.3, fbmF(q * 2.3 + 7.0, 4, uPixAng * 14.0 * 4.0));
    float bulge = 1.0 + 2.2 * pow(max(0.0, dot(d, GAL_C)), 6.0);
    vec3 tint = mix(vec3(0.86, 0.9, 1.0), vec3(1.0, 0.9, 0.76), smoothstep(0.2, 0.9, dot(d, GAL_C)));
    c += tint * 2.2e-5 * band * clump * lane * lane2 * bulge;
  }
  return c * uStarGain;
}

#endif
