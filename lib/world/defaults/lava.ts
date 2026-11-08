// Stand-ins for the `lava` role's functions (lava_shade, lava_env), so the sea renders before lava lands. Owned by
// world; replaced by lib/world/lava.ts as soon as it registers a module that provides them.

import type { WorldModule } from '../modules';

const RAMP = /* glsl */ `
// blackbody-ish ramp, t 0..1 (cold dark red -> Ember -> yellow-white)
vec3 dlava_bb(float t){
  vec3 c = mix(vec3(0.0), vec3(0.25, 0.012, 0.002), smoothstep(0.0, 0.35, t));
  c = mix(c, EMBER * 1.2, smoothstep(0.3, 0.65, t));
  c = mix(c, vec3(1.0, 0.55, 0.18) * 2.0, smoothstep(0.6, 0.9, t));
  return mix(c, vec3(1.0, 0.9, 0.75) * 4.0, smoothstep(0.88, 1.0, t));
}
// a few long-crested waves; amplitude fades with the pixel footprint so the far sea never shimmers
vec3 dlava_swell(vec2 w, float fw, float calm){
  vec3 g = vec3(0.0);
  for (int i = 0; i < 6; i++){
    float fi = float(i);
    float k = 0.35 * pow(1.55, fi);
    float a = 0.16 / pow(1.7, fi) * (1.0 - calm);
    vec2 d = normalize(vec2(cos(fi * 1.7 + 0.4), sin(fi * 1.7 + 0.4)));
    float att = 1.0 - smoothstep(0.3, 1.0, k * fw);
    float x = dot(w, d) * k - uTime * sqrt(9.8 * k) * 0.35 * (1.0 - uStill) + fi * 1.3;
    g += vec3(a * sin(x), a * k * cos(x) * d) * att;
  }
  return g;
}
`;

export const defaultLava: WorldModule[] = [
  {
    id: 'dlava',
    isDefault: true,
    provides: ['lava_shade'],
    glsl:
      RAMP +
      /* glsl */ `
vec3 lava_shade(Ray r, Sea s, SeaMod m){
  vec3 g = dlava_swell(s.w, s.fw, m.calm) + m.g;
  vec3 n = normalize(s.up - g.y * s.eU - g.z * s.eV);
  float T = 0.32 + 0.12 * world_noise(s.w * 0.05 + vec2(0.0, uTime * 0.02)) + 0.4 * g.x + m.heat;
  vec3 col = dlava_bb(clamp(T, 0.0, 1.0)) * 0.5;
  vec3 rd = reflect(r.rd, n);
  if (dot(rd, s.up) < 0.0) rd = reflect(rd, s.up);
  float F = 0.04 + 0.96 * pow(1.0 - max(dot(-r.rd, n), 0.0), 5.0);
  Ray rr; rr.ro = s.p + s.up * 0.01; rr.rd = rd; rr.pa = r.pa * 2.0 + m.rough; rr.depth = 1;
  col += world_env(rr) * F * 0.9;
  return col + m.emit;
}`,
  },
  {
    id: 'dlavaenv',
    isDefault: true,
    provides: ['lava_env'],
    glsl: /* glsl */ `
vec3 lava_env(Ray r, Sea s){ return vec3(0.1, 0.005, 0.0008); }`,
  },
];
