// The Thesis heat as a GLSL chunk (prototype; ported to lib/world/thesis.ts). Linear HDR radiance out.
// p: sea position (world units), dist: camera distance, fp: world units per pixel (footprint), k: heat 0..1, t: time.
export const THESIS_GLSL = /* glsl */ `
vec2 th_h2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return -1.0 + 2.0 * fract(sin(p) * 43758.5453); }
// gradient noise, quintic fade (no grid creases)
float th_noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  float a = dot(th_h2(i), f), b = dot(th_h2(i+vec2(1,0)), f-vec2(1,0));
  float c = dot(th_h2(i+vec2(0,1)), f-vec2(0,1)), d = dot(th_h2(i+vec2(1,1)), f-vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
// fbm whose octaves fade out once they are finer than ~2 px (fp in noise units): no shimmer, no specks at distance
float th_fbm(vec2 p, float fp){
  float v = 0.0, a = 0.5, f = 1.0;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++){
    float w = 1.0 - smoothstep(0.25, 0.6, fp * f);
    v += a * th_noise(p) * w;
    p = m * p; a *= 0.5; f *= 2.0;
  }
  return v; // ~[-0.6, 0.6]
}
// Planck at three wavelengths (um) -> linear RGB chromaticity, normalised to its max channel
vec3 th_planck(float T){
  vec3 lam = vec3(0.610, 0.550, 0.465);
  vec3 b = 1.0 / (pow(lam, vec3(5.0)) * (exp(14388.0 / (lam * T)) - 1.0));
  return b / max(b.r, 1e-30);
}
vec3 thesisEmission(vec2 p, float dist, float fp, float k, float t){
  if (k <= 0.0) return vec3(0.0);
  // flow: a slow current toward the viewer and to the right, the field stretched along it (molten metal streams,
  // it does not boil in round blobs)
  vec2 dir = normalize(vec2(0.35, -1.0));
  mat2 R = mat2(dir.y, -dir.x, dir.x, dir.y);
  float sc = 0.16;
  vec2 q = R * p * sc; q.y *= 0.55;
  float nfp = fp * sc;
  float sp = t * (0.02 + k * 0.09);
  vec2 w1 = vec2(th_fbm(q + vec2(0.0, sp), nfp), th_fbm(q + vec2(5.2, 1.3) - sp, nfp));
  vec2 w2 = vec2(th_fbm(q + 2.6 * w1 + vec2(1.7, 9.2) + sp * 1.3, nfp), th_fbm(q + 2.6 * w1 + vec2(8.3, 2.8), nfp));
  float n = 0.5 + th_fbm(q + 2.2 * w2 + vec2(0.0, -sp * 2.0), nfp) * 0.9;  // ~[0,1]
  n = clamp(n, 0.0, 1.0);
  // pooled near the viewer: the far sea stays cooler, the horizon calm; the pool reaches further as it heats
  float reach = mix(5.0, 26.0, k);
  float pool = exp(-dist / reach);
  // local temperature (K): the whole surface comes up together, the flow's ridges lead
  float kl = k * mix(0.42, 1.0, pool) * (0.5 + 0.78 * n * n * (3.0 - 2.0 * n));
  float T = 293.0 + kl * (1811.0 - 293.0);
  // visible glow starts near the Draper point (~800 K); a softened, monotone curve so dull red and white-hot both read
  float I = 0.8 * pow(max(T - 720.0, 0.0) / (1811.0 - 720.0), 2.6);
  return th_planck(max(T, 800.0)) * I;
}
`;
