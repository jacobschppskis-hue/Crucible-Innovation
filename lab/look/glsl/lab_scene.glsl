// Lab-only stand-in for the world composer: one camera ray per pixel, the planet, the atmosphere, the sun, the stars.
// A simple swell stands in for the lava module up close.
uniform vec3 uCamR, uCamU, uCamF; // camera basis (right, up, forward)
uniform float uTanHalf;            // tan(fov_y / 2)
uniform vec2 uRes;
uniform int uSteps;
uniform float uFrame;
uniform float uUseSkyLUT;          // 1: camera low enough that the sky-view LUT is valid for the sky

out vec4 outColor;

// stand-in swell up close: a few long-crested waves (amplitude in km), filtered by footprint
vec3 swellNormal(vec3 p, vec3 n, float fp) {
  vec3 tA = normalize(cross(n, vec3(0.0, 1.0, 0.0001)));
  vec3 tB = cross(n, tA);
  vec2 xz = vec2(dot(p, tA), dot(p, tB));
  vec2 g = vec2(0.0);
  float amp = 0.0011; float wl = 0.09; vec2 dir = normalize(vec2(1.0, 0.35));
  for (int i = 0; i < 9; i++) {
    float k = 6.2831853 / wl;
    float w = sqrt(9.8e-3 * k) * 3.0;
    float fade = clamp(2.0 - fp * 2.0 / wl * 2.0, 0.0, 1.0);
    float ph = dot(xz, dir) * k - w * uTime + float(i) * 1.7;
    g += dir * cos(ph) * amp * k * fade;
    wl *= 0.68; amp *= 0.62;
    float a = 0.7 + float(i) * 0.9;
    dir = normalize(vec2(cos(a), sin(a) * 0.6 + 0.2));
  }
  return normalize(n - tA * g.x - tB * g.y);
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 ndc = (px / uRes) * 2.0 - 1.0;
  float aspect = uRes.x / uRes.y;
  vec3 rd = normalize(uCamF + uCamR * ndc.x * uTanHalf * aspect + uCamU * ndc.y * uTanHalf);
  vec3 ro = uCamPos;
  float pixAng = 2.0 * uTanHalf / uRes.y;
  float jit = ign(px + uFrame * 5.588);

  vec2 tg = a_sphere(ro, rd, uRg);
  bool hit = tg.x > 0.0;
  float tHit = hit ? tg.x : 1e9;

  vec3 L, T;
  bool skyLut = uUseSkyLUT > 0.5 && !hit;
  if (skyLut) {
    L = skyView(rd);
    // transmittance toward space along rd, from the LUT at the camera
    float r = length(ro);
    T = a_trans(r, dot(ro / r, rd));
  } else {
    atmoMarch(ro, rd, tHit, uSteps, jit, L, T);
  }

  vec3 col = L;
  if (hit) {
    vec3 p = ro + rd * tHit;
    vec3 n = normalize(p);
    float cosI = max(abs(dot(n, rd)), 0.02);
    float fp = tHit * pixAng / sqrt(cosI);
    // the sky's mean radiance above p: approximated from the multiple-scattering LUT (cheap and smooth)
    float r = length(p);
    float muS = dot(n, uSunDir);
    vec3 skyAmb = uSunE * a_ms(r, muS) * 3.0 + uGroundGlow * 0.02;
    vec3 Ls;
    if (fp < 0.02 && uUseSkyLUT > 0.5) {
      // close to the camera: the stand-in sea with a real sky reflection from the sky-view LUT
      PSurf s = planetSurface(p, fp);
      vec3 sn = swellNormal(p, n, fp);
      vec3 rr = reflect(rd, sn);
      if (dot(rr, n) < 0.01) rr = normalize(rr + n * (0.01 - dot(rr, n)));
      float ndv = max(dot(sn, -rd), 1e-3);
      float fres = 0.05 + 0.95 * pow(1.0 - ndv, 5.0);
      vec3 refl = skyView(rr) + sunDisc(rr, pixAng * 3.0) * a_trans(r, dot(n, rr)) * 0.6;
      vec3 Ts = sunTrans(p);
      vec3 h = normalize(uSunDir - rd);
      float spec = p_ggx(max(dot(sn, h), 0.0), 0.05) * fres / (4.0 * ndv);
      Ls = s.emit * (1.0 - fres) + refl * fres + uSunE * Ts * spec * max(dot(sn, uSunDir), 0.0);
      float k = smoothstep(0.004, 0.02, fp);
      Ls = mix(Ls, planetShade(p, rd, fp, skyAmb), k);
    } else {
      Ls = planetShade(p, rd, fp, skyAmb);
    }
    col += T * Ls;
  } else {
    col += T * (sunDisc(rd, pixAng) + starsAndGalaxy(rd));
  }
  outColor = vec4(col, 1.0);
}
