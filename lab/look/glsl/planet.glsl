// The planet seen from far out: smooth molten seas (glossy, water-like, glowing from within by blackbody temperature,
// no crust, no specks) between continents of black sand, a hot line where the sea meets the shore, a clean terminator,
// and a night side where the sea's own glow and the coastlines trace the planet. Every field is filtered by the pixel
// footprint (km per pixel at the hit) so detail fades to its average instead of aliasing as the camera climbs.
// Up close the `lava` module takes over the sea (it blends by footprint); the land mask and the far-field temperature
// come from here so both agree.
#ifndef PLANET_GLSL
#define PLANET_GLSL

uniform float uTime;
uniform float uLavaGain;   // emitted radiance scale of the molten sea
uniform float uHeat;       // 0..1 extra heat (the thesis heats the world)
uniform float uLandAmt;    // 0..1 how much land there is (0 = an ocean world)

// --- land -----------------------------------------------------------------------------------------------------------
// Signed land field: > 0 is land. n: unit position; fp: footprint in km.
float landField(vec3 n, float fp) {
  float R = uRg;
  vec3 q = n * (R / 520.0);
  float fpq = fp / 520.0;
  // continents: low-frequency shapes with a fractal coastline (the octaves fade with the footprint)
  float c = fbmF(q + vec3(3.1, 1.7, 0.4), 7, fpq);
  c += 0.22 * fbmF(q * 0.43 - 2.0, 3, fpq * 0.43);
  return c - mix(0.55, 0.12, uLandAmt);
}

// --- molten sea temperature ---------------------------------------------------------------------------------------
// Smooth currents: a zonal flow (bands along latitude, as a fast-spinning world's sea would carry), sheared and
// meandering, with slow drift. Contrast is low in temperature (+-70 K) because Planck's law turns it into a large,
// smooth swing in brightness. No cells, no cracks.
// Ocean-current eddies: the position is advected a few times along a rotational (tangent, curl-like) field, which
// winds the temperature into swirls and filaments the way sea-surface-temperature maps of the Gulf Stream look.
vec3 eddyWarp(vec3 p, vec3 n, float fpq) {
  float amp = 0.42;
  for (int i = 0; i < 4; i++) {
    float fade = clamp(1.6 - fpq * float(1 << i) * 1.2, 0.0, 1.0);
    vec3 g = vec3(vnoise(p), vnoise(p + 17.3), vnoise(p + 31.7));
    p += cross(g, n) * amp * fade;
    p = p * 1.0;
    amp *= 0.62;
    p += n * 0.0;
  }
  return p;
}

float seaTemp(vec3 n, float fp, float land) {
  float R = uRg;
  float t = uTime * 0.003;
  vec3 q = n * (R / 700.0);
  float fpq = fp / 700.0;
  vec3 pw = eddyWarp(q * 1.0 + vec3(t, 0.0, -t), n, fpq);
  float g = fbmF(pw * 1.1, 6, fpq * 1.1);
  float broad = fbmF(q * 0.35 + 9.0, 3, fpq * 0.35);
  // dark, slow water between glowing currents: wide in temperature, smooth in space
  float T = 1030.0 + 190.0 * smoothstep(-0.35, 0.55, g + 0.25 * broad);
  // the sea runs hotter where it washes against land (stirred surf)
  T += 70.0 * exp(-max(0.0, -land) * 18.0);
  T += uHeat * 520.0;
  return T;
}

struct PSurf {
  vec3 emit;     // emitted radiance
  vec3 albedo;   // diffuse albedo
  float spec;    // specular weight (0 land .. 1 sea)
  float rough;   // GGX roughness for the sea
  vec3 n;        // shading normal
};

PSurf planetSurface(vec3 p, float fp) {
  vec3 n = normalize(p);
  float lf = landField(n, fp);
  // coast transition at least one footprint wide (no stair-stepping)
  float cw = max(fp / 520.0 * 1.2, 0.004);
  float land = smoothstep(-cw, cw, lf);
  PSurf s;
  s.n = n;
  // black sand: very dark, slightly warm, with wind-streak variation that resolves as you get closer
  vec3 q = n * (uRg / 120.0);
  float streak = fbmF(vec3(q.x * 0.6, q.y * 2.4, q.z * 0.6) + 11.0, 6, fp / 120.0 * 2.4);
  float hi = smoothstep(0.05, 0.55, lf); // continental interiors a touch lighter (older, wind-blown ash)
  vec3 sand = vec3(0.055, 0.050, 0.047) * (0.85 + 0.3 * streak + 0.25 * hi);
  // bump: ridges inland, so the low sun near the terminator rakes long shadows across them
  float e = max(fp, uRg * 0.0004) / uRg;
  vec3 tA = normalize(cross(n, abs(n.y) < 0.95 ? vec3(0, 1, 0) : vec3(1, 0, 0)));
  vec3 tB = cross(n, tA);
  vec3 qb = n * (uRg / 60.0);
  float fpb = fp / 60.0;
  float h0 = fbmF(qb, 5, fpb * 2.0);
  float h1 = fbmF(normalize(n + tA * e) * (uRg / 60.0), 5, fpb * 2.0);
  float h2 = fbmF(normalize(n + tB * e) * (uRg / 60.0), 5, fpb * 2.0);
  float amp = 0.012 * smoothstep(0.0, 0.25, lf) * (uRg / 60.0);
  vec3 bn = normalize(n - (tA * (h1 - h0) + tB * (h2 - h0)) / e * amp / (uRg / 60.0) * 0.5);
  // sea
  float T = seaTemp(n, fp, lf);
  vec3 seaEmit = planck3(T) * uLavaGain;
  // shore: a hot line where the molten surf runs up the sand. Its true width (~2 km) is energy-averaged into the
  // pixel when the footprint is wider, so from orbit it stays a fine, continuous thread of light, never a jagged one.
  float sw = 0.5 / 520.0;
  float wv = max(sw, fp / 520.0);
  float shore = exp(-lf * lf / (wv * wv)) * (sw / wv);
  vec3 shoreEmit = planck3(1350.0 + uHeat * 400.0) * uLavaGain * shore;
  s.emit = seaEmit * (1.0 - land) + shoreEmit;
  s.albedo = mix(vec3(0.02, 0.016, 0.014), sand, land);
  s.spec = 1.0 - land;
  // unresolved swell slopes become roughness: wide, soft sunglint from orbit, tighter low down
  s.rough = clamp(0.06 + 0.12 * smoothstep(0.02, 8.0, fp), 0.06, 0.2);
  s.n = normalize(mix(n, bn, land));
  return s;
}

float p_ggx(float nh, float a) {
  float a2 = a * a;
  float d = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (3.14159265 * d * d);
}

// Radiance leaving the planet's surface at p toward -rd. skyAmb: the sky's mean radiance over the upper hemisphere at
// p (an estimate the caller provides), used for the Fresnel sky reflection and the land's fill.
vec3 planetShade(vec3 p, vec3 rd, float fp, vec3 skyAmb) {
  PSurf s = planetSurface(p, fp);
  vec3 v = -rd;
  vec3 Ts = sunTrans(p);
  vec3 E = uSunE * Ts;
  float ndl = max(dot(s.n, uSunDir), 0.0);
  float ndv = max(dot(s.n, v), 1e-3);
  vec3 h = normalize(uSunDir + v);
  float nh = max(dot(s.n, h), 0.0);
  float fres = 0.05 + 0.95 * pow(1.0 - ndv, 5.0);
  // molten sea: a dielectric skin (F0 ~ 0.05), glossy, with the sun's glint and the sky's reflection
  float G = 1.0 / (1.0 + 0.0001);
  float D = p_ggx(nh, s.rough);
  float spec = D * fres / max(4.0 * ndv, 1e-3) * G;
  vec3 col = s.emit * (1.0 - fres);
  col += E * ndl * spec * s.spec;
  col += skyAmb * fres * s.spec;
  col += s.albedo / 3.14159265 * (E * ndl + skyAmb * 3.14159265 * 0.5);
  return col;
}

#endif
