// Post passes (one fragment shader, pass chosen by a define):
//   PASS_DOWN   13-tap downsample (Jimenez 2014); the first level uses a Karis average so single hot pixels (glints,
//               star cores) can't flicker into big blobs
//   PASS_UP     3x3 tent upsample, added onto the next finer level
//   PASS_FINAL  exposure, bloom mix, AgX, grade, vignette, grain, dither -> sRGB
uniform sampler2D uSrc;
uniform vec2 uSrcTexel;   // 1 / source size
uniform vec2 uDstRes;
out vec4 outColor;

#ifdef PASS_DOWN
uniform float uFirst;
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 karis(vec3 a, vec3 b, vec3 c, vec3 d) {
  float wa = 1.0 / (1.0 + lum(a)), wb = 1.0 / (1.0 + lum(b)), wc = 1.0 / (1.0 + lum(c)), wd = 1.0 / (1.0 + lum(d));
  return (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uDstRes;
  vec2 t = uSrcTexel;
  vec3 a = texture(uSrc, uv + t * vec2(-2, 2)).rgb, b = texture(uSrc, uv + t * vec2(0, 2)).rgb, c = texture(uSrc, uv + t * vec2(2, 2)).rgb;
  vec3 d = texture(uSrc, uv + t * vec2(-2, 0)).rgb, e = texture(uSrc, uv).rgb, f = texture(uSrc, uv + t * vec2(2, 0)).rgb;
  vec3 g = texture(uSrc, uv + t * vec2(-2, -2)).rgb, h = texture(uSrc, uv + t * vec2(0, -2)).rgb, i = texture(uSrc, uv + t * vec2(2, -2)).rgb;
  vec3 j = texture(uSrc, uv + t * vec2(-1, 1)).rgb, k = texture(uSrc, uv + t * vec2(1, 1)).rgb;
  vec3 l = texture(uSrc, uv + t * vec2(-1, -1)).rgb, m = texture(uSrc, uv + t * vec2(1, -1)).rgb;
  vec3 o;
  if (uFirst > 0.5) {
    o = karis(j, k, l, m) * 0.5 + karis(a, b, d, e) * 0.125 + karis(b, c, e, f) * 0.125 + karis(d, e, g, h) * 0.125 + karis(e, f, h, i) * 0.125;
  } else {
    o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  outColor = vec4(max(o, vec3(0.0)), 1.0);
}
#endif

#ifdef PASS_UP
uniform float uRadius;
void main() {
  vec2 uv = gl_FragCoord.xy / uDstRes;
  vec2 t = uSrcTexel * uRadius;
  vec3 s = texture(uSrc, uv + t * vec2(-1, 1)).rgb + texture(uSrc, uv + t * vec2(1, 1)).rgb
         + texture(uSrc, uv + t * vec2(-1, -1)).rgb + texture(uSrc, uv + t * vec2(1, -1)).rgb;
  s += 2.0 * (texture(uSrc, uv + t * vec2(0, 1)).rgb + texture(uSrc, uv + t * vec2(0, -1)).rgb
            + texture(uSrc, uv + t * vec2(-1, 0)).rgb + texture(uSrc, uv + t * vec2(1, 0)).rgb);
  s += 4.0 * texture(uSrc, uv).rgb;
  outColor = vec4(s / 16.0, 1.0); // blended additively onto the destination
}
#endif

#ifdef PASS_FINAL
uniform sampler2D uBloom;
uniform float uExposure;   // linear multiplier
uniform float uBloomAmt;   // 0.03..0.08
uniform float uPunch;      // AgX look
uniform float uGrain;
uniform float uVignette;
uniform float uFrameN;
void main() {
  vec2 uv = gl_FragCoord.xy / uDstRes;
  vec3 hdr = texture(uSrc, uv).rgb;
  vec3 bl = texture(uBloom, uv).rgb;
  vec3 c = mix(hdr, bl, uBloomAmt);
  c *= uExposure * vignette(uv, uDstRes.x / uDstRes.y, uVignette);
  c = agx(c, uPunch);
  c = grain(c, gl_FragCoord.xy, uFrameN, uGrain);
  c = toSRGB(c);
  c = dither8(c, gl_FragCoord.xy, uFrameN);
  outColor = vec4(c, 1.0);
}
#endif
