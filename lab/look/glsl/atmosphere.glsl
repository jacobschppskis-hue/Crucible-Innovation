// Atmosphere: a thin, physically based atmosphere around the molten planet (Hillaire 2020, "A Scalable and Production
// Ready Sky and Atmosphere Rendering Technique": transmittance LUT, multiple-scattering LUT, sky-view LUT, per-pixel march
// for views from space). Units: km. Radiance is relative to a sun illuminance of 1 (uSunE scales it).
//
// Uniforms (set by look.ts):
//   uRg, uRt         ground and top-of-atmosphere radius
//   uRayS, uRayH     Rayleigh scattering at sea level (1/km) and its scale height
//   uMieS, uMieA     Mie scattering / absorption at sea level, uMieH scale height, uMieG anisotropy
//   uOzA, uOzC, uOzW ozone-like absorption: a tent centred at height uOzC of half-width uOzW
//   uGroundAlb       mean ground albedo (black sand and dark sea) for the multiple-scattering bounce
//   uGroundGlow      mean emitted radiance of the night side (molten sea glow lighting its own air from below)
//   uSunDir, uSunR   direction to the sun, its angular radius (rad)
//   uSunE            sun illuminance colour (linear RGB, the light's colour above the air)

#ifndef ATMO_GLSL
#define ATMO_GLSL

uniform sampler2D uTransLUT; // 256 x 64
uniform sampler2D uMSLUT;    // 32 x 32
uniform sampler2D uSkyLUT;   // 200 x 120, per frame, at the camera
uniform float uRg, uRt;
uniform vec3 uRayS; uniform float uRayH;
uniform vec3 uMieS; uniform vec3 uMieA; uniform float uMieH; uniform float uMieG;
uniform vec3 uOzA; uniform float uOzC; uniform float uOzW;
uniform vec3 uGroundAlb;
uniform vec3 uGroundGlow;
uniform vec3 uAirglow;      // emitted radiance per km of a thin layer at uAirglowH (faint, cold: the night limb's line)
uniform float uAirglowH;
uniform vec3 uSunDir; uniform float uSunR; uniform vec3 uSunE;

const float A_PI = 3.14159265359;

vec2 a_sphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float lr = length(ro);
  float c = (lr - r) * (lr + r); // stable near the surface
  float d = b * b - c;
  if (d < 0.0) return vec2(-1.0);
  d = sqrt(d);
  return vec2(-b - d, -b + d);
}

// --- medium -----------------------------------------------------------------------------------------------------
void a_medium(float h, out vec3 scR, out vec3 scM, out vec3 ext) {
  h = max(h, 0.0);
  float dR = exp(-h / uRayH);
  float dM = exp(-h / uMieH);
  float dO = max(0.0, 1.0 - abs(h - uOzC) / uOzW);
  scR = uRayS * dR;
  scM = uMieS * dM;
  ext = scR + (uMieS + uMieA) * dM + uOzA * dO;
}

float a_phaseR(float c) { return 3.0 / (16.0 * A_PI) * (1.0 + c * c); }
// Cornette-Shanks
float a_phaseM(float c, float g) {
  float g2 = g * g;
  float k = 3.0 / (8.0 * A_PI) * (1.0 - g2) / (2.0 + g2);
  return k * (1.0 + c * c) / pow(max(1e-4, 1.0 + g2 - 2.0 * g * c), 1.5);
}

// --- transmittance LUT parametrisation (Bruneton 2017) ------------------------------------------------------------
vec2 a_transUV(float r, float mu) {
  float H = sqrt(max(0.0, uRt * uRt - uRg * uRg));
  float rho = sqrt(max(0.0, r * r - uRg * uRg));
  float disc = r * r * (mu * mu - 1.0) + uRt * uRt;
  float d = max(0.0, -r * mu + sqrt(max(0.0, disc)));
  float dmin = uRt - r, dmax = rho + H;
  float xm = (d - dmin) / max(1e-6, dmax - dmin);
  float xr = rho / H;
  // half-texel remap (256 x 64)
  return vec2(0.5 / 256.0 + xm * (255.0 / 256.0), 0.5 / 64.0 + xr * (63.0 / 64.0));
}

void a_transParams(vec2 uv, out float r, out float mu) {
  float xm = (uv.x - 0.5 / 256.0) * (256.0 / 255.0);
  float xr = (uv.y - 0.5 / 64.0) * (64.0 / 63.0);
  float H = sqrt(max(0.0, uRt * uRt - uRg * uRg));
  float rho = H * clamp(xr, 0.0, 1.0);
  r = sqrt(rho * rho + uRg * uRg);
  float dmin = uRt - r, dmax = rho + H;
  float d = dmin + clamp(xm, 0.0, 1.0) * (dmax - dmin);
  mu = d == 0.0 ? 1.0 : (H * H - rho * rho - d * d) / (2.0 * r * d);
  mu = clamp(mu, -1.0, 1.0);
}

vec3 a_trans(float r, float mu) { return texture(uTransLUT, a_transUV(r, mu)).rgb; }

// Soft planet shadow for a large sun: the fraction of the sun's disc above the horizon seen from radius r.
float a_sunVis(float r, float mu) {
  float sh = clamp(uRg / max(r, uRg + 1e-4), 0.0, 1.0);
  float horizonZen = A_PI - asin(sh);          // zenith angle of the geometric horizon
  float sunZen = acos(clamp(mu, -1.0, 1.0));
  return smoothstep(-uSunR, uSunR, horizonZen - sunZen);
}

// Transmittance from point p to the sun, including the planet's soft shadow.
vec3 sunTrans(vec3 p) {
  float r = length(p);
  float mu = dot(p / r, uSunDir);
  return a_trans(max(r, uRg), mu) * a_sunVis(r, mu);
}

vec3 a_ms(float r, float mu) {
  float xr = clamp((r - uRg) / (uRt - uRg), 0.0, 1.0);
  vec2 uv = vec2(mu * 0.5 + 0.5, xr);
  uv = vec2(0.5 / 32.0, 0.5 / 32.0) + uv * (31.0 / 32.0);
  return texture(uMSLUT, uv).rgb;
}

// --- per-pixel march (views from high up, and aerial perspective) -------------------------------------------------
// Integrates in-scattered radiance and transmittance along ro + t rd for t in the atmosphere, up to tMax.
// jitter in [0,1) offsets the samples (pass 0.5 for none).
void atmoMarch(vec3 ro, vec3 rd, float tMax, int steps, float jitter, out vec3 L, out vec3 T) {
  L = vec3(0.0); T = vec3(1.0);
  vec2 ta = a_sphere(ro, rd, uRt);
  if (ta.y <= 0.0) return;
  float t0 = max(ta.x, 0.0), t1 = ta.y;
  vec2 tg = a_sphere(ro, rd, uRg);
  if (tg.x > 0.0) t1 = min(t1, tg.x);
  t1 = min(t1, tMax);
  if (t1 <= t0) return;
  float cosT = dot(rd, uSunDir);
  float pR = a_phaseR(cosT), pM = a_phaseM(cosT, uMieG);
  float fn = float(steps);
  // samples crowd around the ray's closest approach to the planet (where the air is densest along it): for a ray from
  // space through the limb that is the middle of the chord, for a ray into the ground it is the ground end, for a ray
  // from inside going up it is the camera's end
  float tc = clamp(-dot(ro, rd), t0, t1);
  float tPrev = t0;
  for (int i = 0; i < 64; i++) {
    if (i >= steps) break;
    float sN = (float(i) + 1.0) / fn;
    float tN = sN < 0.5 ? tc - (tc - t0) * (1.0 - 2.0 * sN) * (1.0 - 2.0 * sN) : tc + (t1 - tc) * (2.0 * sN - 1.0) * (2.0 * sN - 1.0);
    if (i == steps - 1) tN = t1;
    float dt = tN - tPrev;
    float t = tPrev + dt * jitter;
    tPrev = tN;
    vec3 p = ro + rd * t;
    float r = length(p);
    vec3 up = p / r;
    float muS = dot(up, uSunDir);
    vec3 scR, scM, ext;
    a_medium(r - uRg, scR, scM, ext);
    vec3 Ts = a_trans(max(r, uRg), muS) * a_sunVis(r, muS);
    vec3 ms = a_ms(r, muS);
    vec3 sc = scR + scM;
    // the night side's own glow, scattered isotropically by the air above it (fades with height through the density)
    vec3 glow = uGroundGlow * (1.0 / (4.0 * A_PI)) * 2.0 * A_PI;
    vec3 S = uSunE * (Ts * (scR * pR + scM * pM) + ms * sc) + glow * sc;
    float ag = (r - uRg - uAirglowH) / (uAirglowH * 0.18);
    S += uAirglow * exp(-ag * ag) * ext / max(ext, vec3(1e-7)); // emission, written as a source term
    vec3 Tstep = exp(-ext * dt);
    vec3 Sint = (S - S * Tstep) / max(ext, vec3(1e-7));
    L += T * Sint;
    T *= Tstep;
  }
}

// --- sky-view LUT (at the camera) ------------------------------------------------------------------------------------
// u: azimuth around the local up, relative to the sun's azimuth (0 = toward the sun), folded (symmetric);
// v: elevation, non-linear around the horizon (Hillaire): more texels near the horizon.
uniform vec3 uCamPos;
vec2 a_skyUV(vec3 rd) {
  float r = length(uCamPos);
  vec3 up = uCamPos / r;
  float horizon = -acos(clamp(sqrt(max(0.0, r * r - uRg * uRg)) / r, -1.0, 1.0)); // elevation of the horizon (<= 0)
  float el = asin(clamp(dot(rd, up), -1.0, 1.0));
  float l = el - horizon;
  float v;
  if (l >= 0.0) v = 0.5 + 0.5 * sqrt(l / (A_PI * 0.5 - horizon));
  else v = 0.5 - 0.5 * sqrt(-l / (A_PI * 0.5 + horizon));
  vec3 sunH = uSunDir - up * dot(uSunDir, up);
  vec3 rdH = rd - up * dot(rd, up);
  float lsH = length(sunH), lrH = length(rdH);
  float c = (lsH > 1e-5 && lrH > 1e-5) ? dot(sunH / lsH, rdH / lrH) : 1.0;
  float u = acos(clamp(c, -1.0, 1.0)) / A_PI; // 0 toward the sun, 1 away
  u = sqrt(u); // more texels toward the sun, where Mie peaks
  return vec2(u, v);
}

vec3 a_skyDir(vec2 uv) {
  // inverse of a_skyUV in the camera's local frame where the sun's azimuth is +x
  float r = length(uCamPos);
  vec3 up = uCamPos / r;
  float horizon = -acos(clamp(sqrt(max(0.0, r * r - uRg * uRg)) / r, -1.0, 1.0));
  float el;
  if (uv.y >= 0.5) { float k = (uv.y - 0.5) * 2.0; el = horizon + k * k * (A_PI * 0.5 - horizon); }
  else { float k = (0.5 - uv.y) * 2.0; el = horizon - k * k * (A_PI * 0.5 + horizon); }
  float az = uv.x * uv.x * A_PI;
  vec3 sunH = uSunDir - up * dot(uSunDir, up);
  vec3 ex = length(sunH) > 1e-5 ? normalize(sunH) : normalize(cross(up, abs(up.x) < 0.9 ? vec3(1, 0, 0) : vec3(0, 1, 0)));
  vec3 ey = cross(up, ex);
  return normalize(up * sin(el) + (ex * cos(az) + ey * sin(az)) * cos(el));
}

// In-scattered sky radiance seen from the camera along rd (no sun disc, no surfaces). The LUT already includes the
// limb, the horizon glow and the planet shadow.
vec3 skyView(vec3 rd) { return texture(uSkyLUT, a_skyUV(rd)).rgb; }

#endif
