// The Thesis heat: as the visitor scrolls the Thesis (components/world/Thesis.tsx), the planet's sea under the type heats
// from room temperature (293 K) to iron's melting point (1811 K).
//
// Cold, the sea is cold metal: no emission at all, only the lava/sky modules' reflection (a dark mirror of the stars).
// Heating, it glows from within through the Nov 2 build's domain-warped flow (lib/gl/molten.ts), re-done for the world:
// - in world space on the sea (it lies on the surface, foreshortens with it, and stays put as the camera moves);
// - stretched along a slow current, so it reads as metal streaming, not boiling blobs;
// - every octave fades out once it is finer than ~2 px (pixel footprint), so the far sea never shimmers or specks;
// - smooth everywhere: no crust, no plates, no cracks; the cooler parts are just cooler, glossy metal;
// - pooled near the viewer (the far sea and the horizon stay calm, the type above stays clear), reaching further as it
//   heats;
// - coloured by Planck's law at three wavelengths (deep red near the Draper point, orange at 1811 K; the tone curve takes
//   the hottest streams toward yellow-white), with a softened, monotone intensity so dull red and white-hot both read.
// Output is linear HDR radiance to add under the sea's Fresnel: emission * (1 - F).
//
// Framework-free: no React, no DOM beyond nothing. The component hands the heat in with setThesisHeat().

/** Heat 0..1 (0 = 293 K, 1 = 1811 K), set by the Thesis section every scroll frame; read by the world each frame. */
export const thesisHeat = { k: 0, set: false };
export function setThesisHeat(k: number) {
  thesisHeat.k = k < 0 ? 0 : k > 1 ? 1 : k;
  thesisHeat.set = true;
}
/** Kelvin for a heat value (for readouts and tests). */
export const kelvin = (k: number) => 293 + k * (1811 - 293);

/** GLSL (ES 3.00): `vec3 thesisEmission(vec2 p, float dist, float fp, float k, float t)`. p: sea position in world
 * units, dist: camera distance, fp: world units per pixel there, k: heat 0..1, t: clock seconds. */
export const THESIS_GLSL = /* glsl */ `
vec2 th_h2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return -1.0 + 2.0 * fract(sin(p) * 43758.5453); }
float th_noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  float a = dot(th_h2(i), f), b = dot(th_h2(i+vec2(1,0)), f-vec2(1,0));
  float c = dot(th_h2(i+vec2(0,1)), f-vec2(0,1)), d = dot(th_h2(i+vec2(1,1)), f-vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float th_fbm(vec2 p, float fp){
  float v = 0.0, a = 0.5, f = 1.0;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++){
    float w = 1.0 - smoothstep(0.25, 0.6, fp * f);
    if (w <= 0.0) break;
    v += a * th_noise(p) * w;
    p = m * p; a *= 0.5; f *= 2.0;
  }
  return v;
}
vec3 th_planck(float T){
  vec3 lam = vec3(0.610, 0.550, 0.465);
  vec3 b = 1.0 / (pow(lam, vec3(5.0)) * (exp(14388.0 / (lam * T)) - 1.0));
  return b / max(b.r, 1e-30);
}
vec3 thesisEmission(vec2 p, float dist, float fp, float k, float t){
  if (k <= 0.001) return vec3(0.0);
  vec2 dir = normalize(vec2(0.35, -1.0));
  mat2 R = mat2(dir.y, -dir.x, dir.x, dir.y);
  float sc = 0.16;
  vec2 q = R * p * sc; q.y *= 0.55;
  float nfp = fp * sc;
  float sp = t * (0.02 + k * 0.09);
  vec2 w1 = vec2(th_fbm(q + vec2(0.0, sp), nfp), th_fbm(q + vec2(5.2, 1.3) - sp, nfp));
  vec2 w2 = vec2(th_fbm(q + 2.6 * w1 + vec2(1.7, 9.2) + sp * 1.3, nfp), th_fbm(q + 2.6 * w1 + vec2(8.3, 2.8), nfp));
  float n = clamp(0.5 + th_fbm(q + 2.2 * w2 + vec2(0.0, -sp * 2.0), nfp) * 0.9, 0.0, 1.0);
  float pool = exp(-dist / mix(5.0, 26.0, k));
  float kl = k * mix(0.42, 1.0, pool) * (0.5 + 0.78 * n * n * (3.0 - 2.0 * n));
  float T = 293.0 + kl * 1518.0;
  float I = 0.8 * pow(max(T - 720.0, 0.0) / 1091.0, 2.6);
  return th_planck(max(T, 800.0)) * I;
}
`;
