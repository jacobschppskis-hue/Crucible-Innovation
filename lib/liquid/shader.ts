// The liquid's fragment shader (GLSL ES 1.0, valid in WebGL1 and WebGL2) and its wave formula, shared by the worker
// renderer and the main-thread fallback. The formula is the one in field.ts (`sample`), written out in GLSL.

import { DECAY, DISP, K0, KDROP, SPEED, SPREAD, SWELL } from './field';

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

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uView.y * uScale - gl_FragCoord.y) / uScale;
  p.y += uScroll;
  float h = 0.0;
  vec2 g = vec2(0.0);
  for (int i = 0; i < ${cap}; i++) {
    if (i >= uN) break;
    vec4 a = uA[i];
    float size = uB[i].x;
    float age = a.z;
    vec2 dv = p - a.xy;
    float r = length(dv);
    float sig = size * (1.0 + ${f(DISP)} * age);
    float R = ${f(SPEED)} * age;
    float d = r - R;
    if (abs(d) > 3.0 * sig) continue;
    float k = ${K0} / size / (1.0 + ${f(KDROP)} * age);
    float A = a.w * exp(-${f(DECAY)} * age) / sqrt((1.0 + R / ${f(SPREAD)}) * (1.0 + ${f(DISP)} * age));
    float e = exp(-0.5 * d * d / (sig * sig));
    float c = cos(k * d);
    float s = sin(k * d);
    h += A * e * c;
    g += dv / max(r, 0.001) * (A * e * (-d / (sig * sig) * c - k * s));
  }
  ${swell}

  // Body: near-black with a faint texture, seen through the surface (the slope bends where we look).
  vec2 q = (p + g * 320.0) / 90.0;
  float tx = vnoise(q) * 0.6 + vnoise(q * 2.3 + 7.0) * 0.4;
  vec3 col = vec3(0.051, 0.051, 0.043) + vec3(0.9, 0.78, 0.62) * 0.034 * smoothstep(0.3, 0.9, tx);

  // Crests and troughs: thin Ember iso-lines of h. Brighter for stronger waves (higher levels only exist there).
  float gl = max(length(g), 0.00005);
  float px = 1.0 / uScale;
  float hw = 0.55;
  float line = 0.0;
  line += 0.1 * (1.0 - smoothstep(hw - 0.5 * px, hw + 0.5 * px, abs(h - 0.07) / gl));
  line += 0.45 * (1.0 - smoothstep(hw - 0.5 * px, hw + 0.5 * px, abs(h - 0.24) / gl));
  line += 1.0 * (1.0 - smoothstep(hw - 0.5 * px, hw + 0.5 * px, abs(h - 0.5) / gl));
  line += 0.3 * (1.0 - smoothstep(hw - 0.5 * px, hw + 0.5 * px, abs(h + 0.3) / gl));
  col += vec3(1.0, 0.357, 0.122) * min(line, 1.0) * 0.9;

  col += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0; // dither: no banding in the dark
  gl_FragColor = vec4(col, 1.0);
}`;
}

export const VERT = `attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

