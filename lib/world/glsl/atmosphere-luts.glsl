// look: the atmosphere's LUT passes (look.ts compiles this with atmosphere.glsl in front, one program per pass):
//   PASS_TRANS  256 x 64  transmittance to the top of the air          (once)
//   PASS_MS     32 x 32   multiple-scattering transfer (Hillaire, s.5)   (once)
//   PASS_SKY    192 x 108 sky-view radiance at the camera                (every frame)
uniform vec2 look_uLutRes;
uniform int look_uSkySteps;
out vec4 look_out;

#ifdef PASS_TRANS
void main() {
  vec2 uv = gl_FragCoord.xy / look_uLutRes;
  float xm = (uv.x - 0.5 / 256.0) * (256.0 / 255.0), xr = (uv.y - 0.5 / 64.0) * (64.0 / 63.0);
  float H = sqrt(max(0.0, look_uRt * look_uRt - look_uRg * look_uRg));
  float rho = H * clamp(xr, 0.0, 1.0);
  float r = sqrt(rho * rho + look_uRg * look_uRg);
  float dmin = look_uRt - r, dmax = rho + H;
  float d = dmin + clamp(xm, 0.0, 1.0) * (dmax - dmin);
  float mu = d == 0.0 ? 1.0 : clamp((H * H - rho * rho - d * d) / (2.0 * r * d), -1.0, 1.0);
  vec3 ro = vec3(0.0, r, 0.0), rd = vec3(sqrt(max(0.0, 1.0 - mu * mu)), mu, 0.0);
  float tEnd = max(look_sphere(ro, rd, look_uRt).y, 0.0);
  vec3 od = vec3(0.0);
  for (int i = 0; i < 64; i++) {
    vec3 a, b, ext;
    look_medium(length(ro + rd * (tEnd * (float(i) + 0.5) / 64.0)) - look_uRg, a, b, ext);
    od += ext * (tEnd / 64.0);
  }
  look_out = vec4(exp(-od), 1.0);
}
#endif

#ifdef PASS_MS
void main() {
  vec2 uv = gl_FragCoord.xy / look_uLutRes;
  float muS = uv.x * 2.0 - 1.0;
  float r = clamp(look_uRg + clamp(uv.y, 0.0, 1.0) * (look_uRt - look_uRg), look_uRg + 0.01, look_uRt - 0.01);
  vec3 ro = vec3(0.0, r, 0.0), sd = vec3(sqrt(max(0.0, 1.0 - muS * muS)), muS, 0.0);
  vec3 Lsum = vec3(0.0), fsum = vec3(0.0);
  const float iso = 1.0 / (4.0 * LOOK_PI);
  for (int i = 0; i < 8; i++) {
    for (int j = 0; j < 8; j++) {
      float th = LOOK_PI * (float(i) + 0.5) / 8.0;
      float ph = acos(1.0 - 2.0 * (float(j) + 0.5) / 8.0);
      vec3 rd = vec3(cos(th) * sin(ph), cos(ph), sin(th) * sin(ph));
      float tEnd = look_sphere(ro, rd, look_uRt).y;
      vec2 tg = look_sphere(ro, rd, look_uRg);
      bool ground = tg.x > 0.0;
      if (ground) tEnd = min(tEnd, tg.x);
      vec3 L = vec3(0.0), f = vec3(0.0), T = vec3(1.0);
      float dt = tEnd / 20.0;
      for (int k = 0; k < 20; k++) {
        vec3 p = ro + rd * (float(k) + 0.5) * dt;
        float pr = length(p), mu = dot(p / pr, sd);
        vec3 scR, scM, ext;
        look_medium(pr - look_uRg, scR, scM, ext);
        vec3 sc = scR + scM, Tst = exp(-ext * dt);
        vec3 S = look_T(max(pr, look_uRg), mu) * look_sunVis(pr, mu) * sc * iso;
        L += T * (S - S * Tst) / max(ext, vec3(1e-7));
        f += T * (sc - sc * Tst) / max(ext, vec3(1e-7));
        T *= Tst;
      }
      if (ground) {
        vec3 n = normalize(ro + rd * tEnd);
        float mu = dot(n, sd);
        L += T * look_T(look_uRg, mu) * look_sunVis(look_uRg, mu) * max(mu, 0.0) * look_uGroundAlb / LOOK_PI;
      }
      Lsum += L; fsum += f;
    }
  }
  look_out = vec4((Lsum / 64.0) / max(vec3(1e-4), 1.0 - fsum / 64.0), 1.0);
}
#endif

#ifdef PASS_SKY
void main() {
  vec2 uv = gl_FragCoord.xy / look_uLutRes;
  vec3 L, T;
  look_march(look_uCam, look_skyDir(uv), 1e9, look_uSkySteps, 0.4, L, T);
  look_out = vec4(L, 1.0);
}
#endif
