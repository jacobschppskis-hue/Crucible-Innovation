// The liquid's fragment shader (GLSL ES 1.0, valid in WebGL1 and WebGL2) and its wave formula, shared by the worker
// renderer and the main-thread fallback. The formula is the one in field.ts (`sample`), written out in GLSL.

import { CALM_MAX, DECAY, DISP, SPEED, SPREAD, SWELL } from './field';

const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

export function fragment(cap: number) {
  const swell = SWELL.map(([ang, len, spd, a, ph]) => {
    const kx = (Math.cos(ang) * 2 * Math.PI) / len;
    const ky = (Math.sin(ang) * 2 * Math.PI) / len;
    const w = ((2 * Math.PI) / len) * spd;
    return `{ float ar = ${kx}*p.x + ${ky}*p.y - ${w}*uTime + ${ph}; h += ${a}*sin(ar); g += ${a}*cos(ar)*vec2(${kx}, ${ky}); }`;
  }).join('\n  ');
  return /* glsl */ `
precision highp float;
uniform vec2 uView;
uniform float uScale;
uniform float uScroll;
uniform float uTime;
uniform int uN;
uniform vec4 uA[${cap}];
uniform vec4 uB[${cap}];
uniform vec4 uCalm[${CALM_MAX}];

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uView.y * uScale - gl_FragCoord.y) / uScale;
  p.y += uScroll;
  vec2 g = vec2(0.0);
  vec2 gf = vec2(0.0); // floating things' tiny ripples: refraction only
  float hm = 0.0; // pointer / scroll strides: the tallest wave there (their union is one clean V wake)
  vec2 gm = vec2(0.0);
  float dA = 1e3; // px to the nearest crest line, weak and strong level
  float dB = 1e3;
  for (int i = 0; i < ${cap}; i++) {
    if (i >= uN) break;
    vec4 a = uA[i];
    vec4 sb = uB[i];
    float size = sb.x;
    float age = a.z;
    vec2 dv = p - a.xy;
    float r = length(dv);
    float sig = size * (1.0 + ${f(DISP)} * age);
    float R = ${f(SPEED)} * age;
    float d = r - R;
    if (abs(d) > 3.0 * sig) continue;
    float A = a.w * exp(-${f(DECAY)} * age) / sqrt((1.0 + R / ${f(SPREAD)}) * (1.0 + ${f(DISP)} * age));
    float e = exp(-0.5 * d * d / (sig * sig));
    vec2 gi = dv / max(r, 0.001) * (A * e * (-d / (sig * sig)));
    if (sb.y > 0.5) { gf += gi; continue; }
    g += gi;
    if (sb.z > 0.5) {
      if (A * e > hm) { hm = A * e; gm = gi; }
    } else {
      // a tap: its own rings (they cross other waves instead of merging into lumps)
      float Ac = min(A, 0.6); // rings keep their shape once strong
      float la = Ac > 0.105 ? abs(abs(d) - sig * sqrt(2.0 * log(Ac / 0.1))) : 1e3;
      float lb = Ac > 0.315 ? abs(abs(d) - sig * sqrt(2.0 * log(Ac / 0.3))) : 1e3;
      dA = min(dA, la);
      dB = min(dB, lb);
    }
  }
  float gml = max(length(gm), 0.0004);
  dA = min(dA, abs(hm - 0.1) / gml);
  dB = min(dB, abs(hm - 0.3) / gml);
  float h = 0.0;
  vec2 gp = g; // packets only
  g = vec2(0.0);
  ${swell}
  float hs = h;
  vec2 gs = g;

  // Body: even near-black. A very faint, fine, regular dot lattice seen through the surface (the slope bends where we
  // look), so refraction is visible without any blotchy texture.
  vec2 q = (p + (gp + gf + gs) * 70.0) / 16.0;
  vec2 f = fract(q) - 0.5;
  float dotv = 1.0 - smoothstep(0.07, 0.07 + 1.1 / (16.0 * uScale), length(f));
  vec3 col = vec3(0.047, 0.047, 0.043) + vec3(0.9, 0.78, 0.62) * 0.03 * dotv;

  // Crests: thin Ember iso-lines of the packet height (real wave fronts: rings, wakes), one pixel wide and crisp;
  // the idle swell is a fainter line along its own crests.
  float px = 1.0 / uScale;
  float hw = 0.6;
  float line = 0.5 * (1.0 - smoothstep(hw - 0.5 * px, hw + 0.5 * px, dA)) + 1.0 * (1.0 - smoothstep(hw - 0.5 * px, hw + 0.5 * px, dB));
  float gsl = max(length(gs), 0.00002);
  float sw = 0.16 * (1.0 - smoothstep(hw - 0.5 * px, hw + 0.5 * px, abs(hs - 0.0) / gsl));
  // Calm zones (the ASCII portraits): no crest lines over a face, a soft edge around the box.
  float fade = 1.0;
  for (int k = 0; k < ${CALM_MAX}; k++) {
    vec4 c = uCalm[k];
    if (c.z <= 0.0) continue;
    vec2 qd = abs(p - c.xy - 0.5 * c.zw) - 0.5 * c.zw;
    float dd = length(max(qd, 0.0)) + min(max(qd.x, qd.y), 0.0);
    fade *= smoothstep(-4.0, 36.0, dd);
  }
  col += vec3(1.0, 0.357, 0.122) * (min(line, 1.0) * 0.95 + sw) * fade;

  col += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0; // dither: no banding in the dark
  gl_FragColor = vec4(col, 1.0);
}`;
}

export const VERT = `attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

