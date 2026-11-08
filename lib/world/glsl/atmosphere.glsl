// look: the atmosphere (shared by the scene pass and look's own LUT passes, so it depends on nothing in the prelude).
//
// A thin, physically based atmosphere (Hillaire 2020, "A Scalable and Production Ready Sky and Atmosphere Rendering
// Technique"; Bruneton 2017): a transmittance LUT and a multiple-scattering LUT made once, a sky-view LUT made every
// frame at the camera, and a per-pixel march (samples crowded at the ray's closest approach to the planet) for views
// from high up. Dense at the bottom, thin above: the zenith stays dark enough for stars at dusk while the long
// horizontal path at the horizon turns deep orange; from orbit the air is a thin line of light on the limb.
//
// Units: "air km". The world's units are scaled by look_uK (world units per air km, R / 2000), so the planet is 2000
// air km in radius and the air 40 km deep whatever the world's R. Radiance is relative to a sun illuminance of 1.
#ifndef LOOK_ATMO
#define LOOK_ATMO

uniform sampler2D look_uTrans;   // 256 x 64
uniform sampler2D look_uMS;      // 32 x 32
uniform sampler2D look_uSkyLUT;  // 192 x 108, every frame, at the camera
uniform float look_uK;           // world units per air km
uniform float look_uRg, look_uRt;
uniform vec3 look_uRayS; uniform float look_uRayH;
uniform vec3 look_uMieS; uniform vec3 look_uMieA; uniform float look_uMieH; uniform float look_uMieG;
uniform vec3 look_uOzA; uniform float look_uOzC; uniform float look_uOzW;
uniform vec3 look_uGroundAlb;
uniform vec3 look_uGroundGlow;   // mean radiance the night sea sends up (it lights its own air from below)
uniform vec3 look_uAirglow;      // emission of the thin night-limb layer (per air km)
uniform float look_uAirglowH;
uniform vec3 look_uSun;          // direction to the sun (world = air frame: same orientation)
uniform float look_uSunR;        // the sun's angular radius (rad)
uniform vec3 look_uSunE;         // sun illuminance colour above the air
uniform vec3 look_uCam;          // camera position in air km
uniform float look_uFwd;         // share of a sharp forward aerosol lobe (seen from orbit: the sunrise blaze on the limb)

const float LOOK_PI = 3.14159265359;

// ---- small shared helpers ----------------------------------------------------------------------------------------
float look_h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float look_h13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec3 look_h33(vec3 p3) { p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }
vec2 look_h22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float look_ign(vec2 px) { return fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715)))); }

// Blackbody radiance at three wavelengths (600/550/460 nm), relative to a 1500 K body's green = 1: colour AND
// brightness follow Planck's law, so cooler is darker as well as redder.
vec3 look_planck(float T) {
  const vec3 lam = vec3(600e-9, 550e-9, 460e-9);
  const float c2 = 1.4388e-2;
  vec3 l5 = lam * lam * lam * lam * lam;
  vec3 b = 1.0 / (l5 * (exp(c2 / (lam * max(T, 300.0))) - 1.0));
  float g5 = 550e-9 * 550e-9 * 550e-9 * 550e-9 * 550e-9;
  vec3 rgb = b * (g5 * (exp(c2 / (550e-9 * 1500.0)) - 1.0));
  return mix(rgb, vec3(dot(rgb, vec3(0.3333))), 0.12);
}
vec3 look_bbColor(float T) { vec3 c = look_planck(T); return c / max(1e-6, dot(c, vec3(0.2126, 0.7152, 0.0722))); }

vec2 look_sphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float lr = length(ro);
  float c = (lr - r) * (lr + r);
  float d = b * b - c;
  if (d < 0.0) return vec2(-1.0);
  d = sqrt(d);
  return vec2(-b - d, -b + d);
}

// ---- the medium ------------------------------------------------------------------------------------------------------
void look_medium(float h, out vec3 scR, out vec3 scM, out vec3 ext) {
  h = max(h, 0.0);
  float dR = exp(-h / look_uRayH), dM = exp(-h / look_uMieH);
  float dO = max(0.0, 1.0 - abs(h - look_uOzC) / look_uOzW);
  scR = look_uRayS * dR;
  scM = look_uMieS * dM;
  ext = scR + (look_uMieS + look_uMieA) * dM + look_uOzA * dO;
}
float look_phaseR(float c) { return 3.0 / (16.0 * LOOK_PI) * (1.0 + c * c); }
float look_phaseM(float c, float g) {
  float g2 = g * g;
  return 3.0 / (8.0 * LOOK_PI) * (1.0 - g2) / (2.0 + g2) * (1.0 + c * c) / pow(max(1e-4, 1.0 + g2 - 2.0 * g * c), 1.5);
}

// ---- transmittance LUT ---------------------------------------------------------------------------------------------
vec2 look_transUV(float r, float mu) {
  float H = sqrt(max(0.0, look_uRt * look_uRt - look_uRg * look_uRg));
  float rho = sqrt(max(0.0, r * r - look_uRg * look_uRg));
  float d = max(0.0, -r * mu + sqrt(max(0.0, r * r * (mu * mu - 1.0) + look_uRt * look_uRt)));
  float dmin = look_uRt - r, dmax = rho + H;
  float xm = (d - dmin) / max(1e-6, dmax - dmin), xr = rho / H;
  return vec2(0.5 / 256.0 + xm * (255.0 / 256.0), 0.5 / 64.0 + xr * (63.0 / 64.0));
}
vec3 look_T(float r, float mu) { return texture(look_uTrans, look_transUV(min(r, look_uRt), mu)).rgb; }

// fraction of the (large) sun's disc above the horizon seen from radius r
float look_sunVis(float r, float mu) {
  float horizonZen = LOOK_PI - asin(clamp(look_uRg / max(r, look_uRg + 1e-4), 0.0, 1.0));
  return smoothstep(-look_uSunR, look_uSunR, horizonZen - acos(clamp(mu, -1.0, 1.0)));
}
// transmittance from p (air km) to the sun, with the planet's soft shadow
vec3 look_sunT(vec3 p) {
  float r = length(p);
  float mu = dot(p / r, look_uSun);
  return look_T(max(r, look_uRg), mu) * look_sunVis(r, mu);
}
vec3 look_msL(float r, float mu) {
  float xr = clamp((r - look_uRg) / (look_uRt - look_uRg), 0.0, 1.0);
  return texture(look_uMS, vec2(0.5 / 32.0, 0.5 / 32.0) + vec2(mu * 0.5 + 0.5, xr) * (31.0 / 32.0)).rgb;
}

// transmittance along a straight segment a -> b inside the air (Bruneton: ratio of two to-the-top transmittances; a
// segment heading down uses the reversed rays so the ratio never divides through the planet)
vec3 look_Tseg(vec3 a, vec3 b) {
  vec3 d = b - a;
  float L = length(d);
  if (L < 1e-5) return vec3(1.0);
  d /= L;
  float ra = length(a), rb = length(b);
  float ma = dot(a, d) / ra, mb = dot(b, d) / rb;
  vec3 t;
  if (ma < 0.0 && mb < 0.0) t = look_T(max(rb, look_uRg), -mb) / max(look_T(max(ra, look_uRg), -ma), vec3(1e-6));
  else t = look_T(max(ra, look_uRg), ma) / max(look_T(max(rb, look_uRg), mb), vec3(1e-6));
  return clamp(t, 0.0, 1.0);
}

// ---- the march -----------------------------------------------------------------------------------------------------
void look_march(vec3 ro, vec3 rd, float tMax, int steps, float jitter, out vec3 L, out vec3 T) {
  L = vec3(0.0); T = vec3(1.0);
  vec2 ta = look_sphere(ro, rd, look_uRt);
  if (ta.y <= 0.0) return;
  float t0 = max(ta.x, 0.0), t1 = ta.y;
  vec2 tg = look_sphere(ro, rd, look_uRg);
  if (tg.x > 0.0) t1 = min(t1, tg.x);
  t1 = min(t1, tMax);
  if (t1 <= t0) return;
  float cosT = dot(rd, look_uSun);
  float pR = look_phaseR(cosT), pM = mix(look_phaseM(cosT, look_uMieG), look_phaseM(cosT, 0.985), look_uFwd);
  float fn = float(steps);
  // samples crowd at the ray's closest approach to the planet: the middle of a limb chord seen from space, the ground
  // end of a ray into the sea, the camera's end of a ray going up
  float tc = clamp(-dot(ro, rd), t0, t1);
  float tPrev = t0;
  vec3 glow = look_uGroundGlow * 0.5;
  for (int i = 0; i < 48; i++) {
    if (i >= steps) break;
    float sN = (float(i) + 1.0) / fn;
    float a = 1.0 - 2.0 * sN, b = 2.0 * sN - 1.0;
    float tN = sN < 0.5 ? tc - (tc - t0) * a * a : tc + (t1 - tc) * b * b;
    if (i == steps - 1) tN = t1;
    float dt = tN - tPrev;
    vec3 p = ro + rd * (tPrev + dt * jitter);
    tPrev = tN;
    float r = length(p);
    float muS = dot(p / r, look_uSun);
    vec3 scR, scM, ext;
    look_medium(r - look_uRg, scR, scM, ext);
    vec3 Ts = look_T(max(r, look_uRg), muS) * look_sunVis(r, muS);
    vec3 sc = scR + scM;
    vec3 S = look_uSunE * (Ts * (scR * pR + scM * pM) + look_msL(r, muS) * sc) + glow * sc;
    float ag = (r - look_uRg - look_uAirglowH) / (look_uAirglowH * 0.18);
    S += look_uAirglow * exp(-ag * ag);
    vec3 Tst = exp(-ext * dt);
    L += T * (S - S * Tst) / max(ext, vec3(1e-7));
    T *= Tst;
  }
}

// ---- sky-view LUT mapping (Hillaire): u = azimuth from the sun (folded, sqrt), v = elevation, dense at the horizon --
float look_horizonEl(float r) { return -acos(clamp(sqrt(max(0.0, r * r - look_uRg * look_uRg)) / r, -1.0, 1.0)); }
vec2 look_skyUV(vec3 rd) {
  float r = length(look_uCam);
  vec3 up = look_uCam / r;
  float hz = look_horizonEl(r);
  float l = asin(clamp(dot(rd, up), -1.0, 1.0)) - hz;
  float v = l >= 0.0 ? 0.5 + 0.5 * sqrt(l / (LOOK_PI * 0.5 - hz)) : 0.5 - 0.5 * sqrt(-l / (LOOK_PI * 0.5 + hz));
  vec3 sH = look_uSun - up * dot(look_uSun, up), rH = rd - up * dot(rd, up);
  float ls = length(sH), lr = length(rH);
  float c = (ls > 1e-5 && lr > 1e-5) ? dot(sH / ls, rH / lr) : 1.0;
  return vec2(sqrt(acos(clamp(c, -1.0, 1.0)) / LOOK_PI), v);
}
vec3 look_skyDir(vec2 uv) {
  float r = length(look_uCam);
  vec3 up = look_uCam / r;
  float hz = look_horizonEl(r), el;
  if (uv.y >= 0.5) { float k = (uv.y - 0.5) * 2.0; el = hz + k * k * (LOOK_PI * 0.5 - hz); }
  else { float k = (0.5 - uv.y) * 2.0; el = hz - k * k * (LOOK_PI * 0.5 + hz); }
  float az = uv.x * uv.x * LOOK_PI;
  vec3 sH = look_uSun - up * dot(look_uSun, up);
  vec3 ex = length(sH) > 1e-5 ? normalize(sH) : normalize(cross(up, abs(up.x) < 0.9 ? vec3(1, 0, 0) : vec3(0, 1, 0)));
  vec3 ey = cross(up, ex);
  return normalize(up * sin(el) + (ex * cos(az) + ey * sin(az)) * cos(el));
}
vec3 look_skyView(vec3 rd) { return texture(look_uSkyLUT, look_skyUV(rd)).rgb; }

#endif
