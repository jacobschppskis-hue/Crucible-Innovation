// look: the planet seen from far out. A smooth molten sea (glossy, water-like, glowing from within by blackbody
// temperature; no crust, no cracks, no specks) under a thin skin, with rivers of hotter metal winding across it; a
// clean terminator. Every field fades out at the pixel footprint, so detail keeps resolving as the camera comes down
// and never aliases as it climbs. Up close the `lava` module shades the sea; it reads the same temperature
// (look_seaTemp) and blends to look_planetFar by footprint (look_farMix), so the near and far seas are one material.
//
// Units: air km (world / look_uK); the planet is look_uRg = 2000 air km in radius.

uniform float look_uLavaGain;   // emitted radiance scale of the molten sea
uniform float look_uHeat;       // 0..1 extra heat (journey channel look.heat)
uniform float look_uLandAmt;    // 0..1 how much land
uniform float look_uQuiet;      // 0..1 where long body text crosses the planet: the rivers' cores to ~a tenth, the glow a little lower
uniform float look_uCold;       // 0..1 the thesis: the world cooled to its cold state (look.ts, from thesis.ts)
uniform float look_uMelt;       // 0..1 the thesis: how far it has heated since (293 K -> 1811 K on the readout)

// Signed land field (> 0 land). q: unit sphere point; fp: footprint (air km). The journey's own great circle (x = 0)
// stays open sea, so the low swoops always fly over the molten sea; continents lie off to the sides.
float look_land(vec3 q, float fp) {
  // V2: the reference frame is rivers on a dark disk, no continents (their coasts near the limb read as blocks)
  if (look_uLandAmt <= 0.0) return -1.0;
  vec3 p = q * (look_uRg / 520.0);
  float fpq = fp / 520.0;
  float c = look_fbm(p + vec3(3.1, 1.7, 0.4), 10, fpq, 0.5);
  c += 0.22 * look_fbm(p * 0.43 - 2.0, 3, fpq * 0.43, 0.5);
  c -= mix(0.55, 0.12, look_uLandAmt);
  return c - 0.6 * (1.0 - smoothstep(0.06, 0.2, abs(q.x)));
}

// A smooth, low-frequency warp: big lazy loops, not fractal wiggles (two passes of a curl-like rotation).
vec3 look_meander(vec3 p, vec3 n) {
  vec3 g = vec3(look_vnoise(p * 0.7), look_vnoise(p * 0.7 + 17.3), look_vnoise(p * 0.7 + 31.7));
  p += cross(g, n) * 0.55;
  g = vec3(look_vnoise(p * 1.3 + 5.1), look_vnoise(p * 1.3 + 23.9), look_vnoise(p * 1.3 + 41.3));
  return p + cross(g, n) * 0.22;
}
float look_riverField(vec3 pw) { return look_fbm(pw * 0.8 + 2.0, 3, 0.0, 0.5); }

// 0 low over the sea (hero, together, the swoops, ventures, the beach: the V2 field, untouched), 1 from ~60 units up:
// the orbit field below (depth: basins, cores, banks, tributaries, flow).
float look_orbitW() { return smoothstep(24.0, 60.0, uCamH); }

// A line of heat: peak excess A (K) over a gaussian of half-width w, seen through a pixel footprint e (same units).
// Wider than the line, the footprint spreads its RADIANCE over the pixel: on Planck's curve near 1400 K radiance
// e-folds every ~80 K, so the excess drops by 80 ln(widening). A far thread stays a faint smooth thread, never aliased.
float look_hot(float d, float w, float A, float e) {
  float we = sqrt(w * w + e * e);
  return max(A - 80.0 * log(we / w), 0.0) * exp(-(d * d) / (we * we));
}

// The thesis (293 K -> 1811 K on the readout). look_uCold: how far the world has cooled to its cold state (a dark,
// barely glowing sea, the rivers faint veins); look_uMelt: how far it has heated since. T0: the calm sea; bas: the
// basins' excess; riv: the rivers' excess; af: |river field| (0 on a river, ~0.6 deep in a basin: the distance heat has
// to travel from the banks); st: -1..1 flow streaks. The rivers come up first and widen (look_seaTemp), heat spreads
// from their banks across the basins, then the whole sea climbs to yellow-white, the rivers still its hottest lines.
// The same everywhere on the planet: no pattern of its own, nothing local.
float look_thesisT(float T0, float bas, float riv, float af, float st) {
  float T = T0 + bas + riv;
  float c = look_uCold;
  if (c <= 0.0) return T;
  float m = look_uMelt;
  float mr = smoothstep(0.0, 0.3, m), ms = smoothstep(0.08, 0.78, m), mb = smoothstep(0.3, 1.0, m);
  // the heated zone widens from the banks outward (af is the way from the nearest river); at the end the valleys the
  // rivers run through are the hottest sea and the hearts of the basins the coolest: one convecting sea, not a ball
  float sp = 1.0 - smoothstep(0.02, 0.5, af / max(ms, 0.03));
  float Tt = T0 - 55.0 + riv * mix(0.6, 0.96, mr) * mix(1.0, 0.74, mb) + bas * 1.5 + 150.0 * sp + 125.0 * mb + 9.0 * st * mb;
  return mix(T, Tt, c);
}

// The sea's surface temperature (K) at unit point q. Seen from orbit (the reference frame) the molten sea is a dark disk
// with EMISSIVE rivers: smooth, low-frequency meanders (the zero set of a 3-octave field of a gently warped position).
// Everything is temperature; radiance follows Planck, so a few percent in T is tens of percent in brightness.
// - the calm sea ~1140 K under its skin, with broad warmer basins and cooler reaches (very low frequency), and a
//   faint warmth in the valleys the rivers run through;
// - a river: banks cooling from Ember to dull red, a narrow orange-yellow core, a white-yellow thread in its middle
//   (each a profile of the analytic distance to the centre line, |f| / |grad f|, the gradient by finite differences in
//   world space: smooth at any render scale, no screen derivatives); its width breathes along the course, it pools
//   where channels join (the field's saddles), and a slow brightness variation is carried along it (a noise advected
//   along the level sets of f in two blended phases: it never pops, and stands still when the clock does);
// - tributaries: more families of thinner, fainter channels near the rivers, each resolving as the camera comes down
//   (footprint-gated: from far out they cost nothing).
// Low over the sea (look_orbitW 0) it is the V2 field exactly (the hero, the swoops and ventures were tuned on it).
float look_seaTemp(vec3 q, float fp, float land) {
  vec3 p = q * (look_uRg / 700.0);
  float fpq = fp / 700.0;
  vec3 tA = normalize(cross(q, abs(q.y) < 0.95 ? vec3(0, 1, 0) : vec3(1, 0, 0))), tB = cross(q, tA);
  // the network stands still (it used to drift ~3 km/s, which slid rivers under the hero): the flow runs along it now
  vec3 pw = look_meander(p, q);
  float f = look_riverField(pw);
  float af = abs(f);
  float broad = look_fbm(p * 0.3 + 9.0, 3, fpq * 0.3, 0.5);
  float qt = max(look_uQuiet, uQuiet);   // world's journey channel 'quiet' (prelude) or look's own
  float W = look_orbitW();
  float Told = 0.0, Tnew = 0.0;
  if (W < 1.0) {
    float hh = max(fpq, 0.002);
    float fa = look_riverField(look_meander(p + tA * hh, q));
    float fb = look_riverField(look_meander(p + tB * hh, q));
    // floored: where the field is flat (saddles) a raw ratio threw thin spikes out of the river
    float g = max(length(vec2(fa - f, fb - f)) / hh, 0.6);
    float d = af / g;                       // distance to the river's centre line, field units (1 = 700 air km)
    float wc = max(0.026, fpq * 1.2);
    float core = exp(-(d * d) / (wc * wc)) * (0.026 / wc);
    float wh = max(0.08, fpq * 2.0);
    float halo = exp(-d / wh);
    float f2 = look_riverField(pw * 1.9 + 7.0);
    float h2 = exp(-abs(f2) / max(0.02, fpq * 1.5)) * (1.0 - smoothstep(0.0, 0.35, af));
    float rq = mix(1.0, 0.7, qt);
    Told = look_thesisT(1060.0 - 12.0 * qt, 15.0 * broad, rq * (120.0 * halo + 110.0 * core + 55.0 * h2), af, 0.0);
  }
  if (W > 0.0) {
    float e = fpq;
    float hh = max(e, 0.003);
    vec2 gr = vec2(look_riverField(pw + tA * hh) - f, look_riverField(pw + tB * hh) - f) / hh;
    float g = max(length(gr), 0.6);
    float d = af / g;
    // the width breathes along the course; the thesis widens every river as it heats
    float wv = (0.7 + 0.6 * (0.5 + 0.5 * look_vnoise(p * 2.3 + 13.0))) * (1.0 + 0.35 * look_uCold * smoothstep(0.0, 0.5, look_uMelt));
    // flow: a noise carried along the level sets of f (the river's own direction), two phases half a period apart
    vec3 v = (tA * gr.y - tB * gr.x) / g;
    float tt = uTime * (1.0 - uStill) / 22.0;
    float ph1 = fract(tt), ph2 = fract(tt + 0.5);
    float w1 = 1.0 - abs(2.0 * ph1 - 1.0);
    vec3 pf = pw * 6.5;
    float fl = mix(look_vnoise(pf - v * (1.43 * (ph2 - 0.5)) + 37.0), look_vnoise(pf - v * (1.43 * (ph1 - 0.5))), w1);
    if (e < 0.005) {
      vec3 pf2 = pw * 21.5;
      float fine = mix(look_vnoise(pf2 - v * (4.7 * (ph2 - 0.5)) + 11.0), look_vnoise(pf2 - v * (4.7 * (ph1 - 0.5))), w1);
      fl += 0.5 * fine * (1.0 - smoothstep(0.002, 0.005, e));
    }
    float bank = 110.0 * exp(-d / sqrt(0.0016 * wv * wv + e * e));
    float hot = (look_hot(d, 0.011 * wv, 170.0, e) + look_hot(d, 0.0028 * wv, 110.0, e)) * (0.86 + 0.3 * fl);
    // tributaries: thinner and fainter away from the rivers they feed
    float near = 1.0 - smoothstep(0.04, 0.42, af);
    vec3 p2 = pw * 1.9 + 7.0;
    float f2 = look_riverField(p2);
    // (no gradient here: where this field runs flat a tributary swells into a pool; cheaper, and it reads as one)
    float d2 = abs(f2) / 2.2;
    float tr = look_hot(d2, 0.0042 * (0.5 + near), 135.0 * (0.15 + 0.85 * near), e) + 22.0 * near * exp(-d2 / (0.012 + e));
    float F = 4.3, wk = 0.0016, Ak = 105.0, trf = 0.0;
    for (int i = 0; i < 3; i++) {
      if (e > wk * 3.5 || near < 0.02) break;
      vec3 pk = pw * F + 19.0 * float(i + 1);
      float fk = look_vnoise(pk) + 0.5 * look_vnoise(pk * 2.1 + 3.0);
      trf = max(trf, look_hot(abs(fk) / (F * 2.5), wk, Ak, e));
      F *= 2.6; wk *= 0.42; Ak *= 0.92;
    }
    tr = max(tr, trf * near);
    // where a tributary meets the river it adds a little (a junction is brighter), never a second core on top
    float riv = bank + hot + tr * (1.0 - 0.7 * min(hot / 280.0, 1.0));
    // quiet: under running text the rivers lose ~3/4 of their excess (Planck: an order of magnitude in radiance)
    riv *= mix(1.0, 0.4, qt);
    float bas = 45.0 * broad + 20.0 * exp(-af / 0.16) - 8.0;
    // the molten thesis sea: long filaments along the flow (fast across the stream lines, slow along them)
    float st = look_uCold > 0.0 ? look_vnoise(vec3(f * 34.0 + 0.8 * fl, dot(pw, vec3(1.3, 0.7, -0.9)), 5.0)) : 0.0;
    Tnew = look_thesisT(1140.0 - 14.0 * qt, bas, riv, af, st);
  }
  float T = mix(Told, Tnew, W);
  T += 110.0 * exp(-max(0.0, -land) * 22.0);
  return T + look_uHeat * 520.0;
}

float look_ggx(float nh, float a) {
  float a2 = a * a, d = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (LOOK_PI * d * d);
}

// 0 where the near sea (lava) shades, 1 where the far field takes over: by distance, so the hero and the low swoops
// (horizon < ~150 units) are all lava and everything seen from orbit is the planet; from a camera above ~200 units the
// whole sea is the far field (the near swell, fading out up there, otherwise draws radial streaks at grazing views)
float look_farMix(Sea s) { return max(smoothstep(250.0, 1400.0, s.t), smoothstep(60.0, 200.0, uCamH)); }

// Radiance leaving the planet's surface at s toward the camera (before the air in between: look_atmo adds that).
vec3 look_planetFarT(Ray r, Sea s, float dT) {
  vec3 q = s.q;
  // s.fw is the footprint's long (grazing) axis; isotropic noise filtered by it blurs a far sea to mush. Use the
  // geometric mean of the two axes (what anisotropic filtering approximates), so detail survives toward the horizon.
  float fp = s.fw * sqrt(s.graz) / look_uK;
  // toward the limb the footprint gets very long: there the fields use the long axis (blurrier, never blocky)
  float limb = 1.0 - smoothstep(0.08, 0.35, s.graz);
  fp = mix(fp, s.fw / look_uK, limb);
  vec3 p = q * look_uRg;
  float lf = look_land(q, fp);
  float land = smoothstep(-max(fp / 520.0 * 1.2, 0.004), max(fp / 520.0 * 1.2, 0.004), lf);
  vec3 sand = vec3(0.0);
  vec3 n = q;
  if (land > 0.0) {
    // black sand: very dark, warm, wind streaks; relief (normal from the height fbm) that only shows in raking light
    vec3 qs = q * (look_uRg / 120.0);
    float streak = look_fbm(vec3(qs.x * 0.6, qs.y * 2.4, qs.z * 0.6) + 11.0, 6, fp / 120.0 * 2.4, 0.5);
    sand = vec3(0.055, 0.050, 0.047) * (0.85 + 0.3 * streak + 0.25 * smoothstep(0.05, 0.55, lf));
    float e = max(fp, 0.8) / look_uRg;
    vec3 tA = normalize(cross(q, abs(q.y) < 0.95 ? vec3(0, 1, 0) : vec3(1, 0, 0))), tB = cross(q, tA);
    float sc = look_uRg / 60.0, fpb = fp / 60.0 * 2.0;
    float h0 = look_fbm(q * sc, 5, fpb, 0.5);
    float h1 = look_fbm(normalize(q + tA * e) * sc, 5, fpb, 0.5);
    float h2 = look_fbm(normalize(q + tB * e) * sc, 5, fpb, 0.5);
    float amp = 0.012 * smoothstep(0.0, 0.25, lf);
    n = normalize(mix(q, normalize(q - (tA * (h1 - h0) + tB * (h2 - h0)) / e * amp * 0.5), land));
  }
  vec3 v = -r.rd;
  float ndv = max(dot(n, v), 1e-3);
  float W = look_orbitW();
  // the sea, seen through its own skin: at a grazing angle the eye looks through more of the cooler skin, so an
  // emitting sea darkens toward the limb (0 K face-on, the whole skin at the limb; thinner as the thesis melts it)
  float T = look_seaTemp(q, fp, lf) + dT;
  T -= W * mix(75.0, 40.0, look_uCold * look_uMelt) * (1.0 - exp(-0.3 * (1.0 / ndv - 1.0)));
  vec3 seaE = look_planck(T) * look_uLavaGain;
  // shore: a ~0.5 km line of hot surf, energy-averaged into the pixel when the footprint is wider, so from orbit it is
  // a fine continuous thread, never a jagged one
  float sw = 0.5 / 520.0, wv = max(sw, fp / 520.0);
  float shore = exp(-lf * lf / (wv * wv)) * (sw / wv);
  vec3 emit = seaE * (1.0 - land) + look_planck(1350.0 + look_uHeat * 400.0) * look_uLavaGain * shore;
  // a floor of faint, smooth glow over the whole sea, so the night side is never black. Low over the sea it IS the
  // sea's colour (the V2 look); from orbit the sea's own temperature carries the disk and the floor is only a net
  emit = max(emit, vec3(0.055, 0.0095, 0.0016) * (look_uLavaGain / 3.0) * (1.0 - land) * mix(1.0, 0.16, W));
  // lava lakes inland: small, sparse, very hot pools, like a city's lights on Earth's night side (they tell you how big
  // the continent is). Each is a disc ~2-6 km across, energy-averaged into the pixel when smaller than it.
  if (land > 0.01 && limb < 0.99) {
    vec3 lc = q * (look_uRg / 40.0);
    vec3 ci = floor(lc);
    vec3 hh = look_h33(ci + 7.3);
    if (hh.x < 0.07) {
      vec3 cp = (ci + 0.25 + 0.5 * hh) * (40.0 / look_uRg);
      float dkm = length(q - normalize(cp)) * look_uRg;
      float rad = mix(0.6, 1.8, hh.y);
      // energy-averaged into the pixel, but never wider than ~a quarter cell (a gaussian cut at its cell's edge reads as a
      // square block); past that the lake simply fades
      float wv2 = min(max(rad, fp * 1.2), 9.0);
      float fade = rad * rad / max(rad * rad, fp * fp * 1.44);
      float lake = exp(-dkm * dkm / (wv2 * wv2)) * fade * (1.0 - limb);
      emit += look_planck(mix(1250.0, 1420.0, hh.z) + look_uHeat * 300.0) * look_uLavaGain * lake * land * smoothstep(0.05, 0.25, lf);
    }
  }
  // light
  vec3 E = look_uSunE * look_sunT(p);
  float ndl = max(dot(n, look_uSun), 0.0);
  float fres = 0.05 + 0.95 * pow(1.0 - ndv, 5.0);
  float rough = clamp(0.06 + 0.12 * smoothstep(0.02, 8.0, fp), 0.06, 0.2);
  float spec = look_ggx(max(dot(n, normalize(look_uSun + v)), 0.0), rough) * fres / (4.0 * ndv);
  vec3 skyAmb = look_uSunE * look_msL(look_uRg, dot(q, look_uSun)) * 3.0 + look_uGroundGlow * 0.02;
  vec3 col = emit * (1.0 - fres);
  col += (E * ndl * spec + skyAmb * fres) * (1.0 - land);
  // the glossy sea mirrors its own sky: toward the limb (Fresnel) it picks up the air above it, the dusk band along
  // the terminator, the airglow line on the night side, the furnace glow of the heated air in the thesis. Four samples
  // of the same air the limb is drawn with, only where the mirror is strong enough to show.
  if (W > 0.0 && uQ > 0.4 && fres > 0.07 && land < 1.0) {
    vec3 Lr, Tr;
    look_march(q * (look_uRg + 0.02), reflect(r.rd, q), 1e9, 4, 0.5, Lr, Tr);
    col += Lr * (fres * W * (1.0 - land));
  }
  col += mix(vec3(0.02, 0.016, 0.014), sand, land) / LOOK_PI * (E * ndl + skyAmb * LOOK_PI * 0.5);
  return col;
}

vec3 look_planetFar(Ray r, Sea s) { return look_planetFarT(r, s, 0.0); }
// with the sea hooks' modifications: heat (lava's 0..1 scale, ~400 K per unit) and emitted radiance
vec3 look_planetFarMod(Ray r, Sea s, SeaMod m) { return look_planetFarT(r, s, m.heat * 400.0) + m.emit; }
