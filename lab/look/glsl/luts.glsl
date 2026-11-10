// LUT passes for the atmosphere (one fragment shader, the pass chosen by a define):
//   PASS_TRANS  256 x 64 transmittance to the top of the atmosphere          (once, or when the air changes)
//   PASS_MS     32 x 32 multiple-scattering transfer (Hillaire 2020, sec. 5)  (once, or when the air changes)
//   PASS_SKY    200 x 120 sky-view radiance at the camera                     (every frame the camera is low)
uniform vec2 uLutRes;
out vec4 outColor;

#ifdef PASS_TRANS
void main() {
  vec2 uv = gl_FragCoord.xy / uLutRes;
  float r, mu;
  a_transParams(uv, r, mu);
  vec3 ro = vec3(0.0, r, 0.0);
  vec3 rd = vec3(sqrt(max(0.0, 1.0 - mu * mu)), mu, 0.0);
  vec2 ta = a_sphere(ro, rd, uRt);
  float tEnd = max(ta.y, 0.0);
  vec3 od = vec3(0.0);
  const int N = 64;
  for (int i = 0; i < N; i++) {
    float t = tEnd * (float(i) + 0.5) / float(N);
    vec3 p = ro + rd * t;
    vec3 a, b, ext;
    a_medium(length(p) - uRg, a, b, ext);
    od += ext * (tEnd / float(N));
  }
  outColor = vec4(exp(-od), 1.0);
}
#endif

#ifdef PASS_MS
void main() {
  vec2 uv = gl_FragCoord.xy / uLutRes;
  float muS = uv.x * 2.0 - 1.0;
  float r = uRg + clamp(uv.y, 0.0, 1.0) * (uRt - uRg);
  r = clamp(r, uRg + 0.01, uRt - 0.01);
  vec3 ro = vec3(0.0, r, 0.0);
  vec3 sd = vec3(sqrt(max(0.0, 1.0 - muS * muS)), muS, 0.0);
  const int SQ = 8;
  const int N = 20;
  vec3 Lsum = vec3(0.0), fsum = vec3(0.0);
  float iso = 1.0 / (4.0 * A_PI);
  for (int i = 0; i < SQ; i++) {
    for (int j = 0; j < SQ; j++) {
      float th = A_PI * (float(i) + 0.5) / float(SQ);
      float ph = acos(1.0 - 2.0 * (float(j) + 0.5) / float(SQ));
      float cp = cos(ph), sp = sin(ph);
      vec3 rd = vec3(cos(th) * sp, cp, sin(th) * sp);
      vec2 ta = a_sphere(ro, rd, uRt);
      vec2 tg = a_sphere(ro, rd, uRg);
      float tEnd = ta.y;
      bool ground = tg.x > 0.0;
      if (ground) tEnd = min(tEnd, tg.x);
      vec3 L = vec3(0.0), f = vec3(0.0), T = vec3(1.0);
      float dt = tEnd / float(N);
      for (int k = 0; k < N; k++) {
        vec3 p = ro + rd * (float(k) + 0.5) * dt;
        float pr = length(p);
        vec3 up = p / pr;
        float mu = dot(up, sd);
        vec3 scR, scM, ext;
        a_medium(pr - uRg, scR, scM, ext);
        vec3 sc = scR + scM;
        vec3 Ts = a_trans(max(pr, uRg), mu) * a_sunVis(pr, mu);
        vec3 Tst = exp(-ext * dt);
        vec3 S = Ts * sc * iso;
        L += T * (S - S * Tst) / max(ext, vec3(1e-7));
        vec3 F = sc;
        f += T * (F - F * Tst) / max(ext, vec3(1e-7));
        T *= Tst;
      }
      if (ground) {
        vec3 p = ro + rd * tEnd;
        vec3 n = normalize(p);
        float mu = dot(n, sd);
        L += T * a_trans(uRg, mu) * a_sunVis(uRg, mu) * max(mu, 0.0) * uGroundAlb / A_PI;
      }
      Lsum += L; fsum += f;
    }
  }
  float inv = 1.0 / float(SQ * SQ);
  vec3 L2 = Lsum * inv, fms = fsum * inv;
  outColor = vec4(L2 / max(vec3(1e-4), 1.0 - fms), 1.0);
}
#endif

#ifdef PASS_SKY
uniform int uSkySteps;
void main() {
  vec2 uv = gl_FragCoord.xy / uLutRes;
  vec3 rd = a_skyDir(uv);
  vec3 L, T;
  atmoMarch(uCamPos, rd, 1e9, uSkySteps, 0.3, L, T);
  outColor = vec4(L, 1.0);
}
#endif
