// look: the image pipeline (post pass). The scene arrives as linear HDR radiance with the journey's exposure applied;
// the engine's bloom chain (13-tap down, tent up, summed over its levels) arrives in uBloom. Here: a lens's veil of
// bloom mixed in energy-conserving (a few percent), look's base gain, a natural vignette, AgX tone mapping with a mild
// punch (it desaturates toward white as things get very bright, so a blackbody reads right: Ember to yellow-white,
// without ACES's hue skews of saturated oranges), film grain about 1.4 px across that lives in the mid-tones, and a
// triangular dither so the long dark gradients of the sky never band.
uniform float look_uGain;      // linear: the base exposure of look's radiance units
uniform float look_uBloomAmt;  // 0.03..0.08
uniform float look_uPunch;     // 0..1
uniform float look_uGrain;     // ~0.02
uniform float look_uVignette;  // 0..1

const mat3 LOOK_AGX_IN = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051,
                              0.0784335999999992, 0.878468636469772, 0.0784336,
                              0.0792237451477643, 0.0791661274605434, 0.879142973793104);
const mat3 LOOK_AGX_OUT = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438,
                               -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
                               -0.0990297440797205, -0.0989611768448433, 1.15107367264116);

vec3 look_agx(vec3 c, float punch) {
  const float minEv = -12.47393, maxEv = 4.026069;
  c = LOOK_AGX_IN * max(c, vec3(1e-10));
  c = (clamp(log2(c), minEv, maxEv) - minEv) / (maxEv - minEv);
  vec3 x2 = c * c, x4 = x2 * x2;
  c = 15.5 * x4 * x2 - 40.14 * x4 * c + 31.96 * x4 - 6.868 * x2 * c + 0.4298 * x2 + 0.1191 * c - 0.00232;
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = pow(max(c, vec3(0.0)), vec3(mix(1.0, 1.35, punch)));
  c = luma + mix(1.0, 1.4, punch) * (c - luma);
  return pow(max(LOOK_AGX_OUT * c, vec3(0.0)), vec3(2.2));
}

vec3 look_srgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

float look_ph(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }

// The scene is rendered at the quality step's scale (an iPhone settles at 0.75-0.9 render px per CSS px, shown on a
// 2x canvas): a bilinear upscale of 2-2.7x reads soft and magnifies stair-steps. Catmull-Rom (bicubic, 9 bilinear taps,
// the Filmic SMAA / TAA resolve kernel) keeps edges and point lights crisp without ringing worth noticing.
vec3 look_sceneCR(vec2 uv) {
  vec2 res = vec2(textureSize(uScene, 0));
  if (res.x >= uCanvas.x - 0.5) return world_scene(uv);   // no upscale: plain sample
  vec2 sp = uv * res, tp = floor(sp - 0.5) + 0.5, f = sp - tp;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2, o12 = w2 / w12;
  vec2 t0 = (tp - 1.0) / res, t3 = (tp + 2.0) / res, t12 = (tp + o12) / res;
  vec3 c = vec3(0.0);
  c += world_scene(vec2(t0.x, t0.y)) * w0.x * w0.y + world_scene(vec2(t12.x, t0.y)) * w12.x * w0.y + world_scene(vec2(t3.x, t0.y)) * w3.x * w0.y;
  c += world_scene(vec2(t0.x, t12.y)) * w0.x * w12.y + world_scene(vec2(t12.x, t12.y)) * w12.x * w12.y + world_scene(vec2(t3.x, t12.y)) * w3.x * w12.y;
  c += world_scene(vec2(t0.x, t3.y)) * w0.x * w3.y + world_scene(vec2(t12.x, t3.y)) * w12.x * w3.y + world_scene(vec2(t3.x, t3.y)) * w3.x * w3.y;
  return max(c, vec3(0.0));
}

vec3 look_post(vec2 uv, vec2 fc) {
  vec3 c = world_crisp(look_sceneCR(uv), uv); // the crisp pass (world) over the upscaled scene
  if (uBloomOn > 0.5) c = mix(c, texture(uBloom, uv).rgb * 0.2, look_uBloomAmt); // 5 levels summed -> mean
  vec2 d = (uv - 0.5) * vec2(uCanvas.x / uCanvas.y, 1.0);
  float r2 = dot(d, d) / (0.25 * (uCanvas.x * uCanvas.x / (uCanvas.y * uCanvas.y) + 1.0));
  float vg = 1.0 / (1.0 + r2 * 0.35);
  c *= look_uGain * mix(1.0, vg * vg, look_uVignette);
  c = look_agx(c, look_uPunch);
  // grain (frozen under reduced motion)
  float fr = uStill > 0.5 ? 0.0 : mod(floor(uTime * 24.0), 64.0);
  vec2 q = fc / 1.4, i = floor(q), f = fract(q), w = f * f * (3.0 - 2.0 * f);
  float n = mix(mix(look_ph(vec3(i, fr)), look_ph(vec3(i + vec2(1, 0), fr)), w.x),
                mix(look_ph(vec3(i + vec2(0, 1), fr)), look_ph(vec3(i + vec2(1, 1), fr)), w.x), w.y) - 0.5;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float gw = smoothstep(0.0, 0.18, l) * (1.0 - smoothstep(0.55, 1.0, l)) * 0.85 + 0.15;
  c += n * look_uGrain * gw * vec3(1.0, 0.96, 1.04);
  c = look_srgb(c);
  // triangular dither, +-1 LSB
  float a = look_ph(vec3(fc, fr + 0.5)), b = look_ph(vec3(fc + 17.3, fr + 9.5));
  return c + (a + b - 1.0) / 255.0;
}
