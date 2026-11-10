// The image pipeline after the HDR scene: bloom (built elsewhere: a mip chain with Karis-averaged 13-tap downsample and
// tent upsample, Jimenez 2014), then exposure, AgX tone mapping (Sobotka; polynomial fit), a gentle grade that keeps
// the brand (Ember stays the only hot accent; shadows lean very slightly cool, never teal), a natural vignette, film
// grain that lives in the mid-tones, and a triangular dither so dark gradients never band.
#ifndef POST_GLSL
#define POST_GLSL

const mat3 AGX_IN = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051,
                         0.0784335999999992, 0.878468636469772, 0.0784336,
                         0.0792237451477643, 0.0791661274605434, 0.879142973793104);
const mat3 AGX_OUT = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438,
                          -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
                          -0.0990297440797205, -0.0989611768448433, 1.15107367264116);

vec3 agxContrast(vec3 x) {
  vec3 x2 = x * x, x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

// HDR linear (Rec.709) -> display-referred linear, AgX with a mild "punch" look.
vec3 agx(vec3 c, float punch) {
  const float minEv = -12.47393, maxEv = 4.026069;
  c = AGX_IN * max(c, vec3(1e-10));
  c = clamp(log2(c), minEv, maxEv);
  c = (c - minEv) / (maxEv - minEv);
  c = agxContrast(c);
  // look: power and saturation (punchy = 1)
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = pow(max(c, vec3(0.0)), vec3(mix(1.0, 1.35, punch)));
  c = luma + mix(1.0, 1.4, punch) * (c - luma);
  c = AGX_OUT * c;
  return pow(max(c, vec3(0.0)), vec3(2.2));
}

vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

float p_hash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }

// Film grain: a smooth noise about 1.4 px across (white per-pixel noise reads as digital), strongest in the mid-tones,
// faint in the shadows and highlights, slightly varied per channel like dye clouds. `amt` ~ 0.03.
vec3 grain(vec3 c, vec2 px, float frame, float amt) {
  vec2 q = px / 1.4;
  vec2 i = floor(q), f = fract(q);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float fr = mod(frame, 64.0);
  float a = p_hash(vec3(i, fr)), b = p_hash(vec3(i + vec2(1, 0), fr));
  float c0 = p_hash(vec3(i + vec2(0, 1), fr)), d = p_hash(vec3(i + vec2(1, 1), fr));
  float n = mix(mix(a, b, u.x), mix(c0, d, u.x), u.y) - 0.5;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float w = smoothstep(0.0, 0.18, l) * (1.0 - smoothstep(0.55, 1.0, l)) * 0.85 + 0.15;
  vec3 tint = vec3(1.0, 0.96, 1.04);
  return c + n * amt * w * tint;
}

// Triangular-PDF dither of +-1 LSB at 8 bits: removes banding in the dark sky's long gradients.
vec3 dither8(vec3 c, vec2 px, float frame) {
  float a = p_hash(vec3(px, mod(frame, 32.0) + 0.5));
  float b = p_hash(vec3(px + 17.3, mod(frame, 32.0) + 9.5));
  return c + (a + b - 1.0) / 255.0;
}

// Natural vignette (cos^4 falloff of a real lens, softened): darkens corners by ~18% at the widest frame.
float vignette(vec2 uv, float aspect, float amt) {
  vec2 d = (uv - 0.5) * vec2(aspect, 1.0);
  float r2 = dot(d, d) / (0.25 * (aspect * aspect + 1.0));
  float c = 1.0 / (1.0 + r2 * 0.35);
  return mix(1.0, c * c, amt);
}

#endif
