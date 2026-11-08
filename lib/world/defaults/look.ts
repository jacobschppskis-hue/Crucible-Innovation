// Stand-ins for the `look` role's functions, so the world renders before look lands. Owned by world; replaced by
// lib/world/look.ts as soon as it registers modules that provide look_sky / look_atmo / look_post.

import type { WorldModule } from '../modules';

export const defaultLook: WorldModule[] = [
  {
    id: 'dsky',
    isDefault: true,
    provides: ['look_sky'],
    glsl: /* glsl */ `
vec3 dsky_stars(vec3 d, float pa){
  vec3 col = vec3(0.0);
  for (int l = 0; l < 2; l++){
    float S = l == 0 ? 180.0 : 420.0;
    vec3 p = d * S; vec3 c = floor(p); vec3 h = world_hash33(c);
    float thr = l == 0 ? 0.92 : 0.965;
    if (h.x < thr) continue;
    vec3 sp = normalize(c + 0.5 + (h - 0.5) * 0.6);
    float a = length(d - sp); float w = max(pa * 0.7, 0.0004);
    float b = pow((h.x - thr) / (1.0 - thr), 3.0) * exp(-a * a / (w * w)) * (l == 0 ? 2.5 : 1.2);
    col += b * mix(vec3(1.0, 0.82, 0.62), vec3(0.72, 0.84, 1.0), h.y);
  }
  return col;
}
vec3 look_sky(Ray r){
  vec3 d = r.rd, up = uCamUp, S = uSunDir;
  float e = dot(d, up);
  // horizon dip from altitude: the sea's limb sits below e = 0
  float dip = -sqrt(max(1.0 - (uR * uR) / dot(uCamPos, uCamPos), 0.0));
  float ea = e - dip;
  float air = exp(-uCamH / 600.0);             // the atmosphere is thin: seen low, a line of light from orbit
  vec3 dh = normalize(d - up * e + 1e-6), sh = normalize(S - up * dot(S, up) + 1e-6);
  float az = max(dot(dh, sh), 0.0);
  float sunE = dot(S, up);
  float dusk = smoothstep(-0.25, 0.05, sunE);  // how much sun is left near the horizon
  vec3 col = dsky_stars(d, r.pa) * smoothstep(0.0, 0.25, ea) * (1.0 - 0.7 * dusk * air);
  float g = exp(-max(ea, 0.0) / 0.05) * (0.15 + 1.4 * pow(az, 6.0));
  float g2 = exp(-max(ea, 0.0) / 0.22) * (0.1 + 0.5 * pow(az, 2.0));
  col += air * dusk * (vec3(1.0, 0.32, 0.08) * g * 0.9 + vec3(0.55, 0.22, 0.18) * g2 * 0.35);
  col += air * dusk * QUENCH * 0.05 * exp(-abs(ea - 0.18) / 0.08) * (0.4 + 0.6 * az);
  // the limb from orbit: a thin line of light
  col += vec3(1.0, 0.45, 0.2) * 0.4 * exp(-abs(ea) / (0.002 + r.pa * 2.0)) * (1.0 - air) * smoothstep(-0.02, 0.0, ea) * (0.2 + dusk);
  // the sun: a white-hot heart, Ember limb, soft corona
  float th = acos(clamp(dot(d, S), -1.0, 1.0));
  float x = th / uSunRad;
  float disc = smoothstep(1.0 + r.pa / uSunRad, 1.0 - r.pa / uSunRad, x);
  vec3 dc = mix(vec3(1.0, 0.93, 0.8) * 30.0, EMBER * 8.0, smoothstep(0.2, 1.0, x * x));
  col = mix(col, dc, disc);
  col += vec3(1.0, 0.5, 0.2) * (0.6 * exp(-(x - 1.0) * 1.2) + 0.08 * exp(-(x - 1.0) * 0.15)) * step(1.0, x);
  return col;
}`,
  },
  {
    id: 'datmo',
    isDefault: true,
    provides: ['look_atmo'],
    glsl: /* glsl */ `
vec3 look_atmo(vec3 col, Ray r, Hit h){
  if (h.id == ID_SKY) return col;
  float air = exp(-uCamH / 600.0);
  float k = 1.0 - exp(-h.t / 900.0);
  vec3 S = uSunDir; float az = max(dot(r.rd, S), 0.0);
  vec3 haze = vec3(0.5, 0.14, 0.04) * (0.15 + 0.8 * pow(az, 8.0)) * smoothstep(-0.2, 0.05, dot(S, uCamUp));
  return mix(col, haze, k * air * 0.8);
}`,
  },
  {
    id: 'dpost',
    isDefault: true,
    provides: ['look_post'],
    post: /* glsl */ `
vec3 dpost_aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float dpost_h(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 look_post(vec2 uv, vec2 fc){
  vec3 c = world_scene(uv);
  c += texture(uBloom, uv).rgb * 0.08 * uBloomOn;
  c = dpost_aces(c * 0.9);
  c = pow(c, vec3(1.0 / 2.2));
  c += (dpost_h(fc + fract(uTime * 7.13) * 97.0) - 0.5) / 255.0 * 1.5;
  return c;
}`,
  },
];
