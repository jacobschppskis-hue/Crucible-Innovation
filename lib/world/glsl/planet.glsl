// look: the planet seen from far out. Smooth molten seas (glossy, water-like, glowing from within by blackbody
// temperature; no crust, no cracks, no specks) wound into currents the way sea-surface-temperature maps of real oceans
// look, between continents of black sand; a fine hot thread where the sea meets a shore; a clean terminator. Every
// field fades its octaves out at the pixel footprint, so detail keeps resolving as the camera comes down and never
// aliases as it climbs. Up close the `lava` module shades the sea; it reads the same temperature (look_seaTemp) and
// blends to look_planetFar by footprint (look_farMix), so the near and far seas are one material.
//
// Units: air km (world / look_uK); the planet is look_uRg = 2000 air km in radius.

uniform float look_uLavaGain;   // emitted radiance scale of the molten sea
uniform float look_uHeat;       // 0..1 extra heat (the thesis heats the world)
uniform float look_uLandAmt;    // 0..1 how much land

// Signed land field (> 0 land). q: unit sphere point; fp: footprint (air km). The journey's own great circle (x = 0)
// stays open sea, so the low swoops always fly over the molten sea; continents lie off to the sides.
float look_land(vec3 q, float fp) {
  vec3 p = q * (look_uRg / 520.0);
  float fpq = fp / 520.0;
  float c = look_fbm(p + vec3(3.1, 1.7, 0.4), 10, fpq, 0.5);
  c += 0.22 * look_fbm(p * 0.43 - 2.0, 3, fpq * 0.43, 0.5);
  c -= mix(0.55, 0.12, look_uLandAmt);
  return c - 0.6 * (1.0 - smoothstep(0.06, 0.2, abs(q.x)));
}

// Ocean-current eddies: the position is advected along a rotational (tangent) field at growing frequencies, which
// winds the temperature into swirls and filaments.
vec3 look_eddy(vec3 p, vec3 n, float fpq) {
  float amp = 0.45, fr = 1.0;
  for (int i = 0; i < 6; i++) {
    float fade = clamp(1.6 - fpq * fr * 3.0, 0.0, 1.0);
    if (fade <= 0.0) break;
    vec3 g = vec3(look_vnoise(p * fr), look_vnoise(p * fr + 17.3), look_vnoise(p * fr + 31.7));
    p += cross(g, n) * amp * fade;
    amp *= 0.5;
    fr *= 2.1;
  }
  return p;
}

// The sea's surface temperature (K) at unit point q; land: look_land's value there (hotter surf along shores).
float look_seaTemp(vec3 q, float fp, float land) {
  float t = uTime * 0.003 * (1.0 - uStill);
  vec3 p = q * (look_uRg / 700.0);
  float fpq = fp / 700.0;
  vec3 pw = look_eddy(p + vec3(t, 0.0, -t), q, fpq);
  // currents: rivers of heat with anti-aliased banks along the zero set of a field of the eddied position; between
  // them darker, slower metal (still liquid)
  float f = look_fbm(pw * 0.8 + 2.0, 7, fpq * 0.8, 0.55);
  float aa = max(fpq * 1.2, 0.004);
  float cur = 1.0 - smoothstep(0.07 - aa, 0.13 + aa, abs(f));
  // fine flow lines riding the currents; they resolve as the camera comes down
  float fl = look_fbm(pw * 6.0, 9, fpq * 6.0, 0.62);
  float broad = look_fbm(p * 0.3 + 9.0, 3, fpq * 0.3, 0.5);
  float T = 1065.0 + 45.0 * broad + 200.0 * cur * (0.82 + 0.5 * fl) + 40.0 * fl;
  T += 120.0 * exp(-max(0.0, -land) * 22.0);
  return T + look_uHeat * 520.0;
}

float look_ggx(float nh, float a) {
  float a2 = a * a, d = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (LOOK_PI * d * d);
}

// 0 where the near sea (lava) should shade, 1 where the far field takes over (footprint in world units per px)
float look_farMix(Sea s) { return smoothstep(1.5, 12.0, s.fw); }

// Radiance leaving the planet's surface at s toward the camera (before the air in between: look_atmo adds that).
vec3 look_planetFar(Ray r, Sea s) {
  vec3 q = s.q;
  float fp = s.fw / look_uK;
  vec3 p = q * look_uRg;
  float lf = look_land(q, fp);
  float land = smoothstep(-max(fp / 520.0 * 1.2, 0.004), max(fp / 520.0 * 1.2, 0.004), lf);
  // black sand: very dark, warm, wind streaks; relief (normal from the height fbm) that only shows in raking light
  vec3 qs = q * (look_uRg / 120.0);
  float streak = look_fbm(vec3(qs.x * 0.6, qs.y * 2.4, qs.z * 0.6) + 11.0, 6, fp / 120.0 * 2.4, 0.5);
  vec3 sand = vec3(0.055, 0.050, 0.047) * (0.85 + 0.3 * streak + 0.25 * smoothstep(0.05, 0.55, lf));
  vec3 n = q;
  if (land > 0.0) {
    float e = max(fp, 0.8) / look_uRg;
    vec3 tA = normalize(cross(q, abs(q.y) < 0.95 ? vec3(0, 1, 0) : vec3(1, 0, 0))), tB = cross(q, tA);
    float sc = look_uRg / 60.0, fpb = fp / 60.0 * 2.0;
    float h0 = look_fbm(q * sc, 5, fpb, 0.5);
    float h1 = look_fbm(normalize(q + tA * e) * sc, 5, fpb, 0.5);
    float h2 = look_fbm(normalize(q + tB * e) * sc, 5, fpb, 0.5);
    float amp = 0.012 * smoothstep(0.0, 0.25, lf);
    n = normalize(mix(q, normalize(q - (tA * (h1 - h0) + tB * (h2 - h0)) / e * amp * 0.5), land));
  }
  // the sea
  float T = look_seaTemp(q, fp, lf);
  vec3 seaE = look_planck(T) * look_uLavaGain;
  // shore: a ~0.5 km line of hot surf, energy-averaged into the pixel when the footprint is wider, so from orbit it is
  // a fine continuous thread, never a jagged one
  float sw = 0.5 / 520.0, wv = max(sw, fp / 520.0);
  float shore = exp(-lf * lf / (wv * wv)) * (sw / wv);
  vec3 emit = seaE * (1.0 - land) + look_planck(1350.0 + look_uHeat * 400.0) * look_uLavaGain * shore;
  // light
  vec3 v = -r.rd;
  vec3 E = look_uSunE * look_sunT(p);
  float ndl = max(dot(n, look_uSun), 0.0), ndv = max(dot(n, v), 1e-3);
  float fres = 0.05 + 0.95 * pow(1.0 - ndv, 5.0);
  float rough = clamp(0.06 + 0.12 * smoothstep(0.02, 8.0, fp), 0.06, 0.2);
  float spec = look_ggx(max(dot(n, normalize(look_uSun + v)), 0.0), rough) * fres / (4.0 * ndv);
  vec3 skyAmb = look_uSunE * look_msL(look_uRg, dot(q, look_uSun)) * 3.0 + look_uGroundGlow * 0.02;
  vec3 col = emit * (1.0 - fres);
  col += (E * ndl * spec + skyAmb * fres) * (1.0 - land);
  col += mix(vec3(0.02, 0.016, 0.014), sand, land) / LOOK_PI * (E * ndl + skyAmb * LOOK_PI * 0.5);
  return col;
}
